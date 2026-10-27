import { paymentState } from './payroll.js';
import { allowedSlugsFor, mayUseBusiness, SECRETARY_EXTRA_BUSINESSES } from './staff-access.js';
const pipelineWriteSlugsFor = (auth) => { if (auth && auth.role === 'auditor') return []; const a = allowedSlugsFor(auth); return a === null ? null : [auth.scope, ...(SECRETARY_EXTRA_BUSINESSES[auth.scope] || [])].filter(Boolean); };
const pipelineSlugsFor = (auth) => ((auth && ((auth.role === 'secretary' && auth.scope === 'doms' && auth.name === 'Joey') || auth.role === 'auditor')) ? null : pipelineWriteSlugsFor(auth));
import { localDayStartUTC } from './time.js';
export const isReviewCard = (c) => !!c && !!c.st && (c.st.stage === 'paid' || (c.st.stage === 'booked' && !!c.st.doneUnpaid));
export const reviewAllFor = (auth) => !!auth && auth.role === 'secretary';

export const PIPELINE_FLOOR = '2026-09-22T15:00:00Z';
export const LOST_REASONS = ['Too expensive', 'Went with someone else', 'Just shopping', 'Out of area', "We don't do that", 'No reply after estimate', 'Never reached', 'Spam', 'Other'];
export const STAGES = ['new', 'talked', 'quoted', 'booked', 'completed', 'paid', 'lost'];

const TOLL_FREE = '0000000000';
const LA_LINES = new Set(['0000000000', '0000000000', '0000000000']);
const HEATHER_OLD_PHONE = '0000000000';
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const LEAK_AFTER_MS = HOUR;
const QUOTE_LOST_MS = 7 * DAY;
const CALL_TODAY_MS = 12 * HOUR;
const NEVER_REACHED_MS = 48 * HOUR;
const NEW_CALLBACK_MS = 30 * 60 * 1000;
const NEVER_REACHED_TRIES = 2;
const SOFT_REVIVE_MS = 14 * DAY;
const NEW_CARD_GAP_MS = 30 * DAY;
const TALK_MIN_SEC = 20;
const TALK_SURE_SEC = 120;
const IN_PROGRESS_MS = 30 * MIN;
const ATTEMPT_PENDING_MS = 5 * MIN;
const LOOKBACK_DAYS = 120;
const CARD_CAP = 600;
const TIMELINE_CAP = 40;
const AUTO_TEXT_OTHER_CAP = 3;
const CHICAGO = 'Asia/Manila';
const RANGE_DAYS = { today: 0, 2: 1, 3: 2, yesterday: 1, 7: 6, 30: 29 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD_KEY = /^c_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEST_NAME = /\(ignore\)|e2e test/i;
const SPAM_TEXT = /https?:\/\/|www\.|apps\.apple|play\.google|download .*free|\bupfront\b|\bour (system|director|platform)\b|\bproviders?\b.*\bjoin\b|\bleads? (for|to) (you|your)\b|\bW-?9\b|\bSEO\b|google (listing|ranking|reviews? for your)|\bmerchant\b|\bfunding\b|\bbusiness loan\b|\bgrow your business\b|reply stop to (opt|unsub)/i;
const REPEATED = /^(\d)\1{9}$/;

function msOf(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  const n = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}
const iso = (n) => (n == null ? null : new Date(n).toISOString());
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const cents = (n) => Math.round(Number(n) * 100) / 100;
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const clean = (s, max) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').slice(0, max);
function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

export function phone10(p) {
  const s = String(p == null ? '' : p).replace(/\s*(?:ext\.?|extension|x)\s*\d+\s*$/i, '');
  const d = s.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? d : '';
}
function strictPhone(p) {
  const d = String(p == null ? '' : p).replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 11 && d[0] === '1') return d.slice(1);
  return '';
}
export function prettyPhone10(d) {
  return d && d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
}
export function phoneVariants(d) {
  return [d, '+1' + d, '1' + d, `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`, `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`];
}
const DOMS_FAMILY = new Set(['doms', ...(SECRETARY_EXTRA_BUSINESSES.doms || [])]);
const HA_FAMILY = new Set(['tidyhaus', ...(SECRETARY_EXTRA_BUSINESSES['tidyhaus'] || [])]);
export function familyOf(slug) {
  if (!slug) return null;
  if (DOMS_FAMILY.has(slug)) return 'doms';
  return HA_FAMILY.has(slug) ? 'tidyhaus' : 'owner';
}
function fmtDur(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
function fmtAgo(ms) {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m}m`;
  const h = Math.round(ms / HOUR);
  return h < 48 ? `${h}h` : `${Math.round(ms / DAY)}d`;
}
const dollars = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
function realName(s) {
  const t = clean(s, 80);
  return t && !/^[\d\s()+.\-]+$/.test(t) ? capName(t) : null;
}
function capName(t) { return t.includes('@') ? t : t.replace(/(^|[\s.\-]|\b[Oo]')([a-z])/g, (m, a, b) => a + b.toUpperCase()); }
function lineTotal(items) {
  let sum = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const q = it && (it.qty != null ? it.qty : it.quantity);
    const qty = Number.isFinite(Number(q)) && Number(q) > 0 ? Number(q) : (q == null ? 1 : 0);
    sum += qty * (Number(it && it.unit_price) || 0);
  }
  return cents(sum);
}
function autoKind(body) {
  if (/sorry we missed your call/i.test(body)) return 'missed_call';
  if (/here.s your estimate/i.test(body)) return 'estimate';
  if (/you.re booked/i.test(body)) return 'booked';
  if (/thanks for your text/i.test(body)) return 'ack';
  if (/en route/i.test(body)) return 'en_route';
  if (/how did we do|review/i.test(body)) return 'review';
  return 'other';
}
const TYPE_RANK = { call_in: 0, text_in: 1, wizard: 2, estimate: 3, booking: 4, attempt: 5, text_out_staff: 6, text_auto: 7 };
function byTime(a, b) {
  return (a.atMs - b.atMs) || ((TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9)) || String(a.id).localeCompare(String(b.id));
}
const isCustomerTouch = (t) => t.type === 'call_in' || t.type === 'text_in' || t.type === 'wizard';

export function makeContext(raw) {
  const bizById = new Map(), bizBySlug = new Map();
  for (const b of raw.businesses || []) { bizById.set(b.id, b); bizBySlug.set(b.slug, b); }
  const lines = new Map();
  for (const l of raw.tracking || []) {
    const p = phone10(l.phone); if (!p) continue;
    lines.set(p, { phone: p, slug: l.business_slug || null, name: l.display_name || null, market: l.market || null, active: l.active !== false });
  }
  const handsetName = new Map(), handsetsOf = new Map();
  const addHandset = (p, name) => {
    if (!p || !name) return;
    handsetName.set(p, name);
    if (!handsetsOf.has(name)) handsetsOf.set(name, new Set());
    handsetsOf.get(name).add(p);
  };
  for (const s of raw.staff || []) addHandset(phone10(s.phone), s.name);
  addHandset(HEATHER_OLD_PHONE, 'Heather');
  const excluded = new Set([TOLL_FREE, ...handsetName.keys(), ...lines.keys()]);
  for (const r of raw.silent || []) { const p = phone10(r.phone); if (p) excluded.add(p); }
  for (const r of raw.blocked || []) { const p = phone10(r.phone); if (p) excluded.add(p); }
  const slugOf = (row) => (row && row.business && row.business.slug) || (row && bizById.get(row.business_id) && bizById.get(row.business_id).slug) || null;
  const isExcluded = (p) => !p || excluded.has(p) || REPEATED.test(p) || /^(800|833|844|855|866|877|888)/.test(p);
  return { bizById, bizBySlug, lines, handsetName, handsetsOf, slugOf, isExcluded };
}

export function buildTouches(raw, ctx = makeContext(raw), now = Date.now()) {
  const nowMs = msOf(now);
  const talkIds = new Set(), noTalkIds = new Set();
  for (const m of raw.marks || []) {
    for (const id of m.talk_call_ids || []) talkIds.add(id);
    for (const id of m.no_talk_call_ids || []) noTalkIds.add(id);
  }
  const skipIds = new Set((raw.auditSkips || []).map((s) => s.call_id));
  const bookingById = new Map((raw.bookings || []).map((b) => [b.id, b]));
  const estimateById = new Map((raw.estimates || []).map((e) => [e.id, e]));
  const estimatesByCall = new Map();
  for (const e of raw.estimates || []) if (e.call_id) (estimatesByCall.get(e.call_id) || estimatesByCall.set(e.call_id, []).get(e.call_id)).push(e);
  const eventsByCall = new Map();
  for (const ev of raw.callEvents || []) (eventsByCall.get(ev.call_id) || eventsByCall.set(ev.call_id, []).get(ev.call_id)).push(ev);
  const touches = [], noPhone = [];
  const calls = raw.calls || [];

  const inbound = [];
  for (const c of calls) {
    if (c.kind !== 'inbound' || (c.source && c.source !== 'twilio')) continue;
    if (c.status === 'ignored' && c.handled_by === 'Blocked number') continue;
    if (LA_LINES.has(phone10(c.grasshopper_number))) continue;
    const phone = strictPhone(c.caller_phone);
    if (ctx.isExcluded(phone)) continue;
    const atMs = msOf(c.occurred_at); if (atMs == null) continue;
    const lineP = phone10(c.grasshopper_number); const line = ctx.lines.get(lineP);
    const slug = ctx.slugOf(c) || (line && line.slug) || null;
    const biz = slug && ctx.bizBySlug.get(slug);
    const live = c.answered == null && c.duration_sec == null && !!phone10(c.forwarded_to) && c.status !== 'ignored';
    inbound.push({ c, id: c.id, phone, slug, family: familyOf(slug), atMs, fwd: phone10(c.forwarded_to), line: lineP || null,
      lineName: (line && line.name) || (biz && biz.name) || null, inProgress: live && nowMs - atMs < IN_PROGRESS_MS });
  }
  const inboundById = new Map(inbound.map((x) => [x.id, x]));

  const wizardLinked = new Set();
  for (const live of calls) {
    if (live.kind !== 'live') continue;
    if (live.reached_step === 'greet' && !live.resolution && !live.booking_id) continue;
    const atMs = msOf(live.occurred_at); if (atMs == null) continue;
    const evs = eventsByCall.get(live.id) || [];
    const started = evs.find((e) => e.event === 'started');
    const person = (started && started.actor) || live.handled_by || null;
    const slug = ctx.slugOf(live), family = familyOf(slug);
    let phone = phone10(live.caller_phone);
    if (!phone && live.booking_id) { const b = bookingById.get(live.booking_id); phone = phone10(b && b.customer && b.customer.phone); }
    if (!phone) for (const ev of evs) {
      if (ev.event !== 'estimate_sent') continue;
      const e = estimateById.get(ev.meta && ev.meta.estimate_id);
      const p = e && phone10(e.customer_phone); if (p) { phone = p; break; }
    }
    if (!phone) for (const e of estimatesByCall.get(live.id) || []) { const p = phone10(e.customer_phone); if (p) { phone = p; break; } }
    let link = live.inbound_call_id ? inboundById.get(live.inbound_call_id) || null : null;
    if (link && phone && link.phone !== phone) link = null;
    if (!link) link = matchInbound(inbound, ctx, person, family, atMs, phone, nowMs);
    if (link) { wizardLinked.add(link.id); if (!phone) phone = link.phone; }
    if (phone && ctx.isExcluded(phone)) continue;
    const t = { type: 'wizard', id: live.id, atMs, phone: phone || null, slug, family, canOpen: true, staff: person, talk: 'yes', endMs: atMs,
      live: { resolution: live.resolution || null, step: live.reached_step || null, quoted: num(live.quoted_total), bookingId: live.booking_id || null, inboundId: link ? link.id : null } };
    if (phone) touches.push(t); else noPhone.push(t);
  }

  for (const x of inbound) {
    const c = x.c, dur = num(c.duration_sec);
    let talk = null, why;
    if (c.answered === false) why = 'missed';
    else if (c.answered == null && !x.inProgress) why = 'no_person';
    else if (talkIds.has(x.id)) { talk = 'yes'; why = 'marked_talk'; }
    else if (noTalkIds.has(x.id)) why = 'marked_voicemail';
    else if (skipIds.has(x.id)) why = 'audit_voicemail';
    else if (c.answered == null) { talk = wizardLinked.has(x.id) ? 'yes' : 'unconfirmed'; why = 'in_progress'; }
    else if (dur != null && dur < TALK_MIN_SEC) why = 'short';
    else if (wizardLinked.has(x.id)) { talk = 'yes'; why = 'wizard'; }
    else if (dur != null && dur >= TALK_SURE_SEC) { talk = 'yes'; why = 'long'; }
    else { talk = 'unconfirmed'; why = 'unconfirmed'; }
    touches.push({ type: 'call_in', id: x.id, atMs: x.atMs, phone: x.phone, slug: x.slug, family: x.family, canOpen: true,
      staff: ctx.handsetName.get(x.fwd) || null, talk, why, dur, answered: c.answered, line: x.line, lineName: x.lineName,
      endMs: x.atMs + (dur || 0) * 1000, wizard: wizardLinked.has(x.id), rec: !!c.recording_url,
      vm: (c.answered === false && !!c.recording_url) || why === 'marked_voicemail' || why === 'audit_voicemail',
      summary: c.transcript_summary && Array.isArray(c.transcript_summary.items) ? c.transcript_summary.items.map((i) => String(i && i.text || '')).filter(Boolean).slice(0, 4) : null,
      promise: c.transcript_summary && Array.isArray(c.transcript_summary.items) ? ((c.transcript_summary.items.find((i) => i && i.kind === 'we_promised') || {}).text || null) : null });
  }

  for (const m of raw.messages || []) {
    const phone = phone10(m.customer_phone); if (ctx.isExcluded(phone)) continue;
    if (LA_LINES.has(phone10(m.our_phone))) continue;
    const atMs = msOf(m.created_at); if (atMs == null) continue;
    const our = phone10(m.our_phone); const line = ctx.lines.get(our);
    const slug = ctx.slugOf(m) || (line && line.slug) || null;
    const body = String(m.body || '').replace(/\s+/g, ' ').trim();
    const base = { id: m.id, atMs, phone, slug, family: familyOf(slug), our: our || null, lineName: (line && line.name) || null, body, endMs: atMs };
    if (m.direction === 'in') {
      touches.push({ ...base, type: 'text_in', canOpen: !!line && our !== TOLL_FREE && !SPAM_TEXT.test(body) });
    } else if (!m.sent_by || m.sent_by === 'automated') {
      touches.push({ ...base, type: 'text_auto', canOpen: false, auto: autoKind(body), failed: m.status === 'failed' || m.status === 'undelivered' });
    } else {
      touches.push({ ...base, type: 'text_out_staff', canOpen: false, staff: m.sent_by });
    }
  }

  for (const e of raw.estimates || []) {
    const stamps = [e.texted_at, e.emailed_at, e.contacted_at].map(msOf).filter((v) => v != null);
    const archivedUnsent = (e.status === 'expired' || e.status === 'lost') && !stamps.length;
    const slug = ctx.slugOf(e);
    let phone = phone10(e.customer_phone);
    if (!phone) {
      const linkedIds = new Set(e.call_id ? [e.call_id] : []);
      for (const ev of raw.callEvents || []) if (ev.event === 'estimate_sent' && ev.meta?.estimate_id === e.id) linkedIds.add(ev.call_id);
      const phones = new Set(touches.filter(t => (t.type === 'wizard' || t.type === 'call_in') && linkedIds.has(t.id) && t.family === familyOf(slug)).map(t => t.phone).filter(Boolean));
      if (phones.size === 1) phone = [...phones][0];
    }
    if (ctx.isExcluded(phone)) continue;
    if (TEST_NAME.test(e.customer_name || '')) continue;
    const atMs = msOf(e.created_at); if (atMs == null) continue;
    const sent = ['sent', 'approved', 'booked'].includes(e.status) || stamps.length > 0;
    const sentMs = !sent ? null : e.source === 'manual' ? atMs : (stamps.length ? Math.min(...stamps) : atMs);
    const sub = lineTotal(e.line_items);
    const total = num(e.approved_total) ?? cents(sub + Math.round(sub * (Number(e.tax_rate) || 0) * 100) / 100);
    const opened = [msOf(e.text_opened_at), msOf(e.email_opened_at)].filter((v) => v != null);
    touches.push({ type: 'estimate', id: e.id, atMs, phone, slug, family: familyOf(slug), canOpen: true, name: realName(e.customer_name), endMs: atMs, loc: { state: e.customer_state || null, zip: e.customer_zip || null, city: e.customer_city || null },
      ...(archivedUnsent ? { archivedUnsent: true } : {}),
      est: { source: e.source || null, status: e.status || null, sentMs,
        webRequest: (e.source === 'widget' || e.source === 'website_form') && e.status === 'unsent' && !sent,
        approvedMs: archivedUnsent ? null : msOf(e.approved_at),
        declinedMs: e.status === 'out_of_area' ? (msOf(e.updated_at) ?? atMs) : null,
        closedMs: e.status === 'expired' || e.status === 'lost' ? (msOf(e.updated_at) ?? atMs) : null,
        total: total > 0 ? total : null, openedMs: opened.length ? Math.min(...opened) : null,
        couponMs: msOf(e.followup_emailed_at), callId: e.call_id || null, label: e.service_label || null, bounced: e.email_status === 'bounced',
        items: (Array.isArray(e.line_items) ? e.line_items : []).slice(0, 30).map((it) => ({ name: String((it && (it.name || it.description)) || 'Item').slice(0, 120), qty: Number(it && (it.qty ?? it.quantity)) || 1, price: Number(it && it.unit_price) || 0 })) } });
  }

  for (const b of raw.bookings || []) {
    if (b.source === 'import') continue;
    const phone = phone10(b.customer && b.customer.phone); if (ctx.isExcluded(phone)) continue;
    if (TEST_NAME.test((b.customer && b.customer.name) || '')) continue;
    const atMs = msOf(b.created_at); if (atMs == null) continue;
    const slug = ctx.slugOf(b);
    const completed = b.status === 'completed';
    const completedMs = completed ? (msOf(b.completed_at) ?? msOf(b.paid_at) ?? msOf(b.updated_at) ?? atMs) : null;
    const paid = completed && paymentState(b) !== 'deferred';
    const paidAt = msOf(b.paid_at);
    const paidMs = paid ? Math.max(completedMs, paidAt ?? completedMs) : null;
    const cancelledMs = b.status === 'cancelled' ? (msOf(b.cancelled_at) ?? msOf(b.updated_at) ?? atMs) : null;
    const md = b.metadata || {};
    touches.push({ type: 'booking', id: b.id, atMs, phone, slug, family: familyOf(slug), canOpen: true, name: realName(b.customer && b.customer.name), endMs: atMs, loc: { state: b.state || null, zip: b.postal_code || null, city: b.city || null },
      staff: md.booked_by || null,
      bk: { status: b.status || null, source: b.source || null, scheduledMs: msOf(b.scheduled_at), price: num(b.price), amountPaid: num(b.amount_paid),
        paid, paidMs, completedMs, cancelledMs, tech: (b.technician && b.technician.name) || null,
        estimateId: md.source_estimate_id || null, bookedBy: md.booked_by || null,
        reviewMs: msOf(b.reviewed_at) ?? msOf(b.review_clicked_at), reviewRating: num(b.review_rating),
        gotReview: !!(b.reviewed_at || num(b.review_rating)),
        offerSent: !!(md.loyalty_offer && md.loyalty_offer.sent_at),
        rv: { sms_sent: b.review_sms_sent_at || null, sms_delivered: b.review_sms_delivered_at || null, sms_status: b.review_sms_status || null, sms_clicked: b.review_sms_clicked_at || null,
          email_sent: b.review_email_sent_at || null, email_count: b.review_email_count || 0, email_delivered: b.review_email_delivered_at || null, email_status: b.review_email_status || null, email_clicked: b.review_email_clicked_at || null,
          page_opened: b.review_clicked_at || null, call_status: b.review_call_status || null, call_at: b.review_call_at || null, call_by: b.review_call_by || null } } });
  }

  for (const a of raw.attempts || []) {
    const phone = phone10(a.phone); if (ctx.isExcluded(phone)) continue;
    const atMs = msOf(a.started_at); if (atMs == null) continue;
    const slug = ctx.slugOf(a);
    const dur = num(a.duration_sec);
    touches.push({ type: 'attempt', id: a.id, atMs, phone, slug, family: familyOf(slug), canOpen: false, staff: a.staff_name || null,
      cardKey: CARD_KEY.test(a.card_key || '') ? a.card_key : null, talk: a.talked === true ? 'yes' : null, endMs: atMs + (dur || 0) * 1000,
      att: { talked: a.talked == null ? null : !!a.talked, dur, source: a.source || null, staffStatus: a.staff_status || null,
        dialStatus: a.dial_status || null, endedMs: msOf(a.ended_at), setBy: a.talked_set_by || null,
        noRing: !!a.staff_status && a.staff_status !== 'completed' && a.talked !== true } });
  }

  touches.sort(byTime);
  const firstFam = new Map(), lastFam = new Map();
  for (const t of touches) if (t.family && !firstFam.has(t.phone)) firstFam.set(t.phone, t.family);
  for (const t of touches) {
    if (t.family) { lastFam.set(t.phone, t.family); continue; }
    t.family = lastFam.get(t.phone) || firstFam.get(t.phone) || (t.canOpen ? 'tidyhaus' : null);
  }
  return { touches: touches.filter((t) => t.family), noPhone, ctx };
}

function matchInbound(inbound, ctx, person, family, atMs, phone, nowMs) {
  const hs = person ? ctx.handsetsOf.get(person) : null;
  if (!hs) return null;
  let best = null;
  for (const x of inbound) {
    if (!hs.has(x.fwd) || x.family !== family) continue;
    if (x.c.answered === true) { const d = num(x.c.duration_sec); if (d != null && d < TALK_MIN_SEC) continue; }
    else if (!(x.c.answered == null && x.inProgress)) continue;
    if (x.atMs < atMs - 10 * MIN || x.atMs > atMs + MIN) continue;
    if (phone && x.phone !== phone) continue;
    if (!best || x.atMs > best.atMs) best = x;
  }
  return best;
}

function talksOf(S) {
  const out = []; let texted = false;
  for (const t of S) {
    if (t.type === 'text_in') texted = true;
    if (t.type === 'wizard') out.push({ t, atMs: t.atMs, endMs: t.atMs, sure: true });
    else if (t.type === 'call_in' && t.talk) out.push({ t, atMs: t.atMs, endMs: t.endMs, sure: t.talk === 'yes' });
    else if (t.type === 'attempt' && t.talk === 'yes') out.push({ t, atMs: t.atMs, endMs: t.endMs, sure: true });
    else if (t.type === 'text_out_staff' && texted) out.push({ t, atMs: t.atMs, endMs: t.atMs, sure: true });
  }
  return out;
}
function isFailedTry(t, atMs) {
  const a = t.att;
  if (a.talked === true || a.noRing) return false;
  if (a.talked == null && a.endedMs == null && atMs - t.atMs < ATTEMPT_PENDING_MS) return false;
  return true;
}
function lastReply(S, afterMs) {
  let last = null;
  for (const t of S) if (t.atMs > afterMs && (isCustomerTouch(t) || (t.type === 'attempt' && t.talk === 'yes'))) last = t.atMs;
  return last;
}
function openCallback(S, sinceMs) {
  let pending = null;
  for (const t of S) {
    if (t.atMs <= sinceMs) continue;
    if ((t.type === 'call_in' && !t.talk) || (t.type === 'text_in' && t.canOpen)) pending = t;
    else if (pending && ((t.type === 'wizard' && t.live.inboundId !== pending.id) || (t.type === 'call_in' && t.talk) || (t.type === 'attempt' && t.talk === 'yes') || t.type === 'text_out_staff')) pending = null;
  }
  return pending;
}

export function evalStage(card, at, mark) {
  const atMs = msOf(at);
  const T = card.touches.filter((t) => !t.timelineOnly && t.atMs <= atMs);
  const m = mark || null;
  if (m && m.not_a_lead) {
    const n = msOf(m.not_a_lead_at);
    if (n == null || n <= atMs) return { stage: 'hidden', stageMs: n ?? card.openedMs };
  }
  const r = m ? msOf(m.reopened_at) : null;
  const reop = r != null && r <= atMs ? r : null;
  const lostMs = m && m.lost_reason ? msOf(m.lost_at) : null;
  if (lostMs != null && lostMs <= atMs && !(reop != null && reop >= lostMs)) {
    return { stage: 'lost', stageMs: lostMs, lost: { reason: m.lost_reason, auto: false, note: m.lost_note || '', by: m.lost_by || null, atMs: lostMs } };
  }
  const autoLost = (reason, whenMs) => (reop != null && reop >= whenMs) ? null
    : { stage: 'lost', stageMs: whenMs, lost: { reason, auto: true, note: '', by: null, atMs: whenMs } };

  let S = T;
  const bks = T.filter((t) => t.type === 'booking');
  if (bks.length) {
    const standing = bks.filter((t) => t.bk.cancelledMs == null || t.bk.cancelledMs > atMs);
    if (standing.length) {
      const b = standing[standing.length - 1];
      if (b.bk.paidMs != null && b.bk.paidMs <= atMs) return { stage: 'paid', stageMs: b.bk.paidMs, booking: b };
      if (b.bk.completedMs != null && b.bk.completedMs <= atMs) return { stage: 'booked', doneUnpaid: true, stageMs: b.bk.completedMs, booking: b, callback: openCallback(T, b.bk.completedMs) };
      return { stage: 'booked', stageMs: b.atMs, booking: b, callback: openCallback(T, b.atMs) };
    }
    const lastCancel = Math.max(...bks.map((t) => t.bk.cancelledMs));
    const after = T.filter((t) => t.atMs > lastCancel && t.type !== 'booking');
    if (!after.some((t) => (t.type === 'estimate' && !t.archivedUnsent) || t.type === 'call_in' || t.type === 'wizard' || (t.type === 'text_in' && t.canOpen))) {
      const l = autoLost('Job cancelled', lastCancel); if (l) return l;
      S = T.filter((t) => t.type !== 'booking');
    } else S = after;
  }
  const ests = S.filter((t) => t.type === 'estimate' && !t.archivedUnsent);
  const approved = ests.filter((t) => t.est.approvedMs != null && t.est.approvedMs <= atMs);
  if (approved.length) {
    const e = approved[approved.length - 1];
    return { stage: 'booked', stageMs: e.est.approvedMs, estimate: e, approvedNoJob: true, callback: openCallback(T, e.est.approvedMs) };
  }
  const lastEst = ests[ests.length - 1];
  if (lastEst && lastEst.est.declinedMs != null && lastEst.est.declinedMs <= atMs) {
    const l = autoLost("We don't do that", lastEst.est.declinedMs); if (l) return l;
  }
  let sent = ests.filter((t) => t.est.sentMs != null && t.est.sentMs <= atMs);
  if (sent.length) {
    const e = sent[sent.length - 1];
    const clock = Math.max(e.est.sentMs, reop ?? -Infinity, lastReply(S, e.est.sentMs) ?? -Infinity);
    if (atMs - clock > QUOTE_LOST_MS) { const l = autoLost('No reply after estimate', clock + QUOTE_LOST_MS); if (l) return l; }
    if (e.est.closedMs != null && e.est.closedMs <= atMs && !(lastReply(S, e.est.closedMs) > 0)) {
      const l = autoLost('Quote expired', Math.max(e.est.closedMs, e.est.sentMs)); if (l) return l;
    }
    const op = e.est.openedMs;
    const callToday = op != null && atMs - op >= CALL_TODAY_MS && !S.some((t) => t.atMs >= op && (t.type === 'attempt' || t.type === 'wizard' || (t.type === 'call_in' && t.talk)));
    return { stage: 'quoted', stageMs: e.est.sentMs, estimate: e, clockMs: clock, callToday, callback: openCallback(S, e.est.sentMs) };
  }
  const web = ests.filter((t) => t.est.webRequest);
  if (web.length) return { stage: 'new', stageMs: web[0].atMs, webRequest: web[web.length - 1] };
  const talks = talksOf(S);
  if (talks.length) {
    const first = talks[0];
    const leakFrom = Math.max(first.endMs, reop ?? -Infinity);
    return { stage: 'talked', stageMs: first.atMs, leak: atMs - leakFrom > LEAK_AFTER_MS, unconfirmed: talks.every((x) => !x.sure),
      onCall: talks.every((x) => x.t.why === 'in_progress'), firstTalk: first };
  }
  const opened = S.length ? S[0].atMs : card.openedMs;
  let lastCust = null;
  for (const t of S) if (t.type === 'call_in' || t.type === 'text_in') lastCust = t;
  const restart = Math.max(opened, reop ?? -Infinity, lastCust ? lastCust.atMs : -Infinity);
  const tries = S.filter((t) => t.type === 'attempt' && t.atMs >= restart && isFailedTry(t, atMs));
  if (tries.length >= NEVER_REACHED_TRIES) {
    const l = autoLost('Never reached', tries[NEVER_REACHED_TRIES - 1].atMs); if (l) return { ...l, tries: tries.length };
  }
  if (atMs - restart > NEVER_REACHED_MS) {
    const l = autoLost('Never reached', restart + NEVER_REACHED_MS); if (l) return { ...l, tries: tries.length };
  }
  return { stage: 'new', stageMs: opened, tries: tries.length, lastCustomer: lastCust };
}

function newCard(t, index) {
  return { key: 'c_' + t.id, phone: t.phone || null, family: t.family, opener: t, openedMs: t.atMs, lastMs: t.atMs, touches: [t], index };
}
function addTouch(card, t, timelineOnly) {
  card.touches.push(timelineOnly ? { ...t, timelineOnly: true } : t);
  if (!timelineOnly) card.lastMs = Math.max(card.lastMs, t.atMs);
}
function inClosedWindow(mark, atMs) {
  const ws = mark && Array.isArray(mark.closed_windows) ? mark.closed_windows : [];
  return ws.some((w) => { const f = msOf(w && w.from), to = msOf(w && w.to); return f != null && to != null && f <= atMs && atMs < to; });
}
function canJoin(card, atMs, mark) {
  if (inClosedWindow(mark, atMs)) return false;
  let active = card.lastMs;
  for (const t of card.touches) {
    if (t.type !== 'booking' || t.timelineOnly || t.atMs > atMs) continue;
    const b = t.bk;
    if ((b.cancelledMs != null && b.cancelledMs <= atMs) || (b.paidMs != null && b.paidMs <= atMs)) continue;
    active = Math.max(active, b.scheduledMs ?? t.atMs);
  }
  if (atMs - active > NEW_CARD_GAP_MS) return false;
  const st = evalStage(card, atMs, mark);
  if (st.stage === 'hidden' || st.stage === 'paid') return false;
  if (st.stage === 'lost') return st.lost.auto && atMs - st.lost.atMs <= SOFT_REVIVE_MS;
  return true;
}
function hardClosed(card, atMs, mark) {
  if (inClosedWindow(mark, atMs)) return true;
  const st = evalStage(card, atMs, mark);
  return st.stage === 'hidden' || st.stage === 'paid' || (st.stage === 'lost' && !st.lost.auto);
}

export function groupCards(touches, marks = [], now = Date.now(), noPhone = []) {
  const nowMs = msOf(now);
  const markBy = new Map((marks || []).map((m) => [m.card_key, m]));
  const byId = new Map(touches.map((t) => [t.id, t]));
  const groups = new Map();
  for (let t of [...touches].sort(byTime)) {
    if (!t.phone || !t.family || t.atMs > nowMs) continue;
    if (t.cardKey) { const op = byId.get(t.cardKey.slice(2)); if (op && op.phone === t.phone && op.family !== t.family) t = { ...t, family: op.family }; }
    const k = t.phone + '|' + t.family;
    (groups.get(k) || groups.set(k, []).get(k)).push(t);
  }
  const cards = [];
  for (const list of groups.values()) {
    const mine = []; let open = null;
    for (const t of list) {
      if (t.cardKey) { const target = mine.find((c) => c.key === t.cardKey); if (target) { addTouch(target, t, false); continue; } }
      if (t.type === 'booking' && t.bk.estimateId) {
        const target = mine.find((c) => c.touches.some((x) => x.type === 'estimate' && x.id === t.bk.estimateId));
        if (target && !hardClosed(target, t.atMs, markBy.get(target.key))) { addTouch(target, t, false); continue; }
      }
      if (open && canJoin(open, t.atMs, markBy.get(open.key))) { addTouch(open, t, false); continue; }
      if (t.canOpen) { open = newCard(t, mine.length); mine.push(open); continue; }
      if (open) addTouch(open, t, true);
    }
    const kept = mine.filter((c) => c.touches.some((t) => !t.timelineOnly && !t.archivedUnsent));
    kept.forEach((c, i) => { c.index = i; });
    cards.push(...kept);
  }
  for (const t of noPhone) if (t.atMs <= nowMs) cards.push(newCard(t, 0));
  for (const c of cards) {
    c.st = evalStage(c, nowMs, markBy.get(c.key));
    const m = markBy.get(c.key);
    const MAN = ['new', 'talked', 'quoted', 'booked'];
    if (m && m.manual_stage && MAN.includes(c.st.stage) && MAN.indexOf(m.manual_stage) > MAN.indexOf(c.st.stage)) {
      c.st = { ...c.st, stage: m.manual_stage, stageMs: msOf(m.manual_stage_at) ?? c.st.stageMs, manual: { by: m.manual_stage_by || null, at: m.manual_stage_at }, leak: false, callback: null };
    }
  }
  return cards;
}

export function computeCards(raw, now = Date.now()) {
  const nowMs = msOf(now);
  const ctx = makeContext(raw);
  const { touches, noPhone } = buildTouches(raw, ctx, nowMs);
  const cards = groupCards(touches, raw.marks || [], nowMs, noPhone)
    .filter((c) => !c.touches.every((t) => t.type === 'call_in' && t.why === 'short'));
  for (const c of cards) {
    const deal = c.touches.filter((t) => !t.timelineOnly && (t.type === 'booking' || t.type === 'estimate') && t.slug);
    c.openSlug = c.opener.slug || null;
    c.dealSlugs = [...new Set(deal.map((t) => t.slug))];
    const bk = [...deal].reverse().find((t) => t.type === 'booking');
    const est = [...deal].reverse().find((t) => t.type === 'estimate');
    c.shownSlug = (bk && bk.slug) || (est && est.slug) || c.openSlug;
    c.market = cardMarket(c, ctx);
  }
  return { cards, ctx, nowMs };
}

export function cardVisible(card, allowed) {
  if (allowed == null) return true;
  return [card.openSlug, ...(card.dealSlugs || [])].some((s) => s && allowed.includes(s));
}
const TULSA_ZIP3 = ['740', '741', '743', '744', '745', '746', '747'];
const TULSA_AC = ['918', '539'], OKC_AC = ['405', '580', '572'], DEN_AC = ['303', '720', '719', '970', '983'];
function cardMarket(card, ctx) {
  const line = ctx.lines.get(cardLine(card, ctx));
  if (line && line.market) return line.market === 'Oklahoma City' ? 'okc' : line.market === 'Tulsa' ? 'tulsa' : line.market === 'Manila' ? 'denver' : null;
  for (const t of [...card.touches].reverse()) {
    const l = t.loc; if (!l) continue;
    const st = String(l.state || '').trim().toUpperCase(), z3 = String(l.zip || '').slice(0, 3), city = String(l.city || '').toLowerCase();
    if (st === 'CO' || st === 'COLORADO' || /^8[01]/.test(z3)) return 'denver';
    if (st === 'OK' || st === 'OKLAHOMA' || /^7[34]/.test(z3)) return (TULSA_ZIP3.includes(z3) || /tulsa|broken arrow|owasso|bixby|jenks|sand springs|sapulpa|claremore/.test(city)) ? 'tulsa' : 'okc';
  }
  const ac = String(card.phone || '').slice(0, 3);
  return TULSA_AC.includes(ac) ? 'tulsa' : OKC_AC.includes(ac) ? 'okc' : DEN_AC.includes(ac) ? 'denver' : null;
}
function brandMatches(card, brand) {
  if (!brand || brand === 'all') return true;
  if (brand.startsWith('market:')) { const [, slug, m] = brand.split(':'); return card.market === m && [card.openSlug, ...(card.dealSlugs || [])].includes(slug); }
  if (brand.startsWith('family:')) return card.family === brand.slice(7);
  return [card.openSlug, ...(card.dealSlugs || [])].includes(brand);
}
export function rangeStartMs(range, nowMs = Date.now()) {
  const back = RANGE_DAYS[String(range)] ?? RANGE_DAYS[7];
  return Math.max(msOf(PIPELINE_FLOOR), localDayStartUTC(CHICAGO, -back, new Date(nowMs)).getTime());
}
export function rangeEndMs(range, nowMs = Date.now()) {
  return String(range) === 'yesterday' ? localDayStartUTC(CHICAGO, 0, new Date(nowMs)).getTime() : Infinity;
}
function normRange(r) { const s = String(r == null ? '' : r); return Object.prototype.hasOwnProperty.call(RANGE_DAYS, s) ? s : '7'; }

function cardLine(card, ctx) {
  let best = null;
  for (const t of card.touches) {
    const p = t.type === 'call_in' ? t.line : (t.type === 'text_in' || t.type === 'text_out_staff') ? t.our : null;
    const l = p && ctx.lines.get(p);
    if (l && l.active && p !== TOLL_FREE && (!best || t.atMs >= best.atMs)) best = { p, atMs: t.atMs };
  }
  return best ? best.p : null;
}

function attachAudits(audits, cards) {
  const byCall = new Map(), byPhone = new Map();
  for (const c of cards) {
    for (const t of c.touches) if (t.type === 'call_in' || t.type === 'wizard') byCall.set(t.id, c);
    if (c.phone) (byPhone.get(c.phone) || byPhone.set(c.phone, []).get(c.phone)).push(c);
  }
  const out = new Map();
  for (const a of audits || []) {
    let card = a.call_id ? byCall.get(a.call_id) || null : null;
    if (!card) {
      const p = phone10(a.caller_phone), aMs = msOf(a.occurred_at);
      if (p && aMs != null) {
        let gap = Infinity;
        for (const c of byPhone.get(p) || []) {
          if (aMs < c.openedMs - 3 * HOUR || aMs > c.lastMs + 3 * HOUR) continue;
          const g = Math.abs(aMs - c.openedMs); if (g < gap) { gap = g; card = c; }
        }
      }
    }
    if (card) (out.get(card.key) || out.set(card.key, []).get(card.key)).push(a);
  }
  return out;
}
export function auditSummary(list) {
  if (!list || !list.length) return null;
  const a = [...list].sort((x, y) => (msOf(x.occurred_at) || 0) - (msOf(y.occurred_at) || 0)).pop();
  let yes = 0, no = 0;
  for (const [k, v] of Object.entries(a.answers || {})) {
    if (k.startsWith('cust_')) continue;
    if (v === 'yes' || v === true) yes++; else if (v === 'no' || v === false) no++;
  }
  const n = yes + no;
  return { score: n ? Math.round((100 * yes) / n) : null, yes, n, flagged: !!a.flagged,
    listen_reason: a.flagged ? (a.listen_reason || null) : null, complaint: a.complaint || null,
    ratings: a.ratings || {}, by: a.handled_by || null, at: iso(msOf(a.occurred_at)), count: list.length };
}

function sourceLabel(t, ctx) {
  const biz = t.slug && ctx.bizBySlug.get(t.slug);
  const bizName = (biz && biz.name) || null;
  switch (t.type) {
    case 'call_in': return `Phone call · ${t.lineName || bizName || 'tracking line'}`;
    case 'wizard': return `Phone call · ${bizName || 'Take a Call'}`;
    case 'text_in': return `Text · ${t.lineName || bizName || 'tracking line'}`;
    case 'estimate': return t.est.source === 'manual' ? `Estimate · ${bizName || 'office'}` : 'Website estimate';
    case 'booking': return t.bk.source === 'widget' ? 'Booked online' : t.bk.source === 'estimate' ? 'Estimate approval' : `Booked by office · ${bizName || ''}`.replace(/ · $/, '');
    default: return bizName || 'Other';
  }
}

function nextFor(st, card, nowMs) {
  const cb = st.callback;
  const callbackNext = cb ? { text: `${cb.type === 'text_in' ? 'Text back — texted' : cb.vm ? 'Call back — voicemail' : 'Call back — missed'} ${fmtAgo(nowMs - cb.atMs)} ago`, tone: 'danger' } : null;
  if (st.manual) return { text: `Moved here by ${st.manual.by || 'the owner'}`, tone: 'mute' };
  switch (st.stage) {
    case 'lost': return { text: `Lost · ${st.lost.reason}`, tone: 'mute' };
    case 'paid': {
      const b = st.booking.bk; const amt = b.amountPaid ?? b.price;
      return { text: amt ? `Paid · ${dollars(amt)}` : 'Paid', tone: 'ok' };
    }
    case 'booked': {
      if (callbackNext) return callbackNext;
      if (st.doneUnpaid) return { text: 'Job done — payment not collected', tone: 'warn' };
      if (st.approvedNoJob) return { text: 'Approved — put it on the schedule', tone: 'warn' };
      const b = st.booking.bk;
      if (b.scheduledMs != null && b.scheduledMs + 6 * HOUR < nowMs) return { text: 'Job time passed — not marked done', tone: 'warn' };
      return { text: b.source === 'widget' ? 'Booked online' : 'Booked', tone: 'ok' };
    }
    case 'quoted': {
      if (callbackNext) return callbackNext;
      const e = st.estimate.est; const age = nowMs - e.sentMs;
      if (st.callToday) return { text: 'Call today — opened the quote', tone: 'warn' };
      if (e.bounced) return { text: 'Estimate email BOUNCED — listen to the call and check the email address', tone: 'danger' };
      const fu = e.couponMs ? 'follow-up email sent' : age > 4 * HOUR ? 'NO follow-up email' : 'follow-up email due at 3h';
      const text = `Sent ${fmtAgo(age)} ago · ${e.openedMs ? 'opened' : 'not opened'} · ${fu}`;
      const tone = age >= 3 * HOUR || (!e.couponMs && age > 4 * HOUR) ? 'warn' : 'ok';
      return { text, tone };
    }
    case 'talked': {
      if (st.onCall && !st.leak) return { text: 'On the phone now', tone: 'ok' };
      const text = st.unconfirmed ? 'No booking or estimate — or was it voicemail?' : st.leak ? 'No booking or estimate yet' : 'Talking — send estimate or book';
      return { text, tone: st.leak ? 'danger' : 'warn' };
    }
    case 'new': {
      const late = (ms) => nowMs - ms > NEW_CALLBACK_MS;
      if (st.webRequest) return { text: late(st.webRequest.atMs) ? 'Needs a response — over 30 min' : 'Needs a response', tone: late(st.webRequest.atMs) ? 'warn' : 'ok' };
      if (st.tries >= 1) return { text: 'Call back — 2nd try left', tone: 'warn' };
      const c = st.lastCustomer || card.opener;
      const what = c.type === 'text_in' ? `Text back — texted ${fmtAgo(nowMs - c.atMs)} ago` : `Call back — ${c.vm ? 'voicemail' : 'missed'} ${fmtAgo(nowMs - c.atMs)} ago`;
      return { text: what, tone: late(c.atMs) ? 'warn' : 'ok' };
    }
    default: return { text: '', tone: 'mute' };
  }
}

const item = (atMs, icon, text, who, tone) => ({ at: iso(atMs), icon, text, who: who || null, tone });
function timelineFor(card, st, mark, audits) {
  const out = []; let autoOther = 0;
  for (const t of card.touches) {
    const line = t.lineName ? ` · ${t.lineName}` : '';
    switch (t.type) {
      case 'call_in':
        if (t.why === 'in_progress') out.push(item(t.atMs, 'phone', `Call in progress${line}`, t.staff, 'warn'));
        else if (t.talk === 'yes') out.push(item(t.atMs, 'phone', `Call answered · ${fmtDur(t.dur)}${line}`, t.staff, 'ok'));
        else if (t.talk === 'unconfirmed') out.push(item(t.atMs, 'phone', `Call answered · ${fmtDur(t.dur)}${line} · talk or voicemail?`, t.staff, 'warn'));
        else if (t.why === 'missed') out.push(item(t.atMs, 'missed', `Missed call${line}`, t.staff, 'danger'));
        else if (t.why === 'no_person') out.push(item(t.atMs, 'missed', `Call not answered by a person${line}`, t.staff, 'danger'));
        else if (t.why === 'short') out.push(item(t.atMs, 'missed', `Answered ${fmtDur(t.dur)} — too short, likely voicemail${line}`, t.staff, 'danger'));
        else out.push(item(t.atMs, 'missed', `Answered ${fmtDur(t.dur)} — marked voicemail${line}`, t.staff, 'mute'));
        if (t.vm && t.why === 'missed') out[out.length - 1].text = `Voicemail left${line}`;
        if (t.rec) { out[out.length - 1].call_id = t.id; out[out.length - 1].rec = true; }
        if (t.summary && t.summary.length) out[out.length - 1].summary = t.summary;
        if (t.promise) out[out.length - 1].promise = t.promise;
        break;
      case 'wizard': {
        const r = t.live.resolution;
        const how = r === 'booked' ? ' · booked' : r === 'estimate_sent' ? (card.touches.some((x) => x.type === 'estimate' && x.est.sentMs != null) ? ' · estimate sent' : ' · estimate marked sent, none sent') : r === 'refused' ? ' · declined'
          : r === 'other' ? ' · other' : t.live.step ? ` · stopped at ${t.live.step}` : '';
        const q = t.live.quoted ? ` · ${dollars(t.live.quoted)}` : '';
        out.push({ ...item(t.atMs, 'script', `Call script${how}${q}`, t.staff, r === 'refused' ? 'warn' : 'ok'), price: t.live.quoted || null });
        break;
      }
      case 'text_in': out.push({ ...item(t.atMs, 'text', t.body ? `Text: ${clip(t.body, 600)}` : 'Texted a photo', null, 'ok'), msg_id: t.id, media: !t.body }); break;
      case 'text_out_staff': out.push(item(t.atMs, 'text', `Text reply: ${clip(t.body, 600)}`, t.staff, 'ok')); break;
      case 'text_auto': {
        const label = { missed_call: 'Auto-text sent (missed call)', estimate: 'Estimate link texted', booked: 'Booking confirmation texted' }[t.auto];
        if (!label && autoOther >= AUTO_TEXT_OTHER_CAP) break;
        if (!label) autoOther++;
        const text = label || ({ ack: 'Auto-reply to their text', en_route: 'On-the-way text', review: 'Review request texted' }[t.auto] || `Auto-text: ${clip(t.body, 50)}`);
        out.push(item(t.atMs, 'auto', t.failed ? `${text} · not delivered` : text, null, t.failed ? 'danger' : 'mute'));
        break;
      }
      case 'attempt': {
        const a = t.att; const who = a.source === 'manual' ? 'Called from own phone' : 'Called back';
        if (a.talked === true) out.push(item(t.atMs, 'callout', `${who} · talked${a.dur ? ' ' + fmtDur(a.dur) : ''}`, t.staff, 'ok'));
        else if (a.noRing) out.push(item(t.atMs, 'callout', `Call didn't connect — your phone ${a.staffStatus}`, t.staff, 'mute'));
        else if (a.talked === false) {
          const why = a.dialStatus && a.dialStatus !== 'completed' ? a.dialStatus.replace(/-/g, ' ') : a.dialStatus === 'completed' && a.dur != null ? `${fmtDur(a.dur)}, no real talk` : 'no answer';
          out.push(item(t.atMs, 'callout', `${who} · ${why}`, t.staff, 'danger'));
        } else out.push(item(t.atMs, 'callout', `${who} · outcome not confirmed`, t.staff, 'warn'));
        break;
      }
      case 'estimate': {
        const e = t.est;
        const amt = e.total ? ` · ${dollars(e.total)}` : '';
        if (t.archivedUnsent) { out.push(item(t.atMs, 'estimate', `${e.source === 'manual' ? 'Estimate saved' : 'Website estimate request'}${e.label ? ' · ' + e.label : ''} · archived, never sent`, null, 'mute')); break; }
        if (e.webRequest) out.push(item(t.atMs, 'estimate', `Website estimate request${e.label ? ' · ' + e.label : ''}`, null, 'danger'));
        else if (e.sentMs != null) out.push({ ...item(e.sentMs, 'estimate', `Estimate sent${amt}`, null, 'ok'), price: e.total || null });
        else out.push(item(t.atMs, 'estimate', `Estimate saved, not sent${amt}`, null, 'warn'));
        if (e.bounced) out.push(item(e.sentMs ?? t.atMs, 'estimate', 'Estimate email bounced — wrong address?', null, 'danger'));
        if (e.openedMs) out.push(item(e.openedMs, 'estimate', 'Customer opened the estimate', null, 'ok'));
        if (e.couponMs) out.push(item(e.couponMs, 'auto', 'Coupon email sent', null, 'mute'));
        if (e.approvedMs) out.push(item(e.approvedMs, 'estimate', `Estimate approved${amt}`, null, 'ok'));
        if (e.declinedMs) out.push(item(e.declinedMs, 'lost', 'Not a fit — declined by the office', null, 'mute'));
        break;
      }
      case 'booking': {
        const b = t.bk;
        const label = b.source === 'widget' ? 'Booked online' : b.source === 'estimate' ? 'Booked from estimate approval' : 'Booked';
        const by = b.bookedBy && !/estimate approval/i.test(b.bookedBy) ? b.bookedBy : null;
        out.push(item(t.atMs, 'booking', `${label}${b.tech ? ' · ' + b.tech : ''}${b.price ? ' · ' + dollars(b.price) : ''}`, by, 'ok'));
        if (b.completedMs != null) out.push(item(b.completedMs, 'done', 'Job done', b.tech, 'ok'));
        if (b.paidMs != null) { const amt = b.amountPaid ?? b.price; out.push(item(b.paidMs, 'paid', amt ? `Paid ${dollars(amt)}` : 'Paid', null, 'ok')); }
        if (b.cancelledMs != null) out.push(item(b.cancelledMs, 'cancel', 'Job cancelled', null, 'danger'));
        break;
      }
      default: break;
    }
  }
  if (mark) {
    if (mark.lost_reason && mark.lost_at) out.push(item(msOf(mark.lost_at), 'lost', `Marked lost · ${mark.lost_reason}${mark.lost_note ? ' — ' + clip(mark.lost_note, 80) : ''}`, mark.lost_by, 'mute'));
    if (mark.not_a_lead && mark.not_a_lead_at) out.push(item(msOf(mark.not_a_lead_at), 'lost', 'Marked not a lead', mark.not_a_lead_by, 'mute'));
    if (mark.reopened_at) out.push(item(msOf(mark.reopened_at), 'reopen', 'Reopened', mark.reopened_by, 'ok'));
  }
  if (st.lost && st.lost.auto) out.push(item(st.lost.atMs, 'lost', `Lost automatically · ${st.lost.reason}`, null, 'mute'));
  for (const a of audits || []) {
    const s = auditSummary([a]);
    out.push(item(msOf(a.occurred_at), 'audit', `Call audited${s.score != null ? ' · ' + s.score + '%' : ''}${a.flagged ? ' · flagged' : ''}`, a.handled_by, a.flagged ? 'danger' : 'mute'));
  }
  out.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  return out.slice(-TIMELINE_CAP);
}

function shapeCard(c, ctx, { nowMs, isOwner, mark, history, audits }) {
  const st = c.st;
  const T = c.touches.filter((t) => !t.timelineOnly);
  const bookings = T.filter((t) => t.type === 'booking');
  const ests = T.filter((t) => t.type === 'estimate');
  const standing = bookings.filter((t) => t.bk.cancelledMs == null);
  const bk = st.booking || standing[standing.length - 1] || bookings[bookings.length - 1] || null;
  const sentEsts = ests.filter((t) => t.est.sentMs != null);
  const liveEsts = ests.filter((t) => !t.archivedUnsent);
  const est = st.estimate || sentEsts[sentEsts.length - 1] || liveEsts[liveEsts.length - 1] || ests[ests.length - 1] || null;
  const wizards = T.filter((t) => t.type === 'wizard');
  const callsIn = T.filter((t) => t.type === 'call_in');
  const talks = talksOf(T);

  let name = null;
  for (const t of [...bookings].reverse()) if (t.name) { name = t.name; break; }
  if (!name) for (const t of [...ests].reverse()) if (t.name) { name = t.name; break; }
  if (!c.phone && !name) name = 'Caller (no phone saved)';

  let amount = null;
  if (bk && bk.bk.price) amount = bk.bk.price;
  else if (est && est.est.total) amount = est.est.total;
  else { const w = [...wizards].reverse().find((t) => t.live.quoted); if (w) amount = w.live.quoted; }

  const firstOf = (type) => { const x = talks.find((k) => k.t.type === type && k.t.staff); return x ? x.t.staff : null; };
  let secretary = firstOf('wizard') || firstOf('call_in') || firstOf('attempt') || firstOf('text_out_staff');
  if (!secretary) { const f = callsIn.find((t) => t.staff); secretary = f ? f.staff : null; }
  if (!secretary) { const b = bookings.find((t) => t.bk.bookedBy && ctx.handsetsOf.has(t.bk.bookedBy)); secretary = b ? b.bk.bookedBy : null; }

  const shown = c.shownSlug && ctx.bizBySlug.get(c.shownSlug);
  const lastCall = callsIn[callsIn.length - 1] || null;
  const revIn = [...callsIn].reverse();
  const answered = (st.unconfirmed ? revIn.find((t) => t.why === 'unconfirmed') : revIn.find((t) => t.answered === true && t.talk === 'yes' && !t.wizard))
    || revIn.find((t) => t.answered === true) || null;
  const failed = typeof st.tries === 'number' ? st.tries
    : T.filter((t) => t.type === 'attempt' && isFailedTry(t, nowMs)).length;

  const jobs = (history || []).filter((h) => h.completedMs != null && h.completedMs < c.openedMs && !bookings.some((b) => b.id === h.id));
  const spent = cents(jobs.reduce((s, h) => s + (h.amount || 0), 0));

  const out = {
    key: c.key,
    stage: st.stage === 'paid' || (st.stage === 'booked' && st.doneUnpaid) ? 'completed' : st.stage,
    paid: st.stage === 'paid',
    leak: st.stage === 'talked' && !!st.leak,
    call_today: st.stage === 'quoted' && !!st.callToday && !st.manual,
    manual: st.manual || null,
    voicemail: c.touches.some((t) => t.type === 'call_in' && t.vm),
    review: st.booking && st.booking.bk ? { ...st.booking.bk.rv, booking_id: st.booking.id, completed_at: iso(st.booking.bk.completedMs) } : null,
    unanswered: st.callback && nowMs - st.callback.atMs > 30 * MIN
      ? { at: iso(st.callback.atMs), kind: st.callback.type === 'text_in' ? 'text' : st.callback.vm ? 'voicemail' : 'missed', hours: Math.floor((nowMs - st.callback.atMs) / HOUR), mins: Math.floor((nowMs - st.callback.atMs) / MIN) }
      : null,
    phone: c.phone,
    phone_pretty: prettyPhone10(c.phone),
    name,
    business: shown ? { slug: shown.slug, name: shown.name } : (c.shownSlug ? { slug: c.shownSlug, name: c.shownSlug } : null),
    family: c.family,
    source: sourceLabel(c.opener, ctx),
    our_phone: cardLine(c, ctx),
    city: (ctx.lines.get(cardLine(c, ctx)) || {}).market || null,
    secretary,
    amount: amount != null ? cents(amount) : null,
    opened_at: iso(c.openedMs),
    last_at: iso(c.lastMs),
    stage_at: iso(st.stageMs),
    next: nextFor(st, c, nowMs),
    lost: st.stage === 'lost' ? { reason: st.lost.reason, auto: st.lost.auto, note: st.lost.note || '', by: st.lost.by || null, at: iso(st.lost.atMs) } : null,
    tries: failed,
    estimate: est ? { id: est.id, total: est.est.total, sent_at: iso(est.est.sentMs), opened: est.est.openedMs != null, coupon_at: iso(est.est.couponMs),
      approved_at: iso(est.est.approvedMs), status: est.est.status, slug: est.slug || null, label: est.est.label || null, bounced: !!est.est.bounced, items: est.est.items || [] } : null,
    booking: bk ? { id: bk.id, scheduled_at: iso(bk.bk.scheduledMs), status: bk.bk.status, price: bk.bk.price, tech: bk.bk.tech, paid_at: iso(bk.bk.paidMs),
      completed_at: iso(bk.bk.completedMs), created_at: iso(bk.atMs), review_at: iso(bk.bk.reviewMs), review_rating: bk.bk.reviewRating,
      slug: bk.slug || null } : null,
    inbound_call_id: lastCall ? lastCall.id : null,
    answered_call: answered ? { id: answered.id, duration_sec: answered.dur,
      state: answered.talk === 'yes' ? 'talked' : answered.talk === 'unconfirmed' ? 'unconfirmed'
        : (answered.why === 'marked_voicemail' || answered.why === 'audit_voicemail') ? 'voicemail' : 'short',
      wizard: !!answered.wizard } : null,
    history: { prior_cards: c.index || 0, prior_jobs: jobs.length, spent, returning: jobs.length > 0 },
    audit: isOwner ? auditSummary(audits) : null,
    timeline: timelineFor(c, st, mark, isOwner ? audits : null),
    highlight: !!(mark && mark.highlight && (!mark.highlight_stage || mark.highlight_stage === st.stage)),
  };
  Object.defineProperty(out, '_talked', { value: talks.length > 0 });
  Object.defineProperty(out, '_converted', { value: bookings.length > 0 || ests.some((t) => t.est.sentMs != null || t.est.approvedMs != null) });
  return out;
}

function historyIndex(rows, ctx) {
  const by = new Map();
  for (const r of rows || []) {
    const p = phone10(r.customer && r.customer.phone); if (!p) continue;
    const fam = familyOf(ctx.slugOf(r));
    const k = p + '|' + fam;
    const paidAmt = num(r.amount_paid);
    (by.get(k) || by.set(k, []).get(k)).push({ id: r.id, completedMs: msOf(r.completed_at) ?? msOf(r.scheduled_at) ?? msOf(r.created_at), amount: paidAmt > 0 ? paidAmt : (num(r.price) ?? 0) });
  }
  return by;
}

export function buildPipeline(raw, now = Date.now(), opts = {}) {
  const { cards, ctx, nowMs } = computeCards(raw, now);
  const isOwner = !!opts.isOwner;
  const allowed = opts.allowed === undefined ? null : opts.allowed;
  const viewOnly = (c, sc) => { if (opts.actAllowed !== undefined && !cardVisible(c, opts.actAllowed)) { if (opts.reviewAll && sc.stage === 'completed') sc.review_only_access = true; else sc.view_only = true; } return sc; };
  const seeAll = (c) => cardVisible(c, allowed) || (!!opts.reviewAll && isReviewCard(c));
  const range = normRange(opts.range);
  const fromMs = rangeStartMs(range, nowMs);
  const toMs = rangeEndMs(range, nowMs);
  const brand = String(opts.business || 'all');
  const markBy = new Map((raw.marks || []).map((m) => [m.card_key, m]));
  const hist = historyIndex(raw.history, ctx);
  const auditsBy = isOwner ? attachAudits(raw.audits, cards) : new Map();

  const activePhones = bookedPhones(raw.activeBookings);
  let shaped = [];
  for (const c of cards) {
    if (c.phone && activePhones.has(c.phone) && !c.touches.some((t) => t.type === 'booking')) continue;
    if (c.st.stage === 'hidden') continue;
    if (!opts.legacyBoard && c.st.stage === 'lost') continue;
    const doneJob = !opts.legacyBoard && (c.st.stage === 'paid' || (c.st.stage === 'booked' && c.st.doneUnpaid));
    if (doneJob) {
      const b = c.st.booking && c.st.booking.bk;
      if (!b || b.gotReview || b.offerSent) continue;
      const after = Math.min(b.scheduledMs ?? Infinity, b.completedMs ?? Infinity);
      if (b.rv.call_status && (!b.rv.call_at || msOf(b.rv.call_at) >= after - DAY)) continue;
      if (c.touches.some((t) => t.atMs > after && ((t.type === 'attempt' && (t.att.dialStatus === 'completed' || t.talk === 'yes')) || (t.type === 'call_in' && t.talk)))) continue;
      if (c.touches.some((t) => t.atMs > after && (t.type === 'attempt' || t.type === 'wizard'))) continue;
      if (nowMs - (b.completedMs ?? b.paidMs ?? 0) > 14 * DAY) continue;
      if (!seeAll(c) || !brandMatches(c, brand)) continue;
      shaped.push(viewOnly(c, shapeCard(c, ctx, { nowMs, isOwner, mark: markBy.get(c.key), history: c.phone ? hist.get(c.phone + '|' + c.family) : null, audits: auditsBy.get(c.key) || null })));
      continue;
    }
    const inRange = (ms) => ms >= fromMs && ms < toMs;
    const inR = inRange(c.openedMs) || c.touches.some((t) => t.type === 'booking' && !t.timelineOnly && inRange(t.atMs));
    const recentDone = c.touches.some((t) => t.type === 'booking' && t.bk && t.bk.completedMs != null && t.bk.completedMs >= nowMs - 3 * DAY);
    if (!inR && !recentDone) continue;
    if (!seeAll(c) || !brandMatches(c, brand)) continue;
    const sc = viewOnly(c, shapeCard(c, ctx, { nowMs, isOwner, mark: markBy.get(c.key), history: c.phone ? hist.get(c.phone + '|' + c.family) : null, audits: auditsBy.get(c.key) || null }));
    if (sc.stage === 'completed') {
      const doneMs = Date.parse((sc.review && sc.review.completed_at) || '');
      if (!inR && !(doneMs >= nowMs - 3 * DAY)) continue;
    } else if (!inR) continue;
    shaped.push(sc);
  }
  for (let i = shaped.length - 1; i >= 0; i--) {
    const c = shaped[i];
    if (c.stage === 'completed' && c.review && c.review.call_status) shaped.splice(i, 1);
  }
  if (opts.legacyBoard) for (const c of shaped) if (c.stage === 'completed') c.stage = 'booked';
  const notesBy = new Map();
  for (const n of raw.notes || []) (notesBy.get(n.card_key) || notesBy.set(n.card_key, []).get(n.card_key)).push({ id: n.id, body: n.body, by: n.created_by || null, at: n.created_at });
  for (const c of shaped) c.notes = notesBy.get(c.key) || [];
  const stages = Object.fromEntries(STAGES.map((s) => [s, 0]));
  const board = new Map();
  let calls = 0, converted = 0, leaks = 0;
  for (const c of shaped) {
    stages[c.stage] = (stages[c.stage] || 0) + 1;
    if (c.leak) leaks++;
    if (!c._talked) continue;
    calls++; if (c._converted) converted++;
    if (!c.secretary) continue;
    const row = board.get(c.secretary) || { name: c.secretary, talked: 0, converted: 0, pct: 0 };
    row.talked++; if (c._converted) row.converted++;
    board.set(c.secretary, row);
  }
  let scoreboard = [...board.values()].map((r) => ({ ...r, pct: r.talked ? Math.round((100 * r.converted) / r.talked) : 0 }))
    .sort((a, b) => b.talked - a.talked || a.name.localeCompare(b.name));
  if (!isOwner) scoreboard = scoreboard.filter((r) => r.name === opts.viewerName);
  shaped.sort((a, b) => String(a.opened_at || a.last_at || '').localeCompare(String(b.opened_at || b.last_at || '')) || a.key.localeCompare(b.key));
  if (shaped.length > CARD_CAP) shaped = shaped.slice(0, CARD_CAP);
  return {
    floor: PIPELINE_FLOOR,
    generated_at: iso(nowMs),
    is_owner: isOwner,
    range,
    range_start: iso(fromMs),
    metrics: { calls, converted, leaks },
    stages,
    scoreboard,
    lost_reasons: LOST_REASONS,
    cards: shaped.map((c) => ({ ...c })),
  };
}

export const FUNNEL_STAGES = ['entered', 'talked', 'quoted', 'booked', 'paid', 'reviewed'];
const FUNNEL_DAYS = { 3: 3,  7: 7, 30: 30, 90: 90 };
const chiDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
function reachedOf(c) {
  const T = c.touches.filter((t) => !t.timelineOnly);
  const bks = T.filter((t) => t.type === 'booking');
  const rv = bks.filter((t) => t.bk.gotReview);
  let lvl = 0;
  if (talksOf(T).length) lvl = 1;
  if (T.some((t) => t.type === 'estimate' && !t.archivedUnsent && t.est.sentMs != null)) lvl = 2;
  if (bks.length || T.some((t) => t.type === 'estimate' && !t.archivedUnsent && t.est.approvedMs != null)) lvl = 3;
  if (bks.some((t) => t.bk.paidMs != null)) lvl = 4;
  if (rv.length) lvl = 5;
  const st = c.st.stage;
  const cur = st === 'paid' ? 4 : st === 'booked' ? 3 : st === 'quoted' ? 2 : st === 'talked' ? 1 : 0;
  lvl = Math.max(lvl, cur);
  const reviewMs = rv.length ? Math.min(...rv.map((t) => t.bk.reviewMs ?? t.bk.paidMs ?? t.atMs)) : null;
  return { lvl, reviewMs };
}
export function buildFunnel(raw, now = Date.now(), opts = {}) {
  const { cards, nowMs } = computeCards(raw, now);
  const days = FUNNEL_DAYS[String(opts.days)] || 3;
  const fromMs = Math.max(msOf(PIPELINE_FLOOR), localDayStartUTC(CHICAGO, -(days - 1), new Date(nowMs)).getTime());
  const allowed = opts.allowed === undefined ? null : opts.allowed;
  const brand = String(opts.business || 'all');
  const activePhones = bookedPhones(raw.activeBookings);
  const counts = FUNNEL_STAGES.map(() => 0);
  const lost = FUNNEL_STAGES.map(() => ({}));
  const entered = {}, exited = {};
  for (let d = fromMs; d <= nowMs; d += DAY) { entered[chiDay(d)] = 0; exited[chiDay(d)] = 0; }
  entered[chiDay(nowMs)] = 0; exited[chiDay(nowMs)] = 0;
  for (const c of cards) {
    if (c.st.stage === 'hidden') continue;
    if (c.st.stage === 'lost' && c.st.lost && c.st.lost.reason === 'Spam') continue;
    if (c.phone && activePhones.has(c.phone) && !c.touches.some((t) => t.type === 'booking')) continue;
    if (!cardVisible(c, allowed) || !brandMatches(c, brand)) continue;
    if (c.openedMs == null || c.openedMs < msOf(PIPELINE_FLOOR)) continue;
    const { lvl, reviewMs } = reachedOf(c);
    if (reviewMs != null && reviewMs >= fromMs && reviewMs <= nowMs) { const k = chiDay(reviewMs); if (k in exited) exited[k]++; }
    if (c.openedMs < fromMs) continue;
    const k = chiDay(c.openedMs); if (k in entered) entered[k]++;
    for (let i = 0; i <= lvl; i++) counts[i]++;
    if (c.st.stage === 'lost' && lvl < 5) { const r = (c.st.lost && c.st.lost.reason) || 'Other'; lost[lvl + 1][r] = (lost[lvl + 1][r] || 0) + 1; }
  }
  const stages = FUNNEL_STAGES.map((s, i) => ({
    stage: s, count: counts[i], drop: i ? counts[i - 1] - counts[i] : 0,
    lost: i ? Object.entries(lost[i]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, n]) => ({ reason, n })) : [],
  }));
  let leak = null;
  for (let i = 1; i < stages.length; i++) if (stages[i].drop > 0 && (!leak || stages[i].drop > stages[leak].drop)) leak = i;
  return { days, from: iso(fromMs), stages, leak: leak == null ? null : FUNNEL_STAGES[leak],
    series: Object.keys(entered).sort().map((d) => ({ d, in: entered[d], out: exited[d] || 0 })) };
}

export function phonesSince(raw, sinceMs) {
  const out = new Set();
  const add = (p, at) => { if (p && (msOf(at) ?? 0) >= sinceMs) out.add(p); };
  for (const c of raw.calls || []) if (c.kind === 'inbound') add(strictPhone(c.caller_phone), c.occurred_at);
  for (const m of raw.messages || []) add(phone10(m.customer_phone), m.created_at);
  for (const e of raw.estimates || []) add(phone10(e.customer_phone), e.created_at);
  for (const b of raw.bookings || []) add(phone10(b.customer && b.customer.phone), b.created_at);
  return [...out];
}

async function fetchAll(label, build, max = 20000, pageSize = 1000) {
  const out = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < pageSize) return out;
  }
  console.warn(`[pipeline] ${label}: stopped at ${max} rows -- older rows were not read`);
  return out;
}
async function inChunks(values, size, run) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return (await Promise.all(chunks.map(run))).flat();
}

const CALL_COLS = 'id, business_id, kind, source, caller_phone, grasshopper_number, forwarded_to, occurred_at, answered, duration_sec, recording_url, status, handled_by, booking_id, resolution, reached_step, quoted_total, inbound_call_id, transcript_summary';
const MESSAGE_COLS = 'id, business_id, customer_phone, our_phone, direction, body, sent_by, status, created_at';
const ESTIMATE_COLS = 'id, business_id, source, status, customer_name, customer_phone, created_at, updated_at, texted_at, emailed_at, contacted_at, approved_at, approved_total, line_items, tax_rate, text_opened_at, email_opened_at, followup_emailed_at, call_id, service_label, email_status, customer_state, customer_zip, customer_city';
const BOOKING_COLS = `id, business_id, customer_id, status, city, state, postal_code, source, scheduled_at, created_at, updated_at, completed_at, paid_at, cancelled_at,
  price, amount_paid, payment_status, notes, customer_notes, metadata, review_rating, reviewed_at, review_clicked_at,
  review_email_sent_at, review_email_count, review_email_delivered_at, review_email_status, review_email_clicked_at,
  review_sms_sent_at, review_sms_delivered_at, review_sms_status, review_sms_clicked_at, review_call_status, review_call_at, review_call_by,
  customer:customers ( name, phone ), technician:technicians!technician_id ( name )`;
const AUDIT_COLS = 'id, call_id, caller_phone, occurred_at, handled_by, answers, ratings, flagged, listen_reason, complaint, business_id, direction';

export async function loadPipelineRaw(db, { nowMs = Date.now(), withAudits = false } = {}) {
  const sinceMs = Math.max(msOf(PIPELINE_FLOOR), nowMs - LOOKBACK_DAYS * DAY);
  const since = iso(sinceMs);
  const [calls, messages, estimates, bookings, attempts, marks, auditSkips, staff, silent, blocked, tracking, businesses, audits] = await Promise.all([
    fetchAll('calls', () => db.from('calls').select(CALL_COLS).in('kind', ['inbound', 'live']).gte('occurred_at', since).order('occurred_at').order('id')),
    fetchAll('messages', () => db.from('messages').select(MESSAGE_COLS).gte('created_at', since).order('created_at').order('id')),
    fetchAll('estimates', () => db.from('estimates').select(ESTIMATE_COLS).is('deleted_at', null).gte('created_at', since).order('created_at').order('id')),
    fetchAll('bookings', () => db.from('bookings').select(BOOKING_COLS).neq('source', 'import').gte('created_at', since).order('created_at').order('id')),
    fetchAll('call_attempts', () => db.from('call_attempts').select('*').gte('started_at', since).neq('source', 'prospect').order('started_at').order('id')),
    fetchAll('pipeline_marks', () => db.from('pipeline_marks').select('*').order('card_key')),
    fetchAll('audit_skips', () => db.from('audit_skips').select('call_id, reason, created_at').order('call_id')),
    fetchAll('staff_users', () => db.from('staff_users').select('name, phone, active').order('id')),
    fetchAll('silent_numbers', () => db.from('silent_numbers').select('phone').order('id')),
    fetchAll('blocked_numbers', () => db.from('blocked_numbers').select('phone').order('id')),
    fetchAll('tracking_numbers', () => db.from('tracking_numbers').select('phone, business_slug, display_name, market, active, forward_to, created_at').order('phone')),
    fetchAll('businesses', () => db.from('businesses').select('id, slug, name').order('slug')),
    withAudits
      ? fetchAll('call_audits', () => db.from('call_audits').select(AUDIT_COLS).gte('occurred_at', iso(sinceMs - 3 * HOUR)).order('occurred_at').order('id'))
      : Promise.resolve([]),
  ]);
  const liveIds = calls.filter((c) => c.kind === 'live').map((c) => c.id);
  const callEvents = await inChunks(liveIds, 150, (ids) => fetchAll('call_events',
    () => db.from('call_events').select('call_id, event, actor, meta, created_at').in('call_id', ids).in('event', ['started', 'estimate_sent']).order('created_at').order('id')));
  const activeBookings = await fetchAll('active bookings', () => db.from('bookings').select('id, customer:customers ( phone, metadata )')
    .not('status', 'in', '(completed,cancelled)').is('completed_at', null).is('cancelled_at', null)
    .gte('scheduled_at', iso(nowMs - DAY)).order('id'));
  const notes = await fetchAll('pipeline_notes', () => db.from('pipeline_notes').select('id, card_key, body, created_by, created_at').gte('created_at', since).order('created_at').order('id'));
  return { calls, callEvents, messages, estimates, bookings, attempts, marks, auditSkips, staff, silent, blocked, tracking, businesses, audits, activeBookings, notes, history: [] };
}

export async function loadHistory(db, phones) {
  if (!phones || !phones.length) return [];
  const customers = await inChunks(phones.flatMap(phoneVariants), 150, (vals) =>
    fetchAll('history customers', () => db.from('customers').select('id, phone').in('phone', vals).order('id')));
  const phoneById = new Map(customers.map((c) => [c.id, c.phone]));
  const jobs = await inChunks([...phoneById.keys()], 150, (ids) =>
    fetchAll('history bookings', () => db.from('bookings').select('id, customer_id, business_id, price, amount_paid, completed_at, scheduled_at, created_at')
      .eq('status', 'completed').in('customer_id', ids).order('id')));
  return jobs.map((j) => ({ ...j, customer: { phone: phoneById.get(j.customer_id) } }));
}

const OPS = new Set(['mark_lost', 'not_a_lead', 'reopen', 'no_talk', 'talk', 'log_attempt', 'attempt_outcome', 'set_stage', 'highlight']);

export async function pipelineHandler(req, res, db, auth, body) {
  if (!auth) return res.status(403).json({ error: 'Not available for this login' });
  if (auth.offToday) {
    const okOp = req.method === 'POST' && body && ['add_note', 'attempt_outcome', 'log_attempt', 'talk', 'no_talk'].includes(body.op);
    const okGet = req.method === 'GET' && !req.query.funnel && !req.query.marked && !req.query.why_unseen && !req.query.why_for;
    if (!okOp && !okGet) return res.status(403).json({ error: 'Off today', off_today: true });
  }
  if (auth.role === 'auditor' || auth.auditor) {
    if (req.method !== 'GET' || req.query.why_unseen || req.query.why_for || req.query.marked) return res.status(403).json({ error: 'Not available for this login' });
  }
  if (req.method === 'GET' && req.query.why_unseen === '1') {
    if (auth.role === 'owner' || !auth.name) return res.status(200).json({ notes: [] });
    const { data } = await db.from('pipeline_ask_why').select('card_key, answer, created_at, asked_by').eq('for_name', auth.name).is('seen_at', null).limit(50);
    return res.status(200).json({ notes: (data || []).map((n) => ({ card_key: n.card_key, at: n.created_at, by: n.asked_by, ...n.answer })) });
  }
  if (req.method === 'GET' && req.query.why_for) {
    const { data } = await db.from('pipeline_ask_why').select('answer, created_at, for_name, seen_at').eq('card_key', String(req.query.why_for)).maybeSingle();
    return res.status(200).json(data && data.answer ? { ...data.answer, at: data.created_at, for_name: data.for_name, seen_at: data.seen_at } : {});
  }
  if (req.method === 'GET' && req.query.marked === '1') {
    if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    return res.status(200).json(await markedByStaff(db));
  }
  if (req.method === 'GET' && req.query.funnel) {
    const nowMs = Date.now();
    return res.status(200).json(buildFunnel(await loadPipelineRaw(db, { nowMs }), nowMs, { allowed: pipelineSlugsFor(auth), days: req.query.funnel, business: (req.query.business || 'all').toString() }));
  }
  if (req.method === 'GET') {
    const nowMs = Date.now();
    const isOwner = auth.role === 'owner';
    const range = normRange(req.query.range);
    const raw = await loadPipelineRaw(db, { nowMs, withAudits: isOwner });
    raw.history = await loadHistory(db, phonesSince(raw, rangeStartMs(range, nowMs)));
    return res.status(200).json(buildPipeline(raw, nowMs, {
      isOwner, reviewAll: reviewAllFor(auth), allowed: auth.offToday ? [] : pipelineSlugsFor(auth), actAllowed: auth.offToday ? [] : pipelineWriteSlugsFor(auth), viewerName: auth.name || null, range, business: (req.query.business || 'all').toString(), legacyBoard: req.query.board === 'legacy',
    }));
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (body && body.op === 'add_note') {
    const key = String(body.card_key || ''), text = String(body.body || '').trim().slice(0, 10000);
    if (!/^c_[0-9a-f-]{36}$/i.test(key) || !text) return res.status(400).json({ error: 'Write a note first.' });
    const act = pipelineSlugsFor(auth);
    if (auth.role !== 'owner') {
      const nowMs = Date.now();
      const card = computeCards(await loadPipelineRaw(db, { nowMs }), nowMs).cards.find((c) => c.key === key);
      if (!card) return res.status(404).json({ error: 'That card is no longer on the board. Refresh and try again.' });
      if (!cardVisible(card, act) && !(reviewAllFor(auth) && isReviewCard(card))) return res.status(403).json({ error: 'Forbidden for this business' });
    }
    const { error } = await db.from('pipeline_notes').insert({ card_key: key, body: text, created_by: auth.name || auth.role || 'office' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
  if (body && body.op === 'why_seen') {
    const key = String(body.card_key || '');
    if (!/^c_[0-9a-f-]{36}$/i.test(key)) return res.status(400).json({ error: 'card_key is required' });
    await db.from('pipeline_ask_why').update({ seen_at: new Date().toISOString() }).eq('card_key', key).eq('for_name', auth.name || '');
    return res.status(200).json({ ok: true });
  }
  if (body && body.op === 'ask_why') {
    const { askWhy } = await import('./pipeline-ask.js');
    const r = await askWhy(db, auth, body, pipelineSlugsFor(auth));
    return res.status(r.status).json(r.json);
  }
  try {
    return await pipelineOp(res, db, auth, body || {});
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
}

const OWNER_MARK = /^(owner|andrew\b)/i;
async function markedByStaff(db) {
  const nowMs = Date.now(), fromMs = nowMs - 30 * DAY;
  const raw = await loadPipelineRaw(db, { nowMs, withAudits: true });
  const { cards, ctx } = computeCards(raw, nowMs);
  const markBy = new Map((raw.marks || []).map((m) => [m.card_key, m]));
  const auditsBy = attachAudits(raw.audits, cards);
  const picks = [];
  for (const c of cards) {
    const m = markBy.get(c.key); if (!m) continue;
    let row = null;
    if (c.st.stage === 'hidden' && m.not_a_lead) row = { kind: 'not_a_lead', reason: '', note: '', by: m.not_a_lead_by || '', atMs: msOf(m.not_a_lead_at) };
    else if (c.st.stage === 'lost' && c.st.lost && !c.st.lost.auto) row = { kind: 'lost', reason: c.st.lost.reason || '', note: c.st.lost.note || '', by: c.st.lost.by || '', atMs: c.st.lost.atMs };
    if (!row || !row.by || OWNER_MARK.test(row.by) || row.atMs == null || row.atMs < fromMs) continue;
    picks.push({ c, m, row });
  }
  const hist = historyIndex(await loadHistory(db, [...new Set(picks.map((p) => p.c.phone).filter(Boolean))]), ctx);
  const notesBy = new Map();
  for (const n of raw.notes || []) (notesBy.get(n.card_key) || notesBy.set(n.card_key, []).get(n.card_key)).push({ id: n.id, body: n.body, by: n.created_by || null, at: n.created_at });
  const rows = [];
  for (const { c, m, row } of picks) {
    let card;
    try { card = shapeCard(c, ctx, { nowMs, isOwner: true, mark: m, history: c.phone ? hist.get(c.phone + '|' + c.family) : null, audits: auditsBy.get(c.key) || null }); } catch { continue; }
    if (row.kind === 'not_a_lead') { card.stage = 'lost'; card.lost = { reason: 'Not a lead', auto: false, note: '', by: row.by, at: iso(row.atMs) }; }
    card.notes = notesBy.get(c.key) || [];
    rows.push({ key: c.key, kind: row.kind, reason: row.reason, note: row.note, by: row.by, at: iso(row.atMs), card });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { rows };
}

async function pipelineOp(res, db, auth, body) {
  const op = String(body.op || '');
  if (!OPS.has(op)) return res.status(400).json({ error: 'Unknown op' });
  const who = auth.name || auth.role || 'office';
  const nowIso = new Date().toISOString();

  if (op === 'attempt_outcome') {
    const id = String(body.attempt_id || '');
    if (!UUID.test(id)) return res.status(400).json({ error: 'attempt_id is required' });
    if (typeof body.talked !== 'boolean') return res.status(400).json({ error: 'talked must be true or false' });
    const { data: a, error } = await db.from('call_attempts').select('id, business_id, staff_name, ended_at').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!a) return res.status(404).json({ error: 'Call attempt not found' });
    if (auth.role !== 'owner') {
      let slug = null;
      if (a.business_id) { const { data: b } = await db.from('businesses').select('slug').eq('id', a.business_id).maybeSingle(); slug = b && b.slug; }
      if (!(reviewAllFor(auth) && a.staff_name === auth.name) && (slug ? !mayUseBusiness(auth, slug) : a.staff_name !== auth.name)) return res.status(403).json({ error: 'Forbidden for this business' });
    }
    const { error: e2 } = await db.from('call_attempts').update({ talked: body.talked, talked_set_by: who, ended_at: a.ended_at || nowIso }).eq('id', id);
    if (e2) throw e2;
    return res.status(200).json({ ok: true });
  }

  const key = String(body.card_key || '');
  if (!CARD_KEY.test(key)) return res.status(400).json({ error: 'card_key is required' });
  const nowMs = Date.now();
  const raw = await loadPipelineRaw(db, { nowMs });
  const { cards, ctx } = computeCards(raw, nowMs);
  const card = cards.find((c) => c.key === key);
  if (!card) return res.status(404).json({ error: 'That card is no longer on the board. Refresh and try again.' });
  if (op === 'not_a_lead' && !(auth.role === 'owner' || auth.name === 'Joey')) return res.status(403).json({ error: 'Owner and Joey only' });
  const actionScope=(op==='not_a_lead'||op==='mark_lost') && auth.role==='secretary' && auth.name==='Joey' ?   // Joey: Lost + Not a lead on every card (owner 2026-10-06)
    pipelineSlugsFor(auth) : pipelineWriteSlugsFor(auth);
  if (!cardVisible(card, actionScope) && !(reviewAllFor(auth) && isReviewCard(card) && ['log_attempt', 'talk', 'no_talk'].includes(op))) return res.status(403).json({ error: 'Forbidden for this business' });
  const biz = card.shownSlug && ctx.bizBySlug.get(card.shownSlug);
  const bizId = biz ? biz.id : null;

  if (op === 'log_attempt') {
    if (!card.phone) return res.status(400).json({ error: 'This card has no phone number' });
    if (body.phone != null && body.phone !== '' && phone10(body.phone) !== card.phone) return res.status(400).json({ error: 'That number is not on this card' });
    if (typeof body.talked !== 'boolean') return res.status(400).json({ error: 'talked must be true or false' });
    const { error } = await db.from('call_attempts').insert({
      phone: card.phone, business_id: bizId, our_phone: cardLine(card, ctx), staff_name: who, source: 'manual',
      talked: body.talked, talked_set_by: who, started_at: nowIso, ended_at: nowIso, card_key: key,
    });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'same_customer') {
    if (!card.phone) return res.status(400).json({ error: 'This card has no phone number' });
    const other = phone10(body.phone);
    if (!other || other === card.phone) return res.status(400).json({ error: 'Enter their other number' });
    const { data: found, error: fe } = await db.from('customers').select('id, metadata').in('phone', phoneVariants(other)).order('created_at', { ascending: false }).limit(1);
    if (fe) throw fe;
    const cust = found && found[0];
    if (!cust) return res.status(404).json({ error: 'No customer with that number' });
    const md = cust.metadata || {};
    const alts = [...new Set([...(md.alt_phones || []), card.phone])];
    const { error } = await db.from('customers').update({ metadata: { ...md, alt_phones: alts }, updated_at: nowIso }).eq('id', cust.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  let patch;
  const cur = await readMark(db, key);
  switch (op) {
    case 'mark_lost': {
      const reason = String(body.reason || '');
      if (!LOST_REASONS.includes(reason)) return res.status(400).json({ error: 'Pick one of the lost reasons' });
      patch = { lost_reason: reason, lost_note: clean(body.note, 500) || null, lost_at: nowIso, lost_by: who };
      break;
    }
    case 'highlight': {
      const on = body.on === true || body.on === 'true';
      patch = { highlight: on, highlight_by: who, highlight_at: nowIso, highlight_stage: on ? card.st.stage : null };
      break;
    }
    case 'not_a_lead': patch = { not_a_lead: true, not_a_lead_by: who, not_a_lead_at: nowIso }; break;
    case 'reopen': patch = { reopened_at: nowIso, reopened_by: who, not_a_lead: false }; break;
    case 'set_stage': {
      if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can move cards' });
      const stage = String(body.stage || '');
      if (!['talked', 'quoted', 'booked'].includes(stage)) return res.status(400).json({ error: 'Pick Talked to, Quoted or Booked' });
      patch = { manual_stage: stage, manual_stage_at: nowIso, manual_stage_by: who };
      break;
    }
    case 'no_talk':
    case 'talk': {
      const callId = String(body.call_id || '');
      const hit = card.touches.find((t) => t.type === 'call_in' && t.id === callId);
      if (!hit) return res.status(400).json({ error: 'That call is not on this card' });
      if (op === 'talk' && hit.answered !== true) return res.status(400).json({ error: 'Only an answered call can be marked as a talk' });
      const talk = new Set(cur ? cur.talk_call_ids || [] : []), noTalk = new Set(cur ? cur.no_talk_call_ids || [] : []);
      if (op === 'talk') { talk.add(callId); noTalk.delete(callId); } else { noTalk.add(callId); talk.delete(callId); }
      patch = { talk_call_ids: [...talk], no_talk_call_ids: [...noTalk] };
      break;
    }
    default: return res.status(400).json({ error: 'Unknown op' });
  }
  if (op !== 'highlight' && cur && cur.highlight) patch.highlight = false;
  const closedFrom = op === 'highlight' ? null : op === 'reopen' || op === 'mark_lost' || op === 'not_a_lead' ? closedSince(cur) : null;
  if (closedFrom != null && closedFrom < msOf(nowIso)) {
    patch.closed_windows = [...(Array.isArray(cur.closed_windows) ? cur.closed_windows : []), { from: iso(closedFrom), to: nowIso }];
  }
  const row = { card_key: key, business_id: bizId, phone: card.phone || null, ...patch, updated_at: nowIso };
  let { error } = await db.from('pipeline_marks').upsert(row, { onConflict: 'card_key' });
  if (error && row.closed_windows && ['42703', 'PGRST204'].includes(error.code) && /closed_windows/.test(error.message || '')) {
    console.warn('[pipeline] pipeline_marks.closed_windows missing (migration 0142) -- saved without it');
    const rest = { ...row }; delete rest.closed_windows;
    ({ error } = await db.from('pipeline_marks').upsert(rest, { onConflict: 'card_key' }));
  }
  if (error) throw error;
  return res.status(200).json({ ok: true });
}
function bookedPhones(list) {
  const out = new Set();
  for (const b of list || []) {
    const c = b.customer || {};
    for (const p of [c.phone, ...((c.metadata && c.metadata.alt_phones) || [])]) { const d = phone10(p); if (d) out.add(d); }
  }
  return out;
}
function closedSince(m) {
  if (!m) return null;
  const from = [];
  const n = m.not_a_lead ? msOf(m.not_a_lead_at) : null;
  if (n != null) from.push(n);
  const l = m.lost_reason ? msOf(m.lost_at) : null, r = msOf(m.reopened_at);
  if (l != null && !(r != null && r >= l)) from.push(l);
  return from.length ? Math.min(...from) : null;
}
async function readMark(db, key) {
  const { data, error } = await db.from('pipeline_marks').select('*').eq('card_key', key).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function isReviewCardFor(db, cardKey, rawPhone) {
  if (!CARD_KEY.test(String(cardKey || ''))) return false;
  const nowMs = Date.now();
  const { cards } = computeCards(await loadPipelineRaw(db, { nowMs }), nowMs);
  const c = cards.find((x) => x.key === cardKey);
  return !!c && isReviewCard(c) && !!c.phone && c.phone === phone10(rawPhone);
}
export async function pipelineCallTarget(db, auth, rawPhone, cardSlugIn, anyBusiness) {
  const phone = phone10(rawPhone);
  if (!phone || REPEATED.test(phone)) throw httpErr(400, 'A 10-digit customer number is required');
  const bizSlug = cardSlugIn && (anyBusiness || mayUseBusiness(auth, cardSlugIn)) ? cardSlugIn : null;
  const fam = bizSlug ? familyOf(bizSlug) : null;
  const allowed = anyBusiness ? null : allowedSlugsFor(auth);
  const [bizR, linesR] = await Promise.all([
    db.from('businesses').select('id, slug'),
    db.from('tracking_numbers').select('phone, business_slug, active, forward_to, created_at').order('created_at'),
  ]);
  if (bizR.error) throw bizR.error;
  if (linesR.error) throw linesR.error;
  const slugById = new Map((bizR.data || []).map((b) => [b.id, b.slug]));
  const idBySlug = new Map((bizR.data || []).map((b) => [b.slug, b.id]));
  const okIds = (bizR.data || []).filter((b) => allowed === null || allowed.includes(b.slug)).map((b) => b.id);
  if (!okIds.length) throw httpErr(403, 'Forbidden for this business');
  const scoped = (q) => (allowed === null ? q : q.in('business_id', okIds));
  const variants = phoneVariants(phone);
  const lineBy = new Map((linesR.data || []).map((l) => [phone10(l.phone), l]));
  const [callsR, msgsR, estsR, custsR] = await Promise.all([
    db.from('calls').select('business_id, grasshopper_number, occurred_at').eq('kind', 'inbound').eq('caller_phone', phone).order('occurred_at', { ascending: false }).limit(50),
    scoped(db.from('messages').select('business_id, our_phone, created_at').eq('customer_phone', phone)).order('created_at', { ascending: false }).limit(50),
    scoped(db.from('estimates').select('business_id').in('customer_phone', variants)).limit(1),
    scoped(db.from('customers').select('id').in('phone', variants)).limit(200),
  ]);
  for (const r of [callsR, msgsR, estsR, custsR]) if (r.error) throw r.error;
  const callRows = [];
  for (const r of callsR.data || []) {
    const lineSlug = (lineBy.get(phone10(r.grasshopper_number)) || {}).business_slug || null;
    const bizId = r.business_id || (lineSlug && idBySlug.get(lineSlug)) || null;
    if (allowed !== null && !(r.business_id ? okIds.includes(r.business_id) : allowed.includes(lineSlug))) continue;
    callRows.push({ ...r, business_id: bizId });
  }
  let bookingBiz = null;
  const custIds = (custsR.data || []).map((c) => c.id);
  if (custIds.length) {
    const { data, error } = await scoped(db.from('bookings').select('business_id').in('customer_id', custIds)).limit(1);
    if (error) throw error;
    if (data && data.length) bookingBiz = data[0].business_id;
  }
  const evidence = [...callRows, ...(msgsR.data || []), ...(estsR.data || [])].map((r) => r.business_id).filter(Boolean);
  if (bookingBiz) evidence.push(bookingBiz);
  if (!callRows.length && !(msgsR.data || []).length && !(estsR.data || []).length && !bookingBiz) {
    throw httpErr(404, 'No call, text, estimate or booking from this number in your businesses.');
  }
  const usable = (p) => {
    const l = p && lineBy.get(p);
    return l && l.active !== false && p !== TOLL_FREE && (allowed === null || allowed.includes(l.business_slug))
      && (!fam || familyOf(l.business_slug) === fam) ? l : null;
  };
  for (const c of callRows) {
    const p = phone10(c.grasshopper_number); const l = usable(p);
    if (l) return { phone, line: p, businessId: c.business_id || idBySlug.get(l.business_slug) || null };
  }
  for (const m of msgsR.data || []) {
    const p = phone10(m.our_phone); const l = usable(p);
    if (l) return { phone, line: p, businessId: m.business_id || idBySlug.get(l.business_slug) || null };
  }
  const cardSlug = bizSlug || (evidence.length ? slugById.get(evidence[0]) : null) || null;
  if (cardSlug) {
    const l = (linesR.data || []).find((x) => x.business_slug === cardSlug && x.active !== false && x.forward_to && phone10(x.phone) !== TOLL_FREE);
    if (l) return { phone, line: phone10(l.phone), businessId: idBySlug.get(cardSlug) || null };
  }
  const tollFree = phone10(process.env.TWILIO_PHONE_NUMBER || '');
  if (!tollFree) throw httpErr(500, 'No line to call from');
  return { phone, line: tollFree, businessId: (cardSlug && idBySlug.get(cardSlug)) || null };
}

export async function inboundForLiveStart(db, auth, body) {
  const out = {};
  try {
    const typed = strictPhone(body && body.caller_phone);
    if (typed && !REPEATED.test(typed)) out.caller_phone = typed;
    const lineSlugs = new Map();
    const slugOfCall = async (c) => {
      if (c.business && c.business.slug) return c.business.slug;
      const p = phone10(c.grasshopper_number); if (!p) return null;
      if (!lineSlugs.has(p)) {
        const { data: l } = await db.from('tracking_numbers').select('business_slug').eq('phone', p).maybeSingle();
        lineSlugs.set(p, (l && l.business_slug) || null);
      }
      return lineSlugs.get(p);
    };
    const wanted = body && body.inbound_call_id != null ? String(body.inbound_call_id) : '';
    if (wanted) {
      if (!UUID.test(wanted)) return out;
      const { data } = await db.from('calls').select('id, kind, caller_phone, grasshopper_number, business:businesses ( slug )').eq('id', wanted).maybeSingle();
      if (data && data.kind === 'inbound' && mayUseBusiness(auth, await slugOfCall(data))) {
        out.inbound_call_id = data.id;
        if (!out.caller_phone) { const p = strictPhone(data.caller_phone); if (p) out.caller_phone = p; }
      } else console.warn('[call_live_start] inbound_call_id is not a call this login may use -- not linked');
      return out;
    }
    const name = String((auth && auth.name) || '').trim();
    if (!name) return out;
    const { data: staff } = await db.from('staff_users').select('phone').eq('name', name);
    const hs = new Set((staff || []).map((s) => phone10(s.phone)).filter(Boolean));
    if (name === 'Heather') hs.add(HEATHER_OLD_PHONE);
    if (!hs.size) return out;
    const fwd = [...hs].flatMap((p) => [p, '+1' + p, '1' + p]);
    const { data: cands } = await db.from('calls').select('id, caller_phone, answered, duration_sec, status, grasshopper_number, business:businesses ( slug )')
      .eq('kind', 'inbound').in('forwarded_to', fwd).gte('occurred_at', new Date(Date.now() - 15 * MIN).toISOString())
      .order('occurred_at', { ascending: false }).limit(10);
    const list = [];
    for (const c of cands || []) {
      if (c.answered === false || c.status === 'ignored') continue;
      if (c.answered === true && c.duration_sec != null && c.duration_sec < TALK_MIN_SEC) continue;
      if (out.caller_phone && strictPhone(c.caller_phone) !== out.caller_phone) continue;
      if (!mayUseBusiness(auth, await slugOfCall(c))) continue;
      list.push(c);
    }
    if (!list.length) return out;
    const { data: used } = await db.from('calls').select('inbound_call_id').in('inbound_call_id', list.map((c) => c.id));
    const usedIds = new Set((used || []).map((u) => u.inbound_call_id));
    const pick = list.find((c) => !usedIds.has(c.id));
    if (pick) {
      out.inbound_call_id = pick.id;
      if (!out.caller_phone) { const p = strictPhone(pick.caller_phone); if (p && !REPEATED.test(p)) out.caller_phone = p; }
    }
  } catch (e) {
    console.warn('[call_live_start] inbound call link skipped:', e.message);
  }
  return out;
}
