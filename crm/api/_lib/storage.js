import crypto from 'crypto';

const BUCKET = 'booking-photos';

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { const e = new Error('Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).'); e.status = 500; throw e; }
  return { url: url.replace(/\/$/, ''), key };
}

function decodeDataUrl(input) {
  if (!input || typeof input !== 'string') { const e = new Error('No image data provided.'); e.status = 400; throw e; }
  let mime = 'image/jpeg';
  let b64 = input;
  const m = input.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) { mime = m[1]; b64 = m[2]; }
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) {
    const e = new Error('Only JPEG, PNG, WebP, or HEIC photos are allowed.'); e.status = 400; throw e;
  }
  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) { const e = new Error('Image data is empty.'); e.status = 400; throw e; }
  if (buffer.length > 8 * 1024 * 1024) { const e = new Error('Image is too large. Please retake at lower quality.'); e.status = 413; throw e; }
  return { mime, buffer };
}

export const NOTE_PHOTO_CONTENT_TYPES = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
};
export function notePhotoContentType(pathOrUrl) {
  const ext = String(pathOrUrl || '').split('.').pop().toLowerCase();
  return NOTE_PHOTO_CONTENT_TYPES[ext] || 'application/octet-stream';
}

function extFor(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

export async function uploadImage(dataUrl, prefix) {
  const { url, key } = cfg();
  const { mime, buffer } = decodeDataUrl(dataUrl);
  const path = `${prefix}/${crypto.randomUUID()}.${extFor(mime)}`;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': '3600' },
    body: buffer,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const e = new Error(`Photo upload failed (${res.status}). ${t.slice(0, 200)}`); e.status = 502; throw e;
  }
  return { path, url: `${url}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}` };
}

export const VIDEO_BUCKET = 'job-videos';
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v' };
export async function signVideoUpload(prefix, mime) {
  const ext = VIDEO_EXT[mime];
  if (!ext) { const e = new Error('Only MP4, MOV or WebM videos are allowed.'); e.status = 400; throw e; }
  const { url, key } = cfg();
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/upload/sign/${VIDEO_BUCKET}/${encodeURI(path)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) { const e = new Error(`Could not start the video upload (${res.status}).`); e.status = 502; throw e; }
  return { path, upload_url: `${url}/storage/v1${j.url}`, url: `${url}/storage/v1/object/public/${VIDEO_BUCKET}/${encodeURI(path)}` };
}
export function videoPublicUrl(path) {
  const { url } = cfg();
  return `${url}/storage/v1/object/public/${VIDEO_BUCKET}/${encodeURI(path)}`;
}
export async function deleteVideo(path) {
  if (!path) return;
  const { url, key } = cfg();
  try { await fetch(`${url}/storage/v1/object/${VIDEO_BUCKET}/${encodeURI(path)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } }); } catch { /* non-fatal */ }
}

export async function deleteImage(path) {
  if (!path) return;
  const { url, key } = cfg();
  try {
    await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${key}` },
    });
  } catch { /* non-fatal: the DB row is the source of truth */ }
}

const PRIVATE_BUCKET = 'note-photos';
export async function uploadPrivateImage(dataUrl, prefix) {
  const { url, key } = cfg();
  const { mime, buffer } = decodeDataUrl(dataUrl);
  const path = `${prefix}/${crypto.randomUUID()}.${extFor(mime)}`;
  const res = await fetch(`${url}/storage/v1/object/${PRIVATE_BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': '3600' },
    body: buffer,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const e = new Error(`Photo upload failed (${res.status}). ${t.slice(0, 200)}`); e.status = 502; throw e;
  }
  return { path: `priv:${path}` };
}

export async function readPrivateImage(path) {
  const { url, key } = cfg();
  const res = await fetch(`${url}/storage/v1/object/${PRIVATE_BUCKET}/${encodeURI(path)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) { const e = new Error('Photo not found.'); e.status = 404; throw e; }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

export async function deletePrivateImage(path) {
  if (!path) return;
  const { url, key } = cfg();
  try {
    await fetch(`${url}/storage/v1/object/${PRIVATE_BUCKET}/${encodeURI(path)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${key}` },
    });
  } catch { /* non-fatal */ }
}
