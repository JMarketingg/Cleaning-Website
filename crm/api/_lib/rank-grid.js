import { GMB_LOCATIONS as ALL_GMB } from '../../scripts/lib/gmb-locations.mjs';
const GMB_LOCATIONS = ALL_GMB.filter((l) => !/^neverfails/.test(l.key));

const API = 'https://api.dataforseo.com/v3/serp/google';
const EP = { maps: 'local_finder', organic: 'organic' };
const MAPS_ZOOM = '13z';
const DEPTH = 20;
const SPACING_KM = 3.5;
const MI = 1.609344;
const spacingKm = (c) => (c.mi ? c.mi * MI : SPACING_KM);
const zoomOf = (c) => (c.mi && c.mi >= 3.5 ? '12z' : MAPS_ZOOM);
const PAGES = Math.ceil(DEPTH / 10);
export const PRICE = { maps: 0.0006 * PAGES, organic: 0.0006 * PAGES };

export const RANK_CITIES = [
  { city: 'Manila', mi: 2, metro: 'manila', lat: 14.5547, lng: 121.0244, listings: [] },
];
export const OUR_DOMAINS = ['tidyhausph.com'];
export const OWN_DOMAINS = [...OUR_DOMAINS];
export const ownDomainOf = (dm) => { dm = String(dm || '').toLowerCase().replace(/^www\./, ''); return dm ? (OWN_DOMAINS.find((d) => dm === d || dm.endsWith('.' + d)) || null) : null; };
const SITE_OF = { 'tidyhaus': 'tidyhausph.com', doms: 'tidyhausph.com', austin: 'tidyhausph.com', a1tvmounting: 'tidyhausph.com' };
export const siteOf = (key) => SITE_OF[(GMB_LOCATIONS.find((g) => g.key === key) || {}).business] || null;
export const keywordsFor = () => ['house cleaning', 'condo cleaning makati', 'cleaning service bgc'];
export const cityOf = (name) => RANK_CITIES.find((c) => c.city === name) || null;

export function gridPoints(c) {
  const out = []; const km = spacingKm(c); const dLat = km / 111.32; const dLng = km / (111.32 * Math.cos(c.lat * Math.PI / 180));
  const R = c.rows || 5, K = c.cols || 5;
  for (let r = 0; r < R; r++) for (let k = 0; k < K; k++) {
    out.push({ idx: r * K + k, lat: +(c.lat + ((R - 1) / 2 - r) * dLat).toFixed(6), lng: +(c.lng + (k - (K - 1) / 2) * dLng).toFixed(6) });
  }
  return out;
}

export const gridSize = (c) => (c.rows || 5) * (c.cols || 5);
export function costEstimate(cities = RANK_CITIES) {
  const per = cities.reduce((t, c) => t + gridSize(c), 0) * 3;
  return { tasks: per * 2, usd: +(per * PRICE.maps + per * PRICE.organic).toFixed(2), per_city_usd: +(25 * keywordsFor(RANK_CITIES[0]).length * (PRICE.maps + PRICE.organic)).toFixed(2) };
}

const creds = () => (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
  ? 'Basic ' + Buffer.from(process.env.DATAFORSEO_LOGIN + ':' + process.env.DATAFORSEO_PASSWORD).toString('base64') : null;
export const hasKeys = () => !!creds();

async function dfs(path, body, ms = 25000) {
  const auth = creds(); if (!auth) throw new Error('Add DataForSEO keys in Vercel');
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(ms) });
  const j = await r.json().catch(() => null);
  if (!j || j.status_code !== 20000) throw new Error('DataForSEO: ' + ((j && j.status_message) || r.status));
  return j;
}

const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
export function cidOf(l) {
  const c = String(l?.cid || '');
  if (/^\d{6,}$/.test(c)) return c;
  try { const b = Buffer.from(c.replace(/-/g, '+').replace(/_/g, '/') + '==', 'base64'); if (b[0] === 9 && b.length >= 9) return b.readBigUInt64LE(1).toString(); } catch (_) {}
  return null;
}
function matchListing(it, l) {
  if (l.placeId && it.place_id === l.placeId) return true;
  const cid = cidOf(l); if (cid && String(it.cid || '') === cid) return true;
  return !!(l.phone && it.phone && digits(it.phone).length === 10 && digits(it.phone) === digits(l.phone));
}
const domOf = (it) => String(it.domain || '').toLowerCase().replace(/^www\./, '');
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return null; } };
export const OWN_CID_KEY = Object.fromEntries(GMB_LOCATIONS.map((l) => [cidOf(l), l.key]).filter(([c]) => c));

export function parseResult(kind, items, city) {
  items = items || [];
  if (kind === 'maps') {
    const seen = new Set();
    const maps = items.filter((x) => (x.type === 'local_pack' || x.type === 'maps_search') && !x.is_paid).sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99))
      .filter((x) => { const k = x.cid || x.place_id || x.title; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((x, i) => ({ ...x, pos: i + 1 }));
    const site = (x) => x.domain || hostOf(x.url) || null;
    const ourKeys = city.listings.map((k) => GMB_LOCATIONS.find((g) => g.key === k)).filter(Boolean);
    const ownOf = (x) => ourKeys.find((l) => matchListing(x, l)) || GMB_LOCATIONS.find((l) => matchListing(x, l)) || null;
    const our = {};
    for (const l of ourKeys) {
      const hit = maps.find((x) => matchListing(x, l));
      our[l.key] = hit ? hit.pos : null;
      if (hit) (our._meta = our._meta || {})[l.key] = { rating: hit.rating?.value ?? null, reviews: hit.rating?.votes_count ?? null, website: site(hit) };
    }
    for (const k of city.listings) if (!(k in our)) our[k] = null;
    const top3 = maps.filter((x) => !ownOf(x)).slice(0, 3).map((x) => ({
      name: x.title, place_id: x.place_id || null, cid: x.cid || null, rank: x.pos,
      rating: x.rating?.value ?? null, reviews: x.rating?.votes_count ?? null, category: x.category || null, website: site(x) || x.url || null,
    }));
    our._n = maps.length;
    const results = maps.slice(0, DEPTH).map((x) => {
      const me = ownOf(x);
      return { rank: x.pos, name: x.title, cid: x.cid || null, rating: x.rating?.value ?? null, reviews: x.rating?.votes_count ?? null,
        category: x.category || null, website: site(x), ...(me ? { you: me.key } : {}) };
    });
    return { our_rank: our, top3, results };
  }
  const org = items.filter((x) => x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99));
  const our = {};
  for (const d of OUR_DOMAINS) { const hit = org.find((x) => domOf(x) === d || domOf(x).endsWith('.' + d)); our[d] = hit ? hit.rank_group : null; }
  const top3 = org.filter((x) => !ownDomainOf(domOf(x))).slice(0, 3)
    .map((x) => ({ name: x.title, domain: domOf(x), url: x.url, rank: x.rank_group }));
  const results = org.slice(0, 10).map((x) => {
    const me = ownDomainOf(domOf(x));
    return { rank: x.rank_group, name: x.title, domain: domOf(x), url: x.url, ...(me ? { you: me } : {}) };
  });
  return { our_rank: our, top3, results };
}

export async function busyCities(db) {
  const since = new Date(Date.now() - 10 * 60000).toISOString(); const day = new Date(Date.now() - 864e5).toISOString();
  const { data } = await db.from('rank_scans').select('city').eq('dry', false).or(`and(status.eq.pending,run_at.gte.${day}),run_at.gte.${since}`);
  return [...new Set((data || []).map((x) => x.city))];
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
export async function postScans(db, cityNames) {
  if (!hasKeys()) throw new Error('Add DataForSEO keys in Vercel');
  const busy = await busyCities(db);
  const groups = [];
  for (const name of cityNames) {
    if (busy.includes(name)) continue;
    const c = cityOf(name); if (!c) continue;
    for (const kind of ['maps', 'organic']) groups.push({ c, kind, pts: gridPoints(c) });
  }
  const made = []; const errors = []; made.errors = errors;
  if (!groups.length) return made;
  const want = groups.flatMap((g) => keywordsFor(g.c).map((kw) => ({ city: g.c.city, keyword: kw, kind: g.kind, points_total: g.pts.length })));
  const { data: scans, error } = await db.from('rank_scans').insert(want).select('id, city, keyword, kind');
  if (error) throw error;
  await pool(groups, 6, async (g) => {
    const mine = keywordsFor(g.c).map((kw) => (scans || []).find((s) => s.city === g.c.city && s.kind === g.kind && s.keyword === kw)).filter(Boolean);
    if (!mine.length) return;
    const tasks = mine.flatMap((s) => g.pts.map((p) => ({
      keyword: s.keyword, language_code: 'en', device: 'mobile', depth: DEPTH, tag: s.id + ':' + p.idx,
      location_coordinate: g.kind === 'maps' ? `${p.lat},${p.lng},${zoomOf(g.c)}` : `${p.lat},${p.lng}`,
    })));
    let j;
    try { j = await dfs(`/${EP[g.kind]}/task_post`, tasks); }
    catch (e) { errors.push(g.c.city + ' ' + g.kind + ': ' + String(e.message || e)); await db.from('rank_scans').update({ status: 'error' }).in('id', mine.map((s) => s.id)); return; }
    const rows = []; const cost = {};
    for (const t of j.tasks || []) {
      const [sid, ix] = String(t.data?.tag || '').split(':'); const s = mine.find((x) => String(x.id) === sid); const p = g.pts[Number(ix)];
      if (!s || !p) continue;
      cost[s.id] = (cost[s.id] || 0) + (Number(t.cost) || 0);
      rows.push({ scan_id: s.id, idx: p.idx, lat: p.lat, lng: p.lng, task_id: t.status_code === 20100 ? t.id : null, done_at: t.status_code === 20100 ? null : new Date().toISOString() });
    }
    if (rows.length) { const { error: pe } = await db.from('rank_points').insert(rows); if (pe) errors.push(g.c.city + ' ' + g.kind + ': ' + pe.message); }
    await Promise.all(mine.map((s) => db.from('rank_scans').update({ cost: +(cost[s.id] || 0).toFixed(5) }).eq('id', s.id)));
    for (const s of mine) made.push({ id: s.id, city: s.city, kind: s.kind, keyword: s.keyword, tasks: rows.filter((r) => r.scan_id === s.id).length, cost: cost[s.id] || 0 });
  });
  if (!made.length && errors.length) throw new Error(errors[0]);
  return made;
}

export async function collectPending(db, budgetMs = 40000) {
  if (!hasKeys()) return { collected: 0, pending: 0, nokeys: true };
  const t0 = Date.now(); const left = () => budgetMs - (Date.now() - t0);
  try {
    const old = new Date(Date.now() - 10 * 60000).toISOString();
    const { data: stale } = await db.from('rank_scans').select('id, points_done').eq('status', 'pending').lt('run_at', old).eq('points_done', 0);
    await Promise.all((stale || []).map(async (sc) => { const { count } = await db.from('rank_points').select('id', { count: 'exact', head: true }).eq('scan_id', sc.id); if (!count) await db.from('rank_scans').update({ status: 'error' }).eq('id', sc.id); }));
  } catch (_) {}
  const now = new Date().toISOString(); const lease = new Date(Date.now() - 60000).toISOString();
  const { data: got, error: le } = await db.from('rank_settings').update({ collect_at: now }).eq('id', 1).or(`collect_at.is.null,collect_at.lt.${lease}`).select('id');
  if (!le && !(got || []).length) return { collected: 0, busy: true };
  const { data: open } = await db.from('rank_points').select('id, scan_id, task_id').is('done_at', null).not('task_id', 'is', null).limit(600);
  if (!(open || []).length) { await db.from('rank_settings').update({ collect_at: null }).eq('id', 1); return { collected: 0, pending: 0 }; }
  const scanIds = [...new Set(open.map((p) => p.scan_id))];
  const { data: scans } = await db.from('rank_scans').select('id, city, kind, points_total').in('id', scanIds);
  const byId = Object.fromEntries((scans || []).map((s) => [s.id, s]));
  let collected = 0; const errors = [];
  for (let i = 0; i < open.length && left() > 1500; i += 20) {
    const ms = Math.max(2000, Math.min(25000, left()));
    await Promise.all(open.slice(i, i + 20).map(async (p) => {
      const s = byId[p.scan_id]; if (!s) return;
      try {
        const j = await dfs(`/${EP[s.kind]}/task_get/advanced/${p.task_id}`, null, ms);
        const t = (j.tasks || [])[0]; if (!t) return;
        if (t.status_code === 40601 || t.status_code === 40602) return;
        const res = (t.result || [])[0];
        const parsed = res ? parseResult(s.kind, res.items, cityOf(s.city) || { listings: [] }) : { our_rank: null, top3: [], results: [] };
        if (!res && t.status_code !== 20000) errors.push(t.status_message || String(t.status_code));
        const { data: upd } = await db.from('rank_points').update({ ...parsed, done_at: new Date().toISOString() }).eq('id', p.id).is('done_at', null).select('id');
        if ((upd || []).length) collected++;
      } catch (e) { errors.push(String(e.message || e)); /* retry next pass */ }
    }));
  }
  const openN = await Promise.all(scanIds.map((id) => db.from('rank_points').select('id', { count: 'exact', head: true }).eq('scan_id', id).is('done_at', null)
    .then((r) => (r.error ? null : r.count), () => null)));
  await Promise.all(scanIds.map((id, i) => {
    const n = openN[i]; if (n == null) return null;
    const tot = Number(byId[id]?.points_total) || 25;
    return db.from('rank_scans').update({ points_done: Math.max(0, tot - n), status: n ? 'pending' : 'done' }).eq('id', id).eq('status', 'pending');
  }));
  const { count: pending } = await db.from('rank_points').select('id', { count: 'exact', head: true }).is('done_at', null).not('task_id', 'is', null);
  await db.from('rank_settings').update({ collect_at: null }).eq('id', 1);
  return { collected, pending: pending || 0, ...(errors.length ? { error: errors[0] } : {}) };
}

export async function dryRun(db, cityName) {
  const c = cityOf(cityName) || RANK_CITIES[0];
  const pts = gridPoints(c); const rnd = (n) => Math.floor(Math.random() * n);
  const comp = ['Pro Home Cleaning', 'Mount Masters', 'Wall Wizards', 'Elite AV Install', 'TV Guys'];
  for (const kind of ['maps', 'organic']) for (const kw of keywordsFor(c)) {
    const { data: scan } = await db.from('rank_scans').insert({ city: c.city, keyword: kw, kind, points_total: 25, points_done: 25, status: 'done', dry: true }).select('id').single();
    const rows = pts.map((p) => {
      const d = Math.abs(p.idx % 5 - 2) + Math.abs(Math.floor(p.idx / 5) - 2);
      const our = {}; (kind === 'maps' ? c.listings : OUR_DOMAINS).forEach((k, i) => { const r = 1 + d * 2 + rnd(4) + i * 3; our[k] = r > 20 ? null : r; });
      const pick = comp.slice().sort(() => Math.random() - 0.5);
      const top3 = [0, 1, 2].map((i) => { const n = pick[i];
        return kind === 'maps' ? { name: n, place_id: 'fake-' + n, rank: i + 1, rating: 4.5 + rnd(5) / 10, reviews: 50 + rnd(300), category: 'home cleaning service', website: n.toLowerCase().replace(/\W/g, '') + '.com' }
          : { name: n, domain: n.toLowerCase().replace(/\W/g, '') + '.com', rank: i + 1 }; });
      return { scan_id: scan.id, idx: p.idx, lat: p.lat, lng: p.lng, our_rank: our, top3, done_at: new Date().toISOString() };
    });
    await db.from('rank_points').insert(rows);
  }
  return { ok: true, city: c.city };
}

export const KW_PRICE = 0.075;
export const ADS_PRICE = 0.002;
const LOC = { Manila: 'Philippines' };
const SUBURBS = {
  Manila: ['makati', 'bgc', 'taguig', 'rockwell', 'legaspi village', 'salcedo village'],
};
export const locOf = (c) => LOC[c.city] || 'Philippines';
export function volumeSeeds(c) {
  const m = c.metro;
  const list = ['house cleaning', 'house cleaning makati', 'condo cleaning', 'condo cleaning makati', 'deep cleaning makati',
    'cleaning service bgc', 'move out cleaning', 'airbnb cleaning makati', 'office cleaning makati', 'cleaning service near me',
    ...(SUBURBS[c.city] || []).map((s) => `cleaning service ${s}`)];
  return [...new Set(list)];
}
export const adKeywordsFor = () => ['house cleaning makati', 'condo cleaning', 'cleaning service bgc'];
export const adsCost = (c) => +(adKeywordsFor(c).length * ADS_PRICE).toFixed(3);

async function dfsAny(path, body, ms = 40000) {
  const auth = creds(); if (!auth) throw new Error('Add DataForSEO keys in Vercel');
  const r = await fetch('https://api.dataforseo.com/v3' + path, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const j = await r.json().catch(() => null);
  if (!j || j.status_code !== 20000) throw new Error('DataForSEO: ' + ((j && j.status_message) || r.status));
  const t = (j.tasks || [])[0];
  if (!t || t.status_code !== 20000) throw new Error('DataForSEO: ' + ((t && t.status_message) || 'no task'));
  return t;
}

export async function fetchVolumes(c) {
  const t = await dfsAny('/keywords_data/google_ads/search_volume/live', [{ keywords: volumeSeeds(c), location_name: locOf(c), language_code: 'en' }]);
  const now = new Date().toISOString();
  const rows = (t.result || []).map((x) => ({ city: c.city, keyword: String(x.keyword || '').toLowerCase(), search_volume: x.search_volume ?? null,
    competition: x.competition ?? null, competition_index: x.competition_index ?? null, cpc: x.cpc ?? null,
    low_bid: x.low_top_of_page_bid ?? null, high_bid: x.high_top_of_page_bid ?? null, fetched_at: now })).filter((r) => r.keyword);
  return { rows, cost: Number(t.cost) || KW_PRICE };
}

export function parseAds(keyword, items) {
  return (items || []).filter((x) => x && x.type === 'paid').map((x) => {
    const domain = String(x.domain || hostOf(x.url) || '').toLowerCase().replace(/^www\./, '');
    const desc = x.description || (Array.isArray(x.description_rows) ? x.description_rows.join(' ') : '');
    return { keyword, position: x.rank_group ?? null, abs: x.rank_absolute ?? null, domain, title: x.title || '', description: desc || '',
      url: x.url || null, name: x.website_name || null, ...(ownDomainOf(domain) ? { you: ownDomainOf(domain) } : {}) };
  });
}
export async function fetchAds(c) {
  const ads = [], errors = []; let cost = 0;
  await Promise.all(adKeywordsFor(c).map(async (kw) => {
    try {
      const t = await dfsAny('/serp/google/organic/live/advanced', [{ keyword: kw, location_name: locOf(c), language_code: 'en', device: 'mobile', os: 'android', depth: 10 }]);
      cost += Number(t.cost) || ADS_PRICE;
      ads.push(...parseAds(kw, ((t.result || [])[0] || {}).items));
    } catch (e) { errors.push(kw + ': ' + String(e.message || e)); }
  }));
  return { ads, errors, cost: +cost.toFixed(4) };
}
