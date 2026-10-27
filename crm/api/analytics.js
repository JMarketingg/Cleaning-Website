import { startTranscript, finishTranscript } from './_lib/transcribe.js';
import { serviceClientPublic, serviceClient } from './_lib/supabase.js';
import { verifyToken, signToken } from './_lib/auth.js';
import { sendSMS, sendSMSResult, smsBrandName, TIDYHAUS_SMS_BRAND, SMS_STOP_RE, SMS_START_RE, smsOptOutState, logAutomatedMessage } from './_lib/sms.js';
import { smsNotificationsOn } from './_lib/notify.js';
import { demoMode } from './_lib/demo.js';
import { isBotUserAgent } from './_lib/bot-filter.js';
import crypto from 'crypto';
import { pushRing } from './_lib/ring-push.js';
import { isTollFree } from './_lib/blocked.js';
import { dateIn, exceptionsOn, applyExceptions } from './_lib/schedule-exceptions.js';

function ringPayload(line, from, sid) {
  return { phone: from || null, line: line?.label || null, business: line?.business_slug || null, market: line?.market || null, sid: sid || null, at: Date.now() };
}

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const TZ = 'Asia/Manila';
const BOOKING_STEPS = [
  { key: 'zip',       label: 'ZIP Check' },
  { key: 'frame_tv',  label: 'TV Type' },
  { key: 'size',      label: 'TV Size' },
  { key: 'bracket',   label: 'Bracket' },
  { key: 'fireplace', label: 'Fireplace' },
  { key: 'surface',   label: 'Wall Surface' },
  { key: 'wires',     label: 'Wire Hiding' },
  { key: 'lifting',   label: 'Lifting Help' },
  { key: 'dismount',  label: 'Dismount Offer' },
  { key: 'extras',    label: 'Add-ons' },
  { key: 'terms',     label: 'Terms' },
  { key: 'slots',     label: 'Date & Time' },
  { key: 'customer',  label: 'Checkout' },
];
const HANDYMAN_STEPS = [
  { key: 'service',  label: 'Service' },
  { key: 'describe', label: 'Describe Job' },
  { key: 'photo',    label: 'Photo' },
  { key: 'times',    label: 'Preferred Times' },
  { key: 'contact',  label: 'Contact Info' },
];
const STEP_ALIAS = { zip_verify: 'zip' };

function stepConfigFor(widget) {
  const STEPS = String(widget).endsWith('-handyman') ? HANDYMAN_STEPS : BOOKING_STEPS;
  const index = {};
  STEPS.forEach((s, i) => { index[s.key] = i; });
  const stepIndexOf = (name) => {
    if (!name) return -1;
    const k = STEP_ALIAS[name] || name;
    return index[k] ?? -1;
  };
  return { STEPS, stepIndexOf, lastStepIdx: STEPS.length - 1 };
}

function parseBrowser(ua) {
  if (!ua) return 'unknown';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'other';
}

function tzHour(ts) {
  return Number(new Date(ts).toLocaleString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false })) % 24;
}
function tzDow(ts) {
  return new Date(ts).toLocaleString('en-US', { timeZone: TZ, weekday: 'short' });
}
function tzDate(ts) {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: TZ });
}
function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function round1(n) { return Math.round(n * 10) / 10; }

export function verifyTwilioSignature(url, params, signature) {
  if (!signature || !process.env.TWILIO_AUTH_TOKEN) return false;
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  const expected = crypto.createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(data, 'utf8').digest('base64');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleTwilioStatus(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  try {
    const rawBody = await readRawBody(req);
    const params = Object.fromEntries(new URLSearchParams(rawBody));
    const token = (req.query.token || '').toString();
    const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const url = `${base}/api/analytics?action=sms_status&token=${encodeURIComponent(token)}`;
    if (!verifyTwilioSignature(url, params, req.headers['x-twilio-signature'])) {
      console.warn('[sms_status] signature verification failed');
      return res.status(200).send('ok');
    }
    const t = verifyToken(token);
    try {
      const sid = (params.MessageSid || '').toString();
      const mstatus = (params.MessageStatus || '').toLowerCase();
      if (sid && (mstatus === 'delivered' || mstatus === 'failed' || mstatus === 'undelivered')) {
        await serviceClient().from('messages').update({ status: mstatus }).eq('twilio_sid', sid);
      }
    } catch (e) { console.warn('[sms_status] messages-table status update failed:', e.message); }
    if (t && t.booking_id && (t.kind === 'review' || !t.kind)) {
      const status = (params.MessageStatus || '').toLowerCase();
      const db = serviceClient();
      if (status === 'delivered') {
        await db.from('bookings')
          .update({ review_sms_delivered_at: new Date().toISOString(), review_sms_status: 'delivered' })
          .eq('id', t.booking_id).is('review_sms_delivered_at', null);
      } else if (status === 'failed' || status === 'undelivered') {
        await db.from('bookings').update({ review_sms_status: status }).eq('id', t.booking_id);
      }
    } else if (t && t.kind === 'on_the_way' && t.booking_id) {
      const status = (params.MessageStatus || '').toLowerCase();
      const db = serviceClient();
      if (status === 'delivered') {
        await db.from('bookings')
          .update({ on_the_way_sms_delivered_at: new Date().toISOString(), on_the_way_sms_status: 'delivered' })
          .eq('id', t.booking_id).is('on_the_way_sms_delivered_at', null);
      } else if (status === 'failed' || status === 'undelivered') {
        await db.from('bookings').update({ on_the_way_sms_status: status }).eq('id', t.booking_id);
      }
    } else if (t && t.kind === 'tech_sms' && t.tech_sms_log_id) {
      const status = (params.MessageStatus || '').toLowerCase();
      const db = serviceClient();
      if (status === 'delivered') {
        await db.from('tech_sms_log')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', t.tech_sms_log_id).is('delivered_at', null);
      } else if (status === 'failed' || status === 'undelivered') {
        const errCode = (params.ErrorCode || '').toString();
        await db.from('tech_sms_log')
          .update({ status, error: errCode ? `Twilio ErrorCode ${errCode}` : null })
          .eq('id', t.tech_sms_log_id);
      }
    } else if (t && t.kind === 'message' && t.message_id) {
      const status = (params.MessageStatus || '').toLowerCase();
      const db = serviceClient();
      if (status === 'delivered' || status === 'sent') {
        await db.from('messages').update({ status }).eq('id', t.message_id);
      } else if (status === 'failed' || status === 'undelivered') {
        const errCode = (params.ErrorCode || '').toString();
        await db.from('messages')
          .update({ status, error: errCode ? `Twilio ErrorCode ${errCode}` : 'Carrier did not deliver' })
          .eq('id', t.message_id);
        if (errCode === '30034') await rescueUnregisteredAutoText(db, t.message_id);
      }
    }
  } catch (e) {
    console.error('[sms_status] error:', e.message);
  }
  return res.status(200).send('ok');
}

function verifySvixSignature({ id, timestamp, rawBody, signatureHeader, secret }) {
  if (!id || !timestamp || !signatureHeader || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${rawBody}`, 'utf8').digest('base64');
  const expectedBuf = Buffer.from(expected, 'base64');
  return signatureHeader.split(' ').some((entry) => {
    const sig = entry.includes(',') ? entry.split(',')[1] : entry;
    if (!sig) return false;
    const sigBuf = Buffer.from(sig, 'base64');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

async function handleResendWebhook(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  try {
    const rawBody = await readRawBody(req);
    const secrets = [
      process.env.RESEND_WEBHOOK_SECRET,
      process.env.DOMS_RESEND_WEBHOOK_SECRET,
      process.env.RESEND_WEBHOOK_SECRET_Handy_Andy,
      process.env.RESEND_WEBHOOK_SECRET_Doms,
    ].filter(Boolean);
    const verified = secrets.some((secret) => verifySvixSignature({
      id: req.headers['svix-id'], timestamp: req.headers['svix-timestamp'],
      rawBody, signatureHeader: req.headers['svix-signature'], secret,
    }));
    if (!verified) {
      console.warn('[email_webhook] signature verification failed (or no secret configured)');
      return res.status(200).send('ok');
    }
    const payload = JSON.parse(rawBody);
    const emailId = payload?.data?.email_id;
    const type = payload?.type;
    if (emailId && type) {
      const db = serviceClient();
      if (type === 'email.delivered') {
        await db.from('estimates').update({ email_status: 'delivered' }).eq('email_id', emailId).neq('email_status', 'bounced');
        await db.from('bookings')
          .update({ review_email_delivered_at: new Date().toISOString(), review_email_status: 'delivered' })
          .eq('review_email_id', emailId).is('review_email_delivered_at', null);
      } else if (type === 'email.bounced') {
        await db.from('bookings').update({ review_email_status: 'bounced' }).eq('review_email_id', emailId);
        await db.from('estimates').update({ email_status: 'bounced', email_bounced_at: new Date().toISOString() }).eq('email_id', emailId);
      } else if (type === 'email.complained') {
        await db.from('bookings').update({ review_email_status: 'complained' }).eq('review_email_id', emailId);
      }
    }
  } catch (e) {
    console.error('[email_webhook] error:', e.message);
  }
  return res.status(200).send('ok');
}

export function xml(res, twiml) {
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>${twiml}`);
}
export function xmlEsc(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}
function publicBase() {
  return process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}
function voiceUrl(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  return `${publicBase()}/api/analytics?${qs}`;
}
function tenDigits(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

async function twilioVoiceParams(req, res, action, extraQuery = {}) {
  const rawBody = await readRawBody(req);
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const sig = req.headers['x-twilio-signature'];
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0];
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0];
  const candidates = [voiceUrl(action, extraQuery)];
  if (host) candidates.push(`${proto}://${host}${req.url}`);
  if (!candidates.some(u => verifyTwilioSignature(u, params, sig))) {
    console.warn(`[${action}] signature verification failed; tried ${candidates.join(' , ')}`);
    xml(res, '<Response><Reject/></Response>');
    return null;
  }
  return params;
}

function voicemailTwiml(sid) {
  const done = voiceUrl('voice_recording', { sid });
  return '<Response>'
    + '<Say voice="Polly.Joanna">Sorry we missed you. Please leave your name, number and what you need after the tone, and we will call you right back.</Say>'
    + `<Record maxLength="120" playBeep="true" timeout="4" transcribe="true" transcribeCallback="${xmlEsc(done)}" action="${xmlEsc(done)}" method="POST"/>`
    + '<Say voice="Polly.Joanna">We did not get a message. Goodbye.</Say>'
    + '</Response>';
}

async function handleVoiceWhisper(req, res) {
  const sid = (req.query.sid || '').toString();
  const label = (req.query.label || '').toString();
  const params = await twilioVoiceParams(req, res, 'voice_whisper', { label, sid });
  if (!params) return;
  if (!label) return xml(res, '<Response/>');
  return xml(res, `<Response><Say voice="Polly.Joanna">${xmlEsc(label)}</Say></Response>`);
}

const SECRETARY_HANDSETS = { '0000000000': 'tidyhaus', '0000000000': 'doms' };
const DOW_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
async function applyShiftRouting(db, line) {
  if (!line || !line.route_team) return line;
  try {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: line.hours_timezone || 'Asia/Manila', weekday: 'short' }).format(new Date());
    const dow = DOW_SHORT[wd];
    if (dow == null) return line;
    const { data, error } = await db.from('staff_schedules').select('name, phone, priority')
      .eq('business_slug', line.route_team).eq('day_of_week', dow).not('phone', 'is', null)
      .order('priority', { ascending: true }).order('name', { ascending: true });
    if (error) throw new Error(error.message);
    const exc = await exceptionsOn(db, dateIn(line.hours_timezone || 'Asia/Manila'));
    const p = applyExceptions(data, exc, line.route_team).find(r => tenDigits(r.phone).length === 10);
    const ownerDigits = tenDigits(process.env.OWNER_PHONE_NUMBER || '');
    const fallback = line.after_hours_forward_to || (ownerDigits.length === 10 ? '+1' + ownerDigits : null);
    return { ...line, forward_to: p ? '+1' + tenDigits(p.phone) : (fallback || line.forward_to) };
  } catch (e) {
    console.error('[shift_routing] failed (keeps the line\'s own forward_to):', e.message);
    return line;
  }
}

async function applyTimeOff(db, line) {
  if (!line) return line;
  line = await applyShiftRouting(db, line);
  const slug = SECRETARY_HANDSETS[tenDigits(line.forward_to)];
  const ownerDigits = tenDigits(process.env.OWNER_PHONE_NUMBER || '');
  const ownerTo = line.after_hours_forward_to || (ownerDigits.length === 10 ? '+1' + ownerDigits : null);
  if (!slug || !ownerTo) return line;
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: line.hours_timezone || 'Asia/Manila' });
    const { data: biz } = await db.from('businesses').select('id').eq('slug', slug).maybeSingle();
    if (!biz) return line;
    const { data: ex } = await db.from('secretary_availability_exceptions')
      .select('is_available').eq('business_id', biz.id).eq('exception_date', today).maybeSingle();
    if (ex && ex.is_available === false) {
      console.log(`[time_off] ${line.phone}: ${slug} secretary off ${today}, ringing owner`);
      return { ...line, forward_to: ownerTo };
    }
  } catch (e) {
    console.error('[time_off] check failed (keeps normal routing):', e.message);
  }
  return line;
}

function destinationFor(line) {
  if (!line) return null;
  const primary = line.forward_to || null;
  if (!line.after_hours_forward_to || !line.hours_timezone) return primary;

  let hour;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: line.hours_timezone, hourCycle: 'h23', hour: '2-digit',
    }).formatToParts(new Date());
    hour = parseInt((parts.find(p => p.type === 'hour') || {}).value, 10);
  } catch (e) {
    console.error(`[voice_inbound] bad hours_timezone "${line.hours_timezone}" on ${line.phone}:`, e.message);
    return primary;
  }
  if (!Number.isInteger(hour)) return primary;

  const open = Number(line.hours_start), close = Number(line.hours_end);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return primary;
  return (hour >= open && hour < close) ? primary : line.after_hours_forward_to;
}

export const ROUTE_LINE_COLUMNS = 'phone, label, business_slug, market, forward_to, ring_seconds, record_calls, active, after_hours_forward_to, hours_start, hours_end, hours_timezone, ivr_gate_enabled, ai_bot_enabled, route_team';
export async function routeNow(db, line) {
  if (!line || !line.active) return { rings: null, reason: 'inactive' };
  if (line.ai_bot_enabled) return { rings: null, reason: 'AI bot' };
  const shifted = await applyShiftRouting(db, line);
  const final = await applyTimeOff(db, line);
  const rings = destinationFor(final);
  if (!rings) return { rings: null, reason: 'voicemail' };
  const ownerDigits = tenDigits(process.env.OWNER_PHONE_NUMBER || '');
  const fallback = tenDigits(line.after_hours_forward_to || (ownerDigits.length === 10 ? '+1' + ownerDigits : ''));
  let reason = 'scheduled';
  if (tenDigits(rings) !== tenDigits(final.forward_to)) reason = 'after hours';
  else if (tenDigits(final.forward_to) !== tenDigits(shifted.forward_to)) reason = 'time off';
  else if (line.route_team && fallback && tenDigits(shifted.forward_to) === fallback) reason = 'nobody scheduled';
  else if (!line.route_team) reason = 'fixed';
  return { rings, reason };
}

function dialTwiml(line, callerFrom, sid, actionExtra = {}) {
  const dialTo = destinationFor(line);
  if (!line || !dialTo) return voicemailTwiml(sid);

  const action = voiceUrl('voice_status', { sid, ...actionExtra });
  const rec = line.record_calls ? ' record="record-from-answer-dual"' : '';
  const recStatusCb = line.record_calls
    ? ` recordingStatusCallback="${xmlEsc(voiceUrl('voice_recording', { sid }))}" recordingStatusCallbackEvent="completed"`
    : '';
  const caLine = /los angeles|california/i.test(String(line.market || '')) || /^(213|310|323|424|562|626|657|661|714|747|760|805|818|858|909|916|949|951|415|510|408|650|619)/.test(tenDigits(line.phone || ''));
  const disclosure = line.record_calls && caLine
    ? '<Say voice="Polly.Joanna">This call may be recorded for quality and training purposes.</Say>'
    : '';
  const whisper = voiceUrl('voice_whisper', { label: line.label || '', sid });
  return `<Response>${disclosure}<Dial timeout="${Number(line.ring_seconds) || 20}" answerOnBridge="true" callerId="${xmlEsc(callerFrom || '')}" action="${xmlEsc(action)}" method="POST"${rec}${recStatusCb}><Number url="${xmlEsc(whisper)}" method="POST">${xmlEsc(dialTo)}</Number></Dial></Response>`;
}

function ivrGateTwiml(sid) {
  const action = voiceUrl('voice_gather', { sid });
  return '<Response><Gather numDigits="1" timeout="8" action="' + xmlEsc(action) + '" method="POST">'
    + '<Say voice="Polly.Joanna">Please press 1 to continue.</Say>'
    + '</Gather><Say voice="Polly.Joanna">We did not get a response. Goodbye.</Say><Hangup/></Response>';
}

async function isSilentNumber(db, phone) {
  if (!phone) return false;
  try {
    const { data } = await db.from('silent_numbers').select('id').eq('phone', phone).maybeSingle();
    return !!data;
  } catch (e) {
    console.error('[silent_numbers] lookup failed:', e.message);
    return false;
  }
}

async function logCallRow(db, { line, from, to, sid, blocked }) {
  if (isTollFree(from)) return;
  let business_id = null;
  if (line && line.business_slug) {
    const { data: biz } = await db.from('businesses').select('id').eq('slug', line.business_slug).maybeSingle();
    business_id = biz?.id || null;
  }
  let customer_id = null;
  if (from) {
    const { data: c } = await db.from('customers').select('id').eq('phone', from).limit(1);
    customer_id = (c || [])[0]?.id || null;
  }
  await db.from('calls').insert({
    business_id,
    source: 'twilio',
    kind: 'inbound',
    caller_phone: from || 'unknown',
    grasshopper_number: to || null,
    tracking_label: line?.label || null,
    market: line?.market || null,
    forwarded_to: destinationFor(line),
    twilio_call_sid: sid,
    occurred_at: new Date().toISOString(),
    customer_id,
    status: blocked ? 'ignored' : 'new',
    handled_by: blocked ? 'Blocked number' : null,
    handled_at: blocked ? new Date().toISOString() : null,
    warnings: blocked ? ['Blocked number — call was rejected before ringing'] : (line ? null : ['Number is not in tracking_numbers - call still connected']),
  });
}

async function handleVoiceInbound(req, res) {
  const params = await twilioVoiceParams(req, res, 'voice_inbound');
  if (!params) return;
  const sid = params.CallSid || '';
  const from = tenDigits(params.From);
  const to = tenDigits(params.To);
  let line = null;
  let blocked = false;
  try {
    const db = serviceClient();
    const { data } = await db.from('tracking_numbers')
      .select('phone, label, business_slug, market, forward_to, ring_seconds, record_calls, active, after_hours_forward_to, hours_start, hours_end, hours_timezone, ivr_gate_enabled, ai_bot_enabled, route_team')
      .eq('phone', to).maybeSingle();
    line = await applyTimeOff(db, data && data.active ? data : null);

    if (from) {
      const { data: b } = await db.from('blocked_numbers').select('id').eq('phone', from).maybeSingle();
      blocked = !!b;
    }

    if (await isSilentNumber(db, from)) return finishVoiceInbound(res, line, params, sid, blocked);

    if (line && line.ivr_gate_enabled && !blocked && !line.ai_bot_enabled) {
      return finishVoiceInbound(res, line, params, sid, blocked);
    }

    const dest = !blocked && line && !line.ai_bot_enabled && !isTollFree(from) ? destinationFor(line) : null;
    await Promise.all([logCallRow(db, { line, from, to, sid, blocked }), dest ? pushRing(dest, ringPayload(line, from, sid)) : null]);
  } catch (e) {
    console.error('[voice_inbound] log failed:', e.message);
  }

  return finishVoiceInbound(res, line, params, sid, blocked);
}

function finishVoiceInbound(res, line, params, sid, blocked) {
  if (blocked) return xml(res, '<Response><Reject/></Response>');

  if (line && line.ai_bot_enabled) return xml(res, '<Response><Redirect method="POST">' + xmlEsc(voiceUrl('voice_bot_start', { sid })) + '</Redirect></Response>');

  if (line && line.ivr_gate_enabled) return xml(res, ivrGateTwiml(sid));
  return xml(res, dialTwiml(line, params.From, sid));
}

async function handleVoiceGather(req, res) {
  const sid = (req.query.sid || '').toString();
  const params = await twilioVoiceParams(req, res, 'voice_gather', { sid });
  if (!params) return;
  const from = tenDigits(params.From);
  const to = tenDigits(params.To);
  let line = null;
  const db = serviceClient();
  try {
    const { data } = await db.from('tracking_numbers')
      .select('phone, label, business_slug, market, forward_to, ring_seconds, record_calls, active, after_hours_forward_to, hours_start, hours_end, hours_timezone, route_team')
      .eq('phone', to).maybeSingle();
    line = await applyTimeOff(db, data && data.active ? data : null);
  } catch (e) {
    console.error('[voice_gather] line lookup failed:', e.message);
  }
  if (!/^[0-9*#]$/.test((params.Digits || '').toString())) {
    return xml(res, '<Response><Hangup/></Response>');
  }
  try {
    const dest = line && !isTollFree(from) ? destinationFor(line) : null;
    await Promise.all([
      (async () => { if (!(await isSilentNumber(db, from))) await logCallRow(db, { line, from, to, sid, blocked: false }); })(),
      dest ? pushRing(dest, ringPayload(line, from, sid)) : null,
    ]);
  } catch (e) {
    console.error('[voice_gather] log failed:', e.message);
  }
  return xml(res, dialTwiml(line, params.From, sid));
}

async function handleVoiceStatus(req, res) {
  const sid = (req.query.sid || '').toString();
  const bk = req.query.bk ? '1' : '';
  const params = await twilioVoiceParams(req, res, 'voice_status', bk ? { sid, bk } : { sid });
  if (!params) return;
  const status = (params.DialCallStatus || '').toLowerCase();
  const answered = status === 'completed';
  if (!answered && !bk && MISSED_DIAL_STATUSES.has(status) && (params.CallStatus || '').toLowerCase() === 'in-progress') {
    const twiml = await backupDialTwiml(params, sid, status);
    if (twiml) return xml(res, twiml);
  }
  const dur = parseInt(params.DialCallDuration, 10);
  if (!answered) console.log(`[voice_status] ${sid.slice(-6)} dial ${status || 'unknown'} after ${Number.isFinite(dur) ? dur + 's' : '?'}`);
  try {
    const db = serviceClient();
    await db.from('calls').update({
      answered,
      ...(!answered && status ? { warnings: [`Forward result: ${status}`] } : {}),
      duration_sec: Number.isFinite(dur) ? dur : null,
      ...(params.RecordingUrl ? { recording_url: params.RecordingUrl, has_recording: true } : {}),
      ...(answered ? { status: 'resolved', handled_by: 'Answered', handled_at: new Date().toISOString() } : {}),
    }).eq('twilio_call_sid', sid);
  } catch (e) {
    console.error('[voice_status] update failed:', e.message);
  }
  if (!answered) await missedCallTextAfterDial(params, status);
  if (answered) return xml(res, '<Response><Hangup/></Response>');
  return xml(res, voicemailTwiml(sid));
}

const BACKUP_RING = [{ name: 'Joe', backup: 'Joey', backupPhone: '0000000000' }];
async function backupDialTwiml(params, sid, status) {
  try {
    const db = serviceClient();
    const { data: call } = await db.from('calls').select('id, forwarded_to, warnings').eq('twilio_call_sid', sid).maybeSingle();
    const dialed = tenDigits(call && call.forwarded_to);
    if (!call || dialed.length !== 10) return null;
    const { data: sched } = await db.from('staff_schedules').select('name, phone').in('name', BACKUP_RING.map(p => p.name));
    const hit = (sched || []).find(r => tenDigits(r.phone) === dialed);
    const pair = hit && BACKUP_RING.find(p => p.name === hit.name);
    if (!pair || tenDigits(pair.backupPhone) === dialed) return null;
    const { data: line } = await db.from('tracking_numbers').select(ROUTE_LINE_COLUMNS).eq('phone', tenDigits(params.To)).maybeSingle();
    if (!line) return null;
    const to = '+1' + tenDigits(pair.backupPhone);
    await db.from('calls').update({
      forwarded_to: to,
      warnings: [...(Array.isArray(call.warnings) ? call.warnings : []), `${pair.name} ${status}, rang ${pair.backup}`],
    }).eq('id', call.id);
    console.log(`[voice_status] ${sid.slice(-6)} ${pair.name} ${status} -> ringing ${pair.backup}`);
    return dialTwiml({ ...line, forward_to: to, after_hours_forward_to: null }, params.From, sid, { bk: '1' });
  } catch (e) {
    console.error('[backup_ring] failed (voicemail instead):', e.message);
    return null;
  }
}

const MISSED_DIAL_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);
const CALLER_GONE_STATUSES = new Set(['completed', 'canceled', 'busy', 'no-answer', 'failed']);

async function missedCallTextAfterDial(params, dialStatus) {
  try {
    if (!MISSED_DIAL_STATUSES.has(dialStatus)) return;
    const job = sendMissedCallText(params).catch((e) => {
      console.error('[missed_call_text] failed:', e && e.message);
    });
    const callStatus = (params.CallStatus || '').toString().toLowerCase();
    if (CALLER_GONE_STATUSES.has(callStatus)) { await job; return; }
    let ctx = null;
    try { ctx = globalThis[Symbol.for('@vercel/request-context')]?.get?.() || null; } catch { ctx = null; }
    if (ctx && typeof ctx.waitUntil === 'function') { ctx.waitUntil(job); return; }
    await job;
  } catch (e) {
    console.error('[missed_call_text] failed:', e && e.message);
  }
}

async function rescueUnregisteredAutoText(db, messageId) {
  try {
    const tollfree = tenDigits(process.env.TWILIO_PHONE_NUMBER || '');
    const { data: m } = await db.from('messages').select('id, business_id, customer_phone, customer_id, our_phone, body, sent_by').eq('id', messageId).maybeSingle();
    if (!m || m.sent_by !== 'automated' || !tollfree || m.our_phone === tollfree) return;
    await db.from('tracking_numbers').update({ missed_call_via_tollfree: true }).eq('phone', m.our_phone);
    const { data: row } = await db.from('messages').insert({
      business_id: m.business_id, customer_phone: m.customer_phone, customer_id: m.customer_id,
      our_phone: tollfree, direction: 'out', body: m.body, status: 'queued', sent_by: 'automated',
    }).select('id').single();
    if (!row) return;
    const r = await sendSMSResult(m.customer_phone, m.body, { from: tollfree });
    await db.from('messages').update(r.ok ? { status: 'sent', twilio_sid: r.sid || null } : { status: 'failed', error: r.error || 'not sent' }).eq('id', row.id);
    console.log(`[sms_status] 30034 on line ...${String(m.our_phone).slice(-4)}: switched it to toll-free, resent ${r.ok ? 'ok' : 'FAILED'}`);
  } catch (e) {
    console.error('[sms_status] 30034 rescue failed:', e.message);
  }
}

async function sendMissedCallText(params) {
  const to = tenDigits(params.To);
  const rawFrom = (params.From || '').toString().trim();
  const tag = `[missed_call_text] line ...${to.slice(-4)}`;
  if (!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(rawFrom)) { console.log(`${tag} skipped: caller ID is not a textable US number`); return; }
  const from = rawFrom.slice(2);
  const who = `${tag} caller ...${from.slice(-4)}`;
  const country = (params.FromCountry || '').toString().toUpperCase();
  if (country && country !== 'US') { console.log(`${who} skipped: caller country ${country}`); return; }
  if (/^8(00|33|44|55|66|77|88)/.test(from)) { console.log(`${who} skipped: toll-free caller ID`); return; }
  if (from === to) { console.log(`${who} skipped: caller is the line itself`); return; }
  if (from === tenDigits(process.env.TWILIO_PHONE_NUMBER || '')) { console.log(`${who} skipped: caller is our toll-free sender`); return; }
  if (!demoMode() && !smsNotificationsOn()) { console.log(`${who} skipped: SMS notifications are off`); return; }

  const db = serviceClient();
  const { data: line, error: lineErr } = await db.from('tracking_numbers')
    .select('phone, business_slug, active, ai_bot_enabled, ai_bot_v2_enabled, forward_to, after_hours_forward_to, missed_call_text, missed_call_via_tollfree')
    .eq('phone', to).maybeSingle();
  if (lineErr || !line) { console.log(`${who} skipped: line lookup ${lineErr ? 'failed: ' + lineErr.message : 'found no line'}`); return; }
  const text = line.missed_call_text == null ? '' : String(line.missed_call_text);
  if (!text.trim()) return;
  if (!line.active) { console.log(`${who} skipped: line inactive`); return; }
  if (line.ai_bot_enabled || line.ai_bot_v2_enabled) { console.log(`${who} skipped: AI bot line`); return; }
  const tollfree = tenDigits(process.env.TWILIO_PHONE_NUMBER || '');
  const sender = line.missed_call_via_tollfree ? tollfree : to;
  if (!sender) { console.log(`${who} skipped: toll-free sender is not configured`); return; }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [ownQ, silentQ, staffQ, blockedQ, optedOut, recentQ, bizQ, custQ] = await Promise.all([
    db.from('tracking_numbers').select('id').eq('phone', from).limit(1),
    db.from('silent_numbers').select('id').eq('phone', from).limit(1),
    db.from('staff_users').select('phone').not('phone', 'is', null),
    db.from('blocked_numbers').select('id').eq('phone', from).limit(1),
    smsOptOutState(db, from),
    db.from('messages').select('id').eq('our_phone', sender).eq('customer_phone', from)
      .eq('direction', 'out').eq('sent_by', 'automated').gte('created_at', since).limit(1),
    line.business_slug
      ? db.from('businesses').select('id').eq('slug', line.business_slug).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('customers').select('id').eq('phone', from).limit(1),
  ]);
  const failed = [ownQ, silentQ, staffQ, blockedQ, recentQ].find(q => q.error);
  if (failed) { console.log(`${who} skipped: guard lookup failed: ${failed.error.message}`); return; }
  if ((ownQ.data || []).length) { console.log(`${who} skipped: caller is one of our tracking numbers`); return; }
  if ((blockedQ.data || []).length) { console.log(`${who} skipped: blocked number`); return; }
  const isSilent = (silentQ.data || []).length > 0;
  if (!isSilent) {
    const staffPhones = new Set((staffQ.data || []).map(s => tenDigits(s.phone)).filter(Boolean));
    if (staffPhones.has(from)) { console.log(`${who} skipped: staff phone`); return; }
    if (from === tenDigits(line.forward_to) || from === tenDigits(line.after_hours_forward_to)) { console.log(`${who} skipped: caller is this line's own handset`); return; }
  }
  if (optedOut !== false) { console.log(`${who} skipped: ${optedOut === null ? 'opt-out lookup failed' : 'caller opted out of texts'}`); return; }
  if ((recentQ.data || []).length) { console.log(`${who} skipped: already texted from this line in the last 24h`); return; }

  const { data: row, error: insErr } = await db.from('messages').insert({
    business_id: (bizQ && bizQ.data && bizQ.data.id) || null,
    customer_phone: from,
    our_phone: sender,
    direction: 'out',
    body: text,
    status: 'queued',
    sent_by: 'automated',
    customer_id: (custQ && !custQ.error && (custQ.data || [])[0]?.id) || null,
  }).select('id').single();
  if (insErr || !row) { console.error(`${who} not sent: message row insert failed: ${insErr ? insErr.message : 'no row'}`); return; }

  const base = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const statusCallback = base
    ? `${base}/api/analytics?action=sms_status&token=${encodeURIComponent(signToken({ kind: 'message', message_id: row.id }, 86400))}`
    : undefined;
  const r = await sendSMSResult(from, text, { from: sender, statusCallback });
  if (r.ok) {
    if (r.sid) await db.from('messages').update({ twilio_sid: r.sid }).eq('id', row.id);
    await db.from('messages').update({ status: 'sent' }).eq('id', row.id).eq('status', 'queued');
    console.log(`${who} sent${r.demo ? ' (demo)' : ''}`);
  } else {
    const why = r.error || `not sent (${r.skipped})`;
    await db.from('messages').update({ status: 'failed', error: why }).eq('id', row.id);
    console.error(`${who} send failed: ${why.replace(/\+?\d{10,11}/g, (m) => '...' + m.slice(-4))}`);
  }
}

async function handleVoiceRecording(req, res) {
  const sid = (req.query.sid || '').toString();
  const params = await twilioVoiceParams(req, res, 'voice_recording', { sid });
  if (!params) return;
  const patch = {};
  if (params.RecordingUrl) { patch.recording_url = params.RecordingUrl; patch.has_recording = true; }
  if (params.RecordingSid) patch.recording_sid = params.RecordingSid;
  if (params.TranscriptionText) patch.transcript = params.TranscriptionText;
  if (params.RecordingDuration) patch.duration_sec = parseInt(params.RecordingDuration, 10) || null;
  try {
    const db = serviceClient();
    let row = null;
    if (Object.keys(patch).length) {
      const { data } = await db.from('calls').update(patch).eq('twilio_call_sid', sid)
        .select('id, caller_phone, tracking_label, forwarded_to, notified_at, answered, market').maybeSingle();
      row = data || null;
    }
    const fromDialLeg = params.RecordingSource === 'DialVerb';
    if (row && params.RecordingUrl && row.forwarded_to && !row.notified_at && row.answered !== true && !fromDialLeg) {
      const { data: claimed } = await db.from('calls').update({ notified_at: new Date().toISOString() })
        .eq('id', row.id).is('notified_at', null).select('id');
      if (claimed && claimed.length) {
        const p = row.caller_phone || '';
        const pretty = p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p;
        const r = await sendSMSResult(row.forwarded_to,
          `Missed call${row.market ? ` (${row.market})` : ''} from ${pretty}. They left a voicemail - it is in the Calls tab.`);
        if (!r.ok) await db.from('calls').update({ notified_at: null }).eq('id', row.id);
      }
    }
    if (row && fromDialLeg && params.RecordingSid && (!params.RecordingStatus || params.RecordingStatus === 'completed')) {
      try { await startTranscript(db, row.id, params.RecordingSid); }
      catch (e) { console.error('[voice_recording] transcript start failed:', e.message); }
    }
  } catch (e) {
    console.error('[voice_recording] update failed:', e.message);
  }
  return xml(res, '<Response><Say voice="Polly.Joanna">Thanks. We will call you right back.</Say><Hangup/></Response>');
}


const AFTER_HOURS_SLOT_KEY = 's5';
function botAfterHoursFee(slotKey, dateStr) {
  return slotKey === AFTER_HOURS_SLOT_KEY ? 75 : 0;
}
const BOT_TAX_RATE = 0.0825;
const BOT_MIN_TICKET = 139;
const BOT_HANDYMAN_HOURLY = 85;

function botToken() {
  return signToken({ kind: 'admin', role: 'owner', scope: 'all', name: 'AI Voice Bot' }, 3600);
}
async function adminApi(action, { method = 'GET', params = {}, body = null } = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const url = `${publicBase()}/api/admin?${qs}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${botToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch (_) { /* non-JSON error page */ }
  if (!r.ok) {
    const e = new Error(data.error || `admin ${action} failed (${r.status})`);
    e.status = r.status; e.data = data;
    throw e;
  }
  return data;
}

async function botSessionGet(db, callSid) {
  const { data } = await db.from('voice_bot_sessions').select('*').eq('call_sid', callSid).maybeSingle();
  return data;
}
async function botSessionSave(db, callSid, patch) {
  await db.from('voice_bot_sessions').update({ ...patch, updated_at: new Date().toISOString() }).eq('call_sid', callSid);
}

function botMenuTwiml(action, sayText) {
  return '<Response><Gather input="speech dtmf" numDigits="1" timeout="6" speechTimeout="auto" action="'
    + xmlEsc(action) + '" method="POST"><Say voice="Polly.Joanna">' + xmlEsc(sayText) + '</Say></Gather>'
    + '<Redirect method="POST">' + xmlEsc(action) + '</Redirect></Response>';
}
function botOpenTwiml(action, sayIntro) {
  return '<Response><Gather input="speech dtmf" timeout="8" speechTimeout="auto" action="'
    + xmlEsc(action) + '" method="POST"><Say voice="Polly.Joanna">' + xmlEsc(sayIntro) + '</Say></Gather>'
    + '<Redirect method="POST">' + xmlEsc(action) + '</Redirect></Response>';
}
function botSayRedirect(sayText, action) {
  return '<Response><Say voice="Polly.Joanna">' + xmlEsc(sayText) + '</Say><Redirect method="POST">' + xmlEsc(action) + '</Redirect></Response>';
}
function botHangup(sayText) {
  return '<Response>' + (sayText ? '<Say voice="Polly.Joanna">' + xmlEsc(sayText) + '</Say>' : '') + '<Hangup/></Response>';
}
function botTransfer(line, callerFrom, sid, sayFirst) {
  const twiml = dialTwiml(line, callerFrom, sid);
  return sayFirst ? twiml.replace('<Response>', '<Response><Say voice="Polly.Joanna">' + xmlEsc(sayFirst) + '</Say>') : twiml;
}

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const BOT_STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'has', 'have', 'will', 'with', 'for', 'and', 'or', 'to', 'of', 'tv', 'on', 'in', 'my', 'i']);
function botTermsFor(label) {
  const bare = String(label || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').trim();
  const words = bare.split(/\s+/).filter(w => w.length >= 3 && !BOT_STOPWORDS.has(w));
  const terms = new Set(words);
  for (let i = 0; i < words.length - 1; i++) terms.add(words[i] + ' ' + words[i + 1]);
  return [...terms];
}
function botMatchMenu(options, { digits, speech }) {
  if (digits) {
    const idx = parseInt(digits, 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx];
  }
  const s = (speech || '').toLowerCase().trim();
  if (!s) return null;
  const asNum = parseInt(s, 10);
  if (Number.isFinite(asNum) && asNum >= 1 && asNum <= options.length) return options[asNum - 1];
  const firstWord = s.split(/\s+/)[0];
  const wIdx = NUM_WORDS.indexOf(firstWord);
  if (wIdx >= 1 && wIdx <= options.length) return options[wIdx - 1];
  let best = null, bestLen = 0;
  for (const o of options) {
    for (const t of (o.terms || [])) {
      if (t && s.includes(t) && t.length > bestLen) { bestLen = t.length; best = o; }
    }
  }
  return best;
}
const ORDINAL_WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30, thirty: 30, twenty: 20 };
function botOrdinalDayFrom(s) {
  const m = s.match(/\b(twenty|thirty)[\s-]?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)?\b|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)\b/);
  if (!m) return null;
  if (m[1]) return (ORDINAL_WORDS[m[1]] || 0) + (m[2] ? ORDINAL_WORDS[m[2]] : 0);
  return ORDINAL_WORDS[m[3]] || null;
}
function botMatchDate(dates, { digits, speech }) {
  const s = (speech || '').toLowerCase();
  if (/\b(soonest|earliest|first available|whatever'?s? (soonest|earliest|first)|any(time|day)|next available)\b/.test(s) && dates[0]) return dates[0];
  if (/\btomorrow\b/.test(s) && dates[1]) return dates[1];
  if (/\btoday\b/.test(s) && dates[0]) return dates[0];
  if (/\bday after tomorrow\b/.test(s) && dates[2]) return dates[2];
  const dayNum = (s.match(/\d{1,2}/) || [])[0] || botOrdinalDayFrom(s);
  if (dayNum) {
    const n = parseInt(dayNum, 10);
    const hit = dates.find(ds => parseInt(ds.slice(-2), 10) === n);
    if (hit) return hit;
  }
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const ds of dates) {
    let dow;
    try { dow = new Date(ds + 'T12:00:00').getDay(); } catch (_) { continue; }
    if (s.includes(WEEKDAYS[dow])) return ds;
  }
  if (digits) { const idx = parseInt(digits, 10) - 1; if (idx >= 0 && idx < dates.length) return dates[idx]; }
  const wIdx = NUM_WORDS.indexOf(s.split(/\s+/)[0]);
  if (wIdx >= 1 && wIdx <= dates.length) return dates[wIdx - 1];
  return null;
}
function botMatchSlot(slots, { digits, speech }) {
  const s = (speech || '').toLowerCase();
  if (/\b(soonest|earliest|first available|whatever'?s? (soonest|earliest|first)|any(time)?|next available)\b/.test(s) && slots[0]) return slots[0];
  const m = s.match(/(\d{1,2})\s*(am|pm)?/);
  if (m) {
    let hr = parseInt(m[1], 10);
    const ap = m[2];
    if (ap === 'pm' && hr < 12) hr += 12;
    if (ap === 'am' && hr === 12) hr = 0;
    const hourOf = (sl) => parseInt((sl.start || '').split(':')[0], 10);
    let hit = slots.find(sl => hourOf(sl) === hr);
    if (!hit && !ap && hr >= 1 && hr <= 7) hit = slots.find(sl => hourOf(sl) === hr + 12);
    if (hit) return hit;
  }
  if (/\bmorning\b/.test(s)) { const hit = slots.find(sl => (sl.start || '') < '12:00'); if (hit) return hit; }
  if (/\bafternoon\b/.test(s)) { const hit = slots.find(sl => (sl.start || '') >= '12:00' && (sl.start || '') < '17:00'); if (hit) return hit; }
  if (/\b(evening|night)\b/.test(s)) { const hit = slots.find(sl => (sl.start || '') >= '17:00'); if (hit) return hit; }
  if (digits) { const idx = parseInt(digits, 10) - 1; if (idx >= 0 && idx < slots.length) return slots[idx]; }
  const wIdx = NUM_WORDS.indexOf(s.split(/\s+/)[0]);
  if (wIdx >= 1 && wIdx <= slots.length) return slots[wIdx - 1];
  return null;
}
async function botClaudeCall(prompt, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens || 20, messages: [{ role: 'user', content: prompt }] }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) { console.error('[voice_bot] Claude call failed:', r.status, await r.text().catch(() => '')); return null; }
    const data = await r.json();
    return ((data.content && data.content[0] && data.content[0].text) || '').trim();
  } catch (e) {
    console.error('[voice_bot] Claude call errored:', e.message);
    return null;
  }
}
async function botClaudeChoose(question, speech, choices) {
  if (!speech || !choices.length) return null;
  const prompt = `A caller on a phone booking call was asked: "${question}"\nThey said: "${speech}"\n`
    + `Which ONE of these is the closest match to what they meant? Reply with ONLY the exact text of that choice, character for character, nothing else. If none reasonably match, reply exactly: NONE\n\nChoices:\n`
    + choices.map(c => `- ${c}`).join('\n');
  const text = await botClaudeCall(prompt, 40);
  if (!text || /^NONE$/i.test(text)) return null;
  return choices.find(c => c.toLowerCase().trim() === text.toLowerCase().trim()) || null;
}
async function botClaudeYesNo(question, speech) {
  if (!speech) return null;
  const prompt = `A caller on a phone booking call was asked: "${question}"\nThey said: "${speech}"\nIs that a yes or a no? Reply with ONLY one word: YES, NO, or UNCLEAR.`;
  const text = await botClaudeCall(prompt, 5);
  if (!text) return null;
  if (/^YES$/i.test(text)) return true;
  if (/^NO$/i.test(text)) return false;
  return null;
}
function botYes(speech, digits) {
  if (digits === '1') return true;
  if (digits === '2') return false;
  const s = (speech || '').toLowerCase();
  if (/\b(yes|yeah|yep|sure|correct|that works|sounds good|book it)\b/.test(s)) return true;
  if (/\b(no|nope|not|different|change)\b/.test(s)) return false;
  return null;
}
function botParseDigitsFrom(speech, digits, count) {
  if (digits && new RegExp(`^\\d{${count}}$`).test(digits)) return digits;
  const stripped = String(speech || '').replace(/\D/g, '');
  if (stripped.length === count) return stripped;
  if (count === 10 && stripped.length === 11 && stripped.startsWith('1')) return stripped.slice(1);
  const DIGIT_WORDS = { zero: '0', oh: '0', one: '1', two: '2', to: '2', too: '2', three: '3', four: '4', for: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
  let out = '';
  for (const w of String(speech || '').toLowerCase().split(/\s+/)) {
    if (/^\d$/.test(w)) out += w;
    else if (DIGIT_WORDS[w] != null) out += DIGIT_WORDS[w];
  }
  return out.length === count ? out : null;
}
function botSpokenMoney(n) {
  const v = Math.round(Number(n) || 0);
  return `${v} dollar${v === 1 ? '' : 's'}`;
}

async function botLoadCatalog(businessSlug, serviceId) {
  const { groups } = await adminApi('service_options', { params: { business: businessSlug, service_id: serviceId } });
  const byKey = {};
  for (const g of (groups || [])) {
    byKey[g.key] = (g.options || []).map(o => ({
      id: o.id, label: o.label, price: Number(o.price) || 0,
      sizecat: o.metadata && o.metadata.sizecat || null,
    }));
  }
  return byKey;
}
function botSpeakLabel(label) {
  return String(label || '')
    .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 to $2')
    .replace(/["″]/g, '')
    .replace(/(\d)\+/g, '$1 or more');
}
function botMenuOptionsFrom(catalogGroup) {
  return (catalogGroup || []).map(o => ({ say: botSpeakLabel(o.label), terms: botTermsFor(o.label), catalogOpt: o }));
}
function botSizeRangeFor(label) {
  const nums = String(label || '').match(/\d+/g);
  if (!nums || !nums.length) return null;
  if (/or less|under/i.test(label)) return { min: 0, max: parseInt(nums[0], 10) };
  if (/\+/.test(label) || nums.length === 1) return { min: parseInt(nums[0], 10), max: Infinity };
  return { min: parseInt(nums[0], 10), max: parseInt(nums[nums.length - 1], 10) };
}
function botMatchSize(catalogGroup, { digits, speech }) {
  const raw = digits || (String(speech || '').match(/\d+/) || [])[0];
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  for (const o of (catalogGroup || [])) {
    const r = botSizeRangeFor(o.label);
    if (r && n >= r.min && n <= r.max) return o;
  }
  return null;
}

function botBuildSelections(d) {
  const out = [];
  if (d.category === 'tv') {
    for (const key of ['size', 'bracket', 'fireplace', 'surface', 'wires', 'lifting', 'extras']) {
      const picked = d.answers && d.answers[key];
      if (picked && picked.price > 0) out.push({ option_id: picked.id || null, label: picked.label, price: picked.price, quantity: 1 });
      else if (picked) out.push({ option_id: picked.id || null, label: picked.label, price: 0, quantity: 1 });
    }
  } else if (d.category === 'handyman') {
    const hrs = Math.max(2, Number(d.handymanHours) || 2);
    out.push({ option_id: null, label: `Handyman Labor: ${d.handymanDesc || 'as described'} — ${hrs} hour${hrs === 1 ? '' : 's'}`, price: BOT_HANDYMAN_HOURLY, quantity: hrs });
  }
  if (d.surcharge !== 0) out.push({ option_id: null, label: d.surcharge > 0 ? 'Travel' : 'Local travel credit', price: d.surcharge, quantity: 1 });
  const ahFee = botAfterHoursFee(d.slotKey, d.date);
  if (ahFee > 0) out.push({ option_id: null, label: 'After-Hours Service Fee (8 PM)', price: ahFee, quantity: 1 });
  const rawSum = out.filter(x => x.label !== 'Service minimum').reduce((s, x) => s + x.price * x.quantity, 0);
  if (rawSum > 0 && rawSum < BOT_MIN_TICKET) out.push({ option_id: null, label: 'Service minimum', price: Math.round((BOT_MIN_TICKET - rawSum) * 100) / 100, quantity: 1 });
  return out;
}

async function handleVoiceBotStart(req, res) {
  const sid = (req.query.sid || '').toString();
  const params = await twilioVoiceParams(req, res, 'voice_bot_start', { sid });
  if (!params) return;
  const to = tenDigits(params.To);
  const from = params.From || '';
  const db = serviceClient();
  let line = null;
  try {
    const { data } = await db.from('tracking_numbers')
      .select('phone, label, business_slug, market, forward_to, ring_seconds, record_calls, after_hours_forward_to, hours_start, hours_end, hours_timezone, ai_bot_enabled, route_team')
      .eq('phone', to).maybeSingle();
    line = await applyShiftRouting(db, data || null);
    if (!line || !line.ai_bot_enabled) return xml(res, dialTwiml(line, from, params.CallSid || ''));

    const { data: biz } = await db.from('businesses').select('id, slug, name, timezone').eq('slug', line.business_slug).maybeSingle();
    if (!biz) return xml(res, botHangup("Sorry, we're having trouble right now. Please call back in a few minutes."));

    const { services: svcs } = await adminApi('services', { params: { business: biz.slug } }).catch(() => ({ services: [] }));
    const tvService = (svcs || []).find(s => /tv\s*mount|tv\s*install/i.test(s.category || s.name || ''));
    const handymanService = (svcs || []).find(s => /handyman/i.test(s.category || s.name || ''));
    if (!tvService && !handymanService) return xml(res, botHangup("Sorry, we're having trouble right now. Please call back in a few minutes."));

    const onlyOne = (tvService && !handymanService) ? 'tv' : (!tvService && handymanService) ? 'handyman' : null;
    const session = {
      call_sid: params.CallSid || '',
      business_id: biz.id, business_slug: biz.slug,
      tracking_number: line.phone, caller_phone: tenDigits(from),
      step: onlyOne ? 'zip' : 'category',
      data: {
        tvServiceId: tvService ? tvService.id : null,
        handymanServiceId: handymanService ? handymanService.id : null,
        category: onlyOne, businessName: biz.name, timezone: biz.timezone || 'Asia/Manila',
        forwardTo: line.forward_to, answers: {},
      },
      retry_count: 0,
    };
    await db.from('voice_bot_sessions').upsert(session, { onConflict: 'call_sid' });

    const greetName = biz.name || 'our company';
    const turnAction = voiceUrl('voice_bot_turn', { sid: session.call_sid });
    if (!onlyOne) {
      return xml(res, botMenuTwiml(turnAction, `Thanks for calling ${greetName}! Would you like to book home cleaning or handyman services?`));
    }
    return xml(res, botOpenTwiml(turnAction,
      `Thanks for calling ${greetName}! I can help you book a ${onlyOne === 'tv' ? 'home cleaning' : 'handyman'} appointment. What's your 5 digit zip code?`));
  } catch (e) {
    console.error('[voice_bot_start] failed:', e.message);
    return xml(res, botTransfer(line, from, params.CallSid || '', "Sorry, I'm having trouble right now — let me connect you with someone."));
  }
}

async function handleVoiceBotTurn(req, res) {
  const sid = (req.query.sid || '').toString();
  const params = await twilioVoiceParams(req, res, 'voice_bot_turn', { sid });
  if (!params) return;
  const digits = (params.Digits || '').toString().trim();
  const speech = (params.SpeechResult || '').toString().trim();
  const callerFrom = params.From || '';
  const db = serviceClient();
  const action = voiceUrl('voice_bot_turn', { sid });

  const session = await botSessionGet(db, sid);
  if (!session) return xml(res, botHangup('Sorry, this call has expired. Please call back.'));
  const d = session.data || {};
  const step = session.step;

  const { data: lineRow } = await db.from('tracking_numbers')
    .select('phone, label, business_slug, forward_to, ring_seconds, record_calls, after_hours_forward_to, hours_start, hours_end, hours_timezone, route_team')
    .eq('phone', session.tracking_number).maybeSingle();
  const line = await applyShiftRouting(db, lineRow);

  const retry = async (sayText) => {
    const n = (session.retry_count || 0) + 1;
    if (n > 3) {
      await botSessionSave(db, sid, { retry_count: 0 });
      return xml(res, botTransfer(line, callerFrom, sid, "I'm having a little trouble understanding — let me connect you with someone who can help."));
    }
    await botSessionSave(db, sid, { retry_count: n });
    return xml(res, botSayRedirect(sayText, action));
  };
  const goto = async (nextStep, patch, sayText, twimlFn) => {
    const newData = { ...d, ...(patch || {}) };
    const twiml = await twimlFn(newData);
    await botSessionSave(db, sid, { step: nextStep, data: newData, retry_count: 0 });
    return xml(res, twiml);
  };

  try {
    switch (step) {

      case 'category': {
        let opt = botMatchMenu([
          { say: 'tv', terms: ['tv', 'mount', 'mounting', 'television'] },
          { say: 'handyman', terms: ['handyman', 'handy', 'handywork'] },
        ], { digits, speech });
        if (!opt && speech) {
          const picked = await botClaudeChoose('Would you like home cleaning or handyman services?', speech, ['home cleaning', 'handyman services']);
          if (picked) opt = { say: picked === 'home cleaning' ? 'tv' : 'handyman' };
        }
        if (!opt) return retry("I didn't catch that — would you like home cleaning or handyman services?");
        const cat = opt.say === 'tv' ? 'tv' : 'handyman';
        return goto('zip', { category: cat },
          null, () => botOpenTwiml(action, `Great. What's your 5 digit zip code?`));
      }

      case 'zip': {
        const zip = botParseDigitsFrom(speech, digits, 5);
        if (!zip) return retry("I need your 5 digit zip code. You can say it or enter it on the keypad.");
        let za;
        try { za = await adminApi('zip_area', { params: { business: session.business_slug, postal_code: zip } }); }
        catch (e) { return retry("I couldn't check that zip code. Could you say it again?"); }
        if (!za.service_area_id) {
          await botSessionSave(db, sid, { retry_count: 0 });
          return xml(res, botTransfer(line, callerFrom, sid, "That zip code is outside our normal service area — let me connect you with someone who can take a closer look."));
        }
        const nd = { ...d, zip, surcharge: Number(za.surcharge) || 0 };
        if (nd.category === 'tv') {
          let catalog;
          try { catalog = await botLoadCatalog(session.business_slug, nd.tvServiceId); }
          catch (e) { return retry("I'm having trouble pulling up pricing. Could you give me a moment and repeat your last answer?"); }
          nd.catalog = catalog;
          return goto('tv_size', nd, null, () => botOpenTwiml(action, "What size is your TV, in inches?"));
        }
        return goto('handyman_desc', nd, null, () => botOpenTwiml(action, "What do you need done?"));
      }

      case 'tv_size': {
        let opt = botMatchSize(d.catalog.size, { digits, speech });
        if (!opt && speech) {
          const picked = await botClaudeChoose('What size is your TV, in inches?', speech, d.catalog.size.map(o => o.label));
          if (picked) opt = d.catalog.size.find(o => o.label === picked) || null;
        }
        if (!opt) return retry("What size is the TV — just the number of inches is fine?");
        const answers = { ...d.answers, size: opt };
        const bracketOpts = d.catalog.bracket || [];
        if (!bracketOpts.length) {
          return goto('tv_fireplace', { answers }, null, (nn) => botMenuTwiml(action, "Is your TV going over a fireplace?"));
        }
        return goto('tv_bracket', { answers }, null, () => botOpenTwiml(action, "Do you have your own bracket, or would you like us to bring a flat, tilting, or full motion one?"));
      }
      case 'tv_bracket': {
        const opts = botMenuOptionsFrom(d.catalog.bracket);
        let opt = botMatchMenu(opts, { digits: '', speech });
        if (!opt && speech) {
          const picked = await botClaudeChoose('Do you have your own bracket, or would you like us to bring a flat, tilting, or full motion one?', speech, d.catalog.bracket.map(o => o.label));
          if (picked) opt = { catalogOpt: d.catalog.bracket.find(o => o.label === picked) };
        }
        if (!opt) return retry("Do you have your own bracket, or should we bring a flat, tilting, or full motion bracket?");
        const answers = { ...d.answers, bracket: opt.catalogOpt };
        return goto('tv_fireplace', { answers }, null, () => botMenuTwiml(action, "Is your TV going over a fireplace?"));
      }
      case 'tv_fireplace': {
        let yn = botYes(speech, digits);
        if (yn === null && speech) yn = await botClaudeYesNo('Is the TV going over a fireplace?', speech);
        if (yn === null) return retry("Is the TV going over a fireplace — yes or no?");
        const fpOpts = d.catalog.fireplace || [];
        const isAboveFireplace = (label) => /above a fireplace/i.test(label) && !/\bnot\b/i.test(label);
        const picked = fpOpts.find(o => isAboveFireplace(o.label) === yn);
        let answers = { ...d.answers, fireplace: picked || { label: yn ? 'TV above a fireplace' : 'TV NOT above a fireplace', price: 0 } };
        const drywall = (d.catalog.surface || []).find(o => /drywall/i.test(o.label)) || { label: 'Drywall', price: 0 };
        answers = { ...answers, surface: drywall };
        const wireOpts = d.catalog.wires || [];
        if (!wireOpts.length) return goto('schedule_date', { answers }, null, (nn) => botAskDate(nn, action, session.business_slug));
        return goto('tv_wires', { answers }, null, () => botMenuTwiml(action, "Would you like the wires hidden behind the wall, hidden outside the wall, or left hanging down?"));
      }
      case 'tv_wires': {
        const opts = botMenuOptionsFrom(d.catalog.wires);
        let opt = botMatchMenu(opts, { digits, speech });
        if (!opt && speech) {
          const picked = await botClaudeChoose('Would you like the wires hidden behind the wall, hidden outside the wall, or left hanging?', speech, d.catalog.wires.map(o => o.label));
          if (picked) opt = { catalogOpt: d.catalog.wires.find(o => o.label === picked) };
        }
        if (!opt) return retry("Would you like the wires hidden behind the wall, hidden outside the wall, or left hanging?");
        const answers = { ...d.answers, wires: opt.catalogOpt };
        const sizecat = answers.size && answers.size.sizecat;
        const needsLifting = sizecat && sizecat !== 'small' && (d.catalog.lifting || []).length;
        if (needsLifting) {
          return goto('tv_lifting', { answers }, null, () => botMenuTwiml(action, "Since it's a larger TV, will you be able to help lift it, or should we send a second cleaner?"));
        }
        return goto('schedule_date', { answers }, null, (nn) => botAskDate(nn, action, session.business_slug));
      }
      case 'tv_lifting': {
        const opts = botMenuOptionsFrom(d.catalog.lifting);
        let opt = botMatchMenu(opts, { digits, speech });
        if (!opt && speech) {
          const picked = await botClaudeChoose('Will you be able to help lift the TV, or should we send a second cleaner?', speech, d.catalog.lifting.map(o => o.label));
          if (picked) opt = { catalogOpt: d.catalog.lifting.find(o => o.label === picked) };
        }
        if (!opt) return retry("Will you be able to help lift the TV, or would you like a second cleaner?");
        const answers = { ...d.answers, lifting: opt.catalogOpt };
        return goto('schedule_date', { answers }, null, (nn) => botAskDate(nn, action, session.business_slug));
      }

      case 'handyman_desc': {
        if (!speech) return retry("Could you describe what you need done?");
        return goto('handyman_hours', { handymanDesc: speech }, null, () => botOpenTwiml(action, `Got it. About how many hours of work is that, at ${BOT_HANDYMAN_HOURLY} dollars an hour, with a 2 hour minimum? You can say a number.`));
      }
      case 'handyman_hours': {
        const n = parseInt(digits || speech, 10);
        if (!Number.isFinite(n) || n < 1) return retry("About how many hours — you can just say a number like 2 or 3?");
        return goto('schedule_date', { handymanHours: Math.max(2, n) }, null, (nn) => botAskDate(nn, action, session.business_slug));
      }

      case 'schedule_date': {
        const dates = d._dateChoices || [];
        let dateStr = botMatchDate(dates, { digits, speech });
        if (!dateStr && speech) {
          const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          const labels = dates.map(botSpokenDate);
          const picked = await botClaudeChoose(`Today is ${todayLabel}. Which day works best for the appointment?`, speech, labels);
          if (picked) dateStr = dates[labels.indexOf(picked)];
        }
        if (!dateStr) return retry("Which day works best — you can just tell me the day, like Thursday or the 4th?");
        return goto('schedule_slot', { date: dateStr, _dateChoices: null }, null, (nn) => botAskSlot(nn, session.business_slug, action));
      }
      case 'schedule_slot': {
        const slots = d._slotChoices || [];
        let opt = botMatchSlot(slots, { digits, speech });
        if (!opt && speech) {
          const labels = slots.map(s => s.label);
          const picked = await botClaudeChoose(`Which time works best on ${botSpokenDate(d.date)}?`, speech, labels);
          if (picked) opt = slots[labels.indexOf(picked)];
        }
        if (!opt) return retry("Which time works best — morning, afternoon, or evening is fine?");
        const answers = { ...d.answers };
        return goto('recap', { slotKey: opt.slot_key, slotLabel: opt.label, _slotChoices: null }, null, (nn) => botRecap(nn, action));
      }

      case 'recap': {
        let yn = botYes(speech, digits);
        if (yn === null && speech) yn = await botClaudeYesNo('Does the appointment time and price work for you?', speech);
        if (yn === null) return retry("Does that work for you — yes or no?");
        if (!yn) {
          await botSessionSave(db, sid, { retry_count: 0 });
          return xml(res, botTransfer(line, callerFrom, sid, "No problem — let me connect you with someone who can go over some options."));
        }
        return goto('customer_name', {}, null, () => botOpenTwiml(action, "Great, let's get you booked. Can I get your first and last name?"));
      }

      case 'customer_name': {
        if (!speech) return retry("Could you say your first and last name?");
        const name = speech.replace(/\b\w/g, c => c.toUpperCase());
        const last4 = (session.caller_phone || '').slice(-4);
        return goto('customer_phone', { name }, null, () => last4
          ? botMenuTwiml(action, `Thanks. Is the best number to reach you the one you're calling from, ending in ${last4.split('').join(' ')}?`)
          : botOpenTwiml(action, "What's the best phone number to reach you?"));
      }
      case 'customer_phone': {
        if (session.caller_phone && !d._phoneAsked) {
          let yn = botYes(speech, digits);
          if (yn === null && speech) yn = await botClaudeYesNo("Is the caller's own phone number the best number to reach them?", speech);
          if (yn === null) return retry("Is that the right number — yes or no?");
          if (yn) return goto('customer_email', { phone: session.caller_phone }, null, () => botOpenTwiml(action, "What's your email? You can also just say skip."));
          return goto('customer_phone', { _phoneAsked: true }, null, () => botOpenTwiml(action, "What's the best number to reach you?"));
        }
        const phone = botParseDigitsFrom(speech, digits, 10);
        if (!phone) return retry("Could you say your 10 digit phone number again?");
        return goto('customer_email', { phone }, null, () => botOpenTwiml(action, "What's your email? You can also just say skip."));
      }
      case 'customer_email': {
        const s = speech.toLowerCase();
        const email = /\b(skip|no email|none|don't have)\b/.test(s) ? null : (speech || null);
        return goto('customer_address', { email }, null, () => botOpenTwiml(action, "And what's the street address for the appointment?"));
      }
      case 'customer_address': {
        if (!speech) return retry("Could you give me the street address again?");
        return goto('book', { address: speech }, null, (nn) => botDoBooking(db, session, nn, line, callerFrom));
      }

      default:
        return xml(res, botTransfer(line, callerFrom, sid, "Sorry, something went wrong on my end — let me connect you with someone."));
    }
  } catch (e) {
    console.error(`[voice_bot_turn] step=${step} failed:`, e.message);
    return xml(res, botTransfer(line, callerFrom, sid, "Sorry, I'm having trouble right now — let me connect you with someone."));
  }
}

async function botAskDate(d, action, businessSlug) {
  const now = new Date();
  const months = [now, new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  let dates = [];
  for (const m of months) {
    const month = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    try {
      const r = await adminApi('available_dates', { params: { business: businessSlug, month, technician_id: 'any', pool: 'cross', postal_code: d.zip } });
      dates = dates.concat(r.dates || []);
    } catch (e) { /* try the next month anyway */ }
    if (dates.length >= 3) break;
  }
  dates = dates.slice(0, 3);
  d._dateChoices = dates;
  if (!dates.length) return botHangup("I'm sorry, we don't have any openings in your area right now. Please call back soon.");
  const list = botSpokenList(dates.map(botSpokenDate));
  return botMenuTwiml(action, `The soonest openings are ${list}. Which day works best?`);
}
function botSpokenList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', or ' + items[items.length - 1];
}
function botSpokenDate(dateStr) {
  try {
    const dt = new Date(dateStr + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch (_) { return dateStr; }
}
async function botAskSlot(d, businessSlug, action) {
  let slots = [];
  try {
    const r = await adminApi('available_slots', { params: { business: businessSlug, date: d.date, technician_id: 'any', pool: 'cross', postal_code: d.zip } });
    slots = r.slots || [];
  } catch (e) { /* fall through to empty */ }
  d._slotChoices = slots;
  if (!slots.length) return botSayRedirect("Sorry, that day just filled up.", action);
  const list = botSpokenList(slots.map(s => s.label + (botAfterHoursFee(s.slot_key, d.date) > 0 ? ` with an after-hours fee` : '')));
  return botMenuTwiml(action, `Here's what's open ${botSpokenDate(d.date)}: ${list}. Which works best?`);
}
function botRecap(d, action) {
  const selections = botBuildSelections(d);
  const subtotal = selections.reduce((s, x) => s + x.price * x.quantity, 0);
  const tax = Math.round(subtotal * BOT_TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  d._priced = { selections, subtotal, tax, total };
  const what = d.category === 'tv' ? (d.answers.size ? botSpeakLabel(d.answers.size.label) + ' TV mount' : 'TV mount') : `${d.handymanHours || 2} hours of handyman work`;
  return botMenuTwiml(action,
    `Okay, I have ${what} on ${botSpokenDate(d.date)}, ${d.slotLabel}. The total before tax is ${botSpokenMoney(total)}. Does that work for you?`);
}
async function botDoBooking(db, session, d, line, callerFrom) {
  const priced = d._priced || (() => { const sel = botBuildSelections(d); const sub = sel.reduce((s, x) => s + x.price * x.quantity, 0); const tax = Math.round(sub * BOT_TAX_RATE * 100) / 100; return { selections: sel, subtotal: sub, tax, total: Math.round((sub + tax) * 100) / 100 }; })();
  const body = {
    business: session.business_slug,
    idempotency_key: `voicebot-${session.call_sid}`,
    customer: {
      name: d.name || 'Phone Customer', phone: d.phone || session.caller_phone || null,
      email: d.email || null, postal_code: d.zip, address_line1: d.address || null,
    },
    service_id: d.category === 'tv' ? d.tvServiceId : d.handymanServiceId,
    technician_id: 'any', pool: 'cross',
    scheduled_date: d.date, scheduled_slot: d.slotKey,
    selections: priced.selections, subtotal: priced.subtotal, tax: priced.tax, price: priced.total,
    payment_method: 'card',
    notes: 'Booked by AI Voice Bot (pilot)',
    sms_consent: false,
  };
  try {
    await adminApi('booking_create', { method: 'POST', body });
    await botSessionSave(db, session.call_sid, { step: 'done' });
    return botHangup(`You're all set for ${botSpokenDate(d.date)}, ${d.slotLabel}. The total is ${botSpokenMoney(priced.total)}. Thanks for calling, and we'll see you then!`);
  } catch (e) {
    console.error('[voice_bot] booking_create failed:', e.message, e.data || '');
    await botSessionSave(db, session.call_sid, { retry_count: 0 });
    return botTransfer(line, callerFrom, session.call_sid, "I'm sorry, that time just became unavailable — let me connect you with someone who can find another slot.");
  }
}

async function handleSmsInbound(req, res) {
  const params = await twilioVoiceParams(req, res, 'sms_inbound');
  if (!params) return;
  const from = tenDigits(params.From);
  const to = tenDigits(params.To);
  if (isTollFree(from)) return xml(res, '<Response/>');
  const body = (params.Body || '').toString().trim();
  let line = null;
  let blocked = false;
  let business_name = null;
  let business_id = null;
  try {
    const db = serviceClient();
    const { data } = await db.from('tracking_numbers')
      .select('phone, label, business_slug, forward_to, active, after_hours_forward_to, hours_start, hours_end, hours_timezone, route_team')
      .eq('phone', to).maybeSingle();
    line = await applyShiftRouting(db, data && data.active ? data : null);

    if (from) {
      const { data: b } = await db.from('blocked_numbers').select('id').eq('phone', from).maybeSingle();
      blocked = !!b;
    }

    if (from && body) {
      try { const { confirmTechReply } = await import('./_lib/tech-reminders.js'); await confirmTechReply(db, from, body); }
      catch (e) { console.warn('[sms_inbound] tech confirm failed:', e.message); }
    }
    business_id = null;
    const brandSlug = (line && line.business_slug) || (data && data.business_slug) || null;
    if (brandSlug) {
      const { data: biz } = await db.from('businesses').select('id, name').eq('slug', brandSlug).maybeSingle();
      business_id = line ? (biz?.id || null) : null;
      business_name = biz?.name || null;
    }

    let customer_id = null;
    if (from) {
      const { data: c } = await db.from('customers').select('id').eq('phone', from).limit(1);
      customer_id = (c || [])[0]?.id || null;
    }

    if (from && to) {
      const { error: msgErr } = await db.from('messages').insert({
        business_id,
        customer_phone: from,
        our_phone: to,
        direction: 'in',
        body: body || null,
        twilio_sid: (params.MessageSid || params.SmsSid || '').toString() || null,
        customer_id,
        media_count: Number(params.NumMedia) || 0,
      });
      if (msgErr && !/duplicate key|unique/i.test(msgErr.message || '')) {
        console.error('[sms_inbound] message store failed:', msgErr.message);
      }
    }

    if (await isSilentNumber(db, from)) return finishSmsInbound(res, line, from, body, blocked, business_name, to, business_id);

    const keyword = smsKeyword(body);
    const keywordNote = keyword === 'stop' ? `STOP keyword: texts turned off for this number (${TWILIO_OPTOUT_RE.test(body || '') ? 'Twilio sent the opt-out confirmation' : 'we sent the opt-out confirmation'}); relayed to staff`
      : keyword === 'help' ? (line && line.business_slug === 'tidyhaus' && TWILIO_HELP_RE.test(body || '') ? 'HELP keyword: Twilio sent the registered help reply; relayed to staff' : 'HELP keyword: auto-replied with support contact; relayed to staff')
      : keyword === 'start' ? 'START keyword: Twilio may re-enable texts to this number, but CRM text consent was NOT restored; relayed to staff'
      : null;
    const callWarnings = blocked ? ['Blocked number — text was not relayed']
      : [keywordNote, line ? null : 'Number is not in tracking_numbers - text still relayed if possible'].filter(Boolean);
    await db.from('calls').insert({
      business_id,
      source: 'twilio',
      kind: 'sms',
      caller_phone: from || 'unknown',
      grasshopper_number: to || null,
      tracking_label: line?.label || null,
      transcript: body || null,
      occurred_at: new Date().toISOString(),
      customer_id,
      status: blocked ? 'ignored' : 'new',
      handled_by: blocked ? 'Blocked number' : keyword ? `Auto-handled ${keyword.toUpperCase()} keyword` : null,
      handled_at: blocked ? new Date().toISOString() : null,
      warnings: callWarnings.length ? callWarnings : null,
    });
  } catch (e) {
    console.error('[sms_inbound] log failed:', e.message);
  }

  return finishSmsInbound(res, line, from, body, blocked, business_name, to, business_id);
}

const SMS_HELP_RE = /^\s*(help|info)[\s.!?]*$/i;
const TWILIO_OPTOUT_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|revoke|optout)\s*$/i;
const TWILIO_HELP_RE = /^\s*(help|info)\s*$/i;
function smsKeyword(body) {
  const s = (body || '').toString();
  if (SMS_STOP_RE.test(s)) return 'stop';
  if (SMS_HELP_RE.test(s)) return 'help';
  if (SMS_START_RE.test(s)) return 'start';
  return null;
}

async function clearSmsConsentForPhone(phone) {
  const d = tenDigits(phone);
  if (d.length !== 10) return;
  const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6);
  const variants = [d, `1${d}`, `+1${d}`, `(${a}) ${b}-${c}`, `(${a})${b}-${c}`, `${a}-${b}-${c}`, `${a}.${b}.${c}`, `${a} ${b} ${c}`, `+1 (${a}) ${b}-${c}`, `+1 ${a}-${b}-${c}`];
  try {
    const db = serviceClient();
    let bookings = 0, estimates = 0;
    const { data: custs, error: cErr } = await db.from('customers').select('id').in('phone', variants);
    if (cErr) console.warn('[sms_inbound] STOP: customer lookup failed:', cErr.message);
    const ids = (custs || []).map(r => r.id);
    if (ids.length) {
      const { data: bk, error: bErr } = await db.from('bookings')
        .update({ sms_consent: false }).in('customer_id', ids).eq('sms_consent', true).select('id');
      if (bErr) console.warn('[sms_inbound] STOP: bookings consent update failed:', bErr.message);
      else bookings = (bk || []).length;
    }
    const { data: es, error: eErr } = await db.from('estimates')
      .update({ sms_consent: false }).in('customer_phone', variants).eq('sms_consent', true).select('id');
    if (eErr) console.warn('[sms_inbound] STOP: estimates consent update failed:', eErr.message);
    else estimates = (es || []).length;
    console.log(`[sms_inbound] STOP from ...${d.slice(-4)}: sms_consent cleared on ${bookings} booking(s), ${estimates} estimate(s)`);
  } catch (e) {
    console.warn('[sms_inbound] STOP: consent update failed:', e.message);
  }
}

async function relayInboundText(line, from, body, business_name, note = '') {
  const smsTo = destinationFor(line);
  if (!(line && smsTo && body)) return;
  const digits = v => String(v || '').replace(/\D/g, '').slice(-10);
  const owner = digits(process.env.OWNER_PHONE_NUMBER);
  if (owner && digits(smsTo) === owner) return;
  try {
    const pretty = from.length === 10 ? `(${from.slice(0, 3)}) ${from.slice(3, 6)}-${from.slice(6)}` : from;
    await sendSMS(smsTo, `${pretty}: ${body}${note || ''}`);
  } catch (e) {
    console.error('[sms_inbound] relay failed:', e.message);
  }
}

async function finishSmsInbound(res, line, from, body, blocked, business_name, to, business_id) {
  const db = serviceClient();
  const keyword = smsKeyword(body);
  if (keyword === 'stop') {
    await clearSmsConsentForPhone(from);
    if (!blocked) await relayInboundText(line, from, body, business_name, ' (auto: customer opted out of texts)');
    if (!blocked && !TWILIO_OPTOUT_RE.test(body || '')) {
      const optBrand = smsBrandName(line && line.business_slug, business_name);
      const optText = optBrand === TIDYHAUS_SMS_BRAND
        ? `You are unsubscribed and will receive no further messages. Questions? Email owner@example.invalid or call +63 992 309 5621.`
        : `You are unsubscribed and will receive no further messages.`;
      await logAutomatedMessage(db, { businessId: business_id, customerPhone: from, body: optText, result: { ok: true } });
      return xml(res, `<Response><Message>${xmlEsc(optText)}</Message></Response>`);
    }
    return xml(res, '<Response/>');
  }

  if (blocked) return xml(res, '<Response/>');

  const brand = smsBrandName(line && line.business_slug, business_name);

  if (keyword === 'help') {
    if (line && line.business_slug === 'tidyhaus' && TWILIO_HELP_RE.test(body || '')) {
      await relayInboundText(line, from, body, business_name, ' (auto: HELP reply sent)');
      console.log(`[sms_inbound] HELP from ...${String(from || '').slice(-4)}: bare keyword, answered by Twilio, relayed to staff`);
      return xml(res, '<Response/>');
    }
    const ld = tenDigits(line && line.phone);
    const contact = brand === TIDYHAUS_SMS_BRAND
      ? 'call +63 992 309 5621, email owner@example.invalid or visit tidyhausph.com'
      : (ld.length === 10 ? `call or text (${ld.slice(0, 3)}) ${ld.slice(3, 6)}-${ld.slice(6)}` : 'reply here and a team member will help you');
    await relayInboundText(line, from, body, business_name, ' (auto: HELP reply sent)');
    console.log(`[sms_inbound] HELP from ...${String(from || '').slice(-4)}: answered with support contact, relayed to staff`);
    const helpText = `For help ${contact}.`;
    await logAutomatedMessage(db, { businessId: business_id, customerPhone: from, body: helpText, result: { ok: true } });
    return xml(res, `<Response><Message>${xmlEsc(helpText)}</Message></Response>`);
  }

  if (keyword === 'start') {
    await relayInboundText(line, from, body, business_name, ' (auto: START keyword)');
    return xml(res, '<Response/>');
  }

  await relayInboundText(line, from, body, business_name);

  if (!(await shouldAutoAck(from, to, body))) return xml(res, '<Response/>');
  const ackText = `Thanks for your text! A team member will reply shortly.`;
  await logAutomatedMessage(db, { businessId: business_id, customerPhone: from, body: ackText, result: { ok: true } });
  return xml(res, `<Response><Message>${xmlEsc(ackText)}</Message></Response>`);
}

const TAPBACK_RE = /^(Liked|Loved|Disliked|Laughed at|Emphasized|Questioned|Reacted [^ ]+ to)\s+[“"']/i;
async function shouldAutoAck(from, to, body) {
  if (!from || !to) return false;
  if (TAPBACK_RE.test(String(body || '').trim())) return false;
  if (/^\S{1,8}\s+to\s+[“”"]/u.test(String(body || '').trim()) && !/^[a-z0-9]/i.test(String(body || '').trim())) return false;
  try {
    const db = serviceClient();
    const last10 = String(from).replace(/\D/g, '').slice(-10);
    const [techs, staff] = await Promise.all([
      db.from('technicians').select('id').or(`phone.eq.${last10},phone.eq.+1${last10},phone.eq.1${last10}`).limit(1),
      db.from('staff_users').select('id').or(`phone.eq.${last10},phone.eq.+1${last10},phone.eq.1${last10}`).limit(1),
    ]);
    if ((techs.data || []).length || (staff.data || []).length) return false;
    if ((await smsOptOutState(db, from)) !== false) return false;
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.from('messages').select('id')
      .eq('our_phone', to).eq('customer_phone', from).gte('created_at', since).limit(2);
    if (error) return false;
    return (data || []).length < 2;
  } catch (e) {
    console.warn('[sms_inbound] auto-ack check failed:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  const action = (req.query.action || '').toString();
  if (req.method === 'POST' && action === 'sms_status') return handleTwilioStatus(req, res);
  if (req.method === 'POST' && action === 'sms_inbound') return handleSmsInbound(req, res);
  if (req.method === 'POST' && action === 'email_webhook') return handleResendWebhook(req, res);
  if (req.method === 'POST' && action === 'voice_inbound') return handleVoiceInbound(req, res);
  if (req.method === 'POST' && action === 'voice_whisper') return handleVoiceWhisper(req, res);
  if (req.method === 'POST' && action === 'voice_status') return handleVoiceStatus(req, res);
  if (req.method === 'POST' && action === 'voice_recording') return handleVoiceRecording(req, res);
  if (req.method === 'POST' && action === 'vi_webhook') {
    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    const tsid = String(b.transcript_sid || b.TranscriptSid || (req.query && req.query.transcript_sid) || '');
    try { await finishTranscript(serviceClient(), tsid); } catch (e) { console.error('[vi_webhook]', e.message); }
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'POST' && action === 'voice_gather') return handleVoiceGather(req, res);
  if (req.method === 'POST' && action === 'voice_bot_start') return handleVoiceBotStart(req, res);
  if (req.method === 'POST' && action === 'voice_bot_turn') return handleVoiceBotTurn(req, res);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Missing Supabase credentials' });
    }
    const supabase = serviceClientPublic();

    const WIDGET = (req.query.widget || 'tidyhaus').toString();
    const validWidget = WIDGET === 'tidyhaus-handyman' || WIDGET === 'doms-handyman'
      ? true
      : !!(await serviceClient().from('businesses')
          .select('id').eq('active', true).eq('analytics_config->>funnel_backend', WIDGET).limit(1)).data?.length;
    if (!validWidget) {
      return res.status(400).json({ error: 'Invalid widget' });
    }
    const { STEPS, stepIndexOf, lastStepIdx } = stepConfigFor(WIDGET);

    const days = Math.max(0, parseInt(req.query.days ?? '30', 10) || 0);
    const sinceISO = req.query.from
      ? new Date(req.query.from).toISOString()
      : (days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null);
    const untilISO = req.query.to ? new Date(req.query.to).toISOString() : null;

    const events = [];
    for (let page = 0; page < 30; page++) {
      let q = supabase.from('events').select('*').eq('widget', WIDGET)
        .order('created_at', { ascending: true })
        .range(page * 1000, page * 1000 + 999);
      if (sinceISO) q = q.gte('created_at', sinceISO);
      if (untilISO) q = q.lte('created_at', untilISO);
      const { data, error } = await q;
      if (error) throw error;
      events.push(...data.filter(e => !isBotUserAgent(e.browser)));
      if (data.length < 1000) break;
    }

    const sessions = new Map();
    let zipServed = 0, zipUnserved = 0;
    const unservedZips = {};

    for (const e of events) {
      let s = sessions.get(e.session_id);
      if (!s) {
        s = {
          id: e.session_id,
          visitor: e.session_id.includes('.') ? e.session_id.split('.')[0] : e.session_id,
          firstTs: null, lastTs: null,
          device: null, source: null, browser: null, customer: null, coupon: null, couponSeen: false,
          city: null, state: null, zip: null,
          maxStep: -1, booked: false, bookedValue: null, bookedTs: null,
          priceShown: false, lastPrice: null,
          answers: [], errors: [], failed: false, eventCount: 0,
        };
        sessions.set(e.session_id, s);
      }
      const ts = new Date(e.created_at).getTime();
      if (s.firstTs === null || ts < s.firstTs) s.firstTs = ts;
      if (s.lastTs === null || ts > s.lastTs) s.lastTs = ts;
      s.eventCount++;
      if (!s.device && e.device_type) s.device = e.device_type;
      if (!s.source && e.traffic_source) s.source = e.traffic_source;
      if (!s.browser && e.browser) s.browser = parseBrowser(e.browser);
      if (e.customer_name && String(e.customer_name).trim()) s.customer = String(e.customer_name).trim();
      if (e.city) s.city = e.city;
      if (e.state) s.state = e.state;
      if (e.zip_code) s.zip = e.zip_code;

      const t = e.event_type;
      if (t === 'step_view' || t === 'page_view') {
        const i = stepIndexOf(e.step_name);
        if (i > s.maxStep) s.maxStep = i;
      } else if (t === 'price_displayed') {
        s.priceShown = true;
        const v = Number(e.value);
        if (!isNaN(v) && v > 0) s.lastPrice = v;
        if (lastStepIdx > s.maxStep) s.maxStep = lastStepIdx;
      } else if (t === 'booking_confirmed') {
        s.booked = true;
        s.bookedTs = ts;
        const v = Number(e.value);
        if (!isNaN(v) && v > 0) s.bookedValue = v;
        if (lastStepIdx > s.maxStep) s.maxStep = lastStepIdx;
      } else if (t === 'answer' && e.step_name) {
        s.answers.push(e.step_name);
        if (e.step_name.startsWith('coupon:')) s.coupon = e.step_name.slice(7);
        if (e.step_name === 'exit_intent_shown') s.couponSeen = true;
      } else if (t === 'booking_failed' || t === 'error' || t === 'form_error') {
        s.errors.push({ type: t, step: e.step_name, message: e.error_message, at: e.created_at });
        if (t === 'booking_failed') s.failed = true;
      } else if (t === 'zip_check') {
        s.zipEntered = true;
        if (e.step_name === 'served') zipServed++;
        else if (e.step_name === 'unserved') {
          zipUnserved++;
          const z = e.error_message || e.zip_code;
          if (z) unservedZips[z] = (unservedZips[z] || 0) + 1;
        }
      }
    }

    const sess = [...sessions.values()];
    const totalSessions = sess.length;
    const bookings = sess.filter(s => s.booked);
    const revenue = bookings.reduce((n, s) => n + (s.bookedValue || 0), 0);

    const funnel = STEPS.map((st, i) => {
      const reached = sess.filter(s => s.maxStep >= i).length;
      const droppedHere = sess.filter(s => s.maxStep === i && !s.booked).length;
      return { key: st.key, label: st.label, reached, droppedHere };
    });

    function breakdown(keyFn, limit) {
      const m = {};
      for (const s of sess) {
        const k = keyFn(s) || 'unknown';
        if (!m[k]) m[k] = { sessions: 0, bookings: 0, revenue: 0 };
        m[k].sessions++;
        if (s.booked) { m[k].bookings++; m[k].revenue += s.bookedValue || 0; }
      }
      let rows = Object.entries(m).map(([k, v]) => ({
        key: k, ...v,
        conv: v.sessions ? round1(v.bookings / v.sessions * 100) : 0,
        revenue: Math.round(v.revenue * 100) / 100,
      })).sort((a, b) => b.sessions - a.sessions);
      if (limit) rows = rows.slice(0, limit);
      return rows;
    }
    const byDevice = breakdown(s => s.device);
    const bySource = breakdown(s => s.source, 12);
    const byBrowser = breakdown(s => s.browser, 8);
    const byCity = breakdown(s => s.city, 12);
    const byState = breakdown(s => s.state, 8);
    const byZip = breakdown(s => s.zip, 15);

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: 0, bookings: 0 }));
    const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const byDow = DOWS.map(d => ({ day: d, sessions: 0, bookings: 0 }));
    const byDate = {};
    for (const s of sess) {
      if (s.firstTs === null) continue;
      byHour[tzHour(s.firstTs)].sessions++;
      const dw = byDow.find(x => x.day === tzDow(s.firstTs));
      if (dw) dw.sessions++;
      const ds = tzDate(s.firstTs);
      if (!byDate[ds]) byDate[ds] = { date: ds, sessions: 0, bookings: 0 };
      byDate[ds].sessions++;
      if (s.booked && s.bookedTs) {
        byHour[tzHour(s.bookedTs)].bookings++;
        const bw = byDow.find(x => x.day === tzDow(s.bookedTs));
        if (bw) bw.bookings++;
        const bds = tzDate(s.bookedTs);
        if (!byDate[bds]) byDate[bds] = { date: bds, sessions: 0, bookings: 0 };
        byDate[bds].bookings++;
      }
    }
    const timeline = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

    const durations = sess
      .filter(s => s.eventCount > 1 && s.lastTs > s.firstTs)
      .map(s => Math.min((s.lastTs - s.firstTs) / 1000, 7200));
    const timesToBook = bookings
      .filter(s => s.bookedTs && s.bookedTs > s.firstTs)
      .map(s => Math.min((s.bookedTs - s.firstTs) / 1000, 7200));

    const byVisitor = {};
    for (const s of sess) (byVisitor[s.visitor] = byVisitor[s.visitor] || []).push(s);
    const visitors = Object.keys(byVisitor).length;
    const repeatVisitorSessions = Object.values(byVisitor).filter(a => a.length > 1);
    const repeatVisitors = repeatVisitorSessions.length;
    const bookingsFromRepeat = repeatVisitorSessions.reduce((n, a) => n + a.filter(s => s.booked).length, 0);

    const answersMap = {};
    for (const s of sess) {
      for (const a of new Set(s.answers)) {
        const ci = a.indexOf(':');
        if (ci < 1) continue;
        const q = a.slice(0, ci), ans = a.slice(ci + 1);
        if (!ans) continue;
        if (!answersMap[q]) answersMap[q] = {};
        if (!answersMap[q][ans]) answersMap[q][ans] = { picked: 0, booked: 0 };
        answersMap[q][ans].picked++;
        if (s.booked) answersMap[q][ans].booked++;
      }
    }
    const answers = Object.entries(answersMap).map(([question, opts]) => ({
      question,
      options: Object.entries(opts).map(([answer, v]) => ({
        answer, ...v,
        conv: v.picked ? round1(v.booked / v.picked * 100) : 0,
      })).sort((a, b) => b.picked - a.picked).slice(0, 20),
    }));

    const allErrors = sess.flatMap(s => s.errors.map(e => ({ ...e, session: s.id })));
    allErrors.sort((a, b) => new Date(b.at) - new Date(a.at));
    const errorsByStep = {};
    for (const e of allErrors) {
      const k = e.step || 'unknown';
      errorsByStep[k] = (errorsByStep[k] || 0) + 1;
    }
    const failedNeverBooked = sess.filter(s => s.failed && !s.booked).length;

    const abandoned = sess.filter(s => s.priceShown && !s.booked);
    const lostValue = abandoned.reduce((n, s) => n + (s.lastPrice || 0), 0);

    const recentSessions = [...sess]
      .filter(s => s.booked || (s.lastTs - s.firstTs) / 1000 >= 10)
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 30)
      .map(s => ({
        when: new Date(s.lastTs).toISOString(),
        device: s.device, source: s.source, browser: s.browser, customer: s.customer, coupon: s.coupon, couponSeen: s.couponSeen,
        city: s.city, zip: s.zip,
        furthest: s.booked ? 'Booked' : (STEPS[s.maxStep]?.label || '—'),
        booked: s.booked,
        value: s.booked ? s.bookedValue : s.lastPrice,
        durationSec: s.lastTs > s.firstTs ? Math.round((s.lastTs - s.firstTs) / 1000) : 0,
        isRepeat: (byVisitor[s.visitor] || []).length > 1,
        hadError: s.errors.length > 0,
      }));

    res.json({
      widget: WIDGET,
      rangeDays: days,
      timezone: TZ,
      lastUpdated: new Date().toISOString(),
      totals: {
        sessions: totalSessions,
        visitors,
        repeatVisitors,
        bookings: bookings.length,
        bookingsFromRepeat,
        zipSessions: sess.filter(s => s.zipEntered || s.booked).length,
        conversion: sess.filter(s => s.zipEntered || s.booked).length ? round1(bookings.length / sess.filter(s => s.zipEntered || s.booked).length * 100) : 0,
        priceShown: sess.filter(s => s.priceShown).length,
        priceToBooking: sess.filter(s => s.priceShown).length
          ? round1(bookings.length / sess.filter(s => s.priceShown).length * 100) : 0,
        revenue: Math.round(revenue * 100) / 100,
        avgTicket: bookings.length ? Math.round(revenue / bookings.length * 100) / 100 : 0,
        abandonedCarts: abandoned.length,
        lostValue: Math.round(lostValue * 100) / 100,
        medianSessionSec: median(durations) !== null ? Math.round(median(durations)) : null,
        medianTimeToBookSec: median(timesToBook) !== null ? Math.round(median(timesToBook)) : null,
        bounces: sess.filter(s => s.maxStep <= 0 && !s.booked).length,
        zipServed, zipUnserved,
        bookingFailures: allErrors.filter(e => e.type === 'booking_failed').length,
        failedNeverBooked,
      },
      funnel,
      byDevice, bySource, byBrowser, byCity, byState, byZip,
      byHour, byDow, timeline,
      answers,
      unservedZips: Object.entries(unservedZips).map(([zip, count]) => ({ zip, count }))
        .sort((a, b) => b.count - a.count).slice(0, 15),
      errors: { recent: allErrors.slice(0, 20), byStep: errorsByStep },
      recentSessions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
