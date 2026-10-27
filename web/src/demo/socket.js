/**
 * Socket.IO giả lập cho bản demo tĩnh.
 *
 * Không có server nên mọi sự kiện được phát nội bộ trong tab hiện tại.
 * API bề mặt giống `socket.io-client` để các trang không cần sửa.
 */

const listeners = new Map();

function addListener(event, handler) {
  if (typeof handler !== 'function') return;
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
}

function removeListener(event, handler) {
  const set = listeners.get(event);
  if (!set) return;
  if (handler) set.delete(handler);
  else set.clear();
}

export function emitLocal(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of [...set]) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[demo socket] handler lỗi cho "${event}"`, err);
    }
  }
}

class DemoSocket {
  constructor() {
    this.connected = true;
    this.id = `demo-${Math.random().toString(16).slice(2, 10)}`;
    this.auth = {};
    setTimeout(() => emitLocal('connect'), 0);
  }

  on(event, handler) {
    addListener(event, handler);
    return this;
  }

  once(event, handler) {
    const wrapper = (payload) => {
      removeListener(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    removeListener(event, handler);
    return this;
  }

  removeAllListeners(event) {
    if (event) removeListener(event);
    else listeners.clear();
    return this;
  }

  emit(event, payload) {
    emitLocal(event, payload);
    return this;
  }

  disconnect() {
    this.connected = false;
    emitLocal('disconnect', 'io client disconnect');
    return this;
  }

  connect() {
    this.connected = true;
    emitLocal('connect');
    return this;
  }
}

export function io() {
  return new DemoSocket();
}
