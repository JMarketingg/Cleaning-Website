import { serviceClient } from './_lib/supabase.js';
import { resolveGoogleReviewUrl } from './_lib/google-review-url.js';
const REVIEW_ASK_ROLLOUT = { slug: 'tidyhaus', area: /houston/i, techFirst: 'juan' };
import { signToken, verifyToken, getBearer, applyCors, refreshToken, TECH_SESSION_MAX } from './_lib/auth.js';
import { ensureReviewToken, reviewRequestSms, reviewTechName } from './_lib/review-token.js';
import { debitForJob, adjust as ledgerAdjust, recount as ledgerRecount, isInventoryExempt } from './_lib/bracket-moves.js';
import { bracketPrefill, parseBracketsUsed, checkBracketsUsed, bracketMismatchNote, applyConfirmedBrackets, moveBookingCharge, lastSelfCounts, removedBracketNotes } from './_lib/bracket-confirm.js';
import { detectWirePlateQty, applyPlatesForJob, plateRecount } from './_lib/plate-moves.js';
import { smsNotificationsOn } from './_lib/notify.js';
import { revertCash } from './_lib/cash-revert.js';
import { demoMode } from './_lib/demo.js';
import { toE164, sendSMS, sendSMSResult, logAutomatedMessage } from './_lib/sms.js';
import { sendEnRouteSms, DEFAULT_ETA_MINUTES } from './_lib/en-route.js';
import { emailConfig, sendEmail, brandFor, reviewEmail, EMAIL_BRANDS } from './_lib/email.js';
import { sendReviewBonusEarnedAlert, sendTechJoinedAlert } from './_lib/owner-notify.js';
import { normalizeInviteCode, newInviteCode, INVITE_TTL_DAYS, inviteState, inviteBrand, digits10, firstName, weakPin, welcomeSmsText, sendTechSms, smsFailReason } from './_lib/tech-invite.js';
import { publicQuestions, gradeAnswers, RETAKE_COOLDOWN_HOURS, HIRING } from './_lib/apply-quiz.js';
import { localDayStartUTC, localDateStartUTC, addDaysStr, startOfWeekUTC } from './_lib/time.js';
import { SLOTS, SLOT_KEYS, DAYS, normalizeSlots, assertDate, dayOfWeekFor, computeExceptionRows, slotKeyForLocalTime, localHHMM, localDateStr } from './_lib/availability.js';
import { stripe, stripeConfigured, findCardOnFileByEmail, defaultPaymentMethod, saveCardOnFile, resolveChargeablePm, findLandedCharge, chargeCardOnFile, pendingIntentState, retrieveCard } from './_lib/stripe.js';
import { saveAuthorization, TERMS_VERSION } from './_lib/authorization.js';
import { canonicalizeLineItems, isTaxLine, BOOKING_TAX_RATE, casBumpLiRev, bumpLiRev, clampBracketQtysToTvCount, LI_CONFLICT_CODE } from './_lib/line-items.js';

const STRIPE_PK_GLOBAL = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY';
function jobStripePk(slug) {
  if (slug === 'doms') return process.env.DOMS_STRIPE_PUBLISHABLE_KEY || null;
  return STRIPE_PK_GLOBAL;
}
import { uploadImage, deleteImage, readPrivateImage, notePhotoContentType, signVideoUpload, videoPublicUrl, deleteVideo } from './_lib/storage.js';
import { denverToday, noteIsLive, isPrivateNotePhoto } from './_lib/notes.js';
import { computeJobPay, PAY_DATE_OFFSET_DAYS, isJuan, isRetired } from './_lib/payroll.js';
import { partsMoney, partsCorrectionsFor, partsPaymentSnapshot, partsAdjustmentDetail } from './_lib/payroll-parts.js';
import { isHoustonBooking } from './_lib/houston-bonus.js';
import { formatAddress, isLikelyStreetAddress } from './_lib/address.js';
import { techIcs, calTechId, calLinks } from './_lib/tech-calendar.js';
import { bookingUpdate as officeBookingUpdate } from './admin.js';
import { scammerList } from './_lib/scammer.js';

const MIN_PHOTOS_TO_COMPLETE = 2;

let techHasSecondCol = true;
let techHasStripeAcctCol = true;
let techHasExtraCol = true;
const esCol = () => (techHasExtraCol ? ', extra_slots' : '');
const esOf = (b) => (techHasExtraCol && Array.isArray(b && b.extra_slots)) ? b.extra_slots : [];
const isExtraErr = (e) => !!(e && e.code === '42703' && /extra_slots/.test(e.message || ''));
function scopeMine(q, auth) {
  return techHasSecondCol
    ? q.or(`technician_id.eq.${auth.tech_id},secondary_technician_id.eq.${auth.tech_id}`)
    : q.eq('technician_id', auth.tech_id);
}
async function fetchMine(build) {
  let r = await build();
  if (r.error && r.error.code === '42703' && /secondary_technician_id/.test(r.error.message || '')) {
    techHasSecondCol = false;
    r = await build();
  }
  return r;
}


const TECH_STATUS = {
  on_the_way:  { tech: 'on_job',    stamp: 'on_the_way_at' },
  completed:   { tech: 'available', stamp: 'completed_at' },
};
const STATUS_RANK = { pending: 0, confirmed: 0, assigned: 0, on_the_way: 1, arrived: 2, in_progress: 3, completed: 4 };
const TERMINAL_STATUS = new Set(['completed', 'cancelled', 'no_show']);

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = (req.query.action || (req.body && req.body.action) || '').toString();
  const body = req.body || {};

  try {
    if (action === 'login') return await login(req, res, body);
    if (action === 'diagnostic') return await diagnostic(req, res);
    if (action === 'join_info') return await joinInfo(req, res);
    if (action === 'join_complete') return await joinComplete(req, res, body);
    if (action === 'apply_start') return await applyStart(req, res, body);
    if (action === 'apply_submit') return await applySubmit(req, res, body);
    if (action === 'calendar') {
      const techId = calTechId(req.query.t);
      if (!techId) return res.status(401).send('Invalid calendar link');
      const ics = await techIcs(serviceClient(), techId);
      if (!ics) return res.status(404).send('Calendar not available');
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Content-Disposition', 'inline; filename="my-jobs.ics"');
      return res.status(200).send(ics);
    }

    const auth = verifyToken(action === 'note_photo' ? (getBearer(req) || (req.query.token || '').toString()) : getBearer(req));
    if (!auth || auth.kind !== 'tech') return res.status(401).json({ error: 'Unauthorized' });

    const db = serviceClient();
    switch (action) {
      case 'critical_alerts': {
        const { data } = await db.from('critical_alerts').select('id, caller_phone, customer_name, reason, excerpt, created_at').eq('technician_id', auth.tech_id).is('handled_at', null).order('created_at', { ascending: false }).limit(10);
        return res.status(200).json({ alerts: data || [] });
      }
      case 'critical_handle': {
        const { data: me } = await db.from('technicians').select('name').eq('id', auth.tech_id).maybeSingle();
        await db.from('critical_alerts').update({ handled_by: (me && me.name ? me.name : 'Tech') + ' (tech)', handled_at: new Date().toISOString() }).eq('id', String((body && body.id) || '')).eq('technician_id', auth.tech_id).is('handled_at', null);
        return res.status(200).json({ ok: true });
      }
      case 'jobs':             return await jobs(req, res, db, auth);
      case 'estimate_notes_save': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { data: b } = await fetchMine(() => scopeMine(db.from('bookings').select('id, metadata, price'), auth).eq('id', String(body.id || '')).maybeSingle());
        if (!b) return res.status(404).json({ error: 'Job not found' });
        const t = (v, n) => String(v || '').trim().slice(0, n);
        const notes = { goal: t(body.goal, 1000), why: t(body.why, 1000), parts: t(body.parts, 2000),
          labor: Math.round(Math.max(0, Number(body.labor) || 0) * 100) / 100, by: auth.name || null, at: new Date().toISOString() };
        if (!notes.goal || !notes.why || !notes.parts || !(notes.labor > 0)) return res.status(400).json({ error: 'Answer all four questions.' });
        const { error } = await db.from('bookings').update({ metadata: { ...(b.metadata || {}), estimate_visit_notes: notes } }).eq('id', b.id);
        if (error) throw error;
        return res.status(200).json({ ok: true, notes });
      }
      case 'calendar_link':    return res.status(200).json(calLinks(auth.tech_id));
      case 'vip_phones': { const { data } = await db.from('vip_phones').select('phone, paid_jobs'); const scam = await scammerList(db); return res.status(200).json({ counts: Object.fromEntries((data || []).map((r) => [r.phone, r.paid_jobs])), scam: [...scam.phones] }); }
      case 'job':              return await job(req, res, db, auth);
      case 'status':           return await status(req, res, db, auth, body);
      case 'job_line_items_save': return await jobLineItemsSave(req, res, db, auth, body);
      case 'job_payment':      return await jobPayment(req, res, db, auth, body);
      case 'job_card_update':  return await jobCardUpdate(req, res, db, auth, body);
      case 'job_bracket_supplier': return await jobBracketSetSupplier(req, res, db, auth, body);
      case 'job_slots':        return await jobSlots(req, res, db, auth, body);
      case 'job_photos':       return await jobPhotos(req, res, db, auth);
      case 'job_photo_add':    return await jobPhotoAdd(req, res, db, auth, body);
      case 'job_photo_delete': return await jobPhotoDelete(req, res, db, auth, body);
      case 'job_video_sign':   return await jobVideoSign(req, res, db, auth, body);
      case 'job_video_add':    return await jobVideoAdd(req, res, db, auth, body);
      case 'job_notes':        return await jobNotes(req, res, db, auth);
      case 'job_note_add':     return await jobNoteAdd(req, res, db, auth, body);
      case 'job_note_delete':  return await jobNoteDelete(req, res, db, auth, body);
      case 'availability':     return await getAvailability(req, res, db, auth);
      case 'availability_set': return await setAvailability(req, res, db, auth, body);
      case 'availability_exception_set': return await setAvailabilityException(req, res, db, auth, body);
      case 'tech_payroll':     return await techPayroll(req, res, db, auth);
      case 'tech_reviews':     return await techReviews(req, res, db, auth);
      case 'tech_google_reviews_unseen': return await techGoogleReviewsUnseen(req, res, db, auth);
      case 'tech_google_review_dismiss': return await techGoogleReviewDismiss(req, res, db, auth, body);
      case 'bracket_inventory': return await bracketInventory(req, res, db, auth);
      case 'bracket_inventory_set': return await bracketInventorySet(req, res, db, auth, body);
      case 'review_listings': return await techReviewListings(req, res, db, auth);
      case 'review_checkin_set': return await techReviewCheckinSet(req, res, db, auth, body);
      case 'tech_notes_active':  return await techNotesActive(req, res, db, auth);
      case 'note_photo':         return await techNotePhoto(req, res, db, auth);
      case 'tech_note_dismiss':  return await techNoteDismiss(req, res, db, auth, body);
      case 'tech_bonus_unseen': return await techBonusUnseen(req, res, db, auth);
      case 'tech_bonus_ack':    return await techBonusAck(req, res, db, auth, body);
      case 'me': return await me(req, res, db, auth);
      case 'reschedule_access': return res.status(200).json({ can_reschedule_anytime: await canRescheduleAnytime(db, auth) });
      case 'job_reschedule': return await jobReschedule(req, res, db, auth, body);
      case 'wire_plate_set': return await wirePlateSet(req, res, db, auth, body);
      case 'bracket_receive': return await bracketReceive(req, res, db, auth, body);
      default:                 return res.status(400).json({ error: `Unknown action "${action}"` });
    }
  } catch (err) {
    console.error('[tech]', action, err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

async function login(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rawPhone = (body.phone || '').toString().trim();
  const pin = (body.pin || '').toString().trim();
  if (!rawPhone || !pin) return res.status(400).json({ error: 'Phone and PIN required' });

  const db = serviceClient();
  const digits = rawPhone.replace(/\D/g, '');
  const national = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  const candidates = [...new Set([
    toE164(rawPhone),
    rawPhone,
    digits,
    national,
  ].filter(Boolean))];

  let tech = null, error = null;
  for (const cand of candidates) {
    const r = await db.rpc('verify_technician_pin', { p_phone: cand, p_pin: pin });
    if (r.error) { error = r.error; break; }
    const t = Array.isArray(r.data) ? r.data[0] : r.data;
    if (t) { tech = t; break; }
  }
  if (error) throw error;
  if (!tech) return res.status(401).json({ error: 'Incorrect phone or PIN' });

  const token = signToken({ kind: 'tech', tech_id: tech.id, business_id: tech.business_id, sess: 1 });
  let slug = '', tz = 'Asia/Manila';
  try {
    const { data: biz } = await db.from('businesses').select('slug, timezone').eq('id', tech.business_id).single();
    slug = biz?.slug || '';
    tz = biz?.timezone || 'Asia/Manila';
  } catch { /* slug/tz are cosmetic — ignore lookup failures */ }
  return res.status(200).json({
    token,
    technician: { id: tech.id, name: tech.name, status: tech.status, slug, tz, demo: demoMode(),
                  company_name: brandName(slug, null) },
  });
}

function brandName(slug, fallback) {
  return (EMAIL_BRANDS[slug] && EMAIL_BRANDS[slug].name) || fallback || null;
}

async function diagnostic(req, res) {
  const db = serviceClient();
  const { data, error } = await db.from('technicians')
    .select('id, name, phone, active, pin_hash')
    .eq('active', true)
    .order('name');
  if (error) throw error;

  const ready = [];
  const missing = [];

  for (const t of data || []) {
    const issues = [];
    if (!t.phone) issues.push('missing phone');
    if (!t.pin_hash) issues.push('missing PIN');

    if (issues.length) {
      missing.push({ id: t.id, name: t.name, stored_phone: t.phone || null, issues });
    } else {
      ready.push({ id: t.id, name: t.name, stored_phone: t.phone });
    }
  }

  return res.status(200).json({ ready, missing, total_active: data?.length || 0 });
}

async function jobs(req, res, db, auth) {
  const { data: biz } = await db.from('businesses').select('timezone').eq('id', auth.business_id).single();
  const tz = biz?.timezone || 'Asia/Manila';
  const reDate = /^\d{4}-\d{2}-\d{2}$/;

  const from = reDate.test((req.query.from || '').toString()) ? req.query.from : null;
  const to = reDate.test((req.query.to || '').toString()) ? req.query.to : null;
  const dateStr = reDate.test((req.query.date || '').toString()) ? req.query.date : null;

  let lo, hi;
  if (from && to) {
    lo = localDateStartUTC(tz, from);
    hi = localDateStartUTC(tz, addDaysStr(to, 1));
  } else if (dateStr) {
    lo = localDateStartUTC(tz, dateStr);
    hi = localDateStartUTC(tz, addDaysStr(dateStr, 1));
  } else {
    lo = localDayStartUTC(tz, 0);
    hi = localDayStartUTC(tz, 1);
  }

  const build = () => scopeMine(db.from('bookings')
    .select(`id, status, scheduled_at, scheduled_end, customer_notes, notes,
             address_line1, address_line2, city, state, postal_code, lat, lng, business_id, service_area_id,
             customer:customers ( name, phone ),
             service:services ( name ),
             business:businesses ( name, slug, timezone ),
             line_items:booking_line_items ( name, kind )`), auth)
    .neq('status', 'cancelled')
    .gte('scheduled_at', lo.toISOString())
    .lt('scheduled_at', hi.toISOString())
    .order('scheduled_at', { ascending: true });
  const { data, error } = await fetchMine(build);
  if (error) throw error;

  const tzById = await areaTzMap(db, (data || []).map(b => b.service_area_id));
  const jobs = (data || []).map(b => {
    const j = shapeJob(b);
    const jtz = tzById[b.service_area_id] || b.business?.timezone || tz;
    j.local_date = localDateInTz(jtz, j.scheduled_at);
    j.slot_time = slotTimeLabel(jtz, j.scheduled_at);
    j.cross_company = !!(b.business_id && b.business_id !== auth.business_id);
    j.company_name = brandName(b.business?.slug, b.business?.name);
    j.company_slug = b.business?.slug || null;
    return j;
  });
  return res.status(200).json({ jobs, tz });
}

function localDateInTz(tz, iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function slotTimeLabel(areaTz, iso) {
  if (!iso || !areaTz) return null;
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: areaTz, hour12: false, hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(iso)).reduce((a, x) => (a[x.type] = x.value, a), {});
    const mins = ((p.hour === '24' ? 0 : Number(p.hour)) * 60) + Number(p.minute);
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const to12 = (s) => { let [h, m] = s.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
    for (const s of SLOTS) if (mins >= toMin(s.start) && mins < toMin(s.end)) return to12(s.start);
    for (const s of SLOTS) if (toMin(s.start) === mins) return to12(s.start);
    return new Intl.DateTimeFormat('en-US', { timeZone: areaTz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  } catch { return null; }
}

async function areaTzMap(db, ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const out = {};
  if (!uniq.length) return out;
  try {
    const { data } = await db.from('service_areas').select('id, timezone').in('id', uniq);
    for (const a of (data || [])) out[a.id] = a.timezone;
  } catch { /* fall back to business tz per job */ }
  return out;
}

async function debugIdentity(req, res, db, auth) {
  const { data: biz } = await db.from('businesses')
    .select('slug, name, timezone').eq('id', auth.business_id).single();
  const tz = biz?.timezone || 'Asia/Manila';
  const { data: me } = await db.from('technicians')
    .select('id, name, business_id, status').eq('id', auth.tech_id).single();

  const { data: mine } = await db.from('bookings')
    .select('id, status, scheduled_at, business_id')
    .eq('technician_id', auth.tech_id)
    .order('scheduled_at', { ascending: false }).limit(20);

  const { data: bizBookings } = await db.from('bookings')
    .select('id, status, scheduled_at, business_id, technician_id, technician:technicians!technician_id ( name )')
    .eq('business_id', auth.business_id)
    .order('scheduled_at', { ascending: false }).limit(20);

  const todayLocal = localDateInTz(tz, new Date().toISOString());
  const dow = new Date(todayLocal + 'T12:00:00Z').getUTCDay();
  const weekFrom = addDaysStr(todayLocal, -dow);
  const weekTo = addDaysStr(weekFrom, 6);
  const lo = localDateStartUTC(tz, weekFrom);
  const hi = localDateStartUTC(tz, addDaysStr(weekTo, 1));
  const { data: weekData, error: weekErr } = await db.from('bookings')
    .select('id, scheduled_at, status')
    .eq('business_id', auth.business_id)
    .eq('technician_id', auth.tech_id)
    .neq('status', 'cancelled')
    .gte('scheduled_at', lo.toISOString())
    .lt('scheduled_at', hi.toISOString());

  return res.status(200).json({
    you: {
      tech_id: auth.tech_id,
      tech_name: me?.name || null,
      token_business_id: auth.business_id,
      tech_record_business_id: me?.business_id || null,
      business_slug: biz?.slug || null,
      business_name: biz?.name || null,
      business_tz: tz,
    },
    week_test: {
      week_from: weekFrom, week_to: weekTo,
      window_lo: lo.toISOString(), window_hi: hi.toISOString(),
      jobs_found: (weekData || []).length,
      error: weekErr?.message || null,
    },
    assigned_to_you_count: (mine || []).length,
    assigned_to_you: (mine || []).map(b => ({
      id: b.id, status: b.status, scheduled_at: b.scheduled_at,
      local_date: localDateInTz(tz, b.scheduled_at),
    })),
    business_bookings_count: (bizBookings || []).length,
    business_bookings: (bizBookings || []).map(b => ({
      id: b.id, status: b.status, scheduled_at: b.scheduled_at,
      local_date: localDateInTz(tz, b.scheduled_at),
      business_id: b.business_id, technician_id: b.technician_id,
      assigned_tech_name: b.technician?.name || null,
      assigned_to_you: b.technician_id === auth.tech_id,
    })),
  });
}

async function job(req, res, db, auth) {
  const id = (req.query.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const build = (withSortCol) => () => scopeMine(db.from('bookings')
    .select(`id, status, scheduled_at, created_at, scheduled_end, customer_notes, notes, price, metadata, sms_consent,
             review_rating, review_text, reviewed_at, business_id, technician_id, service_area_id,
             address_line1, address_line2, city, state, postal_code, lat, lng,
             payment_status, paid_at, tip, stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id,
             customer:customers ( name, phone, email ),
             service:services ( name ),
             business:businesses ( name, slug, timezone ),
             technician:technicians!technician_id ( name ),${techHasSecondCol ? `
             secondary_technician_id,
             secondary_technician:technicians!secondary_technician_id ( name ),` : ''}
             line_items:booking_line_items ( name, quantity, unit_price, line_total, kind${withSortCol ? ', sort_order' : ''} )`), auth)
    .eq('id', id)
    .maybeSingle();
  let { data, error } = await fetchMine(build(true));
  if (error && /sort_order/.test(error.message || '')) ({ data, error } = await fetchMine(build(false)));
  if (error || !data) return res.status(404).json({ error: 'Job not found' });
  const shaped = shapeJob(data, true, true);
  shaped.estimate_visit = Number(data.price) === 50;
  shaped.estimate_notes = (data.metadata && data.metadata.estimate_visit_notes) || null;
  shaped.booked_by = (data.metadata && data.metadata.booked_by) || null;
  shaped.cross_company = !!(data.business_id && data.business_id !== auth.business_id);
  shaped.company_name = brandName(data.business?.slug, data.business?.name);
  shaped.company_slug = data.business?.slug || null;
  try {
    const [{ data: biz }, { data: area }] = await Promise.all([
      db.from('businesses').select('settings').eq('id', data.business_id).maybeSingle(),
      data.service_area_id ? db.from('service_areas').select('name').eq('id', data.service_area_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const g = REVIEW_ASK_ROLLOUT;
    shaped.review_ask_enabled = !g || ((data.business?.slug === g.slug) &&
      (g.area.test(area?.name || '') || (data.technician?.name || '').trim().toLowerCase().split(/\s+/)[0] === g.techFirst));
    shaped.review_url = (biz?.settings && biz.settings.review_url) || resolveGoogleReviewUrl({
      slug: data.business?.slug || 'tidyhaus', techName: data.technician?.name || '', areaName: area?.name || '',
      bookingId: data.id, state: data.state, city: data.city, zip: data.postal_code,
    });
  } catch { shaped.review_url = null; shaped.review_ask_enabled = false; }
  {
    const jtz = (await areaTzMap(db, [data.service_area_id]))[data.service_area_id]
      || data.business?.timezone || 'Asia/Manila';
    shaped.slot_time = slotTimeLabel(jtz, data.scheduled_at);
  }
  shaped.stripe_pk = jobStripePk(data.business?.slug || null);
  const primaryName = data.technician?.name || null;
  const secondaryName = data.secondary_technician?.name || null;
  if (primaryName && secondaryName) {
    shaped.partner_tech = (data.technician_id === auth.tech_id) ? secondaryName : primaryName;
  } else {
    shaped.partner_tech = null;
  }
  shaped.bracket = null;
  const need = detectBracketQtys(data.line_items || []);
  const bu = data.metadata?.brackets_used;
  const charged = bu?.confirmed_at ? { flat: bu.flat || 0, tilting: bu.tilting || 0, full_motion: bu.full_motion || 0 } : need;
  if (data.secondary_technician_id && bracketTotal(charged) > 0 && !(await allJobTechsExempt(db, data.technician_id, data.secondary_technician_id))) {
    try {
      const { data: bs, error: bsErr } = await db.from('bookings').select('bracket_supplied_by').eq('id', id).maybeSingle();
      if (!bsErr) {
        const techs = [];
        if (data.technician_id) techs.push({ id: data.technician_id, name: data.technician?.name || 'Technician' });
        if (data.secondary_technician_id) techs.push({ id: data.secondary_technician_id, name: data.secondary_technician?.name || 'Technician' });
        const suppliedBy = bs?.bracket_supplied_by || null;
        shaped.bracket = {
          needed: true,
          label: bracketLabel(charged),
          techs,
          supplied_by: suppliedBy,
          supplied_by_name: (techs.find(t => t.id === suppliedBy) || {}).name || null,
        };
      }
    } catch (e) { /* 0035 not applied — leave bracket null */ }
  }
  shaped.bracket_confirm = null;
  if (data.status !== 'completed') {
    const pf = bracketPrefill(data.line_items || [], need, bu);
    if (pf.tv_count > 0 && !(await allJobTechsExempt(db, data.technician_id, data.secondary_technician_id))) {
      if (data.secondary_technician_id) {
        pf.techs = [
          { id: data.technician_id, name: data.technician?.name || 'Technician' },
          { id: data.secondary_technician_id, name: data.secondary_technician?.name || 'Technician' },
        ].filter(t => t.id);
        try {
          const { data: bs } = await db.from('bookings').select('bracket_supplied_by').eq('id', id).maybeSingle();
          pf.supplier = bs?.bracket_supplied_by || null;
        } catch (_) { pf.supplier = null; }
      }
      shaped.bracket_confirm = pf;
    }
  }
  shaped.plate_confirm = null;
  if (data.status !== 'completed') {
    const ticketPlates = detectWirePlateQty(data.line_items || []);
    if ((shaped.bracket_confirm || ticketPlates > 0) && !(await allJobTechsExempt(db, data.technician_id, data.secondary_technician_id))) {
      const pu = data.metadata?.plates_used;
      shaped.plate_confirm = { qty: pu?.confirmed_at ? (Number(pu.qty) || 0) : ticketPlates, ticket: ticketPlates };
    }
  }

  shaped.tech_pay = null;
  shaped.travel_bonus = 0;
  try {
    const viewerName = (data.technician_id === auth.tech_id)
      ? (data.technician?.name || null)
      : (data.secondary_technician?.name || data.technician?.name || null);
    const travelMap = await travelPayoutMap(db, data.business_id);
    const pay = computeJobPay({
      status: 'completed',
      payment_status: 'paid',
      price: data.price,
      tip: data.tip,
      notes: data.notes,
      customer_notes: data.customer_notes,
      service_name: data.service?.name || '',
      business_slug: data.business?.slug || '',
      line_items: data.line_items || [],
      scheduled_at: data.scheduled_at,
      created_at: data.created_at,
      travel_payout: travelMap.get(String(data.postal_code || '')) || 0,
      second_tech: !!data.secondary_technician_id,
      is_secondary: data.secondary_technician_id === auth.tech_id && data.technician_id !== auth.tech_id,
      is_houston: await isHoustonBooking(db, data.business_id, data.business?.slug, data.service_area_id),
    }, viewerName);
    shaped.tech_pay = Math.round((Number(pay.total) || 0) * 100) / 100;
    const tb = (pay.breakdown || []).find(x => /travel/i.test(x.label || ''));
    shaped.travel_bonus = tb ? Math.round(Number(tb.amount) || 0) : 0;
    shaped.tip_pay = Math.round((Number(pay.tip) || 0) * 100) / 100;
  } catch (e) { shaped.tech_pay = null; }

  shaped.slots = null;
  if (data.scheduled_at) {
    try {
      const jtz = (await areaTzMap(db, [data.service_area_id]))[data.service_area_id]
        || data.business?.timezone || 'Asia/Manila';
      const dateStr = localDateStr(jtz, data.scheduled_at);
      const mainSlot = slotKeyForLocalTime(localHHMM(jtz, data.scheduled_at));
      let current = [];
      const { data: es, error: esErr } = await db.from('bookings')
        .select(`id${esCol()}`).eq('id', id).maybeSingle();
      if (esErr && isExtraErr(esErr)) techHasExtraCol = false;
      else if (!esErr) current = esOf(es);
      const takenByOthers = await takenSlotsForTech(db, auth.tech_id, jtz, dateStr, id);
      const mainIdx = SLOTS.findIndex(s => s.key === mainSlot);
      const addable = SLOTS
        .filter((s, i) => i > mainIdx && !current.includes(s.key) && !takenByOthers.has(s.key))
        .map(s => ({ slot_key: s.key, label: s.label }));
      shaped.slots = {
        available: techHasExtraCol,
        main_slot: mainSlot,
        main_label: (SLOTS.find(s => s.key === mainSlot) || {}).label || null,
        extra: current.map(k => ({ slot_key: k, label: (SLOTS.find(s => s.key === k) || {}).label || k })),
        addable,
      };
    } catch (e) { shaped.slots = null; }
  }

  shaped.has_signature = false;
  shaped.signature_waived = !!data.metadata?.signature_waived;
  shaped.paid_card_last4 = null;
  shaped.amount_paid = null;
  try {
    const { data: sa } = await db.from('booking_authorizations').select('id')
      .eq('booking_id', id).not('signature_url', 'is', null).limit(1);
    shaped.has_signature = !!(sa && sa.length);
    if (!shaped.has_signature && data.payment_status === 'paid') {
      const { data: pr } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
      shaped.amount_paid = Number(pr?.amount_paid ?? data.price) || 0;
      const { data: a1 } = await db.from('booking_authorizations').select('card_last4')
        .eq('booking_id', id).not('card_last4', 'is', null).limit(1);
      shaped.paid_card_last4 = a1?.[0]?.card_last4 || null;
      if (!shaped.paid_card_last4 && pr?.payment_method !== 'cash' && data.stripe_payment_method_id) {
        try {
          const c = await retrieveCard(data.stripe_payment_method_id, { account: pr?.stripe_account || null, slug: data.business?.slug || null });
          shaped.paid_card_last4 = c.last4 || null;
        } catch (_) { /* unknown card */ }
      }
    }
  } catch (_) { /* leave defaults */ }

  shaped.can_undo_cash = false;
  try {
    if (data.payment_status === 'paid' && !data.stripe_payment_intent_id) {
      const { data: pm } = await db.from('bookings').select('payment_method').eq('id', id).maybeSingle();
      const tz = data.business?.timezone || 'Asia/Manila';
      shaped.can_undo_cash = pm?.payment_method === 'cash' && !!data.paid_at
        && localDateInTz(tz, data.paid_at) === localDateInTz(tz, new Date().toISOString());
    }
  } catch (_) { /* hide undo */ }

  return res.status(200).json({ job: shaped });
}

async function takenSlotsForTech(db, techId, tz, dateStr, excludeId) {
  const taken = new Set();
  const winStart = localDateStartUTC(tz, dateStr).toISOString();
  const winEnd = localDateStartUTC(tz, addDaysStr(dateStr, 1)).toISOString();
  const build = () => scopeMine(db.from('bookings')
    .select(`id, scheduled_at, status${esCol()}`), { tech_id: techId })
    .neq('status', 'cancelled').not('scheduled_at', 'is', null)
    .gte('scheduled_at', winStart).lt('scheduled_at', winEnd);
  let { data, error } = await build();
  if (error && isExtraErr(error)) { techHasExtraCol = false; ({ data, error } = await build()); }
  if (error) return taken;
  for (const b of (data || [])) {
    if (b.id === excludeId) continue;
    if (localDateStr(tz, b.scheduled_at) !== dateStr) continue;
    const k = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
    if (k) taken.add(k);
    for (const sk of esOf(b)) taken.add(sk);
  }
  return taken;
}

async function jobSlots(req, res, db, auth, body) {
  const id = (req.query.id || (body && body.id) || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });

  const build = () => scopeMine(db.from('bookings')
    .select(`id, scheduled_at, service_area_id, business:businesses ( timezone ), status${esCol()}`), auth)
    .eq('id', id).maybeSingle();
  let { data: b, error } = await build();
  if (error && isExtraErr(error)) { techHasExtraCol = false; ({ data: b, error } = await build()); }
  if (error || !b) return res.status(404).json({ error: 'Job not found' });
  if (!techHasExtraCol) return res.status(400).json({ error: 'Extra time slots need migration 0052 applied first.' });
  if (!b.scheduled_at) return res.status(400).json({ error: 'This job has no scheduled time yet.' });

  const jtz = (await areaTzMap(db, [b.service_area_id]))[b.service_area_id]
    || b.business?.timezone || 'Asia/Manila';
  const dateStr = localDateStr(jtz, b.scheduled_at);
  const mainSlot = slotKeyForLocalTime(localHHMM(jtz, b.scheduled_at));
  const mainIdx = SLOTS.findIndex(s => s.key === mainSlot);
  if (mainIdx < 0) return res.status(400).json({ error: "This job's time doesn't line up with a standard slot." });
  const takenByOthers = await takenSlotsForTech(db, auth.tech_id, jtz, dateStr, id);

  const requested = Array.isArray(body && body.slots) ? body.slots.map(String) : [];
  const clean = [];
  for (const sk of requested) {
    if (!SLOT_KEYS.has(sk)) return res.status(400).json({ error: `Invalid time slot: ${sk}` });
    if (sk === mainSlot) continue;
    const idx = SLOTS.findIndex(s => s.key === sk);
    if (idx <= mainIdx) return res.status(400).json({ error: 'You can only reserve time slots after this job starts.' });
    if (takenByOthers.has(sk)) {
      const lab = (SLOTS.find(s => s.key === sk) || {}).label || sk;
      return res.status(409).json({ error: `${lab} is already booked for you — can't reserve it.` });
    }
    if (!clean.includes(sk)) clean.push(sk);
  }
  const { error: uErr } = await db.from('bookings').update({ extra_slots: clean }).eq('id', b.id);
  if (uErr) { if (isExtraErr(uErr)) { techHasExtraCol = false; return res.status(400).json({ error: 'Extra time slots need migration 0052 applied first.' }); } throw uErr; }
  return res.status(200).json({ ok: true, id: b.id, extra_slots: clean });
}

function sanitizeWorkLineItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(it => {
    const name = ((it && (it.name != null ? it.name : it.label)) || '').toString().trim().slice(0, 300);
    const qty = Math.max(1, Math.min(99, Math.round(Number(it && it.quantity) || 1)));
    const unit = Math.round((Number(it && (it.unit_price != null ? it.unit_price : (it.price != null ? it.price : it.line_total))) || 0) * 100) / 100;
    const line_total = Math.round(unit * qty * 100) / 100;
    return { name, quantity: qty, unit_price: unit, line_total };
  }).filter(it => it.name || it.unit_price);
}

async function jobLineItemsSave(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });

  const build = () => scopeMine(db.from('bookings')
    .select('id, business_id, metadata, line_items:booking_line_items ( id, kind, name, quantity, unit_price, line_total, taxable )'), auth)
    .eq('id', id).maybeSingle();
  const { data: bk, error } = await fetchMine(build);
  if (error || !bk) return res.status(404).json({ error: 'Job not found' });
  const bizId = bk.business_id;

  const existing = Array.isArray(bk.line_items) ? bk.line_items : [];
  const visibleIds = existing.filter(li => !isHiddenLi(li)).map(li => li.id);

  const items = sanitizeWorkLineItems(body.items);

  if (!items.length && visibleIds.length) {
    return res.status(400).json({ error: 'This would remove every work item from the job. Pull down to refresh and try again, or ask the office to edit the ticket.' });
  }

  const curRev = Number(bk.metadata?.li_rev) || 0;
  if (body.li_rev == null) {
    return res.status(409).json({
      error: 'The app is out of date on this job — refresh it (pull down, or close and reopen the app), then redo the change.',
      code: LI_CONFLICT_CODE,
    });
  }
  if (Number(body.li_rev) !== curRev) {
    return res.status(409).json({
      error: 'The office changed this ticket after you opened it. The job will reload — check the items, then redo your change.',
      code: LI_CONFLICT_CODE,
    });
  }

  const backups = Array.isArray(bk.metadata?.li_backups) ? bk.metadata.li_backups.slice() : [];
  backups.push({
    at: new Date().toISOString(), by: `tech:${auth.tech_id || auth.name || '?'}`,
    items: existing.map(r => ({ kind: r.kind, name: r.name, quantity: r.quantity, unit_price: r.unit_price, line_total: r.line_total, taxable: r.taxable })),
  });
  let newRev;
  try {
    const cas = await casBumpLiRev(db, id, bk.metadata, { li_backups: backups.slice(-5) });
    if (!cas.ok) {
      return res.status(409).json({
        error: 'The office saved this ticket at the same moment. The job will reload — check the items, then redo your change.',
        code: LI_CONFLICT_CODE,
      });
    }
    newRev = cas.rev;
  } catch (e) {
    console.error(`[tech line_items] li_rev CAS failed for booking ${id}:`, e.message);
    return res.status(500).json({ error: 'Could not save right now — try again in a moment.' });
  }
  console.log(`[tech line_items] save booking=${id} by=tech:${auth.tech_id || '?'} visibleBefore=${visibleIds.length} after=${items.length}`);

  if (items.length) {
    const rows = items.map((it, i) => ({
      booking_id: id, business_id: bizId,
      kind: 'service', name: it.name,
      quantity: it.quantity, unit_price: it.unit_price, line_total: it.line_total,
      taxable: true, sort_order: 1000 + i,
    }));
    let { error: insErr } = await db.from('booking_line_items').insert(rows);
    if (insErr && /sort_order/.test(insErr.message || '')) {
      ({ error: insErr } = await db.from('booking_line_items').insert(rows.map(({ sort_order, ...r }) => r)));
    }
    if (insErr) throw insErr;
  }

  if (visibleIds.length) {
    const { error: delErr } = await db.from('booking_line_items').delete().in('id', visibleIds);
    if (delErr) {
      console.error(`[tech line_items] delete-after-insert failed for booking ${id} — duplicate rows visible, resave to fix:`, delErr.message);
      throw delErr;
    }
  }

  let sortOrderOk = true;
  let { data: all, error: sumErr } = await db.from('booking_line_items')
    .select('id, kind, name, quantity, unit_price, line_total, taxable, sort_order')
    .eq('booking_id', id).order('sort_order', { ascending: true });
  if (sumErr && /sort_order/.test(sumErr.message || '')) {
    sortOrderOk = false;
    ({ data: all, error: sumErr } = await db.from('booking_line_items')
      .select('id, kind, name, quantity, unit_price, line_total, taxable')
      .eq('booking_id', id).order('created_at', { ascending: true }));
  }
  if (sumErr) throw sumErr;
  let rowsNow = all || [];

  const taxRows = rowsNow.filter(isTaxLine);
  if (taxRows.length) {
    const base = rowsNow.filter(r => !isTaxLine(r))
      .reduce((t, r) => t + (r.taxable === false ? 0 : (Number(r.line_total) || 0)), 0);
    const tax = Math.round(base * BOOKING_TAX_RATE * 100) / 100;
    const keep = taxRows.find(r => /\(/.test(String(r.name || ''))) || taxRows[0];
    if (Math.abs((Number(keep.line_total) || 0) - tax) >= 0.005) {
      const { error: taxErr } = await db.from('booking_line_items')
        .update({ unit_price: tax, line_total: tax }).eq('id', keep.id);
      if (taxErr) console.error(`[tech line_items] tax recalc failed for booking ${id}:`, taxErr.message);
      else { keep.unit_price = tax; keep.line_total = tax; }
    }
    if (taxRows.length > 1) {
      const extra = taxRows.filter(r => r.id !== keep.id).map(r => r.id);
      const { error: delTaxErr } = await db.from('booking_line_items').delete().in('id', extra);
      if (!delTaxErr) rowsNow = rowsNow.filter(r => !extra.includes(r.id));
    }
  }

  const ordered = canonicalizeLineItems(rowsNow);
  if (sortOrderOk) {
    for (let i = 0; i < ordered.length; i++) {
      if (Number(ordered[i].sort_order) === i) continue;
      const { error: soErr } = await db.from('booking_line_items')
        .update({ sort_order: i }).eq('id', ordered[i].id);
      if (soErr) { console.error(`[tech line_items] sort_order write failed for booking ${id}:`, soErr.message); break; }
    }
  }

  const price = Math.round(ordered.reduce((t, r) => t + (Number(r.line_total) || 0), 0) * 100) / 100;
  const subtotal = Math.round(ordered.reduce((t, r) => t + (isTaxLine(r) ? 0 : (Number(r.line_total) || 0)), 0) * 100) / 100;
  const { error: upErr } = await db.from('bookings').update({ price, subtotal }).eq('id', id);
  if (upErr) throw upErr;

  let sealedRev = null;
  try {
    const { data: freshRow } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
    if (Number(freshRow?.metadata?.li_rev) === newRev) {
      const seal = await casBumpLiRev(db, id, freshRow.metadata);
      if (seal.ok) sealedRev = seal.rev;
    }
  } catch (e) { console.warn(`[tech line_items] seal bump failed for booking ${id}:`, e.message); }

  const removed = removedBracketNotes(body.removed_brackets);
  if (removed) {
    try {
      const { data: who } = await db.from('technicians').select('name').eq('id', auth.tech_id).maybeSingle();
      await db.from('booking_notes').insert({
        business_id: bizId, booking_id: id,
        author_kind: 'technician', author_id: auth.tech_id, author_name: who?.name || 'Technician', body: removed,
      });
    } catch (e) { console.warn(`[tech line_items] bracket-removal note failed for booking ${id}:`, e.message); }
  }

  return res.status(200).json({ ok: true, price, ...(sealedRev != null && { li_rev: sealedRev }) });
}

async function status(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  const next = (body.status || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const map = TECH_STATUS[next];
  if (!map) return res.status(400).json({ error: `Invalid status "${next}"` });

  const build = () => scopeMine(db.from('bookings')
    .select(`id, status, scheduled_at, review_token, sms_consent, metadata, business_id, technician_id, price, payment_status, business:businesses ( slug, name ), customer:customers ( name, phone, email )`), auth)
    .eq('id', id).maybeSingle();
  const { data: existing } = await fetchMine(build);
  if (!existing) return res.status(404).json({ error: 'Job not found' });
  const jobBizId = existing.business_id;

  if (TERMINAL_STATUS.has(existing.status)) {
    return res.status(409).json({ error: `This job is already ${existing.status.replace(/_/g, ' ')} — its status can't be changed from here. Refresh the job list if this doesn't look right.` });
  }
  if (STATUS_RANK[next] < (STATUS_RANK[existing.status] ?? 0)) {
    return res.status(409).json({ error: `This job has already moved past "${next.replace(/_/g, ' ')}" (it's currently ${existing.status.replace(/_/g, ' ')}) — refresh to see its latest status.` });
  }
  if (next === existing.status) {
    return res.status(200).json({ ok: true, status: next });
  }

  let confirmed = null;
  let platesAnswer = null;
  if (next === 'completed') {
    const { count } = await db.from('booking_photos')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', id).eq('business_id', jobBizId);
    if ((count || 0) < MIN_PHOTOS_TO_COMPLETE) {
      return res.status(400).json({ error: `Add at least ${MIN_PHOTOS_TO_COMPLETE} photos before marking this job complete (${count || 0} so far).` });
    }
    const parsed = parseBracketsUsed(body.brackets_used);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (body.plates_used != null && body.plates_used !== '') {
      const n = Number(body.plates_used);
      if (!Number.isInteger(n) || n < 0 || n > 50) return res.status(400).json({ error: 'Bad wire plate count.' });
      platesAnswer = n;
    }
    if (parsed.value) {
      const { data: liNow } = await db.from('booking_line_items').select('name, quantity').eq('booking_id', id);
      const detected = detectBracketQtys(liNow || []);
      const pf = bracketPrefill(liNow || [], detected);
      if (pf.tv_count > 0) {
        const bad = checkBracketsUsed(parsed.value, pf.tv_count);
        if (bad) return res.status(400).json({ error: bad, code: 'bracket_confirm' });
        let crew = null;
        try {
          const { data: c, error: cErr } = await db.from('bookings')
            .select(`technician_id, ${techHasSecondCol ? 'secondary_technician_id, ' : ''}bracket_supplied_by`).eq('id', id).maybeSingle();
          if (!cErr) crew = c;
        } catch (_) { /* pre-0035: fall back to the completing tech */ }
        const orig = crew?.bracket_supplied_by || crew?.technician_id || auth.tech_id;
        let supplier = orig, setSupplier = null;
        const u = parsed.value;
        if (crew?.secondary_technician_id && u.flat + u.tilting + u.full_motion > 0) {
          const want = String(body.brackets_used.supplier || '');
          if (want && [crew.technician_id, crew.secondary_technician_id].includes(want)) { supplier = want; setSupplier = want; }
          else if (!crew.bracket_supplied_by && !(await allJobTechsExempt(db, crew.technician_id, crew.secondary_technician_id))) {
            return res.status(400).json({ error: 'Pick whose stock the bracket came from.', code: 'bracket_confirm' });
          }
        }
        confirmed = { used: u, detected, supplier, orig, setSupplier };
      }
    } else {
      const { data: liNow } = await db.from('booking_line_items').select('name, quantity').eq('booking_id', id);
      const pf = bracketPrefill(liNow || [], detectBracketQtys(liNow || []));
      if (pf.tv_count > 0) {
        let crew = null;
        try {
          const { data: c, error: cErr } = await db.from('bookings')
            .select(`technician_id${techHasSecondCol ? ', secondary_technician_id' : ''}`).eq('id', id).maybeSingle();
          if (!cErr) crew = c;
        } catch (_) { /* fall back to the completer */ }
        if (!(await allJobTechsExempt(db, crew?.technician_id || auth.tech_id, crew?.secondary_technician_id || null))) {
          return res.status(400).json({ error: 'Pick a bracket for each TV.', code: 'bracket_confirm' });
        }
      }
    }
  }

  const patch = { status: next };
  if (map.stamp) patch[map.stamp] = new Date().toISOString();
  if (confirmed?.setSupplier) { patch.bracket_supplied_by = confirmed.setSupplier; patch.bracket_supplied_at = new Date().toISOString(); }

  const { data: won, error: e1 } = await db.from('bookings').update(patch).eq('id', id).eq('status', existing.status).select('id');
  if (e1) throw e1;
  if (!won || !won.length) return res.status(200).json({ ok: true, status: next });

  await db.from('booking_status_events').insert({
    booking_id: id, business_id: jobBizId, technician_id: auth.tech_id,
    status: next, note: body.note || 'Updated by technician',
  });

  if (next === 'completed' && (platesAnswer != null || !existing.metadata?.wire_plate_deducted_at)) {
    try {
      const { data: liRows } = await db.from('booking_line_items')
        .select('name, quantity').eq('booking_id', id);
      const ticket = detectWirePlateQty(liRows || []);
      const qty = platesAnswer != null ? platesAnswer : ticket;
      if (qty > 0 || platesAnswer != null) {
        let chargeTech = confirmed?.supplier || auth.tech_id;
        if (!confirmed) {
          try {
            const { data: sup } = await db.from('bookings')
              .select('bracket_supplied_by').eq('id', id).maybeSingle();
            if (sup?.bracket_supplied_by) chargeTech = sup.bracket_supplied_by;
          } catch (_) { /* pre-0035: completing tech */ }
        }
        const actor = `tech:${auth.tech_id || auth.name || 'tech'}`;
        await applyPlatesForJob(db, {
          businessId: jobBizId, bookingId: id, supplier: chargeTech, qty, actor,
          reason: platesAnswer != null ? 'job completion (confirmed)' : 'job completion',
        });
        const now = new Date().toISOString();
        const { data: fresh } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
        const newMeta = { ...(fresh?.metadata || existing.metadata || {}), wire_plate_deducted_at: now,
          plates_used: { qty, supplier: chargeTech, ...(platesAnswer != null && { confirmed_by: actor, confirmed_at: now }) } };
        await db.from('bookings').update({ metadata: newMeta }).eq('id', id);
        if (platesAnswer != null && platesAnswer !== ticket) {
          const { data: who } = await db.from('technicians').select('name').eq('id', auth.tech_id).maybeSingle();
          await db.from('booking_notes').insert({
            business_id: jobBizId, booking_id: id,
            author_kind: 'technician', author_id: auth.tech_id, author_name: who?.name || 'Technician',
            body: `Wire plates used: ${platesAnswer}. Ticket: ${ticket}.`,
          });
        }
      }
    } catch (e) {
      console.error(`[wireplate] ledger charge failed for booking ${id}:`, e.message);
    }
  }

  if (next === 'completed' && confirmed) {
    try {
      const u = confirmed.used;
      const qtys = { flat: u.flat, tilting: u.tilting, full_motion: u.full_motion };
      const supplier = confirmed.supplier;
      const actor = `tech:${auth.tech_id || auth.name || 'tech'}`;
      const { legacy } = await applyConfirmedBrackets(db, {
        businessId: jobBizId, bookingId: id, supplier, qtys, actor,
        meta: existing.metadata, ticketQtys: confirmed.detected, fallbackSupplier: confirmed.orig,
      });
      const { data: who } = await db.from('technicians').select('name').eq('id', auth.tech_id).maybeSingle();
      const now = new Date().toISOString();
      const { data: fresh } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
      await db.from('bookings').update({
        metadata: { ...(fresh?.metadata || existing.metadata || {}), bracket_deducted_at: now,
          brackets_used: { ...qtys, own: u.own, supplier, confirmed_by: actor, confirmed_by_name: who?.name || null, confirmed_at: now, ...(legacy && { legacy }) } },
      }).eq('id', id);
      const note = bracketMismatchNote(u, confirmed.detected);
      if (note) {
        await db.from('booking_notes').insert({
          business_id: jobBizId, booking_id: id,
          author_kind: 'technician', author_id: auth.tech_id, author_name: who?.name || 'Technician', body: note,
        });
      }
    } catch (e) {
      console.error(`[bracket] confirmed deduction failed for booking ${id}:`, e.message);
    }
  } else if (next === 'completed' && !existing.metadata?.bracket_deducted_at) {
    try {
      const { data: liRows } = await db.from('booking_line_items')
        .select('name, quantity').eq('booking_id', id);
      const need = detectBracketQtys(liRows || []);
      if (bracketTotal(need) > 0) {
        let supplier = auth.tech_id;
        try {
          const { data: sup } = await db.from('bookings')
            .select('bracket_supplied_by, technician_id').eq('id', id).maybeSingle();
          supplier = sup?.bracket_supplied_by || sup?.technician_id || auth.tech_id;
        } catch (_) { /* pre-0035: fall back to the completing tech */ }
        await debitForJob(db, {
          businessId: jobBizId, technicianId: supplier, qtys: need, bookingId: id,
          reason: 'job completion', actor: `tech:${auth.tech_id || auth.name || 'tech'}`,
        });
        const { data: fresh } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
        await db.from('bookings').update({
          metadata: { ...(fresh?.metadata || existing.metadata || {}), bracket_deducted_at: new Date().toISOString(), brackets_used: { flat: need.flat || 0, tilting: need.tilting || 0, full_motion: need.full_motion || 0, supplier } },
        }).eq('id', id);
      }
    } catch (e) {
      console.error(`[bracket] decrement failed for booking ${id}:`, e.message);
    }
  }

  if (next === 'completed' && !existing.metadata?.appletv_bracket_deducted_at) {
    try {
      const { data: liRows } = await db.from('booking_line_items')
        .select('name, quantity').eq('booking_id', id);
      const qty = detectAppleTvBracketQty(liRows || []);
      if (qty > 0) {
        let chargeTech = auth.tech_id;
        try {
          const { data: sup } = await db.from('bookings')
            .select('bracket_supplied_by').eq('id', id).maybeSingle();
          if (sup?.bracket_supplied_by) chargeTech = sup.bracket_supplied_by;
        } catch (_) { /* column may not exist; fall back to completing tech */ }
        await adjustAppleTvBracketInventory(db, jobBizId, chargeTech, qty, id);
        const { data: fresh } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
        await db.from('bookings').update({
          metadata: { ...(fresh?.metadata || existing.metadata || {}), appletv_bracket_deducted_at: new Date().toISOString() },
        }).eq('id', id);
      }
    } catch (e) {
      console.error(`[appletv_bracket] decrement failed for booking ${id}:`, e.message);
    }
  }

  await db.from('technicians').update({ status: map.tech }).eq('id', auth.tech_id);

  let enRoute = null;
  let onSite = String(existing.payment_status || '').toLowerCase() === 'paid';
  if (next === 'on_the_way' && !onSite) {
    try { const { count } = await db.from('booking_photos').select('id', { count: 'exact', head: true }).eq('booking_id', id); onSite = (count || 0) > 0; } catch { /* send as before */ }
  }
  if (next === 'on_the_way' && !onSite) {
    enRoute = await sendEnRouteSms(db, {
      bookingId: id,
      technicianId: auth.tech_id,
      customerPhone: existing.customer?.phone,
      smsConsent: existing.sms_consent,
      etaMinutes: body.eta_minutes || DEFAULT_ETA_MINUTES,
    });
  }

  if (next === 'completed' && ['now', 'later', 'not_asked'].includes(body.review_ask)) {
    try { await db.from('bookings').update({ review_ask: body.review_ask, review_ask_at: new Date().toISOString() }).eq('id', id); }
    catch (e) { console.warn(`[review_ask] save failed for booking ${id}:`, e.message); }
  }
  if (next === 'completed') await ensureReviewToken(db, existing);
  if (next === 'completed' && existing.review_token) {
    console.log(`[review] job ${id} marked completed, review_token=${existing.review_token}, email=${existing.customer?.email}`);
    const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const emailClickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(existing.review_token)}&ch=email`;
    const smsClickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(existing.review_token)}&ch=sms`;
    const smsStatusCallback = `${baseUrl}/api/analytics?action=sms_status&token=${encodeURIComponent(existing.review_token)}`;

    const slug = existing.business?.slug || '';

    if (existing.customer?.email) {
      if (existing.metadata?.review_email_sent_at) {
        console.log(`[review] email already sent at ${existing.metadata.review_email_sent_at}, skipping`);
      } else {
        try {
          const brand = brandFor(slug);
          const { subject, html } = reviewEmail({
            firstName: existing.customer.name || 'there',
            clickUrl: emailClickUrl,
          }, brand);
          const { from } = emailConfig(slug);
          const emailResult = await sendEmail({ slug, to: existing.customer.email, subject, html, replyTo: from });
          if (emailResult.sent) {
            const nowIso = new Date().toISOString();
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            const newMeta = { ...(cur?.metadata || existing.metadata || {}), review_email_sent_at: nowIso };
            await db.from('bookings').update({ metadata: newMeta }).eq('id', id);
            try {
              await db.from('bookings').update({
                review_email_sent_at: nowIso, review_email_count: 1,
                review_email_id: emailResult.id || null, review_email_status: 'sent',
              }).eq('id', id);
            } catch { /* column not applied yet */ }
            console.log(`[review] email sent to ${existing.customer.email} (${slug}) booking=${id}`);
          } else {
            console.warn(`[review] email NOT sent to ${existing.customer.email} (${slug}) booking=${id}:`, emailResult.skipped || emailResult.error);
          }
        } catch (e) {
          console.error(`[review] email failed for booking ${id}:`, e.message);
        }
      }
    } else {
      console.warn(`[review] no customer email on booking ${id}`);
    }

    if (existing.customer?.phone && existing.sms_consent) {
      if (existing.metadata?.review_sms_sent_at) {
        console.log(`[review] SMS already sent at ${existing.metadata.review_sms_sent_at}, skipping`);
      } else {
        try {
          const msg = reviewRequestSms({ slug, name: existing.business?.name, token: existing.review_token, clickUrl: smsClickUrl, techName: await reviewTechName(db, existing) });
          const r = await sendSMSResult(existing.customer.phone, msg, { statusCallback: smsStatusCallback });
          await logAutomatedMessage(db, { businessId: existing.business_id, customerPhone: existing.customer.phone, body: msg, result: r });
          if (r.ok) {
            const nowIso = new Date().toISOString();
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            await db.from('bookings').update({ metadata: { ...(cur?.metadata || existing.metadata || {}), review_sms_sent_at: nowIso } }).eq('id', id);
            try { await db.from('bookings').update({ review_sms_sent_at: nowIso, review_sms_status: 'sent' }).eq('id', id); } catch { /* column not applied yet */ }
            console.log(`[review] SMS sent (${slug}) booking=${id}`);
          } else {
            console.warn(`[review] SMS NOT sent booking=${id}:`, r.skipped || r.error);
          }
        } catch (e) {
          console.error(`[review] SMS failed for booking ${id}:`, e.message);
        }
      }
    } else if (!existing.metadata?.review_sms_sent_at) {
      const why = existing.customer?.phone ? 'skipped_no_consent' : 'skipped_no_phone';
      console.log(`[review] SMS skipped (${why}) booking=${id}`);
      try { await db.from('bookings').update({ review_sms_status: why }).eq('id', id).is('review_sms_sent_at', null); } catch { /* column not applied yet */ }
    }
  } else if (next === 'completed') {
    console.error(`[review] job ${id} marked completed but a review_token could not be minted — no review request sent`);
  }

  return res.status(200).json({
    ok: true, status: next,
    ...(enRoute ? { sms: { sent: !!enRoute.ok, skipped: enRoute.skipped || null } } : {}),
  });
}

async function jobCardUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString();
  const pmId = (body.payment_method_id || '').toString();
  if (!id || !pmId) return res.status(400).json({ error: 'id and payment_method_id required' });

  const build = () => scopeMine(db.from('bookings')
    .select(`id, payment_status, ${techHasStripeAcctCol ? 'stripe_account, ' : ''}stripe_customer_id,
             business:businesses ( slug ),
             customer:customers ( name, email, phone )`), auth)
    .eq('id', id).maybeSingle();
  let { data: b, error } = await fetchMine(build);
  if (error && error.code === '42703' && /stripe_account/.test(error.message || '')) { techHasStripeAcctCol = false; ({ data: b, error } = await fetchMine(build)); }
  if (error || !b) return res.status(404).json({ error: 'Job not found' });
  if (b.payment_status === 'paid') return res.status(400).json({ error: 'This job is already paid — the card cannot be changed.' });
  if (b.payment_status === 'charging') return res.status(409).json({ error: 'This job is being charged right now — wait a moment and try again.' });

  const acct = { account: b.stripe_account || null, slug: b.business?.slug || null };
  if (!stripeConfigured(acct)) return res.status(400).json({ error: 'Payments are not configured on the server.' });

  let r;
  try {
    r = await saveCardOnFile({
      email: b.customer?.email, name: b.customer?.name, phone: b.customer?.phone,
      paymentMethodId: pmId, ...acct,
    });
  } catch (e) {
    return res.status(e.status || 400).json({ error: 'Could not save the card: ' + e.message });
  }

  const patch = { stripe_payment_method_id: pmId };
  if (r.customerId) patch.stripe_customer_id = r.customerId;
  if (b.payment_status !== 'card_on_file') patch.payment_status = 'card_on_file';
  const { data: upRow, error: upErr } = await db.from('bookings').update(patch)
    .eq('id', id).eq('payment_status', b.payment_status).select('id').maybeSingle();
  if (upErr) throw upErr;
  if (!upRow) return res.status(409).json({ error: 'The payment state changed while saving the card (a charge may be in progress) — refresh the job and try again.' });
  return res.status(200).json({ ok: true });
}

async function jobBracketSetSupplier(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString();
  const supplierId = (body.technician_id || '').toString();
  if (!id || !supplierId) return res.status(400).json({ error: 'id and technician_id required' });

  const build = () => scopeMine(db.from('bookings')
    .select(`id, business_id, technician_id, ${techHasSecondCol ? 'secondary_technician_id, ' : ''}bracket_supplied_by, line_items:booking_line_items ( name, quantity )`), auth)
    .eq('id', id).maybeSingle();
  let { data: b, error } = await fetchMine(build);
  if (error && /bracket_supplied_by/.test(error.message || '')) {
    return res.status(400).json({ error: "Bracket tracking isn't set up yet (run migration 0035)." });
  }
  if (error || !b) return res.status(404).json({ error: 'Job not found' });

  const jobTechs = [b.technician_id, b.secondary_technician_id].filter(Boolean);
  if (!jobTechs.includes(supplierId)) return res.status(400).json({ error: 'Pick a technician who is on this job.' });

  const { data: metaRow } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
  const meta = metaRow?.metadata || {};
  const bu = meta.brackets_used;
  const ticket = detectBracketQtys(b.line_items || []);
  const qtys = bu?.confirmed_at ? { flat: bu.flat || 0, tilting: bu.tilting || 0, full_motion: bu.full_motion || 0 } : ticket;
  if (bracketTotal(qtys) <= 0) return res.status(400).json({ error: 'This job has no company-supplied bracket.' });

  const prev = b.bracket_supplied_by || null;
  if (prev === supplierId) return res.status(200).json({ ok: true, supplied_by: supplierId });

  if (meta.bracket_deducted_at) {
    const { legacy } = await moveBookingCharge(db, {
      businessId: b.business_id, bookingId: id, supplier: supplierId, qtys,
      actor: `tech:${auth.tech_id || auth.name || 'tech'}`, meta, ticketQtys: ticket,
      fallbackSupplier: prev || b.technician_id, reason: 'supplier change', keyTag: 'job-supplier',
    });
    const { data: fresh } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
    const fm = fresh?.metadata || meta;
    await db.from('bookings').update({
      metadata: { ...fm, brackets_used: { ...(fm.brackets_used || {}), supplier: supplierId, ...(legacy && { legacy }) } },
    }).eq('id', id);
  }

  const { error: upErr } = await db.from('bookings')
    .update({ bracket_supplied_by: supplierId, bracket_supplied_at: new Date().toISOString() })
    .eq('id', id);
  if (upErr) throw upErr;
  return res.status(200).json({ ok: true, supplied_by: supplierId });
}

async function jobPayment(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const act = (body.action || 'charge').toString();

  const build = () => scopeMine(db.from('bookings')
    .select(`id, business_id, technician_id, price, tip, payment_status, payment_method, paid_at, metadata, updated_at, scheduled_at, address_line1, city, state, postal_code, ${techHasStripeAcctCol ? 'stripe_account, ' : ''}stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id,
             business:businesses ( slug, name, timezone ),
             customer:customers ( id, name, email, phone, stripe_customer_id )`), auth)
    .eq('id', id).maybeSingle();
  let { data: b, error } = await fetchMine(build);
  if (error && error.code === '42703' && /stripe_account/.test(error.message || '')) { techHasStripeAcctCol = false; ({ data: b, error } = await fetchMine(build)); }
  if (error || !b) return res.status(404).json({ error: 'Job not found' });

  const slug = b.business?.slug || null;
  const acct = { account: b.stripe_account || null, slug };
  const now = new Date().toISOString();

  if (act === 'mark_unpaid') {
    const tz = b.business?.timezone || 'Asia/Manila';
    if (b.payment_method === 'cash' && b.paid_at && localDateInTz(tz, b.paid_at) !== localDateInTz(tz, now)) {
      return res.status(403).json({ error: 'Same day only. Ask the office.' });
    }
    const { data: who } = await db.from('technicians').select('name').eq('id', auth.tech_id).maybeSingle();
    const r = await revertCash(db, b, { who: (who?.name || 'Tech') + ' (tech)', kind: 'technician', authorId: auth.tech_id, reason: body.reason });
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
    return res.status(200).json(r);
  }
  if (act === 'mark_paid' && body.cash_confirmed !== true) {
    return res.status(400).json({ error: 'Confirm cash received.' });
  }
  if (act === 'mark_paid' || act === 'mark_unpaid') {
    if (act === 'mark_unpaid' && b.payment_status === 'paid' && b.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'This job was paid by CARD (the charge is on file with Stripe). Marking it unpaid could lead to charging the customer twice — the office should issue a refund instead.' });
    }
    if (b.payment_status === 'charging') {
      const lockAgeMs = Date.now() - new Date(b.updated_at || 0).getTime();
      if (lockAgeMs < 2 * 60 * 1000) {
        return res.status(409).json({ error: 'This job is being charged right now — wait a moment and check whether the charge went through before marking it.' });
      }
    }
    let landed = null;
    if (act === 'mark_paid' && !b.stripe_payment_intent_id) landed = await findLandedCharge(id, acct);
    else if (act === 'mark_paid' && b.payment_status !== 'paid') {
      const pend = await pendingIntentState(b.stripe_payment_intent_id, acct);
      if (pend.state === 'processing') return res.status(409).json({ error: 'A card charge for this job is still processing at the bank — wait a minute and check before marking it paid.' });
      landed = pend.landed;
    }
    if (act === 'mark_paid') {
      if (landed) {
        const patch = { payment_status: 'paid', paid_at: now, amount_paid: landed.amount, tip: landed.tip, stripe_payment_intent_id: landed.id };
        if (landed.customerId) patch.stripe_customer_id = landed.customerId;
        if (landed.paymentMethodId) patch.stripe_payment_method_id = landed.paymentMethodId;
        const { data: rec } = await db.from('bookings').update(patch)
          .eq('id', id).eq('payment_status', b.payment_status).select('id').maybeSingle();
        if (!rec) return res.status(409).json({ error: 'The payment state just changed — refresh and check before marking it.' });
        return res.status(200).json({ ok: true, payment_status: 'paid', recovered: true,
          warning: `This job's card charge actually WENT THROUGH ($${landed.amount.toFixed(2)}) on an earlier attempt that looked like it failed. It's been recorded as a CARD payment — do NOT take cash from the customer.` });
      }
    }
    if (act === 'mark_paid' && body.cash && !body.signature && (Number(b.price) || 0) > 0) {
      return res.status(400).json({ error: 'Customer signature required.' });
    }
    if (act === 'mark_paid' && body.cash) {
      const { data: charged } = await db.from('booking_authorizations').select('id').eq('booking_id', id).not('stripe_charge_id', 'is', null).limit(1);
      if (charged && charged.length) return res.status(409).json({ error: 'This card was already charged. Do not take cash.' });
    }
    let cashPrice = Number(b.price) || 0;
    if (act === 'mark_paid' && body.cash) {
      const { data: liRows } = await db.from('booking_line_items')
        .select('id, name, line_total').eq('booking_id', id);
      const taxRows = (liRows || []).filter(li => /\btax\b/i.test(String(li.name || '')));
      if (taxRows.length) {
        const { data: full } = await db.from('booking_line_items').select('kind, name, description, quantity, unit_price, line_total, taxable, sort_order').in('id', taxRows.map(r => r.id));
        await db.from('bookings').update({ metadata: { ...(b.metadata || {}), cash_tax_removed: full || [] } }).eq('id', id);
        await db.from('booking_line_items').delete().in('id', taxRows.map(r => r.id));
        const removed = taxRows.reduce((s, r) => s + (Number(r.line_total) || 0), 0);
        cashPrice = Math.round((cashPrice - removed) * 100) / 100;
        await db.from('bookings').update({ price: cashPrice }).eq('id', id);
        await bumpLiRev(db, id);
      }
    }

    const patch = act === 'mark_paid'
      ? { payment_status: 'paid', paid_at: now, amount_paid: cashPrice,
          ...(body.cash ? { payment_method: 'cash', price: cashPrice } : {}),
          ...(b.stripe_payment_intent_id && b.payment_status !== 'paid' ? { stripe_payment_intent_id: null } : {}) }
      : { payment_status: 'unpaid', paid_at: null };
    const { data: updated } = await db.from('bookings').update(patch)
      .eq('id', id).eq('payment_status', b.payment_status).select('id').maybeSingle();
    if (!updated) return res.status(409).json({ error: 'The payment state just changed (maybe a charge finished) — refresh and check before marking it.' });

    if (act === 'mark_paid' && body.cash && body.signature) {
      try {
        await saveAuthorization(db, req, b, {
          businessId: b.business_id, total: cashPrice, ticketAmount: cashPrice,
          tip: 0, card: {}, pi: null, chargeId: null, body,
        });
      } catch (e) { console.warn('[cash auth] save failed:', e.message); }
    }
    return res.status(200).json({ ok: true, payment_status: patch.payment_status, price: cashPrice, cash: !!body.cash });
  }

  if (act === 'sign') {
    if (!body.signature) return res.status(400).json({ error: 'Signature required.' });
    if (b.payment_status !== 'paid') return res.status(400).json({ error: 'Job is not paid yet.' });
    let sig;
    try { sig = await uploadImage(body.signature, `authorizations/${b.id}`); }
    catch (e) { return res.status(500).json({ error: 'Signature upload failed. Try again.' }); }
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const fields = {
      signature_path: sig.path, signature_url: sig.url,
      customer_name: (body.customer_name || b.customer?.name || '').toString().slice(0, 120) || null,
      terms_text: body.terms_text || null,
      signed_ip: xff || req.socket?.remoteAddress || null,
      signed_user_agent: req.headers['user-agent'] || null,
      signed_at: now,
    };
    let q = db.from('booking_authorizations').select('id').eq('booking_id', b.id);
    if (b.stripe_payment_intent_id) q = q.eq('stripe_payment_intent_id', b.stripe_payment_intent_id);
    let { data: rows } = await q.order('created_at', { ascending: false }).limit(1);
    if (!rows?.length) ({ data: rows } = await db.from('booking_authorizations').select('id').eq('booking_id', b.id).order('created_at', { ascending: false }).limit(1));
    if (rows?.length) {
      const { error: uErr } = await db.from('booking_authorizations').update(fields).eq('id', rows[0].id);
      if (uErr) return res.status(500).json({ error: uErr.message });
    } else {
      const amt = Number(b.price) || 0;
      const { error: iErr } = await db.from('booking_authorizations').insert({
        ...fields, business_id: b.business_id, booking_id: b.id,
        amount: amt, ticket_amount: amt, tip: Number(b.tip) || 0,
        terms_version: body.terms_version || TERMS_VERSION,
        stripe_payment_intent_id: b.stripe_payment_intent_id || null,
      });
      if (iErr) return res.status(500).json({ error: iErr.message });
    }
    return res.status(200).json({ ok: true, has_signature: true });
  }

  if (act === 'refund') {
    return res.status(403).json({ error: 'Refunds are handled by the office, not the field app.' });
  }

  if (act === 'charge') {
    let priorPaymentStatus;
    {
      const { data: fresh } = await db.from('bookings').select('payment_status').eq('id', id).maybeSingle();
      if (!fresh) return res.status(404).json({ error: 'Job not found' });
      if (fresh.payment_status === 'paid') return res.status(400).json({ error: 'This job is already paid.' });
      if (fresh.payment_status === 'charging') {
        return res.status(409).json({ error: 'This job is already being charged (maybe from the office or another device) — check if it went through before trying again.' });
      }
      priorPaymentStatus = fresh.payment_status;
      const { data: locked, error: lockErr } = await db.from('bookings')
        .update({ payment_status: 'charging' })
        .eq('id', id).eq('payment_status', priorPaymentStatus)
        .select('id').maybeSingle();
      if (lockErr) throw lockErr;
      if (!locked) {
        return res.status(409).json({ error: 'This job is already being charged (maybe from the office or another device) — check if it went through before trying again.' });
      }
    }

    try {
      if (!stripeConfigured(acct)) {
        console.warn(`[tech charge] job=${id} slug=${slug} account=${acct.account || '(legacy)'} -> payments NOT configured for this account`);
        const e = new Error(`Card payments aren't set up on the server for ${b.business?.name || slug || 'this business'}. Take cash and tap "Mark paid (cash)".`);
        e.status = 400; throw e;
      }
      const adoptLanded = async (landed) => {
        const patch = { payment_status: 'paid', paid_at: now, amount_paid: landed.amount, tip: landed.tip, stripe_payment_intent_id: landed.id };
        if (landed.customerId) patch.stripe_customer_id = landed.customerId;
        if (landed.paymentMethodId) patch.stripe_payment_method_id = landed.paymentMethodId;
        let { error: recErr } = await db.from('bookings').update(patch).eq('id', id);
        if (recErr) ({ error: recErr } = await db.from('bookings').update(patch).eq('id', id));
        if (recErr) { await db.from('bookings').update({ payment_status: 'paid' }).eq('id', id); console.error('[tech charge] CRITICAL: landed-charge adopt write failed', { booking: id, pi: landed.id, err: recErr.message }); }
        return res.status(200).json({ ok: true, payment_status: 'paid', amount: landed.amount, tip: landed.tip, payment_intent_id: landed.id, recovered: true,
          warning: `This job was ALREADY charged $${landed.amount.toFixed(2)} on an earlier attempt that looked like it failed. No new charge was made.` });
      };
      if (!b.stripe_payment_intent_id) {
        const landed = await findLandedCharge(id, acct);
        if (landed) return adoptLanded(landed);
      }

      const ticketAmount = Number(b.price) || 0;
      if (ticketAmount <= 0) { const e = new Error('Cannot charge for a job with no price.'); e.status = 400; throw e; }
      const tip = Math.max(0, Math.round((Number(body.tip) || 0) * 100) / 100);
      if (tip > ticketAmount) { const e = new Error(`Tip ($${tip.toFixed(2)}) can't be more than the job total ($${ticketAmount.toFixed(2)}).`); e.status = 400; throw e; }
      const total = Math.round((ticketAmount + tip) * 100) / 100;

      let custId = b.stripe_customer_id || (b.customer && b.customer.stripe_customer_id) || null;
      let pmId = b.stripe_payment_method_id || null;
      try {
        if (!custId && b.customer && b.customer.email) {
          const r = await findCardOnFileByEmail(b.customer.email, acct);
          custId = r.customerId; if (r.paymentMethodId) pmId = r.paymentMethodId;
        }
        if (custId && !pmId) pmId = await defaultPaymentMethod(custId, acct);
      } catch (e) {
        console.warn(`[tech charge] job=${id} slug=${slug} account=${acct.account || '(legacy)'} email=${b.customer?.email || 'none'} -> card lookup failed: ${e.message}`);
        e.status = e.status || 400; throw e;
      }
      if (!custId || !pmId) {
        console.warn(`[tech charge] job=${id} slug=${slug} account=${acct.account || '(legacy)'} email=${b.customer?.email || 'none'} -> no card on file (customer=${!!custId} paymentMethod=${!!pmId})`);
        const e = new Error('No card on file for this customer. Take cash and tap "Mark paid (cash)".'); e.status = 400; throw e;
      }

      const resolved = await resolveChargeablePm({ customerId: custId, paymentMethodId: pmId, ...acct });
      if (!resolved.pmId) {
        console.warn(`[tech charge] job=${id} slug=${slug} account=${acct.account || '(legacy)'} -> stored pm is not attached and customer has no attached default`);
        const e = new Error('No card on file for this customer. Take cash and tap "Mark paid (cash)".'); e.status = 400; throw e;
      }
      pmId = resolved.pmId;
      const card = resolved.card;

      let pi, recovered;
      try {
        ({ pi, recovered } = await chargeCardOnFile({
          bookingId: id, cents: Math.round(total * 100), tip,
          customerId: custId, paymentMethodId: pmId,
          receiptEmail: (b.customer && b.customer.email) || null,
          businessSlug: slug, priorPiId: b.stripe_payment_intent_id || null,
          ...acct, log: '[tech charge]',
        }));
      } catch (e) {
        e.status = e.status || 402; e.message = 'Charge failed: ' + e.message; throw e;
      }
      if (recovered) {
        return adoptLanded({ id: pi.id, amount: Math.round(Number(pi.amount)) / 100, tip: Number(pi.metadata && pi.metadata.tip) || 0,
        customerId: (typeof pi.customer === 'string' ? pi.customer : pi.customer?.id) || custId,
        paymentMethodId: (typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id) || pmId });
      }
      if (pi.status !== 'succeeded') {
        const e = new Error(`Charge not completed (status: ${pi.status}). The card may need the customer to re-authenticate.`); e.status = 402; throw e;
      }
      const chargeId = pi.latest_charge || (pi.charges && pi.charges.data && pi.charges.data[0] && pi.charges.data[0].id) || null;

      const paidPatch = {
        payment_status: 'paid', paid_at: now, amount_paid: total, tip,
        stripe_payment_intent_id: pi.id, stripe_customer_id: custId, stripe_payment_method_id: pmId,
      };
      let { error: payErr } = await db.from('bookings').update(paidPatch).eq('id', id);
      if (payErr) ({ error: payErr } = await db.from('bookings').update(paidPatch).eq('id', id));
      if (payErr) {
        const { error: fbErr } = await db.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
        console.error('[tech charge] CRITICAL: Stripe charge succeeded but booking update failed', { booking: id, pi: pi.id, err: payErr.message, minimal_write_ok: !fbErr });
        return res.status(200).json({ ok: true, payment_status: 'paid', amount: total, tip, payment_intent_id: pi.id,
          warning: `The charge WENT THROUGH on Stripe ($${total.toFixed(2)}), but saving it to the job failed: ${payErr.message}. Do NOT charge again — tell the office to reconcile this job.` });
      }

      await saveAuthorization(db, req, b, { businessId: b.business_id, total, ticketAmount, tip, card, pi, chargeId, body });

      return res.status(200).json({ ok: true, payment_status: 'paid', amount: total, tip, payment_intent_id: pi.id });
    } catch (e) {
      try { await db.from('bookings').update({ payment_status: priorPaymentStatus, ...(e.payment_intent_id ? { stripe_payment_intent_id: e.payment_intent_id } : {}) }).eq('id', id).eq('payment_status', 'charging'); } catch (_) { /* best-effort */ }
      return res.status(e.status || 500).json({ error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.decline_code ? { decline_code: e.decline_code } : {}), ...(e.needs_new_card ? { needs_new_card: true } : {}) });
    }
  }

  return res.status(400).json({ error: `Unknown payment action "${act}"` });
}

async function assertOwnedJob(db, auth, id) {
  if (!id) { const e = new Error('id required'); e.status = 400; throw e; }
  const build = () => scopeMine(db.from('bookings').select('id, business_id'), auth).eq('id', id).maybeSingle();
  const { data } = await fetchMine(build);
  if (!data) { const e = new Error('Job not found'); e.status = 404; throw e; }
  return data.business_id;
}

async function jobPhotos(req, res, db, auth) {
  const id = (req.query.id || '').toString();
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const { data, error } = await db.from('booking_photos')
    .select('id, url, caption, uploader_name, created_at, is_video')
    .eq('booking_id', id).eq('business_id', bizId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ photos: data || [], min_required: MIN_PHOTOS_TO_COMPLETE });
}

async function jobVideoSign(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, body.id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (Number(body.size) > 500 * 1024 * 1024) return res.status(413).json({ error: 'Video is too big. Keep it under 1 minute.' });
  try { return res.status(200).json(await signVideoUpload(`${bizId}/${body.id}`, String(body.mime || ''))); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
}
async function jobVideoAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const path = String(body.path || '');
  if (!new RegExp(`^${bizId}/${id}/[0-9a-f-]{36}\\.(mp4|mov|webm|3gp|m4v)$`).test(path)) return res.status(400).json({ error: 'Bad video path' });
  const { data: tech } = await db.from('technicians').select('name').eq('id', auth.tech_id).single();
  const { data, error } = await db.from('booking_photos').insert({
    business_id: bizId, booking_id: id, technician_id: auth.tech_id,
    uploaded_by_kind: 'technician', uploader_name: tech?.name || 'Technician',
    storage_path: path, url: videoPublicUrl(path), caption: 'Logo video', is_video: true,
  }).select('id, url, caption, uploader_name, created_at, is_video').single();
  if (error) { await deleteVideo(path); throw error; }
  const { count } = await db.from('booking_photos')
    .select('id', { count: 'exact', head: true }).eq('booking_id', id).eq('business_id', bizId);
  return res.status(200).json({ photo: data, count: count || 0, min_required: MIN_PHOTOS_TO_COMPLETE });
}

async function jobPhotoAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  const { data: tech } = await db.from('technicians').select('name').eq('id', auth.tech_id).single();
  let up;
  try { up = await uploadImage(body.image, `${bizId}/${id}`); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  const { data, error } = await db.from('booking_photos').insert({
    business_id: bizId, booking_id: id, technician_id: auth.tech_id,
    uploaded_by_kind: 'technician', uploader_name: tech?.name || 'Technician',
    storage_path: up.path, url: up.url, caption: (body.caption || '').toString().trim() || null,
  }).select('id, url, caption, uploader_name, created_at').single();
  if (error) { await deleteImage(up.path); throw error; }

  const { count } = await db.from('booking_photos')
    .select('id', { count: 'exact', head: true }).eq('booking_id', id).eq('business_id', bizId);
  return res.status(200).json({ photo: data, count: count || 0, min_required: MIN_PHOTOS_TO_COMPLETE });
}

async function jobPhotoDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id, photoId = body.photo_id;
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!photoId) return res.status(400).json({ error: 'photo_id required' });
  const { data: jb } = await db.from('bookings').select('status').eq('id', id).maybeSingle();
  if (jb && jb.status === 'completed') return res.status(403).json({ error: 'This job is complete, so its photos are locked. Ask the office.' });

  const { data: ph } = await db.from('booking_photos')
    .select('id, storage_path, is_video').eq('id', photoId).eq('booking_id', id).eq('business_id', bizId).single();
  if (!ph) return res.status(404).json({ error: 'Photo not found' });
  await db.from('booking_photos').delete().eq('id', photoId);
  await (ph.is_video ? deleteVideo(ph.storage_path) : deleteImage(ph.storage_path));

  const { count } = await db.from('booking_photos')
    .select('id', { count: 'exact', head: true }).eq('booking_id', id).eq('business_id', bizId);
  return res.status(200).json({ ok: true, count: count || 0, min_required: MIN_PHOTOS_TO_COMPLETE });
}

async function jobNotes(req, res, db, auth) {
  const id = (req.query.id || '').toString();
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const { data, error } = await db.from('booking_notes')
    .select('id, body, author_kind, author_name, created_at')
    .eq('booking_id', id).eq('business_id', bizId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ notes: data || [] });
}

async function jobNoteAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const text = (body.body || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Note text required' });

  const { data: tech } = await db.from('technicians').select('name').eq('id', auth.tech_id).single();
  const { data, error } = await db.from('booking_notes').insert({
    business_id: bizId, booking_id: id,
    author_kind: 'technician', author_id: auth.tech_id, author_name: tech?.name || 'Technician',
    body: text,
  }).select('id, body, author_kind, author_name, created_at').single();
  if (error) throw error;
  return res.status(200).json({ note: data });
}

async function jobNoteDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id, noteId = body.note_id;
  let bizId;
  try { bizId = await assertOwnedJob(db, auth, id); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!noteId) return res.status(400).json({ error: 'note_id required' });
  await db.from('booking_notes').delete()
    .eq('id', noteId).eq('booking_id', id).eq('business_id', bizId);
  return res.status(200).json({ ok: true });
}

async function getAvailability(req, res, db, auth) {
  const { data, error } = await db.from('technician_availability')
    .select('day_of_week, slot_key')
    .eq('technician_id', auth.tech_id);
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const { data: exc, error: e2 } = await db.from('technician_availability_exceptions')
    .select('exception_date, slot_key, is_available')
    .eq('technician_id', auth.tech_id)
    .gte('exception_date', today)
    .order('exception_date');
  if (e2) throw e2;

  return res.status(200).json({
    slots: SLOTS, days: DAYS,
    availability: (data || []).map(r => ({ day_of_week: r.day_of_week, slot_key: r.slot_key })),
    exceptions: (exc || []).map(r => ({ date: r.exception_date, slot_key: r.slot_key, is_available: r.is_available })),
  });
}

async function setAvailability(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let rows;
  try { rows = normalizeSlots(body.slots); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  await db.from('technician_availability').delete().eq('technician_id', auth.tech_id);
  if (rows.length) {
    const { error } = await db.from('technician_availability').insert(
      rows.map(r => ({ business_id: auth.business_id, technician_id: auth.tech_id, ...r }))
    );
    if (error) throw error;
  }
  return res.status(200).json({ ok: true, count: rows.length });
}

async function setAvailabilityException(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let date, rows;
  try {
    date = assertDate(body.date);
    const dow = dayOfWeekFor(date);
    const { data: recur, error } = await db.from('technician_availability')
      .select('slot_key').eq('technician_id', auth.tech_id).eq('day_of_week', dow);
    if (error) throw error;
    rows = computeExceptionRows((recur || []).map(r => r.slot_key), body.selected);
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  await db.from('technician_availability_exceptions')
    .delete().eq('technician_id', auth.tech_id).eq('exception_date', date);
  if (rows.length) {
    const { error } = await db.from('technician_availability_exceptions').insert(
      rows.map(r => ({ business_id: auth.business_id, technician_id: auth.tech_id, exception_date: date, ...r }))
    );
    if (error) throw error;
  }
  return res.status(200).json({ ok: true, date, count: rows.length });
}

const HIDDEN_LI = new Set(['Guaranteed Dismount Service']);
function isCouponLi(li) {
  return ((li && li.kind) === 'coupon') || /^coupon\b/i.test(((li && li.name) || '').trim());
}
function isTaxLi(li) {
  return /^tax\b/i.test(((li && li.name) || '').trim());
}
function isFeeLi(li) {
  return /service area surcharge|after[\s-]?hours|\btravel\b|service\s*minimum/i.test(((li && li.name) || '').trim());
}
function isDismountLi(li) {
  return /guarante\w*\s+dismount|dismount\s+service|\btv removal\b/i.test(((li && li.name) || '').trim());
}
function isHiddenLi(li) {
  const kind = (li && li.kind) || 'service';
  if (kind === 'fee' || kind === 'tip' || kind === 'coupon') return true;
  if (isCouponLi(li) || isTaxLi(li) || isFeeLi(li) || isDismountLi(li)) return true;
  return HIDDEN_LI.has(((li && li.name) || '').trim());
}

function detectBracketQtys(lineItems) {
  const out = { flat: 0, tilting: 0, full_motion: 0 };
  for (const li of lineItems || []) {
    const name = (li.name || '').toLowerCase();
    const qty = Number(li.quantity) || 1;
    if (/customer.?supplied/.test(name)) continue;
    if (/full.?motion/.test(name)) out.full_motion += qty;
    else if (/tilt/.test(name)) out.tilting += qty;
    else if (/\bflat\b|fixed/.test(name)) out.flat += qty;
  }
  clampBracketQtysToTvCount(out, lineItems);
  return out;
}
function bracketTotal(q) { return (q.flat || 0) + (q.tilting || 0) + (q.full_motion || 0); }
function bracketLabel(q) {
  const parts = [];
  if (q.full_motion) parts.push(`${q.full_motion}× Full Motion`);
  if (q.tilting) parts.push(`${q.tilting}× Tilting`);
  if (q.flat) parts.push(`${q.flat}× Flat`);
  return parts.join(', ');
}


function detectAppleTvBracketQty(lineItems) {
  let n = 0;
  for (const li of lineItems || []) {
    const name = (li.name || '').toLowerCase();
    if (/apple\s*tv\b.*\bbracket\b/.test(name)) n += Number(li.quantity) || 1;
  }
  return n;
}

async function adjustAppleTvBracketInventory(db, businessId, techId, qty, bookingId) {
  if (!qty || !techId) return;
  const { data: techRow } = await db.from('technicians').select('business_id, skip_inventory').eq('id', techId).maybeSingle();
  if (techRow?.skip_inventory) return;
  const homeBizId = techRow?.business_id || businessId;
  let { data: inv, error } = await db.from('bracket_inventory')
    .select('id, appletv_bracket_qty')
    .eq('business_id', homeBizId).eq('technician_id', techId).maybeSingle();
  if (error) { if (/appletv_bracket_qty/.test(error.message || '')) return; throw error; }
  if (!inv) {
    const { data: created } = await db.from('bracket_inventory')
      .insert({ business_id: homeBizId, technician_id: techId, appletv_bracket_qty: 0 })
      .select('id, appletv_bracket_qty').maybeSingle();
    inv = created || { id: null, appletv_bracket_qty: 0 };
  }
  const nextQty = Math.max(0, (Number(inv.appletv_bracket_qty) || 0) - qty);
  if (inv.id) {
    await db.from('bracket_inventory')
      .update({ appletv_bracket_qty: nextQty, updated_at: new Date().toISOString() })
      .eq('id', inv.id);
  }
  try {
    await db.from('bracket_usage_logs').insert({
      business_id: businessId, booking_id: bookingId || null, technician_id: techId,
      flat_used: 0, tilting_used: 0, full_motion_used: 0, appletv_bracket_used: qty,
      logged_by_kind: 'technician', notes: 'Apple TV installation, mounting bracket included',
    });
  } catch (_) { /* usage log is best-effort */ }
}

async function allJobTechsExempt(db, ...techIds) {
  const ids = techIds.filter(Boolean);
  if (!ids.length) return false;
  for (const t of ids) if (!(await isInventoryExempt(db, t))) return false;
  return true;
}

async function jobNeedsBracketSupplier(db, bookingId) {
  if (!techHasSecondCol) return false;
  try {
    const { data: b, error } = await db.from('bookings')
      .select('bracket_supplied_by, technician_id, secondary_technician_id, line_items:booking_line_items ( name, quantity )')
      .eq('id', bookingId).maybeSingle();
    if (error || !b) return false;
    if (!b.secondary_technician_id) return false;
    if (b.bracket_supplied_by) return false;
    if (bracketTotal(detectBracketQtys(b.line_items || [])) <= 0) return false;
    return !(await allJobTechsExempt(db, b.technician_id, b.secondary_technician_id));
  } catch (e) { return false; }
}

function classifyServiceCat(b) {
  if (/assurion/i.test(String(b.notes || '')) || /assurion/i.test(String(b.service?.name || ''))) return 'Assurion';
  const svc = String(b.service?.name || '').toLowerCase();
  const names = (b.line_items || []).map(li => String(li.name || '').toLowerCase());
  if (/handyman/.test(svc) || names.some(n => /handyman/.test(n))) return 'Handyman';
  return 'Home Cleaning';
}

function shapeJob(b, full = false, forTech = false) {
  const address = formatAddress(b);
  const addressMissing = !isLikelyStreetAddress(b.address_line1);
  const serviceName = classifyServiceCat(b);
  const out = {
    id: b.id,
    status: b.status,
    scheduled_at: b.scheduled_at,
    scheduled_end: b.scheduled_end,
    customer_name: b.customer?.name || 'Customer',
    customer_phone: b.customer?.phone || null,
    service: serviceName,
    address,
    address_missing: addressMissing,
    customer_notes: b.customer_notes || null,
    maps_url: address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null,
    lat: b.lat || null,
    lng: b.lng || null,
  };
  if (full) {
    out.customer_email = b.customer?.email || null;
    out.sms_opt_out = b.sms_consent === false;
    out.notes = b.notes || null;
    out.price = b.price;
    out.li_rev = Number(b.metadata?.li_rev) || 0;
    if (Array.isArray(b.line_items)) {
      b.line_items = b.line_items.slice()
        .sort((x, y) => (Number.isFinite(Number(x?.sort_order)) ? Number(x.sort_order) : 1e9)
                      - (Number.isFinite(Number(y?.sort_order)) ? Number(y.sort_order) : 1e9));
    }
    out.maps_key = process.env.GOOGLE_MAPS_API_KEY || null;
    out.line_items = (b.line_items || []).filter(li => forTech ? !isHiddenLi(li) : true);
    out.discounts = (b.line_items || []).filter(isCouponLi)
      .map(li => ({ name: li.name || 'Coupon', amount: Number(li.line_total) || 0 }));
    out.tax = Math.round((b.line_items || []).filter(isTaxLi)
      .reduce((t, li) => t + (Number(li.line_total) || 0), 0) * 100) / 100;
    const isAnyFee = li => isFeeLi(li) || isDismountLi(li) || (((li && li.kind) === 'fee') && !isTaxLi(li) && !isCouponLi(li) && !/\btip\b/i.test((li && li.name) || ''));
    const isTravelFee = li => /service area surcharge|\btravel\b/i.test((li && li.name) || '');
    out.fees = (b.line_items || []).filter(li => isAnyFee(li) && !(forTech && isTravelFee(li)) && (Number(li.line_total) || 0) !== 0)
      .map(li => ({ name: li.name || 'Fee', amount: Number(li.line_total) || 0 }));
    out.hidden_total = forTech
      ? Math.round((b.line_items || []).filter(isHiddenLi).reduce((t, li) => t + (Number(li.line_total) || 0), 0) * 100) / 100
      : 0;
    out.payment_status = b.payment_status || 'unpaid';
    out.paid_at = b.paid_at || null;
    out.stripe_customer_id = b.stripe_customer_id || null;
    out.stripe_payment_method_id = b.stripe_payment_method_id || null;
    out.stripe_payment_intent_id = b.stripe_payment_intent_id || null;
    out.review_rating = b.review_rating || null;
    out.review_text = b.review_text || null;
    out.reviewed_at = b.reviewed_at || null;
  }
  return out;
}

async function travelPayoutMap(db, businessId) {
  const map = new Map();
  const { data, error } = await db.from('service_area_zips')
    .select('postal_code, tech_payout').eq('business_id', businessId);
  if (error) return map;
  for (const r of data || []) {
    const p = Number(r.tech_payout) || 0;
    if (p !== 0) map.set(String(r.postal_code), p);
  }
  return map;
}

async function techPayroll(req, res, db, auth) {
  const weekStart = (req.query.week_start || '').toString();
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ error: 'week_start (YYYY-MM-DD, Sunday) required' });
  }

  const techId = auth.tech_id;
  const weekEnd = addDaysStr(weekStart, 6);

  let techRow = null;
  {
    let r = await db.from('technicians')
      .select('name, businesses(slug), manual_pay_amount, manual_pay_date').eq('id', techId).single();
    if (r.error && /manual_pay_(amount|date)/.test(r.error.message || '')) {
      r = await db.from('technicians').select('name, businesses(slug)').eq('id', techId).single();
    }
    techRow = r.data;
  }
  const techName = techRow?.name || '';
  const businessSlug = techRow?.businesses?.slug || '';
  const payDateForWeek = addDaysStr(weekEnd, PAY_DATE_OFFSET_DAYS);
  const manualPay = (techRow?.manual_pay_date && techRow.manual_pay_date === payDateForWeek && techRow?.manual_pay_amount != null)
    ? { amount: Number(techRow.manual_pay_amount), date: techRow.manual_pay_date }
    : null;

  const secCol = techHasSecondCol ? 'secondary_technician_id, ' : '';
  const jobsSelect = `
      id, scheduled_at, created_at, status, subtotal, price, payment_status, amount_paid, payment_method,
      tip, notes, customer_notes, zenbooker_job_number, postal_code, service_area_id, technician_id, ${secCol}
      customers(name), services(name),
      line_items:booking_line_items(kind, name, quantity, unit_price, line_total)
    `;
  let jobsQuery = db.from('bookings')
    .select(jobsSelect)
    .eq('status', 'completed')
    .gte('scheduled_at', weekStart + 'T00:00:00Z')
    .lte('scheduled_at', weekEnd + 'T23:59:59Z')
    .order('scheduled_at');
  jobsQuery = techHasSecondCol
    ? jobsQuery.or(`technician_id.eq.${techId},secondary_technician_id.eq.${techId}`)
    : jobsQuery.eq('technician_id', techId);
  let { data: jobs, error } = await jobsQuery;
  if (error && error.code === '42703' && /secondary_technician_id/.test(error.message || '')) {
    techHasSecondCol = false;
    ({ data: jobs, error } = await db.from('bookings')
      .select(jobsSelect.replace('secondary_technician_id, ', ''))
      .eq('technician_id', techId).eq('status', 'completed')
      .gte('scheduled_at', weekStart + 'T00:00:00Z')
      .lte('scheduled_at', weekEnd + 'T23:59:59Z')
      .order('scheduled_at'));
  }
  if (error) throw error;

  const travelPayoutByZip = await travelPayoutMap(db, auth.business_id);

  const partsCorrections=await partsCorrectionsFor(db,weekStart,{technicianId:techId});
  const paidJobs = [];
  const deferredJobs = [];
  let totalPay = 0;
  let tipTotal = 0;

  for (const b of jobs || []) {
    const isHouston = await isHoustonBooking(db, auth.business_id, businessSlug, b.service_area_id);
    const result = computeJobPay({
      status: b.status,
      payment_status: b.payment_status,
      price: b.price,
      subtotal: b.subtotal,
      amount_paid: b.amount_paid,
      tip: b.tip,
      notes: b.notes,
      customer_notes: b.customer_notes,
      zenbooker_job_number: b.zenbooker_job_number,
      service_name: b.services?.name || '',
      business_slug: businessSlug,
      line_items: b.line_items || [],
      scheduled_at: b.scheduled_at,
      created_at: b.created_at,
      travel_payout: travelPayoutByZip.get(String(b.postal_code || '')) || 0,
      second_tech: !!b.secondary_technician_id,
      is_secondary: techId === b.secondary_technician_id && techId !== b.technician_id,
      is_houston: isHouston,
    }, techName);

    const base = {
      id: b.id,
      customer_name: b.customers?.name || 'Unknown',
      service: b.services?.name || 'Service',
      time: new Date(b.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };

    if (result.state === 'deferred') {
      deferredJobs.push({ ...base, customer_due: Math.floor((Number(b.price) || 0) - (Number(b.amount_paid) || 0)) });
    } else if (result.state === 'excluded') {
    } else {
      const collected = (b.payment_method === 'cash' && techId === b.technician_id)
        ? Math.round(Number(b.amount_paid) || Number(b.price) || 0) : 0;
      const breakdown = [...(result.breakdown || [])];
      if (collected > 0) breakdown.push({ label: 'Cash collected from customer (kept by you)', amount: -collected });
      paidJobs.push({
        ...base,
        tech_pay: result.total - collected,
        labor_pay: Math.round((result.pay - collected) * 100) / 100,
        tip: result.tip,
        cash_collected: collected || undefined,
        breakdown,
        flags: result.flags,
        needs_review: result.flags.length > 0 || result.state === 'partial',
      });
      totalPay += result.total - collected;
      tipTotal += Number(result.tip) || 0;
    }
  }

  try {
    const { data: bonus } = await db.from('tech_review_bonus')
      .select('amount, completed_at').eq('technician_id', techId).maybeSingle();
    const day = bonus ? String(bonus.completed_at).slice(0, 10) : '';
    if (bonus && day >= weekStart && day <= weekEnd) {
      const amt = Math.round(Number(bonus.amount) || 0);
      paidJobs.push({
        id: 'review-bonus',
        bonus: true,
        customer_name: 'Review bonus',
        service: 'All 5 Google listings reviewed',
        time: '',
        tech_pay: amt,
        breakdown: [{ label: 'Review bonus, all 5 Google listings', amount: amt }],
        flags: [],
        needs_review: false,
      });
      totalPay += amt;
    }
  } catch { /* migration 0090 not applied yet */ }

  try {
    const { data: bonuses, error: bonusError } = await db.from('tech_bonuses')
      .select('id, technician_id, amount, reason, message, awarded_on, photo_url')
      .eq('technician_id', techId)
      .gte('awarded_on', weekStart).lte('awarded_on', weekEnd)
      .order('awarded_on', { ascending: true });
    if(bonusError) throw bonusError;
    for (const b of bonuses || []) {
      const amt = partsMoney(Number(b.amount) || 0);
      if (!amt) continue;
      const detail=partsAdjustmentDetail(partsCorrections,b,weekStart);
      if(amt<0 && String(b.message||'').startsWith('Parts reimbursement correction') && !detail) continue;
      paidJobs.push({
        id: `bonus-${b.id}`,
        bonus: true,
        photo_url: b.photo_url || null,
        customer_name: b.reason || 'Bonus',
        service: amt<0?'Payroll adjustment':'Bonus',
        adjustment:amt<0,
        ...(detail||{}),
        time: '',
        tech_pay: amt,
        breakdown: [{ label: amt<0?(detail?.message||b.message||b.reason):(b.reason||'Bonus'), amount: amt }],
        flags: [],
        needs_review: false,
      });
      totalPay += amt;
    }
  } catch(e) { if(partsCorrections.length) throw e; /* migration 0105 not applied yet */ }

  return res.status(200).json({
    week_start: weekStart,
    week_end: weekEnd,
    pay_date: addDaysStr(weekEnd, PAY_DATE_OFFSET_DAYS),
    tech_name: techName,
    jobs: paidJobs,
    deferred: deferredJobs,
    total: partsMoney(totalPay),
    tip_total: partsMoney(tipTotal),
    labor_total: partsMoney(totalPay - tipTotal),
    paid_snapshot:partsPaymentSnapshot(partsCorrections,techId,weekStart),
    manual_pay: manualPay,
  });
}

async function techReviews(req, res, db, auth) {
  const { data: biz } = await db.from('businesses').select('timezone').eq('id', auth.business_id).single();
  const tz = biz?.timezone || 'Asia/Manila';
  const weekStartMs = startOfWeekUTC(tz).getTime();

  const [crmRes, googleRes] = await Promise.all([
    db.from('bookings')
      .select(`id, scheduled_at, reviewed_at, review_rating, review_text,
               customer:customers ( name ),
               service:services ( name )`)
      .eq('technician_id', auth.tech_id)
      .not('review_rating', 'is', null)
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(100),
    db.from('google_reviews')
      .select('id, rating, reviewer_name, review_text, review_date')
      .eq('technician_id', auth.tech_id)
      .limit(100),
  ]);
  if (crmRes.error) throw crmRes.error;
  if (googleRes.error) throw googleRes.error;

  const crm = (crmRes.data || []).map(r => ({
    id: `b_${r.id}`, source: 'crm',
    rating: r.review_rating, text: r.review_text || '',
    service: r.service?.name || null, customer_name: r.customer?.name || 'Customer',
    reviewed_at: r.reviewed_at, scheduled_at: r.scheduled_at,
  }));
  const google = (googleRes.data || []).map(r => ({
    id: `g_${r.id}`, source: 'google',
    rating: r.rating, text: r.review_text || '',
    service: null, customer_name: r.reviewer_name || 'Google user',
    reviewed_at: r.review_date, scheduled_at: r.review_date,
  }));

  const all = [...crm, ...google];
  const total = all.length;
  const sum = all.reduce((a, r) => a + (Number(r.rating) || 0), 0);
  const average = total ? Math.round((sum / total) * 10) / 10 : 0;

  let weekCount = 0;
  const reviews = all
    .map(r => {
      const ts = r.reviewed_at ? new Date(r.reviewed_at).getTime() : 0;
      const this_week = ts >= weekStartMs;
      if (this_week) weekCount++;
      return { ...r, this_week };
    })
    .sort((a, b) => (new Date(b.reviewed_at || 0).getTime()) - (new Date(a.reviewed_at || 0).getTime()));

  return res.status(200).json({ average, total, week_count: weekCount, reviews });
}

async function techBonusUnseen(req, res, db, auth) {
  const { data, error } = await db.from('tech_bonuses')
    .select('id, amount, reason, message, awarded_on, photo_url')
    .eq('technician_id', auth.tech_id)
    .is('acknowledged_at', null)
    .gt('amount',0)
    .not('message', 'is', null)
    .order('awarded_on', { ascending: true })
    .limit(5);
  if (error) throw error;
  return res.status(200).json({
    bonuses: (data || []).map(b => ({ ...b, amount: Math.round(Number(b.amount) || 0) })),
  });
}

async function techBonusAck(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('tech_bonuses')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', id).eq('technician_id', auth.tech_id).is('acknowledged_at', null);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function techNotesActive(req, res, db, auth) {
  const { data: me, error: meErr } = await db.from('technicians')
    .select('id, area:service_areas ( name )').eq('id', auth.tech_id).maybeSingle();
  if (meErr) throw meErr;
  const myCity = me?.area?.name || null;

  const { data, error } = await db.from('tech_notes')
    .select('id, body, target_type, technician_id, city, mode, show_from, send_at, photo_urls, created_by, created_at')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const { data: gone } = await db.from('tech_note_dismissals').select('note_id').eq('technician_id', auth.tech_id);
  const dismissed = new Set((gone || []).map(g => g.note_id));

  const today = denverToday();
  const notes = (data || [])
    .filter(n => !dismissed.has(n.id))
    .filter(n => n.target_type === 'all'
      || (n.target_type === 'tech' && n.technician_id === auth.tech_id)
      || (n.target_type === 'city' && myCity && n.city === myCity))
    .filter(n => noteIsLive(n, today))
    .map(n => ({ id: n.id, body: n.body, photo_urls: n.photo_urls || [], created_by: n.created_by, created_at: n.created_at }));
  return res.status(200).json({ notes });
}

async function techNotePhoto(req, res, db, auth) {
  const raw = (req.query.path || '').toString();
  if (!isPrivateNotePhoto(raw)) return res.status(400).json({ error: 'Bad photo path' });
  const [{ data: me }, { data: notes, error }] = await Promise.all([
    db.from('technicians').select('id, area:service_areas ( name )').eq('id', auth.tech_id).maybeSingle(),
    db.from('tech_notes').select('target_type, technician_id, city').contains('photo_urls', [raw]).is('deleted_at', null).limit(20),
  ]);
  if (error) throw error;
  const myCity = me?.area?.name || null;
  const mine = (notes || []).some(n => n.target_type === 'all'
    || (n.target_type === 'tech' && n.technician_id === auth.tech_id)
    || (n.target_type === 'city' && myCity && n.city === myCity));
  if (!mine) return res.status(403).json({ error: 'Not your photo' });
  const { buffer } = await readPrivateImage(raw.slice(5));
  res.setHeader('Content-Type', notePhotoContentType(raw));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.status(200).send(buffer);
}

async function techNoteDismiss(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('tech_note_dismissals')
    .upsert({ note_id: id, technician_id: auth.tech_id, dismissed_at: new Date().toISOString() },
            { onConflict: 'note_id,technician_id' });
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function techGoogleReviewsUnseen(req, res, db, auth) {
  const { data, error } = await db.from('google_reviews')
    .select('id, rating, reviewer_name, review_text, review_date')
    .eq('technician_id', auth.tech_id)
    .eq('seen', false)
    .order('review_date', { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw error;
  return res.status(200).json({ reviews: data || [] });
}

async function techGoogleReviewDismiss(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('google_reviews')
    .update({ seen: true }).eq('id', id).eq('technician_id', auth.tech_id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

const REVIEW_LISTINGS = [
  { key: 'ha-houston-1', label: 'TidyHaus, Houston (1)', url: 'https://g.page/r/CdizxHwpwcE0EBM/review' },
  { key: 'ha-houston-2', label: 'TidyHaus, Houston (2)', url: 'https://g.page/r/CeA7fWzbLgO8EBM/review' },
  { key: 'ha-austin',    label: 'TidyHaus, Austin',      url: 'https://g.page/r/CYE7aX6tVMnkEBM/review' },
  { key: 'ha-denver-1',  label: 'TidyHaus, Manila (1)',  url: 'https://g.page/r/Ccj-ZjdeLtzfEBM/review' },
  { key: 'ha-denver-2',  label: 'TidyHaus, Manila (2)',  url: 'https://g.page/r/CWcIi45TvszbEBM/review' },
  { key: 'ha-los-angeles', label: 'TidyHaus, Los Angeles', url: 'https://g.page/r/CfCMbSKempPwEBM/review' },
  { key: 'ha-fort-worth', label: 'TidyHaus, Fort Worth', url: 'https://g.page/r/CTYY_ZOaE-AyEBM/review' },
];
const REVIEW_LISTING_KEYS = new Set(REVIEW_LISTINGS.map(l => l.key));
const REVIEW_BONUS_AMOUNT = 100;

async function techReviewListings(req, res, db, auth) {
  const { data: rows, error } = await db.from('tech_review_checkins')
    .select('listing_key, checked_at, confirmed_at')
    .eq('technician_id', auth.tech_id);
  if (error) throw error;
  const byKey = new Map((rows || []).map(r => [r.listing_key, r]));
  const listings = REVIEW_LISTINGS.map(l => {
    const r = byKey.get(l.key);
    return { ...l, checked_at: r?.checked_at || null, confirmed_at: r?.confirmed_at || null };
  });
  let bonus = null;
  try {
    if (listings.every(l => l.checked_at)) await awardReviewBonusIfComplete(db, auth.tech_id);
    const { data: b } = await db.from('tech_review_bonus')
      .select('amount, completed_at').eq('technician_id', auth.tech_id).maybeSingle();
    if (b) bonus = { amount: Math.round(Number(b.amount) || 0), completed_at: b.completed_at };
  } catch { /* migration 0090 not applied yet */ }
  return res.status(200).json({ listings, all_done: listings.every(l => l.checked_at), bonus });
}

async function techReviewCheckinSet(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = (body.listing_key || '').toString().trim();
  if (!REVIEW_LISTING_KEYS.has(key)) return res.status(400).json({ error: 'Unknown listing' });
  if (body.checked === false) {
    const { error } = await db.from('tech_review_checkins')
      .delete().eq('technician_id', auth.tech_id).eq('listing_key', key);
    if (error) throw error;
    return res.status(200).json({ ok: true, checked: false });
  }
  const { error } = await db.from('tech_review_checkins')
    .upsert({ technician_id: auth.tech_id, listing_key: key, checked_at: new Date().toISOString() },
      { onConflict: 'technician_id,listing_key' });
  if (error) throw error;

  let allDone = false, bonusAwarded = false;
  try {
    const r = await awardReviewBonusIfComplete(db, auth.tech_id);
    allDone = r.allDone; bonusAwarded = r.awarded;
  } catch (e) {
    console.warn('[tech] review bonus award failed (listings load will retry):', e.message);
  }
  return res.status(200).json({ ok: true, checked: true, all_done: allDone, bonus_awarded: bonusAwarded });
}

async function awardReviewBonusIfComplete(db, techId) {
  const { data: rows, error } = await db.from('tech_review_checkins')
    .select('listing_key').eq('technician_id', techId);
  if (error) throw error;
  const done = (rows || []).filter(r => REVIEW_LISTING_KEYS.has(r.listing_key)).length;
  if (done < REVIEW_LISTINGS.length) return { allDone: false, awarded: false };
  const { data: t } = await db.from('technicians').select('active, name').eq('id', techId).maybeSingle();
  if (!t || t.active === false) return { allDone: true, awarded: false };
  const { data: bRow, error: bErr } = await db.from('tech_review_bonus')
    .upsert({ technician_id: techId, amount: REVIEW_BONUS_AMOUNT },
      { onConflict: 'technician_id', ignoreDuplicates: true })
    .select('technician_id');
  if (bErr) throw bErr;
  const awarded = Array.isArray(bRow) ? bRow.length > 0 : !!bRow;
  if (awarded) {
    try { await sendReviewBonusEarnedAlert({ techName: t.name, amount: REVIEW_BONUS_AMOUNT }); }
    catch (e) { console.warn('[tech] review bonus alert failed:', e.message); }
  }
  return { allDone: true, awarded };
}

async function me(req, res, db, auth) {
  const { data: t, error } = await db.from('technicians')
    .select('id, name, status, active, businesses(slug, timezone)').eq('id', auth.tech_id).single();
  if (error || !t) return res.status(404).json({ error: 'Technician not found' });
  if (t.active === false) return res.status(401).json({ error: 'Unauthorized' });
  const raw = getBearer(req);
  const fresh = refreshToken(auth, { maxSeconds: TECH_SESSION_MAX });
  const claims = fresh ? verifyToken(fresh) : auth;
  return res.status(200).json({
    token: fresh || raw, refreshed: !!fresh, expires_at: claims.exp,
    technician: {
      id: t.id, name: t.name, status: t.status,
      slug: t.businesses?.slug || '', tz: t.businesses?.timezone || 'Asia/Manila',
      demo: demoMode(),
    },
  });
}

const JOIN_BAD_LINK = "This link isn't valid. Ask whoever sent it for a new one.";

async function joinInfo(req, res) {
  const code = normalizeInviteCode(req.query.c);
  if (!code) return res.status(404).json({ state: 'invalid', error: JOIN_BAD_LINK });
  const db = serviceClient();
  const { data: inv, error } = await db.from('tech_invites')
    .select('id, status, expires_at, invitee_name, invitee_phone, opened_at, open_count, business:businesses ( slug, name ), area:service_areas ( name, unstaffed, active )')
    .eq('code', code).maybeSingle();
  if (error) throw error;
  if (!inv) return res.status(404).json({ state: 'invalid', error: JOIN_BAD_LINK });
  const state = (inviteState(inv) === 'open' && inv.area?.active === false) ? 'revoked' : inviteState(inv);
  const slug = inv.business?.slug || '';
  const out = {
    state,
    brand: inviteBrand(slug, inv.business?.name),
    business_slug: slug,
    metro: inv.area?.name || '',
    unstaffed: !!inv.area?.unstaffed,
    expires_at: inv.expires_at,
  };
  if (state !== 'open') return res.status(200).json(out);
  try {
    await db.from('tech_invites')
      .update({ opened_at: inv.opened_at || new Date().toISOString(), open_count: (inv.open_count || 0) + 1 })
      .eq('id', inv.id);
  } catch { /* cosmetic */ }
  return res.status(200).json({
    ...out,
    first_name: firstName(inv.invitee_name) || null,
    phone_locked: !!inv.invitee_phone,
    phone_last4: inv.invitee_phone ? digits10(inv.invitee_phone).slice(-4) : null,
    slots: SLOTS, days: DAYS,
  });
}

const JOIN_OUTCOME = {
  not_found:      [404, 'INVITE_NOT_FOUND', JOIN_BAD_LINK],
  expired:        [410, 'INVITE_EXPIRED', 'This invite expired. Ask whoever sent it to resend it.'],
  revoked:        [410, 'INVITE_REVOKED', 'This invite was canceled.'],
  area_inactive:  [410, 'INVITE_REVOKED', 'This invite is no longer valid. Ask for a new one.'],
  used:           [409, 'INVITE_USED', 'This invite was already used. If that was you, open the tech app and sign in with your phone number and PIN.'],
  phone_mismatch: [409, 'PHONE_MISMATCH', 'This invite was sent to a different number. Use the number the text came to.'],
  phone_in_use:   [409, 'PHONE_IN_USE', 'This number already has a technician account. Open the tech app and sign in instead.'],
  past_profile:   [409, 'PAST_PROFILE', "This number is on an older technician profile with us. Text the office and they'll switch it back on."],
  bad_input:      [400, 'BAD_INPUT', 'Something in the form is not right. Check it and try again.'],
};

async function joinComplete(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const code = normalizeInviteCode(body.c);
  if (!code) return res.status(404).json({ code: 'INVITE_NOT_FOUND', error: JOIN_BAD_LINK });
  const nonce = String(body.nonce || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(nonce)) return res.status(400).json({ error: 'Reload the page and try again.' });
  const name = String(body.name || '').replace(/'/g, '’').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 60 || !/^[\p{L}\p{M}][\p{L}\p{M} .’-]*$/u.test(name)) {
    return res.status(400).json({ field: 'name', error: 'Use letters only for your name (spaces, hyphens and apostrophes are fine).' });
  }
  const phone = toE164(body.phone);
  if (!phone || !/^\+1\d{10}$/.test(phone)) return res.status(400).json({ field: 'phone', error: 'Enter your 10-digit US cell number.' });
  const pin = String(body.pin ?? '');
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ field: 'pin', error: 'Your PIN must be exactly 4 digits.' });
  if (weakPin(pin)) return res.status(400).json({ field: 'pin', error: 'That PIN is too easy to guess. Pick different digits.' });
  if (body.sms_consent !== true) return res.status(400).json({ field: 'consent', error: 'Tick the box so we can text you your jobs.' });
  let slots;
  try { slots = normalizeSlots(body.slots); } catch (e) { return res.status(400).json({ field: 'slots', error: e.message }); }
  if (!slots.length) return res.status(400).json({ field: 'slots', error: 'Pick at least one time you can work.' });

  const db = serviceClient();
  const { data, error } = await db.rpc('claim_tech_invite', {
    p_code: code, p_nonce: nonce, p_name: name, p_phone: phone, p_pin: pin, p_slots: slots,
  });
  if (error) {
    console.error('[join] claim_tech_invite failed:', error.code, error.message);
    return res.status(500).json({ error: 'Could not finish sign-up. Tap the button again.' });
  }
  const row = Array.isArray(data) ? data[0] : data;
  const outcome = row?.outcome;
  if (outcome !== 'joined' && outcome !== 'replay') {
    const [status, codeOut, msg] = JOIN_OUTCOME[outcome] || [500, 'UNKNOWN', 'Could not finish sign-up. Tap the button again.'];
    console.log(`[join] invite ..${code.slice(-4)} -> ${outcome}`);
    return res.status(status).json({ code: codeOut, error: msg });
  }

  const { data: t, error: tErr } = await db.from('technicians')
    .select('id, name, status, active, phone, service_area_id, businesses ( slug, name, timezone )').eq('id', row.tech_id).single();
  if (tErr || !t) {
    console.error('[join] new tech lookup failed:', tErr?.message);
    return res.status(500).json({ error: 'Your account was created. Open the tech app and sign in with your phone number and PIN.' });
  }
  let slotCount = slots.length;
  if (outcome === 'joined') {
    try {
      const { data: invZ } = await db.from('tech_invites').select('service_zips, skip_inventory').eq('code', code).maybeSingle();
      if (invZ?.skip_inventory) {
        const { error: sErr } = await db.from('technicians').update({ skip_inventory: true }).eq('id', t.id);
        if (sErr) console.error('[join] skip_inventory copy failed:', sErr.message);
      }
      if (Array.isArray(invZ?.service_zips)) {
        const { error: zErr } = await db.from('technicians').update({ service_zips: invZ.service_zips }).eq('id', t.id);
        if (zErr) console.error('[join] service_zips copy failed:', zErr.message);
      }
    } catch (e) { console.error('[join] service_zips copy failed:', e.message); }
  }
  if (outcome === 'replay') {
    const used = () => res.status(409).json({ code: 'INVITE_USED', error: JOIN_OUTCOME.used[2] });
    if (!t.active || digits10(t.phone) !== digits10(phone)) return used();
    const { data: invRow } = await db.from('tech_invites').select('joined_at').eq('code', code).maybeSingle();
    if (!invRow?.joined_at || Date.now() - new Date(invRow.joined_at).getTime() > 30 * 60 * 1000) return used();
    const { data: pinHit } = await db.rpc('verify_technician_pin', { p_phone: t.phone, p_pin: pin });
    const hit = Array.isArray(pinHit) ? pinHit[0] : pinHit;
    if (!hit || hit.id !== t.id) return used();
    const { count } = await db.from('technician_availability').select('id', { count: 'exact', head: true }).eq('technician_id', t.id);
    if (typeof count === 'number') slotCount = count;
  }
  let area = null;
  try { ({ data: area } = await db.from('service_areas').select('name, unstaffed').eq('id', t.service_area_id).maybeSingle()); }
  catch { /* cosmetic */ }
  const slug = t.businesses?.slug || '';
  const metro = area?.name || '';
  const unstaffed = !!area?.unstaffed;

  const token = signToken({ kind: 'tech', tech_id: t.id, business_id: row.biz_id, sess: 1 });
  const technician = {
    id: t.id, name: t.name, status: t.status, slug, tz: t.businesses?.timezone || 'Asia/Manila',
    demo: demoMode(), company_name: brandName(slug, null),
  };

  if (outcome === 'joined') {
    const brand = inviteBrand(slug, t.businesses?.name);
    let welcome = null;
    try {
      welcome = await sendTechSms(db, {
        kind: 'tech_welcome', technicianId: t.id, businessId: row.biz_id, phone: t.phone,
        message: welcomeSmsText({ brand, name: t.name, metro, unstaffed }),
      });
    } catch (e) { console.warn('[join] welcome text failed:', e.message); }
    try {
      await sendTechJoinedAlert({
        techName: t.name, company: brand, metro, slotCount: slots.length, unstaffed,
        payrollNote: payrollNameNote(t.name),
        welcomeFailed: welcome && !welcome.ok ? smsFailReason(welcome) : null,
      });
    } catch (e) { console.warn('[join] owner alert failed:', e.message); }
    console.log(`[join] new tech ${t.id} ${slug}/${metro} ..${String(t.phone).slice(-4)} slots=${slots.length}`);
  }
  return res.status(200).json({ ok: true, token, technician, metro, unstaffed, slot_count: slotCount });
}

function simpleEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

function applicantName(raw) {
  const name = String(raw || '').replace(/'/g, '’').replace(/\s+/g, ' ').trim();
  return (name.length >= 2 && name.length <= 60 && /^[\p{L}\p{M}][\p{L}\p{M} .’-]*$/u.test(name)) ? name : null;
}

async function recentScreening(db, phone) {
  const since = new Date(Date.now() - RETAKE_COOLDOWN_HOURS * 3600e3).toISOString();
  const d10 = digits10(phone);
  const { data, error } = await db.from('applicant_screenings')
    .select('phone, passed, invite_code, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).find(r => digits10(r.phone) === d10) || null;
}
const RETAKE_MSG = `You already took this test today. Come back after ${RETAKE_COOLDOWN_HOURS} hours and try again.`;

async function reissueJoinLink(db, screening) {
  if (!screening?.passed || !screening.invite_code) return null;
  const { data: inv } = await db.from('tech_invites').select('status, expires_at').eq('code', screening.invite_code).maybeSingle();
  if (!inv || inv.status !== 'pending') return null;
  if (new Date(inv.expires_at).getTime() <= Date.now()) {
    await db.from('tech_invites').update({ expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 864e5).toISOString() }).eq('code', screening.invite_code);
  }
  return `/join?c=${screening.invite_code}`;
}

async function retakeResponse(res, db, screening) {
  const link = await reissueJoinLink(db, screening);
  if (link) return res.status(200).json({ ok: true, already_passed: true, join_link: link });
  return res.status(409).json({ code: 'RETAKE_BLOCKED', error: RETAKE_MSG });
}

async function applyStart(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const name = applicantName(body.name);
  if (!name) return res.status(400).json({ field: 'name', error: 'Use letters only for your name (spaces, hyphens and apostrophes are fine).' });
  if (!simpleEmail(body.email)) return res.status(400).json({ field: 'email', error: 'Enter a valid email address.' });
  const phone = toE164(body.phone);
  if (!phone || !/^\+1\d{10}$/.test(phone)) return res.status(400).json({ field: 'phone', error: 'Enter your 10-digit US cell number.' });

  const db = serviceClient();
  const prior = await recentScreening(db, phone);
  if (prior) return await retakeResponse(res, db, prior);
  return res.status(200).json({ ok: true, ...publicQuestions() });
}

async function applySubmit(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const name = applicantName(body.name);
  if (!name) return res.status(400).json({ field: 'name', error: 'Use letters only for your name (spaces, hyphens and apostrophes are fine).' });
  if (!simpleEmail(body.email)) return res.status(400).json({ field: 'email', error: 'Enter a valid email address.' });
  const phone = toE164(body.phone);
  if (!phone || !/^\+1\d{10}$/.test(phone)) return res.status(400).json({ field: 'phone', error: 'Enter your 10-digit US cell number.' });
  const shortAnswers = {};
  if (body.short_answers && typeof body.short_answers === 'object') {
    for (const [k, v] of Object.entries(body.short_answers)) {
      if (/^q(21|22)$/.test(k)) shortAnswers[k] = String(v || '').slice(0, 2000).trim();
    }
  }

  const db = serviceClient();
  const prior = await recentScreening(db, phone);
  if (prior) return await retakeResponse(res, db, prior);

  const { graded, score, total, passed } = gradeAnswers(body.answers);

  let inviteCode = null;
  if (passed) {
    inviteCode = newInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 864e5).toISOString();
    const { error: invErr } = await db.from('tech_invites').insert({
      business_id: HIRING.businessId, service_area_id: HIRING.serviceAreaId, code: inviteCode,
      invitee_name: name, invitee_phone: phone, expires_at: expiresAt,
      created_by: 'apply.html',
    });
    if (invErr) {
      console.error('[apply] tech_invites insert failed:', invErr.code, invErr.message);
      const { data: existing } = await db.from('tech_invites')
        .select('code, invitee_phone').eq('business_id', HIRING.businessId).eq('status', 'pending')
        .not('invitee_phone', 'is', null).limit(200);
      const match = (existing || []).find(r => digits10(r.invitee_phone) === digits10(phone));
      inviteCode = match ? match.code : null;
      if (inviteCode) await db.from('tech_invites').update({ expires_at: expiresAt, invitee_name: name }).eq('code', inviteCode);
    }
  }

  const { error: scrErr } = await db.from('applicant_screenings').insert({
    business_id: HIRING.businessId, service_area_id: HIRING.serviceAreaId,
    name, email: String(body.email).trim().toLowerCase(), phone,
    answers: graded, short_answers: shortAnswers, score, total, passed,
    invite_code: inviteCode,
  });
  if (scrErr) console.error('[apply] applicant_screenings insert failed:', scrErr.code, scrErr.message);

  console.log(`[apply] ${name} ..${phone.slice(-4)} ${score}/${total} -> ${passed ? 'passed' : 'failed'}`);
  return res.status(200).json({ ok: true, passed, score, total, join_link: passed && inviteCode ? `/join?c=${inviteCode}` : null });
}

function payrollNameNote(name) {
  if (isJuan(name)) return 'their name contains "Juan", so payroll will compute their pay at Juan\'s rates. Check it before payday.';
  if (isRetired(name)) return 'their name matches the retired-tech rule (Evan/Israel), so payroll will compute $0 for them. Check it before payday.';
  return null;
}

async function bracketInventorySet(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isInventoryExempt(db, auth.tech_id)) return res.status(400).json({ error: 'Not tracked for you.' });
  const num = (v) => { const n = Number(v); return (v === '' || v == null || !Number.isInteger(n) || n < 0 || n > 999) ? null : n; };
  const c = { flat: num(body.flat), tilting: num(body.tilting), full_motion: num(body.full_motion), wire_plate: num(body.wire_plate) };
  if (Object.values(c).some(v => v == null)) return res.status(400).json({ error: 'Enter all four counts.' });

  const { data: inv } = await db.from('bracket_inventory')
    .select('id, flat_qty, tilting_qty, full_motion_qty, wire_plate_qty')
    .eq('technician_id', auth.tech_id).eq('business_id', auth.business_id).maybeSingle();
  const before = { flat: inv?.flat_qty || 0, tilting: inv?.tilting_qty || 0, full_motion: inv?.full_motion_qty || 0, wire_plate: inv?.wire_plate_qty || 0 };
  const gap = (k, label) => `${label} ${before[k]}>${c[k]}`;
  const reason = `tech self-count: ${gap('flat', 'flat')}, ${gap('tilting', 'tilt')}, ${gap('full_motion', 'fm')}, ${gap('wire_plate', 'plates')}`;
  await ledgerRecount(db, {
    businessId: auth.business_id, technicianId: auth.tech_id,
    flat: c.flat, tilting: c.tilting, fullMotion: c.full_motion,
    reason, actor: `tech:${auth.tech_id}`,
  });
  await plateRecount(db, {
    businessId: auth.business_id, technicianId: auth.tech_id, qty: c.wire_plate,
    reason, actor: `tech:${auth.tech_id}`,
  });
  return res.status(200).json({ ok: true, ...c, last_self_count_at: new Date().toISOString() });
}

async function bracketInventory(req, res, db, auth) {
  if (await isInventoryExempt(db, auth.tech_id)) {
    return res.status(200).json({ skip_inventory: true, flat: 0, tilting: 0, full_motion: 0, total: 0, wire_plate: 0, updated_at: null, in_route: [] });
  }
  const sel = (withWp) => db.from('bracket_inventory')
    .select(`flat_qty, tilting_qty, full_motion_qty, updated_at${withWp ? ', wire_plate_qty' : ''}`)
    .eq('technician_id', auth.tech_id)
    .eq('business_id', auth.business_id)
    .maybeSingle();
  let { data: inv, error } = await sel(true);
  let hasWp = true;
  if (error && /wire_plate_qty/.test(error.message || '')) { hasWp = false; ({ data: inv, error } = await sel(false)); }
  if (error) throw error;

  const flat = inv?.flat_qty || 0;
  const tilting = inv?.tilting_qty || 0;
  const full_motion = inv?.full_motion_qty || 0;

  let in_route = [];
  try {
    const irCols = (withEst) =>
      `id, walmart_order_num, status, flat_qty, tilting_qty, full_motion_qty, order_date, created_at${withEst ? ', estimated_delivery' : ''}`;
    let { data: rows, error: irErr } = await db.from('bracket_purchases')
      .select(irCols(true))
      .eq('technician_id', auth.tech_id)
      .is('received_at', null)
      .not('status', 'in', '(canceled,returned)')
      .order('created_at', { ascending: true });
    if (irErr && /estimated_delivery/.test(irErr.message || '')) {
      ({ data: rows } = await db.from('bracket_purchases')
        .select(irCols(false))
        .eq('technician_id', auth.tech_id)
        .is('received_at', null)
        .not('status', 'in', '(canceled,returned)')
        .order('created_at', { ascending: true }));
    }
    in_route = (rows || []).map((r) => {
      let est = r.estimated_delivery || null;
      if (!est) {
        const base = r.order_date || (r.created_at ? String(r.created_at).slice(0, 10) : null);
        if (base) {
          const d = new Date(base + 'T00:00:00Z');
          if (!isNaN(d.getTime())) { d.setUTCDate(d.getUTCDate() + 7); est = d.toISOString().slice(0, 10); }
        }
      }
      return {
        id: r.id,
        status: r.status || 'in_route',
        order_num: r.walmart_order_num || null,
        flat: r.flat_qty || 0,
        tilting: r.tilting_qty || 0,
        full_motion: r.full_motion_qty || 0,
        estimated_delivery: est,
      };
    }).filter((o) => (o.flat + o.tilting + o.full_motion) > 0);
  } catch (e) { in_route = []; }

  return res.status(200).json({
    flat,
    tilting,
    full_motion,
    total: flat + tilting + full_motion,
    wire_plate: hasWp ? (inv?.wire_plate_qty || 0) : 0,
    updated_at: inv?.updated_at || null,
    in_route,
    last_self_count_at: await lastSelfCounts(db, [auth.tech_id]).then(m => m.get(auth.tech_id)?.at || null).catch(() => null),
  });
}

async function bracketReceive(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isInventoryExempt(db, auth.tech_id)) return res.status(400).json({ error: 'Not tracked for you.' });
  const id = (body.id || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: own } = await db.from('bracket_purchases').select('id').eq('id', id).eq('technician_id', auth.tech_id).maybeSingle();
  if (!own) return res.status(404).json({ error: 'Order not found' });
  const n = (v) => (v === '' || v == null || !isFinite(Number(v))) ? null : Math.max(0, Math.floor(Number(v)));
  const { data, error } = await db.rpc('bracket_receive', {
    p_purchase_id: id, p_flat: n(body.flat), p_tilting: n(body.tilting), p_full_motion: n(body.full_motion),
    p_actor: 'tech:' + auth.tech_id,
  });
  if (error) return res.status(400).json({ error: String(error.message || '').replace(/^bracket_receive: /, '') });
  return res.status(200).json({ ok: true, purchase: Array.isArray(data) ? data[0] : data });
}

async function wirePlateSet(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isInventoryExempt(db, auth.tech_id)) return res.status(400).json({ error: 'Not tracked for you.' });
  const target = Math.max(0, Math.floor(Number(body.wire_plate) || 0));
  const { data: inv } = await db.from('bracket_inventory')
    .select('wire_plate_qty').eq('technician_id', auth.tech_id).eq('business_id', auth.business_id).maybeSingle();
  const before = inv?.wire_plate_qty || 0;
  const row = await plateRecount(db, {
    businessId: auth.business_id, technicianId: auth.tech_id, qty: target,
    reason: `tech plate count: plates ${before}>${target}`, actor: `tech:${auth.tech_id}`,
  });
  return res.status(200).json({ ok: true, wire_plate: row ? before + (row.wire_plate_delta || 0) : target });
}

async function canRescheduleAnytime(db, auth) {
  const { data, error } = await db.from('technicians').select('can_reschedule_anytime, active').eq('id', auth.tech_id).maybeSingle();
  if (error) { console.warn('[reschedule_access]', error.message); return false; }
  return !!(data && data.active !== false && data.can_reschedule_anytime === true);
}

async function jobReschedule(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await canRescheduleAnytime(db, auth))) return res.status(403).json({ error: 'Rescheduling is not turned on for you.' });
  const id = String(body.id || '');
  const date = String(body.scheduled_date || '');
  const slot = String(body.scheduled_slot || '');
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOT_KEYS.has(slot)) return res.status(400).json({ error: 'Pick a date and time.' });
  const { data: b } = await db.from('bookings')
    .select('id, status, technician_id, business:businesses ( id, slug, name, timezone )')
    .eq('id', id).eq('technician_id', auth.tech_id).maybeSingle();
  if (!b) return res.status(404).json({ error: 'Job not found' });
  if (b.status === 'completed' || b.status === 'cancelled') return res.status(400).json({ error: `This job is ${b.status}.` });
  const { data: me } = await db.from('technicians').select('name').eq('id', auth.tech_id).maybeSingle();
  const actor = `tech:${auth.tech_id}`;
  return await officeBookingUpdate(req, res, db, { role: 'technician', name: me?.name || actor }, {
    business: b.business.slug, id, action: 'reschedule', scheduled_date: date, scheduled_slot: slot,
    ...(body.force === true && { force_unavailable_ids: [auth.tech_id] }),
  }, { biz: b.business, actor, techNote: { author_id: auth.tech_id, author_name: me?.name || 'Technician' } });
}
