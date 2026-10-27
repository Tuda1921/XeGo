import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon, { Logo } from './Icon';
import { Avatar, Badge } from './ui';
import { useAuth, useSocket, useTheme, useToast } from '../lib/context';
import { notifications as notifApi } from '../lib/api';
import { relativeTime } from '../lib/format';

const CUSTOMER_NAV = [
  { to: '/dat-xe', label: 'Đặt xe' },
  { to: '/chuyen-cua-toi', label: 'Chuyến của tôi' },
  { to: '/ho-tro', label: 'Hỗ trợ' },
];

const DRIVER_NAV = [
  { to: '/tai-xe', label: 'Bảng điều khiển' },
  { to: '/tai-xe/thu-nhap', label: 'Thu nhập' },
  { to: '/tai-xe/ho-so', label: 'Hồ sơ' },
];

const ADMIN_NAV = [
  { to: '/quan-tri', label: 'Tổng quan' },
  { to: '/quan-tri/chuyen', label: 'Chuyến' },
  { to: '/quan-tri/ban-do', label: 'Bản đồ' },
];

function NotificationBell() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const data = await notifApi.list({ limit: 20 });
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [user?.id]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNotification = (payload) => {
      setItems((prev) => [
        {
          id: payload.id || Date.now(),
          title: payload.title,
          body: payload.body,
          type: payload.type,
          createdAt: payload.createdAt || new Date().toISOString(),
          readAt: null,
        },
        ...prev,
      ].slice(0, 20));
      setUnread((n) => n + 1);
    };
    socket.on('notification', onNotification);
    return () => socket.off('notification', onNotification);
  }, [socket]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const markAll = async () => {
    try {
      const data = await notifApi.markRead(null);
      setUnread(data.unread || 0);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn--icon btn--ghost"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`}
        style={{ position: 'relative' }}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 999,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
              padding: '0 4px',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card card--flush"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 80,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="row-between" style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
            <strong className="text-sm">Thông báo</strong>
            {unread > 0 && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={markAll}>
                Đọc tất cả
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div className="text-sm muted" style={{ padding: 'var(--sp-5)', textAlign: 'center' }}>
                Chưa có thông báo nào.
              </div>
            )}
            {items.map((item) => (
              <div key={item.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                {!item.readAt && <span className="notif-dot" style={{ marginTop: 6 }} />}
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <span className="text-sm strong">{item.title}</span>
                  <span className="text-xs muted">{item.body}</span>
                  <span className="text-xs subtle">{relativeTime(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = user?.role === 'driver' ? DRIVER_NAV : user?.role === 'admin' || user?.role === 'operator' ? ADMIN_NAV : CUSTOMER_NAV;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="app-header">
      <Link to={user?.role === 'driver' ? '/tai-xe' : user?.role === 'admin' ? '/quan-tri' : '/'} aria-label="XeGo">
        <Logo />
      </Link>

      <nav className="nav-links" aria-label="Điều hướng chính">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/quan-tri' || item.to === '/tai-xe'}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
            style={({ isActive }) => (isActive ? { color: 'var(--accent-text)', background: 'var(--accent-soft)' } : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="header-actions">
        <button type="button" className="btn btn--icon btn--ghost" onClick={toggle} aria-label="Đổi giao diện sáng/tối">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <NotificationBell />

        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="row"
              onClick={() => setMenuOpen((v) => !v)}
              style={{ background: 'none', border: 'none', padding: 4, borderRadius: 999 }}
              aria-label="Tài khoản"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <Icon name="chevronDown" size={14} />
            </button>
            {menuOpen && (
              <div
                className="card card--flush"
                style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 230, zIndex: 80, boxShadow: 'var(--shadow-lg)' }}
              >
                <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
                  <div className="text-sm strong truncate">{user.name}</div>
                  <div className="text-xs muted">{user.phone}</div>
                  <div style={{ marginTop: 6 }}>
                    <Badge tone="accent">
                      {user.role === 'admin' ? 'Quản trị viên' : user.role === 'operator' ? 'Điều phối' : user.role === 'driver' ? 'Tài xế' : 'Khách hàng'}
                    </Badge>
                  </div>
                </div>
                {user.role === 'customer' && (
                  <Link to="/tai-khoan" className="list-item list-item--button">
                    <Icon name="user" size={16} />
                    <span className="text-sm">Tài khoản của tôi</span>
                  </Link>
                )}
                {user.role === 'driver' && (
                  <Link to="/tai-xe/ho-so" className="list-item list-item--button">
                    <Icon name="user" size={16} />
                    <span className="text-sm">Hồ sơ tài xế</span>
                  </Link>
                )}
                <button type="button" className="list-item list-item--button" onClick={handleLogout}>
                  <Icon name="logout" size={16} />
                  <span className="text-sm">Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/dang-nhap" className="btn btn--sm btn--ghost">
              Đăng nhập
            </Link>
            <Link to="/dang-ky" className="btn btn--sm btn--primary">
              Đặt xe ngay
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function BottomNav() {
  const { user } = useAuth();
  const items =
    user?.role === 'driver'
      ? [
          { to: '/tai-xe', label: 'Cuốc xe', icon: 'car' },
          { to: '/tai-xe/thu-nhap', label: 'Thu nhập', icon: 'wallet' },
          { to: '/tai-xe/ho-so', label: 'Hồ sơ', icon: 'user' },
        ]
      : user?.role === 'admin' || user?.role === 'operator'
        ? [
            { to: '/quan-tri', label: 'Tổng quan', icon: 'grid' },
            { to: '/quan-tri/chuyen', label: 'Chuyến', icon: 'list' },
            { to: '/quan-tri/ban-do', label: 'Bản đồ', icon: 'map' },
            { to: '/quan-tri/tai-xe', label: 'Tài xế', icon: 'users' },
          ]
        : [
            { to: '/', label: 'Trang chủ', icon: 'grid' },
            { to: '/dat-xe', label: 'Đặt xe', icon: 'car' },
            { to: '/chuyen-cua-toi', label: 'Chuyến đi', icon: 'list' },
            { to: '/tai-khoan', label: 'Tài khoản', icon: 'user' },
          ];

  return (
    <nav className="bottom-nav" aria-label="Điều hướng di động">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/' || item.to === '/quan-tri' || item.to === '/tai-xe'}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="grow">{children}</main>
      <BottomNav />
    </div>
  );
}

export function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { error } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      error('Vui lòng đăng nhập để tiếp tục');
    }
  }, [loading, user, error]);

  if (loading) {
    return (
      <div className="page center" style={{ minHeight: '60vh' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <NavigateToLogin from={location.pathname} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page page--narrow">
        <div className="card stack">
          <h2>Không có quyền truy cập</h2>
          <p className="muted">
            Trang này chỉ dành cho {roles.includes('driver') ? 'tài xế' : 'quản trị viên'}. Bạn đang đăng nhập với vai trò{' '}
            {user.role}.
          </p>
          <Link to="/" className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

function NavigateToLogin({ from }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/dang-nhap?next=${encodeURIComponent(from)}`, { replace: true });
  }, [navigate, from]);
  return (
    <div className="page center" style={{ minHeight: '60vh' }}>
      <span className="spinner" />
    </div>
  );
}
