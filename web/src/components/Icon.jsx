import React from 'react';

const paths = {
  car: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a2 2 0 0 1 2 2v3h-2m-14 0H3v-3a2 2 0 0 1 2-2m2 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  pin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3.5 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
  users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M17 4.5a3.5 3.5 0 0 1 0 7 M18 21a6 6 0 0 0-2-4.5',
  phone: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  lock: 'M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12.5l5 5L20 6.5',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  arrowRight: 'M4 12h16M14 6l6 6-6 6',
  arrowLeft: 'M20 12H4M10 6l-6 6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  star: 'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z',
  heart: 'M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z M10 18a2 2 0 0 0 4 0',
  wallet: 'M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 7V6a2 2 0 0 1 2-2h11 M16 13h2',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z',
  logout: 'M15 17l5-5-5-5 M20 12H9 M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  edit: 'M4 20h4l10-10-4-4L4 16z M14 6l4 4',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 5v6h-6',
  share: 'M8 12l8-4M8 12l8 4 M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M6 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  message: 'M4 5h16v11H9l-5 4z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v6 M12 7.5v.5',
  alert: 'M12 3l9 17H3z M12 9v5 M12 17v.5',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  navigation: 'M3 11l18-8-8 18-2-8z',
  calendar: 'M4 6h16v15H4z M8 3v4M16 3v4M4 11h16',
  creditCard: 'M2 7h20v11H2z M2 11h20',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6M9 12h6',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v6H5a1 1 0 0 1-1-1z M20 14h-3v6h2a1 1 0 0 0 1-1z',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  map: 'M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z M9 4v14M15 6v14',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 21h16',
  power: 'M12 3v9 M7.5 6.5a7 7 0 1 0 9 0',
  route: 'M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M8 18h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h7',
  seat: 'M7 4h6a3 3 0 0 1 3 3v7H7z M7 14v6M17 14v6M4 20h16',
  luggage: 'M6 8h12v12H6z M9 8V5h6v3 M10 12v4M14 12v4',
  snow: 'M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9',
  wifi: 'M5 12a10 10 0 0 1 14 0 M8 15.5a6 6 0 0 1 8 0 M12 19h.01',
  tag: 'M3 12V4h8l9 9-8 8z M7.5 8h.01',
  gift: 'M4 11h16v10H4z M2 7h20v4H2z M12 7v14 M12 7S9 3 7 4.5 8 7 12 7Zm0 0s3-4 5-2.5S16 7 12 7Z',
  trending: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  dollar: 'M12 3v18 M16 7.5A3.5 3.5 0 0 0 12.5 5h-1a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6h-1A3.5 3.5 0 0 1 8 15.5',
  building: 'M4 21V5l8-2v18 M12 21h8V9l-8-4 M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2',
  key: 'M15 8a4 4 0 1 0-3.5 4L4 19.5V21h3v-2h2v-2h2l1.5-1.5A4 4 0 0 0 15 8Z',
  flag: 'M5 21V4h9l-1 3 1 3H5',
  play: 'M7 4l13 8-13 8z',
  stop: 'M6 6h12v12H6z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1-2.1-.9 2.1-.9z',
};

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.7, ...rest }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {d.split(' M').map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

export function Logo({ size = 32, withText = true }) {
  return (
    <span className="brand">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="var(--accent)" />
        <path d="M11 27l7-14h4l-7 14z" fill="#fff" opacity="0.95" />
        <path d="M22 13h7l-4 7h4l-7 7 2-7h-4z" fill="#fff" />
      </svg>
      {withText && <span className="brand-name">XeGo</span>}
    </span>
  );
}
