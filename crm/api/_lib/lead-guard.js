
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const hits = new Map();

export function normalizeEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at).split('+')[0];
  let domain = e.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

export function clientIp(req) {
  const xff = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  return xff || String((req.headers && req.headers['x-real-ip']) || '');
}

function recordAndCount(key, now) {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length;
}

export function overSpeedLimit(scope, { ip, email, phone } = {}) {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, ts] of hits) if (!ts.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  let over = false;
  if (ip && recordAndCount(`${scope}|ip|${ip}`, now) > MAX_PER_WINDOW) over = true;
  const em = normalizeEmail(email);
  if (em.includes('@') && recordAndCount(`${scope}|em|${em}`, now) > MAX_PER_WINDOW) over = true;
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length >= 7 && recordAndCount(`${scope}|ph|${digits}`, now) > MAX_PER_WINDOW) over = true;
  return over;
}

export function isGibberish(v) {
  v = String(v || '').trim();
  return /^[A-Za-z]{12,}$/.test(v) && (v.slice(1).match(/[A-Z]/g) || []).length >= 3;
}
