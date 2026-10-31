/**
 * Përkthyesi i dialekteve (offline, NOT part of the website): dialect text → standard Albanian, word by word,
 * from the dictionary's own links (dialect forms, other spellings, inflected forms) plus a few regular rules.
 *
 *   node tools/perkthyes/perkthyes.mjs "Ku âsht shpata, atje besa."      convert one text
 *   node tools/perkthyes/perkthyes.mjs --test                            measure it on thenie/thenie.tsv
 *   node tools/perkthyes/perkthyes.mjs --page out.html                   write a private test page (one file, all data inside)
 *
 * Reads data/fjalori.json (npm run data) and korrigjime/forma.txt. Nothing here is published.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeConverter } from "./core.mjs";

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

for (const l of fs.readFileSync(path.join(ROOT, "korrigjime", "forma.txt"), "utf8").split(/\r?\n/)) {
  const [f, m] = l.replace(/#.*/, "").split("|").map((x) => x && x.trim());
  if (f && m) put(f, f, "standard form");
}

const STANDARD = new Set(D.filter(isStandard).map((e) => e.word));
export const { convert, convertWord, render, clean, RULES } = makeConverter(MAP, STANDARD);

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
} else if (process.argv[2] === "--page") {
  // one self-contained test page: the same core code plus the word links it needs
  const std = [], links = [], how = [];
  for (const [form, { to, how: h }] of MAP) {
    if (to === form && (h === "standard" || h === "standard form")) { std.push(form); continue; }
    let k = how.indexOf(h);
    if (k < 0) k = how.push(h) - 1;
    links.push([form, to, k]);
  }
  const examples = fs.readFileSync(path.join(ROOT, "thenie", "thenie.tsv"), "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t")[1])
    .filter((t, i) => [0, 8, 14, 23, 36, 120, 140, 160].includes(i));
  const data = JSON.stringify({ std, links, how, heads: [...STANDARD], examples }).replace(/</g, "\\u003c");
  const core = fs.readFileSync(path.join(ROOT, "tools", "perkthyes", "core.mjs"), "utf8").replace(/^export /m, "");
  const html = fs.readFileSync(path.join(ROOT, "tools", "perkthyes", "faqja.html"), "utf8")
    .replace("/*DATA*/", () => data).replace("/*CORE*/", () => core);
  const out = process.argv[3] || "perkthyes.html";
  fs.writeFileSync(out, html);
  console.log(`${out}: ${(html.length / 1e6).toFixed(1)} MB, ${std.length} standard forms, ${links.length} dialect links`);
} else if (process.argv[2]) {
  const res = convert(process.argv.slice(2).join(" "));
  console.log(render(res));
  for (const r of res) if (r.how !== "space" && r.how !== "punctuation" && r.how !== "standard" && r.how !== "standard form") console.log(`  ${r.from} → ${r.to ?? "?"}  (${r.how})`);
}
