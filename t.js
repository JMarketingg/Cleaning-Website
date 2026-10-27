// TidyHaus website analytics. Sends visits, clicks and quote steps to the CRM.
// No cookies; a random visitor id is kept in localStorage.
(function () {
  var ENDPOINT = 'https://tidyhaus-crm.vercel.app/api/log-event';
  if (navigator.webdriver || /localhost|127\.0\.0\.1/.test(location.hostname)) return;

  function rid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function store(kind, key, make) {
    try { var v = kind.getItem(key); if (!v) { v = make(); kind.setItem(key, v); } return v; } catch (e) { return make(); }
  }
  var vid = store(window.localStorage, 'th_vid', rid);
  var sid = store(window.sessionStorage, 'th_sid', rid);
  var q = new URLSearchParams(location.search);
  var base = {
    vid: vid,
    ref: document.referrer || null,
    utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'),
    tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; } })(),
    screen: screen.width + 'x' + screen.height
  };
  var path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
  var queue = [];
  var timer = null;

  function send(beacon) {
    if (!queue.length) return;
    var body = JSON.stringify(Object.assign({ events: queue.splice(0, 50) }, base));
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
    } else {
      fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(function () {});
    }
  }
  function track(event, label, extra) {
    var e = { event: event, sid: sid, path: path, title: document.title, label: label || null };
    if (extra) for (var k in extra) e[k] = extra[k];
    queue.push(e);
    clearTimeout(timer);
    timer = setTimeout(function () { send(false); }, 800);
  }
  window.thTrack = track;

  track('page_view');

  var start = Date.now(), maxScroll = 0, exited = false;
  addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.round((scrollY / h) * 100));
  }, { passive: true });
  function exit() {
    if (exited) return;
    exited = true;
    track('page_exit', null, { ms: Date.now() - start, scroll: maxScroll });
    send(true);
  }
  addEventListener('pagehide', exit);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') exit(); });

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('a, button');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    var label;
    if (/^tel:/.test(href)) label = 'Call: ' + text;
    else if (/^sms:/.test(href)) label = 'Text: ' + text;
    else if (/facebook\.com/.test(href)) label = 'Facebook: ' + text;
    else if (/^mailto:/.test(href)) label = 'Email: ' + text;
    else label = text || href;
    track('click', label);
    if (el.id === 'bk-fb') track('quote_send', 'Facebook');
    if (el.id === 'bk-sms') track('quote_send', 'Text message');
  }, true);

  var area = document.getElementById('area-check');
  if (area) area.addEventListener('submit', function () {
    var sel = document.getElementById('area-select');
    track('area_pick', sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '');
  });
})();
