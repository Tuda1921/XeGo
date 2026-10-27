import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Alert, Avatar, Badge, Field, Modal, SectionTitle } from '../components/ui';
import { auth as authApi, favorites as favoritesApi, places as placesApi } from '../lib/api';
import { useAuth, useToast } from '../lib/context';
import { formatCurrency, formatDate } from '../lib/format';

export default function Account() {
  const { user, refresh, logout } = useAuth();
  const { success, error: toastError } = useToast();
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [places, setPlaces] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', email: user.email || '' });
  }, [user]);

  useEffect(() => {
    placesApi.list().then((d) => setPlaces(d.places || [])).catch(() => {});
    favoritesApi.list().then((d) => setFavorites(d.favorites || [])).catch(() => {});
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await authApi.updateMe({ name: profile.name.trim(), email: profile.email.trim() || null });
      await refresh();
      success('Đã cập nhật hồ sơ');
    } catch (err) {
      toastError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const removePlace = async (id) => {
    try {
      await placesApi.remove(id);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      success('Đã xóa địa điểm');
    } catch (err) {
      toastError(err.message);
    }
  };

  const removeFavorite = async (driverId) => {
    try {
      await favoritesApi.remove(driverId);
      setFavorites((prev) => prev.filter((f) => f.driverId !== driverId));
      success('Đã bỏ tài xế yêu thích');
    } catch (err) {
      toastError(err.message);
    }
  };

  const changePassword = async () => {
    setPasswordError('');
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      await authApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      success('Đã đổi mật khẩu');
      setPasswordOpen(false);
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="page page--narrow">
      <SectionTitle title="Tài khoản của tôi" subtitle="Quản lý thông tin cá nhân, địa điểm và tài xế yêu thích." />

      <div className="card stack">
        <div className="row" style={{ gap: 'var(--sp-4)' }}>
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="stack-sm" style={{ gap: 2 }}>
            <strong className="text-lg">{user.name}</strong>
            <span className="text-sm muted">{user.phone}</span>
            <div className="row-wrap">
              <Badge tone="accent">
                {user.role === 'driver' ? 'Tài xế' : user.role === 'admin' ? 'Quản trị viên' : user.role === 'operator' ? 'Điều phối' : 'Khách hàng'}
              </Badge>
              <Badge tone={user.phoneVerified ? 'success' : 'warning'}>
                {user.phoneVerified ? 'Đã xác minh SĐT' : 'Chưa xác minh SĐT'}
              </Badge>
            </div>
            <span className="text-xs subtle">Tham gia {formatDate(user.createdAt)}</span>
          </div>
        </div>

        <hr className="divider" />

        <form className="stack" onSubmit={saveProfile}>
          <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
            <Field label="Họ và tên" htmlFor="acc-name">
              <input
                id="acc-name"
                className="input"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <Field label="Email" htmlFor="acc-email">
              <input
                id="acc-email"
                className="input"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              {savingProfile ? <span className="spinner" /> : <Icon name="check" size={16} />}
              Lưu thay đổi
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setPasswordOpen(true)}>
              <Icon name="lock" size={16} />
              Đổi mật khẩu
            </button>
          </div>
        </form>
      </div>

      <div className="card card--flush" style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
          <SectionTitle title="Địa điểm đã lưu" subtitle="Dùng nhanh khi đặt chuyến." />
        </div>
        {places.length === 0 ? (
          <div className="text-sm muted" style={{ padding: 'var(--sp-5)' }}>
            Chưa có địa điểm nào. Khi đặt xe, chọn “Lưu điểm đón” để thêm nhà riêng hoặc công ty.
          </div>
        ) : (
          places.map((place) => (
            <div key={place.id} className="list-item">
              <span className="suggest-item__icon">
                <Icon name={place.kind === 'home' ? 'heart' : place.kind === 'work' ? 'building' : 'pin'} size={15} />
              </span>
              <div className="grow stack-sm" style={{ gap: 1 }}>
                <strong className="text-sm">{place.label}</strong>
                <span className="text-xs muted clamp-2">{place.address}</span>
              </div>
              <button type="button" className="btn btn--icon btn--ghost" onClick={() => removePlace(place.id)} aria-label="Xóa">
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card card--flush" style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border)' }}>
          <SectionTitle title="Tài xế yêu thích" subtitle="Những tài xế bạn đã đánh dấu." />
        </div>
        {favorites.length === 0 ? (
          <div className="text-sm muted" style={{ padding: 'var(--sp-5)' }}>
            Chưa có tài xế yêu thích. Trong màn hình theo dõi chuyến, chạm biểu tượng trái tim để lưu tài xế.
          </div>
        ) : (
          favorites.map((driver) => (
            <div key={driver.id} className="list-item">
              <Avatar name={driver.name} src={driver.avatarUrl} size="sm" />
              <div className="grow stack-sm" style={{ gap: 1 }}>
                <strong className="text-sm">{driver.name}</strong>
                <span className="text-xs muted">
                  {Number(driver.rating || 5).toFixed(1)} ★ · {driver.tripsCompleted || 0} chuyến
                </span>
              </div>
              <button type="button" className="btn btn--icon btn--ghost" onClick={() => removeFavorite(driver.driverId)} aria-label="Bỏ yêu thích">
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card stack" style={{ marginTop: 'var(--sp-4)' }}>
        <SectionTitle title="Liên kết nhanh" />
        <div className="grid grid-2" style={{ gap: 'var(--sp-2)' }}>
          <Link to="/chuyen-cua-toi" className="btn btn--ghost">
            <Icon name="list" size={16} />
            Chuyến của tôi
          </Link>
          <Link to="/ho-tro" className="btn btn--ghost">
            <Icon name="headset" size={16} />
            Trung tâm hỗ trợ
          </Link>
        </div>
        <hr className="divider" />
        <button type="button" className="btn btn--danger" onClick={logout} style={{ alignSelf: 'flex-start' }}>
          <Icon name="logout" size={16} />
          Đăng xuất
        </button>
      </div>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Đổi mật khẩu"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPasswordOpen(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={changePassword}>
              Xác nhận
            </button>
          </>
        }
      >
        <div className="stack">
          {passwordError && <Alert tone="danger">{passwordError}</Alert>}
          <Field label="Mật khẩu hiện tại" htmlFor="cur-pass">
            <input
              id="cur-pass"
              className="input"
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
            />
          </Field>
          <Field label="Mật khẩu mới" htmlFor="new-pass" hint="Tối thiểu 6 ký tự">
            <input
              id="new-pass"
              className="input"
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </Field>
          <Field label="Xác nhận mật khẩu mới" htmlFor="confirm-pass">
            <input
              id="confirm-pass"
              className="input"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
