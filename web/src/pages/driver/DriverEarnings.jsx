import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { BarChart, EmptyState, LoadingBlock, SectionTitle, StatCard, Tabs } from '../../components/ui';
import { driver as driverApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';

const PERIODS = [
  { value: 'day', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
];

export default function DriverEarnings() {
  const { error: toastError } = useToast();
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextPeriod) => {
      setLoading(true);
      try {
        const result = await driverApi.earnings(nextPeriod);
        setData(result);
      } catch (err) {
        toastError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [toastError],
  );

  useEffect(() => {
    load(period);
  }, [period, load]);

  const summary = data?.summary;
  const daily = (data?.daily || []).map((row) => ({
    label: formatDate(row.day),
    value: row.net,
    trips: row.trips,
  }));

  return (
    <div className="driver-shell">
      <div className="stack">
        <SectionTitle
          title="Thu nhập"
          subtitle="Số liệu tính từ các chuyến đã hoàn thành, đã trừ hoa hồng nền tảng."
          action={
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => load(period)}>
              <Icon name="refresh" size={15} />
              Làm mới
            </button>
          }
        />

        <Tabs items={PERIODS} value={period} onChange={setPeriod} />

        {loading ? (
          <LoadingBlock rows={3} />
        ) : !data ? (
          <EmptyState icon="wallet" title="Chưa có dữ liệu" description="Không tải được số liệu thu nhập." />
        ) : (
          <>
            <div className="grid grid-2" style={{ gap: 'var(--sp-2)' }}>
              <StatCard label="Thu nhập thực nhận" value={formatCurrency(summary.net)} meta={`${summary.trips} chuyến hoàn thành`} />
              <StatCard label="Tổng doanh thu" value={formatCurrency(summary.gross)} meta="Giá khách trả" />
              <StatCard label="Hoa hồng nền tảng" value={formatCurrency(summary.commission)} meta="Đã khấu trừ" />
              <StatCard label="Chuyến đã hủy" value={summary.cancelled} meta="Trong kỳ" />
            </div>

            <div className="card stack">
              <div className="row-between">
                <strong className="text-sm">Thu nhập theo ngày</strong>
                <span className="text-xs muted">{daily.length} ngày có chuyến</span>
              </div>
              {daily.length === 0 ? (
                <EmptyState icon="chart" title="Chưa có chuyến nào" description="Thu nhập sẽ hiển thị sau khi bạn hoàn thành chuyến đầu tiên." />
              ) : (
                <>
                  <BarChart data={daily} valueKey="value" labelKey="label" format={formatCurrency} />
                  <div className="row-between text-xs muted">
                    <span>{daily[0]?.label}</span>
                    <span>{daily[daily.length - 1]?.label}</span>
                  </div>
                </>
              )}
            </div>

            <div className="card stack">
              <div className="row-between">
                <strong className="text-sm">Đánh giá của bạn</strong>
                <span className="row text-sm" style={{ gap: 4 }}>
                  <Icon name="star" size={15} />
                  {Number(summary.rating || 5).toFixed(1)}
                  <span className="text-xs muted">({summary.ratingCount} lượt)</span>
                </span>
              </div>
              <span className="text-xs muted">Tổng {summary.tripsCompleted} chuyến đã hoàn thành từ khi tham gia XeGo.</span>
            </div>

            <div className="card stack">
              <strong className="text-sm">Chuyến gần đây</strong>
              {data.recent.length === 0 ? (
                <EmptyState icon="receipt" title="Chưa có chuyến" description="Các chuyến đã hoàn thành sẽ được liệt kê tại đây." />
              ) : (
                <div className="stack-sm">
                  {data.recent.map((trip) => (
                    <Link key={trip.id} to={`/chuyen/${trip.id}`} className="list-item list-item--button">
                      <div className="grow stack-sm" style={{ gap: 2 }}>
                        <span className="text-sm strong truncate">
                          {trip.pickup} → {trip.dropoff}
                        </span>
                        <span className="text-xs muted">
                          {trip.code} · {formatDateTime(trip.completedAt)}
                        </span>
                      </div>
                      <div className="stack-sm text-right" style={{ gap: 2 }}>
                        <strong className="text-sm mono">{formatCurrency(trip.earning)}</strong>
                        <span className="text-xs muted">{formatCurrency(trip.price)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
