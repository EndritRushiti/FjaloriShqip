/**
 * Merges the downloaded open sources into data/fjalori.json.
 *   npm run data
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { DialectForm, Entry, Example, Form, Pos, Sense, Word } from "../src/data/model.js";
import { compareSq } from "../src/data/model.js";
import type { SourceId } from "../src/data/sources.js";
import { findLemmas, readDic, rootOf } from "./lib/hunspell-lemmas.js";

const SRC = path.join(process.cwd(), "sources");
const OUT = path.join(process.cwd(), "data");

const KAIKKI_POS: Record<string, Pos> = {
  noun: "noun", verb: "verb", adj: "adj", adv: "adv", pron: "pron", num: "num", prep: "prep", postp: "prep",
  conj: "conj", intj: "interj", particle: "particle", det: "det", article: "particle", contraction: "other",
};
const SQ_POS: Record<string, Pos> = {
  "emër": "noun", "folje": "verb", "mbiemër": "adj", "ndajfolje": "adv", "përemër": "pron", "numëror": "num",
  "parafjalë": "prep", "lidhëz": "conj", "pasthirrmë": "interj", "pjesëz": "particle",
};
const WD_POS: Record<string, Pos> = {
  noun: "noun", verb: "verb", adjective: "adj", adverb: "adv", pronoun: "pron", numeral: "num", "cardinal numeral": "num",
  preposition: "prep", conjunction: "conj", interjection: "interj", particle: "particle", determiner: "det", "proper noun": "other",
};

const VALID_WORD = /^[a-zçëâêîôû' -]+$/;
const words = new Map<string, Word>();

function getWord(w: string): Word {
  let x = words.get(w);
  if (!x) {
    x = { word: w, entries: [], sources: [] };
    words.set(w, x);
  }
  return x;
}

function addSource(list: SourceId[], s: SourceId): void {
  if (!list.includes(s)) list.push(s);
}

function entryFor(w: Word, pos: Pos, source: SourceId): Entry {
  let e = w.entries.find((x) => x.pos === pos);
  if (!e) {
    e = { pos, senses: [], sources: [] };
    w.entries.push(e);
  }
  addSource(e.sources, source);
  addSource(w.sources, source);
  return e;
}

function addSense(e: Entry, s: Sense): void {
  const key = s.gloss.toLowerCase().replace(/\W+/g, " ").trim();
  if (!key || e.senses.some((x) => x.lang === s.lang && x.gloss.toLowerCase().replace(/\W+/g, " ").trim() === key)) return;
  e.senses.push(s);
}

const VARIANT_RE = /^(Gheg|Tosk|alternative|dialectal|obsolete|archaic) (?:form|spelling|variant) of ([^\s(,;:]+)/i;
const INFLECTION_RE = /^(inflection|plural|singular|definite|indefinite|feminine|masculine|first|second|third|present|past|aorist|imperfect|participle|gerund|accusative|dative|ablative|genitive|nominative|.*person)\b.* of\b/i;

// ── English Wiktionary (kaikki) ─────────────────────────────────────────────
interface KForm { form?: string; tags?: string[] }
interface KSense { glosses?: string[]; tags?: string[]; examples?: { text?: string; english?: string; translation?: string }[]; form_of?: { word: string }[] }
interface KEntry { word: string; pos: string; forms?: KForm[]; senses?: (KSense & { synonyms?: { word?: string }[] })[]; sounds?: { ipa?: string; tags?: string[] }[]; etymology_text?: string; synonyms?: { word?: string }[] }

async function readKaikki(): Promise<void> {
  const file = path.join(SRC, "kaikki-albanian.jsonl");
  if (!fs.existsSync(file)) throw new Error("sources/kaikki-albanian.jsonl missing — run `npm run sources`");
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const k = JSON.parse(line) as KEntry;
    const pos = KAIKKI_POS[k.pos];
    const headword = k.word?.trim();
    if (!pos || !headword || headword !== headword.toLowerCase() || !VALID_WORD.test(headword)) continue;
    const senses = (k.senses ?? []).filter((s) => s.glosses?.length);
    if (!senses.length) continue;

    // Pure inflected-form entries ("first-person singular aorist of punoj") are not headwords.
    if (senses.every((s) => INFLECTION_RE.test(s.glosses![0]) && !VARIANT_RE.test(s.glosses![0]))) continue;

    const w = getWord(headword);
    for (const s of senses) {
      const g = s.glosses![0].trim();
      const v = g.match(VARIANT_RE);
      if (v) {
        const kind = v[1].toLowerCase() === "gheg" ? "gheg" : v[1].toLowerCase() === "tosk" ? "tosk" : "alternative";
        w.variantOf ??= [];
        if (!w.variantOf.some((x) => x.word === v[2] && x.kind === kind)) w.variantOf.push({ word: v[2].toLowerCase(), kind, source: "en-wiktionary" });
        addSource(w.sources, "en-wiktionary");
        continue;
      }
      if (INFLECTION_RE.test(g)) continue;
      const e = entryFor(w, pos, "en-wiktionary");
      const examples: Example[] = (s.examples ?? [])
        .filter((x) => x.text && x.text.length < 300)
        .slice(0, 3)
        .map((x) => ({ text: x.text!, english: x.english ?? x.translation }));
      addSense(e, { gloss: g, lang: "en", tags: s.tags?.filter((t) => !["no-gloss"].includes(t)).slice(0, 4), examples: examples.length ? examples : undefined, source: "en-wiktionary" });
    }
    const e = w.entries.find((x) => x.pos === pos);
    if (!e) continue;
    const ipa = (k.sounds ?? []).map((x) => x.ipa).filter((x): x is string => !!x);
    if (ipa.length) e.ipa = [...new Set([...(e.ipa ?? []), ...ipa])].slice(0, 3);
    if (k.etymology_text && !e.etymology) e.etymology = k.etymology_text.slice(0, 400);
    const forms: Form[] = (k.forms ?? [])
      .filter((f) => f.form && !f.form.startsWith("sq-") && !(f.tags ?? []).some((t) => ["table-tags", "inflection-template", "error-unrecognized-form"].includes(t)))
      .map((f) => ({ form: f.form!, tags: (f.tags ?? []).filter((t) => t !== "Gheg" && t !== "Tosk") }));
    if (forms.length) {
      const seen = new Set((e.forms ?? []).map((f) => `${f.form}|${f.tags.join(",")}`));
      e.forms = [...(e.forms ?? []), ...forms.filter((f) => !seen.has(`${f.form}|${f.tags.join(",")}`))];
    }
    // synonyms listed by Wiktionary for the word and its main meaning
    const syn = [...(k.synonyms ?? []), ...(k.senses?.[0]?.synonyms ?? [])] // the main meaning only
      .map((x) => x.word?.trim().toLowerCase())
      .filter((x): x is string => !!x && x !== headword && VALID_WORD.test(x));
    if (syn.length) e.synonyms = [...new Set([...(e.synonyms ?? []), ...syn])].slice(0, 20);
    for (const f of k.forms ?? []) {
      const dialect = f.tags?.includes("Gheg") ? "gheg" : f.tags?.includes("Tosk") ? "tosk" : null;
      if (dialect && f.form && f.form.toLowerCase() !== headword) addDialect(w, { form: f.form.toLowerCase(), dialect, source: "en-wiktionary" });
    }
  }
}

function addDialect(w: Word, d: DialectForm): void {
  w.dialects ??= [];
  if (!w.dialects.some((x) => x.form === d.form && x.dialect === d.dialect)) w.dialects.push(d);
}

// ── Wikidata lexemes (CC0) ──────────────────────────────────────────────────
function readWikidata(): void {
  const file = path.join(SRC, "wikidata-lexemes.json");
  if (!fs.existsSync(file)) {
    console.warn("wikidata-lexemes.json missing — skipped");
    return;
  }
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as { lemma: string; category: string; gloss: string | null; glossLang: string | null }[];
  for (const r of rows) {
    const lemma = r.lemma.trim();
    if (lemma !== lemma.toLowerCase() || !VALID_WORD.test(lemma)) continue;
    const pos = WD_POS[r.category.toLowerCase()];
    if (!pos || pos === "other") continue;
    const w = getWord(lemma);
    const e = entryFor(w, pos, "wikidata");
    if (r.gloss && (r.glossLang === "en" || r.glossLang === "sq")) addSense(e, { gloss: r.gloss, lang: r.glossLang, source: "wikidata" });
  }
}

// ── Albanian Wiktionary: headwords, part of speech, gender only ─────────────
function readSqWiktionary(): void {
  const file = path.join(SRC, "sq-wiktionary.jsonl");
  if (!fs.existsSync(file)) {
    console.warn("sq-wiktionary.jsonl missing — skipped");
    return;
  }
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const { title, text } = JSON.parse(line) as { title: string; text: string };
    const t = title.trim();
    if (t !== t.toLowerCase() || !VALID_WORD.test(t)) continue;
    // Pages in the layout of the Academy dictionary (FGJSSH: bold UPPERCASE headword + its abbreviations)
    // were mass-copied from a copyrighted work: skip them entirely, word list included.
    if (/^'''[A-ZËÇ ]{2,}'''/m.test(text) || !/==\s*Shqip\s*==/.test(text)) continue;
    const albanian = text.split(/\n==(?!=)/).find((sec) => /^\s*==?\s*Shqip\s*==/.test(sec) || sec.startsWith("Shqip==")) ?? (text.includes("==Shqip==") ? text.slice(text.indexOf("==Shqip==")) : "");
    if (!albanian) continue;
    let found = false;
    for (const m of albanian.matchAll(/===\s*([A-Za-zËëÇç]+)\s*===\s*\n([^\n]*)/g)) {
      const pos = SQ_POS[m[1].toLowerCase()];
      if (!pos) continue;
      found = true;
      const w = getWord(t);
      const e = entryFor(w, pos, "sq-wiktionary");
      if (pos === "noun" && !e.gender) {
        const g = m[2].match(/''(m|f|as)\.''/);
        if (g) e.gender = g[1] === "m" ? "m" : g[1] === "f" ? "f" : "n";
      }
    }
    if (!found) continue;
  }
}

/** Word counts from Albanian Wikipedia (derived/frekuenca-wikipedia.json, made by scripts/word-frequency.ts). */
function readFrequency(): Record<string, number> {
  const f = path.join(process.cwd(), "derived", "frekuenca-wikipedia.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).words : {};
}

/** Minimum Wikipedia count (word + forms) for a Hunspell-only word to be added. */
const MIN_USE = 1;

/**
 * Adds base words from the Hunspell list that no other source has, when Albanian Wikipedia
 * confirms they are in use. They stay separate (own source, GPL) and are marked unverified.
 */
function addHunspell(freq: Record<string, number>): number {
  const file = path.join(SRC, "hunspell-sq_AL.dic");
  if (!fs.existsSync(file)) return 0;
  const dic = readDic(fs.readFileSync(file, "utf8"));
  const has = (x: string) => dic.has(x);
  const known = new Set<string>();
  for (const w of words.values()) {
    known.add(w.word);
    for (const e of w.entries) for (const f of e.forms ?? []) known.add(f.form);
    for (const d of w.dialects ?? []) known.add(d.form);
  }
  const family = new Map<string, number>();
  for (const w of dic) {
    const k = rootOf(w, has);
    family.set(k, (family.get(k) ?? 0) + (freq[w] ?? 0));
  }
  let n = 0;
  for (const l of findLemmas(dic)) {
    const use = family.get(l.word) ?? 0;
    if (known.has(l.word) || use < MIN_USE || !VALID_WORD.test(l.word)) continue;
    const w = getWord(l.word);
    w.unverified = true;
    w.frequency = use;
    if (l.pos) w.entries.push({ pos: l.pos, ...(l.gender ? { gender: l.gender } : {}), senses: [], sources: ["hunspell-sq"] });
    addSource(w.sources, "hunspell-sq");
    addSource(w.sources, "wikipedia-sq");
    n++;
  }
  return n;
}

(async () => {
  console.log("reading English Wiktionary…");
  await readKaikki();
  console.log("reading Wikidata…");
  readWikidata();
  console.log("reading Albanian Wiktionary…");
  readSqWiktionary();

  // Gheg/Tosk headwords that point to a standard word: show them on the standard word's page too.
  for (const w of words.values()) {
    for (const v of w.variantOf ?? []) {
      const std = words.get(v.word);
      if (std && (v.kind === "gheg" || v.kind === "tosk")) addDialect(std, { form: w.word, dialect: v.kind, source: v.source });
    }
  }
  // Drop words without any entry and without a variant link.
  for (const [k, w] of words) if (!w.entries.length && !w.variantOf?.length) words.delete(k);

  // How common each word is: the word and its forms in Albanian Wikipedia.
  const freq = readFrequency();
  for (const w of words.values()) {
    const forms = new Set([w.word, ...w.entries.flatMap((e) => (e.forms ?? []).map((f) => f.form))]);
    const n = [...forms].reduce((a, f) => a + (freq[f] ?? 0), 0);
    if (n) w.frequency = n;
  }
  console.log("reading the Hunspell word list…");
  const added = addHunspell(freq);
  console.log(`hunspell: ${added} new words confirmed by Wikipedia`);

  const list = [...words.values()].sort((a, b) => compareSq(a.word, b.word));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "fjalori.json"), JSON.stringify(list));
  const manifest = fs.existsSync(path.join(SRC, "manifest.json")) ? JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8")) : {};
  const stats = {
    built: new Date().toISOString().slice(0, 10),
    words: list.length,
    withEnglish: list.filter((w) => w.entries.some((e) => e.senses.some((s) => s.lang === "en"))).length,
    withInflection: list.filter((w) => w.entries.some((e) => (e.forms?.length ?? 0) > 3)).length,
    ghegForms: list.reduce((a, w) => a + (w.dialects?.filter((d) => d.dialect === "gheg").length ?? 0), 0) + list.filter((w) => w.variantOf?.some((v) => v.kind === "gheg")).length,
    toskForms: list.reduce((a, w) => a + (w.dialects?.filter((d) => d.dialect === "tosk").length ?? 0), 0),
    bySource: {
      "en-wiktionary": list.filter((w) => w.sources.includes("en-wiktionary")).length,
      wikidata: list.filter((w) => w.sources.includes("wikidata")).length,
      "sq-wiktionary": list.filter((w) => w.sources.includes("sq-wiktionary")).length,
      "hunspell-sq": list.filter((w) => w.sources.includes("hunspell-sq")).length,
      "wikipedia-sq": list.filter((w) => w.frequency).length,
    },
    unverified: list.filter((w) => w.unverified).length,
    sources: manifest,
  };
  fs.writeFileSync(path.join(OUT, "stats.json"), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
