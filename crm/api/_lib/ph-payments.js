// Philippine payments: QR codes the business uploads (GCash, Maya, QR Ph)
// and "paid by" records.

export const PAY_METHODS = {
  gcash: 'GCash', maya: 'Maya', qrph: 'QR Ph (bank app)', cash: 'Cash', bank: 'Bank transfer',
};


export async function businessPaySettings(db) {
  const { data } = await db.from('businesses').select('id, settings').eq('slug', 'tidyhaus').single();
  return { bizId: data.id, settings: data.settings || {}, qr: (data.settings && data.settings.payment_qr) || [] };
}

export async function markPaid(db, bookingId, method, { by = 'Office', amount = null } = {}) {
  if (!PAY_METHODS[method]) { const e = new Error('Unknown payment method'); e.status = 400; throw e; }
  const { data: b, error } = await db.from('bookings').select('id, price, payment_status, metadata').eq('id', bookingId).maybeSingle();
  if (error) throw error;
  if (!b) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  if (b.payment_status === 'paid') return { ok: true, already: true };
  const paid = amount != null ? Number(amount) : Number(b.price) || 0;
  const { error: uErr } = await db.from('bookings').update({
    payment_status: 'paid', payment_method: method, paid_at: new Date().toISOString(), amount_paid: paid,
    metadata: { ...(b.metadata || {}), paid_by_label: PAY_METHODS[method], paid_recorded_by: by },
  }).eq('id', bookingId);
  if (uErr) throw uErr;
  return { ok: true };
}
