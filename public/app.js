/* FjaloriShqip — client script: language and theme switches, search, word of the day/hour, small helpers. */
(function () {
  "use strict";
  var BASE = document.body.getAttribute("data-base") || "";
  var html = document.documentElement;

  // ── helpers ──
  function isEn() { return html.classList.contains("en"); }
  function bi(sq, en) { return '<span data-ui="sq">' + sq + '</span><span data-ui="en">' + en + "</span>"; }
  function fold(s) {
    return s.toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").replace(/[âäà]/g, "a").replace(/[êé]/g, "e").replace(/[îí]/g, "i").replace(/[ôó]/g, "o").replace(/[ûú]/g, "u").replace(/[^a-z]/g, "");
  }
  function wordUrl(w) { return BASE + "/fjala/" + encodeURIComponent(w.replace(/ /g, "_")) + "/"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getJson(path) { return fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var toastEl = null, toastTimer = 0;
  function toast(msgHtml) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.innerHTML = msgHtml;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  // ── language switch (Albanian first, English second) ──
  // the search hint in the current language; the short form when the full sentence does not fit the box (phones)
  var measureCtx;
  function fitPlaceholders() {
    document.querySelectorAll("input[data-placeholder-en]").forEach(function (el) {
      if (!el.getAttribute("data-placeholder-sq")) el.setAttribute("data-placeholder-sq", el.getAttribute("placeholder"));
      var en = isEn();
      // longest first: full sentence, then "Kërko shqip ose anglisht…", then "Kërko një fjalë…"
      var options = [
        en ? el.getAttribute("data-placeholder-en") : el.getAttribute("data-placeholder-sq"),
        el.getAttribute(en ? "data-placeholder-short-en" : "data-placeholder-short"),
        el.getAttribute(en ? "data-placeholder-tiny-en" : "data-placeholder-tiny"),
      ].filter(Boolean);
      var text = options[0];
      var width = el.clientWidth;
      if (width > 0) {
        measureCtx = measureCtx || document.createElement("canvas").getContext("2d");
        measureCtx.font = getComputedStyle(el).font;
        for (var i = 0; i < options.length; i++) {
          text = options[i];
          if (measureCtx.measureText(text).width <= width - 4) break;
        }
      }
      if (el.getAttribute("placeholder") !== text) el.setAttribute("placeholder", text);
    });
  }
  var fitTimer;
  function refit() { clearTimeout(fitTimer); fitTimer = setTimeout(fitPlaceholders, 60); }
  window.addEventListener("resize", refit);
  // on phones the ë/ç keys appear while typing, which changes the room for the hint
  document.addEventListener("focusin", refit);
  document.addEventListener("focusout", refit);
  function applyLang() {
    fitPlaceholders();
    html.setAttribute("lang", isEn() ? "en" : "sq");
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-lang") === "en") === isEn()));
    });
  }
  document.querySelectorAll(".lang-switch button").forEach(function (b) {
    b.addEventListener("click", function () {
      html.classList.toggle("en", b.getAttribute("data-lang") === "en");
      store("fs-lang", isEn() ? "en" : "sq");
      applyLang();
      renderFeatures();
    });
  });
  applyLang();

  // ── theme switch (follows the system until the visitor chooses) ──
  function isDark() {
    var t = html.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.querySelectorAll(".theme-toggle").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      html.setAttribute("data-theme", next);
      store("fs-theme", next);
    });
  });

  // ── mobile menu ──
  var menuBtn = document.querySelector(".menu-toggle");
  var nav = document.getElementById("main-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.target) && !menuBtn.contains(e.target)) {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ── search ──
  var indexPromise = null;
  function loadIndex() { return indexPromise || (indexPromise = getJson("/api/v1/kerko.json")); }
  var shardCache = {};
  function loadShard(c) { return shardCache[c] || (shardCache[c] = getJson("/api/v1/format/" + c + ".json").catch(function () { return {}; })); }

  /** Same as normEnglish() in scripts/build-site.ts: "to work (hard)" → "work". */
  function normEnglish(s) {
    return s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/^\s*(to|a|an|the)\s+/, "").replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim();
  }

  /**
   * Rank: Albanian word > English translation (the meaning IS the query) > Albanian prefix
   * > English meaning that only mentions the query > contains. Returns [{ row, direct }].
   */
  function searchIndex(index, q) {
    var k = fold(q);
    var ql = q.toLowerCase().trim();
    if (!k && !ql) return [];
    var eng = ql.replace(/[^a-z ]/g, "");
    var en = normEnglish(q);
    var key = "|" + en + "|";
    var re = eng.length >= 3 ? new RegExp("(^|[^a-z])" + eng + "([^a-z]|$)") : null;
    var res = [];
    for (var i = 0; i < index.length; i++) {
      var row = index[i]; // [word, fold, pos, gloss, Wikipedia count, English keys (1st meaning), English keys (others)]
      var score = 0;
      var direct = false;
      // same letters as typed (ë/ç ignored): the exact spelling first, then the more common word (nene → nënë before nenë)
      if (row[1] === k) score = 100 - (row[0].toLowerCase() === ql ? 0 : 1) + Math.min(0.9, Math.log(1 + (row[4] || 0)) / Math.LN10 / 10);
      else if (en.length >= 2 && row[5] && ("|" + row[5] + "|").indexOf(key) >= 0) { score = 86; direct = true; }
      else if (en.length >= 2 && row[6] && ("|" + row[6] + "|").indexOf(key) >= 0) { score = 80; direct = true; }
      else if (k && row[1].indexOf(k) === 0) score = 60 - Math.min(20, row[1].length - k.length);
      else if (re && re.test(row[3].toLowerCase())) score = 35 - Math.min(15, row[3].length / 10);
      else if (k.length >= 3 && row[1].indexOf(k) > 0) score = 15;
      // common words and words with a meaning first (at most +12: never above an exact Albanian match)
      if (score && score < 99) score += Math.min(8, Math.log(1 + (row[4] || 0)) / Math.LN10 * 2) + (row[3] ? 4 : 0);
      // Albanian words before borrowed ones with the same meaning (abuse: shpërdoroj before abuzoj)
      if (score && score < 99 && row[7]) score -= 5;
      if (score) res.push([score, row, direct]);
    }
    res.sort(function (a, b) { return b[0] - a[0] || a[1][0].length - b[1][0].length; });
    return res.map(function (r) { return { row: r[1], direct: r[2] }; });
  }

  function formMatches(q) {
    var k = fold(q);
    if (!k) return Promise.resolve([]);
    return loadShard(k[0]).then(function (shard) { return shard[k] || []; });
  }

  /**
   * Headword rows for a query: the word itself first ("nene" → nënë), then the words it is a form of
   * ("punova" → punoj; "nene" is also a form of ëmë), then the other index matches.
   */
  function lookup(q, limit) {
    return Promise.all([loadIndex(), formMatches(q)]).then(function (r) {
      var index = r[0], forms = r[1], seen = {}, out = [];
      var k = fold(q);
      var found = searchIndex(index, q);
      function add(row, form, direct) { if (row && !seen[row[0]]) { seen[row[0]] = 1; out.push({ row: row, form: form, direct: direct }); } }
      found.forEach(function (x) { if (x.row[1] === k) add(x.row, false, x.direct); });
      var byWord = null;
      if (forms.length) { byWord = {}; for (var i = 0; i < index.length; i++) byWord[index[i][0]] = index[i]; }
      forms.forEach(function (w) { add(byWord[w], true, false); });
      found.forEach(function (x) { if (out.length < limit) add(x.row, false, x.direct); });
      return out.slice(0, limit);
    });
  }

  document.querySelectorAll("form.search").forEach(function (form) {
    var input = form.querySelector("input");
    var list = form.querySelector(".suggestions");
    var active = -1;
    var current = [];
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
    function update() {
      var q = input.value;
      if (q.trim().length < 1) { close(); return; }
      lookup(q, 8).then(function (rows) {
        if (input.value !== q) return;
        current = rows;
        active = -1;
        list.innerHTML = rows.map(function (x, i) {
          var r = x.row;
          return '<li role="option" data-i="' + i + '"><a href="' + wordUrl(r[0]) + '"><b>' + esc(r[0]) + "</b><small>" + esc(r[2]) + (x.form ? " · " + bi("formë e kërkuar", "matching form") : "") + (x.direct ? ' · <span class="direct-tag">' + bi("përkthim", "translation") + "</span>" : "") + (r[7] ? ' · <span class="loan-tag">' + bi("huazim", "borrowed") + "</span>" : "") + "</small><span>" + (!isEn() && r[8] ? esc(r[8]) : r[3] ? esc(r[3]) : '<i class="no-meaning">' + bi("ende pa kuptim", "no meaning yet") + "</i>") + "</span></a></li>";
        }).join("") + (rows.length ? '<li class="sugg-foot"><a href="' + BASE + "/kerko/?q=" + encodeURIComponent(q.trim()) + '">' + bi("Shiko të gjitha rezultatet për", "See all results for") + " “" + esc(q.trim()) + "” →</a></li>" : "");
        list.hidden = rows.length === 0;
        input.setAttribute("aria-expanded", String(!list.hidden));
      });
    }
    input.addEventListener("focus", loadIndex, { once: true });
    input.addEventListener("input", update);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(); return; }
      if (list.hidden) return;
      var items = list.querySelectorAll("li[role=option]");
      if (!items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, i) { li.classList.toggle("active", i === active); });
        items[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        location.href = wordUrl(current[active].row[0]);
      }
    });
    document.addEventListener("click", function (e) { if (!form.contains(e.target)) close(); });

    // ë / ç buttons insert at the cursor
    form.querySelectorAll("[data-insert]").forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); }); // keep focus in the input
      b.addEventListener("click", function () {
        var ch = b.getAttribute("data-insert");
        var s = input.selectionStart == null ? input.value.length : input.selectionStart;
        var en = input.selectionEnd == null ? s : input.selectionEnd;
        input.value = input.value.slice(0, s) + ch + input.value.slice(en);
        input.focus();
        input.setSelectionRange(s + 1, s + 1);
        update();
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) { input.focus(); return; }
      loadIndex().then(function (index) {
        var exact = index.filter(function (r) { return r[0].toLowerCase() === q.toLowerCase(); })[0];
        location.href = exact ? wordUrl(exact[0]) : BASE + "/kerko/?q=" + encodeURIComponent(q);
      });
    });
  });

  // "/" focuses the search box from anywhere
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var input = document.querySelector("form.search input");
    if (input) { e.preventDefault(); input.focus(); input.select(); }
  });

  // ── search results page ──
  var results = document.querySelector(".search-results");
  if (results) {
    var q = (new URLSearchParams(location.search).get("q") || "").trim();
    var title = document.querySelector(".search-title");
    var box = document.querySelector("form.search input");
    if (box) { box.value = q; if (!q) box.focus(); }
    if (q) {
      lookup(q, 120).then(function (rows) {
        title.innerHTML = rows.length
          ? bi("Rezultatet për", "Results for") + " “" + esc(q) + '”<span class="search-count">' + rows.length + (rows.length >= 120 ? "+" : "") + "</span>"
          : bi("Asnjë rezultat për", "No results for") + " “" + esc(q) + "”";
        var card = function (x) {
          var r = x.row;
          return '<li><a href="' + wordUrl(r[0]) + '"><span class="wc-word" lang="sq">' + esc(r[0]) +
            (x.form ? '<span class="wc-form">' + bi("formë e kërkuar", "matching form") + "</span>" : "") +
            '</span><span class="wc-pos">' + esc(r[2]) + (r[7] ? ' <span class="loan-tag">· ' + bi("huazim", "borrowed") + "</span>" : "") + '</span><span class="wc-gloss">' + (!isEn() && r[8] ? esc(r[8]) : r[3] ? esc(r[3]) : '<i class="no-meaning">' + bi("ende pa kuptim", "no meaning yet") + "</i>") +
            // "food" is another meaning of this word (bukë: bread; also food)
            (x.direct && ("|" + r[5] + "|").indexOf("|" + normEnglish(q) + "|") < 0 ? ' · <b class="also">' + bi("edhe", "also") + " “" + esc(q) + "”</b>" : "") + "</span></a></li>";
        };
        // English query: the Albanian words for it first, then words whose meaning only mentions it
        var direct = rows.filter(function (x) { return x.direct; });
        var rest = rows.filter(function (x) { return !x.direct; });
        results.innerHTML = direct.length
          ? '<h2 class="results-sub">“' + esc(q) + "” " + bi("në shqip", "in Albanian") + '</h2><ul class="word-grid direct">' + direct.map(card).join("") + "</ul>" +
            (rest.length ? '<h2 class="results-sub">' + bi("Fjalë të lidhura", "Related words") + ' <small class="muted">' + bi("kuptimi i tyre përmend", "their meaning mentions") + " “" + esc(q) + "”</small></h2>" + '<ul class="word-grid">' + rest.map(card).join("") + "</ul>" : "")
          : '<ul class="word-grid">' + rows.map(card).join("") + "</ul>";
        if (!rows.length) {
          results.outerHTML = '<p class="empty">' + bi("Provoni një drejtshkrim tjetër, një fjalë anglisht ose shfletoni sipas shkronjës.", "Try another spelling, an English word, or browse by letter.") +
            ' <a href="' + BASE + '/shkronja/a/">' + bi("Shfleto", "Browse") + " →</a></p>";
        }
      });
    }
  }

  // ── word of the day / hour, Gheg ↔ standard ──
  var featured = null;
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var MONTHS_SQ = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
  var MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function renderFeatures() {
    var cards = document.querySelectorAll("[data-feature]");
    if (!cards.length) return;
    (featured ? Promise.resolve(featured) : getJson("/api/v1/te-zgjedhura.json").then(function (f) { featured = f; return f; })).then(function (list) {
      var d = new Date();
      var day = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      var withGheg = list.filter(function (w) { return w[4] && w[4] !== w[0]; });
      cards.forEach(function (card) {
        var kind = card.getAttribute("data-feature");
        var body = card.querySelector(".card-body");
        // [word, posSq, posEn, gloss, gheg, example, exampleEn, ipa, Albanian description]
        if (kind === "dialect") {
          if (!withGheg.length) { card.hidden = true; return; }
          var g = withGheg[hash("gheg:" + day + "T" + pad(d.getHours())) % withGheg.length];
          body.innerHTML =
            '<div class="dialect-pair"><div class="side gheg"><small>' + bi("Gegërisht", "Gheg") + "</small><b>" + esc(g[4]) + '</b></div><span class="arrow">⇄</span>' +
            '<div class="side std"><small>' + bi("Standard", "Standard") + '</small><a href="' + wordUrl(g[0]) + '">' + esc(g[0]) + "</a></div></div>" +
            '<p class="feature-gloss"><span class="lang-badge">EN</span>' + esc(g[3]) + "</p>" +
            '<a class="feature-more" href="' + wordUrl(g[0]) + '">' + bi("Shiko fjalën", "See the word") + " →</a>";
          return;
        }
        var key = kind === "day" ? "day:" + day : "hour:" + day + "T" + pad(d.getHours());
        var w = list[hash(key) % list.length];
        if (kind === "day") {
          var t = card.querySelector(".feature-date");
          if (t) { t.setAttribute("datetime", day); t.textContent = isEn() ? MONTHS_EN[d.getMonth()] + " " + d.getDate() : d.getDate() + " " + MONTHS_SQ[d.getMonth()]; }
        }
        body.innerHTML =
          '<a class="feature-word" lang="sq" href="' + wordUrl(w[0]) + '">' + esc(w[0]) + "</a>" +
          '<div class="feature-meta"><span class="pos-pill">' + esc(isEn() ? w[2] : w[1]) + "</span>" +
          (w[7] ? '<span class="ipa">' + esc(w[7]) + "</span>" : "") +
          (w[4] && w[4] !== w[0] ? '<span><span class="dialect-dot gheg"></span>' + bi("gegërisht", "Gheg") + " <b>" + esc(w[4]) + "</b></span>" : "") + "</div>" +
          (w[8] ? '<p class="feature-desc"><span class="lang-badge sq">SQ</span>' + esc(w[8]) + "</p>" : "") +
          '<p class="feature-gloss"><span class="lang-badge">EN</span>' + esc(w[3]) + "</p>" +
          (kind === "day" && w[5] ? '<p class="feature-example">' + esc(w[5]) + (w[6] ? "<small>" + esc(w[6]) + "</small>" : "") + "</p>" : "") +
          '<a class="feature-more" href="' + wordUrl(w[0]) + '">' + bi("Mëso më shumë", "Learn more") + " →</a>";
      });
    }).catch(function () {
      cards.forEach(function (card) { card.querySelector(".card-body").innerHTML = '<p class="muted">' + bi("Nuk u ngarkua.", "Could not load.") + "</p>"; });
    });
  }
  renderFeatures();

  // ── random word ──
  document.querySelectorAll(".random-word").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      getJson("/api/v1/te-zgjedhura.json").then(function (list) { location.href = wordUrl(list[Math.floor(Math.random() * list.length)][0]); });
    });
  });

  // ── copy the word ──
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      var done = function () {
        b.classList.add("done");
        toast(bi("U kopjua", "Copied") + ": " + esc(text));
        setTimeout(function () { b.classList.remove("done"); }, 1500);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });
  // ── dialect pages: filter the list of forms as you type ──
  document.querySelectorAll("input[data-filter-list]").forEach(function (input) {
    var list = document.getElementById(input.getAttribute("data-filter-list"));
    if (!list) return;
    var items = Array.prototype.slice.call(list.children);
    var count = document.querySelector("[data-count-for=\"" + list.id + "\"]");
    var empty = document.querySelector(".dialect-empty");
    input.addEventListener("input", function () {
      var q = fold(input.value);
      var shown = 0;
      items.forEach(function (li) {
        var match = !q || (li.getAttribute("data-key") || "").indexOf(q) >= 0;
        li.hidden = !match;
        if (match) shown++;
      });
      if (count) count.textContent = shown.toLocaleString("de-DE");
      if (empty) empty.hidden = shown > 0;
    });
  });

  // ── contact form (Rreth nesh): sent to /kontakt, the address stays on the server ──
  document.querySelectorAll("form[data-contact]").forEach(function (form) {
    var status = form.querySelector(".contact-status");
    var stamp = form.querySelector("input[name=t]");
    if (stamp) stamp.value = String(Date.now());
    function show(ok, sq, en) { status.className = "contact-status " + (ok ? "ok" : "err"); status.innerHTML = bi(sq, en); }
    var params = new URLSearchParams(location.search);
    if (params.get("kontakt") === "ok") show(true, "Faleminderit! Mesazhi u dërgua.", "Thank you! Your message was sent.");
    if (params.get("kontakt") === "gabim") show(false, "Mesazhi nuk u dërgua. Provoni përsëri.", "The message was not sent. Please try again.");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = form.querySelector("button");
      button.disabled = true;
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (r) {
          if (r.ok) { form.reset(); if (stamp) stamp.value = String(Date.now()); show(true, "Faleminderit! Mesazhi u dërgua.", "Thank you! Your message was sent."); }
          else if (r.error === "email") show(false, "Kontrolloni adresën e email-it.", "Please check your email address.");
          else if (r.error === "message") show(false, "Mesazhi duhet të ketë të paktën 5 shkronja.", "The message needs at least 5 characters.");
          else if (r.error === "too-fast") show(false, "Prisni pak sekonda dhe provoni përsëri.", "Please wait a few seconds and try again.");
          else show(false, "Mesazhi nuk u dërgua. Provoni përsëri më vonë.", "The message was not sent. Please try again later.");
        })
        .catch(function () { show(false, "Mesazhi nuk u dërgua. Provoni përsëri më vonë.", "The message was not sent. Please try again later."); })
        .then(function () { button.disabled = false; });
    });
  });
})();
