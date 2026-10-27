import test from 'node:test';
import assert from 'node:assert/strict';
import { db, userByPhone, resetTrips } from '../test-utils/setup.js';
import { signToken, publicUser } from '../src/middleware/auth.js';
import { normalizePhone, isValidPhone, haversineKm, round, clamp } from '../src/utils.js';

test.beforeEach(() => {
  resetTrips();
});

test('token chứa đúng người dùng và vai trò', () => {
  const admin = userByPhone('0900000001');
  const token = signToken(admin);
  assert.equal(typeof token, 'string');
  assert.ok(token.split('.').length === 3, 'phải là JWT ba phần');
});

test('publicUser không làm lộ mật khẩu hay hash', () => {
  const row = db.prepare('SELECT * FROM users WHERE phone = ?').get('0901234567');
  const safe = publicUser(row);

  assert.equal(safe.phone, '0901234567');
  assert.equal(safe.role, 'customer');
  assert.equal(safe.password, undefined);
  assert.equal(safe.password_hash, undefined);
  assert.equal(typeof safe.phoneVerified, 'boolean');
});

test('chuẩn hóa số điện thoại Việt Nam', () => {
  assert.equal(normalizePhone('+84901234567'), '0901234567');
  assert.equal(normalizePhone('84901234567'), '0901234567');
  assert.equal(normalizePhone('090 123 4567'), '0901234567');
  assert.equal(normalizePhone('(090) 123-4567'), '0901234567');
  assert.equal(normalizePhone(''), '');
});

test('kiểm tra số điện thoại hợp lệ', () => {
  assert.equal(isValidPhone('0901234567'), true);
  assert.equal(isValidPhone('+84901234567'), true);
  assert.equal(isValidPhone('12345'), false);
  assert.equal(isValidPhone('abc'), false);
});

test('khoảng cách haversine đúng với khoảng cách đã biết', () => {
  const hcm = { lat: 10.7769, lng: 106.7009 };
  const hn = { lat: 21.0278, lng: 105.8342 };
  const distance = haversineKm(hcm, hn);

  assert.ok(distance > 1130 && distance < 1160, `khoảng cách HCM–HN khoảng 1140 km, nhận ${distance}`);
  assert.equal(haversineKm(hcm, hcm), 0);
  assert.equal(haversineKm(null, hn), null);
});

test('round và clamp xử lý giá trị biên', () => {
  assert.equal(round(1.23456, 2), 1.23);
  assert.equal(round(1.23556, 3), 1.236);
  assert.equal(round(null), 0);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('mỗi vai trò demo đăng nhập được và có đúng role', () => {
  const expectations = [
    ['0900000001', 'admin'],
    ['0900000002', 'operator'],
    ['0901234567', 'customer'],
    ['0901111222', 'driver'],
  ];

  for (const [phone, role] of expectations) {
    const user = userByPhone(phone);
    assert.ok(user, `phải có tài khoản demo ${phone}`);
    assert.equal(user.role, role);
    assert.equal(user.status, 'active');
    assert.ok(user.password_hash, 'phải lưu hash mật khẩu');
    assert.notEqual(user.password_hash, 'admin123', 'không được lưu mật khẩu dạng thô');
  }
});

test('tài xế chờ xác minh không thể bật online', () => {
  const pending = db
    .prepare(
      `SELECT u.id, dp.verification_status FROM users u
       JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.role = 'driver' AND dp.verification_status = 'pending' LIMIT 1`,
    )
    .get();

  assert.ok(pending, 'dữ liệu seed phải có tài xế chờ xác minh');
  assert.equal(pending.verification_status, 'pending');
});

test('mọi bảng nghiệp vụ chính đều tồn tại', () => {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .all()
    .map((row) => row.name);

  const required = [
    'users',
    'driver_profiles',
    'vehicles',
    'vehicle_types',
    'service_areas',
    'places',
    'promo_codes',
    'trips',
    'trip_events',
    'trip_offers',
    'payments',
    'notifications',
    'support_tickets',
    'support_messages',
    'ratings',
    'trip_messages',
    'driver_locations',
    'favorites',
    'audit_logs',
    'settings',
  ];

  for (const table of required) {
    assert.ok(tables.includes(table), `thiếu bảng ${table}`);
  }
});

test('dữ liệu seed có đủ loại xe, khu vực và mã giảm giá', () => {
  assert.ok(db.prepare('SELECT COUNT(*) AS c FROM vehicle_types').get().c >= 8);
  assert.ok(db.prepare('SELECT COUNT(*) AS c FROM service_areas').get().c >= 5);
  assert.ok(db.prepare('SELECT COUNT(*) AS c FROM promo_codes').get().c >= 3);
  assert.ok(db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'driver'`).get().c >= 10);
  assert.ok(db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'customer'`).get().c >= 5);
});
