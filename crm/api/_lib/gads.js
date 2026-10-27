import crypto from 'crypto';

const SCOPE = 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/datamanager openid email';
export const GADS_REDIRECT = 'https://tidyhaus-crm.vercel.app/api/admin?action=gads_oauth_callback';
const ver = () => process.env.GOOGLE_ADS_API_VERSION || 'v26';
const clean = (x) => String(x || '').replace(/\D/g, '');

export function gadsConfigured() { return !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET); }

export async function gadsAuthUrl(db) {
  const state = crypto.randomBytes(16).toString('hex');
  const { error } = await db.from('integration_tokens').upsert({ provider: 'google_ads_state', value: state, updated_at: new Date().toISOString() }, { onConflict: 'provider' });
  if (error) throw new Error('Could not save login state: ' + error.message);
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_ADS_CLIENT_ID, redirect_uri: GADS_REDIRECT, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent select_account', state });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}

export async function gadsHandleCallback(db, code, state) {
  const { data: st } = await db.from('integration_tokens').select('value').eq('provider', 'google_ads_state').maybeSingle();
  if (!st || !state || st.value !== state) throw new Error('Bad state');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_ADS_CLIENT_ID, client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET, redirect_uri: GADS_REDIRECT, grant_type: 'authorization_code' }) });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) throw new Error('Token exchange failed: ' + (j.error_description || j.error || r.status));
  let email = 'unknown';
  try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email || 'unknown'; } catch (_) {}
  const { error: se } = await db.from('integration_tokens').upsert({ provider: 'google_ads:' + email, value: j.refresh_token, updated_at: new Date().toISOString() }, { onConflict: 'provider' });
  if (se) throw new Error('Could not save Google Ads login: ' + se.message);
  await db.from('integration_tokens').delete().eq('provider', 'google_ads_state');
  return email;
}

async function logins(db) {
  const { data } = await db.from('integration_tokens').select('provider, value').like('provider', 'google_ads%');
  return (data || []).filter(r => r.provider === 'google_ads' || r.provider.startsWith('google_ads:')).map(r => ({ email: r.provider.split(':')[1] || 'manager', refresh: r.value }));
}

const tokCache = new Map();
async function accessFor(refresh) {
  const c = tokCache.get(refresh);
  if (c && c.exp > Date.now()) return c.tok;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refresh, client_id: process.env.GOOGLE_ADS_CLIENT_ID, client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Refresh failed: ' + (j.error_description || j.error));
  tokCache.set(refresh, { tok: j.access_token, exp: Date.now() + 50 * 60000 });
  return j.access_token;
}

function headers(tok, loginCid) {
  const h = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (clean(loginCid)) h['login-customer-id'] = clean(loginCid);
  return h;
}

async function search(tok, cid, query, loginCid) {
  const r = await fetch(`https://googleads.googleapis.com/${ver()}/customers/${clean(cid)}/googleAds:searchStream`, { method: 'POST', headers: headers(tok, loginCid), body: JSON.stringify({ query }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((Array.isArray(j) ? j[0]?.error?.message : j.error?.message) || ('Google Ads ' + r.status));
  return (Array.isArray(j) ? j : [j]).flatMap(b => b.results || []);
}

let reachMemo = null;
async function reachable(db, fresh) {
  if (!fresh && reachMemo && Date.now() - reachMemo.at < 30 * 60e3) return withTokens(db, reachMemo.map);
  const { data: saved } = await db.from('integration_tokens').select('value, updated_at').eq('provider', 'google_ads_reach').maybeSingle();
  if (!fresh && saved && Date.now() - new Date(saved.updated_at).getTime() < 6 * 3600e3) { reachMemo = { at: Date.now(), map: JSON.parse(saved.value) }; return withTokens(db, reachMemo.map); }
  const live = await reachableLive(db);
  if (!live.list.length && saved) return withTokens(db, JSON.parse(saved.value));
  const old = saved ? JSON.parse(saved.value) : [];
  const map = [...live.list.map(a => ({ id: a.id, via: a.via })), ...old.filter(o => !live.list.some(a => a.id === o.id))];
  if (old.some(o => !live.list.some(a => a.id === o.id))) { reachMemo = { at: Date.now(), map }; await db.from('integration_tokens').upsert({ provider: 'google_ads_reach', value: JSON.stringify(map), updated_at: new Date().toISOString() }, { onConflict: 'provider' }); return withTokens(db, map); }
  if (map.length) { reachMemo = { at: Date.now(), map }; await db.from('integration_tokens').upsert({ provider: 'google_ads_reach', value: JSON.stringify(map), updated_at: new Date().toISOString() }, { onConflict: 'provider' }); }
  return live;
}
async function withTokens(db, map) {
  const byEmail = Object.fromEntries((await logins(db)).map(l => [l.email, l]));
  const list = [], errors = [];
  for (const m of map) {
    const l = byEmail[m.via]; if (!l) continue;
    try { list.push({ id: m.id, via: m.via, tok: await accessFor(l.refresh) }); } catch (e) { errors.push(m.via + ': ' + e.message); }
  }
  return { list, errors };
}
async function reachableLive(db) {
  const out = new Map(), errors = [];
  for (const l of await logins(db)) {
    let tok; try { tok = await accessFor(l.refresh); } catch (e) { errors.push(l.email + ': ' + e.message); continue; }
    const r = await fetch(`https://googleads.googleapis.com/${ver()}/customers:listAccessibleCustomers`, { headers: headers(tok, null) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) errors.push(l.email + ': ' + ((j.error && j.error.message) || r.status));
    for (const rn of (j.resourceNames || [])) { const id = rn.split('/')[1]; if (!out.has(id)) out.set(id, { id, tok, via: l.email }); }
  }
  return { list: [...out.values()], errors };
}

export async function gadsStatus(db) {
  if (!gadsConfigured()) return { connected: false, reason: 'OAuth client not set' };
  const ls = await logins(db);
  if (!ls.length) return { connected: false };
  const { list, errors } = await reachable(db);
  const accts = [];
  for (const a of list) {
    try { const c = (await search(a.tok, a.id, 'SELECT customer.descriptive_name, customer.manager, customer.currency_code, customer.status FROM customer LIMIT 1', a.id))[0]?.customer || {};
      accts.push({ id: a.id, via: a.via, name: c.descriptiveName || null, manager: !!c.manager, currency: c.currencyCode || null, status: c.status || null }); }
    catch (e) { accts.push({ id: a.id, via: a.via, error: e.message }); }
  }
  const out = { connected: true, logins: ls.map(l => l.email), accounts: accts, errors, at: new Date().toISOString() };
  if (accts.some(a => !a.error)) await db.from('integration_tokens').upsert({ provider: 'google_ads_status', value: JSON.stringify(out), updated_at: out.at }, { onConflict: 'provider' });
  return out;
}

export async function gadsReport(db) {
  const rows = [];
  const { list, errors } = await reachable(db);
  for (const a of list) {
    let info; try { info = (await search(a.tok, a.id, 'SELECT customer.descriptive_name, customer.manager, customer.currency_code, customer.status, customer.time_zone FROM customer LIMIT 1', a.id))[0]?.customer || {}; } catch (e) { errors.push(a.id + ': ' + e.message); continue; }
    if (info.manager || info.status === 'CANCELED' || info.status === 'CLOSED') continue;
    const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    for (const [span, during] of [['d3', `BETWEEN '${day(2)}' AND '${day(0)}'`], ['p3', `BETWEEN '${day(5)}' AND '${day(3)}'`], ['d7', 'DURING LAST_7_DAYS'], ['d30', 'DURING LAST_30_DAYS'], ['p7', `BETWEEN '${day(14)}' AND '${day(8)}'`], ['p30', `BETWEEN '${day(60)}' AND '${day(31)}'`]]) {
      let rs; try { rs = await search(a.tok, a.id, `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions, metrics.phone_calls FROM campaign WHERE segments.date ${during} AND campaign.status != 'REMOVED'`, a.id); }
      catch (e) { errors.push((info.descriptiveName || a.id) + ': ' + e.message); continue; }
      for (const r of rs) {
        const key = a.id + ':' + r.campaign.id;
        let row = rows.find(x => x.key === key);
        if (!row) rows.push(row = { key, account: a.id, account_name: info.descriptiveName, currency: info.currencyCode, campaign: r.campaign.name, status: r.campaign.status });
        row[span] = { cost: Math.round(Number(r.metrics.costMicros || 0) / 1e4) / 100, conv: Math.round(Number(r.metrics.conversions || 0) * 10) / 10, clicks: Number(r.metrics.clicks || 0), impr: Number(r.metrics.impressions || 0), calls: Number(r.metrics.phoneCalls || 0) };
      }
    }
    try {
      const tz = info.timeZone || 'Asia/Manila';
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
      const hIdx = (d, h) => Math.round(Date.parse(d + 'T00:00:00Z') / 36e5) + Number(h || 0);
      const now = hIdx(`${parts.year}-${parts.month}-${parts.day}`, parts.hour);
      const rs = await search(a.tok, a.id, `SELECT campaign.id, campaign.name, campaign.status, segments.date, segments.hour, metrics.cost_micros, metrics.conversions, metrics.clicks, metrics.impressions, metrics.phone_calls FROM campaign WHERE segments.date BETWEEN '${day(3)}' AND '${day(-1)}' AND campaign.status != 'REMOVED'`, a.id);
      for (const r of rs) {
        const age = now - hIdx(r.segments.date, r.segments.hour);
        const span = age >= 0 && age < 24 ? 'd1' : age >= 24 && age < 48 ? 'p1' : null;
        if (!span) continue;
        const key = a.id + ':' + r.campaign.id;
        let row = rows.find(x => x.key === key);
        if (!row) rows.push(row = { key, account: a.id, account_name: info.descriptiveName, currency: info.currencyCode, campaign: r.campaign.name, status: r.campaign.status });
        const o = row[span] || (row[span] = { cost: 0, conv: 0, clicks: 0, impr: 0, calls: 0 });
        o.cost = Math.round((o.cost + Number(r.metrics.costMicros || 0) / 1e6) * 100) / 100;
        o.conv = Math.round((o.conv + Number(r.metrics.conversions || 0)) * 10) / 10;
        o.clicks += Number(r.metrics.clicks || 0); o.impr += Number(r.metrics.impressions || 0); o.calls += Number(r.metrics.phoneCalls || 0);
      }
      for (const row of rows) if (row.account === a.id) row.tz = tz;
    } catch (e) { errors.push((info.descriptiveName || a.id) + ' 24h: ' + e.message); }
  }
  const out = { rows, errors, at: new Date().toISOString(), v: 3 };
  if (rows.length) await db.from('integration_tokens').upsert({ provider: 'google_ads_report', value: JSON.stringify(out), updated_at: out.at }, { onConflict: 'provider' });
  return out;
}

export async function gadsAudit(db) {
  const out = { accounts: [], at: new Date().toISOString() };
  const { list } = await reachable(db);
  for (const a of list) {
    const q = (s) => search(a.tok, a.id, s, a.id);
    let info; try { info = (await q('SELECT customer.descriptive_name, customer.manager, customer.status FROM customer LIMIT 1'))[0]?.customer || {}; } catch (e) { continue; }
    if (info.manager || info.status !== 'ENABLED') continue;
    const acct = { id: a.id, name: info.descriptiveName, campaigns: [], conversions: [] };
    try {
      const cs = await q("SELECT campaign.id, campaign.name, campaign.start_date, campaign.bidding_strategy_type, campaign.maximize_conversions.target_cpa_micros, campaign.target_cpa.target_cpa_micros, campaign.target_spend.cpc_bid_ceiling_micros, campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'");
      const neg = await q("SELECT campaign.id, campaign_criterion.keyword.text FROM campaign_criterion WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD' AND campaign.status = 'ENABLED'").catch(() => []);
      const shared = await q("SELECT campaign.id, shared_set.name, shared_set.member_count FROM campaign_shared_set WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign.status = 'ENABLED' AND campaign_shared_set.status = 'ENABLED'").catch(() => []);
      for (const r of cs) {
        const id = r.campaign.id;
        const sh = shared.filter(x => x.campaign.id === id);
        acct.campaigns.push({ id, name: r.campaign.name, start: r.campaign.startDate, bidding: r.campaign.biddingStrategyType,
          tcpa: Number(r.campaign.maximizeConversions?.targetCpaMicros || r.campaign.targetCpa?.targetCpaMicros || 0) / 1e6 || null,
          cpc_cap: Number(r.campaign.targetSpend?.cpcBidCeilingMicros || 0) / 1e6 || null,
          budget: Number(r.campaignBudget?.amountMicros || 0) / 1e6,
          negatives: neg.filter(x => x.campaign.id === id).length,
          shared_lists: sh.map(x => `${x.sharedSet.name} (${x.sharedSet.memberCount})`) });
      }
    } catch (e) { acct.error = e.message; }
    try {
      const cv = await q("SELECT conversion_action.name, conversion_action.status, conversion_action.category, conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric, conversion_action.type FROM conversion_action WHERE conversion_action.status = 'ENABLED'");
      acct.conversions = cv.map(r => ({ name: r.conversionAction.name, category: r.conversionAction.category, primary: !!r.conversionAction.primaryForGoal, counts: !!r.conversionAction.includeInConversionsMetric, type: r.conversionAction.type }));
    } catch (e) { acct.conv_error = e.message; }
    out.accounts.push(acct);
  }
  await db.from('integration_tokens').upsert({ provider: 'google_ads_audit', value: JSON.stringify(out), updated_at: out.at }, { onConflict: 'provider' });
  return out;
}

export async function gadsQuery(db, cid, query) {
  const { list } = await reachable(db);
  const a = list.find(x => x.id === clean(cid));
  if (!a) throw new Error('Account not reachable');
  const r = await fetch(`https://googleads.googleapis.com/${ver()}/customers/${a.id}/googleAds:searchStream`, { method: 'POST', headers: headers(a.tok, a.id), body: JSON.stringify({ query }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: JSON.stringify(Array.isArray(j) ? j[0]?.error : j.error).slice(0, 1500) };
  return { rows: (Array.isArray(j) ? j : [j]).flatMap(b => b.results || []) };
}

export async function gadsMutate(db, cid, resource, operations, validateOnly, opts = {}) {
  if (!/^[a-zA-Z]+$/.test(resource || '')) throw new Error('Bad resource');
  const { list } = await reachable(db);
  const a = list.find(x => x.id === clean(cid));
  if (!a) throw new Error('Account not reachable');
  const r = await fetch(`https://googleads.googleapis.com/${ver()}/customers/${a.id}/${resource}:mutate`, { method: 'POST', headers: headers(a.tok, a.id), body: JSON.stringify({ operations, ...(opts.noPartial ? {} : { partialFailure: true }), validateOnly: !!validateOnly }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: JSON.stringify(j.error || j).slice(0, 2000) };
  return j;
}

const GADS_ACCOUNT_CURRENCY = { '0000000000': 'USD', '0000000000': 'PHP', '0000000000': 'THB' };
export async function gadsUploadBookings(db) {
  const { data: cfgRow } = await db.from('integration_tokens').select('value').eq('provider', 'google_ads_upload_actions').maybeSingle();
  const cfg = cfgRow ? JSON.parse(cfgRow.value || '{}') : {};
  if (!Object.keys(cfg).length) return { skipped: 'no actions' };
  const since = new Date(Date.now() - 85 * 864e5).toISOString();
  const { data, error } = await db.from('bookings')
    .select('id, created_at, price, metadata, business:businesses ( slug )')
    .gte('created_at', since).not('metadata->ad_click', 'is', null).is('metadata->gads_upload', null).limit(50);
  if (error) throw error;
  const { list } = await reachable(db);
  const out = { sent: 0, failed: 0, found: (data || []).length };
  for (const b of data || []) {
    const c = cfg[b.business?.slug]; const ac = b.metadata?.ad_click || {};
    const id = ac.gclid ? { gclid: ac.gclid } : ac.gbraid ? { gbraid: ac.gbraid } : ac.wbraid ? { wbraid: ac.wbraid } : null;
    if (!c || !id) { (out.skipped = out.skipped || []).push(b.id + ': ' + (!c ? 'no action for ' + b.business?.slug : 'no click id')); continue; }
    const a = list.find(x => x.id === clean(c.customer));
    if (!a) { (out.skipped = out.skipped || []).push(b.id + ': account not reachable'); continue; }
    const ev = { adIdentifiers: id, eventTimestamp: new Date(b.created_at).toISOString(), transactionId: String(b.id), eventSource: 'WEB' };
    if (Number(b.price) > 0 && GADS_ACCOUNT_CURRENCY[a.id] === 'USD') { ev.conversionValue = Number(b.price); ev.currency = 'USD'; }
    const dest = { operatingAccount: { accountType: 'GOOGLE_ADS', accountId: a.id }, productDestinationId: String(c.action).split('/').pop() };
    const r = await fetch('https://datamanager.googleapis.com/v1/events:ingest', { method: 'POST', headers: { Authorization: 'Bearer ' + a.tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ destinations: [dest], events: [ev] }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) { out.blocked = (j.error && j.error.message || String(r.status)).slice(0, 300); break; }
    const err = !r.ok ? (j.error?.message || String(r.status)) : null;
    const mark = { at: new Date().toISOString(), ok: !err, ...(j.requestId ? { request: j.requestId } : {}), ...(err ? { error: String(err).slice(0, 300) } : {}) };
    await db.from('bookings').update({ metadata: { ...b.metadata, gads_upload: mark } }).eq('id', b.id);
    err ? out.failed++ : out.sent++;
  }
  return out;
}

export async function gadsDump(db, name, queries) {
  const out = { at: new Date().toISOString(), results: {} };
  await Promise.all(Object.entries(queries || {}).map(async ([k, q]) => {
    try { out.results[k] = await gadsQuery(db, q.customer, q.query); } catch (e) { out.results[k] = { error: e.message }; }
  }));
  await db.from('integration_tokens').upsert({ provider: 'gads_dump:' + String(name).slice(0, 60), value: JSON.stringify(out), updated_at: out.at }, { onConflict: 'provider' });
  return { saved: Object.keys(out.results).length, errors: Object.entries(out.results).filter(([, v]) => v.error).map(([k, v]) => k + ': ' + String(v.error).slice(0, 300)), rows: Object.fromEntries(Object.entries(out.results).map(([k, v]) => [k, (v.rows || []).length])) };
}
