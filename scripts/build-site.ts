/**
 * Generates the static website and the static JSON API into ./dist.
 *   npm run build
 * Everything is plain HTML/CSS/JS so it can be hosted for free (GitHub Pages).
 */
import fs from "node:fs";
import path from "node:path";
import type { Entry, Sense, Word } from "../src/data/model.js";
import { ALPHABET, firstLetter, foldKey, POS_EN, POS_SQ } from "../src/data/model.js";
import { SOURCES, type SourceId } from "../src/data/sources.js";
import { bi, escapeHtml as h, t } from "../src/site/i18n.js";
import { icon } from "../src/site/icons.js";
import { formsHtml } from "../src/site/tables.js";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.BASE_PATH ?? "").replace(/\/$/, ""); // e.g. "/fjalorishqip" on GitHub Pages project sites
const SITE_URL = process.env.SITE_URL ?? "";
const PAGE_SIZE = 400;
const NOINDEX = process.env.NOINDEX === "1"; // test hosting: keep out of search engines

const words: Word[] = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fjalori.json"), "utf8"));
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stats.json"), "utf8"));
const byWord = new Map(words.map((w) => [w.word, w]));
const position = new Map(words.map((w, i) => [w.word, i])); // words are in Albanian alphabetical order
const letterCounts = new Map(ALPHABET.map((l) => [l, 0]));
for (const w of words) letterCounts.set(firstLetter(w.word), (letterCounts.get(firstLetter(w.word)) ?? 0) + 1);

const url = (p: string) => `${BASE}${p}`;
export const slug = (w: string) => w.replace(/ /g, "_");
const wordUrl = (w: string) => url(`/fjala/${encodeURIComponent(slug(w))}/`);
const letterUrl = (l: string) => url(`/shkronja/${encodeURIComponent(l)}/`);
const num = (n: number) => n.toLocaleString("de-DE");

function write(rel: string, content: string): void {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// ── layout ───────────────────────────────────────────────────────────────────
const NAV: [string, string, Parameters<typeof t>[0]][] = [
  ["browse", "/shkronja/a/", "browse"],
  ["api", "/api/", "api"],
  ["sources", "/burimet/", "sources"],
  ["about", "/rreth/", "about"],
];

function layout(opts: { title: string; description: string; body: string; active?: string; canonical?: string; headerSearch?: boolean }): string {
  const headerSearch = opts.headerSearch ?? true;
  return `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(opts.title)}</title>
<meta name="description" content="${h(opts.description)}">
<meta name="theme-color" content="#c8102e">
${NOINDEX ? `<meta name="robots" content="noindex">` : ""}
<meta property="og:title" content="${h(opts.title)}">
<meta property="og:description" content="${h(opts.description)}">
${opts.canonical && SITE_URL ? `<link rel="canonical" href="${h(SITE_URL + url(opts.canonical))}">` : ""}
<link rel="icon" href="${url("/favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${url("/style.css")}">
<script>try{if(localStorage.getItem("fs-lang")==="en")document.documentElement.classList.add("en");var th=localStorage.getItem("fs-theme");if(th)document.documentElement.setAttribute("data-theme",th)}catch(e){}</script>
</head>
<body data-base="${h(BASE)}">
<a class="skip-link" href="#main">${bi("Kalo te përmbajtja", "Skip to content")}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="${url("/")}" aria-label="FjaloriShqip"><span class="logo-mark" aria-hidden="true">F</span><span class="logo-text">Fjalori<b>Shqip</b></span></a>
    ${headerSearch ? `<div class="header-search">${searchBox({ size: "small" })}</div>` : `<div class="header-spacer"></div>`}
    <nav class="main-nav" id="main-nav" aria-label="${h("Menyja")}">
      ${NAV.map(([k, href, key]) => `<a href="${url(href)}"${opts.active === k ? ' aria-current="page"' : ""}>${t(key)}</a>`).join("")}
    </nav>
    <div class="header-actions">
      <div class="lang-switch" role="group" aria-label="Gjuha / Language">
        <button type="button" data-lang="sq" title="Shqip">SQ</button><button type="button" data-lang="en" title="English">EN</button>
      </div>
      <button type="button" class="icon-btn theme-toggle" aria-label="${h("Ndrysho temën / Toggle theme")}"><span class="when-light">${icon.moon(18)}</span><span class="when-dark">${icon.sun(18)}</span></button>
      <button type="button" class="icon-btn menu-toggle" aria-controls="main-nav" aria-expanded="false" aria-label="Menu">${icon.menu(20)}</button>
    </div>
  </div>
</header>
<main id="main" class="wrap" tabindex="-1">${opts.body}</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="logo" href="${url("/")}"><span class="logo-mark" aria-hidden="true">F</span><span class="logo-text">Fjalori<b>Shqip</b></span></a>
      <p>${t("tagline")}. ${bi("Falas, i hapur dhe pa llogari.", "Free, open and without accounts.")}</p>
    </div>
    <div>
      <h2>${bi("Fjalori", "Dictionary")}</h2>
      <ul>
        <li><a href="${url("/")}">${t("home")}</a></li>
        <li><a href="${url("/shkronja/a/")}">${bi("Shfleto sipas shkronjës", "Browse by letter")}</a></li>
        <li><a href="#" class="random-word">${t("randomWord")}</a></li>
      </ul>
    </div>
    <div>
      <h2>${bi("Zhvilluesit", "Developers")}</h2>
      <ul>
        <li><a href="${url("/api/")}">API</a></li>
      </ul>
    </div>
    <div>
      <h2>${bi("Projekti", "Project")}</h2>
      <ul>
        <li><a href="${url("/burimet/")}">${bi("Burimet dhe licencat", "Sources and licences")}</a></li>
        <li><a href="${url("/rreth/")}">${t("about")}</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <p>${t("licenceNote")}</p>
    <p>${bi("Ndërtuar vetëm nga burime të hapura: Wiktionary, Wikidata, Wikifjalor.", "Built only from open sources: Wiktionary, Wikidata, Wikifjalor.")}</p>
  </div>
</footer>
<script src="${url("/app.js")}" defer></script>
</body>
</html>`;
}

const TRY_WORDS = ["punoj", "zemër", "nënë", "shtëpi", "dashuri", "mal", "flas"];

function searchBox(opts: { size: "small" | "big"; chips?: boolean } = { size: "big" }): string {
  const big = opts.size === "big";
  const chips = opts.chips
    ? `<p class="try">${bi("Provoni:", "Try:")} ${TRY_WORDS.filter((w) => byWord.has(w))
        .map((w) => `<a class="chip" href="${wordUrl(w)}">${h(w)}</a>`)
        .join("")}</p>`
    : "";
  return `<form class="search search-${opts.size}" role="search" action="${url("/kerko/")}">
  <div class="search-field">
    <span class="search-icon">${icon.search(big ? 22 : 18)}</span>
    <input type="search" name="q" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Kërko / Search" aria-autocomplete="list" placeholder="${h("Kërko një fjalë shqip ose anglisht…")}" data-placeholder-en="${h("Search an Albanian or English word…")}">
    <span class="letter-keys" aria-label="${h("Shkronja shqipe")}"><button type="button" class="key" data-insert="ë" tabindex="-1">ë</button><button type="button" class="key" data-insert="ç" tabindex="-1">ç</button></span>
    ${big ? `<button type="submit" class="search-submit">${bi("Kërko", "Search")}</button>` : `<kbd class="slash-hint" title="${h("Shtypni / për të kërkuar")}">/</kbd>`}
  </div>
  <ul class="suggestions" role="listbox" hidden></ul>
</form>${chips}`;
}

function breadcrumbs(items: [string, string | null][]): string {
  return `<nav class="breadcrumbs" aria-label="${h("Rruga")}"><ol>${items
    .map(([label, href]) => (href ? `<li><a href="${href}">${label}</a></li>` : `<li aria-current="page">${label}</li>`))
    .join("")}</ol></nav>`;
}

function pageHead(title: string, lead?: string, kicker?: string): string {
  return `<header class="page-head">${kicker ? `<p class="kicker">${kicker}</p>` : ""}<h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</header>`;
}

// ── word pages ───────────────────────────────────────────────────────────────
function senseHtml(s: Sense): string {
  const tags = s.tags?.length ? `<span class="tags">${s.tags.map((x) => `<span class="tag">${h(x)}</span>`).join("")}</span>` : "";
  const label = s.lang === "en" ? `<span class="lang-badge" title="English">EN</span>` : `<span class="lang-badge sq" title="Shqip">SQ</span>`;
  const ex = s.examples?.length
    ? `<ul class="examples">${s.examples.map((e) => `<li><span class="ex-sq" lang="sq">${h(e.text)}</span>${e.english ? `<span class="ex-en">${h(e.english)}</span>` : ""}</li>`).join("")}</ul>`
    : "";
  return `<li><div class="sense-line">${label}${tags}<span class="gloss">${h(s.gloss)}</span></div>${ex}</li>`;
}

const genderLabel = (g: Entry["gender"]) => (g === "m" ? bi("mashkullore", "masculine") : g === "f" ? bi("femërore", "feminine") : bi("asnjanëse", "neuter"));

function entryHtml(e: Entry): string {
  const senses = e.senses.length ? `<ol class="senses">${e.senses.map(senseHtml).join("")}</ol>` : `<p class="muted">${t("noMeaningYet")}</p>`;
  const forms = formsHtml(e);
  const etym = e.etymology ? `<details class="etym"><summary>${t("etymology")}</summary><p>${h(e.etymology)}</p></details>` : "";
  return `<section class="entry card">
  <header class="entry-head">
    <span class="pos-pill">${bi(POS_SQ[e.pos], POS_EN[e.pos])}</span>
    ${e.gender ? `<span class="gender">${genderLabel(e.gender)}</span>` : ""}
    ${e.ipa?.length ? `<span class="ipa" title="${h("IPA")}">${e.ipa.map(h).join(" · ")}</span>` : ""}
  </header>
  <h2 class="sub">${t("meanings")}</h2>
  ${senses}
  ${forms ? `<h2 class="sub">${e.pos === "verb" ? bi("Zgjedhimi", "Conjugation") : e.pos === "noun" ? bi("Lakimi", "Declension") : t("inflection")}</h2>${forms}` : ""}
  ${etym}
</section>`;
}

function sourceLink(w: Word, id: SourceId): string {
  return id === "en-wiktionary"
    ? `https://en.wiktionary.org/wiki/${encodeURIComponent(w.word)}#Albanian`
    : id === "sq-wiktionary"
      ? `https://sq.wiktionary.org/wiki/${encodeURIComponent(w.word)}`
      : `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(w.word)}&ns146=1`;
}

function attribution(w: Word): string {
  const parts = w.sources.map((id) => {
    const s = SOURCES[id];
    return `<li><a href="${sourceLink(w, id)}" rel="nofollow">${h(s.name)} ${icon.external(13)}</a> <span class="muted">· <a href="${s.licenceUrl}">${h(s.licence)}</a></span></li>`;
  });
  return `<section class="attribution">
  <h2>${icon.shield(16)} ${t("source")}</h2>
  <ul>${parts.join("")}</ul>
  <p class="muted">${bi("Përmbajtja është përshtatur dhe kombinuar nga burimet e mësipërme.", "Content adapted and combined from the sources above.")} <a href="${url("/burimet/")}">${bi("Të gjitha burimet", "All sources")}</a></p>
</section>`;
}

function wordPage(w: Word): string {
  const variant = (w.variantOf ?? [])
    .map((v) => {
      const kind = v.kind === "gheg" ? bi("Formë gege", "Gheg form") : v.kind === "tosk" ? bi("Formë toske", "Tosk form") : bi("Formë tjetër", "Alternative form");
      const target = byWord.has(v.word) ? `<a href="${wordUrl(v.word)}">${h(v.word)}</a>` : `<b>${h(v.word)}</b>`;
      return `<p class="variant-note"><span class="dialect-dot ${v.kind}"></span>${kind} ${bi("e fjalës", "of")} ${target}</p>`;
    })
    .join("");
  const gheg = (w.dialects ?? []).filter((d) => d.dialect === "gheg");
  const tosk = (w.dialects ?? []).filter((d) => d.dialect === "tosk");
  const link = (f: string) => (byWord.has(f) ? `<a href="${wordUrl(f)}">${h(f)}</a>` : `<span>${h(f)}</span>`);
  const uniq = (list: { form: string }[]) => [...new Set(list.map((d) => d.form))];

  // meaning of the standard word, shown on a Gheg/Tosk form page without its own meaning
  const borrowed =
    !w.entries.length && w.variantOf?.length
      ? (() => {
          const std = byWord.get(w.variantOf[0].word);
          const s = std?.entries.flatMap((e) => e.senses).slice(0, 3) ?? [];
          return s.length
            ? `<section class="entry card"><h2 class="sub">${t("meanings")} (${bi("si", "as")} <a href="${wordUrl(std!.word)}">${h(std!.word)}</a>)</h2><ol class="senses">${s.map(senseHtml).join("")}</ol></section>`
            : "";
        })()
      : "";

  const firstGloss = w.entries.flatMap((e) => e.senses).find((s) => s.lang === "en")?.gloss ?? "";
  const ipa = [...new Set(w.entries.flatMap((e) => e.ipa ?? []))];
  const pos = [...new Set(w.entries.map((e) => e.pos))];
  const gender = w.entries.find((e) => e.gender)?.gender;
  const letter = firstLetter(w.word);
  const i = position.get(w.word) ?? 0;
  const prev = words[i - 1];
  const next = words[i + 1];
  const jsonHref = url(`/api/v1/fjala/${encodeURIComponent(slug(w.word))}.json`);

  const facts: [string, string][] = [];
  if (pos.length) facts.push([bi("Lloji", "Word class"), pos.map((p) => bi(POS_SQ[p], POS_EN[p])).join(", ")]);
  if (gender) facts.push([bi("Gjinia", "Gender"), genderLabel(gender)]);
  if (ipa.length) facts.push([t("pronunciation"), `<span class="ipa">${ipa.map(h).join(" · ")}</span>`]);
  if (gheg.length) facts.push([`<span class="dialect-dot gheg"></span>${t("gheg")}`, uniq(gheg).map(link).join(", ")]);
  if (tosk.length) facts.push([`<span class="dialect-dot tosk"></span>${t("tosk")}`, uniq(tosk).map(link).join(", ")]);

  const body = `
${breadcrumbs([[t("home"), url("/")], [`${t("letter")} ${h(letter.toUpperCase())}`, letterUrl(letter)], [h(w.word), null]])}
<div class="word-layout">
  <article class="word-main">
    <header class="word-hero">
      <div class="word-title">
        <h1 lang="sq">${h(w.word)}</h1>
        <button type="button" class="icon-btn copy-btn" data-copy="${h(w.word)}" aria-label="${h("Kopjo fjalën / Copy word")}" title="${h("Kopjo")}">${icon.copy(18)}<span class="copied">${icon.check(18)}</span></button>
      </div>
      <p class="word-sub">${pos.map((p) => `<span class="pos-pill">${bi(POS_SQ[p], POS_EN[p])}</span>`).join("")}${ipa.length ? `<span class="ipa">${h(ipa[0])}</span>` : ""}</p>
      ${firstGloss ? `<p class="word-summary"><span class="lang-badge">EN</span> ${h(firstGloss)}</p>` : ""}
      ${variant}
    </header>
    ${w.entries.map(entryHtml).join("")}
    ${borrowed}
    ${attribution(w)}
  </article>
  <aside class="word-side">
    ${facts.length ? `<section class="card side-card"><h2>${bi("Në shkurt", "At a glance")}</h2><dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl></section>` : ""}
    <section class="card side-card">
      <h2>${bi("Për zhvilluesit", "For developers")}</h2>
      <p class="muted small">${bi("Kjo fjalë si JSON, falas dhe pa çelës.", "This word as JSON, free and without a key.")}</p>
      <div class="code-line"><code>${h(`/api/v1/fjala/${slug(w.word)}.json`)}</code></div>
      <p><a class="btn btn-ghost btn-sm" href="${jsonHref}">${icon.code(16)} ${bi("Hap JSON", "Open JSON")}</a></p>
    </section>
    <nav class="card side-card neighbours" aria-label="${h("Fjalët fqinje")}">
      <h2>${bi("Në fjalor", "In the dictionary")}</h2>
      <div class="neighbour-links">
        ${prev ? `<a href="${wordUrl(prev.word)}" rel="prev">${icon.arrowLeft(16)}<span>${h(prev.word)}</span></a>` : "<span></span>"}
        ${next ? `<a href="${wordUrl(next.word)}" rel="next"><span>${h(next.word)}</span>${icon.arrowRight(16)}</a>` : "<span></span>"}
      </div>
      <a class="small" href="${letterUrl(letter)}">${bi("Të gjitha fjalët me", "All words starting with")} ${h(letter.toUpperCase())} →</a>
    </nav>
  </aside>
</div>`;
  return layout({
    title: `${w.word} — FjaloriShqip`,
    description: firstGloss ? `${w.word}: ${firstGloss}. Fjalori i hapur shqip.` : `${w.word} — Fjalori i hapur i gjuhës shqipe.`,
    body,
    canonical: `/fjala/${encodeURIComponent(slug(w.word))}/`,
  });
}

// ── letter pages ─────────────────────────────────────────────────────────────
function letterNav(active: string, withCounts = false): string {
  return `<nav class="letters${withCounts ? " letters-tiles" : ""}" aria-label="${h("Alfabeti")}">${ALPHABET.map(
    (l) =>
      `<a href="${letterUrl(l)}"${l === active ? ' aria-current="page"' : ""}><span class="l">${h(l.charAt(0).toUpperCase() + l.slice(1))}</span>${withCounts ? `<small>${num(letterCounts.get(l) ?? 0)}</small>` : ""}</a>`,
  ).join("")}</nav>`;
}

function shortGloss(w: Word): string {
  const g = w.entries.flatMap((e) => e.senses).find((s) => s.lang === "en")?.gloss ?? (w.variantOf?.length ? `→ ${w.variantOf[0].word}` : "");
  return g.length > 70 ? `${g.slice(0, 67)}…` : g;
}

function wordCard(w: Word): string {
  const e = w.entries[0];
  const dialect = w.variantOf?.[0]?.kind;
  return `<li><a href="${wordUrl(w.word)}"><span class="wc-word" lang="sq">${h(w.word)}</span>${e ? `<span class="wc-pos">${bi(POS_SQ[e.pos], POS_EN[e.pos])}</span>` : dialect && dialect !== "alternative" ? `<span class="wc-pos"><span class="dialect-dot ${dialect}"></span>${dialect === "gheg" ? t("gheg") : t("tosk")}</span>` : ""}<span class="wc-gloss">${h(shortGloss(w))}</span></a></li>`;
}

function letterPages(): number {
  let n = 0;
  for (const l of ALPHABET) {
    const list = words.filter((w) => firstLetter(w.word) === l);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const L = h(l.charAt(0).toUpperCase() + l.slice(1));
    for (let p = 1; p <= pages; p++) {
      const chunk = list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
      const pager =
        pages > 1
          ? `<nav class="pager" aria-label="${h("Faqet")}">${Array.from({ length: pages }, (_, i) => i + 1)
              .map((i) => `<a href="${url(`/shkronja/${encodeURIComponent(l)}/${i === 1 ? "" : `${i}/`}`)}"${i === p ? ' aria-current="page"' : ""}>${i}</a>`)
              .join("")}</nav>`
          : "";
      const range = chunk.length ? `${h(chunk[0].word)} – ${h(chunk[chunk.length - 1].word)}` : "";
      const body = `
${breadcrumbs([[t("home"), url("/")], [t("browse"), url("/shkronja/a/")], [`${t("letter")} ${L}`, null]])}
<header class="letter-head">
  <span class="big-letter" aria-hidden="true">${L}</span>
  <div>
    <h1>${t("letter")} ${L}</h1>
    <p class="muted">${num(list.length)} ${t("words")}${pages > 1 ? ` · ${t("page")} ${p}/${pages} · ${range}` : ""}</p>
  </div>
</header>
${letterNav(l)}
${pager}
${chunk.length ? `<ul class="word-grid">${chunk.map(wordCard).join("")}</ul>` : `<p class="empty">${bi("Ende nuk ka fjalë me këtë shkronjë.", "No words with this letter yet.")}</p>`}
${pager}`;
      write(`shkronja/${l}/${p === 1 ? "" : `${p}/`}index.html`, layout({ title: `${l.toUpperCase()} — FjaloriShqip`, description: `Fjalët shqipe që fillojnë me ${l.toUpperCase()}.`, body, active: "browse" }));
      n++;
    }
  }
  return n;
}

// ── home ─────────────────────────────────────────────────────────────────────
function featureTile(ic: string, title: string, text: string, href: string): string {
  return `<a class="feature-tile card" href="${href}"><span class="tile-icon">${ic}</span><h3>${title}</h3><p>${text}</p></a>`;
}

function homePage(): string {
  const body = `
<section class="hero">
  <p class="kicker">${bi("Falas · I hapur · Pa llogari", "Free · Open · No account needed")}</p>
  <h1>${bi("Fjalori i hapur i", "The open dictionary of")} <span class="accent">${bi("gjuhës shqipe", "the Albanian language")}</span></h1>
  <p class="lead">${bi(
    "Kërkoni kuptimin e fjalëve, zgjedhimin e foljeve dhe format gege e toske. Shkruani shqip ose anglisht; ë dhe ç nuk janë të detyrueshme.",
    "Look up meanings, verb conjugations and Gheg and Tosk forms. Type in Albanian or English; ë and ç are optional.",
  )}</p>
  ${searchBox({ size: "big", chips: true })}
</section>

<section class="featured" aria-label="${h("Fjalët e zgjedhura")}">
  <article class="card feature-card feature-day" data-feature="day">
    <header><span class="badge">${icon.sparkle(16)} ${t("wordOfDay")}</span><time class="feature-date"></time></header>
    <div class="card-body"><div class="skeleton"></div></div>
  </article>
  <article class="card feature-card feature-hour" data-feature="hour">
    <header><span class="badge">${icon.clock(16)} ${t("wordOfHour")}</span></header>
    <div class="card-body"><div class="skeleton"></div></div>
  </article>
  <article class="card feature-card feature-dialect" data-feature="dialect">
    <header><span class="badge">${icon.map(16)} ${bi("Gegë dhe standard", "Gheg and standard")}</span></header>
    <div class="card-body"><div class="skeleton"></div></div>
  </article>
</section>

<section class="random-band">
  <p>${bi("Doni të mësoni diçka të re?", "Want to learn something new?")}</p>
  <a class="btn btn-primary random-word" href="#">${icon.shuffle(18)} ${t("randomWord")}</a>
</section>

<section class="stats" aria-label="${h(UI_STATS)}">
  <div><b>${num(stats.words)}</b><span>${bi("fjalë", "words")}</span></div>
  <div><b>${num(stats.withEnglish)}</b><span>${bi("me kuptim në anglisht", "with an English meaning")}</span></div>
  <div><b>${num(stats.withInflection)}</b><span>${bi("me zgjedhim ose lakim", "with conjugation or declension")}</span></div>
  <div><b>${num(stats.ghegForms)}</b><span>${bi("forma gege", "Gheg forms")}</span></div>
</section>

<section class="section">
  <header class="section-head"><h2>${bi("Çfarë gjeni këtu", "What you will find")}</h2></header>
  <div class="tile-grid">
    ${featureTile(icon.book(24), bi("Kuptimet", "Meanings"), bi("Kuptimi në anglisht, shembuj dhe shqiptimi i fjalës.", "English meanings, examples and pronunciation."), url("/fjala/zem%C3%ABr/"))}
    ${featureTile(icon.layers(24), bi("Zgjedhimi dhe lakimi", "Conjugation and declension"), bi("Të gjitha kohët e foljeve dhe rasat e emrave.", "Every verb tense and every noun case."), url("/fjala/punoj/"))}
    ${featureTile(icon.map(24), bi("Gegërisht dhe toskërisht", "Gheg and Tosk"), bi("Format dialektore pranë fjalës standarde.", "Dialect forms next to the standard word."), url("/fjala/n%C3%ABn%C3%AB/"))}
    ${featureTile(icon.code(24), bi("API falas", "Free API"), bi("JSON statik për aplikacionet tuaja, pa çelës.", "Static JSON for your apps, no key needed."), url("/api/"))}
  </div>
</section>

<section class="section">
  <header class="section-head"><h2>${bi("Shfleto sipas shkronjës", "Browse by letter")}</h2><p class="muted">${bi("Alfabeti shqip ka 36 shkronja.", "The Albanian alphabet has 36 letters.")}</p></header>
  ${letterNav("", true)}
</section>

<section class="open-cta card">
  <div>
    <h2>${bi("I hapur për të gjithë", "Open for everyone")}</h2>
    <p>${bi(
      "Të gjitha të dhënat janë falas (CC BY-SA 4.0): kërkojini këtu ose përdorini në projektet tuaja nëpërmjet API-së falas.",
      "All data is free (CC BY-SA 4.0): search it here, or use it in your own projects through the free API.",
    )}</p>
  </div>
  <div class="cta-buttons">
    <a class="btn btn-primary" href="${url("/api/")}">${icon.code(18)} API</a>
  </div>
</section>`;
  return layout({
    title: "FjaloriShqip — Fjalori i hapur i gjuhës shqipe",
    description: "Fjalor i hapur i gjuhës shqipe: kuptimet në anglisht, format gege e toske, zgjedhimi i foljeve dhe një API falas për zhvilluesit.",
    body,
    active: "home",
    canonical: "/",
    headerSearch: false,
  });
}
const UI_STATS = "Fjalori sot";

// ── static info pages ────────────────────────────────────────────────────────
function sourcesPage(): string {
  const manifest = stats.sources ?? {};
  const rows = (Object.keys(SOURCES) as SourceId[])
    .map((id) => {
      const s = SOURCES[id];
      const m = manifest[id];
      return `<article class="card source">
  <header class="source-head"><h2>${h(s.name)}</h2><a class="licence-pill" href="${s.licenceUrl}">${h(s.licence)}</a></header>
  <dl class="meta">
    <div><dt>${bi("Botuesi", "Publisher")}</dt><dd>${h(s.publisher)}</dd></div>
    <div><dt>${bi("Adresa", "Address")}</dt><dd><a href="${s.url}">${h(s.url)}</a>${s.downloadUrl ? `<br><a href="${s.downloadUrl}">${h(s.downloadUrl)}</a>` : ""}</dd></div>
    <div><dt>${bi("Marrë më", "Retrieved")}</dt><dd>${h(m?.retrieved ?? "—")}${m?.items ? ` · ${num(m.items)} ${bi("njësi", "items")}` : ""}</dd></div>
    <div><dt>${bi("Fjalë në fjalor", "Words in the dictionary")}</dt><dd>${num(stats.bySource?.[id] ?? 0)}</dd></div>
  </dl>
  <p><b>${bi("Çfarë përdorim", "What we use")}:</b> ${bi(s.usedFor.sq, s.usedFor.en)}</p>
  ${s.notUsed ? `<p class="notice"><b>${bi("Çfarë nuk përdorim", "What we do not use")}:</b> ${bi(s.notUsed.sq, s.notUsed.en)}</p>` : ""}
</article>`;
    })
    .join("");
  const body = `
${pageHead(
  t("sources"),
  bi(
    "FjaloriShqip ndërtohet vetëm nga burime me licencë të hapur. Çdo fjalë tregon burimin e saj; këtu janë të gjitha burimet, licencat dhe data kur u morën.",
    "FjaloriShqip is built only from openly licensed sources. Every word shows its source; here are all sources, their licences and when they were retrieved.",
  ),
  `${icon.shield(16)} ${bi("Ligjshmëria dhe licencat", "Legal and licences")}`,
)}
<div class="stack">
${rows}
<section class="card">
  <h2>${bi("Licenca e të dhënave tona", "Licence of our data")}</h2>
  <p>${bi(
    "Për shkak se përmbajtja e Wiktionary përdoret me licencën CC BY-SA 4.0, i gjithë fjalori publikohet me të njëjtën licencë. Mund ta kopjoni, ndryshoni dhe përdorni edhe për qëllime tregtare, me kusht që të përmendni FjaloriShqip dhe burimet origjinale dhe të ndani punën tuaj me të njëjtën licencë.",
    "Because Wiktionary content is used under CC BY-SA 4.0, the whole dictionary is published under the same licence. You may copy, change and use it, even commercially, as long as you credit FjaloriShqip and the original sources and share your work under the same licence.",
  )}</p>
  <p>${bi("Kodi i faqes është me licencën MIT.", "The website's code is MIT-licensed.")}</p>
  <h3>${bi("Si të citoni", "How to cite")}</h3>
  <pre>FjaloriShqip — open Albanian dictionary (CC BY-SA 4.0), built from Wiktionary (CC BY-SA 4.0), Wikidata (CC0) and Wikifjalor (CC BY-SA 4.0). Data version ${h(stats.built)}.</pre>
</section>
<section class="card card-warn">
  <h2>${bi("Çfarë nuk përdorim kurrë", "What we never use")}</h2>
  <p>${bi(
    "Nuk kopjojmë përkufizime, shembuj ose lista fjalësh nga fjalorë me të drejta autori (p.sh. Fjalori i Akademisë së Shkencave / FGJSSH, fjalorë të shtypur ose faqe të tjera fjalorësh). Nëse mendoni se diçka këtu shkel të drejtat tuaja, na shkruani dhe do ta heqim.",
    "We do not copy definitions, examples or word lists from copyrighted dictionaries (e.g. the Academy of Sciences' dictionary / FGJSSH, printed dictionaries or other dictionary websites). If you believe something here infringes your rights, contact us and we will remove it.",
  )}</p>
</section>
</div>`;
  return layout({ title: "Burimet — FjaloriShqip", description: "Burimet dhe licencat e Fjalorit të hapur shqip.", body, active: "sources", canonical: "/burimet/" });
}

function apiPage(): string {
  const ex = words.find((w) => w.word === "punoj") ?? words[0];
  const base = SITE_URL || "https://<domain>";
  const endpoint = (path: string, sq: string, en: string) =>
    `<li><code><span class="method">GET</span> ${h(path)}</code><span>${bi(sq, en)}</span></li>`;
  const body = `
${pageHead(
  "API",
  bi(
    "Një API falas dhe e hapur për zhvilluesit: skedarë JSON statikë, pa çelës, pa regjistrim. Mund të thirren drejtpërdrejt nga shfletuesi.",
    "A free, open API for developers: static JSON files, no key, no sign-up. They can be called directly from the browser.",
  ),
  `${icon.code(16)} ${bi("Për zhvilluesit", "For developers")}`,
)}
<div class="pill-row">
  <span class="info-pill">${icon.check(16)} ${bi("Pa çelës", "No API key")}</span>
  <span class="info-pill">${icon.check(16)} ${bi("CORS i hapur", "CORS enabled")}</span>
  <span class="info-pill">${icon.check(16)} CC BY-SA 4.0</span>
</div>
<div class="stack">
<section class="card">
  <h2>${bi("Pikat fundore", "Endpoints")}</h2>
  <ul class="endpoints">
    ${endpoint("/api/v1/fjala/{fjala}.json", "Një fjalë me të gjitha të dhënat: kuptimet, format, format dialektore, burimet.", "One word with all its data: meanings, forms, dialect forms, sources.")}
    ${endpoint("/api/v1/fjalet.json", "Lista e të gjitha fjalëve.", "List of all headwords.")}
    ${endpoint("/api/v1/kerko.json", "Indeksi i kërkimit: fjala, çelësi pa ë/ç, lloji, kuptimi i shkurtër.", "Search index: word, key without ë/ç, word class, short meaning.")}
    ${endpoint("/api/v1/format/{shkronja}.json", "Format e lakuara dhe dialektore → fjala bazë.", "Inflected and dialect forms → headword.")}
    ${endpoint("/api/v1/statistika.json", "Numrat e fjalorit dhe versioni i të dhënave.", "Dictionary counts and data version.")}
  </ul>
  <p class="muted small">${bi("Hapësirat në fjalë zëvendësohen me _ . Shkronjat ë dhe ç mbeten siç janë (kodohen në URL).", "Spaces in words are replaced with _ . The letters ë and ç stay as they are (URL-encoded).")}</p>
</section>
<section class="card">
  <h2>${bi("Shembull", "Example")}</h2>
  <pre class="code">fetch("${h(base)}${url(`/api/v1/fjala/${encodeURIComponent(slug(ex.word))}.json`)}")
  .then((r) => r.json())
  .then((w) => console.log(w.word, w.entries[0].senses[0].gloss));</pre>
  <details><summary>${bi("Shiko përgjigjen", "See the response")}</summary><pre class="code">${h(JSON.stringify(apiWord(ex), null, 2).slice(0, 2500))}${JSON.stringify(apiWord(ex)).length > 2500 ? "\n…" : ""}</pre></details>
</section>
<section class="card">
  <h2>${bi("Kushtet", "Terms")}</h2>
  <p>${bi(
    "Të dhënat janë me licencën CC BY-SA 4.0: përmendni \"FjaloriShqip\" dhe burimet (Wiktionary, Wikidata, Wikifjalor). Ju lutemi ruani përgjigjet në memorie (cache) dhe mos bëni mijëra thirrje në sekondë.",
    "Data is CC BY-SA 4.0: credit \"FjaloriShqip\" and the sources (Wiktionary, Wikidata, Wikifjalor). Please cache responses and avoid thousands of calls per second.",
  )}</p>
</section>
</div>`;
  return layout({ title: "API — FjaloriShqip", description: "API falas dhe e hapur për fjalorin shqip.", body, active: "api", canonical: "/api/" });
}

function aboutPage(): string {
  const body = `
${pageHead(t("about"), bi("Gjuha shqipe, gati për botën digjitale.", "The Albanian language, ready for the digital world."))}
<section class="card prose">
  <p>${bi(
    "FjaloriShqip është një projekt me kod të hapur që synon ta bëjë gjuhën shqipe të gatshme për botën digjitale: një fjalor i hapur, falas, me API për zhvilluesit dhe me format standarde, gege dhe toske.",
    "FjaloriShqip is an open-source project that aims to make the Albanian language ready for the digital world: a free, open dictionary with an API for developers and with standard, Gheg and Tosk forms.",
  )}</p>
  <p>${bi(
    "Në këtë version të parë, fjalori ndërtohet vetëm nga burime të hapura dhe tregon gjithmonë burimin e çdo fjale. Hapi i ardhshëm: përdoruesit do të mund të propozojnë fjalë të reja dhe të votojnë për to, pa krijuar llogari.",
    "In this first version the dictionary is built only from open sources and always shows the source of every word. Next step: visitors will be able to suggest new words and vote on them, without creating an account.",
  )}</p>
  <p class="notice">${bi(
    "Ky nuk është fjalori zyrtar i Akademisë së Shkencave. Për normën zyrtare, shihni botimet e Akademisë.",
    "This is not the official dictionary of the Academy of Sciences. For the official standard, see the Academy's publications.",
  )}</p>
</section>
<section class="section">
  <header class="section-head"><h2>${bi("Rruga përpara", "Roadmap")}</h2></header>
  <ol class="roadmap">
    <li class="done"><b>${bi("Fjalori nga burime të hapura", "Dictionary from open sources")}</b><span>${bi("Kërkimi, API, faqja e burimeve", "Search, API, references page")}</span></li>
    <li><b>${bi("Propozime dhe vota", "Suggestions and votes")}</b><span>${bi("Vizitorët propozojnë fjalë, pa llogari", "Visitors suggest words, no account needed")}</span></li>
    <li><b>${bi("Më shumë gegërisht", "More Gheg")}</b><span>${bi("Burime të reja, pasi të konfirmohen licencat", "New sources, once their licences are confirmed")}</span></li>
    <li><b>${bi("Emrat, historia, kultura", "Names, history, culture")}</b><span>${bi("Seksione të reja edukative", "New educational sections")}</span></li>
  </ol>
</section>`;
  return layout({ title: "Rreth nesh — FjaloriShqip", description: "Rreth projektit FjaloriShqip.", body, active: "about", canonical: "/rreth/" });
}

function searchPage(): string {
  const body = `
<div class="search-page">
  ${searchBox({ size: "big" })}
  <h1 class="search-title"></h1>
  <ul class="word-grid search-results"></ul>
</div>`;
  return layout({ title: "Kërko — FjaloriShqip", description: "Kërko në fjalorin shqip.", body, headerSearch: false });
}

function notFoundPage(): string {
  const body = `
<div class="not-found">
  <p class="big-letter" aria-hidden="true">404</p>
  <h1>${t("notFound")}</h1>
  <p class="lead">${bi("Kjo faqe nuk ekziston. Provoni kërkimin:", "This page does not exist. Try searching:")}</p>
  ${searchBox({ size: "big", chips: true })}
</div>`;
  return layout({ title: "404 — FjaloriShqip", description: "Faqja nuk u gjet.", body, headerSearch: false });
}

// ── API files ────────────────────────────────────────────────────────────────
function apiWord(w: Word): object {
  return {
    ...w,
    url: SITE_URL ? `${SITE_URL}${url(`/fjala/${encodeURIComponent(slug(w.word))}/`)}` : undefined,
    licence: "CC BY-SA 4.0",
    attribution: w.sources.map((id) => `${SOURCES[id].name} — ${SOURCES[id].licence}`),
  };
}

// ── build ────────────────────────────────────────────────────────────────────
(() => {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "public"))) fs.copyFileSync(path.join(ROOT, "public", f), path.join(DIST, f));

  write("index.html", homePage());
  write("burimet/index.html", sourcesPage());
  write("api/index.html", apiPage());
  write("rreth/index.html", aboutPage());
  write("kerko/index.html", searchPage());
  write("404.html", notFoundPage());
  const letterCount = letterPages();

  for (const w of words) {
    write(`fjala/${slug(w.word)}/index.html`, wordPage(w));
    write(`api/v1/fjala/${slug(w.word)}.json`, JSON.stringify(apiWord(w)));
  }

  // search index: [word, folded key, pos (sq), short English gloss]
  write("api/v1/kerko.json", JSON.stringify(words.map((w) => [w.word, foldKey(w.word), w.entries[0] ? POS_SQ[w.entries[0].pos] : "", shortGloss(w)])));
  write("api/v1/fjalet.json", JSON.stringify(words.map((w) => w.word)));
  write("api/v1/statistika.json", JSON.stringify({ ...stats, licence: "CC BY-SA 4.0" }, null, 2));

  // inflected and dialect forms → headword, sharded by first folded letter (searching "punova" finds "punoj")
  const shards = new Map<string, Record<string, string[]>>();
  const addForm = (form: string, target: string) => {
    const k = foldKey(form);
    if (!k || k === foldKey(target)) return;
    const shard = shards.get(k[0]) ?? {};
    shards.set(k[0], shard);
    const list = (shard[k] ??= []);
    if (!list.includes(target) && list.length < 5) list.push(target);
  };
  for (const w of words) {
    for (const e of w.entries) for (const f of e.forms ?? []) if (!f.form.includes(" ")) addForm(f.form, w.word);
    for (const d of w.dialects ?? []) addForm(d.form, w.word);
  }
  for (const [c, shard] of shards) write(`api/v1/format/${c}.json`, JSON.stringify(shard));

  // featured words for word of the day / hour: common word classes with an English meaning
  const featured = words
    .filter((w) => w.word.length >= 3 && w.word.length <= 12 && !w.word.includes(" ") && w.entries.some((e) => ["noun", "verb", "adj"].includes(e.pos) && e.senses.some((s) => s.lang === "en" && !(s.tags ?? []).some((x) => /archaic|obsolete|rare|vulgar|derogatory|offensive/.test(x)))))
    .map((w) => {
      const e = w.entries.find((x) => x.senses.some((s) => s.lang === "en"))!;
      const ex = e.senses.flatMap((s) => s.examples ?? [])[0];
      const gheg = w.dialects?.find((d) => d.dialect === "gheg")?.form ?? null;
      return [w.word, POS_SQ[e.pos], POS_EN[e.pos], e.senses.find((s) => s.lang === "en")!.gloss.slice(0, 120), gheg, ex ? ex.text : null, ex?.english ?? null, e.ipa?.[0] ?? null];
    });
  write("api/v1/te-zgjedhura.json", JSON.stringify(featured));

  write(".nojekyll", "");

  console.log(`built ${words.length} word pages, ${letterCount} letter pages, ${shards.size} form shards, ${featured.length} featured words in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
})();
