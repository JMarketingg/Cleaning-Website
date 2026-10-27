// Wire concealment plates on the bracket_moves ledger (migration 0205).
//
// plate_move() is the only writer of bracket_inventory.wire_plate_qty: every
// change is a signed ledger row with a reason, keyed by an idempotency_key so
// a retry, double-click or re-run sync lands once. Same design as
// bracket-moves.js; plates ride in wire_plate_delta on the same table.

// Plates used on a job: one per unit of a behind-the-wall / in-wall
// concealment line. "Wall already has a plug behind the TV" is a $0 answer
// that uses no plate; a surface cord cover ("on the wall") uses none either.
// Dom's tickets say "Inwall Concealment" (no "behind"), so that counts too.
export function detectWirePlateQty(lineItems) {
  let n = 0;
  for (const li of lineItems || []) {
    const name = String((li && li.name) || '').toLowerCase();
    if (/already\s+has\s+(?:a\s+)?plug|plug\s+behind/.test(name)) continue;
    const behindWall = /behind/.test(name) && /wall/.test(name) && /(wire|cord|conceal)/.test(name);
    const inwall = /in[\s-]?wall/.test(name) && /conceal/.test(name);
    if (behindWall || inwall) n += Number(li.quantity) || 1;
  }
  return n;
}

async function callPlateMove(db, { businessId, technicianId, kind, qty, idempotencyKey, bookingId, platePurchaseId, orderNum, reason, actor }) {
  // Stock lives on the tech's home-business row; exempt techs (0171) skip.
  let homeBizId = businessId;
  if (technicianId) {
    const { data: techRow } = await db.from('technicians')
      .select('business_id, skip_inventory').eq('id', technicianId).maybeSingle();
    if (techRow?.skip_inventory) return null;
    if (techRow?.business_id) homeBizId = techRow.business_id;
  }
  const { data, error } = await db.rpc('plate_move', {
    p_business_id: homeBizId,
    p_technician_id: technicianId,
    p_kind: kind,
    // null on a recount = leave the count alone (SQL coalesces it).
    p_qty: qty === null ? null : (qty ?? 0),
    p_idempotency_key: idempotencyKey,
    p_booking_id: bookingId || null,
    p_plate_purchase_id: platePurchaseId || null,
    p_order_num: orderNum || null,
    p_reason: reason || null,
    p_actor: actor || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// A physical count: absolute qty, reason required.
export async function plateRecount(db, { businessId, technicianId, qty, reason, actor, at }) {
  if (!technicianId || !reason || qty == null) throw new Error('plateRecount requires technicianId, qty and reason');
  const ts = at || new Date().toISOString();
  return callPlateMove(db, {
    businessId, technicianId, kind: 'recount', qty: Math.max(0, Math.round(Number(qty) || 0)),
    idempotencyKey: `plate-recount:${technicianId}:${ts}`, reason, actor,
  });
}

// Signed correction with a reason (office +/-).
export async function plateAdjust(db, { businessId, technicianId, delta, bookingId, reason, actor, at, idempotencyKey }) {
  if (!technicianId || !reason || !delta) return null;
  const ts = at || new Date().toISOString();
  return callPlateMove(db, {
    businessId, technicianId, kind: 'adjust', qty: delta,
    idempotencyKey: idempotencyKey || `plate-adjust:${technicianId}:${ts}`, bookingId, reason, actor,
  });
}

// Amazon order credited (+) or taken back (-). Keyed on the order plus how many
// plate moves that order already has, so a double-click or a re-run sync in the
// same state lands once, while a later real change (cancel, re-deliver, qty
// corrected) still posts.
export async function plateOrderMove(db, { businessId, technicianId, delta, orderNum, platePurchaseId, reason, actor }) {
  if (!technicianId || !delta) return null;
  const tag = orderNum || platePurchaseId;
  if (!tag) throw new Error('plateOrderMove requires orderNum or platePurchaseId');
  const { count } = await db.from('bracket_moves').select('id', { count: 'exact', head: true })
    .like('idempotency_key', `plate-order:${tag}:%`);
  return callPlateMove(db, {
    businessId, technicianId, kind: delta > 0 ? 'delivery' : 'delivery_reversal', qty: delta,
    idempotencyKey: `plate-order:${tag}:${count || 0}:${delta}`, platePurchaseId, orderNum,
    reason: reason || (delta > 0 ? 'Amazon plate delivery' : 'Amazon plate order reversed'), actor,
  });
}

// What each tech has been charged for this booking's plates so far.
// actual = what left the counter; claimed adds debits clamped at zero.
// Jobs deducted before 0205 have no plate move: their charge is the old
// bracket_usage_logs plate rows (the record of what the old code subtracted).
export async function platesChargedSoFar(db, bookingId) {
  const { data: rows, error } = await db.from('bracket_moves')
    .select('technician_id, wire_plate_delta, clamped_wire_plate')
    .eq('booking_id', bookingId).or('wire_plate_delta.neq.0,clamped_wire_plate.neq.0');
  if (error) throw error;
  const by = new Map();
  const add = (t, actual, claimed) => {
    const c = by.get(t) || { actual: 0, claimed: 0 };
    c.actual += actual; c.claimed += claimed; by.set(t, c);
  };
  for (const r of rows || []) {
    if (r.technician_id) add(r.technician_id, -(r.wire_plate_delta || 0), -(r.wire_plate_delta || 0) + (r.clamped_wire_plate || 0));
  }
  // Old-code deductions are always part of the charge (new code never writes
  // these log rows, so nothing is counted twice).
  let legacy = false;
  const { data: logs } = await db.from('bracket_usage_logs')
    .select('technician_id, wire_plate_used').eq('booking_id', bookingId).gt('wire_plate_used', 0)
    .ilike('notes', '%wire concealment%');
  for (const l of logs || []) { if (l.technician_id) { add(l.technician_id, l.wire_plate_used, l.wire_plate_used); legacy = true; } }
  return { by, n: (rows || []).length, legacy };
}

// Make the ledger say: `supplier` used `qty` plates on this job, every other
// tech 0. Only the difference vs what is already charged posts, so a retry,
// a re-completion or the other app completing the same job never double-debits.
export async function applyPlatesForJob(db, { businessId, bookingId, supplier, qty, actor, reason }) {
  const { by, n } = await platesChargedSoFar(db, bookingId);
  const techs = new Set(by.keys());
  if (supplier) techs.add(supplier);
  for (const t of techs) {
    const c = by.get(t) || { actual: 0, claimed: 0 };
    const want = t === supplier ? Math.max(0, qty || 0) : 0;
    // Charge up to `claimed` (a clamp may already be absorbed by a recount),
    // give back only `actual` (never invent stock that was not there).
    const delta = want > c.claimed ? c.claimed - want : (want < c.actual ? c.actual - want : 0);
    if (!delta) continue;
    await callPlateMove(db, {
      businessId, technicianId: t, kind: delta < 0 ? 'job_use' : 'job_reversal', qty: delta,
      idempotencyKey: `plate-job:${bookingId}:${n}:${t}:${c.actual}/${c.claimed}>${want}`, bookingId,
      reason: reason || 'job completion', actor,
    });
  }
}
