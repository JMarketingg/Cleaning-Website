// "Fix Maps listings" (owner 2026-10-17), HA Google Ads account only.
// Each city's campaigns show ONE Business Profile listing on Maps:
//   Denver campaigns  -> only the listing at maps.app.goo.gl/WLEUAXqR9UaAquQx8 (CID below), never Golden
//   Houston campaigns -> the listing at maps.app.goo.gl/RyNBuZSU6xttSt4Q9 (CID below), nothing else
//   Astraea campaign  -> only the Astraea Home Cleaning Austin listing
//   Austin HA         -> only HA Austin (11639 Argonne Forest Trail B); skipped until linked in Ads
// How: for each target listing we make (or reuse) a BUSINESS_PROFILE_DYNAMIC_LOCATION_GROUP
// asset set under the account's Business Profile sync set, filtered to that one listing_id,
// link it to the campaign and remove the campaign's old city location set link.
// GBP listings themselves are never touched. Listings are named via Places Details
// (GOOGLE_MAPS_API_KEY) so the confirm list shows name, address, review count.
// validate_only first (nothing changes), then the real run. Idempotent.
import { gadsQuery, gadsMutate } from './gads.js';
import { GMB_LOCATIONS } from '../../scripts/lib/gmb-locations.mjs';

const HA = '4038873594';
const ASTRAEA_ID = '24361441178';
const HOUSTON_CID = '3801531944408495064'; // 0x34c1c1297cc4b3d8, from maps.app.goo.gl/RyNBuZSU6xttSt4Q9 (owner 2026-10-17)
const DENVER_CID = '16130818947525574344'; // from maps.app.goo.gl/WLEUAXqR9UaAquQx8 (owner 2026-10-17), never Golden
const HA_AUSTIN_CID = BigInt('0xe4c954ad7e693b81').toString(); // HA Austin, 11639 Argonne Forest Trail B (owner 2026-10-17)
const LOC_TYPES = ['LOCATION_SYNC', 'BUSINESS_PROFILE_DYNAMIC_LOCATION_GROUP', 'STATIC_LOCATION_GROUP', 'CHAIN_DYNAMIC_LOCATION_GROUP'];
const GROUP_NAME = { denver: 'Maps only: HA Denver (big)', houston: 'Maps only: HA Houston (big)', astraea: 'Maps only: Astraea Austin', austin: 'Maps only: HA Austin' };
const errOf = (r) => r?.error || r?.partialFailureError?.message || null;

async function q(db, gaql) {
  const r = await gadsQuery(db, HA, gaql);
  if (r.error) throw new Error(r.error);
  return r.rows || [];
}
async function qTry(db, list) { // first query that works (field names differ by API version)
  let last;
  for (const s of list) { try { return await q(db, s); } catch (e) { last = e; } }
  throw last;
}

async function placeInfo(placeId) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !placeId) return null;
  try {
    const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    u.searchParams.set('place_id', placeId); u.searchParams.set('key', key);
    u.searchParams.set('fields', 'name,formatted_address,user_ratings_total,url,geometry');
    const j = await (await fetch(u)).json();
    if (j.status !== 'OK') return null;
    const r = j.result || {};
    const cid = (/[?&]cid=(\d+)/.exec(r.url || '') || [])[1] || null;
    return { name: r.name, address: r.formatted_address, reviews: r.user_ratings_total ?? null, cid, lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng };
  } catch { return null; }
}

function cityOf(s) {
  const n = String(s || '');
  if (/astraea/i.test(n)) return 'astraea';
  if (/denver|colorado|golden/i.test(n)) return 'denver';
  if (/houston/i.test(n)) return 'houston';
  if (/austin/i.test(n)) return 'austin';
  return null;
}

export async function gadsMapsFix(db, { validateOnly = true } = {}) {
  const vo = !!validateOnly;
  const steps = [];
  const add = (step, ok, note) => steps.push({ step, ok, note });

  // 1. read
  const sets = await qTry(db, [
    "SELECT asset_set.id, asset_set.resource_name, asset_set.name, asset_set.type, asset_set.status, asset_set.location_group_parent_asset_set_id, asset_set.business_profile_location_group.dynamic_business_profile_location_group_filter.listing_id_filters, asset_set.location_set.business_profile_location_set.email_address, asset_set.location_set.business_profile_location_set.listing_id_filters FROM asset_set WHERE asset_set.status = 'ENABLED'",
    "SELECT asset_set.id, asset_set.resource_name, asset_set.name, asset_set.type, asset_set.status, asset_set.location_group_parent_asset_set_id FROM asset_set WHERE asset_set.status = 'ENABLED'",
  ]);
  const S = sets.map(r => r.assetSet).filter(a => LOC_TYPES.includes(a.type));
  const byRn = new Map(S.map(a => [a.resourceName, a]));
  const locRows = await qTry(db, [
    "SELECT asset_set_asset.asset_set, asset.resource_name, asset.id, asset.location_asset.place_id, asset.location_asset.business_profile_locations FROM asset_set_asset WHERE asset_set_asset.status = 'ENABLED' AND asset.type = 'LOCATION'",
    "SELECT asset_set_asset.asset_set, asset.resource_name, asset.id, asset.location_asset.place_id FROM asset_set_asset WHERE asset_set_asset.status = 'ENABLED'",
  ]);
  const links = await q(db, "SELECT campaign.id, campaign.name, campaign.status, campaign_asset_set.resource_name, campaign_asset_set.asset_set FROM campaign_asset_set WHERE campaign_asset_set.status = 'ENABLED' AND campaign.status != 'REMOVED'");

  // 2. listings
  const listings = new Map(); // listing_id -> info
  for (const r of locRows) {
    const la = r.asset?.locationAsset; if (!la) continue;
    const parent = byRn.get(r.assetSetAsset?.assetSet);
    for (const b of (la.businessProfileLocations || [{}])) {
      const lid = String(b.listingId || ''); if (!lid) continue;
      const cur = listings.get(lid) || { listingId: lid, placeId: la.placeId, storeCode: b.storeCode, labels: b.labels || [], parents: new Set() };
      if (parent?.type === 'LOCATION_SYNC') cur.parents.add(parent.id);
      listings.set(lid, cur);
    }
  }
  await Promise.all([...listings.values()].map(async L => { L.place = await placeInfo(L.placeId); }));
  const gmbMatch = (L) => GMB_LOCATIONS.find(g => (g.placeId && g.placeId === L.placeId) || (g.address && L.place?.address && L.place.address.toLowerCase().startsWith(g.address.toLowerCase().split(',')[0])));
  const desc = (L) => { const g = gmbMatch(L); const p = L.place || {}; return `${p.name || g?.displayName || '?'} | ${p.address || g?.address || 'no address'} | ${p.reviews ?? g?.reviewCount ?? '?'} reviews | listing ${L.listingId}${p.cid ? ' cid ' + p.cid : ''}`; };
  for (const L of listings.values()) add('Listing found', true, desc(L));
  if (!listings.size) { add('Listings', false, 'no location assets found in the account'); return { validateOnly: vo, steps }; }

  const all = [...listings.values()];
  // CID forms: decimal or hex (0x...). GBP listing_id is the Maps CID; Places url cid is the fallback.
  const dec = (v) => { try { const t = String(v || '').trim(); return t ? BigInt(/^0x/i.test(t) ? t : (/^[0-9]+$/.test(t) ? t : 'x')).toString() : null; } catch { return null; } };
  const byCid = (cid) => all.find(L => dec(L.listingId) === cid || String(L.listingId) === cid) || all.find(L => dec(L.place?.cid) === cid) || null;
  // Verified on Google Maps by the owner 2026-10-17. Golden/Colfax 4908204647440022912 is never a target.
  const GOLDEN = '4908204647440022912';
  const byId = (lid, pid) => all.find(L => String(L.listingId) === lid) || (pid ? all.find(L => L.placeId === pid && String(L.listingId) !== GOLDEN) : null) || null;
  const rowOf = (L) => `${L.place?.name || gmbMatch(L)?.displayName || '?'} | listing_id ${L.listingId} | place_id ${L.placeId || '-'} | ${L.place?.address || gmbMatch(L)?.address || 'no address'}`;
  const reviews = (L) => Number(L.place?.reviews ?? gmbMatch(L)?.reviewCount ?? 0);
  const isHA = (L) => /^handy andy/i.test(L.place?.name || gmbMatch(L)?.displayName || '');
  const target = {
    houston: byId('-9008816349134206169', 'ChIJrZOohQF_bIcR2LPEfCnBwTQ') || byCid(HOUSTON_CID),
    denver: byId('-2111486228399661119', 'ChIJY--BLYh5bIcRyP5mN14u3N8') || byCid(DENVER_CID),
    austin: all.find(L => String(L.listingId) !== '-4729713211467045339' && !/astraea/i.test(L.place?.name || '') && (/11639 argonne forest/i.test(L.place?.address || '') || dec(L.listingId) === HA_AUSTIN_CID || dec(L.place?.cid) === HA_AUSTIN_CID)) || null,
    astraea: byId('-4729713211467045339', null) || all.find(L => /astraea/i.test(L.place?.name || '')) || null,
  };
  for (const k of ['denver', 'houston', 'astraea', 'austin']) {
    if (k === 'austin' && !target[k]) { add('Target austin', true, 'HA Austin listing not linked yet; Austin left as is'); continue; }
    if (target[k]) add(`Target ${k}`, true, desc(target[k]));
    else {
      const cid = k === 'houston' ? HOUSTON_CID : k === 'denver' ? DENVER_CID : null;
      const sa = all.filter(L => /^handy andy tv mounting$/i.test((L.place?.name || gmbMatch(L)?.displayName || '').trim()) && !/\d/.test(L.place?.address || ''));
      const hint = cid && sa.length === 2 ? ` | 2 service-area "TidyHaus Home Cleaning" listings, not guessing: ${sa.map(L => 'listing_id ' + L.listingId).join(' / ')}` : '';
      add(`Target ${k}`, false, (cid ? `CID ${cid} not found; nothing changed for ${k}` : 'could not identify the listing; nothing changed for it') + hint + ' | ALL: ' + all.map(rowOf).join(' || '));
    }
  }

  // 3. group sets (create or reuse)
  const syncSets = S.filter(a => a.type === 'LOCATION_SYNC');
  const groupRn = {};
  for (const k of Object.keys(target)) {
    const L = target[k]; if (!L) continue;
    const have = S.find(a => a.type === 'BUSINESS_PROFILE_DYNAMIC_LOCATION_GROUP' && (a.name === GROUP_NAME[k] || ((a.businessProfileLocationGroup?.dynamicBusinessProfileLocationGroupFilter?.listingIdFilters || []).map(String).join() === L.listingId)));
    if (have) { groupRn[k] = have.resourceName; add(`Group ${k}`, true, `reuse "${have.name}"`); continue; }
    const parentId = [...L.parents][0] || syncSets[0]?.id;
    if (!parentId) { add(`Group ${k}`, false, 'no Business Profile sync set in the account'); continue; }
    const m = await gadsMutate(db, HA, 'assetSets', [{ create: { name: GROUP_NAME[k], type: 'BUSINESS_PROFILE_DYNAMIC_LOCATION_GROUP', locationGroupParentAssetSetId: String(parentId), businessProfileLocationGroup: { dynamicBusinessProfileLocationGroupFilter: { listingIdFilters: [String(L.listingId)] } } } }], vo);
    if (errOf(m)) { add(`Group ${k}`, false, errOf(m)); continue; }
    groupRn[k] = m.results?.[0]?.resourceName || null;
    add(`Group ${k}`, true, (vo ? 'would create' : 'created') + ` "${GROUP_NAME[k]}" -> listing ${L.listingId}`);
  }

  // 4. campaigns: swap links
  const camps = new Map();
  for (const r of links) {
    const set = byRn.get(r.campaignAssetSet?.assetSet); if (!set) continue;
    const id = String(r.campaign.id);
    const c = camps.get(id) || { id, name: r.campaign.name, links: [] };
    c.links.push({ rn: r.campaignAssetSet.resourceName, set });
    camps.set(id, c);
  }
  if (!camps.has(ASTRAEA_ID)) camps.set(ASTRAEA_ID, { id: ASTRAEA_ID, name: 'Astraea campaign', links: [] });
  for (const c of camps.values()) {
    const wanted = new Map(); // key -> keep
    const remove = [];
    for (const l of c.links) {
      const key = c.id === ASTRAEA_ID ? 'astraea' : (cityOf(l.set.name) || cityOf(c.name));
      if (l.set.resourceName === groupRn[key]) { wanted.set(key, 'have'); continue; }
      if (key && groupRn[key]) { wanted.set(key, wanted.get(key) || 'add'); remove.push(l); }
    }
    if (c.id === ASTRAEA_ID && groupRn.astraea && !wanted.has('astraea')) wanted.set('astraea', 'add');
    const label = (k) => (target[k] ? desc(target[k]) : k);
    if (![...wanted.values()].includes('add') && !remove.length) {
      if (wanted.size) add(c.name, true, 'already only: ' + [...wanted.keys()].map(label).join(' + '));
      continue;
    }
    const notes = [];
    let ok = true;
    for (const [k, st] of wanted) {
      if (st !== 'add') continue;
      if (!groupRn[k]) { notes.push(`would link ${k} group (created on the real run)`); continue; }
      const m = await gadsMutate(db, HA, 'campaignAssetSets', [{ create: { campaign: `customers/${HA}/campaigns/${c.id}`, assetSet: groupRn[k] } }], vo);
      if (errOf(m)) { ok = false; notes.push(`link ${k}: ${errOf(m)}`); } else notes.push(`-> ${label(k)}`);
    }
    if (ok && remove.length) {
      const m = await gadsMutate(db, HA, 'campaignAssetSets', remove.map(l => ({ remove: l.rn })), vo);
      if (errOf(m)) { ok = false; notes.push('unlink old: ' + errOf(m)); } else notes.push('drop ' + remove.map(l => `"${l.set.name}"`).join(', '));
    }
    add(c.name, ok, notes.join('; '));
  }
  return { validateOnly: vo, steps };
}
