/**
 * Generates the static website and the static JSON API into ./dist.
 *   npm run build
 * Everything is plain HTML/CSS/JS so it can be hosted for free (GitHub Pages).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Dialect, Entry, Sense, Word } from "../src/data/model.js";
import { ALPHABET, compareSq, DIALECTS, firstLetter, foldKey, POS_EN, POS_SQ } from "../src/data/model.js";
import { SOURCES, type SourceId } from "../src/data/sources.js";
import { bi, escapeHtml as h, t } from "../src/site/i18n.js";
import { icon } from "../src/site/icons.js";
import { HEAD_SCRIPT } from "../src/site/security.js";
import { FORM_TAG_SQ, formsHtml } from "../src/site/tables.js";
import { addDays, calendar, type DailyDay, dayOf, hash, shuffled, todayInAlbania } from "./lib/daily.js";
import { deriveMeaning } from "./lib/derive-meaning.js";
import { HIDDEN_TAGS, LANGUAGE_SQ, TAG_SQ } from "./lib/labels.js";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.BASE_PATH ?? "").replace(/\/$/, ""); // e.g. "/fjalorishqip" on GitHub Pages project sites
const SITE_URL = process.env.SITE_URL ?? "";
const PAGE_SIZE = 400;
/** Minimum use (Wikipedia + scaled MaCoCu) for the word of the day / hour. */
const FEATURED_MIN_USE = 400;
/** …and exactly this spelling at least this often in Wikipedia. */
const FEATURED_MIN_WIKIPEDIA = 100;
/** Minimum use of the standard word behind a dialect word of the day (the reader should know it). */
const DAILY_MIN_USE = 2000;
const NOINDEX = process.env.NOINDEX === "1"; // test hosting: keep out of search engines

const words: Word[] = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fjalori.json"), "utf8"));
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stats.json"), "utf8"));
const byWord = new Map(words.map((w) => [w.word, w]));
const position = new Map(words.map((w, i) => [w.word, i])); // words are in Albanian alphabetical order
const letterCounts = new Map(ALPHABET.map((l) => [l, 0]));
for (const w of words) letterCounts.set(firstLetter(w.word), (letterCounts.get(firstLetter(w.word)) ?? 0) + 1);

/** Informal or children's English words and the meaning they stand for, so mami ("mom") joins nënë ("mother"). */
const SAME_AS: Record<string, string> = {
  mom: "mother", mum: "mother", mommy: "mother", mama: "mother", mamma: "mother", momma: "mother", ma: "mother",
  dad: "father", daddy: "father", papa: "father", pa: "father",
  granny: "grandmother", grandma: "grandmother", gran: "grandmother", nana: "grandmother",
  grandpa: "grandfather", granddad: "grandfather", grandad: "grandfather",
  kid: "child", bro: "brother", sis: "sister", buddy: "friend", pal: "friend",
  tummy: "belly", doggy: "dog", doggie: "dog", kitty: "cat", bunny: "rabbit",
  hubby: "husband", auntie: "aunt", aunty: "aunt", hi: "hello", hey: "hello", bye: "goodbye",
};
// ── words with the same meaning ──────────────────────────────────────────────
// From synonyms listed by Wiktionary (both directions) and from words whose English meaning is
// the same (nënë, mëmë, ëmë: "mother"). A meaning shared by very many words is too general to use.
const primaryKeys = new Map<string, string[]>();
const secondaryKeys = new Map<string, string[]>();
const byPrimary = new Map<string, string[]>();
const bySecondary = new Map<string, string[]>();
const listedSynonyms = new Map<string, Set<string>>();
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
const link2 = (a: string, b: string) => (listedSynonyms.get(a) ?? listedSynonyms.set(a, new Set()).get(a)!).add(b);
// "b lists a as a synonym": used for a only when they also share an English meaning
const reverseSynonyms = new Map<string, Set<string>>();
const reverse = (a: string, b: string) => (reverseSynonyms.get(a) ?? reverseSynonyms.set(a, new Set()).get(a)!).add(b);
for (const w of words) {
  if (w.unverified) continue;
  // Albanet's "meaning" is a list of English words for a whole concept (theater, theatre, house):
  // too loose to compare meanings, so only Albanet's own groups are used for those words
  const glosses = w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "albanet" && s.source !== "auto").map((s) => s.gloss);
  const first = englishKeys(glosses.slice(0, 1));
  const other = englishKeys(glosses.slice(1, 3)).filter((k) => !first.includes(k));
  primaryKeys.set(w.word, first);
  secondaryKeys.set(w.word, other);
  for (const k of first) push(byPrimary, k, w.word);
  for (const k of other) push(bySecondary, k, w.word);
  for (const e of w.entries) for (const s of e.synonyms ?? []) if (byWord.has(s)) (link2(w.word, s), reverse(s, w.word));
}
const TOO_GENERAL = 25;

type SameMeaning = { word: string; how: "listed" | "same" | "also" | "other" };
function sameMeaning(w: Word): SameMeaning[] {
  const skip = new Set([w.word, ...(w.dialects ?? []).map((d) => d.form), ...(w.variantOf ?? []).map((v) => v.word)]);
  const out = new Map<string, SameMeaning["how"]>();
  const pos = new Set<string>(w.entries.map((e) => e.pos).filter((p) => p !== "other"));
  // same word class only: punë (noun, work) is not punoj (verb, to work); "other" = unknown
  const samePos = (x: Word) => !pos.size || x.entries.some((e) => pos.has(e.pos)); // unknown word class never matches
  const add = (x: string, how: SameMeaning["how"]) => {
    const other = byWord.get(x);
    if (other && !skip.has(x) && !out.has(x) && samePos(other)) out.set(x, how);
  };
  const common = (a: string, b: string) => (byWord.get(b)?.frequency ?? 0) - (byWord.get(a)?.frequency ?? 0);
  const from = (keys: string[] | undefined, index: Map<string, string[]>, how: SameMeaning["how"], limit = TOO_GENERAL, take = 99) => {
    for (const k of keys ?? []) {
      const list = index.get(k) ?? [];
      if (list.length <= limit) [...list].sort(common).slice(0, take).forEach((x) => add(x, how));
    }
  };
  for (const s of listedSynonyms.get(w.word) ?? []) add(s, "listed");
  const mine = new Set(primaryKeys.get(w.word) ?? []);
  for (const s of reverseSynonyms.get(w.word) ?? [])
    if ([...(primaryKeys.get(s) ?? []), ...(secondaryKeys.get(s) ?? [])].some((k) => mine.has(k))) add(s, "listed");
  from(primaryKeys.get(w.word), byPrimary, "same"); // same main meaning
  // Not used: words that have this meaning only as a minor sense (bimë: "plant", rarely "girl")
  // look unrelated on a word page. Search still shows them, marked "also".
  from(secondaryKeys.get(w.word), byPrimary, "other", 6, 2); // words for this word's other meanings (nënë: grandmother → gjyshe)
  const all = [...out].map(([word, how]) => ({ word, how }));
  return [...all.filter((x) => x.how !== "other").slice(0, 12), ...all.filter((x) => x.how === "other").slice(0, 4)];
}

const url = (p: string) => `${BASE}${p}`;
/** Full address of a page, for search engines and link previews ("" when SITE_URL is not set). */
const absolute = (p: string) => (SITE_URL ? SITE_URL + url(p) : "");
/** Files from public/ linked with a content version (style.css?v=…), so browsers can keep them for a year. */
const versions = new Map<string, string>();
const asset = (file: string) => {
  let v = versions.get(file);
  if (!v) versions.set(file, (v = createHash("sha256").update(fs.readFileSync(path.join(ROOT, "public", file))).digest("hex").slice(0, 10)));
  return url(`/${file}?v=${v}`);
};
/** Structured data for search engines (schema.org); "<" is escaped so the JSON cannot close the script tag. */
const jsonLd = (data: object) => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c")}</script>`;
const SITE_NAME = "FjaloriShqip";
/** Dialects in display order, with their page address and where they are spoken. */
const DIALECT_ORDER: Dialect[] = DIALECTS;
const DIALECT_INFO: Record<Dialect, { slug: string; sq: string; en: string; whereSq: string; whereEn: string }> = {
  gheg: { slug: "gegerisht", sq: "Gegërisht", en: "Gheg", whereSq: "Veriu: Shqipëria e Veriut, Kosova, Maqedonia e Veriut, Mali i Zi", whereEn: "The north: northern Albania, Kosovo, North Macedonia, Montenegro" },
  tosk: { slug: "toskerisht", sq: "Toskërisht", en: "Tosk", whereSq: "Jugu i Shqipërisë", whereEn: "Southern Albania" },
  arberesh: { slug: "arberisht", sq: "Arbërisht", en: "Arbëresh", whereSq: "Arbëreshët e Italisë", whereEn: "The Arbëresh of Italy" },
  arvanitika: { slug: "arvanitisht", sq: "Arvanitisht", en: "Arvanitika", whereSq: "Arvanitët e Greqisë", whereEn: "The Arvanites of Greece" },
};
const dialectUrl = (d: Dialect) => url(`/dialekt/${DIALECT_INFO[d].slug}/`);
const REPO_URL = "https://github.com/EndritRushiti/FjaloriShqip";
/** Cut a description to about the length search engines show, at a word boundary. */
const metaText = (s: string, max = 158) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(" ", max - 1))}…`);
export const slug = (w: string) => w.replace(/ /g, "_");
const wordUrl = (w: string) => url(`/fjala/${encodeURIComponent(slug(w))}/`);
const letterUrl = (l: string) => url(`/shkronja/${encodeURIComponent(l)}/`);
const num = (n: number) => n.toLocaleString("de-DE");
/** Numbers in English text: 24,537 */
const numEn = (n: number) => n.toLocaleString("en-US");

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

function layout(opts: {
  title: string;
  description: string;
  body: string;
  active?: string;
  canonical?: string;
  headerSearch?: boolean;
  /** "article" for word pages, "website" otherwise (Open Graph). */
  ogType?: string;
  /** schema.org objects for search engines. */
  structured?: object[];
  /** keep this page out of search results (search results page, 404) */
  noindex?: boolean;
}): string {
  const headerSearch = opts.headerSearch ?? true;
  const canonical = opts.canonical ? absolute(opts.canonical) : "";
  const image = absolute("/og.png");
  return `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(opts.title)}</title>
<meta name="description" content="${h(opts.description)}">
<meta name="theme-color" content="#c8102e">
${NOINDEX || opts.noindex ? `<meta name="robots" content="noindex, follow">` : `<meta name="robots" content="index, follow, max-image-preview:large">`}
${canonical ? `<link rel="canonical" href="${h(canonical)}">` : ""}
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${opts.ogType ?? "website"}">
<meta property="og:locale" content="sq_AL">
<meta property="og:title" content="${h(opts.title)}">
<meta property="og:description" content="${h(opts.description)}">
${canonical ? `<meta property="og:url" content="${h(canonical)}">` : ""}
${image ? `<meta property="og:image" content="${h(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="FjaloriShqip — Fjalori i hapur i gjuhës shqipe">` : ""}
<meta name="twitter:card" content="summary_large_image">
<!-- search engines take the site icon from a fixed address (Google: a multiple of 48px, stable URL) -->
<link rel="icon" href="${url("/favicon.ico")}" sizes="48x48">
<link rel="icon" href="${url("/icon-512.png")}" type="image/png" sizes="512x512">
<link rel="icon" href="${asset("favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${asset("icon-512.png")}">
<link rel="manifest" href="${url("/site.webmanifest")}">
<link rel="stylesheet" href="${asset("style.css")}">
<script>${HEAD_SCRIPT}</script>
${(opts.structured ?? []).map(jsonLd).join("\n")}
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
        <li><a href="${url("/aplikacioni/")}">${bi("Aplikacioni dhe njoftimet", "App and notifications")}</a></li>
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
    <p>© ${new Date().getFullYear()} ${bi("Fjalori i hapur i gjuhës shqipe", "The open dictionary of the Albanian language")}</p>
  </div>
</footer>
<script src="${asset("app.js")}" defer></script>
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
    <input type="search" name="q" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Kërko / Search" aria-autocomplete="list" placeholder="${h("Kërko një fjalë shqip ose anglisht…")}" data-placeholder-en="${h("Search an Albanian or English word…")}" data-placeholder-short="${h("Kërko shqip ose anglisht…")}" data-placeholder-short-en="${h("Search Albanian or English…")}" data-placeholder-tiny="${h("Kërko një fjalë…")}" data-placeholder-tiny-en="${h("Search a word…")}">
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
  const shownTags = (s.tags ?? []).filter((x) => !HIDDEN_TAGS.has(x) && !/^(feminine|masculine|neuter)$/.test(x)); // gender is shown once above the meanings
  const tags = shownTags.length ? `<span class="tags">${shownTags.map((x) => `<span class="tag">${TAG_SQ[x] ? bi(TAG_SQ[x], x) : h(x)}</span>`).join("")}</span>` : "";
  const label = s.lang === "en" ? `<span class="lang-badge" title="English">EN</span>` : `<span class="lang-badge sq" title="Shqip">SQ</span>`;
  const ex = s.examples?.length
    ? `<ul class="examples">${s.examples.map((e) => `<li><span class="ex-sq" lang="sq">${h(e.text)}</span>${e.english ? `<span class="ex-en">${h(e.english)}</span>` : ""}</li>`).join("")}</ul>`
    : "";
  if (s.source === "auto") {
    // approximate meaning: show it as such and link the words it is built from
    const gloss = h(s.gloss).replace(/“([^”]+)”/g, (_, x: string) => (byWord.has(x) ? `“<a href="${wordUrl(x)}" lang="sq">${x}</a>”` : `“${x}”`));
    const badge = `<span class="approx" title="${h("Kuptim i përafërt, i nxjerrë automatikisht nga fjalë të tjera të fjalorit / Approximate meaning, worked out automatically from other words")}">≈ ${bi("i përafërt", "approximate")}</span>`;
    return `<li class="sense-approx"><div class="sense-line">${label}${badge}<span class="gloss">${gloss}</span></div></li>`;
  }
  return `<li><div class="sense-line">${label}${tags}<span class="gloss">${h(s.gloss)}</span></div>${ex}</li>`;
}

const genderLabel = (g: Entry["gender"]) => (g === "m" ? bi("mashkullore", "masculine") : g === "f" ? bi("femërore", "feminine") : bi("asnjanëse", "neuter"));

function entryHtml(e: Entry): string {
  const senses = e.senses.length ? `<ol class="senses">${e.senses.map(senseHtml).join("")}</ol>` : `<p class="muted">${t("noMeaningYet")}</p>`;
  const forms = formsHtml(e);
  return `<section class="entry card">
  <header class="entry-head">
    ${e.pos === "other" ? "" : `<span class="pos-pill">${bi(POS_SQ[e.pos], POS_EN[e.pos])}</span>`}
    ${e.gender ? `<span class="gender">${genderLabel(e.gender)}</span>` : ""}
    ${e.ipa?.length ? `<span class="ipa" title="${h("IPA")}">${e.ipa.map(h).join(" · ")}</span>` : ""}
  </header>
  <h2 class="sub">${e.senses.length && e.senses.every((s) => s.lang === "en") ? bi("Përkthimi në anglisht", "Meanings") : t("meanings")}</h2>
  ${senses}
  ${forms ? `<h2 class="sub">${e.pos === "verb" ? bi("Zgjedhimi", "Conjugation") : e.pos === "noun" ? bi("Lakimi", "Declension") : t("inflection")}</h2>${forms}` : ""}
</section>`;
}


/** Licence of one word's data: words found only in the Hunspell list keep its GPL licence. */
const wordLicence = (w: Word) => (w.sources.includes("hunspell-sq") ? "GPL-2.0-or-later" : "CC BY-SA 4.0");

/** How common a word is, from its Wikipedia count (word + forms). */
function usage(n = 0): { level: number; sq: string; en: string } {
  if (n >= 1000) return { level: 4, sq: "Shumë e zakonshme", en: "Very common" };
  if (n >= 100) return { level: 3, sq: "E zakonshme", en: "Common" };
  if (n >= 10) return { level: 2, sq: "E përdorur", en: "In use" };
  if (n >= 1) return { level: 1, sq: "E rrallë", en: "Rare" };
  return { level: 0, sq: "Shumë e rrallë", en: "Very rare" };
}

function usageHtml(n?: number): string {
  const u = usage(n);
  return `<span class="usage" title="${h(`Wikipedia: ${num(n ?? 0)}`)}"><span class="usage-bars" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i${i <= u.level ? ' class="on"' : ""}></i>`).join("")}</span>${bi(u.sq, u.en)}</span>`;
}


/** English line under the word: the first meaning; in English mode up to three different meanings. */
function enSummary(w: Word, first: string): string {
  const clean = (g: string) => g.replace(/[“”]/g, "");
  const more = [...new Set(w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "auto").map((s) => clean(s.gloss)))].slice(0, 3);
  const all = more.length > 1 ? more.join("; ") : clean(first);
  return all === clean(first) ? h(all) : `<span data-ui="sq">${h(clean(first))}</span><span data-ui="en">${h(all)}</span>`;
}

// Headwords that are also an inflected form of a more common word (arti: Bosnian pine, but mostly "the art").
// Forms an editor linked by hand (korrigjime/forma.txt: bë → bëhem) have no grammar tags but count too.
const formOfMap = new Map<string, { word: string; tags: string[]; editor: boolean }[]>();
for (const x of words) {
  // the most specific description of the form (definite, nominative, singular)
  const best = new Map<string, string[]>();
  const byEditor = new Set<string>();
  for (const e of x.entries)
    for (const f of e.forms ?? []) {
      if (f.form === x.word || !byWord.has(f.form)) continue;
      if (f.tags.includes("editor")) byEditor.add(f.form);
      const tags = f.tags.filter((tag) => FORM_TAG_SQ[tag]);
      if (tags.length > (best.get(f.form)?.length ?? -1)) best.set(f.form, tags);
    }
  for (const [form, tags] of best) formOfMap.set(form, [...(formOfMap.get(form) ?? []), { word: x.word, tags, editor: byEditor.has(form) }]);
}
function formOf(w: Word): { word: string; tags: string[]; editor: boolean }[] {
  const near = new Set([...(w.variantOf ?? []).map((v) => v.word), ...(w.dialects ?? []).map((d) => d.form)]);
  return (formOfMap.get(w.word) ?? [])
    .filter((x) => !near.has(x.word) && (byWord.get(x.word)?.frequency ?? 0) > (w.frequency ?? 0) && (x.tags.length || x.editor))
    .sort((a, b) => (byWord.get(b.word)?.frequency ?? 0) - (byWord.get(a.word)?.frequency ?? 0))
    .slice(0, 2);
}

// Multi-word entries and the words they are made of: dhembje koke → dhembje + koke (a form of kokë).
// Small linking words (e, i, të, me…) are shown but not linked.
const LINKERS = new Set(["e", "i", "të", "së", "u", "a", "me", "në", "për", "nga", "se", "një", "por", "dhe", "kur", "pa", "si", "qysh"]);
const formOwner = new Map<string, string>();
for (const x of words)
  for (const e of x.entries)
    for (const f of e.forms ?? []) {
      if (f.form.includes(" ") || f.form === x.word) continue;
      const cur = formOwner.get(f.form);
      if (!cur || (byWord.get(cur)?.frequency ?? 0) < (x.frequency ?? 0)) formOwner.set(f.form, x.word);
    }
function partsOf(w: Word): { token: string; main?: string }[] {
  if (!w.word.includes(" ")) return [];
  return w.word.split(" ").map((token) => {
    const t = token.toLowerCase().replace(/^s'/, "");
    if (LINKERS.has(t)) return { token };
    if (byWord.has(t)) return { token, main: t };
    const owner = formOwner.get(t);
    return owner ? { token, main: owner } : { token };
  });
}
const expressionsWith = new Map<string, string[]>();
for (const x of words)
  for (const p of partsOf(x))
    if (p.main && p.main !== x.word) {
      const list = expressionsWith.get(p.main) ?? [];
      if (!list.includes(x.word)) list.push(x.word);
      expressionsWith.set(p.main, list);
    }

/** "Përbëhet nga": the words of a multi-word entry, each linked to its page. */
function partsNote(w: Word): string {
  const parts = partsOf(w);
  if (!parts.some((p) => p.main)) return "";
  const html = parts
    .map((p) => {
      if (!p.main) return `<span class="muted">${h(p.token)}</span>`;
      const same = p.main === p.token.toLowerCase().replace(/^s'/, "");
      return `<a href="${wordUrl(p.main)}" lang="sq">${h(p.token)}</a>${same ? "" : ` <small class="muted">(${bi("nga", "from")} <a href="${wordUrl(p.main)}" lang="sq">${h(p.main)}</a>)</small>`}`;
    })
    .join(" + ");
  return `<p class="variant-note parts-note">${bi("Përbëhet nga fjalët", "Made up of")} ${html}</p>`;
}

/** Expressions, terms and proverbs that use this word (çaj → çaj i gjelbër, çaj mali…). */
function expressionsCard(w: Word): string {
  const list = (expressionsWith.get(w.word) ?? []).map((x) => byWord.get(x)!).filter(Boolean);
  if (!list.length) return "";
  list.sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0) || compareSq(a.word, b.word));
  return `<section class="entry card"><h2 class="sub">${bi("Shprehje me këtë fjalë", "Expressions with this word")}</h2><ul class="expr-list">${list
    .slice(0, 16)
    .map((x) => {
      // one language at a time: the Albanian description on the Albanian site, the English meaning on the English one
      const sq = x.description ? short(x.description.text) : "";
      const en = shortGloss(x);
      const note = sq && en ? `<span class="muted small" data-ui="sq" lang="sq">${h(sq)}</span><span class="muted small" data-ui="en" lang="en">${h(en)}</span>` : sq || en ? `<span class="muted small">${h(sq || en)}</span>` : "";
      return `<li><a href="${wordUrl(x.word)}" lang="sq">${h(x.word)}</a> ${note}</li>`;
    })
    .join("")}</ul></section>`;
}

function wordPage(w: Word): string {
  const variant = (w.variantOf ?? [])
    .map((v) => {
      const kind = {
        gheg: bi("Formë gege", "Gheg form"),
        tosk: bi("Formë toske", "Tosk form"),
        arberesh: bi("Formë arbëreshe (Itali)", "Arbëresh form (Italy)"),
        arvanitika: bi("Formë arvanitase (Greqi)", "Arvanitika form (Greece)"),
        alternative: bi("Formë tjetër", "Alternative form"),
      }[v.kind];
      const target = byWord.has(v.word) ? `<a href="${wordUrl(v.word)}">${h(v.word)}</a>` : `<b>${h(v.word)}</b>`;
      return `<p class="variant-note"><span class="dialect-dot ${v.kind}"></span>${kind} ${bi("e fjalës", "of")} ${target}</p>`;
    })
    .join("");
  // "also the definite form of art": most uses of this spelling are that word, not this one
  const alsoForm = formOf(w);
  const alsoNote = alsoForm
    .map((x) => {
      const tags = [...new Set(x.tags)].slice(0, 4);
      const sq = tags.map((tag) => FORM_TAG_SQ[tag]).join(", ");
      return `<p class="variant-note also-form">${bi("Edhe trajtë e fjalës", "Also a form of")} <a href="${wordUrl(x.word)}">${h(x.word)}</a>${tags.length ? ` <small>(${bi(sq, tags.join(", "))})</small>` : ""}</p>`;
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

  // English meaning; a dialect or variant form without its own borrows the main word's (shown in English mode first)
  const ownGloss = w.entries.flatMap((e) => e.senses).find((s) => s.lang === "en")?.gloss ?? "";
  const mainWord = ownGloss ? undefined : [...(w.variantOf ?? []).map((v) => v.word), w.description?.text.match(/^(?:Formë|Trajtë)[^«]*«([^»]+)»/)?.[1]].map((x) => (x ? byWord.get(x) : undefined)).find((x) => x?.entries.some((e) => e.senses.some((s) => s.lang === "en")));
  const mainGloss = mainWord?.entries.flatMap((e) => e.senses).find((s) => s.lang === "en")?.gloss ?? "";
  const firstGloss = ownGloss;
  const ipa = [...new Set(w.entries.flatMap((e) => e.ipa ?? []))];
  const pos = [...new Set(w.entries.map((e) => e.pos))].filter((p) => p !== "other"); // "other" = word class unknown
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
  // the count is mostly the other word's form, so it says nothing about this word
  const mostlyOther = alsoForm.some((x) => (byWord.get(x.word)?.frequency ?? 0) > 2 * (w.frequency ?? 0));
  if (!mostlyOther) facts.push([bi("Përdorimi", "Usage"), usageHtml(w.frequency)]);

  const approx = w.entries.some((e) => e.senses.some((x) => x.source === "auto"));
  // words without an Albanian description yet; the sources are named only on /burimet/
  const unverified = w.unverified && !w.description
    ? `<section class="card unverified">
      <h2>${icon.sparkle(18)} ${approx ? bi("Fjalë e re, me kuptim të përafërt", "New word, approximate meaning") : bi("Fjalë e re, ende pa kuptim", "New word, no meaning yet")}</h2>
      <p>${approx ? bi("Kuptimi më poshtë është i përafërt. Kuptimi i plotë do të shtohet më vonë.", "The meaning below is approximate. A full meaning will be added later.") : bi("Kuptimi do të shtohet më vonë.", "Its meaning will be added later.")}</p>
    </section>`
    : "";

  const body = `
${breadcrumbs([[t("home"), url("/")], [`${t("letter")} ${h(letter.toUpperCase())}`, letterUrl(letter)], [h(w.word), null]])}
<div class="word-layout">
  <article class="word-main">
    <header class="word-hero">
      <div class="word-title">
        <h1 lang="sq">${h(w.word)}</h1>
        <button type="button" class="icon-btn copy-btn" data-copy="${h(w.word)}" aria-label="${h("Kopjo fjalën / Copy word")}" title="${h("Kopjo")}">${icon.copy(18)}<span class="copied">${icon.check(18)}</span></button>
      </div>
      <p class="word-sub">${pos.map((p) => `<span class="pos-pill">${bi(POS_SQ[p], POS_EN[p])}</span>`).join("")}${loanLabel(w)}${(w.dialectOnly ?? []).map((d) => `<span class="word-label dialect-label"><span class="dialect-dot ${d}"></span>${bi(`Fjalë ${({ arberesh: "arbëreshe", arvanitika: "arvanitase", gheg: "gege", tosk: "toske" } as Record<string, string>)[d]}`, `${({ arberesh: "Arbëresh", arvanitika: "Arvanitika", gheg: "Gheg", tosk: "Tosk" } as Record<string, string>)[d]} word`)}</span>`).join("")}${(w.labels ?? []).filter((l) => !(w.dialectOnly && /^(Arbëresh|Arvanitika)$/.test(l))).map((l) => `<span class="word-label">${bi(TAG_SQ[l] ?? l, l)}</span>`).join("")}${ipa.length ? `<span class="ipa">${h(ipa[0])}</span>` : ""}</p>
      ${albanianInstead(w)}
      <div class="word-meanings">
      ${w.description ? `<p class="word-desc" lang="sq"><span class="lang-badge sq">SQ</span> ${h(w.description.text)}</p>` : ""}
      ${firstGloss ? `<p class="word-summary" lang="en"><span class="lang-badge">EN</span>${approx ? `<span class="approx">≈ ${bi("i përafërt", "approximate")}</span>` : ""} ${enSummary(w, firstGloss)}</p>` : mainWord ? `<p class="word-summary" lang="en"><span class="lang-badge">EN</span> ${h(mainGloss.replace(/[“”]/g, ""))} <span class="muted small">(${bi("si", "as")} <a href="${wordUrl(mainWord.word)}" lang="sq">${h(mainWord.word)}</a>)</span></p>` : `<p class="word-summary no-english" data-ui="en" lang="en"><span class="lang-badge">EN</span> <i>No English meaning yet — the Albanian description is below.</i></p>`}
      </div>
      ${variant}${alsoNote}${partsNote(w)}
      ${reportBox(w)}
    </header>
    ${unverified}
    ${sameMeaningCard(w)}
    ${w.unverified && !approx ? "" : w.entries.filter((e) => !w.unverified || e.senses.length).map(entryHtml).join("")}
    ${borrowed}
    ${examplesCard(w)}
    ${expressionsCard(w)}
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
  // search result / link preview text: the Albanian description first, then the English meaning
  const metaDesc = metaText(
    [
      w.description ? `${w.word}: ${w.description.text.replace(/\.$/, "")}.` : `${w.word}${pos.length ? ` (${pos.map((p) => POS_SQ[p]).join(", ")})` : ""}.`,
      firstGloss ? `Anglisht: ${firstGloss}.` : "",
      "Kuptimi, format dhe sinonimet në Fjalorin e hapur shqip.",
    ]
      .filter(Boolean)
      .join(" "),
  );
  const pagePath = `/fjala/${encodeURIComponent(slug(w.word))}/`;
  return layout({
    title: `${w.word} — kuptimi | FjaloriShqip`,
    description: metaDesc,
    body,
    canonical: pagePath,
    ogType: "article",
    structured: SITE_URL
      ? [
          {
            "@type": "DefinedTerm",
            name: w.word,
            inLanguage: "sq",
            ...(w.description || firstGloss ? { description: w.description?.text ?? firstGloss } : {}),
            url: absolute(pagePath),
            inDefinedTermSet: { "@type": "DefinedTermSet", name: SITE_NAME, url: absolute("/") },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: SITE_NAME, item: absolute("/") },
              { "@type": "ListItem", position: 2, name: letter.toUpperCase(), item: absolute(`/shkronja/${encodeURIComponent(letter)}/`) },
              { "@type": "ListItem", position: 3, name: w.word, item: absolute(pagePath) },
            ],
          },
        ]
      : [],
  });
}

/**
 * "Raporto / Sugjero": a small popup on every word page. One tap on what is wrong sends it (public/app.js →
 * POST /raporto → the weekly list emailed to the author, src/worker/report.ts); a short box takes a suggestion.
 */
function reportBox(w: Word): string {
  const option = (kind: string, sq: string, en: string) => `<button type="button" class="report-opt" data-kind="${kind}">${bi(sq, en)}</button>`;
  return `<div class="report" data-word="${h(w.word)}">
  <button type="button" class="report-btn" aria-expanded="false">${icon.flag(16)} <span class="report-label">${bi("Raporto ose sugjero", "Report or suggest")}</span></button>
  <div class="report-pop" hidden>
    <p class="report-q">${bi("Çfarë nuk shkon me këtë fjalë?", "What is wrong with this word?")}</p>
    <div class="report-opts">
      ${option("kuptimi", "Kuptimi anglisht është i gabuar", "The English meaning is wrong")}
      ${option("pershkrimi", "Përshkrimi shqip është i gabuar", "The Albanian description is wrong")}
      ${option("lloji", "Lloji i fjalës është i gabuar", "The word class is wrong")}
      ${option("fyese", "Fjalë fyese a e papërshtatshme", "Offensive or inappropriate")}
    </div>
    <label class="report-suggest">${bi("Ose sugjeroni një përshkrim a kuptim më të mirë:", "Or suggest a better description or meaning:")}
      <textarea rows="2" maxlength="1000"></textarea></label>
    <button type="button" class="btn btn-primary btn-sm report-opt" data-kind="sugjerim">${bi("Dërgo sugjerimin", "Send suggestion")}</button>
    <p class="report-note muted small">${bi("Pa llogari e pa email. Raportet i lexon autori çdo javë.", "No account, no email. The author reads the reports every week.")}</p>
  </div>
</div>`;
}

/** Example sentences that use the word (Tatoeba; the source is named on /burimet/). */
function examplesCard(w: Word): string {
  if (!w.examples?.length) return "";
  return `<section class="entry card"><h2 class="sub">${bi("Shembuj përdorimi", "Example sentences")}</h2><ul class="examples">${w.examples
    .map((e) => `<li><span class="ex-sq" lang="sq">${h(e.text)}</span>${e.english ? `<span class="ex-en" data-ui="en" lang="en">${h(e.english)}</span>` : ""}</li>`)
    .join("")}</ul></section>`;
}

/** "Me të njëjtin kuptim": dialect forms and other words that mean the same thing. */
/** Small label "huazim · nga latinishtja" for borrowed words. */
function loanLabel(w: Word): string {
  if (!w.loan) return "";
  const from = w.loan.from === "international" ? bi("fjalë ndërkombëtare", "international word") : bi(`nga ${LANGUAGE_SQ[w.loan.from] ?? w.loan.from}`, `from ${w.loan.from}`);
  return `<span class="loan-label" title="${h("Fjalë e huazuar nga një gjuhë tjetër / Borrowed from another language")}">${bi("huazim", "borrowed")} · ${from}</span>`;
}

/** Albanian words with the same meaning as a borrowed word (abuzoj → shpërdoroj, keqpërdoroj). */
function albanianAlternatives(w: Word): string[] {
  if (!w.loan) return [];
  return sameMeaning(w)
    .filter((x) => (x.how === "listed" || x.how === "same") && !byWord.get(x.word)?.loan && !byWord.get(x.word)?.unverified)
    .map((x) => x.word)
    .slice(0, 6);
}

/** One line under the headword of a borrowed word, pointing to the Albanian words. */
function albanianInstead(w: Word): string {
  const alt = albanianAlternatives(w);
  if (!alt.length) return "";
  return `<p class="albanian-instead">${icon.sparkle(16)} ${bi("Në shqip mund të thuhet edhe:", "In Albanian you can also say:")} ${alt.map((x) => `<a href="${wordUrl(x)}" lang="sq">${h(x)}</a>`).join(", ")}</p>`;
}

// ── word family: the main standard word, other words with the same meaning, dialect forms ──
const DIALECT_LABEL: Record<string, Dialect> = { Gheg: "gheg", Tosk: "tosk", "Arbëresh": "arberesh", Arvanitika: "arvanitika" };
/** The dialects a word belongs to; empty for a standard word. */
function dialectsOf(x: Word): Dialect[] {
  const out = new Set<Dialect>(x.dialectOnly ?? []);
  for (const v of x.variantOf ?? []) if (v.kind !== "alternative") out.add(v.kind);
  for (const l of x.labels ?? []) if (DIALECT_LABEL[l]) out.add(DIALECT_LABEL[l]);
  const senses = x.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en");
  for (const d of Object.keys(DIALECT_LABEL)) if (senses.length && senses.every((s) => s.tags?.includes(d))) out.add(DIALECT_LABEL[d]);
  return DIALECT_ORDER.filter((d) => out.has(d));
}
/** Words the editors chose as the main word of their family (korrigjime/kryesore.txt). */
const MAIN_WORDS = new Set(
  (fs.existsSync(path.join(ROOT, "korrigjime", "kryesore.txt")) ? fs.readFileSync(path.join(ROOT, "korrigjime", "kryesore.txt"), "utf8") : "")
    .split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean),
);
const isStandard = (x: Word) => !dialectsOf(x).length && !x.unverified;
/** Same main meaning or listed as a synonym (not words for a word's other meanings). */
const closeWords = (x: Word) => sameMeaning(x).filter((m) => m.how === "listed" || m.how === "same").map((m) => m.word);

interface Family { main: Word; others: string[]; dialects: Map<string, Dialect[]>; other: string[] }
/**
 * The family of a word: its main standard word (the most used), the other standard words with the same
 * meaning, and the dialect forms of all of them, so nënë, ëmë, mëmë, mami, nanë and nonë show the same family.
 */
function family(w: Word): Family | null {
  const std = w.variantOf?.length && w.variantOf[0].kind !== "alternative" ? byWord.get(w.variantOf[0].word) : undefined;
  const base = std ?? w;
  const near = [base.word, ...closeWords(base)].map((x) => byWord.get(x)!).filter(Boolean);
  // the main word: the most used standard word, its use shared out over its meanings
  // (shqipe is used mostly for the language, so shqiponjë is the main word for "eagle")
  const senseCount = (x: Word) => Math.max(1, x.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "auto").length);
  const score = (x: Word) => (x.frequency ?? 0) / senseCount(x);
  const standard = near.filter(isStandard).sort((a, b) => Number(MAIN_WORDS.has(b.word)) - Number(MAIN_WORDS.has(a.word)) || score(b) - score(a) || Number(!!a.loan) - Number(!!b.loan));
  const main = standard.find((x) => !x.loan) ?? standard[0] ?? base;
  const members = new Set<string>([main.word, ...closeWords(main), ...near.map((x) => x.word)]);
  const others: string[] = [];
  const dialects = new Map<string, Dialect[]>();
  const addDialect = (form: string, ds: Dialect[]) => dialects.set(form, [...new Set([...(dialects.get(form) ?? []), ...ds])]);
  for (const m of members) {
    const x = byWord.get(m);
    if (!x) continue;
    const ds = dialectsOf(x);
    if (ds.length) addDialect(m, ds);
    else if (m !== main.word) others.push(m);
    for (const d of x.dialects ?? []) addDialect(d.form, [d.dialect]);
  }
  others.sort((a, b) => (byWord.get(b)?.frequency ?? 0) - (byWord.get(a)?.frequency ?? 0));
  for (const o of [main.word, ...others]) dialects.delete(o);
  const other = sameMeaning(base).filter((m) => m.how === "other" && !members.has(m.word)).map((m) => m.word);
  if (!others.length && !dialects.size && main === w && !other.length) return null;
  return { main, others: others.slice(0, 14), dialects, other };
}

// ── words of the same root: adresë, adresoj, adresohem, adresim ──────────────
const firstMeaning = (x: string) => {
  const w = byWord.get(x);
  return w && !w.unverified ? w.entries.flatMap((e) => e.senses).find((s) => s.lang === "en" && s.source !== "auto")?.gloss : undefined;
};
/** The word a word is formed from: adresohem ← adresoj, adresim ← adresoj, akademik ← akademi. */
function formedFrom(w: string): string | undefined {
  // middle voice and participles of verbs: adresohem, adresuar ← adresoj; shkruhem ← shkruaj; fshihem ← fshij
  for (const [end, verb] of [["ohem", "oj"], ["ohet", "oj"], ["uar", "oj"], ["ehem", "ej"], ["yhem", "yej"], ["uhem", "uaj"], ["ihem", "ij"], ["hem", "j"]] as const)
    if (w.endsWith(end) && w.length - end.length >= 3 && byWord.has(w.slice(0, -end.length) + verb)) return w.slice(0, -end.length) + verb;
  // verbs and nouns formed from a noun or adjective: adresoj ← adresë, akademik ← akademi, punëtor ← punë
  // adverbs and act nouns: aktualisht ← aktual, punim ← punoj, larje ← laj, mësues ← mësoj
  for (const [end, bases] of [["isht", ["", "ë", "ëm"]], ["ësisht", ["ëm", "ë", ""]], ["im", ["oj", "ej", "ij", "yej"]], ["je", ["", "j"]], ["tje", ["j"]], ["ues", ["oj", "uaj"]], ["yes", ["ej", "yej"]], ["ueshëm", ["oj", "uaj"]]] as const) {
    if (!w.endsWith(end) || w.length - end.length < 3) continue;
    const stem = w.slice(0, -end.length);
    for (const b of bases) if (stem + b !== w && byWord.get(stem + b) && !byWord.get(stem + b)!.unverified) return stem + b;
  }
  // nouns from adjectives: bukuri ← bukur, mirësi ← mirë
  if (w.endsWith("i") && w.length >= 6) {
    const adj = byWord.get(w.slice(0, -1));
    if (adj && !adj.unverified && adj.entries.some((e) => e.pos === "adj")) return adj.word;
  }
  for (const [end, bases] of [["oj", ["", "ë", "e", "i"]], ["ëzoj", ["ë", ""]], ["ik", ["", "ë", "i"]], ["ist", ["", "ë", "i"]], ["izëm", ["", "ë", "i"]], ["tor", ["", "ë"]], ["tar", ["", "ë"]], ["ësi", ["ë", ""]], ["shëm", ["", "ë"]]] as const) {
    if (!w.endsWith(end) || w.length - end.length < 3) continue;
    const stem = w.slice(0, -end.length);
    for (const b of bases) if (stem + b !== w && byWord.has(stem + b) && !byWord.get(stem + b)!.unverified) return stem + b;
  }
  const d = deriveMeaning(w, firstMeaning, new Set());
  if (!d || d.rule === "compound" || d.rule === "international" || !byWord.has(d.base) || d.base === w) return undefined;
  return d.base;
}
const parentOf = new Map<string, string>();
for (const w of words) if (!w.unverified) { const p = formedFrom(w.word); if (p) parentOf.set(w.word, p); }
const rootWord = (w: string) => { let r = w; for (let i = 0; i < 4 && parentOf.has(r); i++) r = parentOf.get(r)!; return r; };
const byRoot = new Map<string, string[]>();
for (const w of words) if (!w.unverified) push(byRoot, rootWord(w.word), w.word);
/** Words formed from the same root, the most used first (at most 12). */
function sameRoot(w: Word, skip: Set<string>): string[] {
  return (byRoot.get(rootWord(w.word)) ?? []).filter((x) => x !== w.word && !skip.has(x)).sort((a, b) => (byWord.get(b)?.frequency ?? 0) - (byWord.get(a)?.frequency ?? 0)).slice(0, 12);
}

/** Where the dialect books say a form is used: Kristoforidhi's region column, Jungg's Shkodër. */
const placeOf = new Map<string, string>();
{
  const PLACE: Record<string, string> = { Σ: "Shkodër", bogdan: "Bogdani", Budi: "Budi", Jakovë: "Gjakovë", Jakova: "Gjakovë" };
  const dir = path.join(process.cwd(), "dialekte");
  for (const [file, fixed] of [["kristoforidhi-1904.tsv", ""], ["gazulli-1942.tsv", ""], ["dozon-1879.tsv", ""], ["jungg-1895.tsv", "Shkodër"]] as const) {
    const f = path.join(dir, file);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const cols = line.split("\t");
      const region = fixed || cols[7] || "";
      const place = PLACE[region] ?? (/^[A-ZÇË][a-zçë]+$/.test(region) && region !== "Arbëresh" ? region : "");
      if (place && !placeOf.has(cols[0])) placeOf.set(cols[0], place);
    }
  }
}

function sameMeaningCard(w: Word): string {
  const fam = family(w);
  const albanian = albanianAlternatives(w);
  const shown = new Set<string>(fam ? [fam.main.word, ...fam.others, ...fam.dialects.keys(), ...fam.other] : albanian);
  const root = sameRoot(w, shown);
  if (!fam && !albanian.length && !root.length) return "";
  // the hint under each chip: the Albanian description in Albanian mode, the English meaning in English mode
  const cut = (s: string) => (s.length > 28 ? `${s.slice(0, 26)}…` : s);
  const meaning = (x: string) => {
    const word = byWord.get(x);
    if (!word) return "";
    const g = shortGloss(word);
    const en = g && !g.startsWith("→") ? cut(g) : "";
    const sq = word.description ? cut(word.description.text.replace(/^(Formë \S+|Trajtë [^«]*) e fjalës «[^»]+»: /, "").replace(/\.$/, "")) : "";
    if (!sq && !en) return "";
    return `<small>${bi(sq || en, en || sq)}</small>`;
  };
  const chip = (x: string, cls = "", gloss = true) => {
    const here = x === w.word ? " here" : "";
    return byWord.has(x) && !here
      ? `<a class="syn-chip${cls}" href="${wordUrl(x)}" lang="sq"><span class="w">${h(x)}</span>${gloss ? meaning(x) : ""}</a>`
      : `<span class="syn-chip${cls}${here}"${here ? ` aria-current="page"` : ""}><span class="w" lang="sq">${h(x)}</span>${here ? `<small>${bi("kjo fjalë", "this word")}</small>` : gloss ? meaning(x) : ""}</span>`;
  };
  const row = (title: string, chips: string, cls = "") => `<div class="syn-row${cls}"><h3>${title}</h3><div class="syn-chips">${chips}</div></div>`;
  const rows: string[] = [];
  if (albanian.length && !fam) rows.push(row(`${bi("Fjala shqipe", "The Albanian word")} <small>${bi("në vend të fjalës së huazuar", "instead of the borrowed word")}</small>`, albanian.map((x) => chip(x)).join(""), " albanian-row"));
  if (fam) {
    rows.push(row(bi("Fjala kryesore", "Main word"), chip(fam.main.word, " main"), " main-row"));
    if (fam.others.length) rows.push(row(bi("Fjalë të tjera me të njëjtin kuptim", "Other words with the same meaning"), fam.others.map((x) => chip(x)).join("")));
    for (const d of DIALECT_ORDER) {
      const forms = [...fam.dialects].filter(([, ds]) => ds.includes(d)).map(([f]) => f);
      // the place (or old writer) a dialect book gives for the form: dinok (Krujë), agjnoj (Budi)
      const place = (x: string) => (placeOf.has(x) ? `<small>${h(placeOf.get(x)!)}</small>` : "");
      if (forms.length) rows.push(row(`<span class="dialect-dot ${d}"></span>${t(d)}`, forms.slice(0, 12).map((x) => chip(x, "", false).replace(/<\/(a|span)>$/, `${place(x)}</$1>`)).join("")));
    }
    if (fam.other.length) rows.push(row(bi("Për kuptimet e tjera", "For its other meanings"), fam.other.slice(0, 4).map((x) => chip(x, " also")).join("")));
  }
  if (root.length) rows.push(row(bi("Fjalë nga e njëjta rrënjë", "Words from the same root"), root.map((x) => chip(x, " also")).join("")));
  return `<section class="card same-meaning">
  <h2>${icon.layers(18)} ${bi("Familja e fjalës", "Word family")}</h2>
  ${rows.join("\n  ")}
</section>`;
}

// ── letter pages ─────────────────────────────────────────────────────────────
function letterNav(active: string, withCounts = false): string {
  return `<nav class="letters${withCounts ? " letters-tiles" : ""}" aria-label="${h("Alfabeti")}">${ALPHABET.map(
    (l) =>
      `<a href="${letterUrl(l)}"${l === active ? ' aria-current="page"' : ""}><span class="l">${h(l.charAt(0).toUpperCase() + l.slice(1))}</span>${withCounts ? `<small>${num(letterCounts.get(l) ?? 0)}</small>` : ""}</a>`,
  ).join("")}</nav>`;
}

function shortGloss(w: Word): string {
  const s = w.entries.flatMap((e) => e.senses).find((x) => x.lang === "en");
  const g = s ? (s.source === "auto" ? `≈ ${s.gloss.replace(/[“”]/g, "")}` : s.gloss) : w.variantOf?.length ? `→ ${w.variantOf[0].word}` : "";
  return g.length > 70 ? `${g.slice(0, 67)}…` : g;
}

const short = (x: string) => (x.length > 70 ? `${x.slice(0, 67)}…` : x);

function wordCard(w: Word): string {
  const e = w.entries[0];
  const dialect = w.variantOf?.[0]?.kind;
  const gloss = shortGloss(w);
  return `<li><a href="${wordUrl(w.word)}"><span class="wc-word" lang="sq">${h(w.word)}</span>${e && e.pos !== "other" ? `<span class="wc-pos">${bi(POS_SQ[e.pos], POS_EN[e.pos])}</span>` : dialect && dialect !== "alternative" ? `<span class="wc-pos"><span class="dialect-dot ${dialect}"></span>${dialect === "gheg" ? t("gheg") : t("tosk")}</span>` : ""}<span class="wc-gloss">${w.description ? `<span data-ui="sq">${h(short(w.description.text))}</span><span data-ui="en">${gloss ? h(gloss) : h(short(w.description.text))}</span>` : gloss ? h(gloss) : `<i class="no-meaning">${bi("ende pa kuptim", "no meaning yet")}</i>`}</span></a></li>`;
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
      write(`shkronja/${l}/${p === 1 ? "" : `${p}/`}index.html`, layout({
          title: `${l.toUpperCase()} — fjalët shqipe${pages > 1 ? ` (${p}/${pages})` : ""} | FjaloriShqip`,
          description: `Fjalët shqipe që fillojnë me ${l.toUpperCase()}${pages > 1 ? `, faqja ${p} nga ${pages}` : ""}: ${num(list.length)} fjalë me kuptimet në shqip dhe anglisht.`,
          body,
          active: "browse",
          canonical: `/shkronja/${encodeURIComponent(l)}/${p === 1 ? "" : `${p}/`}`,
        }));
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

<section class="section dialect-browse">
  <header class="section-head"><h2>${bi("Fjalët sipas dialektit", "Words by dialect")}</h2><p class="muted">${bi("Shfletoni dhe kërkoni fjalët e çdo dialekti.", "Browse and search the words of each dialect.")}</p></header>
  <div class="dialect-cards">
    <div class="dialect-card total-card" aria-label="${h(UI_STATS)}"><span class="dc-name">${bi("Gjithsej", "In total")}</span><b>${num(stats.words)}</b><small>${bi("Fjalë në fjalor", "Words in the dictionary")}</small></div>
    <a class="dialect-card" href="${letterUrl("a")}"><span class="dc-name"><span class="dialect-dot standard"></span>${bi("Standarde", "Standard")}</span><b>${num(stats.standardWords)}</b><small>${bi("Fjalët e gjuhës standarde", "Words of the standard language")}</small></a>
    ${DIALECT_ORDER.map((d) => `<a class="dialect-card" href="${dialectUrl(d)}"><span class="dc-name"><span class="dialect-dot ${d}"></span>${t(d)}</span><b>${num(stats.dialectForms?.[d] ?? 0)}</b><small>${bi(DIALECT_INFO[d].whereSq, DIALECT_INFO[d].whereEn)}</small></a>`).join("\n    ")}
  </div>
</section>

<section class="section">
  <header class="section-head"><h2>${bi("Çfarë gjeni këtu", "What you will find")}</h2></header>
  <div class="tile-grid">
    ${featureTile(icon.book(24), bi("Kuptimet", "Meanings"), bi("Kuptimi në anglisht, shembuj dhe shqiptimi i fjalës.", "English meanings, examples and pronunciation."), url("/fjala/zem%C3%ABr/"))}
    ${featureTile(icon.layers(24), bi("Zgjedhimi dhe lakimi", "Conjugation and declension"), bi("Të gjitha kohët e foljeve dhe rasat e emrave.", "Every verb tense and every noun case."), url("/fjala/punoj/"))}
    ${featureTile(icon.map(24), bi("Dialektet", "Dialects"), bi("Format gege, toske, arbëreshe dhe arvanitase pranë fjalës standarde.", "Gheg, Tosk, Arbëresh and Arvanitika forms next to the standard word."), url("/fjala/n%C3%ABn%C3%AB/"))}
    ${featureTile(icon.code(24), bi("API falas", "Free API"), bi("JSON statik për aplikacionet tuaja, pa çelës.", "Static JSON for your apps, no key needed."), url("/api/"))}
    ${featureTile(icon.bell(24), bi("Aplikacioni dhe njoftimet", "App and notifications"), bi("Instaloni fjalorin në telefon dhe merrni fjalën e ditës çdo mëngjes.", "Install the dictionary on your phone and get the word of the day every morning."), url("/aplikacioni/"))}
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
</section>

<section class="section prose">
 <div data-ui="sq" lang="sq">
  <h2>Fjalor i hapur shqip–anglisht</h2>
  <p>FjaloriShqip është një <b>fjalor shqip</b> falas dhe me kod të hapur, me ${num(stats.words ?? words.length)} fjalë shqip: të gjitha me një përshkrim të shkurtër në shqip dhe ${num(stats.withEnglish)} me kuptimin në anglisht, si edhe format gege e toske, fjalët me të njëjtin kuptim dhe, për ${num(stats.withInflection)} fjalë, zgjedhimin ose lakimin e plotë. Mund të kërkoni shqip ose anglisht (p.sh. “mother” gjen <a href="${wordUrl("nënë")}">nënë</a>), dhe ë e ç nuk janë të detyrueshme.</p>
  <p>Të gjitha të dhënat vijnë nga burime me licencë të hapur dhe mund të ripërdoren lirisht sipas CC BY-SA 4.0, edhe nëpërmjet një <a href="${url("/api/")}">API-je JSON</a> falas për zhvilluesit. Nuk nevojitet llogari as çelës.</p>
 </div>
 <div data-ui="en" lang="en">
  <h2>Free Albanian–English dictionary</h2>
  <p>FjaloriShqip is a free, open-source <b>Albanian dictionary</b> with ${numEn(stats.words ?? words.length)} Albanian words: ${numEn(words.filter((w) => w.description).length)} with a short description in Albanian and ${numEn(stats.withEnglish)} with their English meaning, plus Gheg and Tosk dialect forms, words with the same meaning and, for ${numEn(stats.withInflection)} words, the full conjugation or declension. You can search in Albanian or in English (for example “mother” finds <a href="${wordUrl("nënë")}">nënë</a>), and typing ë and ç is optional.</p>
  <p>All data comes from openly licensed sources and is free to reuse under CC BY-SA 4.0, also through a free <a href="${url("/api/")}">JSON API</a> for developers. No account or API key is needed.</p>
 </div>
</section>`;
  return layout({
    title: "FjaloriShqip — Fjalori i hapur shqip | Free Albanian–English Dictionary",
    description: "Fjalor i hapur i gjuhës shqipe: kuptimet në shqip dhe anglisht, format gege e toske, zgjedhimi i foljeve dhe API falas. Free Albanian–English dictionary.",
    body,
    active: "home",
    canonical: "/",
    headerSearch: false,
    structured: SITE_URL
      ? [
          {
            "@type": "WebSite",
            name: SITE_NAME,
            alternateName: "Fjalori i hapur i gjuhës shqipe",
            url: absolute("/"),
            inLanguage: "sq",
            // lets search engines show a search box for the site
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: `${absolute("/kerko/")}?q={search_term_string}` },
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "Organization",
            name: SITE_NAME,
            url: absolute("/"),
            logo: absolute("/icon-512.png"),
            description: "Free, open-source dictionary of the Albanian language (Albanian–English).",
            sameAs: [REPO_URL],
          },
        ]
      : [],
  });
}
const UI_STATS = "Fjalori sot";

// ── static info pages ────────────────────────────────────────────────────────
function sourcesPage(): string {
  // one entry per source, in the order they matter to the dictionary
  type Ref = { title: string; author: string; link: string; licence: string; licenceUrl: string; sq: string; en: string };
  const CC_BY_SA = "https://creativecommons.org/licenses/by-sa/4.0/";
  const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";
  const refs: Ref[] = [
    { title: "Wiktionary", author: "Wikimedia Foundation dhe kontribuesit e Wiktionary (përpunuar nga kaikki.org)", link: "https://en.wiktionary.org/wiki/Category:Albanian_language", licence: "CC BY-SA 4.0", licenceUrl: CC_BY_SA,
      sq: "Fjalët, kuptimet në anglisht, format e lakimit e zgjedhimit, shqiptimi, shembujt dhe format dialektore; edhe fjalë nga 18 botime të tjera gjuhësore.", en: "Headwords, English meanings, inflection tables, pronunciation, examples and dialect forms; also words from 18 other language editions." },
    { title: "Wikifjalor", author: "Wikimedia Foundation dhe kontribuesit e Wikifjalorit", link: "https://sq.wiktionary.org/", licence: "CC BY-SA 4.0", licenceUrl: CC_BY_SA,
      sq: "Fjalë, lloji i fjalës dhe gjinia nga faqet e shkruara nga komuniteti.", en: "Words, word class and gender from community-written pages." },
    { title: "Wikidata", author: "Wikimedia Foundation dhe kontribuesit e Wikidata", link: "https://www.wikidata.org/wiki/Wikidata:Lexicographical_data", licence: "CC0 1.0", licenceUrl: CC0,
      sq: "Fjalë, lloji i fjalës dhe kuptime të shkurtra.", en: "Words, word class and short meanings." },
    { title: "Albanet — WordNet shqip", author: "Ervin Ruci, Universiteti i Vlorës (Open Multilingual Wordnet)", link: "https://github.com/omwn/omw-data/tree/main/wns/als", licence: "CC BY 3.0", licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
      sq: "Grupe fjalësh me të njëjtin kuptim dhe fjalë të reja.", en: "Groups of words with the same meaning and new words." },
    { title: "Fjalori drejtshkrimor shqip për Hunspell (sq_AL)", author: "Luan Kelmendi", link: "https://github.com/LibreOffice/dictionaries/tree/master/sq_AL", licence: "GPL-2.0 ose më e re", licenceUrl: "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
      sq: "Lista e fjalëve: fjalë bazë që mungonin në burimet e tjera.", en: "The word list: base words missing from the other sources." },
    { title: "Wikipedia shqip", author: "Wikimedia Foundation dhe kontribuesit e Wikipedias", link: "https://sq.wikipedia.org/", licence: "CC BY-SA 4.0", licenceUrl: CC_BY_SA,
      sq: "Vetëm numërimi i fjalëve, për të ditur sa përdoret secila fjalë. Nuk kopjohet asnjë tekst.", en: "Word counts only, to know how much each word is used. No text is copied." },
    { title: "MaCoCu — korpusi shqip i uebit 1.0", author: "Projekti MaCoCu, depoja CLARIN.SI", link: "http://hdl.handle.net/11356/1804", licence: "CC0 1.0", licenceUrl: CC0,
      sq: "Vetëm numërimi i fjalëve, për të konfirmuar se një fjalë përdoret realisht.", en: "Word counts only, to confirm that a word is really in use." },
    { title: "Etymologisches Wörterbuch der albanesischen Sprache (1891)", author: "Gustav Meyer (1850–1900)", link: "https://archive.org/details/etymologischesw00meyegoog", licence: "Domain publik", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      sq: "Fjalët arbëreshe (Itali) dhe arvanitase (Greqi), të kthyera në drejtshkrimin e sotëm; kuptimet të përkthyera nga gjermanishtja.", en: "Arbëresh (Italy) and Arvanitika (Greece) words, converted to today's spelling; meanings translated from German." },
    { title: "Fialuur i voghel scc'ip e ltinisct (1895)", author: "Jak Jungg (1840–1927)", link: "https://archive.org/details/fialuurivoghels00junkgoog", licence: "Domain publik", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      sq: "Format gege të Shkodrës, të kthyera në drejtshkrimin e sotëm dhe të lidhura me fjalën standarde; kuptimet të përkthyera nga italishtja.", en: "Gheg forms of Shkodër, converted to today's spelling and linked to the standard word; meanings translated from Italian." },
    { title: "Vocabolario epirotico-italiano (1875)", author: "Francesco Rossi da Montalto", link: "https://archive.org/details/rossi-vocabolario-italiano-epirotico-epirotico-italiano", licence: "Domain publik", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      sq: "Disa forma gege, të kthyera në drejtshkrimin e sotëm dhe të lidhura me fjalën standarde; kuptimet të përkthyera nga italishtja.", en: "A few Gheg forms, converted to today's spelling and linked to the standard word; meanings translated from Italian." },
    { title: "Lexikon tis albanikis glossis (1904)", author: "Konstantin Kristoforidhi (1830–1895); skanimi: Universiteti i Vjenës (PHAIDRA)", link: "https://archive.org/details/Lexicon-tes-albanikes-glosses-PHAIDRA_o_102835", licence: "Domain publik", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      sq: "Fjalë e forma gege e toske, të kthyera në drejtshkrimin e sotëm; kuptimet të përkthyera nga greqishtja.", en: "Gheg and Tosk words and forms, converted to today's spelling; meanings translated from Greek." },
    { title: "Fjalorth i ri – Fjalë të rralla të përdoruna në Veri të Shqipnis (1942)", author: "Dom Nikollë Gazulli (1895–1946)", link: "https://archive.org/details/id-9-fjalorth-i-ri-fjale-te-rralla-te-perdoruna-ne-veri-te-shqipnis-visaret-e-kombit", licence: "Domain publik", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      sq: "Fjalë të rralla gege nga Veriu, me vendin ku përdoren; përshkrimet janë tonat.", en: "Rare Gheg words from the North, with where they are used; the descriptions are our own." },
    { title: "Manuel de la langue chkipe ou albanaise (1879)", author: "Auguste Dozon (1822–1890)", link: "https://archive.org/details/manueldelalangue00dozouoft", licence: "Domain publik", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      sq: "Forma toske nga fjalorthi shqip-frëngjisht, të kthyera në drejtshkrimin e sotëm; kuptimet të përkthyera nga frëngjishtja, përshkrimet janë tonat.", en: "Tosk forms from the Albanian–French vocabulary, converted to today's spelling; meanings translated from French, the descriptions are our own." },
    { title: "Tatoeba", author: "Shoqata Tatoeba dhe kontribuesit e saj (autori i secilës fjali në shembuj/tatoeba.tsv)", link: "https://tatoeba.org/", licence: "CC BY 2.0 FR", licenceUrl: "https://creativecommons.org/licenses/by/2.0/fr/",
      sq: "Fjali shembull shqip me përkthimin anglisht, të përzgjedhura e të rishikuara një nga një.", en: "Albanian example sentences with their English translation, selected and reviewed one by one." },
    { title: "Puna e autorit", author: "Endrit Rushiti, me ndihmën e inteligjencës artificiale (Claude, Anthropic)", link: "https://github.com/EndritRushiti/FjaloriShqip", licence: "CC BY-SA 4.0", licenceUrl: CC_BY_SA,
      sq: "Përshkrimet shqip të fjalëve, fjalë dhe kuptime të shtuara e të korrigjuara, kuptime të përafërta të nxjerra nga fjalë të tjera dhe lidhjet ndërmjet fjalëve.", en: "The Albanian descriptions, added and corrected words and meanings, approximate meanings worked out from other words, and the links between words." },
  ];
  const list = refs
    .map((r) => `<li class="ref">
  <div class="ref-main"><cite>${h(r.title)}</cite> <span class="ref-author">— ${h(r.author)}</span></div>
  <p class="ref-use">${bi(r.sq, r.en)}</p>
  <p class="ref-meta"><a href="${r.link}" rel="noopener">${h(r.link.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a> · <a href="${r.licenceUrl}" rel="license noopener">${h(r.licence)}</a></p>
</li>`)
    .join("\n");
  const body = `
${pageHead(
  t("sources"),
  bi("Fjalori ndërtohet vetëm nga burime me licencë të hapur. Këtu janë të gjitha, një herë secili.", "The dictionary is built only from openly licensed sources. Here they all are, each one once."),
  `${icon.shield(16)} ${bi("Burimet dhe licencat", "Sources and licences")}`,
)}
<section class="card refs-card">
  <ol class="refs">
${list}
  </ol>
</section>
<section class="card prose">
  <h2>${bi("Licenca", "Licence")}</h2>
  <p>${bi(
    "Të dhënat e fjalorit publikohen me licencën CC BY-SA 4.0: mund t'i përdorni lirisht, edhe për qëllime tregtare, duke përmendur FjaloriShqip dhe burimet e mësipërme. Fjalët që vijnë vetëm nga lista e Luan Kelmendit mbeten me licencën GPL-2.0 ose më të re. Kodi i faqes është me licencën MIT.",
    "The dictionary data is published under CC BY-SA 4.0: you may use it freely, even commercially, crediting FjaloriShqip and the sources above. Words that come only from Luan Kelmendi's list keep the GPL-2.0-or-later licence. The website's code is MIT-licensed.",
  )}</p>
  <p class="muted">${bi(
    "Nuk përdoren përkufizime ose lista fjalësh nga fjalorë me të drejta autori, si fjalorët e Akademisë së Shkencave. Nëse mendoni se diçka këtu shkel të drejtat tuaja, na shkruani nga faqja «Rreth nesh».",
    "No definitions or word lists are taken from copyrighted dictionaries, such as those of the Academy of Sciences. If you believe something here infringes your rights, write to us from the About page.",
  )}</p>
</section>`;
  return layout({ title: "Burimet — FjaloriShqip", description: "Burimet dhe licencat e Fjalorit të hapur të gjuhës shqipe.", body, active: "sources", canonical: "/burimet/" });
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
    ${endpoint("/api/v1/dialekte.json", "Format e çdo dialekti (gegë, toskë, arbërisht, arvanitisht) me fjalën standarde.", "The forms of each dialect (Gheg, Tosk, Arbëresh, Arvanitika) with the standard word.")}
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
    "Të dhënat janë me licencën CC BY-SA 4.0: përmendni \"FjaloriShqip\" dhe burimet e listuara te faqja Burimet. Ju lutemi ruani përgjigjet në memorie (cache) dhe mos bëni mijëra thirrje në sekondë.",
    "Data is CC BY-SA 4.0: credit \"FjaloriShqip\" and the sources listed on the Sources page. Please cache responses and avoid thousands of calls per second.",
  )}</p>
</section>
</div>`;
  return layout({
    title: "API — FjaloriShqip | Free Albanian dictionary API (JSON)",
    description: "API falas dhe e hapur për fjalorin shqip: skedarë JSON pa çelës. Free, open Albanian dictionary API: JSON files, no key, CORS enabled, CC BY-SA 4.0.",
    body,
    active: "api",
    canonical: "/api/",
    // Google Dataset Search
    structured: SITE_URL
      ? [
          {
            "@type": "Dataset",
            name: "FjaloriShqip — open Albanian dictionary data",
            description: `Open data for ${numEn(stats.words)} Albanian words: Albanian descriptions, English meanings, Gheg and Tosk dialect forms, inflection tables and words with the same meaning. Built only from openly licensed sources (Wiktionary, Wikidata and others).`,
            url: absolute("/api/"),
            inLanguage: ["sq", "en"],
            keywords: ["Albanian", "Albanian language", "dictionary", "Albanian–English", "Gheg", "Tosk", "lexicon"],
            license: "https://creativecommons.org/licenses/by-sa/4.0/",
            isAccessibleForFree: true,
            creator: { "@type": "Organization", name: SITE_NAME, url: absolute("/") },
            distribution: [
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: absolute("/api/v1/fjalet.json") },
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: absolute("/api/v1/kerko.json") },
            ],
          },
        ]
      : [],
  });
}

/** Like bi(), for trusted texts written here that contain HTML (links, bold). */
const biHtml = (sq: string, en: string) => `<span data-ui="sq">${sq}</span><span data-ui="en">${en}</span>`;

function aboutPage(): string {
  const body = `
${pageHead(t("about"), bi("Gjuha shqipe, gati për botën digjitale.", "The Albanian language, ready for the digital world."))}
<section class="card prose author-card">
  <h2>${bi("Autori", "The author")}</h2>
  <p>${biHtml(
    "FjaloriShqip është krijuar dhe zhvillohet nga <b>Endrit Rushiti</b>, si autor dhe zhvillues i projektit. Qëllimi është një fjalor i hapur, falas dhe i lehtë për t'u përdorur, që e bën gjuhën shqipe të gatshme për botën digjitale: me fjalët standarde, format gege e toske, fjalët arbëreshe e arvanitase dhe një API të hapur për zhvilluesit.",
    "FjaloriShqip is created and developed by <b>Endrit Rushiti</b>, as the project's author and developer. The aim is an open, free and easy-to-use dictionary that makes the Albanian language ready for the digital world: with the standard words, Gheg and Tosk forms, Arbëresh and Arvanitika words, and an open API for developers.",
  )}</p>
  <p>${biHtml(
    "Fjalori ndërtohet vetëm nga burime me licencë të hapur, të cilat i gjeni të gjitha te faqja <a href=\"/burimet/\">Burimet</a>.",
    "The dictionary is built only from openly licensed sources, all listed on the <a href=\"/burimet/\">Sources</a> page.",
  )}</p>
  <p class="notice">${bi(
    "Ky nuk është fjalori zyrtar i Akademisë së Shkencave. Për normën zyrtare, shihni botimet e Akademisë.",
    "This is not the official dictionary of the Academy of Sciences. For the official standard, see the Academy's publications.",
  )}</p>
</section>
<section class="card prose contact-card" id="kontakt">
  <h2>${bi("Na kontaktoni", "Contact")}</h2>
  <p class="muted">${bi("Keni një vërejtje, një fjalë që mungon ose një ide? Shkruani këtu dhe mesazhi do t'i dërgohet autorit.", "Have a remark, a missing word or an idea? Write here and the message will be sent to the author.")}</p>
  <form class="contact-form" method="post" action="/kontakt" data-contact>
    <label>${bi("Emri", "Name")}<input name="name" autocomplete="name" maxlength="100"></label>
    <label>${bi("Email-i juaj", "Your email")}<input name="email" type="email" autocomplete="email" required maxlength="200"></label>
    <label>${bi("Mesazhi", "Message")}<textarea name="message" rows="6" required minlength="5" maxlength="5000"></textarea></label>
    <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="t" value="">
    <button type="submit" class="btn btn-primary">${bi("Dërgo mesazhin", "Send message")}</button>
    <p class="contact-status" role="status" aria-live="polite"></p>
  </form>
</section>`;
  return layout({
    title: "Rreth nesh — FjaloriShqip | About this Albanian dictionary",
    description: "FjaloriShqip, fjalori i hapur i gjuhës shqipe, krijuar nga Endrit Rushiti. Kontaktoni autorin. The open Albanian dictionary by Endrit Rushiti.",
    body,
    active: "about",
    canonical: "/rreth/",
  });
}


/**
 * /aplikacioni/: install the site as an app, turn on the daily notifications, subscribe to the calendar.
 * The buttons are worked by public/app.js (install prompt, push subscription through /njoftime).
 */
function appPage(): string {
  const ics = (SITE_URL || "https://fjalorishqip.org").replace(/^https?:/, "webcal:") + url("/kalendari.ics");
  const body = `
${breadcrumbs([[t("home"), url("/")], [bi("Aplikacioni", "App"), null]])}
${pageHead(bi("Aplikacioni dhe njoftimet", "App and notifications"), bi("FjaloriShqip në ekranin e telefonit, një fjalë dialektore çdo mëngjes dhe një fjalë e urtë çdo mbrëmje. Falas dhe pa llogari.", "FjaloriShqip on your phone's home screen, a dialect word every morning and a proverb every evening. Free and without an account."))}

<section class="card app-today" data-today hidden>
  <h2>${bi("Sot", "Today")}</h2>
  <div class="app-today-grid">
    <a class="app-today-item" data-today-word href="#"><span class="kicker">${bi("Fjala e ditës", "Word of the day")}</span><b></b><span class="muted"></span></a>
    <a class="app-today-item" data-today-proverb href="#"><span class="kicker">${bi("Fjala e urtë", "Proverb")}</span><b></b><span class="muted"></span></a>
  </div>
</section>

<div class="app-grid">
<section class="card prose app-card" id="instalo">
  <h2>${icon.phone(22)} ${bi("Instaloni aplikacionin", "Install the app")}</h2>
  <p>${bi("Fjalori hapet si aplikacion, nga ikona në ekranin kryesor, pa shirit adrese. Nuk zë vend dhe përditësohet vetë.", "The dictionary opens like an app, from an icon on your home screen, without the address bar. It takes no space and updates itself.")}</p>
  <p data-install-ready hidden><button type="button" class="btn btn-primary" data-install>${icon.download(18)} ${bi("Instalo FjaloriShqip", "Install FjaloriShqip")}</button></p>
  <p class="notice" data-installed hidden>${icon.check(18)} ${bi("Aplikacioni është i instaluar në këtë pajisje.", "The app is installed on this device.")}</p>
  <div data-install-help>
    <h3>${bi("iPhone dhe iPad (Safari)", "iPhone and iPad (Safari)")}</h3>
    <p>${bi("Prekni butonin <b>Shpërndaj</b> (katrori me shigjetë) dhe zgjidhni <b>Shto në ekranin bazë</b>.", "Tap the <b>Share</b> button (the square with an arrow) and choose <b>Add to Home Screen</b>.")}</p>
    <h3>${bi("Android (Chrome)", "Android (Chrome)")}</h3>
    <p>${bi("Hapni menynë <b>⋮</b> dhe zgjidhni <b>Instalo aplikacionin</b> ose <b>Shto në ekranin bazë</b>.", "Open the <b>⋮</b> menu and choose <b>Install app</b> or <b>Add to Home screen</b>.")}</p>
    <h3>${bi("Kompjuter (Chrome, Edge)", "Computer (Chrome, Edge)")}</h3>
    <p>${bi("Klikoni ikonën e instalimit në fund të shiritit të adresës.", "Click the install icon at the end of the address bar.")}</p>
  </div>
  <p class="muted small">${bi("Fjalori kërkon internet: faqet merren gjithmonë të freskëta nga rrjeti.", "The dictionary needs the internet: pages always come fresh from the network.")}</p>
</section>

<section class="card prose app-card" id="njoftimet">
  <h2>${icon.bell(22)} ${bi("Njoftimet ditore", "Daily notifications")}</h2>
  <p>${bi("Çdo mëngjes rreth orës 8 një fjalë nga gegërishtja, toskërishtja, arbërishtja ose arvanitishtja, e shpjeguar me fjalën standarde. Çdo mbrëmje rreth orës 19 një fjalë e urtë shqipe.", "Every morning around 8 a word from Gheg, Tosk, Arbëresh or Arvanitika, explained with the standard word. Every evening around 7 pm an Albanian proverb.")}</p>
  <p><button type="button" class="btn btn-primary" data-push hidden>${icon.bell(18)} <span data-push-label>${bi("Aktivizo njoftimet", "Turn on notifications")}</span></button></p>
  <p class="contact-status" data-push-status role="status" aria-live="polite"></p>
  <p class="muted small" data-push-ios hidden>${bi("Në iPhone njoftimet funksionojnë pasi ta keni instaluar aplikacionin në ekranin bazë (iOS 16.4 ose më i ri): hapeni nga ikona dhe aktivizojini këtu.", "On iPhone, notifications work once the app is on your home screen (iOS 16.4 or later): open it from the icon and turn them on here.")}</p>
  <p class="muted small" data-push-unsupported hidden>${bi("Ky shfletues nuk i mbështet njoftimet. Provoni Chrome, Edge, Firefox ose Safari.", "This browser does not support notifications. Try Chrome, Edge, Firefox or Safari.")}</p>
  <p class="muted small">${bi("Nuk ruhet asnjë e dhënë personale: vetëm adresa që shfletuesi krijon për njoftimet. Mund t'i çaktivizoni kur të doni, këtu ose në cilësimet e telefonit.", "No personal data is stored: only the address your browser creates for notifications. You can turn them off at any time, here or in your phone's settings.")}</p>
</section>

<section class="card prose app-card" id="kalendari">
  <h2>${icon.calendar(22)} ${bi("Kalendari", "Calendar")}</h2>
  <p>${bi("Shtoni fjalën e ditës në kalendarin tuaj: çdo ditë shfaqet si ngjarje gjithë-ditore, me fjalën e urtë në përshkrim. Kalendari përditësohet vetë.", "Add the word of the day to your calendar: each day appears as an all-day event, with the proverb in the description. The calendar updates itself.")}</p>
  <p class="app-links">
    <a class="btn btn-primary" href="${h(ics)}">${icon.calendar(18)} ${bi("Abonohu në kalendar", "Subscribe to the calendar")}</a>
    <a class="btn btn-ghost" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(ics)}" rel="noopener" target="_blank">Google Calendar</a>
  </p>
  <p class="muted small">${bi("Adresa e kalendarit:", "Calendar address:")} <code>${h((SITE_URL || "https://fjalorishqip.org") + url("/kalendari.ics"))}</code></p>
</section>
</div>`;
  return layout({
    title: "Aplikacioni dhe njoftimet — FjaloriShqip | Albanian dictionary app",
    description: "Instaloni FjaloriShqip në telefon, merrni çdo mëngjes fjalën e ditës nga dialektet dhe çdo mbrëmje një fjalë të urtë shqipe. Falas, pa llogari.",
    body,
    canonical: "/aplikacioni/",
  });
}

function searchPage(): string {
  const body = `
<div class="search-page">
  ${searchBox({ size: "big" })}
  <h1 class="search-title"></h1>
  <div class="search-results"></div>
</div>`;
  return layout({ title: "Kërko — FjaloriShqip", description: "Kërko në fjalorin shqip.", body, headerSearch: false, noindex: true });
}

// ── dialect pages ────────────────────────────────────────────────────────────
/** Every form of a dialect: forms listed on standard words, dialect headwords, and words used only in that dialect. */
function dialectRows(d: Dialect): { form: string; standard: string[]; own: boolean }[] {
  const rows = new Map<string, { form: string; standard: Set<string>; own: boolean }>();
  const row = (form: string) => rows.get(form) ?? rows.set(form, { form, standard: new Set(), own: false }).get(form)!;
  for (const w of words) {
    for (const x of w.dialects ?? []) if (x.dialect === d) row(x.form).standard.add(w.word);
    for (const v of w.variantOf ?? []) if (v.kind === d) row(w.word).standard.add(v.word);
    if (w.dialectOnly?.includes(d)) row(w.word).own = true;
  }
  return [...rows.values()]
    .map((r) => ({ form: r.form, standard: [...r.standard].filter((s) => s !== r.form), own: r.own }))
    .sort((a, b) => compareSq(a.form, b.form));
}

function dialectPage(d: Dialect, rows: ReturnType<typeof dialectRows>): string {
  const info = DIALECT_INFO[d];
  const formLink = (f: string) => (byWord.has(f) ? `<a href="${wordUrl(f)}" lang="sq">${h(f)}</a>` : `<span lang="sq">${h(f)}</span>`);
  const meaningOf = (f: string) => {
    const w = byWord.get(f);
    const text = w?.description ? short(w.description.text) : w ? shortGloss(w) : "";
    return text && !text.startsWith("→") ? `<small>${h(text)}</small>` : "";
  };
  const items = rows
    .map((r) => {
      const key = [r.form, ...r.standard].map(foldKey).join(" ");
      const right = r.standard.length
        ? `<span class="dl-arrow" aria-hidden="true">→</span><span class="dl-std">${r.standard.map((s) => `<a href="${wordUrl(s)}" lang="sq">${h(s)}</a>`).join(", ")}</span>`
        : `<span class="dl-own">${bi(`fjalë ${d === "gheg" ? "gege" : d === "tosk" ? "toske" : d === "arberesh" ? "arbëreshe" : "arvanitase"}`, `${info.en} word`)}</span>${meaningOf(r.form)}`;
      return `<li data-key="${h(key)}"><span class="dl-form">${formLink(r.form)}</span>${right}</li>`;
    })
    .join("\n");
  const others = DIALECT_ORDER.filter((x) => x !== d)
    .map((x) => `<a class="chip" href="${dialectUrl(x)}"><span class="dialect-dot ${x}"></span>${t(x)}</a>`)
    .join("");
  const body = `
${pageHead(
  `<span class="dialect-dot ${d}"></span>${t(d)}`,
  bi(
    `${info.whereSq}. ${num(rows.length)} forma: pranë fjalës standarde, ose fjalë që përdoren vetëm në këtë dialekt.`,
    `${info.whereEn}. ${num(rows.length)} forms: next to the standard word, or words used only in this dialect.`,
  ),
  bi("Fjalët sipas dialektit", "Words by dialect"),
)}
<div class="dialect-tools">
  <input type="search" class="dialect-filter" data-filter-list="dialect-list" placeholder="${h(`Kërko në ${info.sq.toLowerCase()}…`)}" data-placeholder-en="${h(`Search ${info.en}…`)}" aria-label="${h(`Kërko në ${info.sq.toLowerCase()} / Search ${info.en}`)}" autocomplete="off" spellcheck="false">
  <span class="dialect-count muted" data-count-for="dialect-list">${num(rows.length)}</span>
</div>
<ul class="dialect-list" id="dialect-list">
${items}
</ul>
<p class="muted dialect-empty" hidden>${bi("Asnjë formë nuk përputhet.", "No form matches.")}</p>
<section class="section">
  <header class="section-head"><h2>${bi("Dialektet e tjera", "Other dialects")}</h2></header>
  <p class="try">${others}</p>
</section>`;
  return layout({
    title: `${info.sq} — fjalët dhe format | FjaloriShqip`,
    description: `${info.sq} (${info.en}): ${num(rows.length)} forma dialektore pranë fjalës standarde. ${info.whereSq}.`,
    body,
    canonical: `/dialekt/${info.slug}/`,
  });
}

function notFoundPage(): string {
  const body = `
<div class="not-found">
  <p class="big-letter" aria-hidden="true">404</p>
  <h1>${t("notFound")}</h1>
  <p class="lead">${bi("Kjo faqe nuk ekziston. Provoni kërkimin:", "This page does not exist. Try searching:")}</p>
  ${searchBox({ size: "big", chips: true })}
</div>`;
  return layout({ title: "404 — FjaloriShqip", description: "Faqja nuk u gjet.", body, headerSearch: false, noindex: true });
}

/**
 * Short English meanings as search keys, so "food" finds ushqim ("food") before words that only
 * mention food. Must match normEnglish() in public/app.js.
 */
export function normEnglish(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*(to|a|an|the)\s+/, "")
    .replace(/[^a-z' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function englishKeys(glosses: string[]): string[] {
  const keys = new Set<string>();
  for (const g of glosses)
    for (const part of g.replace(/\([^)]*\)/g, " ").split(/[;,]/)) {
      const k = normEnglish(part);
      if (k.length >= 2 && k.length <= 30 && k.split(" ").length <= 3) {
        keys.add(k);
        if (SAME_AS[k]) keys.add(SAME_AS[k]);
      }
    }
  return [...keys];
}

// ── API files ────────────────────────────────────────────────────────────────
function apiWord(w: Word): object {
  return {
    ...w,
    url: SITE_URL ? `${SITE_URL}${url(`/fjala/${encodeURIComponent(slug(w.word))}/`)}` : undefined,
    licence: wordLicence(w),
    sameMeaning: w.unverified ? undefined : sameMeaning(w).map((x) => ({ word: x.word, relation: x.how })),
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
  write("aplikacioni/index.html", appPage());
  write("kerko/index.html", searchPage());
  write("404.html", notFoundPage());
  // one page per dialect (forms next to the standard word), and the same data for the API
  const dialectData: Record<string, { form: string; standard: string[]; own: boolean }[]> = {};
  for (const d of DIALECT_ORDER) {
    const rows = dialectRows(d);
    dialectData[d] = rows;
    write(`dialekt/${DIALECT_INFO[d].slug}/index.html`, dialectPage(d, rows));
  }
  write("api/v1/dialekte.json", JSON.stringify(dialectData));
  const letterCount = letterPages();

  for (const w of words) {
    write(`fjala/${slug(w.word)}/index.html`, wordPage(w));
    write(`api/v1/fjala/${slug(w.word)}.json`, JSON.stringify(apiWord(w)));
  }

  // search index: [word, folded key, pos (sq), short English gloss, Wikipedia count,
  //                English keys of the first meaning, English keys of the other meanings, borrowed (1/0),
  //                short Albanian description]
  write(
    "api/v1/kerko.json",
    JSON.stringify(
      words.map((w) => {
        const glosses = w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "auto").map((s) => s.gloss);
        const first = englishKeys(glosses.slice(0, 1));
        const other = englishKeys(glosses.slice(1)).filter((k) => !first.includes(k));
        return [w.word, foldKey(w.word), w.entries[0] && w.entries[0].pos !== "other" ? POS_SQ[w.entries[0].pos] : "", shortGloss(w), w.frequency ?? 0, first.join("|"), other.slice(0, 6).join("|"), w.loan ? 1 : 0, w.description ? short(w.description.text) : ""];
      }),
    ),
  );
  write("api/v1/fjalet.json", JSON.stringify(words.map((w) => w.word)));
  write("api/v1/statistika.json", JSON.stringify({ ...stats, licence: "CC BY-SA 4.0; words marked unverified: GPL-2.0-or-later" }, null, 2));

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
  // Word of the day / hour: common, Albanian (not borrowed) words with a real meaning,
  // no dialectal, archaic or rare words (the home page should show words people know)
  const NOT_FEATURED = /archaic|obsolete|rare|dialectal|regional|Gheg|Tosk|Arbëresh|vulgar|derogatory|offensive|slang|dated|historical|colloquial|nonstandard|misspelling|Kosovo|figuratively/;
  const formOfOther = new Set<string>();
  for (const w of words) for (const e of w.entries) for (const f of e.forms ?? []) if (f.form !== w.word) formOfOther.add(f.form);
  const featured = words
    .filter((w) => {
      if (w.unverified || w.loan || w.labels || w.variantOf || w.word.includes(" ") || w.word.length < 3 || w.word.length > 12 || (w.frequency ?? 0) < FEATURED_MIN_USE) return false;
      // used as exactly this word in (carefully spelled) Wikipedia, and not a form of another word:
      // keeps out eshtë (= është without ë), duk (from duke), pashë, bëra, dhënë…
      if ((w.wikipediaCount ?? 0) < FEATURED_MIN_WIKIPEDIA || formOfOther.has(w.word)) return false;
      // the home page shows the Albanian description first, so only words that have one
      if (!w.description) return false;
      const e = w.entries.find((x) => ["noun", "verb", "adj"].includes(x.pos) && x.senses.length);
      const s = e?.senses[0];
      return !!s && s.lang === "en" && (s.source === "en-wiktionary" || (s.source === "editor" && e!.senses.some((x) => x.source === "en-wiktionary"))) && !(s.tags ?? []).some((t) => NOT_FEATURED.test(t)) && !/^(alternative|form|plural|synonym|abbreviation|diminutive|feminine|obsolete|archaic|past|participle|given|mediopassive|to have (been|become))|\bof\b.*\(/i.test(s.gloss) && !s.gloss.toLowerCase().startsWith(w.word);
    })
    .map((w) => {
      const e = w.entries.find((x) => x.senses.some((s) => s.lang === "en"))!;
      const ex = e.senses.flatMap((s) => s.examples ?? [])[0];
      const gheg = w.dialects?.find((d) => d.dialect === "gheg")?.form ?? null;
      return [w.word, POS_SQ[e.pos], POS_EN[e.pos], e.senses.find((s) => s.lang === "en")!.gloss.slice(0, 120), gheg, ex ? ex.text : null, ex?.english ?? null, e.ipa?.[0] ?? null, w.description?.text ?? null];
    });
  write("api/v1/te-zgjedhura.json", JSON.stringify(featured));

  // ── daily notifications and calendar (public/sw.js, src/worker/push.ts, scripts/lib/daily.ts) ──
  // word of the day: a dialect form of a common standard word, explained through that word
  const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n - 1))}…`);
  const dialectWords = shuffled(
    words.flatMap((w) => {
      if (w.unverified || w.loan || w.variantOf || w.word.includes(" ") || !w.description || (w.frequency ?? 0) < DAILY_MIN_USE) return [];
      const forms = (w.dialects ?? []).filter((d) => {
        if (d.form.includes(" ") || d.form.length < 3 || foldKey(d.form) === foldKey(w.word)) return false;
        // a form that is also another standard word (e.g. Gheg "mal" for "mall") would mislead
        const own = byWord.get(d.form);
        return !own || !!own.variantOf?.some((v) => v.word === w.word) || !!own.dialectOnly;
      });
      if (!forms.length) return [];
      const d = forms[hash(w.word) % forms.length];
      return [{ word: w, form: d.form, dialect: d.dialect }];
    }),
    (x) => x.form,
  );
  const proverbs = shuffled(words.filter((w) => w.labels?.includes("proverb") && w.description), (w) => w.word);
  const dailyOf = (date: string): DailyDay => {
    const d = dayOf(dialectWords, date);
    const p = dayOf(proverbs, date);
    return {
      fjala: {
        titulli: `Fjala e ditës: ${d.form}`,
        teksti: clip(`${DIALECT_INFO[d.dialect].sq} për «${d.word.word}»: ${d.word.description!.text}`, 180),
        url: wordUrl(byWord.has(d.form) ? d.form : d.word.word),
      },
      fjaleUrte: { titulli: "Fjala e urtë e ditës", teksti: clip(`«${p.word.charAt(0).toUpperCase()}${p.word.slice(1)}» — ${p.description!.text}`, 180), url: wordUrl(p.word) },
    };
  };
  if (dialectWords.length && proverbs.length) {
    const start = todayInAlbania();
    // the service worker reads today's entry; a few weeks ahead covers the time until the next build
    const soon: Record<string, DailyDay> = {};
    for (let i = -2; i <= 45; i++) soon[addDays(start, i)] = dailyOf(addDays(start, i));
    write("api/v1/njoftime.json", JSON.stringify({ dite: soon }));
    const year: [string, DailyDay][] = [];
    for (let i = -7; i < 365; i++) year.push([addDays(start, i), dailyOf(addDays(start, i))]);
    write("kalendari.ics", calendar(year, SITE_URL || "https://fjalorishqip.org", new Date()));
  }
  console.log(`daily notifications: ${dialectWords.length} dialect words, ${proverbs.length} proverbs`);

  // ── search engines: sitemaps and robots.txt ──
  // every page that should be found: home, info pages, letter pages and all word pages
  const pages = ["/", "/burimet/", "/api/", "/rreth/", "/aplikacioni/", ...DIALECT_ORDER.map((d) => `/dialekt/${DIALECT_INFO[d].slug}/`)];
  for (const l of ALPHABET) {
    const n = Math.max(1, Math.ceil((letterCounts.get(l) ?? 0) / PAGE_SIZE));
    for (let p = 1; p <= n; p++) pages.push(`/shkronja/${encodeURIComponent(l)}/${p === 1 ? "" : `${p}/`}`);
  }
  for (const w of words) pages.push(`/fjala/${encodeURIComponent(slug(w.word))}/`);
  const SITEMAP_SIZE = 10_000; // the limit is 50,000 URLs per file; smaller files are quicker to fetch
  const sitemapCount = Math.ceil(pages.length / SITEMAP_SIZE);
  if (SITE_URL) {
    const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    for (let i = 0; i < sitemapCount; i++) {
      const urls = pages.slice(i * SITEMAP_SIZE, (i + 1) * SITEMAP_SIZE).map((p) => `<url><loc>${xml(absolute(p))}</loc></url>`);
      write(`sitemap-${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
    }
    const files = Array.from({ length: sitemapCount }, (_, i) => `<sitemap><loc>${xml(absolute(`/sitemap-${i + 1}.xml`))}</loc></sitemap>`);
    write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.join("\n")}\n</sitemapindex>\n`);
  }
  // /hap and /njoftime are the app's counter and subscription addresses (src/worker/push.ts), not pages
  write("robots.txt", ["User-agent: *", "Allow: /", "Disallow: /hap", "Disallow: /njoftime", ...(SITE_URL ? ["", `Sitemap: ${absolute("/sitemap.xml")}`] : []), ""].join("\n"));

  // llms.txt (https://llmstxt.org): a short guide for AI assistants and tools on what the site is and how to use it
  if (SITE_URL) {
    const described = words.filter((w) => w.description).length;
    write(
      "llms.txt",
      [
        "# FjaloriShqip",
        "",
        `> FjaloriShqip (${absolute("/")}) is a free, open-source dictionary of the Albanian language (fjalor i hapur i gjuhës shqipe). It has ${numEn(stats.words)} Albanian words: ${numEn(described)} with a short description in Albanian, ${numEn(stats.withEnglish)} with their English meaning, Gheg and Tosk dialect forms, words with the same meaning, and conjugation or declension tables for ${numEn(stats.withInflection)} words. It is built only from openly licensed sources (Wiktionary, Wikidata and others). All data is CC BY-SA 4.0 and available through a free JSON API without a key.`,
        "",
        "Good for: Albanian–English and English–Albanian word lookups, the meaning of an Albanian word in Albanian, Gheg and Tosk forms, verb conjugation, and open Albanian language data for software.",
        "",
        "## Pages",
        "",
        `- [Word page](${absolute("/fjala/")}{word}/): one page per word, e.g. ${absolute("/fjala/n%C3%ABn%C3%AB/")} (nënë, "mother"); spaces in a word become "_"`,
        `- [Search](${absolute("/kerko/")}?q={query}): search in Albanian or English; ë and ç are optional`,
        `- [Browse by letter](${absolute("/shkronja/a/")}): all words, in Albanian alphabetical order (36 letters)`,
        `- [Sources and licences](${absolute("/burimet/")})`,
        `- [About](${absolute("/rreth/")})`,
        "",
        "## API (JSON, free, no key, CORS enabled)",
        "",
        `- [One word](${absolute("/api/v1/fjala/{word}.json")}): meanings, forms, dialect forms, same-meaning words, sources and licence`,
        `- [All words](${absolute("/api/v1/fjalet.json")}): list of every headword`,
        `- [Dialects](${absolute("/api/v1/dialekte.json")}): Gheg, Tosk, Arbëresh (Italy) and Arvanitika (Greece) forms with their standard word; pages: ${DIALECT_ORDER.map((d) => absolute(`/dialekt/${DIALECT_INFO[d].slug}/`)).join(", ")}`,
        `- [Search index](${absolute("/api/v1/kerko.json")}): word, part of speech, short English meaning, short Albanian description`,
        `- [Statistics](${absolute("/api/v1/statistika.json")})`,
        `- [API documentation](${absolute("/api/")})`,
        "",
        "## Optional",
        "",
        `- [Source code](${REPO_URL}): the build scripts and data pipeline (MIT licence)`,
        "- This is not the official dictionary of the Academy of Sciences of Albania; for the official standard, see the Academy's publications.",
        "",
      ].join("\n"),
    );
  }

  // web app manifest: name, colours and icon when the site is added to a phone's home screen
  write(
    "site.webmanifest",
    JSON.stringify(
      {
        name: "FjaloriShqip — Fjalori i hapur i gjuhës shqipe",
        short_name: "FjaloriShqip",
        lang: "sq",
        id: url("/"),
        // through the Worker's open counter, so openings from the home-screen icon are counted (src/worker/push.ts)
        start_url: url("/hap?burim=app"),
        scope: url("/"),
        display: "standalone",
        background_color: "#fbf8f4",
        theme_color: "#c8102e",
        description: "Fjalori i hapur i gjuhës shqipe: kuptimet, format gege e toske, fjala e ditës.",
        shortcuts: [
          { name: "Kërko", url: url("/kerko/") },
          { name: "Aplikacioni dhe njoftimet", url: url("/aplikacioni/") },
        ],
        icons: [
          { src: url("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
          { src: asset("icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
          { src: asset("favicon.svg"), sizes: "any", type: "image/svg+xml" },
        ],
      },
      null,
      2,
    ),
  );

  console.log(`built ${words.length} word pages, ${letterCount} letter pages, ${shards.size} form shards, ${featured.length} featured words in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
})();
