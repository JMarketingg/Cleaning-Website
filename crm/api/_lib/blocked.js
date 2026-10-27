import { serviceClient } from './supabase.js';

const TOLL_FREE = new Set(['800', '833', '844', '855', '866', '877', '888']);
export function isTollFree(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 && TOLL_FREE.has(d.slice(0, 3));
}

export async function isBlockedPhone(raw) {
  try {
    const d = String(raw || '').replace(/\D/g, '').slice(-10);
    if (d.length !== 10) return false;
    const { data } = await serviceClient().from('blocked_numbers').select('id').eq('phone', d).limit(1);
    return !!(data && data.length);
  } catch {
    return false;
  }
}
