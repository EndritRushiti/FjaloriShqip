import type { Entry, Form } from "../data/model.js";
import { bi, escapeHtml } from "./i18n.js";

/** Conjugation and declension tables built from Wiktionary's form tags. */

const PERSONS: [string, string, string, string][] = [
  ["first-person", "singular", "unë", "I"],
  ["second-person", "singular", "ti", "you"],
  ["third-person", "singular", "ai/ajo", "he/she"],
  ["first-person", "plural", "ne", "we"],
  ["second-person", "plural", "ju", "you (pl.)"],
  ["third-person", "plural", "ata/ato", "they"],
];

interface Row { sq: string; en: string; need: string[]; forbid: string[]; main?: boolean }

const VERB_ROWS: Row[] = [
  { sq: "Dëftore — e tashme", en: "Indicative present", need: ["indicative", "present"], forbid: ["perfect", "past", "future"], main: true },
  { sq: "Dëftore — e pakryer", en: "Indicative imperfect", need: ["indicative", "imperfect"], forbid: ["perfect", "past"], main: true },
  { sq: "Dëftore — e kryer e thjeshtë", en: "Indicative aorist (simple past)", need: ["indicative", "aorist"], forbid: ["perfect"], main: true },
  { sq: "Dëftore — e kryer", en: "Indicative perfect", need: ["indicative", "perfect"], forbid: ["past", "future"], main: true },
  { sq: "Dëftore — e ardhme", en: "Indicative future", need: ["indicative", "future"], forbid: ["perfect"], main: true },
  { sq: "Lidhore — e tashme", en: "Subjunctive present", need: ["subjunctive", "present"], forbid: ["perfect", "past"] },
  { sq: "Kushtore", en: "Conditional", need: ["conditional", "imperfect"], forbid: ["perfect", "past"] },
  { sq: "Habitore — e tashme", en: "Admirative present", need: ["admirative", "present"], forbid: ["perfect", "past"] },
  { sq: "Dëshirore", en: "Optative", need: ["optative", "present"], forbid: ["perfect", "past"] },
];

function pick(forms: Form[], need: string[], forbid: string[]): Form[] {
  return forms.filter((f) => need.every((n) => f.tags.includes(n)) && !forbid.some((x) => f.tags.includes(x)));
}

function verbTable(forms: Form[]): string {
  const rows = VERB_ROWS.map((r) => {
    const cand = pick(forms, r.need, r.forbid);
    const cells = PERSONS.map(([p, n]) => cand.filter((f) => f.tags.includes(p) && f.tags.includes(n)).map((f) => f.form));
    return { r, cells };
  }).filter((x) => x.cells.some((c) => c.length));
  if (!rows.length) return "";
  const head = `<thead><tr><th></th>${PERSONS.map(([, , sq, en]) => `<th>${bi(sq, en)}</th>`).join("")}</tr></thead>`;
  const tr = ({ r, cells }: (typeof rows)[number]) =>
    `<tr><th scope="row">${bi(r.sq, r.en)}</th>${cells.map((c) => `<td>${c.map(escapeHtml).join(", ") || "—"}</td>`).join("")}</tr>`;
  // the everyday tenses first; the other moods are one click away
  const main = rows.filter((x) => x.r.main);
  const rest = rows.filter((x) => !x.r.main);
  const table = (list: typeof rows) => `<div class="table-wrap"><table class="forms">${head}<tbody>${list.map(tr).join("")}</tbody></table></div>`;
  const imperative = pick(forms, ["imperative"], []).filter((f) => f.tags.includes("second-person"));
  const nonFinite: [string, string, string[]][] = [
    ["Pjesorja", "Participle", ["participle"]],
    ["Paskajorja", "Infinitive", ["infinitive"]],
    ["Përcjellorja", "Gerund", ["gerund"]],
  ];
  const extras = [
    ...nonFinite.map(([sq, en, need]) => [sq, en, pick(forms, need, []).map((f) => f.form)] as const),
    ["Urdhërorja", "Imperative", imperative.map((f) => f.form)] as const,
  ].filter(([, , list]) => list.length);
  const extraHtml = extras.length
    ? `<dl class="nonfinite">${extras.map(([sq, en, list]) => `<div><dt>${bi(sq, en)}</dt><dd>${[...new Set(list)].map(escapeHtml).join(", ")}</dd></div>`).join("")}</dl>`
    : "";
  const shown = main.length ? main : rows;
  const hidden = main.length ? rest : [];
  return `${extraHtml}${table(shown)}${hidden.length ? `<details class="more-tenses"><summary>${bi("Kohë dhe mënyra të tjera", "More tenses and moods")} (${hidden.length})</summary>${table(hidden)}</details>` : ""}`;
}

const CASES: [string, string, string][] = [
  ["nominative", "emërore", "nominative"],
  ["accusative", "kallëzore", "accusative"],
  ["dative", "dhanore", "dative"],
  ["ablative", "rrjedhore", "ablative"],
];
const COLS: [string, string, string, string][] = [
  ["indefinite", "singular", "e pashquar njëjës", "indefinite singular"],
  ["definite", "singular", "e shquar njëjës", "definite singular"],
  ["indefinite", "plural", "e pashquar shumës", "indefinite plural"],
  ["definite", "plural", "e shquar shumës", "definite plural"],
];

function nounTable(forms: Form[]): string {
  const rows = CASES.map(([c, sq, en]) => {
    const cells = COLS.map(([d, n]) => forms.filter((f) => f.tags.includes(c) && f.tags.includes(d) && f.tags.includes(n)).map((f) => f.form));
    return { sq, en, cells };
  }).filter((x) => x.cells.some((c) => c.length));
  if (!rows.length) return "";
  return `<div class="table-wrap"><table class="forms"><thead><tr><th></th>${COLS.map(([, , sq, en]) => `<th>${bi(sq, en)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr><th scope="row">${bi(r.sq, r.en)}</th>${r.cells.map((c) => `<td>${[...new Set(c)].map(escapeHtml).join(", ") || "—"}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

/** Albanian names of the grammatical tags on forms; tags not listed here are not shown. */
const FORM_TAG_SQ: Record<string, string> = {
  singular: "njëjës", plural: "shumës", definite: "e shquar", indefinite: "e pashquar",
  nominative: "emërore", accusative: "kallëzore", dative: "dhanore", ablative: "rrjedhore", genitive: "gjinore", vocative: "thirrore",
  masculine: "mashkullore", feminine: "femërore", neuter: "asnjanëse",
  "first-person": "veta I", "second-person": "veta II", "third-person": "veta III",
  present: "e tashme", imperfect: "e pakryer", aorist: "e kryer e thjeshtë", perfect: "e kryer", pluperfect: "më se e kryer",
  past: "e shkuar", future: "e ardhme", indicative: "dëftore", subjunctive: "lidhore", conditional: "kushtore",
  admirative: "habitore", optative: "dëshirore", imperative: "urdhërore", participle: "pjesore", infinitive: "paskajore",
  gerund: "përcjellore", progressive: "vazhdore", negative: "mohore",
  alternative: "trajtë tjetër", dialectal: "dialektore", colloquial: "bisedore", informal: "jozyrtare", archaic: "arkaike",
  obsolete: "e vjetëruar", regional: "krahinore", nonstandard: "jo standarde", Gheg: "gegërisht", Tosk: "toskërisht",
  Northern: "veriore", Southern: "jugore", Kosovo: "Kosovë", abbreviation: "shkurtim",
};

function simpleList(forms: Form[]): string {
  const uniq = new Map<string, string[]>();
  for (const f of forms) uniq.set(f.form, [...(uniq.get(f.form) ?? []), ...f.tags]);
  return `<ul class="formlist">${[...uniq.entries()]
    .slice(0, 40)
    .map(([f, tags]) => {
      const shown = [...new Set(tags)].filter((x) => FORM_TAG_SQ[x]);
      return `<li><b>${escapeHtml(f)}</b>${shown.length ? ` <small>${bi(shown.map((x) => FORM_TAG_SQ[x]).join(", "), shown.join(", "))}</small>` : ""}</li>`;
    })
    .join("")}</ul>`;
}

/** The main table plus a collapsible list of every form. */
export function formsHtml(e: Entry): string {
  const forms = e.forms ?? [];
  if (!forms.length) return "";
  const main = e.pos === "verb" ? verbTable(forms) : e.pos === "noun" ? nounTable(forms) : "";
  const all = `<details class="allforms"><summary>${bi("Të gjitha format", "All forms")} (${forms.length})</summary>${simpleList(forms)}</details>`;
  return (main || simpleList(forms.slice(0, 12))) + (forms.length > 6 ? all : "");
}
