

const TV_SIZE_TESTS = [
  /(?:32|thirty.?two).*(?:less|under|below)|under.*32|32"?\s*or\s*less/i,
  /33.*59/,
  /60.*69/,
  /70.*8[45]/,
  /8[456].*(?:9[0-9]|100)/,
  /(?:^|\D)98|9[0-9]"?\s*\+/,
];

export function tvSizeRank(name) {
  const n = String(name || '').toLowerCase();
  if (/my tv is|\b(?:lift|help|larger|technicians?)\b/.test(n)) return -1;
  if (/\b(?:install|shelf|hang|wire|hiding|conceal(?:ment)?|correction|bracket|mount|soundbar|dismount|fireplace|surcharge|coupon|tax|tip|handyman|recycle|swap|remount)\b/.test(n)) return -1;
  if (/tilt|full\s*motion|\bflat\b|mantel/.test(n)) return -1;
  for (let i = 0; i < TV_SIZE_TESTS.length; i++) if (TV_SIZE_TESTS[i].test(n)) return i;
  const bare = n.match(/^\s*(\d{2,3})\s*(?:"|inch(?:es)?|in|”|″)?\s*$/);
  if (bare) {
    const v = parseInt(bare[1], 10);
    if (v <= 32) return 0; if (v <= 59) return 1; if (v <= 69) return 2;
    if (v <= 84) return 3; if (v <= 97) return 4; return 5;
  }
  return -1;
}

export function countTvUnits(lineItems) {
  let n = 0;
  for (const li of lineItems || []) {
    const name = String((li && li.name) || '').toLowerCase();
    if (!name) continue;
    if (/my tv is|\b(?:lift|help|larger|technicians?)\b/.test(name)) continue;
    if (/tilt|full\s*motion|\bflat\b|mantel|bracket/.test(name)) continue;
    let hit = TV_SIZE_TESTS.some(t => t.test(name));
    if (!hit) {
      const bare = name.match(/^\s*(\d{2,3})\s*(?:"|inch(?:es)?|in|”|″)?\s*$/);
      hit = !!bare;
    }
    if (hit) n += Math.max(1, Math.round(Number(li.quantity) || 1));
  }
  return n;
}

export const BOOKING_TAX_RATE = 0.0825;
export const isTaxLine = (it) => /^\s*tax\b/i.test(String((it && it.name) || ''));

const isTravelLine = (it) => {
  const n = String((it && it.name) || '');
  return /surcharge|local\s*travel\s*credit|travel\s*fee|^\s*travel\s*$|after[\s-]?hours|service\s*minimum|location.?based/i.test(n);
};
const isDiscountLine = (it) =>
  ((it && it.kind) === 'coupon') || /\b(?:discount|coupon)\b/i.test(String((it && it.name) || ''))
  || (Number(it && it.line_total) || 0) < 0;
const isTipLine = (it) => ((it && it.kind) === 'tip') || /^\s*tip\b/i.test(String((it && it.name) || ''));

function lineBand(it) {
  if (isTaxLine(it)) return 900;
  if (isTipLine(it)) return 800;
  if (isDiscountLine(it)) return 700;
  if (isTravelLine(it)) return 600;
  const size = tvSizeRank(it && it.name);
  if (size >= 0) return 100 + size;
  return 300;
}

export function canonicalizeLineItems(items) {
  return (Array.isArray(items) ? items.slice() : []).sort((a, b) => lineBand(a) - lineBand(b));
}

export function recalcTaxLine(items) {
  if (!items.some(isTaxLine)) return items;
  const body = items.filter(it => !isTaxLine(it));
  const base = body.reduce((t, it) => t + (it.taxable === false ? 0 : it.line_total), 0);
  const tax = Math.round(base * BOOKING_TAX_RATE * 100) / 100;
  return [...body, {
    name: `Tax (${(BOOKING_TAX_RATE * 100).toFixed(2).replace(/\.?0+$/, '')}%)`,
    quantity: 1, unit_price: tax, line_total: tax, kind: 'fee', taxable: false,
  }];
}

export function clampBracketQtysToTvCount(qtys, lineItems) {
  const tvUnits = countTvUnits(lineItems);
  if (!tvUnits) return false;
  let total = (qtys.flat || 0) + (qtys.tilting || 0) + (qtys.full_motion || 0);
  if (total <= tvUnits) return false;
  const isSelectionLabel = (n) => {
    const core = n.replace(/^\s*bracket\s*:\s*/, '')
      .replace(/\s*[—–-]+\s*8[45].*$/, '')
      .replace(/^\s*8[456]"?\s*(?:[—–-]+\s*100"?|\+)\s*tv\s*/, '')
      .replace(/\s*bracket\s*$/, '').trim();
    return /^(?:flat|tilting\s*(?:\(recommended\))?|full\s*motion)\s*(?:[×✕✖]\s*\d+)?\s*$/.test(core);
  };
  const lineCounts = { flat: 0, tilting: 0, full_motion: 0 };
  const nonSelection = { flat: 0, tilting: 0, full_motion: 0 };
  for (const li of lineItems || []) {
    const name = String((li && li.name) || '').toLowerCase();
    if (/customer.?supplied/.test(name)) continue;
    let key = null;
    if (/full.?motion/.test(name)) key = 'full_motion';
    else if (/tilt/.test(name)) key = 'tilting';
    else if (/\bflat\b|fixed/.test(name)) key = 'flat';
    if (!key) continue;
    lineCounts[key]++;
    if (!isSelectionLabel(name)) nonSelection[key]++;
  }
  const dup = ['full_motion', 'tilting', 'flat']
    .filter(k => lineCounts[k] >= 2 && nonSelection[k] >= 1);
  if (!dup.length) {
    console.warn(`[bracket] detected more brackets than recognized TVs (${JSON.stringify(qtys)} vs ${tvUnits} TVs) but no duplicate bracket line — a TV line may be unrecognized; NOT clamping.`);
    return false;
  }
  const before = { ...qtys };
  while (total > tvUnits) {
    const key = dup.reduce((max, k) => ((qtys[k] || 0) > (qtys[max] || 0) ? k : max), dup[0]);
    if (!(qtys[key] > 0)) break;
    qtys[key] -= 1; total -= 1;
  }
  console.warn(`[bracket] duplicate bracket line detected — clamped deduction ${JSON.stringify(before)} to ${JSON.stringify(qtys)} (${tvUnits} TVs on the ticket).`);
  return true;
}

export async function casBumpLiRev(db, bookingId, meta, extraPatch = {}) {
  const cur = Number(meta && meta.li_rev) || 0;
  const newMeta = { ...(meta || {}), ...extraPatch, li_rev: cur + 1 };
  let q = db.from('bookings').update({ metadata: newMeta }).eq('id', bookingId);
  q = cur > 0 ? q.eq('metadata->>li_rev', String(cur))
              : q.or('metadata->>li_rev.is.null,metadata->>li_rev.eq.0');
  const { data, error } = await q.select('id');
  if (error) throw error;
  return { ok: !!(data && data.length), rev: cur + 1, newMeta };
}

export async function bumpLiRev(db, bookingId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await db.from('bookings').select('metadata').eq('id', bookingId).maybeSingle();
      if (!data) return;
      const cas = await casBumpLiRev(db, bookingId, data.metadata);
      if (cas.ok) return;
    } catch (e) {
      console.warn('[li_rev] bump failed (non-fatal):', e.message);
      return;
    }
  }
  console.warn(`[li_rev] bump for booking ${bookingId} lost the CAS race 3 times — giving up (non-fatal).`);
}

export const LI_CONFLICT_CODE = 'li_conflict';

function runSelfTests() {
  let fails = 0;
  const eq = (got, want, label) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g !== w) { fails++; console.error(`FAIL ${label}\n  got  ${g}\n  want ${w}`); }
    else console.log(`ok   ${label}`);
  };
  const names = (items) => items.map(i => i.name);

  eq(names(canonicalizeLineItems([
    { name: 'Tax (8.25%)', kind: 'fee', line_total: 91.16 },
    { name: 'Multi-TV discount', kind: 'coupon', line_total: -78 },
    { name: '98"+', kind: 'service', line_total: 250 },
    { name: 'Service area surcharge', kind: 'fee', line_total: 65 },
    { name: 'Soundbar Installation (you supply the mounting bracket)', line_total: 50 },
    { name: '33"–59"', kind: 'service', line_total: 220 },
    { name: 'Tilting (recommended)', line_total: 180 },
    { name: '60"–69"', kind: 'service', line_total: 125 },
  ])), ['33"–59"', '60"–69"', '98"+', 'Soundbar Installation (you supply the mounting bracket)',
        'Tilting (recommended)', 'Service area surcharge', 'Multi-TV discount', 'Tax (8.25%)'],
     'canonical order: sizes ascending, work, travel, discount, tax');

  eq(tvSizeRank('Tilting (recommended) — 85"–100"'), -1, 'XL bracket line is not a TV size');
  eq(tvSizeRank('I have 1 TV above a fireplace'), -1, 'fireplace answer is not a TV size');
  eq(tvSizeRank('75"'), 3, 'bare-inch maps into its band');
  eq(tvSizeRank('90"+'), 5, 'legacy 90"+ label bands as the largest size');
  eq(tvSizeRank('Install shelf under TV'), -1, 'strict 32" test (phantom-dropdown bug)');
  eq(countTvUnits([{ name: '33"–59"', quantity: 2 }, { name: '98"+', quantity: 1 },
    { name: 'Tilting Mounts', quantity: 3 }]), 3, 'TV count ignores bracket lines');
  eq(countTvUnits([{ name: 'TV Install 33-59"', quantity: 1 },
    { name: 'Correction of Previous Job - 60 - 69"', quantity: 1 },
    { name: '90"+', quantity: 1 }]), 3, 'work-word TV phrasings still count as TV units');
  eq(countTvUnits([{ name: 'My TV is 85 inches or larger and I can help lift', quantity: 1 }]), 0,
     'lifting-help answer never counts as a TV');

  const throck = [
    { name: '98"+', quantity: 1 }, { name: '60"–69"', quantity: 1 }, { name: '33"–59"', quantity: 2 },
    { name: 'Tilting (recommended)', quantity: 3 }, { name: 'Tilting Mounts', quantity: 3 }];
  const q = { flat: 0, tilting: 6, full_motion: 0 };
  eq([clampBracketQtysToTvCount(q, throck), q.tilting], [true, 4], 'duplicate bracket line clamps to TV count');
  const q2 = { flat: 1, tilting: 2, full_motion: 0 };
  eq([clampBracketQtysToTvCount(q2, [{ name: '33"–59"', quantity: 3 },
    { name: 'Flat', quantity: 1 }, { name: 'Tilting (recommended)', quantity: 2 }]), q2.tilting],
     [false, 2], 'legit ticket untouched');
  const q3 = { flat: 0, tilting: 2, full_motion: 0 };
  eq([clampBracketQtysToTvCount(q3, [{ name: 'Handyman hourly', quantity: 3 }]), q3.tilting],
     [false, 2], 'no TV lines -> no clamp');
  const q4 = { flat: 0, tilting: 2, full_motion: 0 };
  eq([clampBracketQtysToTvCount(q4, [{ name: '60"–69"', quantity: 1 },
    { name: 'Tilting (recommended)', quantity: 2 }]), q4.tilting],
     [false, 2], 'no duplicate signal -> no clamp');
  const q5 = { flat: 0, tilting: 2, full_motion: 0 };
  eq([clampBracketQtysToTvCount(q5, [{ name: '60"–69"', quantity: 1 },
    { name: 'Mounting a 98 inch TV on brick', quantity: 1 },
    { name: 'Tilting (recommended)', quantity: 1 },
    { name: '85"-100" TV Tilting Bracket', quantity: 1 }]), q5.tilting],
     [false, 2], 'standard + XL selection pair is not a duplicate');
  for (const xl of ['85"-100" TV Tilting Bracket', '86"+ TV Tilting Bracket', '85"+ TV Tilting Bracket']) {
    const q5b = { flat: 0, tilting: 2, full_motion: 0 };
    eq([clampBracketQtysToTvCount(q5b, [{ name: '60"–69"', quantity: 1 },
      { name: 'Tilting (recommended)', quantity: 1 },
      { name: xl, quantity: 1 }]), q5b.tilting],
       [false, 2], `standard + XL selection pair is not a duplicate (${xl})`);
  }
  const q6 = { flat: 0, tilting: 2, full_motion: 0 };
  eq([clampBracketQtysToTvCount(q6, [{ name: '60"–69"', quantity: 1 },
    { name: 'Tilting (recommended)', quantity: 1 },
    { name: 'Tilting Mounts', quantity: 1 }]), q6.tilting],
     [true, 1], 'selection + hand-typed hardware IS a duplicate -> clamp');
  eq(names(canonicalizeLineItems([
    { name: 'Location-based pricing', kind: 'fee', line_total: 25 },
    { name: 'Second Cleaner', kind: 'fee', line_total: 70 },
    { name: '33"–59"', kind: 'service', line_total: 109 },
  ])), ['33"–59"', 'Second Cleaner', 'Location-based pricing'],
     'location fee sits in the travel band, second cleaner stays with work');

  eq(names(recalcTaxLine([
    { name: '33"–59"', line_total: 220, taxable: true },
    { name: 'Tax (8.25%)', line_total: 1, taxable: false },
  ])), ['33"–59"', 'Tax (8.25%)'], 'tax recalc keeps tax last');
  eq(recalcTaxLine([
    { name: '33"–59"', line_total: 200, taxable: true },
    { name: 'Tax (8.25%)', line_total: 1, taxable: false },
  ])[1].line_total, 16.5, 'tax recomputed from the lines');
  eq(names(recalcTaxLine([{ name: 'Handyman', line_total: 100 }])), ['Handyman'],
     'no tax line -> none invented');

  console.log(fails ? `\n${fails} FAILED` : '\nAll line-items self-tests passed');
  return fails;
}
if (process.env.LINE_ITEMS_SELFTEST === '1') {
  process.exit(runSelfTests() ? 1 : 0);
}
