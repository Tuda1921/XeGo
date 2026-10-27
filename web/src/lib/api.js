const TOKEN_KEY = 'xego.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    signal,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || `Lỗi ${res.status}`;
    throw new ApiError(message, res.status, data?.error?.details);
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export const auth = {
  login: (phone, password) => api.post('/auth/login', { phone, password }),
  register: (payload) => api.post('/auth/register', payload),
  me: () => api.get('/auth/me'),
  updateMe: (payload) => api.patch('/auth/me', payload),
  requestOtp: (phone, purpose = 'login') => api.post('/auth/otp/request', { phone, purpose }),
  verifyOtp: (payload) => api.post('/auth/otp/verify', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export const catalog = {
  vehicleTypes: () => api.get('/vehicle-types'),
  options: () => api.get('/options'),
  serviceAreas: () => api.get('/service-areas'),
  searchPlaces: (q, near) => {
    const params = new URLSearchParams({ q });
    if (near) {
      params.set('lat', near.lat);
      params.set('lng', near.lng);
    }
    return api.get(`/places/search?${params.toString()}`);
  },
  reverse: (lat, lng) => api.get(`/places/reverse?lat=${lat}&lng=${lng}`),
  route: (points) => api.post('/route', { points }),
  quote: (payload) => api.post('/quote', payload),
  promos: () => api.get('/promos'),
  promo: (code) => api.get(`/promo/${encodeURIComponent(code)}`),
};

export const trips = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/trips${qs ? `?${qs}` : ''}`);
  },
  active: () => api.get('/trips/active'),
  create: (payload) => api.post('/trips', payload),
  get: (id) => api.get(`/trips/${id}`),
  cancel: (id, reason) => api.post(`/trips/${id}/cancel`, { reason }),
  retry: (id) => api.post(`/trips/${id}/retry`),
  rate: (id, payload) => api.post(`/trips/${id}/rate`, payload),
  sendMessage: (id, body) => api.post(`/trips/${id}/messages`, { body }),
  pay: (id) => api.post(`/trips/${id}/pay`),
  receipt: (id) => api.get(`/trips/${id}/receipt`),
};

export const driver = {
  offers: () => api.get('/driver/offers'),
  accept: (offerId) => api.post(`/driver/offers/${offerId}/accept`),
  decline: (offerId, reason) => api.post(`/driver/offers/${offerId}/decline`, { reason }),
  arrived: (tripId) => api.post(`/driver/trips/${tripId}/arrived`),
  start: (tripId) => api.post(`/driver/trips/${tripId}/start`),
  complete: (tripId, payload = {}) => api.post(`/driver/trips/${tripId}/complete`, payload),
  setStatus: (status) => api.post('/driver/status', { status }),
  sendLocation: (payload) => api.post('/driver/location', payload),
  earnings: (period) => api.get(`/driver/earnings?period=${period}`),
  stats: () => api.get('/driver/stats'),
  updateProfile: (payload) => api.patch('/driver/profile', payload),
  addVehicle: (payload) => api.post('/driver/vehicles', payload),
  removeVehicle: (id) => api.delete(`/driver/vehicles/${id}`),
};

export const admin = {
  overview: () => api.get('/admin/overview'),
  trips: (params = {}) => api.get(`/admin/trips?${new URLSearchParams(params).toString()}`),
  live: () => api.get('/admin/trips/live'),
  trip: (id) => api.get(`/admin/trips/${id}`),
  assign: (id, driverId) => api.post(`/admin/trips/${id}/assign`, { driverId }),
  cancelTrip: (id, reason) => api.post(`/admin/trips/${id}/cancel`, { reason }),
  drivers: (params = {}) => api.get(`/admin/drivers?${new URLSearchParams(params).toString()}`),
  verifyDriver: (id, approved, note) => api.post(`/admin/drivers/${id}/verify`, { approved, note }),
  suspendDriver: (id, suspended) => api.post(`/admin/drivers/${id}/suspend`, { suspended }),
  customers: (params = {}) => api.get(`/admin/customers?${new URLSearchParams(params).toString()}`),
  vehicles: () => api.get('/admin/vehicles'),
  updateVehicle: (id, status) => api.patch(`/admin/vehicles/${id}`, { status }),
  vehicleTypes: () => api.get('/admin/vehicle-types'),
  createVehicleType: (payload) => api.post('/admin/vehicle-types', payload),
  updateVehicleType: (id, payload) => api.patch(`/admin/vehicle-types/${id}`, payload),
  promos: () => api.get('/admin/promos'),
  createPromo: (payload) => api.post('/admin/promos', payload),
  togglePromo: (id, active) => api.patch(`/admin/promos/${id}`, { active }),
  payments: () => api.get('/admin/payments'),
  refund: (id) => api.post(`/admin/payments/${id}/refund`),
  tickets: (params = {}) => api.get(`/admin/tickets?${new URLSearchParams(params).toString()}`),
  updateTicket: (id, payload) => api.patch(`/admin/tickets/${id}`, payload),
  audit: () => api.get('/admin/audit'),
  settings: () => api.get('/admin/settings'),
  updateSettings: (payload) => api.patch('/admin/settings', payload),
  operators: () => api.get('/admin/operators'),
  createOperator: (payload) => api.post('/admin/operators', payload),
  reports: (days) => api.get(`/admin/reports?days=${days}`),
};

export const support = {
  faq: () => api.get('/support/faq'),
  tickets: () => api.get('/support/tickets'),
  createTicket: (payload) => api.post('/support/tickets', payload),
  ticket: (id) => api.get(`/support/tickets/${id}`),
  reply: (id, body) => api.post(`/support/tickets/${id}/messages`, { body }),
};

export const notifications = {
  list: (params = {}) => api.get(`/notifications?${new URLSearchParams(params).toString()}`),
  markRead: (ids) => api.post('/notifications/read', { ids }),
};

export const places = {
  list: () => api.get('/places'),
  create: (payload) => api.post('/places', payload),
  remove: (id) => api.delete(`/places/${id}`),
};

export const favorites = {
  list: () => api.get('/favorites'),
  add: (driverId) => api.post(`/favorites/${driverId}`),
  remove: (driverId) => api.delete(`/favorites/${driverId}`),
};

export const publicApi = {
  trip: (token) => api.get(`/public/trips/${token}`),
  config: () => api.get('/public/config'),
};
