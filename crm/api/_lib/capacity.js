import { SLOTS, slotKeyForLocalTime, localHHMM, localDateStr, todayStr, dayOfWeekFor } from './availability.js';
import { addDaysStr } from './time.js';

const WEEKS_BACK = 8;
const WEEKS_FWD = 2;
const NEXT_DAYS = 14;

const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const pct = (used, offered) => (offered > 0 ? Math.round((used / offered) * 100) : null);

function sundayOf(dateStr) { return addDaysStr(dateStr, -dayOfWeekFor(dateStr)); }

function slotsOfBooking(b, tz) {
  const main = slotKeyForLocalTime(localHHMM(tz, b.scheduled_at));
  const keys = [];
  if (main) keys.push(main);
  if (Array.isArray(b.extra_slots)) for (const k of b.extra_slots) if (k && !keys.includes(k)) keys.push(k);
  return keys;
}

export async function capacityOverview(db) {
  const { data: techRows, error: tErr } = await db.from('technicians')
    .select('id, name, status, max_jobs_per_day, business_id, service_area:service_areas ( name, timezone )')
    .eq('active', true).order('name');
  if (tErr) throw tErr;
  const { data: bizRows } = await db.from('businesses').select('id, slug');
  const slugById = new Map((bizRows || []).map(b => [b.id, b.slug]));

  const techs = (techRows || []).map(t => ({
    id: t.id, name: t.name, status: t.status || 'available',
    cap: t.max_jobs_per_day == null ? null : Number(t.max_jobs_per_day),
    business_slug: slugById.get(t.business_id) || null,
    city: t.service_area?.name || 'No city',
    tz: t.service_area?.timezone || 'Asia/Manila',
  }));
  const ids = techs.map(t => t.id);
  if (!ids.length) return { generated_at: new Date().toISOString(), slots: SLOTS, cities: [] };

  const tzs = [...new Set(techs.map(t => t.tz))];
  let minDate = null, maxDate = null;
  for (const tz of tzs) {
    const today = todayStr(tz);
    const lo = addDaysStr(sundayOf(today), -7 * WEEKS_BACK);
    const hi = addDaysStr(sundayOf(today), 7 * (WEEKS_FWD + 1) - 1);
    if (!minDate || lo < minDate) minDate = lo;
    if (!maxDate || hi > maxDate) maxDate = hi;
  }

  const { data: av } = await db.from('technician_availability')
    .select('technician_id, day_of_week, slot_key').in('technician_id', ids);
  const recurring = new Map();
  for (const r of (av || [])) {
    if (!recurring.has(r.technician_id)) recurring.set(r.technician_id, new Map());
    const m = recurring.get(r.technician_id);
    if (!m.has(r.day_of_week)) m.set(r.day_of_week, new Set());
    m.get(r.day_of_week).add(r.slot_key);
  }
  const { data: ex } = await db.from('technician_availability_exceptions')
    .select('technician_id, exception_date, slot_key, is_available')
    .in('technician_id', ids).gte('exception_date', minDate).lte('exception_date', maxDate);
  const exceptions = new Map();              // `${techId}:${date}` -> [{slot_key,is_available}]
  for (const e of (ex || [])) {
    const k = `${e.technician_id}:${e.exception_date}`;
    if (!exceptions.has(k)) exceptions.set(k, []);
    exceptions.get(k).push(e);
  }

  const since = new Date(Date.parse(minDate + 'T00:00:00Z') - 86400000).toISOString();
  const until = new Date(Date.parse(maxDate + 'T00:00:00Z') + 2 * 86400000).toISOString();
  const idList = ids.join(',');
  const runBk = (withExtra) => db.from('bookings')
    .select('technician_id, secondary_technician_id, scheduled_at, service_area_id' + (withExtra ? ', extra_slots' : ''))
    .not('status', 'in', '(cancelled,no_show)').not('scheduled_at', 'is', null)
    .gte('scheduled_at', since).lt('scheduled_at', until)
    .or(`technician_id.in.(${idList}),secondary_technician_id.in.(${idList})`)
    .order('scheduled_at', { ascending: true }).limit(5000);
  let { data: bks, error: bErr } = await runBk(true);
  if (bErr && /extra_slots/.test(bErr.message || '')) ({ data: bks, error: bErr } = await runBk(false));
  if (bErr) throw bErr;

  const { data: areaRows } = await db.from('service_areas').select('id, timezone');
  const areaTz = new Map((areaRows || []).filter(a => a.timezone).map(a => [a.id, a.timezone]));
  const techById = new Map(techs.map(t => [t.id, t]));

  const used = new Map();
  const mark = (tid, date, key) => {
    const k = `${tid}:${date}`;
    if (!used.has(k)) used.set(k, new Set());
    used.get(k).add(key);
  };
  for (const b of (bks || [])) {
    for (const tid of [b.technician_id, b.secondary_technician_id]) {
      const t = tid && techById.get(tid);
      if (!t) continue;
      const btz = areaTz.get(b.service_area_id) || t.tz;
      const date = localDateStr(btz, b.scheduled_at);
      for (const key of slotsOfBooking(b, btz)) mark(tid, date, key);
    }
  }

  const offeredOn = (t, date, today) => {
    if (t.status === 'off' && date >= today) return new Set();
    const set = new Set(recurring.get(t.id)?.get(dayOfWeekFor(date)) || []);
    for (const e of (exceptions.get(`${t.id}:${date}`) || [])) { if (e.is_available) set.add(e.slot_key); else set.delete(e.slot_key); }
    if (t.cap != null && set.size > t.cap) {
      return new Set([...set].sort().slice(0, t.cap));
    }
    return set;
  };

  const byCity = new Map();
  for (const t of techs) {
    if (!byCity.has(t.city)) byCity.set(t.city, { name: t.city, tz: t.tz, techs: [] });
    byCity.get(t.city).techs.push(t);
  }

  const nowIso = new Date().toISOString();
  const cities = [];
  for (const c of byCity.values()) {
    const today = todayStr(c.tz);
    const nowHHMM = localHHMM(c.tz, nowIso);
    const thisSunday = sundayOf(today);

    const weeks = [];
    for (let w = -WEEKS_BACK; w <= WEEKS_FWD; w++) {
      const start = addDaysStr(thisSunday, 7 * w);
      let offered = 0, usedN = 0;
      for (let d = 0; d < 7; d++) {
        const date = addDaysStr(start, d);
        for (const t of c.techs) {
          const off = offeredOn(t, date, today);
          const u = used.get(`${t.id}:${date}`) || new Set();
          offered += off.size;
          for (const k of off) if (u.has(k)) usedN++;
        }
      }
      weeks.push({
        start, state: w < 0 ? 'past' : w === 0 ? 'current' : 'future',
        offered, used: usedN, idle: Math.max(0, offered - usedN), util: pct(usedN, offered),
      });
    }
    const roll = (list) => {
      const offered = list.reduce((s, x) => s + x.offered, 0), usedN = list.reduce((s, x) => s + x.used, 0);
      return { offered, used: usedN, idle: Math.max(0, offered - usedN), util: pct(usedN, offered), weeks: list.length };
    };
    const past = weeks.filter(w => w.state === 'past');

    const last4Start = addDaysStr(thisSunday, -28);
    const perTech = c.techs.map(t => {
      let offered = 0, usedN = 0;
      for (let i = 0; i < 28; i++) {
        const date = addDaysStr(last4Start, i);
        const off = offeredOn(t, date, today);
        const u = used.get(`${t.id}:${date}`) || new Set();
        offered += off.size;
        for (const k of off) if (u.has(k)) usedN++;
      }
      return { id: t.id, name: t.name, business_slug: t.business_slug, status: t.status, offered, used: usedN,
        idle: Math.max(0, offered - usedN), util: pct(usedN, offered) };
    });

    const next = [];
    let firstOpen = null;
    for (let i = 0; i < NEXT_DAYS; i++) {
      const date = addDaysStr(today, i);
      const bySlot = {};
      let offered = 0, usedN = 0, open = 0;
      for (const s of SLOTS) bySlot[s.key] = 0;
      for (const t of c.techs) {
        const off = offeredOn(t, date, today);
        const u = used.get(`${t.id}:${date}`) || new Set();
        for (const key of off) {
          const slot = SLOTS.find(s => s.key === key);
          const past = i === 0 && slot && slot.start <= nowHHMM;
          if (past) continue;
          offered++;
          if (u.has(key)) usedN++;
          else { open++; bySlot[key]++; }
        }
      }
      next.push({ date, offered, used: usedN, open, by_slot: bySlot });
      if (!firstOpen && open > 0) {
        const key = SLOTS.find(s => bySlot[s.key] > 0)?.key || null;
        firstOpen = { date, days_out: i, slot_key: key };
      }
    }

    cities.push({
      name: c.name, tz: c.tz, today,
      techs: c.techs.map(t => ({ id: t.id, name: t.name, business_slug: t.business_slug, status: t.status, cap: t.cap })),
      weeks, last4: roll(past.slice(-4)), last8: roll(past),
      per_tech: perTech, next, first_open: firstOpen,
      full_days: next.filter(d => d.offered > 0 && d.open === 0).map(d => d.date),
    });
  }
  const order = { Manila: 0, Houston: 1, Austin: 2 };
  cities.sort((a, b) => (order[a.name] ?? 9) - (order[b.name] ?? 9) || a.name.localeCompare(b.name));

  return {
    generated_at: nowIso,
    slots: SLOTS,
    note: 'Past weeks are measured against today\'s weekly schedule plus exceptions still on file (the CRM keeps no schedule history).',
    cities,
  };
}
