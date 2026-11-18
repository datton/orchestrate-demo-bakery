/* Shared page shell: header, nav (marks the current page), mobile menu, footer.
   Fills an empty <header class="site-header"> / <footer class="site-footer">; pages that already carry their own
   markup keep it and only get the current-page mark. Relative links only. */
(function () {
  'use strict';
  var ROOT = new URL('../', document.currentScript.src).href;
  /* brand name: the part of the page title after the last "·" ("Menu · Second Shot Coffee"), or the whole title */
  var BRAND = (document.title.split('·').pop() || 'Order ahead').trim();
  var LINKS = [['Home', ''], ['Menu', 'pages/menu.html'], ['Gift cards', 'pages/gift-cards.html'], ['About', 'pages/about.html'], ['Visit', 'pages/visit.html'], ['Me', 'pages/account.html']];
  var path = location.pathname.replace(/index\.html$/, '');
  function isCurrent(rel) {
    var u = new URL(rel, ROOT).pathname.replace(/index\.html$/, '');
    return u === path || (rel && path.indexOf(u) === 0 && u.length > 1);
  }
  function mark(scope) {
    scope.querySelectorAll('a[href]').forEach(function (a) {
      var u = new URL(a.getAttribute('href'), location.href).pathname.replace(/index\.html$/, '');
      if (u === path) a.setAttribute('aria-current', 'page'); else if (a.getAttribute('aria-current') === 'page') a.removeAttribute('aria-current');
    });
  }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  ready(function () {
    var header = document.querySelector('.site-header');
    if (!header) { header = document.createElement('header'); header.className = 'site-header'; document.body.insertBefore(header, document.body.firstChild); }
    if (!header.children.length) {
      header.innerHTML =
        '<div class="site-header-in"><a class="brand" href="' + ROOT + '"><span class="brand-mark" aria-hidden="true">' + BRAND.charAt(0) + '</span><span>' + BRAND + '</span></a>' +
        '<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav"><span class="nav-toggle-bars" aria-hidden="true"></span><span class="visually-hidden">Menu</span></button>' +
        '<nav class="site-nav" id="site-nav" aria-label="Main">' +
        LINKS.map(function (l) { return '<a href="' + ROOT + l[1] + '"' + (isCurrent(l[1]) ? ' aria-current="page"' : '') + '>' + l[0] + '</a>'; }).join('') +
        '</nav>' +
        '<a class="nav-cart" href="' + ROOT + 'pages/checkout.html" aria-label="Cart"><span aria-hidden="true">Cart</span> <span class="shop-cartcount" data-cart-count hidden>0</span></a>' +
        '<a class="nav-order shop-btn" href="' + ROOT + 'pages/menu.html">Order ahead</a></div>';
      var btn = header.querySelector('.nav-toggle'), nav = header.querySelector('.site-nav');
      function set(open) { btn.setAttribute('aria-expanded', open); nav.classList.toggle('is-open', open); }
      btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    } else mark(header);

    var footer = document.querySelector('.site-footer');
    if (!footer) { footer = document.createElement('footer'); footer.className = 'site-footer'; document.body.appendChild(footer); }
    if (!footer.children.length) {
      footer.innerHTML =
        '<div class="site-footer-in"><div><p class="footer-brand">' + BRAND + '</p><p class="footer-tag">Order ahead, skip the line.</p></div>' +
        '<nav aria-label="Footer">' + LINKS.map(function (l) { return '<a href="' + ROOT + l[1] + '">' + l[0] + '</a>'; }).join('') +
        '<a href="' + ROOT + 'pages/counter.html">Staff counter</a></nav>' +
        '<p class="footer-demo">Demo shop: test payments only. No real money moves.</p></div>';
    }

    /* header shadow once scrolled */
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  });
})();
