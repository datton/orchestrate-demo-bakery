/* Cart drawer, on every shop page. Needs js/shop/core.js (window.Shop). Open it with any [data-cart-open],
   the menu's cart bar, or window.dispatchEvent(new Event('shop:open-cart')). */
(function () {
  'use strict';
  var Shop = window.Shop, drawer = null, quoteSeq = 0;
  if (!Shop) return;
  var Cart = Shop.Cart;
  var onCheckout = /\/pages\/checkout\.html$/.test(location.pathname);

  /* Back from the payment page: the order is paid or on its way, so the cart has done its job. */
  (function clearAfterPay() {
    var pend = Shop.store.read('pendingOrder', null), o = Shop.qs('o');
    if (pend && o && pend === o && /\/order\.html$/.test(location.pathname)) { Cart.clear(); Shop.store.write('pendingOrder', null); }
  })();

  /* The drawer brings its own styles, so every page gets them. */
  (function css() {
    if (document.querySelector('link[href$="shop/checkout.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = Shop.url('css/shop/checkout.css'); document.head.appendChild(l);
  })();

  var menuP = null;
  function catalog() { return menuP || (menuP = Shop.menu()); }

  function render() {
    if (!drawer) return;
    var lines = Cart.lines(), body = drawer.body;
    if (!lines.length) {
      body.innerHTML = '<div class="cart-empty"><p><strong>Your cart is empty.</strong></p><p class="shop-muted">Add a drink or a pastry and it will wait for you here.</p><a class="shop-btn" href="' + Shop.url('pages/menu.html') + '">Browse the menu</a></div>';
      return;
    }
    body.innerHTML = '<ul class="cart-lines" aria-label="Cart lines"></ul><div class="cart-sum" aria-live="polite"></div><div class="cart-actions"></div>';
    var ul = body.querySelector('.cart-lines');
    lines.forEach(function (l) {
      var li = document.createElement('li'); li.className = 'cart-line'; li.dataset.id = l.id;
      li.innerHTML = '<div class="cart-line-main"><strong class="cart-line-name"></strong><span class="cart-line-opts shop-muted"></span><span class="cart-line-price shop-price"></span></div>' +
        '<div class="cart-line-ctl"><div class="shop-stepper"><button type="button" data-d="-1" aria-label="One fewer">−</button><output aria-live="polite">' + l.qty + '</output><button type="button" data-d="1" aria-label="One more">+</button></div><button type="button" class="cart-remove" data-rm="1">Remove</button></div>';
      li.querySelector('.cart-line-name').textContent = l.item;
      ul.appendChild(li);
    });
    ul.addEventListener('click', function (e) {
      var li = e.target.closest('.cart-line'); if (!li) return;
      var l = Cart.lines().filter(function (x) { return x.id === li.dataset.id; })[0]; if (!l) return;
      if (e.target.closest('[data-rm]')) Cart.remove(l.id);
      else if (e.target.closest('[data-d]')) Cart.setQty(l.id, l.qty + (+e.target.closest('[data-d]').dataset.d));
    });
    var a = body.querySelector('.cart-actions');
    a.innerHTML = '<a class="shop-btn shop-btn--block" href="' + Shop.url('pages/checkout.html') + '">Go to checkout</a><button type="button" class="shop-btn shop-btn--ghost shop-btn--block" data-clear>Clear cart</button><p class="shop-demo-label">Demo shop: test payments only. No real money moves.</p>';
    a.querySelector('[data-clear]').addEventListener('click', function () { Cart.clear(); });
    pricing();
  }

  /* Names and prices come from the catalog and the service's quote, never from the browser's own sums. */
  function pricing() {
    var seq = ++quoteSeq, body = drawer && drawer.body; if (!body) return;
    var sum = body.querySelector('.cart-sum'); if (!sum) return;
    catalog().then(function (c) {
      if (seq !== quoteSeq || !drawer) return;
      body.querySelectorAll('.cart-line').forEach(function (li) {
        var l = Cart.lines().filter(function (x) { return x.id === li.dataset.id; })[0], it = l && Shop.findItem(c, l.item);
        if (it) li.querySelector('.cart-line-name').textContent = it.name;
      });
    }).catch(function () {});
    sum.innerHTML = '<span class="shop-muted">Checking prices…</span>';
    Cart.quote({ coupon: 'best' }).then(function (q) {
      if (seq !== quoteSeq || !drawer) return;
      var lines = body.querySelectorAll('.cart-line'), qs = q.lines || [];
      lines.forEach(function (li, i) {
        var ql = qs[i]; if (!ql) return;
        li.querySelector('.cart-line-name').textContent = ql.name;
        li.querySelector('.cart-line-opts').textContent = [ql.summary, ql.note].filter(Boolean).join(' · ');
        li.querySelector('.cart-line-price').textContent = Shop.money(ql.total, q.currency);
      });
      var h = '<div class="cart-row"><span>Subtotal</span><span class="shop-price">' + Shop.money(q.subtotal, q.currency) + '</span></div>';
      if (q.discount) h += '<div class="cart-row cart-row--good"><span>' + Shop.esc(q.discount.name) + '</span><span class="shop-price">−' + Shop.money(q.discount.amount, q.currency) + '</span></div>';
      h += '<div class="cart-row cart-total"><span>Total</span><span class="shop-price">' + Shop.money(q.total, q.currency) + '</span></div>';
      sum.innerHTML = h;
    }).catch(function (e) { if (seq === quoteSeq) sum.innerHTML = '<span class="cart-err">' + Shop.esc(e.message) + '</span>'; });
  }

  function open() {
    if (onCheckout) return;
    if (drawer) return;
    drawer = Shop.sheet({ title: 'Your cart', side: 'right', content: '<div></div>', onClose: function () { drawer = null; } });
    drawer.el.classList.add('cart-drawer');
    render();
  }
  window.addEventListener('shop:cart', function () { render(); });
  window.addEventListener('shop:open-cart', open);

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cart-open], .cart-bar-link, .menu-cartbar, .shop-floatbar, .nav-cart'); if (!t || onCheckout) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); open();
  });

  /* Pages without their own cart bar get a small floating cart button. */
  document.addEventListener('DOMContentLoaded', function () {
    if (onCheckout || document.querySelector('.cart-bar, [data-cart-open]')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cart-fab'; b.setAttribute('data-cart-open', '');
    b.innerHTML = '<span aria-hidden="true">🛒</span><span class="shop-vh">Open cart, </span><span class="shop-cartcount" data-cart-count hidden>0</span>';
    document.body.appendChild(b);
    function sync() { b.hidden = !Cart.count(); var c = b.querySelector('[data-cart-count]'); c.textContent = Cart.count(); c.hidden = !Cart.count(); }
    window.addEventListener('shop:cart', sync); sync();
  });
})();
