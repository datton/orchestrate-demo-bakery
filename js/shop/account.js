/* =====================================================================================================================
   account.js: "Me" (pages/account.html). Owner: Senior Developer 4.

   No accounts or passwords: everything is kept on this device (js/shop/core.js) and looked up live.
     - your name (used at checkout)
     - points and a member tier progress bar, worked out from this device's paid orders (each order carries the points
       the service gave it); tiers and the reward come from catalog "loyalty"
     - your usual, with one-tap Add
     - order history (POST orders/lookup) with In progress / Done filters, Track and Reorder
     - the wallet: saved gift cards with live balances, Remove, Top up (buys a gift card for yourself), add a code
     - the shop's coupons and whether they still apply (WELCOME is for a first order)
     - "Forget this device"
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  var root = document.querySelector('[data-account-root]');
  if (!Shop || !root) return;
  var esc = Shop.esc, icon = Shop.icon;
  var orders = [], filter = 'progress';
  var ACTIVE = ['pending', 'paid', 'making', 'ready'], PAID = ['paid', 'making', 'ready', 'collected'];

  Shop.ready.then(function () {
    var tokens = Shop.orders.tokens();
    return (tokens.length ? Shop.api.post('orders/lookup', { tokens: tokens }) : Promise.resolve({ orders: [] })).then(function (res) {
      orders = res.orders;
      if (orders.some(function (o) { return PAID.indexOf(o.status) > -1; })) Shop.flag('ordered', true);
      if (!orders.some(function (o) { return ACTIVE.indexOf(o.status) > -1; })) filter = 'done';
      render();
    });
  }).catch(function (err) { Shop.fail(root, err); });

  function render() {
    root.removeAttribute('aria-busy');
    var p = Shop.profile.get();
    root.innerHTML =
      '<div class="account-grid">' +
        '<section class="card account-hello" aria-labelledby="hello-title">' +
          '<h2 id="hello-title">' + (p.name ? 'Hi, ' + esc(p.name.split(' ')[0]) + '.' : 'Hi there.') + '</h2>' +
          '<form class="row" data-name-form><div class="field account-name"><label for="acc-name">Name for your orders</label>' +
          '<input id="acc-name" name="name" autocomplete="name" maxlength="40" value="' + esc(p.name || '') + '"></div>' +
          '<button class="btn" type="submit">Save</button></form>' +
          '<p class="muted"><small>Kept on this device only. No account, no password.</small></p>' +
        '</section>' +
        pointsHtml() +
      '</div>' +
      usualHtml() +
      '<section class="app-section" aria-labelledby="orders-title">' +
        '<div class="row row--between"><h2 class="section-title" id="orders-title">Orders</h2>' +
        '<div class="chips" role="group" aria-label="Show orders">' +
          '<button type="button" class="chip" data-filter="progress" aria-pressed="' + (filter === 'progress') + '">In progress</button>' +
          '<button type="button" class="chip" data-filter="done" aria-pressed="' + (filter === 'done') + '">Done</button></div></div>' +
        '<div data-order-list>' + ordersHtml() + '</div>' +
      '</section>' +
      '<section class="app-section" aria-labelledby="wallet-title">' +
        '<div class="row row--between"><h2 class="section-title" id="wallet-title">Wallet</h2>' +
        '<a class="btn btn--sm btn--primary" href="gift-cards.html?self=1">' + icon('plus') + ' Top up</a></div>' +
        '<div data-wallet>' + walletHtml() + '</div>' +
        '<form class="wallet-add" data-wallet-form><div class="field"><label for="acc-code">Add a gift card by its code</label>' +
        '<input id="acc-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM-NPQR"></div>' +
        '<button class="btn" type="submit">Add</button><p class="field__error" data-wallet-error role="alert"></p></form>' +
      '</section>' +
      '<section class="app-section" aria-labelledby="coupons-title"><h2 class="section-title" id="coupons-title">Coupons</h2>' + couponsHtml() + '</section>' +
      '<section class="app-section account-forget"><h2 class="section-title">This device</h2>' +
        '<p class="muted">Your cart, orders, wallet and name live in this browser. Forgetting them cannot be undone; gift cards keep their balance and can be added again by code.</p>' +
        '<button type="button" class="btn btn--danger" data-forget>Forget this device</button></section>';
    loadBalances();
    root.onclick = onClick;
    root.querySelector('[data-name-form]').onsubmit = function (e) {
      e.preventDefault();
      var name = e.target.name.value.trim();
      Shop.profile.set({ name: name });
      root.querySelector('#hello-title').textContent = name ? 'Hi, ' + name.split(' ')[0] + '.' : 'Hi there.';
      Shop.toast(name ? 'Saved. Checkout will use ' + name + '.' : 'Name cleared');
    };
    root.querySelector('[data-wallet-form]').onsubmit = addCode;
  }

  /* ---- Points and tier ------------------------------------------------------------------------------------- */
  function pointsHtml() {
    var loyalty = Shop.catalog.loyalty || {};
    var points = orders.filter(function (o) { return PAID.indexOf(o.status) > -1; }).reduce(function (s, o) { return s + (o.points || 0); }, 0);
    var tiers = (loyalty.tiers || [{ name: 'Member', at: 0 }]).slice().sort(function (a, b) { return a.at - b.at; });
    var tier = tiers.filter(function (t) { return points >= t.at; }).pop() || tiers[0];
    var next = tiers.filter(function (t) { return t.at > points; })[0];
    var pct = next ? Math.round(100 * (points - tier.at) / (next.at - tier.at)) : 100;
    var every = loyalty.rewardAt || 100, toReward = every - (points % every);
    return '<section class="card card--dark points-card" aria-labelledby="points-title">' +
      '<p class="co-label">' + icon('star') + ' Member</p>' +
      '<h2 id="points-title" class="points-card__tier">' + esc(tier.name) + '</h2>' +
      '<p class="points-card__points"><strong class="tabular">' + points + '</strong> points</p>' +
      '<div class="meter" role="progressbar" aria-label="' + (next ? 'Progress to ' + esc(next.name) : 'Top tier') + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<span class="meter__fill" style="--pct: ' + pct + '"></span></div>' +
      '<p class="muted">' + (next ? (next.at - points) + ' points to ' + esc(next.name) : 'You are at our top tier. Thank you.') + '</p>' +
      (loyalty.reward ? '<p class="points-card__reward">' + icon('cup') + ' <span>' + toReward + ' points to ' + esc(loyalty.reward) + '. ' +
        'Every ' + every + ' points earns one: show this screen at the counter.</span></p>' : '') +
      '<p class="muted"><small>' + (loyalty.pointsPerDollar || 1) + ' point for every dollar paid, counted from the orders on this device.</small></p>' +
    '</section>';
  }

  function usualHtml() {
    var u = Shop.usual.get();
    if (!u) return '';
    var it = Shop.item(u.item);
    return '<section class="app-section usual-row" aria-labelledby="usual-title"><h2 class="section-title" id="usual-title">Your usual</h2>' +
      '<div class="card card__row"><span><strong>' + esc(it.name) + '</strong><br><span class="muted">' + esc(Shop.describe(u)) + '</span></span>' +
      '<span class="row"><button type="button" class="btn btn--sm btn--primary" data-usual-add' + (it.soldOut ? ' disabled' : '') + '>' +
        (it.soldOut ? 'Sold out today' : 'Add · ' + Shop.money(Shop.estimate(u).total)) + '</button>' +
      '<button type="button" class="btn btn--sm btn--ghost" data-usual-clear>Forget</button></span></div></section>';
  }

  /* ---- Orders --------------------------------------------------------------------------------------------- */
  function ordersHtml() {
    var list = orders.filter(function (o) { return filter === 'progress' ? ACTIVE.indexOf(o.status) > -1 : ACTIVE.indexOf(o.status) < 0; });
    if (!list.length) {
      return '<div class="empty card">' + icon('receipt') + '<p>' + (filter === 'progress' ? 'Nothing in progress right now.' : 'No past orders on this device yet.') + '</p>' +
        '<a class="btn btn--primary" href="menu.html">Start an order</a></div>';
    }
    return '<ul class="history" role="list">' + list.map(function (o) {
      var items = o.lines.map(function (l) { return (l.qty > 1 ? l.qty + '× ' : '') + l.name; }).join(', ');
      return '<li class="history__item">' +
        '<div class="history__main"><p class="history__top"><span class="history__num">No. ' + o.number + '</span>' +
          '<span class="status-dot ' + (o.status === 'ready' ? 'is-open' : o.status === 'cancelled' ? 'is-closed' : ACTIVE.indexOf(o.status) > -1 ? 'is-soon' : '') + '">' + esc(o.statusLabel) + '</span></p>' +
          '<p class="history__items">' + esc(items) + '</p>' +
          '<p class="muted"><small>' + esc(o.store.name) + ' · ' + esc(Shop.dateTime(o.placedAt)) + ' · ' + Shop.money(o.total) + (o.points ? ' · +' + o.points + ' points' : '') + '</small></p></div>' +
        '<div class="history__actions"><a class="btn btn--sm" href="order.html?o=' + encodeURIComponent(o.token) + '">' + (ACTIVE.indexOf(o.status) > -1 ? 'Track' : 'Details') +
          '<span class="visually-hidden"> order ' + o.number + '</span></a>' +
        '<button type="button" class="btn btn--sm btn--primary" data-reorder="' + esc(o.token) + '">Reorder<span class="visually-hidden"> order ' + o.number + '</span></button></div>' +
      '</li>';
    }).join('') + '</ul>';
  }
  function reorder(o) {
    var added = 0, skipped = [];
    o.lines.forEach(function (l) {
      var it = Shop.item(l.item);
      if (!it || it.soldOut) { skipped.push(l.name); return; }
      Shop.cart.add(Shop.lineFromOrder(l));
      added++;
    });
    if (added) Shop.openCart();
    Shop.toast(skipped.length ? skipped.join(', ') + ' not available today' : 'Added to your cart', { tone: skipped.length && !added ? 'danger' : '' });
  }

  /* ---- Wallet --------------------------------------------------------------------------------------------- */
  function walletHtml() {
    var cards = Shop.wallet.list();
    if (!cards.length) return '<p class="muted wallet-empty">No gift cards saved yet. Got one? Add its code below, or top up to give yourself one.</p>';
    return '<ul class="wallet" role="list">' + cards.map(function (g) {
      return '<li class="wallet-card" data-code="' + esc(g.code) + '">' +
        '<span class="wallet-card__art" data-art aria-hidden="true">' + icon('gift') + '</span>' +
        '<span class="wallet-card__main"><strong>•••• ' + esc(g.code.slice(-4)) + '</strong>' + (g.label ? ' <span class="muted">' + esc(g.label) + '</span>' : '') +
          '<span class="wallet-card__bal" data-bal>Checking balance…</span></span>' +
        '<button type="button" class="icon-btn" data-wallet-remove="' + esc(g.code) + '" aria-label="Remove gift card ending ' + esc(g.code.slice(-4)) + '">' + icon('trash') + '</button>' +
      '</li>';
    }).join('') + '</ul>';
  }
  function loadBalances() {
    Array.prototype.forEach.call(root.querySelectorAll('.wallet-card'), function (el) {
      var code = el.getAttribute('data-code');
      Shop.api.get('giftcards/' + encodeURIComponent(code)).then(function (gc) {
        el.querySelector('[data-bal]').innerHTML = '<span class="tabular">' + Shop.money(gc.balance) + '</span> left of ' + Shop.money(gc.amount);
        var safe = String(gc.design || 'default').replace(/[^a-z0-9_-]/g, '');
        el.querySelector('[data-art]').setAttribute('style', '--card-bg: var(--gift-' + safe + '-bg, var(--gift-default-bg)); --card-ink: var(--gift-' + safe + '-ink, var(--gift-default-ink));');
        el.classList.toggle('is-empty', gc.balance <= 0);
      }, function () { el.querySelector('[data-bal]').textContent = 'Balance unavailable just now'; });
    });
  }
  function addCode(e) {
    e.preventDefault();
    var input = e.target.code, err = root.querySelector('[data-wallet-error]');
    var code = Shop.wallet.normalize(input.value);
    err.textContent = '';
    if (code.replace(/-/g, '').length < 8) { err.textContent = 'Enter the code from the card, like ABCD-EFGH-JKLM-NPQR.'; input.focus(); return; }
    Shop.api.get('giftcards/' + encodeURIComponent(code)).then(function (gc) {
      Shop.wallet.add(gc.code, { label: gc.to ? 'for ' + gc.to : '' });
      input.value = '';
      root.querySelector('[data-wallet]').innerHTML = walletHtml();
      loadBalances();
      Shop.toast('Gift card added: ' + Shop.money(gc.balance) + ' to spend');
    }, function (e2) { err.textContent = e2.message; input.setAttribute('aria-invalid', 'true'); input.focus(); });
  }

  /* ---- Coupons -------------------------------------------------------------------------------------------- */
  function couponsHtml() {
    var ordered = !!Shop.flag('ordered');
    var list = Shop.catalog.coupons || [];
    if (!list.length) return '<p class="muted">No codes running right now.</p>';
    return '<ul class="coupons" role="list">' + list.map(function (k) {
      var used = k.firstOrderOnly && ordered;
      var rules = [];
      if (k.minSubtotal) rules.push('on orders of ' + Shop.money(k.minSubtotal) + ' or more');
      if (k.firstOrderOnly) rules.push('first order only');
      if (k.maxDiscount && k.type === 'percent') rules.push('up to ' + Shop.money(k.maxDiscount) + ' off');
      return '<li class="coupon' + (used ? ' is-used' : '') + '">' + icon('ticket') +
        '<span class="coupon__main"><strong class="coupon__code">' + esc(k.code) + '</strong><span>' + esc(k.name) + '</span>' +
        (rules.length ? '<small class="muted">' + esc(rules.join(' · ')) + '</small>' : '') + '</span>' +
        '<span class="badge ' + (used ? 'badge--muted' : 'badge--soft') + '">' + (used ? 'Used' : 'Applied at checkout') + '</span></li>';
    }).join('') + '</ul><p class="muted"><small>Checkout picks the best code for your order by itself; you can choose another there.</small></p>';
  }

  /* ---- Clicks --------------------------------------------------------------------------------------------- */
  function onClick(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-filter')) {
      filter = b.getAttribute('data-filter');
      Array.prototype.forEach.call(root.querySelectorAll('[data-filter]'), function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      root.querySelector('[data-order-list]').innerHTML = ordersHtml();
    } else if (b.hasAttribute('data-reorder')) {
      reorder(orders.filter(function (o) { return o.token === b.getAttribute('data-reorder'); })[0]);
    } else if (b.hasAttribute('data-wallet-remove')) {
      var code = b.getAttribute('data-wallet-remove');
      Shop.wallet.remove(code);
      root.querySelector('[data-wallet]').innerHTML = walletHtml();
      loadBalances();
      Shop.toast('Removed from this device', { action: { label: 'Undo', fn: function () { Shop.wallet.add(code); root.querySelector('[data-wallet]').innerHTML = walletHtml(); loadBalances(); } } });
      root.querySelector('#wallet-title').focus && root.querySelector('[data-wallet-form] input').focus();
    } else if (b.hasAttribute('data-usual-add')) {
      Shop.cart.add(Shop.usual.get());
      Shop.toast('Your usual is in the cart', { action: { label: 'View cart', fn: function () { Shop.openCart(); } } });
    } else if (b.hasAttribute('data-usual-clear')) {
      Shop.usual.clear();
      render();
    } else if (b.hasAttribute('data-forget')) {
      if (window.confirm('Forget your cart, orders, wallet and name on this device? This cannot be undone.')) {
        Shop.forget();
        location.reload();
      }
    }
  }
})();
