// Small helpers shared by every page.
(function () {
  // Maps: Google's map is heavy, so it loads just before it scrolls into view,
  // not with the rest of the page. People still see it without tapping anything.
  var maps = document.querySelectorAll('.map-facade iframe[data-src]');
  function loadMap(frame) {
    if (!frame.hasAttribute('data-src')) return;
    frame.src = frame.getAttribute('data-src');
    frame.removeAttribute('data-src');
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { loadMap(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '600px 0px' });
    Array.prototype.forEach.call(maps, function (f) { io.observe(f); });
  } else {
    Array.prototype.forEach.call(maps, loadMap);
  }

  // Phones: show the Menu button only after people scroll down a little.
  var root = document.documentElement;
  function onScroll() { root.classList.toggle('scrolled', window.scrollY > 120); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
