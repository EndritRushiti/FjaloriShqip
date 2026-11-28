/**
 * The Sunday job (.github/workflows/permendje.yml): looks for the places that mention or use FjaloriShqip and
 * keeps them in permendje/permendje.json, with permendje/README.md as the list to read. The week's new places are
 * written to permendje/java.txt, which the Monday email puts on top (src/worker/report.ts reads it from R2).
 *
 * Only sources that allow automated access, each asked once a week with the client name below:
 *   Wikipedia (several languages)   pages that link to fjalorishqip.org            (MediaWiki API)
 *   GitHub                          code, projects and issues that name the site    (search API, GITHUB_TOKEN)
 *   Hacker News                     stories and comments                            (Algolia API)
 *   Bluesky, Lemmy                  public posts that name the site                 (their open search APIs)
 *   Cloudflare Web Analytics        sites that sent real visitors this week         (CLOUDFLARE_* secrets)
 *   Cloudflare zone analytics       who called the API (/api/) and from where       (CLOUDFLARE_* secrets)
 * X, Facebook, Instagram, TikTok and Reddit sell or bar automated search, and Mastodon searches posts only for
 * signed-in users, so they are not asked. No search engine covers the whole web for free; Search Console's "Links" report shows the rest by hand.
 * A source that fails is named in the report and skipped; the others still count.
 *
 *   npx tsx scripts/permendje.ts
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const HOST = "fjalorishqip.org";
const UA = "FjaloriShqipResearch/1.0 (https://fjalorishqip.org)";
const DIR = "permendje";
const DATA = `${DIR}/permendje.json`;
const WIKIS = ["sq", "en", "it", "el", "de", "fr", "mk", "sr", "tr", "simple"];

export type Kind = "wikipedia" | "github" | "social" | "hackernews" | "vizita" | "api";
export interface Mention {
  url: string;
  title: string;
  kind: Kind;
  /** where it was found: "sq.wikipedia.org", "github: code", a referring site's name */
  where: string;
  firstSeen: string;
  lastSeen: string;
  /** visits or API calls in the last week it was seen (visits and API only) */
  count?: number;
}
export const KIND_SQ: Record<Kind, string> = {
  wikipedia: "Wikipedia",
  github: "GitHub",
  social: "Rrjete sociale",
  hackernews: "Hacker News",
  vizita: "Faqe që na sjellin vizitorë",
  api: "Përdorues të API-së",
};

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}`);
  return r.json();
}

async function wikipedia(): Promise<Omit<Mention, "firstSeen" | "lastSeen">[]> {
  const out: Omit<Mention, "firstSeen" | "lastSeen">[] = [];
  for (const lang of WIKIS) {
    const site = `${lang}.wikipedia.org`;
    for (const protocol of ["https", "http"]) {
      const j = (await getJson(`https://${site}/w/api.php?action=query&format=json&list=exturlusage&euprotocol=${protocol}&euquery=${HOST}&eulimit=500`)) as {
        query?: { exturlusage?: { title: string; url: string }[] };
      };
      for (const p of j.query?.exturlusage ?? [])
        out.push({ url: `https://${site}/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`, title: p.title, kind: "wikipedia", where: site });
    }
  }
  return out;
}

async function github(): Promise<Omit<Mention, "firstSeen" | "lastSeen">[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("no GITHUB_TOKEN");
  const h = { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" };
  const own = (process.env.GITHUB_REPOSITORY ?? "EndritRushiti/FjaloriShqip").toLowerCase();
  const out: Omit<Mention, "firstSeen" | "lastSeen">[] = [];
  const code = (await getJson(`https://api.github.com/search/code?q=${encodeURIComponent(`"${HOST}"`)}&per_page=100`, h)) as {
    items?: { html_url: string; path: string; repository: { full_name: string } }[];
  };
  for (const i of code.items ?? []) {
    if (i.repository.full_name.toLowerCase() === own) continue;
    out.push({ url: i.html_url, title: `${i.repository.full_name}: ${i.path}`, kind: "github", where: "github: kod" });
  }
  const repos = (await getJson(`https://api.github.com/search/repositories?q=${encodeURIComponent("fjalorishqip")}&per_page=100`, h)) as {
    items?: { html_url: string; full_name: string; description: string | null }[];
  };
  for (const i of repos.items ?? []) {
    if (i.full_name.toLowerCase() === own) continue;
    out.push({ url: i.html_url, title: `${i.full_name}${i.description ? `: ${i.description}` : ""}`, kind: "github", where: "github: projekt" });
  }
  const issues = (await getJson(`https://api.github.com/search/issues?q=${encodeURIComponent(`"${HOST}"`)}&per_page=100`, h)) as {
    items?: { html_url: string; title: string; repository_url: string }[];
  };
  for (const i of issues.items ?? []) {
    if (i.repository_url.toLowerCase().endsWith(`/repos/${own}`)) continue;
    out.push({ url: i.html_url, title: i.title, kind: "github", where: "github: diskutim" });
  }
  return out;
}

async function hackernews(): Promise<Omit<Mention, "firstSeen" | "lastSeen">[]> {
  const j = (await getJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(HOST)}&hitsPerPage=100`)) as {
    hits?: { objectID: string; title?: string | null; story_title?: string | null }[];
  };
  return (j.hits ?? []).map((h) => ({ url: `https://news.ycombinator.com/item?id=${h.objectID}`, title: h.title ?? h.story_title ?? "Hacker News", kind: "hackernews" as const, where: "news.ycombinator.com" }));
}

async function social(): Promise<Omit<Mention, "firstSeen" | "lastSeen">[]> {
  const out: Omit<Mention, "firstSeen" | "lastSeen">[] = [];
  const bsky = (await getJson(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(HOST)}&limit=100`)) as {
    posts?: { uri: string; author: { handle: string }; record?: { text?: string } }[];
  };
  for (const p of bsky.posts ?? []) {
    const id = p.uri.split("/").pop();
    out.push({ url: `https://bsky.app/profile/${p.author.handle}/post/${id}`, title: `@${p.author.handle}: ${(p.record?.text ?? "").replace(/\s+/g, " ").slice(0, 100)}`, kind: "social", where: "Bluesky" });
  }
  const lemmy = (await getJson(`https://lemmy.world/api/v3/search?q=${encodeURIComponent(HOST)}&type_=All&limit=50`)) as {
    posts?: { post: { ap_id: string; name: string } }[];
    comments?: { comment: { ap_id: string; content: string } }[];
  };
  for (const p of lemmy.posts ?? []) out.push({ url: p.post.ap_id, title: p.post.name, kind: "social", where: "Lemmy" });
  for (const c of lemmy.comments ?? []) if (c.comment.content.includes(HOST)) out.push({ url: c.comment.ap_id, title: c.comment.content.replace(/\s+/g, " ").slice(0, 100), kind: "social", where: "Lemmy" });
  return out;
}

async function cloudflare(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token || !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error("no Cloudflare secrets");
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = (await r.json()) as { data?: unknown; errors?: { message: string }[] | null };
  if (!r.ok || j.errors?.length || !j.data) throw new Error(`Cloudflare: ${j.errors?.map((e) => e.message).join("; ") ?? r.status}`);
  return j.data;
}
const day = (d: Date) => d.toISOString().slice(0, 10);
/** Search engines bring visitors but are not a place that mentions us. */
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|qwant|brave|startpage)\./;

async function visitors(now: Date): Promise<Omit<Mention, "firstSeen" | "lastSeen">[]> {
  const data = (await cloudflare(
    `query ($account: String!, $start: Date!, $end: Date!) { viewer { accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 200, filter: { date_geq: $start, date_leq: $end }, orderBy: [count_DESC]) { count dimensions { refererHost } }
    } } }`,
    { account: process.env.CLOUDFLARE_ACCOUNT_ID, start: day(new Date(now.getTime() - 7 * 86400000)), end: day(now) },
  )) as { viewer: { accounts: { rumPageloadEventsAdaptiveGroups: { count: number; dimensions: { refererHost: string } }[] }[] } };
  const rows = data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  return rows
    .filter((r) => r.dimensions.refererHost && !r.dimensions.refererHost.endsWith(HOST) && !SEARCH.test(r.dimensions.refererHost))
    .map((r) => ({ url: `https://${r.dimensions.refererHost}/`, title: r.dimensions.refererHost, kind: "vizita" as const, where: r.dimensions.refererHost, count: r.count }));
}

async function apiUsers(now: Date): Promise<Omit<Mention, "firstSeen" | "lastSeen">[]> {
  if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("no Cloudflare secrets");
  const z = (await getJson(`https://api.cloudflare.com/client/v4/zones?name=${HOST}`, { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` })) as { result?: { id: string }[] };
  const zone = z.result?.[0]?.id;
  if (!zone) throw new Error("zone not found");
  // the free plan keeps a short history of requests: ask for the last day, the longest it always has
  const data = (await cloudflare(
    `query ($zone: String!, $start: Time!, $end: Time!) { viewer { zones(filter: { zoneTag: $zone }) {
      httpRequestsAdaptiveGroups(limit: 100, filter: { datetime_geq: $start, datetime_leq: $end, clientRequestPath_like: "/api/%" }, orderBy: [count_DESC]) {
        count dimensions { clientRequestReferer userAgent }
      }
    } } }`,
    { zone, start: new Date(now.getTime() - 86400000).toISOString(), end: now.toISOString() },
  )) as { viewer: { zones: { httpRequestsAdaptiveGroups: { count: number; dimensions: { clientRequestReferer: string; userAgent: string } }[] }[] } };
  const by = new Map<string, number>();
  for (const r of data.viewer.zones[0]?.httpRequestsAdaptiveGroups ?? []) {
    const ref = r.dimensions.clientRequestReferer;
    let who = "";
    try { who = ref ? new URL(ref).host : ""; } catch { /* not a URL */ }
    if (who.endsWith(HOST)) continue; // our own pages use the API too
    // without a referring page, the program's own name (a script, an app) tells who calls it
    if (!who) who = (r.dimensions.userAgent || "pa emër").split(/[ /;(]/)[0].slice(0, 60);
    by.set(who, (by.get(who) ?? 0) + r.count);
  }
  return [...by].map(([who, count]) => ({ url: /\./.test(who) ? `https://${who}/` : `api:${who}`, title: who, kind: "api" as const, where: who, count }));
}

/** Merges this week's findings into what is kept: new places get today's date, known ones a new lastSeen. */
export function merge(old: Mention[], found: Omit<Mention, "firstSeen" | "lastSeen">[], today: string): { all: Mention[]; fresh: Mention[] } {
  const by = new Map(old.map((m) => [m.url, m]));
  const fresh: Mention[] = [];
  for (const f of found) {
    const m = by.get(f.url);
    if (m) {
      m.lastSeen = today;
      if (f.count !== undefined) m.count = f.count;
      continue;
    }
    const n: Mention = { ...f, firstSeen: today, lastSeen: today };
    by.set(f.url, n);
    fresh.push(n);
  }
  const all = [...by.values()].sort((a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  return { all, fresh };
}

const line = (m: Mention) => `- [${m.title.replace(/[[\]]/g, "")}](${m.url.startsWith("api:") ? "#" : m.url}) · ${m.where}${m.count !== undefined ? ` · ${m.count}` : ""} · ${m.firstSeen === m.lastSeen ? `parë më ${m.firstSeen}` : `${m.firstSeen} → ${m.lastSeen}`}`;

export function readme(all: Mention[], failed: string[], today: string): string {
  const parts = [
    "# Ku përmendet FjaloriShqip",
    "",
    `Përditësuar më ${today}, çdo të diel nga \`scripts/permendje.ts\`. ${all.length} vende gjithsej. Më të rejat sipër.`,
    "",
    "Burimet: Wikipedia, GitHub, Bluesky, Lemmy, Hacker News dhe Cloudflare (faqet që na sjellin vizitorë, kush thërret API-në). Për pjesën tjetër të internetit shihni raportin «Links» te Google Search Console.",
  ];
  if (failed.length) parts.push("", `Këtë javë nuk u arrit: ${failed.join(", ")}.`);
  for (const k of Object.keys(KIND_SQ) as Kind[]) {
    const list = all.filter((m) => m.kind === k);
    if (list.length) parts.push("", `## ${KIND_SQ[k]} (${list.length})`, "", ...list.map(line));
  }
  return parts.join("\n") + "\n";
}

/** The Monday email's part: only what is new this week, and the week's sources of visitors and API calls. */
export function weekText(fresh: Mention[], all: Mention[], failed: string[], today: string): string {
  const seenNow = all.filter((m) => m.lastSeen === today && (m.kind === "vizita" || m.kind === "api"));
  const lines = [`== Përmendjet e javës (${fresh.length} vende të reja) ==`, ""];
  if (fresh.length) lines.push(...fresh.map((m) => `• [${KIND_SQ[m.kind]}] ${m.title} — ${m.url.startsWith("api:") ? m.where : m.url}`));
  else lines.push("Asnjë vend i ri këtë javë.");
  if (seenNow.length) lines.push("", "Kush na solli vizitorë ose thirri API-në këtë javë:", ...seenNow.map((m) => `• ${m.title}: ${m.count ?? 0} (${KIND_SQ[m.kind]})`));
  if (failed.length) lines.push("", `Nuk u arrit: ${failed.join(", ")}.`);
  lines.push("", `Lista e plotë: https://github.com/EndritRushiti/FjaloriShqip/blob/main/${DIR}/README.md`);
  return lines.join("\n");
}

async function main() {
  const now = new Date();
  const today = day(now);
  const old = fs.existsSync(DATA) ? (JSON.parse(fs.readFileSync(DATA, "utf8")) as Mention[]) : [];
  const found: Omit<Mention, "firstSeen" | "lastSeen">[] = [];
  const failed: string[] = [];
  const sources: [string, () => Promise<Omit<Mention, "firstSeen" | "lastSeen">[]>][] = [
    ["Wikipedia", wikipedia],
    ["GitHub", github],
    ["Hacker News", hackernews],
    ["Bluesky dhe Lemmy", social],
    ["vizitat (Cloudflare)", () => visitors(now)],
    ["API (Cloudflare)", () => apiUsers(now)],
  ];
  for (const [name, run] of sources) {
    try {
      const got = await run();
      found.push(...got);
      console.log(`${name}: ${got.length}`);
    } catch (e) {
      failed.push(name);
      console.log(`${name}: could not read (${e instanceof Error ? e.message : e})`);
    }
  }
  const { all, fresh } = merge(old, found, today);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify(all, null, 1) + "\n");
  fs.writeFileSync(`${DIR}/README.md`, readme(all, failed, today));
  fs.writeFileSync(`${DIR}/java.txt`, weekText(fresh, all, failed, today) + "\n");
  console.log(`new this week: ${fresh.length}, all: ${all.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
