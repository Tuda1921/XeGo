import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { config, isDemoSms } from '../config.js';
import {
  asyncHandler,
  badRequest,
  conflict,
  normalizePhone,
  nowIso,
  otpCode,
  unauthorized,
} from '../utils.js';
import { publicUser, requireAuth, signToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/common.js';
import { notify } from '../services/notifications.js';

export const authRouter = Router();

const OTP_TTL_MINUTES = 5;

function issueOtp(phone, purpose) {
  const code = otpCode();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  db.prepare(
    `INSERT INTO otp_codes (phone, code, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(phone, code, purpose, expiresAt, createdAt);

  if (isDemoSms()) {
    console.log(`[OTP DEMO] ${phone} -> ${code} (hết hạn sau ${OTP_TTL_MINUTES} phút)`);
  }
  return { code, expiresAt };
}

function verifyOtp(phone, code, purpose) {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE phone = ? AND purpose = ? AND consumed_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(phone, purpose);
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  if (row.code !== String(code)) return false;
  db.prepare('UPDATE otp_codes SET consumed_at = ? WHERE id = ?').run(nowIso(), row.id);
  return true;
}

authRouter.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const { name, phone, password, email, role = 'customer' } = req.body || {};
    const normalized = normalizePhone(phone);

    if (!name || String(name).trim().length < 2) throw badRequest('Vui lòng nhập họ tên');
    if (!/^0\d{9,10}$/.test(normalized)) throw badRequest('Số điện thoại không hợp lệ');
    if (!password || String(password).length < 6) {
      throw badRequest('Mật khẩu cần ít nhất 6 ký tự');
    }
    if (!['customer', 'driver'].includes(role)) {
      throw badRequest('Chỉ có thể đăng ký tài khoản khách hàng hoặc tài xế');
    }

    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(normalized);
    if (existing) throw conflict('Số điện thoại đã được đăng ký');

    const now = nowIso();
    const hash = await bcrypt.hash(String(password), 10);

    const info = db
      .prepare(
        `INSERT INTO users (role, name, phone, email, password_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .run(role, String(name).trim(), normalized, email || null, hash, now, now);

    const userId = Number(info.lastInsertRowid);

    if (role === 'driver') {
      db.prepare(
        `INSERT INTO driver_profiles (user_id, verification_status, online_status, created_at, updated_at)
         VALUES (?, 'pending', 'offline', ?, ?)`,
      ).run(userId, now, now);
    }

    notify(userId, {
      type: 'welcome',
      title: 'Chào mừng đến với XeGo',
      body:
        role === 'driver'
          ? 'Hồ sơ tài xế của bạn đang chờ xác minh. Vui lòng bổ sung giấy tờ và phương tiện.'
          : 'Bạn đã sẵn sàng đặt chuyến xe đầu tiên.',
      data: {},
    });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 20 }),
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body || {};
    const normalized = normalizePhone(phone);
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(normalized);
    if (!user) throw unauthorized('Số điện thoại hoặc mật khẩu không đúng');
    if (user.status !== 'active') throw unauthorized('Tài khoản đã bị tạm khóa');

    const ok = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!ok) throw unauthorized('Số điện thoại hoặc mật khẩu không đúng');

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso(), user.id);
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

authRouter.post(
  '/otp/request',
  rateLimit({ windowMs: 60_000, max: 5 }),
  asyncHandler(async (req, res) => {
    const { phone, purpose = 'login' } = req.body || {};
    const normalized = normalizePhone(phone);
    if (!/^0\d{9,10}$/.test(normalized)) throw badRequest('Số điện thoại không hợp lệ');

    const { expiresAt } = issueOtp(normalized, purpose);
    res.json({
      ok: true,
      expiresAt,
      demo: isDemoSms(),
      message: isDemoSms()
        ? 'Chế độ mô phỏng: mã OTP đã được in ở log server (không gửi SMS thật).'
        : 'Mã OTP đã được gửi tới số điện thoại của bạn.',
    });
  }),
);

authRouter.post(
  '/otp/verify',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req, res) => {
    const { phone, code, name, role = 'customer' } = req.body || {};
    const normalized = normalizePhone(phone);
    if (!verifyOtp(normalized, code, 'login')) throw badRequest('Mã OTP không đúng hoặc đã hết hạn');

    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(normalized);
    if (!user) {
      if (!['customer', 'driver'].includes(role)) throw badRequest('Vai trò không hợp lệ');
      const now = nowIso();
      const hash = await bcrypt.hash(`otp-${normalized}-${Date.now()}`, 10);
      const info = db
        .prepare(
          `INSERT INTO users (role, name, phone, password_hash, status, phone_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', 1, ?, ?)`,
        )
        .run(role, name || `Khách ${normalized.slice(-4)}`, normalized, hash, now, now);
      const userId = Number(info.lastInsertRowid);
      if (role === 'driver') {
        db.prepare(
          `INSERT INTO driver_profiles (user_id, verification_status, online_status, created_at, updated_at)
           VALUES (?, 'pending', 'offline', ?, ?)`,
        ).run(userId, now, now);
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
      db.prepare('UPDATE users SET phone_verified = 1, last_login_at = ? WHERE id = ?').run(
        nowIso(),
        user.id,
      );
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const payload = { user: publicUser(user) };

    if (user.role === 'driver') {
      const profile = db.prepare('SELECT * FROM driver_profiles WHERE user_id = ?').get(user.id);
      const vehicles = db
        .prepare(
          `SELECT v.*, vt.name AS type_name FROM vehicles v
           JOIN vehicle_types vt ON vt.id = v.vehicle_type_id WHERE v.driver_id = ?`,
        )
        .all(user.id);
      payload.driverProfile = profile
        ? {
            verificationStatus: profile.verification_status,
            verificationNote: profile.verification_note,
            onlineStatus: profile.online_status,
            rating: profile.rating,
            ratingCount: profile.rating_count,
            tripsCompleted: profile.trips_completed,
            tripsCancelled: profile.trips_cancelled,
            licenseNumber: profile.license_number,
            licenseExpiry: profile.license_expiry,
            idCardNumber: profile.id_card_number,
            serviceArea: profile.service_area,
            bio: profile.bio,
            currentLocation:
              profile.current_lat !== null
                ? { lat: profile.current_lat, lng: profile.current_lng, updatedAt: profile.location_updated_at }
                : null,
          }
        : null;
      payload.vehicles = vehicles.map((v) => ({
        id: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        color: v.color,
        year: v.year,
        seats: v.seats,
        imageUrl: v.image_url,
        status: v.status,
        vehicleTypeId: v.vehicle_type_id,
        typeName: v.type_name,
      }));
    }

    res.json(payload);
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, email, avatarUrl } = req.body || {};
    const fields = [];
    const values = [];
    if (name !== undefined) {
      if (String(name).trim().length < 2) throw badRequest('Họ tên quá ngắn');
      fields.push('name = ?');
      values.push(String(name).trim());
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email || null);
    }
    if (avatarUrl !== undefined) {
      fields.push('avatar_url = ?');
      values.push(avatarUrl || null);
    }
    if (!fields.length) throw badRequest('Không có thông tin cần cập nhật');

    fields.push('updated_at = ?');
    values.push(nowIso(), req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      throw badRequest('Mật khẩu mới cần ít nhất 6 ký tự');
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const ok = await bcrypt.compare(String(currentPassword || ''), user.password_hash);
    if (!ok) throw badRequest('Mật khẩu hiện tại không đúng');

    const hash = await bcrypt.hash(String(newPassword), 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      hash,
      nowIso(),
      user.id,
    );
    res.json({ ok: true });
  }),
);

export { config };
