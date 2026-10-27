import React, { useState } from 'react';

const ACCOUNTS = [
  { role: 'Khách hàng', phone: '0901234567', password: 'customer123' },
  { role: 'Tài xế', phone: '0901111222', password: 'driver123' },
  { role: 'Quản trị', phone: '0900000001', password: 'admin123' },
  { role: 'Điều phối', phone: '0900000002', password: 'operator123' },
];

/**
 * Nhãn nhỏ cho biết đây là bản demo tĩnh chạy hoàn toàn trong trình duyệt.
 */
export default function DemoBadge() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 4000,
        fontFamily: 'inherit',
        maxWidth: 320,
      }}
    >
      {open && (
        <div
          className="card"
          style={{
            marginBottom: 8,
            padding: 'var(--sp-3)',
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0,0,0,.18))',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 6 }}>Bản demo tĩnh</strong>
          <p style={{ margin: '0 0 8px' }}>
            Toàn bộ dữ liệu được mô phỏng ngay trong trình duyệt (không có backend). Thay đổi sẽ mất
            khi tải lại trang.
          </p>
          <div style={{ display: 'grid', gap: 4 }}>
            {ACCOUNTS.map((a) => (
              <div key={a.phone} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="muted">{a.role}</span>
                <code style={{ fontSize: 11 }}>
                  {a.phone} / {a.password}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #d8e0dd)',
          boxShadow: '0 4px 14px rgba(0,0,0,.12)',
          fontSize: 12,
        }}
      >
        {open ? 'Đóng' : 'Bản demo tĩnh'}
      </button>
    </div>
  );
}
