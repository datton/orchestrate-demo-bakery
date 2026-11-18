/* Shared shop code. Exposes window.Shop. Loaded (defer) on every page before the page's own script. */
(function () {
  'use strict';
  var script = document.currentScript;
  var ROOT = new URL('../../', script ? script.src : location.href).href; // site root, ends with /
  var API = ROOT + 'api/shop/';
  var LS = window.localStorage, KEY = 'shop:';

  function read(k, d) { try { var v = LS.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function write(k, v) { try { LS.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }

  /* ---- API client: Shop.api('quote', {items:[...]}) -> Promise(json); rejects with Error(customer sentence) ---- */
  function api(path, body, opts) {
    var init = { headers: {} };
    if (body !== undefined && body !== null) {
      init.method = 'POST'; init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body);
    }
    if (opts && opts.method) init.method = opts.method;
    return fetch(API + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || (j && j.error)) throw new Error((j && j.error) || 'Something went wrong. Please try again.');
        return j;
      });
    }, function () { throw new Error('Can’t reach the shop right now. Check your connection and try again.'); });
  }

  /* ---- money (whole cents) ---- */
  var currency = 'CAD';
  function money(cents, cur) {
    var n = (Number(cents) || 0) / 100;
    try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur || currency }).format(n); }
    catch (e) { return '$' + n.toFixed(2); }
  }

  /* ---- customer id (random, kept in the browser) ---- */
  function customer() {
    var id = read('customer', null);
    if (!id) {
      var a = new Uint8Array(12);
      (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      id = 'c' + Array.prototype.map.call(a, function (b) { return b.toString(36).padStart(2, '0'); }).join('').slice(0, 20);
      write('customer', id);
    }
    return id;
  }

  /* ---- menu (shop/catalog.json), loaded once ---- */
  var menuP = null;
  function menu() {
    if (!menuP) menuP = fetch(ROOT + 'shop/catalog.json').then(function (r) {
      if (!r.ok) throw new Error('The menu is not available right now.');
      return r.json();
    }).then(function (c) { currency = c.currency || currency; return c; });
    menuP.catch(function () { menuP = null; });
    return menuP;
  }
  function findItem(c, id) { return (c.items || []).filter(function (i) { return i.id === id; })[0]; }

  /* ---- stores ---- */
  function storeId() { return read('store', null); }
  function setStore(id) { write('store', id); emit('shop:store', { id: id }); }
  function toMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dayMatches(spec, d) { // "Mon–Fri", "Sat–Sun", "Daily", "Mon"
    var s = String(spec).replace(/\s/g, '');
    if (/^daily|every/i.test(s)) return true;
    var m = s.split(/[–—-]/), a = DAYS.indexOf(m[0].slice(0, 3)), b = m[1] ? DAYS.indexOf(m[1].slice(0, 3)) : a;
    if (a < 0 || b < 0) return false;
    return a <= b ? (d >= a && d <= b) : (d >= a || d <= b);
  }
  /* Shop.openNow(store, catalog) -> {open:bool, label:"Open until 19:00"|"Closed · opens 07:30"}.
     Uses the catalog timezone when it has one. */
  function openNow(store, cat) {
    var now = new Date(), d = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    try {
      if (cat && cat.timezone) {
        var p = new Intl.DateTimeFormat('en-GB', { timeZone: cat.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now), o = {};
        p.forEach(function (x) { o[x.type] = x.value; });
        d = DAYS.indexOf(o.weekday.slice(0, 3)); mins = (+o.hour % 24) * 60 + +o.minute;
      }
    } catch (e) {}
    var h = (store.hours || []).filter(function (x) { return dayMatches(x.days, d); })[0];
    if (!h) return { open: false, label: 'Closed today' };
    if (mins >= toMin(h.open) && mins < toMin(h.close)) return { open: true, label: 'Open until ' + h.close };
    if (mins < toMin(h.open)) return { open: false, label: 'Closed · opens ' + h.open };
    return { open: false, label: 'Closed for today' };
  }

  /* ---- cart: lines {id, item, qty, options, note}; persisted; fires 'shop:cart' ---- */
  var cart = read('cart', []);
  if (!Array.isArray(cart)) cart = [];
  function saveCart() { write('cart', cart); emit('shop:cart', { lines: cart.slice(), count: cartCount() }); }
  function cartCount() { return cart.reduce(function (n, l) { return n + l.qty; }, 0); }
  function sig(l) { return JSON.stringify([l.item, l.options || {}, l.note || '']); }
  var Cart = {
    lines: function () { return cart.map(function (l) { return JSON.parse(JSON.stringify(l)); }); },
    count: cartCount,
    /* Cart.add({item:'latte', qty:1, options:{size:'m', extras:['vanilla']}, note:''}) */
    add: function (line) {
      var l = { item: line.item, qty: Math.max(1, Math.min(20, line.qty | 0 || 1)), options: line.options || {}, note: line.note || '' };
      var same = cart.filter(function (x) { return sig(x) === sig(l); })[0];
      if (same) same.qty = Math.min(20, same.qty + l.qty);
      else { l.id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); cart.push(l); }
      saveCart(); return l;
    },
    setQty: function (id, qty) {
      cart = cart.filter(function (l) { if (l.id === id) { l.qty = Math.min(20, qty | 0); } return l.qty > 0; });
      saveCart();
    },
    remove: function (id) { cart = cart.filter(function (l) { return l.id !== id; }); saveCart(); },
    clear: function () { cart = []; saveCart(); },
    /* the lines as the service wants them (no ids) */
    payload: function () { return cart.map(function (l) { return { item: l.item, qty: l.qty, options: l.options || {}, note: l.note || '' }; }); },
    /* Price the cart through the service: Shop.Cart.quote({coupon:'best', giftCard:'CODE'}) -> Quote */
    quote: function (extra) {
      var b = { items: Cart.payload(), customer: customer() };
      for (var k in (extra || {})) if (extra[k]) b[k] = extra[k];
      return api('quote', b);
    }
  };

  /* ---- order tokens kept for the history ---- */
  function orderTokens() { return read('orders', []); }
  function rememberOrder(token) { var t = orderTokens().filter(function (x) { return x !== token; }); t.unshift(token); write('orders', t.slice(0, 30)); }
  function giftCodes() { return read('gifts', []); }
  function rememberGift(code) { var t = giftCodes().filter(function (x) { return x !== code; }); t.unshift(code); write('gifts', t.slice(0, 30)); }

  /* ---- toasts: Shop.toast('Added to cart', {error:true}) ---- */
  function toast(msg, o) {
    var host = document.getElementById('shop-toasts');
    if (!host) {
      host = document.createElement('div'); host.id = 'shop-toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var t = document.createElement('div'); t.className = 'shop-toast' + (o && o.error ? ' is-error' : ''); t.textContent = msg;
    host.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); setTimeout(function () { t.remove(); }, 400); }, (o && o.ms) || 3200);
  }

  /* ---- sheets (bottom sheet on phones, side drawer on desktop) ----
     var s = Shop.sheet({title:'Latte', content: node|html, side:'bottom'|'right', onClose:fn}); s.body (element); s.close();
     Escape and backdrop close; focus moves in and returns. */
  function sheet(o) {
    var prev = document.activeElement;
    var wrap = document.createElement('div'); wrap.className = 'shop-sheet-wrap' + (o.side === 'right' ? ' is-right' : '');
    wrap.innerHTML = '<div class="shop-backdrop"></div><section class="shop-sheet" role="dialog" aria-modal="true" aria-label=""><header class="shop-sheet-head"><h2></h2><button type="button" class="shop-icon-btn" aria-label="Close">×</button></header><div class="shop-sheet-body"></div></section>';
    var panel = wrap.querySelector('.shop-sheet'), body = wrap.querySelector('.shop-sheet-body');
    wrap.querySelector('h2').textContent = o.title || ''; panel.setAttribute('aria-label', o.title || 'Dialog');
    if (typeof o.content === 'string') body.innerHTML = o.content; else if (o.content) body.appendChild(o.content);
    document.body.appendChild(wrap); document.documentElement.classList.add('shop-noscroll');
    requestAnimationFrame(function () { wrap.classList.add('is-open'); });
    var closed = false;
    function close() {
      if (closed) return; closed = true; document.removeEventListener('keydown', key);
      wrap.classList.remove('is-open'); document.documentElement.classList.remove('shop-noscroll');
      setTimeout(function () { wrap.remove(); }, 320);
      if (prev && prev.focus) prev.focus(); if (o.onClose) o.onClose();
    }
    function key(e) {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab') return;
      var f = panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return; var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener('keydown', key);
    wrap.querySelector('.shop-backdrop').addEventListener('click', close);
    wrap.querySelector('.shop-sheet-head button').addEventListener('click', close);
    setTimeout(function () { (panel.querySelector('[autofocus]') || wrap.querySelector('.shop-sheet-head button')).focus(); }, 60);
    return { el: wrap, body: body, close: close };
  }

  /* ---- small helpers ---- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function url(path) { return ROOT + path.replace(/^\//, ''); }   // Shop.url('pages/order.html?o=' + token)
  function time(iso) { try { return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function name(n) { if (n !== undefined) write('name', n); return read('name', ''); }
  /* Shop.poll(fn, ms) calls fn now and every ms while the tab is visible; returns stop() */
  function poll(fn, ms) {
    var t = null, stopped = false;
    function tick() { if (stopped) return; if (!document.hidden) fn(); t = setTimeout(tick, ms || 4000); }
    tick(); return function () { stopped = true; clearTimeout(t); };
  }

  /* ---- app tab bar on phones; and a cart badge on any [data-cart-count] ---- */
  function badges() { document.querySelectorAll('[data-cart-count]').forEach(function (e) { var n = cartCount(); e.textContent = n; e.hidden = !n; }); }
  window.addEventListener('shop:cart', badges);
  window.addEventListener('storage', function (e) { if (e.key === KEY + 'cart') { cart = read('cart', []); badges(); emit('shop:cart', { lines: cart.slice(), count: cartCount() }); } });
  document.addEventListener('DOMContentLoaded', function () {
    badges();
    if (document.querySelector('.shop-tabbar')) return;
    var tabs = [['Home', 'index.html', 'home'], ['Menu', 'pages/menu.html', 'menu'], ['Gift cards', 'pages/gift-cards.html', 'gift-cards'], ['Me', 'pages/account.html', 'account']];
    var here = location.pathname.replace(/\/+$/, '');
    var nav = document.createElement('nav'); nav.className = 'shop-tabbar'; nav.setAttribute('aria-label', 'App');
    nav.innerHTML = tabs.map(function (t) {
      var cur = t[1] === 'index.html' ? (/\/(index\.html)?$/.test(location.pathname) && !/\/pages\//.test(location.pathname)) : location.pathname.indexOf('/' + t[1]) > -1;
      return '<a href="' + ROOT + (t[1] === 'index.html' ? '' : t[1]) + '"' + (cur ? ' aria-current="page"' : '') + '><span>' + t[0] + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  });

  window.Shop = {
    ROOT: ROOT, API: API, api: api, url: url, money: money, customer: customer, menu: menu, findItem: findItem,
    storeId: storeId, setStore: setStore, openNow: openNow, Cart: Cart,
    orderTokens: orderTokens, rememberOrder: rememberOrder, giftCodes: giftCodes, rememberGift: rememberGift,
    toast: toast, sheet: sheet, esc: esc, qs: qs, time: time, name: name, poll: poll, store: { read: read, write: write }
  };
})();
