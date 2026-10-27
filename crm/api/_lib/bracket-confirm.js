// Bracket confirm at completion (owner 2026-10-13).
//
// Stock used to move only when a bracket LINE was on the ticket at completion,
// so a tech who used van stock on a "customer has own bracket" / Frame /
// office-built ticket (or deleted the bracket line first) drifted the CRM
// above the real truck. Now the completer answers once per TV which bracket
// went on (Flat / Tilt / Full motion / Own) and the ledger follows THAT.
// The answer is prefilled from the ticket, so the common case is one tap.
//
// Pure helpers + one ledger writer. Detection of company brackets stays in
// tech.js / admin.js (detectBracketQtys) and is passed in, so nothing here can
// drift from what the old completion path deducts.

import { countTvUnits } from './line-items.js';
import { debitForJob, adjust as ledgerAdjust } from './bracket-moves.js';

export const BRACKET_KEYS = ['flat', 'tilting', 'full_motion', 'own'];
const COMPANY = ['flat', 'tilting', 'full_motion'];

// Lines that say the customer's own / in-box bracket goes on the TV.
// Soundbar / Apple TV / OneConnect lines mention brackets but aren't TV mounts.
export function detectOwnBracketQty(lineItems) {
  let n = 0;
  for (const li of lineItems || []) {
    const name = String((li && li.name) || '').toLowerCase();
    if (/soundbar|apple\s*tv|oneconnect/.test(name)) continue;
    if (/customer.?supplied|\bmy own\b|own (?:mounting )?bracket|in.?the.?box|in-box/.test(name)) {
      n += Math.max(1, Math.round(Number(li.quantity) || 1));
    }
  }
  return n;
}

// How many TVs the completer must answer for, and the prefilled answer per TV
// ('flat' | 'tilting' | 'full_motion' | 'own' | null = tech must pick).
// TV count = the ticket's TV size lines (countTvUnits, same as the clamp);
// a bracket line beyond that means an unrecognized TV line, so it wins. With
// no size line at all, bracket + own lines stand in for TVs. 0 = no question.
// `prior` = metadata.brackets_used: on a reopened job the answer already
// confirmed wins over the ticket, so a one-tap re-complete keeps it.
export function bracketPrefill(lineItems, detected, prior) {
  const company = { flat: detected?.flat || 0, tilting: detected?.tilting || 0, full_motion: detected?.full_motion || 0 };
  const companyTotal = company.flat + company.tilting + company.full_motion;
  const ownLines = detectOwnBracketQty(lineItems);
  const tvUnits = countTvUnits(lineItems);
  const tvCount = tvUnits ? Math.max(tvUnits, companyTotal) : companyTotal + ownLines;
  const picks = [];
  if (prior && prior.confirmed_at) {
    for (const k of BRACKET_KEYS) for (let i = 0; i < (Number(prior[k]) || 0) && picks.length < tvCount; i++) picks.push(k);
  } else {
    for (const k of COMPANY) for (let i = 0; i < company[k] && picks.length < tvCount; i++) picks.push(k);
    for (let i = 0; i < ownLines && picks.length < tvCount; i++) picks.push('own');
  }
  while (picks.length < tvCount) picks.push(null);
  return { tv_count: tvCount, picks };
}

// Parse the client's { flat, tilting, full_motion, own } answer. Returns
// { value } or { error }. Never trusts the client's sum: caller checks it
// against the server-side TV count with checkBracketsUsed.
export function parseBracketsUsed(raw) {
  if (raw == null) return { value: null };
  if (typeof raw !== 'object') return { error: 'Bad bracket answer.' };
  const out = {};
  for (const k of BRACKET_KEYS) {
    const v = raw[k] == null || raw[k] === '' ? 0 : Number(raw[k]);
    if (!Number.isInteger(v) || v < 0 || v > 50) return { error: 'Bad bracket answer.' };
    out[k] = v;
  }
  return { value: out };
}
export function checkBracketsUsed(used, tvCount) {
  const sum = BRACKET_KEYS.reduce((t, k) => t + (used[k] || 0), 0);
  if (sum !== tvCount) return `Pick a bracket for each TV (${sum}/${tvCount}). Refresh if the ticket changed.`;
  return null;
}

const LABEL = { flat: 'Flat', tilting: 'Tilt', full_motion: 'Full motion', own: 'Own' };
export function bracketsText(q) {
  const parts = BRACKET_KEYS.filter(k => q[k]).map(k => `${q[k]} ${LABEL[k]}`);
  return parts.length ? parts.join(', ') : 'none';
}
// Note text when the confirmed company brackets differ from the ticket's
// bracket lines, else null.
export function bracketMismatchNote(used, detected) {
  if (COMPANY.every(k => (used[k] || 0) === (detected?.[k] || 0))) return null;
  return `Brackets used: ${bracketsText(used)}. Ticket: ${bracketsText({ ...detected, own: 0 })}.`;
}

// What the ledger has already charged this booking, per tech. `actual` is what
// really left the counter; `claimed` adds debits that hit zero (clamped). We
// charge up to `claimed` (a recount may already have absorbed a clamped unit,
// so charging it again would double-deduct) but only ever give back `actual`
// (giving back a clamped unit would invent stock that was never there).
export function chargedFromMoves(rows) {
  const by = new Map();
  for (const r of rows || []) {
    if (!r.technician_id) continue;
    const c = by.get(r.technician_id) || { actual: { flat: 0, tilting: 0, full_motion: 0 }, claimed: { flat: 0, tilting: 0, full_motion: 0 } };
    for (const k of COMPANY) {
      c.actual[k] += -(r[`${k}_delta`] || 0);
      c.claimed[k] += -(r[`${k}_delta`] || 0) + (r[`clamped_${k}`] || 0);
    }
    by.set(r.technician_id, c);
  }
  return by;
}

// Moves needed so the ledger ends at: supplier charged `qtys`, every other tech
// on this booking charged 0. delta = stock change (positive gives stock back).
export function planBracketMoves(chargedByTech, supplier, qtys) {
  const techs = new Set(chargedByTech.keys());
  if (supplier) techs.add(supplier);
  const zero = { flat: 0, tilting: 0, full_motion: 0 };
  const sig = (q) => COMPANY.map(k => q[k] || 0).join('.');
  const plan = [];
  for (const t of techs) {
    const c = chargedByTech.get(t) || { actual: zero, claimed: zero };
    const target = t === supplier ? qtys : zero;
    const delta = {};
    for (const k of COMPANY) {
      const want = target[k] || 0;
      delta[k] = want > c.claimed[k] ? c.claimed[k] - want : (want < c.actual[k] ? c.actual[k] - want : 0);
    }
    if (COMPANY.some(k => delta[k])) plan.push({ tech: t, delta, tag: `${sig(c.actual)}/${sig(c.claimed)}>${sig(target)}` });
  }
  return plan;
}

// Bookings deducted before the ledger (Jul to 9/2: metadata stamp + a direct
// counter write that the 0088 opening balance absorbed) have no job_use move.
// Their charge is a baseline: built from brackets_used / the ticket, and kept
// in brackets_used.legacy by every path that posts a move for them, so later
// moves add on top of it instead of charging the job again.
export function legacyBaseline(meta, rows, { supplier, ticketQtys } = {}) {
  const bu = meta?.brackets_used;
  if (bu?.legacy) return bu.legacy;
  if (!meta?.bracket_deducted_at || bu?.confirmed_at || (rows || []).some(r => r.kind === 'job_use')) return null;
  const tech = bu?.supplier || supplier;
  if (!tech) return null;
  const src = bu && COMPANY.some(k => k in bu) ? bu : (ticketQtys || {});
  return { tech, flat: src.flat || 0, tilting: src.tilting || 0, full_motion: src.full_motion || 0 };
}

// Ledger rows for the booking + legacy baseline = what each tech is charged.
export async function chargedSoFar(db, bookingId, meta, fallback) {
  const { data: rows, error } = await db.from('bracket_moves')
    .select('kind, technician_id, flat_delta, tilting_delta, full_motion_delta, clamped_flat, clamped_tilting, clamped_full_motion')
    .eq('booking_id', bookingId);
  if (error) throw error;
  const by = chargedFromMoves(rows);
  const legacy = legacyBaseline(meta, rows, fallback);
  if (legacy) {
    const c = by.get(legacy.tech) || { actual: { flat: 0, tilting: 0, full_motion: 0 }, claimed: { flat: 0, tilting: 0, full_motion: 0 } };
    for (const k of COMPANY) { c.actual[k] += legacy[k] || 0; c.claimed[k] += legacy[k] || 0; }
    by.set(legacy.tech, c);
  }
  return { by, n: (rows || []).length, legacy };
}

// Move this booking's charge so `supplier` carries exactly `qtys` and every
// other tech 0. Keyed on rows-on-file + before>after, so a double-submit lands
// once but a later identical change (Tilt>Own>Tilt>Own) still posts.
export async function moveBookingCharge(db, { businessId, bookingId, supplier, qtys, actor, meta, ticketQtys, fallbackSupplier, reason, keyTag }) {
  const { by, n, legacy } = await chargedSoFar(db, bookingId, meta, { supplier: fallbackSupplier || supplier, ticketQtys });
  for (const m of planBracketMoves(by, supplier, qtys)) {
    await ledgerAdjust(db, {
      businessId, technicianId: m.tech, deltaQtys: m.delta, bookingId, reason, actor,
      idempotencyKey: `${keyTag}:${bookingId}:${n}:${m.tech}:${m.tag}`,
    });
  }
  return { legacy, n };
}

// Make the ledger match the confirmed answer. First completion with nothing
// charged keeps the job:<booking_id> key (shared with every older path, so a
// retry or the other app completing is still a no-op). A re-completion, or a
// pre-ledger job, posts only the difference vs what is already charged.
// Returns { legacy } for the caller to keep in brackets_used.
export async function applyConfirmedBrackets(db, { businessId, bookingId, supplier, qtys, actor, meta, ticketQtys, fallbackSupplier }) {
  const { by, n, legacy } = await chargedSoFar(db, bookingId, meta, { supplier: fallbackSupplier || supplier, ticketQtys });
  if (!n && !legacy) {
    if (supplier) await debitForJob(db, { businessId, technicianId: supplier, qtys, bookingId, reason: 'job completion (confirmed)', actor });
    return { legacy: null };
  }
  for (const m of planBracketMoves(by, supplier, qtys)) {
    await ledgerAdjust(db, {
      businessId, technicianId: m.tech, deltaQtys: m.delta, bookingId,
      reason: 'completion confirm: brackets differ from ledger', actor,
      idempotencyKey: `job-confirm:${bookingId}:${n}:${m.tech}:${m.tag}`,
    });
  }
  return { legacy };
}

// Latest tech self-count for one or more techs: { at, gap: {flat,tilting,full_motion,wire_plate} }.
// Bracket gap = the recount move's deltas; plate gap parsed from its reason.
export async function lastSelfCounts(db, techIds) {
  const out = new Map();
  if (!techIds.length) return out;
  const { data } = await db.from('bracket_moves')
    .select('technician_id, flat_delta, tilting_delta, full_motion_delta, reason, created_at')
    .eq('kind', 'recount').like('actor', 'tech:%').in('technician_id', techIds)
    .order('created_at', { ascending: false }).limit(500);
  for (const r of data || []) {
    if (out.has(r.technician_id)) continue;
    const m = /plates (\d+)>(\d+)/.exec(r.reason || '');
    out.set(r.technician_id, { at: r.created_at, gap: {
      flat: r.flat_delta || 0, tilting: r.tilting_delta || 0, full_motion: r.full_motion_delta || 0,
      wire_plate: m ? Number(m[2]) - Number(m[1]) : 0,
    } });
  }
  return out;
}

// "Bracket removed: Tilting x1 (Customer's own)" lines for the job notes, from
// the editor's [{ name, qty, reason }] list. Only the two known reasons pass.
const REMOVE_REASONS = { own: "Customer's own", not_installed: 'Not installed' };
export function removedBracketNotes(list) {
  if (!Array.isArray(list)) return null;
  const lines = list.slice(0, 20).map(r => {
    const why = REMOVE_REASONS[r && r.reason];
    const name = String((r && r.name) || '').trim().slice(0, 80);
    if (!why || !name) return null;
    const q = Math.max(1, Math.min(99, Math.round(Number(r.qty) || 1)));
    return `Bracket removed: ${name}${q > 1 ? ` x${q}` : ''} (${why})`;
  }).filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}
