export const formatCurrency = (value) => {
  const number = Number(value) || 0;
  return `${number.toLocaleString('vi-VN')} ₫`;
};

export const formatNumber = (value) => (Number(value) || 0).toLocaleString('vi-VN');

export const formatDistance = (km) => {
  const value = Number(km) || 0;
  if (value < 1) return `${Math.round(value * 1000)} m`;
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
};

export const formatDuration = (minutes) => {
  const value = Math.round(Number(minutes) || 0);
  if (value < 60) return `${value} phút`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
};

export const formatDateTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export const relativeTime = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(iso);
};

export const secondsLeft = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
};

export const toLocalInputValue = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
};

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();

export const TRIP_STATUS = {
  scheduled: { label: 'Đã lên lịch', tone: 'info' },
  searching: { label: 'Đang tìm tài xế', tone: 'warning' },
  assigned: { label: 'Tài xế đang đến', tone: 'accent' },
  arrived: { label: 'Tài xế đã tới', tone: 'accent' },
  in_progress: { label: 'Đang di chuyển', tone: 'accent' },
  completed: { label: 'Hoàn thành', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  no_driver: { label: 'Chưa có tài xế', tone: 'danger' },
};

export const statusLabel = (status) => TRIP_STATUS[status]?.label || status;

export const SERVICE_TYPES = [
  { code: 'ride', label: 'Đặt xe theo chuyến', description: 'Tính giá theo quãng đường và thời gian.' },
  { code: 'airport', label: 'Đưa đón sân bay', description: 'Có phụ phí ra vào sân bay, tài xế theo dõi giờ bay.' },
  { code: 'hourly', label: 'Thuê theo giờ', description: 'Tài xế và xe phục vụ bạn theo số giờ đã chọn.' },
  { code: 'daily', label: 'Thuê theo ngày', description: 'Phù hợp du lịch, công tác nhiều điểm đến.' },
  { code: 'intercity', label: 'Liên tỉnh', description: 'Đi tỉnh với giá trọn gói theo lộ trình.' },
];

export const PAYMENT_LABELS = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  online: 'Ví điện tử / thẻ',
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Chưa thanh toán',
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
  failed: 'Thất bại',
};

export const ONLINE_STATUS = {
  online: { label: 'Đang nhận chuyến', tone: 'success' },
  offline: { label: 'Ngoại tuyến', tone: 'default' },
  paused: { label: 'Tạm nghỉ', tone: 'warning' },
  on_trip: { label: 'Đang thực hiện chuyến', tone: 'accent' },
};

export const VERIFICATION_STATUS = {
  pending: { label: 'Chờ xác minh', tone: 'warning' },
  approved: { label: 'Đã xác minh', tone: 'success' },
  rejected: { label: 'Bị từ chối', tone: 'danger' },
};

export const TICKET_STATUS = {
  open: { label: 'Đang mở', tone: 'warning' },
  in_progress: { label: 'Đang xử lý', tone: 'info' },
  resolved: { label: 'Đã giải quyết', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'default' },
};

export const SUPPORT_CATEGORY_LABELS = {
  trip_issue: 'Vấn đề về chuyến đi',
  payment: 'Thanh toán / hoàn tiền',
  lost_item: 'Đồ thất lạc',
  driver_behavior: 'Thái độ tài xế',
  safety: 'An toàn chuyến đi',
  account: 'Tài khoản',
  other: 'Khác',
};

export const CANCEL_REASONS = [
  'Tôi thay đổi kế hoạch',
  'Tài xế đến quá lâu',
  'Tôi đặt nhầm chuyến',
  'Tìm được phương tiện khác',
  'Khác',
];
