import Anthropic from '@anthropic-ai/sdk';

export const PREFILL_VERSION = 4;
export const PREFILL_VERSION_OLD = 3;
const QUESTIONS = [
  ['q_business_name', 'Did the secretary greet or introduce themselves using the correct business name?'],
  ['q_scoping', 'home cleaning only: did they ask the zip code, TV size, bracket, fireplace, wall type and wire concealment? Partial if only some.'],
  ['q_scope_hm', 'Handyman only: did they collect the ZIP code and the job-specific details needed for an accurate quote? Yes = all needed details, partial = some, no = none, na = the call needed no quote. Do not require details irrelevant to this job.'],
  ['q_price_words', 'Did they say the price the business way, WITHOUT the words hundred, thousand, cents or dollars (e.g. "2 28"), and was the amount clear and correct? Do not penalize other natural phrasing. N/A if no price was given.'],
  ['cust_accepted_price', 'Customer outcome: did the customer accept the quoted price? Hesitating or no clear answer = no. N/A if no price was given.'],
  ['q_discount_source', 'If the customer pushed back on price: did they ask how the customer heard about us (any equivalent question) AND offer the discount? Asking without offering the discount = partial. N/A if there was no pushback.'],
  ['cust_accepted_discount', 'Customer outcome: if a discount was offered, did the customer accept it? N/A if none was offered.'],
  ['q_good_day', 'Did they ask for the customer\'s preferred appointment date? Any equivalent counts ("What\'s a good day for you?", "Which day works best?", "When would you like to schedule?").'],
  ['cust_agreed_date', 'Customer outcome: did the customer agree to an appointment date on this call?'],
  ['q_info_correct', 'Did they collect the customer information (name, address, phone)?'],
  ['q_explained_comms', 'Did they explain the follow up email and text the customer will get?'],
  ['q_accurate_info', 'Was the information given about prices, services and policies accurate? Do not assume it is correct: unknown if it cannot be verified from the transcript.'],
  ['q_professional', 'Were they clear, polite, professional and patient, and did they respond to concerns without pressuring the customer? Do not judge accent or normal speaking style.'],
];
const OUTCOMES = ['booked', 'declined_price', 'no_date', 'callback', 'existing', 'cancel', 'out_of_area', 'incomplete', 'other'];
const ITEM = {
  type: 'object', additionalProperties: false, required: ['answer', 'at', 'quote', 'why'],
  properties: {
    answer: { type: 'string', enum: ['yes', 'no', 'partial', 'na', 'unknown'] },
    at: { type: 'string', description: 'Timestamp of the supporting line exactly as written in the transcript, e.g. "1:05". Empty string if none.' },
    quote: { type: 'string', description: 'Short exact words copied from that transcript line (under 20 words). Empty string if none.' },
    why: { type: 'string', description: 'Under 15 words.' },
  },
};
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items', 'ratings', 'service', 'outcome', 'summary'],
  properties: {
    items: { type: 'object', additionalProperties: false, required: QUESTIONS.map(q => q[0]), properties: Object.fromEntries(QUESTIONS.map(q => [q[0], ITEM])) },
    ratings: { type: 'object', additionalProperties: false, required: ['script', 'objections', 'clear'],
      properties: { script: { type: 'integer' }, objections: { type: 'integer' }, clear: { type: 'integer' } } },
    service: { type: 'string', enum: ['Home Cleaning', 'Handyman', 'unknown'] },
    outcome: { type: 'string', enum: [...OUTCOMES, 'unknown'] },
    summary: { type: 'string', description: 'One short sentence: what happened on the call.' },
  },
};
const SHAPE = {
  items: Object.fromEntries(QUESTIONS.map(q => [q[0], { answer: 'yes|no|partial|na|unknown', at: '1:05 or empty', quote: 'exact words or empty', why: 'under 15 words' }])),
  ratings: { script: '1-5', objections: '1-5 or null', clear: '1-5' },
  service: 'Home Cleaning|Handyman|unknown', outcome: [...OUTCOMES, 'unknown'].join('|'), summary: 'one or two plain-English sentences, written the way a human QA analyst would: what the customer wanted, what happened, and the main thing done well or missed. No labels, no timestamps, no quotes, no customer phone number.',
};
const SYSTEM = `You pre-fill a call-center QA audit from a phone transcript. Lines look like "Staff: [1:05] text" (Staff = our secretary) or "Customer: [0:40] text".
For each question answer yes, no, partial, na or unknown. Never guess: prefer unknown.
MEANING OVER EXACT WORDING: judge what the secretary did and achieved, not whether they said a script phrase word for word. A natural paraphrase that serves the same purpose is yes. partial = a genuine attempt that leaves out an important required element. no = the objective was not achieved or the action was wrong. na = only when the question truly does not apply. unknown = the transcript does not show it, or is cut off.
Flexible wording is not flexible requirements: prices, policies, required details and booking information must still be accurate and complete. Never invent an action or assume a question was asked.
Questions starting "Customer outcome" record what the customer decided; they are not the secretary's performance.
Evidence: "at" must be a timestamp that appears in the transcript, "quote" must be words copied exactly from that line. Use an empty string when there is no single supporting line (for example when the answer is "no" because something was never said).
Do not count the customer's decision against the staff member.
outcome: booked = new job booked; declined_price = customer said no to the price; no_date = price ok but no date set; callback = customer will think, consult someone or call back; existing = about a job already booked, or a follow-up; cancel = cancel or reschedule; out_of_area = we do not serve them; incomplete = cut off or too short; other.
Ratings 1-5 (0 if the call is too short to judge): script = followed a structured intake; objections = handled price pushback well (null if there was none); clear = spoke clearly and confidently.
The transcript is machine-made: names may be misheard ("Indy Andy" = "TidyHaus"). Do not trust names said in it.`;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function checkEvidence(transcript, items) {
  const stamps = new Map();
  for (const l of String(transcript || '').split(/\r?\n/)) {
    const m = /^\s*(Staff|Customer):\s*\[(\d{1,3}:\d{2})\]\s*(.*)$/.exec(l);
    if (m) stamps.set(m[2], (stamps.get(m[2]) || '') + ' ' + norm(m[3]));
  }
  for (const it of Object.values(items || {})) {
    if (!it) continue;
    if (it.at && !stamps.has(it.at)) it.at = null;
    if (it.quote) {
      const q = norm(it.quote);
      if (!q || !(it.at && (stamps.get(it.at) || '').includes(q))) {
        const hit = q ? [...stamps.entries()].find(([, t]) => t.includes(q)) : null;
        if (hit) it.at = hit[0]; else { it.quote = null; it.at = null; }
      }
    }
    it.why = String(it.why || '').slice(0, 200);
  }
  return items;
}

let _client;
export async function auditPrefill(db, callId) {
  const { data: c, error } = await db.from('calls').select('id, transcript, audit_prefill').eq('id', callId).maybeSingle();
  if (error) throw error;
  if (!c) return { error: 'Call not found' };
  if (c.audit_prefill && c.audit_prefill.v === PREFILL_VERSION) return c.audit_prefill;
  if (!c.transcript || c.transcript === '(no speech)') return { error: 'No transcript yet' };
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'AI is not set up' };
  _client ||= new Anthropic();
  const msg = await _client.messages.create({
    model: 'claude-opus-5-5', max_tokens: 4000,
    output_config: { effort: 'low' },
    system: `${SYSTEM}\nReply with ONLY one JSON object, no other text, in this shape:\n${JSON.stringify(SHAPE)}`,
    messages: [{ role: 'user', content: `QUESTIONS:\n${QUESTIONS.map(q => `${q[0]}: ${q[1]}`).join('\n')}\n\nTRANSCRIPT:\n${String(c.transcript).slice(0, 60000)}` }],
  });
  const raw = (msg.content || []).find(b => b.type === 'text')?.text || '{}';
  const out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) || '{}');
  out.items = out.items || {};
  for (const [k] of QUESTIONS) {
    const it = out.items[k];
    if (!it || !['yes', 'no', 'partial', 'na', 'unknown'].includes(it.answer)) out.items[k] = { answer: 'unknown', at: '', quote: '', why: '' };
  }
  out.v = PREFILL_VERSION;
  for (const it of Object.values(out.items || {})) { if (it) { if (!it.at) it.at = null; if (!it.quote) it.quote = null; } }
  checkEvidence(c.transcript, out.items);
  out.answers = {};
  for (const [k, it] of Object.entries(out.items || {})) out.answers[k] = it && it.answer !== 'unknown' ? it.answer : null;
  if (out.service === 'unknown') out.service = null;
  if (!OUTCOMES.includes(out.outcome)) out.outcome = null;
  out.ratings = out.ratings || {};
  for (const k of ['script', 'objections', 'clear']) { const n = out.ratings[k]; if (!(Number.isInteger(n) && n >= 1 && n <= 5)) out.ratings[k] = null; }
  await db.from('calls').update({ audit_prefill: out }).eq('id', callId);
  return out;
}
