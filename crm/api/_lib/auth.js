import crypto from 'crypto';

const DEFAULT_TTL = 60 * 60 * 12;

export const ADMIN_SESSION_MAX = Number(process.env.ADMIN_SESSION_MAX_SECONDS) || 7 * 24 * 3600;
export const TECH_SESSION_MAX  = Number(process.env.TECH_SESSION_MAX_SECONDS)  || 14 * 24 * 3600;

function secret() {
  return process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';
}

export function signToken(payload, ttlSeconds = DEFAULT_TTL) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function refreshToken(auth, { ttlSeconds = DEFAULT_TTL, maxSeconds = 0 } = {}) {
  if (!auth || auth.sess !== 1) return null;
  const now = Math.floor(Date.now() / 1000);
  const sat = Number(auth.sat) || Number(auth.iat) || now;
  if (maxSeconds && now - sat >= maxSeconds) return null;
  const { exp, iat, ...claims } = auth;
  let newExp = now + Math.max(ttlSeconds, Number(exp) - now);
  if (maxSeconds) newExp = Math.min(newExp, sat + maxSeconds);
  if (newExp <= Number(exp) || newExp <= now) return null;
  return signToken({ ...claims, sat }, newExp - now);
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let body;
  try { body = JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
  return body;
}

export function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function applyCors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
