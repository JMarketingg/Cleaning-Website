(function () {
  var PHONE = '+639923095621';

  var form = document.getElementById('booking');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.bk-step'));
  var bar = document.getElementById('bk-bar');
  var count = document.getElementById('bk-count');
  var backBtn = document.getElementById('bk-back');
  var nextBtn = document.getElementById('bk-next');
  var errorBox = document.getElementById('bk-error');
  var current = 0;

  function value(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.length !== undefined && el.tagName !== 'SELECT') {
      for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value;
      return '';
    }
    return (el.value || '').trim();
  }
  function label(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.dataset.label || el.value : '';
  }

  // Steps that only apply to some answers are skipped.
  function applies(step) {
    var only = step.dataset.only;
    if (!only) return true;
    var isOffice = value('place') === 'office';
    return only === 'office' ? isOffice : !isOffice;
  }

  var validators = {
    area: function () {
      if (!value('area')) return 'Pick your area.';
      if (value('area') === 'other' && !value('area_other')) return 'Tell us your city or area.';
    },
    service: function () { if (!value('service')) return 'Pick a service.'; },
    place: function () { if (!value('place')) return 'Pick the type of place.'; },
    size: function () {
      if (!value('bedrooms')) return 'Pick the number of bedrooms.';
      if (!value('bathrooms')) return 'Pick the number of bathrooms.';
    },
    office: function () { if (!value('office_size')) return 'Pick the size of the office.'; },
    frequency: function () { if (!value('frequency')) return 'Pick how often.'; },
    payment: function () { if (!value('payment')) return 'Pick how you want to pay.'; },
    when: function () {
      var d = value('date');
      if (!d) return 'Pick a date.';
      if (d < form.elements.date.min) return 'Pick a date from tomorrow onward.';
      if (!value('time')) return 'Pick an open start time.';
      if (openStarts.indexOf(Number(value('time'))) === -1) return 'That time is taken. Pick another time or date.';
    },
    contact: function () {
      if (!value('name')) return 'Enter your name.';
      var phone = value('phone').replace(/[\s()-]/g, '');
      // Philippine mobile, or an international number with + (expats, OFWs).
      var ph = /^(\+?63|0)9\d{9}$/.test(phone);
      var intl = /^\+(?!63)\d{8,15}$/.test(phone);
      if (!ph && !intl) return 'Enter a mobile number like 0917 123 4567, or an international number starting with +.';
      var email = value('email');
      if (!email) return 'Add your email so we can send your confirmation.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Check your email address.';
    },
    details: function () {
      if (!value('building')) return 'Add your building, unit and street.';
      if (photoBusy) return 'Wait a moment, your photos are still uploading.';
      // Deep and move-in/out: ask for photos once; they can choose to send them later.
      if (['deep', 'move'].indexOf(value('service')) !== -1 && !photoCount && !photosLater) {
        var box = document.getElementById('bk-photo-ask'); if (box) box.hidden = false;
        return 'Please add photos, or choose to send them later.';
      }
    }
  };

  // first=true on page load: don't move focus, so the page doesn't jump down to the form.
  function show(i, first) {
    steps.forEach(function (s, j) { s.hidden = j !== i; });
    current = i;
    var visible = steps.filter(applies);
    var pos = visible.indexOf(steps[i]) + 1;
    count.textContent = 'Step ' + pos + ' of ' + visible.length;
    if (window.thTrack) window.thTrack('quote_step', pos + '. ' + steps[i].getAttribute('data-key'));
    bar.style.width = Math.round((pos / visible.length) * 100) + '%';
    backBtn.hidden = i === 0;
    var last = i === steps.length - 1;
    nextBtn.hidden = last;
    errorBox.textContent = '';
    if (last) buildSummary();
    if (!first) saveProgressSoon();
    var heading = steps[i].querySelector('.bk-question');
    if (heading && !first) {
      heading.focus({ preventScroll: true });
      // Keep the top of the form in view when moving between steps.
      var top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function move(dir) {
    var i = current + dir;
    while (i > 0 && i < steps.length - 1 && !applies(steps[i])) i += dir;
    show(i);
  }

  nextBtn.addEventListener('click', function () {
    var check = validators[steps[current].dataset.key];
    var problem = check && check();
    if (problem) {
      errorBox.textContent = problem;
      try { errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      return;
    }
    if (steps[current].dataset.key === 'contact') sendLead();
    move(1);
  });
  backBtn.addEventListener('click', function () { move(-1); });

  // Choosing an option card moves on by itself, like the reference flow.
  form.addEventListener('change', function (e) {
    var step = steps[current];
    if (e.target.type !== 'radio' || step.dataset.auto !== 'true') return;
    if (e.target.name === 'area' && e.target.value === 'other') {
      form.elements.area_other.focus();
      return;
    }
    if (!validators[step.dataset.key]()) move(1);
  });
  form.elements.area_other.addEventListener('input', function () {
    form.querySelector('input[name="area"][value="other"]').checked = true;
  });

  function formatDate(iso) {
    var parts = iso.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Estimated price per visit, by service and number of bedrooms.
  // Condo and Airbnb use standard prices. Move-in/out costs more than deep (empty unit, inside cabinets). Offices are quoted by hand.
  var PRICES = {
    standard: { studio: 1300, '1': 1500, '2': 1900, '3': 2500, '4+': 3100 },
    deep: { studio: 1900, '1': 2400, '2': 3000, '3': 3800, '4+': 4600 },
    move: { studio: 2500, '1': 3000, '2': 3800, '3': 4800, '4+': 5800 }
  };
  // Party cleaning (before or after) is priced like a deep clean.
  var PRICE_TABLE = { standard: 'standard', condo: 'standard', airbnb: 'standard', deep: 'deep', move: 'move', party: 'deep' };

  // Added for each bathroom after the first.
  var EXTRA_BATHROOM = { '2': 300, '3+': 600 };

  // Discount per visit for regular cleaning.
  var DISCOUNTS = {
    weekly: { off: 100, label: '₱100 weekly discount' },
    biweekly: { off: 50, label: '₱50 every-2-weeks discount' }
  };

  var TRAVEL_FEE = 200;

  // Optional add-ons; each checkbox has its own price (data-price). Inside cabinets is already part of move-in/out.
  // Organizing and decluttering is ₱300 per hour.
  var ORGANIZE_RATE = 300;
  function addonItems() {
    var moving = value('service') === 'move';
    var items = Array.prototype.slice.call(form.querySelectorAll('input[name="addon"]:checked'))
      .filter(function (el) { return !(moving && el.value === 'cabinets'); })
      .map(function (el) { return { label: el.dataset.label, price: Number(el.dataset.price) || 300 }; });
    var h = Number(value('organize_hours')) || 0;
    if (h) items.push({ label: 'Organizing and decluttering (' + h + (h === 1 ? ' hour' : ' hours') + ')', price: h * ORGANIZE_RATE });
    return items;
  }
  function addons() { return addonItems().map(function (a) { return a.label; }); }
  function addonTotal() { return addonItems().reduce(function (t, a) { return t + a.price; }, 0); }
  function addonText() { return addons().length ? addons().join(', ') + ' (+' + peso(addonTotal()) + ')' : ''; }

  // Promo codes: amount off the first visit only.
  var PROMOS = { FIRSTCLEAN: { off: 200, label: 'FIRSTCLEAN: ₱200 off your first cleaning' } };
  function promo() {
    var code = (form.elements.promo && form.elements.promo.value || '').trim().toUpperCase();
    return PROMOS[code] ? { code: code, off: PROMOS[code].off || 0, pct: PROMOS[code].pct || 0, label: PROMOS[code].label } : null;
  }

  // Price text like "₱1,500" or "₱1,300 (FIRSTCLEAN: ₱200 off your first cleaning, then ₱1,500 per visit)".
  function estimatedPrice() {
    var table = PRICES[PRICE_TABLE[value('service')]];
    if (!table || value('place') === 'office') return '';
    var amount = table[value('bedrooms')];
    if (!amount) return '';
    amount += EXTRA_BATHROOM[value('bathrooms')] || 0;
    amount += addonTotal();
    var notes = [];
    var perVisit = amount;
    var discount = DISCOUNTS[value('frequency')];
    if (discount) {
      perVisit = amount - discount.off;
      notes.push(discount.label + ', regular ' + peso(amount));
    }
    // Outside Makati and BGC: a travel fee on every visit (not discounted).
    if (value('area') === 'other') {
      perVisit += TRAVEL_FEE;
      notes.push(peso(TRAVEL_FEE) + ' travel fee');
    }
    var p = promo();
    if (!p) return peso(perVisit) + (notes.length ? ' (' + notes.join('; ') + ')' : '');
    notes.unshift(p.label + ', then ' + peso(perVisit) + ' per visit');
    var off = p.pct ? Math.round(perVisit * p.pct / 100) : p.off;
    return peso(Math.max(0, perVisit - off)) + ' (' + notes.join('; ') + ')';
  }
  function peso(n) { return '₱' + n.toLocaleString('en-PH'); }

  function summaryLines() {
    var isOffice = value('place') === 'office';
    var area = value('area') === 'other' ? value('area_other') : label('area');
    var lines = [
      ['Area', area],
      ['Service', label('service')],
      ['Place', label('place')],
      isOffice ? ['Size', label('office_size')] : ['Size', label('bedrooms') + ', ' + label('bathrooms')],
      ['How often', label('frequency')],
      ['Date', formatDate(value('date'))],
      ['Time', label('time')],
      ['Name', value('name')],
      ['Mobile', value('phone')]
    ];
    if (value('building')) lines.push(['Building / street', value('building')]);
    if (value('email')) lines.push(['Email', value('email')]);
    lines.push(['Equipment', label('equipment')]);
    if (addonText()) lines.push(['Add-ons', addonText()]);
    if (value('notes')) lines.push(['Notes', value('notes')]);
    lines.push(['Payment', label('payment')]);
    if (promo()) lines.push(['Promo code', promo().code]);
    return lines;
  }

  function buildSummary() {
    // Estimated price in its own box. The owner confirms the final price before the customer pays the deposit.
    var price = estimatedPrice();
    var cut = price.indexOf(' (');
    document.getElementById('bk-total-amount').textContent = price ? (cut === -1 ? price : price.slice(0, cut)) : 'Quote by message';
    document.getElementById('bk-total-note').textContent = price
      ? (promo() ? 'first cleaning' : 'per visit') + ' · includes up to ' + hoursText(durationMinutes()) + ' of cleaning' + (cut === -1 ? '' : ' · ' + price.slice(cut + 2, -1))
      : "Office prices depend on the space. We'll send your price.";
    var lines = summaryLines();
    var list = document.getElementById('bk-summary');
    list.innerHTML = '';
    lines.forEach(function (l) {
      var dt = document.createElement('dt');
      dt.textContent = l[0];
      var dd = document.createElement('dd');
      dd.textContent = l[1];
      list.appendChild(dt);
      list.appendChild(dd);
    });
  }

  // Add-ons are for homes; inside cabinets is already part of move-in/out.
  function syncAddons() {
    var box = document.getElementById('bk-addons');
    if (box) box.hidden = value('place') === 'office';
    var cab = document.getElementById('bk-addon-cab');
    if (cab) cab.hidden = value('service') === 'move';
  }
  form.addEventListener('change', syncAddons);
  syncAddons();

  var submitBtn = document.getElementById('bk-submit');
  var statusBox = document.getElementById('bk-status');
  // Copy of the request for the CRM's Quote Requests list. It never blocks the
  // customer: the emails from /api/quote are the main record.
  var CRM_URL = 'https://tidyhaus-crm.vercel.app/api/quote';
  // Step 2 (contact) saves a lead right away, so we can call back even if the rest isn't finished.
  var leadId = null, leadSent = '';
  function sendLead() {
    var key = value('name') + '|' + value('phone') + '|' + value('email');
    if (leadSent === key || value('website')) return;
    leadSent = key;
    var area = value('area') === 'other' ? value('area_other') : label('area');
    try {
      fetch(CRM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'lead', name: value('name'), phone: value('phone'), email: value('email'), area: area, channel: 'website', ref: document.referrer, vid: readVid() }) })
        .then(function (r) { return r.json(); }).then(function (d) { if (d && d.id) { leadId = d.id; saveProgressSoon(); } }).catch(function () {});
    } catch (e) {}
    if (window.thTrack) window.thTrack('quote_step', 'lead_saved');
  }
  // After step 2, save each answer as they go, so a customer who stops still leaves what they picked.
  var STEP_NAMES = { area: 'area', contact: 'contact', service: 'service', place: 'type of place', size: 'size', office: 'office size',
    frequency: 'how often', when: 'date and time', payment: 'payment', details: 'address and details', review: 'review (last step, did not press Send)' };
  function sendProgress(useBeacon) {
    if (!leadId || value('website')) return;
    var visible = steps.filter(applies), pos = visible.indexOf(steps[current]) + 1;
    var isOffice = value('place') === 'office';
    var body = { stage: 'lead', progress: true, lead_id: leadId, phone: value('phone'), name: value('name'),
      last_step: 'step ' + pos + ' of ' + visible.length + ' (' + (STEP_NAMES[steps[current].dataset.key] || steps[current].dataset.key) + ')',
      service: label('service'), place: label('place'),
      bedrooms: isOffice ? '' : label('bedrooms'), bathrooms: isOffice ? '' : label('bathrooms'), office_size: isOffice ? label('office_size') : '',
      frequency: label('frequency'), date: value('date'), time: label('time'), building: value('building'),
      notes: [value('payment') ? 'Payment: ' + label('payment') : '', addonText() ? 'Add-ons: ' + addonText() : '', value('notes')].filter(Boolean).join('\n') };
    try { fetch(CRM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  var progressTimer = null;
  function saveProgressSoon() { clearTimeout(progressTimer); progressTimer = setTimeout(sendProgress, 800); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendProgress(); });
  function readVid() { try { return localStorage.getItem('th_vid') || ''; } catch (e) { return ''; } }

  // Optional photos (up to 10), shrunk on the phone and uploaded to the CRM with the lead.
  var photoBusy = 0, photoCount = 0, photosLater = false;
  var laterBtn = document.getElementById('bk-photo-later');
  if (laterBtn) laterBtn.addEventListener('click', function () {
    photosLater = true; document.getElementById('bk-photo-ask').hidden = true; errorBox.textContent = ''; move(1);
  });
  var photoInput = document.getElementById('bk-photo-input');
  var photoGrid = document.getElementById('bk-photo-grid');
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { reject(new Error('That file is not a photo.')); };
      img.src = url;
    });
  }
  if (photoInput) photoInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(photoInput.files || []).slice(0, Math.max(0, 10 - photoCount));
    photoInput.value = '';
    files.forEach(function (f) {
      var tile = document.createElement('div');
      tile.innerHTML = '<img alt="Your photo" src="' + URL.createObjectURL(f) + '"><span>Uploading…</span>';
      photoGrid.appendChild(tile); photoBusy++; photoCount++;
      shrink(f).then(function (data) {
        return fetch(CRM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'photo', lead_id: leadId, phone: value('phone'), image: data }) })
          .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || 'Upload failed'); }); });
      }).then(function () { tile.querySelector('span').textContent = '✓'; },
        function (e) { tile.querySelector('span').textContent = 'Failed'; photoCount--; errorBox.textContent = e.message; })
        .then(function () { photoBusy--; });
    });
  });
  function syncPhotoHint() {
    var h = document.getElementById('bk-photo-hint'); if (!h) return;
    var big = ['deep', 'move'].indexOf(value('service')) !== -1;
    h.textContent = big ? 'Recommended for deep cleaning: add a few photos of the kitchen, bathroom and living room so we can confirm your price.'
      : 'A few photos of the kitchen, bathroom and living room help us confirm your price, especially if your place hasn\'t been cleaned in a while.';
  }
  form.addEventListener('change', syncPhotoHint);
  function sendToCrm() {
    var isOffice = value('place') === 'office';
    var extra = [];
    if (value('email')) extra.push('Email: ' + value('email'));
    if (estimatedPrice()) extra.push('Price: ' + estimatedPrice());
    extra.push('Payment: ' + label('payment'));
    extra.push('Equipment: ' + label('equipment'));
    if (addonText()) extra.push('Add-ons: ' + addonText());
    if (photoCount) extra.push('Photos: ' + photoCount + ' (in the CRM)');
    else if (photosLater) extra.push('Photos: will send later (ask before confirming)');
    if (promo()) extra.push('Promo: ' + promo().code);
    if (document.getElementById('bk-policy') && document.getElementById('bk-policy').checked) extra.push('Policy: agreed to the cancellation policy (25% deposit, 24-hour notice)');
    var body = {
      name: value('name'),
      phone: value('phone'),
      area: value('area') === 'other' ? value('area_other') : label('area'),
      service: label('service'),
      place: label('place'),
      bedrooms: isOffice ? '' : label('bedrooms'),
      bathrooms: isOffice ? '' : label('bathrooms'),
      office_size: isOffice ? label('office_size') : '',
      frequency: label('frequency'),
      date: value('date'),
      time: label('time'),
      building: value('building'),
      notes: [value('notes')].concat(extra).filter(Boolean).join('\n'),
      channel: 'website',
      stage: 'hot', lead_id: leadId, email: value('email'), vid: readVid(),
      ref: document.referrer
    };
    try {
      fetch(CRM_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
        .catch(function () {});
    } catch (e) {}
  }

  // Until the email service is set up, Submit opens a pre-filled text message instead.
  var serverReady = false;
  fetch('/api/quote').then(function (r) { return r.json(); })
    .then(function (d) { serverReady = Boolean(d && d.ready); }, function () {});
  function textFallback() {
    var text = 'Hi TidyHaus! I would like a quote.\n' +
      summaryLines().map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
    window.location.href = 'https://wa.me/' + PHONE.replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }

  // The equipment choice rides along in the notes, so it reaches the owner, the CRM and the cleaner.
  function notesWithEquipment() {
    return ['Equipment: ' + label('equipment'), addonText() ? 'Add-ons: ' + addonText() : '', photoCount ? 'Photos: ' + photoCount + ' (in the CRM)' : (photosLater ? 'Photos: will send later (ask before confirming)' : ''), value('notes')].filter(Boolean).join('\n');
  }

  var sending = false;
  submitBtn.addEventListener('click', function () {
    if (sending) return;
    var agree = document.getElementById('bk-policy');
    if (agree && !agree.checked) {
      statusBox.className = 'bk-status is-error';
      statusBox.textContent = 'Please tick the box to agree to the cancellation policy.';
      return;
    }
    if (!serverReady) {
      textFallback();
      return;
    }
    var isOffice = value('place') === 'office';
    var payload = {
      area: value('area') === 'other' ? value('area_other') : label('area'),
      service: label('service'),
      place: label('place'),
      size: isOffice ? label('office_size') : label('bedrooms') + ', ' + label('bathrooms'),
      frequency: label('frequency'),
      payment: label('payment'),
      promo: promo() ? promo().code : '',
      date: formatDate(value('date')),
      time: label('time'),
      name: value('name'),
      phone: value('phone'),
      email: value('email'),
      building: value('building'),
      notes: notesWithEquipment(),
      price: estimatedPrice(),
      policy: 'Agreed to the cancellation policy (25% deposit, 24-hour notice) on the booking form',
      website: value('website')
    };
    sending = true;
    sendToCrm();
    submitBtn.disabled = true;
    statusBox.className = 'bk-status';
    statusBox.textContent = 'Sending your request…';
    fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (d) { return r.ok && d.ok; }); })
      .then(function (ok) {
        if (!ok) throw new Error('failed');
        statusBox.classList.add('is-ok');
        statusBox.textContent = payload.email
          ? 'Thank you! We got your request. We\'ll check your details and confirm your final price soon.'
          : 'Thank you! We got your request. We\'ll check your details and confirm your final price soon.';
        submitBtn.hidden = true;
        backBtn.hidden = true;
        if (window.thTrack) window.thTrack('quote_send', label('service'));
      })
      .catch(function () {
        submitBtn.disabled = false;
        sending = false;
        statusBox.classList.add('is-error');
        statusBox.textContent = "Sorry, we couldn't send your request. Please try again, or text us at " + PHONE + '.';
      });
  });

  // How long a clean takes for 1 cleaner, in hours. Rough industry figures; adjust as we learn.
  var HOURS = {
    standard: { studio: 2, '1': 2.5, '2': 3, '3': 4, '4+': 5 },
    deep: { studio: 3, '1': 4, '2': 5, '3': 6, '4+': 8 }
  };
  var EXTRA_BATHROOM_HOURS = { standard: 0.5, deep: 1 };
  var EXTRA_BATHROOMS = { '2': 1, '3+': 2 };
  var OFFICE_HOURS = { small: 3, medium: 5, large: 8 };
  var DAY_START = 8 * 60, DAY_END = 18 * 60, GAP = 60; // Minutes; GAP is the break and travel between jobs.

  function durationMinutes() {
    if (value('place') === 'office') return (OFFICE_HOURS[value('office_size')] || 4) * 60;
    // Move-in/out takes about as long as a deep clean.
    var kind = PRICE_TABLE[value('service')] === 'standard' ? 'standard' : 'deep';
    var h = HOURS[kind][value('bedrooms')] || 3;
    h += (EXTRA_BATHROOMS[value('bathrooms')] || 0) * EXTRA_BATHROOM_HOURS[kind];
    h += Number(value('organize_hours')) || 0; // organizing time is on top of the cleaning
    return h * 60;
  }
  function clock(m) {
    var h = Math.floor(m / 60), min = m % 60;
    return ((h + 11) % 12 + 1) + ':' + (min < 10 ? '0' : '') + min + (h < 12 ? ' AM' : ' PM');
  }
  function hoursText(m) { var h = m / 60; return h + (h === 1 ? ' hour' : ' hours'); }

  // Show the start times that still fit this clean on the chosen date.
  var openStarts = [];
  var busy = [];
  var availBox = document.getElementById('bk-avail');
  var timesBox = document.getElementById('bk-times');
  function renderTimes() {
    var len = durationMinutes();
    var picked = value('time');
    timesBox.innerHTML = '';
    openStarts = [];
    if (!value('date')) return;
    for (var s = DAY_START; s + len <= DAY_END; s += 60) {
      var free = busy.every(function (b) { return s + len + GAP <= b[0] || s >= b[1] + GAP; });
      if (free) openStarts.push(s);
      var text = clock(s) + ' to ' + clock(s + len);
      var opt = document.createElement('label');
      opt.className = 'bk-option' + (free ? '' : ' is-full');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'time';
      input.value = String(s);
      input.disabled = !free;
      input.checked = free && picked === String(s);
      input.setAttribute('data-label', text + ' (includes up to ' + hoursText(len) + ' of cleaning)');
      var span = document.createElement('span');
      span.textContent = text;
      opt.appendChild(input);
      opt.appendChild(span);
      timesBox.appendChild(opt);
    }
    availBox.textContent = openStarts.length
      ? 'Your price includes up to ' + hoursText(len) + ' of cleaning (1 cleaner). Pick a start time.'
      : 'This date is fully booked. Please pick another date.';
  }
  function checkAvailability() {
    var d = value('date');
    busy = [];
    renderTimes();
    if (!d) { availBox.textContent = ''; return; }
    availBox.textContent = 'Checking open times…';
    fetch('/api/availability?date=' + encodeURIComponent(d))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (value('date') !== d) return;
        busy = res.busy || [];
        renderTimes();
      }, function () { renderTimes(); });
  }
  // The length of the clean depends on earlier answers, so redraw when they change.
  form.addEventListener('change', function (e) {
    if (['service', 'place', 'bedrooms', 'bathrooms', 'office_size', 'organize_hours'].indexOf(e.target.name) !== -1) renderTimes();
  });
  form.elements.date.addEventListener('change', checkAvailability);
  // iPhone Safari can skip the change event and ignores the earliest-date limit, so check on input and blur too.
  var lastDate = '';
  function dateChanged() {
    var d = value('date'); if (d === lastDate) return; lastDate = d;
    if (d && d < form.elements.date.min) { errorBox.textContent = 'We\'re booked for today. Please pick a date from tomorrow onward.'; busy = []; renderTimes(); availBox.textContent = ''; return; }
    errorBox.textContent = ''; checkAvailability();
  }
  form.elements.date.addEventListener('input', dateChanged);
  form.elements.date.addEventListener('blur', dateChanged);

  form.addEventListener('submit', function (e) { e.preventDefault(); });

  // Promo code box on the review step. Links like /book?promo=FIRSTCLEAN fill it in.
  var promoInput = form.elements.promo;
  var promoMsg = document.getElementById('bk-promo-msg');
  function applyPromo() {
    var typed = promoInput.value.trim();
    promoMsg.textContent = !typed ? '' : promo()
      ? promo().label + '. For first-time customers; we check this when we confirm.'
      : "That code doesn't work. Check the spelling and try again.";
    buildSummary();
  }
  document.getElementById('bk-promo-apply').addEventListener('click', applyPromo);
  promoInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
  promoInput.addEventListener('change', applyPromo);
  var linkPromo = new URLSearchParams(window.location.search).get('promo');
  if (linkPromo) { promoInput.value = linkPromo.toUpperCase(); applyPromo(); }

  // Earliest date is tomorrow, in the visitor's own time zone.
  var t = new Date();
  t.setDate(t.getDate() + 1);
  var pad = function (n) { return String(n).padStart(2, '0'); };
  form.elements.date.min = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());

  // Links like /book?area=bgc&service=deep start with those answers picked.
  var params = new URLSearchParams(window.location.search);
  ['area', 'service'].forEach(function (name) {
    var v = params.get(name);
    var input = v && form.querySelector('input[name="' + name + '"][value="' + CSS.escape(v) + '"]');
    if (input) input.checked = true;
  });

  // Coming from "Find your area" with a known city skips the area question,
  // and coming from a service page also skips the service question.
  var startArea = params.get('area');
  var knownArea = startArea === 'makati' || startArea === 'bgc';
  show(knownArea ? (value('service') ? 2 : 1) : 0, true);
})();
