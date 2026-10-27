/**
 * Kho dữ liệu trong bộ nhớ cho bản demo tĩnh.
 *
 * Nạp dữ liệu thật đã xuất từ backend (web/src/demo/data.json) rồi cho phép
 * thao tác như thật: đặt chuyến, tài xế nhận cuốc, hoàn thành, đánh giá,
 * huỷ chuyến, tạo ticket... Toàn bộ trạng thái chỉ sống trong tab hiện tại.
 */
import seed from './data.json';
import { quoteAllTypes, quoteTrip, findPromo } from './pricing';
import { haversineKm, reverseGeocode, routeThrough, searchLocalPlaces } from './geo';
import { emitLocal } from './socket';

const clone = (value) => JSON.parse(JSON.stringify(value));

const ACTIVE_STATUSES = ['scheduled', 'searching', 'assigned', 'arrived', 'in_progress', 'no_driver'];

const state = {
  accounts: clone(seed.accounts),
  users: {},
  vehicleTypes: clone(seed.public.vehicleTypes.vehicleTypes),
  promos: clone(seed.public.promos.promos),
  serviceAreas: clone(seed.public.serviceAreas.serviceAreas),
  localPlaces: clone(seed.public.localPlaces),
  options: clone(seed.public.options),
  config: clone(seed.public.config),
  faq: clone(seed.public.faq),
  trips: [],
  messages: {},
  events: {},
  notifications: [],
  favorites: [],
  places: [],
  tickets: [],
  payments: [],
  drivers: [],
  customers: [],
  vehicles: [],
  audit: [],
  settings: {},
  operators: [],
  offers: [],
  seq: { trip: 1000, message: 5000, event: 5000, notification: 5000, ticket: 500, payment: 500, place: 500, offer: 500 },
};

/* ------------------------------- Tiện ích ------------------------------- */

const nowIso = () => new Date().toISOString();
const nextId = (key) => {
  state.seq[key] += 1;
  return state.seq[key];
};

const tripCode = () => {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return `XG-${stamp}-${nextId('trip')}`;
};

const shareToken = () => {
  const chars = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < 24; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const vehicleTypeById = (id) => state.vehicleTypes.find((t) => t.id === Number(id)) || null;

const userById = (id) => state.users[id] || null;

const driverProfileOf = (userId) => state.drivers.find((d) => d.id === Number(userId)) || null;

const vehicleOfDriver = (userId) =>
  state.vehicles.find((v) => v.driverId === Number(userId) && v.status === 'active') || null;

/* ------------------------------ Khởi tạo ------------------------------ */

function buildUsers() {
  const add = (user, extra = {}) => {
    state.users[user.id] = { ...clone(user), ...extra };
  };

  add(seed.customer.me.user);
  add(seed.driver.me.user);
  add(seed.admin.me.user);
  add(seed.operator.me.user);

  state.drivers = clone(seed.admin.drivers.drivers).map((d) => ({
    ...d,
    currentLocation: d.currentLocation ?? d.location ?? null,
  }));
  state.customers = clone(seed.admin.customers.customers);
  state.vehicles = clone(seed.admin.vehicles.vehicles).map((v) => ({
    ...v,
    driverId: v.driverId ?? v.driver_id ?? null,
  }));

  // Bổ sung hồ sơ tài xế đang đăng nhập (đầy đủ hơn danh sách admin).
  const me = seed.driver.me;
  const existing = state.drivers.find((d) => d.id === me.user.id);
  const profile = {
    id: me.user.id,
    name: me.user.name,
    phone: me.user.phone,
    email: me.user.email,
    status: me.user.status,
    createdAt: me.user.createdAt,
    ...me.driverProfile,
    vehicles: me.vehicles,
  };
  if (existing) Object.assign(existing, profile);
  else state.drivers.push(profile);

  // Đảm bảo mọi tài xế trong danh sách admin đều có user để đăng nhập demo.
  for (const driver of state.drivers) {
    if (!state.users[driver.id]) {
      state.users[driver.id] = {
        id: driver.id,
        role: 'driver',
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        avatarUrl: null,
        status: driver.status || 'active',
        phoneVerified: true,
        createdAt: driver.createdAt,
      };
    }
  }
  for (const customer of state.customers) {
    if (!state.users[customer.id]) {
      state.users[customer.id] = {
        id: customer.id,
        role: 'customer',
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        avatarUrl: customer.avatarUrl || null,
        status: customer.status || 'active',
        phoneVerified: true,
        createdAt: customer.createdAt,
      };
    }
  }
}

function buildTrips() {
  const all = [
    ...(seed.customer.trips.trips || []),
    ...(seed.admin.trips.trips || []),
  ];
  const seen = new Set();
  state.trips = [];
  for (const trip of all) {
    if (seen.has(trip.id)) continue;
    seen.add(trip.id);
    state.trips.push(clone(trip));
  }

  const detail = seed.customer.tripDetail;
  if (detail?.trip) {
    const index = state.trips.findIndex((t) => t.id === detail.trip.id);
    if (index >= 0) state.trips[index] = clone(detail.trip);
    else state.trips.push(clone(detail.trip));
    state.messages[detail.trip.id] = clone(detail.messages || []);
    state.events[detail.trip.id] = clone(detail.events || []);
  }

  for (const trip of state.trips) {
    if (!state.messages[trip.id]) state.messages[trip.id] = [];
    if (!state.events[trip.id]) state.events[trip.id] = [];
  }

  state.seq.trip = Math.max(1000, ...state.trips.map((t) => Number(t.id) || 0));
}

function buildRest() {
  const customerId = seed.customer.me.user.id;
  state.notifications = clone(seed.customer.notifications.notifications || []).map((n) => ({
    ...n,
    userId: n.userId ?? customerId,
  }));
  state.favorites = clone(seed.customer.favorites.favorites || []).map((f) => ({
    ...f,
    customerId: f.customerId ?? customerId,
  }));
  state.places = clone(seed.customer.places.places || []).map((p) => ({
    ...p,
    userId: p.userId ?? customerId,
  }));
  state.tickets = clone(seed.customer.tickets.tickets || []).map((t) => ({
    ...t,
    userId: t.userId ?? customerId,
    userName: t.userName ?? seed.customer.me.user.name,
    userPhone: t.userPhone ?? seed.customer.me.user.phone,
  }));
  state.payments = clone(seed.admin.payments.payments || []);
  state.audit = clone(seed.admin.audit.logs || []);
  state.settings = clone(seed.admin.settings.settings || {});
  state.operators = clone(seed.admin.operators.operators || []);
  state.seq.notification = Math.max(5000, ...state.notifications.map((n) => Number(n.id) || 0));
  state.seq.ticket = Math.max(500, ...state.tickets.map((t) => Number(t.id) || 0));
  state.seq.payment = Math.max(500, ...state.payments.map((p) => Number(p.id) || 0));
  state.seq.place = Math.max(500, ...state.places.map((p) => Number(p.id) || 0));
}

buildUsers();
buildTrips();
buildRest();

/* --------------------------- Truy vấn chuyến --------------------------- */

const sortByCreatedDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

export function tripsFor(user, { status, limit = 20, offset = 0 } = {}) {
  let list = state.trips;
  if (user.role === 'customer') list = list.filter((t) => t.customer?.id === user.id);
  else if (user.role === 'driver') list = list.filter((t) => t.driver?.id === user.id);
  if (status) {
    const wanted = String(status).split(',').map((s) => s.trim());
    list = list.filter((t) => wanted.includes(t.status));
  }
  return [...list].sort(sortByCreatedDesc).slice(offset, offset + limit);
}

export function activeTripsFor(user) {
  return tripsFor(user, { status: ACTIVE_STATUSES.join(','), limit: 10 });
}

export function getTrip(id) {
  return state.trips.find((t) => t.id === Number(id)) || null;
}

export function tripMessages(id) {
  return state.messages[id] || [];
}

export function tripEvents(id) {
  return state.events[id] || [];
}

function pushEvent(trip, type, message, actorRole = null, meta = {}) {
  const event = { id: nextId('event'), type, message, actorRole, meta, createdAt: nowIso() };
  state.events[trip.id] = [...(state.events[trip.id] || []), event];
  return event;
}

function touch(trip) {
  trip.updatedAt = nowIso();
  return trip;
}

/* --------------------------- Phát sự kiện --------------------------- */

function broadcastTrip(trip) {
  const payload = { trip: clone(trip) };
  emitLocal('trip:update', payload);
  emitLocal('admin:trip_update', payload);
  return trip;
}

function broadcastNotification(notification) {
  emitLocal('notification', clone(notification));
}

/* ------------------------------ Thông báo ------------------------------ */

export function pushNotification(userId, { type, title, body, data = {} }) {
  const notification = {
    id: nextId('notification'),
    userId: Number(userId),
    type,
    title,
    body,
    data,
    readAt: null,
    createdAt: nowIso(),
  };
  state.notifications.unshift(notification);
  broadcastNotification(notification);
  return notification;
}

export function notificationsFor(userId, { limit = 20 } = {}) {
  const list = state.notifications.filter((n) => n.userId === Number(userId));
  return { notifications: list.slice(0, limit), unread: list.filter((n) => !n.readAt).length };
}

export function markNotificationsRead(userId, ids) {
  const target = ids ? new Set(ids.map(Number)) : null;
  for (const n of state.notifications) {
    if (n.userId !== Number(userId)) continue;
    if (!target || target.has(n.id)) n.readAt = nowIso();
  }
  return { ok: true };
}

/* ------------------------------- Đặt chuyến ------------------------------- */

function estimateArrival(trip) {
  if (!trip.driver) return null;
  const profile = driverProfileOf(trip.driver.id);
  const location = profile?.currentLocation;
  if (!location?.lat) return null;
  const distance = haversineKm(location, trip.pickup);
  if (distance === null) return null;
  return {
    distanceKm: Math.round(distance * 100) / 100,
    etaMinutes: Math.max(1, Math.round((distance / 24) * 60)),
    updatedAt: location.updatedAt,
  };
}

export function tripDetail(trip) {
  return {
    trip,
    events: tripEvents(trip.id),
    messages: tripMessages(trip.id),
    eta: estimateArrival(trip),
    route: routeThrough([trip.pickup, ...(trip.stops || []), trip.dropoff]),
  };
}

export function createTrip(user, body) {
  const {
    vehicleTypeId,
    pickup,
    dropoff,
    stops = [],
    distanceKm = 0,
    durationMin = 0,
    passengers = 1,
    luggage = 0,
    notes = '',
    specialRequests = [],
    paymentMethod = 'cash',
    serviceType = 'ride',
    tripMode = 'one_way',
    scheduleType = 'now',
    scheduledAt = null,
    returnAt = null,
    quote,
  } = body || {};

  if (!pickup?.lat || !dropoff?.lat) throw new Error('Thiếu điểm đón hoặc điểm trả');
  const vehicleType = vehicleTypeById(vehicleTypeId);
  if (!vehicleType) throw new Error('Loại xe không hợp lệ');
  if (!quote?.total) throw new Error('Thiếu báo giá');

  const duplicate = state.trips.find(
    (t) =>
      t.customer?.id === user.id &&
      t.pickup?.lat === pickup.lat &&
      t.dropoff?.lat === dropoff.lat &&
      Date.now() - new Date(t.createdAt).getTime() < 120_000,
  );
  if (duplicate) throw new Error('Bạn vừa đặt chuyến tương tự, vui lòng thử lại sau ít phút');

  const id = nextId('trip');
  const trip = {
    id,
    code: tripCode(),
    status: scheduleType === 'scheduled' ? 'scheduled' : 'searching',
    serviceType,
    tripMode,
    scheduleType,
    scheduledAt,
    returnAt,
    pickup: { label: pickup.label, address: pickup.address, lat: pickup.lat, lng: pickup.lng },
    dropoff: { label: dropoff.label, address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng },
    stops: stops.map((s) => ({ label: s.label, address: s.address, lat: s.lat, lng: s.lng })),
    distanceKm: Number(distanceKm) || 0,
    durationMin: Number(durationMin) || 0,
    passengers: Number(passengers) || 1,
    luggage: Number(luggage) || 0,
    notes,
    specialRequests: specialRequests.map((code) => {
      const found = state.options.specialRequests.find((r) => r.code === code);
      return { code, label: found?.label || code };
    }),
    paymentMethod,
    paymentStatus: 'unpaid',
    priceBreakdown: quote,
    estimatedPrice: quote.total,
    finalPrice: null,
    discountCode: quote.discountCode || null,
    discountAmount: quote.discount || 0,
    commissionAmount: quote.commission || 0,
    driverEarning: quote.driverEarning || 0,
    cancelReason: null,
    cancelledBy: null,
    searchRound: 1,
    offerExpiresAt: null,
    rating: null,
    review: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    acceptedAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    vehicleType: { id: vehicleType.id, name: vehicleType.name, code: vehicleType.code, seats: vehicleType.seats },
    customer: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || null },
    driver: null,
    operatorName: null,
    customerPhone: user.phone,
    driverPhone: null,
    shareToken: shareToken(),
  };

  state.trips.unshift(trip);
  state.messages[id] = [];
  state.events[id] = [];
  pushEvent(trip, 'created', 'Khách đã tạo chuyến', 'customer', { estimatedPrice: quote.total });

  if (trip.status === 'scheduled') {
    pushEvent(trip, 'scheduled', 'Chuyến đã được lên lịch', 'customer', { scheduledAt });
  } else {
    pushEvent(trip, 'search_round', 'Đang tìm tài xế (lượt 1)', null, { round: 1, drivers: 0 });
    scheduleOffer(trip);
  }

  return broadcastTrip(trip);
}

/* --------------------------- Mô phỏng tài xế --------------------------- */

const OFFER_TTL_MS = 45_000;

function scheduleOffer(trip) {
  // Bản demo tự động gán một tài xế đang rảnh sau ~4 giây để mô phỏng
  // vòng lặp tìm tài xế thật của backend.
  const candidates = state.drivers.filter(
    (d) => d.verificationStatus === 'approved' && d.onlineStatus === 'online' && d.id !== trip.driver?.id,
  );
  if (!candidates.length) {
    trip.status = 'no_driver';
    pushEvent(trip, 'no_driver', 'Không tìm được tài xế phù hợp', null, {});
    return;
  }
  const driver = candidates[Math.floor(Math.random() * candidates.length)];
  const offerId = nextId('offer');
  trip.offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS).toISOString();
  state.offers.push({ offerId, tripId: trip.id, driverId: driver.id, expiresAt: trip.offerExpiresAt });

  const offerPayload = () => {
    const current = getTrip(trip.id);
    if (!current) return null;
    return {
      offerId,
      tripId: current.id,
      code: current.code,
      expiresAt: trip.offerExpiresAt,
      distanceToPickupKm: driver.currentLocation
        ? Math.round((haversineKm(driver.currentLocation, current.pickup) || 0) * 100) / 100
        : null,
      trip: {
        id: current.id,
        code: current.code,
        serviceType: current.serviceType,
        tripMode: current.tripMode,
        pickup: current.pickup,
        dropoff: current.dropoff,
        distanceKm: current.distanceKm,
        durationMin: current.durationMin,
        passengers: current.passengers,
        luggage: current.luggage,
        notes: current.notes,
        specialRequests: current.specialRequests,
        scheduledAt: current.scheduledAt,
        estimatedPrice: current.estimatedPrice,
        driverEarning: current.driverEarning,
        paymentMethod: current.paymentMethod,
      },
    };
  };

  setTimeout(() => {
    const offer = state.offers.find((o) => o.offerId === offerId);
    if (!offer) return;
    const current = getTrip(trip.id);
    if (!current || current.status !== 'searching') return;
    assignDriver(current, driver.id);
  }, 4200);

  setTimeout(() => {
    const payload = offerPayload();
    if (payload) emitLocal('trip:offer', payload);
  }, 600);
}

function assignDriver(trip, driverId) {
  const driver = driverProfileOf(driverId);
  if (!driver) return;
  const vehicle = vehicleOfDriver(driverId) || driver.vehicles?.[0] || null;

  trip.status = 'assigned';
  trip.driver = {
    id: driver.id,
    name: driver.name,
    avatarUrl: driver.avatarUrl || null,
    rating: driver.rating,
    ratingCount: driver.ratingCount,
    tripsCompleted: driver.tripsCompleted,
    vehicle: vehicle
      ? {
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          color: vehicle.color,
          seats: vehicle.seats,
          imageUrl: vehicle.imageUrl || null,
        }
      : null,
  };
  trip.driverPhone = driver.phone;
  trip.operatorName = driver.operatorName || null;
  trip.acceptedAt = nowIso();
  trip.offerExpiresAt = null;
  touch(trip);

  pushEvent(trip, 'accepted', `Tài xế ${driver.name} đã nhận chuyến`, 'driver', {});
  pushNotification(trip.customer.id, {
    type: 'driver_assigned',
    title: 'Đã tìm được tài xế',
    body: `${driver.name} đang đến điểm đón bạn.`,
    data: { tripId: trip.id },
  });
  pushNotification(driver.id, {
    type: 'trip_assigned',
    title: 'Bạn có chuyến mới',
    body: `${trip.pickup.label} → ${trip.dropoff.label}`,
    data: { tripId: trip.id },
  });
  broadcastTrip(trip);
}

export function acceptOffer(user, offerId) {
  const offer = state.offers.find((o) => o.offerId === Number(offerId));
  if (!offer) throw new Error('Cuốc xe không còn hiệu lực');
  if (offer.driverId !== user.id) throw new Error('Cuốc xe không thuộc về bạn');
  const trip = getTrip(offer.tripId);
  if (!trip || trip.status !== 'searching') throw new Error('Chuyến đã được nhận hoặc đã huỷ');
  state.offers = state.offers.filter((o) => o.offerId !== offer.offerId);
  assignDriver(trip, user.id);
  emitLocal('trip:offer_closed', { offerId: offer.offerId, tripId: trip.id });
  return trip;
}

export function declineOffer(user, offerId) {
  const offer = state.offers.find((o) => o.offerId === Number(offerId));
  if (!offer) throw new Error('Cuốc xe không còn hiệu lực');
  state.offers = state.offers.filter((o) => o.offerId !== offer.offerId);
  emitLocal('trip:offer_closed', { offerId: offer.offerId, tripId: offer.tripId });
  return { ok: true };
}

export function offersFor(user) {
  const now = Date.now();
  return state.offers
    .filter((o) => o.driverId === user.id && new Date(o.expiresAt).getTime() > now)
    .map((o) => {
      const trip = getTrip(o.tripId);
      if (!trip) return null;
      const profile = driverProfileOf(user.id);
      const distanceToPickupKm = profile?.currentLocation
        ? Math.round((haversineKm(profile.currentLocation, trip.pickup) || 0) * 100) / 100
        : null;
      return {
        offerId: o.offerId,
        tripId: trip.id,
        code: trip.code,
        expiresAt: o.expiresAt,
        distanceToPickupKm,
        trip: {
          id: trip.id,
          code: trip.code,
          serviceType: trip.serviceType,
          tripMode: trip.tripMode,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          distanceKm: trip.distanceKm,
          durationMin: trip.durationMin,
          passengers: trip.passengers,
          luggage: trip.luggage,
          notes: trip.notes,
          specialRequests: trip.specialRequests,
          scheduledAt: trip.scheduledAt,
          estimatedPrice: trip.estimatedPrice,
          driverEarning: trip.driverEarning,
          paymentMethod: trip.paymentMethod,
        },
      };
    })
    .filter(Boolean);
}

/* --------------------------- Vòng đời chuyến --------------------------- */

function assertDriverTrip(user, trip) {
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (trip.driver?.id !== user.id) throw new Error('Bạn không phụ trách chuyến này');
}

export function markArrived(user, tripId) {
  const trip = getTrip(tripId);
  assertDriverTrip(user, trip);
  if (trip.status !== 'assigned') throw new Error('Chuyến chưa ở trạng thái có thể xác nhận đến');
  trip.status = 'arrived';
  trip.arrivedAt = nowIso();
  touch(trip);
  pushEvent(trip, 'arrived', 'Tài xế đã tới điểm đón', 'driver', {});
  pushNotification(trip.customer.id, {
    type: 'driver_arrived',
    title: 'Tài xế đã đến',
    body: 'Tài xế đang chờ bạn tại điểm đón.',
    data: { tripId: trip.id },
  });
  return broadcastTrip(trip);
}

export function startTrip(user, tripId) {
  const trip = getTrip(tripId);
  assertDriverTrip(user, trip);
  if (!['assigned', 'arrived'].includes(trip.status)) throw new Error('Chuyến chưa sẵn sàng để bắt đầu');
  trip.status = 'in_progress';
  trip.startedAt = nowIso();
  touch(trip);
  pushEvent(trip, 'started', 'Chuyến đã bắt đầu', 'driver', {});
  pushNotification(trip.customer.id, {
    type: 'trip_started',
    title: 'Chuyến đi bắt đầu',
    body: 'Chúc bạn có chuyến đi an toàn.',
    data: { tripId: trip.id },
  });
  return broadcastTrip(trip);
}

export function completeTrip(user, tripId, body = {}) {
  const trip = getTrip(tripId);
  assertDriverTrip(user, trip);
  if (trip.status !== 'in_progress') throw new Error('Chuyến chưa bắt đầu');
  const distanceKm = Number(body.distanceKm) || trip.distanceKm;
  const durationMin = Number(body.durationMin) || trip.durationMin;

  const vehicleType = vehicleTypeById(trip.vehicleType?.id) || state.vehicleTypes[0];
  const breakdown = quoteTrip({
    vehicleType,
    promos: state.promos,
    distanceKm,
    durationMin,
    serviceType: trip.serviceType,
    tripMode: trip.tripMode,
    stops: trip.stops,
    specialRequests: trip.specialRequests.map((r) => r.code),
    promoCode: trip.discountCode,
    passengers: trip.passengers,
    luggage: trip.luggage,
    commissionRate: state.config.commissionRate,
  });

  trip.status = 'completed';
  trip.completedAt = nowIso();
  trip.distanceKm = distanceKm;
  trip.durationMin = durationMin;
  trip.priceBreakdown = breakdown;
  trip.finalPrice = breakdown.total;
  trip.commissionAmount = breakdown.commission;
  trip.driverEarning = breakdown.driverEarning;
  trip.paymentStatus = trip.paymentMethod === 'cash' ? 'unpaid' : 'unpaid';
  touch(trip);

  pushEvent(trip, 'completed', 'Chuyến đã hoàn thành', 'driver', { finalPrice: breakdown.total });
  pushNotification(trip.customer.id, {
    type: 'trip_completed',
    title: 'Chuyến đi hoàn thành',
    body: `Tổng thanh toán ${breakdown.total.toLocaleString('vi-VN')} ₫. Hãy đánh giá tài xế nhé!`,
    data: { tripId: trip.id },
  });

  const profile = driverProfileOf(user.id);
  if (profile) {
    profile.tripsCompleted = (profile.tripsCompleted || 0) + 1;
    profile.onlineStatus = 'online';
  }
  return broadcastTrip(trip);
}

export function cancelTrip(user, tripId, reason) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (['completed', 'cancelled'].includes(trip.status)) throw new Error('Không thể huỷ chuyến này');
  const isCustomer = trip.customer?.id === user.id;
  const isDriver = trip.driver?.id === user.id;
  const isStaff = ['admin', 'operator'].includes(user.role);
  if (!isCustomer && !isDriver && !isStaff) throw new Error('Bạn không có quyền huỷ chuyến này');

  trip.status = 'cancelled';
  trip.cancelledAt = nowIso();
  trip.cancelReason = reason || 'Không có lý do';
  trip.cancelledBy = user.role;
  touch(trip);

  pushEvent(trip, 'cancelled', `Chuyến đã huỷ: ${trip.cancelReason}`, user.role, {});
  const other = isCustomer ? trip.driver?.id : trip.customer?.id;
  if (other) {
    pushNotification(other, {
      type: 'trip_cancelled',
      title: 'Chuyến đã bị huỷ',
      body: `Chuyến ${trip.code}: ${trip.cancelReason}`,
      data: { tripId: trip.id },
    });
  }
  return broadcastTrip(trip);
}

export function retrySearch(user, tripId) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (!['no_driver', 'searching'].includes(trip.status)) throw new Error('Chuyến không ở trạng thái tìm tài xế');
  trip.status = 'searching';
  trip.searchRound = 1;
  trip.driver = null;
  trip.driverPhone = null;
  touch(trip);
  pushEvent(trip, 'search_retry', 'Khách yêu cầu tìm lại tài xế', 'customer', {});
  pushEvent(trip, 'search_round', 'Đang tìm tài xế (lượt 1)', null, { round: 1, drivers: 0 });
  scheduleOffer(trip);
  return broadcastTrip(trip);
}

export function rateTrip(user, tripId, { stars, comment }) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (trip.customer?.id !== user.id) throw new Error('Bạn không thể đánh giá chuyến này');
  if (trip.status !== 'completed') throw new Error('Chỉ đánh giá được chuyến đã hoàn thành');
  if (trip.rating) throw new Error('Bạn đã đánh giá chuyến này');
  const value = Number(stars);
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('Số sao phải từ 1 đến 5');
  trip.rating = value;
  trip.review = comment || null;
  touch(trip);
  pushEvent(trip, 'rated', `Khách đánh giá ${value} sao`, 'customer', { stars: value });
  return broadcastTrip(trip);
}

export function sendMessage(user, tripId, body) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Chuyến không tồn tại');
  const text = String(body || '').trim();
  if (!text) throw new Error('Nội dung tin nhắn trống');
  if (text.length > 1000) throw new Error('Tin nhắn quá dài');
  const message = {
    id: nextId('message'),
    senderId: user.id,
    senderRole: user.role,
    body: text,
    createdAt: nowIso(),
  };
  state.messages[trip.id] = [...(state.messages[trip.id] || []), message];
  emitLocal('trip:message', { tripId: trip.id, message: clone(message) });
  return message;
}

export function payTrip(user, tripId) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (trip.status !== 'completed') throw new Error('Chỉ thanh toán chuyến đã hoàn thành');
  if (trip.paymentStatus === 'paid') throw new Error('Chuyến đã được thanh toán');
  const amount = trip.finalPrice || trip.estimatedPrice;
  trip.paymentStatus = 'paid';
  touch(trip);
  const payment = {
    id: nextId('payment'),
    tripId: trip.id,
    code: trip.code,
    method: trip.paymentMethod,
    amount,
    status: 'paid',
    provider: 'demo',
    providerRef: `DEMO-${Date.now()}`,
    paidAt: nowIso(),
    createdAt: nowIso(),
    customerName: trip.customer?.name,
    driverName: trip.driver?.name,
  };
  state.payments.unshift(payment);
  pushNotification(trip.customer.id, {
    type: 'payment',
    title: 'Thanh toán thành công',
    body: `${amount.toLocaleString('vi-VN')} ₫ cho chuyến ${trip.code} (mô phỏng).`,
    data: { tripId: trip.id },
  });
  return { trip: broadcastTrip(trip), simulated: true };
}

export function receiptFor(user, tripId) {
  const trip = getTrip(tripId);
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (trip.status !== 'completed') throw new Error('Chuyến chưa hoàn thành');
  const payment = state.payments.find((p) => p.tripId === trip.id) || null;
  return {
    receipt: {
      code: trip.code,
      issuedAt: trip.completedAt,
      customer: { name: trip.customer?.name, phone: trip.customerPhone },
      driver: trip.driver ? { name: trip.driver.name, plate: trip.driver.vehicle?.plate } : null,
      route: {
        pickup: trip.pickup.address,
        dropoff: trip.dropoff.address,
        distanceKm: trip.distanceKm,
        durationMin: trip.durationMin,
      },
      breakdown: trip.priceBreakdown,
      amount: trip.finalPrice || trip.estimatedPrice,
      paymentMethod: trip.paymentMethod,
      paymentStatus: trip.paymentStatus,
      payment: payment
        ? {
            status: payment.status,
            provider: payment.provider,
            providerRef: payment.providerRef,
            paidAt: payment.paidAt,
            simulated: true,
          }
        : null,
    },
  };
}

/* ------------------------------ Danh mục ------------------------------ */

export function quote(body) {
  const {
    vehicleTypeId,
    distanceKm = 0,
    durationMin = 0,
    serviceType = 'ride',
    tripMode = 'one_way',
    hours = 0,
    days = 0,
    stops = [],
    specialRequests = [],
    promoCode = null,
    scheduledAt = null,
    passengers = 1,
    luggage = 0,
    allTypes = false,
  } = body || {};

  const base = {
    promos: state.promos,
    distanceKm,
    durationMin,
    serviceType,
    tripMode,
    hours,
    days,
    stops,
    specialRequests,
    promoCode,
    scheduledAt,
    passengers,
    luggage,
    commissionRate: state.config.commissionRate,
  };

  if (allTypes) return { quotes: quoteAllTypes(base, state.vehicleTypes) };
  const vehicleType = vehicleTypeById(vehicleTypeId);
  if (!vehicleType) throw new Error('Loại xe không hợp lệ');
  return { quote: quoteTrip({ ...base, vehicleType }) };
}

export function promoDetail(code) {
  const promo = findPromo(state.promos, code);
  if (!promo) throw new Error('Mã giảm giá không tồn tại hoặc đã hết hạn');
  return { promo };
}

export function searchPlaces(query) {
  const results = searchLocalPlaces(state.localPlaces, query, 8);
  return { results, source: 'local', simulated: true };
}

export function reverse(lat, lng) {
  return reverseGeocode(state.localPlaces, Number(lat), Number(lng));
}

export function route(points) {
  return routeThrough(points);
}

/* ------------------------------ Tài khoản ------------------------------ */

export function mePayload(user) {
  const payload = { user };
  if (user.role === 'driver') {
    const profile = driverProfileOf(user.id);
    payload.driverProfile = profile
      ? {
          verificationStatus: profile.verificationStatus,
          verificationNote: profile.verificationNote || null,
          onlineStatus: profile.onlineStatus,
          rating: profile.rating,
          ratingCount: profile.ratingCount,
          tripsCompleted: profile.tripsCompleted,
          tripsCancelled: profile.tripsCancelled || 0,
          licenseNumber: profile.licenseNumber,
          licenseExpiry: profile.licenseExpiry,
          idCardNumber: profile.idCardNumber,
          serviceArea: profile.serviceArea,
          bio: profile.bio,
          currentLocation: profile.currentLocation || null,
        }
      : null;
    payload.vehicles = state.vehicles
      .filter((v) => v.driverId === user.id)
      .map((v) => ({
        id: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        color: v.color,
        year: v.year,
        seats: v.seats,
        imageUrl: v.imageUrl || null,
        status: v.status,
        vehicleTypeId: v.vehicleTypeId,
        typeName: v.typeName,
      }));
  }
  return payload;
}

export function updateMe(user, body) {
  const { name, email, avatarUrl } = body || {};
  if (name !== undefined) {
    if (String(name).trim().length < 2) throw new Error('Họ tên quá ngắn');
    user.name = String(name).trim();
  }
  if (email !== undefined) user.email = email || null;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || null;
  state.users[user.id] = user;
  return { user };
}

export function changePassword(user, { currentPassword, newPassword }) {
  if (!newPassword || String(newPassword).length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự');
  const account = Object.values(state.accounts).find((a) => a.phone === user.phone);
  if (account && account.password !== currentPassword) throw new Error('Mật khẩu hiện tại không đúng');
  if (account) account.password = newPassword;
  return { ok: true };
}

export function login(phone, password) {
  const normalized = String(phone || '').replace(/\s/g, '');
  const account = Object.values(state.accounts).find((a) => a.phone === normalized);
  if (!account || account.password !== password) throw new Error('Số điện thoại hoặc mật khẩu không đúng');
  const user = Object.values(state.users).find((u) => u.phone === normalized);
  if (!user) throw new Error('Số điện thoại hoặc mật khẩu không đúng');
  return { token: `demo.${user.id}.${Date.now()}`, user };
}

export function userFromToken(token) {
  if (!token || !token.startsWith('demo.')) return null;
  const id = Number(token.split('.')[1]);
  return userById(id);
}

export function register(body) {
  const { name, phone, password, role = 'customer' } = body || {};
  const normalized = String(phone || '').replace(/\s/g, '');
  if (!/^0\d{9,10}$/.test(normalized)) throw new Error('Số điện thoại không hợp lệ');
  if (!password || String(password).length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự');
  if (Object.values(state.users).some((u) => u.phone === normalized)) {
    throw new Error('Số điện thoại đã được đăng ký');
  }
  const id = Math.max(...Object.keys(state.users).map(Number)) + 1;
  const user = {
    id,
    role,
    name: name || `Khách ${normalized.slice(-4)}`,
    phone: normalized,
    email: null,
    avatarUrl: null,
    status: 'active',
    phoneVerified: true,
    createdAt: nowIso(),
  };
  state.users[id] = user;
  state.accounts[role === 'driver' ? 'driver' : 'customer'] = { phone: normalized, password };
  if (role === 'driver') {
    state.drivers.push({
      id,
      name: user.name,
      phone: normalized,
      email: null,
      status: 'active',
      createdAt: user.createdAt,
      verificationStatus: 'pending',
      onlineStatus: 'offline',
      rating: 5,
      ratingCount: 0,
      tripsCompleted: 0,
      tripsCancelled: 0,
    });
  }
  return { token: `demo.${id}.${Date.now()}`, user };
}

/* ------------------------------- Tài xế ------------------------------- */

export function driverStats(user) {
  const profile = driverProfileOf(user.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completed = state.trips.filter(
    (t) => t.driver?.id === user.id && t.status === 'completed' && new Date(t.completedAt) >= today,
  );
  return {
    onlineStatus: profile?.onlineStatus || 'offline',
    verificationStatus: profile?.verificationStatus || 'pending',
    rating: profile?.rating || 5,
    ratingCount: profile?.ratingCount || 0,
    tripsCompleted: profile?.tripsCompleted || 0,
    today: {
      trips: completed.length,
      net: completed.reduce((sum, t) => sum + (t.driverEarning || 0), 0),
    },
  };
}

export function setDriverStatus(user, status) {
  if (!['online', 'offline', 'paused'].includes(status)) throw new Error('Trạng thái không hợp lệ');
  const profile = driverProfileOf(user.id);
  if (!profile) throw new Error('Không tìm thấy hồ sơ tài xế');
  if (profile.verificationStatus !== 'approved') {
    throw new Error('Hồ sơ tài xế chưa được xác minh, chưa thể bật nhận chuyến');
  }
  profile.onlineStatus = status;
  emitLocal('driver:availability', { driverId: user.id, onlineStatus: status });
  return { onlineStatus: status };
}

export function sendDriverLocation(user, { lat, lng, heading = null }) {
  const profile = driverProfileOf(user.id);
  if (!profile) throw new Error('Không tìm thấy hồ sơ tài xế');
  const recordedAt = nowIso();
  profile.currentLocation = { lat: Number(lat), lng: Number(lng), updatedAt: recordedAt };
  const active = state.trips.find(
    (t) => t.driver?.id === user.id && ['assigned', 'arrived', 'in_progress'].includes(t.status),
  );
  if (active) {
    emitLocal('driver:location', {
      tripId: active.id,
      lat: Number(lat),
      lng: Number(lng),
      heading,
      recordedAt,
    });
  }
  return { ok: true, recordedAt };
}

export function driverEarnings(user, period = 'week') {
  const now = new Date();
  let from;
  if (period === 'day') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  }

  const completed = state.trips.filter(
    (t) => t.driver?.id === user.id && t.status === 'completed' && new Date(t.completedAt) >= from,
  );
  const cancelled = state.trips.filter(
    (t) => t.driver?.id === user.id && t.status === 'cancelled' && new Date(t.cancelledAt) >= from,
  );

  const byDay = new Map();
  for (const trip of completed) {
    const day = String(trip.completedAt).slice(0, 10);
    const entry = byDay.get(day) || { day, trips: 0, net: 0 };
    entry.trips += 1;
    entry.net += trip.driverEarning || 0;
    byDay.set(day, entry);
  }

  const profile = driverProfileOf(user.id);
  return {
    period,
    from: from.toISOString(),
    summary: {
      trips: completed.length,
      gross: completed.reduce((s, t) => s + (t.finalPrice || 0), 0),
      net: completed.reduce((s, t) => s + (t.driverEarning || 0), 0),
      commission: completed.reduce((s, t) => s + (t.commissionAmount || 0), 0),
      cancelled: cancelled.length,
      rating: profile?.rating || 5,
      ratingCount: profile?.ratingCount || 0,
      tripsCompleted: profile?.tripsCompleted || 0,
    },
    daily: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    recent: [...completed]
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        code: t.code,
        pickup: t.pickup.label,
        dropoff: t.dropoff.label,
        price: t.finalPrice,
        earning: t.driverEarning,
        completedAt: t.completedAt,
      })),
  };
}

export function updateDriverProfile(user, body) {
  const profile = driverProfileOf(user.id);
  if (!profile) throw new Error('Không tìm thấy hồ sơ tài xế');
  const map = {
    licenseNumber: 'licenseNumber',
    licenseExpiry: 'licenseExpiry',
    licenseImageUrl: 'licenseImageUrl',
    idCardNumber: 'idCardNumber',
    serviceArea: 'serviceArea',
    bio: 'bio',
  };
  let changed = false;
  for (const [key, field] of Object.entries(map)) {
    if (body[key] !== undefined) {
      profile[field] = body[key] || null;
      changed = true;
    }
  }
  if (!changed) throw new Error('Không có thông tin cần cập nhật');
  return {
    driverProfile: {
      verificationStatus: profile.verificationStatus,
      onlineStatus: profile.onlineStatus,
      licenseNumber: profile.licenseNumber,
      licenseExpiry: profile.licenseExpiry,
      idCardNumber: profile.idCardNumber,
      serviceArea: profile.serviceArea,
      bio: profile.bio,
    },
  };
}

export function addVehicle(user, body) {
  const { plate, brand, model, color, year, seats, vehicleTypeId } = body || {};
  if (!plate) throw new Error('Thiếu biển số xe');
  const type = vehicleTypeById(vehicleTypeId);
  if (!type) throw new Error('Chưa chọn loại xe');
  const id = Math.max(0, ...state.vehicles.map((v) => Number(v.id) || 0)) + 1;
  state.vehicles.push({
    id,
    driverId: user.id,
    plate,
    brand: brand || null,
    model: model || null,
    color: color || null,
    year: year ? Number(year) : null,
    seats: Number(seats) || type.seats,
    status: 'active',
    vehicleTypeId: type.id,
    typeName: type.name,
    imageUrl: null,
  });
  return { vehicleId: id };
}

export function removeVehicle(user, id) {
  const before = state.vehicles.length;
  state.vehicles = state.vehicles.filter((v) => !(v.id === Number(id) && v.driverId === user.id));
  if (state.vehicles.length === before) throw new Error('Xe không tồn tại');
  return { ok: true };
}

/* ------------------------------ Địa điểm ------------------------------ */

export function listPlaces(user) {
  return { places: state.places.filter((p) => p.userId === user.id) };
}

export function createPlace(user, body) {
  const { label, address, lat, lng, kind = 'other' } = body || {};
  if (!label || !address) throw new Error('Thiếu tên hoặc địa chỉ');
  if (kind !== 'other') state.places = state.places.filter((p) => !(p.userId === user.id && p.kind === kind));
  const place = { id: nextId('place'), userId: user.id, label, address, lat: Number(lat), lng: Number(lng), kind };
  state.places.push(place);
  return { place };
}

export function removePlace(user, id) {
  const before = state.places.length;
  state.places = state.places.filter((p) => !(p.id === Number(id) && p.userId === user.id));
  if (state.places.length === before) throw new Error('Địa điểm không tồn tại');
  return { ok: true };
}

/* ------------------------------ Yêu thích ------------------------------ */

export function listFavorites(user) {
  return { favorites: state.favorites.filter((f) => f.customerId === user.id) };
}

export function addFavorite(user, driverId) {
  const driver = driverProfileOf(driverId);
  if (!driver) throw new Error('Tài xế không tồn tại');
  if (!state.favorites.some((f) => f.customerId === user.id && f.driverId === Number(driverId))) {
    state.favorites.push({
      id: nextId('place'),
      customerId: user.id,
      driverId: Number(driverId),
      name: driver.name,
      avatarUrl: driver.avatarUrl || null,
      rating: driver.rating,
      tripsCompleted: driver.tripsCompleted,
    });
  }
  return { ok: true };
}

export function removeFavorite(user, driverId) {
  state.favorites = state.favorites.filter(
    (f) => !(f.customerId === user.id && f.driverId === Number(driverId)),
  );
  return { ok: true };
}

/* ------------------------------- Hỗ trợ ------------------------------- */

const ticketMessages = (ticket) => {
  if (!ticket.messages) {
    ticket.messages = [
      {
        id: 1,
        senderRole: 'customer',
        senderName: ticket.userName,
        body: ticket.description,
        createdAt: ticket.createdAt,
      },
    ];
  }
  return ticket.messages;
};

const publicTicket = (ticket) => {
  const { messages, ...rest } = ticket;
  return rest;
};

export function listTickets(user) {
  const list = ['admin', 'operator'].includes(user.role)
    ? state.tickets
    : state.tickets.filter((t) => t.userId === user.id);
  return { tickets: list.map(publicTicket) };
}

export function createTicket(user, body) {
  const { category, subject, description, tripId = null, priority = 'normal' } = body || {};
  if (!category || !subject || !description) throw new Error('Thiếu thông tin ticket');
  const id = nextId('ticket');
  const trip = tripId ? getTrip(tripId) : null;
  const ticket = {
    id,
    code: `TK-${String(id).padStart(5, '0')}`,
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    tripId: trip ? trip.id : null,
    tripCode: trip ? trip.code : null,
    category,
    subject,
    description,
    priority,
    status: 'open',
    messages: [
      { id: 1, senderRole: user.role, senderName: user.name, body: description, createdAt: nowIso() },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.tickets.unshift(ticket);
  return { ticket: { id, code: ticket.code, status: ticket.status } };
}

export function getTicket(user, id) {
  const ticket = state.tickets.find((t) => t.id === Number(id));
  if (!ticket) throw new Error('Ticket không tồn tại');
  if (!['admin', 'operator'].includes(user.role) && ticket.userId !== user.id) {
    throw new Error('Bạn không có quyền xem ticket này');
  }
  return { ticket: publicTicket(ticket), messages: clone(ticketMessages(ticket)) };
}

export function replyTicket(user, id, body) {
  const ticket = state.tickets.find((t) => t.id === Number(id));
  if (!ticket) throw new Error('Ticket không tồn tại');
  const text = String(body || '').trim();
  if (!text) throw new Error('Nội dung trả lời trống');
  const messages = ticketMessages(ticket);
  messages.push({
    id: messages.length + 1,
    senderRole: user.role,
    senderName: user.name,
    body: text,
    createdAt: nowIso(),
  });
  ticket.updatedAt = nowIso();
  if (user.role === 'customer') ticket.status = 'open';
  return { ok: true };
}

export function updateTicket(user, id, payload) {
  const ticket = state.tickets.find((t) => t.id === Number(id));
  if (!ticket) throw new Error('Ticket không tồn tại');
  if (payload.status) ticket.status = payload.status;
  if (payload.priority) ticket.priority = payload.priority;
  if (payload.note) {
    const messages = ticketMessages(ticket);
    messages.push({
      id: messages.length + 1,
      senderRole: user.role,
      senderName: user.name,
      body: payload.note,
      createdAt: nowIso(),
    });
  }
  ticket.updatedAt = nowIso();
  return { ok: true };
}

/* -------------------------------- Admin -------------------------------- */

function pushAudit(user, action, entity, entityId, meta = {}) {
  state.audit.unshift({
    id: nextId('event'),
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action,
    entity,
    entityId: entityId === null || entityId === undefined ? null : Number(entityId),
    meta,
    ip: '127.0.0.1',
    createdAt: nowIso(),
  });
}

export function adminOverview() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTrips = state.trips.filter((t) => new Date(t.createdAt) >= today);
  const completedToday = todayTrips.filter((t) => t.status === 'completed');
  const count = (status) => state.trips.filter((t) => t.status === status).length;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const weekTrips = state.trips.filter((t) => new Date(t.createdAt) >= weekAgo && t.status === 'completed');

  const trendMap = new Map();
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    trendMap.set(day, { day, trips: 0, gross: 0 });
  }
  for (const trip of state.trips) {
    const day = String(trip.createdAt).slice(0, 10);
    const entry = trendMap.get(day);
    if (!entry) continue;
    entry.trips += 1;
    if (trip.status === 'completed') entry.gross += trip.finalPrice || 0;
  }

  return {
    counts: {
      searching: count('searching'),
      assigned: count('assigned'),
      arrived: count('arrived'),
      inProgress: count('in_progress'),
      scheduled: count('scheduled'),
      noDriver: count('no_driver'),
      completedToday: completedToday.length,
      cancelledToday: todayTrips.filter((t) => t.status === 'cancelled').length,
      createdToday: todayTrips.length,
    },
    revenue: {
      today: {
        gross: completedToday.reduce((s, t) => s + (t.finalPrice || 0), 0),
        commission: completedToday.reduce((s, t) => s + (t.commissionAmount || 0), 0),
        driverEarning: completedToday.reduce((s, t) => s + (t.driverEarning || 0), 0),
        trips: completedToday.length,
      },
      week: {
        gross: weekTrips.reduce((s, t) => s + (t.finalPrice || 0), 0),
        commission: weekTrips.reduce((s, t) => s + (t.commissionAmount || 0), 0),
        trips: weekTrips.length,
      },
    },
    users: { customers: state.customers.length, drivers: state.drivers.length },
    drivers: {
      online: state.drivers.filter((d) => d.onlineStatus === 'online').length,
      onTrip: state.drivers.filter((d) => d.onlineStatus === 'on_trip').length,
      pendingVerification: state.drivers.filter((d) => d.verificationStatus === 'pending').length,
    },
    openTickets: state.tickets.filter((t) => t.status === 'open').length,
    trend: [...trendMap.values()],
    commissionRate: state.config.commissionRate,
  };
}

export function adminTrips({ status, q, limit = 50, offset = 0 } = {}) {
  let list = [...state.trips].sort(sortByCreatedDesc);
  if (status) list = list.filter((t) => t.status === status);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (t) =>
        t.code.toLowerCase().includes(needle) ||
        t.customer?.name?.toLowerCase().includes(needle) ||
        t.driver?.name?.toLowerCase().includes(needle) ||
        t.pickup?.label?.toLowerCase().includes(needle) ||
        t.dropoff?.label?.toLowerCase().includes(needle),
    );
  }
  return { trips: list.slice(offset, offset + limit), total: list.length };
}

export function adminTrip(id) {
  const trip = getTrip(id);
  if (!trip) throw new Error('Chuyến không tồn tại');
  return {
    trip,
    events: tripEvents(trip.id),
    offers: state.offers
      .filter((o) => o.tripId === trip.id)
      .map((o) => ({
        id: o.offerId,
        driverId: o.driverId,
        driverName: driverProfileOf(o.driverId)?.name || null,
        status: 'pending',
        round: 1,
        distanceKm: null,
        expiresAt: o.expiresAt,
        createdAt: trip.createdAt,
      })),
  };
}

export function adminAssignTrip(user, id, driverId) {
  const trip = getTrip(id);
  if (!trip) throw new Error('Chuyến không tồn tại');
  if (!driverId) throw new Error('Chưa chọn tài xế');
  if (['completed', 'cancelled'].includes(trip.status)) throw new Error('Chuyến đã kết thúc');
  assignDriver(trip, Number(driverId));
  pushAudit(user, 'trip.assign', 'trip', trip.id, { driverId: Number(driverId) });
  return { trip };
}

export function adminCancelTrip(user, id, reason) {
  const trip = cancelTrip(user, id, reason || 'Quản trị viên hủy');
  pushAudit(user, 'trip.cancel', 'trip', trip.id, { reason: reason || null });
  return { trip };
}

export function adminLive() {
  return {
    trips: state.trips.filter((t) => ACTIVE_STATUSES.includes(t.status)),
    drivers: state.drivers
      .filter((d) => d.onlineStatus !== 'offline')
      .map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        onlineStatus: d.onlineStatus,
        rating: d.rating,
        location: d.currentLocation || null,
        vehicle: vehicleOfDriver(d.id),
      })),
  };
}

export function adminDrivers({ verification, q } = {}) {
  let list = [...state.drivers];
  if (verification) list = list.filter((d) => d.verificationStatus === verification);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((d) => d.name?.toLowerCase().includes(needle) || d.phone?.includes(needle));
  }
  return {
    drivers: list.map((d) => ({
      ...d,
      location: d.currentLocation || null,
      vehicle: vehicleOfDriver(d.id),
    })),
  };
}

export function verifyDriver(user, id, approved, note) {
  const driver = driverProfileOf(id);
  if (!driver) throw new Error('Tài xế không tồn tại');
  driver.verificationStatus = approved ? 'approved' : 'rejected';
  driver.verificationNote = note || null;
  pushAudit(user, approved ? 'driver.approve' : 'driver.reject', 'driver', id, { note: note || null });
  return { ok: true, verificationStatus: driver.verificationStatus };
}

export function suspendDriver(user, id, suspended) {
  const driver = driverProfileOf(id);
  if (!driver) throw new Error('Tài xế không tồn tại');
  driver.status = suspended ? 'suspended' : 'active';
  if (suspended) driver.onlineStatus = 'offline';
  pushAudit(user, suspended ? 'driver.suspend' : 'driver.unsuspend', 'driver', id);
  return { ok: true };
}

export function adminCustomers({ q } = {}) {
  let list = [...state.customers];
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((c) => c.name?.toLowerCase().includes(needle) || c.phone?.includes(needle));
  }
  return { customers: list };
}

export function adminVehicles() {
  return {
    vehicles: state.vehicles.map((v) => ({
      ...v,
      driverName: driverProfileOf(v.driverId)?.name || null,
    })),
  };
}

export function updateVehicle(user, id, status) {
  const vehicle = state.vehicles.find((v) => v.id === Number(id));
  if (!vehicle) throw new Error('Xe không tồn tại');
  vehicle.status = status;
  pushAudit(user, 'vehicle.update', 'vehicle', id, { status });
  return { ok: true };
}

export function adminVehicleTypes() {
  return { vehicleTypes: state.vehicleTypes };
}

export function updateVehicleType(user, id, payload) {
  const type = vehicleTypeById(id);
  if (!type) throw new Error('Loại xe không tồn tại');
  Object.assign(type, payload);
  pushAudit(user, 'vehicle_type.update', 'vehicle_type', id, payload);
  return { ok: true };
}

export function createVehicleType(user, payload) {
  const id = Math.max(0, ...state.vehicleTypes.map((t) => t.id)) + 1;
  state.vehicleTypes.push({ id, active: true, ...payload });
  return { id };
}

export function adminPromos() {
  return { promos: state.promos };
}

export function createPromo(user, payload) {
  const id = Math.max(0, ...state.promos.map((p) => p.id || 0)) + 1;
  state.promos.unshift({ id, active: true, usedCount: 0, ...payload });
  return { id };
}

export function togglePromo(user, id, active) {
  const promo = state.promos.find((p) => p.id === Number(id));
  if (!promo) throw new Error('Mã khuyến mãi không tồn tại');
  promo.active = active;
  return { ok: true };
}

export function adminPayments() {
  return { payments: state.payments };
}

export function refundPayment(user, id) {
  const payment = state.payments.find((p) => p.id === Number(id));
  if (!payment) throw new Error('Giao dịch không tồn tại');
  payment.status = 'refunded';
  pushAudit(user, 'payment.refund', 'payment', id, { amount: payment.amount });
  return { ok: true };
}

export function adminTickets({ status } = {}) {
  let list = [...state.tickets];
  if (status) list = list.filter((t) => t.status === status);
  return { tickets: list.map(publicTicket) };
}

export function adminAudit() {
  return { logs: state.audit };
}

export function adminSettings() {
  return { settings: state.settings };
}

export function updateSettings(user, payload) {
  Object.assign(state.settings, payload);
  pushAudit(user, 'settings.update', 'settings', null, payload);
  return { settings: state.settings };
}

export function adminOperators() {
  return { operators: state.operators };
}

export function createOperator(user, payload) {
  const id = Math.max(0, ...state.operators.map((o) => o.id || 0)) + 1;
  state.operators.push({ id, ...payload });
  return { id };
}

export function adminReports(days = 7) {
  const from = new Date(Date.now() - Number(days) * 86_400_000);
  const list = state.trips.filter((t) => new Date(t.createdAt) >= from);

  const dailyMap = new Map();
  for (let i = Number(days) - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    dailyMap.set(day, { day, trips: 0, completed: 0, cancelled: 0, gross: 0 });
  }
  for (const trip of list) {
    const day = String(trip.createdAt).slice(0, 10);
    const entry = dailyMap.get(day);
    if (!entry) continue;
    entry.trips += 1;
    if (trip.status === 'completed') {
      entry.completed += 1;
      entry.gross += trip.finalPrice || 0;
    }
    if (trip.status === 'cancelled') entry.cancelled += 1;
  }

  const byTypeMap = new Map();
  for (const trip of list) {
    const key = trip.vehicleType?.name || 'Khác';
    const entry = byTypeMap.get(key) || { name: key, trips: 0, gross: 0 };
    entry.trips += 1;
    if (trip.status === 'completed') entry.gross += trip.finalPrice || 0;
    byTypeMap.set(key, entry);
  }

  const driverMap = new Map();
  for (const trip of list) {
    if (!trip.driver) continue;
    const entry = driverMap.get(trip.driver.id) || {
      id: trip.driver.id,
      name: trip.driver.name,
      trips: 0,
      earning: 0,
      rating: trip.driver.rating,
    };
    entry.trips += 1;
    if (trip.status === 'completed') entry.earning += trip.driverEarning || 0;
    driverMap.set(trip.driver.id, entry);
  }

  const reasonMap = new Map();
  for (const trip of list) {
    if (trip.status !== 'cancelled') continue;
    const key = trip.cancelReason || 'Khác';
    reasonMap.set(key, (reasonMap.get(key) || 0) + 1);
  }

  return {
    days: Number(days),
    daily: [...dailyMap.values()],
    byType: [...byTypeMap.values()].sort((a, b) => b.trips - a.trips),
    topDrivers: [...driverMap.values()].sort((a, b) => b.earning - a.earning).slice(0, 10),
    cancellationReasons: [...reasonMap.entries()].map(([reason, count]) => ({ reason, count })),
  };
}

/* ------------------------------- Public ------------------------------- */

export function sharedTrip(token) {
  const trip = state.trips.find((t) => t.shareToken === token);
  if (!trip) throw new Error('Liên kết chia sẻ không tồn tại hoặc đã hết hạn');
  const profile = trip.driver ? driverProfileOf(trip.driver.id) : null;
  return {
    trip: {
      code: trip.code,
      status: trip.status,
      pickup: trip.pickup,
      dropoff: trip.dropoff,
      distanceKm: trip.distanceKm,
      durationMin: trip.durationMin,
      driver: trip.driver
        ? {
            name: trip.driver.name,
            rating: trip.driver.rating,
            vehicle: trip.driver.vehicle,
          }
        : null,
      createdAt: trip.createdAt,
      completedAt: trip.completedAt,
    },
    driverLocation: profile?.currentLocation || null,
    events: tripEvents(trip.id).map((e) => ({ type: e.type, message: e.message, createdAt: e.createdAt })),
    route: routeThrough([trip.pickup, ...(trip.stops || []), trip.dropoff]),
    shareUrl: `${window.location.origin}${window.location.pathname}#/chia-se/${token}`,
  };
}

export const demoState = state;
export const demoSeed = seed;
