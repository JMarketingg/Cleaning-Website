(function () {
  var form = document.getElementById('confirm');
  var errorBox = document.getElementById('cf-error');
  var statusBox = document.getElementById('cf-status');
  var sendBtn = document.getElementById('cf-send');

  // Fill in the request details carried in the link from the owner's email.
  try {
    var hash = window.location.hash.slice(1);
    if (hash) {
      var json = decodeURIComponent(escape(atob(hash.replace(/-/g, '+').replace(/_/g, '/'))));
      var data = JSON.parse(json);
      Object.keys(data).forEach(function (k) {
        if (form.elements[k] && data[k]) form.elements[k].value = data[k];
      });
    }
  } catch (e) {
    // A broken link just means the form starts empty.
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var payload = {};
    ['name', 'email', 'phone', 'service', 'size', 'date', 'time', 'address', 'price', 'payment', 'notes', 'password']
      .forEach(function (k) { payload[k] = (form.elements[k].value || '').trim(); });
    var missing = ['name', 'email', 'service', 'date', 'time', 'price', 'password'].filter(function (k) { return !payload[k]; });
    if (missing.length) {
      errorBox.textContent = 'Please fill in: ' + missing.join(', ') + '.';
      return;
    }
    errorBox.textContent = '';
    sendBtn.disabled = true;
    statusBox.className = 'bk-status';
    statusBox.textContent = 'Sending…';
    fetch('/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        sendBtn.disabled = false;
        if (d.ok) {
          statusBox.classList.add('is-ok');
          statusBox.textContent = 'Confirmation sent to ' + payload.email + '. A copy went to your inbox. ' +
            (d.crmUpdated ? 'Marked as booked in the CRM.' : 'Update this request in the CRM by hand.');
          sendBtn.hidden = true;
        } else {
          statusBox.classList.add('is-error');
          statusBox.textContent = d.error || 'Something went wrong.';
        }
      })
      .catch(function () {
        sendBtn.disabled = false;
        statusBox.classList.add('is-error');
        statusBox.textContent = 'Could not reach the server. Try again.';
      });
  });
})();
