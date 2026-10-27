import { serviceClient } from './supabase.js';

const SCAM_TAG = 'scammer';
const digits10 = (raw) => { const d = String(raw || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? d : ''; };

export async function scammerList(db = null) {
  try {
    const { data } = await (db || serviceClient()).from('customers').select('phone, email').contains('tags', [SCAM_TAG]).limit(500);
    const phones = new Set(); const emails = new Set();
    for (const r of data || []) {
      const p = digits10(r.phone); if (p) phones.add(p);
      const e = String(r.email || '').trim().toLowerCase(); if (e) emails.add(e);
    }
    return { phones, emails };
  } catch {
    return { phones: new Set(), emails: new Set() };
  }
}

export async function isScammer({ phone, email } = {}, db = null) {
  const p = digits10(phone); const e = String(email || '').trim().toLowerCase();
  if (!p && !e) return false;
  const { phones, emails } = await scammerList(db);
  return (!!p && phones.has(p)) || (!!e && emails.has(e));
}

export const SCAMMER_BOOKING_ERROR = 'SCAMMER: this customer is flagged for card fraud and cannot be booked.';
