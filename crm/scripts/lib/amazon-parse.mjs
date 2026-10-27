
export const PLATE_MATCH = process.env.AMAZON_PLATE_MATCH
  ? new RegExp(process.env.AMAZON_PLATE_MATCH, 'i')
  : /brush\s+wall\s+plate|cable\s+pass[\s-]*through|low\s+voltage\s+mounting\s+bracket|(?:wire|cable|cord)[\s-]*(?:concealment|conceal|hider|pass[\s-]*through)|recessed\s+(?:cable|wire|media)\s+plate|in[\s-]?wall\s+(?:cable|wire|cord)/i;

export const PLATES_PER_UNIT = parseInt(process.env.PLATES_PER_UNIT) || 5;

const INVISIBLE_RE = /[​-‏‪-‮⁦-⁩﻿]/g;
export function stripInvisible(s) {
  return (s || '').replace(INVISIBLE_RE, '');
}

export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ');
}

export function extractOrderNum(text) {
  if (!text) return null;
  const m = text.match(/order\s*(?:number|#|id)?\s*:?\s*#?(\d{3}-\d{7}-\d{7})/i)
         || text.match(/\b(\d{3}-\d{7}-\d{7})\b/);
  return m ? m[1] : null;
}

export function extractUnits(text) {
  if (!text) return 0;
  const pm = text.match(PLATE_MATCH);
  if (pm && pm.index != null) {
    const after = text.slice(pm.index);
    const q = after.match(/(?:qty|quantity)\s*:?\s*(\d{1,3})/i);
    if (q) return parseInt(q[1], 10) || 1;
  }
  const im = text.match(/\b(\d{1,3})\s+items?\s+from\s+amazon/i);
  if (im && !/more item/i.test(text)) return parseInt(im[1], 10) || 1;
  return PLATE_MATCH.test(text) ? 1 : 0;
}

export function extractGenericItemCount(text) {
  if (!text) return 1;
  const clean = stripInvisible(text);
  const q = clean.match(/(?:qty|quantity)\s*:?\s*(\d{1,3})/i);
  if (q) return parseInt(q[1], 10) || 1;
  const items = clean.match(/\b(\d{1,3})\s+[A-Za-z&,\s]{0,40}?items?\b/i);
  if (items) return parseInt(items[1], 10) || 1;
  return 1;
}

export function detectStatus(subject, text) {
  const subj = (subject || '').toLowerCase();
  const body = (text || '').toLowerCase();
  if (/cancel(?:l?ed|lation)?\b|\brefund(?:ed)?\b|return\s+(?:initiated|complete)/i.test(subj + ' ' + body)) return 'canceled';
  if (/^\s*delivered\b/.test(subj)) return 'delivered';
  if (/^\s*ordered\b|thanks for your order|order confirmation|^\s*shipped\b|out for delivery|arriving/.test(subj)) return 'in_route';
  if (/\bwas delivered\b|has been delivered|delivered today|your package was delivered|package was left|delivery complete/i.test(body)) return 'delivered';
  return 'in_route';
}

export function extractOrderUrl(text) {
  if (!text) return null;
  const urls = [...(text.matchAll(/https?:\/\/[^\s<>"')]+/gi) || [])].map(m => m[0]);
  return urls.find(u => /amazon\.[a-z.]+\/.*(?:order|gp\/css|your-orders)/i.test(u))
      || urls.find(u => /amazon\.[a-z.]+/i.test(u))
      || urls.find(u => /amzn\.to/i.test(u))
      || null;
}

export function extractOrderDate(text, todayISO) {
  const today = todayISO || new Date().toISOString().slice(0, 10);
  if (!text) return today;
  const m = text.match(/order\s*(?:date|placed)\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i)
         || text.match(/order\s*(?:date|placed)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (m) {
    const d = new Date(m[1]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return today;
}

export function parseAmazonPlateEmail({ subject = '', text = '', html = '', todayISO, trustSender = false } = {}) {
  const bodyRaw = (text && text.trim()) ? text : stripHtml(html);
  const body = stripInvisible(bodyRaw);
  const hay = stripInvisible((subject || '') + '\n' + body);
  const productMatch = PLATE_MATCH.test(hay);
  if (!productMatch && !trustSender) return null;
  const orderNum = extractOrderNum(hay);
  if (!orderNum) return null;

  const units = productMatch
    ? Math.max(0, extractUnits(body) || (PLATE_MATCH.test(body) ? 1 : 0))
    : extractGenericItemCount(hay);
  if (units <= 0) return null;

  const status = detectStatus(subject, body);
  return {
    amazon_order_num: orderNum,
    units,
    plates: units * PLATES_PER_UNIT,
    status,
    order_date: extractOrderDate(body, todayISO),
    delivered_date: status === 'delivered' ? (todayISO || new Date().toISOString().slice(0, 10)) : null,
    order_url: extractOrderUrl(body) || extractOrderUrl(html),
  };
}
