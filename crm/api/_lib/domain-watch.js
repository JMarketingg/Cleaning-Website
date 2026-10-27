import { sendSMS } from './sms.js';
import { sendEmail } from './email.js';

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const FETCH_TIMEOUT_MS = 9000;
const CONCURRENCY = 8;

export const ALERT_STATUSES = new Set(['available', 'pending_delete', 'likely_available']);

export function cleanDomain(raw) {
  let d = String(raw || '').trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '').replace(/[.,;]+$/, '');
  if (d.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
  return d;
}

export function parseDomainList(text) {
  const seen = new Set(); const good = []; const bad = [];
  for (const tok of String(text || '').split(/[\s,;]+/)) {
    if (!tok.trim()) continue;
    const d = cleanDomain(tok);
    if (!d) { bad.push(tok.trim()); continue; }
    if (!seen.has(d)) { seen.add(d); good.push(d); }
  }
  return { good, bad };
}

let _bootstrap = null;
async function rdapBaseFor(tld) {
  if (!_bootstrap) {
    const r = await fetchTimeout(BOOTSTRAP_URL);
    if (!r.ok) throw new Error('Could not load the registry directory (IANA)');
    const j = await r.json();
    const map = new Map();
    for (const [tlds, urls] of (j.services || [])) for (const t of tlds) map.set(String(t).toLowerCase(), urls[0]);
    _bootstrap = map;
  }
  const base = _bootstrap.get(tld);
  return base ? base.replace(/\/?$/, '/') : null;
}

async function fetchTimeout(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ctl.signal, headers: { accept: 'application/rdap+json, application/json', ...(opts.headers || {}) } }); }
  finally { clearTimeout(t); }
}

async function dnsSaysUnregistered(domain) {
  const r = await fetchTimeout(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, { headers: { accept: 'application/dns-json' } });
  if (!r.ok) throw new Error(`DNS lookup failed (${r.status})`);
  const j = await r.json();
  return j.Status === 3;
}

export async function checkDomain(domain) {
  const tld = domain.split('.').pop();
  try {
    const base = await rdapBaseFor(tld);
    if (!base) {
      const gone = await dnsSaysUnregistered(domain);
      return { status: gone ? 'likely_available' : 'unsupported', error: gone ? null : `.${tld} has no public lookup; DNS shows it in use` };
    }
    const r = await fetchTimeout(`${base}domain/${encodeURIComponent(domain)}`);
    if (r.status === 404) return { status: 'available' };
    if (r.status === 429) return { status: 'error', error: 'The registry asked us to slow down (rate limited). Will retry tomorrow.' };
    if (!r.ok) return { status: 'error', error: `Registry answered ${r.status}` };
    const j = await r.json();
    const flags = (j.status || []).map(s => String(s).toLowerCase());
    const exp = (j.events || []).find(e => /expiration/i.test(e.eventAction || ''));
    const registrar = ((j.entities || []).find(e => (e.roles || []).includes('registrar')) || {}).vcardArray;
    const regName = registrar && Array.isArray(registrar[1]) ? ((registrar[1].find(x => x[0] === 'fn') || [])[3] || null) : null;
    let status = 'taken';
    if (flags.some(f => f.includes('pending delete'))) status = 'pending_delete';
    else if (flags.some(f => f.includes('redemption'))) status = 'redemption';
    return { status, expires_at: exp ? new Date(exp.eventDate).toISOString() : null, registrar: regName };
  } catch (e) {
    return { status: 'error', error: String((e && e.name === 'AbortError') ? 'Timed out' : (e && e.message) || e).slice(0, 200) };
  }
}

function alertSubject(status) {
  return status === 'available' ? 'Domain available' : status === 'pending_delete' ? 'Domain dropping soon' : 'Domain likely available';
}

function alertText(row, res) {
  const d = row.domain;
  if (res.status === 'available') return `DOMAIN AVAILABLE: ${d} is registrable right now. Buy it before someone else does.`;
  if (res.status === 'likely_available') return `DOMAIN LIKELY AVAILABLE: ${d} has no DNS and no public registry record. Check it and buy it if it is free.`;
  if (res.status === 'pending_delete') return `DOMAIN DROPPING SOON: ${d} is in pending delete. It should be released within about 5 days. Get ready to grab it.`;
  return null;
}

export async function runDomainWatch(db, { onlyIds = null, sendAlerts = true, digest = false, quiet = false } = {}) {
  let q = db.from('domain_watch').select('*').order('created_at');
  if (onlyIds) q = q.in('id', onlyIds);
  const { data: rows, error } = await q;
  if (error) throw error;
  const list = rows || [];
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    while (next < list.length) { const i = next++; results[i] = await checkDomain(list[i].domain); }
  }));

  const alerts = []; const nowISO = new Date().toISOString();
  for (let i = 0; i < list.length; i++) {
    const row = list[i], res = results[i];
    const changed = res.status !== row.status;
    const patch = {
      status: res.status, last_checked_at: nowISO, last_error: res.error || null,
      expires_at: res.expires_at !== undefined ? res.expires_at : row.expires_at,
      registrar: res.registrar !== undefined ? res.registrar : row.registrar,
    };
    if (changed && res.status !== 'error') { patch.status_since = nowISO; patch.alert_dismissed_status = null; }
    if (res.status === 'error') { patch.status = row.status === 'unchecked' ? 'error' : row.status; delete patch.status_since; }
    const eff = patch.status;
    if (ALERT_STATUSES.has(eff) && row.notified_status !== eff) {
      const msg = alertText(row, { status: eff });
      if (msg) alerts.push({ id: row.id, domain: row.domain, status: eff, msg, subject: alertSubject(eff) });
    }
    if (!ALERT_STATUSES.has(eff) && row.notified_status && res.status !== 'error') { patch.notified_status = null; }
    const { error: uErr } = await db.from('domain_watch').update(patch).eq('id', row.id);
    if (uErr) console.warn('[domain_watch] save failed for', row.domain, uErr.message);
  }

  let texted = 0, emailed = 0;
  const phone = process.env.OWNER_PHONE_NUMBER;
  const ownerEmail = process.env.OWNER_EMAIL || 'owner@example.invalid';
  const markDone = (a) => db.from('domain_watch').update({ notified_status: a.status, notified_at: new Date().toISOString() }).eq('id', a.id);
  const emailWrap = (title, inner) => `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5"><h2 style="margin:0 0 8px">${title}</h2>${inner}<p style="color:#666;font-size:13px">From your Domain watch list in the CRM (Other &gt; Domain watch).</p></div>`;

  if (sendAlerts && alerts.length && quiet) {
    for (const a of alerts) await markDone(a);
  } else if (sendAlerts && alerts.length && (digest || alerts.length > 1)) {
    const groups = [
      ['available', 'Available now'], ['likely_available', 'Likely available'], ['pending_delete', 'Dropping soon (about 5 days)'],
    ].map(([st, label]) => ({ label, items: alerts.filter(a => a.status === st).map(a => a.domain) })).filter(g => g.items.length);
    const smsList = groups.map(g => `${g.label} (${g.items.length}): ${g.items.slice(0, 6).join(', ')}${g.items.length > 6 ? ` +${g.items.length - 6} more` : ''}`).join('. ');
    const smsMsg = `DOMAIN WATCH: ${alerts.length} domains need attention. ${smsList}. Full list in the CRM under Other > Domain watch.`;
    let ok = false;
    if (phone) {
      try { await sendSMS(phone, smsMsg); texted++; ok = true; }
      catch (e) { console.warn('[domain_watch] digest text failed:', e.message); }
    }
    try {
      const inner = groups.map(g => `<h3 style="margin:14px 0 4px">${g.label} (${g.items.length})</h3><ul style="margin:0;padding-left:20px">${g.items.map(d => `<li>${d}</li>`).join('')}</ul>`).join('');
      const r = await sendEmail({ slug: 'tidyhaus', to: ownerEmail, subject: `Domain watch: ${alerts.length} domains need attention`, html: emailWrap(`${alerts.length} domains need attention`, inner) });
      if (r && r.sent) { emailed++; ok = true; }
    } catch (e) { console.warn('[domain_watch] digest email failed:', e.message); }
    if (ok) for (const a of alerts) await markDone(a);
  } else if (sendAlerts) {
    for (const a of alerts) {
      let ok = false;
      if (phone) {
        try { await sendSMS(phone, a.msg); texted++; ok = true; }
        catch (e) { console.warn('[domain_watch] alert text failed for', a.domain, e.message); }
      }
      try {
        const r = await sendEmail({ slug: 'tidyhaus', to: ownerEmail, subject: `${a.subject}: ${a.domain}`, html: emailWrap(`${a.subject}: ${a.domain}`, `<p>${a.msg}</p>`) });
        if (r && r.sent) { emailed++; ok = true; }
      } catch (e) { console.warn('[domain_watch] alert email failed for', a.domain, e.message); }
      if (ok) await markDone(a);
    }
  }
  const tally = {}; for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
  return { checked: list.length, tally, alerts: alerts.map(a => ({ domain: a.domain, status: a.status })), texted, emailed, owner_phone_set: !!phone };
}
