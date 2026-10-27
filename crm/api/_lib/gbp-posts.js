import { GMB_LOCATIONS } from '../../scripts/lib/gmb-locations.mjs';

export const GBP_POST_KEYS = GMB_LOCATIONS.filter((l) => l.placeId).map((l) => l.key);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+' };
const get = async (u) => { const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); };
const DATE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/;

function collect(n, out) {
  if (!Array.isArray(n)) return;
  if (typeof n[6] === 'string' && /^\d{8,}$/.test(n[6]) && typeof n[12] === 'string' && DATE.test(n[12])) {
    const text = n[1]?.[0]?.[0]?.[0];
    const sec = Array.isArray(n[2]) && typeof n[2][0] === 'number' ? n[2][0] : null;
    let img = n[5]?.[0]?.[0];
    if (typeof img === 'string') img = img.replace(/=[^/=]*$/, '') + '=w160-h160-k-no'; else img = null;
    out.push({
      post_id: n[6],
      posted_at: sec ? new Date(sec * 1000).toISOString() : new Date(n[12] + ' 12:00 UTC').toISOString(),
      summary: typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 300) : null,
      image_url: img,
      url: typeof n[9] === 'string' && n[9].startsWith('http') ? n[9] : null,
    });
    return;
  }
  for (const c of n) collect(c, out);
}

export async function fetchPlacePayload(placeId) {
  const html = await get('https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(placeId) + '&hl=en&gl=us');
  const m = html.replace(/&amp;/g, '&').match(/\/maps\/preview\/place\?[^"'\s<>]+/);
  if (!m) throw new Error('no place payload');
  let t = await get('https://www.google.com' + m[0]);
  t = t.slice(t.indexOf('\n') + 1);
  return JSON.parse(t);
}

export function placeStats(j, placeId) {
  const p = Array.isArray(j) ? j[6] : null;
  if (!Array.isArray(p) || p[78] !== placeId) return null;
  const count = p[4] == null ? 0 : p[4][8], rating = p[4]?.[7];
  if (typeof count !== 'number') return null;
  return { count, rating: typeof rating === 'number' ? rating : null, name: p[11] || null };
}

export async function fetchGbpPosts(placeId, payload) {
  const j = payload || await fetchPlacePayload(placeId);
  const out = [];
  collect(j, out);
  const seen = new Set();
  return out.filter((p) => !seen.has(p.post_id) && seen.add(p.post_id));
}

export async function runGbpPosts(db) {
  const res = await Promise.all(GBP_POST_KEYS.map(async (key) => {
    const l = GMB_LOCATIONS.find((x) => x.key === key);
    if (!l?.placeId) return { key, skip: 'no place id' };
    try {
      const posts = await fetchGbpPosts(l.placeId);
      const now = new Date().toISOString();
      const { error: de } = await db.from('gbp_posts').delete().eq('location_key', key);
      if (de) throw de;
      if (posts.length) {
        const { error } = await db.from('gbp_posts').insert(posts.map((p) => ({ location_key: key, ...p, fetched_at: now })));
        if (error) throw error;
      }
      return { key, posts: posts.length, latest: posts.reduce((m, p) => (p.posted_at > m ? p.posted_at : m), '') || null };
    } catch (e) { return { key, error: String(e.message || e) }; }
  }));
  return res;
}
