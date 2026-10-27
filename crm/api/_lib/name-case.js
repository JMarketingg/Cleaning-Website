// Capitalize the first letter of each name word (owner 2026-10-11).
// Also after hyphens and apostrophes: o'brien -> O'Brien, mary-jane -> Mary-Jane.
// Never lowercases anything, so McDonald stays McDonald.
export function capName(s) {
  if (s == null) return s;
  return String(s).replace(/(^|[\s\-'’(])([a-zà-þ])/g, (m, pre, ch) => pre + ch.toUpperCase());
}
