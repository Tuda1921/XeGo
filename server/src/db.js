import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(config.dataDir, { recursive: true });

const dbFile = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE)
  : path.join(config.dataDir, 'xego.db');

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

export const tx = (fn) => db.transaction(fn);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), new Date().toISOString());
  return value;
}

export function audit({ actorId = null, actorRole = null, action, entity = null, entityId = null, meta = {}, ip = null }) {
  db.prepare(
    `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, meta, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(actorId, actorRole, action, entity, entityId === null ? null : String(entityId), JSON.stringify(meta), ip, new Date().toISOString());
}

export { dbFile };
