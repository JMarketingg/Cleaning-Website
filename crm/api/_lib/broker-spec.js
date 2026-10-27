
export const BROKER_SECTIONS = [
  { key: 'size',    label: 'TV size',          prefixes: ['tv size', 'size'] },
  { key: 'bracket', label: 'Bracket',          prefixes: ['bracket'] },
  { key: 'wires',   label: 'Wire concealment', prefixes: ['wire hiding', 'wires', 'wire'] },
];

export function brokerNorm(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s) { return new Set(brokerNorm(s).split(' ').filter(Boolean)); }

export function brokerSimilarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function brokerBestMatch(text, options) {
  if (!text) return null;
  const flat = brokerNorm(text).replace(/ /g, '');
  const exact = (options || []).find(o => brokerNorm(o.label).replace(/ /g, '') === flat);
  if (exact) return exact;
  let best = null, bestScore = 0;
  for (const o of (options || [])) {
    const s = brokerSimilarity(text, o.label);
    if (s > bestScore) { bestScore = s; best = o; }
  }
  return bestScore >= 0.4 ? best : null;
}

export function brokerValueFor(section, lineItems) {
  for (const it of (Array.isArray(lineItems) ? lineItems : [])) {
    const desc = String((it && it.description) || '');
    const idx = desc.indexOf(':');
    if (idx < 0) continue;
    const head = brokerNorm(desc.slice(0, idx));
    if (section.prefixes.some(p => head === brokerNorm(p))) return desc.slice(idx + 1).trim();
  }
  return null;
}

export function brokerResolveSpec(est, catalog) {
  const saved = (est && est.broker_spec && typeof est.broker_spec === 'object') ? est.broker_spec : {};
  const items = (est && est.line_items) || [];
  const spec = {};
  for (const s of BROKER_SECTIONS) {
    const options = (catalog && catalog[s.key]) || [];
    if (saved[s.key] && options.some(o => o.row_key === saved[s.key])) { spec[s.key] = saved[s.key]; continue; }
    const hit = brokerBestMatch(brokerValueFor(s, items), options);
    spec[s.key] = hit ? hit.row_key : null;
  }
  spec.custom = normalizeCustomLines(saved.custom);
  return spec;
}

export const MAX_CUSTOM_LINES = 8;

export function normalizeCustomLines(raw) {
  const out = [];
  const seen = new Set();
  for (const item of (Array.isArray(raw) ? raw : [])) {
    const label = String((item && item.label) || '').trim().slice(0, 120);
    if (!label) continue;
    let id = String((item && item.id) || '').trim().slice(0, 40);
    if (!id || seen.has(id)) {
      let n = out.length + 1;
      do { id = `custom_${n++}`; } while (seen.has(id));
    }
    seen.add(id);
    out.push({ id, label });
    if (out.length >= MAX_CUSTOM_LINES) break;
  }
  return out;
}

export function customLinesOf(spec) {
  return normalizeCustomLines(spec && spec.custom);
}

export function brokerRequiredLines(spec) {
  const fixed = BROKER_SECTIONS.map(s => ({ key: s.key, label: s.label, custom: false, row_key: (spec && spec[s.key]) || null }));
  const custom = customLinesOf(spec).map(c => ({ key: c.id, label: c.label, custom: true, row_key: c.id }));
  return fixed.concat(custom);
}

export function brokerQuoteLineItems(serviceLabel, sellPrice) {
  return [{
    description: serviceLabel || 'Scheduled service',
    qty: 1,
    unit_price: sellPrice,
    broker: true,
  }];
}
