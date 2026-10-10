/**
 * Finds base words (lemmas) in the Albanian Hunspell word list (Luan Kelmendi, GPL-2.0+).
 *
 * The list spells out inflected forms (punoj, punon, punova, fushën…) next to the base words,
 * but most nouns and adjectives appear with only a few of their forms. So instead of proving a
 * full paradigm, a word counts as a lemma unless it can be explained as an inflected form of
 * another word in the list (suffix rules below). The word class is then guessed from the ending
 * and only kept when the guess is reliable.
 */
import type { Pos } from "../../src/data/model.js";

export interface Lemma { word: string; pos: Pos | null; gender?: "m" | "f" }

/** [suffix of the form, what replaces it in the base word]. */
const FORM_RULES: [string, string[]][] = [];
const add = (replacement: string, suffixes: string[]) => {
  for (const s of suffixes) FORM_RULES.push([s, [replacement]]);
};

// verbs in -j (punoj, shkruaj, fshij, lyej): present, imperfect, aorist, subjunctive, optative, middle voice
add("j", ["n", "ni", "jmë", "jnë", "ja", "je", "jë", "nte", "nim", "nit", "nin", "va", "ve", "vë", "i", "sh", "më", "në", "jtë"]);
add("j", ["het", "hem", "hesh", "hemi", "heni", "hen", "hej", "hesha", "heshe", "heshim", "heshit", "heshin", "hu", "hesh", "hemë", "hetë", "hej"]);
add("j", ["fsha", "fsh", "ftë", "fshim", "fshi", "fshin", "fshit"]);
// -oj verbs change o → u: punuam, punuar, punuakam
add("oj", ["uam", "uat", "uan", "ua", "uar", "uara", "uari", "uarin", "uarit", "uarat", "uarave", "uarën", "uarës", "uarit", "uakam", "uake", "uaka", "uakemi", "uakeni", "uakan", "uaj"]);
add("uaj", ["uar", "uara", "uari", "uarin", "uarit", "uam", "uat", "uan", "ova", "ove", "oi"]);
add("ej", ["yer", "yera", "yeri", "yerin", "yerit", "yem", "yet", "yen", "eva", "eve", "eu"]);
add("yej", ["yer", "yera", "yem", "yet", "yen"]);
add("ij", ["irë", "irën", "irës", "iva", "ive", "iu"]);
// consonant stems (verbs hap, nouns mal, adjectives madh): every ending is added to the base
add("", [
  "i", "in", "it", "u", "un", "ut", "a", "an", "at", "ave", "ash", "e", "en", "et", "es", "eve", "esh", "ë", "ën", "ës", "ët", "ëve", "ësh",
  "ëm", "ëni", "ni", "ja", "je", "te", "sh", "të", "ur", "ura", "uri", "urin", "urit", "ka", "kam", "ke", "kemi", "keni", "kan",
  "sha", "she", "shim", "shit", "shin", "em", "emi", "eni", "ej", "eja", "ra", "ri", "rin", "rit", "rat", "rave", "ish", "nte", "nim", "nit", "nin", "nj",
]);
// endings that follow a vowel only: fushë → fushën, fushës; lule → lules, lulet, luleve; shtëpi → shtëpinë
const VOWEL_ONLY = ["n", "s", "t", "ve", "në", "së", "të"];
// -ull nouns: artikull → artikuj, akull → akujt
add("ull", ["uj", "ujt", "ujve", "ujsh"]);
// -izëm nouns drop ë: absolutizëm → absolutizmi, arkaizma
add("ëm", ["mi", "min", "mit", "ma", "mat", "mave", "mash", "me", "mja", "men", "mes", "met", "meve"]); // also i mesëm → e mesme
// feminine -ë and masculine -ë nouns: fushë → fusha, fushe, fushat; burrë → burri, burra
add("ë", ["a", "e", "at", "ave", "ash", "i", "in", "it", "u", "un", "ut", "ra", "rat", "rave"]);
// feminine -e nouns: lule → lulja; bindje → bindja
add("e", ["ja", "a"]);
// adjectives in -shëm: i mundshëm → e mundshme, të mundshmit
add("shëm", ["shme", "shmi", "shmin", "shmit", "shmes", "shmet", "shmeve", "shmen", "shmja", "shmes", "shmëve"]);
// adjectives/nouns in -ës, -ër, -ël, -ëz that drop ë: mësues? no; but: vjetër → vjetra, emër → emri, vegël → vegla
add("ër", ["ra", "ri", "rin", "rit", "rat", "rave", "re", "ren", "res", "rash"]);
add("ël", ["la", "li", "lin", "lit", "lat", "lave", "le", "len", "les"]);
add("ëz", ["za", "zat", "zave", "zën", "zës", "ze"]);
add("ës", ["si", "sin", "sit", "sa", "sat", "save"]);

/** The base word this form most likely belongs to, or null when w looks like a base word itself. */
export function baseOf(w: string, has: (x: string) => boolean): string | null {
  if (w.length >= 4 && has(`${w}j`) && /[aeiouy]$/.test(w)) return `${w}j`; // imperative: puno → punoj (not ajo → ajoj)
  for (const suffix of VOWEL_ONLY) {
    const stem = w.slice(0, -suffix.length);
    if (w.endsWith(suffix) && stem.length >= 2 && /[aeëiouy]$/.test(stem) && has(stem)) return stem;
  }
  // aorist / participle stems of -j verbs: luajt, mbajt, gjet, hyr → luaj, mbaj, gjej, hyj
  if (/[aeiouy]j?t$/.test(w) && has(`${w.replace(/j?t$/, "")}j`)) return `${w.replace(/j?t$/, "")}j`;
  if (w.length <= 4 && /[aeiouy]r$/.test(w) && has(`${w.slice(0, -1)}j`)) return `${w.slice(0, -1)}j`; // hyr → hyj (not kryesor → kryesoj)
  if (w.endsWith("q") && has(`${w.slice(0, -1)}k`)) return `${w.slice(0, -1)}k`; // armiq → armik
  if (w.endsWith("gj") && has(`${w.slice(0, -2)}g`)) return `${w.slice(0, -2)}g`; // zogj → zog
  // 1st person plural of consonant verbs (hapim, bindim) — but not -im nouns (abonim, agim)
  if (w.endsWith("im") && has(w.slice(0, -2)) && has(`${w.slice(0, -2)}ni`)) return w.slice(0, -2);
  for (const [suffix, repl] of FORM_RULES) {
    if (!w.endsWith(suffix) || w.length - suffix.length < 2) continue;
    const stem = w.slice(0, w.length - suffix.length);
    for (const r of repl) {
      const base = stem + r;
      if (base !== w && base.length >= 2 && has(base)) return base;
    }
  }
  // negated participles: papunuar, pashkruar, pandarë
  if (w.startsWith("pa") && /(uar|ur|rë|yer|ar|ë)$/.test(w) && has(w.slice(2))) return w.slice(2);
  // endings that are inflections even when the base word is missing from the list
  if (NEVER_LEMMA.test(w)) return "?";
  return null;
}

/** Endings that are inflections even when the base word is missing from the list. */
const NEVER_LEMMA = /(uar|uara|imi|imin|imit|izmi|izmin|izmit|istët|istit|istin|ët|ëve|[^aeëiouy]ve|ive|isë|itë|ojë|ësh|ste|shim|shit|shin|fsha|ftë|fshin|kam|kemi|keni|uakam|het|hen|hej|uan|uam|..ia|....ione|imet|imeve|iteti|itetit|itetin|...ova|...uakan|akësh|akësha|akëshe|akëshim|akëshit|akëshin|uakemi|uakeni|..iumi|..iumit)$/;

const POS_BY_ENDING: [RegExp, Pos, "m" | "f" | undefined][] = [
  [/(oj|uaj|yej|ej|ij|aj)$/, "verb", undefined],
  [/(ohem|ohem|ehem|ihem|uhem|yhem)$/, "verb", undefined],
  [/shëm$/, "adj", undefined],
  [/(ësi|ëri|izëm|itet|ancë|encë|im|ues|tar|ist|ant|ent|or|ës)$/, "noun", undefined],
  [/(je|si|ri|ti|ësi|ishtë|ore|ëse|ase|ike|ane)$/, "noun", "f"],
];

/** Word class from the ending, only for endings that are reliable in Albanian. */
export function guessPos(w: string, has: (x: string) => boolean): { pos: Pos | null; gender?: "m" | "f" } {
  if (/j$/.test(w) && (has(`${w}më`) || has(`${w.slice(0, -1)}n`))) return { pos: "verb" };
  if (/[^aeëiouy]$/.test(w) && has(`${w}im`) && has(`${w}ni`)) return { pos: "verb" };
  for (const [re, pos, gender] of POS_BY_ENDING) if (re.test(w)) return { pos, gender };
  if (w.endsWith("ë") && has(`${w.slice(0, -1)}a`)) return { pos: "noun", gender: "f" };
  if (/[^aeëiouy]$/.test(w) && (has(`${w}i`) || has(`${w}u`)) && (has(`${w}in`) || has(`${w}un`))) return { pos: "noun", gender: "m" };
  return { pos: null };
}

/** Reads a Hunspell .dic file: drops the count line, affix flags, proper names and s'/ç' forms. */
export function readDic(text: string): Set<string> {
  const out = new Set<string>();
  for (const line of text.split(/\r?\n/).slice(1)) {
    const w = line.split("/")[0].trim();
    if (/^[a-zëç]+$/.test(w)) out.add(w);
  }
  return out;
}

/** Pronoun and adjective forms, abbreviations and foreign words that the list contains as words. */
const NOT_LEMMAS = new Set([
  "kësaj", "këtij", "këtyre", "asaj", "atij", "atyre", "cilës", "cilit", "cilin", "cilët", "cilat", "cilave", "tjerë", "tjera", "tjerët", "tjerat",
  "mëdha", "mëdhenj", "vegjël", "etj", "shek", "prof", "fig", "inter", "und", "sur", "anti", "super", "post", "dr", "nr", "pra", "ish", "the", "of", "and",
]);

export function findLemmas(words: Set<string>): Lemma[] {
  const has = (x: string) => words.has(x);
  const out: Lemma[] = [];
  for (const w of words) {
    if (w.length < 3 || NOT_LEMMAS.has(w) || /^[ivxlc]+$/.test(w) || baseOf(w, has)) continue; // xix: Roman numerals
    out.push({ word: w, ...guessPos(w, has) });
  }
  return out;
}

/** Follows baseOf until a base word is reached (malit → mali → mal). */
export function rootOf(w: string, has: (x: string) => boolean): string {
  let cur = w;
  for (let i = 0; i < 4; i++) {
    const b = baseOf(cur, has);
    if (!b || b === "?" || b === cur) break;
    cur = b;
  }
  return cur;
}
