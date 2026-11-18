/* =====================================================================================================================
   menu.js: the menu page (pages/menu.html). Owner: Senior Developer 1.

   Renders shop/catalog.json into:
     - the store chip (opens the shared store picker: distance, hours, open or closed now)
     - "Your usual" (saved from a product sheet) with one-tap Add
     - a category rail that follows the scroll, and a section per category
     - product cards: price as configured by default, an "est." price after the best coupon (display only: the
       service prices the real order), badges and tags, sold-out items greyed, and a + button that adds the default
     - the product sheet: option chips with their +price (radio for "one" groups, checkboxes up to "max" for "many"),
       groups shown only when relevant ("showIf": {"temp": "iced"} in the catalog), quantity, note, live total,
       kcal and allergens, Add to cart and Save as my usual
     - the floating cart bar (count and total) that opens the cart drawer
   Links: pages/menu.html#item-<id> opens that item's sheet.
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  var root = document.querySelector('[data-menu-root]');
  if (!Shop || !root) return;
  var esc = Shop.esc, icon = Shop.icon, cat = null, productSheet = null, current = null;

  Shop.ready.then(function (c) {
    cat = c;
    render();
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }, function (err) { Shop.fail(root, err); });

  /* ---- Page --------------------------------------------------------------------------------------------------- */
  /* Whole cakes are baked to order: these choices need a day's notice (group id -> choice ids). */
  var AHEAD = { 'cake-size': ['six', 'eight'] };
  function isAhead(gid, cid) { return (AHEAD[gid] || []).indexOf(cid) > -1; }

  function defaultLine(it) { return { item: it.id, qty: 1, options: {} }; }
  function catIcon(id) { var c = cat.categories.filter(function (x) { return x.id === id; })[0]; return (c && c.icon) || 'cup'; }

  function render() {
    root.removeAttribute('aria-busy');
    var cats = cat.categories.filter(function (c) { return cat.items.some(function (it) { return it.category === c.id; }); });
    var loose = cat.items.filter(function (it) { return !cats.some(function (c) { return c.id === it.category; }); });
    if (loose.length) cats.push({ id: 'more', name: 'More', blurb: '' });
    root.innerHTML =
      '<div class="menu-top"><button type="button" class="store-chip" data-store-chip></button><div data-usual-slot></div></div>' +
      '<div class="menu-layout">' +
        '<nav class="cat-rail" aria-label="Menu sections"><ul role="list">' + cats.map(function (c) {
          return '<li><a class="chip" href="#cat-' + esc(c.id) + '" data-cat-link="' + esc(c.id) + '">' + esc(c.name) + '</a></li>';
        }).join('') + '</ul></nav>' +
        '<div class="menu-sections">' + cats.map(function (c) {
          var items = c.id === 'more' ? loose : cat.items.filter(function (it) { return it.category === c.id; });
          return '<section class="menu-cat" id="cat-' + esc(c.id) + '" aria-labelledby="cat-' + esc(c.id) + '-title" data-cat="' + esc(c.id) + '">' +
            '<div class="menu-cat__head"><h2 id="cat-' + esc(c.id) + '-title">' + esc(c.name) + '</h2>' +
            (c.blurb ? '<p>' + esc(c.blurb) + '</p>' : '') + '</div>' +
            '<ul class="product-grid" role="list">' + items.map(card).join('') + '</ul></section>';
        }).join('') + '</div></div>';
    storeChip();
    usualCard();
    trackRail();
    root.addEventListener('click', onClick);
    Shop.on('store', storeChip);
    Shop.on('usual', usualCard);
    Shop.on('cart', cartBar);
    cartBar();
  }

  function card(it) {
    var price = Shop.estimate(defaultLine(it)).unit;
    var est = it.soldOut ? null : Shop.couponEstimate(price);
    var tags = (it.tags || []).filter(function (t) { return ['vegan', 'vegetarian', 'dairy-free', 'take home'].indexOf(t) > -1; });
    return '<li class="product' + (it.soldOut ? ' is-sold-out' : '') + '" id="item-' + esc(it.id) + '">' +
      '<span class="product__icon">' + icon(catIcon(it.category)) + '</span>' +
      '<div class="product__body">' +
        '<h3 class="product__name"><button type="button" class="product__open" data-open="' + esc(it.id) + '">' + esc(it.name) + '</button></h3>' +
        (it.desc ? '<p class="product__desc">' + esc(it.desc) + '</p>' : '') +
        '<p class="product__price"><span class="price">' + Shop.money(price) + '</span>' +
          (est ? ' <span class="est" title="An estimate with ' + esc(est.code) + ' on this item alone. Checkout applies the best code for your whole order.">est. ' +
            Shop.money(price - est.amount) + ' with ' + esc(est.code) + '</span>' : '') + '</p>' +
        '<div class="product__badges">' +
          (it.soldOut ? '<span class="badge badge--muted">Sold out today</span>' : '') +
          (it.badge ? '<span class="badge">' + esc(it.badge) + '</span>' : '') +
          tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
        '</div>' +
      '</div>' +
      '<button type="button" class="icon-btn icon-btn--accent product__add" data-add="' + esc(it.id) + '"' +
        (it.soldOut ? ' disabled aria-label="' + esc(it.name) + ' is sold out today"' : ' aria-label="Add ' + esc(it.name) + ' to your cart"') + '>' +
        icon('plus') + '</button>' +
    '</li>';
  }

  function storeChip() {
    var btn = root.querySelector('[data-store-chip]');
    var st = Shop.store(Shop.storeId());
    if (!btn || !st) return;
    var s = Shop.storeStatus(st);
    btn.setAttribute('aria-label', 'Pickup store: ' + st.name + ', ' + s.short + '. Change store');
    btn.innerHTML = icon('pin') + '<span class="store-chip__text"><span class="store-chip__label">Pickup at</span>' +
      '<strong>' + esc(st.name) + '</strong></span>' +
      '<span class="store-chip__meta"><span class="status-dot ' + (s.open ? (s.soon ? 'is-soon' : 'is-open') : 'is-closed') + '">' + esc(s.short) + '</span>' +
      (st.distanceKm != null ? '<span>' + esc(st.distanceKm) + ' km</span>' : '') + '</span>' + icon('down');
  }

  function usualCard() {
    var slot = root.querySelector('[data-usual-slot]');
    var u = Shop.usual.get();
    if (!slot) return;
    if (!u) { slot.innerHTML = ''; return; }
    var it = Shop.item(u.item);
    slot.innerHTML = '<div class="usual-card">' + icon('heart') +
      '<span class="usual-card__text"><span class="usual-card__label">Your usual</span><strong>' + esc(it.name) + '</strong>' +
      '<span class="muted">' + esc(Shop.describe(u)) + '</span></span>' +
      '<button type="button" class="btn btn--sm btn--primary" data-add-usual' + (it.soldOut ? ' disabled' : '') + '>' +
      (it.soldOut ? 'Sold out today' : 'Add · ' + Shop.money(Shop.estimate(u).total)) + '</button></div>';
  }

  /* ---- Category rail follows the scroll ------------------------------------------------------------------------- */
  function trackRail() {
    var rail = root.querySelector('.cat-rail');
    var links = Array.prototype.slice.call(root.querySelectorAll('[data-cat-link]'));
    function activate(id) {
      links.forEach(function (a) {
        var on = a.getAttribute('data-cat-link') === id;
        a.setAttribute('aria-current', on ? 'true' : 'false');
        if (on && rail.scrollWidth > rail.clientWidth) {
          var left = a.offsetLeft - (rail.clientWidth - a.offsetWidth) / 2;
          rail.scrollTo({ left: left, behavior: window.Motion && window.Motion.still ? 'auto' : 'smooth' });
        }
      });
    }
    if (links[0]) activate(links[0].getAttribute('data-cat-link'));
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activate(e.target.getAttribute('data-cat')); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Array.prototype.forEach.call(root.querySelectorAll('[data-cat]'), function (s) { io.observe(s); });
  }

  /* ---- Clicks ---------------------------------------------------------------------------------------------------- */
  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-store-chip]'))) { Shop.openStorePicker(t); return; }
    if ((t = e.target.closest('[data-open]'))) { openProduct(t.getAttribute('data-open'), t); return; }
    if ((t = e.target.closest('[data-add]'))) {
      var it = Shop.item(t.getAttribute('data-add'));
      Shop.cart.add(defaultLine(it));
      var opts = Shop.describe(defaultLine(it));
      Shop.toast(it.name + ' added' + (opts ? ' · ' + opts : ''), { action: { label: 'Change', fn: function () { openProduct(it.id, t); } } });
      return;
    }
    if ((t = e.target.closest('[data-add-usual]'))) {
      var u = Shop.usual.get();
      Shop.cart.add(u);
      Shop.toast('Your usual is in the cart');
    }
  }

  function openFromHash() {
    var m = location.hash.match(/^#item-([a-z0-9_-]+)$/);
    if (m && Shop.item(m[1])) {
      var opener = root.querySelector('[data-open="' + m[1] + '"]');
      if (opener) opener.closest('.product').scrollIntoView({ block: 'center' });
      openProduct(m[1], opener);
    }
  }

  /* ---- The product sheet -------------------------------------------------------------------------------------- */
  function openProduct(id, opener) {
    var it = Shop.item(id);
    if (!it) return;
    if (!productSheet) {
      productSheet = Shop.sheet({ id: 'product-sheet', className: 'product-sheet' });
      productSheet.body.addEventListener('change', onFormChange);
      productSheet.el.addEventListener('submit', function (e) { e.preventDefault(); addCurrent(); });
      productSheet.el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-qty')) {
          current.qty = Math.max(1, Math.min(20, current.qty + (+b.getAttribute('data-qty'))));
          refreshTotal();
        } else if (b.hasAttribute('data-save-usual')) {
          Shop.usual.set(readLine());
          Shop.toast('Saved as your usual. It waits for you at the top of the menu.');
        }
      });
      productSheet.foot.hidden = false;
    }
    current = { item: it, qty: 1 };
    productSheet.setTitle(it.name);
    var allergens = (it.allergens || []);
    productSheet.body.innerHTML = '<form id="product-form" class="product-form" novalidate>' +
      '<div class="pf-intro"><span class="product__icon product__icon--big">' + icon(catIcon(it.category)) + '</span>' +
        '<div>' + (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') +
        '<p class="pf-facts">' + (it.kcal != null ? '<span>' + esc(it.kcal) + ' kcal as standard</span>' : '') +
          '<span>' + (allergens.length ? 'Contains ' + esc(allergens.join(', ')) : 'No common allergens listed') + '</span>' +
          '<span>Allergies? Ask at the counter before you order.</span></p>' +
        (it.badge ? '<span class="badge">' + esc(it.badge) + '</span>' : '') + '</div></div>' +
      (it.soldOut ? '<p class="notice notice--warning">Sold out today. Back tomorrow morning.</p>' : '') +
      (it.options || []).map(function (gid) { return groupHtml(it, gid); }).join('') +
      '<p class="notice notice--info pf-ahead" data-ahead hidden role="status">Whole cakes are baked to order. Order a day ahead and choose a pickup time tomorrow or later at checkout.</p>' +
      '<div class="field pf-note"><label for="pf-note">Note for the barista <span class="muted">(optional)</span></label>' +
        '<input id="pf-note" name="note" maxlength="140" autocomplete="off" placeholder="Extra hot, light foam…"></div>' +
      '</form>';
    productSheet.foot.innerHTML = '<div class="pf-foot">' +
      '<div class="stepper" role="group" aria-label="Quantity">' +
        '<button type="button" data-qty="-1" aria-label="One less">' + icon('minus') + '</button>' +
        '<span class="stepper__value" data-qty-value>1</span>' +
        '<button type="button" data-qty="1" aria-label="One more">' + icon('plus') + '</button></div>' +
      '<button type="submit" form="product-form" class="btn btn--primary btn--lg pf-add"' + (it.soldOut ? ' disabled' : '') + '>' +
        (it.soldOut ? 'Sold out' : 'Add to cart') + '<span class="btn__price" data-total></span></button>' +
      '</div>' +
      '<div class="pf-foot2"><button type="button" class="link-btn" data-save-usual' + (it.soldOut ? ' hidden' : '') + '>' + icon('heart') + ' Save as my usual</button>' +
      '<span class="visually-hidden" aria-live="polite" data-total-live></span></div>';
    applyShowIf();
    applyMax();
    showAhead();
    refreshTotal();
    productSheet.open(opener);
  }

  function groupHtml(it, gid) {
    var g = Shop.group(gid);
    if (!g) return '';
    var allowed = (it.choices && it.choices[gid]) || g.choices.map(function (c) { return c.id; });
    var many = g.type === 'many';
    var required = g.required != null ? g.required : !many;
    var def = g.choices.filter(function (c) { return c.default && allowed.indexOf(c.id) > -1; })[0];
    var preselect = !many && (def || (required ? g.choices.filter(function (c) { return allowed.indexOf(c.id) > -1; })[0] : null));
    var hint = many ? 'Up to ' + (g.max || 3) : required ? 'Pick one' : 'Optional';
    return '<fieldset class="opt-group" data-group="' + esc(gid) + '"' + (g.showIf ? ' data-show-if="' + esc(JSON.stringify(g.showIf)) + '"' : '') + '>' +
      '<legend class="opt-group__legend"><span>' + esc(g.name) + '</span><span class="opt-group__hint">' + hint + '</span></legend>' +
      '<div class="chips">' + g.choices.filter(function (c) { return allowed.indexOf(c.id) > -1; }).map(function (c) {
        var price = c.price ? (c.price > 0 ? '+' : '−') + Shop.money(Math.abs(c.price)) : '';
        return '<label class="chip"><input type="' + (many ? 'checkbox' : 'radio') + '" name="' + esc(gid) + '" value="' + esc(c.id) + '"' +
          (preselect && preselect.id === c.id ? ' checked' : '') + (c.soldOut ? ' disabled' : '') + '>' +
          '<span>' + esc(c.name) + (c.soldOut ? ' (sold out)' : '') + '</span>' +
          (price ? '<span class="chip__price"> ' + price + '</span>' : '') +
          (isAhead(gid, c.id) ? '<span class="chip__ahead">Order a day ahead</span>' : '') + '</label>';
      }).join('') + '</div></fieldset>';
  }

  /* A group with "showIf": {"temp": "iced"} shows only while that choice is picked (if the item has that group). */
  function applyShowIf() {
    var form = productSheet.body.querySelector('form');
    Array.prototype.forEach.call(form.querySelectorAll('[data-show-if]'), function (fs) {
      var cond = JSON.parse(fs.getAttribute('data-show-if'));
      var show = Object.keys(cond).every(function (gid) {
        var inputs = form.querySelectorAll('input[name="' + gid + '"]');
        if (!inputs.length) return true;
        var picked = form.querySelector('input[name="' + gid + '"]:checked');
        return picked && [].concat(cond[gid]).indexOf(picked.value) > -1;
      });
      fs.hidden = !show;
      fs.disabled = !show;
    });
  }
  /* A "many" group: once "max" are ticked, the rest are disabled until one is unticked. */
  function applyMax() {
    var form = productSheet.body.querySelector('form');
    current.item.options && current.item.options.forEach(function (gid) {
      var g = Shop.group(gid);
      if (!g || g.type !== 'many') return;
      var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name="' + gid + '"]'));
      var n = boxes.filter(function (b) { return b.checked; }).length;
      boxes.forEach(function (b) {
        var soldOut = (g.choices.filter(function (c) { return c.id === b.value; })[0] || {}).soldOut;
        b.disabled = soldOut || (!b.checked && n >= (g.max || 3));
      });
    });
  }
  function showAhead() {
    var form = productSheet.body.querySelector('form'), note = form.querySelector('[data-ahead]');
    var line = readLine();
    note.hidden = !Object.keys(AHEAD).some(function (gid) { return isAhead(gid, line.options[gid]); });
  }
  function onFormChange() { applyShowIf(); applyMax(); showAhead(); refreshTotal(); }

  function readLine() {
    var form = productSheet.body.querySelector('form');
    var options = {};
    (current.item.options || []).forEach(function (gid) {
      var g = Shop.group(gid);
      var fs = form.querySelector('[data-group="' + gid + '"]');
      if (!g || !fs || fs.disabled) return;
      var picked = Array.prototype.map.call(fs.querySelectorAll('input:checked'), function (i) { return i.value; });
      if (g.type === 'many') { if (picked.length) options[gid] = picked; }
      else if (picked[0]) options[gid] = picked[0];
    });
    return { item: current.item.id, qty: current.qty, options: options, note: (form.querySelector('[name="note"]').value || '').trim() };
  }
  function refreshTotal() {
    var line = readLine();
    var total = Shop.money(Shop.estimate(line).total);
    productSheet.foot.querySelector('[data-total]').textContent = total;
    productSheet.foot.querySelector('[data-qty-value]').textContent = String(current.qty);
    productSheet.foot.querySelector('[data-qty="-1"]').disabled = current.qty <= 1;
    productSheet.foot.querySelector('[data-total-live]').textContent = current.qty + ' for ' + total;
  }
  function addCurrent() {
    if (current.item.soldOut) return;
    var line = readLine();
    Shop.cart.add(line);
    productSheet.close();
    Shop.toast((line.qty > 1 ? line.qty + ' × ' : '') + current.item.name + ' added', {
      action: { label: 'View cart', fn: function () { Shop.openCart(); } }
    });
  }

  /* ---- Floating cart bar ------------------------------------------------------------------------------------- */
  function cartBar() {
    var bar = document.querySelector('[data-cart-bar]');
    if (!bar) return;
    var n = Shop.cart.count();
    bar.hidden = n === 0;
    document.body.classList.toggle('has-cart-bar', n > 0);
    bar.innerHTML = '<span class="cart-bar__count">' + n + '</span><span class="cart-bar__label">View cart</span>' +
      '<span class="cart-bar__total">' + Shop.money(Shop.cart.estimate()) + '</span>';
    bar.setAttribute('aria-label', 'View cart: ' + n + (n === 1 ? ' item, ' : ' items, ') + Shop.money(Shop.cart.estimate()));
  }
})();
