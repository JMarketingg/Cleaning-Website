// Short review link: tidyhausph.com/r/<token>. Saves the first click on the job, then opens Google reviews.
const { crm } = require('./_crm');
const GOOGLE_REVIEW = 'https://g.page/r/CVupIA7gzCvJEBM/review';
module.exports = async function handler(req, res) {
  const token = String((req.query || {}).t || '');
  const ch = (req.query || {}).c === 'sms' ? 'sms' : (req.query || {}).c === 'email' ? 'email' : 'link';
  if (/^[A-Za-z0-9_-]{6,64}$/.test(token) && process.env.SUPABASE_URL) {
    try {
      const now = new Date().toISOString();
      const col = ch === 'sms' ? 'review_sms_clicked_at' : ch === 'email' ? 'review_email_clicked_at' : null;
      // Save the click quickly (both writes at once, at most 1.2 seconds) so the customer isn't kept waiting.
      const writes = [crm(`bookings?review_token=eq.${token}&review_clicked_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ review_clicked_at: now, review_click_channel: ch }) })];
      if (col) writes.push(crm(`bookings?review_token=eq.${token}&${col}=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ [col]: now }) }));
      await Promise.race([Promise.all(writes), new Promise((r) => setTimeout(r, 1200))]);
    } catch (e) { console.error('[r]', e.message); }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302; res.setHeader('Location', GOOGLE_REVIEW); res.end();
};
