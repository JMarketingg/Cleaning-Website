import { capName } from './name-case.js';
import { serviceClient } from './supabase.js';
import { emailNotificationsOn } from './notify.js';
import { appointmentReminderEmail, emailConfig, sendEmail, brandFor, EMAIL_BRANDS } from './email.js';
import { SLOTS, slotKeyForLocalTime, localHHMM } from './availability.js';

const HOUR = 60 * 60 * 1000;
const ADVANCE_MS = 24 * HOUR;
const WINDOW_MS  = 24 * HOUR;

const REMINDER_STATUSES = ['pending', 'confirmed', 'assigned'];

export async function sendAppointmentReminders(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = serviceClient();
  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  const windowEndISO = new Date(now + WINDOW_MS).toISOString();

  const { data: bizRows, error: bizErr } = await db.from('businesses').select('id, slug, timezone');
  if (bizErr) throw new Error(`businesses query failed: ${bizErr.message}`);
  const bizById = new Map((bizRows || []).map(b => [b.id, b]));
  const { data: saRows } = await db.from('service_areas').select('id, timezone');
  const areaTz = new Map((saRows || []).filter(a => a.timezone).map(a => [a.id, a.timezone]));

  const { data: rows, error } = await db
    .from('bookings')
    .select(`id, business_id, service_area_id, status, scheduled_at, created_at, metadata, address_line1, city, state, postal_code,
      customer:customers ( name, email ),
      service:services ( name ),
      technician:technicians!technician_id ( name, photo_url, bio_years, bio_blurb )`)
    .in('status', REMINDER_STATUSES)
    .gt('scheduled_at', nowISO)
    .lte('scheduled_at', windowEndISO);
  if (error) throw new Error(`bookings query failed: ${error.message}`);

  const summary = { checked: 0, sent: 0, skipped: 0, errors: 0, details: [] };

  for (const b of rows || []) {
    summary.checked++;
    const biz = bizById.get(b.business_id) || {};
    const slug = biz.slug;
    const meta = b.metadata || {};
    const email = b.customer?.email || '';
    const schedMs = b.scheduled_at ? Date.parse(b.scheduled_at) : NaN;
    const createdMs = b.created_at ? Date.parse(b.created_at) : NaN;

    let skip = null;
    if (!slug || !EMAIL_BRANDS[slug]) skip = `no email brand for business (${slug || b.business_id})`;
    else if (!email) skip = 'no customer email';
    else if (meta.reminder_sent_at) skip = 'already reminded';
    else if (!Number.isFinite(schedMs) || !Number.isFinite(createdMs)) skip = 'missing scheduled_at/created_at';
    else if (schedMs - createdMs < ADVANCE_MS) skip = 'booked inside 24h (same-day) - ignored';

    if (skip) {
      summary.skipped++;
      summary.details.push({ id: b.id, skip });
      continue;
    }

    const brand = brandFor(slug);
    const tz = areaTz.get(b.service_area_id) || biz.timezone || 'Asia/Manila';
    let dateLong = '';
    try {
      dateLong = new Date(schedMs).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch { /* leave blank */ }
    let timeWindow = '';
    let endMs = schedMs + 2 * HOUR;
    try {
      const slotDef = SLOTS.find(sl => sl.key === slotKeyForLocalTime(localHHMM(tz, b.scheduled_at)));
      if (slotDef) {
        const [sh, sm] = slotDef.start.split(':').map(Number), [eh, em] = slotDef.end.split(':').map(Number);
        endMs = schedMs + ((eh * 60 + em) - (sh * 60 + sm)) * 60000;
        timeWindow = slotDef.label;
      } else {
        const fmt = (d) => d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
        timeWindow = `${fmt(new Date(schedMs))} - ${fmt(new Date(endMs))}`;
      }
    } catch { /* leave blank */ }

    const firstName = capName((b.customer?.name || '').trim().split(/\s+/)[0] || '');
    const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    const { subject, html } = appointmentReminderEmail({
      firstName,
      dateLong,
      timeWindow,
      serviceName: b.service?.name || null,
      technicianName: b.technician?.name || null,
      technicianPhotoUrl: b.technician?.photo_url || null,
      technicianBioYears: b.technician?.bio_years || null,
      technicianBioBlurb: b.technician?.bio_blurb || null,
      address: { line1: b.address_line1, city: b.city, state: b.state, zip: b.postal_code },
      startEpoch: Math.floor(schedMs / 1000),
      endEpoch: Math.floor(endMs / 1000),
      baseUrl,
    }, brand);

    if (dryRun) {
      summary.sent++;
      summary.details.push({ id: b.id, wouldSend: email, slug });
      continue;
    }

    try {
      const { from } = emailConfig(slug);
      const result = await sendEmail({ slug, to: email, subject, html, replyTo: from });
      if (result.sent) {
        const newMeta = { ...meta, reminder_sent_at: nowISO };
        const { error: upErr } = await db.from('bookings').update({ metadata: newMeta }).eq('id', b.id);
        if (upErr) console.warn(`[reminders] sent but failed to mark booking ${b.id}:`, upErr.message);
        summary.sent++;
        summary.details.push({ id: b.id, sent: email, slug, id_resend: result.id || null });
        console.log(`[reminders] reminder SENT to ${email} (${slug}) booking=${b.id}`);
      } else {
        summary.skipped++;
        summary.details.push({ id: b.id, notSent: result.skipped || result.error });
        console.warn(`[reminders] reminder NOT sent to ${email} (${slug}) booking=${b.id}:`, result.skipped || result.error);
      }
    } catch (e) {
      summary.errors++;
      summary.details.push({ id: b.id, error: e.message });
      console.error(`[reminders] error on booking ${b.id}:`, e.message);
    }
  }

  console.log(`[reminders] pass complete: checked=${summary.checked} sent=${summary.sent} skipped=${summary.skipped} errors=${summary.errors} dryRun=${dryRun} emailSwitch=${emailNotificationsOn()}`);
  return summary;
}
