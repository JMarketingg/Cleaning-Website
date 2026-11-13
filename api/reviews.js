// Newest Google reviews for the website: /api/reviews?limit=3. Cached for 10 minutes.
// Shows written 5-star reviews, newest first, exactly as they came in (text is never edited).
const { crm } = require('./_crm');
module.exports = async function handler(req, res) {
  const limit = Math.max(1, Math.min(12, Number((req.query || {}).limit) || 3));
  try {
    // Written 5-star reviews of at least 30 characters, newest first.
    const all = await crm(`site_reviews?select=reviewer,stars,text,review_date&text=not.is.null&stars=eq.5&order=review_date.desc,id.desc&limit=50`);
    const rows = (all || []).filter((r) => String(r.text || '').trim().length >= 30).slice(0, limit);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    return res.status(200).json({ reviews: rows || [] });
  } catch (e) {
    console.error('[reviews]', e.message);
    return res.status(200).json({ reviews: [] });
  }
};
