// Sends a booking confirmation email to a customer. Used by /confirm, the owner-only page.
// After sending, it marks the customer's open request in the CRM's Quote Requests as booked.
// Settings (Vercel environment variables): RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, CONFIRM_SECRET,
// and for the CRM: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const crypto = require('crypto');
const mail = require('./_email');
const bm = require('./_booking-mail');

// Checks the signed link from the owner's email (see confirmLink in quote.js).
// Returns the signed request details, or null if the link was changed or made up.
function readToken(token, secret) {
  const [b64, sig] = String(token || '').split('.');
  if (!b64 || !sig) return null;
  const want = crypto.createHmac('sha256', secret).update(b64).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')); } catch (e) { return null; }
}

async function sendEmail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// Same format the CRM stores phone numbers in.
function phPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(d)) return '+63' + d.slice(1);
  if (/^639\d{9}$/.test(d)) return '+' + d;
  if (/^9\d{9}$/.test(d)) return '+63' + d;
  // International numbers, saved the same way the CRM saves them.
  if (/^\s*\+/.test(String(raw)) && !/^63/.test(d) && d.length >= 8 && d.length <= 15) return '+' + d;
  return null;
}

function crmHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'app', 'Content-Profile': 'app', 'Content-Type': 'application/json' };
}
async function crm(path, opts = {}) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...crmHeaders(), ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// Marks this customer's latest open quote request as booked. Returns its id, or null if none was found.
async function markBookedInCrm(phone) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const p = phPhone(phone);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !p) return null;
  const rows = await crm(`quote_requests?select=id&phone=eq.${encodeURIComponent(p)}&status=in.(new,contacted)&order=created_at.desc&limit=1`);
  if (!rows.length) return null;
  await crm(`quote_requests?id=eq.${rows[0].id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'booked', updated_at: new Date().toISOString() })
  });
  return rows[0].id;
}

// "20270112T010000Z" -> "2027-01-12T01:00:00Z"
function isoFromCompact(c) { return c.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'); }

// Creates the job in the CRM so it shows in the cleaner's app. If TidyHaus has exactly one active
// cleaner, the job is assigned to them. Returns the new booking id, or null if the CRM isn't set up.
async function createCrmJob(d, quoteId) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const [biz] = await crm('businesses?select=id&slug=eq.tidyhaus&limit=1');
  if (!biz) return null;
  const phone = phPhone(d.phone);

  // Find or add the customer.
  let customer = phone ? (await crm(`customers?select=id&business_id=eq.${biz.id}&phone=eq.${encodeURIComponent(phone)}&limit=1`))[0] : null;
  if (!customer) {
    [customer] = await crm('customers', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ business_id: biz.id, name: d.name, phone, email: d.email || null, address_line1: d.address || null, city: 'Metro Manila' })
    });
  }

  // Match the service by its first word (Standard, Condo, Deep, Move, Airbnb, Office).
  const services = await crm(`services?select=id,name&business_id=eq.${biz.id}&active=eq.true`);
  const first = String(d.service).split(/[\s/&-]+/)[0].toLowerCase();
  const service = services.find((s) => s.name.toLowerCase().startsWith(first)) ||
    (first === 'standard' ? services.find((s) => /^house|^standard/i.test(s.name)) : null);

  // Aircon jobs go to the AC cleaner (bio says "Aircon cleaner"); cleaning jobs to the cleaners. If exactly one fits, plan them.
  const allTechs = await crm(`technicians?select=id,bio_blurb&business_id=eq.${biz.id}&active=eq.true`);
  const isAc = /aircon/i.test(String(d.service));
  const cleaners = allTechs.filter((t) => /aircon/i.test(String(t.bio_blurb || '')) === isAc);
  const times = mail.cleanTimes(d.date, d.time);
  const price = Number((String(d.price).match(/₱?\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || 0);
  const start = times ? isoFromCompact(times.start) : null;
  const end = times ? isoFromCompact(times.end) : null;

  const [booking] = await crm('bookings', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      business_id: biz.id, customer_id: customer.id, service_id: service ? service.id : null,
      // Not reserved until the deposit is paid: the job stays "pending" and the cleaner is only
      // assigned when the owner marks the deposit paid (so the cleaner app doesn't show it yet).
      technician_id: null,
      status: 'pending', source: 'website_form', payment_status: 'unpaid',
      scheduled_at: start, scheduled_end: end,
      duration_minutes: start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : null,
      price, subtotal: price, address_line1: d.address || null, city: 'Metro Manila',
      customer_notes: d.notes || null,
      notes: [d.size && `Size: ${d.size}`, d.payment && `Payment: ${d.payment}`, d.ref && `Ref: ${d.ref}`].filter(Boolean).join('\n') || null,
      metadata: {
        ref: d.ref || null, payment: d.payment || null, from: 'website', quote_request_id: quoteId || null,
        deposit_required: true, deposit_amount: d.deposit ? d.deposit.deposit : null, deposit_full: !!(d.deposit && d.deposit.full),
        deposit_requested_at: new Date().toISOString(), policy_version: '2026-11', planned_technician_id: cleaners.length === 1 ? cleaners[0].id : null,
        // "₱200 travel fee" in the price note means the place is outside Makati and BGC.
        travel_fee: (String(d.price).match(/₱\s*([\d,]+) travel fee/i) || [])[1] ? Number(String(d.price).match(/₱\s*([\d,]+) travel fee/i)[1].replace(/,/g, '')) : null,
        // With a promo, the first visit is cheaper; regular visits after it use this price.
        per_visit_price: (String(d.price).match(/then ₱\s*([\d,]+) per visit/i) || [])[1] ? Number(String(d.price).match(/then ₱\s*([\d,]+) per visit/i)[1].replace(/,/g, '')) : null
      }
    })
  });
  if (quoteId) {
    await crm(`quote_requests?id=eq.${quoteId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ booking_id: booking.id }) });
  }
  return booking.id;
}

const FIELDS = ['name', 'email', 'phone', 'service', 'size', 'date', 'time', 'address', 'price', 'payment', 'notes'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const { RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, CONFIRM_SECRET } = process.env;
  if (!RESEND_API_KEY || !OWNER_EMAIL || !FROM_EMAIL || !CONFIRM_SECRET) {
    return res.status(503).json({ ok: false, error: 'Not set up yet' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const signed = readToken(body.token, CONFIRM_SECRET);
  if (!signed) {
    return res.status(401).json({ ok: false, error: 'Open this page from the button in the request email' });
  }

  const d = {};
  for (const k of FIELDS) d[k] = typeof body[k] === 'string' ? body[k].trim().slice(0, 300) : '';
  // The email and phone come from the signed link, so the link can't be reused to email anyone else.
  d.email = signed.email || '';
  d.phone = signed.phone || '';
  if (!d.name || !d.service || !d.date || !d.time || !d.price) {
    return res.status(400).json({ ok: false, error: 'Fill in name, service, date, time and price' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    return res.status(400).json({ ok: false, error: 'The customer needs a valid email address' });
  }

  const ref = /^TH-[A-Z0-9]{6}$/.test(signed.ref || '') ? signed.ref : '';
  // Deposit policy (Nov 2026): this email asks for the 25% deposit (or the full amount if the
  // cleaning is less than 24 hours away). "Confirmed" is sent later, when the deposit is marked paid in the CRM.
  const times = mail.cleanTimes(d.date, d.time);
  const startIso = times ? isoFromCompact(times.start) : null;
  const price = Number((String(d.price).match(/₱?\s*([\d,]+)/) || [])[1]?.replace(/,/g, '') || 0);
  if (!price) return res.status(400).json({ ok: false, error: 'Write the price as a number, like ₱1,500' });
  const reqMail = bm.depositRequest({ ...d, price, start: startIso, ref });

  try {
    await sendEmail({
      from: FROM_EMAIL,
      to: d.email,
      bcc: OWNER_EMAIL,
      reply_to: OWNER_EMAIL,
      subject: reqMail.subject,
      html: reqMail.html
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'Could not send the email' });
  }
  d.deposit = reqMail.dep;
  let crmUpdated = false;
  let jobCreated = false;
  try {
    const quoteId = await markBookedInCrm(d.phone);
    crmUpdated = !!quoteId;
    // Confirming the same booking again (e.g. to resend the email) must not make a second job.
    const dup = ref ? await crm(`bookings?select=id&metadata->>ref=eq.${ref}&limit=1`) : [];
    jobCreated = dup.length ? false : !!(await createCrmJob({ ...d, ref }, quoteId));
  } catch (e) {
    // The confirmation already went out; the owner can update the CRM by hand.
    console.error(e);
  }
  return res.status(200).json({ ok: true, crmUpdated, jobCreated });
};
