/* =====================================================================================================================
   tools.js: the site's "real things". Owner: Full-Stack.

   CULTURE.md rule 10: every site has 2-4 working features the real business would put on its website, chosen from
   the brief (a bakery's custom cake order form, a clinic's appointment calendar, a gym's class timetable, a trade's
   quote calculator...). Build them here. Each one:
     - is a self-contained block below, started only when its container is on the page (so one file serves every page);
     - has real labelled fields, validation and a friendly confirmation; works by keyboard and on a phone;
     - is styled only with css/tokens.css variables (add its CSS to the page or ask UI/UX for layout classes);
     - keeps entries in this browser (localStorage) or downloads them as a file (.ics, .txt), and says so;
     - places sample data relative to today and labels it as sample, so nothing ever looks out of date.

   Pattern for a new tool:

     (function bookingForm() {
       var root = document.querySelector('[data-tool="booking"]');
       if (!root) return;                       // not on this page
       // ... build or enhance the form inside root ...
     })();

   This file is linked with defer on the pages that use a tool, after js/app.js.
   ===================================================================================================================== */
(function () {
  'use strict';
  // Tools go here.
})();
