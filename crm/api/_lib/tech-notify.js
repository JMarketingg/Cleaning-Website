import { miguelContactBlocked } from './miguel-contact-block.js';
import { sendSMSResult } from './sms.js';
import { signToken } from './auth.js';

function baseUrl() {
  return process.env.PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

async function logAttempt(db, row) {
  try {
    const { data } = await db.from('tech_sms_log').insert(row).select('id').maybeSingle();
    return data?.id || null;
  } catch { return null; }
}

export async function notifyTechAssigned(db, biz, technicianId, scheduledAtISO, areaTz, opts = {}) {
  const kind = opts.kind || 'assigned';
  const bookingId = opts.bookingId || null;
  if (!technicianId) return { ok: false, skipped: 'no_technician' };
  if (miguelContactBlocked(technicianId)) return { ok: false, skipped: 'owner_miguel_no_contact' };

  const { data: tech, error: techErr } = await db.from('technicians')
    .select('phone, business_id').eq('id', technicianId).maybeSingle();
  if (techErr) {
    console.error('[tech-notify] technician lookup failed:', techErr.message);
    await logAttempt(db, {
      booking_id: bookingId, technician_id: technicianId, business_id: biz?.id || null,
      kind, status: 'failed', error: `tech lookup: ${techErr.message}`,
    });
    return { ok: false, error: techErr.message };
  }
  if (!tech?.phone) {
    await logAttempt(db, {
      booking_id: bookingId, technician_id: technicianId, business_id: biz?.id || null,
      kind, status: 'skipped', skip_reason: 'no_phone',
    });
    return { ok: false, skipped: 'no_phone' };
  }

  const tz = areaTz || biz?.timezone || 'Asia/Manila';
  let whenTxt = 'a new job';
  if (scheduledAtISO) {
    try {
      whenTxt = new Date(scheduledAtISO).toLocaleString('en-US', {
        timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch { /* keep generic */ }
  }

  const appLink = `${baseUrl()}/tech.html`;
  const crossCompany = tech.business_id && biz?.id && tech.business_id !== biz.id;
  const forBiz = crossCompany ? ` for ${String(biz?.name || '').toUpperCase()} (not your own company)` : '';
  let msg;
  if (kind === 'unassigned') {
    msg = `Update: the job${forBiz} on ${whenTxt} was rescheduled by the customer and is no longer assigned to you. No action needed.`;
  } else if (kind === 'rescheduled') {
    msg = `One of your jobs${forBiz} MOVED to ${whenTxt}. Address & details in the app: ${appLink}`;
  } else {
    msg = `You got a job${forBiz}! ${whenTxt}. Address & details in the app: ${appLink}`;
  }

  const logId = await logAttempt(db, {
    booking_id: bookingId, technician_id: technicianId, business_id: biz?.id || null,
    kind, status: 'pending', to_phone: tech.phone,
  });

  const statusCallback = logId
    ? `${baseUrl()}/api/analytics?action=sms_status&token=${encodeURIComponent(signToken({ kind: 'tech_sms', tech_sms_log_id: logId }, 86400))}`
    : undefined;

  const r = await sendSMSResult(tech.phone, msg, statusCallback ? { statusCallback } : {});

  if (logId) {
    const patch = r.ok
      ? { status: 'pending' }
      : r.skipped
        ? { status: 'skipped', skip_reason: r.skipped }
        : { status: 'failed', error: (r.error || 'unknown').slice(0, 500) };
    try { await db.from('tech_sms_log').update(patch).eq('id', logId); } catch { /* best effort */ }
  }
  if (!r.ok) {
    if (r.error) console.error('[tech-notify]', r.error);
    else console.warn('[tech-notify] not sent:', r.skipped);
  }
  return { ...r, logId };
}
