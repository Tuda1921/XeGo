import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import {
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  notFound,
  nowIso,
  parseJson,
  round,
} from '../utils.js';
import { requireAuth, requireDriver } from '../middleware/auth.js';
import { rateLimit } from '../middleware/common.js';
import {
  acceptOffer,
  assertTripAccess,
  broadcastTrip,
  cancelTrip,
  completeTrip,
  createTrip,
  declineOffer,
  estimateArrival,
  getTripRow,
  markArrived,
  rateTrip,
  retrySearch,
  serializeTrip,
  startTrip,
  tripEvents,
} from '../services/trips.js';
import { emitToTrip, emitToUser } from '../services/realtime.js';
import { notify } from '../services/notifications.js';
import { routeThrough } from '../services/geo.js';

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

function listTripsFor(user, { status, limit = 20, offset = 0 }) {
  const params = [];
  let where = '';

  if (user.role === 'customer') {
    where = 'WHERE t.customer_id = ?';
    params.push(user.id);
  } else if (user.role === 'driver') {
    where = 'WHERE t.driver_id = ?';
    params.push(user.id);
  } else {
    where = 'WHERE 1 = 1';
  }

  if (status) {
    const statuses = String(status).split(',').filter(Boolean);
    if (statuses.length) {
      where += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
  }

  const rows = db
    .prepare(
      `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone, c.avatar_url AS customer_avatar,
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
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  return rows.map((row) => serializeTrip(row));
}

tripsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const trips = listTripsFor(req.user, { status: req.query.status, limit, offset });
    res.json({ trips });
  }),
);

tripsRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    const trips = listTripsFor(req.user, {
      status: 'scheduled,searching,assigned,arrived,in_progress,no_driver',
      limit: 10,
    });
    res.json({ trips });
  }),
);

tripsRouter.post(
  '/',
  rateLimit({ windowMs: 60_000, max: 12 }),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'customer') throw forbidden('Chỉ khách hàng mới có thể đặt chuyến');
    const trip = createTrip(req.user, req.body || {});
    res.status(201).json({ trip });
  }),
);

tripsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = getTripRow(Number(req.params.id));
    if (!row) throw notFound('Chuyến không tồn tại');
    assertTripAccess(row, req.user);

    const trip = serializeTrip(row);
    const events = tripEvents(row.id);
    const messages = db
      .prepare('SELECT * FROM trip_messages WHERE trip_id = ? ORDER BY id')
      .all(row.id)
      .map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        senderRole: m.sender_role,
        body: m.body,
        createdAt: m.created_at,
      }));

    const offers =
      req.user.role === 'admin' || req.user.role === 'operator'
        ? db
            .prepare(
              `SELECT o.*, u.name AS driver_name FROM trip_offers o
               JOIN users u ON u.id = o.driver_id WHERE o.trip_id = ? ORDER BY o.id DESC`,
            )
            .all(row.id)
            .map((o) => ({
              id: o.id,
              driverId: o.driver_id,
              driverName: o.driver_name,
              status: o.status,
              round: o.round,
              distanceKm: o.distance_km,
              expiresAt: o.expires_at,
              createdAt: o.created_at,
            }))
        : undefined;

    res.json({
      trip,
      events,
      messages,
      offers,
      eta: estimateArrival(row),
      route: await routeThrough([
        { lat: row.pickup_lat, lng: row.pickup_lng },
        ...parseJson(row.stops, []).map((s) => ({ lat: s.lat, lng: s.lng })),
        { lat: row.dropoff_lat, lng: row.dropoff_lng },
      ]),
    });
  }),
);

tripsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const trip = cancelTrip(req.user, Number(req.params.id), reason);
    res.json({ trip });
  }),
);

tripsRouter.post(
  '/:id/retry',
  asyncHandler(async (req, res) => {
    const trip = retrySearch(req.user, Number(req.params.id));
    res.json({ trip });
  }),
);

tripsRouter.post(
  '/:id/rate',
  asyncHandler(async (req, res) => {
    const { stars, comment, tags } = req.body || {};
    const trip = rateTrip(req.user, Number(req.params.id), { stars, comment, tags });
    res.json({ trip });
  }),
);

tripsRouter.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const row = getTripRow(Number(req.params.id));
    if (!row) throw notFound('Chuyến không tồn tại');
    assertTripAccess(row, req.user);
    const body = String(req.body?.body || '').trim();
    if (!body) throw badRequest('Nội dung tin nhắn trống');
    if (body.length > 1000) throw badRequest('Tin nhắn quá dài');

    const createdAt = nowIso();
    const info = db
      .prepare(
        `INSERT INTO trip_messages (trip_id, sender_id, sender_role, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(row.id, req.user.id, req.user.role, body, createdAt);

    const message = {
      id: Number(info.lastInsertRowid),
      senderId: req.user.id,
      senderRole: req.user.role,
      body,
      createdAt,
    };

    emitToTrip(row.id, 'trip:message', { tripId: row.id, message });
    const other = row.customer_id === req.user.id ? row.driver_id : row.customer_id;
    if (other) {
      emitToUser(other, 'trip:message', { tripId: row.id, message });
      notify(other, {
        type: 'trip_message',
        title: 'Tin nhắn mới',
        body: body.slice(0, 120),
        data: { tripId: row.id },
      });
    }

    res.status(201).json({ message });
  }),
);

tripsRouter.post(
  '/:id/pay',
  asyncHandler(async (req, res) => {
    const row = getTripRow(Number(req.params.id));
    if (!row) throw notFound('Chuyến không tồn tại');
    assertTripAccess(row, req.user);
    if (row.status !== 'completed') throw conflict('Chỉ thanh toán chuyến đã hoàn thành');
    if (row.payment_status === 'paid') throw conflict('Chuyến đã được thanh toán');

    const amount = row.final_price || row.estimated_price;
    const now = nowIso();
    const isDemo = config.payment.provider === 'demo';

    db.transaction(() => {
      db.prepare(
        `UPDATE trips SET payment_status = 'paid', updated_at = ? WHERE id = ?`,
      ).run(now, row.id);
      db.prepare(
        `INSERT INTO payments (trip_id, method, amount, status, provider, provider_ref, paid_at, meta, created_at)
         VALUES (?, ?, ?, 'paid', ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.payment_method,
        amount,
        isDemo ? 'demo' : config.payment.provider,
        isDemo ? `DEMO-${Date.now()}` : null,
        now,
        JSON.stringify({ simulated: isDemo }),
        now,
      );
    })();

    notify(row.customer_id, {
      type: 'payment',
      title: 'Thanh toán thành công',
      body: `${amount.toLocaleString('vi-VN')} ₫ cho chuyến ${row.code}${
        isDemo ? ' (mô phỏng)' : ''
      }.`,
      data: { tripId: row.id },
    });

    res.json({ trip: broadcastTrip(row.id), simulated: isDemo });
  }),
);

tripsRouter.get(
  '/:id/receipt',
  asyncHandler(async (req, res) => {
    const row = getTripRow(Number(req.params.id));
    if (!row) throw notFound('Chuyến không tồn tại');
    assertTripAccess(row, req.user);
    if (row.status !== 'completed') throw conflict('Chuyến chưa hoàn thành');

    const payment = db
      .prepare('SELECT * FROM payments WHERE trip_id = ? ORDER BY id DESC LIMIT 1')
      .get(row.id);

    res.json({
      receipt: {
        code: row.code,
        issuedAt: row.completed_at,
        customer: { name: row.customer_name, phone: row.customer_phone },
        driver: row.driver_name ? { name: row.driver_name, plate: row.vehicle_plate } : null,
        route: {
          pickup: row.pickup_address,
          dropoff: row.dropoff_address,
          distanceKm: row.distance_km,
          durationMin: row.duration_min,
        },
        breakdown: parseJson(row.price_breakdown, {}),
        amount: row.final_price || row.estimated_price,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        payment: payment
          ? {
              status: payment.status,
              provider: payment.provider,
              providerRef: payment.provider_ref,
              paidAt: payment.paid_at,
              simulated: parseJson(payment.meta, {}).simulated || false,
            }
          : null,
      },
    });
  }),
);

/* ------------------------------- Tài xế ------------------------------- */

export const driverRouter = Router();
driverRouter.use(requireAuth, requireDriver);

driverRouter.get(
  '/offers',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT o.id AS offer_id, o.trip_id, o.expires_at, o.distance_km AS distance_to_pickup,
                t.code, t.pickup_label, t.pickup_address, t.pickup_lat, t.pickup_lng,
                t.dropoff_label, t.dropoff_address, t.dropoff_lat, t.dropoff_lng,
                t.distance_km AS trip_distance, t.duration_min, t.passengers, t.luggage,
                t.estimated_price, t.driver_earning, t.scheduled_at, t.service_type, t.trip_mode,
                t.notes, t.special_requests, t.payment_method
         FROM trip_offers o JOIN trips t ON t.id = o.trip_id
         WHERE o.driver_id = ? AND o.status = 'pending' AND o.expires_at > ?
         ORDER BY o.id DESC`,
      )
      .all(req.user.id, nowIso());

    res.json({
      offers: rows.map((row) => ({
        offerId: row.offer_id,
        tripId: row.trip_id,
        code: row.code,
        expiresAt: row.expires_at,
        distanceToPickupKm: row.distance_to_pickup,
        trip: {
          id: row.trip_id,
          code: row.code,
          serviceType: row.service_type,
          tripMode: row.trip_mode,
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
          distanceKm: row.trip_distance,
          durationMin: row.duration_min,
          passengers: row.passengers,
          luggage: row.luggage,
          notes: row.notes,
          specialRequests: parseJson(row.special_requests, []),
          scheduledAt: row.scheduled_at,
          estimatedPrice: row.estimated_price,
          driverEarning: row.driver_earning,
          paymentMethod: row.payment_method,
        },
      })),
    });
  }),
);

driverRouter.post(
  '/offers/:id/accept',
  asyncHandler(async (req, res) => {
    const trip = acceptOffer(req.user, Number(req.params.id));
    res.json({ trip });
  }),
);

driverRouter.post(
  '/offers/:id/decline',
  asyncHandler(async (req, res) => {
    const result = declineOffer(req.user, Number(req.params.id), req.body?.reason);
    res.json(result);
  }),
);

driverRouter.post(
  '/trips/:id/arrived',
  asyncHandler(async (req, res) => {
    res.json({ trip: markArrived(req.user, Number(req.params.id)) });
  }),
);

driverRouter.post(
  '/trips/:id/start',
  asyncHandler(async (req, res) => {
    res.json({ trip: startTrip(req.user, Number(req.params.id)) });
  }),
);

driverRouter.post(
  '/trips/:id/complete',
  asyncHandler(async (req, res) => {
    res.json({ trip: completeTrip(req.user, Number(req.params.id), req.body || {}) });
  }),
);

driverRouter.post(
  '/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['online', 'offline', 'paused'].includes(status)) {
      throw badRequest('Trạng thái không hợp lệ');
    }
    const profile = db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(req.user.id);
    if (!profile) throw notFound('Không tìm thấy hồ sơ tài xế');
    if (profile.verification_status !== 'approved') {
      throw forbidden('Hồ sơ tài xế chưa được xác minh, chưa thể bật nhận chuyến');
    }
    if (profile.online_status === 'on_trip' && status !== 'online') {
      throw conflict('Bạn đang thực hiện chuyến, không thể đổi trạng thái');
    }

    db.prepare('UPDATE driver_profiles SET online_status = ?, updated_at = ? WHERE user_id = ?').run(
      status,
      nowIso(),
      req.user.id,
    );

    res.json({ onlineStatus: status });
  }),
);

driverRouter.post(
  '/location',
  asyncHandler(async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const heading = req.body?.heading === undefined ? null : Number(req.body.heading);
    const speed = req.body?.speed === undefined ? null : Number(req.body.speed);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('Toạ độ không hợp lệ');
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw badRequest('Toạ độ ngoài phạm vi');

    const now = nowIso();
    db.prepare(
      `UPDATE driver_profiles SET current_lat = ?, current_lng = ?, location_updated_at = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(lat, lng, now, now, req.user.id);

    db.prepare(
      `INSERT INTO driver_locations (driver_id, lat, lng, heading, speed, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(req.user.id, lat, lng, heading, speed, now);

    const activeTrip = db
      .prepare(
        `SELECT id, customer_id FROM trips WHERE driver_id = ? AND status IN ('assigned','arrived','in_progress') LIMIT 1`,
      )
      .get(req.user.id);

    if (activeTrip) {
      emitToTrip(activeTrip.id, 'driver:location', {
        tripId: activeTrip.id,
        driverId: req.user.id,
        lat,
        lng,
        heading,
        speed,
        recordedAt: now,
      });
      emitToUser(activeTrip.customer_id, 'driver:location', {
        tripId: activeTrip.id,
        driverId: req.user.id,
        lat,
        lng,
        heading,
        speed,
        recordedAt: now,
      });
    }

    res.json({ ok: true, recordedAt: now });
  }),
);

driverRouter.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    const period = String(req.query.period || 'week');
    const now = new Date();
    let from;
    if (period === 'day') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    }

    const fromIso = from.toISOString();
    const summary = db
      .prepare(
        `SELECT COUNT(*) AS trips, COALESCE(SUM(final_price), 0) AS gross,
                COALESCE(SUM(driver_earning), 0) AS net, COALESCE(SUM(commission_amount), 0) AS commission
         FROM trips WHERE driver_id = ? AND status = 'completed' AND completed_at >= ?`,
      )
      .get(req.user.id, fromIso);

    const cancelled = db
      .prepare(
        `SELECT COUNT(*) AS c FROM trips WHERE driver_id = ? AND status = 'cancelled' AND cancelled_at >= ?`,
      )
      .get(req.user.id, fromIso).c;

    const daily = db
      .prepare(
        `SELECT substr(completed_at, 1, 10) AS day, COUNT(*) AS trips,
                COALESCE(SUM(driver_earning), 0) AS net
         FROM trips WHERE driver_id = ? AND status = 'completed' AND completed_at >= ?
         GROUP BY day ORDER BY day`,
      )
      .all(req.user.id, fromIso);

    const recent = db
      .prepare(
        `SELECT id, code, pickup_label, dropoff_label, final_price, driver_earning, completed_at
         FROM trips WHERE driver_id = ? AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 10`,
      )
      .all(req.user.id);

    const profile = db.prepare('SELECT rating, rating_count, trips_completed FROM driver_profiles WHERE user_id = ?').get(req.user.id);

    res.json({
      period,
      from: fromIso,
      summary: {
        trips: summary.trips,
        gross: summary.gross,
        net: summary.net,
        commission: summary.commission,
        cancelled,
        rating: profile?.rating || 5,
        ratingCount: profile?.rating_count || 0,
        tripsCompleted: profile?.trips_completed || 0,
      },
      daily,
      recent: recent.map((row) => ({
        id: row.id,
        code: row.code,
        pickup: row.pickup_label,
        dropoff: row.dropoff_label,
        price: row.final_price,
        earning: row.driver_earning,
        completedAt: row.completed_at,
      })),
    });
  }),
);

driverRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const profile = db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(req.user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStats = db
      .prepare(
        `SELECT COUNT(*) AS trips, COALESCE(SUM(driver_earning), 0) AS net
         FROM trips WHERE driver_id = ? AND status = 'completed' AND completed_at >= ?`,
      )
      .get(req.user.id, today.toISOString());

    res.json({
      onlineStatus: profile?.online_status || 'offline',
      verificationStatus: profile?.verification_status || 'pending',
      rating: profile?.rating || 5,
      ratingCount: profile?.rating_count || 0,
      tripsCompleted: profile?.trips_completed || 0,
      today: { trips: todayStats.trips, net: todayStats.net },
    });
  }),
);

driverRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const {
      licenseNumber,
      licenseExpiry,
      licenseImageUrl,
      idCardNumber,
      serviceArea,
      bio,
    } = req.body || {};

    const fields = [];
    const values = [];
    const map = {
      license_number: licenseNumber,
      license_expiry: licenseExpiry,
      license_image_url: licenseImageUrl,
      id_card_number: idCardNumber,
      service_area: serviceArea,
      bio,
    };
    for (const [column, value] of Object.entries(map)) {
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value || null);
      }
    }
    if (!fields.length) throw badRequest('Không có thông tin cần cập nhật');

    fields.push('updated_at = ?');
    values.push(nowIso(), req.user.id);
    db.prepare(`UPDATE driver_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);

    const profile = db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(req.user.id);
    res.json({
      driverProfile: {
        verificationStatus: profile.verification_status,
        onlineStatus: profile.online_status,
        licenseNumber: profile.license_number,
        licenseExpiry: profile.license_expiry,
        idCardNumber: profile.id_card_number,
        serviceArea: profile.service_area,
        bio: profile.bio,
      },
    });
  }),
);

driverRouter.post(
  '/vehicles',
  asyncHandler(async (req, res) => {
    const { plate, brand, model, color, year, seats, vehicleTypeId, imageUrl } = req.body || {};
    if (!plate) throw badRequest('Thiếu biển số xe');
    if (!vehicleTypeId) throw badRequest('Chưa chọn loại xe');
    const type = db.prepare('SELECT * FROM vehicle_types WHERE id = ?').get(Number(vehicleTypeId));
    if (!type) throw badRequest('Loại xe không tồn tại');

    const now = nowIso();
    const info = db
      .prepare(
        `INSERT INTO vehicles (driver_id, vehicle_type_id, plate, brand, model, color, year, seats, image_url, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .run(
        req.user.id,
        type.id,
        String(plate).toUpperCase(),
        brand || null,
        model || null,
        color || null,
        year ? Number(year) : null,
        Number(seats) || type.seats,
        imageUrl || null,
        now,
        now,
      );

    res.status(201).json({ vehicleId: Number(info.lastInsertRowid) });
  }),
);

driverRouter.delete(
  '/vehicles/:id',
  asyncHandler(async (req, res) => {
    const info = db
      .prepare('DELETE FROM vehicles WHERE id = ? AND driver_id = ?')
      .run(Number(req.params.id), req.user.id);
    if (!info.changes) throw notFound('Phương tiện không tồn tại');
    res.json({ ok: true });
  }),
);

export { round };
