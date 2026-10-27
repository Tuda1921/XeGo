import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

let io = null;

export const rooms = {
  user: (id) => `user:${id}`,
  trip: (id) => `trip:${id}`,
  admins: 'admins',
  drivers: 'drivers',
};

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = db
        .prepare('SELECT id, role, name, status FROM users WHERE id = ?')
        .get(payload.sub);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(rooms.user(id));
    if (role === 'admin' || role === 'operator') socket.join(rooms.admins);
    if (role === 'driver') socket.join(rooms.drivers);

    socket.emit('connected', { userId: id, role });

    socket.on('trip:subscribe', (tripId) => {
      const trip = db
        .prepare('SELECT id, customer_id, driver_id FROM trips WHERE id = ?')
        .get(Number(tripId));
      if (!trip) return;
      const allowed =
        role === 'admin' ||
        role === 'operator' ||
        trip.customer_id === id ||
        trip.driver_id === id;
      if (allowed) socket.join(rooms.trip(trip.id));
    });

    socket.on('trip:unsubscribe', (tripId) => {
      socket.leave(rooms.trip(Number(tripId)));
    });

    socket.on('disconnect', () => {});
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(rooms.user(userId)).emit(event, payload);
}

export function emitToTrip(tripId, event, payload) {
  if (!io || !tripId) return;
  io.to(rooms.trip(tripId)).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  if (!io) return;
  io.to(rooms.admins).emit(event, payload);
}

export function emitToDrivers(event, payload) {
  if (!io) return;
  io.to(rooms.drivers).emit(event, payload);
}

export function getIo() {
  return io;
}
