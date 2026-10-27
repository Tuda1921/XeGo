import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Badge, EmptyState, LoadingBlock, SectionTitle, Tabs } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { PAYMENT_LABELS, PAYMENT_STATUS_LABELS, formatCurrency, formatDateTime } from '../../lib/format';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
  { value: 'failed', label: 'Thất bại' },
];

const STATUS_TONE = {
  paid: 'success',
  pending: 'warning',
  refunded: 'info',
  failed: 'danger',
  unpaid: 'default',
};

export default function AdminPayments() {
  const { success, error: toastError } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.payments();
      setRows(data.payments || []);
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

  const refund = async (payment) => {
    setBusyId(payment.id);
    try {
      await adminApi.refund(payment.id);
      success('Đã hoàn tiền cho giao dịch');
      await load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter ? rows.filter((row) => row.status === filter) : rows;
  const totalPaid = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Thanh toán"
        subtitle={`${rows.length} giao dịch · ${formatCurrency(totalPaid)} đã thu`}
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <div className="card">
        <Tabs items={STATUS_TABS} value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <LoadingBlock rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState icon="creditCard" title="Không có giao dịch" description="Chưa có giao dịch nào ở trạng thái này." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã chuyến</th>
                <th>Khách</th>
                <th>Phương thức</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Cổng thanh toán</th>
                <th>Thời gian</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((payment) => (
                <tr key={payment.id}>
                  <td className="mono text-xs">{payment.code}</td>
                  <td className="text-sm">{payment.customerName}</td>
                  <td className="text-sm">{PAYMENT_LABELS[payment.method] || payment.method}</td>
                  <td className="mono text-sm">{formatCurrency(payment.amount)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <Badge tone={STATUS_TONE[payment.status] || 'default'}>
                        {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                      </Badge>
                      {payment.simulated && <Badge tone="info">demo</Badge>}
                    </div>
                  </td>
                  <td className="text-xs muted">
                    {payment.provider || '—'}
                    {payment.providerRef ? ` · ${payment.providerRef}` : ''}
                  </td>
                  <td className="text-xs muted">{formatDateTime(payment.paidAt || payment.createdAt)}</td>
                  <td>
                    {payment.status === 'paid' && (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => refund(payment)}
                        disabled={busyId === payment.id}
                      >
                        Hoàn tiền
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
