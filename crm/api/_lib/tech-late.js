import { serviceClient } from './supabase.js';
import { sendSMSResult, toE164 } from './sms.js';
import { signToken } from './auth.js';
import { SECRETARY_EXTRA_BUSINESSES } from './staff-access.js';
import { dateIn, exceptionsOn, applyExceptions } from './schedule-exceptions.js';

const MIN = 60 * 1000;

const STAGE1_LEAD_MS = 30 * MIN;
const STAGE3_AFTER_MS = 30 * MIN;
const STAGE4_AFTER_MS = 35 * MIN;
const NUDGE_LINK_TTL_S = 8 * 60 * 60;

const LOOKBACK_MS = 24 * 60 * MIN;
const REASSIGN_GRACE_MS = 30 * MIN;

const NOT_EN_ROUTE_STATUSES = ['pending', 'confirmed', 'assigned'];

const STAFF_PHONE_ENV = {
  'tidyhaus': 'HEATHER_PHONE_NUMBER',
  ...Object.fromEntries((SECRETARY_EXTRA_BUSINESSES['tidyhaus'] || []).map(slug => [slug, 'HEATHER_PHONE_NUMBER'])),
  ...Object.fromEntries((SECRETARY_EXTRA_BUSINESSES.doms || []).map(slug => [slug, 'JOEY_PHONE_NUMBER'])),
};

const STAFF_PHONE_FALLBACK = { JOEY_PHONE_NUMBER: '0000000000', HEATHER_PHONE_NUMBER: '0000000000' };

export function officePhoneFor(slug) {
  const envVar = slug ? STAFF_PHONE_ENV[slug] : null;
  if (!envVar) return null;
  return process.env[envVar] || STAFF_PHONE_FALLBACK[envVar] || null;
}

export async function onDutySecretaryPhones(db, slug) {
  if (slug !== 'doms') return [];
  try {
    const dow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })).getDay();
    const { data: wk } = await db.from('staff_schedules').select('name, phone, priority').in('name', ['Alex', 'Joe']).eq('day_of_week', dow);
    const rows = applyExceptions(wk, await exceptionsOn(db, dateIn('Asia/Manila')), 'doms').filter(r => ['Alex', 'Joe'].includes(r.name));
    const names = [...new Set((rows || []).map(r => r.name))];
    if (!names.length) return [];
    const { data: users } = await db.from('staff_users').select('name, phone').in('name', names).eq('active', true);
    const out = names.map(n => (rows.find(r => r.name === n && r.phone) || (users || []).find(u => u.name === n && u.phone) || {}).phone).filter(Boolean);
    return [...new Set(out.map(p => toE164(p)).filter(Boolean))];
  } catch (e) { console.warn('[tech-late] on-duty secretary lookup failed:', e.message); return []; }
}
async function textOnDuty(db, slug, officePhone, msg, tag) {
  const office = toE164(officePhone || '');
  for (const p of await onDutySecretaryPhones(db, slug)) {
    if (p === office) continue;
    const r = await sendSMSResult(p, msg);
    if (!r.ok) console.warn(`[tech-late] ${tag} on-duty secretary SMS failed:`, r.error || r.skipped);
  }
}

function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || 'Cleaner';
}

function baseUrl() {
  return process.env.PUBLIC_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

async function areaInfoMap(db, ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return {};
  try {
    const { data } = await db.from('service_areas').select('id, timezone, name').in('id', uniq);
    return Object.fromEntries((data || []).map(r => [r.id, { timezone: r.timezone, name: r.name }]));
  } catch { return {}; }
}

function timeInTz(iso, tz) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: tz || 'Asia/Manila', hour: 'numeric', minute: '2-digit',
    });
  } catch { return null; }
}

function mintOtwLink(bookingId, techId) {
  const token = signToken({ kind: 'otw_quick', booking_id: bookingId, tech_id: techId }, NUDGE_LINK_TTL_S);
  return `${baseUrl()}/otw.html?token=${encodeURIComponent(token)}`;
}

export async function checkLateTechs(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = serviceClient();
  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  const horizonISO = new Date(now + STAGE1_LEAD_MS).toISOString();
  const lookbackISO = new Date(now - LOOKBACK_MS).toISOString();

  const { data: bizRows, error: bizErr } = await db.from('businesses').select('id, slug, name, timezone');
  if (bizErr) throw new Error(`businesses query failed: ${bizErr.message}`);
  const bizById = new Map((bizRows || []).map(b => [b.id, b]));

  const { data: rows, error } = await db
    .from('bookings')
    .select(`id, business_id, status, scheduled_at, metadata, on_the_way_at, service_area_id, address_line1, city,
      technician_id, secondary_technician_id,
      technician:technicians!technician_id(name, phone),
      secondary_technician:technicians!secondary_technician_id(name, phone),
      customer:customers(name)`)
    .in('status', NOT_EN_ROUTE_STATUSES)
    .is('on_the_way_at', null)
    .lte('scheduled_at', horizonISO)
    .gte('scheduled_at', lookbackISO);
  if (error) throw new Error(`bookings query failed: ${error.message}`);

  const areaById = await areaInfoMap(db, (rows || []).map(r => r.service_area_id));

  const summary = {
    checked: 0, stage1: 0, stage2: 0, stage3_tech: 0, stage3_staff: 0,
    stage4_tech: 0, stage4_staff: 0, skipped: 0, errors: 0, details: [],
  };

  for (const b of rows || []) {
    if (!b.technician_id && !b.secondary_technician_id) continue;
    summary.checked++;

    const meta = b.metadata || {};

    if (meta.late_reported_at) {
      summary.skipped++;
      summary.details.push({ id: b.id, skip: 'tech self-reported late' });
      continue;
    }

    const biz = bizById.get(b.business_id) || {};
    const slug = biz.slug;
    const customerName = b.customer?.name || 'the customer';
    const areaInfo = areaById[b.service_area_id] || {};
    const tz = areaInfo.timezone || biz.timezone || 'Asia/Manila';
    const city = areaInfo.name || biz.name || 'your area';

    const schedMs = Date.parse(b.scheduled_at);
    if (!Number.isFinite(schedMs)) {
      summary.skipped++;
      summary.details.push({ id: b.id, skip: 'unparseable scheduled_at' });
      continue;
    }
    const msSinceStart = now - schedMs;
    const stage4Due = msSinceStart >= STAGE4_AFTER_MS;
    const stage3Due = !stage4Due && msSinceStart >= STAGE3_AFTER_MS;
    const stage2Due = !stage4Due && !stage3Due && msSinceStart >= 0;
    const stage1Due = !stage4Due && !stage3Due && !stage2Due && msSinceStart >= -STAGE1_LEAD_MS;

    const techsWithPhone = [];
    if (b.technician?.phone) techsWithPhone.push({ id: String(b.technician_id), name: b.technician.name, phone: b.technician.phone });
    if (b.secondary_technician?.phone && b.secondary_technician_id !== b.technician_id) {
      techsWithPhone.push({ id: String(b.secondary_technician_id), name: b.secondary_technician.name, phone: b.secondary_technician.phone });
    }

    const legacyAlready = new Set([
      ...(meta.otw_nudge_sent_ids || []).map(String),
      ...(meta.tech_late_notified_ids || []).map(String),
    ]);
    const stage1Already = new Set([...(meta.stage1_sent_ids || []).map(String), ...legacyAlready]);
    const stage2Already = new Set([...(meta.stage2_sent_ids || []).map(String), ...legacyAlready]);
    const stage3TechAlready = new Set((meta.stage3_tech_sent_ids || []).map(String));
    const stage4TechAlready = new Set((meta.stage4_tech_sent_ids || []).map(String));

    const pendingStage1 = stage1Due ? techsWithPhone.filter(t => !stage1Already.has(t.id)) : [];
    const pendingStage2 = stage2Due ? techsWithPhone.filter(t => !stage2Already.has(t.id)) : [];
    const pendingStage3Tech = stage3Due ? techsWithPhone.filter(t => !stage3TechAlready.has(t.id)) : [];
    const pendingStage4Tech = stage4Due ? techsWithPhone.filter(t => !stage4TechAlready.has(t.id)) : [];

    const stage3StaffAlreadyDone = !!meta.staff_late_notified_at;
    const stage4StaffAlreadyDone = !!meta.stage4_staff_owner_notified_at;

    let officeBlockedBy = null;
    const graceAnchor = meta.reassigned_at && meta.reopened_at
      ? (Date.parse(meta.reassigned_at) > Date.parse(meta.reopened_at) ? meta.reassigned_at : meta.reopened_at)
      : (meta.reassigned_at || meta.reopened_at);
    if (graceAnchor) {
      const anchorMs = Date.parse(graceAnchor);
      if (Number.isFinite(anchorMs) && (now - anchorMs) < REASSIGN_GRACE_MS) {
        officeBlockedBy = 'reassignment/reopen grace period';
      }
    }

    const staffPhone = officePhoneFor(slug);
    if (!officeBlockedBy && !staffPhone) {
      officeBlockedBy = (slug && STAFF_PHONE_ENV[slug])
        ? `${STAFF_PHONE_ENV[slug]} env var not set`
        : `no office number configured for business (${slug || b.business_id})`;
    }

    const willStage3Staff = stage3Due && !stage3StaffAlreadyDone && !officeBlockedBy;
    const willStage4Staff = stage4Due && !stage4StaffAlreadyDone && !officeBlockedBy;

    if (!pendingStage1.length && !pendingStage2.length && !pendingStage3Tech.length
      && !pendingStage4Tech.length && !willStage3Staff && !willStage4Staff) {
      summary.skipped++;
      summary.details.push({ id: b.id, skip: msSinceStart >= -STAGE1_LEAD_MS ? (officeBlockedBy || 'already handled / nothing due') : 'not due yet' });
      continue;
    }

    const whenTxt = timeInTz(b.scheduled_at, tz) || 'scheduled';
    const techNames = techsWithPhone.map(t => firstName(t.name));
    const namesJoined = techNames.length ? techNames.join(' and ') : 'The assigned cleaner';
    const multi = techNames.length > 1;

    const stage3LateMinutes = Math.max(Math.round(STAGE3_AFTER_MS / MIN), Math.round(msSinceStart / MIN));
    const stage4LateMinutes = Math.max(Math.round(STAGE4_AFTER_MS / MIN), Math.round(msSinceStart / MIN));

    const ownerPhoneRaw = process.env.OWNER_PHONE_NUMBER;
    const ccOwner = !!ownerPhoneRaw && !!staffPhone && toE164(ownerPhoneRaw) !== toE164(staffPhone);

    if (dryRun) {
      summary.details.push({
        id: b.id, slug,
        wouldStage1: pendingStage1.map(t => t.name),
        wouldStage2: pendingStage2.map(t => t.name),
        wouldStage3Tech: pendingStage3Tech.map(t => t.name),
        wouldStage3Staff: willStage3Staff ? staffPhone : null,
        wouldStage4Tech: pendingStage4Tech.map(t => t.name),
        wouldStage4StaffOwner: willStage4Staff ? { staff: staffPhone, owner: ccOwner ? ownerPhoneRaw : null } : null,
      });
      if (pendingStage1.length) summary.stage1++;
      if (pendingStage2.length) summary.stage2++;
      if (pendingStage3Tech.length) summary.stage3_tech++;
      if (willStage3Staff) summary.stage3_staff++;
      if (pendingStage4Tech.length) summary.stage4_tech++;
      if (willStage4Staff) summary.stage4_staff++;
      continue;
    }

    try {
      const newly1 = [];
      for (const t of pendingStage1) {
        const link = mintOtwLink(b.id, t.id);
        const where = [b.address_line1, b.city].filter(Boolean).join(', ') || city;
        const msg = `Leave now for ${whenTxt} - ${where}. Tap when you're on the way: ${link}`;
        const r = await sendSMSResult(t.phone, msg);
        if (r.ok) newly1.push(t.id);
        else console.warn(`[tech-late] stage1 SMS failed for booking ${b.id} (tech ${t.id}), will retry next pass:`, r.error || r.skipped);
      }

      const newly2 = [];
      for (const t of pendingStage2) {
        const link = mintOtwLink(b.id, t.id);
        const msg = `Your job in ${city} just started. Tap to let them know you're on the way: ${link}`;
        const r = await sendSMSResult(t.phone, msg);
        if (r.ok) newly2.push(t.id);
        else console.warn(`[tech-late] stage2 SMS failed for booking ${b.id} (tech ${t.id}), will retry next pass:`, r.error || r.skipped);
      }

      const newly3Tech = [];
      for (const t of pendingStage3Tech) {
        const link = mintOtwLink(b.id, t.id);
        const msg = `You are ${stage3LateMinutes} minutes late for your ${whenTxt} job. Reply YES with your ETA. Tap now: ${link}`;
        const r = await sendSMSResult(t.phone, msg);
        if (r.ok) newly3Tech.push(t.id);
        else console.warn(`[tech-late] stage3 tech SMS failed for booking ${b.id} (tech ${t.id}), will retry next pass:`, r.error || r.skipped);
        if (r.ok) try {
          await db.from('tech_sms_log').insert({ kind: 'late', booking_id: b.id, technician_id: t.id, business_id: b.business_id, to_phone: t.phone,
            status: 'sent', sent_at: new Date().toISOString() });
        } catch (e) { console.warn('[tech-late] late log failed:', e.message); }
      }

      let stage3StaffSentThisPass = false;
      if (willStage3Staff) {
        const staffMsg = `Heads up: ${namesJoined} ${multi ? "haven't" : "hasn't"} tapped on-the-way for ${customerName}'s job (${whenTxt}), started ${stage3LateMinutes} min ago.`;
        const staffResult = await sendSMSResult(staffPhone, staffMsg);
        if (!staffResult.ok) console.warn(`[tech-late] stage3 office SMS failed for booking ${b.id}:`, staffResult.error || staffResult.skipped);
        await textOnDuty(db, slug, staffPhone, staffMsg, 'stage3');
        stage3StaffSentThisPass = true;
      }

      const newly4Tech = [];
      for (const t of pendingStage4Tech) {
        const link = mintOtwLink(b.id, t.id);
        const msg = `ATTENTION: You are LATE for your appointment at ${whenTxt} — tap on-the-way for ${customerName}'s job now: ${link}`;
        const r = await sendSMSResult(t.phone, msg);
        if (r.ok) newly4Tech.push(t.id);
        else console.warn(`[tech-late] stage4 tech SMS failed for booking ${b.id} (tech ${t.id}), will retry next pass:`, r.error || r.skipped);
      }

      let stage4StaffSentThisPass = false;
      if (willStage4Staff) {
        const staffMsg = `ATTENTION: ${namesJoined} ${multi ? 'are' : 'is'} ${stage4LateMinutes} minutes late to ${customerName}'s job and still ${multi ? "haven't" : "hasn't"} responded. Please follow up.`;
        const staffResult = await sendSMSResult(staffPhone, staffMsg);
        if (!staffResult.ok) console.warn(`[tech-late] stage4 office SMS failed for booking ${b.id}:`, staffResult.error || staffResult.skipped);
        await textOnDuty(db, slug, staffPhone, staffMsg, 'stage4');
        if (ccOwner) {
          const ownerResult = await sendSMSResult(ownerPhoneRaw, staffMsg);
          if (!ownerResult.ok) console.warn(`[tech-late] stage4 owner SMS failed for booking ${b.id}:`, ownerResult.error || ownerResult.skipped);
        }
        stage4StaffSentThisPass = true;
      }

      const anySent = newly1.length || newly2.length || newly3Tech.length
        || stage3StaffSentThisPass || newly4Tech.length || stage4StaffSentThisPass;

      if (anySent) {
        const { data: freshRow, error: reErr } = await db.from('bookings').select('metadata').eq('id', b.id).maybeSingle();
        if (reErr) console.warn(`[tech-late] re-read before write failed for booking ${b.id}, falling back to pass-start snapshot:`, reErr.message);
        const freshMeta = (!reErr && freshRow && freshRow.metadata) || meta;
        const newMeta = { ...freshMeta };
        if (newly1.length) newMeta.stage1_sent_ids = Array.from(new Set([...(freshMeta.stage1_sent_ids || []).map(String), ...newly1]));
        if (newly2.length) newMeta.stage2_sent_ids = Array.from(new Set([...(freshMeta.stage2_sent_ids || []).map(String), ...newly2]));
        if (newly3Tech.length) newMeta.stage3_tech_sent_ids = Array.from(new Set([...(freshMeta.stage3_tech_sent_ids || []).map(String), ...newly3Tech]));
        if (stage3StaffSentThisPass) newMeta.staff_late_notified_at = nowISO;
        if (newly4Tech.length) newMeta.stage4_tech_sent_ids = Array.from(new Set([...(freshMeta.stage4_tech_sent_ids || []).map(String), ...newly4Tech]));
        if (stage4StaffSentThisPass) {
          newMeta.stage4_staff_owner_notified_at = nowISO;
          if (!newMeta.staff_late_notified_at) newMeta.staff_late_notified_at = nowISO;
        }
        const { error: upErr } = await db.from('bookings').update({ metadata: newMeta }).eq('id', b.id);
        if (upErr) console.warn(`[tech-late] sent but failed to mark booking ${b.id}:`, upErr.message);
      }

      if (newly1.length) summary.stage1++;
      if (newly2.length) summary.stage2++;
      if (newly3Tech.length) summary.stage3_tech++;
      if (stage3StaffSentThisPass) summary.stage3_staff++;
      if (newly4Tech.length) summary.stage4_tech++;
      if (stage4StaffSentThisPass) summary.stage4_staff++;
      summary.details.push({
        id: b.id, slug, stage1: newly1.length, stage2: newly2.length,
        stage3_tech: newly3Tech.length, stage3_staff: stage3StaffSentThisPass,
        stage4_tech: newly4Tech.length, stage4_staff: stage4StaffSentThisPass,
      });
      console.log(`[tech-late] booking=${b.id} slug=${slug} stage1=${newly1.length} stage2=${newly2.length} stage3_tech=${newly3Tech.length} stage3_staff=${stage3StaffSentThisPass} stage4_tech=${newly4Tech.length} stage4_staff=${stage4StaffSentThisPass}`);
    } catch (e) {
      summary.errors++;
      summary.details.push({ id: b.id, error: e.message });
      console.error(`[tech-late] error on booking ${b.id}:`, e.message);
    }
  }

  console.log(`[tech-late] pass complete: checked=${summary.checked} stage1=${summary.stage1} stage2=${summary.stage2} stage3_tech=${summary.stage3_tech} stage3_staff=${summary.stage3_staff} stage4_tech=${summary.stage4_tech} stage4_staff=${summary.stage4_staff} skipped=${summary.skipped} errors=${summary.errors} dryRun=${dryRun}`);
  return summary;
}
