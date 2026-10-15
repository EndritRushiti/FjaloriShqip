/**
 * Cloudflare Worker that serves the built site (./dist) from an R2 bucket.
 * The bucket is filled by the deploy workflow (rclone sync dist → R2); this Worker only reads.
 *
 *   /fjala/nënë/        → fjala/nënë/index.html
 *   /fjala/nënë         → 301 to /fjala/nënë/ (when that page exists)
 *   /api/v1/...json     → the file, with CORS so any app can use the API
 *   anything missing    → 404.html with status 404
 */

import { contentSecurityPolicy, cspHash, HEAD_SCRIPT } from "../site/security.js";
import { type EmailSender, handleContact } from "./contact.js";
import { handleOpen, handleSubscribe, type PushBucket, sendBatch, weeklyStats } from "./push.js";
import { handleReport, type ReportBucket, sendWeekly } from "./report.js";

/** The parts of the Workers R2 API this Worker uses (kept local so the repo needs no Workers type package). */
export interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  size: number;
}
export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<unknown | null>;
}
export interface Env {
  SITE: R2Bucket;
  /** "1" while testing: tell search engines not to index the site. */
  NOINDEX?: string;
  /** "1" when the usage guard took the site offline to stay inside the free R2 allowance. */
  OFFLINE?: string;
  /** The site's main host, e.g. "fjalorishqip.org"; requests to www.<host> are redirected to it. */
  CANONICAL_HOST?: string;
  /** Contact form: the send_email binding and its destination (both added at deploy from a GitHub secret). */
  CONTACT?: EmailSender;
  CONTACT_TO?: string;
  /** Reports and suggestions from the word pages (a private bucket; src/worker/report.ts). */
  REPORTS?: ReportBucket & PushBucket;
}

/** The Monday email's cron (wrangler.toml); the other crons send the daily notifications. */
export const WEEKLY_CRON = "0 7 * * 1";

const OFFLINE_PAGE = `<!doctype html><html lang="sq"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FjaloriShqip</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.5">
<h1>FjaloriShqip</h1><p>Faqja është përkohësisht jashtë funksionit. Provoni përsëri më vonë.</p>
<p lang="en">The site is temporarily offline. Please try again later.</p></body></html>`;

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  ics: "text/calendar; charset=utf-8",
};

const extOf = (key: string) => key.slice(key.lastIndexOf("/") + 1).split(".").slice(1).pop()?.toLowerCase() ?? "";

/**
 * Browser cache time per kind of file: pages revalidate every time, the API and assets for an hour.
 * Assets linked with a content version (style.css?v=…) never change under that address, so they are kept a year.
 */
function cacheControl(key: string, versioned: boolean): string {
  if (key.startsWith("api/")) return "public, max-age=3600";
  if (/\.(css|js|svg|png|ico|webmanifest)$/.test(key)) {
    return versioned ? "public, max-age=31536000, immutable" : "public, max-age=3600";
  }
  return "public, max-age=0, must-revalidate";
}

let csp: Promise<string> | undefined;
/** The page CSP, with the hash of the one allowed inline script (computed once per Worker instance). */
const pageCsp = () => (csp ??= cspHash(HEAD_SCRIPT).then(contentSecurityPolicy));

/** Turns a request path into a bucket key, or null when the path tries to leave the site. */
export function keyFor(pathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (p.includes("\0") || p.split("/").some((s) => s === "..")) return null;
  if (p.endsWith("/")) p += "index.html";
  return p.replace(/^\/+/, "");
}

async function headers(key: string, env: Env, opts: { etag?: string; versioned?: boolean } = {}): Promise<Headers> {
  const type = extOf(key);
  const api = key.startsWith("api/");
  const h = new Headers({
    "Content-Type": TYPES[type] ?? "application/octet-stream",
    "Cache-Control": cacheControl(key, opts.versioned ?? false),
    // security: HTTPS only for a year, no MIME sniffing, no embedding in other sites, minimal referrer,
    // no access to device features, and the window isolated from pages it opens
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    // the API is meant to be used by other sites and apps; everything else only by this site
    "Cross-Origin-Resource-Policy": api ? "cross-origin" : "same-origin",
  });
  if (type === "html") h.set("Content-Security-Policy", await pageCsp());
  if (api) h.set("Access-Control-Allow-Origin", "*");
  if (env.NOINDEX === "1") h.set("X-Robots-Tag", "noindex");
  if (opts.etag) h.set("ETag", opts.etag);
  return h;
}

async function notFound(env: Env, head: boolean): Promise<Response> {
  const page = await env.SITE.get("404.html");
  return new Response(head || !page ? null : page.body, { status: 404, headers: await headers("404.html", env) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === "/kontakt") return handleContact(request, env.CONTACT, env.CONTACT_TO);
    if (new URL(request.url).pathname === "/raporto") return handleReport(request, env.REPORTS);
    // daily notifications and the app open counter (src/worker/push.ts)
    if (new URL(request.url).pathname === "/njoftime") return handleSubscribe(request, env.REPORTS);
    if (new URL(request.url).pathname === "/hap") return handleOpen(request, env.REPORTS);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS" },
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD, OPTIONS" } });
    }
    const head = request.method === "HEAD";
    // offline: answer without reading the bucket, so R2 usage stops growing
    if (env.OFFLINE === "1") {
      return new Response(head ? null : OFFLINE_PAGE, {
        status: 503,
        headers: { "Content-Type": TYPES.html, "Retry-After": "86400", "Cache-Control": "no-store" },
      });
    }
    const url = new URL(request.url);
    // one address for the site (no duplicate copies for search engines):
    // www.fjalorishqip.org and the *.workers.dev test address → fjalorishqip.org
    if (env.CANONICAL_HOST && (url.hostname === `www.${env.CANONICAL_HOST}` || url.hostname.endsWith(".workers.dev"))) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const key = keyFor(url.pathname);
    if (key === null) return notFound(env, head);

    const object = await env.SITE.get(key);
    if (object) {
      const h = await headers(key, env, { etag: object.httpEtag, versioned: url.searchParams.has("v") });
      if (request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers: h });
      return new Response(head ? null : object.body, { headers: h });
    }

    // "/fjala/nënë" without the slash: send the visitor to the page if it exists
    if (!extOf(key) && key !== "" && (await env.SITE.head(`${key}/index.html`))) {
      url.pathname = `${url.pathname}/`;
      return Response.redirect(url.toString(), 301);
    }
    return notFound(env, head);
  },

  /**
   * wrangler.toml [triggers]: every Monday the week's reports and suggestions by email; every minute of the
   * morning and evening hour the next batch of daily notifications (src/worker/push.ts).
   */
  async scheduled(event: { cron?: string }, env: Env): Promise<void> {
    if (event.cron === WEEKLY_CRON) await sendWeekly(env.REPORTS, env.CONTACT, env.CONTACT_TO, new Date(), await weeklyStats(env.REPORTS));
    else await sendBatch(env.REPORTS);
  },
};
