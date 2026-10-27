// Philippine SMS through Semaphore (semaphore.co). Off until SEMAPHORE_API_KEY is set.
import { serviceClient } from './supabase.js';

export function textsOn() { return !!process.env.SEMAPHORE_API_KEY; }

function localNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (/^639\d{9}$/.test(d)) return '0' + d.slice(2);
  if (/^09\d{9}$/.test(d)) return d;
  return null;
}

export async function sendText(phone, message, { kind = 'other', bookingId = null, db = serviceClient() } = {}) {
  const number = localNumber(phone);
  const log = (status, extra = {}) => db.from('text_log').insert({ booking_id: bookingId, kind, phone: String(phone || ''), body: message, status, ...extra });
  if (!number) { await log('skipped', { error: 'not a PH mobile number' }); return { ok: false, skipped: 'bad number' }; }
  if (!textsOn()) { await log('skipped', { error: 'Semaphore not set up' }); return { ok: false, skipped: 'off' }; }
  const form = new URLSearchParams({ apikey: process.env.SEMAPHORE_API_KEY, number, message });
  if (process.env.SEMAPHORE_SENDER_NAME) form.set('sendername', process.env.SEMAPHORE_SENDER_NAME);
  try {
    const r = await fetch('https://api.semaphore.co/api/v4/messages', { method: 'POST', body: form });
    const data = await r.json().catch(() => null);
    const first = Array.isArray(data) ? data[0] : null;
    if (!r.ok || !first) { await log('failed', { error: JSON.stringify(data).slice(0, 300) }); return { ok: false }; }
    await log('sent', { provider_id: String(first.message_id || '') });
    return { ok: true };
  } catch (e) {
    await log('failed', { error: String(e.message || e).slice(0, 300) });
    return { ok: false };
  }
}

export async function alreadySent(db, bookingId, kind) {
  const { data } = await db.from('text_log').select('id').eq('booking_id', bookingId).eq('kind', kind).eq('status', 'sent').limit(1);
  return !!(data && data.length);
}

export async function notifyOwnerNewQuote(q) {
  const to = process.env.OWNER_PHONE_NUMBER;
  if (!to) return;
  const what = [q.service, q.area, q.frequency].filter(Boolean).join(' · ');
  await sendText(to, `New TidyHaus quote request: ${q.name} ${q.phone}${what ? ' - ' + what : ''}. Open the CRM to reply.`, { kind: 'owner_quote_alert' });
}
