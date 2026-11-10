// Which parts of a date are already taken, so the booking form only offers start times that fit.
// We have 1 team. Jobs in the CRM hold their time. A request holds its time when it is booked, or is new/contacted and less than
// 2 days old (so two people can't grab the same time while the owner confirms).
// Settings (Vercel environment variables): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const HOLD_MS = 2 * 24 * 60 * 60 * 1000;

function minutes(h, m, ampm) {
  return ((Number(h) % 12) + (ampm.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m);
}

// Reads "9:00 AM to 12:00 PM (about 3 hours)" into [start, end] minutes after midnight.
// Older requests used "Morning" and "Afternoon".
function rangeOf(time) {
  const t = String(time || '');
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (m) return [minutes(m[1], m[2], m[3]), minutes(m[4], m[5], m[6])];
  if (/morning/i.test(t)) return [8 * 60, 12 * 60];
  if (/afternoon/i.test(t)) return [13 * 60, 17 * 60];
  return null;
}

module.exports = async function handler(req, res) {
  const date = String((req.query || {}).date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Use ?date=YYYY-MM-DD' });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({ date, busy: [] });

  const url = `${SUPABASE_URL}/rest/v1/quote_requests?select=preferred_time,status,created_at` +
    `&preferred_date=eq.${date}&status=in.(new,contacted,booked)`;
  try {
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Accept-Profile': 'app' }
    });
    if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
    const now = Date.now();
    const busy = [];
    for (const row of await r.json()) {
      const range = rangeOf(row.preferred_time);
      const holding = row.status === 'booked' || now - new Date(row.created_at).getTime() < HOLD_MS;
      if (range && holding) busy.push(range);
    }
    // Jobs already in the CRM (for example the next visit of a regular customer).
    const from = new Date(`${date}T00:00:00+08:00`).toISOString(), to = new Date(`${date}T23:59:59+08:00`).toISOString();
    const jr = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=scheduled_at,scheduled_end,duration_minutes,status` +
      `&scheduled_at=gte.${from}&scheduled_at=lte.${to}&status=not.in.(cancelled,no_show)`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Accept-Profile': 'app' }
    });
    if (jr.ok) {
      const mins = (t) => { const d = new Date(new Date(t).getTime() + 8 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
      for (const j of await jr.json()) {
        const start = mins(j.scheduled_at);
        const end = j.scheduled_end ? mins(j.scheduled_end) : start + (Number(j.duration_minutes) || 180);
        busy.push([start, end]);
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ date, busy });
  } catch (e) {
    // If the CRM can't be reached, show every time as open rather than blocking bookings.
    console.error(e);
    return res.status(200).json({ date, busy: [] });
  }
};
