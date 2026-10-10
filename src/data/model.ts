import type { SourceId } from "./sources.js";

/** Normalised part of speech. */
export type Pos = "noun" | "verb" | "adj" | "adv" | "pron" | "num" | "prep" | "conj" | "interj" | "particle" | "det" | "other";

export const POS_SQ: Record<Pos, string> = {
  noun: "emër",
  verb: "folje",
  adj: "mbiemër",
  adv: "ndajfolje",
  pron: "përemër",
  num: "numëror",
  prep: "parafjalë",
  conj: "lidhëz",
  interj: "pasthirrmë",
  particle: "pjesëz",
  det: "përcaktor",
  other: "tjetër",
};

export const POS_EN: Record<Pos, string> = {
  noun: "noun", verb: "verb", adj: "adjective", adv: "adverb", pron: "pronoun", num: "numeral",
  prep: "preposition", conj: "conjunction", interj: "interjection", particle: "particle", det: "determiner", other: "other",
};

export interface Example {
  text: string;
  english?: string;
}

export interface Sense {
  gloss: string;
  /** Language of the gloss. */
  lang: "en" | "sq";
  tags?: string[];
  examples?: Example[];
  source: SourceId;
}

export interface Form {
  form: string;
  tags: string[];
}

export interface Entry {
  pos: Pos;
  gender?: "m" | "f" | "n";
  senses: Sense[];
  forms?: Form[];
  ipa?: string[];
  etymology?: string;
  /** Words with the same meaning, as listed by the source. */
  synonyms?: string[];
  sources: SourceId[];
}

export interface DialectForm {
  form: string;
  dialect: "gheg" | "tosk";
  source: SourceId;
}

export interface Word {
  word: string;
  entries: Entry[];
  /** Gheg / Tosk forms of this word. */
  dialects?: DialectForm[];
  /** This headword is itself a dialect or alternative form of another word. */
  variantOf?: { word: string; kind: "gheg" | "tosk" | "alternative"; source: SourceId }[];
  /** How often the word and its forms appear in Albanian Wikipedia (word counts only). */
  frequency?: number;
  /** Found automatically (Hunspell word list); no meaning yet and the word class is a guess. */
  unverified?: boolean;
  sources: SourceId[];
}

/** Albanian alphabetical order (36 letters). */
export const ALPHABET = ["a", "b", "c", "ç", "d", "dh", "e", "ë", "f", "g", "gj", "h", "i", "j", "k", "l", "ll", "m", "n", "nj", "o", "p", "q", "r", "rr", "s", "sh", "t", "th", "u", "v", "x", "xh", "y", "z", "zh"];

/** First letter of a word in the Albanian alphabet (digraphs count as one letter). */
export function firstLetter(word: string): string {
  const w = word.toLowerCase();
  const two = w.slice(0, 2);
  if (ALPHABET.includes(two)) return two;
  const one = w[0] ?? "";
  return ALPHABET.includes(one) ? one : "#";
}

/** Search key: lowercase, ë→e, ç→c, Gheg nasal vowels folded (â→a…). */
export function foldKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ë/g, "e")
    .replace(/ç/g, "c")
    .replace(/[âäà]/g, "a")
    .replace(/[êé]/g, "e")
    .replace(/[îí]/g, "i")
    .replace(/[ôó]/g, "o")
    .replace(/[ûú]/g, "u")
    .replace(/[^a-z]/g, "");
}

/** Albanian collation: compare letter by letter using the Albanian alphabet. */
export function compareSq(a: string, b: string): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function sortKey(w: string): string {
  const s = w.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const idx2 = ALPHABET.indexOf(two);
    if (two.length === 2 && idx2 >= 0) {
      out += String.fromCharCode(65 + idx2);
      i += 2;
      continue;
    }
    const idx1 = ALPHABET.indexOf(s[i]);
    out += idx1 >= 0 ? String.fromCharCode(65 + idx1) : "~";
    i++;
  }
  return out;
}
