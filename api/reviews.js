// Newest Google reviews for the website: /api/reviews?limit=3. Cached for 10 minutes.
// Every review is shown as it came in; nothing is filtered or edited.
const { crm } = require('./_crm');
module.exports = async function handler(req, res) {
  const limit = Math.max(1, Math.min(12, Number((req.query || {}).limit) || 3));
  try {
    const rows = await crm(`site_reviews?select=reviewer,stars,text,review_date&order=review_date.desc,id.desc&limit=${limit}`);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    return res.status(200).json({ reviews: rows || [] });
  } catch (e) {
    console.error('[reviews]', e.message);
    return res.status(200).json({ reviews: [] });
  }
};
