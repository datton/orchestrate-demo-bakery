/* Order page: pickup number, QR code, live stages, cancel window, share, receipt. */
(function () {
  'use strict';
  var ROOT = new URL('../../', document.currentScript.src).href;
  var API = ROOT + 'api/shop/';
  var root = document.getElementById('ord-root');
  var token = new URLSearchParams(location.search).get('o');
  var order = null, timer = null, tick = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(c, cur) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'CAD' }).format((c || 0) / 100); } catch (e) { return (c / 100).toFixed(2); } }
  function clock(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function api(path, opt) {
    return fetch(API + path, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j; }); });
  }

  function remember(t) {
    if (window.Shop && Shop.rememberOrder) { try { Shop.rememberOrder(t); } catch (e) {} return; }
    try { var k = 'ssc.orders'; var a = JSON.parse(localStorage.getItem(k) || '[]'); if (a.indexOf(t) < 0) { a.unshift(t); localStorage.setItem(k, JSON.stringify(a.slice(0, 30))); } } catch (e) {}
  }

  function stageIndex(o) { var ids = ['paid', 'making', 'ready', 'collected']; var i = ids.indexOf(o.status); return i < 0 ? -1 : i; }

  function render() {
    var o = order, idx = stageIndex(o), cancelled = o.status === 'cancelled' || o.status === 'refunded';
    var h = '';
    if (o.status === 'pending') {
      h += '<div class="ord-banner">Waiting for your payment to go through. This page updates by itself.</div>';
    }
    if (cancelled) {
      h += '<div class="ord-banner ord-banner-bad">This order was cancelled.' + (o.payment && o.payment.state === 'paid' ? ' Your payment is being refunded.' : '') + '</div>';
    }
    h += '<section class="ord-hero' + (o.status === 'ready' ? ' is-ready' : '') + (cancelled ? ' is-off' : '') + '">';
    h += '<p class="ord-eyebrow">' + esc(o.store && o.store.name) + ' · Pickup number</p>';
    h += '<p class="ord-number" aria-label="Pickup number ' + esc(o.number) + '">' + esc(o.number) + '</p>';
    h += '<p class="ord-status" id="ord-status">' + esc(o.statusLabel || '') + '</p>';
    if (o.status === 'ready') h += '<p class="ord-sub">Your order is ready. Show the QR code or say your number at the counter.</p>';
    else if (!cancelled && o.status !== 'collected' && o.status !== 'pending') {
      var ahead = o.ahead ? o.ahead.orders : 0;
      h += '<p class="ord-sub">' + (ahead > 0 ? ahead + (ahead === 1 ? ' order' : ' orders') + ' ahead of you' : 'You are next up') + (o.readyBy ? ' · ready by about ' + esc(clock(o.readyBy)) : '') + '</p>';
    }
    if (o.status === 'collected') h += '<p class="ord-sub">Picked up. Enjoy, ' + esc(o.firstName || 'friend') + '!</p>';
    h += '</section>';

    h += '<ol class="ord-steps" aria-label="Order progress">';
    (o.steps || []).forEach(function (s, i) {
      var cls = cancelled ? '' : (i < idx ? 'done' : i === idx ? 'now' : '');
      h += '<li class="' + cls + '"' + (cls === 'now' ? ' aria-current="step"' : '') + '><span class="dot" aria-hidden="true"></span><span class="lbl">' + esc(s.label) + '</span><span class="at">' + esc(s.at ? clock(s.at) : '') + '</span></li>';
    });
    h += '</ol>';

    h += '<div class="ord-grid">';
    if (!cancelled) {
      h += '<section class="ord-card ord-qr"><h2>Show this at the counter</h2>';
      h += '<img src="' + esc(ROOT + o.qr) + '" width="240" height="240" alt="QR code for pickup number ' + esc(o.number) + '">';
      h += '<p class="ord-code-label">Pickup code</p><p class="ord-code" aria-label="Pickup code ' + esc(String(o.code).split('').join(' ')) + '">' + esc(o.code) + '</p>';
      h += '<p class="ord-hint">' + esc((o.store && o.store.pickup) || '') + '</p></section>';
    }
    h += '<section class="ord-card"><h2>Your order</h2><ul class="ord-lines">';
    (o.lines || []).forEach(function (l) {
      h += '<li><span class="q">' + esc(l.qty) + '×</span><span class="n">' + esc(l.name) + (l.summary ? '<small>' + esc(l.summary) + '</small>' : '') + (l.note ? '<small>“' + esc(l.note) + '”</small>' : '') + '</span><span class="p">' + money(l.total, o.currency) + '</span></li>';
    });
    h += '</ul><dl class="ord-sum"><div><dt>Subtotal</dt><dd>' + money(o.subtotal, o.currency) + '</dd></div>';
    if (o.discount) h += '<div><dt>' + esc(o.discount.name || o.discount.code) + '</dt><dd>−' + money(o.discount.amount, o.currency) + '</dd></div>';
    if (o.giftCard) h += '<div><dt>Gift card ' + esc(o.giftCard.last4 || '') + '</dt><dd>−' + money(o.giftCard.applied, o.currency) + '</dd></div>';
    h += '<div class="tot"><dt>Total paid</dt><dd>' + money(o.total, o.currency) + '</dd></div></dl>';
    if (o.points) h += '<p class="ord-hint">You earned ' + esc(o.points) + ' points.</p>';
    if (o.payment && o.payment.card) h += '<p class="ord-hint">' + esc(o.payment.card) + ' · test payment</p>';
    h += '</section></div>';

    h += '<div class="ord-actions">';
    if (o.cancellable) h += '<button class="shop-btn shop-btn--ghost" type="button" id="ord-cancel">Cancel order <span id="ord-cd"></span></button>';
    h += '<button class="shop-btn" type="button" id="ord-share">Share pickup link</button>';
    h += '<button class="shop-btn shop-btn--ghost" type="button" id="ord-receipt">Download receipt</button>';
    h += '<a class="shop-btn shop-btn--ghost" href="menu.html">Order something else</a></div>';
    h += '<p class="ord-msg" id="ord-msg" role="status"></p>';

    var focusId = document.activeElement && document.activeElement.id;
    root.innerHTML = h;
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
    bind();
    countdown();
  }

  function msg(t) { var m = document.getElementById('ord-msg'); if (m) m.textContent = t; }

  function bind() {
    var c = document.getElementById('ord-cancel');
    if (c) c.addEventListener('click', function () {
      c.disabled = true;
      api('orders/' + encodeURIComponent(token) + '/cancel', { method: 'POST' }).then(function (o) { order = o; render(); msg('Order cancelled.'); }).catch(function (e) { c.disabled = false; msg(e.message); });
    });
    document.getElementById('ord-share').addEventListener('click', function () {
      var url = location.origin + location.pathname + '?o=' + encodeURIComponent(token);
      var text = 'Pickup #' + order.number + ' at ' + (order.store && order.store.name) + '. Show this link at the counter:';
      if (navigator.share) { navigator.share({ title: 'Hearth & Crumb Bakery order', text: text, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { msg('Link copied. Anyone with it can collect this order.'); }, function () { msg(url); });
      else msg(url);
    });
    document.getElementById('ord-receipt').addEventListener('click', receipt);
  }

  function countdown() {
    clearInterval(tick);
    var el = document.getElementById('ord-cd');
    if (!el || !order.cancellableUntil) return;
    var end = new Date(order.cancellableUntil).getTime();
    function t() {
      var s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      var e2 = document.getElementById('ord-cd');
      if (e2) e2.textContent = '(' + s + 's left)';
      if (s <= 0) { clearInterval(tick); var b = document.getElementById('ord-cancel'); if (b) b.remove(); }
    }
    t(); tick = setInterval(t, 500);
  }

  function receipt() {
    var o = order, L = [];
    L.push('Hearth & Crumb Bakery', 'Demo shop: test payments only. No real money moves.', '');
    L.push('Pickup number: ' + o.number, 'Pickup code: ' + o.code, 'Store: ' + (o.store && o.store.name), 'Placed: ' + new Date(o.placedAt).toLocaleString(), '');
    (o.lines || []).forEach(function (l) { L.push(l.qty + ' x ' + l.name + (l.summary ? ' (' + l.summary + ')' : '') + '  ' + money(l.total, o.currency)); });
    L.push('', 'Subtotal: ' + money(o.subtotal, o.currency));
    if (o.discount) L.push((o.discount.name || o.discount.code) + ': -' + money(o.discount.amount, o.currency));
    if (o.giftCard) L.push('Gift card ' + o.giftCard.last4 + ': -' + money(o.giftCard.applied, o.currency));
    L.push('Total: ' + money(o.total, o.currency), '', 'Thank you, ' + (o.firstName || ''));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain' }));
    a.download = 'receipt-' + o.number + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    msg('Receipt downloaded.');
  }

  function load() {
    api('orders/' + encodeURIComponent(token)).then(function (o) {
      var prev = order; order = o; remember(token);
      var sig = JSON.stringify([o.status, o.ahead, o.cancellable, o.steps, o.readyBy]);
      if (!prev || prev._sig !== sig) { o._sig = sig; render(); } else { o._sig = sig; }
      if (o.status === 'collected' || o.status === 'cancelled' || o.status === 'refunded') return;
      timer = setTimeout(load, 3000);
    }).catch(function (e) {
      if (!order) root.innerHTML = '<div class="ord-banner ord-banner-bad">' + esc(e.message) + '</div><p><a class="shop-btn" href="menu.html">Back to the menu</a></p>';
      else timer = setTimeout(load, 6000);
    });
  }

  if (!token) {
    var last = null; try { last = (window.Shop && Shop.orderTokens ? Shop.orderTokens() : JSON.parse(localStorage.getItem('ssc.orders') || '[]'))[0]; } catch (e) {}
    if (last) { token = last; load(); }
    else root.innerHTML = '<div class="ord-empty"><h1>No order here yet</h1><p>Place an order and your pickup number shows up on this page.</p><a class="shop-btn" href="menu.html">See the menu</a></div>';
  } else load();
})();
