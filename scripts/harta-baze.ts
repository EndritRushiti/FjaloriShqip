/**
 * Makes public/harta.svg, the land under the word maps, from Natural Earth's countries (public domain):
 *   npx tsx scripts/harta-baze.ts path/to/ne_50m_admin_0_countries.geojson
 * The file has two shapes: "toka" (all countries in view) and "shqip" (Albania and Kosovo).
 * Paths have no colour of their own, so the page's light or dark theme colours them.
 */
import fs from "node:fs";
import path from "node:path";
import { MAP, MAP_H, MAP_W, project } from "../src/site/harta.js";

const file = process.argv[2];
if (!file) throw new Error("give the Natural Earth countries GeoJSON");
const geo = JSON.parse(fs.readFileSync(file, "utf8"));
type Ring = [number, number][];
/** Douglas–Peucker: drop points closer than `tol` pixels to the line. */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let far = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > far) { far = d; idx = i; }
    }
    if (far > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const inView = (r: Ring) => r.some(([lo, la]) => lo > MAP.lon0 - 2 && lo < MAP.lon1 + 2 && la < MAP.lat0 + 2 && la > MAP.lat1 - 2);
function pathFor(rings: Ring[]): string {
  let d = "";
  for (const r of rings) {
    if (!inView(r)) continue;
    // a closed ring starts and ends on the same point: simplify it as two halves split at its farthest point
    const all0 = r.map(([lo, la]) => project(la, lo));
    let far = 0;
    for (let i = 1; i < all0.length; i++) if (Math.hypot(all0[i][0] - all0[0][0], all0[i][1] - all0[0][1]) > Math.hypot(all0[far][0] - all0[0][0], all0[far][1] - all0[0][1])) far = i;
    const pts = far ? [...simplify(all0.slice(0, far + 1), 0.7), ...simplify(all0.slice(far), 0.7).slice(1)] : all0;
    if (pts.length < 3) continue;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2) continue; // specks
    d += "M" + pts.map((p) => p.join(",")).join("L") + "Z";
  }
  return d;
}
const all: string[] = [];
const sq: string[] = [];
for (const f of geo.features) {
  const g = f.geometry;
  const polys: Ring[][] = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const d = pathFor(polys.map((p) => p[0]));
  if (!d) continue;
  all.push(`<path d="${d}"/>`);
  if (["ALB", "KOS"].includes(f.properties.ADM0_A3)) sq.push(`<path d="${d}"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H}">
<!-- Land from Natural Earth (public domain), simplified for FjaloriShqip by scripts/harta-baze.ts -->
<symbol id="toka" viewBox="0 0 ${MAP_W} ${MAP_H}">${all.join("")}</symbol>
<symbol id="shqip" viewBox="0 0 ${MAP_W} ${MAP_H}">${sq.join("")}</symbol>
</svg>
`;
const out = path.join(process.cwd(), "public", "harta.svg");
fs.writeFileSync(out, svg);
console.log(`public/harta.svg: ${all.length} countries, ${(svg.length / 1024).toFixed(1)} KB`);
