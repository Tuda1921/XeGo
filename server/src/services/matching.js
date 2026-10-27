import { db } from '../db.js';
import { config } from '../config.js';
import { addSeconds, haversineKm, nowIso, round } from '../utils.js';
import { emitToUser, emitToAdmins, emitToDrivers } from './realtime.js';
import { notify, notifyAdmins } from './notifications.js';

const ACTIVE_TRIP_STATUSES = ['assigned', 'arrived', 'in_progress'];

export function logTripEvent(tripId, type, message, { actorId = null, actorRole = null, meta = {} } = {}) {
  db.prepare(
    `INSERT INTO trip_events (trip_id, type, message, actor_id, actor_role, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(tripId, type, message, actorId, actorRole, JSON.stringify(meta), nowIso());
}

function driverHasConflict(driverId, trip) {
  const active = db
    .prepare(
      `SELECT id FROM trips WHERE driver_id = ? AND status IN ('assigned','arrived','in_progress') LIMIT 1`,
    )
    .get(driverId);
  if (active) return true;

  const pendingOffer = db
    .prepare(
      `SELECT o.id FROM trip_offers o
       JOIN trips t ON t.id = o.trip_id
       WHERE o.driver_id = ? AND o.status = 'pending' AND t.status = 'searching' LIMIT 1`,
    )
    .get(driverId);
  if (pendingOffer) return true;

  if (trip.scheduled_at) {
    const start = new Date(trip.scheduled_at).getTime();
    const windowMs = 90 * 60 * 1000;
    const conflict = db
      .prepare(
        `SELECT id FROM trips
         WHERE driver_id = ? AND status IN ('scheduled','assigned','arrived','in_progress')
           AND scheduled_at IS NOT NULL
           AND ABS(strftime('%s', scheduled_at) * 1000 - ?) < ?`,
      )
      .get(driverId, start, windowMs);
    if (conflict) return true;
  }

  return false;
}

/**
 * Tìm tài xế đủ điều kiện cho chuyến: đang online, đã xác minh, xe đúng loại,
 * trong bán kính, không bận và chưa từng từ chối chuyến này.
 */
export function findEligibleDrivers(trip, { limit = 10 } = {}) {
  const rows = db
    .prepare(
      `SELECT u.id AS driver_id, u.name, dp.rating, dp.rating_count, dp.current_lat, dp.current_lng,
              dp.location_updated_at, dp.trips_completed, v.id AS vehicle_id, v.plate, v.seats,
              v.brand, v.model, v.color, v.image_url, vt.name AS vehicle_type_name
       FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       JOIN vehicles v ON v.driver_id = u.id AND v.status = 'active' AND v.vehicle_type_id = ?
       JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
       WHERE u.role = 'driver' AND u.status = 'active'
         AND dp.verification_status = 'approved'
         AND dp.online_status = 'online'
         AND dp.current_lat IS NOT NULL AND dp.current_lng IS NOT NULL`,
    )
    .all(trip.vehicle_type_id);

  const declined = new Set(
    db
      .prepare(
        `SELECT driver_id FROM trip_offers WHERE trip_id = ? AND status IN ('declined','expired')`,
      )
      .all(trip.id)
      .map((r) => r.driver_id),
  );

  const pickup = { lat: trip.pickup_lat, lng: trip.pickup_lng };

  return rows
    .filter((row) => !declined.has(row.driver_id))
    .map((row) => {
      const distance = haversineKm(pickup, { lat: row.current_lat, lng: row.current_lng });
      return { ...row, distanceKm: round(distance ?? 999, 2) };
    })
    .filter((row) => row.distanceKm <= config.matching.radiusKm)
    .filter((row) => !driverHasConflict(row.driver_id, trip))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating)
    .slice(0, limit);
}

function offerPayload(trip, driver, offer) {
  return {
    offerId: offer.id,
    tripId: trip.id,
    code: trip.code,
    expiresAt: offer.expires_at,
    distanceToPickupKm: offer.distance_km,
    trip: {
      id: trip.id,
      code: trip.code,
      serviceType: trip.service_type,
      tripMode: trip.trip_mode,
      pickup: {
        label: trip.pickup_label,
        address: trip.pickup_address,
        lat: trip.pickup_lat,
        lng: trip.pickup_lng,
      },
      dropoff: {
        label: trip.dropoff_label,
        address: trip.dropoff_address,
        lat: trip.dropoff_lat,
        lng: trip.dropoff_lng,
      },
      stops: JSON.parse(trip.stops || '[]'),
      distanceKm: trip.distance_km,
      durationMin: trip.duration_min,
      passengers: trip.passengers,
      luggage: trip.luggage,
      notes: trip.notes,
      specialRequests: JSON.parse(trip.special_requests || '[]'),
      scheduledAt: trip.scheduled_at,
      estimatedPrice: trip.estimated_price,
      driverEarning: trip.driver_earning,
      paymentMethod: trip.payment_method,
    },
    driver: {
      id: driver.driver_id,
      name: driver.name,
      rating: driver.rating,
      vehicle: {
        id: driver.vehicle_id,
        plate: driver.plate,
        brand: driver.brand,
        model: driver.model,
        color: driver.color,
        seats: driver.seats,
        typeName: driver.vehicle_type_name,
      },
    },
  };
}

/**
 * Gửi lời mời chuyến cho nhóm tài xế phù hợp tiếp theo.
 * Trả về { dispatched, round, exhausted }.
 */
export function dispatchRound(tripId) {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  if (!trip || trip.status !== 'searching') return { dispatched: 0, exhausted: false };

  const round = trip.search_round + 1;
  if (round > config.matching.maxRounds) {
    markNoDriver(trip);
    return { dispatched: 0, exhausted: true };
  }

  const candidates = findEligibleDrivers(trip, { limit: config.matching.maxOffersPerRound });
  if (!candidates.length) {
    markNoDriver(trip);
    return { dispatched: 0, exhausted: true };
  }

  const expiresAt = addSeconds(new Date(), config.matching.offerTtlSeconds);
  const createdAt = nowIso();

  const insert = db.prepare(
    `INSERT INTO trip_offers (trip_id, driver_id, status, round, distance_km, expires_at, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
  );

  const offers = [];
  for (const driver of candidates) {
    const info = insert.run(trip.id, driver.driver_id, round, driver.distanceKm, expiresAt, createdAt);
    offers.push({ id: info.lastInsertRowid, driver, distanceKm: driver.distanceKm });
  }

  db.prepare('UPDATE trips SET search_round = ?, offer_expires_at = ?, updated_at = ? WHERE id = ?').run(
    round,
    expiresAt,
    createdAt,
    trip.id,
  );

  logTripEvent(trip.id, 'search_round', `Đang tìm tài xế (lượt ${round})`, {
    meta: { round, drivers: candidates.length },
  });

  for (const offer of offers) {
    const payload = offerPayload(trip, offer.driver, {
      id: offer.id,
      expires_at: expiresAt,
      distance_km: offer.distanceKm,
    });
    emitToUser(offer.driver.driver_id, 'trip:offer', payload);
    notify(offer.driver.driver_id, {
      type: 'trip_offer',
      title: 'Bạn có cuốc xe mới',
      body: `${trip.pickup_label} → ${trip.dropoff_label} · ${Math.round(trip.distance_km)} km`,
      data: { tripId: trip.id, offerId: offer.id, expiresAt },
    });
  }

  emitToAdmins('admin:trip_update', { tripId: trip.id, status: 'searching', round });
  return { dispatched: offers.length, round, exhausted: false };
}

export function markNoDriver(trip) {
  const updatedAt = nowIso();
  db.prepare(
    `UPDATE trips SET status = 'no_driver', offer_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'searching'`,
  ).run(updatedAt, trip.id);

  logTripEvent(trip.id, 'no_driver', 'Không tìm được tài xế phù hợp', { actorRole: 'system' });
  notify(trip.customer_id, {
    type: 'no_driver',
    title: 'Chưa tìm được tài xế',
    body: 'Bạn có thể thử lại, đổi loại xe hoặc đặt lịch sau ít phút.',
    data: { tripId: trip.id },
  });
  emitToUser(trip.customer_id, 'trip:update', { tripId: trip.id, status: 'no_driver' });
  emitToAdmins('admin:trip_update', { tripId: trip.id, status: 'no_driver' });
  notifyAdmins({
    type: 'no_driver',
    title: 'Chuyến không có tài xế',
    body: `Chuyến ${trip.code} chưa ghép được tài xế.`,
    data: { tripId: trip.id },
  });
}

/** Hết hạn lời mời chưa phản hồi và chuyển sang lượt kế tiếp. */
export function expireOffers() {
  const now = nowIso();
  const expired = db
    .prepare(`SELECT * FROM trip_offers WHERE status = 'pending' AND expires_at <= ?`)
    .all(now);

  if (!expired.length) return 0;

  const markExpired = db.prepare(
    `UPDATE trip_offers SET status = 'expired', responded_at = ? WHERE id = ?`,
  );
  for (const offer of expired) {
    markExpired.run(now, offer.id);
    emitToUser(offer.driver_id, 'trip:offer_expired', { offerId: offer.id, tripId: offer.trip_id });
  }

  const tripIds = [...new Set(expired.map((o) => o.trip_id))];
  for (const tripId of tripIds) {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    if (!trip || trip.status !== 'searching') continue;
    const stillPending = db
      .prepare(`SELECT COUNT(*) AS c FROM trip_offers WHERE trip_id = ? AND status = 'pending'`)
      .get(tripId).c;
    if (stillPending === 0) dispatchRound(tripId);
  }

  return expired.length;
}

/** Đưa các chuyến đặt trước đã tới giờ vào hàng đợi ghép tài xế. */
export function activateScheduledTrips() {
  const threshold = new Date(Date.now() + config.matching.scheduledLeadMinutes * 60_000).toISOString();
  const due = db
    .prepare(`SELECT * FROM trips WHERE status = 'scheduled' AND scheduled_at <= ?`)
    .all(threshold);

  for (const trip of due) {
    db.prepare(`UPDATE trips SET status = 'searching', updated_at = ? WHERE id = ?`).run(
      nowIso(),
      trip.id,
    );
    logTripEvent(trip.id, 'search_started', 'Bắt đầu tìm tài xế cho chuyến đặt trước', {
      actorRole: 'system',
    });
    notify(trip.customer_id, {
      type: 'searching',
      title: 'Đang tìm tài xế cho chuyến đặt trước',
      body: `Chuyến ${trip.code} sẽ khởi hành lúc ${new Date(trip.scheduled_at).toLocaleString('vi-VN')}.`,
      data: { tripId: trip.id },
    });
    dispatchRound(trip.id);
  }

  return due.length;
}

/** Nhắc khách về chuyến đặt trước sắp tới (trước 2 giờ). */
export function remindScheduledTrips() {
  const from = new Date(Date.now() + 110 * 60_000).toISOString();
  const to = new Date(Date.now() + 130 * 60_000).toISOString();
  const rows = db
    .prepare(`SELECT * FROM trips WHERE status = 'scheduled' AND scheduled_at BETWEEN ? AND ?`)
    .all(from, to);

  for (const trip of rows) {
    const already = db
      .prepare(
        `SELECT id FROM notifications WHERE user_id = ? AND type = 'trip_reminder' AND data LIKE ?`,
      )
      .get(trip.customer_id, `%"tripId":${trip.id}%`);
    if (already) continue;
    notify(trip.customer_id, {
      type: 'trip_reminder',
      title: 'Nhắc lịch chuyến đi',
      body: `Chuyến ${trip.code} khởi hành lúc ${new Date(trip.scheduled_at).toLocaleString('vi-VN')}.`,
      data: { tripId: trip.id },
    });
  }
  return rows.length;
}

let timer = null;

export function startScheduler() {
  if (timer) return timer;
  timer = setInterval(() => {
    try {
      expireOffers();
      activateScheduledTrips();
      remindScheduledTrips();
    } catch (error) {
      console.error('[scheduler]', error.message);
    }
  }, 3000);
  timer.unref?.();
  return timer;
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export { ACTIVE_TRIP_STATUSES };
