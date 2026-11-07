/**
 * The map on word pages ("Ku thuhet"): where the forms of a word are said.
 * The land comes from public/harta.svg (Natural Earth, public domain, made by scripts/harta-baze.ts);
 * each page draws on top of it the dialect areas of the word and the places its forms are recorded.
 * Everything is drawn on the site itself: no map service, nothing is loaded from elsewhere.
 */
import type { Dialect } from "../data/model.js";

/** The part of the world shown: from Sicily and Zadar to Andros. */
export const MAP = { lon0: 12.2, lon1: 25.4, lat0: 44.6, lat1: 35.7, k: 52 };
const COS = Math.cos((40.5 * Math.PI) / 180);
export const MAP_W = Math.round((MAP.lon1 - MAP.lon0) * COS * MAP.k);
export const MAP_H = Math.round((MAP.lat0 - MAP.lat1) * MAP.k);
/** Latitude and longitude to a point on the map. */
export function project(lat: number, lon: number): [number, number] {
  return [Math.round((lon - MAP.lon0) * COS * MAP.k * 10) / 10, Math.round((MAP.lat0 - lat) * MAP.k * 10) / 10];
}

/**
 * Places the dialect books and speakers name, with their position (the town, or the middle of the region).
 * Names as they are written in the dialect files; a place not in this list is not drawn.
 */
export const PLACES: Record<string, { lat: number; lon: number; name: string; dialect: Dialect }> = {
  "Kosovë": { lat: 42.6, lon: 20.95, name: "Kosovë", dialect: "gheg" },
  "Malësi e Madhe": { lat: 42.38, lon: 19.55, name: "Malësi e Madhe", dialect: "gheg" },
  "Malësi": { lat: 42.38, lon: 19.55, name: "Malësi e Madhe", dialect: "gheg" },
  "Shkodër": { lat: 42.07, lon: 19.51, name: "Shkodër", dialect: "gheg" },
  "Σ": { lat: 42.07, lon: 19.51, name: "Shkodër", dialect: "gheg" },
  "Pukë": { lat: 42.05, lon: 19.9, name: "Pukë", dialect: "gheg" },
  "Zadrimë": { lat: 41.92, lon: 19.62, name: "Zadrimë", dialect: "gheg" },
  "Mirditë": { lat: 41.78, lon: 19.95, name: "Mirditë", dialect: "gheg" },
  "Pult": { lat: 42.27, lon: 19.75, name: "Pult", dialect: "gheg" },
  "Kelmend": { lat: 42.52, lon: 19.62, name: "Kelmend", dialect: "gheg" },
  "Dukagjin": { lat: 42.2, lon: 19.98, name: "Dukagjin", dialect: "gheg" },
  "Dibër": { lat: 41.68, lon: 20.43, name: "Dibër", dialect: "gheg" },
  "Krujë": { lat: 41.51, lon: 19.79, name: "Krujë", dialect: "gheg" },
  "Tiranë": { lat: 41.33, lon: 19.82, name: "Tiranë", dialect: "gheg" },
  "Kavajë": { lat: 41.18, lon: 19.56, name: "Kavajë", dialect: "gheg" },
  "Elbasan": { lat: 41.11, lon: 20.08, name: "Elbasan", dialect: "gheg" },
  "Martanesh": { lat: 41.42, lon: 20.2, name: "Martanesh", dialect: "gheg" },
  "Shpat": { lat: 41.02, lon: 20.03, name: "Shpat", dialect: "gheg" },
  "Mat": { lat: 41.6, lon: 20.0, name: "Mat", dialect: "gheg" },
  "Lezhë": { lat: 41.78, lon: 19.64, name: "Lezhë", dialect: "gheg" },
  "Ulqin": { lat: 41.93, lon: 19.21, name: "Ulqin", dialect: "gheg" },
  "Gjakovë": { lat: 42.38, lon: 20.43, name: "Gjakovë", dialect: "gheg" },
  "Jakova": { lat: 42.38, lon: 20.43, name: "Gjakovë", dialect: "gheg" },
  "Maqedoni e Veriut": { lat: 41.95, lon: 20.97, name: "Maqedoni e Veriut", dialect: "gheg" },
  "Tetovë, Gostivar, Kërçovë": { lat: 41.8, lon: 20.9, name: "Tetovë, Gostivar, Kërçovë", dialect: "gheg" },
  "Tetovë": { lat: 42.01, lon: 20.97, name: "Tetovë", dialect: "gheg" },
  "Gostivar": { lat: 41.8, lon: 20.91, name: "Gostivar", dialect: "gheg" },
  "Kërçovë": { lat: 41.51, lon: 20.96, name: "Kërçovë", dialect: "gheg" },
  "Karadak i Shkupit": { lat: 42.12, lon: 21.38, name: "Karadak i Shkupit", dialect: "gheg" },
  "Arbanasi, Zarë": { lat: 44.12, lon: 15.23, name: "Arbanasi (Zarë)", dialect: "gheg" },
  "Berat": { lat: 40.7, lon: 19.95, name: "Berat", dialect: "tosk" },
  "Përmet": { lat: 40.23, lon: 20.35, name: "Përmet", dialect: "tosk" },
  "Gjirokastër": { lat: 40.08, lon: 20.14, name: "Gjirokastër", dialect: "tosk" },
  "Korçë": { lat: 40.62, lon: 20.78, name: "Korçë", dialect: "tosk" },
  "Myzeqe": { lat: 40.8, lon: 19.6, name: "Myzeqe", dialect: "tosk" },
  "Zagori": { lat: 40.1, lon: 20.3, name: "Zagori", dialect: "tosk" },
  "Konispol": { lat: 39.66, lon: 20.18, name: "Konispol", dialect: "tosk" },
  "Çamëri": { lat: 39.45, lon: 20.4, name: "Çamëri", dialect: "tosk" },
  "Çam": { lat: 39.45, lon: 20.4, name: "Çamëri", dialect: "tosk" },
  "Piana degli Albanesi": { lat: 37.99, lon: 13.28, name: "Hora e Arbëreshëvet", dialect: "arberesh" },
  "San Marzano": { lat: 40.45, lon: 17.5, name: "San Marzano", dialect: "arberesh" },
  "Ururi": { lat: 41.82, lon: 15.01, name: "Ururi", dialect: "arberesh" },
  "Molise": { lat: 41.75, lon: 14.92, name: "Molize", dialect: "arberesh" },
  "Caraffa di Catanzaro": { lat: 38.88, lon: 16.49, name: "Caraffa di Catanzaro", dialect: "arberesh" },
  "San Nicola dell'Alto": { lat: 39.29, lon: 16.97, name: "San Nicola dell'Alto", dialect: "arberesh" },
  "Villa Badessa": { lat: 42.43, lon: 14.0, name: "Villa Badessa", dialect: "arberesh" },
  "San Costantino Albanese": { lat: 40.04, lon: 16.31, name: "San Costantino Albanese", dialect: "arberesh" },
  "Greci": { lat: 41.25, lon: 15.17, name: "Greci", dialect: "arberesh" },
  "Andros": { lat: 37.85, lon: 24.85, name: "Andros", dialect: "arvanitika" },
};

/** Where each dialect is spoken, drawn roughly (the borders between dialects are not lines). */
const AREAS: Record<Dialect, [number, number][][]> = {
  gheg: [[
    [42.42, 19.08], [42.62, 19.6], [42.68, 19.95], [42.95, 20.3], [43.27, 20.8], [42.85, 21.75], [42.3, 21.75], [42.1, 21.45],
    [41.75, 20.98], [41.2, 20.72], [41.05, 20.58], [41.08, 20.1], [41.06, 19.45], [41.4, 19.42], [41.8, 19.55], [41.88, 19.2],
  ]],
  tosk: [[
    [41.06, 19.45], [41.08, 20.1], [41.05, 20.58], [40.88, 20.75], [40.6, 21.05], [40.35, 20.95], [39.9, 20.45], [39.45, 20.75],
    [39.15, 20.65], [39.25, 20.3], [39.75, 20.0], [40.1, 19.75], [40.45, 19.42], [40.75, 19.35],
  ]],
  // Attica, Boeotia, southern Euboea, Corinthia, the Argolid and the Saronic islands; Andros is drawn apart
  arvanitika: [[
    [38.5, 22.7], [38.58, 23.4], [38.42, 23.8], [38.38, 24.28], [38.08, 24.62], [37.92, 24.35], [37.68, 24.08], [37.2, 23.55],
    [37.15, 23.0], [37.45, 22.55], [37.92, 22.38], [38.25, 22.5],
  ]],
  // the Arbëresh live in villages spread over southern Italy: drawn as their main groups
  arberesh: [],
};
/** Where a dialect's forms are written when the books give no place for them. */
const AREA_LABEL: Record<Dialect, [number, number]> = { gheg: [42.15, 20.35], tosk: [40.35, 20.15], arberesh: [39.6, 16.0], arvanitika: [37.85, 23.35] };
const ARBERESH_GROUPS: [number, number][] = [[37.99, 13.28], [39.55, 16.25], [38.88, 16.49], [39.3, 16.95], [40.05, 16.31], [40.45, 17.5], [41.25, 15.17], [41.8, 14.98], [42.43, 14.0]];

export type MapForm = { form: string; dialect: Dialect; places: string[] };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pathOf = (ring: [number, number][]) => "M" + ring.map(([la, lo]) => project(la, lo).join(",")).join("L") + "Z";

/**
 * The map for one word: the areas of the dialects it has forms in, and a pin for every known place,
 * with the forms said there. `land` is the address of public/harta.svg.
 */
export function wordMapSvg(forms: MapForm[], land: string, label: string, same?: { dialects: Dialect[]; word: string }): string {
  const dialects = new Set(forms.map((f) => f.dialect));
  const sameAs = new Set(same?.dialects ?? []);
  const areas: string[] = [];
  const area = (d: Dialect, cls: string) => {
    if (d === "arberesh") for (const [la, lo] of ARBERESH_GROUPS) { const [x, y] = project(la, lo); areas.push(`<circle class="${cls}" cx="${x}" cy="${y}" r="13"/>`); }
    else areas.push(...AREAS[d].map((r) => `<path class="${cls}" d="${pathOf(r)}"/>`));
    if (d === "arvanitika") { const [x, y] = project(37.85, 24.85); areas.push(`<circle class="${cls}" cx="${x}" cy="${y}" r="9"/>`); }
  };
  for (const d of ["gheg", "tosk", "arberesh", "arvanitika"] as Dialect[]) {
    if (dialects.has(d)) area(d, `area ${d}`);
    else if (sameAs.has(d)) area(d, `area ${d} same`);
  }
  // one pin per place, holding all the forms said there
  const at = new Map<string, { x: number; y: number; name: string; dialect: Dialect; forms: string[] }>();
  for (const f of forms)
    for (const p of f.places) {
      const pl = PLACES[p];
      if (!pl) continue;
      const key = pl.name;
      const [x, y] = project(pl.lat, pl.lon);
      const e = at.get(key) ?? at.set(key, { x, y, name: pl.name, dialect: f.dialect, forms: [] }).get(key)!;
      if (!e.forms.includes(f.form)) e.forms.push(f.form);
    }
  const pins = [...at.values()];
  // a dialect with forms but no known place: write its forms inside its area, so no area is left empty
  const unplaced: string[] = [];
  for (const d of ["gheg", "tosk", "arberesh", "arvanitika"] as Dialect[]) {
    if (!dialects.has(d) || pins.some((p) => p.dialect === d)) continue;
    const list = [...new Set(forms.filter((f) => f.dialect === d).map((f) => f.form))].slice(0, 2);
    const [x, y] = project(...AREA_LABEL[d]);
    unplaced.push(`<text class="area-label ${d}" x="${x}" y="${y}" text-anchor="middle">${esc(list.join(", "))}</text>`);
  }
  // where the books give no other form, the word is said as in the standard: write it there, marked as such
  for (const d of sameAs) {
    if (dialects.has(d) || !same) continue;
    const [x, y] = project(...AREA_LABEL[d]);
    unplaced.push(`<text class="area-label ${d} same" x="${x}" y="${y}" text-anchor="middle">${esc(same.word)}</text>`);
  }
  // labels only where they do not run into another label: on the right of the pin, else on the left
  const boxes: [number, number, number, number][] = pins.map((p) => [p.x - 6, p.y - 6, p.x + 6, p.y + 6]);
  const hits = (b: [number, number, number, number]) => b[0] < 2 || b[2] > MAP_W - 2 || boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const labels: string[] = [];
  for (const p of [...pins].sort((a, b) => b.forms.length - a.forms.length)) {
    const text = p.forms.slice(0, 2).join(", ");
    const w = text.length * 6.6 + 4;
    const right: [number, number, number, number] = [p.x + 8, p.y - 8, p.x + 8 + w, p.y + 6];
    const left: [number, number, number, number] = [p.x - 8 - w, p.y - 8, p.x - 8, p.y + 6];
    const box = !hits(right) ? right : !hits(left) ? left : null;
    if (!box) continue;
    boxes.push(box);
    const onLeft = box === left;
    labels.push(`<text class="pin-label" x="${onLeft ? p.x - 9 : p.x + 9}" y="${p.y + 4}"${onLeft ? ' text-anchor="end"' : ""}>${esc(text)}</text>`);
  }
  const dots = pins.map((p) => `<g class="pin ${p.dialect}"><circle cx="${p.x}" cy="${p.y}" r="5.5"/><title>${esc(p.name)}: ${esc(p.forms.join(", "))}</title></g>`).join("");
  return `<svg class="harta-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="${esc(label)}">
<rect class="sea" width="${MAP_W}" height="${MAP_H}"/>
<use class="land" href="${land}#toka"/><use class="land-sq" href="${land}#shqip"/>
${areas.join("")}
${dots}${labels.join("")}${unplaced.join("")}
</svg>`;
}
/** The places of all forms, in map order (north to south), for the list under the map. */
export function placeList(forms: MapForm[]): { name: string; dialect: Dialect; forms: string[] }[] {
  const at = new Map<string, { name: string; dialect: Dialect; forms: string[]; lat: number }>();
  for (const f of forms)
    for (const p of f.places) {
      const pl = PLACES[p];
      if (!pl) continue;
      const e = at.get(pl.name) ?? at.set(pl.name, { name: pl.name, dialect: f.dialect, forms: [], lat: pl.lat }).get(pl.name)!;
      if (!e.forms.includes(f.form)) e.forms.push(f.form);
    }
  return [...at.values()].sort((a, b) => b.lat - a.lat);
}
