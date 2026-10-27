import { config } from '../config.js';
import { haversineKm, round } from '../utils.js';
import { searchLocalPlaces, nearestLocalPlace } from '../data/places-vn.js';

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.geo.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': config.geo.userAgent,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tìm địa điểm theo từ khoá.
 * Ưu tiên Nominatim (OpenStreetMap). Nếu lỗi/không có mạng, trả về dữ liệu nội bộ
 * và đánh dấu simulated=true để UI hiển thị rõ đây là dữ liệu mô phỏng.
 */
export async function searchPlaces(query, { limit = 8, near = null } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return { results: [], source: 'none', simulated: false };

  const key = `search:${q}:${limit}:${near ? `${near.lat},${near.lng}` : ''}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'vn',
    'accept-language': 'vi',
  });
  if (near) {
    const d = 0.6;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    params.set('bounded', '0');
  }

  try {
    const data = await fetchJson(`${config.geo.geocoderUrl}/search?${params.toString()}`);
    const results = (Array.isArray(data) ? data : [])
      .map((item) => ({
        id: `osm:${item.osm_type || 'node'}/${item.osm_id || item.place_id}`,
        name: item.name || item.display_name.split(',')[0],
        address: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        city: item.address?.city || item.address?.town || item.address?.state || '',
        kind: item.type || 'place',
        source: 'osm',
        simulated: false,
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    if (results.length) {
      return cacheSet(key, { results, source: 'osm', simulated: false });
    }
  } catch (error) {
    // rơi xuống dữ liệu nội bộ
  }

  const local = searchLocalPlaces(q, limit);
  return cacheSet(key, { results: local, source: 'local', simulated: true });
}

/** Đảo ngược toạ độ -> địa chỉ. */
export async function reverseGeocode(lat, lng) {
  const key = `reverse:${round(lat, 5)},${round(lng, 5)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    'accept-language': 'vi',
    zoom: '18',
  });

  try {
    const data = await fetchJson(`${config.geo.geocoderUrl}/reverse?${params.toString()}`);
    if (data && data.display_name) {
      return cacheSet(key, {
        name: data.name || data.display_name.split(',')[0],
        address: data.display_name,
        lat: Number(data.lat ?? lat),
        lng: Number(data.lon ?? lng),
        source: 'osm',
        simulated: false,
      });
    }
  } catch {
    // ignore
  }

  const near = nearestLocalPlace(lat, lng);
  return cacheSet(key, {
    name: near ? `Gần ${near.name}` : 'Vị trí đã chọn',
    address: near ? near.address : `${round(lat, 5)}, ${round(lng, 5)}`,
    lat,
    lng,
    source: 'local',
    simulated: true,
  });
}

const FALLBACK_SPEED_KMH = 26;

function fallbackRoute(points) {
  let distance = 0;
  for (let i = 1; i < points.length; i += 1) {
    distance += haversineKm(points[i - 1], points[i]) || 0;
  }
  // Hệ số 1.35 ước lượng đường đi thực tế dài hơn đường chim bay.
  const roadDistance = distance * 1.35;
  const durationMin = (roadDistance / FALLBACK_SPEED_KMH) * 60;
  return {
    distanceKm: round(roadDistance, 2),
    durationMin: round(durationMin, 0),
    geometry: points.map((p) => [p.lat, p.lng]),
    source: 'estimate',
    simulated: true,
  };
}

/**
 * Tính tuyến đường qua OSRM. Nếu không gọi được, trả về ước lượng đường chim bay
 * với cờ simulated=true (UI phải hiển thị rõ đây là ước tính).
 */
export async function routeThrough(points) {
  const valid = (points || []).filter(
    (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)),
  );
  if (valid.length < 2) {
    return { distanceKm: 0, durationMin: 0, geometry: [], source: 'none', simulated: false };
  }

  const key = `route:${valid.map((p) => `${round(p.lat, 4)},${round(p.lng, 4)}`).join('|')}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${config.geo.routerUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  try {
    const data = await fetchJson(url);
    const route = data?.routes?.[0];
    if (route) {
      const geometry = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
      return cacheSet(key, {
        distanceKm: round(route.distance / 1000, 2),
        durationMin: round(route.duration / 60, 0),
        geometry,
        source: 'osrm',
        simulated: false,
      });
    }
  } catch {
    // ignore
  }

  return cacheSet(key, fallbackRoute(valid));
}

/** Ước lượng nhanh không gọi mạng, dùng cho tính giá sơ bộ. */
export function quickDistance(points) {
  const valid = (points || []).filter((p) => p && Number.isFinite(Number(p.lat)));
  if (valid.length < 2) return 0;
  let distance = 0;
  for (let i = 1; i < valid.length; i += 1) {
    distance += haversineKm(valid[i - 1], valid[i]) || 0;
  }
  return round(distance * 1.35, 2);
}
