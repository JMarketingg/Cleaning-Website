// Google Ads change set the owner approved on 2026-10-16, run by the owner from the
// Google Ads panel ("Apply"). First call is validate_only (nothing changes), then the
// real run. Every step looks things up first and skips what is already done.
//   1. goals: CRM booking primary, website booking tags secondary, custom goals swap
//   2. HA Austin TV budget $5/day (own budget if shared)
//   3. Houston TV: Manual CPC $5, ZIP modifiers off + 3 ZIPs out, negatives,
//      keywords, new RSA, sitelinks + callouts
//   4. new "Astraea - Austin Home Cleaning" Search campaign
// Returns { validateOnly, steps: [{ step, ok, note }] }.
import { gadsQuery, gadsMutate } from './gads.js';

const HA = '4038873594', DOMS = '4616306123', A1 = '2893668990';
const AUSTIN_TV = '21614608481', HOUSTON_TV = '21408085376', DOMS_OKC = '24324893411';
const HOU_AG = 'Houston - Home Cleaning';
const SITE = 'https://www.ihandyandy.com';
const ASTRAEA = 'Astraea - Austin Home Cleaning';
const micros = (usd) => String(Math.round(usd * 1e6));
const errOf = (r) => r?.error || r?.partialFailureError?.message || null;
const lc = (s) => String(s || '').trim().toLowerCase();
const kkey = (t, m) => lc(t) + '|' + m;

async function q(cid, db, gaql) {
  const r = await gadsQuery(db, cid, gaql);
  if (r.error) throw new Error(r.error);
  return r.rows || [];
}

// --- 1. Goals -----------------------------------------------------------------
async function goals(db, vo, cid, secondaryNames) {
  const rows = await q(cid, db, "SELECT conversion_action.resource_name, conversion_action.name, conversion_action.primary_for_goal FROM conversion_action WHERE conversion_action.status = 'ENABLED'");
  const by = Object.fromEntries(rows.map(r => [r.conversionAction.name, r.conversionAction]));
  const ops = [], notes = [];
  const crm = by['CRM booking'];
  if (!crm) notes.push('no CRM booking action');
  else if (!crm.primaryForGoal) ops.push({ update: { resourceName: crm.resourceName, primaryForGoal: true }, updateMask: 'primaryForGoal' });
  for (const n of secondaryNames) {
    const a = by[n];
    if (!a) { notes.push('missing: ' + n); continue; }
    if (a.primaryForGoal) ops.push({ update: { resourceName: a.resourceName, primaryForGoal: false }, updateMask: 'primaryForGoal' });
  }
  if (!ops.length) return { ok: !!crm, note: ['already set', ...notes].join('; '), byName: by };
  const m = await gadsMutate(db, cid, 'conversionActions', ops, vo);
  return { ok: !errOf(m), note: [ops.length + ' change(s)', errOf(m), ...notes].filter(Boolean).join('; '), byName: by };
}

// Swap one action for CRM booking inside a custom goal (keeps the rest).
async function customGoalSwap(db, vo, cid, goalName, outName, byName, mustBeUsedBy) {
  const crm = byName['CRM booking']?.resourceName;
  if (!crm) return { ok: false, note: 'no CRM booking action' };
  const g = (await q(cid, db, `SELECT custom_conversion_goal.resource_name, custom_conversion_goal.name, custom_conversion_goal.conversion_actions, custom_conversion_goal.status FROM custom_conversion_goal WHERE custom_conversion_goal.name = '${goalName}'`))[0]?.customConversionGoal;
  if (!g) return { ok: true, note: 'goal not found, skipped' };
  if (mustBeUsedBy) {
    const used = await q(cid, db, `SELECT conversion_goal_campaign_config.custom_conversion_goal, campaign.id FROM conversion_goal_campaign_config WHERE campaign.id = ${mustBeUsedBy}`);
    if (!used.some(r => r.conversionGoalCampaignConfig?.customConversionGoal === g.resourceName)) return { ok: true, note: 'not used by campaign ' + mustBeUsedBy + ', skipped' };
  }
  const out = byName[outName]?.resourceName;
  const cur = g.conversionActions || [];
  const next = [...new Set(cur.filter(x => x !== out).concat(crm))];
  if (next.length === cur.length && next.every(x => cur.includes(x))) return { ok: true, note: 'already set' };
  const m = await gadsMutate(db, cid, 'customConversionGoals', [{ update: { resourceName: g.resourceName, conversionActions: next }, updateMask: 'conversionActions' }], vo, { noPartial: true });
  return { ok: !errOf(m), note: errOf(m) || `${cur.length} -> ${next.length} actions` };
}

// --- 2. Austin TV budget ---------------------------------------------------------
async function austinBudget(db, vo) {
  const c = (await q(HA, db, `SELECT campaign.resource_name, campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.reference_count FROM campaign WHERE campaign.id = ${AUSTIN_TV}`))[0];
  if (!c) return { ok: false, note: 'campaign not found' };
  const b = c.campaignBudget || {};
  if (String(b.amountMicros) === micros(5)) return { ok: true, note: 'already $5' };
  const shared = b.explicitlyShared || Number(b.referenceCount || 0) > 1;
  if (!shared) {
    const m = await gadsMutate(db, HA, 'campaignBudgets', [{ update: { resourceName: b.resourceName, amountMicros: micros(5) }, updateMask: 'amountMicros' }], vo);
    return { ok: !errOf(m), note: errOf(m) || 'budget -> $5' };
  }
  const name = 'Austin TV $5 (2026-10-16)';
  let own = (await q(HA, db, `SELECT campaign_budget.resource_name FROM campaign_budget WHERE campaign_budget.name = '${name}' AND campaign_budget.status = 'ENABLED'`))[0]?.campaignBudget?.resourceName;
  if (!own) {
    const m = await gadsMutate(db, HA, 'campaignBudgets', [{ create: { name, amountMicros: micros(5), deliveryMethod: 'STANDARD', explicitlyShared: false } }], vo);
    if (errOf(m)) return { ok: false, note: 'new budget: ' + errOf(m) };
    if (vo) return { ok: true, note: 'shared budget; new $5 budget validated (swap checked on real run)' };
    own = m.results?.[0]?.resourceName;
  }
  const s = await gadsMutate(db, HA, 'campaigns', [{ update: { resourceName: c.campaign.resourceName, campaignBudget: own }, updateMask: 'campaignBudget' }], vo);
  return { ok: !errOf(s), note: errOf(s) || 'moved to own $5 budget' };
}

// --- 3. Houston TV ---------------------------------------------------------------
async function houAdGroup(db) {
  const r = (await q(HA, db, `SELECT ad_group.resource_name, ad_group.cpc_bid_micros FROM ad_group WHERE campaign.id = ${HOUSTON_TV} AND ad_group.name = '${HOU_AG}' AND ad_group.status != 'REMOVED'`))[0]?.adGroup;
  if (!r) throw new Error('ad group "' + HOU_AG + '" not found');
  return r;
}

async function houBidding(db, vo) {
  const c = (await q(HA, db, `SELECT campaign.resource_name, campaign.bidding_strategy_type, campaign.manual_cpc.enhanced_cpc_enabled FROM campaign WHERE campaign.id = ${HOUSTON_TV}`))[0]?.campaign;
  if (!c) return { ok: false, note: 'campaign not found' };
  const notes = [];
  let ok = true;
  if (c.biddingStrategyType !== 'MANUAL_CPC' || c.manualCpc?.enhancedCpcEnabled) {
    const m = await gadsMutate(db, HA, 'campaigns', [{ update: { resourceName: c.resourceName, manualCpc: { enhancedCpcEnabled: false } }, updateMask: 'manualCpc.enhancedCpcEnabled' }], vo);
    if (errOf(m)) { ok = false; notes.push('bidding: ' + errOf(m)); } else notes.push(c.biddingStrategyType + ' -> Manual CPC');
  } else notes.push('already Manual CPC');
  const ag = await houAdGroup(db);
  if (String(ag.cpcBidMicros) !== micros(5)) {
    const m = await gadsMutate(db, HA, 'adGroups', [{ update: { resourceName: ag.resourceName, cpcBidMicros: micros(5) }, updateMask: 'cpcBidMicros' }], vo);
    if (errOf(m)) { ok = false; notes.push('cpc: ' + errOf(m)); } else notes.push('CPC $5');
  } else notes.push('CPC already $5');
  return { ok, note: notes.join('; ') };
}

async function houZips(db, vo) {
  const crit = await q(HA, db, `SELECT campaign_criterion.resource_name, campaign_criterion.location.geo_target_constant, campaign_criterion.bid_modifier FROM campaign_criterion WHERE campaign.id = ${HOUSTON_TV} AND campaign_criterion.type = 'LOCATION' AND campaign_criterion.negative = FALSE AND campaign_criterion.status != 'REMOVED'`);
  const geos = [...new Set(crit.map(r => r.campaignCriterion.location?.geoTargetConstant).filter(Boolean))];
  if (!geos.length) return { ok: true, note: 'no location targets' };
  const g = await q(HA, db, `SELECT geo_target_constant.resource_name, geo_target_constant.name, geo_target_constant.canonical_name, geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.resource_name IN (${geos.map(x => `'${x}'`).join(',')})`);
  const info = Object.fromEntries(g.map(r => [r.geoTargetConstant.resourceName, r.geoTargetConstant]));
  const DROP = ['77345', '77450', '77094'];
  const ops = []; let removed = 0, reset = 0;
  for (const r of crit) {
    const gi = info[r.campaignCriterion.location?.geoTargetConstant];
    if (!gi || gi.targetType !== 'Postal Code') continue;
    if (DROP.includes(String(gi.name))) { ops.push({ remove: r.campaignCriterion.resourceName }); removed++; continue; }
    const bm = r.campaignCriterion.bidModifier;
    if (bm != null && Number(bm) !== 1) { ops.push({ update: { resourceName: r.campaignCriterion.resourceName, bidModifier: 1 }, updateMask: 'bidModifier' }); reset++; }
  }
  if (!ops.length) return { ok: true, note: 'already clean' };
  const m = await gadsMutate(db, HA, 'campaignCriteria', ops, vo);
  return { ok: !errOf(m), note: errOf(m) || `${reset} modifier(s) off, ${removed} ZIP(s) removed` };
}

const HOU_NEG = ['tv pro handy', 'tvpro', 'tvprousa', 'tv mount master', 'mount experts', 'dtv mounting', 'xpress tv', 'clutch city', 'magic mounting', 'frame pro', 'hellotech', 'geek squad', 'htv mounting', 'houston mounting pros', 'hangsmart', 'sylvox', 'perlegear', 'gtech', 'articulating', 'studless', 'drilling', 'tv mount for', 'conroe', 'galveston']
  .map(text => ({ text, matchType: 'PHRASE' })).concat([{ text: 'houston mounting', matchType: 'EXACT' }]);

async function campaignNegatives(db, vo, cid, campaignRn, campaignId, list) {
  const ex = await q(cid, db, `SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion WHERE campaign.id = ${campaignId} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE AND campaign_criterion.status != 'REMOVED'`);
  const have = new Set(ex.map(r => kkey(r.campaignCriterion.keyword?.text, r.campaignCriterion.keyword?.matchType)));
  const add = list.filter(k => !have.has(kkey(k.text, k.matchType)));
  if (!add.length) return { ok: true, note: 'all ' + list.length + ' already there' };
  const m = await gadsMutate(db, cid, 'campaignCriteria', add.map(k => ({ create: { campaign: campaignRn, negative: true, keyword: k } })), vo);
  return { ok: !errOf(m), note: errOf(m) || add.length + ' added' };
}

const EP = (t) => [[t, 'EXACT'], [t, 'PHRASE']];
const HOU_KW = [...EP('tv mounting houston'), ...EP('houston tv mounting'), ['tv mounting near me', 'EXACT'], ['tv mounting service near me', 'EXACT'],
  ...EP('tv mounting service'), ...EP('tv installation houston'), ['tv mount installation near me', 'EXACT'], ['tv mounting over fireplace', 'PHRASE'],
  ['tv mounting company', 'PHRASE'], ['professional tv mounting', 'EXACT'], ['handy andy tv mounting', 'EXACT']];

// Make sure keywords exist + are enabled in an ad group; returns ops summary.
async function ensureKeywords(db, vo, cid, agRn, existing, want) {
  const by = new Map(existing.filter(r => r.adGroupCriterion.adGroup === agRn).map(r => [kkey(r.adGroupCriterion.keyword?.text, r.adGroupCriterion.keyword?.matchType), r.adGroupCriterion]));
  const ops = []; let created = 0, enabled = 0;
  for (const [text, matchType] of want) {
    const e = by.get(kkey(text, matchType));
    if (!e) { ops.push({ create: { adGroup: agRn, status: 'ENABLED', keyword: { text, matchType } } }); created++; }
    else if (e.status === 'PAUSED') { ops.push({ update: { resourceName: e.resourceName, status: 'ENABLED' }, updateMask: 'status' }); enabled++; }
  }
  return { ops, created, enabled };
}

async function houKeywords(db, vo) {
  const ag = await houAdGroup(db);
  const all = await q(HA, db, `SELECT ad_group_criterion.resource_name, ad_group_criterion.ad_group, ad_group_criterion.status, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE campaign.id = ${HOUSTON_TV} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'`);
  const { ops, created, enabled } = await ensureKeywords(db, vo, HA, ag.resourceName, all, HOU_KW);
  let paused = 0;
  const PAUSE_EXACT = new Set(['houston tv mounting pros', 'tv mounting conroe']);
  for (const r of all) {
    const k = r.adGroupCriterion; if (k.status !== 'ENABLED') continue;
    const t = lc(k.keyword?.text).replace(/^\+/, ''), mt = k.keyword?.matchType;
    const pauseBroad = mt === 'BROAD' && t !== 'tv mounting houston';
    const pauseExact = mt === 'EXACT' && PAUSE_EXACT.has(t);
    if (pauseBroad || pauseExact) { ops.push({ update: { resourceName: k.resourceName, status: 'PAUSED' }, updateMask: 'status' }); paused++; }
  }
  if (!ops.length) return { ok: true, note: 'already set' };
  const m = await gadsMutate(db, HA, 'adGroupCriteria', ops, vo);
  return { ok: !errOf(m), note: errOf(m) || `${created} added, ${enabled} re-enabled, ${paused} paused` };
}

// Claims checked against the live Houston page on 2026-10-16: from $139, lifetime
// mount warranty, pay when it's done / no deposits, 5.0 (249 reviews), same-day
// slots, brick/stone/fireplace, in-wall wire concealment, book in 3 minutes.
// Dropped "Upfront Price, No Surprises": the page has no upfront-price claim.
const HOU_RSA = {
  finalUrl: SITE + '/houston-tv-mounting', path1: 'houston', path2: 'tv-mounting',
  headlines: [['Home Cleaning in Houston', 'HEADLINE_1'], ['Houston Home Cleaning Service', 'HEADLINE_1'], ['TV Installation in Houston'], ['Pro Home Cleaning Near You'],
    ['Same-Day Home Cleaning'], ['Lifetime Mount Warranty'], ["Pay Only After It's Done"], ['Rated 5.0 Stars on Google'], ['200+ 5-Star Google Reviews'],
    ['Home Cleaning From $139'], ['Brick, Stone & Fireplace'], ['Wires Hidden in the Wall'], ['Book Online in 3 Minutes'], ['Local Houston Home Cleaning']],
  descriptions: ['Houston home cleaning with a lifetime mount warranty. You pay only after the job is done.',
    'Rated 5.0 on Google by Houston customers. Book online, then pick a time that suits you.',
    'Drywall, brick, stone or above the fireplace. Wires hidden in the wall. Same-day slots.',
    'Book online in 3 minutes. No deposit. No surprises, no upsells at the door.'],
};
const rsaBody = (r) => ({
  finalUrls: [r.finalUrl],
  responsiveSearchAd: {
    headlines: r.headlines.map(([text, pin]) => pin ? { text, pinnedField: pin } : { text }),
    descriptions: r.descriptions.map(text => ({ text })),
    path1: r.path1, path2: r.path2,
  },
});
function rsaCheck(r) {
  const bad = r.headlines.filter(([t]) => t.length > 30).map(([t]) => t).concat(r.descriptions.filter(t => t.length > 90));
  if (bad.length) throw new Error('too long: ' + bad.join(' | '));
}

async function houAds(db, vo) {
  rsaCheck(HOU_RSA);
  const ag = await houAdGroup(db);
  const ads = await q(HA, db, `SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines FROM ad_group_ad WHERE campaign.id = ${HOUSTON_TV} AND ad_group_ad.status = 'ENABLED'`);
  const heads = (a) => (a.ad?.responsiveSearchAd?.headlines || []).map(h => h.text || '');
  const isNew = (a) => (a.ad?.finalUrls || []).includes(HOU_RSA.finalUrl) && heads(a).includes('Home Cleaning in Houston') && heads(a).includes('Houston Home Cleaning Service');
  const notes = []; let ok = true;
  if (!ads.some(r => isNew(r.adGroupAd))) {
    const m = await gadsMutate(db, HA, 'adGroupAds', [{ create: { adGroup: ag.resourceName, status: 'ENABLED', ad: rsaBody(HOU_RSA) } }], vo);
    if (errOf(m)) return { ok: false, note: 'new RSA: ' + errOf(m) + ' (nothing paused)' };
    notes.push('new RSA');
  } else notes.push('new RSA already there');
  const pause = ads.filter(r => {
    const a = r.adGroupAd; if (isNew(a)) return false;
    const h = heads(a).join(' | ');
    return /Houston Home Cleaning Pros/i.test(h) || a.policySummary?.approvalStatus === 'DISAPPROVED'
      || (a.ad?.finalUrls || []).some(u => /denver/i.test(u))
      || /\$99|24\/7|\b247\b|Licensed|60 Seconds/i.test(h);
  });
  if (pause.length) {
    const m = await gadsMutate(db, HA, 'adGroupAds', pause.map(r => ({ update: { resourceName: r.adGroupAd.resourceName, status: 'PAUSED' }, updateMask: 'status' })), vo);
    if (errOf(m)) { ok = false; notes.push('pause: ' + errOf(m)); } else notes.push(pause.length + ' old ad(s) paused');
  } else notes.push('nothing to pause');
  return { ok, note: notes.join('; ') };
}

async function urlOk(u) {
  try { const r = await fetch(u, { redirect: 'follow' }); return r.status === 200; } catch { return false; }
}

const HOU_SITELINKS = [['Home Theater Setup', SITE + '/houston-home-theater-installation'], ['Commercial Home Cleaning', SITE + '/commercial-tv-mounting-houston'],
  ['Book Online', SITE + '/book'], ['Samsung Frame Install', SITE + '/samsung-frame-installation-houston']];
const HOU_CALLOUTS = ['Lifetime Mount Warranty', 'Pay After the Job', 'No Deposit', 'Same-Day Slots', 'Local Houston Tech', 'Book in 3 Minutes'];
const HOU_CALLOUTS_DROP = new Set(['licensed and insured', 'free estimate', 'free estimates', 'book by phone', '10+ years of experience', 'affordable pricing', 'same-day service']);

async function attachAssets(db, vo, cid, campaignRn, fieldType, assetBodies) {
  if (!assetBodies.length) return { n: 0 };
  // Reuse an asset that already exists with the same text (+ URL): a crashed earlier
  // run left ours created but never linked to the campaign.
  const have = await q(cid, db, `SELECT asset.resource_name, asset.sitelink_asset.link_text, asset.callout_asset.callout_text, asset.final_urls FROM asset WHERE asset.type = '${fieldType}'`);
  const find = b => have.find(r => b.sitelinkAsset ? (lc(r.asset?.sitelinkAsset?.linkText) === lc(b.sitelinkAsset.linkText) && (r.asset?.finalUrls || [])[0] === b.finalUrls[0]) : lc(r.asset?.calloutAsset?.calloutText) === lc(b.calloutAsset.calloutText));
  const reuse = assetBodies.map(find).filter(Boolean).map(r => r.asset.resourceName);
  const toCreate = assetBodies.filter(b => !find(b));
  let created = [];
  if (toCreate.length) {
    const a = await gadsMutate(db, cid, 'assets', toCreate.map(create => ({ create })), vo);
    if (errOf(a)) return { err: 'assets: ' + errOf(a) };
    created = (a.results || []).map(x => x.resourceName).filter(Boolean);
  }
  if (vo) return { n: assetBodies.length };
  const rns = [...reuse, ...created];
  const l = await gadsMutate(db, cid, 'campaignAssets', rns.map(asset => ({ create: { campaign: campaignRn, asset, fieldType } })), vo);
  return errOf(l) ? { err: 'link: ' + errOf(l) } : { n: rns.length };
}

async function houExtensions(db, vo) {
  const campaignRn = `customers/${HA}/campaigns/${HOUSTON_TV}`;
  const cur = await q(HA, db, `SELECT campaign.id, campaign_asset.resource_name, campaign_asset.field_type, campaign_asset.status, asset.final_urls, asset.sitelink_asset.link_text, asset.callout_asset.callout_text FROM campaign_asset WHERE campaign.id = ${HOUSTON_TV} AND campaign_asset.field_type IN ('SITELINK','CALLOUT') AND campaign_asset.status = 'ENABLED'`);
  const notes = []; let ok = true;
  // Remove sitelinks to Denver pages or dead pages.
  const sl = cur.filter(r => r.campaignAsset.fieldType === 'SITELINK');
  const drop = [];
  for (const r of sl) {
    const u = (r.asset?.finalUrls || [])[0] || '';
    if (/denver/i.test(u) || (u && !(await urlOk(u)))) drop.push(r.campaignAsset.resourceName);
  }
  if (drop.length) {
    const m = await gadsMutate(db, HA, 'campaignAssets', drop.map(rn => ({ remove: rn })), vo);
    if (errOf(m)) { ok = false; notes.push('remove: ' + errOf(m)); } else notes.push(drop.length + ' bad sitelink(s) removed');
  }
  const haveSl = new Set(sl.filter(r => !drop.includes(r.campaignAsset.resourceName)).map(r => lc(r.asset?.sitelinkAsset?.linkText)));
  const newSl = [];
  for (const [text, url] of HOU_SITELINKS) {
    if (haveSl.has(lc(text))) continue;
    if (!(await urlOk(url))) { notes.push('skip ' + text + ' (not 200)'); continue; }
    newSl.push({ finalUrls: [url], sitelinkAsset: { linkText: text } });
  }
  const s = await attachAssets(db, vo, HA, campaignRn, 'SITELINK', newSl);
  if (s.err) { ok = false; notes.push('sitelinks ' + s.err); } else notes.push(s.n + ' sitelink(s) added');
  const coRows = cur.filter(r => r.campaignAsset.fieldType === 'CALLOUT');
  const haveCo = new Set(coRows.map(r => lc(r.asset?.calloutAsset?.calloutText)));
  const newCo = HOU_CALLOUTS.filter(t => !haveCo.has(lc(t))).map(calloutText => ({ calloutAsset: { calloutText } }));
  // Google allows 20 callouts per campaign and Houston is full: drop the untrue or
  // duplicate ones (owner 2026-10-16) to make room.
  if (newCo.length && coRows.length + newCo.length > 20) {
    const dropCo = coRows.filter(r => HOU_CALLOUTS_DROP.has(lc(r.asset?.calloutAsset?.calloutText))).map(r => r.campaignAsset.resourceName);
    if (dropCo.length) {
      const m = await gadsMutate(db, HA, 'campaignAssets', dropCo.map(rn => ({ remove: rn })), vo);
      if (errOf(m)) { ok = false; notes.push('callout remove: ' + errOf(m)); } else notes.push(dropCo.length + ' old callout(s) removed');
    }
  }
  const c = await attachAssets(db, vo, HA, campaignRn, 'CALLOUT', newCo);
  if (c.err) { if (/limit/i.test(c.err)) notes.push('callouts skipped: campaign already at the Google callout limit'); else { ok = false; notes.push('callouts ' + c.err); } } else notes.push(c.n + ' callout(s) added');
  return { ok, note: notes.join('; ') };
}

// --- 4. Astraea campaign -----------------------------------------------------------
const AST_KW = [...EP('tv mounting service'), ['tv mounting company', 'PHRASE'], ['professional tv mounting', 'EXACT'], ...EP('tv installation service'),
  ...EP('tv wall mount installation'), ['tv mounting near me', 'EXACT'], ['tv mounting service near me', 'EXACT'], ['tv installation near me', 'EXACT'],
  ...EP('tv mounting austin'), ...EP('austin tv mounting'), ...EP('tv installation austin'), ...EP('tv mounting service austin'), ['astraea tv mounting', 'EXACT']];
// Claims checked against live austinmounting.com on 2026-10-16: from $59, fully
// insured, brick/stone/tile/fireplace, in-wall wires, same-day often available,
// ZIP shows exact total, Central Austin. No reviews, licenses or warranty claimed.
const AST_RSA = {
  finalUrl: 'https://austinmounting.com/go/start', path1: 'austin', path2: 'tv-mounting',
  headlines: [['Home Cleaning in Austin', 'HEADLINE_1'], ['Austin Home Cleaning Service', 'HEADLINE_1'], ['Astraea Home Cleaning Austin'], ['Home Cleaning From $59'],
    ['Fully Insured Installers'], ['Brick, Stone & Tile Walls'], ['Above-Fireplace Mounting'], ['Wires Hidden In-Wall'], ['Same-Day Slots Often Open'],
    ['See Your Exact Total Online'], ['Central Austin Home Cleaning'], ['Pro Home Cleaning Near You'], ['Book Your TV Mount Online']],
  descriptions: ['home cleaning in Austin from $59. Fully insured. Enter your ZIP to see your exact total.',
    'Drywall, brick, stone, tile or above the fireplace. We bring the right tools for the job.',
    'Wires hidden in-wall for a clean look. Same-day slots are often available in Austin.',
    'Serving Central Austin. Book online and pick a time that works for you.'],
};

async function astraea(db, vo) {
  rsaCheck(AST_RSA);
  const notes = [];
  let bad = false;
  const mark = (m, label, okText) => { const e = errOf(m); if (e) bad = true; notes.push(e ? label + ': ' + e : okText); };
  const geo = (await q(HA, db, "SELECT geo_target_constant.resource_name, geo_target_constant.canonical_name FROM geo_target_constant WHERE geo_target_constant.name = 'Austin' AND geo_target_constant.country_code = 'US' AND geo_target_constant.target_type = 'City' AND geo_target_constant.status = 'ENABLED'"))
    .map(r => r.geoTargetConstant).find(g => g.canonicalName === 'Austin,Texas,United States')?.resourceName;
  if (!geo) return { ok: false, note: 'Austin TX geo not found' };
  const list = (await q(HA, db, "SELECT shared_set.resource_name FROM shared_set WHERE shared_set.name = 'TV negatives (master) 2026-10' AND shared_set.status = 'ENABLED'"))[0]?.sharedSet?.resourceName;
  if (!list) notes.push('master list missing');

  let camp = (await q(HA, db, `SELECT campaign.resource_name, campaign.id, campaign.status FROM campaign WHERE campaign.name = '${ASTRAEA}' AND campaign.status != 'REMOVED'`))[0]?.campaign;
  // In validate mode nothing gets created, so children are checked against existing parents.
  let parentCamp = camp?.resourceName, parentAg = null;
  if (!camp) {
    const bName = ASTRAEA + ' budget';
    let budget = (await q(HA, db, `SELECT campaign_budget.resource_name FROM campaign_budget WHERE campaign_budget.name = '${bName}' AND campaign_budget.status = 'ENABLED'`))[0]?.campaignBudget?.resourceName;
    if (!budget) {
      const b = await gadsMutate(db, HA, 'campaignBudgets', [{ create: { name: bName, amountMicros: micros(40), deliveryMethod: 'STANDARD', explicitlyShared: false } }], vo);
      if (errOf(b)) return { ok: false, note: 'budget: ' + errOf(b) };
      if (vo) return { ok: true, note: 'budget OK; campaign checked on the real run (needs its new budget first)' };
      budget = b.results?.[0]?.resourceName;
    }
    const c = await gadsMutate(db, HA, 'campaigns', [{ create: {
      name: ASTRAEA, status: vo ? 'PAUSED' : 'ENABLED', advertisingChannelType: 'SEARCH', campaignBudget: budget,
      manualCpc: { enhancedCpcEnabled: false },
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
      geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' },
      containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    } }], vo);
    if (errOf(c)) return { ok: false, note: 'campaign: ' + errOf(c) };
    if (vo) { notes.push('budget + campaign valid'); parentCamp = null; }
    else { parentCamp = c.results?.[0]?.resourceName; notes.push('campaign created ENABLED'); }
  } else notes.push('campaign exists (' + camp.status + ')');

  // Campaign criteria (real run only; validate would collide with an existing campaign).
  if (parentCamp) {
    const cid = parentCamp.split('/').pop();
    const crit = await q(HA, db, `SELECT campaign_criterion.type, campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant FROM campaign_criterion WHERE campaign.id = ${cid} AND campaign_criterion.status != 'REMOVED'`);
    const ops = [];
    if (!crit.some(r => r.campaignCriterion.location?.geoTargetConstant === geo)) ops.push({ create: { campaign: parentCamp, location: { geoTargetConstant: geo } } });
    if (!crit.some(r => r.campaignCriterion.language?.languageConstant === 'languageConstants/1000')) ops.push({ create: { campaign: parentCamp, language: { languageConstant: 'languageConstants/1000' } } });
    if (ops.length) mark(await gadsMutate(db, HA, 'campaignCriteria', ops, vo), 'geo/lang', 'Austin + English');
    const n = await campaignNegatives(db, vo, HA, parentCamp, cid, [{ text: 'handy andy', matchType: 'PHRASE' }, { text: 'ihandyandy', matchType: 'PHRASE' }]);
    if (!n.ok) bad = true;
    notes.push('negatives: ' + n.note);
    if (list) {
      const att = await q(HA, db, `SELECT campaign_shared_set.resource_name FROM campaign_shared_set WHERE campaign.id = ${cid} AND campaign_shared_set.shared_set = '${list}' AND campaign_shared_set.status = 'ENABLED'`);
      if (!att.length) mark(await gadsMutate(db, HA, 'campaignSharedSets', [{ create: { campaign: parentCamp, sharedSet: list } }], vo), 'list', 'master list on');
    }
    parentAg = (await q(HA, db, `SELECT ad_group.resource_name FROM ad_group WHERE campaign.id = ${cid} AND ad_group.name = 'Austin Home Cleaning' AND ad_group.status != 'REMOVED'`))[0]?.adGroup?.resourceName || null;
  } else notes.push('geo ' + geo + ', English, negatives, master list set on real run');

  // Ad group
  if (!parentAg) {
    const agCamp = parentCamp || `customers/${HA}/campaigns/${AUSTIN_TV}`;
    const g = await gadsMutate(db, HA, 'adGroups', [{ create: { campaign: agCamp, name: parentCamp ? 'Austin Home Cleaning' : 'Austin Home Cleaning (check)', status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: micros(6) } }], vo || !parentCamp);
    if (errOf(g)) return { ok: false, note: [...notes, 'ad group: ' + errOf(g)].join('; ') };
    parentAg = (vo || !parentCamp) ? null : g.results?.[0]?.resourceName;
    notes.push(parentAg ? 'ad group created' : 'ad group valid');
  }
  // Keywords + RSA (validate against the Houston ad group when the new one does not exist yet).
  const kwAg = parentAg || (await houAdGroup(db)).resourceName;
  const testOnly = vo || !parentAg;
  const exKw = parentAg ? await q(HA, db, `SELECT ad_group_criterion.resource_name, ad_group_criterion.ad_group, ad_group_criterion.status, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE ad_group_criterion.ad_group = '${parentAg}' AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`) : [];
  const { ops: kOps } = await ensureKeywords(db, vo, HA, kwAg, exKw, AST_KW);
  const kCreates = parentAg ? kOps : kOps.filter(o => o.create);
  if (kCreates.length) mark(await gadsMutate(db, HA, 'adGroupCriteria', kCreates, testOnly), 'keywords', kCreates.length + ' keyword(s)' + (testOnly ? ' valid' : ''));
  const exAds = parentAg ? await q(HA, db, `SELECT ad_group_ad.resource_name, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group_ad.ad_group = '${parentAg}' AND ad_group_ad.status != 'REMOVED'`) : [];
  if (!exAds.some(r => (r.adGroupAd.ad?.finalUrls || []).includes(AST_RSA.finalUrl))) {
    mark(await gadsMutate(db, HA, 'adGroupAds', [{ create: { adGroup: kwAg, status: 'ENABLED', ad: rsaBody(AST_RSA) } }], testOnly), 'RSA', 'RSA' + (testOnly ? ' valid' : ' created'));
  }
  return { ok: !bad && !!list, note: notes.join('; ') };
}

// --- Runner -------------------------------------------------------------------------
async function step(name, fn) {
  try { const r = await fn(); return { step: name, ok: !!r.ok, note: String(r.note || '').slice(0, 600) }; }
  catch (e) { return { step: name, ok: false, note: String(e.message || e).slice(0, 600) }; }
}

export async function gadsApply20261016(db, { validateOnly } = {}) {
  const vo = !!validateOnly;
  // Steps run side by side (one function call has 60s); each step is sequential inside.
  const goalStep = async () => {
    const [ha, doms, a1] = await Promise.all([
      step('Goals HA', async () => goals(db, vo, HA, ['Ihandyandy - Booking', 'DomsTVmounting - Booking'])),
      step("Goals Dom's", async () => goals(db, vo, DOMS, ['Online booking (domstvmounting.com/book)'])),
      step('Goals A1', async () => goals(db, vo, A1, ['Submit lead form'])),
    ]);
    // Custom goals need the action names, so look them up again (cheap).
    const byName = async (cid) => Object.fromEntries((await q(cid, db, "SELECT conversion_action.resource_name, conversion_action.name FROM conversion_action WHERE conversion_action.status = 'ENABLED'")).map(r => [r.conversionAction.name, r.conversionAction]));
    const [hg, dg] = await Promise.all([
      step('HA custom goal "iHandyAndy Conversions"', async () => customGoalSwap(db, vo, HA, 'iHandyAndy Conversions', 'Ihandyandy - Booking', await byName(HA))),
      step('Dom\'s custom goal "DomTVmounting" (OKC)', async () => customGoalSwap(db, vo, DOMS, 'DomTVmounting', 'Online booking (domstvmounting.com/book)', await byName(DOMS), DOMS_OKC)),
    ]);
    return [ha, doms, a1, hg, dg];
  };
  const houNegStep = () => step('Houston negatives', () => campaignNegatives(db, vo, HA, `customers/${HA}/campaigns/${HOUSTON_TV}`, HOUSTON_TV, HOU_NEG));
  const parts = await Promise.all([
    goalStep(),
    step('Austin TV budget $5', () => austinBudget(db, vo)),
    step('Houston ZIPs', () => houZips(db, vo)),
    houNegStep(),
    step('Houston keywords', () => houKeywords(db, vo)),
    step('Astraea campaign', () => astraea(db, vo)),
    // These three touch the same campaign; Google rejects concurrent edits, so one after another.
    (async () => [await step('Houston Manual CPC $5', () => houBidding(db, vo)), await step('Houston ads', () => houAds(db, vo)), await step('Houston sitelinks + callouts', () => houExtensions(db, vo))])(),
  ]);
  const steps = parts.flat();
  const out = { validateOnly: vo, at: new Date().toISOString(), steps };
  if (!vo) await db.from('integration_tokens').upsert({ provider: 'google_ads_fixes_20261016', value: JSON.stringify(out), updated_at: out.at }, { onConflict: 'provider' });
  return out;
}
