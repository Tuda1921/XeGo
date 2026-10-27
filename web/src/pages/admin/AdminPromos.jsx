import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Badge, EmptyState, Field, LoadingBlock, Modal, SectionTitle } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatCurrency, formatDate } from '../../lib/format';

const EMPTY = {
  code: '',
  description: '',
  type: 'percent',
  value: '',
  minOrder: '',
  maxDiscount: '',
  usageLimit: '',
  startsAt: '',
  endsAt: '',
};

export default function AdminPromos() {
  const { success, error: toastError } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.promos();
      setRows(data.promos || []);
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

  const create = async () => {
    if (!form.code || !form.value) {
      toastError('Vui lòng nhập mã và giá trị giảm');
      return;
    }
    setBusy(true);
    try {
      await adminApi.createPromo({
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        type: form.type,
        value: Number(form.value),
        minOrder: form.minOrder ? Number(form.minOrder) : 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      });
      success('Đã tạo mã giảm giá');
      setOpen(false);
      setForm(EMPTY);
      await load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (promo) => {
    try {
      await adminApi.togglePromo(promo.id, !promo.active);
      success(promo.active ? 'Đã tắt mã giảm giá' : 'Đã bật mã giảm giá');
      await load();
    } catch (err) {
      toastError(err.message);
    }
  };

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Khuyến mãi"
        subtitle={`${rows.length} mã giảm giá`}
        action={
          <div className="row" style={{ gap: 'var(--sp-2)' }}>
            <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
              <Icon name="refresh" size={15} />
              Làm mới
            </button>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => setOpen(true)}>
              <Icon name="plus" size={15} />
              Tạo mã
            </button>
          </div>
        }
      />

      {loading ? (
        <LoadingBlock rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="gift"
          title="Chưa có mã giảm giá"
          description="Tạo mã để thu hút khách hàng mới và tri ân khách quen."
          action={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
              Tạo mã đầu tiên
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Mô tả</th>
                <th>Giảm</th>
                <th>Đơn tối thiểu</th>
                <th>Giảm tối đa</th>
                <th>Đã dùng</th>
                <th>Hiệu lực</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((promo) => (
                <tr key={promo.id}>
                  <td className="mono text-sm strong">{promo.code}</td>
                  <td className="text-xs" style={{ maxWidth: 220 }}>
                    {promo.description || '—'}
                  </td>
                  <td className="text-sm">
                    {promo.type === 'percent' ? `${promo.value}%` : formatCurrency(promo.value)}
                  </td>
                  <td className="mono text-xs">{formatCurrency(promo.minOrder)}</td>
                  <td className="mono text-xs">{promo.maxDiscount ? formatCurrency(promo.maxDiscount) : '—'}</td>
                  <td className="text-xs">
                    {promo.usedCount}
                    {promo.usageLimit ? ` / ${promo.usageLimit}` : ''}
                  </td>
                  <td className="text-xs muted">
                    {promo.startsAt ? formatDate(promo.startsAt) : '—'} → {promo.endsAt ? formatDate(promo.endsAt) : '—'}
                  </td>
                  <td>
                    <Badge tone={promo.active ? 'success' : 'default'}>{promo.active ? 'Đang chạy' : 'Đã tắt'}</Badge>
                  </td>
                  <td>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => toggle(promo)}>
                      {promo.active ? 'Tắt' : 'Bật'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo mã giảm giá"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={create} disabled={busy}>
              {busy ? <span className="spinner" /> : 'Tạo mã'}
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            <Field label="Mã" htmlFor="promoCode">
              <input
                id="promoCode"
                className="input mono"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="XEGO20"
              />
            </Field>
            <Field label="Loại giảm" htmlFor="promoType">
              <select
                id="promoType"
                className="select"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="percent">Phần trăm</option>
                <option value="fixed">Số tiền cố định</option>
              </select>
            </Field>
          </div>
          <Field label="Mô tả" htmlFor="promoDesc">
            <input
              id="promoDesc"
              className="input"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Giảm 20% cho khách hàng mới"
            />
          </Field>
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            <Field label={form.type === 'percent' ? 'Giá trị (%)' : 'Giá trị (₫)'} htmlFor="promoValue">
              <input
                id="promoValue"
                className="input"
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              />
            </Field>
            <Field label="Đơn tối thiểu (₫)" htmlFor="promoMin">
              <input
                id="promoMin"
                className="input"
                type="number"
                min="0"
                value={form.minOrder}
                onChange={(e) => setForm((p) => ({ ...p, minOrder: e.target.value }))}
              />
            </Field>
            <Field label="Giảm tối đa (₫)" htmlFor="promoMax" hint="Bỏ trống nếu không giới hạn.">
              <input
                id="promoMax"
                className="input"
                type="number"
                min="0"
                value={form.maxDiscount}
                onChange={(e) => setForm((p) => ({ ...p, maxDiscount: e.target.value }))}
              />
            </Field>
            <Field label="Số lượt dùng" htmlFor="promoLimit" hint="Bỏ trống nếu không giới hạn.">
              <input
                id="promoLimit"
                className="input"
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))}
              />
            </Field>
            <Field label="Bắt đầu" htmlFor="promoStart">
              <input
                id="promoStart"
                className="input"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
              />
            </Field>
            <Field label="Kết thúc" htmlFor="promoEnd">
              <input
                id="promoEnd"
                className="input"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
