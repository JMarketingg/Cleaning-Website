export function cleanAdClick(v) {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {}; let n = 0;
  ['gclid', 'gbraid', 'wbraid', 'gad_campaignid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term'].forEach(k => {
    if (typeof v[k] === 'string' && v[k] && v[k].length <= 200) { out[k] = v[k]; n++; }
  });
  if (n && typeof v.lp === 'string') out.lp = v.lp.slice(0, 200);
  if (n && Number.isFinite(Number(v.t))) out.t = Number(v.t);
  return n ? out : null;
}
