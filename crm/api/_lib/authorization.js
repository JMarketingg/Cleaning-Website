import { uploadImage } from './storage.js';
import { formatAddress } from './address.js';

export const TERMS_VERSION = '2026-07-01';

export function authorizationText({ businessName, customerName, cardLast4, ticketAmount, tip, total }) {
  const card = cardLast4 ? `ending ••${cardLast4}` : 'on file';
  const fmt = (n) => `₱${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;
  return (
    `I, ${customerName || 'the customer'}, authorize ${businessName || 'the company'} to charge my card ${card} ` +
    `${fmt(total)} for the services listed above (${fmt(ticketAmount)} service` +
    `${Number(tip) > 0 ? ` + ${fmt(tip)} tip` : ''}). ` +
    `I confirm the work was completed to my satisfaction, and I have read and agree to the ` +
    `Terms of Service and Refund Policy.`
  );
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || req.connection?.remoteAddress || null;
}

export async function saveAuthorization(db, req, booking, ctx) {
  try {
    const { businessId, total, ticketAmount, tip, card = {}, pi, chargeId, body = {} } = ctx;

    let sig = { path: null, url: null };
    if (body.signature) {
      try { sig = await uploadImage(body.signature, `authorizations/${booking.id}`); }
      catch (_) { /* keep going without the image */ }
    }

    const row = {
      business_id: businessId,
      booking_id: booking.id,
      signature_path: sig.path,
      signature_url: sig.url,
      customer_name: (body.customer_name || booking.customer?.name || '').toString().slice(0, 120) || null,
      card_brand: card.brand || null,
      card_last4: card.last4 || null,
      amount: total,
      ticket_amount: ticketAmount,
      tip: tip || 0,
      line_items: (body.snapshot && Array.isArray(body.snapshot.line_items)) ? body.snapshot.line_items : null,
      terms_text: body.terms_text || null,
      terms_version: body.terms_version || TERMS_VERSION,
      signed_ip: clientIp(req),
      signed_user_agent: req.headers['user-agent'] || null,
      stripe_payment_intent_id: pi?.id || null,
      stripe_charge_id: chargeId || null,
    };
    const { data, error } = await db.from('booking_authorizations').insert(row).select('id').single();
    if (error) return null;
    return data?.id || null;
  } catch (_) {
    return null;
  }
}

export function buildDisputeEvidence({ booking, auth, customer, facts = {} }) {
  const fmt = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return `${v < 0 ? '-' : ''}₱${Math.abs(v).toFixed(2)}`; };
  const when = (t) => t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : null;
  const day = (t) => t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
  const lines = Array.isArray(auth?.line_items) ? auth.line_items : (booking?.line_items || []);
  const items = lines.filter((li) => Number(li.line_total) !== 0)
    .map((li) => `${li.name || li.label}${li.quantity > 1 ? ` x${li.quantity}` : ''}: ${fmt(li.line_total)}`);
  const itemList = items.join('; ');

  const signedAt = auth?.signed_at ? new Date(auth.signed_at).getTime() : null;
  const jobStart = booking?.on_the_way_at || booking?.arrived_at || booking?.scheduled_at;
  const inPerson = !!(auth?.signature_url && signedAt && jobStart && signedAt >= new Date(jobStart).getTime() - 30 * 60e3);
  const addr = formatAddress(booking);
  const sumText = (t) => (t && Array.isArray(t.items) ? t.items.filter((i) => i.kind !== 'other').map((i) => i.text).join('; ') : String(t || '')).slice(0, 300);
  const phoneFmt = (p) => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : ''; };
  const call = (facts.calls || [])[0] || null;
  const card = auth?.card_last4 ? `${auth.card_brand ? auth.card_brand[0].toUpperCase() + auth.card_brand.slice(1) : 'Card'} ending ${auth.card_last4}` : 'the card';
  const checks = facts.card_checks || {};
  const checksOk = checks.cvc_check === 'pass' && checks.address_postal_code_check === 'pass';
  const custPhone = phoneFmt(customer?.phone);
  const mode = inPerson ? 'in_person' : booking?.source === 'manual' ? 'phone' : booking?.source === 'widget' ? 'online' : 'on_file';

  const timeline = [
    ...(facts.calls || []).map((c) => [c.occurred_at, `Recorded inbound call from ${custPhone || "the caller's phone"} to our office (${Math.round((c.duration_sec || 0) / 60)} min)${sumText(c.transcript_summary) ? `: ${sumText(c.transcript_summary)}` : ''}`]),
    [booking?.created_at, 'Booking created by our staff during the call'],
    [auth?.signed_at, `${card} charged ${fmt(auth?.amount)}${checksOk ? ' (issuer approved; CVC and billing ZIP matched)' : ''}`],
    ...(facts.outbound_texts || []).filter((m) => m.status === 'delivered').map((m) => [m.created_at, `Text delivered to ${custPhone || "the caller's phone"}: "${String(m.body || '').replace(/https?:\/\/\S+/g, '[link]').slice(0, 140)}"`]),
    [booking?.on_the_way_at, 'Cleaner dispatched to the service address'],
    [booking?.arrived_at, 'Cleaner arrived at the service address'],
    [booking?.completed_at, 'Job completed at the service address'],
    ...(facts.inbound_texts || []).map((m) => [m.created_at, `Text received from ${custPhone || "the caller's phone"}: "${String(m.body || '').slice(0, 200)}"`]),
    [facts.followup_call_at, `Our follow-up call to ${custPhone || 'the customer'}${facts.followup_call_status ? ` (${String(facts.followup_call_status).replace(/_/g, ' ')})` : ''}`],
  ].filter(([t]) => t).sort((a, b) => new Date(a[0]) - new Date(b[0])).map(([t, d]) => `${when(t)}: ${d}`);

  const offline = [
    `The service was performed in full at ${addr || 'the service address'}${booking?.completed_at ? ` and completed on ${day(booking.completed_at)}` : ''}. Job photos and the work order are attached.`,
    itemList ? `Services rendered: ${itemList}. Amount: ${fmt(auth?.amount)}.` : null,
    !(facts.inbound_texts || []).length ? `We received no complaint or refund request before this dispute.` : null,
  ];
  const narrative = (mode === 'in_person' ? [
    `The customer authorized this charge in person at the service address and signed on the cleaner's device.`,
    auth?.customer_name ? `Signed by: ${auth.customer_name}.` : null,
    `The service was fully delivered; job photos from the visit are attached.`,
    itemList ? `Services rendered: ${itemList}.` : null,
    (auth?.amount != null) ? `Amount: ${fmt(auth.amount)}${Number(auth.tip) > 0 ? ` (includes ${fmt(auth.tip)} tip)` : ''}.` : null,
  ] : mode === 'online' ? [
    `The customer booked online on our website and entered this card themselves; it was saved for the job and charged for the service.`,
    checksOk ? `The issuer approved the charge and both the CVC and billing ZIP checks passed.` : null,
    ...offline,
  ] : mode === 'on_file' ? [
    `The card on file for this booking was charged for the service.`,
    checksOk ? `The issuer approved the charge and both the CVC and billing ZIP checks passed.` : null,
    ...offline,
  ] : [
    `This was a telephone order. Our staff entered the card${call ? ' during a recorded call' : ''}; it was not a signature-at-completion charge.`,
    `On ${day(call?.occurred_at || auth?.signed_at)} ${call ? `the caller phoned our office${custPhone ? ` from ${custPhone}` : ''},` : 'the caller'} gave the name ${auth?.customer_name || customer?.name || 'on file'}${customer?.email ? ` and an email (recorded as ${customer.email})` : ''}, and asked for service at ${addr || 'the address on file'}.`,
    `The caller chose the services (${itemList || 'see work order'}), accepted the quoted total of ${fmt(auth?.amount)}, and gave the card number, expiration, security code and billing ZIP.`,
    checksOk ? `The issuer approved the charge and both the CVC and billing ZIP checks passed.` : null,
    `The service was then performed in full at that address${booking?.completed_at ? ` and completed on ${day(booking.completed_at)}` : ''}. Job photos and the work order are attached.`,
    !(facts.inbound_texts || []).length ? `We received no complaint or refund request before this dispute.` : null,
  ]).filter(Boolean).concat(timeline.length ? [`Timeline: ${timeline.join(' | ')}`] : []).join(' ');

  const workOrder = [
    `WORK ORDER: ${facts.brand_name || 'Service'}`,
    `Booking ${booking?.id || ''}`,
    '',
    `Service address: ${addr || ''}`,
    `Service date: ${day(booking?.completed_at || booking?.scheduled_at)}`,
    facts.technician_name ? `Cleaner: ${facts.technician_name}` : null,
    `Customer name given: ${auth?.customer_name || customer?.name || ''}`,
    custPhone ? `Customer phone given: ${custPhone}` : null,
    '',
    'Services:',
    ...items.map((x) => `  - ${x}`),
    `Total charged: ${fmt(auth?.amount)} (${card})`,
    '',
    'Job record:',
    booking?.on_the_way_at ? `  Cleaner dispatched: ${when(booking.on_the_way_at)}` : null,
    booking?.on_the_way_sms_delivered_at ? `  "On the way" text delivered to customer phone: ${when(booking.on_the_way_sms_delivered_at)}` : null,
    booking?.completed_at ? `  Job completed: ${when(booking.completed_at)}` : null,
    facts.photo_count ? `  Job photos taken at the address: ${facts.photo_count} (following pages)` : null,
  ].filter((x) => x !== null);

  const communication = [
    'CUSTOMER COMMUNICATION',
    '',
    mode === 'in_person' ? 'Card charged in person at the service address with the customer signature.' : mode === 'phone' ? `Telephone order, entered by our staff${call ? ' during a recorded call' : ''}.` : mode === 'online' ? 'Booked online; the customer entered the card on our website.' : 'Card on file charged for the service.',
    call ? `Call: ${when(call.occurred_at)}, ${Math.round((call.duration_sec || 0) / 60)} minutes, inbound from ${custPhone || 'the caller'} to our office line.` : null,
    mode === 'phone' ? `During the call the caller gave the name ${auth?.customer_name || customer?.name || ''}, phone ${custPhone || ''}${customer?.email ? `, an email (recorded as ${customer.email})` : ''}, and the service address ${addr || ''}.` : null,
    mode === 'phone' ? `The caller selected: ${itemList || 'see work order'}.` : null,
    mode === 'phone' ? `Our staff quoted the total of ${fmt(auth?.amount)}. The caller accepted the price and gave the card number, expiration, security code and billing ZIP for the charge.` : null,
    checksOk ? 'The issuer approved the charge; CVC and billing ZIP checks passed.' : null,
    '',
    'Timeline (UTC):',
    ...timeline.map((t) => `  ${t}`),
  ].filter((x) => x !== null);

  const evidence = {
    customer_name: auth?.customer_name || customer?.name || undefined,
    customer_email_address: customer?.email || undefined,
    customer_purchase_ip: inPerson ? (auth?.signed_ip || null) : null,
    shipping_address: addr || undefined,
    product_description: itemList ? `In-home service at ${addr || 'the customer address'}: ${itemList}` : 'In-home home cleaning / handyman service',
    service_date: (booking?.completed_at || booking?.scheduled_at) ? new Date(booking.completed_at || booking.scheduled_at).toISOString().slice(0, 10) : undefined,
    uncategorized_text: narrative.slice(0, 19000),
  };

  return { evidence, narrative, in_person: inPerson, mode, docs: { work_order: workOrder, communication } };
}
