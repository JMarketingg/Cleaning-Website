export function capName(s) {
  if (s == null) return s;
  return String(s).replace(/(^|[\s\-'’(])([a-zà-þ])/g, (m, pre, ch) => pre + ch.toUpperCase());
}
