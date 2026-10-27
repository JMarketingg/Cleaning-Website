
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
  const m = text.match(/order\s*(?:number|#)\s*:?\s*#?(\d{7}-\d{8})/i)
         || text.match(/#?\b(\d{7}-\d{8})\b/);
  return m ? m[1] : null;
}

export function extractBrackets(text) {
  let flat = 0, tilting = 0, fullMotion = 0;
  const add = (typeWord, qty) => {
    const t = typeWord.toLowerCase().replace(/[\s-]/g, '');
    if (t === 'fullmotion') fullMotion += qty;
    else if (t === 'tilting') tilting += qty;
    else if (t === 'fixed' || t === 'flat') flat += qty;
  };

  const re = /quantity\s+(\d+)\s+item\b[\s\S]{0,80}?\b(full[\s-]?motion|tilting|fixed|flat)\b/gi;
  let m, hits = 0;
  while ((m = re.exec(text))) { add(m[2], parseInt(m[1], 10) || 1); hits++; }
  if (hits) return { flat, tilting, fullMotion };

  const re2 = /\b(full[\s-]?motion|tilting|fixed|flat)\b[^\n]{0,40}?\bwall mount\b/gi;
  while ((m = re2.exec(text))) add(m[1], 1);
  return { flat, tilting, fullMotion };
}

export function detectStatus(subject, text) {
  const s = ((subject || '') + ' ' + (text || '')).toLowerCase();
  if (/cancel(?:l?ed|lation)?\b/i.test(s)) return 'canceled';
  if (/\bdelivered\b|has been delivered|was delivered|delivery complete|package (?:has )?arrived|completed your delivery/i.test(s)) return 'delivered';
  return 'in_route';
}

export function extractOrderUrl(text) {
  if (!text) return null;
  const urls = [...text.matchAll(/https?:\/\/[^\s<>"')]+/gi)].map(m => m[0]);
  return urls.find(u => /walmart\.com\/orders/i.test(u))
      || urls.find(u => /w-mt\.co/i.test(u))
      || null;
}

export function extractDeliveryAddress(text) {
  if (!text) return null;
  const m = text.match(/(\d{1,6}\s+[A-Za-z][A-Za-z0-9.\-#/ ]{1,49}?(?:,\s*(?:[A-Za-z]{1,8}\.?\s*)?#?\d[A-Za-z0-9\- ]{0,8})?,\s*[A-Za-z .'\-]{2,40}?,\s*[A-Z]{2}\.?,?\s*\d{5}(?:-\d{4})?)/);
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim().replace(/,\s*$/, '');
}

export function extractOrderTotal(text) {
  if (!text) return null;
  const m = text.match(/includes all fees[^$]*\$\s*([\d,]+\.\d{2})/i)
         || text.match(/order\s*total[^$]{0,60}?\$\s*([\d,]+\.\d{2})/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

export function extractArrivesDate(text, orderISO) {
  if (!text) return null;
  const m = text.match(/(?:arriv(?:es|ing)|estimated\s+delivery|expected\s+delivery|delivery\s+(?:by|date))\b[^A-Za-z0-9]{0,6}(?:[A-Za-z]{3,9}\.?,?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (!m) return null;
  const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  const mon = months[m[1].slice(0, 3).toLowerCase()];
  if (mon == null) return null;
  const day = parseInt(m[2], 10);
  if (!(day >= 1 && day <= 31)) return null;
  const base = orderISO && /^\d{4}-\d{2}-\d{2}$/.test(orderISO) ? orderISO : new Date().toISOString().slice(0, 10);
  let year = m[3] ? parseInt(m[3], 10) : parseInt(base.slice(0, 4), 10);
  if (!m[3]) {
    const orderMon = parseInt(base.slice(5, 7), 10) - 1;
    if (mon < orderMon - 1) year += 1;
  }
  const d = new Date(Date.UTC(year, mon, day));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function extractOrderDate(text, todayISO) {
  const today = todayISO || new Date().toISOString().slice(0, 10);
  if (!text) return today;
  const m = text.match(/order\s*date\s*:?\s*([A-Za-z]{3,9},?\s+[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i)
         || text.match(/order\s*date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (m) {
    const d = new Date(m[1]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return today;
}

export function parseWalmartEmails({ subject = '', text = '', html = '', todayISO } = {}) {
  const body = (text && text.trim()) ? text : stripHtml(html);
  const today = todayISO || new Date().toISOString().slice(0, 10);

  const markerRe = /order\s*(?:number|#)\s*:?\s*#?(\d{7}-\d{8})/gi;
  const markers = [];
  let m;
  while ((m = markerRe.exec(body))) markers.push({ num: m[1], index: m.index });

  if (!markers.length) {
    const num = extractOrderNum(subject + '\n' + body);
    if (!num) return [];
    markers.push({ num, index: 0 });
  }

  const out = [];
  for (let i = 0; i < markers.length; i++) {
    const seg = body.slice(markers[i].index, (i + 1 < markers.length) ? markers[i + 1].index : body.length);
    const { flat, tilting, fullMotion } = extractBrackets(seg);
    const status = detectStatus(subject, seg);
    const orderDate = extractOrderDate(seg, today);
    out.push({
      walmart_order_num: markers[i].num,
      flat_qty: flat,
      tilting_qty: tilting,
      full_motion_qty: fullMotion,
      status,
      order_date: orderDate,
      estimated_delivery: extractArrivesDate(seg, orderDate) || extractArrivesDate(body, orderDate),
      delivered_date: status === 'delivered' ? today : null,
      order_url: extractOrderUrl(seg) || extractOrderUrl(html),
      delivery_address: extractDeliveryAddress(seg) || extractDeliveryAddress(body),
      order_total: extractOrderTotal(seg) || extractOrderTotal(body),
    });
  }
  return out;
}

export function parseWalmartEmail(input) {
  const all = parseWalmartEmails(input);
  return all.length ? all[0] : null;
}
