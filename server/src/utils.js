import crypto from 'node:crypto';

export const nowIso = () => new Date().toISOString();

export const addMinutes = (date, minutes) =>
  new Date(new Date(date).getTime() + minutes * 60_000).toISOString();

export const addSeconds = (date, seconds) =>
  new Date(new Date(date).getTime() + seconds * 1000).toISOString();

export const toRad = (deg) => (deg * Math.PI) / 180;

/** Khoảng cách đường chim bay (km). */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Mã chuyến dễ đọc: XG-YYMMDD-XXXX */
export function tripCode() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `XG-${stamp}-${rand}`;
}

export const shareToken = () => crypto.randomBytes(16).toString('hex');

export const ticketCode = () =>
  `HT-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;

export const otpCode = () => String(crypto.randomInt(100000, 999999));

export function normalizePhone(input) {
  if (!input) return '';
  const digits = String(input).replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) return `0${digits.slice(3)}`;
  if (digits.startsWith('84') && digits.length > 9) return `0${digits.slice(2)}`;
  return digits;
}

export const isValidPhone = (phone) => /^0\d{9,10}$/.test(normalizePhone(phone));

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Bạn cần đăng nhập') => new HttpError(401, message);
export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này') =>
  new HttpError(403, message);
export const notFound = (message = 'Không tìm thấy dữ liệu') => new HttpError(404, message);
export const conflict = (message, details) => new HttpError(409, message, details);

export const parseJson = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const pick = (obj, keys) => {
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
};

export const isFiniteNumber = (value) =>
  value !== null && value !== '' && Number.isFinite(Number(value));

export const toNumber = (value, fallback = 0) =>
  isFiniteNumber(value) ? Number(value) : fallback;
