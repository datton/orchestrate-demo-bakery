/* =====================================================================================================================
   nav.js: the header navigation. Owner: UI/UX.

   - Phones: the .nav-toggle button opens and closes the link list (Escape or a click outside closes it, and focus
     goes back to the button). Without JavaScript the links simply show under the brand.
   - Marks the link to the current page with aria-current="page" (matched on the file name, so it works under any
     folder: live at /, in the preview under /s/<name>/).
   - Adds .is-scrolled to the header once the page scrolls, for a hairline and a soft shadow.
   ===================================================================================================================== */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var list = toggle && document.getElementById(toggle.getAttribute('aria-controls'));

  /* ---- Open and close the phone menu --------------------------------------------------------------------------- */
  function setOpen(open, focusBack) {
    if (!toggle || !list) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close the site menu' : 'Open the site menu');
    list.classList.toggle('is-open', open);
    if (!open && focusBack) toggle.focus();
  }
  if (toggle && list) {
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, true);
    });
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !list.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    window.matchMedia('(min-width: 960px)').addEventListener('change', function (m) { if (m.matches) setOpen(false); });
  }

  /* ---- Current page -------------------------------------------------------------------------------------------- */
  function fileOf(url) {
    var path = new URL(url, location.href).pathname;
    var file = path.split('/').pop() || 'index.html';
    var dir = path.split('/').slice(-2, -1)[0] || '';
    return (dir === 'pages' ? 'pages/' : '') + file;
  }
  var here = fileOf(location.href);
  Array.prototype.forEach.call(document.querySelectorAll('.site-nav__link'), function (a) {
    var raw = a.getAttribute('href') || '';
    if (raw.charAt(0) === '#' || (raw.indexOf('#') > -1 && fileOf(a.href) === here)) return;   // a section of this page
    if (fileOf(a.href) === here) a.setAttribute('aria-current', 'page');
  });

  /* ---- Header state on scroll ---------------------------------------------------------------------------------- */
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
