/* Me: name, order history with reorder, gift card wallet, top-up, coupons, points and tier. Needs js/shop/core.js. */
(function () {
  'use strict';
  var S = window.Shop; if (!S) return;
  var esc = S.esc, root = document.getElementById('acct-root'); if (!root) return;
  var TIERS = [['Regular', 0], ['Silver', 200], ['Gold', 600]];
  var DONE = { paid: 1, making: 1, ready: 1, collected: 1 };

  function dateText(iso) { try { return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ' · ' + S.time(iso); } catch (e) { return ''; } }

  function toCartLine(l, cat) {
    var opts = {};
    (l.options || []).forEach(function (o) {
      var def = (cat.options || {})[o.group];
      if (def && def.type === 'many') (opts[o.group] = opts[o.group] || []).push(o.choice); else opts[o.group] = o.choice;
    });
    return { item: l.item, qty: l.qty, options: opts, note: l.note || '' };
  }
  function reorder(o, cat) {
    var n = 0, skipped = 0;
    (o.lines || []).forEach(function (l) {
      var it = S.findItem(cat, l.item);
      if (!it || it.soldOut) { skipped++; return; }
      S.Cart.add(toCartLine(l, cat)); n += l.qty;
    });
    if (!n) return S.toast('Those items are not on the menu right now.', { error: true });
    S.toast(n + (n === 1 ? ' item' : ' items') + ' added' + (skipped ? ' (' + skipped + ' not available)' : ''));
    setTimeout(function () { location.href = S.url('pages/checkout.html'); }, 600);
  }

  function render(cat, orders, gifts) {
    var done = orders.filter(function (o) { return DONE[o.status]; });
    var points = done.reduce(function (n, o) { return n + (o.points || 0); }, 0);
    var spent = done.reduce(function (n, o) { return n + (o.total || 0); }, 0);
    var loy = cat.loyalty || {}, at = loy.rewardAt || 100, toward = points % at, rewards = Math.floor(points / at);
    var tier = TIERS.filter(function (t) { return points >= t[1]; }).pop(), next = TIERS[TIERS.indexOf(tier) + 1];
    var used = done.length > 0;
    var name = S.name();

    var h = '<section class="shop-card acct-hello"><div class="shop-field"><label for="acct-name">Your name</label>' +
      '<input id="acct-name" autocomplete="name" value="' + esc(name) + '" placeholder="Used for pickups and gifts"></div>' +
      '<p class="shop-muted">Kept in this browser only. No account to create.</p></section>';

    h += '<section class="acct-sec" aria-labelledby="pts-h"><h2 id="pts-h">Points and tier</h2><div class="shop-card acct-pts">' +
      '<div class="acct-tier"><span class="shop-badge">' + esc(tier[0]) + ' member</span><strong class="acct-pts-n">' + points + '</strong><span class="shop-muted">points</span></div>' +
      '<div class="acct-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + at + '" aria-valuenow="' + toward + '" aria-label="Progress to your next reward"><span style="width:' + Math.round(toward / at * 100) + '%"></span></div>' +
      '<p>' + (at - toward) + ' more points to ' + esc(loy.reward || 'a reward') + '.' + (rewards ? ' You have earned ' + rewards + ' so far; show a barista.' : '') + '</p>' +
      '<p class="shop-muted">' + (next ? (next[1] - points) + ' points to ' + next[0] + '. ' : 'Top tier reached. ') + 'You earn ' + (loy.pointsPerDollar || 1) + ' point per dollar on paid orders. Spent so far: ' + S.money(spent) + '.</p></div></section>';

    h += '<section class="acct-sec" aria-labelledby="wal-h"><h2 id="wal-h">Wallet</h2>';
    if (gifts.length) {
      var total = gifts.reduce(function (n, g) { return n + (g.balance || 0); }, 0);
      h += '<p class="shop-muted">Gift card balance in total: <strong>' + S.money(total) + '</strong></p><div class="acct-wallet">' + gifts.map(function (g) {
        return '<div class="acct-gift">' + window.ShopGifts.cardHTML({ design: g.design, line: '', to: g.to, from: g.from, amountText: S.money(g.balance) }) +
          '<p class="shop-muted">Ending ' + esc(g.last4 || '') + ' · of ' + S.money(g.amount) + '</p><a href="gift.html?c=' + encodeURIComponent(g.code) + '">Open card</a></div>';
      }).join('') + '</div>';
    } else h += '<p class="shop-muted">No gift cards yet. Open a gift link or add a code below and it shows up here.</p>';
    h += '<form id="add-code" class="gc-inline" novalidate><div class="shop-field"><label for="add-code-in">Add a gift card code</label><input id="add-code-in" autocomplete="off" autocapitalize="characters"></div><button class="shop-btn shop-btn--ghost" type="submit">Add</button></form>' +
      '<p><a class="shop-btn" href="gift-cards.html?self=1">Top up (buy a card for yourself)</a></p><p id="add-msg" class="gc-error" role="alert" hidden></p></section>';

    h += '<section class="acct-sec" aria-labelledby="cp-h"><h2 id="cp-h">Coupons</h2><ul class="acct-coupons">' + (cat.coupons || []).map(function (c) {
      var first = c.firstOrderOnly, gone = first && used;
      return '<li class="shop-card' + (gone ? ' is-used' : '') + '"><strong>' + esc(c.name) + '</strong><span class="shop-muted">' + (gone ? 'Used on your first order' : first ? 'Applied automatically on your first order' : 'Applied at checkout when it fits') + '</span><code>' + esc(c.code) + '</code></li>';
    }).join('') + '</ul></section>';

    h += '<section class="acct-sec" aria-labelledby="ord-h"><h2 id="ord-h">Order history</h2>';
    if (!orders.length) h += '<p class="shop-muted">No orders on this device yet.</p><p><a class="shop-btn" href="menu.html">Start an order</a></p>';
    else h += '<ul class="acct-orders">' + orders.map(function (o, i) {
      return '<li class="shop-card"><div class="acct-o-top"><strong>#' + esc(o.number) + ' · ' + esc((o.store || {}).name || '') + '</strong><span class="shop-badge">' + esc(o.statusLabel || o.status) + '</span></div>' +
        '<p class="shop-muted">' + esc(dateText(o.placedAt)) + ' · ' + S.money(o.total) + '</p>' +
        '<p>' + (o.lines || []).map(function (l) { return esc(l.qty + '× ' + l.name); }).join(', ') + '</p>' +
        '<div class="gc-actions"><button type="button" class="shop-btn" data-re="' + i + '">Reorder</button><a class="shop-btn shop-btn--ghost" href="order.html?o=' + encodeURIComponent(o.token) + '">View order</a></div></li>';
    }).join('') + '</ul>';
    h += '</section>';
    root.innerHTML = h;

    document.getElementById('acct-name').addEventListener('change', function () { S.name(this.value.trim()); S.toast('Saved'); });
    [].forEach.call(root.querySelectorAll('[data-re]'), function (b) { b.addEventListener('click', function () { reorder(orders[+b.dataset.re], cat); }); });
    document.getElementById('add-code').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('add-code-in').value.trim().toUpperCase(), m = document.getElementById('add-msg');
      if (!v) { m.hidden = false; m.textContent = 'Type the code from the card.'; return; }
      S.api('giftcards/' + encodeURIComponent(v)).then(function () { S.rememberGift(v); S.toast('Added to your wallet'); load(); })
        .catch(function (x) { m.hidden = false; m.textContent = x.message; });
    });
  }

  var cat = null, timer;
  function load() {
    var tokens = S.orderTokens(), codes = S.giftCodes();
    Promise.all([
      cat ? cat : S.menu().catch(function () { return {}; }),
      tokens.length ? S.api('orders/lookup', { tokens: tokens }).then(function (r) { return r.orders || []; }).catch(function () { return []; }) : [],
      Promise.all(codes.map(function (c) { return S.api('giftcards/' + encodeURIComponent(c)).catch(function () { return null; }); }))
    ]).then(function (r) {
      cat = r[0];
      var orders = r[1].sort(function (a, b) { return String(b.placedAt).localeCompare(String(a.placedAt)); });
      var gifts = r[2].filter(Boolean);
      var focus = document.activeElement && document.activeElement.id;
      if (!document.getElementById('acct-name') || !root.contains(document.activeElement) || document.activeElement.tagName === 'BODY') render(cat, orders, gifts);
    }).catch(function (e) { root.innerHTML = '<p class="gc-error" role="alert">' + esc(e.message) + '</p>'; });
  }
  load();
  clearInterval(timer); timer = setInterval(function () { if (!document.hidden) load(); }, 15000); // live balances and order status
})();
