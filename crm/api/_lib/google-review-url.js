// Shared by api/admin.js (customer review page) and api/tech.js (in-person review QR).
// ── Google review (GMB) routing ─────────────────────────────────────────────
// A 5-star customer is sent to a Google listing to post their review. The goal
// is to spread reviews across BOTH accounts in a metro so no single profile
// gets them all. Routing is by metro; within a metro with two listings the
// pick is stable per booking (refresh-safe) and split ~50/50 across them.
//
// Metro is decided by the technician first (the owner thinks of it that way:
// "Juan -> Houston, Zach -> Austin, Steve/Kregg -> Denver"); if the tech isn't
// mapped we fall back to the booking's service-area name, then a default.
// Doms has a single listing, so every Doms job goes there.
const GMB_LISTINGS = {
  'handy-andy': {
    houston: ['https://g.page/r/CdizxHwpwcE0EBM/review', 'https://g.page/r/CeA7fWzbLgO8EBM/review'],
    denver:  ['https://g.page/r/Ccj-ZjdeLtzfEBM/review', 'https://g.page/r/CWcIi45TvszbEBM/review'],
    austin:  ['https://g.page/r/CYE7aX6tVMnkEBM/review'],
    'los-angeles': ['https://g.page/r/CfCMbSKempPwEBM/review'],
    'fort-worth': ['https://g.page/r/CTYY_ZOaE-AyEBM/review'],   // verified GBP, owner 2026-10-13
  },
  'doms': {
    _all: ['https://g.page/r/Cffr7Tp2DSNOEBM/review'],
  },
  // A1 Home Cleaning, DFW (owner 2026-10-01).
  a1tvmounting: { _all: ['https://g.page/r/CeBT0JzNUua1EBM/review'] },
  // Astraea Home Cleaning Austin (tidyhausph.com), owner 2026-10-04.
  austin: { _all: ['https://g.page/r/Cfy3b1Mtk59QEBM/review'] },
  // Austin lead-gen brands review on the Astraea listing (owner 2026-10-13).
  austinmountingpros: { _all: ['https://g.page/r/Cfy3b1Mtk59QEBM/review'] },
  atxmountpros: { _all: ['https://g.page/r/Cfy3b1Mtk59QEBM/review'] },
  atxtvmount: { _all: ['https://g.page/r/Cfy3b1Mtk59QEBM/review'] },
};
// Brands whose own listing beats the Oklahoma Dom's fallback below.
const OWN_LISTING_OVER_OK = new Set([]);
// Oklahoma locations bought from Dom (owner 2026-10-01). Any business's job
// with an Oklahoma address gets these, whichever brand booked it.
const OK_REVIEW = {
  okc:   'https://g.page/r/CVzdSzBVNisHEBM/review',
  tulsa: 'https://g.page/r/CWgqNbH57DHDEBM/review',
};
// Technician first name (lowercase) -> metro. Extend as the roster grows.
const TECH_METRO = {
  'handy-andy': { juan: 'houston', zach: 'austin', steve: 'denver', kregg: 'denver' },
};
const HA_DEFAULT_METRO = 'denver';

// Stable, ~even index into a list from any string key (e.g. booking id).
function hashIndex(str, n) {
  if (n <= 1) return 0;
  let h = 0; const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

// Resolve the Google review URL for a booking. `bookingId` keeps the choice
// stable across page refreshes; the hash spreads bookings across the metro's
// listings so both accounts collect reviews.
export function resolveGoogleReviewUrl({ slug, techName, areaName, bookingId, state, city, zip }) {
  if (OWN_LISTING_OVER_OK.has(slug)) return GMB_LISTINGS[slug]._all[0] || null;
  // Oklahoma jobs go to that city's listing: Tulsa by city or 740/741 ZIP, else OKC.
  if (/^ok/i.test(String(state || '')) || /^7[34]\d/.test(String(zip || ''))) {
    return (/tulsa/i.test(String(city || '')) || /^74[01]/.test(String(zip || ''))) ? OK_REVIEW.tulsa : OK_REVIEW.okc;
  }
  if (slug === 'doms') return GMB_LISTINGS.doms._all[0] || null;
  if (GMB_LISTINGS[slug] && GMB_LISTINGS[slug]._all) return GMB_LISTINGS[slug]._all[0] || null;

  const metros = GMB_LISTINGS[slug];
  if (!metros) return null;

  // 1) technician → metro
  let metro = null;
  const first = (techName || '').trim().toLowerCase().split(/\s+/)[0];
  if (first && TECH_METRO[slug] && TECH_METRO[slug][first]) metro = TECH_METRO[slug][first];
  // 2) service-area name → metro
  if (!metro && areaName) {
    const a = areaName.toLowerCase();
    if (a.includes('houston')) metro = 'houston';
    else if (a.includes('denver')) metro = 'denver';
    else if (a.includes('austin')) metro = 'austin';
    else if (a.includes('los angeles')) metro = 'los-angeles';
    else if (a.includes('fort worth') || a === 'dfw') metro = 'fort-worth';
  }
  // 3) default
  if (!metro) metro = HA_DEFAULT_METRO;

  const list = metros[metro] || metros[HA_DEFAULT_METRO] || [];
  if (!list.length) return null;
  return list[hashIndex(bookingId, list.length)];
}
