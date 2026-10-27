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
        '</div>';
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
        '</div><div class="dim" id="thPayMsg"></div>';
      box.querySelector('#thPayMark').onclick = function () {
        var method = box.querySelector('#thPayM').value;
        window.api('booking_mark_paid', { method: 'POST', body: { id: id, method: method } })
          .then(function () { box.innerHTML = '<span class="dim">💳 Paid · ' + e(d.methods[method]) + '</span>'; toast('Marked paid ✓'); if (typeof window.renderSchedule === 'function') window.renderSchedule(true); })
          .catch(function (x) { box.querySelector('#thPayMsg').textContent = x.message; });
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


  // ── Change password ───────────────────────────────────────────────────────
  window.thRenderPassword = function () {
    var v = view();
    v.innerHTML = '<div class="wrap" style="max-width:480px;">' + backBtn() + '<h2 style="margin:0 0 4px;">🔒 Change password</h2>' +
      '<div class="meta" style="margin-bottom:14px;">Pick a password only you know. Use at least 10 characters. A short sentence is easy to remember, for example <i>my mango shine 2027</i>.</div>' +
      '<form id="pwForm" class="card" style="padding:16px;" autocomplete="off">' +
      '<label class="meta" for="pwCur">Current password</label><input type="password" id="pwCur" autocomplete="current-password" style="width:100%;margin:4px 0 12px;">' +
      '<label class="meta" for="pwNew">New password</label><input type="password" id="pwNew" autocomplete="new-password" style="width:100%;margin:4px 0 12px;">' +
      '<label class="meta" for="pwNew2">Type the new password again</label><input type="password" id="pwNew2" autocomplete="new-password" style="width:100%;margin:4px 0 12px;">' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:12px;"><input type="checkbox" id="pwShow" style="width:auto;"> Show passwords</label>' +
      '<button type="submit" class="btn" style="width:auto;">Save new password</button><div class="meta" id="pwMsg" style="margin-top:10px;"></div></form></div>';
    var f = v.querySelector('#pwForm'), msg = v.querySelector('#pwMsg');
    v.querySelector('#pwShow').onchange = function (ev) { ['pwCur', 'pwNew', 'pwNew2'].forEach(function (id) { v.querySelector('#' + id).type = ev.target.checked ? 'text' : 'password'; }); };
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var cur = v.querySelector('#pwCur').value, n1 = v.querySelector('#pwNew').value, n2 = v.querySelector('#pwNew2').value;
      msg.style.color = '#b91c1c';
      if (n1 !== n2) { msg.textContent = 'The two new passwords don’t match.'; return; }
      if (n1.length < 10) { msg.textContent = 'Use at least 10 characters.'; return; }
      msg.style.color = ''; msg.textContent = 'Saving…';
      window.api('change_password', { method: 'POST', body: { current: cur, next: n1 } }).then(function () {
        f.reset(); msg.style.color = '#15803d'; msg.textContent = '✓ Saved. Use your new password next time you sign in. The old one no longer works.';
      }).catch(function (x) { msg.style.color = '#b91c1c'; msg.textContent = x.message; });
    };
  };


  // ── What's new ────────────────────────────────────────────────────────────
  function goNav(n) { return function () { if (typeof window.navTo === 'function') window.navTo(n); }; }
  function goOther(k) { return function () { window.navTo('other'); setTimeout(function () { var t = document.querySelector('[data-ot="' + k + '"]'); if (t) t.click(); }, 50); }; }
  var NEWS = [
    { h: 'Your business', items: [
      { t: 'TidyHaus only, Manila only', d: 'All the old TV-mounting companies, staff, phone numbers and cities are gone. Everything is in pesos (₱) and Manila time. Your areas are Makati and BGC.' },
      { t: 'Technicians are now Cleaners', d: 'Every screen says Cleaner instead of Technician.', go: goOther('technicians') },
      { t: 'Simpler menu', d: 'Pipeline, Prospects, Tasks, Launch and Google Ads moved into Other.', go: goNav('other') },
      { t: 'Password', d: 'The CRM needs a password. You can pick your own here.', go: goOther('password'), btn: 'Change password' },
    ] },
    { h: 'Getting customers', items: [
      { t: 'Quote Requests', d: 'Every request sent from the quote form on tidyhausph.com shows up here. Tap “Make booking” and the form fills itself in.', go: function () { var b = document.getElementById('navQuotes'); if (b) b.click(); } },
      { t: 'Website analytics', d: 'Visitors, top pages, where they came from, clicks on Call and Facebook, and how far people get in the quote form.', go: function () { window.navTo('analyticshub'); setTimeout(function () { var b = document.querySelector('#hubNavigation [data-hub=website]'); if (b) b.click(); }, 300); } },
      { t: 'Google Ranking', d: 'Tracks cleaning searches in Makati and BGC, like “condo cleaning makati”.', go: goNav('rankings') },
    ] },
    { h: 'Bookings', items: [
      { t: 'Cleaning booking form', d: 'New Booking and Take a Call open one cleaning form: service, bedrooms and bathrooms, add-ons, how often, date and time. The price is worked out for you.', go: function () { window.openNewBooking(); }, btn: 'New booking' },
      { t: 'Cleaning Prices', d: 'Placeholder prices for every service, size, add-on and repeat discount. Change any number and save.', go: goOther('widget') },
      { t: 'Repeat bookings', d: 'Pick Weekly, Every 2 weeks or Monthly and the next visits are booked for you. The CRM keeps booking ahead every day. Stop a series from any of its bookings.' },
      { t: 'Bookings report', d: 'Bookings made, money booked and earned, upcoming cleanings, popular services and days, repeat customers, and how many quote requests became bookings.', go: function () { window.navTo('analyticshub'); setTimeout(function () { var b = document.querySelector('#hubNavigation [data-hub=bookings]'); if (b) b.click(); }, 300); } },
    ] },
    { h: 'Getting paid', items: [
      { t: 'Payments & QR codes', d: 'Upload your GCash, Maya or QR Ph code. Cleaners show it to the customer after the cleaning and tap how they paid. The office can mark a booking paid too.', go: goOther('payments') },
    ] },
    { h: 'Cleaners', items: [
      { t: 'New cleaner app', d: 'Cleaners sign in on their phone at tidyhaus-crm.vercel.app/tech.html to see their jobs, the address, the cleaning list, add before/after photos, get paid and mark the cleaning finished.' },
      { t: 'Cleaning checklist', d: 'The same room-by-room list as your website. Cleaners tick each item. The booking shows how many are done.' },
      { t: 'Cleaner Pay', d: 'What each cleaner earned this week (a share of each job, a minimum per job, plus tips). Mark each cleaner paid. Cleaners see their own pay in the app.', go: goOther('cleanerpay') },
    ] },
    { h: 'Texts to customers', items: [
      { t: 'Text Messages', d: 'Booking confirmation, a reminder the evening before, and “on the way”. Switch each one on or off. Waiting for a Semaphore account before texts are sent.', go: goOther('texts') },
    ] },
  ];
  window.thRenderNews = function () {
    var v = view();
    var html = NEWS.map(function (g, gi) {
      return '<h3 style="margin:18px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);">' + e(g.h) + '</h3>' + g.items.map(function (it, ii) {
        return '<div class="card" style="padding:12px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;">' +
          '<div style="flex:1 1 320px;"><b>' + e(it.t) + '</b><div class="meta" style="margin-top:2px;line-height:1.5;">' + e(it.d) + '</div></div>' +
          (it.go ? '<button type="button" class="btn ghost sm" style="width:auto;" data-news="' + gi + ':' + ii + '">' + e(it.btn || 'Open') + ' →</button>' : '') + '</div>';
      }).join('');
    }).join('');
    v.innerHTML = '<div class="wrap" style="max-width:760px;"><h2 style="margin:0 0 4px;">✨ What’s new in your CRM</h2>' +
      '<div class="meta">Everything that was added or changed for TidyHaus. Tap Open to go there.</div>' + html + '</div>';
    v.querySelectorAll('[data-news]').forEach(function (b) {
      b.onclick = function () { var x = b.dataset.news.split(':'); NEWS[+x[0]].items[+x[1]].go(); };
    });
    try { localStorage.setItem('th_news_seen', '1'); } catch (_) {}
    var bd = document.getElementById('navNewsBadge'); if (bd) bd.style.display = 'none';
  };

  function boot() {
    if (!document.getElementById('sideNav') || typeof window.api !== 'function') return;
    navButton('navQuotes', '📨', 'Quote Requests', 'schedule', renderQuotes);
    navButton('navNews', '✨', 'What’s new', 'other', window.thRenderNews);
    var seen = null; try { seen = localStorage.getItem('th_news_seen'); } catch (_) {}
    var nb = document.getElementById('navNewsBadge'); if (nb && !seen) { nb.textContent = 'new'; nb.style.display = ''; }
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
