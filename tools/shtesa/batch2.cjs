// Next rare Uniparser words, in alphabetical steps across the list: node batch2.cjs <uni.tsv> <count> <step>
const fs = require("fs");
const [, , file, count, step] = process.argv;
const POS = { A: "adj", NOUN: "noun", V: "verb", ADV: "adv", INTJ: "interj" };
const seenFile = process.argv[1].replace("batch2.cjs", "shown.txt");
const shown = new Set(fs.existsSync(seenFile) ? fs.readFileSync(seenFile, "utf8").split(/\r?\n/) : []);
const done = new Set(fs.readFileSync("shtesa/uniparser.tsv", "utf8").split(/\r?\n/).map((l) => l.split("\t")[0]));
const DICT = new Set(require(process.cwd() + "/data/fjalori.json").map((e) => e.word));
const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("\t")).filter(([w, p, g, en]) => {
  if (!POS[p] || done.has(w) || shown.has(w) || w.length < 5 || w.includes("-")) return false;
  // near-identical spellings make the build hide the existing word (emblem / emblemë, klarinet / klarinetë)
  if ([w + "ë", w + "e", w + "i", w + "je", w.replace(/ë$/, ""), w.replace(/e$/, ""), w.replace(/e$/, "ë"), w.replace(/ë$/, "e"), w.replace(/ë$/, "i")].some((x) => x !== w && DICT.has(x))) return false;
  if (/\(female\)|woman|female|ordinal|hundred|thousand|native of|\bmoney\b|Instagram/i.test(en)) return false;
  if (p === "A" && /(uar|ur|rë|ar|yer|tur)$/.test(w) && /ed\b|en\b/.test(en.split(/[;,]/)[0])) return false; // participles go to forma.txt
  if (p === "NOUN" && /(ane|ese|ase|ore|ëse)$/.test(w) && /\bof\b/.test(en)) return false;
  return true;
});
const out = [];
for (let i = 0; i < rows.length && out.length < +count; i += +step) out.push(rows[i]);
console.log("left", rows.length);
fs.appendFileSync(seenFile, out.map((r) => r[0]).join("\n") + "\n");
for (const [w, p, g, en] of out) console.log([w, POS[p], /,m\b/.test(g) ? "m" : /,f\b/.test(g) ? "f" : "", en.slice(0, 40)].join("|"));
