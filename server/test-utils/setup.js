import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Chuẩn bị môi trường test: DB tạm riêng, không seed tự động.
 * Phải được import TRƯỚC các module server để process.env có hiệu lực.
 */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xego-test-'));

process.env.NODE_ENV = 'test';
process.env.DB_FILE = path.join(tmpDir, 'xego-test.db');
process.env.SEED = 'false';
process.env.JWT_SECRET = 'xego-test-secret';
process.env.PAYMENT_PROVIDER = 'demo';
process.env.SMS_PROVIDER = 'demo';
process.env.PORT = '0';
process.env.OFFER_TTL_SECONDS = '45';
process.env.MATCH_RADIUS_KM = '30';
process.env.MAX_OFFERS = '3';
process.env.MAX_MATCH_ROUNDS = '4';

process.on('exit', () => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // bỏ qua: file DB có thể còn bị giữ bởi handle của better-sqlite3
  }
});

export const { db, migrate } = await import('../src/db.js');
export const { seedDatabase } = await import('../src/seed.js');
export const { config } = await import('../src/config.js');
export const pricing = await import('../src/services/pricing.js');
export const matching = await import('../src/services/matching.js');
export const trips = await import('../src/services/trips.js');
export const utils = await import('../src/utils.js');

migrate();
seedDatabase();

export function userByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

export function vehicleTypeByCode(code) {
  return pricing.getVehicleTypes().find((type) => type.code === code);
}

/** Mốc thời gian không rơi vào giờ cao điểm / cuối tuần để giá ổn định. */
export function noSurgeDate() {
  const start = Date.UTC(2026, 0, 5, 0, 0, 0);
  for (let i = 0; i < 24 * 30; i += 1) {
    const candidate = new Date(start + i * 3600_000);
    if (pricing.surgeFor(candidate).multiplier === 1) return candidate;
  }
  throw new Error('Không tìm được mốc thời gian không tăng giá');
}

export const PICKUP = {
  label: 'Chợ Bến Thành',
  address: 'Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  lat: 10.7725,
  lng: 106.698,
};

export const DROPOFF = {
  label: 'Landmark 81',
  address: '720A Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh',
  lat: 10.7951,
  lng: 106.7218,
};

/** Tạo chuyến đi thật qua service để test luồng nghiệp vụ. */
export function createTestTrip({
  phone = '0901234567',
  typeCode = 'sedan4',
  distanceKm = 6.4,
  durationMin = 18,
  promoCode = null,
  scheduleType = 'now',
  scheduledAt = null,
  passengers = 1,
  pickup = PICKUP,
  dropoff = DROPOFF,
} = {}) {
  const customer = userByPhone(phone);
  const vehicleType = vehicleTypeByCode(typeCode);
  const quote = pricing.quoteTrip({
    vehicleType,
    distanceKm,
    durationMin,
    promoCode,
    scheduledAt: scheduledAt || noSurgeDate().toISOString(),
    passengers,
  });

  const trip = trips.createTrip(customer, {
    vehicleTypeId: vehicleType.id,
    pickup,
    dropoff,
    distanceKm,
    durationMin,
    passengers,
    paymentMethod: 'cash',
    serviceType: 'ride',
    tripMode: 'one_way',
    scheduleType,
    scheduledAt,
    quote,
  });

  return { trip, customer, vehicleType, quote };
}

export function pendingOfferFor(tripId) {
  return db
    .prepare(`SELECT * FROM trip_offers WHERE trip_id = ? AND status = 'pending' ORDER BY id LIMIT 1`)
    .get(tripId);
}

export function driverById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

/**
 * Xóa dữ liệu chuyến giữa các test để tránh ràng buộc "chuyến trùng" và
 * bảo đảm mỗi test bắt đầu từ trạng thái sạch.
 */
export function resetTrips() {
  db.exec(`
    DELETE FROM trip_messages;
    DELETE FROM trip_events;
    DELETE FROM trip_offers;
    DELETE FROM payments;
    DELETE FROM ratings;
    DELETE FROM notifications;
    DELETE FROM trips;
    UPDATE driver_profiles SET online_status = 'offline', updated_at = '${new Date().toISOString()}';
    UPDATE promo_codes SET used_count = 0;
  `);
}
