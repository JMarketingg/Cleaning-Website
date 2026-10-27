import { serviceClient } from './_lib/supabase.js';
import { GMB_LOCATIONS, LOCATIONS_BY_KEY } from '../scripts/lib/gmb-locations.mjs';

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 12;

const RATING_ONLY_RE = /only left a rating/i;

const MIN_TEXT_LEN = 20;

const FRAME_RE = /\bframe\b/i;

function displayable(r) {
  const t = (r.review_text || '').trim();
  return t.length >= MIN_TEXT_LEN && !RATING_ONLY_RE.test(t);
}

function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Google user';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function reviewerKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function shape(r, fromThisLocation) {
  return {
    author: r.reviewer_name || 'Google user',
    author_short: shortName(r.reviewer_name),
    rating: r.rating,
    text: (r.review_text || '').trim(),
    date: r.review_date,
    from_this_location: !!fromThisLocation,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = req.query || {};
  const locationKey = (q.location || '').toString().trim() || null;
  const limit = Math.max(1, Math.min(MAX_LIMIT, parseInt(q.limit, 10) || DEFAULT_LIMIT));

  const listing = locationKey ? LOCATIONS_BY_KEY.get(locationKey) : null;
  if (locationKey && !listing) return res.status(404).json({ error: `Unknown location "${locationKey}"` });

  const slug = listing ? listing.business : ((q.business || '').toString().trim() || 'tidyhaus');

  try {
    const db = serviceClient();
    const { data: biz } = await db.from('businesses').select('id, slug').eq('slug', slug).maybeSingle();
    if (!biz) return res.status(404).json({ error: `Unknown business "${slug}"` });

    const base = () => db.from('google_reviews')
      .select('reviewer_name, rating, review_text, review_date, created_at, location_key')
      .eq('business_id', biz.id)
      .eq('rating', 5)
      .order('review_date', { ascending: false })
      .order('created_at', { ascending: false });

    const usedReviewers = new Set();
    const picked = [];
    if (listing) {
      const { data, error } = await base().eq('location_key', listing.key).limit(60);
      if (error) throw error;
      for (const r of (data || [])) {
        if (picked.length >= limit) break;
        if (!displayable(r)) continue;
        const rk = reviewerKey(r.reviewer_name);
        if (rk && usedReviewers.has(rk)) continue;
        if (rk) usedReviewers.add(rk);
        picked.push(shape(r, true));
      }
    }

    let toppedUp = 0;
    if (picked.length < limit) {
      const { data, error } = await base().limit(120);
      if (error) throw error;

      const byReviewer = new Map();
      for (const r of (data || [])) {
        if (!displayable(r)) continue;
        if (listing && r.location_key === listing.key) continue;
        const rk = reviewerKey(r.reviewer_name);
        if (rk && usedReviewers.has(rk)) continue;
        if (rk && byReviewer.has(rk)) continue;
        byReviewer.set(rk || `anon-${byReviewer.size}`, r);
      }
      const pool = [...byReviewer.values()];

      const siblings = GMB_LOCATIONS.filter((l) => l.business === slug);
      const idx = listing ? Math.max(0, siblings.findIndex((l) => l.key === listing.key)) : 0;
      const offset = pool.length ? (idx * limit) % pool.length : 0;

      for (let n = 0; n < pool.length && picked.length < limit; n++) {
        const r = pool[(offset + n) % pool.length];
        const rk = reviewerKey(r.reviewer_name);
        if (rk && usedReviewers.has(rk)) continue;
        if (rk) usedReviewers.add(rk);
        picked.push(shape(r, false));
        toppedUp++;
      }
    }

    let pinnedFrameReview = null;
    if (listing) {
      const { data, error } = await base()
        .eq('location_key', listing.key)
        .ilike('review_text', '%frame%')
        .limit(20);
      if (error) throw error;
      const frameReview = (data || []).find((r) => displayable(r) && FRAME_RE.test(r.review_text || ''));
      if (frameReview) pinnedFrameReview = shape(frameReview, true);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({
      ok: true,
      business: slug,
      location: listing ? {
        key: listing.key,
        name: listing.name,
        display_name: listing.displayName,
        maps_url: listing.mapsUrl,
        review_url: listing.reviewUrl,
        phone: listing.phone,
        address: listing.address,
        rating: listing.rating,
        review_count: listing.reviewCount,
        stats_verified: listing.statsVerified,
      } : null,
      count: picked.length,
      topped_up: toppedUp,
      reviews: picked,
      pinned_frame_review: pinnedFrameReview,
    });
  } catch (e) {
    console.error('[reviews]', (e && e.stack) || e);
    return res.status(500).json({ error: 'Could not load reviews' });
  }
}
