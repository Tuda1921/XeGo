/**
 * Bản port của server/src/services/pricing.js dùng cho bản demo tĩnh trên
 * GitHub Pages. Công thức giữ nguyên 100% để giá hiển thị khớp với backend thật.
 */

export const SPECIAL_REQUESTS = [
  { code: 'child_seat', label: 'Ghế trẻ em', fee: 50000 },
  { code: 'large_luggage', label: 'Khoang hành lý lớn', fee: 30000 },
  { code: 'elderly_support', label: 'Hỗ trợ người cao tuổi', fee: 0 },
  { code: 'pet_friendly', label: 'Cho mang thú cưng', fee: 20000 },
  { code: 'quiet_ride', label: 'Không gian yên tĩnh', fee: 0 },
  { code: 'english_driver', label: 'Tài xế nói tiếng Anh', fee: 40000 },
];

export const PAYMENT_METHODS = [
  { code: 'cash', label: 'Tiền mặt', description: 'Thanh toán trực tiếp cho tài xế khi kết thúc chuyến.' },
  { code: 'bank_transfer', label: 'Chuyển khoản', description: 'Chuyển khoản ngân hàng theo thông tin hiển thị sau chuyến.' },
  { code: 'online', label: 'Ví điện tử / thẻ', description: 'Thanh toán trực tuyến qua cổng thanh toán được cấu hình.' },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function surgeFor(date = new Date()) {
  const vnHour = (date.getUTCHours() + 7) % 24;
  const weekday = new Date(date.getTime() + 7 * 3600_000).getUTCDay();
  let multiplier = 1;
  let label = null;

  if (vnHour >= 6 && vnHour < 9) {
    multiplier = 1.15;
    label = 'Giờ cao điểm buổi sáng';
  } else if (vnHour >= 16 && vnHour < 19) {
    multiplier = 1.2;
    label = 'Giờ cao điểm buổi chiều';
  } else if (vnHour >= 22 || vnHour < 5) {
    multiplier = 1.1;
    label = 'Khung giờ đêm';
  }

  if (weekday === 0 || weekday === 6) {
    multiplier = Math.max(multiplier, 1.1);
    label = label || 'Cuối tuần';
  }

  return { multiplier, label };
}

export function findPromo(promos, code) {
  if (!code) return null;
  const promo = promos.find((p) => String(p.code).toUpperCase() === String(code).trim().toUpperCase());
  if (!promo) return null;
  if (promo.endsAt && new Date(promo.endsAt).getTime() < Date.now()) return null;
  return promo;
}

export function computeDiscount(promo, subtotal) {
  if (!promo) return 0;
  if (subtotal < (promo.minOrder || 0)) return 0;
  let discount = promo.type === 'percent' ? Math.round((subtotal * promo.value) / 100) : promo.value;
  if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  return clamp(discount, 0, subtotal);
}

export function quoteTrip({
  vehicleType,
  promos = [],
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
  commissionRate = 0.2,
}) {
  const items = [];
  const distance = Math.max(0, Number(distanceKm) || 0);
  const duration = Math.max(0, Number(durationMin) || 0);
  const extraStops = Math.max(0, stops?.length || 0);

  let subtotal = 0;

  if (serviceType === 'hourly') {
    const billedHours = Math.max(1, Math.ceil(Number(hours) || 1));
    const amount = billedHours * vehicleType.hourlyRate;
    items.push({ code: 'hourly', label: `Thuê theo giờ (${billedHours} giờ)`, amount });
    subtotal += amount;
  } else if (serviceType === 'daily') {
    const billedDays = Math.max(1, Math.ceil(Number(days) || 1));
    const amount = billedDays * vehicleType.dailyRate;
    items.push({ code: 'daily', label: `Thuê theo ngày (${billedDays} ngày)`, amount });
    subtotal += amount;
  } else {
    items.push({ code: 'base', label: 'Giá mở cửa', amount: vehicleType.baseFare });
    const distanceAmount = Math.round(distance * vehicleType.perKm);
    items.push({ code: 'distance', label: `Quãng đường ${round(distance, 1)} km`, amount: distanceAmount });
    const timeAmount = Math.round(duration * vehicleType.perMinute);
    if (timeAmount > 0) {
      items.push({ code: 'time', label: `Thời gian ${Math.round(duration)} phút`, amount: timeAmount });
    }
    subtotal += vehicleType.baseFare + distanceAmount + timeAmount;
  }

  if (serviceType === 'airport') {
    items.push({ code: 'airport_fee', label: 'Phí ra vào sân bay', amount: 20000 });
    subtotal += 20000;
  }

  if (extraStops > 0) {
    const amount = extraStops * 20000;
    items.push({ code: 'stops', label: `Điểm dừng thêm (${extraStops})`, amount });
    subtotal += amount;
  }

  if (tripMode === 'round_trip') {
    const amount = Math.round(subtotal * 0.85);
    items.push({ code: 'return_leg', label: 'Chặng khứ hồi (giảm 15%)', amount });
    subtotal += amount;
  }

  for (const request of SPECIAL_REQUESTS.filter((r) => specialRequests.includes(r.code))) {
    if (request.fee > 0) {
      items.push({ code: `req_${request.code}`, label: request.label, amount: request.fee });
      subtotal += request.fee;
    }
  }

  if (passengers > vehicleType.seats) {
    items.push({
      code: 'seat_warning',
      label: `Số khách vượt sức chứa (${vehicleType.seats} chỗ)`,
      amount: 0,
      warning: true,
    });
  }
  if (luggage > vehicleType.luggageCapacity) {
    items.push({
      code: 'luggage_warning',
      label: `Hành lý vượt định mức (${vehicleType.luggageCapacity} kiện)`,
      amount: 0,
      warning: true,
    });
  }

  const surge = surgeFor(scheduledAt ? new Date(scheduledAt) : new Date());
  if (surge.multiplier > 1) {
    const amount = Math.round(subtotal * (surge.multiplier - 1));
    items.push({ code: 'surge', label: `${surge.label} (x${surge.multiplier})`, amount });
    subtotal += amount;
  }

  if (subtotal < vehicleType.minFare) {
    const amount = vehicleType.minFare - subtotal;
    items.push({ code: 'min_fare', label: 'Điều chỉnh giá tối thiểu', amount });
    subtotal = vehicleType.minFare;
  }

  const promo = findPromo(promos, promoCode);
  const discount = computeDiscount(promo, subtotal);
  if (discount > 0) {
    items.push({ code: 'discount', label: `Mã ${promo.code}`, amount: -discount });
  }

  const total = Math.max(0, subtotal - discount);
  const commission = Math.round(total * commissionRate);

  return {
    vehicleTypeId: vehicleType.id,
    vehicleTypeName: vehicleType.name,
    currency: 'VND',
    items,
    subtotal,
    discount,
    discountCode: discount > 0 ? promo.code : null,
    total,
    commission,
    driverEarning: total - commission,
    surge: surge.multiplier,
    surgeLabel: surge.label,
    distanceKm: round(distance, 2),
    durationMin: round(duration, 0),
    estimated: true,
    note: 'Giá ước tính, có thể thay đổi nếu lộ trình hoặc thời gian thực tế khác.',
  };
}

export function quoteAllTypes(base, vehicleTypes) {
  return vehicleTypes
    .filter((type) => type.seats >= (base.passengers || 1))
    .map((type) => quoteTrip({ ...base, vehicleType: type }));
}
