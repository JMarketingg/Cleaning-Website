// Reads Google Business Profile "new review" emails from the TidyHaus Gmail inbox and saves
// each review in app.site_reviews (one row per email review; the email id stops duplicates).
// A scheduler calls this every 15 minutes with the x-cron-secret header.
// Settings (Vercel environment variables): GMAIL_USER, GMAIL_APP_PASSWORD (a Gmail app password,
// never the normal password), REVIEW_CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Google's emails can cut long reviews short, so the site links to Google for the full text.
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { crm } = require('./_crm');

// Pulls reviews out of one Google Business Profile email. The email lists each review as:
//   <name>
//   <review text>  (or "This user only left a rating")
//   Reply to review <link>
// Stars come from the summary line, e.g. "3 five-star reviews" or "1 four-star review".
const WORD = { one: 1, two: 2, three: 3, four: 4, five: 5 };
function parseReviews(text, emailId, date) {
  const t = String(text || '').replace(/\r/g, '').replace(/<https?:\/\/[^>]+>/g, '').replace(/[ \t ]+/g, ' ');
  if (!/review/i.test(t)) return [];
  const summary = [...t.matchAll(/(\d+)\s+(one|two|three|four|five)-star reviews?/gi)].map((m) => ({ n: Number(m[1]), stars: WORD[m[2].toLowerCase()] }));
  const singleStars = summary.length === 1 ? summary[0].stars : null;
  const start = t.search(/let customers know when you.?ve replied\.?/i);
  const body = start >= 0 ? t.slice(start).replace(/^[^\n]*\n/, '') : t;
  const out = [];
  // Only the parts that end in "Reply to review" are reviews; the text after the last one is Google's footer.
  if (!/Reply to review/i.test(body)) return [];
  body.split(/\n\s*Reply to review[^\n]*/i).slice(0, -1).forEach((block, i) => {
    const lines = block.split('\n').map((x) => x.trim()).filter(Boolean)
      .filter((x) => !/^(see all reviews|manage|unsubscribe|google llc|this email was sent|you've received|privacy|help center|©)/i.test(x));
    if (!lines.length || lines[0].length > 60) return;
    const reviewer = lines[0];
    const rest = lines.slice(1).join(' ').trim();
    const text = /only left a rating/i.test(rest) ? null : (rest || null);
    if (!text && !/only left a rating/i.test(rest)) return;
    out.push({ reviewer, stars: singleStars, text: text ? text.slice(0, 1000) : null, review_date: date, email_id: `${emailId}#${i}` });
  });
  return out.slice(0, 20);
}

module.exports = async function handler(req, res) {
  const secret = process.env.REVIEW_CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) return res.status(401).json({ ok: false });
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(200).json({ ok: false, note: 'Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel first.' });
  const debug = (req.query || {}).debug === '1';
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }, logger: false });
  const found = [], samples = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    try {
      const since = new Date(Date.now() - 120 * 86400000);
      // Google sends these from businessprofile-noreply@google.com (and similar); match on subject, then check the sender.
      const uids = await client.search({ since, from: 'businessprofile-noreply@google.com' }, { uid: true });
      for (const uid of (uids || []).slice(-60)) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!msg) continue;
        const mail = await simpleParser(msg.source);
        if (!/google\.com/i.test((mail.from && mail.from.text) || '')) continue;
        const id = mail.messageId || `uid-${uid}`;
        const day = (mail.date || new Date()).toISOString().slice(0, 10);
        const body = mail.text || String(mail.html || '').replace(/<[^>]+>/g, '\n');
        if (debug && samples.length < 1 && /review/i.test(mail.subject||'')) samples.push({ subject: mail.subject, from: mail.from && mail.from.text, text: body.slice(0, 1500) });
        found.push(...parseReviews(body, id, day));
      }
    } finally { lock.release(); }
    await client.logout();
  } catch (e) {
    console.error('[reviews-sync]', e.message);
    return res.status(500).json({ ok: false, error: e.message.slice(0, 200) });
  }
  let saved = 0;
  if (found.length) {
    const rows = await crm('site_reviews?on_conflict=email_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(found) });
    saved = (rows || []).length;
  }
  return res.status(200).json({ ok: true, found: found.length, saved, ...(debug ? { samples, parsed: found.slice(0, 5) } : {}) });
};
