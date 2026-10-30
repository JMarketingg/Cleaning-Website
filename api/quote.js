// Receives a quote request from /book and sends two emails through Resend:
// one to the owner, and a confirmation to the customer if they gave an email.
// The browser also sends the request to the CRM's Quote Requests (see book.js).
// Settings (Vercel environment variables): RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, CONFIRM_SECRET,
// and optionally TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID for a Telegram alert to the owner.
const crypto = require('crypto');
const mail = require('./_email');

const FIELDS = {
  area: 'Area', service: 'Service', place: 'Place', size: 'Size', frequency: 'How often',
  date: 'Preferred date', time: 'Time', name: 'Name', phone: 'Mobile', email: 'Email',
  building: 'Building / street', notes: 'Notes', price: 'Price', payment: 'Payment', promo: 'Promo code'
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function table(rows) {
  return '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;color:#26372D">' +
    rows.map(([k, v]) => `<tr><td style="font-weight:bold;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('') +
    '</table>';
}

// Link to the owner-only /confirm page with this request filled in.
// The details go after "#" so they never reach the server or its logs.
// The signature proves the link came from us, so /confirm needs no password.
function confirmLink(d) {
  const prefill = { ref: d.ref, name: d.name, email: d.email, phone: d.phone, service: d.service, size: d.size,
    date: d.date, time: d.time, price: d.price, payment: d.payment, address: [d.building, d.area].filter(Boolean).join(', '), notes: d.notes };
  const b64 = Buffer.from(JSON.stringify(prefill)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.CONFIRM_SECRET).update(b64).digest('base64url');
  return 'https://tidyhausph.com/confirm#' + b64 + '.' + sig;
}

// Free instant alert to the owner's Telegram. Skipped until both settings are added.
async function sendTelegram(text) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
}

async function sendEmail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // Lets us check setup without sending anything.
    const ready = Boolean(process.env.RESEND_API_KEY && process.env.OWNER_EMAIL && process.env.FROM_EMAIL);
    return res.status(200).json({ ready });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const { RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, CONFIRM_SECRET } = process.env;
  if (!RESEND_API_KEY || !OWNER_EMAIL || !FROM_EMAIL || !CONFIRM_SECRET) {
    return res.status(503).json({ ok: false, error: 'Not set up yet' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  // Hidden field that people never fill in; bots usually do.
  if (body.website) return res.status(200).json({ ok: true });

  const data = {};
  for (const key of Object.keys(FIELDS)) {
    const v = typeof body[key] === 'string' ? body[key].trim().slice(0, 500) : '';
    if (v) data[key] = v;
  }
  const phone = (data.phone || '').replace(/[\s()-]/g, '');
  if (!data.name || !/^(\+?63|0)9\d{9}$/.test(phone) || !data.service || !data.date) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid details' });
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email' });
  }

  data.ref = mail.bookingRef();
  const rows = [['Booking reference', data.ref]].concat(Object.keys(FIELDS).filter((k) => data[k]).map((k) => [FIELDS[k], data[k]]));

  try {
    await sendEmail({
      from: FROM_EMAIL,
      to: OWNER_EMAIL,
      reply_to: data.email || undefined,
      subject: `New booking request ${data.ref}: ${data.service}, ${data.area || ''} (${data.name})`,
      html: `<h2 style="font-family:Arial,sans-serif;color:#26372D">New booking request</h2>${table(rows)}
<p style="margin-top:20px"><a href="${confirmLink(data)}" style="background:#344B38;color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold">Confirm this booking</a></p>`
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'Could not send' });
  }

  try {
    await sendTelegram([
      `🧹 New booking request ${data.ref}`,
      `${data.name} · ${data.phone}`,
      `${data.service}${data.size ? ', ' + data.size : ''}`,
      `${data.date}, ${data.time || ''}`,
      [data.building, data.area].filter(Boolean).join(', '),
      [data.price, data.payment].filter(Boolean).join(' · '),
      'Confirm it from your email.'
    ].filter(Boolean).join('\n'));
  } catch (e) {
    // The email already went out, so a failed Telegram alert isn't fatal.
    console.error(e);
  }

  if (data.email) {
    try {
      await sendEmail({
        from: FROM_EMAIL,
        to: data.email,
        reply_to: OWNER_EMAIL,
        subject: `We got your booking request (${data.ref}) — TidyHaus`,
        html: mail.layout({
          preheader: `Request ${data.ref}: ${data.service} on ${data.date}. We'll confirm soon.`,
          badge: 'Booking request received',
          title: `Thanks, ${data.name.split(' ')[0]}! We got your request.`,
          intro: `Your booking reference is <strong style="white-space:nowrap;">${mail.esc(data.ref)}</strong>. Keep it handy if you text or call us. This is a request, not a confirmed booking yet. We'll confirm your date and time soon.`,
          body: mail.card([
            ['Date', data.date], ['Time', data.time], ['Service', data.service], ['Place', data.place], ['Size', data.size],
            ['How often', data.frequency], ['Address', [data.building, data.area].filter(Boolean).join(', ')],
            ['Price per visit', data.price], ['Payment', data.payment]
          ]) +
          mail.section('What happens next', mail.list([
            'We check your date, time and address.',
            'We email your booking confirmation with your payment details.',
            'Our cleaner arrives and follows our room-by-room checklist.'
          ], true)) +
          mail.section('Need to change something?', `<p style="font-family:Arial,Helvetica,sans-serif;margin:0;font-size:15px;line-height:1.6;color:#26372D;">Reply to this email, or text or call us at <a href="tel:+639923095621" style="color:#344B38;font-weight:bold;">+63 992 309 5621</a>.</p>`)
        })
      });
    } catch (e) {
      // The owner already has the request, so a failed confirmation isn't fatal.
      console.error(e);
    }
  }

  return res.status(200).json({ ok: true });
};
