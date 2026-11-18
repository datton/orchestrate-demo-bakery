/* Motion. Hooks (all text stays visible without JS; reduced motion shows everything at once):
   [data-split]            words rise in one by one (hero h1 and h1 in .hero split automatically)
   [data-reveal]           fades and slides in on scroll (h2, p, .card, li in brand pages reveal automatically)
   [data-mask]             heading slides up from behind a mask, line by line
   [data-rotate="a|b|c"]   kinetic rotating word (text inside is the first/no-JS word)
   [data-count="1200"]     counts up (optional data-suffix, data-prefix, data-decimals)
   [data-fill]             statement whose words fill muted -> full as you scroll past
   [data-parallax="0.15"]  gentle vertical drift
   [data-scrolly] > [data-step="Word"]   sticky scrollytelling: a [data-scrolly-word] shows the active step's word
   .marquee > .marquee-track  giant slow marquee (CSS; JS duplicates the track) */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (reduce) root.classList.add('reduce-motion');
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  ready(function () {
    var brand = /\/(index\.html)?$|about\.html$|visit\.html$/.test(location.pathname) && !/menu|checkout|order|counter|board|account|gift/.test(location.pathname);

    /* progress bar */
    var bar = document.createElement('div'); bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    /* split words */
    function split(el) {
      if (el.dataset.splitDone) return; el.dataset.splitDone = '1';
      var text = el.textContent.trim().split(/\s+/), i = 0;
      el.setAttribute('aria-label', el.textContent.trim());
      el.textContent = '';
      text.forEach(function (w) {
        var s = document.createElement('span'); s.className = 'w'; s.setAttribute('aria-hidden', 'true');
        var inner = document.createElement('span'); inner.textContent = w; inner.style.transitionDelay = (i++ * 60) + 'ms'; s.appendChild(inner);
        el.appendChild(s); el.appendChild(document.createTextNode(' '));
      });
    }
    var splitEls = $$('[data-split], .hero h1, .hero-title');
    if (!reduce) splitEls.forEach(function (el) { if (!el.querySelector('[data-rotate]')) split(el); });

    /* auto reveal on brand pages */
    if (brand) $$('main h2, main section p, main .card, main li, main figure').forEach(function (e) {
      if (!e.closest('.hero, [data-scrolly], .marquee, [data-fill]') && !e.hasAttribute('data-reveal')) e.setAttribute('data-reveal', '');
    });
    $$('main h2[data-mask], .mask-heading').forEach(function (h) { h.setAttribute('data-mask', ''); });

    /* marquee: duplicate so it loops */
    $$('.marquee-track').forEach(function (t) { if (!reduce) { var c = t.cloneNode(true); c.setAttribute('aria-hidden', 'true'); t.parentNode.appendChild(c); } });

    /* rotating word */
    $$('[data-rotate]').forEach(function (el) {
      var words = el.dataset.rotate.split('|'); if (words.length < 2 || reduce) return;
      var i = 0; el.classList.add('rotator');
      setInterval(function () {
        el.classList.add('is-swap');
        setTimeout(function () { i = (i + 1) % words.length; el.textContent = words[i]; el.classList.remove('is-swap'); }, 350);
      }, 2400);
    });

    /* statement fill */
    $$('[data-fill]').forEach(function (el) {
      if (reduce) return;
      var words = el.textContent.trim().split(/\s+/); el.setAttribute('aria-label', words.join(' ')); el.textContent = '';
      words.forEach(function (w) { var s = document.createElement('span'); s.className = 'fw'; s.setAttribute('aria-hidden', 'true'); s.textContent = w + ' '; el.appendChild(s); });
    });

    /* count up */
    function countUp(el) {
      var end = parseFloat(el.dataset.count), dec = +el.dataset.decimals || 0, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      var t0 = performance.now(), d = 1400;
      (function f(t) { var p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + (end * e).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
        if (p < 1) requestAnimationFrame(f); })(t0);
    }

    /* observer for reveal, split, mask, count */
    var targets = $$('[data-reveal], [data-mask], [data-count], [data-split], .hero h1, .hero-title, .marquee');
    if (reduce || !('IntersectionObserver' in window)) { targets.forEach(function (e) { e.classList.add('is-in'); }); }
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return; var e = en.target; e.classList.add('is-in'); io.unobserve(e);
          if (e.hasAttribute('data-count')) countUp(e);
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
      targets.forEach(function (e) { io.observe(e); });
    }
    if (reduce) $$('[data-count]').forEach(function (e) { var d = +e.dataset.decimals || 0; e.textContent = (e.dataset.prefix || '') + parseFloat(e.dataset.count).toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d }) + (e.dataset.suffix || ''); });

    /* scroll-driven: progress, fill, parallax, scrolly */
    var fills = $$('[data-fill]'), par = $$('[data-parallax]'), scrollies = $$('[data-scrolly]'), ticking = false;
    function frame() {
      ticking = false;
      var h = root.scrollHeight - innerHeight; bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
      if (reduce) return;
      var vh = innerHeight;
      fills.forEach(function (el) {
        var r = el.getBoundingClientRect(), p = (vh * 0.85 - r.top) / (r.height + vh * 0.35), ws = el.querySelectorAll('.fw');
        var n = Math.max(0, Math.min(1, p)) * ws.length;
        for (var i = 0; i < ws.length; i++) ws[i].classList.toggle('on', i < n);
      });
      par.forEach(function (el) {
        var r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return;
        var k = parseFloat(el.dataset.parallax) || 0.12; el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -k).toFixed(1) + 'px,0)';
      });
      scrollies.forEach(function (sc) {
        var steps = $$('[data-step]', sc), word = sc.querySelector('[data-scrolly-word]'), best = 0, mid = vh * 0.5, bd = 1e9;
        steps.forEach(function (s, i) { var r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = i; } });
        steps.forEach(function (s, i) { s.classList.toggle('is-active', i === best); });
        if (word && steps[best] && word.dataset.now !== String(best)) { word.dataset.now = best; word.classList.add('is-swap');
          setTimeout(function () { word.textContent = steps[best].dataset.step; word.classList.remove('is-swap'); }, 180); }
      });
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); frame();
  });
})();
