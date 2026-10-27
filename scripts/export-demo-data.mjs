/**
 * Captures authentic API responses from a running XeGo server so the static
 * GitHub Pages demo can replay them without a backend.
 *
 * Usage: node scripts/export-demo-data.mjs [baseUrl] [outFile]
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:4000';
const OUT = process.argv[3] || path.resolve('web/src/demo/data.json');

const tokens = {};

async function call(method, url, { body, token } = {}) {
  const res = await fetch(`${BASE}/api${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function login(phone, password) {
  const data = await call('POST', '/auth/login', { body: { phone, password } });
  return data.token;
}

const ACCOUNTS = {
  admin: ['0900000001', 'admin123'],
  operator: ['0900000002', 'operator123'],
  customer: ['0901234567', 'customer123'],
  driver: ['0901111222', 'driver123'],
};

const out = { generatedAt: new Date().toISOString(), accounts: {}, public: {}, customer: {}, driver: {}, admin: {} };

for (const [role, [phone, password]] of Object.entries(ACCOUNTS)) {
  tokens[role] = await login(phone, password);
  out.accounts[role] = { phone, password };
}

// ---- public / catalog -------------------------------------------------------
out.public.config = await call('GET', '/public/config');
out.public.vehicleTypes = await call('GET', '/vehicle-types');
out.public.options = await call('GET', '/options');
out.public.serviceAreas = await call('GET', '/service-areas');
out.public.promos = await call('GET', '/promos');
out.public.places = await call('GET', '/places/search?q=');

// Bộ địa điểm nội bộ dùng cho tìm kiếm offline trong bản demo tĩnh.
const { LOCAL_PLACES } = await import('../server/src/data/places-vn.js');
out.public.localPlaces = LOCAL_PLACES;

// ---- customer ---------------------------------------------------------------
const c = tokens.customer;
out.public.faq = await call('GET', '/support/faq', { token: c });
out.customer.me = await call('GET', '/auth/me', { token: c });
out.customer.trips = await call('GET', '/trips', { token: c });
out.customer.active = await call('GET', '/trips/active', { token: c });
out.customer.notifications = await call('GET', '/notifications', { token: c });
out.customer.favorites = await call('GET', '/favorites', { token: c });
out.customer.places = await call('GET', '/places', { token: c });
out.customer.tickets = await call('GET', '/support/tickets', { token: c });

// ---- driver -----------------------------------------------------------------
const d = tokens.driver;
out.driver.me = await call('GET', '/auth/me', { token: d });
out.driver.stats = await call('GET', '/driver/stats', { token: d });
out.driver.earnings = {
  day: await call('GET', '/driver/earnings?period=day', { token: d }),
  week: await call('GET', '/driver/earnings?period=week', { token: d }),
  month: await call('GET', '/driver/earnings?period=month', { token: d }),
};
out.driver.offers = await call('GET', '/driver/offers', { token: d });

// ---- admin ------------------------------------------------------------------
const a = tokens.admin;
out.admin.me = await call('GET', '/auth/me', { token: a });
out.admin.overview = await call('GET', '/admin/overview', { token: a });
out.admin.trips = await call('GET', '/admin/trips', { token: a });
out.admin.live = await call('GET', '/admin/trips/live', { token: a });
out.admin.drivers = await call('GET', '/admin/drivers', { token: a });
out.admin.customers = await call('GET', '/admin/customers', { token: a });
out.admin.vehicles = await call('GET', '/admin/vehicles', { token: a });
out.admin.vehicleTypes = await call('GET', '/admin/vehicle-types', { token: a });
out.admin.promos = await call('GET', '/admin/promos', { token: a });
out.admin.payments = await call('GET', '/admin/payments', { token: a });
out.admin.tickets = await call('GET', '/admin/tickets', { token: a });
out.admin.audit = await call('GET', '/admin/audit', { token: a });
out.admin.settings = await call('GET', '/admin/settings', { token: a });
out.admin.operators = await call('GET', '/admin/operators', { token: a });
out.admin.reports = {
  7: await call('GET', '/admin/reports?days=7', { token: a }),
  30: await call('GET', '/admin/reports?days=30', { token: a }),
};

// ---- operator ---------------------------------------------------------------
const op = tokens.operator;
out.operator = { me: await call('GET', '/auth/me', { token: op }) };

// ---- trip detail + receipt + share token ------------------------------------
const completed = (out.customer.trips.trips || []).find((t) => t.status === 'completed');
if (completed) {
  out.customer.tripDetail = await call('GET', `/trips/${completed.id}`, { token: c });
  out.customer.receipt = await call('GET', `/trips/${completed.id}/receipt`, { token: c });
  if (completed.shareToken) {
    out.public.sharedTrip = await call('GET', `/public/trips/${completed.shareToken}`);
  }
}

// ---- quote samples ----------------------------------------------------------
const sedan = (out.public.vehicleTypes.vehicleTypes || []).find((v) => v.code === 'sedan4');
if (sedan) {
  out.public.quoteSample = await call('POST', '/quote', {
    body: {
      vehicleTypeId: sedan.id,
      pickup: { label: 'Chợ Bến Thành', lat: 10.7725, lng: 106.698 },
      dropoff: { label: 'Sân bay Tân Sơn Nhất', lat: 10.8188, lng: 106.652 },
      distanceKm: 8.4,
      durationMin: 26,
    },
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
