// Simple visit counter. Sends page views, time on page and key clicks to the CRM's Website Analytics.
// No cookies, no names or numbers. Owner's own devices opt out by opening any page with ?notrack=1
// (and back in with ?track=1).
(function () {
  var URL = 'https://tidyhaus-crm.vercel.app/api/log-event';
  var params = new URLSearchParams(window.location.search);
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  if (params.get('notrack') === '1') { store('th_notrack', '1'); alert('This device won\'t be counted in TidyHaus analytics.'); }
  if (params.get('track') === '1') store('th_notrack', null);
  if (store('th_notrack') === '1') { window.thTrack = function () {}; return; }

  function id() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  var vid = store('th_vid') || id();
  store('th_vid', vid);
  var sid;
  try { sid = sessionStorage.getItem('th_sid') || id(); sessionStorage.setItem('th_sid', sid); } catch (e) { sid = id(); }

  function send(events) {
    var body = JSON.stringify({
      vid: vid, ref: document.referrer, tz: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone,
      screen: screen.width + 'x' + screen.height,
      utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
      events: events
    });
    // Plain text keeps it a simple request (no CORS preflight) and lets it finish as the page closes.
    var blob = new Blob([body], { type: 'text/plain' });
    if (!(navigator.sendBeacon && navigator.sendBeacon(URL, blob))) {
      fetch(URL, { method: 'POST', body: blob, keepalive: true, mode: 'no-cors' }).catch(function () {});
    }
  }
  function ev(event, label, extra) {
    var e = { event: event, sid: sid, path: location.pathname, title: document.title, label: label || null };
    for (var k in extra || {}) e[k] = extra[k];
    return e;
  }
  window.thTrack = function (event, label) { send([ev(event, label)]); };

  send([ev('page_view')]);

  var start = Date.now(), maxScroll = 0, exited = false;
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.round(scrollY / h * 100));
  }, { passive: true });
  function exit() {
    if (exited) return;
    exited = true;
    send([ev('page_exit', null, { ms: Date.now() - start, scroll: maxScroll })]);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') exit(); });
  window.addEventListener('pagehide', exit);

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = null;
    if (/^tel:/.test(href)) label = 'Call';
    else if (/^sms:/.test(href)) label = 'Text';
    else if (/facebook\.com|m\.me/.test(href)) label = 'Facebook';
    else if (/instagram\.com/.test(href)) label = 'Instagram';
    else if (/tiktok\.com/.test(href)) label = 'TikTok';
    else if (a.classList.contains('btn')) label = 'Button: ' + (a.textContent || '').trim().slice(0, 60);
    if (label) send([ev('click', label)]);
  });
})();
