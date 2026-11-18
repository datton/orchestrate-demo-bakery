/* Checkout page: store, pickup time, name, coupon, gift card, the service's price breakdown, then the order. */
(function () {
  'use strict';
  var Shop = window.Shop, root = document.getElementById('co-root'), banner = document.getElementById('co-banner');
  if (!Shop || !root) return;
  var Cart = Shop.Cart, esc = Shop.esc;
  var cat = null, quote = null, quoting = false, placing = false;
  var S = { store: null, when: 'asap', date: '', time: '', coupon: 'best', gift: '', giftErr: '', wallet: [] };

  /* ---------- time zone helpers (pickup times are in the store's own time) ---------- */
  function tz() { return (cat && cat.timezone) || undefined; }
  function parts(ts) {
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz(), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ts)).forEach(function (p) { o[p.type] = +p.value; });
    return o;
  }
  function offset(ts) { var p = parts(ts); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000; }
  function zoned(y, m, d, hh, mm) { var g = Date.UTC(y, m - 1, d, hh, mm); var t = g - offset(g); return g - offset(t); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dayHit(spec, d) {
    var s = String(spec).replace(/\s/g, ''); if (/^daily|every/i.test(s)) return true;
    var m = s.split(/[–—-]/), a = DN.indexOf(m[0].slice(0, 3)), b = m[1] ? DN.indexOf(m[1].slice(0, 3)) : a;
    if (a < 0 || b < 0) return false; return a <= b ? d >= a && d <= b : d >= a || d <= b;
  }
  function hm(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function storeObj() { return (cat.stores || []).filter(function (s) { return s.id === S.store; })[0]; }
  function dayOptions() { // next 7 days in store time
    var n = parts(Date.now()), out = [];
    for (var i = 0; i < 7; i++) {
      var u = new Date(Date.UTC(n.year, n.month - 1, n.day + i));
      out.push({ v: u.getUTCFullYear() + '-' + pad(u.getUTCMonth() + 1) + '-' + pad(u.getUTCDate()), dow: u.getUTCDay(),
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DN[u.getUTCDay()] + ' ' + u.getUTCDate() + '/' + (u.getUTCMonth() + 1) });
    }
    return out;
  }
  function slots(dateV) {
    var st = storeObj(); if (!st || !dateV) return [];
    var d = dayOptions().filter(function (x) { return x.v === dateV; })[0]; if (!d) return [];
    var h = (st.hours || []).filter(function (x) { return dayHit(x.days, d.dow); })[0]; if (!h) return [];
    var y = +dateV.slice(0, 4), m = +dateV.slice(5, 7), dd = +dateV.slice(8, 10), out = [];
    var earliest = Date.now() + ((st.prepMinutes || 5) + 10) * 60000, latest = Date.now() + 7 * 864e5 - 6e4;
    for (var t = hm(h.open); t <= hm(h.close) - 10; t += 15) {
      var ts = zoned(y, m, dd, Math.floor(t / 60), t % 60);
      if (ts >= earliest && ts <= latest) out.push({ v: pad(Math.floor(t / 60)) + ':' + pad(t % 60), ts: ts });
    }
    return out;
  }
  function pickupISO() {
    if (S.when !== 'later') return null;
    var s = slots(S.date).filter(function (x) { return x.v === S.time; })[0];
    return s ? new Date(s.ts).toISOString() : null;
  }

  /* ---------- page ---------- */
  function say(msg, kind) { banner.innerHTML = msg ? '<p class="co-msg co-msg--' + (kind || 'info') + '">' + msg + '</p>' : ''; }

  function build() {
    if (!Cart.count()) {
      root.className = '';
      root.innerHTML = '<div class="shop-card co-empty"><h2>Your cart is empty</h2><p class="shop-muted">Pick a drink or a pastry first, then come back to pay.</p><a class="shop-btn" href="' + Shop.url('pages/menu.html') + '">Browse the menu</a></div>';
      return;
    }
    root.className = 'co-grid';
    root.innerHTML =
      '<div class="co-form">' +
        '<section class="shop-card co-sec" aria-labelledby="co-h-store"><h2 id="co-h-store">Pickup bakery</h2><div id="co-store"></div></section>' +
        '<section class="shop-card co-sec" aria-labelledby="co-h-when"><h2 id="co-h-when">Pickup time</h2><div id="co-when"></div></section>' +
        '<section class="shop-card co-sec" aria-labelledby="co-h-you"><h2 id="co-h-you">Your details</h2><div id="co-you"></div></section>' +
        '<section class="shop-card co-sec" aria-labelledby="co-h-cp"><h2 id="co-h-cp">Coupon</h2><div id="co-coupon"></div></section>' +
        '<section class="shop-card co-sec" aria-labelledby="co-h-gc"><h2 id="co-h-gc">Gift card</h2><div id="co-gift"></div></section>' +
      '</div>' +
      '<aside class="co-side"><section class="shop-card co-sec co-summary" aria-labelledby="co-h-sum"><h2 id="co-h-sum">Your order</h2><div id="co-lines"></div><div id="co-sum" aria-live="polite"></div>' +
        '<div id="co-err" class="co-msg co-msg--err" role="alert" hidden></div>' +
        '<button type="button" class="shop-btn shop-btn--block" id="co-pay">Place order</button>' +
        '<p class="shop-demo-label">Demo shop: test payments only. No real money moves.</p></section></aside>';
    drawStore(); drawWhen(); drawYou(); drawGift(); price();
    root.querySelector('#co-pay').addEventListener('click', place);
  }

  function drawStore() {
    var el = document.getElementById('co-store'), st = storeObj(), st2 = (cat.stores || []);
    var o = st ? Shop.openNow(st, cat) : null;
    el.innerHTML = st ? '<div class="co-store-big"><div><strong class="co-store-name">' + esc(st.name) + '</strong><span class="shop-muted">' + esc(st.area || '') + (st.distanceKm != null ? ' · ' + st.distanceKm + ' km' : '') + '</span>' +
      '<span class="co-open ' + (o.open ? 'is-open' : 'is-closed') + '">' + esc(o.label) + '</span></div><button type="button" class="shop-btn shop-btn--ghost" id="co-change" aria-expanded="false">Change bakery</button></div><div id="co-choices" class="co-choices" hidden></div>' : '<p>Choose a bakery.</p>';
    var ch = el.querySelector('#co-choices');
    if (!st) { ch = document.createElement('div'); ch.className = 'co-choices'; el.appendChild(ch); }
    ch.innerHTML = st2.map(function (s) { var oo = Shop.openNow(s, cat);
      return '<button type="button" class="shop-chip' + (s.id === S.store ? ' is-on' : '') + '" data-store="' + esc(s.id) + '" aria-pressed="' + (s.id === S.store) + '">' + esc(s.name) + ' · ' + esc(oo.label) + '</button>'; }).join('');
    if (!st) ch.hidden = false;
    var btn = el.querySelector('#co-change');
    if (btn) btn.addEventListener('click', function () { ch.hidden = !ch.hidden; btn.setAttribute('aria-expanded', String(!ch.hidden)); });
    ch.addEventListener('click', function (e) {
      var b = e.target.closest('[data-store]'); if (!b) return;
      S.store = b.dataset.store; Shop.setStore(S.store); S.time = ''; drawStore(); drawWhen();
      var nb = document.getElementById('co-change'); if (nb) nb.focus();
    });
  }

  function drawWhen() {
    var el = document.getElementById('co-when'), days = dayOptions(), st = storeObj();
    if (!S.date) S.date = days[0].v;
    var sl = slots(S.date);
    if (S.when === 'later' && sl.length && !sl.some(function (x) { return x.v === S.time; })) S.time = sl[0].v;
    el.innerHTML = '<div class="shop-chips" role="radiogroup" aria-label="When">' +
      '<button type="button" class="shop-chip' + (S.when === 'asap' ? ' is-on' : '') + '" role="radio" aria-checked="' + (S.when === 'asap') + '" data-when="asap">As soon as possible</button>' +
      '<button type="button" class="shop-chip' + (S.when === 'later' ? ' is-on' : '') + '" role="radio" aria-checked="' + (S.when === 'later') + '" data-when="later">At a time</button></div>' +
      (S.when === 'asap' ? '<p class="shop-muted co-hint">Usually ready in about ' + (st ? st.prepMinutes : 5) + ' minutes' + (st && st.pickup ? '. ' + esc(st.pickup) : '') + '.</p>' :
        '<div class="co-time"><div class="shop-field"><label for="co-date">Day</label><select id="co-date">' + days.map(function (d) { return '<option value="' + d.v + '"' + (d.v === S.date ? ' selected' : '') + '>' + esc(d.label) + '</option>'; }).join('') + '</select></div>' +
        '<div class="shop-field"><label for="co-clock">Time</label>' + (sl.length ? '<select id="co-clock">' + sl.map(function (x) { return '<option value="' + x.v + '"' + (x.v === S.time ? ' selected' : '') + '>' + x.v + '</option>'; }).join('') + '</select>' : '<select id="co-clock" disabled><option>No times left this day</option></select>') + '</div></div><p class="shop-muted co-hint">Times in the store’s local time, up to a week ahead.</p>');
    el.querySelectorAll('[data-when]').forEach(function (b) { b.addEventListener('click', function () { S.when = b.dataset.when; drawWhen(); var f = el.querySelector('[data-when="' + S.when + '"]'); if (f) f.focus(); }); });
    var d = el.querySelector('#co-date'), c = el.querySelector('#co-clock');
    if (d) d.addEventListener('change', function () { S.date = d.value; S.time = ''; drawWhen(); document.getElementById('co-date').focus(); });
    if (c) c.addEventListener('change', function () { S.time = c.value; });
  }

  function drawYou() {
    document.getElementById('co-you').innerHTML =
      '<div class="shop-field"><label for="co-name">Name for the order</label><input id="co-name" name="name" autocomplete="name" maxlength="60" required value="' + esc(Shop.name()) + '" placeholder="So we can call it out"></div>' +
      '<div class="shop-field"><label for="co-phone">Phone <span class="shop-muted">(optional)</span></label><input id="co-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="30"></div>' +
      '<div class="shop-field"><label for="co-note">Note for the bakery <span class="shop-muted">(optional)</span></label><input id="co-note" name="note" maxlength="140" placeholder="Anything we should know?"></div>';
    document.getElementById('co-name').addEventListener('input', function (e) { Shop.name(e.target.value.trim()); });
  }

  function drawCoupons() {
    var el = document.getElementById('co-coupon'); if (!el) return;
    var u = (quote && quote.usable) || [], best = quote && quote.discount, f = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.cp : null;
    var rows = [['best', 'Best coupon automatically', best && S.coupon === 'best' ? 'Applied: ' + best.name + ' (−' + Shop.money(best.amount) + ')' : (u.some(function (c) { return c.amount > 0; }) ? '' : 'No coupon fits this cart yet')],
      ['none', 'No coupon', '']];
    u.forEach(function (c) { rows.push([c.code, c.name, c.amount > 0 ? 'Takes off ' + Shop.money(c.amount) : (c.why || 'Not available for this cart'), c.amount <= 0]); });
    el.innerHTML = '<div class="co-radios" role="radiogroup" aria-label="Coupon">' + rows.map(function (r) {
      return '<label class="co-radio' + (r[3] ? ' is-off' : '') + '"><input type="radio" name="coupon" value="' + esc(r[0]) + '" data-cp="' + esc(r[0]) + '"' + (S.coupon === r[0] ? ' checked' : '') + (r[3] ? ' disabled' : '') + '><span><strong>' + esc(r[1]) + '</strong>' + (r[2] ? '<small class="shop-muted">' + esc(r[2]) + '</small>' : '') + '</span></label>'; }).join('') + '</div>';
    el.querySelectorAll('input').forEach(function (i) { i.addEventListener('change', function () { S.coupon = i.value; price(); }); });
    if (f) { var n = el.querySelector('[data-cp="' + f + '"]'); if (n) n.focus(); }
  }

  function drawGift() {
    var el = document.getElementById('co-gift'); if (!el) return;
    var typed = (document.getElementById('co-gcode') || {}).value || '';
    el.innerHTML = (S.wallet.length ? '<div class="co-radios" role="radiogroup" aria-label="Gift cards in your wallet">' + S.wallet.map(function (g) {
      return '<label class="co-radio"><input type="radio" name="gift" value="' + esc(g.code) + '"' + (S.gift === g.code ? ' checked' : '') + '><span><strong>Gift card ••••' + esc(g.last4 || g.code.slice(-4)) + '</strong><small class="shop-muted">Balance ' + Shop.money(g.balance, g.currency) + '</small></span></label>'; }).join('') +
      '<label class="co-radio"><input type="radio" name="gift" value=""' + (!S.gift ? ' checked' : '') + '><span><strong>Don’t use a gift card</strong></span></label></div>' : '<p class="shop-muted">No gift cards in your wallet yet.</p>') +
      '<form class="co-gc" id="co-gcform"><div class="shop-field"><label for="co-gcode">Have a code? Type it here</label><input id="co-gcode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Gift card code" value="' + esc(typed) + '"></div><button class="shop-btn shop-btn--ghost" type="submit">Apply</button></form>' +
      '<p class="co-msg co-msg--err" id="co-gerr" role="alert"' + (S.giftErr ? '' : ' hidden') + '>' + esc(S.giftErr) + '</p>';
    el.querySelectorAll('input[name=gift]').forEach(function (i) { i.addEventListener('change', function () { S.gift = i.value; S.giftErr = ''; price(); }); });
    el.querySelector('#co-gcform').addEventListener('submit', function (e) {
      e.preventDefault(); var v = el.querySelector('#co-gcode').value.trim().toUpperCase(); if (!v) return;
      S.gift = v; S.giftErr = ''; price();
    });
  }

  function loadWallet() {
    var codes = Shop.giftCodes(); if (!codes.length) return Promise.resolve();
    return Promise.all(codes.map(function (c) { return Shop.api('giftcards/' + encodeURIComponent(c)).catch(function () { return null; }); })).then(function (r) {
      S.wallet = r.filter(function (g) { return g && g.balance > 0; });
    });
  }

  /* ---------- the service's quote ---------- */
  function price() {
    var seq = (price.n = (price.n || 0) + 1); quoting = true;
    var pay = document.getElementById('co-pay'); if (pay) pay.disabled = true;
    Cart.quote({ coupon: S.coupon === 'none' ? '' : S.coupon, giftCard: S.gift }).then(function (q) {
      if (seq !== price.n) return; quote = q; quoting = false; S.giftErr = '';
      if (q.discount && S.coupon === 'best') { /* stays "best" so the service re-picks if the cart changes */ }
      paint();
    }).catch(function (e) {
      if (seq !== price.n) return; quoting = false;
      if (S.gift) { S.giftErr = e.message; S.gift = ''; drawGift(); price(); return; }
      if (S.coupon !== 'best' && S.coupon !== 'none') { S.coupon = 'best'; price(); return; }
      var er = document.getElementById('co-err'); if (er) { er.textContent = e.message; er.hidden = false; }
    });
  }

  function paint() {
    var q = quote; if (!q || !document.getElementById('co-sum')) return;
    document.getElementById('co-lines').innerHTML = '<ul class="co-lines">' + (q.lines || []).map(function (l, i) {
      var cl = Cart.lines()[i];
      return '<li class="co-line" data-id="' + esc(cl ? cl.id : '') + '"><div><strong>' + l.qty + ' × ' + esc(l.name) + '</strong>' + (l.summary ? '<small class="shop-muted">' + esc(l.summary) + '</small>' : '') + (l.note ? '<small class="shop-muted">“' + esc(l.note) + '”</small>' : '') +
        '</div><span class="shop-price">' + Shop.money(l.total, q.currency) + '</span><div class="shop-stepper"><button type="button" data-d="-1" aria-label="One fewer ' + esc(l.name) + '">−</button><output>' + l.qty + '</output><button type="button" data-d="1" aria-label="One more ' + esc(l.name) + '">+</button></div></li>'; }).join('') + '</ul>';
    var h = '<dl class="co-break"><div><dt>Subtotal</dt><dd class="shop-price">' + Shop.money(q.subtotal, q.currency) + '</dd></div>';
    if (q.discount) h += '<div class="is-good"><dt>' + esc(q.discount.name) + '</dt><dd class="shop-price">−' + Shop.money(q.discount.amount, q.currency) + '</dd></div>';
    if (q.giftCard) h += '<div class="is-good"><dt>Gift card ••••' + esc(q.giftCard.last4) + '</dt><dd class="shop-price">−' + Shop.money(q.giftCard.applied, q.currency) + '</dd></div>';
    h += '<div class="co-total"><dt>To pay</dt><dd class="shop-price">' + Shop.money(q.total, q.currency) + '</dd></div></dl>';
    if (q.giftCard) h += '<p class="shop-muted co-hint">Gift card balance after this order: ' + Shop.money(q.giftCard.balanceAfter, q.currency) + '.</p>';
    if (q.points) h += '<p class="shop-muted co-hint">You’ll earn ' + q.points + ' points.</p>';
    document.getElementById('co-sum').innerHTML = h;
    var pay = document.getElementById('co-pay'); pay.disabled = placing; pay.textContent = placing ? 'Placing your order…' : (q.total > 0 ? 'Pay ' + Shop.money(q.total, q.currency) + ' with a test card' : 'Place order');
    var er = document.getElementById('co-err'); if (er) er.hidden = true;
    drawCoupons(); var ge = document.getElementById('co-gerr'); if (ge) { ge.hidden = !S.giftErr; ge.textContent = S.giftErr; }
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('.co-line [data-d]'); if (!b) return;
    var id = b.closest('.co-line').dataset.id, l = Cart.lines().filter(function (x) { return x.id === id; })[0]; if (!l) return;
    Cart.setQty(id, l.qty + (+b.dataset.d));
  });
  window.addEventListener('shop:cart', function () { if (placing) return; if (!Cart.count()) build(); else price(); });

  /* ---------- place the order ---------- */
  function fail(msg) { var er = document.getElementById('co-err'); er.textContent = msg; er.hidden = false; er.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function place() {
    var name = document.getElementById('co-name').value.trim();
    if (!name) { fail('Please add a name so we can call out your order.'); document.getElementById('co-name').focus(); return; }
    if (!S.store) { fail('Please choose a bakery.'); return; }
    var at = null;
    if (S.when === 'later') { at = pickupISO(); if (!at) { fail('Please choose a pickup time.'); return; } }
    if (quoting || !quote) { fail('One moment, checking prices.'); return; }
    placing = true; var pay = document.getElementById('co-pay'); pay.disabled = true; pay.textContent = 'Placing your order…';
    var body = { items: Cart.payload(), store: S.store, name: name, customer: Shop.customer() };
    var ph = document.getElementById('co-phone').value.trim(), nt = document.getElementById('co-note').value.trim();
    if (ph) body.phone = ph; if (nt) body.note = nt; if (at) body.pickupAt = at;
    if (S.coupon !== 'none') body.coupon = S.coupon; if (S.gift) body.giftCard = S.gift;
    Shop.name(name);
    Shop.api('orders', body).then(function (r) {
      var tok = r.order.token; Shop.rememberOrder(tok);
      if (r.pay && r.pay.url) { Shop.store.write('pendingOrder', tok); pay.textContent = 'Taking you to the test payment…'; location.href = r.pay.url; }
      else { Cart.clear(); Shop.store.write('pendingOrder', null); location.href = Shop.url('pages/order.html?o=' + encodeURIComponent(tok)); }
    }).catch(function (e) { placing = false; pay.disabled = false; paint(); fail(e.message); });
  }

  /* ---------- start ---------- */
  function cancelled() {
    var t = Shop.qs('cancelled'); if (!t) return;
    say('<strong>Payment cancelled.</strong> Your cart is still here, so you can try again.', 'info');
    Shop.api('orders/' + encodeURIComponent(t) + '/cancel', {}).catch(function () {});
    Shop.store.write('pendingOrder', null);
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  cancelled();
  Promise.all([Shop.menu(), loadWallet()]).then(function (r) {
    cat = r[0];
    var saved = Shop.storeId();
    S.store = (cat.stores || []).some(function (s) { return s.id === saved; }) ? saved : null;
    if (!S.store && cat.stores && cat.stores.length === 1) S.store = cat.stores[0].id;
    if (!S.store && cat.stores && cat.stores.length) { S.store = null; }
    build();
  }).catch(function (e) { root.innerHTML = '<p class="co-msg co-msg--err">' + esc(e.message) + '</p>'; });
})();
