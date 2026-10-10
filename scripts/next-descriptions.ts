/**
 * Lists the next words that need an Albanian description (pershkrime/pershkrime.tsv), in priority
 * order: first the words that qualify for the home page, then all others from most to least used.
 * Each line shows the word class and the English meanings, so the description matches the sense.
 *
 *   npx tsx scripts/next-descriptions.ts [count=200] [--all]
 */
import fs from "node:fs";
import path from "node:path";
import type { Word } from "../src/data/model.js";

const count = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 200);
const words: Word[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "fjalori.json"), "utf8"));

const formOfOther = new Set<string>();
for (const w of words) for (const e of w.entries) for (const f of e.forms ?? []) if (f.form !== w.word) formOfOther.add(f.form);

const realMeanings = (w: Word) => w.entries.flatMap((e) => e.senses).filter((s) => s.lang === "en" && s.source !== "auto");
const homePage = (w: Word) =>
  !w.unverified && !w.loan && !w.labels && !w.variantOf && !w.word.includes(" ") && w.word.length >= 3 && w.word.length <= 12 &&
  (w.frequency ?? 0) >= 400 && (w.wikipediaCount ?? 0) >= 100 && !formOfOther.has(w.word) &&
  w.entries.some((e) => ["noun", "verb", "adj"].includes(e.pos) && e.senses[0]?.source === "en-wiktionary");

// pershkrime/kalo.txt: words skipped for now (doubtful, or forms of other words)
const skipFile = path.join(process.cwd(), "pershkrime", "kalo.txt");
const skip = new Set(fs.existsSync(skipFile) ? fs.readFileSync(skipFile, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : []);
const todo = words.filter((w) => !w.description && !skip.has(w.word) && (realMeanings(w).length > 0 || process.argv.includes("--all")));
const rank = (w: Word) => (homePage(w) ? 1e9 : 0) + (w.wikipediaCount ?? 0) * 10 + (w.frequency ?? 0);
todo.sort((a, b) => rank(b) - rank(a));

console.log(`# ${todo.length} words with a meaning still need a description (${todo.filter(homePage).length} of them home-page words)`);
for (const w of todo.slice(0, count)) {
  const e = w.entries.find((x) => x.senses.length) ?? w.entries[0];
  const meanings = realMeanings(w).slice(0, 3).map((s) => s.gloss.slice(0, 70)).join(" ; ");
  console.log(`${w.word} | ${e?.pos ?? "?"}${w.loan ? " | huazim" : ""} | ${meanings}`);
}
