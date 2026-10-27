import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  KV,
  LoadingBlock,
  Modal,
  SectionTitle,
  StatusBadge,
  Tabs,
} from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatCurrency, formatDateTime, formatDistance, formatDuration, PAYMENT_LABELS, PAYMENT_STATUS_LABELS } from '../../lib/format';

const OFFER_STATUS_LABELS = {
  pending: 'Đang chờ',
  accepted: 'Đã nhận',
  declined: 'Từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
};

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'searching', label: 'Tìm tài xế' },
  { value: 'assigned,arrived,in_progress', label: 'Đang chạy' },
  { value: 'scheduled', label: 'Đã lịch' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled,no_driver', label: 'Hủy / thất bại' },
];

export default function AdminTrips() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [assignId, setAssignId] = useState('');
  const [cancelReason, setCancelReason] = useState('Quản trị viên hủy');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (status) params.status = status;
      if (search) params.q = search;
      const data = await adminApi.trips(params);
      setRows(data.trips || []);
      setTotal(data.total || 0);
    } catch (err) {
      toastError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, search, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(
    async (tripId) => {
      setDetailLoading(true);
      try {
        const data = await adminApi.trip(tripId);
        setDetail(data);
        setAssignId(data.trip?.driver?.id ? String(data.trip.driver.id) : '');
      } catch (err) {
        toastError(err.message);
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [toastError],
  );

  useEffect(() => {
    if (id) openDetail(id);
  }, [id, openDetail]);

  useEffect(() => {
    adminApi
      .drivers({ verification: 'approved' })
      .then((data) => setDrivers(data.drivers || []))
      .catch(() => setDrivers([]));
  }, []);

  const closeDetail = () => {
    setDetail(null);
    if (id) navigate('/quan-tri/chuyen');
  };

  const assign = async () => {
    if (!assignId) {
      toastError('Chưa chọn tài xế');
      return;
    }
    setBusy(true);
    try {
      await adminApi.assign(detail.trip.id, Number(assignId));
      success('Đã gán tài xế cho chuyến');
      await openDetail(detail.trip.id);
      load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelTrip = async () => {
    setBusy(true);
    try {
      await adminApi.cancelTrip(detail.trip.id, cancelReason);
      success('Đã hủy chuyến');
      await openDetail(detail.trip.id);
      load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canAssign = useMemo(
    () => detail && ['searching', 'no_driver', 'scheduled'].includes(detail.trip.status),
    [detail],
  );
  const canCancel = useMemo(
    () => detail && !['completed', 'cancelled'].includes(detail.trip.status),
    [detail],
  );

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Chuyến xe"
        subtitle={`${total} chuyến phù hợp bộ lọc`}
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <div className="card stack">
        <Tabs items={STATUS_TABS} value={status} onChange={setStatus} />
        <form
          className="row"
          style={{ gap: 'var(--sp-2)' }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <div className="input-group grow">
            <span className="input-group__icon">
              <Icon name="search" size={16} />
            </span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo mã chuyến, điểm đón/trả, tên hoặc SĐT khách"
            />
          </div>
          <button type="submit" className="btn btn--primary">
            Tìm
          </button>
          {search && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setQuery('');
                setSearch('');
              }}
            >
              Xóa
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <LoadingBlock rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="list" title="Không có chuyến nào" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Khách</th>
                <th>Tuyến</th>
                <th>Tài xế</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Tạo lúc</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((trip) => (
                <tr key={trip.id}>
                  <td className="mono text-xs">{trip.code}</td>
                  <td>
                    <div className="stack-sm" style={{ gap: 1 }}>
                      <span className="text-sm">{trip.customer?.name || '—'}</span>
                      <span className="text-xs muted">{trip.customerPhone || ''}</span>
                    </div>
                  </td>
                  <td>
                    <div className="stack-sm" style={{ gap: 1, maxWidth: 260 }}>
                      <span className="text-xs truncate">{trip.pickup?.label}</span>
                      <span className="text-xs muted truncate">→ {trip.dropoff?.label}</span>
                    </div>
                  </td>
                  <td className="text-sm">{trip.driver?.name || <span className="muted">Chưa có</span>}</td>
                  <td className="mono text-sm">{formatCurrency(trip.finalPrice || trip.estimatedPrice)}</td>
                  <td>
                    <StatusBadge status={trip.status} />
                  </td>
                  <td className="text-xs muted">{formatDateTime(trip.createdAt)}</td>
                  <td>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => openDetail(trip.id)}>
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(detail) || detailLoading} onClose={closeDetail} title="Chi tiết chuyến" wide>
        {detailLoading || !detail ? (
          <LoadingBlock rows={3} />
        ) : (
          <div className="stack">
            <div className="row-between">
              <div className="stack-sm" style={{ gap: 2 }}>
                <span className="eyebrow">{detail.trip.code}</span>
                <strong>{detail.trip.pickup?.label} → {detail.trip.dropoff?.label}</strong>
              </div>
              <StatusBadge status={detail.trip.status} />
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--sp-4)' }}>
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Hành trình</span>
                <KV label="Điểm đón" value={detail.trip.pickup?.address || detail.trip.pickup?.label} />
                <KV label="Điểm trả" value={detail.trip.dropoff?.address || detail.trip.dropoff?.label} />
                <KV label="Quãng đường" value={formatDistance(detail.trip.distanceKm)} />
                <KV label="Thời gian" value={formatDuration(detail.trip.durationMin)} />
                <KV label="Loại xe" value={detail.trip.vehicleType?.name || '—'} />
                <KV label="Số khách" value={`${detail.trip.passengers} khách · ${detail.trip.luggage} kiện`} />
              </div>
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Thanh toán</span>
                <KV label="Giá dự kiến" value={formatCurrency(detail.trip.estimatedPrice)} />
                <KV label="Giá cuối" value={formatCurrency(detail.trip.finalPrice || detail.trip.estimatedPrice)} />
                <KV label="Hoa hồng" value={formatCurrency(detail.trip.commissionAmount)} />
                <KV label="Tài xế nhận" value={formatCurrency(detail.trip.driverEarning)} />
                <KV label="Phương thức" value={PAYMENT_LABELS[detail.trip.paymentMethod] || detail.trip.paymentMethod} />
                <KV label="Trạng thái TT" value={PAYMENT_STATUS_LABELS[detail.trip.paymentStatus] || detail.trip.paymentStatus} />
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--sp-4)' }}>
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Khách hàng</span>
                <KV label="Tên" value={detail.trip.customer?.name || '—'} />
                <KV label="SĐT" value={detail.trip.customerPhone || '—'} />
              </div>
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Tài xế</span>
                <KV label="Tên" value={detail.trip.driver?.name || 'Chưa gán'} />
                <KV label="SĐT" value={detail.trip.driverPhone || '—'} />
                <KV label="Biển số" value={detail.trip.driver?.vehicle?.plate || '—'} />
              </div>
            </div>

            {detail.trip.cancelReason && (
              <Alert tone="danger" title="Lý do hủy">
                {detail.trip.cancelReason} ({detail.trip.cancelledBy || 'không rõ'})
              </Alert>
            )}

            <div className="stack-sm">
              <span className="text-xs strong uppercase muted">Lịch sử</span>
              <div className="timeline">
                {detail.events.map((event) => (
                  <div key={event.id} className="timeline__item timeline__item--done">
                    <span className="timeline__dot" />
                    <div className="stack-sm" style={{ gap: 1 }}>
                      <span className="text-sm">{event.message || event.type}</span>
                      <span className="text-xs muted">
                        {formatDateTime(event.createdAt)} · {event.actorRole || 'hệ thống'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {detail.offers?.length > 0 && (
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Lời mời tài xế</span>
                <div className="table-wrap">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Tài xế</th>
                        <th>Trạng thái</th>
                        <th>Khoảng cách</th>
                        <th>Gửi lúc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.offers.map((offer) => (
                        <tr key={offer.id}>
                          <td className="text-sm">{offer.driver_name}</td>
                          <td>
                            <Badge
                              tone={
                                offer.status === 'accepted'
                                  ? 'success'
                                  : offer.status === 'declined'
                                    ? 'danger'
                                    : 'default'
                              }
                            >
                              {OFFER_STATUS_LABELS[offer.status] || offer.status}
                            </Badge>
                          </td>
                          <td className="text-xs">{formatDistance(offer.distance_km)}</td>
                          <td className="text-xs muted">{formatDateTime(offer.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {canAssign && (
              <div className="card card--soft stack-sm">
                <strong className="text-sm">Gán tài xế thủ công</strong>
                <div className="row" style={{ gap: 'var(--sp-2)' }}>
                  <select className="select grow" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                    <option value="">Chọn tài xế đã xác minh</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} · {driver.phone} · {driver.vehicle?.plate || 'chưa có xe'}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn--primary" onClick={assign} disabled={busy}>
                    Gán
                  </button>
                </div>
              </div>
            )}

            {canCancel && (
              <div className="card card--soft stack-sm">
                <strong className="text-sm">Hủy chuyến</strong>
                <Field label="Lý do hủy" htmlFor="cancelReason">
                  <input
                    id="cancelReason"
                    className="input"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </Field>
                <button type="button" className="btn btn--danger" onClick={cancelTrip} disabled={busy}>
                  Xác nhận hủy chuyến
                </button>
              </div>
            )}

            <div className="row-wrap text-xs muted">
              <span>Tạo: {formatDateTime(detail.trip.createdAt)}</span>
              {detail.trip.acceptedAt && <span>Nhận: {formatDateTime(detail.trip.acceptedAt)}</span>}
              {detail.trip.completedAt && <span>Hoàn thành: {formatDateTime(detail.trip.completedAt)}</span>}
              <span>Vòng tìm: {detail.trip.searchRound}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
