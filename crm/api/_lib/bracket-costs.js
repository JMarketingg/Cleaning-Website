export const BRACKET_COST = { flat: 26.43, tilt: 26.81, full_motion: 57.01 };

const FREE_RE = /own bracket|in the box|in-box|customer.?supplied|their own/i;

export function bracketUnitCost(name) {
  const n = String(name || '');
  if (FREE_RE.test(n)) return 0;
  if (/full[\s-]*motion|articulat/i.test(n)) return BRACKET_COST.full_motion;
  if (/\btilt(ing)?\b/i.test(n)) return BRACKET_COST.tilt;
  if (/\b(flat|fixed)\b/i.test(n) && /bracket|mount/i.test(n) || /^\s*flat\s*$/i.test(n)) return BRACKET_COST.flat;
  return 0;
}

export function bracketItemsCost(lineItems) {
  let total = 0;
  for (const li of lineItems || []) {
    const c = bracketUnitCost(li && li.name);
    if (c) total += c * (Number(li.quantity) || 1);
  }
  return Math.round(total * 100) / 100;
}
