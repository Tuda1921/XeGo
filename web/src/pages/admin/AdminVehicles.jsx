import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Badge, EmptyState, LoadingBlock, Plate, SectionTitle, Tabs } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatDate } from '../../lib/format';

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'inactive', label: 'Tạm dừng' },
];

const STATUS_META = {
  active: { label: 'Hoạt động', tone: 'success' },
  pending: { label: 'Chờ duyệt', tone: 'warning' },
  inactive: { label: 'Tạm dừng', tone: 'default' },
};

export default function AdminVehicles() {
  const { success, error: toastError } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.vehicles();
      setRows(data.vehicles || []);
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

  const changeStatus = async (vehicle, status) => {
    setBusyId(vehicle.id);
    try {
      await adminApi.updateVehicle(vehicle.id, status);
      success('Đã cập nhật trạng thái phương tiện');
      await load();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter ? rows.filter((row) => row.status === filter) : rows;

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Phương tiện"
        subtitle={`${visible.length} phương tiện`}
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
        <EmptyState icon="car" title="Không có phương tiện" description="Chưa có phương tiện nào ở trạng thái này." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Biển số</th>
                <th>Xe</th>
                <th>Loại</th>
                <th>Tài xế</th>
                <th>Trạng thái</th>
                <th>Đăng ký</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((vehicle) => {
                const meta = STATUS_META[vehicle.status] || STATUS_META.inactive;
                return (
                  <tr key={vehicle.id}>
                    <td>
                      <Plate>{vehicle.plate}</Plate>
                    </td>
                    <td>
                      <div className="stack-sm" style={{ gap: 1 }}>
                        <span className="text-sm">
                          {vehicle.brand || '—'} {vehicle.model || ''}
                        </span>
                        <span className="text-xs muted">
                          {vehicle.color || '—'} · {vehicle.year || '—'} · {vehicle.seats} chỗ
                        </span>
                      </div>
                    </td>
                    <td className="text-sm">{vehicle.typeName}</td>
                    <td>
                      <div className="stack-sm" style={{ gap: 1 }}>
                        <span className="text-sm">{vehicle.driverName}</span>
                        <span className="text-xs muted">{vehicle.driverPhone}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="text-xs muted">{formatDate(vehicle.createdAt)}</td>
                    <td>
                      <select
                        className="select"
                        style={{ minWidth: 130 }}
                        value={vehicle.status}
                        disabled={busyId === vehicle.id}
                        onChange={(e) => changeStatus(vehicle, e.target.value)}
                      >
                        <option value="active">Hoạt động</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="inactive">Tạm dừng</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
