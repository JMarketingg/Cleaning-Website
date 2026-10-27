import { serviceClient } from './supabase.js';

const DAY = 86400000;
export const EXPIRE_UNSENT_MS = 7 * DAY;
export const LOSE_SENT_MS = 3 * DAY;

export async function autoCloseEstimates(opts = {}) {
  const dryRun = !!opts.dryRun;
  const db = opts.db || serviceClient();
  const now = Date.now();
  const stamp = new Date(now).toISOString().slice(0, 10);
  const out = { expired: 0, lost: 0 };

  const { data: un, error: uErr } = await db.from('estimates').select('id')
    .eq('status', 'unsent').is('deleted_at', null).is('approved_at', null)
    .lt('created_at', new Date(now - EXPIRE_UNSENT_MS).toISOString()).limit(500);
  if (uErr) throw new Error(`unsent query failed: ${uErr.message}`);
  const unIds = (un || []).map((r) => r.id);
  if (unIds.length && !dryRun) {
    const { error } = await db.from('estimates').update({ status: 'expired', closed_reason: 'Never sent' })
      .in('id', unIds).eq('status', 'unsent');
    if (error) throw new Error(`expire failed: ${error.message}`);
  }
  out.expired = unIds.length;

  const { data: se, error: sErr } = await db.from('estimates').select('id, created_at, contacted_at, texted_at, emailed_at, notes')
    .eq('status', 'sent').is('deleted_at', null).is('approved_at', null)
    .lt('created_at', new Date(now - LOSE_SENT_MS).toISOString()).limit(500);
  if (sErr) throw new Error(`sent query failed: ${sErr.message}`);
  const ms = (t) => (t ? Date.parse(t) : 0) || 0;
  const cut = now - LOSE_SENT_MS;
  const old = (se || []).filter((e) => (Math.max(ms(e.contacted_at), ms(e.texted_at), ms(e.emailed_at)) || ms(e.created_at)) < cut);
  const line = `Lost automatically: no approval 3 days after it was sent (${stamp}).`;
  if (!dryRun) {
    for (let i = 0; i < old.length; i += 25) {
      await Promise.all(old.slice(i, i + 25).map((e) => db.from('estimates')
        .update({ status: 'lost', closed_reason: 'auto', notes: [e.notes, line].filter(Boolean).join('\n').slice(0, 2000) })
        .eq('id', e.id).eq('status', 'sent').is('approved_at', null).then(() => {}, () => {})));
    }
  }
  out.lost = old.length;
  return out;
}
