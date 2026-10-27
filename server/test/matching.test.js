import test from 'node:test';
import assert from 'node:assert/strict';
import {
  db,
  config,
  matching,
  trips,
  userByPhone,
  vehicleTypeByCode,
  createTestTrip,
  pendingOfferFor,
  resetTrips,
  PICKUP,
} from '../test-utils/setup.js';

const sedan = () => vehicleTypeByCode('sedan4');

test.beforeEach(() => {
  resetTrips();
});

function setDriverState(phone, { online, lat, lng, verification = 'approved' }) {
  const user = userByPhone(phone);
  db.prepare(
    `UPDATE driver_profiles
       SET online_status = ?, current_lat = ?, current_lng = ?, verification_status = ?, updated_at = ?
     WHERE user_id = ?`,
  ).run(online, lat, lng, verification, new Date().toISOString(), user.id);
  return user;
}

function tripRow(id) {
  return db.prepare('SELECT * FROM trips WHERE id = ?').get(id);
}

test('chỉ tài xế online, đã xác minh, đúng loại xe và trong bán kính mới đủ điều kiện', () => {
  const hung = setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });
  const viet = setDriverState('0901234000', { online: 'offline', lat: 10.7769, lng: 106.7009 });
  const mai = setDriverState('0902222333', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const trip = {
    id: -1,
    vehicle_type_id: sedan().id,
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
    scheduled_at: null,
  };

  const eligible = matching.findEligibleDrivers(trip, { limit: 10 });
  const ids = eligible.map((row) => row.driver_id);

  assert.ok(ids.includes(hung.id), 'tài xế online đúng loại xe phải đủ điều kiện');
  assert.ok(!ids.includes(viet.id), 'tài xế offline không đủ điều kiện');
  assert.ok(!ids.includes(mai.id), 'tài xế sai loại xe không đủ điều kiện');
  assert.ok(eligible.every((row) => row.distanceKm <= config.matching.radiusKm));
});

test('tài xế ngoài bán kính bị loại khỏi danh sách', () => {
  const hung = setDriverState('0901111222', { online: 'online', lat: 21.0287, lng: 105.8524 });

  const trip = {
    id: -1,
    vehicle_type_id: sedan().id,
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
    scheduled_at: null,
  };

  const ids = matching.findEligibleDrivers(trip, { limit: 10 }).map((row) => row.driver_id);
  assert.ok(!ids.includes(hung.id), 'tài xế ở Hà Nội không phục vụ chuyến tại TP.HCM');

  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });
});

test('tài xế chưa xác minh không nhận được lời mời', () => {
  const hung = setDriverState('0901111222', {
    online: 'online',
    lat: 10.7769,
    lng: 106.7009,
    verification: 'pending',
  });

  const trip = {
    id: -1,
    vehicle_type_id: sedan().id,
    pickup_lat: PICKUP.lat,
    pickup_lng: PICKUP.lng,
    scheduled_at: null,
  };

  const ids = matching.findEligibleDrivers(trip, { limit: 10 }).map((row) => row.driver_id);
  assert.ok(!ids.includes(hung.id));

  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });
});

test('tạo chuyến sẽ gửi lời mời ngay và ghi nhận vòng tìm đầu tiên', () => {
  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const { trip } = createTestTrip({ distanceKm: 5, durationMin: 15 });
  const row = tripRow(trip.id);

  assert.equal(row.status, 'searching');
  assert.equal(row.search_round, 1);
  assert.ok(row.offer_expires_at, 'phải có hạn phản hồi cho lời mời');

  const offer = pendingOfferFor(trip.id);
  assert.ok(offer, 'phải tạo lời mời cho tài xế đủ điều kiện');
  assert.equal(offer.round, 1);
  assert.ok(offer.distance_km >= 0);

  const events = db
    .prepare('SELECT type FROM trip_events WHERE trip_id = ? ORDER BY id')
    .all(trip.id)
    .map((event) => event.type);
  assert.ok(events.includes('created'));
  assert.ok(events.includes('search_round'));
});

test('không có tài xế phù hợp thì chuyến chuyển sang trạng thái no_driver', () => {
  const bus = vehicleTypeByCode('bus45');
  const customer = userByPhone('0901234567');

  const trip = trips.createTrip(customer, {
    vehicleTypeId: bus.id,
    pickup: PICKUP,
    dropoff: { label: 'Đà Lạt', address: 'TP. Đà Lạt', lat: 11.9404, lng: 108.4583 },
    distanceKm: 300,
    durationMin: 420,
    passengers: 20,
    quote: { total: 5000000, commission: 1000000, driverEarning: 4000000 },
  });

  assert.equal(trip.status, 'no_driver');
  assert.equal(pendingOfferFor(trip.id), undefined);

  const events = db
    .prepare('SELECT type FROM trip_events WHERE trip_id = ?')
    .all(trip.id)
    .map((event) => event.type);
  assert.ok(events.includes('no_driver'));
});

test('hết hạn lời mời sẽ đóng lời mời và mở vòng tìm mới', () => {
  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const { trip } = createTestTrip({ distanceKm: 4, durationMin: 12 });
  const offer = pendingOfferFor(trip.id);
  assert.ok(offer);

  db.prepare('UPDATE trip_offers SET expires_at = ? WHERE id = ?').run(
    new Date(Date.now() - 60_000).toISOString(),
    offer.id,
  );

  const expiredCount = matching.expireOffers();
  assert.ok(expiredCount >= 1);

  const after = db.prepare('SELECT status FROM trip_offers WHERE id = ?').get(offer.id);
  assert.equal(after.status, 'expired');

  const row = tripRow(trip.id);
  assert.ok(
    row.status === 'no_driver' || row.search_round > 1,
    'chuyến phải chuyển vòng hoặc kết thúc khi không còn tài xế',
  );
});

test('vượt số vòng tối đa thì kết thúc tìm kiếm', () => {
  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const { trip } = createTestTrip({ distanceKm: 4, durationMin: 12 });
  db.prepare('UPDATE trips SET search_round = ? WHERE id = ?').run(
    config.matching.maxRounds,
    trip.id,
  );

  const result = matching.dispatchRound(trip.id);
  assert.equal(result.exhausted, true);
  assert.equal(tripRow(trip.id).status, 'no_driver');
});

test('tài xế đang có chuyến khác không nhận thêm lời mời', () => {
  const hung = setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const { trip } = createTestTrip({ distanceKm: 4, durationMin: 12 });
  const offer = pendingOfferFor(trip.id);
  trips.acceptOffer(hung, offer.id);

  const second = createTestTrip({
    distanceKm: 6,
    durationMin: 16,
    dropoff: { label: 'Bến xe Miền Đông', address: '292 Đinh Bộ Lĩnh', lat: 10.8142, lng: 106.7106 },
  });
  assert.equal(second.trip.status, 'no_driver');

  db.prepare(`UPDATE driver_profiles SET online_status = 'online' WHERE user_id = ?`).run(hung.id);
});

test('tài xế đã từ chối sẽ không nhận lại lời mời của cùng chuyến', () => {
  const hung = setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const { trip } = createTestTrip({ distanceKm: 4, durationMin: 12 });
  const offer = pendingOfferFor(trip.id);
  trips.declineOffer(hung, offer.id, 'Bận việc riêng');

  const declined = db.prepare('SELECT status FROM trip_offers WHERE id = ?').get(offer.id);
  assert.equal(declined.status, 'declined');

  const row = tripRow(trip.id);
  assert.equal(row.status, 'no_driver', 'không còn tài xế nào khác nên chuyến thất bại');
});

test('chuyến đặt trước chưa tới giờ thì chưa gửi lời mời', () => {
  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const scheduledAt = new Date(Date.now() + 3 * 3600_000).toISOString();
  const { trip } = createTestTrip({ scheduleType: 'scheduled', scheduledAt });

  assert.equal(trip.status, 'scheduled');
  assert.equal(pendingOfferFor(trip.id), undefined);
});

test('chuyến đặt trước tới giờ sẽ tự động vào hàng đợi ghép tài xế', () => {
  setDriverState('0901111222', { online: 'online', lat: 10.7769, lng: 106.7009 });

  const scheduledAt = new Date(Date.now() + 3 * 3600_000).toISOString();
  const { trip } = createTestTrip({ scheduleType: 'scheduled', scheduledAt });

  db.prepare('UPDATE trips SET scheduled_at = ? WHERE id = ?').run(
    new Date(Date.now() + 5 * 60_000).toISOString(),
    trip.id,
  );

  const activated = matching.activateScheduledTrips();
  assert.ok(activated >= 1);
  assert.equal(tripRow(trip.id).status, 'searching');
  assert.ok(pendingOfferFor(trip.id));
});
