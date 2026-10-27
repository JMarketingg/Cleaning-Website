import { localDateStartUTC, addDaysStr } from './time.js';

export const SLOTS = [
  { key: 's1', label: '8:00 AM – 10:00 AM', start: '08:00', end: '10:00' },
  { key: 's2', label: '11:00 AM – 1:00 PM', start: '11:00', end: '13:00' },
  { key: 's3', label: '2:00 PM – 4:00 PM',  start: '14:00', end: '16:00' },
  { key: 's4', label: '5:00 PM – 8:00 PM',  start: '17:00', end: '20:00' },
  { key: 's5', label: '8:00 PM – 10:30 PM', start: '20:00', end: '22:30', bonus: 75 },
];

export const SLOT_KEYS = new Set(SLOTS.map(s => s.key));

let _extraCol = true;
const esCol2 = () => (_extraCol ? ', extra_slots' : '');
const esOf2 = (b) => (_extraCol && Array.isArray(b && b.extra_slots)) ? b.extra_slots : [];
const _isExtraErr = (e) => !!(e && e.code === '42703' && /extra_slots/.test(e.message || ''));

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function normalizeSlots(input) {
  if (!Array.isArray(input)) {
    const e = new Error('slots must be an array'); e.status = 400; throw e;
  }
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const day = Number(raw && raw.day_of_week);
    const key = String((raw && raw.slot_key) || '');
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      const e = new Error(`Invalid day_of_week: ${raw && raw.day_of_week}`); e.status = 400; throw e;
    }
    if (!SLOT_KEYS.has(key)) {
      const e = new Error(`Invalid time slot: ${key}`); e.status = 400; throw e;
    }
    const dedupe = `${day}:${key}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ day_of_week: day, slot_key: key });
  }
  return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function assertDate(s) {
  const str = String(s || '');
  if (!DATE_RE.test(str)) { const e = new Error(`Invalid date: ${s}`); e.status = 400; throw e; }
  const d = new Date(str + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) { const e = new Error(`Invalid date: ${s}`); e.status = 400; throw e; }
  return str;
}

export function dayOfWeekFor(dateStr) {
  return new Date(assertDate(dateStr) + 'T00:00:00Z').getUTCDay();
}

export function computeExceptionRows(recurringKeys, selected) {
  if (!Array.isArray(selected)) {
    const e = new Error('selected must be an array'); e.status = 400; throw e;
  }
  const sel = new Set();
  for (const raw of selected) {
    const key = String(raw || '');
    if (!SLOT_KEYS.has(key)) { const e = new Error(`Invalid time slot: ${key}`); e.status = 400; throw e; }
    sel.add(key);
  }
  const recur = new Set(recurringKeys || []);
  const rows = [];
  for (const key of SLOT_KEYS) {
    const inRecur = recur.has(key);
    const inSel = sel.has(key);
    if (inSel && !inRecur) rows.push({ slot_key: key, is_available: true });
    else if (!inSel && inRecur) rows.push({ slot_key: key, is_available: false });
  }
  return rows;
}


const SLOT_BY_KEY = Object.fromEntries(SLOTS.map(s => [s.key, s]));

const PARTNER_SLUG = {
  'tidyhaus': [{ slug: 'doms', metro: /denver/i }, { slug: 'a1tvmounting', metro: /dfw|dallas|fort worth/i }],
};

const SOLE_TECH = {
};

export function applySoleTech(businessSlug, techs) {
  const only = SOLE_TECH[businessSlug];
  if (!only) return techs || [];
  return (techs || []).filter(t => t.id === only);
}

async function crossHirePartner(db, businessSlug, serviceAreaId) {
  const pairings = [].concat(PARTNER_SLUG[businessSlug] || []);
  if (!pairings.length) return null;
  let areaName = null;
  if (serviceAreaId) {
    const { data: area } = await db.from('service_areas').select('name').eq('id', serviceAreaId).maybeSingle();
    areaName = area?.name || null;
  } else {
    const { data: biz } = await db.from('businesses').select('id').eq('slug', businessSlug).single();
    if (!biz) return null;
    const { data: areas } = await db.from('service_areas').select('name').eq('business_id', biz.id);
    if ((areas || []).length === 1 && pairings.some(p => p.metro.test(areas[0].name || ''))) areaName = areas[0].name;
  }
  const pairing = areaName && pairings.find(p => p.metro.test(areaName));
  if (!pairing) return null;
  const { slug: partnerSlug, metro } = pairing;
  const { data: partnerBiz } = await db.from('businesses').select('id').eq('slug', partnerSlug).single();
  if (!partnerBiz) return null;
  const { data: partnerAreas } = await db.from('service_areas').select('id, name').eq('business_id', partnerBiz.id);
  const partnerArea = (partnerAreas || []).find(a => metro.test(a.name || ''));
  if (!partnerArea) return null;
  return { partnerSlug, partnerBizId: partnerBiz.id, partnerServiceAreaId: partnerArea.id };
}

export async function filterTechsByZip(db, techs, zip) {
  const z = String(zip || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(z) || !techs || !techs.length) return techs;
  const { data, error } = await db.from('technicians').select('id, service_zips').in('id', techs.map(t => t.id));
  if (error) return techs;
  const zipsOf = new Map((data || []).map(r => [r.id, r.service_zips]));
  return techs.filter(t => { const list = zipsOf.get(t.id); return !Array.isArray(list) || list.includes(z); });
}

export function todayStr(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function localHHMM(tz, instantISO) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(instantISO)).reduce((a, x) => (a[x.type] = x.value, a), {});
  const hh = p.hour === '24' ? '00' : p.hour;
  return `${hh}:${p.minute}`;
}
export function localDateStr(tz, instantISO) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(instantISO));
}
function toMin(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
export function slotKeyForLocalTime(hhmm) {
  const t = toMin(hhmm);
  for (const s of SLOTS) if (t >= toMin(s.start) && t < toMin(s.end)) return s.key;
  for (const s of SLOTS) if (toMin(s.start) === t) return s.key;
  return null;
}

function localTimeToUTC(tz, dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const ms = Date.UTC(y, m - 1, d, hh, mm, 0);
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).reduce((a, x) => (a[x.type] = x.value, a), {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return new Date(ms - (asUTC - ms));
}

export function slotStartUTC(tz, dateStr, slotKey) {
  const s = SLOT_BY_KEY[slotKey]; return s ? localTimeToUTC(tz, dateStr, s.start) : null;
}
export function slotEndUTC(tz, dateStr, slotKey) {
  const s = SLOT_BY_KEY[slotKey]; return s ? localTimeToUTC(tz, dateStr, s.end) : null;
}

export function parseSlotId(id) {
  const m = /^(.+)_(\d{4}-\d{2}-\d{2})_(s[1-5])$/.exec(String(id || ''));
  return m ? { businessSlug: m[1], dateStr: m[2], slotKey: m[3] } : null;
}

export async function techIsOpenForSlot(db, techId, dateStr, slotKey, tz) {
  const { data: t } = await db.from('technicians').select('id, active, max_jobs_per_day').eq('id', techId).maybeSingle();
  if (!t || !t.active) return false;
  const keys = await recurringPlusExceptions(db, techId, dateStr, dayOfWeekFor(dateStr));
  if (!keys.has(slotKey)) return false;
  const { taken, jobCount } = await bookedSlotsOneTech(db, techId, dateStr, tz);
  if (t.max_jobs_per_day != null && jobCount >= Number(t.max_jobs_per_day)) return false;
  return !taken.has(slotKey);
}

export async function publicOpenSlots(db, { businessSlug, days = 30, serviceAreaId = null, timezone = null, crossHire = false, onlyTechId = null, zip = null }) {
  const horizon = Math.max(1, Math.min(Number(days) || 30, 95));
  const { data: biz } = await db.from('businesses').select('id, timezone').eq('slug', businessSlug).single();
  if (!biz) return { days: [], timezone: 'Asia/Manila' };

  let areaTz = null;
  if (serviceAreaId && !timezone) {
    const { data: area } = await db.from('service_areas').select('timezone').eq('id', serviceAreaId).maybeSingle();
    areaTz = area?.timezone || null;
  }
  const tz = timezone || areaTz || biz.timezone || 'Asia/Manila';

  const techSel = (cols) => { let q = db.from('technicians').select(cols).eq('business_id', biz.id).eq('active', true); if (serviceAreaId) q = q.eq('service_area_id', serviceAreaId); return q; };
  let { data: techs, error: techErr } = await techSel('id, max_jobs_per_day');
  if (techErr && /max_jobs_per_day/.test(techErr.message || '')) ({ data: techs } = await techSel('id'));
  const maxByTech = new Map((techs || []).map(t => [t.id, (t.max_jobs_per_day == null ? null : Number(t.max_jobs_per_day))]));

  if (crossHire) {
    const partner = await crossHirePartner(db, businessSlug, serviceAreaId);
    if (partner) {
      const pTechSel = (cols) => db.from('technicians').select(cols)
        .eq('business_id', partner.partnerBizId).eq('active', true).eq('service_area_id', partner.partnerServiceAreaId);
      let { data: pTechs, error: pErr } = await pTechSel('id, max_jobs_per_day');
      if (pErr && /max_jobs_per_day/.test(pErr.message || '')) ({ data: pTechs } = await pTechSel('id'));
      for (const t of (pTechs || [])) {
        maxByTech.set(t.id, (t.max_jobs_per_day == null ? null : Number(t.max_jobs_per_day)));
        (techs || (techs = [])).push(t);
      }
    }
  }

  techs = applySoleTech(businessSlug, techs);
  techs = await filterTechsByZip(db, techs, zip);

  if (onlyTechId) {
    const { data: one } = await db.from('technicians').select('id, max_jobs_per_day').eq('id', onlyTechId).eq('active', true).maybeSingle();
    techs = one ? [one] : [];
    if (one) maxByTech.set(one.id, one.max_jobs_per_day == null ? null : Number(one.max_jobs_per_day));
  }

  const techIds = (techs || []).map(t => t.id);
  if (!techIds.length) return { days: [], timezone: tz };

  const start = todayStr(tz);
  const endExclusive = addDaysStr(start, horizon);

  const { data: av } = await db.from('technician_availability')
    .select('technician_id, day_of_week, slot_key').in('technician_id', techIds);
  const recur = new Map();
  for (const r of (av || [])) {
    const k = `${r.technician_id}:${r.day_of_week}`;
    if (!recur.has(k)) recur.set(k, new Set());
    recur.get(k).add(r.slot_key);
  }

  const { data: exc } = await db.from('technician_availability_exceptions')
    .select('technician_id, exception_date, slot_key, is_available')
    .in('technician_id', techIds)
    .gte('exception_date', start).lt('exception_date', endExclusive);
  const excMap = new Map();
  for (const e of (exc || [])) {
    const k = `${e.technician_id}:${e.exception_date}`;
    if (!excMap.has(k)) excMap.set(k, new Map());
    excMap.get(k).set(e.slot_key, e.is_available);
  }

  const winStart = localDateStartUTC(tz, start).toISOString();
  const winEnd = localDateStartUTC(tz, endExclusive).toISOString();
  const idList = techIds.join(',');
  const runB = (withSecond) => {
    let q = db.from('bookings')
      .select((withSecond ? 'technician_id, secondary_technician_id, scheduled_at' : 'technician_id, scheduled_at') + esCol2())
      .neq('status', 'cancelled').not('scheduled_at', 'is', null)
      .gte('scheduled_at', winStart).lt('scheduled_at', winEnd);
    return withSecond
      ? q.or(`technician_id.in.(${idList}),secondary_technician_id.in.(${idList})`)
      : q.in('technician_id', techIds);
  };
  let withSecond = true;
  let { data: bk, error: bkErr } = await runB(withSecond);
  for (let i = 0; i < 2 && bkErr; i++) {
    let changed = false;
    if (_isExtraErr(bkErr)) { _extraCol = false; changed = true; }
    if (/secondary_technician_id/.test(bkErr.message || '')) { withSecond = false; changed = true; }
    if (!changed) break;
    ({ data: bk, error: bkErr } = await runB(withSecond));
  }
  if (bkErr) throw bkErr;
  const techIdSet = new Set(techIds);
  const booked = new Set();
  const dayCount = new Map();
  for (const b of (bk || [])) {
    const slotKey = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
    const dateStr = localDateStr(tz, b.scheduled_at);
    const extra = esOf2(b);
    for (const tid of [b.technician_id, b.secondary_technician_id]) {
      if (tid && techIdSet.has(tid)) {
        if (slotKey) {
          booked.add(`${tid}:${dateStr}:${slotKey}`);
          for (const sk of extra) booked.add(`${tid}:${dateStr}:${sk}`);
        }
        dayCount.set(`${tid}:${dateStr}`, (dayCount.get(`${tid}:${dateStr}`) || 0) + 1);
      }
    }
  }

  const MIN_LEAD_MS = minLeadMsFor(serviceAreaId);
  const earliestBookableMs = Date.now() + MIN_LEAD_MS;

  const out = [];
  for (let i = 0; i < horizon; i++) {
    const dateStr = addDaysStr(start, i);
    const dow = dayOfWeekFor(dateStr);
    const open = new Set();
    for (const tid of techIds) {
      const cap = maxByTech.get(tid);
      if (cap != null && (dayCount.get(`${tid}:${dateStr}`) || 0) >= cap) continue;
      const set = new Set(recur.get(`${tid}:${dow}`) || []);
      const ex = excMap.get(`${tid}:${dateStr}`);
      if (ex) for (const [sk, avail] of ex) { if (avail) set.add(sk); else set.delete(sk); }
      for (const sk of set) if (!booked.has(`${tid}:${dateStr}:${sk}`)) open.add(sk);
    }
    if (!open.size) continue;
    const timeslots = SLOTS.filter(s => open.has(s.key))
      .map(s => ({
        id: `${businessSlug}_${dateStr}_${s.key}`,
        slot_key: s.key,
        formatted: s.label,
        start: slotStartUTC(tz, dateStr, s.key).toISOString(),
        end: slotEndUTC(tz, dateStr, s.key).toISOString(),
        bonus: s.bonus || 0,
      }))
      .filter(s => new Date(s.start).getTime() > earliestBookableMs);
    if (!timeslots.length) continue;
    out.push({ date: dateStr, day_of_week: dow, timeslots });
  }
  return { days: out, timezone: tz };
}

async function recurringPlusExceptions(db, techId, dateStr, dow) {
  const { data: av } = await db.from('technician_availability')
    .select('slot_key').eq('technician_id', techId).eq('day_of_week', dow);
  const set = new Set((av || []).map(x => x.slot_key));
  const { data: exc } = await db.from('technician_availability_exceptions')
    .select('slot_key, is_available').eq('technician_id', techId).eq('exception_date', dateStr);
  for (const e of (exc || [])) { if (e.is_available) set.add(e.slot_key); else set.delete(e.slot_key); }
  return set;
}
let _liftOne = true;
async function bookedSlotsOneTech(db, techId, dateStr, tz) {
  const dayStart = localDateStartUTC(tz, dateStr).toISOString();
  const dayEnd = localDateStartUTC(tz, addDaysStr(dateStr, 1)).toISOString();
  const run = (withSecond) => {
    let q = db.from('bookings').select('scheduled_at' + esCol2())
      .neq('status', 'cancelled').not('scheduled_at', 'is', null)
      .gte('scheduled_at', dayStart).lt('scheduled_at', dayEnd);
    return withSecond
      ? q.or(`technician_id.eq.${techId},secondary_technician_id.eq.${techId}`)
      : q.eq('technician_id', techId);
  };
  let { data, error } = await run(_liftOne);
  for (let i = 0; i < 2 && error; i++) {
    let changed = false;
    if (_isExtraErr(error)) { _extraCol = false; changed = true; }
    if (error.code === '42703' && /secondary_technician_id/.test(error.message || '')) { _liftOne = false; changed = true; }
    if (!changed) break;
    ({ data, error } = await run(_liftOne));
  }
  if (error) throw error;
  const taken = new Set();
  let jobCount = 0;
  for (const b of (data || [])) {
    jobCount++;
    const k = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at)); if (k) taken.add(k);
    for (const sk of esOf2(b)) taken.add(sk);
  }
  return { taken, jobCount };
}

async function weekJobCounts(db, techIds, dateStr, tz) {
  const counts = new Map(techIds.map(id => [id, 0]));
  if (!techIds.length) return counts;
  const dow = dayOfWeekFor(dateStr);
  const sunStr = addDaysStr(dateStr, -dow);
  const weekStart = localDateStartUTC(tz, sunStr).toISOString();
  const weekEnd = localDateStartUTC(tz, addDaysStr(sunStr, 7)).toISOString();
  const idList = techIds.join(',');
  const run = (withSecond) => {
    let q = db.from('bookings').select('technician_id' + (withSecond ? ', secondary_technician_id' : ''))
      .neq('status', 'cancelled').not('scheduled_at', 'is', null)
      .gte('scheduled_at', weekStart).lt('scheduled_at', weekEnd);
    return withSecond
      ? q.or(`technician_id.in.(${idList}),secondary_technician_id.in.(${idList})`)
      : q.in('technician_id', techIds);
  };
  let { data, error } = await run(_liftOne);
  if (error && error.code === '42703' && /secondary_technician_id/.test(error.message || '')) {
    _liftOne = false;
    ({ data, error } = await run(_liftOne));
  }
  if (error) throw error;
  for (const b of (data || [])) {
    if (counts.has(b.technician_id)) counts.set(b.technician_id, counts.get(b.technician_id) + 1);
    if (b.secondary_technician_id && counts.has(b.secondary_technician_id)) counts.set(b.secondary_technician_id, counts.get(b.secondary_technician_id) + 1);
  }
  return counts;
}

async function pickFairest(db, eligible, dateStr, tz) {
  if (!eligible.length) return null;
  const top = Math.max(...eligible.map(t => Number(t.booking_priority) || 0));
  eligible = eligible.filter(t => (Number(t.booking_priority) || 0) === top);
  if (eligible.length === 1) return eligible[0].id;
  const counts = await weekJobCounts(db, eligible.map(t => t.id), dateStr, tz);
  let best = eligible[0], bestCount = counts.get(eligible[0].id) || 0;
  for (const t of eligible.slice(1)) {
    const c = counts.get(t.id) || 0;
    if (c < bestCount || (c === bestCount && t.id < best.id)) { best = t; bestCount = c; }
  }
  return best.id;
}

export async function pickOpenTech(db, { businessSlug, dateStr, slotKey, serviceAreaId = null, timezone = null, crossHire = false, zip = null }) {
  const { data: biz } = await db.from('businesses').select('id, timezone').eq('slug', businessSlug).single();
  if (!biz) return null;
  let areaTz = null;
  if (serviceAreaId && !timezone) {
    const { data: area } = await db.from('service_areas').select('timezone').eq('id', serviceAreaId).maybeSingle();
    areaTz = area?.timezone || null;
  }
  const tz = timezone || areaTz || biz.timezone || 'Asia/Manila';
  const dow = dayOfWeekFor(dateStr);
  const baseQ = (cols) => { let q = db.from('technicians').select(cols).eq('business_id', biz.id).eq('active', true); if (serviceAreaId) q = q.eq('service_area_id', serviceAreaId); return q.order('created_at', { ascending: true }); };
  let { data: techs, error: techErr } = await baseQ('id, max_jobs_per_day, booking_priority');
  if (techErr && /booking_priority/.test(techErr.message || '')) ({ data: techs, error: techErr } = await baseQ('id, max_jobs_per_day'));
  if (techErr && /max_jobs_per_day/.test(techErr.message || '')) ({ data: techs } = await baseQ('id'));
  const list = await filterTechsByZip(db, applySoleTech(businessSlug, techs), zip);
  const atCap = (t, jobCount) => { const c = (t.max_jobs_per_day == null ? null : Number(t.max_jobs_per_day)); return c != null && jobCount >= c; };
  const eligibleFrom = async (pool) => {
    const eligible = [];
    for (const t of pool) {
      const keys = await recurringPlusExceptions(db, t.id, dateStr, dow);
      if (!keys.has(slotKey)) continue;
      const { taken, jobCount } = await bookedSlotsOneTech(db, t.id, dateStr, tz);
      if (atCap(t, jobCount)) continue;
      if (taken.has(slotKey)) continue;
      eligible.push(t);
    }
    return eligible;
  };
  const hostEligible = await eligibleFrom(list);
  const hostPick = await pickFairest(db, hostEligible, dateStr, tz);
  if (hostPick) return hostPick;
  if (crossHire) {
    const partner = await crossHirePartner(db, businessSlug, serviceAreaId);
    if (partner) {
      const pBaseQ = (cols) => db.from('technicians').select(cols)
        .eq('business_id', partner.partnerBizId).eq('active', true).eq('service_area_id', partner.partnerServiceAreaId)
        .order('created_at', { ascending: true });
      let { data: pTechs, error: pErr } = await pBaseQ('id, max_jobs_per_day, booking_priority');
      if (pErr && /booking_priority/.test(pErr.message || '')) ({ data: pTechs, error: pErr } = await pBaseQ('id, max_jobs_per_day'));
      if (pErr && /max_jobs_per_day/.test(pErr.message || '')) ({ data: pTechs } = await pBaseQ('id'));
      const partnerEligible = await eligibleFrom(await filterTechsByZip(db, applySoleTech(businessSlug, pTechs || []), zip));
      const partnerPick = await pickFairest(db, partnerEligible, dateStr, tz);
      if (partnerPick) return partnerPick;
    }
  }
  return null;
}

export function normalizeExceptionSlots(input) {
  if (!Array.isArray(input)) {
    const e = new Error('slots must be an array'); e.status = 400; throw e;
  }
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const key = String((raw && raw.slot_key) || '');
    if (!SLOT_KEYS.has(key)) {
      const e = new Error(`Invalid time slot: ${key}`); e.status = 400; throw e;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ slot_key: key, is_available: !!(raw && raw.is_available) });
  }
  return out;
}

const LEAD_HOURS_BY_AREA = { '87844ace-8282-4893-a64e-3cdeca0efcdc': 12 };
export function minLeadMsFor(serviceAreaId) { return (LEAD_HOURS_BY_AREA[serviceAreaId] || 1) * 60 * 60 * 1000; }
