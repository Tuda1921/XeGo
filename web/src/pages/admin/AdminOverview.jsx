import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, BarChart, EmptyState, LoadingBlock, SectionTitle, StatCard } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useSocket, useToast } from '../../lib/context';
import { formatCurrency, formatDate } from '../../lib/format';

const QUICK_LINKS = [
  { to: '/quan-tri/chuyen', label: 'Chuyến đang chạy', icon: 'list' },
  { to: '/quan-tri/ban-do', label: 'Bản đồ trực tiếp', icon: 'map' },
  { to: '/quan-tri/tai-xe', label: 'Duyệt tài xế', icon: 'shield' },
  { to: '/quan-tri/ho-tro', label: 'Yêu cầu hỗ trợ', icon: 'headset' },
];

export default function AdminOverview() {
  const { error: toastError } = useToast();
  const { socket } = useSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.overview();
      setData(result);
    } catch (err) {
      toastError(err.message);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = () => load();
    socket.on('admin:trip_update', onUpdate);
    return () => socket.off('admin:trip_update', onUpdate);
  }, [socket, load]);

  if (loading) return <LoadingBlock rows={4} />;
  if (!data) return <EmptyState icon="alert" title="Không tải được dữ liệu" description="Vui lòng thử lại sau." />;

  const { counts, revenue, users, drivers, trend, openTickets } = data;
  const activeTrips = counts.searching + counts.assigned + counts.arrived + counts.inProgress;
  const chartData = trend.map((row) => ({ label: formatDate(row.day), value: row.gross, trips: row.trips }));

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Tổng quan vận hành"
        subtitle="Số liệu cập nhật mỗi 30 giây và ngay khi có thay đổi chuyến."
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      {drivers.pendingVerification > 0 && (
        <Alert tone="warning" title={`${drivers.pendingVerification} tài xế chờ xác minh`}>
          Hồ sơ tài xế cần được duyệt trước khi họ có thể nhận chuyến.{' '}
          <Link to="/quan-tri/tai-xe?verification=pending" className="strong">
            Đi tới danh sách
          </Link>
        </Alert>
      )}

      <div className="grid grid-4">
        <StatCard label="Chuyến đang hoạt động" value={activeTrips} meta={`${counts.searching} đang tìm tài xế`} />
        <StatCard label="Hoàn thành hôm nay" value={counts.completedToday} meta={`${counts.createdToday} chuyến tạo mới`} />
        <StatCard label="Doanh thu hôm nay" value={formatCurrency(revenue.today.gross)} meta={`${revenue.today.trips} chuyến`} />
        <StatCard label="Hoa hồng hôm nay" value={formatCurrency(revenue.today.commission)} meta={`Tỷ lệ ${Math.round(data.commissionRate * 100)}%`} />
      </div>

      <div className="grid grid-4">
        <StatCard label="Tài xế online" value={drivers.online} meta={`${drivers.onTrip} đang chạy chuyến`} />
        <StatCard label="Khách hàng" value={users.customers} meta="Tài khoản đang hoạt động" />
        <StatCard label="Doanh thu 7 ngày" value={formatCurrency(revenue.week.gross)} meta={`${revenue.week.trips} chuyến`} />
        <StatCard label="Hỗ trợ đang mở" value={openTickets} meta="Yêu cầu chưa đóng" />
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <div className="row-between">
            <strong className="text-sm">Doanh thu 7 ngày gần nhất</strong>
            <span className="text-xs muted">{formatCurrency(revenue.week.gross)}</span>
          </div>
          {chartData.length === 0 ? (
            <EmptyState icon="chart" title="Chưa có dữ liệu" description="Doanh thu sẽ hiển thị khi có chuyến hoàn thành." />
          ) : (
            <>
              <BarChart data={chartData} valueKey="value" labelKey="label" format={formatCurrency} />
              <div className="row-between text-xs muted">
                <span>{chartData[0]?.label}</span>
                <span>{chartData[chartData.length - 1]?.label}</span>
              </div>
            </>
          )}
        </div>

        <div className="card stack">
          <strong className="text-sm">Trạng thái chuyến</strong>
          <div className="stack-sm">
            <div className="row-between text-sm">
              <span className="muted">Đang tìm tài xế</span>
              <strong>{counts.searching}</strong>
            </div>
            <div className="row-between text-sm">
              <span className="muted">Tài xế đang đến</span>
              <strong>{counts.assigned}</strong>
            </div>
            <div className="row-between text-sm">
              <span className="muted">Tài xế đã tới</span>
              <strong>{counts.arrived}</strong>
            </div>
            <div className="row-between text-sm">
              <span className="muted">Đang di chuyển</span>
              <strong>{counts.inProgress}</strong>
            </div>
            <div className="row-between text-sm">
              <span className="muted">Đã lên lịch</span>
              <strong>{counts.scheduled}</strong>
            </div>
            <div className="row-between text-sm">
              <span className="muted">Không có tài xế</span>
              <strong style={{ color: 'var(--danger)' }}>{counts.noDriver}</strong>
            </div>
            <div className="row-between text-sm">
              <span className="muted">Hủy hôm nay</span>
              <strong>{counts.cancelledToday}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card stack">
        <strong className="text-sm">Truy cập nhanh</strong>
        <div className="grid grid-4">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="list-item list-item--button">
              <Icon name={link.icon} size={16} />
              <span className="text-sm">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
