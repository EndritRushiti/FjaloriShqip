// Loaded only by the 404 page. A word address with no page of its own (an inflected or dialect form, a word
// merged into another, or the wrong case) is sent to the page it belongs to, using the same table of forms as
// the search box. The main domain is served straight from the bucket, so this cannot be done in the Worker.
(function () {
  "use strict";
  var match = /^\/fjala\/([^/]+)\/?$/.exec(location.pathname);
  if (!match) return;
  var word;
  try {
    word = decodeURIComponent(match[1]);
  } catch (e) {
    return;
  }
  // must match foldKey() in src/data/model.ts
  function fold(s) {
    return s.toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").replace(/[âäà]/g, "a").replace(/[êé]/g, "e")
      .replace(/[îí]/g, "i").replace(/[ôó]/g, "o").replace(/[ûú]/g, "u").replace(/[^a-z]/g, "");
  }
  function wordPage(w) { return "/fjala/" + encodeURIComponent(w.replace(/ /g, "_")) + "/"; }
  function viaForms() {
    var key = fold(word.replace(/_/g, " "));
    if (!key) return;
    fetch("/api/v1/format/" + key[0] + ".json")
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (forms) {
        var list = Object.prototype.hasOwnProperty.call(forms, key) ? forms[key] : null;
        if (!list || !list.length) return;
        location.replace(list.length === 1 ? wordPage(list[0]) : "/kerko/?q=" + encodeURIComponent(word));
      })
      .catch(function () {});
  }
  var lower = word.toLowerCase();
  if (lower === word) return viaForms();
  fetch(wordPage(lower), { method: "HEAD" })
    .then(function (r) { if (r.ok) location.replace(wordPage(lower)); else viaForms(); })
    .catch(viaForms);
})();
