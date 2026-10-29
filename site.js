// Small helpers shared by every page.
(function () {
  // Maps: Google's map is heavy, so load it only when someone taps "Show map".
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.map-load');
    if (!btn) return;
    var box = btn.closest('.map-facade');
    var frame = box.querySelector('iframe[data-src]');
    frame.src = frame.getAttribute('data-src');
    frame.removeAttribute('data-src');
    box.classList.add('is-loaded');
    btn.remove();
  });

  // Phones: show the Menu button only after people scroll down a little.
  var root = document.documentElement;
  function onScroll() { root.classList.toggle('scrolled', window.scrollY > 120); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
