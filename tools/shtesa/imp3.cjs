// node tools/shtesa/imp3.cjs <file: word|pos|description[|k]>: adds Albanian-only words (no English meaning) with our own description.
// A final |k marks the word regional (korrigjime/krahinore.txt).
const fs = require("fs");
const W = new Set(require(process.cwd() + "/data/fjalori.json").map((e) => e.word));
const shto = [], desc = [], reg = [], skipped = [];
for (const l of fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(Boolean)) {
  const [w, p, d, k] = l.split("|");
  if (!d || W.has(w)) { skipped.push(w); continue; }
  shto.push(`${w} | ${p}`);
  desc.push(`${w}\t${d.trim()}`);
  if (k) reg.push(w);
}
fs.appendFileSync("korrigjime/shto.txt", shto.join("\n") + "\n");
fs.appendFileSync("pershkrime/pershkrime.tsv", desc.join("\n") + "\n");
if (reg.length) fs.appendFileSync("korrigjime/krahinore.txt", reg.join("\n") + "\n");
console.log("added", shto.length, "regional", reg.length, skipped.length ? "| skipped: " + skipped.join(" ") : "");
