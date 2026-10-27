/**
 * Bản port của server/src/services/geo.js cho bản demo tĩnh.
 * Không gọi mạng: tìm kiếm/đảo ngược địa chỉ dùng bộ dữ liệu nội bộ,
 * tuyến đường dùng ước lượng đường chim bay × 1.35 (giống fallback của backend).
 */

const toRad = (deg) => (deg * Math.PI) / 180;
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

export function searchLocalPlaces(places, query, limit = 8) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored = [];
  for (const place of places) {
    const name = normalize(place.name);
    const address = normalize(place.address);
    let score = 0;
    if (name.startsWith(q)) score = 100;
    else if (name.includes(q)) score = 70;
    else if (address.includes(q)) score = 40;
    else if (normalize(place.city).includes(q)) score = 20;
    if (score > 0) scored.push({ place, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ place }) => ({
      id: `local:${place.name}`,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      city: place.city,
      kind: place.kind,
      source: 'local',
      simulated: true,
    }));
}

export function nearestLocalPlace(places, lat, lng) {
  let best = null;
  let bestDistance = Infinity;
  for (const place of places) {
    const distance = haversineKm({ lat, lng }, place);
    if (distance !== null && distance < bestDistance) {
      bestDistance = distance;
      best = place;
    }
  }
  return best;
}

export function reverseGeocode(places, lat, lng) {
  const near = nearestLocalPlace(places, lat, lng);
  return {
    name: near ? `Gần ${near.name}` : 'Vị trí đã chọn',
    address: near ? near.address : `${round(lat, 5)}, ${round(lng, 5)}`,
    lat,
    lng,
    source: 'local',
    simulated: true,
  };
}

const FALLBACK_SPEED_KMH = 26;

export function routeThrough(points) {
  const valid = (points || []).filter(
    (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)),
  );
  if (valid.length < 2) {
    return { distanceKm: 0, durationMin: 0, geometry: [], source: 'none', simulated: false };
  }

  let distance = 0;
  for (let i = 1; i < valid.length; i += 1) {
    distance += haversineKm(valid[i - 1], valid[i]) || 0;
  }
  const roadDistance = distance * 1.35;
  const durationMin = (roadDistance / FALLBACK_SPEED_KMH) * 60;

  return {
    distanceKm: round(roadDistance, 2),
    durationMin: round(durationMin, 0),
    geometry: valid.map((p) => [Number(p.lat), Number(p.lng)]),
    source: 'estimate',
    simulated: true,
  };
}
