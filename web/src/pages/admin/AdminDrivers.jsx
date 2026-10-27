import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  KV,
  LoadingBlock,
  Modal,
  Plate,
  SectionTitle,
  Tabs,
} from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { ONLINE_STATUS, VERIFICATION_STATUS, formatDate, formatDateTime } from '../../lib/format';

const VERIFICATION_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác minh' },
  { value: 'approved', label: 'Đã xác minh' },
  { value: 'rejected', label: 'Bị từ chối' },
];

export default function AdminDrivers() {
  const { success, error: toastError } = useToast();
  const [verification, setVerification] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (verification) params.verification = verification;
      if (search) params.q = search;
      const data = await adminApi.drivers(params);
      setRows(data.drivers || []);
    } catch (err) {
      toastError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [verification, search, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (approved) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.verifyDriver(selected.id, approved, note || undefined);
      success(approved ? 'Đã duyệt hồ sơ tài xế' : 'Đã từ chối hồ sơ tài xế');
      setSelected(null);
      setNote('');
      load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSuspend = async (driver) => {
    const suspended = driver.status !== 'suspended';
    setBusy(true);
    try {
      await adminApi.suspendDriver(driver.id, suspended);
      success(suspended ? 'Đã tạm khóa tài khoản tài xế' : 'Đã mở lại tài khoản tài xế');
      setSelected(null);
      load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Tài xế"
        subtitle={`${rows.length} tài xế trong danh sách`}
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <div className="card stack">
        <Tabs items={VERIFICATION_TABS} value={verification} onChange={setVerification} />
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
              placeholder="Tìm theo tên, số điện thoại hoặc biển số"
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
        <EmptyState icon="users" title="Không có tài xế" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tài xế</th>
                <th>Phương tiện</th>
                <th>Khu vực</th>
                <th>Đánh giá</th>
                <th>Chuyến</th>
                <th>Xác minh</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((driver) => {
                const vMeta = VERIFICATION_STATUS[driver.verificationStatus] || VERIFICATION_STATUS.pending;
                const oMeta = ONLINE_STATUS[driver.onlineStatus] || ONLINE_STATUS.offline;
                return (
                  <tr key={driver.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <Avatar name={driver.name} size="sm" />
                        <div className="stack-sm" style={{ gap: 1 }}>
                          <span className="text-sm">{driver.name}</span>
                          <span className="text-xs muted">{driver.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {driver.vehicle ? (
                        <div className="stack-sm" style={{ gap: 2 }}>
                          <Plate>{driver.vehicle.plate}</Plate>
                          <span className="text-xs muted">
                            {driver.vehicle.typeName} · {driver.vehicle.seats} chỗ
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs muted">Chưa có xe</span>
                      )}
                    </td>
                    <td className="text-xs">{driver.serviceArea || '—'}</td>
                    <td className="text-sm">
                      {Number(driver.rating || 5).toFixed(1)}
                      <span className="text-xs muted"> ({driver.ratingCount || 0})</span>
                    </td>
                    <td className="text-sm">{driver.tripsCompleted || 0}</td>
                    <td>
                      <Badge tone={vMeta.tone}>{vMeta.label}</Badge>
                    </td>
                    <td>
                      <Badge tone={driver.status === 'suspended' ? 'danger' : oMeta.tone}>
                        {driver.status === 'suspended' ? 'Bị khóa' : oMeta.label}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => {
                          setSelected(driver);
                          setNote(driver.verificationNote || '');
                        }}
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Hồ sơ tài xế" wide>
        {selected && (
          <div className="stack">
            <div className="row-between">
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={selected.name} size="lg" />
                <div className="stack-sm" style={{ gap: 2 }}>
                  <strong>{selected.name}</strong>
                  <span className="text-xs muted">
                    {selected.phone} · {selected.email || 'chưa có email'}
                  </span>
                  <span className="text-xs muted">Tham gia {formatDate(selected.createdAt)}</span>
                </div>
              </div>
              <Badge tone={(VERIFICATION_STATUS[selected.verificationStatus] || VERIFICATION_STATUS.pending).tone}>
                {(VERIFICATION_STATUS[selected.verificationStatus] || VERIFICATION_STATUS.pending).label}
              </Badge>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--sp-4)' }}>
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Giấy tờ</span>
                <KV label="Bằng lái" value={selected.licenseNumber || 'Chưa cập nhật'} />
                <KV label="Hết hạn" value={selected.licenseExpiry ? formatDate(selected.licenseExpiry) : '—'} />
                <KV label="CCCD" value={selected.idCardNumber || 'Chưa cập nhật'} />
                <KV label="Khu vực" value={selected.serviceArea || '—'} />
                <KV label="Nhà xe" value={selected.operatorName || 'Độc lập'} />
              </div>
              <div className="stack-sm">
                <span className="text-xs strong uppercase muted">Hiệu suất</span>
                <KV label="Đánh giá" value={`${Number(selected.rating || 5).toFixed(1)} (${selected.ratingCount || 0} lượt)`} />
                <KV label="Hoàn thành" value={selected.tripsCompleted || 0} />
                <KV label="Đã hủy" value={selected.tripsCancelled || 0} />
                <KV label="Trạng thái online" value={(ONLINE_STATUS[selected.onlineStatus] || ONLINE_STATUS.offline).label} />
                <KV
                  label="Vị trí"
                  value={
                    selected.location
                      ? `${selected.location.lat.toFixed(4)}, ${selected.location.lng.toFixed(4)} · ${formatDateTime(selected.location.updatedAt)}`
                      : 'Chưa chia sẻ'
                  }
                />
              </div>
            </div>

            {selected.vehicle && (
              <div className="card card--soft stack-sm">
                <span className="text-xs strong uppercase muted">Phương tiện</span>
                <div className="row-between">
                  <div className="stack-sm" style={{ gap: 1 }}>
                    <strong className="text-sm">
                      {selected.vehicle.brand} {selected.vehicle.model}
                    </strong>
                    <span className="text-xs muted">
                      {selected.vehicle.typeName} · {selected.vehicle.seats} chỗ · {selected.vehicle.color || '—'}
                    </span>
                  </div>
                  <Plate>{selected.vehicle.plate}</Plate>
                </div>
              </div>
            )}

            {selected.verificationNote && selected.verificationStatus === 'rejected' && (
              <Alert tone="danger" title="Lý do từ chối trước đó">
                {selected.verificationNote}
              </Alert>
            )}

            <Field label="Ghi chú xác minh" htmlFor="verifyNote" hint="Ghi chú được gửi tới tài xế khi từ chối.">
              <textarea
                id="verifyNote"
                className="textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Ảnh bằng lái bị mờ, vui lòng chụp lại."
              />
            </Field>

            <div className="btn-row">
              <button type="button" className="btn btn--primary grow" onClick={() => decide(true)} disabled={busy}>
                <Icon name="check" size={16} />
                Duyệt hồ sơ
              </button>
              <button type="button" className="btn btn--danger grow" onClick={() => decide(false)} disabled={busy}>
                <Icon name="close" size={16} />
                Từ chối
              </button>
            </div>

            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => toggleSuspend(selected)}
              disabled={busy}
            >
              {selected.status === 'suspended' ? 'Mở lại tài khoản' : 'Tạm khóa tài khoản'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
