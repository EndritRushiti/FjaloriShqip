/**
 * The Sunday job (.github/workflows/si-e-thua.yml): reads the forms that reached the threshold from the Worker,
 * checks each one (scripts/lib/si-e-thua-rules.ts), adds the accepted ones to dialekte/si-e-thua.tsv and records
 * the refused ones with their reason. The Monday deploy then publishes them. Needs data/fjalori.json.
 *
 * Run from the repo: npx tsx scripts/si-e-thua.ts [file.json]   (a file instead of the live list, for testing)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import type { Word } from "../src/data/model.js";
import { check, fold, type Knowledge } from "./lib/si-e-thua-rules.js";

interface Ready { word: string; dialect: string; form: string; count: number; regions: string[] }
const TSV = "dialekte/si-e-thua.tsv";
const REFUSED = "korrigjime/si-e-thua-refuzuar.tsv";
const URL_ = "https://fjalorishqip.org/si-e-thua";

const lines = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split(/\r?\n/) : []);
const firstColumn = (f: string, sep: string | RegExp) => lines(f).filter((l) => l && !l.startsWith("#")).map((l) => l.split(sep)[0].trim());

function knowledge(): { k: Knowledge; byWord: Map<string, Word> } {
  const words = JSON.parse(fs.readFileSync("data/fjalori.json", "utf8")) as Word[];
  const byWord = new Map(words.map((w) => [w.word, w]));
  const gloss = (w?: Word) => new Set((w?.entries ?? []).flatMap((e) => e.senses.flatMap((s) => s.gloss.toLowerCase().split(/[^a-z]+/))).filter((x) => x.length > 3));
  const k: Knowledge = {
    headwords: new Set(byWord.keys()),
    linked: (word) => {
      const w = byWord.get(word);
      return new Set([...(w?.dialects ?? []).map((d) => d.form), ...(w?.entries ?? []).flatMap((e) => (e.forms ?? []).map((f) => f.form))]);
    },
    sameMeaning: (word, other) => {
      const a = byWord.get(word), b = byWord.get(other);
      if (a?.dialects?.some((d) => d.form === other) || b?.variantOf?.some((v) => v.word === word) || a?.variantOf?.some((v) => v.word === other)) return true;
      const g = gloss(a);
      return [...gloss(b)].some((x) => g.has(x));
    },
    offensive: new Set(firstColumn("korrigjime/fyese.txt", "|")),
    loans: new Set(fs.readdirSync("huazime").flatMap((f) => firstColumn(`huazime/${f}`, "\t"))),
  };
  return { k, byWord };
}

const headwords = () => (JSON.parse(fs.readFileSync("data/fjalori.json", "utf8")) as Word[]).map((w) => w.word);

async function main() {
  const file = process.argv[2];
  const ready = (file ? JSON.parse(fs.readFileSync(file, "utf8")) : await (await fetch(URL_, { headers: { "User-Agent": "FjaloriShqip" } })).json()) as Ready[];
  const { k, byWord } = knowledge();
  const before = new Set(headwords());
  const done = new Set(lines(TSV).filter((l) => l && !l.startsWith("#")).map((l) => { const c = l.split("\t"); return `${fold(c[4])}|${c[1]}|${fold(c[0])}`; }));
  const seenRefused = new Set(lines(REFUSED).map((l) => l.split("\t").slice(0, 3).join("\t")));
  const rows: string[] = [], refused: string[] = [];
  for (const r of ready) {
    if (done.has(`${fold(r.word)}|${r.dialect}|${fold(r.form)}`)) continue;
    const w = byWord.get(r.word);
    const v = w ? check(r.word, r.form, r.count, k) : ({ ok: false, reason: "forma" } as const);
    if (v.ok) {
      const e = w!.entries[0];
      // the loader skips a row with no English meaning: the form means what the standard word means
      const meaning = w!.entries.flatMap((x) => x.senses).find((s) => s.lang === "en")?.gloss ?? `same as ${r.word}`;
      rows.push([r.form, r.dialect, e?.pos ?? "", e?.gender ?? "", r.word, meaning, "", r.regions.join(", ")].join("\t"));
    } else if (v.reason !== "pak" && !seenRefused.has(`${r.word}\t${r.dialect}\t${r.form}`)) {
      refused.push([r.word, r.dialect, r.form, v.reason, String(r.count)].join("\t"));
    }
  }
  if (refused.length) fs.appendFileSync(REFUSED, `${refused.join("\n")}\n`);
  console.log(`ready ${ready.length}, accepted ${rows.length}, refused ${refused.length}`);
  if (!rows.length) return;

  // a new form must never hide a word already in the dictionary: rebuild and compare
  const old = fs.readFileSync(TSV, "utf8");
  fs.appendFileSync(TSV, `${rows.join("\n")}\n`);
  execSync("npx tsx scripts/build-data.ts", { stdio: "ignore" });
  const after = new Set(headwords());
  const lost = [...before].filter((w) => !after.has(w));
  if (lost.length) {
    fs.writeFileSync(TSV, old);
    execSync("npx tsx scripts/build-data.ts", { stdio: "ignore" });
    fs.appendFileSync(REFUSED, rows.map((r) => { const c = r.split("\t"); return [c[4], c[1], c[0], "fsheh-fjale", lost.slice(0, 3).join(",")].join("\t"); }).join("\n") + "\n");
    console.log(`refused the whole batch, it would hide: ${lost.slice(0, 10).join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
