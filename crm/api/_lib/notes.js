import { localDateTimeUTC } from './time.js';

export function denverToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

export function noteIsLive(n, today) {
  if (n.send_at && new Date(n.send_at).getTime() > Date.now()) return false;
  if (n.show_from > today) return false;
  if (n.mode === 'until_read') return true;
  const span = n.mode === 'two_days' ? 1 : 0;
  const end = new Date(n.show_from + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + span);
  return today <= end.toISOString().slice(0, 10);
}

export function noteIsScheduled(n) {
  return !!(n.send_at && new Date(n.send_at).getTime() > Date.now());
}

const SEND_MAX_DAYS_AHEAD = 90;
export function resolveSendAt(body) {
  const date = String((body && body.send_date) || '').trim();
  const time = String((body && body.send_time) || '').trim();
  if (!date && !time) return { send_at: null, show_from: denverToday() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: 'Pick both a date and a time to schedule it' };
  }
  const at = localDateTimeUTC('Asia/Manila', date, time);
  if (Number.isNaN(at.getTime())) return { error: 'That date and time is not valid' };
  const now = Date.now();
  if (at.getTime() <= now) return { error: 'That time has already passed. Pick a time in the future, or choose Send now.' };
  if (at.getTime() > now + SEND_MAX_DAYS_AHEAD * 86400000) return { error: `Schedule within the next ${SEND_MAX_DAYS_AHEAD} days` };
  return { send_at: at.toISOString(), show_from: date };
}

export const NOTE_PHOTO_PREFIX = 'note-photos';
export const NOTE_MAX_PHOTOS = 4;
const PRIVATE_NOTE_PHOTO_RE = new RegExp(`^priv:${NOTE_PHOTO_PREFIX}/[0-9a-f-]{36}\\.(jpg|png|webp|heic)$`);
export function isPrivateNotePhoto(u) { return PRIVATE_NOTE_PHOTO_RE.test(String(u || '')); }
export function cleanNotePhotos(input) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!Array.isArray(input)) return [];
  const allowed = base ? `${base}/storage/v1/object/public/booking-photos/${NOTE_PHOTO_PREFIX}/` : null;
  return [...new Set(input.map(u => String(u || '').trim())
    .filter(u => u.length < 400 && (isPrivateNotePhoto(u) || (allowed && u.startsWith(allowed)))))]
    .slice(0, NOTE_MAX_PHOTOS);
}
