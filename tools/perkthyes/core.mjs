/**
 * The converter itself, with no file access, so the command line (perkthyes.mjs) and the test page run the same code.
 *   map:      surface form → { to, how }   (built by perkthyes.mjs from the dictionary)
 *   standard: Set of standard headwords    (used to recognise standard endings the dictionary does not list)
 */
export function makeConverter(map, standard) {
  /** Standard nouns and verbs with an ending the dictionary does not list (pulja, majmuni, digjet): keep as they are. */
  const ENDINGS = [
    ["ja", ["jë", "ë", "", "e"]], ["ën", ["ë"]], ["ës", ["ë"]], ["a", ["ë", ""]], ["i", [""]], ["u", [""]], ["in", [""]], ["it", [""]],
    ["në", ["", "ë"]], ["et", ["", "ë"]], ["ët", ["", "ë"]], ["at", ["ë", ""]], ["ve", ["", "ë"]],
    ["ra", [""]], ["t", [""]], ["n", [""]], ["en", ["", "ë"]], ["in", ["", "ë"]], ["ësh", ["ë"]],
    ["et", ["", "ë"]], ["en", [""]], ["emi", [""]], ["eni", [""]], ["ni", [""]], ["jnë", [""]], ["in", [""]], ["ohet", ["oj"]],
    ["on", ["oj"]], ["ojnë", ["oj"]], ["ova", ["oj"]], ["oi", ["oj"]], ["uar", ["oj"]], ["ur", [""]], ["ru", ["", "j"]], ["ju", ["j"]],
    ["uari", ["oj"]], ["uara", ["oj"]], ["uri", [""]], ["urit", [""]], ["urinë", [""]], ["urë", [""]], ["ura", [""]], ["ësh", ["ë"]],
    ["et", ["em", "es"]], ["en", ["em"]], ["hen", ["hem"]], ["het", ["hem"]], ["emi", ["em"]], // piqen, digjet → piqem, digjem
  ];
  function standardInflection(w) {
    for (const [end, bases] of ENDINGS) {
      if (!w.endsWith(end) || w.length - end.length < 2) continue;
      for (const b of bases) {
        const s = w.slice(0, -end.length) + b;
        if (standard.has(s)) return s;
      }
    }
    return null;
  }

  /** Regular rules, tried in order when a word is not found as it is. Each returns candidate spellings. */
  const RULES = [
    ["old -enë/-etë/-ënë", (w) => (/(en|et|ën|ur)ë$/.test(w) ? [w.slice(0, -1)] : [])],
    ["old -ë ending", (w) => (w.endsWith("ë") ? [w.slice(0, -1)] : [])],                 // lahenë → lahen, delenë → delen
    ["old -të ending", (w) => (w.endsWith("të") ? [w.slice(0, -2) + "t", w.slice(0, -2)] : [])], // mollëtë → mollët
    ["Gheg â/ê/î/ô/û", (w) => (/[âêîôû]/.test(w) ? [w.replace(/â/g, "ë").replace(/ê/g, "e").replace(/î/g, "i").replace(/ô/g, "o").replace(/û/g, "u"), w.replace(/â/g, "a").replace(/ê/g, "e")] : [])],
    ["Gheg -un participle", (w) => (/un$/.test(w) ? [w.replace(/un$/, "ur")] : [])],     // veshun → veshur
    ["Gheg -ue participle", (w) => (/ue$/.test(w) ? [w.replace(/ue$/, "uar")] : [])],   // punue → punuar
    ["Gheg -uem", (w) => (/uem$/.test(w) ? [w.replace(/uem$/, "uar")] : [])],
    ["Gheg ue → ua", (w) => (/ue/.test(w) ? [w.replace(/ue/, "ua")] : [])],             // grue → grua
    ["Hahn's spelling", (w) => [w.replace(/é/g, "e").replace(/([bcdfgkpstvz])\1/g, "$1").replace(/tsh/g, "ç")].filter((c) => c !== w)], // dhé, shigjetta, vitshi
    ["old -rë/-lë for -ër/-ël", (w) => (/[bcdfgkpstvz][rl]ë$/.test(w) ? [w.replace(/([rl])ë$/, "ë$1")] : [])],               // dhelprë → dhelpër
    ["old 1pl -ëmë", (w) => (/ëmë$/.test(w) ? [w.replace(/ëmë$/, "im")] : [])],                                        // shohëmë → shohim
    ["old subjunctive -një", (w) => (/një$/.test(w) && w.length > 5 ? [w.replace(/një$/, "ë")] : [])],                   // hipnjë → hipë
    ["old accusative -ënë", (w) => (/[^aeiouëy]ënë$/.test(w) ? [w.replace(/ënë$/, "in"), w.replace(/ënë$/, "un")] : [])], // shkopënë → shkopin
    ["Gheg -në infinitive/3pl", (w) => (/në$/.test(w) ? [w.replace(/në$/, "jnë"), w.replace(/në$/, "n")] : [])],
  ];

  const clean = (t) => t.toLowerCase().replace(/^[«"“(]+|[»"”).,;:!?]+$/g, "");

  /** Converts one word. Returns { from, to, how } (to = null when unknown). */
  function convertWord(raw, sentenceStart = false) {
    const w = clean(raw);
    if (!w || !/[a-zëçâêîôû]/.test(w)) return { from: raw, to: raw, how: "punctuation" };
    const tryOne = (x) => map.get(x);
    let hit = tryOne(w);
    // a regular standard form wins over a dialect reading of the same spelling (brekët, maji are standard)
    if (hit && !["standard", "standard form", "irregular"].includes(hit.how) && standardInflection(w)) return { from: raw, to: w, how: "standard form" };
    if (hit) return { from: raw, ...hit };
    // elided vowel: dit' → dita/ditë, mir' → mirë, t' → të
    if (w.endsWith("'")) {
      const base = w.slice(0, -1);
      if (base === "t") return { from: raw, to: "të", how: "elision" };
      if (base === "s") return { from: raw, to: "nuk", how: "elision" };
      if (base === "ç") return { from: raw, to: "çfarë", how: "elision" };
      for (const v of ["ë", "a", "e", "i"]) { hit = tryOne(base + v); if (hit) return { from: raw, ...hit, how: "elision" }; }
    }
    // an apostrophe after a whole word (derën', peshqirin')
    if (w.endsWith("'") && w.length > 3) {
      const r = convertWord(raw.replace(/'(?=[.,;:!?]*$)/, ""), sentenceStart);
      if (r.to !== null) return { ...r, from: raw };
    }
    if (w.includes("-")) {
      const parts = w.split("-").map((p) => convertWord(p));
      if (parts.every((p) => p.to !== null)) return { from: raw, to: parts.map((p) => p.to).join("-"), how: "compound" };
    }
    // old Tosk/Gheg -ënë, -etë, -ësë: ditënë → ditën, mbetetë → mbetet, natësë → natës
    if (/[eë][nts]ë$/.test(w)) {
      const c = w.slice(0, -1);
      hit = tryOne(c);
      if (hit) return { from: raw, to: hit.to, how: "old -ë ending" };
      if (standardInflection(c)) return { from: raw, to: c, how: "old -ë ending" };
    }
    if (standardInflection(w)) return { from: raw, to: w, how: "standard form", lemma: standardInflection(w) };
    // a dialect word with a case/person ending (shtrofaku, çumertit): give the standard word
    for (const [end, bases] of ENDINGS) {
      if (!w.endsWith(end) || w.length - end.length < 3) continue;
      for (const b of bases) {
        hit = tryOne(w.slice(0, -end.length) + b);
        if (hit && hit.how !== "standard" && hit.how !== "standard form") return { from: raw, to: hit.to, how: "dialect stem" };
      }
    }
    for (const [name, rule] of RULES) for (const c of rule(w)) {
      hit = tryOne(c);
      if (hit) return { from: raw, to: hit.to, how: name };
      if (standardInflection(c)) return { from: raw, to: c, how: name };
    }
    // a capitalised word the dictionary does not know, not at the start of a sentence, is a name (Vasilit)
    if (/^[A-ZÇË]/.test(raw) && !sentenceStart) return { from: raw, to: raw, how: "name" };
    return { from: raw, to: null, how: "unknown" };
  }

  /** Converts a text: keeps spaces and punctuation; unknown words have to = null. */
  function convert(text) {
    const parts = text.split(/(\s+|(?<=')(?=[a-zëçâêîôû]))/i).filter((p) => p !== undefined && p !== "");
    let start = true;
    return parts.map((p) => {
      if (/^\s+$/.test(p)) return { from: p, to: p, how: "space" };
      const r = convertWord(p, start);
      start = /[.!?]$/.test(p);
      return r;
    });
  }

  /** Joins the converted words back into text; an elided word (t', s') gets a space when it was written joined. */
  function renderWord(res, i, unknown = (w) => `[${w}?]`) {
    const r = res[i];
    if (r.how === "space") return r.from;
    const to = r.to && /^[A-ZÇËÂÊÎÔÛ]/.test(r.from) ? r.to.charAt(0).toUpperCase() + r.to.slice(1) : r.to; // keep a capital letter
    const word = r.to === null ? unknown(r.from) : r.how === "punctuation" ? r.from : to + (/[.,;:!?]$/.test(r.from) ? r.from.slice(-1) : "");
    const joined = /'$/.test(r.from) && res[i + 1] && res[i + 1].how !== "space" && r.to !== null && !/'$/.test(r.to);
    return joined ? word + " " : word;
  }
  const render = (res) => res.map((_, i) => renderWord(res, i)).join("");

  return { convert, convertWord, render, renderWord, clean, RULES };
}
