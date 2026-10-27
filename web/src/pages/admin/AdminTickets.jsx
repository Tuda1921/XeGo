import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Badge, EmptyState, LoadingBlock, Modal, SectionTitle, Tabs } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { SUPPORT_CATEGORY_LABELS, TICKET_STATUS, formatDateTime } from '../../lib/format';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'open', label: 'Đang mở' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã giải quyết' },
  { value: 'closed', label: 'Đã đóng' },
];

const PRIORITY_META = {
  low: { label: 'Thấp', tone: 'default' },
  normal: { label: 'Bình thường', tone: 'info' },
  high: { label: 'Cao', tone: 'warning' },
  urgent: { label: 'Khẩn cấp', tone: 'danger' },
};

export default function AdminTickets() {
  const { success, error: toastError } = useToast();
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.tickets(status ? { status } : {});
      setRows(data.tickets || []);
    } catch (err) {
      toastError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (payload) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.updateTicket(selected.id, payload);
      success('Đã cập nhật yêu cầu hỗ trợ');
      setSelected(null);
      await load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Hỗ trợ khách hàng"
        subtitle={`${rows.length} yêu cầu`}
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <div className="card">
        <Tabs items={STATUS_TABS} value={status} onChange={setStatus} />
      </div>

      {loading ? (
        <LoadingBlock rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="headset" title="Không có yêu cầu" description="Chưa có yêu cầu hỗ trợ nào ở trạng thái này." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Khách</th>
                <th>Chủ đề</th>
                <th>Danh mục</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Tạo lúc</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => {
                const statusMeta = TICKET_STATUS[ticket.status] || TICKET_STATUS.open;
                const priorityMeta = PRIORITY_META[ticket.priority] || PRIORITY_META.normal;
                return (
                  <tr key={ticket.id}>
                    <td className="mono text-xs">{ticket.code}</td>
                    <td>
                      <div className="stack-sm" style={{ gap: 1 }}>
                        <span className="text-sm">{ticket.userName}</span>
                        <span className="text-xs muted">{ticket.userPhone}</span>
                      </div>
                    </td>
                    <td className="text-sm" style={{ maxWidth: 260 }}>
                      <span className="truncate">{ticket.subject}</span>
                    </td>
                    <td className="text-xs">{SUPPORT_CATEGORY_LABELS[ticket.category] || ticket.category}</td>
                    <td>
                      <Badge tone={priorityMeta.tone}>{priorityMeta.label}</Badge>
                    </td>
                    <td>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </td>
                    <td className="text-xs muted">{formatDateTime(ticket.createdAt)}</td>
                    <td>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSelected(ticket)}>
                        Xử lý
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Xử lý yêu cầu hỗ trợ" wide>
        {selected && (
          <div className="stack">
            <div className="row-between">
              <div className="stack-sm" style={{ gap: 2 }}>
                <span className="eyebrow">{selected.code}</span>
                <strong>{selected.subject}</strong>
              </div>
              <Badge tone={(TICKET_STATUS[selected.status] || TICKET_STATUS.open).tone}>
                {(TICKET_STATUS[selected.status] || TICKET_STATUS.open).label}
              </Badge>
            </div>

            <div className="stack-sm">
              <span className="text-xs muted">
                {selected.userName} · {selected.userPhone}
                {selected.tripCode ? ` · Chuyến ${selected.tripCode}` : ''}
              </span>
              <span className="text-xs muted">
                {SUPPORT_CATEGORY_LABELS[selected.category] || selected.category} · Tạo {formatDateTime(selected.createdAt)}
              </span>
            </div>

            <div className="card card--soft">
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {selected.description}
              </p>
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
              <label className="field">
                <span className="label">Trạng thái</span>
                <select
                  className="select"
                  value={selected.status}
                  onChange={(e) => setSelected((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="open">Đang mở</option>
                  <option value="in_progress">Đang xử lý</option>
                  <option value="resolved">Đã giải quyết</option>
                  <option value="closed">Đã đóng</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Mức ưu tiên</span>
                <select
                  className="select"
                  value={selected.priority}
                  onChange={(e) => setSelected((p) => ({ ...p, priority: e.target.value }))}
                >
                  <option value="low">Thấp</option>
                  <option value="normal">Bình thường</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn cấp</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              onClick={() => update({ status: selected.status, priority: selected.priority })}
              disabled={busy}
            >
              {busy ? <span className="spinner" /> : 'Lưu cập nhật'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
