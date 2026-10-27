// Kept so callers don't change. TidyHaus has one location, so no booking gets a city bonus.
export const HOUSTON_ONLY_SLUGS = new Set();
export async function isHoustonBooking() { return false; }
