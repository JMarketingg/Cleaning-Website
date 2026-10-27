
export const PROSPECT_RATE = 0.10;
export const PROSPECT_USERS = [];
const STATUSES = ['new', 'calling', 'callback', 'interested', 'quote', 'booked', 'won', 'not_interested', 'dnc'];
export const OUTCOMES = ['no_answer', 'voicemail', 'gatekeeper', 'call_back', 'interested', 'quote', 'booked', 'not_interested', 'dnc', 'note'];
const DEAD = ['no_answer', 'voicemail', 'gatekeeper'];
const TALKED = ['call_back', 'interested', 'quote', 'booked'];
const PUSH_WIN_DAYS = 7;
const OUTCOME_STATUS = { no_answer: 'calling', voicemail: 'calling', gatekeeper: 'calling', call_back: 'callback', interested: 'interested', quote: 'quote', booked: 'booked', not_interested: 'not_interested', dnc: 'dnc' };
export const BUSINESS_TYPES = ['Senior living', 'Restaurant', 'Bar', 'Gym', 'Office', 'Hotel', 'Apartments', 'School', 'Church', 'Car dealer', 'Clinic', 'Other'];
export const CITIES = ['Manila'];
const LOCK_DAYS = 30, SNOOZE_DAYS = 90, PARK_AFTER = 5;
export const QUOTE_OK_OVER = 2000;
const DAY = 864e5;

const METROS = [
  { key: 'houston', zips: [[770, 775]], re: /houston|katy|sugar ?land|pearland|bellaire|west university|cypress|spring\b|humble|kingwood|the woodlands|missouri city|friendswood|league city|pasadena,? tx|baytown|tomball|richmond|stafford|conroe/ },
  { key: 'austin', zips: [[733, 733], [786, 787]], re: /austin|round rock|cedar park|pflugerville|georgetown|leander|kyle|buda|lakeway|bee cave/ },
  { key: 'san antonio', zips: [[780, 782]], re: /san antonio|new braunfels|boerne|schertz|helotes/ },
  { key: 'dallas', zips: [[750, 753], [760, 762]], re: /dallas|dfw|fort worth|plano|frisco|irving|arlington|garland|mckinney|richardson|carrollton|denton|grand prairie|allen/ },
  { key: 'denver', zips: [[800, 804]], re: /denver|golden|aurora|boulder|lakewood|littleton|arvada|westminster|centennial|parker|englewood|wheat ridge|thornton|broomfield|highlands ranch|castle rock/ },
  { key: 'phoenix', zips: [[850, 853]], re: /phoenix|scottsdale|mesa|tempe|chandler|gilbert|glendale,? az|peoria,? az|surprise/ },
  { key: 'los angeles', zips: [[900, 918]], re: /los angeles|pasadena|burbank|long beach|santa monica|glendale,? ca|torrance|inglewood|beverly hills/ },
  { key: 'okc', zips: [[730, 731]], re: /okc|oklahoma city|edmond|norman|moore|yukon|mustang/ },
  { key: 'tulsa', zips: [[740, 741]], re: /tulsa|broken arrow|owasso|jenks|bixby|sand springs/ },
];
const STATE_TZ = {
  'Asia/Manila': 'TX OK KS NE MO IA MN WI IL AR LA MS AL TN ND SD',
  'Asia/Manila': 'CO NM UT WY MT ID',
  'Asia/Manila': 'AZ',
  'Asia/Manila': 'CA NV OR WA',
  'Asia/Manila': 'FL GA SC NC VA WV MD DE PA NJ NY CT RI MA VT NH ME OH MI IN KY DC',
};
const STATE_NAMES = { texas: 'TX', oklahoma: 'OK', colorado: 'CO', arizona: 'AZ', california: 'CA', 'new mexico': 'NM', utah: 'UT', nevada: 'NV', florida: 'FL' };
function tzForZip(z) {
  const n = parseInt(String(z || '').slice(0, 3), 10);
  if (!(n >= 1)) return null;
  if ((n >= 798 && n <= 799) || n === 885) return 'Asia/Manila';
  if (n >= 750 && n <= 797) return 'Asia/Manila';
  if (n >= 730 && n <= 749) return 'Asia/Manila';
  if (n >= 800 && n <= 816) return 'Asia/Manila';
  if (n >= 850 && n <= 865) return 'Asia/Manila';
  if (n >= 870 && n <= 884) return 'Asia/Manila';
  if (n >= 840 && n <= 847) return 'Asia/Manila';
  if (n >= 889 && n <= 898) return 'Asia/Manila';
  if (n >= 900 && n <= 961) return 'Asia/Manila';
  if (n >= 970 && n <= 994) return 'Asia/Manila';
  return null;
}
export function parseZipState(...texts) {
  const s = texts.filter(Boolean).join(', ');
  const zs = s.match(/\b\d{5}(?:-\d{4})?\b/g);
  const sm = s.match(/\b([A-Z]{2}),?\s*\d{5}\b/) || s.match(/,\s*([A-Z]{2})\s*$/);
  let state = sm ? sm[1] : null;
  if (!state) { const nm = s.toLowerCase().match(/\b(texas|oklahoma|colorado|arizona|california|new mexico|utah|nevada|florida)\b/); if (nm) state = STATE_NAMES[nm[1]]; }
  return { zip: zs ? zs[zs.length - 1].slice(0, 5) : null, state };
}
function placeOf(p) {
  const got = parseZipState(p.address, p.city);
  return { zip: p.zip || got.zip, state: p.state || got.state };
}
export function metroFor(p) {
  const { zip, state } = placeOf(p);
  const n = parseInt(String(zip || '').slice(0, 3), 10);
  if (n) { const m = METROS.find(m => m.zips.some(([a, b]) => n >= a && n <= b)); if (m) return m.key; }
  const text = `${p.city || ''}, ${state || ''} ${p.address || ''}`.toLowerCase();
  const m = METROS.find(m => m.re.test(text));
  return m ? m.key : null;
}
const METRO_TZ = { houston: 'Asia/Manila', austin: 'Asia/Manila', 'san antonio': 'Asia/Manila', dallas: 'Asia/Manila', okc: 'Asia/Manila', tulsa: 'Asia/Manila', denver: 'Asia/Manila', phoenix: 'Asia/Manila', 'los angeles': 'Asia/Manila' };
export function tzForProspect(p) {
  const { zip, state } = placeOf(p);
  const z = tzForZip(zip);
  if (z) return z;
  if (state) for (const [tz, list] of Object.entries(STATE_TZ)) if (list.split(' ').includes(state)) return tz;
  const m = metroFor({ city: p.city, address: p.address });
  return (m && METRO_TZ[m]) || 'Asia/Manila';
}
export function tzForCity(city) { return tzForProspect({ city }); }
export function localTime(tz, at = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', weekday: 'short' }).format(at);
}
export function kindGroup(k) {
  const s = String(k || '').toLowerCase();
  if (/senior|nursing|assisted|memory care|retirement|elder|care home/.test(s)) return 'senior living';
  return s.trim();
}
export function refFor(refs, p) {
  const g = kindGroup(p.kind);
  if (!g) return null;
  const same = (refs || []).filter(r => kindGroup(r.kind) === g);
  if (!same.length) return null;
  const pm = metroFor(p);
  return same.find(r => pm && metroFor({ city: r.city }) === pm) || same[0];
}
export function isRefClient(refs, p) {
  const n = normName(p.business_name);
  if (!n) return false;
  return (refs || []).some(r => { const rn = normName(r.name); return rn && (rn === n || (rn.length >= 8 && n.includes(rn)) || (n.length >= 8 && rn.includes(n))); });
}
async function loadRefs(db) {
  const { data, error } = await db.from('prospect_refs').select('id, name, kind, city, line').is('deleted_at', null).order('name');
  if (error) throw error;
  return data || [];
}
export function lineForMetro(lines, metro) {
  if (!metro) return null;
  const want = { houston: '0000000000' }[metro];
  const pref = want && (lines || []).find(l => l.forward_to && phoneDigits(l.phone) === want);
  if (pref) return pref;
  const words = metro === 'denver' ? ['denver'] : metro === 'houston' ? ['houston'] : metro === 'dallas' ? ['dallas', 'dfw', 'fort worth'] : [metro];
  return (lines || []).find(l => l.forward_to && words.some(w => String(l.label || '').toLowerCase().includes(w))) || null;
}
export function inCallHours(tz, at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'Asia/Manila', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(at).map(p => [p.type, p.value]));
  const h = Number(parts.hour);
  return !['Sat', 'Sun'].includes(parts.weekday) && h >= 9 && h < 17;
}
export function normName(s) {
  return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(the|inc|llc|co|corp|company|ltd)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim() || null;
}
export function normAddr(s) {
  const a = String(s || '').toLowerCase()
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\bboulevard\b/g, 'blvd').replace(/\broad\b/g, 'rd').replace(/\bdrive\b/g, 'dr').replace(/\bsuite\b/g, 'ste')
    .replace(/\bnorth\b/g, 'n').replace(/\bsouth\b/g, 's').replace(/\beast\b/g, 'e').replace(/\bwest\b/g, 'w')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return a || null;
}
export function lockActive(p, now = Date.now()) {
  return !!(p && p.locked_by && p.last_activity_at && now - new Date(p.last_activity_at).getTime() < LOCK_DAYS * DAY);
}
export function callBlock(p, me, isOwner, now = new Date()) {
  if (!p) return 'Not found';
  if (p.is_customer && p.push_kind !== 'customer') return 'Already a customer';
  if (p.is_ref) return 'Our client';
  if (p.status === 'dnc') return 'Do not call';
  if (p.status === 'won') return 'Won';
  if (p.status === 'regular') return 'Regular customer · no call needed';
  if (p.snooze_until && new Date(p.snooze_until) > now) return 'Not interested';
  if (p.parked_at && !isOwner) return 'Parked';
  if (lockActive(p, now.getTime()) && p.locked_by !== me && !isOwner) return `Locked to ${p.locked_by}`;
  return '';
}
function phoneVariants(d) { return d ? [d, '1' + d, '+1' + d, `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`, `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`] : []; }
async function customerPhoneSet(db, digitsList) {
  const out = new Set();
  const uniq = [...new Set(digitsList.filter(d => d && d.length === 10))];
  for (let i = 0; i < uniq.length; i += 150) {
    const vs = uniq.slice(i, i + 150).flatMap(phoneVariants);
    const { data, error } = await db.from('customers').select('phone').in('phone', vs);
    if (error) throw error;
    for (const c of data || []) out.add(phoneDigits(c.phone));
  }
  return out;
}
async function getSetting(db, key, dflt) {
  const { data } = await db.from('prospect_settings').select('value').eq('key', key).maybeSingle();
  return data ? data.value : dflt;
}
async function putSetting(db, key, value) {
  const { error } = await db.from('prospect_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function prospectAccess(db, auth) {
  if (auth.role === 'owner') return true;
  if (!PROSPECT_USERS.includes(String(auth.name || ''))) return false;
  const a = await getSetting(db, 'access', { enabled: false });
  return !!(a && a.enabled === true);
}
const pErr = (status, message) => { const e = new Error(message); e.status = status; return e; };

async function claim(db, p, me) {
  const now = new Date().toISOString();
  const upd = { last_activity_at: now, updated_at: now };
  if (!lockActive(p) || p.locked_by !== me) { upd.locked_by = me; upd.locked_at = now; }
  const { error } = await db.from('prospects').update(upd).eq('id', p.id);
  if (error) throw error;
}

export async function prospectCallTarget(db, auth, prospectId) {
  if (!(await prospectAccess(db, auth))) throw pErr(403, 'Not allowed');
  const isOwner = auth.role === 'owner';
  const me = auth.name || 'Owner';
  const { data: p, error } = await db.from('prospects').select('*').eq('id', String(prospectId || '')).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  if (p && isRefClient(await loadRefs(db), p)) throw pErr(409, 'Our client');
  const block = callBlock(p, me, isOwner);
  if (block) throw pErr(409, block);
  if (!p.phone_digits || p.phone_digits.length !== 10) throw pErr(400, 'No phone');
  const cust = await customerPhoneSet(db, [p.phone_digits]);
  if (cust.size && p.push_kind !== 'customer') { await db.from('prospects').update({ is_customer: true }).eq('id', p.id); throw pErr(409, 'Already a customer'); }
  const tz = tzForProspect(p);
  if (!inCallHours(tz)) throw pErr(409, `Outside their hours (${localTime(tz)} there)`);
  const metro = metroFor(p);
  const [{ data: lines }, { data: biz }] = await Promise.all([
    db.from('tracking_numbers').select('phone, label, active, forward_to, created_at').eq('business_slug', 'tidyhaus').eq('active', true).order('created_at'),
    db.from('businesses').select('id').eq('slug', 'tidyhaus').maybeSingle(),
  ]);
  const pick = lineForMetro(lines, metro);
  if (!pick) throw pErr(409, `No TidyHaus line for ${p.city || 'this city'}`);
  if (p.push_kind !== 'customer') await claim(db, p, me);
  return { phone: p.phone_digits, line: phoneDigits(pick.phone), businessId: biz ? biz.id : null, prospectId: p.id };
}

export async function prospectQuoteLink(db, auth, prospectId, estimateId, total) {
  const held = total > QUOTE_OK_OVER && auth.role !== 'owner';
  const now = new Date().toISOString();
  const { error } = await db.from('prospects').update({ quote_estimate_id: estimateId, quote_total: total, quote_status: held ? 'needs_ok' : 'sent', status: 'quote', last_activity_at: now, updated_at: now }).eq('id', prospectId).is('deleted_at', null);
  if (error) throw error;
  await db.from('prospect_calls').insert({ prospect_id: prospectId, caller: auth.name || 'Owner', outcome: 'note', note: `Quote $${Math.round(total)}${held ? " · needs Owner's OK" : ''}` });
  return held;
}
export async function prospectQuoteHeld(db, auth, estimateId) {
  if (auth.role === 'owner') return false;
  const { data } = await db.from('prospects').select('id').eq('quote_estimate_id', String(estimateId)).eq('quote_status', 'needs_ok').limit(1);
  return !!(data && data.length);
}

export function phoneDigits(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 11 && d[0] === '1' ? d.slice(1) : d;
}
const clip = (v, n = 2000) => (v == null ? null : String(v).trim().slice(0, n) || null);
const isoOrNull = (v) => { if (!v) return null; const t = new Date(v); return isNaN(t) ? null : t.toISOString(); };
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function ticketExTax(b) {
  const lis = b.line_items || [];
  if (lis.length) {
    return money(lis.filter(li => !/^tax\b/i.test(li.name || '') && !/\btip\b/i.test(li.name || ''))
      .reduce((s, li) => s + (Number(li.line_total) || 0), 0));
  }
  return money((Number(b.subtotal) || 0) - (Number(b.discount) || 0));
}

export async function prospectAutoLink(db) {
  const { data: open, error } = await db.from('prospects')
    .select('id, phone_digits, quote_estimate_id, created_at, locked_by, assigned_to, last_activity_at, won_at, push_kind, source_customer_id')
    .is('deleted_at', null).is('customer_id', null).eq('auto_link_off', false)
    .not('status', 'in', '(won,dnc,regular)').limit(5000);
  if (error) throw error;
  if (!open || !open.length) return 0;
  const hits = new Map();
  const push = open.filter(p => p.push_kind === 'customer' && p.source_customer_id);
  for (let i = 0; i < push.length; i += 150) {
    const chunk = push.slice(i, i + 150);
    const { data: talks } = await db.from('prospect_calls').select('prospect_id, caller, created_at')
      .in('prospect_id', chunk.map(p => p.id)).in('outcome', TALKED).order('created_at', { ascending: false });
    if (!talks || !talks.length) continue;
    const { data: bks } = await db.from('bookings').select('customer_id, created_at')
      .in('customer_id', chunk.map(p => p.source_customer_id)).neq('status', 'cancelled');
    for (const p of chunk) {
      for (const t of talks.filter(x => x.prospect_id === p.id)) {
        const end = new Date(new Date(t.created_at).getTime() + PUSH_WIN_DAYS * DAY).toISOString();
        const b = (bks || []).find(b => b.customer_id === p.source_customer_id && b.created_at >= t.created_at && b.created_at <= end);
        if (b) { hits.set(p.id, { customer_id: p.source_customer_id, at: t.created_at, who: t.caller }); break; }
      }
    }
  }
  const pushIds = new Set(push.map(p => p.id));
  const qIds = open.filter(p => p.quote_estimate_id).map(p => String(p.quote_estimate_id));
  for (let i = 0; i < qIds.length; i += 150) {
    const { data: bks } = await db.from('bookings').select('customer_id, created_at, metadata->>source_estimate_id')
      .in('metadata->>source_estimate_id', qIds.slice(i, i + 150)).neq('status', 'cancelled').not('customer_id', 'is', null);
    for (const b of bks || []) {
      const p = open.find(x => String(x.quote_estimate_id) === b.source_estimate_id);
      if (p && !hits.has(p.id)) hits.set(p.id, { customer_id: b.customer_id, at: b.created_at });
    }
  }
  const byPhone = new Map();
  for (const p of open) if (!hits.has(p.id) && !pushIds.has(p.id) && p.phone_digits && p.phone_digits.length === 10) byPhone.set(p.phone_digits, p);
  const digs = [...byPhone.keys()];
  for (let i = 0; i < digs.length; i += 150) {
    const { data: cs } = await db.from('customers').select('id, phone, created_at').in('phone', digs.slice(i, i + 150).flatMap(phoneVariants));
    if (!cs || !cs.length) continue;
    const { data: bks } = await db.from('bookings').select('customer_id, created_at').in('customer_id', cs.map(c => c.id)).neq('status', 'cancelled').order('created_at');
    for (const c of cs) {
      const p = byPhone.get(phoneDigits(c.phone));
      if (!p || hits.has(p.id) || c.created_at < p.created_at) continue;
      const b = (bks || []).find(b => b.customer_id === c.id && b.created_at >= p.created_at);
      if (b) hits.set(p.id, { customer_id: c.id, at: b.created_at });
    }
  }
  let n = 0;
  for (const [pid, h] of hits) {
    const p = open.find(x => x.id === pid);
    let winner = h.who || (lockActive(p) ? p.locked_by : null);
    if (!winner) {
      const { data: lc } = await db.from('prospect_calls').select('caller').eq('prospect_id', pid).not('outcome', 'in', '(note,claim)').order('created_at', { ascending: false }).limit(1);
      winner = (lc && lc[0] && lc[0].caller) || p.locked_by || p.assigned_to || null;
    }
    const now = new Date().toISOString();
    const { error: uErr } = await db.from('prospects').update({ status: 'won', customer_id: h.customer_id, won_by: winner, won_at: h.at || now, follow_up_at: null, updated_at: now })
      .eq('id', pid).is('customer_id', null);
    if (uErr) { console.error('[prospects] auto-link', uErr.message); continue; }
    await db.from('prospect_calls').insert({ prospect_id: pid, caller: winner || 'System', outcome: 'note', note: pushIds.has(pid) ? `Won automatically · booked within ${PUSH_WIN_DAYS} days of the call` : 'Won automatically · booking made' });
    n++;
  }
  return n;
}

export async function prospectCommissionJobs(db, fromDate, toDate, onlyName) {
  try { await prospectAutoLink(db); } catch (e) { console.error('[prospects] auto-link', e.message); }
  let q = db.from('prospects').select('id, business_name, customer_id, won_by, won_at, push_kind')
    .eq('status', 'won').not('customer_id', 'is', null).not('won_by', 'is', null).is('deleted_at', null);
  if (onlyName) q = q.eq('won_by', onlyName);
  const { data: wins, error } = await q;
  if (error) throw error;
  if (!wins || !wins.length) return [];
  const byCust = new Map(wins.map(w => [w.customer_id, w]));
  const { data: jobs, error: jErr } = await db.from('bookings')
    .select('id, scheduled_at, paid_at, created_at, subtotal, discount, customer_id, zenbooker_job_number, customers(name), businesses(name), line_items:booking_line_items(name, line_total)')
    .in('customer_id', [...byCust.keys()])
    .eq('payment_status', 'paid')
    .neq('status', 'cancelled')
    .gte('paid_at', fromDate + 'T00:00:00Z')
    .lte('paid_at', toDate + 'T23:59:59Z')
    .order('paid_at');
  if (jErr) throw jErr;
  const out = [];
  for (const b of jobs || []) {
    const w = byCust.get(b.customer_id);
    if (!w || (w.won_at && b.paid_at < w.won_at)) continue;
    if (w.push_kind === 'customer' && (!w.won_at || b.created_at < w.won_at || new Date(b.created_at).getTime() > new Date(w.won_at).getTime() + PUSH_WIN_DAYS * DAY)) continue;
    const ticket = ticketExTax(b);
    out.push({ who: w.won_by, prospect: w.business_name, booking_id: b.id, date: b.paid_at, customer: b.customers?.name || '', brand: b.businesses?.name || '', ticket, pay: money(ticket * PROSPECT_RATE) });
  }
  return out;
}

export async function prospectCommissionRows(db, weekStart, weekEnd, names) {
  const jobs = await prospectCommissionJobs(db, weekStart, weekEnd);
  const by = new Map();
  for (const j of jobs) {
    if (names && !names.includes(j.who)) continue;
    if (!by.has(j.who)) by.set(j.who, []);
    by.get(j.who).push(j);
  }
  return [...by.entries()].map(([who, list]) => ({
    name: `${who} · Prospects`, person: who, jobs: [], deferred: [], commission_jobs: list,
    total: money(list.reduce((s, j) => s + j.pay, 0)),
    is_office: true, read_only: true, is_commission: true, currency: 'USD',
  }));
}

function addDays(d, n) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function sundayOf(d) { const t = new Date(d + 'T00:00:00Z'); return addDays(d, -t.getUTCDay()); }

async function customerSummary(db, customerId) {
  const { data: c } = await db.from('customers').select('id, name, phone, email, address_line1, city, businesses(name)').eq('id', customerId).maybeSingle();
  if (!c) return null;
  const { data: bk } = await db.from('bookings')
    .select('id, scheduled_at, status, price, subtotal, discount, services(name), businesses(name), line_items:booking_line_items(name, line_total)')
    .eq('customer_id', customerId).order('scheduled_at', { ascending: false }).limit(50);
  const done = (bk || []).filter(b => b.status === 'completed');
  return {
    customer: { id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address_line1, city: c.city, brand: c.businesses?.name || '' },
    jobs: done.map(b => ({
      date: b.scheduled_at, brand: b.businesses?.name || '', service: b.services?.name || '',
      did: [...new Set((b.line_items || []).map(l => l.name).filter(n => n && !/^tax\b/i.test(n)))].slice(0, 8),
      total: money(b.price),
    })),
    total_spent: money(done.reduce((s, b) => s + (Number(b.price) || 0), 0)),
  };
}

async function findDuplicate(db, f, exceptId) {
  const qs = [];
  if (f.phone_digits && f.phone_digits.length >= 7) qs.push(db.from('prospects').select('id, business_name, locked_by, created_by').eq('phone_digits', f.phone_digits).is('deleted_at', null).limit(2));
  if (f.name_norm && f.addr_norm) qs.push(db.from('prospects').select('id, business_name, locked_by, created_by').eq('name_norm', f.name_norm).eq('addr_norm', f.addr_norm).is('deleted_at', null).limit(2));
  for (const r of await Promise.all(qs)) {
    if (r.error) throw r.error;
    const hit = (r.data || []).find(x => x.id !== exceptId);
    if (hit) return hit;
  }
  return null;
}
function fieldsFrom(body) {
  const f = {
    business_name: clip(body.business_name, 200), kind: clip(body.kind, 80), contact_name: clip(body.contact_name, 120),
    phone: clip(body.phone, 40), email: clip(body.email, 200), address: clip(body.address, 300), city: clip(body.city, 120), notes: clip(body.notes, 4000),
  };
  f.phone_digits = phoneDigits(f.phone) || null;
  f.name_norm = normName(f.business_name);
  f.addr_norm = normAddr(f.address);
  const pl = parseZipState(f.address, f.city);
  f.zip = clip(body.zip, 10) || pl.zip; f.state = (clip(body.state, 2) || pl.state || '').toUpperCase() || null;
  f.tz = tzForProspect(f);
  return f;
}

export async function prospectsAction(req, res, db, auth, body, ctx) {
  const isOwner = auth.role === 'owner';
  const me = auth.name || (isOwner ? 'Owner' : 'Office');
  if (req.method === 'GET' && String(req.query.op || '') === 'access') return res.status(200).json({ ok: await prospectAccess(db, auth) });
  if (!(await prospectAccess(db, auth))) return res.status(403).json({ error: 'Not allowed' });
  const names = isOwner ? [...new Set([...(ctx.secretaryNames || []), ...PROSPECT_USERS])] : [me];
  const nowD = new Date(), now = nowD.toISOString();

  if (req.method === 'GET') {
    const op = String(req.query.op || 'list');
    if (op === 'list') {
      try { await prospectAutoLink(db); } catch (e) { console.error('[prospects] auto-link', e.message); }
      const { data: rows, error } = await db.from('prospects')
        .select('id, business_name, kind, contact_name, phone, phone_digits, address, city, tz, status, follow_up_at, assigned_to, push_kind, created_by, created_at, updated_at, won_by, customer_id, locked_by, locked_at, last_activity_at, dead_streak, parked_at, snooze_until, is_customer, quote_status, quote_total, quote_estimate_id, zip, state, push_summary, source_customer_id')
        .is('deleted_at', null).order('updated_at', { ascending: false }).limit(5000);
      if (error) throw error;
      let list = rows || [];
      const refs = await loadRefs(db);
      const flaggable = list.filter(r => !r.is_customer && r.push_kind !== 'customer');
      const custs = await customerPhoneSet(db, flaggable.map(r => r.phone_digits));
      const newly = flaggable.filter(r => custs.has(r.phone_digits)).map(r => r.id);
      if (newly.length) { await db.from('prospects').update({ is_customer: true }).in('id', newly); for (const r of list) if (newly.includes(r.id)) r.is_customer = true; }
      if (!isOwner) list = list.filter(r => r.status !== 'dnc');
      const liveLast = new Map();
      const srcIds = [...new Set(list.filter(r => r.push_kind === 'customer' && r.source_customer_id).map(r => r.source_customer_id))];
      for (let i = 0; i < srcIds.length; i += 150) {
        const { data: bks } = await db.from('bookings').select('customer_id, scheduled_at').in('customer_id', srcIds.slice(i, i + 150)).neq('status', 'cancelled');
        for (const b of bks || []) if (b.scheduled_at && !(liveLast.get(b.customer_id) > b.scheduled_at)) liveLast.set(b.customer_id, b.scheduled_at);
      }
      const soonCut = new Date(nowD.getTime() - 30 * DAY).toISOString();
      list = list.filter(r => !(r.push_kind === 'customer' && liveLast.get(r.source_customer_id) && new Date(liveLast.get(r.source_customer_id)).toISOString() > soonCut));
      const ids = list.map(r => r.id);
      const last = {};
      for (let i = 0; i < ids.length; i += 300) {
        const { data: calls } = await db.from('prospect_calls').select('prospect_id, caller, outcome, created_at').in('prospect_id', ids.slice(i, i + 300)).neq('outcome', 'note').order('created_at', { ascending: false });
        for (const c of calls || []) {
          const L = last[c.prospect_id] || (last[c.prospect_id] = { n: 0 });
          if (!L.n) { L.caller = c.caller; L.outcome = c.outcome; L.at = c.created_at; }
          L.n++;
        }
      }
      const out = list.map(r => {
        const tz = tzForProspect(r); r.is_ref = isRefClient(refs, r);
        const ref = refFor(refs, r);
        const { push_summary: ps, ...row } = r;
        const hired = ps && Array.isArray(ps.jobs) ? new Set(ps.jobs.map(j => String(j.date || '').slice(0, 10))).size : 0;
        const spent = ps ? money(ps.total_spent) : 0;
        const lastJob = liveLast.get(r.source_customer_id) || (hired ? ps.jobs.map(j => String(j.date || '')).sort().pop() || null : null);
        return { ...row, hired, spent, last_job: lastJob, tz, local: localTime(tz, nowD), lock: lockActive(r, nowD.getTime()) ? r.locked_by : null, block: callBlock(r, me, isOwner, nowD), hours: inCallHours(tz, nowD), ref_line: ref ? ref.line : null, last: last[r.id] || null };
      });
      const focusAll = await getSetting(db, 'focus', {});
      const access = isOwner ? await getSetting(db, 'access', { enabled: false }) : null;
      const { data: tips } = await db.from('prospect_tips').select('id, title, body, sort').is('deleted_at', null).order('sort').order('title');
      let iq = db.from('prospect_ideas').select('id, author, body, created_at, pulled_at').is('deleted_at', null);
      if (!isOwner) iq = iq.eq('author', me);
      const { data: ideas } = await iq.order('created_at', { ascending: false }).limit(100);
      return res.status(200).json({
        me, owner: isOwner, secretaries: names, prospect_users: PROSPECT_USERS, types: BUSINESS_TYPES, cities: CITIES, refs: isOwner ? refs : [],
        focus: isOwner ? focusAll : { [me]: (focusAll || {})[me] || [] }, access, tips: tips || [], ideas: ideas || [], prospects: out,
      });
    }
    if (op === 'detail') {
      const id = String(req.query.id || '');
      const { data: p, error } = await db.from('prospects').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
      if (error) throw error;
      if (!p || (p.status === 'dnc' && !isOwner)) return res.status(404).json({ error: 'Not found' });
      const { data: calls } = await db.from('prospect_calls').select('id, caller, outcome, note, follow_up_at, attempt_id, created_at').eq('prospect_id', id).order('created_at', { ascending: false });
      const { data: atts } = await db.from('call_attempts').select('id, staff_name, started_at, duration_sec, dial_status, staff_status').eq('prospect_id', id).order('started_at', { ascending: false }).limit(100);
      let linked = null;
      if (p.customer_id) { const { data: c } = await db.from('customers').select('id, name, phone, businesses(name)').eq('id', p.customer_id).maybeSingle(); linked = c ? { id: c.id, name: c.name, phone: c.phone, brand: c.businesses?.name || '' } : null; }
      const refs = await loadRefs(db); const tz = tzForProspect(p); p.is_ref = isRefClient(refs, p);
      const ref = refFor(refs, p);
      let jobs = null;
      if (p.push_kind === 'customer' && p.source_customer_id) {
        let cq = db.from('customers').select('id');
        cq = p.email ? cq.or(`id.eq.${p.source_customer_id},email.eq.${String(p.email).replace(/[,()]/g, '')}`) : cq.eq('id', p.source_customer_id);
        const { data: cs } = await cq.limit(10);
        const { data: bks } = await db.from('bookings')
          .select('id, scheduled_at, services(name), businesses(name, slug), line_items:booking_line_items(name)')
          .in('customer_id', (cs || []).map(c => c.id).concat(p.source_customer_id)).eq('status', 'completed')
          .order('scheduled_at', { ascending: false }).limit(50);
        jobs = (bks || []).map(b => ({ id: b.id, date: b.scheduled_at, slug: b.businesses?.slug || '', brand: b.businesses?.name || '', service: b.services?.name || '',
          did: [...new Set((b.line_items || []).map(l => l.name).filter(n => n && !/^(tax|travel|service area|location-based)/i.test(n)))].slice(0, 4) }));
      }
      return res.status(200).json({ prospect: { ...p, tz, local: localTime(tz, nowD), lock: lockActive(p, nowD.getTime()) ? p.locked_by : null, block: callBlock(p, me, isOwner, nowD), hours: inCallHours(tz, nowD), ref_line: ref ? ref.line : null, ref_name: ref ? ref.name : null }, calls: calls || [], attempts: atts || [], linked, jobs });
    }
    if (op === 'search') {
      const q = String(req.query.q || '').trim().slice(0, 60);
      if (q.length < 2) return res.status(200).json({ customers: [] });
      const dig = phoneDigits(q);
      let qq = db.from('customers').select('id, name, phone, email, city, businesses(name)').limit(15);
      qq = dig.length >= 4 ? qq.ilike('phone', `%${dig.slice(-4)}%`) : qq.ilike('name', `%${q.replace(/[%_,()]/g, '')}%`);
      const { data, error } = await qq;
      if (error) throw error;
      const list = (data || []).filter(c => dig.length < 4 || phoneDigits(c.phone).includes(dig));
      return res.status(200).json({ customers: list.map(c => ({ id: c.id, name: c.name, phone: c.phone, city: c.city, brand: c.businesses?.name || '' })) });
    }
    if (op === 'summary') {
      if (!isOwner) return res.status(403).json({ error: 'Owner only' });
      return res.status(200).json({ summary: await customerSummary(db, String(req.query.customer_id || '')) });
    }
    if (op === 'earnings') {
      const today = new Date().toISOString().slice(0, 10);
      const thisSun = sundayOf(today);
      const from = addDays(thisSun, -7 * 7);
      const jobs = await prospectCommissionJobs(db, from, addDays(thisSun, 6), isOwner ? null : me);
      const weeks = [];
      for (let i = 0; i < 8; i++) {
        const ws = addDays(from, i * 7), we = addDays(ws, 6);
        const wj = jobs.filter(j => j.date.slice(0, 10) >= ws && j.date.slice(0, 10) <= we);
        const per = {};
        for (const j of wj) per[j.who] = money((per[j.who] || 0) + j.pay);
        weeks.push({ week_start: ws, per, jobs: wj, total: money(wj.reduce((s, j) => s + j.pay, 0)) });
      }
      return res.status(200).json({ weeks: weeks.reverse(), rate: PROSPECT_RATE });
    }
    if (op === 'stats') {
      if (!isOwner) return res.status(403).json({ error: 'Owner only' });
      const days = Math.min(60, Math.max(1, parseInt(req.query.days, 10) || 14));
      const since = new Date(Date.now() - days * DAY).toISOString();
      const [{ data: calls, error: cErr }, { data: ps, error: pErr2 }] = await Promise.all([
        db.from('prospect_calls').select('caller, outcome, created_at').gte('created_at', since).limit(20000),
        db.from('prospects').select('locked_by, won_by, won_at, status, follow_up_at, last_activity_at, quote_status, quote_estimate_id').is('deleted_at', null).limit(10000),
      ]);
      if (cErr) throw cErr; if (pErr2) throw pErr2;
      const per = {};
      const row = (n) => per[n] || (per[n] = { name: n, days: {}, calls: 0, connects: 0, interested: 0, quotes: 0, wins: 0, missed: 0, commission: 0 });
      for (const c of calls || []) {
        if (['note', 'claim'].includes(c.outcome)) continue;
        const r = row(c.caller); const d = c.created_at.slice(0, 10);
        r.calls++; r.days[d] = (r.days[d] || 0) + 1;
        if (!DEAD.includes(c.outcome)) r.connects++;
        if (c.outcome === 'interested') r.interested++;
        if (c.outcome === 'quote') r.quotes++;
      }
      const start = new Date(); start.setUTCHours(0, 0, 0, 0);
      for (const p of ps || []) {
        if (p.won_by && p.won_at && p.won_at >= since) row(p.won_by).wins++;
        const open = !['won', 'not_interested', 'dnc'].includes(p.status);
        if (open && p.follow_up_at && new Date(p.follow_up_at) < start && p.locked_by && lockActive(p, Date.now())) row(p.locked_by).missed++;
      }
      const jobs = await prospectCommissionJobs(db, since.slice(0, 10), new Date().toISOString().slice(0, 10));
      for (const j of jobs) row(j.who).commission = money(row(j.who).commission + j.pay);
      return res.status(200).json({ days, people: Object.values(per) });
    }
    return res.status(400).json({ error: 'Unknown op' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const op = String(body.op || '');
  const loadP = async (id) => {
    const { data, error } = await db.from('prospects').select('*').eq('id', String(id || '')).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  };

  if (op === 'save') {
    const f = fieldsFrom(body);
    if (!f.business_name) return res.status(400).json({ error: 'Business name required' });
    if ('follow_up_at' in body) f.follow_up_at = isoOrNull(body.follow_up_at);
    if (!body.force || !isOwner) {
      const dup = await findDuplicate(db, f, body.id || null);
      if (dup) return res.status(409).json({ error: 'Already in Prospects', duplicate: dup });
    }
    if (f.phone_digits) f.is_customer = (await customerPhoneSet(db, [f.phone_digits])).size > 0;
    if (body.id) {
      const p = await loadP(body.id);
      if (!p) return res.status(404).json({ error: 'Not found' });
      if (!isOwner && lockActive(p) && p.locked_by !== me) return res.status(409).json({ error: `Locked to ${p.locked_by}` });
      const { error } = await db.from('prospects').update({ ...f, updated_at: now }).eq('id', body.id);
      if (error) throw error;
      return res.status(200).json({ ok: true, id: body.id });
    }
    const row = { ...f, created_by: me };
    if (isOwner && body.assigned_to && names.includes(body.assigned_to)) { row.assigned_to = body.assigned_to; row.locked_by = body.assigned_to; row.locked_at = now; row.last_activity_at = now; row.push_kind = 'commercial'; row.push_note = clip(body.push_note, 2000); row.pushed_at = now; }
    const { data, error } = await db.from('prospects').insert(row).select('id').single();
    if (error) throw error;
    return res.status(200).json({ ok: true, id: data.id });
  }

  if (op === 'bulk') {
    const lines = String(body.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 1000);
    const added = [], skipped = [];
    const seen = new Set();
    for (const line of lines) {
      const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map(s => s.trim());
      const [business_name, phone, address, city, kind] = cols.length > 5 ? [cols[0], cols[1], cols.slice(2, cols.length - 2).join(', '), cols[cols.length - 2], cols[cols.length - 1]] : cols;
      const f = fieldsFrom({ business_name, phone, address, city, kind: kind || null });
      if (!f.business_name || /^(name|business)/i.test(f.business_name) && /phone/i.test(String(phone))) { if (f.business_name) skipped.push({ line, why: 'Header' }); continue; }
      const key = f.phone_digits || (f.name_norm + '|' + f.addr_norm);
      if (seen.has(key)) { skipped.push({ line, why: 'Repeated' }); continue; }
      seen.add(key);
      const dup = await findDuplicate(db, f, null);
      if (dup) { skipped.push({ line, why: 'Already in', id: dup.id, name: dup.business_name }); continue; }
      added.push({ ...f, created_by: me });
    }
    if (added.length) {
      const custs = await customerPhoneSet(db, added.map(a => a.phone_digits));
      for (const a of added) a.is_customer = custs.has(a.phone_digits);
      for (let i = 0; i < added.length; i += 200) {
        const { error } = await db.from('prospects').insert(added.slice(i, i + 200));
        if (error) throw error;
      }
    }
    return res.status(200).json({ ok: true, added: added.length, skipped });
  }

  if (op === 'claim') {
    const p = await loadP(body.id);
    const block = callBlock(p, me, isOwner, nowD);
    if (block) return res.status(409).json({ error: block });
    await claim(db, p, me);
    await db.from('prospect_calls').insert({ prospect_id: p.id, caller: me, outcome: 'claim' });
    return res.status(200).json({ ok: true });
  }

  if (op === 'call') {
    const outcome = String(body.outcome || '');
    if (!OUTCOMES.includes(outcome)) return res.status(400).json({ error: 'Pick an outcome' });
    const p = await loadP(body.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const block = outcome === 'note'
      ? (!isOwner && lockActive(p) && p.locked_by !== me ? `Locked to ${p.locked_by}` : '')
      : callBlock({ ...p, parked_at: isOwner ? null : p.parked_at }, me, isOwner, nowD);
    if (block) return res.status(409).json({ error: block });
    const fu = isoOrNull(body.follow_up_at);
    const attemptId = /^[0-9a-f-]{36}$/i.test(String(body.attempt_id || '')) ? String(body.attempt_id) : null;
    const { error } = await db.from('prospect_calls').insert({ prospect_id: p.id, caller: me, outcome, note: clip(body.note, 2000), follow_up_at: fu, attempt_id: attemptId });
    if (error) throw error;
    const upd = { updated_at: now, last_activity_at: now };
    const talked = TALKED.includes(outcome);
    if (p.push_kind === 'customer' && !talked) upd.last_activity_at = p.last_activity_at || null;
    else if (!lockActive(p) || p.locked_by !== me) { if (!isOwner || !lockActive(p)) { upd.locked_by = me; upd.locked_at = now; } }
    if (outcome !== 'note') {
      upd.follow_up_at = ['not_interested', 'dnc'].includes(outcome) ? null : fu;
      if (p.status !== 'won' && OUTCOME_STATUS[outcome]) upd.status = OUTCOME_STATUS[outcome];
      if (DEAD.includes(outcome)) {
        upd.dead_streak = (p.dead_streak || 0) + 1;
        if (upd.dead_streak >= PARK_AFTER) { upd.parked_at = now; upd.follow_up_at = null; }
      } else { upd.dead_streak = 0; }
      if (outcome === 'not_interested') upd.snooze_until = new Date(Date.now() + SNOOZE_DAYS * DAY).toISOString();
      if (outcome === 'dnc') { upd.locked_by = null; upd.locked_at = null; }
    } else if (fu) upd.follow_up_at = fu;
    const { error: uErr } = await db.from('prospects').update(upd).eq('id', p.id);
    if (uErr) throw uErr;
    return res.status(200).json({ ok: true, parked: !!upd.parked_at });
  }

  if (op === 'unpark') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospects').update({ parked_at: null, dead_streak: 0, snooze_until: null, status: 'calling', updated_at: now }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'push') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const to = String(body.assigned_to || '');
    if (!names.includes(to)) return res.status(400).json({ error: 'Pick a secretary' });
    const cid = String(body.customer_id || '');
    const s = await customerSummary(db, cid);
    if (!s) return res.status(404).json({ error: 'Customer not found' });
    const c = s.customer;
    const row = {
      ...fieldsFrom({ business_name: clip(body.business_name, 200) || c.name, phone: c.phone, address: c.address, city: c.city, email: c.email, contact_name: c.name, kind: 'Other' }),
      assigned_to: to, locked_by: to, locked_at: now, last_activity_at: now, push_kind: 'customer', push_note: clip(body.push_note, 2000), push_summary: s, pushed_at: now,
      source_customer_id: c.id, created_by: me,
    };
    const { data: ex } = await db.from('prospects').select('id').eq('source_customer_id', c.id).is('deleted_at', null).maybeSingle();
    if (ex) {
      const { error } = await db.from('prospects').update({ assigned_to: to, locked_by: to, locked_at: now, last_activity_at: now, push_note: row.push_note, push_summary: s, pushed_at: now, updated_at: now }).eq('id', ex.id);
      if (error) throw error;
      return res.status(200).json({ ok: true, id: ex.id });
    }
    const { data, error } = await db.from('prospects').insert(row).select('id').single();
    if (error) throw error;
    return res.status(200).json({ ok: true, id: data.id });
  }

  if (op === 'assign') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const to = body.assigned_to ? String(body.assigned_to) : null;
    if (to && !names.includes(to)) return res.status(400).json({ error: 'Pick a secretary' });
    const upd = { assigned_to: to, locked_by: to, locked_at: to ? now : null, last_activity_at: to ? now : null, updated_at: now };
    if (to) { upd.pushed_at = now; if ('push_note' in body) upd.push_note = clip(body.push_note, 2000); }
    const { error } = await db.from('prospects').update(upd).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'win') {
    const cid = String(body.customer_id || '');
    const { data: c } = await db.from('customers').select('id').eq('id', cid).maybeSingle();
    if (!c) return res.status(400).json({ error: 'Pick the customer' });
    const p = await loadP(body.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (!isOwner && lockActive(p) && p.locked_by !== me) return res.status(409).json({ error: `Locked to ${p.locked_by}` });
    let winner = me;
    if (isOwner) { winner = body.won_by && names.includes(body.won_by) ? body.won_by : (p.won_by || p.locked_by || null); if (!winner) return res.status(400).json({ error: 'Pick who won it' }); }
    const { error } = await db.from('prospects').update({ status: 'won', customer_id: cid, won_by: winner, won_at: p.won_at || now, follow_up_at: null, auto_link_off: false, last_activity_at: now, updated_at: now }).eq('id', p.id);
    if (error) throw error;
    await db.from('prospect_calls').insert({ prospect_id: p.id, caller: me, outcome: 'note', note: 'Won · linked to customer' });
    return res.status(200).json({ ok: true });
  }

  if (op === 'unwin') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospects').update({ status: 'booked', customer_id: null, won_by: null, won_at: null, auto_link_off: true, updated_at: now }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'quote_ok') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospects').update({ quote_status: 'approved', updated_at: now }).eq('id', body.id).eq('quote_status', 'needs_ok');
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'quote_sent') {
    const { error } = await db.from('prospects').update({ quote_status: 'sent', updated_at: now }).eq('id', body.id).eq('quote_status', 'approved');
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'delete') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospects').update({ deleted_at: now }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'access') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    await putSetting(db, 'access', { enabled: body.enabled === true });
    return res.status(200).json({ ok: true });
  }
  if (op === 'focus') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const who = String(body.name || '');
    if (!names.includes(who)) return res.status(400).json({ error: 'Pick a person' });
    const cur = (await getSetting(db, 'focus', {})) || {};
    cur[who] = (Array.isArray(body.cities) ? body.cities : []).map(c => clip(c, 60)).filter(Boolean).slice(0, 20);
    await putSetting(db, 'focus', cur);
    return res.status(200).json({ ok: true });
  }
  if (op === 'tip_save') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const t = { title: clip(body.title, 60), body: clip(body.body, 1000), sort: Number(body.sort) || 0, updated_at: now };
    if (!t.title || !t.body) return res.status(400).json({ error: 'Title and text' });
    const r = body.id ? await db.from('prospect_tips').update(t).eq('id', body.id) : await db.from('prospect_tips').insert(t);
    if (r.error) throw r.error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'tip_delete') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospect_tips').update({ deleted_at: now }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'ref_save') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const r = { name: clip(body.name, 200), kind: clip(body.kind, 80), city: clip(body.city, 120), line: clip(body.line, 500), updated_at: now };
    if (!r.name || !r.line) return res.status(400).json({ error: 'Name and line' });
    const q = body.id ? await db.from('prospect_refs').update(r).eq('id', body.id) : await db.from('prospect_refs').insert(r);
    if (q.error) throw q.error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'ref_delete') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospect_refs').update({ deleted_at: now }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (op === 'idea') {
    const text = clip(body.body, 4000);
    if (!text) return res.status(400).json({ error: 'Empty' });
    const { error } = await db.from('prospect_ideas').insert({ author: me, body: text });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'idea_pulled') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' });
    const { error } = await db.from('prospect_ideas').update({ pulled_at: body.pulled ? now : null }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (op === 'idea_delete') {
    const { data: i } = await db.from('prospect_ideas').select('author').eq('id', body.id).maybeSingle();
    if (!i) return res.status(404).json({ error: 'Not found' });
    if (!isOwner && i.author !== me) return res.status(403).json({ error: 'Not yours' });
    const { error } = await db.from('prospect_ideas').update({ deleted_at: now }).eq('id', body.id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'Unknown op' });
}
