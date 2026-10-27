// TidyHaus daily job (6 PM Manila): texts tomorrow's customers and keeps repeat
// bookings booked ahead.
import { sendText, alreadySent } from './semaphore.js';

const TZ = 'Asia/Manila';
const dayStr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const timeStr = (iso) => new Date(iso).toLocaleTimeString('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';

export async function textSettings(db) {
  const { data } = await db.from('businesses').select('id, settings').eq('slug', 'tidyhaus').single();
  const t = (data.settings && data.settings.texts) || {};
  return { bizId: data.id, settings: data.settings || {}, texts: { confirm: t.confirm !== false, reminder: t.reminder !== false, otw: t.otw !== false } };
}

export function confirmMessage(b) {
  const when = new Date(b.scheduled_at).toLocaleDateString('en-PH', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  return `Hi ${first(b.customer?.name)}! Your TidyHaus cleaning is booked for ${when} at ${timeStr(b.scheduled_at)}. Total ₱${Math.round(Number(b.price) || 0).toLocaleString('en-PH')}. Questions? Reply or call 0992 309 5621.`;
}
export function reminderMessage(b) {
  return `Hi ${first(b.customer?.name)}! Reminder: TidyHaus is cleaning tomorrow at ${timeStr(b.scheduled_at)}. Please let building security know we're coming. See you!`;
}
export function otwMessage(b, cleaner) {
  return `Hi ${first(b.customer?.name)}! ${first(cleaner) === 'there' ? 'Your cleaner' : first(cleaner)} from TidyHaus is on the way now.`;
}

export async function sendTomorrowReminders(db) {
  const { texts } = await textSettings(db);
  if (!texts.reminder) return { reminders: 'off' };
  const tomorrow = dayStr(new Date(Date.now() + 86400000));
  const lo = new Date(`${tomorrow}T00:00:00+08:00`).toISOString(), hi = new Date(`${tomorrow}T23:59:59+08:00`).toISOString();
  const { data, error } = await db.from('bookings').select('id, scheduled_at, status, customer:customers ( name, phone )')
    .gte('scheduled_at', lo).lte('scheduled_at', hi).not('status', 'in', '(cancelled,completed)');
  if (error) throw error;
  let sent = 0, skipped = 0;
  for (const b of data || []) {
    if (!b.customer?.phone || await alreadySent(db, b.id, 'reminder')) { skipped++; continue; }
    const r = await sendText(b.customer.phone, reminderMessage(b), { kind: 'reminder', bookingId: b.id, db });
    if (r.ok) sent++; else skipped++;
  }
  return { reminders_sent: sent, reminders_skipped: skipped };
}

const RULES = { weekly: { days: 7, keep: 12 }, biweekly: { days: 14, keep: 12 }, monthly: { months: 1, keep: 6 } };
function nextAt(iso, rule) {
  if (!rule.months) return new Date(Date.parse(iso) + rule.days * 86400000).toISOString();
  const d = new Date(iso), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + rule.months);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.toISOString();
}
const KEEP = ['business_id', 'customer_id', 'technician_id', 'secondary_technician_id', 'service_id', 'service_area_id', 'source',
  'duration_minutes', 'subtotal', 'discount', 'price', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'lat', 'lng',
  'notes', 'customer_notes', 'payment_required', 'payment_method', 'sms_consent', 'extra_slots'];

export async function extendSeries(db) {
  const { data: all, error } = await db.from('bookings').select('*').not('metadata->>series_id', 'is', null).order('scheduled_at');
  if (error) throw error;
  const bySeries = new Map();
  for (const b of all || []) { const k = b.metadata.series_id; if (!bySeries.has(k)) bySeries.set(k, []); bySeries.get(k).push(b); }
  let added = 0;
  for (const [, list] of bySeries) {
    const last = list[list.length - 1];
    const rule = RULES[last.metadata.series_every];
    if (!rule || last.status === 'cancelled') continue;
    const future = list.filter((b) => Date.parse(b.scheduled_at) > Date.now() && b.status !== 'cancelled').length;
    if (future >= rule.keep) continue;
    const { data: items } = await db.from('booking_line_items').select('kind, name, quantity, unit_price, line_total, service_id, option_id, sort_order').eq('booking_id', last.id);
    let prev = last, idx = Number(last.metadata.series_index) || 0;
    for (let n = future; n < rule.keep; n++) {
      const at = nextAt(prev.scheduled_at, rule);
      idx++;
      const row = { status: 'confirmed', scheduled_at: at, metadata: { ...prev.metadata, series_index: idx } };
      for (const k of KEEP) if (last[k] !== undefined) row[k] = last[k];
      let { data: nb, error: e1 } = await db.from('bookings').insert(row).select('*').single();
      if (e1 && /bookings_tech_slot_unique/.test(e1.message || '')) ({ data: nb, error: e1 } = await db.from('bookings').insert({ ...row, technician_id: null, secondary_technician_id: null }).select('*').single());
      if (e1) throw e1;
      if (items && items.length) await db.from('booking_line_items').insert(items.map((li) => ({ ...li, booking_id: nb.id, business_id: last.business_id })));
      prev = nb; added++;
    }
  }
  return { repeat_visits_added: added };
}
