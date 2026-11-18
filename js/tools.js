/* tools.js: the bakery's custom cake order form (pages/visit.html#cakes). Owner: Full-Stack.
   Cakes and sizes come from shop/catalog.json; prices are the shop's own display estimate. Nothing is sent:
   the request is kept in this browser (localStorage) and can be downloaded as a .txt to bring to the counter. */
(function cakeOrder() {
  'use strict';
  var root = document.querySelector('[data-tool="cake-order"]');
  if (!root) return;

  var KEY = 'hc-cake-requests';
  var SIZES = ['six', 'eight'];
  var cakes = [];
  var stores = [];
  var cat = null;

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function money(c) { return (window.Shop && window.Shop.money) ? window.Shop.money(c) : '$' + (c / 100).toFixed(2); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function addDays(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
  function pretty(isoDate) {
    var p = isoDate.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function priceOf(cakeId, sizeId) {
    var item = cat.items.filter(function (i) { return i.id === cakeId; })[0];
    if (!item) return null;
    if (window.Shop && window.Shop.estimate) {
      try { return window.Shop.estimate({ item: cakeId, qty: 1, options: { 'cake-size': sizeId } }).unit; } catch (e) { /* fall through */ }
    }
    var ch = cat.options['cake-size'].choices.filter(function (c) { return c.id === sizeId; })[0];
    return item.price + (ch ? ch.price : 0);
  }

  function build() {
    var sizeChoices = cat.options['cake-size'].choices.filter(function (c) { return SIZES.indexOf(c.id) > -1; });
    var min = iso(addDays(2));
    root.innerHTML =
      '<form novalidate aria-labelledby="cakes-title">' +
        '<div class="cake__row">' +
          '<div class="field"><label for="ck-cake">Cake</label><select id="ck-cake" name="cake" required>' +
            cakes.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="field"><label for="ck-store">Pick up at</label><select id="ck-store" name="store" required>' +
            stores.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<fieldset><legend>Size</legend>' +
          sizeChoices.map(function (c, i) {
            return '<label class="cake__opt"><input type="radio" name="size" value="' + esc(c.id) + '"' + (i === 0 ? ' checked' : '') + '> <span>' + esc(c.name) + '</span><span class="cake__price" data-price="' + esc(c.id) + '"></span></label>';
          }).join('') +
        '</fieldset>' +
        '<div class="cake__row">' +
          '<div class="field"><label for="ck-date">Pickup date</label><input id="ck-date" name="date" type="date" min="' + min + '" required aria-describedby="ck-date-hint ck-date-err">' +
            '<span class="field__hint" id="ck-date-hint">At least two days from today (earliest: ' + esc(pretty(min)) + ').</span><span class="field__error" id="ck-date-err" role="alert"></span></div>' +
          '<div class="field"><label for="ck-name">Your name</label><input id="ck-name" name="name" type="text" autocomplete="name" maxlength="60" required aria-describedby="ck-name-err"><span class="field__error" id="ck-name-err" role="alert"></span></div>' +
        '</div>' +
        '<div class="field"><label for="ck-msg">Message on the cake <span class="muted">(optional, up to 30 characters)</span></label><input id="ck-msg" name="message" type="text" maxlength="30" aria-describedby="ck-msg-count"><span class="field__hint" id="ck-msg-count">30 characters left</span></div>' +
        '<div class="field"><label for="ck-notes">Allergies or anything else <span class="muted">(optional)</span></label><textarea id="ck-notes" name="notes" rows="3" maxlength="300"></textarea></div>' +
        '<p class="cake__total"><span>Estimated price</span><output id="ck-total" for="ck-cake ck-size" aria-live="polite"></output></p>' +
        '<button class="btn btn--primary btn--lg" type="submit">Save my cake request</button>' +
        '<p class="cake__note">Nothing is sent. Your request is saved in this browser only, and you can download it as a text file to show at the counter. Prices are estimates from the menu; the bakery confirms the final price.</p>' +
      '</form><div data-cake-out></div>';

    var form = root.querySelector('form');
    var out = root.querySelector('[data-cake-out]');
    var sel = form.elements.cake;
    function refresh() {
      sizeChoices.forEach(function (c) {
        var p = priceOf(sel.value, c.id);
        form.querySelector('[data-price="' + c.id + '"]').textContent = p == null ? '' : money(p);
      });
      var cur = priceOf(sel.value, form.elements.size.value);
      form.querySelector('#ck-total').textContent = cur == null ? '' : money(cur);
    }
    sel.addEventListener('change', refresh);
    Array.prototype.forEach.call(form.elements.size, function (r) { r.addEventListener('change', refresh); });
    form.elements.message.addEventListener('input', function () {
      var left = 30 - form.elements.message.value.length;
      form.querySelector('#ck-msg-count').textContent = left + (left === 1 ? ' character left' : ' characters left');
    });
    refresh();

    function fail(input, errId, text) {
      form.querySelector('#' + errId).textContent = text;
      input.setAttribute('aria-invalid', 'true');
    }
    function clear(input, errId) { form.querySelector('#' + errId).textContent = ''; input.removeAttribute('aria-invalid'); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      var date = form.elements.date, name = form.elements.name;
      clear(date, 'ck-date-err'); clear(name, 'ck-name-err');
      if (!name.value.trim()) { fail(name, 'ck-name-err', 'Please tell us your name so we can find the cake.'); bad = name; }
      if (!date.value) { fail(date, 'ck-date-err', 'Please choose a pickup date.'); bad = date; }
      else if (date.value < min) { fail(date, 'ck-date-err', 'Whole cakes need two days\' notice: the earliest date is ' + pretty(min) + '.'); bad = date; }
      if (bad) { bad.focus(); return; }

      var cake = cakes.filter(function (c) { return c.id === sel.value; })[0];
      var size = sizeChoices.filter(function (c) { return c.id === form.elements.size.value; })[0];
      var store = stores.filter(function (s) { return s.id === form.elements.store.value; })[0];
      var list = load();
      var rec = {
        ref: 'CAKE-' + String(list.length + 1).padStart(3, '0'),
        cake: cake.name, size: size.name, price: money(priceOf(cake.id, size.id)),
        message: form.elements.message.value.trim(), notes: form.elements.notes.value.trim(),
        name: name.value.trim(), store: store.name, date: date.value
      };
      list.push(rec);
      var kept = save(list);
      show(rec, kept);
    });

    function text(r) {
      return ['Hearth & Crumb Bakery: whole cake request (sample, not sent)', 'Reference: ' + r.ref, 'Name: ' + r.name,
        'Cake: ' + r.cake, 'Size: ' + r.size, 'Message on the cake: ' + (r.message || '(none)'),
        'Pickup: ' + pretty(r.date) + ' at ' + r.store, 'Estimated price: ' + r.price, 'Notes: ' + (r.notes || '(none)'), '',
        'Nothing was sent. Show this at the counter to confirm the order and the final price.'].join('\n');
    }

    function show(r, kept) {
      out.innerHTML = '<div class="cake__done" role="status" tabindex="-1">' +
        '<h3>Your cake request is saved, ' + esc(r.name.split(' ')[0]) + '.</h3>' +
        '<dl><dt>Reference</dt><dd>' + esc(r.ref) + '</dd><dt>Cake</dt><dd>' + esc(r.cake) + ', ' + esc(r.size) + '</dd>' +
        '<dt>Message</dt><dd>' + (r.message ? esc(r.message) : 'None') + '</dd>' +
        '<dt>Pickup</dt><dd>' + esc(pretty(r.date)) + ', ' + esc(r.store) + '</dd><dt>Estimate</dt><dd>' + esc(r.price) + '</dd></dl>' +
        '<p class="cake__note">' + (kept ? 'Saved in this browser only. ' : 'Your browser blocked saving, so download the file below. ') + 'Nothing has been sent to the bakery: download the request and show it at the counter to confirm.</p>' +
        '<div class="cake__actions"><button class="btn btn--primary" type="button" data-dl>Download as .txt</button><button class="btn" type="button" data-new>Order another cake</button></div></div>';
      var box = out.firstChild;
      box.focus();
      box.querySelector('[data-dl]').addEventListener('click', function () {
        var blob = new Blob([text(r)], { type: 'text/plain' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = r.ref.toLowerCase() + '.txt';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      });
      box.querySelector('[data-new]').addEventListener('click', function () { out.innerHTML = ''; form.reset(); refresh(); form.elements.cake.focus(); });
    }
  }

  fetch('../shop/catalog.json').then(function (r) { return r.json(); }).then(function (c) {
    cat = c;
    cakes = c.items.filter(function (i) { return i.category === 'cakes'; });
    stores = c.stores;
    var go = function () { build(); };
    if (window.Shop && window.Shop.ready) window.Shop.ready.then(go, go); else go();
  }).catch(function () {
    root.innerHTML = '<p>The cake form could not load. Please ask at the counter about whole cakes.</p>';
  });
})();
