// Review link: tidyhausph.com/r/<token>. The customer rates the cleaning first.
//  5 stars  -> big "Post on Google" button.
//  1-4 stars -> "Sorry we missed the mark": offer the complaint form, and still offer Google
//              (every customer can always post on Google; we never hide it).
// Complaint form: what happened, how to improve, emergency (damage, leak, safety), anonymous.
// Complaints are saved on the job, stop further review reminders, and alert the owner on Telegram.
const { crm } = require('./_crm');
const GOOGLE = 'https://g.page/r/CVupIA7gzCvJEBM/review';
const ok = (t) => /^[A-Za-z0-9_-]{6,64}$/.test(t);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function telegram(text) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try { await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }) }); } catch (e) { console.error('[r tg]', e.message); }
}
async function findJob(token) {
  const [b] = await crm(`bookings?select=id,metadata,review_rating,customer:customers(name,phone),technician:technicians!bookings_technician_id_fkey(name)&review_token=eq.${token}&limit=1`);
  return b || null;
}

module.exports = async function handler(req, res) {
  const token = String((req.query || {}).t || '');
  const ch = (req.query || {}).c === 'sms' ? 'sms' : (req.query || {}).c === 'email' ? 'email' : 'link';

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!ok(token)) return res.status(400).json({ ok: false });
    const b = await findJob(token).catch(() => null);
    if (!b) return res.status(404).json({ ok: false });
    const meta = b.metadata || {};
    if (body.action === 'rate') {
      const r = Math.max(1, Math.min(5, Number(body.rating) || 0));
      await crm(`bookings?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ review_rating: r, reviewed_at: new Date().toISOString() }) });
      if (r <= 4) await telegram(`⭐ ${r}-star rating from ${b.customer?.name || 'a customer'} (cleaner: ${b.technician?.name || '—'}). Check the CRM.`);
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'complaint') {
      const c = { what: String(body.what || '').slice(0, 1500), improve: String(body.improve || '').slice(0, 1500), emergency: body.emergency === true, anonymous: body.anonymous === true, at: new Date().toISOString() };
      await crm(`bookings?id=eq.${b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ review_req_complaint: true, review_text: c.what, metadata: { ...meta, complaint: c } }) });
      const who = c.anonymous ? 'a customer (asked to stay anonymous to the cleaner)' : `${b.customer?.name || 'a customer'} ${b.customer?.phone || ''}`;
      await telegram(`${c.emergency ? '🚨 EMERGENCY ' : '⚠️ '}Complaint from ${who}\nCleaner: ${b.technician?.name || '—'}\nWhat happened: ${c.what || '—'}\nHow to improve: ${c.improve || '—'}\nCall them back soon.`);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false });
  }

  // GET: save the click, then show the rating page.
  let first = 'there';
  if (ok(token) && process.env.SUPABASE_URL) {
    try {
      const now = new Date().toISOString();
      const col = ch === 'sms' ? 'review_sms_clicked_at' : ch === 'email' ? 'review_email_clicked_at' : null;
      const writes = [crm(`bookings?review_token=eq.${token}&review_clicked_at=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ review_clicked_at: now, review_click_channel: ch }) })];
      if (col) writes.push(crm(`bookings?review_token=eq.${token}&${col}=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ [col]: now }) }));
      const job = findJob(token).then((b) => { if (b && b.customer && b.customer.name) first = b.customer.name.split(' ')[0]; }).catch(() => {});
      await Promise.race([Promise.all([...writes, job]), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { console.error('[r]', e.message); }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>How did we do? · TidyHaus</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;background:#F6F2EA;color:#26372D;font:16px/1.5 Nunito,system-ui,sans-serif}
.w{max-width:440px;margin:0 auto;padding:28px 18px}.c{background:#fff;border-radius:24px;padding:26px 22px;box-shadow:0 8px 24px rgba(52,75,56,.08);text-align:center}
.logo{font-weight:900;font-size:18px;margin-bottom:14px;color:#344B38}h1{font-size:24px;margin:0 0 6px}p{color:#4D5C50;margin:0 0 14px}
.st{display:flex;justify-content:center;gap:8px;margin:14px 0 6px}.st button{background:none;border:0;font-size:42px;cursor:pointer;color:#D9D4C4;padding:0;line-height:1}.st button.on{color:#F2B705}
.b{display:block;width:100%;border:0;border-radius:999px;padding:14px;font:800 16px Nunito,sans-serif;margin-top:10px;cursor:pointer;text-decoration:none;text-align:center}
.p{background:#344B38;color:#fff}.g{background:#EAF0E6;color:#26372D}.t{background:none;color:#6E7D70;text-decoration:underline}
label{display:block;text-align:left;font-weight:800;font-size:14px;margin:12px 0 4px}textarea{width:100%;border:1px solid #E6E3D5;border-radius:14px;padding:10px;font:inherit;min-height:80px}
.yn{display:flex;gap:8px}.yn button{flex:1;border:1px solid #E6E3D5;background:#fff;border-radius:12px;padding:10px;font:800 15px Nunito,sans-serif;cursor:pointer}.yn button.on{background:#344B38;color:#fff;border-color:#344B38}
.hint{font-size:12px;color:#6E7D70;text-align:left;margin-top:4px}.chk{display:flex;gap:8px;align-items:center;text-align:left;font-weight:700;font-size:14px;margin-top:12px}
.alert{background:#FDECEC;color:#8B1E1E;border-radius:14px;padding:10px;font-weight:800;margin-top:10px}[hidden]{display:none!important}</style></head><body><div class="w">
<div class="c" id="s1"><div class="logo">🏠 TidyHaus</div><h1>How was your cleaning, ${esc(first)}?</h1><p>Tap a star.</p>
<div class="st" id="stars">${[1,2,3,4,5].map((n)=>`<button data-n="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}</div></div>
<div class="c" id="s5" hidden><div class="logo">🏠 TidyHaus</div><h1>Thank you so much! 💚</h1><p>Would you share it on Google? It takes a minute and really helps a small business like ours.</p>
<a class="b p" href="${GOOGLE}">Post on Google</a><button class="b t" onclick="done()">Maybe later</button></div>
<div class="c" id="s2" hidden><div class="logo">🏠 TidyHaus</div><h1>Sorry we missed the mark</h1><p>Would you like to tell us what happened? We read every one, and we'll make it right.</p>
<button class="b p" onclick="show('s3')">Submit a complaint</button><a class="b g" href="${GOOGLE}">Post on Google</a><button class="b t" onclick="done()">No thanks</button></div>
<div class="c" id="s3" hidden><div class="logo">🏠 TidyHaus</div><h1>Tell us what happened</h1>
<label for="what">What happened, or what was wrong?</label><textarea id="what"></textarea>
<label for="imp">How can we improve?</label><textarea id="imp"></textarea>
<label>Is this an emergency?</label><div class="yn" id="em"><button data-v="1">Yes</button><button data-v="0" class="on">No</button></div>
<div class="hint">For example: something broken or damaged, water left running or a flooded floor, a strong chemical smell, a missing item, or a safety risk.</div>
<label class="chk"><input type="checkbox" id="anon"> Keep my name from the cleaner (submit anonymously)</label>
<button class="b p" id="send">Send</button></div>
<div class="c" id="s4" hidden><div class="logo">🏠 TidyHaus</div><h1>✓ We got your complaint</h1><p>Jiyah, the owner, will reach out to you soon to make it right.</p>
<div class="alert" id="emok" hidden>🚨 We marked this as an emergency and alerted the owner right now.</div></div>
<div class="c" id="s6" hidden><div class="logo">🏠 TidyHaus</div><h1>Thank you! 💚</h1><p>We appreciate you choosing TidyHaus.</p></div>
</div><script>
var T=${JSON.stringify(token)}, em=false;
function post(d){ return fetch('/api/r?t='+encodeURIComponent(T),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(d)}).catch(function(){}); }
function show(id){ ['s1','s2','s3','s4','s5','s6'].forEach(function(x){ document.getElementById(x).hidden=x!==id; }); window.scrollTo(0,0); }
function done(){ show('s6'); }
document.querySelectorAll('#stars button').forEach(function(b){ b.onclick=function(){ var n=+b.dataset.n;
  document.querySelectorAll('#stars button').forEach(function(x){ x.classList.toggle('on',+x.dataset.n<=n); });
  post({action:'rate',rating:n}); setTimeout(function(){ show(n===5?'s5':'s2'); },350); }; });
document.querySelectorAll('#em button').forEach(function(b){ b.onclick=function(){ em=b.dataset.v==='1'; document.querySelectorAll('#em button').forEach(function(x){ x.classList.toggle('on',x===b); }); }; });
document.getElementById('send').onclick=function(){ var s=this; s.disabled=true; s.textContent='Sending…';
  post({action:'complaint',what:document.getElementById('what').value,improve:document.getElementById('imp').value,emergency:em,anonymous:document.getElementById('anon').checked})
  .then(function(){ document.getElementById('emok').hidden=!em; show('s4'); }); };
</script></body></html>`);
};
