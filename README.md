# Hearth & Crumb Bakery

An order-ahead bakery site built by the Orchestrate Solutions demo team: pick a bakery, order pastries, bread, savoury
bakes and drinks with their options, pay with a test card, get a pickup number and QR code, follow the order live.
Static HTML, CSS and JavaScript; payments, pickup numbers, QR codes and gift cards come from Orchestrate's shop
service at `api/shop/`.

**Demo shop: test payments only. No real money moves.**

## Pages
`index.html` home · `pages/about.html` · `pages/visit.html` · `pages/menu.html` · `pages/checkout.html` ·
`pages/order.html` · `pages/counter.html` (staff) · `pages/board.html` (now serving) · `pages/gift-cards.html` ·
`pages/gift.html` · `pages/account.html`

## Shared code
`js/shop/core.js` exposes `window.Shop` (API client, menu loader, cart, customer id, money, toasts, sheets).
`css/shop/core.css` has buttons, chips, steppers, sheets and the phone tab bar. The menu is `shop/catalog.json`;
prices are only ever calculated by the service.
