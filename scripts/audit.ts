/**
 * Quality report for data/fjalori.json: formatting problems, suspicious headwords, likely misspellings,
 * broken links and words that are probably inflected forms. Prints counts and examples.
 *
 *   npx tsx scripts/audit.ts
 */
import fs from "node:fs";
import path from "node:path";
import { foldKey, type Word } from "../src/data/model.js";

const words: Word[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "fjalori.json"), "utf8"));
const byWord = new Map(words.map((w) => [w.word, w]));
const issues = new Map<string, string[]>();
const flag = (kind: string, example: string) => (issues.get(kind) ?? issues.set(kind, []).get(kind)!).push(example);

for (const w of words) {
  // headwords
  if (/[0-9]/.test(w.word)) flag("headword with a digit", w.word);
  if (/^[-' ]|[-' ]$/.test(w.word)) flag("headword starts/ends with - ' or space", w.word);
  if (/\s{2,}/.test(w.word)) flag("headword with double space", w.word);
  if (w.word.length === 1 && w.word !== "a" && w.word !== "e" && w.word !== "o" && w.word !== "u") flag("one-letter headword", w.word);
  if (/(.)\1\1/.test(w.word)) flag("same letter 3× in a row", w.word);
  if (!w.entries.length && !w.variantOf?.length && !w.unverified) flag("no entry and no variant link", w.word); // unverified words may lack a word class
  for (const v of w.variantOf ?? []) if (!byWord.has(v.word)) flag("variant of a word that is not in the dictionary", `${w.word} → ${v.word}`);
  for (const d of w.dialects ?? []) if (d.form === w.word) flag("dialect form equal to the word", w.word);

  // meanings
  for (const e of w.entries) {
    const seen = new Set<string>();
    for (const s of e.senses) {
      const g = s.gloss;
      if (g !== g.trim() || /\s{2,}/.test(g)) flag("meaning with extra spaces", `${w.word}: "${g}"`);
      if (/\(\s*\)|\(\s*$|^\s*\)/.test(g) || (g.match(/\(/g)?.length ?? 0) !== (g.match(/\)/g)?.length ?? 0)) flag("meaning with broken brackets", `${w.word}: ${g}`);
      if (/^[,.;:]/.test(g) || /[,;:]$/.test(g)) flag("meaning starts/ends with punctuation", `${w.word}: ${g}`);
      if (/\b(\w+) \(\1\)/i.test(g)) flag("meaning repeats itself in brackets", `${w.word}: ${g}`);
      const k = g.toLowerCase().replace(/\W+/g, " ").trim();
      if (seen.has(k)) flag("same meaning twice", `${w.word}: ${g}`);
      seen.add(k);
      if (g.length > 300) flag("very long meaning (>300 chars)", `${w.word} (${g.length})`);
    }
    if (e.synonyms?.includes(w.word)) flag("word listed as its own synonym", w.word);
  }
}

// spellings that differ only by ë/ç: one of them is usually a misspelling
const folded = new Map<string, Word[]>();
for (const w of words) (folded.get(foldKey(w.word)) ?? folded.set(foldKey(w.word), []).get(foldKey(w.word))!).push(w);
for (const group of folded.values()) {
  if (group.length < 2) continue;
  const weak = group.filter((w) => w.unverified || w.entries.every((e) => !e.senses.length));
  const strong = group.filter((w) => !weak.includes(w));
  // Gheg nasal vowels (â ê î ô û) are real spellings, not mistakes
  if (strong.length && weak.length && !weak.some((w) => /[âêîôû]/.test(w.word))) flag("probable misspelling (same letters without ë/ç as a better entry)", `${weak.map((w) => w.word).join(", ")} ~ ${strong.map((w) => w.word).join(", ")}`);
}

// the most frequent unverified words: the most visible place for mistakes
const unverified = words.filter((w) => w.unverified).sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
console.log(`\nwords: ${words.length}, unverified: ${unverified.length}\n`);
for (const [kind, list] of [...issues].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(list.length).padStart(6)}  ${kind}`);
  console.log(`        e.g. ${list.slice(0, 8).join(" | ")}`);
}
console.log("\nmost frequent unverified words (check that they are base words):");
console.log(unverified.slice(0, 150).map((w) => `${w.word}:${w.frequency}`).join(" "));
