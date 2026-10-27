import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Badge, EmptyState, Field, LoadingBlock, Modal, SectionTitle } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatCurrency } from '../../lib/format';

const EDITABLE = [
  { key: 'baseFare', label: 'Giá mở cửa (₫)' },
  { key: 'perKm', label: 'Giá mỗi km (₫)' },
  { key: 'perMinute', label: 'Giá mỗi phút (₫)' },
  { key: 'minFare', label: 'Giá tối thiểu (₫)' },
  { key: 'hourlyRate', label: 'Giá thuê theo giờ (₫)' },
  { key: 'dailyRate', label: 'Giá thuê theo ngày (₫)' },
];

export default function AdminPricing() {
  const { success, error: toastError } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.vehicleTypes();
      setRows(data.vehicleTypes || []);
    } catch (err) {
      toastError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      seats: row.seats,
      baseFare: row.baseFare,
      perKm: row.perKm,
      perMinute: row.perMinute,
      minFare: row.minFare,
      hourlyRate: row.hourlyRate,
      dailyRate: row.dailyRate,
      active: row.active,
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await adminApi.updateVehicleType(editing.id, {
        name: form.name,
        seats: Number(form.seats),
        baseFare: Number(form.baseFare),
        perKm: Number(form.perKm),
        perMinute: Number(form.perMinute),
        minFare: Number(form.minFare),
        hourlyRate: Number(form.hourlyRate),
        dailyRate: Number(form.dailyRate),
        active: Boolean(form.active),
      });
      success('Đã cập nhật bảng giá');
      setEditing(null);
      await load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await adminApi.updateVehicleType(row.id, { active: !row.active });
      success(row.active ? 'Đã tạm dừng loại xe' : 'Đã bật lại loại xe');
      await load();
    } catch (err) {
      toastError(err.message);
    }
  };

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Bảng giá"
        subtitle="Giá hiển thị cho khách được tính từ các tham số dưới đây, cộng phụ phí và hệ số giờ cao điểm."
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      {loading ? (
        <LoadingBlock rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="dollar" title="Chưa có loại xe" description="Thêm loại xe để cấu hình bảng giá." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Loại xe</th>
                <th>Ghế</th>
                <th>Mở cửa</th>
                <th>Mỗi km</th>
                <th>Mỗi phút</th>
                <th>Tối thiểu</th>
                <th>Theo giờ</th>
                <th>Theo ngày</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="stack-sm" style={{ gap: 1 }}>
                      <span className="text-sm strong">{row.name}</span>
                      <span className="text-xs muted mono">{row.code}</span>
                    </div>
                  </td>
                  <td className="text-sm">{row.seats}</td>
                  <td className="mono text-xs">{formatCurrency(row.baseFare)}</td>
                  <td className="mono text-xs">{formatCurrency(row.perKm)}</td>
                  <td className="mono text-xs">{formatCurrency(row.perMinute)}</td>
                  <td className="mono text-xs">{formatCurrency(row.minFare)}</td>
                  <td className="mono text-xs">{formatCurrency(row.hourlyRate)}</td>
                  <td className="mono text-xs">{formatCurrency(row.dailyRate)}</td>
                  <td>
                    <Badge tone={row.active ? 'success' : 'default'}>{row.active ? 'Đang bán' : 'Tạm dừng'}</Badge>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => openEdit(row)}>
                        Sửa
                      </button>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => toggleActive(row)}>
                        {row.active ? 'Dừng' : 'Bật'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa bảng giá · ${editing.name}` : 'Sửa bảng giá'}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            <Field label="Tên loại xe" htmlFor="typeName">
              <input
                id="typeName"
                className="input"
                value={form.name || ''}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <Field label="Số ghế" htmlFor="typeSeats">
              <input
                id="typeSeats"
                className="input"
                type="number"
                min="2"
                value={form.seats ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, seats: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            {EDITABLE.map((item) => (
              <Field key={item.key} label={item.label} htmlFor={item.key}>
                <input
                  id={item.key}
                  className="input"
                  type="number"
                  min="0"
                  step="100"
                  value={form[item.key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [item.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(form.active)}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
            />
            <span className="text-sm">Đang mở bán cho khách đặt</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
