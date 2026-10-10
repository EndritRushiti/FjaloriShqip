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
import { Deduper } from "./lib/dedupe.js";
import { baseOf, findLemmas, readDic, rootOf } from "./lib/hunspell-lemmas.js";

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

/** Tidies a meaning: one line, no dangling punctuation, balanced brackets. Empty when it is only a heading. */
export function cleanGloss(g: string): string {
  let s = g.replace(/\s+/g, " ").replace(/\s*\^\(\)\s*/g, " ").trim();
  if (/:$/.test(s)) return ""; // "synonym of amë in the following senses:": a heading for a list we do not have
  s = s.replace(/[\s,;]+$/, "").replace(/^[\s,;.:)]+/, "");
  const open = (s.match(/\(/g) ?? []).length;
  const close = (s.match(/\)/g) ?? []).length;
  if (open > close) s += ")".repeat(open - close);
  return s.trim();
}

function addSense(e: Entry, s: Sense): void {
  s = { ...s, gloss: cleanGloss(s.gloss) };
  const key = s.gloss.toLowerCase().replace(/\W+/g, " ").trim();
  if (!key || e.senses.some((x) => x.lang === s.lang && x.gloss.toLowerCase().replace(/\W+/g, " ").trim() === key)) return;
  e.senses.push(s);
}

// "Gheg form of i çamë": skip the adjective article (i/e/të/së) before the word
const VARIANT_RE = /^(Gheg|Tosk|alternative|dialectal|obsolete|archaic) (?:form|spelling|variant) of (?:(?:i|e|të|së) )?([^\s(,;:]+)/i;
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

/** korrigjime/hiq.txt: one word per line, "#" starts a comment. */
function readRemoveList(): string[] {
  const f = path.join(process.cwd(), "korrigjime", "hiq.txt");
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim().toLowerCase()).filter(Boolean);
}

// ── usage counts (Wikipedia + MaCoCu) ───────────────────────────────────────
/** Word counts made by scripts/word-frequency.ts (derived/frekuenca-<source>.json). */
function readCounts(source: "wikipedia" | "macocu"): Record<string, number> {
  const f = path.join(process.cwd(), "derived", `frekuenca-${source}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).words : {};
}
const wikiCounts = readCounts("wikipedia");
const macocuCounts = readCounts("macocu");
/** MaCoCu is ~15× larger than Wikipedia; scale it so both count about the same. */
const MACOCU_SCALE = 1 / 14.6;
const useOf = (w: string) => (wikiCounts[w] ?? 0) + (macocuCounts[w] ?? 0);
const scaledUse = (w: string) => (wikiCounts[w] ?? 0) + (macocuCounts[w] ?? 0) * MACOCU_SCALE;

function readDerived<T>(file: string): T | null {
  const f = path.join(process.cwd(), "derived", file);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as T) : null;
}

const POS_NAMES: Record<string, Pos> = { ...KAIKKI_POS, adjective: "adj", adverb: "adv", pronoun: "pron", numeral: "num", interjection: "interj", preposition: "prep", conjunction: "conj" };
/** Wiktionary entries that are not words of their own. */
const NOT_A_WORD = new Set(["name", "proper noun", "character", "symbol", "suffix", "prefix", "infix", "abbrev", "punct", "romanization", "phrase", "proverb"]);

// ── more Wiktionary editions: English translation tables and 18 other editions ─────
interface WiktionaryExtract {
  edition: string;
  headwords: { word: string; pos: string; glosses: string[] }[];
  translations: { word: string; from: string; fromLang: string; sense: string }[];
}

/**
 * Adds words found in Wiktionary that the main sources lack: Albanian entries of any edition
 * and translations into Albanian (English translations bring their English meaning: caviar → kavie).
 * A word is added only when it is new (Deduper) and confirmed: used in Wikipedia/MaCoCu, or
 * attested by at least two editions.
 */
function addWiktionaryEditions(d: Deduper): number {
  const dir = path.join(process.cwd(), "derived");
  if (!fs.existsSync(dir)) return 0;
  type Cand = { editions: Set<string>; pos?: Pos; en: Set<string> };
  const cands = new Map<string, Cand>();
  const cand = (w: string) => cands.get(w) ?? cands.set(w, { editions: new Set(), en: new Set() }).get(w)!;
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("wiktionary-"))) {
    const x = readDerived<WiktionaryExtract>(f)!;
    for (const h of x.headwords) {
      const w = h.word.trim();
      if (w !== w.toLowerCase() || w.includes(" ") || NOT_A_WORD.has(h.pos) || INFLECTION_RE.test(h.glosses[0] ?? "") || VARIANT_RE.test(h.glosses[0] ?? "")) continue;
      const c = cand(w);
      c.editions.add(x.edition);
      c.pos ??= POS_NAMES[h.pos];
      if (x.edition === "en") for (const g of h.glosses.slice(0, 3)) c.en.add(g);
    }
    for (const t of x.translations) {
      const w = t.word.trim();
      if (w !== w.toLowerCase() || w.includes(" ")) continue;
      const c = cand(w);
      c.editions.add(x.edition);
      if (x.edition === "en" && t.fromLang === "en" && t.from) c.en.add(t.sense && t.sense.length < 60 && t.sense.toLowerCase() !== t.from.toLowerCase() ? `${t.from} (${t.sense})` : t.from);
    }
  }
  let n = 0;
  for (const [w, c] of cands) {
    if (!VALID_WORD.test(w) || d.check(w) !== "new" || !(useOf(w) > 0 || c.editions.size >= 2)) continue;
    const word = getWord(w);
    const source: SourceId = c.editions.has("en") ? "en-wiktionary" : "wiktionary-other";
    const e = entryFor(word, c.pos ?? "other", source);
    for (const g of [...c.en].slice(0, 4)) addSense(e, { gloss: g, lang: "en", source: "en-wiktionary" });
    addSource(word.sources, source);
    if (c.editions.size > (c.editions.has("en") ? 1 : 0)) addSource(word.sources, "wiktionary-other");
    d.add(w);
    n++;
  }
  return n;
}

// ── Albanet (Albanian WordNet, CC BY 3.0): words and same-meaning groups ──────────
interface AlbanetExtract { concepts: { id: string; pos: string; sq: string[]; en: string[] }[] }
const WN_POS: Record<string, Pos> = { n: "noun", v: "verb", a: "adj", s: "adj", r: "adv" };

/**
 * Albanet groups words that mean the same thing (a "concept"). We use its word list and those
 * groups, and the English words of each concept as the meaning. Its Albanian definitions are NOT
 * used: some repeat the wording of the Academy dictionary (FGJSSH).
 */
function addAlbanet(d: Deduper, dic: Set<string>): { added: number; linked: number } {
  const x = readDerived<AlbanetExtract>("albanet.json");
  if (!x) return { added: 0, linked: 0 };
  const english = new Set(x.concepts.flatMap((c) => c.en.map((e) => e.toLowerCase())));
  let added = 0;
  let linked = 0;
  for (const c of x.concepts) {
    const pos = WN_POS[c.pos];
    if (!pos) continue;
    const members = [...new Set(c.sq.map((s) => s.trim().toLowerCase()))].filter((s) => !s.includes(" ") && VALID_WORD.test(s));
    for (const w of members) {
      // untranslated English left in Albanet (pixel, jeep) is not Albanian
      if (english.has(w) || d.check(w) !== "new" || !(dic.has(w) || (wikiCounts[w] ?? 0) >= 3)) continue;
      const word = getWord(w);
      const e = entryFor(word, pos, "albanet");
      addSense(e, { gloss: c.en.slice(0, 3).join(", "), lang: "en", source: "albanet" });
      addSource(word.sources, "albanet");
      d.add(w);
      added++;
    }
    // same-meaning group: link the members that are in the dictionary, but only those whose own
    // English meaning matches the group (ushqim "food" yes; furnizim "supply" not, though Albanet groups them)
    const groupEn = new Set(c.en.map((e) => e.toLowerCase()));
    const ownMeanings = (m: string) => words.get(m)!.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "albanet");
    const fits = (m: string) => {
      const own = ownMeanings(m);
      if (!own.length) return true; // no meaning of its own: Albanet's group is all we know
      return own.some((s) => s.gloss.toLowerCase().replace(/\([^)]*\)/g, " ").split(/[;,]/).some((part) => groupEn.has(part.replace(/^\s*(to|a|an|the)\s+/, "").trim())));
    };
    // same word class too: mal (noun) is not linked to ngrej (verb) through a verb group
    const inDict = members.filter((m) => words.has(m) && !english.has(m) && words.get(m)!.entries.some((e) => e.pos === pos) && fits(m));
    if (inDict.length < 2) continue;
    for (const m of inDict) {
      const e = words.get(m)!.entries.find((x) => x.pos === pos);
      if (!e) continue;
      const before = e.synonyms?.length ?? 0;
      // a word with its own meaning is only linked to words that have one too (shtëpi ↛ amfiteatër)
      const partners = inDict.filter((o) => o !== m && (!ownMeanings(m).length || ownMeanings(o).length));
      e.synonyms = [...new Set([...(e.synonyms ?? []), ...partners])].slice(0, 20);
      linked += e.synonyms.length - before;
    }
  }
  return { added, linked };
}

// ── Hunspell (GPL-2.0+): base words confirmed by Wikipedia or MaCoCu ────────────
/** Minimum use (word + forms) in Wikipedia + MaCoCu for a Hunspell-only word. */
const MIN_USE = 3;

/**
 * Adds base words from the Hunspell list that no other source has, when Albanian Wikipedia or
 * the MaCoCu web corpus confirms they are in use. They stay separate (own source, GPL) and are
 * marked unverified.
 */
function addHunspell(d: Deduper, dic: Set<string>): number {
  const has = (x: string) => dic.has(x);
  // words of the corpora count as possible base words when telling forms from base words
  const corpus = new Set([...Object.keys(macocuCounts).filter((w) => macocuCounts[w] >= 5), ...Object.keys(wikiCounts)]);
  const hasWide = (x: string) => dic.has(x) || corpus.has(x);
  const wiki = new Map<string, number>();
  const all = new Map<string, number>();
  const scaled = new Map<string, number>();
  for (const w of dic) {
    const k = rootOf(w, has);
    wiki.set(k, (wiki.get(k) ?? 0) + (wikiCounts[w] ?? 0));
    all.set(k, (all.get(k) ?? 0) + useOf(w));
    scaled.set(k, (scaled.get(k) ?? 0) + scaledUse(w));
  }
  // the list also holds bare stems (frik, fuq, dhimb) of words we know (frikë, fuqi, dhimbje)
  const verified = new Set([...words.values()].filter((w) => w.entries.some((e) => e.senses.length)).map((w) => w.word));
  const stemOfKnown = (w: string) => ["ë", "e", "i", "a", "je", "ja", "të", "j"].some((end) => verified.has(w + end));
  let n = 0;
  for (const l of findLemmas(dic)) {
    if (!VALID_WORD.test(l.word) || baseOf(l.word, hasWide) || stemOfKnown(l.word)) continue;
    // must be used on its own, not only through its forms (rejects stems like dhimb, rezulto);
    // verbs in -j are naturally rarer than their forms (punoj vs punon), so they get a lower bar
    const own = useOf(l.word);
    const family = all.get(l.word) ?? own;
    if (own < 1 || (family > 500 && own / family < (l.word.endsWith("j") ? 0.0005 : 0.005))) continue;
    if (!((wiki.get(l.word) ?? 0) >= 1 || (all.get(l.word) ?? 0) >= MIN_USE) || d.check(l.word) !== "new") continue;
    const w = getWord(l.word);
    w.unverified = true;
    w.frequency = Math.round(scaled.get(l.word) ?? 0);
    if (l.pos) w.entries.push({ pos: l.pos, ...(l.gender ? { gender: l.gender } : {}), senses: [], sources: ["hunspell-sq"] });
    addSource(w.sources, "hunspell-sq");
    if (wiki.get(l.word)) addSource(w.sources, "wikipedia-sq");
    if ((all.get(l.word) ?? 0) > (wiki.get(l.word) ?? 0)) addSource(w.sources, "macocu");
    d.add(l.word);
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
  // Variant links to an inflected form (âsht → është) point to its base word (jam) instead;
  // links that lead nowhere are dropped.
  const formToHead = new Map<string, string>();
  for (const w of words.values()) for (const e of w.entries) for (const f of e.forms ?? []) if (!formToHead.has(f.form)) formToHead.set(f.form, w.word);
  for (const w of words.values()) {
    if (!w.variantOf) continue;
    w.variantOf = w.variantOf
      .map((v) => (words.get(v.word)?.entries.length ? v : formToHead.has(v.word) ? { ...v, word: formToHead.get(v.word)! } : null))
      .filter((v): v is NonNullable<typeof v> => !!v && v.word !== w.word);
    if (!w.variantOf.length) delete w.variantOf;
    for (const v of w.variantOf ?? []) {
      const std = words.get(v.word);
      if (std && (v.kind === "gheg" || v.kind === "tosk")) addDialect(std, { form: w.word, dialect: v.kind, source: v.source });
    }
  }

  // Drop words without any entry and without a variant link.
  for (const [k, w] of words) if (!w.entries.length && !w.variantOf?.length) words.delete(k);

  // More headwords from other open sources, each checked against everything already in the
  // dictionary (headwords, forms, dialect forms, spellings without ë/ç, inflected forms).
  const dicFile = path.join(SRC, "hunspell-sq_AL.dic");
  const dic = fs.existsSync(dicFile) ? readDic(fs.readFileSync(dicFile, "utf8")) : new Set<string>();
  const deduper = new Deduper(words.values(), dic);
  console.log("reading other Wiktionary editions…");
  console.log(`wiktionary editions: ${addWiktionaryEditions(deduper)} new words`);
  console.log("reading Albanet…");
  const al = addAlbanet(deduper, dic);
  console.log(`albanet: ${al.added} new words, ${al.linked} same-meaning links`);
  console.log("reading the Hunspell word list…");
  console.log(`hunspell: ${addHunspell(deduper, dic)} new words confirmed by Wikipedia/MaCoCu`);

  // Reviewed corrections: words that are not words of their own (korrigjime/hiq.txt)
  const removed = readRemoveList();
  for (const r of removed) words.delete(r);
  console.log(`corrections: ${removed.length} words removed (korrigjime/hiq.txt)`);

  // How common each word is: the word and its forms in Wikipedia and MaCoCu (scaled).
  for (const w of words.values()) {
    if (w.unverified) continue;
    const forms = new Set([w.word, ...w.entries.flatMap((e) => (e.forms ?? []).map((f) => f.form))]);
    const n = Math.round([...forms].reduce((a, f) => a + scaledUse(f), 0));
    if (n) w.frequency = n;
  }

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
      "wikipedia-sq": list.filter((w) => w.sources.includes("wikipedia-sq") || (w.frequency && !w.unverified)).length,
      "wiktionary-other": list.filter((w) => w.sources.includes("wiktionary-other")).length,
      albanet: list.filter((w) => w.sources.includes("albanet")).length,
      macocu: list.filter((w) => w.sources.includes("macocu") || (w.frequency && !w.unverified)).length,
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
