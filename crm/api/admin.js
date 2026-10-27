import { capName } from './_lib/name-case.js';
import { resolveGoogleReviewUrl } from './_lib/google-review-url.js';
import { recipientContactBlock } from './_lib/miguel-contact-block.js';
import { launchAssessmentUrl, isLaunchPreview, previewHasWidget, OWN_WIDGET_SLUGS } from './_lib/launch-preview.js';
import { callDayRows } from './_lib/call-counts.js';
import { bracketItemsCost } from './_lib/bracket-costs.js';
import { numberVolumes } from './_lib/number-volume.js';
import { serviceClient, serviceClientPublic } from './_lib/supabase.js';
import { signToken, verifyToken, getBearer, applyCors, safeEqual, refreshToken, ADMIN_SESSION_MAX } from './_lib/auth.js';
import { verifyTwilioSignature, xml, xmlEsc, routeNow, ROUTE_LINE_COLUMNS } from './analytics.js';
import { ensureReviewToken, reviewRequestSms, reviewTechName } from './_lib/review-token.js';
import { estimateApproveLink } from './_lib/estimate-code.js';
import { estimatePrefill } from './_lib/estimate-prefill.js';
import { emailNotificationsOn, smsNotificationsOn } from './_lib/notify.js';
import { demoMode } from './_lib/demo.js';
import { toE164, sendSMS, sendSMSResult, smsConfigured, smsBrandName, smsOptOutState, logAutomatedMessage, textConsentFor, staffTextGate, gateRefuse, verbalConsentFor, phone10 } from './_lib/sms.js';
import { emailConfig, sendEmail, bookingConfirmationEmail, brandFor, reviewEmail, estimateEmail, outOfScopeEmail, receiptEmail, EMAIL_BRANDS } from './_lib/email.js';
import { sendCouponFollowup } from './_lib/estimate-followup.js';
import { myDay } from './_lib/my-day.js';
import { askHandler } from './_lib/ask.js';
import { revertCash } from './_lib/cash-revert.js';
import { startTranscript, finishTranscript } from './_lib/transcribe.js';
import { callSummary } from './_lib/call-summary.js';
import { prospectsAction, prospectCommissionRows, prospectCallTarget, prospectQuoteLink, prospectQuoteHeld } from './_lib/prospects.js';
import { calendarAction } from './_lib/calendar.js';
import { pipelineHandler, pipelineCallTarget, inboundForLiveStart, isReviewCardFor } from './_lib/pipeline.js';
import { sendOwnerBookingAlert, maybeSendBigBracketAlert, maybeSendZeroOrLowProfitAlert, gdsUpsellUrlFor, rescheduleUrlFor, sendReviewCallComplaintAlert, isLeadGenSlug } from './_lib/owner-notify.js';
import { INVITE_TTL_DAYS, newInviteCode, inviteLink, inviteState, inviteBrand, inviteSmsText, fmtExpiry, digits10, sendTechSms, smsFailReason } from './_lib/tech-invite.js';
import { QUESTIONS as APPLY_QUESTIONS } from './_lib/apply-quiz.js';
import { readState as readBracketSyncState, readDispatch as readBracketSyncDispatch, summarizeForDashboard as bracketSyncSummary, dispatchBracketScan } from './_lib/bracket-sync-health.js';
import { notifyTechAssigned } from './_lib/tech-notify.js';
import { enRouteMessage, DEFAULT_ETA_MINUTES } from './_lib/en-route.js';
import { bookingConfirmMessage } from './_lib/booking-confirm-sms.js';
import { sendDailyBookingDigest } from './_lib/daily-digest.js';
import { localDayStartUTC, localDateStartUTC, startOfWeekUTC, startOfMonthUTC, addDaysStr } from './_lib/time.js';
import { isBotUserAgent, isInternalContact, isUsTimezone, isBlogPath } from './_lib/bot-filter.js';
import { capacityOverview } from './_lib/capacity.js';
import { phoneDesk } from './_lib/phone-desk.js';
import { estimateCheckFor, setExcuse } from './_lib/estimate-check.js';
import { recommendedSlots, isRecommended } from './_lib/recommended-slots.js';
import { SLOTS, SLOT_KEYS, DAYS, normalizeSlots, assertDate, dayOfWeekFor, computeExceptionRows, publicOpenSlots, parseSlotId, slotStartUTC, slotEndUTC, pickOpenTech, applySoleTech, techIsOpenForSlot, filterTechsByZip } from './_lib/availability.js';
import { parseDomainList, runDomainWatch } from './_lib/domain-watch.js';
import { formatAddress, isLikelyStreetAddress, hasDigits } from './_lib/address.js';
import { stripe, stripeConfigured, findCardOnFileByEmail, defaultPaymentMethod, businessSecretKey, saveCardOnFile as saveCardOnFileAcct, retrieveCard, resolveChargeablePm, stripeUploadFile, listOpenDisputes, submitDisputeEvidence, findLandedCharge, chargeCardOnFile, pendingIntentState } from './_lib/stripe.js';
import { saveAuthorization, buildDisputeEvidence } from './_lib/authorization.js';
import { gscQuery } from './_lib/gsc.js';
import { resolveServiceArea, unstaffedZipMatcher } from './_lib/service-area-resolve.js';
import { parseMoney, minSellPrice, checkSellPrice } from './_lib/broker-pricing.js';
import { BROKER_SECTIONS, brokerResolveSpec, brokerQuoteLineItems, normalizeCustomLines, customLinesOf, brokerRequiredLines } from './_lib/broker-spec.js';
import { digitsOf, prettyPhone, GRASSHOPPER_LINES } from './_lib/grasshopper.js';
import { dateIn, exceptionsOn, applyExceptions } from './_lib/schedule-exceptions.js';
import { SECRETARY_EXTRA_BUSINESSES, allowedSlugsFor, mayUseBusiness, loadCoverageOverrides, coveredSlugsFor, coverageOverrideFor, isAllCoverage, effectiveAuth, weeklyScheduleFor, todayGroupFor, groupSlugs, targetedToday } from './_lib/staff-access.js';
const OFF_DAY_ACTIONS = new Set(['team_directory', 'va_board', 'secretary_availability', 'my_call_performance', 'notes_active', 'notes_read', 'notes_list', 'notes_add', 'notes_update', 'notes_delete', 'notes_photo', 'note_photo', 'notes_replies_seen', 'critical_alerts', 'critical_handle']);
import { canonicalizeLineItems, recalcTaxLine, isTaxLine, casBumpLiRev, bumpLiRev, clampBracketQtysToTvCount, LI_CONFLICT_CODE } from './_lib/line-items.js';
import { redAlertsAction, redAlertCallTarget } from './_lib/red-alerts.js';
import { GMB_LOCATIONS } from '../scripts/lib/gmb-locations.mjs';
import { runGbpCountWatch } from './_lib/gbp-count-watch.js';
import { GBP_POST_KEYS } from './_lib/gbp-posts.js';
import { RANK_CITIES, OUR_DOMAINS, keywordsFor, costEstimate, hasKeys, postScans, collectPending, dryRun, busyCities, OWN_CID_KEY, ownDomainOf, siteOf, volumeSeeds, fetchVolumes, fetchAds, adKeywordsFor, adsCost, KW_PRICE } from './_lib/rank-grid.js';
import { gadsApplyFixes20261015 } from './_lib/gads-fixes.js';
import { gadsApply20261016 } from './_lib/gads-fixes-1016.js';
import { gadsApply20261016b } from './_lib/gads-fixes-1016b.js';
import { gadsMapsFix } from './_lib/gads-maps-fix.js';
import { gadsAuthUrl, gadsHandleCallback, gadsStatus, gadsReport, gadsAudit, gadsQuery, gadsMutate, gadsDump, gadsUploadBookings } from './_lib/gads.js';
import { detectWirePlateQty, applyPlatesForJob, plateRecount, plateAdjust, plateOrderMove } from './_lib/plate-moves.js';
import { bracketTotal as bracketMoveTotal, debitForJob, reconcileJobEdit, creditDelivery as ledgerCreditDelivery, adjustDelivery as ledgerAdjustDelivery, recount as ledgerRecount, adjust as ledgerAdjust, isInventoryExempt } from './_lib/bracket-moves.js';
import { bracketPrefill, parseBracketsUsed, checkBracketsUsed, bracketMismatchNote, applyConfirmedBrackets, chargedSoFar, lastSelfCounts, removedBracketNotes } from './_lib/bracket-confirm.js';

const GSC_DOMAIN_BY_SLUG = { 'tidyhaus': 'tidyhausph.com', 'doms': 'tidyhausph.com' };
const GSC_BRAND_TERMS = {
  'tidyhaus': ['tidyhaus', 'itidyhaus', 'tidyhaus'],
};

const STRIPE_PK_GLOBAL = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY';
function bookingStripePk(slug) {
  if (demoMode()) return STRIPE_PK_GLOBAL;
  if (slug === 'doms') return process.env.DOMS_STRIPE_PUBLISHABLE_KEY || null;
  if (slug === 'mile-high') return process.env.MILE_HIGH_STRIPE_PUBLISHABLE_KEY || null;
  if (slug === 'austin' || slug === 'atxmountpros' || slug === 'atxtvmount' || slug === 'austinmountingpros' || slug === 'austintvinstall') {
    return process.env.AUSTIN_STRIPE_PUBLISHABLE_KEY || null;
  }
  if (slug === 'precision') return process.env.PRECISION_STRIPE_PUBLISHABLE_KEY || null;
  if (slug === 'houstonmounting' || slug === 'houstontvinstallation' || slug === 'tvhanginghouston' || slug === 'htvmounting') {
    return process.env.Publishable_key_houston_mounting || null;
  }
  if (slug === 'a1tvmounting') return process.env.A1TVMOUNTING_STRIPE_PUBLISHABLE_KEY || null;
  return STRIPE_PK_GLOBAL;
}
import { uploadImage, deleteImage, uploadPrivateImage, readPrivateImage, notePhotoContentType } from './_lib/storage.js';
import { denverToday, noteIsLive, noteIsScheduled, resolveSendAt, cleanNotePhotos, isPrivateNotePhoto, NOTE_PHOTO_PREFIX } from './_lib/notes.js';
import { computeJobPay, paymentState, PAY_DATE_OFFSET_DAYS, isJuan, JUAN_BRACKET_ZERO_FROM } from './_lib/payroll.js';
import { partsMoney, payrollSunday, makePartsPlan, savePartsCorrection, settlePartsAdjustment, partsCorrectionsFor, partsPaymentSnapshot, partsAdjustmentDetail } from './_lib/payroll-parts.js';
import { isHoustonBooking } from './_lib/houston-bonus.js';
import { scammerList, isScammer, SCAMMER_BOOKING_ERROR } from './_lib/scammer.js';
import { couponAmountFor, couponCodesFor, couponCacheClear, multiTvDiscountConfigFor, multiTvDiscountConfigCacheClear } from './book.js';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed'];
const SETTABLE_STATUSES = ['pending', 'confirmed', 'assigned', 'on_the_way', 'completed', 'cancelled', 'no_show'];

const SECONDARY_INELIGIBLE_NAMES = ['juan', 'zach'];
function isSecondaryIneligibleName(name) {
  return SECONDARY_INELIGIBLE_NAMES.includes((name || '').trim().toLowerCase());
}
const bringsOwnSecondTech = isSecondaryIneligibleName;

const PARTNER_SLUG = {
  'tidyhaus': 'doms', 'doms': 'tidyhaus', 'mile-high': 'tidyhaus', 'austin': 'tidyhaus', 'precision': 'tidyhaus',
};

async function partnerBusiness(db, hostSlug) {
  const pslug = PARTNER_SLUG[hostSlug];
  if (!pslug) return null;
  const { data } = await db.from('businesses')
    .select('id, slug, name, timezone').eq('slug', pslug).eq('active', true).maybeSingle();
  return data || null;
}

const _denverAreaCache = new Map();
async function isManilaArea(db, areaId) {
  if (!_denverAreaCache.has(areaId)) _denverAreaCache.set(areaId, (async () => {
    const { data } = await db.from('service_areas').select('name').eq('id', areaId).maybeSingle();
    return /denver/i.test(data?.name || '');
  })().catch(() => { _denverAreaCache.delete(areaId); return false; }));
  return _denverAreaCache.get(areaId);
}
const _dfwAreaCache = new Map();
async function isDfwArea(db, areaId) {
  if (!_dfwAreaCache.has(areaId)) _dfwAreaCache.set(areaId, (async () => {
    const { data } = await db.from('service_areas').select('name').eq('id', areaId).maybeSingle();
    return /dfw|dallas|fort worth/i.test(data?.name || '');
  })().catch(() => { _dfwAreaCache.delete(areaId); return false; }));
  return _dfwAreaCache.get(areaId);
}
async function metroPartner(db, hostSlug, hostArea) {
  if (hostSlug === 'tidyhaus' && hostArea && await isDfwArea(db, hostArea)) {
    const { data } = await db.from('businesses')
      .select('id, slug, name, timezone').eq('slug', 'a1tvmounting').eq('active', true).maybeSingle();
    return data || null;
  }
  return partnerBusiness(db, hostSlug);
}
async function rosterScopes(db, hostBiz, pool, postalCode, hostAreaOverride) {
  const zip = (postalCode || '').toString().trim();
  const hostArea = hostAreaOverride !== undefined
    ? hostAreaOverride
    : (zip ? await serviceAreaIdFromPostal(db, hostBiz.id, zip) : null);
  const host = { bizId: hostBiz.id, serviceAreaId: hostArea, soleTechOf: hostBiz.slug, zip };
  if ((pool === '' || pool === 'own') && (hostBiz.slug === 'tidyhaus' || hostBiz.slug === 'doms')
      && hostArea && await isManilaArea(db, hostArea)) pool = 'cross';
  if ((pool === '' || pool === 'own') && hostBiz.slug === 'tidyhaus'
      && hostArea && await isDfwArea(db, hostArea)) pool = 'cross';
  if (pool !== 'cross' && pool !== 'partner') return [host];
  const p = await metroPartner(db, hostBiz.slug, hostArea);
  if (!p) return [host];
  const partnerArea = zip ? await serviceAreaIdFromPostal(db, p.id, zip) : null;
  const partnerScope = { bizId: p.id, serviceAreaId: partnerArea, soleTechOf: hostBiz.slug, zip };
  if (pool === 'partner') return [partnerScope];
  return [host, partnerScope];
}

function zip5(postalCode) {
  const s = String(postalCode || '').trim();
  const m = s.match(/^(\d{5})(?:[-\s]\d{1,4})?$/);
  return m ? m[1] : s;
}
async function serviceAreaIdFromPostal(db, businessId, postalCode) {
  if (!postalCode) return null;
  const { data, error } = await db.from('service_area_zips')
    .select('service_area_id')
    .eq('business_id', businessId)
    .eq('postal_code', zip5(postalCode))
    .maybeSingle();
  if (error) throw error;
  return data?.service_area_id || null;
}

async function crossMetroMismatch(db, bookingAreaId, techIds, confirmedIds) {
  const confirmed = new Set((confirmedIds || []).map(String));
  const ids = (techIds || []).filter(id => id && id !== 'any' && !confirmed.has(String(id)));
  if (!bookingAreaId || !ids.length) return null;
  const { data: techs } = await db.from('technicians')
    .select('id, name, service_area_id').in('id', ids);
  const areaIds = [...new Set([bookingAreaId, ...(techs || []).map(t => t.service_area_id).filter(Boolean)])];
  const { data: areas } = await db.from('service_areas').select('id, name').in('id', areaIds);
  const byId = new Map((areas || []).map(a => [a.id, a]));
  const norm = (id) => String(byId.get(id)?.name || '').trim().toLowerCase();
  const bookingMetro = norm(bookingAreaId);
  if (!bookingMetro) return null;
  for (const t of techs || []) {
    if (!t.service_area_id) continue;
    const techMetro = norm(t.service_area_id);
    if (techMetro && techMetro !== bookingMetro) {
      return {
        techId: t.id, techName: t.name,
        techMetro: byId.get(t.service_area_id)?.name || 'another metro',
        bookingMetro: byId.get(bookingAreaId)?.name || 'this metro',
      };
    }
  }
  return null;
}

async function areaTimezone(db, serviceAreaId, fallbackTz) {
  if (!serviceAreaId) return fallbackTz;
  try {
    const { data, error } = await db.from('service_areas').select('timezone').eq('id', serviceAreaId).maybeSingle();
    if (error) throw error;
    return data?.timezone || fallbackTz;
  } catch (error) {
    if (['42703', 'PGRST204'].includes(error?.code) && missingColumn(error.message) === 'timezone') return fallbackTz;
    throw error;
  }
}

function slotTimeLabel(tz, iso) {
  if (!iso || !tz) return null;
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(iso)).reduce((a, x) => (a[x.type] = x.value, a), {});
    const mins = ((p.hour === '24' ? 0 : Number(p.hour)) * 60) + Number(p.minute);
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const to12 = (s) => { let [h, m] = s.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
    for (const s of SLOTS) if (mins >= toMin(s.start) && mins < toMin(s.end)) return to12(s.start);
    for (const s of SLOTS) if (toMin(s.start) === mins) return to12(s.start);
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  } catch { return null; }
}

async function travelPayoutMap(db, businessId) {
  const map = new Map();
  let { data, error } = await db.from('service_area_zips')
    .select('postal_code, tech_payout').eq('business_id', businessId);
  if (error) return map;
  for (const r of data || []) {
    const p = Number(r.tech_payout) || 0;
    if (p !== 0) map.set(String(r.postal_code), p);
  }
  return map;
}

function adminAuthorName(auth) {
  const n = auth && auth.name ? String(auth.name).trim() : '';
  return n || (auth && auth.role === 'owner' ? 'Owner' : 'Office');
}


export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = (req.query.action || (req.body && req.body.action) || '').toString();
  const body = req.body || {};

  try {
    if (action === 'login') return await login(req, res, body);
    if (action === 'gads_oauth_callback') {
      try { const em = await gadsHandleCallback(serviceClient(), String(req.query.code || ''), String(req.query.state || '')); res.setHeader('Location', '/admin.html#gads=connected:' + encodeURIComponent(em)); }
      catch (e) { res.setHeader('Location', '/admin.html#gads=' + encodeURIComponent(e.message || 'failed')); }
      return res.status(302).end();
    }
    if (action === 'review') return await review(req, res, body);
    if (action === 'estimate_approve') return await estimateApprove(req, res, body);
    if (action === 'estimate_approve_info') return await estimateApproveInfo(req, res, body);
    if (action === 'estimate_slots') return await estimateSlots(req, res);
    if (action === 'services_public') return await servicesPublic(req, res, body);
    if (action === 'gds_upsell_info') return await gdsUpsellInfo(req, res, body);
    if (action === 'gds_upsell_add') return await gdsUpsellAdd(req, res, body);
    if (action === 'reschedule_info') return await rescheduleInfo(req, res, body);
    if (action === 'reschedule_submit') return await rescheduleSubmit(req, res, body);
    if (action === 'review_email_preview') return await reviewEmailPreview(req, res);
    if (action === 'send_test_review_email') return await sendTestReviewEmail(req, res, body);
    if (action === 'session_status') return await sessionStatus(req, res);
    if (action === 'call_ingest') return await callIngest(req, res, body);
    if (action === 'call_connect') return await callConnect(req, res);
    if (action === 'call_attempt_status') return await callAttemptStatus(req, res);
    if (action === 'call_attempt_done') return await callAttemptDone(req, res);

    let auth = verifyToken((action === 'call_recording' || action === 'note_photo' || action === 'sms_media') ? (getBearer(req) || req.query.token) : getBearer(req));
    if (auth && auth.kind === 'auditor') {
      const isWrite = AUDITOR_WRITE_ACTIONS.has(action) || (action === 'private_cal' && req.method === 'POST');
      const allowed = isWrite || AUDITOR_ADMIN_ACTIONS.has(action);
      const methodOk = isWrite ? req.method === 'POST' : req.method === 'GET';
      if (!allowed || !methodOk) return res.status(401).json({ error: 'Unauthorized' });
      auth = { kind: 'admin', role: 'auditor', scope: 'all', name: auth.name || 'Jiyah', auditor: true, ...(auth.owner === true ? { owner_view: true } : {}) };
    }
    if (!auth || auth.kind !== 'admin') return res.status(401).json({ error: 'Unauthorized' });

    const db = serviceClient();
    await loadCoverageOverrides(db);
    auth = effectiveAuth(auth);
    if (auth.offToday && !OFF_DAY_ACTIONS.has(action) && !(['pipeline', 'call_start', 'review_call_log'].includes(action) && auth.role === 'secretary')) return res.status(403).json({ error: 'Off today', off_today: true });

    switch (action) {
      case 'send_spam_notice':  return await sendSpamNotice(req, res);
      case 'send_gds_rate_update': return await sendGdsRateUpdate(req, res, db);
      case 'daily_digest_resend': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        const offset = (req.query.offset != null && req.query.offset !== '') ? parseInt(req.query.offset, 10) : 0;
        const dryRun = req.query.dry === '1';
        const out = await sendDailyBookingDigest({ force: true, dryRun, offset });
        return res.status(200).json({ ok: true, ...out });
      }
      case 'bracket_sync_run_now': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        const r = await dispatchBracketScan();
        return res.status(200).json({ ok: r.ok, configured: r.configured, status: r.status, error: r.ok ? null : (r.body || null) });
      }
      case 'launch_status':        return await launchStatus(req, res, db, auth);
      case 'launch_traffic':       return await launchTraffic(req, res, db, auth);
      case 'web_hub':              return await webHub(req, res, db, auth);
      case 'launch_checklist_set': return await launchChecklistSet(req, res, db, auth, body);
      case 'launch_market_checklist_set': return await launchMarketChecklistSet(req, res, db, auth, body);
      case 'launch_health':        return await launchHealth(req, res, db, auth);
      case 'launch_notes_set':     return await launchNotesSet(req, res, db, auth, body);
      case 'launch_score_set':     return await launchScoreSet(req, res, db, auth, body);
      case 'launch_snapshot':      return await launchSnapshot(req, res, db, auth);
      case 'launch_snapshot_save': return await launchSnapshotSave(req, res, db, auth, body);
      case 'zb_import':         return await zbImport(req, res, db, body);
      case 'summary':           return await summary(req, res, db, auth);
      case 'services':          return await services(req, res, db, auth);
      case 'service_options':   return await serviceOptions(req, res, db, auth);
      case 'widget_prices_list': return await widgetPricesList(req, res, db, auth);
      case 'widget_prices_save': return await widgetPricesSave(req, res, db, auth, body);
      case 'travel_fees_list':  return await travelFeesList(req, res, db, auth);
      case 'travel_fees_save':  return await travelFeesSave(req, res, db, auth, body);
      case 'travel_distance_preview': return await travelDistancePreview(req, res, db, auth, body);
      case 'coupons_list':      return await couponsList(req, res, db, auth);
      case 'coupons_save':      return await couponsSave(req, res, db, auth, body);
      case 'coupons_delete':    return await couponsDelete(req, res, db, auth, body);
      case 'multi_tv_discount_get':  return await multiTvDiscountGet(req, res, db, auth);
      case 'multi_tv_discount_save': return await multiTvDiscountSave(req, res, db, auth, body);
      case 'seed_tv_options':   return await seedTvOptions(req, res, db, auth);
      case 'relabel_tv_size':   return await relabelTvSize(req, res, db, auth);
      case 'available_slots':   return await availableSlots(req, res, db, auth);
      case 'available_dates':   return await availableDates(req, res, db, auth);
      case 'calendar':          return await calendar(req, res, db, auth);
      case 'calendar_probe':    return await calendarProbe(req, res, db, auth);
      case 'job_view_businesses': return await jobViewBusinesses(req, res, db, auth);
      case 'availability_overview': return await availabilityOverview(req, res, db, auth);
      case 'bookings':          return await bookings(req, res, db, auth);
      case 'booking_create':    return await bookingCreate(req, res, db, auth, body);
      case 'booking_repeat':    return await bookingRepeat(req, res, db, auth, body);
      case 'booking_series_stop': return await bookingSeriesStop(req, res, db, auth, body);
      case 'booking_update':    return await bookingUpdate(req, res, db, auth, body);
      case 'booking_address_update': return await bookingAddressUpdate(req, res, db, auth, body);
      case 'booking_authorization': return await bookingAuthorization(req, res, db, auth);
      case 'booking_line_items_save': return await bookingLineItemsSave(req, res, db, auth, body);
      case 'booking_slots':        return await bookingSlots(req, res, db, auth, body);
      case 'booking_card_update': return await bookingCardUpdate(req, res, db, auth, body);
      case 'booking_payment':   return await bookingPayment(req, res, db, auth, body);
      case 'booking_card':      return await bookingCard(req, res, db, auth);
      case 'disputes':          return await disputes(req, res, db, auth);
      case 'dispute_detail':    return await disputeDetail(req, res, db, auth);
      case 'dispute_submit':    return await disputeSubmit(req, res, db, auth, body);
      case 'booking_photos':       return await bookingPhotos(req, res, db, auth);
      case 'booking_photo_add':    return await bookingPhotoAdd(req, res, db, auth, body);
      case 'booking_photo_delete': return await bookingPhotoDelete(req, res, db, auth, body);
      case 'booking_photo_set_status': return await bookingPhotoSetStatus(req, res, db, auth, body);
      case 'booking_notes':        return await bookingNotes(req, res, db, auth);
      case 'booking_note_add':     return await bookingNoteAdd(req, res, db, auth, body);
      case 'booking_note_delete':  return await bookingNoteDelete(req, res, db, auth, body);
      case 'photo_gallery':        return await photoGallery(req, res, db, auth);
      case 'jiyah_photos':         return await jiyahPhotos(req, res, db, auth);
      case 'review_bonus_unseen': return await reviewBonusUnseen(req, res, db, auth);
      case 'review_bonus_ack':    return await reviewBonusAck(req, res, db, auth, body);
      case 'gads_auth_url': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        return res.status(200).json({ url: await gadsAuthUrl(db) });
      }
      case 'staff_notices':     return await staffNotices(req, res, db, auth);
      case 'staff_notice_ack':  return await staffNoticeAck(req, res, db, auth, body);
      case 'call_task_log':     return await callTaskLog(req, res, db, auth, body);
      case 'signature_waive':   return await signatureWaive(req, res, db, auth, body);
      case 'critical_alerts': {
        const { data } = await db.from('critical_alerts').select('id, call_id, caller_phone, customer_name, reason, excerpt, created_at, business_id, technician_id').is('handled_at', null).order('created_at', { ascending: false }).limit(20);
        const tIds = [...new Set((data || []).map((r) => r.technician_id).filter(Boolean))];
        const { data: ts } = tIds.length ? await db.from('technicians').select('id, name').in('id', tIds) : { data: [] };
        const tn = Object.fromEntries((ts || []).map((t) => [t.id, t.name]));
        return res.status(200).json({ alerts: (data || []).map((r) => ({ ...r, tech: tn[r.technician_id] || null })) });
      }
      case 'critical_handle': {
        const { error } = await db.from('critical_alerts').update({ handled_by: adminAuthorName(auth), handled_at: new Date().toISOString() }).eq('id', String(body.id || '')).is('handled_at', null);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }
      case 'gads_report': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        const saved = async (p) => { const { data } = await db.from('integration_tokens').select('value').eq('provider', p).maybeSingle(); try { return data ? JSON.parse(data.value) : null; } catch (_) { return null; } };
        const cRep = await saved('google_ads_report'), cSt = await saved('google_ads_status');
        if (cRep && cSt && cRep.v === 3 && Date.now() - new Date(cRep.at).getTime() < 3600e3) return res.status(200).json({ status: cSt, report: cRep, cached: true });
        try {
          const live = await Promise.race([(async () => ({ st: await gadsStatus(db), rep: await gadsReport(db) }))(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000))]);
          if ((live.rep.rows || []).length) return res.status(200).json({ status: live.st, report: live.rep });
        } catch (_) {}
        if (cRep) return res.status(200).json({ status: cSt || { connected: true }, report: cRep, cached: true });
        return res.status(200).json({ error: 'Google Ads is busy. Try again later.' });
      }
      case 'gads_crm_calls': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        const nums = (Array.isArray(body.numbers) ? body.numbers : []).map((n) => String(n).replace(/[^0-9]/g, '').slice(-10)).filter((n) => n.length === 10);
        if (!nums.length) return res.status(200).json({ calls: [] });
        const { data, error } = await db.from('calls').select('id, occurred_at, caller_phone, grasshopper_number, duration_sec, answered, kind').in('kind', ['inbound', 'live']).in('grasshopper_number', nums).gte('occurred_at', new Date(Date.now() - 31 * 864e5).toISOString()).order('occurred_at', { ascending: false }).limit(2000);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ calls: data || [] });
      }
      case 'gads_call_match': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        const { data } = await db.from('calls').select('id, occurred_at, caller_phone, grasshopper_number, tracking_label').in('kind', ['inbound', 'live']).gte('occurred_at', String(body.from || '')).lte('occurred_at', String(body.to || '')).order('occurred_at', { ascending: false }).limit(1000);
        return res.status(200).json({ calls: data || [] });
      }
      case 'gads_query': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsQuery(db, String(body.customer || ''), String(body.query || ''))); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_upload_now': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsUploadBookings(db)); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_dump': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsDump(db, String(body.name || 'dump'), body.queries || {})); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_apply_fixes': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsApplyFixes20261015(db)); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_apply_1016': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsApply20261016(db, { validateOnly: body.validate_only === true })); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_apply_1016b': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsApply20261016b(db, { validateOnly: body.validate_only === true })); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_maps_fix': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsMapsFix(db, { validateOnly: body.validate_only !== false })); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_mutate': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsMutate(db, String(body.customer || ''), String(body.resource || ''), body.operations || [], body.validate_only)); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_audit': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsAudit(db)); } catch (e) { return res.status(200).json({ error: e.message }); }
      }
      case 'gads_status': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        try { return res.status(200).json(await gadsStatus(db)); } catch (e) { return res.status(200).json({ connected: false, error: e.message }); }
      }
      case 'pay_reminder': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        if (req.method !== 'POST' || !body.id) return res.status(400).json({ error: 'id required' });
        const { data: pb, error: pe } = await db.from('bookings').select('id, metadata').eq('id', body.id).maybeSingle();
        if (pe) throw pe;
        if (!pb) return res.status(404).json({ error: 'Not found' });
        const cur = (pb.metadata && pb.metadata.pay_reminder) || {};
        const next = body.on
          ? { ...cur, on: true, started_at: cur.on ? cur.started_at : new Date().toISOString(), stopped: null }
          : { ...cur, on: false, stopped: 'owner', stopped_at: new Date().toISOString() };
        const { error: ue } = await db.from('bookings').update({ metadata: { ...(pb.metadata || {}), pay_reminder: next } }).eq('id', pb.id);
        if (ue) throw ue;
        return res.status(200).json({ ok: true, pay_reminder: next });
      }
      case 'photo_bonus': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        return await photoBonus(req, res, db, auth, body);
      }
      case 'photo_logo_scan':      return res.status(410).json({ error: 'Removed' });
      case 'analytics_overview':   return await analyticsOverview(req, res, db, auth);
      case 'insights_overview':    return await insightsOverview(req, res, db, auth);
      case 'estimate_check': return await estimateCheckAction(req, res, db, auth);
      case 'estimate_excuse': return await estimateExcuseAction(req, res, db, auth, body);
      case 'phone_desk': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        return res.status(200).json(await phoneDesk(db));
      }
      case 'capacity_overview': {
        if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
        return res.status(200).json(await capacityOverview(db));
      }
      case 'customers':         return await customers(req, res, db, auth);
      case 'customer_update':   return await customerUpdate(req, res, db, auth, body);
      case 'customer_detail':   return await customerDetail(req, res, db, auth);
      case 'profit_range':      return await profitRange(req, res, db, auth);
      case 'net_daily_range':   return await netDailyRange(req, res, db, auth);
      case 'technicians':       return await technicians(req, res, db, auth);
      case 'zip_area':          return await zipArea(req, res, db, auth);
      case 'move_quote':        return await moveQuote(req, res, db, auth);
      case 'partner_technicians': return await partnerTechnicians(req, res, db, auth);
      case 'technician_update': return await technicianUpdate(req, res, db, auth, body);
      case 'review_invite_send': return await reviewInviteSend(req, res, db, auth, body);
      case 'tech_invites':       return await techInvites(req, res, db, auth);
      case 'tech_invite_create': return await techInviteCreate(req, res, db, auth, body);
      case 'tech_invite_send':   return await techInviteSend(req, res, db, auth, body);
      case 'tech_invite_revoke': return await techInviteRevoke(req, res, db, auth, body);
      case 'technician_photo_upload': return await technicianPhotoUpload(req, res, db, auth, body);
      case 'tech_availability':     return await techAvailability(req, res, db, auth);
      case 'tech_availability_set': return await techAvailabilitySet(req, res, db, auth, body);
      case 'tech_availability_exception_set': return await techAvailabilityExceptionSet(req, res, db, auth, body);
      case 'reviews':           return await reviews(req, res, db, auth);
      case 'applicants':        return await applicants(req, res, db, auth);
      case 'review_requests':   return await reviewRequests(req, res, db, auth);
      case 'review_resend':     return await reviewResend(req, res, db, auth, body);
      case 'review_offer_send': return await reviewOfferSend(req, res, db, auth, body);
      case 'vip_phones': { const { data } = await db.from('vip_phones').select('phone, paid_jobs'); const scam = await scammerList(db); return res.status(200).json({ phones: (data || []).map((r) => r.phone), counts: Object.fromEntries((data || []).map((r) => [r.phone, r.paid_jobs])), scam: [...scam.phones], scam_emails: [...scam.emails] }); }
      case 'notification_resend': return await notificationResend(req, res, db, auth, body);
      case 'receipt_send':      return await receiptSend(req, res, db, auth, body);
      case 'invoice_send':      return await invoiceSend(req, res, db, auth, body);
      case 'calls':             return await calls(req, res, db, auth);
      case 'call_recording':    return await callRecording(req, res, db, auth);
      case 'call_summary':      return res.status(200).json({ summary: await callSummary(db, String((req.query.id || body.id || '')).slice(0, 64)) });
      case 'call_update':       return await callUpdate(req, res, db, auth, body);
      case 'call_claim':        return await callClaim(req, res, db, auth, body);
      case 'call_start':        return await callStart(req, res, db, auth, body);
      case 'callbacks':         return await callbackRequests(req, res, db, auth, body);
      case 'red_alerts':        return await redAlertsAction(req, res, db, auth, body);
      case 'booking_contact':   return await bookingContact(req, res, db, auth, body);
      case 'call_block':        return await callBlock(req, res, db, auth, body);
      case 'call_unblock':      return await callUnblock(req, res, db, auth, body);
      case 'call_delete':       return await callDelete(req, res, db, auth, body);
      case 'call_live_start':   return await callLiveStart(req, res, db, auth, body);
      case 'review_calls':      return await reviewCalls(req, res, db, auth);
      case 'review_call_log':   return await reviewCallLog(req, res, db, auth, body);
      case 'review_call_report': return await reviewCallReport(req, res, db, auth);
      case 'bad_reviews':       return await badReviews(req, res, db, auth);
      case 'bad_review_dismiss': return await badReviewDismiss(req, res, db, auth, body);
      case 'google_reviews':       return await googleReviews(req, res, db, auth);
      case 'review_ask_rate':      return await reviewAskRate(req, res, db, auth);
      case 'google_review_update': return await googleReviewUpdate(req, res, db, auth, body);
      case 'avg_ticket':        return await avgTicketRange(req, res, db, auth);
      case 'gsc_queries':       return await gscQueries(req, res, db, auth);
      case 'city_pages_analytics': return await cityPagesAnalytics(req, res, db, auth);
      case 'estimates':         return await estimates(req, res, db, auth);
      case 'ring_setup':        return await ringSetup(req, res, db, auth);
      case 'ring_card':         return await ringCard(req, res, db, auth);
      case 'contact_history': {
        const ph = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
        if (ph.length !== 10) return res.status(200).json({ items: [] });
        const since = new Date(Date.now() - 120 * 86400000).toISOString();
        const [cs, ms] = await Promise.all([
          db.from('calls').select('id, occurred_at, kind, answered, duration_sec, handled_by, transcript_summary, resolution, recording_url, tracking_label').eq('caller_phone', ph).in('kind', ['inbound', 'live']).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(40),
          db.from('messages').select('created_at, direction, sent_by, body').ilike('customer_phone', '%' + ph).gte('created_at', since).order('created_at', { ascending: false }).limit(80),
        ]);
        const items = [];
        for (const c of cs.data || []) items.push({ at: c.occurred_at, type: c.kind === 'live' ? 'script' : (c.answered === false ? 'missed' : 'call'), by: c.handled_by && !/^(answered|blocked number)$/i.test(c.handled_by) ? c.handled_by : null,
          secs: c.duration_sec, line: c.tracking_label ? String(c.tracking_label).replace(/^This call is from\s*/i, '').replace(/\.$/, '') : null, outcome: c.resolution || null,
          summary: c.transcript_summary && Array.isArray(c.transcript_summary.items) ? c.transcript_summary.items.map((i) => i.text).slice(0, 4) : null, call_id: c.recording_url ? c.id : null });
        for (const m of ms.data || []) items.push({ at: m.created_at, type: m.direction === 'in' ? 'text_in' : 'text_out', by: m.direction === 'in' ? null : m.sent_by, body: String(m.body || '').slice(0, 500) });
        items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        return res.status(200).json({ items });
      }
      case 'estimate_note_add': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
        const text = String(body.body || '').trim().slice(0, 1000);
        if (!text) return res.status(400).json({ error: 'Write a note first.' });
        const { data: est } = await db.from('estimates').select('id').eq('id', String(body.id || '')).eq('business_id', biz.id).maybeSingle();
        if (!est) return res.status(404).json({ error: 'Estimate not found' });
        const { error } = await db.from('estimate_office_notes').insert({ estimate_id: est.id, body: text, created_by: auth.name || adminAuthorName(auth) });
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      case 'estimate_update':   return await estimateUpdate(req, res, db, auth, body);
      case 'estimate_create':   return await estimateCreate(req, res, db, auth, body);
      case 'estimate_send_sms': return await estimateSendSms(req, res, db, auth, body);
      case 'estimate_link':     return await estimateLink(req, res, db, auth);
      case 'estimate_prefill': {
        let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
        try { return res.status(200).json(await estimatePrefill(db, biz.id, body.phone)); }
        catch (e) { console.error('[estimate_prefill]', e.message); return res.status(200).json({ error: 'AI could not read this call' }); }
      }
      case 'estimate_send_email': return await estimateSendEmail(req, res, db, auth, body);
      case 'estimate_followups': return await estimateFollowups(req, res, db, auth);
      case 'estimate_story':     return await estimateStory(req, res, db, auth);
      case 'estimate_remind':    return await estimateRemind(req, res, db, auth, body);
      case 'estimate_coupon_send': return await estimateCouponSend(req, res, db, auth, body);
      case 'my_day': return await myDay(req, res, db, auth, body);
      case 'ask_andrew': return await askHandler(req, res, db, auth, body);
      case 'transcribe_recent': return await transcribeRecent(req, res, db, auth);
      case 'pipeline': return await pipelineHandler(req, res, db, auth, body);
      case 'estimate_bulk_close': return await estimateBulkClose(req, res, db, auth, body);
      case 'estimate_decline':  return await estimateDecline(req, res, db, auth, body);
      case 'estimate_broker':          return await estimateBroker(req, res, db, auth, body);
      case 'estimate_broker_save_spec': return await estimateBrokerSaveSpec(req, res, db, auth, body);
      case 'estimate_broker_save_bid': return await estimateBrokerSaveBid(req, res, db, auth, body);
      case 'estimate_broker_book':     return await estimateBrokerBook(req, res, db, auth, body);
      case 'quote_economics':   return await quoteEconomics(req, res, db, auth, body);
      case 'quote_coupon':      return await quoteCoupon(req, res, db, auth, body);
      case 'call_event':        return await callEvent(req, res, db, auth, body);
      case 'call_analytics':    return await callAnalytics(req, res, db, auth);
      case 'audit_dashboard':   return await auditDashboard(req, res, db, auth);
      case 'audit_report':      return await auditReport(req, res, db, auth);
      case 'audit_heard':       return await auditHeard(req, res, db, auth);
      case 'audit_owner_note':  return await auditOwnerNote(req, res, db, auth);
      case 'call_numbers':      return await callNumbers(req, res, db, auth);
      case 'twilio_lines':      return await twilioLines(req, res, db, auth, body);
      case 'my_call_performance': return await myCallPerformance(req, res, db, auth);
      case 'my_rung_calls':     return await myRungCalls(req, res, db, auth);
      case 'competitor_backlinks': return await competitorBacklinks(req, res, auth, body);
      case 'missed_by_secretary': return await missedBySecretary(req, res, db, auth);
      case 'schedule_proposal': return await scheduleProposal(req, res, db, auth, body);
      case 'secretary_roster':  return await secretaryRoster(req, res, db, auth);
      case 'call_day_detail':   return await callDayDetail(req, res, db, auth);
      case 'call_ticket':       return await callTicket(req, res, db, auth);
      case 'auditor_note_send': return await auditorNoteSend(req, res, db, auth, body);
      case 'auditor_notes_sent': return await auditorNotesSent(req, res, db, auth);
      case 'auditor_reply_ack': return await auditorReplyAck(req, res, db, auth, body);
      case 'auditor_thread_post': return await auditorThreadPost(req, res, db, auth, body);
      case 'auditor_note_pin': return await auditorNotePin(req, res, db, auth, body);
      case 'auditor_note_edit':
      case 'auditor_note_delete': return await auditorNoteChange(req, res, db, auth, body, action);
      case 'email_quota': return await emailQuota(req, res, auth);
      case 'bracket_inventory': return await bracketInventory(req, res, db, auth);
      case 'bracket_purchases': return await bracketPurchases(req, res, db, auth);
      case 'bracket_update': return await bracketUpdate(req, res, db, auth, body);
      case 'bracket_parse_email': return await bracketParseEmail(req, res, db, auth, body);
      case 'bracket_pending': return await bracketPending(req, res, db, auth);
      case 'bracket_assign': return await bracketAssign(req, res, db, auth, body);
      case 'bracket_receive': return await bracketReceive(req, res, db, auth, body);
      case 'wire_plate_pending': return await wirePlatePending(req, res, db, auth);
      case 'wire_plate_orders': return await wirePlateOrders(req, res, db, auth);
      case 'wire_plate_assign': return await wirePlateAssign(req, res, db, auth, body);
      case 'wire_plate_set_status': return await wirePlateSetStatus(req, res, db, auth, body);
      case 'wire_plate_remove': return await wirePlateRemove(req, res, db, auth, body);
      case 'bracket_set_status': return await bracketSetStatus(req, res, db, auth, body);
      case 'bracket_confirm_info': return await bracketConfirmInfo(req, res, db, auth);
      case 'gbp_listings': return await gbpListings(req, res, db, auth);
      case 'gbp_drop_seen': return await gbpDropSeen(req, res, db, auth, body);
      case 'rank_overview': return await rankOverview(req, res, db, auth);
      case 'rank_run': return await rankRun(req, res, db, auth, body);
      case 'rank_point': return await rankPoint(req, res, db, auth);
      case 'rank_settings': return await rankSettings(req, res, db, auth, body);
      case 'rank_keywords': return await rankKeywords(req, res, db, auth, body);
      case 'rank_ads': return await rankAds(req, res, db, auth, body);
      case 'private_cal': return await calendarAction(req, res, db, auth, body);
      case 'prospects': return await prospectsAction(req, res, db, auth, body, { secretaryNames: secretaryNameList() });
      case 'payroll': return await payroll(req, res, db, auth);
      case 'payroll_combined': return await payrollCombined(req, res, db, auth);
      case 'payroll_parts_preview':
      case 'payroll_parts_save':
      case 'payroll_parts_settle': return await payrollParts(req, res, db, auth, body, action);
      case 'actual_profit_save': return await actualProfitSave(req, res, db, auth);
      case 'office_pay_save': return await officePaySave(req, res, db, auth);
      case 'office_pay_rate_save': return await officePayRateSave(req, res, db, auth);
      case 'view_as': return await viewAs(req, res, db, auth);
      case 'secretary_availability': return await secretaryAvailability(req, res, db, auth);
      case 'secretary_availability_set': return await secretaryAvailabilitySet(req, res, db, auth, body);
      case 'secretary_availability_exception_set': return await secretaryAvailabilityExceptionSet(req, res, db, auth, body);
      case 'secretary_changes':      return await secretaryChanges(req, res, db, auth);
      case 'secretary_changes_seen': return await secretaryChangesSeen(req, res, db, auth, body);
      case 'secretaries_list': return await secretariesList(req, res, db, auth);
      case 'team_directory': return await teamDirectory(req, res, db, auth);
      case 'va_board': return await vaBoard(req, res, db, auth);
      case 'secretary_coverage_set': return await secretaryCoverageSet(req, res, db, auth, body);
      case 'secretary_week_set': return await secretaryWeekSet(req, res, db, auth, body);
      case 'notes_active': return await notesActive(req, res, db, auth);
      case 'assistant_tasks': return await assistantTasks(req, res, db, auth, body);
      case 'joey_metrics': return await joeyMetrics(req, res, db, auth);
      case 'notes_read':   return await notesRead(req, res, db, auth, body);
      case 'notes_list':   return await notesList(req, res, db, auth);
      case 'notes_add':    return await notesAdd(req, res, db, auth, body);
      case 'notes_delete': return await notesDelete(req, res, db, auth, body);
      case 'notes_update': return await notesUpdate(req, res, db, auth, body);
      case 'domain_watch_list':   return await domainWatchList(req, res, db, auth);
      case 'domain_watch_add':    return await domainWatchAdd(req, res, db, auth, body);
      case 'domain_watch_delete': return await domainWatchDelete(req, res, db, auth, body);
      case 'domain_watch_alerts':  return await domainWatchAlerts(req, res, db, auth);
      case 'domain_watch_dismiss': return await domainWatchDismiss(req, res, db, auth, body);
      case 'domain_watch_check':  return await domainWatchCheck(req, res, db, auth, body);
      case 'notes_photo':  return await notesPhoto(req, res, db, auth, body);
      case 'website_edits':     return await websiteEdits(req, res, db, auth);
      case 'website_edit_add':  return await websiteEditAdd(req, res, db, auth, body);
      case 'note_photo':   return await notePhoto(req, res, db, auth);
      case 'sms_media': {
        const { data: m } = await db.from('messages').select('twilio_sid').eq('id', String(req.query.id || '')).maybeSingle();
        const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
        if (!m || !m.twilio_sid || !sid || !tok) return res.status(404).end();
        const basic = 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64');
        const list = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${encodeURIComponent(m.twilio_sid)}/Media.json`, { headers: { Authorization: basic } }).then((r) => r.ok ? r.json() : null).catch(() => null);
        const item = list && Array.isArray(list.media_list) ? list.media_list[Math.max(0, Number(req.query.i) || 0)] : null;
        if (!item) return res.status(404).end();
        const r = await fetch('https://api.twilio.com' + String(item.uri).replace(/\.json$/, ''), { headers: { Authorization: basic } });
        if (!r.ok) return res.status(404).end();
        res.setHeader('Content-Type', r.headers.get('content-type') || item.content_type || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        return res.status(200).send(Buffer.from(await r.arrayBuffer()));
      }
      case 'notes_replies_seen': return await notesRepliesSeen(req, res, db, auth);
      case 'tech_notes_targets': return await techNotesTargets(req, res, db, auth);
      case 'tech_notes_add':     return await techNotesAdd(req, res, db, auth, body);
      case 'tech_notes_list':    return await techNotesList(req, res, db, auth);
      case 'tech_notes_delete':  return await techNotesDelete(req, res, db, auth, body);
      case 'tech_notes_update':  return await techNotesUpdate(req, res, db, auth, body);
      case 'places_autocomplete': return await placesAutocomplete(req, res, auth);
      case 'place_details':       return await placeDetails(req, res, auth);
      case 'messages_list':   return await messagesList(req, res, db, auth);
      case 'messages_thread': return await messagesThread(req, res, db, auth);
      case 'messages_send':   return await messagesSend(req, res, db, auth, body);
      case 'sms_verbal_consent': return await smsVerbalConsent(req, res, db, auth, body);
      case 'messages_read':   return await messagesRead(req, res, db, auth, body);
      case 'messages_block':  return await messagesBlock(req, res, db, auth, body);
      case 'messages_new_lines':  return await messagesNewLines(req, res, db, auth);
      case 'messages_new_search': return await messagesNewSearch(req, res, db, auth);
      default:                  return res.status(400).json({ error: `Unknown action "${action}"` });
    }
  } catch (err) {
    console.error('[admin]', action, err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

function staffLogins() {
  try {
    const list = JSON.parse(process.env.STAFF_LOGINS || '[]');
    return (Array.isArray(list) ? list : []).filter((x) => x && x.name && x.password && ['tidyhaus', 'doms'].includes(x.scope));
  } catch { return []; }
}
function secretaryNameList() {
  return [...new Set([displayNameFor('tidyhaus'), displayNameFor('doms'), ...staffLogins().map(x => String(x.name))])];
}
function displayNameFor(scope) {
  if (scope === 'tidyhaus') return process.env.TIDYHAUS_SECRETARY_NAME || 'Office';
  if (scope === 'doms')       return process.env.DOMS_SECRETARY_NAME || 'Joey';
  return process.env.ADMIN_NAME || 'Owner';
}
const JOEY_MOBILE = '0000000000';
const HEATHER_MOBILE = '0000000000';

function secretaryPhoneFor(scope) {
  if (scope === 'doms' || (SECRETARY_EXTRA_BUSINESSES.doms || []).includes(scope)) {
    return process.env.DOMS_SECRETARY_PHONE || JOEY_MOBILE;
  }
  if (scope === 'tidyhaus' || (SECRETARY_EXTRA_BUSINESSES['tidyhaus'] || []).includes(scope)) {
    return process.env.TIDYHAUS_SECRETARY_PHONE || HEATHER_MOBILE || '';
  }
  return '';
}

async function login(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const password = (body.password || '').toString();

  const noPasswords = !process.env.ADMIN_PASSWORD && !process.env.TIDYHAUS_PASSWORD && !process.env.DOMS_PASSWORD;
  const forceBypass = ['1', 'true', 'yes', 'on'].includes(String(process.env.ADMIN_DEV_BYPASS || '').toLowerCase());
  const bypass = noPasswords || forceBypass;

  let role = null, scope = null, personName = null;
  if (bypass) {
    role = 'owner'; scope = 'all';
  } else if (!password) {
    return res.status(400).json({ error: 'Password required' });
  } else if (process.env.ADMIN_PASSWORD && safeEqual(password, process.env.ADMIN_PASSWORD)) {
    role = 'owner'; scope = 'all';
  } else if (process.env.TIDYHAUS_PASSWORD && safeEqual(password, process.env.TIDYHAUS_PASSWORD)) {
    role = 'secretary'; scope = 'tidyhaus';
  } else if (process.env.DOMS_PASSWORD && safeEqual(password, process.env.DOMS_PASSWORD)) {
    role = 'secretary'; scope = 'doms';
  } else {
    const person = staffLogins().find((x) => safeEqual(password, String(x.password)));
    if (person) { role = 'secretary'; scope = person.scope; personName = String(person.name); }
  }
  if (!role) return res.status(401).json({ error: 'Incorrect password' });

  const db = serviceClient();
  await loadCoverageOverrides(db);
  const loginEff = effectiveAuth({ role, scope, name: personName || displayNameFor(scope) });
  const loginExtra = scope === 'all' ? [] : (allowedSlugsFor(loginEff.offToday ? { scope } : loginEff) || []).filter(sl => sl !== scope);
  let q = db.from('businesses').select('id, slug, name, timezone, brand_navy, brand_orange, analytics_config').eq('active', true).order('name');
  if (scope !== 'all') q = q.in('slug', [scope, ...loginExtra]);
  const { data: businesses, error } = await q;
  if (error) throw error;
  for (const b of (businesses || [])) b.stripe_pk = bookingStripePk(b.slug);

  let name = personName || displayNameFor(scope);
  if (scope === 'all' && demoMode()) {
    try { const { data: o } = await db.from('staff_users').select('name').eq('role', 'owner').limit(1).maybeSingle(); if (o && o.name) name = o.name; } catch { /* fall back to env */ }
  }
  const token = signToken({ kind: 'admin', role, scope, name, ...(loginExtra.length ? { allowed: loginExtra } : {}), sess: 1 }, ADMIN_SESSION_MAX);
  const config = {
    email: demoMode() || !!process.env.RESEND_API_KEY,
    sms: smsConfigured(),
    demo: demoMode(),
    maps_key: process.env.GOOGLE_MAPS_API_KEY || null,
    maps_autocomplete: process.env.MAPS_AUTOCOMPLETE === '1' && !!process.env.GOOGLE_MAPS_API_KEY,
  };
  const loginList = loginEff.offToday ? null : (loginEff.scope !== scope ? allowedSlugsFor(loginEff) : null);
  const loginBiz = loginList ? (businesses || []).filter(b => loginList.includes(b.slug)) : (businesses || []);
  return res.status(200).json({ token, role, scope: loginEff.scope || scope, name, config, businesses: loginBiz, ...(loginEff.offToday ? { off_today: true } : {}) });
}

async function viewAs(req, res, db, auth) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const slug = (req.body?.business || '').toString();
  if (slug === 'auditor') {
    const name = (process.env.AUDITOR_NAME || 'Jiyah').toString();
    return res.status(200).json({ audit_token: signToken({ kind: 'auditor', name, owner: true }), name, url: '/audit.html' });
  }
  let staffName = null, viewSlug = slug;
  if (slug.startsWith('staff:')) {
    const person = staffLogins().find((x) => x.name === slug.slice(6));
    if (!person) return res.status(400).json({ error: 'Unknown staff login' });
    staffName = person.name; viewSlug = person.scope;
  }
  if (!['tidyhaus', 'doms'].includes(viewSlug)) return res.status(400).json({ error: 'business must be tidyhaus, doms or auditor' });

  const viewAsExtra = (allowedSlugsFor({ scope: viewSlug }) || []).filter(sl => sl !== viewSlug);
  const { data: businesses, error } = await db.from('businesses')
    .select('id, slug, name, timezone, brand_navy, brand_orange').eq('active', true)
    .in('slug', [viewSlug, ...viewAsExtra]).order('name');
  if (error) throw error;
  for (const b of (businesses || [])) b.stripe_pk = bookingStripePk(b.slug);

  const name = staffName || displayNameFor(viewSlug);
  const token = signToken({ kind: 'admin', role: 'secretary', scope: viewSlug, name, ...(viewAsExtra.length ? { allowed: viewAsExtra } : {}), sess: 1 });
  const config = {
    email: demoMode() || !!process.env.RESEND_API_KEY,
    sms: smsConfigured(),
    demo: demoMode(),
    maps_key: process.env.GOOGLE_MAPS_API_KEY || null,
    maps_autocomplete: process.env.MAPS_AUTOCOMPLETE === '1' && !!process.env.GOOGLE_MAPS_API_KEY,
  };
  return res.status(200).json({ token, role: 'secretary', scope: viewSlug, name, config, businesses: businesses || [] });
}

async function sessionStatus(req, res) {
  const raw = getBearer(req);
  const auth = verifyToken(raw);
  if (!auth || auth.kind !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
  const fresh = refreshToken(auth, { ttlSeconds: ADMIN_SESSION_MAX, maxSeconds: ADMIN_SESSION_MAX });
  const claims = fresh ? verifyToken(fresh) : auth;

  const db = serviceClient();
  await loadCoverageOverrides(db);
  const eff = effectiveAuth(auth);
  let q = db.from('businesses').select('id, slug, name, timezone, brand_navy, brand_orange, analytics_config').eq('active', true).order('name');
  const sessionAllowed = eff.offToday ? allowedSlugsFor({ scope: auth.scope }) : allowedSlugsFor(eff);
  if (sessionAllowed) q = q.in('slug', sessionAllowed);
  const { data: businesses, error } = await q;
  if (error) throw error;
  for (const b of (businesses || [])) b.stripe_pk = bookingStripePk(b.slug);

  const config = {
    email: demoMode() || !!process.env.RESEND_API_KEY,
    sms: smsConfigured(),
    demo: demoMode(),
    maps_key: process.env.GOOGLE_MAPS_API_KEY || null,
    maps_autocomplete: process.env.MAPS_AUTOCOMPLETE === '1' && !!process.env.GOOGLE_MAPS_API_KEY,
  };
  return res.status(200).json({
    token: fresh || raw, refreshed: !!fresh, expires_at: claims.exp, session_started_at: claims.sat || claims.iat || null,
    role: auth.role, scope: eff.scope, name: auth.name, config, businesses: businesses || [], ...(eff.offToday ? { off_today: true } : {})
  });
}

const _bizCache = new Map();
const _bizPending = new Map();
const BIZ_CACHE_TTL_MS = 60_000;
function isAllJobsViewer(auth) { return !!auth && auth.role === 'secretary' && auth.scope === 'doms' && auth.name === 'Joey'; }
function mayViewJobs(auth, slug) { return mayUseBusiness(auth, slug) || (!!slug && isAllJobsViewer(auth)); }
async function jobViewBusinesses(req, res, db, auth) {
  if (!isAllJobsViewer(auth)) return res.status(200).json({ businesses: [] });
  const { data, error } = await db.from('businesses').select('id, slug, name, timezone, brand_navy, brand_orange').eq('active', true).order('name');
  if (error) throw error;
  return res.status(200).json({ businesses: data || [] });
}
async function resolveBusiness(db, auth, slug, opts) {
  if (!slug) { const e = new Error('business is required'); e.status = 400; throw e; }
  if (!(opts && opts.view ? mayViewJobs(auth, slug) : mayUseBusiness(auth, slug))) { const e = new Error('Forbidden for this business'); e.status = 403; throw e; }
  const cached = _bizCache.get(slug);
  if (cached && (Date.now() - cached.at) < BIZ_CACHE_TTL_MS) return cached.biz;
  if (_bizPending.has(slug)) return _bizPending.get(slug);
  const pending = (async () => {
    const { data, error } = await db.from('businesses').select('id, slug, name, timezone').eq('slug', slug).single();
    if (error || !data) { const e = new Error('Business not found'); e.status = 404; throw e; }
    _bizCache.set(slug, { biz: data, at: Date.now() });
    return data;
  })();
  _bizPending.set(slug, pending);
  try { return await pending; }
  finally { if (_bizPending.get(slug) === pending) _bizPending.delete(slug); }
}

function bail(res, err) { return res.status(err.status || 500).json({ error: err.message }); }

async function persistConfirmationEmailStatus(db, bookingId, status) {
  try {
    await db.from('bookings')
      .update({ confirmation_email_status: status, confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', bookingId);
  } catch (e) { /* migration 0075 not applied yet — status just won't show */ }
}

function missingColumn(msg) {
  let m = /Could not find the '([^']+)' column/.exec(msg || '');
  if (m) return m[1];
  m = /column\s+(?:\w+\.)?["']?(\w+)["']?\s+does not exist/i.exec(msg || '');
  return m ? m[1] : null;
}

async function summary(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const tz = biz.timezone || 'Asia/Manila';

  const todayStart = localDayStartUTC(tz, 0);
  const tomorrow = localDayStartUTC(tz, 1);

  const wparam = (req.query.week || '').toString();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(wparam) ? new Date(wparam + 'T12:00:00Z') : new Date();
  const weekStart = startOfWeekUTC(tz, base);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = startOfMonthUTC(tz, weekStart);
  const monthEnd = startOfMonthUTC(tz, new Date(monthStart.getTime() + 40 * 24 * 60 * 60 * 1000));
  const rangeStart = weekStart < monthStart ? weekStart : monthStart;
  const rangeEnd = weekEnd > monthEnd ? weekEnd : monthEnd;

  const [
    { data: today, error: e1 },
    { data: rangeJobs, error: e2 },
    { data: techs, error: e3 },
  ] = await Promise.all([
    fetchBookingRows(sel => db.from('bookings').select(sel)
      .eq('business_id', biz.id)
      .gte('scheduled_at', todayStart.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at', { ascending: true })),
    db.from('bookings').select('price, scheduled_at, status')
      .eq('business_id', biz.id)
      .gte('scheduled_at', rangeStart.toISOString())
      .lt('scheduled_at', rangeEnd.toISOString())
      .in('status', ACTIVE_STATUSES),
    db.from('technicians').select('id, name, phone, status, active')
      .eq('business_id', biz.id).eq('active', true).order('name'),
  ]);
  if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;

  const sum = (rows) => Math.round(rows.reduce((n, r) => n + Number(r.price || 0), 0) * 100) / 100;
  const inWindow = (rows, a, b) => rows.filter(r => { const t = new Date(r.scheduled_at); return t >= a && t < b; });
  const monthCompleted = inWindow(rangeJobs, monthStart, monthEnd).filter(r => r.status === 'completed');
  const avgTicket = monthCompleted.length ? Math.round(sum(monthCompleted) / monthCompleted.length) : 0;
  const revenue = {
    week:  sum(inWindow(rangeJobs, weekStart, weekEnd)),
    month: sum(inWindow(rangeJobs, monthStart, monthEnd)),
    avg_ticket: avgTicket,
  };

  let profit = null;
  if (auth.role === 'owner') {
    const yStart = localDayStartUTC(tz, -1);
    const [{ data: pjobs }, { data: yRows }, { data: allBiz }, travelBiz] = await Promise.all([
      fetchEconomicsRows(sel => db.from('bookings').select(sel)
        .eq('business_id', biz.id)
        .gte('scheduled_at', rangeStart.toISOString())
        .lt('scheduled_at', rangeEnd.toISOString())
        .order('scheduled_at', { ascending: true })),
      fetchEconomicsRows(sel => db.from('bookings').select(sel)
        .eq('business_id', biz.id)
        .gte('scheduled_at', yStart.toISOString())
        .lt('scheduled_at', todayStart.toISOString())),
      db.from('businesses').select('id, slug, name, timezone').eq('active', true),
      travelPayoutMap(db, biz.id),
    ]);

    const earned = (rows) => (rows || []).filter(countsTowardProfit);
    const travelCache = new Map([[biz.id, travelBiz]]);
    const travelMapFor = async (bb) => {
      if (travelCache.has(bb.id)) return travelCache.get(bb.id);
      const m = await travelPayoutMap(db, bb.id);
      travelCache.set(bb.id, m);
      return m;
    };

    const areaNames = await serviceAreaNames(db);
    const weekEconBySlugP = Promise.all((allBiz || []).map(async (bb) => {
      let rows;
      if (bb.id === biz.id) {
        rows = (pjobs || []).filter(b => { const t = new Date(b.scheduled_at); return t >= weekStart && t < weekEnd; });
      } else {
        const r = await fetchEconomicsRows(sel => db.from('bookings').select(sel)
          .eq('business_id', bb.id)
          .gte('scheduled_at', weekStart.toISOString())
          .lt('scheduled_at', weekEnd.toISOString()));
        rows = r.data || [];
      }
      const active = rows.filter(b => ACTIVE_STATUSES.includes(b.status));
      const e = await computeJobEconomics(db, bb, active, true, await travelMapFor(bb));
      const paidProfit = Math.round(earned(active).reduce((n, j) => n + (Number(e[j.id]?.profit) || 0), 0));
      const byMarket = profitByMarket(bb, earned(active), e, areaNames);
      const predictedProfit = Math.round(active.reduce((n, j) => n + (Number(e[j.id]?.profit) || 0), 0));
      return { slug: bb.slug, paidProfit, predictedProfit, byMarket };
    }));

    const d7Start = localDayStartUTC(tz, -6);
    const d7End = localDayStartUTC(tz, 1);
    const avgBySlugP = Promise.all((allBiz || []).map(async (bb) => {
      const { data: rows } = await db.from('bookings').select('price')
        .eq('business_id', bb.id)
        .gte('scheduled_at', d7Start.toISOString())
        .lt('scheduled_at', d7End.toISOString())
        .eq('status', 'completed');
      const real = (rows || []).filter(x => Number(x.price) > 0);
      const count = real.length;
      const total = Math.round(real.reduce((n, x) => n + Number(x.price || 0), 0) * 100) / 100;
      const avg = count ? Math.round(total / count) : null;
      return [bb.slug, { avg, count, total }];
    }));

    const netDailyFor = async (offset) => {
      const parts = await Promise.all((allBiz || []).map(async (bb) => {
        let rows;
        if (offset === 0 && bb.id === biz.id) {
          rows = today;
        } else if (offset === -1 && bb.id === biz.id) {
          rows = yRows;
        } else {
          const btz = bb.timezone || 'Asia/Manila';
          const d0 = localDayStartUTC(btz, offset), d1 = localDayStartUTC(btz, offset + 1);
          ({ data: rows } = await fetchEconomicsRows(sel => db.from('bookings').select(sel)
            .eq('business_id', bb.id)
            .gte('scheduled_at', d0.toISOString())
            .lt('scheduled_at', d1.toISOString())));
        }
        const paidDone = (rows || []).filter(countsTowardProfit);
        if (!paidDone.length) return [bb.slug, 0];
        const e = await computeJobEconomics(db, bb, paidDone, true, await travelMapFor(bb));
        return [bb.slug, Math.round(paidDone.reduce((n, j) => n + (Number(e[j.id]?.profit) || 0), 0))];
      }));
      const bySlug = Object.fromEntries(parts);
      const total = Math.round(parts.reduce((a, [, v]) => a + v, 0));
      return { total, bySlug };
    };


    const now = new Date();
    const isCurrentWeek = now >= weekStart && now < weekEnd;
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = isCurrentWeek ? new Date(lastWeekStart.getTime() + (now.getTime() - weekStart.getTime())) : weekStart;
    const lastWeekProfitP = Promise.all((allBiz || []).map(async (bb) => {
      const { data: rows } = await fetchEconomicsRows(sel => db.from('bookings').select(sel)
        .eq('business_id', bb.id)
        .gte('scheduled_at', lastWeekStart.toISOString())
        .lt('scheduled_at', lastWeekEnd.toISOString()));
      const paid = earned(rows);
      if (!paid.length) return 0;
      const e = await computeJobEconomics(db, bb, paid, true, await travelMapFor(bb));
      return paid.reduce((n, j) => n + (Number(e[j.id]?.profit) || 0), 0);
    })).then(parts => parts.reduce((a, b) => a + b, 0));

    const [weekEconBySlug, avgBySlug, netToday, netYesterday, pWeekLast] = await Promise.all([
      weekEconBySlugP,
      avgBySlugP,
      netDailyFor(0),
      netDailyFor(-1),
      lastWeekProfitP,
    ]);
    const weekBySlug = weekEconBySlug.map(x => [x.slug, x.paidProfit]);
    const predictedBySlug = weekEconBySlug.map(x => [x.slug, x.predictedProfit]);
    const pWeek = weekEconBySlug.find(x => x.slug === biz.slug)?.paidProfit || 0;

    const weekLastRounded = Math.round(pWeekLast);
    const weekTotalCombined = Math.round(weekBySlug.reduce((n, [, v]) => n + v, 0));
    profit = {
      week: Math.round(pWeek),
      week_total: weekTotalCombined,
      today: netToday.total,
      yesterday: netYesterday.total,
      week_predicted: Math.round(predictedBySlug.reduce((n, [, v]) => n + v, 0)),
      week_by_slug: Object.fromEntries(weekBySlug),
      week_by_market: mergeMarkets(weekEconBySlug.map(x => x.byMarket)),
      avg_by_slug: Object.fromEntries(avgBySlug),
      net_daily: netToday.total,
      net_daily_yesterday: netYesterday.total,
      today_by_slug: netToday.bySlug,
      yesterday_by_slug: netYesterday.bySlug,
      week_predicted_by_slug: Object.fromEntries(predictedBySlug),
      week_last: weekLastRounded,
      week_change_pct: weekLastRounded > 0 ? Math.round(((weekTotalCombined - weekLastRounded) / weekLastRounded) * 1000) / 10 : null,
    };

    {
      const { data: apRows } = await db.from('actual_profit_weekly')
        .select('pay_date, doms_stripe_payout, tidyhaus_stripe_payout, tech_pay, lead_gen_payouts')
        .not('doms_stripe_payout', 'is', null)
        .not('tidyhaus_stripe_payout', 'is', null)
        .not('tech_pay', 'is', null)
        .order('pay_date', { ascending: false })
        .limit(104);
      profit.income_history = (apRows || []).map(r => ({
        pay_date: r.pay_date,
        total_made: Math.round((Number(r.doms_stripe_payout) + Number(r.tidyhaus_stripe_payout) + leadGenSum(leadGenMap(r.lead_gen_payouts)) - Number(r.tech_pay)) * 100) / 100,
      })).reverse();
    }

    revenue.week_by_slug = null;
    revenue.week_total = 0;
    try {
      const revBySlug = await Promise.all((allBiz || []).map(async (bb) => {
        const { data: rows } = await db.from('bookings').select('price, status')
          .eq('business_id', bb.id)
          .gte('scheduled_at', weekStart.toISOString())
          .lt('scheduled_at', weekEnd.toISOString())
          .eq('status', 'completed');
        const total = Math.round((rows || []).reduce((n, r) => n + Number(r.price || 0), 0) * 100) / 100;
        return [bb.slug, total];
      }));
      const bySlug = Object.fromEntries(revBySlug);
      const fmtMD = (d) => new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(d);
      const lastDay = new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000);
      revenue.week_by_slug = bySlug;
      revenue.week_total = Math.round(Object.values(bySlug).reduce((a, b) => a + b, 0) * 100) / 100;
      revenue.week_range_label = `${fmtMD(weekStart)} – ${fmtMD(lastDay)}`;
    } catch (e) { console.warn('[admin] weekly revenue-by-business failed:', e.message); }

    revenue.week_secretaries = [];
    try {
      revenue.week_secretaries = await secretaryWeekConversion(db, tz);
    } catch (e) { console.warn('[admin] weekly secretary conversion failed:', e.message); }
  }

  const [photosToPost, address_alerts, estimate_alerts] = await Promise.all([
    (async () => {
      try {
        const { count, error } = await db.from('booking_photos')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id).eq('status', 'to_post');
        return error ? 0 : (count || 0);
      } catch { return 0; }
    })(),
    (async () => {
      const ALERT_STATUSES = ['pending', 'confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress'];
      const out = [];
      try {
        const { data: aRows } = await db.from('bookings')
          .select('id, scheduled_at, address_line1, service_area_id, customer:customers ( name, phone )')
          .eq('business_id', biz.id)
          .gte('scheduled_at', localDayStartUTC(tz, 0).toISOString())
          .in('status', ALERT_STATUSES)
          .order('scheduled_at', { ascending: true }).limit(300);
        const tzCache = new Map();
        const tzFor = async (id) => { const k = String(id || ''); if (tzCache.has(k)) return tzCache.get(k); const v = await areaTimezone(db, id, tz); tzCache.set(k, v); return v; };
        for (const b of (aRows || [])) {
          if (isLikelyStreetAddress(b.address_line1)) continue;
          const atz = await tzFor(b.service_area_id);
          const d = new Date(b.scheduled_at);
          const day = new Intl.DateTimeFormat('en-US', { timeZone: atz, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
          const time = slotTimeLabel(atz, b.scheduled_at) || new Intl.DateTimeFormat('en-US', { timeZone: atz, hour: 'numeric', minute: '2-digit' }).format(d);
          out.push({ id: b.id, name: b.customer?.name || 'Customer', phone: b.customer?.phone || null, when: `${day}, ${time}` });
        }
      } catch (e) { console.warn('[admin] address alerts failed:', e.message); }
      return out;
    })(),
    (async () => {
      const out = [];
      try {
        const { data: eRows, error } = await db.from('estimates')
          .select('id, customer_name, customer_phone, customer_zip, created_at')
          .eq('business_id', biz.id).eq('book_alert', true).not('status', 'in', `(${EST_CLOSED.join(',')})`)
          .order('created_at', { ascending: false }).limit(50);
        if (error) { if (/book_alert/.test(error.message || '')) return []; throw error; }
        const seen = new Set();
        for (const e of (eRows || [])) {
          const key = `${String(e.customer_name || '').trim().toLowerCase()}|${String(e.customer_phone || '').replace(/\D/g, '')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            id: e.id,
            name: e.customer_name || 'Customer',
            phone: e.customer_phone || null,
            no_address: !(e.customer_zip && String(e.customer_zip).trim()),
          });
        }
      } catch (err) { console.warn('[admin] estimate alerts failed:', err.message); }
      return out;
    })(),
  ]);

  return res.status(200).json({
    business: { id: biz.id, slug: biz.slug, name: biz.name, timezone: tz },
    today: (today || []).map(shapeBooking),
    address_alerts,
    estimate_alerts,
    revenue,
    profit,
    technicians: techs || [],
    counts: {
      todayTotal: (today || []).filter(b => b.status !== 'cancelled').length,
      unassigned: (today || []).filter(b => !b.technician_id && b.status !== 'cancelled').length,
      photos_to_post: photosToPost,
    },
  });
}

function calFingerprint(rows) {
  let maxUpdatedAt = '';
  for (const r of rows) { if (r.updated_at && r.updated_at > maxUpdatedAt) maxUpdatedAt = r.updated_at; }
  return { count: rows.length, maxUpdatedAt };
}
async function calendar(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business, { view: true }); } catch (e) { return bail(res, e); }
  const from = (req.query.from || '').toString();
  const to = (req.query.to || '').toString();
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const { data: bk, error } = await fetchBookingRows(sel => db.from('bookings').select(sel)
    .eq('business_id', biz.id)
    .gte('scheduled_at', from).lt('scheduled_at', to)
    .order('scheduled_at', { ascending: true }).limit(2000));
  if (error) throw error;

  const { data: techs } = await db.from('technicians')
    .select('id, name, status, color, active, service_area_id, business_id').eq('business_id', biz.id).eq('active', true).order('name');
  const { data: areas } = await db.from('service_areas')
    .select('id, name, state, timezone').eq('business_id', biz.id).eq('active', true).order('name');

  let ghostBookings = [];
  try {
    const ownTechIds = (techs || []).map(t => t.id);
    const { data: otherBiz } = await db.from('businesses')
      .select('id, name, slug').eq('active', true).neq('id', biz.id);
    const otherBizById = {};
    for (const ob of (otherBiz || [])) otherBizById[ob.id] = ob;
    const otherBizIds = Object.keys(otherBizById);
    const openRef = (b) => {
      const slug = otherBizById[b.business_id]?.slug;
      if (!(slug && mayViewJobs(auth, slug))) return {};
      return (isAllJobsViewer(auth) || (auth && auth.role === 'owner'))
        ? { booking_id: b.id, open_slug: slug, full: true, status: b.status, price: b.price, tip: b.tip, payment_status: b.payment_status }
        : { booking_id: b.id, open_slug: slug };
    };
    const ghostedBookingIds = new Set();
    if (ownTechIds.length && otherBizIds.length) {
      const { data: pbk, error: pbkErr } = await db.from('bookings')
        .select('id, business_id, technician_id, secondary_technician_id, scheduled_at, duration_minutes, status, price, tip, payment_status, customer:customers ( name ), service_area:service_areas ( timezone )')
        .in('business_id', otherBizIds)
        .or(`technician_id.in.(${ownTechIds.join(',')}),secondary_technician_id.in.(${ownTechIds.join(',')})`)
        .not('status', 'in', '(cancelled,no_show)')
        .gte('scheduled_at', from).lt('scheduled_at', to)
        .limit(2000);
      if (pbkErr) throw pbkErr;
      const ownTechIdSet = new Set(ownTechIds);
      for (const b of (pbk || [])) {
        const companyName = otherBizById[b.business_id]?.name || 'Partner';
        const customerName = b.customer?.name || null;
        if (ownTechIdSet.has(b.technician_id)) {
          ghostBookings.push({ technician_id: b.technician_id, scheduled_at: b.scheduled_at, duration_minutes: b.duration_minutes || 60, partner_company: companyName, customer_name: customerName, tz: b.service_area?.timezone || null, ...openRef(b) });
          ghostedBookingIds.add(b.id);
        }
        if (b.secondary_technician_id && ownTechIdSet.has(b.secondary_technician_id)) {
          ghostBookings.push({ technician_id: b.secondary_technician_id, scheduled_at: b.scheduled_at, duration_minutes: b.duration_minutes || 60, partner_company: companyName, customer_name: customerName, tz: b.service_area?.timezone || null, ...openRef(b) });
          ghostedBookingIds.add(b.id);
        }
      }
    }

    if (['tidyhaus', 'doms'].includes(biz.slug)) {
      const leadGenIds = auth && (auth.role === 'owner' || isAllJobsViewer(auth)) ? otherBizIds : otherBizIds.filter(id => !['tidyhaus', 'doms'].includes(otherBizById[id].slug));
      if (leadGenIds.length) {
        const { data: lgbk, error: lgErr } = await db.from('bookings')
          .select('id, business_id, technician_id, scheduled_at, duration_minutes, status, price, tip, payment_status, customer:customers ( name ), service_area:service_areas ( timezone )')
          .in('business_id', leadGenIds)
          .not('status', 'in', '(cancelled,no_show)')
          .gte('scheduled_at', from).lt('scheduled_at', to)
          .limit(2000);
        if (lgErr) throw lgErr;
        const fresh = (lgbk || []).filter(b => !ghostedBookingIds.has(b.id));
        const techIds = [...new Set(fresh.map(b => b.technician_id).filter(Boolean))];
        const techNameById = {};
        if (techIds.length) {
          const { data: ts } = await db.from('technicians').select('id, name').in('id', techIds);
          for (const t of (ts || [])) techNameById[t.id] = t.name;
        }
        for (const b of fresh) {
          ghostBookings.push({
            technician_id: b.technician_id || null,
            tech_name: techNameById[b.technician_id] || null,
            scheduled_at: b.scheduled_at,
            duration_minutes: b.duration_minutes || 60,
            partner_company: otherBizById[b.business_id]?.name || 'Lead gen',
            customer_name: b.customer?.name || null,
            tz: b.service_area?.timezone || null,
            ...openRef(b),
          });
        }
      }
    }
  } catch (e) { console.warn('[admin] calendar ghost bookings failed:', e.message); ghostBookings = []; }
  if (auth && auth.role === 'owner') {
    try {
      const fullIds = [...new Set(ghostBookings.filter(g => g.full && g.booking_id).map(g => g.booking_id))];
      if (fullIds.length) {
        const { data: gRows, error: gErr } = await fetchBookingRows(sel => db.from('bookings').select(sel).in('id', fullIds).limit(2000));
        if (gErr) throw gErr;
        const { data: gBiz } = await db.from('businesses').select('id, slug, name, timezone')
          .in('id', [...new Set((gRows || []).map(r => r.business_id))]);
        const byBiz = {};
        for (const r of (gRows || [])) (byBiz[r.business_id] = byBiz[r.business_id] || []).push(r);
        const econByGhost = {};
        await Promise.all((gBiz || []).map(async (gb) => {
          try { Object.assign(econByGhost, await computeJobEconomics(db, gb, byBiz[gb.id] || [], true)); }
          catch (e) { console.warn('[admin] ghost economics failed for', gb.slug, e.message); }
        }));
        for (const g of ghostBookings) if (g.full && econByGhost[g.booking_id]) g.econ = econByGhost[g.booking_id];
      }
    } catch (e) { console.warn('[admin] calendar ghost economics failed:', e.message); }
  }
  const areaTzById = {};
  for (const a of (areas || [])) areaTzById[a.id] = a.timezone;

  let econById = {};
  try { econById = await computeJobEconomics(db, biz, bk || [], auth.role === 'owner'); }
  catch (e) { console.warn('[admin] calendar economics failed:', e.message); econById = {}; }

  const bookings = (bk || []).map(b => {
    const s = shapeBooking(b);
    if (econById[b.id]) s.econ = econById[b.id];
    s.slot_time = slotTimeLabel(areaTzById[b.service_area_id] || biz.timezone || 'Asia/Manila', b.scheduled_at);
    return s;
  });
  await withTechSms(db, bookings);

  return res.status(200).json({
    business: { id: biz.id, slug: biz.slug, name: biz.name, timezone: biz.timezone || 'Asia/Manila' },
    bookings,
    technicians: techs || [],
    areas: areas || [],
    ghost_bookings: ghostBookings,
    fingerprint: calFingerprint(bk || []),
  });
}
async function calendarProbe(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business, { view: true }); } catch (e) { return bail(res, e); }
  const from = (req.query.from || '').toString();
  const to = (req.query.to || '').toString();
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const { data: rows, error } = await db.from('bookings')
    .select('updated_at')
    .eq('business_id', biz.id)
    .gte('scheduled_at', from).lt('scheduled_at', to)
    .limit(2000);
  if (error) throw error;

  return res.status(200).json(calFingerprint(rows || []));
}

function classifyService(b) {
  if (/assurion/i.test(String(b.notes || '')) || /assurion/i.test(String(b.service?.name || ''))) return 'Assurion';
  const svc = String(b.service?.name || '').toLowerCase();
  const names = (b.line_items || []).map(li => String(li.name || '').toLowerCase());
  if (/handyman/.test(svc) || names.some(n => /handyman/.test(n))) return 'Handyman';
  return 'Home Cleaning';
}

function bracketHardwareCost(lineItems, hasJuan, scheduledAt) {
  if (hasJuan) {
    const t = scheduledAt ? new Date(scheduledAt) : null;
    const ownBracket = t && !isNaN(t) && t < JUAN_BRACKET_ZERO_FROM;
    if (ownBracket) return 0;
  }
  return bracketItemsCost(lineItems);
}

const MULTI_CITY_BIZ = new Set(['tidyhaus', 'doms']);
async function serviceAreaNames(db) {
  const { data } = await db.from('service_areas').select('id, name');
  return new Map((data || []).map(a => [a.id, a.name]));
}
function profitByMarket(bb, jobs, e, areaNames) {
  const raw = {};
  for (const j of (jobs || [])) {
    const area = MULTI_CITY_BIZ.has(bb.slug) ? areaNames.get(j.service_area_id) : null;
    const k = area ? `${bb.slug}|${area}` : bb.slug;
    raw[k] = (raw[k] || 0) + (Number(e[j.id]?.profit) || 0);
  }
  const keys = Object.keys(raw);
  const target = Math.round(keys.reduce((n, k) => n + raw[k], 0));
  const out = Object.fromEntries(keys.map(k => [k, Math.floor(raw[k])]));
  let left = target - keys.reduce((n, k) => n + out[k], 0);
  for (const k of [...keys].sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])))) { if (left <= 0) break; out[k]++; left--; }
  return out;
}
function mergeMarkets(list) {
  const out = {};
  for (const m of (list || [])) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
  return out;
}

async function profitRange(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const range = (req.query.range || '').toString();
  if (!['30d', 'year'].includes(range)) return res.status(400).json({ error: 'range must be 30d or year' });

  const { data: allBiz } = await db.from('businesses').select('id, slug, name, timezone').eq('active', true);
  const tz = biz.timezone || 'Asia/Manila';

  const end = localDayStartUTC(tz, 1);
  let start;
  if (range === '30d') {
    start = localDayStartUTC(tz, -29);
  } else {
    const localYear = new Date().toLocaleString('en-US', { timeZone: tz, year: 'numeric' });
    start = localDateStartUTC(tz, `${localYear}-01-01`);
  }

  const travelCache = new Map();
  const travelMapFor = async (bb) => {
    if (travelCache.has(bb.id)) return travelCache.get(bb.id);
    const m = await travelPayoutMap(db, bb.id);
    travelCache.set(bb.id, m);
    return m;
  };

  const areaNames = await serviceAreaNames(db);
  const parts = await Promise.all((allBiz || []).map(async (bb) => {
    const { data: rows } = await fetchEconomicsRows(sel => db.from('bookings').select(sel)
      .eq('business_id', bb.id)
      .gte('scheduled_at', start.toISOString())
      .lt('scheduled_at', end.toISOString()));
    const paid = (rows || []).filter(countsTowardProfit);
    if (!paid.length) return [bb.slug, 0, {}];
    const e = await computeJobEconomics(db, bb, paid, true, await travelMapFor(bb));
    return [bb.slug, Math.round(paid.reduce((n, j) => n + (Number(e[j.id]?.profit) || 0), 0)), profitByMarket(bb, paid, e, areaNames)];
  }));

  const by_slug = Object.fromEntries(parts.map(([k, v]) => [k, v]));
  const by_market = mergeMarkets(parts.map(x => x[2]));
  const total = Math.round(parts.reduce((a, [, v]) => a + v, 0));
  return res.status(200).json({ range, total, by_slug, by_market, from: start.toISOString(), to: end.toISOString() });
}

async function netDailyRange(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const range = (req.query.range || '').toString();
  if (!['7d', '30d'].includes(range)) return res.status(400).json({ error: 'range must be 7d or 30d' });
  const days = range === '7d' ? 7 : 30;

  const { data: allBiz } = await db.from('businesses').select('id, slug, name, timezone').eq('active', true);

  const travelCache = new Map();
  const travelMapFor = async (bb) => {
    if (travelCache.has(bb.id)) return travelCache.get(bb.id);
    const m = await travelPayoutMap(db, bb.id);
    travelCache.set(bb.id, m);
    return m;
  };

  const totals = new Array(days).fill(0);

  await Promise.all((allBiz || []).map(async (bb) => {
    const tz = bb.timezone || 'Asia/Manila';
    const oldestStart = localDayStartUTC(tz, -days);
    const end = localDayStartUTC(tz, 0);
    const { data: rows } = await fetchEconomicsRows(sel => db.from('bookings').select(sel)
      .eq('business_id', bb.id)
      .gte('scheduled_at', oldestStart.toISOString())
      .lt('scheduled_at', end.toISOString()));
    const paid = (rows || []).filter(countsTowardProfit);
    if (!paid.length) return;
    const e = await computeJobEconomics(db, bb, paid, true, await travelMapFor(bb));
    const bounds = Array.from({ length: days }, (_, d) => localDayStartUTC(tz, -days + d).getTime());
    for (const b of paid) {
      const t = new Date(b.scheduled_at).getTime();
      let idx = -1;
      for (let d = days - 1; d >= 0; d--) { if (t >= bounds[d]) { idx = d; break; } }
      if (idx < 0) continue;
      totals[idx] += Number(e[b.id]?.profit) || 0;
    }
  }));

  const tz = biz.timezone || 'Asia/Manila';
  const series = totals.map((v, i) => ({
    date: localDayStartUTC(tz, -days + i).toISOString().slice(0, 10),
    total: Math.round(v),
  }));
  return res.status(200).json({ range, days: series });
}

function countsTowardProfit(b) {
  return b.status === 'completed' && paymentState(b) !== 'deferred';
}

async function computeJobEconomics(db, biz, rows, includePay, travelMap = null) {
  const travelPayoutByZip = includePay ? (travelMap || await travelPayoutMap(db, biz.id)) : null;
  const out = {};
  for (const b of rows) {
    const gross = Number(b.price) || 0;
    const refunded = Number(b.amount_refunded) || 0;
    const cost = Math.round((gross - refunded) * 100) / 100;
    const econ = { service_cat: classifyService(b), customer_cost: gross, refunded };
    if (includePay) {
      const techNames = [];
      if (b.technician?.name) techNames.push(b.technician.name);
      if (b.secondary_technician?.name) techNames.push(b.secondary_technician.name);
      const projJob = {
        status: 'completed',
        payment_status: 'paid',
        price: b.price,
        subtotal: b.subtotal,
        notes: b.notes,
        customer_notes: b.customer_notes,
        zenbooker_job_number: b.zenbooker_job_number,
        service_name: b.service?.name || '',
        business_slug: biz.slug,
        line_items: b.line_items || [],
        scheduled_at: b.scheduled_at,
        created_at: b.created_at,
        travel_payout: travelPayoutByZip.get(String(b.postal_code || '')) || 0,
        second_tech: techNames.length > 1,
        is_houston: await isHoustonBooking(db, biz.id, biz.slug, b.service_area_id),
      };
      let payout = 0;
      for (let i = 0; i < techNames.length; i++) {
        payout += Number(computeJobPay({ ...projJob, is_secondary: i > 0 }, techNames[i]).total) || 0;
      }
      const bracketCost = bracketHardwareCost(b.line_items, techNames.some(isJuan), b.scheduled_at);
      const tip = Number(b.tip) || 0;
      econ.tech_payout = Math.round(payout + tip);
      econ.bracket_cost = Math.round(bracketCost);
      econ.profit = Math.round(cost - payout - bracketCost);
      econ.assigned = techNames.length > 0;
      if (b.payment_method === 'cash') {
        const collected = Math.round(Number(b.amount_paid) || Number(b.price) || 0);
        econ.cash_collected = collected;
        econ.net_tech_pay = Math.round(payout + tip) - collected;
      }
    }
    out[b.id] = econ;
  }
  return out;
}

async function availabilityOverview(req, res, db, auth) {
  const slug = (req.query.business || '').toString();
  if (!slug) return res.status(400).json({ error: 'business is required' });
  const { data: allBiz } = await db.from('businesses')
    .select('id, slug, name, timezone').eq('active', true).order('name');
  const bizList = (allBiz || []).map(b => ({ slug: b.slug, name: b.name }));
  const wantAll = slug === 'all';
  const biz = wantAll ? null : (allBiz || []).find(b => b.slug === slug);
  if (!wantAll && !biz) return res.status(404).json({ error: 'Business not found' });
  const bizById = new Map((allBiz || []).map(b => [b.id, b]));
  let techQ = db.from('technicians')
    .select('id, name, color, business_id, status').eq('active', true).order('name');
  if (!wantAll) techQ = techQ.eq('business_id', biz.id);
  const { data: techRows } = await techQ;
  const techs = (techRows || []).map(t => ({
    id: t.id, name: t.name, color: t.color, status: t.status,
    business_slug: bizById.get(t.business_id)?.slug || null,
  }));
  const ids = techs.map(t => t.id);
  const techTz = new Map((techRows || []).map(t => [t.id, bizById.get(t.business_id)?.timezone || 'Asia/Manila']));

  const tz = (biz && biz.timezone) || 'Asia/Manila';
  let availability = [], exceptions = [], bookings = [];
  if (ids.length) {
    const { data: av } = await db.from('technician_availability')
      .select('technician_id, day_of_week, slot_key').in('technician_id', ids);
    availability = av || [];
    const today = new Date().toISOString().slice(0, 10);
    const { data: ex } = await db.from('technician_availability_exceptions')
      .select('technician_id, exception_date, slot_key, is_available')
      .in('technician_id', ids).gte('exception_date', today);
    exceptions = (ex || []).map(r => ({
      technician_id: r.technician_id, date: r.exception_date, slot_key: r.slot_key, is_available: r.is_available,
    }));
    const idList = ids.join(',');
    const occSince = localDayStartUTC(tz, -1).toISOString();
    const runBk = (withSecond) => {
      let q = db.from('bookings')
        .select((withSecond ? 'technician_id, secondary_technician_id, scheduled_at, service_area_id' : 'technician_id, scheduled_at, service_area_id') + esCol())
        .neq('status', 'cancelled').not('scheduled_at', 'is', null)
        .gte('scheduled_at', occSince)
        .order('scheduled_at', { ascending: true }).limit(2000);
      return withSecond
        ? q.or(`technician_id.in.(${idList}),secondary_technician_id.in.(${idList})`)
        : q.in('technician_id', ids);
    };
    let { data: bk, error: bkErr } = await runBk(bookingLiftCols);
    if (bkErr && (/secondary_technician_id/.test(bkErr.message || '') || isExtraSlotsErr(bkErr))) {
      if (/secondary_technician_id/.test(bkErr.message || '')) bookingLiftCols = false;
      if (isExtraSlotsErr(bkErr)) extraSlotsCol = false;
      ({ data: bk } = await runBk(bookingLiftCols));
    }
    const areaTzMap = new Map();
    try {
      const { data: saRows } = await db.from('service_areas').select('id, timezone');
      for (const sa of (saRows || [])) if (sa.timezone) areaTzMap.set(sa.id, sa.timezone);
    } catch { /* fall back to business tz below */ }
    const idSet = new Set(ids);
    const occRows = [];
    for (const b of (bk || [])) {
      const btz = areaTzMap.get(b.service_area_id) || techTz.get(b.technician_id) || tz;
      const slot_key = slotKeyForLocalTime(localHHMM(btz, b.scheduled_at));
      if (!slot_key) continue;
      const date = localDateStr(btz, b.scheduled_at);
      const keys = [slot_key, ...esOf(b)];
      for (const k of keys) {
        if (idSet.has(b.technician_id)) occRows.push({ technician_id: b.technician_id, date, slot_key: k });
        if (b.secondary_technician_id && idSet.has(b.secondary_technician_id))
          occRows.push({ technician_id: b.secondary_technician_id, date, slot_key: k });
      }
    }
    bookings = occRows;
  }
  return res.status(200).json({ slots: SLOTS, days: DAYS, technicians: techs, availability, exceptions, bookings, businesses: bizList, business: wantAll ? { slug: 'all', name: 'All technicians' } : { slug: biz.slug, name: biz.name } });
}

async function bookings(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business, { view: true }); } catch (e) { return bail(res, e); }
  const tz = biz.timezone || 'Asia/Manila';
  const range = (req.query.range || 'upcoming').toString();
  const status = (req.query.status || '').toString();

  const oneId = (req.query.id || '').toString();
  if (oneId) {
    const { data, error } = await fetchBookingRows((sel) =>
      db.from('bookings').select(sel).eq('business_id', biz.id).eq('id', oneId).limit(1));
    if (error) throw error;
    return res.status(200).json({ bookings: await withTechSms(db, (data || []).map(shapeBooking)) });
  }

  const makeQ = (sel) => {
    let q = db.from('bookings').select(sel).eq('business_id', biz.id);
    if (range === 'today') {
      q = q.gte('scheduled_at', localDayStartUTC(tz, 0).toISOString())
           .lt('scheduled_at', localDayStartUTC(tz, 1).toISOString());
    } else if (range === 'week') {
      q = q.gte('scheduled_at', startOfWeekUTC(tz).toISOString());
    } else if (range === 'upcoming') {
      q = q.gte('scheduled_at', localDayStartUTC(tz, 0).toISOString());
    }
    if (status) q = q.eq('status', status);
    return q.order('scheduled_at', { ascending: true }).limit(500);
  };

  const { data, error } = await fetchBookingRows(makeQ);
  if (error) throw error;
  return res.status(200).json({ bookings: await withTechSms(db, (data || []).map(shapeBooking)) });
}

async function withTechSms(db, rows) {
  const ids = rows.map(r => r.id).filter(Boolean);
  if (!ids.length) return rows;
  try {
    const { data, error } = await db.from('tech_sms_log')
      .select('booking_id, technician_id, kind, status, skip_reason, error, sent_at, delivered_at, technician:technicians ( name )')
      .in('booking_id', ids)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    const byBooking = new Map();
    for (const r of (data || [])) {
      const row = { ...r, tech_name: r.technician?.name || null };
      delete row.technician;
      if (!byBooking.has(row.booking_id)) byBooking.set(row.booking_id, []);
      byBooking.get(row.booking_id).push(row);
    }
    for (const b of rows) b.tech_sms = byBooking.get(b.id) || [];
  } catch (e) {
    console.warn('[tech_sms_log] attach skipped:', e.message);
  }
  return rows;
}

async function bookingSlots(req, res, db, auth, body) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business || (body && body.business)); } catch (e) { return bail(res, e); }
  const id = (req.query.id || (body && body.id) || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data: b, error } = await db.from('bookings')
    .select(`id, scheduled_at, technician_id, secondary_technician_id, service_area_id, status${esCol()}`)
    .eq('business_id', biz.id).eq('id', id).maybeSingle();
  if (error && isExtraSlotsErr(error)) { extraSlotsCol = false; return res.status(400).json({ error: 'Extra time slots need migration 0052 applied first.' }); }
  if (error) throw error;
  if (!b) return res.status(404).json({ error: 'Job not found' });
  if (!b.scheduled_at) return res.status(400).json({ error: 'Give this job a date and time first, then add extra slots.' });

  const tz = await areaTimezone(db, b.service_area_id, biz.timezone || 'Asia/Manila');
  const dateStr = localDateStr(tz, b.scheduled_at);
  const mainSlot = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
  const current = esOf(b);

  const techIds = [b.technician_id, b.secondary_technician_id].filter(Boolean);
  const takenByOthers = new Set();
  for (const tid of techIds) {
    const s = await bookedSlotKeysForTech(db, biz.id, tid, dateStr, tz, id);
    for (const k of s) takenByOthers.add(k);
  }

  if (req.method !== 'POST') {
    const addable = SLOTS
      .filter(s => s.key !== mainSlot && !current.includes(s.key) && !takenByOthers.has(s.key))
      .map(s => ({ slot_key: s.key, label: s.label }));
    return res.status(200).json({
      id, date: dateStr, main_slot: mainSlot, extra_slots: current,
      slots: SLOTS.map(s => ({ slot_key: s.key, label: s.label })),
      addable,
    });
  }

  if (!extraSlotsCol) return res.status(400).json({ error: 'Extra time slots need migration 0052 applied first.' });
  const requested = Array.isArray(body && body.slots) ? body.slots.map(String) : [];
  const forcedIds = new Set((body && body.force_unavailable_ids || []).map(String));
  const dow = dayOfWeekFor(dateStr);
  const techSlotKeys = {};
  for (const tid of techIds) techSlotKeys[tid] = await singleTechSlotKeys(db, tid, dateStr, dow);
  const clean = [];
  for (const sk of requested) {
    if (!SLOT_KEYS.has(sk)) return res.status(400).json({ error: `Invalid time slot: ${sk}` });
    if (sk === mainSlot) continue;
    if (takenByOthers.has(sk)) {
      const lab = (SLOTS.find(s => s.key === sk) || {}).label || sk;
      return res.status(409).json({ error: `${lab} is already booked for this technician — can't add it.` });
    }
    for (const tid of techIds) {
      if (forcedIds.has(tid)) continue;
      if (!techSlotKeys[tid].has(sk)) {
        const { data: t } = await db.from('technicians').select('name').eq('id', tid).maybeSingle();
        const lab = (SLOTS.find(s => s.key === sk) || {}).label || sk;
        return res.status(409).json({ error: `${t?.name || 'This technician'} isn't scheduled to work ${lab} — they may have requested it off. Confirm to add it anyway.`, code: 'tech_unavailable', tech_id: tid });
      }
    }
    if (!clean.includes(sk)) clean.push(sk);
  }
  const { error: uErr } = await db.from('bookings').update({ extra_slots: clean }).eq('id', id).eq('business_id', biz.id);
  if (uErr) throw uErr;
  return res.status(200).json({ ok: true, id, extra_slots: clean });
}

async function services(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data, error } = await db.from('services')
    .select('id, name, base_price, duration_minutes, category')
    .eq('business_id', biz.id).eq('active', true).order('sort_order').order('name');
  if (error) throw error;
  return res.status(200).json({ services: data || [] });
}

async function serviceOptions(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const serviceId = (req.query.service_id || '').toString();
  if (!serviceId) return res.status(400).json({ error: 'service_id required' });

  const { data: groups, error: gErr } = await db.from('service_option_groups')
    .select('id, key, label, min_select, max_select, sort_order')
    .eq('business_id', biz.id).eq('service_id', serviceId).order('sort_order');
  if (gErr) throw gErr;

  const ids = (groups || []).map(g => g.id);
  let options = [];
  if (ids.length) {
    const { data: opts, error: oErr } = await db.from('service_options')
      .select('id, group_id, label, price, metadata, sort_order')
      .in('group_id', ids).eq('active', true).order('sort_order');
    if (oErr) throw oErr;
    options = opts || [];
  }
  const byGroup = {};
  for (const o of options) (byGroup[o.group_id] = byGroup[o.group_id] || []).push(o);
  const result = (groups || []).map(g => ({ ...g, options: byGroup[g.id] || [] }));
  return res.status(200).json({ groups: result });
}

const WIDGET_PRICE_CEILING = 100000;
async function widgetPricesList(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data, error } = await db.from('widget_prices')
    .select('id, city_key, section_key, option_id, label, price, sort_order, row_key')
    .eq('business_id', biz.id)
    .order('city_key').order('sort_order');
  if (error) throw error;
  return res.status(200).json({ prices: data || [] });
}
async function widgetPricesSave(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) return res.status(400).json({ error: 'updates required' });
  for (const u of updates) {
    const price = Number(u.price);
    if (!u.id || !Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Each update needs a valid id and a non-negative price' });
    if (price > WIDGET_PRICE_CEILING) return res.status(400).json({ error: `₱${price} is above the ₱${WIDGET_PRICE_CEILING} sanity ceiling for a single widget price — double-check this isn't a typo.` });
  }
  for (const u of updates) {
    const { error } = await db.from('widget_prices')
      .update({ price: Number(u.price), updated_at: new Date().toISOString() })
      .eq('id', u.id).eq('business_id', biz.id);
    if (error) throw error;
  }
  return res.status(200).json({ ok: true, updated: updates.length });
}

const TRAVEL_FEE_CEILING = 500;
async function travelFeesList(req, res, db, auth) {
  if (req.query.business === 'all' && auth.role === 'owner') {
    const { data: bizs, error: bErr } = await db.from('businesses').select('id, slug, name');
    if (bErr) throw bErr;
    const byId = new Map((bizs || []).map(b => [b.id, b]));
    const { data: areas, error: aErr } = await db.from('service_areas')
      .select('id, name, unstaffed, active, business_id').order('name');
    if (aErr) throw aErr;
    const zips = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('service_area_zips')
        .select('id, postal_code, service_area_id, surcharge, tech_payout')
        .order('id').range(from, from + 999);
      if (error) throw error;
      zips.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    zips.sort((a, b) => String(a.postal_code).localeCompare(String(b.postal_code)));
    const out = (areas || []).map(a => { const b = byId.get(a.business_id) || {}; return { ...a, business_slug: b.slug, business_name: b.name }; });
    return res.status(200).json({ areas: out, zips });
  }
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data: areas, error: aErr } = await db.from('service_areas')
    .select('id, name, unstaffed, active').eq('business_id', biz.id).order('name');
  if (aErr) throw aErr;
  const { data: zips, error: zErr } = await db.from('service_area_zips')
    .select('id, postal_code, service_area_id, surcharge, tech_payout')
    .eq('business_id', biz.id).order('postal_code');
  if (zErr) throw zErr;
  return res.status(200).json({ areas: areas || [], zips: zips || [] });
}
async function travelFeesSave(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change travel fees' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }

  const ids = Array.isArray(body.zip_ids) ? body.zip_ids.filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'zip_ids required' });
  const surcharge = Number(body.surcharge);
  const payout = Number(body.tech_payout);
  if (!Number.isFinite(surcharge)) return res.status(400).json({ error: 'Customer fee must be a number' });
  if (!Number.isFinite(payout)) return res.status(400).json({ error: 'Cleaner payout must be a number' });
  if (Math.abs(surcharge) > TRAVEL_FEE_CEILING || Math.abs(payout) > TRAVEL_FEE_CEILING) {
    return res.status(400).json({ error: `$${Math.max(Math.abs(surcharge), Math.abs(payout))} is above the $${TRAVEL_FEE_CEILING} sanity ceiling for a travel fee — double-check this isn't a typo.` });
  }
  if (payout > surcharge && body.confirm_negative !== true) {
    return res.status(409).json({
      code: 'travel_fee_negative',
      error: `That leaves the business $${(payout - surcharge).toFixed(2)} short on every job in this tier (customer ${surcharge<0?'-':''}$${Math.abs(surcharge)}, tech ${payout<0?'-':''}$${Math.abs(payout)}). Save it anyway?`,
    });
  }
  const { data, error } = await db.from('service_area_zips')
    .update({ surcharge, tech_payout: payout })
    .in('id', ids).eq('business_id', biz.id).select('id');
  if (error) throw error;
  return res.status(200).json({ ok: true, updated: (data || []).length });
}

async function travelDistancePreview(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }

  const areaId = (body.area_id || '').toString();
  const originZip = (body.origin_zip || '').toString().replace(/\D/g, '').slice(0, 5);
  if (!areaId) return res.status(400).json({ error: 'area_id required' });
  if (originZip.length !== 5) return res.status(400).json({ error: 'A 5-digit origin zip (where the cleaner lives) is required.' });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(503).json({ error: 'Google Maps key is not configured.' });

  const { data: zips, error: zErr } = await db.from('service_area_zips')
    .select('postal_code, surcharge, tech_payout')
    .eq('business_id', biz.id).eq('service_area_id', areaId).order('postal_code');
  if (zErr) throw zErr;
  if (!zips || !zips.length) return res.status(404).json({ error: 'No zips in that service area.' });

  const out = [];
  for (let i = 0; i < zips.length; i += 25) {
    const batch = zips.slice(i, i + 25);
    const u = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    u.searchParams.set('origins', `${originZip}, USA`);
    u.searchParams.set('destinations', batch.map(z => `${z.postal_code}, USA`).join('|'));
    u.searchParams.set('units', 'imperial');
    u.searchParams.set('key', key);
    const r = await fetch(u).then(x => x.json()).catch(e => ({ status: 'FETCH_ERROR', error_message: e.message }));
    if (r.status !== 'OK') {
      return res.status(502).json({ error: `Distance lookup failed: ${r.error_message || r.status}. If this says the API isn't enabled, turn on "Distance Matrix API" for this key in the Google Cloud console.` });
    }
    const row = (r.rows && r.rows[0] && r.rows[0].elements) || [];
    batch.forEach((z, j) => {
      const el = row[j] || {};
      out.push({
        postal_code: z.postal_code,
        surcharge: Number(z.surcharge) || 0,
        tech_payout: Number(z.tech_payout) || 0,
        miles: el.status === 'OK' ? Math.round((el.distance.value / 1609.34) * 10) / 10 : null,
        minutes: el.status === 'OK' ? Math.round(el.duration.value / 60) : null,
      });
    });
  }
  out.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));
  return res.status(200).json({ origin_zip: originZip, zips: out });
}

const MULTI_TV_FEE_CEILING = 100;
const MULTI_TV_PRICE_TIER_CEILING = 200;
async function multiTvDiscountGet(req, res, db, auth) {
  const cfg = await multiTvDiscountConfigFor(db);
  return res.status(200).json({ config: cfg });
}
async function multiTvDiscountSave(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change the multi-TV discount' });

  const threshold = parseInt(body.tv_threshold, 10);
  if (!Number.isFinite(threshold) || threshold < 2 || threshold > 10) {
    return res.status(400).json({ error: 'TV threshold must be a whole number between 2 and 10' });
  }
  const zeroFeePerTv = Number(body.zero_fee_per_tv);
  const fullCutFee = Number(body.full_cut_fee);
  const partialCutPct = Number(body.partial_cut_pct);
  const tier3 = Number(body.price_tier3);
  const tier4 = Number(body.price_tier4);
  const tier5plus = Number(body.price_tier5plus);
  for (const [label, val, ceiling] of [
    ['Zero-fee-per-TV amount', zeroFeePerTv, MULTI_TV_FEE_CEILING],
    ['Full-cut fee', fullCutFee, MULTI_TV_FEE_CEILING],
    ['3rd-TV price credit', tier3, MULTI_TV_PRICE_TIER_CEILING],
    ['4th-TV price credit', tier4, MULTI_TV_PRICE_TIER_CEILING],
    ['5th-TV+ price credit', tier5plus, MULTI_TV_PRICE_TIER_CEILING],
  ]) {
    if (!Number.isFinite(val) || val < 0) return res.status(400).json({ error: `${label} must be a number of $0 or more` });
    if (val > ceiling) return res.status(400).json({ error: `$${val} is above the $${ceiling} sanity ceiling for ${label.toLowerCase()}, double-check this isn't a typo.` });
  }
  if (!Number.isFinite(partialCutPct) || partialCutPct < 0 || partialCutPct > 1) {
    return res.status(400).json({ error: 'Partial-cut percent must be between 0 and 1 (e.g. 0.60 for 60%)' });
  }
  const partialFees = String(body.partial_cut_fees || '')
    .split(',').map(s => s.trim()).filter(Boolean).map(Number);
  if (!partialFees.length || partialFees.some(n => !Number.isFinite(n) || n < 0)) {
    return res.status(400).json({ error: 'Partial-cut fees must be a comma-separated list of dollar amounts, e.g. 65, 100' });
  }

  const patch = {
    tv_threshold: threshold,
    zero_fee_per_tv: zeroFeePerTv,
    full_cut_fee: fullCutFee,
    partial_cut_pct: partialCutPct,
    partial_cut_fees: partialFees,
    price_discount_enabled: body.price_discount_enabled !== false,
    price_tier3: tier3,
    price_tier4: tier4,
    price_tier5plus: tier5plus,
    updated_at: new Date().toISOString(),
    updated_by: auth.name || auth.role || 'office',
  };
  const existing = await multiTvDiscountConfigFor(db);
  let error;
  if (existing && existing.id) {
    ({ error } = await db.from('multi_tv_discount_config').update(patch).eq('id', existing.id));
  } else {
    ({ error } = await db.from('multi_tv_discount_config').insert(patch));
  }
  if (error) throw error;
  multiTvDiscountConfigCacheClear();
  return res.status(200).json({ ok: true });
}

const LAUNCH_CHECKLIST_ITEMS = [
  { key: 'stripe_keys',  label: 'Stripe live keys set',   auto: 'stripe' },
  { key: 'email_keys',   label: 'Resend live keys set',   auto: 'email' },
  { key: 'website_live', label: 'Website is live',        auto: 'site' },
  { key: 'widget_embedded',    label: 'Booking widget confirmed on the page' },
  { key: 'thank_you_popup',    label: 'Thank-you page shows after booking' },
  { key: 'confirmation_email', label: 'Confirmation email sends' },
  { key: 'on_the_way_text',    label: 'On-the-way text sends' },
  { key: 'review_text',        label: 'Review request text sends' },
  { key: 'tech_alert_correct_business', label: 'Cleaner alert names the correct business' },
  { key: 'phone_live',     label: 'Dedicated phone number receiving calls/texts' },
  { key: 'gbp_created',    label: 'Google Business Profile created' },
  { key: 'gbp_verified',   label: 'GBP verified (postcard/video)' },
  { key: 'gsc_verified',   label: 'Search Console verified + sitemap submitted' },
  { key: 'techs_staffed',  label: 'At least one tech can actually be booked' },
  { key: 'google_ads',     label: 'Google Ads running' },
];

const MARKET_CHECKLIST_ITEMS = LAUNCH_CHECKLIST_ITEMS.map(({ key, label }) => ({ key, label }));

async function launchMarketRows(db) {
  const { data: markets, error } = await db.from('markets')
    .select('id, slug, name, parent_business_slug, url, active, settings, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;

  return Promise.all((markets || []).map(async (m) => {
    let site = { checked: false, ok: null, status: null, error: null };
    if (m.url) {
      site.checked = true;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const t0 = Date.now();
        const r = await fetch(m.url, { signal: ctrl.signal, redirect: 'follow' });
        site.ms = Date.now() - t0;
        clearTimeout(t);
        site.status = r.status;
        site.ok = r.ok;
      } catch (e) {
        site.error = String((e && e.message) || e).slice(0, 120);
      }
    }
    const checklist = (m.settings && m.settings.launch_checklist) || {};
    const notes = (m.settings && m.settings.launch_notes) || '';
    return {
      id: m.id, slug: m.slug, name: m.name, parentSlug: m.parent_business_slug,
      city: (m.settings && m.settings.city) || m.name,
      url: m.url, active: m.active, created_at: m.created_at, site, checklist, notes,
      skip: (m.settings && m.settings.launch_skip) || [],
    };
  }));
}

const LAUNCH_TRAFFIC_SITE_KEY = { 'mile-high': 'milehightvmounting' };
const LAUNCH_NO_METRICS = new Set(['latvpro', 'lainstall']);
async function launchTraffic(req, res, db, auth) {
  if (auth.role !== 'owner' && !isLaunchJoey(auth)) return res.status(403).json({ error: 'Owner only' });
  const DAYS = 60;
  const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const days = [];
  for (let i = DAYS; i >= 1; i--) days.push(dayKey(Date.now() - i * 24 * 60 * 60 * 1000));

  const [{ data: businesses, error: bErr }, { data: markets, error: mErr }] = await Promise.all([
    db.from('businesses').select('slug, url'),
    db.from('markets').select('slug, url'),
  ]);
  if (bErr) throw bErr;
  if (mErr) throw mErr;
  const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return null; } };
  const siteKeyOf = (slug) => LAUNCH_TRAFFIC_SITE_KEY[slug] || slug;
  const marketPath = {};
  const ownSite = new Set();
  for (const m of (markets || [])) { const p = pathOf(m.url); if (p === '/') ownSite.add(m.slug); else if (p) marketPath[m.slug] = p; }

  const metricBiz = (businesses || []).filter(b => !LAUNCH_NO_METRICS.has(b.slug));
  const keys = [...new Set([...metricBiz.map(b => siteKeyOf(b.slug)), ...Object.values(marketPath), ...ownSite, 'doms-okc', 'doms-tulsa'])];
  const pub = serviceClientPublic();
  const [{ data: rows, error }, clickRes] = await Promise.all([
    pub.rpc('launch_daily_traffic', { p_days: DAYS + 1 }).in('key', keys).limit(5000),
    pub.rpc('launch_daily_book_clicks', { p_days: DAYS + 1 }).in('key', keys).limit(5000),
  ]);
  if (error) throw error;

  const idx = new Map(days.map((d, i) => [d, i]));
  const zero = () => ({ s: new Array(DAYS).fill(0), v: new Array(DAYS).fill(0), c: new Array(DAYS).fill(0) });
  const bucket = {};
  for (const r of (rows || [])) {
    const i = idx.get(String(r.day).slice(0, 10));
    if (i === undefined) continue;
    const k = `${r.src}:${r.key}`;
    const b = bucket[k] || (bucket[k] = zero());
    b.s[i] = Number(r.sessions) || 0;
    b.v[i] = Number(r.views) || 0;
  }
  const clicksOk = !clickRes.error;
  for (const r of (clicksOk ? (clickRes.data || []) : [])) {
    const i = idx.get(String(r.day).slice(0, 10));
    if (i === undefined) continue;
    const k = `${r.src}:${r.key}`;
    const b = bucket[k] || (bucket[k] = zero());
    b.c[i] = Number(r.sessions) || 0;
  }
  if (!clicksOk) for (const b of Object.values(bucket)) b.c = null;
  const zeroSeries = () => { const z = zero(); if (!clicksOk) z.c = null; return z; };
  const series = {}, marketSeries = {};
  for (const b of metricBiz) {
    series[b.slug] = (b.slug === 'tidyhaus') ? null : (bucket[`site:${siteKeyOf(b.slug)}`] || zeroSeries());
  }
  for (const m of (markets || [])) {
    const domsKey = /-doms$/.test(m.slug) ? 'doms-' + m.slug.replace(/-doms$/, '') : null;
    marketSeries[m.slug] = domsKey ? (bucket[`site:${domsKey}`] || zeroSeries())
      : ownSite.has(m.slug) ? (bucket[`site:${m.slug}`] || zeroSeries())
      : marketPath[m.slug] ? (bucket[`path:${marketPath[m.slug]}`] || zeroSeries()) : null;
  }
  return res.status(200).json({ days, series, marketSeries });
}

async function webHub(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const q = req.query || {};
  const pub = serviceClientPublic();
  const [{ data: siteRows }, { data: biz }] = await Promise.all([
    pub.rpc('web_hub_sites'),
    db.from('businesses').select('slug, name, url'),
  ]);
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const bySlug = new Map((biz || []).map(b => [b.slug, b]));
  const keyToSlug = Object.fromEntries(Object.entries(LAUNCH_TRAFFIC_SITE_KEY).map(([k, v]) => [v, k]));
  const label = (src) => {
    if (src === 'ha') return 'tidyhausph.com';
    if (src === 'doms') return 'tidyhausph.com';
    const key = src.replace(/^site:/, ''), b = bySlug.get(keyToSlug[key] || key);
    return (b && hostOf(b.url)) || (b && b.name) || key;
  };
  const sites = (siteRows || []).map(r => r.site).filter(Boolean)
    .map(src => ({ src, label: label(src) }))
    .sort((a, b) => (a.src === 'ha' ? -2 : a.src === 'doms' ? -1 : 0) - (b.src === 'ha' ? -2 : b.src === 'doms' ? -1 : 0) || a.label.localeCompare(b.label));
  const src = String(q.src || '');
  if (!src) return res.status(200).json({ sites });
  const from = new Date(q.from), to = new Date(q.to);
  if (isNaN(from) || isNaN(to) || to <= from) return res.status(400).json({ error: 'Bad range' });
  const hourly = q.hourly === '1';
  const call = (f, t) => pub.rpc('web_hub_stats', { p_src: src, p_from: f.toISOString(), p_to: t.toISOString(), p_hourly: hourly });
  const span = to - from;
  const [cur, prev] = await Promise.all([
    call(from, to),
    q.compare === '1' ? call(new Date(from - span), from) : Promise.resolve({ data: null }),
  ]);
  if (cur.error) throw cur.error;
  return res.status(200).json({ sites, cur: cur.data, prev: prev && !prev.error ? prev.data : null });
}

function bookingMarketCreditor(markets) {
  const normPath = p => { const s = String(p || '').trim(); return s ? (s.replace(/\/+$/, '') || '/') : null; };
  const marketByPath = new Map(), marketByCityState = new Map(), marketByCity = new Map();
  (markets || []).forEach((m, i) => {
    for (const p of (m.paths || [])) { const k = normPath(p); if (k && !marketByPath.has(k)) marketByPath.set(k, i); }
    for (const c of (m.cities || [])) {
      const city = String(c).toLowerCase().trim();
      if (!city) continue;
      if (!marketByCity.has(city)) marketByCity.set(city, i);
      if (m.state) { const k = `${city}|${String(m.state).toLowerCase().trim()}`; if (!marketByCityState.has(k)) marketByCityState.set(k, i); }
    }
  });
  const catchAllIdx = 0;
  return (bk) => {
    for (const cand of [bk.source_page, bk.landing_page]) {
      const k = normPath(cand);
      if (k && k !== '/book' && marketByPath.has(k)) return { idx: marketByPath.get(k), basis: 'page' };
    }
    const city = String(bk.city || '').toLowerCase().trim();
    const state = String(bk.state || '').toLowerCase().trim();
    if (city && state && marketByCityState.has(`${city}|${state}`)) return { idx: marketByCityState.get(`${city}|${state}`), basis: 'city' };
    if (city && marketByCity.has(city)) return { idx: marketByCity.get(city), basis: 'city' };
    return { idx: catchAllIdx, basis: 'unattributed' };
  };
}

async function launchHealth(req, res, db, auth) {
  if (auth.role !== 'owner' && !isLaunchJoey(auth)) return res.status(403).json({ error: 'Owner only' });
  const DAY = 24 * 60 * 60 * 1000, now = Date.now();
  const since = (d) => new Date(now - d * DAY).toISOString();
  const soft = (p) => Promise.resolve(p).then(r => (r && r.error) ? null : (r ? r.data : null)).catch(() => null);
  const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

  const [businesses, markets, numbers, areas, calls, msgs, attempts, bookings, reviews, doneJobs, techRows, gbpPostRows] = await Promise.all([
    soft(db.from('businesses').select('id, slug, analytics_config, settings')),
    soft(db.from('markets').select('slug, name, parent_business_slug, url, settings')),
    soft(db.from('tracking_numbers').select('phone, label, display_name, business_slug, market, active')),
    soft(db.from('service_areas').select('id, name, business_id')),
    soft(db.from('calls').select('grasshopper_number, kind, answered, caller_phone, occurred_at, called_back_at')
      .gte('occurred_at', since(30)).limit(20000)),
    soft(db.from('messages').select('our_phone, direction, status, created_at').gte('created_at', since(30)).limit(20000)),
    soft(db.from('call_attempts').select('phone, started_at').gte('started_at', since(8)).limit(10000)),
    soft(db.from('bookings').select('business_id, service_area_id, status, source, city, state, metadata, created_at, customer:customers ( email, phone )').gte('created_at', since(35)).limit(10000)),
    soft(db.from('google_reviews').select('business_id, location_key, rating, review_date').is('dismissed_at', null).limit(10000)),
    soft(db.from('bookings').select('business_id, service_area_id, status, payment_status, source, city, state, metadata, completed_at, paid_at, scheduled_at, customer:customers ( email, phone )')
      .neq('status', 'cancelled')
      .or(`completed_at.gte."${since(30)}",paid_at.gte."${since(30)}",scheduled_at.gte."${since(30)}"`).limit(10000)),
    soft(db.from('technicians').select('name, business_id, active, area:service_areas ( name )').eq('active', true)),
    soft(db.from('gbp_posts').select('location_key, posted_at, summary, image_url, url').order('posted_at', { ascending: false }).limit(1000)),
  ]);
  const bizById = new Map((businesses || []).map(b => [b.id, b.slug]));
  const bizBySlug = new Map((businesses || []).map(b => [b.slug, b.id]));
  const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return null; } };

  const cards = {};
  for (const b of (businesses || [])) if (!LAUNCH_NO_METRICS.has(b.slug)) cards[b.slug] = { kind: 'business', slug: b.slug, bizId: b.id, numbers: [], scores: (b.settings && b.settings.launch_scores) || {}, gbpKey: { doms: 'doms-colorado', a1tvmounting: 'a1-dfw', houstonperfectviewtvmounting: 'perfectview-houston', austin: 'astraea-austin' }[b.slug] || null };
  for (const m of (markets || [])) {
    const city = (m.settings && m.settings.city) || m.name;
    const parentId = bizBySlug.get(m.parent_business_slug);
    const area = (areas || []).find(a => a.business_id === parentId && (a.name === city || a.name === m.name));
    cards['m:' + m.slug] = {
      kind: 'market', slug: m.slug, bizId: parentId, areaId: area ? area.id : null,
      path: m.parent_business_slug === 'tidyhaus' ? pathOf(m.url) : null,
      reviewKey: m.parent_business_slug === 'tidyhaus' ? 'ha-' + String(m.slug).replace(/-ha$/, '')
        : (m.parent_business_slug === 'doms' ? 'doms-' + String(m.slug).replace(/-doms$/, '') : null),
      name: m.name, city, parent: m.parent_business_slug, numbers: [],
      scores: (m.settings && m.settings.launch_scores) || {},
    };
    if (cards['m:' + m.slug].reviewKey === 'ha-la') cards['m:' + m.slug].reviewKey = 'ha-los-angeles';
    const rk = cards['m:' + m.slug].reviewKey;
    const solo = rk ? [] : GMB_LOCATIONS.filter(l => l.business === m.parent_business_slug);
    cards['m:' + m.slug].gbpKey = rk || (solo.length === 1 ? solo[0].key : null);
  }
  for (const c of Object.values(cards)) c.tags = [];
  const LAUNCH_HIDDEN_NUMBERS = new Set(['0000000000']);
  for (const n of (numbers || [])) {
    const ph = last10(n.phone), on = n.active !== false;
    if (LAUNCH_HIDDEN_NUMBERS.has(ph) || isAdsOnlyLine(n)) continue;
    let claimed = false;
    for (const c of Object.values(cards)) {
      if (c.kind !== 'market' || c.parent !== n.business_slug) continue;
      const label = ' ' + String(n.label || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
      const hit = label.includes(' ' + String(c.name).toLowerCase() + ' ')
        || (c.parent === 'doms' && String(n.market || '').toLowerCase() === String(c.city || '').toLowerCase());
      if (hit) { if (on) c.numbers.push(ph); c.tags.push({ phone: ph, active: on }); claimed = true; }
    }
    const b = cards[n.business_slug];
    if (b) {
      if (on) b.numbers.push(ph);
      if (!(claimed && n.business_slug === 'doms')) b.tags.push({ phone: ph, active: on });
      else if (on) b.numbers.pop();
    }
  }

  const inbound = {}, outTexts = {}, missed = {};
  if (calls) for (const c of calls) {
    const ph = last10(c.grasshopper_number); if (!ph) continue;
    const t = Date.parse(c.occurred_at);
    if (c.kind === 'inbound' || c.kind === 'sms') (inbound[ph] = inbound[ph] || []).push(t);
    if (c.kind === 'inbound' && c.answered === false && t >= now - 7 * DAY) (missed[ph] = missed[ph] || []).push(c);
  }
  if (msgs) for (const m of msgs) {
    const ph = last10(m.our_phone); if (!ph) continue;
    const t = Date.parse(m.created_at);
    if (m.direction === 'in') (inbound[ph] = inbound[ph] || []).push(t);
    else if (m.direction === 'out' && t >= now - 7 * DAY) {
      const o = outTexts[ph] || (outTexts[ph] = { sent: 0, failed: 0 });
      o.sent++;
      if (m.status === 'failed' || m.status === 'undelivered') o.failed++;
    }
  }
  const answeredBy = {}, attemptBy = {};
  if (calls) for (const c of calls) if (c.answered) { const p = last10(c.caller_phone); (answeredBy[p] = answeredBy[p] || []).push(Date.parse(c.occurred_at)); }
  if (attempts) for (const a of attempts) { const p = last10(a.phone); (attemptBy[p] = attemptBy[p] || []).push(Date.parse(a.started_at)); }
  const returned = (c) => {
    if (c.called_back_at) return true;
    const p = last10(c.caller_phone), t = Date.parse(c.occurred_at);
    return (answeredBy[p] || []).some(x => x > t) || (attemptBy[p] || []).some(x => x > t);
  };

  const booked = {}, completed = {};
  const keyByBizMarket = new Map();
  for (const b of (businesses || [])) {
    const ms = b.analytics_config && Array.isArray(b.analytics_config.markets) ? b.analytics_config.markets : null;
    if (!ms || !ms.length) continue;
    keyByBizMarket.set(b.id, { credit: bookingMarketCreditor(ms), keys: ms.map(m => {
      const p = ((m.paths || [])[0] || '').replace(/\/+$/, '') || '/';
      if (p === '/') return b.slug;
      const hit = Object.entries(cards).find(([, c]) => c.kind === 'market' && c.bizId === b.id && c.path === p);
      return hit ? hit[0] : null;
    }) });
  }
  const cardKeyOf = (bk) => {
    const split = keyByBizMarket.get(bk.business_id);
    if (split) {
      const md = bk.metadata || {};
      return split.keys[split.credit({ source_page: md.source_page, landing_page: md.landing_page, city: bk.city, state: bk.state }).idx] || null;
    }
    const area = Object.entries(cards).find(([, c]) => c.kind === 'market' && c.areaId && c.areaId === bk.service_area_id);
    return area ? area[0] : (bizById.get(bk.business_id) || null);
  };
  const tally = (into, key, t) => { const e = into[key] || (into[key] = { d7: 0, d30: 0 }); e.d30++; if (t >= now - 7 * DAY) e.d7++; };
  if (bookings !== null) for (const bk of bookings) {
    if (bk.status === 'cancelled' || isInternalContact(bk.customer)) continue;
    const t = Date.parse(bk.created_at);
    if (!(t >= now - 30 * DAY)) continue;
    const key = cardKeyOf(bk);
    if (key) tally(booked, key, t);
  }
  if (doneJobs !== null) for (const bk of doneJobs) {
    if (bk.status === 'cancelled' || isInternalContact(bk.customer)) continue;
    if (bk.status !== 'completed' && bk.payment_status !== 'paid') continue;
    const t = Date.parse(bk.completed_at || bk.paid_at || bk.scheduled_at);
    if (!(t >= now - 30 * DAY && t <= now)) continue;
    const key = cardKeyOf(bk);
    if (key) tally(completed, key, t);
  }

  const out = {};
  for (const [key, c] of Object.entries(cards)) {
    const h = { numbers: c.numbers.length, tags: c.tags };
    if (bookings !== null) h.booked = booked[key] || { d7: 0, d30: 0 };
    if (doneJobs !== null) h.completed = completed[key] || { d7: 0, d30: 0 };
    if (calls !== null || msgs !== null) {
      if (!c.numbers.length) h.phone = null;
      else {
        const ts = c.numbers.flatMap(n => inbound[n] || []);
        const lastIn = ts.length ? Math.max(...ts) : null;
        const prior = ts.filter(t => t < now - 2 * DAY).length;
        const o = c.numbers.reduce((a, n) => { const x = outTexts[n]; if (x) { a.sent += x.sent; a.failed += x.failed; } return a; }, { sent: 0, failed: 0 });
        h.phone = { lastIn: lastIn ? new Date(lastIn).toISOString() : null, usual: prior >= 3, textsSent: o.sent, textsFailed: o.failed };
      }
    }
    if (calls !== null && c.numbers.length) {
      const ms = c.numbers.flatMap(n => missed[n] || []);
      const byCaller = new Map();
      for (const x of ms) { const p = last10(x.caller_phone); if (!byCaller.has(p) || Date.parse(x.occurred_at) > Date.parse(byCaller.get(p).occurred_at)) byCaller.set(p, x); }
      const list = [...byCaller.values()];
      h.missed = { count: list.length, notReturned: list.filter(x => !returned(x)).length };
    }
    if (bookings !== null && c.bizId) {
      const mine = bookings.filter(b => {
        if (b.status === 'cancelled' || b.business_id !== c.bizId) return false;
        if (c.kind === 'market') {
          if (c.areaId) return b.service_area_id === c.areaId;
          if (c.path) return ((b.metadata && b.metadata.source_page) || '').replace(/\/+$/, '') === c.path;
          return false;
        }
        const sp = ((b.metadata && b.metadata.source_page) || '').replace(/\/+$/, '');
        return !Object.values(cards).some(m => m.kind === 'market' && m.bizId === c.bizId
          && ((m.areaId && m.areaId === b.service_area_id) || (m.path && sp && m.path === sp)));
      }).map(b => Date.parse(b.created_at));
      h.bookings = {
        week: mine.filter(t => t >= now - 7 * DAY).length,
        prev: mine.filter(t => t < now - 7 * DAY && t >= now - 14 * DAY).length,
        prior4w: mine.filter(t => t < now - 7 * DAY).length,
      };
    }
    if (reviews !== null && c.bizId) {
      const rs = reviews.filter(r => r.business_id === c.bizId && (c.kind === 'business' || r.location_key === c.reviewKey));
      if (rs.length) {
        const month = new Date(now).toISOString().slice(0, 7);
        h.reviews = { month: rs.filter(r => String(r.review_date || '').slice(0, 7) === month).length,
          rating: Math.round(rs.reduce((a, r) => a + (Number(r.rating) || 0), 0) / rs.length * 10) / 10, total: rs.length };
      }
    }
    h.scores = c.scores || {};
    {
      const AREA_OF = { greenway: 'houston', golden: 'denver', 'fort worth': 'dallas-fort worth', arlington: 'dallas-fort worth', dallas: 'dallas-fort worth', okc: 'oklahoma city', 'los angeles': 'los angeles' };
      const want = c.kind === 'market' ? (AREA_OF[String(c.city || c.name || '').toLowerCase()] || String(c.city || c.name || '').toLowerCase()) : null;
      h.techs = (techRows || []).filter(t => c.kind === 'market' ? String(t.area?.name || '').toLowerCase() === want : t.business_id === c.bizId).map(t => String(t.name).split(' ')[0]);
      const chk = c.kind === 'market' ? ((markets || []).find(m => 'm:' + m.slug === key)?.settings?.launch_checklist || {}) : ((businesses || []).find(b => b.slug === key)?.settings?.launch_checklist || {});
      h.ads = !!chk.google_ads;
      h.listing = !!(c.gbpKey && GMB_LOCATIONS.some(l => l.key === c.gbpKey)) || !!chk.gbp_created;
      {
        const loc = (c.gbpKey && GMB_LOCATIONS.find(l => l.key === c.gbpKey))
          || (c.kind === 'business' ? (() => { const m = GMB_LOCATIONS.filter(l => l.business === c.slug); return m.length === 1 ? m[0] : null; })() : null);
        h.listing_url = (loc && (loc.mapsUrl || (loc.placeId ? 'https://www.google.com/maps/place/?q=place_id:' + loc.placeId : null))) || null;
        { const rc = loc && RANK_CITIES.find(x => x.listings.includes(loc.key)); h.rank = rc ? { city: rc.city, target: loc.key } : null; }
        if (loc) h.posts = (gbpPostRows || []).filter(x => x.location_key === loc.key).slice(0, 2).map(({ location_key, ...x }) => x);
      }
    }
    if (calls !== null && c.numbers.length) {
      const set = new Set(c.numbers);
      const ts = (calls || []).filter(x => set.has(last10(x.grasshopper_number)) && x.kind !== 'outbound').map(x => Date.parse(x.occurred_at));
      h.calls = { d7: ts.filter(t => t >= now - 7 * DAY).length, d30: ts.filter(t => t >= now - 30 * DAY).length };
    }
    if (reviews !== null && c.bizId) {
      const rs = reviews.filter(r => r.business_id === c.bizId && (c.kind === 'business' ? (!c.gbpKey || r.location_key === c.gbpKey) : r.location_key === c.reviewKey));
      const rt = rs.map(r => Date.parse(r.review_date)).filter(Boolean);
      h.reviewsNew = { d7: rt.filter(t => t >= now - 7 * DAY).length, d30: rt.filter(t => t >= now - 30 * DAY).length };
    }
    const g = c.gbpKey ? GMB_LOCATIONS.find(l => l.key === c.gbpKey) : null;
    if (g) {
      const since = (reviews || []).filter(r => r.location_key === g.key && g.statsVerified && String(r.review_date || '').slice(0, 10) > g.statsVerified).length;
      h.gbpReviews = (g.reviewCount || 0) + since;
    }
    out[key] = h;
  }
  return res.status(200).json({ health: out, at: new Date().toISOString() });
}

const LAUNCH_SNAPSHOT_KEEP = 5;
async function launchSnapshot(req, res, db, auth) {
  const joey = isLaunchJoey(auth);
  if (auth.role !== 'owner' && !joey) return res.status(403).json({ error: 'Owner only' });
  const { data: row, error } = await db.from('launch_snapshots')
    .select('id, rev, data, refreshed_at, refreshed_by').order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!row) return res.status(200).json({ snapshot: null });
  if (joey && row.data && row.data.status) {
    const st = row.data.status;
    row.data.status = { ...st, businesses: (st.businesses || []).map(b => ({ ...b, notes: '' })),
      markets: (st.markets || []).map(m => ({ ...m, notes: '' })), read_only: true };
  }
  return res.status(200).json({ snapshot: row });
}
async function launchSnapshotSave(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const data = body && body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'data is required' });
  if (JSON.stringify(data).length > 4000000) return res.status(413).json({ error: 'Snapshot too big' });
  const { data: row, error } = await db.from('launch_snapshots')
    .insert({ data, refreshed_by: auth.name || auth.role || null })
    .select('id, rev, refreshed_at, refreshed_by').single();
  if (error) throw error;
  const { data: old } = await db.from('launch_snapshots').select('id')
    .order('id', { ascending: false }).range(LAUNCH_SNAPSHOT_KEEP, LAUNCH_SNAPSHOT_KEEP + 100);
  if (old && old.length) await db.from('launch_snapshots').delete().in('id', old.map(r => r.id));
  return res.status(200).json({ ok: true, snapshot: row });
}
async function launchSnapshotPatch(db, fn) {
  for (let i = 0; i < 3; i++) {
    try {
      const { data: row, error } = await db.from('launch_snapshots')
        .select('id, rev, data').order('id', { ascending: false }).limit(1).maybeSingle();
      if (error || !row || !row.data) return;
      if (fn(row.data) === false) return;
      const rev = row.rev || 0;
      const { data: hit, error: e2 } = await db.from('launch_snapshots')
        .update({ data: row.data, rev: rev + 1 }).eq('id', row.id).eq('rev', rev).select('id');
      if (e2 || (hit && hit.length)) return;
    } catch (_) { return; }
  }
}
const launchSnapRow = (d, kind, id) => {
  const st = d && d.status; if (!st) return null;
  return ((kind === 'market' ? st.markets : st.businesses) || []).find(x => x && String(x.id) === String(id)) || null;
};
const launchSnapHealthTick = (d, key, item, value) => {
  const h = d && d.health && d.health[key]; if (!h) return;
  if (item === 'google_ads') h.ads = !!value;
  if (item === 'gbp_created' && value) h.listing = true;
};

const JOEY_LAUNCH_MARKETS = new Set(['arlington', 'tulsa-doms', 'okc-doms', 'denver-ha', 'houston-ha', 'austin-ha', 'la', 'fort-worth']);
const isLaunchJoey = (auth) => !!auth && auth.role === 'secretary' && auth.name === 'Joey';
async function launchStatus(req, res, db, auth) {
  const joey = isLaunchJoey(auth);
  if (auth.role !== 'owner' && !joey) return res.status(403).json({ error: 'Owner only' });
  const { data: businesses, error } = await db.from('businesses')
    .select('id, slug, name, url, support_phone, active, settings, created_at')
    .eq('active', true).order('created_at', { ascending: true });
  if (error) throw error;

  const markets = await launchMarketRows(db);

  const results = await Promise.all((businesses || []).filter(b => b.slug !== 'neverfailstvmounting').map(async (biz) => {
    let stripeWired = true, stripeReady = false;
    try { stripeReady = stripeConfigured(biz.slug); }
    catch (_) { stripeWired = false; }

    const emailWired = !!EMAIL_BRANDS[biz.slug];
    const emailReady = emailWired && !!emailConfig(biz.slug).apiKey;

    let site = { checked: false, ok: null, status: null, hasWidget: null, error: null };
    const assessmentUrl = launchAssessmentUrl(biz);
    const preview = isLaunchPreview(biz);
    if (assessmentUrl) {
      site.checked = true;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const t0 = Date.now();
        const r = await fetch(assessmentUrl, { signal: ctrl.signal, redirect: 'follow' });
        site.ms = Date.now() - t0;
        clearTimeout(t);
        site.status = r.status;
        site.ok = r.ok;
        const html = await r.text();
        site.hasWidget = html.includes('tidyhaus-booking.vercel.app/widget.js')
          && html.includes(`data-business="${biz.slug}"`);
        if ((preview || OWN_WIDGET_SLUGS.has(biz.slug)) && r.ok) {
          const bookingResponse = await fetch(assessmentUrl + '/book', { signal: AbortSignal.timeout(6000), redirect: 'follow' });
          site.hasWidget = bookingResponse.ok && previewHasWidget(await bookingResponse.text(), biz.slug);
        }
      } catch (e) {
        site.error = String((e && e.message) || e).slice(0, 120);
      }
    }

    const checklist = (biz.settings && biz.settings.launch_checklist) || {};
    const notes = (biz.settings && biz.settings.launch_notes) || '';

    return {
      id: biz.id, slug: biz.slug, name: biz.name, url: assessmentUrl, productionUrl: biz.url, previewUrl: preview ? assessmentUrl : null,
      phone: biz.support_phone || null, active: biz.active,
      created_at: biz.created_at, noMetrics: LAUNCH_NO_METRICS.has(biz.slug),
      stripe: { wired: stripeWired, ready: stripeReady },
      email: { wired: emailWired, ready: emailReady },
      site,
      checklist,
      notes,
    };
  }));

  if (joey) return res.status(200).json({
    items: LAUNCH_CHECKLIST_ITEMS, businesses: results.map(b => ({ ...b, notes: '' })),
    marketItems: MARKET_CHECKLIST_ITEMS, markets: markets.map(m => ({ ...m, notes: '' })), read_only: true,
  });
  return res.status(200).json({
    items: LAUNCH_CHECKLIST_ITEMS, businesses: results,
    marketItems: MARKET_CHECKLIST_ITEMS, markets,
  });
}

async function launchScoreSet(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const table = body.kind === 'market' ? 'markets' : 'businesses';
  const field = body.field === 'gbp' ? 'gbp' : 'website';
  const v = body.value === null || body.value === '' ? null : Math.round(Number(body.value));
  if (v !== null && !(v >= 1 && v <= 10)) return res.status(400).json({ error: 'Score must be 1-10' });
  const { data: row, error } = await db.from(table).select('id, settings').eq('slug', String(body.slug || '')).maybeSingle();
  if (error) throw error;
  if (!row) return res.status(404).json({ error: 'Not found' });
  const settings = row.settings || {};
  const scores = { ...(settings.launch_scores || {}), [field]: v };
  const { error: e2 } = await db.from(table).update({ settings: { ...settings, launch_scores: scores } }).eq('id', row.id);
  if (e2) throw e2;
  const cardKey = (body.kind === 'market' ? 'm:' : '') + String(body.slug || '');
  await launchSnapshotPatch(db, d => { const h = d.health && d.health[cardKey]; if (!h) return false; h.scores = scores; });
  return res.status(200).json({ ok: true, scores });
}
async function launchNotesSet(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const kind = body.kind === 'market' ? 'market' : 'business';
  const id = String(body.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required' });
  const notes = String(body.notes || '').slice(0, 5000);

  const table = kind === 'market' ? 'markets' : 'businesses';
  const { data: row, error: readErr } = await db.from(table).select('id, settings').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!row) return res.status(404).json({ error: `${kind === 'market' ? 'Market' : 'Business'} not found` });

  const settings = row.settings || {};
  const { error: writeErr } = await db.from(table)
    .update({ settings: { ...settings, launch_notes: notes }, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (writeErr) throw writeErr;
  await launchSnapshotPatch(db, d => { const r = launchSnapRow(d, kind, id); if (!r) return false; r.notes = notes; });

  return res.status(200).json({ ok: true, notes });
}

async function launchMarketChecklistSet(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const marketId = String(body.market_id || '').trim();
  const key = String(body.key || '').trim();
  if (!marketId || !MARKET_CHECKLIST_ITEMS.some(i => i.key === key)) {
    return res.status(400).json({ error: 'market_id and a known checklist key are required' });
  }
  const { data: m, error: readErr } = await db.from('markets').select('id, settings').eq('id', marketId).maybeSingle();
  if (readErr) throw readErr;
  if (!m) return res.status(404).json({ error: 'Market not found' });

  const settings = m.settings || {};
  const checklist = { ...(settings.launch_checklist || {}), [key]: !!body.value };
  const { error: writeErr } = await db.from('markets')
    .update({ settings: { ...settings, launch_checklist: checklist }, updated_at: new Date().toISOString() })
    .eq('id', marketId);
  if (writeErr) throw writeErr;
  await launchSnapshotPatch(db, d => { const r = launchSnapRow(d, 'market', marketId); if (!r) return false; r.checklist = checklist; launchSnapHealthTick(d, 'm:' + r.slug, key, body.value); });

  return res.status(200).json({ ok: true, checklist });
}

async function launchChecklistSet(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const bizId = String(body.business_id || '').trim();
  const key = String(body.key || '').trim();
  if (!bizId || !LAUNCH_CHECKLIST_ITEMS.some(i => i.key === key)) {
    return res.status(400).json({ error: 'business_id and a known checklist key are required' });
  }
  const { data: biz, error: readErr } = await db.from('businesses').select('id, settings').eq('id', bizId).maybeSingle();
  if (readErr) throw readErr;
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  const settings = biz.settings || {};
  const checklist = { ...(settings.launch_checklist || {}), [key]: !!body.value };
  const { error: writeErr } = await db.from('businesses')
    .update({ settings: { ...settings, launch_checklist: checklist }, updated_at: new Date().toISOString() })
    .eq('id', bizId);
  if (writeErr) throw writeErr;
  await launchSnapshotPatch(db, d => { const r = launchSnapRow(d, 'business', bizId); if (!r) return false; r.checklist = checklist; launchSnapHealthTick(d, r.slug, key, body.value); });

  return res.status(200).json({ ok: true, checklist });
}

const COUPON_MAX = 500;
async function couponsList(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data, error } = await db.from('coupons')
    .select('id, code, amount, active, note, expires_on, created_at')
    .eq('business_id', biz.id).order('code');
  if (error) {
    if (/coupons/.test(error.message || '')) return res.status(200).json({ coupons: [], usage: {} });
    throw error;
  }
  const usage = {};
  try {
    const { data: lis } = await db.from('booking_line_items')
      .select('name, line_total, booking_id, created_at')
      .eq('business_id', biz.id).ilike('name', 'coupon%')
      .limit(20000);
    const ids = [...new Set((lis || []).map(l => l.booking_id).filter(Boolean))];
    const cancelled = new Set();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: bk } = await db.from('bookings')
        .select('id, status').in('id', ids.slice(i, i + 200)).eq('status', 'cancelled');
      for (const b of bk || []) cancelled.add(b.id);
    }
    for (const li of lis || []) {
      if (li.booking_id && cancelled.has(li.booking_id)) continue;
      const m = String(li.name || '').match(/^coupon\s+([A-Z0-9_-]+)/i);
      if (!m) continue;
      const k = m[1].toUpperCase();
      const u = usage[k] || (usage[k] = { count: 0, total: 0, last: null });
      u.count++;
      u.total += Math.abs(Number(li.line_total) || 0);
      if (li.created_at && (!u.last || li.created_at > u.last)) u.last = li.created_at;
    }
  } catch { /* usage is a nice-to-have; never fail the list over it */ }
  return res.status(200).json({ coupons: data || [], usage });
}
async function couponsSave(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change coupons' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }

  const code = String(body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'A code is required' });
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    return res.status(400).json({ error: 'Codes can only use letters, numbers, dashes and underscores (2-32 characters) — a code with a space or symbol cannot be typed reliably by a customer.' });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Amount must be $0 or more' });
  if (amount > COUPON_MAX) return res.status(400).json({ error: `$${amount} is above the $${COUPON_MAX} sanity ceiling for a coupon — double-check this isn't a typo.` });

  const patch = {
    business_id: biz.id, code, amount,
    active: body.active !== false,
    note: body.note ? String(body.note).slice(0, 200) : null,
    expires_on: body.expires_on || null,
    updated_at: new Date().toISOString(),
  };
  let out;
  if (body.id) {
    const { data, error } = await db.from('coupons').update(patch)
      .eq('id', body.id).eq('business_id', biz.id).select('id').maybeSingle();
    if (error) {
      if (/duplicate key|unique/i.test(error.message || '')) return res.status(409).json({ error: `${code} already exists for this business.` });
      throw error;
    }
    out = data;
  } else {
    const { data, error } = await db.from('coupons').insert(patch).select('id').maybeSingle();
    if (error) {
      if (/duplicate key|unique/i.test(error.message || '')) return res.status(409).json({ error: `${code} already exists for this business.` });
      throw error;
    }
    out = data;
  }
  couponCacheClear(biz.slug);
  return res.status(200).json({ ok: true, id: out?.id || null });
}
async function couponsDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change coupons' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('coupons').delete().eq('id', body.id).eq('business_id', biz.id);
  if (error) throw error;
  couponCacheClear(biz.slug);
  return res.status(200).json({ ok: true });
}

const TV_OPTION_GROUPS = [
  { key: 'size',      label: 'TV Size',                       min: 1, max: 1, sort: 1, options: [
    { label: '32" or Less', price: 99,  zbk: '1685657519214x408615950244710660', sort: 1 },
    { label: '33"–59"',     price: 109, zbk: '1685657519214x406129807645840830', sort: 2 },
    { label: '60"–69"',     price: 119, zbk: '1685657519214x241977595988204900', sort: 3 },
    { label: '70"–85"',     price: 149, zbk: '1685657519214x168809705059288930', sort: 4 },
    { label: '86"–97"',     price: 179, zbk: '1693451324278x246099356920840200', sort: 5 },
    { label: '98"+',        price: 229, zbk: '1729566606709x280549383678984200', sort: 6 },
  ]},
  { key: 'bracket',   label: 'Bracket',                       min: 0, max: 1, sort: 2, options: [
    { label: 'I have my own bracket',                 price: 0,   zbk: '1685657519638x296785870103780400', sort: 1 },
    { label: 'Flat',                                  price: 45,  zbk: '1685657519638x151782031594280160', sort: 2 },
    { label: 'Tilting (recommended)',                 price: 60,  zbk: '1685657519638x293251872070913660', sort: 3 },
    { label: 'Full Motion',                           price: 110, zbk: '1685657519638x327788739524076600', sort: 4 },
    { label: '85"-100" TV Flat Bracket',              price: 90,  zbk: '1776229587207x710284994703786000', sort: 5 },
    { label: '85"-100" TV Tilting Bracket',           price: 110, zbk: '1776229598255x578976769128267800', sort: 6 },
    { label: '85"-100" TV Full Motion Bracket',       price: 190, zbk: '1776229610718x521138691917742100', sort: 7 },
    { label: 'Samsung Frame TV bracket (box included)', price: 25, zbk: '1736123941131x483930420018151400', sort: 8 },
  ]},
  { key: 'fireplace', label: 'Fireplace',                     min: 0, max: 1, sort: 3, options: [
    { label: 'TV NOT above a fireplace', price: 0,  zbk: '1690749164365x391343451869544450', sort: 1 },
    { label: 'TV above a fireplace',     price: 30, zbk: '1690749240392x103535038030413820', sort: 2 },
  ]},
  { key: 'surface',   label: 'Wall Surface',                  min: 0, max: 1, sort: 4, options: [
    { label: 'Drywall',             price: 0,  zbk: '1685657520672x628368921210809000', sort: 1 },
    { label: 'Brick',               price: 35, zbk: '1685657520672x962594124305617300', sort: 2 },
    { label: 'Uneven Stone or Tile', price: 50, zbk: '1685658012495x711713122836807700', sort: 3 },
    { label: 'Outdoor/Stucco',      price: 45, zbk: '1692765788131x467716510198005800', sort: 4 },
  ]},
  { key: 'wires',     label: 'Wire Hiding',                   min: 0, max: 1, sort: 5, options: [
    { label: 'Hide wires BEHIND the wall',  price: 75, zbk: '1685657520215x679178310990983400', sort: 1 },
    { label: 'Hide wires OUTSIDE the wall', price: 25, zbk: '1685657520215x860675929308834800', sort: 2 },
    { label: 'Wall already has plug behind TV', price: 0, zbk: '1685657520215x846697647726538900', sort: 3 },
    { label: 'Wires hang under the TV',     price: 0,  zbk: '1696472636219x934279187941818400', sort: 4 },
  ]},
  { key: 'lifting',   label: 'Second Cleaner (Large TVs)', min: 0, max: 1, sort: 6, options: [
    { label: 'TV under 70" (no lifting fee)',        price: 0,  zbk: '1685657521270x971699776821509000', sort: 1 },
    { label: '70–85" — customer can help lift',      price: 0,  zbk: '1685657521270x242389337506608420', sort: 2 },
    { label: '2 technicians',                        price: 70, zbk: '1685657521270x264421370121691100', sort: 3 },
    { label: '85"+ (second cleaner required)',    price: 70, zbk: '1747842781494x315473919196528640', sort: 4 },
  ]},
  { key: 'dismount',  label: 'Dismount',                      min: 0, max: 1, sort: 7, options: [
    { label: 'Guaranteed Dismount Service (when upgrading later)', price: 35, zbk: '1685657521717x559414519649398460', sort: 1 },
    { label: "No — I'll handle removal myself",      price: 0,  zbk: '1751646796269x538012740525228000', sort: 2 },
  ]},
  { key: 'extras',    label: 'Add-ons',                       min: 0, max: 0, sort: 8, options: [
    { label: 'Install Samsung Frame OneConnect box behind TV', price: 350, zbk: '1736124404151x401859929508413400', sort: 1 },
    { label: 'Apple TV installation (mounting bracket included)', price: 25, zbk: '1711776157524x348981049297469440', sort: 2 },
    { label: 'Soundbar Installation', price: 50, zbk: '1698905037955x771952325080383500', sort: 3 },
    { label: 'Install shelf under TV', price: 45, zbk: '1698905090848x173584167038615550', sort: 4 },
    { label: 'LED Lights',            price: 50, zbk: '1698905111338x528324964985864200', sort: 5 },
    { label: '1 hour of Handyman Labor', price: 85, zbk: '1715820772054x920882061736149000', sort: 6 },
    { label: 'Other',                 price: 0,  zbk: '1698905159794x117137493532868600', sort: 7 },
  ]},
];

async function seedTvOptions(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }

  let { data: svc } = await db.from('services')
    .select('id, name, category').eq('business_id', biz.id).eq('name', 'TV Installation').maybeSingle();
  if (!svc) {
    const { data: byCat } = await db.from('services')
      .select('id, name, category').eq('business_id', biz.id).eq('category', 'Home Cleaning').limit(1);
    svc = (byCat && byCat[0]) || null;
  }
  if (!svc) { const e = new Error('TV Installation service not found for this business'); e.status = 404; throw e; }

  const report = { service: svc.name, groups_created: [], groups_existing: [], options_created: 0, options_existing: 0 };

  const { data: existingGroups } = await db.from('service_option_groups')
    .select('id, key').eq('business_id', biz.id).eq('service_id', svc.id);
  const groupByKey = {};
  for (const g of (existingGroups || [])) groupByKey[g.key] = g.id;

  for (const g of TV_OPTION_GROUPS) {
    let groupId = groupByKey[g.key];
    if (groupId) {
      report.groups_existing.push(g.key);
    } else {
      const { data: inserted, error: gErr } = await db.from('service_option_groups')
        .insert({ business_id: biz.id, service_id: svc.id, key: g.key, label: g.label,
                  min_select: g.min, max_select: g.max, sort_order: g.sort })
        .select('id').single();
      if (gErr) throw gErr;
      groupId = inserted.id;
      report.groups_created.push(g.key);
    }

    const { data: existingOpts } = await db.from('service_options')
      .select('id, zenbooker_option_id').eq('business_id', biz.id).eq('group_id', groupId);
    const haveZbk = new Set((existingOpts || []).map(o => o.zenbooker_option_id));

    const toInsert = g.options.filter(o => !haveZbk.has(o.zbk)).map(o => ({
      business_id: biz.id, group_id: groupId, label: o.label, price: o.price,
      zenbooker_option_id: o.zbk, sort_order: o.sort, active: true,
    }));
    report.options_existing += g.options.length - toInsert.length;
    if (toInsert.length) {
      const { error: oErr } = await db.from('service_options').insert(toInsert);
      if (oErr) throw oErr;
      report.options_created += toInsert.length;
    }
  }

  return res.status(200).json({ ok: true, ...report });
}

function targetSizeLabel(label) {
  const nums = (label.match(/\d+/g) || []).map(Number);
  if (nums.includes(70) && nums.includes(84)) return '70"–85"';
  if (nums.includes(85) && nums.includes(97)) return '86"–97"';
  if (/plus/i.test(label) && nums.includes(98)) return '98"+';
  return null;
}
async function relabelTvSize(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data: svcs } = await db.from('services')
    .select('id, name, category').eq('business_id', biz.id);
  const tvSvcIds = (svcs || [])
    .filter(s => /tv/i.test(s.name || '') || /tv mounting/i.test(s.category || ''))
    .map(s => s.id);
  if (!tvSvcIds.length) return res.status(200).json({ ok: true, updated: 0 });
  const { data: groups } = await db.from('service_option_groups')
    .select('id').eq('business_id', biz.id).in('service_id', tvSvcIds).eq('key', 'size');
  const gids = (groups || []).map(g => g.id);
  if (!gids.length) return res.status(200).json({ ok: true, updated: 0 });
  const { data: opts } = await db.from('service_options')
    .select('id, label').eq('business_id', biz.id).in('group_id', gids);
  let updated = 0;
  for (const o of (opts || [])) {
    const t = targetSizeLabel(o.label);
    if (t && t !== o.label) {
      const { error } = await db.from('service_options').update({ label: t }).eq('id', o.id);
      if (!error) updated++;
    }
  }
  return res.status(200).json({ ok: true, updated });
}

async function availableSlots(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const dateStr = (req.query.date || '').toString();
  const techId = (req.query.technician_id || '').toString();
  const techId2 = (req.query.secondary_technician_id || '').toString();
  const postalCode = (req.query.postal_code || '').toString().trim();
  if (!dateStr) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });

  const dow = dayOfWeekFor(dateStr);
  const bookingAreaId = await serviceAreaIdFromPostal(db, biz.id, postalCode);
  const tz = await areaTimezone(db, bookingAreaId, biz.timezone || 'Asia/Manila');
  if (dateStr < localDateStr(tz, new Date().toISOString())) {
    return res.status(200).json({ slots: [], date: dateStr, day_of_week: dow, timezone: tz });
  }
  const scopesPrimary = await rosterScopes(db, biz, (req.query.pool || '').toString(), postalCode, bookingAreaId);
  const wantPair = !!techId2 && !(techId2 === techId && techId2 !== 'any');
  const primaryAny = !techId || techId === 'any';
  const allowOwnHelper = wantPair && techId2 === 'any' && ['1', 'true'].includes(String(req.query.needs_lifting));

  const [rosterState, scopesSecondary] = await Promise.all([
    rosterSlotState(db, scopesPrimary, dateStr, dow, tz)
      .catch(e => { console.warn('[available_slots] roster/slot-state lookup failed:', e.message); return null; }),
    wantPair ? ((req.query.pool2 || '') === (req.query.pool || '') ? Promise.resolve(scopesPrimary)
      : rosterScopes(db, biz, (req.query.pool2 || '').toString(), postalCode, bookingAreaId)) : Promise.resolve(null),
  ]);
  const primaryRSS = rosterState && req.query.strict_roster === '1'
    ? {...rosterState, techs:rosterState.techs.filter(t=>t.status!=='off')} : rosterState;

  if (req.query.strict_roster === '1' && !primaryRSS) throw new Error('Could not check the cleaner roster. Please retry.');
  const primaryState = primaryRSS && (primaryAny || primaryRSS.state.has(techId) || req.query.strict_roster === '1')
    ? { ...primaryRSS, techs: primaryRSS.techs.filter(t => primaryAny || t.id === techId) } : null;

  let keys;
  if (!wantPair) {
    keys = primaryState ? freeKeysFromState(primaryState)
      : await availableSlotKeys(db, scopesPrimary, techId, dateStr, dow, tz);
  } else {
    const [pMap, sMap] = await Promise.all([
      primaryState ? Promise.resolve(freeMapFromState(primaryState))
        : freeSlotTechMap(db, scopesPrimary, techId, dateStr, dow, tz),
      primaryRSS && scopesSecondary === scopesPrimary && techId2 === 'any'
        ? Promise.resolve(freeMapFromState({ ...primaryRSS, techs: primaryRSS.techs.filter(t => !isSecondaryIneligibleName(t.name)) }))
        : freeSlotTechMap(db, scopesSecondary, techId2, dateStr, dow, tz, true),
    ]);
    keys = new Set();
    for (const [k, P] of pMap) {
      const S = sMap.get(k);
      if (!S || !S.size) continue;
      if (new Set([...P, ...S]).size >= 2) keys.add(k);
    }
    if (allowOwnHelper) {
      const ownHelperState = primaryRSS || await rosterSlotState(db, scopesPrimary, dateStr, dow, tz);
      for (const key of freeKeysFromState({ ...ownHelperState, techs: ownHelperState.techs.filter(t => (primaryAny || t.id === techId) && bringsOwnSecondTech(t.name)) })) keys.add(key);
    }
  }
  const nowISO = new Date().toISOString();
  const isToday = dateStr === localDateStr(tz, nowISO);
  const nowHHMM = isToday ? localHHMM(tz, nowISO) : null;
  let freeTechsByKey = {};
  if (primaryRSS) {
    freeTechsByKey = freeTechsByKeyFromState(primaryRSS);
  } else {
    try { freeTechsByKey = freeTechsByKeyFromState(await rosterSlotState(db, scopesPrimary, dateStr, dow, tz)); }
    catch (e) { console.warn('[available_slots] free-techs lookup failed:', e.message); }
  }
  const rec = await recommendedSlots(db);
  const available = SLOTS.filter(s => keys.has(s.key))
    .filter(s => !isToday || s.start > nowHHMM)
    .map(s => ({ slot_key: s.key, label: s.label, start: s.start, end: s.end, free_techs: freeTechsByKey[s.key] || [], recommended: isRecommended(rec, dow, s.key) }));
  return res.status(200).json({ slots: available, date: dateStr, day_of_week: dow, timezone: tz, recommended: rec });
}

function localHHMM(tz, instantISO) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(instantISO)).reduce((a, x) => (a[x.type] = x.value, a), {});
  let hh = p.hour === '24' ? '00' : p.hour;
  return `${hh}:${p.minute}`;
}
async function photoBonus(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!(amount > 0 && amount <= 500)) return res.status(400).json({ error: 'Amount must be $1-$500' });
  const { data: ph, error } = await db.from('booking_photos')
    .select('id, url, technician_id, business_id, booking_id, booking:bookings ( technician_id )').eq('id', body.photo_id).maybeSingle();
  if (error) throw error;
  if (!ph) return res.status(404).json({ error: 'Photo not found' });
  const techId = ph.technician_id || ph.booking?.technician_id;
  if (!techId) return res.status(400).json({ error: 'No cleaner on this photo' });
  const { data: t } = await db.from('technicians').select('business_id, business:businesses ( timezone )').eq('id', techId).maybeSingle();
  const tz = t?.business?.timezone || 'Asia/Manila';
  if (ph.booking_id) {
    const { data: sib } = await db.from('booking_photos').select('id').eq('booking_id', ph.booking_id);
    const ids = (sib || []).map(x => x.id);
    if (ids.length) {
      const { data: dup } = await db.from('tech_bonuses').select('id').in('photo_id', ids).eq('technician_id', techId).limit(1);
      if (dup && dup.length) return res.status(409).json({ error: 'Bonus already given for this job' });
    }
  }
  const money = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const { data: row, error: e2 } = await db.from('tech_bonuses').insert({
    business_id: t?.business_id || ph.business_id, technician_id: techId, amount,
    reason: 'Photo bonus', message: `You were paid $${money} for this picture!`,
    awarded_on: localDateStr(tz, new Date().toISOString()), photo_url: ph.url, photo_id: ph.id,
  }).select('id').single();
  if (e2) throw e2;
  return res.status(200).json({ ok: true, id: row.id });
}

function localDateStr(tz, instantISO) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(instantISO));
}
function greetName(s) { const n = capName(s); return n && !/\d/.test(n) ? n : ''; }
function slotKeyForLocalTime(hhmm) {
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const t = toMin(hhmm);
  for (const s of SLOTS) if (t >= toMin(s.start) && t < toMin(s.end)) return s.key;
  for (const s of SLOTS) if (toMin(s.start) === t) return s.key;
  return null;
}
async function bookedSlotKeysForTech(db, bizId, techId, dateStr, tz, excludeId = null) {
  if (!techId || !dateStr) return new Set();
  const dayStart = localDateStartUTC(tz, dateStr);
  const dayEnd = localDateStartUTC(tz, addDaysStr(dateStr, 1));
  const run = (withSecond) => {
    let q = db.from('bookings')
      .select(`id, scheduled_at${esCol()}`)
      .neq('status', 'cancelled')
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', dayStart.toISOString())
      .lt('scheduled_at', dayEnd.toISOString());
    q = withSecond
      ? q.or(`technician_id.eq.${techId},secondary_technician_id.eq.${techId}`)
      : q.eq('technician_id', techId);
    if (excludeId) q = q.neq('id', excludeId);
    return q;
  };
  let { data, error } = await run(bookingLiftCols);
  if (['42703', 'PGRST204'].includes(error?.code) && ['secondary_technician_id', 'extra_slots'].includes(missingColumn(error.message))) {
    if (missingColumn(error.message) === 'secondary_technician_id') bookingLiftCols = false;
    if (missingColumn(error.message) === 'extra_slots') extraSlotsCol = false;
    ({ data, error } = await run(bookingLiftCols));
  }
  if (error) throw error;
  const taken = new Set();
  for (const b of (data || [])) {
    const key = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
    if (key) taken.add(key);
    for (const sk of esOf(b)) taken.add(sk);
  }
  return taken;
}

async function batchTechSlotState(db, techIds, dateStr, dow, tz) {
  const out = new Map(); techIds.forEach(id => out.set(id, { keys: new Set(), booked: new Set() }));
  if (!techIds.length) return out;
  const dayStart = localDateStartUTC(tz, dateStr).toISOString();
  const dayEnd = localDateStartUTC(tz, addDaysStr(dateStr, 1)).toISOString();
  const idList = techIds.join(',');
  const run = (withSecond) => {
    let q = db.from('bookings')
      .select(`id, technician_id${withSecond ? ', secondary_technician_id' : ''}, scheduled_at${esCol()}`)
      .neq('status', 'cancelled').not('scheduled_at', 'is', null)
      .gte('scheduled_at', dayStart).lt('scheduled_at', dayEnd);
    return withSecond
      ? q.or(`technician_id.in.(${idList}),secondary_technician_id.in.(${idList})`)
      : q.in('technician_id', techIds);
  };
  const [avR, excR, data] = await Promise.all([
    db.from('technician_availability').select('technician_id, slot_key').in('technician_id', techIds).eq('day_of_week', dow),
    db.from('technician_availability_exceptions').select('technician_id, slot_key, is_available').in('technician_id', techIds).eq('exception_date', dateStr),
    (async () => {
      let { data, error } = await run(bookingLiftCols);
      if (['42703', 'PGRST204'].includes(error?.code) && ['secondary_technician_id', 'extra_slots'].includes(missingColumn(error.message))) {
        if (missingColumn(error.message) === 'secondary_technician_id') bookingLiftCols = false;
        if (missingColumn(error.message) === 'extra_slots') extraSlotsCol = false;
        ({ data, error } = await run(bookingLiftCols));
      }
      if (error) throw error;
      return data;
    })(),
  ]);
  if (avR.error) throw avR.error;
  if (excR.error) throw excR.error;
  for (const r of (avR.data || [])) { const s = out.get(r.technician_id); if (s) s.keys.add(r.slot_key); }
  for (const e of (excR.data || [])) { const s = out.get(e.technician_id); if (!s) continue; if (e.is_available) s.keys.add(e.slot_key); else s.keys.delete(e.slot_key); }
  for (const b of (data || [])) {
    const key = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
    for (const tid of [b.technician_id, b.secondary_technician_id]) {
      const s = tid ? out.get(tid) : null; if (!s) continue;
      if (key) s.booked.add(key);
      for (const sk of esOf(b)) s.booked.add(sk);
    }
  }
  return out;
}

async function rosterSlotState(db, scopes, dateStr, dow, tz) {
  const lists = await scopedRosterTechs(db, scopes, 'id, name, color, status');
  const techs = lists.flat();
  const state = await batchTechSlotState(db, techs.map(t => t.id), dateStr, dow, tz);
  return { techs, state };
}
function freeKeysFromState({ techs, state }) {
  const keys = new Set();
  for (const t of techs) {
    const s = state.get(t.id); if (!s) continue;
    for (const k of s.keys) if (!s.booked.has(k)) keys.add(k);
  }
  return keys;
}
function freeMapFromState({ techs, state }) {
  const map = new Map();
  for (const t of techs) {
    const s = state.get(t.id); if (!s) continue;
    for (const k of s.keys) {
      if (s.booked.has(k)) continue;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k).add(t.id);
    }
  }
  return map;
}
function freeTechsByKeyFromState({ techs, state }) {
  const byKey = {};
  for (const t of techs) {
    const s = state.get(t.id);
    if (!s) continue;
    for (const k of s.keys) {
      if (s.booked.has(k)) continue;
      (byKey[k] || (byKey[k] = [])).push({ id: t.id, name: t.name, color: t.color || null });
    }
  }
  return byKey;
}

function normalizeRosterScopes(bizIdOrScopes) {
  const arr = Array.isArray(bizIdOrScopes) ? bizIdOrScopes : [bizIdOrScopes];
  return arr.filter(Boolean).map(s => (typeof s === 'object' ? s : { bizId: s, serviceAreaId: null }));
}
async function scopedRosterTechs(db, scopes, cols = 'id') {
  return Promise.all(normalizeRosterScopes(scopes).filter(sc => sc.serviceAreaId).map(async sc => {
    const { data, error } = await db.from('technicians').select(cols)
      .eq('business_id', sc.bizId).eq('active', true).eq('service_area_id', sc.serviceAreaId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return filterTechsByZip(db, sc.soleTechOf ? applySoleTech(sc.soleTechOf, data || []) : (data || []), sc.zip && zip5(sc.zip));
  }));
}

async function availableSlotKeys(db, bizIdOrScopes, techId, dateStr, dow, tz, excludeTechId = null) {
  if (!techId || techId === 'any') {
    const lists = await scopedRosterTechs(db, bizIdOrScopes);
    const ids = lists.flat().map(t => t.id).filter(id => !excludeTechId || id !== excludeTechId);
    const state = await batchTechSlotState(db, ids, dateStr, dow, tz);
    const union = new Set();
    for (const [, s] of state) s.keys.forEach(k => { if (!s.booked.has(k)) union.add(k); });
    return union;
  }
  const ks = await singleTechSlotKeys(db, techId, dateStr, dow);
  const booked = await bookedSlotKeysForTech(db, null, techId, dateStr, tz);
  booked.forEach(k => ks.delete(k));
  return ks;
}

async function freeSlotTechMap(db, bizIdOrScopes, techId, dateStr, dow, tz, excludeIneligibleSecondary = false) {
  let techIds;
  if (!techId || techId === 'any') {
    const lists = await scopedRosterTechs(db, bizIdOrScopes, 'id, name');
    let pool = lists.flat();
    if (excludeIneligibleSecondary) pool = pool.filter(t => !isSecondaryIneligibleName(t.name));
    techIds = pool.map(t => t.id);
  } else {
    techIds = [techId];
  }
  const state = await batchTechSlotState(db, techIds, dateStr, dow, tz);
  const map = new Map();
  for (const [tid, s] of state) {
    for (const k of s.keys) {
      if (s.booked.has(k)) continue;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k).add(tid);
    }
  }
  return map;
}

async function pickAvailableTech(db, bizIdOrScopes, dateStr, slotKey, tz, excludeTechId = null, excludeIneligibleSecondary = false, strict = false, eligibleOnly = false) {
  const rawLists = await scopedRosterTechs(db, bizIdOrScopes, 'id, name, status');
  const scopeLists = rawLists.map(techs => {
    let list = techs.filter(t => (!excludeTechId || t.id !== excludeTechId) && (!eligibleOnly || t.status !== 'off'));
    if (excludeIneligibleSecondary) list = list.filter(t => !isSecondaryIneligibleName(t.name));
    return list;
  });
  if (!scopeLists.some(l => l.length)) return null;
  if (dateStr && slotKey) {
    const dow = dayOfWeekFor(dateStr);
    const state = await batchTechSlotState(db, [...new Set(scopeLists.flat().map(t => t.id))], dateStr, dow, tz);
    for (const list of scopeLists) {
      for (const t of list) {
        const s = state.get(t.id);
        if (s?.keys.has(slotKey) && !s.booked.has(slotKey)) return t.id;
      }
    }
    if (!strict) {
      for (const list of scopeLists) {
        for (const t of list) {
          const s = state.get(t.id);
          if (s && !s.booked.has(slotKey)) return t.id;
        }
      }
    }
    return null;
  }
  return null;
}

async function pickAvailableTechPair(db, scopesPrimary, scopesSecondary, dateStr, slotKey, tz, eligibleOnly = false) {
  if (!dateStr || !slotKey) return { primaryId: null, secondaryId: null };
  const dow = dayOfWeekFor(dateStr);
  const primaryP = scopedRosterTechs(db, scopesPrimary, 'id, name, status');
  const sameScopes = JSON.stringify(scopesPrimary) === JSON.stringify(scopesSecondary);
  const [primary, secondary] = await Promise.all([
    primaryP, sameScopes ? primaryP : scopedRosterTechs(db, scopesSecondary, 'id, name, status'),
  ]);
  const pTechs = primary.flat().filter(t => !eligibleOnly || t.status !== 'off');
  const sTechs = secondary.flat().filter(t => (!eligibleOnly || t.status !== 'off') && !isSecondaryIneligibleName(t.name));
  const ids = [...new Set([...pTechs, ...sTechs].map(t => t.id))];
  const state = await batchTechSlotState(db, ids, dateStr, dow, tz);
  const free = t => state.get(t.id)?.keys.has(slotKey) && !state.get(t.id).booked.has(slotKey);
  const pSet = new Set(pTechs.filter(free).map(t => t.id));
  const sSet = new Set(sTechs.filter(free).map(t => t.id));
  for (const p of pSet) {
    for (const s of sSet) {
      if (s !== p) return { primaryId: p, secondaryId: s };
    }
  }
  return { primaryId: null, secondaryId: null };
}

async function pickOwnHelperPrimary(db, scopes, dateStr, slotKey, tz, eligibleOnly = false) {
  const { techs, state } = await rosterSlotState(db, scopes, dateStr, dayOfWeekFor(dateStr), tz);
  return techs.find(tech => (!eligibleOnly || tech.status !== 'off') && bringsOwnSecondTech(tech.name) && state.get(tech.id)?.keys.has(slotKey) && !state.get(tech.id)?.booked.has(slotKey))?.id || null;
}

async function pickScheduledSecondary(db, scopes, dateStr, slotKey, tz, excludeTechId = null) {
  if (!dateStr || !slotKey) return null;
  return pickAvailableTech(db, scopes, dateStr, slotKey, tz, excludeTechId, true, true);
}

async function resolveDefaultSecondary(db, biz, postalCode, dateStr, slotKey, tz, primaryTechId, pool2, eligibleOnly = false) {
  const partner = !eligibleOnly ? await partnerBusiness(db, biz.slug) : null;
  if (biz.slug === 'doms' && partner) {
    const [haArea, ownArea] = await Promise.all([
      serviceAreaIdFromPostal(db, partner.id, postalCode), serviceAreaIdFromPostal(db, biz.id, postalCode),
    ]);
    return await pickScheduledSecondary(db, [
      { bizId: partner.id, serviceAreaId: haArea, zip: postalCode },
      { bizId: biz.id,     serviceAreaId: ownArea, zip: postalCode },
    ], dateStr, slotKey, tz, primaryTechId);
  }
  const scopes2 = await rosterScopes(db, biz, (pool2 || '').toString(), postalCode);
  return await pickAvailableTech(db, scopes2, dateStr, slotKey, tz, primaryTechId, true, true, eligibleOnly);
}

async function singleTechSlotKeys(db, techId, dateStr, dow) {
  const { data: av, error: avErr } = await db.from('technician_availability')
    .select('slot_key').eq('technician_id', techId).eq('day_of_week', dow);
  if (avErr) throw avErr;
  const slots = new Set((av || []).map(x => x.slot_key));
  const { data: exc, error: excErr } = await db.from('technician_availability_exceptions')
    .select('slot_key, is_available').eq('technician_id', techId).eq('exception_date', dateStr);
  if (excErr) throw excErr;
  for (const e of (exc || [])) {
    if (e.is_available) slots.add(e.slot_key); else slots.delete(e.slot_key);
  }
  return slots;
}

async function availableDates(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const month = (req.query.month || '').toString();
  const techId = (req.query.technician_id || '').toString();
  const techId2 = (req.query.secondary_technician_id || '').toString();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month required (YYYY-MM)' });
  const includeSlots = req.query.include_slots === '1';

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const postalCode = (req.query.postal_code || '').toString();
  const bookingAreaIdEarly = await serviceAreaIdFromPostal(db, biz.id, postalCode);
  const rosterCache = new Map();
  const rosterList = (pool) => {
    if (!rosterCache.has(pool)) rosterCache.set(pool, (async () => {
      const scopes = await rosterScopes(db, biz, pool, postalCode, bookingAreaIdEarly);
      const roster = (await scopedRosterTechs(db, scopes, 'id, name, status')).flat();
      return req.query.strict_roster === '1' ? roster.filter(t=>t.status!=='off') : roster;
    })());
    return rosterCache.get(pool);
  };
  const [tz, primaryRoster] = await Promise.all([
    areaTimezone(db, bookingAreaIdEarly, biz.timezone || 'Asia/Manila'),
    !techId || techId === 'any' || includeSlots || req.query.strict_roster === '1' || req.query.needs_lifting
      ? rosterList((req.query.pool || '').toString()) : [],
  ]);
  const nowISO = new Date().toISOString();
  const todayStr = localDateStr(tz, nowISO), nowHHMM = localHHMM(tz, nowISO);
  const primaryIds = (techId && techId !== 'any')
    ? (req.query.strict_roster === '1' && !primaryRoster.some(t => t.id === techId) ? [] : [techId])
    : primaryRoster.map(t => t.id);
  const wantPair = !!techId2 && !(techId2 === techId && techId2 !== 'any');
  const allowOwnHelper = wantPair && techId2 === 'any' && ['1', 'true'].includes(String(req.query.needs_lifting));
  const ownHelperIds = allowOwnHelper ? primaryRoster.filter(t => primaryIds.includes(t.id) && bringsOwnSecondTech(t.name)).map(t => t.id) : [];
  let secondaryIds = [];
  if (wantPair) {
    secondaryIds = (techId2 && techId2 !== 'any')
      ? [techId2]
      : (await rosterList((req.query.pool2 || '').toString())).filter(t => !isSecondaryIneligibleName(t.name)).map(t => t.id);
  }
  if (!primaryIds.length || (wantPair && !secondaryIds.length && !ownHelperIds.length)) {
    let reason = 'no_roster', areaName = null, unstaffed = false;
    if (postalCode) {
      if (!bookingAreaIdEarly) reason = 'zip_not_covered';
      else {
        const { data: sa, error } = await db.from('service_areas')
          .select('name, unstaffed').eq('id', bookingAreaIdEarly).maybeSingle();
        if (error) throw error;
        areaName = sa?.name || null;
        unstaffed = !!sa?.unstaffed;
        reason = unstaffed ? 'area_unstaffed' : 'no_techs_in_area';
      }
    }
    if (req.query.strict_roster === '1' && techId && techId !== 'any' && !primaryIds.length) reason = 'technician_unavailable';
    return res.status(200).json({ dates: [], month, reason, area: areaName, unstaffed, timezone: tz,
      ...(includeSlots ? { slots_by_date: {}, technicians: primaryRoster } : {}) });
  }
  const techIds = [...new Set([...primaryIds, ...secondaryIds])];

  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const winStart = localDateStartUTC(tz, monthStart);
  const winEnd = localDateStartUTC(tz, addDaysStr(monthEnd, 1));
  const tidList = techIds.join(',');
  const runBk = (withSecond) => {
    let q = db.from('bookings')
      .select((withSecond ? 'technician_id, secondary_technician_id, scheduled_at' : 'technician_id, scheduled_at') + esCol())
      .neq('status', 'cancelled').not('scheduled_at', 'is', null)
      .gte('scheduled_at', winStart.toISOString()).lt('scheduled_at', winEnd.toISOString());
    return withSecond
      ? q.or(`technician_id.in.(${tidList}),secondary_technician_id.in.(${tidList})`)
      : q.in('technician_id', techIds);
  };
  const [avResult, excResult, bkResult] = await Promise.all([
    db.from('technician_availability').select('technician_id, day_of_week, slot_key').in('technician_id', techIds),
    db.from('technician_availability_exceptions')
      .select('technician_id, exception_date, slot_key, is_available')
      .in('technician_id', techIds).gte('exception_date', monthStart).lte('exception_date', monthEnd),
    (async () => {
      let { data: bk, error: bkErr } = await runBk(bookingLiftCols);
      if (['42703', 'PGRST204'].includes(bkErr?.code) && ['secondary_technician_id', 'extra_slots'].includes(missingColumn(bkErr.message))) {
        if (missingColumn(bkErr.message) === 'secondary_technician_id') bookingLiftCols = false;
        if (missingColumn(bkErr.message) === 'extra_slots') extraSlotsCol = false;
        ({ data: bk, error: bkErr } = await runBk(bookingLiftCols));
      }
      if (bkErr) throw bkErr;
      return bk;
    })(),
  ]);
  if (avResult.error) throw avResult.error;
  if (excResult.error) throw excResult.error;
  const av = avResult.data, exc = excResult.data;
  const bk = bkResult;
  const recurring = {};   // `${techId}:${dow}` -> Set(slot_key)
  for (const r of (av || [])) {
    const k = `${r.technician_id}:${r.day_of_week}`;
    (recurring[k] = recurring[k] || new Set()).add(r.slot_key);
  }
  const excByDate = {};   // `${date}` -> [{tech,slot,is_available}]
  for (const e of (exc || [])) (excByDate[e.exception_date] = excByDate[e.exception_date] || []).push(e);
  const techIdSet = new Set(techIds);
  const occ = {};   // `${techId}:${date}` -> Set(slot_key)
  const addOcc = (tid, date, key) => { (occ[`${tid}:${date}`] = occ[`${tid}:${date}`] || new Set()).add(key); };
  for (const b of (bk || [])) {
    const date = localDateStr(tz, b.scheduled_at);
    const key = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
    if (!key) continue;
    for (const k of [key, ...esOf(b)]) {
      if (techIdSet.has(b.technician_id)) addOcc(b.technician_id, date, k);
      if (b.secondary_technician_id && techIdSet.has(b.secondary_technician_id)) addOcc(b.secondary_technician_id, date, k);
    }
  }

  const daySetFor = (tid, dow, dateStr) => {
    const set = new Set(recurring[`${tid}:${dow}`] || []);
    for (const e of (excByDate[dateStr] || [])) {
      if (e.technician_id !== tid) continue;
      if (e.is_available) set.add(e.slot_key); else set.delete(e.slot_key);
    }
    for (const k of (occ[`${tid}:${dateStr}`] || [])) set.delete(k);
    for (const k of set) {
      const slot = SLOTS.find(s => s.key === k);
      if (!slot || (dateStr === todayStr && slot.start <= nowHHMM)) set.delete(k);
    }
    return set;
  };

  const sideSet = (ids, dow, dateStr) => {
    const set = new Set();
    for (const tid of ids) for (const k of daySetFor(tid, dow, dateStr)) set.add(k);
    return set;
  };
  const sideSlotTechs = (ids, dow, dateStr) => {
    const map = new Map();
    for (const tid of ids) for (const k of daySetFor(tid, dow, dateStr)) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k).add(tid);
    }
    return map;
  };
  const dates = [], slotsByDate = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    if (dateStr < todayStr) continue;
    const dow = dayOfWeekFor(dateStr);
    let keys;
    if (wantPair) {
      keys = sideSet(ownHelperIds, dow, dateStr);
      const primary = sideSlotTechs(primaryIds, dow, dateStr), secondary = sideSlotTechs(secondaryIds, dow, dateStr);
      for (const [key, people] of primary) {
        const helpers = secondary.get(key);
        if (helpers?.size && new Set([...people, ...helpers]).size >= 2) keys.add(key);
      }
    } else keys = sideSet(primaryIds, dow, dateStr);
    if (keys.size) {
      dates.push(dateStr);
      if (includeSlots) slotsByDate[dateStr] = SLOTS.filter(s => keys.has(s.key)).map(s => ({slot_key:s.key,label:s.label,start:s.start,end:s.end}));
    }
  }
  return res.status(200).json({ dates, month, timezone: tz, recommended: await recommendedSlots(db),
    ...(includeSlots ? { slots_by_date: slotsByDate, technicians: primaryRoster } : {}) });
}

async function saveCardOnFile(pmId, cust, slug = null) {
  const SK = businessSecretKey(slug);
  if (!SK) return null;
  const sAuth = { Authorization: `Bearer ${SK}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  const fetchT = async (url, opts) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const response = await fetch(url, { ...opts, signal: ctrl.signal });
      const data = await response.json();
      return { response, data };
    }
    catch (e) { throw e.name === 'AbortError' ? new Error('Stripe request timed out') : e; }
    finally { clearTimeout(timer); }
  };
  const cb = new URLSearchParams();
  if (cust.email) cb.set('email', cust.email);
  if (cust.name) cb.set('name', cust.name);
  if (cust.phone) cb.set('phone', cust.phone);
  cb.set('description', 'Dashboard booking customer');
  const { response: ccr, data: cc } = await fetchT('https://api.stripe.com/v1/customers', { method: 'POST', headers: sAuth, body: cb });
  if (!ccr.ok) throw new Error(cc?.error?.message || 'Stripe customer create failed');
  if (!cc?.id) throw new Error('Stripe did not return a customer');
  const customerId = cc.id;
  const ab = new URLSearchParams(); ab.set('customer', customerId);
  const { response: ar, data: pm } = await fetchT(`https://api.stripe.com/v1/payment_methods/${pmId}/attach`, { method: 'POST', headers: sAuth, body: ab });
  if (!ar.ok) throw new Error(pm?.error?.message || 'Attach failed');
  const db = new URLSearchParams(); db.set('invoice_settings[default_payment_method]', pmId);
  const { response: dr, data: defaults } = await fetchT(`https://api.stripe.com/v1/customers/${customerId}`, { method: 'POST', headers: sAuth, body: db });
  if (!dr.ok) throw new Error(defaults?.error?.message || 'Could not set the default card');
  return { customerId, pmId, brand: pm?.card?.brand || null, last4: pm?.card?.last4 || null };
}

const PRICE_SANITY_LINE_CEILING = 2000;
const PRICE_SANITY_TOTAL_CEILING = 5000;

const MIN_TICKET_PRICE = 0;
const DISMOUNT_ONLY_PRICE = 109;
function isDismountOnlyLines(lines) {
  if (!Array.isArray(lines)) return false;
  const lbl = l => String((l && (l.label || l.name || l.description)) || '').trim();
  const work = lines.filter(l => !/^(travel|after.?hours|tax\b|discount|coupon|service area surcharge|local travel credit)/i.test(lbl(l)));
  if (work.length !== 1 || !/^TV Dismount \(only\)$/i.test(lbl(work[0]))) return false;
  const w = work[0];
  const qty = Number(w.quantity ?? w.qty ?? 1);
  const unit = Number(w.unit_price ?? w.price);
  return qty === 1 && Math.abs(unit - DISMOUNT_ONLY_PRICE) < 0.005;
}
function isHandymanPricedLines(lines) {
  return Array.isArray(lines) && lines.some(line => /^Handyman Labor:/i.test((line && (line.label || line.name)) || ''));
}

function priceSanityIssue({ lines, total } = {}) {
  if (Array.isArray(lines)) {
    for (const l of lines) {
      if (!l) continue;
      const amt = Math.abs(Number(l.unit_price ?? l.price) || 0);
      if (amt > PRICE_SANITY_LINE_CEILING) {
        const label = (l.name || l.label || l.description || 'A line item').toString().slice(0, 60);
        return `"${label}" is $${amt.toFixed(2)} — that's far outside any real charge for this business. Double-check the amount before continuing.`;
      }
    }
  }
  const t = Math.abs(Number(total) || 0);
  if (t > PRICE_SANITY_TOTAL_CEILING) {
    return `This total is $${t.toFixed(2)} — that's far outside any real job for this business. Double-check the amount before continuing.`;
  }
  return null;
}

const REPEAT_RULES = { weekly: { days: 7, count: 12 }, biweekly: { days: 14, count: 12 }, monthly: { months: 1, count: 6 } };
function addMonthsKeepTime(iso, n) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}
async function bookingRepeat(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const rule = REPEAT_RULES[String(body.every || '')];
  if (!rule) return res.status(400).json({ error: 'every must be weekly, biweekly or monthly' });
  const count = Math.max(1, Math.min(rule.count, Number(body.count) || rule.count));
  const { data: b, error } = await db.from('bookings').select('*').eq('id', body.id).eq('business_id', biz.id).maybeSingle();
  if (error) throw error;
  if (!b || !b.scheduled_at) return res.status(404).json({ error: 'Booking not found' });
  if (b.metadata?.series_id && b.metadata.series_id !== b.id) return res.status(409).json({ error: 'This booking is already part of a repeat series.' });
  const { data: items } = await db.from('booking_line_items').select('kind, name, quantity, unit_price, line_total, service_id, option_id, sort_order').eq('booking_id', b.id);
  const seriesId = b.id;
  const meta = { ...(b.metadata || {}), series_id: seriesId, series_every: body.every };
  await db.from('bookings').update({ metadata: { ...meta, series_index: 0 } }).eq('id', b.id);
  const keep = ['business_id', 'customer_id', 'technician_id', 'secondary_technician_id', 'service_id', 'service_area_id', 'status', 'source',
    'duration_minutes', 'subtotal', 'discount', 'price', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'lat', 'lng',
    'notes', 'customer_notes', 'payment_required', 'payment_method', 'sms_consent', 'extra_slots'];
  const created = [], unassigned = [];
  for (let i = 1; i <= count; i++) {
    const at = rule.months ? addMonthsKeepTime(b.scheduled_at, i * rule.months) : new Date(Date.parse(b.scheduled_at) + i * rule.days * 86400000).toISOString();
    const row = { status: 'confirmed' };
    for (const k of keep) if (b[k] !== undefined) row[k] = b[k];
    Object.assign(row, { scheduled_at: at, scheduled_end: b.scheduled_end ? new Date(Date.parse(at) + (Date.parse(b.scheduled_end) - Date.parse(b.scheduled_at))).toISOString() : null,
      status: b.status === 'cancelled' || b.status === 'completed' ? 'confirmed' : b.status, metadata: { ...meta, series_index: i } });
    let { data: nb, error: e1 } = await db.from('bookings').insert(row).select('id').single();
    if (e1 && /bookings_tech_slot_unique/.test(e1.message || '')) {
      ({ data: nb, error: e1 } = await db.from('bookings').insert({ ...row, technician_id: null, secondary_technician_id: null }).select('id').single());
      if (!e1) unassigned.push(at);
    }
    if (e1) throw e1;
    if (items && items.length) {
      const { error: e2 } = await db.from('booking_line_items').insert(items.map((li) => ({ ...li, booking_id: nb.id, business_id: biz.id })));
      if (e2) console.warn('[admin] repeat line items failed:', e2.message);
    }
    created.push({ id: nb.id, scheduled_at: at });
  }
  return res.status(200).json({ ok: true, series_id: seriesId, created, unassigned });
}
async function bookingSeriesStop(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const { data: b } = await db.from('bookings').select('id, scheduled_at, metadata').eq('id', body.id).eq('business_id', biz.id).maybeSingle();
  const seriesId = b?.metadata?.series_id;
  if (!seriesId) return res.status(400).json({ error: 'This booking does not repeat.' });
  const from = new Date(Math.max(Date.now(), Date.parse(b.scheduled_at) + 1)).toISOString();
  const { data, error } = await db.from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Repeat stopped' })
    .eq('business_id', biz.id).eq('metadata->>series_id', seriesId).gt('scheduled_at', from)
    .not('status', 'in', '(completed,cancelled)').select('id');
  if (error) throw error;
  return res.status(200).json({ ok: true, cancelled: (data || []).length });
}

async function bookingCreate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const c = body.customer || {};
  if (c.name) c.name = capName(String(c.name).trim());
  if (!c.name && !c.phone) return res.status(400).json({ error: 'Customer name or phone required' });
  const smsConsent = await textConsentFor(db, c.phone);
  if (c.name && hasDigits(c.name)) return res.status(400).json({ error: 'Please enter a name using letters only — no numbers.' });
  if (await isScammer({ phone: c.phone, email: c.email }, db)) return res.status(403).json({ error: SCAMMER_BOOKING_ERROR, scammer: true });
  console.log(`[admin] booking create: biz=${biz.slug} customer email=${c.email ? 'present' : 'ABSENT'} phone=${c.phone ? 'present' : 'absent'}`);

  const idempotencyKey = (body.idempotency_key || '').toString().trim() || null;
  if (idempotencyKey) {
    const { data: dupe, error } = await db.from('bookings')
      .select('id, status').eq('business_id', biz.id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (error) throw error;
    if (dupe?.status === 'cancelled') return res.status(409).json({ error: 'This booking was cancelled. Start a new booking to schedule it again.', code: 'booking_cancelled', id: dupe.id });
    if (dupe?.id) return res.status(200).json({ id: dupe.id, duplicate: true,
      warning: 'Booking already exists. Check the saved job to confirm its card, line items, and notifications before making any changes.' });
  }

  let customer_id = c.id || null;
  let matchedExisting = !!c.id;
  let matchedPostalCode = null;
  if (customer_id) {
    const { data: live } = await db.from('customers').select('id').eq('id', customer_id).eq('business_id', biz.id).maybeSingle();
    if (!live) {
      const { data: moved } = await db.from('customer_merge_20260926_map').select('keeper_id').eq('loser_id', customer_id).maybeSingle();
      customer_id = moved?.keeper_id || null;
      matchedExisting = !!customer_id;
    }
  }
  if (!customer_id && c.phone) {
    const { data: rows, error } = await db.from('customers').select('id, postal_code').eq('business_id', biz.id).eq('phone', c.phone).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    const data = rows && rows[0];
    if (data?.id) { customer_id = data.id; matchedExisting = true; matchedPostalCode = data.postal_code || null; }
  }
  if (!customer_id && c.email) {
    const { data: rows, error } = await db.from('customers').select('id, postal_code').eq('business_id', biz.id).eq('email', c.email).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    const data = rows && rows[0];
    if (data?.id) { customer_id = data.id; matchedExisting = true; matchedPostalCode = data.postal_code || null; }
  }
  const effectivePostalCode = (c.postal_code || '').toString().trim() || matchedPostalCode || null;
  if (!customer_id) {
    const { data, error } = await db.from('customers').insert({
      business_id: biz.id, name: c.name || 'Customer', phone: c.phone || null, email: c.email || null,
      address_line1: c.address_line1 || null, city: c.city || null, state: c.state || null, postal_code: c.postal_code || null,
    }).select('id').single();
    if (error) throw error;
    customer_id = data.id;
  } else if (matchedExisting) {
    const patch = {};
    if (c.email) patch.email = c.email;
    if (c.name) patch.name = c.name;
    if (c.phone) patch.phone = c.phone;
    if (c.address_line1) patch.address_line1 = c.address_line1;
    if (c.city) patch.city = c.city;
    if (c.state) patch.state = c.state;
    if (c.postal_code) patch.postal_code = c.postal_code;
    if (Object.keys(patch).length) {
      const { error: upErr } = await db.from('customers').update(patch).eq('id', customer_id).eq('business_id', biz.id);
      if (upErr) console.warn('[admin] customer backfill failed:', upErr.message);
    }
  }

  const bookingAreaId = await serviceAreaIdFromPostal(db, biz.id, effectivePostalCode);
  const tz = await areaTimezone(db, bookingAreaId, biz.timezone || 'Asia/Manila');

  let scheduled_at = body.scheduled_at || null;
  if (body.scheduled_date && body.scheduled_slot) {
    const slotDef = SLOTS.find(s => s.key === body.scheduled_slot);
    if (slotDef) {
      const [hh, mm] = slotDef.start.split(':').map(Number);
      const midnight = localDateStartUTC(tz, body.scheduled_date);
      scheduled_at = new Date(midnight.getTime() + (hh * 60 + mm) * 60000).toISOString();
    }
  }

  let technician_id = body.technician_id;
  let unassignedWarning = null;
  const secondaryRaw = body.secondary_technician_id || null;
  const secondaryConcreteId = (secondaryRaw && secondaryRaw !== 'any') ? secondaryRaw : null;
  if (technician_id === 'any') {
    const scopes = await rosterScopes(db, biz, (body.pool || '').toString(), effectivePostalCode);
    if (secondaryRaw === 'any') {
      const scopesSecondary = await rosterScopes(db, biz, (body.pool2 || '').toString(), effectivePostalCode);
      const pair = await pickAvailableTechPair(db, scopes, scopesSecondary, body.scheduled_date, body.scheduled_slot, tz, body.require_available === true);
      technician_id = pair.primaryId;
      if (pair.secondaryId) body.secondary_technician_id = pair.secondaryId;
      if (!technician_id) {
        technician_id = body.needs_lifting ? await pickOwnHelperPrimary(db, scopes, body.scheduled_date, body.scheduled_slot, tz, body.require_available === true) : null;
        if (!technician_id) technician_id = await pickAvailableTech(db, scopes, body.scheduled_date, body.scheduled_slot, tz, null, false, true, body.require_available === true);
      }
    } else {
      technician_id = await pickAvailableTech(db, scopes, body.scheduled_date, body.scheduled_slot, tz, secondaryConcreteId, false, true, body.require_available === true);
    }
    if (!technician_id) {
      if (body.require_available === true) return res.status(409).json({ code: 'slot_unavailable', error: 'That time is no longer available. Refresh the available times and choose another slot.' });
      unassignedWarning = 'Heads up: no cleaner was still free for that slot, so this booking was created UNASSIGNED. Open the job and assign a cleaner (or move the time) — nobody is scheduled to show up yet.';
    }
  }

  let primaryBringsOwnSecond = false;
  let primaryTechInfo = null;
  if (technician_id) {
    const { data: pt, error } = await db.from('technicians').select('name, active, status, photo_url, bio_years, bio_blurb').eq('id', technician_id).maybeSingle();
    if (error) throw error;
    if (body.require_available === true && (!pt || pt.active === false || pt.status === 'off')) {
      return res.status(409).json({ code: 'slot_unavailable', error: 'That technician is no longer available. Recheck the available times and choose another technician.' });
    }
    primaryBringsOwnSecond = bringsOwnSecondTech(pt?.name);
    primaryTechInfo = pt || null;
  }

  let secondary_technician_id = body.secondary_technician_id || null;
  if (primaryBringsOwnSecond) {
    secondary_technician_id = null;
  } else if (secondary_technician_id === 'any') {
    secondary_technician_id = await resolveDefaultSecondary(
      db, biz, effectivePostalCode, body.scheduled_date, body.scheduled_slot, tz, technician_id, body.pool2, body.require_available === true);
  }
  if (secondary_technician_id) {
    const { data: secTech, error } = await db.from('technicians').select('name, active, status').eq('id', secondary_technician_id).maybeSingle();
    if (error) throw error;
    if (body.require_available === true && (!secTech || secTech.active === false || secTech.status === 'off')) {
      return res.status(409).json({ code: 'slot_unavailable', error: 'The second cleaner is no longer available. Recheck the available times before booking.' });
    }
    if (secTech && isSecondaryIneligibleName(secTech.name)) {
      return res.status(400).json({ error: `${secTech.name} can't be booked as a second technician. Pick another second cleaner or another time.` });
    }
  }
  if (body.needs_lifting && !secondary_technician_id && !primaryBringsOwnSecond) {
    return res.status(body.require_available === true ? 409 : 400).json({ code: 'slot_unavailable', error: 'This job requires a second cleaner, but no one from the chosen team is free for that time. Pick a specific second cleaner or another time.' });
  }
  if (secondary_technician_id && secondary_technician_id === technician_id) {
    return res.status(400).json({ error: 'The two technicians must be different.' });
  }

  {
    const mm = await crossMetroMismatch(db, bookingAreaId,
      [technician_id, secondary_technician_id], body.confirm_cross_metro_ids);
    if (mm) {
      return res.status(409).json({
        code: 'cross_metro_confirm',
        tech_id: mm.techId,
        error: `${mm.techName} works ${mm.techMetro}, but this job is in ${mm.bookingMetro}. Book ${mm.techName} on it anyway?`,
      });
    }
  }

  if (scheduled_at && (technician_id || secondary_technician_id)) {
    const conflictDate = body.scheduled_date || localDateStr(tz, scheduled_at);
    const conflictSlot = body.scheduled_slot || slotKeyForLocalTime(localHHMM(tz, scheduled_at));
    const forcedIds = new Set((body.force_unavailable_ids || []).map(String));
    if (!conflictSlot) {
      const uncheckedId = technician_id && !forcedIds.has(String(technician_id)) ? technician_id
        : (secondary_technician_id && !forcedIds.has(String(secondary_technician_id)) ? secondary_technician_id : null);
      if (uncheckedId) {
        const { data: t } = await db.from('technicians').select('name').eq('id', uncheckedId).maybeSingle();
        return res.status(409).json({ error: `Couldn't verify ${t?.name || 'this technician'}'s schedule for this time — it doesn't line up with one of the standard time slots. Confirm to book anyway.`, code: 'tech_unavailable', tech_id: uncheckedId });
      }
    } else {
      const dow = dayOfWeekFor(conflictDate);
      const slotState = await batchTechSlotState(db, [technician_id, secondary_technician_id].filter(Boolean), conflictDate, dow, tz);
      if (technician_id) {
        const taken = slotState.get(technician_id).booked;
        if (taken.has(conflictSlot)) {
          return res.status(409).json({ code: 'slot_unavailable', error: 'That technician is already booked for this time slot. Choose another time or technician.' });
        }
        if (!forcedIds.has(String(technician_id))) {
          const keys = slotState.get(technician_id).keys;
          if (!keys.has(conflictSlot)) {
            const { data: t } = await db.from('technicians').select('name').eq('id', technician_id).maybeSingle();
            return res.status(409).json({ error: `${t?.name || 'This technician'} isn't scheduled to work that day/time — they may have requested it off. Pick another technician or time, or confirm to book anyway.`, code: 'tech_unavailable', tech_id: technician_id });
          }
        }
      }
      if (secondary_technician_id) {
        const taken2 = slotState.get(secondary_technician_id).booked;
        if (taken2.has(conflictSlot)) {
          return res.status(409).json({ code: 'slot_unavailable', error: 'The second cleaner is already booked for this time slot. Choose another time or technician.' });
        }
        if (!forcedIds.has(String(secondary_technician_id))) {
          const keys2 = slotState.get(secondary_technician_id).keys;
          if (!keys2.has(conflictSlot)) {
            const { data: t2 } = await db.from('technicians').select('name').eq('id', secondary_technician_id).maybeSingle();
            return res.status(409).json({ error: `${t2?.name || 'The second cleaner'} isn't scheduled to work that day/time — they may have requested it off. Pick another technician or time, or confirm to book anyway.`, code: 'tech_unavailable', tech_id: secondary_technician_id });
          }
        }
      }
    }
  }

  const paymentMethod = body.payment_method || null;
  const status = technician_id ? 'assigned' : 'confirmed';

  if (customer_id && scheduled_at) {
    try {
      const { data: same } = await db.from('bookings').select('id, status')
        .eq('business_id', biz.id).eq('customer_id', customer_id).eq('scheduled_at', scheduled_at)
        .not('status', 'in', '(cancelled,no_show)').limit(1).maybeSingle();
      if (same?.id) {
        return res.status(409).json({
          error: 'This customer already has a booking at that exact date and time — it may have gone through on a previous attempt. Check the schedule before re-booking.',
          id: same.id, duplicate: true,
        });
      }
    } catch { /* dedupe is best-effort — never block a legitimate booking on it */ }
  }

  const hasSelections = Array.isArray(body.selections) && body.selections.length > 0;
  if (!body.service_id && !hasSelections && !(body.notes || '').toString().trim()) {
    return res.status(400).json({ error: 'Choose a service category and at least one option before creating this booking — nothing was selected.' });
  }

  if (body.confirm_high_price !== true) {
    const issue = priceSanityIssue({ lines: body.selections, total: body.price });
    if (issue) return res.status(409).json({ error: issue, code: 'high_price_confirm_required' });
  }

  {
    const _price = Number(body.price) || 0;
    const _isHandyman = isHandymanPricedLines(body.selections);
    const _hasDismount = Array.isArray(body.selections) && body.selections.some(l => /^TV Dismount \(only\)/i.test(String((l && l.label) || '')));
    const _isDismountOnly = isDismountOnlyLines(body.selections);
    if (_hasDismount && !_isDismountOnly) {
      return res.status(400).json({ error: 'TV Dismount Only must be the only service on the booking, at $109. For more work use Home Cleaning.' });
    }
    if (_price > 0 && _price < MIN_TICKET_PRICE && !_isHandyman && !_isDismountOnly) {
      return res.status(400).json({ error: `Jobs must total at least $${MIN_TICKET_PRICE}. Add another service or add-on before saving.`, below_minimum: true });
    }
  }

  const bookingInsert = {
    business_id: biz.id, customer_id,
    technician_id: technician_id || null,
    secondary_technician_id: secondary_technician_id || null,
    service_id: body.service_id || null,
    service_area_id: bookingAreaId || null,
    status, source: 'manual',
    scheduled_at,
    subtotal: Number(body.subtotal) || 0,
    price: Number(body.price) || 0,
    notes: body.notes || null,
    customer_notes: body.customer_notes || null,
    address_line1: c.address_line1 || null, city: c.city || null, state: c.state || null, postal_code: c.postal_code || null,
    payment_required: !!paymentMethod && paymentMethod !== 'quote',
    payment_method: paymentMethod,
    needs_lifting: !!body.needs_lifting,
    tv_size_category: body.tv_size_category || null,
    sms_consent: smsConsent,
    idempotency_key: idempotencyKey,
    metadata: { booked_by: auth.role === 'owner' ? 'Admin' : (auth.name || 'Office'),
      ...((body.scheduled_date && SLOT_KEYS.has(body.scheduled_slot)) ? { slot_key: body.scheduled_slot,
        slot_recommended: isRecommended(await recommendedSlots(db), dayOfWeekFor(body.scheduled_date), body.scheduled_slot) } : {}) },
  };

  const OPTIONAL_INSERT_COLS = ['sms_consent', 'secondary_technician_id', 'needs_lifting', 'tv_size_category', 'idempotency_key'];
  const wantedSecondTech = !!bookingInsert.secondary_technician_id;
  let insertObj = { ...bookingInsert };
  let bRow, bErr;
  for (let attempt = 0; attempt < OPTIONAL_INSERT_COLS.length + 1; attempt++) {
    ({ data: bRow, error: bErr } = await db.from('bookings').insert(insertObj).select('id').single());
    if (!bErr) break;
    if (idempotencyKey && (bErr.code === '23505' || /idempotency/i.test(bErr.message || '') || /duplicate key/i.test(bErr.message || ''))) {
      const { data: winner, error } = await db.from('bookings')
        .select('id, status').eq('business_id', biz.id).eq('idempotency_key', idempotencyKey).maybeSingle();
      if (error) throw error;
      if (winner?.status === 'cancelled') return res.status(409).json({ error: 'This booking was cancelled. Start a new booking to schedule it again.', code: 'booking_cancelled', id: winner.id });
      if (winner?.id) return res.status(200).json({ id: winner.id, duplicate: true,
        warning: 'Booking already exists. Check the saved job to confirm its card, line items, and notifications before making any changes.' });
    }
    if (bErr.code === '23505' && /bookings_tech_slot_unique/.test(bErr.message || '')) {
      return res.status(409).json({ code: 'slot_unavailable', error: 'That technician was just booked for this exact time slot by someone else. Refresh the available times and pick another slot or technician.' });
    }
    const missing = ['42703', 'PGRST204'].includes(bErr.code) && OPTIONAL_INSERT_COLS.find(c => missingColumn(bErr.message) === c && c in insertObj);
    if (!missing) break;
    if (missing === 'idempotency_key' && idempotencyKey) break;
    if (missing === 'secondary_technician_id' && wantedSecondTech) {
      return res.status(503).json({ error: 'This database can\'t store a second cleaner yet (missing the two-technician upgrade). Apply migration 0019_secondary_technician.sql in Supabase, then rebook. The booking was not created so the second cleaner isn\'t silently lost.' });
    }
    console.warn(`[admin] bookings.${missing} not found, retrying without it`);
    delete insertObj[missing];
  }

  if (bErr) throw bErr;
  if (!bRow?.id) throw new Error('The booking record was not returned. Retry using the same booking attempt.');

  let postInsertWarning = unassignedWarning;
  try {
  await ensureReviewToken(db, { id: bRow.id });


  if (paymentMethod === 'card' && body.payment_method_id) {
    try {
      const ids = await saveCardOnFile(body.payment_method_id, { name: c.name, email: c.email, phone: c.phone }, biz.slug);
      if (!ids) throw new Error('Card storage is not configured for this business');
      const { error } = await db.from('bookings').update({
        stripe_customer_id: ids.customerId, stripe_payment_method_id: ids.pmId,
      }).eq('id', bRow.id);
      if (error) throw error;
    } catch (e) {
      console.warn('[admin] card-on-file save failed:', e.message);
      const cardWarn = `Booking was created, but the card could not be saved (${e.message}). Open the job and use "Change card" to add it before the appointment.`;
      postInsertWarning = postInsertWarning ? `${postInsertWarning}\n\n${cardWarn}` : cardWarn;
    }
  }
  const selections = Array.isArray(body.selections) ? body.selections : [];
  const selectionCount = selections.length;
  if (selections.length) {
    const rows = canonicalizeLineItems(selections.map(s => {
      const qty = Number(s.quantity) || 1;
      const unit = Number(s.price) || 0;
      const kind = s.label === 'Travel' ? 'addon' : 'option';
      return {
        booking_id: bRow.id, business_id: biz.id,
        kind, name: s.label || 'Option',
        quantity: qty, unit_price: unit, line_total: unit * qty,
        service_id: body.service_id || null, option_id: s.option_id || null,
      };
    })).map((r, i) => ({ ...r, sort_order: i }));
    let { error: liErr } = await db.from('booking_line_items').insert(rows);
    if (liErr && isSortOrderErr(liErr)) {
      ({ error: liErr } = await db.from('booking_line_items').insert(rows.map(({ sort_order, ...r }) => r)));
    }
    if (liErr) {
      console.error('[admin] line-items insert failed (booking exists):', liErr.message);
      postInsertWarning = postInsertWarning || 'Booking was created, but its line items could not be saved — open the job and re-add them.';
    }
  }

  if (Number(body.tax) > 0) {
    const taxRow = {
      booking_id: bRow.id, business_id: biz.id,
      kind: 'fee', name: 'Tax (8.25%)',
      quantity: 1, unit_price: Number(body.tax), line_total: Number(body.tax),
      service_id: null, option_id: null, taxable: false, sort_order: selectionCount,
    };
    let { error: taxErr } = await db.from('booking_line_items').insert(taxRow);
    if (taxErr && isSortOrderErr(taxErr)) {
      const { sort_order, ...bare } = taxRow;
      ({ error: taxErr } = await db.from('booking_line_items').insert(bare));
    }
    if (taxErr) {
      console.error('[admin] tax line-item insert failed (booking exists):', taxErr.message);
      postInsertWarning = postInsertWarning || 'Booking was created, but the tax line could not be saved — open the job and re-add it.';
    }
  }

  const { error: statusEventError } = await db.from('booking_status_events').insert({
    booking_id: bRow.id, business_id: biz.id, technician_id: technician_id || null,
    status, note: `Created by ${auth.role} (dashboard)`,
  });
  if (statusEventError) postInsertWarning = [postInsertWarning, 'Booking was created, but its status history could not be saved.'].filter(Boolean).join('\n\n');

  const customerSmsP = (async () => {
    if (!c.phone || !scheduled_at || !smsConsent) return;
    if (!(await staffTextGate(db, c.phone, true)).ok) return;
    const _d = new Date(scheduled_at);
    const dateStr = _d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = _d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    const slotLabel = (body.scheduled_date && body.scheduled_slot)
      ? ((SLOTS.find(s => s.key === body.scheduled_slot) || {}).label || null) : null;
    const msg = bookingConfirmMessage({
      bizName: biz.name, bizSlug: biz.slug,
      dateStr: slotLabel ? dateStr : `${dateStr} at ${timeStr}`,
      timeWindow: slotLabel || '',
      techName: primaryTechInfo?.name || null,
    });
    try {
      const _confirmResult = await sendSMSResult(c.phone, msg);
      if (!_confirmResult.ok) {
        if (_confirmResult.error) console.error('[SMS]', _confirmResult.error);
        else console.warn(`[SMS] not sent (${_confirmResult.skipped}):`, msg);
      }
      await logAutomatedMessage(db, { businessId: biz.id, customerPhone: c.phone, body: msg, result: _confirmResult });
    } catch (e) { console.error(e); }
  })();


  const techNotifyP = Promise.allSettled([technician_id, secondary_technician_id].filter(Boolean).map(async id => {
    try { await notifyTechAssigned(db, biz, id, scheduled_at, tz, { bookingId: bRow.id }); }
    catch (e) { console.error('[tech-notify]', e.message); }
  }));

  maybeSendBigBracketAlert({
    db, technicianId: technician_id,
    lines: selections,
    customerName: c.name || '',
    whenStr: (() => {
      try { return scheduled_at ? new Date(scheduled_at).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }) : null; }
      catch { return body.scheduled_date || null; }
    })(),
  });

  maybeSendZeroOrLowProfitAlert({
    price: Number(body.price) || 0,
    lines: selections,
    techName: primaryTechInfo?.name || '',
    customerName: c.name || '',
    scheduled_at,
    whenStr: (() => {
      try { return scheduled_at ? new Date(scheduled_at).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }) : null; }
      catch { return body.scheduled_date || null; }
    })(),
  });

  const confirmationEmailP = (async () => {
    if (!c.email) return;
    try {
      const firstName = greetName((c.name || '').trim().split(/\s+/)[0] || '');
      let dateLong = '';
      if (scheduled_at) {
        try { dateLong = new Date(scheduled_at).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }); } catch { /* keep blank */ }
      }
      const slotDef = SLOTS.find(s => s.key === body.scheduled_slot);
      const timeWindow = slotDef ? slotDef.label : '';

      let startEpoch = null, endEpoch = null;
      if (scheduled_at) {
        startEpoch = Math.floor(new Date(scheduled_at).getTime() / 1000);
        let durMin = 120;
        if (slotDef) {
          const [sh, sm] = slotDef.start.split(':').map(Number);
          const [eh, em] = slotDef.end.split(':').map(Number);
          durMin = (eh * 60 + em) - (sh * 60 + sm);
        }
        endEpoch = startEpoch + durMin * 60;
      }
      const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

      const hasPrice = (Number(body.price) || 0) > 0;
      let emailLines = null;
      if (hasPrice) {
        emailLines = selections.map(s => {
          const qty = Number(s.quantity) || 1;
          const unit = Number(s.price) || 0;
          return { label: s.label || 'Option', qty, amount: unit * qty };
        });
        if (emailLines.length && Number(body.tax) > 0) emailLines.push({ label: 'Tax', qty: 1, amount: Number(body.tax) });
        if (!emailLines.length) emailLines.push({ label: 'Service total', qty: 1, amount: Number(body.price) });
      }

      const { subject, html } = bookingConfirmationEmail({
        firstName,
        dateLong, timeWindow,
        technicianName: primaryTechInfo?.name || null,
        technicianPhotoUrl: primaryTechInfo?.photo_url || null,
        technicianBioYears: primaryTechInfo?.bio_years || null,
        technicianBioBlurb: primaryTechInfo?.bio_blurb || null,
        address: { line1: c.address_line1, city: c.city, state: c.state, zip: c.postal_code },
        lines: emailLines,
        total: hasPrice ? Number(body.price) : null,
        tip: 0,
        twoTechs: !!body.needs_lifting,
        startEpoch, endEpoch, baseUrl,
        jobId: bRow.id,
        gdsUpsellUrl: gdsUpsellUrlFor({
          lines: selections, bookingId: bRow.id, baseUrl,
          eligible: selections.some(s => /^tv size\s*:/i.test((s.label || s.name || '').toString())),
        }),
        rescheduleUrl: rescheduleUrlFor({ bookingId: bRow.id, baseUrl }),
      }, brandFor(biz.slug));
      const { from } = emailConfig(biz.slug);
      const _domsKey = process.env.DOMS_RESEND_API_KEY || '';
      const _haKey = process.env.RESEND_API_KEY || '';
      console.log(`[admin] email key path (${biz.slug}): DOMS_RESEND_API_KEY set=${!!_domsKey} (len=${_domsKey.length}) RESEND_API_KEY set=${!!_haKey} (len=${_haKey.length}) usingFallback=${biz.slug === 'doms' && !_domsKey} domsKeyDiffersFromHA=${!!_domsKey && _domsKey !== _haKey} from=${from}`);
      const result = await sendEmail({ slug: biz.slug, to: c.email, subject, html, replyTo: from });
      if (result.sent) console.log(`[admin] confirmation email SENT to ${c.email} (${biz.slug}) id=${result.id || '?'}`);
      else console.warn(`[admin] confirmation email NOT sent to ${c.email} (${biz.slug}):`, result.skipped || result.error);
      await persistConfirmationEmailStatus(db, bRow.id, result.sent ? 'sent' : 'failed');
    } catch (e) {
      console.error('[admin] confirmation email error:', e.message);
      await persistConfirmationEmailStatus(db, bRow.id, 'failed');
    }
  })();

  const ownerAlertP = (async () => {
    if (auth.role === 'owner' || process.env.NOTIFY_SECRETARY_BOOKINGS === '0') return;
    try {
      let techName = null;
      const techIds = [technician_id, secondary_technician_id].filter(Boolean);
      if (techIds.length) {
        const { data: tns } = await db.from('technicians').select('id, name').in('id', techIds);
        techName = (tns || []).map(t => t.name).filter(Boolean).join(' & ') || null;
      }
      const slotDef2 = SLOTS.find(s => s.key === body.scheduled_slot);
      let scheduledEnd = null;
      if (scheduled_at && slotDef2) {
        const [sh, sm] = slotDef2.start.split(':').map(Number);
        const [eh, em] = slotDef2.end.split(':').map(Number);
        scheduledEnd = new Date(new Date(scheduled_at).getTime() + ((eh * 60 + em) - (sh * 60 + sm)) * 60000).toISOString();
      }
      const lineItems = (Array.isArray(body.selections) ? body.selections : []).map(s => ({
        name: s.label || 'Option', quantity: Number(s.quantity) || 1,
        line_total: (Number(s.price) || 0) * (Number(s.quantity) || 1),
      }));
      if (Number(body.tax) > 0) lineItems.push({ name: 'Tax', quantity: 1, line_total: Number(body.tax) });
      await sendOwnerBookingAlert({
        slug: biz.slug, businessName: biz.name, timezone: tz,
        bookedBy: auth.name || 'Office',
        customer: { name: c.name, phone: c.phone, email: c.email },
        address: { line1: c.address_line1, city: c.city, state: c.state, zip: c.postal_code },
        scheduledAt: scheduled_at, scheduledEnd,
        technicianName: techName, price: Number(body.price) || 0,
        lineItems, customerNotes: body.customer_notes || null, bookingId: bRow.id,
      });
    } catch (e) { console.warn('[admin] secretary booking alert non-fatal:', e.message); }
  })();

  const deliveries = await Promise.allSettled([customerSmsP, techNotifyP, confirmationEmailP, ownerAlertP]);
  if (deliveries.some(result => result.status === 'rejected')) {
    postInsertWarning = [postInsertWarning, 'Booking was created, but some notifications could not be completed. Check the saved job before retrying a notification.'].filter(Boolean).join('\n\n');
  }

  return res.status(200).json({ ok: true, id: bRow.id, ...(postInsertWarning ? { warning: postInsertWarning } : {}) });
  } catch (error) {
    console.error('[admin] booking exists but setup did not finish:', error.message);
    return res.status(200).json({ ok: true, id: bRow.id,
      warning: [postInsertWarning, 'Booking was created, but setup did not finish. Open the saved job and verify its card, line items, and notifications before the appointment.'].filter(Boolean).join('\n\n') });
  }
}

export async function bookingUpdate(req, res, db, auth, body, opts = {}) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = opts.biz || await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  const existingSel = () => `id, status, technician_id, ${bookingLiftCols ? 'secondary_technician_id, ' : ''}scheduled_at, postal_code, review_token, sms_consent, metadata, payment_status, amount_paid, customer:customers ( phone, email, name )`;
  let { data: existing, error: e0 } = await db.from('bookings')
    .select(existingSel()).eq('id', id).eq('business_id', biz.id).single();
  if (e0 && /secondary_technician_id/.test(e0.message || '')) {
    bookingLiftCols = false;
    ({ data: existing, error: e0 } = await db.from('bookings').select(existingSel()).eq('id', id).eq('business_id', biz.id).single());
  }
  if (e0 || !existing) return res.status(404).json({ error: 'Booking not found' });

  const patch = {};
  let newStatus = null;
  let confirmedBrackets = null;
  let platesAnswer = null;
  const now = new Date().toISOString();

  switch (body.action) {
    case 'confirm':
      patch.status = newStatus = 'confirmed'; patch.confirmed_at = now; break;
    case 'cancel':
      if (String(existing.payment_status || '').toLowerCase() === 'paid' && Number(existing.amount_paid) > 0) {
        return res.status(409).json({ error: 'This job is paid. Refund the payment (or move it to the new job) before cancelling.' });
      }
      patch.status = newStatus = 'cancelled'; patch.cancelled_at = now;
      if (existing.technician_id) {
        (async () => {
          try {
            const { data: _t } = await db.from('technicians').select('phone').eq('id', existing.technician_id).maybeSingle();
            if (!_t?.phone) return;
            const _tz = await areaTimezone(db, existing.service_area_id || await serviceAreaIdFromPostal(db, biz.id, existing.postal_code), biz.timezone || 'Asia/Manila');
            let when = 'your job';
            if (existing.scheduled_at) {
              const _d = new Date(existing.scheduled_at);
              when = _d.toLocaleDateString('en-US', { timeZone: _tz, weekday: 'short', month: 'short', day: 'numeric' }) +
                     ' ' + _d.toLocaleTimeString('en-US', { timeZone: _tz, hour: 'numeric', minute: '2-digit' });
            }
            const msg = `❌ Job canceled: ${when} (${existing.customer?.name || 'customer'}). No action needed — your calendar's updated.`;
            sendSMS(_t.phone, msg).catch(console.error);
          } catch (e) { console.warn('[cancel] tech SMS failed:', e.message); }
        })();
      }
      break;
    case 'reschedule': {
      const rtz = await areaTimezone(db, await serviceAreaIdFromPostal(db, biz.id, existing.postal_code), biz.timezone || 'Asia/Manila');
      if (body.scheduled_date && body.scheduled_slot) {
        const slotDef = SLOTS.find(s => s.key === body.scheduled_slot);
        if (!slotDef) return res.status(400).json({ error: 'Invalid time slot' });
        const [sh, sm] = slotDef.start.split(':').map(Number);
        const [eh, em] = slotDef.end.split(':').map(Number);
        const midnight = localDateStartUTC(rtz, body.scheduled_date);
        patch.scheduled_at = new Date(midnight.getTime() + (sh * 60 + sm) * 60000).toISOString();
        patch.scheduled_end = new Date(midnight.getTime() + (eh * 60 + em) * 60000).toISOString();
      } else if (body.scheduled_at) {
        patch.scheduled_at = body.scheduled_at;
        if (body.scheduled_end) patch.scheduled_end = body.scheduled_end;
      } else {
        return res.status(400).json({ error: 'scheduled_at (or scheduled_date + scheduled_slot) required' });
      }
      if (body.technician_id !== undefined) patch.technician_id = body.technician_id || null;
      if (extraSlotsCol) patch.extra_slots = [];
      {
        const existMetaResched = existing.metadata || {};
        const {
          late_alert_sent_at, tech_late_notified_ids, otw_nudge_sent_ids, staff_late_notified_at,
          stage1_sent_ids, stage2_sent_ids, stage3_tech_sent_ids,
          stage4_tech_sent_ids, stage4_staff_owner_notified_at,
          late_reported_at, late_reported_by,
          ...restMetaResched
        } = existMetaResched;
        if (existing.scheduled_at && existing.scheduled_at !== patch.scheduled_at) {
          restMetaResched.rescheduled_from = existing.scheduled_at;
          delete restMetaResched.reminder_sent_at;
        }
        restMetaResched.rescheduled_by = opts.actor || `office:${auth.name || auth.role || 'office'}`;
        patch.metadata = restMetaResched;
      }
      break;
    }
    case 'assign': {
      if (body.technician_id !== undefined) patch.technician_id = body.technician_id || null;
      const primaryChanged = body.technician_id !== undefined && (body.technician_id || null) !== (existing.technician_id || null);
      if (primaryChanged && extraSlotsCol) patch.extra_slots = [];
      let secondaryChanged = false;
      if (body.secondary_technician_id !== undefined && bookingLiftCols) {
        let sec = body.secondary_technician_id || null;
        if (sec === 'any') {
          const aTz = await areaTimezone(db, await serviceAreaIdFromPostal(db, biz.id, existing.postal_code), biz.timezone || 'Asia/Manila');
          const effTechId = (body.technician_id !== undefined ? patch.technician_id : existing.technician_id) || null;
          const aDate = existing.scheduled_at ? localDateStr(aTz, existing.scheduled_at) : null;
          const aSlot = existing.scheduled_at ? slotKeyForLocalTime(localHHMM(aTz, existing.scheduled_at)) : null;
          sec = await resolveDefaultSecondary(db, biz, existing.postal_code, aDate, aSlot, aTz, effTechId, body.pool2);
        }
        patch.secondary_technician_id = sec;
        secondaryChanged = (sec || null) !== (existing.secondary_technician_id || null);
      }
      if (primaryChanged || secondaryChanged) {
        const existMetaAssign = existing.metadata || {};
        const {
          late_alert_sent_at, tech_late_notified_ids, otw_nudge_sent_ids, staff_late_notified_at,
          stage1_sent_ids, stage2_sent_ids, stage3_tech_sent_ids,
          stage4_tech_sent_ids, stage4_staff_owner_notified_at,
          late_reported_at, late_reported_by,
          ...restMeta
        } = existMetaAssign;
        patch.metadata = { ...restMeta, reassigned_at: now };
      }
      if (body.technician_id && existing.status === 'confirmed') { patch.status = newStatus = 'assigned'; patch.assigned_at = now; }
      break;
    }
    case 'reopen':
      if (existing.status !== 'completed') return res.status(400).json({ error: 'Only completed jobs can be reopened' });
      patch.status = newStatus = existing.technician_id ? 'assigned' : 'confirmed';
      {
        const existMeta = existing.metadata || {};
        const {
          late_alert_sent_at, tech_late_notified_ids, otw_nudge_sent_ids, staff_late_notified_at,
          stage1_sent_ids, stage2_sent_ids, stage3_tech_sent_ids,
          stage4_tech_sent_ids, stage4_staff_owner_notified_at,
          late_reported_at, late_reported_by,
          ...restMeta
        } = existMeta;
        patch.metadata = { ...restMeta, reopened_at: now, reopened_from: 'completed' };
      }
      break;
    case 'status':
      if (!body.status) return res.status(400).json({ error: 'status required' });
      if (!SETTABLE_STATUSES.includes(body.status)) {
        return res.status(400).json({ error: `Unknown status "${body.status}". Allowed: ${SETTABLE_STATUSES.join(', ')}` });
      }
      patch.status = newStatus = body.status;
      if (body.status === 'completed') {
        const parsed = parseBracketsUsed(body.brackets_used);
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        if (body.plates_used != null && body.plates_used !== '') {
          const pn = Number(body.plates_used);
          if (!Number.isInteger(pn) || pn < 0 || pn > 50) return res.status(400).json({ error: 'Bad wire plate count.' });
          platesAnswer = pn;
        }
        if (parsed.value) {
          const { data: liNow } = await db.from('booking_line_items').select('name, quantity').eq('booking_id', id);
          const detected = detectBracketQtys(liNow || []);
          const pf = bracketPrefill(liNow || [], detected);
          if (pf.tv_count > 0) {
            const bad = checkBracketsUsed(parsed.value, pf.tv_count);
            if (bad) return res.status(400).json({ error: bad, code: 'bracket_confirm' });
            let sup = null;
            try {
              const { data: r, error: rErr } = await db.from('bookings')
                .select('bracket_supplied_by, technician_id').eq('id', id).maybeSingle();
              if (!rErr) sup = r;
            } catch (_) { /* pre-0035: fall back to assigned tech */ }
            const orig = sup?.bracket_supplied_by || sup?.technician_id || existing.technician_id || null;
            let supplier = orig;
            const u = parsed.value;
            const want = String(body.brackets_used.supplier || '');
            if (existing.secondary_technician_id && u.flat + u.tilting + u.full_motion > 0 && want
              && [existing.technician_id, existing.secondary_technician_id].includes(want)) {
              supplier = want;
              if (want !== sup?.bracket_supplied_by) { patch.bracket_supplied_by = want; patch.bracket_supplied_at = now; }
            }
            confirmedBrackets = { used: u, detected, supplier, orig };
          }
        } else if (existing.status !== 'completed') {
          const { data: liNow } = await db.from('booking_line_items').select('name, quantity').eq('booking_id', id);
          const pf = bracketPrefill(liNow || [], detectBracketQtys(liNow || []));
          if (pf.tv_count > 0) {
            const crewIds = [existing.technician_id, existing.secondary_technician_id].filter(Boolean);
            let exempt = crewIds.length > 0;
            for (const t of crewIds) if (!(await isInventoryExempt(db, t))) { exempt = false; break; }
            if (!exempt) return res.status(400).json({ error: 'Pick a bracket for each TV.', code: 'bracket_confirm' });
          }
        }
      }
      if (body.status === 'completed' && existing.status !== 'completed') patch.completed_at = now;
      break;
    case 'sms_consent':
      patch.sms_consent = body.value === true || body.value === 'true';
      break;
    default:
      return res.status(400).json({ error: `Unknown booking action "${body.action}"` });
  }

  if (body.action === 'reschedule' || body.action === 'assign') {
    const tz = await areaTimezone(db, await serviceAreaIdFromPostal(db, biz.id, existing.postal_code), biz.timezone || 'Asia/Manila');
    const effTech = ('technician_id' in patch) ? patch.technician_id : existing.technician_id;
    const effSecondTech = ('secondary_technician_id' in patch) ? patch.secondary_technician_id : existing.secondary_technician_id;
    if (effTech && effSecondTech && effTech === effSecondTech) {
      return res.status(400).json({ error: 'The two technicians must be different.' });
    }
    {
      const changedIds = [
        ('technician_id' in patch) && patch.technician_id !== existing.technician_id ? patch.technician_id : null,
        ('secondary_technician_id' in patch) && patch.secondary_technician_id !== existing.secondary_technician_id ? patch.secondary_technician_id : null,
      ];
      const mmArea = await serviceAreaIdFromPostal(db, biz.id, existing.postal_code);
      const mm = await crossMetroMismatch(db, mmArea, changedIds, body.confirm_cross_metro_ids);
      if (mm) {
        return res.status(409).json({
          code: 'cross_metro_confirm',
          tech_id: mm.techId,
          error: `${mm.techName} works ${mm.techMetro}, but this job is in ${mm.bookingMetro}. Assign ${mm.techName} anyway?`,
        });
      }
    }
    const effAt = patch.scheduled_at || existing.scheduled_at;
    if (effAt && (effTech || effSecondTech)) {
      const slotKey = slotKeyForLocalTime(localHHMM(tz, effAt));
      const effDate = localDateStr(tz, effAt);
      const forcedIds = new Set((body.force_unavailable_ids || []).map(String));
      if (!slotKey) {
        const uncheckedId = effTech && !forcedIds.has(String(effTech)) ? effTech
          : (effSecondTech && !forcedIds.has(String(effSecondTech)) ? effSecondTech : null);
        if (uncheckedId) {
          const { data: t } = await db.from('technicians').select('name').eq('id', uncheckedId).maybeSingle();
          return res.status(409).json({ error: `Couldn't verify ${t?.name || 'this technician'}'s schedule for this time — it doesn't line up with one of the standard time slots. Confirm to book anyway.`, code: 'tech_unavailable', tech_id: uncheckedId });
        }
      } else {
        const dow = dayOfWeekFor(effDate);
        if (effTech) {
          const taken = await bookedSlotKeysForTech(db, biz.id, effTech, effDate, tz, id);
          if (taken.has(slotKey)) {
            return res.status(409).json({ error: 'That technician is already booked for this time slot. Choose another time or technician.' });
          }
          if (!forcedIds.has(String(effTech))) {
            const keys = await singleTechSlotKeys(db, effTech, effDate, dow);
            if (!keys.has(slotKey)) {
              const { data: t } = await db.from('technicians').select('name').eq('id', effTech).maybeSingle();
              return res.status(409).json({ error: `${t?.name || 'This technician'} isn't scheduled to work that day/time — they may have requested it off. Pick another technician or time, or confirm to book anyway.`, code: 'tech_unavailable', tech_id: effTech });
            }
          }
        }
        if (effSecondTech) {
          const taken2 = await bookedSlotKeysForTech(db, biz.id, effSecondTech, effDate, tz, id);
          if (taken2.has(slotKey)) {
            return res.status(409).json({ error: 'The second cleaner is already booked for this time slot. Choose another time or technician.' });
          }
          if (!forcedIds.has(String(effSecondTech))) {
            const keys2 = await singleTechSlotKeys(db, effSecondTech, effDate, dow);
            if (!keys2.has(slotKey)) {
              const { data: t2 } = await db.from('technicians').select('name').eq('id', effSecondTech).maybeSingle();
              return res.status(409).json({ error: `${t2?.name || 'The second cleaner'} isn't scheduled to work that day/time — they may have requested it off. Pick another technician or time, or confirm to book anyway.`, code: 'tech_unavailable', tech_id: effSecondTech });
            }
          }
        }
      }
    }
  }

  const { error: e1 } = await db.from('bookings').update(patch).eq('id', id).eq('business_id', biz.id);
  if (e1) throw e1;

  if (body.action === 'sms_consent') {
    await db.from('booking_notes').insert({
      business_id: biz.id, booking_id: id,
      author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null, author_name: adminAuthorName(auth),
      body: `Texts turned ${patch.sms_consent ? 'ON' : 'OFF'} for this customer from the dashboard.`,
    }).then(({ error }) => { if (error) console.warn('[booking_update] consent note failed:', error.message); });
  }

  if (newStatus) {
    await db.from('booking_status_events').insert({
      booking_id: id, business_id: biz.id, technician_id: patch.technician_id ?? existing.technician_id,
      status: newStatus, note: `Set by ${auth.role} (dashboard)`,
    });

    if (newStatus === 'completed') await ensureReviewToken(db, existing);
    if (newStatus === 'completed' && existing.review_token) {
      const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const emailClickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(existing.review_token)}&ch=email`;
      const smsClickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(existing.review_token)}&ch=sms`;
      const smsStatusCallback = `${baseUrl}/api/analytics?action=sms_status&token=${encodeURIComponent(existing.review_token)}`;

      if (existing.customer?.email && !existing.metadata?.review_email_sent_at) {
        try {
          const brand = brandFor(biz.slug);
          const { subject, html } = reviewEmail({
            firstName: existing.customer.name || 'there',
            clickUrl: emailClickUrl,
          }, brand);
          const { from } = emailConfig(biz.slug);
          const emailResult = await sendEmail({ slug: biz.slug, to: existing.customer.email, subject, html, replyTo: from });

          if (emailResult.sent) {
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            const newMeta = { ...(cur?.metadata || existing.metadata || {}), review_email_sent_at: now };
            await db.from('bookings').update({ metadata: newMeta }).eq('id', id);
            try {
              await db.from('bookings').update({
                review_email_sent_at: now, review_email_count: 1,
                review_email_id: emailResult.id || null, review_email_status: 'sent',
              }).eq('id', id);
            } catch { /* column not applied yet */ }
            console.log(`[review] email sent to ${existing.customer.email} (${biz.slug}) booking=${id}`);
          }
        } catch (e) {
          console.error(`[review] email failed for booking ${id}:`, e.message);
        }
      }

      if (existing.customer?.phone && existing.sms_consent && !existing.metadata?.review_sms_sent_at) {
        try {
          const msg = reviewRequestSms({ slug: biz.slug, name: biz.name, token: existing.review_token, clickUrl: smsClickUrl, techName: await reviewTechName(db, { ...existing, technician_id: patch.technician_id ?? existing.technician_id }) });
          const smsResult = await sendSMSResult(existing.customer.phone, msg, { statusCallback: smsStatusCallback });
          await logAutomatedMessage(db, { businessId: biz.id, customerPhone: existing.customer.phone, body: msg, result: smsResult });
          if (smsResult.ok) {
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            await db.from('bookings').update({ metadata: { ...(cur?.metadata || existing.metadata || {}), review_sms_sent_at: now } }).eq('id', id);
            try { await db.from('bookings').update({ review_sms_sent_at: now, review_sms_status: 'sent' }).eq('id', id); } catch { /* column not applied yet */ }
            console.log(`[review] SMS sent (${biz.slug}) booking=${id}`);
          } else {
            console.warn(`[review] SMS NOT sent booking=${id}:`, smsResult.skipped || smsResult.error);
          }
        } catch (e) {
          console.error(`[review] SMS failed for booking ${id}:`, e.message);
        }
      } else if ((!existing.customer?.phone || !existing.sms_consent) && !existing.metadata?.review_sms_sent_at) {
        const why = existing.customer?.phone ? 'skipped_no_consent' : 'skipped_no_phone';
        console.log(`[review] SMS skipped (${why}) booking=${id}`);
        try { await db.from('bookings').update({ review_sms_status: why }).eq('id', id).is('review_sms_sent_at', null); } catch { /* column not applied yet */ }
      }
    }

    if (newStatus === 'completed' && (platesAnswer != null || !existing.metadata?.wire_plate_deducted_at)) {
      try {
        const { data: liRows } = await db.from('booking_line_items')
          .select('name, quantity').eq('booking_id', id);
        const ticket = detectWirePlateQty(liRows || []);
        const qty = platesAnswer != null ? platesAnswer : ticket;
        if (qty > 0 || platesAnswer != null) {
          let chargeTech = confirmedBrackets?.supplier || existing.technician_id || null;
          if (!confirmedBrackets) {
            try {
              const { data: sup } = await db.from('bookings')
                .select('bracket_supplied_by').eq('id', id).maybeSingle();
              if (sup?.bracket_supplied_by) chargeTech = sup.bracket_supplied_by;
            } catch (_) { /* pre-0035: assigned tech */ }
          }
          if (chargeTech) {
            const actor = `office:${auth.name || auth.role || 'office'}`;
            await applyPlatesForJob(db, {
              businessId: biz.id, bookingId: id, supplier: chargeTech, qty, actor,
              reason: platesAnswer != null ? 'job completion (office confirmed)' : 'job completion (office)',
            });
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            const newMeta = { ...(cur?.metadata || existing.metadata || {}), wire_plate_deducted_at: now,
              plates_used: { qty, supplier: chargeTech, ...(platesAnswer != null && { confirmed_by: actor, confirmed_at: now }) } };
            await db.from('bookings').update({ metadata: newMeta }).eq('id', id);
            if (platesAnswer != null && platesAnswer !== ticket) {
              await db.from('booking_notes').insert({
                business_id: biz.id, booking_id: id,
                author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null, author_name: adminAuthorName(auth),
                body: `Wire plates used: ${platesAnswer}. Ticket: ${ticket}.`,
              });
            }
          }
        }
      } catch (e) {
        console.error(`[wireplate] ledger charge failed for booking ${id}:`, e.message);
      }
    }

    if (newStatus === 'completed' && confirmedBrackets) {
      try {
        const u = confirmedBrackets.used;
        const qtys = { flat: u.flat, tilting: u.tilting, full_motion: u.full_motion };
        const supplier = confirmedBrackets.supplier;
        const actor = auth.name || auth.role || 'office';
        let legacy = null;
        if (supplier) ({ legacy } = await applyConfirmedBrackets(db, {
          businessId: biz.id, bookingId: id, supplier, qtys, actor,
          meta: existing.metadata, ticketQtys: confirmedBrackets.detected, fallbackSupplier: confirmedBrackets.orig,
        }));
        const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
        await db.from('bookings').update({
          metadata: { ...(cur?.metadata || existing.metadata || {}), ...(supplier && { bracket_deducted_at: now }),
            brackets_used: { ...qtys, own: u.own, supplier, confirmed_by: `office:${actor}`, confirmed_by_name: adminAuthorName(auth), confirmed_at: now, ...(legacy && { legacy }) } },
        }).eq('id', id);
        const note = bracketMismatchNote(u, confirmedBrackets.detected);
        if (note) {
          await db.from('booking_notes').insert({
            business_id: biz.id, booking_id: id,
            author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null, author_name: adminAuthorName(auth), body: note,
          });
        }
      } catch (e) {
        console.error(`[bracket] confirmed deduction failed for booking ${id}:`, e.message);
      }
    }

    else if (newStatus === 'completed' && !existing.metadata?.bracket_deducted_at) {
      try {
        const { data: liRows } = await db.from('booking_line_items')
          .select('name, quantity').eq('booking_id', id);
        const need = detectBracketQtys(liRows || []);
        if (bracketTotal(need) > 0) {
          let supplier = existing.technician_id || null;
          try {
            const { data: sup } = await db.from('bookings')
              .select('bracket_supplied_by, technician_id').eq('id', id).maybeSingle();
            supplier = sup?.bracket_supplied_by || sup?.technician_id || existing.technician_id || null;
          } catch (_) { /* pre-0035: fall back to assigned tech */ }
          if (supplier) {
            await debitForJob(db, {
              businessId: biz.id, technicianId: supplier, qtys: need, bookingId: id,
              reason: 'job completion (office)', actor: auth.name || auth.role || 'office',
            });
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            await db.from('bookings').update({
              metadata: { ...(cur?.metadata || existing.metadata || {}), bracket_deducted_at: now, brackets_used: { flat: need.flat || 0, tilting: need.tilting || 0, full_motion: need.full_motion || 0, supplier } },
            }).eq('id', id);
          } else {
            try {
              await db.from('bracket_usage_logs').insert({
                business_id: biz.id, booking_id: id, technician_id: null,
                flat_used: need.flat || 0, tilting_used: need.tilting || 0, full_motion_used: need.full_motion || 0,
                logged_by_kind: 'system',
                notes: 'job completion (office) — no supplier on file at completion; inventory NOT deducted, needs manual attribution',
              });
            } catch (e2) { console.error(`[bracket] unattributed log failed for booking ${id}:`, e2.message); }
          }
        }
      } catch (e) {
        console.error(`[bracket] decrement failed for booking ${id}:`, e.message);
      }
    }

    if (newStatus === 'completed' && !existing.metadata?.appletv_bracket_deducted_at) {
      try {
        const { data: liRows } = await db.from('booking_line_items')
          .select('name, quantity').eq('booking_id', id);
        const qty = detectAppleTvBracketQty(liRows || []);
        if (qty > 0) {
          let chargeTech = existing.technician_id || null;
          try {
            const { data: sup } = await db.from('bookings')
              .select('bracket_supplied_by').eq('id', id).maybeSingle();
            if (sup?.bracket_supplied_by) chargeTech = sup.bracket_supplied_by;
          } catch (_) { /* column may not exist; fall back to assigned tech */ }
          if (chargeTech) {
            await adjustAppleTvBracketInventory(db, biz.id, chargeTech, qty, id);
            const { data: cur } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
            await db.from('bookings').update({
              metadata: { ...(cur?.metadata || existing.metadata || {}), appletv_bracket_deducted_at: now },
            }).eq('id', id);
          }
        }
      } catch (e) {
        console.error(`[appletv_bracket] decrement failed for booking ${id}:`, e.message);
      }
    }
  }

  const notifyTz = (body.action === 'assign' || body.action === 'reschedule')
    ? await areaTimezone(db, await serviceAreaIdFromPostal(db, biz.id, existing.postal_code), biz.timezone || 'Asia/Manila')
    : (biz.timezone || 'Asia/Manila');
  if (body.action === 'assign' && patch.technician_id && patch.technician_id !== existing.technician_id) {
    await notifyTechAssigned(db, biz, patch.technician_id, existing.scheduled_at, notifyTz, { bookingId: id })
      .catch(e => console.error('[tech-notify]', e.message));
  }
  if (body.action === 'assign' && 'secondary_technician_id' in patch && patch.secondary_technician_id && patch.secondary_technician_id !== existing.secondary_technician_id) {
    await notifyTechAssigned(db, biz, patch.secondary_technician_id, existing.scheduled_at, notifyTz, { bookingId: id })
      .catch(e => console.error('[tech-notify]', e.message));
  }
  if (body.action === 'reschedule') {
    const primaryChanged = 'technician_id' in patch && (patch.technician_id || null) !== (existing.technician_id || null);
    if (primaryChanged) {
      if (existing.technician_id) {
        await notifyTechAssigned(db, biz, existing.technician_id, existing.scheduled_at, notifyTz, { bookingId: id, kind: 'unassigned' })
          .catch(e => console.error('[tech-notify]', e.message));
      }
      if (patch.technician_id) {
        await notifyTechAssigned(db, biz, patch.technician_id, patch.scheduled_at || existing.scheduled_at, notifyTz, { bookingId: id })
          .catch(e => console.error('[tech-notify]', e.message));
      }
    }
    if (patch.scheduled_at && patch.scheduled_at !== existing.scheduled_at) {
      const stillPrimary = primaryChanged ? null : existing.technician_id;
      for (const techId of [stillPrimary, existing.secondary_technician_id]) {
        if (!techId) continue;
        await notifyTechAssigned(db, biz, techId, patch.scheduled_at, notifyTz, { bookingId: id, kind: 'rescheduled' })
          .catch(e => console.error('[tech-notify]', e.message));
      }
      const cph = existing.customer?.phone;
      if (cph && body.notify_customer !== false) {
        try {
          const gate = await staffTextGate(db, cph, existing.sms_consent === true);
          if (gate.ok) {
            const when = new Date(patch.scheduled_at);
            const dateStr = when.toLocaleDateString('en-US', { timeZone: notifyTz, weekday: 'short', month: 'short', day: 'numeric' });
            const slot = SLOTS.find(sl => sl.key === slotKeyForLocalTime(localHHMM(notifyTz, patch.scheduled_at)));
            const tw = slot ? slot.label : when.toLocaleTimeString('en-US', { timeZone: notifyTz, hour: 'numeric', minute: '2-digit' });
            const msg = `Your appointment has moved. New time: ${dateStr} between ${tw}.`;
            const r = await sendSMSResult(cph, msg);
            await logAutomatedMessage(db, { businessId: biz.id, customerPhone: cph, body: msg, result: r });
          }
        } catch (e) { console.error('[reschedule] customer text failed:', e.message); }
      }
    }
    if (opts.techNote) {
      const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: notifyTz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'no time';
      await db.from('booking_notes').insert({
        business_id: biz.id, booking_id: id, author_kind: 'technician',
        author_id: opts.techNote.author_id, author_name: opts.techNote.author_name || 'Cleaner',
        body: `Rescheduled by ${opts.techNote.author_name || 'technician'} (${opts.actor}) in the cleaner app: ${fmt(existing.scheduled_at)} -> ${fmt(patch.scheduled_at)}.`,
      }).then(({ error }) => { if (error) console.warn('[tech_reschedule] note failed:', error.message); });
    }
  }
  return res.status(200).json({ ok: true });
}

function sanitizeBookingLineItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(it => {
    const name = ((it && (it.name != null ? it.name : it.label)) || '').toString().trim().slice(0, 300);
    const qty = Math.min(99, Math.max(1, Math.round(Number(it && it.quantity) || 1)));
    let unit;
    if (it && it.unit_price != null && Number.isFinite(Number(it.unit_price))) {
      unit = Number(it.unit_price);
    } else {
      const total = Number(it && (it.price != null ? it.price : it.line_total)) || 0;
      unit = qty > 0 ? total / qty : total;
    }
    unit = Math.round(unit * 100) / 100;
    const line_total = Math.round(unit * qty * 100) / 100;
    const kind = (it && it.kind) || 'service';
    const taxable = !(it && it.taxable === false);
    return { name, quantity: qty, unit_price: unit, line_total, kind, taxable };
  }).filter(it => it.name || it.unit_price);
}


async function bookingLineItemsSave(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data: existing, error: e0 } = await db.from('bookings')
    .select('id, metadata').eq('id', id).eq('business_id', biz.id).single();
  if (e0 || !existing) return res.status(404).json({ error: 'Booking not found' });

  const curRev = Number(existing.metadata?.li_rev) || 0;
  if (body.li_rev == null) {
    return res.status(409).json({
      error: 'This dashboard tab is out of date and could overwrite someone else\'s edit — refresh the page (Ctrl+R), reopen the job, and redo the change.',
      code: LI_CONFLICT_CODE,
    });
  }
  if (Number(body.li_rev) !== curRev) {
    return res.status(409).json({
      error: 'This ticket was changed by someone else (another office member or the cleaner) after you opened it. Close the job, reopen it to see the latest items, then redo your edit.',
      code: LI_CONFLICT_CODE,
    });
  }

  const items = canonicalizeLineItems(recalcTaxLine(sanitizeBookingLineItems(body.items)));

  if (body.confirm_high_price !== true) {
    const issue = priceSanityIssue({ lines: items });
    if (issue) return res.status(409).json({ error: issue, code: 'high_price_confirm_required' });
  }

  const { data: oldRows, error: oldErr } = await db.from('booking_line_items')
    .select('id, kind, name, quantity, unit_price, line_total, taxable')
    .eq('booking_id', id).eq('business_id', biz.id);
  if (oldErr) throw oldErr;

  if (!items.length && (oldRows || []).length && body.confirm_empty !== true) {
    return res.status(400).json({
      error: 'This would remove EVERY line item from the ticket. If that is really what you want, confirm it in the dialog.',
      code: 'confirm_empty_required',
    });
  }

  console.log(`[line_items] save booking=${id} by=${auth.name || auth.role || 'office'} before=${(oldRows || []).length} after=${items.length}`);

  const backups = Array.isArray(existing.metadata?.li_backups) ? existing.metadata.li_backups.slice() : [];
  backups.push({
    at: new Date().toISOString(), by: `office:${auth.name || auth.role || '?'}`,
    items: (oldRows || []).map(r => ({
      kind: r.kind, name: r.name, quantity: r.quantity,
      unit_price: r.unit_price, line_total: r.line_total, taxable: r.taxable,
    })),
  });
  let newRev;
  try {
    const cas = await casBumpLiRev(db, id, existing.metadata, { li_backups: backups.slice(-5) });
    if (!cas.ok) {
      return res.status(409).json({
        error: 'Someone else saved this ticket at the same moment. Close the job, reopen it to see the latest items, then redo your edit.',
        code: LI_CONFLICT_CODE,
      });
    }
    newRev = cas.rev;
  } catch (e) {
    console.error(`[line_items] li_rev CAS failed for booking ${id}:`, e.message);
    return res.status(500).json({ error: 'Could not lock the ticket for saving — try again in a moment.' });
  }

  if (items.length) {
    const rows = items.map((it, i) => ({
      booking_id: id, business_id: biz.id,
      kind: it.kind, name: it.name,
      quantity: it.quantity, unit_price: it.unit_price, line_total: it.line_total,
      taxable: it.taxable, sort_order: i,
    }));
    let { error: insErr } = await db.from('booking_line_items').insert(rows);
    if (insErr && /sort_order/.test(insErr.message || '')) {
      ({ error: insErr } = await db.from('booking_line_items').insert(rows.map(({ sort_order, ...r }) => r)));
    }
    if (insErr) throw insErr;
  }

  const oldIds = (oldRows || []).map(r => r.id);
  if (oldIds.length) {
    const { error: delErr } = await db.from('booking_line_items').delete().in('id', oldIds);
    if (delErr) {
      console.error(`[line_items] delete-after-insert failed for booking ${id} — ticket has duplicate rows, resave to fix:`, delErr.message);
      throw delErr;
    }
  }

  const price = Math.round(items.reduce((t, it) => t + it.line_total, 0) * 100) / 100;
  const subtotal = Math.round(items.reduce((t, it) => t + (isTaxLine(it) ? 0 : it.line_total), 0) * 100) / 100;
  const { error: upErr } = await db.from('bookings')
    .update({ price, subtotal }).eq('id', id).eq('business_id', biz.id);
  if (upErr) throw upErr;

  if (existing.metadata?.bracket_deducted_at && !existing.metadata?.brackets_used?.confirmed_at) {
    try {
      const oldQtys = detectBracketQtys(oldRows || []);
      const newQtys = detectBracketQtys(items);
      if (oldQtys.flat !== newQtys.flat || oldQtys.tilting !== newQtys.tilting || oldQtys.full_motion !== newQtys.full_motion) {
        let supplier = null;
        try {
          const { data: sup } = await db.from('bookings')
            .select('bracket_supplied_by, technician_id').eq('id', id).maybeSingle();
          supplier = sup?.bracket_supplied_by || sup?.technician_id || null;
        } catch (_) { /* pre-0035: bracket_supplied_by column absent */ }
        if (supplier) {
          if (!existing.metadata?.brackets_used?.legacy) {
            const { legacy } = await chargedSoFar(db, id, existing.metadata, { supplier, ticketQtys: oldQtys });
            if (legacy) {
              const { data: lm } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
              const m0 = lm?.metadata || existing.metadata || {};
              await db.from('bookings').update({ metadata: { ...m0, brackets_used: { ...(m0.brackets_used || {}), legacy } } }).eq('id', id);
            }
          }
          await reconcileJobEdit(db, {
            businessId: biz.id, technicianId: supplier, oldQtys, newQtys, bookingId: id, liRev: newRev,
            reason: 'line items edited after completion', actor: auth.name || auth.role || 'office',
          });
        } else {
          console.warn(`[bracket] line-item edit changed bracket qty on completed booking ${id} but no supplier on file — inventory NOT reconciled`);
        }
      }
    } catch (e) {
      console.error(`[bracket] reconcile-on-edit failed for booking ${id}:`, e.message);
    }
  }

  let sealedRev = null;
  try {
    const { data: freshRow } = await db.from('bookings').select('metadata').eq('id', id).maybeSingle();
    if (Number(freshRow?.metadata?.li_rev) === newRev) {
      const seal = await casBumpLiRev(db, id, freshRow.metadata);
      if (seal.ok) sealedRev = seal.rev;
    }
  } catch (e) { console.warn(`[line_items] seal bump failed for booking ${id}:`, e.message); }

  const removedNote = removedBracketNotes(body.removed_brackets);
  if (removedNote) {
    await db.from('booking_notes').insert({
      business_id: biz.id, booking_id: id,
      author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null, author_name: adminAuthorName(auth), body: removedNote,
    }).then(({ error }) => { if (error) console.warn('[line_items] bracket-removal note failed:', error.message); });
  }

  return res.status(200).json({ ok: true, price, subtotal, count: items.length,
    ...(sealedRev != null && { li_rev: sealedRev }) });
}

async function recanonicalizeBookingRows(db, bookingId) {
  try {
    const { data: rows, error } = await db.from('booking_line_items')
      .select('id, kind, name, quantity, line_total, taxable, sort_order')
      .eq('booking_id', bookingId).order('sort_order', { ascending: true });
    if (error) { if (!isSortOrderErr(error)) throw error; return; }
    const ordered = canonicalizeLineItems(rows || []);
    for (let i = 0; i < ordered.length; i++) {
      if (Number(ordered[i].sort_order) === i) continue;
      const { error: soErr } = await db.from('booking_line_items')
        .update({ sort_order: i }).eq('id', ordered[i].id);
      if (soErr) { console.warn(`[line_items] recanonicalize write failed for booking ${bookingId}:`, soErr.message); break; }
    }
  } catch (e) { console.warn(`[line_items] recanonicalize failed for booking ${bookingId}:`, e.message); }
}

async function bookingCardUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  const pmId = (body.payment_method_id || '').toString();
  if (!id || !pmId) return res.status(400).json({ error: 'id and payment_method_id required' });

  const cols = (withAcct) => `id, payment_status, ${withAcct ? 'stripe_account, ' : ''}customer:customers ( name, email, phone )`;
  let { data: b, error } = await db.from('bookings').select(cols(true)).eq('id', id).eq('business_id', biz.id).single();
  if (error && missingColumn(error.message) === 'stripe_account') {
    ({ data: b, error } = await db.from('bookings').select(cols(false)).eq('id', id).eq('business_id', biz.id).single());
  }
  if (error || !b) return res.status(404).json({ error: 'Booking not found' });
  if (b.payment_status === 'paid') return res.status(400).json({ error: 'This booking is already paid — the card cannot be changed.' });
  if (b.payment_status === 'charging') return res.status(409).json({ error: 'This booking is being charged right now — wait a moment and try again.' });

  const acct = { account: b.stripe_account || null, slug: biz.slug };
  if (!stripeConfigured(acct)) return res.status(400).json({ error: 'Payments are not configured for this business.' });

  let r;
  try {
    r = await saveCardOnFileAcct({
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
    .eq('id', id).eq('business_id', biz.id).eq('payment_status', b.payment_status).select('id').maybeSingle();
  if (upErr) throw upErr;
  if (!upRow) return res.status(409).json({ error: 'The payment state changed while saving the card (a charge may be in progress) — refresh the booking and try again.' });
  return res.status(200).json({ ok: true });
}

async function bookingCard(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const id = (req.query.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });

  const cols = (withAcct) => `id, ${withAcct ? 'stripe_account, ' : ''}stripe_customer_id, stripe_payment_method_id,
             customer:customers ( email, stripe_customer_id )`;
  let { data: b, error } = await db.from('bookings').select(cols(true)).eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (error && missingColumn(error.message) === 'stripe_account') {
    ({ data: b, error } = await db.from('bookings').select(cols(false)).eq('id', id).eq('business_id', biz.id).maybeSingle());
  }
  if (error || !b) return res.status(404).json({ error: 'Booking not found' });

  const acct = { account: b.stripe_account || null, slug: biz.slug };
  let custId = b.stripe_customer_id || (b.customer && b.customer.stripe_customer_id) || null;
  let pmId = b.stripe_payment_method_id || null;
  try {
    if (!custId && b.customer && b.customer.email) {
      const r = await findCardOnFileByEmail(b.customer.email, acct);
      custId = r.customerId; if (r.paymentMethodId) pmId = r.paymentMethodId;
    }
    if (custId && !pmId) pmId = await defaultPaymentMethod(custId, acct);
  } catch (_) { /* no card on file is a normal, common case */ }
  if (!pmId) return res.status(200).json({ has_card: false });

  let card = { brand: null, last4: null, customer: null };
  let lookupOk = false;
  try { card = await retrieveCard(pmId, acct); lookupOk = true; } catch (_) { /* Stripe hiccup — just show nothing */ }
  if (lookupOk && !card.customer) {
    let fallbackPm = null;
    try { if (custId) fallbackPm = await defaultPaymentMethod(custId, acct); } catch (_) { /* no card */ }
    if (!fallbackPm || fallbackPm === pmId) return res.status(200).json({ has_card: false });
    card = { brand: null, last4: null, customer: null };
    try { card = await retrieveCard(fallbackPm, acct); } catch (_) { /* Stripe hiccup */ }
    if (!card.customer) return res.status(200).json({ has_card: false });
  }
  if (!card.brand && !card.last4) return res.status(200).json({ has_card: false });
  return res.status(200).json({ has_card: true, brand: card.brand, last4: card.last4 });
}

async function bookingPayment(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const act = (body.action || 'charge').toString();
  const slug = biz.slug;

  const payCols = (withAcct) => `id, business_id, price, amount_paid, tip, metadata, payment_status, payment_method, updated_at, status, on_the_way_at, completed_at, ${withAcct ? 'stripe_account, ' : ''}stripe_customer_id, stripe_payment_method_id, stripe_payment_intent_id,
             customer:customers ( id, name, email, phone, stripe_customer_id )`;
  let { data: b, error } = await db.from('bookings').select(payCols(true)).eq('id', id).eq('business_id', biz.id).single();
  if (error && missingColumn(error.message) === 'stripe_account') {
    ({ data: b, error } = await db.from('bookings').select(payCols(false)).eq('id', id).eq('business_id', biz.id).single());
  }
  if (error || !b) return res.status(404).json({ error: 'Booking not found' });

  const acct = { account: b.stripe_account || null, slug };

  const now = new Date().toISOString();

  if (act === 'undo_cash') {
    const r = await revertCash(db, b, { who: adminAuthorName(auth), kind: 'office', reason: body.reason });
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
    return res.status(200).json(r);
  }
  if (act === 'mark_paid' || act === 'mark_unpaid') {
    if (act === 'mark_unpaid' && b.payment_status === 'paid' && b.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'This booking was paid by CARD (the charge is on file with Stripe). Marking it unpaid could lead to charging the customer twice — issue a refund instead.' });
    }
    if (b.payment_status === 'charging') {
      const lockAgeMs = Date.now() - new Date(b.updated_at || 0).getTime();
      if (lockAgeMs < 2 * 60 * 1000) {
        return res.status(409).json({ error: 'This booking is being charged right now — wait a moment and check whether the charge went through before marking it.' });
      }
    }
    let landed = null;
    if (act === 'mark_paid' && !b.stripe_payment_intent_id) landed = await findLandedCharge(id, acct);
    else if (act === 'mark_paid' && b.payment_status !== 'paid') {
      const pend = await pendingIntentState(b.stripe_payment_intent_id, acct);
      if (pend.state === 'processing') return res.status(409).json({ error: 'A card charge for this booking is still processing at the bank — wait a minute and check before marking it paid.' });
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
          warning: `This booking's card charge actually WENT THROUGH ($${landed.amount.toFixed(2)}) on an earlier attempt that looked like it failed. It's been recorded as a CARD payment — don't also collect cash.` });
      }
    }
    const patch = act === 'mark_paid'
      ? { payment_status: 'paid', paid_at: now, amount_paid: Number(b.price) || 0,
          ...(b.stripe_payment_intent_id && b.payment_status !== 'paid' ? { stripe_payment_intent_id: null } : {}) }
      : { payment_status: 'unpaid', paid_at: null };
    const { data: updated } = await db.from('bookings').update(patch)
      .eq('id', id).eq('payment_status', b.payment_status).select('id').maybeSingle();
    if (!updated) return res.status(409).json({ error: 'The payment state just changed (maybe a charge finished) — refresh and check before marking it.' });
    return res.status(200).json({ ok: true, payment_status: patch.payment_status });
  }

  if (act === 'refund_status' || act === 'refund') {
    if (!b.stripe_payment_intent_id) return res.status(400).json({ error: 'No Stripe charge on this booking to refund.' });
    let pi;
    try { pi = await stripe(`/payment_intents/${b.stripe_payment_intent_id}?expand[]=latest_charge`, { method: 'GET', ...acct }); }
    catch (e) { return res.status(e.status || 400).json({ error: 'Could not look up this charge on Stripe: ' + e.message }); }
    const charge = pi.latest_charge || null;
    if (!charge) return res.status(400).json({ error: 'No captured charge found for this booking — nothing to refund.' });
    const capturedCents = charge.amount;
    const refundedCents = charge.amount_refunded || 0;
    const remainingCents = capturedCents - refundedCents;

    if (act === 'refund_status') return res.status(200).json({ ok: true, remaining: remainingCents / 100 });

    if (remainingCents <= 0) return res.status(400).json({ error: 'This charge has already been fully refunded.' });
    if (body.amount == null) return res.status(400).json({ error: 'A refund amount is required.' });
    const requestedDollars = Number(body.amount);
    if (!requestedDollars || !isFinite(requestedDollars) || requestedDollars <= 0) return res.status(400).json({ error: 'Enter an amount greater than $0.' });
    const requestedCents = Math.round(Number((requestedDollars * 100).toFixed(2)));
    if (requestedCents <= 0) return res.status(400).json({ error: 'Enter an amount greater than $0.' });
    if (requestedCents > remainingCents) return res.status(400).json({ error: `Amount exceeds the refundable balance ($${(remainingCents / 100).toFixed(2)}).` });
    const idempotencyKey = `refund-${id}-${refundedCents}-${requestedCents}`;
    try { await stripe('/refunds', { idempotencyKey, body: { payment_intent: b.stripe_payment_intent_id, amount: requestedCents }, ...acct }); }
    catch (e) { return res.status(e.status || 400).json({ error: 'Refund failed: ' + e.message }); }
    const newRefundedCents = refundedCents + requestedCents;
    const amount_refunded = Math.round(newRefundedCents) / 100;
    const payment_status = newRefundedCents >= capturedCents ? 'refunded' : 'paid';
    const patch = amountRefundedCol ? { payment_status, amount_refunded } : { payment_status };
    const { error: updErr } = await db.from('bookings').update(patch).eq('id', id);
    if (updErr) {
      if (isAmountRefundedErr(updErr)) {
        amountRefundedCol = false;
        const { error: fallbackErr } = await db.from('bookings').update({ payment_status }).eq('id', id);
        if (fallbackErr) return res.status(200).json({ ok: true, payment_status, amount_refunded, warning: `Refund succeeded on Stripe ($${(requestedCents / 100).toFixed(2)}), but saving it to the booking failed: ${fallbackErr.message}. Please reconcile manually.` });
        return res.status(200).json({ ok: true, payment_status, amount_refunded, warning: 'Refund succeeded, but the running refunded-total could not be saved yet — run migration 0061, then it will track correctly on the next refund.' });
      }
      return res.status(200).json({ ok: true, payment_status, amount_refunded, warning: `Refund succeeded on Stripe ($${(requestedCents / 100).toFixed(2)}), but saving it to the booking failed: ${updErr.message}. Please reconcile manually.` });
    }
    return res.status(200).json({ ok: true, payment_status, amount_refunded, remaining: (capturedCents - newRefundedCents) / 100 });
  }

  if (act === 'balance_status' || act === 'charge_balance' || act === 'balance_cash') {
    return balanceAction({ req, res, db, biz, auth, b, acct, id, body, act, now });
  }

  if (act !== 'charge') return res.status(400).json({ error: `Unknown payment action "${act}"` });
  if (!stripeConfigured(acct)) return res.status(400).json({ error: 'Payments are not configured for this business. Use “Mark paid (cash)”.' });
  if (b.payment_status === 'paid') return res.status(400).json({ error: 'This booking is already paid.' });
  if (auth.role !== 'owner' && !(b.status === 'completed' || b.completed_at || b.on_the_way_at)) {
    return res.status(403).json({ error: 'No charging before the job. If they want to prepay, use Send invoice: they pay with their own card.' });
  }
  if (await isScammer({ phone: b.customer && b.customer.phone, email: b.customer && b.customer.email }, db)) return res.status(403).json({ error: 'SCAMMER: do not charge this customer.', scammer: true });

  let priorPaymentStatus;
  {
    const { data: fresh } = await db.from('bookings').select('payment_status').eq('id', id).eq('business_id', biz.id).maybeSingle();
    if (!fresh) return res.status(404).json({ error: 'Booking not found' });
    if (fresh.payment_status === 'paid') return res.status(400).json({ error: 'This booking is already paid.' });
    if (fresh.payment_status === 'charging') {
      return res.status(409).json({ error: 'This booking is already being charged (maybe from the cleaner app) — check if it went through before trying again.' });
    }
    priorPaymentStatus = fresh.payment_status;
    const { data: locked, error: lockErr } = await db.from('bookings')
      .update({ payment_status: 'charging' })
      .eq('id', id).eq('business_id', biz.id).eq('payment_status', priorPaymentStatus)
      .select('id').maybeSingle();
    if (lockErr) throw lockErr;
    if (!locked) {
      return res.status(409).json({ error: 'This booking is already being charged (maybe from the cleaner app) — check if it went through before trying again.' });
    }
  }

  try {
    const adoptLanded = async (landed) => {
      const patch = { payment_status: 'paid', paid_at: now, amount_paid: landed.amount, tip: landed.tip, stripe_payment_intent_id: landed.id };
      if (landed.customerId) patch.stripe_customer_id = landed.customerId;
      if (landed.paymentMethodId) patch.stripe_payment_method_id = landed.paymentMethodId;
      let { error: recErr } = await db.from('bookings').update(patch).eq('id', id);
      if (recErr) ({ error: recErr } = await db.from('bookings').update(patch).eq('id', id));
      if (recErr) { await db.from('bookings').update({ payment_status: 'paid' }).eq('id', id); console.error('[admin charge] CRITICAL: landed-charge adopt write failed', { booking: id, pi: landed.id, err: recErr.message }); }
      return res.status(200).json({ ok: true, payment_status: 'paid', amount: landed.amount, tip: landed.tip, payment_intent_id: landed.id, recovered: true,
        warning: `This booking was ALREADY charged $${landed.amount.toFixed(2)} on an earlier attempt that looked like it failed. No new charge was made.` });
    };
    if (!b.stripe_payment_intent_id) {
      const landed = await findLandedCharge(id, acct);
      if (landed) return adoptLanded(landed);
    }

    const ticketAmount = body.amount != null ? Number(body.amount) : Number(b.price);
    if (!ticketAmount || ticketAmount <= 0) { const e = new Error('Enter an amount greater than $0.'); e.status = 400; throw e; }
    if (body.confirm_high_price !== true) {
      const issue = priceSanityIssue({ total: ticketAmount });
      if (issue) { const e = new Error(issue); e.status = 409; e.code = 'high_price_confirm_required'; throw e; }
    }
    const tip = Math.max(0, Math.round((Number(body.tip) || 0) * 100) / 100);
    if (tip > ticketAmount) { const e = new Error(`Tip ($${tip.toFixed(2)}) can't be more than the amount charged ($${ticketAmount.toFixed(2)}).`); e.status = 400; throw e; }
    const dollars = Math.round((ticketAmount + tip) * 100) / 100;

    let custId = b.stripe_customer_id || (b.customer && b.customer.stripe_customer_id) || null;
    let pmId = b.stripe_payment_method_id || null;
    try {
      if (!custId && b.customer && b.customer.email) {
        const r = await findCardOnFileByEmail(b.customer.email, acct);
        custId = r.customerId; if (r.paymentMethodId) pmId = r.paymentMethodId;
      }
      if (custId && !pmId) pmId = await defaultPaymentMethod(custId, acct);
    } catch (e) { e.status = e.status || 400; throw e; }
    if (!custId || !pmId) { const e = new Error('No card on file for this customer. Use “Mark paid (cash)” instead.'); e.status = 400; throw e; }

    const resolved = await resolveChargeablePm({ customerId: custId, paymentMethodId: pmId, ...acct });
    if (!resolved.pmId) { const e = new Error('No card on file for this customer. Use “Mark paid (cash)” instead.'); e.status = 400; throw e; }
    pmId = resolved.pmId;
    const card = resolved.card;

    let pi, recovered;
    try {
      ({ pi, recovered } = await chargeCardOnFile({
        bookingId: id, cents: Math.round(dollars * 100), tip,
        customerId: custId, paymentMethodId: pmId,
        receiptEmail: (b.customer && b.customer.email) || null,
        businessSlug: biz.slug, priorPiId: b.stripe_payment_intent_id || null,
        ...acct, log: '[admin charge]',
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
      payment_status: 'paid', paid_at: now, amount_paid: dollars, tip,
      stripe_payment_intent_id: pi.id, stripe_customer_id: custId, stripe_payment_method_id: pmId,
    };
    let { error: payErr } = await db.from('bookings').update(paidPatch).eq('id', id);
    if (payErr) ({ error: payErr } = await db.from('bookings').update(paidPatch).eq('id', id));
    if (payErr) {
      const { error: fbErr } = await db.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
      console.error('[admin charge] CRITICAL: Stripe charge succeeded but booking update failed', { booking: id, pi: pi.id, err: payErr.message, minimal_write_ok: !fbErr });
      return res.status(200).json({ ok: true, payment_status: 'paid', amount: dollars, tip, payment_intent_id: pi.id,
        warning: `The charge WENT THROUGH on Stripe ($${dollars.toFixed(2)}, intent ${pi.id}), but saving it to the booking failed: ${payErr.message}. Do NOT charge again — reconcile manually.` });
    }

    await saveAuthorization(db, req, { ...b, business_id: biz.id }, { businessId: biz.id, total: dollars, ticketAmount, tip, card, pi, chargeId, body });

    return res.status(200).json({ ok: true, payment_status: 'paid', amount: dollars, tip, payment_intent_id: pi.id });
  } catch (e) {
    try { await db.from('bookings').update({ payment_status: priorPaymentStatus, ...(e.payment_intent_id ? { stripe_payment_intent_id: e.payment_intent_id } : {}) }).eq('id', id).eq('payment_status', 'charging'); } catch (_) { /* best-effort */ }
    const payload = { error: e.message };
    if (e.code) payload.code = e.code;
    if (e.decline_code) payload.decline_code = e.decline_code;
    if (e.needs_new_card) payload.needs_new_card = true;
    return res.status(e.status || 500).json(payload);
  }
}

async function balanceDueFor(b, acct) {
  const priceCents = Math.round((Number(b.price) || 0) * 100);
  const paid = Number(b.amount_paid) || 0;
  if (paid <= 0.005) { const e = new Error('No paid amount is recorded on this booking, so the balance cannot be worked out. Use Send invoice.'); e.status = 400; throw e; }
  let tipIn = 0;
  if (b.stripe_payment_intent_id) {
    let pi;
    try { pi = await stripe(`/payment_intents/${b.stripe_payment_intent_id}`, { method: 'GET', ...acct }); }
    catch (er) { const e = new Error('Could not check the earlier payment on Stripe: ' + er.message); e.status = er.status || 502; throw e; }
    if (pi.status !== 'succeeded') { const e = new Error('The earlier card payment is not confirmed on Stripe. Check Stripe before charging.'); e.status = 409; throw e; }
    tipIn = Math.min(Number(pi.metadata && pi.metadata.tip) || 0, paid);
  }
  const ticketPaidCents = Math.round((paid - tipIn) * 100);
  const dueCents = priceCents - ticketPaidCents;
  if (dueCents >= priceCents) { const e = new Error('Nothing recorded as paid on the ticket, so the balance cannot be worked out. Use Send invoice.'); e.status = 400; throw e; }
  return { dueCents: Math.max(0, dueCents), priceCents };
}

async function balanceAction({ req, res, db, biz, auth, b, acct, id, body, act, now }) {
  const fail = (status, error, extra = {}) => res.status(status).json({ error, ...extra });
  if (b.payment_status !== 'paid') return fail(400, 'Only a paid booking has a balance. Use Charge card.');
  if (act === 'charge_balance') {
    if (auth.role !== 'owner' && !(b.status === 'completed' || b.completed_at || b.on_the_way_at)) return fail(403, 'No charging before the job. Use Send pay link: they pay with their own card.');
    if (await isScammer({ phone: b.customer && b.customer.phone, email: b.customer && b.customer.email }, db)) return fail(403, 'SCAMMER: do not charge this customer.', { scammer: true });
  }
  const curRev = Number(b.metadata && b.metadata.li_rev) || 0;
  if (act !== 'balance_status' && (body.li_rev == null || Number(body.li_rev) !== curRev)) {
    return fail(409, 'This ticket changed after you opened it. Close the job, reopen it, and try again.', { code: LI_CONFLICT_CODE });
  }
  let due;
  try { due = await balanceDueFor(b, acct); } catch (e) { return fail(e.status || 400, e.message); }
  if (due.dueCents <= 0) return fail(400, 'No balance is owed on this booking.');
  const dueDollars = due.dueCents / 100;
  const extras = Array.isArray(b.metadata && b.metadata.extra_payments) ? b.metadata.extra_payments : [];

  let custId = b.stripe_customer_id || (b.customer && b.customer.stripe_customer_id) || null;
  let pmId = b.stripe_payment_method_id || null;
  let card = null, cardErr = null;
  if (act !== 'balance_cash' && stripeConfigured(acct)) {
    try {
      if (!custId && b.customer && b.customer.email) {
        const r = await findCardOnFileByEmail(b.customer.email, acct);
        custId = r.customerId; if (r.paymentMethodId) pmId = r.paymentMethodId;
      }
      if (custId && !pmId) pmId = await defaultPaymentMethod(custId, acct);
      if (custId && pmId) {
        const resolved = await resolveChargeablePm({ customerId: custId, paymentMethodId: pmId, ...acct });
        pmId = resolved.pmId; card = resolved.card;
      }
    } catch (e) { cardErr = e.message; pmId = null; }
  }
  if (act === 'balance_status') {
    return res.status(200).json({ ok: true, due: dueDollars, has_card: !!(custId && pmId), brand: (card && card.brand) || null, last4: (card && card.last4) || null, card_error: cardErr || undefined });
  }
  if (Number(body.expected_cents) !== due.dueCents) {
    return fail(409, `The balance is now $${dueDollars.toFixed(2)}. Reopen the job and check it.`, { due: dueDollars });
  }
  if (act === 'charge_balance') {
    if (!stripeConfigured(acct)) return fail(400, 'Payments are not configured for this business. Use Send invoice or Cash.');
    if (!custId || !pmId) return fail(400, 'No card on file for this customer. Use Send invoice.');
  }

  const { data: locked, error: lockErr } = await db.from('bookings').update({ payment_status: 'charging' })
    .eq('id', id).eq('business_id', biz.id).eq('payment_status', 'paid').select('id').maybeSingle();
  if (lockErr) return fail(500, lockErr.message);
  if (!locked) return fail(409, 'This booking is already being charged — check whether it went through before trying again.');

  const unlock = async () => { try { await db.from('bookings').update({ payment_status: 'paid' }).eq('id', id).eq('payment_status', 'charging'); } catch (_) { /* best-effort */ } };
  try {
    let piId = null, method = 'cash';
    if (act === 'charge_balance') {
      method = 'card';
      let pi;
      try {
        ({ pi } = await chargeCardOnFile({
          bookingId: id, cents: due.dueCents, tip: 0, customerId: custId, paymentMethodId: pmId,
          receiptEmail: (b.customer && b.customer.email) || null, businessSlug: biz.slug,
          priorPiId: null, balanceKey: `${extras.length}-${Math.round((Number(b.amount_paid) || 0) * 100)}`,
          ...acct, log: '[admin balance]',
        }));
      } catch (e) { e.status = e.status || 402; e.message = 'Charge failed: ' + e.message; throw e; }
      if (pi.id === b.stripe_payment_intent_id) { const e = new Error('Stripe returned the original payment, not a new one. Nothing was charged; check Stripe.'); e.status = 409; throw e; }
      if (pi.status !== 'succeeded') { const e = new Error(`Charge not completed (status: ${pi.status}).`); e.status = 402; throw e; }
      if (Number(pi.amount) !== due.dueCents) { const e = new Error(`Stripe shows $${(Number(pi.amount) / 100).toFixed(2)} for this charge, not $${dueDollars.toFixed(2)}. Check Stripe.`); e.status = 409; throw e; }
      piId = pi.id;
      if (extras.some(x => x && x.pi === piId)) { await unlock(); return res.status(200).json({ ok: true, payment_status: 'paid', amount: dueDollars, warning: 'This balance was already recorded. No new charge was made.' }); }
    }
    const record = async () => {
      const { data: cur } = await db.from('bookings').select('metadata, amount_paid').eq('id', id).maybeSingle();
      const meta = { ...((cur && cur.metadata) || {}) };
      meta.extra_payments = [...(Array.isArray(meta.extra_payments) ? meta.extra_payments : []),
        { pi: piId, amount: dueDollars, method, at: now, by: (auth && (auth.name || auth.role)) || null }];
      return db.from('bookings').update({
        payment_status: 'paid', paid_at: now,
        amount_paid: Math.round(((Number(cur && cur.amount_paid) || 0) + dueDollars) * 100) / 100,
        metadata: meta,
      }).eq('id', id);
    };
    let { error: recErr } = await record();
    if (recErr) ({ error: recErr } = await record());
    if (recErr) {
      await db.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
      console.error('[admin balance] CRITICAL: balance collected but booking update failed', { booking: id, pi: piId, err: recErr.message });
      return res.status(200).json({ ok: true, payment_status: 'paid', amount: dueDollars,
        warning: `The $${dueDollars.toFixed(2)} was collected${piId ? ` (Stripe ${piId})` : ''}, but saving it failed: ${recErr.message}. Do NOT collect again. Tell the owner.` });
    }
    try {
      await db.from('booking_notes').insert({ booking_id: id, business_id: biz.id,
        body: `Balance $${dueDollars.toFixed(2)} collected (${method})`,
        author_kind: 'owner', author_id: null, author_name: (auth && auth.name) || 'Office' });
    } catch (_) { /* best-effort */ }
    return res.status(200).json({ ok: true, payment_status: 'paid', amount: dueDollars, payment_intent_id: piId });
  } catch (e) {
    await unlock();
    const payload = { error: e.message };
    if (e.code) payload.code = e.code;
    if (e.needs_new_card) payload.needs_new_card = true;
    return res.status(e.status || 500).json(payload);
  }
}

async function bookingAddressUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data: existing } = await db.from('bookings')
    .select('id, postal_code').eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Booking not found' });

  const str = (v) => (v == null ? '' : String(v).trim());
  const patch = {
    address_line1: str(body.address_line1) || null,
    address_line2: str(body.address_line2) || null,
    city: str(body.city) || null,
    state: str(body.state).toUpperCase() || null,
    postal_code: str(body.postal_code) || null,
  };
  if (patch.postal_code && patch.postal_code !== existing.postal_code) {
    const areaId = await serviceAreaIdFromPostal(db, biz.id, patch.postal_code);
    if (areaId) patch.service_area_id = areaId;
  }

  const { error } = await db.from('bookings').update(patch).eq('id', id).eq('business_id', biz.id);
  if (error) return res.status(500).json({ error: error.message });
  const address = [patch.address_line1, patch.city, patch.state, patch.postal_code].filter(Boolean).join(', ');
  return res.status(200).json({ ok: true, address, ...patch });
}

async function bookingAuthorization(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const id = (req.query.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const cols = 'id, signature_url, customer_name, card_brand, card_last4, amount, ticket_amount, tip, terms_text, terms_version, signed_ip, signed_user_agent, signed_at, created_at';
  const { data, error } = await db.from('booking_authorizations')
    .select(cols).eq('business_id', biz.id).eq('booking_id', id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (/relation|does not exist|booking_authorizations/i.test(error.message || '')) {
      return res.status(200).json({ authorization: null, table_missing: true });
    }
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ authorization: data || null });
}

function candidateAccounts(slug) {
  if (slug === 'doms') return ['doms'];
  if (slug === 'tidyhaus') return ['global', 'tidyhaus'];
  if (slug === 'mile-high') return ['mile-high'];
  if (slug === 'austin') return ['austin'];
  if (slug === 'precision') return ['precision'];
  if (slug === 'atxmountpros' || slug === 'atxtvmount' || slug === 'austinmountingpros' || slug === 'austintvinstall') return ['austin'];
  if (slug === 'a1tvmounting') return ['a1tvmounting'];
  return ['global'];
}

async function fetchAsBase64(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length ? b.toString('base64') : null;
  } catch (_) { return null; }
}

async function disputes(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const accounts = candidateAccounts(biz.slug).filter(a => businessSecretKey({ account: a }));
  if (!accounts.length) return res.status(200).json({ disputes: [], configured: false });

  const raw = [];
  for (const account of accounts) {
    try { for (const d of await listOpenDisputes({ account })) if (!raw.some((x) => x.d.id === d.id)) raw.push({ d, account }); }
    catch (_) { /* one account erroring must not hide the others */ }
  }
  if (!raw.length) return res.status(200).json({ disputes: [], configured: true });

  const piOf = ({ d }) => d.payment_intent || (d.charge && d.charge.payment_intent) || null;
  const pis = [...new Set(raw.map(piOf).filter(Boolean))];
  const authByPi = new Map();
  if (pis.length) {
    const { data: auths } = await db.from('booking_authorizations')
      .select('*').eq('business_id', biz.id).in('stripe_payment_intent_id', pis);
    for (const a of auths || []) authByPi.set(a.stripe_payment_intent_id, a);
  }

  const out = [];
  for (const item of raw) {
    const { d, account } = item;
    const pi = piOf(item);
    const a0 = pi ? authByPi.get(pi) : null;
    let photosCount = 0;
    if (a0) {
      const { count } = await db.from('booking_photos')
        .select('id', { count: 'exact', head: true }).eq('booking_id', a0.booking_id);
      photosCount = count || 0;
    }
    out.push({
      id: d.id, account, amount: (d.amount || 0) / 100, currency: d.currency,
      reason: d.reason, status: d.status,
      due_by: (d.evidence_details && d.evidence_details.due_by) ? d.evidence_details.due_by * 1000 : null,
      payment_intent: pi, matched: !!a0,
      booking_id: a0 ? a0.booking_id : null,
      customer_name: a0 ? a0.customer_name : null,
      signed_at: a0 ? a0.signed_at : null,
      signed_ip: a0 ? a0.signed_ip : null,
      card_last4: a0 ? a0.card_last4 : null,
      has_signature: !!(a0 && a0.signature_url),
      signature_url: a0 ? a0.signature_url : null,
      photos_count: photosCount,
    });
  }
  out.sort((x, y) => (x.due_by || Infinity) - (y.due_by || Infinity));
  return res.status(200).json({ disputes: out, configured: true });
}

async function disputeDetail(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only.' });
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const id = String(req.query.id || ''); const account = String(req.query.account || '');
  if (!id || !candidateAccounts(biz.slug).includes(account)) return res.status(400).json({ error: 'id and a valid account are required.' });
  const sel = { method: 'GET', account };
  const d = await stripe(`/disputes/${id}?expand[]=charge&expand[]=payment_intent`, sel);
  const ch = d.charge || {}; const card = (ch.payment_method_details && ch.payment_method_details.card) || {};
  const efw = await stripe(`/radar/early_fraud_warnings?charge=${ch.id}`, sel).catch(() => null);
  const prior = ch.customer ? await stripe(`/charges?customer=${ch.customer}&limit=20`, sel).catch(() => null) : null;
  return res.status(200).json({
    dispute: { id: d.id, amount: d.amount / 100, reason: d.reason, status: d.status, network_reason_code: d.network_reason_code || (d.payment_method_details && d.payment_method_details.card && d.payment_method_details.card.network_reason_code) || null,
      card_dispute_type: d.payment_method_details && d.payment_method_details.card && d.payment_method_details.card.case_type || null,
      created: d.created, due_by: d.evidence_details && d.evidence_details.due_by, has_evidence: d.evidence_details && d.evidence_details.has_evidence,
      submission_count: d.evidence_details && d.evidence_details.submission_count, enhanced_eligibility: d.evidence_details && d.evidence_details.enhanced_eligibility || null,
      is_charge_refundable: d.is_charge_refundable, balance_transactions: (d.balance_transactions || []).map((b) => ({ amount: b.amount / 100, fee: b.fee / 100, type: b.type, description: b.description })),
      evidence_on_file: Object.fromEntries(Object.entries(d.evidence || {}).filter(([, v]) => v)) },
    charge: { id: ch.id, created: ch.created, amount: ch.amount / 100, description: ch.description, statement_descriptor: ch.calculated_statement_descriptor || ch.statement_descriptor || null,
      billing_details: ch.billing_details ? { name: ch.billing_details.name, email: ch.billing_details.email, postal_code: ch.billing_details.address && ch.billing_details.address.postal_code, line1: ch.billing_details.address && ch.billing_details.address.line1 } : null,
      outcome: ch.outcome ? { network_status: ch.outcome.network_status, risk_level: ch.outcome.risk_level, risk_score: ch.outcome.risk_score, seller_message: ch.outcome.seller_message, type: ch.outcome.type } : null,
      card: { brand: card.brand, last4: card.last4, funding: card.funding, country: card.country, exp: card.exp_month ? `${card.exp_month}/${card.exp_year}` : null, checks: card.checks || null, wallet: card.wallet ? card.wallet.type : null,
        three_d_secure: card.three_d_secure || null, network: card.network, network_transaction_id: card.network_transaction_id || null, fingerprint_present: !!card.fingerprint, issuer: card.issuer || null, description: card.description || null, moto: card.moto || null } },
    early_fraud_warnings: efw && efw.data ? efw.data.map((w) => ({ fraud_type: w.fraud_type, created: w.created, actionable: w.actionable })) : null,
    customer_charges: prior && prior.data ? prior.data.map((c) => ({ id: c.id, created: c.created, amount: c.amount / 100, status: c.status, disputed: c.disputed, refunded: c.refunded })) : null,
  });
}

function jpegDims(b) {
  if (!(b && b[0] === 0xFF && b[1] === 0xD8)) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), c: b[i + 9] };
    i += 2 + len;
  }
  return null;
}
function buildPdf(pages) {
  const W = 612, H = 792, M = 54, LEAD = 15, PER = Math.floor((H - 2 * M) / LEAD);
  const ascii = (t) => String(t || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u00D7/g, 'x').replace(/[^\x20-\x7E]/g, '');
  const wrap = (t, n = 92) => { const out = []; let line = ''; for (const w of ascii(t).split(/\s+/)) { if ((line + ' ' + w).trim().length > n) { if (line) out.push(line); line = w; } else line = (line + ' ' + w).trim(); } out.push(line); return out; };
  const flat = [];
  for (const p of pages) {
    if (p.lines) {
      const ls = []; for (const l of p.lines) { const lead = /^\s+/.exec(l); const pad = lead ? lead[0] : ''; ls.push(...(l === '' ? [''] : wrap(l, 92 - pad.length).map((x) => pad + x))); }
      for (let k = 0; k < ls.length; k += PER) flat.push({ lines: ls.slice(k, k + PER) });
    } else if (p.jpeg) { const d = jpegDims(p.jpeg); if (d && d.w && d.h) flat.push({ jpeg: p.jpeg, d }); }
  }
  if (!flat.length) return null;
  const parts = []; const offs = []; let len = 0;
  const push = (x) => { const buf = Buffer.isBuffer(x) ? x : Buffer.from(x, 'latin1'); parts.push(buf); len += buf.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); for (const q of [].concat(body)) push(q); push('\nendobj\n'); };
  push('%PDF-1.4\n');
  const kids = flat.map((_, k) => `${4 + k * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${flat.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  flat.forEach((p, k) => {
    const pg = 4 + k * 3, xo = pg + 1, ct = pg + 2;
    if (p.lines) {
      const esc = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      const body = `BT /F1 11 Tf ${LEAD} TL ${M} ${H - M} Td ` + p.lines.map((l) => `(${esc(l)}) Tj T*`).join(' ') + ' ET';
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${ct} 0 R >>`);
      obj(xo, '<< >>');
      obj(ct, `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`);
    } else {
      const { d, jpeg } = p; const sc = Math.min((W - 40) / d.w, (H - 40) / d.h);
      const w = Math.round(d.w * sc), h = Math.round(d.h * sc), x = Math.round((W - w) / 2), y = Math.round((H - h) / 2);
      const cs = d.c === 1 ? '/DeviceGray' : d.c === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      const draw = `q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`;
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${xo} 0 R >> >> /Contents ${ct} 0 R >>`);
      obj(xo, [`<< /Type /XObject /Subtype /Image /Width ${d.w} /Height ${d.h} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']);
      obj(ct, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    }
  });
  const total = 4 + flat.length * 3; const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return { pdf: Buffer.concat(parts), pages: flat.length };
}

async function disputeSubmit(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can submit dispute evidence.' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const disputeId = (body.dispute_id || '').toString();
  const account = (body.account || '').toString();
  const pi = (body.payment_intent || '').toString();
  if (!disputeId || !account || !pi) return res.status(400).json({ error: 'dispute_id, account and payment_intent are required.' });
  if (!candidateAccounts(biz.slug).includes(account)) return res.status(400).json({ error: 'That Stripe account is not owned by this business.' });

  const { data: a0 } = await db.from('booking_authorizations')
    .select('*').eq('business_id', biz.id).eq('stripe_payment_intent_id', pi).maybeSingle();
  if (!a0) return res.status(404).json({ error: 'No signed authorization is stored for this charge — submit the evidence manually in Stripe.' });

  const { data: booking } = await db.from('bookings')
    .select('id, source, created_at, scheduled_at, on_the_way_at, arrived_at, completed_at, confirmation_email_sent_at, on_the_way_sms_sent_at, on_the_way_sms_delivered_at, review_sms_delivered_at, review_call_at, review_call_status, address_line1, city, state, postal_code, customer:customers ( name, email, phone ), technician:technicians!technician_id ( name )')
    .eq('id', a0.booking_id).eq('business_id', biz.id).maybeSingle();
  const { data: photos } = await db.from('booking_photos')
    .select('url').eq('booking_id', a0.booking_id).eq('business_id', biz.id).order('created_at', { ascending: true }).limit(20);

  const photoUrls = (photos || []).map((p) => p.url).filter(Boolean);
  const facts = { calls: [], inbound_texts: [], outbound_texts: [], brand_name: biz.name, technician_name: booking?.technician?.name || null,
    followup_call_at: booking?.review_call_at || null, followup_call_status: booking?.review_call_status || null };
  const ph = String(booking?.customer?.phone || '').replace(/\D/g, '').slice(-10);
  if (ph.length === 10 && booking?.created_at) {
    const t0 = new Date(new Date(booking.created_at).getTime() - 3 * 864e5).toISOString();
    const t1 = new Date(new Date(booking.created_at).getTime() + 30 * 864e5).toISOString();
    const [{ data: cs }, { data: ms }] = await Promise.all([
      db.from('calls').select('occurred_at, duration_sec, transcript_summary').ilike('caller_phone', '%' + ph).in('kind', ['inbound', 'live']).gte('occurred_at', t0).lte('occurred_at', t1).gt('duration_sec', 30).order('occurred_at').limit(5),
      db.from('messages').select('created_at, body, direction, status').ilike('customer_phone', '%' + ph).gte('created_at', t0).lte('created_at', t1).order('created_at').limit(20),
    ]);
    facts.calls = cs || [];
    facts.inbound_texts = (ms || []).filter((m) => m.direction === 'in' || m.direction === 'inbound');
    facts.outbound_texts = (ms || []).filter((m) => m.direction === 'out' || m.direction === 'outbound');
  }
  const sel = { account };
  if (a0.stripe_charge_id) {
    try { const ch = await stripe(`/charges/${a0.stripe_charge_id}`, { method: 'GET', account }); facts.card_checks = ch && ch.payment_method_details && ch.payment_method_details.card && ch.payment_method_details.card.checks || null; } catch (_) { /* optional */ }
  }

  const jpgs = []; let bytes = 0;
  for (const u of photoUrls) {
    if (jpgs.length >= 12) break;
    try { const b64 = await fetchAsBase64(u); if (!b64) continue; const buf = Buffer.from(b64, 'base64'); if (!jpegDims(buf) || bytes + buf.length > 3.4 * 1024 * 1024) continue; jpgs.push(buf); bytes += buf.length; } catch (_) { /* skip */ }
  }
  facts.photo_count = jpgs.length;

  const { evidence, narrative, in_person, mode, docs } = buildDisputeEvidence({ booking: booking || {}, auth: a0, customer: booking && booking.customer, facts });
  if (body.preview) {
    return res.status(200).json({ preview: true, in_person, mode, narrative, evidence, docs, photos: jpgs.length, photos_total: photoUrls.length, signature: !!(in_person && a0.signature_url) });
  }

  if (in_person && a0.signature_url) {
    try {
      const b64 = await fetchAsBase64(a0.signature_url);
      if (b64) evidence.customer_signature = await stripeUploadFile({ dataBase64: b64, contentType: 'image/png', filename: 'signature.png', ...sel });
    } catch (_) { /* fall back to text-only evidence */ }
  }
  try {
    const wo = buildPdf([{ lines: docs.work_order }, ...jpgs.map((j) => ({ jpeg: j }))]);
    if (wo) evidence.service_documentation = await stripeUploadFile({ dataBase64: wo.pdf.toString('base64'), contentType: 'application/pdf', filename: 'work-order-and-photos.pdf', ...sel });
  } catch (e) { return res.status(400).json({ error: 'Could not upload the work order PDF: ' + e.message }); }
  try {
    const cc = buildPdf([{ lines: docs.communication }]);
    if (cc) evidence.customer_communication = await stripeUploadFile({ dataBase64: cc.pdf.toString('base64'), contentType: 'application/pdf', filename: 'customer-communication.pdf', ...sel });
  } catch (e) { return res.status(400).json({ error: 'Could not upload the communication PDF: ' + e.message }); }

  try { await submitDisputeEvidence(disputeId, evidence, sel, true); }
  catch (e) { return res.status(e.status || 400).json({ error: 'Stripe rejected the evidence: ' + e.message }); }
  return res.status(200).json({ ok: true, submitted: true });
}

async function assertBooking(db, biz, id) {
  if (!id) { const e = new Error('id required'); e.status = 400; throw e; }
  const { data } = await db.from('bookings').select('id').eq('id', id).eq('business_id', biz.id).single();
  if (!data) { const e = new Error('Booking not found'); e.status = 404; throw e; }
}

async function bookingPhotos(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business, { view: true }); } catch (e) { return bail(res, e); }
  const id = (req.query.id || '').toString();
  try { await assertBooking(db, biz, id); } catch (e) { return bail(res, e); }
  const { data, error } = await db.from('booking_photos')
    .select('id, url, caption, uploader_name, uploaded_by_kind, created_at')
    .eq('booking_id', id).eq('business_id', biz.id).order('created_at', { ascending: true });
  if (error) throw error;
  return res.status(200).json({ photos: data || [] });
}

async function bookingPhotoAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  try { await assertBooking(db, biz, body.id); } catch (e) { return bail(res, e); }
  let up;
  try { up = await uploadImage(body.image, `${biz.id}/${body.id}`); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const { data, error } = await db.from('booking_photos').insert({
    business_id: biz.id, booking_id: body.id, technician_id: null,
    uploaded_by_kind: auth.role === 'owner' ? 'owner' : 'secretary', uploader_name: adminAuthorName(auth),
    storage_path: up.path, url: up.url, caption: (body.caption || '').toString().trim() || null,
  }).select('id, url, caption, uploader_name, uploaded_by_kind, created_at').single();
  if (error) { await deleteImage(up.path); throw error; }
  return res.status(200).json({ photo: data });
}

async function bookingPhotoDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.photo_id) return res.status(400).json({ error: 'photo_id required' });
  const { data: ph } = await db.from('booking_photos')
    .select('id, storage_path').eq('id', body.photo_id).eq('business_id', biz.id).single();
  if (!ph) return res.status(404).json({ error: 'Photo not found' });
  await db.from('booking_photos').delete().eq('id', body.photo_id);
  await deleteImage(ph.storage_path);
  return res.status(200).json({ ok: true });
}

async function bookingNotes(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business, { view: true }); } catch (e) { return bail(res, e); }
  const id = (req.query.id || '').toString();
  try { await assertBooking(db, biz, id); } catch (e) { return bail(res, e); }
  const { data, error } = await db.from('booking_notes')
    .select('id, body, author_kind, author_name, created_at')
    .eq('booking_id', id).eq('business_id', biz.id).order('created_at', { ascending: false });
  if (error) throw error;
  return res.status(200).json({ notes: data || [] });
}

const STAFF_NOTICES = [{
  key: 'no_precharge_2026_10_23',
  to: ['Heather', 'Joey'],
  text: "New rule (from Owner): a stolen card cost us $722 on Oct 6.\n1. Never charge a card before the job. Save it; it's charged after the work.\n2. If a caller insists on paying now, use Send invoice so they pay themselves.\n3. Red flags: out of town, 'someone else will be home', 'pay now', 'charge me before I hang up', a ZIP that doesn't match, a new house whose address they have to look up. Two or more = tell Owner before booking.\n4. A red SCAMMER box = don't book, don't take a card.",
}, {
  key: 'backup_ring_2026_10_25', to: ['Joey'], anyTime: true,
  text: 'If Joe misses a call, it now rings you next.',
}];
const DISPUTE_TASK_ID = '7e73e456-a45d-4159-ab82-d97e2bad1279';
const DISPUTE_OUTCOMES = { will_withdraw: 'Reached: will withdraw', not_them: 'Reached: says not them', no_answer: 'No answer', wrong_number: 'Wrong number' };
const GENERIC_OUTCOMES = { reached: 'Reached', no_answer: 'No answer', wrong_number: 'Wrong number' };
const CALL_OUTCOMES = { ...DISPUTE_OUTCOMES, ...GENERIC_OUTCOMES };
const outcomesFor = (id) => (id === DISPUTE_TASK_ID ? DISPUTE_OUTCOMES : GENERIC_OUTCOMES);
function localParts(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { dow, hm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}
async function staffOnShift(db, name) {
  try {
    const { data: rows } = await db.from('staff_schedules').select('day_of_week, start_time, end_time, timezone').eq('name', name);
    if (rows && rows.length) {
      return rows.some((r) => {
        const lp = localParts(r.timezone || 'Asia/Manila');
        return lp.dow === r.day_of_week && lp.hm >= String(r.start_time).slice(0, 5) && lp.hm < String(r.end_time).slice(0, 5);
      });
    }
  } catch (_) { /* fall back */ }
  const lp = localParts('Asia/Manila');
  return lp.hm >= '08:00' && lp.hm < '18:00';
}
async function staffNotices(req, res, db, auth) {
  const name = String(auth.name || '');
  if (auth.role === 'owner') {
    const { data: tasks } = await db.from('staff_call_tasks').select('id, assignee, phone, contact_name, title, outcome, note, logged_by, logged_at, attempts').order('created_at', { ascending: false }).limit(20);
    const { data: acks } = await db.from('staff_notice_acks').select('notice_key, name, acked_at');
    return res.status(200).json({ owner: true, tasks: (tasks || []).map((t) => ({ ...t, outcome_label: CALL_OUTCOMES[t.outcome] || null })), acks: acks || [] });
  }
  if (auth.role !== 'secretary') return res.status(200).json({ notices: [], tasks: [] });
  const onShift = !auth.offToday && (await staffOnShift(db, name));
  const mine = STAFF_NOTICES.filter((n) => n.to.includes(name) && (onShift || n.anyTime));
  let notices = [];
  if (mine.length) {
    const { data: acks } = await db.from('staff_notice_acks').select('notice_key').eq('name', name).in('notice_key', mine.map((n) => n.key));
    const done = new Set((acks || []).map((a) => a.notice_key));
    notices = mine.filter((n) => !done.has(n.key)).map((n) => ({ key: n.key, text: n.text }));
  }
  if (!onShift) return res.status(200).json({ notices, tasks: [] });
  const today = localParts('Asia/Manila').date;
  const { data: tk } = await db.from('staff_call_tasks').select('id, phone, contact_name, title, script, attempts, snooze_until').eq('assignee', name).is('outcome', null);
  const tasks = (tk || []).filter((t) => !t.snooze_until || t.snooze_until <= today).map((t) => ({ ...t, outcomes: outcomesFor(t.id) }));
  return res.status(200).json({ notices, tasks, outcomes: DISPUTE_OUTCOMES });
}
async function staffNoticeAck(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = String(body.key || '');
  if (!STAFF_NOTICES.some((n) => n.key === key)) return res.status(400).json({ error: 'Unknown notice' });
  const { error } = await db.from('staff_notice_acks').upsert({ notice_key: key, name: String(auth.name || 'Office'), acked_at: new Date().toISOString() }, { onConflict: 'notice_key,name', ignoreDuplicates: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
async function callTaskLog(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const outcome = String(body.outcome || '');
  const { data: t } = await db.from('staff_call_tasks').select('id, assignee, attempts, outcome').eq('id', String(body.id || '')).maybeSingle();
  if (!t) return res.status(404).json({ error: 'Task not found' });
  if (!outcomesFor(t.id)[outcome]) return res.status(400).json({ error: 'Pick an outcome' });
  if (auth.role !== 'owner' && t.assignee !== auth.name) return res.status(403).json({ error: 'Not your task' });
  if (t.outcome) return res.status(409).json({ error: 'Already logged' });
  const now = new Date().toISOString();
  const note = String(body.note || '').trim().slice(0, 1000) || null;
  const by = adminAuthorName(auth);
  const attempts = [...(Array.isArray(t.attempts) ? t.attempts : []), { outcome, note, by, at: now }];
  const patch = { attempts, note, logged_by: by, logged_at: now };
  if (outcome === 'no_answer') {
    const d = new Date(localParts('Asia/Manila').date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
    patch.snooze_until = d.toISOString().slice(0, 10);
  } else patch.outcome = outcome;
  const { error } = await db.from('staff_call_tasks').update(patch).eq('id', t.id).is('outcome', null);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
async function signatureWaive(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  try { await assertBooking(db, biz, body.id); } catch (e) { return bail(res, e); }
  const { data: b } = await db.from('bookings').select('metadata').eq('id', body.id).maybeSingle();
  const meta = { ...(b?.metadata || {}) };
  if (body.undo) delete meta.signature_waived;
  else meta.signature_waived = { by: adminAuthorName(auth), at: new Date().toISOString(), reason: 'customer not home' };
  const { error } = await db.from('bookings').update({ metadata: meta }).eq('id', body.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, signature_waived: meta.signature_waived || null });
}

async function bookingNoteAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  try { await assertBooking(db, biz, body.id); } catch (e) { return bail(res, e); }
  const text = (body.body || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Note text required' });
  const { data, error } = await db.from('booking_notes').insert({
    business_id: biz.id, booking_id: body.id,
    author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null, author_name: adminAuthorName(auth),
    body: text,
  }).select('id, body, author_kind, author_name, created_at').single();
  if (error) throw error;
  return res.status(200).json({ note: data });
}

async function bookingNoteDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.note_id) return res.status(400).json({ error: 'note_id required' });
  await db.from('booking_notes').delete().eq('id', body.note_id).eq('business_id', biz.id);
  return res.status(200).json({ ok: true });
}

async function resolveBusinessForPhotos(db, auth, slug, opts) {
  try {
    return { biz: await resolveBusiness(db, auth, slug), crossBusinessToPostOnly: false };
  } catch (e) {
    if (opts && opts.read && isAllJobsViewer(auth)) return { biz: await resolveBusiness(db, auth, slug, { view: true }), crossBusinessToPostOnly: false };
    if (auth.role === 'secretary' && auth.scope === 'doms' && slug === 'tidyhaus') {
      const { data, error } = await db.from('businesses').select('id, slug, name, timezone').eq('slug', slug).single();
      if (error || !data) throw e;
      return { biz: data, crossBusinessToPostOnly: true };
    }
    throw e;
  }
}

async function photoGallery(req, res, db, auth) {
  let biz, crossBusinessToPostOnly;
  try { ({ biz, crossBusinessToPostOnly } = await resolveBusinessForPhotos(db, auth, req.query.business, { read: true })); } catch (e) { return bail(res, e); }
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const offset = Number(req.query.offset) || 0;
  const logoOnly = req.query.logo === '1' || req.query.logo === 'true';

  const statusFilter = (req.query.status || '').toString();
  const sel = (withStatus, withLogo) => {
    let q = db.from('booking_photos')
      .select(`id, url, caption, uploader_name, created_at, booking_id${withStatus ? ', status' : ''}${withLogo ? ', logo_shot, logo_note' : ''},
             booking:bookings ( id, scheduled_at, status, customer:customers ( name ), technician:technicians!technician_id ( name ) )`)
      .eq('business_id', biz.id);
    if (withLogo && logoOnly) q = q.is('logo_shot', true);
    if (withStatus && statusFilter === 'all') q = q.or('status.is.null,status.neq.records');
    if (withStatus && statusFilter && PHOTO_CATEGORIES.includes(statusFilter)) {
      q = statusFilter === 'new'
        ? q.or('status.is.null,status.eq.new,status.eq.private')
        : q.eq('status', statusFilter);
    }
    if (crossBusinessToPostOnly) q = withStatus ? q.eq('status', 'to_post') : q.eq('id', '00000000-0000-0000-0000-000000000000');
    return q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  };
  let hasStatus = true;
  let hasLogo = true;
  let { data, error } = await sel(true, true);
  if (error && /logo_shot|logo_note/i.test(error.message || '')) {
    hasLogo = false;
    ({ data, error } = await sel(true, false));
  }
  if (error && /status/i.test(error.message || '')) {
    hasStatus = false;
    ({ data, error } = await sel(false, hasLogo));
  }
  if (error) throw error;
  const photos = (data || []).map(p => ({
    id: p.id, url: p.url, caption: p.caption, uploader_name: p.uploader_name, created_at: p.created_at,
    booking_id: p.booking_id,
    logo_shot: hasLogo ? !!p.logo_shot : false,
    logo_note: hasLogo ? (p.logo_note || null) : null,
    status: hasStatus ? (p.status || 'new') : 'new',
    customer_name: p.booking?.customer?.name || 'Customer',
    technician_name: p.booking?.technician?.name || null,
    scheduled_at: p.booking?.scheduled_at || null,
    status_booking: p.booking?.status || null,
  }));
  if (auth.role === 'owner' && photos.length) {
    try {
      const { data: pb } = await db.from('tech_bonuses').select('photo_id, amount').in('photo_id', photos.map(p => p.id));
      const paid = new Map();
      for (const b of pb || []) paid.set(b.photo_id, (paid.get(b.photo_id) || 0) + (Number(b.amount) || 0));
      for (const p of photos) if (paid.has(p.id)) p.bonus_paid = paid.get(p.id);
      const bids = [...new Set(photos.map(p => p.booking_id).filter(Boolean))];
      if (bids.length) {
        const { data: sib } = await db.from('booking_photos').select('id, booking_id, technician_id, booking:bookings ( technician_id )').in('booking_id', bids);
        const sibIds = (sib || []).map(x => x.id);
        const techOf = new Map((sib || []).map(x => [x.id, x.technician_id || x.booking?.technician_id || null]));
        const bkOf = new Map((sib || []).map(x => [x.id, x.booking_id]));
        const given = new Set();
        if (sibIds.length) {
          const { data: jb } = await db.from('tech_bonuses').select('photo_id, technician_id').in('photo_id', sibIds);
          for (const r of jb || []) given.add(bkOf.get(r.photo_id) + '|' + r.technician_id);
        }
        for (const p of photos) if (!p.bonus_paid && given.has(p.booking_id + '|' + techOf.get(p.id))) p.job_bonus_given = true;
      }
    } catch (e) { console.warn('[photo_gallery] bonus lookup failed:', e.message); }
  }
  let counts = null;
  if (hasStatus && !crossBusinessToPostOnly) {
    const countFor = (apply) => {
      let q = db.from('booking_photos').select('id', { count: 'exact', head: true }).eq('business_id', biz.id);
      return apply(q);
    };
    try {
      const [cNew, cToPost, cPosted, cRecords, cLogo, cUnscanned] = await Promise.all([
        countFor(q => q.or('status.is.null,status.eq.new,status.eq.private')),
        countFor(q => q.eq('status', 'to_post')),
        countFor(q => q.eq('status', 'posted')),
        countFor(q => q.eq('status', 'records')),
        hasLogo ? countFor(q => q.is('logo_shot', true)) : Promise.resolve({ count: 0 }),
        hasLogo ? countFor(q => q.is('logo_scanned_at', null)) : Promise.resolve({ count: 0 }),
      ]);
      counts = {
        new: cNew.count || 0, to_post: cToPost.count || 0, posted: cPosted.count || 0,
        records: cRecords.count || 0, logo: cLogo.count || 0,
        unscanned: cUnscanned.count || 0,
      };
    } catch (e) { console.warn('[photo_gallery] counts failed:', e.message); }
  }
  return res.status(200).json({
    photos, limit, offset, has_more: photos.length === limit,
    status_supported: hasStatus, logo_supported: hasLogo, counts,
  });
}

async function fetchAllPages(build, { pageSize = 1000, maxPages = 100 } = {}) {
  const { count, error: countErr } = await build('id', { count: 'exact', head: true });
  if (countErr) throw countErr;
  const pages = Math.min(maxPages, Math.ceil((count || 0) / pageSize));
  const results = await Promise.all(Array.from({ length: pages }, (_, p) =>
    build().range(p * pageSize, p * pageSize + pageSize - 1)));
  const rows = [];
  for (const { data, error } of results) {
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function analyticsOverview(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const { data: rows, error: bizErr } = await db.from('businesses')
    .select('id, slug, name, url, analytics_config').eq('active', true).order('name');
  if (bizErr) throw bizErr;

  const tagToBiz = new Map();
  for (const b of rows || []) {
    const tag = b.analytics_config && b.analytics_config.funnel_backend;
    if (tag) tagToBiz.set(tag, b);
  }

  const rangeParam = ['7', '30', 'all'].includes(String(req.query.range || '30')) ? String(req.query.range || '30') : '30';
  const ALL_SINCE = '2026-06-01T00:00:00.000Z';
  const rangeDays = rangeParam === '7' ? 7 : rangeParam === 'all' ? Math.max(30, Math.ceil((Date.now() - Date.parse(ALL_SINCE)) / 86400000)) : 30;
  const since = rangeParam === 'all' ? ALL_SINCE : new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  const stats = new Map();
  if (tagToBiz.size) {
    const pub = serviceClientPublic();
    {
      const evRows = await fetchAllPages((cols, opts) =>
        pub.from('events').select(cols || 'widget, created_at, session_id, event_type, browser', opts)
          .in('widget', [...tagToBiz.keys()])
          .gte('created_at', since));
      for (const r of evRows) {
        if (isBotUserAgent(r.browser)) continue;
        let s = stats.get(r.widget);
        if (!s) {
          s = {
            n30: 0, lastSeen: null, visitors: new Set(), byDay: new Map(),
            bookVisitors: new Set(), bookByDay: new Map(),
            bookings: 0, bookingsByDay: new Map(),
          };
          stats.set(r.widget, s);
        }
        s.n30++;
        if (!s.lastSeen || r.created_at > s.lastSeen) s.lastSeen = r.created_at;
        const sid = r.session_id || '';
        if (!sid) continue;
        const visitor = sid.includes('.') ? sid.split('.')[0] : sid;
        s.visitors.add(visitor);
        const day = r.created_at.slice(0, 10);
        let ds = s.byDay.get(day);
        if (!ds) { ds = new Set(); s.byDay.set(day, ds); }
        ds.add(visitor);

        if (r.event_type === 'page_view') {
          s.bookVisitors.add(visitor);
          let bd = s.bookByDay.get(day);
          if (!bd) { bd = new Set(); s.bookByDay.set(day, bd); }
          bd.add(visitor);
        }
      }
    }
  }

  const bookedByBiz = new Map();
  const bookingsByBiz = new Map();
  {
    const { data: bkRows, error: bkErr } = await db.from('bookings')
      .select('business_id, created_at, status, city, state, metadata, customer:customers ( email, phone )')
      .eq('source', 'widget')
      .gte('created_at', since);
    if (bkErr) throw bkErr;
    for (const bk of bkRows || []) {
      let e = bookedByBiz.get(bk.business_id);
      if (!e) { e = { kept: 0, cancelled: 0, internal: 0, byDay: new Map() }; bookedByBiz.set(bk.business_id, e); }
      const internal = isInternalContact(bk.customer);
      const cancelled = bk.status === 'cancelled';
      const landing_page = (bk.metadata && bk.metadata.landing_page) || null;
      const source_page = (bk.metadata && bk.metadata.source_page) || null;
      if (!bookingsByBiz.has(bk.business_id)) bookingsByBiz.set(bk.business_id, []);
      bookingsByBiz.get(bk.business_id).push({ city: bk.city, state: bk.state, landing_page, source_page, created_at: bk.created_at, cancelled, internal });
      if (internal) { e.internal++; continue; }
      if (cancelled) { e.cancelled++; continue; }
      e.kept++;
      const day = String(bk.created_at).slice(0, 10);
      e.byDay.set(day, (e.byDay.get(day) || 0) + 1);
    }
  }

  const callsByBiz = new Map();
  try {
    const addCall = (bizId, market) => {
      if (!bizId) return;
      let e = callsByBiz.get(bizId);
      if (!e) { e = { total: 0, byMarket: new Map() }; callsByBiz.set(bizId, e); }
      e.total++;
      if (market) e.byMarket.set(market, (e.byMarket.get(market) || 0) + 1);
    };
    const { data: tn } = await db.from('tracking_numbers').select('phone');
    const trackingPhones = new Set((tn || []).map(t => digitsOf(t.phone)));
    const { data: cl } = await db.from('calls').select('business_id, market')
      .eq('kind', 'inbound').not('answered', 'is', null).gte('occurred_at', since).limit(10000);
    for (const c of (cl || [])) addCall(c.business_id, c.market);
    const { data: au } = await db.from('call_audits').select('business_id, grasshopper_number')
      .eq('direction', 'incoming').gte('audit_date', String(since).slice(0, 10)).limit(10000);
    for (const a of (au || [])) {
      const d = digitsOf(a.grasshopper_number);
      if (trackingPhones.has(d)) continue;
      addCall(a.business_id, (GRASSHOPPER_LINES[d] || {}).market || null);
    }
  } catch (e) { console.warn('[admin] analytics calls count failed:', e.message); }
  const CALL_MARKETS = new Set(['Manila', 'Houston', 'Austin', 'Los Angeles', 'San Antonio', 'Dallas']);
  const callsForMarket = (bizId, marketName) => {
    const e = callsByBiz.get(bizId);
    const key = String(marketName || '').replace(/^HA\s+/i, '');
    if (e && e.byMarket.has(key)) return e.byMarket.get(key);
    return CALL_MARKETS.has(key) ? 0 : null;
  };

  const dayKeys = [];
  for (let i = rangeDays - 1; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

  const marketRowsByBiz = new Map();
  const marketDedup = new Map();
  {
    const withMarkets = (rows || []).filter(b => b.analytics_config
      && Array.isArray(b.analytics_config.markets) && b.analytics_config.markets.length);
    for (const b of withMarkets) {
      const pub = serviceClientPublic();
      const host = (() => { try { return new URL(b.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      const sess = new Map();
      {
        const pvRows = await fetchAllPages((cols, opts) =>
          pub.from('web_events').select(cols || 'session_id, page_url, created_at, user_agent, metadata', opts)
            .eq('event_type', 'page_view')
            .ilike('page_url', `%${host}%`)
            .gte('created_at', since), { maxPages: rangeParam === 'all' ? 60 : 12 });
        for (const r of pvRows) {
          if (isBotUserAgent(r.user_agent)) continue;
          if (!isUsTimezone(r.metadata && r.metadata.timezone)) continue;
          let path;
          try { path = new URL(r.page_url).pathname.replace(/\/+$/, '') || '/'; }
          catch { continue; }
          if (isBlogPath(path)) continue;
          let e = sess.get(r.session_id);
          if (!e) { e = { paths: new Set(), days: new Map(), views: new Map(), last: null }; sess.set(r.session_id, e); }
          e.paths.add(path);
          e.views.set(path, (e.views.get(path) || 0) + 1);
          const day = String(r.created_at).slice(0, 10);
          if (!e.days.has(path)) e.days.set(path, new Set());
          e.days.get(path).add(day);
          if (!e.last || r.created_at > e.last) e.last = r.created_at;
        }
      }

      const bkAll = bookingsByBiz.get(b.id) || [];
      const out = [];
      const dedup = { visitors: new Set(), book: new Set(), bookByDay: new Map() };

      const bookingMarket = bkAll.map(bookingMarketCreditor(b.analytics_config.markets));

      for (const [mIdx, m] of b.analytics_config.markets.entries()) {
        const paths = (m.paths || []).map(p => p.replace(/\/+$/, '') || '/');
        const visitors = new Set(), bookVisitors = new Set();
        const byDay = new Map(), bookByDay = new Map();
        let lastSeen = null, events = 0;
        for (const [sid, e] of sess) {
          const hit = paths.some(p => e.paths.has(p));
          if (!hit) continue;
          visitors.add(sid);
          dedup.visitors.add(sid);
          for (const p of paths) {
            events += e.views.get(p) || 0;
            for (const d of (e.days.get(p) || [])) {
              if (!byDay.has(d)) byDay.set(d, new Set());
              byDay.get(d).add(sid);
            }
          }
          if (e.paths.has('/book')) {
            bookVisitors.add(sid);
            dedup.book.add(sid);
            for (const p of paths) for (const d of (e.days.get(p) || [])) {
              if (!bookByDay.has(d)) bookByDay.set(d, new Set());
              bookByDay.get(d).add(sid);
              if (!dedup.bookByDay.has(d)) dedup.bookByDay.set(d, new Set());
              dedup.bookByDay.get(d).add(sid);
            }
          }
          if (!lastSeen || (e.last && e.last > lastSeen)) lastSeen = e.last;
        }
        const bookingsNa = false;
        let kept = 0, cancelled = 0, internal = 0, keptByCity = 0, keptUnattributed = 0;
        const bookingsByDay = new Map();
        bkAll.forEach((bk, i) => {
          const hit = bookingMarket[i];
          if (!hit || hit.idx !== mIdx) return;
          if (bk.internal) { internal++; return; }
          if (bk.cancelled) { cancelled++; return; }
          kept++;
          if (hit.basis === 'city') keptByCity++;
          else if (hit.basis === 'unattributed') keptUnattributed++;
          const d = String(bk.created_at).slice(0, 10);
          bookingsByDay.set(d, (bookingsByDay.get(d) || 0) + 1);
        });
        const v = visitors.size;
        out.push({
          slug: `${b.slug}::${String(m.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          parent_slug: b.slug,
          market: true,
          name: m.name,
          url: paths.map(p => `https://${host}${p === '/' ? '' : p}`).join(' · '),
          tracked: true, national: false,
          has_traffic_backend: true, has_gsc: false,
          events_30d: events,
          visitors_30d: v,
          avg_visitors_day: Math.round((v / rangeDays) * 10) / 10,
          visitors_by_day: dayKeys.map(d => (byDay.get(d) ? byDay.get(d).size : 0)),
          book_visits_30d: bookVisitors.size,
          book_by_day: dayKeys.map(d => (bookByDay.get(d) ? bookByDay.get(d).size : 0)),
          bookings_na: bookingsNa,
          bookings_30d: kept,
          bookings_by_city_30d: keptByCity,
          bookings_unattributed_30d: keptUnattributed,
          bookings_cancelled_30d: cancelled,
          bookings_internal_30d: internal,
          bookings_by_day: dayKeys.map(d => bookingsByDay.get(d) || 0),
          calls_30d: callsForMarket(b.id, m.name),
          last_event: lastSeen,
        });
      }
      marketRowsByBiz.set(b.slug, out);
      marketDedup.set(b.slug, dedup);
    }
  }

  const businesses = (rows || []).map(b => {
    const cfg = b.analytics_config || null;
    const tag = cfg && cfg.funnel_backend;
    const s = tag ? stats.get(tag) : null;
    const bk = bookedByBiz.get(b.id) || null;
    const visitors30 = s ? s.visitors.size : 0;
    return {
      slug: b.slug, name: b.name, url: b.url,
      tracked: !!tag,
      national: !!(cfg && Array.isArray(cfg.city_pages) && cfg.city_pages.length),
      has_traffic_backend: !!(cfg && cfg.traffic_backend),
      has_gsc: !!(cfg && cfg.gsc_domain),
      events_30d: s ? s.n30 : 0,
      visitors_30d: visitors30,
      avg_visitors_day: Math.round((visitors30 / rangeDays) * 10) / 10,
      visitors_by_day: s ? dayKeys.map(d => (s.byDay.get(d) ? s.byDay.get(d).size : 0)) : dayKeys.map(() => 0),
      book_visits_30d: s ? s.bookVisitors.size : 0,
      book_by_day: s ? dayKeys.map(d => (s.bookByDay.get(d) ? s.bookByDay.get(d).size : 0)) : dayKeys.map(() => 0),
      bookings_30d: bk ? bk.kept : 0,
      bookings_cancelled_30d: bk ? bk.cancelled : 0,
      bookings_internal_30d: bk ? bk.internal : 0,
      bookings_by_day: bk ? dayKeys.map(d => bk.byDay.get(d) || 0) : dayKeys.map(() => 0),
      calls_30d: (callsByBiz.get(b.id) || { total: 0 }).total,
      last_event: s ? s.lastSeen : null,
    };
  })
  .flatMap(b => marketRowsByBiz.get(b.slug) || [b]);

  const single = businesses.filter(b => !b.market);
  const dedups = [...marketDedup.values()];
  const visitors_30d_total = single.reduce((n, b) => n + b.visitors_30d, 0)
    + dedups.reduce((n, d) => n + d.visitors.size, 0);
  const book_visits_30d_total = single.reduce((n, b) => n + b.book_visits_30d, 0)
    + dedups.reduce((n, d) => n + d.book.size, 0);
  const book_by_day_total = dayKeys.map((d, i) =>
    single.reduce((n, b) => n + b.book_by_day[i], 0)
    + dedups.reduce((n, x) => n + (x.bookByDay.get(d) ? x.bookByDay.get(d).size : 0), 0));
  const bookings_by_day_total = dayKeys.map((_, i) => businesses.reduce((n, b) => n + b.bookings_by_day[i], 0));

  return res.status(200).json({
    businesses, since, days: dayKeys, range: rangeParam, range_days: rangeDays,
    totals: {
      visitors_30d: visitors_30d_total,
      book_visits_30d: book_visits_30d_total,
      bookings_30d: businesses.reduce((n, b) => n + b.bookings_30d, 0),
      bookings_cancelled_30d: businesses.reduce((n, b) => n + b.bookings_cancelled_30d, 0),
      bookings_internal_30d: businesses.reduce((n, b) => n + b.bookings_internal_30d, 0),
      book_by_day: book_by_day_total,
      bookings_by_day: bookings_by_day_total,
    },
  });
}

const INSIGHTS_LATE_THRESHOLD = 3;
const INSIGHTS_OVERWORK_RATIO = 1.5;
const INSIGHTS_UNDERWORK_RATIO = 0.5;
const INSIGHTS_METRO_MIN_AVG = 3;
const INSIGHTS_METRO_DROP = 0.25;
const INSIGHTS_METRO_SPIKE = 0.4;
const INSIGHTS_REVIEW_MIN_N = 3;

async function insightsOverview(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }

  const now = Date.now();
  const DAY = 86400000;
  const since60 = new Date(now - 60 * DAY).toISOString();
  const nowISO = new Date(now).toISOString();

  const [{ data: techRows, error: techErr }, { data: areaRows, error: areaErr }, { data: bkRows, error: bkErr }] = await Promise.all([
    db.from('technicians').select('id, name, active').eq('business_id', biz.id),
    db.from('service_areas').select('id, name').eq('business_id', biz.id),
    db.from('bookings')
      .select('id, technician_id, secondary_technician_id, service_area_id, status, price, review_rating, reviewed_at, scheduled_at, metadata')
      .eq('business_id', biz.id).gte('scheduled_at', since60).lt('scheduled_at', nowISO),
  ]);
  if (techErr) throw techErr;
  if (areaErr) throw areaErr;
  if (bkErr) throw bkErr;

  const areaName = new Map((areaRows || []).map(a => [a.id, a.name]));
  const flags = [];

  const metroCur = new Map(), metroTrail = new Map();
  const cur7 = now - 7 * DAY, trail35 = now - 35 * DAY;
  for (const b of bkRows || []) {
    if (b.status === 'cancelled' || !b.service_area_id) continue;
    const t = new Date(b.scheduled_at).getTime();
    if (t >= cur7) metroCur.set(b.service_area_id, (metroCur.get(b.service_area_id) || 0) + 1);
    else if (t >= trail35) metroTrail.set(b.service_area_id, (metroTrail.get(b.service_area_id) || 0) + 1);
  }
  const metros = [...areaName.keys()].map(id => {
    const cur = metroCur.get(id) || 0;
    const avg = (metroTrail.get(id) || 0) / 4;
    const pct = avg > 0 ? Math.round(((cur - avg) / avg) * 100) : null;
    return { id, name: areaName.get(id), bookings_this_week: cur, trailing_weekly_avg: Math.round(avg * 10) / 10, pct_change: pct };
  }).sort((a, b) => (a.pct_change ?? 0) - (b.pct_change ?? 0));
  for (const m of metros) {
    if (m.trailing_weekly_avg < INSIGHTS_METRO_MIN_AVG || m.pct_change == null) continue;
    if (m.pct_change <= -INSIGHTS_METRO_DROP * 100) flags.push({ severity: 'high', text: `${m.name} is down ${Math.abs(m.pct_change)}% this week vs its trailing average (${m.bookings_this_week} vs ~${m.trailing_weekly_avg}/wk).` });
    else if (m.pct_change >= INSIGHTS_METRO_SPIKE * 100) flags.push({ severity: 'good', text: `${m.name} is up ${m.pct_change}% this week vs its trailing average (${m.bookings_this_week} vs ~${m.trailing_weekly_avg}/wk).` });
  }

  let revCur = 0, revTrail = 0;
  for (const b of bkRows || []) {
    if (b.status !== 'completed' || !b.price) continue;
    const t = new Date(b.scheduled_at).getTime();
    if (t >= cur7) revCur += Number(b.price) || 0;
    else if (t >= trail35) revTrail += Number(b.price) || 0;
  }
  const revAvgWeekly = revTrail / 4;
  const revPct = revAvgWeekly > 0 ? Math.round(((revCur - revAvgWeekly) / revAvgWeekly) * 100) : null;
  if (revAvgWeekly >= 500 && revPct != null && revPct <= -20) {
    flags.push({ severity: 'high', text: `Revenue this week ($${Math.round(revCur)}) is down ${Math.abs(revPct)}% vs the trailing weekly average ($${Math.round(revAvgWeekly)}).` });
  }

  const cur30 = now - 30 * DAY, prior30 = now - 60 * DAY;
  const techStats = new Map((techRows || []).filter(t => t.active !== false).map(t => [t.id, {
    id: t.id, name: t.name,
    jobs_30d: 0, completed_30d: 0, cancelled_30d: 0, revenue_30d: 0,
    late_30d: 0, scheduled_30d: 0,
    reviews_cur: [], reviews_prior: [],
  }]));
  for (const b of bkRows || []) {
    const t = new Date(b.scheduled_at).getTime();
    for (const tid of [b.technician_id, b.secondary_technician_id]) {
      const s = tid && techStats.get(tid);
      if (!s) continue;
      if (t >= cur30) {
        s.scheduled_30d++;
        if (b.status === 'cancelled') s.cancelled_30d++;
        else { s.jobs_30d++; if (b.status === 'completed') { s.completed_30d++; s.revenue_30d += Number(b.price) || 0; } }
        if (b.metadata && b.metadata.staff_late_notified_at) s.late_30d++;
      }
      if (b.review_rating && b.reviewed_at) {
        const rt = new Date(b.reviewed_at).getTime();
        if (rt >= cur30) s.reviews_cur.push(b.review_rating);
        else if (rt >= prior30) s.reviews_prior.push(b.review_rating);
      }
    }
  }
  const totals = { jobs_30d: 0, completed_30d: 0, revenue_30d: 0, late_30d: 0 };
  for (const b of bkRows || []) {
    if (new Date(b.scheduled_at).getTime() < cur30 || b.status === 'cancelled') continue;
    totals.jobs_30d++;
    if (b.status === 'completed') { totals.completed_30d++; totals.revenue_30d += Number(b.price) || 0; }
    if (b.metadata && b.metadata.staff_late_notified_at) totals.late_30d++;
  }
  totals.revenue_30d = Math.round(totals.revenue_30d);
  const avg = arr => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
  const techs = [...techStats.values()].map(s => ({
    id: s.id, name: s.name, jobs_30d: s.jobs_30d, revenue_30d: Math.round(s.revenue_30d),
    avg_ticket: s.completed_30d ? Math.round((s.revenue_30d / s.completed_30d) * 100) / 100 : null,
    cancel_rate: s.scheduled_30d ? Math.round((s.cancelled_30d / s.scheduled_30d) * 100) : 0,
    late_30d: s.late_30d,
    review_avg_30d: avg(s.reviews_cur), review_n_30d: s.reviews_cur.length,
    review_avg_prior30d: avg(s.reviews_prior), review_n_prior30d: s.reviews_prior.length,
  })).sort((a, b) => b.jobs_30d - a.jobs_30d);
  const activeTechs = techs.filter(t => t.jobs_30d > 0);
  const teamAvgJobs = activeTechs.length ? activeTechs.reduce((n, t) => n + t.jobs_30d, 0) / activeTechs.length : 0;
  for (const t of techs) {
    if (t.late_30d >= INSIGHTS_LATE_THRESHOLD) flags.push({ severity: 'high', text: `${t.name} was texted for running late on ${t.late_30d} job${t.late_30d === 1 ? '' : 's'} in the last 30 days.` });
    if (activeTechs.length > 1 && teamAvgJobs > 0 && t.jobs_30d >= teamAvgJobs * INSIGHTS_OVERWORK_RATIO && t.jobs_30d >= 5) {
      flags.push({ severity: 'med', text: `${t.name} worked ${t.jobs_30d} jobs in the last 30 days vs a team average of ${Math.round(teamAvgJobs * 10) / 10}.` });
    }
    if (activeTechs.length > 1 && teamAvgJobs > 0 && t.jobs_30d > 0 && t.jobs_30d <= teamAvgJobs * INSIGHTS_UNDERWORK_RATIO) {
      flags.push({ severity: 'low', text: `${t.name} worked only ${t.jobs_30d} job${t.jobs_30d === 1 ? '' : 's'} in the last 30 days vs a team average of ${Math.round(teamAvgJobs * 10) / 10}.` });
    }
    if (t.review_n_30d >= INSIGHTS_REVIEW_MIN_N && t.review_avg_30d < 4.0) {
      flags.push({ severity: 'high', text: `${t.name}'s reviews averaged ${t.review_avg_30d}★ over the last ${t.review_n_30d} in 30 days.` });
    } else if (t.review_n_30d >= INSIGHTS_REVIEW_MIN_N && t.review_n_prior30d >= INSIGHTS_REVIEW_MIN_N && t.review_avg_30d <= t.review_avg_prior30d - 0.5) {
      flags.push({ severity: 'med', text: `${t.name}'s review average slipped from ${t.review_avg_prior30d}★ to ${t.review_avg_30d}★.` });
    }
  }

  const { data: estRows, error: estErr } = await db.from('estimates')
    .select('status, texted_at, emailed_at, text_opened_at, email_opened_at, approved_at, created_at')
    .eq('business_id', biz.id).gte('created_at', new Date(now - 30 * DAY).toISOString());
  if (estErr && !/text_opened_at|email_opened_at/.test(estErr.message || '')) throw estErr;
  const est = estErr ? [] : (estRows || []);
  const sent = est.filter(e => e.texted_at || e.emailed_at);
  const opened = sent.filter(e => e.text_opened_at || e.email_opened_at);
  const approved = sent.filter(e => e.approved_at);
  const declined = est.filter(e => e.status === 'out_of_area');
  const estimateFunnel = { sent: sent.length, opened: opened.length, approved: approved.length, declined: declined.length };
  if (sent.length >= 5) {
    const openRate = Math.round((opened.length / sent.length) * 100);
    if (openRate < 30) flags.push({ severity: 'med', text: `Only ${openRate}% of the ${sent.length} estimates sent in the last 30 days were ever opened.` });
  }

  flags.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  return res.status(200).json({ flags, metros, techs, totals, estimate_funnel: estimateFunnel, revenue: { this_week: Math.round(revCur), trailing_weekly_avg: Math.round(revAvgWeekly), pct_change: revPct } });
}
const SEVERITY_ORDER = { high: 0, med: 1, low: 2, good: 3 };

async function photoLogoScan(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { scanLogoPhotos } = await import('./_lib/photo-logo-scan.js');
  const limit = Math.min(Number(body.limit) || 120, 200);
  const summary = await scanLogoPhotos({ limit });
  return res.status(200).json({ ok: true, ...summary });
}

const PHOTO_CATEGORIES = ['new', 'to_post', 'posted', 'records', 'private'];
async function bookingPhotoSetStatus(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz, crossBusinessToPostOnly;
  try { ({ biz, crossBusinessToPostOnly } = await resolveBusinessForPhotos(db, auth, body.business)); } catch (e) { return bail(res, e); }
  if (!body.photo_id) return res.status(400).json({ error: 'photo_id required' });
  const status = (body.status || '').toString();
  if (!PHOTO_CATEGORIES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${PHOTO_CATEGORIES.join(', ')}` });
  }
  if (crossBusinessToPostOnly && status !== 'posted') {
    return res.status(403).json({ error: 'Only marking a photo Posted is allowed here.' });
  }
  let q = db.from('booking_photos').update({ status }).eq('id', body.photo_id).eq('business_id', biz.id);
  if (crossBusinessToPostOnly) q = q.eq('status', 'to_post');
  const { data, error } = await q
    .select('id, status').maybeSingle();
  if (error) {
    if (/status/i.test(error.message || '')) {
      return res.status(400).json({ error: 'Photo categories need the 0043 database update applied first.' });
    }
    throw error;
  }
  if (!data) return res.status(404).json({ error: 'Photo not found' });
  return res.status(200).json({ ok: true, id: data.id, status: data.status });
}

function jobHasGds(lineItems) {
  return (lineItems || []).some(li => /guaranteed dismount/i.test(li.name || li.description || ''));
}

async function customers(req, res, db, auth) {
  const allCos = isAllJobsViewer(auth) && req.query.all === '1';
  let biz = null;
  if (!allCos) { try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); } }
  const term = (req.query.q || '').toString().trim();

  let q = db.from('customers')
    .select('id, name, phone, email, address_line1, city, state, postal_code, created_at' + (allCos ? ', business_id, business:businesses(slug, name)' : ''));
  if (!allCos) q = q.eq('business_id', biz.id);
  if (term) {
    const like = `%${term}%`;
    q = q.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},address_line1.ilike.${like}`);
  }
  const { data, error } = await q.order('name', { ascending: true }).limit(200);
  if (error) throw error;
  const customerRows = data || [];
  if (allCos) for (const c of customerRows) { c.business_slug = c.business?.slug || ''; c.business_name = c.business?.name || ''; delete c.business; }

  if (customerRows.length) {
    const jobRows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let jq = db.from('bookings')
        .select('customer_id, price, status, scheduled_at, review_rating, line_items:booking_line_items ( name )');
      if (!allCos) jq = jq.eq('business_id', biz.id);
      const { data: page, error: pageErr } = await jq
        .in('customer_id', customerRows.map(c => c.id))
        .range(from, from + PAGE - 1);
      if (pageErr) { console.warn('[customers] job aggregate failed:', pageErr.message); break; }
      jobRows.push(...(page || []));
      if (!page || page.length < PAGE) break;
    }
    const byCust = {};
    jobRows.forEach(j => {
      const b = byCust[j.customer_id] || (byCust[j.customer_id] = {
        jobs: 0, completed: 0, cancelled: 0, lifetime_value: 0, last_job_at: null, has_gds: false, ratings: [],
      });
      b.jobs += 1;
      if (j.status === 'cancelled') b.cancelled += 1;
      if (j.status === 'completed') { b.completed += 1; b.lifetime_value += Number(j.price) || 0; }
      if (j.scheduled_at && (!b.last_job_at || j.scheduled_at > b.last_job_at)) b.last_job_at = j.scheduled_at;
      if (!['cancelled', 'no_show'].includes(j.status) && jobHasGds(j.line_items)) b.has_gds = true;
      if (j.review_rating) b.ratings.push(j.review_rating);
    });
    customerRows.forEach(c => {
      const b = byCust[c.id];
      c.jobs_count = b ? b.jobs : 0;
      c.completed_count = b ? b.completed : 0;
      c.cancelled_count = b ? b.cancelled : 0;
      c.lifetime_value = b ? Math.round(b.lifetime_value * 100) / 100 : 0;
      c.last_job_at = b ? b.last_job_at : null;
      c.has_gds = b ? b.has_gds : false;
      c.avg_rating = b && b.ratings.length ? Math.round((b.ratings.reduce((s, r) => s + r, 0) / b.ratings.length) * 10) / 10 : null;
    });
  }
  return res.status(200).json({ customers: customerRows });
}

async function mergedCustomerId(db, id) {
  if (!id) return id;
  const { data } = await db.from('customer_merge_20260926_map').select('keeper_id').eq('loser_id', id).maybeSingle();
  return data?.keeper_id || id;
}
async function customerDetail(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business, { view: true }); } catch (e) { return bail(res, e); }
  const id = await mergedCustomerId(db, (req.query.id || '').toString());
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data: customer, error: custErr } = await db.from('customers')
    .select('id, name, phone, email, address_line1, city, state, postal_code, created_at')
    .eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (custErr) throw custErr;
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { data: jobRows, error: jobsErr } = await db.from('bookings')
    .select(`id, status, payment_status, scheduled_at, completed_at, cancelled_at, price, subtotal, tip,
              amount_paid, amount_refunded, review_rating, review_text, address_line1, city, state, postal_code,
              service:services ( name ),
              technician:technicians!technician_id ( name ),
              line_items:booking_line_items ( name, kind, quantity, unit_price, line_total )`)
    .eq('business_id', biz.id).eq('customer_id', id)
    .order('scheduled_at', { ascending: false, nullsFirst: false });
  if (jobsErr) throw jobsErr;
  const jobs = (jobRows || []).map(j => ({
    id: j.id,
    status: j.status,
    payment_status: j.payment_status,
    scheduled_at: j.scheduled_at,
    completed_at: j.completed_at,
    cancelled_at: j.cancelled_at,
    price: j.price,
    amount_paid: j.amount_paid,
    amount_refunded: j.amount_refunded,
    service_name: j.service?.name || null,
    technician_name: j.technician?.name || null,
    review_rating: j.review_rating,
    review_text: j.review_text,
    address: [j.address_line1, j.city, j.state, j.postal_code].filter(Boolean).join(', ') || null,
    has_gds: jobHasGds(j.line_items),
    line_items: (j.line_items || []).map(li => ({ name: li.name, quantity: li.quantity, unit_price: li.unit_price, line_total: li.line_total })),
  }));

  const estSelect = 'id, status, service_label, line_items, approved_total, tax_rate, created_at, approved_at, contacted_at';
  const estQueries = [];
  if (customer.email) estQueries.push(db.from('estimates').select(estSelect).eq('business_id', biz.id).is('deleted_at', null).eq('customer_email', customer.email));
  if (customer.phone) estQueries.push(db.from('estimates').select(estSelect).eq('business_id', biz.id).is('deleted_at', null).eq('customer_phone', customer.phone));
  let estimates = [];
  if (estQueries.length) {
    const settled = await Promise.all(estQueries);
    const seen = new Set();
    const estRows = [];
    for (const r of settled) {
      if (r.error) { console.warn('[customer_detail] estimates lookup failed:', r.error.message); continue; }
      for (const row of (r.data || [])) {
        if (!seen.has(row.id)) { seen.add(row.id); estRows.push(row); }
      }
    }
    estRows.sort((a, b2) => (b2.created_at || '').localeCompare(a.created_at || ''));
    estimates = estRows.map(e => {
      const subtotal = (e.line_items || []).reduce((s, li) => s + (Number(li.unit_price) || 0) * (Number(li.qty) || 1), 0);
      return {
        id: e.id, status: e.status, service_label: e.service_label,
        subtotal: Math.round(subtotal * 100) / 100,
        approved_total: e.approved_total,
        created_at: e.created_at, approved_at: e.approved_at, contacted_at: e.contacted_at,
        has_gds: (e.line_items || []).some(li => /guaranteed dismount/i.test(li.description || '')),
      };
    });
  }

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const cancelledJobs = jobs.filter(j => j.status === 'cancelled');
  const ratings = jobs.map(j => j.review_rating).filter(Boolean);
  const datedJobs = jobs.filter(j => j.scheduled_at);
  const stats = {
    jobs_count: jobs.length,
    completed_count: completedJobs.length,
    cancelled_count: cancelledJobs.length,
    lifetime_value: Math.round(completedJobs.reduce((s, j) => s + (Number(j.price) || 0), 0) * 100) / 100,
    first_job_at: datedJobs.length ? datedJobs[datedJobs.length - 1].scheduled_at : null,
    last_job_at: datedJobs.length ? datedJobs[0].scheduled_at : null,
    has_gds: jobs.some(j => j.has_gds && !['cancelled', 'no_show'].includes(j.status)),
    avg_rating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null,
    reviews_count: ratings.length,
  };

  return res.status(200).json({ customer, jobs, estimates, stats });
}

async function customerUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = await mergedCustomerId(db, body.id);
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data: existing } = await db.from('customers').select('id').eq('id', id).eq('business_id', biz.id).single();
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const patch = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (hasDigits(name)) return res.status(400).json({ error: 'Please enter a name using letters only — no numbers.' });
    patch.name = capName(name);
  }
  if (body.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null;
  if (body.email !== undefined) patch.email = body.email ? String(body.email).trim() : null;
  if (body.address_line1 !== undefined) patch.address_line1 = body.address_line1 ? String(body.address_line1).trim() : null;
  if (body.city !== undefined) patch.city = body.city ? String(body.city).trim() : null;
  if (body.state !== undefined) patch.state = body.state ? String(body.state).trim() : null;
  if (body.postal_code !== undefined) patch.postal_code = body.postal_code ? String(body.postal_code).trim() : null;

  if (Object.keys(patch).length) {
    const { error } = await db.from('customers').update(patch).eq('id', id).eq('business_id', biz.id);
    if (error) throw error;
  }
  return res.status(200).json({ ok: true });
}

const MOVE_CITY_KEYS = [[/houston/i, 'houston'], [/austin/i, 'austin'], [/dfw|dallas|fort worth|arlington/i, 'dfw'],
  [/los angeles/i, 'los_angeles'], [/phoenix/i, 'phoenix'], [/san antonio/i, 'san_antonio'],
  [/oklahoma/i, 'oklahoma_city'], [/tulsa/i, 'tulsa']];
function moveCityKey(areaName) {
  for (const [re, key] of MOVE_CITY_KEYS) if (re.test(areaName || '')) return key;
  return 'default';
}
async function moveZipArea(db, bizId, zip) {
  const { data, error } = await db.from('service_area_zips')
    .select('service_area:service_areas ( name )').eq('business_id', bizId).eq('postal_code', zip).maybeSingle();
  if (error) throw error;
  return data ? (data.service_area?.name || 'our area') : null;
}
async function moveZipCentroid(db, key, zip) {
  if (key) {
    try {
      const u = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      u.searchParams.set('address', `${zip}, USA`); u.searchParams.set('key', key);
      const j = await (await fetch(u, { signal: AbortSignal.timeout(6000) })).json();
      const loc = j.results?.[0]?.geometry?.location;
      if (loc && Number.isFinite(loc.lat)) return { lat: loc.lat, lng: loc.lng };
    } catch (_) { /* fall through */ }
  }
  try {
    const { data } = await db.from('customers').select('lat, lng').eq('postal_code', zip).not('lat', 'is', null).limit(200);
    const pts = (data || []).filter(r => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)));
    if (pts.length) return { lat: pts.reduce((s, r) => s + Number(r.lat), 0) / pts.length, lng: pts.reduce((s, r) => s + Number(r.lng), 0) / pts.length };
  } catch (_) { /* none */ }
  return null;
}
async function moveQuote(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const from = String(req.query.from || '').trim(), to = String(req.query.to || '').trim();
  if (!/^\d{5}$/.test(from) || !/^\d{5}$/.test(to)) return res.status(400).json({ error: 'Two 5-digit ZIPs required' });
  const [fromArea, toArea] = await Promise.all([moveZipArea(db, biz.id, from), moveZipArea(db, biz.id, to)]);
  const key = process.env.GOOGLE_MAPS_API_KEY;
  let miles = null, approx = false, method = null;
  if (from === to) { miles = 0; method = 'same_zip'; }
  if (miles == null && key) {
    try {
      const u = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      u.searchParams.set('origins', `${from}, USA`); u.searchParams.set('destinations', `${to}, USA`);
      u.searchParams.set('units', 'imperial'); u.searchParams.set('key', key);
      const j = await (await fetch(u, { signal: AbortSignal.timeout(6000) })).json();
      const el = j.rows?.[0]?.elements?.[0];
      if (j.status === 'OK' && el?.status === 'OK' && Number.isFinite(el.distance?.value)) { miles = el.distance.value / 1609.344; method = 'google_driving'; }
      else console.warn('[move_quote] distance matrix', j.status, el?.status, j.error_message || '');
    } catch (e) { console.warn('[move_quote] distance matrix failed', e.message); }
  }
  if (miles == null) {
    const [a, b] = await Promise.all([moveZipCentroid(db, key, from), moveZipCentroid(db, key, to)]);
    if (a && b) {
      const R = 3958.8, rad = d => d * Math.PI / 180;
      const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
      miles = 2 * R * Math.asin(Math.sqrt(h)) * 1.3; approx = true; method = 'zip_centroid_x1.3';
    }
  }
  const cityKey = moveCityKey(toArea);
  let minimum = null;
  for (const ck of [cityKey, 'default']) {
    const { data } = await db.from('widget_prices').select('price').eq('business_id', biz.id).eq('city_key', ck).eq('row_key', 'move_takedown_min').maybeSingle();
    if (data && Number.isFinite(Number(data.price))) { minimum = Number(data.price); break; }
  }
  if (minimum == null) minimum = 105;
  return res.status(200).json({ from_area: fromArea, to_area: toArea, miles: miles == null ? null : Math.ceil(miles - 1e-9), approx, method, takedown_min: minimum, city_key: cityKey });
}

async function zipArea(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const postal = (req.query.postal_code || '').toString().trim();
  if (!postal) return res.status(200).json({ service_area_id: null, name: null, surcharge: 0 });
  let data = null;
  let hasSurcharge = true;
  try {
    const result = await db.from('service_area_zips')
      .select('service_area_id, surcharge, service_area:service_areas ( name )')
      .eq('business_id', biz.id).eq('postal_code', postal).maybeSingle();
    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    if (!['42703', 'PGRST204'].includes(error?.code) || missingColumn(error?.message) !== 'surcharge') throw error;
    hasSurcharge = false;
    const result = await db.from('service_area_zips')
      .select('service_area_id, service_area:service_areas ( name )')
      .eq('business_id', biz.id).eq('postal_code', postal).maybeSingle();
    if (result.error) throw result.error;
    data = result.data;
  }
  const surcharge = data && hasSurcharge ? Number(data.surcharge) : 0;
  if (data && hasSurcharge && (data.surcharge == null || data.surcharge === '' || !Number.isFinite(surcharge))) {
    throw new Error('Could not verify the travel fee. Please try again.');
  }
  let other_business = null;
  if (!data) {
    try {
      const { data: hit, error } = await db.from('service_area_zips')
        .select((hasSurcharge ? 'surcharge, ' : '') + 'business:businesses!inner ( slug, name, active ), service_area:service_areas ( name )')
        .eq('postal_code', postal).neq('business_id', biz.id)
        .eq('business.active', true).limit(1).maybeSingle();
      if (error) throw error;
      if (hit?.business) {
        const otherSurcharge = hasSurcharge ? Number(hit.surcharge) : 0;
        if (hasSurcharge && (hit.surcharge == null || hit.surcharge === '' || !Number.isFinite(otherSurcharge))) throw new Error('Invalid alternate business travel fee');
        other_business = {
          slug: hit.business.slug,
          name: hit.business.name,
          area: hit.service_area?.name || null,
          surcharge: otherSurcharge,
        };
      }
    } catch (e) { /* hint only — never block the zip answer */ }
  }
  return res.status(200).json({
    service_area_id: data?.service_area_id || null,
    name: data?.service_area?.name || null,
    surcharge,
    other_business,
  });
}

async function placesAutocomplete(req, res, auth) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const input = (req.query.input || (req.body && req.body.input) || '').toString().trim();
  const token = (req.query.session || (req.body && req.body.session) || '').toString().trim();
  if (!key || input.length < 3) return res.status(200).json({ predictions: [] });
  const u = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  u.searchParams.set('input', input);
  u.searchParams.set('key', key);
  u.searchParams.set('types', 'address');
  u.searchParams.set('components', 'country:us');
  if (token) u.searchParams.set('sessiontoken', token);
  try {
    const r = await fetch(u.toString());
    const j = await r.json();
    if (j.status && j.status !== 'OK' && j.status !== 'ZERO_RESULTS') {
      console.warn('[places] autocomplete', j.status, j.error_message || '');
      return res.status(200).json({ predictions: [], status: j.status });
    }
    const predictions = (j.predictions || []).slice(0, 5).map(p => ({
      description: p.description, place_id: p.place_id,
    }));
    return res.status(200).json({ predictions });
  } catch (e) {
    console.error('[places] autocomplete failed:', e.message);
    return res.status(200).json({ predictions: [] });
  }
}

async function placeDetails(req, res, auth) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = (req.query.place_id || (req.body && req.body.place_id) || '').toString().trim();
  const token = (req.query.session || (req.body && req.body.session) || '').toString().trim();
  if (!key || !placeId) return res.status(200).json({ address: null });
  const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  u.searchParams.set('place_id', placeId);
  u.searchParams.set('key', key);
  u.searchParams.set('fields', 'address_component');
  if (token) u.searchParams.set('sessiontoken', token);
  try {
    const r = await fetch(u.toString());
    const j = await r.json();
    if (j.status !== 'OK') {
      console.warn('[places] details', j.status, j.error_message || '');
      return res.status(200).json({ address: null, status: j.status });
    }
    const comps = j.result?.address_components || [];
    const get = (type, short) => {
      const c = comps.find(x => (x.types || []).includes(type));
      return c ? (short ? c.short_name : c.long_name) : '';
    };
    const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
    const address = {
      street,
      city: get('locality') || get('sublocality') || get('postal_town') || get('administrative_area_level_2'),
      state: get('administrative_area_level_1', true),
      zip: get('postal_code'),
    };
    return res.status(200).json({ address });
  } catch (e) {
    console.error('[places] details failed:', e.message);
    return res.status(200).json({ address: null });
  }
}

const TECH_ALL_COLS = 'id, name, phone, email, status, active, color, service_area_id, service_zips, max_jobs_per_day, photo_url, bio_years, bio_blurb, booking_priority';
const TECH_PAY_FIELDS = ['pin_hash', 'pending_deposit_amount', 'pending_deposit_date', 'manual_pay_amount', 'manual_pay_date', 'pay', 'pay_rate', 'payroll', 'earnings', 'bonus', 'bonuses', 'bank', 'bank_account', 'routing_number'];
async function techniciansAllCompanies(req, res, db) {
  let cols = TECH_ALL_COLS, data, error;
  for (let i = 0; i < 8; i++) {
    ({ data, error } = await db.from('technicians')
      .select(cols + ', business:businesses!inner(slug, name, active)')
      .eq('business.active', true).order('name'));
    if (!error) break;
    const col = missingColumn(error.message);
    if (col && cols.includes(col)) { cols = cols.split(', ').filter(c => c !== col).join(', '); continue; }
    break;
  }
  if (error) throw error;
  const techs = (data || []).map(({ business, ...t }) => {
    for (const f of TECH_PAY_FIELDS) delete t[f];
    return { ...t, business_slug: business?.slug || '', business_name: business?.name || '', area_name: null };
  });
  try {
    const areaIds = [...new Set(techs.map(t => t.service_area_id).filter(Boolean))];
    if (areaIds.length) {
      const { data: areas } = await db.from('service_areas').select('id, name').in('id', areaIds);
      const areaOf = new Map((areas || []).map(a => [a.id, a.name]));
      for (const t of techs) t.area_name = areaOf.get(t.service_area_id) || null;
    }
  } catch { /* cosmetic */ }
  await addWeeklySummaries(db, techs);
  for (const t of techs) { t.upcoming_jobs = 0; t.next_job_at = null; }
  try {
    const ids = techs.filter(t => t.active).map(t => t.id);
    if (ids.length) {
      const now = new Date();
      const list = ids.join(',');
      const { data: bk, error: bkErr } = await db.from('bookings')
        .select('technician_id, secondary_technician_id, scheduled_at, status')
        .or('technician_id.in.(' + list + '),secondary_technician_id.in.(' + list + ')')
        .not('status', 'in', '(completed,cancelled,no_show)')
        .gte('scheduled_at', now.toISOString())
        .lt('scheduled_at', new Date(now.getTime() + 7 * 864e5).toISOString())
        .order('scheduled_at');
      if (bkErr) throw bkErr;
      const byId = new Map(techs.map(t => [t.id, t]));
      for (const b of bk || []) {
        for (const tid of new Set([b.technician_id, b.secondary_technician_id].filter(Boolean))) {
          const t = byId.get(tid); if (!t) continue;
          t.upcoming_jobs++; if (!t.next_job_at) t.next_job_at = b.scheduled_at;
        }
      }
    }
  } catch (e) { console.warn('[admin] all-company upcoming jobs non-fatal:', e.message); }
  for (const t of techs) delete t.service_area_id;
  return res.status(200).json({ technicians: techs });
}

async function addWeeklySummaries(db, techs) {
  for (const t of techs) { t.weekly_slots = null; t.weekly_summary = null; }
  try {
    const ids = techs.map(t => t.id);
    if (ids.length) {
      const { data: av } = await db.from('technician_availability')
        .select('technician_id, day_of_week, slot_key').in('technician_id', ids);
      const hm = (s) => { let [h, m] = s.split(':').map(Number); const ap = h >= 12 ? 'p' : 'a'; h = h % 12 || 12; return { t: h + (m ? ':' + String(m).padStart(2, '0') : ''), ap }; };
      const label = Object.fromEntries(SLOTS.map(s => { const a = hm(s.start), b = hm(s.end); return [s.key, a.ap === b.ap ? `${a.t}-${b.t}${b.ap}` : `${a.t}${a.ap}-${b.t}${b.ap}`]; }));
      const order = SLOTS.map(s => s.key);
      const byTech = new Map();
      for (const r of av || []) { if (!byTech.has(r.technician_id)) byTech.set(r.technician_id, []); byTech.get(r.technician_id).push(r); }
      for (const t of techs) {
        const rows = byTech.get(t.id) || [];
        t.weekly_slots = rows.length;
        const WEEK = [1, 2, 3, 4, 5, 6, 0];
        const dayText = (d) => {
          const keys = rows.filter(r => r.day_of_week === d).map(r => r.slot_key).sort((x, y) => order.indexOf(x) - order.indexOf(y));
          return !keys.length ? '' : keys.length === order.length ? 'all day' : keys.map(k => label[k]).join(', ');
        };
        const runs = [];
        for (const d of WEEK) {
          const txt = dayText(d), last = runs[runs.length - 1];
          if (txt && last && last.txt === txt && WEEK.indexOf(last.to) === WEEK.indexOf(d) - 1) last.to = d;
          else if (txt) runs.push({ from: d, to: d, txt });
        }
        const ab = (d) => DAYS[d].slice(0, 3);
        t.weekly_summary = runs.map(r => `${r.from === r.to ? ab(r.from) : `${ab(r.from)}-${ab(r.to)}`} ${r.txt}`).join(' · ');
      }
    }
  } catch (e) { console.warn('[admin] weekly times summary non-fatal:', e.message); }
}

async function technicians(req, res, db, auth) {
  if ((auth.role === 'secretary' || isAllJobsViewer(auth)) && req.query.all === '1') return await techniciansAllCompanies(req, res, db);
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  let cols = 'id, name, phone, email, status, active, service_area_id, max_jobs_per_day, pin_hash, photo_url, bio_years, bio_blurb, review_invite_sent_at, booking_priority';
  let data, error;
  for (let i = 0; i < 8; i++) {
    ({ data, error } = await db.from('technicians').select(cols).eq('business_id', biz.id).order('name'));
    if (!error) break;
    const col = missingColumn(error.message);
    if (col && cols.includes(col)) { cols = cols.split(', ').filter(c => c !== col).join(', '); continue; }
    break;
  }
  if (error) throw error;
  const techs = (data || []).map(({ pin_hash, ...t }) => ({ ...t, pin_set: !!pin_hash }));

  try {
    const areaIds = [...new Set(techs.map(t => t.service_area_id).filter(Boolean))];
    if (areaIds.length) {
      const { data: areas } = await db.from('service_areas').select('id, name, unstaffed').in('id', areaIds);
      const areaOf = new Map((areas || []).map(a => [a.id, a]));
      for (const t of techs) {
        const a = areaOf.get(t.service_area_id);
        t.area_name = a ? a.name : null;
        t.area_unstaffed = !!(a && a.unstaffed);
      }
    }
  } catch { /* labels are cosmetic, never fail the roster over them */ }

  await addWeeklySummaries(db, techs);

  const REVIEW_PROGRAM_KEYS = ['ha-houston-1', 'ha-houston-2', 'ha-austin', 'ha-denver-1', 'ha-denver-2', 'ha-los-angeles', 'ha-fort-worth'];
  for (const t of techs) { t.review_done = 0; t.review_total = REVIEW_PROGRAM_KEYS.length; t.review_bonus_at = null; }
  try {
    const ids = techs.map(t => t.id);
    if (ids.length) {
      const byId = new Map(techs.map(t => [t.id, t]));
      const { data: cks } = await db.from('tech_review_checkins')
        .select('technician_id, listing_key').in('technician_id', ids);
      for (const c of cks || []) {
        if (!REVIEW_PROGRAM_KEYS.includes(c.listing_key)) continue;
        const t = byId.get(c.technician_id); if (t) t.review_done++;
      }
      const { data: bns } = await db.from('tech_review_bonus')
        .select('technician_id, completed_at').in('technician_id', ids);
      for (const b of bns || []) {
        const t = byId.get(b.technician_id); if (t) t.review_bonus_at = b.completed_at;
      }
    }
  } catch { /* migrations 0089/0090 not applied yet */ }

  for (const tech of techs) tech.average_rating = null;
  try {
    const ids = techs.map(t => t.id);
    if (ids.length) {
      const { data: ratings } = await db.from('bookings')
        .select('technician_id, review_rating')
        .in('technician_id', ids)
        .not('review_rating', 'is', null);
      const agg = new Map();
      for (const r of (ratings || [])) {
        const a = agg.get(r.technician_id) || { sum: 0, n: 0 };
        a.sum += r.review_rating; a.n++;
        agg.set(r.technician_id, a);
      }
      for (const tech of techs) {
        const a = agg.get(tech.id);
        if (a && a.n) tech.average_rating = Math.round((a.sum / a.n) * 10) / 10;
      }
    }
  } catch (e) { console.warn('[admin] tech ratings batch non-fatal:', e.message); }

  return res.status(200).json({ technicians: techs });
}

async function partnerTechnicians(req, res, db, auth) {
  const slug = (req.query.business || '').toString();
  if (!slug) return bail(res, Object.assign(new Error('business is required'), { status: 400 }));
  if (!mayUseBusiness(auth, slug)) return bail(res, Object.assign(new Error('Forbidden for this business'), { status: 403 }));
  let partner, hostBiz;
  try {
    [hostBiz, partner] = await Promise.all([resolveBusiness(db, auth, slug), partnerBusiness(db, slug)]);
    if (slug === 'tidyhaus' && req.query.postal_code) {
      const ha = await serviceAreaIdFromPostal(db, hostBiz.id, req.query.postal_code.toString());
      if (ha && await isDfwArea(db, ha)) partner = await metroPartner(db, slug, ha);
    }
  } catch (e) { return bail(res, e); }
  if (!partner) return res.status(200).json({ partner: null, technicians: [] });

  const postalCode = (req.query.postal_code || '').toString();
  let serviceAreaId = null;
  if (postalCode) {
    serviceAreaId = await serviceAreaIdFromPostal(db, partner.id, postalCode);
  }

  let query = db.from('technicians')
    .select('id, name, service_area_id').eq('business_id', partner.id).eq('active', true).neq('status', 'off');
  if (serviceAreaId) query = query.eq('service_area_id', serviceAreaId);
  const { data, error } = await query.order('name');
  if (error) throw error;
  const partnerTechs = data || [];
  try {
    const areaIds = [...new Set(partnerTechs.map(t => t.service_area_id).filter(Boolean))];
    if (areaIds.length) {
      const { data: areas } = await db.from('service_areas').select('id, name').in('id', areaIds);
      const nameOf = new Map((areas || []).map(a => [a.id, a.name]));
      for (const t of partnerTechs) t.area_name = nameOf.get(t.service_area_id) || null;
    }
  } catch { /* labels are cosmetic */ }
  return res.status(200).json({
    partner: { slug: partner.slug, name: partner.name },
    technicians: partnerTechs,
  });
}

async function receiptSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });

  const cols = (withAcct) => `id, scheduled_at, price, tip, amount_paid, amount_refunded, payment_status,
      payment_method, paid_at, ${withAcct ? 'stripe_account, ' : ''}stripe_payment_method_id, stripe_payment_intent_id,
      address_line1, city, state, postal_code,
      customer:customers ( name, email ),
      technician:technicians!technician_id ( name ),
      service_area:service_areas ( timezone ),
      line_items:booking_line_items ( name, kind, quantity, line_total )`;
  let { data: b, error } = await db.from('bookings').select(cols(true)).eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (error && missingColumn(error.message) === 'stripe_account') {
    ({ data: b, error } = await db.from('bookings').select(cols(false)).eq('id', id).eq('business_id', biz.id).maybeSingle());
  }
  if (error) throw error;
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!b.customer?.email) return res.status(400).json({ error: 'No customer email on file for this job.' });
  if (!emailNotificationsOn()) return res.status(503).json({ error: 'Email notifications are turned off.' });

  const total = Number(b.price) || 0;
  const tip = Number(b.tip) || 0;
  const paid = Number(b.amount_paid) || 0;
  const refunded = Number(b.amount_refunded) || 0;
  const netPaid = Math.max(0, Math.round((paid - refunded) * 100) / 100);
  const amountDue = Math.max(0, Math.round((total + tip - netPaid) * 100) / 100);

  const status = String(b.payment_status || '').toLowerCase();
  const allCollectedReturned = refunded > 0.005 && refunded + 0.005 >= paid;
  const wasSettled = paid > 0 && paid + 0.005 >= total + tip;
  const kind = (allCollectedReturned && wasSettled) ? 'refunded'
    : allCollectedReturned ? 'invoice'
    : (status === 'paid' ? 'receipt' : 'invoice');

  if (kind === 'invoice' && total + tip <= 0) {
    return res.status(400).json({ error: 'This job has no price set, so there is nothing to invoice. Add the line items first.' });
  }
  if (kind === 'invoice') return invoiceSend(req, res, db, auth, body);

  const allLines = b.line_items || [];
  const isTax = (li) => /^tax\b/i.test(String(li.name || ''));
  const explicitTax = allLines.filter(isTax).reduce((s, li) => s + (Number(li.line_total) || 0), 0);
  const lines = allLines.filter(li => !isTax(li))
    .map(li => ({ label: li.name, qty: li.quantity, amount: li.line_total }));

  const subtotal = lines.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const gap = Math.round((total - (subtotal + explicitTax)) * 100) / 100;
  const gapIsTax = gap > 0 && subtotal > 0;
  const tax = explicitTax + (gapIsTax ? gap : 0);
  const adjustment = gapIsTax ? 0 : gap;

  const tz = b.service_area?.timezone || biz.timezone || 'Asia/Manila';
  const longDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };

  let paymentLabel = '';
  if (kind === 'receipt') {
    const method = String(b.payment_method || '').toLowerCase();
    if (method === 'cash') paymentLabel = 'Cash';
    else if (b.stripe_payment_intent_id) {
      paymentLabel = 'Card';
      if (b.stripe_payment_method_id) {
        try {
          const card = await retrieveCard(b.stripe_payment_method_id, { account: b.stripe_account || null, slug: biz.slug });
          if (card.brand || card.last4) {
            const brandName = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
            paymentLabel = card.last4 ? `${brandName} ending ${card.last4}` : brandName;
          }
        } catch (_) { /* a Stripe hiccup degrades to plain "Card" */ }
      }
    } else if (method && method !== 'quote') {
      paymentLabel = method.charAt(0).toUpperCase() + method.slice(1);
    }
  }

  const { subject, html } = receiptEmail({
    kind,
    receiptNo: String(b.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
    customerName: b.customer.name || 'Customer',
    serviceDate: longDate(b.scheduled_at),
    paidDate: longDate(b.paid_at),
    technicianName: b.technician?.name || null,
    address: { line1: b.address_line1, city: b.city, state: b.state, zip: b.postal_code },
    lines, tax, adjustment, tip, total,
    netPaid, amountDue,
    amountRefunded: refunded,
    paymentLabel,
  }, brandFor(biz.slug));

  const { from } = emailConfig(biz.slug);
  const result = await sendEmail({ slug: biz.slug, to: b.customer.email, subject, html, replyTo: from });
  if (!result.sent) return res.status(502).json({ error: 'Email failed to send: ' + (result.skipped || result.error || 'unknown error') });
  try {
    await db.from('booking_notes').insert({
      booking_id: b.id, business_id: biz.id,
      body: `${kind === 'invoice' ? 'Invoice' : kind === 'refunded' ? 'Refund receipt' : 'Receipt'} emailed to ${b.customer.email}`,
      author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null,
      author_name: adminAuthorName(auth),
    });
  } catch (e) { console.warn('[receipt] note log failed:', e.message); }
  console.log(`[receipt] ${kind} for ${id} sent by ${auth.name || auth.role} to ${b.customer.email}`);
  return res.status(200).json({ ok: true, kind, to: b.customer.email });
}

function escHtml(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function invoiceSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });

  const cols = (withAcct) => `id, scheduled_at, status, on_the_way_at, completed_at, price, tip, amount_paid, amount_refunded, payment_status, sms_consent, stripe_payment_intent_id, metadata,
      ${withAcct ? 'stripe_account, ' : ''}
      address_line1, city, state, postal_code,
      customer:customers ( name, email, phone ),
      technician:technicians!technician_id ( name ),
      service_area:service_areas ( timezone ),
      line_items:booking_line_items ( name, kind, quantity, line_total )`;
  let { data: b, error } = await db.from('bookings').select(cols(true)).eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (error && missingColumn(error.message) === 'stripe_account') {
    ({ data: b, error } = await db.from('bookings').select(cols(false)).eq('id', id).eq('business_id', biz.id).maybeSingle());
  }
  if (error) throw error;
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (!b.customer?.email) return res.status(400).json({ error: 'No customer email on file for this job.' });
  if (String(b.payment_status || '').toLowerCase() === 'refunded') return res.status(400).json({ error: 'This job was refunded. Nothing to invoice.' });
  if (b.status === 'cancelled') return res.status(400).json({ error: 'This job is cancelled. Nothing to invoice.' });
  if (!emailNotificationsOn()) return res.status(503).json({ error: 'Email notifications are turned off.' });

  const total = Number(b.price) || 0;
  const tip = Number(b.tip) || 0;
  const paid = Number(b.amount_paid) || 0;
  const refunded = Number(b.amount_refunded) || 0;
  let netPaid = Math.max(0, Math.round((paid - refunded) * 100) / 100);
  let amountDue = Math.max(0, Math.round((total + tip - netPaid) * 100) / 100);
  let balanceInvoice = false;
  if (String(b.payment_status || '').toLowerCase() === 'paid') {
    try { amountDue = (await balanceDueFor(b, { account: b.stripe_account || null, slug: biz.slug })).dueCents / 100; }
    catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    netPaid = Math.max(0, Math.round((total + tip - amountDue) * 100) / 100);
    balanceInvoice = true;
  }
  if (amountDue <= 0) return res.status(400).json({ error: 'Nothing is owed on this job — there is no balance to invoice.' });

  const allLines = b.line_items || [];
  const isTax = (li) => /^tax\b/i.test(String(li.name || ''));
  const explicitTax = allLines.filter(isTax).reduce((s, li) => s + (Number(li.line_total) || 0), 0);
  const lines = allLines.filter(li => !isTax(li)).map(li => ({ label: li.name, qty: li.quantity, amount: li.line_total }));
  const subtotal = lines.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const gap = Math.round((total - (subtotal + explicitTax)) * 100) / 100;
  const gapIsTax = gap > 0 && subtotal > 0;
  const tax = explicitTax + (gapIsTax ? gap : 0);
  const adjustment = gapIsTax ? 0 : gap;

  const tz = b.service_area?.timezone || biz.timezone || 'Asia/Manila';
  const longDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };

  const acct = { account: b.stripe_account || null, slug: biz.slug };
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const brand = brandFor(biz.slug);
  const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

  let payUrl = null;
  if (stripeConfigured(acct)) {
    try {
      const session = await stripe('/checkout/sessions', {
        method: 'POST', ...acct,
        body: {
          mode: 'payment',
          customer_email: b.customer.email,
          'payment_method_types[0]': 'card',
          'line_items[0][quantity]': 1,
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][unit_amount]': Math.round(amountDue * 100),
          'line_items[0][price_data][product_data][name]': `Invoice — ${brand.name}`,
          success_url: `${baseUrl}/pay.html?booking=${encodeURIComponent(b.id)}&business=${encodeURIComponent(biz.slug)}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/pay.html?booking=${encodeURIComponent(b.id)}&business=${encodeURIComponent(biz.slug)}&canceled=1`,
          'metadata[booking_id]': b.id,
          'metadata[business_slug]': biz.slug,
          ...(balanceInvoice ? { 'metadata[balance]': '1' } : {}),
          ...(!(b.on_the_way_at || b.completed_at || b.status === 'on_the_way' || b.status === 'completed') ? { 'payment_method_options[card][request_three_d_secure]': 'any' } : {}),
        },
      });
      payUrl = session.url;
    } catch (e) {
      console.error('[invoice] Stripe Checkout session failed, invoice not sent:', e.message);
      return res.status(502).json({ error: 'Stripe refused the pay link, so nothing was sent: ' + e.message });
    }
  }

  const { subject, html } = receiptEmail({
    kind: 'invoice',
    receiptNo: String(b.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
    customerName: b.customer.name || 'Customer',
    serviceDate: longDate(b.scheduled_at),
    technicianName: b.technician?.name || null,
    address: { line1: b.address_line1, city: b.city, state: b.state, zip: b.postal_code },
    lines, tax, adjustment, tip, total,
    netPaid, amountDue,
    amountRefunded: refunded,
    payUrl,
  }, brand);

  const invNote = auth.role === 'owner' ? String(body.note || '').trim().slice(0, 300) : '';
  const noteHtml = invNote ? `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;padding:14px 16px;margin:0 0 12px;background:#f8fafc;border-radius:8px;">${escHtml(invNote)}</div>` : '';
  const htmlOut = noteHtml ? (/<body[^>]*>/i.test(html) ? html.replace(/(<body[^>]*>)/i, '$1' + noteHtml) : noteHtml + html) : html;
  const { from } = emailConfig(biz.slug);
  const emailResult = await sendEmail({ slug: biz.slug, to: b.customer.email, subject: `You have an invoice from ${brand.name || biz.name}`, html: htmlOut, replyTo: from });
  if (!emailResult.sent) return res.status(502).json({ error: 'Email failed to send: ' + (emailResult.skipped || emailResult.error || 'unknown error') });

  let smsResult = { ok: false, skipped: 'no_phone' };
  const invGate = b.customer.phone ? await staffTextGate(db, b.customer.phone, b.sms_consent === true) : null;
  if (b.customer.phone && !invGate.ok) {
    smsResult = { ok: false, skipped: 'no_sms_consent' };
  } else if (b.customer.phone) {
    const text = payUrl
      ? `${invNote ? invNote + ' ' : ''}You have an invoice for ${money(amountDue)}. Pay securely here: ${payUrl}`
      : `You have an invoice for ${money(amountDue)}. Check your email for details, or call us to pay.`;
    smsResult = await sendSMSResult(b.customer.phone, text);
    await logAutomatedMessage(db, { businessId: biz.id, customerPhone: b.customer.phone, body: text, result: smsResult });
  }

  try {
    await db.from('booking_notes').insert({
      booking_id: b.id, business_id: biz.id,
      body: `Invoice sent to ${b.customer.email}${smsResult.ok ? ' + text' : ''} — ${money(amountDue)} due${payUrl ? ' (with pay link)' : ''}`,
      author_kind: auth.role === 'owner' ? 'owner' : 'secretary', author_id: null,
      author_name: adminAuthorName(auth),
    });
  } catch (e) { console.warn('[invoice] note log failed:', e.message); }

  console.log(`[invoice] sent for ${id} by ${auth.name || auth.role} to ${b.customer.email}${smsResult.ok ? ' + sms' : ''}`);
  return res.status(200).json({
    ok: true, kind: 'invoice', to: b.customer.email, amountDue,
    sms: smsResult.ok ? 'sent' : (smsResult.skipped || smsResult.error || 'not_sent'),
    payUrl: !!payUrl,
  });
}

async function reviewInviteSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can send review invites' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = (body.technician_id || '').toString();
  if (!id) return res.status(400).json({ error: 'technician_id required' });
  const { data: t, error } = await db.from('technicians')
    .select('id, name, phone, business_id, active').eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (error) throw error;
  if (!t) return res.status(404).json({ error: 'Cleaner not found' });
  if (t.active === false) return res.status(400).json({ error: `${t.name} is deactivated. Reactivate them before sending a review invite.` });
  if (!t.phone) return res.status(400).json({ error: `${t.name} has no phone number set` });

  const token = signToken({ kind: 'tech', tech_id: t.id, business_id: t.business_id, sess: 1 }, 14 * 24 * 3600);
  const base = process.env.PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://tidyhaus-crm.vercel.app');
  const link = `${base}/tech.html?login=${encodeURIComponent(token)}#reviews`;
  const message = `Want a FREE $100 added to your payroll? Leave us a review. Tap the link, it signs you in and shows you exactly what to do: ${link}`;
  const r = await sendSMSResult(t.phone, message);
  if (!r.ok) {
    const why = r.error ? `: ${r.error}` : (r.skipped ? ` (${r.skipped})` : '');
    return res.status(502).json({ error: `Text did not send${why}` });
  }
  const sentAt = new Date().toISOString();
  try { await db.from('technicians').update({ review_invite_sent_at: sentAt }).eq('id', t.id); } catch { /* column may predate 0090 */ }
  return res.status(200).json({ ok: true, sent_at: sentAt });
}

function isJoeyLogin(auth) { return !!auth && auth.role === 'secretary' && auth.name === 'Joey'; }
async function techInvites(req, res, db, auth) {
  if (auth.role !== 'owner' && !isJoeyLogin(auth)) return res.status(403).json({ error: 'Only the owner can manage technician invites' });
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data: areas, error: aErr } = await db.from('service_areas')
    .select('id, name, unstaffed, active').eq('business_id', biz.id).order('name');
  if (aErr) throw aErr;
  const { data: techs } = await db.from('technicians')
    .select('name, service_area_id').eq('business_id', biz.id).eq('active', true);
  const metros = (areas || []).filter(a => a.active).map(a => ({
    id: a.id, name: a.name, unstaffed: !!a.unstaffed,
    techs: (techs || []).filter(t => t.service_area_id === a.id).map(t => t.name),
  }));
  if (biz.slug === 'tidyhaus') {
    const { data: domsBiz } = await db.from('businesses').select('id').eq('slug', 'doms').maybeSingle();
    if (domsBiz) {
      const [{ data: dAreas }, { data: dTechs }] = await Promise.all([
        db.from('service_areas').select('id, name, unstaffed, active').eq('business_id', domsBiz.id).order('name'),
        db.from('technicians').select('name, service_area_id').eq('business_id', domsBiz.id).eq('active', true),
      ]);
      for (const a of (dAreas || []).filter(x => x.active)) {
        metros.push({ id: a.id, name: "Dom's · " + a.name, unstaffed: !!a.unstaffed, business: 'doms',
          techs: (dTechs || []).filter(t => t.service_area_id === a.id).map(t => t.name) });
      }
    }
  }

  const { data: rows, error } = await db.from('tech_invites')
    .select('id, code, status, expires_at, invitee_name, invitee_phone, max_jobs_per_day, service_area_id, created_at, sent_at, send_count, last_sms_log_id, opened_at, open_count, joined_at, technician_id')
    .eq('business_id', biz.id).order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  const cutoff = Date.now() - 30 * 864e5;
  const recent = (rows || []).filter(r => r.status === 'pending' || new Date(r.created_at).getTime() >= cutoff);

  const logById = new Map(), techById = new Map();
  try {
    const ids = recent.map(r => r.last_sms_log_id).filter(Boolean);
    if (ids.length) {
      const { data } = await db.from('tech_sms_log').select('id, status, error, skip_reason').in('id', ids);
      for (const l of data || []) logById.set(l.id, l);
    }
  } catch { /* cosmetic */ }
  try {
    const ids = recent.map(r => r.technician_id).filter(Boolean);
    if (ids.length) {
      const { data } = await db.from('technicians').select('id, name, active').in('id', ids);
      for (const t of data || []) techById.set(t.id, t);
    }
  } catch { /* cosmetic */ }
  const areaName = new Map((areas || []).map(a => [a.id, a.name]));
  const areaOff = new Set((areas || []).filter(a => !a.active).map(a => a.id));

  const invites = recent.map(r => {
    const log = r.last_sms_log_id ? logById.get(r.last_sms_log_id) : null;
    const t = r.technician_id ? techById.get(r.technician_id) : null;
    const st = inviteState(r);
    return {
      id: r.id, state: (st === 'open' && areaOff.has(r.service_area_id)) ? 'revoked' : st, link: inviteLink(r.code),
      name: r.invitee_name, phone: r.invitee_phone, metro: areaName.get(r.service_area_id) || '',
      max_jobs_per_day: r.max_jobs_per_day, expires_at: r.expires_at, created_at: r.created_at,
      sent_at: r.sent_at, send_count: r.send_count, opened_at: r.opened_at, open_count: r.open_count,
      joined_at: r.joined_at,
      sms: log ? { status: log.status, error: log.error || (log.skip_reason ? smsFailReason({ skipped: log.skip_reason }) : null) } : null,
      technician: t ? { id: t.id, name: t.name, active: t.active } : null,
    };
  });
  if (auth.role !== 'owner') {
    return res.status(200).json({ invites: invites.filter(i => i.state === 'open').map(i => ({
      id: i.id, state: i.state, name: i.name, phone: i.phone, metro: i.metro, created_at: i.created_at,
      sent_at: i.sent_at, expires_at: i.expires_at, opened_at: i.opened_at, open_count: i.open_count, link: null,
    })) });
  }
  return res.status(200).json({ invites, metros });
}

async function textTechInvite(db, biz, area, inv) {
  const message = inviteSmsText({
    brand: inviteBrand(biz.slug, biz.name), name: inv.invitee_name, metro: area.name,
    link: inviteLink(inv.code), expiresLabel: fmtExpiry(inv.expires_at, area.timezone),
  });
  const r = await sendTechSms(db, { kind: 'tech_invite', businessId: biz.id, phone: inv.invitee_phone, message });
  const patch = { last_sms_log_id: r.logId || null };
  if (r.ok) { patch.sent_at = new Date().toISOString(); patch.send_count = (inv.send_count || 0) + 1; }
  try { await db.from('tech_invites').update(patch).eq('id', inv.id); } catch { /* bookkeeping */ }
  return r.ok ? { ok: true } : { ok: false, reason: smsFailReason(r) };
}

async function techInviteCreate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can invite technicians' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (isLeadGenSlug(biz.slug) && PARTNER_SLUG[biz.slug]) {
    return res.status(400).json({ error: `${biz.name} uses TidyHaus's technicians. Switch to TidyHaus or Dom's to invite someone.` });
  }
  const areaId = String(body.service_area_id || '');
  const { data: area } = areaId
    ? await db.from('service_areas').select('id, name, timezone, active').eq('id', areaId).eq('business_id', biz.id).maybeSingle()
    : { data: null };
  if (!area || !area.active) return res.status(400).json({ field: 'metro', error: 'Pick the metro they will work.' });

  const name = String(body.name || '').replace(/[\x00-\x1f\x7f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
  let phone = null;
  if (String(body.phone || '').trim()) {
    phone = toE164(body.phone);
    if (!phone || !/^\+1\d{10}$/.test(phone)) return res.status(400).json({ field: 'phone', error: 'Enter a 10-digit US cell number, or leave it blank and just copy the link.' });
  }
  const sendSms = body.send_sms === true;
  if (sendSms && !phone) return res.status(400).json({ field: 'phone', error: 'Add their cell number to text the invite.' });
  let cap = null;
  if (body.max_jobs_per_day != null && String(body.max_jobs_per_day).trim() !== '') {
    cap = Math.max(0, Math.floor(Number(body.max_jobs_per_day)) || 0);
  }

  if (phone) {
    const d10 = digits10(phone);
    const { data: owners, error: oErr } = await db.from('technicians')
      .select('name, active, business_id, phone, businesses ( name )').not('phone', 'is', null);
    if (oErr) throw oErr;
    const hits = (owners || []).filter(t => digits10(t.phone) === d10);
    const live = hits.find(t => t.active);
    if (live) return res.status(409).json({ code: 'PHONE_IN_USE', error: `That number already belongs to ${live.name} (${live.businesses?.name || 'an active cleaner'}). They can already sign in to the cleaner app.` });
    const old = hits.find(t => !t.active && t.business_id === biz.id);
    if (old) return res.status(409).json({ code: 'PAST_PROFILE', error: `That number is on ${old.name}'s old profile. Tap "Show inactive techs", then Activate and Set PIN on their card instead of sending an invite.` });
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 864e5).toISOString();
  let inv = null;
  if (phone) {
    const { data: pend, error: pErr } = await db.from('tech_invites')
      .select('id, invitee_phone').eq('business_id', biz.id).eq('status', 'pending').not('invitee_phone', 'is', null);
    if (pErr) throw pErr;
    const same = (pend || []).find(p => digits10(p.invitee_phone) === digits10(phone));
    if (same) {
      const { data, error } = await db.from('tech_invites')
        .update({ service_area_id: area.id, invitee_name: name, invitee_phone: phone, max_jobs_per_day: cap, expires_at: expiresAt })
        .eq('id', same.id).eq('status', 'pending').select('*').maybeSingle();
      if (error) throw error;
      inv = data;
    }
  }
  if (!inv) {
    const { data, error } = await db.from('tech_invites').insert({
      business_id: biz.id, service_area_id: area.id, code: newInviteCode(),
      invitee_name: name, invitee_phone: phone, max_jobs_per_day: cap,
      expires_at: expiresAt, created_by: adminAuthorName(auth),
    }).select('*').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ code: 'INVITE_EXISTS', error: 'An invite for that number was just created. Close this and check the invite list.' });
      throw error;
    }
    inv = data;
  }

  const sms = sendSms ? await textTechInvite(db, biz, area, inv) : null;
  console.log(`[tech-invite] ${biz.slug}/${area.name} ${phone ? '..' + phone.slice(-4) : 'link-only'} sms=${sms ? (sms.ok ? 'sent' : sms.reason) : 'not requested'}`);
  return res.status(200).json({ ok: true, invite: { id: inv.id, expires_at: inv.expires_at }, link: inviteLink(inv.code), sms });
}

async function techInviteSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const joey = auth.role !== 'owner';
  if (joey && !isJoeyLogin(auth)) return res.status(403).json({ error: 'Only the owner can send technician invites' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  const { data: inv, error } = await db.from('tech_invites')
    .select('id, status, invitee_phone, service_area_id, send_count')
    .eq('id', String(body.id)).eq('business_id', biz.id).maybeSingle();
  if (error) throw error;
  if (!inv) return res.status(404).json({ error: 'Invite not found' });
  if (inv.status !== 'pending') return res.status(409).json({ error: inv.status === 'joined' ? 'They already signed up.' : 'This invite was canceled.' });
  if (joey && !inv.invitee_phone) return res.status(400).json({ error: 'No phone on this invite.' });
  const { data: area } = await db.from('service_areas').select('name, timezone, active').eq('id', inv.service_area_id).maybeSingle();
  if (area && area.active === false) return res.status(409).json({ error: 'That metro is switched off, so this link can never be used. Cancel it.' });
  const { data: upd, error: uErr } = await db.from('tech_invites')
    .update({ expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 864e5).toISOString() })
    .eq('id', inv.id).eq('status', 'pending')
    .select('id, code, invitee_name, invitee_phone, expires_at, send_count').maybeSingle();
  if (uErr) throw uErr;
  if (!upd) return res.status(409).json({ error: 'This invite was just used or canceled.' });
  if (!upd.invitee_phone) return res.status(200).json({ ok: true, sms: null, expires_at: upd.expires_at, link: inviteLink(upd.code) });
  if ((upd.send_count || 0) >= 5) {
    return res.status(200).json({ ok: false, sms: { ok: false, reason: 'already texted 5 times' }, expires_at: upd.expires_at, link: joey ? null : inviteLink(upd.code) });
  }
  const sms = await textTechInvite(db, biz, area || { name: 'your area', timezone: null }, upd);
  if (joey) return res.status(200).json({ ok: sms.ok, sms, expires_at: upd.expires_at });
  return res.status(200).json({ ok: sms.ok, sms, expires_at: upd.expires_at, link: inviteLink(upd.code) });
}

async function techInviteRevoke(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can cancel technician invites' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  const { data, error } = await db.from('tech_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: adminAuthorName(auth) })
    .eq('id', String(body.id)).eq('business_id', biz.id).eq('status', 'pending').select('id');
  if (error) throw error;
  if (!data || !data.length) return res.status(409).json({ error: 'That invite was already used or canceled. To stop a cleaner who joined, Deactivate them.' });
  return res.status(200).json({ ok: true });
}

async function technicianUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  const { data: existing } = await db.from('technicians').select('id').eq('id', id).eq('business_id', biz.id).single();
  if (!existing) return res.status(404).json({ error: 'Cleaner not found' });

  const patch = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.phone !== undefined) patch.phone = body.phone || null;
  if (body.email !== undefined) patch.email = body.email || null;
  if (body.color !== undefined) patch.color = body.color || null;
  if (body.active !== undefined) patch.active = !!body.active;
  if (auth.role === 'owner' && body.max_jobs_per_day !== undefined) {
    const v = body.max_jobs_per_day;
    patch.max_jobs_per_day = (v === '' || v == null) ? null : Math.max(0, Math.floor(Number(v)) || 0);
  }
  if (auth.role === 'owner' && body.booking_priority !== undefined) {
    patch.booking_priority = Math.min(9, Math.max(0, Math.floor(Number(body.booking_priority)) || 0));
  }
  if (body.bio_years !== undefined) {
    const v = body.bio_years;
    patch.bio_years = (v === '' || v == null) ? null : Math.max(0, Math.floor(Number(v)) || 0);
  }
  if (body.bio_blurb !== undefined) patch.bio_blurb = (body.bio_blurb || '').toString().trim().slice(0, 400) || null;
  if (Object.keys(patch).length) {
    const { error } = await db.from('technicians').update(patch).eq('id', id).eq('business_id', biz.id);
    if (error && error.code === '23505') {
      const activeClash = /uq_technicians_active_phone10/.test(`${error.message || ''} ${error.details || ''}`);
      return res.status(409).json({ error: activeClash
        ? 'That phone number is already on another active technician.'
        : 'That phone number is already on another technician in this business (it may be inactive: tap "Show inactive techs" and clear it there first).' });
    }
    if (error) throw error;
  }

  if (body.pin) {
    if (!/^\d{4}$/.test(String(body.pin))) return res.status(400).json({ error: 'PIN must be 4 digits' });
    const { error } = await db.rpc('set_technician_pin', { p_id: id, p_pin: String(body.pin) });
    if (error) throw error;
  }
  return res.status(200).json({ ok: true });
}

async function technicianPhotoUpload(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: existing } = await db.from('technicians').select('id, photo_url').eq('id', id).eq('business_id', biz.id).single();
  if (!existing) return res.status(404).json({ error: 'Cleaner not found' });

  const up = await uploadImage(body.image, `tech-photos/${biz.id}/${id}`);
  const { error } = await db.from('technicians').update({ photo_url: up.url }).eq('id', id).eq('business_id', biz.id);
  if (error) throw error;
  return res.status(200).json({ ok: true, photo_url: up.url });
}

async function techAvailability(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const techId = (req.query.tech_id || '').toString();
  if (!techId) return res.status(400).json({ error: 'tech_id required' });
  const { data: tech } = await db.from('technicians').select('id').eq('id', techId).eq('business_id', biz.id).single();
  if (!tech) return res.status(404).json({ error: 'Cleaner not found' });

  const { data, error } = await db.from('technician_availability')
    .select('day_of_week, slot_key').eq('technician_id', techId);
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const { data: exc, error: e2 } = await db.from('technician_availability_exceptions')
    .select('exception_date, slot_key, is_available')
    .eq('technician_id', techId)
    .gte('exception_date', today)
    .order('exception_date');
  if (e2) throw e2;

  return res.status(200).json({
    slots: SLOTS, days: DAYS,
    availability: (data || []).map(r => ({ day_of_week: r.day_of_week, slot_key: r.slot_key })),
    exceptions: (exc || []).map(r => ({ date: r.exception_date, slot_key: r.slot_key, is_available: r.is_available })),
  });
}

async function techAvailabilitySet(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const techId = (body.tech_id || '').toString();
  if (!techId) return res.status(400).json({ error: 'tech_id required' });
  const { data: tech } = await db.from('technicians').select('id').eq('id', techId).eq('business_id', biz.id).single();
  if (!tech) return res.status(404).json({ error: 'Cleaner not found' });

  let rows;
  try { rows = normalizeSlots(body.slots); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  await db.from('technician_availability').delete().eq('technician_id', techId);
  if (rows.length) {
    const { error } = await db.from('technician_availability').insert(
      rows.map(r => ({ business_id: biz.id, technician_id: techId, ...r }))
    );
    if (error) throw error;
  }
  return res.status(200).json({ ok: true, count: rows.length });
}

async function techAvailabilityExceptionSet(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const techId = (body.tech_id || '').toString();
  if (!techId) return res.status(400).json({ error: 'tech_id required' });
  const { data: tech } = await db.from('technicians').select('id').eq('id', techId).eq('business_id', biz.id).single();
  if (!tech) return res.status(404).json({ error: 'Cleaner not found' });

  let date, rows;
  try {
    date = assertDate(body.date);
    const dow = dayOfWeekFor(date);
    const { data: recur, error } = await db.from('technician_availability')
      .select('slot_key').eq('technician_id', techId).eq('day_of_week', dow);
    if (error) throw error;
    rows = computeExceptionRows((recur || []).map(r => r.slot_key), body.selected);
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  await db.from('technician_availability_exceptions')
    .delete().eq('technician_id', techId).eq('exception_date', date);
  if (rows.length) {
    const { error } = await db.from('technician_availability_exceptions').insert(
      rows.map(r => ({ business_id: biz.id, technician_id: techId, exception_date: date, ...r }))
    );
    if (error) throw error;
  }
  return res.status(200).json({ ok: true, date, count: rows.length });
}

let bookingLiftCols = true;
let extraSlotsCol = true;
const esCol = () => (extraSlotsCol ? ', extra_slots' : '');
const esOf = (b) => (extraSlotsCol && Array.isArray(b && b.extra_slots)) ? b.extra_slots : [];
const isExtraSlotsErr = (e) => /extra_slots/.test((e && e.message) || '');
let amountRefundedCol = true;
const arCol = () => (amountRefundedCol ? ', amount_refunded' : '');
const isAmountRefundedErr = (e) => /amount_refunded/.test((e && e.message) || '');
let sortOrderCol = true;
const isSortOrderErr = (e) => /sort_order/.test((e && e.message) || '');
let confirmationEmailCol = true;
const isConfirmationEmailErr = (e) => /confirmation_email_status|confirmation_email_sent_at/.test((e && e.message) || '');
function bookingSelect() {
  const base = `id, status, source, metadata, scheduled_at, scheduled_end, duration_minutes, price, subtotal, tip, payment_status, paid_at, on_the_way_at, completed_at, amount_paid, stripe_payment_intent_id, payment_method, sms_consent,
          notes, customer_notes, review_rating, review_text, technician_id, service_area_id, business_id, updated_at, created_at, zenbooker_job_number${esCol()}${arCol()},
          on_the_way_sms_status, on_the_way_sms_sent_at, on_the_way_sms_delivered_at,
          review_sms_status, review_sms_sent_at, review_sms_delivered_at,
          review_email_sent_at, review_email_delivered_at, review_email_clicked_at${confirmationEmailCol ? ', confirmation_email_status, confirmation_email_sent_at' : ''},
          address_line1, address_line2, city, state, postal_code,
          business:businesses ( slug ),
          customer:customers ( id, name, phone, email ),
          technician:technicians!technician_id ( id, name, status, color, business_id, business:businesses ( name ) ),
          service:services ( id, name ),
          photos:booking_photos ( count ),
          notes_list:booking_notes ( count ),
          line_items:booking_line_items ( option_id, name, kind, quantity, unit_price, line_total )`;
  return bookingLiftCols
    ? `${base}, secondary_technician_id, needs_lifting, tv_size_category,
          secondary_technician:technicians!secondary_technician_id ( id, name, status, color, business_id, business:businesses ( name ) )`
    : base;
}
async function fetchBookingRows(makeQuery) {
  const run = () => {
    let q = makeQuery(bookingSelect());
    if (sortOrderCol) q = q.order('sort_order', { ascending: true, foreignTable: 'booking_line_items' });
    return q;
  };
  let { data, error } = await run();
  if (error && isSortOrderErr(error)) { sortOrderCol = false; ({ data, error } = await run()); }
  if (error && isConfirmationEmailErr(error)) { confirmationEmailCol = false; ({ data, error } = await run()); }
  if (error && (/secondary_technician_id|needs_lifting|tv_size_category/.test(error.message || '') || isExtraSlotsErr(error) || isAmountRefundedErr(error))) {
    if (/secondary_technician_id|needs_lifting|tv_size_category/.test(error.message || '')) bookingLiftCols = false;
    if (isExtraSlotsErr(error)) extraSlotsCol = false;
    if (isAmountRefundedErr(error)) amountRefundedCol = false;
    ({ data, error } = await run());
  }
  return { data, error };
}

function economicsSelect() {
  const base = `id, status, payment_status, payment_method, amount_paid, price, subtotal, tip, notes, customer_notes${arCol()},
          zenbooker_job_number, scheduled_at, created_at, postal_code, service_area_id,
          service:services ( name ),
          technician:technicians!technician_id ( name ),
          line_items:booking_line_items ( name, kind, quantity, unit_price, line_total )`;
  return bookingLiftCols
    ? `${base}, secondary_technician:technicians!secondary_technician_id ( name )`
    : base;
}
async function fetchEconomicsRows(makeQuery) {
  let { data, error } = await makeQuery(economicsSelect());
  const codeOk = (e) => e.code === '42703' || String(e.code || '').startsWith('PGRST');
  if (error && codeOk(error) && /secondary_technician_id/.test(error.message || '')) {
    bookingLiftCols = false;
    ({ data, error } = await makeQuery(economicsSelect()));
  }
  if (error && codeOk(error) && isAmountRefundedErr(error)) {
    amountRefundedCol = false;
    ({ data, error } = await makeQuery(economicsSelect()));
  }
  return { data, error };
}

function shapeBooking(b) {
  return {
    id: b.id,
    cash_paid: b.payment_status === 'paid' && b.payment_method === 'cash' && !b.stripe_payment_intent_id,
    status: b.status,
    source: b.source,
    booked_by: b.metadata?.booked_by || null,
    created_at: b.created_at || null,
    li_rev: Number(b.metadata?.li_rev) || 0,
    rescheduled_from: b.metadata?.rescheduled_from || null,
    series_id: b.metadata?.series_id || null, series_every: b.metadata?.series_every || null, series_index: Number(b.metadata?.series_index) || 0,
    stripe_pk: bookingStripePk(b.business?.slug || null),
    scheduled_at: b.scheduled_at,
    scheduled_end: b.scheduled_end,
    duration_minutes: b.duration_minutes,
    extra_slots: esOf(b),
    price: b.price,
    tip: b.tip,
    payment_status: b.payment_status,
    amount_paid: b.amount_paid != null ? Number(b.amount_paid) : null,
    paid_by_card: !!b.stripe_payment_intent_id,
    amount_refunded: amountRefundedCol ? (b.amount_refunded || null) : null,
    paid_at: b.paid_at,
    sms_consent: typeof b.sms_consent === 'boolean' ? b.sms_consent : null,
    confirmation_email_status: b.confirmation_email_status || null,
    confirmation_email_sent_at: b.confirmation_email_sent_at || null,
    on_the_way_sms_status: b.on_the_way_sms_status || null,
    on_the_way_sms_sent_at: b.on_the_way_sms_sent_at || null,
    on_the_way_sms_delivered_at: b.on_the_way_sms_delivered_at || null,
    review_sms_status: b.review_sms_status || null,
    review_sms_sent_at: b.review_sms_sent_at || null,
    review_sms_delivered_at: b.review_sms_delivered_at || null,
    review_email_sent_at: b.review_email_sent_at || null,
    review_email_delivered_at: b.review_email_delivered_at || null,
    review_email_clicked_at: b.review_email_clicked_at || null,
    notes: b.notes,
    customer_notes: b.customer_notes,
    review_rating: b.review_rating,
    review_text: b.review_text,
    technician_id: b.technician_id,
    secondary_technician_id: b.secondary_technician_id,
    needs_lifting: b.needs_lifting,
    tv_size_category: b.tv_size_category,
    service_area_id: b.service_area_id,
    business_id: b.business_id,
    cross_company: !!(b.technician?.business_id && b.business_id && b.technician.business_id !== b.business_id),
    partner_company: b.technician?.business?.name || null,
    address: formatAddress(b),
    address_line1: b.address_line1 || '',
    address_line2: b.address_line2 || '',
    city: b.city || '',
    state: b.state || '',
    postal_code: b.postal_code || '',
    customer: b.customer || null,
    technician: b.technician ? { id: b.technician.id, name: b.technician.name, status: b.technician.status, color: b.technician.color } : null,
    secondary_technician: b.secondary_technician ? {
      id: b.secondary_technician.id, name: b.secondary_technician.name,
      status: b.secondary_technician.status, color: b.secondary_technician.color,
      company: b.secondary_technician.business?.name || null,
      cross_company: !!(b.secondary_technician.business_id && b.business_id && b.secondary_technician.business_id !== b.business_id),
    } : null,
    service: b.service || null,
    line_items: Array.isArray(b.line_items) ? b.line_items.map(li => ({
      option_id: li.option_id || null,
      label: li.name,
      kind: li.kind,
      quantity: Number(li.quantity) || 1,
      price: Number(li.unit_price) || 0,
      line_total: Number(li.line_total) || 0,
    })) : [],
    photo_count: Array.isArray(b.photos) ? (b.photos[0]?.count || 0) : 0,
    note_count: Array.isArray(b.notes_list) ? (b.notes_list[0]?.count || 0) : 0,
  };
}

async function review(req, res, body) {
  if (req.method === 'GET') return reviewCheck(req, res, body);
  if (req.method === 'POST') return reviewSubmit(req, res, body);
  return res.status(405).json({ error: 'Method not allowed' });
}


async function reviewCheck(req, res, body) {
  const token = req.query.token || '';
  if (!token) return res.status(400).json({ error: 'token required' });

  const reviewToken = verifyToken(token);
  if (!reviewToken || !reviewToken.booking_id) return res.status(401).json({ error: 'Invalid token' });

  if (reviewToken.booking_id === 'TEST') {
    const slug = reviewToken.business_slug === 'doms' ? 'doms' : 'tidyhaus';
    const reviewUrl = resolveGoogleReviewUrl({ slug, techName: 'Kregg', areaName: '', bookingId: 'TEST' });
    return res.status(200).json({
      booking_id: 'TEST', already_reviewed: false, review_url: reviewUrl,
      business_slug: slug, business_name: slug === 'doms' ? "Dom's Home Cleaning" : 'TidyHaus',
    });
  }

  const db = serviceClient();
  const { data: booking, error } = await db.from('bookings')
    .select('id, reviewed_at, city, state, postal_code, service_area:service_areas(name), technician:technicians!technician_id(name), business:businesses(slug, name, settings)')
    .eq('id', reviewToken.booking_id)
    .single();

  if (error || !booking) return res.status(404).json({ error: 'Booking not found' });

  db.from('bookings').update({ review_clicked_at: new Date().toISOString() })
    .eq('id', booking.id).is('review_clicked_at', null)
    .then(() => {}, () => {});

  const slug = booking.business?.slug || 'tidyhaus';
  const reviewUrl = (booking.business?.settings && booking.business.settings.review_url) || resolveGoogleReviewUrl({
    slug,
    techName: booking.technician?.name || '',
    areaName: booking.service_area?.name || '',
    bookingId: booking.id,
    state: booking.state, city: booking.city, zip: booking.postal_code,
  });

  return res.status(200).json({
    booking_id: booking.id,
    already_reviewed: !!booking.reviewed_at,
    review_url: reviewUrl,
    business_slug: slug,
    business_name: booking.business?.name || 'TidyHaus',
  });
}

async function reviewSubmit(req, res, body) {
  const token = body.token || '';
  const rating = parseInt(body.rating) || 0;
  const feedback = (body.feedback || '').trim();

  if (!token) return res.status(400).json({ error: 'token required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });

  const reviewToken = verifyToken(token);
  if (!reviewToken || !reviewToken.booking_id) return res.status(401).json({ error: 'Invalid token' });

  if (reviewToken.booking_id === 'TEST') return res.status(200).json({ ok: true, test: true });

  const db = serviceClient();

  const { data: booking, error: bErr } = await db.from('bookings')
    .select(`
      id, reviewed_at, customer_id, business_id, status, service_area_id,
      customer:customers(name, phone, email),
      technician:technicians!technician_id(id, name, phone),
      service_area:service_areas(name),
      business:businesses(id, slug, name, feedback_email)
    `)
    .eq('id', reviewToken.booking_id)
    .single();

  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.reviewed_at) return res.status(409).json({ error: 'Already reviewed' });

  const now = new Date().toISOString();
  const { error: uErr } = await db.from('bookings').update({
    review_rating: rating,
    review_text: feedback || null,
    reviewed_at: now,
  }).eq('id', booking.id);

  if (uErr) throw uErr;

  db.from('bookings').update({ review_clicked_at: now })
    .eq('id', booking.id).is('review_clicked_at', null)
    .then(() => {}, () => {});

  if (rating <= 4 && feedback && booking.business?.feedback_email) {
    await sendFeedbackEmail({
      to: booking.business.feedback_email,
      businessSlug: booking.business.slug,
      businessName: booking.business.name,
      customerName: booking.customer?.name || 'Customer',
      rating,
      feedback,
      technicianName: booking.technician?.name || 'Cleaner',
      serviceAreaName: booking.service_area?.name || 'Service Area',
    }).catch(err => console.warn('[review] email send failed:', err));
  }

  if (booking.technician?.phone && rating <= 4) {
    const techName = booking.technician.name || 'Cleaner';
    const msg = `${techName} you just received a bad review... Please check your profile to view.`;
    await sendSMS(booking.technician.phone, msg).catch(err => console.warn('[review] tech SMS send failed:', err));
  } else if (booking.technician?.phone && rating === 5) {
    const techName = booking.technician.name || 'Cleaner';
    const who = booking.customer?.name || 'A customer';
    const msg = `${techName}, ${who} just left you a 5-star review on ${booking.business?.name || 'the CRM'}! Nice work.`;
    await sendSMS(booking.technician.phone, msg).catch(err => console.warn('[review] tech SMS send failed:', err));
  }

  if (rating <= 4) {
    const ownerPhone = process.env.OWNER_PHONE_NUMBER;
    if (ownerPhone) {
      const techName = booking.technician?.name || 'Cleaner';
      const msg = `${techName} received a ${rating}-star review on ${booking.business?.name || 'a booking'}. Customer: ${booking.customer?.name || 'Unknown'}`;
      await sendSMS(ownerPhone, msg).catch(err => console.warn('[review] owner SMS send failed:', err));
    }
  }

  return res.status(200).json({ ok: true, review_rating: rating });
}


async function sendFeedbackEmail(params) {
  const contactBlock = await recipientContactBlock('email', params.to);
  if (contactBlock) return { sent: false, skipped: contactBlock };
  if (!emailNotificationsOn()) { console.log('[review] notifications disabled; feedback email not sent'); return; }
  const { apiKey, from } = emailConfig(params.businessSlug);
  if (!apiKey) {
    console.log('[review] Resend key not set, logging feedback:', params);
    return;
  }

  const html = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2>Customer Feedback: ${params.rating} Star${params.rating === 1 ? '' : 's'}</h2>
  <p><strong>Customer:</strong> ${params.customerName}</p>
  <p><strong>Business:</strong> ${params.businessName}</p>
  <p><strong>Technician:</strong> ${params.technicianName}</p>
  <p><strong>Rating:</strong> ${'⭐'.repeat(params.rating)}</p>
  <hr>
  <p><strong>Feedback:</strong></p>
  <p style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap;">${params.feedback}</p>
</div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: `Customer Feedback: ${params.rating}⭐ from ${params.customerName}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error: ${res.status} ${err}`);
  }
}

const REVIEW_TRACK_COLS = `review_email_sent_at, review_email_count, review_email_id,
      review_email_delivered_at, review_email_status, review_email_clicked_at,
      review_sms_sent_at, review_sms_delivered_at, review_sms_status, review_sms_clicked_at,
      review_clicked_at, review_click_channel`;

function channelState(hasChannel, sentAt, deliveredAt, status, openedAt) {
  if (!hasChannel) return { eligible: false, sent_at: null, delivered_at: null, status: null, opened_at: null };
  const resolvedStatus = status || (deliveredAt ? 'delivered' : (sentAt ? 'sent' : null));
  return { eligible: true, sent_at: sentAt || null, delivered_at: deliveredAt || null, status: resolvedStatus, opened_at: openedAt || null };
}

async function reviewRequests(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business || ''); } catch (e) { return bail(res, e); }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const cols = (t) => `id, scheduled_at, completed_at, review_rating, review_text, reviewed_at, review_token, metadata, sms_consent,
      ${t ? REVIEW_TRACK_COLS + ', ' : ''}
      customer:customers(name, email, phone), technician:technicians!technician_id(name)`;
  let hasTrack = true;
  let { data, error, count } = await db.from('bookings').select(cols(true), { count: 'exact' })
    .eq('business_id', biz.id).eq('status', 'completed')
    .order('scheduled_at', { ascending: false }).range(from, to);
  if (error && /review_(email|sms|click)/.test(error.message || '')) {
    hasTrack = false;
    ({ data, error, count } = await db.from('bookings').select(cols(false), { count: 'exact' })
      .eq('business_id', biz.id).eq('status', 'completed')
      .order('scheduled_at', { ascending: false }).range(from, to));
  }
  if (error) throw error;

  const rows = (data || []).map(b => {
    const hasEmail = !!b.customer?.email;
    const emailSentAt = (hasTrack ? b.review_email_sent_at : null) || b.metadata?.review_email_sent_at || null;
    const smsSentAt = (hasTrack ? b.review_sms_sent_at : null) || b.metadata?.review_sms_sent_at || null;
    const hasSms = !!b.customer?.phone && (!!b.sms_consent || !!smsSentAt);
    const emailOpenedAt = (hasTrack ? b.review_email_clicked_at : null)
      || b.metadata?.review_email_clicked_at
      || ((hasTrack ? b.review_click_channel : b.metadata?.review_click_channel) === 'email' ? (b.review_clicked_at || b.metadata?.review_clicked_at) : null) || null;
    const smsOpenedAt = (hasTrack ? b.review_sms_clicked_at : null)
      || b.metadata?.review_sms_clicked_at
      || ((hasTrack ? b.review_click_channel : b.metadata?.review_click_channel) === 'sms' ? (b.review_clicked_at || b.metadata?.review_clicked_at) : null) || null;
    const openedUnknownAt = (!emailOpenedAt && !smsOpenedAt)
      ? ((hasTrack ? b.review_clicked_at : null) || b.metadata?.review_clicked_at || b.reviewed_at || null)
      : null;
    return {
      id: b.id,
      customer_name: b.customer?.name || '—',
      technician_name: b.technician?.name || '—',
      completed_at: b.completed_at || b.scheduled_at || null,
      has_email: hasEmail,
      email_count: hasTrack ? (b.review_email_count || 0) : (emailSentAt ? 1 : 0),
      email: channelState(hasEmail, emailSentAt, hasTrack ? b.review_email_delivered_at : null, hasTrack ? b.review_email_status : null, emailOpenedAt),
      sms: channelState(hasSms, smsSentAt, hasTrack ? b.review_sms_delivered_at : null, hasTrack && !/^skipped_/.test(b.review_sms_status || '') ? b.review_sms_status : null, smsOpenedAt),
      opened_unknown_at: openedUnknownAt,
      rating: b.review_rating || null,
      review_text: b.review_text || null,
      reviewed_at: b.reviewed_at || null,
      tracking: hasTrack,
    };
  });

  const scoreboard = await reviewScoreboard(db, biz.id, hasTrack);
  return res.status(200).json({ requests: rows, page, limit, total: count || rows.length, scoreboard });
}

async function reviewScoreboard(db, businessId, hasTrack) {
  const windowDays = 30;
  if (!hasTrack) return { windowDays, email: null, sms: null };
  const sinceISO = new Date(Date.now() - windowDays * 86400000).toISOString();
  const { data, error } = await db.from('bookings')
    .select('review_email_sent_at, review_email_delivered_at, review_email_clicked_at, review_sms_sent_at, review_sms_delivered_at, review_sms_clicked_at, review_clicked_at, review_click_channel')
    .eq('business_id', businessId).eq('status', 'completed')
    .gte('scheduled_at', sinceISO);
  if (error || !data) return { windowDays, email: null, sms: null };

  const tally = (sentKey, deliveredKey, clickedKey) => {
    let sent = 0, delivered = 0, opened = 0;
    for (const b of data) {
      if (!b[sentKey]) continue;
      sent++;
      if (b[deliveredKey]) delivered++;
      const ch = clickedKey === 'review_sms_clicked_at' ? 'sms' : 'email';
      const openedAt = b[clickedKey] || (b.review_click_channel === ch ? b.review_clicked_at : null);
      if (openedAt) opened++;
    }
    return { sent, delivered, opened, openRate: sent ? Math.round((opened / sent) * 100) : null };
  };
  return {
    windowDays,
    email: tally('review_email_sent_at', 'review_email_delivered_at', 'review_email_clicked_at'),
    sms: tally('review_sms_sent_at', 'review_sms_delivered_at', 'review_sms_clicked_at'),
  };
}

async function reviewOfferSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const id = body.id; if (!id) return res.status(400).json({ error: 'id required' });
  const { data: b } = await db.from('bookings')
    .select('id, business_id, review_token, metadata, sms_consent, customer:customers(name, phone)').eq('id', id).maybeSingle();
  if (!b) return res.status(404).json({ error: 'Job not found' });
  const offer = b.metadata && b.metadata.loyalty_offer;
  if (!offer || !offer.text) return res.status(400).json({ error: 'No discount set on this job.' });
  if (offer.sent_at) return res.status(409).json({ error: 'The discount was already sent.' });
  if (!b.customer?.phone) return res.status(400).json({ error: 'No phone with texts on for this customer.' });
  if (gateRefuse(res, await staffTextGate(db, b.customer.phone, b.sms_consent === true))) return;
  await ensureReviewToken(db, b);
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const link = b.review_token ? `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(b.review_token)}&ch=sms` : '';
  const msg = String(offer.text).replace('{review_link}', link);
  const r = await sendSMSResult(b.customer.phone, msg);
  await logAutomatedMessage(db, { businessId: b.business_id, customerPhone: b.customer.phone, body: msg, result: r });
  if (!r.ok) return res.status(502).json({ error: 'Text failed to send: ' + (r.error || 'unknown error') });
  const sent = { ...offer, sent_at: new Date().toISOString(), sent_by: auth.name || 'office' };
  await db.from('bookings').update({ metadata: { ...(b.metadata || {}), loyalty_offer: sent } }).eq('id', id);
  return res.status(200).json({ ok: true });
}

async function reviewResend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  let biz;
  if (body.from_review_call) {
    if (auth.scope === 'tidyhaus') return res.status(403).json({ error: 'Review Calls is not available on this account.' });
    const { data: row } = await db.from('bookings')
      .select('id, business:businesses ( id, slug, name )').eq('id', id).maybeSingle();
    if (!row || !row.business) return res.status(404).json({ error: 'Booking not found' });
    biz = row.business;
  } else {
    try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  }
  const channel = body.channel === 'sms' ? 'sms' : 'email';
  const { data: b, error } = await db.from('bookings')
    .select('id, technician_id, review_token, metadata, sms_consent, review_sms_sent_at, review_sms_status, customer:customers(name, email, phone)')
    .eq('id', id).eq('business_id', biz.id).single();
  if (error || !b) return res.status(404).json({ error: 'Booking not found' });
  await ensureReviewToken(db, b);
  if (!b.review_token) return res.status(500).json({ error: 'Could not create a review link for this job. Try again.' });

  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (channel === 'sms') {
    if (!b.customer?.phone) return res.status(400).json({ error: 'No phone number on file for this job.' });
    if (gateRefuse(res, await staffTextGate(db, b.customer.phone, b.sms_consent === true))) return;
    const smsSentAt = b.review_sms_sent_at || b.metadata?.review_sms_sent_at || null;
    const customerAsked = !!(body.from_review_call && body.customer_asked === true);
    if (smsSentAt && !customerAsked && !['failed', 'undelivered'].includes(String(b.review_sms_status || ''))) {
      return res.status(409).json({ error: 'The review text was already sent for this job, and we only text it once. Send it by email instead.' });
    }
    if (!smsNotificationsOn()) return res.status(503).json({ error: 'Text notifications are turned off.' });
    const smsClickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(b.review_token)}&ch=sms`;
    const smsStatusCallback = `${baseUrl}/api/analytics?action=sms_status&token=${encodeURIComponent(b.review_token)}`;
    const msg = reviewRequestSms({ slug: biz.slug, name: biz.name, token: b.review_token, clickUrl: smsClickUrl, techName: await reviewTechName(db, b) });
    const r = await sendSMSResult(b.customer.phone, msg, { statusCallback: smsStatusCallback });
    await logAutomatedMessage(db, { businessId: biz.id, customerPhone: b.customer.phone, body: msg, result: r });
    if (!r.ok) return res.status(502).json({ error: 'Text failed to send: ' + (r.error || 'unknown error') });

    const now = new Date().toISOString();
    await db.from('bookings').update({ metadata: { ...(b.metadata || {}), review_sms_sent_at: now, ...(customerAsked ? { review_sms_customer_asked_at: now, review_sms_customer_asked_by: auth.name || null } : {}) } }).eq('id', id);
    try {
      await db.from('bookings').update({
        review_sms_sent_at: now, review_sms_status: 'sent', review_sms_delivered_at: null,
      }).eq('id', id);
    } catch (e) { /* column absent — metadata already updated above */ }
    return res.status(200).json({ ok: true });
  }

  if (!b.customer?.email) return res.status(400).json({ error: 'No customer email on file for this job.' });
  if (!emailNotificationsOn()) return res.status(503).json({ error: 'Email notifications are turned off.' });

  const emailClickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(b.review_token)}&ch=email`;
  const { from } = emailConfig(biz.slug);
  const { subject, html } = reviewEmail({ firstName: b.customer.name || 'there', clickUrl: emailClickUrl }, brandFor(biz.slug));
  let emailResult;
  try {
    emailResult = await sendEmail({ slug: biz.slug, to: b.customer.email, subject, html, replyTo: from, throwOnError: true });
  } catch (e) {
    return res.status(502).json({ error: 'Email failed to send: ' + e.message });
  }

  const now = new Date().toISOString();
  await db.from('bookings').update({ metadata: { ...(b.metadata || {}), review_email_sent_at: now } }).eq('id', id);
  try {
    const { data: cur } = await db.from('bookings').select('review_email_count').eq('id', id).single();
    const next = (Number(cur?.review_email_count) || 0) + 1;
    await db.from('bookings').update({
      review_email_sent_at: now, review_email_count: next,
      review_email_id: emailResult.id || null, review_email_status: 'sent', review_email_delivered_at: null,
    }).eq('id', id);
  } catch (e) { /* column absent — metadata already updated above */ }

  return res.status(200).json({ ok: true });
}

async function notificationResend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = body.id, kind = body.kind;
  if (!id || !kind) return res.status(400).json({ error: 'id and kind required' });

  const { data: b, error } = await db.from('bookings')
    .select(`id, scheduled_at, price, tip, needs_lifting, technician_id, sms_consent,
      address_line1, city, state, postal_code, service_area_id,
      customer:customers ( name, phone, email ),
      technician:technicians!technician_id ( id, name, photo_url, bio_years, bio_blurb ),
      line_items:booking_line_items ( name, quantity, unit_price, line_total )`)
    .eq('id', id).eq('business_id', biz.id).single();
  if (error || !b) return res.status(404).json({ error: 'Booking not found' });
  const tz = await areaTimezone(db, b.service_area_id || await serviceAreaIdFromPostal(db, biz.id, b.postal_code), biz.timezone || 'Asia/Manila');

  if (kind === 'confirmation_email') {
    if (!b.customer?.email) return res.status(400).json({ error: 'No customer email on file for this job.' });
    if (!emailNotificationsOn()) return res.status(503).json({ error: 'Email notifications are turned off.' });
    const firstName = greetName((b.customer.name || '').trim().split(/\s+/)[0] || '');
    let dateLong = '', timeWindow = '', startEpoch = null, endEpoch = null;
    if (b.scheduled_at) {
      try { dateLong = new Date(b.scheduled_at).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); } catch (e) { /* keep blank */ }
      const slotDef = SLOTS.find(s => s.key === slotKeyForLocalTime(localHHMM(tz, b.scheduled_at)));
      timeWindow = slotDef ? slotDef.label : '';
      startEpoch = Math.floor(new Date(b.scheduled_at).getTime() / 1000);
      endEpoch = startEpoch + 2 * 3600;
    }
    const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    const lineItems = b.line_items || [];
    const emailLines = lineItems.map(l => ({ label: l.name, qty: l.quantity, amount: l.line_total }));
    const { subject, html } = bookingConfirmationEmail({
      firstName, dateLong, timeWindow,
      serviceName: biz.slug === 'doms' ? "Dom's Home Cleaning" : 'Home Cleaning',
      technicianName: b.technician?.name || null,
      technicianPhotoUrl: b.technician?.photo_url || null,
      technicianBioYears: b.technician?.bio_years || null,
      technicianBioBlurb: b.technician?.bio_blurb || null,
      address: { line1: b.address_line1, city: b.city, state: b.state, zip: b.postal_code },
      lines: emailLines.length ? emailLines : null,
      total: b.price != null ? Number(b.price) : null,
      tip: Number(b.tip) || 0,
      twoTechs: !!b.needs_lifting,
      startEpoch, endEpoch, baseUrl, jobId: b.id,
      gdsUpsellUrl: gdsUpsellUrlFor({ lines: lineItems, bookingId: b.id, baseUrl }),
      rescheduleUrl: rescheduleUrlFor({ bookingId: b.id, baseUrl }),
    }, brandFor(biz.slug));
    const { from } = emailConfig(biz.slug);
    const result = await sendEmail({ slug: biz.slug, to: b.customer.email, subject, html, replyTo: from });
    if (!result.sent) return res.status(502).json({ error: 'Email failed to send: ' + (result.skipped || result.error || 'unknown error') });
    try {
      await db.from('bookings').update({ confirmation_email_status: 'sent', confirmation_email_sent_at: new Date().toISOString() }).eq('id', id);
    } catch (e) { /* migration 0075 not applied yet — status just won't show */ }
    return res.status(200).json({ ok: true, to: b.customer.email });
  }

  if (kind === 'tech_new_job') {
    const techId = body.technician_id || b.technician_id;
    if (!techId) return res.status(400).json({ error: 'No cleaner assigned to this job.' });
    if (!smsNotificationsOn()) return res.status(503).json({ error: 'Text notifications are turned off.' });
    await notifyTechAssigned(db, biz, techId, b.scheduled_at, tz, { bookingId: id });
    return res.status(200).json({ ok: true });
  }

  if (kind === 'on_the_way_sms') {
    if (!b.customer?.phone) return res.status(400).json({ error: 'No phone number on file for this customer.' });
    if (gateRefuse(res, await staffTextGate(db, b.customer.phone, b.sms_consent === true))) return;
    if (!smsNotificationsOn()) return res.status(503).json({ error: 'Text notifications are turned off.' });
    const etaMinutes = Number(body.eta_minutes) || DEFAULT_ETA_MINUTES;
    const msg = enRouteMessage(b.technician?.name, biz.name, etaMinutes, biz.slug);
    const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const otwToken = signToken({ kind: 'on_the_way', booking_id: id }, 3600);
    const statusCallback = `${baseUrl}/api/analytics?action=sms_status&token=${encodeURIComponent(otwToken)}`;
    const r = await sendSMSResult(b.customer.phone, msg, { statusCallback });
    if (!r.ok) return res.status(502).json({ error: 'Text failed to send: ' + (r.error || 'unknown error') });
    try {
      await db.from('bookings').update({
        on_the_way_sms_status: 'pending', on_the_way_sms_sent_at: new Date().toISOString(), on_the_way_sms_delivered_at: null,
      }).eq('id', id);
    } catch (e) { /* column absent */ }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown notification kind.' });
}

const CALL_OPEN_STATUSES = ['new', 'calling', 'called_back'];
const AUDITOR_ADMIN_ACTIONS = new Set(['private_cal', /* pipeline removed from Jiyah (owner 2026-10-08) */ 'calls', 'call_recording', 'call_summary', 'call_analytics', 'call_numbers', 'call_day_detail', 'call_ticket', 'auditor_notes_sent', 'note_photo',
  'messages_list', 'messages_thread', 'notes_active', 'vip_phones',
  'audit_dashboard',
  'my_call_performance', 'estimate_check', 'secretary_roster']);
const AUDIT_DASH_COLS = 'id, audit_date, call_id, occurred_at, time_local, direction, handled_by, service, caller_name, caller_phone, caller_zip, answers, flagged, notes, ratings, complaint, complaint_serious, listen_reason, owner_note, owner_note_at, grasshopper_number, call_outcome, answer_notes, findings, version, business:businesses ( slug )';
async function auditDashboard(req, res, db, auth) {
  if (auth.role !== 'owner' && !auth.auditor) return res.status(403).json({ error: 'Not allowed' });
  const isoOk = s => !isNaN(Date.parse(s));
  const dOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = String(req.query.from || ''), to = String(req.query.to || '');
  const d1 = String(req.query.d1 || ''), d2 = String(req.query.d2 || '');
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q) {
    const digits = q.replace(/\D/g, '');
    const isUuid = /^[0-9a-f-]{36}$/i.test(q);
    let cq = db.from('calls').select('id, occurred_at, caller_phone, handled_by, kind, answered, duration_sec, business:businesses ( name )')
      .not('kind', 'in', '(voicemail,missed,sms)').order('occurred_at', { ascending: false }).limit(25);
    if (isUuid) cq = cq.eq('id', q);
    else if (digits.length >= 4) cq = cq.ilike('caller_phone', '%' + digits.slice(-10) + '%');
    else cq = cq.ilike('handled_by', '%' + q.replace(/[%_,()]/g, '') + '%');
    const safeQ = q.replace(/[%_,()]/g, '');
    let aq = db.from('call_audits').select(AUDIT_DASH_COLS).order('audit_date', { ascending: false }).limit(50);
    if (isUuid) aq = aq.or('id.eq.' + q + ',call_id.eq.' + q);
    else if (digits.length >= 4) aq = aq.ilike('caller_phone', '%' + digits.slice(-10) + '%');
    else aq = aq.or('caller_name.ilike.%' + safeQ + '%,handled_by.ilike.%' + safeQ + '%');
    const [c, a] = await Promise.all([cq, aq]);
    return res.status(200).json({
      calls: (c.data || []).map(r => ({ id: r.id, occurred_at: r.occurred_at, caller_phone: r.caller_phone, handled_by: r.handled_by, kind: r.kind, answered: r.answered, duration_sec: r.duration_sec, business: r.business && r.business.name })),
      audits: a.data || [],
    });
  }
  if (!isoOk(from) || !isoOk(to) || !dOk(d1) || !dOk(d2)) return res.status(400).json({ error: 'from, to, d1, d2 required' });
  const [cnt, aud] = await Promise.all([
    db.from('calls').select('id', { count: 'exact', head: true })
      .not('kind', 'in', '(voicemail,missed,sms)').gte('occurred_at', from).lt('occurred_at', to),
    db.from('call_audits').select(AUDIT_DASH_COLS).gte('audit_date', d1).lte('audit_date', d2)
      .order('occurred_at', { ascending: false }).limit(2000),
  ]);
  if (cnt.error) throw cnt.error;
  if (aud.error) throw aud.error;
  return res.status(200).json({ calls: cnt.count || 0, audits: aud.data || [] });
}
const AUDITOR_WRITE_ACTIONS = new Set(['call_block', 'auditor_note_send', 'auditor_note_edit', 'auditor_note_delete', 'notes_photo', 'notes_read', 'auditor_reply_ack', 'auditor_thread_post', 'auditor_note_pin']);
const CALL_CLAIM_MINUTES = 15;
function claimIsHot(row) {
  if (!row.claimed_at || !row.claimed_by) return false;
  return (Date.now() - new Date(row.claimed_at).getTime()) < CALL_CLAIM_MINUTES * 60000;
}
async function calls(req, res, db, auth) {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const from = (req.query.from || '').toString().trim();
  const to = (req.query.to || '').toString().trim();
  let q = db.from('calls')
    .select(`id, kind, caller_phone, grasshopper_number, extension, extension_no, service, market,
             occurred_at, transcript, transcript_summary, has_recording, status, handled_by, handled_at, notes, warnings,
             claimed_by, claimed_at,
             source, tracking_label, answered, duration_sec, recording_url, forwarded_to, called_back_at,
             customer_id, booking_id,
             customer:customers ( id, name, phone, business:businesses ( slug ) ),
             booking:bookings ( id, scheduled_at, status, price, technician:technicians!technician_id ( name ) ),
             business:businesses ( slug, name )`)
    .order('occurred_at', { ascending: false }).limit(limit);
  if (from) q = q.gte('occurred_at', from);
  if (to) q = q.lt('occurred_at', to);
  q = q.not('kind', 'in', '(voicemail,missed,sms)');
  if (req.query.la === '1' && auth.role === 'owner') { const la = ['0000000000', '0000000000', '0000000000']; q = q.in('grasshopper_number', [...la, ...la.map(p => '+1' + p)]); }
  const viewerSlugs = allowedSlugsFor(auth);
  const NONE = '00000000-0000-0000-0000-000000000000';
  const safe = (p) => Promise.resolve(p).then((r) => r || { data: null }, () => ({ data: null }));
  const staffP = safe(db.from('staff_users').select('name, phone').eq('active', true));
  const linesP = safe(db.from('tracking_numbers').select('phone, display_name, label'));
  let vids = null;
  if (viewerSlugs) {
    const { data: viewerBiz } = await db.from('businesses').select('id').in('slug', viewerSlugs);
    vids = (viewerBiz || []).map(b => b.id);
    q = q.in('business_id', vids.length ? vids : [NONE]);
  }
  const inVids = (qq) => (vids ? qq.in('business_id', vids.length ? vids : [NONE]) : qq);
  const { data: rows, error } = await q;
  if (error) throw error;

  const relinkP = (async () => {
    const needLink = (rows || []).filter(r => r.customer_id && !r.booking_id);
    if (!needLink.length) return;
    const oldest = needLink.reduce((m, r) => (r.occurred_at < m ? r.occurred_at : m), needLink[0].occurred_at);
    const { data: bks } = await safe(db.from('bookings')
      .select('id, customer_id, created_at, scheduled_at, status, price, technician:technicians!technician_id ( name )')
      .in('customer_id', [...new Set(needLink.map(r => r.customer_id))])
      .gte('created_at', oldest)
      .order('created_at', { ascending: true }));
    const patch = [];
    for (const r of needLink) {
      const until = new Date(new Date(r.occurred_at).getTime() + 14 * 86400000).toISOString();
      const hit = (bks || []).find(b => b.customer_id === r.customer_id && b.created_at >= r.occurred_at && b.created_at <= until);
      if (hit) {
        r.booking_id = hit.id;
        r.booking = { id: hit.id, scheduled_at: hit.scheduled_at, status: hit.status, price: hit.price, technician: hit.technician };
        patch.push({ id: r.id, booking_id: hit.id, wasOpen: CALL_OPEN_STATUSES.includes(r.status) });
        if (CALL_OPEN_STATUSES.includes(r.status)) {
          r.status = 'resolved';
          r.handled_by = 'Booked';
          r.handled_at = hit.created_at || new Date().toISOString();
          r.auto_resolved = true;
        }
      }
    }
    const nowIso = new Date().toISOString();
    await Promise.all(patch.map((p) => {
      const upd = { booking_id: p.booking_id };
      if (p.wasOpen) { upd.status = 'resolved'; upd.handled_by = 'Booked'; upd.handled_at = nowIso; }
      return safe(db.from('calls').update(upd).eq('id', p.id));
    }));
  })().catch(() => {});

  const me = auth.name || auth.role || 'office';

  const callerDigits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
  const callerPhones = [...new Set((rows || []).map(r => callerDigits(r.caller_phone)).filter(p => p.length === 10))];
  const blockedSet = new Set();
  const textInfo = new Map();
  const historyBy = new Map();
  const EMPTY = Promise.resolve({ data: null });
  const has = callerPhones.length > 0;
  const hist = has && req.query.lite !== '1';
  const pretty = p => `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`;
  const forms2 = callerPhones.flatMap(p => [p, '+1' + p]);
  const forms = callerPhones.flatMap(p => [p, '+1' + p, pretty(p)]);
  let mq60 = db.from('messages').select('customer_phone, our_phone, direction, created_at')
    .in('customer_phone', forms2).gte('created_at', new Date(Date.now() - 60 * 86400000).toISOString()).limit(3000);
  if (vids) mq60 = mq60.or(vids.length ? `business_id.in.(${vids.join(',')}),business_id.is.null` : 'business_id.is.null');
  const custP = hist ? safe(inVids(db.from('customers').select('id, phone').in('phone', forms))) : EMPTY;
  const bksP = custP.then(({ data: custs }) => {
    const ids = (custs || []).map(c => c.id);
    return ids.length ? safe(db.from('bookings').select('id, customer_id, scheduled_at, created_at, status, price, metadata, services(name), business:businesses(name, slug), customer:customers(name)')
      .in('customer_id', ids).neq('status', 'cancelled').order('scheduled_at', { ascending: false }).limit(2000)) : { data: null };
  });
  const [, blR, m60R, custR, bkR, estR, liveR, revR, msgR, staffR, lineR] = await Promise.all([
    relinkP,
    has ? safe(db.from('blocked_numbers').select('phone').in('phone', callerPhones)) : EMPTY,
    has ? safe(mq60) : EMPTY,
    custP,
    hist ? bksP : EMPTY,
    hist ? safe(inVids(db.from('estimates').select('id, customer_phone, customer_name, created_at, status, approved_at, service_label, texted_at, emailed_at, text_opened_at, email_opened_at, line_items, tax_rate, business:businesses(name)').in('customer_phone', forms)
      .order('created_at', { ascending: false }).limit(2000))) : EMPTY,
    hist ? safe(inVids(db.from('calls').select('caller_phone, occurred_at, handled_by, notes, quoted_total, resolution, business:businesses(name)')
      .eq('kind', 'live').in('caller_phone', forms).not('notes', 'is', null).order('occurred_at', { ascending: false }).limit(500))) : EMPTY,
    hist ? safe(db.from('caller_reviews').select('phone, data').in('phone', callerPhones)) : EMPTY,
    hist ? safe(inVids(db.from('messages').select('customer_phone, created_at, direction, body, sent_by, business:businesses(name)')
      .in('customer_phone', forms).order('created_at', { ascending: false }).limit(1500))) : EMPTY,
    staffP,
    linesP,
  ]);

  for (const b of (blR.data || [])) blockedSet.add(b.phone);
  for (const m of (m60R.data || [])) {
    const d = callerDigits(m.customer_phone);
    const t = textInfo.get(d) || { total: 0, inbound: 0, last: null };
    t.total++; if (m.direction === 'in' || m.direction === 'inbound') t.inbound++;
    if (!t.last || m.created_at > t.last) { t.last = m.created_at; t.our = m.our_phone; }
    textInfo.set(d, t);
  }
  try {
    const digitsByCust = new Map((custR.data || []).map(c => [c.id, callerDigits(c.phone)]));
    const h = d => { let x = historyBy.get(d); if (!x) { x = { jobs: 0, completed: 0, spent: 0, last_job: null, upcoming: null, estimates: 0, last_estimate: null }; historyBy.set(d, x); } return x; };
    const nowIso = new Date().toISOString();
    for (const b of (bkR.data || [])) {
      const x = h(digitsByCust.get(b.customer_id)); if (!x) continue;
      x.jobs++;
      if (b.status === 'completed') { x.completed++; x.spent += Number(b.price) || 0; }
      const j = { at: b.scheduled_at, status: b.status, price: Number(b.price) || 0, service: b.services?.name || null,
        brand: b.business?.name || null, brand_slug: b.business?.slug || null, created_at: b.created_at || null, booked_by: b.metadata?.booked_by || null,
        id: b.id, customer_name: b.customer?.name || null };
      (x.booking_list || (x.booking_list = [])).length < 15 && x.booking_list.push(j);
      if (b.customer?.name && !x.name) x.name = b.customer.name;
      if (!x.latest_booking || (b.created_at || '') > (x.latest_booking.created_at || '')) x.latest_booking = j;
      if (b.scheduled_at > nowIso && b.status !== 'completed') { if (!x.upcoming || b.scheduled_at < x.upcoming.at) x.upcoming = j; }
      else if (!x.last_job) x.last_job = j;
    }
    for (const e of (estR.data || [])) {
      const x = h(callerDigits(e.customer_phone));
      x.estimates++;
      if (!x.estimate_list) x.estimate_list = [];
      if (x.estimate_list.length < 15) {
        const items = (Array.isArray(e.line_items) ? e.line_items : []).map((li) => ({ name: String((li && (li.description || li.name)) || 'Item'), qty: Number(li && (li.qty ?? li.quantity)) || 1, price: Number(li && li.unit_price) || 0 }));
        const sub = items.reduce((t, i) => t + i.qty * i.price, 0);
        x.estimate_list.push({ id: e.id, brand: e.business?.name || null, created_at: e.created_at, service: e.service_label || null,
          items, total: Math.round((sub * (1 + (Number(e.tax_rate) || 0))) * 100) / 100, sent_at: e.texted_at || e.emailed_at || null,
          opened: !!(e.text_opened_at || e.email_opened_at), approved_at: e.approved_at || null });
      }
      if (e.customer_name && !/^\+?\d[\d\s().-]+$/.test(e.customer_name) && !/@/.test(e.customer_name) && !x.name) x.name = e.customer_name;
      if (!x.last_estimate) {
        const total = (Array.isArray(e.line_items) ? e.line_items : []).reduce((t, li) => t + (Number(li && li.unit_price) || 0) * (Number(li && li.qty) || 1), 0);
        x.last_estimate = { at: e.created_at, status: e.approved_at ? 'approved' : e.status, service: e.service_label || null,
          sent_at: e.texted_at || e.emailed_at || null, total: Math.round(total * 100) / 100,
          opened: !!(e.text_opened_at || e.email_opened_at), approved_at: e.approved_at || null };
      }
    }
    for (const l of (liveR.data || [])) {
      const x = h(callerDigits(l.caller_phone));
      if (!x.script_quotes) x.script_quotes = [];
      if (x.script_quotes.length < 10) x.script_quotes.push({ at: l.occurred_at, by: l.handled_by || null, brand: l.business?.name || null, notes: String(l.notes || '').slice(0, 2000), total: Number(l.quoted_total) || null, outcome: l.resolution || null });
    }
    for (const r of (revR.data || [])) h(callerDigits(r.phone)).review = r.data;
    for (const m of (msgR.data || [])) {
      const x = h(callerDigits(m.customer_phone));
      if (!x.texts_list) x.texts_list = [];
      if (x.texts_list.length < 40) x.texts_list.push({ at: m.created_at, dir: m.direction, body: String(m.body || '').slice(0, 600), by: m.sent_by || null, brand: m.business?.name || null });
    }
    for (const x of historyBy.values()) x.spent = Math.round(x.spent * 100) / 100;
  } catch (e) { /* history is a nicety; never fail the call list over it */ }

  const staffByPhone = new Map();
  for (const s of staffR.data || []) {
    const d = String(s.phone || '').replace(/\D/g, '').slice(-10);
    if (d.length === 10 && s.name) staffByPhone.set(d, s.name);
  }

  const lineNameByPhone = new Map();
  for (const l of lineR.data || []) {
    const d = String(l.phone || '').replace(/\D/g, '').slice(-10);
    if (d.length === 10) lineNameByPhone.set(d, l.display_name || null);
  }

  const VM_GREETING = /(leave (me )?(a |your )?(brief |short )?(voice ?)?message|not available|unavailable|at the tone|after the (tone|beep)|record your message|voice ?mail|mailbox|sorry (I|we) missed your call|can't (come to|take) (the|your) (phone|call))/i;
  const phoneVoicemail = (r) => {
    if (r.answered !== true || r.kind === 'live' || !r.transcript) return false;
    const staff = String(r.transcript).split(/\r?\n/).filter(l => /^Staff:/.test(l));
    return VM_GREETING.test(staff.slice(0, 2).join(' '));
  };
  const mapped = (rows || []).map(r => (phoneVoicemail(r) ? { ...r, answered: false, vm_on_handset: true } : r)).map(r => ({
    ...r,
    caller_display: r.customer?.name || prettyPhone(r.caller_phone),
    caller_pretty: prettyPhone(r.caller_phone),
    is_new_caller: !r.customer_id,
    routed_to_name: staffByPhone.get(String(r.forwarded_to || '').replace(/\D/g, '').slice(-10)) || null,
    line_name: lineNameByPhone.get(String(r.grasshopper_number || '').replace(/\D/g, '').slice(-10)) || r.business?.name || null,
    claim_active: claimIsHot(r),
    claimed_by_me: claimIsHot(r) && r.claimed_by === me,
    contacted: r.kind === 'live' || r.answered === true || r.called_back_at != null,
    left_voicemail: r.answered === false && !!(r.recording_url || r.transcript),
    recorded_message: !!r.recording_url,
    blocked: blockedSet.has(callerDigits(r.caller_phone)),
    text_count: (textInfo.get(callerDigits(r.caller_phone)) || {}).total || 0,
    text_our: (textInfo.get(callerDigits(r.caller_phone)) || {}).our || null,
    history: historyBy.get(callerDigits(r.caller_phone)) || null,
    text_in: (textInfo.get(callerDigits(r.caller_phone)) || {}).inbound || 0,
    text_last_at: (textInfo.get(callerDigits(r.caller_phone)) || {}).last || null,
  }));
  const LA_LINES = ['0000000000', '0000000000', '0000000000'];
  const isLA = (r) => LA_LINES.includes(String(r.grasshopper_number || '').replace(/\D/g, '').slice(-10));
  const laOnly = req.query.la === '1' && auth.role === 'owner';
  const shown = laOnly ? mapped.filter(isLA) : mapped.filter(r => !isLA(r));
  try {
    const missedRows = shown.filter(r => r.answered === false && r.kind !== 'live' && !r.called_back_at);
    const nums = [...new Set(missedRows.map(r => callerDigits(r.caller_phone)).filter(d => d.length === 10))];
    if (nums.length) {
      const oldest = missedRows.reduce((m, r) => (r.occurred_at < m ? r.occurred_at : m), missedRows[0].occurred_at);
      const { data: atts, error: attErr } = await db.from('call_attempts').select('phone, started_at, staff_name, staff_status, talked')
        .in('phone', nums).gte('started_at', oldest).order('started_at');
      if (attErr) throw attErr;
      const rang = (atts || []).filter(x => !x.staff_status || x.staff_status === 'completed' || x.talked === true);
      for (const r of missedRows) {
        const a = rang.find(x => callerDigits(x.phone) === callerDigits(r.caller_phone) && x.started_at > r.occurred_at);
        if (a) { r.called_back_at = a.started_at; r.called_back_by = r.called_back_by || a.staff_name; }
      }
    }
  } catch (e) { console.warn('[calls] call-back lookup failed:', e.message); }
  const open = shown.filter(r => CALL_OPEN_STATUSES.includes(r.status));
  const openVoicemails = open.filter(r => r.kind === 'inbound' && r.answered === false && !r.called_back_at);
  const interruptsMe = (r) => {
    if (viewerSlugs === null) return true;
    if (r.source === 'twilio') {
      const routedName = staffByPhone.get(String(r.forwarded_to || '').replace(/\D/g, '').slice(-10)) || null;
      return routedName != null && routedName === me;
    }
    return true;
  };
  const returnedLater = (r) => {
    const d = callerDigits(r.caller_phone);
    if (r.called_back_at) return true;
    return shown.some(x => x !== r && callerDigits(x.caller_phone) === d && x.occurred_at > r.occurred_at && (x.kind === 'live' || x.answered === true || x.called_back_at));
  };
  const denverDayStartIso = (() => {
    const now = new Date();
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName').value.replace('GMT', '') || '+0';
    const m = off.match(/^([+-])(\d{1,2})(?::(\d\d))?$/);
    const hh = m ? `${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}` : '-07:00';
    return new Date(`${ymd}T00:00:00${hh}`).toISOString();
  })();
  const bookedAfter = new Map();
  try {
    const cand = openVoicemails.filter(r => r.occurred_at >= denverDayStartIso);
    const ds = [...new Set(cand.map(r => callerDigits(r.caller_phone)).filter(d => d.length === 10))];
    if (ds.length) {
      const pf = d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
      const { data: cs } = await db.from('customers').select('id, phone').in('phone', ds.flatMap(d => [d, '+1' + d, pf(d)]));
      const byId = new Map((cs || []).map(c => [c.id, callerDigits(c.phone)]));
      if (byId.size) {
        const { data: bks } = await db.from('bookings').select('customer_id, created_at').in('customer_id', [...byId.keys()]).gte('created_at', denverDayStartIso);
        for (const k of (bks || [])) { const d = byId.get(k.customer_id); if (d && (!bookedAfter.has(d) || k.created_at > bookedAfter.get(d))) bookedAfter.set(d, k.created_at); }
      }
    }
  } catch (e) { console.warn('[calls] booked lookup failed:', e.message); }
  const bookedLater = (r) => { const t = bookedAfter.get(callerDigits(r.caller_phone)); return !!t && t > r.occurred_at; };
  const interrupting = openVoicemails.filter(r => r.status === 'new' && !claimIsHot(r) && interruptsMe(r) && !returnedLater(r) && !bookedLater(r) && r.occurred_at >= denverDayStartIso);
  return res.status(200).json({
    open,
    handled: shown.filter(r => !CALL_OPEN_STATUSES.includes(r.status)),
    open_count: interrupting.length,
    banner: interrupting.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))[0] || null,
    me,
  });
}

async function callRecording(req, res, db, auth) {
  const id = (req.query.id || '').toString();
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const { data: row, error } = await db.from('calls').select('recording_url').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!row || !row.recording_url) return res.status(404).json({ error: 'No recording for this call' });

  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return res.status(500).json({ error: 'Twilio credentials not configured' });
  const mediaUrl = row.recording_url.endsWith('.mp3') ? row.recording_url : `${row.recording_url}.mp3`;
  const upstream = await fetch(mediaUrl, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64') },
  });
  if (!upstream.ok || !upstream.body) return res.status(upstream.status || 502).json({ error: 'Could not fetch recording from Twilio' });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Accept-Ranges', 'bytes');
  const m = /^bytes=([0-9]*)-([0-9]*)$/.exec((req.headers.range || '').toString());
  if (m && buf.length) {
    let start = m[1] === '' ? Math.max(0, buf.length - Number(m[2])) : Number(m[1]);
    let end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    if (start > end || start >= buf.length) { res.setHeader('Content-Range', `bytes */${buf.length}`); return res.status(416).end(); }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
    res.setHeader('Content-Length', String(end - start + 1));
    return res.status(206).send(buf.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', String(buf.length));
  return res.status(200).send(buf);
}

async function callClaim(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const me = auth.name || auth.role || 'office';

  const { data: cur, error: e0 } = await db.from('calls')
    .select('id, status, claimed_by, claimed_at, booking_id').eq('id', id).single();
  if (e0 || !cur) return res.status(404).json({ error: 'Call not found' });

  if (!body.force && claimIsHot(cur) && cur.claimed_by !== me) {
    const mins = Math.max(1, Math.round((Date.now() - new Date(cur.claimed_at).getTime()) / 60000));
    return res.status(409).json({
      error: `${cur.claimed_by} claimed this ${mins} minute${mins === 1 ? '' : 's'} ago.`,
      claimed_by: cur.claimed_by, minutes_ago: mins, code: 'already_claimed',
    });
  }

  const now = new Date().toISOString();
  let claim = db.from('calls')
    .update({ claimed_by: me, claimed_at: now, status: 'calling', updated_at: now })
    .eq('id', id).eq('status', cur.status);
  claim = cur.claimed_at == null ? claim.is('claimed_at', null) : claim.eq('claimed_at', cur.claimed_at);
  claim = cur.claimed_by == null ? claim.is('claimed_by', null) : claim.eq('claimed_by', cur.claimed_by);
  const { data: claimed, error } = await claim.select('id').maybeSingle();
  if (error) throw error;
  if (!claimed) return res.status(409).json({ error: 'This call changed while you were claiming it. Refresh the call and try again.' });
  return res.status(200).json({ ok: true, claimed_by: me });
}

const CALL_RESOLUTIONS = ['booked', 'estimate_sent', 'refused', 'other'];
async function callHasSentEstimate(db, callId) {
  const { data: call } = await db.from('calls').select('id, caller_phone, occurred_at, inbound_call_id').eq('id', callId).maybeSingle();
  if (!call) return false;
  const ids = [call.id, call.inbound_call_id].filter(Boolean);
  const isSent = (e) => !!(e.texted_at || e.emailed_at || ['sent', 'approved', 'booked'].includes(e.status));
  const { data: byCall } = await db.from('estimates').select('id, status, texted_at, emailed_at').in('call_id', ids);
  if ((byCall || []).some(isSent)) return true;
  const ph = String(call.caller_phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (ph.length !== 10 || !call.occurred_at) return false;
  const t0 = new Date(new Date(call.occurred_at).getTime() - 30 * 60000).toISOString();
  const t1 = new Date(new Date(call.occurred_at).getTime() + 6 * 3600000).toISOString();
  const { data: near } = await db.from('estimates').select('id, status, texted_at, emailed_at, customer_phone')
    .gte('created_at', t0).lte('created_at', t1).ilike('customer_phone', '%' + ph.slice(-4));
  return (near || []).some((e) => String(e.customer_phone || '').replace(/[^0-9]/g, '').slice(-10) === ph && isSent(e));
}
const PHONE_REQUEST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function callUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const patch = { updated_at: new Date().toISOString() };
  if (body.status) {
    if (!['new', 'calling', 'called_back', 'resolved', 'ignored'].includes(body.status)) {
      return res.status(400).json({ error: 'Unknown status' });
    }
    patch.status = body.status;
    if (body.status !== 'calling') { patch.claimed_by = null; patch.claimed_at = null; }
    if (body.status !== 'new') {
      patch.handled_by = auth.name || auth.role || 'office';
      patch.handled_at = new Date().toISOString();
    } else {
      patch.handled_by = null; patch.handled_at = null;
    }
    if (body.status === 'called_back') patch.called_back_at = new Date().toISOString();
    else if (body.status === 'new') patch.called_back_at = null;
  }
  if (body.notes !== undefined) patch.notes = String(body.notes || '').slice(0, 2000) || null;
  if (body.service !== undefined) patch.service = String(body.service || '').slice(0, 60) || null;
  if (body.market !== undefined) patch.market = String(body.market || '').slice(0, 60) || null;
  if (body.caller_phone !== undefined) patch.caller_phone = String(body.caller_phone || '').replace(/\D/g, '').slice(-10) || null;
  if (body.customer_id !== undefined) patch.customer_id = body.customer_id || null;
  if (body.booking_id !== undefined) patch.booking_id = body.booking_id || null;
  if (body.resolution !== undefined) {
    const r = String(body.resolution || '').trim();
    if (r && !CALL_RESOLUTIONS.includes(r)) return res.status(400).json({ error: 'Unknown resolution' });
    if (r === 'estimate_sent' && !(await callHasSentEstimate(db, id))) {
      return res.status(400).json({ error: 'No estimate was sent for this call. Send the estimate first (Send estimate button), then mark it.' });
    }
    patch.resolution = r || null;
    if (r) {
      patch.status = 'resolved';
      patch.claimed_by = null; patch.claimed_at = null;
      patch.handled_by = auth.name || auth.role || 'office';
      patch.handled_at = new Date().toISOString();
    }
  }
  const { data, error } = await db.from('calls').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Call not found. The change was not saved.' });
  return res.status(200).json({ ok: true });
}

async function callBlock(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: call, error: e0 } = await db.from('calls').select('id, caller_phone').eq('id', id).single();
  if (e0 || !call) return res.status(404).json({ error: 'Call not found' });
  const phone = (call.caller_phone || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) return res.status(400).json({ error: 'This call has no caller number to block' });
  const { error } = await db.from('blocked_numbers').upsert({
    phone, call_id: id, blocked_by: auth.name || auth.role || 'office', reason: (body.reason || '').toString().slice(0, 200) || null,
  }, { onConflict: 'phone', ignoreDuplicates: false });
  if (error) throw error;
  try {
    await db.from('calls')
      .update({ status: 'ignored', handled_by: 'Blocked number', handled_at: new Date().toISOString() })
      .in('caller_phone', [phone, '+1' + phone, '1' + phone]).in('status', CALL_OPEN_STATUSES);
  } catch (e) { console.warn('[admin] call_block: could not close open callbacks:', e.message); }
  return res.status(200).json({ ok: true, phone });
}

async function callUnblock(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) return res.status(400).json({ error: 'A 10-digit number is required' });
  const { error } = await db.from('blocked_numbers').delete().eq('phone', phone);
  if (error) throw error;
  return res.status(200).json({ ok: true, phone });
}

async function callTicket(req, res, db, auth) {
  const id = (req.query.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: b, error } = await db.from('bookings')
    .select(`id, scheduled_at, status, price, subtotal, address_line1, city, state, postal_code,
      customer:customers(name),
      technician:technicians!technician_id(name),
      secondary_technician:technicians!secondary_technician_id(name),
      business:businesses(name)`)
    .eq('id', id).maybeSingle();
  if (error) throw error;
  if (!b) return res.status(404).json({ error: 'Job not found' });
  const { data: lineItems } = await db.from('booking_line_items')
    .select('name, quantity, unit_price, line_total, kind')
    .eq('booking_id', id).order('sort_order');
  return res.status(200).json({ ticket: { ...b, line_items: lineItems || [] } });
}

async function callDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('calls').delete().eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function callLiveStart(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (auth.role === 'owner') {
    return res.status(200).json({ ok: true, id: null, untracked: true });
  }
  const callId = body.call_id == null ? null : String(body.call_id);
  if (callId && !PHONE_REQUEST_UUID.test(callId)) return res.status(400).json({ error: 'call_id must be a UUID' });
  const link = await inboundForLiveStart(db, auth, body);
  const now = new Date().toISOString();
  const { data, error } = await db.from('calls').insert({
    ...(callId ? { id: callId } : {}),
    business_id: biz.id,
    kind: 'live',
    occurred_at: now,
    status: 'new',
    handled_by: auth.name || auth.role || 'office',
    ...(link.inbound_call_id ? { inbound_call_id: link.inbound_call_id } : {}),
    ...(link.caller_phone ? { caller_phone: link.caller_phone } : {}),
  }).select('id').single();
  if (error?.code === '23505' && callId) {
    const { data: existing, error: readError } = await db.from('calls')
      .select('id').eq('id', callId).eq('business_id', biz.id).eq('kind', 'live').maybeSingle();
    if (readError) throw readError;
    if (existing) return res.status(200).json({ ok: true, id: existing.id, duplicate: true });
    return res.status(409).json({ error: 'This call identifier is already in use. Start a new call.' });
  }
  if (error) throw error;
  if (!data?.id) throw new Error('The call record was not returned. Retry with the same call identifier.');
  return res.status(200).json({ ok: true, id: data.id });
}

const CALL_START_TTL_S = 120;
const CALL_START_TIMEOUT_MS = 15000;
const CALL_ATTEMPT_STATUS_TTL_S = 6 * 3600;
const CALL_ATTEMPT_DONE_TTL_S = 3 * 3600;
const CALL_ATTEMPT_TALK_SEC = 30;
function callStartTimeoutSignal() {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), CALL_START_TIMEOUT_MS);
  if (typeof t.unref === 'function') t.unref();
  return c.signal;
}

function isPlausibleUsE164(s) {
  return typeof s === 'string' && /^\+1\d{10}$/.test(s);
}

async function staffOwnPhoneFor(db, auth) {
  const me = (auth.name || '').trim();
  if (me) {
    try {
      const { data } = await db.from('staff_users').select('phone').eq('name', me).eq('active', true).maybeSingle();
      if (data && data.phone) return toE164(data.phone);
    } catch { /* fall through to the constant fallback */ }
  }
  return toE164(secretaryPhoneFor(auth.scope) || process.env.OWNER_PHONE_NUMBER || '');
}

const _recentCallStarts = new Map();
const CALL_START_DEDUPE_MS = 15000;
const _staffCallStarts = new Map();
const STAFF_CALL_WINDOW_MS = 60000;
const STAFF_CALL_MAX_PER_WINDOW = 6;

function staffCallBudgetKey(auth) {
  return (auth && (auth.name || auth.role)) || 'unknown';
}

function checkStaffCallBudget(auth) {
  const key = staffCallBudgetKey(auth);
  const now = Date.now();
  const hits = (_staffCallStarts.get(key) || []).filter((ts) => (now - ts) < STAFF_CALL_WINDOW_MS);
  if (hits.length >= STAFF_CALL_MAX_PER_WINDOW) {
    _staffCallStarts.set(key, hits);
    return false;
  }
  hits.push(now);
  _staffCallStarts.set(key, hits);
  return true;
}


async function transcribeRecent(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data: rows, error } = await db.from('calls')
    .select('id, recording_sid, transcript, transcript_sid, transcript_status')
    .eq('kind', 'inbound').not('recording_sid', 'is', null).gte('occurred_at', since).limit(300);
  if (error) return res.status(500).json({ error: error.message });
  const out = { started: 0, finished: 0, failed: 0, errors: [] };
  for (const r of rows || []) {
    try {
      if (!r.transcript_sid && !r.transcript) { if (await startTranscript(db, r.id, r.recording_sid)) out.started++; }
      else if (r.transcript_sid && r.transcript_status !== 'done') { if (await finishTranscript(db, r.transcript_sid)) out.finished++; }
    } catch (e) { out.failed++; if (out.errors.length < 3) out.errors.push(e.message); }
  }
  return res.status(200).json(out);
}

async function bookingContact(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(body.booking_id || '');
  if (!id) return res.status(400).json({ error: 'booking_id required' });
  const { data: b, error } = await db.from('bookings')
    .select('id, business:businesses ( slug, name ), customer:customers ( name, phone, email )').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  const slug = b.business && b.business.slug;
  if (!mayUseBusiness(auth, slug)) return res.status(403).json({ error: 'Forbidden for this business' });
  if (body.op === 'line') {
    const phone = digitsOf(b.customer && b.customer.phone).slice(-10);
    if (!phone) return res.status(400).json({ error: 'No phone number on this job' });
    const { data: last } = await db.from('messages').select('our_phone').eq('customer_phone', phone)
      .order('created_at', { ascending: false }).limit(1);
    const our = (last && last[0] && last[0].our_phone) || digitsOf(process.env.TWILIO_PHONE_NUMBER || '').slice(-10);
    return res.status(200).json({ our, customer: phone });
  }
  if (body.op === 'email') {
    const to = String((b.customer && b.customer.email) || '').trim();
    if (!to) return res.status(400).json({ error: 'No email on this job' });
    const subject = String(body.subject || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!subject || !message) return res.status(400).json({ error: 'Write a subject and a message' });
    const e = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const brand = brandFor(slug);
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;">${e(message).replace(/\n/g, '<br>')}<br><br>— ${e((brand && brand.name) || (b.business && b.business.name) || '')}</div>`;
    const r = await sendEmail({ slug, to, subject, html });
    if (!r || !r.sent) return res.status(502).json({ error: 'The email did not send' + (r && r.skipped ? ` (${r.skipped})` : '') });
    return res.status(200).json({ ok: true, from: emailConfig(slug).from, to });
  }
  return res.status(400).json({ error: 'Unknown op' });
}

async function callbackRequests(req, res, db, auth, body) {
  const isOwner = auth.role === 'owner';
  if (req.method === 'POST') {
    if (body.op === 'dismiss') {
      let q = db.from('callback_requests').update({ done_at: new Date().toISOString(), done_by: auth.name || 'Owner', done_how: 'dismissed' })
        .eq('id', String(body.id || '')).is('done_at', null);
      if (!isOwner) q = q.eq('created_by', 'Call promise');
      const { error } = await q;
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    if (body.op === 'create') {
      const phone = digitsOf(body.phone).slice(-10);
      if (phone.length !== 10) return res.status(400).json({ error: 'Bad phone' });
      const targets = Array.isArray(body.targets) && body.targets.length ? body.targets.map(String).slice(0, 6) : ['Joey', 'Heather'];
      const { data, error } = await db.from('callback_requests').insert({
        phone, name: body.name ? String(body.name).slice(0, 120) : null,
        business_slug: body.business ? String(body.business).slice(0, 60) : null,
        booking_id: /^[0-9a-f-]{36}$/i.test(String(body.booking_id || '')) ? String(body.booking_id) : null,
        note: body.note ? String(body.note).slice(0, 300) : null, targets, created_by: 'Owner',
      }).select('id').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, id: data.id });
    }
    return res.status(400).json({ error: 'Unknown op' });
  }
  const { data: rows, error } = await db.from('callback_requests').select('*').is('done_at', null).order('created_at').limit(50);
  if (error) throw error;
  const open = [];
  for (const r of rows || []) {
    const { data: att } = await db.from('call_attempts').select('staff_name, started_at')
      .eq('phone', r.phone).gt('started_at', r.created_at).order('started_at').limit(1);
    if (att && att.length) {
      await db.from('callback_requests').update({ done_at: att[0].started_at, done_by: att[0].staff_name, done_how: 'called' }).eq('id', r.id).is('done_at', null);
      continue;
    }
    { const { data: tx } = await db.from('messages').select('created_at, sent_by').eq('customer_phone', r.phone).eq('direction', 'out').neq('sent_by', 'automated').gt('created_at', r.created_at).order('created_at').limit(1);
      if (tx && tx.length) { await db.from('callback_requests').update({ done_at: tx[0].created_at, done_by: tx[0].sent_by || 'Staff', done_how: 'texted' }).eq('id', r.id).is('done_at', null); continue; } }
    if (!isOwner && !targetedToday(auth, r.targets, r.business_slug)) continue;
    const brand = r.business_slug ? brandFor(r.business_slug) : null;
    open.push({ ...r, business_name: (brand && brand.name) || r.business_slug || '' });
  }
  return res.status(200).json({ open, owner: isOwner });
}

async function callStart(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const source = (body.source || '').toString();
  if (auth.offToday && source !== 'pipeline') return res.status(403).json({ error: 'Off today', off_today: true });

  let customerPhone, trackingNumber, attemptBizId = null, attemptProspectId = null;
  if (source === 'message_thread') {
    const customer = digitsOf(body.customer);
    if (!customer) return res.status(400).json({ error: 'customer is required' });
    let ctx; try { ctx = await businessForOurPhone(db, auth, body.our, customer); } catch (e) { return bail(res, e); }
    const { data: existing, error: existErr } = await db.from('messages').select('id')
      .eq('our_phone', ctx.ourPhone).eq('customer_phone', customer).limit(1);
    if (existErr) return res.status(503).json({ error: "Couldn't verify this conversation. Try again in a moment." });
    if (!(existing || []).length) return res.status(404).json({ error: 'No conversation found for this number.' });
    customerPhone = toE164(customer);
    trackingNumber = toE164(ctx.ourPhone);
    attemptBizId = (ctx.biz && ctx.biz.id) || null;
  } else if (source === 'call_claim') {
    const id = (body.call_id || '').toString();
    if (!id) return res.status(400).json({ error: 'call_id is required' });
    const { data: call, error } = await db.from('calls')
      .select('caller_phone, grasshopper_number, business_id, business:businesses ( slug )')
      .eq('id', id).single();
    if (error || !call) return res.status(404).json({ error: 'Call not found' });
    const slug = call.business && call.business.slug;
    if (!mayUseBusiness(auth, slug)) return res.status(403).json({ error: 'Forbidden for this business' });
    if (!call.caller_phone) return res.status(400).json({ error: 'This call has no customer number on file' });
    if (!call.grasshopper_number) return res.status(400).json({ error: 'This call has no tracking number on file' });
    customerPhone = toE164(call.caller_phone);
    trackingNumber = toE164(call.grasshopper_number);
    attemptBizId = call.business_id || null;
  } else if (source === 'pipeline') {
    let target;
    try { const anyBiz = auth.role === 'secretary' && await isReviewCardFor(db, body.card_key, body.phone); target = await pipelineCallTarget(db, auth, body.phone, body.business ? String(body.business) : null, anyBiz); } catch (e) { return bail(res, e); }
    customerPhone = toE164(target.phone);
    trackingNumber = toE164(target.line);
    attemptBizId = target.businessId || null;
  } else if (source === 'prospect') {
    let target;
    try { target = await prospectCallTarget(db, auth, body.prospect_id); } catch (e) { return bail(res, e); }
    customerPhone = toE164(target.phone);
    trackingNumber = toE164(target.line);
    attemptBizId = target.businessId || null;
    attemptProspectId = target.prospectId;
  } else if (source === 'red_alert') {
    let target;
    try { target = await redAlertCallTarget(db, auth, body.alert_id, body.step_id); } catch (e) { return bail(res, e); }
    customerPhone = toE164(target.phone);
    trackingNumber = toE164(target.line);
    attemptBizId = target.businessId || null;
  } else {
    return res.status(400).json({ error: 'Unknown source' });
  }

  if (!customerPhone) return res.status(400).json({ error: 'Bad customer phone number' });
  if (!trackingNumber) return res.status(400).json({ error: 'Bad tracking number' });

  if (!checkStaffCallBudget(auth)) {
    return res.status(429).json({ error: 'Too many calls placed in the last minute — give it a moment and try again.' });
  }
  const lastAt = _recentCallStarts.get(customerPhone);
  if (lastAt && (Date.now() - lastAt) < CALL_START_DEDUPE_MS) {
    return res.status(429).json({ error: 'Already placing a call to this number — give it a few seconds.' });
  }

  const staffPhone = await staffOwnPhoneFor(db, auth);
  if (!staffPhone) return res.status(500).json({ error: 'No phone on file for you to ring — ask the owner to add one to staff_users.' });

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ error: 'Calling is not configured (Twilio credentials missing).' });
  }

  const cardKey = /^c_[0-9a-f-]{36}$/i.test(String(body.card_key || '')) ? String(body.card_key) : null;
  let attemptId = null;
  try {
    const { data: att, error: attErr } = await db.from('call_attempts').insert({
      phone: customerPhone.slice(-10), business_id: attemptBizId, our_phone: trackingNumber.slice(-10),
      staff_name: auth.name || auth.role || 'office', source, card_key: cardKey,
      ...(attemptProspectId ? { prospect_id: attemptProspectId } : {}),
    }).select('id').single();
    if (attErr) throw attErr;
    attemptId = att.id;
  } catch (e) { console.error('[call_start] could not log the call attempt:', e.message); }
  const attemptFailed = async () => {
    if (!attemptId) return;
    try {
      const { error } = await db.from('call_attempts').update({ staff_status: 'failed', talked: false, talked_set_by: 'auto', ended_at: new Date().toISOString() }).eq('id', attemptId);
      if (error) throw error;
    } catch (e) { console.error('[call_start] could not close the call attempt:', e.message); }
  };

  const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const connectToken = signToken({ kind: 'ctc_connect', customerPhone, trackingNumber, ...(attemptId ? { attempt_id: attemptId } : {}) }, CALL_START_TTL_S);
  const connectUrl = `${base}/api/admin?action=call_connect&token=${encodeURIComponent(connectToken)}`;

  const formData = new URLSearchParams();
  formData.append('To', staffPhone);
  formData.append('From', trackingNumber);
  formData.append('Url', connectUrl);
  formData.append('Timeout', '25');
  if (attemptId) {
    const statusToken = signToken({ kind: 'ctc_status', attempt_id: attemptId }, CALL_ATTEMPT_STATUS_TTL_S);
    formData.append('StatusCallback', `${base}/api/admin?action=call_attempt_status&token=${encodeURIComponent(statusToken)}`);
    formData.append('StatusCallbackEvent', 'completed');
    formData.append('StatusCallbackMethod', 'POST');
  }
  const authHeader = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  _recentCallStarts.set(customerPhone, Date.now());
  let twilioRes;
  try {
    twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      signal: callStartTimeoutSignal(),
      headers: { Authorization: `Basic ${authHeader}` },
      body: formData,
    });
  } catch (e) {
    await attemptFailed();
    return res.status(502).json({ error: e.name === 'AbortError' ? 'Twilio did not respond in time.' : (e.message || 'Could not reach Twilio.') });
  }
  if (!twilioRes.ok) {
    const t = await twilioRes.text().catch(() => '');
    console.error('[call_start] Twilio error', twilioRes.status, t.slice(0, 300));
    await attemptFailed();
    return res.status(502).json({ error: `Twilio ${twilioRes.status}: ${t.slice(0, 200)}` });
  }
  let sid = null;
  try { sid = (await twilioRes.json())?.sid || null; } catch { /* placed regardless */ }
  if (attemptId && sid) {
    try {
      const { error } = await db.from('call_attempts').update({ twilio_sid: sid }).eq('id', attemptId);
      if (error) throw error;
    } catch (e) { console.error('[call_start] could not store the call sid:', e.message); }
  }
  return res.status(200).json({ ok: true, sid, ringing: staffPhone, attempt_id: attemptId });
}

async function callConnect(req, res) {
  const token = (req.query.token || '').toString();
  const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const url = `${base}/api/admin?action=call_connect&token=${encodeURIComponent(token)}`;
  const params = (req.body && typeof req.body === 'object') ? req.body : {};
  if (!verifyTwilioSignature(url, params, req.headers['x-twilio-signature'])) {
    console.warn('[call_connect] signature verification failed');
    return xml(res, '<Response><Reject/></Response>');
  }
  const claims = verifyToken(token);
  if (!claims || claims.kind !== 'ctc_connect') {
    return xml(res, '<Response><Say voice="Polly.Joanna">This call link has expired.</Say><Hangup/></Response>');
  }
  if (!isPlausibleUsE164(claims.customerPhone) || !isPlausibleUsE164(claims.trackingNumber)) {
    console.error('[call_connect] token carried a malformed number', claims);
    return xml(res, '<Response><Say voice="Polly.Joanna">Sorry, something went wrong placing this call.</Say><Hangup/></Response>');
  }
  let dialAction = '';
  if (claims.attempt_id && PHONE_REQUEST_UUID.test(String(claims.attempt_id))) {
    const doneToken = signToken({ kind: 'ctc_done', attempt_id: String(claims.attempt_id) }, CALL_ATTEMPT_DONE_TTL_S);
    dialAction = ` action="${xmlEsc(`${base}/api/admin?action=call_attempt_done&token=${encodeURIComponent(doneToken)}`)}" method="POST"`;
  }
  return xml(res, `<Response><Dial callerId="${xmlEsc(claims.trackingNumber)}"${dialAction}><Number>${xmlEsc(claims.customerPhone)}</Number></Dial></Response>`);
}

function callAttemptCallback(req, action, kind) {
  const token = (req.query.token || '').toString();
  const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const url = `${base}/api/admin?action=${action}&token=${encodeURIComponent(token)}`;
  const params = (req.body && typeof req.body === 'object') ? req.body : {};
  if (!verifyTwilioSignature(url, params, req.headers['x-twilio-signature'])) {
    console.warn(`[${action}] signature verification failed`);
    return null;
  }
  const claims = verifyToken(token);
  if (!claims || claims.kind !== kind || !PHONE_REQUEST_UUID.test(String(claims.attempt_id || ''))) {
    console.warn(`[${action}] bad or expired token`);
    return null;
  }
  return { params, attemptId: String(claims.attempt_id) };
}
const setByPerson = (row) => !!(row && row.talked_set_by && row.talked_set_by !== 'auto');

async function callAttemptStatus(req, res) {
  const cb = callAttemptCallback(req, 'call_attempt_status', 'ctc_status');
  if (!cb) return xml(res, '<Response/>');
  const status = String(cb.params.CallStatus || '').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 20) || null;
  try {
    const db = serviceClient();
    const { data: row, error } = await db.from('call_attempts').select('talked_set_by, ended_at').eq('id', cb.attemptId).maybeSingle();
    if (error) throw error;
    if (row) {
      const patch = { staff_status: status };
      if (status && status !== 'completed' && !setByPerson(row)) { patch.talked = false; patch.talked_set_by = 'auto'; }
      if (!row.ended_at) patch.ended_at = new Date().toISOString();
      const { error: e2 } = await db.from('call_attempts').update(patch).eq('id', cb.attemptId);
      if (e2) throw e2;
    }
  } catch (e) {
    console.error('[call_attempt_status] update failed:', e.message);
  }
  return xml(res, '<Response/>');
}

async function callAttemptDone(req, res) {
  const cb = callAttemptCallback(req, 'call_attempt_done', 'ctc_done');
  if (!cb) return xml(res, '<Response/>');
  const dial = String(cb.params.DialCallStatus || '').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 20) || null;
  const dur = parseInt(cb.params.DialCallDuration, 10);
  try {
    const db = serviceClient();
    const { data: row, error } = await db.from('call_attempts').select('talked_set_by').eq('id', cb.attemptId).maybeSingle();
    if (error) throw error;
    if (row) {
      const patch = { dial_status: dial, duration_sec: Number.isFinite(dur) ? dur : null, ended_at: new Date().toISOString() };
      if (!setByPerson(row)) {
        patch.talked = dial === 'completed' && Number.isFinite(dur) && dur >= CALL_ATTEMPT_TALK_SEC;
        patch.talked_set_by = 'auto';
      }
      const { error: e2 } = await db.from('call_attempts').update(patch).eq('id', cb.attemptId);
      if (e2) throw e2;
    }
  } catch (e) {
    console.error('[call_attempt_done] update failed:', e.message);
  }
  return xml(res, '<Response/>');
}

async function callIngest(req, res) {
  return res.status(410).json({ error: 'Grasshopper call tracking has been retired. Delete the syncNow trigger in the Apps Script project to stop these requests.' });
}

const REVIEW_CALL_STATUSES = ['called', 'voicemail', 'callback', 'reviewed', 'declined', 'do_not_contact', 'promised_review', 'complaint'];
const REVIEW_CALL_RESOLVED = ['reviewed', 'declined', 'do_not_contact', 'promised_review', 'complaint', 'voicemail'];
const RC_TZ = 'Asia/Manila';
const rcSelFor = (cc) => `id, status, completed_at, scheduled_at, review_rating, reviewed_at,
    review_email_opened_at, review_email_count, review_token, postal_code, sms_consent, review_sms_sent_at, review_sms_status, metadata, ${cc}
    customer:customers ( name, phone, email, postal_code ),
    technician:technicians!technician_id ( name ),
    service:services ( id, name ),
    line_items:booking_line_items ( name, quantity, unit_price, line_total )`;
const RC_CALL_COLS = 'review_call_status, review_call_at, review_call_by, review_call_notes,';
function rcMapRow(row, b, zipTzMap) {
  const zip = row.postal_code || row.customer?.postal_code || null;
  const zoned = (zip && zipTzMap && zipTzMap.get(zip)) || null;
  return {
    id: row.id,
    business_slug: b.slug,
    business_name: b.name,
    business_timezone: b.timezone || RC_TZ,
    call_timezone: zoned ? zoned.tz : (b.timezone || RC_TZ),
    call_area: zoned ? zoned.area : null,
    customer_name: row.customer?.name || '—',
    phone: row.customer?.phone || null,
    zip,
    has_email: !!row.customer?.email,
    loyalty_offer: row.metadata?.loyalty_offer || null,
    has_sms: !!(row.customer?.phone && row.sms_consent),
    review_sms_used: !!((row.review_sms_sent_at || row.metadata?.review_sms_sent_at) && !['failed', 'undelivered'].includes(String(row.review_sms_status || ''))),
    technician_name: row.technician?.name || '—',
    service_name: row.service?.name || 'Service',
    line_items: (Array.isArray(row.line_items) ? row.line_items : [])
      .filter(li => li && (li.name || li.description))
      .map(li => ({ name: String(li.name || li.description), qty: Number(li.quantity || li.qty) || 1, price: Number(li.line_total != null ? li.line_total : li.unit_price) || 0 })),
    when: row.scheduled_at || row.completed_at || null,
    is_completed: row.status === 'completed',
    email_opened: !!row.review_email_opened_at,
    email_count: row.review_email_count || 0,
    rating: row.review_rating || null,
    has_review_link: !!row.review_token,
    reviewed: row.reviewed_at != null || Number(row.review_rating) >= 4,
    call_status: row.review_call_status || null,
    call_at: row.review_call_at || null,
    call_by: row.review_call_by || null,
    call_notes: row.review_call_notes || null,
  };
}
const RC_STATUS_TO_FOLDER = { complaint: 'complaint', promised_review: 'promised_review', voicemail: 'voicemail', callback: 'voicemail', do_not_contact: 'do_not_contact', declined: 'declined' };

async function zipTimezoneMap(db, businessId) {
  const map = new Map();
  const { data: areas } = await db.from('service_areas').select('id, name, timezone').eq('business_id', businessId);
  const areaById = new Map((areas || []).map(a => [a.id, { area: a.name, tz: a.timezone }]));
  const { data: zips } = await db.from('service_area_zips').select('postal_code, service_area_id').eq('business_id', businessId);
  for (const z of (zips || [])) {
    const a = areaById.get(z.service_area_id);
    if (a && a.tz) map.set(String(z.postal_code), a);
  }
  return map;
}

async function reviewCalls(req, res, db, auth) {
  if (auth.scope === 'tidyhaus') return res.status(403).json({ error: 'Review Calls is not available on this account.' });
  const folder = (req.query.folder || 'to_call').toString();
  const { data: bizs, error: businessError } = await db.from('businesses').select('id, slug, name, timezone').eq('active', true);
  if (businessError) throw businessError;
  const warnings = [];
  const zipTzCache = new Map();
  const zipTzFor = async (bb) => {
    if (zipTzCache.has(bb.id)) return zipTzCache.get(bb.id);
    const m = await zipTimezoneMap(db, bb.id);
    zipTzCache.set(bb.id, m);
    return m;
  };

  if (folder !== 'to_call') {
    if (!['complaint', 'promised_review', 'voicemail', 'do_not_contact', 'declined'].includes(folder)) {
      return res.status(400).json({ error: 'Invalid folder' });
    }
    let weekOffset = parseInt(req.query.week_offset);
    if (!isFinite(weekOffset)) weekOffset = 0;
    weekOffset = Math.max(-520, Math.min(0, weekOffset));
    const weekBase = new Date(Date.now() + weekOffset * 7 * 86400000);
    const weekStart = startOfWeekUTC(RC_TZ, weekBase);
    const weekEnd = localDayStartUTC(RC_TZ, 7, weekStart);

    const out = [];
    const folderCounts = { complaint: 0, promised_review: 0, voicemail: 0, do_not_contact: 0, declined: 0 };
    await Promise.all((bizs || []).map(async b => {
      const { data, error } = await db.from('bookings').select(rcSelFor(RC_CALL_COLS))
        .eq('business_id', b.id)
        .gte('review_call_at', weekStart.toISOString()).lt('review_call_at', weekEnd.toISOString())
        .order('review_call_at', { ascending: false }).limit(500);
      if (error) { console.warn('[review_calls:folder]', b.slug, error.message); warnings.push(`${b.name}: ${error.message}`); return; }
      const tzMap = await zipTzFor(b);
      for (const row of (data || [])) {
        const fkey = RC_STATUS_TO_FOLDER[row.review_call_status];
        if (!fkey) continue;
        folderCounts[fkey]++;
        if (fkey === folder) out.push(rcMapRow(row, b, tzMap));
      }
    }));
    out.sort((a, c) => new Date(c.call_at || 0) - new Date(a.call_at || 0));
    const fmtMD = (d) => new Intl.DateTimeFormat('en-US', { timeZone: RC_TZ, month: 'short', day: 'numeric' }).format(d);
    const weekLastDay = new Date(weekEnd.getTime() - 86400000);
    await attachInboundVoicemails(db, out);
    await attachJobPhotos(db, out);
    return res.status(200).json({
      calls: out,
      warning: warnings.length ? warnings.join(' · ') : null,
      folder_counts: folderCounts,
      week_offset: weekOffset,
      week_label: `${fmtMD(weekStart)} – ${fmtMD(weekLastDay)}`,
    });
  }

  const days = 7;
  const out = [];
  const gByBooking = new Set(), gByName = new Set();
  try {
    const { data: gr } = await db.from('google_reviews').select('booking_id, reviewer_name, business_id')
      .gte('review_date', new Date(Date.now() - 60 * 86400000).toISOString());
    const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    for (const g of (gr || [])) {
      if (g.booking_id) gByBooking.add(g.booking_id);
      if (g.reviewer_name) gByName.add(g.business_id + '|' + norm(g.reviewer_name));
    }
    var gNorm = norm;
  } catch (e) { console.warn('[review_calls] google reviews check failed:', e.message); }
  await Promise.all((bizs || []).map(async b => {
    const tz = b.timezone || RC_TZ;
    const winStart = localDayStartUTC(tz, -days);
    const winEnd = localDayStartUTC(tz, 0);
    const run = (cc) => db.from('bookings').select(rcSelFor(cc))
      .eq('business_id', b.id)
      .in('status', ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed'])
      .gte('scheduled_at', winStart.toISOString()).lt('scheduled_at', winEnd.toISOString())
      .order('scheduled_at', { ascending: false }).limit(500);
    let { data, error } = await run(RC_CALL_COLS);
    if (error && /review_call_/.test(error.message || '')) ({ data, error } = await run(''));
    if (error) { console.warn('[review_calls]', b.slug, error.message); warnings.push(`${b.name}: ${error.message}`); return; }
    const tzMap = await zipTzFor(b);
    for (const row of (data || [])) {
      if (row.reviewed_at != null || Number(row.review_rating) >= 4) continue;
      if (gByBooking.has(row.id)) continue;
      if (typeof gNorm === 'function' && row.customer?.name && gByName.has(b.id + '|' + gNorm(row.customer.name))) continue;
      if (REVIEW_CALL_RESOLVED.includes(row.review_call_status)) continue;
      out.push(rcMapRow(row, b, tzMap));
    }
  }));
  out.sort((a, c) => {
    const au = a.call_status ? 1 : 0, cu = c.call_status ? 1 : 0;
    if (au !== cu) return au - cu;
    return new Date(a.when || 0) - new Date(c.when || 0);
  });
  await attachInboundVoicemails(db, out);
  return res.status(200).json({
    calls: out,
    warning: warnings.length ? warnings.join(' · ') : null,
    counts: {
      total: out.length,
      to_call: out.filter(x => !x.call_status).length,
      called: out.filter(x => x.call_status).length,
    },
    today_stats: await rcTodayStats(db, (bizs || []).map(b => b.id)),
  });
}

async function reviewCallReport(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const days = Math.max(1, Math.min(Number(req.query.days) || 7, 90));
  const { data: bizs } = await db.from('businesses').select('id, slug, name, timezone').eq('active', true);
  const bizIds = (bizs || []).map(b => b.id);
  const bizById = new Map((bizs || []).map(b => [b.id, b]));
  const winStart = localDayStartUTC(RC_TZ, -(days - 1));
  const winEnd = localDayStartUTC(RC_TZ, 1);
  const sel = `id, business_id, scheduled_at, review_call_status, review_call_at, review_call_by, review_call_notes, review_rating, reviewed_at,
    customer:customers ( name, phone ),
    technician:technicians!technician_id ( name ),
    service:services ( name )`;
  const run = (extra) => db.from('bookings').select(sel + extra)
    .in('business_id', bizIds)
    .gte('review_call_at', winStart.toISOString()).lt('review_call_at', winEnd.toISOString())
    .not('review_call_status', 'is', null)
    .order('review_call_at', { ascending: false }).limit(2000);
  let { data, error } = await run(', review_call_tags');
  if (error && /review_call_tags/.test(error.message || '')) ({ data, error } = await run(''));
  if (error) return res.status(500).json({ error: error.message });

  const dayKey = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: RC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const isReached = (s) => s !== 'voicemail' && s !== 'callback';
  const isGood = (s) => s === 'promised_review' || s === 'declined' || s === 'reviewed' || s === 'called';
  const summary = { logged: 0, reached: 0, good: 0, complaints: 0, promised: 0, voicemail: 0, declined: 0, dnc: 0 };
  const byPerson = new Map(), byDay = new Map(), tagCount = new Map();
  const calls = [];
  for (const row of (data || [])) {
    const s = row.review_call_status;
    const who = row.review_call_by || 'Unknown';
    summary.logged++;
    if (isReached(s)) summary.reached++;
    if (isGood(s)) summary.good++;
    if (s === 'complaint') summary.complaints++;
    if (s === 'promised_review') summary.promised++;
    if (s === 'voicemail' || s === 'callback') summary.voicemail++;
    if (s === 'declined') summary.declined++;
    if (s === 'do_not_contact') summary.dnc++;
    const p = byPerson.get(who) || { name: who, logged: 0, reached: 0, good: 0, complaints: 0, last_at: null };
    p.logged++; if (isReached(s)) p.reached++; if (isGood(s)) p.good++; if (s === 'complaint') p.complaints++;
    if (!p.last_at || row.review_call_at > p.last_at) p.last_at = row.review_call_at;
    byPerson.set(who, p);
    const dk = dayKey(row.review_call_at);
    const d = byDay.get(dk) || { day: dk, logged: 0, reached: 0, complaints: 0 };
    d.logged++; if (isReached(s)) d.reached++; if (s === 'complaint') d.complaints++;
    byDay.set(dk, d);
    for (const t of (Array.isArray(row.review_call_tags) ? row.review_call_tags : [])) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    const b = bizById.get(row.business_id) || {};
    calls.push({
      id: row.id, business_slug: b.slug || null, business_name: b.name || null,
      customer_name: row.customer?.name || '—', phone: row.customer?.phone || null,
      technician_name: row.technician?.name || '—', service_name: row.service?.name || 'Service',
      job_at: row.scheduled_at, status: s, at: row.review_call_at, by: who,
      notes: row.review_call_notes || null, tags: Array.isArray(row.review_call_tags) ? row.review_call_tags : [],
      rating: row.review_rating || null, reviewed: row.reviewed_at != null || Number(row.review_rating) >= 4,
    });
  }
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const dk = dayKey(localDayStartUTC(RC_TZ, -i).getTime() + 12 * 3600000);
    const d = byDay.get(dk) || { day: dk, logged: 0, reached: 0, complaints: 0 };
    d.label = new Intl.DateTimeFormat('en-US', { timeZone: RC_TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(dk + 'T12:00:00Z'));
    daily.push(d);
  }

  let backlog = 0;
  for (const b of (bizs || [])) {
    const tz = b.timezone || RC_TZ;
    const { data: q } = await db.from('bookings').select('id, review_call_status, reviewed_at, review_rating')
      .eq('business_id', b.id)
      .in('status', ['confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed'])
      .gte('scheduled_at', localDayStartUTC(tz, -7).toISOString()).lt('scheduled_at', localDayStartUTC(tz, 0).toISOString())
      .limit(1000);
    for (const r of (q || [])) {
      if (r.reviewed_at != null || Number(r.review_rating) >= 4) continue;
      if (r.review_call_status) continue;
      backlog++;
    }
  }
  return res.status(200).json({
    days, summary, backlog, calls,
    by_person: [...byPerson.values()].sort((a, c) => c.logged - a.logged),
    daily,
    tags: [...tagCount.entries()].map(([tag, count]) => ({ tag, count })).sort((a, c) => c.count - a.count),
  });
}

async function rcTodayStats(db, bizIds) {
  const stats = { today: 0, reached: 0, good: 0, issues: 0 };
  if (!bizIds.length) return stats;
  try {
    const todayStart = localDayStartUTC(RC_TZ, 0);
    const todayEnd = localDayStartUTC(RC_TZ, 1);
    const { data, error } = await db.from('bookings')
      .select('review_call_status')
      .in('business_id', bizIds)
      .gte('review_call_at', todayStart.toISOString())
      .lt('review_call_at', todayEnd.toISOString())
      .not('review_call_status', 'is', null)
      .limit(2000);
    if (error) return stats;
    for (const row of (data || [])) {
      stats.today++;
      if (row.review_call_status !== 'voicemail') {
        stats.reached++;
        if (row.review_call_status === 'promised_review' || row.review_call_status === 'declined') stats.good++;
      }
      if (row.review_call_status === 'complaint') stats.issues++;
    }
  } catch (e) { console.warn('[review_calls] today_stats failed:', e.message); }
  return stats;
}

async function attachInboundVoicemails(db, rows) {
  try {
    const byPhone = new Map();
    for (const r of rows) {
      const d = digitsOf(r.phone || r.customer_phone || '');
      if (d.length === 10) {
        if (!byPhone.has(d)) byPhone.set(d, []);
        byPhone.get(d).push(r);
      }
    }
    if (!byPhone.size) return;
    const { data } = await db.from('calls')
      .select('id, caller_phone, transcript, transcript_summary, occurred_at, market, status, recording_url')
      .in('caller_phone', [...byPhone.keys()])
      .not('kind', 'in', '(sms,live)')
      .order('occurred_at', { ascending: false });
    for (const c of (data || [])) {
      for (const r of (byPhone.get(c.caller_phone) || [])) {
        if (!r.inbound_voicemail) {
          r.inbound_voicemail = {
            id: c.id, transcript: c.transcript, transcript_summary: c.transcript_summary || null, occurred_at: c.occurred_at, market: c.market, status: c.status,
            has_recording: !!c.recording_url,
          };
        }
      }
    }
  } catch (e) {
    console.warn('[review_calls] voicemail attach skipped:', e.message);
  }
}

async function attachJobPhotos(db, rows) {
  try {
    const ids = rows.map(r => r.id).filter(Boolean);
    if (!ids.length) return;
    const { data } = await db.from('booking_photos').select('booking_id, url, created_at')
      .in('booking_id', ids).not('url', 'is', null).order('created_at', { ascending: true }).limit(3000);
    const by = new Map();
    for (const p of (data || [])) {
      if (!by.has(p.booking_id)) by.set(p.booking_id, []);
      by.get(p.booking_id).push(p.url);
    }
    for (const r of rows) {
      const list = by.get(r.id) || [];
      r.photo_count = list.length;
      r.photos = list.slice(0, 6);
    }
  } catch (e) { console.warn('[review_calls] photo attach skipped:', e.message); }
}

async function reviewCallLog(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.scope === 'tidyhaus' && !body?.from_pipeline) return res.status(403).json({ error: 'Review Calls is not available on this account.' });
  if (auth.offToday && !body?.from_pipeline) return res.status(403).json({ error: 'Off today', off_today: true });
  const id = body && body.id;
  const status = ((body && body.status) || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  if (status && !REVIEW_CALL_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { data: bk } = await db.from('bookings')
    .select(`id, scheduled_at, status, paid_at,
      business:businesses ( slug, name ),
      customer:customers ( name, phone, email ),
      technician:technicians!technician_id ( name ),
      service:services ( name )`)
    .eq('id', id).maybeSingle();
  if (!bk) return res.status(404).json({ error: 'Booking not found' });

  if (body.from_pipeline) {
    if (auth.role !== 'secretary' && !mayUseBusiness(auth, bk.business?.slug)) return res.status(403).json({ error:'Forbidden for this business' });
    if (bk.status !== 'completed' && !bk.paid_at) return res.status(400).json({ error:'Review calls are for completed or paid jobs.' });
    if (!['promised_review','complaint','voicemail','do_not_contact'].includes(status)) return res.status(400).json({ error:'Choose a review call outcome.' });
    if (status === 'complaint' && !String(body.notes || '').trim()) return res.status(400).json({ error:'Describe what happened first.' });
  }

  const patch = {
    review_call_status: status || null,
    review_call_at: status ? new Date().toISOString() : null,
    review_call_by: status ? (auth.name || displayNameFor(auth.scope)) : null,
  };
  if (typeof body.notes === 'string') patch.review_call_notes = body.notes.trim().slice(0, 500) || null;
  if (Array.isArray(body.tags)) {
    const tags = [...new Set(body.tags
      .map(t => String(t == null ? '' : t).trim().slice(0, 60))
      .filter(Boolean))].slice(0, 12);
    patch.review_call_tags = tags.length ? tags : null;
  }

  let { error } = await db.from('bookings').update(patch).eq('id', id);
  if (error && /review_call_tags/.test(error.message || '')) {
    delete patch.review_call_tags;
    ({ error } = await db.from('bookings').update(patch).eq('id', id));
    if (!error) return res.status(200).json({ ok: true, tags_skipped: true });
  }
  if (error && /review_call_/.test(error.message || '')) {
    return res.status(503).json({ error: 'The review-call queue needs a quick database update (migration 0049) before outcomes can be saved.' });
  }
  if (error) throw error;

  if (status === 'complaint') {
    const when = (() => {
      try { return new Date(bk.scheduled_at).toLocaleDateString('en-US', { timeZone: RC_TZ, weekday: 'long', month: 'short', day: 'numeric' }); }
      catch { return ''; }
    })();
    await sendReviewCallComplaintAlert({
      slug: bk.business?.slug,
      businessName: bk.business?.name,
      customerName: bk.customer?.name,
      phone: bk.customer?.phone,
      email: bk.customer?.email,
      serviceName: bk.service?.name,
      techName: bk.technician?.name,
      whenStr: when,
      note: patch.review_call_notes,
      tags: patch.review_call_tags || [],
      loggedBy: patch.review_call_by,
      bookingId: id,
    }).catch(e => console.warn('[review_call_log] complaint alert failed:', e.message));
  }
  return res.status(200).json({ ok: true });
}

async function reviews(req, res, db, auth) {
  const biz = await resolveBusiness(db, auth, req.query.business || '');

  const { data: revs, error } = await db.from('bookings')
    .select(`
      id, status, scheduled_at, review_rating, review_text, reviewed_at,
      customer:customers(name, phone),
      technician:technicians!technician_id(id, name, color),
      service_area:service_areas(name)
    `)
    .eq('business_id', biz.id)
    .not('review_rating', 'is', null)
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) throw error;

  const formatted = (revs || []).map(r => ({
    id: r.id,
    customer_name: r.customer?.name || '—',
    technician_name: r.technician?.name || '—',
    technician_id: r.technician?.id || null,
    rating: r.review_rating,
    feedback: r.review_text || '',
    reviewed_at: r.reviewed_at,
    service_area: r.service_area?.name || '—',
  }));

  return res.status(200).json({ reviews: formatted });
}

async function applicants(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { data: rows, error } = await db.from('applicant_screenings')
    .select('id, name, email, phone, score, total, passed, answers, short_answers, invite_code, created_at')
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;

  const list = (rows || []).map(r => ({
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    score: r.score, total: r.total, passed: r.passed,
    short_answers: r.short_answers || {}, invite_code: r.invite_code,
    created_at: r.created_at,
  }));

  const stats = new Map(APPLY_QUESTIONS.map(q => [q.key, { key: q.key, prompt: q.prompt, attempts: 0, correct: 0 }]));
  for (const r of rows || []) {
    for (const a of Array.isArray(r.answers) ? r.answers : []) {
      const s = stats.get(a?.key);
      if (!s) continue;
      s.attempts += 1;
      if (a.correct) s.correct += 1;
    }
  }
  const questionStats = [...stats.values()]
    .map(s => ({ ...s, rate: s.attempts ? Math.round((s.correct / s.attempts) * 100) : null }))
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  const passedCount = list.filter(r => r.passed).length;
  return res.status(200).json({
    applicants: list,
    question_stats: questionStats,
    totals: {
      count: list.length,
      passed: passedCount,
      pass_rate: list.length ? Math.round((passedCount / list.length) * 100) : null,
    },
  });
}

async function reviewAskRate(req, res, db, auth) {
  if (!auth || auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: jobs, error }, { data: gr }, { data: techs }] = await Promise.all([
    db.from('bookings').select('technician_id, review_ask, completed_at, scheduled_at').eq('status', 'completed')
      .not('technician_id', 'is', null).or(`completed_at.gte."${since}",and(completed_at.is.null,scheduled_at.gte."${since}")`).limit(10000),
    db.from('google_reviews').select('technician_id').not('technician_id', 'is', null).is('dismissed_at', null).gte('review_date', since.slice(0, 10)).limit(10000),
    db.from('technicians').select('id, name'),
  ]);
  if (error) throw error;
  const name = new Map((techs || []).map(t => [t.id, t.name]));
  const rows = new Map();
  const row = id => rows.get(id) || rows.set(id, { technician_id: id, name: name.get(id) || 'Cleaner', completed: 0, asked: 0, google: 0 }).get(id);
  for (const j of jobs || []) { const r = row(j.technician_id); r.completed++; if (j.review_ask === 'now' || j.review_ask === 'later') r.asked++; }
  for (const g of gr || []) row(g.technician_id).google++;
  return res.status(200).json({ rows: [...rows.values()].sort((a, b) => b.completed - a.completed) });
}

async function googleReviews(req, res, db, auth) {
  const biz = await resolveBusiness(db, auth, req.query.business || '');
  const selectWithDismiss = `id, reviewer_name, rating, review_text, review_date, seen, dismissed_at, created_at, technician_id, booking_id,
             technician:technicians ( id, name )`;
  let { data: rows, error } = await db.from('google_reviews')
    .select(selectWithDismiss)
    .eq('business_id', biz.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error && /dismissed_at/.test(error.message || '')) {
    ({ data: rows, error } = await db.from('google_reviews')
      .select(`id, reviewer_name, rating, review_text, review_date, seen, created_at, technician_id, booking_id,
               technician:technicians ( id, name )`)
      .eq('business_id', biz.id)
      .order('created_at', { ascending: false })
      .limit(100));
  }
  if (error) {
    if (/google_reviews/.test(error.message || '')) return res.status(200).json({ reviews: [] });
    throw error;
  }
  return res.status(200).json({
    reviews: (rows || []).filter(r => !r.dismissed_at).map(r => ({
      id: r.id,
      reviewer_name: r.reviewer_name || 'A customer',
      rating: r.rating,
      review_text: r.review_text || '',
      review_date: r.review_date,
      created_at: r.created_at,
      seen: !!r.seen,
      technician_id: r.technician_id || null,
      technician_name: r.technician?.name || null,
      booking_id: r.booking_id || null,
    })),
  });
}

async function googleReviewUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const biz = await resolveBusiness(db, auth, body.business || '');
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const patch = {};
  if (body.seen !== undefined) patch.seen = !!body.seen;
  if (body.dismissed !== undefined) patch.dismissed_at = body.dismissed ? new Date().toISOString() : null;
  let newTech = null, priorTid;
  if (body.technician_id !== undefined) {
    const tid = (body.technician_id || '').toString() || null;
    if (tid) {
      let { data: t } = await db.from('technicians').select('id, name, phone').eq('id', tid).eq('business_id', biz.id).maybeSingle();
      if (!t) {
        const partner = await partnerBusiness(db, biz.slug);
        if (partner) {
          ({ data: t } = await db.from('technicians').select('id, name, phone').eq('id', tid).eq('business_id', partner.id).maybeSingle());
        }
      }
      if (!t) return res.status(404).json({ error: 'Cleaner not found' });
      newTech = t;
      const { data: prior } = await db.from('google_reviews')
        .select('technician_id').eq('id', id).eq('business_id', biz.id).maybeSingle();
      priorTid = prior?.technician_id || null;
    }
    patch.technician_id = tid;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
  let { error } = await db.from('google_reviews').update(patch).eq('id', id).eq('business_id', biz.id);
  if (error && /dismissed_at/.test(error.message || '') && 'dismissed_at' in patch) {
    delete patch.dismissed_at;
    if (!Object.keys(patch).length) return res.status(503).json({ error: 'Dismiss not available yet — migration 0065 not applied.' });
    ({ error } = await db.from('google_reviews').update(patch).eq('id', id).eq('business_id', biz.id));
  }
  if (error) throw error;

  if (newTech && newTech.phone && newTech.id !== priorTid) {
    try {
      const { data: rev } = await db.from('google_reviews')
        .select('rating, reviewer_name').eq('id', id).eq('business_id', biz.id).maybeSingle();
      if (rev && rev.rating) {
        const from = rev.reviewer_name ? ` from ${rev.reviewer_name}` : '';
        const msg = rev.rating === 5
          ? `${newTech.name || 'Hey'}, you just got a 5-star Google review${from}! Nice work.`
          : `${newTech.name || 'Hey'}, a ${rev.rating}-star Google review came in${from}. Check your profile to view it.`;
        await sendSMS(newTech.phone, msg).catch(e => console.warn('[google_review_update] tech SMS failed:', e.message));
      }
    } catch (e) { console.warn('[google_review_update] tech SMS non-fatal:', e.message); }
  }
  return res.status(200).json({ ok: true });
}

async function badReviews(req, res, db, auth) {
  let sync_health = null;
  if (auth.role === 'owner') {
    try {
      const [state, dispatch] = await Promise.all([readBracketSyncState(db), readBracketSyncDispatch(db)]);
      sync_health = bracketSyncSummary({ state, dispatch }, new Date());
    } catch (e) {
      console.error('[bad_reviews] sync_health unavailable:', e.message);
      sync_health = { error: String((e && e.message) || e).slice(0, 120) };
    }
  }
  let bizQ = db.from('businesses').select('id, slug, name').eq('active', true);
  const badReviewAllowed = allowedSlugsFor(auth);
  if (badReviewAllowed) bizQ = bizQ.in('slug', badReviewAllowed);
  const { data: bizRows, error: bizErr } = await bizQ;
  if (bizErr) throw bizErr;
  const bizById = new Map((bizRows || []).map(b => [b.id, b]));
  const bizIds = (bizRows || []).map(b => b.id);
  if (!bizIds.length) return res.status(200).json({ alerts: [], sync_health });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: revs, error } = await db.from('bookings')
    .select(`id, business_id, scheduled_at, reviewed_at, review_rating, review_text, metadata,
             customer:customers ( name, phone ),
             technician:technicians!technician_id ( id, name )`)
    .in('business_id', bizIds)
    .in('review_rating', [1, 2, 3])
    .gte('reviewed_at', since)
    .order('reviewed_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const alerts = (revs || []).filter(r => !(r.metadata && r.metadata.review_alert_dismissed_at)).map(r => {
    const biz = bizById.get(r.business_id) || {};
    return {
      id: r.id,
      rating: r.review_rating,
      business_slug: biz.slug || '',
      business_name: biz.name || '',
      technician_name: r.technician?.name || 'Unassigned',
      customer_name: r.customer?.name || 'Customer',
      customer_phone: r.customer?.phone || '',
      scheduled_at: r.scheduled_at,
      reviewed_at: r.reviewed_at,
      review_text: r.review_text || '',
    };
  });
  return res.status(200).json({ alerts, sync_health });
}

async function badReviewDismiss(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: b } = await db.from('bookings').select('id, metadata').eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  const { error } = await db.from('bookings')
    .update({ metadata: { ...(b.metadata || {}), review_alert_dismissed_at: new Date().toISOString() } })
    .eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function avgTicketRange(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const tz = biz.timezone || 'Asia/Manila';
  const range = (req.query.range || '7d').toString();
  const RANGE_DAYS = { '7d': 7, '30d': 30 };
  const days = RANGE_DAYS[range] || null;
  const end = localDayStartUTC(tz, 1);
  const start = days ? localDayStartUTC(tz, -(days - 1)) : null;
  const { data: allBiz } = await db.from('businesses').select('id, slug').eq('active', true);
  const bySlug = {};
  await Promise.all((allBiz || []).map(async (bb) => {
    let q = db.from('bookings').select('price')
      .eq('business_id', bb.id)
      .lt('scheduled_at', end.toISOString())
      .eq('status', 'completed');
    if (start) q = q.gte('scheduled_at', start.toISOString());
    const { data: rows } = await q;
    const real = (rows || []).filter(x => Number(x.price) > 0);
    const count = real.length;
    const total = Math.round(real.reduce((n, x) => n + Number(x.price || 0), 0) * 100) / 100;
    bySlug[bb.slug] = { avg: count ? Math.round(total / count) : null, count, total };
  }));
  const rangeLabel = range === '30d' ? '30 days' : range === 'all' ? 'all time' : '7 days';
  return res.status(200).json({ avg_by_slug: bySlug, range_label: rangeLabel, range });
}

async function gscQueries(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data: bizCfg } = await db.from('businesses').select('analytics_config').eq('slug', biz.slug).maybeSingle();
  const domain = (bizCfg && bizCfg.analytics_config && bizCfg.analytics_config.gsc_domain) || GSC_DOMAIN_BY_SLUG[biz.slug];
  if (!domain) return res.status(200).json({ rows: [], strikingDistance: [], queryPages: [], brandSplit: null, error: `No Search Console domain configured for ${biz.slug}` });
  const days = Math.max(1, Math.min(Number(req.query.days) || 28, 480));
  const end = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().split('T')[0];
  const startDate = fmt(start), endDate = fmt(end);
  try {
    const [byQuery, byQueryPage] = await Promise.all([
      gscQuery({ domain, startDate, endDate, dimensions: ['query'], rowLimit: 500 }),
      gscQuery({ domain, startDate, endDate, dimensions: ['query', 'page'], rowLimit: 50 }),
    ]);
    const queryRows = byQuery.rows.map(r => ({ query: r.keys[0] || '', clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
    const rows = [...queryRows].sort((a, b) => b.clicks - a.clicks).slice(0, 25);

    const strikingDistance = queryRows
      .filter(r => r.position >= 11 && r.position <= 20 && r.impressions >= 10)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 25);

    const brandTerms = GSC_BRAND_TERMS[biz.slug] || [];
    const isBranded = (q) => brandTerms.some(t => q.toLowerCase().includes(t));
    const brandedClicks = queryRows.filter(r => isBranded(r.query)).reduce((s, r) => s + r.clicks, 0);
    const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0);
    const brandSplit = { branded: brandedClicks, nonBranded: totalClicks - brandedClicks };

    const queryPages = byQueryPage.rows
      .map(r => ({ query: r.keys[0] || '', page: r.keys[1] || '', clicks: r.clicks, impressions: r.impressions, position: r.position }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 25);

    return res.status(200).json({ site: byQuery.site, rangeDays: days, rows, strikingDistance, queryPages, brandSplit });
  } catch (e) {
    return res.status(200).json({ rows: [], strikingDistance: [], queryPages: [], brandSplit: null, error: e.message });
  }
}

const US_TIMEZONES = new Set(['Asia/Manila', 'Asia/Manila', 'Asia/Manila', 'Asia/Manila', 'Asia/Manila', 'America/Anchorage', 'Pacific/Honolulu']);

function cityPagePath(url) {
  try { return new URL(url).pathname.replace(/\/$/, '') || '/'; } catch { return (url || '').split('?')[0]; }
}

async function cityPagesAnalytics(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data: bizCfg } = await db.from('businesses').select('url, analytics_config').eq('id', biz.id).maybeSingle();
  const cityPages = (bizCfg && bizCfg.analytics_config && bizCfg.analytics_config.city_pages) || [];
  if (!cityPages.length) {
    return res.status(200).json({ pages: [], sessions: [], totalSessions: 0, flaggedSessions: 0, error: `No city pages configured for ${biz.slug}` });
  }
  const ownHost = (() => { try { return new URL(bizCfg.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();

  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const pub = serviceClientPublic();
  const { data, error } = await pub.from('web_events')
    .select('event_type, page_url, session_id, referrer, metadata, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(8000);
  if (error) throw error;

  const usSessions = new Set();
  for (const r of (data || [])) {
    if (r.event_type === 'page_view' && isUsTimezone(r.metadata && r.metadata.timezone)) usSessions.add(r.session_id);
  }
  const rows = (data || [])
    .filter(r => usSessions.has(r.session_id))
    .map(r => ({ ...r, path: cityPagePath(r.page_url) }))
    .filter(r => cityPages.includes(r.path));

  const perPage = {};
  for (const p of cityPages) perPage[p] = { path: p, views: 0, sessions: new Set(), clicks: 0, dwellBySession: {}, scrollBySession: {}, devices: {}, referrers: {} };
  for (const r of rows) {
    const bucket = perPage[r.path];
    if (r.event_type === 'page_view') {
      bucket.views++;
      bucket.sessions.add(r.session_id);
      const ref = (r.referrer || '').trim();
      const refKey = !ref ? '(direct)' : (cityPagePath(ref).startsWith('/') && ownHost && ref.includes(ownHost)) ? `internal: ${cityPagePath(ref)}` : (() => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch { return ref.slice(0, 60); } })();
      bucket.referrers[refKey] = (bucket.referrers[refKey] || 0) + 1;
      const dev = (r.metadata && r.metadata.device) || 'unknown';
      bucket.devices[dev] = (bucket.devices[dev] || 0) + 1;
    } else if (r.event_type === 'click') {
      bucket.clicks++;
    } else if (r.event_type === 'time_on_page') {
      const MAX_DWELL_SECS = 600;
      const secs = Math.min(MAX_DWELL_SECS, Number(r.metadata && r.metadata.seconds) || 0);
      bucket.dwellBySession[r.session_id] = Math.max(bucket.dwellBySession[r.session_id] || 0, secs);
    } else if (r.event_type === 'page_exit') {
      const depth = Number(r.metadata && r.metadata.max_scroll_depth) || 0;
      bucket.scrollBySession[r.session_id] = Math.max(bucket.scrollBySession[r.session_id] || 0, depth);
    }
  }
  const avg = (obj) => { const v = Object.values(obj); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  const topEntries = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ label: k, count: v }));
  const pages = cityPages.map(p => {
    const b = perPage[p];
    return {
      path: p,
      views: b.views,
      sessions: b.sessions.size,
      clicks: b.clicks,
      avg_dwell_seconds: avg(b.dwellBySession),
      avg_scroll_depth: avg(b.scrollBySession),
      devices: topEntries(b.devices, 5),
      referrers: topEntries(b.referrers, 5),
    };
  });

  const bySession = {};
  for (const r of rows) {
    if (!bySession[r.session_id]) {
      bySession[r.session_id] = {
        session_id: r.session_id, pages: new Set(), events: 0,
        first_seen: r.created_at, last_seen: r.created_at,
        timezone: (r.metadata && r.metadata.timezone) || null,
        device: (r.metadata && r.metadata.device) || null,
        browser: (r.metadata && r.metadata.browser) || null,
        entry_referrer: null,
      };
    }
    const s = bySession[r.session_id];
    s.events++;
    if (r.event_type === 'page_view') s.pages.add(r.path);
    if (r.created_at < s.first_seen) { s.first_seen = r.created_at; s.entry_referrer = r.referrer || null; }
    if (r.created_at > s.last_seen) s.last_seen = r.created_at;
  }
  const sessions = Object.values(bySession)
    .map(s => ({
      session_id: s.session_id,
      pages_visited: s.pages.size,
      pages: [...s.pages],
      events: s.events,
      first_seen: s.first_seen,
      last_seen: s.last_seen,
      timezone: s.timezone,
      device: s.device,
      browser: s.browser,
      entry_referrer: s.entry_referrer,
      flagged: !s.timezone || !US_TIMEZONES.has(s.timezone),
    }))
    .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
    .slice(0, 100);

  const totalSessions = sessions.length;
  const flaggedSessions = sessions.filter(s => s.flagged).length;

  return res.status(200).json({ days, pages, sessions, totalSessions, flaggedSessions, generatedAt: new Date().toISOString() });
}

const EST_STATUSES = ['unsent', 'sent', 'approved', 'booked', 'lost', 'expired', 'out_of_area'];
const EST_CLOSED = ['lost', 'expired', 'booked', 'out_of_area'];
const UNSENT_CLOSED = ['lost', 'expired', 'booked', 'out_of_area'];
const EST_LEGACY = { new: 'unsent', contacted: 'sent', scheduled: 'approved', declined: 'out_of_area', archived: 'lost', closed: 'lost' };
function estStatusName(s) {
  const v = String(s || '').trim();
  if (!v || v === 'all') return null;
  const m = EST_LEGACY[v] || v;
  return EST_STATUSES.includes(m) ? m : null;
}
async function estimates(req, res, db, auth) {
  if (isAllJobsViewer(auth) && req.query.all === '1') return await estimatesAllCompanies(req, res, db);
  const biz = await resolveBusiness(db, auth, req.query.business || '');
  const status = (req.query.status || '').toString();

  let cols = 'id, service_label, customer_name, customer_phone, customer_email, customer_zip, customer_address, customer_city, customer_state, description, photo_url, preferred_slots, status, sms_consent, notes, source, line_items, tax_rate, upsells, accepted_upsells, approved_total, approved_at, created_at, customer_note, contacted_at, contacted_by, texted_at, texted_by, emailed_at, emailed_by, text_opened_at, email_opened_at, followup_emailed_at, followup_sent_by, closed_reason, technician_id, broker_company_name, broker_sub_price, broker_sell_price, broker_booked_at, broker_spread';
  const runQuery = () => {
    let q = db.from('estimates').select(cols)
      .eq('business_id', biz.id).is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (status === 'website') return q.eq('source', 'website_form').not('status', 'in', `(${EST_CLOSED.join(',')})`);
    const st = estStatusName(status);
    if (st && st !== 'booked') q = q.eq('status', st);
    else q = q.not('status', 'in', `(${EST_CLOSED.join(',')})`);
    return q;
  };
  let { data, error } = await runQuery();
  for (let i = 0; error && i < 4; i++) {
    const col = missingColumn(error.message);
    if (!col || !cols.includes(col)) break;
    console.warn(`[admin] estimates: '${col}' column missing, retrying without it`);
    cols = cols.split(',').map(s => s.trim()).filter(c => c !== col).join(', ');
    ({ data, error } = await runQuery());
  }
  if (error) throw error;

  try {
    const ids = (data || []).map((e) => e.id);
    if (ids.length) {
      const { data: ns } = await db.from('estimate_office_notes').select('estimate_id, body, created_by, created_at').in('estimate_id', ids).order('created_at');
      const by = new Map();
      for (const n of ns || []) (by.get(n.estimate_id) || by.set(n.estimate_id, []).get(n.estimate_id)).push({ body: n.body, by: n.created_by, at: n.created_at });
      for (const e of data || []) e.office_notes = by.get(e.id) || [];
    }
  } catch (e) { console.warn('[admin] estimates: office notes failed:', e.message); }

  try {
    const isUnstaffed = await unstaffedZipMatcher(db, biz.id, biz.slug);
    for (const e of (data || [])) e.broker_eligible = isUnstaffed(e.customer_zip);
  } catch (e) { console.warn("[admin] estimates: unstaffed check failed:", e.message); }

  try {
    const ids = (data || []).filter(e => e.status === 'approved' || e.status === 'booked').map(e => e.id);
    if (ids.length) {
      const { data: bks } = await db.from('bookings').select('id, metadata->>source_estimate_id')
        .eq('business_id', biz.id).in('metadata->>source_estimate_id', ids).neq('status', 'cancelled');
      const byEst = new Map((bks || []).map(b => [b.source_estimate_id, b.id]));
      for (const e of (data || [])) if (byEst.has(e.id)) e.booking_id = byEst.get(e.id);
    }
  } catch (e) { console.warn('[admin] estimates: booking lookup failed:', e.message); }

  let unsent = [];
  try {
    const { data: un } = await db.from('estimates')
      .select('id, customer_name, service_label, created_at, created_by, source')
      .eq('business_id', biz.id).is('texted_at', null).is('emailed_at', null).is('approved_at', null).is('deleted_at', null)
      .not('status', 'in', `(${UNSENT_CLOSED.join(',')})`)
      .order('created_at', { ascending: true }).limit(50);
    unsent = un || [];
  } catch (e) { console.warn('[admin] estimates: unsent list failed:', e.message); }

  return res.status(200).json({ estimates: data || [], unsent });
}

async function estimatesAllCompanies(req, res, db) {
  const status = (req.query.status || '').toString();
  const q = (req.query.q || '').toString().replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
  let cols = 'id, business_id, service_label, customer_name, customer_phone, customer_email, customer_zip, customer_address, customer_city, customer_state, description, photo_url, preferred_slots, status, sms_consent, notes, source, line_items, tax_rate, upsells, accepted_upsells, approved_total, approved_at, created_at, customer_note, contacted_at, contacted_by, texted_at, texted_by, emailed_at, emailed_by, text_opened_at, email_opened_at, followup_emailed_at, followup_sent_by, business:businesses(slug, name)';
  const runQuery = () => {
    let x = db.from('estimates').select(cols).is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
    if (q) {
      const digits = q.replace(/\D/g, '');
      const ors = ['customer_name', 'customer_email', 'service_label', 'customer_zip'].map(c => `${c}.ilike.*${q}*`);
      if (digits.length >= 3) ors.push(`customer_phone.ilike.*${digits}*`);
      return x.or(ors.join(','));
    }
    x = x.gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
    if (status === 'website') return x.eq('source', 'website_form').not('status', 'in', `(${EST_CLOSED.join(',')})`);
    const st = estStatusName(status);
    if (st && st !== 'booked') x = x.eq('status', st);
    else x = x.not('status', 'in', `(${EST_CLOSED.join(',')})`);
    return x;
  };
  let { data, error } = await runQuery();
  for (let i = 0; error && i < 4; i++) {
    const col = missingColumn(error.message);
    if (!col || !cols.includes(col)) break;
    cols = cols.split(',').map(t => t.trim()).filter(c => c !== col).join(', ');
    ({ data, error } = await runQuery());
  }
  if (error) throw error;
  for (const e of data || []) { e.business_slug = e.business?.slug || ''; e.business_name = e.business?.name || ''; delete e.business; }
  try {
    const ids = (data || []).map((e) => e.id);
    if (ids.length) {
      const { data: ns } = await db.from('estimate_office_notes').select('estimate_id, body, created_by, created_at').in('estimate_id', ids).order('created_at');
      const by = new Map();
      for (const n of ns || []) (by.get(n.estimate_id) || by.set(n.estimate_id, []).get(n.estimate_id)).push({ body: n.body, by: n.created_by, at: n.created_at });
      for (const e of data || []) e.office_notes = by.get(e.id) || [];
    }
  } catch (e) { console.warn('[admin] estimates(all): office notes failed:', e.message); }
  try {
    const ids = (data || []).filter(e => e.status === 'approved' || e.status === 'booked').map(e => e.id);
    if (ids.length) {
      const { data: bks } = await db.from('bookings').select('id, metadata->>source_estimate_id')
        .in('metadata->>source_estimate_id', ids).neq('status', 'cancelled');
      const byEst = new Map((bks || []).map(b => [b.source_estimate_id, b.id]));
      for (const e of (data || [])) if (byEst.has(e.id)) e.booking_id = byEst.get(e.id);
    }
  } catch (e) { console.warn('[admin] estimates(all): booking lookup failed:', e.message); }
  return res.status(200).json({ estimates: data || [] });
}

async function estimateUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });

  const { data: existing } = await db.from('estimates')
    .select('id, photo_path, customer_email, approved_at, external_key, source, booked_booking_id').eq('id', body.id).eq('business_id', biz.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'Estimate not found' });

  if (body.op === 'delete') {
    if (existing.source === 'website_form' || existing.source === 'widget') {
      return res.status(409).json({ error: 'Website leads can\'t be deleted. Close it instead.', code: 'web_lead' });
    }
    const reason = String(body.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ error: 'Reason required', code: 'reason_required' });
    if (existing.external_key) {
      const { error: tombErr } = await db.from('deleted_lead_keys')
        .upsert({ external_key: existing.external_key, deleted_by: auth.name || adminAuthorName(auth) });
      if (tombErr) console.warn('[estimate_delete] could not remember deleted lead key:', tombErr.message);
    }
    const { error: delErr } = await db.from('estimates')
      .update({ deleted_at: new Date().toISOString(), deleted_reason: reason, deleted_by: auth.name || adminAuthorName(auth) })
      .eq('id', body.id).eq('business_id', biz.id);
    if (delErr) throw delErr;
    return res.status(200).json({ ok: true, deleted: true });
  }

  const patch = {};
  if (body.status) {
    const st = estStatusName(body.status);
    if (!st) return res.status(400).json({ error: 'Invalid status' });
    patch.status = st;
    if (st === 'booked' && body.booking_id && PHONE_REQUEST_UUID.test(String(body.booking_id))) {
      patch.booked_booking_id = String(body.booking_id);
      patch.booked_at = new Date().toISOString();
    }
    if (st === 'approved' && existing.booked_booking_id) patch.status = 'booked';
    if (st === 'lost' || st === 'expired') patch.closed_reason = String(body.reason || '').trim().slice(0, 200) || (auth.name || adminAuthorName(auth));
    if (st === 'booked' && !existing.approved_at) patch.approved_at = new Date().toISOString();
    if (st === 'sent') {
      patch.contacted_at = new Date().toISOString();
      patch.contacted_by = auth.name || adminAuthorName(auth);
    }
    if (st === 'approved' && !existing.approved_at) {
      patch.approved_at = new Date().toISOString();
    }
  }
  if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null;
  if (typeof body.service_label === 'string') patch.service_label = body.service_label.trim() || null;
  if (typeof body.description === 'string') patch.description = body.description.trim();
  if (typeof body.customer_note === 'string') patch.customer_note = body.customer_note.trim().slice(0, 1500) || null;
  if (typeof body.customer_email === 'string') {
    const em = body.customer_email.trim();
    if (em !== ((existing.customer_email || '').trim())) {
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return res.status(400).json({ error: 'That does not look like a valid email address.' });
      }
      patch.customer_email = em || null;
    }
  }
  if (body.technician_id !== undefined) {
    const tid = body.technician_id == null ? '' : String(body.technician_id).trim();
    if (!tid) patch.technician_id = null;
    else {
      const { data: tRow } = await db.from('technicians').select('id').eq('id', tid).eq('active', true).maybeSingle();
      if (!tRow) return res.status(400).json({ error: 'That technician is not available. Pick another.' });
      patch.technician_id = tRow.id;
    }
  }
  if (Array.isArray(body.line_items)) patch.line_items = sanitizeLineItems(body.line_items);
  if (Array.isArray(body.upsells)) patch.upsells = sanitizeUpsells(body.upsells);
  if (body.tax_rate !== undefined) patch.tax_rate = normalizeTaxRate(body.tax_rate);
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' });

  if (patch.line_items && body.confirm_high_price !== true) {
    const issue = priceSanityIssue({ lines: patch.line_items });
    if (issue) return res.status(409).json({ error: issue, code: 'high_price_confirm_required' });
  }

  const stripAndRetry = async () => {
    let { error } = await db.from('estimates').update(patch).eq('id', body.id).eq('business_id', biz.id);
    for (let i = 0; error && i < 3; i++) {
      const col = missingColumn(error.message);
      if (!col || !(col in patch)) break;
      console.warn(`[estimate_update] '${col}' column missing, retrying without it`);
      delete patch[col];
      if (!Object.keys(patch).length) return { error: null };
      ({ error } = await db.from('estimates').update(patch).eq('id', body.id).eq('business_id', biz.id));
    }
    return { error };
  };
  let { error } = await stripAndRetry();
  if (error && ['line_items', 'tax_rate'].includes(missingColumn(error.message))) {
    return res.status(503).json({ error: 'The quote builder needs a quick database update (migration 0028) before it can save. Please apply it and try again.' });
  }
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

function normalizeTaxRate(raw) {
  let r = Number(raw);
  if (!Number.isFinite(r) || r < 0) r = 0;
  if (r > 1) r = r / 100;
  if (r > 0.25) r = 0.25;
  return Math.round(r * 100000) / 100000;
}

const DEFAULT_EST_TAX_RATE = 0.0825;

function sanitizeLineItems(items) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 50)
    .map(it => {
      const description = String((it && it.description) || '').trim().slice(0, 300);
      let qty = Number(it && it.qty);
      let unit_price = Number(it && it.unit_price);
      if (!Number.isFinite(qty) || qty < 0) qty = 0;
      if (!Number.isFinite(unit_price)) unit_price = 0;
      if (unit_price < -5000) unit_price = -5000;
      qty = Math.round(qty * 100) / 100;
      unit_price = Math.round(unit_price * 100) / 100;
      return { description, qty, unit_price };
    })
    .filter(it => it.description || it.unit_price !== 0);
}

function sanitizeUpsells(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .slice(0, 30)
    .map((it, i) => {
      const description = String((it && it.description) || '').trim().slice(0, 160);
      let id = String((it && it.id) || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
      if (!id) id = 'u' + i;
      let qty = Number(it && it.qty);
      let unit_price = Number(it && it.unit_price);
      let tech_pay = Number(it && it.tech_pay);
      if (!Number.isFinite(qty) || qty <= 0) qty = 1;
      if (!Number.isFinite(unit_price) || unit_price < 0) unit_price = 0;
      if (!Number.isFinite(tech_pay) || tech_pay < 0) tech_pay = 0;
      qty = Math.round(qty * 100) / 100;
      unit_price = Math.round(unit_price * 100) / 100;
      tech_pay = Math.round(tech_pay * 100) / 100;
      const badge = String((it && it.badge) || '').trim().slice(0, 40);
      const blurb = String((it && it.blurb) || '').trim().slice(0, 240);
      const default_on = !!(it && it.default_on);
      return { id, description, qty, unit_price, tech_pay, badge, blurb, default_on };
    })
    .filter(it => it.description)
    .filter(it => { if (seen.has(it.id)) return false; seen.add(it.id); return true; });
}

function publicUpsells(items) {
  return (Array.isArray(items) ? items : []).map(u => ({
    id: u.id, description: u.description, qty: u.qty, unit_price: u.unit_price,
    badge: u.badge || '', blurb: u.blurb || '', default_on: !!u.default_on,
  }));
}

async function fetchEstimate(db, id, businessId, baseCols) {
  const optional = ['line_items', 'tax_rate'];
  let cols = [baseCols, ...optional].join(', ');
  let data, error;
  for (let i = 0; i < 4; i++) {
    ({ data, error } = await db.from('estimates').select(cols).eq('id', id).eq('business_id', businessId).maybeSingle());
    if (!error) break;
    const col = missingColumn(error.message);
    if (!col || !cols.includes(col)) break;
    cols = cols.split(',').map(s => s.trim()).filter(c => c !== col).join(', ');
  }
  if (error) throw error;
  if (data) {
    if (!Array.isArray(data.line_items)) data.line_items = [];
    if (data.tax_rate == null) data.tax_rate = 0;
  }
  return data;
}

function quoteTotals(items, taxRate) {
  const subtotal = lineItemsTotal(items);
  const rate = Number(taxRate) || 0;
  const tax = Math.round(subtotal * rate * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

async function insertEstimateResilient(db, row, requiredColumns = []) {
  const payload = { ...row };
  for (let i = 0; i < 6; i++) {
    const { data, error } = await db.from('estimates').insert(payload).select('id').maybeSingle();
    if (!error) return { data, error: null };
    const col = missingColumn(error.message);
    if (['42703', 'PGRST204'].includes(error.code) && col && !requiredColumns.includes(col) && Object.prototype.hasOwnProperty.call(payload, col)) {
      console.warn(`[estimate_create] '${col}' column missing, retrying without it`);
      delete payload[col];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: new Error('insert estimate failed after stripping unknown columns') };
}

function lineItemsTotal(items) {
  const sum = (Array.isArray(items) ? items : [])
    .reduce((t, it) => t + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  return Math.round(sum * 100) / 100;
}

async function markEstimateContacted(db, businessId, id, sentBy, channel, emailId) {
  const now = new Date().toISOString();
  const patch = { status: 'sent', contacted_at: now, contacted_by: sentBy || null };
  if (channel === 'sms')   { patch.texted_at = now;  patch.texted_by = sentBy || null; }
  if (channel === 'email') { patch.emailed_at = now; patch.emailed_by = sentBy || null; patch.email_id = emailId || null; patch.email_status = 'sent'; patch.email_bounced_at = null; }
  try {
    let { error } = await db.from('estimates').update(patch).eq('id', id).eq('business_id', businessId);
    for (let i = 0; error && i < 4; i++) {
      const col = missingColumn(error.message);
      if (!col || !(col in patch)) break;
      console.warn(`[estimate] '${col}' column missing, retrying without it`);
      delete patch[col];
      if (!Object.keys(patch).length) return {};
      ({ error } = await db.from('estimates').update(patch).eq('id', id).eq('business_id', businessId));
    }
    if (error) { console.warn('[estimate] could not mark contacted:', error.message); return {}; }
    return patch;
  } catch (e) {
    console.warn('[estimate] mark contacted threw:', e.message);
    return {};
  }
}

async function estimateCreate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const estimateId = body.estimate_id == null ? null : String(body.estimate_id);
  if (estimateId && !PHONE_REQUEST_UUID.test(estimateId)) return res.status(400).json({ error: 'estimate_id must be a UUID' });
  const estCallId = body.call_id != null && PHONE_REQUEST_UUID.test(String(body.call_id)) ? String(body.call_id) : null;
  const taxRate = body.tax_rate === undefined ? DEFAULT_EST_TAX_RATE : normalizeTaxRate(body.tax_rate);

  const { customer_name, customer_phone, customer_email, selections, service_label } = body;
  const estEmail = (customer_email || '').trim();
  const estPhone = (customer_phone || '').trim();
  const estSmsConsent = await textConsentFor(db, estPhone);
  const estName  = (customer_name || '').trim();
  if (!estEmail && !estPhone) {
    return res.status(400).json({ error: 'A phone number or an email address is required to send an estimate' });
  }
  const customer_zip = (body.postal_code || body.customer_zip || '').toString().replace(/\D/g, '').slice(0, 5) || null;
  if (customer_zip && customer_zip.length === 5 && body.confirm_out_of_area !== true && !body.merge_into) {
    try {
      const [{ count: total }, { count: hit }] = await Promise.all([
        db.from('service_area_zips').select('id', { count: 'exact', head: true }).eq('business_id', biz.id),
        db.from('service_area_zips').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('postal_code', customer_zip),
      ]);
      if (total > 0 && !hit) return res.status(409).json({ code: 'zip_out_of_area', error: `ZIP ${customer_zip} is outside ${biz.name || 'this business'}'s service area.` });
    } catch (e) { console.warn('[estimate_create] zip check failed:', e.message); }
  }

  let description = '';
  let line_items = [];
  if (selections && Array.isArray(selections)) {
    line_items = sanitizeLineItems(selections.map(s => ({
      description: s.label,
      qty: s.quantity || 1,
      unit_price: s.price || 0,
    })));
  }
  if (body.confirm_high_price !== true) {
    const issue = priceSanityIssue({ lines: line_items });
    if (issue) return res.status(409).json({ error: issue, code: 'high_price_confirm_required' });
  }
  if (!line_items.length) description = 'Estimate for services requested';

  const upsells = sanitizeUpsells(body.upsells);

  let estTechId = null;
  if (body.technician_id) {
    const { data: tRow } = await db.from('technicians').select('id').eq('id', String(body.technician_id)).eq('active', true).maybeSingle();
    if (!tRow) return res.status(400).json({ error: 'That technician is not available. Pick another.' });
    estTechId = tRow.id;
  }

  const mergeInto = body.merge_into != null && PHONE_REQUEST_UUID.test(String(body.merge_into)) ? String(body.merge_into) : null;
  const p10 = phone10(estPhone);
  if (!mergeInto && body.force_new !== true && p10.length === 10) {
    try {
      const { data: dup } = await db.from('estimates')
        .select('id, customer_name, customer_phone, service_label, source, created_at, status')
        .eq('business_id', biz.id).ilike('customer_phone', `%${p10.slice(-4)}%`).is('deleted_at', null).is('approved_at', null)
        .not('status', 'in', `(${UNSENT_CLOSED.join(',')},scheduled,approved,booked)`)
        .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
        .order('created_at', { ascending: false }).limit(10);
      const exact = (dup || []).find((d) => d.id !== estimateId && phone10(d.customer_phone) === p10);
      if (exact) {
        const { customer_phone: _p, ...existing } = exact;
        return res.status(409).json({ code: 'existing_open', error: 'Open estimate for this phone', existing });
      }
    } catch (e) { console.warn('[estimate_create] duplicate check failed:', e.message); }
  }

  const estRow = {
    ...(estimateId ? { id: estimateId } : {}),
    business_id: biz.id,
    customer_name: capName(estName) || estPhone || estEmail,
    customer_phone: estPhone || null,
    customer_email: estEmail || null,
    customer_zip,
    service_label: service_label || 'Custom Estimate',
    description,
    line_items,
    upsells,
    tax_rate: taxRate,
    status: 'unsent',
    sms_consent: estSmsConsent,
    source: 'manual',
    created_by: auth.name || adminAuthorName(auth),
    ...(estTechId ? { technician_id: estTechId } : {}),
    ...(estCallId ? { call_id: estCallId } : {}),
  };
  let est = null, createErr = null;
  if (mergeInto) {
    const { data: target } = await db.from('estimates').select('id, customer_email, customer_name')
      .eq('id', mergeInto).eq('business_id', biz.id).is('deleted_at', null).maybeSingle();
    if (!target) return res.status(404).json({ error: 'That estimate is gone. Start a new one.' });
    const { id: _i, business_id: _b, source: _s, created_by: _c, status: _st, call_id: _ci, ...upd } = estRow;
    if (!estEmail) delete upd.customer_email;
    if (!estName) delete upd.customer_name;
    const { error: mErr } = await db.from('estimates').update(upd).eq('id', mergeInto).eq('business_id', biz.id);
    if (mErr) throw mErr;
    est = { id: mergeInto };
  } else {
    ({ data: est, error: createErr } = await insertEstimateResilient(db, estRow, estimateId ? ['id', 'line_items', 'tax_rate'] : []));
  }

  if (createErr?.code === '23505' && estimateId) {
    const { data: existing, error } = await db.from('estimates').select('id')
      .eq('id', estimateId).eq('business_id', biz.id).maybeSingle();
    if (error) throw error;
    if (existing) return res.status(200).json({ id: existing.id, ok: true, duplicate: true, delivery_unknown: true,
      warning: 'Estimate already exists. Delivery may still be processing; check it before resending.' });
    return res.status(409).json({ error: 'This estimate identifier is already in use. Start a new estimate.' });
  }
  if (createErr) throw createErr;
  if (!est?.id) return res.status(500).json({ error: 'The estimate record was not returned. Retry using the same estimate attempt.' });

  if (body.prospect_id && PHONE_REQUEST_UUID.test(String(body.prospect_id))) {
    const qTotal = line_items.reduce((s, li) => s + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
    let held = false;
    try { held = await prospectQuoteLink(db, auth, String(body.prospect_id), est.id, Math.round(qTotal * 100) / 100); }
    catch (e) { console.error('[estimate_create] prospect link failed:', e.message); held = qTotal > 2000 && auth.role !== 'owner'; }
    if (held) return res.status(201).json({ id: est.id, ok: true, held: true, warning: "Over $2,000: saved, waiting for Owner's OK." });
  }

  try {
  const emailOff = !emailNotificationsOn() ? 'Email notifications are turned off'
    : !emailConfig(biz.slug).apiKey ? 'Email service not configured'
    : null;

  const firstName = greetName(estName ? estName.split(/\s+/)[0] : '');
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const approveToken = signToken({ kind: 'estimate_approve', estimate_id: est.id }, 7776000);
  const approveUrl = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(approveToken)}` : '';
  let emailed = false, emailWarning = emailOff;
  if (estEmail && !emailOff) {
    const { subject, html } = estimateEmail(
      { firstName, serviceLabel: service_label || 'Custom Estimate', description, lineItems: line_items, taxRate, approveUrl: approveUrl && `${approveUrl}&via=email`, upsells: publicUpsells(upsells) },
      brandFor(biz.slug)
    );
    try {
      const sentMail = await sendEmail({ slug: biz.slug, to: estEmail, subject, html, throwOnError: true });
      emailed = true;
      await markEstimateContacted(db, biz.id, est.id, auth.name || adminAuthorName(auth), 'email', sentMail && sentMail.id);
    } catch (e) {
      console.warn('[estimate_create] email send failed, but estimate created:', e.message);
      emailWarning = `email failed: ${e.message}`;
    }
  }

  let texted = false;
  if (estPhone && estSmsConsent && approveUrl && (await staffTextGate(db, estPhone, true)).ok) {
    try {
      const greeting = firstName ? `Hi ${firstName}, here's` : `Here's`;
      const svcTxt = (service_label && service_label !== 'Custom Estimate') ? `${service_label}. ` : '';
      const shortLink = estimateApproveLink({ slug: biz.slug, token: approveToken, fallbackUrl: approveUrl });
      const msg = `${greeting} your estimate. ${svcTxt}View & approve it here:\n${shortLink}\n\nReply or call with any questions.`;
      const r = await sendSMSResult(estPhone, msg);
      await logAutomatedMessage(db, { businessId: biz.id, customerPhone: estPhone, body: msg, result: r });
      texted = !!r.ok;
      if (texted) await markEstimateContacted(db, biz.id, est.id, auth.name || adminAuthorName(auth), 'sms');
      if (!r.ok) console.warn(`[estimate_create] estimate SMS not sent:`, r.skipped || r.error);
    } catch (e) {
      console.warn('[estimate_create] estimate SMS threw:', e.message);
    }
  }

  let warning = null;
  if (!emailed && !texted) {
    warning = estEmail
      ? `Estimate saved but nothing could be sent (${emailWarning || 'no delivery channel available'}) — reach out manually.`
      : 'Estimate saved but the text could not be sent — reach out manually.';
  } else if (estEmail && !emailed && emailWarning) {
    warning = `Sent by text. Email did not go out (${emailWarning}).`;
  }
  return res.status(201).json({ id: est.id, ok: true, texted, emailed, warning });
  } catch (error) {
    console.error('[estimate_create] saved estimate delivery failed:', error.message);
    return res.status(201).json({ id: est.id, ok: true, delivery_unknown: true,
      warning: 'Estimate was saved, but delivery could not be confirmed. Open the estimate before sending again.' });
  }
}

async function estimateLink(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const id = String(req.query.id || '').slice(0, 64);
  const est = id ? await fetchEstimate(db, id, biz.id, 'id') : null;
  if (!est) return res.status(404).json({ error: 'Estimate not found' });
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const approveToken = signToken({ kind: 'estimate_approve', estimate_id: est.id }, 7776000);
  const approveUrl = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(approveToken)}` : '';
  const url = estimateApproveLink({ slug: biz.slug, token: approveToken, fallbackUrl: approveUrl });
  if (!url) return res.status(500).json({ error: 'Could not make the link' });
  return res.status(200).json({ url });
}

async function estimateSendSms(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  if (await prospectQuoteHeld(db, auth, body.id)) return res.status(403).json({ error: "Needs Owner's OK first" });

  const est = await fetchEstimate(db, body.id, biz.id, 'customer_name, customer_phone, service_label, description, sms_consent');
  if (!est) return res.status(404).json({ error: 'Estimate not found' });
  if (!est.customer_phone) return res.status(400).json({ error: 'Customer phone not available for this estimate.' });
  if (gateRefuse(res, await staffTextGate(db, est.customer_phone, est.sms_consent === true))) return;

  const firstName = greetName((est.customer_name || '').trim().split(/\s+/)[0]);
  const greeting = firstName ? `Hi ${firstName}, here's` : `Here's`;
  const svcTxt = est.service_label ? `${est.service_label}: ` : '';
  const items = Array.isArray(est.line_items) ? est.line_items : [];
  const body_txt = items.length
    ? items.map(it => `${it.qty && it.qty !== 1 ? it.qty + '× ' : ''}${it.description}`).filter(Boolean).slice(0, 4).join('; ')
    : (est.description || 'Your estimate request');
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const approveToken = signToken({ kind: 'estimate_approve', estimate_id: body.id }, 7776000);
  const approveUrl = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(approveToken)}` : '';
  const shortLink = estimateApproveLink({ slug: biz.slug, token: approveToken, fallbackUrl: approveUrl });
  const linkTxt = shortLink ? `\nCheck availability & schedule:\n${shortLink}` : ' Reply or call us to get scheduled.';
  const msg = `${greeting} the estimate you requested. ${svcTxt}${body_txt}.${linkTxt}`;

  const r = await sendSMSResult(est.customer_phone, msg);
  await logAutomatedMessage(db, { businessId: biz.id, customerPhone: est.customer_phone, body: msg, result: r });
  if (!r.ok) {
    if (r.skipped === 'notifications_off') return res.status(503).json({ error: 'Texting is turned off until the account is approved.' });
    if (r.skipped === 'not_configured')   return res.status(503).json({ error: 'SMS service (Twilio) is not configured.' });
    if (r.skipped === 'bad_phone')        return res.status(400).json({ error: `"${est.customer_phone}" is not a valid mobile number.` });
    return res.status(502).json({ error: r.error || 'Text message failed to send.' });
  }

  const patch = await markEstimateContacted(db, biz.id, body.id, auth.name || adminAuthorName(auth), 'sms');
  return res.status(200).json({ ok: true, estimate: patch });
}

const FOLLOWUP_STARTS = Date.parse('2026-09-22T00:00:00-06:00');
const FOLLOWUP_AFTER_MS = 24 * 3600000;
async function estimateFollowups(req, res, db, auth) {
  const biz = await resolveBusiness(db, auth, req.query.business || '');
  const now = Date.now();
  const cols = 'id, customer_name, customer_phone, customer_email, service_label, line_items, tax_rate, sms_consent, notes, source, created_at, contacted_at, texted_at, emailed_at, text_opened_at, email_opened_at, followup_emailed_at';
  const { data, error } = await db.from('estimates').select(cols)
    .eq('business_id', biz.id).eq('status', 'sent').is('approved_at', null).is('deleted_at', null)
    .gte('created_at', new Date(now - 21 * 86400000).toISOString())
    .order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  const ms = (t) => (t ? Date.parse(t) : 0) || 0;
  const bookedAt = new Map();
  try {
    const phones = [...new Set((data || []).map((e) => String(e.customer_phone || '').replace(/\D/g, '').slice(-10)).filter((p) => p.length === 10))];
    if (phones.length) {
      const { data: cs } = await db.from('customers').select('id, phone').in('phone', phones);
      const byId = new Map((cs || []).map((c) => [c.id, String(c.phone || '').replace(/\D/g, '').slice(-10)]));
      if (byId.size) {
        const { data: bs } = await db.from('bookings').select('customer_id, created_at').in('customer_id', [...byId.keys()]).neq('status', 'cancelled')
          .gte('created_at', new Date(now - 30 * 86400000).toISOString());
        for (const b of bs || []) { const p = byId.get(b.customer_id); if (p && ms(b.created_at) > (bookedAt.get(p) || 0)) bookedAt.set(p, ms(b.created_at)); }
      }
    }
  } catch (err) { console.warn('[estimate_followups] booking check failed:', err.message); }
  const opened = [], unopened = [];
  for (const e of (data || [])) {
    if ((bookedAt.get(String(e.customer_phone || '').replace(/\D/g, '').slice(-10)) || 0) >= ms(e.created_at)) continue;
    const items = Array.isArray(e.line_items) ? e.line_items : [];
    const sub = items.reduce((t, it) => t + (Number(it.qty != null ? it.qty : it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
    const total = Math.round(sub * (1 + (Number(e.tax_rate) || 0)) * 100) / 100;
    const sentAt = Math.max(ms(e.contacted_at), ms(e.texted_at), ms(e.emailed_at)) || ms(e.created_at);
    const openedAt = Math.max(ms(e.text_opened_at), ms(e.email_opened_at));
    const rem = [...String(e.notes || '').matchAll(/Reminder texted (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/g)].map(m => Date.parse(m[1])).filter(Boolean);
    const remindedAt = Math.max(rem.length ? Math.max(...rem) : 0, ms(e.followup_emailed_at));
    const row = {
      id: e.id, name: e.customer_name || '', phone: e.customer_phone || '', email: e.customer_email || '',
      service: e.service_label || '', total: items.length ? total : null, can_text: !!(e.customer_phone && e.sms_consent === true),
      phone_estimate: e.source === 'manual', sent_at: sentAt ? new Date(sentAt).toISOString() : null,
      opened_at: openedAt ? new Date(openedAt).toISOString() : null,
      reminded_at: remindedAt ? new Date(remindedAt).toISOString() : null,
      auto_emailed_at: e.followup_emailed_at || null, created_at: e.created_at,
    };
    if (!sentAt || sentAt < FOLLOWUP_STARTS) continue;
    const lastTouch = Math.max(sentAt, remindedAt);
    if (lastTouch > now - FOLLOWUP_AFTER_MS || sentAt < now - 14 * 86400000) continue;
    if (openedAt) opened.push(row);
    else unopened.push(row);
  }
  opened.sort((a, b) => Date.parse(b.opened_at) - Date.parse(a.opened_at));
  unopened.sort((a, b) => Date.parse(b.sent_at) - Date.parse(a.sent_at));
  return res.status(200).json({ opened, unopened });
}

const SCOPE_HANDSET = { 'tidyhaus': '0000000000', doms: '0000000000' };
async function ringSetup(req, res, db, auth) {
  if (auth.role === 'auditor') return res.status(200).json({ topics: [] });
  const { ringTopic } = await import('./_lib/ring-push.js');
  const phones = new Set();
  try {
    const { data } = await db.from('staff_users').select('name, phone').eq('active', true);
    for (const s of data || []) if (s.name === auth.name && s.phone) phones.add(String(s.phone).replace(/\D/g, '').slice(-10));
  } catch { /* fall through */ }
  if (auth.role === 'owner') { const o = String(process.env.OWNER_PHONE_NUMBER || '').replace(/\D/g, '').slice(-10); if (o) phones.add(o); }
  if (!phones.size && SCOPE_HANDSET[auth.scope]) phones.add(SCOPE_HANDSET[auth.scope]);
  return res.status(200).json({ url: process.env.SUPABASE_URL || null, key: process.env.SUPABASE_ANON_KEY || null, topics: [...phones].map(ringTopic).filter(Boolean) });
}
async function ringCard(req, res, db, auth) {
  const ph = String(req.query.phone || '').replace(/\D/g, '').slice(-10);
  if (ph.length !== 10) return res.status(200).json({});
  const out = { phone: ph, name: null, jobs: 0, spent: 0, last_job: null, upcoming: null, estimates: [], last_call: null, blocked: false };
  const [cust, calls, ests, blk] = await Promise.all([
    db.from('customers').select('id, name, email').eq('phone', ph).limit(5),
    db.from('calls').select('id, occurred_at, kind, transcript_summary, handled_by').eq('caller_phone', ph).not('transcript_summary', 'is', null).order('occurred_at', { ascending: false }).limit(1),
    db.from('estimates').select('id, service_label, status, created_at, line_items, tax_rate, approved_at, business:businesses ( slug, name )').ilike('customer_phone', '%' + ph).not('status', 'in', '(lost,expired,booked,out_of_area)').is('deleted_at', null).order('created_at', { ascending: false }).limit(3),
    db.from('blocked_numbers').select('id').eq('phone', ph).limit(1),
  ]);
  out.blocked = !!(blk.data && blk.data.length);
  const cs = cust.data || [];
  out.name = (cs.find((c) => c.name && c.name.replace(/\D/g, '') !== ph) || {}).name || null;
  out.email = (cs.find((c) => c.email) || {}).email || null;
  if (cs.length) {
    const { data: bs } = await db.from('bookings').select('scheduled_at, status, price, payment_status').in('customer_id', cs.map((c) => c.id)).neq('status', 'cancelled').order('scheduled_at', { ascending: false }).limit(50);
    const now = Date.now();
    for (const b of bs || []) {
      if (b.status === 'completed') { out.jobs++; out.spent += Number(b.price) || 0; if (!out.last_job) out.last_job = b.scheduled_at; }
      else if (Date.parse(b.scheduled_at) > now) out.upcoming = b.scheduled_at;
    }
  }
  const c0 = (calls.data || [])[0];
  if (c0) out.last_call = { id: c0.id, at: c0.occurred_at, by: c0.handled_by, items: (c0.transcript_summary.items || []).map((i) => i.text).slice(0, 4) };
  out.estimates = (ests.data || []).map((e) => {
    const items = Array.isArray(e.line_items) ? e.line_items : [];
    const sub = items.reduce((t, it) => t + (Number(it.qty != null ? it.qty : it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
    return { id: e.id, service: e.service_label, status: e.status, at: e.created_at, approved: !!e.approved_at, biz: e.business && e.business.name, total: Math.round(sub * (1 + (Number(e.tax_rate) || 0)) * 100) / 100 };
  });
  return res.status(200).json(out);
}

async function estimateStory(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business || ''); } catch (e) { return bail(res, e); }
  const id = String(req.query.id || '');
  const { data: e } = await db.from('estimates').select('*').eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (!e) return res.status(404).json({ error: 'Estimate not found' });
  const items = (Array.isArray(e.line_items) ? e.line_items : []).map((it) => ({
    label: it.description || it.label || it.name || 'Item', qty: Number(it.qty != null ? it.qty : it.quantity) || 1, price: Number(it.unit_price != null ? it.unit_price : it.price) || 0,
  }));
  const sub = Math.round(items.reduce((t, it) => t + it.qty * it.price, 0) * 100) / 100;
  const tax = Math.round(sub * (Number(e.tax_rate) || 0) * 100) / 100;
  const ev = [];
  const add = (at, kind, text, by, extra) => { if (at) ev.push({ at, kind, text, by: by || null, ...(extra || {}) }); };
  const src = e.source === 'manual' ? 'Quote made on a phone call' : e.source === 'website_form' ? 'Website message came in' : 'Estimate request came in from the website';
  add(e.created_at, 'created', src, e.contacted_by && e.source === 'manual' ? e.contacted_by : null);
  add(e.texted_at, 'sent', 'Estimate texted to the customer', e.texted_by);
  add(e.emailed_at, 'sent', 'Estimate emailed to the customer', e.emailed_by);
  if (!e.texted_at && !e.emailed_at) add(e.contacted_at, 'sent', 'Estimate sent', e.contacted_by);
  add(e.text_opened_at, 'opened', 'Customer opened the texted estimate');
  add(e.email_opened_at, 'opened', 'Customer opened the emailed estimate');
  add(e.followup_emailed_at, 'followup', e.followup_sent_by ? 'Coupon follow-up email sent ($20 off)' : 'Automatic 3-hour coupon email sent ($20 off)', e.followup_sent_by);
  for (const m of String(e.notes || '').matchAll(/Reminder texted (\d{4}-\d{2}-\d{2}T[\d:.]+Z)(?: by ([^·\n]+))?/g)) add(m[1], 'followup', 'Reminder text sent', m[2] && m[2].trim().replace(/\.$/, ''));
  add(e.email_bounced_at, 'problem', 'Email bounced — the customer never got it');
  add(e.approved_at, 'approved', `Customer approved${e.approved_total ? ' · $' + Number(e.approved_total).toFixed(2) : ''}`);
  if (e.status === 'out_of_area') add(e.updated_at, 'declined', 'Out of area / not a fit');
  if (e.status === 'lost') add(e.updated_at, 'declined', `Lost${e.closed_reason && e.closed_reason !== 'auto' ? ' · ' + e.closed_reason : ' · no reply'}`);
  if (e.status === 'expired') add(e.updated_at, 'declined', 'Expired · never sent');
  if (e.customer_note) add(e.approved_at || e.created_at, 'note', `Customer wrote: "${String(e.customer_note).slice(0, 400)}"`);
  const ph = String(e.customer_phone || '').replace(/\D/g, '').slice(-10);
  const since = new Date(Date.parse(e.created_at) - 2 * 86400000).toISOString();
  if (ph.length === 10) {
    try {
      const { data: cs } = await db.from('calls').select('id, occurred_at, kind, answered, duration_sec, handled_by, transcript_summary, resolution')
        .eq('caller_phone', ph).gte('occurred_at', since).order('occurred_at').limit(30);
      for (const c of cs || []) {
        const sum = c.transcript_summary && Array.isArray(c.transcript_summary.items) ? c.transcript_summary.items.map((i) => i.text).join(' · ') : '';
        if (c.kind === 'live') add(c.occurred_at, 'call', `Phone script${c.resolution ? ' · ' + String(c.resolution).replace(/_/g, ' ') : ''}`, c.handled_by);
        else if (c.kind === 'inbound') add(c.occurred_at, c.answered === false ? 'missed' : 'call', c.answered === false ? 'Customer called — missed' : `Customer called${c.duration_sec ? ' · ' + Math.round(c.duration_sec / 60 * 10) / 10 + ' min' : ''}`, null, { detail: sum || null, call_id: c.id });
      }
      const { data: ca } = await db.from('call_attempts').select('started_at, staff_name, talked').eq('phone', ph).gte('started_at', since).order('started_at').limit(20);
      for (const a of ca || []) add(a.started_at, 'call', a.talked === true ? 'We called the customer — talked' : a.talked === false ? 'We called the customer — no answer' : 'We called the customer back', a.staff_name);
      const { data: ms } = await db.from('messages').select('created_at, direction, sent_by, body').ilike('customer_phone', '%' + ph).gte('created_at', since).order('created_at').limit(60);
      for (const m of ms || []) add(m.created_at, m.direction === 'in' ? 'text_in' : 'text_out', `${m.direction === 'in' ? 'Customer texted' : 'We texted'}: ${String(m.body || '').slice(0, 300)}`, m.direction === 'in' ? null : m.sent_by);
    } catch (err) { console.warn('[estimate_story]', err.message); }
  }
  try {
    const { data: ns } = await db.from('estimate_office_notes').select('body, created_by, created_at').eq('estimate_id', e.id);
    for (const n of ns || []) add(n.created_at, 'note', `Office note: ${n.body}`, n.created_by);
  } catch { /* table optional */ }
  ev.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return res.status(200).json({
    estimate: { id: e.id, name: e.customer_name || '', phone: e.customer_phone || '', email: e.customer_email || '', zip: e.customer_zip || '', address: e.customer_address || '',
      service: e.service_label || '', description: e.description || '', status: e.status, source: e.source, items, subtotal: sub, tax, total: Math.round((sub + tax) * 100) / 100 },
    events: ev,
  });
}

async function estimateCouponSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  const { data: e, error } = await db.from('estimates')
    .select('id, business_id, customer_name, customer_email, service_label, description, customer_note, line_items, tax_rate, upsells, status, approved_at, emailed_at, texted_at, contacted_at, followup_emailed_at')
    .eq('id', body.id).eq('business_id', biz.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!e) return res.status(404).json({ error: 'Estimate not found' });
  if (e.approved_at || e.status === 'approved' || e.status === 'booked') return res.status(409).json({ error: 'This estimate was already approved.' });
  if (e.status === 'out_of_area') return res.status(409).json({ error: 'This estimate was declined.' });
  if (!(e.texted_at || e.emailed_at)) return res.status(400).json({ error: 'Send the original quote first.' });
  if (e.followup_emailed_at) return res.status(409).json({ error: 'The coupon email was already sent.' });
  if (!String(e.customer_email || '').includes('@')) return res.status(400).json({ error: 'No email address on this estimate.' });
  if (!emailConfig(biz.slug).apiKey) return res.status(503).json({ error: 'Email is not set up for this business.' });
  const r = await sendCouponFollowup(db, e, biz.slug, { by: auth.name || adminAuthorName(auth) });
  if (r.already) return res.status(409).json({ error: 'The coupon email was already sent.' });
  if (!r.ok) return res.status(502).json({ error: r.error || 'Email failed to send.' });
  return res.status(200).json({ ok: true, sent_at: r.sent_at });
}

async function estimateRemind(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  const est = await fetchEstimate(db, body.id, biz.id, 'customer_name, customer_phone, sms_consent, status, approved_at, notes');
  if (!est) return res.status(404).json({ error: 'Estimate not found' });
  if (est.approved_at || est.status === 'approved' || est.status === 'booked') return res.status(409).json({ error: 'This estimate was already approved.' });
  if (!est.customer_phone) return res.status(400).json({ error: 'No phone number on this estimate.' });
  if (gateRefuse(res, await staffTextGate(db, est.customer_phone, est.sms_consent === true))) return;
  const firstName = greetName((est.customer_name || '').trim().split(/\s+/)[0]);
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const approveToken = signToken({ kind: 'estimate_approve', estimate_id: body.id }, 7776000);
  const approveUrl = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(approveToken)}` : '';
  const shortLink = estimateApproveLink({ slug: biz.slug, token: approveToken, fallbackUrl: approveUrl });
  const msg = `${firstName ? `Hi ${firstName}, just` : 'Just'} checking in on your estimate. Slots this week are filling up.${shortLink ? `\nView it and pick a time:\n${shortLink}` : ' Reply or call us to get scheduled.'}`;
  const r = await sendSMSResult(est.customer_phone, msg);
  await logAutomatedMessage(db, { businessId: biz.id, customerPhone: est.customer_phone, body: msg, result: r });
  if (!r.ok) {
    if (r.skipped === 'notifications_off') return res.status(503).json({ error: 'Texting is turned off until the account is approved.' });
    if (r.skipped === 'not_configured')   return res.status(503).json({ error: 'SMS service (Twilio) is not configured.' });
    if (r.skipped === 'bad_phone')        return res.status(400).json({ error: `"${est.customer_phone}" is not a valid mobile number.` });
    return res.status(502).json({ error: r.error || 'Text message failed to send.' });
  }
  const stamp = new Date().toISOString();
  const notes = [est.notes, `Reminder texted ${stamp} by ${auth.name || adminAuthorName(auth)}.`].filter(Boolean).join('\n').slice(0, 2000);
  await db.from('estimates').update({ notes }).eq('id', body.id).eq('business_id', biz.id);
  return res.status(200).json({ ok: true, reminded_at: stamp });
}

const LOST_REASONS = { no_reply: 'No reply', price: 'Price too high', elsewhere: 'Went with someone else', not_needed: 'No longer needs it', other: 'Other' };
async function estimateBulkClose(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const days = [14, 30, 60].includes(Number(body.days)) ? Number(body.days) : 30;
  const reason = LOST_REASONS[body.reason] ? body.reason : 'no_reply';
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db.from('estimates').select('id, notes')
    .eq('business_id', biz.id).eq('status', 'sent').is('approved_at', null).is('deleted_at', null)
    .lt('created_at', cutoff).limit(1000);
  if (error) throw error;
  const rows = data || [];
  if (body.dry === true) return res.status(200).json({ ok: true, count: rows.length, days });
  const line = `Closed: ${LOST_REASONS[reason]} (${days}+ days, no approval) by ${auth.name || adminAuthorName(auth)} on ${new Date().toISOString().slice(0, 10)}.`;
  let closed = 0;
  for (let i = 0; i < rows.length; i += 25) {
    await Promise.all(rows.slice(i, i + 25).map(async (r) => {
      const notes = [r.notes, line].filter(Boolean).join('\n').slice(0, 2000);
      const { error: e2 } = await db.from('estimates').update({ status: 'lost', closed_reason: LOST_REASONS[reason], notes })
        .eq('id', r.id).eq('business_id', biz.id).eq('status', 'sent').is('approved_at', null);
      if (!e2) closed++;
    }));
  }
  return res.status(200).json({ ok: true, count: closed, days });
}

async function estimateSendEmail(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });
  if (await prospectQuoteHeld(db, auth, body.id)) return res.status(403).json({ error: "Needs Owner's OK first" });

  const est = await fetchEstimate(db, body.id, biz.id, 'customer_name, customer_email, service_label, description, upsells, customer_note');
  if (!est) return res.status(404).json({ error: 'Estimate not found' });
  if (!est.customer_email) return res.status(400).json({ error: 'Customer email not available for this estimate.' });
  if (!emailNotificationsOn()) return res.status(503).json({ error: 'Email notifications are turned off until the account is approved.' });

  const { apiKey } = emailConfig(biz.slug);
  if (!apiKey) {
    console.warn('[estimate] Resend key not set, cannot send email');
    return res.status(503).json({ error: 'Email service is not configured.' });
  }

  const firstName = greetName((est.customer_name || '').trim().split(/\s+/)[0]);
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const approveToken = signToken({ kind: 'estimate_approve', estimate_id: body.id }, 7776000);
  const approveUrl = baseUrl ? `${baseUrl}/estimate-approve.html?token=${encodeURIComponent(approveToken)}&via=email` : '';
  const { subject, html } = estimateEmail(
    { firstName, serviceLabel: est.service_label, description: est.description, customerNote: est.customer_note, lineItems: est.line_items, taxRate: est.tax_rate, approveUrl, upsells: publicUpsells(est.upsells) },
    brandFor(biz.slug)
  );

  let sentMail = null;
  try {
    sentMail = await sendEmail({ slug: biz.slug, to: est.customer_email, subject, html, throwOnError: true });
  } catch (e) {
    return res.status(502).json({ error: `Email failed to send: ${e.message}` });
  }

  const patch = await markEstimateContacted(db, biz.id, body.id, auth.name || adminAuthorName(auth), 'email', sentMail && sentMail.id);
  return res.status(200).json({ ok: true, estimate: patch });
}


async function brokerCatalog(db, businessId) {
  const { data, error } = await db.from('widget_prices')
    .select('section_key, row_key, label, price, sort_order')
    .eq('business_id', businessId).eq('city_key', 'default')
    .in('section_key', ['size', 'bracket', 'wires'])
    .order('sort_order');
  if (error) throw error;
  const out = {};
  for (const s of BROKER_SECTIONS) out[s.key] = [];
  for (const r of (data || [])) {
    if (out[r.section_key]) out[r.section_key].push({ row_key: r.row_key, label: r.label, our_price: Number(r.price) || 0 });
  }
  return out;
}

async function brokerContext(db, biz, estimateId) {
  const est = await fetchEstimate(db, estimateId, biz.id,
    'id, customer_zip, customer_name, service_label, broker_sub_price, broker_sell_price, broker_company_name, broker_spec');
  if (!est) return { error: { code: 404, msg: 'Estimate not found' } };
  const area = await resolveServiceArea(db, biz.id, biz.slug, est.customer_zip);
  if (!area || !area.unstaffed) {
    return { error: { code: 400, msg: 'This estimate is in a staffed market, so it is not brokered out.' } };
  }
  return { est, area };
}

async function estimateBroker(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });

  const ctx = await brokerContext(db, biz, body.id);
  if (ctx.error) return res.status(ctx.error.code).json({ error: ctx.error.msg });

  const catalog = await brokerCatalog(db, biz.id);
  const spec = brokerResolveSpec(ctx.est, catalog);

  const { data: bids, error: bErr } = await db.from('estimate_broker_bids')
    .select('slot, subcontractor_id, company_name, phone, sub_price, breakdown')
    .eq('estimate_id', body.id).eq('business_id', biz.id).order('slot');
  if (bErr) throw bErr;

  const { data: directory, error: dErr } = await db.from('subcontractors')
    .select('id, company_name, phone').eq('business_id', biz.id).eq('active', true).order('company_name');
  if (dErr) throw dErr;

  const subIds = (bids || []).map(b => b.subcontractor_id).filter(Boolean);
  let rates = [];
  if (subIds.length) {
    const { data: r, error: rErr } = await db.from('subcontractor_rates')
      .select('subcontractor_id, section_key, row_key, price')
      .eq('business_id', biz.id).in('subcontractor_id', subIds);
    if (rErr) throw rErr;
    rates = r || [];
  }
  const rateFor = (subId, section) => {
    const wanted = spec[section];
    if (!subId || !wanted) return null;
    const hit = rates.find(x => x.subcontractor_id === subId && x.section_key === section && x.row_key === wanted);
    return hit ? Number(hit.price) : null;
  };

  const customPriceFor = (bid, id) => {
    const rows = Array.isArray(bid && bid.breakdown) ? bid.breakdown : [];
    const hit = rows.find(r => r && r.section_key === 'custom' && r.row_key === id);
    return hit && hit.price !== null && hit.price !== undefined ? Number(hit.price) : null;
  };

  const required = brokerRequiredLines(spec);
  const bySlot = new Map((bids || []).map(b => [b.slot, b]));
  const slots = [1, 2, 3].map(n => {
    const b = bySlot.get(n) || { slot: n, subcontractor_id: null, company_name: '', phone: '', sub_price: null, breakdown: null };
    const lines = required.map(l => ({
      section_key: l.key, label: l.label, custom: l.custom,
      price: l.custom ? customPriceFor(b, l.key) : rateFor(b.subcontractor_id, l.key),
    }));
    const complete = lines.length > 0 && lines.every(l => l.price !== null);
    const total = complete ? Math.round(lines.reduce((t, l) => t + l.price, 0) * 100) / 100 : null;
    return { slot: n, subcontractor_id: b.subcontractor_id, company_name: b.company_name, phone: b.phone,
             lines, sub_price: total, min_sell: minSellPrice(total) };
  });

  return res.status(200).json({
    ok: true,
    area: { name: ctx.area.name, unstaffed: true },
    catalog, spec, sections: BROKER_SECTIONS.map(s => ({ key: s.key, label: s.label })),
    custom: customLinesOf(spec),
    slots, directory: directory || [],
    booked: ctx.est.broker_company_name ? {
      company_name: ctx.est.broker_company_name,
      sub_price: ctx.est.broker_sub_price,
      sell_price: ctx.est.broker_sell_price,
    } : null,
  });
}

async function estimateBrokerSaveSpec(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });

  const ctx = await brokerContext(db, biz, body.id);
  if (ctx.error) return res.status(ctx.error.code).json({ error: ctx.error.msg });

  const catalog = await brokerCatalog(db, biz.id);
  const spec = {};
  for (const s of BROKER_SECTIONS) {
    const v = body.spec && body.spec[s.key];
    if (!v) { spec[s.key] = null; continue; }
    if (!(catalog[s.key] || []).some(o => o.row_key === v)) {
      return res.status(400).json({ error: `"${v}" is not a valid ${s.label} option.` });
    }
    spec[s.key] = v;
  }
  spec.custom = normalizeCustomLines(body.spec && body.spec.custom);

  const { error } = await db.from('estimates').update({ broker_spec: spec }).eq('id', body.id).eq('business_id', biz.id);
  if (error) throw error;
  return res.status(200).json({ ok: true, spec });
}

async function estimateBrokerSaveBid(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });

  const slot = Number(body.slot);
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ error: 'slot must be 1, 2 or 3' });

  const ctx = await brokerContext(db, biz, body.id);
  if (ctx.error) return res.status(ctx.error.code).json({ error: ctx.error.msg });

  const catalog = await brokerCatalog(db, biz.id);
  const spec = brokerResolveSpec(ctx.est, catalog);

  const company = String(body.company_name || '').trim().slice(0, 200);
  const phone   = String(body.phone || '').trim().slice(0, 40);
  const prices  = (body.prices && typeof body.prices === 'object') ? body.prices : {};
  const required = brokerRequiredLines(spec);
  const anyPrice = required.some(l => parseMoney(prices[l.key]) !== null);

  if (!company && !phone && !anyPrice) {
    const { error } = await db.from('estimate_broker_bids').delete()
      .eq('estimate_id', body.id).eq('business_id', biz.id).eq('slot', slot);
    if (error) throw error;
    return res.status(200).json({ ok: true, cleared: true, slot });
  }
  if (!company) return res.status(400).json({ error: 'Enter the company name for this slot.' });

  let subId = body.subcontractor_id || null;
  if (!subId) {
    const { data: existing } = await db.from('subcontractors')
      .select('id, phone').eq('business_id', biz.id).ilike('company_name', company).maybeSingle();
    if (existing) {
      subId = existing.id;
      if (phone && !existing.phone) {
        await db.from('subcontractors').update({ phone, updated_at: new Date().toISOString() }).eq('id', subId);
      }
    } else {
      const { data: created, error: cErr } = await db.from('subcontractors')
        .insert({ business_id: biz.id, company_name: company, phone: phone || null })
        .select('id').single();
      if (cErr) throw cErr;
      subId = created.id;
    }
  }

  const breakdown = [];
  for (const l of required) {
    const price = parseMoney(prices[l.key]);
    if (price === null) continue;
    if (l.custom) {
      breakdown.push({ section_key: 'custom', row_key: l.key, label: l.label, price });
      continue;
    }
    if (!l.row_key) continue;
    const opt = (catalog[l.key] || []).find(o => o.row_key === l.row_key);
    const { error: upErr } = await db.from('subcontractor_rates').upsert({
      business_id: biz.id, subcontractor_id: subId,
      section_key: l.key, row_key: l.row_key, price,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'subcontractor_id,section_key,row_key' });
    if (upErr) throw upErr;
    breakdown.push({ section_key: l.key, row_key: l.row_key, label: opt ? opt.label : l.row_key, price });
  }

  const complete = breakdown.length === required.length;
  const subPrice = complete ? Math.round(breakdown.reduce((t, l) => t + l.price, 0) * 100) / 100 : null;

  const { error } = await db.from('estimate_broker_bids').upsert({
    estimate_id: body.id, business_id: biz.id, slot,
    subcontractor_id: subId, company_name: company, phone: phone || null,
    sub_price: subPrice, breakdown: breakdown.length ? breakdown : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'estimate_id,slot' });
  if (error) throw error;

  return res.status(200).json({ ok: true, slot, sub_price: subPrice, min_sell: minSellPrice(subPrice) });
}

async function estimateBrokerBook(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });

  const slot = Number(body.slot);
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ error: 'slot must be 1, 2 or 3' });

  const ctx = await brokerContext(db, biz, body.id);
  if (ctx.error) return res.status(ctx.error.code).json({ error: ctx.error.msg });

  const { data: bid, error: bErr } = await db.from('estimate_broker_bids')
    .select('subcontractor_id, company_name, phone, sub_price, breakdown')
    .eq('estimate_id', body.id).eq('business_id', biz.id).eq('slot', slot).maybeSingle();
  if (bErr) throw bErr;
  if (!bid) return res.status(400).json({ error: 'That bid slot is empty.' });
  if (parseMoney(bid.sub_price) === null) {
    return res.status(400).json({ error: 'That company still needs a price for all three lines.' });
  }

  const check = checkSellPrice(bid.sub_price, body.sell_price, !!body.override_below_min);
  if (!check.ok) return res.status(400).json({ error: check.error, below_min: !!check.belowMin, min_sell: check.min });

  const items = brokerQuoteLineItems(ctx.est.service_label, check.sell);

  const patch = {
    broker_subcontractor_id: bid.subcontractor_id || null,
    broker_company_name:     bid.company_name,
    broker_sub_price:        check.sub,
    broker_sell_price:       check.sell,
    broker_below_min:        !!check.belowMin,
    broker_booked_at:        new Date().toISOString(),
    line_items:              items,
  };
  const { error } = await db.from('estimates').update(patch).eq('id', body.id).eq('business_id', biz.id);
  if (error) throw error;

  return res.status(200).json({
    ok: true,
    company_name: bid.company_name,
    sub_price: check.sub, sell_price: check.sell, min_sell: check.min,
    below_min: !!check.belowMin, spread: check.spread,
    breakdown: bid.breakdown || [],
  });
}

async function estimateDecline(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  if (!body.id) return res.status(400).json({ error: 'id required' });

  const est = await fetchEstimate(db, body.id, biz.id, 'customer_name, customer_phone, customer_email, sms_consent, notes');
  if (!est) return res.status(404).json({ error: 'Estimate not found' });

  const firstName = greetName((est.customer_name || '').trim().split(/\s+/)[0]);
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const servicesUrl = baseUrl ? `${baseUrl}/services.html?business=${encodeURIComponent(biz.slug)}` : '';
  const brand = brandFor(biz.slug);

  let smsResult = null, emailResult = null;

  if (est.customer_phone && est.sms_consent === true) {
    const opener = firstName ? `Hi ${firstName}, we're` : "We're";
    const msg = `${opener} sorry, but it looks like your request is outside of what we're able to help with. Here's what we do handle: ${servicesUrl}`;
    smsResult = await sendSMSResult(est.customer_phone, msg);
    await logAutomatedMessage(db, { businessId: biz.id, customerPhone: est.customer_phone, body: msg, result: smsResult });
  }

  if (est.customer_email) {
    const { subject, html } = outOfScopeEmail({ firstName, servicesUrl }, brand);
    emailResult = await sendEmail({ slug: biz.slug, to: est.customer_email, subject, html });
  }

  const patch = {
    status: 'out_of_area',
    notes: [est.notes, `Declined as outside scope — notified via ${[smsResult && smsResult.ok && 'SMS', emailResult && emailResult.sent && 'email'].filter(Boolean).join(' + ') || 'no channel (no phone/email on file)'}.`]
      .filter(Boolean).join('\n').slice(0, 2000),
  };
  const { error } = await db.from('estimates').update(patch).eq('id', body.id).eq('business_id', biz.id);
  if (error) throw error;

  return res.status(200).json({
    ok: true,
    sms_sent: !!(smsResult && smsResult.ok),
    email_sent: !!(emailResult && emailResult.sent),
    estimate: patch,
  });
}

const QUOTE_PROFIT_FLOOR = 50;
const QUOTE_MAX_DISCOUNT_PCT = 0.15;
async function quoteEconomics(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }

  const lines = (Array.isArray(body.line_items) ? body.line_items : []).map(li => ({
    name: String(li.name || li.label || ''),
    quantity: Number(li.quantity) || 1,
    line_total: Number(li.line_total != null ? li.line_total : (Number(li.price) || 0) * (Number(li.quantity) || 1)) || 0,
    kind: li.kind || null,
  }));
  const price = Math.round(lines.reduce((t, li) => t + li.line_total, 0) * 100) / 100;

  const projJob = {
    status: 'completed',
    payment_status: 'paid',
    price,
    subtotal: price,
    notes: '',
    customer_notes: '',
    service_name: '',
    business_slug: biz.slug,
    line_items: lines,
    scheduled_at: body.scheduled_at || new Date().toISOString(),
    travel_payout: 0,
    second_tech: false,
    is_houston: await isHoustonBooking(db, biz.id, biz.slug, await serviceAreaIdFromPostal(db, biz.id, body.postal_code)),
  };
  const { total: pay, flags } = computeJobPay(projJob, 'Office Quote');
  const payout = Number(pay) || 0;
  const bracketCost = bracketHardwareCost(lines, false);
  const profit = Math.round(price - payout - bracketCost);
  const floorRoom = Math.max(0, profit - QUOTE_PROFIT_FLOOR);
  const pctRoom = Math.floor(price * QUOTE_MAX_DISCOUNT_PCT);
  const taxRate = body.tax_rate === undefined ? DEFAULT_EST_TAX_RATE : normalizeTaxRate(body.tax_rate);
  const minimumRoom = price > 0 && !isHandymanPricedLines(lines)
    ? Math.max(0, Math.floor((price - MIN_TICKET_PRICE / (1 + taxRate)) * 100) / 100) : Infinity;
  const maxDiscount = Math.min(floorRoom, pctRoom, minimumRoom);

  return res.status(200).json({
    price,
    ...(auth.role === 'owner' ? { payout: Math.round(payout), bracket_cost: bracketCost, profit, flags } : {}),
    profit,
    max_discount: maxDiscount,
    floor: QUOTE_PROFIT_FLOOR,
    capped_by: maxDiscount <= 0 ? 'nothing to give'
      : minimumRoom <= Math.min(floorRoom, pctRoom) ? 'minimum ticket'
      : (pctRoom < floorRoom ? `${(QUOTE_MAX_DISCOUNT_PCT * 100).toFixed(2).replace(/\.?0+$/, '')}% of the ticket` : 'profit floor'),
  });
}

const CALL_EVENTS = new Set([
  'started', 'service_picked', 'zip_checked', 'question_answered', 'options_done', 'extras_reached',
  'date_picked', 'technician_picked', 'slot_picked', 'price_quoted', 'read_to_customer',
  'accepted', 'pushback', 'source_picked', 'coupon_tried', 'coupon_applied',
  'manual_discount', 'discount_final', 'booking_started', 'booking_created',
  'estimate_sent', 'declined', 'abandoned',
]);
async function callEvent(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const event = String(body.event || '').trim();
  if (!CALL_EVENTS.has(event)) return res.status(400).json({ error: `Unknown event "${event}"` });
  if (!body.call_id) return res.status(400).json({ error: 'call_id required' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }

  const meta = (body.meta && typeof body.meta === 'object') ? body.meta : {};
  const actor = auth.name || adminAuthorName(auth) || auth.role || 'office';
  const { data: call, error: callError } = await db.from('calls').select('id')
    .eq('id', body.call_id).eq('business_id', biz.id).maybeSingle();
  if (callError) throw callError;
  if (!call) return res.status(404).json({ error: 'Call not found. The event was not saved.' });

  {
    const { error } = await db.from('call_events').insert({
      call_id: body.call_id, business_id: biz.id, actor,
      event, step: body.step ? String(body.step).slice(0, 40) : null, meta,
    });
    if (error) throw error;
  }

  const patch = { reached_step: body.step ? String(body.step).slice(0, 40) : undefined };
  if (event === 'extras_reached' || event === 'options_done' || ['schedule', 'recap', 'discount', 'customer', 'estimate'].includes(String(body.step || ''))) patch.reached_extras = true;
  if (event === 'price_quoted') {
    if (meta.total != null) patch.quoted_total = Number(meta.total) || 0;
    if (meta.tv_count != null) patch.tv_count = Number(meta.tv_count) || 0;
  }
  if (event === 'discount_final') {
    patch.discount_amount = Number(meta.amount) || 0;
    patch.discount_detail = meta.detail ? String(meta.detail).slice(0, 200) : null;
  }
  if (event === 'booking_created' && meta.total != null) {
    patch.quoted_total = Number(meta.total) || 0;
  }
  if (['booking_created', 'estimate_sent', 'declined', 'abandoned'].includes(event)) {
    patch.ended_at = new Date().toISOString();
  }
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
  if (Object.keys(patch).length) {
    try {
      const { data, error } = await db.from('calls').update(patch).eq('id', body.call_id).eq('business_id', biz.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Call no longer exists');
    } catch (e) {
      console.warn('[call_event] call patch failed:', e.message);
      return res.status(200).json({ ok: true, recorded: true, warning: 'Call event saved, but its report summary could not be updated.' });
    }
  }
  return res.status(200).json({ ok: true, recorded: true });
}

async function auditHeard(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const id = ((req.body || {}).id || '').toString();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Bad id' });
  const { error } = await db.from('call_audits').update({ heard_at: new Date().toISOString() }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function auditOwnerNote(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};
  const id = (b.id || '').toString();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Bad id' });
  const note = (b.note || '').toString().trim().slice(0, 2000) || null;
  const { error } = await db.from('call_audits').update({ owner_note: note, owner_note_at: note ? new Date().toISOString() : null }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function auditReport(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const days = Math.min(180, Math.max(1, parseInt(req.query.days, 10) || 30));
  const offset = Math.max(-365, Math.min(0, parseInt(req.query.offset, 10) || 0));
  const { data: bizRows } = await db.from('businesses').select('id, slug, timezone').eq('active', true);
  const tz = (bizRows && bizRows[0] && bizRows[0].timezone) || 'Asia/Manila';
  const dayStr = (off) => localDayStartUTC(tz, off).toISOString().slice(0, 10);
  const to = dayStr(offset), from = dayStr(offset - (days - 1));

  const [dayRows, { data: audits }] = await Promise.all([
    callDayRows(db, from, to),
    db.from('call_audits')
      .select('id, audit_date, grasshopper_number, call_id, occurred_at, time_local, handled_by, service, caller_name, caller_phone, answers, flagged, notes, listen_reason, heard_at, owner_note')
      .gte('audit_date', from).lte('audit_date', to)
      .order('occurred_at', { ascending: false }),
  ]);

  const start = localDayStartUTC(tz, offset - (days - 1));
  const end = localDayStartUTC(tz, offset + 1);
  const { data: liveCalls } = await db.from('calls')
    .select('id, occurred_at, handled_by')
    .eq('kind', 'live')
    .gte('occurred_at', start.toISOString())
    .lt('occurred_at', end.toISOString());

  const scriptedByDay = {};
  for (const c of (liveCalls || [])) {
    const d = new Date(c.occurred_at).toLocaleDateString('en-CA', { timeZone: tz });
    scriptedByDay[d] = (scriptedByDay[d] || 0) + 1;
  }

  const countedByDay = {}, byLine = {};
  let totalCounted = 0;
  for (const r of (dayRows || [])) {
    const n = Number(r.calls_counted) || 0;
    totalCounted += n;
    countedByDay[r.audit_date] = (countedByDay[r.audit_date] || 0) + n;
    if (r.grasshopper_number) byLine[r.grasshopper_number] = (byLine[r.grasshopper_number] || 0) + n;
  }
  const totalScripted = (liveCalls || []).length;

  const scoreOf = (a) => {
    const v = Object.values(a.answers || {});
    const yes = v.filter(x => x === 'yes').length;
    const no = v.filter(x => x === 'no').length;
    return { yes, no, pct: (yes + no) ? Math.round(100 * yes / (yes + no)) : null };
  };

  const gradedByDay = {}, scoreAggByDay = {};
  for (const a of (audits || [])) {
    gradedByDay[a.audit_date] = (gradedByDay[a.audit_date] || 0) + 1;
    const s = scoreOf(a);
    if (s.yes + s.no > 0) {
      const g = scoreAggByDay[a.audit_date] || (scoreAggByDay[a.audit_date] = { yes: 0, no: 0 });
      g.yes += s.yes; g.no += s.no;
    }
  }

  const daily = [];
  for (let i = 0; i < days; i++) {
    const d = dayStr(offset - (days - 1) + i);
    const counted = countedByDay[d];
    const agg = scoreAggByDay[d];
    daily.push({
      date: d,
      counted: counted == null ? null : counted,
      scripted: scriptedByDay[d] || 0,
      graded: gradedByDay[d] || 0,
      avg_pct: agg ? Math.round(100 * agg.yes / (agg.yes + agg.no)) : null,
    });
  }

  const people = {};
  const questions = {};
  const questionsByPerson = {};
  for (const a of (audits || [])) {
    const s = scoreOf(a);
    const who = a.handled_by || 'Unknown';
    const p = people[who] || (people[who] = { name: who, audited: 0, yes: 0, no: 0, flagged: 0 });
    p.audited++; p.yes += s.yes; p.no += s.no;
    if (a.flagged) p.flagged++;
    const pq = questionsByPerson[who] || (questionsByPerson[who] = {});
    for (const [k, v] of Object.entries(a.answers || {})) {
      if (v !== 'yes' && v !== 'no') continue;
      const q = questions[k] || (questions[k] = { key: k, asked: 0, no: 0 });
      q.asked++;
      if (v === 'no') q.no++;
      const pqk = pq[k] || (pq[k] = { key: k, asked: 0, no: 0 });
      pqk.asked++;
      if (v === 'no') pqk.no++;
    }
  }

  const rankQuestions = (map) => Object.values(map)
    .map(q => ({ ...q, fail_rate: q.asked ? Math.round(100 * q.no / q.asked) : 0 }))
    .filter(q => q.no > 0)
    .sort((a, b) => b.fail_rate - a.fail_rate || b.asked - a.asked);

  const peopleOut = Object.values(people).map(p => ({
    ...p,
    pct: (p.yes + p.no) ? Math.round(100 * p.yes / (p.yes + p.no)) : null,
    questions: rankQuestions(questionsByPerson[p.name] || {}),
  })).sort((a, b) => b.audited - a.audited);

  const questionsOut = rankQuestions(questions);

  const listenRows = (audits || []).filter(a => a.flagged && a.listen_reason && !a.heard_at).slice(0, 25);
  const recIds = listenRows.map(a => a.call_id).filter(Boolean);
  const withRec = new Set();
  if (recIds.length) {
    const { data: recs } = await db.from('calls').select('id, recording_url').in('id', recIds);
    for (const r of (recs || [])) if (r.recording_url) withRec.add(r.id);
  }
  const flagged = listenRows.map(a => ({
    listen_reason: a.listen_reason, owner_note: a.owner_note || null,
    call_id: a.call_id || null,
    has_recording: !!(a.call_id && withRec.has(a.call_id)),
    id: a.id,
    audit_date: a.audit_date,
    occurred_at: a.occurred_at,
    time_local: a.time_local,
    grasshopper_number: a.grasshopper_number,
    handled_by: a.handled_by,
    service: a.service,
    caller_name: a.caller_name,
    caller_phone: a.caller_phone,
    notes: a.notes,
    pct: scoreOf(a).pct,
  }));

  return res.status(200).json({
    from, to, days,
    volume: {
      counted: totalCounted,
      scripted: totalScripted,
      off_script: Math.max(0, totalCounted - totalScripted),
      by_line: Object.entries(byLine).map(([number, calls]) => ({ number, calls }))
        .sort((a, b) => b.calls - a.calls),
    },
    audited: (audits || []).length,
    people: peopleOut,
    questions: questionsOut,
    flagged,
    daily,
    missing_days: daily.filter(d => d.counted == null).map(d => d.date),
  });
}

let _twilioNumbersCache = null;
const TWILIO_NUMBERS_CACHE_MS = 30 * 1000;
async function fetchTwilioVoiceUrls() {
  if (_twilioNumbersCache && (Date.now() - _twilioNumbersCache.at) < TWILIO_NUMBERS_CACHE_MS) return _twilioNumbersCache.byPhone;
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const byPhone = new Map();
  const smsCap = new Map();
  if (!sid || !token) return byPhone;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  let url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=200`;
  let ok = true;
  try {
    for (let page = 0; page < 5 && url; page++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) { ok = false; break; }
      const data = await r.json();
      for (const rec of (data.incoming_phone_numbers || [])) {
        const ten = (rec.phone_number || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
        if (ten) byPhone.set(ten, rec.voice_url || '');
        if (ten) smsCap.set(ten, !!(rec.capabilities && rec.capabilities.sms));
      }
      url = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
    }
    if (url) ok = false;
  } catch (e) { ok = false; /* Twilio unreachable/slow -- callers treat a missing entry as "unknown" */ }
  _twilioNumbersCache = { at: Date.now(), byPhone, smsCap, ok };
  return byPhone;
}
function aiVoiceStatusFor(voiceUrl) {
  if (voiceUrl == null) return 'unknown';
  return /vapi\.ai/i.test(voiceUrl) ? 'connected' : 'not_connected';
}

let _twilioSmsCache = null;
async function fetchTwilioSmsReadiness() {
  if (_twilioSmsCache && (Date.now() - _twilioSmsCache.at) < TWILIO_NUMBERS_CACHE_MS) return _twilioSmsCache.v;
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const out = { ok: false, error: null, service_sid: null, service_name: null, pool: new Set(), pool_size: 0, campaign_status: null };
  if (!sid || !token) { out.error = 'Twilio not configured'; return out; }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const get = async (url) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, signal: ctrl.signal });
      if (!r.ok) throw new Error(`Twilio ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  };
  try {
    let svcSid = process.env.TWILIO_MESSAGING_SERVICE_SID || null, svcName = null;
    if (!svcSid) {
      const d = await get('https://messaging.twilio.com/v1/Services?PageSize=50');
      const list = d.services || [];
      const pick = list.find(x => /a2p/i.test(x.friendly_name || '')) || list[0];
      if (pick) { svcSid = pick.sid; svcName = pick.friendly_name || null; }
    }
    if (!svcSid) { out.error = 'no Messaging Service in the account'; _twilioSmsCache = { at: Date.now(), v: out }; return out; }
    out.service_sid = svcSid; out.service_name = svcName;

    const pool = await get(`https://messaging.twilio.com/v1/Services/${svcSid}/PhoneNumbers?PageSize=100`);
    for (const n of (pool.phone_numbers || [])) {
      const ten = (n.phone_number || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
      if (ten) out.pool.add(ten);
    }
    out.pool_size = out.pool.size;

    const comp = await get(`https://messaging.twilio.com/v1/Services/${svcSid}/Compliance/Usa2p?PageSize=5`);
    const rows = comp.compliance || comp.us_app_to_person || [];
    out.campaign_status = rows.length ? (rows[0].campaign_status || null) : null;
    out.ok = true;
  } catch (e) {
    out.error = e.message || String(e);
  }
  _twilioSmsCache = { at: Date.now(), v: out };
  return out;
}

function isAdsOnlyLine(n) { return /\bads\b/i.test(String((n && n.display_name) || '')); }

async function twilioLines(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return res.status(500).json({ error: 'Twilio not configured' });
  const H = { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') };
  const want = String((req.method === 'POST' ? body.phones : req.query.phones) || '').split(',').map((x) => x.replace(/\D/g, '').slice(-10)).filter((x) => x.length === 10);
  if (!want.length) return res.status(400).json({ error: 'phones required' });
  const sms = await fetchTwilioSmsReadiness();
  const svc = sms.service_sid ? await (await fetch(`https://messaging.twilio.com/v1/Services/${sms.service_sid}`, { headers: H })).json() : null;
  const out = [];
  for (const ph of want) {
    const j = await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=%2B1${ph}`, { headers: H })).json();
    const rec = (j.incoming_phone_numbers || [])[0];
    const row = { phone: ph, in_twilio: !!rec, voice_url: rec?.voice_url || null, sms_url: rec?.sms_url || null, sms_capable: !!rec?.capabilities?.sms, in_pool: sms.pool.has(ph) };
    if (req.query.calls) {
      const cj = await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?To=%2B1${ph}&PageSize=5`, { headers: H })).json();
      row.recent_calls = (cj.calls || []).map((c) => ({ at: c.start_time, from: c.from, status: c.status, duration: c.duration, sid: c.sid }));
      for (const c of row.recent_calls.slice(0, 2)) {
        const nj = await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${c.sid}/Notifications.json`, { headers: H })).json().catch(() => ({}));
        c.errors = (nj.notifications || []).map((n) => n.error_code + ' ' + (n.message_text || '').slice(0, 200));
      }
    }
    if (req.method === 'POST' && body.set_webhooks && rec) {
      const base = 'https://tidyhaus-crm.vercel.app/api/analytics?action=';
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${rec.sid}.json`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ VoiceUrl: base + 'voice_inbound', VoiceMethod: 'POST', SmsUrl: base + 'sms_inbound', SmsMethod: 'POST' }) });
      const rj = await r.json().catch(() => ({}));
      row.webhooks = r.ok ? 'set' : (rj.message || ('error ' + r.status));
      if (r.ok) { row.voice_url = rj.voice_url; row.sms_url = rj.sms_url; }
    }
    if (req.method === 'POST' && body.add_to_pool && rec && !row.in_pool && sms.service_sid) {
      const r = await fetch(`https://messaging.twilio.com/v1/Services/${sms.service_sid}/PhoneNumbers`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ PhoneNumberSid: rec.sid }) });
      const rj = await r.json().catch(() => ({}));
      row.pool_add = r.ok ? 'added' : (rj.message || ('error ' + r.status));
      if (r.ok) _twilioSmsCache = null;
    }
    out.push(row);
  }
  return res.status(200).json({ campaign_status: sms.campaign_status, service: svc ? { name: svc.friendly_name, inbound_request_url: svc.inbound_request_url || null, use_inbound_webhook_on_number: svc.use_inbound_webhook_on_number } : null, lines: out });
}

async function callNumbers(req, res, db, auth) {
  if (auth.role !== 'owner' && !auth.auditor) return res.status(403).json({ error: 'Owner only' });

  const [{ data: numbers }, { data: businesses }, voiceUrlByPhone, sms, staff, schedules] = await Promise.all([
    db.from('tracking_numbers')
      .select('phone, label, display_name, business_slug, market, forward_to, after_hours_forward_to, active, hours_start, hours_end, hours_timezone')
      .order('business_slug'),
    db.from('businesses').select('slug, name, url'),
    fetchTwilioVoiceUrls(),
    fetchTwilioSmsReadiness(),
    db.from('staff_users').select('name, phone').eq('active', true),
    db.from('staff_schedules').select('name, phone'),
  ]);
  if(staff.error) throw staff.error;
  if(schedules.error) throw schedules.error;
  const recipientNames=new Map([['0000000000','Joey'],['0000000000','Heather'],['0000000000','Owner']]);
  for(const person of [...(schedules.data||[]),...(staff.data||[])]) {
    const phone=digitsOf(person.phone).slice(-10);
    if(phone && person.name) recipientNames.set(phone,person.name);
  }
  const recipientName=phone=>phone?(recipientNames.get(digitsOf(phone).slice(-10))||'Unknown contact'):'Voicemail only';
  const smsCapByPhone = (_twilioNumbersCache && _twilioNumbersCache.smsCap) || new Map();
  const twilioListOk = !!(_twilioNumbersCache && _twilioNumbersCache.ok);
  const campaignApproved = (sms.campaign_status || '').toUpperCase() === 'VERIFIED';
  let volumes = {}, volumeError = null;
  try { volumes = await numberVolumes(db, numbers || []); }
  catch (e) { console.warn('[call_numbers:volume]', e.message); volumeError = 'Call history is temporarily unavailable. Refresh to try again.'; }

  const bizBySlug = {};
  for (const b of (businesses || [])) bizBySlug[b.slug] = b;

  const rows = (numbers || []).filter(n => !isAdsOnlyLine(n)).map(n => {
    const biz = bizBySlug[n.business_slug] || {};
    const hasVoiceUrl = voiceUrlByPhone.has(n.phone);
    return {
      ...n,
      business_name: biz.name || n.business_slug,
      forward_name:recipientName(n.forward_to),
      after_hours_forward_name:recipientName(n.after_hours_forward_to),
      line_name: n.display_name || biz.name || n.business_slug,
      business_url: biz.url || null,
      volume: volumes[n.phone] || null,
      twilio_number_exists: twilioListOk ? hasVoiceUrl : null,
      ai_voice_status: aiVoiceStatusFor(hasVoiceUrl ? voiceUrlByPhone.get(n.phone) : null),
      texting_status: !sms.ok ? 'unknown'
        : smsCapByPhone.has(n.phone) && !smsCapByPhone.get(n.phone) ? 'no_sms_capability'
        : !sms.pool.has(n.phone) ? 'not_in_pool'
        : campaignApproved ? 'active'
        : 'pending',
    };
  });

  return res.status(200).json({
    numbers: rows,
    volume_error: volumeError,
    a2p: {
      error: sms.ok ? null : sms.error,
      campaign_status: sms.campaign_status,
      service_name: sms.service_name,
      pool_size: sms.pool_size,
    },
  });
}

async function secretaryRoster(req, res, db, auth) {
  if (!(auth.role === 'owner' || auth.auditor)) return res.status(403).json({ error: 'Not available for this login' });
  const names = new Set(secretaryNameList());
  const pairs = new Map();
  const add = (name, business) => { if (name && business) pairs.set(business + '|' + name, { name, business }); };
  add(displayNameFor('tidyhaus'), 'tidyhaus');
  add(displayNameFor('doms'), 'doms');
  for (const x of staffLogins()) add(String(x.name), x.scope);
  const { data: bizRows } = await db.from('businesses').select('id, slug').in('slug', ['tidyhaus', 'doms']);
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  for (const b of (bizRows || [])) {
    const { data } = await db.from('calls').select('handled_by').eq('business_id', b.id).eq('kind', 'live')
      .gte('occurred_at', since).not('handled_by', 'is', null).limit(5000);
    for (const r of (data || [])) if (names.has(r.handled_by)) add(r.handled_by, b.slug);
  }
  const people = [...pairs.values()].sort((a, b) => a.name.localeCompare(b.name) || a.business.localeCompare(b.business));
  return res.status(200).json({ people });
}
function perfTargetAuth(req, auth) {
  if (!(auth.role === 'owner' || auth.auditor)) return null;
  const person = String(req.query.person || '').trim();
  const business = String(req.query.business || '');
  if (!person || !['tidyhaus', 'doms'].includes(business)) return null;
  if (!secretaryNameList().includes(person)) return null;
  return { kind: 'admin', role: 'secretary', scope: business, name: person, readOnlyView: true };
}
async function estimateCheckAction(req, res, db, auth) {
  const tgt = perfTargetAuth(req, auth);
  if (tgt) auth = tgt;
  else if (auth.auditor) return res.status(400).json({ error: 'person and business required' });
  const scopes = auth.role === 'owner' ? ['tidyhaus', 'doms']
    : (auth.role === 'secretary' && ['tidyhaus', 'doms'].includes(auth.scope)) ? [auth.scope] : null;
  if (!scopes) return res.status(403).json({ error: 'Not available for this login' });
  const { data: bizRows } = await db.from('businesses').select('id, slug, timezone').in('slug', scopes);
  const people = [];
  for (const slug of scopes) {
    const b = (bizRows || []).find(x => x.slug === slug);
    if (!b) continue;
    const who = auth.role === 'secretary' ? (auth.name || displayNameFor(slug)) : displayNameFor(slug);
    const p = await estimateCheckFor(db, { bizId: b.id, tz: b.timezone || 'Asia/Manila', name: who });
    people.push({ business: slug, ...p });
  }
  return res.status(200).json({ people });
}
async function estimateExcuseAction(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const slug = auth.role === 'owner' ? String(body.business || '') : auth.scope;
  if (!['tidyhaus', 'doms'].includes(slug) || !(auth.role === 'owner' || auth.role === 'secretary')) {
    return res.status(403).json({ error: 'Not available for this login' });
  }
  const { data: bizRows } = await db.from('businesses').select('id').eq('slug', slug).limit(1);
  const bizId = bizRows && bizRows[0] && bizRows[0].id;
  if (!bizId) return res.status(404).json({ error: 'Business not found' });
  try {
    const out = await setExcuse(db, {
      kind: String(body.kind || ''), id: String(body.id || ''), reason: body.reason ? String(body.reason) : '',
      note: body.note, bizId, who: auth.role === 'owner' ? null : (auth.name || displayNameFor(slug)),
    });
    return res.status(200).json(out);
  } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }
}

async function scheduleProposal(req, res, db, auth, body) {
  const owner = auth.role === 'owner';
  if (!owner && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const { data: p } = await db.from('schedule_proposals').select('id, title, people, options, created_at').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!p) return res.status(200).json({ proposal: null });
  const me = String(auth.name || '');
  if (!owner && !(p.people || []).includes(me)) return res.status(200).json({ proposal: null });
  if (req.method === 'POST') {
    if (owner) return res.status(400).json({ error: 'Only the secretaries vote.' });
    const choice = String(body.choice || '');
    if (!(p.options || []).some((o) => o.key === choice)) return res.status(400).json({ error: 'Pick an option.' });
    if (body.agreed !== true) return res.status(400).json({ error: 'Tick "I agree" to send.' });
    const { error } = await db.from('schedule_votes').upsert({ proposal_id: p.id, name: me, choice, agreed: true, note: String(body.note || '').slice(0, 300) || null, voted_at: new Date().toISOString() }, { onConflict: 'proposal_id,name' });
    if (error) throw error;
  }
  let q = db.from('schedule_votes').select('name, choice, agreed, note, voted_at').eq('proposal_id', p.id);
  if (!owner) q = q.eq('name', me);
  const { data: votes } = await q;
  return res.status(200).json({ proposal: p, votes: votes || [] });
}
async function missedBySecretary(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { data: staff } = await db.from('staff_users').select('name, phone').eq('active', true);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const out = [];
  for (const st of staff || []) {
    const d10 = String(st.phone || '').replace(/\D/g, '').slice(-10);
    if (d10.length !== 10 || /^andrew$/i.test(st.name || '')) continue;
    const { count } = await db.from('calls').select('id', { count: 'exact', head: true }).eq('kind', 'inbound').eq('answered', false)
      .in('forwarded_to', ['+1' + d10, d10, '1' + d10]).gte('occurred_at', since);
    out.push({ name: st.name, missed: count || 0 });
  }
  return res.status(200).json({ people: out });
}
const BL_BIG = /(^|\.)(yelp|reddit|bestbuy|facebook|instagram|youtube|google|tiktok|twitter|x|linkedin|pinterest|amazon|homedepot|lowes|angi|homeadvisor|thumbtack|nextdoor|bbb|wikipedia|apple|microsoft|bing|yahoo|mapquest|tripadvisor|taskrabbit|porch|houzz|craigslist|medium|wordpress|blogspot|github|godaddy|wix|squarespace|shopify|vercel)\.[a-z.]+$/i;
async function competitorBacklinks(req, res, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) return res.status(200).json({ error: 'Add DataForSEO keys in Vercel' });
  const clean = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const targets = (body.targets || []).map(clean).filter(Boolean).slice(0, 3);
  const oursList = String(body.ours || 'tidyhausph.com').split(/[\s,]+/).map(clean).filter(Boolean).slice(0, 6);
  const ours = oursList.join(', ');
  if (!targets.length && !oursList.length) return res.status(400).json({ error: 'Add a site' });
  const authH = 'Basic ' + Buffer.from(process.env.DATAFORSEO_LOGIN + ':' + process.env.DATAFORSEO_PASSWORD).toString('base64');
  const pull = async (t) => {
    const r = await fetch('https://api.dataforseo.com/v3/backlinks/referring_domains/live', { method: 'POST', headers: { Authorization: authH, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: t, limit: 500, order_by: ['rank,desc'], exclude_internal_backlinks: true, backlinks_status_type: 'live' }]), signal: AbortSignal.timeout(60000) });
    const j = await r.json().catch(() => null);
    if (!j || j.status_code !== 20000) throw new Error((j && j.status_message) || ('HTTP ' + r.status));
    const task = (j.tasks || [])[0] || {};
    if (task.status_code !== 20000) throw new Error(task.status_message || 'DataForSEO error');
    return ((task.result || [])[0] || {}).items || [];
  };
  let lists;
  try { lists = await Promise.all([...targets, ...oursList].map(pull)); } catch (e) { return res.status(200).json({ error: 'DataForSEO: ' + e.message }); }
  const ourLists = lists.splice(targets.length);
  const oursSet = new Set();
  const ourMap = new Map();
  ourLists.forEach((items, i) => { for (const x of items) { const d = clean(x.domain); if (!d) continue; oursSet.add(d);
    if (BL_BIG.test(d) || oursList.includes(d)) continue;
    const m = ourMap.get(d) || { domain: d, rank: x.rank || 0, spam: Number(x.backlinks_spam_score) || 0, links_to: [] };
    if (!m.links_to.includes(oursList[i])) m.links_to.push(oursList[i]); ourMap.set(d, m); } });
  const our_rows = [...ourMap.values()].sort((a, b) => b.rank - a.rank).slice(0, 300);
  const map = new Map();
  lists.forEach((items, i) => {
    for (const x of items) {
      const d = clean(x.domain);
      if (!d || BL_BIG.test(d) || oursSet.has(d) || targets.includes(d)) continue;
      const spam = Number(x.backlinks_spam_score) || 0;
      if (spam >= 30) continue;
      const m = map.get(d) || { domain: d, rank: x.rank || 0, spam, dofollow: 0, links_to: [] };
      m.rank = Math.max(m.rank, x.rank || 0); m.spam = Math.max(m.spam, spam);
      m.dofollow += Math.max(0, (x.backlinks || 0) - (x.referring_pages_nofollow || 0));
      if (!m.links_to.includes(targets[i])) m.links_to.push(targets[i]);
      map.set(d, m);
    }
  });
  const rows = [...map.values()].sort((a, b) => b.links_to.length - a.links_to.length || b.rank - a.rank).slice(0, 300);
  const out = { targets, ours, rows, our_rows, counts: lists.map((l) => l.length), our_counts: ourLists.map((l) => l.length) };
  try { await serviceClient().from('backlink_runs').insert({ targets, ours, result: out }); } catch (e) { /* history is optional */ }
  return res.status(200).json(out);
}
async function myRungCalls(req, res, db, auth) {
  if (auth.role !== 'secretary' || !auth.name) return res.status(403).json({ error: 'Not available for this login' });
  const { data: me } = await db.from('staff_users').select('phone').eq('name', auth.name).eq('active', true).maybeSingle();
  const d10 = String((me && me.phone) || '').replace(/\D/g, '').slice(-10);
  if (d10.length !== 10) return res.status(200).json({ days: 7, calls: 0, answered: 0, missed: 0 });
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data, error } = await db.from('calls').select('answered, occurred_at, caller_phone, tracking_label').eq('kind', 'inbound')
    .in('forwarded_to', ['+1' + d10, d10, '1' + d10]).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(5000);
  if (error) throw error;
  const calls = (data || []).length, answered = (data || []).filter(r => r.answered === true).length;
  let review_bonuses = 0;
  try {
    const { data: rb } = await db.from('bookings').select('review_call_at, reviewed_at')
      .eq('review_call_status', 'promised_review').eq('review_call_by', auth.name).eq('review_rating', 5)
      .gte('reviewed_at', since > REVIEW_BONUS_FROM ? since : REVIEW_BONUS_FROM).limit(200);
    review_bonuses = (rb || []).filter(b => { const c = Date.parse(b.review_call_at), v = Date.parse(b.reviewed_at); return c && v && v >= c - 3600000 && v <= c + 7 * 86400000; }).length;
  } catch (e) { /* count stays 0 */ }
  const missed_list = (data || []).filter(r => r.answered !== true).slice(0, 100).map(r => ({ at: r.occurred_at, phone: r.caller_phone, line: r.tracking_label ? String(r.tracking_label).replace(/^This call is from\s*/i, '').replace(/\.$/, '') : null }));
  return res.status(200).json({ days: 7, calls, answered, missed: calls - answered, review_bonuses, review_bonus_php: REVIEW_BONUS_PHP, missed_list });
}
async function myCallPerformance(req, res, db, auth) {
  const tgt = perfTargetAuth(req, auth);
  if (tgt) auth = tgt;
  if (auth.role !== 'secretary' || !['tidyhaus', 'doms'].includes(auth.scope)) {
    return res.status(403).json({ error: 'Not available for this login' });
  }
  const name = auth.name || displayNameFor(auth.scope);

  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  const offset = Math.max(-365, Math.min(0, parseInt(req.query.offset, 10) || 0));
  const { data: bizRows } = await db.from('businesses').select('id, timezone').eq('slug', auth.scope).limit(1);
  const bizId = bizRows && bizRows[0] && bizRows[0].id;
  const tz = (bizRows && bizRows[0] && bizRows[0].timezone) || 'Asia/Manila';
  const dayStr = (off) => localDayStartUTC(tz, off).toISOString().slice(0, 10);
  const to = dayStr(offset), from = dayStr(offset - (days - 1));
  const emptyAudit = { audited: 0, script_score: null, flagged: 0, questions: [], notes: [] };
  const empty = {
    name, from, to, days, calls: 0, booked: 0, not_booked: 0, estimates: 0,
    conversion: 0, booked_value: 0, avg_quote: 0, daily: [], audit: emptyAudit,
  };
  if (!bizId) return res.status(200).json(empty);

  const since = localDayStartUTC(tz, offset - (days - 1));
  const until = localDayStartUTC(tz, offset + 1);
  const [{ data: calls, error }, { data: audits, error: auditError }] = await Promise.all([
    db.from('calls')
      .select('handled_by, resolution, booking_id, quoted_total, occurred_at, reached_step, reached_extras')
      .eq('business_id', bizId).eq('kind', 'live')
      .eq('handled_by', name)
      .gte('occurred_at', since.toISOString())
      .lt('occurred_at', until.toISOString()),
    db.from('call_audits')
      .select('id, audit_date, occurred_at, time_local, service, answers, flagged, notes, complaint, complaint_serious')
      .eq('business_id', bizId).eq('handled_by', name)
      .gte('audit_date', from).lte('audit_date', to)
      .order('occurred_at', { ascending: false, nullsFirst: false })
      .order('audit_date', { ascending: false }),
  ]);
  if (error) throw error;
  if (auditError) throw auditError;
  const rows = (calls || []).filter(r => !!r.booking_id || !!r.reached_extras);

  const isBooked = r => !!r.booking_id || r.resolution === 'booked';
  const dayKeyOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });

  let booked = 0, notBooked = 0, estimates = 0, bookedValue = 0, quotedTotal = 0, quotedCount = 0;
  const byDay = {};
  for (const r of rows) {
    const b = isBooked(r);
    if (b) { booked++; bookedValue += Number(r.quoted_total) || 0; }
    else { notBooked++; if (r.resolution === 'estimate_sent') estimates++; }
    if (r.quoted_total != null) { quotedTotal += Number(r.quoted_total) || 0; quotedCount++; }
    const k = dayKeyOf(r.occurred_at);
    const d = byDay[k] || (byDay[k] = { calls: 0, booked: 0 });
    d.calls++; if (b) d.booked++;
  }

  const daily = [];
  for (let i = 0; i < days; i++) {
    const d = dayStr(offset - (days - 1) + i);
    const b = byDay[d];
    daily.push({
      date: d,
      calls: b ? b.calls : 0,
      booked: b ? b.booked : 0,
      conversion: b && b.calls ? Math.round((b.booked / b.calls) * 1000) / 10 : 0,
    });
  }

  let auditYes = 0, auditNo = 0, flagged = 0;
  const auditQuestions = {};
  for (const audit of (audits || [])) {
    if (audit.flagged) flagged++;
    for (const [key, answer] of Object.entries(audit.answers || {})) {
      if (answer !== 'yes' && answer !== 'no') continue;
      auditYes += answer === 'yes' ? 1 : 0;
      auditNo += answer === 'no' ? 1 : 0;
      const question = auditQuestions[key] || (auditQuestions[key] = { key, asked: 0, no: 0 });
      question.asked++;
      if (answer === 'no') question.no++;
    }
  }
  const audit = {
    audited: (audits || []).length,
    script_score: auditYes + auditNo ? Math.round(100 * auditYes / (auditYes + auditNo)) : null,
    flagged,
    questions: Object.values(auditQuestions)
      .map(q => ({ ...q, fail_rate: q.asked ? Math.round(100 * q.no / q.asked) : 0 }))
      .filter(q => q.no > 0)
      .sort((a, b) => b.fail_rate - a.fail_rate || b.asked - a.asked)
      .slice(0, 3),
    notes: (audits || []).filter(a => a.notes).slice(0, 12).map(a => auditCard(a)),
  };
  audit.criteria = Object.values(auditQuestions)
    .map(q => ({ ...q, fail_rate: q.asked ? Math.round(100 * q.no / q.asked) : 0 }))
    .sort((a, b) => b.fail_rate - a.fail_rate || b.asked - a.asked);
  audit.reviews = (audits || []).map(a => {
    const c = auditCard(a);
    const vals = Object.values(a.answers || {});
    const y = vals.filter(v => v === 'yes').length, n = vals.filter(v => v === 'no').length;
    return { ...c, has_notes: !!a.notes, service_key: a.service || null, score: y + n ? Math.round(100 * y / (y + n)) : null };
  });
  const weeks = {};
  for (const a of (audits || [])) {
    if (!a.audit_date) continue;
    const dt = new Date(a.audit_date + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    const wk = dt.toISOString().slice(0, 10);
    const w = weeks[wk] || (weeks[wk] = { week: wk, audits: 0, yes: 0, no: 0 });
    w.audits++;
    for (const v of Object.values(a.answers || {})) { if (v === 'yes') w.yes++; else if (v === 'no') w.no++; }
  }
  audit.weekly = Object.values(weeks).sort((a, b) => a.week < b.week ? -1 : 1)
    .map(w => ({ ...w, score: w.yes + w.no ? Math.round(100 * w.yes / (w.yes + w.no)) : null }));

  function auditCard(a) {
      let when = null;
      if (a.occurred_at) {
        try {
          when = new Date(a.occurred_at).toLocaleString('en-US', {
            timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          }).replace(/, (\d{1,2}:\d{2})/, ' · $1');
        } catch { when = null; }
      }
      const missed = Object.entries(a.answers || {}).filter(([, v]) => v === 'no').map(([k]) => k);
      const done = Object.values(a.answers || {}).filter(v => v === 'yes').length;
      return {
        id: a.id, audit_date: a.audit_date, time_local: a.time_local,
        notes: a.notes, flagged: !!a.flagged,
        complaint: (a.complaint || '').trim() || null, serious: !!a.complaint_serious,
        call: {
          when,
          service: a.service && a.service !== 'unknown' ? a.service : null,
          script_done: done, script_missed: missed,
        },
      };
  }

  return res.status(200).json({
    name, from, to, days,
    calls: rows.length,
    booked, not_booked: notBooked, estimates,
    conversion: rows.length ? Math.round((booked / rows.length) * 1000) / 10 : 0,
    booked_value: Math.round(bookedValue),
    avg_quote: quotedCount ? Math.round(quotedTotal / quotedCount) : 0,
    daily, audit,
  });
}

async function callDayDetail(req, res, db, auth) {
  const dateStr = (req.query.date || (req.body && req.body.date) || '').toString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

  let bizId, tz, person = null;
  if (auth.role === 'secretary') {
    if (!['tidyhaus', 'doms'].includes(auth.scope)) return res.status(403).json({ error: 'Not available for this login' });
    const { data: bizRows } = await db.from('businesses').select('id, timezone').eq('slug', auth.scope).limit(1);
    if (!bizRows || !bizRows[0]) return res.status(200).json({ date: dateStr, calls: [] });
    bizId = bizRows[0].id;
    tz = bizRows[0].timezone || 'Asia/Manila';
    person = auth.name || displayNameFor(auth.scope);
  } else if (auth.role === 'owner' || auth.auditor) {
    let biz; try { biz = await resolveBusiness(db, auth, req.query.business || (req.body && req.body.business)); } catch (e) { return bail(res, e); }
    bizId = biz.id;
    tz = biz.timezone || 'Asia/Manila';
    const p = (req.query.person || (req.body && req.body.person) || '').toString();
    if (p) person = p;
  } else {
    return res.status(403).json({ error: 'Not available for this login' });
  }

  const since = localDateStartUTC(tz, dateStr);
  const until = new Date(since.getTime() + 24 * 60 * 60 * 1000);
  let q = db.from('calls')
    .select('id, handled_by, resolution, booking_id, quoted_total, service, occurred_at')
    .eq('business_id', bizId).eq('kind', 'live')
    .gte('occurred_at', since.toISOString()).lt('occurred_at', until.toISOString())
    .order('occurred_at', { ascending: true });
  if (person) q = q.eq('handled_by', person);
  const { data: rows, error } = await q;
  if (error) throw error;

  const isBooked = r => !!r.booking_id || r.resolution === 'booked';
  return res.status(200).json({
    date: dateStr,
    calls: (rows || []).map(r => ({
      id: r.id,
      handled_by: r.handled_by,
      occurred_at: r.occurred_at,
      service: r.service,
      booked: isBooked(r),
      resolution: r.resolution,
      quoted_total: r.quoted_total,
    })),
  });
}

async function callAnalytics(req, res, db, auth) {
  if (auth.role !== 'owner' && !auth.auditor) return res.status(403).json({ error: 'Owner only' });
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const RANGE_TO_DAYS = { today: 1, yesterday: 1, '7': 7, '30': 30, '90': 90 };
  const range = String(req.query.range || '30');
  const days = RANGE_TO_DAYS[range] ?? Math.min(180, Math.max(1, parseInt(range, 10) || 30));
  const tz = biz.timezone || 'Asia/Manila';
  const since = range === 'yesterday' ? localDayStartUTC(tz, -1) : localDayStartUTC(tz, -(days - 1));
  const until = range === 'yesterday' ? localDayStartUTC(tz, 0) : null;

  let callsQuery = db.from('calls')
    .select('id, handled_by, service, market, status, resolution, booking_id, quoted_total, discount_amount, discount_detail, tv_count, reached_step, reached_extras, occurred_at, ended_at')
    .eq('business_id', biz.id).eq('kind', 'live')
    .gte('occurred_at', since.toISOString());
  if (until) callsQuery = callsQuery.lt('occurred_at', until.toISOString());
  const { data: calls, error } = await callsQuery.order('occurred_at', { ascending: false });
  if (error) throw error;
  const rows = (calls || []).filter(r => !!r.booking_id || !!r.reached_extras);

  let eventsQuery = db.from('call_events')
    .select('call_id, actor, event, step, meta, created_at')
    .eq('business_id', biz.id)
    .gte('created_at', since.toISOString());
  if (until) eventsQuery = eventsQuery.lt('created_at', until.toISOString());
  const { data: events } = await eventsQuery;
  const evs = events || [];

  const isBooked = r => !!r.booking_id || r.resolution === 'booked';
  const dayKeyOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });

  const byPerson = {};
  for (const r of rows) {
    const who = r.handled_by || 'Unknown';
    const p = byPerson[who] || (byPerson[who] = {
      person: who, calls: 0, booked: 0, estimates: 0, not_booked: 0,
      quoted_total: 0, quoted_count: 0, discount_given: 0, discounted_calls: 0, booked_value: 0,
    });
    p.calls++;
    if (isBooked(r)) { p.booked++; p.booked_value += Number(r.quoted_total) || 0; }
    else { p.not_booked++; if (r.resolution === 'estimate_sent') p.estimates++; }
    if (r.quoted_total != null) { p.quoted_total += Number(r.quoted_total) || 0; p.quoted_count++; }
    if (Number(r.discount_amount) > 0) { p.discount_given += Number(r.discount_amount); p.discounted_calls++; }
  }
  const people = Object.values(byPerson).map(p => ({
    ...p,
    conversion: p.calls ? Math.round((p.booked / p.calls) * 1000) / 10 : 0,
    avg_quote: p.quoted_count ? Math.round(p.quoted_total / p.quoted_count) : 0,
    avg_discount: p.discounted_calls ? Math.round(p.discount_given / p.discounted_calls) : 0,
  })).sort((a, b) => b.calls - a.calls);

  const byDay = {};
  for (const r of rows) {
    const k = dayKeyOf(r.occurred_at);
    const d = byDay[k] || (byDay[k] = { date: k, calls: 0, booked: 0, quoted_total: 0, discount_given: 0 });
    d.calls++;
    if (isBooked(r)) { d.booked++; d.quoted_total += Number(r.quoted_total) || 0; }
    d.discount_given += Number(r.discount_amount) || 0;
  }
  const daily = Object.values(byDay).sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(d => ({ ...d, conversion: d.calls ? Math.round((d.booked / d.calls) * 1000) / 10 : 0 }));

  const FUNNEL = ['greet', 'zip', 'tvopts', 'schedule', 'recap', 'discount', 'customer', 'booked'];
  const STEP_ALIAS = { handydesc: 'tvopts', estimate: 'discount', resolution: 'discount' };
  const funnel = FUNNEL.map(step => ({ step, reached: 0 }));
  for (const r of rows) {
    const reached = isBooked(r) ? 'booked' : (STEP_ALIAS[r.reached_step] || r.reached_step || 'greet');
    const idx = FUNNEL.indexOf(reached);
    for (let i = 0; i <= (idx < 0 ? 0 : idx); i++) funnel[i].reached++;
  }

  const discounted = rows.filter(r => Number(r.discount_amount) > 0);
  const callById = Object.fromEntries(rows.map(r => [r.id, r]));
  const finals = evs.filter(e => e.event === 'discount_final' && Number(e.meta?.amount) > 0);

  const lever = { source: { count: 0, amount: 0 }, coupon: { count: 0, amount: 0 }, manual: { count: 0, amount: 0 } };
  const bySource = {}, byCoupon = {};
  for (const e of finals) {
    const m = e.meta || {};
    const amt = Number(m.amount) || 0;
    if (m.source) {
      lever.source.count++; lever.source.amount += amt;
      const s = bySource[m.source] || (bySource[m.source] = { source: m.source, count: 0, amount: 0, booked: 0 });
      s.count++; s.amount += amt;
      if (callById[e.call_id] && isBooked(callById[e.call_id])) s.booked++;
    }
    if (m.coupon) {
      lever.coupon.count++; lever.coupon.amount += amt;
      const c = byCoupon[m.coupon] || (byCoupon[m.coupon] = { code: m.coupon, count: 0, amount: 0, booked: 0 });
      c.count++; c.amount += amt;
      if (callById[e.call_id] && isBooked(callById[e.call_id])) c.booked++;
    }
    if (Number(m.manual) > 0) { lever.manual.count++; lever.manual.amount += amt; }
  }
  const cappedCount = evs.filter(e =>
    e.event === 'manual_discount' && Number(e.meta?.requested) > Number(e.meta?.allowed || 0)).length;
  const badCoupons = {};
  for (const e of evs) {
    if (e.event === 'coupon_tried' && e.meta && e.meta.valid === false && e.meta.code) {
      badCoupons[e.meta.code] = (badCoupons[e.meta.code] || 0) + 1;
    }
  }
  const discountLog = finals
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 100)
    .map(e => {
      const c = callById[e.call_id] || {};
      const m = e.meta || {};
      const levers = [];
      if (m.source) levers.push(m.source);
      if (m.coupon) levers.push(m.coupon);
      if (Number(m.manual) > 0) levers.push(`manual $${Math.round(Number(m.manual))}`);
      return {
        at: e.created_at, person: e.actor || c.handled_by || 'Unknown',
        amount: Number(m.amount) || 0, levers,
        max_allowed: m.max_allowed != null ? Number(m.max_allowed) : null,
        quoted: c.quoted_total != null ? Number(c.quoted_total) : null,
        booked: isBooked(c),
      };
    });
  const discBooked = discounted.filter(isBooked).length;
  const plain = rows.filter(r => !(Number(r.discount_amount) > 0));
  const plainBooked = plain.filter(isBooked).length;

  const totals = {
    calls: rows.length,
    booked: rows.filter(isBooked).length,
    estimates: rows.filter(r => r.resolution === 'estimate_sent').length,
    not_booked: rows.filter(r => !isBooked(r)).length,
    booked_value: Math.round(rows.filter(isBooked).reduce((t, r) => t + (Number(r.quoted_total) || 0), 0)),
    discount_given: Math.round(rows.reduce((t, r) => t + (Number(r.discount_amount) || 0), 0)),
    discounted_calls: discounted.length,
  };
  totals.conversion = totals.calls ? Math.round((totals.booked / totals.calls) * 1000) / 10 : 0;
  totals.avg_discount = discounted.length ? Math.round(totals.discount_given / discounted.length) : 0;

  return res.status(200).json({
    days, since: since.toISOString(), totals, people, daily, funnel,
    discounts: {
      lever: {
        source: { ...lever.source, amount: Math.round(lever.source.amount) },
        coupon: { ...lever.coupon, amount: Math.round(lever.coupon.amount) },
        manual: { ...lever.manual, amount: Math.round(lever.manual.amount) },
      },
      by_source: Object.values(bySource).map(s => ({ ...s, amount: Math.round(s.amount) })).sort((a, b) => b.count - a.count),
      by_coupon: Object.values(byCoupon).map(c => ({ ...c, amount: Math.round(c.amount) })).sort((a, b) => b.count - a.count),
      rejected_coupons: Object.entries(badCoupons).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
      capped_attempts: cappedCount,
      log: discountLog,
      effect: {
        discounted_calls: discounted.length, discounted_booked: discBooked,
        discounted_conversion: discounted.length ? Math.round((discBooked / discounted.length) * 1000) / 10 : 0,
        plain_calls: plain.length, plain_booked: plainBooked,
        plain_conversion: plain.length ? Math.round((plainBooked / plain.length) * 1000) / 10 : 0,
      },
    },
    event_counts: Object.entries(evs.reduce((m, e) => { m[e.event] = (m[e.event] || 0) + 1; return m; }, {}))
      .map(([k, v]) => ({ event: k, count: v })).sort((a, b) => b.count - a.count),
  });
}

function editDistance(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
async function quoteCoupon(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const code = String(body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'code required' });
  const amount = await couponAmountFor(db, biz.slug, code, { strict: true });
  if (!amount) {
    let suggest = null, best = 3;
    for (const c of await couponCodesFor(db, biz.slug, { strict: true })) {
      const d = editDistance(code, c);
      if (d > 0 && d < best) { best = d; suggest = c; }
    }
    return res.status(200).json({ ok: false, code, amount: 0, suggest });
  }
  return res.status(200).json({ ok: true, code, amount });
}

async function servicesPublic(req, res, body) {
  const slug = ((req.query && req.query.business) || (body && body.business) || '').toString().trim();
  if (!slug) return res.status(400).json({ error: 'business required' });
  const db = serviceClient();
  const { data: biz } = await db.from('businesses').select('id, slug, name').eq('slug', slug).maybeSingle();
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const { data: rows } = await db.from('services')
    .select('name, category')
    .eq('business_id', biz.id).eq('active', true)
    .order('sort_order').order('name');
  const groups = {};
  (rows || []).forEach(r => {
    const cat = (r.category || 'Services').trim();
    (groups[cat] = groups[cat] || []).push(r.name);
  });
  return res.status(200).json({ business: biz.slug, business_name: biz.name, groups });
}

function approveTokenEstimateId(raw) {
  const t = verifyToken((raw || '').toString());
  if (!t || t.kind !== 'estimate_approve' || !t.estimate_id) return null;
  return t.estimate_id;
}

function approveTokenDiscount(raw) {
  const t = verifyToken((raw || '').toString());
  if (!t || t.kind !== 'estimate_approve') return 0;
  const d = Number(t.coupon) || 0;
  return d > 0 ? Math.round(d * 100) / 100 : 0;
}

function applyCouponToItems(items, discount) {
  const list = Array.isArray(items) ? items.slice() : [];
  if (discount > 0 && list.length) list.push({ description: `$${discount} off — thanks for getting back to us`, qty: 1, unit_price: -discount });
  return list;
}

async function fetchEstimateAnyBiz(db, id) {
  let cols = 'id, business_id, service_id, customer_name, customer_phone, customer_email, customer_zip, customer_address, customer_city, customer_state, service_label, description, customer_note, line_items, tax_rate, approved_at, preferred_slots, upsells, accepted_upsells, approved_total, sms_consent, technician_id, notes';
  let data, error;
  for (let i = 0; i < 8; i++) {
    ({ data, error } = await db.from('estimates').select(cols).eq('id', id).maybeSingle());
    if (!error) break;
    const col = missingColumn(error.message);
    if (!col || !cols.includes(col)) break;
    cols = cols.split(',').map(s => s.trim()).filter(c => c !== col).join(', ');
  }
  if (error) throw error;
  if (!data) return null;
  if (!Array.isArray(data.line_items)) data.line_items = [];
  if (data.tax_rate == null) data.tax_rate = 0;
  if (!('approved_at' in data)) data.approved_at = null;
  if (!Array.isArray(data.upsells)) data.upsells = [];
  if (!Array.isArray(data.accepted_upsells)) data.accepted_upsells = null;
  if (!('approved_total' in data)) data.approved_total = null;
  const { data: biz, error: bizErr } = await db.from('businesses').select('id, slug, name, timezone').eq('id', data.business_id).maybeSingle();
  if (bizErr) throw bizErr;
  if (!biz) throw new Error(`Estimate ${id} references a business (${data.business_id}) that could not be found.`);
  data.business = biz;
  return data;
}

function sanitizePreferredSlots(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 5).map(s => ({
    date: (s && s.date) ? String(s.date).slice(0, 10) : null,
    slot_key: (s && s.slot_key) ? String(s.slot_key).slice(0, 8) : null,
    label: (s && s.label) ? String(s.label).slice(0, 80) : null,
  })).filter(s => s.date && s.slot_key);
}

async function estimateSlots(req, res) {
  const token = (req.query.token || (req.body && req.body.token) || '').toString();
  const id = approveTokenEstimateId(token);
  if (!id) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const db = serviceClient();
  const est = await fetchEstimateAnyBiz(db, id);
  if (!est) return res.status(404).json({ error: 'Estimate not found.' });

  const slug = est.business?.slug || 'tidyhaus';
  const serviceAreaId = await serviceAreaIdFromPostal(db, est.business_id, est.customer_zip);
  if (!serviceAreaId) {
    console.warn('[estimate_slots] no service area for estimate', id, 'zip', est.customer_zip || '(blank)', '— offering no slots');
    return res.status(200).json({ days: [], timezone: est.business?.timezone || 'Asia/Manila' });
  }
  try {
    const result = await publicOpenSlots(db, { businessSlug: slug, days: 92, serviceAreaId, onlyTechId: est.technician_id || null, zip: est.customer_zip });
    return res.status(200).json({ days: result.days || [], timezone: result.timezone || 'Asia/Manila' });
  } catch (e) {
    console.warn('[estimate_slots] availability lookup failed:', e.message);
    return res.status(200).json({ days: [], timezone: 'Asia/Manila' });
  }
}

const GDS_LINE_NAME = 'Guaranteed Dismount Service';
const GDS_PRICE = 35;
const GDS_RE = /guarante\w*\s+dismount|dismount\s+service|\btv removal\b/i;

function gdsTokenBookingId(raw) {
  const t = verifyToken((raw || '').toString());
  if (!t || t.kind !== 'add_gds' || !t.booking_id) return null;
  return t.booking_id;
}

async function fetchBookingForGds(db, id) {
  const { data, error } = await db.from('bookings')
    .select(`id, business_id, price, status, service:services ( name ), customer:customers ( name )`)
    .eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: biz, error: bizErr } = await db.from('businesses').select('id, slug, name').eq('id', data.business_id).maybeSingle();
  if (bizErr) throw bizErr;
  data.business = biz || null;
  const { data: lines, error: liErr } = await db.from('booking_line_items')
    .select('id, name, kind, quantity, unit_price, line_total, taxable').eq('booking_id', id);
  if (liErr) throw liErr;
  data.line_items = lines || [];
  return data;
}

async function gdsUpsellInfo(req, res, body) {
  const token = (req.query.token || (body && body.token) || '').toString();
  const id = gdsTokenBookingId(token);
  if (!id) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const db = serviceClient();
  const est = await fetchBookingForGds(db, id);
  if (!est) return res.status(404).json({ error: 'Booking not found.' });

  const alreadyHasGds = est.line_items.some(li => GDS_RE.test(li.name || ''));
  return res.status(200).json({
    already_has_gds: alreadyHasGds,
    customer_name: est.customer?.name || '',
    service_label: est.service?.name || 'Service',
    current_total: Number(est.price) || 0,
    gds_price: GDS_PRICE,
    business_slug: est.business?.slug || 'tidyhaus',
    business_name: est.business?.name || 'TidyHaus',
  });
}

async function gdsUpsellAdd(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = (body.token || '').toString();
  const id = gdsTokenBookingId(token);
  if (!id) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const db = serviceClient();
  const est = await fetchBookingForGds(db, id);
  if (!est) return res.status(404).json({ error: 'Booking not found.' });

  if (est.line_items.some(li => GDS_RE.test(li.name || ''))) {
    return res.status(200).json({ ok: true, already: true, new_total: Number(est.price) || 0 });
  }

  const { error: insErr } = await db.from('booking_line_items').insert({
    booking_id: id, business_id: est.business_id, kind: 'service',
    name: GDS_LINE_NAME, quantity: 1, unit_price: GDS_PRICE, line_total: GDS_PRICE,
    service_id: null, option_id: null, taxable: true,
  });
  if (insErr) return res.status(500).json({ error: 'Could not add this to your ticket. Please try again.' });

  await bumpLiRev(db, id);
  await recanonicalizeBookingRows(db, id);

  const taxLine = est.line_items.find(li => /^tax\s*\(/i.test(li.name || ''));
  let taxAdd = 0;
  if (taxLine) {
    const rateMatch = /\(([\d.]+)%\)/.exec(taxLine.name || '');
    const rate = rateMatch ? Number(rateMatch[1]) / 100 : 0;
    taxAdd = Math.round(GDS_PRICE * rate * 100) / 100;
    if (taxAdd > 0) {
      await db.from('booking_line_items').update({
        unit_price: Number(taxLine.unit_price) + taxAdd,
        line_total: Number(taxLine.line_total) + taxAdd,
      }).eq('id', taxLine.id);
    }
  }

  const newTotal = Math.round(((Number(est.price) || 0) + GDS_PRICE + taxAdd) * 100) / 100;
  const { error: updErr } = await db.from('bookings').update({ price: newTotal }).eq('id', id);
  if (updErr) return res.status(500).json({ error: 'Added the service, but could not update the ticket total. We will fix this shortly.' });

  return res.status(200).json({ ok: true, already: false, new_total: newTotal });
}

const RESCHEDULE_CUTOFF_MS = 24 * 60 * 60 * 1000;

function rescheduleTokenBookingId(raw) {
  const t = verifyToken((raw || '').toString());
  if (!t || t.kind !== 'reschedule' || !t.booking_id) return null;
  return t.booking_id;
}

async function fetchBookingForReschedule(db, id) {
  const { data, error } = await db.from('bookings')
    .select(`id, business_id, status, scheduled_at, scheduled_end, duration_minutes, service_area_id, postal_code,
             technician_id, secondary_technician_id, extra_slots, metadata,
             service:services ( name ), customer:customers ( name )`)
    .eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: biz, error: bizErr } = await db.from('businesses').select('id, slug, name, timezone').eq('id', data.business_id).maybeSingle();
  if (bizErr) throw bizErr;
  data.business = biz || null;
  return data;
}

function rescheduleNeedsOffice(b) {
  return !!(b.secondary_technician_id || (Array.isArray(b.extra_slots) && b.extra_slots.length));
}
const RESCHEDULE_CALL_US = 'This appointment has multiple technicians or extra time reserved — please call or text us to reschedule it.';

async function rescheduleInfo(req, res, body) {
  const token = (req.query.token || (body && body.token) || '').toString();
  const id = rescheduleTokenBookingId(token);
  if (!id) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const db = serviceClient();
  const b = await fetchBookingForReschedule(db, id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });

  const slug = b.business?.slug || 'tidyhaus';
  const serviceAreaId = b.service_area_id || await serviceAreaIdFromPostal(db, b.business_id, b.postal_code);
  const tz = await areaTimezone(db, serviceAreaId, b.business?.timezone || 'Asia/Manila');

  const blockedReason =
    b.status === 'cancelled' ? 'This appointment has already been cancelled.'
    : b.status === 'completed' ? 'This appointment has already been completed.'
    : b.status === 'no_show' ? 'This appointment can no longer be rescheduled online — please call or text us.'
    : rescheduleNeedsOffice(b) ? RESCHEDULE_CALL_US
    : null;
  if (blockedReason) {
    return res.status(200).json({
      can_reschedule: false,
      reason: blockedReason,
      customer_name: b.customer?.name || '', service_label: b.service?.name || 'Service',
      business_name: b.business?.name || '', current_date: null, current_time: null, days: [], timezone: tz,
    });
  }
  const scheduledMs = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
  const tooSoon = scheduledMs && (scheduledMs - Date.now() < RESCHEDULE_CUTOFF_MS);

  let days = [];
  try {
    const result = await publicOpenSlots(db, { businessSlug: slug, days: 92, serviceAreaId, timezone: tz, crossHire: true, zip: b.postal_code });
    days = result.days || [];
  } catch (e) { console.warn('[reschedule_info] availability lookup failed:', e.message); }

  return res.status(200).json({
    can_reschedule: !tooSoon,
    reason: tooSoon ? "This appointment is within 24 hours — please call or text us to reschedule; a $50 late-change fee applies." : null,
    customer_name: b.customer?.name || '',
    service_label: b.service?.name || 'Service',
    business_name: b.business?.name || '',
    current_date: b.scheduled_at ? localDateStr(tz, b.scheduled_at) : null,
    current_time: slotTimeLabel(tz, b.scheduled_at),
    business_slug: slug,
    days, timezone: tz,
  });
}

async function rescheduleSubmit(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = (body.token || '').toString();
  const id = rescheduleTokenBookingId(token);
  if (!id) return res.status(401).json({ error: 'This link is invalid or has expired.' });

  const db = serviceClient();
  const b = await fetchBookingForReschedule(db, id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (['cancelled', 'completed', 'no_show'].includes(b.status)) {
    return res.status(409).json({ error: 'This appointment can no longer be rescheduled online — please call or text us.' });
  }
  if (rescheduleNeedsOffice(b)) {
    return res.status(409).json({ error: RESCHEDULE_CALL_US });
  }
  const scheduledMs = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
  if (scheduledMs && (scheduledMs - Date.now() < RESCHEDULE_CUTOFF_MS)) {
    return res.status(409).json({ error: 'This appointment is within 24 hours — please call or text us to reschedule; a $50 late-change fee applies.' });
  }

  const parsed = parseSlotId((body.selected_slot || '').toString());
  const slug = b.business?.slug || 'tidyhaus';
  if (!parsed || parsed.businessSlug !== slug) return res.status(400).json({ error: 'Please pick a valid time slot.' });
  const { dateStr, slotKey } = parsed;

  const serviceAreaId = b.service_area_id || await serviceAreaIdFromPostal(db, b.business_id, b.postal_code);
  const tz = await areaTimezone(db, serviceAreaId, b.business?.timezone || 'Asia/Manila');
  const startUTC = slotStartUTC(tz, dateStr, slotKey);
  const endUTC = slotEndUTC(tz, dateStr, slotKey);
  if (!startUTC) return res.status(400).json({ error: 'Invalid time slot.' });
  if (startUTC.getTime() - Date.now() <= 60 * 60 * 1000) {
    return res.status(409).json({ error: 'That time is too soon — please pick a later slot.' });
  }

  let technician_id = null;
  try { technician_id = await pickOpenTech(db, { businessSlug: slug, dateStr, slotKey, serviceAreaId, timezone: tz, crossHire: true, zip: b.postal_code }); }
  catch (e) { console.warn('[reschedule_submit] tech pick failed:', e.message); }
  if (!technician_id) {
    return res.status(409).json({ error: 'That time was just taken — please pick a different time.', slot_taken: true });
  }

  const oldLabel = `${b.scheduled_at ? localDateStr(tz, b.scheduled_at) : '?'} ${slotTimeLabel(tz, b.scheduled_at) || ''}`.trim();
  const newLabel = `${dateStr} ${slotTimeLabel(tz, startUTC.toISOString()) || ''}`.trim();

  const { error: updErr } = await db.from('bookings').update({
    scheduled_at: startUTC.toISOString(),
    scheduled_end: endUTC ? endUTC.toISOString() : null,
    technician_id,
    status: 'assigned',
    metadata: (({ reminder_sent_at, ...m }) => ({ ...m, rescheduled_from: b.scheduled_at }))(b.metadata || {}),
  }).eq('id', id);
  if (updErr) return res.status(500).json({ error: 'Could not reschedule this appointment. Please try again.' });

  await db.from('booking_notes').insert({
    business_id: b.business_id, booking_id: id,
    author_kind: 'customer', author_id: null, author_name: 'Customer (self-service reschedule)',
    body: `Rescheduled from ${oldLabel} to ${newLabel}.`,
  }).then(({ error }) => { if (error) console.warn('[reschedule_submit] note insert failed:', error.message); })
    .catch(e => console.warn('[reschedule_submit] note insert failed:', e.message));

  const ownerPhone = process.env.OWNER_PHONE_NUMBER;
  if (ownerPhone) {
    await sendSMS(ownerPhone, `${b.customer?.name || 'A customer'} just rescheduled their ${b.business?.name || ''} appointment: ${oldLabel} → ${newLabel}.`)
      .catch(e => console.warn('[reschedule_submit] owner SMS failed:', e.message));
  }
  const bizForNotify = b.business || { id: b.business_id };
  if (b.technician_id && b.technician_id !== technician_id) {
    await notifyTechAssigned(db, bizForNotify, b.technician_id, b.scheduled_at, tz, { bookingId: id, kind: 'unassigned' })
      .catch(e => console.warn('[reschedule_submit] prior-tech SMS failed:', e.message));
  }
  await notifyTechAssigned(db, bizForNotify, technician_id, startUTC.toISOString(), tz,
    { bookingId: id, kind: b.technician_id === technician_id ? 'rescheduled' : 'assigned' })
    .catch(e => console.warn('[reschedule_submit] tech SMS failed:', e.message));

  return res.status(200).json({ ok: true, new_date: dateStr, new_time: slotTimeLabel(tz, startUTC.toISOString()) });
}

function testReviewClickUrl(bizSlug) {
  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const token = signToken({ kind: 'review', booking_id: 'TEST', business_slug: bizSlug }, 3600);
  return `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(token)}&ch=email`;
}

function reviewTesterSample(bizSlug) {
  return { firstName: 'Marcus', technicianName: 'Kregg Daniels', clickUrl: testReviewClickUrl(bizSlug) };
}

async function reviewEmailPreview(req, res) {
  const slug = (req.query.business || 'tidyhaus').toString();
  const bizSlug = ['doms', 'mile-high', 'austin', 'precision'].includes(slug) ? slug : 'tidyhaus';
  const { subject, html } = reviewEmail(reviewTesterSample(bizSlug), brandFor(bizSlug));
  return res.status(200).json({ subject, html });
}

const TEST_EMAIL_RECIPIENT = 'owner@example.invalid';

async function sendTestReviewEmail(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const slug = ((body && body.business) || 'tidyhaus').toString();
  const bizSlug = ['doms', 'mile-high', 'austin', 'precision'].includes(slug) ? slug : 'tidyhaus';
  const brand = brandFor(bizSlug);
  const { subject, html } = reviewEmail(reviewTesterSample(bizSlug), brand);
  const { from } = emailConfig(bizSlug);
  const result = await sendEmail({ slug: bizSlug, to: TEST_EMAIL_RECIPIENT, subject: `[TEST] ${subject}`, html, replyTo: from });
  if (!result.sent) return res.status(500).json({ error: result.error || result.skipped || 'Email did not send.' });
  return res.status(200).json({ ok: true, to: TEST_EMAIL_RECIPIENT });
}

const ZB_PLACEHOLDER_CREW = {};

async function zbImport(req, res, db, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No rows supplied.' });
  const dry = !!body.dry_run;
  const slug = body.business || 'tidyhaus';

  const { data: biz } = await db.from('businesses').select('id, slug').eq('slug', slug).single();
  if (!biz) return res.status(400).json({ error: 'Unknown business ' + slug });

  const { data: areas } = await db.from('service_areas').select('id, name').eq('business_id', biz.id);
  const areaByName = {};
  for (const a of areas || []) areaByName[(a.name || '').toLowerCase()] = a.id;

  const { data: techs } = await db.from('technicians').select('id, name, zenbooker_provider_id').eq('business_id', biz.id);
  const techByCrew = {};
  for (const t of techs || []) if (t.zenbooker_provider_id) techByCrew[t.zenbooker_provider_id] = t.id;
  const techByName = {};
  for (const t of cleaners || []) techByName[(t.name || '').toLowerCase()] = t.id;

  const crewNames = body.crew_names || {};
  const neededCrews = [...new Set(rows.map(r => r.crew).filter(Boolean))];
  const createdTechs = [];
  for (const crew of neededCrews) {
    if (techByCrew[crew]) continue;
    const wanted = crewNames[crew];
    if (wanted && techByName[wanted.toLowerCase()]) {
      const id = techByName[wanted.toLowerCase()];
      if (!dry) await db.from('technicians').update({ zenbooker_provider_id: crew }).eq('id', id);
      techByCrew[crew] = id;
      continue;
    }
    if (!wanted) continue;
    if (dry) { createdTechs.push(wanted); techByCrew[crew] = '00000000-0000-0000-0000-000000000000'; continue; }
    const { data: nt, error } = await db.from('technicians').insert({
      business_id: biz.id, name: wanted, active: false, status: 'off',
      zenbooker_provider_id: crew,
    }).select('id').single();
    if (error) return res.status(500).json({ error: 'tech insert: ' + error.message });
    techByCrew[crew] = nt.id; createdTechs.push(wanted);
  }

  const phones = [...new Set(rows.map(r => r.phone).filter(Boolean))];
  const emails = [...new Set(rows.map(r => r.email).filter(Boolean))];
  const byPhone = {}, byEmail = {};
  for (let i = 0; i < phones.length; i += 200) {
    const { data } = await db.from('customers').select('id, phone').eq('business_id', biz.id).in('phone', phones.slice(i, i + 200));
    for (const c of data || []) if (c.phone) byPhone[c.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')] = c.id;
  }
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await db.from('customers').select('id, email').eq('business_id', biz.id).in('email', emails.slice(i, i + 200));
    for (const c of data || []) if (c.email) byEmail[c.email.toLowerCase()] = c.id;
  }

  const matched = new Set(), toCreate = new Map();
  for (const r of rows) {
    const hit = (r.phone && byPhone[r.phone]) || (r.email && byEmail[r.email]) || null;
    if (hit) { matched.add(hit); continue; }
    const key = r.phone || r.email;
    if (!toCreate.has(key)) toCreate.set(key, r);
  }

  let created = 0;
  if (!dry && toCreate.size) {
    const payload = [...toCreate.values()].map(r => ({
      business_id: biz.id, name: capName(r.name), phone: r.phone || null, email: r.email || null,
      address_line1: r.line1 || null, address_line2: r.line2 || null,
      city: r.city || null, state: r.state || null, postal_code: r.zip || null,
      stripe_customer_id: r.stripe_cust || null,
      metadata: { imported_from: 'zenbooker_all_jobs' },
    }));
    for (let i = 0; i < payload.length; i += 200) {
      const { data, error } = await db.from('customers').insert(payload.slice(i, i + 200)).select('id, phone, email');
      if (error) return res.status(500).json({ error: 'customer insert: ' + error.message });
      for (const c of data || []) {
        created++;
        if (c.phone) byPhone[c.phone.replace(/\D/g, '')] = c.id;
        if (c.email) byEmail[c.email.toLowerCase()] = c.id;
      }
    }
  }

  if (dry) {
    return res.status(200).json({
      dry_run: true, rows: rows.length,
      customers_matched: matched.size, customers_would_create: toCreate.size,
      techs_would_create: createdTechs, crews_unnamed: neededCrews.filter(c => !techByCrew[c]),
      gds_rows: rows.filter(r => r.gds).length,
    });
  }

  const bookingRows = [];
  for (const r of rows) {
    const cid = (r.phone && byPhone[r.phone]) || (r.email && byEmail[r.email]) || null;
    if (!cid) continue;
    bookingRows.push({
      business_id: biz.id, customer_id: cid,
      technician_id: techByCrew[r.crew] || null,
      service_area_id: areaByName[(r.market || '').toLowerCase()] || null,
      status: r.status, source: 'import',
      scheduled_at: r.start, duration_minutes: r.duration || 60,
      subtotal: r.subtotal || 0, price: r.price || 0, tip: r.tip || 0,
      payment_status: r.paid ? 'paid' : 'unpaid',
      amount_paid: r.paid ? (r.price || 0) : 0,
      paid_at: r.paid ? (r.completed || r.start) : null,
      stripe_customer_id: r.stripe_cust || null,
      address_line1: r.line1 || null, address_line2: r.line2 || null,
      city: r.city || null, state: r.state || null, postal_code: r.zip || null,
      on_the_way_at: r.enroute, arrived_at: r.arrived, completed_at: r.completed,
      review_rating: r.rating || null,
      zenbooker_job_id: r.zb_id, zenbooker_job_number: r.job_no || null,
      notes: r.svc || null, payment_required: false,
    });
  }
  const savedIds = {};
  for (let i = 0; i < bookingRows.length; i += 200) {
    const { data, error } = await db.from('bookings')
      .upsert(bookingRows.slice(i, i + 200), { onConflict: 'business_id,zenbooker_job_id' })
      .select('id, zenbooker_job_id');
    if (error) return res.status(500).json({ error: 'booking upsert: ' + error.message });
    for (const b of data || []) savedIds[b.zenbooker_job_id] = b.id;
  }

  const gdsRows = rows.filter(r => r.gds && savedIds[r.zb_id]);
  let gdsWritten = 0;
  if (gdsRows.length) {
    const ids = gdsRows.map(r => savedIds[r.zb_id]);
    const { data: existing } = await db.from('booking_line_items')
      .select('booking_id, name').in('booking_id', ids);
    const have = new Set((existing || []).filter(l => /guaranteed dismount/i.test(l.name || '')).map(l => l.booking_id));
    const payload = gdsRows.filter(r => !have.has(savedIds[r.zb_id])).map(r => ({
      booking_id: savedIds[r.zb_id], business_id: biz.id, kind: 'addon',
      name: 'Guaranteed Dismount Service', quantity: 1, unit_price: 35, line_total: 35,
      taxable: true, zenbooker_ref: r.zb_id, sort_order: 99,
    }));
    if (payload.length) {
      const { error } = await db.from('booking_line_items').insert(payload);
      if (error) return res.status(500).json({ error: 'line item insert: ' + error.message });
      gdsWritten = payload.length;
      const affected = [...new Set(payload.map(p => p.booking_id))];
      const CANON_CAP = 50;
      for (const bid of affected.slice(0, CANON_CAP)) {
        await bumpLiRev(db, bid);
        await recanonicalizeBookingRows(db, bid);
      }
      if (affected.length > CANON_CAP) {
        console.warn(`[zbimport] GDS backfill touched ${affected.length} bookings; only the first ${CANON_CAP} were re-ordered/rev-bumped this run — the rest keep sort_order 99 until next edited.`);
      }
    }
  }

  return res.status(200).json({
    ok: true, rows: rows.length, customers_matched: matched.size, customers_created: created,
    bookings_written: Object.keys(savedIds).length, gds_line_items: gdsWritten,
    techs_created: createdTechs,
  });
}

async function sendGdsRateUpdate(req, res, db) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { data: rows } = await db.from('technicians')
    .select('name, email, business:businesses ( slug )')
    .eq('active', true).not('email', 'is', null);
  const subject = 'Pay rate update: GDS redemption jobs';
  const results = [];
  for (const t of rows || []) {
    const slug = t.business?.slug || 'tidyhaus';
    const firstName = String(t.name || '').trim().split(/\s+/)[0] || 'there';
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;">
      <p>Hi ${firstName},</p>
      <p>Quick rate sheet update. Starting Monday, August 3, Guaranteed Dismount Service
         redemption jobs (the free TV removal visits, $0 to the customer) now pay $50 per job,
         previously $60.</p>
      <p>Everything else on the rate sheet stays the same.</p>
      <p>Thanks,<br>Owner</p>
    </div>`;
    const r = await sendEmail({ slug, to: t.email, subject, html });
    results.push({ to: t.email, name: t.name, business: slug, sent: !!r.sent, error: r.error || r.skipped || null });
  }
  return res.status(200).json({ results });
}

async function sendSpamNotice(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const to = [
    process.env.MILE_HIGH_SECRETARY_EMAIL || process.env.TIDYHAUS_SECRETARY_EMAIL || 'owner@example.invalid',
    process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid',
  ];
  const subject = 'Quick favor: mark this email as "not spam"';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;">
    <p>Hi Joey and Heather,</p>
    <p>We just set up the email address for Mile High Home Cleaning. Because the address is brand new,
       Gmail does not trust it yet and is filing our messages into spam.</p>
    <p><b>If this email landed in your spam folder, please open it and click "Not spam."</b>
       If it came straight to your inbox, no action needed.</p>
    <p>It also helps to add <b>owner@example.invalid</b> to your contacts.</p>
    <p>That small step teaches Gmail we are legitimate, so booking confirmations reach our customers
       instead of their spam folders.</p>
    <p>Thanks,<br>Owner</p>
  </div>`;
  const results = [];
  for (const addr of to) {
    const r = await sendEmail({ slug: 'mile-high', to: addr, subject, html });
    results.push({ to: addr, sent: !!r.sent, error: r.error || r.skipped || null });
  }
  return res.status(200).json({ results });
}

async function estimateApproveInfo(req, res, body) {
  const token = (req.query.token || (body && body.token) || '').toString();
  const id = approveTokenEstimateId(token);
  if (!id) return res.status(401).json({ error: 'This approval link is invalid or has expired.' });

  const db = serviceClient();
  const est = await fetchEstimateAnyBiz(db, id);
  if (!est) return res.status(404).json({ error: 'Estimate not found.' });

  try {
    const via = ((req.query.via || (body && body.via) || '').toString() === 'email') ? 'email' : 'text';
    const col = `${via}_opened_at`;
    if (!est[col]) await db.from('estimates').update({ [col]: new Date().toISOString() }).eq('id', id).is(col, null);
  } catch (e) { console.warn('[estimate_approve_info] opened stamp failed:', e.message); }

  const discount = approveTokenDiscount(token);
  const items = applyCouponToItems(est.line_items, discount);
  const totals = quoteTotals(items, est.tax_rate);
  const menu = publicUpsells(est.upsells);
  const acceptedIds = Array.isArray(est.accepted_upsells) ? est.accepted_upsells.map(u => u && u.id) : null;
  const slug = est.business?.slug || 'tidyhaus';
  let techFirstName = null;
  if (est.technician_id) {
    const { data: tr } = await db.from('technicians').select('name').eq('id', est.technician_id).maybeSingle();
    techFirstName = tr && tr.name ? String(tr.name).split(/\s+/)[0] : null;
  }
  let known = {};
  if (!est.approved_at && est.customer_phone && !(est.customer_address && est.customer_city && est.customer_state && est.customer_zip)) {
    try {
      const p = phone10(est.customer_phone);
      if (p.length === 10) {
        const { data: cs } = await db.from('customers').select('name, phone, address_line1, city, state, postal_code, updated_at')
          .eq('business_id', est.business_id).ilike('phone', `%${p.slice(-4)}%`).order('updated_at', { ascending: false }).limit(10);
        known = (cs || []).find((c) => phone10(c.phone) === p && c.address_line1) || {};
      }
    } catch (e) { console.warn('[estimate_approve_info] customer prefill failed:', e.message); }
  }
  return res.status(200).json({
    technician_first_name: techFirstName,
    business_slug: slug,
    business_name: est.business?.name || 'TidyHaus',
    customer_name: est.customer_name || known.name || '',
    customer_phone: est.customer_phone || '',
    customer_zip: est.customer_zip || known.postal_code || '',
    customer_address: est.customer_address || known.address_line1 || '',
    customer_city: est.customer_city || known.city || '',
    customer_state: est.customer_state || known.state || '',
    stripe_pk: bookingStripePk(slug),
    service_label: est.service_label || '',
    description: est.description || '',
    customer_note: est.customer_note || '',
    line_items: items,
    tax_rate: Number(est.tax_rate) || 0,
    totals,
    upsells: menu,
    accepted_ids: acceptedIds,
    approved_total: est.approved_total != null ? Number(est.approved_total) : null,
    already_approved: !!est.approved_at,
    approved_at: est.approved_at || null,
    coupon_amount: (!est.approved_at && discount > 0) ? discount : 0,
  });
}

function upsellsAsLineItems(accepted) {
  return (Array.isArray(accepted) ? accepted : []).map(u => ({
    description: u.description, qty: u.qty, unit_price: u.unit_price,
  }));
}

async function bookEstimateAppointment(db, biz, est, combinedItems, totals, slot, cust, card) {
  if (await isScammer({ phone: cust && cust.phone, email: cust && cust.email }, db) || await isScammer({ phone: est.customer_phone, email: est.customer_email }, db)) {
    const e = new Error(SCAMMER_BOOKING_ERROR); e.scammer = true; e.status = 403; throw e;
  }
  const tz = await areaTimezone(db, null, biz.timezone || 'Asia/Manila').catch(() => biz.timezone || 'Asia/Manila');
  const bookingAreaId = (await serviceAreaIdFromPostal(db, biz.id, cust.zip))
    || (await serviceAreaIdFromPostal(db, biz.id, est.customer_zip));
  const areaTz = bookingAreaId ? await areaTimezone(db, bookingAreaId, biz.timezone || 'Asia/Manila') : tz;

  const slotDef = SLOTS.find(s => s.key === slot.slot_key);
  if (!slotDef) { const e = new Error('That time slot is no longer valid — please pick another.'); e.conflict = true; throw e; }
  const [hh, mm] = slotDef.start.split(':').map(Number);
  const midnight = localDateStartUTC(areaTz, slot.date);
  const scheduled_at = new Date(midnight.getTime() + (hh * 60 + mm) * 60000).toISOString();

  const technician_id = est.technician_id
    ? ((await techIsOpenForSlot(db, est.technician_id, slot.date, slot.slot_key, areaTz)) ? est.technician_id : null)
    : await pickAvailableTech(db, [{ bizId: biz.id, serviceAreaId: bookingAreaId, zip: est.customer_zip }], slot.date, slot.slot_key, areaTz, null, false, true);
  if (!technician_id) {
    const e = new Error("That time isn't available anymore — please pick another time.");
    e.conflict = true;
    throw e;
  }

  let customer_id = null;
  if (cust.phone) {
    const { data: rows, error } = await db.from('customers').select('id').eq('business_id', biz.id).eq('phone', cust.phone).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    if (rows?.[0]?.id) customer_id = rows[0].id;
  }
  if (!customer_id && cust.email) {
    const { data: rows, error } = await db.from('customers').select('id').eq('business_id', biz.id).eq('email', cust.email).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    if (rows?.[0]?.id) customer_id = rows[0].id;
  }
  if (!customer_id) {
    const { data, error } = await db.from('customers').insert({
      business_id: biz.id, name: capName(cust.name) || 'Customer', phone: cust.phone || null, email: cust.email || null,
      address_line1: cust.line1 || null, city: cust.city || null, state: cust.state || null, postal_code: cust.zip || null,
    }).select('id').single();
    if (error) throw error;
    customer_id = data.id;
  } else {
    const patch = {};
    if (cust.email) patch.email = cust.email;
    if (cust.name) patch.name = capName(cust.name);
    if (cust.phone) patch.phone = cust.phone;
    if (cust.line1) patch.address_line1 = cust.line1;
    if (cust.city) patch.city = cust.city;
    if (cust.state) patch.state = cust.state;
    if (cust.zip) patch.postal_code = cust.zip;
    if (Object.keys(patch).length) await db.from('customers').update(patch).eq('id', customer_id).eq('business_id', biz.id);
  }

  if ((Number(totals.total) || 0) > 0 && Number(totals.total) < MIN_TICKET_PRICE && !isDismountOnlyLines(combinedItems)) {
    const e = new Error(`This estimate totals $${Number(totals.total).toFixed(2)}, under the $${MIN_TICKET_PRICE} minimum — it cannot be booked as-is.`);
    e.conflict = true; throw e;
  }

  const bookingInsert = {
    business_id: biz.id, customer_id, technician_id,
    service_id: est.service_id || null,
    service_area_id: bookingAreaId || null,
    status: 'assigned', source: 'estimate',
    scheduled_at,
    subtotal: totals.subtotal, price: totals.total,
    notes: [est.description, (String(est.notes || '').match(/payroll\s*override\s*:?\s*\$?\s*\d+(?:\.\d{1,2})?/i) || [])[0]].filter(Boolean).join(String.fromCharCode(10, 10)) || null,
    address_line1: cust.line1 || null, city: cust.city || null, state: cust.state || null, postal_code: cust.zip || null,
    payment_required: true, payment_method: 'card',
    sms_consent: await textConsentFor(db, cust.phone),
    stripe_customer_id: card.customerId, stripe_payment_method_id: card.pmId || null,
    metadata: { booked_by: 'Estimate approval (auto-booked)', source_estimate_id: est.id },
  };
  const OPTIONAL = ['sms_consent'];
  let insertObj = { ...bookingInsert };
  let bRow, bErr;
  for (let attempt = 0; attempt < OPTIONAL.length + 1; attempt++) {
    ({ data: bRow, error: bErr } = await db.from('bookings').insert(insertObj).select('id').single());
    if (!bErr) break;
    if (bErr.code === '23505' && /bookings_tech_slot_unique/.test(bErr.message || '')) {
      const e = new Error('That technician was just booked for this exact time by someone else. Please pick another time.');
      e.conflict = true; throw e;
    }
    const missing = OPTIONAL.find(c => (bErr.message || '').includes(c) && c in insertObj);
    if (!missing) break;
    delete insertObj[missing];
  }
  if (bErr) throw bErr;

  await ensureReviewToken(db, { id: bRow.id });

  const rows = canonicalizeLineItems(combinedItems.map(it => ({
    booking_id: bRow.id, business_id: biz.id, kind: 'option', name: it.description || 'Item',
    quantity: Number(it.qty) || 1, unit_price: Number(it.unit_price) || 0,
    line_total: (Number(it.qty) || 1) * (Number(it.unit_price) || 0),
  }))).map((r, i) => ({ ...r, sort_order: i }));
  if (rows.length) {
    let { error: liErr } = await db.from('booking_line_items').insert(rows);
    if (liErr && isSortOrderErr(liErr)) {
      ({ error: liErr } = await db.from('booking_line_items').insert(rows.map(({ sort_order, ...r }) => r)));
    }
    if (liErr) console.error('[estimate_approve] line items insert failed:', liErr.message);
  }
  if (totals.tax > 0) {
    const taxRow = {
      booking_id: bRow.id, business_id: biz.id, kind: 'fee', name: 'Tax',
      quantity: 1, unit_price: totals.tax, line_total: totals.tax, taxable: false, sort_order: rows.length,
    };
    let { error: taxErr } = await db.from('booking_line_items').insert(taxRow);
    if (taxErr && isSortOrderErr(taxErr)) {
      const { sort_order, ...bare } = taxRow;
      ({ error: taxErr } = await db.from('booking_line_items').insert(bare));
    }
    if (taxErr) console.error('[estimate_approve] tax line item insert failed:', taxErr.message);
  }

  await db.from('booking_status_events').insert({
    booking_id: bRow.id, business_id: biz.id, technician_id,
    status: 'assigned', note: 'Auto-booked from estimate approval',
  });

  const { data: techInfo } = await db.from('technicians').select('name, photo_url, bio_years, bio_blurb').eq('id', technician_id).maybeSingle();
  await notifyTechAssigned(db, biz, technician_id, scheduled_at, areaTz, { bookingId: bRow.id })
    .catch(e => console.error('[tech-notify]', e.message));

  const [alertEndH, alertEndM] = slotDef.end.split(':').map(Number);
  const scheduledEnd = new Date(midnight.getTime() + (alertEndH * 60 + alertEndM) * 60000).toISOString();
  const alertLineItems = combinedItems.map(it => ({ name: it.description || 'Item', quantity: Number(it.qty) || 1, line_total: (Number(it.qty) || 1) * (Number(it.unit_price) || 0) }));
  if (totals.tax > 0) alertLineItems.push({ name: 'Tax', quantity: 1, line_total: totals.tax });
  await sendOwnerBookingAlert({
    slug: biz.slug, businessName: biz.name, timezone: areaTz,
    bookedBy: 'Customer (online approval)',
    customer: { name: cust.name, phone: cust.phone, email: cust.email },
    address: { line1: cust.line1, city: cust.city, state: cust.state, zip: cust.zip },
    scheduledAt: scheduled_at, scheduledEnd,
    technicianName: techInfo?.name || null, price: Number(totals.total) || 0,
    lineItems: alertLineItems, customerNotes: est.description || null, bookingId: bRow.id,
  });

  if (cust.phone && est.sms_consent === true) {
    const _d = new Date(scheduled_at);
    const dateStr = _d.toLocaleDateString('en-US', { timeZone: areaTz, weekday: 'short', month: 'short', day: 'numeric' });
    const msg = bookingConfirmMessage({
      bizName: biz.name, bizSlug: biz.slug,
      dateStr, timeWindow: slotDef.label, techName: techInfo?.name || null,
    });
    try {
      const _confirmResult = await sendSMSResult(cust.phone, msg);
      if (!_confirmResult.ok) {
        if (_confirmResult.error) console.error('[SMS]', _confirmResult.error);
        else console.warn(`[SMS] not sent (${_confirmResult.skipped}):`, msg);
      }
      await logAutomatedMessage(db, { businessId: biz.id, customerPhone: cust.phone, body: msg, result: _confirmResult });
    } catch (e) { console.error(e); }
  }

  if (cust.email) {
    (async () => {
      try {
        const dateLong = new Date(scheduled_at).toLocaleDateString('en-US', { timeZone: areaTz, weekday: 'long', month: 'short', day: 'numeric' });
        const timeWindow = slotDef.label;
        const startEpoch = Math.floor(new Date(scheduled_at).getTime() / 1000);
        const [sh, sm] = slotDef.start.split(':').map(Number);
        const [eh, em] = slotDef.end.split(':').map(Number);
        const endEpoch = startEpoch + ((eh * 60 + em) - (sh * 60 + sm)) * 60;
        const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
        const emailLines = combinedItems.map(it => ({ label: it.description || 'Item', qty: Number(it.qty) || 1, amount: (Number(it.qty) || 1) * (Number(it.unit_price) || 0) }));
        if (totals.tax > 0) emailLines.push({ label: 'Tax', qty: 1, amount: totals.tax });
        const { subject, html } = bookingConfirmationEmail({
          firstName: (cust.name || '').trim().split(/\s+/)[0] || '',
          dateLong, timeWindow,
          technicianName: techInfo?.name || null, technicianPhotoUrl: techInfo?.photo_url || null,
          technicianBioYears: techInfo?.bio_years || null, technicianBioBlurb: techInfo?.bio_blurb || null,
          address: { line1: cust.line1, city: cust.city, state: cust.state, zip: cust.zip },
          lines: emailLines, total: totals.total, tip: 0, twoTechs: false,
          startEpoch, endEpoch, baseUrl, jobId: bRow.id,
          gdsUpsellUrl: gdsUpsellUrlFor({
            lines: emailLines, bookingId: bRow.id, baseUrl,
            eligible: /tv/i.test(est.service_label || ''),
          }),
          rescheduleUrl: rescheduleUrlFor({ bookingId: bRow.id, baseUrl }),
        }, brandFor(biz.slug));
        const { from } = emailConfig(biz.slug);
        await sendEmail({ slug: biz.slug, to: cust.email, subject, html, replyTo: from });
      } catch (e) { console.error('[estimate_approve] confirmation email error:', e.message); }
    })();
  }

  return { bookingId: bRow.id, technicianName: techInfo?.name || null, scheduledAt: scheduled_at, tz: areaTz, slotLabel: slotDef.label };
}

async function estimateApprove(req, res, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = ((body && body.token) || req.query.token || '').toString();
  const id = approveTokenEstimateId(token);
  if (!id) return res.status(401).json({ error: 'This approval link is invalid or has expired.' });

  const db = serviceClient();
  const est = await fetchEstimateAnyBiz(db, id);
  if (!est) return res.status(404).json({ error: 'Estimate not found.' });
  const businessName = est.business?.name || 'TidyHaus';

  if (est.approved_at) {
    const acceptedIds = Array.isArray(est.accepted_upsells) ? est.accepted_upsells.map(u => u && u.id) : [];
    return res.status(200).json({
      ok: true, already: true, approved_at: est.approved_at, business_name: businessName,
      accepted: publicUpsells(est.accepted_upsells || []),
      accepted_ids: acceptedIds,
      approved_total: est.approved_total != null ? Number(est.approved_total) : null,
    });
  }

  const requested = Array.isArray(body && body.accepted_ids) ? body.accepted_ids.map(x => String(x)) : [];
  const reqSet = new Set(requested);
  const menu = Array.isArray(est.upsells) ? est.upsells : [];
  const accepted = menu.filter(u => u && reqSet.has(String(u.id)))
    .map(u => ({ id: u.id, description: u.description, qty: u.qty, unit_price: u.unit_price, tech_pay: u.tech_pay || 0 }));

  const discount = approveTokenDiscount(token);
  const baseItems = applyCouponToItems(est.line_items, discount);
  const combined = baseItems.concat(upsellsAsLineItems(accepted));
  const totals = quoteTotals(combined, est.tax_rate);

  const addr = (body && body.address) || {};
  const line1 = String(addr.line1 || '').trim();
  const city = String(addr.city || '').trim();
  const stateAbbr = String(addr.state || '').trim();
  const zip = String(addr.zip || est.customer_zip || '').trim();
  const pmId = String((body && body.payment_method_id) || '').trim();
  const custName = capName(String((body && body.customer_name) || est.customer_name || '').trim());
  const custPhone = String((body && body.customer_phone) || est.customer_phone || '').trim();
  const custEmail = est.customer_email || null;
  if (!custName || /@/.test(custName) || !/[a-z]{2}/i.test(custName)) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!line1 || !city || !stateAbbr || !zip) {
    return res.status(400).json({ error: 'Please enter your full service address (street, city, state, ZIP) to approve.' });
  }
  if (!pmId) {
    return res.status(400).json({ error: 'Please add a card to hold on file to approve.' });
  }
  const prefSlots = sanitizePreferredSlots(body && body.selected_slots);
  const chosenSlot = prefSlots[0] || null;
  if (!chosenSlot) {
    return res.status(400).json({ error: 'Please pick an appointment time to approve.' });
  }
  if (await isScammer({ phone: custPhone, email: custEmail }, db) || await isScammer({ phone: est.customer_phone, email: est.customer_email }, db)) {
    return res.status(400).json({ error: 'We could not complete this booking online. Please call us.' });
  }
  let card = null;
  try {
    card = await saveCardOnFile(pmId, { name: custName, email: custEmail, phone: custPhone }, est.business?.slug || null);
  } catch (e) {
    return res.status(402).json({ error: `We couldn't save that card: ${e.message}. Please check the number and try again.` });
  }
  if (!card || !card.customerId) {
    return res.status(402).json({ error: 'Card entry is not set up for this business yet — please contact us to book.' });
  }

  let booking;
  try {
    booking = await bookEstimateAppointment(
      db, est.business, est, combined, totals, chosenSlot,
      { name: custName, phone: custPhone, email: custEmail, line1, city, state: stateAbbr, zip },
      card
    );
  } catch (e) {
    if (e.scammer) return res.status(400).json({ error: 'We could not complete this booking online. Please call us.' });
    const secretaryPhone = secretaryPhoneFor(est.business?.slug);
    if (secretaryPhone) {
      const reason = e.conflict ? 'their picked time was just taken' : `a booking error (${e.message || 'unknown'})`;
      const slotLabel = chosenSlot ? `${chosenSlot.date || ''} ${chosenSlot.slot_key || ''}`.trim() : 'an unspecified time';
      const msg = `⚠ ${businessName}: ${custName || 'A customer'} (${custPhone || 'no phone on file'}) tried to approve estimate #${est.id} for ${slotLabel} but it failed — ${reason}. They were told someone would reach out. Please call them to finish booking.`;
      sendSMS(secretaryPhone, msg).catch(err => console.warn('[estimate_approve] secretary alert SMS failed:', err));
    } else {
      console.warn(`[estimate_approve] no secretary phone configured for ${est.business?.slug || 'this business'} — failed approval attempt went unnotified:`, est.id, e.message);
    }
    if (e.conflict) return res.status(409).json({ error: e.message, conflict: true });
    console.error('[estimate_approve] auto-book failed:', e.message);
    return res.status(500).json({ error: "We couldn't book your appointment automatically — we've been notified and someone will reach out to finish scheduling you." });
  }

  const now = new Date().toISOString();
  const patch = {
    approved_at: now, accepted_upsells: accepted, approved_total: totals.total,
    customer_name: custName || est.customer_name, customer_phone: custPhone || est.customer_phone,
    customer_address: line1, customer_city: city, customer_state: stateAbbr, customer_zip: zip,
    stripe_customer_id: card.customerId, card_brand: card.brand, card_last4: card.last4,
    preferred_slots: [chosenSlot],
    status: booking && booking.bookingId ? 'booked' : 'approved',
    ...(booking && booking.bookingId ? { booked_booking_id: booking.bookingId, booked_at: now } : {}),
  };
  if (discount > 0) patch.notes = [est.notes, `$${discount} follow-up coupon applied at approval (${now}).`].filter(Boolean).join('\n').slice(0, 2000);
  let error;
  for (let i = 0; i < 4; i++) {
    ({ error } = await db.from('estimates').update(patch).eq('id', est.id));
    if (!error) break;
    const col = missingColumn(error.message);
    if (col === 'approved_at') {
      return res.status(503).json({ error: 'Approvals need a quick database update (migration 0030) before they can be recorded.' });
    }
    if (col && (col in patch)) { console.warn(`[estimate_approve] '${col}' column missing, retrying without it`); delete patch[col]; continue; }
    break;
  }
  if (error) throw error;

  return res.status(200).json({
    ok: true, approved_at: now, business_name: businessName,
    accepted: publicUpsells(accepted),
    accepted_ids: accepted.map(u => u.id),
    approved_total: totals.total,
    booking_id: booking.bookingId,
    scheduled_at: booking.scheduledAt,
    slot_label: booking.slotLabel,
    technician_name: booking.technicianName,
    timezone: booking.tz,
  });
}

async function emailQuota(req, res, auth) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const db = serviceClient();

  let business;
  if (auth.scope === 'all') {
    const slug = (req.query.business || '').toString();
    if (!slug) return res.status(400).json({ error: 'business parameter required for owner' });
    const { data: biz, error } = await db.from('businesses').select('id, slug').eq('slug', slug).eq('active', true).maybeSingle();
    if (error || !biz) return res.status(404).json({ error: 'Business not found' });
    business = biz;
  } else {
    const { data: biz, error } = await db.from('businesses').select('id, slug').eq('slug', auth.scope).eq('active', true).maybeSingle();
    if (error || !biz) return res.status(404).json({ error: 'Business not found' });
    business = biz;
  }

  const { apiKey } = emailConfig(business.slug);
  if (!apiKey) {
    return res.status(200).json({ quotaAvailable: null, warning: null });
  }

  try {
    const resendRes = await fetch('https://api.resend.com/account', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resendRes.ok) {
      console.warn(`[email_quota] Resend API error ${resendRes.status} for ${business.slug}`);
      return res.status(200).json({ quotaAvailable: null, warning: null });
    }

    const accountData = await resendRes.json();
    const monthlyQuota = accountData.monthly_quota || 3000;
    const dailyQuota = accountData.daily_quota || 100;
    const monthlyUsed = accountData.monthly_sent || 0;
    const dailyUsed = accountData.daily_sent || 0;

    const monthlyPercent = (monthlyUsed / monthlyQuota) * 100;
    const dailyPercent = (dailyUsed / dailyQuota) * 100;

    let warning = null;
    if (monthlyPercent >= 90) {
      warning = `⚠️ Email quota approaching limit: ${monthlyUsed}/${monthlyQuota} this month (${Math.round(monthlyPercent)}%)`;
    } else if (dailyPercent >= 90) {
      warning = `⚠️ Email quota approaching limit: ${dailyUsed}/${dailyQuota} today (${Math.round(dailyPercent)}%)`;
    }

    return res.status(200).json({
      quotaAvailable: true,
      monthlyQuota,
      monthlyUsed,
      monthlyPercent,
      dailyQuota,
      dailyUsed,
      dailyPercent,
      warning
    });
  } catch (err) {
    console.error('[email_quota]', err);
    return res.status(200).json({ quotaAvailable: null, warning: null });
  }
}

async function computeBizPayroll(db, biz, parsedWeek, weekEnd) {
  const { data: techs, error: techErr } = await db.from('technicians')
    .select('id, name').eq('business_id', biz.id).eq('active', true).order('name');
  if (techErr) throw techErr;

  const { data: jobs, error: jobErr } = await db.from('bookings')
    .select(`
      id, scheduled_at, created_at, status, subtotal, price, payment_status, amount_paid, payment_method,
      tip, notes, customer_notes, zenbooker_job_number, postal_code, service_area_id,
      technician_id, secondary_technician_id, metadata,
      customers(name), services(name),
      line_items:booking_line_items(kind, name, quantity, unit_price, line_total)
    `)
    .eq('business_id', biz.id)
    .eq('status', 'completed')
    .gte('scheduled_at', parsedWeek + 'T00:00:00Z')
    .lte('scheduled_at', weekEnd + 'T23:59:59Z')
    .order('scheduled_at');
  if (jobErr) throw jobErr;

  const travelPayoutByZip = await travelPayoutMap(db, biz.id);

  const jobTechs = {};
  for (const b of jobs || []) {
    jobTechs[b.id] = [];
    if (b.technician_id) jobTechs[b.id].push(b.technician_id);
    if (b.secondary_technician_id) jobTechs[b.id].push(b.secondary_technician_id);
  }

  const techPayroll = {};
  for (const tech of techs || []) {
    techPayroll[tech.id] = { name: tech.name, jobs: [], deferred: [], total: 0 };
  }

  const allTechIds = new Set(Object.values(jobTechs).flat());
  const missingTechIds = [...allTechIds].filter(id => !techPayroll[id]);
  if (missingTechIds.length) {
    const { data: crossTechs, error: crossErr } = await db.from('technicians')
      .select('id, name').in('id', missingTechIds);
    if (crossErr) throw crossErr;
    for (const tech of crossTechs || []) {
      techPayroll[tech.id] = { name: tech.name, jobs: [], deferred: [], total: 0 };
    }
  }

  for (const b of jobs || []) {
    const techList = jobTechs[b.id] || [];
    const isHouston = await isHoustonBooking(db, biz.id, biz.slug, b.service_area_id);
    for (const techId of techList) {
      if (!techPayroll[techId]) continue;

      let result = computeJobPay({
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
        business_slug: biz.slug,
        line_items: b.line_items || [],
        scheduled_at: b.scheduled_at,
        created_at: b.created_at,
        travel_payout: travelPayoutByZip.get(String(b.postal_code || '')) || 0,
        second_tech: (jobTechs[b.id] || []).length > 1,
        is_secondary: techId === b.secondary_technician_id && techId !== b.technician_id,
        is_houston: isHouston,
      }, techPayroll[techId].name);

      const jobBase = {
        id: b.id,
        customer_name: b.customers?.name || 'Unknown',
        service: b.services?.name || 'Service',
        time: new Date(b.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        scheduled_at: b.scheduled_at,
        business_name: biz.name,
        business_slug: biz.slug,
      };

      if (result.state === 'deferred') {
        techPayroll[techId].deferred.push({ ...jobBase, customer_due: Math.floor((Number(b.price) || 0) - (Number(b.amount_paid) || 0)) });
      } else if (result.state !== 'excluded') {
        const collected = (b.payment_method === 'cash' && techId === b.technician_id)
          ? Math.round(Number(b.amount_paid) || Number(b.price) || 0)
          : 0;
        const breakdown = [...(result.breakdown || [])];
        if (collected > 0) breakdown.push({ label: `Cash collected from customer (kept by cleaner)`, amount: -collected });
        const tipShare = Number(result.tip) || 0;
        const ovr = b.metadata?.tech_pay_override?.[techId];
        if (ovr != null && Number.isFinite(Number(ovr))) {
          breakdown.length = 0;
          breakdown.push({ label: 'Pay set by owner', amount: Number(ovr) });
          result = { ...result, pay: Number(ovr), total: Number(ovr) + tipShare };
        }
        const tvAdj = TECH_TV_BASE_ADJ[techId];
        if (tvAdj && ovr == null) {
          let cut = 0, tvs = 0;
          for (const x of breakdown.filter(x => /^TV base/i.test(x.label || ''))) {
            const q = Number((String(x.label).match(/×\s*(\d+)/) || [])[1]) || 1;
            const sz = /98/.test(x.label) ? '98' : /8[56]/.test(x.label) ? '85' : 'default';
            cut += (tvAdj[sz] ?? tvAdj.default) * q; tvs += q;
          }
          if (cut) { breakdown.push({ label: `New cleaner rate (${tvs} TV${tvs === 1 ? '' : 's'})`, amount: cut }); result = { ...result, pay: result.pay + cut, total: result.total + cut }; }
        }
        const netPay = result.total - collected;
        techPayroll[techId].jobs.push({
          ...jobBase,
          tech_pay: netPay,
          labor_pay: Math.round((result.pay - collected) * 100) / 100,
          tip: tipShare,
          cash_collected: collected || undefined,
          breakdown,
          flags: result.flags,
          needs_review: result.flags.length > 0 || result.state === 'partial',
        });
        techPayroll[techId].total += netPay;
        techPayroll[techId].tip_total = (techPayroll[techId].tip_total || 0) + tipShare;
      }
    }
  }

  try {
    const { data: bonuses } = await db.from('tech_review_bonus')
      .select('technician_id, amount, completed_at, technician:technicians!technician_id(name, business_id)')
      .gte('completed_at', parsedWeek + 'T00:00:00Z')
      .lt('completed_at', addDaysStr(weekEnd, 1) + 'T00:00:00Z');
    for (const bns of bonuses || []) {
      if (bns.technician?.business_id !== biz.id) continue;
      const tId = bns.technician_id;
      if (!techPayroll[tId]) techPayroll[tId] = { name: bns.technician?.name || 'Cleaner', jobs: [], deferred: [], total: 0 };
      const amt = Math.round(Number(bns.amount) || 0);
      techPayroll[tId].jobs.push({
        id: `review-bonus-${tId}`,
        bonus: true,
        customer_name: 'Review bonus',
        service: 'All 5 Google listings reviewed',
        time: '',
        scheduled_at: bns.completed_at,
        business_name: biz.name,
        business_slug: biz.slug,
        tech_pay: amt,
        breakdown: [{ label: 'Review bonus, all 5 Google listings', amount: amt }],
        flags: [],
        needs_review: false,
      });
      techPayroll[tId].total += amt;
    }
  } catch (e) { console.warn('[payroll] review bonus lookup failed:', e.message); }

  const partsCorrections=await partsCorrectionsFor(db,parsedWeek,{businessId:biz.id});

  try {
    const { data: bonuses, error: bonusError } = await db.from('tech_bonuses')
      .select('id, technician_id, amount, reason, message, awarded_on, photo_url, technician:technicians!technician_id(name, business_id)')
      .gte('awarded_on', parsedWeek).lte('awarded_on', weekEnd);
    if(bonusError) throw bonusError;
    for (const bns of bonuses || []) {
      if (bns.technician?.business_id !== biz.id) continue;
      const amt = partsMoney(Number(bns.amount) || 0);
      if (!amt) continue;
      const detail=partsAdjustmentDetail(partsCorrections,bns,parsedWeek);
      if(amt<0 && String(bns.message||'').startsWith('Parts reimbursement correction') && !detail) continue;
      const tId = bns.technician_id;
      if (!techPayroll[tId]) techPayroll[tId] = { name: bns.technician?.name || 'Cleaner', jobs: [], deferred: [], total: 0 };
      techPayroll[tId].jobs.push({
        id: `bonus-${bns.id}`,
        bonus: true,
        photo_url: bns.photo_url || null,
        customer_name: bns.reason || 'Bonus',
        service: amt<0?'Payroll adjustment':'Bonus',
        adjustment:amt<0,
        ...(detail||{}),
        time: '',
        scheduled_at: bns.awarded_on,
        business_name: biz.name,
        business_slug: biz.slug,
        tech_pay: amt,
        breakdown: [{ label: amt<0?(detail?.message||bns.message||bns.reason):(bns.reason||'Bonus'), amount: amt }],
        flags: [],
        needs_review: false,
      });
      techPayroll[tId].total += amt;
    }
  } catch (e) { if(partsCorrections.length) throw e; console.warn('[payroll] tech bonus lookup failed:', e.message); }

  return Object.entries(techPayroll)
    .map(([id, t]) => ({ ...t, _id: id, total:partsMoney(t.total), tip_total:partsMoney(t.tip_total || 0), labor_total:partsMoney(t.total - (t.tip_total || 0)), paid_snapshot:partsPaymentSnapshot(partsCorrections,id,parsedWeek) }))
    .filter(t => t.jobs.length > 0 || t.deferred.length > 0);
}

function leadGenMap(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) { const n = Number(v); if (Number.isFinite(n)) out[k] = n; }
  }
  return out;
}
function leadGenSum(map) {
  return Math.round(Object.values(map).reduce((s, n) => s + n, 0) * 100) / 100;
}

const LEGACY_PAYOUT_COL = { doms: 'doms_stripe_payout', 'tidyhaus': 'tidyhaus_stripe_payout' };
async function actualProfitFor(db, payDate, weekStart, weekEnd) {
  let { data: profitRow, error: rowErr } = await db.from('actual_profit_weekly')
    .select('doms_stripe_payout, tidyhaus_stripe_payout, tech_pay, lead_gen_payouts, payouts_by_business').eq('pay_date', payDate).maybeSingle();
  if (rowErr && /payouts_by_business/.test(rowErr.message || '')) {
    ({ data: profitRow } = await db.from('actual_profit_weekly')
      .select('doms_stripe_payout, tidyhaus_stripe_payout, tech_pay, lead_gen_payouts').eq('pay_date', payDate).maybeSingle());
  }
  const domsStripe = profitRow?.doms_stripe_payout != null ? Number(profitRow.doms_stripe_payout) : null;
  const haStripe = profitRow?.tidyhaus_stripe_payout != null ? Number(profitRow.tidyhaus_stripe_payout) : null;
  const techPay = profitRow?.tech_pay != null ? Number(profitRow.tech_pay) : null;
  const payouts = leadGenMap(profitRow?.payouts_by_business);
  if (domsStripe != null && payouts.doms == null) payouts.doms = domsStripe;
  if (haStripe != null && payouts['tidyhaus'] == null) payouts['tidyhaus'] = haStripe;
  const stripeTotal = leadGenSum(payouts);
  const leadGen = leadGenMap(profitRow?.lead_gen_payouts);
  const leadGenTotal = leadGenSum(leadGen);

  let withJobs = [];
  if (weekStart && weekEnd) {
    try {
      const { data: rows, error } = await db.from('bookings')
        .select('business_id, status, business:businesses!inner(slug, name)')
        .neq('status', 'cancelled')
        .gte('scheduled_at', weekStart + 'T00:00:00Z')
        .lte('scheduled_at', weekEnd + 'T23:59:59Z');
      if (error) throw error;
      const seen = new Map();
      for (const r of rows || []) {
        const slug = r.business?.slug; if (!slug) continue;
        const e = seen.get(slug) || { slug, name: r.business?.name || slug, jobs: 0 };
        e.jobs++; seen.set(slug, e);
      }
      withJobs = [...seen.values()].sort((x, y) => y.jobs - x.jobs || x.name.localeCompare(y.name));
    } catch (e) { console.warn('[payroll] businesses-with-jobs lookup failed:', e.message); }
  }
  const required = withJobs.length ? withJobs.map(b => b.slug) : ['doms', 'tidyhaus'];
  const ready = techPay != null && required.every(sl => payouts[sl] != null);
  return {
    doms_stripe_payout: domsStripe,
    tidyhaus_stripe_payout: haStripe,
    payouts_by_business: payouts,
    stripe_total: stripeTotal,
    businesses_with_jobs: withJobs,
    tech_pay: techPay,
    lead_gen_payouts: leadGen,
    lead_gen_total: leadGenTotal,
    total_made: ready ? Math.round((stripeTotal + leadGenTotal - techPay) * 100) / 100 : null,
  };
}

const PAYROLL_LAST_NAME = {
  'TK': 'Adeshewo', 'Juan': 'Beltran', 'Zach': 'Benaya', 'Kregg': 'Buesig',
  'Steve': 'Burns', 'Gregory': 'Gadlin', 'Heather': 'Gonzalez',
};
const PAYROLL_ORDER = [];
function sortForPayroll(data) {
  const rank = (n) => { const first = String(n || '').split(/\s+/)[0].toLowerCase(); const i = PAYROLL_ORDER.findIndex(x => x.toLowerCase() === first); return i < 0 ? 999 : i; };
  const key = n => PAYROLL_LAST_NAME[n] || n;
  return [...data].sort((a, b) => rank(a.name) - rank(b.name) || String(key(a.name)).localeCompare(String(key(b.name))));
}

async function secretaryWorkDaysInWeek(db, bizSlug, weekStart) {
  const { data: biz } = await db.from('businesses').select('id').eq('slug', bizSlug).maybeSingle();
  if (!biz) return 0;
  const { data: pattern } = await db.from('secretary_availability')
    .select('day_of_week, is_available').eq('business_id', biz.id);
  const weekEnd = addDaysStr(weekStart, 6);
  const { data: exceptions } = await db.from('secretary_availability_exceptions')
    .select('exception_date, is_available').eq('business_id', biz.id)
    .gte('exception_date', weekStart).lte('exception_date', weekEnd);
  const patternByDow = new Map((pattern || []).map(p => [p.day_of_week, p.is_available]));
  const excByDate = new Map((exceptions || []).map(e => [e.exception_date, e.is_available]));
  let workDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDaysStr(weekStart, i);
    const dow = dayOfWeekFor(d);
    const avail = excByDate.has(d) ? excByDate.get(d) : (patternByDow.get(dow) ?? false);
    if (avail) workDays++;
  }
  return workDays;
}
const SECRETARY_RATE = {
  'tidyhaus': { daily: 95, currency: 'USD' },
};
const PHP_PER_USD = 56.5;
function phpToUsd(php) { return Math.round((Number(php) || 0) / PHP_PER_USD * 100) / 100; }

async function officePayRows(db, weekStart) {
  const { data: row } = await db.from('office_pay_weekly').select('heather_pay, joey_pay, php_rate').eq('week_start', weekStart).maybeSingle();
  const effectiveRate = Number(row?.php_rate) > 0 ? Number(row.php_rate) : PHP_PER_USD;
  const mk = async (name, slug, saved) => {
    const currency = SECRETARY_RATE[slug].currency;
    const usdEq = (total) => currency === 'PHP' ? Math.round((Number(total) || 0) / effectiveRate * 100) / 100 : null;
    const rb = currency === 'PHP' ? await reviewBonusLines(db, name, weekStart) : [];
    const rbTotal = rb.length * REVIEW_BONUS_PHP;
    if (saved != null) {
      const total = Number(saved) + rbTotal;
      return { name, jobs: [], deferred: [], total, is_office: true, is_suggested: false, additions: rb, review_bonus_total: rbTotal, currency, usd_equivalent: usdEq(total), fx_rate: currency === 'PHP' ? effectiveRate : null };
    }
    const workDays = await secretaryWorkDaysInWeek(db, slug, weekStart);
    const total = workDays * SECRETARY_RATE[slug].daily + rbTotal;
    return { name, jobs: [], deferred: [], total, is_office: true, is_suggested: true, work_days: workDays, additions: rb, review_bonus_total: rbTotal, currency, usd_equivalent: usdEq(total), fx_rate: currency === 'PHP' ? effectiveRate : null };
  };
  const team = async (name) => {
    const { data: days, error } = await db.from('staff_schedules').select('day_of_week').eq('name', name);
    if (error) throw error;
    const set = new Set((days || []).map(d => d.day_of_week));
    let workDays = 0;
    for (let i = 0; i < 7; i++) { const d = addDaysStr(weekStart, i); if (d >= STAFF_PAY_FROM && set.has(dayOfWeekFor(d))) workDays++; }
    const wkEnd = addDaysStr(weekStart, 6);
    const { data: offs } = await db.from('staff_schedule_exceptions').select('on_date, reason').eq('name', name).is('business_slug', null).gte('on_date', weekStart).lte('on_date', wkEnd);
    const offDays = (offs || []).filter(o => o.on_date >= STAFF_PAY_FROM && set.has(dayOfWeekFor(o.on_date)));
    workDays -= offDays.length;
    const { data: ons } = await db.from('staff_schedule_exceptions').select('on_date').eq('name', name).not('business_slug', 'is', null).gte('on_date', weekStart).lte('on_date', wkEnd);
    const onDays = (ons || []).filter(o => o.on_date >= STAFF_PAY_FROM && !set.has(dayOfWeekFor(o.on_date)));
    let additions = [];
    if (onDays.length) {
      const { data: others } = await db.from('staff_schedule_exceptions').select('name, on_date').is('business_slug', null).neq('name', name).in('on_date', onDays.map(o => o.on_date));
      additions = onDays.map(o => {
        const who = (others || []).find(x => x.on_date === o.on_date)?.name;
        const [, m, dd] = o.on_date.split('-');
        return { date: o.on_date, label: `Covered ${who ? who + ' ' : ''}${Number(m)}/${Number(dd)}`, amount: STAFF_DAY_RATE_PHP };
      });
    }
    workDays += additions.length;
    const rb = await reviewBonusLines(db, name, weekStart);
    additions = additions.concat(rb);
    const total = workDays * STAFF_DAY_RATE_PHP + rb.length * REVIEW_BONUS_PHP;
    return { name, jobs: [], deferred: [], total, is_office: true, is_suggested: true, read_only: true, work_days: workDays, deductions: offDays.map(o => ({ date: o.on_date, label: o.reason, amount: -STAFF_DAY_RATE_PHP })), additions, review_bonus_total: rb.length * REVIEW_BONUS_PHP, daily_rate: STAFF_DAY_RATE_PHP, currency: 'PHP', usd_equivalent: Math.round(total / effectiveRate * 100) / 100, fx_rate: effectiveRate };
  };
  const joeyUsd = async () => {
    if (row?.joey_pay != null) return mk('Joey', 'doms', row.joey_pay);
    const rb = await reviewBonusLines(db, 'Joey', weekStart);
    const rbUsd = Math.round(rb.length * REVIEW_BONUS_PHP / effectiveRate * 100) / 100;
    const workDays = await secretaryWorkDaysInWeek(db, 'doms', weekStart);
    const total = Math.round((workDays * JOEY_WEEKLY_USD / 7 + rbUsd) * 100) / 100;
    return { name: 'Joey', jobs: [], deferred: [], total, work_days: workDays, is_office: true, is_suggested: true, read_only: true,
      additions: rb.map(x => ({ ...x, amount: Math.round(REVIEW_BONUS_PHP / effectiveRate * 100) / 100 })), review_bonus_total: rbUsd, currency: 'USD', usd_equivalent: null };
  };
  return Promise.all([
    mk('Heather', 'tidyhaus', row?.heather_pay),
    weekStart >= JOEY_USD_FROM ? joeyUsd() : mk('Joey', 'doms', row?.joey_pay),
    team('Alex'),
    team('Joe'),
    ...(weekStart >= JIYAH_PAY_FROM ? [{ name: 'Jiyah', jobs: [], deferred: [], total: JIYAH_WEEKLY_USD, is_office: true, is_suggested: false, read_only: true, currency: 'USD', usd_equivalent: null, flat_week: true }] : []),
  ]);
}
const STAFF_DAY_RATE_PHP = 2000;
const JOEY_WEEKLY_USD = 227;
const INVENTORY_SHOW_UNCOUNTED = new Set(['7b245baf-e384-407d-aa0d-7f648a54d03f']);
const TECH_TV_BASE_ADJ = { '7b245baf-e384-407d-aa0d-7f648a54d03f': { default: -10, '85': -30, '98': -20 } };
const JIYAH_WEEKLY_USD = 200;
const JIYAH_PAY_FROM = '2026-10-18';
const JOEY_USD_FROM = '2026-10-25';
const REVIEW_BONUS_PHP = 500;
const REVIEW_BONUS_FROM = '2026-10-14T15:00:00Z';
async function reviewBonusUnseen(req, res, db, auth) {
  const name = auth.role === 'secretary' ? String(auth.name || '') : '';
  if (!name) return res.status(200).json({ bonuses: [] });
  const { data, error } = await db.from('bookings')
    .select('id, review_call_at, reviewed_at, customer:customers ( name )')
    .eq('review_call_status', 'promised_review').eq('review_call_by', name).eq('review_rating', 5)
    .gte('reviewed_at', REVIEW_BONUS_FROM).order('reviewed_at', { ascending: true }).limit(50);
  if (error) throw error;
  const ok = (data || []).filter(b => { const c = Date.parse(b.review_call_at), v = Date.parse(b.reviewed_at); return c && v && v >= c - 3600000 && v <= c + 7 * 86400000; });
  if (!ok.length) return res.status(200).json({ bonuses: [] });
  const { data: seen } = await db.from('review_bonus_seen').select('booking_id').eq('name', name).in('booking_id', ok.map(b => b.id));
  const s = new Set((seen || []).map(r => r.booking_id));
  return res.status(200).json({ bonuses: ok.filter(b => !s.has(b.id)).map(b => ({ id: b.id, customer: b.customer?.name || 'A customer', amount: REVIEW_BONUS_PHP })) });
}
async function reviewBonusAck(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'secretary' || !body.id) return res.status(400).json({ error: 'Bad request' });
  const { error } = await db.from('review_bonus_seen').upsert({ booking_id: body.id, name: String(auth.name || '') }, { onConflict: 'booking_id,name' });
  if (error) throw error;
  return res.status(200).json({ ok: true });
}
async function reviewBonusLines(db, name, weekStart) {
  const wkEndNext = addDaysStr(weekStart, 7);
  const { data, error } = await db.from('bookings')
    .select('id, review_call_at, reviewed_at, review_rating, customer:customers ( name )')
    .eq('review_call_status', 'promised_review').eq('review_call_by', name).eq('review_rating', 5)
    .gte('reviewed_at', weekStart < REVIEW_BONUS_FROM ? REVIEW_BONUS_FROM : weekStart).lt('reviewed_at', wkEndNext);
  if (error) throw error;
  return (data || []).filter(b => {
    const c = Date.parse(b.review_call_at), v = Date.parse(b.reviewed_at);
    return c && v && v >= c - 3600000 && v <= c + 7 * 86400000;
  }).map(b => {
    const d = String(b.reviewed_at).slice(0, 10); const [, m, dd] = d.split('-');
    return { date: d, label: `5-star review: ${b.customer?.name || 'customer'} ${Number(m)}/${Number(dd)}`, amount: REVIEW_BONUS_PHP, review_bonus: true };
  });
}
const STAFF_PAY_FROM = '2026-10-02';

async function officePayRateSave(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { week_start, php_rate } = req.body || {};
  if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return res.status(400).json({ error: 'week_start (YYYY-MM-DD) required' });
  if (php_rate == null || isNaN(Number(php_rate)) || Number(php_rate) <= 0) return res.status(400).json({ error: 'php_rate must be a positive number' });

  const { data: existing } = await db.from('office_pay_weekly').select('heather_pay, joey_pay').eq('week_start', week_start).maybeSingle();
  const row = {
    week_start,
    heather_pay: existing?.heather_pay ?? null,
    joey_pay: existing?.joey_pay ?? null,
    php_rate: Number(php_rate),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('office_pay_weekly').upsert(row, { onConflict: 'week_start' });
  if (error) throw error;
  return res.status(200).json({ ok: true, week_start, php_rate: Number(php_rate) });
}

async function officePaySave(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { week_start, field, amount, clear } = req.body || {};
  const validFields = ['heather_pay', 'joey_pay'];
  if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return res.status(400).json({ error: 'week_start (YYYY-MM-DD) required' });
  if (!validFields.includes(field)) return res.status(400).json({ error: `field must be one of ${validFields.join(', ')}` });
  if (!clear && (amount == null || isNaN(Number(amount)))) return res.status(400).json({ error: 'amount required' });

  const { data: existing } = await db.from('office_pay_weekly').select('heather_pay, joey_pay').eq('week_start', week_start).maybeSingle();
  const row = {
    week_start,
    heather_pay: existing?.heather_pay ?? null,
    joey_pay: existing?.joey_pay ?? null,
    [field]: clear ? null : Number(amount),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('office_pay_weekly').upsert(row, { onConflict: 'week_start' });
  if (error) throw error;
  return res.status(200).json({ ok: true, week_start, field, amount: clear ? null : Number(amount) });
}


async function payrollParts(req, res, db, auth, body, action) {
  if (auth.role !== 'owner') return res.status(403).json({error:'Owner only'});
  const write=action!=='payroll_parts_preview';
  if ((write && req.method!=='POST') || (!write && req.method!=='GET')) return res.status(405).json({error:'Method not allowed'});
  const input=write?body:req.query;
  let biz; try { biz=await resolveBusiness(db,auth,input.business); } catch(e) { return bail(res,e); }
  const {data:b,error}=await db.from('bookings').select('id,business_id,scheduled_at,status,notes,metadata,payment_method,technician_id,secondary_technician_id,customer:customers(name)').eq('id',input.id).eq('business_id',biz.id).maybeSingle();
  if(error) throw error;
  if(!b) return res.status(404).json({error:'Booking not found'});
  if(action==='payroll_parts_settle') return res.status(200).json(await settlePartsAdjustment(db,b,input.adjustment_id));
  if(b.status!=='completed'||!b.technician_id||!b.secondary_technician_id||b.technician_id===b.secondary_technician_id) return res.status(400).json({error:'Select a completed job with two different assigned technicians.'});
  if(b.payment_method==='cash') return res.status(400).json({error:'Cash jobs need a separate cash reconciliation before correcting parts reimbursement.'});
  const sourceWeek=payrollSunday(String(b.scheduled_at).slice(0,10));
  const weekEnd=addDaysStr(sourceWeek,6), nextWeek=addDaysStr(sourceWeek,7);
  const {data:techRows,error:techErr}=await db.from('technicians').select('id,name,business_id').in('id',[b.technician_id,b.secondary_technician_id]);
  if(techErr) throw techErr;
  if(techRows.length!==2||techRows.some(t=>t.business_id!==biz.id)) return res.status(400).json({error:'Cross-company payroll corrections need separate payment records.'});
  const prior=b.metadata?.payroll_parts;
  if(prior && !write) return res.status(200).json({existing:prior});
  const source=prior?null:await computeBizPayroll(db,biz,sourceWeek,weekEnd);
  const techs=[b.technician_id,b.secondary_technician_id].map(id=>{
    const t=techRows.find(x=>x.id===id), pay=source?.find(x=>x._id===id);
    const saved=prior?.techs.find(x=>x.id===id);
    const job=pay?.jobs.find(x=>x.id===b.id);
    return {...t,job_pay:saved?.original_job_pay??job?.tech_pay,weekly_total:saved?.paid_week_total??pay?.total};
  });
  if(techs.some(t=>!Number.isFinite(t.job_pay))) return res.status(400).json({error:'The original job pay could not be verified.'});
  const preview={id:b.id,source_week:sourceWeek,next_week:nextWeek,customer_name:b.customer?.name||'Customer',job_date:String(b.scheduled_at).slice(0,10),techs};
  if(!write) return res.status(200).json(preview);
  const plan=makePartsPlan(preview,input,adminAuthorName(auth));
  const result=await savePartsCorrection(db,b,plan);
  return res.status(200).json({ok:true,correction:result});
}

async function payroll(req, res, db, auth) {
  if (auth.role !== 'owner') {
    return res.status(403).json({ error: 'Owner only' });
  }

  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }

  const weekStart = (req.query.week_start || '').toString();
  const rawWeek = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStart : startOfWeekUTC(biz.timezone || 'Asia/Manila').toISOString().split('T')[0];
  const parsedWeek = addDaysStr(rawWeek, -dayOfWeekFor(rawWeek));
  const weekEnd = addDaysStr(parsedWeek, 6);

  const data = await computeBizPayroll(db, biz, parsedWeek, weekEnd);
  const payDate = addDaysStr(weekEnd, PAY_DATE_OFFSET_DAYS);

  const officeRows = (await officePayRows(db, parsedWeek))
    .filter(r => (biz.slug === 'tidyhaus' && r.name === 'Heather') || (biz.slug === 'doms' && ['Joey', 'Alex', 'Joe'].includes(r.name)));
  const officeNames = officeRows.map(r => r.name);
  const commRows = await prospectCommissionRows(db, parsedWeek, weekEnd, officeNames);
  const allRows = sortForPayroll([...data, ...officeRows, ...commRows]);

  return res.status(200).json({
    week_start: parsedWeek,
    week_end: weekEnd,
    pay_date: payDate,
    techs: allRows,
    total: allRows.filter(t => (t.currency || 'USD') === 'USD').reduce((sum, t) => sum + t.total, 0),
    actual_profit: await actualProfitFor(db, payDate, parsedWeek, weekEnd),
  });
}

async function payrollCombined(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });

  const weekStart = (req.query.week_start || '').toString();
  const rawWeek = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStart : startOfWeekUTC('Asia/Manila').toISOString().split('T')[0];
  const parsedWeek = addDaysStr(rawWeek, -dayOfWeekFor(rawWeek));
  const weekEnd = addDaysStr(parsedWeek, 6);

  const { data: doneRows, error: doneErr } = await db.from('bookings')
    .select('business_id').eq('status', 'completed')
    .gte('scheduled_at', parsedWeek + 'T00:00:00Z').lte('scheduled_at', weekEnd + 'T23:59:59Z');
  if (doneErr) throw doneErr;
  const doneBizIds = [...new Set((doneRows || []).map(r => r.business_id).filter(Boolean))];
  let bizQ = db.from('businesses').select('id, slug, name, timezone');
  bizQ = doneBizIds.length ? bizQ.or(`slug.in.(tidyhaus,doms),id.in.(${doneBizIds.join(',')})`) : bizQ.in('slug', ['tidyhaus', 'doms']);
  const { data: bizRows, error: bizErr } = await bizQ;
  if (bizErr) throw bizErr;

  const perBiz = await Promise.all((bizRows || []).map(biz => computeBizPayroll(db, biz, parsedWeek, weekEnd)));

  const merged = new Map();
  for (const bizTechs of perBiz) {
    for (const t of bizTechs) {
      if (!merged.has(t._id)) merged.set(t._id, { name: t.name, jobs: [], deferred: [], total: 0, labor_total: 0, tip_total: 0 });
      const m = merged.get(t._id);
      m.jobs.push(...t.jobs);
      m.deferred.push(...t.deferred);
      m.total += t.total;
      m.labor_total = Math.round((m.labor_total + (Number(t.labor_total) || 0)) * 100) / 100;
      m.tip_total = Math.round((m.tip_total + (Number(t.tip_total) || 0)) * 100) / 100;
      if(t.paid_snapshot) m.paid_snapshot=t.paid_snapshot;
    }
  }
  const payDate = addDaysStr(weekEnd, PAY_DATE_OFFSET_DAYS);
  const officeRows = await officePayRows(db, parsedWeek);
  const commRows = await prospectCommissionRows(db, parsedWeek, weekEnd, null);
  const data = sortForPayroll([...merged.values(), ...officeRows, ...commRows]);

  return res.status(200).json({
    week_start: parsedWeek,
    week_end: weekEnd,
    pay_date: payDate,
    techs: data,
    total: data.filter(t => (t.currency || 'USD') === 'USD').reduce((sum, t) => sum + t.total, 0),
    actual_profit: await actualProfitFor(db, payDate, parsedWeek, weekEnd),
    combined: true,
  });
}

async function actualProfitSave(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { pay_date, field, amount } = req.body || {};
  const validFields = ['doms_stripe_payout', 'tidyhaus_stripe_payout', 'tech_pay', 'lead_gen', 'stripe_payout'];
  if (!pay_date || !/^\d{4}-\d{2}-\d{2}$/.test(pay_date)) return res.status(400).json({ error: 'pay_date (YYYY-MM-DD) required' });
  if (!validFields.includes(field)) return res.status(400).json({ error: `field must be one of ${validFields.join(', ')}` });
  if (amount == null || isNaN(Number(amount))) return res.status(400).json({ error: 'amount required' });
  const leadSlug = String((req.body || {}).slug || '');
  if ((field === 'lead_gen' || field === 'stripe_payout') && !/^[a-z0-9-]{1,60}$/.test(leadSlug)) return res.status(400).json({ error: 'slug required' });

  const { data: existing } = await db.from('actual_profit_weekly')
    .select('doms_stripe_payout, tidyhaus_stripe_payout, tech_pay, lead_gen_payouts, payouts_by_business').eq('pay_date', pay_date).maybeSingle();

  const row = {
    pay_date,
    doms_stripe_payout: existing?.doms_stripe_payout ?? null,
    tidyhaus_stripe_payout: existing?.tidyhaus_stripe_payout ?? null,
    tech_pay: existing?.tech_pay ?? null,
    lead_gen_payouts: leadGenMap(existing?.lead_gen_payouts),
    payouts_by_business: leadGenMap(existing?.payouts_by_business),
    updated_at: new Date().toISOString(),
  };
  const legacySlug = Object.keys(LEGACY_PAYOUT_COL).find(k => LEGACY_PAYOUT_COL[k] === field);
  if (field === 'lead_gen') row.lead_gen_payouts[leadSlug] = Number(amount);
  else if (field === 'stripe_payout') {
    row.payouts_by_business[leadSlug] = Number(amount);
    if (LEGACY_PAYOUT_COL[leadSlug]) row[LEGACY_PAYOUT_COL[leadSlug]] = Number(amount);
  } else {
    row[field] = Number(amount);
    if (legacySlug) row.payouts_by_business[legacySlug] = Number(amount);
  }
  const { error } = await db.from('actual_profit_weekly').upsert(row, { onConflict: 'pay_date' });
  if (error) throw error;

  return res.status(200).json({ ok: true, pay_date, field, amount: Number(amount) });
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function fetchSecretaryAvailability(db, bizId) {
  const { data: pattern, error: pErr } = await db.from('secretary_availability')
    .select('day_of_week, is_available').eq('business_id', bizId).order('day_of_week');
  if (pErr) throw pErr;
  const { data: exceptions, error: eErr } = await db.from('secretary_availability_exceptions')
    .select('exception_date, is_available').eq('business_id', bizId)
    .gte('exception_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order('exception_date');
  if (eErr) throw eErr;
  return { pattern: pattern || [], exceptions: exceptions || [] };
}

async function secretaryAvailability(req, res, db, auth) {
  let slug;
  if (auth.role === 'secretary' && auth.name && auth.name !== displayNameFor(auth.scope)) {
    const { data: days } = await db.from('staff_schedules').select('day_of_week, start_time, end_time, timezone').eq('name', auth.name).order('day_of_week');
    return res.status(200).json({ personal: true, name: auth.name, day_names: DOW_NAMES, days: days || [] });
  }
  if (auth.role === 'secretary') slug = auth.scope;
  else if (auth.role === 'owner') slug = (req.query.business || '').toString();
  else return res.status(403).json({ error: 'Not authorized' });
  if (!slug || !['tidyhaus', 'doms'].includes(slug)) return res.status(400).json({ error: 'business required' });

  const { data: biz, error: bizErr } = await db.from('businesses').select('id, slug').eq('slug', slug).maybeSingle();
  if (bizErr) throw bizErr;
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  const { pattern, exceptions } = await fetchSecretaryAvailability(db, biz.id);
  return res.status(200).json({
    business_slug: slug, name: displayNameFor(slug), pattern, exceptions, day_names: DOW_NAMES,
    daily_rate: SECRETARY_RATE[slug].daily, currency: SECRETARY_RATE[slug].currency,
  });
}

async function secretaryAvailabilitySet(req, res, db, auth) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const owner = auth.role === 'owner', body = req.body || {};
  if (!owner && auth.role !== 'secretary') return res.status(403).json({ error: 'Forbidden' });
  if (!owner && auth.name && auth.name !== displayNameFor(auth.scope)) return res.status(403).json({ error: 'Your schedule is set by Owner.' });
  const dayOfWeek = body.day_of_week, isAvailable = body.is_available;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'A weekday (0-6) and Working/Off value are required' });
  const scope = owner ? body.business : auth.scope;
  const subject = owner ? body.name : displayNameFor(scope);
  if (!['tidyhaus','doms'].includes(scope) || (owner && !((subject === 'Heather' && scope === 'tidyhaus') || (['Joey','Alex','Joe'].includes(subject) && scope === 'doms')))) return res.status(400).json({ error: 'Unknown secretary' });
  const { data: biz, error: bizErr } = await db.from('businesses').select('id').eq('slug', scope).maybeSingle();
  if (bizErr) throw bizErr;
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  if (owner && ['Alex','Joe'].includes(subject)) {
    const { data: rows, error: readErr } = await db.from('staff_schedules').select('*').eq('name', subject);
    if (readErr) throw readErr;
    const previous = (rows || []).some(r=>r.day_of_week===dayOfWeek);
    if (previous !== isAvailable) {
      if (isAvailable) {
        let template = (rows || [])[0];
        if (!template) {
          const { data: person, error: personErr } = await db.from('staff_users').select('phone').eq('name', subject).eq('active', true).maybeSingle();
          if (personErr) throw personErr;
          if (!person?.phone) return res.status(409).json({ error: 'Add this secretary’s phone number before enabling coverage.' });
          template = { name:subject, business_slug:scope, start_time:'08:00', end_time:'20:00', timezone:'Asia/Manila', phone:person.phone, priority:subject==='Alex'?1:2 };
        }
        const { error } = await db.from('staff_schedules').upsert({ ...template, day_of_week: dayOfWeek, updated_at: new Date().toISOString() }, { onConflict:'name,day_of_week' });
        if (error) throw error;
      } else {
        const { error } = await db.from('staff_schedules').delete().eq('name', subject).eq('day_of_week', dayOfWeek);
        if (error) throw error;
      }
      await db.from('secretary_schedule_changes').insert({business_id:biz.id,changed_by:`Owner (for ${subject})`,kind:'weekly',day_of_week:dayOfWeek,is_available:isAvailable,previous_available:previous});
    }
  } else {
    const { data: prevRow, error: prevErr } = await db.from('secretary_availability').select('is_available').eq('business_id', biz.id).eq('day_of_week', dayOfWeek).maybeSingle();
    if (prevErr) throw prevErr;
    const { error } = await db.from('secretary_availability').upsert({ business_id: biz.id, day_of_week: dayOfWeek, is_available: isAvailable, updated_at: new Date().toISOString() }, { onConflict:'business_id,day_of_week' });
    if (error) throw error;
    await recordSecretaryChange(db, { biz, scope, kind:'weekly', dayOfWeek, isAvailable, previous:prevRow ? prevRow.is_available : null, actor:owner?'owner':'secretary' });
  }
  return res.status(200).json({ ok:true, day_of_week:dayOfWeek, is_available:isAvailable });
}

async function recordSecretaryChange(db, { biz, scope, kind, dayOfWeek = null, dateStr = null, isAvailable, previous, actor = 'secretary' }) {
  if (previous !== null && previous === isAvailable) return;
  const subject = displayNameFor(scope);
  const who = actor === 'owner' ? `Owner (for ${subject})` : subject;
  try {
    await db.from('secretary_schedule_changes').insert({
      business_id: biz.id, changed_by: who, kind,
      day_of_week: kind === 'weekly' ? dayOfWeek : null,
      exception_date: kind === 'exception' ? dateStr : null,
      is_available: isAvailable, previous_available: previous,
    });
  } catch (e) { console.warn('[secretary-change] log failed:', e.message); }

  try {
    const ownerPhone = process.env.OWNER_PHONE_NUMBER;
    if (!ownerPhone) return;
    const when = kind === 'weekly'
      ? `every ${DOW_NAMES[dayOfWeek] || `day ${dayOfWeek}`}`
      : (() => { try { return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }); }
                 catch { return dateStr; } })();
    const what = isAvailable
      ? (kind === 'weekly' ? `is now WORKING ${when}` : `is now WORKING on ${when}`)
      : (kind === 'weekly' ? `is now OFF ${when}` : `took ${when} OFF`);
    await sendSMS(ownerPhone, `Schedule change: ${who} ${what}.`);
  } catch (e) { console.warn('[secretary-change] owner SMS failed:', e.message); }

  if (kind === 'exception' && !isAvailable) {
    try {
      const { data: techs } = await db.from('technicians')
        .select('name, phone').eq('business_id', biz.id).eq('active', true);
      const reachable = (techs || []).filter(t => t.phone);
      if (reachable.length) {
        const dayTxt = (() => { try { return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }); }
                                catch { return dateStr; } })();
        const msg = `Heads up: ${subject} is OFF ${dayTxt}, so the office phone won't be covered that day. Reach the owner directly if you need something.`;
        for (const t of reachable) {
          const r = await sendSMSResult(t.phone, msg);
          if (!r.ok) console.warn(`[secretary-change] tech SMS failed for ${t.name}:`, r.error || r.skipped);
        }
      }
    } catch (e) {
      console.warn('[secretary-change] tech alert failed:', e.message);
    }
  }
}

async function secretaryAvailabilityExceptionSet(req, res, db, auth) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  if (auth.role === 'secretary' && auth.name && auth.name !== displayNameFor(auth.scope)) return res.status(403).json({ error: 'Your schedule is set by Owner.' });
  let scope;
  if (auth.role === 'secretary') scope = auth.scope;
  else if (auth.role === 'owner') scope = (body.business || '').toString();
  else return res.status(403).json({ error: 'Not authorized' });
  if (!scope || !['tidyhaus', 'doms'].includes(scope)) return res.status(400).json({ error: 'business required' });

  const date = (body.date || '').toString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
  const remove = !!body.remove;
  const isAvailable = !!body.is_available;

  const { data: biz, error: bizErr } = await db.from('businesses').select('id').eq('slug', scope).maybeSingle();
  if (bizErr) throw bizErr;
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  let patternSays = null;
  try {
    const dow = dayOfWeekFor(date);
    const { data: pat } = await db.from('secretary_availability')
      .select('is_available').eq('business_id', biz.id).eq('day_of_week', dow).maybeSingle();
    if (pat) patternSays = pat.is_available;
  } catch { /* fall back to "no prior state" */ }

  const { data: prevEx } = await db.from('secretary_availability_exceptions')
    .select('is_available').eq('business_id', biz.id).eq('exception_date', date).maybeSingle();
  const previous = prevEx ? prevEx.is_available : patternSays;

  if (remove) {
    const { error: delErr } = await db.from('secretary_availability_exceptions')
      .delete().eq('business_id', biz.id).eq('exception_date', date);
    if (delErr) throw delErr;
    await recordSecretaryChange(db, {
      biz, scope, actor: auth.role === 'owner' ? 'owner' : 'secretary', kind: 'exception',
      dateStr: date, isAvailable: patternSays === null ? true : patternSays, previous,
    });
    return res.status(200).json({ ok: true, date, removed: true, reverts_to: patternSays });
  }

  const { error } = await db.from('secretary_availability_exceptions')
    .upsert({ business_id: biz.id, exception_date: date, is_available: isAvailable, updated_at: new Date().toISOString() },
      { onConflict: 'business_id,exception_date' });
  if (error) throw error;

  await recordSecretaryChange(db, {
    biz, scope, actor: auth.role === 'owner' ? 'owner' : 'secretary', kind: 'exception',
    dateStr: date, isAvailable, previous,
  });
  return res.status(200).json({ ok: true, date, is_available: isAvailable });
}

function noteReader(auth) {
  return (auth.name || auth.scope || auth.role || 'office').toString();
}
async function notesActive(req, res, db, auth) {
  const today = denverToday();
  const reader = noteReader(auth);
  const isOwner = auth.role === 'owner';
  const { data, error } = await db.from('staff_notes')
    .select('id, target_slug, target_name, to_owner, body, mode, show_from, send_at, created_by, created_at, photo_urls')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;

  const { data: reads } = await db.from('staff_note_reads').select('note_id, read_at').eq('reader', reader);
  const seenAt = new Map((reads || []).map(r => [r.note_id, r.read_at]));
  const allIds = (data || []).map(n => n.id);
  const threadBy = {};
  if (allIds.length) {
    const { data: tr } = await db.from('staff_note_replies').select('note_id, author, body, created_at').in('note_id', allIds).order('created_at', { ascending: true });
    (tr || []).forEach(t => { (threadBy[t.note_id] = threadBy[t.note_id] || []).push(t); });
  }
  const isNewFor = n => {
    if (!seenAt.has(n.id)) return true;
    const at = new Date(seenAt.get(n.id) || 0).getTime();
    return (threadBy[n.id] || []).some(t => t.author !== reader && new Date(t.created_at).getTime() > at);
  };

  const notes = (data || [])
    .filter(isNewFor)
    .filter(n => (n.created_by || '') !== reader)
    .filter(n => auth.auditor ? n.target_slug === 'auditor' : isOwner ? !!n.to_owner : (!n.to_owner && n.target_slug !== 'auditor' && (!n.target_slug || n.target_slug === auth.scope)))
    .filter(n => !n.target_name || (!isOwner && !auth.auditor && n.target_name === auth.name))
    .filter(n => noteIsLive(n, today))
    .map(n => ({ ...n, thread: (threadBy[n.id] || []).map(t => ({ author: t.author, body: t.body, created_at: t.created_at })) }));

  return res.status(200).json({ notes, count: notes.length });
}

async function notesRead(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const reply = (body.reply || '').toString().trim();
  if (reply.length > 1000) return res.status(400).json({ error: 'Reply is too long (1000 characters max)' });
  const now = new Date().toISOString();
  const row = { note_id: id, reader: noteReader(auth), read_at: now };
  if (reply) { row.reply = reply; row.replied_at = now; row.reply_seen_at = null; }
  const { error } = await db.from('staff_note_reads').upsert(row, { onConflict: 'note_id,reader' });
  if (error) throw error;
  if (reply) {
    const { error: e2 } = await db.from('staff_note_replies').insert({ note_id: id, author: row.reader, body: reply, created_at: now });
    if (e2) console.warn('[admin] notes_read: thread row failed:', e2.message);
  }
  return res.status(200).json({ ok: true });
}

async function notesList(req, res, db, auth) {
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const today = denverToday();
  let q = db.from('staff_notes')
    .select('id, target_slug, target_name, to_owner, body, mode, show_from, send_at, created_by, created_at, photo_urls')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(40);
  if (auth.role === 'secretary') q = q.eq('created_by', auth.name || '');
  const { data, error } = await q;
  if (error) throw error;

  const ids = (data || []).map(n => n.id);
  let readsBy = {};
  if (ids.length) {
    const { data: reads } = await db.from('staff_note_reads')
      .select('note_id, reader, read_at, reply, replied_at, reply_seen_at').in('note_id', ids);
    (reads || []).forEach(r => { (readsBy[r.note_id] = readsBy[r.note_id] || []).push(r); });
  }
  const notes = (data || []).map(n => ({
    ...n,
    live: noteIsLive(n, today),
    scheduled: noteIsScheduled(n),
    reads: (readsBy[n.id] || []).map(r => ({
      reader: r.reader, read_at: r.read_at,
      reply: r.reply || null, replied_at: r.replied_at || null, reply_new: !!(r.reply && !r.reply_seen_at),
    })),
  }));
  return res.status(200).json({ notes });
}

async function notesRepliesSeen(req, res, db, auth) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { error } = await db.from('staff_note_reads')
    .update({ reply_seen_at: new Date().toISOString() })
    .not('reply', 'is', null).is('reply_seen_at', null);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function notesPhoto(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary' && !auth.auditor) return res.status(403).json({ error: 'Not available for this login' });
  const up = await uploadPrivateImage(body.image, NOTE_PHOTO_PREFIX);
  return res.status(200).json({ ok: true, url: up.path });
}

async function notePhoto(req, res, db, auth) {
  const raw = (req.query.path || '').toString();
  if (!isPrivateNotePhoto(raw)) return res.status(400).json({ error: 'Bad photo path' });
  const path = raw.slice(5);
  if (auth.role !== 'owner') {
    const [{ data: sn }, { data: tn }] = await Promise.all([
      db.from('staff_notes').select('created_by, to_owner, target_slug').contains('photo_urls', [raw]).is('deleted_at', null).limit(20),
      db.from('tech_notes').select('created_by').contains('photo_urls', [raw]).is('deleted_at', null).limit(20),
    ]);
    const me = auth.name || '';
    const onNotes = (sn || []).length + (tn || []).length > 0;
    const mayView = !onNotes
      || (sn || []).some(n => n.created_by === me || (!auth.auditor && !n.to_owner && (!n.target_slug || n.target_slug === auth.scope)))
      || (tn || []).some(n => n.created_by === me);
    if (!mayView) return res.status(403).json({ error: 'Not your photo' });
  }
  const { buffer } = await readPrivateImage(path);
  res.setHeader('Content-Type', notePhotoContentType(path));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.status(200).send(buffer);
}

async function notesAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const text = (body.body || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Write something first' });
  if (text.length > 2000) return res.status(400).json({ error: 'Note is too long (2000 characters max)' });
  const toOwner = body.target === 'owner';
  const person = /^person:(Heather|Joey|Alex|Joe)$/.exec(String(body.target || ''));
  const target = person ? null : !toOwner && body.target && (['tidyhaus', 'doms'].includes(body.target) || (body.target === 'auditor' && auth.role === 'owner')) ? body.target : null;
  const mode = ['today', 'two_days', 'until_read'].includes(body.mode) ? body.mode : 'today';
  const when = resolveSendAt(body);
  if (when.error) return res.status(400).json({ error: when.error });
  const { data, error } = await db.from('staff_notes')
    .insert({ body: text, target_slug: target, target_name: person ? person[1] : null, to_owner: toOwner, mode, show_from: when.show_from, send_at: when.send_at, created_by: auth.name || 'Owner', photo_urls: cleanNotePhotos(body.photos) })
    .select('id').maybeSingle();
  if (error) throw error;
  return res.status(200).json({ ok: true, id: data && data.id });
}

async function websiteEdits(req, res, db, auth) {
  if (!isJoeyLogin(auth)) return res.status(403).json({ error: 'Not available for this login' });
  const [{ data: biz }, { data, error }] = await Promise.all([
    db.from('businesses').select('slug, name, url').not('url', 'is', null).order('name'),
    db.from('website_edits').select('id, site, body, photo_urls, status, reply, replied_at, created_at, done_at')
      .eq('created_by', auth.name).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
  ]);
  if (error) throw error;
  const sites = (biz || []).map(b => ({ name: b.name, domain: String(b.url || '').replace(/^https?:[/][/]/, '').replace(/[/]$/, '') })).filter(b => b.domain);
  return res.status(200).json({ sites, edits: data || [] });
}

async function websiteEditAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isJoeyLogin(auth)) return res.status(403).json({ error: 'Not available for this login' });
  const site = String((body && body.site) || '').trim().slice(0, 120);
  const text = String((body && body.body) || '').trim();
  if (!site) return res.status(400).json({ error: 'Pick a website' });
  if (!text) return res.status(400).json({ error: 'Write the change' });
  if (text.length > 100000) return res.status(400).json({ error: 'Too long' });
  const { data, error } = await db.from('website_edits')
    .insert({ site, body: text, photo_urls: cleanNotePhotos(body.photos), created_by: auth.name })
    .select('id').maybeSingle();
  if (error) throw error;
  return res.status(200).json({ ok: true, id: data && data.id });
}

async function auditorNoteSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const text = (body.body || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Write something first' });
  const recipient = (body.recipient || '').toString();
  const when = resolveSendAt({});
  const row = { body: text, mode: 'until_read', show_from: when.show_from, send_at: when.send_at, created_by: auth.name || 'Jiyah', photo_urls: cleanNotePhotos(body.photos) };
  if (recipient === 'andrew') { row.to_owner = true; row.target_slug = null; }
  else if (recipient === 'heather') { row.to_owner = false; row.target_slug = 'tidyhaus'; }
  else if (recipient === 'joey') { row.to_owner = false; row.target_slug = 'doms'; }
  else if (recipient === 'alex' || recipient === 'joe') { row.to_owner = false; row.target_slug = null; row.target_name = recipient === 'alex' ? 'Alex' : 'Joe'; }
  else return res.status(400).json({ error: 'Pick Owner, Heather, Alex or Joe' });
  const { data, error } = await db.from('staff_notes').insert(row).select('id').maybeSingle();
  if (error) throw error;
  return res.status(200).json({ ok: true, id: data && data.id });
}

async function auditorNoteChange(req, res, db, auth, body, action) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = String(body.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required' });
  let patch;
  if (action === 'auditor_note_delete') patch = { deleted_at: new Date().toISOString() };
  else {
    const text = (body.body || '').toString().trim();
    if (!text) return res.status(400).json({ error: 'Write something first' });
    patch = { body: text };
  }
  const { data, error } = await db.from('staff_notes').update(patch)
    .eq('id', id).eq('created_by', auth.name || 'Jiyah').is('deleted_at', null).select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Note not found' });
  return res.status(200).json({ ok: true });
}

async function auditorNotesSent(req, res, db, auth) {
  const { data, error } = await db.from('staff_notes')
    .select('id, target_slug, target_name, to_owner, body, created_at, photo_urls, author_pinned_at')
    .eq('created_by', auth.name || 'Jiyah').is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  const ids = (data || []).map(n => n.id);
  let readsBy = {};
  if (ids.length) {
    const { data: reads } = await db.from('staff_note_reads').select('note_id, reader, read_at, reply, replied_at, author_ack_at').in('note_id', ids);
    (reads || []).forEach(r => { (readsBy[r.note_id] = readsBy[r.note_id] || []).push(r); });
  }
  const me = String(auth.name || 'Jiyah').toLowerCase();
  const threadBy = {};
  if (ids.length) {
    const { data: tr } = await db.from('staff_note_replies').select('id, note_id, author, body, created_at, author_ack_at').in('note_id', ids).order('created_at', { ascending: true });
    (tr || []).forEach(t => { (threadBy[t.note_id] = threadBy[t.note_id] || []).push(t); });
  }
  const threadOf = n => {
    const rows = threadBy[n.id] || [];
    const legacy = (readsBy[n.id] || []).filter(r => r.reply && !rows.some(t => t.author === r.reader && t.body === r.reply))
      .map(r => ({ kind: 'legacy', id: r.reader, author: r.reader, body: r.reply, at: r.replied_at || r.read_at,
        is_new: String(r.reader || '').toLowerCase() !== me && (!r.author_ack_at || !!(r.replied_at && r.author_ack_at < r.replied_at)) }));
    const msgs = rows.map(t => ({ kind: 'thread', id: t.id, author: t.author, body: t.body, at: t.created_at,
      is_new: String(t.author || '').toLowerCase() !== me && !t.author_ack_at }));
    return legacy.concat(msgs).sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  };
  const notes = (data || []).map(n => ({
    ...n,
    recipient: n.to_owner ? 'andrew' : n.target_name ? String(n.target_name).toLowerCase() : n.target_slug === 'tidyhaus' ? 'heather' : n.target_slug === 'doms' ? 'joey' : 'both',
    reads: (readsBy[n.id] || []).map(r => ({ reader: r.reader, read_at: r.read_at, reply: r.reply || null, replied_at: r.replied_at || null,
      reply_new: !!(r.reply && String(r.reader || '').toLowerCase() !== me && (!r.author_ack_at || (r.replied_at && r.author_ack_at < r.replied_at))) })),
    thread: threadOf(n),
    pinned: !!n.author_pinned_at,
  }));
  return res.status(200).json({ notes });
}

async function auditorReplyAck(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const noteId = String((body && body.note_id) || ''), reader = String((body && body.reader) || ''), replyId = String((body && body.reply_id) || '');
  if (!noteId || (!reader && !replyId)) return res.status(400).json({ error: 'note_id and reader required' });
  const { data: n } = await db.from('staff_notes').select('id').eq('id', noteId).eq('created_by', auth.name || 'Jiyah').maybeSingle();
  if (!n) return res.status(404).json({ error: 'Not found' });
  if (replyId) {
    const { error: e1 } = await db.from('staff_note_replies').update({ author_ack_at: new Date().toISOString() }).eq('note_id', noteId).eq('id', replyId);
    if (e1) throw e1;
    return res.status(200).json({ ok: true });
  }
  const { error } = await db.from('staff_note_reads').update({ author_ack_at: new Date().toISOString() }).eq('note_id', noteId).eq('reader', reader);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function auditorThreadPost(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const noteId = String((body && body.note_id) || ''), text = String((body && body.body) || '').trim();
  if (!noteId || !text) return res.status(400).json({ error: 'Write something first' });
  if (text.length > 2000) return res.status(400).json({ error: 'Too long (2000 characters max)' });
  const { data: n } = await db.from('staff_notes').select('id').eq('id', noteId).eq('created_by', auth.name || 'Jiyah').is('deleted_at', null).maybeSingle();
  if (!n) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  const { data, error } = await db.from('staff_note_replies').insert({ note_id: noteId, author: auth.name || 'Jiyah', body: text, created_at: now, author_ack_at: now }).select('id').maybeSingle();
  if (error) throw error;
  return res.status(200).json({ ok: true, id: data && data.id });
}

async function auditorNotePin(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = String((body && body.id) || '');
  if (!id) return res.status(400).json({ error: 'id is required' });
  const { data, error } = await db.from('staff_notes').update({ author_pinned_at: body.pinned ? new Date().toISOString() : null })
    .eq('id', id).eq('created_by', auth.name || 'Jiyah').select('id').maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({ ok: true });
}

async function jiyahPhotos(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { data, error } = await db.from('staff_notes')
    .select('id, body, photo_urls, created_at, target_slug, to_owner')
    .eq('created_by', 'Jiyah').is('deleted_at', null)
    .not('photo_urls', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  const photos = [];
  for (const n of (data || [])) {
    const recipient = n.to_owner ? 'Owner' : n.target_slug === 'tidyhaus' ? 'Heather' : n.target_slug === 'doms' ? 'Joey' : 'Both secretaries';
    for (const url of (n.photo_urls || [])) {
      if (!url) continue;
      photos.push({ id: `${n.id}:${photos.length}`, url, note_id: n.id, note_body: n.body, created_at: n.created_at, recipient });
    }
  }
  return res.status(200).json({ photos });
}

function noteEditPatch(existing, body) {
  const text = (body.body || '').toString().trim();
  if (!text) return { error: 'Write something first' };
  if (text.length > 2000) return { error: 'Note is too long (2000 characters max)' };
  const mode = ['today', 'two_days', 'until_read'].includes(body.mode) ? body.mode : existing.mode;
  const patch = { body: text, mode, photo_urls: cleanNotePhotos(body.photos) };
  if (body.send_date || body.send_time) {
    const when = resolveSendAt(body);
    if (when.error) return { error: when.error };
    patch.send_at = when.send_at; patch.show_from = when.show_from;
  } else if (noteIsScheduled(existing)) {
    patch.send_at = null; patch.show_from = denverToday();
  }
  patch.reshow = text !== existing.body
    || JSON.stringify(patch.photo_urls) !== JSON.stringify(existing.photo_urls || []);
  return { patch };
}

async function notesUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: existing } = await db.from('staff_notes').select('id, body, mode, show_from, send_at, photo_urls, created_by').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'That note is gone' });
  if (auth.role === 'secretary' && existing.created_by !== auth.name) return res.status(403).json({ error: 'You can only edit your own notes' });
  const r = noteEditPatch(existing, body);
  if (r.error) return res.status(400).json({ error: r.error });
  const { reshow, ...patch } = r.patch;
  if ('target' in body) {
    const toOwner = body.target === 'owner';
    const person = /^person:(Heather|Joey|Alex|Joe)$/.exec(String(body.target || ''));
    patch.to_owner = toOwner;
    patch.target_slug = !toOwner && !person && ['tidyhaus', 'doms'].includes(body.target) ? body.target : null;
    patch.target_name = person ? person[1] : null;
  }
  const { error } = await db.from('staff_notes').update(patch).eq('id', id);
  if (error) throw error;
  if (reshow) await db.from('staff_note_reads').delete().eq('note_id', id).is('reply', null);
  return res.status(200).json({ ok: true, reshown: reshow });
}

const DOMAIN_WATCH_MAX = 500;

async function domainWatchList(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { data, error } = await db.from('domain_watch')
    .select('id, domain, status, status_since, expires_at, registrar, last_checked_at, last_error, notified_at, created_at')
    .order('created_at', { ascending: false }).limit(DOMAIN_WATCH_MAX);
  if (error) throw error;
  return res.status(200).json({ domains: data || [], owner_phone_set: !!process.env.OWNER_PHONE_NUMBER });
}

async function domainWatchAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { good, bad } = parseDomainList(body.text);
  if (!good.length) return res.status(400).json({ error: bad.length ? `Nothing here looks like a domain: ${bad.slice(0, 5).join(', ')}` : 'Paste at least one domain' });
  const { data: existing } = await db.from('domain_watch').select('domain');
  const have = new Set((existing || []).map(r => r.domain));
  const fresh = good.filter(d => !have.has(d));
  if ((existing || []).length + fresh.length > DOMAIN_WATCH_MAX) return res.status(400).json({ error: `The watch list is limited to ${DOMAIN_WATCH_MAX} domains` });
  let added = [];
  if (fresh.length) {
    const { data, error } = await db.from('domain_watch')
      .insert(fresh.map(domain => ({ domain, created_by: auth.name || 'Owner' }))).select('id');
    if (error) throw error;
    added = data || [];
    try {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recent } = await db.from('domain_watch').select('id').gte('notified_at', since).limit(1);
      await runDomainWatch(db, { onlyIds: added.map(r => r.id), digest: true, quiet: !!(recent && recent.length) });
    }
    catch (e) { console.warn('[domain_watch_add] first check failed:', e.message); }
  }
  return res.status(200).json({ ok: true, added: added.length, duplicates: good.length - fresh.length, skipped: bad });
}

async function domainWatchAlerts(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(200).json({ alerts: [] });
  const { data, error } = await db.from('domain_watch')
    .select('id, domain, status, status_since, expires_at, alert_dismissed_status')
    .in('status', ['available', 'pending_delete', 'likely_available']);
  if (error) return res.status(200).json({ alerts: [] });
  return res.status(200).json({ alerts: (data || []).filter(r => r.alert_dismissed_status !== r.status) });
}

async function domainWatchDismiss(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const id = String(body.id || '');
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: row } = await db.from('domain_watch').select('status').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'Not on the list' });
  const { error } = await db.from('domain_watch').update({ alert_dismissed_status: row.status }).eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function domainWatchDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(x => String(x || '')).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('domain_watch').delete().in('id', ids);
  if (error) throw error;
  return res.status(200).json({ ok: true, removed: ids.length });
}

async function domainWatchCheck(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const summary = await runDomainWatch(db, {});
  return res.status(200).json({ ok: true, ...summary });
}


async function techNotesTargets(req, res, db, auth) {
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const { data, error } = await db.from('technicians')
    .select('id, name, business:businesses ( slug, name ), area:service_areas ( name )')
    .eq('active', true).order('name');
  if (error) throw error;
  const techs = (data || []).map(t => ({
    id: t.id, name: t.name, business_slug: t.business?.slug || '', business_name: t.business?.name || '',
    city: t.area?.name || '',
  }));
  const cities = [...new Set(techs.map(t => t.city).filter(Boolean))].sort();
  return res.status(200).json({ techs, cities });
}

async function techNotesAdd(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const text = (body.body || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Write something first' });
  if (text.length > 2000) return res.status(400).json({ error: 'Note is too long (2000 characters max)' });
  const targetType = ['tech', 'city', 'all'].includes(body.target_type) ? body.target_type : null;
  if (!targetType) return res.status(400).json({ error: 'Choose who this is for' });
  const mode = ['today', 'two_days', 'until_read'].includes(body.mode) ? body.mode : 'today';

  const when = resolveSendAt(body);
  if (when.error) return res.status(400).json({ error: when.error });
  const row = {
    body: text, target_type: targetType, mode, show_from: when.show_from, send_at: when.send_at,
    created_by: auth.name || 'Owner', photo_urls: cleanNotePhotos(body.photos),
  };
  if (targetType === 'tech') {
    const tid = (body.technician_id || '').toString();
    const { data: t } = await db.from('technicians').select('id').eq('id', tid).eq('active', true).maybeSingle();
    if (!t) return res.status(400).json({ error: 'Pick a cleaner' });
    row.technician_id = t.id;
  } else if (targetType === 'city') {
    const city = (body.city || '').toString().trim();
    const { data: areas } = await db.from('service_areas').select('name').eq('name', city).limit(1);
    if (!city || !(areas || []).length) return res.status(400).json({ error: 'Pick a city' });
    row.city = city;
  }
  const { data, error } = await db.from('tech_notes').insert(row).select('id').maybeSingle();
  if (error) throw error;
  return res.status(200).json({ ok: true, id: data && data.id });
}

async function techNotesList(req, res, db, auth) {
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const today = denverToday();
  let tnq = db.from('tech_notes')
    .select('id, body, target_type, technician_id, city, mode, show_from, send_at, photo_urls, created_by, created_at, tech:technicians!tech_notes_technician_id_fkey ( name )')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(40);
  if (auth.role === 'secretary') tnq = tnq.eq('created_by', auth.name || '');
  const { data, error } = await tnq;
  if (error) throw error;
  const ids = (data || []).map(n => n.id);
  const dismissedBy = {};
  if (ids.length) {
    const { data: ds } = await db.from('tech_note_dismissals')
      .select('note_id, dismissed_at, tech:technicians ( name )').in('note_id', ids);
    (ds || []).forEach(d => { (dismissedBy[d.note_id] = dismissedBy[d.note_id] || []).push({ name: d.tech?.name || 'Cleaner', at: d.dismissed_at }); });
  }
  const { data: roster } = await db.from('technicians')
    .select('id, name, area:service_areas ( name )').eq('active', true).order('name');
  const audience = (n) => (roster || []).filter(t => n.target_type === 'all'
    || (n.target_type === 'tech' && n.technician_id === t.id)
    || (n.target_type === 'city' && t.area?.name && t.area.name === n.city));
  const notes = (data || []).map(n => ({
    recipients: audience(n).map(t => ({ name: t.name, seen: (dismissedBy[n.id] || []).some(d => d.name === t.name) })),
    id: n.id, body: n.body, mode: n.mode, photo_urls: n.photo_urls || [], created_by: n.created_by, created_at: n.created_at,
    target_type: n.target_type, technician_id: n.technician_id || null, city: n.city || null,
    target_label: n.target_type === 'all' ? 'Every technician' : n.target_type === 'city' ? `Every tech in ${n.city}` : (n.tech?.name || 'One technician'),
    live: noteIsLive(n, today),
    scheduled: noteIsScheduled(n), send_at: n.send_at || null,
    dismissed: dismissedBy[n.id] || [],
  }));
  return res.status(200).json({ notes });
}

async function techNotesDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  if (auth.role === 'secretary') {
    const { data: existing } = await db.from('tech_notes').select('created_by').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'That note is gone' });
    if (existing.created_by !== auth.name) return res.status(403).json({ error: 'You can only delete your own notes' });
  }
  const { error } = await db.from('tech_notes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function techNotesUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: existing } = await db.from('tech_notes').select('id, body, mode, show_from, send_at, photo_urls, target_type, created_by').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'That note is gone' });
  if (auth.role === 'secretary' && existing.created_by !== auth.name) return res.status(403).json({ error: 'You can only edit your own notes' });
  const r = noteEditPatch(existing, body);
  if (r.error) return res.status(400).json({ error: r.error });
  const { reshow, ...patch } = r.patch;
  if (['tech', 'city', 'all'].includes(body.target_type)) {
    patch.target_type = body.target_type; patch.technician_id = null; patch.city = null;
    if (body.target_type === 'tech') {
      const { data: t } = await db.from('technicians').select('id').eq('id', (body.technician_id || '').toString()).eq('active', true).maybeSingle();
      if (!t) return res.status(400).json({ error: 'Pick a cleaner' });
      patch.technician_id = t.id;
    } else if (body.target_type === 'city') {
      const city = (body.city || '').toString().trim();
      const { data: areas } = await db.from('service_areas').select('name').eq('name', city).limit(1);
      if (!city || !(areas || []).length) return res.status(400).json({ error: 'Pick a city' });
      patch.city = city;
    }
  }
  const { error } = await db.from('tech_notes').update(patch).eq('id', id);
  if (error) throw error;
  if (reshow) await db.from('tech_note_dismissals').delete().eq('note_id', id);
  return res.status(200).json({ ok: true, reshown: reshow });
}

async function notesDelete(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const id = (body.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  if (auth.role === 'secretary') {
    const { data: existing } = await db.from('staff_notes').select('created_by').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'That note is gone' });
    if (existing.created_by !== auth.name) return res.status(403).json({ error: 'You can only delete your own notes' });
  }
  const { error } = await db.from('staff_notes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function secretaryChanges(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { data, error } = await db.from('secretary_schedule_changes')
    .select('id, business_id, changed_by, kind, day_of_week, exception_date, is_available, previous_available, seen_at, created_at, business:businesses ( slug, name )')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const changes = (data || []).map(c => ({
    id: c.id, changed_by: c.changed_by, kind: c.kind,
    day_of_week: c.day_of_week, day_name: c.day_of_week != null ? DOW_NAMES[c.day_of_week] : null,
    exception_date: c.exception_date, is_available: c.is_available,
    previous_available: c.previous_available, seen: !!c.seen_at, created_at: c.created_at,
    business_slug: c.business?.slug || null, business_name: c.business?.name || null,
  }));
  return res.status(200).json({ changes, unseen: changes.filter(c => !c.seen).length });
}

async function secretaryChangesSeen(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const now = new Date().toISOString();
  let q = db.from('secretary_schedule_changes').update({ seen_at: now }).is('seen_at', null);
  if (!body.all) {
    const id = (body.id || '').toString();
    if (!id) return res.status(400).json({ error: 'id or all:true required' });
    q = q.eq('id', id);
  }
  const { error } = await q;
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function secretariesList(req, res, db, auth) {
  const isOwner = auth.role === 'owner';
  const isJoey = auth.role === 'secretary' && auth.name === 'Joey';
  if (!isOwner && !isJoey) return res.status(403).json({ error: 'Not available for this login' });
  const { data: bizRows, error: bizErr } = await db.from('businesses')
    .select('id, slug').in('slug', ['tidyhaus', 'doms']);
  if (bizErr) throw bizErr;

  const [{ data: staffPhones, error: phoneErr }, { data: scheduleRows, error: scheduleErr }, { data: xrows }] = await Promise.all([
    db.from('staff_users').select('name, phone').in('name', []).eq('active', true),
    db.from('staff_schedules').select('name, day_of_week, phone').in('name', ['Alex', 'Joe']),
    db.from('staff_schedule_exceptions').select('name, on_date, business_slug').gte('on_date', dateIn('Asia/Manila', new Date(Date.now() - 864e5))).then(r => r, () => ({ data: [] })),
  ]);
  if (phoneErr) throw phoneErr;
  if (scheduleErr) throw scheduleErr;
  const phoneFor = name => (staffPhones || []).find(r => r.name === name && r.phone)?.phone
    || (scheduleRows || []).find(r => r.name === name && r.phone)?.phone || null;
  const secretaries = await Promise.all((bizRows || []).map(async biz => {
    const { pattern, exceptions } = await fetchSecretaryAvailability(db, biz.id);
    const name = displayNameFor(biz.slug);
    return {
      business_slug: biz.slug, name, phone: phoneFor(name), pattern, exceptions,
      ...(isOwner ? { daily_rate: SECRETARY_RATE[biz.slug].daily, currency: SECRETARY_RATE[biz.slug].currency } : {}),
    };
  }));
  for (const name of ['Alex', 'Joe']) {
    const workDays = new Set((scheduleRows || []).filter(r => r.name === name).map(r => Number(r.day_of_week)));
    secretaries.push({
      business_slug: 'doms', name, phone: phoneFor(name), schedule_source: 'staff_schedules',
      exceptions: (xrows || []).filter(x => String(x.name).toLowerCase() === name.toLowerCase()).map(x => ({ exception_date: String(x.on_date).slice(0, 10), is_available: !!x.business_slug })),
      pattern: DOW_NAMES.map((_, day_of_week) => ({ day_of_week, is_available: workDays.has(day_of_week) })),
    });
  }
  const order = { Heather: 0, Joey: 1, Alex: 2, Joe: 3 };
  secretaries.sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9));
  return res.status(200).json({ secretaries, day_names: DOW_NAMES });
}

const BIZ_CITY = {
};
async function teamDirectory(req, res, db, auth) {
  const isOwner = auth.role === 'owner';
  if (!isOwner && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  await loadCoverageOverrides(db, true);
  const [{ data: bizs, error: bErr }, { data: users, error: uErr }, { data: sched, error: sErr }, { data: xrows }] = await Promise.all([
    db.from('businesses').select('id, slug, name').eq('active', true).order('name'),
    db.from('staff_users').select('name, phone, business_id').eq('role', 'secretary').eq('active', true),
    db.from('staff_schedules').select('name, day_of_week, start_time, end_time, timezone'),
    db.from('staff_schedule_exceptions').select('name, on_date, business_slug').gte('on_date', dateIn('Asia/Manila', new Date(Date.now() - 864e5))).then(r => r, () => ({ data: [] })),
  ]);
  if (bErr) throw bErr; if (uErr) throw uErr; if (sErr) throw sErr;
  const slugById = new Map((bizs || []).map(b => [b.id, b.slug]));
  const allSlugs = (bizs || []).map(b => b.slug);
  const availCache = new Map();
  const people = [];
  for (const u of users || []) {
    const name = String(u.name || '');
    if (!name || name.toLowerCase() === 'jiyah') continue;
    const home = slugById.get(u.business_id) || null;
    const all = isAllCoverage(name);
    const wk = all ? null : weeklyScheduleFor(name);
    const week = wk ? Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, wk.get(d) || null])) : null;
    const covers = all ? allSlugs : wk ? [...new Set([...wk.values()].flatMap(groupSlugs))] : (coveredSlugsFor({ name, scope: home }) || []);
    const canOpen = all || wk ? [] : (allowedSlugsFor({ scope: home, name, role: 'secretary' }) || []).filter(sl => !covers.includes(sl));
    const rows = (sched || []).filter(r => r.name === name);
    let days, hours = null, exceptions = [];
    if (rows.length) {
      exceptions = (xrows || []).filter(x => String(x.name).toLowerCase() === name.toLowerCase()).map(x => ({ date: String(x.on_date).slice(0, 10), on: !!x.business_slug }));
      days = [...new Set(rows.map(r => Number(r.day_of_week)))];
      hours = { start: String(rows[0].start_time || '').slice(0, 5), end: String(rows[0].end_time || '').slice(0, 5), tz: rows[0].timezone || 'Asia/Manila' };
    } else {
      const bizId = u.business_id;
      if (!availCache.has(bizId)) availCache.set(bizId, bizId ? await fetchSecretaryAvailability(db, bizId) : { pattern: [], exceptions: [] });
      const a = availCache.get(bizId);
      days = a.pattern.filter(p => p.is_available).map(p => Number(p.day_of_week));
      exceptions = a.exceptions.map(e => ({ date: e.exception_date, on: !!e.is_available }));
      if (name === 'Joey') hours = { start: '06:00', end: '18:00', tz: 'Asia/Manila' };
    }
    people.push({ name, phone: u.phone || null, home, all, covers, can_open: canOpen, custom: !all && !!coverageOverrideFor(name), days, hours, exceptions, week, today_group: wk ? (todayGroupFor(name) || null) : undefined });
  }
  const order = { Heather: 0, Joey: 1, Alex: 2, Joe: 3 };
  people.sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9) || a.name.localeCompare(b.name));
  const bookings30 = {};
  const { data: bk } = await db.from('bookings').select('business_id, source')
    .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).neq('status', 'cancelled')
    .then(r => r, () => ({ data: [] }));
  for (const r of bk || []) {
    if (/import/i.test(String(r.source || ''))) continue;
    const sl = slugById.get(r.business_id); if (sl) bookings30[sl] = (bookings30[sl] || 0) + 1;
  }
  return res.status(200).json({
    people, editable: isOwner,
    businesses: (bizs || []).map(b => ({ slug: b.slug, name: b.name, city: BIZ_CITY[b.slug] || '', bookings30: bookings30[b.slug] || 0 })),
  });
}

const VA_ORDER = [];
const VA_JOEY_SHIFT = d => (d === 0 || d === 6) ? { s: '11:00', e: '23:00' } : { s: '06:00', e: '18:00' };
async function vaBoard(req, res, db, auth) {
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const today = dateIn('Asia/Manila');
  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay();
  const [{ data: users, error: e1 }, { data: sched, error: e2 }, { data: bizs, error: e3 }, { data: lines, error: e4 }, exc] = await Promise.all([
    db.from('staff_users').select('name, phone').eq('role', 'secretary').eq('active', true).in('name', VA_ORDER),
    db.from('staff_schedules').select('name, day_of_week, start_time, end_time, timezone, business_slug, phone'),
    db.from('businesses').select('id, slug, name'),
    db.from('tracking_numbers').select(ROUTE_LINE_COLUMNS).eq('active', true),
    exceptionsOn(db, today),
  ]);
  if (e1 || e2 || e3 || e4) throw (e1 || e2 || e3 || e4);
  const bizBySlug = new Map((bizs || []).map(b => [b.slug, b]));
  const timeOff = {};
  for (const [slug, who] of [['tidyhaus', 'Heather'], ['doms', 'Joey']]) {
    const b = bizBySlug.get(slug); if (!b) continue;
    const [{ data: ex }, { data: pat }] = await Promise.all([
      db.from('secretary_availability_exceptions').select('is_available').eq('business_id', b.id).eq('exception_date', today).maybeSingle(),
      db.from('secretary_availability').select('day_of_week, is_available').eq('business_id', b.id),
    ]);
    timeOff[who] = { off: !!(ex && ex.is_available === false), on: !!(ex && ex.is_available === true), pattern: pat || [] };
  }
  const t5 = v => String(v || '').slice(0, 5);
  const people = VA_ORDER.map(name => {
    const u = (users || []).find(x => x.name === name);
    const rows = (sched || []).filter(r => r.name === name);
    let week;
    if (rows.length) week = rows.map(r => ({ d: Number(r.day_of_week), s: t5(r.start_time), e: t5(r.end_time), tz: r.timezone || 'Asia/Manila', g: r.business_slug || null }));
    else if (name === 'Joey') {
      const pat = (timeOff.Joey && timeOff.Joey.pattern) || [];
      const offDays = new Set(pat.filter(p => p.is_available === false).map(p => Number(p.day_of_week)));
      week = [0, 1, 2, 3, 4, 5, 6].filter(d => !offDays.has(d)).map(d => ({ d, ...VA_JOEY_SHIFT(d), tz: 'Asia/Manila', g: 'all' }));
    } else week = [];
    const ex = (exc || []).find(e => String(e.name).toLowerCase() === name.toLowerCase());
    let note = null;
    if (ex && rows.length) {
      const base = week.find(w => w.d === todayDow) || week[0] || { s: '08:00', e: '20:00', tz: 'Asia/Manila' };
      week = week.filter(w => w.d !== todayDow);
      if (ex.business_slug) week.push({ ...base, d: todayDow, g: ex.business_slug });
      note = ex.business_slug ? 'Swapped in today' : 'Off today (one-off)';
    }
    const to = timeOff[name];
    if (to && to.off) { week = week.filter(w => w.d !== todayDow); note = 'Time off today'; }
    week.sort((a, b) => a.d - b.d);
    return { name, phone: (rows[0] && rows[0].phone) || (u && u.phone) || null, week, note };
  });
  if (String(req.query.lite || '') === '1') return res.status(200).json({ now: new Date().toISOString(), today, people, lines: [] });
  const who = new Map();
  for (const p of people) if (p.phone) who.set(String(p.phone).replace(/\D/g, '').slice(-10), p.name);
  const ownerDigits = String(process.env.OWNER_PHONE_NUMBER || '').replace(/\D/g, '').slice(-10);
  if (ownerDigits.length === 10) who.set(ownerDigits, 'After-hours (Owner)');
  if (!who.has('0000000000')) who.set('0000000000', 'After-hours (Owner)');
  const routed = await Promise.all((lines || []).map(async l => {
    let r; try { r = await routeNow(db, l); } catch (e) { r = { rings: null, reason: 'error' }; }
    const d10 = String(r.rings || '').replace(/\D/g, '').slice(-10);
    return {
      line: String(l.label || '').replace(/^This call is from\s*/i, '').replace(/\.$/, '') || l.phone,
      brand: (bizBySlug.get(l.business_slug) || {}).name || l.business_slug,
      business_slug: l.business_slug, number: l.phone, team: l.route_team || null,
      tz: l.hours_timezone || null, hours: l.hours_start != null && l.hours_end != null ? [Number(l.hours_start), Number(l.hours_end)] : null,
      rings: r.rings ? { name: who.get(d10) || null, number: r.rings } : null, reason: r.reason,
    };
  }));
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [{ data: bk }, { data: cl }, { data: areas }] = await Promise.all([
      db.from('bookings').select('id, business_id, service_area_id, status').gte('created_at', since).neq('status', 'cancelled').limit(5000),
      db.from('calls').select('grasshopper_number, booking_id').gte('occurred_at', since).not('booking_id', 'is', null).limit(5000),
      db.from('service_areas').select('id, name'),
    ]);
    const areaName = new Map((areas || []).map(a => [a.id, String(a.name || '').toLowerCase()]));
    const bizIdBySlug = new Map([...bizBySlug.entries()].map(([k, v]) => [k, v.id]));
    const d10 = v => String(v || '').replace(/\D/g, '').slice(-10);
    const byNum = new Map();
    for (const c of (cl || [])) { const k = d10(c.grasshopper_number); if (!byNum.has(k)) byNum.set(k, new Set()); byNum.get(k).add(c.booking_id); }
    const multiCity = new Set(['tidyhaus', 'doms']);
    for (const r of routed) {
      const ids = new Set(byNum.get(d10(r.number)) || []);
      const bid = bizIdBySlug.get(r.business_slug), label = String(r.line || '').toLowerCase();
      for (const b of (bk || [])) {
        if (b.business_id !== bid) continue;
        if (multiCity.has(r.business_slug)) { const a = areaName.get(b.service_area_id) || ''; const city = a.split(/[\s-]/)[0]; if (!a || !label.includes(a) && !(city && label.includes(city))) continue; }
        ids.add(b.id);
      }
      r.jobs30 = ids.size;
    }
  } catch (_) { /* counts are optional */ }
  routed.sort((a, b) => ((b.jobs30 > 0) - (a.jobs30 > 0)) || String(a.line).localeCompare(String(b.line)));
  return res.status(200).json({ now: new Date().toISOString(), today, people, lines: routed });
}

async function secretaryWeekSet(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const name = String((body && body.name) || '').trim();
  const day = Number(body && body.day);
  const group = body && body.group ? String(body.group) : null;
  if (!name || isAllCoverage(name) || !(day >= 0 && day <= 6)) return res.status(400).json({ error: 'Bad request' });
  if (group && !['doms', 'tidyhaus'].includes(group)) return res.status(400).json({ error: 'Bad group' });
  const { data: rows, error: rErr } = await db.from('staff_schedules').select('*').eq('name', name);
  if (rErr) throw rErr;
  if (!(rows || []).length) return res.status(400).json({ error: 'No weekly schedule for this person' });
  if (group) {
    const t = rows.find(r => Number(r.day_of_week) === day) || rows[0];
    const { error } = await db.from('staff_schedules').upsert({ name, day_of_week: day, business_slug: group, start_time: t.start_time, end_time: t.end_time, timezone: t.timezone, phone: t.phone, priority: t.priority, updated_at: new Date().toISOString() }, { onConflict: 'name,day_of_week' });
    if (error) throw error;
  } else {
    if (rows.length === 1 && Number(rows[0].day_of_week) === day) return res.status(400).json({ error: 'Keep at least one working day' });
    const { error } = await db.from('staff_schedules').delete().eq('name', name).eq('day_of_week', day);
    if (error) throw error;
  }
  await loadCoverageOverrides(db, true);
  console.log(`[week] ${name} day ${day} -> ${group || 'off'} by ${auth.name || 'owner'}`);
  return res.status(200).json({ ok: true });
}

async function secretaryCoverageSet(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const name = String((body && body.name) || '').trim();
  if (!name || isAllCoverage(name) || name.toLowerCase() === 'jiyah') return res.status(400).json({ error: 'Not editable' });
  const { data: user, error: uErr } = await db.from('staff_users').select('id, business_id').eq('name', name).eq('role', 'secretary').eq('active', true).maybeSingle();
  if (uErr) throw uErr;
  if (!user) return res.status(404).json({ error: 'No such secretary' });
  let value = null;
  if (!body.reset) {
    const { data: bizs, error } = await db.from('businesses').select('id, slug').eq('active', true);
    if (error) throw error;
    const valid = new Set((bizs || []).map(b => b.slug));
    const home = (bizs || []).find(b => b.id === user.business_id)?.slug;
    value = [...new Set((Array.isArray(body.slugs) ? body.slugs : []).map(String))].filter(sl => valid.has(sl) && sl !== home);
  }
  const { error } = await db.from('staff_users').update({ covered_businesses: value }).eq('id', user.id);
  if (error) throw error;
  await loadCoverageOverrides(db, true);
  console.log(`[coverage] ${name} -> ${value === null ? 'default' : value.join(',') || '(home only)'} by ${auth.name || 'owner'}`);
  return res.status(200).json({ ok: true });
}

async function bracketInventory(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }

  const { data: bizes } = await db.from('businesses').select('id, slug').eq('active', true);
  const slugById = new Map((bizes || []).map(b => [b.id, b.slug]));
  const bizIds = (bizes || []).map(b => b.id);

  let { data: inv, error } = await db.from('bracket_inventory')
    .select(`id, business_id, technician_id, flat_qty, tilting_qty, full_motion_qty, wire_plate_qty, appletv_bracket_qty, updated_at,
             technician:technicians ( id, name )`)
    .in('business_id', bizIds);
  if (error && /appletv_bracket_qty/.test(error.message || '')) {
    ({ data: inv, error } = await db.from('bracket_inventory')
      .select(`id, business_id, technician_id, flat_qty, tilting_qty, full_motion_qty, wire_plate_qty, updated_at,
               technician:technicians ( id, name )`)
      .in('business_id', bizIds));
  }
  if (error && /wire_plate_qty/.test(error.message || '')) {
    ({ data: inv, error } = await db.from('bracket_inventory')
      .select(`id, business_id, technician_id, flat_qty, tilting_qty, full_motion_qty, updated_at,
               technician:technicians ( id, name )`)
      .in('business_id', bizIds));
  }
  if (error) throw error;

  let { data: techs } = await db.from('technicians')
    .select('id, name, business_id').in('business_id', bizIds).eq('active', true).order('name');
  const { data: exemptRows } = await db.from('technicians').select('id').eq('skip_inventory', true);
  const exemptIds = new Set((exemptRows || []).map(r => r.id).filter(id => !INVENTORY_SHOW_UNCOUNTED.has(id)));
  if (exemptIds.size) {
    inv = (inv || []).filter(i => !exemptIds.has(i.technician_id));
    techs = (techs || []).filter(t => !exemptIds.has(t.id));
  }

  const invByTech = new Map((inv || []).map(i => [i.technician_id, i]));
  const missing = (techs || []).filter(t => !invByTech.has(t.id));

  if (missing.length) {
    const toInsert = missing.map(t => ({
      business_id: t.business_id,
      technician_id: t.id,
      flat_qty: 0,
      tilting_qty: 0,
      full_motion_qty: 0,
    }));
    await db.from('bracket_inventory').insert(toInsert);
  }

  const final = (inv || []).concat(
    missing.map(t => ({
      id: null,
      business_id: t.business_id,
      technician_id: t.id,
      flat_qty: 0,
      tilting_qty: 0,
      full_motion_qty: 0,
      updated_at: new Date().toISOString(),
      technician: { id: t.id, name: t.name },
    }))
  );

  const plateTrackedBizIds = new Set();
  try {
    const { data: plateRows } = await db.from('wire_plate_purchases')
      .select('business_id').in('business_id', bizIds);
    for (const r of (plateRows || [])) plateTrackedBizIds.add(r.business_id);
  } catch { /* table missing on older deploys → treat as untracked (no false alarms) */ }

  const selfCounts = await lastSelfCounts(db, final.map(i => i.technician_id)).catch(() => new Map());

  return res.status(200).json({
    inventory: final.map(i => ({
      self_count: selfCounts.get(i.technician_id) || null,
      technician_id: i.technician_id,
      technician_name: i.technician?.name || 'Unknown',
      not_counted: INVENTORY_SHOW_UNCOUNTED.has(i.technician_id) || undefined,
      business: slugById.get(i.business_id) || null,
      flat: i.flat_qty || 0,
      tilting: i.tilting_qty || 0,
      full_motion: i.full_motion_qty || 0,
      total: (i.flat_qty || 0) + (i.tilting_qty || 0) + (i.full_motion_qty || 0),
      wire_plate: i.wire_plate_qty || 0,
      wire_plate_tracked: plateTrackedBizIds.has(i.business_id) || (i.wire_plate_qty || 0) > 0,
      appletv_bracket: i.appletv_bracket_qty || 0,
      updated_at: i.updated_at,
    })).sort((a, b) => a.technician_name.localeCompare(b.technician_name)),
  });
}

async function bracketPurchases(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);

  const { data: bizes } = await db.from('businesses').select('id, slug').eq('active', true);
  const slugById = new Map((bizes || []).map(b => [b.id, b.slug]));
  const ids = (bizes || []).map(b => b.id);

  const baseCols = `id, business_id, walmart_order_num, flat_qty, tilting_qty, full_motion_qty, status, order_date, delivered_date, order_url, {TOTAL}{RCV}created_at,
             technician:technicians ( id, name )`;
  let { data: purch, error } = await db.from('bracket_purchases')
    .select(baseCols.replace('{TOTAL}', 'order_total, ').replace('{RCV}', 'received_at, received_by, received_flat, received_tilting, received_full_motion, short_flat, short_tilting, short_full_motion, '))
    .in('business_id', ids).order('created_at', { ascending: false }).limit(limit * 2);
  if (error && /order_total|received_|short_/.test(error.message || '')) {
    ({ data: purch, error } = await db.from('bracket_purchases')
      .select(baseCols.replace('{TOTAL}', '').replace('{RCV}', ''))
      .in('business_id', ids).order('created_at', { ascending: false }).limit(limit * 2));
  }
  if (error) throw error;

  const score = (r) => (r.technician ? 2 : 0) + (r.business_id === biz.id ? 1 : 0);
  const byOrder = new Map();
  for (const p of (purch || [])) {
    const key = p.walmart_order_num || p.id;
    const cur = byOrder.get(key);
    if (!cur || score(p) > score(cur)) byOrder.set(key, p);
  }
  const rows = [...byOrder.values()].slice(0, limit);

  return res.status(200).json({
    purchases: rows.map(p => ({
      id: p.id,
      walmart_order_num: p.walmart_order_num,
      technician_name: p.technician?.name || 'Unassigned',
      business: slugById.get(p.business_id) || null,
      flat_qty: p.flat_qty || 0,
      tilting_qty: p.tilting_qty || 0,
      full_motion_qty: p.full_motion_qty || 0,
      total_qty: (p.flat_qty || 0) + (p.tilting_qty || 0) + (p.full_motion_qty || 0),
      status: p.status,
      order_date: p.order_date,
      delivered_date: p.delivered_date,
      order_url: p.order_url || null,
      order_total: (auth.role === 'owner' && p.order_total != null) ? Number(p.order_total) : null,
      received_at: p.received_at || null,
      received_by: p.received_by || null,
      short_flat: p.short_flat || 0,
      short_tilting: p.short_tilting || 0,
      short_full_motion: p.short_full_motion || 0,
      created_at: p.created_at,
    })),
  });
}

async function creditWirePlateInv(db, businessId, technicianId, delta, ref = {}) {
  if (!delta || !technicianId) return;
  await plateOrderMove(db, {
    businessId, technicianId, delta, orderNum: ref.orderNum || null, platePurchaseId: ref.purchaseId || null,
    reason: ref.reason, actor: ref.actor || 'office',
  });
}

async function wirePlateSetStatus(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change plate order status.' });
  const id = (body.id || '').toString().trim();
  const status = (body.status || '').toString().trim();
  if (!['in_route', 'delivered', 'canceled'].includes(status)) {
    return res.status(400).json({ error: 'status must be in_route, delivered, or canceled' });
  }
  if (!id) return res.status(400).json({ error: 'id required' });

  let hasCredited = true;
  let { data: row, error: rowErr } = await db.from('wire_plate_purchases')
    .select('id, business_id, status, plates, technician_id, credited, amazon_order_num').eq('id', id).maybeSingle();
  if (rowErr && /credited/.test(rowErr.message || '')) {
    hasCredited = false;
    ({ data: row, error: rowErr } = await db.from('wire_plate_purchases')
      .select('id, business_id, status, plates, technician_id, amazon_order_num').eq('id', id).maybeSingle());
  }
  if (rowErr) throw rowErr;
  if (!row) return res.status(404).json({ error: 'Order not found' });

  const wasCredited = hasCredited && !!row.credited;
  if (wasCredited) {
    if (status === 'canceled' && row.status !== 'canceled') {
      await creditWirePlateInv(db, row.business_id, row.technician_id, -(row.plates || 0),
        { orderNum: row.amazon_order_num, purchaseId: row.id, reason: 'Amazon plate order canceled (office)', actor: auth.name || 'owner' });
      await db.from('wire_plate_purchases').update({ status: 'canceled', credited: false }).eq('id', id);
      return res.status(200).json({ ok: true, status: 'canceled', plates_removed: row.plates || 0 });
    }
    const { error } = await db.from('wire_plate_purchases').update({ status }).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true, status });
  }

  const patch = { status, delivered_date: status === 'delivered' ? new Date().toISOString().slice(0, 10) : null };
  let credited = false;
  if (hasCredited && status === 'delivered' && row.technician_id) {
    await creditWirePlateInv(db, row.business_id, row.technician_id, row.plates || 0,
      { orderNum: row.amazon_order_num, purchaseId: row.id, reason: 'Amazon plate delivery (office marked delivered)', actor: auth.name || 'owner' });
    patch.credited = true;
    credited = true;
  }
  const { error } = await db.from('wire_plate_purchases').update(patch).eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true, status, credited });
}

async function bracketReceive(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = (body.id || '').toString().trim();
  if (!id) return res.status(400).json({ error: 'id required' });
  const n = (v) => (v === '' || v == null || !isFinite(Number(v))) ? null : Math.max(0, Math.floor(Number(v)));
  const { data, error } = await db.rpc('bracket_receive', {
    p_purchase_id: id, p_flat: n(body.flat), p_tilting: n(body.tilting), p_full_motion: n(body.full_motion),
    p_actor: 'office:' + (auth.name || auth.role || 'owner'),
  });
  if (error) return res.status(400).json({ error: String(error.message || '').replace(/^bracket_receive: /, '') });
  return res.status(200).json({ ok: true, purchase: Array.isArray(data) ? data[0] : data });
}

async function bracketSetStatus(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can change bracket status.' });
  const orderNum = (body.walmart_order_num || '').toString().trim();
  const id = (body.id || '').toString().trim();
  const status = (body.status || '').toString().trim();
  if (!['in_route', 'delivered', 'canceled', 'returned'].includes(status)) {
    return res.status(400).json({ error: 'status must be in_route, delivered, canceled, or returned' });
  }
  if (!orderNum && !id) return res.status(400).json({ error: 'walmart_order_num or id required' });

  let sel = db.from('bracket_purchases')
    .select('id, business_id, technician_id, status, walmart_order_num, flat_qty, tilting_qty, full_motion_qty');
  sel = orderNum ? sel.eq('walmart_order_num', orderNum) : sel.eq('id', id);
  const { data: rows, error: selErr } = await sel;
  if (selErr) throw selErr;
  if (!rows || !rows.length) return res.status(404).json({ error: 'Order not found' });

  const patch = { status, delivered_date: status === 'delivered' ? new Date().toISOString().slice(0, 10) : null };
  let q = db.from('bracket_purchases').update(patch);
  q = orderNum ? q.eq('walmart_order_num', orderNum) : q.eq('id', id);
  const { error } = await q;
  if (error) throw error;
  return res.status(200).json({ ok: true, status });
}

async function gbpListings(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { data: rows, error } = await db.from('google_reviews')
    .select('location_key, review_date, rating, source_mailbox, created_at').not('location_key', 'is', null);
  if (error) throw error;
  let snaps = [], drops = [];
  try {
    const since = new Date(Date.now() - 3 * 864e5).toISOString();
    const rd = () => db.from('gbp_count_snapshots').select('location_key, place_id, review_count, rating, taken_at').gte('taken_at', since).order('taken_at', { ascending: false });
    ({ data: snaps } = await rd());
    if (req.query.drops_only !== '1' && ((req.query.scan === '1' && auth.role === 'owner') || !(snaps || []).length)) { await runGbpCountWatch(db); ({ data: snaps } = await rd()); }
    ({ data: drops } = await db.from('gbp_count_drops').select('id, location_key, old_count, new_count, removed, detected_at').is('seen_at', null).order('detected_at', { ascending: false }));
  } catch (_) { /* pre-0216 */ }
  if (req.query.drops_only === '1') return res.status(200).json({ open_drops: (drops || []).length });
  let posts = [];
  try { ({ data: posts } = await db.from('gbp_posts').select('location_key, post_id, posted_at, summary, image_url, url').order('posted_at', { ascending: false })); } catch (_) { /* pre-0219 */ }
  const listings = GMB_LOCATIONS.map((l) => {
    const mine = (rows || []).filter((r) => r.location_key === l.key);
    const snap = (snaps || []).find((x) => x.location_key === l.key && (!l.placeId || !x.place_id || x.place_id === l.placeId));
    const since = l.statsVerified ? mine.filter((r) => r.review_date && r.review_date.slice(0, 10) > l.statsVerified) : mine;
    const last = mine.reduce((m, r) => (r.review_date && r.review_date > m ? r.review_date : m), '');
    return {
      key: l.key, name: l.name, display_name: l.displayName, business: l.business, maps_url: l.mapsUrl, phone: l.phone || null,
      rating: l.rating ?? null, review_count: (l.reviewCount || 0) + since.length, new_since_check: since.length,
      checked: l.statsVerified || null, last_review: last || null,
      ...(snap ? { review_count: snap.review_count, rating: snap.rating ?? l.rating ?? null, live_at: snap.taken_at } : {}),
      drops: (drops || []).filter((x) => x.location_key === l.key),
      posts: GBP_POST_KEYS.includes(l.key) ? (posts || []).filter((x) => x.location_key === l.key).slice(0, 3) : null,
    };
  });
  const vSince = new Date(Date.now() - 98 * 864e5).toISOString(), vDay = vSince.slice(0, 10);
  const chi = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const nextDay = (d) => new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const rDay = (r) => { const d = r.review_date.slice(0, 10); return r.created_at && new Date(r.created_at).toISOString().slice(0, 10) === d ? chi(r.created_at) : d; };
  const vel = { added: [], lost: [], from: {}, fromAll: {}, biz: {} };
  const live = {}, pool = {};
  for (const r of rows || []) if (r.source_mailbox && r.review_date) { const d = rDay(r); if (!live[r.location_key] || d < live[r.location_key]) live[r.location_key] = d; }
  const bizSet = new Set(GMB_LOCATIONS.map((l) => l.business));
  try {
    const { data: u, error: ue } = await db.from('google_reviews').select('google_key, review_date, created_at').is('location_key', null).gte('review_date', vDay);
    if (ue) throw ue;
    for (const r of u || []) {
      const b = String(r.google_key || '').split(':')[0];
      if (!r.review_date || !bizSet.has(b)) continue;
      const d = rDay(r), p = pool[b] || (pool[b] = [d, d]);
      if (d < p[0]) p[0] = d;
      if (d > p[1]) p[1] = d;
      vel.added.push({ k: 'biz:' + b, d, n: 1 });
    }
  } catch (_) { /* untagged rows are optional */ }
  for (const b in pool) vel.from['biz:' + b] = vel.fromAll['biz:' + b] = pool[b][0];
  let vs = [], vd = [];
  try {
    const [snapRows, drops98] = await Promise.all([
      fetchAllPages((cols, opts) => db.from('gbp_count_snapshots').select(cols || 'location_key, place_id, review_count, taken_at', opts)
        .gte('taken_at', vSince).order('taken_at', { ascending: true }).order('id', { ascending: true })),
      db.from('gbp_count_drops').select('location_key, old_count, new_count, detected_at').gte('detected_at', vSince),
    ]);
    if (drops98.error) throw drops98.error;
    vs = snapRows; vd = drops98.data || [];
  } catch (_) { /* pre-0216 */ }
  for (const x of vd) vel.lost.push({ k: x.location_key, d: chi(x.detected_at), n: x.old_count - x.new_count });
  for (const l of GMB_LOCATIONS) {
    vel.biz[l.key] = l.business;
    const C = live[l.key] || null, day = {}, at = {};
    for (const x of vs) if (x.location_key === l.key && x.review_count != null && (!l.placeId || !x.place_id || x.place_id === l.placeId)) { const d = chi(x.taken_at); day[d] = x.review_count; at[d] = x.taken_at; }
    const ds = Object.keys(day).sort(), S0 = ds[0] || null;
    for (const r of rows || []) if (r.location_key === l.key && r.review_date && r.review_date >= vDay) {
      const d = rDay(r);
      if (!S0 || d < S0 || (C && d >= C)) vel.added.push({ k: l.key, d, n: 1 });
    }
    for (let i = 1; i < ds.length; i++) {
      const diff = day[ds[i]] - day[ds[i - 1]];
      const mid = chi((Date.parse(at[ds[i - 1]]) + Date.parse(at[ds[i]])) / 2);
      if (diff > 0 && !(C && mid >= C)) vel.added.push({ k: l.key, d: mid, n: diff, s: 1 });
      if (diff < 0 && !vel.lost.some((y) => y.k === l.key && y.d === ds[i])) vel.lost.push({ k: l.key, d: ds[i], n: -diff });
    }
    const S = S0 ? nextDay(S0) : null, p = pool[l.business], viaEmail = C && !(S && S < C);
    const from = viaEmail ? (p && p[1] >= C ? nextDay(p[1]) : C) : S;
    if (from) vel.from[l.key] = from;
    const fa = viaEmail && p && p[0] < from ? p[0] : from;
    if (fa) vel.fromAll[l.key] = fa;
  }
  return res.status(200).json({ listings, vel });
}

const RANK_PINS = { 'ha-greenway': { lat: 29.7311, lng: -95.4339 } };
function rankCompTable(rows, kind) {
  const nameOf = (k) => (GMB_LOCATIONS.find((g) => g.key === k) || {}).name;
  const out = (rows || []).map((r) => {
    const you = (r.you && !/^neverfails/.test(r.you) ? r.you : null) || (kind === 'maps' ? OWN_CID_KEY[r.key] : ownDomainOf(r.key)) || null;
    return { key: r.key, you: !!you, name: kind === 'maps' ? ((you && nameOf(you)) || r.name || '') : (you ? r.key : (r.name || r.key)),
      share: r.n ? Math.round(100 * r.top3 / r.n) : 0, avg_rank: r.avg_rank != null ? Number(r.avg_rank) : null,
      rating: r.rating != null ? Number(r.rating) : null, reviews: r.reviews ?? null, website: kind === 'maps' ? (r.website || null) : r.key };
  });
  const by = (a, b) => b.share - a.share || (a.avg_rank ?? 99) - (b.avg_rank ?? 99);
  return [...out.filter((x) => x.you), ...out.filter((x) => !x.you && x.share > 0).sort(by).slice(0, 15)].sort(by);
}
async function rankCompFallback(db, ids, kind, targets) {
  if (!ids.length) return [];
  const { data } = await db.from('rank_points').select('our_rank, top3').in('scan_id', ids);
  const comp = {};
  for (const p of data || []) {
    for (const c of p.top3 || []) {
      if (!(Number(c.rank) <= 3)) continue;
      if (kind === 'maps' ? (c.cid && OWN_CID_KEY[String(c.cid)]) : ownDomainOf(c.domain)) continue;
      const k = c.cid || c.place_id || c.domain || c.name;
      const e = comp[k] || (comp[k] = { name: c.name, key: k, n: 0, sum: 0, rating: c.rating ?? null, reviews: c.reviews ?? null, website: c.website || c.domain || null });
      e.n++; e.sum += Number(c.rank) || 0; if (!e.website && (c.website || c.domain)) e.website = c.website || c.domain;
    }
    for (const t of targets) {
      const r = (p.our_rank || {})[t]; if (!r || r > 3) continue;
      const k = 'you:' + t; const e = comp[k] || (comp[k] = { name: kind === 'maps' ? ((GMB_LOCATIONS.find((g) => g.key === t) || {}).name || t) : t, key: k, you: true, n: 0, sum: 0, rating: null, reviews: null, website: kind === 'maps' ? null : t });
      const m = ((p.our_rank || {})._meta || {})[t]; if (m) { if (m.rating != null) e.rating = m.rating; if (m.reviews != null) e.reviews = m.reviews; if (m.website) e.website = m.website; }
      e.n++; e.sum += r;
    }
  }
  const denom = (data || []).length;
  return Object.values(comp).map((e) => ({ ...e, share: denom ? Math.round(100 * e.n / denom) : 0, avg_rank: +(e.sum / e.n).toFixed(1) })).sort((a, b) => b.n - a.n).slice(0, 15);
}
async function rankOverview(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const keys = hasKeys();
  const city = RANK_CITIES.find((c) => c.city === req.query.city) || RANK_CITIES[0];
  const kind = req.query.kind === 'organic' ? 'organic' : 'maps';
  const kw = keywordsFor(city).includes(req.query.keyword) ? req.query.keyword : keywordsFor(city)[0];
  let collect = null;
  if (keys && req.query.collect === '1') { try { collect = await collectPending(db, 8000); } catch (e) { collect = { error: String(e.message || e) }; } }
  const [stQ, scQ, spQ] = await Promise.all([
    db.from('rank_settings').select('weekly_enabled').eq('id', 1).maybeSingle(),
    db.from('rank_scans').select('id, run_at, keyword, kind, cost, status, points_total, points_done, dry').eq('city', city.city).order('run_at', { ascending: false }).limit(120),
    db.rpc('rank_spend').then((r) => r, () => ({ error: true })),
  ]);
  const st = stQ.data;
  let S = scQ.data || [];
  if (S.some((s) => !s.dry && s.status === 'done')) S = S.filter((s) => !s.dry);
  const cities = RANK_CITIES.map((c) => ({ city: c.city, cols: c.cols || 5, rows: c.rows || 5, mi: c.mi || +(3.5 / 1.609344).toFixed(1), keywords: keywordsFor(c),
    listings: c.listings.map((k) => ({ key: k, name: (GMB_LOCATIONS.find((g) => g.key === k) || {}).name || k, domain: siteOf(k), ...(RANK_PINS[k] || {}) })) }));
  const mine = S.filter((s) => s.kind === kind && s.keyword === kw && s.status === 'done').slice(0, 12);
  const ids = mine.map((s) => s.id);
  const latestPerKw = keywordsFor(city).map((k) => S.find((s) => s.kind === kind && s.keyword === k && s.status === 'done')).filter(Boolean);
  const compIds = latestPerKw.map((s) => s.id);
  const latestScan = mine.find((s) => String(s.id) === String(req.query.scan || '')) || mine[0] || null;
  const lightIds = ids.filter((id) => id !== latestScan?.id);
  const [a, b, cq] = await Promise.all([
    lightIds.length ? db.from('rank_points').select('scan_id, idx, our_rank').in('scan_id', lightIds) : { data: [] },
    latestScan ? db.from('rank_points').select('scan_id, idx, lat, lng, our_rank, top3').eq('scan_id', latestScan.id).order('idx') : { data: [] },
    compIds.length ? db.rpc('rank_competitors', { p_scan_ids: compIds }).then((r) => r, () => ({ error: true })) : { data: [] },
  ]);
  const pts = [...(a.data || []), ...(b.data || [])];
  const targets = kind === 'maps' ? city.listings : OUR_DOMAINS;
  const trend = mine.slice().reverse().map((s) => {
    const P = pts.filter((p) => p.scan_id === s.id); const o = { id: s.id, run_at: s.run_at, dry: s.dry };
    for (const t of targets) { const r = P.map((p) => (p.our_rank || {})[t]); o[t] = { avg: P.length ? +(r.reduce((a, x) => a + (x || 21), 0) / P.length).toFixed(1) : null, top3: r.filter((x) => x && x <= 3).length, found: r.filter((x) => x).length, n: P.length }; }
    return o;
  });
  const competitors = (!cq.error && Array.isArray(cq.data)) ? rankCompTable(cq.data, kind) : await rankCompFallback(db, compIds, kind, targets);
  let spent, spentCity;
  if (!spQ.error && Array.isArray(spQ.data)) {
    spent = spQ.data.reduce((x, r) => x + Number(r.usd || 0), 0);
    spentCity = Number((spQ.data.find((r) => r.city === city.city) || {}).usd || 0);
  } else {
    const { data: costs } = await db.from('rank_scans').select('cost').gt('cost', 0);
    spent = (costs || []).reduce((x, r) => x + Number(r.cost || 0), 0);
    spentCity = S.reduce((x, r) => x + Number(r.cost || 0), 0);
  }
  const latest = latestScan;
  return res.status(200).json({
    keys, collect, maps_key: process.env.GOOGLE_MAPS_BROWSER_KEY || null, weekly_enabled: !!st?.weekly_enabled, estimate: costEstimate(), cities, city: city.city, kind, keyword: kw, targets,
    latest: latest ? { ...latest, points: pts.filter((p) => p.scan_id === latest.id) } : null,
    trend, competitors, pending: S.filter((s) => s.status === 'pending').length,
    running: S.filter((s) => s.status === 'pending').map((s) => ({ id: s.id, keyword: s.keyword, kind: s.kind, done: s.points_done, total: s.points_total, run_at: s.run_at })),
    failed: S.filter((s) => s.status === 'error' && Date.now() - new Date(s.run_at) < 864e5).length,
    spent_city: +spentCity.toFixed(2),
    spent: +spent.toFixed(2),
  });
}

async function rankPoint(req, res, db, auth) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const scan = Number(req.query.scan), idx = Number(req.query.idx);
  if (scan && (req.query.idx == null || req.query.idx === '')) {
    const { data, error } = await db.from('rank_points').select('idx, results').eq('scan_id', scan).order('idx');
    if (error) throw error;
    return res.status(200).json({ points: data || [] });
  }
  if (!scan || !(idx >= 0)) return res.status(400).json({ error: 'scan and idx required' });
  const { data } = await db.from('rank_points').select('results').eq('scan_id', scan).eq('idx', idx).maybeSingle();
  return res.status(200).json({ results: data?.results ?? null });
}

async function rankRun(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const which = body?.city === 'all' ? RANK_CITIES.map((c) => c.city) : [body?.city].filter((c) => RANK_CITIES.some((x) => x.city === c));
  if (!which.length) return res.status(400).json({ error: 'city required' });
  if (body?.dry) return res.status(200).json(await dryRun(db, which[0]));
  if (!hasKeys()) return res.status(400).json({ error: 'Add DataForSEO keys in Vercel' });
  const busy = await busyCities(db); const go = which.filter((c) => !busy.includes(c));
  if (!go.length) return res.status(409).json({ error: 'Already running' });
  try { const scans = await postScans(db, go); return res.status(200).json({ ok: true, scans, skipped: which.filter((c) => busy.includes(c)), errors: scans.errors || [] }); }
  catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}

const KW_EVERY_MS = 30 * 864e5;
async function rankKeywords(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const city = RANK_CITIES.find((c) => c.city === (body?.city || req.query.city)) || RANK_CITIES[0];
  const lastRun = async () => (await db.from('rank_kw_runs').select('run_at').eq('city', city.city).eq('kind', 'volume').order('run_at', { ascending: false }).limit(1)).data?.[0]?.run_at || null;
  if (req.method === 'POST' && body?.refresh) {
    if (!hasKeys()) return res.status(400).json({ error: 'Add DataForSEO keys in Vercel' });
    const last = await lastRun();
    if (last && Date.now() - new Date(last) < KW_EVERY_MS) return res.status(409).json({ error: 'Already refreshed this month' });
    const { data: lock } = await db.from('rank_kw_runs').insert({ city: city.city, kind: 'volume' }).select('id').single();
    try {
      const { rows, cost } = await fetchVolumes(city);
      if (rows.length) { const { error } = await db.from('rank_keywords').upsert(rows, { onConflict: 'city,keyword' }); if (error) throw error; }
      await db.from('rank_kw_runs').update({ cost }).eq('id', lock.id);
    } catch (e) { await db.from('rank_kw_runs').delete().eq('id', lock.id); return res.status(502).json({ error: String(e.message || e) }); }
  }
  const seeds = volumeSeeds(city);
  const { data } = await db.from('rank_keywords').select('keyword, search_volume, competition, competition_index, cpc, low_bid, high_bid, fetched_at').eq('city', city.city);
  const rows = (data || []).filter((r) => seeds.includes(r.keyword)).sort((a, b) => (b.search_volume ?? -1) - (a.search_volume ?? -1));
  const last = await lastRun();
  return res.status(200).json({ keys: hasKeys(), city: city.city, cities: RANK_CITIES.map((c) => c.city), rows, missing: seeds.filter((k) => !rows.some((r) => r.keyword === k)),
    last, next: last ? new Date(new Date(last).getTime() + KW_EVERY_MS).toISOString() : null, est: KW_PRICE });
}

async function rankAds(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const city = RANK_CITIES.find((c) => c.city === (body?.city || req.query.city)) || RANK_CITIES[0];
  const latest = async () => (await db.from('rank_ads').select('id, run_at, cost, ads, errors').eq('city', city.city).order('run_at', { ascending: false }).limit(1)).data?.[0] || null;
  if (req.method === 'POST' && body?.run) {
    if (!hasKeys()) return res.status(400).json({ error: 'Add DataForSEO keys in Vercel' });
    const prev = await latest();
    if (prev && Date.now() - new Date(prev.run_at) < 10 * 60e3) return res.status(409).json({ error: 'Ran under 10 min ago' });
    const { data: row, error: ie } = await db.from('rank_ads').insert({ city: city.city }).select('id').single();
    if (ie) throw ie;
    const r = await fetchAds(city);
    if (!r.ads.length && r.errors.length === adKeywordsFor(city).length) { await db.from('rank_ads').delete().eq('id', row.id); return res.status(502).json({ error: r.errors[0] }); }
    await db.from('rank_ads').update({ ads: r.ads, errors: r.errors.length ? r.errors : null, cost: r.cost }).eq('id', row.id);
  }
  const L = await latest();
  return res.status(200).json({ keys: hasKeys(), city: city.city, cities: RANK_CITIES.map((c) => c.city), keywords: adKeywordsFor(city), est: adsCost(city), latest: L });
}

async function rankSettings(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const { error } = await db.from('rank_settings').upsert({ id: 1, weekly_enabled: !!body?.weekly_enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function gbpDropSeen(req, res, db, auth, body) {
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
  const id = Number(body?.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await db.from('gbp_count_drops').update({ seen_at: new Date().toISOString(), seen_by: auth.name || 'owner' }).eq('id', id);
  if (error) throw error;
  return res.status(200).json({ ok: true });
}

async function bracketConfirmInfo(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const id = (req.query.id || '').toString();
  if (!id) return res.status(400).json({ error: 'id required' });
  const { data: b } = await db.from('bookings').select('id, technician_id, metadata').eq('id', id).eq('business_id', biz.id).maybeSingle();
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (b.technician_id && await isInventoryExempt(db, b.technician_id)) return res.status(200).json({ tv_count: 0, picks: [] });
  const { data: li } = await db.from('booking_line_items').select('name, quantity').eq('booking_id', id);
  const pf = bracketPrefill(li || [], detectBracketQtys(li || []), b.metadata?.brackets_used);
  const ticketPlates = detectWirePlateQty(li || []);
  const pu = b.metadata?.plates_used;
  pf.plates = (pf.tv_count > 0 || ticketPlates > 0) ? { qty: pu?.confirmed_at ? (Number(pu.qty) || 0) : ticketPlates, ticket: ticketPlates } : null;
  try {
    const { data: c } = await db.from('bookings').select('secondary_technician_id, bracket_supplied_by').eq('id', id).maybeSingle();
    if (pf.tv_count > 0 && c?.secondary_technician_id && b.technician_id) {
      const { data: ts } = await db.from('technicians').select('id, name').in('id', [b.technician_id, c.secondary_technician_id]);
      const nm = (tid) => (ts || []).find(t => t.id === tid)?.name || 'Cleaner';
      pf.techs = [{ id: b.technician_id, name: nm(b.technician_id) }, { id: c.secondary_technician_id, name: nm(c.secondary_technician_id) }];
      pf.supplier = c.bracket_supplied_by || b.technician_id;
    }
  } catch (_) { /* pre-0019/0035: no supplier choice */ }
  return res.status(200).json(pf);
}

async function bracketUpdate(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can edit bracket inventory.' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const bizId = biz.id;

  const techId = (body.technician_id || '').toString();
  const action = (body.action || 'adjust').toString();

  if (!techId) return res.status(400).json({ error: 'technician_id required' });

  const { data: tech } = await db.from('technicians').select('id, business_id').eq('id', techId).single();
  if (!tech) return res.status(404).json({ error: 'Cleaner not found' });
  const techBizId = tech.business_id;

  let { data: inv } = await db.from('bracket_inventory')
    .select('*').eq('technician_id', techId).eq('business_id', techBizId).maybeSingle();

  if (!inv) {
    await db.from('bracket_inventory').insert({
      business_id: techBizId,
      technician_id: techId,
      flat_qty: 0,
      tilting_qty: 0,
      full_motion_qty: 0,
    });
    inv = { flat_qty: 0, tilting_qty: 0, full_motion_qty: 0, wire_plate_qty: 0 };
  }

  const isSet = action === 'set';
  const reasonText = (body.notes || '').toString().trim();
  if (isSet && !reasonText) return res.status(400).json({ error: 'Reason required.' });
  const setVal = (v) => (v == null || v === '') ? null : Math.max(0, Math.round(Number(v) || 0));
  const flat = isSet ? setVal(body.flat) : (inv.flat_qty || 0) + (body.flat_delta || 0);
  const tilting = isSet ? setVal(body.tilting) : (inv.tilting_qty || 0) + (body.tilting_delta || 0);
  const fullMotion = isSet ? setVal(body.full_motion) : (inv.full_motion_qty || 0) + (body.full_motion_delta || 0);
  if (isSet && flat == null && tilting == null && fullMotion == null && !(body.wire_plate != null && body.wire_plate !== '') && !body.wire_plate_delta) return res.status(400).json({ error: 'Enter at least one count.' });
  const plateSet = isSet && body.wire_plate != null && body.wire_plate !== '' ? Math.max(0, Math.round(Number(body.wire_plate) || 0)) : null;
  const wantsWirePlate = plateSet != null || (body.wire_plate_delta != null && body.wire_plate_delta !== 0);
  const hasWirePlateCol = Object.prototype.hasOwnProperty.call(inv, 'wire_plate_qty');
  const wirePlate = plateSet != null ? plateSet : (inv.wire_plate_qty || 0) + (body.wire_plate_delta || 0);

  const wantsAppleTv = body.appletv_bracket_delta != null && body.appletv_bracket_delta !== 0;
  const hasAppleTvCol = Object.prototype.hasOwnProperty.call(inv, 'appletv_bracket_qty');
  const appleTv = (inv.appletv_bracket_qty || 0) + (body.appletv_bracket_delta || 0);

  if (flat < 0 || tilting < 0 || fullMotion < 0 || (wantsWirePlate && wirePlate < 0) || (wantsAppleTv && appleTv < 0)) {
    return res.status(400).json({ error: 'Insufficient inventory for this operation' });
  }

  const actor = auth.name || auth.role || 'owner';
  if (isSet && (flat != null || tilting != null || fullMotion != null)) {
    await ledgerRecount(db, {
      businessId: techBizId, technicianId: techId,
      flat, tilting, fullMotion,
      reason: `office recount: ${reasonText}`, actor,
    });
  } else if (!isSet) {
    await ledgerAdjust(db, {
      businessId: techBizId, technicianId: techId,
      deltaQtys: { flat: body.flat_delta || 0, tilting: body.tilting_delta || 0, full_motion: body.full_motion_delta || 0 },
      bookingId: body.booking_id || null,
      reason: body.notes || (action === 'usage' ? 'manual usage log by office' : 'manual adjustment by office'),
      actor,
    });
  }

  if (wantsWirePlate && hasWirePlateCol) {
    if (plateSet != null) {
      await plateRecount(db, { businessId: techBizId, technicianId: techId, qty: plateSet,
        reason: `office recount: ${reasonText || 'plate count'} (plates ${inv.wire_plate_qty || 0}>${plateSet})`, actor });
    } else {
      await plateAdjust(db, { businessId: techBizId, technicianId: techId, delta: body.wire_plate_delta || 0,
        bookingId: body.booking_id || null,
        reason: body.notes || (action === 'usage' ? 'manual usage log by office' : (isSet ? `office recount: ${reasonText}` : 'manual adjustment by office')), actor });
    }
  }
  const patch = {};
  if (wantsAppleTv && hasAppleTvCol) patch.appletv_bracket_qty = appleTv;
  if (Object.keys(patch).length) {
    const { error: e1 } = await db.from('bracket_inventory').update(patch)
      .eq('technician_id', techId).eq('business_id', techBizId);
    if (e1) throw e1;
  }

  if ((action === 'set' || action === 'adjust') && (wantsAppleTv && hasAppleTvCol && (inv.appletv_bracket_qty || 0) !== appleTv)) {
    try {
      const changes = [];
      if (wantsAppleTv && hasAppleTvCol && (inv.appletv_bracket_qty || 0) !== appleTv) changes.push(`appletv ${inv.appletv_bracket_qty || 0}→${appleTv}`);
      await db.from('bracket_usage_logs').insert({
        business_id: techBizId, booking_id: body.booking_id || null, technician_id: techId,
        logged_by_kind: 'admin',
        notes: `manual ${action} by office: ${changes.join(', ')}${body.notes ? ` — ${body.notes}` : ''}`,
      });
    } catch (e) { console.error('[bracket] manual-change log failed:', e.message); }
  }

  if (action === 'usage' && wantsAppleTv) {
    const log = {
      business_id: techBizId,
      booking_id: body.booking_id || null,
      technician_id: techId,
      flat_used: 0, tilting_used: 0, full_motion_used: 0,
      logged_by_kind: 'admin',
      notes: body.notes || null,
    };
    if (wantsAppleTv && hasAppleTvCol) log.appletv_bracket_used = Math.abs(body.appletv_bracket_delta || 0);
    await db.from('bracket_usage_logs').insert(log);
  }

  if (wantsAppleTv && hasAppleTvCol && action !== 'usage' && body.appletv_bracket_delta > 0) {
    try {
      await db.from('appletv_bracket_log').insert({
        business_id: techBizId, technician_id: techId,
        qty: body.appletv_bracket_delta, added_by: auth.name || auth.role || 'owner',
        notes: body.notes || null,
      });
    } catch (e) { console.error('[appletv_bracket] arrival log failed:', e.message); }
  }

  const { data: freshInv } = await db.from('bracket_inventory')
    .select('flat_qty, tilting_qty, full_motion_qty, wire_plate_qty, appletv_bracket_qty')
    .eq('technician_id', techId).eq('business_id', techBizId).maybeSingle();
  const outFlat = freshInv ? (freshInv.flat_qty || 0) : (flat || 0);
  const outTilting = freshInv ? (freshInv.tilting_qty || 0) : (tilting || 0);
  const outFullMotion = freshInv ? (freshInv.full_motion_qty || 0) : (fullMotion || 0);
  return res.status(200).json({
    ok: true,
    inventory: {
      flat_qty: outFlat,
      tilting_qty: outTilting,
      full_motion_qty: outFullMotion,
      wire_plate_qty: hasWirePlateCol ? (freshInv ? (freshInv.wire_plate_qty || 0) : wirePlate) : 0,
      appletv_bracket_qty: hasAppleTvCol ? (freshInv ? (freshInv.appletv_bracket_qty || 0) : appleTv) : 0,
      total: outFlat + outTilting + outFullMotion,
    },
  });
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
      logged_by_kind: 'admin', notes: 'Apple TV installation, mounting bracket included',
    });
  } catch (_) { /* usage log is best-effort */ }
}

async function bracketParseEmail(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can record bracket orders.' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const bizId = biz.id;

  const emailBody = (body.email_body || '').toString().trim();
  const techName = (body.technician_name || '').toString().trim();
  const walmartOrderNum = (body.walmart_order_num || '').toString().trim();
  const flatQty = parseInt(body.flat_qty) || 0;
  const tiltingQty = parseInt(body.tilting_qty) || 0;
  const fullMotionQty = parseInt(body.full_motion_qty) || 0;

  if (!techName) return res.status(400).json({ error: 'technician_name required' });
  if (!walmartOrderNum && !emailBody) return res.status(400).json({ error: 'walmart_order_num or email_body required' });

  const { data: techs } = await db.from('technicians')
    .select('id, name').eq('business_id', bizId).eq('active', true);

  const tech = (techs || []).find(t => t.name.toLowerCase().includes(techName.toLowerCase()));
  if (!tech) return res.status(404).json({ error: `Cleaner "${techName}" not found` });

  let existing = null;
  if (walmartOrderNum) {
    const { data: e } = await db.from('bracket_purchases')
      .select('id, status').eq('walmart_order_num', walmartOrderNum).eq('business_id', bizId).maybeSingle();
    existing = e;
  }

  let orderDate = new Date().toISOString().slice(0, 10);
  const dateMatch = emailBody.match(/order\s+(?:number|#|date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) {
    const parts = dateMatch[1].split(/[\/\-]/);
    const m = parseInt(parts[0]);
    const d = parseInt(parts[1]);
    const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
    orderDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const totalQty = flatQty + tiltingQty + fullMotionQty;
  if (totalQty <= 0) return res.status(400).json({ error: 'At least one bracket qty required' });

  let result;
  if (existing) {
    const { error: e } = await db.from('bracket_purchases').update({
      flat_qty: flatQty,
      tilting_qty: tiltingQty,
      full_motion_qty: fullMotionQty,
    }).eq('id', existing.id);
    if (e) throw e;
    result = { id: existing.id, action: 'updated' };
  } else {
    const { data: p, error: e } = await db.from('bracket_purchases').insert({
      business_id: bizId,
      technician_id: tech.id,
      walmart_order_num: walmartOrderNum || `manual-${Date.now()}`,
      flat_qty: flatQty,
      tilting_qty: tiltingQty,
      full_motion_qty: fullMotionQty,
      order_date: orderDate,
    }).select('id').single();
    if (e) throw e;
    result = { id: p.id, action: 'created' };
  }

  return res.status(200).json({
    ok: true,
    purchase: result,
    inventory_updated: null,
    note: 'Order recorded. Brackets are credited when the order is marked delivered.',
    ordered: {
      flat: flatQty,
      tilting: tiltingQty,
      full_motion: fullMotionQty,
      total: totalQty,
    },
  });
}

async function bracketPending(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const bizId = biz.id;

  const { data: pending, error } = await db.from('bracket_purchases')
    .select('id, walmart_order_num, flat_qty, tilting_qty, full_motion_qty, status, order_date, delivered_date, order_url, created_at')
    .eq('business_id', bizId)
    .is('technician_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return res.status(200).json({
    pending: (pending || []).map(p => ({
      id: p.id,
      walmart_order_num: p.walmart_order_num,
      flat: p.flat_qty || 0,
      tilting: p.tilting_qty || 0,
      full_motion: p.full_motion_qty || 0,
      total: (p.flat_qty || 0) + (p.tilting_qty || 0) + (p.full_motion_qty || 0),
      status: p.status || 'in_route',
      order_date: p.order_date,
      delivered_date: p.delivered_date,
      order_url: p.order_url || null,
      created_at: p.created_at,
    })),
  });
}

async function bracketAssign(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can assign brackets.' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const bizId = biz.id;

  const purchaseId = (body.purchase_id || '').toString().trim();
  const techId = (body.technician_id || '').toString().trim();
  if (!purchaseId || !techId) return res.status(400).json({ error: 'purchase_id and technician_id required' });

  const { data: purchase } = await db.from('bracket_purchases')
    .select('id, flat_qty, tilting_qty, full_motion_qty, technician_id, walmart_order_num, status')
    .eq('id', purchaseId).eq('business_id', bizId).maybeSingle();
  if (!purchase) return res.status(404).json({ error: 'Delivery not found' });
  if (purchase.technician_id) return res.status(400).json({ error: 'This delivery is already assigned.' });

  const { data: tech } = await db.from('technicians')
    .select('id, name, business_id').eq('id', techId).eq('active', true).maybeSingle();
  if (!tech) return res.status(404).json({ error: 'Cleaner not found' });
  const techBizId = tech.business_id;

  const flat = purchase.flat_qty || 0;
  const tilting = purchase.tilting_qty || 0;
  const full_motion = purchase.full_motion_qty || 0;

  const { error: stampErr } = await db.from('bracket_purchases')
    .update({ technician_id: techId })
    .eq('id', purchaseId);
  if (stampErr) throw stampErr;

  if (purchase.walmart_order_num) {
    await db.from('bracket_purchases')
      .delete()
      .eq('walmart_order_num', purchase.walmart_order_num)
      .is('technician_id', null)
      .neq('business_id', bizId);
  }

  const credited = false;

  return res.status(200).json({
    ok: true,
    technician_name: tech.name,
    reserved: !credited,
    assigned: { flat, tilting, full_motion, total: flat + tilting + full_motion },
  });
}

async function wirePlatePending(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const { data: pending, error } = await db.from('wire_plate_purchases')
    .select('id, amazon_order_num, units, plates, status, order_date, delivered_date, order_url, created_at')
    .eq('business_id', biz.id)
    .is('technician_id', null)
    .order('created_at', { ascending: false });
  if (error) {
    if (/wire_plate_purchases/.test(error.message || '')) return res.status(200).json({ pending: [] });
    throw error;
  }
  return res.status(200).json({
    pending: (pending || []).map(p => ({
      id: p.id,
      amazon_order_num: p.amazon_order_num,
      units: p.units || 0,
      plates: p.plates || 0,
      status: p.status || 'in_route',
      order_date: p.order_date,
      delivered_date: p.delivered_date,
      order_url: p.order_url || null,
      created_at: p.created_at,
    })),
  });
}

async function wirePlateOrders(req, res, db, auth) {
  let biz; try { biz = await resolveBusiness(db, auth, req.query.business); } catch (e) { return bail(res, e); }
  const limit = Math.min(parseInt(req.query.limit) || 30, 500);

  const { data: bizes } = await db.from('businesses').select('id, slug').eq('active', true);
  const ids = (bizes || []).map(b => b.id);

  const cols = 'id, business_id, amazon_order_num, units, plates, status, order_date, delivered_date, order_url, created_at, technician:technicians ( id, name )';
  let { data: rows, error } = await db.from('wire_plate_purchases')
    .select(cols + ', credited').in('business_id', ids)
    .order('created_at', { ascending: false }).limit(limit * 2);
  if (error && /credited/.test(error.message || '')) {
    ({ data: rows, error } = await db.from('wire_plate_purchases')
      .select(cols).in('business_id', ids)
      .order('created_at', { ascending: false }).limit(limit * 2));
  }
  if (error) {
    if (/wire_plate_purchases/.test(error.message || '')) return res.status(200).json({ orders: [] });
    throw error;
  }

  const score = (r) => (r.technician ? 2 : 0) + (r.business_id === biz.id ? 1 : 0);
  const byOrder = new Map();
  for (const r of (rows || [])) {
    const key = r.amazon_order_num || r.id;
    const cur = byOrder.get(key);
    if (!cur || score(r) > score(cur)) byOrder.set(key, r);
  }
  const list = [...byOrder.values()].slice(0, limit);

  return res.status(200).json({
    orders: list.map(p => ({
      id: p.id,
      amazon_order_num: p.amazon_order_num,
      units: p.units || 0,
      plates: p.plates || 0,
      status: p.status || 'in_route',
      credited: !!p.credited,
      technician_name: p.technician?.name || null,
      technician_id: p.technician?.id || null,
      order_date: p.order_date,
      delivered_date: p.delivered_date,
      order_url: p.order_url || null,
      created_at: p.created_at,
    })),
  });
}

async function wirePlateAssign(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can assign plates.' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }
  const bizId = biz.id;

  const purchaseId = (body.purchase_id || '').toString().trim();
  const techId = (body.technician_id || '').toString().trim();
  if (!purchaseId || !techId) return res.status(400).json({ error: 'purchase_id and technician_id required' });

  let hasCredited = true;
  let { data: purchase, error: pErr } = await db.from('wire_plate_purchases')
    .select('id, plates, status, technician_id, amazon_order_num, credited')
    .eq('id', purchaseId).eq('business_id', bizId).maybeSingle();
  if (pErr && /credited/.test(pErr.message || '')) {
    hasCredited = false;
    ({ data: purchase, error: pErr } = await db.from('wire_plate_purchases')
      .select('id, plates, status, technician_id, amazon_order_num')
      .eq('id', purchaseId).eq('business_id', bizId).maybeSingle());
  }
  if (pErr && /wire_plate_purchases/.test(pErr.message || '')) {
    return res.status(400).json({ error: "Plate tracking isn't set up yet (run migration 0040)." });
  }
  if (!purchase) return res.status(404).json({ error: 'Delivery not found' });
  if (purchase.technician_id) return res.status(400).json({ error: 'This order is already assigned.' });

  const { data: tech } = await db.from('technicians')
    .select('id, name, business_id').eq('id', techId).eq('active', true).maybeSingle();
  if (!tech) return res.status(404).json({ error: 'Cleaner not found' });
  const techBizId = tech.business_id;

  const plates = purchase.plates || 0;
  const credit = hasCredited && (purchase.status === 'delivered');

  const stamp = { technician_id: techId };
  if (credit) stamp.credited = true;
  const { error: stampErr } = await db.from('wire_plate_purchases').update(stamp).eq('id', purchaseId);
  if (stampErr) throw stampErr;

  if (purchase.amazon_order_num) {
    await db.from('wire_plate_purchases')
      .delete()
      .eq('amazon_order_num', purchase.amazon_order_num)
      .is('technician_id', null)
      .neq('business_id', bizId);
  }

  if (credit) {
    await creditWirePlateInv(db, techBizId, techId, plates,
      { orderNum: purchase.amazon_order_num, purchaseId, reason: 'Amazon plate delivery (assigned)', actor: auth.name || 'owner' });
  }

  return res.status(200).json({
    ok: true,
    technician_name: tech.name,
    reserved: !credit,
    credited: credit,
    status: purchase.status,
    assigned: { plates: credit ? plates : 0 },
  });
}

async function wirePlateRemove(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner') return res.status(403).json({ error: 'Only the owner can remove orders.' });
  let biz; try { biz = await resolveBusiness(db, auth, body.business); } catch (e) { return bail(res, e); }

  const purchaseId = (body.purchase_id || '').toString().trim();
  const orderNum   = (body.amazon_order_num || '').toString().trim();
  if (!purchaseId && !orderNum) return res.status(400).json({ error: 'purchase_id or amazon_order_num required' });

  const cols = (withCredited) => `id, business_id, technician_id, plates, amazon_order_num${withCredited ? ', credited' : ''}`;
  let hasCredited = true;
  let on = orderNum;
  if (!on && purchaseId) {
    const { data: one } = await db.from('wire_plate_purchases').select('amazon_order_num').eq('id', purchaseId).maybeSingle();
    on = one?.amazon_order_num || '';
  }

  const fetchRows = async () => {
    let q = db.from('wire_plate_purchases').select(cols(hasCredited));
    q = on ? q.eq('amazon_order_num', on) : q.eq('id', purchaseId);
    return q;
  };
  let { data: rows, error } = await fetchRows();
  if (error && /credited/.test(error.message || '')) { hasCredited = false; ({ data: rows, error } = await fetchRows()); }
  if (error && /wire_plate_purchases/.test(error.message || '')) return res.status(400).json({ error: "Plate tracking isn't set up yet." });
  if (error) throw error;
  if (!rows || !rows.length) return res.status(404).json({ error: 'Order not found' });

  let removed = 0;
  for (const r of rows) {
    if (hasCredited && r.credited && r.technician_id && (r.plates || 0) > 0) {
      await creditWirePlateInv(db, r.business_id, r.technician_id, -(r.plates || 0),
        { orderNum: r.amazon_order_num, purchaseId: r.id, reason: 'Amazon plate order removed (office)', actor: auth.name || 'owner' });
    }
    const { error: delErr } = await db.from('wire_plate_purchases').delete().eq('id', r.id);
    if (!delErr) removed++;
  }
  if (on) {
    const { error: ignoreErr } = await db.from('wire_plate_ignored_orders')
      .upsert({ amazon_order_num: on }, { onConflict: 'amazon_order_num' });
    if (ignoreErr) console.warn('[wire_plate_remove] failed to record ignore for', on, ignoreErr.message);
  }
  return res.status(200).json({ ok: true, removed, amazon_order_num: on || null });
}


const MESSAGES_SCAN_LIMIT = 1000;

async function businessForOurPhone(db, auth, ourPhoneRaw, customerPhoneRaw) {
  const ourPhone = digitsOf(ourPhoneRaw);
  if (!ourPhone) { const e = new Error('our number is required'); e.status = 400; throw e; }
  const { data: line } = await db.from('tracking_numbers')
    .select('phone, business_slug, label').eq('phone', ourPhone).maybeSingle();
  if (!line || !line.business_slug) {
    const viewerSlugs = allowedSlugsFor(auth);
    if (viewerSlugs !== null) {
      const customerPhone = digitsOf(customerPhoneRaw);
      const guess = customerPhone && (await brandForUnmappedTexters(db, [customerPhone], await businessesById(db))).get(customerPhone);
      if (!guess || !viewerSlugs.includes(guess.slug)) {
        const e = new Error('That number is not one of ours'); e.status = 404; throw e;
      }
      const biz = await resolveBusiness(db, auth, guess.slug);
      return { biz, ourPhone, label: (line && line.label) || null, guessed: true };
    }
    return { biz: null, ourPhone, label: (line && line.label) || null };
  }
  const biz = await resolveBusiness(db, auth, line.business_slug);
  return { biz, ourPhone, label: line.label || null };
}

function isNotifyLine(ourPhone) {
  const d10 = (v) => { const d = digitsOf(v || ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; };
  const o = d10(ourPhone);
  if (!o) return false;
  return o === d10(process.env.TWILIO_PHONE_NUMBER) || o === '0000000000';
}

const BRAND_SOURCE_LABEL = {
  booking: 'their latest booking',
  estimate: 'their estimate',
  call: 'they called that brand',
};

async function brandForUnmappedTexters(db, phones, bizById) {
  const out = new Map();
  if (!phones.length) return out;
  const cands = new Map(phones.map(p => [p, []]));
  const push = (p, c) => { if (cands.has(p) && c.business_id) cands.get(p).push(c); };

  const { data: custs } = await db.from('customers')
    .select('id, phone, name, business_id').in('phone', phones);
  const custById = new Map((custs || []).map(c => [c.id, c]));
  if (custById.size) {
    const { data: bks } = await db.from('bookings')
      .select('customer_id, business_id, created_at')
      .in('customer_id', [...custById.keys()])
      .order('created_at', { ascending: false }).limit(500);
    for (const b of (bks || [])) {
      const c = custById.get(b.customer_id);
      if (c) push(c.phone, { business_id: b.business_id, at: b.created_at, source: 'booking', name: c.name });
    }
  }

  const estForms = phones.flatMap(p => [p, prettyPhone(p), `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`, `+1${p}`]);
  const { data: ests } = await db.from('estimates')
    .select('customer_phone, customer_name, business_id, created_at')
    .in('customer_phone', estForms)
    .order('created_at', { ascending: false }).limit(500);
  for (const e of (ests || [])) {
    push(digitsOf(e.customer_phone), { business_id: e.business_id, at: e.created_at, source: 'estimate', name: e.customer_name });
  }

  const { data: calls } = await db.from('calls')
    .select('caller_phone, business_id, created_at')
    .in('caller_phone', phones).not('business_id', 'is', null)
    .order('created_at', { ascending: false }).limit(500);
  const callBy = new Map();
  for (const c of (calls || [])) {
    const p = digitsOf(c.caller_phone);
    if (!callBy.has(p)) callBy.set(p, { business_id: c.business_id, at: c.created_at, source: 'call', name: null });
  }

  for (const p of phones) {
    const list = cands.get(p).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const best = list[0] || callBy.get(p);
    if (!best) continue;
    const biz = bizById.get(best.business_id);
    if (!biz) continue;
    const sameBrand = list.find(c => c.business_id === best.business_id && c.name && /[a-z]/i.test(c.name));
    const others = [...new Set(list.map(c => c.business_id))]
      .filter(id => id !== best.business_id)
      .map(id => (bizById.get(id) || {}).name).filter(Boolean);
    out.set(p, {
      business_id: biz.id, slug: biz.slug, name: biz.name,
      source: best.source, source_label: BRAND_SOURCE_LABEL[best.source] || best.source,
      customer_name: sameBrand ? sameBrand.name : null,
      others,
    });
  }
  return out;
}

async function businessesById(db) {
  const { data } = await db.from('businesses').select('id, slug, name');
  return new Map((data || []).map(b => [b.id, b]));
}

async function messagesList(req, res, db, auth) {
  const viewerSlugs = allowedSlugsFor(auth);
  let q = db.from('messages')
    .select('customer_phone, our_phone, direction, body, created_at, read_at, status, business_id')
    .order('created_at', { ascending: false })
    .limit(MESSAGES_SCAN_LIMIT);

  let viewerBizIds = [];
  if (viewerSlugs) {
    const { data: viewerBiz } = await db.from('businesses').select('id').in('slug', viewerSlugs);
    viewerBizIds = (viewerBiz || []).map(b => b.id);
    if (!viewerBizIds.length) {
      q = q.in('business_id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      q = q.or(`business_id.in.(${viewerBizIds.join(',')}),business_id.is.null`);
    }
  }
  const { data: rows, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const threads = new Map();
  for (const m of (rows || [])) {
    const key = `${m.our_phone}|${m.customer_phone}`;
    let t = threads.get(key);
    if (!t) {
      t = {
        our_phone: m.our_phone,
        our_phone_pretty: prettyPhone(m.our_phone),
        customer_phone: m.customer_phone,
        customer_phone_pretty: prettyPhone(m.customer_phone),
        business_id: m.business_id,
        business_slug: null,
        last_at: m.created_at,
        last_body: m.body || '',
        last_direction: m.direction,
        unread: 0,
        customer_name: null,
        line_label: null,
      };
      threads.set(key, t);
    }
    if (m.direction === 'in' && !m.read_at) t.unread++;
  }
  const list = [...threads.values()];

  const phones = [...new Set(list.map(t => t.customer_phone))];
  const bizIds = [...new Set(list.map(t => t.business_id).filter(Boolean))];
  if (phones.length && bizIds.length) {
    const { data: custs } = await db.from('customers')
      .select('phone, name, business_id').in('phone', phones).in('business_id', bizIds);
    const nameBy = new Map((custs || []).map(c => [c.business_id + '|' + c.phone, c.name]));
    for (const t of list) t.customer_name = nameBy.get(t.business_id + '|' + t.customer_phone) || null;
  }
  const ourPhones = [...new Set(list.map(t => t.our_phone))];
  if (ourPhones.length) {
    const { data: lines } = await db.from('tracking_numbers')
      .select('phone, label, business_slug').in('phone', ourPhones);
    const lineBy = new Map((lines || []).map(l => [l.phone, l]));
    for (const t of list) {
      const l = lineBy.get(t.our_phone);
      t.line_label = l ? l.label : null;
      t.business_slug = l ? l.business_slug : null;
    }
  }

  const bizById = await businessesById(db);
  const bizBySlug = new Map([...bizById.values()].map(b => [b.slug, b]));
  for (const t of list) {
    t.notify_line = isNotifyLine(t.our_phone);
    const b = (t.business_id && bizById.get(t.business_id)) || (t.business_slug && bizBySlug.get(t.business_slug));
    t.business_name = b ? b.name : null;
    if (b) t.business_slug = b.slug;
    t.brand_source = b ? 'line' : null;
  }
  const unmapped = list.filter(t => !t.business_name);
  const guesses = await brandForUnmappedTexters(db, [...new Set(unmapped.map(t => t.customer_phone))], bizById);
  for (const t of unmapped) {
    const g = guesses.get(t.customer_phone);
    if (!g) continue;
    t.business_name = g.name;
    t.business_slug = g.slug;
    t.brand_source = g.source;
    t.brand_source_label = g.source_label;
    t.brand_others = g.others;
    if (!t.customer_name) t.customer_name = g.customer_name;
  }
  const visible = viewerSlugs
    ? list.filter(t => (t.business_id ? viewerBizIds.includes(t.business_id) : (t.business_slug && viewerSlugs.includes(t.business_slug))))
    : list;
  return res.status(200).json({
    threads: visible,
    unread_total: visible.reduce((n, t) => n + t.unread, 0),
    truncated: (rows || []).length >= MESSAGES_SCAN_LIMIT,
  });
}

async function messagesThread(req, res, db, auth) {
  const customer = digitsOf(req.query.customer);
  if (!customer) return res.status(400).json({ error: 'customer is required' });
  let ctx; try { ctx = await businessForOurPhone(db, auth, req.query.our, customer); } catch (e) { return bail(res, e); }

  let cq = db.from('customers').select('id, name').eq('phone', customer);
  if (ctx.biz) cq = cq.eq('business_id', ctx.biz.id); else cq = cq.limit(0);
  const [{ data: rows, error }, { data: c }, bizById] = await Promise.all([
    db.from('messages')
      .select('id, direction, body, created_at, status, error, sent_by, read_at, media_count')
      .eq('our_phone', ctx.ourPhone).eq('customer_phone', customer)
      .order('created_at', { ascending: true }).limit(500),
    cq.limit(1),
    businessesById(db),
  ]);
  if (error) return res.status(500).json({ error: error.message });
  let brand = null;
  if (ctx.biz) {
    const b = bizById.get(ctx.biz.id);
    brand = { slug: ctx.biz.slug, name: b ? b.name : ctx.biz.slug, source: 'line', source_label: null, others: [] };
  } else {
    const g = (await brandForUnmappedTexters(db, [customer], bizById)).get(customer);
    if (g) brand = g;
  }

  return res.status(200).json({
    our_phone: ctx.ourPhone,
    our_phone_pretty: prettyPhone(ctx.ourPhone),
    line_label: ctx.label,
    notify_line: isNotifyLine(ctx.ourPhone),
    business: brand ? brand.slug : null,
    business_name: brand ? brand.name : null,
    brand_source: brand ? brand.source : null,
    brand_source_label: brand ? brand.source_label : null,
    brand_others: brand ? brand.others : [],
    customer_phone: customer,
    customer_phone_pretty: prettyPhone(customer),
    customer_name: (c || [])[0] ? (c || [])[0].name : (brand && brand.customer_name) || null,
    customer_id: (c || [])[0] ? (c || [])[0].id : null,
    messages: rows || [],
  });
}


function lineLabel(row, bizName) {
  const fromLabel = String(row.label || '').replace(/^This call is from\s+/i, '').replace(/\.\s*$/, '').trim();
  return fromLabel || row.display_name || bizName || prettyPhone(row.phone);
}

function phoneIlike(d10) {
  return '%' + d10.slice(0, 3) + '%' + d10.slice(3, 6) + '%' + d10.slice(6) + '%';
}

const NEW_TEXT_HIDDEN = new Set(['0000000000', '0000000000']);

async function messagesNewLines(req, res, db, auth) {
  const allowed = allowedSlugsFor(auth);
  const { data: lines, error } = await db.from('tracking_numbers')
    .select('phone, business_slug, label, display_name, active').eq('active', true);
  if (error) return res.status(500).json({ error: error.message });
  const byId = await businessesById(db);
  const bySlug = new Map([...byId.values()].map((b) => [b.slug, b]));
  const out = [];
  for (const l of lines || []) {
    if (!l.business_slug) continue;
    if (allowed !== null && !allowed.includes(l.business_slug)) continue;
    if (NEW_TEXT_HIDDEN.has(digitsOf(l.phone))) continue;
    const b = bySlug.get(l.business_slug);
    out.push({ phone: digitsOf(l.phone), slug: l.business_slug, company: b ? b.name : l.business_slug, label: lineLabel(l, b && b.name) });
  }
  const since = new Date(Math.max(Date.now() - 60 * 86400000, Date.parse('2026-09-15T00:00:00Z'))).toISOString();
  const { data: sent } = await db.from('messages').select('our_phone, status, error, created_at')
    .eq('direction', 'out').in('our_phone', out.map((l) => l.phone)).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(2000);
  const last = new Map();
  for (const m of sent || []) {
    if (last.has(m.our_phone)) continue;
    if (m.status === 'delivered') last.set(m.our_phone, 'ok');
    else if (/30034|not been registered|unregistered/i.test(m.error || '')) last.set(m.our_phone, 'blocked');
  }
  const MAIN = ['tidyhaus', 'doms'];
  for (const l of out) { l.main = MAIN.includes(l.slug); l.status = last.get(l.phone) || 'untested'; }
  const seen = new Map();
  out.sort((a, b) => (b.main - a.main) || a.label.localeCompare(b.label) || a.phone.localeCompare(b.phone));
  for (const l of out) { const n = (seen.get(l.label) || 0) + 1; seen.set(l.label, n); if (n > 1) l.label += ' (line ' + n + ')'; }
  return res.status(200).json({ lines: out });
}

async function customerOfBusiness(db, biz, d10) {
  const like = phoneIlike(d10);
  const [cust, est, lines] = await Promise.all([
    db.from('customers').select('name, first_name, last_name').eq('business_id', biz.id).ilike('phone', like).limit(1),
    db.from('estimates').select('customer_name').eq('business_id', biz.id).ilike('customer_phone', like).limit(1),
    db.from('tracking_numbers').select('phone').eq('business_slug', biz.slug),
  ]);
  if (cust.error || est.error || lines.error) { const e = new Error("Couldn't check this customer. Try again in a moment."); e.status = 503; throw e; }
  const c = (cust.data || [])[0];
  if (c) return c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || prettyPhone(d10);
  const e1 = (est.data || [])[0];
  if (e1) return e1.customer_name || prettyPhone(d10);
  const ours = (lines.data || []).map((l) => digitsOf(l.phone)).filter(Boolean);
  if (ours.length) {
    const { data: m, error: mErr } = await db.from('messages').select('id')
      .eq('customer_phone', d10).eq('direction', 'in').in('our_phone', ours).limit(1);
    if (mErr) { const e = new Error("Couldn't check this customer. Try again in a moment."); e.status = 503; throw e; }
    if ((m || []).length) return prettyPhone(d10);
  }
  return null;
}

async function messagesNewSearch(req, res, db, auth) {
  let ctx; try { ctx = await businessForOurPhone(db, auth, req.query.our); } catch (e) { return bail(res, e); }
  if (!ctx.biz) return res.status(400).json({ error: 'Pick a company first' });
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(200).json({ results: [] });
  const d = digitsOf(q);
  const found = new Map();
  let newNumber = null;
  const add = (phone, name) => {
    const p = digitsOf(phone); const p10 = p && p.length === 11 && p.startsWith('1') ? p.slice(1) : p;
    if (!p10 || p10.length !== 10 || found.has(p10)) return;
    found.set(p10, (name || '').trim() || prettyPhone(p10));
  };
  if (d && d.length >= 4) {
    const like = '%' + d.split('').join('%') + '%';
    const [c, e] = await Promise.all([
      db.from('customers').select('name, first_name, last_name, phone').eq('business_id', ctx.biz.id).ilike('phone', like).limit(15),
      db.from('estimates').select('customer_name, customer_phone').eq('business_id', ctx.biz.id).ilike('customer_phone', like).limit(15),
    ]);
    for (const r of c.data || []) add(r.phone, r.name || [r.first_name, r.last_name].filter(Boolean).join(' '));
    for (const r of e.data || []) add(r.customer_phone, r.customer_name);
    if (d.length === 10 && !found.has(d)) {
      const name = await customerOfBusiness(db, ctx.biz, d).catch(() => null);
      if (name) add(d, name); else { add(d, prettyPhone(d)); newNumber = d; }
    }
  } else {
    const like = '%' + q.replace(/[%_,()]/g, ' ').trim() + '%';
    const [c, e] = await Promise.all([
      db.from('customers').select('name, first_name, last_name, phone').eq('business_id', ctx.biz.id)
        .or(`name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`).limit(15),
      db.from('estimates').select('customer_name, customer_phone').eq('business_id', ctx.biz.id).ilike('customer_name', like).limit(15),
    ]);
    for (const r of c.data || []) add(r.phone, r.name || [r.first_name, r.last_name].filter(Boolean).join(' '));
    for (const r of e.data || []) add(r.customer_phone, r.customer_name);
  }
  const results = [];
  for (const [phone, name] of found) {
    if (results.length >= 12) break;
    const optedOut = await smsOptOutState(db, phone);
    results.push({ phone, name, pretty: prettyPhone(phone), opted_out: optedOut === true, is_new: phone === newNumber });
  }
  return res.status(200).json({ results });
}

async function messagesSend(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const customer = digitsOf(body.customer);
  const text = (body.text || '').toString().trim();
  if (!customer) return res.status(400).json({ error: 'customer is required' });
  let ctx; try { ctx = await businessForOurPhone(db, auth, body.our, customer); } catch (e) { return bail(res, e); }
  if (isNotifyLine(ctx.ourPhone)) return res.status(409).json({ error: 'No reply number' });
  if (!text) return res.status(400).json({ error: 'Message is empty' });
  if (text.length > 1200) return res.status(400).json({ error: 'Message is too long (1200 characters max)' });

  const pre = await staffTextGate(db, customer, true);
  if (!pre.ok) return gateRefuse(res, pre);
  const { data: inbound, error: inErr } = await db.from('messages').select('id')
    .eq('our_phone', ctx.ourPhone).eq('customer_phone', customer).eq('direction', 'in').limit(1);
  if (inErr) return res.status(503).json({ error: "Couldn't check this conversation. Try again in a moment." });
  if (!(inbound || []).length) {
    let known = null;
    if (body.start === true && ctx.biz) { try { known = await customerOfBusiness(db, ctx.biz, customer); } catch (e) { return bail(res, e); } }
    if (!known && !(await verbalConsentFor(db, customer))) {
      return gateRefuse(res, { ok: false, code: 'no_consent', status: 409, needs_consent: true, phone: phone10(customer), error: 'No text approval yet.' });
    }
  }

  const outText = text;

  const { data: row, error: insErr } = await db.from('messages').insert({
    business_id: ctx.biz ? ctx.biz.id : null,
    customer_phone: customer,
    our_phone: ctx.ourPhone,
    direction: 'out',
    body: outText,
    status: 'queued',
    sent_by: auth.name || adminAuthorName(auth) || null,
  }).select('id').single();
  if (insErr) return res.status(500).json({ error: insErr.message });

  const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const statusCallback = baseUrl
    ? `${baseUrl}/api/analytics?action=sms_status&token=${encodeURIComponent(signToken({ kind: 'message', message_id: row.id }, 86400))}`
    : undefined;

  const r = await sendSMSResult(customer, outText, { from: ctx.ourPhone, statusCallback, raw: true });

  if (!r.ok) {
    const why = r.error || `not sent (${r.skipped})`;
    await db.from('messages').update({ status: 'failed', error: why }).eq('id', row.id);
    if (r.skipped === 'notifications_off') return res.status(503).json({ error: 'Texting is turned off right now.' });
    if (/30034|A2P|not been registered|unregistered/i.test(why)) {
      return res.status(502).json({
        error: `Can't text from ${prettyPhone(ctx.ourPhone)} yet — the phone companies are still approving that number. Give them a call instead for now.`,
        id: row.id,
        pending_a2p: true,
      });
    }
    return res.status(502).json({ error: why, id: row.id });
  }
  await db.from('messages').update({ status: 'sent', twilio_sid: r.sid || null }).eq('id', row.id);
  return res.status(200).json({ ok: true, id: row.id, sid: r.sid || null });
}

async function smsVerbalConsent(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (auth.role !== 'owner' && auth.role !== 'secretary') return res.status(403).json({ error: 'Not available for this login' });
  const p = phone10(body.phone);
  if (p.length !== 10) return res.status(400).json({ error: 'No valid phone number.' });
  const g = await staffTextGate(db, p, true);
  if (!g.ok) return gateRefuse(res, g);
  const { error } = await db.from('sms_verbal_consent').upsert({
    phone: p, method: 'verbal',
    recorded_by: auth.name || adminAuthorName(auth), recorded_role: auth.role,
    recorded_at: new Date().toISOString(),
    business_slug: auth.business_slug || null,
    note: (body.note || '').toString().slice(0, 200) || null,
  }, { onConflict: 'phone' });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, phone: p });
}

async function messagesRead(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let ctx; try { ctx = await businessForOurPhone(db, auth, body.our, body.customer); } catch (e) { return bail(res, e); }
  const customer = digitsOf(body.customer);
  if (!customer) return res.status(400).json({ error: 'customer is required' });
  const { error } = await db.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('our_phone', ctx.ourPhone).eq('customer_phone', customer)
    .eq('direction', 'in').is('read_at', null);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function messagesBlock(req, res, db, auth, body) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let ctx; try { ctx = await businessForOurPhone(db, auth, body.our); } catch (e) { return bail(res, e); }
  const customer = digitsOf(body.customer);
  if (!customer || customer.length !== 10) return res.status(400).json({ error: 'customer is required' });
  const { error } = await db.from('blocked_numbers').upsert({
    phone: customer,
    blocked_by: auth.name || auth.role || 'office',
    reason: (body.reason || '').toString().slice(0, 200) || 'Blocked from Messages',
  }, { onConflict: 'phone', ignoreDuplicates: false });
  if (error) throw error;
  return res.status(200).json({ ok: true, phone: customer });
}

function taskAccess(auth) {
  return auth && (auth.role === 'owner' || (auth.role === 'secretary' && auth.name === 'Joey'));
}
async function secretaryWeekConversion(db, tz) {
      const last7Start = localDayStartUTC(tz, -6);
      const rosterSince = new Date(last7Start.getTime() - 28 * 24 * 60 * 60 * 1000);
      const { data: cRows } = await db.from('calls')
        .select('handled_by, booking_id, resolution, reached_step, reached_extras, occurred_at')
        .eq('kind', 'live')
        .gte('occurred_at', rosterSince.toISOString());
      const by = {};
      for (const c of (cRows || [])) {
        const who = (c.handled_by || '').trim();
        if (!who || /^andrew/i.test(who) || /^unknown$/i.test(who)) continue;
        const p = by[who] || (by[who] = { person: who, calls: 0, booked: 0 });
        if (new Date(c.occurred_at) < last7Start) continue;
        if (!(c.booking_id || c.reached_extras)) continue;
        p.calls++;
        if (c.booking_id || c.resolution === 'booked') p.booked++;
      }
      return Object.values(by)
        .map(p => ({ ...p, conversion: p.calls ? Math.round((p.booked / p.calls) * 1000) / 10 : 0 }))
        .sort((a, b) => b.calls - a.calls);
}
async function joeyMetrics(req, res, db, auth) {
  if (!(auth && auth.role === 'secretary' && auth.name === 'Joey')) return res.status(403).json({ error: 'Not available for this login' });
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dowIn = z => DOW[new Intl.DateTimeFormat('en-US', { timeZone: z, weekday: 'short' }).format(new Date())];
  const [bizRes, ha, doms, tasks, secs] = await Promise.all([
    db.from('businesses').select('id, slug, timezone'),
    (async () => {
      const { data } = await db.from('staff_schedules').select('name, priority')
        .eq('business_slug', 'tidyhaus').eq('day_of_week', dowIn('Asia/Manila'))
        .order('priority', { ascending: true }).order('name', { ascending: true });
      const who = (applyExceptions(data, await exceptionsOn(db, dateIn('Asia/Manila')), 'tidyhaus')[0] || {}).name || 'Owner';
      if (who !== 'Heather') return who;
      const { data: biz } = await db.from('businesses').select('id').eq('slug', 'tidyhaus').maybeSingle();
      if (!biz) return who;
      const { data: ex } = await db.from('secretary_availability_exceptions').select('is_available').eq('business_id', biz.id).eq('exception_date', dateIn('Asia/Manila')).maybeSingle();
      return ex && ex.is_available === false ? 'Owner' : who;
    })(),
    (async () => {
      const { data } = await db.from('staff_schedules').select('name, priority')
        .eq('business_slug', 'doms').eq('day_of_week', dowIn('Asia/Manila'))
        .order('priority', { ascending: true }).order('name', { ascending: true });
      const eff = applyExceptions(data, await exceptionsOn(db, dateIn('Asia/Manila')), 'doms');
      return (eff[0] && eff[0].name) || 'Owner';
    })(),
    db.from('assistant_tasks').select('id', { count: 'exact', head: true }).is('deleted_at', null).is('done_at', null).eq('color', 'red'),
    secretaryWeekConversion(db, 'Asia/Manila').catch(() => []),
  ]);
  let jobs = 0;
  await Promise.all((bizRes.data || []).map(async b => {
    const z = b.timezone || 'Asia/Manila';
    const { data } = await db.from('bookings').select('status').eq('business_id', b.id)
      .gte('scheduled_at', localDayStartUTC(z, 0).toISOString()).lt('scheduled_at', localDayStartUTC(z, 1).toISOString());
    jobs += (data || []).filter(r => r.status !== 'cancelled').length;
  }));
  const list = secs.filter(p => p.person !== 'Joey').map(p => ({ person: p.person, calls: p.calls, booked: p.booked, conversion: p.conversion }));
  for (const n of ['Heather', 'Alex', 'Joe']) if (!list.some(p => p.person === n)) list.push({ person: n, calls: 0, booked: 0, conversion: 0 });
  return res.status(200).json({ covering: { 'tidyhaus': ha, doms }, jobs_today: jobs, urgent_tasks: tasks.count || 0, secretaries: list });
}
const TASK_COLORS = ['red', 'yellow', 'green', 'white'];
async function joeyContact(db) {
  try { const { data } = await db.from('staff_users').select('*').eq('name', 'Joey').eq('active', true).maybeSingle(); return data || {}; }
  catch { return {}; }
}
async function textJoeyTask(db, j, title) {
  try {
    const phone = j.phone || process.env.DOMS_SECRETARY_PHONE || JOEY_MOBILE;
    const r = await sendSMSResult(phone, `Task from Owner: ${String(title).slice(0, 120)}`);
    return !!(r && r.ok);
  } catch (e) { console.warn('[tasks] text failed:', e.message); return false; }
}
async function emailJoeyTask(db, j, title, notes) {
  try {
    const to = j.email || process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid';
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const html = `<p><b>${esc(title)}</b></p>${notes ? `<p style="white-space:pre-wrap">${esc(notes)}</p>` : ''}`;
    const r = await sendEmail({ slug: 'doms', to, subject: `Task from Owner: ${String(title).slice(0, 150)}`, html });
    return !!(r && r.sent);
  } catch (e) { console.warn('[tasks] email failed:', e.message); return false; }
}
async function assistantTasks(req, res, db, auth, body) {
  if (!taskAccess(auth)) return res.status(403).json({ error: 'Not available for this login' });
  const who = auth.name || (auth.role === 'owner' ? 'Owner' : 'Joey');
  if (req.method === 'GET') {
    if (req.query.q != null) {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.status(200).json({ jobs: [] });
      const digits = q.replace(/\D/g, '');
      let cq = db.from('customers').select('id').limit(40);
      cq = digits.length >= 4 ? cq.ilike('phone', `%${digits.slice(-10)}%`) : cq.ilike('name', `%${q.replace(/[%,()]/g, '')}%`);
      const { data: cs } = await cq;
      const ids = (cs || []).map(c => c.id);
      if (!ids.length) return res.status(200).json({ jobs: [] });
      const { data: bks } = await db.from('bookings').select('id, scheduled_at, price, customer:customers(name), business:businesses(slug, name)')
        .in('customer_id', ids).order('scheduled_at', { ascending: false }).limit(10);
      const jobs = (bks || []).map(b => ({ id: b.id, slug: b.business?.slug || null,
        label: `${b.customer?.name || 'Customer'} · ${b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }) : ''}${b.price ? ' · $' + Math.round(Number(b.price)) : ''} · ${b.business?.name || ''}` }));
      return res.status(200).json({ jobs });
    }
    if (req.query.prev != null) {
      if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
      const { data, error } = await db.from('assistant_tasks').select('*').or('done_at.not.is.null,deleted_at.not.is.null').limit(1000);
      if (error) throw error;
      const when = t => String(t.deleted_at || t.done_at || '');
      return res.status(200).json({ prev: (data || []).sort((a, b) => (when(a) < when(b) ? 1 : -1)) });
    }
    const [active, archived] = await Promise.all([
      db.from('assistant_tasks').select('*').is('deleted_at', null).is('done_at', null)
        .order('created_at', { ascending: true }).limit(300),
      db.from('assistant_tasks').select('*').is('deleted_at', null).not('done_at', 'is', null)
        .order('done_at', { ascending: false }).limit(300),
    ]);
    if (active.error) throw active.error;
    if (archived.error) throw archived.error;
    return res.status(200).json({ tasks: [...(active.data || []), ...(archived.data || [])] });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const op = String(body.op || '');
  if (op === 'add') {
    const title = String(body.title || '').trim().slice(0, 300);
    const color = auth.role !== 'owner' ? 'joey' : TASK_COLORS.includes(body.color) ? body.color : null;
    if (!title) return res.status(400).json({ error: 'Write the task first.' });
    if (!color) return res.status(400).json({ error: 'Pick a color.' });
    const row = { title, color, notes: String(body.notes || '').trim().slice(0, 4000) || null, created_by: who, photo_urls: cleanNotePhotos(body.photos) };
    if (body.booking_id && /^[0-9a-f-]{36}$/i.test(String(body.booking_id))) {
      row.booking_id = body.booking_id; row.job_slug = String(body.job_slug || '').slice(0, 60) || null; row.job_label = String(body.job_label || '').slice(0, 200) || null;
    }
    const { data, error } = await db.from('assistant_tasks').insert(row).select('*').maybeSingle();
    if (error) throw error;
    const owner = auth.role === 'owner', wantText = owner && body.text_joey === true, wantEmail = owner && body.email_joey === true;
    const j = (wantText || wantEmail) ? await joeyContact(db) : {};
    const [texted, emailed] = await Promise.all([wantText ? textJoeyTask(db, j, title) : false, wantEmail ? emailJoeyTask(db, j, title, row.notes) : false]);
    return res.status(200).json({ ok: true, task: data, texted, emailed });
  }
  if (op === 'order') {
    if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter(x => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 300);
    await Promise.all(ids.map((tid, i) => db.from('assistant_tasks').update({ sort_order: i }).eq('id', tid)));
    return res.status(200).json({ ok: true });
  }
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'id required' });
  if (op === 'done') {
    const done = !!body.done;
    const { error } = await db.from('assistant_tasks').update(done ? { done_at: new Date().toISOString(), done_by: who, cleared_at: null } : { done_at: null, done_by: null, cleared_at: null }).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'clear') {
    if (auth.role !== 'owner') return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('assistant_tasks').update({ cleared_at: new Date().toISOString() }).eq('id', id).not('done_at', 'is', null);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'notes') {
    const { error } = await db.from('assistant_tasks').update({ notes: String(body.notes || '').slice(0, 4000) || null }).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'title' || op === 'color') {
    if (auth.role !== 'owner') {
      const { data: own } = await db.from('assistant_tasks').select('color').eq('id', id).maybeSingle();
      if (op !== 'title' || !own || own.color !== 'joey') return res.status(403).json({ error: 'Only Owner can change this.' });
    }
    let patch, texted = false;
    if (op === 'title') {
      const title = String(body.title || '').trim().slice(0, 300);
      if (!title) return res.status(400).json({ error: 'Write the task first.' });
      patch = { title };
    } else {
      if (!TASK_COLORS.includes(body.color)) return res.status(400).json({ error: 'Pick a color.' });
      patch = { color: body.color };
    }
    const { data: prev } = await db.from('assistant_tasks').select('title, color').eq('id', id).maybeSingle();
    if (!prev) return res.status(404).json({ error: 'Not found' });
    const already = op === 'color' && prev.color === body.color;
    if (!already) {
      const { error } = await db.from('assistant_tasks').update(patch).eq('id', id);
      if (error) throw error;
    }
    return res.status(200).json({ ok: true, texted, already });
  }
  if (op === 'photos') {
    const { error } = await db.from('assistant_tasks').update({ photo_urls: cleanNotePhotos(body.photos) }).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'delete') {
    const { data: t } = await db.from('assistant_tasks').select('created_by, color').eq('id', id).maybeSingle();
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (auth.role !== 'owner' && t.color !== 'joey') return res.status(403).json({ error: 'Only Owner can delete tasks.' });
    const { error } = await db.from('assistant_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'Unknown op' });
}

