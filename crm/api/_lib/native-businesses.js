// api/_lib/native-businesses.js
// The single source of truth for which business slugs run the native, zip-driven
// CRM path (api/book.js's bookNative) as opposed to Doms' single-metro path or
// the legacy Zenbooker path. Every place that needs to recognize "is this a
// real business slug" (slots.js, estimate.js, log-event.js, analytics.js,
// admin.js allowlists) imports this instead of keeping its own copy — a slug
// list duplicated six times drifts silently; this doesn't.
//
// Doms is deliberately NOT here — it predates bookNative and keeps its own
// single-metro handler (bookDoms), so it's allowlisted separately wherever
// that distinction matters.
//
//   name      what a technician sees on the job card / assignment text
//   legalName the full trading name, used in owner alerts and email subjects
export const NATIVE_BUSINESS = {
  'handy-andy': { name: 'TidyHaus',                    legalName: 'TidyHaus Home Cleaning' },
  'mile-high':  { name: 'Mile High Home Cleaning',         legalName: 'Mile High Home Cleaning' },
  // Austin-only micro-brand (austinmounting.com), same shape as Mile High: no
  // techs of its own, borrows TidyHaus's Austin roster (see PARTNER_SLUG in
  // availability.js), fully separate customer-facing identity.
  'austin':     { name: 'Astraea Home Cleaning Austin', legalName: 'Astraea Home Cleaning Austin' },
  // Houston-only micro-brand (precisiontvinstallation.com), same shape again:
  // no techs of its own, borrows TidyHaus's Houston roster (Juan).
  'precision':  { name: 'Precision TV Installation',     legalName: 'Precision TV Installation' },
  // Denver-only micro-brand (tvmountingdenver.com), same shape as Mile High:
  // no techs of its own, borrows TidyHaus's Denver roster. Booking-only
  // brand: it publishes NO phone number anywhere.
  'tvmountingdenver': { name: 'Home Cleaning Denver',      legalName: 'Home Cleaning Denver' },
  // Houston lead-gen micro-brands, same shape as Precision: no techs of their
  // own, all borrow TidyHaus's Houston roster (Juan). Share one Stripe
  // account (houstonmounting.com's) — see LEGACY_SLUG_ACCOUNT in stripe.js.
  'houstonmounting':      { name: 'Houston Mounting',           legalName: 'Houston Mounting' },
  'houstontvinstallation': { name: 'Houston TV Installation',   legalName: 'Houston TV Installation' },
  'tvhanginghouston':     { name: 'TV Hanging Houston',         legalName: 'TV Hanging Houston' },
  'htvmounting':          { name: 'HHome Cleaning',                legalName: 'HHome Cleaning' },
  'houstontvmountingpros':  { name: 'H-Town Home Cleaning',          legalName: 'H-Town Home Cleaning' },
  'houstonperfectviewtvmounting': { name: 'PerfectView Home Cleaning', legalName: 'Houston PerfectView Home Cleaning' },
  // Millertime (millertimetvmounting.com): client brand run for Millertime,
  // Houston only, no phone, Juan only (SOLE_TECH in availability.js).
  'millertime':           { name: 'MillerTime Custom Installs', legalName: 'MillerTime Custom Installs' },
  // Austin lead-gen micro-brands, same shape as the Houston quad above: no
  // techs of their own, all borrow TidyHaus's Austin roster (Zach) — see
  // PARTNER_SLUG in availability.js. All four share the existing 'austin'
  // Stripe account (austinmounting.com's) — see LEGACY_SLUG_ACCOUNT in stripe.js.
  'atxmountpros':       { name: 'ATX Mount Pros',          legalName: 'ATX Mount Pros' },
  'atxtvmount':         { name: 'ATX Home Cleaning',         legalName: 'ATX Home Cleaning' },
  'austinmountingpros': { name: 'Austin Mounting Pros',    legalName: 'Austin Mounting Pros' },
  'austintvinstall':    { name: 'Austin TV Installation',  legalName: 'Austin TV Installation' },
  // Los Angeles micro-brand (tvmountinglosangeles.com). No techs of its own and
  // none anywhere in LA yet, so its own Los Angeles service area is `unstaffed`
  // and the widget runs the REQUEST flow (owner texted, customer acknowledged by
  // text + email) instead of a slot booking. To make it a real booking flow:
  // seed LA techs + zips and flip that area to staffed. Stripe/Resend keys are
  // its own (TVMOUNTINGLOSANGELES_*), never TidyHaus's.
  'tvmountinglosangeles': { name: 'Home Cleaning Los Angeles', legalName: 'Home Cleaning Los Angeles' },
  // A1 Home Cleaning (a1tvmounting.com), Dallas-Fort Worth — a REAL acquired
  // business, not a lead-gen funnel: it gets its own technicians (invite them
  // from the Technicians tab; its DFW service area is seeded `unstaffed` until
  // the first one joins), its own Stripe account and its own Resend account
  // (A1TVMOUNTING_*), never TidyHaus's. Deliberately has NO PARTNER_SLUG.
  'a1tvmounting': { name: 'A1 Home Cleaning', legalName: 'A1 Home Cleaning' },
};

export const NATIVE_SLUGS = Object.keys(NATIVE_BUSINESS);

// Every business slug the /api/book.js dispatcher recognizes at all (native +
// Doms). Used by allowlist checks that don't care about the native/Doms split.
export const ALL_BUSINESS_SLUGS = [...NATIVE_SLUGS, 'doms'];
