/* =====================================================================================================================
   counter.js: the staff counter (pages/counter.html). Owner: Senior Developer 3.

   - Today's paid orders for one store (GET counter?store=), refreshed every 5 s, in columns: New, Being made, Ready,
     then Picked up and Cancelled. Each ticket moves on with one button (POST counter/<token> {to}); an order moved by
     hand can go back to the clock ("auto").
   - Find an order by pickup number or 4-digit code (GET counter/find?q=).
   - Scan a customer's QR code with the camera where the browser has BarcodeDetector (Chrome on Android, for one).
     The QR holds <site>/pages/counter.html?scan=<token>; any phone camera opens that address too.
   - pages/counter.html?scan=<token> shows that one order big, with a Hand over button.
   No sign-in: this is a demo shop's staff screen.
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  var root = document.querySelector('[data-counter]');
  if (!Shop || !root) return;
  var esc = Shop.esc, icon = Shop.icon;
  var $ = function (s) { return root.querySelector(s); };
  var live = document.querySelector('[data-counter-live]');
  var store = Shop.qs('store'), timer = null, known = null, sig = '', scanner = null;
  var NEXT = { paid: { to: 'making', label: 'Start making' }, making: { to: 'ready', label: 'Mark ready' }, ready: { to: 'collected', label: 'Hand over' } };

  Shop.ready.then(start, function (err) { Shop.fail(root, err); });

  function start() {
    store = store && Shop.store(store) ? store : Shop.storeId();
    var sel = $('[data-store-select]');
    sel.innerHTML = Shop.catalog.stores.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
    sel.value = store;
    sel.addEventListener('change', function () { store = sel.value; known = null; sig = ''; history.replaceState(null, '', '?store=' + store); load(); });
    $('[data-find]').addEventListener('submit', find);
    root.addEventListener('click', onClick);
    if ('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) $('[data-scan]').hidden = false;
    else $('[data-scan-hint]').hidden = false;
    var scan = Shop.qs('scan');
    if (scan) showOne(scan);
    load();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  }

  /* ---- The queue ------------------------------------------------------------------------------------------- */
  function load() {
    clearTimeout(timer);
    return Shop.api.get('counter?store=' + encodeURIComponent(store)).then(function (res) {
      $('[data-updated]').textContent = 'Updated ' + Shop.time(Shop.now());
      var orders = res.orders;
      var ids = orders.map(function (o) { return o.token; });
      if (known) {
        var fresh = orders.filter(function (o) { return known.indexOf(o.token) < 0; });
        if (fresh.length && live) live.textContent = 'New order' + (fresh.length > 1 ? 's' : '') + ': ' + fresh.map(function (o) { return o.number; }).join(', ');
      }
      known = ids;
      var s = orders.map(function (o) { return o.token + o.status; }).join();
      if (s !== sig) { sig = s; render(orders); }
    }, function (err) {
      $('[data-queue]').innerHTML = '<p class="notice notice--danger" role="alert">' + esc(err.message) + '</p>';
    }).then(function () { timer = setTimeout(load, 5000); });
  }

  function render(orders) {
    var by = function (st) { return orders.filter(function (o) { return o.status === st; }); };
    var cols = [['paid', 'New'], ['making', 'Being made'], ['ready', 'Ready']];
    var focusKey = document.activeElement && document.activeElement.getAttribute('data-move');
    $('[data-queue]').innerHTML = '<div class="queue">' + cols.map(function (c) {
      var list = by(c[0]);
      return '<section class="queue__col queue__col--' + c[0] + '" aria-labelledby="col-' + c[0] + '">' +
        '<h2 id="col-' + c[0] + '" class="queue__title">' + c[1] + ' <span class="badge badge--muted">' + list.length + '</span></h2>' +
        (list.length ? '<ol class="queue__list" role="list">' + list.map(ticket).join('') + '</ol>' : '<p class="queue__empty">Nothing here</p>') +
        '</section>';
    }).join('') + '</div>' +
    doneList('Picked up today', by('collected')) + doneList('Cancelled today', by('cancelled'));
    if (focusKey) { var again = root.querySelector('[data-move="' + focusKey + '"]'); if (again) again.focus(); }
  }

  function ticket(o) {
    var n = NEXT[o.status];
    var items = o.lines.reduce(function (s, l) { return s + l.qty; }, 0);
    return '<li class="ticket-card' + (o.status === 'ready' ? ' is-ready' : '') + '">' +
      '<div class="ticket-card__head"><span class="ticket-card__num">' + o.number + '</span>' +
        '<span class="ticket-card__who"><strong>' + esc(o.name) + '</strong><span>' + items + (items === 1 ? ' item' : ' items') +
        ' · ' + (o.pickupAt ? 'for ' + esc(Shop.time(o.pickupAt)) : 'placed ' + esc(Shop.time(o.placedAt))) + '</span></span></div>' +
      '<ul class="ticket-card__lines">' + o.lines.map(function (l) {
        return '<li><strong>' + l.qty + '×</strong> ' + esc(l.name) + (l.summary ? '<span>' + esc(l.summary) + '</span>' : '') +
          (l.note ? '<em>“' + esc(l.note) + '”</em>' : '') + '</li>';
      }).join('') + '</ul>' +
      (o.note ? '<p class="ticket-card__note">' + icon('info') + esc(o.note) + '</p>' : '') +
      '<div class="ticket-card__actions">' +
        (n ? '<button type="button" class="btn btn--primary btn--sm" data-move="' + esc(o.token) + ':' + n.to + '">' + n.label +
          '<span class="visually-hidden"> order ' + o.number + '</span></button>' : '') +
        (!o.auto ? '<button type="button" class="btn btn--ghost btn--sm" data-move="' + esc(o.token) + ':auto" title="Let the demo clock move it again">Back to the clock</button>' : '') +
      '</div></li>';
  }
  function doneList(title, list) {
    if (!list.length) return '';
    return '<details class="done-list"><summary>' + title + ' (' + list.length + ')</summary><ul role="list">' + list.map(function (o) {
      return '<li><span class="ticket-card__num ticket-card__num--sm">' + o.number + '</span> ' + esc(o.name) + ' · ' +
        esc(o.lines.map(function (l) { return l.qty + '× ' + l.name; }).join(', ')) + '</li>';
    }).join('') + '</ul></details>';
  }

  function move(tok, to, btn) {
    if (btn) btn.classList.add('is-busy');
    return Shop.api.post('counter/' + encodeURIComponent(tok), { to: to }).then(function (o) {
      if (live) live.textContent = 'Order ' + o.number + ': ' + o.statusLabel + '.';
      sig = '';
      load();
      return o;
    }, function (err) {
      if (btn) btn.classList.remove('is-busy');
      Shop.toast(err.message, { tone: 'danger' });
      throw err;
    });
  }

  /* ---- Find by number or code ----------------------------------------------------------------------------- */
  function find(e) {
    e.preventDefault();
    var q = $('[name="q"]').value.trim();
    if (!q) return $('[name="q"]').focus();
    Shop.api.get('counter/find?q=' + encodeURIComponent(q)).then(function (res) {
      var mine = res.orders.filter(function (o) { return o.store.id === store; });
      var o = (mine[0] || res.orders[0]);
      showOne(o.token, o);
    }, function (err) {
      $('[data-one]').innerHTML = '<p class="notice notice--warning" role="alert">' + esc(err.message) + '</p>';
    });
  }

  /* ---- One order, big (from ?scan=, a scan or a search) --------------------------------------------------- */
  function showOne(tok, o) {
    var box = $('[data-one]');
    var p = o ? Promise.resolve(o) : Shop.api.get('orders/' + encodeURIComponent(tok));
    p.then(function (ord) {
      var s = ord.status;
      var verdict = s === 'pending' ? '<p class="notice notice--danger">Not paid yet. Don\'t hand this one over.</p>'
        : s === 'cancelled' ? '<p class="notice notice--danger">Cancelled' + (ord.payment.state === 'refunded' ? ' and refunded' : '') + '. Nothing to hand over.</p>'
        : s === 'collected' ? '<p class="notice notice--success">Handed over' + (ord.steps[3].at ? ' at ' + esc(Shop.time(ord.steps[3].at)) : '') + '. Nothing more to do.</p>'
        : '';
      box.innerHTML = '<section class="card one-order" aria-labelledby="one-num" tabindex="-1">' +
        '<div class="card__row"><p class="co-label">' + esc(ord.store.name) + (ord.store.id !== store ? ' (another store)' : '') + '</p>' +
          '<button type="button" class="icon-btn" data-close-one aria-label="Close this order">' + icon('close') + '</button></div>' +
        '<h2 class="one-order__num" id="one-num"><span class="visually-hidden">Order </span>' + ord.number + '</h2>' +
        '<p class="one-order__name">' + esc(ord.name) + ' · code ' + esc(ord.code) + '</p>' +
        '<p class="status-pill status-pill--' + esc(s) + '">' + esc(ord.statusLabel) + '</p>' +
        '<ul class="ticket-card__lines">' + ord.lines.map(function (l) {
          return '<li><strong>' + l.qty + '×</strong> ' + esc(l.name) + (l.summary ? '<span>' + esc(l.summary) + '</span>' : '') + (l.note ? '<em>“' + esc(l.note) + '”</em>' : '') + '</li>';
        }).join('') + '</ul>' + verdict +
        (['paid', 'making', 'ready'].indexOf(s) > -1 ? '<button type="button" class="btn btn--primary btn--lg btn--block" data-hand="' + esc(ord.token) + '">' + icon('check') + ' Hand over</button>' : '') +
        '</section>';
      box.querySelector('.one-order').focus();
    }, function (err) {
      box.innerHTML = '<p class="notice notice--danger" role="alert">' + esc(err.message) + '</p>';
    });
  }

  function onClick(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-move')) {
      var parts = b.getAttribute('data-move').split(':');
      move(parts[0], parts[1], b).catch(function () {});
    } else if (b.hasAttribute('data-hand')) {
      move(b.getAttribute('data-hand'), 'collected', b).then(function (o) {
        showOne(o.token, o);
        Shop.toast('Order ' + o.number + ' handed over');
        if (Shop.qs('scan')) history.replaceState(null, '', location.pathname + '?store=' + store);
      }, function () {});
    } else if (b.hasAttribute('data-close-one')) {
      $('[data-one]').innerHTML = '';
      $('[name="q"]').focus();
      if (Shop.qs('scan')) history.replaceState(null, '', location.pathname + '?store=' + store);
    } else if (b.hasAttribute('data-scan')) {
      openScanner(b);
    }
  }

  /* ---- Camera scanning (BarcodeDetector) ----------------------------------------------------------------- */
  function openScanner(opener) {
    if (!scanner) {
      scanner = Shop.sheet({ id: 'scanner', title: 'Scan a pickup QR code', onClose: stopCamera });
      scanner.body.innerHTML = '<div class="scanner"><video playsinline muted aria-label="Camera view"></video><span class="scanner__frame" aria-hidden="true"></span></div>' +
        '<p class="muted" data-scan-msg role="status">Point the camera at the QR code on the customer\'s phone.</p>';
    }
    scanner.open(opener);
    var video = scanner.body.querySelector('video'), msg = scanner.body.querySelector('[data-scan-msg]');
    var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
      scanner.stream = stream;
      video.srcObject = stream;
      return video.play();
    }).then(function loop() {
      if (!scanner.stream) return;
      detector.detect(video).then(function (codes) {
        var hit = codes.map(function (c) { return tokenFrom(c.rawValue); }).filter(Boolean)[0];
        if (hit) { scanner.close(); showOne(hit); return; }
        scanner.loopTimer = setTimeout(loop, 250);
      }, function () { scanner.loopTimer = setTimeout(loop, 500); });
    }).catch(function () {
      msg.textContent = 'The camera is not available here (permission or no camera). Type the pickup number or code instead.';
    });
  }
  function stopCamera() {
    if (!scanner) return;
    clearTimeout(scanner.loopTimer);
    if (scanner.stream) scanner.stream.getTracks().forEach(function (t) { t.stop(); });
    scanner.stream = null;
  }
  function tokenFrom(raw) {
    try { var t = new URL(raw).searchParams.get('scan'); if (t) return t; } catch (e) { /* not a URL */ }
    return /^o_[A-Za-z0-9_-]{8,}$/.test(raw) ? raw : null;
  }
})();
