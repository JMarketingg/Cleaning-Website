const GMB_LISTINGS = {
  'tidyhaus': {
    houston: ['https://g.page/r/CdizxHwpwcE0EBM/review', 'https://g.page/r/CeA7fWzbLgO8EBM/review'],
    denver:  ['https://g.page/r/Ccj-ZjdeLtzfEBM/review', 'https://g.page/r/CWcIi45TvszbEBM/review'],
    'los-angeles': ['https://g.page/r/CfCMbSKempPwEBM/review'],
    'fort-worth': ['https://g.page/r/CTYY_ZOaE-AyEBM/review'],
  },
  'doms': {
    _all: ['https://g.page/r/Cffr7Tp2DSNOEBM/review'],
  },
};
const OWN_LISTING_OVER_OK = new Set([]);
const OK_REVIEW = {
  okc:   'https://g.page/r/CVzdSzBVNisHEBM/review',
  tulsa: 'https://g.page/r/CWgqNbH57DHDEBM/review',
};
const TECH_METRO = {
  'tidyhaus': { juan: 'houston', zach: 'austin', steve: 'denver', kregg: 'denver' },
};
const HA_DEFAULT_METRO = 'denver';

function hashIndex(str, n) {
  if (n <= 1) return 0;
  let h = 0; const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

export function resolveGoogleReviewUrl({ slug, techName, areaName, bookingId, state, city, zip }) {
  if (OWN_LISTING_OVER_OK.has(slug)) return GMB_LISTINGS[slug]._all[0] || null;
  if (/^ok/i.test(String(state || '')) || /^7[34]\d/.test(String(zip || ''))) {
    return (/tulsa/i.test(String(city || '')) || /^74[01]/.test(String(zip || ''))) ? OK_REVIEW.tulsa : OK_REVIEW.okc;
  }
  if (slug === 'doms') return GMB_LISTINGS.doms._all[0] || null;
  if (GMB_LISTINGS[slug] && GMB_LISTINGS[slug]._all) return GMB_LISTINGS[slug]._all[0] || null;

  const metros = GMB_LISTINGS[slug];
  if (!metros) return null;

  let metro = null;
  const first = (techName || '').trim().toLowerCase().split(/\s+/)[0];
  if (first && TECH_METRO[slug] && TECH_METRO[slug][first]) metro = TECH_METRO[slug][first];
  if (!metro && areaName) {
    const a = areaName.toLowerCase();
    if (a.includes('houston')) metro = 'houston';
    else if (a.includes('denver')) metro = 'denver';
    else if (a.includes('austin')) metro = 'austin';
    else if (a.includes('los angeles')) metro = 'los-angeles';
    else if (a.includes('fort worth') || a === 'dfw') metro = 'fort-worth';
  }
  if (!metro) metro = HA_DEFAULT_METRO;

  const list = metros[metro] || metros[HA_DEFAULT_METRO] || [];
  if (!list.length) return null;
  return list[hashIndex(bookingId, list.length)];
}
