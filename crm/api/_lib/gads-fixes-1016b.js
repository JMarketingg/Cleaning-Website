// Google Ads change set 2 (owner 2026-10-16), run from the Google Ads panel ("Finish ads").
// OWNER RULE: every business is open 8am-8pm in its own time zone. Phone calls only in
// those hours; website bookings 24/7.
//   1. CALL HOURS: every ENABLED campaign in HA / Dom's / A1 gets its OWN call asset
//      (same number + conversion settings as its current one) with
//      CallAsset.adScheduleTargets = 8am-8pm in the city's time zone, converted to the
//      ACCOUNT time zone (Google runs ad schedules in the account zone). Old unscheduled
//      campaign-level call assets are removed. Account-level call assets are removed only
//      when every enabled campaign has its own scheduled one (otherwise they would be the
//      only call extension left, and stay 24/7 for the uncovered campaigns: noted).
//   2. ASTRAEA: call asset 737-381-3800 (Central 8-8), sitelinks, callouts.
//   (Houston callouts run in gads-fixes-1016.js "Houston sitelinks + callouts"; that step
//    skips text already on the campaign, so it is safe to re-run.)
// First call is validate_only (nothing changes), then the real run. Idempotent: a campaign
// whose call asset already has the right number + schedule is left alone. Re-run after the US
// clocks change (Nov 1) for accounts outside the US: the offset moves by an hour.
// Returns { validateOnly, steps: [{ step, ok, note }] }.
import { gadsQuery, gadsMutate } from './gads.js';

const HA = '4038873594', DOMS = '4616306123', A1 = '2893668990';
const ACCOUNTS = [[HA, 'HA'], [DOMS, "Dom's"], [A1, 'A1']];
const ASTRAEA_ID = '24361441178';
const ASTRAEA_PHONE = '251-310-3973'; // Astraea Maps-ads tracking line (owner 2026-10-17)
const SITE = 'https://austinmounting.com';
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const MIN_ENUM = { 0: 'ZERO', 15: 'FIFTEEN', 30: 'THIRTY', 45: 'FORTY_FIVE' };
const ENUM_MIN = { ZERO: 0, FIFTEEN: 15, THIRTY: 30, FORTY_FIVE: 45 };
const OPEN_MIN = 8 * 60, CLOSE_MIN = 20 * 60;
const errOf = (r) => r?.error || r?.partialFailureError?.message || null;
const lc = (s) => String(s || '').trim().toLowerCase();
const digits = (s) => String(s || '').replace(/\D/g, '');

async function q(cid, db, gaql) {
  const r = await gadsQuery(db, cid, gaql);
  if (r.error) throw new Error(r.error);
  return r.rows || [];
}
async function urlOk(u) {
  try { const r = await fetch(u, { redirect: 'follow' }); return r.status === 200; } catch { return false; }
}

// --- time zones ----------------------------------------------------------------------
// Offset of a zone from UTC in minutes right now (DST aware).
function tzOffsetMin(tz, at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}
// City time zone from the campaign name (owner 2026-10-16: every business, its own zone).
function cityTz(name) {
  const n = String(name || '');
  if (/denver|aurora|colorado|mile ?high|boulder/i.test(n)) return 'Asia/Manila';
  if (/houston|austin|astraea|dallas|dfw|fort worth|okc|oklahoma|tulsa|texas/i.test(n)) return 'America/Chicago';
  if (/los angeles|(^|[^a-z])LA([^a-z]|$)|california/.test(n)) return 'America/Los_Angeles';
  return null;
}
// 8:00-20:00 every day in cityTz, written in the ACCOUNT zone as AdScheduleInfo rows.
// shift = account offset - city offset; a window that crosses midnight is split in two,
// and the week wraps (Sunday spills into Monday).
function buildSchedule(cityTzName, acctTzName) {
  const shift = tzOffsetMin(acctTzName) - tzOffsetMin(cityTzName);
  const out = [];
  for (let d = 0; d < 7; d++) {
    let s = ((d * 1440 + OPEN_MIN + shift) % 10080 + 10080) % 10080;
    const e = s + (CLOSE_MIN - OPEN_MIN);
    while (s < e) {
      const dayStart = Math.floor(s / 1440) * 1440, segEnd = Math.min(e, dayStart + 1440);
      const sm = s - dayStart, em = segEnd - dayStart;
      if (!(sm % 15 === 0 && em % 15 === 0)) throw new Error('zone offset is not a multiple of 15 minutes');
      out.push({ dayOfWeek: DAYS[Math.floor(s / 1440) % 7], startHour: Math.floor(sm / 60), startMinute: MIN_ENUM[sm % 60], endHour: Math.floor(em / 60), endMinute: MIN_ENUM[em % 60] });
      s = segEnd;
    }
  }
  return { rows: out, shift };
}
const schedKey = (t) => (t || []).map(x => `${x.dayOfWeek}:${(x.startHour || 0) * 60 + (ENUM_MIN[x.startMinute] || 0)}-${(x.endHour || 0) * 60 + (ENUM_MIN[x.endMinute] || 0)}`).sort().join(',');

// --- account snapshot ------------------------------------------------------------------
const CALL_SEL = 'asset.resource_name, asset.call_asset.phone_number, asset.call_asset.country_code, asset.call_asset.call_conversion_reporting_state, asset.call_asset.call_conversion_action, asset.call_asset.ad_schedule_targets';
const callSpec = (r) => {
  const c = r.asset?.callAsset || {};
  const st = c.callConversionReportingState;
  return { rn: r.asset?.resourceName, phone: c.phoneNumber, country: c.countryCode || 'US', state: st && !/UNSPECIFIED|UNKNOWN/.test(st) ? st : null, action: c.callConversionAction || null, key: schedKey(c.adScheduleTargets) };
};
async function snapshot(db, cid) {
  const [tz, camps, camp, cust, assets, ag, callAds] = await Promise.all([
    q(cid, db, 'SELECT customer.time_zone FROM customer LIMIT 1'),
    q(cid, db, "SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status = 'ENABLED'"),
    q(cid, db, `SELECT campaign.id, campaign.status, campaign_asset.resource_name, ${CALL_SEL} FROM campaign_asset WHERE campaign_asset.field_type = 'CALL' AND campaign_asset.status = 'ENABLED' AND campaign.status = 'ENABLED'`),
    q(cid, db, `SELECT customer_asset.resource_name, ${CALL_SEL} FROM customer_asset WHERE customer_asset.field_type = 'CALL' AND customer_asset.status = 'ENABLED'`),
    q(cid, db, `SELECT ${CALL_SEL} FROM asset WHERE asset.type = 'CALL'`),
    q(cid, db, "SELECT campaign.id, campaign.status, ad_group_asset.resource_name FROM ad_group_asset WHERE ad_group_asset.field_type = 'CALL' AND ad_group_asset.status = 'ENABLED' AND campaign.status = 'ENABLED'"),
    q(cid, db, "SELECT campaign.id, campaign.status FROM ad_group_ad WHERE ad_group_ad.ad.type = 'CALL_AD' AND ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'"),
  ]);
  return {
    cid, db, tz: tz[0]?.customer?.timeZone, campaigns: camps.map(r => ({ id: String(r.campaign.id), name: r.campaign.name })),
    campRows: camp.map(r => ({ campaignId: String(r.campaign.id), linkRn: r.campaignAsset.resourceName, ...callSpec(r) })),
    custRows: cust.map(r => ({ linkRn: r.customerAsset.resourceName, ...callSpec(r) })),
    assets: assets.map(callSpec), agCamps: new Set(ag.map(r => String(r.campaign.id))), callAdCamps: new Set(callAds.map(r => String(r.campaign.id))),
    memo: new Map(),
  };
}

// Create the call asset once per run (same body from two campaigns shares one asset) or reuse one that exists.
function callBody(spec, sched) {
  const c = { countryCode: spec.country, phoneNumber: spec.phone, adScheduleTargets: sched };
  if (spec.state) c.callConversionReportingState = spec.state;
  if (spec.action) c.callConversionAction = spec.action;
  return { callAsset: c };
}
function getCallAsset(db, vo, S, spec, sched, key) {
  const memoKey = digits(spec.phone) + '|' + key + '|' + spec.state + '|' + spec.action;
  if (S.memo.has(memoKey)) return S.memo.get(memoKey);
  const p = (async () => {
    const have = S.assets.find(a => digits(a.phone) === digits(spec.phone) && a.key === key && (a.state || null) === (spec.state || null) && (a.action || null) === (spec.action || null));
    if (have) return have.rn;
    const m = await gadsMutate(db, S.cid, 'assets', [{ create: callBody(spec, sched) }], vo);
    if (errOf(m)) throw new Error('call asset ' + spec.phone + ': ' + errOf(m));
    return m.results?.[0]?.resourceName || null; // validate mode creates nothing
  })();
  S.memo.set(memoKey, p);
  return p;
}

// Campaign id -> the phone its ads must show.
const CAMPAIGN_PHONE = {
  '24324893411': '(218) 513-2890', // Dom's OKC - Search
  // HA Maps-ads tracking lines, TV + Handyman both (owner 2026-10-17)
  '21404594624': '(712) 628-6554', '24333537838': '(712) 628-6554', // Denver TV, Denver Handyman
  '21408085376': '(978) 953-5123', '24333542371': '(978) 953-5123', // Houston TV, Houston Handyman
  '21614608481': '(229) 800-9061', '24322344222': '(229) 800-9061', // Austin TV, Austin Handyman
}; // Dom's OKC - Search -> OKC ads tracking line (CRM logs these as Dom's OKC ads calls)

// --- 1. one campaign -------------------------------------------------------------------
async function campaignCalls(db, vo, S, c, out) {
  if (c.id === ASTRAEA_ID) return { ok: true, note: 'handled by the Astraea step' };
  const city = cityTz(c.name);
  if (!city) return { ok: true, note: 'SKIPPED: no city time zone in the campaign name' };
  if (S.callAdCamps.has(c.id)) return { ok: true, note: 'SKIPPED: call ad campaign' };
  const { rows: sched, shift } = buildSchedule(city, S.tz);
  const key = schedKey(sched);
  const own = S.campRows.filter(r => r.campaignId === c.id);
  const notes = [`${city} -> account ${S.tz} (${shift >= 0 ? '+' : ''}${shift / 60}h)`];
  if (S.agCamps.has(c.id)) notes.push('has ad-group call assets (not touched)');
  let src = own;
  // A campaign whose ads must show its OWN city's number (owner 2026-10-17: Dom's
  // OKC ads were showing Dom's Denver line from the account-level asset).
  const forced = CAMPAIGN_PHONE[c.id];
  if (forced) {
    const tmpl = own[0] || S.custRows[0] || {};
    src = [{ phone: forced, country: 'US', state: tmpl.state || null, action: tmpl.action || null }];
    notes.push('number set to ' + forced);
  } else if (!src.length) {
    const nums = new Set(S.custRows.map(r => digits(r.phone)));
    if (nums.size === 1) { src = S.custRows; notes.push('number taken from the account-level call asset'); }
    else return { ok: true, note: 'SKIPPED: no call asset to copy' + (nums.size > 1 ? ' (account has several numbers)' : '') };
  }
  const specs = []; for (const r of src) if (!specs.some(s => digits(s.phone) === digits(r.phone))) specs.push(r);
  const campaignRn = `customers/${S.cid}/campaigns/${c.id}`;
  const want = [];
  for (const spec of specs) want.push({ spec, rn: await getCallAsset(db, vo, S, spec, sched, key) });
  // Link what is not linked yet.
  const toLink = want.filter(w => w.rn && !own.some(r => r.rn === w.rn));
  if (toLink.length) {
    const l = await gadsMutate(db, S.cid, 'campaignAssets', toLink.map(w => ({ create: { campaign: campaignRn, asset: w.rn, fieldType: 'CALL' } })), vo);
    if (errOf(l)) return { ok: false, note: notes.concat('link: ' + errOf(l)).join('; ') };
    notes.push(toLink.length + ' scheduled call asset(s) linked');
  }
  const pending = want.filter(w => !w.rn);
  if (pending.length) notes.push('asset valid; created and linked on the real run');
  // Remove campaign-level call assets that are not the scheduled ones (unscheduled or an old schedule).
  const keep = new Set(want.map(w => w.rn).filter(Boolean));
  const drop = own.filter(r => !keep.has(r.rn));
  if (drop.length) {
    const m = await gadsMutate(db, S.cid, 'campaignAssets', drop.map(r => ({ remove: r.linkRn })), vo);
    if (errOf(m)) return { ok: false, note: notes.concat('remove old: ' + errOf(m)).join('; ') };
    notes.push(drop.length + ' old call asset(s) removed');
  } else if (!toLink.length && !pending.length) notes.push('already 8am-8pm');
  out.covered = true;
  return { ok: true, note: notes.join('; ') };
}

async function accountLevel(db, vo, S, cov) {
  if (!S.custRows.length) return { ok: true, note: 'no account-level call assets' };
  const missing = S.campaigns.filter(c => !cov.get(c.id)).map(c => c.name);
  if (missing.length) return { ok: true, note: 'KEPT ' + S.custRows.length + ' account-level call asset(s): no scheduled call asset yet on ' + missing.join(', ').slice(0, 300) };
  const m = await gadsMutate(db, S.cid, 'customerAssets', S.custRows.map(r => ({ remove: r.linkRn })), vo);
  if (errOf(m)) return { ok: false, note: 'remove: ' + errOf(m) };
  return { ok: true, note: S.custRows.length + ' account-level call asset(s) removed (every campaign has its own 8am-8pm one)' };
}

// --- 2. Astraea ---------------------------------------------------------------------------
const AST_SITELINKS = [['Pricing', SITE + '/pricing'], ['Central Austin', SITE + '/areas/central-austin'], ['Book Online', SITE + '/book'], ['Handyman Services', SITE + '/handyman']];
const AST_CALLOUTS = ['From $59', 'Fully Insured', 'Same-Day Slots Often Open', 'Any Wall Type', 'Wires Hidden In-Wall'];

async function ensureAssets(db, vo, cid, campaignRn, fieldType, bodies, linkedKeys, haveAssets, keyOf) {
  const todo = bodies.filter(b => !linkedKeys.has(keyOf(b)));
  if (!todo.length) return { n: 0 };
  const rns = [], create = [];
  for (const b of todo) { const f = haveAssets.find(a => a.key === keyOf(b)); if (f) rns.push(f.rn); else create.push(b); }
  if (create.length) {
    const a = await gadsMutate(db, cid, 'assets', create.map(x => ({ create: x })), vo);
    if (errOf(a)) return { err: 'assets: ' + errOf(a) };
    for (const r of (a.results || [])) if (r.resourceName) rns.push(r.resourceName);
  }
  if (vo || !campaignRn) return { n: todo.length, valid: true };
  const l = await gadsMutate(db, cid, 'campaignAssets', rns.map(asset => ({ create: { campaign: campaignRn, asset, fieldType } })), vo);
  return errOf(l) ? { err: 'link: ' + errOf(l) } : { n: rns.length };
}

async function astraea(db, vo, S) {
  const notes = []; let ok = true;
  const exists = S.campaigns.some(c => c.id === ASTRAEA_ID);
  const campaignRn = exists ? `customers/${HA}/campaigns/${ASTRAEA_ID}` : null;
  if (!exists) notes.push('campaign not enabled yet: assets checked now, linked on the real run after the campaign step');
  // Conversion action "Calls from ads" (180s).
  const acts = await q(HA, db, "SELECT conversion_action.resource_name, conversion_action.name, conversion_action.phone_call_duration_seconds FROM conversion_action WHERE conversion_action.status = 'ENABLED' AND conversion_action.type = 'AD_CALL'");
  const act = acts.find(r => /calls from ads/i.test(r.conversionAction.name) && Number(r.conversionAction.phoneCallDurationSeconds) === 180) || acts.find(r => Number(r.conversionAction.phoneCallDurationSeconds) === 180) || acts[0];
  if (!act) return { ok: false, note: 'no "Calls from ads" conversion action found' };
  notes.push('conversion action: ' + act.conversionAction.name + ' (' + (act.conversionAction.phoneCallDurationSeconds || '?') + 's)');
  // Call asset, Central 8-8 in the HA account zone.
  const { rows: sched, shift } = buildSchedule('America/Chicago', S.tz);
  const key = schedKey(sched);
  notes.push(`America/Chicago -> account ${S.tz} (${shift >= 0 ? '+' : ''}${shift / 60}h)`);
  const spec = { phone: ASTRAEA_PHONE, country: 'US', state: 'USE_RESOURCE_LEVEL_CALL_CONVERSION_ACTION', action: act.conversionAction.resourceName };
  const own = exists ? await q(HA, db, `SELECT campaign.id, campaign_asset.resource_name, ${CALL_SEL} FROM campaign_asset WHERE campaign.id = ${ASTRAEA_ID} AND campaign_asset.field_type = 'CALL' AND campaign_asset.status = 'ENABLED'`) : [];
  const ownSpecs = own.map(r => ({ linkRn: r.campaignAsset.resourceName, ...callSpec(r) }));
  const rn = await getCallAsset(db, vo, S, spec, sched, key);
  if (rn && campaignRn && !ownSpecs.some(r => r.rn === rn)) {
    const l = await gadsMutate(db, HA, 'campaignAssets', [{ create: { campaign: campaignRn, asset: rn, fieldType: 'CALL' } }], vo);
    if (errOf(l)) { ok = false; notes.push('call link: ' + errOf(l)); } else notes.push('call asset linked');
  } else notes.push(rn ? 'call asset already on the campaign' : 'call asset valid');
  // Any other call asset on Astraea (none expected) would show 24/7: remove it.
  const stale = ownSpecs.filter(r => r.rn !== rn);
  if (stale.length && rn) {
    const m = await gadsMutate(db, HA, 'campaignAssets', stale.map(r => ({ remove: r.linkRn })), vo);
    if (errOf(m)) { ok = false; notes.push('remove: ' + errOf(m)); } else notes.push(stale.length + ' other call asset(s) removed');
  }
  // Sitelinks + callouts (only URLs that return 200 on the live site).
  const have = await q(HA, db, "SELECT asset.resource_name, asset.type, asset.sitelink_asset.link_text, asset.callout_asset.callout_text, asset.final_urls FROM asset WHERE asset.type IN ('SITELINK','CALLOUT')");
  const slHave = have.filter(r => r.asset.type === 'SITELINK').map(r => ({ rn: r.asset.resourceName, key: lc(r.asset.sitelinkAsset?.linkText) + '|' + (r.asset.finalUrls || [])[0] }));
  const coHave = have.filter(r => r.asset.type === 'CALLOUT').map(r => ({ rn: r.asset.resourceName, key: lc(r.asset.calloutAsset?.calloutText) }));
  const linked = exists ? await q(HA, db, `SELECT campaign.id, campaign_asset.field_type, asset.sitelink_asset.link_text, asset.callout_asset.callout_text, asset.final_urls FROM campaign_asset WHERE campaign.id = ${ASTRAEA_ID} AND campaign_asset.field_type IN ('SITELINK','CALLOUT') AND campaign_asset.status = 'ENABLED'`) : [];
  const slLinked = new Set(linked.filter(r => r.campaignAsset.fieldType === 'SITELINK').map(r => lc(r.asset.sitelinkAsset?.linkText) + '|' + (r.asset.finalUrls || [])[0]));
  const coLinked = new Set(linked.filter(r => r.campaignAsset.fieldType === 'CALLOUT').map(r => lc(r.asset.calloutAsset?.calloutText)));
  const sl = [];
  for (const [text, url] of AST_SITELINKS) {
    if (text.length > 25) { notes.push('skip ' + text + ' (over 25 chars)'); continue; }
    if (!(await urlOk(url))) { notes.push('skip ' + text + ' (not 200)'); continue; }
    sl.push({ finalUrls: [url], sitelinkAsset: { linkText: text } });
  }
  const s = await ensureAssets(db, vo, HA, campaignRn, 'SITELINK', sl, slLinked, slHave, b => lc(b.sitelinkAsset.linkText) + '|' + b.finalUrls[0]);
  if (s.err) { ok = false; notes.push('sitelinks ' + s.err); } else notes.push(s.n + ' sitelink(s) ' + (s.valid ? 'valid' : 'added'));
  const co = AST_CALLOUTS.filter(t => t.length <= 25).map(calloutText => ({ calloutAsset: { calloutText } }));
  const c = await ensureAssets(db, vo, HA, campaignRn, 'CALLOUT', co, coLinked, coHave, b => lc(b.calloutAsset.calloutText));
  if (c.err) { ok = false; notes.push('callouts ' + c.err); } else notes.push(c.n + ' callout(s) ' + (c.valid ? 'valid' : 'added'));
  return { ok, note: notes.join('; ') };
}

// --- Runner -------------------------------------------------------------------------------
async function step(name, fn) {
  try { const r = await fn(); return { step: name, ok: !!r.ok, note: String(r.note || '').slice(0, 600) }; }
  catch (e) { return { step: name, ok: false, note: String(e.message || e).slice(0, 600) }; }
}

export async function gadsApply20261016b(db, { validateOnly } = {}) {
  const vo = !!validateOnly;
  // Accounts run side by side; campaigns inside an account run side by side too (different
  // campaigns may be edited together). Each campaign's own mutates run one after another.
  const perAccount = async ([cid, label]) => {
    let S;
    try { S = await snapshot(db, cid); } catch (e) { return [{ step: 'Call hours ' + label, ok: false, note: String(e.message || e).slice(0, 600) }]; }
    if (!S.tz) return [{ step: 'Call hours ' + label, ok: false, note: 'account time zone not found' }];
    const cov = new Map();
    const steps = await Promise.all(S.campaigns.map(async c => {
      const out = {};
      const r = await step(`Call hours ${label}: ${c.name}`, () => campaignCalls(db, vo, S, c, out));
      cov.set(c.id, !!out.covered && r.ok);
      return r;
    }));
    if (cid === HA) {
      const a = await step('Astraea call asset, sitelinks, callouts', () => astraea(db, vo, S));
      steps.push(a);
      if (a.ok) cov.set(ASTRAEA_ID, true);
    }
    steps.push(await step(`Call hours ${label}: account-level`, () => accountLevel(db, vo, S, cov)));
    return steps;
  };
  const steps = (await Promise.all(ACCOUNTS.map(perAccount))).flat();
  const out = { validateOnly: vo, at: new Date().toISOString(), steps };
  if (!vo) await db.from('integration_tokens').upsert({ provider: 'google_ads_fixes_20261016b', value: JSON.stringify(out), updated_at: out.at }, { onConflict: 'provider' });
  return out;
}
