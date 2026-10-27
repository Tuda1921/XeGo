import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · tuyến đường OSRM';

const DEFAULT_CENTER = [10.7769, 106.7009];

function pinIcon(kind, label) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin map-pin--${kind}"><span>${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

function driverIcon(heading) {
  const rotate = Number.isFinite(heading) ? heading : 0;
  return L.divIcon({
    className: '',
    html: `<div class="map-pin map-pin--driver" style="transform:rotate(${rotate}deg)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a2 2 0 0 1 2 2v3h-2m-14 0H3v-3a2 2 0 0 1 2-2m2 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/></svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

/**
 * Bản đồ Leaflet dùng chung cho đặt xe, theo dõi chuyến và bản đồ điều phối.
 * Chỉ vẽ những gì có dữ liệu thật; không tự tạo vị trí giả.
 */
export default function MapView({
  pickup,
  dropoff,
  stops = [],
  driver,
  routeGeometry,
  center,
  zoom = 13,
  theme = 'light',
  onMapClick,
  draggablePickup = false,
  draggableDropoff = false,
  onPickupDrag,
  onDropoffDrag,
  className = '',
  style,
  interactive = true,
  fitKey,
  extraMarkers = [],
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ markers: [], route: null });
  const handlersRef = useRef({ onMapClick, onPickupDrag, onDropoffDrag });

  handlersRef.current = { onMapClick, onPickupDrag, onDropoffDrag };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: center ? [center.lat, center.lng] : DEFAULT_CENTER,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      attributionControl: true,
    });

    L.tileLayer(theme === 'dark' ? TILE_DARK : TILE_LIGHT, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map);

    map.on('click', (event) => {
      handlersRef.current.onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    L.tileLayer(theme === 'dark' ? TILE_DARK : TILE_LIGHT, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
      detectRetina: true,
    }).addTo(map);
  }, [theme]);

  const points = useMemo(() => {
    const list = [];
    if (pickup?.lat) list.push([pickup.lat, pickup.lng]);
    stops.forEach((s) => s?.lat && list.push([s.lat, s.lng]));
    if (dropoff?.lat) list.push([dropoff.lat, dropoff.lng]);
    return list;
  }, [pickup, dropoff, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layersRef.current.markers.forEach((marker) => map.removeLayer(marker));
    layersRef.current.markers = [];

    if (pickup?.lat) {
      const marker = L.marker([pickup.lat, pickup.lng], {
        icon: pinIcon('pickup', 'A'),
        draggable: draggablePickup,
        title: pickup.label || 'Điểm đón',
      }).addTo(map);
      if (draggablePickup) {
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          handlersRef.current.onPickupDrag?.({ lat, lng });
        });
      }
      layersRef.current.markers.push(marker);
    }

    stops.forEach((stop, index) => {
      if (!stop?.lat) return;
      const marker = L.marker([stop.lat, stop.lng], {
        icon: pinIcon('stop', String(index + 1)),
        title: stop.label || `Điểm dừng ${index + 1}`,
      }).addTo(map);
      layersRef.current.markers.push(marker);
    });

    if (dropoff?.lat) {
      const marker = L.marker([dropoff.lat, dropoff.lng], {
        icon: pinIcon('dropoff', 'B'),
        draggable: draggableDropoff,
        title: dropoff.label || 'Điểm trả',
      }).addTo(map);
      if (draggableDropoff) {
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          handlersRef.current.onDropoffDrag?.({ lat, lng });
        });
      }
      layersRef.current.markers.push(marker);
    }

    if (driver?.lat) {
      const marker = L.marker([driver.lat, driver.lng], {
        icon: driverIcon(driver.heading),
        title: 'Vị trí tài xế',
        zIndexOffset: 500,
      }).addTo(map);
      layersRef.current.markers.push(marker);
    }

    extraMarkers.forEach((item) => {
      if (!item?.lat) return;
      const marker = L.marker([item.lat, item.lng], {
        icon: pinIcon(item.kind || 'stop', item.label || ''),
        title: item.title || '',
      }).addTo(map);
      if (item.popup) marker.bindPopup(item.popup);
      layersRef.current.markers.push(marker);
    });
  }, [pickup, dropoff, stops, driver, draggablePickup, draggableDropoff, extraMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layersRef.current.route) {
      map.removeLayer(layersRef.current.route);
      layersRef.current.route = null;
    }
    if (Array.isArray(routeGeometry) && routeGeometry.length > 1) {
      layersRef.current.route = L.polyline(routeGeometry, {
        color: '#00a67e',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(map);
    }
  }, [routeGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points).pad(0.22), { animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], Math.max(zoom, 15), { animate: true });
    } else if (center?.lat) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, points.length, center?.lat, center?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = setTimeout(() => map.invalidateSize(), 220);
    return () => clearTimeout(id);
  }, [className, style]);

  return (
    <div
      ref={containerRef}
      className={`map-shell ${className}`.trim()}
      style={style}
      role="application"
      aria-label="Bản đồ"
    />
  );
}
