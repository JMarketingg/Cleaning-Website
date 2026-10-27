import { cycleAction, cycleDots } from './cycle.js';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WHO = ['andrew', 'jiyah', 'both'];
const PEOPLE = ['andrew', 'jiyah'];
const TZS = ['Asia/Bangkok', 'Asia/Manila'];
const CATS = ['appointment', 'reminder', 'birthday', 'custom'];
const FREQ = ['daily', 'weekly', 'monthly', 'yearly'];
const tzOf = (v, me) => (TZS.includes(v) ? v : (me === 'jiyah' ? 'Asia/Manila' : 'Asia/Bangkok'));
const clip = (v, n = 500) => (v == null ? null : String(v).trim().slice(0, n) || null);
const day = (v) => (DAY.test(String(v || '')) ? String(v) : null);
const mins = (v) => { if (v === null || v === '' || v === undefined) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n < 1440 ? n : null; };
const HEX = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : null);
const addDay = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function cleanRule(r) {
  if (!r || typeof r !== 'object' || !FREQ.includes(r.freq)) return null;
  const interval = Math.min(99, Math.max(1, Math.round(Number(r.interval)) || 1));
  const until = day(r.until);
  const count = r.count ? (Math.min(999, Math.max(1, Math.round(Number(r.count)) || 0)) || null) : null;
  return { freq: r.freq, interval, until: until || null, count: until ? null : count };
}
function cleanItems(a) {
  if (!Array.isArray(a)) return [];
  return a.slice(0, 100).map((x, i) => ({ id: clip(x && x.id, 40) || ('i' + i + Date.now().toString(36)), text: clip(x && x.text, 200), done: !!(x && x.done) })).filter((x) => x.text);
}
function eventRow(b, me) {
  const row = {
    title: clip(b.title, 200), day: day(b.day), who: WHO.includes(b.who) ? b.who : 'both',
    start_min: mins(b.start_min), tz: tzOf(b.tz, me), note: clip(b.note, 2000), done: !!b.done, updated_at: new Date().toISOString(),
    category: CATS.includes(b.category) ? b.category : 'appointment', location: clip(b.location, 200), color: HEX(b.color),
    remind_min: (b.remind_min === null || b.remind_min === '' || b.remind_min === undefined) ? null : Math.min(20160, Math.max(0, Math.round(Number(b.remind_min)) || 0)),
    rrule: cleanRule(b.rrule), end_day: day(b.end_day),
  };
  if (row.start_min != null) row.end_day = null;
  if (row.end_day && row.day && row.end_day <= row.day) row.end_day = null;
  if (b.dur_min) row.dur_min = Math.min(1440, Math.max(15, Math.round(Number(b.dur_min)) || 60));
  return row;
}

function devBypass() {
  const noPw = !process.env.ADMIN_PASSWORD && !process.env.TIDYHAUS_PASSWORD && !process.env.DOMS_PASSWORD;
  return noPw || ['1', 'true', 'yes', 'on'].includes(String(process.env.ADMIN_DEV_BYPASS || '').toLowerCase());
}
const flagState = () => (process.env.CYCLE_SHARE_OWNER === 'on' ? 'on' : (process.env.CYCLE_SHARE_OWNER ? 'invalid' : 'missing'));
function cycleShare(auth) { return flagState() === 'on' && !auth.owner_view && !devBypass(); }
async function logAccess(db, me, route, auth) {
  if (me !== 'andrew') return;
  try { await db.from('cal_cycle_access_log').insert({ who: 'andrew', route, flag_state: auth.owner_view ? 'view_as' : flagState() }); } catch (_) { /* ignore */ }
}
const notPrivate = (me) => (t) => me === 'jiyah' || t.who !== 'jiyah';
async function privateRow(db, me, id) {
  if (me === 'jiyah' || !id) return false;
  const r = await db.from('cal_tasks').select('who').eq('id', id).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  return !r.data || r.data.who === 'jiyah';
}

export function calendarAllowed(auth) {
  return !!auth && (auth.role === 'owner' || auth.auditor === true);
}

export async function calendarAction(req, res, db, auth, body) {
  if (!calendarAllowed(auth)) return res.status(403).json({ error: 'Not allowed' });
  const op = String((req.method === 'GET' ? req.query.op : (body && body.op)) || '');
  const me = auth.auditor && !auth.owner_view ? 'jiyah' : 'andrew';
  const share = me === 'jiyah' || cycleShare(auth);
  const out = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
  if (req.method === 'GET') {
    if (op === 'search') {
      const q = String(req.query.q || '').trim().replace(/[%,()*\\]/g, ' ').slice(0, 60);
      if (q.length < 2) return res.status(200).json({ tasks: [], trips: [] });
      const [t, tr] = await Promise.all([
        db.from('cal_tasks').select('*').or('title.ilike.%' + q + '%,note.ilike.%' + q + '%,location.ilike.%' + q + '%').order('day', { ascending: false }).limit(100),
        db.from('cal_trips').select('*').or('place.ilike.%' + q + '%,note.ilike.%' + q + '%').order('start_day', { ascending: false }).limit(50),
      ]);
      return res.status(200).json({ tasks: out(t).filter(notPrivate(me)), trips: out(tr) });
    }
    if (op === 'prefs') {
      const r = out(await db.from('cal_prefs').select('prefs').eq('who', me).maybeSingle());
      return res.status(200).json({ who: me, prefs: (r || {}).prefs || {} });
    }
    if (op === 'cycle') { await logAccess(db, me, 'cycle', auth); return cycleAction(req, res, db, me, op, {}, share); }
    if (op !== 'range') return res.status(400).json({ error: 'Bad op' });
    const from = day(req.query.from), to = day(req.query.to);
    if (!from || !to) return res.status(400).json({ error: 'Bad range' });
    const [tasks, series, trips, period, trackers, logs, todos, prefs] = await Promise.all([
      db.from('cal_tasks').select('*').is('rrule', null).gte('day', addDay(from, -400)).lte('day', to).order('start_min', { ascending: true, nullsFirst: true }),
      db.from('cal_tasks').select('*').not('rrule', 'is', null).lte('day', to),
      db.from('cal_trips').select('*').lte('start_day', to).gte('end_day', from).order('start_day'),
      cycleDots(db, me, share),
      db.from('cal_trackers').select('*').order('created_at'),
      db.from('cal_tracker_logs').select('tracker_id, day').gte('day', from).lte('day', to),
      db.from('cal_todos').select('*').order('due_day', { ascending: true, nullsFirst: false }).limit(1000),
      db.from('cal_prefs').select('prefs').eq('who', me).maybeSingle(),
    ]);
    await logAccess(db, me, 'range', auth);
    const ev = out(tasks).filter((t) => (t.end_day || t.day) >= from).concat(out(series)).filter(notPrivate(me));
    return res.status(200).json({
      me, tasks: ev, trips: out(trips), period_days: period.period_days, pred_days: period.pred_days, cyc_remind: period.cyc_remind || null,
      trackers: out(trackers), logs: out(logs), todos: out(todos), prefs: (out(prefs) || {}).prefs || {},
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method' });
  const b = body || {};
  if (op.startsWith('cyc_')) { const r = await cycleAction(req, res, db, me, op, b, share); if (r === null) return res.status(400).json({ error: 'Bad op' }); return r; }
  if (me === 'andrew' && ['task_save', 'task_skip', 'task_exception', 'task_move', 'task_done', 'task_delete'].includes(op)) {
    if (b.id && await privateRow(db, me, b.id)) return res.status(403).json({ error: 'Not allowed' });
    if ((op === 'task_save' || op === 'task_exception') && b.who === 'jiyah') return res.status(403).json({ error: 'Not allowed' });
  }
  switch (op) {
    case 'task_save': {
      const row = eventRow(b, me);
      if (!row.title || !row.day) return res.status(400).json({ error: 'Title and day' });
      const r = b.id ? await db.from('cal_tasks').update(row).eq('id', b.id).select().single()
                     : await db.from('cal_tasks').insert({ ...row, created_by: me }).select().single();
      return res.status(200).json({ task: out(r) });
    }
    case 'task_skip': {
      const d = day(b.occ_day); if (!d || !b.id) return res.status(400).json({ error: 'Bad occurrence' });
      const cur = out(await db.from('cal_tasks').select('exdates').eq('id', b.id).single());
      const ex = Array.from(new Set([...(cur.exdates || []), d])).sort();
      return res.status(200).json({ task: out(await db.from('cal_tasks').update({ exdates: ex, updated_at: new Date().toISOString() }).eq('id', b.id).select().single()) });
    }
    case 'task_exception': {
      const d = day(b.occ_day); const row = eventRow(b, me);
      if (!d || !b.id || !row.title || !row.day) return res.status(400).json({ error: 'Bad occurrence' });
      const cur = out(await db.from('cal_tasks').select('exdates').eq('id', b.id).single());
      const old = cur.exdates || [];
      const ex = Array.from(new Set([...old, d])).sort();
      out(await db.from('cal_tasks').update({ exdates: ex, updated_at: new Date().toISOString() }).eq('id', b.id));
      row.rrule = null;
      const ins = await db.from('cal_tasks').insert({ ...row, series_id: b.id, created_by: me }).select().single();
      if (ins.error) {
        await db.from('cal_tasks').update({ exdates: old }).eq('id', b.id);
        throw new Error(ins.error.message);
      }
      return res.status(200).json({ task: ins.data });
    }
    case 'task_move': {
      const patch = { updated_at: new Date().toISOString() };
      if (b.day !== undefined) { if (!day(b.day)) return res.status(400).json({ error: 'Bad day' }); patch.day = b.day; }
      if (b.end_day !== undefined) patch.end_day = day(b.end_day);
      if (b.start_min !== undefined) { patch.start_min = mins(b.start_min); patch.tz = tzOf(b.tz, me); }
      return res.status(200).json({ task: out(await db.from('cal_tasks').update(patch).eq('id', b.id).select().single()) });
    }
    case 'task_done':
      return res.status(200).json({ task: out(await db.from('cal_tasks').update({ done: !!b.done, updated_at: new Date().toISOString() }).eq('id', b.id).select().single()) });
    case 'task_delete':
      out(await db.from('cal_tasks').delete().eq('id', b.id)); return res.status(200).json({ ok: true });
    case 'trip_save': {
      const row = { who: PEOPLE.includes(b.who) ? b.who : null, place: clip(b.place, 80), start_day: day(b.start_day), end_day: day(b.end_day), note: clip(b.note, 1000) };
      if (!row.who || !row.place || !row.start_day || !row.end_day || row.end_day < row.start_day) return res.status(400).json({ error: 'Check trip' });
      const r = b.id ? await db.from('cal_trips').update(row).eq('id', b.id).select().single() : await db.from('cal_trips').insert(row).select().single();
      return res.status(200).json({ trip: out(r) });
    }
    case 'trip_delete':
      out(await db.from('cal_trips').delete().eq('id', b.id)); return res.status(200).json({ ok: true });
    case 'period_toggle': {
      return res.status(400).json({ error: 'Use the Cycle tab' });
      const d = day(b.day); if (!d) return res.status(400).json({ error: 'Bad day' });
      if (b.on) out(await db.from('cal_period_days').upsert({ day: d }, { onConflict: 'day' }));
      else out(await db.from('cal_period_days').delete().eq('day', d));
      return res.status(200).json({ ok: true });
    }
    case 'tracker_save': {
      const row = { name: clip(b.name, 40), icon: clip(b.icon, 8) || '*', color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#6366f1' };
      if (!row.name) return res.status(400).json({ error: 'Name' });
      const r = b.id ? await db.from('cal_trackers').update(row).eq('id', b.id).select().single() : await db.from('cal_trackers').insert(row).select().single();
      return res.status(200).json({ tracker: out(r) });
    }
    case 'tracker_delete':
      out(await db.from('cal_trackers').delete().eq('id', b.id)); return res.status(200).json({ ok: true });
    case 'log_toggle': {
      const d = day(b.day); if (!d || !b.tracker_id) return res.status(400).json({ error: 'Bad log' });
      if (b.on) out(await db.from('cal_tracker_logs').upsert({ tracker_id: b.tracker_id, day: d }, { onConflict: 'tracker_id,day' }));
      else out(await db.from('cal_tracker_logs').delete().eq('tracker_id', b.tracker_id).eq('day', d));
      return res.status(200).json({ ok: true });
    }
    case 'todo_save': {
      const row = { title: clip(b.title, 200), who: WHO.includes(b.who) ? b.who : 'both', due_day: day(b.due_day), due_min: null,
        tz: tzOf(b.tz, me), note: clip(b.note, 2000), items: cleanItems(b.items), updated_at: new Date().toISOString() };
      if (row.due_day) row.due_min = mins(b.due_min);
      if (b.done !== undefined) row.done = !!b.done;
      if (!row.title) return res.status(400).json({ error: 'Title' });
      const r = b.id ? await db.from('cal_todos').update(row).eq('id', b.id).select().single()
                     : await db.from('cal_todos').insert({ ...row, created_by: me }).select().single();
      return res.status(200).json({ todo: out(r) });
    }
    case 'todo_done':
      return res.status(200).json({ todo: out(await db.from('cal_todos').update({ done: !!b.done, updated_at: new Date().toISOString() }).eq('id', b.id).select().single()) });
    case 'todo_items':
      return res.status(200).json({ todo: out(await db.from('cal_todos').update({ items: cleanItems(b.items), updated_at: new Date().toISOString() }).eq('id', b.id).select().single()) });
    case 'todo_delete':
      out(await db.from('cal_todos').delete().eq('id', b.id)); return res.status(200).json({ ok: true });
    case 'mark_seen': {
      const k = String(b.key || '').replace(/[^a-z0-9_]/gi, '').slice(0, 30);
      if (!k) return res.status(400).json({ error: 'Bad key' });
      const old = out(await db.from('cal_prefs').select('prefs').eq('who', me).maybeSingle());
      const prefs = (old && old.prefs) || {};
      prefs.seen = Object.assign({}, prefs.seen || {}, { [k]: new Date().toISOString() });
      out(await db.from('cal_prefs').upsert({ who: me, prefs, updated_at: new Date().toISOString() }, { onConflict: 'who' }));
      return res.status(200).json({ ok: true });
    }
    case 'prefs_save': {
      const p = b.prefs && typeof b.prefs === 'object' ? b.prefs : {};
      const colors = {};
      Object.keys(p.colors || {}).slice(0, 20).forEach((k) => { if (HEX(p.colors[k])) colors[String(k).slice(0, 20)] = p.colors[k]; });
      const clean = {
        view: ['month', 'week', 'day'].includes(p.view) ? p.view : 'month', weekStart: p.weekStart === 'sun' ? 'sun' : 'mon',
        hidden: Array.isArray(p.hidden) ? p.hidden.map((x) => String(x).slice(0, 20)).slice(0, 20) : [], colors, notify: !!p.notify,
      };
      { const old = out(await db.from('cal_prefs').select('prefs').eq('who', me).maybeSingle()); if (old && old.prefs && old.prefs.seen) clean.seen = old.prefs.seen; }
      out(await db.from('cal_prefs').upsert({ who: me, prefs: clean, updated_at: new Date().toISOString() }, { onConflict: 'who' }));
      return res.status(200).json({ prefs: clean });
    }
    default: return res.status(400).json({ error: 'Bad op' });
  }
}
