// ============================================================================
// Which businesses each secretary can act on, beyond their own — the single
// source of truth for three previously-separate things that used to drift out
// of sync with each other every time the assignment changed:
//   1. Dashboard access (api/admin.js: login, session_status, View As,
//      bad-review alerts, resolveBusiness's business-scoped action gate)
//   2. The "which line rang" picker on the Take a Call greet card, and the
//      whole call list/history/business-name filter (api/admin.js: calls())
//   3. Who a voicemail alert or a late-job escalation text goes to
//      (api/admin.js: secretaryPhoneFor; api/_lib/tech-late.js)
//
// A secretary's token still carries ONE primary `scope` (their own company —
// every company-specific tool keys off it: Review Calls, Call Performance, My
// Availability, payroll, the greeting name). This map is the SECOND, wider
// list layered on top: other brands the same person also answers the phone
// for. Edit this map to change anyone's access — nothing else needs touching.
//
// Owner assignment, 2026-08-26 (replaces the earlier Joey-gets-all-eight
// split from the day before): Heather and Joey split the twelve non-Handy-
// Andy tracking numbers six and six. TidyHaus itself (incl. its LA tracking
// number) stays Heather's home business, implicit in her `scope` already.
export const SECRETARY_EXTRA_BUSINESSES = {
  doms: [
    'atxmountpros', 'austinmountingpros', 'houstontvinstallation', 'tvhanginghouston',
    'precision', 'tvmountingdenver', 'mile-high',
  ],
  'handy-andy': [
    'atxtvmount', 'austintvinstall', 'houstonmounting', 'htvmounting',
    'austin', 'houstontvmountingpros', 'houstonperfectviewtvmounting', 'millertime', 'a1tvmounting',
  ],
};

// Dashboard ACCESS only -- deliberately a separate map. Brands listed here can
// be opened, searched and called from, but they do NOT change who gets that
// brand's voicemail/late-tech texts or which pipeline family it belongs to
// (those read SECRETARY_EXTRA_BUSINESSES only). Owner, 2026-09-29: Joey (doms)
// can work TidyHaus jobs, e.g. call a TidyHaus customer to reschedule,
// while TidyHaus's alerts keep going to Heather.
export const SECRETARY_ACCESS_ONLY = {
  doms: ['handy-andy'],
  // Heather can open Home Cleaning Denver jobs (owner 2026-10-22: HA techs like Steve work them); alerts stay with Dom's team.
  'handy-andy': ['tvmountingdenver'],
};

// ---------------------------------------------------------------------------
// Per-secretary coverage overrides (owner 2026-10-08, migration 0189):
// staff_users.covered_businesses. NULL = use the map above (the seed), so
// nothing changes until the owner edits someone on Other -> Secretaries.
// The home business (scope) is ALWAYS kept -- every company-specific tool keys
// off it. Joey is never overridden (he covers everything).
// Cached per warm instance for 60s; loadCoverageOverrides() is called at the
// top of every admin request and by leadAlertRecipients().
// ---------------------------------------------------------------------------
let OVERRIDES = new Map();   // lowercased name -> [slug]
let WEEKLY = new Map();      // lowercased name -> Map(dow -> group slug)  (staff_schedules)
let EXC = new Map();         // lowercased name -> Map(dateStr -> slug|null)  (staff_schedule_exceptions)
let overridesAt = 0;
export const ALL_BUSINESSES = 'all';
export function isAllCoverage(name) { return String(name || '') === 'Joey'; }
export function setCoverageOverrides(rows) {
  const m = new Map();
  for (const r of rows || []) {
    if (r && r.name && Array.isArray(r.covered_businesses) && !isAllCoverage(r.name)) m.set(String(r.name).toLowerCase(), r.covered_businesses.map(String));
  }
  OVERRIDES = m; overridesAt = Date.now();
}
// Weekly per-day schedule (owner 2026-10-08): staff_schedules rows ARE the
// schedule -- a row = working that Mountain-time weekday on business_slug's
// group; no row = off. Only people WITH rows are day-gated (Alex, Joe).
// Heather/Joey have none, so they keep the always-on behavior. Joey never gated.
export function setWeeklySchedules(rows) {
  const m = new Map();
  for (const r of rows || []) {
    if (!r || !r.name || isAllCoverage(r.name) || !r.business_slug) continue;
    const k = String(r.name).toLowerCase();
    if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(Number(r.day_of_week), String(r.business_slug));
  }
  WEEKLY = m;
}
import { dateIn } from './schedule-exceptions.js';
export async function loadCoverageOverrides(db, force) {
  if (!force && Date.now() - overridesAt < 60000) return;
  try {
    const [{ data, error }, { data: sched, error: sErr }] = await Promise.all([
      db.from('staff_users').select('name, covered_businesses').eq('role', 'secretary').eq('active', true),
      db.from('staff_schedules').select('name, day_of_week, business_slug'),
    ]);
    if (error) throw error;
    if (sErr) throw sErr;
    setCoverageOverrides(data);
    setWeeklySchedules(sched);
    try {
      const { data: ex, error: xErr } = await db.from('staff_schedule_exceptions').select('name, on_date, business_slug').gte('on_date', dateIn('Asia/Manila', new Date(Date.now() - 864e5)));
      if (xErr) throw xErr;
      const m = new Map();
      for (const r of ex || []) { const k = String(r.name).toLowerCase(); if (!m.has(k)) m.set(k, new Map()); m.get(k).set(String(r.on_date).slice(0, 10), r.business_slug || null); }
      EXC = m;
    } catch (e) { console.warn('[staff-access] exceptions load failed:', e.message); }
  } catch (e) { console.error('[staff-access] coverage overrides load failed, keeping last:', e.message); overridesAt = Date.now(); }
}
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function mtDow(now = new Date()) {
  try { return DOW[new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(now)]; } catch { return now.getDay(); }
}
export function weeklyScheduleFor(name) { return WEEKLY.get(String(name || '').toLowerCase()) || null; }
// undefined = not day-gated; null = off today; else the group slug worked today.
export function todayGroupFor(name, now) {
  if (isAllCoverage(name)) return undefined;
  const w = weeklyScheduleFor(name);
  if (!w) return undefined;
  const ex = EXC.get(String(name).toLowerCase());
  const d = dateIn('Asia/Manila', now || new Date());
  if (ex && ex.has(d)) return ex.get(d) || null;
  return w.get(mtDow(now)) || null;
}
export function groupSlugs(g) { return [...new Set([g, ...(SECRETARY_EXTRA_BUSINESSES[g] || [])].filter(Boolean))]; }
// The token's scope swapped for TODAY's group; offToday when not working.
export function effectiveAuth(auth, now) {
  if (!auth || auth.role !== 'secretary' || !auth.name) return auth;
  const t = todayGroupFor(auth.name, now);
  if (t === undefined) return auth;
  if (t === null) return { ...auth, offToday: true, homeScope: auth.scope };
  return { ...auth, scope: t, homeScope: auth.scope };
}
export function coverageOverrideFor(name) { return OVERRIDES.get(String(name || '').toLowerCase()) || null; }

// THE coverage rule (access + lead texts read this): which businesses a
// secretary named `name` with home business `scope` covers. null = all (Joey).
export function coveredSlugsFor({ name, scope } = {}, now) {
  if (isAllCoverage(name)) return null;
  const t = todayGroupFor(name, now);
  if (t !== undefined) return t ? groupSlugs(t) : [];
  const o = coverageOverrideFor(name);
  const extra = o || SECRETARY_EXTRA_BUSINESSES[scope] || [];
  return [...new Set([scope, ...extra].filter(Boolean))];
}

// Every business slug a token may act on: its primary scope plus any extras.
// Owner ('all') is unrestricted, and returns null meaning "apply no filter".
//
// The list is derived only from the LIVE map above. Tokens last for a while;
// accepting an old token's `allowed` claim would let a reassigned secretary
// keep seeing a former business until the token expired. A View As session
// still behaves identically because it uses this same map.
// Joey's ACCESS is deliberately left on the scope map (not "all"): his wider
// view comes from isAllJobsViewer in admin.js, not from this gate.
export function allowedSlugsFor(auth) {
  if (!auth || auth.scope === 'all') return null;
  if (auth.role === 'secretary' && auth.name) {
    const t = todayGroupFor(auth.name);
    if (t === null) return [];
    if (t) return [...new Set([...groupSlugs(t), ...(SECRETARY_ACCESS_ONLY[t] || [])])];
  }
  const o = auth.name && !isAllCoverage(auth.name) ? coverageOverrideFor(auth.name) : null;
  const fromScope = [...(o || SECRETARY_EXTRA_BUSINESSES[auth.scope] || []), ...(SECRETARY_ACCESS_ONLY[auth.scope] || [])];
  return [auth.scope, ...new Set(fromScope)].filter((v, i, a) => v && a.indexOf(v) === i);
}

// The gate every business-scoped action goes through.
export function mayUseBusiness(auth, slug) {
  const allowed = allowedSlugsFor(auth);
  return allowed === null || allowed.includes(slug);
}

// Targeted items (red alerts, callback banners) for a secretary, exception-aware
// (owner 2026-10-09). Named + not OFF today -> sees it. Not named, but working
// that business today and a named teammate is OFF today (Joe out, Alex covers)
// -> sees it in their place.
export function targetedToday(auth, targets, businessSlug, now) {
  if (!auth || !auth.name) return false;
  const me = String(auth.name).toLowerCase();
  const names = (targets || []).map(t => String(t).toLowerCase());
  const mine = todayGroupFor(auth.name, now);
  if (names.includes(me)) return mine !== null;
  if (!mine || !businessSlug) return false;
  if (!groupSlugs(mine).includes(businessSlug)) return false;
  return names.some(n => todayGroupFor(n, now) === null);
}

