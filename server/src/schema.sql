-- XeGo database schema (SQLite)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL CHECK (role IN ('customer','driver','admin','operator')),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  email         TEXT,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  phone_verified INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'login',
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, purpose);

CREATE TABLE IF NOT EXISTS operators (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  commission_rate REAL NOT NULL DEFAULT 0.2,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  seats            INTEGER NOT NULL,
  description      TEXT,
  icon             TEXT,
  base_fare        INTEGER NOT NULL DEFAULT 0,
  per_km           INTEGER NOT NULL DEFAULT 0,
  per_minute       INTEGER NOT NULL DEFAULT 0,
  min_fare         INTEGER NOT NULL DEFAULT 0,
  hourly_rate      INTEGER NOT NULL DEFAULT 0,
  daily_rate       INTEGER NOT NULL DEFAULT 0,
  luggage_capacity INTEGER NOT NULL DEFAULT 2,
  tier             TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard','premium')),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_areas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  province   TEXT,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  radius_km  REAL NOT NULL DEFAULT 40,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  operator_id         INTEGER REFERENCES operators(id),
  license_number      TEXT,
  license_expiry      TEXT,
  license_image_url   TEXT,
  id_card_number      TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
                      CHECK (verification_status IN ('pending','approved','rejected')),
  verification_note   TEXT,
  verified_at         TEXT,
  verified_by         INTEGER,
  rating              REAL NOT NULL DEFAULT 5,
  rating_count        INTEGER NOT NULL DEFAULT 0,
  trips_completed     INTEGER NOT NULL DEFAULT 0,
  trips_cancelled     INTEGER NOT NULL DEFAULT 0,
  online_status       TEXT NOT NULL DEFAULT 'offline'
                      CHECK (online_status IN ('offline','online','paused','on_trip')),
  current_lat         REAL,
  current_lng         REAL,
  location_updated_at TEXT,
  service_area        TEXT,
  bio                 TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_driver_status ON driver_profiles(online_status, verification_status);

CREATE TABLE IF NOT EXISTS vehicles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operator_id     INTEGER REFERENCES operators(id),
  vehicle_type_id INTEGER NOT NULL REFERENCES vehicle_types(id),
  plate           TEXT NOT NULL,
  brand           TEXT,
  model           TEXT,
  color           TEXT,
  year            INTEGER,
  seats           INTEGER NOT NULL,
  image_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver ON vehicles(driver_id);

CREATE TABLE IF NOT EXISTS places (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  address    TEXT NOT NULL,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('home','work','other')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_places_user ON places(user_id);

CREATE TABLE IF NOT EXISTS promo_codes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  description  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value        INTEGER NOT NULL,
  min_order    INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  usage_limit  INTEGER,
  used_count   INTEGER NOT NULL DEFAULT 0,
  starts_at    TEXT,
  ends_at      TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  customer_id      INTEGER NOT NULL REFERENCES users(id),
  driver_id        INTEGER REFERENCES users(id),
  vehicle_id       INTEGER REFERENCES vehicles(id),
  vehicle_type_id  INTEGER NOT NULL REFERENCES vehicle_types(id),
  operator_id      INTEGER REFERENCES operators(id),
  status           TEXT NOT NULL DEFAULT 'searching'
                   CHECK (status IN ('scheduled','searching','assigned','arrived','in_progress','completed','cancelled','no_driver')),
  service_type     TEXT NOT NULL DEFAULT 'ride'
                   CHECK (service_type IN ('ride','hourly','daily','airport','intercity')),
  trip_mode        TEXT NOT NULL DEFAULT 'one_way' CHECK (trip_mode IN ('one_way','round_trip')),
  schedule_type    TEXT NOT NULL DEFAULT 'now' CHECK (schedule_type IN ('now','scheduled')),
  scheduled_at     TEXT,
  return_at        TEXT,
  pickup_label     TEXT NOT NULL,
  pickup_address   TEXT NOT NULL,
  pickup_lat       REAL NOT NULL,
  pickup_lng       REAL NOT NULL,
  dropoff_label    TEXT NOT NULL,
  dropoff_address  TEXT NOT NULL,
  dropoff_lat      REAL NOT NULL,
  dropoff_lng      REAL NOT NULL,
  stops            TEXT NOT NULL DEFAULT '[]',
  distance_km      REAL NOT NULL DEFAULT 0,
  duration_min     REAL NOT NULL DEFAULT 0,
  passengers       INTEGER NOT NULL DEFAULT 1,
  luggage          INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  special_requests TEXT NOT NULL DEFAULT '[]',
  payment_method   TEXT NOT NULL DEFAULT 'cash'
                   CHECK (payment_method IN ('cash','bank_transfer','online')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid','pending','paid','refunded','failed')),
  price_breakdown  TEXT NOT NULL DEFAULT '{}',
  estimated_price  INTEGER NOT NULL DEFAULT 0,
  final_price      INTEGER,
  discount_code    TEXT,
  discount_amount  INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  driver_earning   INTEGER NOT NULL DEFAULT 0,
  share_token      TEXT UNIQUE,
  cancel_reason    TEXT,
  cancelled_by     TEXT,
  search_round     INTEGER NOT NULL DEFAULT 0,
  offer_expires_at TEXT,
  rating           INTEGER,
  review           TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  accepted_at      TEXT,
  arrived_at       TEXT,
  started_at       TEXT,
  completed_at     TEXT,
  cancelled_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_trips_customer ON trips(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status, scheduled_at);

CREATE TABLE IF NOT EXISTS trip_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  actor_id   INTEGER,
  actor_role TEXT,
  meta       TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_events_trip ON trip_events(trip_id, id);

CREATE TABLE IF NOT EXISTS trip_offers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  driver_id    INTEGER NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','expired','superseded')),
  round        INTEGER NOT NULL DEFAULT 1,
  distance_km  REAL,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  responded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_offers_driver ON trip_offers(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_trip ON trip_offers(trip_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  method       TEXT NOT NULL,
  amount       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','paid','refunded','failed')),
  provider     TEXT,
  provider_ref TEXT,
  paid_at      TEXT,
  refunded_at  TEXT,
  meta         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_trip ON payments(trip_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  read_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  trip_id     INTEGER REFERENCES trips(id),
  category    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','in_progress','resolved','closed')),
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL,
  sender_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL,
  to_user_id   INTEGER NOT NULL,
  role         TEXT NOT NULL,
  stars        INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment      TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL,
  UNIQUE (trip_id, from_user_id)
);

CREATE TABLE IF NOT EXISTS trip_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL,
  sender_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trip_messages ON trip_messages(trip_id, id);

CREATE TABLE IF NOT EXISTS driver_locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  heading     REAL,
  speed       REAL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_driver_locations ON driver_locations(driver_id, id DESC);

CREATE TABLE IF NOT EXISTS favorites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  UNIQUE (customer_id, driver_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER,
  actor_role TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  meta       TEXT NOT NULL DEFAULT '{}',
  ip         TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
