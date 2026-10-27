import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon, { Logo } from '../components/Icon';
import MapView from '../components/MapView';
import { Alert, Badge, EmptyState, KV, StatusBadge } from '../components/ui';
import { publicApi } from '../lib/api';
import { useTheme } from '../lib/context';
import { formatCurrency, formatDateTime, formatDistance, formatDuration } from '../lib/format';

export default function ShareTrip() {
  const { token } = useParams();
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await publicApi.trip(token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="page center" style={{ minHeight: '60vh' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page page--narrow">
        <EmptyState
          icon="alert"
          title="Liên kết không hợp lệ"
          description={error || 'Liên kết chia sẻ đã hết hạn hoặc không tồn tại.'}
          action={
            <Link to="/" className="btn btn--primary">
              Về trang chủ
            </Link>
          }
        />
      </div>
    );
  }

  const { trip, driverLocation, events } = data;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" aria-label="XeGo">
          <Logo />
        </Link>
        <div className="header-actions">
          <Badge tone="info">
            <Icon name="eye" size={13} /> Chế độ chỉ xem
          </Badge>
        </div>
      </header>

      <main className="page page--wide">
        <div className="tracking-layout">
          <div className="stack">
            <MapView
              className="tracking-map"
              pickup={trip.pickup}
              dropoff={trip.dropoff}
              stops={trip.stops || []}
              driver={driverLocation}
              routeGeometry={data.route?.geometry}
              theme={theme}
              interactive={false}
              fitKey={trip.status}
            />
            <div className="row-wrap">
              <Badge tone="default">{trip.code}</Badge>
              <StatusBadge status={trip.status} />
              <span className="text-xs muted">
                {formatDistance(trip.distanceKm)} · {formatDuration(trip.durationMin)}
              </span>
            </div>
          </div>

          <div className="stack">
            <div className="card stack">
              <div className="stack-sm">
                <span className="eyebrow">Hành trình được chia sẻ</span>
                <h2>{trip.customer?.name} đang di chuyển</h2>
              </div>

              <div className="stack-sm">
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="route-marker route-marker--pickup">A</span>
                  <div className="stack-sm" style={{ gap: 1 }}>
                    <strong className="text-sm">{trip.pickup.label}</strong>
                    <span className="text-xs muted">{trip.pickup.address}</span>
                  </div>
                </div>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="route-marker route-marker--dropoff">B</span>
                  <div className="stack-sm" style={{ gap: 1 }}>
                    <strong className="text-sm">{trip.dropoff.label}</strong>
                    <span className="text-xs muted">{trip.dropoff.address}</span>
                  </div>
                </div>
              </div>

              <hr className="divider" />

              <div className="stack-sm">
                {trip.driver && <KV label="Tài xế" value={trip.driver.name} />}
                {trip.driver?.vehicle?.plate && <KV label="Biển số" value={trip.driver.vehicle.plate} />}
                {trip.driver?.phone && <KV label="Liên hệ" value={trip.driver.phone} />}
                <KV label="Loại xe" value={trip.vehicleType?.name} />
                <KV label="Giá ước tính" value={formatCurrency(trip.estimatedPrice)} />
                {trip.completedAt && <KV label="Hoàn thành" value={formatDateTime(trip.completedAt)} />}
              </div>

              {!driverLocation && ['assigned', 'arrived', 'in_progress'].includes(trip.status) && (
                <Alert tone="info" title="Chưa có vị trí tài xế">
                  Tài xế chưa cập nhật vị trí. Trạng thái chuyến vẫn được làm mới tự động.
                </Alert>
              )}
            </div>

            <div className="card stack">
              <span className="text-sm strong">Diễn biến chuyến đi</span>
              <div className="timeline">
                {events.map((event, index) => (
                  <div key={index} className="timeline__item timeline__item--done">
                    <span className="timeline__dot">
                      <Icon name="check" size={11} />
                    </span>
                    <div className="stack-sm" style={{ gap: 1 }}>
                      <strong className="text-sm">{event.message}</strong>
                      <span className="text-xs muted">{formatDateTime(event.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs subtle text-center">
              Trang này chỉ hiển thị thông tin cần thiết. Số điện thoại đã được ẩn một phần để bảo vệ quyền riêng tư.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
