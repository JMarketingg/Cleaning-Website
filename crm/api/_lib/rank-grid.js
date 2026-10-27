// api/_lib/rank-grid.js
// Local rank grid (owner 2026-10-20). DataForSEO SERP API, STANDARD queue
// (task_post now, task_get later) because it is ~3x cheaper than live.
// Per city: 5x5 GPS grid x 3 keywords x (Maps + organic). Read-only; never
// touches a listing. Keys: DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD (Vercel env).
import { GMB_LOCATIONS as ALL_GMB } from '../../scripts/lib/gmb-locations.mjs';
// Never Fails is no longer the owner's (owner 2026-10-21): treat it as a competitor.
const GMB_LOCATIONS = ALL_GMB.filter((l) => !/^neverfails/.test(l.key));

const API = 'https://api.dataforseo.com/v3/serp/google';
// Maps grid = Local Finder (what a searcher at that point sees in the local pack /
// 'More places'), not the Maps endpoint at 14z, which only returned pins inside a
// tiny viewport and hid service-area listings (fix 2026-10-20).
const EP = { maps: 'local_finder', organic: 'organic' };
const MAPS_ZOOM = '13z';
const DEPTH = 20;
const SPACING_KM = 3.5; // default (~2.2 mi)
// Owner 2026-10-20: per-city spacing in miles. Wider grid -> wider zoom.
const MI = 1.609344;
const spacingKm = (c) => (c.mi ? c.mi * MI : SPACING_KM);
const zoomOf = (c) => (c.mi && c.mi >= 3.5 ? '12z' : MAPS_ZOOM);
// The 11z zoom-out retry for points with < 10 results is gone (2026-10-20): 0 of 52
// retries reached 10. Thin points are brand searches ('tv mounting dallas' = a business
// named "Home Cleaning Dallas"); the page says "Google shows N here" instead.
// Standard-queue list prices (USD per task, depth <= 100 / 1 SERP page).
// Billed per 10-result page: depth 20 = 2 pages (real runs cost $0.03 per 25 tasks).
const PAGES = Math.ceil(DEPTH / 10);
export const PRICE = { maps: 0.0006 * PAGES, organic: 0.0006 * PAGES };

export const RANK_CITIES = [
  { city: 'Houston', mi: 2.3, metro: 'houston', lat: 29.7604, lng: -95.3698, listings: ['ha-houston', 'ha-greenway', 'perfectview-houston', 'millertime-houston'] },
  { city: 'Denver', mi: 4, metro: 'denver', lat: 39.7392, lng: -104.9903, listings: ['ha-denver', 'ha-golden', 'doms-colorado'] },
  { city: 'Los Angeles', metro: 'los angeles', lat: 34.0522, lng: -118.2437, listings: ['ha-los-angeles'] },
  { city: 'Austin', mi: 4, metro: 'austin', lat: 30.2672, lng: -97.7431, listings: ['ha-austin', 'astraea-austin'] },
  // One DFW grid between A1 (Euless) and HA Fort Worth (owner 2026-10-21): 4.5 mi covers both.
  { city: 'Dallas-Fort Worth', mi: 5.2, cols: 8, rows: 4, metro: 'dallas', lat: 32.8000, lng: -97.0500, listings: ['a1-dfw', 'ha-fort-worth'] },
  { city: 'Oklahoma City', metro: 'oklahoma city', lat: 35.4676, lng: -97.5164, listings: ['doms-okc'] },
  { city: 'Tulsa', mi: 4, metro: 'tulsa', lat: 36.1540, lng: -95.9928, listings: ['doms-tulsa'] },
];
export const OUR_DOMAINS = ['ihandyandy.com', 'domstvmounting.com', 'austinmounting.com', 'a1tvmounting.com'];
// Every site the owner runs (redirects + lead-gen too): flagged You, never a competitor.
export const OWN_DOMAINS = [...OUR_DOMAINS, 'domstvmountingokc.com', 'domstvmountingtulsa.com',
  'precisiontvinstallation.com', 'houstonperfectviewtvmounting.com', 'millertimetvmounting.com', 'tvmountinglosangeles.com', 'tvmountingdenver.com',
  'milehightvmounting.com', 'houstonmounting.com', 'houstontvmountingpros.com', 'atxmountpros.com'];
export const ownDomainOf = (dm) => { dm = String(dm || '').toLowerCase().replace(/^www\./, ''); return dm ? (OWN_DOMAINS.find((d) => dm === d || dm.endsWith('.' + d)) || null) : null; };
// Organic target for a Maps listing (Launch popup keeps the card's own site on the Organic tab).
const SITE_OF = { 'handy-andy': 'ihandyandy.com', doms: 'domstvmounting.com', austin: 'austinmounting.com', a1tvmounting: 'a1tvmounting.com' };
export const siteOf = (key) => SITE_OF[(GMB_LOCATIONS.find((g) => g.key === key) || {}).business] || null;
// Owner 2026-10-20: exactly these 3 per city.
export const keywordsFor = (c) => ['tv mounting', `tv mounting ${c.metro}`, 'tv installation'];
export const cityOf = (name) => RANK_CITIES.find((c) => c.city === name) || null;

export function gridPoints(c) {
  const out = []; const km = spacingKm(c); const dLat = km / 111.32; const dLng = km / (111.32 * Math.cos(c.lat * Math.PI / 180));
  // Non-square grids allowed (owner 2026-10-21: DFW = Fort Worth to Dallas, wide and short).
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
// gmb-locations cid is often the g.page/r/ token (protobuf: 0x09 + fixed64 LE cid),
// not the decimal cid DataForSEO returns. Decode it so cid matching works.
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
// Decimal cid -> listing key for every listing the owner runs (any city).
export const OWN_CID_KEY = Object.fromEntries(GMB_LOCATIONS.map((l) => [cidOf(l), l.key]).filter(([c]) => c));

// Turn one task_get result into { our_rank, top3 }.
export function parseResult(kind, items, city) {
  items = items || [];
  if (kind === 'maps') {
    const seen = new Set();
    const maps = items.filter((x) => (x.type === 'local_pack' || x.type === 'maps_search') && !x.is_paid).sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99))
      // Local Finder page 2 can repeat page 1's last listing: one row per listing.
      .filter((x) => { const k = x.cid || x.place_id || x.title; if (seen.has(k)) return false; seen.add(k); return true; })
      // Position = place in the list the searcher sees. rank_group also counts the ads we drop.
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
    // Competitors = first 3 listings that are not the owner's (any of his listings, any city).
    const top3 = maps.filter((x) => !ownOf(x)).slice(0, 3).map((x) => ({
      name: x.title, place_id: x.place_id || null, cid: x.cid || null, rank: x.pos,
      rating: x.rating?.value ?? null, reviews: x.rating?.votes_count ?? null, category: x.category || null, website: site(x) || x.url || null,
    }));
    our._n = maps.length;
    // Full list per point (owner 2026-10-20): popup shows ranks 1-20, ours flagged.
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

// Post every task for the given cities. Returns scans created.
// Cities with a real scan still running or started < 10 min ago (double-click guard).
export async function busyCities(db) {
  const since = new Date(Date.now() - 10 * 60000).toISOString(); const day = new Date(Date.now() - 864e5).toISOString();
  const { data } = await db.from('rank_scans').select('city').eq('dry', false).or(`and(status.eq.pending,run_at.gte.${day}),run_at.gte.${since}`);
  return [...new Set((data || []).map((x) => x.city))];
}
// n at a time, in order.
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
// Speed 2026-10-20: the old one-scan-at-a-time loop took 58 s for 42 scans (60 s limit).
// Now: one insert for every scan row, one task_post per city + kind (75 tasks; the API
// takes up to 100), 6 posts at a time. Returns the scans made; .errors lists failed posts.
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

// Fetch results for pending tasks (free). Time-boxed; call again for the rest.
export async function collectPending(db, budgetMs = 40000) {
  if (!hasKeys()) return { collected: 0, pending: 0, nokeys: true };
  const t0 = Date.now(); const left = () => budgetMs - (Date.now() - t0);
  // Posts that died mid-way (scan row, no points) never finish: mark error after 10 min.
  try {
    const old = new Date(Date.now() - 10 * 60000).toISOString();
    const { data: stale } = await db.from('rank_scans').select('id, points_done').eq('status', 'pending').lt('run_at', old).eq('points_done', 0);
    await Promise.all((stale || []).map(async (sc) => { const { count } = await db.from('rank_points').select('id', { count: 'exact', head: true }).eq('scan_id', sc.id); if (!count) await db.from('rank_scans').update({ status: 'error' }).eq('id', sc.id); }));
  } catch (_) {}
  // Lock (rank_settings.collect_at): only one pickup at a time; 60 s lease.
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
    const ms = Math.max(2000, Math.min(25000, left()));   // one slow call can't blow the budget
    await Promise.all(open.slice(i, i + 20).map(async (p) => {
      const s = byId[p.scan_id]; if (!s) return;
      try {
        const j = await dfs(`/${EP[s.kind]}/task_get/advanced/${p.task_id}`, null, ms);
        const t = (j.tasks || [])[0]; if (!t) return;
        if (t.status_code === 40601 || t.status_code === 40602) return; // still queued
        const res = (t.result || [])[0];
        const parsed = res ? parseResult(s.kind, res.items, cityOf(s.city) || { listings: [] }) : { our_rank: null, top3: [], results: [] };
        if (!res && t.status_code !== 20000) errors.push(t.status_message || String(t.status_code));
        // done_at is null guard: a second overlapping pickup never rewrites a point.
        const { data: upd } = await db.from('rank_points').update({ ...parsed, done_at: new Date().toISOString() }).eq('id', p.id).is('done_at', null).select('id');
        if ((upd || []).length) collected++;
      } catch (e) { errors.push(String(e.message || e)); /* retry next pass */ }
    }));
  }
  // Open count per touched scan, in parallel (one big select hit the 1000-row cap on a full run
  // and could mark scans done early).
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

// Fake data for UI checks (owner sees "Sample"); no API call, no cost.
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

// ── Keyword volume + Google Ads competitors (owner 2026-10-20) ──
// Google Ads search_volume live: billed per request (any number of keywords), ~$0.075.
// SERP organic live/advanced: ~$0.002 per keyword; 'paid' items = the ads shown.
export const KW_PRICE = 0.075;
export const ADS_PRICE = 0.002;
const LOC = { Houston: 'Houston,Texas,United States', Denver: 'Denver,Colorado,United States', 'Los Angeles': 'Los Angeles,California,United States',
  Austin: 'Austin,Texas,United States', 'Dallas-Fort Worth': 'Dallas,Texas,United States', 'Oklahoma City': 'Oklahoma City,Oklahoma,United States', Tulsa: 'Tulsa,Oklahoma,United States' };
const SUBURBS = {
  Houston: ['katy', 'sugar land', 'pearland', 'the woodlands', 'cypress', 'spring', 'pasadena', 'league city', 'missouri city', 'humble'],
  Denver: ['aurora', 'lakewood', 'littleton', 'arvada', 'westminster', 'thornton', 'centennial', 'highlands ranch', 'parker', 'golden'],
  Austin: ['round rock', 'cedar park', 'pflugerville', 'georgetown', 'leander', 'kyle', 'buda'],
  'Dallas-Fort Worth': ['fort worth', 'arlington', 'dallas', 'plano', 'frisco', 'mckinney', 'irving', 'grand prairie', 'mansfield', 'keller'],
  'Oklahoma City': ['edmond', 'norman', 'moore', 'yukon', 'midwest city'],
  Tulsa: ['broken arrow', 'owasso', 'jenks', 'bixby', 'sand springs'],
  'Los Angeles': ['santa monica', 'pasadena', 'glendale', 'burbank', 'long beach', 'torrance', 'irvine'],
};
export const locOf = (c) => LOC[c.city] || `${c.city},United States`;
export function volumeSeeds(c) {
  const m = c.metro;
  const list = ['tv mounting', `tv mounting ${m}`, 'tv installation', `tv installation ${m}`, 'tv wall mount installation', 'tv mounting near me',
    'mount tv on wall', 'fireplace tv mounting', 'tv mounting service', `handyman ${m}`, ...(SUBURBS[c.city] || []).map((s) => `tv mounting ${s}`)];
  return [...new Set(list)];
}
export const adKeywordsFor = (c) => [`tv mounting ${c.metro}`, 'tv mounting', 'tv installation'];
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

// One request per city: every seed keyword. Returns rows for app.rank_keywords.
export async function fetchVolumes(c) {
  const t = await dfsAny('/keywords_data/google_ads/search_volume/live', [{ keywords: volumeSeeds(c), location_name: locOf(c), language_code: 'en' }]);
  const now = new Date().toISOString();
  const rows = (t.result || []).map((x) => ({ city: c.city, keyword: String(x.keyword || '').toLowerCase(), search_volume: x.search_volume ?? null,
    competition: x.competition ?? null, competition_index: x.competition_index ?? null, cpc: x.cpc ?? null,
    low_bid: x.low_top_of_page_bid ?? null, high_bid: x.high_top_of_page_bid ?? null, fetched_at: now })).filter((r) => r.keyword);
  return { rows, cost: Number(t.cost) || KW_PRICE };
}

// Paid ads on page 1 for the money keywords (mobile, where most local searches happen).
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
