/* =====================================================================================================================
   board.js: the in-store "now serving" screen (pages/board.html). Owner: Senior Developer 3.

   Two columns, Being made | Ready, with big pickup numbers and first names (GET board?store=), refreshed every 4 s.
   A number that turns ready slides in and is announced politely. ?store=<id> picks the store (the selector at the
   bottom changes it); otherwise the store chosen on this device, or the nearest.
   ===================================================================================================================== */
(function () {
  'use strict';
  var Shop = window.Shop;
  var root = document.querySelector('[data-board]');
  if (!Shop || !root) return;
  var esc = Shop.esc;
  var $ = function (s) { return root.querySelector(s); };
  var store = Shop.qs('store'), timer = null, readyBefore = null;

  Shop.ready.then(start, function (err) { Shop.fail($('[data-board-cols]'), err); });

  function start() {
    store = store && Shop.store(store) ? store : Shop.storeId();
    var sel = $('[data-board-store-select]');
    sel.innerHTML = Shop.catalog.stores.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
    sel.value = store;
    sel.addEventListener('change', function () { store = sel.value; readyBefore = null; history.replaceState(null, '', '?store=' + store); load(); });
    clock();
    setInterval(clock, 15000);
    load();
  }

  function clock() {
    $('[data-board-store]').textContent = Shop.store(store).name;
    $('[data-clock]').textContent = Shop.time(Shop.now());
  }

  function load() {
    clearTimeout(timer);
    Shop.api.get('board?store=' + encodeURIComponent(store)).then(function (b) {
      fill($('[data-making]'), b.making, null);
      var fresh = readyBefore ? b.ready.filter(function (x) { return readyBefore.indexOf(x.number) < 0; }) : [];
      fill($('[data-ready]'), b.ready, readyBefore);
      if (fresh.length) $('[data-board-live]').textContent = 'Ready: ' + fresh.map(function (x) { return x.number + ' ' + x.name; }).join(', ');
      readyBefore = b.ready.map(function (x) { return x.number; });
      $('[data-board-error]').hidden = true;
    }, function (err) {
      var e = $('[data-board-error]');
      e.hidden = false;
      e.textContent = err.message;
    }).then(function () { timer = setTimeout(load, document.hidden ? 15000 : 4000); });
  }

  function fill(list, items, before) {
    if (!items.length) {
      list.innerHTML = '<li class="board__empty">' + (list.hasAttribute('data-ready') ? 'Nothing waiting' : 'All caught up') + '</li>';
      return;
    }
    list.innerHTML = items.map(function (x) {
      var isNew = before && before.indexOf(x.number) < 0;
      return '<li class="board__item' + (isNew ? ' is-new' : '') + '"><span class="board__num">' + x.number + '</span>' +
        '<span class="board__name">' + esc(x.name) + '</span></li>';
    }).join('');
  }
})();
