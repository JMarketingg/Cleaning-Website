// Reads Google Business Profile "new review" emails from the TidyHaus Gmail inbox and saves
// each review in app.site_reviews (one row per email review; the email id stops duplicates).
// A scheduler calls this every 15 minutes with the x-cron-secret header.
// Settings (Vercel environment variables): GMAIL_USER, GMAIL_APP_PASSWORD (a Gmail app password,
// never the normal password), REVIEW_CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Google's emails can cut long reviews short, so the site links to Google for the full text.
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { crm } = require('./_crm');

// Pulls reviewer, stars and text out of one Google review email. Returns [] if it isn't one.
function parseReviews(text, emailId, date) {
  const t = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const out = [];
  // Typical lines: "Stephen left a review" / "Stephen ★★★★★" / "Stephen rated you 5 stars".
  const re = /(?:^|\n)\s*([^\n]{2,60}?)\s+(?:left a (?:new )?review|wrote a review|rated (?:your business|you)\s*(\d)\s*(?:stars?|out of 5)?|reviewed\b)[^\n]*\n([\s\S]*?)(?=\n\s*[^\n]{2,60}?\s+(?:left a (?:new )?review|wrote a review|rated)|\n\s*(?:Reply|See all reviews|Read review|View review|Respond)|$)/gi;
  let m, i = 0;
  while ((m = re.exec(t)) && i < 10) {
    const block = m[3] || '';
    const starChars = (block.match(/★/g) || []).length;
    const starsNum = Number(m[2]) || (block.match(/(\d)\s*(?:\/\s*5|stars?|out of 5)/i) || [])[1];
    const stars = Math.min(5, Number(starsNum) || starChars || 0) || null;
    const body = block.replace(/[★☆]+/g, '').replace(/\b\d\s*(?:\/\s*5|stars?|out of 5)\b/gi, '').split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((s) => !/^(reply|see all|read|view|respond|manage|google|unsubscribe|business profile)/i.test(s)).join(' ').trim();
    out.push({ reviewer: m[1].trim().replace(/^["“]|["”]$/g, ''), stars, text: body.slice(0, 1000) || null, review_date: date, email_id: `${emailId}#${i}` });
    i++;
  }
  return out;
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
      const uids = await client.search({ since, subject: 'review' }, { uid: true });
      for (const uid of (uids || []).slice(-60)) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!msg) continue;
        const mail = await simpleParser(msg.source);
        if (!/google\.com/i.test((mail.from && mail.from.text) || '')) continue;
        const id = mail.messageId || `uid-${uid}`;
        const day = (mail.date || new Date()).toISOString().slice(0, 10);
        const body = mail.text || String(mail.html || '').replace(/<[^>]+>/g, '\n');
        if (debug && samples.length < 2) samples.push({ subject: mail.subject, from: mail.from && mail.from.text, text: body.slice(0, 1500) });
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
