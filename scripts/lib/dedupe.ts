/**
 * Decides whether a candidate word from a new source is really new.
 * A candidate is a duplicate when it is an existing headword, a known inflected or dialect form,
 * the same word written without ë/ç (plote = plotë), or an inflected form of a known word
 * according to the Hunspell suffix rules (punova → punoj).
 */
import { foldKey, type Word } from "../../src/data/model.js";
import { baseOf, rootOf } from "./hunspell-lemmas.js";

export type Verdict = "new" | "known" | "spelling" | "inflected" | "invalid";

export class Deduper {
  private exact = new Set<string>();
  private folded = new Set<string>();

  constructor(words: Iterable<Word>, private dic: Set<string> = new Set()) {
    for (const w of words) this.add(w.word, w.entries.flatMap((e) => (e.forms ?? []).map((f) => f.form)).concat((w.dialects ?? []).map((d) => d.form)));
  }

  /** Registers an accepted word (and its forms) so later sources cannot add it again. */
  add(word: string, forms: string[] = []): void {
    for (const x of [word, ...forms]) {
      const k = x.toLowerCase().trim();
      this.exact.add(k);
      this.folded.add(foldKey(k));
    }
  }

  check(raw: string): Verdict {
    const w = raw.toLowerCase().trim();
    if (!/^[a-zçëâêîôû'][a-zçëâêîôû' -]*$/.test(w) || w.length < 2) return "invalid";
    if (this.exact.has(w)) return "known";
    if (this.folded.has(foldKey(w))) return "spelling";
    if (this.dic.size && !w.includes(" ")) {
      const has = (x: string) => this.dic.has(x) || this.exact.has(x);
      if (baseOf(w, has) === "?") return "inflected"; // an inflection ending even without a known base (dimorfizmi)
      const root = rootOf(w, has);
      if (root !== w && has(root)) return "inflected";
    }
    return "new";
  }
}
