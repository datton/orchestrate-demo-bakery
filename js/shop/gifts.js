/* =====================================================================================================================
   gifts.js: gift cards. Owner: Senior Developer 4. Used by two pages:

   pages/gift-cards.html   buy one: a design (giftCards.designs in the catalog), an amount (chips or your own), to,
                           from and a message, with a live preview; POST giftcards, then the test payment.
                           ?p=<token> after paying: the issued card with its code, a share link to
                           pages/gift.html?c=<code>, and "Add to my wallet" (a top-up for yourself goes in by itself).
                           ?cancelled=<token>: nothing was charged; the draft is restored. ?self=1: top up your wallet.
                           Also: check any card's balance.
   pages/gift.html?c=CODE  the recipient's view: the card, the message, the live balance, and "Use it now", which saves
                           it in this device's wallet and opens the menu (checkout offers wallet cards first).
   Card colours come from tokens.css: --gift-<design id>-bg / -ink, falling back to --gift-default-bg / -ink.
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  if (!Shop) return;
  var esc = Shop.esc, icon = Shop.icon;
  var buyForm = document.querySelector('[data-gift-form]');
  var viewRoot = document.querySelector('[data-gift-view]');

  /* ---- The card itself (shared by both pages) ------------------------------------------------------------------ */
  function designOf(id) {
    var list = (Shop.catalog.giftCards && Shop.catalog.giftCards.designs) || [];
    return list.filter(function (d) { return d.id === id; })[0] || list[0] || { id: 'default', name: 'Gift card' };
  }
  function cardStyle(id) {
    var safe = String(id || 'default').replace(/[^a-z0-9_-]/g, '');
    return '--card-bg: var(--gift-' + safe + '-bg, var(--gift-default-bg)); --card-ink: var(--gift-' + safe + '-ink, var(--gift-default-ink));';
  }
  function cardHtml(c) {
    var d = designOf(c.design);
    var brand = (Shop.catalog.brand && (Shop.catalog.brand.short || Shop.catalog.brand.name)) || '';
    return '<div class="gift-card" style="' + cardStyle(d.id) + '">' +
      '<div class="gift-card__top"><span class="gift-card__brand">' + esc(brand) + '</span><span class="gift-card__kind">' + icon('gift') + ' Gift card</span></div>' +
      '<p class="gift-card__line">' + esc(d.line || d.name) + '</p>' +
      '<p class="gift-card__amount">' + Shop.money(c.amount || 0) + '</p>' +
      '<p class="gift-card__to">' + (c.to ? 'For ' + esc(c.to) : 'For someone lovely') + (c.from ? ' · from ' + esc(c.from) : '') + '</p>' +
      (c.message ? '<p class="gift-card__msg">“' + esc(c.message) + '”</p>' : '') +
      (c.code ? '<p class="gift-card__code">' + esc(c.code) + '</p>' : '') +
    '</div>';
  }
  function giftLink(code) { return new URL(Shop.href('pages/gift.html') + '?c=' + encodeURIComponent(code), location.href).href; }
  function share(code, to) {
    var url = giftLink(code), text = 'A ' + ((Shop.catalog.brand || {}).name || '') + ' gift card for you' + (to ? ', ' + to : '') + '!';
    if (navigator.share) return navigator.share({ title: 'A gift card for you', text: text, url: url }).catch(function () {});
    if (navigator.clipboard) return navigator.clipboard.writeText(url).then(function () { Shop.toast('Gift link copied. Paste it in a message.'); },
      function () { prompt('Copy the gift link:', url); });
    prompt('Copy the gift link:', url);
  }
  function payInfo(el) {
    Shop.config().then(function (c) {
      el.innerHTML = icon('info') + '<span><strong>' + (c.payments === 'stripe-test' ? 'Stripe, in test mode.' : 'Sandbox test payment.') + '</strong> Use the test card ' +
        esc((c.testCards || ['4242 4242 4242 4242'])[0]) + ', any future expiry and any 3-digit code.</span>';
    }, function () { el.innerHTML = icon('info') + '<span>Test payments only: use the card 4242 4242 4242 4242.</span>'; });
  }

  /* ======================================================================================= buy a gift card ==== */
  if (buyForm) Shop.ready.then(startBuy, function (err) { Shop.fail(buyForm, err); });

  function startBuy() {
    var g = Shop.catalog.giftCards || {};
    var amounts = g.amounts || [1000, 2500, 5000, 10000];
    var min = g.min || 500, max = g.max || 50000;
    var designs = g.designs || [{ id: 'default', name: 'Gift card' }];
    var self = Shop.qs('self') === '1';
    var $ = function (s) { return buyForm.querySelector(s); };
    var me = Shop.profile.get().name || '';

    $('[data-designs]').innerHTML = designs.map(function (d, i) {
      return '<label class="design-option"><input type="radio" name="design" value="' + esc(d.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="design-option__swatch" style="' + cardStyle(d.id) + '" aria-hidden="true">' + icon('gift') + '</span>' +
        '<span class="design-option__name">' + esc(d.name) + '</span></label>';
    }).join('');
    $('[data-amounts]').innerHTML = amounts.map(function (a, i) {
      return '<label class="chip"><input type="radio" name="amount" value="' + a + '"' + (i === 1 || amounts.length === 1 ? ' checked' : '') + '><span>' + Shop.money(a) + '</span></label>';
    }).join('');
    $('[data-custom-hint]').textContent = 'From ' + Shop.money(min) + ' to ' + Shop.money(max) + '.';
    $('[name="from"]').value = me;
    if (self) {
      $('[name="to"]').value = me || 'Me';
      document.querySelector('[data-gift-title]').textContent = 'Top up your wallet';
      document.querySelector('[data-gift-lead]').textContent = 'Buy a gift card for yourself: after the test payment it goes straight into the wallet on this device, ready at checkout.';
    }
    var draft = Shop.local.get('giftDraft');
    if (Shop.qs('cancelled')) {
      var box = document.querySelector('[data-gift-cancelled]');
      box.hidden = false;
      box.innerHTML = '<p><strong>Payment cancelled.</strong> Nothing was charged. Your card is just as you left it.</p>';
      if (draft) restore(draft);
      history.replaceState(null, '', location.pathname);
    }
    payInfo($('[data-pay-info]'));
    buyForm.addEventListener('input', onInput);
    buyForm.addEventListener('change', onInput);
    buyForm.addEventListener('submit', buy);
    preview();

    function restore(d) {
      ['to', 'from', 'message'].forEach(function (k) { if (d[k] != null) $('[name="' + k + '"]').value = d[k]; });
      var r = $('input[name="design"][value="' + d.design + '"]');
      if (r) r.checked = true;
      var a = $('input[name="amount"][value="' + d.amount + '"]');
      if (a) a.checked = true; else { $('[name="custom"]').value = (d.amount / 100).toFixed(2); uncheck(); }
    }
    function uncheck() { Array.prototype.forEach.call(buyForm.querySelectorAll('input[name="amount"]'), function (r) { r.checked = false; }); }
    function amount() {
      var custom = $('[name="custom"]').value.trim();
      if (custom) return Math.round(parseFloat(custom.replace(/[^0-9.]/g, '')) * 100) || 0;
      var picked = $('input[name="amount"]:checked');
      return picked ? +picked.value : 0;
    }
    function onInput(e) {
      if (e && e.target.name === 'custom' && e.target.value) uncheck();
      if (e && e.target.name === 'amount') $('[name="custom"]').value = '';
      if (e && e.target.name) e.target.removeAttribute('aria-invalid');
      preview();
    }
    function preview() {
      var a = amount();
      var design = ($('input[name="design"]:checked') || {}).value;
      $('[data-preview]').innerHTML = cardHtml({ design: design, amount: a, to: $('[name="to"]').value.trim(), from: $('[name="from"]').value.trim(),
        message: $('[name="message"]').value.trim() });
      $('[data-msg-count]').textContent = $('[name="message"]').value.length + ' / 240';
      $('[data-buy]').innerHTML = (self ? 'Top up' : 'Buy gift card') + ' <span class="btn__price">' + Shop.money(a) + '</span>';
    }
    function buy(e) {
      e.preventDefault();
      var err = $('[data-gift-error]');
      err.textContent = '';
      var a = amount(), to = $('[name="to"]').value.trim(), from = $('[name="from"]').value.trim();
      var problem = null, field = null;
      if (!a || a < min || a > max) { problem = 'Choose an amount from ' + Shop.money(min) + ' to ' + Shop.money(max) + '.'; field = 'custom'; }
      else if (!to) { problem = 'Who is it for? Add their name.'; field = 'to'; }
      else if (!from) { problem = 'Add who it is from.'; field = 'from'; }
      if (problem) {
        err.textContent = problem;
        $('[name="' + field + '"]').setAttribute('aria-invalid', 'true');
        $('[name="' + field + '"]').focus();
        return;
      }
      var body = { amount: a, design: ($('input[name="design"]:checked') || {}).value, to: to, from: from, message: $('[name="message"]').value.trim() };
      if (!self) Shop.profile.set({ name: Shop.profile.get().name || from });
      Shop.local.set('giftDraft', body);
      var btn = $('[data-buy]');
      btn.classList.add('is-busy');
      Shop.api.post('giftcards', body).then(function (res) {
        var list = Shop.local.get('gifts', []);
        list.unshift({ token: res.purchase.token, self: self, at: new Date().toISOString() });
        Shop.local.set('gifts', list.slice(0, 20));
        location.href = res.pay.url;
      }, function (e2) {
        btn.classList.remove('is-busy');
        err.textContent = e2.message;
      });
    }

    // Check a balance
    var bal = document.querySelector('[data-balance-form]');
    if (bal) bal.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = bal.querySelector('input'), out = document.querySelector('[data-balance-result]');
      var code = Shop.wallet.normalize(input.value);
      if (code.replace(/-/g, '').length < 8) { out.innerHTML = '<p class="field__error">Enter the code from the card, like ABCD-EFGH-JKLM-NPQR.</p>'; input.focus(); return; }
      Shop.api.get('giftcards/' + encodeURIComponent(code)).then(function (gc) {
        out.innerHTML = '<div class="balance"><p class="balance__amount">' + Shop.money(gc.balance) + '</p>' +
          '<p class="muted">left of ' + Shop.money(gc.amount) + (gc.to ? ' · for ' + esc(gc.to) : '') + ' · •••• ' + esc(gc.last4) + '</p>' +
          (Shop.wallet.has(gc.code) ? '<p class="badge badge--soft">In your wallet</p>' : '<button type="button" class="btn btn--sm" data-wallet-add="' + esc(gc.code) + '" data-to="' + esc(gc.to || '') + '">' + icon('wallet') + ' Add to my wallet</button>') + '</div>';
      }, function (err) { out.innerHTML = '<p class="notice notice--danger">' + esc(err.message) + '</p>'; });
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wallet-add]');
      if (!b) return;
      Shop.wallet.add(b.getAttribute('data-wallet-add'), { label: b.getAttribute('data-to') ? 'for ' + b.getAttribute('data-to') : '' });
      b.outerHTML = '<p class="badge badge--soft">In your wallet</p>';
      Shop.toast('Saved in your wallet. Checkout offers it first.');
    });

    var p = Shop.qs('p');
    if (p) showIssued(p, 0);
  }

  /* After payment: the issued card (the service checks the payment on each read) */
  function showIssued(token, tries) {
    var out = document.querySelector('[data-gift-result]');
    if (!tries) out.innerHTML = '<div class="skeleton skeleton--tall"></div>';
    Shop.api.get('giftcards/purchase/' + encodeURIComponent(token)).then(function (pu) {
      if (!pu.code) {
        if (pu.state === 'unpaid' && tries < 5) return setTimeout(function () { showIssued(token, tries + 1); }, 1500);
        out.innerHTML = '<p class="notice notice--warning">' + (pu.state === 'expired' ? 'That payment page expired, so nothing was charged. You can buy the card again below.'
          : 'The payment has not gone through yet. If you closed the payment page, nothing was charged.') + '</p>';
        return;
      }
      var mine = Shop.local.get('gifts', []).filter(function (x) { return x.token === token; })[0] || {};
      if (mine.self && !Shop.wallet.has(pu.code)) Shop.wallet.add(pu.code, { label: 'top-up' });
      Shop.local.del('giftDraft');
      out.innerHTML = '<section class="issued" aria-labelledby="issued-title" tabindex="-1">' +
        '<div class="issued__text"><span class="kicker">Paid with a test card</span><h2 id="issued-title">' + (mine.self ? 'Your wallet is topped up.' : 'Your gift card is ready.') + '</h2>' +
        '<p>' + (mine.self ? 'It is in the wallet on this device, and checkout uses it first.' : 'Send ' + esc(pu.to) + ' the link: it shows the card, your message and the balance, and adds it to their wallet in one tap.') + '</p>' +
        '<div class="issued__actions">' +
          (mine.self ? '<a class="btn btn--primary" href="menu.html">Order now</a>' : '<button type="button" class="btn btn--primary" data-share-gift>' + icon('share') + ' Share the gift link</button>') +
          '<button type="button" class="btn" data-copy-code>' + icon('copy') + ' Copy code</button>' +
          (Shop.wallet.has(pu.code) ? '<span class="badge badge--soft">In your wallet</span>' : '<button type="button" class="btn" data-wallet-add="' + esc(pu.code) + '" data-to="' + esc(pu.to) + '">' + icon('wallet') + ' Add to my wallet</button>') +
        '</div><p class="muted"><small>Gift link: <a href="' + esc(Shop.href('pages/gift.html') + '?c=' + encodeURIComponent(pu.code)) + '">' + esc(giftLink(pu.code)) + '</a></small></p></div>' +
        cardHtml(pu.giftCard || pu) + '</section>';
      out.querySelector('.issued').focus();
      var sb = out.querySelector('[data-share-gift]');
      if (sb) sb.addEventListener('click', function () { share(pu.code, pu.to); });
      out.querySelector('[data-copy-code]').addEventListener('click', function () {
        (navigator.clipboard ? navigator.clipboard.writeText(pu.code) : Promise.reject()).then(function () { Shop.toast('Code copied'); },
          function () { prompt('Copy the code:', pu.code); });
      });
      history.replaceState(null, '', location.pathname + '?p=' + encodeURIComponent(token));
    }, function (err) { out.innerHTML = '<p class="notice notice--danger">' + esc(err.message) + '</p>'; });
  }

  /* ======================================================================================= the recipient ==== */
  if (viewRoot) Shop.ready.then(startView, function (err) { Shop.fail(viewRoot, err); });

  function startView() {
    var code = Shop.qs('c');
    if (!code) return askCode();
    Shop.api.get('giftcards/' + encodeURIComponent(code)).then(function (gc) {
      viewRoot.removeAttribute('aria-busy');
      var saved = Shop.wallet.has(gc.code);
      viewRoot.innerHTML = '<div class="gift-view">' +
        '<div class="gift-view__text">' +
          '<span class="kicker">' + (gc.from ? 'From ' + esc(gc.from) : 'A gift for you') + '</span>' +
          '<h1>' + (gc.to ? 'A gift for you, ' + esc(gc.to) + '.' : 'A gift for you.') + '</h1>' +
          (gc.message ? '<blockquote class="gift-view__msg">“' + esc(gc.message) + '”' + (gc.from ? '<footer>' + esc(gc.from) + '</footer>' : '') + '</blockquote>' : '') +
          '<p class="gift-view__balance"><span class="muted">Balance</span> <strong>' + Shop.money(gc.balance) + '</strong>' +
            (gc.balance < gc.amount ? ' <span class="muted">of ' + Shop.money(gc.amount) + '</span>' : '') + '</p>' +
          (gc.balance > 0
            ? '<div class="issued__actions"><button type="button" class="btn btn--primary btn--lg" data-use>' + icon('cup') + ' Use it now</button>' +
              (saved ? '<span class="badge badge--soft">In your wallet</span>' : '<button type="button" class="btn" data-save>' + icon('wallet') + ' Save for later</button>') + '</div>'
            : '<p class="notice">This card has been spent. We hope it tasted good.</p>') +
          '<ol class="gift-steps"><li><strong>Use it now</strong> saves the card on this phone.</li><li><strong>Order ahead</strong> from the menu.</li>' +
            '<li><strong>At checkout</strong> your gift card pays first.</li></ol>' +
          '<p class="muted"><small>On another device? Enter the code <strong class="nowrap">' + esc(gc.code) + '</strong> at checkout.</small></p>' +
        '</div>' + cardHtml({ design: gc.design, amount: gc.balance, to: gc.to, from: gc.from, code: gc.code }) + '</div>';
      viewRoot.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-use') || b.hasAttribute('data-save')) {
          Shop.wallet.add(gc.code, { label: gc.from ? 'from ' + gc.from : '' });
          if (b.hasAttribute('data-use')) { location.href = 'menu.html'; return; }
          b.outerHTML = '<span class="badge badge--soft">In your wallet</span>';
          Shop.toast('Saved in your wallet');
        }
      });
    }, function (err) {
      viewRoot.removeAttribute('aria-busy');
      viewRoot.innerHTML = '<div class="page-head"><h1>Gift card</h1></div><p class="notice notice--danger" role="alert">' + esc(err.message) + '</p>';
      askCode(true);
    });
  }
  function askCode(append) {
    viewRoot.removeAttribute('aria-busy');
    var html = '<section class="card gift-check"><h2>' + (append ? 'Try the code again' : 'Open a gift card') + '</h2>' +
      '<form class="gift-check__form" action="gift.html" method="get"><div class="field"><label for="gv-code">Gift card code</label>' +
      '<input id="gv-code" name="c" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM-NPQR" required></div>' +
      '<button class="btn btn--primary" type="submit">Open</button></form></section>';
    if (append) viewRoot.insertAdjacentHTML('beforeend', html); else viewRoot.innerHTML = '<div class="page-head"><h1>A gift card?</h1><p>Enter the code from the message you got.</p></div>' + html;
  }
})();
