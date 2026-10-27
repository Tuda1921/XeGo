import { Router } from 'express';
import { db, audit, getSetting, setSetting } from '../db.js';
import { config } from '../config.js';
import {
  asyncHandler,
  badRequest,
  conflict,
  notFound,
  nowIso,
  parseJson,
  round,
} from '../utils.js';
import { requireAdmin } from '../middleware/auth.js';
import { assignDriverManually, cancelTrip, getTripRow, serializeTrip } from '../services/trips.js';
import { notify } from '../services/notifications.js';
import { emitToUser } from '../services/realtime.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

adminRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const today = startOfDay();
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const counts = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'searching' THEN 1 ELSE 0 END) AS searching,
           SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) AS assigned,
           SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END) AS arrived,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
           SUM(CASE WHEN status = 'no_driver' THEN 1 ELSE 0 END) AS no_driver,
           SUM(CASE WHEN status = 'completed' AND completed_at >= ? THEN 1 ELSE 0 END) AS completed_today,
           SUM(CASE WHEN status = 'cancelled' AND cancelled_at >= ? THEN 1 ELSE 0 END) AS cancelled_today,
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS created_today
         FROM trips`,
      )
      .get(today, today, today);

    const revenue = db
      .prepare(
        `SELECT COALESCE(SUM(final_price), 0) AS gross, COALESCE(SUM(commission_amount), 0) AS commission,
                COALESCE(SUM(driver_earning), 0) AS driver_earning, COUNT(*) AS trips
         FROM trips WHERE status = 'completed' AND completed_at >= ?`,
      )
      .get(today);

    const weekRevenue = db
      .prepare(
        `SELECT COALESCE(SUM(final_price), 0) AS gross, COALESCE(SUM(commission_amount), 0) AS commission,
                COUNT(*) AS trips
         FROM trips WHERE status = 'completed' AND completed_at >= ?`,
      )
      .get(weekAgo);

    const users = db
      .prepare(
        `SELECT
           SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) AS customers,
           SUM(CASE WHEN role = 'driver' THEN 1 ELSE 0 END) AS drivers
         FROM users WHERE status = 'active'`,
      )
      .get();

    const drivers = db
      .prepare(
        `SELECT
           SUM(CASE WHEN online_status = 'online' THEN 1 ELSE 0 END) AS online,
           SUM(CASE WHEN online_status = 'on_trip' THEN 1 ELSE 0 END) AS on_trip,
           SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_verification
         FROM driver_profiles`,
      )
      .get();

    const openTickets = db
      .prepare(`SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('open','in_progress')`)
      .get().c;

    const trend = db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS trips,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN final_price ELSE 0 END), 0) AS gross
         FROM trips WHERE created_at >= ?
         GROUP BY day ORDER BY day`,
      )
      .all(weekAgo);

    res.json({
      counts: {
        searching: counts.searching || 0,
        assigned: counts.assigned || 0,
        arrived: counts.arrived || 0,
        inProgress: counts.in_progress || 0,
        scheduled: counts.scheduled || 0,
        noDriver: counts.no_driver || 0,
        completedToday: counts.completed_today || 0,
        cancelledToday: counts.cancelled_today || 0,
        createdToday: counts.created_today || 0,
      },
      revenue: {
        today: { gross: revenue.gross, commission: revenue.commission, driverEarning: revenue.driver_earning, trips: revenue.trips },
        week: { gross: weekRevenue.gross, commission: weekRevenue.commission, trips: weekRevenue.trips },
      },
      users: { customers: users.customers || 0, drivers: users.drivers || 0 },
      drivers: {
        online: drivers.online || 0,
        onTrip: drivers.on_trip || 0,
        pendingVerification: drivers.pending_verification || 0,
      },
      openTickets,
      trend,
      commissionRate: config.commissionRate,
    });
  }),
);

adminRouter.get(
  '/trips',
  asyncHandler(async (req, res) => {
    const { status, q, from, to, limit = 50, offset = 0 } = req.query;
    const params = [];
    const where = ['1 = 1'];

    if (status) {
      const statuses = String(status).split(',').filter(Boolean);
      where.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (q) {
      where.push('(t.code LIKE ? OR t.pickup_label LIKE ? OR t.dropoff_label LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (from) {
      where.push('t.created_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('t.created_at <= ?');
      params.push(to);
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
         WHERE ${where.join(' AND ')}
         ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, Math.min(200, Number(limit) || 50), Number(offset) || 0);

    const total = db
      .prepare(
        `SELECT COUNT(*) AS c FROM trips t JOIN users c ON c.id = t.customer_id WHERE ${where.join(' AND ')}`,
      )
      .get(...params).c;

    res.json({ trips: rows.map((row) => serializeTrip(row)), total });
  }),
);

adminRouter.get(
  '/trips/live',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT t.id, t.code, t.status, t.pickup_lat, t.pickup_lng, t.dropoff_lat, t.dropoff_lng,
                t.pickup_label, t.dropoff_label, t.estimated_price, t.created_at,
                d.name AS driver_name, dp.current_lat AS driver_lat, dp.current_lng AS driver_lng,
                dp.location_updated_at
         FROM trips t
         LEFT JOIN users d ON d.id = t.driver_id
         LEFT JOIN driver_profiles dp ON dp.user_id = t.driver_id
         WHERE t.status IN ('searching','assigned','arrived','in_progress')
         ORDER BY t.created_at DESC LIMIT 100`,
      )
      .all();

    const drivers = db
      .prepare(
        `SELECT u.id, u.name, dp.current_lat, dp.current_lng, dp.online_status, dp.location_updated_at,
                dp.rating, v.plate
         FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
         LEFT JOIN vehicles v ON v.driver_id = u.id AND v.status = 'active'
         WHERE u.role = 'driver' AND u.status = 'active' AND dp.current_lat IS NOT NULL
         GROUP BY u.id`,
      )
      .all();

    res.json({
      trips: rows.map((row) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        pickup: { label: row.pickup_label, lat: row.pickup_lat, lng: row.pickup_lng },
        dropoff: { label: row.dropoff_label, lat: row.dropoff_lat, lng: row.dropoff_lng },
        price: row.estimated_price,
        driverName: row.driver_name,
        driverLocation:
          row.driver_lat !== null
            ? { lat: row.driver_lat, lng: row.driver_lng, updatedAt: row.location_updated_at }
            : null,
        createdAt: row.created_at,
      })),
      drivers: drivers.map((row) => ({
        id: row.id,
        name: row.name,
        plate: row.plate,
        rating: row.rating,
        onlineStatus: row.online_status,
        location: { lat: row.current_lat, lng: row.current_lng, updatedAt: row.location_updated_at },
      })),
    });
  }),
);

adminRouter.get(
  '/trips/:id',
  asyncHandler(async (req, res) => {
    const row = getTripRow(Number(req.params.id));
    if (!row) throw notFound('Chuyến không tồn tại');
    const events = db
      .prepare('SELECT * FROM trip_events WHERE trip_id = ? ORDER BY id')
      .all(row.id)
      .map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        actorRole: e.actor_role,
        createdAt: e.created_at,
      }));
    const offers = db
      .prepare(
        `SELECT o.*, u.name AS driver_name FROM trip_offers o JOIN users u ON u.id = o.driver_id
         WHERE o.trip_id = ? ORDER BY o.id DESC`,
      )
      .all(row.id);
    res.json({ trip: serializeTrip(row), events, offers });
  }),
);

adminRouter.post(
  '/trips/:id/assign',
  asyncHandler(async (req, res) => {
    const { driverId } = req.body || {};
    if (!driverId) throw badRequest('Chưa chọn tài xế');
    const trip = assignDriverManually(req.user, Number(req.params.id), Number(driverId));
    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'trip.assign',
      entity: 'trip',
      entityId: req.params.id,
      meta: { driverId },
      ip: req.ip,
    });
    res.json({ trip });
  }),
);

adminRouter.post(
  '/trips/:id/cancel',
  asyncHandler(async (req, res) => {
    const trip = cancelTrip(req.user, Number(req.params.id), req.body?.reason || 'Quản trị viên hủy');
    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'trip.cancel',
      entity: 'trip',
      entityId: req.params.id,
      meta: { reason: req.body?.reason },
      ip: req.ip,
    });
    res.json({ trip });
  }),
);

adminRouter.get(
  '/drivers',
  asyncHandler(async (req, res) => {
    const { status, q, verification } = req.query;
    const params = [];
    const where = ["u.role = 'driver'"];

    if (status) {
      where.push('dp.online_status = ?');
      params.push(status);
    }
    if (verification) {
      where.push('dp.verification_status = ?');
      params.push(verification);
    }
    if (q) {
      where.push('(u.name LIKE ? OR u.phone LIKE ? OR v.plate LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.email, u.status, u.created_at,
                dp.verification_status, dp.verification_note, dp.online_status, dp.rating,
                dp.rating_count, dp.trips_completed, dp.trips_cancelled, dp.license_number,
                dp.license_expiry, dp.id_card_number, dp.service_area, dp.current_lat, dp.current_lng,
                dp.location_updated_at, o.name AS operator_name,
                v.id AS vehicle_id, v.plate, v.brand, v.model, v.color, v.seats, v.status AS vehicle_status,
                vt.name AS vehicle_type_name
         FROM users u
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         LEFT JOIN vehicles v ON v.driver_id = u.id AND v.status = 'active'
         LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
         LEFT JOIN operators o ON o.id = dp.operator_id
         WHERE ${where.join(' AND ')}
         GROUP BY u.id
         ORDER BY u.created_at DESC LIMIT 200`,
      )
      .all(...params);

    res.json({
      drivers: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        verificationStatus: row.verification_status,
        verificationNote: row.verification_note,
        onlineStatus: row.online_status,
        rating: row.rating,
        ratingCount: row.rating_count,
        tripsCompleted: row.trips_completed,
        tripsCancelled: row.trips_cancelled,
        licenseNumber: row.license_number,
        licenseExpiry: row.license_expiry,
        idCardNumber: row.id_card_number,
        serviceArea: row.service_area,
        operatorName: row.operator_name,
        location:
          row.current_lat !== null
            ? { lat: row.current_lat, lng: row.current_lng, updatedAt: row.location_updated_at }
            : null,
        vehicle: row.vehicle_id
          ? {
              id: row.vehicle_id,
              plate: row.plate,
              brand: row.brand,
              model: row.model,
              color: row.color,
              seats: row.seats,
              status: row.vehicle_status,
              typeName: row.vehicle_type_name,
            }
          : null,
      })),
    });
  }),
);

adminRouter.post(
  '/drivers/:id/verify',
  asyncHandler(async (req, res) => {
    const { approved, note } = req.body || {};
    const driverId = Number(req.params.id);
    const profile = db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(driverId);
    if (!profile) throw notFound('Không tìm thấy hồ sơ tài xế');

    const status = approved ? 'approved' : 'rejected';
    db.prepare(
      `UPDATE driver_profiles SET verification_status = ?, verification_note = ?, verified_at = ?,
         verified_by = ?, online_status = CASE WHEN ? = 'approved' THEN online_status ELSE 'offline' END,
         updated_at = ?
       WHERE user_id = ?`,
    ).run(status, note || null, nowIso(), req.user.id, status, nowIso(), driverId);

    notify(driverId, {
      type: 'verification',
      title: approved ? 'Hồ sơ tài xế đã được duyệt' : 'Hồ sơ tài xế bị từ chối',
      body: approved
        ? 'Bạn có thể bật Online và bắt đầu nhận chuyến.'
        : note || 'Vui lòng kiểm tra lại giấy tờ và gửi lại hồ sơ.',
      data: {},
    });
    emitToUser(driverId, 'driver:verification', { status, note: note || null });

    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: approved ? 'driver.approve' : 'driver.reject',
      entity: 'driver',
      entityId: driverId,
      meta: { note },
      ip: req.ip,
    });

    res.json({ ok: true, verificationStatus: status });
  }),
);

adminRouter.post(
  '/drivers/:id/suspend',
  asyncHandler(async (req, res) => {
    const driverId = Number(req.params.id);
    const { suspended } = req.body || {};
    db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND role = ?').run(
      suspended ? 'suspended' : 'active',
      nowIso(),
      driverId,
      'driver',
    );
    if (suspended) {
      db.prepare("UPDATE driver_profiles SET online_status = 'offline' WHERE user_id = ?").run(driverId);
    }
    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: suspended ? 'driver.suspend' : 'driver.activate',
      entity: 'driver',
      entityId: driverId,
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    const params = [];
    let where = "u.role = 'customer'";
    if (q) {
      where += ' AND (u.name LIKE ? OR u.phone LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.phone, u.email, u.status, u.created_at,
                COUNT(t.id) AS trips,
                COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.final_price ELSE 0 END), 0) AS spent,
                MAX(t.created_at) AS last_trip_at
         FROM users u LEFT JOIN trips t ON t.customer_id = u.id
         WHERE ${where}
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`,
      )
      .all(...params);

    res.json({
      customers: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        trips: row.trips,
        spent: row.spent,
        lastTripAt: row.last_trip_at,
      })),
    });
  }),
);

adminRouter.get(
  '/vehicles',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT v.*, u.name AS driver_name, u.phone AS driver_phone, vt.name AS type_name
         FROM vehicles v JOIN users u ON u.id = v.driver_id
         JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
         ORDER BY v.created_at DESC LIMIT 200`,
      )
      .all();
    res.json({
      vehicles: rows.map((row) => ({
        id: row.id,
        plate: row.plate,
        brand: row.brand,
        model: row.model,
        color: row.color,
        year: row.year,
        seats: row.seats,
        status: row.status,
        typeName: row.type_name,
        driverId: row.driver_id,
        driverName: row.driver_name,
        driverPhone: row.driver_phone,
        createdAt: row.created_at,
      })),
    });
  }),
);

adminRouter.patch(
  '/vehicles/:id',
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['active', 'inactive', 'pending'].includes(status)) throw badRequest('Trạng thái không hợp lệ');
    const info = db
      .prepare('UPDATE vehicles SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, nowIso(), Number(req.params.id));
    if (!info.changes) throw notFound('Phương tiện không tồn tại');
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/vehicle-types',
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT * FROM vehicle_types ORDER BY sort_order, seats').all();
    res.json({
      vehicleTypes: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        seats: row.seats,
        description: row.description,
        baseFare: row.base_fare,
        perKm: row.per_km,
        perMinute: row.per_minute,
        minFare: row.min_fare,
        hourlyRate: row.hourly_rate,
        dailyRate: row.daily_rate,
        luggageCapacity: row.luggage_capacity,
        tier: row.tier,
        active: Boolean(row.active),
        sortOrder: row.sort_order,
      })),
    });
  }),
);

adminRouter.post(
  '/vehicle-types',
  asyncHandler(async (req, res) => {
    const {
      code,
      name,
      seats,
      description,
      baseFare = 0,
      perKm = 0,
      perMinute = 0,
      minFare = 0,
      hourlyRate = 0,
      dailyRate = 0,
      luggageCapacity = 2,
      tier = 'standard',
      sortOrder = 0,
    } = req.body || {};
    if (!code || !name || !seats) throw badRequest('Thiếu mã, tên hoặc số ghế');
    const exists = db.prepare('SELECT id FROM vehicle_types WHERE code = ?').get(code);
    if (exists) throw conflict('Mã loại xe đã tồn tại');

    const info = db
      .prepare(
        `INSERT INTO vehicle_types (code, name, seats, description, base_fare, per_km, per_minute,
           min_fare, hourly_rate, daily_rate, luggage_capacity, tier, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(
        code,
        name,
        Number(seats),
        description || null,
        Number(baseFare),
        Number(perKm),
        Number(perMinute),
        Number(minFare),
        Number(hourlyRate),
        Number(dailyRate),
        Number(luggageCapacity),
        tier,
        Number(sortOrder),
        nowIso(),
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

adminRouter.patch(
  '/vehicle-types/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM vehicle_types WHERE id = ?').get(id);
    if (!existing) throw notFound('Loại xe không tồn tại');

    const map = {
      name: 'name',
      seats: 'seats',
      description: 'description',
      baseFare: 'base_fare',
      perKm: 'per_km',
      perMinute: 'per_minute',
      minFare: 'min_fare',
      hourlyRate: 'hourly_rate',
      dailyRate: 'daily_rate',
      luggageCapacity: 'luggage_capacity',
      tier: 'tier',
      sortOrder: 'sort_order',
      active: 'active',
    };
    const fields = [];
    const values = [];
    for (const [key, column] of Object.entries(map)) {
      if (req.body?.[key] !== undefined) {
        fields.push(`${column} = ?`);
        values.push(key === 'active' ? (req.body[key] ? 1 : 0) : req.body[key]);
      }
    }
    if (!fields.length) throw badRequest('Không có thông tin cần cập nhật');
    values.push(id);
    db.prepare(`UPDATE vehicle_types SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'vehicle_type.update',
      entity: 'vehicle_type',
      entityId: id,
      meta: req.body,
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/promos',
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT * FROM promo_codes ORDER BY id DESC').all();
    res.json({
      promos: rows.map((row) => ({
        id: row.id,
        code: row.code,
        description: row.description,
        type: row.type,
        value: row.value,
        minOrder: row.min_order,
        maxDiscount: row.max_discount,
        usageLimit: row.usage_limit,
        usedCount: row.used_count,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        active: Boolean(row.active),
      })),
    });
  }),
);

adminRouter.post(
  '/promos',
  asyncHandler(async (req, res) => {
    const {
      code,
      description,
      type,
      value,
      minOrder = 0,
      maxDiscount = null,
      usageLimit = null,
      startsAt = null,
      endsAt = null,
    } = req.body || {};
    if (!code || !type || value === undefined) throw badRequest('Thiếu thông tin mã giảm giá');
    if (!['percent', 'fixed'].includes(type)) throw badRequest('Loại giảm giá không hợp lệ');
    const exists = db.prepare('SELECT id FROM promo_codes WHERE UPPER(code) = UPPER(?)').get(code);
    if (exists) throw conflict('Mã giảm giá đã tồn tại');

    const info = db
      .prepare(
        `INSERT INTO promo_codes (code, description, type, value, min_order, max_discount, usage_limit,
           used_count, starts_at, ends_at, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?)`,
      )
      .run(
        String(code).toUpperCase(),
        description || null,
        type,
        Number(value),
        Number(minOrder),
        maxDiscount === null ? null : Number(maxDiscount),
        usageLimit === null ? null : Number(usageLimit),
        startsAt,
        endsAt,
        nowIso(),
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

adminRouter.patch(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const { active } = req.body || {};
    const info = db
      .prepare('UPDATE promo_codes SET active = ? WHERE id = ?')
      .run(active ? 1 : 0, Number(req.params.id));
    if (!info.changes) throw notFound('Mã giảm giá không tồn tại');
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT p.*, t.code, t.payment_method, u.name AS customer_name
         FROM payments p JOIN trips t ON t.id = p.trip_id
         JOIN users u ON u.id = t.customer_id
         ORDER BY p.id DESC LIMIT 200`,
      )
      .all();
    res.json({
      payments: rows.map((row) => ({
        id: row.id,
        tripId: row.trip_id,
        code: row.code,
        customerName: row.customer_name,
        method: row.method,
        amount: row.amount,
        status: row.status,
        provider: row.provider,
        providerRef: row.provider_ref,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        simulated: parseJson(row.meta, {}).simulated || false,
      })),
    });
  }),
);

adminRouter.post(
  '/payments/:id/refund',
  asyncHandler(async (req, res) => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(req.params.id));
    if (!payment) throw notFound('Giao dịch không tồn tại');
    if (payment.status !== 'paid') throw conflict('Chỉ hoàn tiền giao dịch đã thanh toán');

    const now = nowIso();
    db.transaction(() => {
      db.prepare(`UPDATE payments SET status = 'refunded', refunded_at = ? WHERE id = ?`).run(
        now,
        payment.id,
      );
      db.prepare(`UPDATE trips SET payment_status = 'refunded', updated_at = ? WHERE id = ?`).run(
        now,
        payment.trip_id,
      );
    })();

    const trip = db.prepare('SELECT customer_id, code FROM trips WHERE id = ?').get(payment.trip_id);
    notify(trip.customer_id, {
      type: 'refund',
      title: 'Đã hoàn tiền',
      body: `${payment.amount.toLocaleString('vi-VN')} ₫ cho chuyến ${trip.code}.`,
      data: { tripId: payment.trip_id },
    });

    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'payment.refund',
      entity: 'payment',
      entityId: payment.id,
      meta: { amount: payment.amount },
      ip: req.ip,
    });

    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const params = [];
    let where = '1 = 1';
    if (status) {
      where += ' AND s.status = ?';
      params.push(status);
    }
    const rows = db
      .prepare(
        `SELECT s.*, u.name AS user_name, u.phone AS user_phone, t.code AS trip_code
         FROM support_tickets s JOIN users u ON u.id = s.user_id
         LEFT JOIN trips t ON t.id = s.trip_id
         WHERE ${where} ORDER BY s.created_at DESC LIMIT 200`,
      )
      .all(...params);
    res.json({
      tickets: rows.map((row) => ({
        id: row.id,
        code: row.code,
        userId: row.user_id,
        userName: row.user_name,
        userPhone: row.user_phone,
        tripId: row.trip_id,
        tripCode: row.trip_code,
        category: row.category,
        subject: row.subject,
        description: row.description,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }),
);

adminRouter.patch(
  '/tickets/:id',
  asyncHandler(async (req, res) => {
    const { status, priority } = req.body || {};
    const fields = [];
    const values = [];
    if (status) {
      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        throw badRequest('Trạng thái không hợp lệ');
      }
      fields.push('status = ?');
      values.push(status);
    }
    if (priority) {
      if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
        throw badRequest('Mức ưu tiên không hợp lệ');
      }
      fields.push('priority = ?');
      values.push(priority);
    }
    if (!fields.length) throw badRequest('Không có thông tin cần cập nhật');
    fields.push('updated_at = ?');
    values.push(nowIso(), Number(req.params.id));

    const info = db
      .prepare(`UPDATE support_tickets SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
    if (!info.changes) throw notFound('Yêu cầu hỗ trợ không tồn tại');

    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(Number(req.params.id));
    notify(ticket.user_id, {
      type: 'support',
      title: 'Cập nhật yêu cầu hỗ trợ',
      body: `Yêu cầu ${ticket.code} đã được cập nhật: ${status || ticket.status}.`,
      data: { ticketId: ticket.id },
    });

    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT a.*, u.name AS actor_name FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 200`,
      )
      .all();
    res.json({
      logs: rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_name,
        actorRole: row.actor_role,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        meta: parseJson(row.meta, {}),
        ip: row.ip,
        createdAt: row.created_at,
      })),
    });
  }),
);

adminRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json({
      settings: {
        commissionRate: getSetting('commissionRate', config.commissionRate),
        supportPhone: getSetting('supportPhone', '1900 6868'),
        supportEmail: getSetting('supportEmail', 'hotro@xego.vn'),
        companyName: getSetting('companyName', 'XeGo Việt Nam'),
        cancellationPolicy: getSetting(
          'cancellationPolicy',
          'Khách có thể hủy miễn phí trước khi tài xế tới điểm đón. Sau khi tài xế đã tới, phí hủy 20.000 ₫ có thể được áp dụng.',
        ),
      },
    });
  }),
);

adminRouter.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const allowed = ['commissionRate', 'supportPhone', 'supportEmail', 'companyName', 'cancellationPolicy'];
    const updated = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) {
        updated[key] = setSetting(key, req.body[key]);
      }
    }
    audit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'settings.update',
      entity: 'settings',
      meta: updated,
      ip: req.ip,
    });
    res.json({ settings: updated });
  }),
);

adminRouter.get(
  '/operators',
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT * FROM operators ORDER BY id').all();
    res.json({
      operators: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        commissionRate: row.commission_rate,
        status: row.status,
      })),
    });
  }),
);

adminRouter.post(
  '/operators',
  asyncHandler(async (req, res) => {
    const { name, phone, email, address, commissionRate = 0.2 } = req.body || {};
    if (!name) throw badRequest('Thiếu tên nhà xe');
    const info = db
      .prepare(
        `INSERT INTO operators (name, phone, email, address, commission_rate, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      )
      .run(name, phone || null, email || null, address || null, Number(commissionRate), nowIso());
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

adminRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const from = new Date(Date.now() - days * 86400_000).toISOString();

    const daily = db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day,
                COUNT(*) AS trips,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN final_price ELSE 0 END), 0) AS gross,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN commission_amount ELSE 0 END), 0) AS commission
         FROM trips WHERE created_at >= ? GROUP BY day ORDER BY day`,
      )
      .all(from);

    const byType = db
      .prepare(
        `SELECT vt.name, COUNT(*) AS trips, COALESCE(SUM(t.final_price), 0) AS gross
         FROM trips t JOIN vehicle_types vt ON vt.id = t.vehicle_type_id
         WHERE t.status = 'completed' AND t.completed_at >= ?
         GROUP BY vt.id ORDER BY trips DESC`,
      )
      .all(from);

    const topDrivers = db
      .prepare(
        `SELECT u.id, u.name, COUNT(*) AS trips, COALESCE(SUM(t.driver_earning), 0) AS earning,
                dp.rating
         FROM trips t JOIN users u ON u.id = t.driver_id
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         WHERE t.status = 'completed' AND t.completed_at >= ?
         GROUP BY u.id ORDER BY earning DESC LIMIT 10`,
      )
      .all(from);

    const cancellationReasons = db
      .prepare(
        `SELECT cancel_reason AS reason, COUNT(*) AS count FROM trips
         WHERE status = 'cancelled' AND cancelled_at >= ?
         GROUP BY cancel_reason ORDER BY count DESC LIMIT 10`,
      )
      .all(from);

    res.json({ days, daily, byType, topDrivers, cancellationReasons });
  }),
);

export { round };
