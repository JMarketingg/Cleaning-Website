
export async function isInventoryExempt(db, technicianId) {
  if (!technicianId) return false;
  try {
    const { data } = await db.from('technicians').select('skip_inventory').eq('id', technicianId).maybeSingle();
    return !!data?.skip_inventory;
  } catch { return false; }
}

export function bracketTotal(q) { return Math.abs(q.flat || 0) + Math.abs(q.tilting || 0) + Math.abs(q.full_motion || 0); }

async function callBracketMove(db, { businessId, technicianId, kind, flat, tilting, fullMotion, idempotencyKey, bookingId, purchaseId, orderNum, reason, actor }) {
  let homeBizId = businessId;
  if (technicianId) {
    const { data: techRow } = await db.from('technicians')
      .select('business_id, skip_inventory').eq('id', technicianId).maybeSingle();
    if (techRow?.skip_inventory) return null;
    if (techRow?.business_id) homeBizId = techRow.business_id;
  }
  const { data, error } = await db.rpc('bracket_move', {
    p_business_id: homeBizId,
    p_technician_id: technicianId,
    p_kind: kind,
    p_flat: flat === null ? null : (flat ?? 0),
    p_tilting: tilting === null ? null : (tilting ?? 0),
    p_full_motion: fullMotion === null ? null : (fullMotion ?? 0),
    p_idempotency_key: idempotencyKey,
    p_booking_id: bookingId || null,
    p_purchase_id: purchaseId || null,
    p_order_num: orderNum || null,
    p_reason: reason || null,
    p_actor: actor || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function debitForJob(db, { businessId, technicianId, qtys, bookingId, reason, actor }) {
  if (!technicianId || !bookingId || bracketTotal(qtys) <= 0) return null;
  return callBracketMove(db, {
    businessId, technicianId, kind: 'job_use',
    flat: -(qtys.flat || 0), tilting: -(qtys.tilting || 0), fullMotion: -(qtys.full_motion || 0),
    idempotencyKey: `job:${bookingId}`, bookingId, reason: reason || 'job completion', actor,
  });
}

export async function reverseJobDebit(db, { businessId, technicianId, qtys, bookingId, reason, actor }) {
  if (!technicianId || !bookingId || bracketTotal(qtys) <= 0) return null;
  return callBracketMove(db, {
    businessId, technicianId, kind: 'job_reversal',
    flat: qtys.flat || 0, tilting: qtys.tilting || 0, fullMotion: qtys.full_motion || 0,
    idempotencyKey: `job-rev:${bookingId}`, bookingId, reason: reason || 'job reopened/reassigned', actor,
  });
}

export async function reconcileJobEdit(db, { businessId, technicianId, oldQtys, newQtys, bookingId, liRev, reason, actor }) {
  const flat = (oldQtys.flat || 0) - (newQtys.flat || 0);
  const tilting = (oldQtys.tilting || 0) - (newQtys.tilting || 0);
  const fullMotion = (oldQtys.full_motion || 0) - (newQtys.full_motion || 0);
  if (!technicianId || !bookingId || (!flat && !tilting && !fullMotion)) return null;
  return callBracketMove(db, {
    businessId, technicianId, kind: 'adjust',
    flat, tilting, fullMotion,
    idempotencyKey: `job-edit:${bookingId}:${liRev != null ? liRev : Date.now()}`,
    bookingId, reason: reason || 'line items edited after completion', actor,
  });
}

export async function creditDelivery(db, { businessId, technicianId, qtys, purchaseId, orderNum, actor }) {
  if (!technicianId || !orderNum || bracketTotal(qtys) <= 0) return null;
  return callBracketMove(db, {
    businessId, technicianId, kind: 'delivery',
    flat: qtys.flat || 0, tilting: qtys.tilting || 0, fullMotion: qtys.full_motion || 0,
    idempotencyKey: `delivery:${orderNum}`, purchaseId, orderNum, reason: 'Walmart delivery', actor,
  });
}

export async function adjustDelivery(db, { businessId, technicianId, deltaQtys, purchaseId, orderNum, tag, reason, actor }) {
  if (!technicianId || !orderNum || bracketTotal(deltaQtys) <= 0) return null;
  return callBracketMove(db, {
    businessId, technicianId, kind: 'delivery_reversal',
    flat: deltaQtys.flat || 0, tilting: deltaQtys.tilting || 0, fullMotion: deltaQtys.full_motion || 0,
    idempotencyKey: `delivery-adj:${orderNum}:${tag}`, purchaseId, orderNum, reason: reason || 'delivery correction', actor,
  });
}

export async function recount(db, { businessId, technicianId, flat, tilting, fullMotion, reason, actor, at }) {
  if (!technicianId || !reason) throw new Error('recount requires technicianId and reason');
  const ts = at || new Date().toISOString();
  return callBracketMove(db, {
    businessId, technicianId, kind: 'recount',
    flat: flat == null ? null : flat, tilting: tilting == null ? null : tilting, fullMotion: fullMotion == null ? null : fullMotion,
    idempotencyKey: `recount:${technicianId}:${ts}`, reason, actor,
  });
}

export async function adjust(db, { businessId, technicianId, deltaQtys, bookingId, reason, actor, at, idempotencyKey }) {
  if (!technicianId || !reason || bracketTotal(deltaQtys) <= 0) return null;
  const ts = at || new Date().toISOString();
  return callBracketMove(db, {
    businessId, technicianId, kind: 'adjust',
    flat: deltaQtys.flat || 0, tilting: deltaQtys.tilting || 0, fullMotion: deltaQtys.full_motion || 0,
    idempotencyKey: idempotencyKey || `adjust:${technicianId}:${ts}`, bookingId, reason, actor,
  });
}
