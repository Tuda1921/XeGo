import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, badRequest, notFound, nowIso, parseJson } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { searchPlaces, reverseGeocode, routeThrough } from '../services/geo.js';
import {
  PAYMENT_METHODS,
  SPECIAL_REQUESTS,
  getServiceAreas,
  getVehicleTypes,
  quoteAllTypes,
  quoteTrip,
  getVehicleType,
} from '../services/pricing.js';
import { integrationStatus } from '../middleware/common.js';

export const catalogRouter = Router();

catalogRouter.get(
  '/vehicle-types',
  asyncHandler(async (req, res) => {
    res.json({ vehicleTypes: getVehicleTypes({ activeOnly: req.query.all !== '1' }) });
  }),
);

catalogRouter.get(
  '/service-areas',
  asyncHandler(async (req, res) => {
    res.json({ serviceAreas: getServiceAreas() });
  }),
);

catalogRouter.get(
  '/options',
  asyncHandler(async (req, res) => {
    res.json({
      specialRequests: SPECIAL_REQUESTS,
      paymentMethods: PAYMENT_METHODS,
      integrations: integrationStatus(),
    });
  }),
);

catalogRouter.get(
  '/places/search',
  asyncHandler(async (req, res) => {
    const { q, lat, lng } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.json({ results: [], source: 'none', simulated: false });
    }
    const near =
      lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
        ? { lat: Number(lat), lng: Number(lng) }
        : null;
    const data = await searchPlaces(String(q), { near, limit: 8 });
    res.json(data);
  }),
);

catalogRouter.get(
  '/places/reverse',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('Toạ độ không hợp lệ');
    res.json(await reverseGeocode(lat, lng));
  }),
);

catalogRouter.post(
  '/route',
  asyncHandler(async (req, res) => {
    const { points } = req.body || {};
    if (!Array.isArray(points) || points.length < 2) throw badRequest('Cần ít nhất 2 điểm');
    res.json(await routeThrough(points));
  }),
);

catalogRouter.post(
  '/quote',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const {
      vehicleTypeId,
      distanceKm = 0,
      durationMin = 0,
      serviceType = 'ride',
      tripMode = 'one_way',
      hours = 0,
      days = 0,
      stops = [],
      specialRequests = [],
      promoCode = null,
      scheduledAt = null,
      passengers = 1,
      luggage = 0,
      allTypes = false,
    } = body;

    const base = {
      distanceKm,
      durationMin,
      serviceType,
      tripMode,
      hours,
      days,
      stops,
      specialRequests,
      promoCode,
      scheduledAt,
      passengers,
      luggage,
    };

    if (allTypes) {
      return res.json({ quotes: quoteAllTypes(base) });
    }

    const vehicleType = getVehicleType(vehicleTypeId);
    if (!vehicleType) throw badRequest('Loại xe không hợp lệ');
    res.json({ quote: quoteTrip({ ...base, vehicleType }) });
  }),
);

catalogRouter.get(
  '/promo/:code',
  asyncHandler(async (req, res) => {
    const row = db
      .prepare('SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(?) AND active = 1')
      .get(req.params.code);
    if (!row) throw notFound('Mã giảm giá không tồn tại hoặc đã hết hạn');
    res.json({
      promo: {
        code: row.code,
        description: row.description,
        type: row.type,
        value: row.value,
        minOrder: row.min_order,
        maxDiscount: row.max_discount,
        endsAt: row.ends_at,
      },
    });
  }),
);

catalogRouter.get(
  '/promos',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM promo_codes WHERE active = 1
         AND (ends_at IS NULL OR ends_at > ?)
         AND (usage_limit IS NULL OR used_count < usage_limit)
         ORDER BY id DESC LIMIT 10`,
      )
      .all(nowIso());
    res.json({
      promos: rows.map((row) => ({
        code: row.code,
        description: row.description,
        type: row.type,
        value: row.value,
        minOrder: row.min_order,
        maxDiscount: row.max_discount,
        endsAt: row.ends_at,
      })),
    });
  }),
);

export const placesRouter = Router();

placesRouter.use(requireAuth);

placesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare('SELECT * FROM places WHERE user_id = ? ORDER BY kind, id DESC')
      .all(req.user.id);
    res.json({
      places: rows.map((row) => ({
        id: row.id,
        label: row.label,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        kind: row.kind,
      })),
    });
  }),
);

placesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { label, address, lat, lng, kind = 'other' } = req.body || {};
    if (!label || !address) throw badRequest('Thiếu tên hoặc địa chỉ');
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      throw badRequest('Toạ độ không hợp lệ');
    }
    if (!['home', 'work', 'other'].includes(kind)) throw badRequest('Loại địa điểm không hợp lệ');

    if (kind !== 'other') {
      db.prepare('DELETE FROM places WHERE user_id = ? AND kind = ?').run(req.user.id, kind);
    }

    const info = db
      .prepare(
        `INSERT INTO places (user_id, label, address, lat, lng, kind, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(req.user.id, label, address, Number(lat), Number(lng), kind, nowIso());

    res.status(201).json({
      place: { id: Number(info.lastInsertRowid), label, address, lat: Number(lat), lng: Number(lng), kind },
    });
  }),
);

placesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const info = db
      .prepare('DELETE FROM places WHERE id = ? AND user_id = ?')
      .run(Number(req.params.id), req.user.id);
    if (!info.changes) throw notFound('Địa điểm không tồn tại');
    res.json({ ok: true });
  }),
);

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT f.id, u.id AS driver_id, u.name, u.avatar_url, dp.rating, dp.trips_completed
         FROM favorites f JOIN users u ON u.id = f.driver_id
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
         WHERE f.customer_id = ? ORDER BY f.id DESC`,
      )
      .all(req.user.id);
    res.json({
      favorites: rows.map((row) => ({
        id: row.id,
        driverId: row.driver_id,
        name: row.name,
        avatarUrl: row.avatar_url,
        rating: row.rating,
        tripsCompleted: row.trips_completed,
      })),
    });
  }),
);

favoritesRouter.post(
  '/:driverId',
  asyncHandler(async (req, res) => {
    const driverId = Number(req.params.driverId);
    const driver = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'driver'").get(driverId);
    if (!driver) throw notFound('Tài xế không tồn tại');
    db.prepare(
      `INSERT INTO favorites (customer_id, driver_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(customer_id, driver_id) DO NOTHING`,
    ).run(req.user.id, driverId, nowIso());
    res.json({ ok: true });
  }),
);

favoritesRouter.delete(
  '/:driverId',
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM favorites WHERE customer_id = ? AND driver_id = ?').run(
      req.user.id,
      Number(req.params.driverId),
    );
    res.json({ ok: true });
  }),
);

export { parseJson };
