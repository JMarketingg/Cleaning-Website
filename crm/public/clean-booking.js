(function () {
  var SERVICES = [
    { key: 'standard', label: 'Standard Home Cleaning' },
    { key: 'condo', label: 'Condo Cleaning' },
    { key: 'deep', label: 'Deep Cleaning' },
    { key: 'move', label: 'Move-in / Move-out' },
    { key: 'airbnb', label: 'Airbnb & Rental' },
    { key: 'office', label: 'Office Cleaning' }
  ];
  var AREAS = [
    { key: 'makati', label: 'Makati', postal: '1200', city: 'Makati' },
    { key: 'bgc', label: 'BGC (Taguig)', postal: '1634', city: 'Taguig' }
  ];
  var TIMES = [
    { key: 's1', label: '8:00 AM – 10:00 AM' },
    { key: 's2', label: '11:00 AM – 1:00 PM' },
    { key: 's3', label: '2:00 PM – 4:00 PM' },
    { key: 's4', label: '5:00 PM – 8:00 PM' }
  ];
  var prices = null, services = null;

  function peso(n) { return '₱' + Math.round(Number(n) || 0).toLocaleString('en-PH'); }
  function e(s) { return window.esc ? window.esc(s) : String(s == null ? '' : s); }
  function slugNow() { return 'tidyhaus'; }

  function priceOf(area, section, opt) {
    var row = (prices || []).find(function (p) { return p.city_key === area && p.section_key === section && p.option_id === opt; });
    return row ? Number(row.price) || 0 : 0;
  }
  function rows(area, section) {
    return (prices || []).filter(function (p) { return p.city_key === area && p.section_key === section; })
      .sort(function (a, b) { return a.sort_order - b.sort_order; });
  }

  function css() {
    if (document.getElementById('cbCss')) return;
    var st = document.createElement('style');
    st.id = 'cbCss';
    st.textContent = '#cbWrap{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px;}' +
      '#cbBox{background:var(--panel,#fff);color:var(--ink,#111);border-radius:14px;width:100%;max-width:640px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-size:15px;}' +
      '#cbBox h2{margin:0 0 4px;font-size:20px;} #cbBox .cb-sub{color:var(--mute,#666);margin:0 0 14px;font-size:14px;}' +
      '#cbBox fieldset{border:1px solid var(--line,#e5e7eb);border-radius:10px;margin:0 0 12px;padding:10px 12px;} #cbBox legend{font-weight:700;font-size:13px;padding:0 4px;}' +
      '#cbBox label.f{display:block;font-size:13px;color:var(--mute,#666);margin:6px 0 2px;} #cbBox input[type=text],#cbBox input[type=tel],#cbBox input[type=email],#cbBox input[type=date],#cbBox select,#cbBox textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border:1px solid var(--line,#d1d5db);border-radius:8px;background:var(--bg,#fff);color:inherit;}' +
      '#cbBox .row{display:grid;grid-template-columns:1fr 1fr;gap:10px;} @media(max-width:520px){#cbBox .row{grid-template-columns:1fr;}}' +
      '#cbBox .chk{display:flex;flex-wrap:wrap;gap:8px 16px;} #cbBox .chk label{display:flex;gap:6px;align-items:center;font-size:14px;}' +
      '#cbBox .tot{display:flex;justify-content:space-between;font-weight:800;font-size:18px;margin:8px 0;} #cbBox .lines{font-size:13px;color:var(--mute,#666);}' +
      '#cbBox .lines div{display:flex;justify-content:space-between;} #cbBox .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;}' +
      '#cbBox .err{color:#b91c1c;font-size:14px;min-height:18px;} #cbBox .script{background:var(--bg,#f6f7f5);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:14px;}';
    document.head.appendChild(st);
  }

  function quote(f) {
    var area = f.area.value, svc = f.service.value, lines = [];
    var base = priceOf(area, 'service', svc);
    lines.push({ label: (SERVICES.find(function (s) { return s.key === svc; }) || {}).label || 'Cleaning', price: base });
    if (svc === 'office') {
      var os = f.office_size.value, op = priceOf(area, 'office_size', os);
      if (op) lines.push({ label: f.office_size.selectedOptions[0].text, price: op });
    } else {
      var bd = priceOf(area, 'bedrooms', f.bedrooms.value), ba = priceOf(area, 'bathrooms', f.bathrooms.value);
      if (bd) lines.push({ label: f.bedrooms.selectedOptions[0].text, price: bd });
      if (ba) lines.push({ label: f.bathrooms.selectedOptions[0].text, price: ba });
    }
    Array.prototype.forEach.call(f.querySelectorAll('input[name=addon]:checked'), function (c) {
      lines.push({ label: c.dataset.label, price: priceOf(area, 'addons', c.value) });
    });
    var disc = priceOf(area, 'frequency', f.frequency.value);
    if (disc) lines.push({ label: 'Repeat discount (' + f.frequency.selectedOptions[0].text.replace(/ \(.*$/, '') + ')', price: -disc });
    var total = lines.reduce(function (t, l) { return t + l.price; }, 0);
    return { lines: lines, total: total, minimum: priceOf(area, 'rules', 'minimum') };
  }

  function sizeOptions(area, section) {
    return rows(area, section).map(function (r) { return '<option value="' + e(r.option_id) + '">' + e(r.label) + '</option>'; }).join('');
  }

  function render(opts) {
    css();
    var old = document.getElementById('cbWrap'); if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'cbWrap';
    var area0 = 'makati';
    var tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    var addons = rows(area0, 'addons').map(function (r) {
      return '<label><input type="checkbox" name="addon" value="' + e(r.option_id) + '" data-label="' + e(r.label) + '"> ' + e(r.label) + '</label>';
    }).join('');
    var freq = rows(area0, 'frequency').map(function (r) {
      return '<option value="' + e(r.option_id) + '">' + e(r.label.replace(/ \(discount.*$/, '')) + '</option>';
    }).join('');
    wrap.innerHTML = '<form id="cbBox" novalidate>' +
      '<h2>' + (opts.call ? 'Phone call' : 'New cleaning booking') + '</h2>' +
      '<p class="cb-sub">Prices come from Other → Cleaning Prices.</p>' +
      (opts.call ? '<div class="script">Say: <b>"Hello, thank you for calling TidyHaus! What would you like cleaned?"</b> Then fill in the form as you talk.</div>' : '') +
      '<fieldset><legend>Customer</legend><div class="row">' +
      '<div><label class="f">Name</label><input type="text" name="name" autocomplete="off"></div>' +
      '<div><label class="f">Mobile</label><input type="tel" name="phone" placeholder="0917 123 4567" value="' + e(opts.phone || '') + '"></div></div>' +
      '<div class="row"><div><label class="f">Email (optional)</label><input type="email" name="email"></div>' +
      '<div><label class="f">Area</label><select name="area">' + AREAS.map(function (a) { return '<option value="' + a.key + '">' + a.label + '</option>'; }).join('') + '</select></div></div>' +
      '<label class="f">Building / street / unit</label><input type="text" name="address"></fieldset>' +
      '<fieldset><legend>Cleaning</legend><div class="row">' +
      '<div><label class="f">Service</label><select name="service">' + SERVICES.map(function (s) { return '<option value="' + s.key + '">' + s.label + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="f">How often</label><select name="frequency">' + freq + '</select></div></div>' +
      '<div class="row home"><div><label class="f">Bedrooms</label><select name="bedrooms">' + sizeOptions(area0, 'bedrooms') + '</select></div>' +
      '<div><label class="f">Bathrooms</label><select name="bathrooms">' + sizeOptions(area0, 'bathrooms') + '</select></div></div>' +
      '<div class="office" hidden><label class="f">Office size</label><select name="office_size">' + sizeOptions(area0, 'office_size') + '</select></div>' +
      '<label class="f">Add-ons</label><div class="chk">' + addons + '</div></fieldset>' +
      '<fieldset><legend>When</legend><div class="row">' +
      '<div><label class="f">Date</label><input type="date" name="date" min="' + tomorrow + '" value="' + tomorrow + '"></div>' +
      '<div><label class="f">Time</label><select name="slot">' + TIMES.map(function (t) { return '<option value="' + t.key + '">' + t.label + '</option>'; }).join('') + '</select></div></div>' +
      '<label class="f">Notes for the cleaner</label><textarea name="notes" rows="2"></textarea></fieldset>' +
      '<div class="lines" id="cbLines"></div><div class="tot"><span>Total</span><span id="cbTotal">₱0</span></div>' +
      '<div class="err" id="cbErr"></div>' +
      '<div class="acts"><button type="button" class="btn ghost" id="cbCancel" style="width:auto;">Cancel</button>' +
      '<button type="submit" class="btn" id="cbSave" style="width:auto;">Save booking</button></div></form>';
    document.body.appendChild(wrap);
    var f = wrap.querySelector('#cbBox');
    var key = 'cb-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    function update() {
      var office = f.service.value === 'office';
      f.querySelector('.home').hidden = office;
      f.querySelector('.office').hidden = !office;
      var q = quote(f);
      document.getElementById('cbLines').innerHTML = q.lines.map(function (l) { return '<div><span>' + e(l.label) + '</span><span>' + peso(l.price) + '</span></div>'; }).join('') +
        (q.minimum && q.total < q.minimum ? '<div><span>Minimum job price is ' + peso(q.minimum) + '</span><span></span></div>' : '');
      document.getElementById('cbTotal').textContent = peso(Math.max(q.total, q.minimum || 0));
    }
    f.addEventListener('change', update);
    f.addEventListener('input', update);
    update();
    wrap.querySelector('#cbCancel').onclick = function () { wrap.remove(); };
    wrap.addEventListener('click', function (ev) { if (ev.target === wrap) wrap.remove(); });

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = document.getElementById('cbErr'); err.textContent = '';
      var name = f.name.value.trim(), phone = f.phone.value.replace(/[\s()-]/g, '');
      if (!name) { err.textContent = 'Enter the customer name.'; return; }
      if (!/^(\+?63|0)9\d{9}$/.test(phone)) { err.textContent = 'Enter a mobile number like 0917 123 4567.'; return; }
      if (!f.date.value) { err.textContent = 'Pick a date.'; return; }
      var q = quote(f), lines = q.lines.slice();
      if (q.minimum && q.total < q.minimum) lines.push({ label: 'Minimum job top-up', price: q.minimum - q.total });
      var total = lines.reduce(function (t, l) { return t + l.price; }, 0);
      var area = AREAS.find(function (a) { return a.key === f.area.value; });
      var svcLabel = (SERVICES.find(function (s) { return s.key === f.service.value; }) || {}).label;
      var svc = (services || []).find(function (s) { return s.name === svcLabel; });
      var freqText = f.frequency.selectedOptions[0].text;
      var notes = [f.frequency.value !== 'once' ? 'Repeats: ' + freqText : '', f.notes.value.trim()].filter(Boolean).join('\n');
      var btn = document.getElementById('cbSave'); btn.disabled = true; btn.textContent = 'Saving…';
      var normPhone = phone.replace(/^0/, '+63').replace(/^63/, '+63');
      window.api('booking_create', { method: 'POST', body: {
        business: slugNow(), idempotency_key: key,
        customer: { name: name, phone: normPhone, email: f.email.value.trim() || null, address_line1: f.address.value.trim() || null, city: area.city, state: 'Metro Manila', postal_code: area.postal },
        service_id: svc ? svc.id : null,
        selections: lines.map(function (l) { return { label: l.label, price: l.price, quantity: 1 }; }),
        subtotal: total, price: total, tax: 0,
        scheduled_date: f.date.value, scheduled_slot: f.slot.value,
        technician_id: null, payment_method: 'quote', notes: notes || null
      } }).then(function (r) {
        var every = f.frequency.value;
        if (every === 'once' || !r || !r.id || r.duplicate) return { r: r };
        btn.textContent = 'Booking the repeats…';
        return window.api('booking_repeat', { method: 'POST', body: { business: slugNow(), id: r.id, every: every } })
          .then(function (rep) { return { r: r, rep: rep }; })
          .catch(function (x) { return { r: r, repErr: (x && x.message) || 'Could not book the repeats.' }; });
      }).then(function (o) {
        var r = o.r, msg = 'Booking saved ✓';
        if (o.rep) msg = 'Booking saved ✓ plus ' + o.rep.created.length + ' repeat visits' + (o.rep.unassigned.length ? ' (' + o.rep.unassigned.length + ' need a cleaner)' : '');
        if (o.repErr) msg = 'Booking saved, but the repeats failed: ' + o.repErr;
        if (r && r.warning) msg += ' ' + r.warning;
        wrap.remove();
        window.toast && toast(msg);
        if (typeof window.renderSchedule === 'function') window.renderSchedule(true);
      }).catch(function (x) {
        btn.disabled = false; btn.textContent = 'Save booking';
        err.textContent = (x && x.message) || 'Could not save the booking.';
      });
    });
  }

  function open(opts) {
    opts = opts || {};
    var slug = slugNow();
    Promise.all([
      window.api('widget_prices_list', { params: { business: slug } }),
      services ? Promise.resolve({ services: services }) : window.api('services', { params: { business: slug } })
    ]).then(function (r) {
      prices = r[0].prices || []; services = r[1].services || [];
      render(opts);
    }).catch(function (x) { window.toast && toast((x && x.message) || 'Could not load prices.'); });
  }

  window.openCleaningBooking = open;
  window.openNewBooking = function (prefill) { open({ phone: prefill && (prefill.phone || (prefill.customer && prefill.customer.phone)) }); };
  window.openTakeCall = function (o) { open({ call: true, phone: o && o.phone }); };
})();

window.stopRepeat = function (id) {
  if (!confirm('Cancel every visit in this series after this one?')) return;
  window.api('booking_series_stop', { method: 'POST', body: { business: 'tidyhaus', id: id } })
    .then(function (r) { toast('Repeat stopped. ' + r.cancelled + ' later visits cancelled.'); if (typeof window.renderSchedule === 'function') window.renderSchedule(true); })
    .catch(function (x) { toast((x && x.message) || 'Could not stop the repeat.'); });
};
