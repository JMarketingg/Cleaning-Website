// Opt-out link: tidyhausph.com/stop/<token>. Adds the customer to the do-not-contact list for good.
const { crm } = require('./_crm');
module.exports = async function handler(req, res) {
  const token = String((req.query || {}).t || '');
  let ok = false;
  if (/^[A-Za-z0-9_-]{6,64}$/.test(token) && process.env.SUPABASE_URL) {
    try {
      const [b] = await crm(`bookings?select=id,customer:customers(phone,email)&review_token=eq.${token}&limit=1`);
      if (b && b.customer && (b.customer.phone || b.customer.email)) {
        await crm('review_do_not_contact?on_conflict=phone', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ phone: b.customer.phone || ('email:' + String(b.customer.email).toLowerCase()), email: b.customer.email ? String(b.customer.email).toLowerCase() : null, reason: 'customer opted out', booking_id: b.id }) });
        ok = true;
      }
    } catch (e) { console.error('[stop]', e.message); }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>TidyHaus</title><body style="font-family:Arial,sans-serif;background:#F6F2EA;color:#26372D;padding:40px 20px;text-align:center">
<h1 style="font-size:22px">${ok ? "You won't get review requests from us again." : 'This link has expired.'}</h1>
<p>${ok ? 'Thank you, and sorry for the bother.' : 'Text or call us at +63 992 309 5621 and we will stop the messages.'}</p><p><a href="https://tidyhausph.com" style="color:#344B38">tidyhausph.com</a></p></body>`);
};
