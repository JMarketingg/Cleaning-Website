import { emailConfig, sendEmail } from './email.js';
import { emailNotificationsOn } from './notify.js';
import { sendSMS } from './sms.js';
import { computeJobPay } from './payroll.js';
import { bracketItemsCost } from './bracket-costs.js';
import { signToken } from './auth.js';

async function sendOwnerAlertEmail(subject, bodyText) {
  try {
    if (!emailNotificationsOn()) return;
    const cfg = emailConfig();
    if (!cfg.apiKey) return;
    const to = process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid';
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.6;">${bodyText}</div>`;
    await sendEmail({ to, subject, html, replyTo: cfg.from });
  } catch (e) { console.warn('[owner-notify] alert email failed:', e.message); }
}

const BIG_BRACKET_THRESHOLD = 4;
export function bracketCountFromLines(lines) {
  return (Array.isArray(lines) ? lines : []).reduce((n, l) => {
    const name = String(l.name || l.label || '');
    if (/\bmy own\b|\bown (mounting )?bracket|comes in the box|frame tv|using the bracket|you supply|soundbar/i.test(name)) return n;
    const isBracket = /\bbracket\b/i.test(name)
      || /^flat$/i.test(name.trim())
      || /^tilting/i.test(name.trim())
      || /^full motion/i.test(name.trim());
    return isBracket ? n + (Number(l.quantity ?? l.qty) || 1) : n;
  }, 0);
}
export async function maybeSendBigBracketAlert({ lines, customerName, whenStr, db, technicianId }) {
  try {
    const count = bracketCountFromLines(lines);
    if (count < BIG_BRACKET_THRESHOLD) return;
    if (db && technicianId) {
      const { data: t } = await db.from('technicians').select('skip_inventory').eq('id', technicianId).maybeSingle();
      if (t?.skip_inventory) return;
    }
    sendOwnerAlertEmail('Big bracket job booked',
      `Job with ${customerName || 'a customer'} has ${count} brackets on it. Scheduled for ${whenStr || 'an upcoming date'}.`);
  } catch (e) { console.warn('[big-bracket] alert error:', e.message); }
}

export async function claimOnce(db, key) {
  const { error } = await db.from('system_flags').insert({ key, value: { at: new Date().toISOString() } });
  return !error;
}

export async function maybeSendFirstMultiTvDiscountAlert(db, { discountAmt, customerName, whenStr }) {
  try {
    if (!discountAmt || discountAmt <= 0) return;
    const first = await claimOnce(db, 'multi_tv_discount_first_used');
    if (!first) return;
    sendOwnerAlertEmail('Multi-TV discount used for the first time',
      `The multi-TV discount was just used for the first time — ${customerName || 'a customer'}'s job (scheduled ${whenStr || 'soon'}) saved ₱${discountAmt.toFixed(2)}.`);
  } catch (e) { console.warn('[multi-tv-discount] alert error:', e.message); }
}

const GDS_ALERT_RE = /guarante\w*\s+dismount|dismount\s+service|\btv removal\b/i;
export function linesHaveGds(lines) {
  return (Array.isArray(lines) ? lines : []).some(l => GDS_ALERT_RE.test(String((l && (l.name || l.label)) || '')));
}

export function gdsUpsellUrlFor({ lines, bookingId, baseUrl, eligible = true }) {
  if (!eligible || !bookingId || !baseUrl) return null;
  if (linesHaveGds(lines)) return null;
  const token = signToken({ kind: 'add_gds', booking_id: bookingId }, 7776000);
  return `${String(baseUrl).replace(/\/$/, '')}/add-gds.html?token=${token}`;
}

export function rescheduleUrlFor({ bookingId, baseUrl }) {
  if (!bookingId || !baseUrl) return null;
  const token = signToken({ kind: 'reschedule', booking_id: bookingId }, 7776000);
  return `${String(baseUrl).replace(/\/$/, '')}/reschedule.html?token=${token}`;
}
export function estimateJobProfit({ price, lines, techName, scheduled_at, created_at }) {
  try {
    const synthetic = {
      status: 'completed', payment_status: 'paid',
      price, subtotal: price, amount_paid: price,
      line_items: Array.isArray(lines) ? lines : [],
      scheduled_at,
      created_at,
    };
    const result = computeJobPay(synthetic, techName || '');
    return (Number(price) || 0) - (Number(result.total) || 0) - bracketItemsCost(synthetic.line_items);
  } catch (e) { console.warn('[low-profit] estimate error:', e.message); return null; }
}
export function maybeSendZeroOrLowProfitAlert({ price, lines, techName, customerName, whenStr, scheduled_at }) {
  try {
    const p = Number(price) || 0;
    const isGds = linesHaveGds(lines);
    if (p === 0 && !isGds) {
      sendOwnerAlertEmail('Job booked at $0',
        `${customerName || 'A customer'}'s job (${whenStr || 'scheduled'}) was booked at $0 and is NOT Guaranteed Dismount Service — worth checking it's priced correctly.`);
      return;
    }
    if (isGds) return;
    const profit = estimateJobProfit({ price, lines, techName, scheduled_at });
    if (profit != null && profit < 20) {
      sendOwnerAlertEmail('Low-profit job booked',
        `${customerName || 'A customer'}'s job (${whenStr || 'scheduled'}) has an estimated profit of ₱${profit.toFixed(2)} — under $20.`);
    }
  } catch (e) { console.warn('[zero/low-profit] alert error:', e.message); }
}

function escHtml(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function tidyLineName(name) {
  const s = String(name || '');
  if (/^\s*tax\b/i.test(s)) return s.replace(/\s*\(\s*[\d.]+\s*%\s*\)/, '').trim() || 'Tax';
  return s;
}

export async function sendOwnerBookingAlert(d = {}) {
  try {
    if (!emailNotificationsOn()) return;
    const cfg = emailConfig(d.slug);
    if (!cfg.apiKey) return;

    const recipients = new Set();
    if (process.env.PER_BOOKING_ALERTS === '1') {
      recipients.add(process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid');
    }
    const slug = String(d.slug || '').toLowerCase();
    if (slug === 'tidyhaus' || slug === 'mile-high' || slug === 'austin' || slug === 'precision') {
      recipients.add(process.env.MILE_HIGH_SECRETARY_EMAIL || process.env.TIDYHAUS_SECRETARY_EMAIL || 'owner@example.invalid');
    } else if (slug === 'doms') {
      recipients.add(process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid');
    }
    recipients.delete('');
    if (!recipients.size) return;

    const tz = d.timezone || 'Asia/Manila';
    const money = (n) => '₱' +  (Number(n) || 0).toFixed(2);

    let when = '';
    if (d.scheduledAt) {
      try {
        const dt = new Date(d.scheduledAt);
        const datePart = dt.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        let timePart = dt.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
        if (d.scheduledEnd) timePart += ' – ' + new Date(d.scheduledEnd).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
        when = `${datePart} · ${timePart}`;
      } catch (_) { when = String(d.scheduledAt); }
    } else if (d.timeWindow) { when = d.timeWindow; }

    const c = d.customer || {}, a = d.address || {};
    const addr = [a.line1, a.city, a.state, a.zip].filter(Boolean).join(', ');
    const rows = [
      ['Company', d.businessName],
      ['Booked by', d.bookedBy],
      ['Customer', c.name],
      ['Phone', c.phone],
      ['Email', c.email],
      ['Address', addr],
      ['Service', d.serviceName],
      ['When', when],
      ['Cleaner', d.technicianName || 'Unassigned'],
      ['Total', d.price != null ? money(d.price) : null],
    ].filter(r => r[1]);
    const tbl = rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:#111;">${escHtml(String(v))}</td></tr>`).join('');
    const items = (Array.isArray(d.lineItems) ? d.lineItems : []).filter(Boolean)
      .map(li => `<tr><td style="padding:2px 10px 2px 0;">${escHtml(tidyLineName(li.name) || 'Item')}${(Number(li.quantity) || 1) > 1 ? ` ×${li.quantity}` : ''}</td><td style="padding:2px 0;text-align:right;">${money(li.line_total != null ? li.line_total : li.unit_price)}</td></tr>`).join('');
    const notes = d.customerNotes ? `<p style="margin:14px 0 0;"><b>Customer notes:</b> ${escHtml(d.customerNotes)}</p>` : '';
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Someone just booked an appointment.</h2>
      <table style="border-collapse:collapse;">${tbl}</table>
      ${items ? `<h3 style="margin:16px 0 6px;font-size:14px;">Job</h3><table style="border-collapse:collapse;font-size:14px;">${items}</table>` : ''}
      ${notes}
      ${d.bookingId ? `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Booking #${escHtml(d.bookingId)}</p>` : ''}
    </div>`;
    for (const to of recipients) {
      await sendEmail({ slug: d.slug, to, subject: 'Someone just booked an appointment', html, replyTo: cfg.from });
    }
  } catch (e) {
    console.warn('[owner-notify] non-fatal:', e.message);
  }
}

export async function sendCardSaveFailedAlert(d = {}) {
  try {
    if (!emailNotificationsOn()) return;
    const cfg = emailConfig(d.slug);
    if (!cfg.apiKey) return;

    const recipients = new Set([process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid']);
    const slug = String(d.slug || '').toLowerCase();
    if (slug === 'tidyhaus' || slug === 'mile-high' || slug === 'austin' || slug === 'precision') {
      recipients.add(process.env.MILE_HIGH_SECRETARY_EMAIL || process.env.TIDYHAUS_SECRETARY_EMAIL || 'owner@example.invalid');
    } else if (slug === 'doms') {
      recipients.add(process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid');
    }
    recipients.delete('');
    if (!recipients.size) return;

    const c = d.customer || {};
    const rows = [
      ['Company', d.businessName],
      ['Customer', c.name],
      ['Phone', c.phone],
      ['Email', c.email],
      ['When', d.when],
      ['Reason', d.reason],
    ].filter(r => r[1]);
    const tbl = rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:#111;">${escHtml(String(v))}</td></tr>`).join('');
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 4px;color:#b91c1c;">⚠ A customer's card did not save</h2>
      <p style="margin:0 0 14px;color:#374151;">They entered a card when booking, but it never actually attached — the booking still went through, but there's no card to charge at service time.</p>
      <table style="border-collapse:collapse;">${tbl}</table>
      <p style="margin:16px 0 0;font-size:13px;">Open this booking and use <b>"Change card"</b> to add it before the appointment.</p>
      ${d.bookingId ? `<p style="margin:10px 0 0;font-size:12px;color:#6b7280;">Booking #${escHtml(d.bookingId)}</p>` : ''}
    </div>`;
    for (const to of recipients) {
      await sendEmail({ slug: d.slug, to, subject: `⚠ Card did not save — ${d.customer?.name || 'a customer'}`, html, replyTo: cfg.from });
    }
  } catch (e) {
    console.warn('[owner-notify] non-fatal:', e.message);
  }
}

export async function sendUnassignedBookingAlert(d = {}) {
  try {
    if (!emailNotificationsOn()) {
      console.error('[owner-notify] UNASSIGNED BOOKING but email notifications are OFF; booking', d.bookingId, 'has no cleaner and nobody was alerted');
      return;
    }
    const cfg = emailConfig(d.slug);
    if (!cfg.apiKey) {
      console.error('[owner-notify] UNASSIGNED BOOKING but no email API key for', d.slug, '; booking', d.bookingId, 'has no cleaner and nobody was alerted');
      return;
    }

    const recipients = new Set([process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid']);
    const slug = String(d.slug || '').toLowerCase();
    if (slug === 'tidyhaus' || slug === 'mile-high' || slug === 'austin' || slug === 'precision') {
      recipients.add(process.env.MILE_HIGH_SECRETARY_EMAIL || process.env.TIDYHAUS_SECRETARY_EMAIL || 'owner@example.invalid');
    } else if (slug === 'doms') {
      recipients.add(process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid');
    }
    recipients.delete('');
    if (!recipients.size) return;

    const rows = [
      ['Company', d.businessName],
      ['Customer', d.customerName],
      ['When', d.whenStr],
    ].filter(r => r[1]);
    const tbl = rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:#111;">${escHtml(String(v))}</td></tr>`).join('');
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 4px;color:#b91c1c;">⚠ A job was booked with NO technician</h2>
      <p style="margin:0 0 14px;color:#374151;">Two customers grabbed the same time at once and no other cleaner was free, so this booking saved without anyone assigned. The customer already has a confirmation email for this window. Open the job and assign a cleaner, or call the customer to reschedule, right away.</p>
      <table style="border-collapse:collapse;">${tbl}</table>
      ${d.bookingId ? `<p style="margin:10px 0 0;font-size:12px;color:#6b7280;">Booking #${escHtml(d.bookingId)}</p>` : ''}
    </div>`;
    for (const to of recipients) {
      await sendEmail({ slug: d.slug, to, subject: `⚠ NO CLEANER on a new booking: ${d.customerName || 'a customer'}${d.whenStr ? ` (${d.whenStr})` : ''}`, html, replyTo: cfg.from });
    }
  } catch (e) {
    console.warn('[owner-notify] non-fatal:', e.message);
  }
}

export async function sendReviewCallComplaintAlert(d = {}) {
  try {
    const phone = process.env.OWNER_PHONE_NUMBER;
    if (phone) {
      const who = d.customerName || 'A customer';
      const note = String(d.note || '').replace(/\s+/g, ' ').trim();
      const msg = `Complaint from ${who} (${d.businessName || 'job'}${d.techName ? `, tech ${d.techName}` : ''})`
        + `${note ? `: "${note.slice(0, 220)}"` : '.'}`
        + ` Logged by ${d.loggedBy || 'the office'} on the review call.`;
      await sendSMS(phone, msg).catch(e => console.warn('[review-complaint] SMS failed:', e.message));
    }
  } catch (e) { console.warn('[review-complaint] SMS error:', e.message); }

  try {
    if (!emailNotificationsOn()) return;
    const cfg = emailConfig(d.slug);
    if (!cfg.apiKey) return;
    const recipients = new Set([process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid']);
    recipients.delete('');
    if (!recipients.size) return;

    const rows = [
      ['Company', d.businessName],
      ['Customer', d.customerName],
      ['Phone', d.phone],
      ['Email', d.email],
      ['Job', d.serviceName],
      ['Cleaner', d.techName],
      ['Job date', d.whenStr],
      ['Logged by', d.loggedBy],
      ['What they said', (d.tags || []).join(', ')],
    ].filter(r => r[1]);
    const tbl = rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:#111;">${escHtml(String(v))}</td></tr>`).join('');
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 4px;color:#b91c1c;">⚠ A customer said something went wrong</h2>
      <p style="margin:0 0 14px;color:#374151;">This came up on the follow-up call, so they have told us before telling the internet. No review request was sent.</p>
      ${d.note ? `<blockquote style="margin:0 0 14px;padding:11px 14px;background:#fef2f2;border-left:4px solid #b91c1c;border-radius:6px;color:#7f1d1d;">${escHtml(String(d.note))}</blockquote>` : ''}
      <table style="border-collapse:collapse;">${tbl}</table>
      ${d.bookingId ? `<p style="margin:14px 0 0;font-size:12px;color:#6b7280;">Booking #${escHtml(d.bookingId)}</p>` : ''}
    </div>`;
    for (const to of recipients) {
      await sendEmail({ slug: d.slug, to, subject: `⚠ Complaint on the review call — ${d.customerName || 'a customer'}`, html, replyTo: cfg.from });
    }
  } catch (e) {
    console.warn('[review-complaint] non-fatal:', e.message);
  }
}

export async function sendPriceMismatchAlert(d = {}) {
  try {
    if (!emailNotificationsOn()) return;
    const cfg = emailConfig(d.slug);
    if (!cfg.apiKey) return;

    const recipients = new Set([process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid']);
    const slug = String(d.slug || '').toLowerCase();
    if (slug === 'tidyhaus' || slug === 'mile-high' || slug === 'austin' || slug === 'precision') {
      recipients.add(process.env.MILE_HIGH_SECRETARY_EMAIL || process.env.TIDYHAUS_SECRETARY_EMAIL || 'owner@example.invalid');
    } else if (slug === 'doms') {
      recipients.add(process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid');
    }
    recipients.delete('');
    if (!recipients.size) return;

    const c = d.customer || {};
    const money = (n) => '₱' +  (Number(n) || 0).toFixed(2);
    const rows = [
      ['Company', d.businessName],
      ['Customer', c.name],
      ['Phone', c.phone],
      ['Email', c.email],
    ].filter(r => r[1]);
    const tbl = rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:#111;">${escHtml(String(v))}</td></tr>`).join('');
    const items = (Array.isArray(d.lineItems) ? d.lineItems : []).filter(Boolean)
      .map(li => `<tr><td style="padding:2px 10px 2px 0;">${escHtml(tidyLineName(li.name) || 'Item')}</td><td style="padding:2px 0;text-align:right;">${money(li.line_total != null ? li.line_total : li.unit_price)}</td></tr>`).join('');
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 4px;color:#b91c1c;">⚠ Unrecognized line item on a new booking</h2>
      <p style="margin:0 0 14px;color:#374151;">One or more line items on this booking didn't match anything in the price catalog — the booking still went through at the price submitted, but it's worth a quick look to confirm it's correct.</p>
      <table style="border-collapse:collapse;">${tbl}</table>
      ${items ? `<h3 style="margin:16px 0 6px;font-size:14px;">Unrecognized item(s)</h3><table style="border-collapse:collapse;font-size:14px;">${items}</table>` : ''}
      ${d.bookingId ? `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Booking #${escHtml(d.bookingId)}</p>` : ''}
    </div>`;
    for (const to of recipients) {
      await sendEmail({ slug: d.slug, to, subject: `⚠ Unrecognized line item — ${d.customer?.name || 'a customer'}`, html, replyTo: cfg.from });
    }
  } catch (e) {
    console.warn('[owner-notify] non-fatal:', e.message);
  }
}

export async function sendOwnerEstimateAlert(d = {}) {
  try {
    if (!emailNotificationsOn()) return;
    const cfg = emailConfig(d.slug);
    if (!cfg.apiKey) return;

    const recipients = new Set();
    if (process.env.PER_BOOKING_ALERTS === '1') {
      recipients.add(process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid');
    }
    const slug = String(d.slug || '').toLowerCase();
    if (slug === 'tidyhaus' || slug === 'mile-high' || slug === 'austin' || slug === 'precision') {
      recipients.add(process.env.MILE_HIGH_SECRETARY_EMAIL || process.env.TIDYHAUS_SECRETARY_EMAIL || 'owner@example.invalid');
    } else if (slug === 'doms') {
      recipients.add(process.env.DOMS_SECRETARY_EMAIL || 'owner@example.invalid');
    }
    recipients.delete('');
    if (!recipients.size) return;

    const c = d.customer || {};
    const rows = [
      ['Company', d.businessName],
      ['Customer', c.name],
      ['Phone', c.phone],
      ['Email', c.email],
      ['ZIP', d.zip],
      ['Service', d.serviceLabel],
    ].filter(r => r[1]);
    const tbl = rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:3px 0;color:#111;">${escHtml(String(v))}</td></tr>`).join('');
    const slotsHtml = (Array.isArray(d.preferredSlots) && d.preferredSlots.length)
      ? `<p style="margin:14px 0 0;"><b>Preferred times:</b> ${escHtml(d.preferredSlots.map(s => s.label || s.slot_key).join(', '))}</p>` : '';
    const photoHtml = d.photoUrl ? `<p style="margin:14px 0 0;"><a href="${escHtml(d.photoUrl)}">View attached photo</a></p>` : '';
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
      <h2 style="margin:0 0 12px;">New estimate request — not a booking yet.</h2>
      <table style="border-collapse:collapse;">${tbl}</table>
      <p style="margin:14px 0 0;"><b>What they need:</b> ${escHtml(d.description || '')}</p>
      ${slotsHtml}
      ${photoHtml}
      <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Check the Estimates tab on the dashboard to price it and send an approval link.</p>
    </div>`;
    for (const to of recipients) {
      await sendEmail({ slug: d.slug, to, subject: 'New estimate request', html, replyTo: cfg.from });
    }
  } catch (e) {
    console.warn('[owner-notify] non-fatal:', e.message);
  }
}

const LEAD_GEN_OWN_CHIP_SLUGS = ['tidyhaus', 'doms'];
export function isLeadGenSlug(slug) {
  return !LEAD_GEN_OWN_CHIP_SLUGS.includes(String(slug || '').toLowerCase());
}
export function maybeSendLeadGenBookingAlert({ slug, businessName, customerName, whenStr }) {
  try {
    if (!isLeadGenSlug(slug)) return;
    const msg = `${businessName || 'A lead-gen business'} just booked an appointment`
      + `${customerName ? ` — ${customerName}` : ''}${whenStr ? `, ${whenStr}` : ''}.`;
    sendOwnerAlertEmail(`${businessName || 'A lead-gen business'} just booked an appointment`, msg);
  } catch (e) { console.warn('[lead-gen-booking] alert error:', e.message); }
}

export async function sendReviewBonusEarnedAlert({ techName, amount }) {
  try {
    await sendOwnerAlertEmail(`${techName || 'A cleaner'} earned the ₱${Number(amount) || 100} review bonus`,
      `${techName || 'A cleaner'} just finished all 5 Google reviews. `
      + `A ₱${Number(amount) || 100} bonus has been added to their payroll for this week.`);
  } catch (e) { console.warn('[review-bonus] alert error:', e.message); }
}

export async function sendTechJoinedAlert({ techName, company, metro, slotCount, unstaffed, payrollNote, welcomeFailed }) {
  try {
    let msg = `New cleaner joined: ${techName}, ${company} - ${metro}. `;
    msg += unstaffed
      ? `${metro} isn't taking online bookings yet, so no automatic jobs reach them until you open it. `
      : `LIVE for jobs now, ${slotCount} time slot${slotCount === 1 ? '' : 's'} a week. `;
    msg += 'Not who you invited? Deactivate them on the Cleaners tab.';
    if (payrollNote) msg += ` PAYROLL: ${payrollNote}`;
    if (welcomeFailed) msg += ` Heads up: our welcome text to them failed (${welcomeFailed}), so job texts may not reach them either.`;
    await sendOwnerAlertEmail(`New cleaner joined: ${techName}`, msg);
  } catch (e) { console.warn('[tech-join] alert error:', e.message); }
}
