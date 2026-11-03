// Albanian Wiktionary words the dictionary lacks, with word class and a short hint (only to understand the word).
// node tools/shtesa/sqw-list.cjs <count>: the words are never copied with their definitions, descriptions are our own.
const fs = require("fs");
const D = require(process.cwd() + "/data/fjalori.json");
const k = new Set(D.map((e) => e.word));
for (const e of D) {
  for (const d of e.dialects || []) k.add(d.form);
  for (const n of e.entries || []) for (const f of n.forms || []) k.add(f.form);
}
for (const f of ["forma", "hiq", "fyese"])
  for (const l of fs.readFileSync(`korrigjime/${f}.txt`, "utf8").split(/\r?\n/)) k.add(l.split("|")[0].replace(/#.*/, "").trim());
for (const l of fs.readFileSync("huazime/meyer-1891.tsv", "utf8").split(/\r?\n/)) k.add(l.split("\t")[0]);
const fold = (s) => s.replace(/ë/g, "e").replace(/ç/g, "c").replace(/e$/, "");
const F = new Set([...k].filter(Boolean).map(fold));
const near = (w) => [w + "ë", w + "e", w + "i", w + "je", w.replace(/ë$/, ""), w.replace(/e$/, ""), w.replace(/ë$/, "i")].some((x) => x !== w && k.has(x));
const shownFile = __dirname + "/sqw-shown.txt";
const shown = new Set(fs.existsSync(shownFile) ? fs.readFileSync(shownFile, "utf8").split(/\r?\n/) : []);
const rows = [];
for (const l of fs.readFileSync("sources/sq-wiktionary.jsonl", "utf8").split(/\r?\n/)) {
  if (!l) continue;
  let e;
  try { e = JSON.parse(l); } catch { continue; }
  const t = e.title || "";
  if (!/^[a-zçë]{4,}$/.test(t) || shown.has(t) || k.has(t) || F.has(fold(t)) || near(t)) continue;
  const x = (e.text || "").replace(/^==[^=\n]*==\s*/, "").replace(/\{\{[^}]*\}\}|'''|''|\[\[|\]\]|Kategoria:\S+/g, "").replace(/\s+/g, " ").trim();
  const h = x.slice(t.length, t.length + 30);
  const pos = /\bmb\./.test(h) ? "adj" : /ndajf\./.test(h) ? "adv" : /\b(kal|jokal)\./.test(h) ? "verb" : /\b(pës|vetv)\./.test(h) ? "refl" : /\b(m|f|as)\./.test(h) ? "noun" : "?";
  if (pos === "refl" || /(hem|ohet|ohen|het)$/.test(t) || (pos === "adj" && /(uar|ur|rë|yer|tur)$/.test(t))) continue;
  rows.push([t, pos, x.slice(t.length).replace(/^[\s\-–]*/, "").slice(0, 46)]);
}
rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
const n = +process.argv[2] || 300;
console.log("left", rows.length);
fs.appendFileSync(shownFile, rows.slice(0, n).map((r) => r[0]).join("\n") + "\n");
console.log(rows.slice(0, n).map((r) => r.join("|")).join("\n"));
