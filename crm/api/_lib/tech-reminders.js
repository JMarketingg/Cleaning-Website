// Tech reminder texts (owner 2026-10-20). Runs on the 10-min tech_late_check
// cron. Every time is the JOB's own local time (service area tz):
//   1. 'jobday'    7:00 AM local: today's jobs (time, first name, address, link)
//   2. Leave-now: owner moved it to 30 min before, which is tech-late.js
//                  stage 1 ("Leave now for {time} - {address}"), so not here.
//   3. 'tomorrow'  7:00 PM local: "You have N jobs tomorrow" (moved from the
//                  old 8:30 PM Denver cron).
//   4. 'late_alert' the late text (tech-late.js stage 3, kind 'late') asks
//                  "Reply YES with your ETA". No YES in 15 min -> the covering
//                  secretaries get one text per job per tech.
// Idempotent: tech_sms_log unique index (kind, booking_id, technician_id,
// to_phone) for jobday/leave_now/late/late_alert — a row is claimed BEFORE the
// send, so overlapping cron triggers can never double-text.
import { sendSMSResult, toE164 } from './sms.js';
import { signToken } from './auth.js';
import { leadAlertRecipients } from './lead-alert-recipients.js';

const MIN = 60000;
const CITY_TZ = { denver: 'Asia/Manila', golden: 'Asia/Manila', aurora: 'Asia/Manila', houston: 'Asia/Manila', austin: 'Asia/Manila',
  dallas: 'Asia/Manila', 'fort worth': 'Asia/Manila', 'dallas-fort worth': 'Asia/Manila', dfw: 'Asia/Manila', 'oklahoma city': 'Asia/Manila',
  tulsa: 'Asia/Manila', 'san antonio': 'Asia/Manila', 'los angeles': 'Asia/Manila', phoenix: 'Asia/Manila' };

function baseUrl() {
  return (process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
}

export function jobTz(j) {
  if (j.service_area?.timezone) return j.service_area.timezone;
  const c = CITY_TZ[String(j.city || '').trim().toLowerCase()];
  if (c) return c;
  const z = String(j.postal_code || '');
  if (/^8[01]/.test(z)) return 'Asia/Manila';
  if (/^7[3-8]/.test(z)) return 'Asia/Manila';
  if (/^9[0-6]/.test(z)) return 'Asia/Manila';
  if (/^85/.test(z)) return 'Asia/Manila';
  const st = String(j.state || '').toUpperCase();
  if (st === 'TX' || st === 'OK') return 'Asia/Manila';
  if (st === 'CA') return 'Asia/Manila';
  return 'Asia/Manila';
}
const localDay = (ms, tz) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz });
function localMin(ms, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
  const g = (t) => Number((p.find(x => x.type === t) || {}).value || 0);
  return (g('hour') % 24) * 60 + g('minute');
}
export const clock = (iso, tz) => new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).replace(':00', '');
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'Customer';
const addr = (j) => [j.address_line1, j.city].filter(Boolean).join(', ') || 'address in the app';

// YES / Y / OK / thumbs-up, optionally followed by an ETA ("yes 15 min").
const THUMBS = String.fromCodePoint(0x1F44D);
export function isYes(body) {
  const s = String(body || '').trim().toLowerCase();
  if (!s) return false;
  if (s.startsWith(THUMBS)) return true;
  return /^(yes|yeah|yep|y|ok|okay|k)\b/.test(s);
}

// Claim the log row first; a unique violation means another run already has it.
async function claim(db, row) {
  const { data, error } = await db.from('tech_sms_log').insert({ status: 'pending', ...row }).select('id').maybeSingle();
  if (error) { if (/duplicate|unique/i.test(error.message || '')) return null; throw error; }
  return data && data.id;
}
async function settle(db, ids, r) {
  if (!ids.length) return;
  await db.from('tech_sms_log').update(r.ok ? { status: 'sent', sent_at: new Date().toISOString() }
    : r.skipped ? { status: 'skipped', skip_reason: r.skipped } : { status: 'failed', error: String(r.error || '').slice(0, 500) }).in('id', ids);
}
function statusCb(id) {
  return id ? { statusCallback: `${baseUrl()}/api/analytics?action=sms_status&token=${encodeURIComponent(signToken({ kind: 'tech_sms', tech_sms_log_id: id }, 86400))}` } : {};
}

const JOB_COLS = `id, status, scheduled_at, technician_id, secondary_technician_id, business_id, on_the_way_at, metadata,
  address_line1, city, state, postal_code, customer:customers ( name ), business:businesses ( slug ), service_area:service_areas ( timezone )`;

export async function runTechReminders(db, { dryRun = false, now = Date.now(), send = sendSMSResult } = {}) {
  const out = { jobday: [], leave_now: [], tomorrow: [], late_alert: [], skipped: [] };
  const q = await db.from('bookings').select(JOB_COLS)
    .not('status', 'in', '(cancelled,no_show,completed)')
    .gte('scheduled_at', new Date(now - 3 * 3600000).toISOString()).lt('scheduled_at', new Date(now + 40 * 3600000).toISOString())
    .order('scheduled_at', { ascending: true });
  if (q.error) throw q.error;
  const jobs = (q.data || []).map(j => ({ ...j, tz: jobTz(j), at: Date.parse(j.scheduled_at) }));

  const techIds = [...new Set(jobs.flatMap(j => [j.technician_id, j.secondary_technician_id]).filter(Boolean))];
  const techs = new Map();
  if (techIds.length) {
    const { data, error } = await db.from('technicians').select('id, name, phone, active, status').in('id', techIds);
    if (error) throw error;
    for (const t of data || []) techs.set(t.id, t);
  }
  const ok = (t) => t && t.active !== false && t.status !== 'off' && toE164(t.phone || '');
  const pairs = [];
  for (const j of jobs) for (const id of [j.technician_id, j.secondary_technician_id].filter(Boolean)) pairs.push({ j, t: techs.get(id), techId: id });

  // Already-logged keys, so dry runs report truthfully and live runs skip fast.
  const ids = jobs.map(j => j.id);
  const done = new Set();
  if (ids.length) {
    const { data } = await db.from('tech_sms_log').select('kind, booking_id, technician_id').in('kind', ['jobday', 'leave_now']).in('booking_id', ids);
    for (const r of data || []) done.add(`${r.kind}|${r.booking_id}|${r.technician_id}`);
  }
  const isDone = (k, j, t) => done.has(`${k}|${j.id}|${t}`);
  const link = `${baseUrl()}/tech.html`;
  const active = (j) => !j.on_the_way_at && !['on_the_way', 'in_progress', 'completed'].includes(j.status);

  // ── 1+2. 7 AM job-day text, with any leave-now due right now merged in ─────
  const dayGroups = new Map();
  for (const p of pairs) {
    const { j } = p;
    if (localDay(j.at, j.tz) !== localDay(now, j.tz)) continue;
    const m = localMin(now, j.tz);
    if (m < 420 || m >= 480 || j.at <= now) continue;   // 7:00-7:59 local, jobs still ahead
    if (isDone('jobday', j, p.techId)) continue;
    const key = `${p.techId}|${j.tz}`;
    if (!dayGroups.has(key)) dayGroups.set(key, []);
    dayGroups.get(key).push(p);
  }
  const leaveDue = () => false;   // leave-now lives in tech-late.js stage 1 now
  const merged = new Set();
  for (const [, list] of dayGroups) {
    const t = list[0].t;
    if (!ok(t)) { out.skipped.push({ techId: list[0].techId, why: 'no phone / inactive' }); continue; }
    const tz = list[0].j.tz;
    // Owner 2026-10-21: just a numbered list of cities.
    const lines = list.slice().sort((a, b) => new Date(a.j.scheduled_at) - new Date(b.j.scheduled_at)).map((p, i) => `${i + 1}. ${p.j.city || 'See app'}`);
    const lead = list.find(leaveDue);
    const msg = (lead ? `Leave now for ${clock(lead.j.scheduled_at, tz)} - ${addr(lead.j)}\n\n` : '')
      + `Today's job${list.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n\nDetails: ${link}`;
    if (dryRun) { out.jobday.push({ tech: t.name, msg }); if (lead) merged.add(lead); continue; }
    const claimed = [];
    for (const p of list) { const id = await claim(db, { kind: 'jobday', booking_id: p.j.id, technician_id: p.techId, business_id: p.j.business_id, to_phone: t.phone }); if (id) claimed.push(id); }
    if (!claimed.length) continue;
    let leadId = null;
    if (lead) { leadId = await claim(db, { kind: 'leave_now', booking_id: lead.j.id, technician_id: lead.techId, business_id: lead.j.business_id, to_phone: t.phone }); merged.add(lead); }
    const r = await send(t.phone, msg, statusCb(claimed[0]));
    await settle(db, leadId ? [...claimed, leadId] : claimed, r);
    out.jobday.push({ tech: t.name, jobs: list.length, merged_leave_now: !!lead, ...(r.ok ? {} : { why: r.skipped || r.error }) });
  }

  // ── 2. 1 hour before each job ─────────────────────────────────────────────
  for (const p of pairs) {
    if (merged.has(p) || !leaveDue(p)) continue;
    if (!ok(p.t)) { out.skipped.push({ techId: p.techId, why: 'no phone / inactive' }); continue; }
    const msg = `Leave now for ${clock(p.j.scheduled_at, p.j.tz)} - ${addr(p.j)}\n\nDetails: ${link}`;
    if (dryRun) { out.leave_now.push({ tech: p.t.name, msg }); continue; }
    const id = await claim(db, { kind: 'leave_now', booking_id: p.j.id, technician_id: p.techId, business_id: p.j.business_id, to_phone: p.t.phone });
    if (!id) continue;
    const r = await send(p.t.phone, msg, statusCb(id));
    await settle(db, [id], r);
    out.leave_now.push({ tech: p.t.name, ...(r.ok ? {} : { why: r.skipped || r.error }) });
  }

  // ── 3. 7 PM local "tomorrow" digest (owner's 2026-09-29 wording) ──────────
  const tmr = new Map();
  for (const p of pairs) {
    const { j } = p;
    const m = localMin(now, j.tz);
    if (m < 1140 || m >= 1200) continue;   // 7:00-7:59 PM local
    if (localDay(j.at, j.tz) !== localDay(now + 86400000, j.tz)) continue;
    if (!tmr.has(p.techId)) tmr.set(p.techId, []);
    tmr.get(p.techId).push(p);
  }
  for (const [techId, list] of tmr) {
    const t = list[0].t;
    if (!ok(t)) { out.skipped.push({ techId, why: 'no phone / inactive' }); continue; }
    const { data: already } = await db.from('tech_sms_log').select('id').eq('technician_id', techId).eq('kind', 'tomorrow')
      .gte('created_at', new Date(now - 20 * 3600000).toISOString()).limit(1);
    if (already && already.length) continue;
    const msg = `You have ${list.length} job${list.length === 1 ? '' : 's'} tomorrow.\n\nDetails: ${link}`;
    if (dryRun) { out.tomorrow.push({ tech: t.name, msg }); continue; }
    const id = await claim(db, { kind: 'tomorrow', booking_id: list[0].j.id, technician_id: techId, business_id: list[0].j.business_id, to_phone: t.phone });
    const r = await send(t.phone, msg, statusCb(id));
    await settle(db, id ? [id] : [], r);
    out.tomorrow.push({ tech: t.name, jobs: list.length, ...(r.ok ? {} : { why: r.skipped || r.error }) });
  }

  // ── 4. Late text with no YES within 10 min -> covering secretaries ────────
  const { data: lates, error: lErr } = await db.from('tech_sms_log')
    .select('id, booking_id, technician_id, created_at, confirmed_at, status')
    .eq('kind', 'late').is('confirmed_at', null).not('status', 'in', '(skipped,failed)')
    .lte('created_at', new Date(now - 10 * MIN).toISOString())   // owner 2026-10-21: 10 min.gte('created_at', new Date(now - 3 * 3600000).toISOString());
  if (lErr) throw lErr;
  for (const l of lates || []) {
    const { data: b } = await db.from('bookings').select(JOB_COLS).eq('id', l.booking_id).maybeSingle();
    if (!b || ['cancelled', 'no_show', 'completed'].includes(b.status) || !active(b) || b.metadata?.late_reported_at) continue;
    const { data: t } = await db.from('technicians').select('name').eq('id', l.technician_id).maybeSingle();
    const tz = jobTz(b);
    const msg = `${first(t?.name) === 'Customer' ? 'Tech' : first(t?.name)} is late for ${clock(b.scheduled_at, tz)} job and hasn't replied - call him`;
    const recips = await leadAlertRecipients(db, b.business?.slug || '');
    if (dryRun) { out.late_alert.push({ to: recips.map(r => r.name), msg }); continue; }
    const sentTo = [];
    for (const rc of recips) {
      const id = await claim(db, { kind: 'late_alert', booking_id: b.id, technician_id: l.technician_id, business_id: b.business_id, to_phone: rc.phone });
      if (!id) continue;
      const r = await send(rc.phone, msg, {});
      await settle(db, [id], r);
      if (r.ok) sentTo.push(rc.name);
    }
    if (sentTo.length) out.late_alert.push({ booking: b.id, to: sentTo });
  }
  return out;
}

// Inbound text from a tech's phone: a YES marks their open late text(s)
// confirmed. Returns the number of rows confirmed (0 = not a tech / not YES).
export async function confirmTechReply(db, fromPhone, body) {
  if (!isYes(body)) return 0;
  const e164 = toE164(fromPhone || '');
  if (!e164) return 0;
  const { data: techs } = await db.from('technicians').select('id, phone').eq('active', true);
  const ids = (techs || []).filter(t => toE164(t.phone || '') === e164).map(t => t.id);
  if (!ids.length) return 0;
  const { data } = await db.from('tech_sms_log')
    .update({ confirmed_at: new Date().toISOString(), reply_body: String(body).slice(0, 300) })
    .eq('kind', 'late').in('technician_id', ids).is('confirmed_at', null)
    .gte('created_at', new Date(Date.now() - 6 * 3600000).toISOString()).select('id');
  return (data || []).length;
}
