// Philippine payments: QR codes the business uploads (GCash, Maya, QR Ph),
// manual "paid by" records, and PayMongo checkout links (QR Ph, GCash, Maya,
// GrabPay, card). PayMongo turns on when PAYMONGO_SECRET_KEY is set.
import crypto from 'crypto';

export const PAY_METHODS = {
  gcash: 'GCash', maya: 'Maya', qrph: 'QR Ph (bank app)', cash: 'Cash', bank: 'Bank transfer', paymongo: 'Online (PayMongo)',
};

export function paymongoOn() { return !!process.env.PAYMONGO_SECRET_KEY; }

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

export async function createPaymongoLink(db, bookingId) {
  if (!paymongoOn()) { const e = new Error('PayMongo is not set up yet. Add PAYMONGO_SECRET_KEY in Vercel.'); e.status = 400; throw e; }
  const { data: b, error } = await db.from('bookings')
    .select('id, price, payment_status, metadata, scheduled_at, customer:customers ( name, phone, email ), service:services ( name )').eq('id', bookingId).maybeSingle();
  if (error) throw error;
  if (!b) { const e = new Error('Booking not found'); e.status = 404; throw e; }
  if (b.payment_status === 'paid') { const e = new Error('This booking is already paid.'); e.status = 409; throw e; }
  const amount = Math.round((Number(b.price) || 0) * 100);
  if (amount < 2000) { const e = new Error('Amount is too small for an online payment.'); e.status = 400; throw e; }
  const base = process.env.PUBLIC_URL || 'https://tidyhaus-crm.vercel.app';
  const r = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64') },
    body: JSON.stringify({ data: { attributes: {
      line_items: [{ currency: 'PHP', amount, name: (b.service && b.service.name) || 'TidyHaus cleaning', quantity: 1 }],
      payment_method_types: ['qrph', 'gcash', 'paymaya', 'grab_pay', 'card'],
      description: 'TidyHaus cleaning', reference_number: b.id, send_email_receipt: !!(b.customer && b.customer.email),
      show_description: true, show_line_items: true,
      billing: b.customer ? { name: b.customer.name || undefined, phone: b.customer.phone || undefined, email: b.customer.email || undefined } : undefined,
      success_url: base + '/paid.html', cancel_url: base + '/paid.html?cancelled=1',
      metadata: { booking_id: b.id },
    } } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('PayMongo: ' + ((data.errors && data.errors[0] && data.errors[0].detail) || r.status)); e.status = 502; throw e; }
  const url = data.data.attributes.checkout_url;
  await db.from('bookings').update({ metadata: { ...(b.metadata || {}), paymongo_checkout_id: data.data.id, paymongo_url: url } }).eq('id', b.id);
  return { url, customer: b.customer, amount: amount / 100 };
}

export function verifyPaymongoSignature(raw, header) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=').map((x) => x.trim())));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  const got = parts.li || parts.te || '';
  const a = Buffer.from(expected), b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
