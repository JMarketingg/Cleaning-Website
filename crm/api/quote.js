// Quote requests from the tidyhausph.com quote form. Saved to app.quote_requests
// and shown in the CRM under Quote Requests.
import { serviceClient } from './_lib/supabase.js';
import { overSpeedLimit, clientIp } from './_lib/lead-guard.js';
import { isBotUserAgent } from './_lib/bot-filter.js';
import { notifyOwnerNewQuote } from './_lib/semaphore.js';
import { markPaid, verifyPaymongoSignature } from './_lib/ph-payments.js';

export const config = { api: { bodyParser: false } };
function readRaw(req) {
  return new Promise((resolve, reject) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => resolve(d)); req.on('error', reject); });
}

async function paymongoWebhook(req, res, raw) {
  if (!verifyPaymongoSignature(raw, req.headers['paymongo-signature'])) return res.status(401).json({ error: 'Bad signature' });
  let ev; try { ev = JSON.parse(raw); } catch { return res.status(400).end(); }
  const type = ev?.data?.attributes?.type;
  const session = ev?.data?.attributes?.data;
  if (type === 'checkout_session.payment.paid' && session) {
    const id = session.attributes?.metadata?.booking_id || session.attributes?.reference_number;
    const paidCentavos = (session.attributes?.payments || []).reduce((t, p) => t + (Number(p.attributes?.amount) || 0), 0);
    if (id) await markPaid(serviceClient(), id, 'paymongo', { by: 'PayMongo', amount: paidCentavos ? paidCentavos / 100 : null });
  }
  return res.status(200).json({ ok: true });
}

const ALLOWED_ORIGIN = /^https:\/\/((www\.)?tidyhausph\.com|tidyhaus[a-z0-9-]*\.vercel\.app)$/;
const s = (v, n = 200) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));

export function normalizePhPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(d)) return '+63' + d.slice(1);
  if (/^639\d{9}$/.test(d)) return '+' + d;
  if (/^9\d{9}$/.test(d)) return '+63' + d;
  return null;
}

export default async function handler(req, res) {
  const origin = String(req.headers.origin || '');
  if (ALLOWED_ORIGIN.test(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.query.action !== 'paymongo_webhook' && isBotUserAgent(req.headers['user-agent'])) return res.status(200).json({ ok: true });

  const raw = await readRaw(req);
  if (req.query.action === 'paymongo_webhook') return paymongoWebhook(req, res, raw);
  let b = {};
  try { b = JSON.parse(raw || '{}') || {}; } catch { b = {}; }
  const name = s(b.name, 120);
  const phone = normalizePhPhone(b.phone);
  if (!name || !phone) return res.status(400).json({ error: 'Name and a PH mobile number are required.' });
  if (overSpeedLimit('quote', { ip: clientIp(req), phone })) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

  const db = serviceClient();
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  const { data: dupe } = await db.from('quote_requests').select('id').eq('phone', phone).gte('created_at', since).limit(1);
  const row = {
    name, phone,
    area: s(b.area, 80), service: s(b.service, 80), place: s(b.place, 80),
    bedrooms: s(b.bedrooms, 40), bathrooms: s(b.bathrooms, 40), office_size: s(b.office_size, 60), frequency: s(b.frequency, 60),
    preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : null,
    preferred_time: s(b.time, 60), building: s(b.building, 200), notes: s(b.notes, 1000),
    channel: s(b.channel, 30), referrer: s(b.ref, 300), visitor_id: s(b.vid, 64), updated_at: new Date().toISOString(),
  };
  if (dupe && dupe.length) {
    const { error } = await db.from('quote_requests').update(row).eq('id', dupe[0].id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, id: dupe[0].id, updated: true });
  }
  const { data, error } = await db.from('quote_requests').insert(row).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  try { await notifyOwnerNewQuote(row); } catch (_) { /* a failed alert never loses the request */ }
  return res.status(200).json({ ok: true, id: data.id });
}
