// node imp2.cjs <uni.tsv> <batch: word|description>: takes word class, gender and English from the source list.
const fs = require("fs");
const POS = { A: "adj", NOUN: "noun", V: "verb", ADV: "adv", INTJ: "interj" };
const src = new Map(fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(Boolean).map((l) => { const c = l.split("\t"); return [c[0], c]; }));
const W = new Set(require(process.cwd() + "/data/fjalori.json").map((e) => e.word));
const file = "shtesa/uniparser.tsv";
const done = new Set(fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.split("\t")[0]));
const words = [], desc = [], skipped = [];
for (const l of fs.readFileSync(process.argv[3], "utf8").split(/\r?\n/).filter(Boolean)) {
  const [w, d] = l.split("|");
  const c = src.get(w);
  if (!c || !POS[c[1]] || !d) { skipped.push(w); continue; }
  if (W.has(w) || done.has(w)) { skipped.push(w + " (exists)"); continue; }
  words.push([w, POS[c[1]], /,m\b/.test(c[2]) ? "m" : /,f\b/.test(c[2]) ? "f" : "", c[3]].join("\t"));
  desc.push(w + "\t" + d.trim());
}
fs.appendFileSync(file, words.join("\n") + "\n");
fs.appendFileSync("pershkrime/pershkrime.tsv", desc.join("\n") + "\n");
console.log("added", words.length, skipped.length ? "| skipped: " + skipped.join(", ") : "");
