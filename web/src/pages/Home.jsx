import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { Badge, SectionTitle } from '../components/ui';
import { useAuth } from '../lib/context';
import { catalog } from '../lib/api';
import { formatCurrency } from '../lib/format';

const FEATURES = [
  {
    icon: 'map',
    title: 'Chọn điểm đón trên bản đồ thật',
    body: 'Tìm địa chỉ, kéo ghim để chỉnh vị trí chính xác và xem tuyến đường dự kiến trước khi đặt.',
  },
  {
    icon: 'car',
    title: 'Nhiều loại xe, giá minh bạch',
    body: 'Từ xe 4 chỗ đến xe 45 chỗ. Bảng giá tách riêng từng khoản: giá mở cửa, quãng đường, phụ phí, giảm giá.',
  },
  {
    icon: 'navigation',
    title: 'Theo dõi tài xế trực tiếp',
    body: 'Cập nhật trạng thái và vị trí tài xế theo thời gian thực, kèm liên kết chia sẻ hành trình cho người thân.',
  },
  {
    icon: 'shield',
    title: 'Tài xế được xác minh',
    body: 'Hồ sơ tài xế, giấy phép lái xe và phương tiện phải được quản trị viên phê duyệt trước khi nhận khách.',
  },
];

const SERVICES = [
  { icon: 'car', title: 'Đặt xe theo chuyến', body: 'Nội thành, liên tỉnh, tính giá theo quãng đường thực tế.' },
  { icon: 'luggage', title: 'Đưa đón sân bay', body: 'Phụ phí sân bay rõ ràng, tài xế theo dõi giờ bay.' },
  { icon: 'clock', title: 'Thuê theo giờ', body: 'Tài xế và xe phục vụ bạn theo số giờ đã chọn.' },
  { icon: 'calendar', title: 'Thuê theo ngày', body: 'Lịch trình nhiều điểm, phù hợp du lịch và công tác.' },
  { icon: 'route', title: 'Nhiều điểm dừng', body: 'Thêm điểm dừng dọc đường, mỗi điểm có phụ phí niêm yết.' },
  { icon: 'users', title: 'Xe đoàn, xe khách', body: 'Xe 16, 29, 35, 45 chỗ cho đoàn đông người.' },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [promos, setPromos] = useState([]);

  useEffect(() => {
    catalog.vehicleTypes().then((d) => setVehicleTypes(d.vehicleTypes || [])).catch(() => {});
    catalog.promos().then((d) => setPromos(d.promos || [])).catch(() => {});
  }, []);

  const startBooking = () => navigate(user ? '/dat-xe' : '/dang-nhap?next=%2Fdat-xe');

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__content">
          <span className="eyebrow" style={{ color: 'var(--brand-300)' }}>
            Nền tảng đặt xe &amp; kết nối tài xế
          </span>
          <h1>Đặt xe nhanh, biết giá trước, theo dõi từng phút</h1>
          <p>
            Chọn điểm đón trên bản đồ, so sánh loại xe và xác nhận chỉ trong vài bước. Hệ thống tự động tìm tài xế đang
            hoạt động phù hợp với yêu cầu của bạn.
          </p>
          <div className="btn-row" style={{ marginTop: 'var(--sp-6)' }}>
            <button type="button" className="btn btn--lg" style={{ background: '#fff', color: 'var(--brand-800)' }} onClick={startBooking}>
              <Icon name="car" size={18} />
              Đặt xe ngay
            </button>
            <Link to="/dang-nhap" className="btn btn--lg btn--ghost" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
              Tôi là tài xế
            </Link>
          </div>
        </div>
        <div className="hero__stats" style={{ marginTop: 'var(--sp-10)' }}>
          <div className="hero__stat">
            <strong>{vehicleTypes.length || 8}</strong>
            <span>Loại xe</span>
          </div>
          <div className="hero__stat">
            <strong>24/7</strong>
            <span>Điều phối</span>
          </div>
          <div className="hero__stat">
            <strong>5</strong>
            <span>Tỉnh thành</span>
          </div>
          <div className="hero__stat">
            <strong>Realtime</strong>
            <span>Cập nhật trạng thái</span>
          </div>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginBottom: 'var(--sp-8)' }}>
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card row" style={{ alignItems: 'flex-start', gap: 'var(--sp-4)' }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--r-md)',
                background: 'var(--accent-soft)',
                color: 'var(--accent-text)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={feature.icon} size={22} />
            </span>
            <div className="stack-sm" style={{ gap: 4 }}>
              <strong>{feature.title}</strong>
              <span className="text-sm muted">{feature.body}</span>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 'var(--sp-8)' }}>
        <SectionTitle
          title="Dịch vụ phù hợp mọi nhu cầu"
          subtitle="Mỗi dịch vụ có cách tính giá riêng, luôn hiển thị trước khi bạn xác nhận."
        />
        <div className="grid grid-3">
          {SERVICES.map((service) => (
            <div key={service.title} className="card stack-sm">
              <span style={{ color: 'var(--accent-text)' }}>
                <Icon name={service.icon} size={22} />
              </span>
              <strong className="text-sm">{service.title}</strong>
              <span className="text-sm muted">{service.body}</span>
            </div>
          ))}
        </div>
      </section>

      {vehicleTypes.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-8)' }}>
          <SectionTitle title="Bảng giá tham khảo" subtitle="Giá mở cửa và đơn giá theo km cho từng loại xe." />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Loại xe</th>
                  <th>Số ghế</th>
                  <th>Giá mở cửa</th>
                  <th>Mỗi km</th>
                  <th>Mỗi phút</th>
                  <th>Giá tối thiểu</th>
                </tr>
              </thead>
              <tbody>
                {vehicleTypes.map((type) => (
                  <tr key={type.id}>
                    <td>
                      <strong>{type.name}</strong>
                      {type.tier === 'premium' && (
                        <span style={{ marginLeft: 8 }}>
                          <Badge tone="accent">Cao cấp</Badge>
                        </span>
                      )}
                    </td>
                    <td>{type.seats}</td>
                    <td className="mono">{formatCurrency(type.baseFare)}</td>
                    <td className="mono">{formatCurrency(type.perKm)}</td>
                    <td className="mono">{formatCurrency(type.perMinute)}</td>
                    <td className="mono">{formatCurrency(type.minFare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {promos.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-8)' }}>
          <SectionTitle title="Ưu đãi đang chạy" subtitle="Nhập mã ở bước xác nhận để được giảm giá." />
          <div className="grid grid-3">
            {promos.map((promo) => (
              <div key={promo.code} className="card stack-sm" style={{ borderStyle: 'dashed' }}>
                <div className="row-between">
                  <strong className="text-lg" style={{ letterSpacing: '0.04em' }}>
                    {promo.code}
                  </strong>
                  <Icon name="gift" size={20} />
                </div>
                <span className="text-sm muted">{promo.description}</span>
                <span className="text-xs subtle">
                  Đơn tối thiểu {formatCurrency(promo.minOrder)}
                  {promo.maxDiscount ? ` · giảm tối đa ${formatCurrency(promo.maxDiscount)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card card--accent stack" style={{ alignItems: 'flex-start' }}>
        <h2 style={{ color: '#fff' }}>Bạn có xe? Hợp tác cùng XeGo</h2>
        <p className="muted" style={{ maxWidth: 620 }}>
          Đăng ký tài xế, bổ sung giấy phép lái xe và thông tin phương tiện. Sau khi được xác minh, bạn có thể bật trạng
          thái nhận chuyến và theo dõi thu nhập theo ngày, tuần, tháng.
        </p>
        <div className="btn-row">
          <Link to="/dang-ky?role=driver" className="btn" style={{ background: '#fff', color: 'var(--brand-800)' }}>
            Đăng ký làm tài xế
          </Link>
          <Link to="/dang-nhap" className="btn btn--ghost" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
            Đăng nhập
          </Link>
        </div>
      </section>
    </div>
  );
}
