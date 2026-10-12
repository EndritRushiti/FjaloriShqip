/**
 * Merges the downloaded open sources into data/fjalori.json.
 *   npm run data
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { Dialect, DialectForm, Entry, Example, Form, Pos, Sense, Word } from "../src/data/model.js";
import { compareSq, POS_EN } from "../src/data/model.js";
import type { SourceId } from "../src/data/sources.js";
import { Deduper } from "./lib/dedupe.js";
import { deriveMeaning, englishCandidates } from "./lib/derive-meaning.js";
import { baseOf, findLemmas, readDic, rootOf } from "./lib/hunspell-lemmas.js";
import { borrowedFrom, WORD_LEVEL_TAGS } from "./lib/labels.js";

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
const VARIANT_RE = /^(Gheg|Tosk|Arbëresh|Arvanitika|alternative|dialectal|obsolete|archaic) (?:form|spelling|variant) of (?:(?:i|e|të|së) )?([^\s(,;:]+)/i;
/** Wiktionary dialect tags → our dialects ("Arbëresh" = Arbërisht in Italy, "Arvanitika" = Arvanitisht in Greece) */
const DIALECT_TAGS: Record<string, Dialect> = { Gheg: "gheg", Tosk: "tosk", Arbëresh: "arberesh", Arvanitika: "arvanitika" };
const dialectsOf = (tags: string[] | undefined): Dialect[] => [...new Set((tags ?? []).map((t) => DIALECT_TAGS[t]).filter((d): d is Dialect => !!d))];
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
        // "Gheg form of X", or "alternative form of X" on a sense tagged Arbëresh / Arvanitika
        const named = DIALECT_TAGS[Object.keys(DIALECT_TAGS).find((t) => t.toLowerCase() === v[1].toLowerCase()) ?? ""];
        const kinds: (Dialect | "alternative")[] = named ? [named] : dialectsOf(s.tags).filter((d) => d === "arberesh" || d === "arvanitika");
        if (!kinds.length) kinds.push("alternative");
        w.variantOf ??= [];
        for (const kind of kinds)
          if (!w.variantOf.some((x) => x.word === v[2].toLowerCase() && x.kind === kind)) w.variantOf.push({ word: v[2].toLowerCase(), kind, source: "en-wiktionary" });
        addSource(w.sources, "en-wiktionary");
        continue;
      }
      if (INFLECTION_RE.test(g)) continue;
      // a grammar line instead of a meaning: "viç m (plural viça, definite viçi…)"
      if (g.toLowerCase().startsWith(`${headword} `) && /^\S+ (m|f|n|pl|m pl|f pl)\b/.test(g)) continue;
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
      .map((f) => ({ form: f.form!, tags: (f.tags ?? []).filter((t) => !(t in DIALECT_TAGS)) }));
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
      if (!f.form || f.form.toLowerCase() === headword) continue;
      for (const dialect of dialectsOf(f.tags)) addDialect(w, { form: f.form.toLowerCase(), dialect, source: "en-wiktionary" });
    }
  }
}

/** Distinct forms of one dialect: forms listed on standard words plus dialect headwords. */
function dialectForms(list: Word[], dialect: Dialect): number {
  const forms = new Set<string>();
  for (const w of list) {
    for (const d of w.dialects ?? []) if (d.dialect === dialect) forms.add(d.form);
    if (w.variantOf?.some((v) => v.kind === dialect) || w.dialectOnly?.includes(dialect)) forms.add(w.word);
  }
  return forms.size;
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

// ── Arbëresh / Arvanitika forms from Meyer 1891 (public domain) ─────────────
/**
 * dialekte/meyer-1891.tsv: form, dialect, word class, gender, standard word, English meaning,
 * page and Meyer's own spelling (kept in the file for checking, not shown), one form per line ("#" starts a comment). A form of a standard
 * word is listed on that word's page and gets a headword pointing to it; a form without a standard
 * counterpart becomes an Arbëresh / Arvanitika word of its own.
 */
function addMeyerDialects(): { linked: number; own: number; known: number } {
  const f = path.join(process.cwd(), "dialekte", "meyer-1891.tsv");
  const out = { linked: 0, own: 0, known: 0 };
  if (!fs.existsSync(f)) return out;
  for (const raw of fs.readFileSync(f, "utf8").split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const [form, dialect, posRaw, gender, standard, meaning] = line.split("\t").map((x) => x.trim());
    if (!form || !VALID_WORD.test(form) || (dialect !== "arberesh" && dialect !== "arvanitika") || !meaning) continue;
    const d: Dialect = dialect;
    const pos = (POS_EN as Record<string, string>)[posRaw] ? (posRaw as Pos) : "other";
    const sense: Sense = { gloss: meaning, lang: "en", tags: [d === "arberesh" ? "Arbëresh" : "Arvanitika"], source: "meyer-1891" };
    const std = standard && standard !== form ? words.get(standard) : undefined;
    const w = getWord(form);
    const isNew = !w.entries.length && !w.variantOf?.length;
    const e = entryFor(w, pos, "meyer-1891");
    if (gender === "m" || gender === "f" || gender === "n") e.gender ??= gender;
    addSense(e, sense);
    if (std?.entries.length) {
      addDialect(std, { form, dialect: d, source: "meyer-1891" });
      if (isNew) w.variantOf = [{ word: std.word, kind: d, source: "meyer-1891" }];
      out.linked++;
    } else if (isNew) {
      w.dialectOnly = [d];
      out.own++;
    } else out.known++;
  }
  return out;
}


// ── Vulgar and offensive words (korrigjime/fyese.txt) ────────────────────────
const VULGAR_TAGS = new Set(["vulgar", "obscene"]);
/**
 * Removes the listed words completely, the listed meanings of other words, and every meaning the sources
 * label vulgar/obscene; then drops all references to removed words (same-meaning lists, dialect forms, variant links).
 */
function removeVulgar(): { words: number; senses: number } {
  const f = path.join(process.cwd(), "korrigjime", "fyese.txt");
  const lines = fs.existsSync(f) ? fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : [];
  const wholeWords = new Set<string>();
  const senseText = new Map<string, string[]>();
  for (const l of lines) {
    const [w, text] = l.split("|").map((x) => x.trim());
    if (text) senseText.set(w.toLowerCase(), [...(senseText.get(w.toLowerCase()) ?? []), text.toLowerCase()]);
    else wholeWords.add(w.toLowerCase());
  }
  let senses = 0;
  for (const w of words.values()) {
    const texts = senseText.get(w.word) ?? [];
    let had = 0;
    let left = 0;
    for (const e of w.entries) {
      had += e.senses.length;
      const before = e.senses.length;
      e.senses = e.senses.filter((s) => !(s.tags ?? []).some((t) => VULGAR_TAGS.has(t)) && !texts.some((t) => s.gloss.toLowerCase().includes(t)));
      senses += before - e.senses.length;
      left += e.senses.length;
    }
    if (w.labels) w.labels = w.labels.filter((l) => !VULGAR_TAGS.has(l));
    // a word whose every meaning was vulgar goes too
    if (had && !left) wholeWords.add(w.word);
  }
  for (const r of wholeWords) words.delete(r);
  for (const w of words.values()) {
    for (const e of w.entries) if (e.synonyms) e.synonyms = e.synonyms.filter((x) => !wholeWords.has(x));
    if (w.dialects) w.dialects = w.dialects.filter((d) => !wholeWords.has(d.form));
    if (w.variantOf) {
      w.variantOf = w.variantOf.filter((v) => !wholeWords.has(v.word));
      if (!w.variantOf.length) delete w.variantOf;
    }
  }
  return { words: wholeWords.size, senses };
}

// ── Albanian descriptions ────────────────────────────────────────────────────
/**
 * pershkrime/pershkrime.tsv: "word<TAB>description", one per line; "#" starts a comment.
 * A third column "rishikuar" marks a description the editor has reviewed.
 */
/** Words with an Albanian description in pershkrime/pershkrime.tsv. */
function describedWords(): Set<string> {
  const f = path.join(process.cwd(), "pershkrime", "pershkrime.tsv");
  if (!fs.existsSync(f)) return new Set();
  return new Set(fs.readFileSync(f, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t")[0].trim().toLowerCase()));
}

function addDescriptions(): number {
  const f = path.join(process.cwd(), "pershkrime", "pershkrime.tsv");
  if (!fs.existsSync(f)) return 0;
  let n = 0;
  for (const raw of fs.readFileSync(f, "utf8").split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const [word, text, status] = line.split("\t").map((x) => x.trim());
    const w = words.get(word?.toLowerCase() ?? "");
    if (!w || !text) continue;
    w.description = { text, source: "ai", ...(status === "rishikuar" ? { reviewed: true } : {}) };
    addSource(w.sources, "ai");
    n++;
  }
  return n;
}

// ── labels ───────────────────────────────────────────────────────────────────
/** Spell-checker words used less than this (Wikipedia + scaled MaCoCu) wait for review instead of being shown. */
const MIN_SHOWN_USE = 5;

/**
 * Borrowed words (from the etymology, or recognised as international words), labels that apply
 * to the whole word (dialectal, archaic, rare…), and verbs that a source filed as nouns (teproj).
 */
function addLabels(): string {
  let loans = 0;
  let labelled = 0;
  let fixed = 0;
  for (const w of words.values()) {
    const from = w.entries.map((e) => borrowedFrom(e.etymology)).find(Boolean);
    const international = w.entries.some((e) => e.senses.some((s) => s.source === "auto" && s.gloss.endsWith("(international word)")));
    if (from || international) {
      w.loan = { from: from ?? "international" };
      loans++;
    }
    const senses = w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "auto");
    const common = WORD_LEVEL_TAGS.filter((t) => senses.length > 0 && senses.every((s) => s.tags?.includes(t)));
    if (common.length) {
      w.labels = common;
      labelled++;
    }
    for (const e of w.entries) {
      const en = e.senses.filter((s) => s.lang === "en");
      if (e.pos === "noun" && en.length && en.every((s) => /^to /.test(s.gloss)) && /(oj|ej|ij|aj|uaj|yej|em|hem)$/.test(w.word)) {
        e.pos = "verb";
        fixed++;
      }
    }
  }
  // international words that have a real meaning: the meaning is their English twin (problem = "problem")
  for (const w of words.values()) {
    if (w.loan || w.word.length < 5 || w.word.includes(" ")) continue;
    const meanings = new Set(
      w.entries
        .flatMap((e) => e.senses)
        .filter((s) => s.lang === "en" && s.source !== "auto")
        .flatMap((s) => s.gloss.toLowerCase().replace(/\([^)]*\)/g, " ").split(/[;,]/))
        .map((x) => x.replace(/^\s*(to|a|an|the)\s+/, "").trim()),
    );
    if (englishCandidates(w.word).some((c) => meanings.has(c))) {
      w.loan = { from: "international" };
      loans++;
    }
  }
  // words made from a borrowed verb are borrowed too (abuzim, abuzues ← abuzoj)
  for (const w of words.values()) {
    if (w.loan) continue;
    const bases = [w.word.replace(/im$/, "oj"), w.word.replace(/im$/, "ej"), w.word.replace(/ues$/, "oj"), w.word.replace(/ues$/, "uaj"), w.word.replace(/(ueshëm|ueshme)$/, "oj")];
    const from = bases.filter((b) => b !== w.word).map((b) => words.get(b)?.loan).find(Boolean);
    if (from) {
      w.loan = { ...from };
      loans++;
    }
  }
  // variants inherit the origin of their word ("dakord: Variant of dakort" ← Italian d'accordo)
  for (const w of words.values()) {
    if (w.loan) continue;
    const ety = w.entries.map((e) => e.etymology ?? "").find((t) => /^(Variant|Alternative form|Alternative spelling) of /i.test(t));
    const target = ety?.match(/of ([^\s.,;:()]+)/)?.[1] ?? w.variantOf?.[0]?.word;
    const from = target ? words.get(target.toLowerCase())?.loan : undefined;
    if (from && from.from !== "international") {
      w.loan = { ...from };
      loans++;
    }
  }
  return `${loans} borrowed words, ${labelled} words with usage labels, ${fixed} verbs fixed`;
}

// ── editors' additions (korrigjime/shto.txt) ──────────────────────────────────
/**
 * Words and meanings added by the editors: one per line, "word | word class | English meaning | same-meaning words".
 * An existing word gets the meaning and links added; a new word is created.
 */
function addEditorWords(d: Deduper): number {
  const f = path.join(process.cwd(), "korrigjime", "shto.txt");
  if (!fs.existsSync(f)) return 0;
  let n = 0;
  for (const raw of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [word, pos, meaning, same] = line.split("|").map((x) => x.trim());
    if (!word || !VALID_WORD.test(word.toLowerCase())) continue;
    const w = getWord(word.toLowerCase());
    const e = entryFor(w, (POS_NAMES[pos] ?? (pos as Pos)) || "other", "editor");
    if (meaning) addSense(e, { gloss: meaning, lang: "en", source: "editor" });
    if (same) e.synonyms = [...new Set([...(e.synonyms ?? []), ...same.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
    addSource(w.sources, "editor");
    delete w.unverified;
    d.add(w.word);
    n++;
  }
  return n;
}

// ── approximate meanings (scripts/lib/derive-meaning.ts) ─────────────────────
const RULE_POS: Record<string, Pos> = { act: "noun", agent: "noun", able: "adj", having: "adj", relating: "adj", adverb: "adv" };
function internationalPos(w: string): Pos {
  return /(izoj|ifikoj|oj)$/.test(w) ? "verb" : /(al|ik|iv|ent|ant)$/.test(w) ? "adj" : "noun";
}

/** First short meaning without any bracketed notes (nested ones too): "coin (a piece of currency)" → "coin". */
function plainMeaning(g: string): string {
  let x = g;
  for (let i = 0; i < 4 && /\([^()]*\)/.test(x); i++) x = x.replace(/\([^()]*\)/g, " ");
  return x.replace(/[()]/g, " ").split(/[;,]/)[0].replace(/\s+/g, " ").trim();
}

function addApproximateMeanings(): number {
  const english = new Set<string>();
  const wn = path.join(SRC, "wordnet-en", "wn-data-eng.tab");
  if (fs.existsSync(wn))
    for (const line of fs.readFileSync(wn, "utf8").split("\n")) {
      const p = line.split("\t");
      if (p[1] === "lemma" && !p[2].includes("_")) english.add(p[2].trim().toLowerCase());
    }
  // short English meaning of every word that has a real one (not Albanet's concept lists)
  const meanings = new Map<string, string>();
  for (const w of words.values()) {
    const s = w.entries.flatMap((e) => e.senses).find((x) => x.lang === "en" && x.source !== "albanet" && x.source !== "auto");
    if (s) meanings.set(w.word, plainMeaning(s.gloss));
  }
  let n = 0;
  for (const w of words.values()) {
    if (meanings.has(w.word) || w.variantOf?.length || w.word.includes(" ") || w.entries.some((e) => e.senses.some((s) => s.lang === "en"))) continue;
    const d = deriveMeaning(w.word, (x) => meanings.get(x), english);
    if (!d) continue;
    const rule = d.rule.replace(/-.*/, "");
    const basePos = words.get(d.base)?.entries[0]?.pos;
    const pos: Pos = w.entries[0]?.pos ?? (rule === "international" ? internationalPos(w.word) : RULE_POS[rule] ?? (rule === "prefix" && basePos ? basePos : "other"));
    const e = w.entries[0] ?? entryFor(w, pos, "auto");
    addSense(e, { gloss: d.gloss, lang: "en", tags: ["approximate"], source: "auto" });
    addSource(w.sources, "auto");
    n++;
  }
  return n;
}

/** A word list in korrigjime/: one word per line, "#" starts a comment. */
function readWordList(file: string): string[] {
  const f = path.join(process.cwd(), "korrigjime", file);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim().toLowerCase()).filter(Boolean);
}
/** korrigjime/hiq.txt: words removed from all sources. */
const readRemoveList = () => readWordList("hiq.txt");

/**
 * korrigjime/forma.txt: "form | main word" — inflected or definite forms (madhe → madh, numri → numër)
 * stop being headwords of their own and become forms of their main word, so search still finds them.
 */
function mapFormsToHeadwords(): { mapped: number; missing: string[] } {
  const f = path.join(process.cwd(), "korrigjime", "forma.txt");
  if (!fs.existsSync(f)) return { mapped: 0, missing: [] };
  let mapped = 0;
  const missing: string[] = [];
  for (const raw of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [form, head] = line.split("|").map((x) => x.trim().toLowerCase());
    const main = head ? words.get(head) : undefined;
    if (!form || !main || form === head) {
      if (form && head) missing.push(`${form} → ${head}`);
      continue;
    }
    const e = main.entries[0] ?? entryFor(main, "other", "editor");
    if (!main.entries.some((x) => x.forms?.some((y) => y.form === form))) e.forms = [...(e.forms ?? []), { form, tags: ["editor"] }];
    words.delete(form);
    mapped++;
  }
  return { mapped, missing };
}

/** Machine-guessed English meanings are dropped once a word has a checked Albanian description. */
function dropGuessedMeanings(): number {
  let n = 0;
  for (const w of words.values()) {
    if (!w.description || !w.sources.includes("auto")) continue;
    for (const e of w.entries) e.senses = e.senses.filter((s) => s.source !== "auto");
    w.sources = w.sources.filter((s) => s !== "auto");
    n++;
  }
  return n;
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
function addWiktionaryEditions(d: Deduper, dic: Set<string>): number {
  const dir = path.join(process.cwd(), "derived");
  if (!fs.existsSync(dir)) return 0;
  type Cand = { editions: Set<string>; pos?: Pos; en: Set<string> };
  const cands = new Map<string, Cand>();
  const cand = (w: string) => cands.get(w) ?? cands.set(w, { editions: new Set(), en: new Set() }).get(w)!;
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("wiktionary-"))) {
    const x = readDerived<WiktionaryExtract>(f)!;
    for (const h of x.headwords) {
      const w = h.word.trim();
      // phrases and proverbs written as English Wiktionary entries are kept (qysh je, nuk e di)
      const phrase = x.edition === "en" && ["phrase", "proverb", "prep_phrase"].includes(h.pos) && h.glosses.length > 0;
      if (w !== w.toLowerCase() || (w.includes(" ") && !phrase) || (NOT_A_WORD.has(h.pos) && !phrase) || INFLECTION_RE.test(h.glosses[0] ?? "") || VARIANT_RE.test(h.glosses[0] ?? "")) continue;
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
    const isPhrase = w.includes(" ");
    // a word with an English meaning needs to be in use; a word known only from one foreign
    // edition, without any meaning, also needs the spell-checker list (dab, from German Wiktionary)
    const confirmed = isPhrase ? c.en.size > 0 : c.en.size > 0 ? useOf(w) > 0 || c.editions.size >= 2 : c.editions.size >= 2 || dic.has(w);
    if (!VALID_WORD.test(w) || d.check(w) !== "new" || !confirmed) continue;
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
  // words an editor has described are real words, never bare stems or forms (antik next to antikë)
  const described = describedWords();
  let n = 0;
  for (const l of findLemmas(dic)) {
    if (!VALID_WORD.test(l.word)) continue;
    if (!described.has(l.word) && (baseOf(l.word, hasWide) || stemOfKnown(l.word))) continue;
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

  // Words of their own used only in Arbëresh / Arvanitika: every English Wiktionary meaning carries that tag.
  // (Not done for Gheg/Tosk: Wiktionary also tags some standard words "Tosk".)
  for (const w of words.values()) {
    const senses = w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source === "en-wiktionary");
    if (!senses.length) continue;
    const only = (["arberesh", "arvanitika"] as Dialect[]).filter((d) => senses.every((s) => dialectsOf(s.tags).includes(d)));
    if (only.length) w.dialectOnly = only;
  }

  // Words whose every meaning is "(northern) Gheg form of X" but that the variant pattern above missed
  // (nanë → nënë, kangë → këngë): link them to X, so they are not left alone.
  const FORM_OF = /^(?:(?:northern|southern|northeastern|northwestern|central|eastern|western|standard)\s+)*(gheg|tosk|alternative)?[a-z ]*? ?(?:form|spelling|variant) of (?:(?:i|e|të|së) )?([^\s(,;:]+)/i;
  for (const w of words.values()) {
    if (w.variantOf?.length) continue;
    const g = w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en");
    const m = g.map((s) => s.gloss.match(FORM_OF));
    if (!g.length || m.some((x) => !x)) continue;
    const target = m[0]![2].toLowerCase();
    if (!words.has(target) || target === w.word) continue;
    const k = m[0]![1]?.toLowerCase();
    w.variantOf = [{ word: target, kind: k === "gheg" ? "gheg" : k === "tosk" ? "tosk" : "alternative", source: "en-wiktionary" }];
  }

  // Dialect headwords that point to a standard word: show them on the standard word's page too.
  for (const w of words.values()) {
    for (const v of w.variantOf ?? []) {
      const std = words.get(v.word);
      if (std && v.kind !== "alternative") addDialect(std, { form: w.word, dialect: v.kind, source: v.source });
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
      if (std && v.kind !== "alternative") addDialect(std, { form: w.word, dialect: v.kind, source: v.source });
    }
  }

  // Drop words without any entry and without a variant link.
  for (const [k, w] of words) if (!w.entries.length && !w.variantOf?.length) words.delete(k);

  const meyer = addMeyerDialects();
  console.log(`meyer 1891: ${meyer.linked} Arbëresh/Arvanitika forms of standard words, ${meyer.own} dialect words of their own, ${meyer.known} meanings added to known words (dialekte/meyer-1891.tsv)`);

  // More headwords from other open sources, each checked against everything already in the
  // dictionary (headwords, forms, dialect forms, spellings without ë/ç, inflected forms).
  const dicFile = path.join(SRC, "hunspell-sq_AL.dic");
  const dic = fs.existsSync(dicFile) ? readDic(fs.readFileSync(dicFile, "utf8")) : new Set<string>();
  const deduper = new Deduper(words.values(), dic);
  console.log(`editors' additions: ${addEditorWords(deduper)} words (korrigjime/shto.txt)`);
  console.log("reading other Wiktionary editions…");
  console.log(`wiktionary editions: ${addWiktionaryEditions(deduper, dic)} new words`);
  console.log("reading Albanet…");
  const al = addAlbanet(deduper, dic);
  console.log(`albanet: ${al.added} new words, ${al.linked} same-meaning links`);
  console.log("reading the Hunspell word list…");
  console.log(`hunspell: ${addHunspell(deduper, dic)} new words confirmed by Wikipedia/MaCoCu`);

  // Reviewed corrections: words that are not words of their own (korrigjime/hiq.txt)
  const removed = readRemoveList();
  for (const r of removed) words.delete(r);
  console.log(`corrections: ${removed.length} words removed (korrigjime/hiq.txt)`);
  const mapped = mapFormsToHeadwords();
  console.log(`corrections: ${mapped.mapped} inflected forms mapped to their main word (korrigjime/forma.txt)${mapped.missing.length ? `; main word missing for: ${mapped.missing.join(", ")}` : ""}`);
  const vulgar = removeVulgar();
  console.log(`vulgar: ${vulgar.words} words and ${vulgar.senses} vulgar meanings removed (korrigjime/fyese.txt)`);

  // Approximate meanings for words that have none, from words we know (clearly marked as such)
  console.log(`approximate meanings: ${addApproximateMeanings()} words`);

  // Short Albanian descriptions (pershkrime/pershkrime.tsv)
  console.log(`descriptions: ${addDescriptions()} words have an Albanian description`);
  console.log(`approximate meanings: ${dropGuessedMeanings()} guessed English meanings dropped (the word has an Albanian description)`);
  // Dialect forms without a description of their own take their standard word's: "Formë gege e fjalës nënë: …"
  const DIALECT_ADJ: Record<Dialect, string> = { gheg: "gege", tosk: "toske", arberesh: "arbëreshe", arvanitika: "arvanitase" };
  let fromStandard = 0;
  for (const w of words.values()) {
    const v = w.variantOf?.find((x) => x.kind !== "alternative");
    const std = v && words.get(v.word);
    if (w.description || !v || v.kind === "alternative" || !std?.description) continue;
    w.description = { text: `Formë ${DIALECT_ADJ[v.kind]} e fjalës «${std.word}»: ${std.description.text}`, source: "ai" };
    addSource(w.sources, "ai");
    fromStandard++;
  }
  console.log(`descriptions: ${fromStandard} dialect forms described from their standard word`);
  // Other spellings without a description of their own take their main word's: "Trajtë tjetër e fjalës «X»: …"
  let fromMain = 0;
  for (const w of words.values()) {
    if (w.description) continue;
    const main = (w.variantOf ?? []).map((x) => words.get(x.word)).find((x) => x?.description && !x.description.text.startsWith("Trajtë tjetër"));
    if (!main?.description) continue;
    w.description = { text: `Trajtë tjetër e fjalës «${main.word}»: ${main.description.text}`, source: "ai" };
    addSource(w.sources, "ai");
    fromMain++;
  }
  console.log(`descriptions: ${fromMain} other spellings described from their main word`);

  // Borrowed words, usage labels, word classes that the sources got wrong
  console.log(`labels: ${addLabels()}`);

  // Rarely used words found only in the spell-checker list wait for review (data/ne-pritje.json),
  // unless they were reviewed and accepted (korrigjime/prano.txt)
  const accepted = new Set(readWordList("prano.txt"));
  const pending = [...words.values()].filter((w) => w.unverified && (w.frequency ?? 0) < MIN_SHOWN_USE && !accepted.has(w.word)).sort((a, b) => compareSq(a.word, b.word));
  for (const w of pending) words.delete(w.word);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "ne-pritje.json"), JSON.stringify(pending));
  console.log(`pending review: ${pending.length} rarely used spell-checker words (data/ne-pritje.json)`);

  // How common each word is: the word and its forms in Wikipedia and MaCoCu (scaled).
  for (const w of words.values()) {
    if (w.unverified) continue;
    const forms = new Set([w.word, ...w.entries.flatMap((e) => (e.forms ?? []).map((f) => f.form))]);
    const n = Math.round([...forms].reduce((a, f) => a + scaledUse(f), 0));
    if (n) w.frequency = n;
    if (wikiCounts[w.word]) w.wikipediaCount = wikiCounts[w.word];
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
    ghegForms: dialectForms(list, "gheg"),
    toskForms: dialectForms(list, "tosk"),
    // distinct forms per dialect, and the standard words (headwords that are not only a dialect form)
    dialectForms: Object.fromEntries((["gheg", "tosk", "arberesh", "arvanitika"] as Dialect[]).map((d) => [d, dialectForms(list, d)])),
    standardWords: list.filter((w) => w.entries.length && !w.dialectOnly && !w.variantOf?.some((v) => v.kind !== "alternative")).length,
    bySource: {
      "en-wiktionary": list.filter((w) => w.sources.includes("en-wiktionary")).length,
      wikidata: list.filter((w) => w.sources.includes("wikidata")).length,
      "sq-wiktionary": list.filter((w) => w.sources.includes("sq-wiktionary")).length,
      "hunspell-sq": list.filter((w) => w.sources.includes("hunspell-sq")).length,
      "wikipedia-sq": list.filter((w) => w.sources.includes("wikipedia-sq") || (w.frequency && !w.unverified)).length,
      "wiktionary-other": list.filter((w) => w.sources.includes("wiktionary-other")).length,
      albanet: list.filter((w) => w.sources.includes("albanet")).length,
      macocu: list.filter((w) => w.sources.includes("macocu") || (w.frequency && !w.unverified)).length,
      auto: list.filter((w) => w.sources.includes("auto")).length,
      "meyer-1891": list.filter((w) => w.sources.includes("meyer-1891")).length,
    },
    approximate: list.filter((w) => w.sources.includes("auto")).length,
    unverified: list.filter((w) => w.unverified).length,
    sources: manifest,
  };
  fs.writeFileSync(path.join(OUT, "stats.json"), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
