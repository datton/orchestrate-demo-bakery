/* =====================================================================================================================
   checkout.js: the checkout page (pages/checkout.html). Owner: Senior Developer 2.

   1. The store, shown big (Change opens the shared store picker), and pickup as soon as possible or at a time slot
      from the store's hours (catalog "demoOrdersAnytime": true lets a demo shop take ASAP orders while closed).
   2. Name (remembered on this device), optional phone and note.
   3. Savings: the best coupon is applied automatically (quote with coupon "best"); a picker lists every coupon from
      the quote's "usable" list with what it takes off, or why it can't be used. Gift cards from the wallet (with
      live balances) or a typed code.
   4. The price breakdown is the service's quote: the front end never works out a price it charges.
   5. Place order: POST orders, remember the order on this device, then go to pay.url (Stripe test mode or the
      sandbox) or, when nothing is left to pay, straight to the order page.
   Coming back with ?cancelled=<token> (payment page cancelled): that unpaid order is cancelled (releasing any gift
   card hold) and the cart is still here.
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  var form = document.querySelector('[data-checkout]');
  if (!Shop || !form) return;
  var esc = Shop.esc, icon = Shop.icon;
  var $ = function (sel) { return form.querySelector(sel); };
  var state = { coupon: 'best', gift: null, balances: {}, quote: null, seq: 0, timer: null, placing: false };
  var live = document.querySelector('[data-live]');

  Shop.ready.then(start, function (err) { Shop.fail(form, err); });

  function start() {
    handleCancelled();
    if (!Shop.cart.count()) return empty();
    form.removeAttribute('aria-busy');
    var p = Shop.profile.get();
    if (p.name) $('[name="name"]').value = p.name;
    if (p.phone) $('[name="phone"]').value = p.phone;
    renderStore();
    renderWhen();
    payInfo();
    loadWallet().then(function () { quote(0); });

    $('[data-change-store]').addEventListener('click', function (e) { Shop.openStorePicker(e.currentTarget); });
    Shop.on('store', function () { renderStore(); renderWhen(); });
    Shop.on('cart', function () { if (!Shop.cart.count()) empty(); else { renderWhen(); quote(); } });
    form.addEventListener('change', onChange);
    form.addEventListener('click', onClick);
    form.addEventListener('submit', place);
    $('[name="name"]').addEventListener('input', function () { fieldError('name', ''); });
  }

  function empty() {
    form.outerHTML = '<div class="empty card">' + icon('bag') + '<h2>Your cart is empty</h2><p>Add something from the menu and come back here to pay.</p>' +
      '<a class="btn btn--primary" href="menu.html">Browse the menu</a></div>';
  }

  /* ---- Came back from a cancelled payment ---------------------------------------------------------------------- */
  function handleCancelled() {
    var token = Shop.qs('cancelled');
    if (!token) return;
    var box = document.querySelector('[data-cancelled]');
    box.hidden = false;
    box.innerHTML = '<p><strong>Payment cancelled.</strong> Nothing was charged, and your cart is still here when you are ready.</p>';
    Shop.api.post('orders/' + encodeURIComponent(token) + '/cancel').catch(function () { /* already gone: fine */ });
    Shop.orders.remove(token);
    history.replaceState(null, '', location.pathname);
  }

  /* ---- Store and pickup time ----------------------------------------------------------------------------------- */
  // Whole cakes (cake-size six or eight) need a day's notice: no ASAP, and the earliest pickup slot is 24 h away.
  var NOTICE_MS = 24 * 3600000;
  function needsNotice() {
    return Shop.cart.lines().some(function (l) { var s = l.options && l.options['cake-size']; return s === 'six' || s === 'eight'; });
  }
  function currentStore() { return Shop.store(Shop.storeId()); }
  function renderStore() {
    var st = currentStore(), s = Shop.storeStatus(st);
    $('[data-store-box]').innerHTML = '<p class="co-store__name">' + esc(st.name) + '</p>' +
      '<p class="muted">' + esc(st.area || '') + (st.distanceKm != null ? ' · ' + esc(st.distanceKm) + ' km away' : '') + '</p>' +
      '<p><span class="status-dot ' + (s.open ? (s.soon ? 'is-soon' : 'is-open') : 'is-closed') + '">' + esc(s.short) + '</span> · ' + esc(s.label) +
      '<span class="muted"> · Today ' + esc(s.today) + '</span></p>' +
      (st.pickup ? '<p class="co-store__pickup">' + icon('pin') + esc(st.pickup) + '</p>' : '');
  }
  function renderWhen() {
    var st = currentStore(), s = Shop.storeStatus(st);
    var asap = $('input[name="when"][value="asap"]'), later = $('input[name="when"][value="later"]');
    var notice = needsNotice();
    var anytime = !!Shop.catalog.demoOrdersAnytime;
    var note = $('[data-asap-note]');
    asap.disabled = notice || (!s.open && !anytime);
    if (asap.disabled && asap.checked) later.checked = true;
    if (notice) note.textContent = "Whole cakes need a day's notice. The earliest pickup is 24 hours from now; smaller orders and slices can be ready sooner, so order them separately.";
    else if (s.open) note.textContent = 'Made as soon as you pay: usually ready in about ' + (st.prepMinutes || 5) + ' minutes, a little longer for big orders.';
    else if (anytime) note.textContent = st.name + ' is closed right now (' + s.label.toLowerCase() + '). As a demo shop it still makes ASAP orders, so you can try the whole flow at any hour.';
    else note.textContent = st.name + ' is closed right now (' + s.label.toLowerCase() + '). Choose a pickup time below.';
    var slots = notice ? Shop.slots(st, 400).filter(function (sl) { return Date.parse(sl.iso) >= Shop.now() + NOTICE_MS; }) : Shop.slots(st);
    var sel = $('[name="slot"]'), keep = sel.value, html = '', day = null;
    slots.forEach(function (sl) {
      if (sl.day !== day) { html += (day ? '</optgroup>' : '') + '<optgroup label="' + esc(sl.day) + '">'; day = sl.day; }
      html += '<option value="' + esc(sl.iso) + '">' + esc(sl.day + ', ' + sl.time) + '</option>';
    });
    sel.innerHTML = html ? html + '</optgroup>' : '<option value="">' + (notice ? 'No pickup times a day or more ahead in the next few days' : 'No pickup times in the next few days') + '</option>';
    if (keep && sel.querySelector('option[value="' + keep + '"]')) sel.value = keep;
    $('[data-slot-field]').hidden = !later.checked;
  }

  /* ---- Payment method label (Stripe test mode or the sandbox) ---------------------------------------------------- */
  function payInfo() {
    Shop.config().then(function (c) {
      var stripe = c.payments === 'stripe-test';
      $('[data-pay-info]').innerHTML = icon('info') + '<span><strong>' + (stripe ? 'Stripe, in test mode' : 'Sandbox test payment') + '.</strong> ' +
        (stripe ? "You'll pay on Stripe's checkout page in test mode." : "You'll pay on the shop's sandbox test page.") +
        ' Use the test card <span class="nowrap">' + esc((c.testCards || ['4242 4242 4242 4242'])[0]) + '</span>, any future expiry and any 3-digit code.</span>';
    }, function () {
      $('[data-pay-info]').innerHTML = icon('info') + '<span>Test payments only: use the card 4242 4242 4242 4242.</span>';
    });
  }

  /* ---- Wallet: gift cards saved on this device, with live balances ------------------------------------------- */
  function loadWallet() {
    var cards = Shop.wallet.list();
    return Promise.all(cards.map(function (g) {
      return Shop.api.get('giftcards/' + encodeURIComponent(g.code)).then(function (gc) { state.balances[g.code] = gc.balance; },
        function () { state.balances[g.code] = null; });
    })).then(function () {
      if (state.gift === null) {
        var first = cards.filter(function (g) { return state.balances[g.code] > 0; })[0];
        state.gift = first ? first.code : '';
      }
    });
  }

  /* ---- The quote: every number on this page comes from it ----------------------------------------------------- */
  function quote(delay) {
    clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      var seq = ++state.seq;
      var body = { items: Shop.cart.lines(), customer: Shop.customer() };
      if (state.coupon) body.coupon = state.coupon;
      if (state.gift) body.giftCard = state.gift;
      $('[data-submit]').disabled = true;
      Shop.api.post('quote', body).then(function (q) {
        if (seq !== state.seq) return;
        state.quote = q;
        renderQuote();
      }, function (err) {
        if (seq !== state.seq) return;
        if (state.gift && /gift card/i.test(err.message)) { giftError(err.message); state.gift = ''; return quote(0); }
        if (state.coupon && state.coupon !== 'best') { Shop.toast(err.message, { tone: 'danger' }); state.coupon = 'best'; return quote(0); }
        $('[data-totals]').innerHTML = '';
        $('[data-lines]').innerHTML = '<li class="notice notice--danger" role="alert">' + esc(err.message) + '</li>';
      });
    }, delay == null ? 300 : delay);
  }

  function renderQuote() {
    var q = state.quote;
    // The coupon and gift card boxes are redrawn: put keyboard focus back on the same control afterwards.
    var a = document.activeElement, keep = a && form.contains(a) && a.name ? { name: a.name, value: a.type === 'radio' ? a.value : null } : null;
    $('[data-lines]').innerHTML = q.lines.map(function (l) {
      return '<li class="co-line"><span class="co-line__qty">' + l.qty + '×</span><span class="co-line__main"><strong>' + esc(l.name) + '</strong>' +
        (l.summary ? '<span>' + esc(l.summary) + '</span>' : '') + (l.note ? '<span>“' + esc(l.note) + '”</span>' : '') + '</span>' +
        '<span class="co-line__price">' + Shop.money(l.total) + '</span></li>';
    }).join('');
    $('[data-totals]').innerHTML =
      '<div><dt>Subtotal</dt><dd>' + Shop.money(q.subtotal) + '</dd></div>' +
      (q.discount ? '<div class="is-discount"><dt>' + esc(q.discount.code) + ': ' + esc(q.discount.name) + '</dt><dd>−' + Shop.money(q.discount.amount) + '</dd></div>' : '') +
      (q.giftCard ? '<div class="is-discount"><dt>Gift card •••• ' + esc(q.giftCard.last4) + '</dt><dd>−' + Shop.money(q.giftCard.applied) + '</dd></div>' : '') +
      '<div class="is-total"><dt>To pay</dt><dd>' + Shop.money(q.total) + '</dd></div>';
    $('[data-points]').innerHTML = q.points ? icon('star') + ' You will earn <strong>' + q.points + ' points</strong> with this order.' : '';
    renderCoupons();
    renderGift();
    var btn = $('[data-submit]');
    btn.disabled = false;
    btn.innerHTML = q.total === 0 ? 'Place order <span class="btn__price">Nothing to pay</span>'
      : 'Pay with a test card <span class="btn__price">' + Shop.money(q.total) + '</span>';
    if (live) live.textContent = 'Total to pay ' + Shop.money(q.total) + (q.discount ? ', with ' + q.discount.code : '') + '.';
    if (keep) {
      var back = form.querySelector('[name="' + keep.name + '"]' + (keep.value != null ? '[value="' + keep.value + '"]' : ''));
      if (back && back !== document.activeElement) back.focus();
    }
  }

  /* ---- Coupons: the applied one, and a picker of every coupon with what it would take off --------------------- */
  function renderCoupons() {
    var q = state.quote, applied = q.discount && q.discount.code;
    var open = $('[data-coupon-box]').getAttribute('data-open') === 'true';
    var usable = (q.usable || []).slice().sort(function (a, b) { return b.amount - a.amount; });
    $('[data-coupon-box]').innerHTML =
      '<div class="co-saving">' + icon('ticket') + '<span class="co-saving__text">' +
        (applied ? '<strong>' + esc(applied) + '</strong> ' + esc(q.discount.name) + (state.coupon === 'best' ? ' <span class="badge badge--soft">Best for this order</span>' : '')
          : '<strong>No code applied</strong>' + (usable.some(function (u) { return u.amount > 0; }) ? '' : ' <span class="muted">None of our codes fit this order yet</span>')) +
      '</span><button type="button" class="link-btn" data-coupon-toggle aria-expanded="' + open + '" aria-controls="co-coupons">' + (open ? 'Done' : 'Change') + '</button></div>' +
      '<fieldset class="co-picker" id="co-coupons"' + (open ? '' : ' hidden') + '><legend class="visually-hidden">Choose a code</legend>' +
        usable.map(function (u) {
          return '<label class="co-option' + (u.amount ? '' : ' is-disabled') + '"><input type="radio" name="coupon" value="' + esc(u.code) + '"' +
            (applied === u.code ? ' checked' : '') + (u.amount ? '' : ' disabled') + '>' +
            '<span class="co-option__main"><strong>' + esc(u.code) + '</strong> ' + esc(u.name) + (u.why ? '<small>' + esc(u.why) + '</small>' : '') + '</span>' +
            '<span class="co-option__amount">' + (u.amount ? '−' + Shop.money(u.amount) : '') + '</span></label>';
        }).join('') +
        '<label class="co-option"><input type="radio" name="coupon" value=""' + (applied ? '' : ' checked') + '><span class="co-option__main">No code</span></label>' +
      '</fieldset>';
  }

  /* ---- Gift cards: from the wallet or typed ------------------------------------------------------------------ */
  function renderGift() {
    var q = state.quote, cards = Shop.wallet.list();
    var box = $('[data-gift-box]');
    var typed = box.querySelector('[name="giftcode"]');
    var typedVal = typed ? typed.value : '';
    box.innerHTML = '<fieldset class="co-gift"><legend class="co-gift__legend">' + icon('gift') + ' Gift card</legend>' +
      (cards.length ? cards.map(function (g) {
        var bal = state.balances[g.code];
        var usable = bal > 0;
        return '<label class="co-option' + (usable ? '' : ' is-disabled') + '"><input type="radio" name="gift" value="' + esc(g.code) + '"' +
          (state.gift === g.code ? ' checked' : '') + (usable ? '' : ' disabled') + '>' +
          '<span class="co-option__main"><strong>•••• ' + esc(g.code.slice(-4)) + '</strong>' + (g.label ? ' ' + esc(g.label) : '') +
          '<small>' + (bal == null ? 'Balance unavailable' : 'Balance ' + Shop.money(bal)) + '</small></span>' +
          '<span class="co-option__amount">' + (state.gift === g.code && q.giftCard ? '−' + Shop.money(q.giftCard.applied) : '') + '</span></label>';
      }).join('') + '<label class="co-option"><input type="radio" name="gift" value=""' + (state.gift ? '' : ' checked') + '><span class="co-option__main">Don\'t use a gift card</span></label>' : '') +
      '<div class="co-gift__add"><label for="co-giftcode">' + (cards.length ? 'Another gift card code' : 'Have a gift card? Enter its code') + '</label>' +
      '<div class="co-gift__row"><input id="co-giftcode" name="giftcode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM-NPQR" aria-describedby="co-gift-error">' +
      '<button type="button" class="btn" data-gift-apply>Apply</button></div><p class="field__error" id="co-gift-error" data-gift-error></p></div></fieldset>';
    box.querySelector('[name="giftcode"]').value = typedVal;
  }
  function giftError(msg) {
    var el = $('[data-gift-error]');
    if (el) el.textContent = msg;
  }
  function applyTyped(btn) {
    var input = $('[name="giftcode"]'), code = Shop.wallet.normalize(input.value);
    if (code.replace(/-/g, '').length < 8) { giftError('Enter the code from the gift card, like ABCD-EFGH-JKLM-NPQR.'); input.focus(); return; }
    btn.classList.add('is-busy');
    Shop.api.get('giftcards/' + encodeURIComponent(code)).then(function (gc) {
      Shop.wallet.add(gc.code, { label: gc.to ? 'for ' + gc.to : '' });
      state.balances[gc.code] = gc.balance;
      state.gift = gc.balance > 0 ? gc.code : state.gift;
      input.value = '';
      Shop.toast(gc.balance > 0 ? 'Gift card added: ' + Shop.money(gc.balance) + ' to spend' : 'That gift card has no balance left', { tone: gc.balance > 0 ? '' : 'danger' });
      quote(0);
    }, function (err) { giftError(err.message); input.setAttribute('aria-invalid', 'true'); input.focus(); })
      .then(function () { btn.classList.remove('is-busy'); });
  }

  /* ---- Events ---------------------------------------------------------------------------------------------------- */
  function onChange(e) {
    var t = e.target;
    if (t.name === 'when') { $('[data-slot-field]').hidden = t.value !== 'later'; if (t.value === 'later') $('[name="slot"]').focus(); }
    else if (t.name === 'coupon') { state.coupon = t.value; quote(0); }
    else if (t.name === 'gift') { state.gift = t.value; quote(0); }
  }
  function onClick(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-coupon-toggle')) {
      var box = $('[data-coupon-box]'), open = box.getAttribute('data-open') !== 'true';
      box.setAttribute('data-open', String(open));
      renderCoupons();
      var target = open ? $('#co-coupons input:checked') || $('#co-coupons input:not(:disabled)') : $('[data-coupon-toggle]');
      if (target) target.focus();
    } else if (b.hasAttribute('data-gift-apply')) {
      applyTyped(b);
    }
  }
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.name === 'giftcode') { e.preventDefault(); applyTyped($('[data-gift-apply]')); }
  });

  function fieldError(name, msg) {
    var input = $('[name="' + name + '"]'), err = document.getElementById('co-' + name + '-error');
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) { err.textContent = msg; err.hidden = !msg; }
  }

  /* ---- Place the order --------------------------------------------------------------------------------------- */
  function place(e) {
    e.preventDefault();
    if (state.placing || !state.quote) return;
    var name = $('[name="name"]').value.trim();
    if (!name) { fieldError('name', 'Add a name so we can call your order.'); $('[name="name"]').focus(); return; }
    var later = $('input[name="when"][value="later"]').checked;
    var slot = $('[name="slot"]').value;
    if (later && slot && needsNotice() && Date.parse(slot) < Shop.now() + NOTICE_MS) { Shop.toast("Whole cakes need a day's notice: choose a later pickup time.", { tone: 'danger' }); renderWhen(); return; }
    if (later && !slot) { Shop.toast('Choose a pickup time, or pick as soon as possible.', { tone: 'danger' }); return; }
    var q = state.quote, st = currentStore();
    var body = { items: Shop.cart.lines(), store: st.id, name: name, customer: Shop.customer() };
    var phone = $('[name="phone"]').value.trim(), note = $('[name="note"]').value.trim();
    if (phone) body.phone = phone;
    if (note) body.note = note;
    if (later) body.pickupAt = slot;
    if (q.discount) body.coupon = q.discount.code;            // exactly the code shown, not "best" again
    if (state.gift) body.giftCard = state.gift;
    Shop.profile.set({ name: name, phone: phone });
    var btn = $('[data-submit]'), err = $('[data-form-error]');
    state.placing = true;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    err.textContent = '';
    Shop.api.post('orders', body).then(function (res) {
      var o = res.order;
      Shop.orders.add(o.token, { number: o.number, store: o.store.name, live: true, payUrl: res.pay ? res.pay.url : null });
      if (res.pay) {
        Shop.cart.markPending(o.token);
        if (live) live.textContent = 'Order number ' + o.number + ' placed. Opening the test payment page.';
        location.href = res.pay.url;
      } else {
        Shop.cart.clear();
        location.href = 'order.html?o=' + encodeURIComponent(o.token);
      }
    }, function (e2) {
      state.placing = false;
      btn.classList.remove('is-busy');
      btn.removeAttribute('aria-busy');
      err.textContent = e2.message;
      quote(0);
    });
  }
})();
