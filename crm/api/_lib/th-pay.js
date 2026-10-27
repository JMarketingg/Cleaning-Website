// Cleaner pay: a share of each finished cleaning (with a minimum per job), plus tips.
// Rules live in app.widget_prices section 'pay' (Other -> Cleaning Prices).
const TZ = 'Asia/Manila';

export function weekStartOf(dateStr) {
  const d = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T12:00:00+08:00') : new Date();
  const local = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
  const back = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - back);
  return local.toLocaleDateString('en-CA');
}

async function payRules(db) {
  const { data } = await db.from('widget_prices').select('city_key, option_id, price').eq('section_key', 'pay');
  const rules = {};
  for (const r of data || []) (rules[r.city_key] = rules[r.city_key] || {})[r.option_id] = Number(r.price) || 0;
  return rules;
}
const areaKey = (name) => (/bgc|taguig/i.test(name || '') ? 'bgc' : 'makati');

export async function weekPay(db, weekStart, techId = null) {
  const lo = new Date(weekStart + 'T00:00:00+08:00');
  const hi = new Date(lo.getTime() + 7 * 86400000);
  const rules = await payRules(db);
  let q = db.from('bookings')
    .select('id, price, tip, completed_at, scheduled_at, technician_id, secondary_technician_id, customer:customers ( name ), service:services ( name ), area:service_areas ( name ), primary:technicians!bookings_technician_id_fkey ( id, name ), second:technicians!bookings_secondary_technician_id_fkey ( id, name )')
    .eq('status', 'completed').gte('completed_at', lo.toISOString()).lt('completed_at', hi.toISOString()).order('completed_at');
  if (techId) q = q.or(`technician_id.eq.${techId},secondary_technician_id.eq.${techId}`);
  const { data, error } = await q;
  if (error) throw error;
  const people = new Map();
  for (const b of data || []) {
    const crew = [b.primary, b.second].filter(Boolean);
    if (!crew.length) continue;
    const r = rules[areaKey(b.area?.name)] || rules.makati || { percent: 40, minimum: 0 };
    const share = Math.max((Number(b.price) || 0) * (r.percent || 0) / 100, r.minimum || 0) / crew.length;
    const tip = (Number(b.tip) || 0) / crew.length;
    for (const t of crew) {
      if (techId && t.id !== techId) continue;
      if (!people.has(t.id)) people.set(t.id, { technician_id: t.id, name: t.name, jobs: [], pay: 0, tips: 0 });
      const p = people.get(t.id);
      p.jobs.push({ id: b.id, when: b.completed_at, customer: b.customer?.name || 'Customer', service: b.service?.name || 'Cleaning', price: Number(b.price) || 0, pay: Math.round(share), tip: Math.round(tip), shared: crew.length > 1 });
      p.pay += share; p.tips += tip;
    }
  }
  const { data: paid } = await db.from('cleaner_payouts').select('technician_id, amount, method, created_at').eq('week_start', weekStart);
  const paidBy = Object.fromEntries((paid || []).map((x) => [x.technician_id, x]));
  const list = [...people.values()].map((p) => ({ ...p, pay: Math.round(p.pay), tips: Math.round(p.tips), total: Math.round(p.pay + p.tips), paid: paidBy[p.technician_id] || null }));
  list.sort((a, b) => b.total - a.total);
  return { week_start: weekStart, week_end: new Date(hi.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: TZ }), rules, cleaners: list,
    total: list.reduce((t, p) => t + p.total, 0) };
}
