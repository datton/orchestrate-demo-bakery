/* Brand pages: home, about, visit. Styles, text reveals, counters, marquee, scrollytelling, live store hours. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CSS = `
.fs-wrap{width:min(100% - 2*var(--gutter,1.5rem),var(--max,76rem));margin-inline:auto}
.fs-sec{padding-block:var(--section,8rem)}
.fs-dark{background:var(--dark,#17100c);color:var(--dark-text,#f6eee6)}
.fs-dark p,.fs-dark .fs-lead{color:var(--dark-muted,#c2b4a8)}
.fs-soft{background:var(--surface-2,#f3ebe2)}
.fs-eyebrow{font:600 .8125rem/1 var(--font-mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--accent,#a8431f);margin:0 0 1.25rem}
.fs-dark .fs-eyebrow,.hero-dark .fs-eyebrow{color:var(--accent-bright,#f0875a)}
.fs h2,.fs h3{font-family:var(--font-display,system-ui);margin:0;line-height:1.04;letter-spacing:-.04em}
.fs h2{font-size:var(--fs-h2,3.5rem)}
.fs h3{font-size:1.35rem;letter-spacing:-.02em;line-height:1.2}
.fs-lead{font-size:var(--fs-lg,1.3rem);max-width:var(--measure,65ch);color:var(--muted,#6b5f57);margin:1.5rem 0 0}
.fs p{max-width:var(--measure,65ch)}
.hero-dark{background:var(--dark,#17100c);color:var(--dark-text,#f6eee6)}
.hero-dark h1,.fs-head h1{color:var(--dark-text,#f6eee6)}
.hero-dark .fs-lead{color:var(--dark-muted,#c2b4a8)}
.fs-cta{display:flex;flex-wrap:wrap;gap:.9rem;margin-top:2.25rem}
.fs-btn{display:inline-flex;align-items:center;gap:.5rem;min-height:48px;padding:.9rem 1.6rem;border-radius:999px;font-weight:650;text-decoration:none;background:var(--accent,#a8431f);color:var(--accent-ink,#fff);transition:transform .3s cubic-bezier(.2,.7,.2,1),box-shadow .3s}
.fs-btn:hover{transform:translateY(-2px);box-shadow:0 12px 28px -10px rgba(148,80,15,.6)}
.fs-btn.ghost{background:transparent;color:inherit;box-shadow:inset 0 0 0 1.5px currentColor}
.fs-btn.on-dark{background:var(--accent-bright,#f0875a);color:#17100c}
.fs-link{text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 100%/0 2px no-repeat;transition:background-size .35s cubic-bezier(.2,.7,.2,1);padding-bottom:2px}
.fs-link:hover,.fs-link:focus-visible{background-size:100% 2px}
.fs-grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));margin-top:3rem}
.fs-card{background:var(--surface,#fff);border-radius:var(--radius,16px);padding:1.6rem;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:.6rem;transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
.fs-card:hover{transform:translateY(-4px);box-shadow:var(--shadow)}
.fs-card p{margin:0;color:var(--muted,#6b5f57);font-size:.97rem}
.fs-price{font:700 1.1rem var(--font-mono,monospace);color:var(--accent,#a8431f);margin-top:auto;padding-top:.6rem}
.fs-tag{align-self:flex-start;font:600 .72rem var(--font-mono,monospace);letter-spacing:.08em;text-transform:uppercase;background:var(--accent-soft,#f6e2d6);color:var(--accent,#a8431f);padding:.3rem .6rem;border-radius:999px}
.fs-nums{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));margin-top:3.5rem}
.fs-num b{display:block;background:var(--gradient-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.fs-num span{color:var(--dark-muted,#c2b4a8);font-size:.95rem}
.fs-stores{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));margin-top:3rem}
.fs-store{background:var(--surface,#fff);color:var(--text,#1d1612);border-radius:var(--radius-lg,28px);padding:2rem;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:.7rem}
.fs-store h3{font-size:1.9rem}
.fs-store .area{color:var(--muted,#6b5f57);margin:0}
.fs-state{display:inline-flex;align-items:center;gap:.5rem;font-weight:650;font-size:.92rem}
.fs-state::before{content:"";width:.6rem;height:.6rem;border-radius:50%;background:var(--muted,#6b5f57)}
.fs-state.open{color:var(--ok,#2f6b3f)}.fs-state.open::before{background:var(--ok,#2f6b3f);box-shadow:0 0 0 4px rgba(47,107,63,.18)}
.fs-state.closed{color:var(--warn,#8a5a00)}.fs-state.closed::before{background:var(--warn,#8a5a00)}
.fs-hours{width:100%;border-collapse:collapse;font-size:.97rem}
.fs-hours th{text-align:left;font-weight:500;color:var(--muted,#6b5f57);padding:.45rem 0;border-top:1px solid var(--line,rgba(0,0,0,.14))}
.fs-hours td{text-align:right;padding:.45rem 0;border-top:1px solid var(--line,rgba(0,0,0,.14));font-variant-numeric:tabular-nums}
.fs-store .fs-cta{margin-top:auto;padding-top:.8rem}
.fs-gift{display:grid;gap:3rem;grid-template-columns:1.1fr .9fr;align-items:center}
.fs-giftcard{aspect-ratio:1.6;border-radius:var(--radius-lg,28px);background:linear-gradient(135deg,var(--accent,#94500f),var(--accent-bright,#e8a14a) 75%,#f6dfb4);color:#fff;padding:1.8rem;display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--shadow-lg);transform:rotate(-3deg)}
.fs-giftcard strong{font:800 clamp(1.5rem,4vw,2.4rem)/1.05 var(--font-display,system-ui);letter-spacing:-.04em}
.fs-giftcard span{font:600 .85rem var(--font-mono,monospace);letter-spacing:.12em;text-transform:uppercase}
.fs-amounts{display:flex;flex-wrap:wrap;gap:.6rem;margin:1.5rem 0 0;padding:0;list-style:none}
.fs-amounts li{padding:.5rem 1rem;border-radius:999px;box-shadow:inset 0 0 0 1.5px var(--line,rgba(0,0,0,.2));font-weight:650}
.fs-head{padding:clamp(6rem,14vw,11rem) 0 clamp(3rem,6vw,5rem);background:var(--dark,#17100c);color:var(--dark-text,#f6eee6);position:relative;overflow:hidden;isolation:isolate}
.fs-head::before{content:"";position:absolute;inset:auto -20% -60% 40%;height:120%;background:var(--glow);z-index:-1;pointer-events:none}
.fs-head h1{font-family:var(--font-display);font-size:var(--fs-h1);letter-spacing:var(--track-display);line-height:1.02;margin:0;max-width:14ch}
.fs-head .fs-lead{color:var(--dark-muted,#c2b4a8)}
.fs-two{display:grid;gap:3rem;grid-template-columns:1fr 1fr;align-items:start}
.fs-list{list-style:none;margin:0;padding:0;display:grid;gap:1rem}
.fs-list li{padding:1.2rem 1.4rem;background:var(--surface,#fff);color:var(--text,#1d1612);border-radius:var(--radius,16px);box-shadow:var(--shadow-sm)}
.fs-list b{display:block;margin-bottom:.2rem}
.fs-list span{color:var(--muted,#6b5f57);font-size:.97rem}
.fs-form{display:grid;gap:1.1rem;grid-template-columns:1fr 1fr;margin-top:2.5rem;max-width:44rem}.fs-form label{display:grid;gap:.35rem;font-weight:600;font-size:.95rem}.fs-form .full{grid-column:1/-1}.fs-form input,.fs-form select{font:inherit;min-height:48px;padding:.6rem .9rem;border-radius:12px;border:1.5px solid var(--line,rgba(0,0,0,.25));background:var(--surface,#fff);color:var(--text)}.fs-form [aria-invalid=true]{border-color:var(--danger,#b3261e)}.fs-err{color:var(--danger,#b3261e);font-weight:500;font-size:.88rem;min-height:1.1em}.fs-est{font-family:var(--font-mono,monospace);color:var(--accent)}#cake-out{margin-top:2rem;padding:1.5rem;border-radius:var(--radius,16px);background:var(--surface,#fff);box-shadow:var(--shadow-sm);max-width:44rem}@media(max-width:600px){.fs-form{grid-template-columns:1fr}}
.fs-demo{font-size:.85rem;color:var(--muted,#6b5f57);margin-top:2rem}
.fs-dark .fs-demo{color:var(--dark-muted,#c2b4a8)}
@media(max-width:760px){.fs-gift,.fs-two{grid-template-columns:1fr}}
`;
  var st = D.createElement('style'); st.textContent = CSS; D.head.appendChild(st);
  var root = D.documentElement;

  /* deferred scripts run in order before DOMContentLoaded: wait for it so Shop (core.js) exists */
  function ready(fn) { D.readyState === 'complete' ? fn() : D.addEventListener('DOMContentLoaded', fn); }

  function setup() {
    D.documentElement.classList.add('fs');
    loadShop();
  }

  /* live data from shop/catalog.json */
  function loadShop() {
    var needs = $$('[data-stores],[data-featured],[data-stat]');
    if (!needs.length || !window.Shop) return;
    Shop.menu().then(function (cat) {
      $$('[data-stores]').forEach(function (el) { renderStores(el, cat, el.dataset.stores); });
      $$('[data-featured]').forEach(function (el) { renderFeatured(el, cat); });
      $$('[data-stat]').forEach(function (el) {
        var v = { stores: cat.stores.length, items: cat.items.length }[el.dataset.stat];
        if (v != null) { el.dataset.count = v; if (!el.classList.contains('is-in')) el.textContent = v; }
      });
    }).catch(function () {
      $$('[data-stores],[data-featured]').forEach(function (el) { el.innerHTML = '<p class="fs-demo">The menu is not available right now. Try again in a moment.</p>'; });
    });
  }
  function renderFeatured(el, cat) {
    var picks = el.dataset.featured.split('|').map(function (p) { var x = p.split(':'); return { id: x[0], tag: x[1] }; });
    el.innerHTML = picks.map(function (p) {
      var i = cat.items.filter(function (q) { return q.id === p.id; })[0];
      if (!i) return '';
      return '<article class="fs-card"><span class="fs-tag">' + esc(p.tag || 'On the menu') + '</span><h3>' + esc(i.name) + '</h3><p>' + esc(i.desc || '') + '</p><span class="fs-price">' + Shop.money(i.price) + '</span></article>';
    }).join('');
  }

  function renderStores(el, cat, mode) {
    var base = el.dataset.base || '';
    function draw() {
      el.innerHTML = cat.stores.map(function (s, k) {
        var o = Shop.openNow(s, cat), rows = s.hours.map(function (h) { return '<tr><th scope="row">' + esc(h.days) + '</th><td>' + esc(h.open) + ' – ' + esc(h.close) + '</td></tr>'; }).join('');
        return '<article class="fs-store " style="--d:' + k * 100 + 'ms"><span class="fs-state ' + (o.open ? 'open' : 'closed') + '">' + esc(o.label) + '</span><h3>' + esc(s.name) + '</h3><p class="area">' + esc(s.area) + ' · ' + s.distanceKm.toString().replace('.', '.') + ' km</p>' +
          (mode === 'full' ? '<table class="fs-hours"><caption class="visually-hidden">Opening hours, ' + esc(s.name) + '</caption><tbody>' + rows + '</tbody></table><p class="area">' + esc(s.pickup) + '. Orders ready in about ' + s.prepMinutes + ' minutes.</p>' : '<p class="area">' + esc(s.hours[0].days) + ' ' + esc(s.hours[0].open) + ' – ' + esc(s.hours[0].close) + '</p>') +
          '<div class="fs-cta"><a class="fs-btn" href="' + base + 'pages/menu.html" data-pick="' + esc(s.id) + '">Order from here</a></div></article>';
      }).join('');
      $$('[data-pick]', el).forEach(function (a) { a.addEventListener('click', function () { Shop.setStore(a.dataset.pick); }); });
    }
    draw(); setInterval(draw, 60000);
  }


  /* Custom cake order: kept in this browser, downloadable as a text file. Nothing is sent. */
  function cakeForm() {
    var f = $('#cake-form'); if (!f) return;
    var KEY = 'bakery:cake-orders', out = $('#cake-out'), date = $('#cake-date');
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    var min = new Date(); min.setDate(min.getDate() + 1); date.min = iso(min);
    var max = new Date(); max.setDate(max.getDate() + 60); date.max = iso(max);
    var prices = { '6': 38, '8': 52, '10': 68 };
    function est() { $('#cake-est').textContent = 'About $' + prices[f.size.value] + '.00 CAD, confirmed at the counter'; }
    f.size.addEventListener('change', est); est();
    function err(id, msg) { var e = $('#' + id + '-err'); e.textContent = msg || ''; $('#' + id).setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg; }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = true;
      ok = err('cake-name', f.name.value.trim().length < 2 ? 'Please add a name for the order.' : '') && ok;
      var d = date.value; ok = err('cake-date', !d ? 'Choose a pickup date.' : (d < date.min ? 'We need a day’s notice for a whole cake.' : '')) && ok;
      ok = err('cake-msg', f.msg.value.length > 40 ? 'Keep the message to 40 characters.' : '') && ok;
      if (!ok) { var bad = f.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return; }
      var o = { name: f.name.value.trim(), size: f.size.value, flavour: f.flavour.value, msg: f.msg.value.trim(), date: d, store: f.store.value, at: new Date().toISOString() };
      try { var all = JSON.parse(localStorage.getItem(KEY) || '[]'); all.push(o); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
      var text = 'Hearth & Crumb Bakery: custom cake request (sample)\nName: ' + o.name + '\nSize: ' + o.size + ' inch\nFlavour: ' + o.flavour + '\nMessage: ' + (o.msg || 'none') + '\nPickup: ' + o.date + ' at ' + o.store + '\n';
      out.hidden = false;
      out.innerHTML = '<strong>Thank you, ' + esc(o.name) + '. Your cake request is saved.</strong><p>' + esc(o.size) + ' inch ' + esc(o.flavour.toLowerCase()) + ' cake for ' + esc(o.date) + ' at ' + esc(o.store) + '. This is a demo: nothing was sent, the request is kept in this browser only.</p><a class="fs-btn ghost" download="cake-request.txt" href="data:text/plain;charset=utf-8,' + encodeURIComponent(text) + '">Download as a text file</a>';
      out.focus();
      f.reset(); est();
    });
  }

  ready(function () { setup(); cakeForm(); });
})();
