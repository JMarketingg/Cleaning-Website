import { serviceClient } from './_lib/supabase.js';
import { publicOpenSlots } from './_lib/availability.js';
import { NATIVE_SLUGS } from './_lib/native-businesses.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const src = req.method === 'GET' ? req.query : (req.body || {});

  if (src.business === 'doms') {
    try {
      const db = serviceClient();
      let serviceAreaId = src.service_area_id || src.territory_id || null;
      if (!serviceAreaId || serviceAreaId === 'doms-denver') {
        const { data: biz } = await db.from('businesses').select('id').eq('slug', 'doms').single();
        const zip = String(src.postal_code || src.zip || '').trim().slice(0, 5);
        const { data: zr } = (biz && /^\d{5}$/.test(zip)) ? await db.from('service_area_zips').select('service_area_id').eq('business_id', biz.id).eq('postal_code', zip).maybeSingle() : { data: null };
        const { data: den } = biz ? await db.from('service_areas').select('id').eq('business_id', biz.id).eq('name', 'Manila').maybeSingle() : { data: null };
        serviceAreaId = zr?.service_area_id || den?.id || null;
      }
      const result = await publicOpenSlots(db, { businessSlug: 'doms', days: src.days, serviceAreaId, crossHire: true, zip: src.postal_code || src.zip || null });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Availability lookup failed', message: err.message });
    }
  }

  if (NATIVE_SLUGS.includes(src.business)) {
    const serviceAreaId = src.service_area_id || src.territory_id || null;
    if (!serviceAreaId) return res.status(400).json({ error: 'service_area_id is required' });
    try {
      const db = serviceClient();
      const result = await publicOpenSlots(db, { businessSlug: src.business, days: src.days, serviceAreaId, crossHire: true, zip: src.postal_code || src.zip || null });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Availability lookup failed', message: err.message });
    }
  }

  return res.status(410).json({ error: 'Unknown or missing business. Zenbooker is no longer used — pass business=tidyhaus, mile-high, or doms.' });
}
