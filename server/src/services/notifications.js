import { db } from '../db.js';
import { nowIso } from '../utils.js';
import { emitToUser, emitToAdmins } from './realtime.js';

/**
 * Gửi thông báo trong ứng dụng (lưu DB + đẩy realtime).
 * Push/SMS/email là kênh mở rộng: xem docs/INTEGRATIONS.md.
 */
export function notify(userId, { type, title, body, data = {} }) {
  if (!userId) return null;
  const createdAt = nowIso();
  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, body, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, type, title, body, JSON.stringify(data), createdAt);

  const notification = {
    id: info.lastInsertRowid,
    userId,
    type,
    title,
    body,
    data,
    readAt: null,
    createdAt,
  };

  emitToUser(userId, 'notification', notification);
  return notification;
}

export function notifyAdmins(payload) {
  const admins = db.prepare("SELECT id FROM users WHERE role IN ('admin','operator')").all();
  for (const admin of admins) notify(admin.id, payload);
  emitToAdmins('admin:notification', payload);
}

export function listNotifications(userId, { limit = 30, unreadOnly = false } = {}) {
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''}
       ORDER BY id DESC LIMIT ?`,
    )
    .all(userId, limit);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: JSON.parse(row.data || '{}'),
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export function markRead(userId, ids = null) {
  if (ids && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND id IN (${placeholders}) AND read_at IS NULL`,
    ).run(nowIso(), userId, ...ids);
  } else {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(
      nowIso(),
      userId,
    );
  }
}

export function unreadCount(userId) {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .get(userId);
  return row.c;
}
