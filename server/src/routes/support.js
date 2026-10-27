import { Router } from 'express';
import { db } from '../db.js';
import { asyncHandler, badRequest, notFound, nowIso, ticketCode } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { notify, notifyAdmins } from '../services/notifications.js';

export const supportRouter = Router();
supportRouter.use(requireAuth);

export const SUPPORT_CATEGORIES = [
  { code: 'trip_issue', label: 'Vấn đề về chuyến đi' },
  { code: 'payment', label: 'Thanh toán / hoàn tiền' },
  { code: 'lost_item', label: 'Đồ thất lạc' },
  { code: 'driver_behavior', label: 'Thái độ tài xế' },
  { code: 'safety', label: 'An toàn chuyến đi' },
  { code: 'account', label: 'Tài khoản' },
  { code: 'other', label: 'Khác' },
];

export const FAQ = [
  {
    id: 'cancel',
    question: 'Tôi có thể hủy chuyến không?',
    answer:
      'Bạn có thể hủy trước khi chuyến bắt đầu. Nếu tài xế đã tới điểm đón, phí hủy có thể được áp dụng theo chính sách.',
  },
  {
    id: 'price',
    question: 'Giá hiển thị có phải giá cuối cùng?',
    answer:
      'Giá hiển thị là giá ước tính dựa trên lộ trình dự kiến. Giá cuối cùng có thể thay đổi nếu bạn thay đổi điểm đến, thêm điểm dừng hoặc thời gian chờ.',
  },
  {
    id: 'payment',
    question: 'Những phương thức thanh toán nào được hỗ trợ?',
    answer:
      'XeGo hỗ trợ tiền mặt, chuyển khoản ngân hàng và thanh toán trực tuyến (khi cổng thanh toán được cấu hình).',
  },
  {
    id: 'driver-late',
    question: 'Tài xế đến muộn thì sao?',
    answer:
      'Bạn có thể liên hệ tài xế qua ứng dụng. Nếu chờ quá lâu, hãy hủy chuyến và đặt lại, hoặc gửi yêu cầu hỗ trợ.',
  },
  {
    id: 'lost',
    question: 'Tôi để quên đồ trên xe thì làm thế nào?',
    answer:
      'Hãy tạo yêu cầu hỗ trợ loại "Đồ thất lạc" kèm mã chuyến. Bộ phận hỗ trợ sẽ liên hệ tài xế để xác minh.',
  },
  {
    id: 'safety',
    question: 'Làm sao để chia sẻ hành trình với người thân?',
    answer:
      'Trong màn hình theo dõi chuyến, chọn "Chia sẻ chuyến đi" để lấy liên kết công khai (chỉ đọc) gửi cho người thân.',
  },
];

supportRouter.get(
  '/faq',
  asyncHandler(async (req, res) => {
    res.json({ faq: FAQ, categories: SUPPORT_CATEGORIES });
  }),
);

supportRouter.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT s.*, t.code AS trip_code FROM support_tickets s
         LEFT JOIN trips t ON t.id = s.trip_id
         WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 50`,
      )
      .all(req.user.id);
    res.json({
      tickets: rows.map((row) => ({
        id: row.id,
        code: row.code,
        tripId: row.trip_id,
        tripCode: row.trip_code,
        category: row.category,
        subject: row.subject,
        description: row.description,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }),
);

supportRouter.post(
  '/tickets',
  asyncHandler(async (req, res) => {
    const { category, subject, description, tripId = null, priority = 'normal' } = req.body || {};
    if (!category || !subject || !description) {
      throw badRequest('Vui lòng nhập đầy đủ loại yêu cầu, tiêu đề và mô tả');
    }
    if (!SUPPORT_CATEGORIES.some((c) => c.code === category)) {
      throw badRequest('Loại yêu cầu không hợp lệ');
    }
    if (tripId) {
      const trip = db.prepare('SELECT id FROM trips WHERE id = ? AND customer_id = ?').get(
        Number(tripId),
        req.user.id,
      );
      if (!trip) throw badRequest('Chuyến đi không hợp lệ');
    }

    const now = nowIso();
    const code = ticketCode();
    const info = db
      .prepare(
        `INSERT INTO support_tickets (code, user_id, trip_id, category, subject, description, status, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      )
      .run(
        code,
        req.user.id,
        tripId ? Number(tripId) : null,
        category,
        subject,
        description,
        ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
        now,
        now,
      );

    const ticketId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_role, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ticketId, req.user.id, req.user.role, description, now);

    notifyAdmins({
      type: 'support',
      title: 'Yêu cầu hỗ trợ mới',
      body: `${code}: ${subject}`,
      data: { ticketId },
    });

    res.status(201).json({ ticket: { id: ticketId, code, status: 'open' } });
  }),
);

supportRouter.get(
  '/tickets/:id',
  asyncHandler(async (req, res) => {
    const ticket = db
      .prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id);
    if (!ticket) throw notFound('Yêu cầu hỗ trợ không tồn tại');

    const messages = db
      .prepare('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY id')
      .all(ticket.id)
      .map((m) => ({
        id: m.id,
        senderRole: m.sender_role,
        body: m.body,
        createdAt: m.created_at,
      }));

    res.json({
      ticket: {
        id: ticket.id,
        code: ticket.code,
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.created_at,
      },
      messages,
    });
  }),
);

supportRouter.post(
  '/tickets/:id/messages',
  asyncHandler(async (req, res) => {
    const ticket = db
      .prepare('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?')
      .get(Number(req.params.id), req.user.id);
    if (!ticket) throw notFound('Yêu cầu hỗ trợ không tồn tại');
    const body = String(req.body?.body || '').trim();
    if (!body) throw badRequest('Nội dung trống');

    const now = nowIso();
    db.prepare(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_role, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(ticket.id, req.user.id, req.user.role, body, now);
    db.prepare('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?').run(
      'open',
      now,
      ticket.id,
    );

    notifyAdmins({
      type: 'support',
      title: 'Phản hồi mới từ khách',
      body: `${ticket.code}: ${body.slice(0, 100)}`,
      data: { ticketId: ticket.id },
    });

    res.status(201).json({ ok: true });
  }),
);

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { listNotifications, unreadCount } = await import('../services/notifications.js');
    const limit = Math.min(100, Number(req.query.limit) || 30);
    res.json({
      notifications: listNotifications(req.user.id, {
        limit,
        unreadOnly: req.query.unread === '1',
      }),
      unread: unreadCount(req.user.id),
    });
  }),
);

notificationsRouter.post(
  '/read',
  asyncHandler(async (req, res) => {
    const { markRead, unreadCount } = await import('../services/notifications.js');
    markRead(req.user.id, req.body?.ids || null);
    res.json({ unread: unreadCount(req.user.id) });
  }),
);

export { notify };
