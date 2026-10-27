// ============================================================================
// Who gets texted when a new lead / quote / estimate request comes in.
// Owner rules, 2026-10-08:
//   - every active secretary whose coverage includes that business TODAY
//     (Alex/Joe: only on their working days, that day's group)
//     (staff-access.js coveredSlugsFor: owner's per-person edit, else the seed map)
//   - Joey ALWAYS, for every business
//   - NOT the owner ("I no longer need to be notified for estimates")
// Never the auditor (Jiyah) or techs: only role='secretary' rows count.
// Returns E.164 phones, deduped. Never empty while Joey has a phone.
// ============================================================================
import { coveredSlugsFor, loadCoverageOverrides } from './staff-access.js';
import { toE164 } from './sms.js';

const JOEY_FALLBACK = '3032190118';
const EXCLUDE = new Set(['jiyah']);

// Same coverage rule as dashboard access (staff-access.js coveredSlugsFor).
function covers(home, slug, name) {
  const c = coveredSlugsFor({ name, scope: home });
  return c === null || c.includes(slug);
}

// -> [{ name, phone }] (phone in E.164), deduped by phone.
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
    if (uErr && /covered_businesses/.test(uErr.message || '')) {   // pre-0189
      ({ data: users, error: uErr } = await db.from('staff_users').select('name, phone, role, active, business_id').eq('active', true).eq('role', 'secretary'));
    }
    if (uErr) throw uErr;
    await loadCoverageOverrides(db, true);   // per-person coverage + today's weekly schedule
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
    if (covers('handy-andy', slug, 'Heather')) add('Heather', process.env.HEATHER_PHONE_NUMBER || process.env.HANDY_ANDY_SECRETARY_PHONE);
  }
  // Joey for every business, even if his row was missing.
  if (![...out.values()].some((r) => r.name === 'Joey')) add('Joey', process.env.DOMS_SECRETARY_PHONE || JOEY_FALLBACK);
  return [...out.values()];
}
