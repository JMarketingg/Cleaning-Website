import { sendSMSResult, logAutomatedMessage } from './sms.js';

export function bookingConfirmMessage({ dateStr, timeWindow, techName }) {
  const when = timeWindow ? `${dateStr} between ${timeWindow}` : dateStr;
  const techLine = techName
    ? `${String(techName).trim().split(/\s+/)[0]} will text you when he's on the way.`
    : `We'll text you when your cleaner is on the way.`;
  return `You're booked for ${when}. ${techLine}`;
}

export function optInConfirmMessage(bizSlug, bizName) {
  return `You're signed up for appointment and customer-care texts about your job.`;
}

export async function sendOptInConfirmSms({ customerPhone, bizSlug, bizName, tag = 'opt-in', db = null, businessId = null }) {
  if (!customerPhone) return { ok: false, skipped: 'no_customer_phone' };
  const msg = optInConfirmMessage(bizSlug, bizName);
  try {
    const r = await sendSMSResult(customerPhone, msg);
    if (!r.ok) console.warn(`[${tag}] opt-in confirmation SMS not sent:`, r.skipped || r.error);
    await logAutomatedMessage(db, { businessId, customerPhone, body: msg, result: r });
    return r;
  } catch (e) {
    console.error(`[${tag}] opt-in confirmation SMS error:`, e.message);
    return { ok: false, error: e.message };
  }
}

export async function sendBookingConfirmSms({
  customerPhone, smsConsent, bizName, bizSlug, techName, startUTC, tz, timeWindow, tag = 'book',
  db = null, businessId = null,
}) {
  if (!customerPhone) return { ok: false, skipped: 'no_customer_phone' };
  if (smsConsent !== true) {
    console.log(`[${tag}] confirmation SMS skipped: customer did not opt in to texts`);
    return { ok: false, skipped: 'no_sms_consent' };
  }

  let dateStr;
  try {
    dateStr = startUTC.toLocaleDateString('en-US',
      { timeZone: tz || 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    dateStr = startUTC.toISOString().slice(0, 10);
  }

  const msg = bookingConfirmMessage({ bizName, bizSlug, dateStr, timeWindow, techName });
  try {
    const r = await sendSMSResult(customerPhone, msg);
    if (!r.ok) console.warn(`[${tag}] confirmation SMS not sent:`, r.skipped || r.error);
    await logAutomatedMessage(db, { businessId, customerPhone, body: msg, result: r });
    return r;
  } catch (e) {
    console.error(`[${tag}] confirmation SMS error:`, e.message);
    return { ok: false, error: e.message };
  }
}
