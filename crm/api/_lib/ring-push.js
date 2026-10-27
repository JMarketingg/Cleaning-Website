import { createHmac } from 'node:crypto';

const ten = (v) => String(v || '').replace(/\D/g, '').slice(-10);

export function ringTopic(handset) {
  const d = ten(handset);
  if (d.length !== 10) return null;
  const h = createHmac('sha256', process.env.SESSION_SECRET || 'dev-insecure-secret-change-me').update('ring:' + d).digest('hex').slice(0, 32);
  return 'ring-' + h;
}

export async function pushRing(handset, payload) {
  const topic = ringTopic(handset);
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!topic || !url || !key) return false;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic, event: 'ring', payload, private: false }] }),
      signal: AbortSignal.timeout(600),
    });
    return r.ok;
  } catch (e) {
    console.warn('[ring-push]', e.message);
    return false;
  }
}
