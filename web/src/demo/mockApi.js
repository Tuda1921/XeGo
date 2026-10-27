/**
 * Mock API cho bản demo tĩnh trên GitHub Pages.
 *
 * Chặn `window.fetch` cho mọi request `/api/*` và trả lời bằng dữ liệu
 * trong bộ nhớ (xem `store.js`). Nhờ vậy toàn bộ giao diện React chạy
 * nguyên vẹn mà không cần backend.
 */
import * as store from './store';

const TOKEN_KEY = 'xego.token';

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const errorResponse = (message, status = 400, details = undefined) =>
  jsonResponse({ error: { message, details } }, status);

const currentToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const requireUser = () => {
  const user = store.userFromToken(currentToken());
  if (!user) {
    const err = new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    err.status = 401;
    throw err;
  }
  return user;
};

const requireRole = (...roles) => {
  const user = requireUser();
  if (!roles.includes(user.role)) {
    const err = new Error('Bạn không có quyền truy cập chức năng này');
    err.status = 403;
    throw err;
  }
  return user;
};

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/* ------------------------------ Định tuyến ------------------------------ */

const routes = [];
const on = (method, pattern, handler) => {
  const keys = [];
  const regex = new RegExp(
    `^${pattern
      .replace(/\/:([A-Za-z0-9_]+)/g, (_, key) => {
        keys.push(key);
        return '/([^/]+)';
      })
      .replace(/\//g, '\\/')}$`,
  );
  routes.push({ method, regex, keys, handler });
};

/* -------------------------------- Auth -------------------------------- */

on('POST', '/auth/login', (_m, _p, _q, body) => {
  const { phone, password } = body || {};
  return store.login(phone, password);
});

on('POST', '/auth/register', (_m, _p, _q, body) => store.register(body));

on('GET', '/auth/me', () => store.mePayload(requireUser()));

on('PATCH', '/auth/me', (_m, _p, _q, body) => store.updateMe(requireUser(), body));

on('POST', '/auth/change-password', (_m, _p, _q, body) =>
  store.changePassword(requireUser(), body || {}),
);

on('POST', '/auth/otp/request', (_m, _p, _q, body) => {
  const phone = String(body?.phone || '').replace(/\s/g, '');
  if (!/^0\d{9,10}$/.test(phone)) throw new Error('Số điện thoại không hợp lệ');
  return {
    ok: true,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    demo: true,
    message: 'Chế độ demo tĩnh: dùng mật khẩu của tài khoản mẫu để đăng nhập.',
  };
});

on('POST', '/auth/otp/verify', (_m, _p, _q, body) => {
  const phone = String(body?.phone || '').replace(/\s/g, '');
  const account = Object.values(store.demoState.accounts).find((a) => a.phone === phone);
  if (!account) throw new Error('Số điện thoại chưa được đăng ký');
  return store.login(phone, account.password);
});

/* ------------------------------- Danh mục ------------------------------- */

on('GET', '/vehicle-types', () => ({ vehicleTypes: store.demoState.vehicleTypes }));

on('GET', '/service-areas', () => ({ serviceAreas: store.demoState.serviceAreas }));

on('GET', '/options', () => store.demoState.options);

on('GET', '/places/search', (_m, _p, query) => {
  const q = query.get('q') || '';
  if (String(q).trim().length < 2) return { results: [], source: 'none', simulated: false };
  return store.searchPlaces(q);
});

on('GET', '/places/reverse', (_m, _p, query) =>
  store.reverse(num(query.get('lat')), num(query.get('lng'))),
);

on('POST', '/route', (_m, _p, _q, body) => {
  const points = body?.points;
  if (!Array.isArray(points) || points.length < 2) throw new Error('Cần ít nhất 2 điểm');
  return store.route(points);
});

on('POST', '/quote', (_m, _p, _q, body) => store.quote(body));

on('GET', '/promos', () => ({ promos: store.demoState.promos }));

on('GET', '/promo/:code', (_m, params) => store.promoDetail(params.code));

/* ------------------------------- Chuyến ------------------------------- */

on('GET', '/trips', (_m, _p, query) => {
  const user = requireUser();
  return {
    trips: store.tripsFor(user, {
      status: query.get('status') || undefined,
      limit: num(query.get('limit'), 20),
      offset: num(query.get('offset'), 0),
    }),
  };
});

on('GET', '/trips/active', () => ({ trips: store.activeTripsFor(requireUser()) }));

on('POST', '/trips', (_m, _p, _q, body) => ({ trip: store.createTrip(requireUser(), body) }));

on('GET', '/trips/:id', (_m, params) => {
  const user = requireUser();
  const trip = store.getTrip(params.id);
  if (!trip) throw new Error('Chuyến không tồn tại');
  const isOwner = trip.customer?.id === user.id;
  const isDriver = trip.driver?.id === user.id;
  if (!isOwner && !isDriver && !['admin', 'operator'].includes(user.role)) {
    throw new Error('Bạn không có quyền xem chuyến này');
  }
  return store.tripDetail(trip);
});

on('POST', '/trips/:id/cancel', (_m, params, _q, body) => ({
  trip: store.cancelTrip(requireUser(), params.id, body?.reason),
}));

on('POST', '/trips/:id/retry', (_m, params) => ({
  trip: store.retrySearch(requireUser(), params.id),
}));

on('POST', '/trips/:id/rate', (_m, params, _q, body) => ({
  trip: store.rateTrip(requireUser(), params.id, body || {}),
}));

on('POST', '/trips/:id/messages', (_m, params, _q, body) => ({
  message: store.sendMessage(requireUser(), params.id, body?.body),
}));

on('POST', '/trips/:id/pay', (_m, params) => store.payTrip(requireUser(), params.id));

on('GET', '/trips/:id/receipt', (_m, params) => store.receiptFor(requireUser(), params.id));

/* -------------------------------- Tài xế -------------------------------- */

on('GET', '/driver/offers', () => ({ offers: store.offersFor(requireRole('driver')) }));

on('POST', '/driver/offers/:id/accept', (_m, params) => ({
  trip: store.acceptOffer(requireRole('driver'), params.id),
}));

on('POST', '/driver/offers/:id/decline', (_m, params, _q, body) =>
  store.declineOffer(requireRole('driver'), params.id, body?.reason),
);

on('POST', '/driver/trips/:id/arrived', (_m, params) => ({
  trip: store.markArrived(requireRole('driver'), params.id),
}));

on('POST', '/driver/trips/:id/start', (_m, params) => ({
  trip: store.startTrip(requireRole('driver'), params.id),
}));

on('POST', '/driver/trips/:id/complete', (_m, params, _q, body) => ({
  trip: store.completeTrip(requireRole('driver'), params.id, body || {}),
}));

on('POST', '/driver/status', (_m, _p, _q, body) =>
  store.setDriverStatus(requireRole('driver'), body?.status),
);

on('POST', '/driver/location', (_m, _p, _q, body) =>
  store.sendDriverLocation(requireRole('driver'), body || {}),
);

on('GET', '/driver/earnings', (_m, _p, query) =>
  store.driverEarnings(requireRole('driver'), query.get('period') || 'week'),
);

on('GET', '/driver/stats', () => store.driverStats(requireRole('driver')));

on('PATCH', '/driver/profile', (_m, _p, _q, body) =>
  store.updateDriverProfile(requireRole('driver'), body || {}),
);

on('POST', '/driver/vehicles', (_m, _p, _q, body) =>
  store.addVehicle(requireRole('driver'), body || {}),
);

on('DELETE', '/driver/vehicles/:id', (_m, params) =>
  store.removeVehicle(requireRole('driver'), params.id),
);

/* -------------------------------- Admin -------------------------------- */

const adminOnly = () => requireRole('admin');

on('GET', '/admin/overview', () => {
  adminOnly();
  return store.adminOverview();
});

on('GET', '/admin/trips/live', () => {
  adminOnly();
  return store.adminLive();
});

on('GET', '/admin/trips', (_m, _p, query) => {
  adminOnly();
  return store.adminTrips({
    status: query.get('status') || undefined,
    q: query.get('q') || undefined,
    limit: num(query.get('limit'), 50),
    offset: num(query.get('offset'), 0),
  });
});

on('GET', '/admin/trips/:id', (_m, params) => {
  adminOnly();
  return store.adminTrip(params.id);
});

on('POST', '/admin/trips/:id/assign', (_m, params, _q, body) =>
  store.adminAssignTrip(adminOnly(), params.id, body?.driverId),
);

on('POST', '/admin/trips/:id/cancel', (_m, params, _q, body) =>
  store.adminCancelTrip(adminOnly(), params.id, body?.reason),
);

on('GET', '/admin/drivers', (_m, _p, query) => {
  adminOnly();
  return store.adminDrivers({
    verification: query.get('verification') || undefined,
    q: query.get('q') || undefined,
  });
});

on('POST', '/admin/drivers/:id/verify', (_m, params, _q, body) =>
  store.verifyDriver(adminOnly(), params.id, Boolean(body?.approved), body?.note),
);

on('POST', '/admin/drivers/:id/suspend', (_m, params, _q, body) =>
  store.suspendDriver(adminOnly(), params.id, Boolean(body?.suspended)),
);

on('GET', '/admin/customers', (_m, _p, query) => {
  adminOnly();
  return store.adminCustomers({ q: query.get('q') || undefined });
});

on('GET', '/admin/vehicles', () => {
  adminOnly();
  return store.adminVehicles();
});

on('PATCH', '/admin/vehicles/:id', (_m, params, _q, body) =>
  store.updateVehicle(adminOnly(), params.id, body?.status),
);

on('GET', '/admin/vehicle-types', () => {
  adminOnly();
  return store.adminVehicleTypes();
});

on('POST', '/admin/vehicle-types', (_m, _p, _q, body) =>
  store.createVehicleType(adminOnly(), body || {}),
);

on('PATCH', '/admin/vehicle-types/:id', (_m, params, _q, body) =>
  store.updateVehicleType(adminOnly(), params.id, body || {}),
);

on('GET', '/admin/promos', () => {
  adminOnly();
  return store.adminPromos();
});

on('POST', '/admin/promos', (_m, _p, _q, body) => store.createPromo(adminOnly(), body || {}));

on('PATCH', '/admin/promos/:id', (_m, params, _q, body) =>
  store.togglePromo(adminOnly(), params.id, Boolean(body?.active)),
);

on('GET', '/admin/payments', () => {
  adminOnly();
  return store.adminPayments();
});

on('POST', '/admin/payments/:id/refund', (_m, params) =>
  store.refundPayment(adminOnly(), params.id),
);

on('GET', '/admin/tickets', (_m, _p, query) => {
  adminOnly();
  return store.adminTickets({ status: query.get('status') || undefined });
});

on('PATCH', '/admin/tickets/:id', (_m, params, _q, body) =>
  store.updateTicket(adminOnly(), params.id, body || {}),
);

on('GET', '/admin/audit', () => {
  adminOnly();
  return store.adminAudit();
});

on('GET', '/admin/settings', () => {
  adminOnly();
  return store.adminSettings();
});

on('PATCH', '/admin/settings', (_m, _p, _q, body) =>
  store.updateSettings(adminOnly(), body || {}),
);

on('GET', '/admin/operators', () => {
  adminOnly();
  return store.adminOperators();
});

on('POST', '/admin/operators', (_m, _p, _q, body) =>
  store.createOperator(adminOnly(), body || {}),
);

on('GET', '/admin/reports', (_m, _p, query) => {
  adminOnly();
  return store.adminReports(num(query.get('days'), 30));
});

/* -------------------------------- Hỗ trợ -------------------------------- */

on('GET', '/support/faq', () => store.demoSeed.public.faq);

on('GET', '/support/tickets', () => store.listTickets(requireUser()));

on('POST', '/support/tickets', (_m, _p, _q, body) =>
  store.createTicket(requireUser(), body || {}),
);

on('GET', '/support/tickets/:id', (_m, params) => store.getTicket(requireUser(), params.id));

on('POST', '/support/tickets/:id/messages', (_m, params, _q, body) =>
  store.replyTicket(requireUser(), params.id, body?.body),
);

/* ----------------------------- Thông báo ----------------------------- */

on('GET', '/notifications', (_m, _p, query) => {
  const user = requireUser();
  return store.notificationsFor(user.id, { limit: num(query.get('limit'), 30) });
});

on('POST', '/notifications/read', (_m, _p, _q, body) => {
  const user = requireUser();
  store.markNotificationsRead(user.id, body?.ids || null);
  return { unread: store.notificationsFor(user.id).unread };
});

/* ------------------------------ Địa điểm ------------------------------ */

on('GET', '/places', () => store.listPlaces(requireUser()));

on('POST', '/places', (_m, _p, _q, body) => store.createPlace(requireUser(), body || {}));

on('DELETE', '/places/:id', (_m, params) => store.removePlace(requireUser(), params.id));

on('GET', '/favorites', () => store.listFavorites(requireUser()));

on('POST', '/favorites/:driverId', (_m, params) =>
  store.addFavorite(requireUser(), params.driverId),
);

on('DELETE', '/favorites/:driverId', (_m, params) =>
  store.removeFavorite(requireUser(), params.driverId),
);

/* -------------------------------- Public -------------------------------- */

on('GET', '/public/trips/:token', (_m, params) => store.sharedTrip(params.token));

on('GET', '/public/config', () => store.demoSeed.public.config);

/* ------------------------------- Bộ chặn ------------------------------- */

function resolve(method, pathname, query, body) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.regex.exec(pathname);
    if (!match) continue;
    const params = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return route.handler(method, params, query, body);
  }
  return undefined;
}

const originalFetch = window.fetch.bind(window);

async function handleApiRequest(url, options) {
  const method = String(options.method || 'GET').toUpperCase();
  const pathname = url.pathname.replace(/^\/api/, '') || '/';
  let body = null;
  if (options.body) {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = null;
    }
  }

  try {
    const result = resolve(method, pathname, url.searchParams, body);
    if (result === undefined) {
      return errorResponse(`Demo tĩnh chưa hỗ trợ endpoint ${method} ${pathname}`, 404);
    }
    const status = method === 'POST' && /^\/(trips|support\/tickets|driver\/vehicles)$/.test(pathname) ? 201 : 200;
    return jsonResponse(result, status);
  } catch (err) {
    return errorResponse(err.message || 'Đã xảy ra lỗi', err.status || 400, err.details);
  }
}

export function installMockApi() {
  if (window.__xegoMockApiInstalled) return;
  window.__xegoMockApiInstalled = true;

  window.fetch = (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (!rawUrl) return originalFetch(input, init);

    let url;
    try {
      url = new URL(rawUrl, window.location.origin);
    } catch {
      return originalFetch(input, init);
    }

    if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
    return handleApiRequest(url, init);
  };
}

export const isDemoMode = true;
