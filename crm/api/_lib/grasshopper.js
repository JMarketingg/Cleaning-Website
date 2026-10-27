
export const GRASSHOPPER_LINES = {};

export function digitsOf(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}
export function prettyPhone(s) {
  const d = digitsOf(s);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(s || '').trim();
}
