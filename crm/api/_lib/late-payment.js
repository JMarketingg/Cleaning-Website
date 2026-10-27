// Daily "Payment Late!" invoice email (owner 2026-10-13).
//
// A booking opts in with metadata.late_reminder = { on: true }. Once a day
// (cron: /api/migrate?action=late_payment_reminders) every opted-in booking
// that still owes money gets the invoice email with a fresh Stripe pay link,
// subject "Payment Late!". Each send is logged in the customer's message
// thread (customer communication) and as a booking note. Stops by itself the
// moment the job is paid (or the flag is turned off).
import { stripe, stripeConfigured } from './stripe.js';
import { sendEmail, receiptEmail, brandFor, emailConfig } from './email.js';

const DAY_MS = 20 * 60 * 60 * 1000; // at most one per ~day even if the cron double-fires

// Same engine also runs the gentler "Daily pay reminder" (owner 2026-10-23):
// metadata.pay_reminder = { on, started_at, last_sent_at, count }. Sent once a
// day at ~10 AM business time from the 10-min tech_late_check cron, any job
// status except canceled, stops itself once paid.
export async function sendLateReminder(db, bookingId, { force = false, key = 'late_reminder' } = {}) {
  const isPay = key === 'pay_reminder';
  const { data: b, error } = await db.from('bookings')
    .select(`id, business_id, scheduled_at, price, tip, amount_paid, amount_refunded, payment_status, status, metadata, stripe_account,
      address_line1, city, state, postal_code,
      business:businesses ( slug, timezone ),
      customer:customers ( name, email, phone ),
      technician:technicians!technician_id ( name ),
      line_items:booking_line_items ( name, kind, quantity, line_total )`)
    .eq('id', bookingId).maybeSingle();
  if (error) throw error;
  if (!b) return { skipped: 'not_found' };
  const lr = (b.metadata && b.metadata[key]) || {};
  if (!lr.on) return { skipped: 'off' };
  if (isPay && /cancel/i.test(String(b.status || ''))) return { skipped: 'canceled' };
  const total = Number(b.price) || 0, tip = Number(b.tip) || 0;
  const netPaid = Math.max(0, (Number(b.amount_paid) || 0) - (Number(b.amount_refunded) || 0));
  const amountDue = Math.max(0, Math.round((total + tip - netPaid) * 100) / 100);
  if (String(b.payment_status || '').toLowerCase() === 'paid' || amountDue <= 0) {
    await db.from('bookings').update({ metadata: { ...b.metadata, [key]: { ...lr, on: false, stopped: 'paid', stopped_at: new Date().toISOString() } } }).eq('id', b.id);
    return { skipped: 'paid' };
  }
  if (!force && lr.last_sent_at && Date.now() - Date.parse(lr.last_sent_at) < DAY_MS) return { skipped: 'already_today' };
  if (!b.customer?.email) return { skipped: 'no_email' };

  const slug = b.business?.slug || 'handy-andy';
  const brand = brandFor(slug);
  const acct = { account: b.stripe_account || null, slug };
  const baseUrl = process.env.PUBLIC_URL || 'https://tidyhaus-crm.vercel.app';
  let payUrl = null;
  if (stripeConfigured(acct)) {
    const session = await stripe('/checkout/sessions', {
      method: 'POST', ...acct,
      body: {
        mode: 'payment',
        customer_email: b.customer.email,
        'payment_method_types[0]': 'card',
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': Math.round(amountDue * 100),
        'line_items[0][price_data][product_data][name]': `Invoice — ${brand.name}`,
        success_url: `${baseUrl}/pay.html?booking=${encodeURIComponent(b.id)}&business=${encodeURIComponent(slug)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/pay.html?booking=${encodeURIComponent(b.id)}&business=${encodeURIComponent(slug)}&canceled=1`,
        'metadata[booking_id]': b.id,
        'metadata[business_slug]': slug,
      },
    });
    payUrl = session.url;
  }
  if (!payUrl) return { skipped: 'no_pay_link' }; // never send a late notice he can't pay from

  const isTax = (li) => /^tax\b/i.test(String(li.name || ''));
  const all = b.line_items || [];
  const lines = all.filter(li => !isTax(li)).map(li => ({ label: li.name, qty: li.quantity, amount: li.line_total }));
  const tax = all.filter(isTax).reduce((s, li) => s + (Number(li.line_total) || 0), 0);
  const tz = b.business?.timezone || 'Asia/Manila';
  const serviceDate = b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const { html } = receiptEmail({
    kind: 'invoice', receiptNo: String(b.id).replace(/-/g, '').slice(0, 8).toUpperCase(),
    customerName: b.customer.name || 'Customer', serviceDate, technicianName: b.technician?.name || null,
    address: { line1: b.address_line1, city: b.city, state: b.state, zip: b.postal_code },
    lines, tax, adjustment: 0, tip, total, netPaid, amountDue, amountRefunded: Number(b.amount_refunded) || 0, payUrl,
  }, brand);
  const banner = `<div style="background:#b91c1c;color:#fff;font:700 20px Arial,sans-serif;text-align:center;padding:14px;">Payment Late!</div>`;
  const money = `$${amountDue.toFixed(2)}`;
  const escH = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const payTop = `<div style="font-family:Arial,sans-serif;text-align:center;padding:22px 16px 6px;">
<div style="font-size:16px;color:#111;margin-bottom:16px;">Invoice for your ${escH(brand.name)} job on ${escH(serviceDate)}: <b>${money}</b> due.</div>
<a href="${escH(payUrl)}" style="display:inline-block;background:${brand.accent || '#FF6B35'};color:#ffffff;text-decoration:none;font-size:20px;font-weight:800;padding:16px 44px;border-radius:12px;">Pay invoice</a></div>`;
  const top = isPay ? payTop : banner;
  const lateHtml = /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => m + top) : top + html;
  const { from } = emailConfig(slug);
  const subject = isPay ? `Invoice reminder: ${money} due - ${brand.name}` : 'Payment Late!';
  const r = await sendEmail({ slug, to: b.customer.email, subject, html: lateHtml, replyTo: from });
  const now = new Date().toISOString();
  const logBody = isPay ? `[Email] Daily pay reminder: invoice ${money} due, pay link sent to ${b.customer.email}`
    : `[Email] Payment Late! Invoice ${money} due, pay link sent to ${b.customer.email}`;

  // Customer communication thread + job note.
  const phone = String(b.customer.phone || '').replace(/\D/g, '').slice(-10);
  if (phone) {
    await db.from('messages').insert({
      business_id: b.business_id, customer_phone: phone, our_phone: String(process.env.TWILIO_PHONE_NUMBER || '').replace(/\D/g, '').slice(-10),
      direction: 'out', body: logBody, status: r.sent ? 'sent' : 'failed', error: r.sent ? null : String(r.error || r.skipped || 'failed'), sent_by: 'automated',
    });
  }
  await db.from('booking_notes').insert({
    booking_id: b.id, business_id: b.business_id, body: r.sent ? logBody : `${isPay ? 'Daily pay reminder' : 'Payment Late!'} email FAILED: ${r.error || r.skipped || 'unknown'}`,
    author_kind: 'owner', author_id: null, author_name: 'Automated',
  });
  if (r.sent) {
    const { data: fresh } = await db.from('bookings').select('metadata').eq('id', b.id).maybeSingle();
    const m = fresh?.metadata || b.metadata || {};
    const cur = m[key] || lr;
    const cnt = isPay ? { count: (cur.count || 0) + 1 } : { sent_count: (cur.sent_count || 0) + 1 };
    await db.from('bookings').update({ metadata: { ...m, [key]: { ...cur, last_sent_at: now, ...cnt } } }).eq('id', b.id);
  }
  return r.sent ? { sent: true, amountDue } : { failed: r.error || r.skipped };
}

export async function runLateReminders(db) {
  const { data, error } = await db.from('bookings').select('id').eq('metadata->late_reminder->>on', 'true');
  if (error) throw error;
  const out = [];
  for (const row of data || []) {
    try { out.push({ id: row.id, ...(await sendLateReminder(db, row.id)) }); }
    catch (e) { out.push({ id: row.id, error: String(e.message || e) }); }
  }
  return out;
}

// Daily pay reminder runner (10-min cron). Sends only 10 AM to noon in the
// JOB's metro time (audit 2026-10-25: reminders went out at 9-10 PM, minutes
// after the invoice), never within 12h of the last send or of turning it on,
// and never for a job that is paid, refunded, cancelled or a no-show.
export async function runPayReminders(db, { dryRun = false } = {}) {
  const { data, error } = await db.from('bookings').select('id, status, payment_status, metadata, business:businesses ( timezone ), service_area:service_areas ( timezone )').eq('metadata->pay_reminder->>on', 'true');
  if (error) throw error;
  const out = [];
  const dayOf = (tz, d) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const H12 = 12 * 3600000;
  for (const row of data || []) {
    const tz = row.service_area?.timezone || row.business?.timezone || 'Asia/Manila';
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit' }).format(now)) % 24;
    const pr = row.metadata?.pay_reminder || {};
    const last = pr.last_sent_at;
    if (['paid', 'refunded'].includes(String(row.payment_status || '').toLowerCase()) || ['cancelled', 'no_show'].includes(row.status)) { out.push({ id: row.id, skipped: 'nothing_owed' }); continue; }
    if (hour < 10 || hour >= 12) { out.push({ id: row.id, skipped: 'outside_10_to_noon' }); continue; }
    if (last && dayOf(tz, new Date(last)) === dayOf(tz, now)) { out.push({ id: row.id, skipped: 'already_today' }); continue; }
    if ((last && now - Date.parse(last) < H12) || (pr.started_at && now - Date.parse(pr.started_at) < H12)) { out.push({ id: row.id, skipped: 'too_soon' }); continue; }
    if (dryRun) { out.push({ id: row.id, would_send: true }); continue; }
    try { out.push({ id: row.id, ...(await sendLateReminder(db, row.id, { key: 'pay_reminder', force: true })) }); }
    catch (e) { out.push({ id: row.id, error: String(e.message || e) }); }
  }
  return out;
}
