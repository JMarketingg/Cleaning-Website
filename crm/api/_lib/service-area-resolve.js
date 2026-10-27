
export function zip5(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{5})(?:[-\s]\d{1,4})?$/);
  return m ? m[1] : s;
}

const CA_ZIP_RE = /^9(?:[0-5]\d{3}|6[01]\d{2})$/;

export const LA_FALLBACK_SLUGS = new Set(['tidyhaus', 'tvmountinglosangeles']);

export async function resolveServiceArea(db, businessId, businessSlug, rawZip) {
  const zip = zip5(rawZip);
  if (!zip) return null;

  const { data: z, error } = await db.from('service_area_zips')
    .select('service_area:service_areas ( id, name, state, timezone, unstaffed )')
    .eq('business_id', businessId).eq('postal_code', zip).maybeSingle();
  if (error) throw error;
  if (z && z.service_area) {
    const a = z.service_area;
    return {
      id: a.id, name: a.name, state: a.state,
      timezone: a.timezone || null, unstaffed: !!a.unstaffed,
    };
  }

  if (LA_FALLBACK_SLUGS.has(businessSlug) && CA_ZIP_RE.test(zip)) {
    const { data: laRows } = await db.from('service_areas')
      .select('id, name, state, timezone, unstaffed')
      .eq('business_id', businessId).eq('state', 'CA').eq('active', true)
      .order('created_at', { ascending: true }).limit(1);
    const la = laRows?.[0] || null;
    if (la) {
      return {
        id: la.id, name: la.name, state: la.state,
        timezone: la.timezone || 'Asia/Manila', unstaffed: !!la.unstaffed,
      };
    }
  }
  return null;
}

export async function unstaffedZipMatcher(db, businessId, businessSlug) {
  const { data: areas, error: aErr } = await db.from('service_areas')
    .select('id, state, unstaffed').eq('business_id', businessId).eq('active', true);
  if (aErr) throw aErr;
  const unstaffedIds = new Set((areas || []).filter(a => a.unstaffed).map(a => a.id));
  const laUnstaffed = (areas || []).some(a => a.state === 'CA' && a.unstaffed);

  const { data: zips, error: zErr } = await db.from('service_area_zips')
    .select('postal_code, service_area_id').eq('business_id', businessId);
  if (zErr) throw zErr;
  const zipToArea = new Map((zips || []).map(z => [z.postal_code, z.service_area_id]));

  return function isUnstaffed(rawZip) {
    const zip = zip5(rawZip);
    if (!zip) return false;
    if (zipToArea.has(zip)) return unstaffedIds.has(zipToArea.get(zip));
    return LA_FALLBACK_SLUGS.has(businessSlug) && laUnstaffed && CA_ZIP_RE.test(zip);
  };
}

export async function isUnstaffedZip(db, businessId, businessSlug, rawZip) {
  const area = await resolveServiceArea(db, businessId, businessSlug, rawZip);
  return !!(area && area.unstaffed);
}
