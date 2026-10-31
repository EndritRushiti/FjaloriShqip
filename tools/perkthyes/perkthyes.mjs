/**
 * Përkthyesi i dialekteve (offline, NOT part of the website): dialect text → standard Albanian, word by word,
 * from the dictionary's own links (dialect forms, other spellings, inflected forms) plus a few regular rules.
 *
 *   node tools/perkthyes/perkthyes.mjs "Ku âsht shpata, atje besa."      convert one text
 *   node tools/perkthyes/perkthyes.mjs --test                            measure it on thenie/thenie.tsv
 *
 * Reads data/fjalori.json (npm run data) and korrigjime/forma.txt. Nothing here is published.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fjalori.json"), "utf8"));
const W = new Map(D.map((e) => [e.word, e]));

const DIALECT_TAG = /gheg|tosk|arvanitika|arbëresh|arbereshe|cham|dialect|archaic|obsolete/i;
/** Standard = not a dialect-only word, and either not a variant or with a meaning of its own (mall "longing" is also a Gheg spelling of mal). */
const isStandard = (e) =>
  !!e && !e.dialectOnly && (!(e.variantOf && e.variantOf.length) ||
    (e.entries || []).some((en) => (en.senses || []).some((d) => !/form of|spelling of/i.test(d.gloss || "") && !(d.tags || []).some((t) => DIALECT_TAG.test(t)))));
/** Follows variant links to the standard word (at most a few steps). */
function standardOf(word) {
  let e = W.get(word);
  for (let i = 0; i < 4 && e; i++) {
    if (isStandard(e)) return e.word;
    const v = e.variantOf?.[0]?.word;
    if (!v) return null;
    e = W.get(v);
  }
  return null;
}

/** surface form → { to: standard word or form, how } */
const MAP = new Map();
const put = (form, to, how) => { if (form && to && !MAP.has(form)) MAP.set(form, { to, how }); };
// hand-checked irregular forms come first: they give the same person/case, not the headword
for (const l of fs.readFileSync(path.join(ROOT, "tools", "perkthyes", "trajta.tsv"), "utf8").split(/\r?\n/)) {
  const [f, s] = l.split("\t");
  if (f && s && !f.startsWith("#")) put(f, s, f === s ? "standard" : "irregular");
}
for (const e of D) if (isStandard(e)) put(e.word, e.word, "standard");
// standard inflected forms come right after the headwords (dora is dorë, never a dialect form of another word)
for (const e of D) {
  if (!isStandard(e)) continue;
  for (const en of e.entries || []) for (const f of en.forms || []) {
    if (!f.form || /\s/.test(f.form) || f.tags?.includes("editor")) continue;
    if (!f.tags?.some((t) => /alternative|dialectal|Gheg|Tosk|Northwestern|archaic|obsolete/i.test(t))) put(f.form, f.form, "standard form");
  }
}
for (const e of D) {
  if (isStandard(e)) continue;
  const s = standardOf(e.word);
  if (s) put(e.word, s, e.variantOf?.[0]?.kind || "variant");
}
// other listed forms: dialect spellings of standard words, and forms of dialect words
for (const e of D) {
  const s = isStandard(e) ? e.word : standardOf(e.word);
  if (!s) continue;
  for (const en of e.entries || []) for (const f of en.forms || []) {
    if (!f.form || /\s/.test(f.form) || f.tags?.includes("editor")) continue;
    const other = f.tags?.some((t) => /alternative|dialectal|Gheg|Tosk|Northwestern|archaic|obsolete/i.test(t));
    if (isStandard(e) && !other) put(f.form, f.form, "standard form");
    else put(f.form, s, "dialect form");
  }
}
// dialect words the dictionary has not linked to a standard word yet: kept as they are, counted apart
for (const e of D) if (!isStandard(e) && !standardOf(e.word)) put(e.word, e.word, "no standard link");
for (const e of D) {
  if (!isStandard(e)) continue;
  for (const d of e.dialects || []) put(d.form, e.word, d.dialect);
}

/** Standard nouns and verbs with an ending the dictionary does not list (pulja, majmuni, digjet): keep as they are. */
const ENDINGS = [
  ["ja", ["jë", "ë", "", "e"]], ["ën", ["ë"]], ["ës", ["ë"]], ["a", ["ë", ""]], ["i", [""]], ["u", [""]], ["in", [""]], ["it", [""]],
  ["në", ["", "ë"]], ["et", ["", "ë"]], ["ët", ["", "ë"]], ["at", ["ë", ""]], ["ve", ["", "ë"]],
  ["ra", [""]], ["t", [""]], ["n", [""]], ["en", ["", "ë"]], ["in", ["", "ë"]], ["ësh", ["ë"]],
  ["et", ["", "ë"]], ["en", [""]], ["emi", [""]], ["eni", [""]], ["ni", [""]], ["jnë", [""]], ["in", [""]], ["ohet", ["oj"]],
  ["on", ["oj"]], ["ojnë", ["oj"]], ["ova", ["oj"]], ["oi", ["oj"]], ["uar", ["oj"]], ["ur", [""]], ["ru", ["", "j"]], ["ju", ["j"]],
  ["uari", ["oj"]], ["uara", ["oj"]], ["uri", [""]], ["urit", [""]], ["urinë", [""]], ["urë", [""]], ["ura", [""]], ["ësh", ["ë"]],
  ["et", ["em", "es"]], ["en", ["em"]], ["hen", ["hem"]], ["het", ["hem"]], ["emi", ["em"]], // piqen, digjet → piqem, digjem
];
function standardInflection(w) {
  for (const [end, bases] of ENDINGS) {
    if (!w.endsWith(end) || w.length - end.length < 2) continue;
    for (const b of bases) {
      const e = W.get(w.slice(0, -end.length) + b);
      if (isStandard(e)) return e.word;
    }
  }
  return null;
}
for (const l of fs.readFileSync(path.join(ROOT, "korrigjime", "forma.txt"), "utf8").split(/\r?\n/)) {
  const [f, m] = l.replace(/#.*/, "").split("|").map((x) => x && x.trim());
  if (f && m) put(f, f, "standard form");
}

/** Regular rules, tried in order when a word is not found as it is. Each returns candidate spellings. */
const RULES = [
  ["old -enë/-etë/-ënë", (w) => (/(en|et|ën|ur)ë$/.test(w) ? [w.slice(0, -1)] : [])],
  ["old -ë ending", (w) => (w.endsWith("ë") ? [w.slice(0, -1)] : [])],                 // lahenë → lahen, delenë → delen
  ["old -të ending", (w) => (w.endsWith("të") ? [w.slice(0, -2) + "t", w.slice(0, -2)] : [])], // mollëtë → mollët
  ["Gheg â/ê/î/ô/û", (w) => (/[âêîôû]/.test(w) ? [w.replace(/â/g, "ë").replace(/ê/g, "e").replace(/î/g, "i").replace(/ô/g, "o").replace(/û/g, "u"), w.replace(/â/g, "a").replace(/ê/g, "e")] : [])],
  ["Gheg -un participle", (w) => (/un$/.test(w) ? [w.replace(/un$/, "ur")] : [])],     // veshun → veshur
  ["Gheg -ue participle", (w) => (/ue$/.test(w) ? [w.replace(/ue$/, "uar")] : [])],   // punue → punuar
  ["Gheg -uem", (w) => (/uem$/.test(w) ? [w.replace(/uem$/, "uar")] : [])],
  ["Gheg ue → ua", (w) => (/ue/.test(w) ? [w.replace(/ue/, "ua")] : [])],             // grue → grua
  ["Hahn's spelling", (w) => [w.replace(/é/g, "e").replace(/([bcdfgkpstvz])\1/g, "$1").replace(/tsh/g, "ç")].filter((c) => c !== w)], // dhé, shigjetta, vitshi
  ["old -rë/-lë for -ër/-ël", (w) => (/[bcdfgkpstvz][rl]ë$/.test(w) ? [w.replace(/([rl])ë$/, "ë$1")] : [])],               // dhelprë → dhelpër
  ["old 1pl -ëmë", (w) => (/ëmë$/.test(w) ? [w.replace(/ëmë$/, "im")] : [])],                                        // shohëmë → shohim
  ["old subjunctive -një", (w) => (/një$/.test(w) && w.length > 5 ? [w.replace(/një$/, "ë")] : [])],                   // hipnjë → hipë
  ["old accusative -ënë", (w) => (/[^aeiouëy]ënë$/.test(w) ? [w.replace(/ënë$/, "in"), w.replace(/ënë$/, "un")] : [])], // shkopënë → shkopin
  ["Gheg -në infinitive/3pl", (w) => (/në$/.test(w) ? [w.replace(/në$/, "jnë"), w.replace(/në$/, "n")] : [])],
];

const clean = (t) => t.toLowerCase().replace(/^[«"“(]+|[»"”).,;:!?]+$/g, "");

/** Converts one word. Returns { from, to, how } (to = null when unknown). */
export function convertWord(raw) {
  const w = clean(raw);
  if (!w || !/[a-zëçâêîôû]/.test(w)) return { from: raw, to: raw, how: "punctuation" };
  const tryOne = (x) => MAP.get(x);
  let hit = tryOne(w);
  // a regular standard form wins over a dialect reading of the same spelling (brekët, maji are standard)
  if (hit && !["standard", "standard form", "irregular"].includes(hit.how) && standardInflection(w)) return { from: raw, to: w, how: "standard form" };
  if (hit) return { from: raw, ...hit };
  // elided vowel: dit' → dita/ditë, mir' → mirë, t' → të
  if (w.endsWith("'")) {
    const base = w.slice(0, -1);
    if (base === "t") return { from: raw, to: "të", how: "elision" };
    if (base === "s") return { from: raw, to: "nuk", how: "elision" };
    if (base === "ç") return { from: raw, to: "çfarë", how: "elision" };
    for (const v of ["ë", "a", "e", "i"]) { hit = tryOne(base + v); if (hit) return { from: raw, ...hit, how: "elision" }; }
  }
  // an apostrophe after a whole word (derën', peshqirin')
  if (w.endsWith("'") && w.length > 3) {
    const r = convertWord(raw.replace(/'(?=[.,;:!?]*$)/, ""));
    if (r.to !== null) return { ...r, from: raw };
  }
  if (w.includes("-")) {
    const parts = w.split("-").map((p) => convertWord(p));
    if (parts.every((p) => p.to !== null)) return { from: raw, to: parts.map((p) => p.to).join("-"), how: "compound" };
  }
  // old Tosk/Gheg -ënë, -etë, -ësë: ditënë → ditën, mbetetë → mbetet, natësë → natës
  if (/[eë][nts]ë$/.test(w)) {
    const c = w.slice(0, -1);
    hit = tryOne(c);
    if (hit) return { from: raw, to: hit.to, how: "old -ë ending" };
    if (standardInflection(c)) return { from: raw, to: c, how: "old -ë ending" };
  }
  if (standardInflection(w)) return { from: raw, to: w, how: "standard form", lemma: standardInflection(w) };
  // a dialect word with a case/person ending (shtrofaku, çumertit): give the standard word
  for (const [end, bases] of ENDINGS) {
    if (!w.endsWith(end) || w.length - end.length < 3) continue;
    for (const b of bases) {
      hit = tryOne(w.slice(0, -end.length) + b);
      if (hit && hit.how !== "standard" && hit.how !== "standard form") return { from: raw, to: hit.to, how: "dialect stem" };
    }
  }
  for (const [name, rule] of RULES) for (const c of rule(w)) {
    hit = tryOne(c);
    if (hit) return { from: raw, to: hit.to, how: name };
    if (standardInflection(c)) return { from: raw, to: c, how: name };
  }
  // a capitalised word the dictionary does not know, not at the start of a sentence, is a name (Vasilit)
  if (/^[A-ZÇË]/.test(raw) && !convertWord.sentenceStart) return { from: raw, to: raw, how: "name" };
  return { from: raw, to: null, how: "unknown" };
}

/** Converts a text: keeps punctuation, marks unknown words with [?]. */
export function convert(text) {
  const parts = text.split(/(\s+|(?<=')(?=[a-zëçâêîôû]))/i).filter((p) => p !== undefined && p !== "");
  let start = true;
  return parts.map((p) => {
    if (/^\s+$/.test(p)) return { from: p, to: p, how: "space" };
    convertWord.sentenceStart = start;
    start = /[.!?]$/.test(p);
    return convertWord(p);
  });
}

/** Joins the converted words back into text; an elided word (t', s') gets a space when it was written joined. */
function render(res) {
  return res.map((r, i) => {
    if (r.how === "space") return r.from;
    const word = r.to === null ? `[${r.from}?]` : r.how === "punctuation" ? r.from : r.to + (/[.,;:!?]$/.test(r.from) ? r.from.slice(-1) : "");
    const joined = /'$/.test(r.from) && res[i + 1] && res[i + 1].how !== "space" && r.to !== null && !/'$/.test(r.to);
    return joined ? word + " " : word;
  }).join("");
}

if (process.argv[2] === "--test") {
  const rows = fs.readFileSync(path.join(ROOT, "thenie", "thenie.tsv"), "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
  const stat = { words: 0, standard: 0, linked: 0, rule: 0, unknown: 0, nolink: 0 };
  const nolink = new Set();
  const unknown = new Map();
  const byDialect = {};
  for (const [id, text, dialect, , standard] of rows) {
    const res = convert(text).filter((r) => r.how !== "space" && r.how !== "punctuation");
    const b = (byDialect[dialect] ??= { words: 0, unknown: 0 });
    for (const r of res) {
      stat.words++; b.words++;
      if (r.to === null) { stat.unknown++; b.unknown++; const k = clean(r.from); unknown.set(k, (unknown.get(k) || []).concat(id)); }
      else if (r.how === "standard" || r.how === "standard form") stat.standard++;
      else if (r.how === "no standard link") { stat.nolink++; nolink.add(r.to); }
      else if (RULES.some(([n]) => n === r.how) || r.how === "elision" || ["dialect stem", "compound", "name"].includes(r.how)) stat.rule++;
      else stat.linked++;
    }
  }
  const pct = (n) => ((100 * n) / stat.words).toFixed(1) + "%";
  console.log(`Sayings: ${rows.length}, words: ${stat.words}`);
  console.log(`  already standard: ${pct(stat.standard)}  linked by the dictionary: ${pct(stat.linked)}  by a rule: ${pct(stat.rule)}  in the dictionary without a standard link: ${pct(stat.nolink)}  UNKNOWN: ${pct(stat.unknown)}`);
  for (const [d, b] of Object.entries(byDialect)) console.log(`  ${d}: ${b.words} words, ${((100 * b.unknown) / b.words).toFixed(1)}% unknown`);
  console.log(`\nUnknown words (${unknown.size}), most frequent first:`);
  console.log([...unknown].sort((a, b) => b[1].length - a[1].length).map(([w, ids]) => `${w}${ids.length > 1 ? "×" + ids.length : ""}`).join("  "));
  // safety: our standard versions must come out unchanged (a word marked [?] is fine, a wrong replacement is not)
  const wrong = [];
  let stdWords = 0;
  for (const r of rows) for (const x of convert(r[4])) {
    if (x.how === "space" || x.how === "punctuation") continue;
    stdWords++;
    const from = clean(x.from).replace(/'$/, "");
    if (x.to !== null && x.to.toLowerCase().replace(/'$/, "") !== from && x.how !== "elision") wrong.push(`${from}→${x.to}`);
  }
  console.log(`\nStandard versions run through it: ${stdWords} words, ${wrong.length} changed by mistake${wrong.length ? ": " + wrong.join("  ") : ""}`);
  if (process.argv[3] === "--show") for (const [id, text, , , standard] of rows) console.log(`\n${id}\n  dialekt:  ${text}\n  makina:   ${render(convert(text))}\n  standard: ${standard}`);
} else if (process.argv[2]) {
  const res = convert(process.argv.slice(2).join(" "));
  console.log(render(res));
  for (const r of res) if (r.how !== "space" && r.how !== "punctuation" && r.how !== "standard" && r.how !== "standard form") console.log(`  ${r.from} → ${r.to ?? "?"}  (${r.how})`);
}
