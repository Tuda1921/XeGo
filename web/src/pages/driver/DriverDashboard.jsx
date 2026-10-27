import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import MapView from '../../components/MapView';
import {
  Alert,
  Avatar,
  Badge,
  Countdown,
  EmptyState,
  KV,
  Modal,
  Plate,
  SectionTitle,
  StatusBadge,
  Switch,
} from '../../components/ui';
import { driver as driverApi, trips as tripsApi } from '../../lib/api';
import { useAuth, useSocket, useTheme, useToast } from '../../lib/context';
import useGeolocation from '../../lib/useGeolocation';
import {
  VERIFICATION_STATUS,
  formatCurrency,
  formatDistance,
  formatDuration,
} from '../../lib/format';

const ACTIVE_STATUSES = ['assigned', 'arrived', 'in_progress'];

export default function DriverDashboard() {
  const { driverProfile, vehicles, refresh } = useAuth();
  const { socket } = useSocket();
  const { theme } = useTheme();
  const { success, error: toastError, info } = useToast();
  const geo = useGeolocation();

  const [offers, setOffers] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(null);
  const [declineReason, setDeclineReason] = useState('Bận việc đột xuất');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeForm, setCompleteForm] = useState({ distanceKm: '', durationMin: '', note: '' });
  const [locationSharing, setLocationSharing] = useState(false);
  const locationTimer = useRef(null);
  const positionRef = useRef(null);
  positionRef.current = geo.position;

  const onlineStatus = driverProfile?.onlineStatus || 'offline';
  const verification = driverProfile?.verificationStatus || 'pending';
  const approved = verification === 'approved';
  const isOnline = onlineStatus === 'online' || onlineStatus === 'on_trip';

  const loadOffers = useCallback(async () => {
    try {
      const data = await driverApi.offers();
      setOffers(data.offers || []);
    } catch {
      setOffers([]);
    }
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const data = await tripsApi.active();
      const trip = (data.trips || []).find((t) => ACTIVE_STATUSES.includes(t.status));
      setActiveTrip(trip || null);
      if (trip) {
        setCompleteForm({
          distanceKm: String(trip.distanceKm || ''),
          durationMin: String(trip.durationMin || ''),
          note: '',
        });
      }
    } catch {
      setActiveTrip(null);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await driverApi.stats();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadOffers();
    loadActive();
    loadStats();
    const id = setInterval(() => {
      loadOffers();
      loadActive();
    }, 20_000);
    return () => clearInterval(id);
  }, [loadOffers, loadActive, loadStats]);

  useEffect(() => {
    if (!socket) return undefined;
    const onOffer = (payload) => {
      setOffers((prev) => (prev.some((o) => o.offerId === payload.offerId) ? prev : [payload, ...prev]));
      info(`Cuốc mới: ${payload.trip?.pickup?.label} → ${payload.trip?.dropoff?.label}`);
    };
    const onOfferClosed = (payload) => {
      setOffers((prev) => prev.filter((o) => o.offerId !== payload.offerId));
    };
    const onTripUpdate = (payload) => {
      if (!payload?.trip) return;
      if (ACTIVE_STATUSES.includes(payload.trip.status)) {
        setActiveTrip(payload.trip);
      } else if (['completed', 'cancelled'].includes(payload.trip.status)) {
        setActiveTrip(null);
        loadStats();
      }
    };
    socket.on('trip:offer', onOffer);
    socket.on('trip:offer_closed', onOfferClosed);
    socket.on('trip:offer_expired', onOfferClosed);
    socket.on('trip:update', onTripUpdate);
    return () => {
      socket.off('trip:offer', onOffer);
      socket.off('trip:offer_closed', onOfferClosed);
      socket.off('trip:offer_expired', onOfferClosed);
      socket.off('trip:update', onTripUpdate);
    };
  }, [socket, info, loadStats]);

  // Chia sẻ vị trí thật từ thiết bị khi tài xế bật.
  useEffect(() => {
    if (!locationSharing) {
      if (locationTimer.current) clearInterval(locationTimer.current);
      geo.stopWatch();
      return undefined;
    }
    geo.watch();
    locationTimer.current = setInterval(() => {
      const pos = positionRef.current;
      if (pos) driverApi.sendLocation({ lat: pos.lat, lng: pos.lng }).catch(() => {});
    }, 12_000);
    return () => {
      if (locationTimer.current) clearInterval(locationTimer.current);
    };
  }, [locationSharing, geo.watch, geo.stopWatch]);

  const toggleOnline = async (next) => {
    setBusy(true);
    try {
      await driverApi.setStatus(next ? 'online' : 'offline');
      await refresh();
      success(next ? 'Đã bật nhận chuyến' : 'Đã tắt nhận chuyến');
      if (next) {
        setLocationSharing(true);
        loadOffers();
      } else {
        setLocationSharing(false);
        setOffers([]);
      }
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const accept = async (offer) => {
    setBusy(true);
    try {
      const data = await driverApi.accept(offer.offerId);
      success('Đã nhận chuyến');
      setOffers((prev) => prev.filter((o) => o.offerId !== offer.offerId));
      setActiveTrip(data.trip);
      await refresh();
    } catch (err) {
      toastError(err.message);
      setOffers((prev) => prev.filter((o) => o.offerId !== offer.offerId));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!declineOpen) return;
    try {
      await driverApi.decline(declineOpen.offerId, declineReason);
      setOffers((prev) => prev.filter((o) => o.offerId !== declineOpen.offerId));
      setDeclineOpen(null);
    } catch (err) {
      toastError(err.message);
    }
  };

  const markArrived = async () => {
    setBusy(true);
    try {
      const data = await driverApi.arrived(activeTrip.id);
      setActiveTrip(data.trip);
      success('Đã xác nhận tới điểm đón');
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const data = await driverApi.start(activeTrip.id);
      setActiveTrip(data.trip);
      success('Chuyến đã bắt đầu');
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await driverApi.complete(activeTrip.id, {
        distanceKm: Number(completeForm.distanceKm) || undefined,
        durationMin: Number(completeForm.durationMin) || undefined,
        note: completeForm.note || undefined,
      });
      success('Đã hoàn thành chuyến');
      setCompleteOpen(false);
      setActiveTrip(null);
      await refresh();
      loadStats();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const vehicle = vehicles[0];

  if (!approved) {
    const meta = VERIFICATION_STATUS[verification] || VERIFICATION_STATUS.pending;
    return (
      <div className="driver-shell">
        <div className="card stack">
          <div className="row-between">
            <h2>Hồ sơ tài xế</h2>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <Alert tone={verification === 'rejected' ? 'danger' : 'warning'} title={meta.label}>
            {verification === 'rejected'
              ? driverProfile?.verificationNote || 'Hồ sơ của bạn bị từ chối. Vui lòng cập nhật giấy tờ và gửi lại.'
              : 'Bạn cần hoàn tất hồ sơ và được quản trị viên xác minh trước khi có thể nhận chuyến.'}
          </Alert>
          <div className="stack-sm">
            <KV label="Bằng lái" value={driverProfile?.licenseNumber || 'Chưa cập nhật'} />
            <KV label="CCCD" value={driverProfile?.idCardNumber || 'Chưa cập nhật'} />
            <KV label="Khu vực" value={driverProfile?.serviceArea || 'Chưa cập nhật'} />
            <KV label="Phương tiện" value={vehicle ? `${vehicle.plate} · ${vehicle.typeName || ''}` : 'Chưa đăng ký'} />
          </div>
          <Link to="/tai-xe/ho-so" className="btn btn--primary">
            <Icon name="edit" size={16} />
            Cập nhật hồ sơ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-shell">
      <div className="stack">
        <div className="online-toggle">
          <div className="stack-sm" style={{ gap: 2 }}>
            <span className="text-sm strong">
              {onlineStatus === 'on_trip' ? 'Đang thực hiện chuyến' : isOnline ? 'Đang nhận chuyến' : 'Ngoại tuyến'}
            </span>
            <span className="text-xs muted">
              {isOnline ? 'Bạn sẽ nhận được cuốc phù hợp với xe và khu vực.' : 'Bật để bắt đầu nhận cuốc.'}
            </span>
          </div>
          <Switch
            checked={isOnline}
            onChange={toggleOnline}
            disabled={busy || onlineStatus === 'on_trip'}
            label={isOnline ? 'Bật' : 'Tắt'}
          />
        </div>

        {stats && (
          <div className="grid grid-3" style={{ gap: 'var(--sp-2)' }}>
            <div className="stat-card">
              <span className="stat-card__label">Hôm nay</span>
              <span className="stat-card__value" style={{ fontSize: 'var(--fs-xl)' }}>
                {stats.today?.trips || 0}
              </span>
              <span className="stat-card__meta">chuyến</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Thu nhập</span>
              <span className="stat-card__value" style={{ fontSize: 'var(--fs-lg)' }}>
                {formatCurrency(stats.today?.net || 0)}
              </span>
              <span className="stat-card__meta">hôm nay</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Đánh giá</span>
              <span className="stat-card__value" style={{ fontSize: 'var(--fs-xl)' }}>
                {Number(stats.rating || 5).toFixed(1)}
              </span>
              <span className="stat-card__meta">{stats.ratingCount || 0} lượt</span>
            </div>
          </div>
        )}

        {locationSharing && (
          <div className="row-between card card--soft" style={{ padding: 'var(--sp-3)' }}>
            <span className="text-xs muted row" style={{ gap: 6 }}>
              <span className="dot dot--pulse" style={{ background: 'var(--success)' }} />
              {geo.status === 'granted' ? 'Đang chia sẻ vị trí thật từ thiết bị' : 'Đang chờ quyền truy cập vị trí…'}
            </span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setLocationSharing(false)}>
              Tắt
            </button>
          </div>
        )}

        {geo.status === 'denied' && locationSharing && (
          <Alert tone="warning" title="Không có quyền vị trí">
            Khách sẽ không thấy vị trí của bạn. Hãy bật quyền vị trí trong trình duyệt để chia sẻ hành trình.
          </Alert>
        )}

        {activeTrip ? (
          <div className="card stack">
            <div className="row-between">
              <div className="stack-sm" style={{ gap: 2 }}>
                <span className="eyebrow">Chuyến đang thực hiện</span>
                <strong>{activeTrip.code}</strong>
              </div>
              <StatusBadge status={activeTrip.status} />
            </div>

            <MapView
              pickup={activeTrip.pickup}
              dropoff={activeTrip.dropoff}
              stops={activeTrip.stops || []}
              driver={geo.position}
              theme={theme}
              fitKey={activeTrip.status}
              className="map-shell"
            />

            <div className="stack-sm">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="route-marker route-marker--pickup">A</span>
                <div className="stack-sm" style={{ gap: 1 }}>
                  <strong className="text-sm">{activeTrip.pickup.label}</strong>
                  <span className="text-xs muted">{activeTrip.pickup.address}</span>
                </div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="route-marker route-marker--dropoff">B</span>
                <div className="stack-sm" style={{ gap: 1 }}>
                  <strong className="text-sm">{activeTrip.dropoff.label}</strong>
                  <span className="text-xs muted">{activeTrip.dropoff.address}</span>
                </div>
              </div>
            </div>

            <div className="driver-card">
              <Avatar name={activeTrip.customer?.name} src={activeTrip.customer?.avatarUrl} />
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <strong className="text-sm">{activeTrip.customer?.name}</strong>
                <span className="text-xs muted">
                  {activeTrip.passengers} khách · {activeTrip.luggage} kiện
                </span>
                {activeTrip.notes && <span className="text-xs muted clamp-2">“{activeTrip.notes}”</span>}
              </div>
              {activeTrip.customerPhone && (
                <a href={`tel:${activeTrip.customerPhone}`} className="btn btn--icon btn--soft" aria-label="Gọi khách">
                  <Icon name="phone" size={16} />
                </a>
              )}
            </div>

            <div className="stack-sm">
              <KV label="Quãng đường" value={formatDistance(activeTrip.distanceKm)} />
              <KV label="Thời gian dự kiến" value={formatDuration(activeTrip.durationMin)} />
              <KV label="Thu nhập dự kiến" value={formatCurrency(activeTrip.driverEarning)} />
              <KV label="Thanh toán" value={activeTrip.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản/online'} />
            </div>

            <div className="btn-row">
              {activeTrip.status === 'assigned' && (
                <button type="button" className="btn btn--primary btn--block" onClick={markArrived} disabled={busy}>
                  <Icon name="pin" size={16} />
                  Đã tới điểm đón
                </button>
              )}
              {activeTrip.status === 'arrived' && (
                <button type="button" className="btn btn--primary btn--block" onClick={start} disabled={busy}>
                  <Icon name="play" size={16} />
                  Bắt đầu chuyến
                </button>
              )}
              {activeTrip.status === 'in_progress' && (
                <button type="button" className="btn btn--primary btn--block" onClick={() => setCompleteOpen(true)} disabled={busy}>
                  <Icon name="flag" size={16} />
                  Hoàn thành chuyến
                </button>
              )}
              <Link to={`/chuyen/${activeTrip.id}`} className="btn btn--ghost btn--block">
                <Icon name="message" size={16} />
                Nhắn tin / chi tiết
              </Link>
            </div>
          </div>
        ) : (
          <>
            <SectionTitle
              title="Cuốc xe dành cho bạn"
              subtitle={isOnline ? 'Cuốc mới sẽ xuất hiện tự động khi có khách phù hợp.' : 'Bật nhận chuyến để nhận cuốc.'}
              action={
                <button type="button" className="btn btn--sm btn--ghost" onClick={loadOffers}>
                  <Icon name="refresh" size={15} />
                  Làm mới
                </button>
              }
            />

            {offers.length === 0 ? (
              <EmptyState
                icon={isOnline ? 'search' : 'power'}
                title={isOnline ? 'Đang chờ cuốc mới' : 'Bạn đang ngoại tuyến'}
                description={
                  isOnline
                    ? 'Hệ thống sẽ gửi cuốc phù hợp với loại xe và khu vực hoạt động của bạn.'
                    : 'Bật công tắc phía trên để bắt đầu nhận chuyến.'
                }
              />
            ) : (
              offers.map((offer) => (
                <div key={offer.offerId} className="offer-card">
                  <div className="offer-card__head">
                    <div className="row" style={{ gap: 8 }}>
                      <Icon name="car" size={16} />
                      <strong className="text-sm">Cuốc mới</strong>
                      <Badge tone="accent">{offer.code}</Badge>
                    </div>
                    <Countdown
                      expiresAt={offer.expiresAt}
                      onExpire={() => setOffers((prev) => prev.filter((o) => o.offerId !== offer.offerId))}
                    />
                  </div>
                  <div className="offer-card__body">
                    <div className="stack-sm">
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <span className="route-marker route-marker--pickup">A</span>
                        <div className="stack-sm" style={{ gap: 1 }}>
                          <strong className="text-sm">{offer.trip.pickup.label}</strong>
                          <span className="text-xs muted clamp-2">{offer.trip.pickup.address}</span>
                        </div>
                      </div>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <span className="route-marker route-marker--dropoff">B</span>
                        <div className="stack-sm" style={{ gap: 1 }}>
                          <strong className="text-sm">{offer.trip.dropoff.label}</strong>
                          <span className="text-xs muted clamp-2">{offer.trip.dropoff.address}</span>
                        </div>
                      </div>
                    </div>

                    <div className="row-wrap text-xs">
                      <Badge tone="default">
                        <Icon name="navigation" size={12} /> {formatDistance(offer.distanceToPickupKm)} tới đón
                      </Badge>
                      <Badge tone="default">
                        <Icon name="route" size={12} /> {formatDistance(offer.trip.distanceKm)}
                      </Badge>
                      <Badge tone="default">
                        <Icon name="clock" size={12} /> {formatDuration(offer.trip.durationMin)}
                      </Badge>
                      <Badge tone="default">
                        <Icon name="users" size={12} /> {offer.trip.passengers} khách
                      </Badge>
                    </div>

                    {offer.trip.specialRequests?.length > 0 && (
                      <span className="text-xs" style={{ color: 'var(--warning)' }}>
                        Yêu cầu: {offer.trip.specialRequests.join(', ')}
                      </span>
                    )}

                    <div className="row-between">
                      <span className="text-xs muted">Thu nhập dự kiến</span>
                      <strong className="text-lg mono">{formatCurrency(offer.trip.driverEarning)}</strong>
                    </div>
                  </div>
                  <div className="offer-card__foot">
                    <button type="button" className="btn btn--ghost grow" onClick={() => setDeclineOpen(offer)}>
                      Từ chối
                    </button>
                    <button type="button" className="btn btn--primary grow" onClick={() => accept(offer)} disabled={busy}>
                      Nhận cuốc
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {vehicle && (
          <div className="card card--soft stack-sm">
            <span className="text-xs strong uppercase muted">Phương tiện đang hoạt động</span>
            <div className="row-between">
              <div className="stack-sm" style={{ gap: 1 }}>
                <strong className="text-sm">
                  {vehicle.brand} {vehicle.model}
                </strong>
                <span className="text-xs muted">
                  {vehicle.typeName} · {vehicle.seats} chỗ · {vehicle.color}
                </span>
              </div>
              <Plate>{vehicle.plate}</Plate>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(declineOpen)}
        onClose={() => setDeclineOpen(null)}
        title="Từ chối cuốc"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDeclineOpen(null)}>
              Quay lại
            </button>
            <button type="button" className="btn btn--danger" onClick={decline}>
              Xác nhận từ chối
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="text-sm muted">Từ chối nhiều cuốc liên tiếp có thể ảnh hưởng đến tỷ lệ nhận cuốc của bạn.</p>
          <label className="field">
            <span className="label">Lý do</span>
            <select className="select" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}>
              <option>Bận việc đột xuất</option>
              <option>Quá xa điểm đón</option>
              <option>Không phù hợp tuyến đường</option>
              <option>Xe không đủ chỗ</option>
              <option>Khác</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Hoàn thành chuyến"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCompleteOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={complete} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Xác nhận hoàn thành'}
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="text-sm muted">
            Xác nhận quãng đường và thời gian thực tế để hệ thống tính giá cuối cùng và thu nhập của bạn.
          </p>
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            <label className="field">
              <span className="label">Quãng đường (km)</span>
              <input
                className="input"
                type="number"
                step="0.1"
                min="0"
                value={completeForm.distanceKm}
                onChange={(e) => setCompleteForm((p) => ({ ...p, distanceKm: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="label">Thời gian (phút)</span>
              <input
                className="input"
                type="number"
                min="0"
                value={completeForm.durationMin}
                onChange={(e) => setCompleteForm((p) => ({ ...p, durationMin: e.target.value }))}
              />
            </label>
          </div>
          <label className="field">
            <span className="label">Ghi chú (không bắt buộc)</span>
            <textarea
              className="textarea"
              value={completeForm.note}
              onChange={(e) => setCompleteForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Ví dụ: khách đổi điểm trả, chờ 10 phút…"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
