// One-off date overrides of the weekly staff_schedules (migration 0197).
// business_slug null = off that date; slug = works that group that date.
// Only the row for the date asked about is ever used, so it expires by itself.
export function dateIn(tz, now = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { return now.toISOString().slice(0, 10); }
}
export async function exceptionsOn(db, dateStr) {
  try {
    const { data, error } = await db.from('staff_schedule_exceptions').select('name, on_date, business_slug, phone, priority').eq('on_date', dateStr);
    if (error) throw error;
    return data || [];
  } catch (e) { console.warn('[schedule-exceptions] read failed, using weekly only:', e.message); return []; }
}
// rows: weekly staff_schedules rows for one group+day. Drops anyone with an
// exception that date, adds those whose exception puts them on this group.
export function applyExceptions(rows, exc, slug) {
  const names = new Set((exc || []).map(e => String(e.name).toLowerCase()));
  const kept = (rows || []).filter(r => !names.has(String(r.name).toLowerCase()));
  const added = (exc || []).filter(e => e.business_slug && e.business_slug === slug).map(e => ({ name: e.name, phone: e.phone, priority: e.priority }));
  return [...kept, ...added].sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || String(a.name).localeCompare(String(b.name)));
}
