// Call summary (owner, 2026-09-25: "3 with bubbles inside"): a few short
// bullets shown above a transcript so the office sees the gist at a glance.
// Made once per call and saved on calls.transcript_summary.
import Anthropic from '@anthropic-ai/sdk';

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'text'],
      properties: {
        kind: { type: 'string', enum: ['job', 'place', 'price', 'booked', 'not_booked', 'we_promised', 'other'] },
        text: { type: 'string' },
      } } },
  },
};
const SYSTEM = `Summarize a phone call between our office ("Staff:") and a customer ("Customer:") for a home cleaning / handyman company.
Return 2-5 bullets, each under 12 words, only facts in the transcript:
- job: what they want (TV size, soundbar, dismount, etc.). If the customer sent or will send a photo, say only that ("Customer sent a photo") -- skip receipts, wall details and other small stuff.
- place: city / zip
- price: the TOTAL price we quoted, and any change (e.g. "Quoted $339 total", "Quoted $204, dropped to $174"). Never list single fees or add-ons -- only the total.
- booked or not_booked: the outcome (e.g. "Not booked, will call back")
- we_promised: something OUR STAFF said they would do next (e.g. "We will text a quote", "We will email the estimate", "We will call back tomorrow"). Only staff promises -- never what the customer will do.
- other: anything else important
Skip kinds that are not in the call. The transcript is machine-made; fix obvious mishearings ("1 2nd" in a price is a pause).`;

let _client;
export async function callSummary(db, callId) {
  const { data: c, error } = await db.from('calls').select('id, transcript, transcript_summary, duration_sec').eq('id', callId).maybeSingle();
  if (error) throw error;
  if (!c) return null;
  if (c.transcript_summary) return c.transcript_summary;
  // Owner 2026-09-28: never summarize a call under 10 seconds.
  if (c.duration_sec != null && Number(c.duration_sec) < 10) return null;
  if (!c.transcript || !/^(Staff|Customer):/m.test(c.transcript) || c.transcript.length < 120) return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _client ||= new Anthropic();
  const msg = await _client.messages.create({
    model: 'claude-opus-5-5', max_tokens: 600,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: String(c.transcript).slice(0, 40000) }],
  });
  const out = JSON.parse((msg.content || []).find(b => b.type === 'text')?.text || '{}');
  if (!Array.isArray(out.items) || !out.items.length) return null;
  await db.from('calls').update({ transcript_summary: out }).eq('id', callId);
  try { await promiseCallback(db, callId, out); } catch (e) { console.error('[promise-callback]', e.message); }
  return out;
}
// Owner 2026-10-21: every staff promise ("we'll call/text you back") on a call
// that did not book becomes a callback banner, due 1 hour after the call. It
// closes itself when staff call that number (callbackRequests) or text it.
export async function promiseCallback(db, callId, out) {
  const items = (out && out.items) || [];
  const promise = items.find((i) => i && i.kind === 'we_promised');
  if (!promise || items.some((i) => i && i.kind === 'booked')) return;
  // Real customers only (owner 2026-10-22): a sales/vendor call has no job item,
  // and "we'll pass it to the owner" is not a customer callback.
  if (!items.some((i) => i && i.kind === 'job')) return;
  if (/owner|andrew|manager/i.test(promise.text || '')) return;
  if (items.some((i) => i && /not a customer|sales call|solicit|vendor|partnership|marketing/i.test(i.text || ''))) return;
  const { data: c } = await db.from('calls').select('caller_phone, occurred_at, handled_by, claimed_by, booking_id, businesses:business_id ( slug )').eq('id', callId).maybeSingle();
  if (!c || c.booking_id) return;
  const phone = String(c.caller_phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) return;
  const { data: open } = await db.from('callback_requests').select('id').eq('phone', phone).is('done_at', null).limit(1);
  if (open && open.length) return;
  const STAFF = [];
  const who = [c.claimed_by, c.handled_by].find((n) => STAFF.includes(n));
  const slug = c.businesses?.slug || null;
  const targets = who ? [who] : (slug === 'doms' ? ['Joe', 'Alex', 'Joey'] : ['Heather', 'Joey']);
  const due = new Date(new Date(c.occurred_at || Date.now()).getTime() + 3600e3);
  const dueTxt = due.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
  await db.from('callback_requests').insert({
    phone, business_slug: slug, targets, created_by: 'Call promise',
    note: `Promised on the call: ${String(promise.text || '').slice(0, 200)}. Due by ${dueTxt} MT.`,
  });
}
