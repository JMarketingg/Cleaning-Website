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

  // Smooth scrolling for links to a section on the same page (#checklist, #how, ...).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || a.pathname !== location.pathname || !a.hash) return;
    var target = document.getElementById(a.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', a.hash);
  });

  // Phones: the top bar shows after people scroll past the first screen,
  // and hides again from the bottom booking box down to the end of the page.
  var root = document.documentElement;
  var bookBox = document.getElementById('book-now');
  function update() {
    var reachedBookBox = bookBox && bookBox.getBoundingClientRect().top < window.innerHeight * 0.5;
    root.classList.toggle('show-header', window.scrollY > window.innerHeight * 0.6 && !reachedBookBox);
  }
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
})();
