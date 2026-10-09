/**
 * Counts how often each word appears in the articles of Albanian Wikipedia (CC BY-SA 4.0).
 * Only counts are kept (statistics, no text). The result ranks the dictionary from common to rare.
 *
 *   bzip2 -dc sources/sqwiki-latest-pages-articles.xml.bz2 | npx tsx scripts/word-frequency.ts
 *
 * The dump is ~160 MB, so this runs occasionally on a developer machine and the small
 * result (derived/frekuenca-wikipedia.json) is committed; the website build only reads it.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const OUT = path.join(process.cwd(), "derived", "frekuenca-wikipedia.json");
const MIN_COUNT = 3;

const counts = new Map<string, number>();
let articles = 0;
let tokens = 0;
let inText = false;
let isArticle = false;

/** Removes the wiki markup that is not running text. */
function clean(line: string): string {
  return line
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>.*?<\/ref>/g, " ")
    .replace(/&lt;.*?&gt;/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[(?:Skeda|File|Image|Figura|Kategoria|Category):[^\]]*\]\]/gi, " ")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (line.includes("<ns>")) isArticle = line.includes("<ns>0</ns>");
  if (!inText) {
    const i = line.indexOf("<text");
    if (i < 0 || !isArticle) return;
    inText = true;
    articles++;
    line = line.slice(line.indexOf(">", i) + 1);
  }
  const end = line.indexOf("</text>");
  if (end >= 0) {
    inText = false;
    line = line.slice(0, end);
  }
  if (/^\s*[{|!]/.test(line) || /^\s*\[\[/.test(line) && /\]\]\s*$/.test(line)) return; // tables, templates, lone links
  for (const m of clean(line).toLowerCase().matchAll(/[a-zëç]+/g)) {
    const w = m[0];
    if (w.length < 2) continue;
    tokens++;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  if (articles % 20000 === 0 && end >= 0) process.stderr.write(`\r${articles} articles, ${tokens.toLocaleString("en")} words`);
});
/** Words worth keeping: those in the Hunspell list or in the dictionary (keeps the file small). */
function vocabulary(): Set<string> | null {
  const dic = path.join(process.cwd(), "sources", "hunspell-sq_AL.dic");
  const data = path.join(process.cwd(), "data", "fjalori.json");
  if (!fs.existsSync(dic)) return null;
  const v = new Set(fs.readFileSync(dic, "utf8").split(/\r?\n/).map((l) => l.split("/")[0].trim().toLowerCase()));
  if (fs.existsSync(data)) {
    for (const w of JSON.parse(fs.readFileSync(data, "utf8")) as { word: string; entries: { forms?: { form: string }[] }[] }[]) {
      v.add(w.word);
      for (const e of w.entries) for (const f of e.forms ?? []) v.add(f.form);
    }
  }
  return v;
}

rl.on("close", () => {
  const vocab = vocabulary();
  const words = Object.fromEntries([...counts].filter(([w, n]) => n >= MIN_COUNT && (!vocab || vocab.has(w))).sort((a, b) => b[1] - a[1]));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      source: "Wikipedia shqip (sq.wikipedia.org), articles dump",
      url: "https://dumps.wikimedia.org/sqwiki/latest/",
      licence: "Counts derived from CC BY-SA 4.0 text",
      retrieved: new Date().toISOString().slice(0, 10),
      articles,
      tokens,
      minCount: MIN_COUNT,
      words,
    }),
  );
  console.error(`\n${articles} articles, ${tokens.toLocaleString("en")} words, ${Object.keys(words).length.toLocaleString("en")} distinct words (≥${MIN_COUNT}) → ${OUT}`);
});
