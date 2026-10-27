import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'xego-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: process.env.DATA_DIR
    ? path.resolve(rootDir, process.env.DATA_DIR)
    : path.join(rootDir, 'server', 'data'),
  seed: bool(process.env.SEED, true),
  publicWebUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:5173',
  geo: {
    geocoderUrl: process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org',
    routerUrl: process.env.ROUTER_URL || 'https://router.project-osrm.org',
    userAgent: process.env.GEO_USER_AGENT || 'XeGo/1.0',
    timeoutMs: Number(process.env.GEO_TIMEOUT_MS || 4500),
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'demo',
    merchantId: process.env.PAYMENT_MERCHANT_ID || '',
    secretKey: process.env.PAYMENT_SECRET_KEY || '',
    returnUrl: process.env.PAYMENT_RETURN_URL || 'http://localhost:5173/payment/return',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'demo',
    apiKey: process.env.SMS_API_KEY || '',
    brandname: process.env.SMS_BRANDNAME || 'XeGo',
  },
  matching: {
    offerTtlSeconds: Number(process.env.OFFER_TTL_SECONDS || 45),
    radiusKm: Number(process.env.MATCH_RADIUS_KM || 30),
    maxOffersPerRound: Number(process.env.MAX_OFFERS || 3),
    maxRounds: Number(process.env.MAX_MATCH_ROUNDS || 4),
    scheduledLeadMinutes: Number(process.env.SCHEDULED_LEAD_MINUTES || 30),
  },
  commissionRate: Number(process.env.COMMISSION_RATE || 0.2),
};

export const isDemoPayment = () => config.payment.provider === 'demo';
export const isDemoSms = () => config.sms.provider === 'demo';
