// TidyHaus screens added to the CRM: Quote Requests (and more below).
(function () {
  var LABELS = {
    area: { makati: 'Makati', bgc: 'BGC (Taguig)' },
    service: { standard: 'Standard Home Cleaning', condo: 'Condo Cleaning', deep: 'Deep Cleaning', move: 'Move-in / Move-out', airbnb: 'Airbnb & Rental', office: 'Office Cleaning' },
    place: { house: 'House or townhouse', apartment: 'Apartment', condo: 'Condo unit', office: 'Office' },
    frequency: { once: 'One time', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' },
    time: { morning: 'Morning (8 AM to 12 PM)', afternoon: 'Afternoon (1 PM to 5 PM)', flexible: 'Any time' }
  };
  function lab(k, v) { return (LABELS[k] && LABELS[k][v]) || v || ''; }
  function e(s) { return window.esc ? window.esc(s) : String(s == null ? '' : s); }
  function view() { return document.getElementById('view'); }

  function navButton(id, icon, text, after, onClick) {
    var nav = document.getElementById('sideNav');
    if (!nav || document.getElementById(id)) return;
    var b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.innerHTML = '<span class="ic">' + icon + '</span> ' + text + ' <span class="nav-badge" id="' + id + 'Badge" style="display:none;"></span>';
    var ref = nav.querySelector(':scope > [data-nav="' + after + '"]');
    if (ref && ref.nextSibling) nav.insertBefore(b, ref.nextSibling); else nav.appendChild(b);
    nav.addEventListener('click', function (ev) { if (!b.contains(ev.target)) b.classList.remove('on'); });
    b.addEventListener('click', function () {
      if (typeof window.navTo === 'function') window.navTo('other');
      nav.querySelectorAll(':scope > button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      var mt = document.getElementById('mobTitle'); if (mt) mt.textContent = text;
      onClick();
    });
  }

  // ── Quote Requests ────────────────────────────────────────────────────────
  var qrFilter = 'open';
  function qrBadge(n) {
    var el = document.getElementById('navQuotesBadge');
    if (el) { el.textContent = n; el.style.display = n ? '' : 'none'; }
  }
  function loadQuoteBadge() { window.api('quote_requests', { params: { status: 'new' } }).then(function (d) { qrBadge(d.new_count || 0); }).catch(function () {}); }

  function renderQuotes() {
    var v = view();
    v.innerHTML = '<div class="wrap"><div class="empty">Loading…</div></div>';
    window.api('quote_requests', { params: { status: qrFilter } }).then(function (d) {
      qrBadge(d.new_count || 0);
      var tabs = [['open', 'To do'], ['booked', 'Booked'], ['declined', 'Declined'], ['all', 'All']].map(function (t) {
        return '<button type="button" class="seg-btn ' + (qrFilter === t[0] ? 'on' : '') + '" data-qf="' + t[0] + '">' + t[1] + '</button>';
      }).join('');
      var rows = (d.requests || []).map(function (q) {
        var size = q.service === 'office' || q.place === 'office' ? lab('office_size', q.office_size) : [q.bedrooms && (q.bedrooms + (q.bedrooms === 'studio' ? '' : ' bedroom' + (q.bedrooms === '1' ? '' : 's'))), q.bathrooms && (q.bathrooms + ' bathroom' + (q.bathrooms === '1' ? '' : 's'))].filter(Boolean).join(', ');
        var when = (q.preferred_date ? new Date(q.preferred_date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }) : '') + (q.preferred_time ? ' · ' + lab('time', q.preferred_time) : '');
        var pill = { new: '#dc2626', contacted: '#d97706', booked: '#15803d', declined: '#6b7280' }[q.status];
        var sms = 'sms:' + q.phone;
        return '<div class="card" style="padding:14px;margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><b style="font-size:16px;">' + e(q.name) + '</b>' +
          '<span style="font-size:12px;font-weight:800;color:' + pill + ';text-transform:uppercase;">' + e(q.status) + '</span></div>' +
          '<div class="meta">' + e(new Date(q.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + ' · sent by ' + e(q.channel || 'website') + '</div>' +
          '<div style="margin-top:8px;line-height:1.6;">' +
          '<div><b>' + e(lab('service', q.service)) + '</b> · ' + e(lab('frequency', q.frequency)) + '</div>' +
          '<div>' + e(lab('area', q.area)) + (q.building ? ' · ' + e(q.building) : '') + '</div>' +
          (size ? '<div>' + e(lab('place', q.place)) + ' · ' + e(size) + '</div>' : '') +
          (when ? '<div>Wants: ' + e(when) + '</div>' : '') +
          (q.notes ? '<div style="white-space:pre-wrap;">Notes: ' + e(q.notes) + '</div>' : '') + '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">' +
          '<a class="btn ghost sm" style="width:auto;" href="tel:' + e(q.phone) + '">Call ' + e(q.phone) + '</a>' +
          '<a class="btn ghost sm" style="width:auto;" href="' + e(sms) + '">Text</a>' +
          (q.status !== 'booked' ? '<button type="button" class="btn sm" style="width:auto;" data-qbook="' + e(q.id) + '">Make booking</button>' : '') +
          (q.status === 'new' ? '<button type="button" class="btn ghost sm" style="width:auto;" data-qset="contacted" data-qid="' + e(q.id) + '">Mark contacted</button>' : '') +
          (q.status !== 'declined' && q.status !== 'booked' ? '<button type="button" class="btn ghost sm" style="width:auto;" data-qset="declined" data-qid="' + e(q.id) + '">Not interested</button>' : '') +
          (q.status === 'declined' ? '<button type="button" class="btn ghost sm" style="width:auto;" data-qset="new" data-qid="' + e(q.id) + '">Move back to To do</button>' : '') +
          '</div></div>';
      }).join('');
      v.innerHTML = '<div class="wrap" style="max-width:760px;"><h2 style="margin:0 0 4px;">Quote Requests</h2>' +
        '<div class="meta" style="margin-bottom:12px;">Every request sent from the quote form on tidyhausph.com.</div>' +
        '<div class="hub-tabs" style="margin-bottom:12px;">' + tabs + '</div>' +
        (rows || '<div class="empty">Nothing here.</div>') + '</div>';
      v.querySelectorAll('[data-qf]').forEach(function (b) { b.onclick = function () { qrFilter = b.dataset.qf; renderQuotes(); }; });
      v.querySelectorAll('[data-qset]').forEach(function (b) {
        b.onclick = function () {
          window.api('quote_request_set', { method: 'POST', body: { id: b.dataset.qid, status: b.dataset.qset } }).then(renderQuotes).catch(function (x) { toast(x.message); });
        };
      });
      v.querySelectorAll('[data-qbook]').forEach(function (b) {
        b.onclick = function () {
          var q = (d.requests || []).find(function (x) { return x.id === b.dataset.qbook; });
          window.openCleaningBooking({ prefill: { name: q.name, phone: q.phone, area: q.area, service: q.service, bedrooms: q.bedrooms, bathrooms: q.bathrooms,
            office_size: q.office_size, frequency: q.frequency, date: q.preferred_date, time: q.preferred_time, address: q.building, notes: q.notes },
            onSaved: function (bookingId) { window.api('quote_request_set', { method: 'POST', body: { id: q.id, booking_id: bookingId } }).then(renderQuotes).catch(function () {}); } });
        };
      });
    }).catch(function (x) { v.innerHTML = '<div class="wrap"><div class="empty">' + e(x.message) + '</div></div>'; });
  }


  // ── Payments & QR codes ───────────────────────────────────────────────────
  var payCfg = null;
  function loadPayCfg() { return window.api('payment_settings').then(function (d) { payCfg = d; return d; }); }
  function fileToDataUrl(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('Could not read that file.')); }; r.readAsDataURL(file); });
  }
  function backBtn() { return '<button class="btn ghost sm" onclick="renderOther()" style="margin-bottom:10px;width:auto;">← Other</button>'; }
  window.thRenderPayments = function () {
    var v = view();
    v.innerHTML = '<div class="wrap"><div class="empty">Loading…</div></div>';
    loadPayCfg().then(function (d) {
      var qr = (d.qr || []).map(function (q) {
        return '<div class="card" style="padding:12px;text-align:center;width:180px;"><img src="' + e(q.url) + '" alt="' + e(q.label) + ' QR" style="width:150px;height:150px;object-fit:contain;background:#fff;border-radius:8px;">' +
          '<div style="font-weight:700;margin:6px 0;">' + e(q.label) + '</div><button class="btn ghost sm" style="width:auto;" data-qrdel="' + e(q.url) + '">Remove</button></div>';
      }).join('');
      v.innerHTML = '<div class="wrap" style="max-width:760px;">' + backBtn() + '<h2 style="margin:0 0 4px;">💳 Payments & QR codes</h2>' +
        '<div class="meta" style="margin-bottom:14px;">How customers pay you. Cleaners show these QR codes on their phone after a cleaning, then tap how the customer paid.</div>' +
        '<div class="card" style="padding:14px;margin-bottom:14px;"><b>Your QR codes</b><div class="meta" style="margin:4px 0 10px;">Upload the QR from your GCash, Maya or bank app. A QR Ph code works with every bank and e-wallet in the Philippines.</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">' + (qr || '<div class="meta">No QR codes yet.</div>') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><select id="qrLabel" style="width:auto;"><option>GCash</option><option>Maya</option><option>QR Ph (any bank or e-wallet)</option><option>GoTyme</option><option>BPI</option><option>BDO</option><option>UnionBank</option></select>' +
        '<input type="file" id="qrFile" accept="image/*" style="width:auto;"><button class="btn sm" id="qrAdd" style="width:auto;">Add QR code</button></div><div class="meta" id="qrMsg" style="margin-top:6px;"></div></div>' +
        '<div class="card" style="padding:14px;"><b>Online payment links (PayMongo)</b><div class="meta" style="margin:4px 0 8px;">Text the customer a link where they can pay by QR Ph, GCash, Maya, GrabPay or card. The booking is marked paid by itself.</div>' +
        (d.paymongo_on ? '<div style="color:#15803d;font-weight:700;">✓ Turned on</div>' :
          '<div style="font-weight:700;color:#b45309;">Not set up yet</div><ol class="meta" style="margin:6px 0 0 18px;padding:0;line-height:1.7;"><li>Make a free business account at paymongo.com and get it verified.</li><li>In PayMongo, open Developers and copy your <b>secret key</b>.</li><li>Add a webhook for the event <b>checkout_session.payment.paid</b> to <code>https://tidyhaus-crm.vercel.app/api/quote?action=paymongo_webhook</code> and copy its secret.</li><li>In Vercel → tidyhaus-crm → Settings → Environment Variables, add <b>PAYMONGO_SECRET_KEY</b> and <b>PAYMONGO_WEBHOOK_SECRET</b>, then redeploy. Or ask Claude to do it.</li></ol>') +
        '</div></div>';
      v.querySelector('#qrAdd').onclick = function () {
        var f = v.querySelector('#qrFile').files[0], msg = v.querySelector('#qrMsg');
        if (!f) { msg.textContent = 'Pick the QR image first.'; return; }
        if (f.size > 4 * 1024 * 1024) { msg.textContent = 'That image is too big (max 4 MB).'; return; }
        msg.textContent = 'Uploading…';
        fileToDataUrl(f).then(function (img) { return window.api('payment_qr_add', { method: 'POST', body: { label: v.querySelector('#qrLabel').value, image: img } }); })
          .then(window.thRenderPayments).catch(function (x) { msg.textContent = x.message; });
      };
      v.querySelectorAll('[data-qrdel]').forEach(function (b) {
        b.onclick = function () { if (!confirm('Remove this QR code?')) return; window.api('payment_qr_delete', { method: 'POST', body: { url: b.dataset.qrdel } }).then(window.thRenderPayments).catch(function (x) { toast(x.message); }); };
      });
    }).catch(function (x) { v.innerHTML = '<div class="wrap">' + backBtn() + '<div class="empty">' + e(x.message) + '</div></div>'; });
  };

  function fillPayBox() {
    var box = document.getElementById('thPayBox');
    if (!box || box.dataset.done) return;
    box.dataset.done = '1';
    var id = box.dataset.bid;
    if (box.dataset.paid) {
      var m = payCfg && payCfg.methods && payCfg.methods[box.dataset.method];
      box.innerHTML = '<span class="dim">💳 Paid' + (m ? ' · ' + e(m) : '') + '</span>';
      return;
    }
    (payCfg ? Promise.resolve(payCfg) : loadPayCfg()).then(function (d) {
      var opts = ['gcash', 'maya', 'qrph', 'cash', 'bank'].map(function (k) { return '<option value="' + k + '">' + e(d.methods[k]) + '</option>'; }).join('');
      box.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;"><span class="dim">💳 Not paid yet</span>' +
        '<select id="thPayM" style="width:auto;padding:4px 8px;">' + opts + '</select><button type="button" class="btn ghost sm" style="width:auto;" id="thPayMark">Mark paid</button>' +
        (d.paymongo_on ? '<button type="button" class="btn ghost sm" style="width:auto;" id="thPayLink">Text payment link</button>' : '') + '</div><div class="dim" id="thPayMsg"></div>';
      box.querySelector('#thPayMark').onclick = function () {
        var method = box.querySelector('#thPayM').value;
        window.api('booking_mark_paid', { method: 'POST', body: { id: id, method: method } })
          .then(function () { box.innerHTML = '<span class="dim">💳 Paid · ' + e(d.methods[method]) + '</span>'; toast('Marked paid ✓'); if (typeof window.renderSchedule === 'function') window.renderSchedule(true); })
          .catch(function (x) { box.querySelector('#thPayMsg').textContent = x.message; });
      };
      var pl = box.querySelector('#thPayLink');
      if (pl) pl.onclick = function () {
        pl.disabled = true;
        window.api('booking_pay_link', { method: 'POST', body: { id: id, text: true } }).then(function (r) {
          box.querySelector('#thPayMsg').innerHTML = (r.texted ? 'Texted to the customer. ' : 'Not texted (texts are off). ') + '<a href="' + e(r.url) + '" target="_blank" rel="noopener">Open link</a>';
          try { navigator.clipboard.writeText(r.url); } catch (_) {}
        }).catch(function (x) { pl.disabled = false; box.querySelector('#thPayMsg').textContent = x.message; });
      };
    }).catch(function () {});
  }
  if (typeof window.openBooking === 'function') {
    var ob = window.openBooking;
    window.openBooking = function () { var r = ob.apply(this, arguments); setTimeout(fillPayBox, 0); return r; };
  }


  // ── Text Messages ─────────────────────────────────────────────────────────
  window.thRenderTexts = function () {
    var v = view();
    v.innerHTML = '<div class="wrap"><div class="empty">Loading…</div></div>';
    window.api('text_settings').then(function (d) {
      var row = function (k, title, sub) {
        return '<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line);"><input type="checkbox" data-tset="' + k + '"' + (d.texts[k] ? ' checked' : '') + ' style="width:auto;margin-top:3px;">' +
          '<span><b>' + title + '</b><br><span class="meta">' + sub + '</span></span></label>';
      };
      var log = (d.log || []).map(function (l) {
        var col = { sent: '#15803d', failed: '#b91c1c', skipped: '#6b7280' }[l.status];
        return '<tr><td class="meta" style="white-space:nowrap;padding:6px 8px 6px 0;">' + e(new Date(l.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + '</td>' +
          '<td style="padding:6px 8px 6px 0;">' + e(l.phone) + '</td><td style="padding:6px 8px 6px 0;">' + e(l.body) + '</td><td style="padding:6px 0;color:' + col + ';font-weight:700;" title="' + e(l.error || '') + '">' + e(l.status) + '</td></tr>';
      }).join('');
      v.innerHTML = '<div class="wrap" style="max-width:860px;">' + backBtn() + '<h2 style="margin:0 0 4px;">💬 Text Messages</h2>' +
        '<div class="meta" style="margin-bottom:12px;">Texts to customers go through Semaphore, a Philippine SMS service (about ₱0.50 per text).</div>' +
        '<div class="card" style="padding:14px;margin-bottom:12px;">' + (d.on ? '<div style="color:#15803d;font-weight:700;">✓ Texting is turned on</div>' :
          '<div style="font-weight:700;color:#b45309;">Texting is off until Semaphore is set up</div><ol class="meta" style="margin:6px 0 0 18px;padding:0;line-height:1.7;"><li>Sign up at semaphore.co and buy credits.</li><li>Optional: request a sender name such as <b>TIDYHAUS</b> so texts show your name.</li><li>Copy your API key from the Semaphore dashboard.</li><li>In Vercel → tidyhaus-crm → Settings → Environment Variables, add <b>SEMAPHORE_API_KEY</b> (and <b>SEMAPHORE_SENDER_NAME</b> once approved), then redeploy. Or ask Claude to do it.</li></ol>') +
        '<div class="meta" style="margin-top:8px;">New quote request alerts to your phone: ' + (d.owner_alerts ? 'on' : 'off (add OWNER_PHONE_NUMBER in Vercel)') + '</div></div>' +
        '<div class="card" style="padding:4px 14px 8px;margin-bottom:12px;">' +
        row('confirm', 'Booking confirmation', 'Sent when a booking is saved: day, time and total.') +
        row('reminder', 'Reminder the day before', 'Sent at 6 PM the evening before each cleaning.') +
        row('otw', 'On the way', 'Sent when the cleaner taps “I’m on my way”.') + '</div>' +
        '<div class="card" style="padding:14px;"><b>Recent texts</b>' + (log ? '<div style="overflow-x:auto;"><table style="width:100%;font-size:13px;border-collapse:collapse;margin-top:8px;">' + log + '</table></div>' : '<div class="meta" style="margin-top:6px;">None yet.</div>') + '</div></div>';
      v.querySelectorAll('[data-tset]').forEach(function (c) {
        c.onchange = function () { var b = {}; b[c.dataset.tset] = c.checked; window.api('text_settings', { method: 'POST', body: b }).then(function () { toast('Saved ✓'); }).catch(function (x) { toast(x.message); c.checked = !c.checked; }); };
      });
    }).catch(function (x) { v.innerHTML = '<div class="wrap">' + backBtn() + '<div class="empty">' + e(x.message) + '</div></div>'; });
  };


  // ── Cleaner Pay ───────────────────────────────────────────────────────────
  var payWeek = '';
  function peso(n) { return '₱' + Math.round(Number(n) || 0).toLocaleString('en-PH'); }
  function shiftWeek(ws, days) { var d = new Date(ws + 'T12:00:00+08:00'); d.setDate(d.getDate() + days); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); }
  function niceDay(ds) { return new Date(ds + 'T12:00:00+08:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); }
  window.thRenderCleanerPay = function () {
    var v = view();
    v.innerHTML = '<div class="wrap"><div class="empty">Loading…</div></div>';
    window.api('cleaner_pay', { params: { week: payWeek } }).then(function (d) {
      payWeek = d.week_start;
      var r = d.rules.makati || {};
      var cards = d.cleaners.map(function (c) {
        var jobs = c.jobs.map(function (j) {
          return '<tr><td class="meta" style="padding:4px 8px 4px 0;white-space:nowrap;">' + e(new Date(j.when).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' })) + '</td><td style="padding:4px 8px 4px 0;">' + e(j.customer) + ' · ' + e(j.service) + (j.shared ? ' (shared)' : '') + '</td><td style="text-align:right;padding:4px 8px 4px 0;" class="meta">' + peso(j.price) + '</td><td style="text-align:right;padding:4px 0;font-weight:700;">' + peso(j.pay) + (j.tip ? ' + ' + peso(j.tip) + ' tip' : '') + '</td></tr>';
        }).join('');
        return '<div class="card" style="padding:14px;margin-bottom:10px;"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">' +
          '<b style="font-size:16px;">' + e(c.name) + '</b><span style="font-size:20px;font-weight:800;">' + peso(c.total) + '</span></div>' +
          '<div class="meta">' + c.jobs.length + ' cleaning' + (c.jobs.length === 1 ? '' : 's') + ' · pay ' + peso(c.pay) + ' · tips ' + peso(c.tips) + '</div>' +
          '<table style="width:100%;font-size:13px;border-collapse:collapse;margin:8px 0;">' + jobs + '</table>' +
          (c.paid ? '<div style="display:flex;gap:8px;align-items:center;"><span style="color:#15803d;font-weight:700;">✓ Paid ' + peso(c.paid.amount) + (c.paid.method ? ' by ' + e(c.paid.method) : '') + '</span><button class="btn ghost sm" style="width:auto;" data-pundo="' + e(c.technician_id) + '">Undo</button></div>' :
            '<div style="display:flex;gap:8px;flex-wrap:wrap;"><select data-pm="' + e(c.technician_id) + '" style="width:auto;"><option>GCash</option><option>Maya</option><option>Bank transfer</option><option>Cash</option></select><button class="btn sm" style="width:auto;" data-ppay="' + e(c.technician_id) + '" data-amt="' + c.total + '">Mark ' + peso(c.total) + ' paid</button></div>') + '</div>';
      }).join('');
      v.innerHTML = '<div class="wrap" style="max-width:820px;">' + backBtn() + '<h2 style="margin:0 0 4px;">💰 Cleaner Pay</h2>' +
        '<div class="meta" style="margin-bottom:12px;">Each cleaner gets ' + (r.percent || 0) + '% of every finished cleaning (at least ' + peso(r.minimum || 0) + ' per job), plus all tips. Two cleaners on one job split it. Change these in Other → Cleaning Prices → Cleaner pay.</div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;"><button class="btn ghost sm" style="width:auto;" id="pwPrev">‹</button><b>Week of ' + e(niceDay(d.week_start)) + ' – ' + e(niceDay(d.week_end)) + '</b><button class="btn ghost sm" style="width:auto;" id="pwNext">›</button>' +
        '<span style="margin-left:auto;font-weight:800;">Total ' + peso(d.total) + '</span></div>' +
        (cards || '<div class="empty">No finished cleanings this week.</div>') + '</div>';
      v.querySelector('#pwPrev').onclick = function () { payWeek = shiftWeek(payWeek, -7); window.thRenderCleanerPay(); };
      v.querySelector('#pwNext').onclick = function () { payWeek = shiftWeek(payWeek, 7); window.thRenderCleanerPay(); };
      v.querySelectorAll('[data-ppay]').forEach(function (b) {
        b.onclick = function () {
          var m = v.querySelector('[data-pm="' + b.dataset.ppay + '"]').value;
          window.api('cleaner_pay_mark', { method: 'POST', body: { week: payWeek, technician_id: b.dataset.ppay, amount: Number(b.dataset.amt), method: m } }).then(window.thRenderCleanerPay).catch(function (x) { toast(x.message); });
        };
      });
      v.querySelectorAll('[data-pundo]').forEach(function (b) {
        b.onclick = function () { window.api('cleaner_pay_mark', { method: 'POST', body: { week: payWeek, technician_id: b.dataset.pundo, undo: true } }).then(window.thRenderCleanerPay).catch(function (x) { toast(x.message); }); };
      });
    }).catch(function (x) { v.innerHTML = '<div class="wrap">' + backBtn() + '<div class="empty">' + e(x.message) + '</div></div>'; });
  };

  function boot() {
    if (!document.getElementById('sideNav') || typeof window.api !== 'function') return;
    navButton('navQuotes', '📨', 'Quote Requests', 'schedule', renderQuotes);
    loadQuoteBadge();
  }
  window.thBoot = boot;
  if (typeof window.enterApp === 'function') {
    var orig = window.enterApp;
    window.enterApp = function () { var r = orig.apply(this, arguments); setTimeout(boot, 0); return r; };
  }
  setTimeout(function () { var app = document.getElementById('app'); if (app && !app.classList.contains('hidden')) boot(); }, 0);
  window.thRenderQuotes = renderQuotes;
})();
