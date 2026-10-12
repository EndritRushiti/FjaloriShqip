/**
 * Data quality report for data/fjalori.json, run after `npm run data` in the deploy.
 * Prints counts and, on GitHub Actions, a warning per problem class so they show on the run page.
 * It never fails the build: new words from the weekly source refresh are expected to need work.
 *
 *   npx tsx scripts/quality-check.ts            report
 *   npx tsx scripts/quality-check.ts --list     also list the words of each problem class
 */
import fs from "node:fs";
import path from "node:path";
import type { Word } from "../src/data/model";

const words: Word[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "fjalori.json"), "utf8"));
const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[.\s]+$/, "").replace(/^(i|e|të) /, "");
const glosses = (w: Word) => w.entries.flatMap((e) => e.senses);

const checks: [string, (w: Word) => boolean][] = [
  ["no meaning at all", (w) => !w.description && !glosses(w).length],
  ["no Albanian description (English only)", (w) => !w.description && glosses(w).length > 0 && !glosses(w).every((s) => s.source === "auto")],
  ["only a machine-guessed English meaning", (w) => !w.description && glosses(w).length > 0 && glosses(w).every((s) => s.source === "auto")],
  ["description only repeats the word", (w) => !!w.description && norm(w.description.text) === norm(w.word)],
  // "luftim: Luftimi", "fisnikëri: Fisnikëria": the word itself with the definite article
  ["description is only the definite form of the word", (w) => !!w.description && /^\S+$/.test(norm(w.description.text)) && [w.word + "i", w.word + "a", w.word + "ja", w.word + "u", w.word.replace(/ë$/, "") + "a"].includes(norm(w.description.text))],
  ["headword is a misspelling", (w) => glosses(w).some((s) => /misspelling of|nonstandard spelling/i.test(s.gloss))],
];

const list = process.argv.includes("--list");
let problems = 0;
console.log(`quality: ${words.length} words, ${words.filter((w) => w.description).length} with an Albanian description`);
for (const [name, test] of checks) {
  const hits = words.filter(test).map((w) => w.word);
  problems += hits.length;
  console.log(`  ${String(hits.length).padStart(6)}  ${name}${hits.length ? `  (e.g. ${hits.slice(0, 8).join(", ")})` : ""}`);
  if (list && hits.length) console.log(hits.join("\n"));
  if (hits.length && process.env.GITHUB_ACTIONS) console.log(`::warning title=Data quality::${hits.length} words: ${name} (e.g. ${hits.slice(0, 5).join(", ")})`);
}
console.log(problems ? `quality: ${problems} words need work` : "quality: no problems found");
