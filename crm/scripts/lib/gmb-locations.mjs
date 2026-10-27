// ============================================================================
// scripts/lib/gmb-locations.mjs — Google Business Profile locations registry
// ============================================================================
// SINGLE SOURCE OF TRUTH for every Google Business Profile (GBP / "Google
// Business") listing we run, across both businesses. "Hard saved" here so it
// survives context/chat and is the one place to update when a listing changes.
//
// Each listing records:
//   key           stable slug used everywhere else (google_reviews.location_key,
//                 /api/reviews?location=, the websites' review markers). Never
//                 reuse or renumber these — a change orphans stored rows.
//   name          human label for the location
//   displayName   the EXACT business name as Google shows it. This is what the
//                 review-notification email subject says ("<reviewer> left a
//                 review for <displayName>") and is half of how a review gets
//                 attributed to a listing. All values verified against Google
//                 Maps 2026-09-08 — see the prefix warning in resolveLocation().
//   business      our slug: 'handy-andy' | 'doms'
//   metro         routing metro used by review-request routing (admin.js)
//   cid           the Google place CID — the token in the g.page short link
//                 (https://g.page/r/<CID>/review). This is the review-WRITE link
//                 customers use; it is NOT the same as the review-notification
//                 email that Google sends the owner.
//   reviewUrl     the full customer "leave a review" short link. Opens Google's
//                 WRITE-a-review dialog — right for a review request, wrong for
//                 any "see our reviews" link on a website.
//   mapsUrl       the listing's own Google Maps page (same short link without
//                 /review). This is the one to point a website's "read the full
//                 review" / "see all reviews" links at.
//   phone         the number published ON that listing (each listing has its own)
//   address       street address, or null for a service-area listing without one
//   rating        the listing's public star average, as Google shows it
//   reviewCount   the listing's public review total, as Google shows it
//   statsVerified date rating/reviewCount were last read off Google Maps by hand
//   notifyEmail   the Gmail account that RECEIVES the "you just received a
//                 Google review" notification email for this listing. This is
//                 the mailbox the tracker must scan to ingest new reviews.
//   mailboxEnv    which GMAIL_USER[_N] env slot in the tracker scans notifyEmail
//                 (see scripts/bracket-email-sync.mjs + bracket-tracker.yml).
//
// NOTE on rating/reviewCount: a HAND-CHECKED SNAPSHOT, not a live figure —
// nothing in this system can count reviews it never ingested (the
// notification-email feed only started 2026-05-18, long after these listings
// did). They exist so the websites can print a true number instead of the
// invented "230+" they shipped with. They drift slowly upward; re-read them off
// Google when statsVerified goes stale. Understating is the safe direction —
// never round these up.
//
// NOTE on Houston: both Houston listings send their review notifications to the
// SAME inbox (houstonmainbusiness@gmail.com), so one mailbox slot covers both.
// They are told apart by displayName instead — see resolveLocation().
// ============================================================================

export const GMB_LOCATIONS = [
  {
    key: 'ha-houston',
    name: 'Handy Andy — Houston #1',
    displayName: 'Handy Andy TV Mounting',
    business: 'handy-andy',
    metro: 'houston',
    cid: 'CdizxHwpwcE0EBM',
    placeId: 'ChIJrZOohQF_bIcR2LPEfCnBwTQ',
    reviewUrl: 'https://g.page/r/CdizxHwpwcE0EBM/review',
    mapsUrl: 'https://g.page/r/CdizxHwpwcE0EBM',
    phone: '+1 281-626-5853',
    address: null, // service-area listing, no public street address
    rating: 5.0,
    reviewCount: 248,
    statsVerified: '2026-10-18',
    notifyEmail: 'houstonmainbusiness@gmail.com',
    mailboxEnv: 'GMAIL_USER_4',
  },
  {
    key: 'ha-greenway',
    name: 'Handy Andy — Houston #2 (Greenway Plaza)',
    displayName: 'Handy Andy TV Mounting & Home Theater',
    business: 'handy-andy',
    metro: 'houston',
    cid: 'CeA7fWzbLgO8EBM',
    placeId: 'ChIJnyvL36C9QIYR4Dt9bNsuA7w',
    reviewUrl: 'https://g.page/r/CeA7fWzbLgO8EBM/review',
    mapsUrl: 'https://g.page/r/CeA7fWzbLgO8EBM',
    phone: '+1 281-638-8419',
    address: '24 Greenway Plz Ste 1800, Houston, TX 77046',
    rating: 5.0,
    reviewCount: 48,
    statsVerified: '2026-10-18',
    notifyEmail: 'houstonmainbusiness@gmail.com',
    mailboxEnv: 'GMAIL_USER_4',
  },
  {
    key: 'ha-denver',
    name: 'Handy Andy — Denver #1',
    displayName: 'Handy Andy TV Mounting',
    business: 'handy-andy',
    metro: 'denver',
    cid: 'Ccj-ZjdeLtzfEBM',
    placeId: 'ChIJY--BLYh5bIcRyP5mN14u3N8',
    reviewUrl: 'https://g.page/r/Ccj-ZjdeLtzfEBM/review',
    mapsUrl: 'https://g.page/r/Ccj-ZjdeLtzfEBM',
    phone: '+1 720-541-8180',
    address: null, // service-area listing, no public street address
    rating: 5.0,
    reviewCount: 278,
    statsVerified: '2026-10-18',
    notifyEmail: 'denvermainbusiness@gmail.com',
    mailboxEnv: 'GMAIL_USER_5',
  },
  {
    key: 'ha-golden',
    name: 'Handy Andy — Denver #2 (Golden)',
    displayName: 'Handy Andy TV Mounting',
    business: 'handy-andy',
    metro: 'denver',
    cid: 'CWcIi45TvszbEBM',
    placeId: 'ChIJSeWocWyHa4cRZwiLjlO-zNs',
    reviewUrl: 'https://g.page/r/CWcIi45TvszbEBM/review',
    mapsUrl: 'https://g.page/r/CWcIi45TvszbEBM',
    phone: '+1 720-637-3707',
    address: '17250 W Colfax Ave B102, Golden, CO 80401',
    rating: 5.0,
    reviewCount: 114,
    statsVerified: '2026-10-18',
    notifyEmail: 'denverinstallpros@gmail.com',
    mailboxEnv: 'GMAIL_USER_6',
  },
  {
    key: 'ha-austin',
    name: 'Handy Andy — Austin',
    displayName: 'Handy Andy TV Mounting',
    business: 'handy-andy',
    metro: 'austin',
    cid: 'CYE7aX6tVMnkEBM',
    placeId: 'ChIJO4mLku-uFgERgTtpfq1UyeQ',
    reviewUrl: 'https://g.page/r/CYE7aX6tVMnkEBM/review',
    mapsUrl: 'https://g.page/r/CYE7aX6tVMnkEBM',
    phone: '+1 512-668-6643',
    address: '11639 Argonne Forest Trail B, Austin, TX 78759',
    rating: 5.0,
    reviewCount: 80,
    statsVerified: '2026-10-18',
    notifyEmail: 'austinmainbusiness@gmail.com',
    mailboxEnv: 'GMAIL_USER_7',
  },
  {
    // Live in admin.js's GMB_LISTINGS review routing but missing from this
    // registry entirely until 2026-09-08. It has ZERO reviews so far, so no
    // notification email has ever had to be attributed to it — which is why the
    // gap went unnoticed. Owner confirmed 2026-09-30: LA's review emails go to
    // tvmountinglaca@gmail.com, scanned as mailbox slot 8.
    key: 'ha-los-angeles',
    name: 'Handy Andy — Los Angeles',
    displayName: 'Handy Andy TV Mounting Los Angeles',
    business: 'handy-andy',
    metro: 'los-angeles',
    cid: 'CfCMbSKempPwEBM',
    placeId: 'ChIJbYJB3ZDHwoAR8IxtIp6ak_A',
    reviewUrl: 'https://g.page/r/CfCMbSKempPwEBM/review',
    mapsUrl: 'https://g.page/r/CfCMbSKempPwEBM',
    phone: '+1 213-579-3329',
    address: '811 Wilshire Blvd #800, Los Angeles, CA 90017',
    rating: 5.0,
    reviewCount: 3,
    statsVerified: '2026-10-18',
    notifyEmail: 'tvmountinglaca@gmail.com',
    mailboxEnv: 'GMAIL_USER_8',
  },
  {
    key: 'ha-fort-worth',
    name: 'Handy Andy — Fort Worth',
    displayName: 'Handy Andy TV Mounting Fort Worth',
    business: 'handy-andy',
    metro: 'fort-worth',
    cid: 'CTYY_ZOaE-AyEBM', // Maps CID 3665951651308312630 (0x32e0139a93fd1836)
    placeId: 'ChIJlUTBkKRzToYRNhj9k5oT4DI',
    reviewUrl: 'https://g.page/r/CTYY_ZOaE-AyEBM/review',
    mapsUrl: 'https://g.page/r/CTYY_ZOaE-AyEBM',
    phone: '+1 817-546-3928',
    address: '451 University Dr, Fort Worth, TX 76107',
    rating: null,
    reviewCount: 0,
    statsVerified: '2026-10-18',
    // Owner 2026-10-13: same Google account as Astraea Austin. NOT yet scanned:
    // slot 9 needs GMAIL_USER_9 / GMAIL_APP_PASSWORD_9 secrets + workflow env.
    notifyEmail: 'bostoninstallpros@gmail.com',
    mailboxEnv: 'GMAIL_USER_9',
  },
  {
    key: 'doms-colorado',
    name: "Dom's TV Mounting Colorado",
    displayName: 'Doms TV Mounting Colorado',
    business: 'doms',
    metro: 'denver',
    cid: 'Cffr7Tp2DSNOEBM',
    placeId: 'ChIJh8cNF2SEAQIR9-vtOnYNI04',
    reviewUrl: 'https://g.page/r/Cffr7Tp2DSNOEBM/review',
    mapsUrl: 'https://g.page/r/Cffr7Tp2DSNOEBM',
    phone: '+1 720-800-6095',
    address: null, // service-area listing, no public street address
    rating: 5.0,
    reviewCount: 286,
    statsVerified: '2026-10-18',
    notifyEmail: 'domstvmounting@gmail.com',
    mailboxEnv: 'GMAIL_USER_2',
  },
  // Bought from Dom 2026-10 with the OKC and Tulsa brands. Their review alerts
  // land in the same Dom's inbox (owner confirmed 2026-10-13):
  // once three Dom's listings share a mailbox, resolveLocation() falls through
  // to the EXACT display name, which is distinct for all three. Before these
  // entries existed, an OKC/Tulsa alert in that inbox would have been filed as
  // Colorado (the inbox alone resolved to the only Dom's listing).
  // cid here is the DECIMAL Google CID (no g.page token known yet); mapsUrl is
  // the listing page, never the write-a-review dialog.
  {
    key: 'doms-okc',
    name: "Dom's TV Mounting OKC",
    displayName: 'Doms TV Mounting OKC',
    business: 'doms',
    metro: 'okc',
    cid: '516566321774452060',
    placeId: 'ChIJFyIBeQzU62QRXN1LMFU2Kwc',
    reviewUrl: null,
    mapsUrl: 'https://www.google.com/maps?cid=516566321774452060',
    phone: '+1 405-657-6412',
    address: null,
    rating: 5.0,
    reviewCount: 268,
    statsVerified: '2026-10-18',
    notifyEmail: 'domstvmounting@gmail.com',
    mailboxEnv: 'GMAIL_USER_2',
  },
  {
    key: 'doms-tulsa',
    name: "Dom's TV Mounting Tulsa",
    displayName: 'Doms TV Mounting Tulsa',
    business: 'doms',
    metro: 'tulsa',
    cid: '14065283668418833000',
    placeId: 'ChIJaainyknUGigRaCo1sfnsMcM',
    reviewUrl: null,
    mapsUrl: 'https://www.google.com/maps?cid=14065283668418833000',
    phone: '+1 918-237-3122',
    address: null,
    rating: 4.9,
    reviewCount: 50,
    statsVerified: '2026-10-18',
    notifyEmail: 'domstvmounting@gmail.com',
    mailboxEnv: 'GMAIL_USER_2',
  },
  // A1 TV Mounting, DFW (acquired 2026-09). Place ID is what the owner's g.page
  // review link resolves to; cid is its decimal form. Review inbox unknown.
  {
    key: 'a1-dfw',
    name: 'A1 TV Mounting',
    displayName: 'A1 TV Mounting',
    business: 'a1tvmounting',
    metro: 'dallas',
    cid: '13107254808561079264',
    placeId: 'ChIJAQBL4mmAToYR4FPQnM1S5rU',
    reviewUrl: 'https://g.page/r/CeBT0JzNUua1EBM/review',
    mapsUrl: 'https://www.google.com/maps?cid=13107254808561079264',
    phone: '+1 469-260-2941',
    address: '1002 Fuller Wiser Rd, Euless, TX 76039',
    rating: 5.0,
    reviewCount: 77,
    statsVerified: '2026-10-18',
    notifyEmail: null,
    mailboxEnv: null,
  },
  // Astraea TV Mounting Austin (austinmounting.com, business slug 'austin').
  // Same Google account as HA Fort Worth, so its review emails land in the
  // bostoninstallpros@ inbox = mailbox slot 9, which is NOT connected yet
  // (needs GMAIL_USER_9 / GMAIL_APP_PASSWORD_9 secrets). Count is hand-checked.
  {
    key: 'astraea-austin',
    name: 'Astraea TV Mounting Austin',
    displayName: 'Astraea TV Mounting Austin',
    business: 'austin',
    metro: 'austin',
    cid: 'Cfy3b1Mtk59QEBM',
    placeId: 'ChIJ-VOqfnW1RIYR_LdvUy2Tn1A',
    reviewUrl: 'https://g.page/r/Cfy3b1Mtk59QEBM/review',
    mapsUrl: 'https://g.page/r/Cfy3b1Mtk59QEBM',
    phone: '+1 737-381-3800',
    address: '2500 Bee Caves Rd, Austin, TX 78746',
    rating: 5.0,
    reviewCount: 2,
    statsVerified: '2026-10-18',
    notifyEmail: 'bostoninstallpros@gmail.com',
    mailboxEnv: 'GMAIL_USER_9',
  },
  // Not ours to scan for review emails; tracked for counts only (owner 2026-10-18).
  {
    key: 'perfectview-houston',
    name: 'Houston PerfectView',
    displayName: 'Houston PerfectView',
    business: 'perfectview',
    metro: 'houston',
    cid: '12593316269777541730',
    placeId: 'ChIJ7xG1dD_BQIYRYto81GxyxK4',
    reviewUrl: null,
    mapsUrl: 'https://www.google.com/maps?cid=12593316269777541730',
    phone: '+1 832-793-7986',
    address: '1733 Milford St, Houston, TX 77098',
    rating: 5.0,
    reviewCount: 24,
    statsVerified: '2026-10-18',
    notifyEmail: null,
    mailboxEnv: null,
  },
  {
    key: 'millertime-houston',
    name: 'Millertime Custom Installs',
    displayName: 'Millertime Custom Installs',
    business: 'millertime',
    metro: 'houston',
    cid: '1505845332101005890',
    placeId: 'ChIJS5u-f6_dQIYRQoKP6lnW5RQ',
    reviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJS5u-f6_dQIYRQoKP6lnW5RQ',
    mapsUrl: 'https://www.google.com/maps?cid=1505845332101005890',
    phone: '+1 713-998-5324',
    address: null,
    rating: 4.9,
    reviewCount: 173,
    statsVerified: '2026-10-18',
    notifyEmail: null,
    mailboxEnv: null,
  },
];

export const LOCATIONS_BY_KEY = new Map(GMB_LOCATIONS.map((l) => [l.key, l]));

// Normalize a business name for comparison: casefold, collapse punctuation, and
// treat "&" and "and" alike (Google renders the listing with "&", but a
// forwarded or plain-text copy of the same email can carry either).
function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Attribute one review-notification email to a specific listing.
//
// Two signals, because neither alone is sufficient:
//   • mailbox     uniquely identifies the listing for Denver #1, Denver #2,
//                 Austin and Dom's (1:1 inbox → listing).
//   • displayName splits the two Houston listings, which share an inbox.
//
// !! THE PREFIX TRAP !!  "Handy Andy TV Mounting" is an exact PREFIX of
// "Handy Andy TV Mounting & Home Theater" (the Greenway Plaza listing). A
// substring / `includes` test therefore matches Houston #1 for BOTH, silently
// filing every Greenway review under the wrong listing — and because both are
// real Houston reviews, nothing downstream would ever look wrong enough to
// notice. So: exact match first, and only then a prefix match taking the
// LONGEST candidate. Never `includes`.
//
// Returns the listing, or null when the signals don't identify exactly one. A
// null is deliberate and safe: the review still stores, it just stays
// unattributed rather than being filed against the wrong listing.
export function resolveLocation({ business, mailbox, displayName } = {}) {
  let pool = GMB_LOCATIONS;
  if (business) pool = pool.filter((l) => l.business === business);
  if (mailbox) {
    const mb = String(mailbox).toLowerCase().trim();
    const byMailbox = pool.filter((l) => (l.notifyEmail || '').toLowerCase() === mb);
    // Only narrow when the mailbox is one we know. An unrecognized mailbox
    // (a forward, a newly added inbox) shouldn't wipe out a pool that the
    // display name could still resolve on its own.
    if (byMailbox.length) pool = byMailbox;
  }
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];

  const want = normName(displayName);
  if (!want) return null;

  const exact = pool.filter((l) => normName(l.displayName) === want);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // genuinely ambiguous — never guess

  // Longest-wins prefix match, for a subject line carrying extra trailing text.
  const prefixed = pool
    .filter((l) => want.startsWith(normName(l.displayName)))
    .sort((a, b) => normName(b.displayName).length - normName(a.displayName).length);
  return prefixed.length ? prefixed[0] : null;
}

// Distinct notification inboxes → the mailbox env slot that must scan them.
// Handy: what to wire up in GitHub Actions secrets. Listings with no confirmed
// inbox yet (LA) are excluded — they have nothing to scan.
export function notificationMailboxes() {
  const seen = new Map();
  for (const l of GMB_LOCATIONS) {
    if (!l.notifyEmail) continue;
    if (!seen.has(l.notifyEmail)) {
      seen.set(l.notifyEmail, { email: l.notifyEmail, env: l.mailboxEnv, locations: [] });
    }
    seen.get(l.notifyEmail).locations.push(l.name);
  }
  return [...seen.values()];
}
