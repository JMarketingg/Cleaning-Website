import { bumpLiRev } from './line-items.js';

export async function revertCash(db, b, { who, kind, authorId, reason }) {
  const why = String(reason || '').trim().slice(0, 300);
  if (!why) return { status: 400, error: 'Reason required.' };
  if (b.payment_status !== 'paid' || b.payment_method !== 'cash') return { status: 400, error: 'Not paid cash.' };
  if (b.stripe_payment_intent_id) return { status: 400, error: 'Card was charged. Refund instead.' };
  const { data: charged } = await db.from('booking_authorizations').select('id')
    .eq('booking_id', b.id).not('stripe_charge_id', 'is', null).limit(1);
  if (charged && charged.length) return { status: 400, error: 'Card was charged. Refund instead.' };

  const meta = { ...(b.metadata || {}) };
  const taxRows = Array.isArray(meta.cash_tax_removed) ? meta.cash_tax_removed : [];
  let price = Number(b.price) || 0;
  const now = new Date().toISOString();
  meta.cash_reverted = { by: who || 'Unknown', kind, at: now, reason: why };
  delete meta.cash_tax_removed;

  const { data: upd } = await db.from('bookings').update({
    payment_status: 'unpaid', paid_at: null, amount_paid: null, payment_method: 'card', metadata: meta,
  }).eq('id', b.id).eq('payment_status', 'paid').eq('payment_method', 'cash').select('id').maybeSingle();
  if (!upd) return { status: 409, error: 'Payment just changed. Refresh.' };

  if (taxRows.length) {
    try {
      const rows = taxRows.map(r => ({
        booking_id: b.id, business_id: b.business_id, kind: r.kind || 'service', name: r.name,
        description: r.description ?? null, quantity: r.quantity ?? 1, unit_price: r.unit_price ?? r.line_total ?? 0,
        line_total: r.line_total ?? 0, taxable: r.taxable ?? false, sort_order: r.sort_order ?? 0,
      }));
      const { error } = await db.from('booking_line_items').insert(rows);
      if (!error) {
        price = Math.round((price + rows.reduce((s, r) => s + (Number(r.line_total) || 0), 0)) * 100) / 100;
        await db.from('bookings').update({ price }).eq('id', b.id);
        await bumpLiRev(db, b.id);
      }
    } catch (e) { console.warn('[cash revert] tax restore failed:', e.message); }
  }

  try {
    await db.from('booking_notes').insert({
      business_id: b.business_id, booking_id: b.id,
      author_kind: kind === 'technician' ? 'technician' : 'system', author_id: kind === 'technician' ? authorId : null,
      author_name: who || 'Office', body: `Cash undone. Now unpaid card. Reason: ${why}`,
    });
  } catch (e) { console.warn('[cash revert] note failed:', e.message); }
  return { ok: true, payment_status: 'unpaid', price };
}
