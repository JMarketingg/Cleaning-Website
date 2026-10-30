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
    details: function () {
      if (!value('name')) return 'Enter your name.';
      var phone = value('phone').replace(/[\s()-]/g, '');
      if (!/^(\+?63|0)9\d{9}$/.test(phone)) return 'Enter a mobile number like 0917 123 4567.';
      var email = value('email');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Check your email address.';
    }
  };

  function show(i) {
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
    var heading = steps[i].querySelector('.bk-question');
    if (heading) heading.focus();
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
      return;
    }
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
  // Condo and Airbnb use standard prices; move-in/out uses deep prices. Offices are quoted by hand.
  var PRICES = {
    standard: { studio: 1300, '1': 1500, '2': 1900, '3': 2500, '4+': 3100 },
    deep: { studio: 1900, '1': 2400, '2': 3000, '3': 3800, '4+': 4600 }
  };
  var PRICE_TABLE = { standard: 'standard', condo: 'standard', airbnb: 'standard', deep: 'deep', move: 'deep' };

  // Added for each bathroom after the first.
  var EXTRA_BATHROOM = { '2': 300, '3+': 600 };

  // Discount per visit for regular cleaning.
  var DISCOUNTS = {
    weekly: { rate: 0.15, label: '15% weekly discount' },
    biweekly: { rate: 0.10, label: '10% every-2-weeks discount' },
    monthly: { rate: 0.05, label: '5% monthly discount' }
  };

  function estimatedPrice() {
    var table = PRICES[PRICE_TABLE[value('service')]];
    if (!table || value('place') === 'office') return '';
    var amount = table[value('bedrooms')];
    if (!amount) return '';
    amount += EXTRA_BATHROOM[value('bathrooms')] || 0;
    var discount = DISCOUNTS[value('frequency')];
    if (!discount) return peso(amount);
    // Rounded to the nearest ₱10.
    var discounted = Math.round(amount * (1 - discount.rate) / 10) * 10;
    return peso(discounted) + ' (' + discount.label + ', regular ' + peso(amount) + ')';
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
    if (value('notes')) lines.push(['Notes', value('notes')]);
    lines.push(['Payment', label('payment')]);
    return lines;
  }

  function buildSummary() {
    // The price goes in its own big box so it's the first thing people see.
    var price = estimatedPrice();
    var cut = price.indexOf(' (');
    document.getElementById('bk-total-amount').textContent = price ? (cut === -1 ? price : price.slice(0, cut)) : 'Quote by message';
    document.getElementById('bk-total-note').textContent = price
      ? 'per visit' + (cut === -1 ? '' : ' · ' + price.slice(cut + 2, -1))
      : "Office prices depend on the space. We'll send your price with your confirmation.";
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

  var submitBtn = document.getElementById('bk-submit');
  var statusBox = document.getElementById('bk-status');
  // Copy of the request for the CRM's Quote Requests list. It never blocks the
  // customer: the emails from /api/quote are the main record.
  var CRM_URL = 'https://tidyhaus-crm.vercel.app/api/quote';
  function sendToCrm() {
    var isOffice = value('place') === 'office';
    var extra = [];
    if (value('email')) extra.push('Email: ' + value('email'));
    if (estimatedPrice()) extra.push('Price: ' + estimatedPrice());
    extra.push('Payment: ' + label('payment'));
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
    window.location.href = 'sms:' + PHONE + '?&body=' + encodeURIComponent(text);
  }

  var sending = false;
  submitBtn.addEventListener('click', function () {
    if (sending) return;
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
      date: formatDate(value('date')),
      time: label('time'),
      name: value('name'),
      phone: value('phone'),
      email: value('email'),
      building: value('building'),
      notes: value('notes'),
      price: estimatedPrice(),
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
          ? 'Thank you! We got your request and sent a confirmation to your email. We will reply soon.'
          : 'Thank you! We got your request. We will reply soon.';
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
    var kind = PRICE_TABLE[value('service')] || 'standard';
    var h = HOURS[kind][value('bedrooms')] || 3;
    h += (EXTRA_BATHROOMS[value('bathrooms')] || 0) * EXTRA_BATHROOM_HOURS[kind];
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
      input.setAttribute('data-label', text + ' (about ' + hoursText(len) + ')');
      var span = document.createElement('span');
      span.textContent = text;
      opt.appendChild(input);
      opt.appendChild(span);
      timesBox.appendChild(opt);
    }
    availBox.textContent = openStarts.length
      ? 'Your clean takes about ' + hoursText(len) + '. Pick a start time.'
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
    if (['service', 'place', 'bedrooms', 'bathrooms', 'office_size'].indexOf(e.target.name) !== -1) renderTimes();
  });
  form.elements.date.addEventListener('change', checkAvailability);

  form.addEventListener('submit', function (e) { e.preventDefault(); });

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
  show(knownArea ? (value('service') ? 2 : 1) : 0);
})();
