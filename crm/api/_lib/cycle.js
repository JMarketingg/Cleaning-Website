// ============================================================================
// Jiyah's cycle tracker (2026-10-17, migration 0214). Called from calendar.js.
// Jiyah: full read/write. Andrew (owner): read-only summary of ONLY what Jiyah
// shares (cal_cycle_settings). Private notes are never sent to Andrew.
// Predictions are computed on read from real periods; manual edits and the
// auto estimate in force when a period starts are kept in cal_cycle_preds.
// ============================================================================
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v) => (DAY.test(String(v || '')) ? String(v) : null);
const addDay = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const manilaToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const FLOWS = ['spotting', 'light', 'medium', 'heavy'];
export const MOODS = ['happy', 'calm', 'sensitive', 'irritable', 'anxious', 'sad', 'stressed', 'tired', 'overwhelmed', 'affectionate', 'other'];
export const SYMPTOMS = ['cramps', 'bloating', 'headache', 'fatigue', 'tender', 'acne', 'cravings', 'backpain', 'sleep', 'other'];
const SET_KEYS = ['share_dots', 'share_next', 'share_started', 'share_mood', 'share_symptoms', 'share_flow', 'share_logs', 'share_notes', 'share_heads_up', 'remind_on'];
// Andrew's own reminder (0221). Only his login writes these; Jiyah's save never does.
const ANDREW_KEYS = ['andrew_remind_on', 'andrew_remind_days'];

// periods: [{start_day,end_day}] sorted asc. manual: active manual row or null.
export function predict(periods, manual, today) {
  const t = today || manilaToday();
  const ps = periods.slice().sort((a, b) => a.start_day.localeCompare(b.start_day));
  if (!ps.length) return { has: false };
  const gaps = [];
  for (let i = 1; i < ps.length; i++) { const g = diff(ps[i - 1].start_day, ps[i].start_day); if (g >= 15 && g <= 60) gaps.push(g); }
  const use = gaps.slice(-6);
  const avg = use.length ? use.reduce((a, b) => a + b, 0) / use.length : 28;
  const sd = use.length >= 2 ? Math.sqrt(use.reduce((a, b) => a + (b - avg) ** 2, 0) / use.length) : null;
  const done = ps.filter((p) => p.end_day).map((p) => diff(p.start_day, p.end_day) + 1).filter((n) => n >= 1 && n <= 15).slice(-6);
  const plen = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 5;
  const cyc = Math.round(avg);
  const last = ps[ps.length - 1];
  const ongoing = !last.end_day && diff(last.start_day, t) < 15;
  const autoStart = addDay(last.start_day, cyc);
  const spread = use.length >= 3 ? Math.max(1, Math.min(7, Math.round(sd || 1))) : (use.length ? 4 : 5);
  const man = manual && manual.start_day > last.start_day ? manual : null;
  const nextStart = man ? man.start_day : autoStart;
  const nextEnd = man ? man.end_day : addDay(nextStart, plen - 1);
  const cday = diff(last.start_day, t) + 1;
  const ov = addDay(nextStart, -14);
  let phase = null;
  if (cday >= 1 && cday <= 60) {
    if (ongoing || cday <= plen && (last.end_day ? t <= last.end_day : true)) phase = 'menstrual';
    else if (t < addDay(ov, -1)) phase = 'follicular';
    else if (t <= addDay(ov, 1)) phase = 'ovulation';
    else if (t < nextStart) phase = 'luteal';
    else phase = 'late';
  }
  const pred = [];   // estimated period days for the next 6 cycles
  if (ongoing && !last.end_day) for (let i = 0; i < plen; i++) { const d = addDay(last.start_day, i); if (d > t) pred.push(d); }
  for (let k = 0; k < 6; k++) {
    const s = k === 0 ? nextStart : addDay(nextStart, cyc * k), e = k === 0 ? nextEnd : addDay(s, plen - 1);
    for (let d = s; d <= e; d = addDay(d, 1)) if (d >= t || k > 0) pred.push(d);
  }
  // Phase dates (estimates): this cycle and the next two. ov = 14 days before the next start.
  const phases = [];
  const segs = (cs, ns) => {
    const o = addDay(ns, -14), pe = addDay(cs, plen - 1);
    [['menstrual', cs, pe], ['follicular', addDay(pe, 1), addDay(o, -2)], ['ovulation', addDay(o, -1), addDay(o, 1)], ['luteal', addDay(o, 2), addDay(ns, -1)]]
      .forEach(([k, lo, hi]) => { if (lo <= hi) phases.push({ phase: k, lo, hi }); });
  };
  segs(last.start_day, nextStart > last.start_day ? nextStart : addDay(last.start_day, cyc));
  if (t >= nextStart && !ongoing) phases.push({ phase: 'late', lo: nextStart, hi: t });
  for (let k = 0; k < 3; k++) { const cs = addDay(nextStart, cyc * k); segs(cs, addDay(cs, cyc)); }
  return {
    has: true, today: t, phases, cycle_len: cyc, period_len: plen, n_gaps: use.length, n_periods: done.length, sd: sd == null ? null : Math.round(sd * 10) / 10,
    early: use.length < 3, spread, last_start: last.start_day, last_end: last.end_day, ongoing,
    cycle_day: cday >= 1 && cday <= 90 ? cday : null, phase,
    auto_start: autoStart, auto_end: addDay(autoStart, plen - 1), manual: !!man,
    next_start: nextStart, next_end: nextEnd, range_lo: addDay(nextStart, -spread), range_hi: addDay(nextStart, spread),
    late_by: t > nextStart && !ongoing ? diff(nextStart, t) : 0,
    ov_day: ov, fertile_lo: addDay(ov, -5), fertile_hi: addDay(ov, 1), pred_days: Array.from(new Set(pred)),
  };
}
// Phase of a past/any day, from real period starts (estimate). null if unknown.
function phaseOfDay(d, ps, p) {
  let i = -1; for (let k = 0; k < ps.length; k++) if (ps[k].start_day <= d) i = k;
  if (i < 0 || !p.has) return null;
  const cs = ps[i].start_day, ns = ps[i + 1] ? ps[i + 1].start_day : p.next_start;
  if (diff(cs, ns) > 60 || diff(cs, d) > 60) return null;
  const pe = ps[i].end_day || addDay(cs, p.period_len - 1), o = addDay(ns, -14);
  if (d <= pe) return 'menstrual';
  if (d < addDay(o, -1)) return 'follicular';
  if (d <= addDay(o, 1)) return 'ovulation';
  if (d < ns) return 'luteal';
  return 'late';
}
// Patterns + outlook (stage 3). One helper for both views. opt.mood / opt.sym pick what may be used.
export function insights(c, logs, opt) {
  const p = c.pred, ps = c.periods.slice().sort((a, b) => a.start_day.localeCompare(b.start_day));
  const items = (l) => [...(opt.mood ? (l.moods || []).filter((m) => m !== 'other') : []), ...(opt.sym ? Object.keys(l.symptoms || {}).filter((k) => k !== 'other').map((k) => 's:' + k) : [])];
  const rows = logs.map((l) => ({ day: l.day, it: items(l), phase: phaseOfDay(l.day, ps, p) })).filter((r) => r.it.length);
  const tally = (rs) => { const n = {}; rs.forEach((r) => r.it.forEach((k) => { n[k] = (n[k] || 0) + 1; })); return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, n: v })); };
  const pat = { n: rows.length };
  if (rows.length && rows.length < 3) pat.logs = rows.map((r) => ({ day: r.day, it: r.it }));
  if (rows.length >= 3) {
    pat.counts = tally(rows).slice(0, 8);
    pat.by_phase = ['menstrual', 'follicular', 'ovulation', 'luteal'].map((ph) => { const rs = rows.filter((r) => r.phase === ph); return { phase: ph, days: rs.length, top: tally(rs).slice(0, 3) }; }).filter((x) => x.days);
  }
  let out = null;
  if (opt.outlook && p.has && p.phase) {
    out = { phase: p.phase, uncertain: !!(p.early || p.late_by > 0), src: 'general' };
    const td = rows.find((r) => r.day === p.today);
    const same = rows.filter((r) => r.phase === p.phase && r.day !== p.today);
    if (td) Object.assign(out, { src: 'logged', it: td.it });
    else if (same.length >= 2) Object.assign(out, { src: 'history', days: same.length, counts: tally(same).slice(0, 4) });
  }
  return { patterns: pat, outlook: out };
}
export function periodDays(periods, today) {
  const t = today || manilaToday(); const out = [];
  periods.forEach((p) => {
    const end = p.end_day || (diff(p.start_day, t) < 15 ? t : addDay(p.start_day, 4));
    for (let d = p.start_day; d <= end; d = addDay(d, 1)) out.push(d);
  });
  return out;
}

export async function cycleLoad(db) {
  const out = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
  const [per, set, man] = await Promise.all([
    db.from('cal_periods').select('*').order('start_day'),
    db.from('cal_cycle_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('cal_cycle_preds').select('*').eq('active', true).eq('kind', 'manual').order('created_at', { ascending: false }).limit(1),
  ]);
  const periods = out(per), settings = out(set) || { share_dots: true }, manual = (out(man) || [])[0] || null;
  return { periods, settings, manual, pred: predict(periods, manual) };
}

// For the main calendar: dots for Jiyah always, for Andrew only if share (env
// flag CYCLE_SHARE_OWNER, checked in calendar.js) AND share_dots.
export async function cycleDots(db, me, share) {
  const c = await cycleLoad(db);
  if (me !== 'jiyah' && !share) return { period_days: [], pred_days: [] };
  const s = c.settings;
  const r = (me === 'jiyah' || s.share_dots) ? { period_days: periodDays(c.periods), pred_days: c.pred.has ? c.pred.pred_days : [] } : { period_days: [], pred_days: [] };
  if (me === 'jiyah' && s.remind_on && c.pred.has) r.cyc_remind = { days: s.remind_days, next_start: c.pred.next_start, ongoing: c.pred.ongoing };
  if (me === 'andrew' && s.share_next && s.andrew_remind_on && c.pred.has) r.cyc_remind = { days: s.andrew_remind_days, next_start: c.pred.next_start, ongoing: c.pred.ongoing, who: 'andrew' };
  return r;
}

// Andrew's full shared view (0221). Every part only if its toggle is on.
// Never: Jiyah's settings row, her reminder, prediction edit history, access log.
function sharedFor(c, logs) {
  const s = c.settings, p = c.pred, r = {};
  if (s.share_dots) r.periods = c.periods.map((x) => ({ start_day: x.start_day, end_day: x.end_day, ...(s.share_notes && x.note ? { note: x.note } : {}) }));
  if (s.share_next && p.has) r.pred = { next_start: p.next_start, next_end: p.next_end, range_lo: p.range_lo, range_hi: p.range_hi, early: p.early, cycle_len: p.cycle_len, period_len: p.period_len, pred_days: p.pred_days, phases: p.phases };
  if (s.share_logs) r.logs = logs.map((l) => {
    const o = { day: l.day };
    if (s.share_flow && l.flow) o.flow = l.flow;
    if (s.share_mood && l.moods && l.moods.length) o.moods = l.moods;
    if (s.share_symptoms && l.symptoms && Object.keys(l.symptoms).length) o.symptoms = l.symptoms;
    if (s.share_notes && l.note) o.note = l.note;
    return o;
  }).filter((o) => Object.keys(o).length > 1);
  const lg = !!s.share_logs, phaseOk = !!(s.share_next || s.share_started);
  const ins = insights(c, logs, { mood: lg && !!s.share_mood, sym: lg && !!s.share_symptoms, outlook: phaseOk });
  if (lg && (s.share_mood || s.share_symptoms)) r.patterns = ins.patterns;
  if (ins.outlook) r.outlook = ins.outlook;
  r.andrew_remind = { on: !!s.andrew_remind_on, days: s.andrew_remind_days == null ? 2 : s.andrew_remind_days };
  return r;
}

function summaryFor(c, logs) {   // what Andrew may see
  const s = c.settings, p = c.pred, r = { shared: false };
  if (s.share_next && p.has) Object.assign(r, { shared: true, next_start: p.next_start, range_lo: p.range_lo, range_hi: p.range_hi, early: p.early, cycle_day: p.cycle_day, phase: p.phase, late_by: p.late_by });
  if (s.share_started && p.has) Object.assign(r, { shared: true, on_period: p.ongoing, ...(p.ongoing ? { cycle_day: p.cycle_day } : {}) });
  const recent = logs.filter((l) => l.day >= addDay(manilaToday(), -2)).sort((a, b) => b.day.localeCompare(a.day))[0];
  if (s.share_mood && recent && recent.moods && recent.moods.length) Object.assign(r, { shared: true, mood_day: recent.day, moods: recent.moods.filter((m) => m !== 'other') });
  if (s.share_symptoms && recent && recent.symptoms && Object.keys(recent.symptoms).length) Object.assign(r, { shared: true, sym_day: recent.day, symptoms: Object.keys(recent.symptoms).filter((k) => k !== 'other') });
  if (s.share_heads_up && s.heads_up) Object.assign(r, { shared: true, heads_up: s.heads_up });
  return r;
}

export async function cycleAction(req, res, db, me, op, b, share) {
  const out = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
  const isJ = me === 'jiyah';
  if (op === 'cycle') {
    if (!isJ && !share) return res.status(200).json({ me, summary: { shared: false }, off: true });   // flag off: nothing
    const c = await cycleLoad(db);
    const logs = out(await db.from('cal_cycle_days').select('*').order('day'));
    if (!isJ) return res.status(200).json({ me, summary: summaryFor(c, logs), shared: sharedFor(c, logs) });
    const hist = out(await db.from('cal_cycle_preds').select('*').order('created_at', { ascending: false }).limit(60));
    const acc = await db.from('cal_cycle_access_log').select('at, route, flag_state').order('at', { ascending: false }).limit(30);
    return res.status(200).json({ me, periods: c.periods, settings: c.settings, pred: c.pred, logs, history: hist, patterns: insights(c, logs, { mood: true, sym: true }).patterns, summary: summaryFor(c, logs), shared: sharedFor(c, logs), access_log: acc.error ? [] : acc.data });
  }
  if (op === 'cyc_andrew_remind_save') {   // Andrew's own reminder; writes ONLY his 2 fields
    if (me !== 'andrew') return res.status(403).json({ error: 'Only Andrew can change this' });
    const row = {};
    if (b.andrew_remind_on !== undefined) row.andrew_remind_on = !!b.andrew_remind_on;
    if (b.andrew_remind_days !== undefined) row.andrew_remind_days = Math.min(14, Math.max(0, Math.round(Number(b.andrew_remind_days)) || 0));
    if (!Object.keys(row).length) return res.status(400).json({ error: 'Nothing to save' });
    const r = out(await db.from('cal_cycle_settings').update(row).eq('id', 1).select(ANDREW_KEYS.join(', ')).single());
    return res.status(200).json({ andrew_remind: { on: !!r.andrew_remind_on, days: r.andrew_remind_days } });
  }
  if (!isJ) return res.status(403).json({ error: 'Only Jiyah can change this' });
  const now = new Date().toISOString(), t = manilaToday();
  switch (op) {
    case 'cyc_period_save': {
      const s = day(b.start_day), e = b.end_day ? day(b.end_day) : null;
      if (!s) return res.status(400).json({ error: 'Pick a start day' });
      if (s > t) return res.status(400).json({ error: 'Start day is in the future' });
      if (b.end_day && !e) return res.status(400).json({ error: 'Bad end day' });
      if (e && e < s) return res.status(400).json({ error: 'End is before start' });
      if (e && e > t) return res.status(400).json({ error: 'End day is in the future. Leave it empty while ongoing.' });
      if (e && diff(s, e) > 14) return res.status(400).json({ error: 'Longer than 15 days. Check the dates.' });
      const all = out(await db.from('cal_periods').select('*').order('start_day'));
      const clash = all.find((p) => p.id !== b.id && s <= (p.end_day || addDay(p.start_day, 6)) && (e || addDay(s, 6)) >= p.start_day);
      if (clash) return res.status(409).json({ error: 'Overlaps your period from ' + clash.start_day + '. Edit that one instead.' });
      const row = { start_day: s, end_day: e, note: b.note ? String(b.note).trim().slice(0, 1000) || null : null, updated_at: now };
      const c = await cycleLoad(db);
      const isNewest = !b.id && (!all.length || s > all[all.length - 1].start_day);
      const r = b.id ? await db.from('cal_periods').update(row).eq('id', b.id).select().single() : await db.from('cal_periods').insert(row).select().single();
      const saved = out(r);
      if (isNewest && c.pred.has) {   // keep what was predicted, so history shows early/late
        out(await db.from('cal_cycle_preds').insert({ kind: c.pred.manual ? 'manual' : 'auto', start_day: c.pred.next_start, end_day: c.pred.next_end, auto_start: c.pred.auto_start, auto_end: c.pred.auto_end, actual_start: s, active: false }));
        out(await db.from('cal_cycle_preds').update({ active: false, cleared_at: now, actual_start: s }).eq('active', true));
      }
      return res.status(200).json({ period: saved });
    }
    case 'cyc_period_delete':
      if (!b.id) return res.status(400).json({ error: 'Missing id' });
      out(await db.from('cal_periods').delete().eq('id', b.id)); return res.status(200).json({ ok: true });
    case 'cyc_day_save': {
      const d = day(b.day); if (!d) return res.status(400).json({ error: 'Bad day' });
      if (d > t) return res.status(400).json({ error: 'Cannot log the future' });
      const moods = Array.isArray(b.moods) ? Array.from(new Set(b.moods.filter((m) => MOODS.includes(m)))) : [];
      const symptoms = {};
      Object.keys(b.symptoms || {}).forEach((k) => { if (SYMPTOMS.includes(k)) symptoms[k] = Math.min(3, Math.max(1, Math.round(Number(b.symptoms[k])) || 1)); });
      const flow = FLOWS.includes(b.flow) ? b.flow : null;
      const note = b.note ? String(b.note).trim().slice(0, 2000) || null : null;
      if (!flow && !moods.length && !Object.keys(symptoms).length && !note) { out(await db.from('cal_cycle_days').delete().eq('day', d)); return res.status(200).json({ ok: true, cleared: true }); }
      return res.status(200).json({ log: out(await db.from('cal_cycle_days').upsert({ day: d, flow, moods, symptoms, note, updated_at: now }, { onConflict: 'day' }).select().single()) });
    }
    case 'cyc_pred_set': {
      const s = day(b.start_day), e = day(b.end_day);
      if (!s || !e || e < s || diff(s, e) > 14) return res.status(400).json({ error: 'Check the dates' });
      const c = await cycleLoad(db);
      if (c.pred.has && s <= c.pred.last_start) return res.status(400).json({ error: 'Must be after your last period' });
      out(await db.from('cal_cycle_preds').update({ active: false, cleared_at: now }).eq('active', true));
      return res.status(200).json({ pred: out(await db.from('cal_cycle_preds').insert({ kind: 'manual', start_day: s, end_day: e, auto_start: c.pred.auto_start || null, auto_end: c.pred.auto_end || null, active: true }).select().single()) });
    }
    case 'cyc_pred_reset':
      out(await db.from('cal_cycle_preds').update({ active: false, cleared_at: now }).eq('active', true)); return res.status(200).json({ ok: true });
    case 'cyc_settings_save': {
      const row = { updated_at: now };
      SET_KEYS.forEach((k) => { if (b[k] !== undefined) row[k] = !!b[k]; });
      if (b.remind_days !== undefined) row.remind_days = Math.min(14, Math.max(0, Math.round(Number(b.remind_days)) || 0));
      if (b.heads_up !== undefined) row.heads_up = b.heads_up ? String(b.heads_up).trim().slice(0, 200) || null : null;
      return res.status(200).json({ settings: out(await db.from('cal_cycle_settings').update(row).eq('id', 1).select().single()) });
    }
    default: return null;
  }
}
