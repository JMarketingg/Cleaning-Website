// Which morning/afternoon slots are already taken on a date, so the quote form can grey them out.
// A slot holds 1 cleaning. It counts as taken when a request for it is booked, or is new/contacted
// and less than 2 days old (so two people can't grab the same slot while the owner confirms).
// Settings (Vercel environment variables): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const SLOT_CAPACITY = 1;
const HOLD_MS = 2 * 24 * 60 * 60 * 1000;

function slotOf(time) {
  const t = String(time || '').toLowerCase();
  if (t.includes('morning')) return 'morning';
  if (t.includes('afternoon')) return 'afternoon';
  return null;
}

module.exports = async function handler(req, res) {
  const date = String((req.query || {}).date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Use ?date=YYYY-MM-DD' });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({ date, taken: [] });

  const url = `${SUPABASE_URL}/rest/v1/quote_requests?select=preferred_time,status,created_at` +
    `&preferred_date=eq.${date}&status=in.(new,contacted,booked)`;
  try {
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Accept-Profile': 'app' }
    });
    if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
    const counts = { morning: 0, afternoon: 0 };
    const now = Date.now();
    for (const row of await r.json()) {
      const slot = slotOf(row.preferred_time);
      if (!slot) continue;
      const holding = row.status === 'booked' || now - new Date(row.created_at).getTime() < HOLD_MS;
      if (holding) counts[slot] += 1;
    }
    const taken = Object.keys(counts).filter((s) => counts[s] >= SLOT_CAPACITY);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ date, taken });
  } catch (e) {
    // If the CRM can't be reached, show every slot as open rather than blocking bookings.
    console.error(e);
    return res.status(200).json({ date, taken: [] });
  }
};
