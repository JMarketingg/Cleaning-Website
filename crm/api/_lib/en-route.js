import { sendSMSResult, logAutomatedMessage } from './sms.js';
import { signToken } from './auth.js';

export const DEFAULT_ETA_MINUTES = 30;

function baseUrl() {
  return process.env.PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

export function enRouteMessage(techName, bizName, etaMinutes, bizSlug) {
  const who = (techName && String(techName).trim().split(/\s+/)[0]) || 'Your cleaner';
  return `${who} is on the way, about ${etaMinutes} min out. See you soon!`;
}

export async function sendEnRouteSms(db, opts = {}) {
  const {
    bookingId,
    technicianId,
    customerPhone,
    smsConsent,
    etaMinutes = DEFAULT_ETA_MINUTES,
  } = opts;

  const skipped = !customerPhone ? 'no_customer_phone' : !smsConsent ? 'no_sms_consent' : null;
  if (skipped) {
    try {
      const { error } = await db.from('bookings').update({
        on_the_way_sms_status: skipped === 'no_sms_consent' ? 'skipped_no_consent' : 'skipped_no_phone',
      }).eq('id', bookingId).is('on_the_way_sms_sent_at', null);
      if (error) console.warn('[en-route sms] skip not recorded:', error.message);
    } catch (e) { console.warn('[en-route sms] skip not recorded:', e.message); }
    return { ok: false, skipped };
  }

  let techName = null;
  let bizName = opts.bizName || null;
  let bizSlug = opts.bizSlug || null;
  let businessId = null;
  try {
    const [techRes, bookRes] = await Promise.all([
      db.from('technicians').select('name').eq('id', technicianId).maybeSingle(),
      db.from('bookings').select('business_id, business:businesses ( name, slug )').eq('id', bookingId).maybeSingle(),
    ]);
    if (techRes?.data?.name) techName = techRes.data.name;
    if (!bizName && bookRes?.data?.business?.name) bizName = bookRes.data.business.name;
    if (!bizSlug && bookRes?.data?.business?.slug) bizSlug = bookRes.data.business.slug;
    businessId = bookRes?.data?.business_id || null;
  } catch { /* best-effort: fall back to generic wording */ }

  const msg = enRouteMessage(techName, bizName, etaMinutes, bizSlug);

  const token = signToken({ kind: 'on_the_way', booking_id: bookingId }, 3600);
  const statusCallback = `${baseUrl()}/api/analytics?action=sms_status&token=${encodeURIComponent(token)}`;

  try {
    const r = await sendSMSResult(customerPhone, msg, { statusCallback });
    await db.from('bookings').update({
      on_the_way_sms_status: r.ok ? 'pending' : 'failed',
      on_the_way_sms_sent_at: new Date().toISOString(),
    }).eq('id', bookingId);
    await logAutomatedMessage(db, { businessId, customerPhone, body: msg, result: r });
    return r;
  } catch (e) {
    console.error('[en-route sms]', e.message);
    return { ok: false, error: e.message };
  }
}
