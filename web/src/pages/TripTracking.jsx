import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import MapView from '../components/MapView';
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  KV,
  Modal,
  Plate,
  SectionTitle,
  StarRating,
  StatusBadge,
} from '../components/ui';
import { trips as tripsApi, favorites as favoritesApi } from '../lib/api';
import { useAuth, useSocket, useTheme, useToast } from '../lib/context';
import {
  CANCEL_REASONS,
  PAYMENT_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  formatDateTime,
  formatDistance,
  formatDuration,
  formatTime,
  relativeTime,
} from '../lib/format';

const ACTIVE_STATUSES = ['scheduled', 'searching', 'assigned', 'arrived', 'in_progress', 'no_driver'];

export default function TripTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { socket } = useSocket();
  const { success, error: toastError, info } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [driverLocation, setDriverLocation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const chatRef = useRef(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await tripsApi.get(id);
        setData(result);
        setMessages(result.messages || []);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = (payload) => {
      if (String(payload?.trip?.id) !== String(id)) return;
      setData((prev) => (prev ? { ...prev, trip: payload.trip } : prev));
      if (payload.trip.status === 'assigned') info('Tài xế đã nhận chuyến');
      if (payload.trip.status === 'arrived') info('Tài xế đã tới điểm đón');
      if (payload.trip.status === 'in_progress') info('Chuyến đã bắt đầu');
      if (payload.trip.status === 'completed') success('Chuyến đã hoàn thành');
      if (payload.trip.status === 'no_driver') toastError('Chưa tìm được tài xế phù hợp');
    };
    const onLocation = (payload) => {
      if (String(payload?.tripId) !== String(id)) return;
      setDriverLocation({ lat: payload.lat, lng: payload.lng, heading: payload.heading, at: payload.recordedAt });
    };
    const onMessage = (payload) => {
      if (String(payload?.tripId) !== String(id)) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
    };

    socket.on('trip:update', onUpdate);
    socket.on('driver:location', onLocation);
    socket.on('trip:message', onMessage);
    return () => {
      socket.off('trip:update', onUpdate);
      socket.off('driver:location', onLocation);
      socket.off('trip:message', onMessage);
    };
  }, [socket, id, success, info, toastError]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages.length]);

  const trip = data?.trip;
  const isActive = trip && ACTIVE_STATUSES.includes(trip.status);
  const isCustomer = user?.role === 'customer' && trip?.customer?.id === user?.id;

  const driverPoint = useMemo(() => {
    if (driverLocation) return driverLocation;
    if (data?.eta && trip?.driver) {
      // Chỉ dùng vị trí do backend trả về; không tự tạo toạ độ.
      return null;
    }
    return null;
  }, [driverLocation, data, trip]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const body = chatText.trim();
    if (!body) return;
    setChatText('');
    try {
      const result = await tripsApi.sendMessage(id, body);
      setMessages((prev) => (prev.some((m) => m.id === result.message.id) ? prev : [...prev, result.message]));
    } catch (err) {
      toastError(err.message);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await tripsApi.cancel(id, cancelReason);
      success('Đã hủy chuyến');
      setCancelOpen(false);
      load(true);
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doRetry = async () => {
    setBusy(true);
    try {
      await tripsApi.retry(id);
      success('Đang tìm lại tài xế');
      load(true);
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doRate = async () => {
    setBusy(true);
    try {
      await tripsApi.rate(id, { stars: rating, comment: review });
      success('Cảm ơn bạn đã đánh giá');
      setRateOpen(false);
      load(true);
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const doPay = async () => {
    setBusy(true);
    try {
      const result = await tripsApi.pay(id);
      success(result.simulated ? 'Đã ghi nhận thanh toán (mô phỏng)' : 'Thanh toán thành công');
      load(true);
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async () => {
    try {
      const result = await tripsApi.receipt(id);
      setReceipt(result.receipt);
      setReceiptOpen(true);
    } catch (err) {
      toastError(err.message);
    }
  };

  const toggleFavorite = async () => {
    if (!trip?.driver?.id) return;
    try {
      if (favorite) await favoritesApi.remove(trip.driver.id);
      else await favoritesApi.add(trip.driver.id);
      setFavorite(!favorite);
      success(favorite ? 'Đã bỏ tài xế khỏi yêu thích' : 'Đã thêm tài xế vào yêu thích');
    } catch (err) {
      toastError(err.message);
    }
  };

  const copyShare = async () => {
    const url = `${window.location.origin}/chia-se/${trip.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      success('Đã sao chép liên kết chia sẻ');
    } catch {
      info(url);
    }
  };

  if (loading) {
    return (
      <div className="page center" style={{ minHeight: '50vh' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="page page--narrow">
        <EmptyState
          icon="alert"
          title="Không tải được chuyến"
          description={error || 'Chuyến không tồn tại hoặc bạn không có quyền truy cập.'}
          action={
            <Link to="/chuyen-cua-toi" className="btn btn--primary">
              Về danh sách chuyến
            </Link>
          }
        />
      </div>
    );
  }

  const timeline = buildTimeline(trip, data?.events || []);

  return (
    <div className="page page--wide">
      <div className="tracking-layout">
        <div className="stack">
          <MapView
            className="tracking-map"
            pickup={trip.pickup}
            dropoff={trip.dropoff}
            stops={trip.stops || []}
            driver={driverPoint}
            routeGeometry={data?.route?.geometry}
            theme={theme}
            fitKey={`${trip.id}-${trip.status}`}
          />
          <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
            <div className="row-wrap">
              <Badge tone="default">
                <Icon name="receipt" size={13} /> {trip.code}
              </Badge>
              <StatusBadge status={trip.status} />
              {data?.route?.simulated && <Badge tone="warning">Tuyến ước tính</Badge>}
            </div>
            <span className="text-xs muted">
              {formatDistance(trip.distanceKm)} · {formatDuration(trip.durationMin)}
            </span>
          </div>
          {!driverPoint && trip.driver && isActive && (
            <Alert tone="info" title="Chưa có vị trí tài xế">
              Tài xế chưa chia sẻ vị trí hoặc GPS đang không khả dụng. Trạng thái chuyến vẫn được cập nhật.
            </Alert>
          )}
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="row-between">
              <div className="stack-sm" style={{ gap: 2 }}>
                <span className="eyebrow">{trip.status === 'completed' ? 'Chuyến đã hoàn thành' : 'Trạng thái chuyến'}</span>
                <h2>{statusHeadline(trip)}</h2>
              </div>
              <StatusBadge status={trip.status} />
            </div>

            {trip.status === 'searching' && (
              <div className="stack" style={{ alignItems: 'center', padding: 'var(--sp-4) 0' }}>
                <div className="search-radar">
                  <span className="search-radar__ring" />
                  <span className="search-radar__ring" />
                  <span className="search-radar__ring" />
                  <span className="search-radar__core">
                    <Icon name="car" size={24} />
                  </span>
                </div>
                <span className="text-sm muted text-center">
                  Đang tìm tài xế phù hợp gần bạn. Vòng tìm thứ {trip.searchRound || 1}.
                </span>
              </div>
            )}

            {trip.status === 'no_driver' && (
              <Alert tone="danger" title="Chưa tìm được tài xế">
                Hệ thống đã thử {trip.searchRound || 1} vòng nhưng chưa có tài xế phù hợp. Bạn có thể thử lại hoặc hủy chuyến.
              </Alert>
            )}

            {trip.driver && (
              <div className="driver-card">
                <Avatar name={trip.driver.name} src={trip.driver.avatarUrl} />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <strong className="text-sm">{trip.driver.name}</strong>
                    <span className="stars">
                      <Icon name="star" size={13} className="star-btn--on" />
                      <span className="text-xs strong">{Number(trip.driver.rating || 5).toFixed(1)}</span>
                    </span>
                  </div>
                  <span className="text-xs muted">
                    {trip.driver.vehicle?.brand} {trip.driver.vehicle?.model} · {trip.driver.vehicle?.color}
                  </span>
                  <div className="row" style={{ gap: 6 }}>
                    <Plate>{trip.driver.vehicle?.plate}</Plate>
                    <span className="text-xs muted">{trip.driver.tripsCompleted || 0} chuyến</span>
                  </div>
                </div>
                <div className="stack-sm" style={{ gap: 6 }}>
                  {trip.driverPhone && (
                    <a href={`tel:${trip.driverPhone}`} className="btn btn--icon btn--soft" aria-label="Gọi tài xế">
                      <Icon name="phone" size={16} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn--icon btn--ghost"
                    onClick={toggleFavorite}
                    aria-label="Yêu thích tài xế"
                    style={favorite ? { color: 'var(--danger)' } : undefined}
                  >
                    <Icon name="heart" size={16} />
                  </button>
                </div>
              </div>
            )}

            {data?.eta && isActive && (
              <div className="row-between card card--soft" style={{ padding: 'var(--sp-3)' }}>
                <span className="text-sm muted">Tài xế cách điểm đón</span>
                <strong className="text-sm">
                  {formatDistance(data.eta.distanceKm)} · ~{data.eta.etaMinutes} phút
                </strong>
              </div>
            )}

            <div className="btn-row">
              {isActive && (
                <button type="button" className="btn btn--ghost" onClick={() => setShareOpen(true)}>
                  <Icon name="share" size={16} />
                  Chia sẻ chuyến
                </button>
              )}
              {trip.status === 'no_driver' && (
                <button type="button" className="btn btn--primary" onClick={doRetry} disabled={busy}>
                  <Icon name="refresh" size={16} />
                  Tìm lại tài xế
                </button>
              )}
              {isActive && isCustomer && (
                <button type="button" className="btn btn--danger" onClick={() => setCancelOpen(true)}>
                  <Icon name="close" size={16} />
                  Hủy chuyến
                </button>
              )}
              {trip.status === 'completed' && (
                <>
                  <button type="button" className="btn btn--ghost" onClick={openReceipt}>
                    <Icon name="receipt" size={16} />
                    Biên nhận
                  </button>
                  {trip.paymentStatus !== 'paid' && (
                    <button type="button" className="btn btn--primary" onClick={doPay} disabled={busy}>
                      <Icon name="wallet" size={16} />
                      Thanh toán {formatCurrency(trip.finalPrice || trip.estimatedPrice)}
                    </button>
                  )}
                  {!trip.rating && isCustomer && (
                    <button type="button" className="btn btn--soft" onClick={() => setRateOpen(true)}>
                      <Icon name="star" size={16} />
                      Đánh giá
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card stack">
            <SectionTitle title="Lộ trình" />
            <div className="stack-sm">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="route-marker route-marker--pickup">A</span>
                <div className="stack-sm" style={{ gap: 1 }}>
                  <strong className="text-sm">{trip.pickup.label}</strong>
                  <span className="text-xs muted">{trip.pickup.address}</span>
                </div>
              </div>
              {(trip.stops || []).map((stop, index) => (
                <div className="row" key={index} style={{ alignItems: 'flex-start' }}>
                  <span className="route-marker route-marker--stop">{index + 1}</span>
                  <div className="stack-sm" style={{ gap: 1 }}>
                    <strong className="text-sm">{stop.label}</strong>
                    <span className="text-xs muted">{stop.address}</span>
                  </div>
                </div>
              ))}
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
              <KV label="Loại xe" value={`${trip.vehicleType?.name || '—'} · ${trip.vehicleType?.seats || '—'} chỗ`} />
              <KV label="Số khách" value={`${trip.passengers} khách · ${trip.luggage} kiện`} />
              <KV label="Thanh toán" value={PAYMENT_LABELS[trip.paymentMethod] || trip.paymentMethod} />
              <KV label="Trạng thái thanh toán" value={PAYMENT_STATUS_LABELS[trip.paymentStatus] || trip.paymentStatus} />
              {trip.scheduledAt && <KV label="Giờ đón" value={formatDateTime(trip.scheduledAt)} />}
              {trip.specialRequests?.length > 0 && (
                <KV label="Yêu cầu" value={trip.specialRequests.map((r) => r.label).join(', ')} />
              )}
              {trip.notes && <KV label="Ghi chú" value={trip.notes} />}
            </div>

            <hr className="divider" />

            <div className="price-summary">
              {(trip.priceBreakdown?.items || []).map((item, index) => (
                <div key={`${item.code}-${index}`} className={`price-row ${item.amount < 0 ? 'price-row--discount' : ''}`}>
                  <span>{item.label}</span>
                  <span className="mono">{item.amount === 0 ? '—' : formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="price-row price-row--total">
                <span>{trip.status === 'completed' ? 'Tổng thanh toán' : 'Tạm tính'}</span>
                <span className="mono">{formatCurrency(trip.finalPrice || trip.estimatedPrice)}</span>
              </div>
            </div>
          </div>

          <div className="card stack">
            <SectionTitle title="Tiến trình chuyến" />
            <div className="timeline">
              {timeline.map((item) => (
                <div
                  key={item.key}
                  className={`timeline__item ${item.done ? 'timeline__item--done' : ''} ${item.active ? 'timeline__item--active' : ''}`}
                >
                  <span className="timeline__dot">{item.done && <Icon name="check" size={11} />}</span>
                  <div className="stack-sm" style={{ gap: 1 }}>
                    <strong className="text-sm">{item.label}</strong>
                    <span className="text-xs muted">{item.at ? formatDateTime(item.at) : item.hint}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {trip.driver && (
            <div className="card stack">
              <SectionTitle title="Trao đổi với tài xế" subtitle="Tin nhắn được lưu lại cùng chuyến." />
              <div className="chat-box" ref={chatRef}>
                {messages.length === 0 && <span className="text-sm muted text-center">Chưa có tin nhắn nào.</span>}
                {messages.map((message) => {
                  const mine = message.senderId === user?.id;
                  return (
                    <div key={message.id} className={`chat-msg ${mine ? 'chat-msg--mine' : ''}`}>
                      <div>{message.body}</div>
                      <div className="chat-msg__meta">
                        {mine ? 'Bạn' : message.senderRole === 'driver' ? 'Tài xế' : 'Người gửi'} · {formatTime(message.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <form className="row" onSubmit={sendMessage}>
                <input
                  className="input grow"
                  placeholder="Nhập tin nhắn…"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  maxLength={1000}
                />
                <button type="submit" className="btn btn--primary" disabled={!chatText.trim()}>
                  <Icon name="arrowRight" size={16} />
                </button>
              </form>
            </div>
          )}

          {trip.status === 'completed' && trip.rating && (
            <div className="card stack-sm">
              <span className="text-sm strong">Đánh giá của bạn</span>
              <StarRating value={trip.rating} readOnly />
              {trip.review && <span className="text-sm muted">“{trip.review}”</span>}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Hủy chuyến"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCancelOpen(false)}>
              Giữ chuyến
            </button>
            <button type="button" className="btn btn--danger" onClick={doCancel} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Xác nhận hủy'}
            </button>
          </>
        }
      >
        <div className="stack">
          <Field label="Lý do hủy">
            <select className="select" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
              {CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </Field>
          <Alert tone="warning">Hủy sau khi tài xế đã tới điểm đón có thể phát sinh phí theo chính sách.</Alert>
        </div>
      </Modal>

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Đánh giá chuyến đi"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setRateOpen(false)}>
              Để sau
            </button>
            <button type="button" className="btn btn--primary" onClick={doRate} disabled={busy}>
              Gửi đánh giá
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="stack-sm" style={{ alignItems: 'center' }}>
            <StarRating value={rating} onChange={setRating} size={30} />
            <span className="text-sm muted">{rating} / 5 sao</span>
          </div>
          <Field label="Nhận xét (không bắt buộc)" htmlFor="review">
            <textarea
              id="review"
              className="textarea"
              placeholder="Chia sẻ trải nghiệm của bạn về tài xế…"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              maxLength={500}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Chia sẻ hành trình"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setShareOpen(false)}>
              Đóng
            </button>
            <button type="button" className="btn btn--primary" onClick={copyShare}>
              <Icon name="copy" size={16} />
              Sao chép liên kết
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="text-sm muted">
            Người nhận liên kết chỉ xem được trạng thái chuyến và vị trí tài xế. Số điện thoại được ẩn một phần.
          </p>
          <div className="card card--soft mono text-sm" style={{ wordBreak: 'break-all' }}>
            {`${window.location.origin}/chia-se/${trip.shareToken}`}
          </div>
        </div>
      </Modal>

      <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Biên nhận chuyến đi" wide>
        {receipt && (
          <div className="stack">
            <div className="row-between">
              <div className="stack-sm" style={{ gap: 2 }}>
                <strong>{receipt.code}</strong>
                <span className="text-xs muted">Phát hành {formatDateTime(receipt.issuedAt)}</span>
              </div>
              <Badge tone={receipt.paymentStatus === 'paid' ? 'success' : 'warning'}>
                {PAYMENT_STATUS_LABELS[receipt.paymentStatus] || receipt.paymentStatus}
              </Badge>
            </div>
            <hr className="divider" />
            <div className="stack-sm">
              <KV label="Khách hàng" value={receipt.customer?.name} />
              {receipt.driver && <KV label="Tài xế" value={`${receipt.driver.name} · ${receipt.driver.plate}`} />}
              <KV label="Điểm đón" value={receipt.route?.pickup} />
              <KV label="Điểm trả" value={receipt.route?.dropoff} />
              <KV label="Quãng đường" value={formatDistance(receipt.route?.distanceKm)} />
              <KV label="Thời gian" value={formatDuration(receipt.route?.durationMin)} />
            </div>
            <hr className="divider" />
            <div className="price-summary">
              {(receipt.breakdown?.items || []).map((item, index) => (
                <div key={`${item.code}-${index}`} className={`price-row ${item.amount < 0 ? 'price-row--discount' : ''}`}>
                  <span>{item.label}</span>
                  <span className="mono">{item.amount === 0 ? '—' : formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="price-row price-row--total">
                <span>Tổng cộng</span>
                <span className="mono">{formatCurrency(receipt.amount)}</span>
              </div>
            </div>
            {receipt.payment?.simulated && (
              <Alert tone="warning" title="Giao dịch mô phỏng">
                Chưa kết nối cổng thanh toán thật. Giao dịch này chỉ ghi nhận trong hệ thống demo.
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function statusHeadline(trip) {
  switch (trip.status) {
    case 'scheduled':
      return `Đã lên lịch ${formatDateTime(trip.scheduledAt)}`;
    case 'searching':
      return 'Đang tìm tài xế';
    case 'assigned':
      return 'Tài xế đang đến điểm đón';
    case 'arrived':
      return 'Tài xế đã tới điểm đón';
    case 'in_progress':
      return 'Đang trên đường tới điểm trả';
    case 'completed':
      return 'Chuyến đi hoàn thành';
    case 'cancelled':
      return 'Chuyến đã bị hủy';
    case 'no_driver':
      return 'Chưa tìm được tài xế';
    default:
      return trip.status;
  }
}

function buildTimeline(trip, events) {
  const findEvent = (type) => events.find((e) => e.type === type);
  const steps = [
    { key: 'created', label: 'Đã tạo chuyến', at: trip.createdAt, done: true },
    {
      key: 'assigned',
      label: 'Tài xế nhận chuyến',
      at: trip.acceptedAt,
      done: Boolean(trip.acceptedAt),
      hint: trip.status === 'searching' ? 'Đang tìm tài xế…' : 'Chưa có tài xế',
    },
    {
      key: 'arrived',
      label: 'Tài xế tới điểm đón',
      at: trip.arrivedAt,
      done: Boolean(trip.arrivedAt),
      hint: 'Chờ tài xế tới',
    },
    {
      key: 'started',
      label: 'Bắt đầu chuyến',
      at: trip.startedAt,
      done: Boolean(trip.startedAt),
      hint: 'Chưa bắt đầu',
    },
    {
      key: 'completed',
      label: 'Hoàn thành chuyến',
      at: trip.completedAt,
      done: Boolean(trip.completedAt),
      hint: trip.status === 'cancelled' ? 'Đã hủy' : 'Chưa hoàn thành',
    },
  ];

  if (trip.status === 'cancelled') {
    const cancelEvent = findEvent('cancelled');
    steps.push({
      key: 'cancelled',
      label: `Đã hủy${trip.cancelReason ? `: ${trip.cancelReason}` : ''}`,
      at: trip.cancelledAt,
      done: true,
      hint: cancelEvent ? relativeTime(cancelEvent.createdAt) : '',
    });
  }

  const activeIndex = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({ ...step, active: index === activeIndex }));
}
