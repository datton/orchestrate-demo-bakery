/* Navigation behaviour (UI/UX owns this file): marks the section in view with aria-current. */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-list a[href^="#"]'));
  if (!links.length) return;

  function mark(id) {
    links.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  function update() {
    var line = window.innerHeight * 0.3, current = null;
    sections.forEach(function (s) { if (s.getBoundingClientRect().top <= line) current = s.id; });
    mark(current || '');
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('hashchange', update);
  update();
})();
