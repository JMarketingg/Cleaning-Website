import { capName } from './name-case.js';
import { recipientContactBlock } from './miguel-contact-block.js';
import { emailNotificationsOn } from './notify.js';
import { demoMode } from './demo.js';

export function emailConfig(slug) {
  if (slug === 'doms') {
    return {
      apiKey: process.env.DOMS_RESEND_API_KEY || process.env.RESEND_API_KEY,
      from:   process.env.DOMS_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'mile-high') {
    return {
      apiKey: process.env.MILE_HIGH_RESEND_API_KEY,
      from:   process.env.MILE_HIGH_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'austin') {
    return {
      apiKey: process.env.AUSTIN_RESEND_API_KEY,
      from:   process.env.AUSTIN_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'precision') {
    return {
      apiKey: process.env.PRECISION_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.PRECISION_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'houstonmounting') {
    return {
      apiKey: process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.HOUSTONMOUNTING_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'houstontvinstallation') {
    return {
      apiKey: process.env.HOUSTONTVINSTALLATION_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.HOUSTONTVINSTALLATION_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'tvhanginghouston') {
    return {
      apiKey: process.env.TVHANGINGHOUSTON_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.TVHANGINGHOUSTON_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'houstontvmountingpros') {
    return {
      apiKey: process.env.HOUSTONTVMOUNTINGPROS_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.HOUSTONTVMOUNTINGPROS_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'millertime') {
    return {
      apiKey: process.env.MILLERTIME_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.MILLERTIME_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'houstonperfectviewtvmounting') {
    return {
      apiKey: process.env.HOUSTONPERFECTVIEW_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.HOUSTONPERFECTVIEW_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'htvmounting') {
    return {
      apiKey: process.env.HTVMOUNTING_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.HTVMOUNTING_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'tvmountingdenver') {
    return {
      apiKey: process.env.TVMOUNTINGDENVER_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.TVMOUNTINGDENVER_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'atxmountpros') {
    return {
      apiKey: process.env.ATXMOUNTPROS_RESEND_API_KEY || process.env.AUSTIN_LEADGEN_RESEND_API_KEY || process.env.AUSTIN_RESEND_API_KEY,
      from:   process.env.ATXMOUNTPROS_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'atxtvmount') {
    return {
      apiKey: process.env.ATXTVMOUNT_RESEND_API_KEY || process.env.AUSTIN_LEADGEN_RESEND_API_KEY || process.env.AUSTIN_RESEND_API_KEY,
      from:   process.env.ATXTVMOUNT_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'austinmountingpros') {
    return {
      apiKey: process.env.AUSTINMOUNTINGPROS_RESEND_API_KEY || process.env.AUSTIN_LEADGEN_RESEND_API_KEY || process.env.AUSTIN_RESEND_API_KEY,
      from:   process.env.AUSTINMOUNTINGPROS_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'austintvinstall') {
    return {
      apiKey: process.env.AUSTINTVINSTALL_RESEND_API_KEY || process.env.AUSTIN_LEADGEN_RESEND_API_KEY || process.env.AUSTIN_RESEND_API_KEY,
      from:   process.env.AUSTINTVINSTALL_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'tvmountinglosangeles') {
    return {
      apiKey: process.env.TVMOUNTINGLOSANGELES_RESEND_API_KEY || process.env.HOUSTONMOUNTING_RESEND_API_KEY,
      from:   process.env.TVMOUNTINGLOSANGELES_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'a1tvmounting') {
    return {
      apiKey: process.env.A1TVMOUNTING_RESEND_API_KEY || null,
      from:   process.env.A1TVMOUNTING_EMAIL_FROM || 'owner@example.invalid',
    };
  }
  if (slug === 'latvpro' || slug === 'lainstall') {
    return { apiKey: null, from: null };
  }
  return {
    apiKey: process.env.RESEND_API_KEY,
    from:   process.env.TIDYHAUS_EMAIL_FROM || 'owner@example.invalid',
  };
}

export const EMAIL_BRANDS = {
  'tidyhaus': { slug: 'tidyhaus', name: 'TidyHaus',            accent: '#FF6B35', website: 'tidyhausph.com' },
};
export function requestReceivedEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const accent = b.accent;
  const rgb = hexRgb(accent);
  const firstName = capName(String(details.firstName || '').trim());
  const serviceLabel = String(details.serviceLabel || '').trim();
  const items = (Array.isArray(details.lineItems) ? details.lineItems : [])
    .map(it => String((it && it.description) || '').trim())
    .filter(d => d && !isDefaultTypeLabel(d))
    .slice(0, 8);
  const windows = (Array.isArray(details.preferredSlots) ? details.preferredSlots : [])
    .map(s => [s && s.date, s && s.label].filter(Boolean).join(' · '))
    .filter(Boolean)
    .slice(0, 5);
  const where = [details.address, [details.city, details.state, details.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const subject = `We got your request | ${b.name}`;

  const row = (label, html) => html
    ? `<tr><td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;width:120px;vertical-align:top;">${label}</td><td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:15px;color:#11181c;line-height:1.5;">${html}</td></tr>`
    : '';
  const list = a => a.map(x => esc(x)).join('<br>');
  const summary = [
    row('Service', serviceLabel ? esc(serviceLabel) : ''),
    row('Details', items.length ? list(items) : ''),
    row('Preferred times', windows.length ? list(windows) : ''),
    row('Location', where ? esc(where) : ''),
  ].join('');
  const step = (n, title, body) => `<tr><td style="padding:0 0 14px;vertical-align:top;width:34px;"><div style="width:26px;height:26px;border-radius:13px;background:${accent};color:#fff;font-size:13px;font-weight:800;text-align:center;line-height:26px;">${n}</div></td><td style="padding:0 0 14px;vertical-align:top;"><div style="font-size:15px;font-weight:800;color:#11181c;">${title}</div><div style="font-size:14px;color:#4b5563;line-height:1.5;margin-top:2px;">${body}</div></td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
<tr><td style="background:${accent};padding:22px 28px;"><div style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-.01em;">${esc(b.name)}</div></td></tr>
<tr><td style="padding:28px 28px 8px;">
<div style="font-size:24px;font-weight:800;color:#11181c;letter-spacing:-.02em;">We got your request${firstName ? ', ' + esc(firstName) : ''}.</div>
<div style="font-size:15px;color:#4b5563;line-height:1.6;margin-top:8px;">Thanks for reaching out. Nothing is booked yet: we look over what you sent, then text you a written quote and the first open date.</div>
</td></tr>
<tr><td style="padding:18px 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${step(1, 'We review your request', 'We read the details and the wall you described.')}
${step(2, 'You get a written quote by text', 'It arrives at the number you gave us, with the first open date.')}
${step(3, 'You pick the date', 'Say yes and we lock it in. No sales visit and no obligation.')}
</table></td></tr>
${summary ? `<tr><td style="padding:6px 28px 8px;"><div style="font-size:13px;font-weight:800;color:#11181c;margin-bottom:4px;">What you sent us</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(${rgb},0.05);border-radius:12px;padding:4px 16px;">${summary}</table></td></tr>` : ''}
<tr><td style="padding:16px 28px 26px;"><div style="font-size:12.5px;color:#6b7280;line-height:1.6;">You are receiving this because you asked for a quote at ${esc(b.website)}. Reply to the text we send you if anything changes.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

export function brandFor(slug) {
  if (slug && !EMAIL_BRANDS[slug]) console.error(`[email] no brand for business "${slug}" — falling back to TidyHaus branding; add it to EMAIL_BRANDS`);
  return EMAIL_BRANDS[slug] || EMAIL_BRANDS['tidyhaus'];
}

export async function sendEmail({ slug, to, subject, html, replyTo, throwOnError = false, idempotencyKey = null, attachments = null }) {
  const contactBlock = await recipientContactBlock('email', to);
  if (contactBlock) return { sent: false, skipped: contactBlock };
  if (demoMode()) {
    console.log(`[email:demo] pretend-sent "${subject}" to ${to}`);
    return { sent: true, id: 'demo_email', demo: true };
  }
  if (!emailNotificationsOn()) {
    console.log(`[email] notifications off; not sending "${subject}" to ${to}`);
    return { sent: false, skipped: 'notifications_off' };
  }
  if (!to) return { sent: false, skipped: 'no_recipient' };
  const { apiKey, from } = emailConfig(slug);
  if (!apiKey) {
    console.warn(`[email] no Resend key for "${slug}"; not sending "${subject}"`);
    return { sent: false, skipped: 'no_api_key' };
  }

  const payload = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  if (Array.isArray(attachments) && attachments.length) payload.attachments = attachments;

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const msg = `Resend ${res.status}: ${errText.slice(0, 400)}`;
      if (throwOnError) throw new Error(msg);
      console.error('[email]', msg);
      return { sent: false, error: msg };
    }
    const data = await res.json().catch(() => ({}));
    return { sent: true, id: data.id || null };
  } catch (e) {
    if (throwOnError) throw e;
    console.error('[email] send failed:', e.message);
    return { sent: false, error: e.message };
  }
}

const GDS_UPSELL_PRICE = 35;

function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '17, 24, 28';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
function shade(hex, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const t = amt < 0 ? 0 : 255;
    return Math.round((t - v) * Math.abs(amt) + v);
  });
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
}

function cleanLineLabel(name) {
  const s = String(name || '');
  if (/guaranteed\s+dismount/i.test(s)) return 'GDS';
  if (/^\s*tax\b/i.test(s)) return s.replace(/\s*\(\s*[\d.]+\s*%\s*\)/, '').trim() || 'Tax';
  const i = s.indexOf(':');
  let out = (i > -1 ? s.slice(i + 1) : s).trim() || s;
  out = out.replace(/\s*[×✕✖]\s*\d+\s*$/, '').trim() || out;
  return out;
}
function isDefaultTypeLabel(name) { return /^\s*tv\s*type\s*:\s*regular\b/i.test(String(name || '')); }

function buildCalendarBlock({ startEpoch, endEpoch, businessName, addressLine, timeWindow, serviceName, baseUrl }) {
  const startSec = Number(startEpoch), endSec = Number(endEpoch);
  if (!startSec || !endSec) return '';
  const stamp = (sec) => {
    const d = new Date(sec * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
  };
  const calTitle = `${businessName} - ${serviceName || 'Home Cleaning'}`;
  const calLoc   = addressLine;
  const calDesc  = `Your ${businessName} appointment${timeWindow ? ` (arrival window ${timeWindow})` : ''}. Reply to your confirmation email with any questions.`;
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(calTitle)}`
    + `&dates=${stamp(startSec)}/${stamp(endSec)}`
    + `&details=${encodeURIComponent(calDesc)}`
    + `&location=${encodeURIComponent(calLoc)}`;
  const base = String(baseUrl || '').replace(/\/$/, '');
  const icsUrl = `${base}/api/book?action=ics&title=${encodeURIComponent(calTitle)}&start=${startSec}&end=${endSec}`
    + `&location=${encodeURIComponent(calLoc)}&details=${encodeURIComponent(calDesc)}`;
  const isoStamp = (sec) => new Date(sec * 1000).toISOString();
  const outlook = 'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent'
    + `&subject=${encodeURIComponent(calTitle)}`
    + `&startdt=${encodeURIComponent(isoStamp(startSec))}`
    + `&enddt=${encodeURIComponent(isoStamp(endSec))}`
    + `&body=${encodeURIComponent(calDesc)}`
    + `&location=${encodeURIComponent(calLoc)}`;

  const favicon = (domain) => `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  const calRow = (href, iconUrl, label, first) => `
            <a href="${esc(href)}" style="display:block;text-decoration:none;${first ? '' : 'border-top:1px solid #eef0f2;'}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td width="44" valign="middle" style="padding:15px 0 15px 18px;"><img src="${esc(iconUrl)}" width="26" height="26" alt="" style="display:block;border:0;"></td>
                <td valign="middle" style="padding:15px 18px 15px 12px;font-size:16px;font-weight:600;color:#11181c;">${label}</td>
              </tr></table>
            </a>`;
  const rows = [
    calRow(gcal, favicon('calendar.google.com'), 'Google Calendar', true),
    calRow(outlook, favicon('outlook.com'), 'Outlook Calendar', false),
  ];
  if (base) rows.push(calRow(icsUrl, favicon('apple.com'), 'Apple Calendar', false));

  return `
      <tr><td style="padding:24px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding-bottom:12px;">
            <span style="display:inline-block;border:1px solid #e5e7eb;border-radius:999px;padding:12px 26px;font-size:16px;font-weight:600;color:#11181c;">&#128197;&nbsp;&nbsp;Add to Calendar</span>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ebee;border-radius:16px;">
          <tr><td>${rows.join('')}</td></tr>
        </table>
      </td></tr>`;
}

export function bookingConfirmationEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const accent = b.accent;
  const rgb = hexRgb(accent);
  const firstName = capName((details.firstName || '').trim());
  const a = details.address || {};
  const addressLine = [a.line1, [a.city, a.state].filter(Boolean).join(', '), a.zip]
    .filter(Boolean).join(', ');

  const row = (label, val) => !val ? '' : `
        <tr>
          <td style="padding:6px 0;font-size:12.5px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;vertical-align:top;">${esc(label)}</td>
          <td align="right" style="padding:6px 0;font-size:14.5px;color:#1f2937;font-weight:700;vertical-align:top;">${esc(val)}</td>
        </tr>`;

  const detailRows =
    row('Date', details.dateLong) +
    row('Arrival window', details.timeWindow) +
    row('Service', details.serviceName || 'Home Cleaning') +
    row('Your cleaner', details.technicianName) +
    row('Address', addressLine);

  let priceBlock = '';
  const lines = Array.isArray(details.lines) ? details.lines.filter(li => li && li.amount != null && !isDefaultTypeLabel(li.label)) : [];
  if (lines.length && details.total != null) {
    const lineRows = lines.map(li => `
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#374151;">${esc(cleanLineLabel(li.label))}${Number(li.qty) > 1 ? ` &times; ${Number(li.qty)}` : ''}</td>
            <td align="right" style="padding:5px 0;font-size:14px;color:#374151;white-space:nowrap;">${money(li.amount)}</td>
          </tr>`).join('');
    const tipRow = Number(details.tip) > 0 ? `
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#374151;">Tip for cleaner</td>
            <td align="right" style="padding:5px 0;font-size:14px;color:#374151;white-space:nowrap;">${money(details.tip)}</td>
          </tr>` : '';
    const grand = (Number(details.total) || 0) + (Number(details.tip) || 0);
    priceBlock = `
      <tr><td style="padding:0 26px;"><div style="border-top:1px solid #e5e7eb;margin:22px 0;"></div></td></tr>
      <tr><td style="padding:0 26px;">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:10px;">Your quote</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${lineRows}${tipRow}
          <tr>
            <td style="padding:10px 0 0;font-size:15px;font-weight:900;color:#111827;">Total</td>
            <td align="right" style="padding:10px 0 0;font-size:17px;font-weight:900;color:${accent};white-space:nowrap;">${money(grand)}</td>
          </tr>
        </table>
      </td></tr>`;
  }

  const twoTechNote = details.twoTechs ? `
      <tr><td style="padding:14px 28px 0;">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Two cleaners</strong> are scheduled for this job.
        </div>
      </td></tr>` : '';

  let gdsUpsellBlock = '';
  if (details.gdsUpsellUrl) {
    gdsUpsellBlock = `
      <tr><td style="padding:22px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;">
          <tr><td style="padding:18px 20px;">
            <div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:12px;">Add to your ticket</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td valign="top">
                <div style="font-size:14.5px;font-weight:800;color:#111827;margin-bottom:4px;">Guaranteed Dismount Service</div>
                <div style="font-size:12.5px;color:#374151;line-height:1.5;"></div>
              </td>
              <td valign="top" align="right" style="padding-left:14px;white-space:nowrap;">
                <span style="font-size:16px;font-weight:900;color:#111827;">${money(GDS_UPSELL_PRICE)}</span>
              </td>
            </tr></table>
            <div style="margin-top:14px;">
              <a href="${esc(details.gdsUpsellUrl)}" style="display:block;text-align:center;text-decoration:none;font-weight:800;border-radius:10px;padding:13px 22px;font-size:14.5px;background:${accent};color:#ffffff;">Add Guaranteed Dismount &rarr;</a>
              <div style="font-size:11.5px;color:#6b7280;line-height:1.5;margin-top:10px;text-align:center;">Click this button and confirm and we will add it to your ticket. No need to call us.</div>
            </div>
          </td></tr>
        </table>
      </td></tr>`;
  }

  const rescheduleBlock = details.rescheduleUrl ? `
      <tr><td style="padding:16px 28px 0;text-align:center;">
        <a href="${esc(details.rescheduleUrl)}" style="display:inline-block;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 24px;font-size:13.5px;background:transparent;border:1px solid #d1d5db;color:#374151;">Reschedule this appointment &rarr;</a>
      </td></tr>` : '';

  const calendarBlock = buildCalendarBlock({
    startEpoch: details.startEpoch, endEpoch: details.endEpoch,
    businessName: b.name, addressLine, timeWindow: details.timeWindow,
    serviceName: details.serviceName, baseUrl: details.baseUrl,
  });

  let meetTechBlock = '';
  if (b.slug === 'tidyhaus' && details.technicianName && details.technicianPhotoUrl) {
    const techName = esc(details.technicianName);
    let bioText;
    if (details.technicianBioBlurb) {
      bioText = esc(details.technicianBioBlurb);
    } else if (Number(details.technicianBioYears) > 0) {
      bioText = `${techName} has been doing this for over ${Number(details.technicianBioYears)} years, so you're in good hands.`;
    } else {
      bioText = `${techName} is your cleaner for this job.`;
    }
    meetTechBlock = `
      <tr><td style="padding:20px 26px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:16px;">
          <tr>
            <td width="148" valign="top" style="padding:18px 0 18px 18px;">
              <img src="${esc(details.technicianPhotoUrl)}" width="130" height="130" alt="${techName}" style="display:block;width:130px;height:130px;border-radius:20px;object-fit:cover;">
            </td>
            <td valign="top" style="padding:18px 18px 18px 14px;">
              <div style="margin:0 0 7px;">
                <span style="font-size:16.5px;font-weight:800;color:#111827;">${techName}</span>
                <span style="display:inline-block;margin-left:8px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${accent};background:rgba(${rgb},0.16);padding:3px 9px;border-radius:100px;vertical-align:middle;">Lead cleaner</span>
              </div>
              <div style="font-size:14px;color:#4b5563;line-height:1.6;">${bioText}</div>
            </td>
          </tr>
        </table>
      </td></tr>`;
  }

  const para = 'font-size:13.5px;color:#4b5563;line-height:1.62;margin:0;';
  const ul   = 'margin:2px 0 0;padding-left:18px;color:#4b5563;font-size:13.5px;line-height:1.6;';
  const li   = 'margin:5px 0;';
  const heightCalcBtn = b.heightCalc ? `
            <a href="${esc(b.heightCalc)}" style="display:inline-block;margin:12px 0 2px;background:${accent};color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 16px;border-radius:8px;">Home Cleaning Height Calculator &rarr;</a>` : '';

  const card = (icon, title, bodyHtml) => `
      <tr><td style="padding:10px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eceef1;border-radius:14px;">
          <tr>
            <td width="54" valign="top" style="padding:16px 0 16px 16px;">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(${rgb},0.10);text-align:center;font-size:19px;line-height:38px;">${icon}</div>
            </td>
            <td valign="top" style="padding:16px 16px 16px 12px;">
              <div style="font-size:14.5px;font-weight:800;color:#11181c;margin:0 0 6px;">${title}</div>
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td></tr>`;

  const expectBlock = `
      <tr><td style="padding:28px 28px 4px;">
        <div style="border-top:1px solid #eef0f2;padding-top:26px;">
          <div style="font-size:18px;font-weight:800;color:#11181c;margin:0 0 4px;">What to expect from your cleaning</div>
          <div style="font-size:13.5px;color:#6b7280;line-height:1.6;">A few things to know before we arrive.</div>
        </div>
      </td></tr>
      ${card('&#129529;', 'Getting ready', `
              <ul style="${ul}">
                <li style="${li}">Please let building security or the front desk know we are coming.</li>
                <li style="${li}">Put away valuables and anything you don't want moved.</li>
                <li style="${li}">Tell us about pets, allergies or rooms to skip.</li>
              </ul>`)}
      ${card('&#128276;', 'On-the-way notification', `
              <ul style="${ul}">
                <li style="${li}">You'll get an "on-the-way" text when your cleaner is heading over, if you opted in to texts.</li>
                <li style="${li}">Your cleaner will arrive within your booked time window.</li>
              </ul>`)}
      ${card('&#128179;', 'Payment', `
              <ul style="${ul}">
                <li style="${li}">You pay after the cleaning is done.</li>
                <li style="${li}">Tips are welcome and go 100% to your cleaner.</li>
              </ul>`)}
      ${card('&#128197;', 'Cancellation &amp; rescheduling', `
              <ul style="${ul}">
                <li style="${li}">You can cancel or reschedule any time, as long as it's at least 24 hours before your booking.</li>
              </ul>
              <div style="${para}margin-top:8px;">${details.rescheduleUrl ? 'Use the "Reschedule this appointment" button near the top of this email to pick a new time yourself.' : "To make changes, just reply to this email or message us and we'll take care of it."}</div>`)}`;

  const subject = `Your ${b.name} booking is confirmed`;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f6f7f9;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">You're booked with ${esc(b.name)}${details.dateLong ? ' - ' + esc(details.dateLong) : ''}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Hero ticket card: confirmation, details, quote, upgrade, tech -->
        <tr><td style="background:#ffffff;border-radius:22px;overflow:hidden;border-top:4px solid ${accent};box-shadow:0 2px 10px rgba(16,24,40,.06);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 26px 0;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${accent};">Booking confirmed</div>
              <div style="font-size:24px;font-weight:800;color:#1f2937;margin-top:6px;letter-spacing:-.01em;line-height:1.25;">${esc(firstName || 'there')}, you're on the schedule.</div>
            </td></tr>
            <tr><td style="padding:20px 26px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:16px;">
                <tr><td style="padding:16px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${detailRows}
                  </table>
                </td></tr>
              </table>
            </td></tr>
            ${priceBlock}
            ${gdsUpsellBlock}
            ${rescheduleBlock}
            ${twoTechNote}
            ${meetTechBlock}
            <tr><td style="height:26px;"></td></tr>
          </table>
        </td></tr>

        <tr><td style="height:16px;"></td></tr>

        <!-- Everything-else card: calendar, what to expect, footer -->
        <tr><td style="background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 2px 10px rgba(16,24,40,.06);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${calendarBlock}
            ${expectBlock}
            <tr><td style="padding:24px 28px 30px;">
              <div style="border-top:1px solid #eef0f2;padding-top:18px;font-size:13px;color:#6b7280;line-height:1.65;">
                Need to make a change or have a question? Just <strong>reply to this email</strong> and our team will help.<br>
                <span style="color:#9ca3af;">${esc(b.website)}</span>
              </div>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function appointmentReminderEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const accent = b.accent;
  const rgb = hexRgb(accent);
  const firstName = capName((details.firstName || '').trim());
  const a = details.address || {};
  const addressLine = [a.line1, [a.city, a.state].filter(Boolean).join(', '), a.zip]
    .filter(Boolean).join(', ');
  const mapsUrl = addressLine ? `https://maps.google.com/?q=${encodeURIComponent(addressLine)}` : null;

  const row = (label, valHtml) => !valHtml ? '' : `
        <tr>
          <td style="padding:6px 0;font-size:12.5px;color:#8a8274;text-transform:uppercase;letter-spacing:.04em;vertical-align:top;">${esc(label)}</td>
          <td align="right" style="padding:6px 0;font-size:14.5px;color:#ffffff;font-weight:700;vertical-align:top;">${valHtml}</td>
        </tr>`;
  const detailRows =
    row('Date', details.dateLong ? esc(details.dateLong) : '') +
    row('Arrival window', details.timeWindow ? esc(details.timeWindow) : '') +
    row('Service', details.serviceName ? esc(details.serviceName) : '') +
    row('Technician', details.technicianName ? esc(details.technicianName) : '') +
    row('Address', addressLine ? (mapsUrl ? `<a href="${esc(mapsUrl)}" style="color:#ffffff;text-decoration:underline;">${esc(addressLine)}</a>` : esc(addressLine)) : '');

  let meetTechBlock = '';
  if (b.slug === 'tidyhaus' && details.technicianName && details.technicianPhotoUrl) {
    const techName = esc(details.technicianName);
    let bioText;
    if (details.technicianBioBlurb) bioText = esc(details.technicianBioBlurb);
    else if (Number(details.technicianBioYears) > 0) bioText = `${techName} has been doing this for over ${Number(details.technicianBioYears)} years, so you're in good hands.`;
    else bioText = `${techName} is your cleaner for this job.`;
    meetTechBlock = `
      <tr><td style="padding:20px 26px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#231d16;border-radius:16px;">
          <tr>
            <td width="148" valign="top" style="padding:18px 0 18px 18px;">
              <img src="${esc(details.technicianPhotoUrl)}" width="130" height="130" alt="${techName}" style="display:block;width:130px;height:130px;border-radius:20px;object-fit:cover;">
            </td>
            <td valign="top" style="padding:18px 18px 18px 14px;">
              <div style="margin:0 0 7px;">
                <span style="font-size:16.5px;font-weight:800;color:#ffffff;">${techName}</span>
                <span style="display:inline-block;margin-left:8px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${accent};background:rgba(${rgb},0.16);padding:3px 9px;border-radius:100px;vertical-align:middle;">Your cleaner</span>
              </div>
              <div style="font-size:14px;color:#a89f8f;line-height:1.6;">${bioText}</div>
            </td>
          </tr>
        </table>
      </td></tr>`;
  }

  const calendarBlock = buildCalendarBlock({
    startEpoch: details.startEpoch, endEpoch: details.endEpoch,
    businessName: b.name, addressLine, timeWindow: details.timeWindow,
    serviceName: details.serviceName, baseUrl: details.baseUrl,
  });

  const subject = `We will see you tomorrow!`;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f4f1ea;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your appointment with ${esc(b.name)} is 24 hours away. Here's everything you need to know.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <!-- Hero ticket card: countdown, details, tech -->
        <tr><td style="background:#181410;border-radius:22px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 26px 0;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${accent};">Tomorrow${details.timeWindow ? ' &middot; ' + esc(details.timeWindow) : ''}</div>
              <div style="font-size:24px;font-weight:900;color:#fff;margin-top:6px;line-height:1.25;">${esc(firstName || 'Hey')}, we'll see you tomorrow.</div>
            </td></tr>
            <tr><td style="padding:20px 26px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#231d16;border-radius:16px;">
                <tr><td style="padding:16px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${detailRows}
                  </table>
                </td></tr>
              </table>
            </td></tr>
            ${meetTechBlock}
            <tr><td style="padding:0 26px;"><div style="border-top:2px dashed #3a3127;margin:22px 0;"></div></td></tr>
            <tr><td style="padding:0 26px 26px;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8a8274;margin-bottom:12px;">On the day</div>
              <div style="font-size:14px;color:#d8d2c6;line-height:1.7;margin-bottom:6px;"><strong style="color:#fff;">1.</strong> Arrival within your booked time window.</div>
              <div style="font-size:14px;color:#d8d2c6;line-height:1.7;margin-bottom:6px;"><strong style="color:#fff;">2.</strong> An "on-my-way" text with ETA once your cleaner is heading over.</div>
              <div style="font-size:14px;color:#d8d2c6;line-height:1.7;">${details.technicianName ? esc(details.technicianName) : 'Your cleaner'} is ready to start as soon as they arrive &mdash; please make sure we can get in.</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="height:16px;"></td></tr>

        <!-- Everything-else card: calendar + policy notices -->
        <tr><td style="background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 2px 10px rgba(16,24,40,.06);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${calendarBlock}

            <tr><td style="padding:24px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                <tr>
                  <td width="50" valign="top" style="padding:15px 0 15px 16px;font-size:20px;">&#9888;&#65039;</td>
                  <td valign="top" style="padding:15px 16px 15px 6px;">
                    <div style="font-size:14px;font-weight:800;color:#92400e;margin:0 0 4px;">Check the cleaning before your cleaner leaves</div>
                    <div style="font-size:13px;color:#9a6a13;line-height:1.6;">Please walk through with your cleaner before they leave. If something was missed, tell us and we'll fix it.</div>
                  </td>
                </tr>
              </table>
            </td></tr>

            <tr><td style="padding:14px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
                <tr>
                  <td width="50" valign="top" style="padding:15px 0 15px 16px;font-size:20px;">&#128222;</td>
                  <td valign="top" style="padding:15px 16px 15px 6px;">
                    <div style="font-size:14px;font-weight:800;color:#991b1b;margin:0 0 4px;">Within the 24-hour window</div>
                    <div style="font-size:13px;color:#b4453f;line-height:1.6;">Your appointment is <strong>no longer cancelable online</strong>. If you still need to cancel, please call us and a late cancellation fee may apply.</div>
                  </td>
                </tr>
              </table>
            </td></tr>

            <tr><td style="padding:24px 28px 30px;">
              <div style="border-top:1px solid #eef0f2;padding-top:18px;text-align:center;font-size:12px;color:#9ca3af;">${esc(b.website)}</div>
            </td></tr>

          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function reviewEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const accent = b.accent;
  const rgb = hexRgb(accent);
  const tintBg   = `rgba(${rgb},0.06)`;
  const firstName = capName((details.firstName || '').trim());
  const clickUrl = details.clickUrl || details.reviewUrl || '#';
  const techFirst = (details.technicianName || '').trim().split(/\s+/)[0] || '';

  const subject = `How did we do?`;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef1f5;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">How did we do? ${esc(b.name)} would love to hear from you.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;box-shadow:0 2px 10px rgba(16,24,40,.08);border:1px solid #e1e4e8;">

        <tr><td style="padding:30px 32px 0;text-align:center;">
          <div style="font-size:14px;color:#5f6368;font-weight:500;">${esc(b.name)}</div>
        </td></tr>

        <tr><td style="padding:8px 32px 0;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#202124;line-height:1.35;">How was your service${firstName ? ', ' + esc(firstName) : ''}?</div>
          <div style="font-size:14px;color:#5f6368;line-height:1.6;margin-top:8px;max-width:400px;margin-left:auto;margin-right:auto;">${techFirst ? `${esc(techFirst)} just finished your job.` : 'Your job is complete.'} Tap a star to leave a quick review.</div>
        </td></tr>

        <!-- Star row: all five neutral gray until the customer actually rates on review.html -->
        <tr><td style="padding:26px 20px 6px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
            <td style="padding:0 4px;"><a href="${esc(clickUrl)}" style="text-decoration:none;font-size:36px;line-height:1;color:#dadce0;display:inline-block;">&#9733;</a></td>
            <td style="padding:0 4px;"><a href="${esc(clickUrl)}" style="text-decoration:none;font-size:36px;line-height:1;color:#dadce0;display:inline-block;">&#9733;</a></td>
            <td style="padding:0 4px;"><a href="${esc(clickUrl)}" style="text-decoration:none;font-size:36px;line-height:1;color:#dadce0;display:inline-block;">&#9733;</a></td>
            <td style="padding:0 4px;"><a href="${esc(clickUrl)}" style="text-decoration:none;font-size:36px;line-height:1;color:#dadce0;display:inline-block;">&#9733;</a></td>
            <td style="padding:0 4px;"><a href="${esc(clickUrl)}" style="text-decoration:none;font-size:36px;line-height:1;color:#dadce0;display:inline-block;">&#9733;</a></td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:20px 32px 4px;text-align:center;">
          <a href="${esc(clickUrl)}" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:500;padding:12px 28px;border-radius:24px;letter-spacing:.15px;">Share your feedback &rarr;</a>
        </td></tr>

        <tr><td style="padding:10px 32px 34px;text-align:center;">
          <div style="font-size:12px;color:#80868b;">Takes about 10 seconds</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function estimateEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const accent = b.accent;
  const rgb = hexRgb(accent);
  const tintBg = `rgba(${rgb},0.06)`;
  const firstName = capName((details.firstName || '').trim());
  const serviceLabel = (details.serviceLabel || '').trim();
  const description = (details.description || '').trim();
  const customerNote = (details.customerNote || '').trim();
  const approveUrl = (details.approveUrl || '').trim();
  const money = n => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
  };

  const couponAmount = Math.max(0, Number(details.couponAmount) || 0);

  const lineItems = (Array.isArray(details.lineItems) ? details.lineItems : [])
    .map(it => ({
      description: String((it && it.description) || '').trim(),
      qty: Number(it && it.qty) || 0,
      unit_price: Number(it && it.unit_price) || 0,
    }))
    .filter(it => (it.qty || 1) * it.unit_price !== 0 && !isDefaultTypeLabel(it.description));
  const hasLineItems = lineItems.length > 0;
  if (couponAmount > 0 && hasLineItems) {
    lineItems.push({ description: `$${couponAmount} off — thanks for getting back to us`, qty: 1, unit_price: -couponAmount });
  }
  const subtotal = Math.round(lineItems.reduce((t, it) => t + it.qty * it.unit_price, 0) * 100) / 100;
  const taxRate = Number(details.taxRate) > 0 ? Number(details.taxRate) : 0;
  const taxAmt = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmt) * 100) / 100;

  const upsells = (Array.isArray(details.upsells) ? details.upsells : [])
    .map(u => ({
      description: String((u && u.description) || '').trim(),
      unit_price: Number(u && u.unit_price) || 0,
      qty: Number(u && u.qty) || 1,
      blurb: String((u && u.blurb) || '').trim(),
    }))
    .filter(u => u.description);
  const hasUpsells = upsells.length > 0 && !!approveUrl;

  const followUp = !!details.followUp;
  const subject = couponAmount > 0
    ? `$${couponAmount} off your estimate — did you see it?`
    : (followUp ? 'We finished your estimate. Did you see it?' : `Your ${b.name} Estimate`);

  const serviceRow = serviceLabel
    ? `<div style="font-size:15px;font-weight:800;color:#11181c;margin:0 0 8px;">${esc(serviceLabel)}</div>`
    : '';

  let bodyRow;
  if (hasLineItems) {
    const rows = lineItems.map(it => {
      const qtyTxt = it.qty && it.qty !== 1 ? `<span style="color:#8a909c;font-weight:600;">×${it.qty}</span> ` : '';
      const lineTotal = it.qty * it.unit_price;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eef0f2;font-size:14px;color:#3a4453;">${qtyTxt}${esc(it.description || 'Item')}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eef0f2;font-size:14px;color:#11181c;font-weight:700;text-align:right;white-space:nowrap;">${money(lineTotal)}</td>
      </tr>`;
    }).join('');
    const taxRows = taxRate > 0 ? `
        <tr>
          <td style="padding:12px 0 0;font-size:14px;color:#5b6470;">Subtotal</td>
          <td style="padding:12px 0 0;font-size:14px;color:#11181c;text-align:right;white-space:nowrap;">${money(subtotal)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-size:14px;color:#5b6470;">Tax</td>
          <td style="padding:4px 0 0;font-size:14px;color:#11181c;text-align:right;white-space:nowrap;">${money(taxAmt)}</td>
        </tr>` : '';
    bodyRow = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows}
        ${taxRows}
        <tr>
          <td style="padding:14px 0 0;font-size:15px;font-weight:800;color:#11181c;">Estimated total</td>
          <td style="padding:14px 0 0;font-size:18px;font-weight:800;color:${accent};text-align:right;white-space:nowrap;">${money(total)}</td>
        </tr>
      </table>`;
  } else {
    bodyRow = description
      ? `<div style="font-size:14px;color:#3a4453;line-height:1.6;white-space:pre-wrap;">${esc(description)}</div>`
      : `<div style="font-size:14px;color:#5b6470;line-height:1.6;">Details of your estimate request.</div>`;
  }

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef1f5;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${couponAmount > 0 ? `$${couponAmount} off your estimate from ${esc(b.name)} — already applied below.` : (followUp ? `Your estimate from ${esc(b.name)} is ready and waiting.` : `Your estimate from ${esc(b.name)}.`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-shadow:0 6px 24px rgba(16,24,40,.10);">

        <!-- Header -->
        <tr><td style="background:${accent};padding:18px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:.2px;">${esc(b.name)}</td>
            <td align="right" style="font-size:11px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:rgba(255,255,255,.82);">Your Estimate</td>
          </tr></table>
        </td></tr>

        <!-- Intro -->
        <tr><td style="background:${tintBg};padding:30px 28px 26px;">
          <div style="font-size:22px;font-weight:800;color:#11181c;margin:0 0 10px;">${followUp ? 'Did you see your estimate?' : "Here's your estimate"}</div>
          <div style="font-size:15px;color:#5b6470;line-height:1.6;">${followUp
            ? `Hi ${esc(firstName || 'there')}, we finished your estimate a few hours ago and wanted to make sure it reached you. Here it is again${couponAmount > 0 ? `, with $${couponAmount} off for getting back to us` : ''}:`
            : `Hi ${esc(firstName || 'there')}, thanks for reaching out. Here are the details of the estimate you requested:`}</div>
        </td></tr>

        ${couponAmount > 0 ? `
        <!-- Coupon banner -->
        <tr><td style="padding:0 28px 4px;">
          <div style="background:#166534;border-radius:12px;padding:16px 18px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.2px;">🎉 $${couponAmount} OFF your estimate</div>
            <div style="font-size:12.5px;color:#d1fae5;margin-top:4px;">Already applied to your total below — just approve to lock it in.</div>
          </div>
        </td></tr>` : ''}

        <!-- Estimate card -->
        <tr><td style="padding:24px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            <tr><td style="padding:18px 18px;">
              ${serviceRow}
              ${bodyRow}
            </td></tr>
          </table>
        </td></tr>

        ${customerNote ? `
        <!-- Note from the office (estimates.customer_note) -->
        <tr><td style="padding:10px 28px 4px;">
          <div style="background:${tintBg};border-left:4px solid ${accent};border-radius:8px;padding:14px 16px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${accent};margin:0 0 6px;">A note from us</div>
            <div style="font-size:14px;color:#3a4453;line-height:1.6;white-space:pre-wrap;">${esc(customerNote)}</div>
          </div>
        </td></tr>` : ''}

        ${hasUpsells ? `
        <!-- Recommended add-ons teaser -->
        <tr><td style="padding:6px 28px 4px;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${accent};margin:0 0 10px;">Recommended for your job</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${tintBg};border:1px solid #eef0f2;border-radius:12px;">
            <tr><td style="padding:14px 16px;">
              ${upsells.map(u => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="padding:5px 0;font-size:14px;color:#11181c;font-weight:700;">${esc(u.description)}${u.blurb ? `<div style="font-size:12.5px;color:#5b6470;font-weight:500;margin-top:2px;">${esc(u.blurb)}</div>` : ''}</td>
                <td style="padding:5px 0;font-size:14px;color:${accent};font-weight:800;text-align:right;white-space:nowrap;vertical-align:top;">+${money(u.unit_price)}</td>
              </tr></table>`).join('')}
            </td></tr>
          </table>
          <div style="font-size:13px;color:#5b6470;line-height:1.6;margin-top:10px;">Choose the ones you'd like on the next screen — your total updates as you pick.</div>
        </td></tr>` : ''}

        <!-- Next steps -->
        <tr><td style="padding:18px 28px 22px;">
          <div style="font-size:14px;color:#3a4453;line-height:1.6;">A member of our team will reach out shortly to finalize the details and get you scheduled. If you have any questions, just reply to this email.</div>
        </td></tr>
        ${approveUrl ? `
        <!-- Approve CTA -->
        <tr><td style="padding:0 28px 30px;">
          <div style="text-align:center;">
            <a href="${esc(approveUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 42px;border-radius:10px;letter-spacing:.3px;">${couponAmount > 0 ? `Approve &amp; save $${couponAmount} &rarr;` : (hasUpsells ? 'Review &amp; choose your estimate &rarr;' : 'Check availability')}</a>
            <div style="font-size:12px;color:#9ca3af;line-height:1.6;margin-top:11px;">${couponAmount > 0 ? `This link is the only way to redeem the $${couponAmount} discount.` : (hasUpsells ? 'Pick any upgrades you want and schedule — takes about a minute.' : 'Click above to see open times and book your appointment.')}</div>
          </div>
        </td></tr>` : ''}

        <!-- Footer -->
        <tr><td style="padding:8px 28px 32px;">
          <div style="border-top:1px solid #eef0f2;padding-top:18px;text-align:center;">
            <div style="font-size:13px;color:#6b7280;line-height:1.6;">Thank you for choosing ${esc(b.name)}!</div>
            <div style="font-size:12px;color:#9ca3af;margin-top:10px;">${esc(b.website)}</div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export function outOfScopeEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const firstName = capName((details.firstName || '').trim());
  const servicesUrl = (details.servicesUrl || '').trim();
  const subject = `About your ${b.name} estimate request`;
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef1f5;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">An update on your estimate request from ${esc(b.name)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-shadow:0 6px 24px rgba(16,24,40,.10);">
        <tr><td style="background:${b.accent};padding:18px 28px;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:.2px;">${esc(b.name)}</td></tr>
        <tr><td style="padding:30px 28px;">
          <div style="font-size:20px;font-weight:800;color:#11181c;margin:0 0 14px;">Sorry, this one's outside what we do</div>
          <div style="font-size:15px;color:#3a4453;line-height:1.7;">Hi ${esc(firstName || 'there')}, thanks for reaching out. We took a look at your request, and it looks like it's outside of what we're able to help with.</div>
          ${servicesUrl ? `
          <div style="font-size:15px;color:#3a4453;line-height:1.7;margin-top:14px;">Here's a list of what we do handle, in case any of it's useful:</div>
          <div style="text-align:center;margin-top:22px;">
            <a href="${esc(servicesUrl)}" style="display:inline-block;background:${b.accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 32px;border-radius:10px;">See what we do &rarr;</a>
          </div>` : ''}
          <div style="font-size:13px;color:#9ca3af;line-height:1.6;margin-top:24px;">Sorry we couldn't help with this one — feel free to reach back out if anything changes.</div>
        </td></tr>
        <tr><td style="padding:8px 28px 32px;">
          <div style="border-top:1px solid #eef0f2;padding-top:18px;text-align:center;">
            <div style="font-size:12px;color:#9ca3af;">${esc(b.website)}</div>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

export function receiptEmail(details = {}, brand = EMAIL_BRANDS['tidyhaus']) {
  const b = brand || EMAIL_BRANDS['tidyhaus'];
  const accent = b.accent;
  const kind = ['receipt', 'invoice', 'refunded'].includes(details.kind) ? details.kind : 'receipt';
  const isReceipt = kind === 'receipt';
  const isRefunded = kind === 'refunded';
  const heading = kind === 'invoice' ? 'Invoice' : 'Receipt';
  const a = details.address || {};
  const cityState = [a.city, a.state].filter(Boolean).join(', ');
  const addressLine = [a.line1, [cityState, a.zip].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  const lines = Array.isArray(details.lines)
    ? details.lines.filter(li => li && li.amount != null && !isDefaultTypeLabel(li.label))
    : [];
  const lineRows = lines.map(li => `
          <tr>
            <td style="padding:7px 0;font-size:14px;color:#374151;border-bottom:1px solid #f1f2f4;">${esc(cleanLineLabel(li.label))}${Number(li.qty) > 1 ? ` &times; ${Number(li.qty)}` : ''}</td>
            <td align="right" style="padding:7px 0;font-size:14px;color:#374151;white-space:nowrap;border-bottom:1px solid #f1f2f4;">${money(li.amount)}</td>
          </tr>`).join('');
  const subtotal = lines.reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const sumRow = (label, val, strong) => `
          <tr>
            <td style="padding:${strong ? '11px 0 0' : '5px 0 0'};font-size:${strong ? '15px' : '13.5px'};color:${strong ? '#11181c' : '#6b7280'};font-weight:${strong ? '800' : '400'};">${esc(label)}</td>
            <td align="right" style="padding:${strong ? '11px 0 0' : '5px 0 0'};font-size:${strong ? '18px' : '13.5px'};color:${strong ? accent : '#6b7280'};font-weight:${strong ? '900' : '400'};white-space:nowrap;">${money(val)}</td>
          </tr>`;
  const taxRow = Number(details.tax) > 0 ? sumRow('Tax', details.tax) : '';
  const tipRow = Number(details.tip) > 0 ? sumRow('Tip for cleaner', details.tip) : '';
  const refunded = Number(details.amountRefunded) || 0;
  const refundRow = refunded > 0 ? sumRow('Refunded', -refunded) : '';
  const adjustment = Number(details.adjustment) || 0;
  const adjustmentRow = Math.abs(adjustment) > 0.005 ? sumRow('Adjustment', adjustment) : '';

  const meta = (label, val) => !val ? '' : `
          <tr>
            <td style="padding:3px 0;font-size:12px;color:#8b93a1;text-transform:uppercase;letter-spacing:.04em;">${esc(label)}</td>
            <td align="right" style="padding:3px 0;font-size:13.5px;color:#11181c;font-weight:600;">${esc(val)}</td>
          </tr>`;

  const total = Number(details.total) || 0;
  const tip = Number(details.tip) || 0;
  const netPaid = Number(details.netPaid) || 0;
  const due = Math.max(0, Number(details.amountDue) || 0);
  const stamp = (bg, border, fg, dim, title, sub) => `
      <tr><td style="padding:18px 30px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid ${border};border-radius:12px;">
          <tr><td style="padding:14px 18px;">
            <div style="font-size:15px;font-weight:900;color:${fg};letter-spacing:.04em;">${title}</div>
            ${sub ? `<div style="font-size:13px;color:${dim};margin-top:3px;">${sub}</div>` : ''}
          </td></tr>
        </table>
      </td></tr>`;
  let statusBlock;
  if (isRefunded) {
    statusBlock = stamp('#f8fafc', '#cbd5e1', '#334155', '#475569', 'REFUNDED',
      `${esc(money(refunded))} refunded${details.refundedDate ? ' on ' + esc(details.refundedDate) : ''}. Nothing is owed.`);
  } else if (isReceipt) {
    statusBlock = stamp('#ecfdf5', '#a7f3d0', '#047857', '#065f46',
      `PAID${refunded > 0 ? ' (partially refunded)' : ''}`,
      esc([details.paymentLabel, details.paidDate].filter(Boolean).join(' · ')) || 'Thank you for your payment');
  } else {
    statusBlock = `
      <tr><td style="padding:18px 30px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
          <tr><td style="padding:14px 18px;">
            <div style="font-size:12px;font-weight:800;color:#9a3412;letter-spacing:.06em;text-transform:uppercase;">Amount due</div>
            <div style="font-size:22px;font-weight:900;color:#9a3412;margin-top:2px;">${money(due)}</div>
            ${netPaid > 0 ? `<div style="font-size:13px;color:#9a3412;margin-top:3px;">${money(netPaid)} already paid</div>` : ''}
          </td></tr>
        </table>
      </td></tr>
      ${details.payUrl ? `
      <tr><td style="padding:16px 30px 0;text-align:center;">
        <a href="${esc(details.payUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 34px;border-radius:10px;">Pay ${esc(money(due))} now &rarr;</a>
      </td></tr>` : ''}`;
  }

  const subject = `${heading} from ${b.name}${details.receiptNo ? ` (#${details.receiptNo})` : ''}`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:26px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">

        <tr><td style="padding:26px 30px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:17px;font-weight:900;color:#11181c;">${esc(b.name)}</td>
            <td align="right" style="font-size:13px;font-weight:800;color:${accent};letter-spacing:.1em;text-transform:uppercase;">${esc(heading)}</td>
          </tr></table>
          <div style="border-top:1px solid #e9ebee;margin-top:16px;"></div>
        </td></tr>

        <tr><td style="padding:16px 30px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${meta(heading + ' #', details.receiptNo)}
            ${meta('Service date', details.serviceDate)}
            ${isReceipt ? meta('Date paid', details.paidDate) : ''}
            ${meta('Technician', details.technicianName)}
          </table>
        </td></tr>

        <tr><td style="padding:16px 30px 0;">
          <div style="font-size:12px;color:#8b93a1;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Billed to</div>
          <div style="font-size:14.5px;color:#11181c;font-weight:700;">${esc(capName(details.customerName) || 'Customer')}</div>
          ${addressLine ? `<div style="font-size:13.5px;color:#4b5563;margin-top:2px;line-height:1.5;">${esc(addressLine)}</div>` : ''}
        </td></tr>

        <tr><td style="padding:20px 30px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${lineRows}
            ${sumRow('Subtotal', subtotal)}
            ${taxRow}
            ${adjustmentRow}
            ${tipRow}
            ${sumRow('Total', total + tip, true)}
            ${refundRow}
          </table>
        </td></tr>

        ${statusBlock}

        <tr><td style="padding:22px 30px 28px;">
          <div style="border-top:1px solid #e9ebee;padding-top:14px;font-size:12.5px;color:#8b93a1;line-height:1.6;">
            Questions about this ${esc(heading.toLowerCase())}? Just reply to this email${details.businessPhone ? ' or call ' + esc(details.businessPhone) : ''}.
            <br>${esc(b.name)}${b.website ? ' · ' + esc(b.website) : ''}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}
