// Daily payment reminder (Vercel cron, 9 AM Manila). Emails customers whose cleaning is in about
// 2 days and is still unpaid, with the amount and the QR for how they pay. Each visit gets one reminder.
// Settings (Vercel environment variables): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL.
const mail = require('./_email');

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'app', 'Content-Profile': 'app', 'Content-Type': 'application/json' };
}
async function crm(path, opts = {}) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const manila = (t, o) => new Date(t).toLocaleString('en-US', { timeZone: 'Asia/Manila', ...o });
const peso = (n) => '₱' + Math.round(Number(n) || 0).toLocaleString('en-US');

module.exports = async function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !FROM_EMAIL) return res.status(503).json({ ok: false, error: 'Not set up yet' });

  // Visits starting between 36 and 60 hours from now (run once a day, so each visit is caught once).
  const from = new Date(Date.now() + 36 * 3600000).toISOString();
  const to = new Date(Date.now() + 60 * 3600000).toISOString();
  const rows = await crm(`bookings?select=id,scheduled_at,scheduled_end,price,address_line1,metadata,customer:customers(name,email)` +
    `&status=eq.confirmed&payment_status=eq.unpaid&scheduled_at=gte.${from}&scheduled_at=lt.${to}`);

  const sent = [];
  for (const b of rows || []) {
    const meta = b.metadata || {};
    const email = b.customer && b.customer.email;
    if (meta.pay_reminder_sent_at || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const first = String((b.customer && b.customer.name) || '').split(' ')[0] || 'there';
    const date = manila(b.scheduled_at, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = manila(b.scheduled_at, { hour: 'numeric', minute: '2-digit' }) + (b.scheduled_end ? ' to ' + manila(b.scheduled_end, { hour: 'numeric', minute: '2-digit' }) : '');
    const ref = /^TH-[A-Z0-9]{6}$/.test(meta.ref || '') ? meta.ref : '';
    const html = mail.layout({
      preheader: `Your cleaning is on ${date}. Please pay ${peso(b.price)} before your visit.`,
      badge: 'Payment reminder',
      title: `See you soon, ${first}!`,
      intro: `Your TidyHaus cleaning is on <strong>${mail.esc(date)}</strong>, ${mail.esc(time)}. If you haven't paid yet, please pay before your visit.`,
      body: mail.card([['Date', date], ['Time', time], ['Address', b.address_line1], ['Amount', peso(b.price)], ['Reference', ref]]) +
        mail.section('How to pay', mail.paymentBlock(meta.payment, peso(b.price), ref)) +
        mail.section('Already paid?', `<p style="font-family:Arial,Helvetica,sans-serif;margin:0;font-size:15px;line-height:1.6;color:#26372D;">Thank you! You can ignore this email. Need to change your date? Just reply, or text us at <a href="tel:+639923095621" style="color:#344B38;font-weight:bold;">+63 992 309 5621</a>.</p>`)
    });
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: email, bcc: OWNER_EMAIL || undefined, reply_to: OWNER_EMAIL || undefined,
          subject: `Reminder: your TidyHaus cleaning on ${date}`, html })
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
      await crm(`bookings?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ metadata: { ...meta, pay_reminder_sent_at: new Date().toISOString() } }) });
      sent.push(b.id);
    } catch (e) { console.error('[pay-reminder]', b.id, e.message); }
  }
  return res.status(200).json({ ok: true, checked: (rows || []).length, sent: sent.length });
};
