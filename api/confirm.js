// Sends a booking confirmation email to a customer. Used by /confirm, the owner-only page.
// After sending, it marks the customer's open request in the CRM's Quote Requests as booked.
// Settings (Vercel environment variables): RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, CONFIRM_SECRET,
// and for the CRM: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const crypto = require('crypto');
const mail = require('./_email');

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
  return null;
}

// Marks this customer's latest open quote request as booked. Returns true if one was updated.
async function markBookedInCrm(phone) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const p = phPhone(phone);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !p) return false;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Accept-Profile': 'app',
    'Content-Profile': 'app',
    'Content-Type': 'application/json'
  };
  const base = `${SUPABASE_URL}/rest/v1/quote_requests`;
  const find = await fetch(`${base}?select=id&phone=eq.${encodeURIComponent(p)}&status=in.(new,contacted)&order=created_at.desc&limit=1`, { headers });
  if (!find.ok) throw new Error(`CRM ${find.status}: ${await find.text()}`);
  const rows = await find.json();
  if (!rows.length) return false;
  const upd = await fetch(`${base}?id=eq.${rows[0].id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'booked', updated_at: new Date().toISOString() })
  });
  if (!upd.ok) throw new Error(`CRM ${upd.status}: ${await upd.text()}`);
  return true;
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
  const cal = mail.calendarLink(d.date, d.time, d.address);
  const ics = mail.icsLink(d.date, d.time, d.address);
  const p = (t) => `<p style="font-family:Arial,Helvetica,sans-serif;margin:0 0 8px;font-size:15px;line-height:1.6;color:#26372D;">${t}</p>`;
  const html = mail.layout({
    preheader: `Confirmed: ${d.service} on ${d.date}, ${d.time}.`,
    badge: 'Booking confirmed',
    title: `You're all set, ${d.name.split(' ')[0]}!`,
    intro: `Your cleaning is <strong>confirmed</strong>. We've saved your date and time${ref ? `. Your booking reference is <strong style="white-space:nowrap;">${mail.esc(ref)}</strong>` : ''}.`,
    body: mail.card([
      ['Date', d.date], ['Time', d.time], ['Address', d.address], ['Service', d.service],
      ['Size', d.size], ['Price per visit', d.price], ['Payment', d.payment], ['Payment details and notes', d.notes]
    ]) +
    (cal ? `<p style="margin:16px 0 0;">${mail.button(cal, 'Google Calendar')}&nbsp; ${mail.button(ics, 'Apple or Outlook calendar')}</p>` : '') +
    mail.section("What we'll clean", mail.list([
      '<strong>Living areas:</strong> dust shelves and surfaces, wipe tables, sweep and mop, tidy up, take out the trash',
      '<strong>Kitchen:</strong> wipe the counters, clean the sink, wipe the outside of appliances, sweep and mop',
      '<strong>Bedrooms:</strong> dust, make beds, wipe mirrors, sweep and mop',
      '<strong>Bathrooms:</strong> clean the toilet, sink and shower, wipe mirrors and counters, sweep and mop'
    ]) + p('See the full list at <a href="https://tidyhausph.com/#checklist" style="color:#344B38;font-weight:bold;">tidyhausph.com</a>.')) +
    mail.section('Before we arrive', mail.list([
      "If your building needs our cleaner's name or ID, we'll send it before the visit.",
      "For safety, give door codes in person or leave them with your building's guard or reception, not by message.",
      'Put away valuables and anything you don\'t want us to move.'
    ])) +
    mail.section('Our promise', p("If we miss anything on the checklist, tell us within 24 hours and we'll come back to fix it for free.")) +
    mail.section('Need to change something?', p('Reply to this email, or text or call us at <a href="tel:+639923095621" style="color:#344B38;font-weight:bold;">+63 992 309 5621</a>.'))
  });

  try {
    await sendEmail({
      from: FROM_EMAIL,
      to: d.email,
      bcc: OWNER_EMAIL,
      reply_to: OWNER_EMAIL,
      subject: `Confirmed: your TidyHaus cleaning on ${d.date}`,
      html
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'Could not send the email' });
  }
  let crmUpdated = false;
  try {
    crmUpdated = await markBookedInCrm(d.phone);
  } catch (e) {
    // The confirmation already went out; the owner can update the CRM by hand.
    console.error(e);
  }
  return res.status(200).json({ ok: true, crmUpdated });
};
