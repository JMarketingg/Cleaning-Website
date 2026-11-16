// Owner-only mail sender. Default: booking confirmation for chat bookings. mode 'raw' / 'status': CRM Email Marketing.
// The owner gets a BCC copy. copy_only:true sends just the owner's copy.
// Protected by REVIEW_CRON_SECRET. Body: { to, subject, preheader, title, intro, rows: [[label, value]], sections: [{title, items}] }
const { layout, card, section, list, esc } = require('./_email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.REVIEW_CRON_SECRET || req.headers['x-cron-secret'] !== process.env.REVIEW_CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const auth = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' };
  // mode 'raw': CRM Email Marketing sends one finished email. Returns the Resend id.
  if (b.mode === 'raw') {
    if (b.copy_only) { b.to = process.env.OWNER_EMAIL; b.subject = '[Copy] ' + b.subject; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to || '') || !b.subject || !b.html) return res.status(400).json({ error: 'to, subject and html are required' });
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: auth,
      body: JSON.stringify({ from: process.env.FROM_EMAIL, to: b.to, reply_to: process.env.OWNER_EMAIL || undefined, subject: b.subject, html: b.html, text: b.text, headers: b.headers }) });
    const j = await r.json().catch(() => ({}));
    return res.status(r.ok ? 200 : 502).json(r.ok ? { id: j.id } : { error: j.message || ('Resend ' + r.status) });
  }
  // mode 'status': last event (delivered, opened, clicked, bounced, complained) for up to 20 Resend ids.
  if (b.mode === 'status') {
    const statuses = {};
    for (const id of (b.ids || []).slice(0, 20)) {
      const r = await fetch('https://api.resend.com/emails/' + encodeURIComponent(id), { headers: auth });
      const j = await r.json().catch(() => ({}));
      if (r.ok) statuses[id] = j.last_event || null;
    }
    return res.status(200).json({ statuses });
  }
  if (b.copy_only) { b.to = process.env.OWNER_EMAIL; b.subject = '[Copy] ' + b.subject; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to || '')) return res.status(400).json({ error: 'Bad email' });
  const body = card(b.rows || []) + (b.sections || []).map((s) => section(s.title, list((s.items || []).map(esc)))).join('') + (b.outro ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#26372D;margin:24px 0 0;">${esc(b.outro)}</p>` : '');
  const html = layout({ preheader: b.preheader || '', badge: 'Booking confirmed', title: b.title || 'Your booking is confirmed', intro: esc(b.intro || ''), body });
  const text = [b.intro, ...(b.rows || []).map(([k, v]) => `${k}: ${v}`), ...(b.sections || []).flatMap((s) => ['', s.title, ...(s.items || []).map((i) => '- ' + i)]), '', b.outro || ''].join('\n');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.FROM_EMAIL, to: b.to, bcc: (!b.copy_only && process.env.OWNER_EMAIL) ? [process.env.OWNER_EMAIL] : undefined, reply_to: process.env.OWNER_EMAIL || undefined, subject: b.subject, html, text })
  });
  const out = await r.text();
  return res.status(r.ok ? 200 : 502).json({ ok: r.ok, resend: out.slice(0, 300) });
};
