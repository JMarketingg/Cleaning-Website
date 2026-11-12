// Small helper for reading and writing the CRM database (Supabase, schema "app").
// The underscore keeps Vercel from treating this file as an API route.
function headers(extra) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'app', 'Content-Profile': 'app', 'Content-Type': 'application/json', ...(extra || {}) };
}
async function crm(path, opts = {}) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: headers(opts.headers) });
  if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
module.exports = { crm };
