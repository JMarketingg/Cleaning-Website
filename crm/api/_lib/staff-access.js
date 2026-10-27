export const SECRETARY_EXTRA_BUSINESSES = {
  doms: [
    'atxmountpros', 'austinmountingpros', 'houstontvinstallation', 'tvhanginghouston',
    'precision', 'tvmountingdenver', 'mile-high',
  ],
  'tidyhaus': [
    'atxtvmount', 'austintvinstall', 'houstonmounting', 'htvmounting',
    'austin', 'houstontvmountingpros', 'houstonperfectviewtvmounting', 'millertime', 'a1tvmounting',
  ],
};

export const SECRETARY_ACCESS_ONLY = {
  'tidyhaus': ['tvmountingdenver'],
};

let OVERRIDES = new Map();
let WEEKLY = new Map();
let EXC = new Map();
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
export function effectiveAuth(auth, now) {
  if (!auth || auth.role !== 'secretary' || !auth.name) return auth;
  const t = todayGroupFor(auth.name, now);
  if (t === undefined) return auth;
  if (t === null) return { ...auth, offToday: true, homeScope: auth.scope };
  return { ...auth, scope: t, homeScope: auth.scope };
}
export function coverageOverrideFor(name) { return OVERRIDES.get(String(name || '').toLowerCase()) || null; }

export function coveredSlugsFor({ name, scope } = {}, now) {
  if (isAllCoverage(name)) return null;
  const t = todayGroupFor(name, now);
  if (t !== undefined) return t ? groupSlugs(t) : [];
  const o = coverageOverrideFor(name);
  const extra = o || SECRETARY_EXTRA_BUSINESSES[scope] || [];
  return [...new Set([scope, ...extra].filter(Boolean))];
}

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

export function mayUseBusiness(auth, slug) {
  const allowed = allowedSlugsFor(auth);
  return allowed === null || allowed.includes(slug);
}

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

