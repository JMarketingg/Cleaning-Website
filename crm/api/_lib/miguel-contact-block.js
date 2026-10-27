// Owner 2026-10-10: never text or email Miguel until this code is changed.
// Owner 2026-10-13: block lifted — Miguel is fully hired (Dom's + Never Fail's).
import { serviceClient } from './supabase.js';
export const MIGUEL_CONTACT_BLOCK_ENABLED = false;
export const MIGUEL_TECHNICIAN_ID = '85c2781f-9d42-473e-8024-e4a9a76e7018';
export function miguelContactBlocked(technicianId) { return MIGUEL_CONTACT_BLOCK_ENABLED && technicianId === MIGUEL_TECHNICIAN_ID; }
const normalize = (channel, value) => channel === 'sms' ? String(value || '').replace(/\D/g, '').slice(-10) : String(value || '').trim().toLowerCase().replace(/^.*<([^>]+)>$/, '$1');
export async function recipientContactBlock(channel, recipient, db = null) {
  if (!MIGUEL_CONTACT_BLOCK_ENABLED) return null;
  const recipients = (Array.isArray(recipient) ? recipient : [recipient]).map(value => normalize(channel, value)).filter(Boolean);
  if (!recipients.length) return null;
  if (channel === 'sms' && recipients.includes('4055354020')) return 'owner_miguel_no_contact';
  try {
    const { data, error } = await (db || serviceClient()).from('technicians').select('phone,email').eq('id', MIGUEL_TECHNICIAN_ID).maybeSingle();
    if (error || !data) return 'miguel_contact_guard_unavailable';
    const blocked = normalize(channel, channel === 'sms' ? data.phone : data.email);
    return blocked && recipients.includes(blocked) ? 'owner_miguel_no_contact' : null;
  } catch { return 'miguel_contact_guard_unavailable'; }
}
