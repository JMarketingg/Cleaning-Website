import { sendEmail, reviewEmail, brandFor, emailConfig } from './email.js';

export async function runScheduledReviewEmails(db) {
  const nowIso = new Date().toISOString();
  const { data, error } = await db.from('bookings')
    .select('id, business_id, review_token, metadata, review_email_count, business:businesses ( slug ), customer:customers ( name, email, phone )')
    .not('metadata->review_email_sched', 'is', null).limit(50);
  if (error) throw error;
  const out = [];
  for (const b of data || []) {
    const sc = b.metadata && b.metadata.review_email_sched;
    if (!sc || sc.sent_at || !sc.at || sc.at > nowIso) continue;
    const slug = b.business?.slug || 'tidyhaus';
    const to = b.customer?.email;
    let ok = false, err = null;
    if (to && b.review_token) {
      const baseUrl = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const clickUrl = `${baseUrl}/api/book?action=review_click&token=${encodeURIComponent(b.review_token)}&ch=email`;
      const { from } = emailConfig(slug);
      const { subject, html } = reviewEmail({ firstName: b.customer.name || 'there', clickUrl }, brandFor(slug));
      try { await sendEmail({ slug, to, subject: sc.subject || subject, html, replyTo: from, throwOnError: true }); ok = true; }
      catch (e) { err = e.message || 'failed'; }
    } else err = to ? 'no review link' : 'no email on file';
    const now = new Date().toISOString();
    const md = { ...(b.metadata || {}), review_email_sched: { ...sc, sent_at: now, ok, error: err }, ...(ok ? { review_email_sent_at: now } : {}) };
    await db.from('bookings').update({ metadata: md }).eq('id', b.id);
    if (ok) { try { await db.from('bookings').update({ review_email_sent_at: now, review_email_count: (Number(b.review_email_count) || 0) + 1, review_email_status: 'sent' }).eq('id', b.id); } catch (_) {} }
    const logBody = ok ? `[Email] Review request "${sc.subject}" sent to ${to}` : `Review request email FAILED: ${err}`;
    const phone = String(b.customer?.phone || '').replace(/\D/g, '').slice(-10);
    if (phone) await db.from('messages').insert({ business_id: b.business_id, customer_phone: phone, our_phone: String(process.env.TWILIO_PHONE_NUMBER || '').replace(/\D/g, '').slice(-10), direction: 'out', body: logBody, status: ok ? 'sent' : 'failed', error: ok ? null : err, sent_by: 'automated' });
    await db.from('booking_notes').insert({ booking_id: b.id, business_id: b.business_id, body: logBody, author_kind: 'owner', author_id: null, author_name: 'Automated' });
    out.push({ id: b.id, ok, err });
  }
  return out;
}
