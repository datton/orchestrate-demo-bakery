/* =====================================================================================================================
   motion.js: scroll reveals and text animation for the website standard. Owner: UI/UX.

   Everything here is progressive: the text is in the HTML and readable without JavaScript, and with
   prefers-reduced-motion: reduce every element is shown at once, with no movement.

   Markup hooks (add them in the HTML; css/layout.css styles them):
     data-reveal            fades and slides in when it enters the screen (data-reveal-group on a parent staggers kids)
     data-split             a headline revealed word by word (40-80ms apart, --stagger in tokens.css)
     class="mask"           a heading whose .mask__line > span lines slide up from behind a mask
     data-count             a number that counts up (the final number is the element's text)
     data-rotate="a|b|c"    the kinetic line: the element's words rotate (the first word is the text in the HTML)
     data-fill              a statement paragraph whose words fill from muted to full colour as you scroll past
     data-scrolly           a sticky scrollytelling section: [data-step data-word="..."] steps + [data-scrolly-word]
     data-parallax          gentle parallax on large type (CSS scroll timeline where supported, else this file)
     data-marquee           a marquee band; a [data-marquee-toggle] button inside it pauses and plays it
   The reading-progress bar is added to every page except those with <body data-progress="off">.
   ===================================================================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---- Split an element's text into word spans, keeping inline elements such as <em> -------------------------- */
  function splitWords(el, cls, start) {
    var i = start || 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span');
            w.className = cls;
            w.style.setProperty('--i', i++);
            var inner = document.createElement('span');
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && !child.matches('br, svg, .visually-hidden, .rotator')) {
          walk(child);
        }
      });
    })(el);
    return i;
  }

  /* ---- Reveal on enter -------------------------------------------------------------------------------------- */
  var revealIO = hasIO && !still ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
      if (e.target.hasAttribute('data-count')) countUp(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }) : null;

  function reveal(el) {
    if (revealIO) revealIO.observe(el);
    else { el.classList.add('is-in'); }
  }

  /** Watch new content too (app screens render after load): call Motion.scan(root) after inserting HTML. */
  function scan(root) {
    $$('[data-reveal-group]', root).forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (kid, n) {
        if (!kid.hasAttribute('data-reveal')) kid.setAttribute('data-reveal', '');
        kid.style.setProperty('--i', n);
      });
    });
    $$('[data-split]:not(.is-split)', root).forEach(function (el) {
      splitWords(el, 'split-word');
      el.classList.add('is-split');
    });
    $$('.mask', root).forEach(function (el) {
      $$('.mask__line', el).forEach(function (line, n) { line.style.setProperty('--i', n); });
    });
    $$('[data-reveal]:not(.is-in), [data-split]:not(.is-in), .mask:not(.is-in)', root).forEach(reveal);
    $$('[data-count]:not([data-counted])', root).forEach(function (el) {
      el.setAttribute('data-counted', '');
      if (still || !hasIO) return;               // the final number is already the text
      prepareCount(el);
      revealIO.observe(el);
    });
  }

  /* ---- Numbers that count up -------------------------------------------------------------------------------- */
  function prepareCount(el) {
    var text = el.textContent.trim();
    var m = text.match(/-?[\d,]*\.?\d+/);
    if (!m) return;
    el._count = { text: text, num: m[0], target: parseFloat(m[0].replace(/,/g, '')),
                  decimals: (m[0].split('.')[1] || '').length, comma: m[0].indexOf(',') > -1 };
    // Screen readers get the final value once; the animated digits are hidden from them.
    var sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = text;
    var shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    shown.textContent = text.replace(m[0], format(0, el._count));
    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(shown);
    el._count.shown = shown;
  }
  function format(v, c) {
    var s = v.toFixed(c.decimals);
    if (c.comma) s = Number(s).toLocaleString('en', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
    return s;
  }
  function countUp(el) {
    var c = el._count;
    if (!c) return;
    var t0 = performance.now(), dur = 1400;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
      c.shown.textContent = c.text.replace(c.num, format(c.target * eased, c));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---- The kinetic rotating word ---------------------------------------------------------------------------- */
  function rotators() {
    $$('[data-rotate]').forEach(function (el) {
      var words = [el.textContent.trim()].concat(el.getAttribute('data-rotate').split('|').map(function (w) { return w.trim(); }))
        .filter(function (w, i, all) { return w && all.indexOf(w) === i; });
      if (words.length < 2) return;
      var sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = words[0];
      el.parentNode.insertBefore(sr, el);
      el.setAttribute('aria-hidden', 'true');
      el.classList.add('rotator');
      el.textContent = '';
      var spans = words.map(function (w, i) {
        var s = document.createElement('span');
        s.className = 'rotator__word' + (i === 0 ? ' is-current' : '');
        s.textContent = w;
        el.appendChild(s);
        return s;
      });
      if (still) return;
      var every = parseInt(getComputedStyle(doc).getPropertyValue('--rotate-every'), 10) || 2400;
      var n = 0;
      setInterval(function () {
        if (document.hidden) return;
        var old = spans[n];
        n = (n + 1) % spans.length;
        old.classList.remove('is-current');
        old.classList.add('is-leaving');
        spans[n].classList.remove('is-leaving');
        spans[n].classList.add('is-current');
        setTimeout(function () { old.classList.remove('is-leaving'); }, 700);
      }, every);
    });
  }

  /* ---- Statement paragraph: words fill as you scroll past ----------------------------------------------------- */
  var fills = [];
  function prepareFills() {
    $$('[data-fill]').forEach(function (el) {
      var n = splitWords(el, 'fill-word');
      fills.push({ el: el, words: $$('.fill-word', el), n: n });
      if (still) $$('.fill-word', el).forEach(function (w) { w.classList.add('is-lit'); });
    });
  }
  function updateFills(vh) {
    fills.forEach(function (f) {
      var r = f.el.getBoundingClientRect();
      // 0 when the paragraph's top is at 85% of the screen, 1 when its bottom reaches 40%.
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.45);
      var lit = Math.round(Math.max(0, Math.min(1, p)) * f.n);
      f.words.forEach(function (w, i) { w.classList.toggle('is-lit', i < lit); });
    });
  }

  /* ---- Sticky scrollytelling ---------------------------------------------------------------------------------- */
  function scrollies() {
    $$('[data-scrolly]').forEach(function (box) {
      var word = box.querySelector('[data-scrolly-word]');
      var count = box.querySelector('[data-scrolly-count]');
      var steps = $$('[data-step]', box);
      if (!steps.length) return;
      function activate(step) {
        steps.forEach(function (s) { s.classList.toggle('is-active', s === step); });
        var w = step.getAttribute('data-word');
        if (word && w && word.textContent !== w) {
          word.textContent = w;
          if (!still) { word.classList.remove('is-swapping'); void word.offsetWidth; word.classList.add('is-swapping'); }
        }
        if (count) count.textContent = (steps.indexOf(step) + 1) + ' / ' + steps.length;
      }
      activate(steps[0]);
      if (!hasIO) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) activate(e.target); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach(function (s) { io.observe(s); });
    });
  }

  /* ---- Parallax fallback (browsers without CSS scroll timelines) --------------------------------------------- */
  var parallax = [];
  function prepareParallax() {
    if (still || (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'))) return;
    parallax = $$('[data-parallax]');
  }
  function updateParallax(vh) {
    parallax.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var k = parseFloat(el.getAttribute('data-parallax')) || 0.12;
      el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -k).toFixed(1) + 'px,0)';
    });
  }

  /* ---- Reading-progress bar --------------------------------------------------------------------------------- */
  var bar = null;
  function prepareBar() {
    if (document.body.getAttribute('data-progress') === 'off') return;
    bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }
  function updateBar() {
    if (!bar) return;
    var max = doc.scrollHeight - window.innerHeight;
    bar.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
  }

  /* ---- Marquee pause button (moving content longer than 5s can be paused) ------------------------------------- */
  function marquees() {
    $$('[data-marquee-toggle]').forEach(function (btn) {
      var band = btn.closest('[data-marquee]') || btn.parentNode;
      var m = band.querySelector('.marquee');
      btn.addEventListener('click', function () {
        var paused = m.classList.toggle('is-paused');
        btn.setAttribute('aria-pressed', String(paused));
        btn.textContent = paused ? 'Play' : 'Pause';
      });
    });
  }

  /* ---- One scroll loop for everything that follows the scroll ------------------------------------------------- */
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var vh = window.innerHeight;
      updateBar();
      updateFills(vh);
      updateParallax(vh);
    });
  }

  function start() {
    scan(document);
    rotators();
    prepareFills();
    scrollies();
    prepareParallax();
    prepareBar();
    marquees();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  window.Motion = { scan: scan, still: still };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
