/**
 * Albanet, the Albanian WordNet (Ervin Ruci; CC BY 3.0 or GPL-3, via the Open Multilingual Wordnet),
 * joined with the English words of the same concept from Princeton WordNet 3.0 (WordNet licence).
 *
 *   npx tsx scripts/extract-albanet.ts      (downloads both tab files, ~6 MB, into sources/)
 *
 * Output: derived/albanet.json: one record per concept with its Albanian words, the Albanian
 * definition and examples, and the English words.
 */
import fs from "node:fs";
import path from "node:path";

const OMW = "https://raw.githubusercontent.com/omwn/omw-data/main/wns/";
const SRC = path.join(process.cwd(), "sources");
const OUT = path.join(process.cwd(), "derived", "albanet.json");

async function get(rel: string, file: string): Promise<string> {
  const f = path.join(SRC, file);
  if (!fs.existsSync(f)) {
    const res = await fetch(OMW + rel);
    if (!res.ok) throw new Error(`${rel} → HTTP ${res.status}`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(f, "utf8");
}

interface Concept { id: string; pos: string; sq: string[]; def?: string; examples: string[]; en: string[] }

(async () => {
  const als = await get("als/wn-data-als.tab", "albanet/wn-data-als.tab");
  const eng = await get("eng/wn-data-eng.tab", "wordnet-en/wn-data-eng.tab");
  const concepts = new Map<string, Concept>();
  const get1 = (id: string) => {
    let c = concepts.get(id);
    if (!c) concepts.set(id, (c = { id, pos: id.slice(-1), sq: [], examples: [], en: [] }));
    return c;
  };
  for (const line of als.split(/\r?\n/)) {
    const [id, type, a, b] = line.split("\t");
    if (!id || id.startsWith("#")) continue;
    if (type === "als:lemma") get1(id).sq.push(a.trim());
    else if (type === "als:def") get1(id).def ??= b?.trim();
    else if (type === "als:exe" && b) get1(id).examples.push(b.trim());
  }
  for (const line of eng.split(/\r?\n/)) {
    const [id, type, lemma] = line.split("\t");
    if (type === "lemma" && concepts.has(id)) concepts.get(id)!.en.push(lemma.replace(/_/g, " "));
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      source: "Albanet (Albanian WordNet, Ervin Ruci) via Open Multilingual Wordnet; English words from Princeton WordNet 3.0",
      url: "https://github.com/omwn/omw-data/tree/main/wns/als",
      licence: "Albanet: CC BY 3.0 (or GPL-3); Princeton WordNet licence",
      retrieved: new Date().toISOString().slice(0, 10),
      concepts: [...concepts.values()],
    }),
  );
  console.log(`albanet: ${concepts.size} concepts → ${OUT}`);
})();
