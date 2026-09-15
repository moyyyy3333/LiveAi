/* Shared site behavior: mobile nav, year stamp, smooth-scroll anchors. */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var yearEls = document.querySelectorAll("[data-year]");
    yearEls.forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });
})();
