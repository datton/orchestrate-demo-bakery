/* Gift cards: buy (gift-cards.html), the recipient's page (gift.html), balance check. Needs js/shop/core.js (window.Shop). */
(function () {
  'use strict';
  var S = window.Shop, esc = null, BRAND = 'Gift card';
  function ready(fn) { if (window.Shop) fn(); else window.addEventListener('load', fn); }
  function $(s, r) { return (r || document).querySelector(s); }

  function cardHTML(c) {
    return '<div class="gc-card gc-d-' + esc(c.design || 'thanks') + '">' +
      '<div class="gc-card-top"><span class="gc-card-brand">' + esc(BRAND) + '</span><span class="gc-card-kind">Gift card</span></div>' +
      '<div class="gc-card-amt">' + esc(c.amountText) + '</div>' +
      '<div class="gc-card-line">' + esc(c.line || '') + '</div>' +
      '<div class="gc-card-who"><span>' + (c.to ? 'For ' + esc(c.to) : '') + '</span><span>' + (c.from ? 'From ' + esc(c.from) : '') + '</span></div></div>';
  }
  function shareLink(code) { return new URL(S.url('pages/gift.html?c=' + encodeURIComponent(code)), location.href).href; }
  function copy(text, ok) {
    function done() { S.toast(ok || 'Copied'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { S.toast('Copy it by hand: ' + text); });
    else S.toast('Copy it by hand: ' + text);
  }

  /* ---------- buy page ---------- */
  function buyPage(root, cat) {
    var gc = cat.giftCards || {}, designs = gc.designs || [], amounts = gc.amounts || [1000, 2500, 5000];
    var p = S.qs('p'), cancelled = S.qs('cancelled');
    if (p) return issued(root, cat, p);
    var st = { design: designs[0] && designs[0].id, amount: amounts[1] || amounts[0], custom: '' };
    var self = S.qs('self');
    root.innerHTML =
      (cancelled ? '<p class="shop-notice" role="status">Payment was cancelled, so no card was issued and you have not been charged. Your details are still here.</p>' : '') +
      '<div class="gc-grid"><form id="gc-form" class="shop-card gc-form" novalidate>' +
      '<fieldset><legend>1. Choose a design</legend><div class="shop-chips" role="radiogroup" aria-label="Design">' +
      designs.map(function (d, i) { return '<button type="button" class="shop-chip' + (i ? '' : ' is-on') + '" role="radio" aria-checked="' + (i ? 'false' : 'true') + '" data-design="' + esc(d.id) + '">' + esc(d.name) + '</button>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>2. Choose an amount</legend><div class="shop-chips" role="radiogroup" aria-label="Amount">' +
      amounts.map(function (a) { return '<button type="button" class="shop-chip' + (a === st.amount ? ' is-on' : '') + '" role="radio" aria-checked="' + (a === st.amount) + '" data-amount="' + a + '">' + S.money(a) + '</button>'; }).join('') + '</div>' +
      '<div class="shop-field"><label for="gc-custom">Or type an amount (' + S.money(gc.min || 500) + ' to ' + S.money(gc.max || 50000) + ')</label><input id="gc-custom" inputmode="decimal" placeholder="e.g. 35"></div></fieldset>' +
      '<fieldset><legend>3. Who is it for?</legend>' +
      '<div class="shop-field"><label for="gc-to">To</label><input id="gc-to" maxlength="60" autocomplete="off" required value="' + esc(self ? S.name() : '') + '"></div>' +
      '<div class="shop-field"><label for="gc-from">From</label><input id="gc-from" maxlength="60" autocomplete="name" required value="' + esc(S.name()) + '"></div>' +
      '<div class="shop-field"><label for="gc-msg">Message <span class="shop-muted">(optional)</span></label><textarea id="gc-msg" rows="3" maxlength="240"></textarea><span class="shop-muted" id="gc-count">0 / 240</span></div></fieldset>' +
      '<p id="gc-err" class="gc-error" role="alert" hidden></p>' +
      '<button class="shop-btn shop-btn--block" id="gc-pay" type="submit">Pay ' + S.money(st.amount) + '</button>' +
      '<p class="shop-demo-label">Demo shop: test payments only. No real money moves.</p></form>' +
      '<div class="gc-side"><h2 class="gc-prev-h">Preview</h2><div id="gc-prev"></div><p class="shop-muted">After paying you get the card code and a link to send. The recipient opens a page with your message and the balance.</p></div></div>';
    var f = $('#gc-form', root);
    function amountNow() {
      var c = $('#gc-custom', root).value.trim().replace(',', '.');
      if (c) { var n = Math.round(parseFloat(c) * 100); return isFinite(n) ? n : 0; }
      return st.amount;
    }
    function preview() {
      var d = designs.filter(function (x) { return x.id === st.design; })[0] || {};
      var a = amountNow();
      $('#gc-prev', root).innerHTML = cardHTML({ design: st.design, line: d.line, to: $('#gc-to', root).value.trim(), from: $('#gc-from', root).value.trim(), amountText: a > 0 ? S.money(a) : '—' }) +
        ($('#gc-msg', root).value.trim() ? '<blockquote class="gc-msg">' + esc($('#gc-msg', root).value.trim()) + '</blockquote>' : '');
      $('#gc-pay', root).textContent = a > 0 ? 'Pay ' + S.money(a) : 'Pay';
      $('#gc-count', root).textContent = $('#gc-msg', root).value.length + ' / 240';
    }
    function pick(attr, group) {
      group.forEach(function (b) { var on = b === group.on; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
    }
    var dBtns = [].slice.call(f.querySelectorAll('[data-design]')), aBtns = [].slice.call(f.querySelectorAll('[data-amount]'));
    dBtns.forEach(function (b) { b.addEventListener('click', function () { st.design = b.dataset.design; dBtns.on = b; pick('design', dBtns); preview(); }); });
    aBtns.forEach(function (b) { b.addEventListener('click', function () { st.amount = +b.dataset.amount; $('#gc-custom', root).value = ''; aBtns.on = b; pick('amount', aBtns); preview(); }); });
    $('#gc-custom', root).addEventListener('input', function () {
      aBtns.on = null; pick('amount', aBtns); preview();
    });
    ['#gc-to', '#gc-from', '#gc-msg'].forEach(function (s) { $(s, root).addEventListener('input', preview); });
    dBtns.on = dBtns[0]; pick('design', dBtns); preview();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#gc-err', root), a = amountNow(), to = $('#gc-to', root).value.trim(), from = $('#gc-from', root).value.trim();
      var msg = '';
      if (!to) msg = 'Tell us who the card is for.'; else if (!from) msg = 'Add your name as the sender.';
      else if (a < (gc.min || 500) || a > (gc.max || 50000)) msg = 'Choose an amount from ' + S.money(gc.min || 500) + ' to ' + S.money(gc.max || 50000) + '.';
      err.hidden = !msg; err.textContent = msg;
      if (msg) { $(!to ? '#gc-to' : !from ? '#gc-from' : '#gc-custom', root).focus(); return; }
      S.name(from);
      var btn = $('#gc-pay', root); btn.disabled = true; btn.textContent = 'Taking you to payment…';
      S.api('giftcards', { amount: a, design: st.design, to: to, from: from, message: $('#gc-msg', root).value.trim() }).then(function (r) {
        if (r.pay && r.pay.url) location.href = r.pay.url;
        else if (r.purchase) location.href = S.url('pages/gift-cards.html?p=' + encodeURIComponent(r.purchase.token));
      }).catch(function (x) { btn.disabled = false; preview(); err.hidden = false; err.textContent = x.message; });
    });
  }

  function issued(root, cat, token) {
    var tries = 0;
    root.innerHTML = '<p class="shop-muted">Confirming your payment…</p>';
    (function load() {
      S.api('giftcards/purchase/' + encodeURIComponent(token)).then(function (pu) {
        var code = pu.code || (pu.giftCard && pu.giftCard.code);
        if (!code) {
          if (++tries < 15) return setTimeout(load, 1500);
          root.innerHTML = '<p class="shop-notice">We are still waiting for the payment to clear. <a href="' + esc(location.href) + '">Check again</a> or <a href="gift-cards.html">start a new card</a>.</p>'; return;
        }
        S.rememberGift(code);
        var g = pu.giftCard || {}, link = shareLink(code), d = ((cat.giftCards || {}).designs || []).filter(function (x) { return x.id === (g.design || pu.design); })[0] || {};
        root.innerHTML = '<div class="gc-done"><h2>Your gift card is ready</h2>' +
          cardHTML({ design: g.design || pu.design, line: d.line, to: g.to || pu.to, from: g.from || pu.from, amountText: S.money(g.amount || pu.amount) }) +
          '<dl class="gc-facts"><div><dt>Code</dt><dd class="gc-code">' + esc(code) + '</dd></div><div><dt>Balance</dt><dd>' + S.money(g.balance != null ? g.balance : (g.amount || pu.amount)) + '</dd></div></dl>' +
          '<div class="shop-field"><label for="gc-link">Link to send</label><input id="gc-link" readonly value="' + esc(link) + '"></div>' +
          '<div class="gc-actions"><button type="button" class="shop-btn" id="gc-copy">Copy link</button><button type="button" class="shop-btn shop-btn--ghost" id="gc-copycode">Copy code</button>' +
          '<a class="shop-btn shop-btn--ghost" href="gift.html?c=' + encodeURIComponent(code) + '">See the recipient’s page</a></div>' +
          '<p class="shop-muted">Saved to your wallet on this device. <a href="account.html">Open Me</a>. Demo shop: test payments only.</p></div>';
        $('#gc-copy', root).addEventListener('click', function () { copy(link, 'Link copied'); });
        $('#gc-copycode', root).addEventListener('click', function () { copy(code, 'Code copied'); });
        $('#gc-link', root).addEventListener('focus', function () { this.select(); });
      }).catch(function (e) { root.innerHTML = '<p class="gc-error" role="alert">' + esc(e.message) + '</p><p><a class="shop-btn" href="gift-cards.html">Buy a gift card</a></p>'; });
    })();
  }

  /* ---------- balance check ---------- */
  function balanceForm() {
    var f = $('#bal-form'); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = $('#bal-code').value.trim().toUpperCase(), out = $('#bal-out');
      if (!code) { out.innerHTML = '<p class="gc-error">Enter the code from the gift card.</p>'; return; }
      out.innerHTML = '<p class="shop-muted">Checking…</p>';
      S.api('giftcards/' + encodeURIComponent(code)).then(function (g) {
        out.innerHTML = '<p class="gc-bal">Card ending <strong>' + esc(g.last4) + '</strong> has <strong class="gc-bal-n">' + S.money(g.balance) + '</strong> left of ' + S.money(g.amount) + '.</p>' +
          '<p><a href="gift.html?c=' + encodeURIComponent(code) + '">Open this card</a></p>';
      }).catch(function (x) { out.innerHTML = '<p class="gc-error" role="alert">' + esc(x.message) + '</p>'; });
    });
  }

  /* ---------- recipient page ---------- */
  function giftPage(root, cat) {
    var code = (S.qs('c') || '').trim();
    if (!code) { root.innerHTML = '<h1 class="gc-title">A gift card</h1><p>This link has no gift card in it. <a href="gift-cards.html">Check a balance or buy one</a>.</p>'; return; }
    S.api('giftcards/' + encodeURIComponent(code)).then(function (g) {
      var d = ((cat.giftCards || {}).designs || []).filter(function (x) { return x.id === g.design; })[0] || {};
      S.rememberGift(code);
      root.innerHTML = '<h1 class="gc-title">' + (g.from ? esc(g.from) + ' sent you a gift' : 'You have a gift') + '</h1>' +
        cardHTML({ design: g.design, line: d.line, to: g.to, from: g.from, amountText: S.money(g.amount) }) +
        (g.message ? '<blockquote class="gc-msg gc-msg--big">' + esc(g.message) + '</blockquote>' : '') +
        '<div class="shop-card gc-balbox"><span class="shop-muted">Balance now</span><strong class="gc-bal-n">' + S.money(g.balance) + '</strong><span class="shop-muted">Code ' + esc(g.code || code) + '</span></div>' +
        (g.balance > 0 ? '<div class="gc-actions"><a class="shop-btn" href="menu.html">Use it now</a><a class="shop-btn shop-btn--ghost" href="account.html">See it in your wallet</a></div>' +
          '<p class="shop-muted">It is saved on this device. At checkout, pick it in your wallet or type the code.</p>' : '<p class="shop-notice">This card is fully spent. <a href="gift-cards.html">Send one of your own</a>.</p>');
    }).catch(function (e) { root.innerHTML = '<h1 class="gc-title">We couldn’t open that gift</h1><p class="gc-error" role="alert">' + esc(e.message) + '</p><p><a href="gift-cards.html">Check a balance</a></p>'; });
  }

  ready(function () {
    S = window.Shop; esc = S.esc; window.ShopGifts = { cardHTML: cardHTML };
    S.menu().catch(function () { return {}; }).then(function (cat) {
      BRAND = (cat.brand && cat.brand.name) || BRAND;
      var b = $('#gc-root'), g = $('#gift-root');
      if (b) { buyPage(b, cat); balanceForm(); }
      if (g) giftPage(g, cat);
    });
  });
})();
