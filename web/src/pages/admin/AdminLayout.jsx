import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useAuth } from '../../lib/context';

const NAV = [
  { to: '/quan-tri', label: 'Tổng quan', icon: 'grid', end: true },
  { to: '/quan-tri/chuyen', label: 'Chuyến xe', icon: 'list' },
  { to: '/quan-tri/ban-do', label: 'Bản đồ trực tiếp', icon: 'map' },
  { to: '/quan-tri/tai-xe', label: 'Tài xế', icon: 'users' },
  { to: '/quan-tri/khach-hang', label: 'Khách hàng', icon: 'user' },
  { to: '/quan-tri/phuong-tien', label: 'Phương tiện', icon: 'car' },
  { to: '/quan-tri/bang-gia', label: 'Bảng giá', icon: 'dollar' },
  { to: '/quan-tri/khuyen-mai', label: 'Khuyến mãi', icon: 'gift' },
  { to: '/quan-tri/thanh-toan', label: 'Thanh toán', icon: 'creditCard' },
  { to: '/quan-tri/ho-tro', label: 'Hỗ trợ', icon: 'headset' },
  { to: '/quan-tri/bao-cao', label: 'Báo cáo', icon: 'chart' },
  { to: '/quan-tri/cai-dat', label: 'Cài đặt', icon: 'settings' },
];

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
        <div className="stack-sm" style={{ gap: 2, padding: '0 var(--sp-3) var(--sp-3)' }}>
          <span className="eyebrow">Trung tâm điều hành</span>
          <strong className="text-sm">{user?.name}</strong>
          <span className="text-xs muted">{user?.role === 'operator' ? 'Nhà xe / đối tác' : 'Quản trị viên'}</span>
        </div>
        <nav className="stack-sm" style={{ gap: 2 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
