import { capName } from './name-case.js';
import { serviceClient } from './supabase.js';
import { emailConfig, sendEmail, estimateEmail, brandFor } from './email.js';
import { emailNotificationsOn } from './notify.js';
import { signToken } from './auth.js';
import { sendSMSResult, smsOptOutState, logAutomatedMessage, phone10 } from './sms.js';
import { isBlockedPhone } from './blocked.js';
import { inBusinessHours } from './estimate-escalation.js';

const HOUR = 3600000;
export const FOLLOWUP_EMAIL_AFTER_MS = 3 * HOUR;
export const FOLLOWUP_COUPON_AMOUNT = 20;
const LOOKBACK_MS = 3 * 24 * HOUR;
const STARTS_AT = Date.parse('2026-09-22T00:00:00-06:00');

export async function checkEstimateFollowups(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = serviceClient();
  const now = Date.now();
  const summary = { checked: 0, sent: 0, skipped: 0, errors: 0, details: [] };
  if (!emailNotificationsOn()) { summary.details.push('email notifications off'); return summary; }

  const { data: rows, error } = await db.from('estimates')
    .select('id, business_id, customer_name, customer_email, service_label, description, customer_note, line_items, tax_rate, upsells, status, approved_at, emailed_at, texted_at, contacted_at, followup_emailed_at, business:businesses(slug)')
    .eq('status', 'sent').is('approved_at', null).is('followup_emailed_at', null).is('deleted_at', null)
    .not('customer_email', 'is', null)
    .gte('contacted_at', new Date(Math.max(STARTS_AT, now - LOOKBACK_MS)).toISOString())
    .limit(200);
  if (error) throw new Error(`estimates query failed: ${error.message}`);

  const ms = (t) => (t ? Date.parse(t) : 0) || 0;
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  for (const e of (rows || [])) {
    summary.checked++;
    const sentAt = Math.max(ms(e.contacted_at), ms(e.texted_at), ms(e.emailed_at));
    if (!sentAt || sentAt > now - FOLLOWUP_EMAIL_AFTER_MS) { summary.skipped++; continue; }
    const slug = e.business && e.business.slug;
    if (!slug || !emailConfig(slug).apiKey) { summary.skipped++; continue; }
    if (!String(e.customer_email).includes('@')) { summary.skipped++; continue; }

    if (dryRun) { summary.details.push({ id: e.id, customer: e.customer_name, email: e.customer_email, sent_at: new Date(sentAt).toISOString() }); continue; }

    const r = await sendCouponFollowup(db, e, slug, { baseUrl });
    if (r.ok) { summary.sent++; summary.details.push({ id: e.id, customer: e.customer_name, email: e.customer_email }); }
    else if (r.already) summary.skipped++;
    else summary.errors++;
  }
  return summary;
}

export async function sendCouponFollowup(db, e, slug, { by = null, baseUrl } = {}) {
  baseUrl = baseUrl ?? (process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''));
  const stamp = new Date().toISOString();
  const { data: claimed, error: claimErr } = await db.from('estimates')
    .update({ followup_emailed_at: stamp, followup_sent_by: by }).eq('id', e.id).is('followup_emailed_at', null).select('id');
  if (claimErr) { console.error('[estimate_followup] claim failed', e.id, claimErr.message); return { error: claimErr.message }; }
  if (!claimed || !claimed.length) return { already: true };
  try {
    const firstName = capName((e.customer_name || '').trim().split(/\s+/)[0]);
    const approveToken = signToken({ kind: 'estimate_approve', estimate_id: e.id, coupon: FOLLOWUP_COUPON_AMOUNT }, 7776000);
    const approveUrl = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(approveToken)}&via=email` : '';
    const upsells = (Array.isArray(e.upsells) ? e.upsells : []).map(u => ({
      id: u.id, description: u.description, qty: u.qty, unit_price: u.unit_price,
      badge: u.badge || '', blurb: u.blurb || '', default_on: !!u.default_on,
    }));
    const { subject, html } = estimateEmail(
      { firstName, serviceLabel: e.service_label, description: e.description, customerNote: e.customer_note,
        lineItems: e.line_items, taxRate: e.tax_rate, approveUrl, upsells, followUp: true, couponAmount: FOLLOWUP_COUPON_AMOUNT },
      brandFor(slug)
    );
    await sendEmail({ slug, to: e.customer_email, subject, html, throwOnError: true, idempotencyKey: `est-followup-${e.id}` });
    return { ok: true, sent_at: stamp };
  } catch (err) {
    console.error('[estimate_followup] send failed, unstamping for retry', e.id, err.message);
    await db.from('estimates').update({ followup_emailed_at: null, followup_sent_by: null }).eq('id', e.id);
    return { error: err.message || 'Email failed to send' };
  }
}

export const FOLLOWUP_TEXT1_AFTER_MS = 3 * HOUR;
export const FOLLOWUP_TEXT2_AFTER_MS = 24 * HOUR;
const TEXT_STARTS_AT = Date.parse('2026-10-22T06:00:00Z');
const TEXT_CLOSED = ['lost', 'expired', 'out_of_area', 'approved', 'booked'];

export async function checkEstimateTextFollowups(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = serviceClient();
  const now = Date.now();
  const summary = { checked: 0, sent: 0, skipped: 0, errors: 0, details: [] };
  const { data: rows, error } = await db.from('estimates')
    .select('id, business_id, customer_name, customer_phone, sms_consent, status, contacted_at, texted_at, emailed_at, followup_text1_at, followup_text2_at, business:businesses(slug, timezone)')
    .is('approved_at', null).is('deleted_at', null).is('followup_text2_at', null)
    .not('customer_phone', 'is', null)
    .not('status', 'in', `(${TEXT_CLOSED.join(',')})`)
    .gte('contacted_at', new Date(Math.max(TEXT_STARTS_AT, now - 3 * 24 * HOUR)).toISOString())
    .limit(200);
  if (error) throw new Error(`estimates query failed: ${error.message}`);
  const ms = (t) => (t ? Date.parse(t) : 0) || 0;
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  for (const e of rows || []) {
    summary.checked++;
    const sentAt = Math.max(ms(e.texted_at), ms(e.emailed_at));
    if (!sentAt) { summary.skipped++; continue; }
    const step = !e.followup_text1_at && now - sentAt >= FOLLOWUP_TEXT1_AFTER_MS && now - sentAt < FOLLOWUP_TEXT2_AFTER_MS ? 1
      : (now - sentAt >= FOLLOWUP_TEXT2_AFTER_MS && now - ms(e.followup_text1_at) >= 12 * HOUR) ? 2 : 0;
    if (!step) { summary.skipped++; continue; }
    const biz = e.business || {};
    if (!inBusinessHours(biz.timezone, now)) { summary.skipped++; summary.details.push({ id: e.id, queued: 'off hours' }); continue; }
    if (e.sms_consent !== true) { summary.skipped++; summary.details.push({ id: e.id, skip: 'no consent' }); continue; }
    const p = phone10(e.customer_phone);
    if (p.length !== 10) { summary.skipped++; continue; }
    if (await smsOptOutState(db, p) !== false) { summary.skipped++; summary.details.push({ id: e.id, skip: 'opted out or unknown' }); continue; }
    if (await isBlockedPhone(p)) { summary.skipped++; summary.details.push({ id: e.id, skip: 'blocked' }); continue; }

    const firstName = capName((e.customer_name || '').trim().split(/\s+/)[0]);
    const named = firstName && !/\d/.test(firstName) ? firstName : '';
    const token = signToken({ kind: 'estimate_approve', estimate_id: e.id, coupon: FOLLOWUP_COUPON_AMOUNT }, 7776000);
    const link = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(token)}&via=sms` : '';
    if (!link) { summary.skipped++; continue; }
    const msg = step === 1
      ? `${named ? `Hi ${named}, did` : 'Did'} you see your estimate? Book from this link for ₱${FOLLOWUP_COUPON_AMOUNT} off:\n${link}\nReply STOP to opt out`
      : `${named ? `Hi ${named}, your` : 'Your'} estimate is still open. ₱${FOLLOWUP_COUPON_AMOUNT} off when you book here:\n${link}\nReply STOP to opt out`;
    if (dryRun) { summary.details.push({ id: e.id, step, phone: p, msg }); continue; }

    const col = step === 1 ? 'followup_text1_at' : 'followup_text2_at';
    const stamp = new Date().toISOString();
    const claim = { [col]: stamp };
    if (step === 2 && !e.followup_text1_at) claim.followup_text1_at = stamp;
    const { data: got, error: cErr } = await db.from('estimates').update(claim).eq('id', e.id).is(col, null).select('id');
    if (cErr || !got || !got.length) { summary.skipped++; continue; }
    try {
      const r = await sendSMSResult(e.customer_phone, msg);
      await logAutomatedMessage(db, { businessId: e.business_id, customerPhone: e.customer_phone, body: msg, result: r });
      if (r.ok) { summary.sent++; summary.details.push({ id: e.id, step }); }
      else { summary.errors++; summary.details.push({ id: e.id, step, error: r.error || r.skipped }); }
    } catch (err) {
      summary.errors++;
      console.error('[estimate_text_followup] send failed', e.id, err.message);
    }
  }
  return summary;
}
