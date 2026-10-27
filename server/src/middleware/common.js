import { config, isDemoPayment, isDemoSms } from '../config.js';

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, err);
  }
  res.status(status).json({
    error: {
      message: err.message || 'Đã có lỗi xảy ra',
      details: err.details || null,
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Không tìm thấy endpoint' } });
}

/** Giới hạn tần suất đơn giản trong bộ nhớ, đủ cho một tiến trình đơn. */
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60, key = (req) => req.ip } = {}) {
  return (req, res, next) => {
    const bucketKey = `${req.path}:${key(req)}`;
    const now = Date.now();
    const entry = buckets.get(bucketKey);
    if (!entry || now - entry.start > windowMs) {
      buckets.set(bucketKey, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        error: { message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' },
      });
    }
    return next();
  };
}

export function integrationStatus() {
  return {
    maps: {
      provider: 'OpenStreetMap (Nominatim + OSRM)',
      mode: 'live',
      configured: true,
      note: 'Dùng dịch vụ công khai miễn phí. Với lưu lượng thật, cấu hình GEOCODER_URL/ROUTER_URL riêng.',
    },
    payments: {
      provider: config.payment.provider,
      mode: isDemoPayment() ? 'demo' : 'live',
      demo: isDemoPayment(),
      configured: !isDemoPayment() && Boolean(config.payment.merchantId),
      note: isDemoPayment()
        ? 'Chế độ mô phỏng: thanh toán online được ghi nhận nhưng KHÔNG trừ tiền thật.'
        : 'Đã cấu hình cổng thanh toán.',
    },
    sms: {
      provider: config.sms.provider,
      mode: isDemoSms() ? 'demo' : 'live',
      demo: isDemoSms(),
      configured: !isDemoSms() && Boolean(config.sms.apiKey),
      note: isDemoSms()
        ? 'Chế độ mô phỏng: mã OTP được in ra log server, không gửi SMS thật.'
        : 'Đã cấu hình nhà cung cấp SMS.',
    },
    push: {
      provider: 'web (in-app)',
      mode: 'live',
      configured: true,
      note: 'Thông báo trong ứng dụng hoạt động thật qua Socket.IO. Push notification cần thêm VAPID key.',
    },
  };
}
