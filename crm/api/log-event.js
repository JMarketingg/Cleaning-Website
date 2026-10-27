import { serviceClient } from './_lib/supabase.js';
import { verifyToken } from './_lib/auth.js';
import { isBotUserAgent } from './_lib/bot-filter.js';

const ALLOWED_ORIGIN = /^https:\/\/((www\.)?tidyhausph\.com|tidyhaus[a-z0-9-]*\.vercel\.app)$/;
const EVENTS = new Set(['page_view', 'page_exit', 'click', 'quote_step', 'quote_send', 'area_pick']);
const s = (v, n = 300) => (v == null || v === '' ? null : String(v).slice(0, n));

function device(ua) {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}
function browser(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook app';
  if (/Instagram/.test(ua)) return 'Instagram app';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  return 'Other';
}
function source(ref, utm) {
  if (utm) return utm.toLowerCase();
  if (!ref) return 'direct';
  let h = '';
  try { h = new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'other'; }
  if (/tidyhausph\.com$/.test(h)) return 'internal';
  if (/google\./.test(h)) return 'google';
  if (/facebook\.com|fb\.com|m\.facebook/.test(h)) return 'facebook';
  if (/instagram\.com/.test(h)) return 'instagram';
  if (/bing\.com/.test(h)) return 'bing';
  return h || 'other';
}

async function collect(req, res) {
  const ua = String(req.headers['user-agent'] || '');
  if (isBotUserAgent(ua)) return res.status(204).end();
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const list = Array.isArray(b?.events) ? b.events.slice(0, 50) : [];
  const rows = list.filter((e) => EVENTS.has(e?.event) && e.sid).map((e) => ({
    session_id: s(e.sid, 64), visitor_id: s(b.vid, 64), event: e.event,
    path: s(e.path, 300), title: s(e.title, 200), label: s(e.label, 200),
    referrer: s(b.ref, 500), source: source(b.ref, s(b.utm_source, 60)),
    utm_source: s(b.utm_source, 100), utm_medium: s(b.utm_medium, 100), utm_campaign: s(b.utm_campaign, 100),
    device: device(ua), browser: browser(ua),
    country: s(req.headers['x-vercel-ip-country'], 4),
    city: s(decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')), 80),
    timezone: s(b.tz, 60), screen: s(b.screen, 20),
    duration_ms: Number.isFinite(+e.ms) ? Math.min(Math.round(+e.ms), 3600000) : null,
    scroll_pct: Number.isFinite(+e.scroll) ? Math.max(0, Math.min(100, Math.round(+e.scroll))) : null,
  }));
  if (rows.length) {
    const { error } = await serviceClient().from('site_events').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
  }
  return res.status(204).end();
}

function inc(m, k, by = 1) { k = k || '(none)'; m[k] = (m[k] || 0) + by; }
const top = (m, n = 15) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, n: v }));

async function stats(req, res) {
  const auth = verifyToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!auth || !['owner', 'secretary'].includes(auth.role)) return res.status(401).json({ error: 'Log in to the CRM first.' });
  const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const db = serviceClient();
  const rows = [];
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await db.from('site_events')
      .select('created_at, session_id, visitor_id, event, path, label, source, device, browser, city, duration_ms, scroll_pct')
      .gte('created_at', since).order('created_at').range(from, from + 999);
    if (error) return res.status(500).json({ error: error.message });
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
  const sessions = new Map(), visitors = new Set();
  const daily = {}, pages = {}, sources = {}, devices = {}, browsers = {}, cities = {}, clicks = {}, steps = {}, entries = {};
  const pageTime = {}, pageTimeN = {};
  let views = 0, quotes = 0;
  for (const r of rows) {
    const day = fmt.format(new Date(r.created_at));
    if (r.visitor_id) visitors.add(r.visitor_id);
    let ss = sessions.get(r.session_id);
    if (!ss) {
      ss = { pages: 0, quote: false };
      sessions.set(r.session_id, ss);
      daily[day] = daily[day] || { day, visitors: new Set(), sessions: 0, views: 0, quotes: 0 };
      daily[day].sessions++;
      inc(sources, r.source); inc(devices, r.device); inc(browsers, r.browser); inc(cities, r.city);
      inc(entries, r.path);
    }
    const d = (daily[day] = daily[day] || { day, visitors: new Set(), sessions: 0, views: 0, quotes: 0 });
    if (r.visitor_id) d.visitors.add(r.visitor_id);
    if (r.event === 'page_view') { views++; d.views++; ss.pages++; inc(pages, r.path); }
    else if (r.event === 'page_exit' && r.duration_ms) { pageTime[r.path] = (pageTime[r.path] || 0) + r.duration_ms; pageTimeN[r.path] = (pageTimeN[r.path] || 0) + 1; }
    else if (r.event === 'click') inc(clicks, r.label);
    else if (r.event === 'quote_step') inc(steps, r.label);
    else if (r.event === 'area_pick') inc(clicks, 'Area picker: ' + (r.label || ''));
    else if (r.event === 'quote_send') { quotes++; d.quotes++; ss.quote = true; inc(clicks, 'Quote sent: ' + (r.label || '')); }
  }
  const bounced = [...sessions.values()].filter((x) => x.pages <= 1 && !x.quote).length;
  return res.status(200).json({
    days,
    totals: {
      visitors: visitors.size, sessions: sessions.size, page_views: views, quotes_sent: quotes,
      bounce_pct: sessions.size ? Math.round((bounced / sessions.size) * 100) : 0,
      quote_rate_pct: sessions.size ? Math.round((quotes / sessions.size) * 1000) / 10 : 0,
    },
    daily: Object.values(daily).sort((a, b) => a.day.localeCompare(b.day)).map((d) => ({ ...d, visitors: d.visitors.size })),
    pages: top(pages, 30).map((p) => ({ ...p, avg_sec: pageTimeN[p.key] ? Math.round(pageTime[p.key] / pageTimeN[p.key] / 1000) : null })),
    entries: top(entries), sources: top(sources), devices: top(devices), browsers: top(browsers),
    cities: top(cities), clicks: top(clicks, 30), quote_steps: top(steps, 20),
  });
}

export default async function handler(req, res) {
  const origin = String(req.headers.origin || '');
  if (ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'POST') return await collect(req, res);
    if (req.method === 'GET') return await stats(req, res);
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
