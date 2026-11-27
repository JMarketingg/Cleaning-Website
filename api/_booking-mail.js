// Booking emails that follow the deposit policy (Nov 2026):
//   1. depositRequest: "Pay your deposit to reserve your date" (sent when the owner confirms a request)
//   2. depositReminder: nudge when the deposit isn't paid yet
//   3. confirmed: "You're all set" (sent when the owner marks the deposit paid in the CRM)
// The underscore keeps Vercel from treating this file as an API route.
const mail = require('./_email');

const DEPOSIT_PCT = 25;
const DAY = 24 * 3600 * 1000;
const peso = (n) => '₱' + Math.round(Number(n) || 0).toLocaleString('en-US');

// 25% of the price, rounded UP to the next ₱50. Booking less than 24 hours ahead: the full amount.
function depositFor(price, startIso, now = Date.now()) {
  const p = Math.max(0, Math.round(Number(price) || 0));
  const start = startIso ? Date.parse(startIso) : NaN;
  const full = !Number.isNaN(start) && start - now < DAY;
  const deposit = full ? p : Math.min(p, Math.ceil((p * DEPOSIT_PCT) / 100 / 50) * 50);
  return { price: p, deposit, rest: p - deposit, full };
}

const P = (t) => `<p style="font-family:Arial,Helvetica,sans-serif;margin:0 0 8px;font-size:15px;line-height:1.6;color:#26372D;">${t}</p>`;

// The cancellation policy, written the same way everywhere (emails, website, terms).
const POLICY = [
  `Pay ${DEPOSIT_PCT}% to reserve your date. Booking less than 24 hours ahead? Pay in full.`,
  'Cancel or move your date 24 hours or more before: free.',
  'Cancel less than 24 hours before, or not home: the deposit is not refunded.',
  'If we cancel: full refund.'
];
function policySection() {
  return mail.section('Cancellation policy', mail.list(POLICY.map(mail.esc)));
}

const qty = (d) => [
  ['Date', d.date], ['Time', d.time], ['Address', d.address], ['Service', d.service], ['Size', d.size]
];

// "Pay ₱800 now" box with the QR code for the method they picked.
function payBox(d, amount, lead) {
  return mail.paymentBlock(d.payment, peso(amount), d.ref, lead);
}

function depositRequest(d) {
  const dep = depositFor(d.price, d.start);
  const first = mail.firstName(d.name);
  const subject = dep.full ? `Pay to book your TidyHaus cleaning on ${d.date}` : `Reserve your date: ${peso(dep.deposit)} deposit for ${d.date}`;
  const html = mail.layout({
    preheader: dep.full ? `Your cleaning is less than 24 hours away, so the full ${peso(dep.price)} is paid to book.` : `Pay ${peso(dep.deposit)} to reserve ${d.date}. The rest is paid on the day, before or after the cleaning.`,
    badge: 'Almost booked',
    title: `Your price is ready, ${first}!`,
    intro: dep.full
      ? `Your cleaning is less than 24 hours away, so the <strong>full amount (${peso(dep.price)})</strong> is paid to book it. <strong>Your date is reserved once we receive it.</strong>`
      : `To reserve your date, please pay a <strong>${DEPOSIT_PCT}% deposit of ${peso(dep.deposit)}</strong>. <strong>Your date is only held once the deposit is paid.</strong> The rest (${peso(dep.rest)}) is paid on the day, before or after the cleaning.`,
    body: mail.card([...qty(d), ['Price', peso(dep.price)], [dep.full ? 'Pay now (full amount)' : `Deposit now (${DEPOSIT_PCT}%)`, peso(dep.deposit)],
      dep.full ? ['', ''] : ['Rest, on the day', peso(dep.rest)], ['Reference', d.ref], ['Notes', d.notes]]) +
      mail.section(dep.full ? 'How to pay' : 'How to pay your deposit', payBox(d, dep.deposit,
        dep.full ? `Please pay <strong>${mail.esc(peso(dep.deposit))}</strong> to book` : `Please pay your <strong>${mail.esc(peso(dep.deposit))} deposit within 24 hours</strong> to reserve your date`)) +
      policySection() +
      P('By paying the deposit, you agree to our cancellation policy. Full terms: <a href="https://tidyhausph.com/terms-of-service" style="color:#344B38;font-weight:bold;">tidyhausph.com/terms-of-service</a>') +
      mail.section('Questions?', P('Reply to this email, or text or call us at <a href="tel:+639923095621" style="color:#344B38;font-weight:bold;">+63 992 309 5621</a>.'))
  });
  return { subject, html, dep };
}

function depositReminder(d) {
  const dep = depositFor(d.price, d.start, Date.parse(d.requested_at || '') || Date.now());
  const first = mail.firstName(d.name);
  const html = mail.layout({
    preheader: `Your date isn't reserved yet. Pay ${peso(dep.deposit)} to keep it.`,
    badge: 'Your date is not reserved yet',
    title: `Still want your cleaning on ${d.date}, ${first}?`,
    intro: `We haven't received your ${dep.full ? 'payment' : 'deposit'} yet, so <strong>your date is not reserved</strong>. Please pay <strong>${peso(dep.deposit)}</strong> to keep it. Already paid? Just reply with a screenshot and we'll update it.`,
    body: mail.card([...qty(d), [dep.full ? 'Pay now' : 'Deposit', peso(dep.deposit)], ['Reference', d.ref]]) +
      mail.section('How to pay', payBox(d, dep.deposit, `Please pay <strong>${mail.esc(peso(dep.deposit))}</strong> to reserve your date`)) +
      mail.section('Changed your plans?', P('No problem. Just reply and let us know, and we\'ll free up the date.'))
  });
  return { subject: `Your appointment is NOT reserved yet: ${d.date}`, html };
}

function confirmed(d) {
  const paid = Number(d.amount_paid) || 0, rest = Math.max(0, (Number(d.price) || 0) - paid);
  const first = mail.firstName(d.name);
  const cal = mail.calendarLink(d.date, d.time, d.address), ics = mail.icsLink(d.date, d.time, d.address);
  const html = mail.layout({
    preheader: `Confirmed: ${d.service} on ${d.date}, ${d.time}.`,
    badge: 'Booking confirmed',
    title: `You're all set, ${first}!`,
    intro: `We received your ${rest ? 'deposit' : 'payment'}, so your cleaning is <strong>confirmed</strong>${d.ref ? `. Your booking reference is <strong style="white-space:nowrap;">${mail.esc(d.ref)}</strong>` : ''}.`,
    body: mail.card([...qty(d), ['Price', peso(d.price)], ['Paid', peso(paid)], rest ? ['Rest, on the day', peso(rest)] : ['', ''], ['Payment', d.payment], ['Notes', d.notes]]) +
      (rest ? mail.section('Paying the rest', payBox(d, rest, `Please pay the rest, <strong>${mail.esc(peso(rest))}</strong>, on the day (before or after the cleaning)`)) : '') +
      (cal ? `<p style="margin:16px 0 0;">${mail.button(cal, 'Google Calendar')}&nbsp; ${mail.button(ics, 'Apple or Outlook calendar')}</p>` : '') +
      mail.section("What we'll clean", mail.list([
        '<strong>Living areas:</strong> dust shelves and surfaces, wipe tables, sweep and mop, tidy up, take out the trash',
        '<strong>Kitchen:</strong> wipe the counters, clean the sink, wipe the outside of appliances, sweep and mop',
        '<strong>Bedrooms:</strong> dust, make beds, wipe mirrors, sweep and mop',
        '<strong>Bathrooms:</strong> clean the toilet, sink and shower, wipe mirrors and counters, sweep and mop'
      ]) + P('See the full list at <a href="https://tidyhausph.com/#checklist" style="color:#344B38;font-weight:bold;">tidyhausph.com</a>.')) +
      mail.section('Before we arrive', mail.list([
        "If your building needs a gate pass or our cleaner's name or ID, please arrange it before the visit. Reply if you need our cleaner's details.",
        "For safety, give door codes in person or leave them with your building's guard or reception, not by message.",
        'Put away valuables and anything you don\'t want us to move.'
      ])) +
      policySection() +
      mail.section('Our promise', P("If we miss anything on the checklist, tell us within 12 hours and we'll come back to fix it for free.")) +
      (d.ref_code ? mail.section('Give ₱200, get ₱100', P(`Share your code <strong style="font-size:18px;letter-spacing:1px;">${mail.esc(d.ref_code)}</strong> with friends. They get ₱200 off their first cleaning, and you get ₱100 off your next cleaning after theirs is done. Every 10th cleaning is also ₱500 off.`)) : '') +
      mail.section('Happy with your clean?', P('A quick Google review helps other families in Makati and BGC find us. Thank you!') +
        `<p style="margin:10px 0 0;">${mail.button('https://g.page/r/CVupIA7gzCvJEBM/review', 'Leave us a Google review')}</p>`) +
      mail.section('Need to change something?', P('Reply to this email, or text or call us at <a href="tel:+639923095621" style="color:#344B38;font-weight:bold;">+63 992 309 5621</a>.'))
  });
  return { subject: `Confirmed: your TidyHaus cleaning on ${d.date}`, html };
}

// A CRM booking -> the fields the emails use.
function fromBooking(b) {
  const m = b.metadata || {};
  const fmt = (t, o) => new Date(t).toLocaleString('en-US', { timeZone: 'Asia/Manila', ...o });
  const date = b.scheduled_at ? fmt(b.scheduled_at, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const tm = (t) => fmt(t, { hour: 'numeric', minute: '2-digit' });
  const size = (String(b.notes || '').match(/^Size:\s*(.+)$/mi) || [])[1] || '';
  return {
    id: b.id, name: b.customer && b.customer.name, email: b.customer && b.customer.email,
    service: (b.service && b.service.name) || m.service || 'Cleaning', date,
    time: b.scheduled_at ? tm(b.scheduled_at) + (b.scheduled_end ? ' to ' + tm(b.scheduled_end) : '') : '',
    start: b.scheduled_at, address: b.address_line1, size, price: Number(b.price) || 0, amount_paid: Number(b.amount_paid) || 0,
    payment: m.payment || '', notes: b.customer_notes || '', ref: /^TH-[A-Z0-9]{6}$/.test(m.ref || '') ? m.ref : '',
    requested_at: m.deposit_requested_at || null,
    ref_code: (b.customer && b.customer.metadata && b.customer.metadata.ref_code) || ''
  };
}

module.exports = { DEPOSIT_PCT, POLICY, depositFor, policySection, depositRequest, depositReminder, confirmed, fromBooking, peso };
