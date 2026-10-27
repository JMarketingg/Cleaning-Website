import crypto from 'node:crypto';
import { signToken, verifyToken } from './auth.js';
import { REVIEW_LINK_PREFIX } from './review-token.js';

function mac(body) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-insecure-secret-change-me')
    .update('estimate-code:v1:').update(body).digest().subarray(0, 12);
}

export function compactEstimateToken(token) {
  const payload = verifyToken(token);
  if (!payload || payload.kind !== 'estimate_approve' ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.estimate_id || '') ||
      !Number.isInteger(payload.exp) || payload.exp > 0xffffffff) return token;
  const body = Buffer.alloc(20);
  Buffer.from(payload.estimate_id.replaceAll('-', ''), 'hex').copy(body);
  body.writeUInt32BE(payload.exp, 16);
  return Buffer.concat([body, mac(body)]).toString('base64url');
}

export function expandEstimateCode(code) {
  if (typeof code !== 'string') return null;
  if (code.includes('.')) return null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) return null;
  const bytes = Buffer.from(code, 'base64url');
  if (bytes.toString('base64url') !== code || bytes.length !== 32) return null;
  const body = bytes.subarray(0, 20);
  if (!crypto.timingSafeEqual(mac(body), bytes.subarray(20))) return null;
  const ttl = body.readUInt32BE(16) - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return null;
  const hex = body.subarray(0, 16).toString('hex');
  const estimate_id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  return signToken({ kind: 'estimate_approve', estimate_id }, ttl);
}

export function estimateApproveLink({ slug, token, fallbackUrl }) {
  const prefix = REVIEW_LINK_PREFIX[slug];
  const code = token ? compactEstimateToken(token) : null;
  return (prefix && code) ? `${prefix}${encodeURIComponent(code)}` : (fallbackUrl || '');
}
