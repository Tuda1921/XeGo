import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Icon from '../components/Icon';
import { Alert, Field } from '../components/ui';
import { useAuth, useToast } from '../lib/context';

export default function Register() {
  const { register } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [role, setRole] = useState(params.get('role') === 'driver' ? 'driver' : 'customer');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (!accepted) {
      setError('Vui lòng đồng ý với điều khoản sử dụng');
      return;
    }
    setBusy(true);
    try {
      const user = await register({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
        role,
      });
      success('Đăng ký thành công');
      navigate(user.role === 'driver' ? '/tai-xe/ho-so' : '/dat-xe', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Tạo tài khoản XeGo"
      subtitle="Chọn loại tài khoản phù hợp với bạn."
      footer={
        <p className="text-sm muted text-center">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="strong">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <div className="grid grid-2" style={{ gap: 'var(--sp-2)' }}>
        {[
          { value: 'customer', label: 'Khách hàng', icon: 'user', hint: 'Đặt xe, theo dõi chuyến' },
          { value: 'driver', label: 'Tài xế', icon: 'car', hint: 'Nhận chuyến, quản lý thu nhập' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={`vehicle-option ${role === option.value ? 'vehicle-option--active' : ''}`}
            onClick={() => setRole(option.value)}
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
          >
            <span className="row" style={{ gap: 6 }}>
              <Icon name={option.icon} size={17} />
              <strong className="text-sm">{option.label}</strong>
            </span>
            <span className="text-xs muted">{option.hint}</span>
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <form className="stack" onSubmit={submit}>
        <Field label="Họ và tên" htmlFor="name">
          <input id="name" className="input" placeholder="Nguyễn Văn A" value={form.name} onChange={update('name')} required />
        </Field>
        <Field label="Số điện thoại" htmlFor="reg-phone">
          <input
            id="reg-phone"
            className="input"
            inputMode="tel"
            placeholder="0901234567"
            value={form.phone}
            onChange={update('phone')}
            required
          />
        </Field>
        <Field label="Email (không bắt buộc)" htmlFor="reg-email">
          <input id="reg-email" className="input" type="email" placeholder="ban@example.com" value={form.email} onChange={update('email')} />
        </Field>
        <div className="grid grid-2" style={{ gap: 'var(--sp-3)' }}>
          <Field label="Mật khẩu" htmlFor="reg-password" hint="Tối thiểu 6 ký tự">
            <input
              id="reg-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              required
            />
          </Field>
          <Field label="Xác nhận mật khẩu" htmlFor="reg-confirm">
            <input
              id="reg-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={update('confirm')}
              required
            />
          </Field>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật dữ liệu của XeGo.
            {role === 'driver' && ' Tôi hiểu hồ sơ tài xế cần được xác minh trước khi nhận chuyến.'}
          </span>
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={18} />}
          Tạo tài khoản
        </button>
      </form>
    </AuthShell>
  );
}
