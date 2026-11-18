/* =====================================================================================================================
   order.js: the order page (pages/order.html). Owner: Senior Developer 3.

   pages/order.html?o=<token>   one order, live: the big pickup number, the QR code (order.qr from the service) and
                                the 4-digit pickup code, the four steps (polled every 4 s), how many orders are ahead,
                                the estimated ready time, Cancel while the service says "cancellable" (a countdown for
                                the 20-second window after payment), share the pickup link so a friend can collect it,
                                and a receipt download (.txt). Coming back from payment (&session_id=...) empties the
                                cart that was paid for.
   pages/order.html             "Your orders": the orders this device placed, in progress first (the Orders tab).
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  var root = document.querySelector('[data-order-root]');
  if (!Shop || !root) return;
  var esc = Shop.esc, icon = Shop.icon;
  var live = document.querySelector('[data-order-live]');
  var token = Shop.qs('o');
  var order = null, pollTimer = null, tickTimer = null, listSig = '', actionsSig = '', liveSig = '';
  var POLL_MS = 4000, CANCEL_SECS = 20;
  var ACTIVE = ['pending', 'paid', 'making', 'ready'];

  Shop.ready.then(function () { return token ? track() : list(); }).catch(function (err) { Shop.fail(root, err); });

  /* ======================================================================================== one order, live ==== */
  function track() {
    return Shop.api.get('orders/' + encodeURIComponent(token)).then(function (o) {
      order = o;
      afterPayment();
      renderAll();
      schedule();
      document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
    });
  }

  function afterPayment() {
    if (!Shop.orders.get(token)) Shop.orders.add(token, { number: order.number, store: order.store.name });   // opened from a shared link
    var paid = order.status !== 'pending' && order.status !== 'cancelled';
    if (paid) {
      Shop.flag('ordered', true);
      if (Shop.cart.settle(token)) Shop.toast('Paid. Thanks, ' + order.firstName + '! Your order is in.');
    }
    Shop.orders.update(token, { number: order.number, live: ACTIVE.indexOf(order.status) > -1 });
    Shop.emit('orders');
    if (Shop.qs('session_id')) history.replaceState(null, '', location.pathname + '?o=' + encodeURIComponent(token));
  }

  function refresh() {
    return Shop.api.get('orders/' + encodeURIComponent(token)).then(function (o) {
      var before = order.status;
      order = o;
      if (before === 'pending' && o.status !== 'pending') { afterPayment(); renderAll(); }
      else renderLive();
      if (o.status !== before) announce();
    }, function () { /* a blip: try again on the next tick */ });
  }
  function schedule() {
    clearTimeout(pollTimer);
    if (ACTIVE.indexOf(order.status) < 0) return;
    pollTimer = setTimeout(function () {
      if (document.hidden) return schedule();
      refresh().then(schedule);
    }, POLL_MS);
  }
  function announce() {
    var msg = 'Order ' + order.number + ': ' + order.statusLabel + '.';
    if (order.status === 'ready') msg = 'Order ' + order.number + ' is ready for pickup at ' + order.store.name + '.';
    if (live) live.textContent = msg;
    document.title = (order.status === 'ready' ? 'Ready · ' : '') + 'No. ' + order.number + ' · ' + ((Shop.catalog.brand || {}).name || '');
    if (order.status === 'ready') {
      Shop.toast('Your order is ready. Come and get it!');
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    }
    Shop.orders.update(token, { live: ACTIVE.indexOf(order.status) > -1 });
    Shop.emit('orders');
  }

  function renderAll() {
    root.removeAttribute('aria-busy');
    var st = Shop.store(order.store.id) || {};
    root.innerHTML =
      '<section class="ticket" aria-labelledby="ticket-num">' +
        '<p class="ticket__store">' + icon('pin') + esc(order.store.name) + (st.pickup ? ' · ' + esc(st.pickup) : '') + '</p>' +
        '<p class="ticket__label">Pickup number</p>' +
        '<h1 class="ticket__num" id="ticket-num"><span class="visually-hidden">Pickup number </span>' + order.number + '</h1>' +
        '<p class="ticket__name">For ' + esc(order.firstName) + '</p>' +
        '<div data-live-head></div>' +
      '</section>' +
      '<ol class="steps" data-steps aria-label="Order progress"></ol>' +
      '<div class="order-grid">' +
        '<section class="card qr-card" aria-labelledby="qr-title">' +
          '<h2 class="co-label" id="qr-title">Show this at the counter</h2>' +
          '<div class="qr-card__img"><img src="' + esc(Shop.root + order.qr) + '" width="220" height="220" alt="QR code to collect order ' + order.number + '" data-qr></div>' +
          '<p class="pickup-code">Pickup code <strong class="tabular">' + esc(order.code) + '</strong></p>' +
          '<p class="muted"><small>No scanner handy? Give the pickup code at the shelf.</small></p>' +
        '</section>' +
        '<section class="card order-actions" aria-labelledby="act-title"><h2 class="co-label" id="act-title">Your order</h2><div data-actions></div></section>' +
        '<section class="card order-detail" aria-labelledby="det-title">' +
          '<h2 class="co-label" id="det-title">Receipt</h2>' + detailHtml() +
        '</section>' +
      '</div>';
    var img = root.querySelector('[data-qr]');
    img.addEventListener('error', function () {
      img.parentNode.innerHTML = '<p class="qr-card__fallback">' + icon('qr') + 'The QR code could not load. Use the pickup code below.</p>';
    });
    root.addEventListener('click', onClick);
    renderLive();
  }

  function renderLive() {
    var s = order.status;
    // Polls every few seconds: redraw only what changed, so buttons keep keyboard focus and nothing flickers.
    var sig = s + '|' + order.steps.map(function (x) { return x.at; }).join() + '|' + order.readyBy + '|' + JSON.stringify(order.ahead);
    if (sig === liveSig) return renderActions();
    liveSig = sig;
    var head = root.querySelector('[data-live-head]');
    var pill = '<p class="status-pill status-pill--' + esc(s) + '">' + esc(order.statusLabel) + '</p>';
    var eta = '';
    if (s === 'paid' || s === 'making') {
      eta = '<p class="ticket__eta">' + (order.pickupAt ? 'Scheduled for <strong>' + esc(Shop.dateTime(order.pickupAt)) + '</strong>'
        : 'Ready about <strong>' + esc(Shop.time(order.readyBy)) + '</strong>') +
        (order.ahead && order.ahead.orders ? ' · <span>' + order.ahead.orders + (order.ahead.orders === 1 ? ' order' : ' orders') + ' ahead of you</span>' : ' · <span>You are next</span>') + '</p>';
    } else if (s === 'ready') {
      eta = '<p class="ticket__eta">Waiting for you at the ' + esc((Shop.store(order.store.id) || {}).pickup || 'pickup counter').toLowerCase() + '.</p>';
    } else if (s === 'collected') {
      eta = '<p class="ticket__eta">Picked up. Enjoy it!</p>';
    } else if (s === 'pending') {
      eta = '<p class="ticket__eta">We start making it as soon as the payment goes through.</p>';
    } else if (s === 'cancelled') {
      eta = '<p class="ticket__eta">' + (order.payment.state === 'refunded' ? 'Cancelled and refunded to your test card.' : 'Cancelled. Nothing was charged.') + '</p>';
    }
    head.innerHTML = pill + eta;
    root.querySelector('.ticket').setAttribute('data-status', s);
    root.querySelector('.qr-card').hidden = s === 'collected' || s === 'cancelled';   // nothing left to collect

    var stepsEl = root.querySelector('[data-steps]');
    var reached = order.steps.filter(function (x) { return x.at; }).length;
    stepsEl.hidden = s === 'pending' || s === 'cancelled';
    stepsEl.innerHTML = order.steps.map(function (x, i) {
      var cls = x.at ? (i === reached - 1 && s !== 'collected' ? 'is-current' : 'is-done') : '';
      return '<li class="step ' + cls + '"' + (cls === 'is-current' ? ' aria-current="step"' : '') + '>' +
        '<span class="step__dot">' + (x.at ? icon('check') : '') + '</span>' +
        '<span class="step__label">' + esc(x.label) + '</span>' +
        '<span class="step__time">' + (x.at ? esc(Shop.time(x.at)) : '') + '</span></li>';
    }).join('');
    renderActions();
  }

  /* ---- Actions: finish paying, cancel (with countdown), share, receipt, order again ------------------------- */
  function renderActions() {
    var box = root.querySelector('[data-actions]');
    var s = order.status, saved = Shop.orders.get(token) || {};
    var sig = s + '|' + order.cancellable + '|' + !!saved.payUrl;
    if (sig === actionsSig) return;
    actionsSig = sig;
    var html = '';
    if (s === 'pending' && saved.payUrl) html += '<a class="btn btn--primary btn--block" href="' + esc(saved.payUrl) + '">Finish paying</a>';
    if (order.cancellable) html += '<button type="button" class="btn btn--danger btn--block" data-cancel>' + cancelLabel() + '</button>' +
      '<p class="muted" data-cancel-hint><small>' + (s === 'pending' ? 'Not paid yet: you can cancel at any time.' : 'Changed your mind? You can cancel in the first ' + CANCEL_SECS + ' seconds, before we start making it, and the payment is refunded.') + '</small></p>';
    else if (s === 'paid' || s === 'making') html += '<p class="muted"><small>It is in the barista\'s hands now, so it can\'t be cancelled here. Ask at the counter if something is wrong.</small></p>';
    if (ACTIVE.indexOf(s) > -1 && s !== 'pending') html += '<button type="button" class="btn btn--block" data-share>' + icon('share') + ' Share the pickup link</button>' +
      '<p class="muted"><small>Someone collecting for you? Send them the link: it has the QR code and pickup code.</small></p>';
    html += '<button type="button" class="btn btn--block" data-receipt>' + icon('download') + ' Download receipt (.txt)</button>';
    if (s === 'collected' || s === 'cancelled') html += '<button type="button" class="btn btn--primary btn--block" data-reorder>' + icon('refresh') + ' Order this again</button>';
    box.innerHTML = '<div class="order-actions__list">' + html + '</div>';
    startCountdown();
  }
  function secondsLeft() {
    var paidAt = order.steps[0] && order.steps[0].at;
    if (order.status !== 'paid' || !paidAt) return null;
    return Math.max(0, Math.ceil(CANCEL_SECS - (Shop.now() - Date.parse(paidAt)) / 1000));
  }
  function cancelLabel() {
    var left = secondsLeft();
    return 'Cancel order' + (left != null ? ' <span class="badge badge--muted tabular">' + left + ' s</span>' : '');
  }
  function startCountdown() {
    clearInterval(tickTimer);
    if (!order.cancellable || order.status !== 'paid') return;
    tickTimer = setInterval(function () {
      var btn = root.querySelector('[data-cancel]');
      var left = secondsLeft();
      if (!btn) return clearInterval(tickTimer);
      if (left <= 0) { clearInterval(tickTimer); order.cancellable = false; actionsSig = ''; renderActions(); return; }
      btn.innerHTML = cancelLabel();
    }, 1000);
  }

  function onClick(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-cancel')) cancel(b);
    else if (b.hasAttribute('data-share')) share();
    else if (b.hasAttribute('data-receipt')) receipt();
    else if (b.hasAttribute('data-reorder')) reorder(order);
  }
  function cancel(btn) {
    btn.classList.add('is-busy');
    Shop.api.post('orders/' + encodeURIComponent(token) + '/cancel').then(function (o) {
      order = o;
      clearInterval(tickTimer);
      renderLive();
      announce();
      Shop.toast(o.payment.state === 'refunded' ? 'Cancelled. The test payment was refunded.' : 'Order cancelled.');
      root.querySelector('[data-actions] button').focus();
    }, function (err) {
      btn.classList.remove('is-busy');
      Shop.toast(err.message, { tone: 'danger' });
      refresh();
    });
  }
  function pickupUrl() { return location.origin + location.pathname + '?o=' + encodeURIComponent(token); }
  function share() {
    var text = 'Could you pick up my ' + ((Shop.catalog.brand || {}).short || '') + ' order? Number ' + order.number + ' at ' + order.store.name +
      '. Show the QR code, or give the pickup code ' + order.code + '.';
    if (navigator.share) {
      navigator.share({ title: 'Pickup No. ' + order.number, text: text, url: pickupUrl() }).catch(function () { /* closed */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + pickupUrl()).then(function () { Shop.toast('Pickup link copied. Paste it in a message.'); },
        function () { prompt('Copy this pickup link:', pickupUrl()); });
    } else {
      prompt('Copy this pickup link:', pickupUrl());
    }
  }

  /* ---- Receipt as a .txt file ------------------------------------------------------------------------------ */
  function pad(left, right, width) { left = String(left); right = String(right); return left + ' '.repeat(Math.max(1, width - left.length - right.length)) + right; }
  function receipt() {
    var W = 44, brand = (Shop.catalog.brand || {}).name || 'Receipt';
    var out = [brand, order.store.name, '', 'Order No. ' + order.number + '   Pickup code ' + order.code,
      'Placed ' + Shop.dateTime(order.placedAt), 'Name: ' + order.name, ''];
    order.lines.forEach(function (l) {
      out.push(pad(l.qty + ' x ' + l.name, Shop.money(l.total), W));
      if (l.summary) out.push('    ' + l.summary);
      if (l.note) out.push('    "' + l.note + '"');
    });
    out.push('-'.repeat(W), pad('Subtotal', Shop.money(order.subtotal), W));
    if (order.discount) out.push(pad(order.discount.code, '-' + Shop.money(order.discount.amount), W));
    if (order.giftCard) out.push(pad('Gift card ****' + order.giftCard.last4, '-' + Shop.money(order.giftCard.applied), W));
    out.push(pad('Total', Shop.money(order.total), W), '');
    out.push('Payment: ' + (order.payment.card || order.payment.provider) + ' (' + order.payment.state + ', test payment)');
    out.push('Status: ' + order.statusLabel);
    if (order.points) out.push('Points earned: ' + order.points);
    out.push('', 'Demo shop: test payments only. No real money moves.', pickupUrl());
    var blob = new Blob([out.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'receipt-' + order.number + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    Shop.toast('Receipt saved as ' + a.download);
  }

  function detailHtml() {
    return '<ul class="co-lines">' + order.lines.map(function (l) {
      return '<li class="co-line"><span class="co-line__qty">' + l.qty + '×</span><span class="co-line__main"><strong>' + esc(l.name) + '</strong>' +
        (l.summary ? '<span>' + esc(l.summary) + '</span>' : '') + (l.note ? '<span>“' + esc(l.note) + '”</span>' : '') + '</span>' +
        '<span class="co-line__price">' + Shop.money(l.total) + '</span></li>';
    }).join('') + '</ul>' +
    '<dl class="totals">' +
      '<div><dt>Subtotal</dt><dd>' + Shop.money(order.subtotal) + '</dd></div>' +
      (order.discount ? '<div class="is-discount"><dt>' + esc(order.discount.code) + '</dt><dd>−' + Shop.money(order.discount.amount) + '</dd></div>' : '') +
      (order.giftCard ? '<div class="is-discount"><dt>Gift card •••• ' + esc(order.giftCard.last4) + '</dt><dd>−' + Shop.money(order.giftCard.applied) + '</dd></div>' : '') +
      '<div class="is-total"><dt>Total</dt><dd>' + Shop.money(order.total) + '</dd></div>' +
    '</dl>' +
    '<p class="muted"><small>' + esc(order.payment.card || 'No card needed') + ' · test payment · placed ' + esc(Shop.dateTime(order.placedAt)) +
      (order.note ? '<br>Note: ' + esc(order.note) : '') + '</small></p>';
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
    Shop.toast(skipped.length ? skipped.join(', ') + (skipped.length === 1 ? ' is' : ' are') + ' not available today' : 'Added to your cart', { tone: skipped.length && !added ? 'danger' : '' });
  }

  /* ==================================================================================== your orders (no ?o=) ==== */
  function list() {
    document.title = 'Your orders · ' + ((Shop.catalog.brand || {}).name || '');
    var tokens = Shop.orders.tokens();
    if (!tokens.length) {
      root.removeAttribute('aria-busy');
      root.innerHTML = '<div class="page-head"><h1>Your orders</h1></div><div class="empty card">' + icon('receipt') +
        '<p>No orders on this device yet. Order ahead and your pickup number shows up here.</p>' +
        '<a class="btn btn--primary" href="menu.html">Start an order</a></div>';
      return;
    }
    return Shop.api.post('orders/lookup', { tokens: tokens }).then(function (res) {
      root.removeAttribute('aria-busy');
      var all = res.orders;
      var sig = all.map(function (o) { return o.token + o.status; }).join();
      var again = all.some(function (o) { return ACTIVE.indexOf(o.status) > -1; });
      if (again) setTimeout(list, 8000);
      if (sig === listSig) return;           // nothing changed: leave the page (and keyboard focus) alone
      listSig = sig;
      all.forEach(function (o) { Shop.orders.update(o.token, { live: ACTIVE.indexOf(o.status) > -1 }); });
      Shop.emit('orders');
      var now = all.filter(function (o) { return ACTIVE.indexOf(o.status) > -1; });
      var past = all.filter(function (o) { return ACTIVE.indexOf(o.status) < 0; }).slice(0, 10);
      root.innerHTML = '<div class="page-head"><h1>Your orders</h1><p>Orders placed on this device. Your full history is on <a href="account.html">Me</a>.</p></div>' +
        (now.length ? '<h2 class="section-title">In progress</h2><ul class="order-list" role="list">' + now.map(orderRow).join('') + '</ul>'
          : '<div class="notice"><p>Nothing in progress right now.</p><a class="btn btn--primary" href="menu.html">Start an order</a></div>') +
        (past.length ? '<h2 class="section-title order-list__title">Recent</h2><ul class="order-list" role="list">' + past.map(orderRow).join('') + '</ul>' : '');
    });
  }
  function orderRow(o) {
    var items = o.lines.reduce(function (n, l) { return n + l.qty; }, 0);
    return '<li><a class="order-row" href="order.html?o=' + encodeURIComponent(o.token) + '">' +
      '<span class="order-row__num">' + o.number + '</span>' +
      '<span class="order-row__main"><span class="status-pill status-pill--' + esc(o.status) + '">' + esc(o.statusLabel) + '</span>' +
        '<strong>' + esc(o.store.name) + '</strong><span>' + items + (items === 1 ? ' item' : ' items') + ' · ' +
        Shop.money(o.total) + ' · ' + esc(Shop.dateTime(o.placedAt)) + '</span></span>' + icon('chevron') + '</a></li>';
  }
})();
