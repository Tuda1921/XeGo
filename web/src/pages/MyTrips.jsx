import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { Badge, EmptyState, LoadingBlock, SectionTitle, StatusBadge, Tabs } from '../components/ui';
import { trips as tripsApi } from '../lib/api';
import { useSocket, useToast } from '../lib/context';
import { formatCurrency, formatDateTime, formatDistance, statusLabel } from '../lib/format';

const ACTIVE = ['scheduled', 'searching', 'assigned', 'arrived', 'in_progress', 'no_driver'];

export default function MyTrips() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { info } = useToast();
  const [tab, setTab] = useState('active');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await tripsApi.list({ limit: 50 });
      setTrips(data.trips || []);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = (payload) => {
      if (!payload?.trip) return;
      setTrips((prev) => {
        const exists = prev.some((t) => t.id === payload.trip.id);
        if (!exists) return [payload.trip, ...prev];
        return prev.map((t) => (t.id === payload.trip.id ? payload.trip : t));
      });
      if (payload.trip.status === 'assigned') info(`Tài xế đã nhận chuyến ${payload.trip.code}`);
    };
    socket.on('trip:update', onUpdate);
    return () => socket.off('trip:update', onUpdate);
  }, [socket, info]);

  const active = useMemo(() => trips.filter((t) => ACTIVE.includes(t.status)), [trips]);
  const history = useMemo(() => trips.filter((t) => !ACTIVE.includes(t.status)), [trips]);
  const shown = tab === 'active' ? active : history;

  return (
    <div className="page page--narrow">
      <SectionTitle
        title="Chuyến của tôi"
        subtitle="Theo dõi chuyến đang thực hiện và xem lại lịch sử."
        action={
          <Link to="/dat-xe" className="btn btn--primary btn--sm">
            <Icon name="plus" size={15} />
            Đặt chuyến mới
          </Link>
        }
      />

      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <Tabs
          items={[
            { value: 'active', label: 'Đang thực hiện', count: active.length },
            { value: 'history', label: 'Lịch sử', count: history.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="car"
          title={tab === 'active' ? 'Không có chuyến đang thực hiện' : 'Chưa có chuyến nào trong lịch sử'}
          description={
            tab === 'active'
              ? 'Bạn chưa có chuyến nào đang chạy. Hãy đặt chuyến mới để bắt đầu.'
              : 'Các chuyến đã hoàn thành hoặc đã hủy sẽ xuất hiện ở đây.'
          }
          action={
            <Link to="/dat-xe" className="btn btn--primary">
              Đặt xe ngay
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {shown.map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="card stack"
              onClick={() => navigate(`/chuyen/${trip.id}`)}
              style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
            >
              <div className="row-between">
                <div className="row" style={{ gap: 8 }}>
                  <Badge tone="default">{trip.code}</Badge>
                  <StatusBadge status={trip.status} />
                </div>
                <span className="text-xs muted">{formatDateTime(trip.createdAt)}</span>
              </div>

              <div className="stack-sm">
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="route-marker route-marker--pickup">A</span>
                  <span className="text-sm truncate">{trip.pickup.label}</span>
                </div>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="route-marker route-marker--dropoff">B</span>
                  <span className="text-sm truncate">{trip.dropoff.label}</span>
                </div>
              </div>

              <div className="row-between">
                <span className="text-xs muted">
                  {trip.vehicleType?.name} · {formatDistance(trip.distanceKm)}
                  {trip.driver ? ` · ${trip.driver.name}` : ''}
                </span>
                <strong className="text-sm mono">{formatCurrency(trip.finalPrice || trip.estimatedPrice)}</strong>
              </div>

              {trip.status === 'completed' && !trip.rating && (
                <span className="text-xs" style={{ color: 'var(--warning)' }}>
                  <Icon name="star" size={12} /> Chưa đánh giá chuyến này
                </span>
              )}
              {trip.status === 'cancelled' && trip.cancelReason && (
                <span className="text-xs muted">Lý do hủy: {trip.cancelReason}</span>
              )}
              {trip.status === 'no_driver' && (
                <span className="text-xs" style={{ color: 'var(--danger)' }}>
                  {statusLabel(trip.status)} — bạn có thể thử tìm lại tài xế
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
