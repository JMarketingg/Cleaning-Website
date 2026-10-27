import { serviceClient } from './supabase.js';
import { emailConfig, sendEmail } from './email.js';
import { emailNotificationsOn } from './notify.js';
import { localDayStartUTC } from './time.js';
import { linesHaveGds, estimateJobProfit } from './owner-notify.js';

const DIGEST_TZ = 'Asia/Manila';

function escHtml(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function denverHour() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: DIGEST_TZ, hour: '2-digit', hour12: false }).format(new Date())) % 24;
}
function fmtWhen(iso, tz) {
  if (!iso) return 'Unscheduled';
  try {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
    const t = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d);
    return `${day} · ${t}`;
  } catch { return String(iso); }
}

export async function sendDailyBookingDigest({ force = false, dryRun = false, offset: forceOffset = null } = {}) {
  try {
    const hour = denverHour();
    let offset;
    if (Number.isFinite(forceOffset)) offset = forceOffset;
    else if (force) offset = 0;
    else if (hour >= 20) offset = 0;
    else if (hour < 8)   offset = -1;
    else return { skipped: `not evening (Manila hour ${hour})`, denverHour: hour };

    if (!emailNotificationsOn()) return { skipped: 'notifications off' };
    const cfg = emailConfig('tidyhaus');
    if (!cfg.apiKey) return { skipped: 'no email API key' };
    const to = process.env.OWNER_NOTIFY_EMAIL || 'owner@example.invalid';

    const db = serviceClient();
    const start = localDayStartUTC(DIGEST_TZ, offset);
    const end   = localDayStartUTC(DIGEST_TZ, offset + 1);
    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: DIGEST_TZ }).format(start);

    const { data: rows } = await db.from('bookings')
      .select(`id, created_at, scheduled_at, price, status, service_area_id, source, metadata, customer_id,
               business:businesses ( name, slug, timezone ),
               area:service_areas ( name ),
               customer:customers ( name, phone, email ),
               technician:technicians!technician_id ( id, name ),
               booking_line_items ( kind, name, quantity, unit_price, line_total ),
               address_line1, city, state, postal_code`)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .neq('status', 'cancelled')
      .neq('source', 'import')
      .order('created_at', { ascending: true });
    const bookings = rows || [];

    const bookedByLabel = (b) => {
      if (b.source === 'widget') return 'Online booking';
      return b.metadata?.booked_by || 'Office';
    };
    const couponLabel = (b) => {
      const li = (b.booking_line_items || []).find(x => x.kind === 'coupon');
      return li ? li.name.replace(/^Coupon\s+/i, '') : null;
    };
    const ZIP_ADJUSTMENT_LINE_NAME = 'Location-based pricing';
    const zipAdjustmentLine = (b) => (b.booking_line_items || []).find(x => x.name === ZIP_ADJUSTMENT_LINE_NAME) || null;

    let overdue = [];
    try {
      const overdueThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: overdueRows } = await db.from('bookings')
        .select(`id, scheduled_at, status, metadata,
                 business:businesses ( name ),
                 customer:customers ( name ),
                 technician:technicians!technician_id ( name )`)
        .lt('scheduled_at', overdueThreshold)
        .not('status', 'in', '(completed,cancelled)')
        .neq('source', 'import')
        .order('scheduled_at', { ascending: true })
        .limit(50);
      overdue = (overdueRows || []).filter(o => !(o.metadata && o.metadata.digest_ignore));
    } catch (e) {
      console.warn('[daily-digest] overdue-jobs check failed (non-fatal):', e.message);
    }

    if (dryRun) return { would_send: bookings.length, overdue: overdue.length, to, denverHour: hour };
    if (!bookings.length && !overdue.length) return { sent: false, count: 0, reason: 'no new bookings and nothing overdue' };

    const hoursLate = (iso) => Math.round((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
    const overdueBlock = overdue.length
      ? `<div style="margin:0 0 20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 18px;">
          <div style="font-weight:800;color:#9a3412;font-size:15px;margin-bottom:10px;">&#9203; ${overdue.length} job${overdue.length === 1 ? '' : 's'} overdue for completion</div>
          <ul style="margin:0;padding-left:18px;color:#9a4a1f;font-size:13px;line-height:1.7;">
            ${overdue.map(o => `<li><strong>${escHtml(o.customer?.name || 'A customer')}</strong> (${escHtml(o.business?.name || '')}) &mdash; scheduled ${hoursLate(o.scheduled_at)}h ago, still "${escHtml(o.status)}", tech: ${escHtml(o.technician?.name || 'unassigned')}.</li>`).join('')}
          </ul>
        </div>`
      : '';

    const areaIds = [...new Set(bookings.map(b => b.service_area_id).filter(Boolean))];
    const tzByArea = {};
    if (areaIds.length) {
      try {
        const { data: areas } = await db.from('service_areas').select('id, timezone').in('id', areaIds);
        for (const a of (areas || [])) tzByArea[a.id] = a.timezone;
      } catch { /* fall back to business tz */ }
    }
    const rowTz = (b) => tzByArea[b.service_area_id] || b.business?.timezone || DIGEST_TZ;

    const money = (n) => '₱' +  (Number(n) || 0).toFixed(2);
    const total = bookings.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: DIGEST_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(start);

    const who = (b) => b.customer?.name || 'A customer';

    const zipAdjustedBookings = bookings
      .map(b => ({ b, li: zipAdjustmentLine(b) }))
      .filter(x => x.li && Number(x.li.line_total) !== 0);
    const zipAdjustmentBlock = zipAdjustedBookings.length
      ? `<div style="margin:0 0 20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;">
          <div style="font-weight:800;color:#1e40af;font-size:15px;margin-bottom:10px;">&#128205; Zip pricing adjustment used today (${zipAdjustedBookings.length})</div>
          <ul style="margin:0;padding-left:18px;color:#1e40af;font-size:13px;line-height:1.7;">
            ${zipAdjustedBookings.map(({ b, li }) => {
              const amt = Number(li.line_total);
              const sign = amt > 0 ? '+' : '-';
              return `<li><strong>${escHtml(who(b))}</strong> (${escHtml(b.postal_code || 'zip unknown')}) &mdash; ${sign}${money(Math.abs(amt))}.</li>`;
            }).join('')}
          </ul>
        </div>`
      : '';

    const customerIdCounts = new Map();
    for (const b of bookings) {
      if (!b.customer_id) continue;
      customerIdCounts.set(b.customer_id, (customerIdCounts.get(b.customer_id) || 0) + 1);
    }
    const issueChecks = [
      {
        key: 'bare',
        label: 'Bare booking — no line items at all',
        test: (b) => !(b.booking_line_items || []).length,
        detail: (b) => `${who(b)}'s job has zero line items — likely never got a service selected. This is exactly the failure mode that caused a real data-loss incident before the booking-form guard was added.`,
      },
      {
        key: 'zero_not_gds',
        label: 'Booked at $0 and not Guaranteed Dismount',
        test: (b) => (Number(b.price) || 0) === 0 && !linesHaveGds(b.booking_line_items),
        detail: (b) => `${who(b)}'s job is priced at $0 but isn't a GDS ticket — check it's not missing its price.`,
      },
      {
        key: 'low_profit',
        label: 'Low or negative estimated profit',
        test: (b) => {
          if ((Number(b.price) || 0) === 0) return false;
          const p = estimateJobProfit({ price: b.price, lines: b.booking_line_items, techName: b.technician?.name, scheduled_at: b.scheduled_at, created_at: b.created_at });
          return p != null && p < 20;
        },
        detail: (b) => {
          const p = estimateJobProfit({ price: b.price, lines: b.booking_line_items, techName: b.technician?.name, scheduled_at: b.scheduled_at, created_at: b.created_at });
          return `${who(b)}'s job has an estimated profit of ${money(p)} — under $20.`;
        },
      },
      {
        key: 'no_tech',
        label: 'No cleaner assigned',
        test: (b) => !b.technician,
        detail: (b) => `${who(b)}'s job has nobody assigned yet.`,
      },
      {
        key: 'no_address',
        label: 'Missing service address',
        test: (b) => !(b.address_line1 || '').trim(),
        detail: (b) => `${who(b)}'s job has no address on file — can't be dispatched as-is.`,
      },
      {
        key: 'no_phone',
        label: "No customer phone on file",
        test: (b) => !(b.customer?.phone || '').trim(),
        detail: (b) => `${who(b)} has no phone number — no on-the-way text, no review request.`,
      },
      {
        key: 'pending',
        label: 'Still pending at end of day',
        test: (b) => b.status === 'pending',
        detail: (b) => `${who(b)}'s job was never confirmed — still sitting in "pending" status.`,
      },
      {
        key: 'duplicate_customer',
        label: 'Same customer booked twice today',
        test: (b) => b.customer_id && customerIdCounts.get(b.customer_id) > 1,
        detail: (b) => `${who(b)} has ${customerIdCounts.get(b.customer_id)} bookings created today — confirm this isn't an accidental double-book.`,
      },
    ];
    const issues = [];
    for (const b of bookings) {
      for (const check of issueChecks) {
        if (check.test(b)) { issues.push({ key: check.key, label: check.label, text: check.detail(b) }); break; }
      }
    }
    const issuesByType = new Map();
    for (const iss of issues) {
      if (!issuesByType.has(iss.key)) issuesByType.set(iss.key, { label: iss.label, items: [] });
      issuesByType.get(iss.key).items.push(iss.text);
    }
    const issuesBlock = issues.length
      ? `<div style="margin:0 0 20px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 18px;">
          <div style="font-weight:800;color:#991b1b;font-size:15px;margin-bottom:10px;">&#9888; ${issues.length} issue${issues.length === 1 ? '' : 's'} found today</div>
          ${[...issuesByType.values()].map(g => `
            <div style="margin:0 0 10px;">
              <div style="font-weight:700;color:#7f1d1d;font-size:13px;margin-bottom:3px;">${escHtml(g.label)} (${g.items.length})</div>
              <ul style="margin:0;padding-left:18px;color:#b4453f;font-size:13px;line-height:1.6;">
                ${g.items.map(t => `<li>${escHtml(t)}</li>`).join('')}
              </ul>
            </div>`).join('')}
        </div>`
      : `<div style="margin:0 0 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;color:#166534;font-weight:700;font-size:14px;">&#9989; No issues found in today's bookings.</div>`;

    const CITY_SHORT = { 'oklahoma city': 'OKC', 'dallas-fort worth': 'DFW', 'los angeles': 'LA' };
    const BRAND_SHORT = { 'tidyhaus': 'HA', doms: "Dom's", a1tvmounting: 'A1' };
    const bizShortLabel = (b) => {
      const slug = b.business?.slug || '';
      let brand = BRAND_SHORT[slug] || String(b.business?.name || '').replace(/\s*TV (Mounting|Installation|Hanging|Pro|Pros)\b.*$/i, '').trim();
      const cityRaw = String(b.area?.name || b.city || '').trim();
      const city = CITY_SHORT[cityRaw.toLowerCase()] || cityRaw;
      if (!brand) brand = String(b.business?.name || '').trim();
      if (city && !brand.toLowerCase().includes(city.toLowerCase())) brand = `${brand} ${city}`;
      return brand.trim() || '—';
    };

    const rowsHtml = bookings.map(b => {
      return `<tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:9px 10px;vertical-align:top;font-weight:700;color:#111;">${escHtml(b.customer?.name || 'Customer')}</td>
        <td style="padding:9px 10px;vertical-align:top;font-size:13px;color:#111;">${escHtml(b.city || '—')}</td>
        <td style="padding:9px 10px;vertical-align:top;font-size:13px;color:#111;white-space:nowrap;">${escHtml(fmtWhen(b.scheduled_at, rowTz(b)))}</td>
        <td style="padding:9px 10px;vertical-align:top;font-size:13px;color:#111;">${escHtml(b.technician?.name || 'Unassigned')}</td>
        <td style="padding:9px 10px;vertical-align:top;font-size:13px;color:#111;white-space:nowrap;">${escHtml(bookedByLabel(b))}</td>
        <td style="padding:9px 10px;vertical-align:top;font-size:13px;color:#111;white-space:nowrap;">${escHtml(bizShortLabel(b))}</td>
        <td style="padding:9px 10px;vertical-align:top;text-align:right;font-weight:700;color:#111;white-space:nowrap;">${b.price != null ? money(b.price) : '—'}</td>
      </tr>`;
    }).join('');

    const bookingsTable = bookings.length ? `
      <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f9fafb;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">
          <th style="padding:9px 10px;">Customer</th><th style="padding:9px 10px;">City</th>
          <th style="padding:9px 10px;">Appointment</th><th style="padding:9px 10px;">Cleaner</th>
          <th style="padding:9px 10px;">Booked by</th>
          <th style="padding:9px 10px;">Business</th>
          <th style="padding:9px 10px;text-align:right;">Total</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>` : `
      <div style="color:#6b7280;font-size:14px;">No new bookings today.</div>`;

    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;max-width:680px;">
      <h2 style="margin:0 0 2px;">${bookings.length} new appointment${bookings.length === 1 ? '' : 's'} booked today</h2>
      <div style="color:#6b7280;font-size:14px;margin-bottom:16px;">${escHtml(dateLabel)} · daily summary</div>
      ${issuesBlock}
      ${overdueBlock}
      ${zipAdjustmentBlock}
      ${bookingsTable}
      <div style="margin-top:18px;font-size:12px;color:#9ca3af;">You're getting one summary a day instead of an email per booking. Sent at 8 PM Manila.</div>
    </div>`;

    await sendEmail({
      slug: 'tidyhaus', to,
      subject: `Daily booking summary — ${bookings.length} new appointment${bookings.length === 1 ? '' : 's'}${overdue.length ? `, ${overdue.length} overdue` : ''}`,
      html, replyTo: cfg.from,
      idempotencyKey: force ? `daily-digest-${dayKey}-resend-${Date.now()}` : `daily-digest-${dayKey}`,
    });
    return { sent: true, count: bookings.length, overdue: overdue.length, to, dayKey };
  } catch (e) {
    console.warn('[daily-digest] non-fatal:', e.message);
    return { sent: false, error: e.message };
  }
}
