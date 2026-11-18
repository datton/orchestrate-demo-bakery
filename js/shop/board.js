/* Now-serving screen: big numbers, refreshes by itself. */
(function () {
  'use strict';
  var ROOT = new URL('../../', document.currentScript.src).href;
  var API = ROOT + 'api/shop/';
  var params = new URLSearchParams(location.search);
  var store = params.get('store') || '';
  var storeName = document.getElementById('brd-store');
  var ready = document.getElementById('brd-ready'), making = document.getElementById('brd-making');
  var seenReady = {};
  var first = true;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function list(el, rows, cls) {
    el.innerHTML = rows.length ? rows.map(function (r) {
      var isNew = cls === 'r' && !first && !seenReady[r.number];
      return '<li class="' + (isNew ? 'is-new' : '') + '"><b>' + esc(r.number) + '</b><span>' + esc(r.name || '') + '</span></li>';
    }).join('') : '<li class="empty">' + (cls === 'r' ? 'Nothing waiting' : 'All caught up') + '</li>';
  }
  function load() {
    fetch(API + 'board' + (store ? '?store=' + encodeURIComponent(store) : '')).then(function (r) { return r.json(); }).then(function (d) {
      list(ready, d.ready || [], 'r'); list(making, d.making || [], 'm');
      seenReady = {}; (d.ready || []).forEach(function (r) { seenReady[r.number] = 1; });
      first = false;
    }).catch(function () {});
  }
  function stores() {
    if (store) return Promise.resolve();
    return fetch(API + 'counter').then(function (r) { return r.json(); }).then(function (d) {
      var s = (d.stores || [])[0]; if (s) { store = s.id; storeName.textContent = s.name; }
      if (d.stores && d.stores.length > 1) {
        storeName.innerHTML = d.stores.map(function (x) { return '<a href="?store=' + encodeURIComponent(x.id) + '"' + (x.id === store ? ' aria-current="true"' : '') + '>' + esc(x.name) + '</a>'; }).join('');
      }
    }).catch(function () {});
  }
  function names() {
    if (!store) return;
    fetch(API + 'counter?store=' + encodeURIComponent(store)).then(function (r) { return r.json(); }).then(function (d) {
      var s = (d.stores || []).filter(function (x) { return x.id === store; })[0];
      if (s && !storeName.querySelector('a')) storeName.textContent = s.name;
    }).catch(function () {});
  }
  function clock() { document.getElementById('brd-clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  stores().then(function () { names(); load(); setInterval(load, 3000); clock(); setInterval(clock, 15000); });
})();
