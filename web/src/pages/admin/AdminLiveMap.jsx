import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import MapView from '../../components/MapView';
import { Badge, EmptyState, LoadingBlock, SectionTitle, StatusBadge, Switch } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useSocket, useTheme, useToast } from '../../lib/context';
import { formatCurrency, formatTime, relativeTime } from '../../lib/format';

const REFRESH_MS = 10_000;

export default function AdminLiveMap() {
  const { theme } = useTheme();
  const { socket } = useSocket();
  const { error: toastError } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.live();
      setData(result);
    } catch (err) {
      toastError(err.message);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = () => load();
    socket.on('admin:trip_update', onUpdate);
    socket.on('driver:availability', onUpdate);
    return () => {
      socket.off('admin:trip_update', onUpdate);
      socket.off('driver:availability', onUpdate);
    };
  }, [socket, load]);

  const trips = data?.trips || [];
  const drivers = data?.drivers || [];

  const markers = useMemo(() => {
    const list = [];
    trips.forEach((trip) => {
      if (trip.pickup?.lat) {
        list.push({
          lat: trip.pickup.lat,
          lng: trip.pickup.lng,
          kind: 'pickup',
          label: 'A',
          title: `${trip.code} · ${trip.pickup.label}`,
          popup: `<strong>${trip.code}</strong><br/>${trip.pickup.label}<br/>→ ${trip.dropoff.label}`,
        });
      }
      if (trip.dropoff?.lat) {
        list.push({
          lat: trip.dropoff.lat,
          lng: trip.dropoff.lng,
          kind: 'dropoff',
          label: 'B',
          title: `${trip.code} · ${trip.dropoff.label}`,
          popup: `<strong>${trip.code}</strong><br/>${trip.dropoff.label}`,
        });
      }
      if (trip.driverLocation?.lat) {
        list.push({
          lat: trip.driverLocation.lat,
          lng: trip.driverLocation.lng,
          kind: 'driver',
          label: '',
          title: `${trip.driverName || 'Tài xế'} · ${trip.code}`,
          popup: `<strong>${trip.driverName || 'Tài xế'}</strong><br/>${trip.code}`,
        });
      }
    });
    if (showDrivers) {
      drivers.forEach((driver) => {
        if (!driver.location?.lat) return;
        list.push({
          lat: driver.location.lat,
          lng: driver.location.lng,
          kind: 'driver',
          label: '',
          title: `${driver.name} · ${driver.plate || 'chưa có xe'}`,
          popup: `<strong>${driver.name}</strong><br/>${driver.plate || ''}<br/>${driver.onlineStatus}`,
        });
      });
    }
    return list;
  }, [trips, drivers, showDrivers]);

  const center = useMemo(() => {
    if (selected?.pickup?.lat) return { lat: selected.pickup.lat, lng: selected.pickup.lng };
    const first = trips.find((trip) => trip.pickup?.lat);
    return first ? { lat: first.pickup.lat, lng: first.pickup.lng } : undefined;
  }, [selected, trips]);

  if (loading) return <LoadingBlock rows={3} />;

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Bản đồ trực tiếp"
        subtitle={`${trips.length} chuyến đang hoạt động · ${drivers.length} tài xế đang chia sẻ vị trí`}
        action={
          <div className="row" style={{ gap: 'var(--sp-3)' }}>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} label="Tự làm mới" />
            <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
              <Icon name="refresh" size={15} />
              Làm mới
            </button>
          </div>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 'var(--sp-4)' }}>
        <div className="card card--flush stack" style={{ overflow: 'hidden' }}>
          <MapView
            center={center}
            theme={theme}
            extraMarkers={markers}
            fitKey={`${trips.length}-${drivers.length}`}
            className="map-shell"
            style={{ height: 520 }}
          />
          <div className="map-legend" style={{ padding: 'var(--sp-3)' }}>
            <div className="map-legend__row">
              <span className="map-legend__swatch" style={{ background: 'var(--brand-600)' }} />
              Điểm đón (A)
            </div>
            <div className="map-legend__row">
              <span className="map-legend__swatch" style={{ background: 'var(--danger)' }} />
              Điểm trả (B)
            </div>
            <div className="map-legend__row">
              <span className="map-legend__swatch" style={{ background: 'var(--info)' }} />
              Tài xế
            </div>
            <div className="map-legend__row">
              <Switch checked={showDrivers} onChange={setShowDrivers} label="Hiện tài xế rảnh" />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="row-between">
              <strong className="text-sm">Chuyến đang hoạt động</strong>
              <Badge tone="accent">{trips.length}</Badge>
            </div>
            {trips.length === 0 ? (
              <EmptyState icon="map" title="Không có chuyến" description="Hiện chưa có chuyến nào đang hoạt động." />
            ) : (
              <div className="stack-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {trips.map((trip) => (
                  <button
                    key={trip.id}
                    type="button"
                    className="list-item list-item--button"
                    onClick={() => setSelected(trip)}
                    style={selected?.id === trip.id ? { background: 'var(--accent-soft)' } : undefined}
                  >
                    <div className="grow stack-sm" style={{ gap: 2 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="text-xs mono">{trip.code}</span>
                        <StatusBadge status={trip.status} />
                      </div>
                      <span className="text-xs truncate">{trip.pickup.label}</span>
                      <span className="text-xs muted truncate">→ {trip.dropoff.label}</span>
                      <span className="text-xs muted">
                        {trip.driverName || 'Chưa có tài xế'} · {formatCurrency(trip.price)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card stack">
            <div className="row-between">
              <strong className="text-sm">Tài xế đang chia sẻ vị trí</strong>
              <Badge tone="info">{drivers.length}</Badge>
            </div>
            {drivers.length === 0 ? (
              <EmptyState icon="users" title="Chưa có vị trí" description="Tài xế cần bật chia sẻ vị trí để hiển thị trên bản đồ." />
            ) : (
              <div className="stack-sm" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {drivers.map((driver) => (
                  <div key={driver.id} className="list-item">
                    <div className="grow stack-sm" style={{ gap: 2 }}>
                      <span className="text-sm">{driver.name}</span>
                      <span className="text-xs muted">
                        {driver.plate || 'Chưa có xe'} · {driver.onlineStatus}
                      </span>
                    </div>
                    <span className="text-xs muted">
                      {driver.location?.updatedAt ? relativeTime(driver.location.updatedAt) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="card stack">
              <div className="row-between">
                <strong className="text-sm">{selected.code}</strong>
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSelected(null)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div className="stack-sm">
                <span className="text-xs muted">Đón: {selected.pickup.label}</span>
                <span className="text-xs muted">Trả: {selected.dropoff.label}</span>
                <span className="text-xs muted">Tài xế: {selected.driverName || 'Chưa có'}</span>
                <span className="text-xs muted">Tạo lúc: {formatTime(selected.createdAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
