/* Menu page: store picker, category rail, cards, options sheet, cart bar. Uses window.Shop (core.js). */
(function () {
  'use strict';
  var S = window.Shop, esc = S.esc, money = S.money;
  var cat = null, query = '';
  var root = document.getElementById('menu-root'), rail = document.getElementById('menu-rail');
  var bar = null;

  function store() {
    var id = S.storeId();
    return (cat.stores || []).filter(function (s) { return s.id === id; })[0] || null;
  }
  function renderStore() {
    var s = store(), n = document.getElementById('store-name'), st = document.getElementById('store-state');
    if (!s) { n.textContent = 'Choose a store'; st.textContent = ''; st.className = 'menu-store-state'; return; }
    var o = S.openNow(s, cat);
    n.textContent = s.name; st.textContent = o.label; st.className = 'menu-store-state ' + (o.open ? 'is-open' : 'is-closed');
  }

  /* ---- store picker ---- */
  function pickStore(first) {
    var html = '<ul class="store-list">' + cat.stores.map(function (s) {
      var o = S.openNow(s, cat), on = S.storeId() === s.id;
      var hrs = (s.hours || []).map(function (h) { return esc(h.days) + ' ' + esc(h.open) + '–' + esc(h.close); }).join(' · ');
      return '<li><button type="button" class="store-opt' + (on ? ' is-on' : '') + '" data-id="' + esc(s.id) + '" aria-pressed="' + on + '">' +
        '<span class="store-opt-top"><strong>' + esc(s.name) + '</strong><span class="menu-store-state ' + (o.open ? 'is-open' : 'is-closed') + '">' + esc(o.label) + '</span></span>' +
        '<span class="shop-muted">' + esc(s.area) + ' · ' + esc(s.distanceKm) + ' km away</span>' +
        '<span class="shop-muted">' + hrs + '</span>' +
        '<span class="shop-muted">About ' + esc(s.prepMinutes) + ' min to make · ' + esc(s.pickup) + '</span></button></li>';
    }).join('') + '</ul>';
    var sh = S.sheet({ title: first ? 'Where are you picking up?' : 'Choose a store', content: html });
    sh.body.addEventListener('click', function (e) {
      var b = e.target.closest('.store-opt'); if (!b) return;
      S.setStore(b.getAttribute('data-id')); renderStore(); sh.close();
      var s = store(); if (s) S.toast('Pickup from ' + s.name);
    });
  }

  /* ---- menu rendering ---- */
  function badgeHtml(i) {
    var b = [];
    if (i.badge) b.push('<span class="shop-badge">' + esc(i.badge) + '</span>');
    else if ((i.tags || []).indexOf('new') > -1) b.push('<span class="shop-badge">New</span>');
    else if ((i.tags || []).indexOf('popular') > -1) b.push('<span class="shop-badge">Popular</span>');
    if (i.notice) b.push('<span class="shop-badge">Whole cake: order a day ahead</span>');
    if (i.soldOut) b.push('<span class="shop-badge menu-sold">Sold out today</span>');
    return b.join('');
  }
  function hasOptions(i) { return (i.options || []).some(function (g) { return cat.options[g]; }); }
  function card(i) {
    var allergens = (i.allergens || []).length ? 'Contains ' + i.allergens.join(', ') : 'No common allergens listed';
    return '<li class="menu-card' + (i.soldOut ? ' is-soldout' : '') + '" data-id="' + esc(i.id) + '">' +
      '<button type="button" class="menu-card-main" data-open="' + esc(i.id) + '"' + (i.soldOut ? ' aria-disabled="true"' : '') + '>' +
      '<span class="menu-card-badges">' + badgeHtml(i) + '</span>' +
      '<span class="menu-card-name">' + esc(i.name) + '</span>' +
      '<span class="menu-card-desc">' + esc(i.desc) + '</span>' +
      '<span class="menu-card-meta">' + esc(allergens) + (i.kcal != null ? ' · ' + esc(i.kcal) + ' kcal' : '') + '</span>' +
      '</button>' +
      '<div class="menu-card-foot"><span class="menu-card-price shop-price">' + (hasOptions(i) ? 'from ' : '') + money(i.price) + '</span>' +
      '<button type="button" class="menu-add" data-add="' + esc(i.id) + '" aria-label="Add ' + esc(i.name) + ' to cart"' + (i.soldOut ? ' disabled' : '') + '>+</button></div></li>';
  }
  function render() {
    var q = query.trim().toLowerCase(), out = '', rails = '';
    cat.categories.forEach(function (c) {
      var items = cat.items.filter(function (i) {
        return i.category === c.id && (!q || (i.name + ' ' + i.desc).toLowerCase().indexOf(q) > -1);
      });
      if (!items.length) return;
      rails += '<a href="#cat-' + esc(c.id) + '" data-cat="' + esc(c.id) + '">' + esc(c.name) + '</a>';
      out += '<section class="menu-cat" id="cat-' + esc(c.id) + '" aria-labelledby="h-' + esc(c.id) + '"><h2 id="h-' + esc(c.id) + '">' + esc(c.name) +
        '</h2><p class="shop-muted">' + esc(c.blurb || '') + '</p><ul class="menu-grid">' + items.map(card).join('') + '</ul></section>';
    });
    root.innerHTML = out || '<p class="menu-note">Nothing on the menu matches “' + esc(query) + '”.</p>';
    rail.innerHTML = rails; rail.hidden = !rails;
    spy();
  }

  /* category rail follows the scroll */
  var spyObs = null;
  function spy() {
    if (spyObs) spyObs.disconnect();
    if (!('IntersectionObserver' in window)) return;
    spyObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id.replace('cat-', '');
        rail.querySelectorAll('a').forEach(function (a) {
          var on = a.getAttribute('data-cat') === id;
          if (on) { a.setAttribute('aria-current', 'true'); rail.scrollTo({ left: Math.max(0, a.offsetLeft - 24), behavior: 'smooth' }); }
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    root.querySelectorAll('.menu-cat').forEach(function (s) { spyObs.observe(s); });
  }
  rail.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    e.preventDefault();
    var t = document.getElementById(a.getAttribute('href').slice(1));
    if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---- defaults and the options sheet ---- */
  function choicesFor(i, g) {
    var all = cat.options[g].choices, lim = i.choices && i.choices[g];
    return lim ? all.filter(function (c) { return lim.indexOf(c.id) > -1; }) : all;
  }
  function defaults(i) {
    var o = {};
    (i.options || []).forEach(function (g) {
      var def = cat.options[g]; if (!def) return;
      var ch = choicesFor(i, g).filter(function (c) { return !c.soldOut; });
      if (def.type === 'one') {
        var d = ch.filter(function (c) { return c.default; })[0] || ch[0];
        if (d && def.required) o[g] = d.id;
      } else o[g] = [];
    });
    return o;
  }
  function needsStore() {
    if (store()) return false;
    S.toast('Choose a store first'); pickStore(true); return true;
  }
  function quickAdd(id) {
    var i = S.findItem(cat, id); if (!i || i.soldOut || needsStore()) return;
    S.Cart.add({ item: i.id, qty: 1, options: defaults(i) });
    S.toast(i.name + ' added to your cart');
  }

  function openSheet(id) {
    var i = S.findItem(cat, id); if (!i || i.soldOut) return;
    if (needsStore()) return;
    var sel = defaults(i), qty = 1, note = '';
    var groups = (i.options || []).filter(function (g) { return cat.options[g]; });
    var html = '<p class="shop-muted">' + esc(i.desc) + '</p>' +
      (i.notice ? '<p class="shop-notice opt-notice">' + esc(i.notice) + '</p>' : '') +
      ((i.allergens || []).length ? '<p class="opt-allergens"><strong>Contains:</strong> ' + esc(i.allergens.join(', ')) + '</p>' : '') +
      groups.map(function (g) {
        var def = cat.options[g], many = def.type === 'many';
        return '<fieldset class="opt-group" data-g="' + esc(g) + '"><legend>' + esc(def.name) +
          (many ? ' <small class="shop-muted">pick up to ' + (def.max || 'any') + '</small>' : '') + '</legend><div class="shop-chips">' +
          choicesFor(i, g).map(function (c) {
            return '<button type="button" class="shop-chip opt-choice" role="' + (many ? 'checkbox' : 'radio') + '" data-c="' + esc(c.id) + '"' + (c.soldOut ? ' disabled' : '') + '>' +
              esc(c.name) + (c.soldOut ? ' (sold out)' : '') + (c.price ? ' <span class="opt-price">' + (c.price > 0 ? '+' : '−') + money(Math.abs(c.price)) + '</span>' : '') + '</button>';
          }).join('') + '</div></fieldset>';
      }).join('') +
      '<label class="shop-field opt-note"><span>Note for the bakers <small class="shop-muted">(optional)</small></span><input type="text" maxlength="120" id="opt-note" placeholder="e.g. no nuts on the side, please"></label>' +
      '<div class="opt-foot"><div class="shop-stepper" role="group" aria-label="Quantity"><button type="button" data-q="-1" aria-label="One fewer">−</button><output id="opt-qty" aria-live="polite">1</output><button type="button" data-q="1" aria-label="One more">+</button></div>' +
      '<button type="button" class="shop-btn opt-addbtn" id="opt-add"></button></div>' +
      '<p class="shop-muted opt-est">Estimated total. The shop confirms the final price at checkout.</p>';
    var sh = S.sheet({ title: i.name, content: html }), body = sh.body;

    function unit() {
      var u = i.price;
      groups.forEach(function (g) {
        var v = sel[g], ids = Array.isArray(v) ? v : (v ? [v] : []);
        choicesFor(i, g).forEach(function (c) { if (ids.indexOf(c.id) > -1) u += c.price || 0; });
      });
      return u;
    }
    function paint() {
      body.querySelectorAll('.opt-group').forEach(function (fs) {
        var g = fs.getAttribute('data-g'), v = sel[g], ids = Array.isArray(v) ? v : (v ? [v] : []);
        fs.querySelectorAll('.opt-choice').forEach(function (b) {
          var on = ids.indexOf(b.getAttribute('data-c')) > -1;
          b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on);
        });
      });
      body.querySelector('#opt-qty').textContent = qty;
      body.querySelector('#opt-add').textContent = 'Add to cart · ' + money(unit() * qty);
    }
    body.addEventListener('click', function (e) {
      var c = e.target.closest('.opt-choice');
      if (c && !c.disabled) {
        var g = c.closest('.opt-group').getAttribute('data-g'), def = cat.options[g], cid = c.getAttribute('data-c');
        if (def.type === 'many') {
          var arr = sel[g] || [], k = arr.indexOf(cid);
          if (k > -1) arr.splice(k, 1);
          else if (!def.max || arr.length < def.max) arr.push(cid);
          else S.toast('Pick up to ' + def.max + ' ' + def.name.toLowerCase(), { error: true });
          sel[g] = arr;
        } else if (!def.required && sel[g] === cid) delete sel[g]; else sel[g] = cid;
        return paint();
      }
      var q = e.target.closest('[data-q]');
      if (q) { qty = Math.max(1, Math.min(20, qty + +q.getAttribute('data-q'))); return paint(); }
      if (e.target.closest('#opt-add')) {
        S.Cart.add({ item: i.id, qty: qty, options: sel, note: body.querySelector('#opt-note').value.trim() });
        sh.close(); S.toast(qty + ' × ' + i.name + ' added to your cart');
      }
    });
    paint();
  }

  /* ---- floating cart bar ---- */
  function cartBar() {
    var n = S.Cart.count();
    if (!n) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) {
      bar = document.createElement('a'); bar.className = 'shop-floatbar menu-cartbar'; bar.href = 'checkout.html';
      document.body.appendChild(bar);
    }
    var est = S.Cart.lines().reduce(function (t, l) {
      var it = S.findItem(cat, l.item); if (!it) return t;
      var u = it.price;
      Object.keys(l.options || {}).forEach(function (g) {
        var v = l.options[g], ids = Array.isArray(v) ? v : [v], def = cat.options[g];
        if (def) def.choices.forEach(function (c) { if (ids.indexOf(c.id) > -1) u += c.price || 0; });
      });
      return t + u * l.qty;
    }, 0);
    bar.innerHTML = '<span>' + n + (n === 1 ? ' item' : ' items') + '</span><span>View cart · <span class="shop-price">' + money(est) + '</span> est.</span>';
  }
  window.addEventListener('shop:cart', function () { if (cat) cartBar(); });

  /* ---- wire up ---- */
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-add]'); if (a) return quickAdd(a.getAttribute('data-add'));
    var o = e.target.closest('[data-open]'); if (o) openSheet(o.getAttribute('data-open'));
  });
  document.getElementById('store-btn').addEventListener('click', function () { if (cat) pickStore(false); });
  document.getElementById('menu-search').addEventListener('input', function (e) { query = e.target.value; render(); });

  S.menu().then(function (c) {
    cat = c; renderStore(); render(); cartBar();
    if (!S.storeId()) { if (c.stores.length === 1) { S.setStore(c.stores[0].id); renderStore(); } }
    var want = S.qs('item'); if (want) openSheet(want);
  }).catch(function (err) { root.innerHTML = '<p class="menu-note">' + esc(err.message) + '</p>'; });
})();
