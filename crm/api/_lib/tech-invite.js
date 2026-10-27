import { miguelContactBlocked } from './miguel-contact-block.js';
import crypto from 'crypto';
import { sendSMSResult, smsBrandName } from './sms.js';
import { signToken } from './auth.js';
import { EMAIL_BRANDS } from './email.js';

export const INVITE_TTL_DAYS = 7;

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newInviteCode() {
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < 20; i++) out += CODE_ALPHABET[bytes[i] & 31];
  return out;
}

export function normalizeInviteCode(raw) {
  const c = String(raw || '').trim().toUpperCase();
  return /^[0-9A-HJKMNP-TV-Z]{20}$/.test(c) ? c : null;
}

export function appBaseUrl() {
  return (process.env.PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tidyhaus-crm.vercel.app'))
    .replace(/\/+$/, '');
}
export function inviteLink(code) {
  return `${appBaseUrl()}/join?c=${code}`;
}

export function digits10(phone) { return String(phone || '').replace(/\D/g, '').slice(-10); }
export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

export function inviteBrand(slug, fallbackName) {
  return smsBrandName(slug, (EMAIL_BRANDS[slug] && EMAIL_BRANDS[slug].name) || fallbackName);
}

export function inviteState(row) {
  if (!row) return 'invalid';
  if (row.status === 'joined') return 'joined';
  if (row.status === 'revoked') return 'revoked';
  return new Date(row.expires_at).getTime() <= Date.now() ? 'expired' : 'open';
}

const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '0123', '1234', '2345', '3456', '4567', '5678', '6789', '4321', '9876', '1212', '2580',
]);
export function weakPin(pin) { return WEAK_PINS.has(String(pin || '')); }

export function fmtExpiry(iso, tz) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { timeZone: tz || 'Asia/Manila', month: 'short', day: 'numeric' });
  } catch { return ''; }
}

export function inviteSmsText({ brand, name, metro, link, expiresLabel }) {
  const who = firstName(name) ? `Hi ${firstName(name)}, you're` : "You're";
  return `${brand}: ${who} invited to join our cleaner team in ${metro}. `
    + `Create your login and pick the times you can work (about 2 min): ${link} `
    + (expiresLabel ? `Link expires ${expiresLabel}.` : '');
}

export function welcomeSmsText({ brand, name, metro, unstaffed }) {
  const middle = unstaffed
    ? `We're getting ${metro} ready for online bookings and will text you here as soon as jobs start.`
    : `You can now get jobs in ${metro} during the times you picked. We'll text this number every time you're booked.`;
  return `${brand}: You're in, ${firstName(name)}! ${middle} `
    + `Cleaner app: ${appBaseUrl()}/tech.html (sign in with this number + your 4-digit PIN).`;
}

export async function sendTechSms(db, { kind, technicianId = null, businessId = null, phone, message }) {
  if (miguelContactBlocked(technicianId)) return { ok: false, skipped: 'owner_miguel_no_contact' };
  let logId = null;
  try {
    const { data } = await db.from('tech_sms_log')
      .insert({ booking_id: null, technician_id: technicianId, business_id: businessId, kind, status: 'pending', to_phone: phone })
      .select('id').maybeSingle();
    logId = data?.id || null;
  } catch { /* logging must never block the text */ }
  const statusCallback = logId
    ? `${appBaseUrl()}/api/analytics?action=sms_status&token=${encodeURIComponent(signToken({ kind: 'tech_sms', tech_sms_log_id: logId }, 86400))}`
    : undefined;
  const r = await sendSMSResult(phone, message, statusCallback ? { statusCallback } : {});
  if (logId) {
    const patch = r.ok
      ? { status: 'pending' }
      : r.skipped
        ? { status: 'skipped', skip_reason: r.skipped }
        : { status: 'failed', error: String(r.error || 'unknown').slice(0, 500) };
    try { await db.from('tech_sms_log').update(patch).eq('id', logId); } catch { /* best effort */ }
  }
  return { ...r, logId };
}

export function smsFailReason(r) {
  if (!r || r.ok) return null;
  if (r.skipped === 'notifications_off') return 'texting is switched off';
  if (r.skipped === 'not_configured') return 'texting is not set up';
  if (r.skipped === 'bad_phone') return 'that is not a valid US cell number';
  if (r.skipped) return r.skipped;
  return String(r.error || 'unknown error').replace(/^Twilio \d+:\s*/, 'Twilio: ').slice(0, 160);
}
