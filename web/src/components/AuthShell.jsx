import React from 'react';
import { Link } from 'react-router-dom';
import Icon, { Logo } from '../components/Icon';

const FEATURES = [
  { icon: 'map', title: 'Bản đồ tương tác', body: 'Chọn điểm đón, điểm trả và xem tuyến đường thật.' },
  { icon: 'navigation', title: 'Theo dõi realtime', body: 'Trạng thái chuyến và vị trí tài xế cập nhật liên tục.' },
  { icon: 'shield', title: 'Phân quyền rõ ràng', body: 'Khách, tài xế và quản trị viên có không gian riêng.' },
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <Link to="/" style={{ color: '#fff' }}>
          <Logo size={38} />
        </Link>
        <div className="auth-hero__content">
          <h1 style={{ fontSize: 'var(--fs-3xl)', marginBottom: 'var(--sp-3)' }}>Di chuyển chủ động, minh bạch từng bước</h1>
          <p style={{ color: 'rgba(255,255,255,0.78)' }}>
            XeGo kết nối bạn với tài xế đang hoạt động gần nhất, hiển thị giá rõ ràng trước khi đặt và cập nhật hành trình
            theo thời gian thực.
          </p>
          <div className="auth-features">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="auth-feature">
                <span className="auth-feature__icon">
                  <Icon name={feature.icon} size={18} />
                </span>
                <div className="stack-sm" style={{ gap: 2 }}>
                  <strong className="text-sm">{feature.title}</strong>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {feature.body}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }}>
          © {new Date().getFullYear()} XeGo · Nền tảng đặt xe và kết nối tài xế
        </span>
      </aside>

      <main className="auth-panel">
        <div className="auth-card stack">
          <div className="stack-sm">
            <h2>{title}</h2>
            {subtitle && <p className="text-sm muted">{subtitle}</p>}
          </div>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
