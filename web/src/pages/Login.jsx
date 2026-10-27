import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import Icon from '../components/Icon';
import { Alert, Field } from '../components/ui';
import { useAuth, useToast } from '../lib/context';
import { auth as authApi } from '../lib/api';

const DEMO_ACCOUNTS = [
  { role: 'Khách hàng', phone: '0901234567', password: 'customer123' },
  { role: 'Tài xế', phone: '0901111222', password: 'driver123' },
  { role: 'Quản trị', phone: '0900000001', password: 'admin123' },
  { role: 'Điều phối', phone: '0900000002', password: 'operator123' },
];

const HOME_BY_ROLE = {
  customer: '/dat-xe',
  driver: '/tai-xe',
  admin: '/quan-tri',
  operator: '/quan-tri',
};

export default function Login() {
  const { login, loginWithOtp } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');

  const [mode, setMode] = useState('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = (user) => {
    const target = next || HOME_BY_ROLE[user.role] || '/';
    navigate(target, { replace: true });
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(phone.trim(), password);
      success(`Xin chào ${user.name}`);
      go(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await authApi.requestOtp(phone.trim(), 'login');
      setOtpSent(true);
      setOtpInfo(data);
      success(data.demo ? 'Mã OTP đã in ở log server (chế độ mô phỏng)' : 'Mã OTP đã được gửi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await loginWithOtp({ phone: phone.trim(), code: otp.trim() });
      success(`Xin chào ${user.name}`);
      go(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (account) => {
    setMode('password');
    setPhone(account.phone);
    setPassword(account.password);
    setError('');
  };

  return (
    <AuthShell
      title="Đăng nhập XeGo"
      subtitle="Sử dụng số điện thoại và mật khẩu, hoặc đăng nhập bằng mã OTP."
      footer={
        <p className="text-sm muted text-center">
          Chưa có tài khoản?{' '}
          <Link to="/dang-ky" className="strong">
            Đăng ký ngay
          </Link>
        </p>
      }
    >
      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className={`tab ${mode === 'password' ? 'tab--active' : ''}`} onClick={() => setMode('password')}>
          Mật khẩu
        </button>
        <button type="button" className={`tab ${mode === 'otp' ? 'tab--active' : ''}`} onClick={() => setMode('otp')}>
          Mã OTP
        </button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {mode === 'password' ? (
        <form className="stack" onSubmit={submitPassword}>
          <Field label="Số điện thoại" htmlFor="phone">
            <div className="input-group">
              <span className="input-group__icon">
                <Icon name="phone" size={17} />
              </span>
              <input
                id="phone"
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </Field>
          <Field label="Mật khẩu" htmlFor="password">
            <div className="input-group">
              <span className="input-group__icon">
                <Icon name="lock" size={17} />
              </span>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </Field>
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="arrowRight" size={18} />}
            Đăng nhập
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={submitOtp}>
          <Field label="Số điện thoại" htmlFor="otp-phone" hint="Mã OTP có hiệu lực 5 phút.">
            <div className="input-group">
              <span className="input-group__icon">
                <Icon name="phone" size={17} />
              </span>
              <input
                id="otp-phone"
                className="input"
                inputMode="tel"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </Field>

          {otpSent && (
            <Field label="Mã OTP" htmlFor="otp-code">
              <input
                id="otp-code"
                className="input"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </Field>
          )}

          {otpInfo?.demo && (
            <Alert tone="info" title="Chế độ mô phỏng SMS">
              Mã OTP được in trong log của server (không gửi SMS thật). Xem cửa sổ terminal đang chạy backend.
            </Alert>
          )}

          {otpSent ? (
            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="check" size={18} />}
              Xác nhận OTP
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={requestOtp} disabled={busy || phone.trim().length < 9}>
              {busy ? <span className="spinner" /> : <Icon name="message" size={18} />}
              Gửi mã OTP
            </button>
          )}
        </form>
      )}

      <div className="demo-accounts">
        <span className="text-xs strong muted">Tài khoản demo (bấm để điền nhanh)</span>
        {DEMO_ACCOUNTS.map((account) => (
          <button key={account.phone} type="button" className="demo-account" onClick={() => fillDemo(account)}>
            <span className="strong">{account.role}</span>
            <span className="mono muted">
              {account.phone} · {account.password}
            </span>
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
