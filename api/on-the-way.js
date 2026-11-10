// "Your cleaner is on the way" email. The cleaner app calls this after the cleaner taps
// "I'm on my way". It only sends if that job really is on the way, and only once per job.
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, OWNER_EMAIL, FROM_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !FROM_EMAIL) return res.status(503).json({ ok: false });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ ok: false });

  try {
    const [b] = await crm(`bookings?select=id,status,scheduled_at,address_line1,metadata,customer:customers(name,email),technician:technicians(name)&id=eq.${id}`);
    if (!b || b.status !== 'on_the_way') return res.status(200).json({ ok: true, sent: false });
    const meta = b.metadata || {};
    const email = b.customer && b.customer.email;
    if (meta.otw_email_sent_at || !email) return res.status(200).json({ ok: true, sent: false });

    const first = String((b.customer && b.customer.name) || '').split(' ')[0] || 'there';
    const cleaner = String((b.technician && b.technician.name) || 'Your cleaner').split(' ')[0];
    const time = new Date(b.scheduled_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
    const p = (t) => `<p style="font-family:Arial,Helvetica,sans-serif;margin:0 0 8px;font-size:15px;line-height:1.6;color:#26372D;">${t}</p>`;
    const html = mail.layout({
      preheader: `${cleaner} is on the way to your place.`,
      badge: 'On the way',
      title: `${cleaner} is on the way! 🚗`,
      intro: `Hi ${mail.esc(first)}, your TidyHaus cleaner <strong>${mail.esc(cleaner)}</strong> is on the way and should arrive around <strong>${mail.esc(time)}</strong>.`,
      body: mail.card([['Cleaner', cleaner], ['Arriving around', time], ['Address', b.address_line1]]) +
        mail.section('Before we arrive', mail.list([
          "If your building needs a visitor pass, please let your guard or reception know.",
          'Put away valuables and anything you don\'t want us to move.',
          'For safety, give door codes in person or leave them with your guard or reception, not by message.'
        ])) +
        mail.section('Questions?', p('Reply to this email, or text or call us at <a href="tel:+639923095621" style="color:#344B38;font-weight:bold;">+63 992 309 5621</a>.'))
    });
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: email, reply_to: OWNER_EMAIL || undefined, subject: `${cleaner} is on the way to your TidyHaus cleaning`, html })
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    await crm(`bookings?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ metadata: { ...meta, otw_email_sent_at: new Date().toISOString() } }) });
    return res.status(200).json({ ok: true, sent: true });
  } catch (e) {
    console.error('[on-the-way]', e.message);
    return res.status(500).json({ ok: false });
  }
};
