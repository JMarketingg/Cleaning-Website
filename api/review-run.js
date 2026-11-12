// Automatic Google review requests. A scheduler calls this every 15 minutes.
//
// For each finished TidyHaus job:
//  1. About 2 hours after it's finished, send ONE text (if texting is set up) and ONE email
//     asking for a Google review. Every customer is asked the same way (no filtering).
//  2. If they haven't clicked after 2 days, send ONE reminder text. Never more than 2 texts per job.
// Rules: texts only 8 AM to 8 PM Manila time; never to people on the do-not-contact list;
// never for cancelled, refunded or complaint jobs; a claim on each job stops double sends.
//
// Settings (Vercel environment variables):
//   REVIEW_CRON_SECRET   the scheduler must send this in the x-cron-secret header
//   REVIEW_MODE          "test" (default): sends only to the owner, nothing is saved on jobs
//                        "live": sends to real customers
//   OWNER_TEST_PHONE     owner's mobile for test mode, e.g. 09923095621
//   OWNER_EMAIL, FROM_EMAIL, RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SEMAPHORE_API_KEY, SEMAPHORE_SENDER   texting (Semaphore). Without them, only emails are sent.
const crypto = require('crypto');
const mail = require('./_email');
const { crm } = require('./_crm');

const BUSINESS = 'TidyHaus';
const GOOGLE_REVIEW = 'https://g.page/r/CVupIA7gzCvJEBM/review';
const SITE = 'https://tidyhausph.com';
const HOUR = 3600000;

function manilaHour() { return Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false })) % 24; }
function phMobile(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (/^639\d{9}$/.test(d)) return '0' + d.slice(2);
  if (/^09\d{9}$/.test(d)) return d;
  return null; // only Philippine mobiles get texts
}
const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
const shortLink = (token, ch) => `${SITE}/r/${token}${ch ? '?c=' + ch : ''}`;
const stopLink = (token) => `${SITE}/stop/${token}`;

function smsText(b, token, reminder) {
  const tech = first(b.technician && b.technician.name);
  return reminder
    ? `Hi ${first(b.customer && b.customer.name)}, just a friendly reminder from ${BUSINESS}: if you have a minute, we'd love a quick Google review. ${shortLink(token, 'sms')} To stop these messages: ${stopLink(token)}`
    : `Hi ${first(b.customer && b.customer.name)}, thanks for choosing ${BUSINESS}! If ${tech} did a great job, would you leave us a quick Google review? ${shortLink(token, 'sms')} To stop these messages: ${stopLink(token)}`;
}

// Plain, personal email (no logo, images or big buttons), so Gmail puts it in Primary, not Promotions.
function emailHtml(b, token) {
  const tech = first(b.technician && b.technician.name);
  const P = (t) => `<p style="margin:0 0 14px;">${t}</p>`;
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222;">` +
    P(`Hi ${mail.esc(first(b.customer && b.customer.name))},`) +
    P(`Thank you for choosing ${BUSINESS}! I hope you're happy with your clean.`) +
    P(`If ${mail.esc(tech)} did a great job, would you mind leaving us a quick Google review? It only takes a minute and it really helps a small business like ours.`) +
    P(`<a href="${shortLink(token, 'email')}">Leave a review on Google</a>`) +
    P(`If anything wasn't right, just reply to this email and I'll make it right.`) +
    P(`Thank you!<br>Jiyah<br>${BUSINESS} Home Cleaning`) +
    `<p style="margin:24px 0 0;font-size:12px;color:#777;">Don't want these emails? <a href="${stopLink(token)}" style="color:#777;">Stop review requests</a></p></body></html>`;
}
function emailText(b, token) {
  const tech = first(b.technician && b.technician.name);
  return `Hi ${first(b.customer && b.customer.name)},\n\nThank you for choosing ${BUSINESS}! I hope you're happy with your clean.\n\n` +
    `If ${tech} did a great job, would you mind leaving us a quick Google review? It only takes a minute and it really helps a small business like ours.\n\n` +
    `${shortLink(token, 'email')}\n\nIf anything wasn't right, just reply to this email and I'll make it right.\n\nThank you!\nJiyah\n${BUSINESS} Home Cleaning\n\nStop review requests: ${stopLink(token)}\n`;
}
// Shows as "Jiyah from TidyHaus" in the inbox, using the same sending address.
function fromPerson() {
  const f = process.env.FROM_EMAIL || '';
  const addr = (f.match(/<([^>]+)>/) || [null, f])[1].trim();
  return `Jiyah from ${BUSINESS} <${addr}>`;
}

async function sendSms(to, text) {
  const { SEMAPHORE_API_KEY, SEMAPHORE_SENDER } = process.env;
  if (!SEMAPHORE_API_KEY) return 'not_set_up';
  const body = new URLSearchParams({ apikey: SEMAPHORE_API_KEY, number: to, message: text });
  if (SEMAPHORE_SENDER) body.set('sendername', SEMAPHORE_SENDER);
  const r = await fetch('https://api.semaphore.co/api/v4/messages', { method: 'POST', body });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j) || !j[0]) throw new Error(`Semaphore ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return String(j[0].status || 'queued').toLowerCase();
}
async function sendEmail(to, subject, html, text) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromPerson(), to, reply_to: process.env.OWNER_EMAIL || undefined, subject, html, text })
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return 'sent';
}

async function blocked(phone, email) {
  const ors = [];
  if (phone) ors.push(`phone.eq.${encodeURIComponent(phone)}`);
  if (email) ors.push(`email.eq.${encodeURIComponent(email.toLowerCase())}`);
  if (!ors.length) return false;
  const rows = await crm(`review_do_not_contact?select=phone&or=(${ors.join(',')})&limit=1`);
  return rows.length > 0;
}

// Claims a job by setting a column that must still be empty. Only one run can win.
async function claim(id, column) {
  const rows = await crm(`bookings?id=eq.${id}&${column}=is.null`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ [column]: new Date().toISOString() })
  });
  return rows.length === 1;
}

const SELECT = 'id,status,payment_status,completed_at,review_token,review_clicked_at,review_req_sent_at,review_req_reminder_at,review_req_complaint,metadata,' +
  'customer:customers(name,phone,email),technician:technicians!bookings_technician_id_fkey(name),business:businesses!inner(slug)';

module.exports = async function handler(req, res) {
  const secret = process.env.REVIEW_CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) return res.status(401).json({ ok: false });
  const live = process.env.REVIEW_MODE === 'live';
  const textsAllowed = manilaHour() >= 8 && manilaHour() < 20;
  const out = { mode: live ? 'live' : 'test', textsAllowed, sent: 0, reminders: 0, skipped: [] };

  // Test mode: one sample text and email to the owner, using the latest finished job. Nothing is saved.
  if (!live) {
    const q = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!q.send_test) return res.status(200).json({ ...out, note: 'Test mode. POST {"send_test":true} to send a sample to the owner.' });
    const [b] = await crm(`bookings?select=${SELECT}&business.slug=eq.tidyhaus&status=eq.completed&order=completed_at.desc&limit=1`);
    const sample = b || { customer: { name: 'Test Customer' }, technician: { name: 'Kristine' }, review_token: 'test' };
    const token = sample.review_token || 'test';
    const phone = phMobile(process.env.OWNER_TEST_PHONE);
    out.sms = phone ? await sendSms(phone, '[TEST] ' + smsText(sample, token, false)).catch((e) => 'error: ' + e.message) : 'no OWNER_TEST_PHONE';
    out.email = process.env.OWNER_EMAIL ? await sendEmail(process.env.OWNER_EMAIL, `[TEST] Quick favor, ${first(sample.customer && sample.customer.name)}?`, emailHtml(sample, token), emailText(sample, token)).catch((e) => 'error: ' + e.message) : 'no OWNER_EMAIL';
    return res.status(200).json(out);
  }

  const now = Date.now();
  // 1. First request: finished at least 2 hours ago, within the last 7 days, not asked yet.
  const due = await crm(`bookings?select=${SELECT}&business.slug=eq.tidyhaus&status=eq.completed&review_req_sent_at=is.null` +
    `&completed_at=lte.${new Date(now - 2 * HOUR).toISOString()}&completed_at=gte.${new Date(now - 7 * 24 * HOUR).toISOString()}&limit=20`);
  for (const b of due) {
    const c = b.customer || {};
    const phone = phMobile(c.phone);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '') ? c.email : null;
    if (b.review_req_complaint || ['refunded', 'void'].includes(b.payment_status) || (b.metadata && b.metadata.complaint)) { out.skipped.push([b.id, 'complaint/refund']); continue; }
    if (!phone && !email) { out.skipped.push([b.id, 'no contact']); continue; }
    if (await blocked(c.phone, email)) { await claim(b.id, 'review_req_sent_at'); out.skipped.push([b.id, 'do not contact']); continue; }
    // Texts wait for the morning; if there is no texting at all, the email can go any time.
    const willText = phone && process.env.SEMAPHORE_API_KEY;
    // Phone only and no texting yet: wait, so the customer still gets a text once texting is set up.
    if (!willText && !email) { out.skipped.push([b.id, 'waiting for texting']); continue; }
    if (willText && !textsAllowed) { out.skipped.push([b.id, 'quiet hours']); continue; }
    if (!(await claim(b.id, 'review_req_sent_at'))) continue;
    let token = b.review_token;
    if (!token) {
      token = crypto.randomBytes(9).toString('base64url');
      await crm(`bookings?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ review_token: token }) });
    }
    const patch = {};
    if (phone) patch.review_req_sms_status = await sendSms(phone, smsText(b, token, false)).catch((e) => 'error: ' + e.message.slice(0, 120));
    if (email) patch.review_req_email_status = await sendEmail(email, `Quick favor, ${first(c.name)}?`, emailHtml(b, token), emailText(b, token)).catch((e) => 'error: ' + e.message.slice(0, 120));
    await crm(`bookings?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    out.sent++;
  }

  // 2. One reminder text: asked 2+ days ago, no click, a text actually went out, no reminder yet.
  if (textsAllowed && process.env.SEMAPHORE_API_KEY) {
    const late = await crm(`bookings?select=${SELECT}&business.slug=eq.tidyhaus&status=eq.completed&review_req_reminder_at=is.null&review_clicked_at=is.null` +
      `&review_req_sent_at=lte.${new Date(now - 48 * HOUR).toISOString()}&review_req_sent_at=gte.${new Date(now - 10 * 24 * HOUR).toISOString()}&review_req_sms_status=not.like.error*&review_req_sms_status=neq.not_set_up&limit=20`);
    for (const b of late) {
      const c = b.customer || {};
      const phone = phMobile(c.phone);
      if (!phone || !b.review_token || b.review_req_complaint || ['refunded', 'void'].includes(b.payment_status)) continue;
      if (await blocked(c.phone, c.email)) continue;
      if (!(await claim(b.id, 'review_req_reminder_at'))) continue;
      await sendSms(phone, smsText(b, b.review_token, true)).catch((e) => console.error('[review reminder]', b.id, e.message));
      out.reminders++;
    }
  }
  return res.status(200).json(out);
};
