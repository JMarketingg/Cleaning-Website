export const config = { runtime: 'edge' };

const enc = new TextEncoder();
let _key = null;
function b64urlBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function verify(token) {
  const [data, sig] = String(token || '').split('.');
  if (!data || !sig) return null;
  try {
    _key ||= await crypto.subtle.importKey('raw', enc.encode(process.env.SESSION_SECRET || 'dev-insecure-secret-change-me'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('HMAC', _key, b64urlBytes(sig), enc.encode(data)))) return null;
    const body = JSON.parse(new TextDecoder().decode(b64urlBytes(data)));
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch { return null; }
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function splitSecondary(text) {
  const parts = String(text || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts[parts.length - 1] === 'USA') parts.pop();
  const m = (parts[parts.length - 1] || '').match(/^([A-Z]{2})(?:\s+(\d{5}))?$/);
  return m ? { city: parts.length > 1 ? parts[parts.length - 2] : '', state: m[1], zip: m[2] || '' } : { city: '', state: '', zip: '' };
}

async function autocomplete(key, input, session, types) {
  const u = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  u.searchParams.set('input', input);
  u.searchParams.set('key', key);
  u.searchParams.set('types', types);
  u.searchParams.set('components', 'country:us');
  if (session) u.searchParams.set('sessiontoken', session);
  const j = await (await fetch(u)).json();
  if (j.status && j.status !== 'OK' && j.status !== 'ZERO_RESULTS') console.warn('[places-edge]', j.status, j.error_message || '');
  return (j.predictions || []).slice(0, 5).map(p => {
    const sf = p.structured_formatting || {};
    return { description: p.description, place_id: p.place_id, street: sf.main_text || '', ...splitSecondary(sf.secondary_text) };
  });
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const auth = await verify((request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!auth || (auth.role !== 'owner' && auth.role !== 'secretary')) return json({ error: 'Unauthorized' }, 401);
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ predictions: [] });
  const p = new URL(request.url).searchParams;
  const q = (p.get('q') || '').trim().slice(0, 200);
  const zip = /^\d{5}$/.test(p.get('zip') || '') ? p.get('zip') : '';
  const session = (p.get('session') || '').slice(0, 64);
  const placeId = (p.get('place_id') || '').slice(0, 300);
  try {
    if (placeId) {
      const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      u.searchParams.set('place_id', placeId);
      u.searchParams.set('key', key);
      u.searchParams.set('fields', 'address_component');
      if (session) u.searchParams.set('sessiontoken', session);
      const j = await (await fetch(u)).json();
      if (j.status !== 'OK') return json({ address: null, status: j.status });
      const comps = j.result?.address_components || [];
      const get = (type, short) => { const c = comps.find(x => (x.types || []).includes(type)); return c ? (short ? c.short_name : c.long_name) : ''; };
      return json({ address: {
        street: [get('street_number'), get('route')].filter(Boolean).join(' '),
        city: get('locality') || get('sublocality') || get('postal_town') || get('administrative_area_level_2'),
        state: get('administrative_area_level_1', true),
        zip: get('postal_code'),
      } });
    }
    if (!q && zip) {
      const r = (await autocomplete(key, zip, '', '(regions)'))[0];
      return json(r ? { city: r.street === zip ? r.city : r.street, state: r.state, zip } : {});
    }
    if (q.length < 3) return json({ predictions: [] });
    const hasZip = /\b\d{5}\b/.test(q);
    const [withZip, plain] = await Promise.all([
      zip && !hasZip ? autocomplete(key, `${q} ${zip}`, session, 'address') : Promise.resolve([]),
      autocomplete(key, q, session, 'address'),
    ]);
    const seen = new Set();
    const predictions = [...withZip, ...plain].filter(x => !seen.has(x.place_id) && seen.add(x.place_id)).slice(0, 5);
    return json({ predictions });
  } catch (e) {
    console.error('[places-edge] failed:', e.message);
    return json({ predictions: [], error: 'lookup failed' }, 502);
  }
}
