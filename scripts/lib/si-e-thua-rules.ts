/**
 * The checks every "Si e thua ti?" form must pass before it enters the dictionary. Nothing else stands behind
 * them: there is no manual review. A form is accepted, or refused with a reason kept in korrigjime/si-e-thua-refuzuar.tsv.
 */
export const NEEDED = 3;
/** A new form that looks nothing like the word cannot be checked for meaning, so more people must confirm it. */
export const NEEDED_UNLIKE = 5;

export type Verdict = { ok: true } | { ok: false; reason: "pak" | "forma" | "fyese" | "banale" | "e-njejte" | "ekziston" | "kuptim-tjeter" | "huazim" };

export interface Knowledge {
  /** Every headword. */
  headwords: Set<string>;
  /** Forms already linked to this word: dialect forms, spellings, inflected forms. */
  linked(word: string): Set<string>;
  /** Words that mean the same as this one (shared English meaning or a variant link). */
  sameMeaning(word: string, other: string): boolean;
  /** Words on the vulgar and offensive list. */
  offensive: Set<string>;
  /** Loans kept out of the dictionary (huazime/). */
  loans: Set<string>;
}

export const fold = (s: string) => s.toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").replace(/\s+/g, " ").trim();

/** Answers that say nothing, jokes and test typing. */
const EMPTY = new Set(["test", "testim", "provë", "prove", "asdf", "qwerty", "hello", "hi", "ok", "okay", "yes", "no", "word", "lol", "haha", "hahaha", "xxx", "abc", "nuk di", "s'di", "nuk e di", "s'e di", "nuk e them", "njësoj", "njesoj", "e njëjta", "e njejta", "e njejte", "po", "jo", "mirë", "mire", "fjalë", "fjale", "asgjë", "asgje"]);
/** Endings of the ordinary inflected forms: buka, bukën, buke say nothing new. */
const ENDINGS = ["", "i", "u", "a", "ja", "t", "të", "te", "n", "in", "un", "ën", "en", "s", "së", "se", "ve", "ra", "rat", "et", "ët"];

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Two spellings of one word, as dialects usually differ: nënë and nanë, gjuhë and gjuh. */
export function looksAlike(a: string, b: string): boolean {
  const x = fold(a), y = fold(b);
  return distance(x, y) / Math.max(x.length, y.length) <= 0.5;
}

/** Shape of a real word: Albanian letters, a vowel, no long runs, no keyboard mashing. */
export function wellFormed(form: string): boolean {
  if (form.length < 2 || form.length > 40) return false;
  if (!/^[a-zçëâêîôûáéíóúàèìòù' -]+$/.test(form)) return false;
  if (!/[aeëiouyâêîôû]/.test(form)) return false;
  if (/(.)\1\1/.test(form)) return false;
  if (form.split(" ").length > 4) return false;
  return !/[bcçdfghjklmnpqrstvxz]{6}/.test(form);
}

export function check(word: string, form: string, count: number, k: Knowledge): Verdict {
  if (count < NEEDED) return { ok: false, reason: "pak" };
  if (!wellFormed(form)) return { ok: false, reason: "forma" };
  const f = fold(form), w = fold(word);
  if (form.split(" ").some((p) => k.offensive.has(p)) || k.offensive.has(form)) return { ok: false, reason: "fyese" };
  if (EMPTY.has(form) || EMPTY.has(f)) return { ok: false, reason: "banale" };
  if (f === w) return { ok: false, reason: "e-njejte" };
  if (ENDINGS.some((e) => w + e === f || (w.endsWith("e") && w.slice(0, -1) + e === f))) return { ok: false, reason: "banale" };
  const linked = k.linked(word);
  if ([...linked].some((x) => fold(x) === f)) return { ok: false, reason: "ekziston" };
  if (k.loans.has(form)) return { ok: false, reason: "huazim" };
  // a known word that means something else: under "ujë" someone types "bukë"
  if (k.headwords.has(form) && !k.sameMeaning(word, form)) return { ok: false, reason: "kuptim-tjeter" };
  // a new word that looks nothing like this one: its meaning cannot be checked, so it needs more people
  if (!k.headwords.has(form) && !looksAlike(word, form) && count < NEEDED_UNLIKE) return { ok: false, reason: "pak" };
  return { ok: true };
}
