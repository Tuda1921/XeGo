import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { catalog } from '../lib/api';

/**
 * Ô nhập địa điểm có gợi ý tự động (Nominatim qua backend, fallback dữ liệu nội bộ).
 * Hiển thị rõ nguồn dữ liệu mô phỏng khi backend trả về simulated = true.
 */
export default function PlaceSearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Nhập địa điểm',
  icon = 'search',
  near,
  autoFocus = false,
  disabled = false,
  id,
}) {
  const [query, setQuery] = useState(value?.label || value?.address || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const queryRef = useRef(query);
  // Giá trị vừa được chọn: bỏ qua lần tìm kiếm kế tiếp để danh sách gợi ý không tự mở lại.
  const selectedRef = useRef(null);

  queryRef.current = query;

  useEffect(() => {
    const next = value?.label || value?.address || '';
    if (next === queryRef.current) return;
    selectedRef.current = next;
    setQuery(next);
  }, [value?.label, value?.address]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const text = query.trim();
    if (selectedRef.current !== null && selectedRef.current === text) {
      selectedRef.current = null;
      setResults([]);
      setLoading(false);
      setOpen(false);
      return undefined;
    }
    if (text.length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return undefined;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await catalog.searchPlaces(text, near);
        setResults(data.results || []);
        setSimulated(Boolean(data.simulated));
        setOpen(true);
        setHighlight(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, near?.lat, near?.lng]);

  const choose = (item) => {
    const label = item.name || item.address;
    selectedRef.current = label;
    setQuery(label);
    setOpen(false);
    setResults([]);
    onSelect?.({
      label,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      source: item.source,
    });
  };

  const onKeyDown = (event) => {
    if (!open || !results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault();
      choose(results[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div className="input-group">
        <span className="input-group__icon">
          <Icon name={icon} size={17} />
        </span>
        <input
          id={id}
          className="input"
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          aria-label={placeholder}
          onChange={(e) => {
            selectedRef.current = null;
            setQuery(e.target.value);
            onChange?.(e.target.value);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 14 }}>
            <span className="spinner" style={{ width: 15, height: 15 }} />
          </span>
        )}
      </div>

      {open && (results.length > 0 || (!loading && query.trim().length >= 2)) && (
        <div className="suggest-list" role="listbox">
          {results.map((item, index) => (
            <button
              key={item.id || `${item.lat}-${item.lng}-${index}`}
              type="button"
              role="option"
              aria-selected={highlight === index}
              className="suggest-item"
              style={highlight === index ? { background: 'var(--bg-subtle)' } : undefined}
              onClick={() => choose(item)}
              onMouseEnter={() => setHighlight(index)}
            >
              <span className="suggest-item__icon">
                <Icon name="pin" size={15} />
              </span>
              <span className="grow stack-sm" style={{ gap: 1 }}>
                <span className="text-sm strong truncate">{item.name || item.address}</span>
                <span className="text-xs muted clamp-2">{item.address}</span>
              </span>
            </button>
          ))}
          {!results.length && !loading && (
            <div className="text-sm muted" style={{ padding: '10px 12px' }}>
              Không tìm thấy địa điểm phù hợp. Hãy chọn trực tiếp trên bản đồ.
            </div>
          )}
          {simulated && (
            <div className="text-xs subtle" style={{ padding: '6px 12px', borderTop: '1px solid var(--border)' }}>
              Kết quả từ dữ liệu nội bộ (dịch vụ bản đồ ngoài chưa phản hồi).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
