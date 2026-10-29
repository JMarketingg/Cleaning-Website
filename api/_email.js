// Shared look for the customer emails: logo header, a details card, sections and the signature.
// The underscore keeps Vercel from treating this file as an API route.
const SIGNATURE = require('./_signature');

const C = { cream: '#F6F2EA', forest: '#344B38', ink: '#26372D', muted: '#4D5C50', beige: '#E6E3D5', white: '#FFFFFF' };
const FONT = 'font-family:Arial,Helvetica,sans-serif;';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Short booking reference the customer can quote when they text or call, e.g. TH-4K7Q2M.
function bookingRef() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'TH-' + s;
}

function card(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.cream};border-radius:12px;">` +
    rows.filter(([, v]) => v).map(([k, v], i) =>
      `<tr><td style="${FONT}padding:12px 16px;font-size:13px;color:${C.muted};width:38%;vertical-align:top;${i ? `border-top:1px solid ${C.beige};` : ''}">${esc(k)}</td>` +
      `<td style="${FONT}padding:12px 16px;font-size:15px;font-weight:bold;color:${C.ink};vertical-align:top;${i ? `border-top:1px solid ${C.beige};` : ''}">${esc(v)}</td></tr>`).join('') +
    '</table>';
}

function section(title, html) {
  return `<h2 style="${FONT}font-size:17px;color:${C.ink};margin:28px 0 10px;">${esc(title)}</h2>${html}`;
}

function list(items, numbered) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
    items.map((t, i) => `<tr><td style="${FONT}vertical-align:top;padding:4px 10px 4px 0;font-size:15px;font-weight:bold;color:${C.forest};">${numbered ? (i + 1) + '.' : '&#10003;'}</td>` +
      `<td style="${FONT}padding:4px 0;font-size:15px;line-height:1.5;color:${C.ink};">${t}</td></tr>`).join('') + '</table>';
}

function button(href, text) {
  return `<a href="${esc(href)}" style="${FONT}display:inline-block;background:${C.forest};color:${C.white};padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px;">${esc(text)}</a>`;
}

// The whole email. badge is the small line above the headline, e.g. "Booking confirmed".
function layout({ preheader, badge, title, intro, body }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.white};border-radius:16px;overflow:hidden;">
<tr><td style="padding:22px 28px;border-bottom:1px solid ${C.beige};"><a href="https://tidyhausph.com"><img src="https://tidyhausph.com/images/email-signature-logo.png" width="150" height="56" alt="TidyHaus Home Cleaning" style="display:block;border:0;width:150px;height:56px;"></a></td></tr>
<tr><td style="padding:28px;${FONT}color:${C.ink};">
<p style="${FONT}margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${C.forest};">${esc(badge)}</p>
<h1 style="${FONT}margin:0 0 12px;font-size:26px;line-height:1.25;color:${C.ink};">${esc(title)}</h1>
<p style="${FONT}margin:0 0 22px;font-size:15px;line-height:1.6;color:${C.muted};">${intro}</p>
${body}
${SIGNATURE}
</td></tr></table>
<p style="${FONT}font-size:12px;color:${C.muted};margin:16px 0 0;">TidyHaus Home Cleaning &middot; 21st Floor, 8 Rockwell Dr, Makati City, 1210 Metro Manila</p>
</td></tr></table></body></html>`;
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function hhmm(h, m, ap) { return String((Number(h) % 12) + (/p/i.test(ap) ? 12 : 0)).padStart(2, '0') + m + '00'; }

// "Add to Google Calendar" link from "Tue, Nov 10, 2026" and "9:00 AM to 1:00 PM (about 4 hours)".
// Returns '' if the date or time is in a format we can't read.
function calendarLink(date, time, address) {
  const d = String(date).match(/([A-Z][a-z]{2})[a-z]*\.? (\d{1,2}),? (\d{4})/);
  const t = String(time).match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!d || !t || MONTHS[d[1]] == null) return '';
  const day = d[3] + String(MONTHS[d[1]] + 1).padStart(2, '0') + String(d[2]).padStart(2, '0');
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: 'TidyHaus cleaning', ctz: 'Asia/Manila',
    dates: `${day}T${hhmm(t[1], t[2], t[3])}/${day}T${hhmm(t[4], t[5], t[6])}`,
    details: 'Your TidyHaus cleaning. Questions? Text or call +63 992 309 5621.',
    location: address || ''
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

module.exports = { esc, bookingRef, card, section, list, button, layout, calendarLink };
