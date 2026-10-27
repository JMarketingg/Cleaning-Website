
export const PAY_DATE_OFFSET_DAYS = 9;

export function isJuan(techName) {
  return /\bjuan\b/i.test(String(techName || ''));
}
export function isRetired(techName) {
  return /\b(evan|israel)\b/i.test(String(techName || ''));
}


const TV_SIZE_RATES = [
  { test: /(32|thirty.?two).*(less|under|below)|under.*32|32"?\s*or\s*less/, juan: 50, other: 50, label: '32" & under' },
  { test: /33.*59|33"?–?59/,                                                  juan: 60, other: 60, label: '33"–59"' },
  { test: /60.*69|60"?–?69/,                                                  juan: 80, other: 70, label: '60"–69"' },
  { test: /70.*8[45]|70"?[–-]?8[45]/,                                         juan: 90, other: 80, label: '70"–84"' },
  { test: /8[56].*97|8[56]"?[–-]?97/,                                         juan: 110, other: 110, label: '85"–97"' },
  { test: /98|98"?\+|9[0-9]"?\s*\+/,                                          juan: 130, other: 130, label: '98"+' },
];

const ITEM_RATES = {
  'flat bracket':            { juan: 25, other: 0 },
  'flat':                    { juan: 25, other: 0 },
  'tilting bracket':         { juan: 35, other: 0 },
  'tilting':                 { juan: 35, other: 0 },
  'full motion bracket':     { juan: 60, other: 0 },
  'full motion':             { juan: 60, other: 0 },
  'mantel mount':            { juan: 110, other: 110 },
  'install customer supplied mantel mount': { juan: 110, other: 110 },
  'customer supplied bracket': { juan: 0, other: 0 },
  'i have my own bracket':   { juan: 0, other: 0 },
  'i have my own mounting bracket': { juan: 0, other: 0 },
  '85 100 flat bracket':        { juan: 25, other: 0 },
  '85 100 tilting bracket':     { juan: 35, other: 0 },
  '85 100 full motion bracket': { juan: 60, other: 0 },
  'i will be using the bracket that comes in the box samsung frame tv': { juan: 15, other: 15 },

  'samsung frame box':       { juan: 15, other: 15 },
  'samsung frame tv in box bracket': { juan: 15, other: 15 },
  'samsung frame lg gallery in box bracket': { juan: 15, other: 15 },
  'samsung frame lg gallery':                { juan: 15, other: 15 },
  'frame lg gallery in box bracket':         { juan: 15, other: 15 },
  'remount tv':              { juan: 60, other: 60 },
  'remount':                 { juan: 60, other: 60 },
  'tv recycle':              { juan: 75, other: 75 },
  'recycle':                 { juan: 75, other: 75 },
  'tv recycling':            { juan: 75, other: 75 },
  'recycling':               { juan: 75, other: 75 },
  'soundbar':                { juan: 35, other: 35 },
  'soundbar installation':   { juan: 35, other: 35 },
  'apple tv':                { juan: 15, other: 15 },
  'apple tv installation':   { juan: 15, other: 15 },
  'apple tv installation mounting bracket included': { juan: 15, other: 15 },
  'led light strip':         { juan: 35, other: 35 },
  'led lights':              { juan: 35, other: 35 },
  'shelf installation':      { juan: 35, other: 35 },
  'install shelf under tv':  { juan: 35, other: 35 },
  'oneconnect box':          { juan: 170, other: 170 },
  'install samsung frame oneconnect box': { juan: 170, other: 170 },
  'install samsung frame oneconnect box behind tv': { juan: 170, other: 170 },

  'behind wall wires':       { juan: 45, other: 35 },
  'hide wires behind the wall': { juan: 45, other: 35 },
  'yes hide the wires behind the wall': { juan: 45, other: 35 },
  'outside wall wires':      { juan: 15, other: 15 },
  'hide wires outside the wall': { juan: 15, other: 15 },
  'yes hide the wires outside the wall': { juan: 15, other: 15 },
  'hang wires under the tv': { juan: 0, other: 0 },
  'wires hang under the tv': { juan: 0, other: 0 },
  'above fireplace':         { juan: 25, other: 20 },
  'tv above a fireplace':    { juan: 25, other: 20 },
  'i have 1 tv above a fireplace': { juan: 25, other: 20 },
  'not over fireplace':      { juan: 0, other: 0 },
  'tv not over a fireplace': { juan: 0, other: 0 },
  'i have 1 tv not over a fireplace': { juan: 0, other: 0 },
  'tv not above a fireplace': { juan: 0, other: 0 },
  'brick stone surface':     { juan: 25, other: 25 },
  'brick':                   { juan: 25, other: 25 },
  'brick stone':             { juan: 25, other: 25 },
  'tile uneven stone':       { juan: 40, other: 40 },
  'uneven stone or tile':    { juan: 40, other: 40 },
  'stucco outdoor':          { juan: 35, other: 35 },
  'outdoor stucco':          { juan: 35, other: 35 },
  'drywall surface':         { juan: 0, other: 0 },
  'drywall':                 { juan: 0, other: 0 },
  'cannot lift 86':          { juan: 60, other: 60 },
  'lifting help':            { juan: 60, other: 60 },
  'wall already has a plug behind the tv': { juan: 0, other: 0 },
  'wall already has plug behind tv': { juan: 0, other: 0 },
};

const ASSURION_RATES = {
  'tv installation': 60,
  'television': 60,
  'soundbar': 35,
  'frame box': 75,
  'frame tv': 75,
};

export const TECH_TRAVEL_SHARE = 0.8;
export function travelPayoutForSurcharge(amount) {
  const a = Number(amount) || 0;
  if (a <= 0) return 0;
  return Math.round(a * TECH_TRAVEL_SHARE);
}

export const CUSTOM_PAY = { '020989': 60, '690071': 50 };
export const ASSURION_TOTAL = { '143430': 60, '708972': 60, '811856': 70 };

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/["'’“”]/g, '')
    .replace(/[()\-–—/.,+&]/g, ' ')
    .replace(/\b(the|a|an|of|to|behind|under|recommended|installation|service|per|tv)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function keyOf(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/["'’“”]/g, '')
    .replace(/[()\-–—/.,+&]/g, ' ')
    .replace(/\brecommended\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function stripQtySuffix(s) {
  return String(s || '').replace(/\s*[×✕✖]\s*\d+\s*$/, '').trim();
}

function matchSize(name) {
  const n = String(name || '').toLowerCase();
  if (/my tv is|\b(?:lift|help|larger|technicians?)\b/i.test(n)) return null;
  for (const r of TV_SIZE_RATES) if (r.test.test(n)) return r;
  const bare = n.match(/^\s*(\d{2,3})\s*(?:"|inch(?:es)?|in|”|″)?\s*(?:tvs?)?\s*$/)
    || n.match(/^\s*(\d{2,3})\s*["”″]?\s*[-–]\s*\d{2,3}\s*(?:"|”|″|inch(?:es)?|in)?\s*(?:tvs?)?\s*$/);
  if (bare) {
    const v = parseInt(bare[1], 10);
    if (v <= 32) return TV_SIZE_RATES[0];
    if (v <= 59) return TV_SIZE_RATES[1];
    if (v <= 69) return TV_SIZE_RATES[2];
    if (v <= 84) return TV_SIZE_RATES[3];
    if (v <= 97) return TV_SIZE_RATES[4];
    return TV_SIZE_RATES[5];
  }
  return null;
}
function afterPrefix(name) {
  const s = String(name || '');
  const i = s.indexOf(':');
  const tail = i > -1 ? s.slice(i + 1).trim() : '';
  return tail;
}
function isFrameInBoxBracket(name, lt) {
  if (Number(lt) > 40) return false;
  const n = String(name || '').toLowerCase();
  if (/\b(samsung\s*frame|lg\s*gallery|frame\s*\/?\s*gallery)\b/.test(n)) return true;
  return /bracket/.test(n) && /\bin\b[\s\S]{0,6}\bbox\b/.test(n);
}
function matchItem(name, lt, unitLt = lt) {
  const bases = [name, afterPrefix(name)].filter(Boolean);
  const cands = [];
  for (const b of bases) {
    cands.push(b);
    const s = stripQtySuffix(b);
    if (s && s !== b) cands.push(s);
  }
  for (const cand of cands) {
    const k = keyOf(cand);
    if (ITEM_RATES[k]) return { key: k, ...ITEM_RATES[k] };
    const n = normalize(cand);
    if (ITEM_RATES[n]) return { key: n, ...ITEM_RATES[n] };
  }
  if (/dry\s*erase\s*board/i.test(name)) return { key: 'dry erase board', juan: 65, other: 65 };
  if (/(direct\s*tv|dish\s*network|satellite)\b.*\bsetup\b|\bsetup\b.*\bsatellite\b/i.test(name)) {
    return { key: 'satellite tv setup', juan: 70, other: 70 };
  }
  if (/\bring\b.*\b(camera|doorbell)\b|\b(camera|doorbell)\b.*\bring\b/i.test(name)) {
    return { key: 'ring device installation', juan: 65, other: 65 };
  }
  if (/one\s*connect/i.test(name) || (/\bsamsung\s*frame\b/i.test(name) && Number(lt) >= 300)) {
    return { key: 'oneconnect box', juan: 170, other: 170 };
  }
  if (isFrameInBoxBracket(name, unitLt)) return { key: 'frame in-box bracket', juan: 15, other: 15 };
  if ((/\b(cord|wire)s?\b/i.test(name) && /\bwall\b|conceal/i.test(name)) || isBehindWallConcealment(name)) {
    return /\boutside\b/i.test(name)
      ? { key: 'outside wall wires', juan: 15, other: 15 }
      : { key: 'behind wall wires', juan: 45, other: 35 };
  }
  if (!/customer.?supplied/i.test(name)) {
    if (/full.?motion/i.test(name)) return { key: 'full motion bracket', juan: 60, other: 0 };
    if (/\btilt/i.test(name)) return { key: 'tilting bracket', juan: 35, other: 0 };
    if (/\bflat\b|fixed/i.test(name)) return { key: 'flat bracket', juan: 25, other: 0 };
  }
  if (/\bbrackets?\b/i.test(name)) return { key: 'unrecognized bracket (material)', juan: 0, other: 0 };
  if (/uneven|\btile\b/i.test(name)) return { key: 'tile uneven stone', juan: 40, other: 40 };
  if (/stucco/i.test(name)) return { key: 'stucco outdoor', juan: 35, other: 35 };
  if (/\bbrick\b|\bstone\b/i.test(name)) return { key: 'brick stone surface', juan: 25, other: 25 };
  if (/\bdrywall\b|\bsheetrock\b/i.test(name)) return { key: 'drywall surface', juan: 0, other: 0 };
  return null;
}

const round0 = (n) => Math.floor(Number(n) || 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function payQty(li) {
  const q = Math.round(Number(li && li.quantity) || 0);
  if (q > 1) return q;
  const u = Number(li && li.unit_price) || 0, t = Number(li && li.line_total) || 0;
  if (u > 0) { const r = t / u; if (Math.abs(r - Math.round(r)) < 0.02 && Math.round(r) > 1) return Math.round(r); }
  return 1;
}

function dismountQty(name, li) {
  const m = String(name || '').match(/\bx\s*(\d+)\b|\b(\d+)\s*x\b/i);
  if (m) return Math.max(1, parseInt(m[1] || m[2], 10));
  const q = Number(li && li.quantity);
  return q > 1 ? Math.round(q) : 1;
}

export function paymentState(job) {
  const status = String(job.payment_status || '').toLowerCase();
  const price = Number(job.price) || 0;
  const paid = Number(job.amount_paid) || 0;
  const notes = String(job.notes || '') + ' ' + String(job.customer_notes || '');
  const cashVenmo = /\b(paid\s*cash|cash\b|venmo)\b/i.test(notes);

  if (status === 'paid' || cashVenmo) return 'paid';
  if (price <= 0) return 'paid';
  if (paid > 0 && paid < price) return 'partial';
  return 'deferred';
}

export const OVERRIDE_TIP_SEPARATE_FROM = '2026-10-04';

function tipFor(job) {
  let tip = Number(job.tip) || 0;
  for (const li of job.line_items || []) {
    if (/\btip\b/i.test(li.name || '')) tip += Number(li.line_total) || 0;
  }
  return tip;
}

const SECOND_TECH_RE = /(?:second|2nd|extra)\s*tech(?:nician)?\b|\d\s*technicians?\b|cannot\s*(?:help\s*)?lift|lifting\s*help|8[56]\s*inch(?:es)?\s*or\s*larger/i;

const GDS_REDEEMED_RATE_CHANGE = { at: new Date('2026-08-03T00:00:00Z'), before: 60, after: 50 };
function gdsRedeemedRate(scheduledAt) {
  const t = scheduledAt ? new Date(scheduledAt) : null;
  return (t && !isNaN(t) && t < GDS_REDEEMED_RATE_CHANGE.at) ? GDS_REDEEMED_RATE_CHANGE.before : GDS_REDEEMED_RATE_CHANGE.after;
}

export const JUAN_BRACKET_ZERO_FROM = new Date('2026-08-16T00:00:00Z');
const JUAN_BRACKET_KEYS = new Set([
  'flat bracket', 'flat',
  'tilting bracket', 'tilting',
  'full motion bracket', 'full motion',
  '85 100 flat bracket', '85 100 tilting bracket', '85 100 full motion bracket',
]);
function juanBracketZeroed(pair, scheduledAt) {
  if (!pair || !JUAN_BRACKET_KEYS.has(pair.key)) return false;
  const t = scheduledAt ? new Date(scheduledAt) : null;
  return !t || isNaN(t) || t >= JUAN_BRACKET_ZERO_FROM;
}

function detectMultiTech(job) {
  for (const li of job.line_items || []) {
    const name = String(li.name || '').toLowerCase();
    if (SECOND_TECH_RE.test(name)) {
      const lt = Number(li.line_total) || 0;
      const bonus = lt >= 70 ? 30 : 0;
      return { hasSecondTech: true, secondTechBonus: bonus };
    }
  }
  return { hasSecondTech: false, secondTechBonus: 0 };
}

function detectSpecial(job) {
  const svc = String(job.service_name || '').toLowerCase();
  const allNames = (job.line_items || []).map(li => String(li.name || '').toLowerCase());
  const has = (re) => re.test(svc) || allNames.some(n => re.test(n));
  if (has(/\btv\s*swap\b/)) return 'tv_swap';
  if (has(/\b(estimate|quote)\b/)) return 'estimate';
  if (has(/\bpre.?paid\b/)) return 'prepaid';
  const hasTvBase = (job.line_items || []).some(li => matchSize(li.name));
  if (!hasTvBase && (has(/\bhandyman\b/) || has(/\bhandyman labor\b/))) return 'handyman';
  return null;
}

export function movePayFor(name, lineTotal) {
  const n = String(name || '');
  if (!/^\s*move\s*:/i.test(n) || !(Number(lineTotal) > 0)) return null;
  let m = n.match(/take\s*down\s*(\d+)\s*tvs?/i);
  if (m) { const tvs = Math.max(1, parseInt(m[1], 10)); return { label: `Move: take down ${tvs} TV${tvs === 1 ? '' : 's'}`, amount: 70 + 20 * Math.max(0, tvs - 3) }; }
  m = n.match(/(\d+)\s*mi(?:les?)?\b/i);
  if (m) { const mi = parseInt(m[1], 10); return { label: `Move: ${mi} miles`, amount: 20 + 2 * Math.max(0, mi - 10) }; }
  return null;
}

function isBehindWallConcealment(name) {
  return /\bbehind\s+(the\s+)?wall\b/i.test(name || '') && /conceal/i.test(name || '');
}

export const AFTER_HOURS_65_FROM = '2026-10-22T08:12:43Z';

export function computeJobPay(job, techName) {
  const r = computeJobPayInner(job, techName);
  const pay = Number(r.pay) || 0;
  const tip = round2(r.tip);
  return { ...r, pay, tip, total: round2(pay + tip) };
}

function computeJobPayInner(job, techName) {
  const flags = [];
  const breakdown = [];
  const juan = isJuan(techName);
  const rate = (pair) => {
    if (!juan) return pair.other;
    if (juanBracketZeroed(pair, job.scheduled_at)) return 0;
    return pair.juan;
  };

  if (isRetired(techName)) return { pay: 0, breakdown, flags: ['Retired tech — never paid'], state: 'excluded' };
  if (String(job.status || '').toLowerCase() !== 'completed') {
    return { pay: 0, breakdown, flags: [], state: 'excluded' };
  }

  const jn = String(job.zenbooker_job_number || '').trim();
  if (jn && CUSTOM_PAY[jn] != null) {
    return { pay: CUSTOM_PAY[jn], breakdown: [{ label: `Custom pay (job #${jn})`, amount: CUSTOM_PAY[jn] }], flags, state: 'paid' };
  }
  if (jn && ASSURION_TOTAL[jn] != null) {
    return { pay: ASSURION_TOTAL[jn], breakdown: [{ label: `Assurion override (job #${jn})`, amount: ASSURION_TOTAL[jn] }], flags, state: 'paid' };
  }

  const notes = String(job.notes || '');
  {
    const ov = notes.match(/payroll\s*override\s*:?\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
    if (ov) {
      const amt = round2(parseFloat(ov[1]));
      const tipSeparate = String(job.scheduled_at || '').slice(0, 10) >= OVERRIDE_TIP_SEPARATE_FROM;
      return { pay: amt, tip: tipSeparate ? tipFor(job) : 0, breakdown: [{ label: 'Payroll override (owner-set)', amount: amt }], flags, state: 'paid' };
    }
  }

  if (/assurion/i.test(notes)) {
    const m = notes.match(/Tech pay:\s*\$?(\d+)/i);
    if (m) {
      const amt = parseInt(m[1], 10);
      return { pay: amt, breakdown: [{ label: 'Assurion (per job note)', amount: amt }], flags, state: 'paid' };
    }
    flags.push('Assurion job but no "Cleaner pay:" note found');
  }

  const state = paymentState(job);
  if (state === 'deferred') {
    return { pay: 0, breakdown, flags: ['Unpaid — deferred to a future week'], state: 'deferred' };
  }
  if (state === 'partial') {
    flags.push('Partially paid — owner review required');
  }

  const tip = tipFor(job);
  const special = detectSpecial(job);

  const multiTech = detectMultiTech(job);
  const twoTechs = !!job.second_tech;
  const SECOND_TECH_BONUS = job.is_houston ? 70 : 60;
  const feeBonus = multiTech.secondTechBonus > 0 ? SECOND_TECH_BONUS : 0;

  let afterHoursBonus = 0;
  for (const li of job.line_items || []) {
    if (/after.?hours|8\s*pm/i.test(li.name || '')) {
      afterHoursBonus = (job.created_at && String(job.created_at) < AFTER_HOURS_65_FROM) ? 75 : 65;
      break;
    }
  }

  let travelPayout = 0;
  for (const li of job.line_items || []) {
    if (Number(li.line_total) > 0 && /service area surcharge|\btravel\b|service.?area fee/i.test(li.name || '')) {
      travelPayout = travelPayoutForSurcharge(li.line_total);
      break;
    }
  }
  if (!travelPayout && Number(job.travel_payout) < 0
      && (job.line_items || []).some(li => Number(li.line_total) < 0 && /local travel credit/i.test(li.name || ''))) {
    travelPayout = Number(job.travel_payout);
  }

  if (special === 'tv_swap') {
    breakdown.push({ label: 'TV Swap (flat)', amount: 60 });
    return { pay: 60, tip, breakdown, flags, state: state === 'partial' ? 'partial' : 'paid' };
  }
  if (special === 'prepaid') {
    return { pay: 0, tip, breakdown: [], flags: ['Pre-paid service — base pay $0 per owner'], state: 'paid' };
  }
  if (special === 'estimate') {
    const customerPaid = (Number(job.price) || 0) > 0;
    const amt = customerPaid ? 50 : 0;
    if (!customerPaid) flags.push('Unpaid estimate — flagged ($0)');
    breakdown.push({ label: 'Estimate', amount: amt });
    return { pay: round0(amt), tip, breakdown, flags, state: 'paid' };
  }
  let pay = 0;
  let sawSize = false;
  let gdsRedeemed = false;
  const businessSlug = String(job.business_slug || '').toLowerCase();

  if (special === 'handyman') {
    const laborLine = (job.line_items || []).find(li => /handyman/i.test(li.name || ''));
    const hours = Math.max(2, laborLine ? payQty(laborLine) : Math.round((Number(job.subtotal) || Number(job.price) || 0) / 85));
    const amt = hours * 65;
    breakdown.push({ label: `Handyman ${hours}h @ $65`, amount: amt });
    pay += amt;
  } else for (const li of job.line_items || []) {
    const name = li.name || '';
    const lt = Number(li.line_total) || 0;

    {
      const mv = movePayFor(name, lt);
      if (mv) { breakdown.push(mv); pay += mv.amount; continue; }
    }
    if (li.kind === 'fee' || /^tax\b/i.test(name) || /\btip\b/i.test(name) || /\bfee\b/i.test(name)
        || /service area surcharge/i.test(name) || /after.?hours/i.test(name)
        || /service\s*minimum/i.test(name) || /\btravel\b/i.test(name)) continue;

    if (SECOND_TECH_RE.test(name)) continue;

    if (/dismount/i.test(name)) {
      const isGuaranteed = /guaranteed/i.test(name);
      const qty = dismountQty(name, li);
      const perUnit = lt / qty;
      const unit = isGuaranteed
        ? (perUnit > 0 ? 0 : gdsRedeemedRate(job.scheduled_at))
        : (perUnit <= 0 ? 0 : (perUnit > 60 ? 60 : 50));
      const amt = unit * qty;
      if (isGuaranteed && unit > 0) gdsRedeemed = true;
      if (amt) breakdown.push({ label: `${isGuaranteed ? 'Guaranteed Dismount' : 'Dismount'}${qty > 1 ? ` ×${qty}` : ''}`, amount: amt });
      pay += amt;
      continue;
    }

    if (/handyman/i.test(name)) {
      const hours = payQty(li);
      const amt = Math.round(hours * 65);
      if (amt) breakdown.push({ label: `Handyman ${hours}h @ $65`, amount: amt });
      pay += amt;
      if (lt > 0 && Math.abs(hours * 85 - lt) > 0.5) {
        flags.push(`Handyman line "${name}" — qty ${hours} implies ₱${hours * 85} but charged ₱${round0(lt)}; verify hours`);
      }
      continue;
    }

    const sz = matchSize(name);
    if (sz) {
      if (lt <= 0) {
        flags.push(`Ignored $0 size line "${name}" — not a charged TV (phantom/duplicate)`);
        continue;
      }
      sawSize = true;
      const n = payQty(li);
      const amt = rate(sz) * n;
      breakdown.push({ label: `TV base ${sz.label}${n > 1 ? ` ×${n}` : ''}`, amount: amt });
      pay += amt;
      continue;
    }
    if (/my tv is|under 70|70.?85|86\s*\+?/i.test(name) && !matchSize(name) && !/\bbrackets?\b/i.test(name)) {
      if (lt > 0) flags.push(`Size descriptor "${name}" — verify rate bracket for pay calculation`);
      continue;
    }

    if (isBehindWallConcealment(name) && lt > 0 && (!job.scheduled_at || String(job.scheduled_at) >= '2026-10-04') && !(job.line_items || []).some(x => matchSize(x.name))) {
      const n = payQty(li);
      breakdown.push({ label: `Behind-wall concealment (stand-alone)${n > 1 ? ` ×${n}` : ''}`, amount: 60 * n });
      pay += 60 * n;
      sawSize = true;
      continue;
    }

    const item = matchItem(name, lt, lt / Math.max(1, payQty(li)));
    if (item && /recycl/i.test(name) && lt > 0 && String(job.scheduled_at || '') >= '2026-10-04') {
      const amt = round2(lt * 0.75);
      breakdown.push({ label: 'TV recycle (75%)', amount: amt });
      pay += amt;
      continue;
    }
    if (item) {
      const n = payQty(li);
      const amt = rate(item) * n;
      if (amt) breakdown.push({ label: `${stripQtySuffix(name)}${n > 1 ? ` ×${n}` : ''}`, amount: amt });
      pay += amt;
      continue;
    }

    if (/\b(samsung|lg|sony|tcl|hisense|vizio|roku|insignia|toshiba|philips|panasonic)\b.*\btv\b|\bsmart\s*tv\b|\b(4k|8k|oled|qled|uhd)\b.*\btv\b/i.test(name)
        && !/mount|install|stand|set\s*up|setup|hang|assembl|remov|recycl|haul/i.test(name)) {
      if (lt > 0) flags.push(`TV sold to the customer "${name}" (₱${round0(lt)}) — product, $0 tech pay`);
      continue;
    }

    if (lt >= 80) {
      const rawHours = lt / 85;
      const hours = Math.max(1, Math.round(rawHours));
      const amt = hours * 65;
      breakdown.push({ label: `Custom job ${hours}h @ $65`, amount: amt });
      pay += amt;
      if (Math.abs(rawHours - hours) > 0.1) {
        flags.push(`Custom job "${name}" (₱${round0(lt)}) — paid ${hours}h @ $65; verify the hours`);
      }
    } else if (lt > 0) {
      flags.push(`Unmatched line item "${name}" (₱${round0(lt)}) — owner review (too small for a custom hour)`);
    }
  }

  if (!sawSize && !special && (job.line_items || []).some(li => matchSize(li.name))) {
  }
  if (!sawSize && !special && !gdsRedeemed && businessSlug !== '' && (job.line_items || []).length) {
    flags.push('No TV size base detected — owner review');
  }

  if (twoTechs) {
    let baseTotal = 0;
    for (const item of breakdown) baseTotal += item.amount;
    const pool = baseTotal + feeBonus;
    const share = round2(pool / 2);
    const tipShare = round2(tip / 2);
    const travelHalf = travelPayout ? round2(travelPayout / 2) : 0;
    const newBreakdown = [{ label: `½ of job tech pay (₱${round2(pool)} ÷ 2)`, amount: share }];
    if (afterHoursBonus) newBreakdown.push({ label: 'After-Hours bonus (8 PM)', amount: afterHoursBonus });
    if (travelHalf) newBreakdown.push({ label: 'Travel payout (½ of trip)', amount: travelHalf });
    const finalPay = share + afterHoursBonus + travelHalf;
    return { pay: round2(finalPay), tip: tipShare, breakdown: newBreakdown, flags, state: state === 'partial' ? 'partial' : 'paid' };
  } else {
    if (feeBonus) breakdown.push({ label: `Second Cleaner bonus (₱${feeBonus})`, amount: feeBonus });
    if (afterHoursBonus) breakdown.push({ label: 'After-Hours bonus (8 PM)', amount: afterHoursBonus });
    if (travelPayout) breakdown.push({ label: 'Travel payout', amount: travelPayout });
    pay += feeBonus + afterHoursBonus + travelPayout;
    return { pay: round0(pay), tip, breakdown, flags, state: state === 'partial' ? 'partial' : 'paid' };
  }
}

function runSelfTests() {
  let fails = 0;
  const eq = (got, want, msg) => {
    const ok = got === want;
    if (!ok) { fails++; console.error(`✗ ${msg}: got ${got}, want ${want}`); }
    else console.log(`✓ ${msg}`);
  };
  const job = (over) => ({ status: 'completed', payment_status: 'paid', price: 200, line_items: [], created_at: '2026-08-01T00:00:00Z', ...over });

  eq(computeJobPay(job({ business_slug: 'tidyhaus', line_items: [
    { name: '75"', line_total: 109 },
    { name: 'I will be using the bracket that comes in the box (Samsung Frame TV)', line_total: 25 },
    { name: 'Tax (8.25%)', line_total: 11.06, kind: 'fee' },
  ] }), 'Zach').pay, 95, "bare 75\" = 70-84 base (80) + frame bracket (15) = 95");
  eq(computeJobPay(job({ line_items: [{ name: '75"', line_total: 109 }] }), 'Zach').flags.length, 0, 'bare 75" size: no review flags');
  eq(computeJobPay(job({ line_items: [{ name: '55"', line_total: 100 }] }), 'Kregg').pay, 60, 'bare 55" = 33-59 base = 60');
  eq(computeJobPay(job({ line_items: [{ name: '90"', line_total: 200 }] }), 'Kregg').pay, 110, 'bare 90" = 85-97 base = 110');

  eq(computeJobPay(job({ line_items: [{ kind: 'option', name: '33"–59"', line_total: 109 }] }), 'Kregg').pay, 60, '50in non-Juan base = 60');
  eq(computeJobPay(job({ line_items: [{ kind: 'option', name: '60"–69"', line_total: 119 }] }), 'Kregg').pay, 70, '60-69 non-Juan = 70');
  eq(computeJobPay(job({ line_items: [{ kind: 'option', name: '60"–69"', line_total: 119 }] }), 'Juan').pay, 80, '60-69 Juan = 80');
  eq(computeJobPay(job({ line_items: [{ kind: 'option', name: '98"+', line_total: 229 }] }), 'Juan').pay, 130, '98+ Juan = 130');

  eq(computeJobPay(job({ line_items: [
    { name: 'Bracket: I will be using the bracket that comes in the box (Samsung Frame TV)', line_total: 30 },
    { name: 'TV Size: 33"-59"', line_total: 109 },
    { name: 'TV Size: 32" Or Less', line_total: 0, unit_price: 0 },
  ] }), 'Juan').pay, 75, 'phantom $0 size line is ignored (Jennifer Graves): 15 + 60 = 75, not 125');
  eq(computeJobPay(job({ line_items: [{ name: 'TV Size: 32" Or Less', line_total: 99, unit_price: 99 }] }), 'Kregg').pay, 50, 'real (charged) 32" size still pays $50');

  const julianaItems = [
    { name: '70"-85"', line_total: 149 },
    { name: 'Wall Surface: Outdoor/Stucco', line_total: 45 },
    { name: 'Add-ons: Soundbar Installation', line_total: 60 },
    { name: 'Service area surcharge', line_total: 65 },
  ];
  eq(computeJobPay(job({ line_items: julianaItems }), 'Juan').pay, 212, 'Juan 70-85 + outdoor + soundbar (160) + $52 travel (80% of $65) = 212');
  eq(computeJobPay(job({ line_items: julianaItems }), 'Juan').flags.length, 0, 'Juliana job: no unmatched/review flags');
  eq(computeJobPay(job({ line_items: julianaItems }), 'Kregg').pay, 202, 'Other tech same job = 150 base + $52 travel = 202');
  eq(computeJobPay(job({ line_items: julianaItems, second_tech: true }), 'Juan').pay, 106, 'Juan WITH a real second cleaner splits like anyone else: (160+52)/2 = 106');
  eq(computeJobPay(job({ line_items: julianaItems, second_tech: true }), 'Kregg').pay, 101, 'Two techs: base 150 split = 75 + travel $52 SPLIT = 26 -> 101');
  eq(computeJobPay(job({ line_items: julianaItems, second_tech: true, is_secondary: true }), 'Kregg').pay, 101, 'Second of two techs: 75 base share + 26 travel half = 101');
  eq(computeJobPay(job({ line_items: [
    { name: '70"-85"', line_total: 149 },
    { name: 'My TV is 70-85 inches and I cannot help lift it', line_total: 70 },
  ] }), 'Juan').pay, 150, 'Juan paid two-person: 90 base + full 60 = 150');

  eq(computeJobPay(job({ line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Second Cleaner', line_total: 70, kind: 'fee' },
  ] }), 'Kregg').pay, 130, 'Solo + Second Cleaner line: 70 base + full 60 = 130');
  eq(computeJobPay(job({ second_tech: true, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Second Cleaner', line_total: 70, kind: 'fee' },
  ] }), 'Kregg').pay, 65, 'Two techs + Second Cleaner: (70 + 60) ÷ 2 = 65');
  eq(computeJobPay(job({ second_tech: true, is_secondary: true, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Second Cleaner', line_total: 70, kind: 'fee' },
  ] }), 'Steve').pay, 65, 'Second of two techs: (70 + 60) ÷ 2 = 65');
  const renita = { second_tech: true, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: '70"–85"', line_total: 149 },
    { name: 'Soundbar Installation', quantity: 2, unit_price: 60, line_total: 120 },
    { name: 'Second Cleaner', line_total: 70, kind: 'fee' },
  ] };
  eq(computeJobPay(job({ ...renita }), 'Kregg').pay, 140, 'Renita: Kregg = (70+80+70+60=280) ÷ 2 = 140');
  eq(computeJobPay(job({ ...renita, is_secondary: true }), 'Steve').pay, 140, 'Renita: Steve = 280 ÷ 2 = 140');
  eq(computeJobPay(job({ ...renita, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: '70"–85"', line_total: 149 },
    { name: 'Soundbar Installation', line_total: 60 },
    { name: 'Second Cleaner', line_total: 70, kind: 'fee' },
  ] }), 'Kregg').pay, 122.5, 'Odd pool ($245) still splits to the cent = 122.50');
  const twoLeg = { second_tech: true, line_items: [
    { name: '70"–85"', line_total: 149 },
    { name: '70"–85"', line_total: 149 },
    { name: 'Second Cleaner', line_total: 70, kind: 'fee' },
  ] };
  eq(computeJobPay(job({ ...twoLeg }), 'Kregg').pay, 110, 'Two techs: (160 + 60) ÷ 2 = 110');
  eq(computeJobPay(job({ ...twoLeg, is_secondary: true }), 'Steve').pay, 110, 'Second tech: (160 + 60) ÷ 2 = 110');

  const saner = { travel_payout: 10, line_items: [
    { name: '70"–85"', line_total: 149 },
    { name: 'I have my own mounting bracket', line_total: 0 },
    { name: 'TV not over a fireplace', line_total: 0 },
    { name: 'Drywall', line_total: 0 },
    { name: 'My TV is 70-85 inches and I can help lift it', line_total: 0 },
    { name: 'No, I will handle TV removal myself', line_total: 0 },
  ] };
  eq(computeJobPay(job({ ...saner }), 'Steve').pay, 80, 'Saner solo: 80 base, no surcharge line -> no travel = 80');
  eq(computeJobPay(job({ ...saner, second_tech: true }), 'Steve').pay, 40, 'Saner two techs: base 80 split = 40, no surcharge line -> no travel');
  eq(computeJobPay(job({ ...saner, second_tech: true, is_secondary: true }), 'Zach').pay, 40, 'Saner second tech: 40, no travel (no surcharge line)');
  eq(computeJobPay(job({ ...saner }), 'Steve').flags.length, 0, 'Saner solo: no review flags');
  eq(computeJobPay(job({ line_items: [
    { name: '70"–85"', line_total: 149 },
    { name: 'Customer supplied bracket', line_total: 0 },
    { name: 'Customer will help lift', line_total: 0 },
  ], second_tech: true }), 'Steve').pay, 40, 'two techs: base 80 split = 40 each');
  eq(computeJobPay(job({ line_items: [
    { name: '70"–85"', line_total: 149 },
    { name: 'Customer supplied bracket', line_total: 0 },
  ] }), 'Juan').pay, 90, 'Customer supplied bracket pays $0 (Juan base 90)');

  eq(computeJobPay(job({ price: 891, subtotal: 823, line_items: [
    { name: '60"-69"', line_total: 119 },
    { name: '33"-59"', line_total: 109 },
    { name: 'Tilting (recommended)', line_total: 120 },
    { name: 'Yes, hide the wires BEHIND the wall', line_total: 150 },
    { name: 'Soundbar Installation', line_total: 50 },
    { name: 'LED Lights', line_total: 100 },
    { name: '1 hour of Handyman Labor', line_total: 85 },
    { name: 'Service area surcharge', line_total: 15, kind: 'fee' },
    { name: 'After-hours fee (8 PM)', line_total: 75, kind: 'fee' },
    { name: 'Tax (8.25%)', line_total: 67.9, kind: 'fee' },
  ] }), 'Juan').pay, 407, 'mixed TV+handyman add-on (Juan) = 407 (bracket now $0 for Juan)');

  eq(computeJobPay(job({ business_slug: 'tidyhaus', price: 376.19, subtotal: 269, line_items: [
    { name: 'Tv recycle', quantity: 1, unit_price: 75, line_total: 75 },
    { name: 'TV Size: 33"-59"', quantity: 1, unit_price: 109, line_total: 109 },
    { name: 'Bracket: I have my own bracket', quantity: 1, unit_price: 0, line_total: 0 },
    { name: 'Add-ons: 1 hour of Handyman Labor', quantity: 2, unit_price: 85, line_total: 170 },
    { name: 'Tax (8.25%)', quantity: 1, unit_price: 22.19, line_total: 22.19, kind: 'fee' },
  ] }), 'Kregg').pay, 265, 'mixed job: handyman hours from qty (2h=130), not the "1 hour" label');

  eq(computeJobPay(job({ business_slug: 'tidyhaus', line_items: [
    { name: '33"-59"', quantity: 1, unit_price: 109, line_total: 109 },
    { name: 'Handyman Labor: Home Repairs — 2 hours', quantity: 2, unit_price: 85, line_total: 170 },
  ] }), 'Kregg').pay, 190, 'mixed job: "— 2 hours" label with qty 2 pays 2h (130) + base 60, not 4h');

  eq(computeJobPay(job({ business_slug: 'tidyhaus', line_items: [
    { name: '33"-59"', quantity: 1, unit_price: 109, line_total: 109 },
    { name: 'Handyman Labor', quantity: 1, unit_price: 170, line_total: 170 },
  ] }), 'Kregg').flags.some(f => /verify hours/.test(f)), true, 'handyman qty/charge mismatch is flagged');

  eq(computeJobPay(job({ business_slug: 'tidyhaus', line_items: [
    { name: 'Tv recycle', quantity: 1, unit_price: 75, line_total: 75 },
  ] }), 'Kregg').pay, 75, 'Tv recycle = $75 to the cleaner');
  eq(computeJobPay(job({ business_slug: 'tidyhaus', line_items: [
    { name: 'Tv recycle', quantity: 2, unit_price: 75, line_total: 150 },
  ] }), 'Kregg').pay, 150, 'Tv recycle ×2 = $150');

  eq(computeJobPay(job({ line_items: [{ name: 'Mounting of Dry Erase Board 4 x 6', line_total: 170 }] }), 'Kregg').pay, 65, 'dry erase board: 1 board @ $65 = 65 (not price-inferred)');
  eq(computeJobPay(job({ line_items: [{ name: 'Mounting of Dry Erase Board 4 x 6', line_total: 170 }] }), 'Kregg').flags.length, 0, 'dry erase board: matched item, no flag');
  eq(computeJobPay(job({ line_items: [
    { name: 'Mounting of Dry Erase Board 4 x 6', quantity: 5, unit_price: 170, line_total: 850 },
    { name: 'TV Size: 60–69 inch', quantity: 3, unit_price: 135, line_total: 405 },
    { name: 'Bracket: Full Motion', quantity: 3, unit_price: 115, line_total: 345 },
    { name: 'Dismount: Guaranteed Dismount Service', line_total: 35 },
    { name: 'Tax (8.25%)', line_total: 78.79, kind: 'fee' },
  ], business_slug: 'doms', travel_payout: 50 }), 'Steve').pay, 535, 'reported job: 5×$65 boards (325) + 3×60-69 (210); zip travel_payout does NOT pay without a surcharge line = 535');
  eq(computeJobPay(job({ line_items: [
    { name: '60"-69"', line_total: 119 },
    { name: 'Mounting of Dry Erase Board 4 x 6', line_total: 170 },
  ] }), 'Kregg').pay, 135, 'other 60-69 (70) + 1 dry erase board (65) = 135');
  eq(computeJobPay(job({ line_items: [{ name: 'Custom mount job', line_total: 200 }] }), 'Kregg').flags.length, 1, 'non-clean custom price flags hours');
  eq(computeJobPay(job({ tip: 50, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Service minimum', line_total: 20 },
  ] }), 'Kregg').total, 120, 'Service minimum skipped: 70 base + 50 tip = 120 total');
  eq(computeJobPay(job({ line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Service minimum', line_total: 20 },
  ] }), 'Kregg').flags.length, 0, 'Service minimum: no review flag');

  eq(computeJobPay(job({ business_slug: 'doms', travel_payout: 75, line_items: [
    { name: 'Dismount', line_total: 80 },
    { name: '60"–69"', line_total: 119 },
    { name: '1 hour of Handyman Labor', line_total: 85 },
    { name: 'Hide Cords in Wall', line_total: 75 },
    { name: 'Service area surcharge', line_total: 100, kind: 'fee' },
  ] }), 'Gregory').pay, 310, 'Ella job: 60+70+65+35 hide-cords +80 travel = 310, no flag');
  eq(computeJobPay(job({ line_items: [{ name: 'Hide Cords in Wall', line_total: 75 }] }), 'Gregory').flags.length, 0, 'Hide Cords in Wall: no review flag');
  eq(computeJobPay(job({ line_items: [{ name: 'Hide Cords Outside the Wall', line_total: 40 }] }), 'Kregg').pay, 15, 'Hide Cords Outside the Wall = $15');
  eq(computeJobPay(job({ line_items: [{ name: '60"–69"', line_total: 119 }, { name: 'Hide Cords in Wall', line_total: 75 }] }), 'Juan').pay, 125, 'Juan: 60-69 (80) + cords in wall (45) = 125');

  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Processing Fee', line_total: 42 },
  ] }), 'Kregg').pay, 60, 'Processing Fee (service line) not paid as custom labor');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Setup Fee', line_total: 50 },
  ] }), 'Kregg').pay, 60, 'Setup Fee not paid as custom labor');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Mystery add-on', line_total: 30 },
  ] }), 'Kregg').pay, 60, 'sub-$80 unmatched line pays $0 (not a phantom $65 hour)');
  eq(computeJobPay(job({ line_items: [{ name: 'Mystery add-on', line_total: 30 }] }), 'Kregg').flags.length, 1, 'small unmatched line is flagged');
  eq(computeJobPay(job({ line_items: [
    { name: 'TV Size: 33"–59" ×2', line_total: 218, quantity: 2, unit_price: 109 },
    { name: 'Bracket: Samsung Frame / LG Gallery (in-box bracket) ×2', line_total: 30, quantity: 2, unit_price: 15 },
  ] }), 'Juan').pay, 150, 'Juan 2× 33-59 (120) + frame/gallery in-box ×2 ($15×2=30) = 150');
  eq(computeJobPay(job({ line_items: [
    { name: 'TV Size: 33"–59" ×2', line_total: 218, quantity: 2, unit_price: 109 },
    { name: 'Use the bracket in the box (Samsung Frame / LG Gallery)', line_total: 0 },
    { name: 'Yes, hide the wires BEHIND the wall', line_total: 60 },
    { name: 'Yes, hide the wires OUTSIDE the wall', line_total: 25 },
  ] }), 'TK').pay, 185, 'TK Frame job: 120 base + 15 frame bracket + 35 + 15 = 185');
  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 },
    { name: 'I will be using the bracket that comes in the box (Samsung Frame TV)', line_total: 0 }] }), 'Kregg').pay, 75, 'frame in-box bracket ($15) any wording = 60 + 15');
  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 },
    { name: 'Bracket: Samsung Frame / LG Gallery (in-box bracket)', line_total: 0 }] }), 'Juan').pay, 75, 'frame bracket Juan too = 60 + 15');
  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 },
    { name: 'Use the bracket in the box', line_total: 0 }] }), 'Zach').pay, 75, 'bare "use the bracket in the box" = 60 + 15');
  {
    const r = computeJobPay(job({ line_items: [
      { name: '60"-69"', line_total: 119 },
      { name: 'Samsung Frame TV', line_total: 350 },
    ] }), 'Juan');
    eq(r.pay, 80 + 170, 'mislabeled $350 "Samsung Frame TV" line = OneConnect box = flat $170 (not $15, not hourly)');
    eq(r.flags.length, 0, 'mislabeled $350 "Samsung Frame TV" line: no review flag');
    eq(computeJobPay(job({ line_items: [{ name: '60"-69"', line_total: 119 },
      { name: 'Install OneConnect Box', line_total: 350 }] }), 'Kregg').pay, 70 + 170, 'OneConnect box = $170 for every cleaner');
  }
  eq(computeJobPay(job({ line_items: [{ name: '60"-69"', line_total: 119 },
    { name: 'Samsung Frame TV', line_total: 25 }] }), 'Juan').pay, 95, 'a real $25 Samsung Frame in-box bracket line still pays its flat $15');

  eq(computeJobPay(job({ price: 1034, subtotal: 955, business_slug: 'doms', travel_payout: 50, line_items: [
    { name: 'Mounting of Dry Erase Board 4 x 6', line_total: 170 },
    { name: 'TV Size: 60–69 inch', quantity: 3, unit_price: 135, line_total: 405 },
    { name: 'Bracket: Full Motion', quantity: 3, unit_price: 115, line_total: 345 },
    { name: 'Fireplace: TV not over a fireplace', quantity: 3, line_total: 0 },
    { name: 'Wall Surface: Drywall', quantity: 3, line_total: 0 },
    { name: 'Dismount: Guaranteed Dismount Service', line_total: 35 },
    { name: 'Tax (8.25%)', line_total: 78.79, kind: 'fee' },
  ] }), 'TK').pay, 275, 'Joseph job TK = 210 base + 65 board; no surcharge line -> no travel = 275');
  eq(computeJobPay(job({ price: 1034, subtotal: 955, business_slug: 'doms', travel_payout: 50, line_items: [
    { name: 'Mounting of Dry Erase Board 4 x 6', line_total: 170 },
    { name: 'TV Size: 60–69 inch ×3', quantity: 3, unit_price: 135, line_total: 405 },
    { name: 'Bracket: Full Motion ×3', quantity: 3, unit_price: 115, line_total: 345 },
    { name: 'Fireplace: TV not over a fireplace ×3', quantity: 3, line_total: 0 },
    { name: 'Wall Surface: Drywall ×3', quantity: 3, line_total: 0 },
    { name: 'Dismount: Guaranteed Dismount Service', line_total: 35 },
    { name: 'Tax (8.25%)', line_total: 78.79, kind: 'fee' },
  ] }), 'TK').pay, 275, 'Joseph job with ×3-baked names still = 275, not 650 (no travel w/o surcharge line)');
  eq(computeJobPay(job({ scheduled_at: '2026-08-10T18:00:00Z', line_items: [
    { name: '60"-69"', line_total: 119 },
    { name: 'Bracket: Full Motion ×3', quantity: 3, unit_price: 115, line_total: 345 },
  ] }), 'Juan').pay, 260, 'PRE-2026-08-16 Juan 60-69 (80) + full motion ×3 ($60×3=180) via baked ×3 = 260');
  eq(computeJobPay(job({ line_items: [
    { name: '60"-69"', line_total: 119 },
    { name: 'Bracket: Full Motion ×3', quantity: 3, unit_price: 115, line_total: 345 },
  ] }), 'Juan').pay, 80, 'post-cutoff Juan gets base only, brackets ×3 pay $0');

  eq(computeJobPay(job({ scheduled_at: '2026-08-10T18:00:00Z', line_items: [
    { name: '60"-69"', line_total: 119 },
    { name: 'Tilting (recommended)', line_total: 180, quantity: 3, unit_price: 60 },
  ] }), 'Juan').pay, 185, 'PRE-2026-08-16 Juan 60-69 + 3× tilting = 80 + 105 = 185');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Soundbar Installation', line_total: 70, unit_price: 35 },
  ] }), 'Zach').pay, 130, 'other 33-59 + 2× soundbar (inferred) = 60 + 70 = 130');

  eq(computeJobPay(job({ line_items: [{ name: '32" or Less', line_total: 99 }, { name: 'Tilting (recommended)', line_total: 0 }] }), 'Zach').pay, 50, 'tilting Other adds 0');
  eq(computeJobPay(job({ scheduled_at: '2026-08-10T18:00:00Z', line_items: [{ name: '32" or Less', line_total: 99 }, { name: 'Tilting (recommended)', line_total: 0 }] }), 'Juan').pay, 85, 'PRE-2026-08-16 tilting Juan adds 35');
  eq(computeJobPay(job({ line_items: [{ name: '32" or Less', line_total: 99 }, { name: 'Tilting (recommended)', line_total: 0 }] }), 'Juan').pay, 50, 'post-cutoff tilting adds $0 for Juan, same as every other cleaner');

  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 }, { name: 'Hide wires BEHIND the wall', line_total: 60 }] }), 'Steve').pay, 95, 'behind-wall other = 60+35');
  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 }, { name: 'Hide wires BEHIND the wall', line_total: 60 }] }), 'Juan').pay, 105, 'behind-wall Juan = 60+45');
  eq(computeJobPay(job({ line_items: [{ name: '70"-85"', line_total: 149 }, { name: 'Outside wire concealment', line_total: 25 }] }), 'Zach').pay, 95, 'hand-typed "outside wire concealment" (no "wall") = 80+15');
  eq(computeJobPay(job({ line_items: [{ name: '70"-85"', line_total: 149 }, { name: 'Outside wire concealment', line_total: 25 }] }), 'Juan').pay, 105, 'same, Juan = 90+15');
  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 }, { name: 'Wire concealment', line_total: 60 }] }), 'Zach').pay, 95, 'hand-typed "wire concealment" alone defaults to behind-wall = 60+35');

  eq(computeJobPay(job({ service_name: 'Handyman Services', subtotal: 255, line_items: [{ name: 'Handyman Labor', quantity: 3, unit_price: 85, line_total: 255 }] }), 'Kregg').pay, 195, 'handyman 3h line qty -> 3h*65=195');
  eq(computeJobPay(job({ service_name: 'Handyman Services', subtotal: 50, line_items: [] }), 'Kregg').pay, 130, 'handyman min 2h = 130');
  eq(computeJobPay(job({ service_name: 'Handyman Services', subtotal: 254.39, line_items: [
    { name: 'Handyman Labor: Furniture Assembly — 2 hours', quantity: 2, unit_price: 85, line_total: 170 },
    { name: 'Travel Fee', kind: 'addon', line_total: 65 },
    { name: 'Tax (8.25%)', kind: 'fee', line_total: 19.39 },
  ] }), 'Steve').pay, 182, 'handyman 2h labor line + travel fee + tax -> 2h*65=130 + $52 travel share = 182, not inflated by folding the fee/tax into "hours"');
  const handymanTwoTech = { service_name: 'Handyman Services', subtotal: 75, second_tech: true, line_items: [
    { name: 'Handyman Labor', quantity: 2, unit_price: 85, line_total: 170 },
    { name: 'Second Cleaner', line_total: 70 },
  ] };
  eq(computeJobPay(job({ ...handymanTwoTech }), 'Kregg').pay, 95, 'two-tech handyman splits: (130+60)/2 = 95');
  eq(computeJobPay(job({ ...handymanTwoTech, is_secondary: true }), 'Steve').pay, 95, 'second of two-tech handyman also gets 95');

  eq(computeJobPay(job({ line_items: [{ name: 'Dismount', line_total: 119 }] }), 'Zach').pay, 60, 'dismount >$60 -> 60');
  eq(computeJobPay(job({ line_items: [{ name: 'Dismount', line_total: 45 }] }), 'Zach').pay, 50, 'dismount <=$60 -> 50');
  eq(computeJobPay(job({ line_items: [{ name: 'Guaranteed Dismount Service', line_total: 35 }] }), 'Zach').pay, 0, 'GD sold -> 0');
  eq(computeJobPay(job({ price: 0, line_items: [{ name: 'Guaranteed Dismount Service', line_total: 0 }] }), 'Zach').pay, 50, 'GD redeemed, no scheduled_at -> defaults to new $50 rate');
  eq(computeJobPay(job({ price: 0, scheduled_at: '2026-07-15T18:00:00Z', line_items: [{ name: 'Guaranteed Dismount Service', line_total: 0 }] }), 'Zach').pay, 60, 'GD redeemed, scheduled BEFORE Aug 3 2026 -> old $60 rate');
  eq(computeJobPay(job({ price: 0, scheduled_at: '2026-08-10T18:00:00Z', line_items: [{ name: 'Guaranteed Dismount Service', line_total: 0 }] }), 'Zach').pay, 50, 'GD redeemed, scheduled ON/AFTER Aug 3 2026 -> new $50 rate');
  eq(computeJobPay(job({ line_items: [{ name: 'Dismount x3', line_total: 170 }] }), 'Zach').pay, 150, 'dismount x3 $170 -> 3x$50=150');
  eq(computeJobPay(job({ line_items: [{ name: 'Dismount: No, I will handle it myself', line_total: 0 }] }), 'Zach').pay, 0, 'declined dismount ($0) pays nothing');
  eq(computeJobPay(job({ price: 378, subtotal: 349, business_slug: 'tidyhaus', line_items: [
    { name: 'TV Dismount', line_total: 129 },
    { name: 'TV Size: 60–69 inch', line_total: 135 },
    { name: 'Bracket: I have my own mount', line_total: 0 },
    { name: 'Dismount: No, I will handle', line_total: 0 },
    { name: 'Add-ons: Handyman Labor', line_total: 85 },
    { name: 'Tax (8.25%)', line_total: 28.79, kind: 'fee' },
  ] }), 'Gregory').pay, 195, 'real dismount + base + handyman, declined $0 dismount ignored = 195');

  eq(computeJobPay(job({ service_name: 'TV Swap', line_items: [{ name: 'TV Swap', line_total: 120 }] }), 'Zach').pay, 60, 'tv swap flat 60');

  eq(computeJobPay(job({ tip: 20, line_items: [{ name: '33"–59"', line_total: 109 }] }), 'Zach').pay, 60, 'labor pay excludes tip = 60');
  eq(computeJobPay(job({ tip: 20, line_items: [{ name: '33"–59"', line_total: 109 }] }), 'Zach').tip, 20, 'tip returned separately = 20');
  eq(computeJobPay(job({ tip: 20, line_items: [{ name: '33"–59"', line_total: 109 }] }), 'Zach').total, 80, 'total = base 60 + tip 20');
  eq(computeJobPay(job({ line_items: [{ name: '33"–59"', line_total: 109 }, { name: 'Tip', line_total: 15 }] }), 'Zach').tip, 15, 'tip line item counts as tip, not labor');
  eq(computeJobPay(job({ tip: 20, line_items: [{ name: '33"–59"', line_total: 109 }] }), 'Zach').breakdown.some(b => /tip/i.test(b.label)), false, 'breakdown has no tip lines');
  eq(computeJobPay(job({ tip: 20, scheduled_at: '2026-10-05T18:00:00Z', notes: 'Payroll override: $152.50', line_items: [] }), 'Kregg').pay, 152.5, 'override = labor 152.50');
  eq(computeJobPay(job({ tip: 20, scheduled_at: '2026-10-05T18:00:00Z', notes: 'Payroll override: $152.50', line_items: [] }), 'Kregg').total, 172.5, 'override + tip 20 = 172.50 total');
  eq(computeJobPay(job({ tip: 30, scheduled_at: '2026-09-25T18:00:00Z', notes: 'Payroll override: $211.50', line_items: [] }), 'Steve').total, 211.5, 'pre-10/04 override stays all-in (already paid): 211.50');
  eq(computeJobPay(job({ payment_status: 'unpaid', price: 150, amount_paid: 0, tip: 20, line_items: [{ name: '33"–59"', line_total: 109 }] }), 'Zach').total, 0, 'deferred job: no tip either');

  eq(computeJobPay(job({ payment_status: 'unpaid', price: 0, notes: 'Assurion job\nTelevision — $60\n\nTech pay: $60', line_items: [] }), 'Steve').pay, 60, 'assurion note 60 (not deferred)');

  eq(computeJobPay(job({ payment_status: 'unpaid', price: 150, amount_paid: 0, line_items: [{ name: '33"–59"', line_total: 109 }] }), 'Zach').state, 'deferred', 'unpaid -> deferred');

  eq(computeJobPay(job({ zenbooker_job_number: '020989', line_items: [] }), 'Kregg').pay, 60, 'CUSTOM_PAY 020989 = 60');

  eq(computeJobPay(job({ second_tech: true, tip: 20, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Second Cleaner', line_total: 70 }
  ] }), 'Kregg').total, 75, 'two techs (70/2 + 20/2 + 30 = 35 + 10 + 30)');
  eq(computeJobPay(job({ second_tech: true, tip: 20, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'Second Cleaner', line_total: 70 }
  ] }), 'Kregg').tip, 10, 'two techs: tip split 50/50 = 10');

  eq(computeJobPay(job({ second_tech: true, line_items: [
    { name: '70"–84"', line_total: 169 },
    { name: 'Lifting Help', line_total: 70 }
  ] }), 'Kregg').pay, 70, 'two techs lifting help (80/2 + 30 = 40 + 30)');

  eq(computeJobPay(job({ second_tech: true, line_items: [
    { name: '70"–84"', line_total: 169 },
    { name: 'Second Cleaner (Large TVs): 2 technicians', line_total: 70 }
  ] }), 'Kregg').pay, 70, 'two techs, relabeled "2 technicians" line (80/2 + 30 = 40 + 30)');
  eq(matchSize('Second Cleaner (Large TVs): 2 technicians'), null, '"2 technicians" is never read as a TV-size base line');

  eq(computeJobPay(job({ second_tech: true, line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Second Cleaner', line_total: 50 }
  ] }), 'Zach').pay, 30, 'two techs no bonus (60/2 = 30, no $30 bonus for <70)');

  eq(computeJobPay(job({ tip: 40, line_items: [
    { name: '98"+', line_total: 229 },
    { name: 'Second Cleaner', line_total: 70 }
  ] }), 'Juan').total, 230, 'Juan two-person NOT split (130 + 40 + 60)');
  eq(computeJobPay(job({ second_tech: true, tip: 40, line_items: [
    { name: '98"+', line_total: 229 },
    { name: 'Second Cleaner', line_total: 70 }
  ] }), 'Kregg').total, 115, 'Other tech two-person splits (130/2 + 40/2 + 30)');
  eq(computeJobPay(job({ line_items: [
    { name: '70"-85"', line_total: 149 },
    { name: 'Second Cleaner', line_total: 70 },
  ] }), 'TK').pay, 140, 'TK two-person NOT split: 80 base + full 60 = 140');
  eq(computeJobPay(job({ second_tech: true, line_items: [
    { name: '70"-85"', line_total: 149 },
    { name: 'Second Cleaner', line_total: 70 },
  ] }), 'Kregg').pay, 70, 'normal tech same job splits: 80/2 + 30 = 70');
  eq(computeJobPay(job({ second_tech: true, tip: 40, line_items: [
    { name: '98"+', line_total: 229 },
    { name: 'Second Cleaner', line_total: 70 }
  ] }), 'TK').total, 115, 'TK WITH a real second cleaner splits like anyone else: (130+40+60)/2 = 115');

  const localJob=(extra)=>job({ business_slug: 'doms', line_items: [
    { name: 'TV Size: 32–49 inch', quantity: 1, unit_price: 100, line_total: 100 },
    { name: 'Local travel credit', line_total: -20, kind: 'fee' },
  ], ...extra });
  eq(computeJobPay(localJob({ travel_payout: -10 }), 'TK').pay - computeJobPay(localJob({ travel_payout: 0 }), 'TK').pay, -10, 'local credit + -$10 zip payout docks the cleaner $10');
  eq(computeJobPay(job({ business_slug: 'doms', travel_payout: -10, line_items: [
    { name: 'TV Size: 32–49 inch', quantity: 1, unit_price: 100, line_total: 100 },
  ] }), 'TK').pay, computeJobPay(job({ business_slug: 'doms', travel_payout: 0, line_items: [
    { name: 'TV Size: 32–49 inch', quantity: 1, unit_price: 100, line_total: 100 },
  ] }), 'TK').pay, 'negative zip payout without a credit line changes nothing');
  eq(travelPayoutForSurcharge(0), 0, 'travel share: $0 -> $0');
  eq(travelPayoutForSurcharge(15), 12, 'travel share: $15 -> $12');
  eq(travelPayoutForSurcharge(50), 40, 'travel share: $50 -> $40 (off-tier, the JR Figueroa case)');
  eq(travelPayoutForSurcharge(65), 52, 'travel share: $65 -> $52');
  eq(travelPayoutForSurcharge(100), 80, 'travel share: $100 -> $80');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Service area surcharge', line_total: 65 },
  ] }), 'Zach').pay, 112, 'surcharge $65 -> +$52 travel (60 base + 52)');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Travel Fee', line_total: 50 },
  ] }), 'Zach').pay, 100, 'off-tier $50 travel fee (legacy "Travel Fee" label, jobs booked before 2026-08) -> +$40 travel (60 base + 40)');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Travel', line_total: 50 },
  ] }), 'Zach').pay, 100, 'off-tier $50, current "Travel" label -> +$40 travel (60 base + 40), same as the legacy label');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Travel discount', line_total: -10 },
  ] }), 'Zach').pay, 60, 'a negative "Travel discount" line pays $0 travel share, not a payout off its magnitude');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Service area surcharge', line_total: 15 },
  ] }), 'Zach').pay, 72, 'surcharge $15 -> +$12 travel (80% of $15)');
  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'Service area surcharge', line_total: 100 },
  ] }), 'Zach').pay, 140, 'surcharge $100 -> +$80 travel (80% of $100)');
  eq(computeJobPay(job({ price: 471, subtotal: 435, business_slug: 'tidyhaus', line_items: [
    { name: '60"–69"', line_total: 135 },
    { name: '33"–59"', line_total: 125 },
    { name: 'Brick / Stone', line_total: 35 },
    { name: 'Yes, hide the wires OUTSIDE the wall', line_total: 25 },
    { name: 'Soundbar Installation', line_total: 50 },
    { name: 'Service area surcharge', line_total: 65 },
  ] }), 'TK').pay, 257, 'TK two-TV + $65 surcharge = 205 labor + $52 travel = 257');

  eq(computeJobPay(job({ line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'After-Hours Service Fee (8 PM)', kind: 'fee', line_total: 75 }
  ] }), 'Kregg').pay, 135, '8pm single tech (60 + 75 bonus)');

  eq(computeJobPay(job({ second_tech: true, line_items: [
    { name: '60"–69"', line_total: 119 },
    { name: 'After-Hours Service Fee (8 PM)', kind: 'fee', line_total: 75 },
    { name: 'Second Cleaner', line_total: 70 }
  ] }), 'Zach').pay, 140, '8pm two techs (70/2 + 30 + 75 = 35 + 30 + 75)');

  eq(computeJobPay(job({ created_at: '2026-10-23T00:00:00Z', line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'After-Hours Service Fee (8 PM)', kind: 'fee', line_total: 75 }
  ] }), 'Kregg').pay, 125, '8pm new booking (60 + 65 bonus)');
  eq(computeJobPay(job({ created_at: undefined, line_items: [
    { name: '33"–59"', line_total: 109 },
    { name: 'After-Hours Service Fee (8 PM)', kind: 'fee', line_total: 75 }
  ] }), 'Kregg').pay, 125, '8pm quote, no created_at (60 + 65 bonus)');

  const wall = (nm, lt) => ({ line_items: [
    { kind: 'option', name: '33"-59"', line_total: 109 },
    { kind: 'option', name: nm, line_total: lt },
  ] });
  eq(computeJobPay(job(wall('Full Motion Mount', 115)), 'Gregory').pay, 60, 'hand-typed "Full Motion Mount" pays $0 like any bracket (not a $65 custom hour)');
  eq(computeJobPay(job(wall('Full Motion Mount', 115)), 'Juan').pay, 60, 'Juan gets $0 for the full-motion bracket from 2026-08-16 on (no scheduled_at = now = new rule)');
  eq(computeJobPay(job({ ...wall('Full Motion Mount', 115), scheduled_at: '2026-08-10T18:00:00Z' }), 'Juan').pay, 120, 'Juan keeps his $60 bracket reimbursement on a job scheduled BEFORE 2026-08-16');
  eq(computeJobPay(job({ ...wall('Full Motion Mount', 115), scheduled_at: '2026-08-16T18:00:00Z' }), 'Juan').pay, 60, 'Juan bracket pay is $0 exactly on the 2026-08-16 cutoff');
  eq(computeJobPay(job({ line_items: [{ kind: 'option', name: '33\"-59\"', line_total: 109 }, { kind: 'option', name: 'Flat Bracket', line_total: 60 }] }), 'Juan').pay, 60, 'catalog "Flat Bracket" also pays Juan $0 now');
  eq(computeJobPay(job({ line_items: [{ kind: 'option', name: '33\"-59\"', line_total: 109 }, { kind: 'option', name: 'Samsung Frame TV in box bracket', line_total: 15 }] }), 'Juan').pay, 75, 'Samsung Frame in-box bracket still pays Juan $15 (install labor, all techs)');
  eq(computeJobPay(job(wall('Full Motion Mount', 115)), 'Gregory').flags.length, 0, '"Full Motion Mount" raises no review flag');
  eq(computeJobPay(job(wall('Bracket: Tilting Mount', 65)), 'Gregory').pay, 60, 'hand-typed "Tilting Mount" pays $0');
  eq(computeJobPay(job(wall('Customer supplied bracket', 0)), 'Gregory').pay, 60, 'customer-supplied bracket still $0 (never reaches the new fallback)');
  {
    const xl = (nm) => ({ line_items: [
      { kind: 'option', name: '86"-97"', line_total: 179 },
      { kind: 'option', name: nm, line_total: 110 },
    ] });
    const pre = { scheduled_at: '2026-08-10T18:00:00Z' };
    for (const [nm, juanPre] of [
      ['86"+ TV Flat Bracket', 135], ['86"+ TV Tilting Bracket', 145], ['86"+ TV Full Motion Bracket', 170],
      ['Bracket: 86"+ TV Tilting Bracket', 145],
      ['85"+ TV Tilting Bracket', 145], ['85"-100" TV Full Motion Bracket', 170],
    ]) {
      eq(computeJobPay(job(xl(nm)), 'Kregg').flags.length, 0, `XL bracket "${nm}": no review flag`);
      eq(computeJobPay(job(xl(nm)), 'Kregg').pay, 110, `XL bracket "${nm}": 85-97 base 110 + bracket $0`);
      eq(computeJobPay(job(xl(nm)), 'Juan').pay, 110, `XL bracket "${nm}": Juan $0 bracket from 2026-08-16 on`);
      eq(computeJobPay(job({ ...xl(nm), ...pre }), 'Juan').pay, juanPre, `XL bracket "${nm}": Juan pre-cutoff reimbursement`);
    }
  }
  eq(computeJobPay(job(wall('Wall Surface: Brick or Stone', 35)), 'Gregory').pay, 85, 'catalog "Brick or Stone" pays its $25 surface rate (was silently $0)');
  eq(computeJobPay(job(wall('Wall Surface: Brick or Stone', 35)), 'Gregory').flags.length, 0, '"Brick or Stone" raises no unmatched-line flag');
  eq(computeJobPay(job(wall('Wall Surface: Uneven Stone or Tile', 50)), 'Gregory').pay, 100, '"Uneven Stone or Tile" pays $40, not the $25 brick/stone rate');
  eq(computeJobPay(job(wall('Wall Surface: Outdoor Stucco', 35)), 'Gregory').pay, 95, 'stucco surface pays $35');
  eq(computeJobPay(job(wall('Wall Surface: Drywall', 0)), 'Gregory').pay, 60, 'drywall surface pays $0');

  eq(computeJobPay(job(wall('Custom bracket', 250)), 'Gregory').pay, 60, 'unrecognized "Custom bracket" pays $0, not $195 of custom hours');
  eq(computeJobPay(job(wall('soundbar bracket', 164)), 'Gregory').pay, 60, 'unrecognized "soundbar bracket" pays $0, not $130 of custom hours');
  eq(computeJobPay(job(wall('Custom bracket', 250)), 'Juan').pay, 60, 'unrecognized bracket pays $0 for Juan too (his 25/35/60 covers only the three types he stocks)');
  eq(computeJobPay(job(wall('Apple TV installation, mounting bracket included', 25)), 'Gregory').pay, 75, 'Apple TV install still pays $15 despite the word "bracket"');
  eq(computeJobPay(job(wall('I will be using the bracket that comes in the box (Samsung Frame TV)', 25)), 'Gregory').pay, 75, 'Frame in-box bracket still pays its $15');
  eq(computeJobPay(job(wall('Mantel Mount', 195)), 'Gregory').pay, 170, 'Mantel Mount still pays its $110 of real labor');
  eq(computeJobPay(job(wall('TV Setup - Gaming System, VCR, and Blu Ray', 129)), 'Gregory').pay, 190, 'a real custom job still bills hourly');

  const dis = q => ({ line_items: [
    { kind: 'option', name: '33"-59"', line_total: 109 },
    { kind: 'service', name: 'Dismount', line_total: 120, unit_price: 60, ...(q ? { quantity: 2 } : {}) },
  ] });
  eq(computeJobPay(job(dis(true)), 'Gregory').pay, 160, 'dismount qty 2 @ $120 pays 2 x $50 = $100 (+$60 base) when quantity is selected');
  eq(computeJobPay(job(dis(false)), 'Gregory').pay, 120, 'the same line WITHOUT quantity pays only $60 -- this is the regression to guard against');

  const segal = { line_items: [
    { name: 'Inwall Concealment', line_total: 135, quantity: 1, unit_price: 135, kind: 'option' },
    { name: 'Travel', line_total: 100, quantity: 1, unit_price: 100, kind: 'addon' },
    { name: 'Military Discount', line_total: -30, quantity: 1, unit_price: -30, kind: 'coupon' },
    { name: 'Tax (8.25%)', line_total: 16.91, quantity: 1, unit_price: 16.91, kind: 'fee' },
  ] };
  eq(computeJobPay(job(segal), 'Gregory').pay, 210, 'Inwall Concealment as custom hours ($130) + travel payout ($80) = $210');
  eq(computeJobPay(job({ line_items: [
    { name: '33"-59"', line_total: 109 },
    { name: 'Travel', line_total: 65, quantity: 1, unit_price: 65, kind: 'addon' },
  ] }), 'Gregory').pay, 60 + 52, 'base (60) + travel payout only (80% of 65 = 52) -- Travel line itself must not ALSO price as custom hours');

  eq(computeJobPay(job({ business_slug: 'tidyhaus', line_items: [
    { name: 'Behind wall concealment', line_total: 139, quantity: 1, unit_price: 139, kind: 'option' },
    { name: 'Travel', line_total: 50, quantity: 1, unit_price: 50, kind: 'addon' },
    { name: 'Tax (8.25%)', line_total: 15.59, quantity: 1, unit_price: 15.59, kind: 'fee' },
  ] }), 'Steve').pay, 100, 'stand-alone Behind wall concealment = $60 + travel payout ($40) = $100');

  eq(computeJobPay(job({ line_items: [
    { name: '65" TV', line_total: 99, quantity: 1 },
    { name: 'Move: take down 4 TVs', line_total: 140, quantity: 1 },
    { name: 'Move: 25 miles', line_total: 70, quantity: 1 },
  ] }), 'Zach').pay - computeJobPay(job({ line_items: [{ name: '65" TV', line_total: 99, quantity: 1 }] }), 'Zach').pay, 140, 'move: 4 TVs ($70+$20) + 25 mi ($20+15x$2) = +$140');
  eq((movePayFor('Move: take down 2 TVs', 105) || {}).amount, 70, 'move: 2 TVs = $70');
  eq((movePayFor('Move: 8 miles', 25) || {}).amount, 20, 'move: 8 mi = $20');
  eq((movePayFor('Move: 10 miles', 25) || {}).amount, 20, 'move: exactly 10 mi = $20');
  eq(movePayFor('Move: 25 miles', 0), null, 'move: $0 line pays nothing');

  console.log(fails ? `\n${fails} FAILED` : '\nAll payroll self-tests passed');
  return fails;
}

if (process.env.PAYROLL_SELFTEST === '1') {
  process.exit(runSelfTests() ? 1 : 0);
}
