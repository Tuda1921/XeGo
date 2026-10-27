import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

export default function NotFound() {
  return (
    <div className="page page--narrow center" style={{ minHeight: '70vh' }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--r-xl)',
            background: 'var(--accent-soft)',
            color: 'var(--accent-text)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="map" size={32} />
        </span>
        <h1>Không tìm thấy trang</h1>
        <p className="muted" style={{ maxWidth: 420 }}>
          Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi.
        </p>
        <div className="btn-row">
          <Link to="/" className="btn btn--primary">
            Về trang chủ
          </Link>
          <Link to="/dat-xe" className="btn btn--ghost">
            Đặt xe
          </Link>
        </div>
      </div>
    </div>
  );
}
