import { GMB_LOCATIONS } from '../../scripts/lib/gmb-locations.mjs';
import { runGbpPosts, fetchPlacePayload, placeStats } from './gbp-posts.js';

const BASE = 'https://maps.googleapis.com/maps/api/place';
const getJ = async (u) => (await fetch(u, { signal: AbortSignal.timeout(9000) })).json();

async function findPlaceId(l, key) {
  if (l.placeId) return l.placeId;
  if (/^\d{6,}$/.test(String(l.cid || ''))) {
    try {
      const u = new URL(BASE + '/details/json'); u.searchParams.set('cid', l.cid); u.searchParams.set('fields', 'place_id'); u.searchParams.set('key', key);
      const j = await getJ(u); if (j.status === 'OK' && j.result?.place_id) return j.result.place_id;
    } catch (_) {}
  }
  const tries = [];
  if (l.phone) tries.push(['phonenumber', '+' + String(l.phone).replace(/\D/g, '')]);
  if (l.displayName) tries.push(['textquery', l.displayName]);
  for (const [type, input] of tries) {
    try {
      const u = new URL(BASE + '/findplacefromtext/json');
      u.searchParams.set('input', input); u.searchParams.set('inputtype', type); u.searchParams.set('fields', 'place_id,name'); u.searchParams.set('key', key);
      const j = await getJ(u);
      const c = (j.candidates || []).filter(x => !l.displayName || type === 'phonenumber' || (x.name || '').toLowerCase() === l.displayName.toLowerCase());
      if (c.length === 1) return c[0].place_id;
    } catch (_) {}
  }
  return null;
}

async function details(placeId, key) {
  const u = new URL(BASE + '/details/json');
  u.searchParams.set('place_id', placeId); u.searchParams.set('fields', 'user_ratings_total,rating,reviews');
  u.searchParams.set('reviews_sort', 'newest'); u.searchParams.set('key', key);
  const j = await getJ(u);
  if (j.status !== 'OK' || j.result?.user_ratings_total == null) return null;
  const recent = (j.result.reviews || []).map(r => ({ name: r.author_name, stars: r.rating, time: r.time }));
  return { count: j.result.user_ratings_total, rating: j.result.rating ?? null, recent };
}

export async function runGbpCountWatch(db) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY not set');
  const out = [];
  await Promise.all(GMB_LOCATIONS.map(async (l) => {
    try {
      const { data: prev } = await db.from('gbp_count_snapshots').select('place_id, review_count, recent')
        .eq('location_key', l.key).order('taken_at', { ascending: false }).limit(1).maybeSingle();
      const pid = l.placeId || prev?.place_id || await findPlaceId(l, key);
      if (!pid) { out.push({ key: l.key, skip: 'no place id' }); return; }
      let d = null, src = 'places';
      try { d = await details(pid, key); } catch (_) {}
      if (!d) { try { const s = placeStats(await fetchPlacePayload(pid), pid); if (s) { d = { count: s.count, rating: s.rating, recent: prev?.recent || [] }; src = 'maps'; } } catch (_) {} }
      if (!d) { out.push({ key: l.key, skip: 'no count' }); return; }
      await db.from('gbp_count_snapshots').insert({ location_key: l.key, place_id: pid, review_count: d.count, rating: d.rating, recent: d.recent });
      if (prev && prev.place_id === pid && d.count < prev.review_count) {
        const now = new Set(d.recent.map(r => r.name + '|' + r.time));
        const floor = d.recent.length ? Math.min(...d.recent.map(r => r.time)) : 0;
        let removed = (prev.recent || []).filter(r => !now.has(r.name + '|' + r.time) && (d.recent.length < 5 || r.time >= floor))
          .map(r => ({ name: r.name, stars: r.stars, date: r.time ? new Date(r.time * 1000).toISOString().slice(0, 10) : null }));
        await db.from('gbp_count_drops').insert({ location_key: l.key, old_count: prev.review_count, new_count: d.count, removed: removed.length ? removed : null });
      }
      out.push({ key: l.key, count: d.count, prev: prev?.review_count ?? null, src });
    } catch (e) { out.push({ key: l.key, error: String(e.message || e) }); }
  }));
  let posts; try { posts = await runGbpPosts(db); } catch (e) { posts = String(e.message || e); }
  return { listings: out, posts };
}
