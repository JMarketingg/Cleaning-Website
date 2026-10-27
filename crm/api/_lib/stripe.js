
import { demoMode, demoStripeResponse } from './demo.js';
import { createHash, randomUUID } from 'node:crypto';

const STRIPE_API = 'https://api.stripe.com/v1';

const ACCOUNT_KEY_ENV = {
  global:       'STRIPE_SECRET_KEY',
  'tidyhaus': 'TIDYHAUS_STRIPE_SECRET_KEY',
};

const LEGACY_SLUG_ACCOUNT = {
  'tidyhaus': 'global',
};

function selToAccount(sel) {
  const s = typeof sel === 'string' ? { slug: sel } : (sel || {});
  if (s.account && ACCOUNT_KEY_ENV[s.account]) return s.account;
  if (s.account && LEGACY_SLUG_ACCOUNT[s.account]) return LEGACY_SLUG_ACCOUNT[s.account];
  if (s.account) throw new Error(`No Stripe account mapped for "${s.account}" — add it to ACCOUNT_KEY_ENV/LEGACY_SLUG_ACCOUNT in api/_lib/stripe.js`);
  if (s.slug && LEGACY_SLUG_ACCOUNT[s.slug]) return LEGACY_SLUG_ACCOUNT[s.slug];
  if (s.slug) throw new Error(`No Stripe account mapped for business "${s.slug}" — add it to ACCOUNT_KEY_ENV/LEGACY_SLUG_ACCOUNT in api/_lib/stripe.js`);
  return 'global';
}
function envNameFor(sel) { return ACCOUNT_KEY_ENV[selToAccount(sel)]; }

export function stripeConfigured(sel) {
  return demoMode() || !!process.env[envNameFor(sel)];
}

export function businessSecretKey(sel) {
  return process.env[envNameFor(sel)] || null;
}

function secretKey(sel) {
  const env = envNameFor(sel);
  const k = process.env[env];
  if (!k) {
    const acct = selToAccount(sel);
    const e = new Error(acct === 'global'
      ? 'Payments are not configured (STRIPE_SECRET_KEY is missing on the server).'
      : `Payments are not configured for ${acct} (${env} is missing on the server).`);
    e.status = 400; throw e;
  }
  return k;
}

function toForm(obj) {
  const p = new URLSearchParams();
  const add = (k, v) => { if (v !== undefined && v !== null) p.append(k, String(v)); };
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) add(`${k}[${k2}]`, v2);
    } else add(k, v);
  }
  return p;
}

export async function stripe(path, { method = 'POST', body = null, slug = null, account = null, idempotencyKey = null } = {}) {
  if (demoMode()) return demoStripeResponse(path, method, body);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(STRIPE_API + path, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey({ account, slug })}`, 'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? toForm(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    const err = e.name === 'AbortError' ? new Error('Stripe request timed out') : e;
    if (err !== e) err.status = 504;
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data && data.error && data.error.message) || 'Stripe request failed');
    e.status = res.status; e.stripe = (data && data.error) || null;
    throw e;
  }
  return data;
}

export async function findCardOnFileByEmail(email, sel = null) {
  if (!email) return { customerId: null, paymentMethodId: null };
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  const found = await stripe(`/customers?email=${encodeURIComponent(email)}&limit=10`, { method: 'GET', slug, account });
  const list = found.data || [];
  const withPm = list.find(c => c.invoice_settings && c.invoice_settings.default_payment_method) || list[0];
  if (!withPm) return { customerId: null, paymentMethodId: null };
  return { customerId: withPm.id, paymentMethodId: withPm.invoice_settings?.default_payment_method || null };
}

export async function defaultPaymentMethod(customerId, sel = null) {
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  const c = await stripe(`/customers/${customerId}`, { method: 'GET', slug, account });
  if (c.invoice_settings?.default_payment_method) return c.invoice_settings.default_payment_method;
  const pms = await stripe(`/payment_methods?customer=${customerId}&type=card&limit=1`, { method: 'GET', slug, account });
  return (pms.data && pms.data[0] && pms.data[0].id) || null;
}

export async function retrieveCard(paymentMethodId, sel = null) {
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  const pm = await stripe(`/payment_methods/${paymentMethodId}`, { method: 'GET', slug, account });
  const c = pm && pm.card ? pm.card : {};
  return { brand: c.brand || null, last4: c.last4 || null, customer: (typeof pm?.customer === 'string' ? pm.customer : pm?.customer?.id) || null };
}

export async function resolveChargeablePm({ customerId, paymentMethodId, account = null, slug = null }) {
  const acct = { account, slug };
  let card = { brand: null, last4: null, customer: null };
  let lookupOk = false;
  try { card = await retrieveCard(paymentMethodId, acct); lookupOk = true; } catch (_) { /* transient — pass through */ }
  if (!lookupOk || card.customer) return { pmId: paymentMethodId, card };
  let fallback = null;
  try { if (customerId) fallback = await defaultPaymentMethod(customerId, acct); } catch (_) { /* none */ }
  if (!fallback || fallback === paymentMethodId) return { pmId: null, card: { brand: null, last4: null, customer: null } };
  card = { brand: null, last4: null, customer: null };
  lookupOk = false;
  try { card = await retrieveCard(fallback, acct); lookupOk = true; } catch (_) { /* transient */ }
  if (lookupOk && !card.customer) return { pmId: null, card: { brand: null, last4: null, customer: null } };
  return { pmId: fallback, card };
}

export async function stripeUploadFile({ dataBase64, contentType = 'image/png', filename = 'evidence.png', purpose = 'dispute_evidence', account = null, slug = null }) {
  if (demoMode()) return 'file_demo';
  const key = businessSecretKey({ account, slug });
  if (!key) { const e = new Error('Payments are not configured on the server.'); e.status = 400; throw e; }
  const bytes = Buffer.from(dataBase64, 'base64');
  const fd = new FormData();
  fd.append('purpose', purpose);
  fd.append('file', new Blob([bytes], { type: contentType }), filename);
  const res = await fetch('https://files.stripe.com/v1/files', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error((data.error && data.error.message) || 'File upload failed'); e.status = res.status; throw e; }
  return data.id;
}

export async function listOpenDisputes(sel = null, limit = 100) {
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  const out = await stripe(`/disputes?limit=${Math.min(100, limit)}&expand[]=data.charge`, { method: 'GET', slug, account });
  return (out.data || []).filter(d => d.status === 'needs_response' || d.status === 'warning_needs_response');
}

export async function submitDisputeEvidence(disputeId, evidence, sel = null, submit = true) {
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  const clean = {};
  for (const [k, v] of Object.entries(evidence || {})) {
    if (v === null) clean[k] = '';
    else if (v !== undefined && v !== '') clean[k] = v;
  }
  return stripe(`/disputes/${disputeId}`, { method: 'POST', slug, account, body: { evidence: clean, submit } });
}

export async function upcomingPayoutBySlug(slugs) {
  if (demoMode()) {
    const fake = { 'tidyhaus': 8214.50, doms: 5390.75 };
    const out = {};
    for (const slug of slugs || []) out[slug] = fake[slug] != null ? fake[slug] : 4250.00;
    return out;
  }
  const out = {};
  for (const slug of slugs || []) {
    const key = businessSecretKey({ slug });
    if (!key) { out[slug] = null; continue; }
    try {
      const res = await fetch(`${STRIPE_API}/balance`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { console.warn('[stripe payouts]', slug, (data && data.error && data.error.message) || res.status); out[slug] = null; continue; }
      const sumUsd = (arr) => (arr || []).filter(x => x.currency === 'usd').reduce((n, x) => n + Number(x.amount || 0), 0);
      const cents = sumUsd(data.available) + sumUsd(data.pending);
      out[slug] = Math.round(cents) / 100;
    } catch (e) {
      console.warn('[stripe payouts]', slug, e.message);
      out[slug] = null;
    }
  }
  return out;
}

export async function listPayouts(slug, { sinceUnix, untilUnix } = {}) {
  const key = businessSecretKey({ slug });
  if (!key) return [];
  const out = [];
  let startingAfter = null;
  try {
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ limit: '100' });
      if (sinceUnix) params.set('arrival_date[gte]', String(sinceUnix));
      if (untilUnix) params.set('arrival_date[lte]', String(untilUnix));
      if (startingAfter) params.set('starting_after', startingAfter);
      const res = await stripe(`/payouts?${params.toString()}`, { method: 'GET', slug });
      for (const p of (res.data || [])) {
        out.push({
          id: p.id,
          amount: Math.round(Number(p.amount)) / 100,
          arrival_date: new Date(p.arrival_date * 1000).toISOString().slice(0, 10),
          status: p.status,
        });
      }
      if (!res.has_more || !res.data || !res.data.length) break;
      startingAfter = res.data[res.data.length - 1].id;
    }
  } catch (e) {
    console.warn('[stripe payouts] listPayouts failed:', slug, e.message);
  }
  return out;
}

export async function findLandedCharge(bookingId, sel = null) {
  if (demoMode()) return null;
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  try {
    for (const metaKey of ['job_id', 'booking_id']) {
      const q = encodeURIComponent(`metadata['${metaKey}']:'${bookingId}'`);
      const out = await stripe(`/payment_intents/search?query=${q}&limit=10&expand[]=data.latest_charge`, { method: 'GET', slug, account });
      const hit = (out.data || []).find(pi => pi.status === 'succeeded'
        && pi.latest_charge && !pi.latest_charge.refunded && !(Number(pi.latest_charge.amount_refunded) > 0));
      if (hit) {
        return {
          id: hit.id,
          amount: Math.round(Number(hit.amount)) / 100,
          tip: Number(hit.metadata && hit.metadata.tip) || 0,
          customerId: (typeof hit.customer === 'string' ? hit.customer : hit.customer?.id) || null,
          paymentMethodId: (typeof hit.payment_method === 'string' ? hit.payment_method : hit.payment_method?.id) || null,
        };
      }
    }
  } catch (e) {
    console.warn('[stripe reconcile] landed-charge search failed (proceeding without):', e.message);
  }
  return null;
}

export async function findOrCreateCustomer({ email, name, phone, slug = null, account = null }) {
  let customerId = null;
  try {
    const found = await stripe(`/customers?email=${encodeURIComponent(email || '')}&limit=1`, { method: 'GET', slug, account });
    customerId = (found.data && found.data[0] && found.data[0].id) || null;
  } catch (e) { /* fall through to create */ }
  if (!customerId) {
    const c = await stripe('/customers', { method: 'POST', slug, account, body: {
      email: email || undefined, name: name || undefined, phone: phone || undefined,
      description: 'Booking widget customer',
    }});
    customerId = c.id;
  }
  return customerId;
}

export async function setDefaultPaymentMethod(customerId, paymentMethodId, sel = null) {
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  try {
    await stripe(`/customers/${customerId}`, { method: 'POST', slug, account, body: {
      invoice_settings: { default_payment_method: paymentMethodId },
    }});
    return true;
  } catch (e) {
    console.warn('[stripe setDefaultPaymentMethod] failed (non-fatal):', e.message);
    return false;
  }
}

export async function createCardSetupIntent({ email, name, phone, slug = null, account = null }) {
  const customerId = await findOrCreateCustomer({ email, name, phone, slug, account });
  const si = await stripe('/setup_intents', { method: 'POST', slug, account, body: {
    customer: customerId, usage: 'off_session', 'payment_method_types[0]': 'card',
  }});
  return { clientSecret: si.client_secret, customerId };
}

export async function saveCardOnFile({ email, name, phone, paymentMethodId, slug = null, account = null }) {
  if (!paymentMethodId) return { customerId: null };
  const customerId = await findOrCreateCustomer({ email, name, phone, slug, account });
  await stripe(`/payment_methods/${paymentMethodId}/attach`, { method: 'POST', slug, account, body: { customer: customerId } });
  try {
    await stripe(`/customers/${customerId}`, { method: 'POST', slug, account, body: {
      invoice_settings: { default_payment_method: paymentMethodId },
    }});
  } catch (e) {
    console.warn('[stripe saveCardOnFile] card attached but set-default failed (card IS on file):', e.message);
  }
  return { customerId };
}


function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

export function chargeIntentBody({ bookingId, cents, tip, customerId, paymentMethodId, businessSlug, balanceKey = null }) {
  return {
    amount: cents, currency: 'usd',
    customer: customerId, payment_method: paymentMethodId,
    description: balanceKey ? `Booking ${bookingId} balance` : `Booking ${bookingId}`,
    metadata: { booking_id: bookingId, job_id: bookingId, business: businessSlug || '', tip: String(tip), ...(balanceKey ? { balance: String(balanceKey) } : {}) },
  };
}

export function chargeIntentKey(body, { priorPiId = null } = {}) {
  const { tip, ...metaNoTip } = body.metadata || {};
  const h = createHash('sha256').update(stableStringify({ ...body, metadata: metaNoTip })).digest('hex').slice(0, 8);
  return `charge2-${body.metadata.booking_id}-${body.amount}-${String(body.payment_method).slice(-8)}-${h}`
    + (priorPiId ? `-after-${String(priorPiId).slice(-8)}` : '');
}

const HARD_DECLINES = new Set(['lost_card', 'stolen_card', 'pickup_card', 'fraudulent', 'do_not_try_again', 'restricted_card', 'security_violation', 'revocation_of_all_authorizations', 'revocation_of_authorization', 'merchant_blacklist', 'stop_payment_order', 'no_action_taken']);
const SOFT_DECLINES = new Set(['try_again_later', 'issuer_not_available', 'processing_error', 'reenter_transaction', 'card_velocity_exceeded', 'withdrawal_count_limit_exceeded', 'approve_with_id', 'call_issuer']);
const BAD_DETAILS   = new Set(['incorrect_cvc', 'invalid_cvc', 'incorrect_number', 'invalid_number', 'incorrect_zip', 'invalid_account', 'new_account_information_available', 'expired_card', 'invalid_expiry_month', 'invalid_expiry_year']);
export function friendlyChargeError(e) {
  const s = (e && e.stripe) || {};
  e.code = s.code || e.code || null;
  e.decline_code = s.decline_code || null;
  e.needs_new_card = false; e.retryable = false;
  const dc = e.decline_code || '';
  if (s.type === 'idempotency_error') {
    e.message = 'Stripe rejected this as a mismatched repeat of an earlier attempt. Try once more; if it persists, tell the office.'; e.retryable = true;
  } else if (s.type === 'card_error' || e.code === 'card_declined') {
    if (e.code === 'authentication_required' || dc === 'authentication_required') { e.message = 'This card requires the customer to verify with their bank, which cannot be done from the app. Ask for a different card or take cash.'; e.needs_new_card = true; }
    else if (dc === 'insufficient_funds') { e.message = 'Card declined: insufficient funds. Ask the customer for another card, or take cash.'; e.needs_new_card = true; }
    else if (HARD_DECLINES.has(dc)) { e.message = 'The bank blocked this card. Do not retry it — ask for a different card or take cash.'; e.needs_new_card = true; }
    else if (BAD_DETAILS.has(dc) || BAD_DETAILS.has(e.code)) { e.message = 'The card on file is expired or its details are out of date. Enter a different card, or take cash.'; e.needs_new_card = true; }
    else if (SOFT_DECLINES.has(dc)) { e.message = 'The bank could not process this right now. Wait a minute and try again — no charge was made.'; e.retryable = true; }
    else { e.message = `The bank declined this card${s.message ? ` (${String(s.message).replace(/\.$/, '')})` : ''}. The customer can call their bank, try another card, or pay cash.`; e.needs_new_card = true; }
  } else if (e.status === 504 || e.status >= 500 || e.code === 'lock_timeout' || s.type === 'api_error') {
    e.message = 'Stripe could not process this right now. Wait a minute and try again — no charge was made.'; e.retryable = true;
  }
  return e;
}

const piCharge = (p) => (p && p.latest_charge && typeof p.latest_charge === 'object') ? p.latest_charge : null;
const piChargeId = (p) => { const c = piCharge(p); return c ? (c.id || null) : ((p && p.latest_charge) || null); };
const piFullyRefunded = (p) => { const c = piCharge(p); return !!(c && (c.refunded === true || (Number(c.amount_refunded) > 0 && Number(c.amount_refunded) >= Number(c.amount || p.amount)))); };
const piPartlyRefunded = (p) => { const c = piCharge(p); return !!(c && Number(c.amount_refunded) > 0 && !piFullyRefunded(p)); };

export async function pendingIntentState(paymentIntentId, sel = null) {
  if (!paymentIntentId || demoMode()) return { state: 'unknown', landed: null };
  const { account = null, slug = null } = typeof sel === 'string' ? { slug: sel } : (sel || {});
  let pi = null;
  try { pi = await stripe(`/payment_intents/${paymentIntentId}?expand[]=latest_charge`, { method: 'GET', slug, account }); }
  catch (e) { console.warn('[stripe pending] lookup failed (proceeding without):', e.message); return { state: 'unknown', landed: null }; }
  if (pi.status === 'succeeded') {
    if (piFullyRefunded(pi) || piPartlyRefunded(pi)) return { state: 'refunded', landed: null };
    return { state: 'succeeded', landed: {
      id: pi.id,
      amount: Math.round(Number(pi.amount)) / 100,
      tip: Number(pi.metadata && pi.metadata.tip) || 0,
      customerId: (typeof pi.customer === 'string' ? pi.customer : pi.customer?.id) || null,
      paymentMethodId: (typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id) || null,
    } };
  }
  if (pi.status === 'processing') return { state: 'processing', landed: null };
  return { state: 'open', landed: null };
}

export async function chargeCardOnFile({ bookingId, cents, tip, customerId, paymentMethodId, receiptEmail = null, businessSlug = null, priorPiId = null, balanceKey = null, account = null, slug = null, log = '[charge]' }) {
  const acct = { account, slug };
  const body = chargeIntentBody({ bookingId, cents, tip, customerId, paymentMethodId, businessSlug, balanceKey });

  if (demoMode()) {
    const pi = await stripe('/payment_intents', { ...acct, body: { ...body, off_session: true, confirm: true, receipt_email: receiptEmail || undefined } });
    return { pi, recovered: false };
  }

  const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status }, extra);
  const getPi = (id) => stripe(`/payment_intents/${id}?expand[]=latest_charge`, { method: 'GET', ...acct });
  const create = (key) => stripe('/payment_intents', { ...acct, idempotencyKey: key, body });
  const chargeIdOf = piChargeId, fullyRefunded = piFullyRefunded, partlyRefunded = piPartlyRefunded;
  const normalize = (p) => ({ ...p, latest_charge: chargeIdOf(p) });
  const STILL_PROCESSING = 'A charge for this booking is still processing at the bank — wait a minute and check the booking before charging again.';
  const IN_PROGRESS = 'This charge is already in progress from another device (office or cleaner app) — wait a moment and check whether it went through before trying again.';
  const decide = (p) => {
    if (p.status === 'succeeded') {
      if (Number(p.amount) !== cents) throw fail(409, `Stripe holds a succeeded payment for this booking at a different amount (₱${(Number(p.amount) / 100).toFixed(2)}, ${p.id}) — check Stripe before charging again.`);
      if (partlyRefunded(p)) throw fail(409, `Stripe holds a partly refunded payment for this booking (${p.id}) — check Stripe before charging again.`);
      return fullyRefunded(p) ? 'successor' : 'adopt';
    }
    if (p.status === 'canceled') return 'successor';
    if (p.status === 'processing') throw fail(409, STILL_PROCESSING, { payment_intent_id: p.id });
    if (p.status === 'requires_capture') throw fail(409, `Stripe holds an uncaptured authorization for this booking (${p.id}) — check Stripe before charging again.`);
    return 'confirm';
  };

  let pi = null;
  if (priorPiId) {
    let prior = null;
    try { prior = await getPi(priorPiId); } catch (_) { /* unknown — proceed */ }
    if (prior && prior.status === 'succeeded') {
      if (partlyRefunded(prior)) throw fail(409, `The charge recorded on this booking (${prior.id}) was only partly refunded — check Stripe before charging again.`);
      if (!fullyRefunded(prior)) {
        console.warn(`${log} booking=${bookingId} recorded intent ${prior.id} already succeeded — adopting, no new charge`);
        return { pi: normalize(prior), recovered: true };
      }
    } else if (prior && (prior.status === 'processing' || prior.status === 'requires_capture')) {
      decide(prior);
    } else if (prior && prior.status !== 'canceled') {
      const patch = {};
      if (Number(prior.amount) !== cents) patch.amount = cents;
      const pmNow = (typeof prior.payment_method === 'string' ? prior.payment_method : (prior.payment_method && prior.payment_method.id)) || null;
      if (pmNow !== paymentMethodId) patch.payment_method = paymentMethodId;
      if (String((prior.metadata && prior.metadata.tip) ?? '') !== String(tip)) patch.metadata = { tip: String(tip) };
      pi = prior;
      if (Object.keys(patch).length) {
        try { await stripe(`/payment_intents/${prior.id}`, { ...acct, body: patch }); pi = await getPi(prior.id); }
        catch (e) {
          const s = e.stripe || {};
          if (e.status === 429 || s.code === 'lock_timeout') throw fail(409, IN_PROGRESS, { code: s.code || null, payment_intent_id: prior.id });
          console.warn(`${log} booking=${bookingId} could not re-use intent ${prior.id} (${e.message}); creating a fresh one`);
          pi = null;
        }
      }
      if (pi) console.warn(`${log} booking=${bookingId} re-using recorded intent ${pi.id} (${pi.status})`);
    }
  }

  let key = chargeIntentKey(body, { priorPiId });
  if (!pi) {
    let created;
    try {
      created = await create(key);
    } catch (e) {
      const t = e.stripe && e.stripe.type, c = e.stripe && e.stripe.code;
      if (e.status === 400 && t === 'idempotency_error') {
        console.warn(`${log} booking=${bookingId} idempotency_error under ${key} — reconciling`);
        const landed = balanceKey ? null : await findLandedCharge(bookingId, acct);
        if (landed) { console.warn(`${log} booking=${bookingId} adopting landed intent ${landed.id}`); return { pi: normalize(await getPi(landed.id)), recovered: true }; }
        key = `${key}-r1`;
        created = await create(key);
      } else if (e.status === 409 && c === 'idempotency_key_in_use') {
        throw fail(409, IN_PROGRESS, { code: c });
      } else {
        throw friendlyChargeError(e);
      }
    }
    pi = await getPi(created.id);
  }
  let next = decide(pi);
  if (next === 'successor') {
    const spent = pi.id;
    key = `${key}-after-${String(spent).slice(-8)}`;
    console.warn(`${log} booking=${bookingId} intent ${spent} is spent (${pi.status}); creating successor under ${key}`);
    const successor = await create(key);
    pi = await getPi(successor.id);
    next = decide(pi);
    if (next === 'successor') throw fail(409, `Stripe already holds a used payment for this booking at this amount (${pi.id}) — check Stripe before charging again.`);
  }
  if (next === 'adopt') {
    console.warn(`${log} booking=${bookingId} intent ${pi.id} already succeeded (idempotent replay) — adopting, no new charge`);
    return { pi: normalize(pi), recovered: true };
  }

  console.info(`${log} booking=${bookingId} confirming intent ${pi.id} (${pi.status}) key=${key}`);
  const chargeBefore = chargeIdOf(pi);
  try {
    pi = await stripe(`/payment_intents/${pi.id}/confirm`, { ...acct, idempotencyKey: `confirm-${pi.id}-${randomUUID()}`, body: {
      payment_method: paymentMethodId, off_session: true, error_on_requires_action: true, receipt_email: receiptEmail || undefined,
    }});
  } catch (e) {
    const s = e.stripe || {};
    console.warn(`${log} booking=${bookingId} intent=${pi.id} confirm failed: http=${e.status} type=${s.type} code=${s.code} decline=${s.decline_code} ${s.request_log_url || ''} — ${e.message}`);
    if (s.type === 'card_error') { e.status = 402; throw friendlyChargeError(e); }
    let live = null;
    for (let i = 0; i < 2 && !live; i++) { try { live = await getPi(pi.id); } catch (_) { /* one retry */ } }
    if (!live) throw fail(504, `Stripe did not answer while confirming this charge (${e.message}). It MAY have gone through — refresh the booking before trying again; a retry at the same amount and card resumes this exact payment (${pi.id}) instead of charging twice.`, { code: s.code || null, stripe: e.stripe || null, payment_intent_id: pi.id });
    if (live.status === 'succeeded') {
      if (!fullyRefunded(live) && !partlyRefunded(live) && Number(live.amount) === cents) return { pi: normalize(live), recovered: false };
      throw fail(409, `Stripe holds a succeeded payment for this booking (${live.id}) that does not match this charge — check Stripe before charging again.`);
    }
    if (live.status === 'processing') throw fail(409, STILL_PROCESSING, { payment_intent_id: live.id });
    if (live.status === 'canceled') throw fail(409, `Stripe canceled this payment attempt (${live.id}) — check Stripe, then charge again (the next attempt starts a fresh payment).`);
    const liveCharge = chargeIdOf(live);
    if (liveCharge && liveCharge !== chargeBefore && live.last_payment_error && live.last_payment_error.type === 'card_error') {
      throw friendlyChargeError(fail(402, live.last_payment_error.message || 'Your card was declined.', { stripe: live.last_payment_error }));
    }
    if (e.status === 429 || s.code === 'lock_timeout') {
      throw fail(409, IN_PROGRESS, { code: s.code || null, stripe: e.stripe || null, payment_intent_id: pi.id });
    }
    if (e.status !== 400) {
      throw fail(504, `Stripe did not answer while confirming this charge and it MAY still be going through at the bank (${pi.id}). Refresh the booking before taking cash or charging again; a retry at the same amount and card resumes this exact payment instead of charging twice.`, { code: s.code || null, stripe: e.stripe || null, payment_intent_id: pi.id });
    }
    e.status = e.status || 402;
    throw friendlyChargeError(e);
  }
  if (pi.status !== 'succeeded') {
    if (pi.status === 'processing') throw fail(409, STILL_PROCESSING, { payment_intent_id: pi.id });
    const lpe = pi.last_payment_error || null;
    throw friendlyChargeError(fail(402, `Charge not completed (status: ${pi.status}). ${(lpe && lpe.message) || 'The card may need the customer to re-authenticate.'}`,
      { stripe: lpe || { type: 'card_error', code: 'authentication_required', message: 'This card needs the customer to authenticate with their bank.' } }));
  }
  return { pi: normalize(pi), recovered: false };
}
