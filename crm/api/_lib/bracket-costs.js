// Bracket hardware COST to the business (what the owner pays per bracket,
// after tax and everything). Owner rule 2026-10-08: same for EVERY business
// in EVERY city. Single source of truth for profit math CRM-wide.
// 85"+ large brackets: cost unknown -- they fall into the same flat/tilting/
// full-motion bucket by name (owner to confirm if they cost more).
export const BRACKET_COST = { flat: 26.43, tilt: 26.81, full_motion: 57.01 };

// Customer-supplied / in-the-box (e.g. Frame) brackets cost the business $0.
const FREE_RE = /own bracket|in the box|in-box|customer.?supplied|their own/i;

// Map a line item / widget option name to its per-unit cost (0 if not a bracket).
export function bracketUnitCost(name) {
  const n = String(name || '');
  if (FREE_RE.test(n)) return 0;
  if (/full[\s-]*motion|articulat/i.test(n)) return BRACKET_COST.full_motion;
  if (/\btilt(ing)?\b/i.test(n)) return BRACKET_COST.tilt;
  if (/\b(flat|fixed)\b/i.test(n) && /bracket|mount/i.test(n) || /^\s*flat\s*$/i.test(n)) return BRACKET_COST.flat;
  return 0;
}

// Total bracket cost for a job's line items (quantity-aware).
export function bracketItemsCost(lineItems) {
  let total = 0;
  for (const li of lineItems || []) {
    const c = bracketUnitCost(li && li.name);
    if (c) total += c * (Number(li.quantity) || 1);
  }
  return Math.round(total * 100) / 100;
}
