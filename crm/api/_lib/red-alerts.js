import { allowedSlugsFor, isAllCoverage, weeklyScheduleFor, coverageOverrideFor, SECRETARY_EXTRA_BUSINESSES, groupSlugs, targetedToday } from './staff-access.js';
import { pipelineCallTarget, phone10 } from './pipeline.js';
import { localDayStartUTC, localDateTimeUTC } from './time.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STEP_ID = /^[a-z0-9_-]{1,40}$/i;
export const RED_ALERT_TZS = ['Asia/Manila', 'Asia/Manila', 'Asia/Manila', 'Asia/Manila', 'Asia/Manila'];
const MAX_STEPS = 12;
const MAX_INFO = 8;

function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }
const ownerOf = (auth) => auth && auth.role === 'owner';
const meOf = (auth) => String((auth && auth.name) || (ownerOf(auth) ? 'Owner' : 'Office')).slice(0, 40);
const newStepId = () => 's' + Math.random().toString(36).slice(2, 10);

let BIZ = null; let bizAt = 0;
async function bizMap(db) {
  if (BIZ && Date.now() - bizAt < 600000) return BIZ;
  const { data, error } = await db.from('businesses').select('id, slug, name, timezone');
  if (error) throw error;
  BIZ = new Map((data || []).map((b) => [b.slug, b])); bizAt = Date.now();
  return BIZ;
}

export function canSeeRedAlert(auth, a) {
  if (!auth || !a) return false;
  if (ownerOf(auth)) return true;
  if (auth.role !== 'secretary') return false;
  const targets = (a.targets || []).map((t) => String(t).toLowerCase());
  if (targets.length) return targetedToday(auth, a.targets, a.business_slug);
  const allowed = allowedSlugsFor(auth);
  return allowed === null || allowed.includes(a.business_slug);
}

function coversAnyDay(name, home, slug) {
  if (isAllCoverage(name)) return true;
  const w = weeklyScheduleFor(name);
  if (w && w.size) { for (const g of w.values()) if (groupSlugs(g).includes(slug)) return true; return false; }
  const extra = coverageOverrideFor(name) || SECRETARY_EXTRA_BUSINESSES[home] || [];
  return home === slug || extra.includes(slug);
}
async function secretaries(db) {
  const [{ data: staff, error }, biz] = await Promise.all([
    db.from('staff_users').select('name, business_id').eq('role', 'secretary').eq('active', true).order('name'),
    bizMap(db),
  ]);
  if (error) throw error;
  const slugById = new Map([...biz.values()].map((b) => [b.id, b.slug]));
  return (staff || []).filter((s) => s.name).map((s) => ({ name: String(s.name), home: slugById.get(s.business_id) || null }));
}
async function defaultTargets(db, slug) {
  const list = await secretaries(db);
  const out = list.filter((s) => coversAnyDay(s.name, s.home, slug)).map((s) => s.name);
  if (!out.includes('Joey')) out.push('Joey');
  return out;
}

function shape(r, biz) {
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const done = steps.filter((s) => s && s.done_by);
  const allDoneAt = steps.length && done.length === steps.length
    ? done.map((s) => s.done_at).filter(Boolean).sort().slice(-1)[0] || r.updated_at
    : null;
  const b = biz.get(r.business_slug);
  return {
    id: r.id, business_slug: r.business_slug, business_name: (b && b.name) || r.business_slug,
    title: r.title, body: r.body || '', targets: r.targets || [], steps, info: r.info || [],
    tz: r.tz || 'Asia/Manila', rev: r.rev || 0, created_by: r.created_by || null, created_at: r.created_at,
    closed_at: r.closed_at || null, closed_by: r.closed_by || null,
    done_count: done.length, step_count: steps.length, all_done_at: allDoneAt,
  };
}

async function loadOne(db, id) {
  if (!UUID.test(String(id || ''))) throw httpErr(400, 'Bad alert id');
  const { data, error } = await db.from('red_alerts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

function cleanSteps(input, tz, prevSteps) {
  if (input == null) return [];
  if (!Array.isArray(input)) throw httpErr(400, 'Steps must be a list');
  const prevById = new Map((prevSteps || []).filter((s) => s && s.id).map((s) => [s.id, s]));
  const used = new Set();
  const out = [];
  for (const raw of input.slice(0, MAX_STEPS)) {
    if (!raw || typeof raw !== 'object') continue;
    const text = String(raw.text || '').trim().slice(0, 300);
    if (!text) continue;
    const n = out.length + 1;
    let phone = null;
    if (raw.phone != null && String(raw.phone).trim() !== '') {
      const d = String(raw.phone).replace(/\D/g, '');
      phone = d.length === 11 && d[0] === '1' ? d.slice(1) : (d.length === 10 ? d : '');
      if (!phone) throw httpErr(400, `Step ${n}: phone must be a 10-digit US number`);
    }
    let dueAt = null;
    if (raw.due_local) {
      const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(raw.due_local));
      if (!m) throw httpErr(400, `Step ${n}: bad due time`);
      dueAt = localDateTimeUTC(tz, m[1], m[2]).toISOString();
    } else if (raw.due_at) {
      const t = Date.parse(raw.due_at);
      if (!Number.isFinite(t)) throw httpErr(400, `Step ${n}: bad due time`);
      dueAt = new Date(t).toISOString();
    }
    const want = String(raw.id || '');
    const id = STEP_ID.test(want) && prevById.has(want) && !used.has(want) ? want : newStepId();
    used.add(id);
    const prev = prevById.get(id);
    out.push({
      id, text, phone, due_at: dueAt, needs_prev: n > 1 && !!raw.needs_prev,
      done_by: (prev && prev.done_by) || null, done_at: (prev && prev.done_at) || null,
    });
  }
  return out;
}
function cleanInfo(input) {
  const list = Array.isArray(input) ? input : String(input || '').split('\n');
  return list.map((s) => String(s || '').trim().slice(0, 300)).filter(Boolean).slice(0, MAX_INFO);
}
async function cleanFields(db, body) {
  const slug = String(body.business || body.business_slug || '').trim();
  const biz = await bizMap(db);
  if (!biz.has(slug)) throw httpErr(400, 'Pick a business');
  const title = String(body.title || '').trim().slice(0, 140);
  if (!title) throw httpErr(400, 'Title is required');
  const text = String(body.body || '').trim().slice(0, 2000) || null;
  const tz = RED_ALERT_TZS.includes(body.tz) ? body.tz : ((biz.get(slug) || {}).timezone || 'Asia/Manila');
  let targets = Array.isArray(body.targets) ? [...new Set(body.targets.map((t) => String(t || '').trim().slice(0, 40)).filter(Boolean))].slice(0, 12) : [];
  if (!targets.length) targets = await defaultTargets(db, slug);
  return { business_slug: slug, title, body: text, tz, targets, info: cleanInfo(body.info) };
}

export async function redAlertsAction(req, res, db, auth, body) {
  const isOwner = ownerOf(auth);
  const me = meOf(auth);
  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      if (q.targets_for) {
        if (!isOwner) return res.status(403).json({ error: 'Owner only' });
        const slug = String(q.targets_for);
        const [targets, staff] = await Promise.all([defaultTargets(db, slug), secretaries(db)]);
        return res.status(200).json({ targets, secretaries: staff.map((s) => s.name) });
      }
      const all = isOwner && q.all === '1';
      let sel = db.from('red_alerts').select('*').order('created_at', { ascending: false }).limit(all ? 40 : 30);
      if (!all) sel = sel.is('closed_at', null);
      const { data, error } = await sel;
      if (error) throw error;
      const biz = await bizMap(db);
      const alerts = [];
      for (const r of data || []) {
        if (!canSeeRedAlert(auth, r)) continue;
        const a = shape(r, biz);
        if (!all && a.all_done_at && Date.parse(a.all_done_at) < localDayStartUTC(a.tz).getTime()) continue;
        alerts.push(a);
      }
      if (!all) alerts.sort((x, y) => (!!x.all_done_at - !!y.all_done_at) || String(x.created_at).localeCompare(String(y.created_at)));
      return res.status(200).json({ alerts, owner: isOwner, me });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const op = String(body.op || '');

    if (op === 'step') {
      const row = await loadOne(db, body.id);
      if (!row || !canSeeRedAlert(auth, row)) return res.status(404).json({ error: 'Alert not found' });
      if (row.closed_at) return res.status(410).json({ error: 'This alert was closed' });
      const stepId = String(body.step_id || '');
      if (!STEP_ID.test(stepId)) return res.status(400).json({ error: 'Bad step' });
      const done = body.done !== false;
      const { data: r, error } = await db.rpc('red_alert_step', { p_alert: row.id, p_step: stepId, p_by: me, p_done: done, p_owner: isOwner });
      if (error) throw error;
      const fresh = shape((await loadOne(db, row.id)) || row, await bizMap(db));
      const out = r || {};
      if (out.ok) return res.status(200).json({ ok: true, done_by: out.done_by || null, done_at: out.done_at || null, alert: fresh });
      const why = {
        already: [409, `${out.done_by || 'Someone'} already did this`],
        locked: [409, 'Finish the step before this one first'],
        gone: [410, 'This alert was closed'],
        no_step: [404, 'That step is gone (the owner edited the alert)'],
        not_yours: [403, `Only ${out.done_by || 'whoever marked it'} or Owner can undo this`],
      }[out.reason] || [409, 'Could not update that step'];
      return res.status(why[0]).json({ error: why[1], reason: out.reason || null, done_by: out.done_by || null, done_at: out.done_at || null, alert: fresh });
    }

    if (!isOwner) return res.status(403).json({ error: 'Owner only' });

    if (op === 'create') {
      const f = await cleanFields(db, body);
      const steps = cleanSteps(body.steps, f.tz, null);
      if (!steps.length && !f.info.length && !f.body) return res.status(400).json({ error: 'Add at least one step' });
      const { data, error } = await db.from('red_alerts').insert({ ...f, steps, created_by: me }).select('*').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, alert: shape(data, await bizMap(db)) });
    }

    if (op === 'update') {
      const f = await cleanFields(db, body);
      for (let i = 0; i < 4; i++) {
        const row = await loadOne(db, body.id);
        if (!row) return res.status(404).json({ error: 'Alert not found' });
        const steps = cleanSteps(body.steps, f.tz, row.steps);
        const { data, error } = await db.from('red_alerts')
          .update({ ...f, steps, rev: (row.rev || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', row.id).eq('rev', row.rev || 0).select('*');
        if (error) throw error;
        if (data && data.length) return res.status(200).json({ ok: true, alert: shape(data[0], await bizMap(db)) });
      }
      return res.status(409).json({ error: 'Someone was updating it at the same moment. Try again.' });
    }

    if (op === 'close') {
      const row = await loadOne(db, body.id);
      if (!row) return res.status(404).json({ error: 'Alert not found' });
      const { error } = await db.from('red_alerts')
        .update({ closed_at: new Date().toISOString(), closed_by: me, rev: (row.rev || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id).is('closed_at', null);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown op' });
  } catch (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
}

export async function redAlertCallTarget(db, auth, alertId, stepId) {
  const a = await loadOne(db, alertId);
  if (!a || a.closed_at || !canSeeRedAlert(auth, a)) throw httpErr(404, 'Alert not found');
  const s = (Array.isArray(a.steps) ? a.steps : []).find((x) => x && x.id === String(stepId || ''));
  const phone = s ? phone10(s.phone) : '';
  if (!phone) throw httpErr(400, 'This step has no number to call');
  const biz = await bizMap(db);
  const bizId = (biz.get(a.business_slug) || {}).id || null;
  try {
    const t = await pipelineCallTarget(db, auth, phone, a.business_slug);
    return { phone, line: t.line, businessId: t.businessId || bizId };
  } catch (e) {
    if (e.status !== 404 && e.status !== 403) throw e;
  }
  const { data: lines, error } = await db.from('tracking_numbers').select('phone, active, forward_to, created_at')
    .eq('business_slug', a.business_slug).order('created_at');
  if (error) throw error;
  const tollFree = phone10(process.env.TWILIO_PHONE_NUMBER || '');
  const l = (lines || []).find((x) => x.active !== false && x.forward_to && phone10(x.phone) && phone10(x.phone) !== tollFree);
  const line = l ? phone10(l.phone) : tollFree;
  if (!line) throw httpErr(500, 'No line to call from');
  return { phone, line, businessId: bizId };
}
