import { coveredSlugsFor, loadCoverageOverrides } from './staff-access.js';
import { toE164 } from './sms.js';

const JOEY_FALLBACK = '0000000000';
const EXCLUDE = new Set(['jiyah']);

function covers(home, slug, name) {
  const c = coveredSlugsFor({ name, scope: home });
  return c === null || c.includes(slug);
}

export async function leadAlertRecipients(db, slug) {
  const out = new Map();
  const add = (name, raw) => {
    const p = toE164(raw || '');
    if (p && !out.has(p)) out.set(p, { name, phone: p });
  };
  try {
    let [{ data: users, error: uErr }, { data: bizs, error: bErr }] = await Promise.all([
      db.from('staff_users').select('name, phone, role, active, business_id, covered_businesses').eq('active', true).eq('role', 'secretary'),
      db.from('businesses').select('id, slug'),
    ]);
    if (uErr && /covered_businesses/.test(uErr.message || '')) {
      ({ data: users, error: uErr } = await db.from('staff_users').select('name, phone, role, active, business_id').eq('active', true).eq('role', 'secretary'));
    }
    if (uErr) throw uErr;
    await loadCoverageOverrides(db, true);
    if (bErr) throw bErr;
    const slugById = new Map((bizs || []).map((b) => [b.id, b.slug]));
    for (const u of users || []) {
      const name = String(u.name || '');
      if (EXCLUDE.has(name.toLowerCase())) continue;
      if (name === 'Joey') { add(name, u.phone); continue; }
      const home = slugById.get(u.business_id);
      if (home && covers(home, slug, name)) add(name, u.phone);
    }
  } catch (e) {
    console.error('[lead-alert] staff lookup failed, falling back to env:', e.message);
    if (covers('tidyhaus', slug, 'Heather')) add('Heather', process.env.HEATHER_PHONE_NUMBER || process.env.TIDYHAUS_SECRETARY_PHONE);
  }
  if (![...out.values()].some((r) => r.name === 'Joey')) add('Joey', process.env.DOMS_SECRETARY_PHONE || JOEY_FALLBACK);
  return [...out.values()];
}
