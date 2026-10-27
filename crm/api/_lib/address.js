
export function isLikelyStreetAddress(s) {
  const a = String(s || '').trim();
  if (a.length < 5) return false;
  if (/@/.test(a)) return false;
  if (!/[a-z]/i.test(a)) return false;
  if (!/\d/.test(a)) return false;
  return true;
}

export function hasDigits(s) {
  return /\d/.test(String(s || ''));
}

export function formatAddress(b) {
  if (!b) return '';
  const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const l1 = String(b.address_line1 || '').trim();
  const l2 = String(b.address_line2 || '').trim();
  const city = String(b.city || '').trim();
  const st = String(b.state || '').trim();
  const zip = String(b.postal_code || '').trim();
  const inL1 = (part) => !!part && new RegExp('\\b' + esc(part) + '\\b', 'i').test(l1);

  const parts = [];
  if (l1) parts.push(l1);
  if (l2) parts.push(l2);
  if (inL1(city) && inL1(st)) {
    if (zip && !inL1(zip)) parts.push(zip);
  } else {
    const tail = [city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (tail) parts.push(tail);
  }
  return parts.join(', ');
}
