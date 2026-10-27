# Tích hợp bên ngoài và phạm vi mô phỏng

Tài liệu này liệt kê **chính xác** những gì XeGo đang gọi ra dịch vụ bên ngoài, những gì đang chạy ở chế độ mô phỏng, và cần bổ sung gì để vận hành thương mại.

Nguyên tắc: không giả vờ rằng một giao dịch hay một tín hiệu GPS đã hoạt động thật khi chưa có tích hợp. Mọi chỗ mô phỏng đều được đánh dấu rõ trong API response và trên giao diện.

## Bảng tổng hợp

| Hạng mục | Trạng thái hiện tại | Cần gì để chạy thật |
|---|---|---|
| Bản đồ nền | ✅ Hoạt động thật — tile OpenStreetMap | Nhà cung cấp tile riêng khi lưu lượng lớn |
| Tìm địa chỉ (geocoding) | ✅ Hoạt động thật — Nominatim, có fallback nội bộ | Tài khoản Nominatim/Mapbox/Google riêng |
| Tính tuyến đường (routing) | ✅ Hoạt động thật — OSRM, có fallback ước lượng | OSRM self-host hoặc dịch vụ trả phí |
| Định vị GPS trình duyệt | ✅ Hoạt động thật — Geolocation API | Không cần thêm |
| Realtime | ✅ Hoạt động thật — Socket.IO | Redis adapter nếu chạy nhiều tiến trình |
| Thông báo trong ứng dụng | ✅ Hoạt động thật — lưu DB + Socket.IO | Không cần thêm |
| Thanh toán trực tuyến | ⚠️ **Mô phỏng** — ghi nhận, không trừ tiền | Hợp đồng VNPay / MoMo / ZaloPay |
| SMS / OTP | ⚠️ **Mô phỏng** — OTP in ra log server | Nhà cung cấp SMS + brandname đã đăng ký |
| Push notification | ⚠️ **Chưa có** — chỉ thông báo trong app | FCM / APNs / Web Push VAPID |
| Email giao dịch | ⚠️ **Chưa có** | SMTP hoặc SendGrid / Mailgun |
| Xác thực giấy tờ tài xế | ⚠️ **Thủ công** — admin duyệt bằng mắt | Dịch vụ OCR/eKYC nếu muốn tự động |
| Bản đồ nhiệt nhu cầu | ⚠️ **Chưa có** | Cần dữ liệu lịch sử đủ lớn |

---

## 1. Bản đồ, địa chỉ và tuyến đường

### Cấu hình

```env
GEOCODER_URL=https://nominatim.openstreetmap.org
ROUTER_URL=https://router.project-osrm.org
GEO_USER_AGENT=XeGo/1.0 (lien-he@xego.vn)
GEO_TIMEOUT_MS=4500
```

`GEO_USER_AGENT` là **bắt buộc** khi gọi Nominatim — dịch vụ này chặn request không khai báo User-Agent. Hãy thay bằng email liên hệ thật của bạn.

### Những gì đang chạy thật

- **Tìm địa chỉ** — `GET /api/places/search?q=...` gọi Nominatim với `countrycodes=vn` và `accept-language=vi`, trả về tối đa 8 kết quả. Khi có toạ độ người dùng, request gửi kèm `viewbox` để ưu tiên kết quả gần.
- **Đảo ngược toạ độ** — `GET /api/places/reverse?lat=&lng=` gọi Nominatim reverse ở mức zoom 18.
- **Tính tuyến** — `POST /api/route` gọi OSRM `route/v1/driving` với `overview=full&geometries=geojson`, trả về quãng đường, thời gian và hình học tuyến để vẽ lên bản đồ.
- **Bản đồ nền** — Leaflet tải tile trực tiếp từ OpenStreetMap.

Mọi kết quả được cache trong bộ nhớ **10 phút**, tối đa 500 mục, để giảm số lần gọi dịch vụ ngoài.

### Fallback khi mất mạng hoặc bị giới hạn tần suất

Nếu Nominatim hoặc OSRM lỗi, timeout (4,5 giây) hoặc trả về rỗng, hệ thống **không** báo lỗi cho người dùng mà chuyển sang phương án dự phòng và đánh dấu rõ:

| Trường hợp | Fallback | Cờ trả về |
|---|---|---|
| Tìm địa chỉ thất bại | Tìm trong `server/src/data/places-vn.js` (địa điểm Việt Nam phổ biến) | `source: 'local'`, `simulated: true` |
| Đảo ngược toạ độ thất bại | Ghép với địa điểm nội bộ gần nhất | `source: 'local'`, `simulated: true` |
| Tính tuyến thất bại | Khoảng cách chim bay × 1,35, tốc độ 26 km/h | `source: 'estimate'`, `simulated: true` |

Giao diện hiển thị nhãn "ước tính" khi nhận được `simulated: true`, để người dùng biết con số không đến từ dịch vụ định tuyến thật.

### Chuyển sang nhà cung cấp riêng

**Nominatim tự host** (khuyến nghị nếu lưu lượng > 1 request/giây):

```bash
docker run -d -p 8080:8080 \
  -v /data/nominatim:/var/lib/postgresql/14/main \
  mediagis/nominatim:4.4
```

```env
GEOCODER_URL=http://localhost:8080
```

**OSRM tự host**:

```bash
docker run -d -p 5000:5000 \
  -v /data/osrm:/data osrm/osrm-backend \
  osrm-routed --algorithm mld /data/vietnam-latest.osrm
```

```env
ROUTER_URL=http://localhost:5000
```

**Mapbox / Google Maps** cần viết lại `server/src/services/geo.js` vì định dạng response khác. Phần cần sửa là ba hàm `searchPlaces`, `reverseGeocode`, `routeThrough` — toàn bộ phần còn lại của hệ thống chỉ làm việc với cấu trúc `{ name, address, lat, lng }` và `{ distanceKm, durationMin, geometry }`.

**Tile bản đồ** — sửa `url` của `L.tileLayer` trong `web/src/components/MapView.jsx`. Với Mapbox:

```js
L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${TOKEN}`, {
  attribution: '© Mapbox © OpenStreetMap',
  maxZoom: 19,
});
```

---

## 2. Thanh toán

### Trạng thái hiện tại: MÔ PHỎNG

```env
PAYMENT_PROVIDER=demo
```

Khi `PAYMENT_PROVIDER=demo`:

- `POST /api/trips/:id/pay` **ghi nhận** thanh toán vào bảng `payments` với `provider = 'demo'` và `provider_ref = 'DEMO-<timestamp>'`.
- Response trả về `simulated: true`.
- Thông báo gửi cho khách có hậu tố "(mô phỏng)".
- **Không có bất kỳ giao dịch tiền thật nào xảy ra.** Không kết nối cổng thanh toán nào.

Thanh toán tiền mặt (`payment_method = 'cash'`) được xử lý thật trong luồng nghiệp vụ: khi tài xế hoàn thành chuyến, `payment_status` chuyển thành `paid` vì tiền đã trao tay. Đây là ghi nhận nội bộ, không phải giao dịch điện tử.

### Kiến trúc tích hợp đã chuẩn bị

Bảng `payments` đã có đủ cột cho một cổng thanh toán thật:

| Cột | Mục đích |
|---|---|
| `provider` | Tên cổng: `vnpay`, `momo`, `zalopay` |
| `provider_ref` | Mã giao dịch phía cổng, dùng để đối soát |
| `status` | `pending`, `paid`, `failed`, `refunded` |
| `paid_at` | Thời điểm cổng xác nhận |
| `meta` | JSON chứa toàn bộ payload của cổng |

### Các bước tích hợp VNPay

1. **Đăng ký merchant** tại <https://vnpay.vn>, nhận `vnp_TmnCode` và `vnp_HashSecret`.

2. **Cấu hình**:

```env
PAYMENT_PROVIDER=vnpay
PAYMENT_MERCHANT_ID=<vnp_TmnCode>
PAYMENT_SECRET_KEY=<vnp_HashSecret>
PAYMENT_RETURN_URL=https://xego.example.com/api/payments/vnpay/return
```

3. **Thêm route tạo URL thanh toán** trong `server/src/routes/trips.js`, thay nhánh `isDemo`:

```js
import crypto from 'node:crypto';

function vnpayUrl({ amount, orderId, ipAddr }) {
  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.payment.merchantId,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `Thanh toan chuyen ${orderId}`,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100,          // VNPay dùng đơn vị đồng × 100
    vnp_ReturnUrl: config.payment.returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: new Date().toISOString().replace(/\D/g, '').slice(0, 14),
  };
  const sorted = Object.keys(params).sort();
  const signData = sorted.map((k) => `${k}=${params[k]}`).join('&');
  const secureHash = crypto
    .createHmac('sha512', config.payment.secretKey)
    .update(Buffer.from(signData, 'utf8'))
    .digest('hex');
  return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${signData}&vnp_SecureHash=${secureHash}`;
}
```

4. **Thêm route nhận callback** — phải xác thực chữ ký trước khi tin bất kỳ dữ liệu nào:

```js
app.get('/api/payments/vnpay/return', (req, res) => {
  const { vnp_SecureHash, ...rest } = req.query;
  const signData = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join('&');
  const expected = crypto
    .createHmac('sha512', config.payment.secretKey)
    .update(Buffer.from(signData, 'utf8'))
    .digest('hex');

  if (expected !== vnp_SecureHash) return res.status(400).send('Chữ ký không hợp lệ');
  if (rest.vnp_ResponseCode !== '00') return res.redirect('/thanh-toan/that-bai');

  // Cập nhật payments + trips.payment_status trong một transaction
  res.redirect(`/chuyen/${rest.vnp_TxnRef}?paid=1`);
});
```

5. **Đối soát** — VNPay có API truy vấn giao dịch. Nên chạy cron hằng ngày so sánh `payments.provider_ref` với danh sách giao dịch phía cổng.

### MoMo và ZaloPay

Cùng nguyên tắc: tạo URL có chữ ký HMAC, nhận callback, xác thực chữ ký, cập nhật DB trong transaction. Khác biệt chỉ ở tên tham số và thuật toán ký (MoMo dùng HMAC-SHA256, ZaloPay dùng HMAC-SHA256 với `mac`).

### Hoàn tiền

`POST /api/admin/payments/:id/refund` hiện chỉ đổi `status` thành `refunded` trong DB. Khi tích hợp thật, cần gọi API hoàn tiền của cổng và lưu mã hoàn tiền vào `provider_ref`.

---

## 3. SMS và OTP

### Trạng thái hiện tại: MÔ PHỎNG

```env
SMS_PROVIDER=demo
```

Khi ở chế độ demo, `POST /api/auth/otp/request` sinh mã 6 số, lưu vào bảng `otp_codes` với hạn 5 phút, và **in ra log server**:

```
[OTP DEMO] 0901234567 -> 482913 (hết hạn sau 5 phút)
```

Không có tin nhắn nào được gửi. Trên giao diện, người dùng thấy thông báo rằng mã đã được gửi, nhưng thực tế phải xem log server để lấy mã.

Cơ chế lưu trữ và xác thực OTP **hoạt động thật**: mã có hạn, chỉ dùng một lần (`consumed_at`), có giới hạn tần suất gọi.

### Tích hợp nhà cung cấp SMS Việt Nam

Các nhà cung cấp phổ biến: Twilio, Vonage, Viettel SMS Brandname, VNPT, Stringee.

Ví dụ với Twilio:

```bash
npm install twilio
```

```env
SMS_PROVIDER=twilio
SMS_API_KEY=<account_sid>:<auth_token>
SMS_BRANDNAME=XeGo
```

Sửa `issueOtp` trong `server/src/routes/auth.js`:

```js
import twilio from 'twilio';

async function sendSms(phone, text) {
  if (isDemoSms()) {
    console.log(`[OTP DEMO] ${phone} -> ${text}`);
    return;
  }
  const [sid, token] = config.sms.apiKey.split(':');
  const client = twilio(sid, token);
  await client.messages.create({
    body: text,
    from: config.sms.brandname,
    to: `+84${phone.slice(1)}`,   // 0901234567 -> +84901234567
  });
}
```

Với nhà cung cấp trong nước, brandname phải đăng ký trước với Bộ Thông tin và Truyền thông; tin nhắn OTP thường phải dùng brandname riêng, không dùng brandname quảng cáo.

**Lưu ý bảo mật:** mã OTP là yếu tố xác thực. Không bao giờ trả mã trong response API ở môi trường production, kể cả khi tiện cho việc test.

---

## 4. Push notification

### Trạng thái hiện tại: CHƯA CÓ

Thông báo **trong ứng dụng** hoạt động thật: mỗi thông báo được lưu vào bảng `notifications` và đẩy tới trình duyệt đang mở qua Socket.IO (sự kiện `notification`). Người dùng thấy chuông thông báo, số chưa đọc, và danh sách thông báo.

Khi tab trình duyệt đóng, **không có thông báo nào được gửi đi**. Tài xế không nhận được cảnh báo có cuốc mới nếu không mở ứng dụng.

### Bổ sung Web Push

```bash
npm install web-push
npx web-push generate-vapid-keys
```

```env
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:hotro@xego.vn
```

Cần thêm:

1. Bảng `push_subscriptions (user_id, endpoint, p256dh, auth, created_at)`.
2. Endpoint `POST /api/notifications/subscribe` nhận subscription từ `PushManager.subscribe()`.
3. Service worker ở `web/public/sw.js` lắng nghe sự kiện `push` và hiển thị notification.
4. Trong `notify()` của `server/src/services/notifications.js`, sau khi emit Socket.IO, gọi `webpush.sendNotification()` cho mọi subscription của người dùng. Xoá subscription khi nhận mã lỗi 404 hoặc 410.

### Bổ sung FCM cho ứng dụng di động

Nếu sau này có app React Native hoặc Flutter, dùng Firebase Cloud Messaging: lưu device token vào bảng riêng, gọi FCM HTTP v1 API từ `notify()`.

---

## 5. Email giao dịch

### Trạng thái hiện tại: CHƯA CÓ

Hệ thống không gửi email. Trường `users.email` được lưu nhưng chỉ dùng để hiển thị và liên hệ thủ công.

### Bổ sung

```bash
npm install nodemailer
```

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=hotro@xego.vn
SMTP_PASS=<app-password>
```

Các email nên gửi: xác nhận đặt chuyến, biên nhận sau khi hoàn thành, thông báo hoàn tiền, nhắc lịch chuyến đặt trước.

---

## 6. Xác minh giấy tờ tài xế

### Trạng thái hiện tại: THỦ CÔNG

Tài xế đăng ký với `verification_status = 'pending'`. Admin vào `/quan-tri/tai-xe`, xem thông tin (số GPLX, số CCCD, hạn bằng lái, thông tin xe) và bấm duyệt hoặc từ chối. Thao tác được ghi vào `audit_logs`.

Tài xế chưa được duyệt **không thể** bật online và **không nhận được** offer — điều này được kiểm tra ở tầng service, không chỉ ở giao diện.

### Bổ sung eKYC tự động

Các dịch vụ tại Việt Nam: VNPT eKYC, Viettel eKYC, FPT.AI, CMC eKYC.

Luồng điển hình:

1. Tài xế tải ảnh CCCD hai mặt và ảnh GPLX.
2. Gọi API eKYC để OCR, kiểm tra thật/giả, so khớp khuôn mặt.
3. Lưu kết quả vào `driver_profiles` (thêm cột `ekyc_result` JSON).
4. Nếu điểm tin cậy cao → tự động duyệt; nếu thấp → chuyển admin duyệt thủ công.

Hiện chưa có bảng lưu file ảnh. Cần thêm storage (S3, Cloudflare R2, hoặc thư mục local) và bảng `driver_documents`.

---

## 7. Những gì KHÔNG mô phỏng

Để tránh hiểu nhầm, đây là danh sách những phần **hoạt động thật**, không phải giả lập:

- **Cơ sở dữ liệu** — SQLite ghi xuống đĩa, dữ liệu tồn tại qua lần khởi động lại.
- **Xác thực** — JWT ký bằng HMAC-SHA256, mật khẩu băm bcrypt 10 vòng.
- **Ghép chuyến** — thuật toán thật với bán kính, lọc điều kiện, offer có hạn, scheduler chạy nền.
- **Máy trạng thái chuyến** — mọi chuyển trạng thái được kiểm tra hợp lệ và ghi vào `trip_events`.
- **Tính giá** — công thức thật với surge theo giờ, khuyến mãi, hoa hồng, giá tối thiểu.
- **Realtime** — WebSocket thật, trạng thái đồng bộ giữa các thiết bị trong vài trăm mili giây.
- **Định vị GPS** — lấy từ Geolocation API của trình duyệt, là toạ độ thật của thiết bị.
- **Tìm địa chỉ và tuyến đường** — gọi dịch vụ thật (Nominatim, OSRM) khi có mạng.
- **Phân quyền** — kiểm tra ở middleware, không thể vượt qua bằng cách sửa giao diện.
- **Audit log** — ghi lại thao tác quản trị, không thể sửa từ giao diện.

---

## 8. Kiểm tra trạng thái tích hợp

`GET /api/public/config` trả về trạng thái hiện tại của từng tích hợp:

```json
{
  "appName": "XeGo",
  "version": "1.0.0",
  "commissionRate": 0.2,
  "integrations": {
    "maps": {
      "provider": "OpenStreetMap (Nominatim + OSRM)",
      "mode": "live",
      "configured": true,
      "note": "Dùng dịch vụ công khai miễn phí..."
    },
    "payments": {
      "provider": "demo",
      "mode": "demo",
      "demo": true,
      "configured": false,
      "note": "Chế độ mô phỏng: thanh toán online được ghi nhận nhưng KHÔNG trừ tiền thật."
    },
    "sms": {
      "provider": "demo",
      "mode": "demo",
      "demo": true,
      "configured": false,
      "note": "Chế độ mô phỏng: mã OTP được in ra log server, không gửi SMS thật."
    },
    "push": {
      "provider": "web (in-app)",
      "mode": "live",
      "configured": true,
      "note": "Thông báo trong ứng dụng hoạt động thật qua Socket.IO..."
    }
  }
}
```

Trường `mode` nhận một trong hai giá trị `live` hoặc `demo`. Giao diện dùng trường này để hiển thị nhãn "trực tuyến" hay "mô phỏng" trên trang đặt xe.

Dùng endpoint này trong trang cài đặt admin hoặc trong script kiểm tra sức khoẻ triển khai để biết môi trường đã sẵn sàng vận hành thật hay chưa.

---

## 9. Danh sách kiểm tra trước khi vận hành thương mại

- [ ] Đổi `JWT_SECRET` thành chuỗi ngẫu nhiên ≥ 32 byte, lưu trong secret manager
- [ ] Ký hợp đồng cổng thanh toán, đặt `PAYMENT_PROVIDER` khác `demo`
- [ ] Đăng ký brandname SMS, đặt `SMS_PROVIDER` khác `demo`
- [ ] Cấu hình `GEO_USER_AGENT` với email liên hệ thật
- [ ] Tự host Nominatim và OSRM hoặc mua gói dịch vụ bản đồ
- [ ] Bổ sung push notification (VAPID hoặc FCM)
- [ ] Bổ sung email giao dịch
- [ ] Bật HTTPS và cấu hình proxy cho WebSocket
- [ ] Thiết lập sao lưu định kỳ cho `server/data`
- [ ] Thêm giám sát lỗi (Sentry) và log tập trung
- [ ] Xem xét chuyển sang PostgreSQL nếu lưu lượng tăng
- [ ] Rà soát chính sách bảo mật dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP
- [ ] Kiểm thử tải với số tài xế và chuyến đồng thời mục tiêu
