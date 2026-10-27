
import { serviceClient } from './supabase.js';

const MODEL = 'claude-haiku-4-5-20251001';
const CONCURRENCY = 5;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 300;

const PROMPT = [
  'You are reviewing a TV-mounting job photo.',
  '',
  'Question: is OUR company logo displayed ON THE TV SCREEN itself?',
  '',
  'Our logo is a single specific piece of artwork: a multi-coloured paint-splash',
  'swirl / spiral (pink, orange, yellow, green, blue) with paint droplets flying',
  'off it, and directly UNDERNEATH it the company name in bold letters --',
  'either "tidyhaus" or "DOM\'S TV MOUNTING". The wordmark is part',
  'of the artwork. It is usually shown full-screen on an otherwise dark TV.',
  '',
  'Say YES only if you can see BOTH the paint-splash swirl AND the company',
  'wordmark beneath it, on a television screen. The logo is often small in the',
  'frame because the photo shows the whole room -- judge by the artwork, not its',
  'size. If you cannot make out the wordmark, say NO.',
  '',
  'Say NO for everything else. In particular these are NOT our logo, even though',
  'they are colourful things on a screen -- they are the most common mistakes:',
  '- a TV brand or operating-system startup / setup screen: the Google TV boot',
  '  animation (four coloured dots or circles), Samsung, LG, Roku, Amazon or',
  '  Vizio setup, a QR code, a sign-in page, a Wi-Fi or language picker',
  '- a streaming service logo or app tile (Netflix, YouTube, Disney, Hulu)',
  '- ordinary TV content: a movie, a show, sport, a music video, a channel logo',
  '- art / gallery / screensaver mode, or a photo displayed on the screen',
  '- a colourful reflection, glare or pattern bouncing off a dark or off screen',
  '- "No Signal", a blue HDMI screen, a black screen, or the TV switched off',
  '- our logo on a van, shirt, sign, business card or paperwork -- it must be',
  '  ON A SCREEN',
  '- a different company\'s logo (the customer\'s own decor, a brand on the wall)',
  '',
  'When in doubt, say NO. A missed logo shot costs nothing; a wrong one puts',
  'junk in a folder the office posts from.',
  '',
  'Reply with exactly one line in this format and nothing else:',
  'YES | <five words on what is on the screen>',
  'or',
  'NO | <five words on why not>',
].join('\n');

async function askClaude(url, signal) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 40,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
    signal,
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  const data = await r.json();
  return ((data.content && data.content[0] && data.content[0].text) || '').trim();
}

async function scanOne(db, photo) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let text;
  try {
    text = await askClaude(photo.url, ctrl.signal);
  } catch (e) {
    console.error('[photo_logo_scan] photo', photo.id, 'failed:', e.message);
    return null;
  } finally {
    clearTimeout(t);
  }

  const m = /^\s*(YES|NO)\b\s*\|?\s*(.*)$/i.exec(text);
  if (!m) {
    console.error('[photo_logo_scan] photo', photo.id, 'unparseable reply:', JSON.stringify(text).slice(0, 120));
    return null;
  }
  const hit = m[1].toUpperCase() === 'YES';
  const note = (m[2] || '').trim().slice(0, 120) || null;

  const { error } = await db.from('booking_photos')
    .update({ logo_shot: hit, logo_scanned_at: new Date().toISOString(), logo_note: note })
    .eq('id', photo.id);
  if (error) { console.error('[photo_logo_scan] photo', photo.id, 'update failed:', error.message); return null; }
  return { id: photo.id, logo_shot: hit, note };
}

export async function scanLogoPhotos({ limit, dryRun } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: 'ANTHROPIC_API_KEY not set', scanned: 0, hits: 0 };

  const db = serviceClient();

  const n = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const { data, error } = await db.from('booking_photos')
    .select('id, url, created_at')
    .is('logo_scanned_at', null)
    .eq('status', 'posted')
    .order('created_at', { ascending: false })
    .limit(n);
  if (error) throw error;

  const queue = data || [];
  const { count: remaining } = await db.from('booking_photos')
    .select('id', { count: 'exact', head: true }).is('logo_scanned_at', null).eq('status', 'posted');

  if (dryRun) return { dry_run: true, would_scan: queue.length, unscanned_total: remaining ?? null };
  if (!queue.length) return { scanned: 0, hits: 0, unscanned_total: 0 };

  const results = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (cursor < queue.length) {
      const photo = queue[cursor++];
      const r = await scanOne(db, photo);
      if (r) results.push(r);
    }
  }));

  const hits = results.filter(r => r.logo_shot).length;
  console.log('[photo_logo_scan]', `scanned ${results.length}/${queue.length}, ${hits} logo shots,`,
    `${Math.max((remaining ?? queue.length) - results.length, 0)} still unscanned`);
  return {
    scanned: results.length,
    failed: queue.length - results.length,
    hits,
    unscanned_total: Math.max((remaining ?? queue.length) - results.length, 0),
  };
}
