import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { forbidden, unauthorized } from '../utils.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function loadUser(id) {
  return db
    .prepare(
      `SELECT id, role, name, phone, email, avatar_url, status, phone_verified, created_at
       FROM users WHERE id = ?`,
    )
    .get(id);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    status: row.status,
    phoneVerified: Boolean(row.phone_verified),
    createdAt: row.created_at,
  };
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = loadUser(payload.sub);
    if (user && user.status === 'active') req.user = user;
  } catch {
    // token không hợp lệ -> coi như chưa đăng nhập
  }
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };
}

export const requireAdmin = requireRole('admin', 'operator');
export const requireDriver = requireRole('driver');
export const requireCustomer = requireRole('customer');
