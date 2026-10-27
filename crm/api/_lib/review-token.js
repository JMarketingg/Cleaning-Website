import { signToken, verifyToken } from './auth.js';
import { compactReviewToken } from './review-code.js';

export const REVIEW_TOKEN_TTL = 2592000;

export function mintReviewToken(bookingId) {
  return signToken({ kind: 'review', booking_id: bookingId }, REVIEW_TOKEN_TTL);
}

function tokenUsable(token, bookingId) {
  if (!token) return false;
  try {
    const payload = verifyToken(token);
    return !!(payload && payload.booking_id === bookingId && (!payload.kind || payload.kind === 'review'));
  } catch { return false; }
}

export async function ensureReviewToken(db, booking) {
  if (!booking || !booking.id) return null;
  if (tokenUsable(booking.review_token, booking.id)) return booking.review_token;
  const why = booking.review_token ? 'expired' : 'missing';
  try {
    const token = mintReviewToken(booking.id);
    const { error } = await db.from('bookings').update({ review_token: token }).eq('id', booking.id);
    if (error) throw error;
    booking.review_token = token;
    console.log(`[review] minted ${why} review_token for booking ${booking.id}`);
    return token;
  } catch (e) {
    booking.review_token = null;
    console.error(`[review] could not mint review_token for booking ${booking.id}:`, e.message);
    return null;
  }
}

export const REVIEW_LINK_PREFIX = {
  'tidyhaus': 'https://tidyhaus-crm.vercel.app/r/',
};

export function reviewRequestSms({ slug, name, token, clickUrl, techName }) {
  const prefix = REVIEW_LINK_PREFIX[slug];
  const code = token ? compactReviewToken(token) : null;
  const link = prefix && code ? `${prefix}${encodeURIComponent(code)}` : clickUrl;
  const first = techName && String(techName).trim().split(/\s+/)[0];
  return `Thanks for choosing us! Could you leave ${first || 'your cleaner'} a quick review?\n\n${link}`;
}

export async function reviewTechName(db, booking) {
  if (booking?.technician?.name) return booking.technician.name;
  if (!booking?.technician_id) return null;
  try {
    const { data } = await db.from('technicians').select('name').eq('id', booking.technician_id).maybeSingle();
    return data?.name || null;
  } catch { return null; }
}
