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
  function applyLang() {
    document.querySelectorAll("input[data-placeholder-en]").forEach(function (el) {
      if (!el.getAttribute("data-placeholder-sq")) el.setAttribute("data-placeholder-sq", el.getAttribute("placeholder"));
      el.setAttribute("placeholder", isEn() ? el.getAttribute("data-placeholder-en") : el.getAttribute("data-placeholder-sq"));
    });
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

  /** Rank: exact > Albanian prefix > English meaning word match > contains. */
  function searchIndex(index, q) {
    var k = fold(q);
    var ql = q.toLowerCase().trim();
    if (!k && !ql) return [];
    var eng = ql.replace(/[^a-z ]/g, "");
    var re = eng.length >= 3 ? new RegExp("(^|[^a-z])" + eng + "([^a-z]|$)") : null;
    var res = [];
    for (var i = 0; i < index.length; i++) {
      var row = index[i]; // [word, fold, pos, gloss, Wikipedia count]
      var score = 0;
      if (row[1] === k) score = 100 - (row[0].toLowerCase() === ql ? 0 : 1);
      else if (k && row[1].indexOf(k) === 0) score = 60 - Math.min(20, row[1].length - k.length);
      else if (re && re.test(row[3].toLowerCase())) score = 35 - Math.min(15, row[3].length / 10);
      else if (k.length >= 3 && row[1].indexOf(k) > 0) score = 15;
      // common words and words with a meaning first
      if (score && score < 99) score += Math.min(8, Math.log(1 + (row[4] || 0)) / Math.LN10 * 2) + (row[3] ? 4 : 0);
      if (score) res.push([score, row]);
    }
    res.sort(function (a, b) { return b[0] - a[0] || a[1][0].length - b[1][0].length; });
    return res.map(function (r) { return r[1]; });
  }

  function formMatches(q) {
    var k = fold(q);
    if (!k) return Promise.resolve([]);
    return loadShard(k[0]).then(function (shard) { return shard[k] || []; });
  }

  /** Headword rows for a query: inflected/dialect forms first ("punova" → punoj), then index matches. */
  function lookup(q, limit) {
    return Promise.all([loadIndex(), formMatches(q)]).then(function (r) {
      var index = r[0], forms = r[1], seen = {}, out = [];
      var byWord = null;
      if (forms.length) { byWord = {}; for (var i = 0; i < index.length; i++) byWord[index[i][0]] = index[i]; }
      forms.forEach(function (w) { var row = byWord[w]; if (row && !seen[w]) { seen[w] = 1; out.push({ row: row, form: true }); } });
      searchIndex(index, q).forEach(function (row) { if (!seen[row[0]] && out.length < limit) { seen[row[0]] = 1; out.push({ row: row, form: false }); } });
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
          return '<li role="option" data-i="' + i + '"><a href="' + wordUrl(r[0]) + '"><b>' + esc(r[0]) + "</b><small>" + esc(r[2]) + (x.form ? " · " + bi("formë e kërkuar", "matching form") : "") + "</small><span>" + (r[3] ? esc(r[3]) : '<i class="no-meaning">' + bi("ende pa kuptim", "no meaning yet") + "</i>") + "</span></a></li>";
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
        results.innerHTML = rows.map(function (x) {
          var r = x.row;
          return '<li><a href="' + wordUrl(r[0]) + '"><span class="wc-word" lang="sq">' + esc(r[0]) +
            (x.form ? '<span class="wc-form">' + bi("formë e kërkuar", "matching form") + "</span>" : "") +
            '</span><span class="wc-pos">' + esc(r[2]) + '</span><span class="wc-gloss">' + (r[3] ? esc(r[3]) : '<i class="no-meaning">' + bi("ende pa kuptim", "no meaning yet") + "</i>") + "</span></a></li>";
        }).join("");
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
        // [word, posSq, posEn, gloss, gheg, example, exampleEn, ipa]
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
})();
