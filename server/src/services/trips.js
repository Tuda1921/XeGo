import { db } from '../db.js';
import { config } from '../config.js';
import {
  badRequest,
  conflict,
  forbidden,
  haversineKm,
  notFound,
  nowIso,
  parseJson,
  round,
  shareToken,
  tripCode,
} from '../utils.js';
import { emitToUser, emitToTrip, emitToAdmins, emitToDrivers } from './realtime.js';
import { notify, notifyAdmins } from './notifications.js';
import { logTripEvent, dispatchRound } from './matching.js';
import { SPECIAL_REQUESTS } from './pricing.js';

const TRIP_SELECT = `
  SELECT t.*,
         c.name AS customer_name, c.phone AS customer_phone, c.avatar_url AS customer_avatar,
         d.name AS driver_name, d.phone AS driver_phone, d.avatar_url AS driver_avatar,
         dp.rating AS driver_rating, dp.rating_count AS driver_rating_count,
         dp.trips_completed AS driver_trips,
         v.plate AS vehicle_plate, v.brand AS vehicle_brand, v.model AS vehicle_model,
         v.color AS vehicle_color, v.seats AS vehicle_seats, v.image_url AS vehicle_image,
         vt.name AS vehicle_type_name, vt.code AS vehicle_type_code, vt.seats AS vehicle_type_seats,
         o.name AS operator_name
  FROM trips t
  JOIN users c ON c.id = t.customer_id
  LEFT JOIN users d ON d.id = t.driver_id
  LEFT JOIN driver_profiles dp ON dp.user_id = t.driver_id
  LEFT JOIN vehicles v ON v.id = t.vehicle_id
  LEFT JOIN vehicle_types vt ON vt.id = t.vehicle_type_id
  LEFT JOIN operators o ON o.id = t.operator_id
`;

export function getTripRow(id) {
  return db.prepare(`${TRIP_SELECT} WHERE t.id = ?`).get(id);
}

export function getTripByCode(code) {
  return db.prepare(`${TRIP_SELECT} WHERE t.code = ?`).get(code);
}

export function serializeTrip(row, { includePrivate = true } = {}) {
  if (!row) return null;
  const specialRequests = parseJson(row.special_requests, []);
  const trip = {
    id: row.id,
    code: row.code,
    status: row.status,
    serviceType: row.service_type,
    tripMode: row.trip_mode,
    scheduleType: row.schedule_type,
    scheduledAt: row.scheduled_at,
    returnAt: row.return_at,
    pickup: {
      label: row.pickup_label,
      address: row.pickup_address,
      lat: row.pickup_lat,
      lng: row.pickup_lng,
    },
    dropoff: {
      label: row.dropoff_label,
      address: row.dropoff_address,
      lat: row.dropoff_lat,
      lng: row.dropoff_lng,
    },
    stops: parseJson(row.stops, []),
    distanceKm: row.distance_km,
    durationMin: row.duration_min,
    passengers: row.passengers,
    luggage: row.luggage,
    notes: row.notes,
    specialRequests: specialRequests.map((code) => {
      const found = SPECIAL_REQUESTS.find((r) => r.code === code);
      return { code, label: found?.label || code };
    }),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    priceBreakdown: parseJson(row.price_breakdown, {}),
    estimatedPrice: row.estimated_price,
    finalPrice: row.final_price,
    discountCode: row.discount_code,
    discountAmount: row.discount_amount,
    commissionAmount: row.commission_amount,
    driverEarning: row.driver_earning,
    cancelReason: row.cancel_reason,
    cancelledBy: row.cancelled_by,
    searchRound: row.search_round,
    offerExpiresAt: row.offer_expires_at,
    rating: row.rating,
    review: row.review,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.accepted_at,
    arrivedAt: row.arrived_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    vehicleType: {
      id: row.vehicle_type_id,
      name: row.vehicle_type_name,
      code: row.vehicle_type_code,
      seats: row.vehicle_type_seats,
    },
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      avatarUrl: row.customer_avatar,
    },
    driver: row.driver_id
      ? {
          id: row.driver_id,
          name: row.driver_name,
          avatarUrl: row.driver_avatar,
          rating: row.driver_rating,
          ratingCount: row.driver_rating_count,
          tripsCompleted: row.driver_trips,
          vehicle: {
            plate: row.vehicle_plate,
            brand: row.vehicle_brand,
            model: row.vehicle_model,
            color: row.vehicle_color,
            seats: row.vehicle_seats,
            imageUrl: row.vehicle_image,
          },
        }
      : null,
    operatorName: row.operator_name,
  };

  if (includePrivate) {
    trip.customerPhone = row.customer_phone;
    trip.driverPhone = row.driver_phone;
    trip.shareToken = row.share_token;
  }

  return trip;
}

export function tripEvents(tripId) {
  return db
    .prepare('SELECT * FROM trip_events WHERE trip_id = ? ORDER BY id')
    .all(tripId)
    .map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      actorRole: row.actor_role,
      meta: parseJson(row.meta, {}),
      createdAt: row.created_at,
    }));
}

export function assertTripAccess(trip, user) {
  if (!user) throw forbidden('Bạn cần đăng nhập');
  if (user.role === 'admin' || user.role === 'operator') return;
  if (trip.customer_id === user.id) return;
  if (trip.driver_id === user.id) return;
  throw forbidden('Bạn không có quyền truy cập chuyến này');
}

export function broadcastTrip(tripId, extra = {}) {
  const row = getTripRow(tripId);
  if (!row) return null;
  const trip = serializeTrip(row);
  emitToTrip(tripId, 'trip:update', { trip, ...extra });
  emitToUser(row.customer_id, 'trip:update', { trip, ...extra });
  if (row.driver_id) emitToUser(row.driver_id, 'trip:update', { trip, ...extra });
  emitToAdmins('admin:trip_update', { tripId, status: row.status, trip });
  return trip;
}

export function createTrip(customer, payload) {
  const {
    vehicleTypeId,
    pickup,
    dropoff,
    stops = [],
    distanceKm = 0,
    durationMin = 0,
    passengers = 1,
    luggage = 0,
    notes = '',
    specialRequests = [],
    paymentMethod = 'cash',
    serviceType = 'ride',
    tripMode = 'one_way',
    scheduleType = 'now',
    scheduledAt = null,
    returnAt = null,
    quote,
  } = payload;

  if (!pickup?.lat || !dropoff?.lat) throw badRequest('Thiếu điểm đón hoặc điểm trả');
  if (!vehicleTypeId) throw badRequest('Chưa chọn loại xe');
  if (!quote || !quote.total) throw badRequest('Thiếu báo giá hợp lệ');

  const vehicleType = db.prepare('SELECT * FROM vehicle_types WHERE id = ?').get(vehicleTypeId);
  if (!vehicleType) throw badRequest('Loại xe không tồn tại');
  if (passengers > vehicleType.seats) {
    throw badRequest(`Loại xe ${vehicleType.name} chỉ chở tối đa ${vehicleType.seats} khách`);
  }

  const isScheduled = scheduleType === 'scheduled';
  if (isScheduled) {
    if (!scheduledAt) throw badRequest('Chưa chọn thời gian đón');
    const when = new Date(scheduledAt).getTime();
    if (Number.isNaN(when)) throw badRequest('Thời gian đón không hợp lệ');
    if (when < Date.now() + 15 * 60_000) {
      throw badRequest('Chuyến đặt trước cần cách hiện tại ít nhất 15 phút');
    }
  }

  const duplicate = db
    .prepare(
      `SELECT id FROM trips WHERE customer_id = ? AND status IN ('searching','assigned','arrived','in_progress')
       AND pickup_lat = ? AND dropoff_lat = ? AND created_at > ?`,
    )
    .get(
      customer.id,
      pickup.lat,
      dropoff.lat,
      new Date(Date.now() - 2 * 60_000).toISOString(),
    );
  if (duplicate) {
    throw conflict('Bạn vừa đặt chuyến tương tự, vui lòng chờ xử lý', { tripId: duplicate.id });
  }

  const createdAt = nowIso();
  const status = isScheduled ? 'scheduled' : 'searching';
  const code = tripCode();

  const info = db
    .prepare(
      `INSERT INTO trips (
        code, customer_id, vehicle_type_id, status, service_type, trip_mode, schedule_type,
        scheduled_at, return_at, pickup_label, pickup_address, pickup_lat, pickup_lng,
        dropoff_label, dropoff_address, dropoff_lat, dropoff_lng, stops, distance_km, duration_min,
        passengers, luggage, notes, special_requests, payment_method, price_breakdown,
        estimated_price, discount_code, discount_amount, commission_amount, driver_earning,
        share_token, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      code,
      customer.id,
      vehicleTypeId,
      status,
      serviceType,
      tripMode,
      scheduleType,
      isScheduled ? scheduledAt : null,
      returnAt,
      pickup.label || pickup.address,
      pickup.address || pickup.label,
      pickup.lat,
      pickup.lng,
      dropoff.label || dropoff.address,
      dropoff.address || dropoff.label,
      dropoff.lat,
      dropoff.lng,
      JSON.stringify(stops),
      round(distanceKm, 2),
      round(durationMin, 0),
      passengers,
      luggage,
      notes,
      JSON.stringify(specialRequests),
      paymentMethod,
      JSON.stringify(quote),
      quote.total,
      quote.discountCode || null,
      quote.discount || 0,
      quote.commission || 0,
      quote.driverEarning || 0,
      shareToken(),
      createdAt,
      createdAt,
    );

  const tripId = Number(info.lastInsertRowid);

  if (quote.discountCode) {
    db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE UPPER(code) = UPPER(?)').run(
      quote.discountCode,
    );
  }

  logTripEvent(tripId, 'created', 'Khách đã tạo chuyến', {
    actorId: customer.id,
    actorRole: 'customer',
    meta: { estimatedPrice: quote.total },
  });

  notify(customer.id, {
    type: 'trip_created',
    title: isScheduled ? 'Đã lên lịch chuyến đi' : 'Đã tạo chuyến, đang tìm tài xế',
    body: `${pickup.label} → ${dropoff.label}`,
    data: { tripId },
  });

  notifyAdmins({
    type: 'trip_created',
    title: 'Chuyến mới',
    body: `${code}: ${pickup.label} → ${dropoff.label}`,
    data: { tripId },
  });

  if (!isScheduled) {
    dispatchRound(tripId);
  } else {
    logTripEvent(tripId, 'scheduled', `Đặt trước lúc ${new Date(scheduledAt).toLocaleString('vi-VN')}`, {
      actorRole: 'system',
    });
  }

  const trip = broadcastTrip(tripId);
  return trip;
}

export function acceptOffer(driver, offerId) {
  const offer = db.prepare('SELECT * FROM trip_offers WHERE id = ?').get(offerId);
  if (!offer) throw notFound('Lời mời không tồn tại');
  if (offer.driver_id !== driver.id) throw forbidden('Lời mời không thuộc về bạn');
  if (offer.status !== 'pending') throw conflict('Lời mời đã được xử lý hoặc hết hạn');
  if (new Date(offer.expires_at).getTime() < Date.now()) {
    db.prepare(`UPDATE trip_offers SET status = 'expired', responded_at = ? WHERE id = ?`).run(
      nowIso(),
      offer.id,
    );
    throw conflict('Lời mời đã hết hạn');
  }

  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(offer.trip_id);
  if (!trip) throw notFound('Chuyến không tồn tại');
  if (trip.status !== 'searching') throw conflict('Chuyến đã được tài xế khác nhận');

  const vehicle = db
    .prepare(
      `SELECT * FROM vehicles WHERE driver_id = ? AND vehicle_type_id = ? AND status = 'active' ORDER BY id LIMIT 1`,
    )
    .get(driver.id, trip.vehicle_type_id);
  if (!vehicle) throw badRequest('Bạn chưa có phương tiện phù hợp với loại xe của chuyến');

  const now = nowIso();

  const result = db.transaction(() => {
    const updated = db
      .prepare(
        `UPDATE trips SET status = 'assigned', driver_id = ?, vehicle_id = ?, operator_id = ?,
           accepted_at = ?, offer_expires_at = NULL, updated_at = ?
         WHERE id = ? AND status = 'searching'`,
      )
      .run(driver.id, vehicle.id, vehicle.operator_id, now, now, trip.id);

    if (updated.changes === 0) return false;

    db.prepare(
      `UPDATE trip_offers SET status = 'accepted', responded_at = ? WHERE id = ?`,
    ).run(now, offer.id);
    db.prepare(
      `UPDATE trip_offers SET status = 'superseded', responded_at = ? WHERE trip_id = ? AND id != ? AND status = 'pending'`,
    ).run(now, trip.id, offer.id);
    db.prepare(
      `UPDATE driver_profiles SET online_status = 'on_trip', updated_at = ? WHERE user_id = ?`,
    ).run(now, driver.id);
    return true;
  })();

  if (!result) throw conflict('Chuyến đã được tài xế khác nhận');

  logTripEvent(trip.id, 'accepted', `Tài xế ${driver.name} đã nhận chuyến`, {
    actorId: driver.id,
    actorRole: 'driver',
  });

  notify(trip.customer_id, {
    type: 'driver_assigned',
    title: 'Đã tìm được tài xế',
    body: `${driver.name} đang đến điểm đón bạn.`,
    data: { tripId: trip.id },
  });

  const superseded = db
    .prepare(`SELECT driver_id FROM trip_offers WHERE trip_id = ? AND status = 'superseded'`)
    .all(trip.id);
  for (const row of superseded) {
    emitToUser(row.driver_id, 'trip:offer_closed', { tripId: trip.id, reason: 'taken' });
  }

  emitToDrivers('driver:availability', { driverId: driver.id, onlineStatus: 'on_trip' });
  return broadcastTrip(trip.id);
}

export function declineOffer(driver, offerId, reason = '') {
  const offer = db.prepare('SELECT * FROM trip_offers WHERE id = ?').get(offerId);
  if (!offer) throw notFound('Lời mời không tồn tại');
  if (offer.driver_id !== driver.id) throw forbidden('Lời mời không thuộc về bạn');
  if (offer.status !== 'pending') throw conflict('Lời mời đã được xử lý');

  db.prepare(`UPDATE trip_offers SET status = 'declined', responded_at = ? WHERE id = ?`).run(
    nowIso(),
    offer.id,
  );

  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(offer.trip_id);
  if (trip && trip.status === 'searching') {
    const pending = db
      .prepare(`SELECT COUNT(*) AS c FROM trip_offers WHERE trip_id = ? AND status = 'pending'`)
      .get(trip.id).c;
    if (pending === 0) dispatchRound(trip.id);
  }

  return { ok: true, reason };
}

function requireDriverTrip(tripId, driver) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw notFound('Chuyến không tồn tại');
  if (trip.driver_id !== driver.id) throw forbidden('Bạn không phải tài xế của chuyến này');
  return trip;
}

export function markArrived(driver, tripId) {
  const trip = requireDriverTrip(tripId, driver);
  if (trip.status !== 'assigned') throw conflict('Chuyến không ở trạng thái có thể xác nhận đến');
  const now = nowIso();
  db.prepare(`UPDATE trips SET status = 'arrived', arrived_at = ?, updated_at = ? WHERE id = ?`).run(
    now,
    now,
    trip.id,
  );
  logTripEvent(trip.id, 'arrived', 'Tài xế đã tới điểm đón', {
    actorId: driver.id,
    actorRole: 'driver',
  });
  notify(trip.customer_id, {
    type: 'driver_arrived',
    title: 'Tài xế đã đến',
    body: 'Tài xế đang chờ bạn tại điểm đón.',
    data: { tripId: trip.id },
  });
  return broadcastTrip(trip.id);
}

export function startTrip(driver, tripId) {
  const trip = requireDriverTrip(tripId, driver);
  if (!['assigned', 'arrived'].includes(trip.status)) {
    throw conflict('Chuyến không ở trạng thái có thể bắt đầu');
  }
  const now = nowIso();
  db.prepare(`UPDATE trips SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?`).run(
    now,
    now,
    trip.id,
  );
  logTripEvent(trip.id, 'started', 'Chuyến đã bắt đầu', {
    actorId: driver.id,
    actorRole: 'driver',
  });
  notify(trip.customer_id, {
    type: 'trip_started',
    title: 'Chuyến đi bắt đầu',
    body: 'Chúc bạn có chuyến đi an toàn.',
    data: { tripId: trip.id },
  });
  return broadcastTrip(trip.id);
}

export function completeTrip(driver, tripId, { finalPrice = null } = {}) {
  const trip = requireDriverTrip(tripId, driver);
  if (trip.status !== 'in_progress') throw conflict('Chuyến chưa bắt đầu hoặc đã kết thúc');

  const now = nowIso();
  const price = Number.isFinite(Number(finalPrice)) && Number(finalPrice) > 0
    ? Math.round(Number(finalPrice))
    : trip.estimated_price;
  const commission = Math.round(price * config.commissionRate);
  const earning = price - commission;

  db.transaction(() => {
    db.prepare(
      `UPDATE trips SET status = 'completed', completed_at = ?, updated_at = ?,
         final_price = ?, commission_amount = ?, driver_earning = ?,
         payment_status = CASE WHEN payment_method = 'cash' THEN 'paid' ELSE payment_status END
       WHERE id = ?`,
    ).run(now, now, price, commission, earning, trip.id);

    db.prepare(
      `UPDATE driver_profiles SET online_status = 'online', trips_completed = trips_completed + 1, updated_at = ?
       WHERE user_id = ?`,
    ).run(now, driver.id);

    db.prepare(
      `INSERT INTO payments (trip_id, method, amount, status, provider, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      trip.id,
      trip.payment_method,
      price,
      trip.payment_method === 'cash' ? 'paid' : 'pending',
      trip.payment_method === 'online' ? config.payment.provider : null,
      trip.payment_method === 'cash' ? now : null,
      now,
    );
  })();

  logTripEvent(trip.id, 'completed', 'Chuyến đã hoàn thành', {
    actorId: driver.id,
    actorRole: 'driver',
    meta: { finalPrice: price },
  });

  notify(trip.customer_id, {
    type: 'trip_completed',
    title: 'Chuyến đi hoàn thành',
    body: `Tổng thanh toán ${price.toLocaleString('vi-VN')} ₫. Hãy đánh giá tài xế nhé!`,
    data: { tripId: trip.id },
  });
  notify(driver.id, {
    type: 'earning',
    title: 'Bạn đã hoàn thành chuyến',
    body: `Thu nhập ${earning.toLocaleString('vi-VN')} ₫ (sau hoa hồng ${Math.round(
      config.commissionRate * 100,
    )}%).`,
    data: { tripId: trip.id },
  });
  notifyAdmins({
    type: 'trip_completed',
    title: 'Chuyến hoàn thành',
    body: `${trip.code} · ${price.toLocaleString('vi-VN')} ₫`,
    data: { tripId: trip.id },
  });

  emitToDrivers('driver:availability', { driverId: driver.id, onlineStatus: 'online' });
  return broadcastTrip(trip.id);
}

export function cancelTrip(user, tripId, reason) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw notFound('Chuyến không tồn tại');

  const isCustomer = trip.customer_id === user.id;
  const isDriver = trip.driver_id === user.id;
  const isAdmin = user.role === 'admin' || user.role === 'operator';
  if (!isCustomer && !isDriver && !isAdmin) throw forbidden('Bạn không có quyền hủy chuyến này');

  if (['completed', 'cancelled'].includes(trip.status)) {
    throw conflict('Chuyến đã kết thúc, không thể hủy');
  }
  if (isCustomer && trip.status === 'in_progress') {
    throw conflict('Không thể hủy khi chuyến đang di chuyển. Vui lòng liên hệ hỗ trợ.');
  }

  const now = nowIso();
  const cancelledBy = isAdmin ? 'admin' : isCustomer ? 'customer' : 'driver';

  db.transaction(() => {
    db.prepare(
      `UPDATE trips SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, cancelled_by = ?,
         updated_at = ?, offer_expires_at = NULL
       WHERE id = ?`,
    ).run(now, reason || 'Không có lý do', cancelledBy, now, trip.id);

    db.prepare(
      `UPDATE trip_offers SET status = 'superseded', responded_at = ? WHERE trip_id = ? AND status = 'pending'`,
    ).run(now, trip.id);

    if (trip.driver_id) {
      db.prepare(
        `UPDATE driver_profiles SET online_status = 'online', trips_cancelled = trips_cancelled + 1, updated_at = ?
         WHERE user_id = ?`,
      ).run(now, trip.driver_id);
    }
  })();

  logTripEvent(trip.id, 'cancelled', `Chuyến bị hủy bởi ${cancelledBy}: ${reason || 'không có lý do'}`, {
    actorId: user.id,
    actorRole: user.role,
  });

  const notifyTargets = new Set([trip.customer_id]);
  if (trip.driver_id) notifyTargets.add(trip.driver_id);
  for (const target of notifyTargets) {
    if (target === user.id) continue;
    notify(target, {
      type: 'trip_cancelled',
      title: 'Chuyến đã bị hủy',
      body: `Chuyến ${trip.code} đã bị hủy. Lý do: ${reason || 'không có'}`,
      data: { tripId: trip.id },
    });
  }

  notifyAdmins({
    type: 'trip_cancelled',
    title: 'Chuyến bị hủy',
    body: `${trip.code} · ${cancelledBy} · ${reason || 'không có lý do'}`,
    data: { tripId: trip.id },
  });

  if (trip.driver_id) {
    emitToDrivers('driver:availability', { driverId: trip.driver_id, onlineStatus: 'online' });
  }

  return broadcastTrip(trip.id);
}

export function rateTrip(user, tripId, { stars, comment = '', tags = [] }) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw notFound('Chuyến không tồn tại');
  if (trip.customer_id !== user.id) throw forbidden('Chỉ khách hàng của chuyến mới được đánh giá');
  if (trip.status !== 'completed') throw conflict('Chỉ đánh giá được chuyến đã hoàn thành');
  if (!trip.driver_id) throw badRequest('Chuyến không có tài xế');

  const value = Number(stars);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw badRequest('Số sao phải từ 1 đến 5');
  }

  const existing = db
    .prepare('SELECT id FROM ratings WHERE trip_id = ? AND from_user_id = ?')
    .get(trip.id, user.id);
  if (existing) throw conflict('Bạn đã đánh giá chuyến này');

  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO ratings (trip_id, from_user_id, to_user_id, role, stars, comment, tags, created_at)
       VALUES (?, ?, ?, 'customer', ?, ?, ?, ?)`,
    ).run(trip.id, user.id, trip.driver_id, value, comment, JSON.stringify(tags), now);

    db.prepare('UPDATE trips SET rating = ?, review = ?, updated_at = ? WHERE id = ?').run(
      value,
      comment,
      now,
      trip.id,
    );

    const profile = db
      .prepare('SELECT rating, rating_count FROM driver_profiles WHERE user_id = ?')
      .get(trip.driver_id);
    const count = (profile?.rating_count || 0) + 1;
    const avg = ((profile?.rating || 5) * (profile?.rating_count || 0) + value) / count;
    db.prepare(
      'UPDATE driver_profiles SET rating = ?, rating_count = ?, updated_at = ? WHERE user_id = ?',
    ).run(round(avg, 2), count, now, trip.driver_id);
  })();

  logTripEvent(trip.id, 'rated', `Khách đánh giá ${value} sao`, {
    actorId: user.id,
    actorRole: 'customer',
  });

  notify(trip.driver_id, {
    type: 'rating',
    title: `Bạn nhận được đánh giá ${value} sao`,
    body: comment || 'Cảm ơn bạn đã phục vụ khách hàng.',
    data: { tripId: trip.id },
  });

  return broadcastTrip(trip.id);
}

export function assignDriverManually(admin, tripId, driverId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw notFound('Chuyến không tồn tại');
  if (!['searching', 'no_driver', 'scheduled'].includes(trip.status)) {
    throw conflict('Chỉ có thể chỉ định tài xế cho chuyến đang tìm hoặc chưa có tài xế');
  }

  const driver = db
    .prepare(
      `SELECT u.*, dp.verification_status, dp.online_status FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ? AND u.role = 'driver'`,
    )
    .get(driverId);
  if (!driver) throw notFound('Tài xế không tồn tại');
  if (driver.verification_status !== 'approved') throw badRequest('Tài xế chưa được xác minh');

  const vehicle = db
    .prepare(
      `SELECT * FROM vehicles WHERE driver_id = ? AND vehicle_type_id = ? AND status = 'active' LIMIT 1`,
    )
    .get(driverId, trip.vehicle_type_id);
  if (!vehicle) throw badRequest('Tài xế không có xe phù hợp loại xe của chuyến');

  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `UPDATE trips SET status = 'assigned', driver_id = ?, vehicle_id = ?, operator_id = ?,
         accepted_at = ?, offer_expires_at = NULL, updated_at = ? WHERE id = ?`,
    ).run(driverId, vehicle.id, vehicle.operator_id, now, now, trip.id);
    db.prepare(
      `UPDATE trip_offers SET status = 'superseded', responded_at = ? WHERE trip_id = ? AND status = 'pending'`,
    ).run(now, trip.id);
    db.prepare(
      `UPDATE driver_profiles SET online_status = 'on_trip', updated_at = ? WHERE user_id = ?`,
    ).run(now, driverId);
  })();

  logTripEvent(trip.id, 'assigned_manual', `Quản trị viên chỉ định tài xế ${driver.name}`, {
    actorId: admin.id,
    actorRole: admin.role,
  });

  notify(trip.customer_id, {
    type: 'driver_assigned',
    title: 'Đã phân công tài xế',
    body: `${driver.name} sẽ phụ trách chuyến của bạn.`,
    data: { tripId: trip.id },
  });
  notify(driverId, {
    type: 'trip_assigned',
    title: 'Bạn được phân công chuyến',
    body: `${trip.pickup_label} → ${trip.dropoff_label}`,
    data: { tripId: trip.id },
  });

  return broadcastTrip(trip.id);
}

export function retrySearch(customer, tripId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip) throw notFound('Chuyến không tồn tại');
  if (trip.customer_id !== customer.id) throw forbidden('Không phải chuyến của bạn');
  if (!['no_driver', 'searching'].includes(trip.status)) {
    throw conflict('Chuyến không ở trạng thái có thể tìm lại tài xế');
  }

  db.prepare(
    `UPDATE trips SET status = 'searching', search_round = 0, updated_at = ? WHERE id = ?`,
  ).run(nowIso(), trip.id);
  db.prepare(`UPDATE trip_offers SET status = 'superseded', responded_at = ? WHERE trip_id = ? AND status = 'pending'`).run(
    nowIso(),
    trip.id,
  );

  logTripEvent(trip.id, 'search_retry', 'Khách yêu cầu tìm lại tài xế', {
    actorId: customer.id,
    actorRole: 'customer',
  });

  dispatchRound(trip.id);
  return broadcastTrip(trip.id);
}

export function estimateArrival(trip) {
  if (!trip.driver_id) return null;
  const profile = db
    .prepare('SELECT current_lat, current_lng, location_updated_at FROM driver_profiles WHERE user_id = ?')
    .get(trip.driver_id);
  if (!profile?.current_lat) return null;
  const distance = haversineKm(
    { lat: profile.current_lat, lng: profile.current_lng },
    { lat: trip.pickup_lat, lng: trip.pickup_lng },
  );
  if (distance === null) return null;
  return {
    distanceKm: round(distance, 2),
    etaMinutes: Math.max(1, Math.round((distance / 24) * 60)),
    updatedAt: profile.location_updated_at,
  };
}
