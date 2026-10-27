import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { BarChart, EmptyState, LoadingBlock, SectionTitle, StatCard, Tabs } from '../../components/ui';
import { admin as adminApi } from '../../lib/api';
import { useToast } from '../../lib/context';
import { formatCurrency, formatDate } from '../../lib/format';

const RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];

export default function AdminReports() {
  const { error: toastError } = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (range) => {
      setLoading(true);
      try {
        const result = await adminApi.reports(range);
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
    load(days);
  }, [days, load]);

  if (loading) return <LoadingBlock rows={4} />;
  if (!data) return <EmptyState icon="chart" title="Không tải được báo cáo" description="Vui lòng thử lại sau." />;

  const totals = data.daily.reduce(
    (acc, row) => ({
      trips: acc.trips + Number(row.trips || 0),
      completed: acc.completed + Number(row.completed || 0),
      cancelled: acc.cancelled + Number(row.cancelled || 0),
      gross: acc.gross + Number(row.gross || 0),
      commission: acc.commission + Number(row.commission || 0),
    }),
    { trips: 0, completed: 0, cancelled: 0, gross: 0, commission: 0 },
  );

  const chartData = data.daily.map((row) => ({ label: formatDate(row.day), value: row.gross, trips: row.trips }));
  const completionRate = totals.trips ? Math.round((totals.completed / totals.trips) * 100) : 0;

  return (
    <div className="stack-lg">
      <SectionTitle
        title="Báo cáo"
        subtitle={`Số liệu ${data.days} ngày gần nhất`}
        action={
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => load(days)}>
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        }
      />

      <div className="card">
        <Tabs items={RANGES} value={days} onChange={setDays} />
      </div>

      <div className="grid grid-4">
        <StatCard label="Tổng chuyến" value={totals.trips} meta={`${totals.completed} hoàn thành`} />
        <StatCard label="Tỷ lệ hoàn thành" value={`${completionRate}%`} meta={`${totals.cancelled} chuyến hủy`} />
        <StatCard label="Doanh thu" value={formatCurrency(totals.gross)} meta="Từ chuyến hoàn thành" />
        <StatCard label="Hoa hồng" value={formatCurrency(totals.commission)} meta="Nền tảng thu được" />
      </div>

      <div className="card stack">
        <div className="row-between">
          <strong className="text-sm">Doanh thu theo ngày</strong>
          <span className="text-xs muted">{chartData.length} ngày</span>
        </div>
        {chartData.length === 0 ? (
          <EmptyState icon="chart" title="Chưa có dữ liệu" description="Chưa có chuyến nào trong khoảng thời gian này." />
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

      <div className="grid grid-2">
        <div className="card stack">
          <strong className="text-sm">Doanh thu theo loại xe</strong>
          {data.byType.length === 0 ? (
            <EmptyState icon="car" title="Chưa có dữ liệu" description="Chưa có chuyến hoàn thành theo loại xe." />
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Loại xe</th>
                    <th>Chuyến</th>
                    <th>Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((row) => (
                    <tr key={row.name}>
                      <td className="text-sm">{row.name}</td>
                      <td className="text-sm">{row.trips}</td>
                      <td className="mono text-sm">{formatCurrency(row.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card stack">
          <strong className="text-sm">Tài xế nổi bật</strong>
          {data.topDrivers.length === 0 ? (
            <EmptyState icon="users" title="Chưa có dữ liệu" description="Chưa có tài xế nào hoàn thành chuyến." />
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Tài xế</th>
                    <th>Chuyến</th>
                    <th>Thu nhập</th>
                    <th>Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topDrivers.map((row) => (
                    <tr key={row.id}>
                      <td className="text-sm">{row.name}</td>
                      <td className="text-sm">{row.trips}</td>
                      <td className="mono text-sm">{formatCurrency(row.earning)}</td>
                      <td className="text-sm">{Number(row.rating || 5).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card stack">
        <strong className="text-sm">Lý do hủy chuyến</strong>
        {data.cancellationReasons.length === 0 ? (
          <EmptyState icon="info" title="Không có chuyến hủy" description="Chưa ghi nhận chuyến hủy nào trong kỳ." />
        ) : (
          <div className="stack-sm">
            {data.cancellationReasons.map((row) => (
              <div key={row.reason || 'khac'} className="row-between text-sm">
                <span className="muted">{row.reason || 'Không ghi lý do'}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
