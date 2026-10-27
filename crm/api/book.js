import { capName } from './_lib/name-case.js';
import { mirrorBooking } from './_lib/mirror.js';
import { canonicalizeLineItems } from './_lib/line-items.js';
import { NATIVE_BUSINESS } from './_lib/native-businesses.js';
import { emailNotificationsOn, smsNotificationsOn } from './_lib/notify.js';
import { emailConfig, sendEmail, bookingConfirmationEmail, brandFor } from './_lib/email.js';
import { serviceClient } from './_lib/supabase.js';
import { isBlockedPhone } from './_lib/blocked.js';
import { isScammer } from './_lib/scammer.js';
import { parseSlotId, slotStartUTC, slotEndUTC, pickOpenTech, SLOTS, dayOfWeekFor, minLeadMsFor } from './_lib/availability.js';
import { saveCardOnFile, stripeConfigured, createCardSetupIntent, retrieveCard, setDefaultPaymentMethod, stripe, businessSecretKey } from './_lib/stripe.js';
import { verifyToken } from './_lib/auth.js';
import { expandReviewCode } from './_lib/review-code.js';
import { expandEstimateCode } from './_lib/estimate-code.js';
import { isLikelyStreetAddress, hasDigits } from './_lib/address.js';
import { sendCardSaveFailedAlert, sendUnassignedBookingAlert, maybeSendBigBracketAlert, maybeSendFirstMultiTvDiscountAlert, maybeSendZeroOrLowProfitAlert, maybeSendLeadGenBookingAlert, gdsUpsellUrlFor, rescheduleUrlFor } from './_lib/owner-notify.js';
import { notifyTechAssigned } from './_lib/tech-notify.js';
import { sendEnRouteSms } from './_lib/en-route.js';
import { sendBookingConfirmSms } from './_lib/booking-confirm-sms.js';
import { textConsentFor, sendSMSResult, toE164 } from './_lib/sms.js';
import { officePhoneFor, onDutySecretaryPhones } from './_lib/tech-late.js';

const BAD_ADDRESS = 'Please enter a valid street address (with a house number) — not an email or phone number.';
const BAD_NAME = 'Please enter your name using letters only — no numbers.';

const MIN_TICKET_PRICE = 0;

function zip5(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{5})(?:[-\s]\d{1,4})?$/);
  return m ? m[1] : s;
}

async function persistConfirmationEmailStatus(db, bookingId, status) {
  try {
    await db.from('bookings')
      .update({ confirmation_email_status: status, confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', bookingId);
  } catch (e) { /* migration 0075 not applied yet — status just won't show */ }
}

async function placesAutocompletePublic(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const input = ((req.query || {}).input || '').toString().trim();
  const token = ((req.query || {}).session || '').toString().trim();
  if (!key || input.length < 3) return res.status(200).json({ predictions: [] });
  try {
    const u = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    u.searchParams.set('input', input);
    u.searchParams.set('key', key);
    u.searchParams.set('types', 'address');
    u.searchParams.set('components', 'country:us');
    if (token) u.searchParams.set('sessiontoken', token);
    const j = await (await fetch(u.toString())).json();
    const predictions = (j.predictions || []).slice(0, 5).map(p => ({ description: p.description, place_id: p.place_id }));
    return res.status(200).json({ predictions });
  } catch (e) {
    console.warn('[book] places autocomplete failed:', e.message);
    return res.status(200).json({ predictions: [] });
  }
}
async function placeDetailsPublic(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = ((req.query || {}).place_id || '').toString().trim();
  const token = ((req.query || {}).session || '').toString().trim();
  if (!key || !placeId) return res.status(200).json({ address: null });
  try {
    const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    u.searchParams.set('place_id', placeId);
    u.searchParams.set('key', key);
    u.searchParams.set('fields', 'address_component');
    if (token) u.searchParams.set('sessiontoken', token);
    const j = await (await fetch(u.toString())).json();
    if (j.status !== 'OK') return res.status(200).json({ address: null });
    const comps = j.result?.address_components || [];
    const get = (type, short) => { const c = comps.find(x => (x.types || []).includes(type)); return c ? (short ? c.short_name : c.long_name) : ''; };
    return res.status(200).json({ address: {
      line1: [get('street_number'), get('route')].filter(Boolean).join(' '),
      city:  get('locality') || get('sublocality') || get('postal_town') || '',
      state: get('administrative_area_level_1', true) || '',
      zip:   get('postal_code') || '',
    } });
  } catch (e) {
    console.warn('[book] place details failed:', e.message);
    return res.status(200).json({ address: null });
  }
}
const STRIPE_PK_ENV = {
  'tidyhaus': 'STRIPE_PUBLISHABLE_KEY',
};
async function stripePublicConfig(req, res) {
  const business = ((req.query || {}).business || 'tidyhaus').toString().trim();
  const envName = STRIPE_PK_ENV[business];
  if (!envName) return res.status(400).json({ error: `Unknown business "${business}"` });
  let configured = false;
  try { configured = stripeConfigured({ account: business }); }
  catch (e) { configured = false; }
  let connection = {};
  if (business === 'neverfailstvmounting') {
    const pk = process.env[envName] || '';
    const sk = businessSecretKey({ account: business }) || '';
    const mode = pk.startsWith('pk_test_') ? 'test' : pk.startsWith('pk_live_') ? 'live' : 'missing';
    const matches = mode !== 'missing' && (sk.startsWith('sk_' + mode + '_') || sk.startsWith('rk_' + mode + '_'));
    let verified = false, verification_error = null;
    if (configured && matches) {
      try { const balance = await stripe('/balance', { method: 'GET', account: business }); verified = balance.object === 'balance' && balance.livemode === (mode === 'live'); } catch (error) { verification_error = error.status === 403 ? 'permission_denied' : error.status === 401 ? 'authentication_failed' : 'connection_failed'; }
    }
    configured = configured && matches && verified;
    const clean = sk.trim();
    const secret_key_type = clean.startsWith('sk_test_') ? 'test_secret' : clean.startsWith('sk_live_') ? 'live_secret' : clean.startsWith('rk_test_') ? 'test_restricted' : clean.startsWith('rk_live_') ? 'live_restricted' : clean ? 'unrecognized' : 'missing';
    connection = { mode, key_modes_match: matches, verified, secret_key_type, secret_has_whitespace: clean !== sk, verification_error };
  }
  return res.status(200).json({
    business,
    publishable_key: process.env[envName] || null,
    configured,
    ...connection,
  });
}

async function cardSetupPublic(req, res) {
  const b = req.body || {};
  const business = (b.business || (req.query || {}).business || 'tidyhaus').toString().trim();
  if (!STRIPE_PK_ENV[business]) return res.status(400).json({ error: `Unknown business "${business}"` });
  let configured = false;
  try { configured = stripeConfigured({ account: business }); }
  catch (e) { configured = false; }
  if (!configured) return res.status(200).json({ disabled: true });
  const email = (b.email || '').toString().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  try {
    const r = await createCardSetupIntent({
      email,
      name: (b.name || '').toString().slice(0, 200),
      phone: (b.phone || '').toString().slice(0, 40),
      account: business,
    });
    return res.status(200).json({ client_secret: r.clientSecret, customer_id: r.customerId });
  } catch (e) {
    console.warn('[card-setup] failed, widget will fall back to tokenize-only:', e.message);
    return res.status(200).json({ disabled: true });
  }
}

async function payStatusPublic(req, res) {
  const q = req.query || {};
  const bookingId = (q.booking || '').toString().trim();
  const sessionId = (q.session_id || '').toString().trim();
  if (!bookingId || !sessionId) return res.status(400).json({ error: 'booking and session_id required' });
  const db = serviceClient();
  const { data: b, error } = await db.from('bookings')
    .select('id, business_id, amount_paid, payment_status, stripe_account, metadata, business:businesses ( slug )')
    .eq('id', bookingId).maybeSingle();
  if (error || !b) return res.status(404).json({ error: 'Invoice not found' });

  const acct = { account: b.stripe_account || null, slug: b.business?.slug };
  let session;
  try { session = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET', ...acct }); }
  catch (e) { return res.status(400).json({ error: 'Could not verify this payment with Stripe: ' + e.message }); }

  if ((session.metadata || {}).booking_id !== bookingId) {
    return res.status(400).json({ error: 'This payment link does not match this invoice.' });
  }

  const paid = session.payment_status === 'paid';
  if (!paid) return res.status(200).json({ ok: true, paid: false });
  if (b.payment_status === 'paid') {
    if ((session.metadata || {}).balance !== '1') return res.status(200).json({ ok: true, paid: true });
    const extras = Array.isArray(b.metadata && b.metadata.extra_payments) ? b.metadata.extra_payments : [];
    if (extras.some(x => x && x.session === session.id)) return res.status(200).json({ ok: true, paid: true });
    const amt = (Number(session.amount_total) || 0) / 100;
    const newMeta = { ...(b.metadata || {}), extra_payments: [...extras, { session: session.id, pi: session.payment_intent || null, amount: amt, method: 'link', at: new Date().toISOString() }] };
    const { data: rec } = await db.from('bookings').update({
      amount_paid: Math.round(((Number(b.amount_paid) || 0) + amt) * 100) / 100, metadata: newMeta,
    }).eq('id', bookingId).eq('payment_status', 'paid').eq('amount_paid', b.amount_paid).select('id').maybeSingle();
    if (rec) {
      try {
        await db.from('booking_notes').insert({ booking_id: bookingId, business_id: b.business_id,
          body: `Balance paid online — ₱${amt.toFixed(2)} via card`, author_kind: 'owner', author_id: null, author_name: 'Online payment' });
      } catch (e) { /* best-effort */ }
    }
    return res.status(200).json({ ok: true, paid: true, amount: amt });
  }

  const amount = (Number(session.amount_total) || 0) / 100;
  const patch = {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    amount_paid: Math.round(((Number(b.amount_paid) || 0) + amount) * 100) / 100,
  };
  if (session.payment_intent) patch.stripe_payment_intent_id = session.payment_intent;
  await db.from('bookings').update(patch).eq('id', bookingId).neq('payment_status', 'paid');
  try {
    await db.from('booking_notes').insert({
      booking_id: bookingId, business_id: b.business_id,
      body: `Invoice paid online — ₱${amount.toFixed(2)} via card`,
      author_kind: 'owner', author_id: null, author_name: 'Online payment',
    });
  } catch (e) { /* best-effort */ }
  return res.status(200).json({ ok: true, paid: true, amount });
}

const EMAIL_BUSINESSES = new Set(['tidyhaus', 'doms', 'mile-high', 'austin', 'precision',
  'atxmountpros', 'atxtvmount', 'austinmountingpros', 'austintvinstall', 'tvmountinglosangeles', 'a1tvmounting']);
function emailPublicConfig(req, res) {
  const business = ((req.query || {}).business || 'tidyhaus').toString().trim();
  if (!EMAIL_BUSINESSES.has(business)) return res.status(400).json({ error: `Unknown business "${business}"` });
  const cfg = emailConfig(business);
  return res.status(200).json({ business, from: cfg.from, configured: !!cfg.apiKey,
    ...(business === 'neverfailstvmounting' ? { email_notifications_enabled: emailNotificationsOn(), sms_notifications_enabled: smsNotificationsOn(), sms_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) } : {}) });
}

async function widgetPricesPublic(req, res) {
  const business = ((req.query || {}).business || 'tidyhaus').toString().trim();
  const city = ((req.query || {}).city || 'default').toString().trim();
  try {
    const db = serviceClient();
    const { data: biz } = await db.from('businesses').select('id').eq('slug', business).maybeSingle();
    if (!biz) return res.status(200).json({ prices: {} });
    const fetchCity = async (key) => {
      const { data, error } = await db.from('widget_prices')
        .select('option_id, price')
        .eq('business_id', biz.id)
        .eq('city_key', key);
      if (error) throw error;
      return data || [];
    };
    let data = await fetchCity(city);
    if (!data.length && city !== 'default') {
      console.warn(`[book] no widget_prices for ${business}/${city} — falling back to default`);
      data = await fetchCity('default');
    }
    const prices = {};
    for (const r of data) prices[r.option_id] = Number(r.price) || 0;
    return res.status(200).json({ prices });
  } catch (e) {
    console.warn('[book] widget_prices lookup failed:', e.message);
    return res.status(200).json({ prices: {} });
  }
}

async function couponsPublic(req, res) {
  const business = ((req.query || {}).business || 'tidyhaus').toString().trim();
  try {
    const map = await couponMapFor(serviceClient(), business);
    return res.status(200).json({ coupons: map });
  } catch (e) {
    console.warn('[book] coupons lookup failed:', e.message);
    return res.status(200).json({ coupons: {} });
  }
}

async function multiTvDiscountPublic(req, res) {
  try {
    const cfg = await multiTvDiscountConfigFor(serviceClient());
    return res.status(200).json({ config: cfg });
  } catch (e) {
    console.warn('[book] multi-TV discount config lookup failed:', e.message);
    return res.status(200).json({ config: MULTI_TV_CFG_DEFAULTS });
  }
}

const REVIEW_CLICK_FALLBACK_URL = 'https://tidyhausph.com/';

function looksLikeReviewToken(raw) {
  if (!raw || !raw.includes('.')) return false;
  try {
    const body = JSON.parse(Buffer.from(raw.split('.')[0], 'base64url').toString());
    return !!(body && body.booking_id && (body.kind === 'review' || !body.kind));
  } catch { return false; }
}

async function serveReviewClick(req, res) {
  const rawCode = ((req.query || {}).token || '').toString();
  const estimateToken = expandEstimateCode(rawCode);
  if (estimateToken) return serveEstimateClick(req, res, estimateToken);
  const rawToken = expandReviewCode(rawCode) || '';
  const channel = ((req.query || {}).ch || '').toString().toLowerCase() === 'sms' ? 'sms' : 'email';
  const perChannelCol = channel === 'sms' ? 'review_sms_clicked_at' : 'review_email_clicked_at';
  let t = null;
  try { t = verifyToken(rawToken); } catch { t = null; }
  const isReview = !!(t && t.booking_id && (t.kind === 'review' || !t.kind));
  if (!isReview && !looksLikeReviewToken(rawToken)) return res.redirect(302, REVIEW_CLICK_FALLBACK_URL);
  try {
    if (isReview) {
      const db = serviceClient();
      const now = new Date().toISOString();
      const { error } = await db.from('bookings')
        .update({ [perChannelCol]: now, review_clicked_at: now, review_click_channel: channel })
        .eq('id', t.booking_id)
        .is(perChannelCol, null);
      if (error) {
        const { data: cur } = await db.from('bookings').select('metadata').eq('id', t.booking_id).maybeSingle();
        const meta = (cur && cur.metadata) || {};
        const metaKey = channel === 'sms' ? 'review_sms_clicked_at' : 'review_email_clicked_at';
        if (cur && !meta[metaKey]) {
          await db.from('bookings')
            .update({ metadata: { ...meta, [metaKey]: now, review_clicked_at: meta.review_clicked_at || now, review_click_channel: meta.review_click_channel || channel } })
            .eq('id', t.booking_id);
        }
      }
    }
  } catch (e) { /* tracking is best-effort; always redirect */ }
  const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return res.redirect(302, `${base}/review.html?token=${encodeURIComponent(rawToken)}`);
}

async function serveEstimateClick(req, res, rawToken) {
  const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return res.redirect(302, `${base}/estimate-approve.html?token=${encodeURIComponent(rawToken)}`);
}

export const config = { maxDuration: 60 };

const HA_COUPONS = {
  MCDENVER20: 20, MP10: 10, AUS10: 10, HOU10: 10, DEN10: 10,
  ISREAL15: 15, STEVE15: 15, BATCITY10: 10, FBD15: 15, FB15: 15,
  ANNIVERSARY15: 15, BING10: 10, OLIVE10: 10, STV10: 10, G10TV: 10,
  TV2026: 10, HG20: 20, LA10: 10, AB20: 20, FBA20: 20, FB10: 10,
  FB20: 20,
  LASTCHANCE10: 10,
};
const DOMS_COUPONS = {
  DONTGO10: 10,
};

const NATIVE_COUPONS = {
  'tidyhaus': HA_COUPONS,
};

const COUPON_TTL_MS = 60000;
const _couponCache = new Map();
function couponFallbackMap(businessSlug) {
  return businessSlug === 'doms' ? DOMS_COUPONS : (NATIVE_COUPONS[businessSlug] || {});
}
export async function couponMapFor(db, businessSlug, { strict = false } = {}) {
  const slug = String(businessSlug || '');
  const hit = _couponCache.get(slug);
  if (hit && Date.now() - hit.at < COUPON_TTL_MS && (!strict || hit.verified)) return hit.map;
  let map = null;
  let verified = false;
  try {
    const { data: biz, error: bizError } = await db.from('businesses').select('id').eq('slug', slug).maybeSingle();
    if (bizError) throw bizError;
    if (!biz) throw new Error('Coupon business not found');
    if (biz?.id) {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await db.from('coupons')
        .select('code, amount, active, expires_on').eq('business_id', biz.id).eq('active', true);
      if (error) throw error;
      if (!error && Array.isArray(data)) {
        verified = true;
        map = {};
        for (const c of data) {
          if (c.expires_on && String(c.expires_on) < today) continue;
          map[String(c.code || '').trim().toUpperCase()] = Number(c.amount) || 0;
        }
      }
    }
    if (strict && !verified) throw new Error('Could not verify coupon codes. Please try again.');
  } catch (error) {
    if (strict) throw error;
  }
  if (!map) map = couponFallbackMap(slug);
  _couponCache.set(slug, { at: Date.now(), map, verified });
  return map;
}
export function couponCacheClear(businessSlug) {
  if (businessSlug) _couponCache.delete(String(businessSlug));
  else _couponCache.clear();
}
export async function couponAmountFor(db, businessSlug, rawCode, options) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return 0;
  const map = await couponMapFor(db, businessSlug, options);
  return Number(map[code]) || 0;
}
export async function couponCodesFor(db, businessSlug, options) {
  return Object.keys(await couponMapFor(db, businessSlug, options));
}

const MULTI_TV_CFG_TTL_MS = 60000;
let _multiTvCfgCache = null;
const MULTI_TV_CFG_DEFAULTS = {
  tv_threshold: 3, zero_fee_per_tv: 10, full_cut_fee: 15,
  partial_cut_pct: 0.60, partial_cut_fees: [65, 100],
  price_discount_enabled: true, price_tier3: 20, price_tier4: 25, price_tier5plus: 30,
};
export async function multiTvDiscountConfigFor(db) {
  if (_multiTvCfgCache && Date.now() - _multiTvCfgCache.at < MULTI_TV_CFG_TTL_MS) return _multiTvCfgCache.cfg;
  let cfg = null;
  try {
    const { data, error } = await db.from('multi_tv_discount_config').select('*').limit(1).maybeSingle();
    if (!error && data) cfg = data;
  } catch { /* table not applied yet, fall through to the hardcoded defaults */ }
  if (!cfg) cfg = MULTI_TV_CFG_DEFAULTS;
  _multiTvCfgCache = { at: Date.now(), cfg };
  return cfg;
}
export function multiTvDiscountConfigCacheClear() { _multiTvCfgCache = null; }

function icsEscape(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsStamp(sec) {
  const d = new Date(Number(sec) * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
         `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}
function icsFold(line) {
  if (line.length <= 73) return line;
  const out = [line.slice(0, 73)];
  let s = line.slice(73);
  while (s.length > 72) { out.push(' ' + s.slice(0, 72)); s = s.slice(72); }
  if (s.length) out.push(' ' + s);
  return out.join('\r\n');
}
function serveIcs(req, res) {
  const { title, start, end, location, details } = req.query || {};
  const startSec = Number(start), endSec = Number(end);
  if (!startSec || !endSec) return res.status(400).json({ error: 'start and end (epoch seconds) are required' });
  const uid = `booking-${startSec}-${Math.random().toString(36).slice(2, 10)}@tidyhaus`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TidyHaus//Booking//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(Math.floor(Date.now() / 1000))}`,
    `DTSTART:${icsStamp(startSec)}`,
    `DTEND:${icsStamp(endSec)}`,
    `SUMMARY:${icsEscape(title || 'Appointment')}`,
    location ? `LOCATION:${icsEscape(location)}` : null,
    details ? `DESCRIPTION:${icsEscape(details)}` : null,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Appointment reminder', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).map(icsFold);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="appointment.ics"');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(lines.join('\r\n'));
}

function isTvSizeLine(name) {
  const n = String(name || '').trim();
  if (/second technician/i.test(n)) return false;
  return /^\d{2,3}["″]\s*or less$/i.test(n)
      || /^\d{2,3}["″]\s*[-–]\s*\d{2,3}["″]$/.test(n)
      || /^98["″]?\s*\+$/.test(n);
}
function applyMultiTvDiscounts(lines, surcharge, cfg) {
  const c = cfg || MULTI_TV_CFG_DEFAULTS;
  const tvCount = lines.reduce((n, l) => isTvSizeLine(l.name) ? n + (Number(l.quantity) || 1) : n, 0);
  let multiTvDiscountAmt = 0;
  if (tvCount >= c.tv_threshold) {
    if (!lines.some(l => /multi-tv discount/i.test(l.name))) {
      if (surcharge <= 0) {
        const perTvAmt = c.zero_fee_per_tv * tvCount;
        lines.push({ kind: 'coupon', name: `Multi-TV discount (-₱${c.zero_fee_per_tv} × ${tvCount} TVs)`, quantity: 1, unit_price: -perTvAmt, line_total: -perTvAmt });
        multiTvDiscountAmt = perTvAmt;
      } else {
        const partialFees = (c.partial_cut_fees || []).map(Number);
        const cutPct = surcharge === Number(c.full_cut_fee) ? 1.00 : partialFees.includes(surcharge) ? Number(c.partial_cut_pct) : 0;
        if (cutPct > 0) {
          const cutAmt = Math.round(surcharge * cutPct * 100) / 100;
          lines.push({ kind: 'coupon', name: 'Multi-TV discount', quantity: 1, unit_price: -cutAmt, line_total: -cutAmt });
          multiTvDiscountAmt = cutAmt;
        }
      }
    }
    if (c.price_discount_enabled && !lines.some(l => /multi-tv price discount/i.test(l.name))) {
      let priceDiscAmt = 0;
      for (let i = 3; i <= tvCount; i++) priceDiscAmt += (i === 3 ? Number(c.price_tier3) : i === 4 ? Number(c.price_tier4) : Number(c.price_tier5plus));
      if (priceDiscAmt > 0) {
        lines.push({ kind: 'coupon', name: `Multi-TV price discount (${tvCount} TVs)`, quantity: 1, unit_price: -priceDiscAmt, line_total: -priceDiscAmt });
      }
    }
  }
  return multiTvDiscountAmt;
}

const SLOT_TAKEN_MSG = 'That time was just booked by another customer. Please pick a different time.';

function fmtWhen(startUTC, tz, fallback) {
  try { return startUTC.toLocaleString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return fallback; }
}

async function idempotentPrior(db, bizId, idempotencyKey) {
  if (!idempotencyKey) return null;
  try {
    const { data: prev } = await db.from('bookings')
      .select('id, technician_id, status, payment_status')
      .eq('business_id', bizId).eq('idempotency_key', String(idempotencyKey)).maybeSingle();
    if (!prev) return null;
    return {
      success: true, booking_id: prev.id, job_id: prev.id,
      status: prev.technician_id ? 'assigned' : (prev.status || 'confirmed'),
      card_saved: prev.payment_status === 'card_on_file',
      duplicate: true,
    };
  } catch (e) { console.warn('[book] idempotent lookup failed:', e.message); return null; }
}

async function recoverUnassignedBooking(db, { slug, bizId, bookingId, dateStr, slotKey, serviceAreaId = null, timezone = null, zip = null, businessName, customerName, whenStr }) {
  let rescueId = null;
  try { rescueId = await pickOpenTech(db, { businessSlug: slug, dateStr, slotKey, serviceAreaId, timezone, crossHire: true, zip }); }
  catch (e) { console.warn('[book] rescue pick failed:', e.message); }
  if (rescueId) {
    try {
      const upd = await db.from('bookings')
        .update({ technician_id: rescueId, status: 'assigned' })
        .eq('id', bookingId).is('technician_id', null).neq('status', 'cancelled')
        .select('id').maybeSingle();
      if (upd.error) throw upd.error;
      if (upd.data) {
        const ev = await db.from('booking_status_events').insert({
          booking_id: bookingId, business_id: bizId, technician_id: rescueId,
          status: 'assigned', note: 'Auto-assigned on retry after losing the slot race',
        });
        if (ev.error) console.warn('[book] rescue event insert failed:', ev.error.message);
        return rescueId;
      }
    } catch (e) { console.warn('[book] rescue assign failed:', e.message); }
  }
  try {
    const { data: row } = await db.from('bookings').select('technician_id, status').eq('id', bookingId).maybeSingle();
    if (row?.technician_id) return row.technician_id;
    if (row?.status === 'cancelled') return null;
  } catch (e) { /* fall through: better a false alarm than silence */ }
  await sendUnassignedBookingAlert({ slug, businessName, customerName, whenStr, bookingId })
    .catch(e => console.warn('[book] unassigned alert failed:', e.message));
  return null;
}

async function bookDoms(req, res) {
  const b = req.body || {};
  const customer = b.customer || {};
  for (const k of ['first_name', 'last_name', 'name']) if (typeof customer[k] === 'string') customer[k] = capName(customer[k].trim());
  if (!customer.email)   return res.status(400).json({ error: 'customer.email required' });
  if (!customer.phone)   return res.status(400).json({ error: 'customer.phone required' });
  if (await isBlockedPhone(customer.phone) || await isScammer({ phone: customer.phone, email: customer.email })) return res.status(400).json({ error: 'We could not complete this booking online. Please call us.' });
  if (hasDigits(customer.first_name) || hasDigits(customer.last_name)) return res.status(400).json({ error: BAD_NAME });
  if (!isLikelyStreetAddress(customer.address)) return res.status(400).json({ error: BAD_ADDRESS });

  const parsed = parseSlotId(b.selectedSlot);
  if (!parsed || parsed.businessSlug !== 'doms') {
    return res.status(400).json({ error: 'A valid time slot is required' });
  }
  const { dateStr, slotKey } = parsed;

  let db;
  try { db = serviceClient(); }
  catch (e) { return res.status(500).json({ error: 'Booking storage not configured', message: e.message }); }

  const { data: biz } = await db.from('businesses').select('id').eq('slug', 'doms').single();
  if (!biz) return res.status(500).json({ error: 'Doms business not configured' });

  const zip = zip5(b.postal_code || customer.zip || '');
  let surcharge = 0, zipAreaId = null;
  if (zip) {
    const { data: z } = await db.from('service_area_zips').select('*')
      .eq('business_id', biz.id).eq('postal_code', zip).maybeSingle();
    surcharge = Number(z?.surcharge) || 0;
    zipAreaId = z?.service_area_id || null;
  }
  let area = null;
  if (zipAreaId) ({ data: area } = await db.from('service_areas')
    .select('id, name, state, timezone').eq('id', zipAreaId).eq('business_id', biz.id).maybeSingle());
  if (!area) ({ data: area } = await db.from('service_areas')
    .select('id, name, state, timezone').eq('business_id', biz.id).eq('name', 'Manila').maybeSingle());
  const isManila = !area || area.name === 'Manila';
  const tz = isManila ? 'Asia/Manila' : (area.timezone || 'Asia/Manila');
  const defCity = isManila ? 'Manila' : area.name;
  const defState = isManila ? 'CO' : (area.state || 'CO');

  const startUTC = slotStartUTC(tz, dateStr, slotKey);
  const endUTC   = slotEndUTC(tz, dateStr, slotKey);
  if (!startUTC) return res.status(400).json({ error: 'Invalid time slot' });
  if (startUTC.getTime() - Date.now() <= minLeadMsFor(area && area.id)) {
    return res.status(409).json({ error: "That time is too soon to book now. Please pick a later time.", conflict: true });
  }

  const couponCode = String(b.coupon || '').trim().toUpperCase();
  const couponAmt = await couponAmountFor(db, 'doms', couponCode);

  const sum = b.email_summary || {};
  let lines = [];
  if (Array.isArray(b.line_items) && b.line_items.length) {
    lines = b.line_items.map(li => ({
      kind: li.kind || 'option',
      name: String(li.name || 'Item').slice(0, 200),
      quantity: Number(li.quantity) || 1,
      unit_price: Number(li.unit_price) || 0,
      line_total: Number(li.line_total != null ? li.line_total : li.unit_price) || 0,
    }));
  } else if (Array.isArray(sum.lines) && sum.lines.length) {
    lines = sum.lines.map(l => {
      const qty = Number(l.qty) || 1;
      const amount = Number(l.amount) || 0;
      return { kind: 'option', name: String(l.label || 'Item').slice(0, 200),
        quantity: qty, unit_price: qty ? amount / qty : amount, line_total: amount };
    });
  }
  if (surcharge !== 0 && !lines.some(l => /surcharge|local travel credit/i.test(l.name))) {
    lines.push({ kind: 'fee', name: surcharge > 0 ? 'Service area surcharge' : 'Local travel credit', quantity: 1, unit_price: surcharge, line_total: surcharge });
  }
  if (couponAmt > 0 && !lines.some(l => /coupon|discount/i.test(l.name))) {
    lines.push({ kind: 'coupon', name: `Coupon ${couponCode}`, quantity: 1, unit_price: -couponAmt, line_total: -couponAmt });
  }
  const multiTvDiscountAmt = applyMultiTvDiscounts(lines, surcharge, await multiTvDiscountConfigFor(db));
  if (!lines.some(l => /^tax\b/i.test(l.name))) {
    const taxable = lines
      .filter(l => l.kind !== 'coupon' && !/^tax\b/i.test(l.name || ''))
      .reduce((s, l) => s + (Number(l.line_total) || 0), 0);
    const tax = Math.round(taxable * 0.0825 * 100) / 100;
    if (tax > 0) lines.push({ kind: 'fee', name: 'Tax (8.25%)', quantity: 1, unit_price: tax, line_total: tax });
  }
  lines = canonicalizeLineItems(lines);
  const tip = Number(b.tip) || 0;
  const subtotal = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const widgetTotal = sum.total != null ? Number(sum.total) : subtotal;
  const price = subtotal;
  if (Number.isFinite(widgetTotal) && Math.abs(widgetTotal - subtotal) > 0.5) {
    console.warn('[book-doms] price mismatch: server', subtotal, 'vs widget', widgetTotal,
      '- charging the server total; widget total is stale or the client-side preview did not match.');
  }
  if (price < MIN_TICKET_PRICE) {
    return res.status(400).json({ error: `Jobs must total at least ₱${MIN_TICKET_PRICE}. Please add another service or add-on.`, below_minimum: true });
  }

  let technician_id = null, pickBroken = false;
  try { technician_id = await pickOpenTech(db, { businessSlug: 'doms', dateStr, slotKey, serviceAreaId: area?.id || null, timezone: tz, crossHire: true, zip }); }
  catch (e) {
    console.warn('[book-doms] tech pick failed, retrying once:', e.message);
    try { technician_id = await pickOpenTech(db, { businessSlug: 'doms', dateStr, slotKey, serviceAreaId: area?.id || null, timezone: tz, crossHire: true, zip }); }
    catch (e2) { pickBroken = true; console.error('[book-doms] tech pick failed twice:', e2.message); }
  }
  if (!technician_id) {
    const dup = await idempotentPrior(db, biz.id, b.idempotency_key);
    if (dup) return res.status(200).json(dup);
    if (pickBroken) {
      return res.status(409).json({ error: 'We could not confirm that time is still open. Please try again in a moment.', conflict: true });
    }
    return res.status(409).json({ error: SLOT_TAKEN_MSG, conflict: true, slot_taken: true });
  }
  let technicianName = null, technicianPhoto = null;
  try {
    const { data: _t } = await db.from('technicians').select('name, photo_url, bio_years, bio_blurb').eq('id', technician_id).maybeSingle();
    technicianName = _t?.name || null;
    technicianPhoto = _t || null;
  } catch (e) { /* name is best-effort */ }

  let stripeCustomerId = null, paymentStatus = 'unpaid', cardNote = '';
  if (b.payment_method_id) {
    if (!stripeConfigured('doms')) {
      cardNote = `Card captured (${b.payment_method_id}) but DOMS_STRIPE_SECRET_KEY is not set — card was NOT saved on file.`;
    } else {
      if (b.stripe_customer_id) {
        try {
          const pm = await retrieveCard(b.payment_method_id, 'doms');
          if (pm.customer && pm.customer === b.stripe_customer_id) {
            stripeCustomerId = b.stripe_customer_id;
            paymentStatus = 'card_on_file';
            cardNote = 'Card verified & saved at checkout (Doms Stripe).';
            await setDefaultPaymentMethod(stripeCustomerId, b.payment_method_id, 'doms');
          }
        } catch (e) { /* fall through to the attach below */ }
      }
      if (paymentStatus !== 'card_on_file') {
        try {
          const r = await saveCardOnFile({
            email: customer.email,
            name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
            phone: customer.phone, paymentMethodId: b.payment_method_id, slug: 'doms',
          });
          stripeCustomerId = r.customerId;
          paymentStatus = 'card_on_file';
          cardNote = 'Card is on file (Doms Stripe).';
        } catch (e) {
          cardNote = `Card capture failed: ${e.message} (pm ${b.payment_method_id} was never attached)`;
        }
      }
    }
  } else if (b.card_skipped) {
    cardNote = 'Customer booked WITHOUT a card after their card failed verification at checkout — collect payment at service.';
  }

  if (cardNote) console.log('[book-doms] card:', cardNote);
  const cardSaveFailed = !!(b.payment_method_id && paymentStatus !== 'card_on_file')
    || !!(!b.payment_method_id && b.card_skipped);

  const smsConsent = await textConsentFor(db, customer.phone);
  let result = {};
  try {
    result = (await mirrorBooking({
      businessSlug: 'doms', source: 'widget',
      landing_page: b.landing_page || null, traffic_source: b.traffic_source || null, ad_click: b.ad_click || null,
      source_page: b.source_page || null, source_page_basis: b.source_page_basis || null, site_session_id: b.site_session_id || null,
      service_area_id: area?.id || null,
      technician_id,
      status: technician_id ? 'assigned' : 'confirmed',
      scheduled_at: startUTC.toISOString(),
      scheduled_end: endUTC ? endUTC.toISOString() : null,
      duration_minutes: 120,
      service_name: "Dom's Home Cleaning",
      idempotency_key: b.idempotency_key || null,
      sms_consent: smsConsent,
      stripe_account: 'doms',
      customer: {
        first_name: customer.first_name, last_name: customer.last_name,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        email: customer.email, phone: customer.phone,
      },
      address: { line1: customer.address, line2: customer.address_line2 || null, city: isManila ? (b.city || 'Manila') : defCity, state: isManila ? (b.state || 'CO') : defState, postal_code: zip },
      line_items: lines, subtotal, price, tip,
      payment_status: paymentStatus,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_method_id: cardSaveFailed ? null : (b.payment_method_id || null),
      notes: cardSaveFailed ? `⚠ ${cardNote}` : null,
      customer_notes: b.customer_notes || sum.notes || null,
    })) || {};
  } catch (e) {
    console.error('[book-doms] mirror error:', e.message);
    return res.status(500).json({ error: 'Could not save booking', message: e.message });
  }
  const bookingId = result.booking_id || null;
  if (!bookingId) {
    console.error('[book-doms] mirror returned no booking id');
    return res.status(500).json({ error: 'Could not save your booking. Please try again.' });
  }
  if (bookingId && !result.technician_id) {
    result.technician_id = await recoverUnassignedBooking(db, {
      slug: 'doms', bizId: biz.id, bookingId, dateStr, slotKey, serviceAreaId: area?.id || null, timezone: tz, zip,
      businessName: "Dom's Home Cleaning",
      customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      whenStr: fmtWhen(startUTC, tz, dateStr),
    });
  }
  if (result.technician_id !== technician_id) {
    technicianName = null; technicianPhoto = null;
    if (result.technician_id) {
      try {
        const { data: _t } = await db.from('technicians').select('name, photo_url, bio_years, bio_blurb').eq('id', result.technician_id).maybeSingle();
        technicianName = _t?.name || null;
        technicianPhoto = _t || null;
      } catch (e) { /* best-effort */ }
    }
  }

  if (result.technician_id) {
    await notifyTechAssigned(db, { id: biz.id, name: "Dom's Home Cleaning", timezone: tz },
      result.technician_id, startUTC.toISOString(), tz, { bookingId })
      .catch(e => console.error('[book-doms] tech notify failed:', e.message));
  }

  maybeSendBigBracketAlert({
    db, technicianId: result.technician_id,
    lines,
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  });

  maybeSendFirstMultiTvDiscountAlert(db, {
    discountAmt: multiTvDiscountAmt,
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  }).catch(e => console.warn('[book-doms] multi-tv-discount alert error:', e.message));

  maybeSendZeroOrLowProfitAlert({
    price, lines, techName: technicianName || '',
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    scheduled_at: startUTC.toISOString(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  });

  if (cardSaveFailed) {
    await sendCardSaveFailedAlert({
      slug: 'doms', businessName: "Dom's Home Cleaning",
      customer: { name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(), phone: customer.phone, email: customer.email },
      when: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }); } catch { return dateStr; } })(),
      reason: cardNote, bookingId,
    });
  }

  const domsEmail = emailConfig('doms');
  const willSend = emailNotificationsOn() && !!domsEmail.apiKey && !!customer.email;
  if (willSend) {
    try {
      const [yy, mm, dd] = dateStr.split('-').map(Number);
      const dateLong = new Date(Date.UTC(yy, mm - 1, dd, 12)).toLocaleDateString('en-US',
        { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const slot = SLOTS.find(s => s.key === slotKey);
      const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const emailLines = lines.map(l => ({ label: l.name, qty: l.quantity, amount: l.line_total }));
      const { subject, html } = bookingConfirmationEmail({
        firstName:   customer.first_name || sum.firstName || '',
        dateLong,
        timeWindow:  sum.timeWindow || (slot ? slot.label : ''),
        serviceName: "Dom's Home Cleaning",
        technicianName,
        technicianPhotoUrl: technicianPhoto?.photo_url || null,
        technicianBioYears: technicianPhoto?.bio_years || null,
        technicianBioBlurb: technicianPhoto?.bio_blurb || null,
        address:     { line1: customer.address, city: isManila ? (b.city || 'Manila') : defCity, state: isManila ? (b.state || 'CO') : defState, zip },
        lines:       emailLines,
        total:       price,
        tip,
        startEpoch:  Math.floor(startUTC.getTime() / 1000),
        endEpoch:    endUTC ? Math.floor(endUTC.getTime() / 1000) : null,
        baseUrl, jobId: bookingId,
        gdsUpsellUrl: gdsUpsellUrlFor({ lines, bookingId, baseUrl }),
        rescheduleUrl: rescheduleUrlFor({ bookingId, baseUrl }),
      }, brandFor('doms'));
      const sent = await sendEmail({ slug: 'doms', to: customer.email, subject, html, replyTo: domsEmail.from });
      if (!sent.sent) console.warn('[book-doms] confirmation email not sent:', sent.skipped || sent.error);
      await persistConfirmationEmailStatus(db, bookingId, sent.sent ? 'sent' : 'failed');
    } catch (e) {
      console.error('[book-doms] confirmation email error:', e.message);
      await persistConfirmationEmailStatus(db, bookingId, 'failed');
    }
  }

  await sendBookingConfirmSms({
    customerPhone: customer.phone,
    smsConsent,
    bizName: "Dom's Home Cleaning",
    bizSlug: 'doms',
    techName: technicianName,
    startUTC, tz,
    timeWindow: sum.timeWindow || (SLOTS.find(s => s.key === slotKey) || {}).label || '',
    tag: 'book-doms',
    db, businessId: biz.id,
  });

  return res.status(200).json({
    success: true,
    booking_id: bookingId, job_id: bookingId,
    status: result.technician_id ? 'assigned' : 'confirmed',
    card_saved: paymentStatus === 'card_on_file',
  });
}

async function bookNative(req, res, slug) {
  const DISPLAY = NATIVE_BUSINESS[slug] || { name: slug, legalName: slug };
  const b = req.body || {};
  const customer = b.customer || {};
  for (const k of ['first_name', 'last_name', 'name']) if (typeof customer[k] === 'string') customer[k] = capName(customer[k].trim());
  if (!customer.email)   return res.status(400).json({ error: 'customer.email required' });
  if (!customer.phone)   return res.status(400).json({ error: 'customer.phone required' });
  if (await isBlockedPhone(customer.phone) || await isScammer({ phone: customer.phone, email: customer.email })) return res.status(400).json({ error: 'We could not complete this booking online. Please call us.' });
  if (hasDigits(customer.first_name) || hasDigits(customer.last_name)) return res.status(400).json({ error: BAD_NAME });
  if (!isLikelyStreetAddress(customer.address)) return res.status(400).json({ error: BAD_ADDRESS });

  const parsed = parseSlotId(b.selectedSlot);
  if (!parsed || parsed.businessSlug !== slug) {
    return res.status(400).json({ error: 'A valid time slot is required' });
  }
  const { dateStr, slotKey } = parsed;

  let db;
  try { db = serviceClient(); }
  catch (e) { return res.status(500).json({ error: 'Booking storage not configured', message: e.message }); }

  const { data: biz } = await db.from('businesses').select('id, name').eq('slug', slug).single();
  if (!biz) return res.status(500).json({ error: `${DISPLAY.name} business not configured` });

  const zip = zip5(b.postal_code || customer.zip || '');
  if (!zip) return res.status(400).json({ error: 'A ZIP code is required' });
  let z, zErr;
  ({ data: z, error: zErr } = await db.from('service_area_zips')
    .select('surcharge, price_adjustment_amount, service_area:service_areas ( id, name, state, timezone )')
    .eq('business_id', biz.id).eq('postal_code', zip).maybeSingle());
  if (zErr && /price_adjustment_amount/.test(zErr.message || '')) {
    ({ data: z } = await db.from('service_area_zips')
      .select('surcharge, service_area:service_areas ( id, name, state, timezone )')
      .eq('business_id', biz.id).eq('postal_code', zip).maybeSingle());
  }
  if (!z || !z.service_area) {
    return res.status(400).json({ error: "Sorry — that ZIP code isn't in our service area." });
  }
  const area = z.service_area;
  const serviceAreaId = area.id;
  const tz = area.timezone || 'Asia/Manila';
  const surcharge = Number(z.surcharge) || 0;
  const priceAdjustmentAmount = Number(z.price_adjustment_amount) || 0;

  const startUTC = slotStartUTC(tz, dateStr, slotKey);
  const endUTC   = slotEndUTC(tz, dateStr, slotKey);
  if (!startUTC) return res.status(400).json({ error: 'Invalid time slot' });
  if (startUTC.getTime() - Date.now() <= minLeadMsFor(serviceAreaId)) {
    return res.status(409).json({ error: "That time is too soon to book now. Please pick a later time.", conflict: true });
  }

  const afterHours = slotKey === 's5' ? 75 : 0;

  const couponCode = String(b.coupon || '').trim().toUpperCase();
  const couponAmt = await couponAmountFor(db, slug, couponCode);

  const sum = b.email_summary || {};
  let lines = [];
  if (Array.isArray(b.line_items) && b.line_items.length) {
    lines = b.line_items.map(li => ({
      kind: li.kind || 'option',
      name: String(li.name || 'Item').slice(0, 200),
      quantity: Number(li.quantity) || 1,
      unit_price: Number(li.unit_price) || 0,
      line_total: Number(li.line_total != null ? li.line_total : li.unit_price) || 0,
    }));
  } else if (Array.isArray(sum.lines) && sum.lines.length) {
    lines = sum.lines.map(l => {
      const qty = Number(l.qty) || 1;
      const amount = Number(l.amount) || 0;
      return { kind: 'option', name: String(l.label || 'Item').slice(0, 200),
        quantity: qty, unit_price: qty ? amount / qty : amount, line_total: amount };
    });
  }
  if (surcharge !== 0 && !lines.some(l => /surcharge|local travel credit/i.test(l.name))) {
    lines.push({ kind: 'fee', name: surcharge > 0 ? 'Service area surcharge' : 'Local travel credit', quantity: 1, unit_price: surcharge, line_total: surcharge });
  }
  if (afterHours > 0 && !lines.some(l => /after.?hours/i.test(l.name))) {
    lines.push({ kind: 'fee', name: 'After-hours fee', quantity: 1, unit_price: afterHours, line_total: afterHours });
  }
  const ZIP_ADJUSTMENT_LINE_NAME = 'Location-based pricing';
  if (priceAdjustmentAmount) {
    lines.push({ kind: 'fee', name: ZIP_ADJUSTMENT_LINE_NAME, quantity: 1, unit_price: priceAdjustmentAmount, line_total: priceAdjustmentAmount });
  }
  if (couponAmt > 0 && !lines.some(l => /coupon|discount/i.test(l.name))) {
    lines.push({ kind: 'coupon', name: `Coupon ${couponCode}`, quantity: 1, unit_price: -couponAmt, line_total: -couponAmt });
  }
  const multiTvDiscountAmt = applyMultiTvDiscounts(lines, surcharge, await multiTvDiscountConfigFor(db));
  if (!lines.some(l => /^tax\b/i.test(l.name))) {
    const taxable = lines
      .filter(l => l.kind !== 'coupon' && !/^tax\b/i.test(l.name || ''))
      .reduce((s, l) => s + (Number(l.line_total) || 0), 0);
    const tax = Math.round(taxable * 0.0825 * 100) / 100;
    if (tax > 0) lines.push({ kind: 'fee', name: 'Tax (8.25%)', quantity: 1, unit_price: tax, line_total: tax });
  }
  lines = canonicalizeLineItems(lines);
  const tip = Number(b.tip) || 0;
  const subtotal = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const widgetTotal = sum.total != null ? Number(sum.total) : subtotal;
  const price = Math.max(subtotal, widgetTotal) || subtotal;
  if (price < MIN_TICKET_PRICE) {
    return res.status(400).json({ error: `Jobs must total at least ₱${MIN_TICKET_PRICE}. Please add another service or add-on.`, below_minimum: true });
  }

  let technician_id = null, pickBroken = false;
  try { technician_id = await pickOpenTech(db, { businessSlug: slug, dateStr, slotKey, serviceAreaId, timezone: tz, crossHire: true, zip }); }
  catch (e) {
    console.warn('[book-ha] tech pick failed, retrying once:', e.message);
    try { technician_id = await pickOpenTech(db, { businessSlug: slug, dateStr, slotKey, serviceAreaId, timezone: tz, crossHire: true, zip }); }
    catch (e2) { pickBroken = true; console.error('[book-ha] tech pick failed twice:', e2.message); }
  }
  if (!technician_id) {
    const dup = await idempotentPrior(db, biz.id, b.idempotency_key);
    if (dup) return res.status(200).json(dup);
    if (pickBroken) {
      return res.status(409).json({ error: 'We could not confirm that time is still open. Please try again in a moment.', conflict: true });
    }
    return res.status(409).json({ error: SLOT_TAKEN_MSG, conflict: true, slot_taken: true });
  }
  let technicianName = null, technicianPhoto = null;
  try {
    const { data: _t } = await db.from('technicians').select('name, photo_url, bio_years, bio_blurb').eq('id', technician_id).maybeSingle();
    technicianName = _t?.name || null;
    technicianPhoto = _t || null;
  } catch (e) { /* name is best-effort */ }

  let stripeCustomerId = null, paymentStatus = 'unpaid', cardNote = '';
  if (b.payment_method_id) {
    if (!stripeConfigured({ account: slug })) {
      cardNote = `Card captured (${b.payment_method_id}) but this business's Stripe secret key is not set — card was NOT saved on file.`;
    } else {
      if (b.stripe_customer_id) {
        try {
          const pm = await retrieveCard(b.payment_method_id, { account: slug });
          if (pm.customer && pm.customer === b.stripe_customer_id) {
            stripeCustomerId = b.stripe_customer_id;
            paymentStatus = 'card_on_file';
            cardNote = `Card verified & saved at checkout (${DISPLAY.name} Stripe).`;
            await setDefaultPaymentMethod(stripeCustomerId, b.payment_method_id, { account: slug });
          }
        } catch (e) { /* fall through to the attach below */ }
      }
      if (paymentStatus !== 'card_on_file') {
        try {
          const r = await saveCardOnFile({
            email: customer.email,
            name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
            phone: customer.phone, paymentMethodId: b.payment_method_id, account: slug,
          });
          stripeCustomerId = r.customerId;
          paymentStatus = 'card_on_file';
          cardNote = `Card is on file (${DISPLAY.name} Stripe).`;
        } catch (e) {
          cardNote = `Card capture failed: ${e.message} (pm ${b.payment_method_id} was never attached)`;
        }
      }
    }
  } else if (b.card_skipped) {
    cardNote = 'Customer booked WITHOUT a card after their card failed verification at checkout — collect payment at service.';
  }

  const city = b.city || area.name || null;
  const state = b.state || area.state || null;
  if (cardNote) console.log('[book-ha] card:', cardNote);
  const cardSaveFailed = !!(b.payment_method_id && paymentStatus !== 'card_on_file')
    || !!(!b.payment_method_id && b.card_skipped);

  const smsConsent = await textConsentFor(db, customer.phone);
  let result = {};
  try {
    result = (await mirrorBooking({
      businessSlug: slug, source: 'widget',
      landing_page: b.landing_page || null, traffic_source: b.traffic_source || null, ad_click: b.ad_click || null,
      source_page: b.source_page || null, source_page_basis: b.source_page_basis || null, site_session_id: b.site_session_id || null,
      service_area_id: serviceAreaId,
      technician_id,
      status: technician_id ? 'assigned' : 'confirmed',
      scheduled_at: startUTC.toISOString(),
      scheduled_end: endUTC ? endUTC.toISOString() : null,
      duration_minutes: 120,
      service_name: 'Home Cleaning',
      idempotency_key: b.idempotency_key || null,
      sms_consent: smsConsent,
      stripe_account: slug,
      customer: {
        first_name: customer.first_name, last_name: customer.last_name,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        email: customer.email, phone: customer.phone,
      },
      address: { line1: customer.address, line2: customer.address_line2 || null, city, state, postal_code: zip },
      line_items: lines, subtotal, price, tip,
      payment_status: paymentStatus,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_method_id: cardSaveFailed ? null : (b.payment_method_id || null),
      notes: cardSaveFailed ? `⚠ ${cardNote}` : null,
      customer_notes: b.customer_notes || sum.notes || null,
    })) || {};
  } catch (e) {
    console.error('[book-ha] mirror error:', e.message);
    return res.status(500).json({ error: 'Could not save booking', message: e.message });
  }
  const bookingId = result.booking_id || null;
  if (!bookingId) {
    console.error('[book-ha] mirror returned no booking id');
    return res.status(500).json({ error: 'Could not save your booking. Please try again.' });
  }
  if (bookingId && !result.technician_id) {
    result.technician_id = await recoverUnassignedBooking(db, {
      slug, bizId: biz.id, bookingId, dateStr, slotKey, serviceAreaId, timezone: tz, zip,
      businessName: DISPLAY.name,
      customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      whenStr: fmtWhen(startUTC, tz, dateStr),
    });
  }
  if (result.technician_id !== technician_id) {
    technicianName = null; technicianPhoto = null;
    if (result.technician_id) {
      try {
        const { data: _t } = await db.from('technicians').select('name, photo_url, bio_years, bio_blurb').eq('id', result.technician_id).maybeSingle();
        technicianName = _t?.name || null;
        technicianPhoto = _t || null;
      } catch (e) { /* best-effort */ }
    }
  }

  if (result.technician_id) {
    await notifyTechAssigned(db, { id: biz.id, name: DISPLAY.name, timezone: tz },
      result.technician_id, startUTC.toISOString(), tz, { bookingId })
      .catch(e => console.error('[book-ha] tech notify failed:', e.message));
  }

  maybeSendBigBracketAlert({
    db, technicianId: result.technician_id,
    lines,
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  });
  maybeSendFirstMultiTvDiscountAlert(db, {
    discountAmt: multiTvDiscountAmt,
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  }).catch(e => console.warn('[book-ha] multi-tv-discount alert error:', e.message));

  maybeSendZeroOrLowProfitAlert({
    price, lines, techName: technicianName || '',
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    scheduled_at: startUTC.toISOString(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  });

  maybeSendLeadGenBookingAlert({
    slug, businessName: DISPLAY.name,
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    whenStr: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }); } catch { return dateStr; } })(),
  });

  if (cardSaveFailed) {
    await sendCardSaveFailedAlert({
      slug, businessName: DISPLAY.legalName,
      customer: { name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(), phone: customer.phone, email: customer.email },
      when: (() => { try { return startUTC.toLocaleDateString('en-US', { timeZone: tz || 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' }); } catch { return dateStr; } })(),
      reason: cardNote, bookingId,
    });
  }

  const haEmail = emailConfig(slug);
  const willSend = emailNotificationsOn() && !!haEmail.apiKey && !!customer.email;
  if (willSend) {
    try {
      const [yy, mm, dd] = dateStr.split('-').map(Number);
      const dateLong = new Date(Date.UTC(yy, mm - 1, dd, 12)).toLocaleDateString('en-US',
        { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const slot = SLOTS.find(s => s.key === slotKey);
      const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const emailLines = lines
        .filter(l => l.name !== ZIP_ADJUSTMENT_LINE_NAME)
        .map(l => ({ label: l.name, qty: l.quantity, amount: l.line_total }));
      const { subject, html } = bookingConfirmationEmail({
        firstName:   customer.first_name || sum.firstName || '',
        dateLong,
        timeWindow:  sum.timeWindow || (slot ? slot.label : ''),
        serviceName: 'Home Cleaning',
        technicianName,
        technicianPhotoUrl: technicianPhoto?.photo_url || null,
        technicianBioYears: technicianPhoto?.bio_years || null,
        technicianBioBlurb: technicianPhoto?.bio_blurb || null,
        address:     { line1: customer.address, city, state, zip },
        lines:       emailLines,
        total:       price,
        tip,
        startEpoch:  Math.floor(startUTC.getTime() / 1000),
        endEpoch:    endUTC ? Math.floor(endUTC.getTime() / 1000) : null,
        baseUrl, jobId: bookingId,
        gdsUpsellUrl: gdsUpsellUrlFor({ lines, bookingId, baseUrl }),
        rescheduleUrl: rescheduleUrlFor({ bookingId, baseUrl }),
      }, brandFor(slug));
      const sent = await sendEmail({ slug, to: customer.email, subject, html, replyTo: haEmail.from });
      if (!sent.sent) console.warn('[book-ha] confirmation email not sent:', sent.skipped || sent.error);
      await persistConfirmationEmailStatus(db, bookingId, sent.sent ? 'sent' : 'failed');
    } catch (e) {
      console.error('[book-ha] confirmation email error:', e.message);
      await persistConfirmationEmailStatus(db, bookingId, 'failed');
    }
  }

  await sendBookingConfirmSms({
    customerPhone: customer.phone,
    smsConsent,
    bizName: DISPLAY.name,
    bizSlug: slug,
    techName: technicianName,
    startUTC, tz,
    timeWindow: sum.timeWindow || (SLOTS.find(s => s.key === slotKey) || {}).label || '',
    tag: 'book-ha',
    db, businessId: biz.id,
  });

  return res.status(200).json({
    success: true,
    booking_id: bookingId, job_id: bookingId,
    status: result.technician_id ? 'assigned' : 'confirmed',
    card_saved: paymentStatus === 'card_on_file',
  });
}

const OTW_OPEN_STATUSES = ['pending', 'confirmed', 'assigned'];

function otwToken(req) {
  const raw = ((req.query || {}).token || (req.body || {}).token || '').toString();
  const t = verifyToken(raw);
  return (t && t.kind === 'otw_quick' && t.booking_id) ? t : null;
}

async function otwInfo(req, res) {
  const t = otwToken(req);
  if (!t) return res.status(200).json({ ok: false, reason: 'invalid' });
  const db = serviceClient();
  const { data: b } = await db.from('bookings')
    .select('id, status, on_the_way_at, scheduled_at, service_area_id, sms_consent, metadata, business:businesses(name, timezone), customer:customers(name, phone)')
    .eq('id', t.booking_id).maybeSingle();
  if (!b) return res.status(200).json({ ok: false, reason: 'invalid' });

  let tz = b.business?.timezone || 'Asia/Manila';
  if (b.service_area_id) {
    try {
      const { data: sa } = await db.from('service_areas').select('timezone').eq('id', b.service_area_id).maybeSingle();
      if (sa?.timezone) tz = sa.timezone;
    } catch { /* fall back to business tz */ }
  }
  let whenTxt = null;
  try {
    whenTxt = new Date(b.scheduled_at).toLocaleString('en-US', {
      timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit',
    });
  } catch { /* leave null */ }

  const already = !!b.on_the_way_at || !OTW_OPEN_STATUSES.includes(b.status);
  return res.status(200).json({
    ok: true,
    already,
    customer: b.customer?.name || 'your customer',
    when: whenTxt,
    business: b.business?.name || null,
    sms_opt_out: b.sms_consent === false,
    phone: b.customer?.phone || null,
    already_late: !already && !!(b.metadata && b.metadata.late_reported_at),
  });
}

async function otwSend(req, res) {
  const t = otwToken(req);
  if (!t) return res.status(200).json({ ok: false, reason: 'invalid' });
  const db = serviceClient();

  const { data: b } = await db.from('bookings')
    .select('id, status, on_the_way_at, sms_consent, technician_id, secondary_technician_id, customer:customers(name, phone)')
    .eq('id', t.booking_id).maybeSingle();
  if (!b) return res.status(200).json({ ok: false, reason: 'invalid' });

  if (b.on_the_way_at || !OTW_OPEN_STATUSES.includes(b.status)) {
    return res.status(200).json({ ok: true, already: true, customer: b.customer?.name || 'your customer' });
  }

  const tokenTech = String(t.tech_id || '');
  const onThisJob = tokenTech && (tokenTech === String(b.technician_id) || tokenTech === String(b.secondary_technician_id));
  if (!onThisJob) return res.status(200).json({ ok: false, reason: 'not_assigned' });

  const nowISO = new Date().toISOString();
  const { error: upErr } = await db.from('bookings')
    .update({ status: 'on_the_way', on_the_way_at: nowISO })
    .eq('id', b.id)
    .is('on_the_way_at', null);
  if (upErr) {
    console.error('[otw_send] status update failed:', upErr.message);
    return res.status(200).json({ ok: false, reason: 'error' });
  }

  try { await db.from('technicians').update({ status: 'on_job' }).eq('id', tokenTech); } catch { /* cosmetic */ }

  const sms = await sendEnRouteSms(db, {
    bookingId: b.id,
    technicianId: tokenTech,
    customerPhone: b.customer?.phone,
    smsConsent: b.sms_consent,
  });

  console.log(`[otw_send] booking=${b.id} tech=${tokenTech} marked en route from nudge link; customer text ${sms?.ok ? 'sent' : 'NOT sent (' + (sms?.skipped || sms?.error || 'unknown') + ')'}`);
  return res.status(200).json({
    ok: true, already: false, customer: b.customer?.name || 'your customer',
    sms: { sent: !!sms?.ok, skipped: sms?.skipped || null },
    phone: b.customer?.phone || null,
  });
}

async function reportLate(req, res) {
  const t = otwToken(req);
  if (!t) return res.status(200).json({ ok: false, reason: 'invalid' });
  const db = serviceClient();

  const { data: b } = await db.from('bookings')
    .select(`id, status, on_the_way_at, metadata, scheduled_at, service_area_id, technician_id, secondary_technician_id,
      technician:technicians!technician_id(name),
      secondary_technician:technicians!secondary_technician_id(name),
      customer:customers(name),
      business:businesses(slug, timezone)`)
    .eq('id', t.booking_id).maybeSingle();
  if (!b) return res.status(200).json({ ok: false, reason: 'invalid' });

  if (b.on_the_way_at || !OTW_OPEN_STATUSES.includes(b.status)) {
    return res.status(200).json({ ok: true, already: true, moot: true, customer: b.customer?.name || 'your customer' });
  }

  const tokenTech = String(t.tech_id || '');
  const onThisJob = tokenTech && (tokenTech === String(b.technician_id) || tokenTech === String(b.secondary_technician_id));
  if (!onThisJob) return res.status(200).json({ ok: false, reason: 'not_assigned' });

  const existingMeta = b.metadata || {};
  if (existingMeta.late_reported_at) {
    return res.status(200).json({ ok: true, already: true, customer: b.customer?.name || 'your customer' });
  }

  const nowISO = new Date().toISOString();
  const { data: freshRow, error: reErr } = await db.from('bookings').select('metadata').eq('id', b.id).maybeSingle();
  const freshMeta = (!reErr && freshRow && freshRow.metadata) || existingMeta;
  const newMeta = { ...freshMeta, late_reported_at: nowISO, late_reported_by: tokenTech };
  const { data: updRows, error: upErr } = await db.from('bookings')
    .update({ metadata: newMeta })
    .eq('id', b.id)
    .is('metadata->>late_reported_at', null)
    .select('id');
  if (upErr) {
    console.error('[report_late] metadata update failed:', upErr.message);
    return res.status(200).json({ ok: false, reason: 'error' });
  }
  if (!updRows || !updRows.length) {
    return res.status(200).json({ ok: true, already: true, customer: b.customer?.name || 'your customer' });
  }

  const slug = b.business?.slug || null;
  const officePhone = officePhoneFor(slug);
  if (officePhone) {
    const techName = tokenTech === String(b.technician_id)
      ? b.technician?.name
      : (tokenTech === String(b.secondary_technician_id) ? b.secondary_technician?.name : null);
    const techFirstName = (techName || '').trim().split(/\s+/)[0] || 'Your cleaner';
    const customerName = b.customer?.name || 'the customer';
    let tz = b.business?.timezone || 'Asia/Manila';
    if (b.service_area_id) {
      try {
        const { data: sa } = await db.from('service_areas').select('timezone').eq('id', b.service_area_id).maybeSingle();
        if (sa?.timezone) tz = sa.timezone;
      } catch { /* fall back to business tz */ }
    }
    let whenTxt = 'the scheduled time';
    try {
      whenTxt = new Date(b.scheduled_at).toLocaleString('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit',
      });
    } catch { /* keep fallback */ }
    const msg = `${techFirstName} says they're running late to ${customerName}'s job (${whenTxt}).`;
    const r = await sendSMSResult(officePhone, msg);
    if (!r.ok) console.warn(`[report_late] office SMS failed for booking ${b.id}:`, r.error || r.skipped);
    for (const p of await onDutySecretaryPhones(db, slug)) {
      if (p === toE164(officePhone)) continue;
      const r2 = await sendSMSResult(p, msg);
      if (!r2.ok) console.warn(`[report_late] on-duty secretary SMS failed for booking ${b.id}:`, r2.error || r2.skipped);
    }
  } else {
    console.warn(`[report_late] no office number configured for business (${slug || b.id}), late report not relayed`);
  }

  console.log(`[report_late] booking=${b.id} tech=${tokenTech} reported late`);
  return res.status(200).json({ ok: true, already: false, customer: b.customer?.name || 'your customer' });
}

async function voicemailInfo(req, res) {
  const t = verifyToken(((req.query || {}).token || '').toString());
  if (!t || t.kind !== 'voicemail' || !t.call_id) return res.status(200).json({ ok: false, reason: 'invalid' });
  const db = serviceClient();
  const { data: c } = await db.from('calls')
    .select('id, caller_phone, transcript, occurred_at, service, market, status, claimed_by, claimed_at, business:businesses(name)')
    .eq('id', t.call_id).maybeSingle();
  if (!c) return res.status(200).json({ ok: false, reason: 'invalid' });
  return res.status(200).json({
    ok: true,
    phone: c.caller_phone || null,
    transcript: c.transcript || null,
    occurred_at: c.occurred_at || null,
    service: c.service || null,
    market: c.market || null,
    business: c.business?.name || null,
    claimed_by: c.claimed_by || null,
  });
}

const BOOKING_COUNT_SINCE = { doms: '2026-10-05T07:52:16.681Z' };
async function bookingCountPublic(req, res) {
  const business = ((req.query || {}).business || 'doms').toString().trim();
  const since = BOOKING_COUNT_SINCE[business];
  if (!since) return res.status(400).json({ error: `No booking counter for "${business}"` });
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  const db = serviceClient();
  const { data: biz } = await db.from('businesses').select('id').eq('slug', business).maybeSingle();
  if (!biz) return res.status(404).json({ error: 'Unknown business' });
  const { count, error } = await db.from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', biz.id).gte('created_at', since).neq('status', 'cancelled');
  if (error) return res.status(500).json({ error: 'Count unavailable' });
  return res.status(200).json({ business, since, count: count || 0 });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET' && (req.query || {}).action === 'ics') return serveIcs(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'review_click') return serveReviewClick(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'places_autocomplete') return placesAutocompletePublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'place_details') return placeDetailsPublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'widget_prices') return widgetPricesPublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'coupons') return couponsPublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'multi_tv_discount') return multiTvDiscountPublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'stripe_config') return stripePublicConfig(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'booking_count') return bookingCountPublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'pay_status') return payStatusPublic(req, res);
  if (req.method === 'POST' && ((req.query || {}).action === 'card_setup' || (req.body || {}).action === 'card_setup')) return cardSetupPublic(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'email_config') return emailPublicConfig(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'otw_info') return otwInfo(req, res);
  if (req.method === 'GET' && (req.query || {}).action === 'vm_info') return voicemailInfo(req, res);
  if (req.method === 'POST' && ((req.query || {}).action === 'otw_send' || (req.body || {}).action === 'otw_send')) return otwSend(req, res);
  if (req.method === 'POST' && ((req.query || {}).action === 'report_late' || (req.body || {}).action === 'report_late')) return reportLate(req, res);
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  if (req.body && req.body.business === 'doms') return bookDoms(req, res);
  if (req.body && NATIVE_BUSINESS[req.body.business]) return bookNative(req, res, req.body.business);

  return res.status(410).json({ error: 'Unknown or missing business. Zenbooker is no longer used — pass business=tidyhaus, mile-high, or doms.' });
}
