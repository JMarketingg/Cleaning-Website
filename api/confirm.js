// Sends a booking confirmation email to a customer. Used by /confirm, the owner-only page.
// Settings (Vercel environment variables): RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, ADMIN_PASSWORD.
const crypto = require('crypto');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function samePassword(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

async function sendEmail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

const FIELDS = ['name', 'email', 'phone', 'service', 'size', 'date', 'time', 'address', 'price', 'payment', 'notes'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const { RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!RESEND_API_KEY || !OWNER_EMAIL || !FROM_EMAIL || !ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, error: 'Not set up yet' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!samePassword(body.password || '', ADMIN_PASSWORD)) {
    // Slow down password guessing.
    await new Promise((r) => setTimeout(r, 1500));
    return res.status(401).json({ ok: false, error: 'Wrong password' });
  }

  const d = {};
  for (const k of FIELDS) d[k] = typeof body[k] === 'string' ? body[k].trim().slice(0, 300) : '';
  if (!d.name || !d.service || !d.date || !d.time || !d.price) {
    return res.status(400).json({ ok: false, error: 'Fill in name, service, date, time and price' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    return res.status(400).json({ ok: false, error: 'The customer needs a valid email address' });
  }

  const rows = [
    ['Date', d.date], ['Time', d.time], ['Address', d.address], ['Service', d.service],
    ['Size', d.size], ['Price', d.price], ['Payment', d.payment], ['Notes', d.notes]
  ].filter(([, v]) => v);
  const table = '<table cellpadding="6" style="border-collapse:collapse;font-size:15px;color:#26372D">' +
    rows.map(([k, v]) => `<tr><td style="font-weight:bold;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('') +
    '</table>';
  const html = `<div style="font-family:Arial,sans-serif;color:#26372D;font-size:15px;line-height:1.5">
<p>Hi ${escapeHtml(d.name)},</p>
<p>Your cleaning is <strong>confirmed</strong>. Here are the details:</p>
${table}
<p>If your building needs our cleaner's name or ID, we'll send it before the visit. Please don't send door codes by message.</p>
<p>If we miss anything on the checklist, tell us within 24 hours and we'll come back to fix it for free.</p>
<p>Need to change something? Text or call us at +63 992 309 5621, or reply to this email.</p>
<p>TidyHaus Home Cleaning<br><a href="https://tidyhausph.com" style="color:#344B38">tidyhausph.com</a></p></div>`;

  try {
    await sendEmail({
      from: FROM_EMAIL,
      to: d.email,
      bcc: OWNER_EMAIL,
      reply_to: OWNER_EMAIL,
      subject: `Your TidyHaus cleaning is confirmed — ${d.date}`,
      html
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: 'Could not send the email' });
  }
  return res.status(200).json({ ok: true });
};
