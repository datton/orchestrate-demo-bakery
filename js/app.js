/* Page behaviour (Full-Stack owns this file) */
(function () {
  'use strict';

  // Show whether the bakery is open right now, using the visitor's local clock.
  var status = document.getElementById('open-status');
  var rows = document.querySelectorAll('.hours-table tbody tr');
  if (!status || !rows.length) return;

  var now = new Date();
  var day = now.getDay();
  var hour = now.getHours() + now.getMinutes() / 60;
  var open = false;

  rows.forEach(function (row) {
    var days = row.getAttribute('data-days').split(',').map(Number);
    var isToday = days.indexOf(day) !== -1;
    if (!isToday) return;
    row.classList.add('today');
    row.setAttribute('aria-current', 'date');
    open = hour >= Number(row.getAttribute('data-open')) && hour < Number(row.getAttribute('data-close'));
  });

  status.textContent = open
    ? 'We are open now (based on your local time).'
    : 'We are closed right now (based on your local time).';
})();
