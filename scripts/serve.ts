/** Minimal static server for previewing ./dist locally:  npm run serve  → http://localhost:4321 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIST = path.join(process.cwd(), "dist");
const PORT = Number(process.env.PORT ?? 4321);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      res.end(fs.existsSync(path.join(DIST, "404.html")) ? fs.readFileSync(path.join(DIST, "404.html")) : "404");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`FjaloriShqip preview: http://localhost:${PORT}`));
