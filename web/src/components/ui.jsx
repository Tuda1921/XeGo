import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { initials, TRIP_STATUS } from '../lib/format';

export function Badge({ tone = 'default', children, className = '' }) {
  const cls = tone && tone !== 'default' ? `badge badge--${tone}` : 'badge';
  return <span className={`${cls} ${className}`.trim()}>{children}</span>;
}

export function StatusBadge({ status }) {
  const meta = TRIP_STATUS[status] || { label: status, tone: 'default' };
  return (
    <Badge tone={meta.tone}>
      <span className={`dot ${['searching', 'assigned', 'in_progress'].includes(status) ? 'dot--pulse' : ''}`} />
      {meta.label}
    </Badge>
  );
}

export function Avatar({ name, src, size = 'md' }) {
  const cls = size === 'sm' ? 'avatar avatar--sm' : size === 'lg' ? 'avatar avatar--lg' : 'avatar';
  if (src) {
    return (
      <span className={cls}>
        <img src={src} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    );
  }
  return <span className={cls}>{initials(name || '?')}</span>;
}

export function Plate({ children }) {
  return <span className="plate">{children}</span>;
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Skeleton({ height = 16, width = '100%', radius }) {
  return <span className="skeleton" style={{ display: 'block', height, width, borderRadius: radius }} />;
}

export function EmptyState({ icon = 'info', title, description, action }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={26} />
      </span>
      <div className="stack-sm" style={{ alignItems: 'center' }}>
        <strong>{title}</strong>
        {description && <span className="text-sm muted" style={{ maxWidth: 380 }}>{description}</span>}
      </div>
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, icon }) {
  const iconName = icon || (tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : 'info');
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={iconName} size={18} />
      <div className="grow stack-sm" style={{ gap: 2 }}>
        {title && <strong className="text-sm">{title}</strong>}
        {children && <span className="text-sm">{children}</span>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Đóng">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="btn-row" style={{ marginTop: 'var(--sp-5)', justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function StarRating({ value = 0, onChange, size = 20, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="stars" role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) =>
        readOnly ? (
          <Icon key={star} name="star" size={size} className={star <= Math.round(value) ? 'star-btn--on' : ''} />
        ) : (
          <button
            key={star}
            type="button"
            className={`star-btn ${star <= shown ? 'star-btn--on' : ''}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange?.(star)}
            aria-label={`${star} sao`}
          >
            <Icon name="star" size={size} />
          </button>
        ),
      )}
    </span>
  );
}

export function Countdown({ expiresAt, onExpire, className = '' }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const next = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setLeft(next);
      if (next === 0 && !fired.current) {
        fired.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  return (
    <span className={`countdown ${left <= 10 ? 'countdown--urgent' : ''} ${className}`.trim()}>
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={`tab ${value === item.value ? 'tab--active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span className="muted"> ({item.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, meta, tone }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </span>
      {meta && <span className="stat-card__meta">{meta}</span>}
    </div>
  );
}

export function SectionTitle({ title, action, subtitle }) {
  return (
    <div className="section-title">
      <div className="stack-sm" style={{ gap: 2 }}>
        <h3>{title}</h3>
        {subtitle && <span className="text-sm muted">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

export function KV({ label, value }) {
  return (
    <div className="kv">
      <span className="kv__k">{label}</span>
      <span className="kv__v">{value}</span>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="row" style={{ cursor: disabled ? 'not-allowed' : 'pointer', gap: 'var(--sp-3)' }}>
      <span className={`switch ${checked ? 'switch--on' : ''}`} style={{ position: 'relative', display: 'inline-block' }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'inherit' }}
        />
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: 48,
            height: 28,
            borderRadius: 999,
            background: checked ? 'var(--accent)' : 'var(--border-strong)',
            transition: 'var(--transition)',
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: checked ? 23 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              transition: 'var(--transition)',
              boxShadow: 'var(--shadow-xs)',
            }}
          />
        </span>
      </span>
      {label && <span className="text-sm strong">{label}</span>}
    </label>
  );
}

export function BarChart({ data, valueKey = 'value', labelKey = 'label', format }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="bar-chart">
      {data.map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        return (
          <div
            key={item[labelKey] || index}
            className="bar-chart__bar"
            style={{ height: `${Math.max(3, (value / max) * 100)}%` }}
            title={`${item[labelKey]}: ${format ? format(value) : value}`}
          />
        );
      })}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }) {
  return (
    <div className="stack">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton height={14} width="40%" />
          <div style={{ height: 10 }} />
          <Skeleton height={12} width="70%" />
        </div>
      ))}
    </div>
  );
}
