import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, Badge, EmptyState, Field, LoadingBlock, SectionTitle } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatDateTime } from '../../lib/format';

export default function AdminSettings() {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(null);
  const [operators, setOperators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, operatorsRes, auditRes] = await Promise.all([
        adminApi.settings(),
        adminApi.operators(),
        adminApi.audit(),
      ]);
      setForm(settingsRes.settings);
      setOperators(operatorsRes.operators || []);
      setLogs(auditRes.logs || []);
    } catch (err) {
      toastError(err.message);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSettings({
        commissionRate: Number(form.commissionRate),
        supportPhone: form.supportPhone,
        supportEmail: form.supportEmail,
        companyName: form.companyName,
        cancellationPolicy: form.cancellationPolicy,
      });
      success('Đã lưu cài đặt hệ thống');
      await load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock rows={4} />;
  if (!form) return <EmptyState icon="settings" title="Không tải được cài đặt" description="Vui lòng thử lại sau." />;

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Cài đặt hệ thống"
        subtitle="Các tham số ảnh hưởng tới giá, hoa hồng và thông tin hỗ trợ hiển thị cho khách."
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <form className="card stack" onSubmit={save}>
        <strong className="text-sm">Thông tin nền tảng</strong>
        <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
          <Field label="Tên công ty" htmlFor="companyName">
            <input
              id="companyName"
              className="input"
              value={form.companyName || ''}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
          </Field>
          <Field label="Tỷ lệ hoa hồng" htmlFor="commissionRate" hint="0.2 = nền tảng thu 20% mỗi chuyến.">
            <input
              id="commissionRate"
              className="input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.commissionRate ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, commissionRate: e.target.value }))}
            />
          </Field>
          <Field label="Hotline hỗ trợ" htmlFor="supportPhone">
            <input
              id="supportPhone"
              className="input"
              value={form.supportPhone || ''}
              onChange={(e) => setForm((p) => ({ ...p, supportPhone: e.target.value }))}
            />
          </Field>
          <Field label="Email hỗ trợ" htmlFor="supportEmail">
            <input
              id="supportEmail"
              className="input"
              type="email"
              value={form.supportEmail || ''}
              onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Chính sách hủy chuyến" htmlFor="cancellationPolicy">
          <textarea
            id="cancellationPolicy"
            className="textarea"
            value={form.cancellationPolicy || ''}
            onChange={(e) => setForm((p) => ({ ...p, cancellationPolicy: e.target.value }))}
          />
        </Field>
        <button type="submit" className="btn btn--primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
          {saving ? <span className="spinner" /> : 'Lưu cài đặt'}
        </button>
      </form>

      <div className="card stack">
        <div className="row-between">
          <strong className="text-sm">Nhà xe / đối tác</strong>
          <Badge tone="info">{operators.length}</Badge>
        </div>
        {operators.length === 0 ? (
          <EmptyState icon="building" title="Chưa có nhà xe" description="Thêm nhà xe để quản lý đội xe đối tác." />
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Nhà xe</th>
                  <th>Liên hệ</th>
                  <th>Địa chỉ</th>
                  <th>Hoa hồng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.id}>
                    <td className="text-sm">{operator.name}</td>
                    <td>
                      <div className="stack-sm" style={{ gap: 1 }}>
                        <span className="text-xs">{operator.phone || '—'}</span>
                        <span className="text-xs muted">{operator.email || '—'}</span>
                      </div>
                    </td>
                    <td className="text-xs muted">{operator.address || '—'}</td>
                    <td className="text-sm">{Math.round(Number(operator.commissionRate || 0) * 100)}%</td>
                    <td>
                      <Badge tone={operator.status === 'active' ? 'success' : 'default'}>
                        {operator.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="row-between">
          <strong className="text-sm">Nhật ký thao tác</strong>
          <span className="text-xs muted">{logs.length} bản ghi gần nhất</span>
        </div>
        {logs.length === 0 ? (
          <EmptyState icon="list" title="Chưa có bản ghi" description="Các thao tác quản trị sẽ được ghi lại tại đây." />
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs muted">{formatDateTime(log.createdAt)}</td>
                    <td className="text-sm">
                      {log.actorName || 'Hệ thống'}
                      <span className="text-xs muted"> ({log.actorRole || '—'})</span>
                    </td>
                    <td className="text-xs mono">{log.action}</td>
                    <td className="text-xs">
                      {log.entity}
                      {log.entityId ? ` #${log.entityId}` : ''}
                    </td>
                    <td className="text-xs muted">{log.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Alert tone="info" title="Ghi chú vận hành">
        Thay đổi hoa hồng chỉ áp dụng cho chuyến tạo mới. Các chuyến đã hoàn thành giữ nguyên số liệu đã ghi nhận.
      </Alert>
    </div>
  );
}
