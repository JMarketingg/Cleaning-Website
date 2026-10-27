import { resolveLocation } from './gmb-locations.mjs';

export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, ' ');
}

function detectBusiness(text) {
  const s = (text || '').toLowerCase();
  if (/\ba1\s*tv\s*mounting\b/.test(s)) return 'a1tvmounting';
  if (/dom'?s\b|doms\b/.test(s)) return 'doms';
  if (/handy\s*andy/.test(s)) return 'tidyhaus';
  return null;
}

export function parseGoogleReviewEmail({ subject = '', text = '', html = '', emailDateISO, mailbox = null } = {}) {
  const body = (text && text.trim()) ? text : stripHtml(html);
  const hay = `${subject}\n${body}`;

  if (!/left a review for|you got a new|new\s+\d\s*[-‑]?\s*star\s+review/i.test(hay)) return null;

  const rm = hay.match(/(\d)\s*[-‑]?\s*star/i);
  const rating = rm ? parseInt(rm[1], 10) : null;
  if (!rating || rating < 1 || rating > 5) return null;

  const bm = subject.match(/left a review for\s+(.+)$/i);
  const gbp_display_name = bm ? bm[1].trim().replace(/\s+/g, ' ') : null;
  const business = detectBusiness(bm ? bm[1] : hay);
  if (!business) return null;

  let reviewer = null;
  const nm = subject.match(/^\s*(.+?)\s+left a review/i);
  if (nm) reviewer = nm[1].trim();
  if (reviewer) {
    const esc = reviewer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fuller = body.match(new RegExp('\\b(' + esc + "(?:[ '\\-][A-Za-z]+){0,3})", 'i'));
    if (fuller && fuller[1].trim().length > reviewer.length) {
      reviewer = fuller[1].trim().replace(/\s+/g, ' ');
    }
  }

  let review_text = null;
  const replyIdx = body.search(/reply to (?:the )?review/i);
  if (replyIdx > 0 && reviewer) {
    const before = body.slice(0, replyIdx);
    const nameIdx = before.toLowerCase().lastIndexOf(reviewer.toLowerCase());
    if (nameIdx >= 0) {
      const t = before.slice(nameIdx + reviewer.length).replace(/\s+/g, ' ').trim();
      if (t && t.length <= 1200) review_text = t;
    }
  }

  const review_date = (emailDateISO || new Date().toISOString()).slice(0, 10);

  const snippet = (review_text || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  const google_key = `${business}:${(reviewer || '').toLowerCase()}:${rating}:${snippet}`;

  const location = resolveLocation({ business, mailbox, displayName: gbp_display_name });

  return {
    business, reviewer_name: reviewer, rating, review_text, review_date, google_key,
    gbp_display_name,
    source_mailbox: mailbox || null,
    location_key: location ? location.key : null,
    location_cid: location ? location.cid : null,
  };
}
