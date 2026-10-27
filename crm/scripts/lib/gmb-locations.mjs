
export const GMB_LOCATIONS = [];

export const LOCATIONS_BY_KEY = new Map(GMB_LOCATIONS.map((l) => [l.key, l]));

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveLocation({ business, mailbox, displayName } = {}) {
  let pool = GMB_LOCATIONS;
  if (business) pool = pool.filter((l) => l.business === business);
  if (mailbox) {
    const mb = String(mailbox).toLowerCase().trim();
    const byMailbox = pool.filter((l) => (l.notifyEmail || '').toLowerCase() === mb);
    if (byMailbox.length) pool = byMailbox;
  }
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];

  const want = normName(displayName);
  if (!want) return null;

  const exact = pool.filter((l) => normName(l.displayName) === want);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const prefixed = pool
    .filter((l) => want.startsWith(normName(l.displayName)))
    .sort((a, b) => normName(b.displayName).length - normName(a.displayName).length);
  return prefixed.length ? prefixed[0] : null;
}

export function notificationMailboxes() {
  const seen = new Map();
  for (const l of GMB_LOCATIONS) {
    if (!l.notifyEmail) continue;
    if (!seen.has(l.notifyEmail)) {
      seen.set(l.notifyEmail, { email: l.notifyEmail, env: l.mailboxEnv, locations: [] });
    }
    seen.get(l.notifyEmail).locations.push(l.name);
  }
  return [...seen.values()];
}
