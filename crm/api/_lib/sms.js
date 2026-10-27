import { recipientContactBlock } from './miguel-contact-block.js';
import { smsNotificationsOn } from './notify.js';
import { demoMode } from './demo.js';
import { NATIVE_BUSINESS } from './native-businesses.js';
import { digitsOf } from './grasshopper.js';

export const TIDYHAUS_SMS_BRAND = 'TidyHaus Home Cleaning';
export function smsBrandName(slug, name) {
  const n = (name == null ? '' : String(name)).trim();
  if (slug === 'tidyhaus' || /^tidyhaus( tv mounting)?$/i.test(n)) return TIDYHAUS_SMS_BRAND;
  return n
    || (slug && NATIVE_BUSINESS[slug] && NATIVE_BUSINESS[slug].name)
    || (slug === 'doms' ? "Dom's Home Cleaning" : '')
    || TIDYHAUS_SMS_BRAND;
}

export const SMS_STOP_RE = /^\s*(stop\s*all|stop|unsubscribe|cancel|end|quit|revoke|opt[\s-]*out)[\s.!]*$/i;
export const SMS_START_RE = /^\s*(start|unstop)[\s.!]*$/i;

export async function textConsentFor(db, phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 10) return false;
  const p = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return (await smsOptOutState(db, p)) !== true;
}

export async function smsOptOutState(db, phone) {
  try {
    const { data, error } = await db.from('messages').select('body')
      .eq('customer_phone', phone).eq('direction', 'in')
      .order('created_at', { ascending: false }).limit(300);
    if (error) return null;
    for (const m of data || []) {
      const b = (m.body || '').toString();
      if (SMS_STOP_RE.test(b)) return true;
      if (SMS_START_RE.test(b)) return false;
    }
    return false;
  } catch {
    return null;
  }
}

export function phone10(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

export async function verbalConsentFor(db, phone) {
  try {
    const p = phone10(phone);
    if (p.length !== 10) return null;
    const { data, error } = await db.from('sms_verbal_consent').select('phone, recorded_by, recorded_at').eq('phone', p).maybeSingle();
    if (error) return null;
    return data || null;
  } catch { return null; }
}

export const SMS_GATE_MSG = {
  blocked: 'Blocked number. No texts.',
  stop: 'They texted STOP. No texts. Call them.',
  check: 'Could not check texting. Try again.',
  no_consent: 'No text approval yet.',
};

export async function staffTextGate(db, phone, rowConsent) {
  const p = phone10(phone);
  if (p.length !== 10) return { ok: false, code: 'bad_phone', status: 400, error: 'No valid phone number.' };
  try {
    const { data: bl } = await db.from('blocked_numbers').select('id').eq('phone', p).limit(1);
    if (bl && bl.length) return { ok: false, code: 'blocked', status: 409, error: SMS_GATE_MSG.blocked };
  } catch { /* fail open, same as the public forms */ }
  const optedOut = await smsOptOutState(db, p);
  if (optedOut === true) return { ok: false, code: 'stop', status: 409, error: SMS_GATE_MSG.stop };
  if (rowConsent === true) return { ok: true, via: 'row' };
  if (optedOut === null) return { ok: false, code: 'check', status: 503, error: SMS_GATE_MSG.check };
  if (await verbalConsentFor(db, p)) return { ok: true, via: 'verbal' };
  return { ok: false, code: 'no_consent', status: 409, needs_consent: true, phone: p, error: SMS_GATE_MSG.no_consent };
}

export function gateRefuse(res, g) {
  if (g.ok) return false;
  res.status(g.status || 409).json({ error: g.error, code: g.code, ...(g.needs_consent ? { needs_consent: true, phone: g.phone } : {}) });
  return true;
}

export function toE164(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.startsWith('+')) return s.replace(/[^\d+]/g, '');
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return d ? `+${d}` : null;
}

function twilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export function smsConfigured() {
  return demoMode() || twilioConfigured();
}

const SMS_TIMEOUT_MS = 10000;
function smsTimeoutSignal() {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), SMS_TIMEOUT_MS);
  if (typeof t.unref === 'function') t.unref();
  return c.signal;
}

async function sendViaTwilio(to, message, statusCallback, from) {
  const formData = new URLSearchParams();
  formData.append('From', from || process.env.TWILIO_PHONE_NUMBER);
  formData.append('To', to);
  formData.append('Body', message);
  if (statusCallback) formData.append('StatusCallback', statusCallback);
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    signal: smsTimeoutSignal(),
    headers: { Authorization: `Basic ${auth}` },
    body: formData,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: `Twilio ${res.status}: ${t.slice(0, 300)}` };
  }
  let sid = null;
  try { sid = (await res.json())?.sid || null; } catch { /* sent regardless */ }
  return { ok: true, sid };
}

const GSM_MAP = [[/[‘’‚′´`]/g, "'"], [/[“”„″«»]/g, '"'],
  [/[‐-―−]/g, '-'], [/…/g, '...'], [/[×]/g, 'x'], [/[→➔➡]/g, '->'],
  [/[  -  ]/g, ' '], [/•|·/g, '-'], [/★/g, '*']];
export function gsm7(text) {
  let t = String(text == null ? '' : text);
  for (const [re, rep] of GSM_MAP) t = t.replace(re, rep);
  t = t.normalize('NFKD').replace(/[^\n\r\x20-\x7E]/g, '');
  return t.replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n').trim();
}

export async function sendSMSResult(phoneNumber, message, opts = {}) {
  const contactBlock = await recipientContactBlock('sms', phoneNumber);
  if (contactBlock) return { ok: false, skipped: contactBlock };
  if (demoMode()) { console.log('[sms:demo] pretend-sent to', String(phoneNumber).slice(-4)); return { ok: true, demo: true }; }
  if (!smsNotificationsOn()) return { ok: false, skipped: 'notifications_off' };
  const to = toE164(phoneNumber);
  if (!to) return { ok: false, skipped: 'bad_phone' };
  if (!twilioConfigured()) return { ok: false, skipped: 'not_configured' };
  try {
    const r = await sendViaTwilio(to, opts.raw ? message : gsm7(message), opts.statusCallback, toE164(opts.from));
    if (r.ok) console.log('[SMS] Sent to', to.slice(-4));
    return r;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function sendSMS(phoneNumber, message) {
  const r = await sendSMSResult(phoneNumber, message);
  if (r.ok) return;
  if (r.error) console.error('[SMS]', r.error);
  else console.warn(`[SMS] not sent (${r.skipped}):`, message);
}

export async function logAutomatedMessage(db, { businessId, customerPhone, body, result }) {
  if (!db) return;
  try {
    const phone = digitsOf(customerPhone);
    if (!phone) return;
    await db.from('messages').insert({
      business_id: businessId || null,
      customer_phone: phone,
      our_phone: digitsOf(process.env.TWILIO_PHONE_NUMBER || ''),
      direction: 'out',
      body,
      twilio_sid: (result && result.sid) || null,
      status: (result && result.ok) ? 'sent' : 'failed',
      error: (result && !result.ok) ? (result.error || result.skipped || null) : null,
      sent_by: 'automated',
    });
  } catch (e) {
    console.error('[sms] automated messages log failed:', e.message);
  }
}
