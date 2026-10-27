import { localDateStartUTC, addDaysStr } from './time.js';

export const AUTO_COUNT_FROM = '2026-09-22';
const TZ = 'Asia/Manila';

export async function callDayRows(db, from, to) {
  const out = [];
  if (from < AUTO_COUNT_FROM) {
    const upto = to < AUTO_COUNT_FROM ? to : addDaysStr(AUTO_COUNT_FROM, -1);
    const { data } = await db.from('call_audit_days')
      .select('audit_date, grasshopper_number, calls_counted')
      .gte('audit_date', from).lte('audit_date', upto);
    out.push(...(data || []));
  }
  if (to >= AUTO_COUNT_FROM) {
    const start = from > AUTO_COUNT_FROM ? from : AUTO_COUNT_FROM;
    const { data } = await db.from('calls')
      .select('id, occurred_at, grasshopper_number')
      .eq('kind', 'inbound')
      .eq('answered', true)
      .gte('occurred_at', localDateStartUTC(TZ, start).toISOString())
      .lt('occurred_at', localDateStartUTC(TZ, addDaysStr(to, 1)).toISOString())
      .limit(20000);
    const ids = (data || []).map((c) => c.id);
    const skipped = new Set();
    for (let i = 0; i < ids.length; i += 150) {
      const { data: sk } = await db.from('audit_skips').select('call_id').in('call_id', ids.slice(i, i + 150));
      for (const r of (sk || [])) skipped.add(r.call_id);
    }
    const agg = {};
    for (const c of (data || [])) {
      if (!c.grasshopper_number || skipped.has(c.id)) continue;
      const d = new Date(c.occurred_at).toLocaleDateString('en-CA', { timeZone: TZ });
      const k = d + '|' + c.grasshopper_number;
      agg[k] = (agg[k] || 0) + 1;
    }
    for (const [k, n] of Object.entries(agg)) {
      const [audit_date, grasshopper_number] = k.split('|');
      out.push({ audit_date, grasshopper_number, calls_counted: n });
    }
    for (let d = start; d <= to; d = addDaysStr(d, 1)) {
      if (!out.some((r) => r.audit_date === d)) out.push({ audit_date: d, grasshopper_number: null, calls_counted: 0 });
    }
  }
  return out;
}
