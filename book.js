(function () {
  var PHONE = '+639923095621';
  var FACEBOOK = 'https://www.facebook.com/profile.php?id=61595598907795';

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
    when: function () {
      var d = value('date');
      if (!d) return 'Pick a date.';
      if (d < form.elements.date.min) return 'Pick a date from tomorrow onward.';
      if (!value('time')) return 'Pick a time of day.';
    },
    details: function () {
      if (!value('name')) return 'Enter your name.';
      var phone = value('phone').replace(/[\s()-]/g, '');
      if (!/^(\+?63|0)9\d{9}$/.test(phone)) return 'Enter a mobile number like 0917 123 4567.';
    }
  };

  function show(i) {
    steps.forEach(function (s, j) { s.hidden = j !== i; });
    current = i;
    var visible = steps.filter(applies);
    var pos = visible.indexOf(steps[i]) + 1;
    count.textContent = 'Step ' + pos + ' of ' + visible.length;
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

  function summaryLines() {
    var isOffice = value('place') === 'office';
    var area = value('area') === 'other' ? value('area_other') : label('area');
    var lines = [
      ['Area', area],
      ['Service', label('service')],
      ['Place', label('place')],
      isOffice ? ['Size', label('office_size')] : ['Size', label('bedrooms') + ', ' + label('bathrooms')],
      ['How often', label('frequency')],
      ['Preferred date', formatDate(value('date'))],
      ['Time', label('time')],
      ['Name', value('name')],
      ['Mobile', value('phone')]
    ];
    if (value('building')) lines.push(['Building / street', value('building')]);
    if (value('notes')) lines.push(['Notes', value('notes')]);
    return lines;
  }

  function buildSummary() {
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
    var text = 'Hi TidyHaus! I would like a quote.\n' + lines.map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
    document.getElementById('bk-sms').href = 'sms:' + PHONE + '?&body=' + encodeURIComponent(text);
    form.dataset.message = text;
  }

  document.getElementById('bk-fb').addEventListener('click', function () {
    var note = document.getElementById('bk-copied');
    var text = form.dataset.message || '';
    function done(ok) {
      note.textContent = ok
        ? 'Your request is copied. Paste it in the Facebook chat that opens.'
        : 'Opening Facebook. Please type your request in the chat.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
    window.open(FACEBOOK, '_blank', 'noopener');
  });

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

  show(0);
})();
