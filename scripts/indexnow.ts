/**
 * Tells search engines which pages changed, through IndexNow (https://www.indexnow.org):
 * Bing (which ChatGPT and Copilot search through), Yandex, Seznam, Naver and others share the notifications.
 *
 *   npx tsx scripts/indexnow.ts rclone.log   pages uploaded in this deploy (from rclone's log)
 *   npx tsx scripts/indexnow.ts --all        every page in the sitemaps (first submission)
 *
 * The key is public by design: search engines check it at https://<site>/<key>.txt (public/<key>.txt).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const KEY = "07261aa3ce0f121f070e6e45e3ec70cc";
const SITE = process.env.SITE_URL || "https://fjalorishqip.org";
const BATCH = 10_000; // IndexNow accepts up to 10,000 URLs per request

/** Pages (not assets or API files) uploaded by rclone, as site URLs. */
export function changedPages(rcloneLog: string, site = SITE): string[] {
  const urls = new Set<string>();
  for (const m of rcloneLog.matchAll(/INFO\s+:\s+(.+?\.html): Copied \((?:new|replaced existing)\)/g)) {
    const file = m[1].trim();
    if (file === "404.html" || file.startsWith("kerko/")) continue; // not meant for search results
    const dir = file === "index.html" ? "" : file.replace(/index\.html$/, "");
    if (dir === file) continue; // other .html files: none are pages
    urls.add(`${site}/${dir.split("/").map(encodeURIComponent).join("/")}`);
  }
  return [...urls];
}

function sitemapPages(dist: string): string[] {
  const urls: string[] = [];
  for (const f of fs.readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f))) {
    for (const m of fs.readFileSync(path.join(dist, f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1].replace(/&amp;/g, "&"));
  }
  return urls;
}

async function submit(urls: string[]): Promise<void> {
  const host = new URL(SITE).host;
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
    });
    // 200 = received, 202 = received (key check pending); anything else is reported but does not fail the deploy
    console.log(`IndexNow: ${urlList.length} URLs → ${res.status} ${res.statusText}`);
    if (res.status !== 200 && res.status !== 202) console.log(await res.text());
  }
}

async function main() {
  const arg = process.argv[2];
  const urls = arg === "--all" ? sitemapPages(path.join(process.cwd(), "dist")) : arg ? changedPages(fs.readFileSync(arg, "utf8")) : [];
  if (!urls.length) return console.log("IndexNow: no changed pages to submit");
  await submit(urls);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => console.log(`IndexNow skipped: ${e instanceof Error ? e.message : e}`));
}
