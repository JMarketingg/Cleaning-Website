import { cleanAdClick } from './_lib/ad-click.js';
import { capName } from './_lib/name-case.js';
import { sendEmail } from './_lib/email.js';
import { serviceClient } from './_lib/supabase.js';
import { sendSMS, toE164 } from './_lib/sms.js';
import { overSpeedLimit, clientIp, isGibberish } from './_lib/lead-guard.js';
import { isBlockedPhone } from './_lib/blocked.js';
import { leadAlertRecipients } from './_lib/lead-alert-recipients.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const SITE_HOSTS = new Set(['tidyhausph.com', 'itidyhaus-com.translate.goog', 'www-itidyhaus-com.translate.goog', 'localhost', '127.0.0.1']);

const THROWAWAY = /@(?:[a-z0-9-]+\.)*(sigismail\.com|mailinator\.com|guerrillamail\.[a-z.]+|sharklasers\.com|grr\.la|10minutemail\.[a-z.]+|temp-?mail\.[a-z.]+|tempmail\.[a-z.]+|yopmail\.[a-z.]+|trashmail\.[a-z.]+|getnada\.com|nada\.email|dispostable\.com|maildrop\.cc|mailnesia\.com|mintemail\.com|throwawaymail\.com|fakeinbox\.com|emailnator\.com|mohmal\.com|burnermail\.io|spamgourmet\.com|mailcatch\.com|tempinbox\.com|tempr\.email|discard\.email|moakt\.[a-z.]+|1secmail\.[a-z.]+|cmail\.club)$/i;
const TOLL_FREE_AREAS = new Set(['800', '833', '844', '855', '866', '877', '888']);
const zipServed = (z) => { const n = Number(String(z).slice(0, 3)); return (n >= 750 && n <= 799) || n === 885 || (n >= 800 && n <= 816); };
const SERVICE_WORD = /tv|mount|hang|install|shelf|shelv|mirror|art|picture|frame|curtain|blind|furniture|assembl|handyman|repair|fix|soundbar|wire|cable|help|quote|estimate|price/i;
function junkReason({ email, phone, zipcode, message }) {
  if (email && THROWAWAY.test(email.trim())) return 'throwaway email';
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length !== 10 || !/[2-9]/.test(d[0]) || !/[2-9]/.test(d[3]) || TOLL_FREE_AREAS.has(d.slice(0, 3))) return 'bad phone';
  if (/^\d{5}$/.test(zipcode) && !zipServed(zipcode)) return 'zip outside area';
  const words = message.split(String.fromCharCode(10))[0].trim().split(/\s+/).filter(Boolean);
  if (words.length === 1 && /^[a-z]{3,15}$/i.test(words[0]) && !SERVICE_WORD.test(words[0])) return 'one random word';
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  const name = capName(String(body.name || [body.firstName, body.lastName].map((s) => String(s || '').trim()).filter(Boolean).join(' '))
    .trim().slice(0, 200));

  const originHeader = String(req.headers.origin || req.headers.referer || '');
  let fromSite = false;
  try {
    const host = new URL(originHeader).hostname.toLowerCase();
    fromSite = SITE_HOSTS.has(host) || host.endsWith('.tidyhausph.com');
  } catch {}
  const isHoneypot = String(body.hp_website || '').trim() !== '';
  const fillMs = typeof body.fillMs === 'number' && Number.isFinite(body.fillMs) ? body.fillMs : null;
  const tooFast = fillMs !== null && fillMs >= 0 && fillMs < 1500;
  const who = { name: name.slice(0, 80), phone: String(body.phone || '').trim().slice(0, 40) };
  if (!fromSite || isHoneypot || tooFast) {
    console.warn('[quote] blocked suspected bot submission', { fromSite, isHoneypot, tooFast, fillMs, originHeader, ...who });
    return res.status(200).json({ ok: true });
  }

  const phone = String(body.phone || '').trim().slice(0, 40);
  const email = String(body.email || '').trim().slice(0, 200);
  const zipcode = String(body.zipcode || '').trim().slice(0, 10);
  const service = String(body.service || '').trim().slice(0, 80);
  const city = String(body.location || '').trim().slice(0, 80);
  const tvSize = String(body['tv-size'] || body.tvSize || '').trim().slice(0, 40);
  const hasBracket = String(body['has-bracket'] || body.hasBracket || '').trim().slice(0, 40);
  const message = String(body.message || '').trim().slice(0, 4000);
  const pageUrl = String(body.pageUrl || '').trim().slice(0, 300);

  if (!name) return res.status(400).json({ error: 'Your name is required.' });
  if (!phone) return res.status(400).json({ error: 'A phone number is required.' });
  if (!message) return res.status(400).json({ error: 'Please tell us what you need help with.' });
  if (isGibberish(name) || /^[\d\s()+.-]+$/.test(message)) {
    console.warn('[quote] dropped junk submission', who);
    return res.status(200).json({ ok: true });
  }

  const junk = junkReason({ email, phone, zipcode, message });
  if (junk) {
    console.warn('[quote] dropped spam submission', { junk, ...who, email, zipcode });
    return res.status(200).json({ ok: true });
  }

  if (await isBlockedPhone(phone)) return res.status(200).json({ ok: true });
  const ip = clientIp(req);
  const repeatSender = overSpeedLimit('quote', { ip, email, phone });
  if (repeatSender) console.warn('[quote] over the speed limit — emailed only, not texted', { ip, ...who });

  const rows = [
    ['Name', name],
    ['Phone', phone],
    ['Email', email],
    ['Zip', zipcode],
    ['City', city],
    ['Service', service],
    ['TV size', tvSize],
    ['Has bracket', hasBracket],
    ['Page', pageUrl],
  ].filter((r) => r[1]);
  const tbl = rows
    .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-weight:600;white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:3px 0;color:#111;">${esc(v)}</td></tr>`)
    .join('');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#111;line-height:1.5;">
    <h2 style="margin:0 0 12px;">New quote request from tidyhausph.com</h2>
    <table style="border-collapse:collapse;">${tbl}</table>
    <p style="margin:14px 0 0;"><b>What they need:</b> ${esc(message)}</p>
  </div>`;

  let link = null;
  try {
    const db = serviceClient();
    const { data: biz } = await db.from('businesses').select('id').eq('slug', 'tidyhaus').maybeSingle();
    if (biz) {
      const ins = await db.from('estimates').insert({
        business_id: biz.id,
        service_label: service || 'Website quote',
        customer_name: name, customer_phone: phone, customer_email: email || null, customer_zip: zipcode || null, customer_city: city || null,
        description: [message, tvSize ? `TV: ${tvSize}` : '', hasBracket ? `Bracket: ${hasBracket}` : ''].filter(Boolean).join('\n').slice(0, 4000),
        notes: pageUrl ? `Quote form · ${pageUrl}` : 'Quote form',
        source: 'website_form', status: 'unsent', line_items: [], preferred_slots: [], sms_consent: !!phone, ad_click: cleanAdClick(body.ad_click || body.ha_click),
      }).select('id').single();
      if (ins.error) throw ins.error;
      link = `${(process.env.PUBLIC_URL || 'https://tidyhaus-crm.vercel.app').replace(/\/$/, '')}/admin.html?estimate=${encodeURIComponent(ins.data.id)}`;
    }
  } catch (e) { console.error('[quote] could not save estimate', e.message); }
  const smsText = [`New estimate request — ${name}`, link || message.slice(0, 140)].join('\n');

  let textTo = [];
  try { textTo = await leadAlertRecipients(serviceClient(), 'tidyhaus'); } catch (e) { console.error('[quote] recipients failed', e.message); }

  const results = await Promise.allSettled([
    sendEmail({
      slug: 'tidyhaus',
      to: 'owner@example.invalid',
      subject: repeatSender ? 'New estimate request (repeat sender, not texted)' : 'New estimate request',
      html,
    }),
    ...(repeatSender ? [] : textTo.map((r) => sendSMS(r.phone, smsText))),
  ]);

  const emailResult = results[0];
  if (emailResult.status === 'rejected') console.error('[quote] email failed:', emailResult.reason);
  else if (emailResult.value && emailResult.value.sent === false) console.error('[quote] email not sent:', emailResult.value.skipped || emailResult.value.error);

  return res.status(200).json({ ok: true });
}
