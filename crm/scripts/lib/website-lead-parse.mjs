
const FIELD_LABELS = ['name', 'email', 'phone', 'zipcode', 'zip', 'message', 'analyticsid'];

export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<(?:style|script)[^>]*>[\s\S]*?<\/(?:style|script)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ');
}

export function parseFields(text) {
  const out = {};
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  let current = null, buf = [];
  const flush = () => {
    if (current) out[current] = buf.join('\n').trim();
    buf = [];
  };
  for (const line of lines) {
    const m = /^\s*([A-Za-z ]{2,20}?)\s*:\s*(.*)$/.exec(line);
    const label = m ? m[1].trim().toLowerCase().replace(/\s+/g, '') : null;
    if (label && FIELD_LABELS.includes(label)) {
      flush();
      current = label === 'zip' ? 'zipcode' : label;
      if (m[2].trim()) buf.push(m[2].trim());
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d.length === 10 ? d : String(raw || '').trim();
}

export function isWebsiteLeadEmail({ from = '', subject = '', text = '', html = '' } = {}) {
  const body = (text && text.trim()) ? text : stripHtml(html);
  if (/landingsite\.ai/i.test(from)) return true;
  if (/new customer message from/i.test(subject)) return true;
  return /(^|\n)\s*analyticsId\s*:/i.test(body) && /(^|\n)\s*message\s*:/i.test(body);
}

export function parseWebsiteLeadEmail({ from = '', subject = '', text = '', html = '', messageId = '', receivedISO = '' } = {}) {
  if (!isWebsiteLeadEmail({ from, subject, text, html })) return null;
  const body = (text && text.trim()) ? text : stripHtml(html);
  const f = parseFields(body);

  const email = (f.email || '').trim().toLowerCase()
    || (/(new customer message from)\s+(\S+@\S+)/i.exec(subject || '')?.[2] || '').toLowerCase();
  const phone = normalizePhone(f.phone);
  const message = (f.message || '').trim();

  if (!message) return null;
  if (!email && !phone) return null;

  return {
    external_key: (messageId || '').trim() || null,
    name: (f.name || '').trim().slice(0, 120) || 'Website visitor',
    email: email.slice(0, 200) || null,
    phone: phone ? String(phone).slice(0, 40) : null,
    zip: (f.zipcode || '').trim().slice(0, 10) || null,
    message: message.slice(0, 4000),
    analytics_id: (f.analyticsid || '').trim().slice(0, 60) || null,
    received_at: receivedISO || null,
  };
}
