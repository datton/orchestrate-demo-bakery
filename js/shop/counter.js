/* Counter page (staff): today's orders by stage, find, scan, hand over. */
(function () {
  'use strict';
  var ROOT = new URL('../../', document.currentScript.src).href;
  var API = ROOT + 'api/shop/';
  var params = new URLSearchParams(location.search);
  var storeSel = document.getElementById('ctr-store');
  var cols = document.getElementById('ctr-cols'), focus = document.getElementById('ctr-focus'), msgEl = document.getElementById('ctr-msg');
  var store = params.get('store') || '', orders = [], focusOrder = null, stream = null, scanTimer = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(c, cur) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'CAD' }).format((c || 0) / 100); } catch (e) { return (c / 100).toFixed(2); } }
  function clock(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function say(t, bad) { msgEl.textContent = t || ''; msgEl.className = 'ctr-msg' + (bad ? ' bad' : ''); }
  function api(path, opt) {
    return fetch(API + path, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j; }); });
  }

  var STAGES = [['paid', 'Received'], ['making', 'Being made'], ['ready', 'Ready'], ['collected', 'Picked up']];
  var NEXT = { paid: ['making', 'Start making'], making: ['ready', 'Mark ready'], ready: ['collected', 'Hand over'] };

  function actions(o, big) {
    var n = NEXT[o.status]; if (!n) return '';
    return '<button class="shop-btn' + (big ? ' btn-big' : '') + '" type="button" data-act="' + n[0] + '" data-token="' + esc(o.token) + '">' + (big && n[0] === 'collected' ? 'Hand over' : n[1]) + '</button>';
  }
  function card(o) {
    return '<li class="ctr-card" data-token="' + esc(o.token) + '"><button type="button" class="ctr-open" data-open="' + esc(o.token) + '"><b>' + esc(o.number) + '</b><span>' + esc(o.firstName || o.name || '') + ' · ' + (o.lines || []).reduce(function (a, l) { return a + l.qty; }, 0) + ' items</span></button>' + actions(o, false) + '</li>';
  }
  function renderCols() {
    cols.innerHTML = STAGES.map(function (s) {
      var rows = orders.filter(function (o) { return o.status === s[0]; });
      if (s[0] === 'collected') rows = rows.slice(-8);
      return '<section class="ctr-col" aria-labelledby="c-' + s[0] + '"><h2 id="c-' + s[0] + '">' + s[1] + ' <span class="count">' + rows.length + '</span></h2><ul>' + (rows.map(card).join('') || '<li class="empty">None</li>') + '</ul></section>';
    }).join('');
  }
  function renderFocus() {
    var o = focusOrder;
    if (!o) { focus.hidden = true; focus.innerHTML = ''; return; }
    var h = '<div class="ctr-fhead"><div><p class="ord-eyebrow">' + esc(o.store && o.store.name) + ' · ' + esc(o.statusLabel || o.status) + '</p><p class="ctr-fnum">' + esc(o.number) + '</p></div>';
    h += '<div><p class="ctr-fname">' + esc(o.name) + '</p><p class="ord-hint">Code ' + esc(o.code) + ' · ' + money(o.total, o.currency) + (o.readyBy ? ' · ready by ' + esc(clock(o.readyBy)) : '') + '</p></div></div>';
    h += '<ul class="ord-lines">' + (o.lines || []).map(function (l) { return '<li><span class="q">' + esc(l.qty) + '×</span><span class="n">' + esc(l.name) + (l.summary ? '<small>' + esc(l.summary) + '</small>' : '') + (l.note ? '<small>“' + esc(l.note) + '”</small>' : '') + '</span></li>'; }).join('') + '</ul>';
    if (o.status === 'collected') h += '<p class="ctr-done">Already picked up' + (o.steps && o.steps[3] && o.steps[3].at ? ' at ' + esc(clock(o.steps[3].at)) : '') + '.</p>';
    else if (o.status === 'cancelled' || o.status === 'refunded') h += '<p class="ctr-done bad">This order was cancelled. Do not hand it over.</p>';
    else if (o.status === 'pending') h += '<p class="ctr-done bad">Not paid yet. Do not hand it over.</p>';
    else h += '<div class="ctr-factions">' + actions(o, true) + (o.status === 'ready' ? '' : '') + '<button class="shop-btn shop-btn--ghost" type="button" data-close="1">Close</button></div>';
    if (o.status === 'collected' || o.status === 'cancelled' || o.status === 'refunded' || o.status === 'pending') h += '<div class="ctr-factions"><button class="shop-btn shop-btn--ghost" type="button" data-close="1">Close</button></div>';
    focus.innerHTML = h; focus.hidden = false;
    var b = focus.querySelector('.btn-big'); if (b) b.focus();
  }
  function setFocus(o) { focusOrder = o; renderFocus(); if (o) focus.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

  function load() {
    return api('counter' + (store ? '?store=' + encodeURIComponent(store) : '')).then(function (d) {
      if (!storeSel.options.length && d.stores) {
        storeSel.innerHTML = d.stores.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
      }
      if (!store && d.stores && d.stores[0]) store = d.stores[0].id;
      storeSel.value = store;
      orders = (d.orders || []).slice().sort(function (a, b) { return a.number - b.number; });
      renderCols();
      if (focusOrder) { var f = orders.filter(function (o) { return o.token === focusOrder.token; })[0]; if (f && f.status !== focusOrder.status) { focusOrder = f; renderFocus(); } }
    }).catch(function (e) { say(e.message, true); });
  }

  function move(token, to) {
    return api('counter/' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: to }) }).then(function (o) {
      say('#' + o.number + ': ' + (o.statusLabel || o.status));
      if (focusOrder && focusOrder.token === o.token) { focusOrder = o; renderFocus(); }
      return load();
    }).catch(function (e) { say(e.message, true); });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'), op = e.target.closest('[data-open]');
    if (a) { a.disabled = true; move(a.getAttribute('data-token') || (focusOrder && focusOrder.token), a.getAttribute('data-act')); }
    else if (op) { var t = op.getAttribute('data-open'); setFocus(orders.filter(function (o) { return o.token === t; })[0]); }
    else if (e.target.closest('[data-close]')) setFocus(null);
  });
  // The focus panel's buttons carry no token: fill it in.
  focus.addEventListener('click', function (e) { var a = e.target.closest('[data-act]'); if (a && !a.getAttribute('data-token') && focusOrder) { a.setAttribute('data-token', focusOrder.token); } }, true);

  storeSel.addEventListener('change', function () { store = storeSel.value; setFocus(null); load(); });

  document.getElementById('ctr-find').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = document.getElementById('ctr-q').value.trim(); if (!q) return;
    api('counter/find?q=' + encodeURIComponent(q)).then(function (d) {
      var list = d.orders || [];
      if (store) { var here = list.filter(function (o) { return !o.store || o.store.id === store; }); if (here.length) list = here; }
      if (!list.length) { say('No order found for “' + q + '”.', true); setFocus(null); return; }
      say(list.length > 1 ? list.length + ' orders match. Showing the first.' : ''); setFocus(list[0]);
    }).catch(function (er) { say(er.message, true); });
  });

  function scanToken(raw) {
    var t = raw; try { t = new URL(raw, location.href).searchParams.get('scan') || raw; } catch (e) {}
    return api('orders/' + encodeURIComponent(t)).then(function (o) { if (o.store && store && o.store.id !== store) { store = o.store.id; storeSel.value = store; load(); } say(''); setFocus(o); }).catch(function (er) { say(er.message, true); });
  }

  // Camera scan where the browser supports it
  var scanBtn = document.getElementById('ctr-scan'), cam = document.getElementById('ctr-cam'), video = document.getElementById('ctr-video');
  function stopCam() { clearInterval(scanTimer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; cam.hidden = true; }
  if ('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    scanBtn.hidden = false;
    scanBtn.addEventListener('click', function () {
      var det = new BarcodeDetector({ formats: ['qr_code'] });
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        stream = s; video.srcObject = s; video.play(); cam.hidden = false;
        scanTimer = setInterval(function () {
          det.detect(video).then(function (r) { if (r.length) { var v = r[0].rawValue; stopCam(); scanToken(v); } }).catch(function () {});
        }, 400);
      }).catch(function () { say('Camera not available. Type the pickup number or code instead.', true); });
    });
    document.getElementById('ctr-camstop').addEventListener('click', stopCam);
  }

  load().then(function () { var s = params.get('scan'); if (s) scanToken(s); });
  setInterval(load, 4000);
})();
