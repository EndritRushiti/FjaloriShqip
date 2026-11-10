import type { Word } from "../../src/data/model.js";

export function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** A stem and its Gheg shapes: without inner ë (shkatrro for shkatërro), n for r (dhelpni for dhelpëri), no d after n. */
function stems(stem: string): string[] {
  const syn = stem.replace(/(?<=.)ë(?=.)/g, "");
  const base = [stem, syn, stem.replace(/r(?=i?$)/, "n"), syn.replace(/r(?=i?$)/, "n"), syn.replace(/nd/g, "n")];
  // Gheg a (â) for standard ë, m for mb (kamt, kâmë for këmbët, këmbë)
  const more = base.flatMap((x) => [x.replace(/ë/g, "a"), x.replace(/mb/g, "m"), x.replace(/ë/g, "a").replace(/mb/g, "m")]);
  return [...new Set([...base, ...more])].filter((x) => x.length >= 3);
}
const isVerb = (w: Word) => w.entries.some((e) => e.pos === "verb");
/** A dialect form read the standard way: nasal vowels plain, Gheg -un for -ur, -ue for -uar (verbs) or -ua (others). */
export function standardReading(form: string, w: Word): string {
  let s = form.toLowerCase().normalize("NFC").replace(/[âáà]/g, "a").replace(/[êéè]/g, "e").replace(/[îí]/g, "i").replace(/[ôó]/g, "o").replace(/[ûú]/g, "u").replace(/ŷ/g, "y");
  s = s.replace(/un(?=(a|at|ë|ët|i|it|in|ve|t)?$)/, "ur");
  if (isVerb(w)) s = s.replace(/uem$/, "uar").replace(/ue$/, "uar").replace(/ye$/, "yer").replace(/g$/, "q").replace(/(?<=[^aeiouy])u$/, "uar");
  else s = s.replace(/ue(?=$|[js])/, "ua").replace(/ija$/, "ia");
  return s;
}
/** The spellings of the word itself: the headword and the variants the tables mark "alternative" (naltë for lartë). */
function spellings(w: Word): string[] {
  return [w.word, ...w.entries.flatMap((e) => (e.forms ?? []).filter((f) => (f.tags ?? []).some((t) => t === "alternative" || t === "dialectal")).map((f) => f.form))]
    .map((f) => f.toLowerCase().replace(/^(i|e|të)\s+/, ""));
}
/**
 * Whether a dialect form is an inflected form of the word (a participle, past tense, plural: Gheg "vdekuna", "vdig"
 * for vdes) and not the word itself (Gheg "des"). A tie keeps the form.
 */
export function inflectedForm(form: string, w: Word): boolean {
  const verb = isVerb(w);
  const s = standardReading(form, w);
  if (s === w.word) return false;
  const inflected = new Set(
    w.entries.flatMap((e) => (e.forms ?? [])
      // spelling variants (naltë for lartë, tagged "alternative") are the word itself, not an inflection
      .filter((f) => !(f.tags ?? []).some((t) => /^(alternative|canonical|romanization|dialectal|obsolete|archaic)$/.test(t)))
      .map((f) => f.form.replace(/^(duke|për të|të|me|u|i|e)\s+/, "")))
      .filter((f) => f && f !== w.word && !f.includes(" ")),
  );
  // a verb's own stem with an ending after it (abortojsha, riaranzhue for abortoj, riaranzhoj)
  if (verb && /(?:o|e|i|y|a)n?j$/.test(w.word)) {
    const stem = w.word.replace(/n?j$/, "");
    const stemU = stem.replace(/o$/, "u");
    // longer than the word, but not the Gheg first person (punonj for punoj), which is the word itself
    if (s.length > w.word.length - 1 && !/nj$/.test(s) && s !== w.word && stems(stem).concat(stems(stemU)).some((x) => s.startsWith(x) && s.length > x.length + 1)) return true;
  }
  // a verb not in -j with a participle or past ending (nxjerruna for nxjerr)
  if (verb && !/j$/.test(w.word))
    for (const stem of stems(w.word)) if (s.startsWith(stem) && /^(un|una|unat|unë|ur|ura|urat|urë|ëm|ët|ën|i|ni|nin|shin|ja|je|te|a|e|ë|sh|shë|in|im)$/.test(s.slice(stem.length))) return true;
  // a noun with a case or plural ending on it (bukt for bukë, Gheg dhelpnin for dhelpërinë, munsit for mundësisë)
  if (w.entries.some((e) => e.pos === "noun" || e.pos === "adj")) {
    const ending = /^(t|n|i|a|e|es|en|ja|ia|ija|në|s|së|ve|it|in|nin|sit|sija|at|ët|ën|të|ri|ra|rat|et|e|itë|ënë)$/;
    for (const stem of stems(w.word.replace(/ë$/, ""))) if (s.startsWith(stem) && s.length > stem.length && ending.test(s.slice(stem.length)) && !spellings(w).includes(s)) return true;
  }
  if (!inflected.size) return false;
  // otherwise only a form one letter (two in a long form) from an inflected form, and nearer it than the word:
  // a wholly different dialect word (kath for mjegull) is never near one
  // an inflected form with an ending on it, also without its first letter (Gheg dekunit, vdekurit for vdes)
  if ([...inflected].some((f) => f.length >= 5 && s.length > f.length && (s.startsWith(f) || s.startsWith(f.slice(1))) && !w.word.startsWith(s))) return true;
  const toWord = lev(s, w.word);
  return [...inflected].some((f) => {
    const d = lev(s, f);
    return d < toWord && d <= (f.length >= 6 ? 2 : 1);
  });
}

/**
 * Whether a dialect form is the same word, said the dialect's way (Gheg des for vdes, grue for grua, naltë for
 * lartë), and not another word with the same meaning (kath for mjegull): read the standard way, it differs from the
 * word or one of its spellings in at most half its letters.
 */
export function sameWord(form: string, w: Word): boolean {
  const s = standardReading(form, w);
  return spellings(w).some((x) => lev(s, x) <= Math.max(1, Math.floor(x.length / 2)));
}
/** What the word map shows: the word as each dialect says it, never an inflected form or another word. */
export function onMap(form: string, w: Word): boolean {
  return sameWord(form, w) && !inflectedForm(form, w);
}
