import { serviceClient } from './_lib/supabase.js';
import { NATIVE_SLUGS } from './_lib/native-businesses.js';
import { LA_FALLBACK_SLUGS } from './_lib/service-area-resolve.js';

function zip5(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{5})(?:[-\s]\d{1,4})?$/);
  return m ? m[1] : s;
}

async function domsServiceArea(req, res) {
  const zip = zip5((req.body && (req.body.zip || req.body.postal_code)) || '');
  if (!zip) return res.status(400).json({ error: 'zip is required' });
  try {
    const db = serviceClient();
    const { data: biz } = await db.from('businesses').select('id').eq('slug', 'doms').single();
    if (!biz) return res.status(500).json({ error: 'Doms business not configured' });
    const { data: z } = await db.from('service_area_zips')
      .select('*').eq('business_id', biz.id).eq('postal_code', zip).maybeSingle();
    if (!z) return res.status(200).json({ in_service_area: false, territory_id: null });
    const { data: zArea } = z.service_area_id
      ? await db.from('service_areas').select('id, name, state, timezone, unstaffed').eq('id', z.service_area_id).maybeSingle()
      : { data: null };
    if (zArea && zArea.name !== 'Manila') {
      return res.status(200).json({
        in_service_area: true,
        territory_id:    zArea.id,
        service_area_id: zArea.id,
        territory_name:  zArea.name,
        unstaffed:       !!zArea.unstaffed,
        surcharge:       Number(z.surcharge) || 0,
        timezone:        zArea.timezone || 'Asia/Manila',
        city:            zArea.name,
        state:           zArea.state || null,
        lat:             null,
        lng:             null,
      });
    }
    return res.status(200).json({
      in_service_area: true,
      territory_id:    'doms-denver',
      territory_name:  'Manila',
      surcharge:       Number(z.surcharge) || 0,
      timezone:        'Asia/Manila',
      city:            'Manila',
      state:           'CO',
      lat:             null,
      lng:             null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Service area check failed', message: err.message });
  }
}

async function nativeServiceArea(req, res, slug) {
  const zip = zip5((req.body && (req.body.zip || req.body.postal_code)) || '');
  if (!zip) return res.status(400).json({ error: 'zip is required' });
  try {
    const db = serviceClient();
    const { data: biz } = await db.from('businesses').select('id').eq('slug', slug).single();
    if (!biz) return res.status(500).json({ error: `${slug} business not configured` });
    let z, zErr;
    ({ data: z, error: zErr } = await db.from('service_area_zips')
      .select('surcharge, price_adjustment_amount, service_area:service_areas ( id, name, state, timezone, unstaffed )')
      .eq('business_id', biz.id).eq('postal_code', zip).maybeSingle());
    if (zErr && /(price_adjustment_amount|unstaffed)/.test(zErr.message || '')) {
      ({ data: z } = await db.from('service_area_zips')
        .select('surcharge, service_area:service_areas ( id, name, state, timezone )')
        .eq('business_id', biz.id).eq('postal_code', zip).maybeSingle());
    }
    if (!z || !z.service_area) {
      if (LA_FALLBACK_SLUGS.has(slug) && /^9(?:[0-5]\d{3}|6[01]\d{2})$/.test(zip)) {
        const { data: la } = await db.from('service_areas')
          .select('id, name, state, timezone, unstaffed')
          .eq('business_id', biz.id).eq('state', 'CA').eq('active', true).maybeSingle();
        if (la && la.unstaffed) {
          return res.status(200).json({
            in_service_area: true,
            territory_id:    la.id,
            service_area_id: la.id,
            territory_name:  la.name,
            unstaffed:       true,
            surcharge:       0,
            price_adjustment_amount: 0,
            timezone:        la.timezone || 'Asia/Manila',
            city:            la.name,
            state:           'CA',
            lat:             null,
            lng:             null,
          });
        }
      }
      return res.status(200).json({ in_service_area: false, territory_id: null });
    }
    const area = z.service_area;
    return res.status(200).json({
      in_service_area: true,
      territory_id:    area.id,
      service_area_id: area.id,
      territory_name:  area.name,
      unstaffed:       !!area.unstaffed,
      surcharge:       Number(z.surcharge) || 0,
      price_adjustment_amount: Number(z.price_adjustment_amount) || 0,
      timezone:        area.timezone || 'Asia/Manila',
      city:            area.name || null,
      state:           area.state || null,
      lat:             null,
      lng:             null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Service area check failed', message: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  if (req.body && req.body.business === 'doms') return domsServiceArea(req, res);
  if (req.body && NATIVE_SLUGS.includes(req.body.business)) return nativeServiceArea(req, res, req.body.business);

  return res.status(410).json({ error: 'Unknown or missing business. Zenbooker is no longer used — pass business=tidyhaus, mile-high, or doms.' });
}
