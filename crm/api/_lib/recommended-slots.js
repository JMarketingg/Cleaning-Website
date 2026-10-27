const TTL_MS = 12 * 3600 * 1000;
const COUNTED = ['s1', 's2', 's3', 's4'];
const SEED = ['1:s1', '6:s4', '4:s4', '0:s4'];
let cache = { keys: SEED, at: 0 };
let inflight = null;

function slotForHour(h) {
  if (h === 7 || h === 8) return 's1';
  if (h === 10 || h === 11) return 's2';
  if (h === 13 || h === 14) return 's3';
  if (h === 16 || h === 17) return 's4';
  return null;
}
const dowIdx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

async function compute(db) {
  const { data: biz, error: be } = await db.from('businesses').select('id, timezone');
  if (be) throw be;
  const tzOf = new Map((biz || []).map(b => [b.id, b.timezone || 'Asia/Manila']));
  const from = new Date(Date.now() - 90 * 86400000).toISOString();
  const counts = new Map();
  for (let d = 0; d < 7; d++) for (const k of COUNTED) counts.set(d + ':' + k, 0);
  let offset = 0;
  for (;;) {
    const { data, error } = await db.from('bookings').select('business_id, scheduled_at, status, source')
      .gte('scheduled_at', from).not('status', 'in', '(cancelled,no_show)')
      .range(offset, offset + 999);
    if (error) throw error;
    for (const b of data || []) {
      if (b.source === 'import' || !b.scheduled_at) continue;
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tzOf.get(b.business_id) || 'Asia/Manila', weekday: 'short', hour: '2-digit', hour12: false })
        .formatToParts(new Date(b.scheduled_at)).reduce((a, x) => (a[x.type] = x.value, a), {});
      const k = slotForHour(Number(p.hour) % 24);
      if (!k) continue;
      const key = dowIdx[p.weekday] + ':' + k;
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    }
    if (!data || data.length < 1000) break;
    offset += 1000;
  }
  return [...counts.entries()].sort((a, b) => a[1] - b[1]).slice(0, 4).map(e => e[0]);
}

export async function recommendedSlots(db) {
  if (Date.now() - cache.at < TTL_MS) return cache.keys;
  if (!inflight) inflight = compute(db)
    .then(keys => { if (keys.length) cache = { keys, at: Date.now() }; })
    .catch(e => { console.warn('[recommended_slots]', e.message); cache = { keys: cache.keys, at: Date.now() - TTL_MS + 600000 }; })
    .finally(() => { inflight = null; });
  await inflight;
  return cache.keys;
}
export function isRecommended(keys, dow, slotKey) { return (keys || []).includes(dow + ':' + slotKey); }
