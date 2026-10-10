/**
 * Approximate meanings for words that have none, worked out from words we already know.
 *
 * Albanian word formation is regular: rindërtim is the act of rindërtoj ("to rebuild"),
 * shtetëror relates to shtet ("state"), fillimisht is the adverb of fillim ("beginning").
 * International words (tradicional, federal) are matched to their English counterpart.
 * Every result names its base word and is shown as approximate, never as a real definition.
 */

export interface Derived {
  /** English text, e.g. 'act of “rindërtoj” (to rebuild)'. */
  gloss: string;
  /** The known word it is based on (or the English word for international words). */
  base: string;
  rule: string;
}

/** Looks up the short English meaning of a known word (undefined when we have none). */
export type MeaningOf = (word: string) => string | undefined;

const q = (w: string, m: string) => `“${w}” (${m})`;
const stripTo = (m: string) => m.replace(/^to /, "");

type Rule = { id: string; test: (w: string, meaning: MeaningOf) => Derived | null };

/** First base candidate that has a meaning. */
function firstKnown(cands: string[], meaning: MeaningOf): [string, string] | null {
  for (const c of cands) {
    const m = meaning(c);
    if (c.length >= 2 && m) return [c, m];
  }
  return null;
}

const RULES: Rule[] = [
  // act nouns from verbs: zgjerim ← zgjeroj, mbërritje ← mbërrij, hapje ← hap
  {
    id: "act-noun",
    test: (w, meaning) => {
      let c: string[] = [];
      if (w.endsWith("im")) c = [`${w.slice(0, -2)}oj`, `${w.slice(0, -2)}ej`, `${w.slice(0, -2)}ij`, `${w.slice(0, -2)}yej`, `${w.slice(0, -3)}uaj`];
      else if (w.endsWith("tje")) c = [`${w.slice(0, -3)}j`];
      else if (w.endsWith("je")) c = [w.slice(0, -2), `${w.slice(0, -2)}j`];
      const k = firstKnown(c, meaning);
      return k && /^to /.test(k[1]) ? { gloss: `act of ${q(k[0], stripTo(k[1]))}`, base: k[0], rule: "act-noun" } : null;
    },
  },
  // agents and instruments: mësues ← mësoj, shndërrues ← shndërroj
  {
    id: "agent",
    test: (w, meaning) => {
      if (!/(ues|yes|ës)$/.test(w)) return null;
      const stem = w.replace(/(ues|yes|ës)$/, "");
      const k = firstKnown([`${stem}oj`, `${stem}uaj`, `${stem}ej`, `${stem}yej`, stem, `${stem}j`], meaning);
      return k && /^to /.test(k[1]) ? { gloss: `one who or that which does ${q(k[0], stripTo(k[1]))}`, base: k[0], rule: "agent" } : null;
    },
  },
  // possible / able: kuptueshëm ← kuptoj, besueshëm ← besoj
  {
    id: "able",
    test: (w, meaning) => {
      if (!w.endsWith("ueshëm") && !w.endsWith("shëm")) return null;
      if (w.endsWith("ueshëm")) {
        const stem = w.slice(0, -6);
        const k = firstKnown([`${stem}oj`, `${stem}uaj`], meaning);
        if (k && /^to /.test(k[1])) return { gloss: `that can be done, able to ${q(k[0], stripTo(k[1]))}; -able`, base: k[0], rule: "able" };
      }
      const stem = w.slice(0, -4);
      const k = stem.length >= 4 ? firstKnown([stem, `${stem}ë`, `${stem}e`, `${stem}i`], meaning) : null;
      return k && !/^to /.test(k[1]) ? { gloss: `having or full of ${q(...k)}`, base: k[0], rule: "having" } : null;
    },
  },
  // relational adjectives: shtetëror ← shtet, kulturor ← kulturë, rrugor ← rrugë
  {
    id: "relating",
    test: (w, meaning) => {
      const m = w.match(/^(.+?)(ëror|or)$/); // -tar/-ar are mostly nouns (anëtar = member), so not used
      if (!m || m[1].length < 3) return null;
      const s = m[1];
      const k = firstKnown([s, `${s}ë`, `${s}e`, `${s}i`, s.replace(/ë$/, "")], meaning);
      return k && !/^to /.test(k[1]) ? { gloss: `of or relating to ${q(...k)}`, base: k[0], rule: "relating" } : null;
    },
  },
  // adverbs: fillimisht ← fillim, plotësisht ← plotë
  {
    id: "adverb",
    test: (w, meaning) => {
      if (!w.endsWith("isht") || w.length < 7) return null;
      const s = w.slice(0, -4);
      const t = s.replace(/ës$/, "");
      const k = firstKnown([`${t}ë`.replace(/ëë$/, "ë"), `${s}ë`, `${s}ëm`, s, t, s.replace(/ësh$/, "shëm")].filter((x) => x.length >= 4), meaning);
      return k ? { gloss: `in a way related to ${q(...k)}; -ly`, base: k[0], rule: "adverb" } : null;
    },
  },
  // prefixes: pa- (not), ri- (again), mos- (non-), stër- (very / great-), para- (pre-), nën- (sub-), mbi- (over-), kundër- (counter-)
  {
    id: "prefix",
    test: (w, meaning) => {
      const P: [string, string][] = [
        ["mos", "not, non-"],
        ["pa", "not, without"],
        ["ri", "again, re-"],
        ["stër", "very, great-, over-"],
        ["para", "before, pre-"],
        ["nën", "under, sub-"],
        ["mbi", "over, super-"],
        ["kundër", "counter-, anti-"],
        ["bashkë", "co-, together"],
        ["jo", "non-"],
        ["vetë", "self-"],
        ["shumë", "multi-, many"],
        ["gjysmë", "half, semi-"],
        ["ndër", "inter-, between"],
      ];
      for (const [p, sense] of P) {
        if (!w.startsWith(p) || w.length - p.length < 4) continue;
        const rest = w.slice(p.length);
        const k = firstKnown([rest], meaning);
        if (k) return { gloss: `${sense} + ${q(...k)}`, base: k[0], rule: `prefix-${p}` };
      }
      return null;
    },
  },
  // compounds of two known words: kryeministër = krye + ministër, zemërmirë = zemër + mirë
  {
    id: "compound",
    test: (w, meaning) => {
      if (w.length < 8) return null;
      for (let i = 4; i <= w.length - 4; i++) {
        const a = w.slice(0, i);
        const b = w.slice(i);
        // the first part usually ends in ë or a consonant (zemër-, krye-, rrugë-); "-isht", "-im" are endings, not words
        if (/^(isht|ime|imi|ore|ues|ëse|shëm|shme|sor|tar)$/.test(b)) continue;
        const ma = meaning(a) ?? meaning(`${a}ë`);
        const mb = meaning(b);
        if (ma && mb && !/^(abbreviation|alternative|synonym|plural|feminine)/i.test(ma + mb)) return { gloss: `compound: ${q(a, ma)} + ${q(b, mb)}`, base: `${a}+${b}`, rule: "compound" };
      }
      return null;
    },
  },
];

// ── international words ───────────────────────────────────────────────────────
const LOAN_ENDINGS: [RegExp, string[]][] = [
  [/cion$/, ["tion", "sion"]],
  [/izëm$/, ["ism"]],
  [/itet$/, ["ity"]],
  [/izoj$/, ["ize", "ise"]],
  [/ifikoj$/, ["ify"]],
  [/ikë$/, ["ics", "ic"]],
  [/ik$/, ["ic", "ical"]],
  [/ist$/, ["ist"]],
  [/ional$/, ["ional"]],
  [/al$/, ["al"]],
  [/iv$/, ["ive"]],
  [/ent$/, ["ent"]],
  [/ant$/, ["ant"]],
  [/ur$/, ["ure"]],
  [/or$/, ["or"]],
  [/ë$/, ["", "e", "a"]],
  [/$/, ["", "e"]],
];

/** Albanian spelling → likely English spelling of the same international word. */
function englishCandidates(w: string): string[] {
  const out = new Set<string>();
  for (const [re, ends] of LOAN_ENDINGS) {
    if (!re.test(w)) continue;
    const stem = w.replace(re, "");
    for (const end of ends) {
      const base = stem + end;
      for (const v of [base, base.replace(/k/g, "c"), base.replace(/ks/g, "x").replace(/k/g, "c"), base.replace(/k/g, "c").replace(/i(?=[aeou])/g, "i")])
        out.add(v.replace(/ë/g, "e").replace(/ç/g, "ch").replace(/sh/g, "sh").replace(/xh/g, "j").replace(/zh/g, "s").replace(/q/g, "ch").replace(/gj/g, "g").replace(/dh/g, "th"));
    }
    break;
  }
  return [...out].filter((x) => x.length >= 4);
}

export function deriveMeaning(w: string, meaning: MeaningOf, english: Set<string>): Derived | null {
  // international words first: tradicional → traditional, specializoj → specialize
  if (w.length >= 5 && /(cion|izëm|itet|izoj|ifikoj|ikë|ik|ist|al|iv|ent|ant|ur|or)$/.test(w)) {
    for (const c of englishCandidates(w)) if (english.has(c)) return { gloss: `${c} (international word)`, base: c, rule: "international" };
  }
  for (const r of RULES) {
    const d = r.test(w, meaning);
    if (d) return d;
  }
  return null;
}
