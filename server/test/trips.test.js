import test from 'node:test';
import assert from 'node:assert/strict';
import {
  db,
  trips,
  userByPhone,
  createTestTrip,
  pendingOfferFor,
  resetTrips,
} from '../test-utils/setup.js';

function setDriverOnline(phone = '0901111222') {
  const user = userByPhone(phone);
  db.prepare(
    `UPDATE driver_profiles SET online_status = 'online', current_lat = 10.7769, current_lng = 106.7009,
       verification_status = 'approved', updated_at = ? WHERE user_id = ?`,
  ).run(new Date().toISOString(), user.id);
  return user;
}

function tripRow(id) {
  return db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
}

function eventTypes(tripId) {
  return db
    .prepare('SELECT type FROM trip_events WHERE trip_id = ? ORDER BY id')
    .all(tripId)
    .map((event) => event.type);
}

test.beforeEach(() => {
  resetTrips();
});

test('luồng đầy đủ: tạo → nhận → tới → bắt đầu → hoàn thành', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });

  assert.equal(trip.status, 'searching');

  const offer = pendingOfferFor(trip.id);
  const accepted = trips.acceptOffer(driver, offer.id);
  assert.equal(accepted.status, 'assigned');
  assert.equal(accepted.driver.id, driver.id);

  const arrived = trips.markArrived(driver, trip.id);
  assert.equal(arrived.status, 'arrived');

  const started = trips.startTrip(driver, trip.id);
  assert.equal(started.status, 'in_progress');

  const completed = trips.completeTrip(driver, trip.id);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.finalPrice, trip.estimatedPrice);
  assert.equal(completed.paymentStatus, 'paid');
  assert.equal(completed.commissionAmount + completed.driverEarning, completed.finalPrice);

  assert.deepEqual(eventTypes(trip.id), [
    'created',
    'search_round',
    'accepted',
    'arrived',
    'started',
    'completed',
  ]);

  const profile = db
    .prepare('SELECT online_status, trips_completed FROM driver_profiles WHERE user_id = ?')
    .get(driver.id);
  assert.equal(profile.online_status, 'online', 'tài xế trở lại trạng thái sẵn sàng sau chuyến');
});

test('hoàn thành với giá cuối khác giá ước tính sẽ tính lại hoa hồng', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);
  trips.markArrived(driver, trip.id);
  trips.startTrip(driver, trip.id);

  const completed = trips.completeTrip(driver, trip.id, { finalPrice: 200000 });
  assert.equal(completed.finalPrice, 200000);
  assert.equal(completed.commissionAmount, 40000);
  assert.equal(completed.driverEarning, 160000);
});

test('không thể bắt đầu chuyến khi chưa nhận chuyến', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });

  assert.throws(() => trips.startTrip(driver, trip.id), /không phải tài xế của chuyến này/);
});

test('không thể hoàn thành chuyến khi chưa bắt đầu', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);

  assert.throws(() => trips.completeTrip(driver, trip.id), /Chuyến chưa bắt đầu/);
});

test('không thể xác nhận tới điểm đón hai lần', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);
  trips.markArrived(driver, trip.id);

  assert.throws(() => trips.markArrived(driver, trip.id), /không ở trạng thái có thể xác nhận đến/);
});

test('tài xế khác không thể thao tác trên chuyến không phải của mình', () => {
  const driver = setDriverOnline();
  const other = userByPhone('0902222333');
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);

  assert.throws(() => trips.markArrived(other, trip.id), /không phải tài xế của chuyến này/);
  assert.throws(() => trips.startTrip(other, trip.id), /không phải tài xế của chuyến này/);
  assert.throws(() => trips.completeTrip(other, trip.id), /không phải tài xế của chuyến này/);
});

test('tài xế không thể nhận lời mời của tài xế khác', () => {
  setDriverOnline();
  const other = userByPhone('0902222333');
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);

  assert.throws(() => trips.acceptOffer(other, offer.id), /không thuộc về bạn/);
});

test('lời mời đã được xử lý không thể nhận lại', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);

  assert.throws(() => trips.acceptOffer(driver, offer.id), /đã được xử lý hoặc hết hạn/);
});

test('lời mời hết hạn bị từ chối khi nhận', () => {
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);

  db.prepare('UPDATE trip_offers SET expires_at = ? WHERE id = ?').run(
    new Date(Date.now() - 60_000).toISOString(),
    offer.id,
  );

  assert.throws(() => trips.acceptOffer(driver, offer.id), /đã hết hạn/);
  assert.equal(db.prepare('SELECT status FROM trip_offers WHERE id = ?').get(offer.id).status, 'expired');
});

test('khách có thể hủy chuyến đang tìm tài xế', () => {
  setDriverOnline();
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });

  const cancelled = trips.cancelTrip(customer, trip.id, 'Tôi đổi kế hoạch');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelReason, 'Tôi đổi kế hoạch');
  assert.equal(cancelled.cancelledBy, 'customer');
  assert.ok(eventTypes(trip.id).includes('cancelled'));
});

test('khách không thể hủy chuyến đã hoàn thành', () => {
  const driver = setDriverOnline();
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);
  trips.markArrived(driver, trip.id);
  trips.startTrip(driver, trip.id);
  trips.completeTrip(driver, trip.id);

  assert.throws(() => trips.cancelTrip(customer, trip.id, 'Muộn quá'), /không thể hủy/);
});

test('khách chỉ được đánh giá chuyến đã hoàn thành và một lần duy nhất', () => {
  const driver = setDriverOnline();
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });

  assert.throws(() => trips.rateTrip(customer, trip.id, { stars: 5 }), /hoàn thành/);

  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);
  trips.markArrived(driver, trip.id);
  trips.startTrip(driver, trip.id);
  trips.completeTrip(driver, trip.id);

  const rated = trips.rateTrip(customer, trip.id, { stars: 5, comment: 'Tài xế thân thiện' });
  assert.equal(rated.rating, 5);
  assert.equal(rated.review, 'Tài xế thân thiện');

  assert.throws(
    () => trips.rateTrip(customer, trip.id, { stars: 4 }),
    /đã đánh giá/,
  );
});

test('đánh giá sai số sao bị từ chối', () => {
  const driver = setDriverOnline();
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);
  trips.markArrived(driver, trip.id);
  trips.startTrip(driver, trip.id);
  trips.completeTrip(driver, trip.id);

  assert.throws(() => trips.rateTrip(customer, trip.id, { stars: 0 }), /1 đến 5/);
  assert.throws(() => trips.rateTrip(customer, trip.id, { stars: 6 }), /1 đến 5/);
});

test('khách khác không thể xem chi tiết chuyến không phải của mình', () => {
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const otherCustomer = userByPhone('0987654321');

  assert.throws(() => trips.assertTripAccess(tripRow(trip.id), otherCustomer), /không có quyền/);
});

test('admin có thể gán tài xế thủ công cho chuyến đang tìm', () => {
  const admin = userByPhone('0900000001');
  const driver = setDriverOnline();
  const { trip } = createTestTrip({ distanceKm: 8, durationMin: 22 });

  const assigned = trips.assignDriverManually(admin, trip.id, driver.id);
  assert.equal(assigned.status, 'assigned');
  assert.equal(assigned.driver.id, driver.id);
  assert.ok(eventTypes(trip.id).includes('assigned_manual'));
});

test('khách có thể thử lại khi chuyến không tìm được tài xế', () => {
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  db.prepare(`UPDATE trips SET status = 'no_driver' WHERE id = ?`).run(trip.id);

  setDriverOnline();
  const retried = trips.retrySearch(customer, trip.id);
  assert.equal(retried.status, 'searching');
  assert.ok(eventTypes(trip.id).includes('search_retry'));
});

test('thử lại khi đang tìm tài xế sẽ làm mới vòng tìm và hủy lời mời cũ', () => {
  setDriverOnline();
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const firstOffer = pendingOfferFor(trip.id);

  const retried = trips.retrySearch(customer, trip.id);
  assert.equal(retried.status, 'searching');
  assert.equal(retried.searchRound, 1, 'vòng tìm được đếm lại từ đầu');

  const oldOffer = db.prepare('SELECT status FROM trip_offers WHERE id = ?').get(firstOffer.id);
  assert.equal(oldOffer.status, 'superseded');
  assert.ok(eventTypes(trip.id).includes('search_retry'));
});

test('không thể thử lại khi chuyến đã hoàn thành', () => {
  const driver = setDriverOnline();
  const { trip, customer } = createTestTrip({ distanceKm: 8, durationMin: 22 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(driver, offer.id);
  trips.markArrived(driver, trip.id);
  trips.startTrip(driver, trip.id);
  trips.completeTrip(driver, trip.id);

  assert.throws(() => trips.retrySearch(customer, trip.id), /không ở trạng thái có thể tìm lại/);
});

test('chặn đặt chuyến trùng trong 2 phút', () => {
  setDriverOnline();
  createTestTrip({ distanceKm: 8, durationMin: 22 });

  assert.throws(
    () => createTestTrip({ distanceKm: 8, durationMin: 22 }),
    /vừa đặt chuyến tương tự/,
  );
});

test('chặn đặt chuyến khi số khách vượt sức chứa', () => {
  const customer = userByPhone('0901234567');
  const sedan = db.prepare(`SELECT id FROM vehicle_types WHERE code = 'sedan4'`).get();

  assert.throws(
    () =>
      trips.createTrip(customer, {
        vehicleTypeId: sedan.id,
        pickup: { label: 'A', address: 'A', lat: 10.77, lng: 106.69 },
        dropoff: { label: 'B', address: 'B', lat: 10.79, lng: 106.72 },
        passengers: 9,
        quote: { total: 100000 },
      }),
    /chỉ chở tối đa/,
  );
});

test('chặn đặt chuyến khi thiếu báo giá', () => {
  const customer = userByPhone('0901234567');
  const sedan = db.prepare(`SELECT id FROM vehicle_types WHERE code = 'sedan4'`).get();

  assert.throws(
    () =>
      trips.createTrip(customer, {
        vehicleTypeId: sedan.id,
        pickup: { label: 'A', address: 'A', lat: 10.77, lng: 106.69 },
        dropoff: { label: 'B', address: 'B', lat: 10.79, lng: 106.72 },
      }),
    /Thiếu báo giá/,
  );
});

test('chặn đặt trước quá gần giờ hiện tại', () => {
  const customer = userByPhone('0901234567');
  const sedan = db.prepare(`SELECT id FROM vehicle_types WHERE code = 'sedan4'`).get();

  assert.throws(
    () =>
      trips.createTrip(customer, {
        vehicleTypeId: sedan.id,
        pickup: { label: 'A', address: 'A', lat: 10.77, lng: 106.69 },
        dropoff: { label: 'B', address: 'B', lat: 10.79, lng: 106.72 },
        scheduleType: 'scheduled',
        scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        quote: { total: 100000 },
      }),
    /ít nhất 15 phút/,
  );
});
