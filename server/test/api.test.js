import test from 'node:test';
import assert from 'node:assert/strict';
import { db, userByPhone, resetTrips, PICKUP, DROPOFF, pricing, vehicleTypeByCode, noSurgeDate } from '../test-utils/setup.js';

const { server } = await import('../src/index.js');

await new Promise((resolve) => {
  if (server.listening) return resolve();
  server.once('listening', resolve);
  return undefined;
});

const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

async function login(phone, password) {
  const res = await api('/api/auth/login', { method: 'POST', body: { phone, password } });
  assert.equal(res.status, 200, `đăng nhập ${phone} phải thành công: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

test.beforeEach(() => {
  resetTrips();
});

test('health check trả về ok', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('đăng nhập sai mật khẩu bị từ chối', async () => {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '0901234567', password: 'sai-mat-khau' },
  });
  assert.equal(res.status, 401);
  assert.ok(res.body.error?.message);
});

test('đăng nhập đúng trả về token và thông tin người dùng', async () => {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: '0901234567', password: 'customer123' },
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, 'customer');
  assert.equal(res.body.user.phone, '0901234567');
  assert.equal(res.body.user.password_hash, undefined);
});

test('gọi API cần đăng nhập mà không có token trả 401', async () => {
  const res = await api('/api/trips');
  assert.equal(res.status, 401);
});

test('khách hàng gọi API quản trị bị chặn 403', async () => {
  const token = await login('0901234567', 'customer123');
  const res = await api('/api/admin/overview', { token });
  assert.equal(res.status, 403);
});

test('tài xế gọi API quản trị bị chặn 403', async () => {
  const token = await login('0901111222', 'driver123');
  const res = await api('/api/admin/overview', { token });
  assert.equal(res.status, 403);
});

test('admin truy cập được tổng quan và báo cáo', async () => {
  const token = await login('0900000001', 'admin123');

  const overview = await api('/api/admin/overview', { token });
  assert.equal(overview.status, 200);
  assert.ok(overview.body.overview || overview.body.stats || overview.body);

  const reports = await api('/api/admin/reports?days=7', { token });
  assert.equal(reports.status, 200);
  assert.equal(reports.body.days, 7);
  assert.ok(Array.isArray(reports.body.daily));
});

test('danh mục công khai trả về loại xe và khu vực', async () => {
  const types = await api('/api/vehicle-types');
  assert.equal(types.status, 200);
  assert.ok(Array.isArray(types.body.vehicleTypes));
  assert.ok(types.body.vehicleTypes.length >= 8);

  const areas = await api('/api/service-areas');
  assert.equal(areas.status, 200);
  assert.ok(Array.isArray(areas.body.serviceAreas));
});

test('báo giá qua API khớp với tính toán nội bộ', async () => {
  const sedan = vehicleTypeByCode('sedan4');
  const res = await api('/api/quote', {
    method: 'POST',
    body: {
      vehicleTypeId: sedan.id,
      pickup: PICKUP,
      dropoff: DROPOFF,
      distanceKm: 7.5,
      durationMin: 20,
    },
  });

  assert.equal(res.status, 200);
  const quote = res.body.quote;
  assert.ok(quote.total > 0);
  assert.equal(quote.commission + quote.driverEarning, quote.total);
  assert.ok(Array.isArray(quote.items));
});

test('báo giá thiếu loại xe bị từ chối 400', async () => {
  const res = await api('/api/quote', {
    method: 'POST',
    body: { pickup: PICKUP, dropoff: DROPOFF, distanceKm: 5, durationMin: 15 },
  });
  assert.equal(res.status, 400);
});

test('luồng đặt xe qua HTTP: tạo chuyến, tài xế nhận, hoàn thành, đánh giá', async () => {
  const customerToken = await login('0901234567', 'customer123');
  const driverToken = await login('0901111222', 'driver123');

  const driver = userByPhone('0901111222');
  db.prepare(
    `UPDATE driver_profiles SET online_status = 'online', current_lat = 10.7769, current_lng = 106.7009,
       verification_status = 'approved', updated_at = ? WHERE user_id = ?`,
  ).run(new Date().toISOString(), driver.id);

  const sedan = vehicleTypeByCode('sedan4');
  const quote = pricing.quoteTrip({
    vehicleType: sedan,
    distanceKm: 7.5,
    durationMin: 20,
    scheduledAt: noSurgeDate().toISOString(),
  });

  const created = await api('/api/trips', {
    method: 'POST',
    token: customerToken,
    body: {
      vehicleTypeId: sedan.id,
      pickup: PICKUP,
      dropoff: DROPOFF,
      distanceKm: 7.5,
      durationMin: 20,
      passengers: 1,
      paymentMethod: 'cash',
      quote,
    },
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  const trip = created.body.trip;
  assert.equal(trip.status, 'searching');
  assert.ok(trip.code.startsWith('XG-'));

  const offers = await api('/api/driver/offers', { token: driverToken });
  assert.equal(offers.status, 200);
  const offer = offers.body.offers.find((item) => item.trip.id === trip.id);
  assert.ok(offer, 'tài xế phải nhận được lời mời');

  const accepted = await api(`/api/driver/offers/${offer.offerId}/accept`, {
    method: 'POST',
    token: driverToken,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.trip.status, 'assigned');

  for (const step of ['arrived', 'start', 'complete']) {
    const res = await api(`/api/driver/trips/${trip.id}/${step}`, {
      method: 'POST',
      token: driverToken,
    });
    assert.equal(res.status, 200, `${step}: ${JSON.stringify(res.body)}`);
  }

  const detail = await api(`/api/trips/${trip.id}`, { token: customerToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.trip.status, 'completed');
  assert.equal(detail.body.trip.paymentStatus, 'paid');

  const rated = await api(`/api/trips/${trip.id}/rate`, {
    method: 'POST',
    token: customerToken,
    body: { stars: 5, comment: 'Chuyến đi tốt' },
  });
  assert.equal(rated.status, 200);
  assert.equal(rated.body.trip.rating, 5);

  const receipt = await api(`/api/trips/${trip.id}/receipt`, { token: customerToken });
  assert.equal(receipt.status, 200);
  assert.equal(receipt.body.receipt.amount, trip.estimatedPrice);
});

test('khách không xem được chuyến của người khác', async () => {
  const ownerToken = await login('0901234567', 'customer123');
  const otherToken = await login('0987654321', 'customer123');

  const sedan = vehicleTypeByCode('sedan4');
  const quote = pricing.quoteTrip({
    vehicleType: sedan,
    distanceKm: 5,
    durationMin: 15,
    scheduledAt: noSurgeDate().toISOString(),
  });

  const created = await api('/api/trips', {
    method: 'POST',
    token: ownerToken,
    body: {
      vehicleTypeId: sedan.id,
      pickup: PICKUP,
      dropoff: DROPOFF,
      distanceKm: 5,
      durationMin: 15,
      quote,
    },
  });
  assert.equal(created.status, 201);

  const res = await api(`/api/trips/${created.body.trip.id}`, { token: otherToken });
  assert.equal(res.status, 403);
});

test('chia sẻ chuyến công khai che số điện thoại', async () => {
  const customerToken = await login('0901234567', 'customer123');
  const sedan = vehicleTypeByCode('sedan4');
  const quote = pricing.quoteTrip({
    vehicleType: sedan,
    distanceKm: 5,
    durationMin: 15,
    scheduledAt: noSurgeDate().toISOString(),
  });

  const created = await api('/api/trips', {
    method: 'POST',
    token: customerToken,
    body: {
      vehicleTypeId: sedan.id,
      pickup: PICKUP,
      dropoff: DROPOFF,
      distanceKm: 5,
      durationMin: 15,
      quote,
    },
  });

  const detail = await api(`/api/trips/${created.body.trip.id}`, { token: customerToken });
  const token = detail.body.trip.shareToken;
  assert.ok(token, 'chuyến phải có token chia sẻ');

  const shared = await api(`/api/public/trips/${token}`);
  assert.equal(shared.status, 200);
  assert.ok(shared.body.trip);
  assert.ok(!shared.body.trip.customerPhone, 'không được lộ số điện thoại khách');
  assert.ok(!shared.body.trip.driverPhone, 'không được lộ số điện thoại tài xế');
});

test('token chia sẻ không tồn tại trả 404', async () => {
  const res = await api('/api/public/trips/khong-ton-tai');
  assert.equal(res.status, 404);
});

test('tài xế chưa xác minh không bật được online', async () => {
  const pending = db
    .prepare(
      `SELECT u.phone FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE dp.verification_status = 'pending' LIMIT 1`,
    )
    .get();
  assert.ok(pending, 'cần có tài xế chờ xác minh trong seed');

  const token = await login(pending.phone, 'driver123');
  const res = await api('/api/driver/status', {
    method: 'POST',
    token,
    body: { status: 'online' },
  });

  assert.equal(res.status, 403);
});

test('tài xế đã xác minh bật/tắt online được', async () => {
  const token = await login('0901111222', 'driver123');

  const online = await api('/api/driver/status', {
    method: 'POST',
    token,
    body: { status: 'online' },
  });
  assert.equal(online.status, 200);

  const offline = await api('/api/driver/status', {
    method: 'POST',
    token,
    body: { status: 'offline' },
  });
  assert.equal(offline.status, 200);
});

test('admin xác minh tài xế và ghi audit log', async () => {
  const adminToken = await login('0900000001', 'admin123');
  const pending = db
    .prepare(
      `SELECT u.id FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE dp.verification_status = 'pending' LIMIT 1`,
    )
    .get();

  const res = await api(`/api/admin/drivers/${pending.id}/verify`, {
    method: 'POST',
    token: adminToken,
    body: { approved: true, note: 'Giấy tờ hợp lệ' },
  });
  assert.equal(res.status, 200);

  const logs = await api('/api/admin/audit', { token: adminToken });
  assert.equal(logs.status, 200);
  assert.ok(logs.body.logs.length > 0);
});

test('admin cập nhật cài đặt hệ thống', async () => {
  const adminToken = await login('0900000001', 'admin123');

  const before = await api('/api/admin/settings', { token: adminToken });
  assert.equal(before.status, 200);
  assert.ok(before.body.settings);

  const res = await api('/api/admin/settings', {
    method: 'PATCH',
    token: adminToken,
    body: { supportPhone: '1900 1234' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.settings.supportPhone, '1900 1234');
});

test('khách tạo và xem yêu cầu hỗ trợ', async () => {
  const token = await login('0901234567', 'customer123');

  const created = await api('/api/support/tickets', {
    method: 'POST',
    token,
    body: {
      category: 'payment',
      subject: 'Chưa nhận được biên nhận',
      description: 'Tôi đã hoàn thành chuyến nhưng chưa thấy biên nhận trong ứng dụng.',
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.ok(created.body.ticket.code);

  const list = await api('/api/support/tickets', { token });
  assert.equal(list.status, 200);
  assert.ok(list.body.tickets.some((ticket) => ticket.id === created.body.ticket.id));
});

test('endpoint không tồn tại trả 404 JSON', async () => {
  const res = await api('/api/khong-ton-tai');
  assert.equal(res.status, 404);
  assert.ok(res.body.error?.message);
});
