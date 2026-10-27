import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler, notFound, parseJson } from '../utils.js';
import { serializeTrip, tripEvents } from '../services/trips.js';
import { routeThrough } from '../services/geo.js';

export const publicRouter = Router();

/**
 * Trang chia sẻ hành trình: chỉ đọc, không lộ số điện thoại đầy đủ.
 * Truy cập bằng token ngẫu nhiên, không cần đăng nhập.
 */
publicRouter.get(
  '/trips/:token',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM trips WHERE share_token = ?').get(req.params.token);
    if (!row) throw notFound('Liên kết chia sẻ không hợp lệ hoặc đã hết hạn');

    const trip = serializeTrip(row, { includePrivate: false });
    const profile = row.driver_id
      ? db
          .prepare('SELECT current_lat, current_lng, location_updated_at FROM driver_profiles WHERE user_id = ?')
          .get(row.driver_id)
      : null;

    const maskPhone = (phone) => (phone ? `${phone.slice(0, 3)}****${phone.slice(-2)}` : null);

    res.json({
      trip: {
        ...trip,
        customer: { ...trip.customer, phone: maskPhone(row.customer_phone) },
        driver: trip.driver
          ? { ...trip.driver, phone: maskPhone(row.driver_phone) }
          : null,
      },
      driverLocation:
        profile?.current_lat !== null && profile?.current_lat !== undefined
          ? { lat: profile.current_lat, lng: profile.current_lng, updatedAt: profile.location_updated_at }
          : null,
      events: tripEvents(row.id).map((e) => ({ type: e.type, message: e.message, createdAt: e.createdAt })),
      route: await routeThrough([
        { lat: row.pickup_lat, lng: row.pickup_lng },
        ...parseJson(row.stops, []).map((s) => ({ lat: s.lat, lng: s.lng })),
        { lat: row.dropoff_lat, lng: row.dropoff_lng },
      ]),
      shareUrl: `${config.publicWebUrl}/chia-se/${row.share_token}`,
    });
  }),
);

publicRouter.get(
  '/config',
  asyncHandler(async (req, res) => {
    const { integrationStatus } = await import('../middleware/common.js');
    res.json({
      appName: 'XeGo',
      version: '1.0.0',
      integrations: integrationStatus(),
      commissionRate: config.commissionRate,
    });
  }),
);
