import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Avatar, Badge, EmptyState, LoadingBlock, SectionTitle } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';

export default function AdminCustomers() {
  const { error: toastError } = useToast();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.customers(search ? { q: search } : {});
      setRows(data.customers || []);
    } catch (err) {
      toastError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Khách hàng"
        subtitle={`${rows.length} khách hàng`}
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <form
        className="card row"
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
            placeholder="Tìm theo tên hoặc số điện thoại"
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

      {loading ? (
        <LoadingBlock rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="user" title="Không có khách hàng" description="Thử từ khóa tìm kiếm khác." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Liên hệ</th>
                <th>Chuyến</th>
                <th>Tổng chi tiêu</th>
                <th>Chuyến gần nhất</th>
                <th>Trạng thái</th>
                <th>Tham gia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar name={customer.name} size="sm" />
                      <span className="text-sm">{customer.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="stack-sm" style={{ gap: 1 }}>
                      <span className="text-xs">{customer.phone}</span>
                      <span className="text-xs muted">{customer.email || '—'}</span>
                    </div>
                  </td>
                  <td className="text-sm">{customer.trips}</td>
                  <td className="mono text-sm">{formatCurrency(customer.spent)}</td>
                  <td className="text-xs muted">{customer.lastTripAt ? formatDateTime(customer.lastTripAt) : 'Chưa có'}</td>
                  <td>
                    <Badge tone={customer.status === 'active' ? 'success' : 'danger'}>
                      {customer.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                    </Badge>
                  </td>
                  <td className="text-xs muted">{formatDate(customer.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
