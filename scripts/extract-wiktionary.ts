/**
 * Keeps only the Albanian parts of a wiktextract dump (any Wiktionary edition), read from stdin:
 *   - entries whose language is Albanian (lang_code "sq")
 *   - translations into Albanian found in entries of other languages (e.g. English "food" → ushqim)
 *
 *   curl -sL https://kaikki.org/raw-wiktextract-data.jsonl.gz | gzip -dc | npx tsx scripts/extract-wiktionary.ts en
 *   curl -sL https://kaikki.org/downloads/fr/fr-extract.jsonl.gz | gzip -dc | npx tsx scripts/extract-wiktionary.ts fr
 *
 * Output: derived/wiktionary-<edition>-sq.json (small; committed so the website build never downloads GBs).
 * Licence of the content: CC BY-SA 4.0 (Wiktionary).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const edition = process.argv[2];
if (!edition) throw new Error("usage: extract-wiktionary.ts <edition code, e.g. en, fr, de>");
const OUT = path.join(process.cwd(), "derived", `wiktionary-${edition}-sq.json`);

interface Headword { word: string; pos: string; glosses: string[] }
interface Translation { word: string; from: string; fromLang: string; sense: string }

const headwords: Headword[] = [];
const translations: Translation[] = [];
let lines = 0;

type Json = Record<string, unknown>;
const isSq = (o: Json) => o.lang_code === "sq" || o.code === "sq";

/** Collects every { lang_code/code: "sq", word } object below an entry (translations live in different places per edition). */
function collect(node: unknown, entry: Json, sense: string): void {
  if (Array.isArray(node)) {
    for (const x of node) collect(x, entry, sense);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Json;
  if (isSq(o) && typeof o.word === "string" && o !== entry) {
    translations.push({
      word: o.word,
      from: String(entry.word ?? ""),
      fromLang: String(entry.lang_code ?? ""),
      sense: typeof o.sense === "string" ? o.sense : sense,
    });
    return;
  }
  for (const [k, v] of Object.entries(o)) {
    if (k === "translations" || k === "senses" || k === "descendants" || Array.isArray(v) || (v && typeof v === "object")) {
      const g = k === "senses" ? "" : sense;
      collect(v, entry, g);
    }
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  lines++;
  if (lines % 500000 === 0) process.stderr.write(`\r${lines.toLocaleString("en")} lines, ${headwords.length} sq entries, ${translations.length} translations`);
  if (!line.includes('"sq"')) return; // fast path: most lines have nothing Albanian
  let e: Json;
  try {
    e = JSON.parse(line);
  } catch {
    return;
  }
  if (e.lang_code === "sq" && typeof e.word === "string") {
    const senses = (e.senses as Json[] | undefined) ?? [];
    headwords.push({
      word: e.word,
      pos: String(e.pos ?? ""),
      glosses: senses.flatMap((s) => ((s.glosses as string[] | undefined) ?? []).slice(0, 1)).slice(0, 4),
    });
    return;
  }
  collect(e.translations, e, "");
  collect(e.senses, e, "");
});
rl.on("close", () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ edition, source: `Wiktionary (${edition}) via kaikki.org / wiktextract`, licence: "CC BY-SA 4.0", retrieved: new Date().toISOString().slice(0, 10), headwords, translations }));
  console.error(`\n${edition}: ${lines.toLocaleString("en")} lines → ${headwords.length} Albanian entries, ${translations.length} translations into Albanian → ${OUT}`);
});
