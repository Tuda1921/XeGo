import test from 'node:test';
import assert from 'node:assert/strict';
import { pricing, vehicleTypeByCode, noSurgeDate } from '../test-utils/setup.js';

const sedan = () => vehicleTypeByCode('sedan4');

test('báo giá cơ bản cộng đúng giá mở cửa, quãng đường và thời gian', () => {
  const quote = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 10,
    durationMin: 20,
    scheduledAt: noSurgeDate().toISOString(),
  });

  const type = sedan();
  const expectedSubtotal = type.baseFare + 10 * type.perKm + 20 * type.perMinute;

  assert.equal(quote.subtotal, expectedSubtotal);
  assert.equal(quote.total, expectedSubtotal);
  assert.equal(quote.discount, 0);
  assert.equal(quote.surge, 1);
  assert.equal(quote.currency, 'VND');
  assert.equal(quote.estimated, true);

  const codes = quote.items.map((item) => item.code);
  assert.deepEqual(codes, ['base', 'distance', 'time']);
});

test('hoa hồng và thu nhập tài xế cộng lại bằng tổng tiền', () => {
  const quote = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 12,
    durationMin: 25,
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(quote.commission + quote.driverEarning, quote.total);
  assert.equal(quote.commission, Math.round(quote.total * 0.2));
});

test('áp dụng giá tối thiểu cho chuyến rất ngắn', () => {
  const type = sedan();
  const quote = pricing.quoteTrip({
    vehicleType: type,
    distanceKm: 0.2,
    durationMin: 1,
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(quote.total, type.minFare);
  assert.ok(quote.items.some((item) => item.code === 'min_fare'));
});

test('mã giảm giá phần trăm bị chặn bởi mức giảm tối đa', () => {
  const quote = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 40,
    durationMin: 70,
    promoCode: 'XEGO20',
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(quote.discountCode, 'XEGO20');
  assert.equal(quote.discount, 50000);
  assert.equal(quote.total, quote.subtotal - 50000);
  assert.ok(quote.items.some((item) => item.code === 'discount' && item.amount === -50000));
});

test('mã giảm giá không áp dụng khi chưa đạt giá trị đơn tối thiểu', () => {
  const quote = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 1,
    durationMin: 3,
    promoCode: 'SANBAY50',
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(quote.discount, 0);
  assert.equal(quote.discountCode, null);
});

test('mã giảm giá không tồn tại bị bỏ qua', () => {
  const quote = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 10,
    durationMin: 20,
    promoCode: 'KHONGCOMA',
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(quote.discount, 0);
  assert.equal(quote.discountCode, null);
});

test('phụ phí sân bay và điểm dừng được tính thêm', () => {
  const base = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 8,
    durationMin: 20,
    scheduledAt: noSurgeDate().toISOString(),
  });
  const withExtras = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 8,
    durationMin: 20,
    serviceType: 'airport',
    stops: [{ lat: 10.8, lng: 106.7 }, { lat: 10.81, lng: 106.71 }],
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(withExtras.subtotal, base.subtotal + 20000 + 2 * 20000);
  assert.ok(withExtras.items.some((item) => item.code === 'airport_fee'));
  assert.ok(withExtras.items.some((item) => item.code === 'stops' && item.amount === 40000));
});

test('chặng khứ hồi tính thêm 85% tạm tính', () => {
  const oneWay = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 15,
    durationMin: 30,
    scheduledAt: noSurgeDate().toISOString(),
  });
  const roundTrip = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 15,
    durationMin: 30,
    tripMode: 'round_trip',
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(roundTrip.subtotal, oneWay.subtotal + Math.round(oneWay.subtotal * 0.85));
  assert.ok(roundTrip.items.some((item) => item.code === 'return_leg'));
});

test('thuê theo giờ và theo ngày dùng bảng giá riêng', () => {
  const type = sedan();
  const hourly = pricing.quoteTrip({
    vehicleType: type,
    serviceType: 'hourly',
    hours: 3,
    scheduledAt: noSurgeDate().toISOString(),
  });
  const daily = pricing.quoteTrip({
    vehicleType: type,
    serviceType: 'daily',
    days: 2,
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(hourly.subtotal, 3 * type.hourlyRate);
  assert.equal(daily.subtotal, 2 * type.dailyRate);
  assert.ok(hourly.items.some((item) => item.code === 'hourly'));
  assert.ok(daily.items.some((item) => item.code === 'daily'));
});

test('yêu cầu đặc biệt có phí được cộng vào tạm tính', () => {
  const plain = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 10,
    durationMin: 20,
    scheduledAt: noSurgeDate().toISOString(),
  });
  const withRequests = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 10,
    durationMin: 20,
    specialRequests: ['child_seat', 'pet_friendly', 'quiet_ride'],
    scheduledAt: noSurgeDate().toISOString(),
  });

  assert.equal(withRequests.subtotal, plain.subtotal + 50000 + 20000);
  assert.ok(withRequests.items.some((item) => item.code === 'req_child_seat'));
  assert.ok(!withRequests.items.some((item) => item.code === 'req_quiet_ride'));
});

test('cảnh báo khi số khách hoặc hành lý vượt sức chứa', () => {
  const quote = pricing.quoteTrip({
    vehicleType: sedan(),
    distanceKm: 10,
    durationMin: 20,
    passengers: 6,
    luggage: 5,
    scheduledAt: noSurgeDate().toISOString(),
  });

  const warnings = quote.items.filter((item) => item.warning);
  assert.equal(warnings.length, 2);
  assert.deepEqual(
    warnings.map((item) => item.code).sort(),
    ['luggage_warning', 'seat_warning'],
  );
  assert.equal(warnings.reduce((sum, item) => sum + item.amount, 0), 0);
});

test('hệ số tăng giá đúng theo khung giờ Việt Nam', () => {
  const at = (vnHour, dayOffset = 0) => {
    // 2026-01-05 là thứ Hai; UTC+7 nên trừ 7 giờ để ra giờ UTC tương ứng.
    const utc = Date.UTC(2026, 0, 5 + dayOffset, vnHour - 7, 0, 0);
    return new Date(utc);
  };

  assert.equal(pricing.surgeFor(at(7)).multiplier, 1.15);
  assert.equal(pricing.surgeFor(at(17)).multiplier, 1.2);
  assert.equal(pricing.surgeFor(at(23)).multiplier, 1.1);
  assert.equal(pricing.surgeFor(at(2)).multiplier, 1.1);
  assert.equal(pricing.surgeFor(at(12)).multiplier, 1);
  assert.equal(pricing.surgeFor(at(12, 5)).multiplier, 1.1);
});

test('giá tối thiểu được áp dụng sau khi cộng phụ phí tăng giá', () => {
  const type = sedan();
  const quote = pricing.quoteTrip({
    vehicleType: type,
    distanceKm: 0.1,
    durationMin: 1,
    scheduledAt: new Date(Date.UTC(2026, 0, 5, 10, 0, 0)).toISOString(),
  });

  assert.ok(quote.total >= type.minFare);
  assert.equal(quote.subtotal, type.minFare);
});

test('quoteAllTypes chỉ trả về loại xe đủ chỗ', () => {
  const quotes = pricing.quoteAllTypes({
    distanceKm: 10,
    durationMin: 20,
    passengers: 8,
    scheduledAt: noSurgeDate().toISOString(),
  });

  const types = pricing.getVehicleTypes();
  assert.ok(quotes.length > 0);
  for (const quote of quotes) {
    const type = types.find((item) => item.id === quote.vehicleTypeId);
    assert.ok(type, 'loại xe phải tồn tại');
    assert.ok(type.seats >= 8, `${type.name} phải đủ 8 chỗ`);
  }
  assert.ok(!quotes.some((quote) => quote.vehicleTypeId === vehicleTypeByCode('sedan4').id));
});
