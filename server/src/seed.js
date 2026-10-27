import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';
import { config } from './config.js';
import { addMinutes, nowIso, shareToken, tripCode } from './utils.js';

const VEHICLE_TYPES = [
  {
    code: 'sedan4',
    name: 'Xe 4 chỗ',
    seats: 4,
    description: 'Phù hợp 1–3 khách, hành lý gọn nhẹ, di chuyển nội thành.',
    icon: 'car',
    base_fare: 25000,
    per_km: 11500,
    per_minute: 350,
    min_fare: 45000,
    hourly_rate: 180000,
    daily_rate: 1200000,
    luggage_capacity: 2,
    tier: 'standard',
    sort_order: 1,
  },
  {
    code: 'suv7',
    name: 'Xe 7 chỗ',
    seats: 7,
    description: 'Rộng rãi cho gia đình, phù hợp hành lý cồng kềnh.',
    icon: 'suv',
    base_fare: 35000,
    per_km: 14500,
    per_minute: 450,
    min_fare: 65000,
    hourly_rate: 240000,
    daily_rate: 1600000,
    luggage_capacity: 4,
    tier: 'standard',
    sort_order: 2,
  },
  {
    code: 'van9',
    name: 'Xe 9 chỗ',
    seats: 9,
    description: 'Nhóm nhỏ, gia đình đông người hoặc đưa đón sân bay.',
    icon: 'van',
    base_fare: 45000,
    per_km: 16500,
    per_minute: 500,
    min_fare: 85000,
    hourly_rate: 300000,
    daily_rate: 2000000,
    luggage_capacity: 6,
    tier: 'standard',
    sort_order: 3,
  },
  {
    code: 'van16',
    name: 'Xe 16 chỗ',
    seats: 16,
    description: 'Đưa đón đoàn, du lịch ngắn ngày, liên tỉnh.',
    icon: 'minibus',
    base_fare: 120000,
    per_km: 22000,
    per_minute: 700,
    min_fare: 350000,
    hourly_rate: 450000,
    daily_rate: 3200000,
    luggage_capacity: 12,
    tier: 'standard',
    sort_order: 4,
  },
  {
    code: 'bus29',
    name: 'Xe 29 chỗ',
    seats: 29,
    description: 'Đoàn đông, sự kiện, đưa đón tập thể.',
    icon: 'bus',
    base_fare: 250000,
    per_km: 32000,
    per_minute: 900,
    min_fare: 900000,
    hourly_rate: 700000,
    daily_rate: 5200000,
    luggage_capacity: 20,
    tier: 'standard',
    sort_order: 5,
  },
  {
    code: 'bus35',
    name: 'Xe 35 chỗ',
    seats: 35,
    description: 'Xe khách cỡ trung cho đoàn lớn và liên tỉnh.',
    icon: 'bus',
    base_fare: 320000,
    per_km: 36000,
    per_minute: 1000,
    min_fare: 1100000,
    hourly_rate: 850000,
    daily_rate: 6200000,
    luggage_capacity: 25,
    tier: 'standard',
    sort_order: 6,
  },
  {
    code: 'bus45',
    name: 'Xe 45 chỗ',
    seats: 45,
    description: 'Xe khách cỡ lớn cho đoàn, hội nghị, du lịch dài ngày.',
    icon: 'bus',
    base_fare: 420000,
    per_km: 42000,
    per_minute: 1200,
    min_fare: 1500000,
    hourly_rate: 1100000,
    daily_rate: 8000000,
    luggage_capacity: 35,
    tier: 'standard',
    sort_order: 7,
  },
  {
    code: 'premium4',
    name: 'Xe 4 chỗ cao cấp',
    seats: 4,
    description: 'Xe sang, tài xế chuyên nghiệp, phù hợp đối tác và sự kiện.',
    icon: 'car',
    base_fare: 60000,
    per_km: 19000,
    per_minute: 600,
    min_fare: 120000,
    hourly_rate: 350000,
    daily_rate: 2400000,
    luggage_capacity: 2,
    tier: 'premium',
    sort_order: 8,
  },
];

const SERVICE_AREAS = [
  { name: 'TP. Hồ Chí Minh', province: 'Hồ Chí Minh', center_lat: 10.7769, center_lng: 106.7009, radius_km: 45 },
  { name: 'Hà Nội', province: 'Hà Nội', center_lat: 21.0278, center_lng: 105.8342, radius_km: 45 },
  { name: 'Đà Nẵng', province: 'Đà Nẵng', center_lat: 16.0544, center_lng: 108.2022, radius_km: 35 },
  { name: 'Cần Thơ', province: 'Cần Thơ', center_lat: 10.0452, center_lng: 105.7469, radius_km: 30 },
  { name: 'Hải Phòng', province: 'Hải Phòng', center_lat: 20.8449, center_lng: 106.6881, radius_km: 30 },
];

const OPERATORS = [
  { name: 'Nhà xe Phương Nam', phone: '02838221122', email: 'dieuhanh@phuongnam.vn', address: '12 Nguyễn Văn Linh, Quận 7, TP.HCM', commission_rate: 0.18 },
  { name: 'Hợp tác xã Vận tải Thủ Đô', phone: '02437654321', email: 'dieuhanh@vantaitthudo.vn', address: '88 Giải Phóng, Hà Nội', commission_rate: 0.15 },
  { name: 'XeGo Premium Partner', phone: '02839998888', email: 'partner@xegopremium.vn', address: '25 Lê Lợi, Quận 1, TP.HCM', commission_rate: 0.22 },
];

const PROMOS = [
  { code: 'XEGO20', description: 'Giảm 20% tối đa 50.000 ₫ cho chuyến đầu tiên', type: 'percent', value: 20, min_order: 100000, max_discount: 50000, usage_limit: 1000 },
  { code: 'SANBAY50', description: 'Giảm 50.000 ₫ cho chuyến sân bay', type: 'fixed', value: 50000, min_order: 250000, max_discount: null, usage_limit: 500 },
  { code: 'CUOITUAN10', description: 'Giảm 10% cho chuyến cuối tuần', type: 'percent', value: 10, min_order: 0, max_discount: 30000, usage_limit: 2000 },
];

const CUSTOMERS = [
  { name: 'Nguyễn Minh Anh', phone: '0901234567', email: 'minhanh@example.com' },
  { name: 'Trần Quốc Bảo', phone: '0912345678', email: 'quocbao@example.com' },
  { name: 'Lê Thu Hà', phone: '0987654321', email: 'thuha@example.com' },
  { name: 'Phạm Đức Duy', phone: '0938111222', email: 'ducduy@example.com' },
  { name: 'Công ty TNHH An Phát', phone: '02873001122', email: 'booking@anphat.vn' },
];

const DRIVERS = [
  {
    name: 'Nguyễn Văn Hùng',
    phone: '0901111222',
    email: 'hung.driver@xego.vn',
    license: 'B2-790123456',
    idCard: '079123456789',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51F-123.45', brand: 'Toyota', model: 'Vios', color: 'Trắng', year: 2021, typeCode: 'sedan4' },
    location: { lat: 10.7769, lng: 106.7009 },
    online: 'online',
    rating: 4.9,
    ratingCount: 128,
    trips: 342,
    operator: 0,
  },
  {
    name: 'Trần Thị Mai',
    phone: '0902222333',
    email: 'mai.driver@xego.vn',
    license: 'B2-790234567',
    idCard: '079234567890',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51G-678.90', brand: 'Mitsubishi', model: 'Xpander', color: 'Bạc', year: 2022, typeCode: 'suv7' },
    location: { lat: 10.7921, lng: 106.7218 },
    online: 'online',
    rating: 4.8,
    ratingCount: 96,
    trips: 210,
    operator: 0,
  },
  {
    name: 'Lê Hoàng Nam',
    phone: '0903333444',
    email: 'nam.driver@xego.vn',
    license: 'D-790345678',
    idCard: '079345678901',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51B-246.80', brand: 'Ford', model: 'Transit', color: 'Trắng', year: 2020, typeCode: 'van16' },
    location: { lat: 10.8142, lng: 106.6653 },
    online: 'online',
    rating: 4.7,
    ratingCount: 64,
    trips: 158,
    operator: 0,
  },
  {
    name: 'Phạm Văn Tú',
    phone: '0904444555',
    email: 'tu.driver@xego.vn',
    license: 'B2-790456789',
    idCard: '079456789012',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51H-135.79', brand: 'Honda', model: 'CR-V', color: 'Đen', year: 2023, typeCode: 'premium4' },
    location: { lat: 10.7781, lng: 106.7019 },
    online: 'online',
    rating: 5.0,
    ratingCount: 41,
    trips: 87,
    operator: 2,
  },
  {
    name: 'Đỗ Thị Lan',
    phone: '0905555666',
    email: 'lan.driver@xego.vn',
    license: 'B2-790567890',
    idCard: '079567890123',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51F-987.65', brand: 'Kia', model: 'Carnival', color: 'Xám', year: 2022, typeCode: 'suv7' },
    location: { lat: 10.729, lng: 106.721 },
    online: 'offline',
    rating: 4.6,
    ratingCount: 33,
    trips: 74,
    operator: 0,
  },
  {
    name: 'Vũ Minh Quân',
    phone: '0906666777',
    email: 'quan.driver@xego.vn',
    license: 'E-790678901',
    idCard: '079678901234',
    area: 'Hà Nội',
    vehicle: { plate: '29B-111.22', brand: 'Hyundai', model: 'Solati', color: 'Trắng', year: 2021, typeCode: 'van16' },
    location: { lat: 21.0287, lng: 105.8524 },
    online: 'online',
    rating: 4.8,
    ratingCount: 52,
    trips: 121,
    operator: 1,
  },
  {
    name: 'Hoàng Anh Tuấn',
    phone: '0907777888',
    email: 'tuan.driver@xego.vn',
    license: 'B2-790789012',
    idCard: '079789012345',
    area: 'Hà Nội',
    vehicle: { plate: '29A-333.44', brand: 'Toyota', model: 'Camry', color: 'Đen', year: 2023, typeCode: 'premium4' },
    location: { lat: 21.0175, lng: 105.7838 },
    online: 'online',
    rating: 4.9,
    ratingCount: 78,
    trips: 190,
    operator: 1,
  },
  {
    name: 'Ngô Thị Hồng',
    phone: '0908888999',
    email: 'hong.driver@xego.vn',
    license: 'B2-790890123',
    idCard: '079890123456',
    area: 'Đà Nẵng',
    vehicle: { plate: '43A-555.66', brand: 'Toyota', model: 'Innova', color: 'Bạc', year: 2020, typeCode: 'suv7' },
    location: { lat: 16.0614, lng: 108.227 },
    online: 'online',
    rating: 4.7,
    ratingCount: 29,
    trips: 63,
    operator: null,
  },
  {
    name: 'Bùi Văn Khánh',
    phone: '0909999000',
    email: 'khanh.driver@xego.vn',
    license: 'D-790901234',
    idCard: '079901234567',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51B-777.88', brand: 'Thaco', model: 'County', color: 'Trắng', year: 2019, typeCode: 'bus29' },
    location: { lat: 10.8147, lng: 106.7106 },
    online: 'online',
    rating: 4.5,
    ratingCount: 18,
    trips: 44,
    operator: 0,
  },
  {
    name: 'Đặng Quốc Việt',
    phone: '0901234000',
    email: 'viet.driver@xego.vn',
    license: 'B2-790012345',
    idCard: '079012345678',
    area: 'TP. Hồ Chí Minh',
    vehicle: { plate: '51F-444.55', brand: 'Hyundai', model: 'Accent', color: 'Đỏ', year: 2021, typeCode: 'sedan4' },
    location: { lat: 10.754, lng: 106.659 },
    online: 'offline',
    rating: 4.4,
    ratingCount: 12,
    trips: 26,
    operator: null,
    verification: 'pending',
  },
];

const HISTORICAL_TRIPS = [
  {
    customer: 0,
    driver: 0,
    pickup: { label: 'Chợ Bến Thành', address: 'Lê Lợi, Quận 1, TP.HCM', lat: 10.7725, lng: 106.698 },
    dropoff: { label: 'Sân bay Tân Sơn Nhất - Ga Quốc nội', address: 'Trường Sơn, Tân Bình, TP.HCM', lat: 10.8142, lng: 106.6653 },
    distance: 8.4,
    duration: 26,
    price: 168000,
    daysAgo: 1,
    rating: 5,
    review: 'Tài xế đúng giờ, xe sạch sẽ.',
  },
  {
    customer: 1,
    driver: 1,
    pickup: { label: 'Landmark 81', address: '720A Điện Biên Phủ, Bình Thạnh, TP.HCM', lat: 10.7951, lng: 106.7218 },
    dropoff: { label: 'Vincom Center Đồng Khởi', address: '72 Lê Thánh Tôn, Quận 1, TP.HCM', lat: 10.7781, lng: 106.7019 },
    distance: 4.2,
    duration: 18,
    price: 96000,
    daysAgo: 2,
    rating: 4,
    review: 'Chuyến đi ổn.',
  },
  {
    customer: 2,
    driver: 2,
    pickup: { label: 'Bến xe Miền Đông', address: '292 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM', lat: 10.8147, lng: 106.7106 },
    dropoff: { label: 'Đại học Quốc gia TP.HCM', address: 'Linh Trung, Thủ Đức, TP.HCM', lat: 10.87, lng: 106.8031 },
    distance: 18.6,
    duration: 42,
    price: 520000,
    daysAgo: 3,
    rating: 5,
    review: 'Xe 16 chỗ rộng rãi, tài xế thân thiện.',
  },
  {
    customer: 3,
    driver: 3,
    pickup: { label: 'Nhà thờ Đức Bà', address: '01 Công xã Paris, Quận 1, TP.HCM', lat: 10.7797, lng: 106.699 },
    dropoff: { label: 'Crescent Mall Quận 7', address: '101 Tôn Dật Tiên, Quận 7, TP.HCM', lat: 10.729, lng: 106.721 },
    distance: 7.1,
    duration: 24,
    price: 245000,
    daysAgo: 4,
    rating: 5,
    review: 'Xe cao cấp, phục vụ chu đáo.',
  },
  {
    customer: 0,
    driver: 5,
    pickup: { label: 'Hồ Hoàn Kiếm', address: 'Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội', lat: 21.0287, lng: 105.8524 },
    dropoff: { label: 'Sân bay Nội Bài - Ga Quốc nội', address: 'Phú Minh, Sóc Sơn, Hà Nội', lat: 21.2187, lng: 105.8042 },
    distance: 28.4,
    duration: 48,
    price: 780000,
    daysAgo: 6,
    rating: 4,
    review: 'Đường đông nhưng tài xế chạy an toàn.',
  },
  {
    customer: 1,
    driver: 7,
    pickup: { label: 'Sân bay Đà Nẵng', address: 'Nguyễn Văn Linh, Hải Châu, Đà Nẵng', lat: 16.0439, lng: 108.1994 },
    dropoff: { label: 'Phố cổ Hội An', address: 'Minh An, Hội An, Quảng Nam', lat: 15.8801, lng: 108.338 },
    distance: 29.8,
    duration: 52,
    price: 620000,
    daysAgo: 8,
    rating: 5,
    review: 'Rất hài lòng.',
  },
];

const CANCELLED_TRIPS = [
  {
    customer: 2,
    pickup: { label: 'Bệnh viện Chợ Rẫy', address: '201B Nguyễn Chí Thanh, Quận 5, TP.HCM', lat: 10.754, lng: 106.659 },
    dropoff: { label: 'Chợ Lớn - Bình Tây', address: '57 Tháp Mười, Quận 6, TP.HCM', lat: 10.7497, lng: 106.651 },
    reason: 'Khách thay đổi kế hoạch',
    daysAgo: 2,
  },
  {
    customer: 3,
    pickup: { label: 'Phú Mỹ Hưng', address: 'Nguyễn Văn Linh, Quận 7, TP.HCM', lat: 10.73, lng: 106.72 },
    dropoff: { label: 'Suối Tiên', address: '120 Xa lộ Hà Nội, Thủ Đức, TP.HCM', lat: 10.866, lng: 106.803 },
    reason: 'Không tìm được tài xế',
    daysAgo: 5,
  },
];

function insertUser({ role, name, phone, email, password, status = 'active' }) {
  const now = nowIso();
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (role, name, phone, email, password_hash, status, phone_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(role, name, phone, email || null, hash, status, now, now);
  return Number(info.lastInsertRowid);
}

export function seedDatabase() {
  migrate();

  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0) {
    console.log('[seed] Database đã có dữ liệu, bỏ qua seed.');
    return { skipped: true };
  }

  const now = nowIso();

  const insertType = db.prepare(
    `INSERT INTO vehicle_types (code, name, seats, description, icon, base_fare, per_km, per_minute,
       min_fare, hourly_rate, daily_rate, luggage_capacity, tier, sort_order, active, created_at)
     VALUES (@code, @name, @seats, @description, @icon, @base_fare, @per_km, @per_minute,
       @min_fare, @hourly_rate, @daily_rate, @luggage_capacity, @tier, @sort_order, 1, @created_at)`,
  );
  const typeIds = {};
  for (const type of VEHICLE_TYPES) {
    const info = insertType.run({ ...type, created_at: now });
    typeIds[type.code] = Number(info.lastInsertRowid);
  }

  const insertArea = db.prepare(
    `INSERT INTO service_areas (name, province, center_lat, center_lng, radius_km, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );
  for (const area of SERVICE_AREAS) {
    insertArea.run(area.name, area.province, area.center_lat, area.center_lng, area.radius_km, now);
  }

  const insertOperator = db.prepare(
    `INSERT INTO operators (name, phone, email, address, commission_rate, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
  );
  const operatorIds = OPERATORS.map((op) =>
    Number(insertOperator.run(op.name, op.phone, op.email, op.address, op.commission_rate, now).lastInsertRowid),
  );

  const insertPromo = db.prepare(
    `INSERT INTO promo_codes (code, description, type, value, min_order, max_discount, usage_limit,
       used_count, starts_at, ends_at, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 1, ?)`,
  );
  for (const promo of PROMOS) {
    insertPromo.run(
      promo.code,
      promo.description,
      promo.type,
      promo.value,
      promo.min_order,
      promo.max_discount,
      promo.usage_limit,
      new Date(Date.now() + 90 * 86400_000).toISOString(),
      now,
    );
  }

  const adminId = insertUser({
    role: 'admin',
    name: 'Quản trị XeGo',
    phone: '0900000001',
    email: 'admin@xego.vn',
    password: 'admin123',
  });
  insertUser({
    role: 'operator',
    name: 'Điều phối viên',
    phone: '0900000002',
    email: 'operator@xego.vn',
    password: 'operator123',
  });

  const customerIds = CUSTOMERS.map((c) =>
    insertUser({ role: 'customer', name: c.name, phone: c.phone, email: c.email, password: 'customer123' }),
  );

  const insertProfile = db.prepare(
    `INSERT INTO driver_profiles (user_id, operator_id, license_number, license_expiry, id_card_number,
       verification_status, verified_at, verified_by, rating, rating_count, trips_completed, trips_cancelled,
       online_status, current_lat, current_lng, location_updated_at, service_area, bio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertVehicle = db.prepare(
    `INSERT INTO vehicles (driver_id, operator_id, vehicle_type_id, plate, brand, model, color, year, seats,
       status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  );

  const driverIds = [];
  for (const driver of DRIVERS) {
    const userId = insertUser({
      role: 'driver',
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      password: 'driver123',
    });
    driverIds.push(userId);

    const verification = driver.verification || 'approved';
    insertProfile.run(
      userId,
      driver.operator === null ? null : operatorIds[driver.operator],
      driver.license,
      new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10),
      driver.idCard,
      verification,
      verification === 'approved' ? now : null,
      verification === 'approved' ? adminId : null,
      driver.rating,
      driver.ratingCount,
      driver.trips,
      driver.online,
      driver.location.lat,
      driver.location.lng,
      now,
      driver.area,
      `Tài xế ${driver.name}, hoạt động tại ${driver.area}.`,
      now,
      now,
    );

    const type = VEHICLE_TYPES.find((t) => t.code === driver.vehicle.typeCode);
    insertVehicle.run(
      userId,
      driver.operator === null ? null : operatorIds[driver.operator],
      typeIds[driver.vehicle.typeCode],
      driver.vehicle.plate,
      driver.vehicle.brand,
      driver.vehicle.model,
      driver.vehicle.color,
      driver.vehicle.year,
      type.seats,
      now,
      now,
    );
  }

  const insertPlace = db.prepare(
    `INSERT INTO places (user_id, label, address, lat, lng, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  insertPlace.run(customerIds[0], 'Nhà riêng', '208 Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM', 10.794, 106.722, 'home', now);
  insertPlace.run(customerIds[0], 'Công ty', '72 Lê Thánh Tôn, Quận 1, TP.HCM', 10.7781, 106.7019, 'work', now);
  insertPlace.run(customerIds[1], 'Nhà riêng', '101 Tôn Dật Tiên, Quận 7, TP.HCM', 10.729, 106.721, 'home', now);

  const insertTrip = db.prepare(
    `INSERT INTO trips (code, customer_id, driver_id, vehicle_id, vehicle_type_id, operator_id, status,
       service_type, trip_mode, schedule_type, pickup_label, pickup_address, pickup_lat, pickup_lng,
       dropoff_label, dropoff_address, dropoff_lat, dropoff_lng, stops, distance_km, duration_min,
       passengers, luggage, notes, special_requests, payment_method, payment_status, price_breakdown,
       estimated_price, final_price, discount_code, discount_amount, commission_amount, driver_earning,
       share_token, rating, review, created_at, updated_at, accepted_at, arrived_at, started_at, completed_at)
     VALUES (@code, @customer_id, @driver_id, @vehicle_id, @vehicle_type_id, @operator_id, 'completed',
       'ride', 'one_way', 'now', @pickup_label, @pickup_address, @pickup_lat, @pickup_lng,
       @dropoff_label, @dropoff_address, @dropoff_lat, @dropoff_lng, '[]', @distance_km, @duration_min,
       2, 1, NULL, '[]', 'cash', 'paid', @price_breakdown,
       @estimated_price, @final_price, NULL, 0, @commission_amount, @driver_earning,
       @share_token, @rating, @review, @created_at, @updated_at, @accepted_at, @arrived_at, @started_at, @completed_at)`,
  );

  for (const trip of HISTORICAL_TRIPS) {
    const customerId = customerIds[trip.customer];
    const driverId = driverIds[trip.driver];
    const driver = DRIVERS[trip.driver];
    const vehicle = db.prepare('SELECT id FROM vehicles WHERE driver_id = ?').get(driverId);
    const typeId = typeIds[driver.vehicle.typeCode];
    const commission = Math.round(trip.price * config.commissionRate);
    const completedAt = new Date(Date.now() - trip.daysAgo * 86400_000).toISOString();
    const startedAt = new Date(new Date(completedAt).getTime() - trip.duration * 60_000).toISOString();
    const acceptedAt = addMinutes(startedAt, -12);
    const arrivedAt = addMinutes(startedAt, -3);
    const createdAt = addMinutes(acceptedAt, -4);

    const breakdown = {
      items: [
        { code: 'base', label: 'Giá mở cửa', amount: 25000 },
        { code: 'distance', label: `Quãng đường ${trip.distance} km`, amount: trip.price - 25000 },
      ],
      total: trip.price,
      currency: 'VND',
    };

    insertTrip.run({
      code: tripCode(),
      customer_id: customerId,
      driver_id: driverId,
      vehicle_id: vehicle.id,
      vehicle_type_id: typeId,
      operator_id: driver.operator === null ? null : operatorIds[driver.operator],
      pickup_label: trip.pickup.label,
      pickup_address: trip.pickup.address,
      pickup_lat: trip.pickup.lat,
      pickup_lng: trip.pickup.lng,
      dropoff_label: trip.dropoff.label,
      dropoff_address: trip.dropoff.address,
      dropoff_lat: trip.dropoff.lat,
      dropoff_lng: trip.dropoff.lng,
      distance_km: trip.distance,
      duration_min: trip.duration,
      price_breakdown: JSON.stringify(breakdown),
      estimated_price: trip.price,
      final_price: trip.price,
      commission_amount: commission,
      driver_earning: trip.price - commission,
      share_token: shareToken(),
      rating: trip.rating,
      review: trip.review,
      created_at: createdAt,
      updated_at: completedAt,
      accepted_at: acceptedAt,
      arrived_at: arrivedAt,
      started_at: startedAt,
      completed_at: completedAt,
    });
  }

  const insertCancelled = db.prepare(
    `INSERT INTO trips (code, customer_id, vehicle_type_id, status, service_type, trip_mode, schedule_type,
       pickup_label, pickup_address, pickup_lat, pickup_lng, dropoff_label, dropoff_address, dropoff_lat,
       dropoff_lng, stops, distance_km, duration_min, passengers, luggage, special_requests, payment_method,
       price_breakdown, estimated_price, share_token, cancel_reason, cancelled_by, created_at, updated_at, cancelled_at)
     VALUES (?, ?, ?, 'cancelled', 'ride', 'one_way', 'now', ?, ?, ?, ?, ?, ?, ?, ?, '[]', 6.2, 22, 1, 0, '[]',
       'cash', '{}', 95000, ?, ?, 'customer', ?, ?, ?)`,
  );
  for (const trip of CANCELLED_TRIPS) {
    const createdAt = new Date(Date.now() - trip.daysAgo * 86400_000).toISOString();
    insertCancelled.run(
      tripCode(),
      customerIds[trip.customer],
      typeIds.sedan4,
      trip.pickup.label,
      trip.pickup.address,
      trip.pickup.lat,
      trip.pickup.lng,
      trip.dropoff.label,
      trip.dropoff.address,
      trip.dropoff.lat,
      trip.dropoff.lng,
      shareToken(),
      trip.reason,
      createdAt,
      createdAt,
      createdAt,
    );
  }

  const insertTicket = db.prepare(
    `INSERT INTO support_tickets (code, user_id, trip_id, category, subject, description, status, priority, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertTicket.run(
    'HT-DEMO001',
    customerIds[1],
    'lost_item',
    'Để quên túi xách trên xe',
    'Tôi để quên túi xách màu đen trên xe vào tối qua. Mong được hỗ trợ liên hệ tài xế.',
    'in_progress',
    'high',
    now,
    now,
  );
  insertTicket.run(
    'HT-DEMO002',
    customerIds[2],
    'payment',
    'Hỏi về hóa đơn chuyến đi',
    'Tôi cần hóa đơn VAT cho chuyến đi tuần trước.',
    'open',
    'normal',
    now,
    now,
  );

  const insertNotification = db.prepare(
    `INSERT INTO notifications (user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, '{}', ?)`,
  );
  insertNotification.run(
    customerIds[0],
    'welcome',
    'Chào mừng đến với XeGo',
    'Đặt chuyến đầu tiên và nhận ưu đãi 20% với mã XEGO20.',
    now,
  );

  const insertSetting = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
  );
  insertSetting.run('commissionRate', JSON.stringify(config.commissionRate), now);
  insertSetting.run('supportPhone', JSON.stringify('1900 6868'), now);
  insertSetting.run('supportEmail', JSON.stringify('hotro@xego.vn'), now);
  insertSetting.run('companyName', JSON.stringify('XeGo Việt Nam'), now);

  console.log('[seed] Đã tạo dữ liệu demo:');
  console.log('  Admin     : 0900000001 / admin123');
  console.log('  Điều phối : 0900000002 / operator123');
  console.log('  Khách     : 0901234567 / customer123');
  console.log('  Tài xế    : 0901111222 / driver123');

  return { skipped: false };
}
