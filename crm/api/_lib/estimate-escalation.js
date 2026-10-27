// api/_lib/estimate-escalation.js
// Unsent-estimate alarm (owner, 2026-10-22). Driven by the
// estimate_escalation_check Vercel cron (vercel.json, every 10 min):
//   GET /api/migrate?action=estimate_escalation_check&secret=CRON_SECRET
//
// "Unsent" = never texted and never emailed (texted_at and emailed_at both
// null), not approved, not deleted, and not closed (archived / lost /
// expired / declined / out_of_area). Same rule as unsentEstimateFilter in
// api/admin.js, which feeds the "Needs sending" list on the Estimates screen.
//
//   STEP 1, 30 min unsent: text the staffer who created it (estimates.created_by),
//           else the business's secretaries (leadAlertRecipients).
//   STEP 2, 2 hours unsent: the same people + the owner.
//
// Only 8 AM-8 PM in the business's time zone. An alert that comes due off
// hours is not stamped, so the first run after 8 AM sends it. If both steps
// are due at once, only step 2 goes out and both stamps are set.
//
// Once-only stamps (migration 0097): escalated_1h_at = the 30-minute step,
// escalated_2_5h_at = the 2-hour step. A failed SMS still stamps (no retry
// loop every 10 min).
import { serviceClient } from './supabase.js';
import { sendSMSResult, toE164 } from './sms.js';
import { leadAlertRecipients } from './lead-alert-recipients.js';

const MIN = 60 * 1000;
export const UNSENT_REMIND_MS = 30 * MIN;
export const UNSENT_ESCALATE_MS = 120 * MIN;
const LOOKBACK_MS = 36 * 60 * MIN;   // covers an overnight wait; older = stale data
export const CLOSED_STATUSES = ['lost', 'expired', 'booked', 'out_of_area'];
const OPEN_HOUR = 8, CLOSE_HOUR = 20;

function localHour(tz, ms) {
  try {
    const h = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms));
    return Number(h) % 24;
  } catch { return null; }
}
export function inBusinessHours(tz, ms = Date.now()) {
  const h = localHour(tz, ms);
  return h != null && h >= OPEN_HOUR && h < CLOSE_HOUR;
}

function dashboardEstimateUrl(id) {
  const base = process.env.PUBLIC_DASHBOARD_URL || process.env.PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${base}/admin.html?estimate=${encodeURIComponent(id)}`;
}

async function creatorPhone(db, name, cache) {
  const n = String(name || '').trim();
  if (!n) return null;
  if (cache.has(n)) return cache.get(n);
  let p = null;
  try {
    const { data } = await db.from('staff_users').select('phone').eq('active', true).ilike('name', n).limit(1);
    p = toE164((data && data[0] && data[0].phone) || '') || null;
  } catch { p = null; }
  cache.set(n, p);
  return p;
}

// Run one pass. opts.dryRun: report, send nothing, stamp nothing.
export async function checkEstimateEscalations(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = serviceClient();
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  const { data: bizRows, error: bizErr } = await db.from('businesses').select('id, slug, timezone');
  if (bizErr) throw new Error(`businesses query failed: ${bizErr.message}`);
  const bizById = new Map((bizRows || []).map(b => [b.id, b]));

  const summary = { checked: 0, reminded: 0, escalated: 0, queued_off_hours: 0, skipped: 0, errors: 0, details: [] };

  const { data: rows, error } = await db
    .from('estimates')
    .select('id, business_id, customer_name, service_label, status, created_at, created_by, escalated_1h_at, escalated_2_5h_at')
    .is('texted_at', null).is('emailed_at', null).is('approved_at', null).is('deleted_at', null)
    .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    .gte('created_at', new Date(now - LOOKBACK_MS).toISOString())
    .lte('created_at', new Date(now - UNSENT_REMIND_MS).toISOString())
    .limit(300);
  if (error) throw new Error(`estimates query failed: ${error.message}`);

  const ownerRaw = process.env.OWNER_PHONE_NUMBER;
  const owner = ownerRaw ? toE164(ownerRaw) : null;
  const phoneCache = new Map();
  const recipCache = new Map();

  for (const est of rows || []) {
    summary.checked++;
    const biz = bizById.get(est.business_id) || {};
    const ageMs = now - (Date.parse(est.created_at) || now);
    const remindDue = ageMs >= UNSENT_REMIND_MS && !est.escalated_1h_at;
    const escalateDue = ageMs >= UNSENT_ESCALATE_MS && !est.escalated_2_5h_at;
    if (!remindDue && !escalateDue) { summary.skipped++; continue; }
    if (!inBusinessHours(biz.timezone, now)) {
      summary.queued_off_hours++;
      summary.details.push({ id: est.id, slug: biz.slug, queued: 'off hours' });
      continue;
    }

    let staff = [];
    const cp = await creatorPhone(db, est.created_by, phoneCache);
    if (cp) staff = [cp];
    else {
      if (!recipCache.has(biz.slug)) recipCache.set(biz.slug, (await leadAlertRecipients(db, biz.slug)).map(r => r.phone));
      staff = recipCache.get(biz.slug) || [];
    }
    const link = dashboardEstimateUrl(est.id);
    const who = `${est.customer_name || 'A customer'}${est.service_label ? ` (${est.service_label})` : ''}`;
    const step2 = escalateDue;
    const msg = step2
      ? `Estimate for ${who} still NOT sent after 2 hrs. ${link}`
      : `Estimate for ${who} not sent yet (30 min). ${link}`;
    const to = new Set(staff);
    // Owner gets no estimate texts (owner 2026-10-22).

    if (dryRun) {
      summary.details.push({ id: est.id, slug: biz.slug, step: step2 ? 2 : 1, to: [...to] });
      if (step2) summary.escalated++; else summary.reminded++;
      continue;
    }
    try {
      for (const p of to) {
        const r = await sendSMSResult(p, msg);
        if (!r.ok) console.warn(`[estimate-escalation] SMS failed for estimate ${est.id}:`, r.error || r.skipped);
      }
      const update = { escalated_1h_at: est.escalated_1h_at || nowISO };
      if (step2) update.escalated_2_5h_at = nowISO;
      const { error: upErr } = await db.from('estimates').update(update).eq('id', est.id);
      if (upErr) console.warn(`[estimate-escalation] sent but failed to mark estimate ${est.id}:`, upErr.message);
      if (step2) summary.escalated++; else summary.reminded++;
      summary.details.push({ id: est.id, slug: biz.slug, step: step2 ? 2 : 1, sent: to.size });
    } catch (e) {
      summary.errors++;
      summary.details.push({ id: est.id, error: e.message });
      console.error(`[estimate-escalation] error on estimate ${est.id}:`, e.message);
    }
  }
  console.log(`[estimate-escalation] checked=${summary.checked} reminded=${summary.reminded} escalated=${summary.escalated} queued=${summary.queued_off_hours} dryRun=${dryRun}`);
  return summary;
}
