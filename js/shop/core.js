/* =====================================================================================================================
   core.js: the shop's shared runtime. Owner: Lead Developer. Every shop page loads it (after js/app.js, before
   js/shop/cart.js and the page's own script); all four seniors build on window.Shop, so change it with care.

   What it gives (all on window.Shop):
     root, href(path)            the site root (worked out from this script's own URL, so the same files work live at
                                 "/", in the team preview under "/s/<name>/", or in any folder) and a RELATIVE link from
                                 the current page to a root-relative path ("pages/menu.html")
     api.get(p) / api.post(p,b)  the shop service at <root>api/shop/ (see showcase/commerce/API.md). Rejects with an
                                 Error whose message is the service's sentence for the customer
     ready, catalog              shop/catalog.json, loaded once (ready is a Promise of it); item(id), group(id), store(id)
     money(cents)                formatted in the catalog currency
     time(), storeStatus(), slots()   clock helpers in the shop's time zone (hours, open/closed now, pickup slots)
     estimate(line), describe(line)   display-only price estimate and option summary for a cart line. Never charged:
                                 the service prices every quote and order itself
     couponEstimate(cents)       the best catalog coupon on one item, for the menu's "est." hint
     cart, customer(), storeId(), orders, wallet, usual, profile, flag()   state kept in this browser (localStorage)
     on(event, fn)               'cart' | 'store' | 'wallet' | 'orders' changes (also from other tabs)
     toast(msg, opts), sheet(opts), openStorePicker(opener), icon(name), esc(text), fail(el, err)
   It also draws the app tab bar (Home, Menu, Orders, Me) on phones unless <body data-tabbar="off">.
   ===================================================================================================================== */
(function () {
  'use strict';

  /* ---- Where the site lives ---------------------------------------------------------------------------------- */
  var me = document.currentScript || document.querySelector('script[src*="js/shop/core.js"]');
  var ROOT = new URL('../../', me.src).href;          // ".../js/shop/core.js" -> the site root, ending in "/"
  var API = ROOT + 'api/shop/';
  var html = document.documentElement;

  /** A relative URL from this page to a path given from the site root, e.g. href('pages/menu.html'). */
  function href(path) {
    var here = location.href.split(/[?#]/)[0];
    var rel = here.indexOf(ROOT) === 0 ? here.slice(ROOT.length) : '';
    return new Array(rel.split('/').length).join('../') + path;
  }

  /* ---- Small helpers --------------------------------------------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function randomId(n) {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', out = '';
    var buf = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) out += abc[buf[i] % abc.length];
    return out;
  }

  /* ---- Storage: namespaced per site, so preview sites on one origin never share a cart ----------------------- */
  var NS = 'shop:' + new URL(ROOT).pathname + ':';
  var local = {
    get: function (k, d) {
      try { var v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem(NS + k); } catch (e) { /* ignore */ } }
  };

  /* ---- Events -------------------------------------------------------------------------------------------------- */
  var handlers = {};
  function on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); }
  function emit(ev, data) { (handlers[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
  var KEY_EVENTS = { cart: 'cart', store: 'store', wallet: 'wallet', orders: 'orders' };
  window.addEventListener('storage', function (e) {          // another tab changed something
    if (!e.key || e.key.indexOf(NS) !== 0) return;
    var ev = KEY_EVENTS[e.key.slice(NS.length)];
    if (ev) emit(ev);
  });

  /* ---- The shop service ------------------------------------------------------------------------------------------ */
  var skew = 0;   // server clock minus this device's clock (only used when the gap is over 2 s)
  function now() { return Date.now() + skew; }
  function request(method, path, body) {
    var opts = { method: method, cache: 'no-store', headers: {} };
    if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(API + path, opts).then(function (r) {
      var d = Date.parse(r.headers.get('date') || '');
      if (d) { var s = d - Date.now(); skew = Math.abs(s) > 2000 ? s : 0; }
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : {}; } catch (e) { data = null; }
        if (!r.ok || !data) {
          var err = new Error((data && data.error) || (r.status === 429 ? 'Too many requests just now: wait a minute and try again.'
            : 'The shop is not answering just now. Try again in a moment.'));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    }, function () {
      throw new Error("Can't reach the shop right now. Check your connection and try again.");
    });
  }
  var api = {
    get: function (p) { return request('GET', p); },
    post: function (p, b) { return request('POST', p, b || {}); },
    url: function (p) { return API + p; }      // e.g. for an <img> of an order's QR code
  };
  var configP = null;
  function config() { return configP || (configP = api.get('config')); }

  /* ---- The menu (shop/catalog.json) ---------------------------------------------------------------------------- */
  var Shop = {};
  var ready = fetch(ROOT + 'shop/catalog.json', { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('The menu could not be loaded (shop/catalog.json).');
    return r.json();
  }).then(function (cat) {
    cat.stores = cat.stores || [];
    cat.categories = cat.categories || [];
    cat.items = cat.items || [];
    cat.options = cat.options || {};
    cat.coupons = cat.coupons || [];
    cat._items = {}; cat.items.forEach(function (it) { cat._items[it.id] = it; });
    cat._stores = {}; cat.stores.forEach(function (s) { cat._stores[s.id] = s; });
    Shop.catalog = cat;
    return cat;
  });
  ready.catch(function () { /* each page shows the error where it renders (Shop.fail) */ });

  function item(id) { return Shop.catalog && Shop.catalog._items[id]; }
  function group(id) { return Shop.catalog && Shop.catalog.options[id]; }
  function store(id) { return Shop.catalog && Shop.catalog._stores[id]; }

  /* ---- Money and time ------------------------------------------------------------------------------------------ */
  var moneyFmt = {};
  function money(cents) {
    var cur = (Shop.catalog && Shop.catalog.currency) || 'CAD';
    var loc = (Shop.catalog && Shop.catalog.locale) || 'en-CA';
    var k = loc + cur;
    try {
      moneyFmt[k] = moneyFmt[k] || new Intl.NumberFormat(loc, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' });
      return moneyFmt[k].format((cents || 0) / 100);
    } catch (e) { return ((cents || 0) / 100).toFixed(2) + ' ' + cur; }
  }
  function tz() { return (Shop.catalog && Shop.catalog.timezone) || 'America/Vancouver'; }
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var partsFmt = {};
  /** The wall clock in the shop's time zone: {wd: 0-6, mins: minutes since midnight, key: "YYYY-MM-DD"}. */
  function zoned(date) {
    var z = tz();
    var f = partsFmt[z] || (partsFmt[z] = new Intl.DateTimeFormat('en-US', { timeZone: z, weekday: 'short', year: 'numeric',
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
    var p = {};
    f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return { wd: DAYS.indexOf(p.weekday.slice(0, 3).toLowerCase()), mins: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10),
             key: p.year + '-' + p.month + '-' + p.day };
  }
  /** "6:30 am" from minutes since midnight. */
  function hm(mins) {
    var h = Math.floor(mins / 60) % 24, m = mins % 60;
    return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
  }
  function toMins(s) { var p = String(s || '0:0').split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10); }
  /** A time (ISO string, Date or ms) shown on the shop's clock: "7:05 pm". */
  function time(t) { return hm(zoned(new Date(t)).mins); }
  /** "Wed 18 Nov, 7:05 pm" on the shop's clock. */
  function dateTime(t) {
    try {
      return new Intl.DateTimeFormat((Shop.catalog && Shop.catalog.locale) || 'en-CA', { timeZone: tz(), weekday: 'short',
        day: 'numeric', month: 'short' }).format(new Date(t)) + ', ' + time(t);
    } catch (e) { return new Date(t).toLocaleString(); }
  }

  /* Opening hours: a store's "hours" list holds {days, open, close}; days reads like "Mon–Fri", "Sat–Sun", "Sat",
     "Mon, Wed" or "Daily". Hours past midnight are not supported (close must be after open). */
  function parseDays(s) {
    s = String(s || '').toLowerCase();
    if (/daily|every ?day|7 days|all week/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
    var out = [];
    s.split(/,|&|\band\b/).forEach(function (part) {
      var m = part.match(/([a-z]{3})[a-z]*\.?\s*(?:[–—-]|to)\s*([a-z]{3})/);
      if (m && DAYS.indexOf(m[1]) > -1 && DAYS.indexOf(m[2]) > -1) {
        for (var d = DAYS.indexOf(m[1]); ; d = (d + 1) % 7) { out.push(d); if (d === DAYS.indexOf(m[2])) break; }
      } else {
        var one = part.match(/[a-z]{3}/);
        if (one && DAYS.indexOf(one[0]) > -1) out.push(DAYS.indexOf(one[0]));
      }
    });
    return out;
  }
  function hoursOn(st, wd) {
    return (st.hours || []).filter(function (h) { return parseDays(h.days).indexOf(wd) > -1; })
      .map(function (h) { return { open: toMins(h.open), close: toMins(h.close) }; })
      .filter(function (h) { return h.close > h.open; })
      .sort(function (a, b) { return a.open - b.open; });
  }
  /** Is a store open now? {open, label, short, today: "6:30 am – 7:00 pm" | "Closed today"} */
  function storeStatus(st, at) {
    var z = zoned(new Date(at || now()));
    var today = hoursOn(st, z.wd);
    var todayText = today.length ? today.map(function (h) { return hm(h.open) + ' – ' + hm(h.close); }).join(', ') : 'Closed today';
    var cur = today.filter(function (h) { return z.mins >= h.open && z.mins < h.close; })[0];
    if (cur) {
      var soon = cur.close - z.mins <= 30;
      return { open: true, soon: soon, short: soon ? 'Closing soon' : 'Open now', label: 'Open until ' + hm(cur.close), today: todayText };
    }
    for (var k = 0; k < 8; k++) {
      var wd = (z.wd + k) % 7;
      var next = hoursOn(st, wd).filter(function (h) { return k > 0 || h.open > z.mins; })[0];
      if (next) {
        var when = k === 0 ? 'today' : k === 1 ? 'tomorrow' : DAY_NAMES[wd];
        return { open: false, short: 'Closed', label: 'Opens ' + hm(next.open) + ' ' + when, today: todayText };
      }
    }
    return { open: false, short: 'Closed', label: 'Closed', today: todayText };
  }
  /** Pickup times a store can make: every 15 minutes while it is open, from its prep time on, up to 3 days ahead. */
  function slots(st, max) {
    var step = 15 * 60000, t0 = now();
    var t = Math.ceil((t0 + ((st.prepMinutes || 5) + 5) * 60000) / step) * step;
    var todayKey = zoned(new Date(t0)).key, tomorrowKey = zoned(new Date(t0 + 86400000)).key;
    var out = [];
    for (var end = t0 + 3 * 86400000; t < end && out.length < (max || 60); t += step) {
      var z = zoned(new Date(t));
      if (!hoursOn(st, z.wd).some(function (h) { return z.mins >= h.open && z.mins <= h.close - 10; })) continue;
      out.push({ iso: new Date(t).toISOString(), time: hm(z.mins),
                 day: z.key === todayKey ? 'Today' : z.key === tomorrowKey ? 'Tomorrow' : DAY_NAMES[z.wd] });
    }
    return out;
  }

  /* ---- Cart lines: options, display estimate, summary -------------------------------------------------------- */
  function isRequired(g) { return g.required != null ? !!g.required : (g.type || 'one') === 'one'; }
  /** The choices a line ends up with, the way the service fills them (defaults for required groups). */
  function picks(line) {
    var it = item(line.item);
    if (!it) return [];
    var chosen = line.options || {}, out = [];
    (it.options || []).forEach(function (gid) {
      var g = group(gid);
      if (!g) return;
      var allowed = (it.choices && it.choices[gid]) || g.choices.map(function (c) { return c.id; });
      var p = chosen[gid];
      var list = p == null || p === '' ? [] : (Array.isArray(p) ? p : [p]);
      if (!list.length && isRequired(g)) {
        var def = g.choices.filter(function (c) { return c.default && allowed.indexOf(c.id) > -1; })[0];
        list = [def ? def.id : allowed[0]];
      }
      list.forEach(function (cid) {
        var c = g.choices.filter(function (x) { return x.id === cid; })[0];
        var priced = g.choices.some(function (x) { return (x.price || 0) !== (g.choices[0].price || 0); });
        if (c) out.push({ group: gid, groupName: g.name, choice: c.id, name: c.name, price: c.price || 0, isDefault: !!c.default,
                          first: gid === it.options[0] && priced });
      });
    });
    return out;
  }
  /** Display-only estimate {unit, total} in cents. The service's quote is what is charged. */
  function estimate(line) {
    var it = item(line.item);
    if (!it) return { unit: 0, total: 0 };
    var unit = Math.max(0, picks(line).reduce(function (s, p) { return s + p.price; }, it.price));
    return { unit: unit, total: unit * (line.qty || 1) };
  }
  /** "Large 20 oz · Oat milk · Vanilla syrup": the first group when it changes the price (usually size) and anything
      not left at its default. */
  function describe(line, all) {
    return picks(line).filter(function (p) { return all || p.first || !p.isDefault; })
      .map(function (p) { return p.name; }).join(' · ');
  }
  /** The best coupon on a single item at this price, for the menu's estimate (first-order coupons only before any order). */
  function couponEstimate(cents) {
    var best = null, first = !flag('ordered');
    ((Shop.catalog && Shop.catalog.coupons) || []).forEach(function (k) {
      if (k.firstOrderOnly && !first) return;
      if ((k.minSubtotal || 0) > cents) return;
      var off = k.type === 'percent' ? Math.floor(cents * k.value / 100) : k.value;
      off = Math.min(off, k.maxDiscount == null ? Infinity : k.maxDiscount, cents);
      if (off > 0 && (!best || off > best.amount)) best = { code: k.code, name: k.name, amount: off };
    });
    return best;
  }
  /** A cart line from an order line the service sent back (for "Reorder"). */
  function lineFromOrder(ol) {
    var options = {};
    (ol.options || []).forEach(function (o) {
      var g = group(o.group);
      if (g && g.type === 'many') (options[o.group] = options[o.group] || []).push(o.choice);
      else options[o.group] = o.choice;
    });
    return { item: ol.item, qty: ol.qty || 1, options: options, note: ol.note || '' };
  }

  /* ---- The cart (kept in this browser) -------------------------------------------------------------------------- */
  function lineKey(l) {
    var o = l.options || {}, keys = Object.keys(o).sort();
    return JSON.stringify([l.item, keys.map(function (k) { return [k, Array.isArray(o[k]) ? o[k].slice().sort() : o[k]]; }), l.note || '']);
  }
  var cart = {
    lines: function () { return local.get('cart', []); },
    save: function (lines) { local.set('cart', lines); emit('cart', lines); },
    /** Add a line {item, qty, options, note}; an identical line just gets a bigger quantity. */
    add: function (line) {
      var lines = cart.lines(), k = lineKey(line), qty = Math.max(1, Math.min(20, line.qty || 1));
      var same = lines.filter(function (l) { return lineKey(l) === k; })[0];
      if (same) same.qty = Math.min(20, same.qty + qty);
      else lines.push({ item: line.item, qty: qty, options: line.options || {}, note: line.note || '' });
      cart.save(lines);
    },
    setQty: function (i, qty) {
      var lines = cart.lines();
      if (!lines[i]) return;
      if (qty < 1) lines.splice(i, 1); else lines[i].qty = Math.min(20, qty);
      cart.save(lines);
    },
    remove: function (i) { var lines = cart.lines(); lines.splice(i, 1); cart.save(lines); },
    clear: function () { cart.save([]); },
    count: function () { return cart.lines().reduce(function (n, l) { return n + l.qty; }, 0); },
    estimate: function () { return cart.lines().reduce(function (s, l) { return s + estimate(l).total; }, 0); },
    /** Checkout calls this before sending the customer to pay; the order page empties the cart once that order is paid. */
    markPending: function (token) { local.set('pending', { token: token, key: cart.lines().map(lineKey).join('|') }); },
    settle: function (token) {
      var p = local.get('pending');
      if (!p || p.token !== token) return false;
      if (cart.lines().map(lineKey).join('|') === p.key) cart.clear();   // not if they started a new cart meanwhile
      local.del('pending');
      return true;
    }
  };

  /* ---- The customer, the chosen store and saved things -------------------------------------------------------- */
  function customer() {
    var id = local.get('customer');
    if (!id) { id = 'c_' + randomId(22); local.set('customer', id); }
    return id;
  }
  function storeId(set) {
    if (set) { local.set('store', set); emit('store', set); return set; }
    var id = local.get('store');
    if (id && store(id)) return id;
    var list = (Shop.catalog && Shop.catalog.stores) || [];
    var near = list.slice().sort(function (a, b) { return (a.distanceKm || 99) - (b.distanceKm || 99); })[0];
    return near ? near.id : null;
  }
  var orders = {
    list: function () { return local.get('orders', []); },
    tokens: function () { return orders.list().map(function (o) { return o.token; }); },
    get: function (token) { return orders.list().filter(function (o) { return o.token === token; })[0]; },
    /** Remember an order on this device (newest first, 30 at most: the service looks up 30 at a time). */
    add: function (token, info) {
      var list = orders.list().filter(function (o) { return o.token !== token; });
      list.unshift(Object.assign({ token: token, at: new Date().toISOString() }, info || {}));
      local.set('orders', list.slice(0, 30));
      emit('orders');
    },
    update: function (token, info) {
      var list = orders.list();
      list.forEach(function (o) { if (o.token === token) Object.assign(o, info); });
      local.set('orders', list);
    },
    remove: function (token) { local.set('orders', orders.list().filter(function (o) { return o.token !== token; })); emit('orders'); }
  };
  function normCode(code) {
    var c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.replace(/(.{4})(?=.)/g, '$1-');
  }
  var wallet = {
    list: function () { return local.get('wallet', []); },
    has: function (code) { code = normCode(code); return wallet.list().some(function (g) { return g.code === code; }); },
    /** Save a gift card code on this device; the newest one is offered first at checkout. */
    add: function (code, info) {
      code = normCode(code);
      var list = wallet.list().filter(function (g) { return g.code !== code; });
      list.unshift(Object.assign({ code: code, added: new Date().toISOString() }, info || {}));
      local.set('wallet', list);
      emit('wallet');
    },
    remove: function (code) { code = normCode(code); local.set('wallet', wallet.list().filter(function (g) { return g.code !== code; })); emit('wallet'); },
    normalize: normCode
  };
  var usual = {
    get: function () { var u = local.get('usual'); return u && item(u.item) ? u : null; },
    set: function (line) { local.set('usual', { item: line.item, qty: line.qty || 1, options: line.options || {}, note: line.note || '' }); emit('usual'); },
    clear: function () { local.del('usual'); emit('usual'); }
  };
  var profile = {
    get: function () { return local.get('profile', {}); },
    set: function (p) { local.set('profile', Object.assign(profile.get(), p)); }
  };
  /** Small remembered facts, e.g. flag('ordered', true) once this device has a paid order (first-order coupons). */
  function flag(name, value) {
    var f = local.get('flags', {});
    if (value === undefined) return f[name];
    f[name] = value;
    local.set('flags', f);
    return value;
  }
  /** Forget everything this shop kept on this device. */
  function forget() {
    ['cart', 'pending', 'customer', 'store', 'orders', 'wallet', 'usual', 'profile', 'flags', 'gifts'].forEach(local.del);
    emit('cart'); emit('wallet'); emit('orders');
  }

  /* ---- Icons (small inline SVG; no images) ---------------------------------------------------------------------- */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 2.5c-.6.8-.6 1.7 0 2.5M12 2.5c-.6.8-.6 1.7 0 2.5"/>',
    iced: '<path d="M6 7h12l-1.6 14H7.6z"/><path d="m13 7 2-5h3"/><path d="M7 12h10"/>',
    leaf: '<path d="M5 20c0-9 5-15 15-15 0 10-6 15-15 15z"/><path d="m5 20 8-8"/>',
    croissant: '<path d="M2.5 15.5C4.5 9.5 8.5 6 12 6s7.5 3.5 9.5 9.5c-1.8 1-3.6 1-5 0-1.2 1.2-2.8 1.8-4.5 1.8s-3.3-.6-4.5-1.8c-1.4 1-3.2 1-5 0z"/><path d="m9 7.5 1 8.5M15 7.5l-1 8.5"/>',
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7.5c0-1.2 1.2-1.6 1.2-3M12.5 7.5c0-1.2 1.2-1.6 1.2-3"/>',
    bean: '<ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(35 12 12)"/><path d="M8.6 6.6c3.2 2.6 3.6 8 6.8 10.8"/>',
    receipt: '<path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S10.5 3.5 8 4.5 9 8 12 8zm0 0s1.5-4.5 4-3.5S15 8 12 8z"/>',
    share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>',
    wallet: '<path d="M4 7h15a1 1 0 0 1 1 1v11H5a1 1 0 0 1-1-1z"/><path d="M4 7V6a2 2 0 0 1 2-2h11v3"/><circle cx="16" cy="13" r="1.2"/>',
    ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7v2M14 11v2M14 15v2"/>',
    store: '<path d="M4 9 5.5 4h13L20 9M4 9h16v1.5a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 10.5zM5 13v8h14v-8M10 21v-5h4v5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    heart: '<path d="M12 20s-7.5-4.6-9-9.2C2 7.6 4.2 5 7 5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 2.8 0 5 2.6 4 5.8-1.5 4.6-9 9.2-9 9.2z"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.cup) + '</svg>';
  }

  /* ---- Toasts (announced politely to screen readers) ------------------------------------------------------------ */
  function toast(msg, opts) {
    opts = opts || {};
    // A modal sheet sits in the top layer above everything: show the toast inside it while one is open.
    var host = document.querySelector('dialog.sheet[open]:not(.is-closing)') || document.body;
    var toastBox = host.querySelector(':scope > .toasts');
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      host.appendChild(toastBox);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (opts.tone ? ' toast--' + opts.tone : '');
    t.innerHTML = (opts.tone === 'danger' ? icon('info') : icon('check')) + '<span class="toast__msg"></span>';
    t.querySelector('.toast__msg').textContent = msg;
    if (opts.action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast__action';
      b.textContent = opts.action.label;
      b.addEventListener('click', function () { opts.action.fn(); dismiss(); });
      t.appendChild(b);
    }
    toastBox.appendChild(t);
    var timer = setTimeout(dismiss, opts.action ? 6000 : 3800);
    function dismiss() {
      clearTimeout(timer);
      t.classList.add('is-leaving');
      setTimeout(function () { t.remove(); }, 300);
    }
    return dismiss;
  }

  /* ---- Sheets: <dialog> as a bottom sheet (phones) or a centred panel / side drawer (desktop) -------------------
     showModal() makes the rest of the page inert (focus stays inside), Escape and a tap on the backdrop close it,
     and focus goes back to the button that opened it. */
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sheetN = 0;
  function sheet(opts) {
    opts = opts || {};
    var d = document.createElement('dialog');
    var id = opts.id || 'sheet-' + (++sheetN);
    d.id = id;
    d.className = 'sheet' + (opts.className ? ' ' + opts.className : '');
    d.setAttribute('aria-labelledby', id + '-title');
    d.innerHTML = '<div class="sheet__panel"><div class="sheet__head"><h2 class="sheet__title" id="' + id + '-title"></h2>' +
      '<button type="button" class="icon-btn sheet__close" data-close aria-label="Close">' + icon('close') + '</button></div>' +
      '<div class="sheet__body"></div><div class="sheet__foot" hidden></div></div>';
    d.querySelector('.sheet__title').textContent = opts.title || '';
    document.body.appendChild(d);
    d.addEventListener('cancel', function (e) { e.preventDefault(); close(); });          // Escape
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-close]')) close();                     // backdrop or a close button
    });
    d.addEventListener('close', function () {
      if (!document.querySelector('dialog.sheet[open]')) html.classList.remove('has-sheet');
      var o = d._opener;
      if (o && document.contains(o) && typeof o.focus === 'function') o.focus({ preventScroll: true });
      if (opts.onClose) opts.onClose();
    });
    function open(opener) {
      d._opener = opener || document.activeElement;
      d.classList.remove('is-closing');
      if (!d.open) d.showModal();
      html.classList.add('has-sheet');
      var first = d.querySelector('[autofocus]');
      if (first) first.focus();
    }
    function close() {
      if (!d.open || d.classList.contains('is-closing')) return;
      if (still) { d.close(); return; }
      d.classList.add('is-closing');
      setTimeout(function () {
        d.classList.remove('is-closing');
        d.close();
        if (!document.querySelector('dialog.sheet[open]')) html.classList.remove('has-sheet');
      }, 200);
    }
    return {
      el: d, open: open, close: close,
      title: d.querySelector('.sheet__title'), body: d.querySelector('.sheet__body'), foot: d.querySelector('.sheet__foot'),
      setTitle: function (t) { d.querySelector('.sheet__title').textContent = t; }
    };
  }

  /* ---- The store picker (the menu's store chip and checkout's "Change" both open it) ------------------------- */
  var picker = null;
  function openStorePicker(opener) {
    return new Promise(function (resolve) {
      if (!picker) picker = sheet({ id: 'store-picker', title: 'Choose your store' });
      var cur = storeId();
      picker.body.innerHTML = '<p class="muted sheet__lead">Your order is made at this store and waits for you on its pickup shelf.</p>' +
        '<ul class="store-list" role="list">' + Shop.catalog.stores.map(function (st) {
          var s = storeStatus(st);
          return '<li><button type="button" class="store-option" data-store="' + esc(st.id) + '" aria-pressed="' + (st.id === cur) + '">' +
            '<span class="store-option__main"><span class="store-option__name">' + esc(st.name) + '</span>' +
            '<span class="store-option__area">' + esc(st.area || '') + '</span>' +
            '<span class="store-option__meta"><span class="status-dot ' + (s.open ? 'is-open' : 'is-closed') + '">' + esc(s.short) + '</span> · ' +
            esc(s.label) + (st.prepMinutes ? ' · about ' + st.prepMinutes + ' min' : '') + '</span></span>' +
            (st.distanceKm != null ? '<span class="store-option__km">' + esc(st.distanceKm) + ' km</span>' : '') +
            '<span class="store-option__check">' + icon('check') + '</span></button></li>';
        }).join('') + '</ul>';
      picker.body.onclick = function (e) {
        var b = e.target.closest('[data-store]');
        if (!b) return;
        storeId(b.getAttribute('data-store'));
        toast('Pickup at ' + store(b.getAttribute('data-store')).name);
        picker.close();
        resolve(b.getAttribute('data-store'));
      };
      picker.open(opener);
      var current = picker.body.querySelector('[aria-pressed="true"]');
      if (current) current.focus();
    });
  }

  /* ---- An error where a screen would have rendered -------------------------------------------------------------- */
  function fail(el, err) {
    if (!el) return;
    el.innerHTML = '<div class="notice notice--danger" role="alert"><p>' + esc((err && err.message) || 'Something went wrong.') +
      '</p><button type="button" class="btn" data-retry>Try again</button></div>';
    el.querySelector('[data-retry]').addEventListener('click', function () { location.reload(); });
  }

  /* ---- The app tab bar ------------------------------------------------------------------------------------------ */
  var TABS = [
    { id: 'home', label: 'Home', path: 'index.html', icon: 'home' },
    { id: 'menu', label: 'Menu', path: 'pages/menu.html', icon: 'cup' },
    { id: 'orders', label: 'Orders', path: 'pages/order.html', icon: 'receipt' },
    { id: 'me', label: 'Me', path: 'pages/account.html', icon: 'user' }
  ];
  function tabBar() {
    if (document.body.getAttribute('data-tabbar') === 'off') return;
    var current = document.body.getAttribute('data-tab');
    if (!current) {
      var file = location.pathname.split('/').pop() || 'index.html';
      current = { 'menu.html': 'menu', 'checkout.html': 'menu', 'order.html': 'orders', 'account.html': 'me',
                  'gift-cards.html': 'me', 'gift.html': 'me' }[file] || 'home';
    }
    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', 'App');
    nav.innerHTML = TABS.map(function (t) {
      return '<a class="tabbar__item" href="' + href(t.path) + '"' + (t.id === current ? ' aria-current="page"' : '') + '>' +
        icon(t.icon) + '<span>' + t.label + '</span>' + (t.id === 'orders' ? '<span class="tabbar__dot" hidden></span>' : '') + '</a>';
    }).join('');
    document.body.appendChild(nav);
    document.body.classList.add('has-tabbar');
    var dot = nav.querySelector('.tabbar__dot');
    function refreshDot() {
      var live = orders.list().some(function (o) { return o.live && Date.now() - Date.parse(o.at) < 6 * 3600000; });
      dot.hidden = !live;
    }
    refreshDot();
    on('orders', refreshDot);
  }

  /* ---- Put it together ------------------------------------------------------------------------------------------ */
  Object.assign(Shop, {
    root: ROOT, href: href, api: api, config: config, ready: ready, item: item, group: group, store: store,
    money: money, time: time, dateTime: dateTime, now: now, storeStatus: storeStatus, slots: slots, hoursText: hm,
    picks: picks, estimate: estimate, describe: describe, couponEstimate: couponEstimate, lineFromOrder: lineFromOrder,
    cart: cart, customer: customer, storeId: storeId, orders: orders, wallet: wallet, usual: usual, profile: profile,
    flag: flag, forget: forget, on: on, emit: emit, toast: toast, sheet: sheet, openStorePicker: openStorePicker,
    icon: icon, esc: esc, qs: qs, fail: fail, local: local
  });
  window.Shop = Shop;
  tabBar();
})();
