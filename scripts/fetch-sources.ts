/**
 * Downloads the openly licensed sources into ./sources (not committed).
 * Every source is recorded in sources/manifest.json with its URL, licence and
 * retrieval date — the References page ("Burimet") is generated from it.
 *
 *   npm run sources            (skips sources already downloaded)
 *   npm run sources -- --force (download everything again)
 */
import fs from "node:fs";
import path from "node:path";
import { SOURCES, type SourceId } from "../src/data/sources.js";
// @ts-expect-error no type definitions published for unbzip2-stream
import bunzip2 from "unbzip2-stream";

const DIR = path.join(process.cwd(), "sources");
const UA = "FjaloriShqip/0.1 (open Albanian dictionary project; contact via the GitHub repository)";
const force = process.argv.includes("--force");

type Manifest = Partial<Record<SourceId, { retrieved: string; url: string; items: number }>>;

function readManifest(): Manifest {
  const f = path.join(DIR, "manifest.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}
function writeManifest(m: Manifest): void {
  fs.writeFileSync(path.join(DIR, "manifest.json"), JSON.stringify(m, null, 2));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  throw new Error(`${url} → gave up after retries`);
}

/** English Wiktionary, Albanian section, as extracted by kaikki.org (wiktextract). */
async function kaikki(m: Manifest): Promise<void> {
  const file = path.join(DIR, "kaikki-albanian.jsonl");
  if (!force && fs.existsSync(file)) {
    console.log("kaikki: already present");
    m["en-wiktionary"] ??= { retrieved: today(), url: SOURCES["en-wiktionary"].downloadUrl!, items: countLines(file) };
    return;
  }
  console.log("kaikki: downloading (~70 MB)…");
  const res = await fetch(SOURCES["en-wiktionary"].downloadUrl!, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`kaikki HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  m["en-wiktionary"] = { retrieved: today(), url: SOURCES["en-wiktionary"].downloadUrl!, items: countLines(file) };
}

function countLines(file: string): number {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length;
}

/** Wikidata lexemes in Albanian (CC0). */
async function wikidata(m: Manifest): Promise<void> {
  const file = path.join(DIR, "wikidata-lexemes.json");
  if (!force && fs.existsSync(file)) {
    console.log("wikidata: already present");
    return;
  }
  console.log("wikidata: querying lexemes…");
  const query = `
    SELECT ?l ?lemma ?cat ?catLabel ?sense ?gloss (LANG(?gloss) AS ?glang) WHERE {
      ?l dct:language wd:Q8748 ; wikibase:lemma ?lemma ; wikibase:lexicalCategory ?cat .
      OPTIONAL { ?l ontolex:sense ?sense . ?sense skos:definition ?gloss . FILTER(LANG(?gloss) IN ("en", "sq")) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson<{ results: { bindings: Record<string, { value: string }>[] } }>(url, { headers: { Accept: "application/sparql-results+json" } });
  const rows = data.results.bindings.map((b) => ({
    id: b.l.value.split("/").pop()!,
    lemma: b.lemma.value,
    category: b.catLabel?.value ?? "",
    gloss: b.gloss?.value ?? null,
    glossLang: b.glang?.value ?? null,
  }));
  fs.writeFileSync(file, JSON.stringify(rows));
  m["wikidata"] = { retrieved: today(), url: "https://query.wikidata.org/", items: new Set(rows.map((r) => r.id)).size };
  console.log(`wikidata: ${rows.length} rows`);
}

/**
 * Albanian Wiktionary: the official Wikimedia dump (one file, gentle on their servers).
 * Only facts (word, part of speech, gender) are used later — not the definitions,
 * because some of them appear to be copied from copyrighted dictionaries.
 */
async function sqWiktionary(m: Manifest): Promise<void> {
  const file = path.join(DIR, "sq-wiktionary.jsonl");
  if (!force && fs.existsSync(file) && fs.statSync(file).size > 5_000_000) {
    console.log("sq.wiktionary: already present");
    return;
  }
  const url = "https://dumps.wikimedia.org/sqwiktionary/latest/sqwiktionary-latest-pages-articles.xml.bz2";
  console.log("sq.wiktionary: downloading the dump (~8 MB)…");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok || !res.body) throw new Error(`dump HTTP ${res.status}`);
  const bz2 = path.join(DIR, "sqwiktionary.xml.bz2");
  fs.writeFileSync(bz2, Buffer.from(await res.arrayBuffer()));
  const xml = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    fs.createReadStream(bz2).pipe(bunzip2()).on("data", (c: Buffer) => chunks.push(c)).on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))).on("error", reject);
  });
  const out: string[] = [];
  for (const page of xml.split("<page>").slice(1)) {
    const ns = page.match(/<ns>(\d+)<\/ns>/)?.[1];
    if (ns !== "0") continue;
    const title = decodeXml(page.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    const text = decodeXml(page.match(/<text[^>]*>([\s\S]*?)<\/text>/)?.[1] ?? "");
    if (title && text.includes("Shqip")) out.push(JSON.stringify({ title, text }));
  }
  fs.writeFileSync(file, out.join("\n"));
  fs.unlinkSync(bz2);
  m["sq-wiktionary"] = { retrieved: today(), url, items: out.length };
  console.log(`sq.wiktionary: ${out.length} pages with an Albanian section`);
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const m = readManifest();
  await kaikki(m);
  writeManifest(m);
  await wikidata(m);
  writeManifest(m);
  await sqWiktionary(m);
  writeManifest(m);
  console.log("done:", JSON.stringify(m, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
