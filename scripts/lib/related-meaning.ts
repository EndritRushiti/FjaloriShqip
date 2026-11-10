import type { Word } from "../../src/data/model.js";

/**
 * Whether a word formed from another (punëtor from punë, mësues from mësoj) still shares its meaning: the
 * "Fjalë nga e njëjta rrënjë" list leaves out words that only look alike (aspirator "vacuum cleaner" next to
 * aspiroj "aim"). Two words are related when a word of one meaning starts like a word of the other (work, worker;
 * synim, synoj), or the derived word's description names the base word. With no meaning to compare, they stay linked.
 */
const STOP_EN = new Set(["the", "and", "for", "with", "that", "from", "used", "which", "into", "one", "who", "something", "someone", "person", "thing", "act", "state", "being", "having", "make", "made", "also", "form", "other", "very", "not", "out", "its", "his", "her", "certain", "kind", "type", "quality", "process", "action", "result", "place", "use", "way"]);
const STOP_SQ = new Set(["edhe", "ose", "nga", "një", "për", "që", "dhe", "por", "më", "ajo", "ai", "atë", "kjo", "ky", "diçka", "dikush", "dikë", "dikujt", "diçkaje", "bëj", "bën", "bëhet", "fjalë", "formë", "trajtë", "kuptim", "lloj", "gjë", "send", "mënyrë", "veprim", "gjendje", "cilësi", "vend", "njeri", "person", "shumë", "pak", "tjetër", "kemi", "ka", "kanë", "është", "janë", "jam", "duke", "mjekësi", "zakonisht", "veçanërisht"]);

const tokens = (text: string, stop: Set<string>) =>
  text.toLowerCase().split(/[^a-zçë]+/).filter((x) => x.length >= 3 && !stop.has(x));

function meaningWords(w: Word): { en: string[]; sq: string[] } {
  const en = w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "auto").flatMap((s) => tokens(s.gloss, STOP_EN));
  const sqText = [w.description?.text ?? "", ...w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "sq").map((s) => s.gloss)].join(" ");
  return { en, sq: tokens(sqText, STOP_SQ) };
}

function common(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
/** Two words alike enough to be one word: worker and work, synim and synoj (all but the last two letters shared). */
const alike = (a: string, b: string) => {
  const c = common(a, b);
  return c >= 3 && c >= Math.min(a.length, b.length) - 2;
};
const meet = (xs: string[], ys: string[]) => xs.some((x) => ys.some((y) => alike(x, y)));

/**
 * Regular derivations keep the base meaning: a prefix (joortodoks, moskuptim, mbiprodhim), the middle voice
 * (adresohem), act nouns and agent nouns of verbs (punim, larje, mësues), adverbs (aktualisht) and nouns of
 * quality (bukuri, mirësi, dituri). Only the other endings (-tor, -tar, -ik, -ist, -oj from a noun) are checked.
 */
export function regularDerivation(child: string, parent: string): boolean {
  if (child.endsWith(parent) && child !== parent) return true;
  // the whole base word, of five letters or more, with an ending on it: dëshmitar, imperialist, alpinist
  // (aspirator does not hold the whole of aspiratë, fashizëm not the whole of fashë)
  if (parent.length >= 5 && child.startsWith(parent) && child !== parent) return true;
  return /(hem|het|uar|isht|im|je|ues|yes|ueshëm|ësi|i)$/.test(child) && !/(tor|tar|ik|ist|izëm)$/.test(child);
}

export function relatedMeaning(child: Word, parent: Word): boolean {
  if (regularDerivation(child.word, parent.word)) return true;
  const c = meaningWords(child), p = meaningWords(parent);
  // an English meaning that only repeats the word (aspirator, aspiration) says nothing about the meaning
  const echo = (x: string) => alike(x, child.word) || alike(x, parent.word) || common(x, child.word) >= 5 || common(x, parent.word) >= 5;
  c.en = c.en.filter((x) => !echo(x));
  p.en = p.en.filter((x) => !echo(x));
  // one description names the other word: "Kryej abandonimin" for abandonoj
  if (meet(c.sq, [parent.word]) || meet(p.sq, [child.word])) return true;
  if ((!c.en.length && !c.sq.length) || (!p.en.length && !p.sq.length)) return true;
  return meet(c.en, p.en) || meet(c.sq, p.sq);
}
