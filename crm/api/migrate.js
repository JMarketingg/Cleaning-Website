import { serviceClient } from './_lib/supabase.js';
import { runLateReminders } from './_lib/late-payment.js';
import { runScheduledReviewEmails } from './_lib/scheduled-review.js';
import { gadsUploadBookings } from './_lib/gads.js';
import { verifyToken, getBearer, applyCors } from './_lib/auth.js';
import { sendAppointmentReminders } from './_lib/reminders.js';
import { sendDailyBookingDigest } from './_lib/daily-digest.js';
import { checkLateTechs } from './_lib/tech-late.js';
import { runScheduledInvites } from './_lib/invite-schedule.js';
import { checkPaidNotComplete } from './_lib/paid-not-complete.js';
import { checkEstimateFollowups, checkEstimateTextFollowups } from './_lib/estimate-followup.js';
import { autoCloseEstimates } from './_lib/estimate-autoclose.js';
import { checkEstimateEscalations } from './_lib/estimate-escalation.js';
import { runDomainWatch } from './_lib/domain-watch.js';
import { runGbpCountWatch } from './_lib/gbp-count-watch.js';
import { RANK_CITIES, hasKeys, postScans, collectPending } from './_lib/rank-grid.js';
import { sendSMSResult, smsConfigured } from './_lib/sms.js';
import { bookingConfirmMessage } from './_lib/booking-confirm-sms.js';
import { enRouteMessage } from './_lib/en-route.js';
import { reviewRequestSms } from './_lib/review-token.js';
import { isInventoryExempt } from './_lib/bracket-moves.js';
import { plateOrderMove } from './_lib/plate-moves.js';
import { ingestBracketSyncReport, bracketSyncWatchdog } from './_lib/bracket-sync-health.js';
import { isGibberish } from './_lib/lead-guard.js';
import { isBlockedPhone } from './_lib/blocked.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const config = { maxDuration: 60 };

const __dir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dir, '../supabase/migrations');

const REQUIRED_MIGRATIONS = [
  '0014_sms_consent.sql',
];

async function checkSmsConsentColumn() {
  const db = serviceClient();
  try {
    const { data, error } = await db.from('bookings')
      .select('id, sms_consent')
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('sms_consent')) {
        return { exists: false, error: error.message };
      }
      return { exists: 'unknown', error: error.message };
    }

    return { exists: true };
  } catch (e) {
    return { exists: 'unknown', error: e.message };
  }
}

async function applyMigration(filename) {
  const filePath = path.join(migrationsDir, filename);

  if (!fs.existsSync(filePath)) {
    return { error: `Migration file not found: ${filename}` };
  }

  const sql = fs.readFileSync(filePath, 'utf-8');
  const db = serviceClient();

  try {
    const result = await db.rpc('exec_sql', { sql_text: sql });
    return { success: true, result };
  } catch (e) {
    return {
      error: `Could not apply migration via RPC: ${e.message}. Please apply migrations manually via Supabase dashboard or CLI.`,
      helpText: `To apply ${filename}, run: supabase db push`
    };
  }
}

const BRACKET_STATUS_RANK = { in_route: 0, ordered: 0, delivered: 1, canceled: 2, returned: 2 };


const TECH_HOME_ADDRESSES = [
  { num: '5809',  zip: '80128', name: 'steve', slug: 'tidyhaus' },
  { num: '10507', zip: '80022', name: 'tk',    slug: 'doms' },
  { num: '7350',  zip: '77011', name: 'juan',  slug: 'tidyhaus' },
  { num: '3749',  zip: '80205', name: 'kregg', slug: 'tidyhaus' },
  { num: '16113', zip: '78728', name: 'zach',  slug: 'tidyhaus' },
  { num: '9600',  zip: '80231', name: 'greg',  slug: 'doms' },
];

async function matchTechByAddress(db, businesses, address) {
  if (!address) return null;
  const num = (String(address).match(/\b(\d{1,6})\b/) || [])[1];
  const zips = [...String(address).matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].map(m => m[1]);
  const zip = zips.length ? zips[zips.length - 1] : null;
  if (!num || !zip) return null;
  const entry = TECH_HOME_ADDRESSES.find(e => e.num === num && e.zip === zip);
  if (!entry) return null;
  const biz = (businesses || []).find(b => b.slug === entry.slug);
  if (!biz) return null;
  const { data: techs } = await db.from('technicians')
    .select('id, name, business_id').eq('business_id', biz.id).ilike('name', entry.name + '%').limit(1);
  const tech = (techs || [])[0];
  return tech ? { id: tech.id, business_id: tech.business_id, name: tech.name } : null;
}

async function bracketSync(req, res) {
  const body = req.body || {};
  const walmart_order_num = (body.walmart_order_num || '').toString().trim();
  if (!walmart_order_num) return res.status(400).json({ error: 'walmart_order_num required' });

  const flat_qty        = Math.max(0, parseInt(body.flat_qty)        || 0);
  const tilting_qty     = Math.max(0, parseInt(body.tilting_qty)     || 0);
  const full_motion_qty = Math.max(0, parseInt(body.full_motion_qty) || 0);
  const totalQty        = flat_qty + tilting_qty + full_motion_qty;
  const rawStatus       = (body.status || 'in_route').toString();
  const status          = Object.prototype.hasOwnProperty.call(BRACKET_STATUS_RANK, rawStatus) ? rawStatus : 'in_route';
  const order_date      = body.order_date     || null;
  const delivered_date  = body.delivered_date || null;
  const order_url       = body.order_url      || null;

  const db = serviceClient();
  const { data: businesses, error: bizErr } = await db.from('businesses').select('id, slug').eq('active', true);
  if (bizErr) return res.status(500).json({ error: bizErr.message });
  const slugOf = (id) => (businesses || []).find(b => b.id === id)?.slug || id;

  const { data: rows, error: rowsErr } = await db.from('bracket_purchases')
    .select('id, business_id, status, flat_qty, tilting_qty, full_motion_qty, order_url, technician_id')
    .eq('walmart_order_num', walmart_order_num);
  if (rowsErr) return res.status(500).json({ error: rowsErr.message });

  const results = [];
  const upgrades = (fromStatus) => (BRACKET_STATUS_RANK[status] ?? 0) > (BRACKET_STATUS_RANK[fromStatus] ?? 0);
  const statusPatch = () => {
    const p = {};
    if (status === 'delivered' && delivered_date) p.delivered_date = delivered_date;
    p.status = status;
    return p;
  };

  const assignedRow = (rows || []).find(r => r.technician_id);
  const matched = assignedRow ? null : await matchTechByAddress(db, businesses, body.delivery_address);
  if (assignedRow) {
    const patch = {};
    const wasDelivered = assignedRow.status === 'delivered';
    const nowDelivered = status === 'delivered';
    if (upgrades(assignedRow.status)) Object.assign(patch, statusPatch());
    if (order_url && !assignedRow.order_url) patch.order_url = order_url;
    const qtyChanged = totalQty > 0 && (assignedRow.flat_qty !== flat_qty || assignedRow.tilting_qty !== tilting_qty || assignedRow.full_motion_qty !== full_motion_qty);
    if (qtyChanged) { patch.flat_qty = flat_qty; patch.tilting_qty = tilting_qty; patch.full_motion_qty = full_motion_qty; }
    void wasDelivered; void nowDelivered;
    if (Object.keys(patch).length) {
      const { error } = await db.from('bracket_purchases').update(patch).eq('id', assignedRow.id);
      results.push({ business: slugOf(assignedRow.business_id), action: error ? 'update_failed' : 'updated_assigned', patch, error: error?.message });
    } else {
      results.push({ business: slugOf(assignedRow.business_id), action: 'unchanged' });
    }
    for (const r of (rows || [])) {
      if (r.id === assignedRow.id || r.technician_id) continue;
      await db.from('bracket_purchases').delete().eq('id', r.id);
      results.push({ business: slugOf(r.business_id), action: 'twin_removed' });
    }
  } else if (matched) {
    const own = (rows || []).find(r => r.business_id === matched.business_id) || null;
    const patch = { technician_id: matched.id };
    if (order_url) patch.order_url = order_url;
    if (own) {
      if (upgrades(own.status)) Object.assign(patch, statusPatch());
      if (totalQty > 0) { patch.flat_qty = flat_qty; patch.tilting_qty = tilting_qty; patch.full_motion_qty = full_motion_qty; }
      const { error } = await db.from('bracket_purchases').update(patch).eq('id', own.id);
      results.push({ business: slugOf(matched.business_id), action: error ? 'assign_failed' : 'auto_assigned', tech: matched.name, error: error?.message });
    } else if (totalQty === 0) {
      results.push({ business: slugOf(matched.business_id), action: 'skipped', reason: 'no_qty_for_new_order' });
    } else {
      const { error } = await db.from('bracket_purchases').insert({
        business_id: matched.business_id, technician_id: matched.id, walmart_order_num,
        flat_qty, tilting_qty, full_motion_qty, status, order_date, delivered_date, order_url,
      });
      results.push({ business: slugOf(matched.business_id), action: error ? 'assign_insert_failed' : 'auto_assigned_new', tech: matched.name, error: error?.message });
    }
    for (const r of (rows || [])) {
      if (r.business_id === matched.business_id || r.technician_id) continue;
      await db.from('bracket_purchases').delete().eq('id', r.id);
      results.push({ business: slugOf(r.business_id), action: 'twin_removed' });
    }
  } else {
    const byBiz = new Map((rows || []).map(r => [r.business_id, r]));
    for (const biz of (businesses || [])) {
      const existing = byBiz.get(biz.id);
      if (existing) {
        const patch = {};
        if (upgrades(existing.status)) Object.assign(patch, statusPatch());
        if (order_url && !existing.order_url) patch.order_url = order_url;
        if (totalQty > 0) {
          if (existing.flat_qty        !== flat_qty)        patch.flat_qty        = flat_qty;
          if (existing.tilting_qty     !== tilting_qty)     patch.tilting_qty     = tilting_qty;
          if (existing.full_motion_qty !== full_motion_qty) patch.full_motion_qty = full_motion_qty;
        }
        if (Object.keys(patch).length === 0) { results.push({ business: biz.slug, action: 'unchanged' }); continue; }
        const { error } = await db.from('bracket_purchases').update(patch).eq('id', existing.id);
        results.push({ business: biz.slug, action: error ? 'update_failed' : 'updated', patch, error: error?.message });
      } else {
        if (totalQty === 0) { results.push({ business: biz.slug, action: 'skipped', reason: 'no_qty_for_new_order' }); continue; }
        const { error } = await db.from('bracket_purchases').insert({
          business_id: biz.id, technician_id: null, walmart_order_num,
          flat_qty, tilting_qty, full_motion_qty, status, order_date, delivered_date, order_url,
        });
        results.push({ business: biz.slug, action: error ? 'insert_failed' : 'created', error: error?.message });
      }
    }
  }

  if (body.order_total != null && isFinite(Number(body.order_total))) {
    try {
      await db.from('bracket_purchases')
        .update({ order_total: Math.round(Number(body.order_total) * 100) / 100 })
        .eq('walmart_order_num', walmart_order_num).is('order_total', null);
    } catch (e) { /* order_total column not present yet — ignore */ }
  }

  if (body.estimated_delivery && /^\d{4}-\d{2}-\d{2}$/.test(String(body.estimated_delivery))) {
    try {
      await db.from('bracket_purchases')
        .update({ estimated_delivery: body.estimated_delivery })
        .eq('walmart_order_num', walmart_order_num).is('estimated_delivery', null);
    } catch (e) { /* estimated_delivery column not present yet — ignore */ }
  }

  console.log('[bracket_sync]', walmart_order_num, results.map(r => `${r.business}:${r.action}`).join(', '));
  return res.status(200).json({ ok: true, order: walmart_order_num, results });
}

const PLATES_PER_UNIT = parseInt(process.env.PLATES_PER_UNIT) || 5;

async function adjustWirePlateInv(db, businessId, technicianId, delta, orderNum, purchaseId, reason) {
  if (!delta || !technicianId) return;
  await plateOrderMove(db, { businessId, technicianId, delta, orderNum, platePurchaseId: purchaseId, reason, actor: 'amazon-sync' });
}

async function websiteLeadSync(req, res) {
  const db = serviceClient();
  const b = req.body || {};
  const external_key = (b.external_key || '').toString().trim() || null;
  const message = (b.message || '').toString().trim();
  if (!message) return res.status(400).json({ error: 'message required' });

  const { data: biz } = await db.from('businesses').select('id, name').eq('slug', 'doms').single();
  if (!biz) return res.status(500).json({ error: 'doms business not configured' });

  if (external_key) {
    const { data: dupe } = await db.from('estimates')
      .select('id').eq('external_key', external_key).maybeSingle();
    if (dupe) return res.status(200).json({ ok: true, action: 'already_synced', id: dupe.id });
    const { data: gone } = await db.from('deleted_lead_keys')
      .select('external_key').eq('external_key', external_key).maybeSingle();
    if (gone) return res.status(200).json({ ok: true, action: 'deleted_by_office' });
  }
  if (isGibberish(b.name) || isGibberish(message)) {
    console.warn('[website_lead] skipped: gibberish', { name: String(b.name || '').slice(0, 80) });
    return res.status(200).json({ ok: true, action: 'spam_skipped' });
  }
  if (b.phone && await isBlockedPhone(b.phone)) return res.status(200).json({ ok: true, action: 'blocked_number' });

  const name = (b.name || '').toString().trim().slice(0, 120) || 'Website visitor';
  const phone = (b.phone || '').toString().trim() || null;
  const email = (b.email || '').toString().trim() || null;
  const zip = (b.zip || '').toString().trim() || null;
  const notes = b.analytics_id ? `Website form · ${b.analytics_id}` : 'Website form';

  const row = {
    business_id: biz.id,
    service_label: 'Website message',
    customer_name: name, customer_phone: phone, customer_email: email, customer_zip: zip,
    description: message.slice(0, 4000),
    notes,
    source: 'website_form',
    external_key,
    status: 'unsent',
    line_items: [], preferred_slots: [],
    sms_consent: !!phone,
  };
  if (b.received_at) { const d = new Date(b.received_at); if (!isNaN(d)) row.created_at = d.toISOString(); }

  let ins = await db.from('estimates').insert(row).select('id').single();
  if (ins.error && /column .*(external_key|source)/i.test(ins.error.message || '')) {
    const { external_key: _drop, ...safe } = row;
    ins = await db.from('estimates').insert(safe).select('id').single();
  }
  if (ins.error) {
    if (/duplicate key|unique constraint/i.test(ins.error.message || ''))
      return res.status(200).json({ ok: true, action: 'already_synced' });
    throw ins.error;
  }

  const base = (process.env.PUBLIC_URL || 'https://tidyhaus-crm.vercel.app').replace(/\/$/, '');
  const link = `${base}/admin.html?estimate=${encodeURIComponent(ins.data.id)}`;
  const gist = message.replace(/\s+/g, ' ').trim();
  const FRESH_MS = 24 * 60 * 60 * 1000;
  const leadAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const isFresh = Number.isFinite(leadAt) && (Date.now() - leadAt) < FRESH_MS;

  if (!isFresh) console.log('[website_lead] backfilled (older than 24h) — filed without texting');
  void link; void gist;

  console.log('[website_lead]', ins.data.id, name, zip || '');
  return res.status(200).json({ ok: true, action: 'created', id: ins.data.id });
}

async function wirePlateSync(req, res) {
  const body = req.body || {};
  const amazon_order_num = (body.amazon_order_num || '').toString().trim();
  if (!amazon_order_num) return res.status(400).json({ error: 'amazon_order_num required' });

  const units          = Math.max(0, parseInt(body.units) || 0);
  const plates         = units > 0 ? units * PLATES_PER_UNIT : Math.max(0, parseInt(body.plates) || 0);
  const rawStatus      = (body.status || 'in_route').toString();
  const status         = Object.prototype.hasOwnProperty.call(BRACKET_STATUS_RANK, rawStatus) ? rawStatus : 'in_route';
  const order_date     = body.order_date     || null;
  const delivered_date = body.delivered_date || null;
  const order_url      = body.order_url      || null;

  const db = serviceClient();

  const { data: ignored, error: ignoredErr } = await db.from('wire_plate_ignored_orders')
    .select('amazon_order_num').eq('amazon_order_num', amazon_order_num).maybeSingle();
  if (!ignoredErr && ignored) {
    return res.status(200).json({ ok: true, order: amazon_order_num, results: [{ action: 'ignored', reason: 'previously dismissed by owner' }] });
  }

  const { data: businesses, error: bizErr } = await db.from('businesses').select('id, slug').eq('active', true);
  if (bizErr) return res.status(500).json({ error: bizErr.message });
  const slugOf = (id) => (businesses || []).find(b => b.id === id)?.slug || id;

  let hasCredited = true;
  let { data: rows, error: rowsErr } = await db.from('wire_plate_purchases')
    .select('id, business_id, status, units, plates, order_url, technician_id, credited')
    .eq('amazon_order_num', amazon_order_num);
  if (rowsErr && /credited/.test(rowsErr.message || '')) {
    hasCredited = false;
    ({ data: rows, error: rowsErr } = await db.from('wire_plate_purchases')
      .select('id, business_id, status, units, plates, order_url, technician_id')
      .eq('amazon_order_num', amazon_order_num));
  }
  if (rowsErr) return res.status(500).json({ error: rowsErr.message });

  const results = [];

  const assignedRow = (rows || []).find(r => r.technician_id);
  if (assignedRow) {
    const patch = {};
    const wasCredited = !!assignedRow.credited;
    if (!wasCredited && assignedRow.status !== status) {
      patch.status = status;
      patch.delivered_date = status === 'delivered' ? (delivered_date || null) : null;
    }
    if (order_url && !assignedRow.order_url) patch.order_url = order_url;
    if (plates > 0 && assignedRow.plates !== plates) { patch.units = units; patch.plates = plates; }

    const effStatus = patch.status || assignedRow.status;
    const effPlates = (patch.plates != null) ? patch.plates : (assignedRow.plates || 0);

    if (hasCredited && !wasCredited && effStatus === 'delivered') {
      await adjustWirePlateInv(db, assignedRow.business_id, assignedRow.technician_id, effPlates, amazon_order_num, assignedRow.id, 'Amazon plate delivery');
      patch.credited = true;
    } else if (hasCredited && wasCredited && effStatus === 'canceled') {
      await adjustWirePlateInv(db, assignedRow.business_id, assignedRow.technician_id, -(assignedRow.plates || 0), amazon_order_num, assignedRow.id, 'Amazon plate order canceled');
      patch.credited = false;
    } else if (hasCredited && wasCredited && patch.plates != null) {
      await adjustWirePlateInv(db, assignedRow.business_id, assignedRow.technician_id, effPlates - (assignedRow.plates || 0), amazon_order_num, assignedRow.id, 'Amazon plate qty corrected');
    }

    if (Object.keys(patch).length) {
      const { error } = await db.from('wire_plate_purchases').update(patch).eq('id', assignedRow.id);
      results.push({ business: slugOf(assignedRow.business_id), action: error ? 'update_failed' : 'updated_assigned', error: error?.message });
    } else {
      results.push({ business: slugOf(assignedRow.business_id), action: 'unchanged' });
    }
    for (const r of (rows || [])) {
      if (r.id === assignedRow.id || r.technician_id) continue;
      await db.from('wire_plate_purchases').delete().eq('id', r.id);
      results.push({ business: slugOf(r.business_id), action: 'twin_removed' });
    }
  } else {
    const byBiz = new Map((rows || []).map(r => [r.business_id, r]));
    for (const biz of (businesses || [])) {
      const existing = byBiz.get(biz.id);
      if (existing) {
        const patch = {};
        if (existing.status !== status) {
          patch.status = status;
          patch.delivered_date = status === 'delivered' ? (delivered_date || null) : null;
        }
        if (order_url && !existing.order_url) patch.order_url = order_url;
        if (plates > 0) { if (existing.units !== units) patch.units = units; if (existing.plates !== plates) patch.plates = plates; }
        if (Object.keys(patch).length === 0) { results.push({ business: biz.slug, action: 'unchanged' }); continue; }
        const { error } = await db.from('wire_plate_purchases').update(patch).eq('id', existing.id);
        results.push({ business: biz.slug, action: error ? 'update_failed' : 'updated', error: error?.message });
      } else {
        if (plates === 0) { results.push({ business: biz.slug, action: 'skipped', reason: 'no_qty_for_new_order' }); continue; }
        const { error } = await db.from('wire_plate_purchases').insert({
          business_id: biz.id, technician_id: null, amazon_order_num,
          units, plates, status, order_date, delivered_date, order_url,
        });
        results.push({ business: biz.slug, action: error ? 'insert_failed' : 'created', error: error?.message });
      }
    }
  }

  console.log('[wire_plate_sync]', amazon_order_num, results.map(r => `${r.business}:${r.action}`).join(', '));
  return res.status(200).json({ ok: true, order: amazon_order_num, results });
}

async function wirePlatePurge(req, res) {
  const body = req.body || {};
  let nums = body.order_nums;
  if (typeof nums === 'string') nums = nums.split(',');
  nums = (Array.isArray(nums) ? nums : []).map(s => String(s || '').trim()).filter(Boolean);
  if (!nums.length) return res.status(400).json({ error: 'order_nums required (array or comma-separated string)' });

  const db = serviceClient();

  let hasCredited = true;
  const sel = (withC) => db.from('wire_plate_purchases')
    .select(`id, business_id, technician_id, plates, amazon_order_num${withC ? ', credited' : ''}`)
    .in('amazon_order_num', nums);
  let { data: rows, error } = await sel(true);
  if (error && /credited/.test(error.message || '')) { hasCredited = false; ({ data: rows, error } = await sel(false)); }
  if (error) return res.status(500).json({ error: String(error.message || error) });
  rows = rows || [];

  const results = [];
  for (const r of rows) {
    if (hasCredited && r.credited && r.technician_id && (r.plates || 0) > 0) {
      await adjustWirePlateInv(db, r.business_id, r.technician_id, -(r.plates || 0), r.amazon_order_num, r.id, 'Amazon plate order purged');
    }
    const { error: delErr } = await db.from('wire_plate_purchases').delete().eq('id', r.id);
    results.push({ order: r.amazon_order_num, action: delErr ? 'delete_failed' : 'deleted', error: delErr?.message });
  }
  for (const n of nums) {
    const { error: ignoreErr } = await db.from('wire_plate_ignored_orders')
      .upsert({ amazon_order_num: n }, { onConflict: 'amazon_order_num' });
    if (ignoreErr) console.warn('[wire_plate_purge] failed to record ignore for', n, ignoreErr.message);
  }

  console.log('[wire_plate_purge]', nums.join(','), `removed ${results.filter(r => r.action === 'deleted').length}/${rows.length}`);
  return res.status(200).json({ ok: true, requested: nums, found: rows.length, removed: results.filter(r => r.action === 'deleted').length, results });
}

async function seedZip(req, res) {
  const body = req.body || {};
  const zip = String(body.zip || '').trim();
  const area = String(body.area || '').trim();
  const surcharge = Number(body.surcharge) || 0;
  const payout = Number(body.payout) || 0;
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'zip must be exactly 5 digits' });
  if (!area) return res.status(400).json({ error: 'area (metro name, e.g. "Manila") required' });

  const db = serviceClient();
  const { data: areas, error: aErr } = await db.from('service_areas')
    .select('id, business_id, name, business:businesses ( slug, active )')
    .eq('name', area);
  if (aErr) return res.status(500).json({ error: aErr.message });
  const targets = (areas || []).filter(a => a.business && a.business.active !== false);
  if (!targets.length) return res.status(404).json({ error: `No active business has a service area named "${area}"` });

  const results = [];
  for (const a of targets) {
    const { error } = await db.from('service_area_zips').upsert(
      { business_id: a.business_id, service_area_id: a.id, postal_code: zip, surcharge, tech_payout: payout },
      { onConflict: 'business_id,postal_code' }
    );
    results.push({ slug: a.business.slug, area, action: error ? 'failed' : 'upserted', error: error && error.message });
  }
  console.log('[seed_zip]', zip, area, `${surcharge}/${payout}`, results.map(r => `${r.slug}:${r.action}`).join(', '));
  return res.status(200).json({ ok: true, zip, area, surcharge, payout, results });
}

async function matchTechByReviewer(db, bizId, reviewerName) {
  const out = { technician_id: null, booking_id: null };
  const tokens = String(reviewerName || '').toLowerCase().split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (!last || last.length < 3) return out;
  const sinceISO = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: rows } = await db.from('bookings')
    .select('id, technician_id, scheduled_at, customer:customers ( name )')
    .eq('business_id', bizId).eq('status', 'completed')
    .not('technician_id', 'is', null)
    .gte('scheduled_at', sinceISO)
    .order('scheduled_at', { ascending: false }).limit(200);
  for (const b of (rows || [])) {
    const ct = String(b.customer?.name || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (ct.length && ct[ct.length - 1] === last) {
      return { technician_id: b.technician_id, booking_id: b.id };
    }
  }
  return out;
}

async function googleReviewSync(req, res) {
  const body = req.body || {};
  const slug = (body.business || '').toString().trim();
  const google_key = (body.google_key || '').toString().trim();
  const reviewer_name = (body.reviewer_name || '').toString().trim() || null;
  const rating = Math.max(1, Math.min(5, parseInt(body.rating) || 0)) || null;
  const review_text = (body.review_text || '').toString().trim() || null;
  const review_date = body.review_date || null;
  const location_key = (body.location_key || '').toString().trim() || null;
  const location_cid = (body.location_cid || '').toString().trim() || null;
  const gbp_display_name = (body.gbp_display_name || '').toString().trim() || null;
  const source_mailbox = (body.source_mailbox || '').toString().trim() || null;
  if (!slug || !google_key || !rating) return res.status(400).json({ error: 'business, google_key, rating required' });

  const db = serviceClient();
  const { data: biz } = await db.from('businesses').select('id, slug').eq('slug', slug).eq('active', true).maybeSingle();
  if (!biz) return res.status(404).json({ error: `Unknown business "${slug}"` });

  const { data: existing } = await db.from('google_reviews')
    .select('id, location_key').eq('business_id', biz.id).eq('google_key', google_key).maybeSingle();
  if (existing) {
    if (location_key && !existing.location_key) {
      const { error: upErr } = await db.from('google_reviews')
        .update({ location_key, location_cid, gbp_display_name, source_mailbox })
        .eq('id', existing.id);
      if (upErr) return res.status(500).json({ error: upErr.message });
      console.log('[google_review_sync] attributed', slug, reviewer_name, '→', location_key);
      return res.status(200).json({ ok: true, action: 'attributed', id: existing.id, location_key });
    }
    return res.status(200).json({ ok: true, action: 'exists', id: existing.id, location_key: existing.location_key });
  }

  const { technician_id, booking_id } = await matchTechByReviewer(db, biz.id, reviewer_name);

  const { data: ins, error } = await db.from('google_reviews').insert({
    business_id: biz.id, reviewer_name, rating, review_text, review_date,
    google_key, technician_id, booking_id, seen: false,
    location_key, location_cid, gbp_display_name, source_mailbox,
  }).select('id').maybeSingle();
  if (error) {
    if (/duplicate key|unique/i.test(error.message || '')) return res.status(200).json({ ok: true, action: 'exists' });
    return res.status(500).json({ error: error.message });
  }
  console.log('[google_review_sync]', slug, reviewer_name, `${rating}★`, location_key || 'UNATTRIBUTED', technician_id ? 'matched-tech' : 'no-match');

  if (technician_id) {
    const { data: tech } = await db.from('technicians').select('name, phone').eq('id', technician_id).maybeSingle();
    if (tech?.phone) {
      const msg = rating === 5
        ? `${tech.name || 'Hey'}, you just got a ${rating}★ Google review${reviewer_name ? ` from ${reviewer_name}` : ''}! Nice work.`
        : `${tech.name || 'Hey'}, a ${rating}★ Google review came in${reviewer_name ? ` from ${reviewer_name}` : ''}. Check your profile to view it.`;
      sendSMSResult(tech.phone, msg).catch(err => console.warn('[google_review_sync] tech SMS failed:', err.message));
    }
  }
  return res.status(200).json({ ok: true, action: 'created', id: ins?.id, matched: !!technician_id });
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = (req.query.action || '').toString();


  if (action === 'th_daily') {
    const secret = process.env.CRON_SECRET;
    const provided = (req.query.secret || '').toString() || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!secret || provided !== secret) return res.status(401).json({ error: 'Unauthorized' });
    const { sendTomorrowReminders, extendSeries } = await import('./_lib/th-daily.js');
    const db = serviceClient();
    const out = {};
    try { Object.assign(out, await extendSeries(db)); } catch (e) { out.series_error = e.message; }
    try { Object.assign(out, await sendTomorrowReminders(db)); } catch (e) { out.reminder_error = e.message; }
    return res.status(200).json({ ok: true, ...out });
  }

  if (action === 'send_reminders') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const summary = await sendAppointmentReminders({ dryRun });
      return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
      console.error('[send_reminders]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'tech_tomorrow_digest') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const { sendTomorrowDigest } = await import('./_lib/tech-calendar.js');
      return res.status(200).json({ ok: true, ...(await sendTomorrowDigest(serviceClient(), { dryRun: req.query.dry === '1' })) });
    } catch (e) {
      console.error('[tech_tomorrow_digest]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'tech_late_check') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const summary = await checkLateTechs({ dryRun });
      let invites = null;
      try { invites = await runScheduledInvites(serviceClient(), { dryRun }); }
      catch (e) { console.error('[scheduled_invites]', (e && e.stack) || e); invites = { error: String((e && e.message) || e) }; }
      let texts = null;
      try { texts = await runScheduledTexts(serviceClient(), { dryRun }); }
      catch (e) { console.error('[scheduled_texts]', (e && e.stack) || e); texts = { error: String((e && e.message) || e) }; }
      let reminders = null;
      try { const { runTechReminders } = await import('./_lib/tech-reminders.js'); reminders = await runTechReminders(serviceClient(), { dryRun }); }
      catch (e) { console.error('[tech_reminders]', (e && e.stack) || e); reminders = { error: String((e && e.message) || e) }; }
      let pay_reminders = null;
      try { const { runPayReminders } = await import('./_lib/late-payment.js'); pay_reminders = await runPayReminders(serviceClient(), { dryRun }); }
      catch (e) { console.error('[pay_reminders]', (e && e.stack) || e); pay_reminders = { error: String((e && e.message) || e) }; }
      return res.status(200).json({ ok: true, ...summary, invites, texts, reminders, pay_reminders });
    } catch (e) {
      console.error('[tech_late_check]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'paid_not_complete_check') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const summary = await checkPaidNotComplete({ dryRun });
      return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
      console.error('[paid_not_complete_check]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'estimate_followup_check') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const summary = await checkEstimateFollowups({ dryRun });
      try { summary.autoclose = await autoCloseEstimates({ dryRun }); } catch (e) { console.error('[estimate_autoclose]', e); summary.autoclose = { error: e.message }; }
      try { summary.texts = await checkEstimateTextFollowups({ dryRun }); } catch (e) { console.error('[estimate_text_followups]', e); summary.texts = { error: e.message }; }
      if (!dryRun) { try { summary.scheduled_review_emails = await runScheduledReviewEmails(serviceClient()); } catch (e) { console.error('[scheduled_review_emails]', e); } }
      if (!dryRun) { try { summary.gads_booking_uploads = await gadsUploadBookings(serviceClient()); } catch (e) { console.error('[gads_booking_uploads]', e); } }
      return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
      console.error('[estimate_followup_check]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'estimate_escalation_check') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const summary = await checkEstimateEscalations({ dryRun });
      return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
      console.error('[estimate_escalation_check]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'daily_digest') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const force = req.query.force === '1' || req.query.force === 'true';
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const offset = (req.query.offset != null && req.query.offset !== '')
        ? parseInt(req.query.offset, 10) : null;
      const out = await sendDailyBookingDigest({ force, dryRun, offset });
      return res.status(200).json({ ok: true, ...out });
    } catch (e) {
      console.error('[daily_digest]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'bracket_sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      return await bracketSync(req, res);
    } catch (e) {
      console.error('[bracket_sync]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'website_lead_sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      return await websiteLeadSync(req, res);
    } catch (e) {
      console.error('[website_lead]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'wire_plate_sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      return await wirePlateSync(req, res);
    } catch (e) {
      console.error('[wire_plate_sync]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'wire_plate_purge') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      return await wirePlatePurge(req, res);
    } catch (e) {
      console.error('[wire_plate_purge]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'seed_zip') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      return await seedZip(req, res);
    } catch (e) {
      console.error('[seed_zip]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'google_review_sync') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      return await googleReviewSync(req, res);
    } catch (e) {
      console.error('[google_review_sync]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'bracket_sync_health') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const out = await ingestBracketSyncReport(serviceClient(), req.body, new Date());
      console.log('[bracket_sync_health]', JSON.stringify(out));
      return res.status(200).json({ ok: true, ...out });
    } catch (e) {
      const bad = e && e.code === 'BAD_REPORT';
      console.error('[bracket_sync_health]', (e && e.stack) || e);
      return res.status(bad ? 400 : 500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'bracket_sync_watchdog') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dry = req.query.dry === '1' || req.query.dry === 'true';
      const out = await bracketSyncWatchdog(serviceClient(), { now: new Date(), dry });
      console.log('[bracket_sync_watchdog]', JSON.stringify(out));
      return res.status(200).json({ ok: true, ...out });
    } catch (e) {
      console.error('[bracket_sync_watchdog]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'photo_logo_scan') return res.status(410).json({ error: 'Removed' });
  if (action === 'photo_logo_scan_removed') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';
      const summary = { dryRun };
      return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
      console.error('[photo_logo_scan]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'late_payment_reminders') {
    const secret = process.env.CRON_SECRET;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!secret || bearer !== secret) return res.status(401).json({ error: 'Unauthorized' });
    try { return res.status(200).json({ ok: true, results: await runLateReminders(serviceClient()) }); }
    catch (e) { console.error('[late_payment_reminders]', (e && e.stack) || e); return res.status(500).json({ error: String((e && e.message) || e) }); }
  }
  if (action === 'rank_weekly') {
    const secret = process.env.CRON_SECRET;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!secret || bearer !== secret) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const db = serviceClient();
      if (!hasKeys()) return res.status(200).json({ ok: true, skip: 'no keys' });
      const { data: st } = await db.from('rank_settings').select('weekly_enabled').eq('id', 1).maybeSingle();
      const now = new Date(); let posted = 0, errors = [];
      if (st?.weekly_enabled && now.getUTCDay() === 1 && now.getUTCHours() >= 14) {
        const since = new Date(Date.now() - 6 * 864e5).toISOString();
        const { data: recent } = await db.from('rank_scans').select('city, status, run_at').eq('dry', false).gte('run_at', since);
        const ran = new Set((recent || []).filter((x) => x.status !== 'error' || Date.parse(x.run_at) > Date.now() - 2 * 3600e3).map((x) => x.city));
        const due = RANK_CITIES.map((c) => c.city).filter((c) => !ran.has(c));
        if (due.length) { const made = await postScans(db, due); posted = made.length; errors = made.errors || []; }
      }
      const { count: open } = await db.from('rank_points').select('id', { count: 'exact', head: true }).is('done_at', null).not('task_id', 'is', null);
      const collected = open ? await collectPending(db, posted ? 30000 : 40000) : { collected: 0, pending: 0 };
      return res.status(200).json({ ok: true, posted, collected, ...(errors.length ? { errors } : {}) });
    } catch (e) { console.error('[rank_weekly]', (e && e.stack) || e); return res.status(500).json({ error: String((e && e.message) || e) }); }
  }
  if (action === 'gbp_count_watch') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized' });
    try { return res.status(200).json({ ok: true, ...(await runGbpCountWatch(serviceClient())) }); }
    catch (e) { console.error('[gbp_count_watch]', (e && e.stack) || e); return res.status(500).json({ error: String((e && e.message) || e) }); }
  }

  if (action === 'domain_watch_check') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const dry = req.query.dry === '1' || req.query.dry === 'true';
      const summary = await runDomainWatch(serviceClient(), { sendAlerts: !dry });
      return res.status(200).json({ ok: true, ...summary });
    } catch (e) {
      console.error('[domain_watch_check]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'sms_test') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const phone = (req.body && req.body.phone || '').toString().trim();
      if (!phone) return res.status(400).json({ error: 'phone required' });
      if (!smsConfigured()) return res.status(400).json({ error: 'No SMS provider configured (Twilio env vars missing).' });

      const templates = [
        { label: 'Customer · booking confirmed',
          text: bookingConfirmMessage({ bizName: 'TidyHaus', bizSlug: 'tidyhaus', dateStr: 'Wed, Jul 8', timeWindow: '12pm - 3pm', techName: 'Zach' }) },
        { label: "Customer · tech's on the way",
          text: enRouteMessage('Zach', 'TidyHaus', 15, 'tidyhaus') },
        { label: 'Customer · review request',
          text: reviewRequestSms({ slug: 'tidyhaus', name: 'TidyHaus', token: 'demo', clickUrl: 'https://tidyhaus-crm.vercel.app/api/book?action=review_click&token=demo&ch=sms' }) },
        { label: 'Cleaner · new job assigned',
          text: 'You got a job! Wed, Jul 8, 2:00 PM. Address & details in the app: https://tidyhaus-crm.vercel.app/tech.html' },
        { label: 'Cleaner · job canceled',
          text: "❌ Job canceled: Wed, Jul 8 2:00 PM (Jane Doe). No action needed — your calendar's updated." },
      ];

      const results = [];
      for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        const r = await sendSMSResult(phone, `(${i + 1}/${templates.length} · ${t.label})\n${t.text}`);
        results.push({ label: t.label, ok: !!r.ok, error: r.error || r.skipped || null });
      }
      const sent = results.filter(r => r.ok).length;
      console.log('[sms_test]', phone.slice(-4), `${sent}/${templates.length} sent`);
      return res.status(200).json({ ok: sent === templates.length, sent, total: templates.length, results });
    } catch (e) {
      console.error('[sms_test]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  if (action === 'release_tracking_number') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(400).json({ error: 'CRON_SECRET env var not set. Add it in Vercel first.' });
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = (req.query.secret || '').toString() || bearer;
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized. Pass ?secret=CRON_SECRET or Authorization: Bearer.' });
    try {
      const phone = ((req.body && req.body.phone) || '').toString().replace(/\D/g, '').slice(-10);
      if (phone.length !== 10) return res.status(400).json({ error: 'phone (10 digits) required' });
      const dryRun = req.query.dry === '1' || req.query.dry === 'true';

      const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
      if (!sid || !tok) return res.status(503).json({ error: 'Twilio env vars not configured on this deployment.' });
      const auth = 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64');

      const lookupUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=%2B1${phone}`;
      const lookupRes = await fetch(lookupUrl, { headers: { Authorization: auth } });
      const lookupJson = await lookupRes.json().catch(() => ({}));
      if (!lookupRes.ok) return res.status(502).json({ error: `Twilio lookup failed: ${lookupJson.message || lookupRes.status}` });
      const numbers = lookupJson.incoming_phone_numbers || [];
      if (!numbers.length) return res.status(404).json({ error: `Twilio has no number matching +1${phone} -- nothing to release.` });
      const twilioNumber = numbers[0];

      if (dryRun) {
        return res.status(200).json({ ok: true, dryRun: true, would_release: { sid: twilioNumber.sid, phone_number: twilioNumber.phone_number, friendly_name: twilioNumber.friendly_name } });
      }

      const releaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${twilioNumber.sid}.json`;
      const releaseRes = await fetch(releaseUrl, { method: 'DELETE', headers: { Authorization: auth } });
      if (releaseRes.status !== 204 && !releaseRes.ok) {
        const releaseJson = await releaseRes.json().catch(() => ({}));
        return res.status(502).json({ error: `Twilio release failed: ${releaseJson.message || releaseRes.status}` });
      }

      const db = serviceClient();
      const { error: dbErr } = await db.from('tracking_numbers')
        .update({ active: false, display_name: null, label: '[retired ' + new Date().toISOString().slice(0, 10) + '] released from Twilio -- was never the real number' })
        .eq('phone', phone);
      if (dbErr) console.error('[release_tracking_number] DB update failed (Twilio release already succeeded):', dbErr.message);

      console.log('[release_tracking_number] released', twilioNumber.sid, twilioNumber.phone_number);
      return res.status(200).json({ ok: true, released: { sid: twilioNumber.sid, phone_number: twilioNumber.phone_number }, db_updated: !dbErr });
    } catch (e) {
      console.error('[release_tracking_number]', (e && e.stack) || e);
      return res.status(500).json({ error: String((e && e.message) || e) });
    }
  }

  const auth = verifyToken(getBearer(req));

  if (!auth || auth.kind !== 'admin') {
    return res.status(401).json({ error: 'Admin authorization required' });
  }

  try {
    if (action === 'status') {
      const smsColumn = await checkSmsConsentColumn();
      return res.json({
        sms_consent_column: smsColumn,
        migrations: REQUIRED_MIGRATIONS,
      });
    }

    if (action === 'apply') {
      const migration = (req.query.migration || '').toString();
      if (!migration) {
        return res.status(400).json({ error: 'migration parameter required' });
      }
      const result = await applyMigration(migration);
      return res.json(result);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[migrate]', e);
    return res.status(500).json({ error: e.message });
  }
}

async function runScheduledTexts(db, { dryRun } = {}) {
  const now = new Date();
  const { data: due, error } = await db.from('scheduled_texts').select('id, to_phone, body, send_at')
    .is('sent_at', null).is('error', null).lte('send_at', now.toISOString())
    .gte('send_at', new Date(now.getTime() - 2 * 3600000).toISOString()).limit(20);
  if (error) throw error;
  if (dryRun) return { due: (due || []).length };
  let sent = 0;
  for (const t of due || []) {
    const { data: claimed } = await db.from('scheduled_texts').update({ sent_at: now.toISOString() }).eq('id', t.id).is('sent_at', null).select('id').maybeSingle();
    if (!claimed) continue;
    const r = await sendSMSResult(t.to_phone, t.body);
    if (r && r.ok) sent++;
    else await db.from('scheduled_texts').update({ error: String((r && (r.error || r.skipped)) || 'failed').slice(0, 300) }).eq('id', t.id);
  }
  return { due: (due || []).length, sent };
}
