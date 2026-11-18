/* =====================================================================================================================
   app.js: page glue for the brand pages (home, about, visit). Owner: Full-Stack.

   It runs before js/shop/core.js (script order), so anything that needs window.Shop waits for DOMContentLoaded,
   which fires after every deferred script has run.
     [data-year]               the current year
     #anchor links             move keyboard focus to their target after the smooth scroll
     [data-price-for="<id>"]   that item's price from shop/catalog.json (as it comes, with default options)
     [data-store-status="<id>"] open or closed right now, from the store's hours in the catalog (refreshed each minute)
     [data-hero-status]        one line about the customer's store ("Harbour Street is open until 7:00 pm")
     [data-order-store="<id>"] a link that picks that store before it opens the menu
   The site's other "real things" go in js/tools.js.
   ===================================================================================================================== */
(function () {
  'use strict';

  var each = function (sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); };

  each('[data-year]', function (el) { el.textContent = String(new Date().getFullYear()); });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) {
      var target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        setTimeout(function () { target.focus({ preventScroll: true }); }, 400);
      }
    }
    var pick = e.target.closest('[data-order-store]');
    if (pick && window.Shop) window.Shop.storeId(pick.getAttribute('data-order-store'));   // then the link opens the menu
  });

  document.addEventListener('DOMContentLoaded', function () {
    var Shop = window.Shop;
    if (!Shop) return;
    Shop.ready.then(function () {
      prices();
      statuses();
      setInterval(statuses, 60000);
    }, function () { /* the brand pages read fine without live prices */ });

    function prices() {
      each('[data-price-for]', function (el) {
        var it = Shop.item(el.getAttribute('data-price-for'));
        if (!it) { el.hidden = true; return; }
        el.textContent = it.soldOut ? 'Sold out today' : Shop.money(Shop.estimate({ item: it.id, qty: 1, options: {} }).unit);
      });
    }

    function statuses() {
      each('[data-store-status]', function (el) {
        var st = Shop.store(el.getAttribute('data-store-status'));
        if (!st) return;
        var s = Shop.storeStatus(st);
        el.className = 'store-status';
        el.innerHTML = '<span class="status-dot ' + (s.open ? (s.soon ? 'is-soon' : 'is-open') : 'is-closed') + '">' + Shop.esc(s.short) + '</span>' +
          '<span class="muted"> · ' + Shop.esc(s.label) + '</span>';
      });
      each('[data-hero-status]', function (el) {
        var st = Shop.store(Shop.storeId());
        if (!st) return;
        var s = Shop.storeStatus(st);
        el.innerHTML = '<span class="status-dot ' + (s.open ? 'is-open' : 'is-closed') + '">' + Shop.esc(s.short) + '</span>' +
          '<span><strong>' + Shop.esc(st.name) + '</strong> · ' + Shop.esc(s.label) +
          (st.prepMinutes ? Shop.esc(' · orders take about ' + st.prepMinutes + ' min') : '') + '</span>';
        el.hidden = false;
      });
    }
  });
})();
