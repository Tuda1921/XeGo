import React, { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { Alert, Badge, EmptyState, Field, Modal, SectionTitle, Tabs } from '../components/ui';
import { support as supportApi, trips as tripsApi } from '../lib/api';
import { useToast } from '../lib/context';
import { SUPPORT_CATEGORY_LABELS, TICKET_STATUS, formatDateTime, formatTime } from '../lib/format';

export default function Support() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState('faq');
  const [faq, setFaq] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ category: 'trip_issue', subject: '', description: '', tripId: '' });
  const [myTrips, setMyTrips] = useState([]);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');

  const loadTickets = async () => {
    try {
      const data = await supportApi.tickets();
      setTickets(data.tickets || []);
    } catch {
      setTickets([]);
    }
  };

  useEffect(() => {
    supportApi
      .faq()
      .then((data) => {
        setFaq(data.faq || []);
        setCategories(data.categories || []);
      })
      .catch(() => {});
    loadTickets();
    tripsApi.list({ limit: 20 }).then((d) => setMyTrips(d.trips || [])).catch(() => {});
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      await supportApi.createTicket({
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        tripId: form.tripId ? Number(form.tripId) : null,
      });
      success('Đã gửi yêu cầu hỗ trợ');
      setCreateOpen(false);
      setForm({ category: 'trip_issue', subject: '', description: '', tripId: '' });
      loadTickets();
      setTab('tickets');
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openTicket = async (id) => {
    try {
      const data = await supportApi.ticket(id);
      setDetail(data);
    } catch (err) {
      toastError(err.message);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !detail) return;
    try {
      await supportApi.reply(detail.ticket.id, reply.trim());
      setReply('');
      openTicket(detail.ticket.id);
      loadTickets();
    } catch (err) {
      toastError(err.message);
    }
  };

  return (
    <div className="page page--narrow">
      <SectionTitle
        title="Trung tâm hỗ trợ"
        subtitle="Câu hỏi thường gặp và yêu cầu hỗ trợ trực tiếp."
        action={
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={15} />
            Gửi yêu cầu
          </button>
        }
      />

      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <Tabs
          items={[
            { value: 'faq', label: 'Câu hỏi thường gặp' },
            { value: 'tickets', label: 'Yêu cầu của tôi', count: tickets.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'faq' ? (
        <div className="stack">
          {faq.map((item) => (
            <div key={item.id} className="card card--flush">
              <button
                type="button"
                className="list-item list-item--button"
                onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
                style={{ padding: 'var(--sp-4)' }}
              >
                <span className="grow text-sm strong">{item.question}</span>
                <Icon name={openFaq === item.id ? 'chevronDown' : 'chevronRight'} size={16} />
              </button>
              {openFaq === item.id && (
                <div className="text-sm muted" style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>
                  {item.answer}
                </div>
              )}
            </div>
          ))}

          <div className="card card--soft stack-sm">
            <strong className="text-sm">Vẫn cần hỗ trợ?</strong>
            <span className="text-sm muted">
              Gửi yêu cầu kèm mã chuyến để bộ phận hỗ trợ kiểm tra nhanh hơn. Thời gian phản hồi trung bình trong giờ làm
              việc là 30 phút.
            </span>
            <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)} style={{ alignSelf: 'flex-start' }}>
              <Icon name="headset" size={16} />
              Tạo yêu cầu hỗ trợ
            </button>
          </div>
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="headset"
          title="Chưa có yêu cầu hỗ trợ"
          description="Khi cần trợ giúp về chuyến đi, thanh toán hoặc đồ thất lạc, hãy tạo yêu cầu."
          action={
            <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
              Tạo yêu cầu
            </button>
          }
        />
      ) : (
        <div className="stack">
          {tickets.map((ticket) => {
            const meta = TICKET_STATUS[ticket.status] || { label: ticket.status, tone: 'default' };
            return (
              <button
                key={ticket.id}
                type="button"
                className="card stack-sm"
                onClick={() => openTicket(ticket.id)}
                style={{ textAlign: 'left' }}
              >
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <Badge tone="default">{ticket.code}</Badge>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <span className="text-xs muted">{formatDateTime(ticket.createdAt)}</span>
                </div>
                <strong className="text-sm">{ticket.subject}</strong>
                <span className="text-xs muted clamp-2">{ticket.description}</span>
                <span className="text-xs subtle">
                  {SUPPORT_CATEGORY_LABELS[ticket.category] || ticket.category}
                  {ticket.tripCode ? ` · Chuyến ${ticket.tripCode}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Gửi yêu cầu hỗ trợ"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCreateOpen(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submit}
              disabled={busy || !form.subject.trim() || !form.description.trim()}
            >
              {busy ? <span className="spinner" /> : 'Gửi yêu cầu'}
            </button>
          </>
        }
      >
        <div className="stack">
          <Field label="Loại yêu cầu">
            <select className="select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chuyến liên quan (không bắt buộc)">
            <select className="select" value={form.tripId} onChange={(e) => setForm((p) => ({ ...p, tripId: e.target.value }))}>
              <option value="">Không chọn</option>
              {myTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.code} · {trip.pickup.label} → {trip.dropoff.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tiêu đề" htmlFor="ticket-subject">
            <input
              id="ticket-subject"
              className="input"
              placeholder="Tóm tắt vấn đề"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              maxLength={120}
            />
          </Field>
          <Field label="Mô tả chi tiết" htmlFor="ticket-desc">
            <textarea
              id="ticket-desc"
              className="textarea"
              placeholder="Mô tả càng chi tiết càng giúp xử lý nhanh hơn…"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              maxLength={2000}
            />
          </Field>
        </div>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.ticket?.subject || 'Yêu cầu hỗ trợ'} wide>
        {detail && (
          <div className="stack">
            <div className="row-between">
              <div className="row" style={{ gap: 8 }}>
                <Badge tone="default">{detail.ticket.code}</Badge>
                <Badge tone={(TICKET_STATUS[detail.ticket.status] || {}).tone || 'default'}>
                  {(TICKET_STATUS[detail.ticket.status] || {}).label || detail.ticket.status}
                </Badge>
              </div>
              <span className="text-xs muted">{formatDateTime(detail.ticket.createdAt)}</span>
            </div>

            <Alert tone="info">{SUPPORT_CATEGORY_LABELS[detail.ticket.category] || detail.ticket.category}</Alert>

            <div className="chat-box" style={{ maxHeight: 300 }}>
              {detail.messages.map((message) => {
                const mine = message.senderRole === 'customer';
                return (
                  <div key={message.id} className={`chat-msg ${mine ? 'chat-msg--mine' : ''}`}>
                    <div>{message.body}</div>
                    <div className="chat-msg__meta">
                      {mine ? 'Bạn' : 'Hỗ trợ XeGo'} · {formatTime(message.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="row">
              <input
                className="input grow"
                placeholder="Nhập phản hồi…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
              />
              <button type="button" className="btn btn--primary" onClick={sendReply} disabled={!reply.trim()}>
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
