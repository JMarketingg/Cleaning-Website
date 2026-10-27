import { capName } from './_lib/name-case.js';
import { serviceClient } from './_lib/supabase.js';
import { isBlockedPhone } from './_lib/blocked.js';
import { uploadImage } from './_lib/storage.js';
import { smsNotificationsOn } from './_lib/notify.js';
import { sendSMS, toE164, textConsentFor } from './_lib/sms.js';
import { leadAlertRecipients } from './_lib/lead-alert-recipients.js';
import { sendOwnerEstimateAlert } from './_lib/owner-notify.js';
import { ALL_BUSINESS_SLUGS } from './_lib/native-businesses.js';
import { sendEmail, requestReceivedEmail, brandFor } from './_lib/email.js';

const ALLOWED = new Set(ALL_BUSINESS_SLUGS);

const REQUEST_ACK_SLUGS = new Set(['tvmountinglosangeles']);

const DEFAULT_ESTIMATE_TAX_RATE = 0.0875;

function missingColumn(msg) {
  let m = /Could not find the '([^']+)' column/.exec(msg || '');
  if (m) return m[1];
  m = /column\s+(?:\w+\.)?["']?(\w+)["']?\s+does not exist/i.exec(msg || '');
  return m ? m[1] : null;
}

async function insertResilient(db, table, row, returning = 'id') {
  const payload = { ...row };
  for (let i = 0; i < 8; i++) {
    const { data, error } = await db.from(table).insert(payload).select(returning).single();
    if (!error) return { data, error: null, inserted: payload };
    const col = missingColumn(error.message);
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      console.warn(`[estimate] '${col}' column missing, retrying without it`);
      delete payload[col];
      continue;
    }
    return { data: null, error };
  }
  return { data: null, error: new Error(`insert into ${table} failed after stripping unknown columns`) };
}


function formatPhoneUS(raw) {
  if (!raw) return raw;
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return String(raw).trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = (req.query.action || (req.body && req.body.action) || '').toString();
  try {
    const db = serviceClient();
    if (action === 'services') return await listServices(req, res, db);
    if (action === 'submit')   return await submit(req, res, db);
    return res.status(400).json({ error: `Unknown action "${action}"` });
  } catch (err) {
    console.error('[estimate]', action, err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

async function resolveBusiness(db, slug) {
  if (!ALLOWED.has(slug)) { const e = new Error('Unknown business'); e.status = 400; throw e; }
  const { data, error } = await db.from('businesses').select('id, slug, name, settings').eq('slug', slug).single();
  if (error || !data) { const e = new Error('Business not found'); e.status = 404; throw e; }
  return data;
}

async function listServices(req, res, db) {
  const slug = (req.query.business || '').toString();
  let biz; try { biz = await resolveBusiness(db, slug); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  const { data, error } = await db.from('services')
    .select('id, name, description, sort_order, settings')
    .eq('business_id', biz.id).eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const services = (data || [])
    .filter(s => s.settings && s.settings.estimate_service === true)
    .map(s => ({ id: s.id, name: s.name, description: s.description || '' }));
  return res.status(200).json({ business: { slug: biz.slug, name: biz.name }, services });
}

function sanitizeEstimateLineItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 40).map(it => {
    const raw = it || {};
    const descRaw = raw.description != null ? raw.description
                  : (raw.name != null ? raw.name : raw.label);
    const description = String(descRaw || '').trim().slice(0, 200);
    const qtyRaw = raw.qty != null ? raw.qty : raw.quantity;
    const qty = Math.min(20, Math.max(1, Math.round(Number(qtyRaw) || 1)));
    const unit_price = Math.round((Number(raw.unit_price) || 0) * 100) / 100;
    return { description, qty, unit_price };
  }).filter(it => it.description);
}

function estimateLineItemsTotal(items) {
  return Math.round(items.reduce((s, li) => s + li.qty * li.unit_price, 0) * 100) / 100;
}

const NON_SERVICE_LINE = /^(service minimum|service area surcharge|local travel credit|location|multi-tv|coupon\b|tax\b|after-hours)/i;

function estimateServiceSummary(items, maxLen = 90) {
  const parts = items
    .filter(li => li.unit_price > 0 && !NON_SERVICE_LINE.test(li.description))
    .map(li => {
      let short = li.description.includes(': ')
        ? li.description.slice(li.description.indexOf(': ') + 2)
        : li.description;
      short = short.replace(/^(?:yes|no)\s*[,—-]\s*/i, '').trim();
      return li.qty > 1 ? `${short} x${li.qty}` : short;
    });
  if (!parts.length) return '';
  let out = '';
  for (const p of parts) {
    const next = out ? `${out}, ${p}` : p;
    if (next.length > maxLen) { out = out ? `${out}…` : p.slice(0, maxLen); break; }
    out = next;
  }
  return out;
}

const DASHBOARD_BASE_URL = (process.env.PUBLIC_URL || 'https://tidyhaus-crm.vercel.app').replace(/\/$/, '');
function dashboardEstimateUrl(id) {
  return `${DASHBOARD_BASE_URL}/admin.html?estimate=${encodeURIComponent(id)}`;
}

function estimateAlertText(id, items, taxRate) {
  const subtotal = estimateLineItemsTotal(items);
  const value = Math.round(subtotal * (1 + (Number(taxRate) || 0)));
  const service = estimateServiceSummary(items);
  const url = dashboardEstimateUrl(id);
  return [
    'New Estimate Request',
    `Value: $${value}`,
    service ? `Service: ${service}` : null,
    url || null,
  ].filter(Boolean).join('\n');
}

function cleanAdClick(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {}; let n = 0;
  ['gclid','gbraid','wbraid','gad_campaignid','utm_source','utm_medium','utm_campaign','utm_term'].forEach(k => {
    if (typeof v[k] === 'string' && v[k] && v[k].length <= 200) { out[k] = v[k]; n++; }
  });
  return n ? out : null;
}

async function submit(req, res, db) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  let biz; try { biz = await resolveBusiness(db, (body.business || '').toString()); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }

  const line_items = sanitizeEstimateLineItems(body.line_items);
  const description = (body.description || '').toString().trim()
    || (line_items.length ? `Online booking request: ${line_items.map(li => li.description).slice(0, 8).join(', ')}` : '');
  if (!description) return res.status(400).json({ error: 'Please tell us what you need help with.' });
  if (description.length > 4000) return res.status(400).json({ error: 'Description is too long.' });

  const customer = body.customer || {};
  const name = capName((customer.name || '').toString().trim());
  const phone = formatPhoneUS((customer.phone || '').toString().trim());
  if (await isBlockedPhone(phone)) return res.status(200).json({ ok: true, id: null });
  const zip = (customer.zip || '').toString().trim() || null;
  const address = (customer.address || '').toString().trim().slice(0, 300) || null;
  const city = (customer.city || '').toString().trim().slice(0, 100) || null;
  const state = (customer.state || '').toString().trim().slice(0, 2).toUpperCase() || null;
  if (!name)  return res.status(400).json({ error: 'Your name is required.' });
  if (!phone) return res.status(400).json({ error: 'A phone number is required.' });

  let service_id = null, service_label = (body.service_label || '').toString().trim() || null;
  if (body.service_id) {
    const { data: svc } = await db.from('services')
      .select('id, name').eq('id', body.service_id).eq('business_id', biz.id).maybeSingle();
    if (svc) { service_id = svc.id; service_label = svc.name; }
  }

  let preferred_slots = [];
  if (Array.isArray(body.preferred_slots)) {
    preferred_slots = body.preferred_slots.slice(0, 5).map(s => ({
      date: (s && s.date) ? String(s.date).slice(0, 10) : null,
      slot_key: (s && s.slot_key) ? String(s.slot_key).slice(0, 8) : null,
      label: (s && s.label) ? String(s.label).slice(0, 80) : null,
    })).filter(s => s.date && s.slot_key);
  }

  let photo_url = null, photo_path = null;
  if (body.image) {
    try {
      const up = await uploadImage(body.image, `estimates/${biz.id}`);
      photo_url = up.url; photo_path = up.path;
    } catch (e) {
      console.warn('[estimate] photo upload failed:', e.message);
    }
  }

  const estimateInsert = {
    business_id: biz.id,
    service_id, service_label,
    customer_name: name, customer_phone: phone,
    customer_email: (customer.email || '').toString().trim() || null,
    customer_zip: zip,
    customer_address: address, customer_city: city, customer_state: state,
    description, photo_url, photo_path,
    preferred_slots,
    line_items,
    source: 'widget',
    ad_click: cleanAdClick(body.ad_click),
    sms_consent: await textConsentFor(db, phone),
  };

  const taxRate = Number(body.tax_rate);
  if (Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 0.25) estimateInsert.tax_rate = taxRate;

  const { data: row, error, inserted } = await insertResilient(db, 'estimates', estimateInsert);
  if (error) throw error;

  const notifications = [];

  const alertText = estimateAlertText(row.id, line_items, estimateInsert.tax_rate != null ? estimateInsert.tax_rate : DEFAULT_ESTIMATE_TAX_RATE);
  const isUnstaffedRequest = body.request_type === 'unstaffed_area';
  for (const r of await leadAlertRecipients(db, biz.slug)) {
    notifications.push(sendSMS(r.phone, alertText).catch(e => console.error(`[estimate] ${r.name} sms failed:`, e.message)));
  }

  notifications.push(sendOwnerEstimateAlert({
    slug: biz.slug, businessName: biz.name,
    customer: { name, phone, email: customer.email || null },
    zip, serviceLabel: service_label, description,
    preferredSlots: preferred_slots, photoUrl: photo_url,
  }).catch(e => console.warn('[estimate] owner email failed:', e.message)));

  if (isUnstaffedRequest && REQUEST_ACK_SLUGS.has(biz.slug)) {
    const brand = brandFor(biz.slug);
    const first = name.split(/\s+/)[0] || '';
    if (estimateInsert.sms_consent) {
      const ackText = `${brand.name}: thanks${first ? ', ' + first : ''}, we got your request. We'll text you a written quote and the first open date. Reply STOP to opt out.`;
      notifications.push(sendSMS(phone, ackText).catch(e => console.error('[estimate] customer ack sms failed:', e.message)));
    } else {
      console.warn(`[estimate] ${biz.slug}: customer ack text skipped (no SMS consent on file)`);
    }
    const custEmail = (customer.email || '').toString().trim();
    if (custEmail) {
      const { subject, html } = requestReceivedEmail({
        firstName: first, serviceLabel: service_label, lineItems: line_items,
        preferredSlots: preferred_slots, address, city, state, zip,
      }, brand);
      notifications.push(sendEmail({ slug: biz.slug, to: custEmail, subject, html })
        .catch(e => console.warn('[estimate] customer ack email failed:', e.message)));
    }
  }

  await Promise.allSettled(notifications);

  return res.status(200).json({ ok: true, id: row.id });
}
