import { serviceClient } from './supabase.js';
import { sendSMSResult } from './sms.js';

const MIN = 60 * 1000;
const WAIT_AFTER_PAID_MS = 15 * MIN;
const LOOKBACK_MS = 24 * 60 * MIN;

const OPEN_STATUSES = ['pending', 'confirmed', 'assigned', 'on_the_way', 'arrived', 'in_progress'];

export async function checkPaidNotComplete(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = serviceClient();
  const now = Date.now();
  const cutoffISO = new Date(now - WAIT_AFTER_PAID_MS).toISOString();
  const lookbackISO = new Date(now - LOOKBACK_MS).toISOString();

  const { data: rows, error } = await db
    .from('bookings')
    .select(`id, status, paid_at, price, metadata,
      technician_id, secondary_technician_id,
      technician:technicians!technician_id(name, phone),
      secondary_technician:technicians!secondary_technician_id(name, phone),
      customer:customers(name)`)
    .in('status', OPEN_STATUSES)
    .eq('payment_status', 'paid')
    .not('paid_at', 'is', null)
    .lte('paid_at', cutoffISO)
    .gte('paid_at', lookbackISO);
  if (error) throw new Error(`bookings query failed: ${error.message}`);

  const summary = { checked: 0, notified: 0, skipped: 0, errors: 0, details: [] };

  for (const b of (rows || [])) {
    summary.checked++;
    const meta = b.metadata || {};
    if (meta.paid_not_complete_notified_at) { summary.skipped++; continue; }

    const techs = [b.technician, b.secondary_technician].filter(t => t && t.phone);
    if (!techs.length) { summary.skipped++; continue; }

    const stamp = new Date().toISOString();
    if (dryRun) {
      summary.details.push({ id: b.id, customer: b.customer?.name, techs: techs.map(t => t.name) });
      continue;
    }

    let anySent = false;
    for (const t of techs) {
      const name = (t.name || '').trim().split(/\s+/)[0] || 'Hey';
      const msg = `${name}, this job is marked paid but not Complete yet${b.customer?.name ? ` (${b.customer.name})` : ''}. Open the cleaner app and tap Complete to close it out.`;
      const r = await sendSMSResult(t.phone, msg);
      if (r.ok) anySent = true;
      else console.warn('[paid_not_complete] SMS failed', b.id, t.name, r.error || r.skipped);
    }

    const { data: fresh } = await db.from('bookings').select('metadata').eq('id', b.id).maybeSingle();
    const mergedMeta = { ...(fresh?.metadata || meta), paid_not_complete_notified_at: stamp };
    const { error: updErr } = await db.from('bookings').update({ metadata: mergedMeta }).eq('id', b.id);
    if (updErr) { summary.errors++; console.error('[paid_not_complete] metadata write failed', b.id, updErr.message); continue; }

    if (anySent) summary.notified++; else summary.errors++;
  }

  return summary;
}
