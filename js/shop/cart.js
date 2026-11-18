/* =====================================================================================================================
   cart.js: the cart drawer on every shop page. Owner: Senior Developer 2.

   - Any element with [data-cart-open] opens the drawer (the header's cart link; the menu's floating cart bar).
     [data-cart-count] elements show the number of items. Shop.openCart(opener) opens it from code.
   - Lines show their options and note, a stepper and Remove. Prices come from the shop service's quote (with the
     best coupon), so the drawer shows what checkout will charge before gift cards; until the quote answers, the
     catalog estimate is shown.
   - One add-on suggestion: the first item tagged "pairs" in shop/catalog.json that is not in the cart yet.
   Styles: css/shop/core.css (.cart-line, .addon, .totals), so the drawer looks right on every page.
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  if (!Shop) return;
  var esc = Shop.esc, icon = Shop.icon;
  var drawer = null, quoteTimer = null, quoteSeq = 0, lastQuote = null;

  /* ---- Header counts ------------------------------------------------------------------------------------------ */
  function refreshCounts(bump) {
    var n = Shop.cart.count();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (el) {
      el.textContent = String(n);
      if (bump) { el.classList.remove('is-bumped'); void el.offsetWidth; el.classList.add('is-bumped'); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('.cart-link'), function (a) {
      a.setAttribute('aria-label', 'Cart, ' + n + (n === 1 ? ' item' : ' items'));
    });
  }

  /* ---- The drawer ----------------------------------------------------------------------------------------------- */
  function build() {
    drawer = Shop.sheet({ id: 'cart-drawer', title: 'Your order', className: 'sheet--drawer' });
    drawer.body.addEventListener('click', onClick);
    drawer.foot.hidden = false;
  }

  function open(opener) {
    Shop.ready.then(function () {
      if (!drawer) build();
      render();
      drawer.open(opener);
      requestQuote(0);
    }, function (err) { Shop.toast(err.message, { tone: 'danger' }); });
  }

  function render() {
    if (!drawer) return;
    var lines = Shop.cart.lines();
    var st = Shop.store(Shop.storeId());
    if (!lines.length) {
      drawer.body.innerHTML = '<div class="empty">' + icon('bag') + '<p>Your cart is empty. Pick something good.</p>' +
        '<a class="btn btn--primary" href="' + Shop.href('pages/menu.html') + '">Browse the menu</a></div>';
      drawer.foot.innerHTML = '';
      drawer.foot.hidden = true;
      return;
    }
    drawer.foot.hidden = false;
    var q = lastQuote && lastQuote.n === lines.length ? lastQuote.q : null;
    drawer.body.innerHTML =
      (st ? '<p class="cart-store">' + icon('pin') + '<span>Pickup at <strong>' + esc(st.name) + '</strong></span></p>' : '') +
      '<ul class="cart-lines" role="list">' + lines.map(function (l, i) {
        var it = Shop.item(l.item) || { name: l.item };
        var price = q && q.lines[i] ? q.lines[i].total : Shop.estimate(l).total;
        var opts = Shop.describe(l);
        return '<li class="cart-line">' +
          '<div><div class="cart-line__name">' + esc(it.name) + '</div>' +
          (opts ? '<div class="cart-line__opts">' + esc(opts) + '</div>' : '') +
          (l.note ? '<div class="cart-line__note">“' + esc(l.note) + '”</div>' : '') + '</div>' +
          '<div class="cart-line__price">' + Shop.money(price) + '</div>' +
          '<div class="cart-line__controls">' +
            '<div class="stepper stepper--sm" role="group" aria-label="Quantity of ' + esc(it.name) + '">' +
              '<button type="button" data-dec="' + i + '" aria-label="One less ' + esc(it.name) + '">' + icon('minus') + '</button>' +
              '<span class="stepper__value" aria-live="polite">' + l.qty + '</span>' +
              '<button type="button" data-inc="' + i + '" aria-label="One more ' + esc(it.name) + '"' + (l.qty >= 20 ? ' disabled' : '') + '>' + icon('plus') + '</button>' +
            '</div>' +
            '<button type="button" class="link-btn" data-remove="' + i + '">Remove<span class="visually-hidden"> ' + esc(it.name) + '</span></button>' +
          '</div></li>';
      }).join('') + '</ul>' + addon(lines) + '<div class="cart-error" data-cart-error></div>';

    var sub = q ? q.subtotal : Shop.cart.estimate();
    var disc = q && q.discount;
    var total = q ? q.total : sub;
    drawer.foot.innerHTML = '<div class="cart-foot">' +
      '<dl class="totals">' +
        '<div><dt>Subtotal</dt><dd>' + Shop.money(sub) + '</dd></div>' +
        (disc ? '<div class="is-discount"><dt>' + esc(disc.code) + ' applied</dt><dd>−' + Shop.money(disc.amount) + '</dd></div>' : '') +
        '<div class="is-total"><dt>Total</dt><dd>' + Shop.money(total) + '</dd></div>' +
      '</dl>' +
      '<p class="muted"><small>' + (q ? 'Gift cards and other codes can be used at checkout.' : 'Checking prices with the shop…') + '</small></p>' +
      '<a class="btn btn--primary btn--lg btn--block" href="' + Shop.href('pages/checkout.html') + '">Checkout<span class="btn__price">' + Shop.money(total) + '</span></a>' +
      '</div>';
  }

  /* The first "pairs" item (a pastry with a coffee) that is not already in the cart. */
  function addon(lines) {
    var inCart = lines.map(function (l) { return l.item; });
    var pick = Shop.catalog.items.filter(function (it) {
      return (it.tags || []).indexOf('pairs') > -1 && !it.soldOut && inCart.indexOf(it.id) < 0;
    })[0];
    if (!pick) return '';
    return '<div class="addon">' + icon('croissant') +
      '<span class="addon__text"><span>Goes well with your order</span><strong>' + esc(pick.name) + '</strong></span>' +
      '<button type="button" class="btn btn--sm" data-addon="' + esc(pick.id) + '">Add · ' + Shop.money(pick.price) + '</button></div>';
  }

  function onClick(e) {
    var b = e.target.closest('button');
    if (!b) return;
    var lines = Shop.cart.lines(), i;
    if (b.hasAttribute('data-inc')) { i = +b.getAttribute('data-inc'); Shop.cart.setQty(i, lines[i].qty + 1); focusAfter('[data-inc="' + i + '"]'); }
    else if (b.hasAttribute('data-dec')) {
      i = +b.getAttribute('data-dec');
      Shop.cart.setQty(i, lines[i].qty - 1);
      focusAfter(lines[i].qty > 1 ? '[data-dec="' + i + '"]' : '.sheet__close');
    }
    else if (b.hasAttribute('data-remove')) {
      i = +b.getAttribute('data-remove');
      var removed = lines[i], name = (Shop.item(removed.item) || {}).name || 'Item';
      Shop.cart.remove(i);
      focusAfter('.sheet__close');
      Shop.toast(name + ' removed', { action: { label: 'Undo', fn: function () { Shop.cart.add(removed); } } });
    }
    else if (b.hasAttribute('data-addon')) {
      var it = Shop.item(b.getAttribute('data-addon'));
      Shop.cart.add({ item: it.id, qty: 1, options: {} });
      Shop.toast(it.name + ' added');
      focusAfter('.sheet__close');
    }
  }
  // The drawer re-renders on every change; keep keyboard focus on the control the person was using.
  function focusAfter(sel) {
    setTimeout(function () {
      var el = drawer && drawer.el.querySelector(sel);
      if (el && !el.disabled) el.focus(); else if (drawer) drawer.el.querySelector('.sheet__close').focus();
    }, 0);
  }

  /* ---- Prices from the service (debounced; quotes count towards the API's write limit) ------------------------- */
  function requestQuote(delay) {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(function () {
      var lines = Shop.cart.lines();
      if (!lines.length || !drawer || !drawer.el.open) return;
      var seq = ++quoteSeq;
      Shop.api.post('quote', { items: lines, coupon: 'best', customer: Shop.customer() }).then(function (q) {
        if (seq !== quoteSeq) return;
        lastQuote = { n: lines.length, q: q };
        render();
      }, function (err) {
        if (seq !== quoteSeq) return;
        lastQuote = null;
        render();
        var box = drawer.body.querySelector('[data-cart-error]');
        if (box) box.innerHTML = '<p class="notice notice--danger" role="alert">' + esc(err.message) + '</p>';
      });
    }, delay == null ? 450 : delay);
  }

  /* ---- Wiring ----------------------------------------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cart-open]');
    if (!t || document.body.getAttribute('data-cart') === 'off') return;
    e.preventDefault();
    open(t);
  });
  Shop.on('cart', function () {
    refreshCounts(true);
    lastQuote = null;
    if (drawer && drawer.el.open) { render(); requestQuote(); }
  });
  Shop.on('store', function () { if (drawer && drawer.el.open) render(); });
  refreshCounts(false);

  Shop.openCart = open;
})();
