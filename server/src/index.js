import http from 'node:http';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { migrate, db } from './db.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/common.js';
import { initRealtime } from './services/realtime.js';
import { startScheduler } from './services/matching.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter, placesRouter, favoritesRouter } from './routes/catalog.js';
import { tripsRouter, driverRouter } from './routes/trips.js';
import { adminRouter } from './routes/admin.js';
import { supportRouter, notificationsRouter } from './routes/support.js';
import { publicRouter } from './routes/public.js';
import { seedDatabase } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

migrate();

if (config.seed) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count === 0) {
    console.log('[seed] Database trống, đang tạo dữ liệu demo...');
    seedDatabase();
  }
}

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(authenticate);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: config.env, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api', catalogRouter);
app.use('/api/places', placesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/driver', driverRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/public', publicRouter);

// Phục vụ bản build của web (nếu có) để chạy một cổng duy nhất khi triển khai.
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api|\/socket\.io).*/, (req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use('/api', notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);
startScheduler();

server.listen(config.port, () => {
  console.log(`[XeGo] API đang chạy tại http://localhost:${config.port}`);
  console.log(`[XeGo] Môi trường: ${config.env}`);
  if (config.payment.provider === 'demo') {
    console.log('[XeGo] Thanh toán: CHẾ ĐỘ MÔ PHỎNG (không giao dịch thật)');
  }
  if (config.sms.provider === 'demo') {
    console.log('[XeGo] SMS/OTP: CHẾ ĐỘ MÔ PHỎNG (OTP in ra log)');
  }
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server };
