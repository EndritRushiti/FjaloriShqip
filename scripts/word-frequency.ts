/**
 * Counts how often each word appears in a large Albanian text collection. Only counts are kept
 * (statistics, no text). The result ranks the dictionary from common to rare and confirms that
 * candidate words are really in use.
 *
 *   bzip2 -dc sources/sqwiki-latest-pages-articles.xml.bz2 | npx tsx scripts/word-frequency.ts wikipedia
 *   unzip -p sources/MaCoCu-sq-1.0.xml.zip | npx tsx scripts/word-frequency.ts macocu
 *
 * The inputs are hundreds of MB to GB, so this runs occasionally on a developer machine and the
 * small results (derived/frekuenca-<source>.json) are committed; the website build only reads them.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const SOURCES = {
  wikipedia: {
    name: "Wikipedia shqip (sq.wikipedia.org), articles dump",
    url: "https://dumps.wikimedia.org/sqwiki/latest/",
    licence: "Counts derived from CC BY-SA 4.0 text",
  },
  macocu: {
    name: "MaCoCu Albanian web corpus 1.0 (CLARIN.SI 11356/1804)",
    url: "http://hdl.handle.net/11356/1804",
    licence: "CC0 1.0",
  },
} as const;
type SourceKey = keyof typeof SOURCES;

const key = (process.argv[2] ?? "wikipedia") as SourceKey;
if (!(key in SOURCES)) throw new Error(`unknown source "${key}" (use: ${Object.keys(SOURCES).join(", ")})`);
const OUT = path.join(process.cwd(), "derived", `frekuenca-${key}.json`);
const UNKNOWN_OUT = path.join(process.cwd(), "derived", `te-panjohura-${key}.json`);
const MIN_COUNT = 3;
const MIN_UNKNOWN = 30;

const counts = new Map<string, number>();
let documents = 0;
let tokens = 0;

function count(text: string): void {
  for (const m of text.toLowerCase().matchAll(/[a-zëç]+/g)) {
    const w = m[0];
    if (w.length < 2) continue;
    tokens++;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
}

// ── Wikipedia: wiki markup inside <text> of articles (ns 0) ──
let inText = false;
let isArticle = false;
function cleanWiki(line: string): string {
  return line
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>.*?<\/ref>/g, " ")
    .replace(/&lt;.*?&gt;/g, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[(?:Skeda|File|Image|Figura|Kategoria|Category):[^\]]*\]\]/gi, " ")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/https?:\/\/\S+/g, " ");
}
function wikipediaLine(line: string): void {
  if (line.includes("<ns>")) isArticle = line.includes("<ns>0</ns>");
  if (!inText) {
    const i = line.indexOf("<text");
    if (i < 0 || !isArticle) return;
    inText = true;
    documents++;
    line = line.slice(line.indexOf(">", i) + 1);
  }
  const end = line.indexOf("</text>");
  if (end >= 0) {
    inText = false;
    line = line.slice(0, end);
  }
  if (/^\s*[{|!]/.test(line) || (/^\s*\[\[/.test(line) && /\]\]\s*$/.test(line))) return; // tables, templates, lone links
  count(cleanWiki(line));
}

// ── MaCoCu: XML; the paragraph text is on the lines between <p …> and </p> ──
let inGoodParagraph = false;
function macocuLine(line: string): void {
  if (line.startsWith("<doc")) documents++;
  if (line.startsWith("<p ")) {
    // only paragraphs the corpus marks as good Albanian text (skips menus, headings, boilerplate)
    inGoodParagraph = line.includes('quality="good"') && line.includes('lang="sq"');
    return;
  }
  if (line.startsWith("</p>")) {
    inGoodParagraph = false;
    return;
  }
  if (inGoodParagraph && !line.startsWith("<")) count(line.replace(/&[a-z]+;/g, " "));
}

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
  // candidate words from the other extracted sources, so their use can be confirmed too
  const derived = path.join(process.cwd(), "derived");
  for (const f of fs.existsSync(derived) ? fs.readdirSync(derived) : []) {
    const file = path.join(derived, f);
    if (f.startsWith("wiktionary-")) {
      const x = JSON.parse(fs.readFileSync(file, "utf8")) as { headwords: { word: string }[]; translations: { word: string }[] };
      for (const h of [...x.headwords, ...x.translations]) for (const part of h.word.toLowerCase().split(/\s+/)) v.add(part);
    } else if (f === "albanet.json") {
      for (const c of (JSON.parse(fs.readFileSync(file, "utf8")) as { concepts: { sq: string[] }[] }).concepts) for (const w of c.sq) for (const part of w.toLowerCase().split(/\s+/)) v.add(part);
    }
  }
  return v;
}

const onLine = key === "wikipedia" ? wikipediaLine : macocuLine;
let lines = 0;
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  onLine(line);
  if (++lines % 1000000 === 0) process.stderr.write(`\r${documents.toLocaleString("en")} documents, ${tokens.toLocaleString("en")} words`);
});
rl.on("close", () => {
  const vocab = vocabulary();
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const words = Object.fromEntries(sorted.filter(([w, n]) => n >= MIN_COUNT && (!vocab || vocab.has(w))));
  const meta = { source: SOURCES[key].name, url: SOURCES[key].url, licence: SOURCES[key].licence, retrieved: new Date().toISOString().slice(0, 10), documents, tokens };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ ...meta, minCount: MIN_COUNT, words }));
  // frequent words that no list knows: research material for finding missing headwords
  if (vocab) {
    const unknown = Object.fromEntries(sorted.filter(([w, n]) => n >= MIN_UNKNOWN && !vocab.has(w)).slice(0, 50000));
    fs.writeFileSync(UNKNOWN_OUT, JSON.stringify({ ...meta, minCount: MIN_UNKNOWN, words: unknown }));
  }
  console.error(`\n${documents} documents, ${tokens.toLocaleString("en")} words, ${Object.keys(words).length.toLocaleString("en")} known words (≥${MIN_COUNT}) → ${OUT}`);
});
