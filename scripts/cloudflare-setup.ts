/**
 * Serves fjalorishqip.org straight from the R2 bucket behind Cloudflare's cache, so page views do not
 * run the Worker (whose free plan stops at 100,000 requests a day). What the Worker did for the main
 * domain is done by zone rules instead:
 *
 *   /fjala/nënë/  → fjala/nënë/index.html        URL rewrite rule
 *   /fjala/nënë   → the same page                URL rewrite rule (paths without a dot; canonical link has the slash)
 *   security headers, CSP, Cache-Control, CORS    response header rules
 *   pages kept at Cloudflare's edge               cache rule (emptied after every deploy)
 *
 * The Worker stays for www.fjalorishqip.org and *.workers.dev (redirects to the main domain), and the usage
 * guard's offline page is a separate Worker on a route in front of the bucket (wrangler.toml [env.offline]).
 *
 *   npx tsx scripts/cloudflare-setup.ts          rules + main domain on the bucket + empty the cache (safe to re-run)
 *   npx tsx scripts/cloudflare-setup.ts --purge  only empty Cloudflare's cache
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. Besides the Workers permissions, the token needs
 * for the zone: Zone Read, DNS Edit, Transform Rules Edit, Cache Rules Edit,
 * Cache Purge, Workers Routes Edit; and for the account: Workers R2 Storage Edit.
 */
import { pathToFileURL } from "node:url";
import { contentSecurityPolicy, cspHash, HEAD_SCRIPT } from "../src/site/security.js";

export const HOST = "fjalorishqip.org";
export const BUCKET = "fjalorishqip";
export const WORKER = "fjalorishqip";
/** Private bucket for reports and suggestions until the weekly email (src/worker/report.ts); never given a domain. */
export const REPORTS_BUCKET = "fjalorishqip-raporte";
/** How long Cloudflare keeps a copy at the edge; every deploy empties the cache, so this only limits staleness if that fails. */
export const EDGE_TTL = 4 * 3600;

const onHost = `http.host eq "${HOST}"`;
const path = "http.request.uri.path";
const ext = (...e: string[]) => `(${e.map((x) => `ends_with(${path}, ".${x}")`).join(" or ")})`;
const assets = ext("css", "js", "png", "svg", "ico", "webmanifest");
const versioned = `http.request.uri.query contains "v="`;
const set = (value: string) => ({ operation: "set", value });

export interface Rule {
  description: string;
  expression: string;
  action: string;
  action_parameters: Record<string, unknown>;
}

/** The rules of each ruleset phase. A phase's entry point is replaced as a whole, so re-running is safe. */
export async function rules(): Promise<Record<string, Rule[]>> {
  const csp = contentSecurityPolicy(await cspHash(HEAD_SCRIPT));
  return {
    http_request_transform: [
      {
        description: "FjaloriShqip: a folder → its index.html in the bucket",
        expression: `(${onHost} and ends_with(${path}, "/"))`,
        action: "rewrite",
        action_parameters: { uri: { path: { expression: `concat(${path}, "index.html")` } } },
      },
      {
        // the page itself, not a redirect: its canonical link names the address with the slash
        // (/kontakt, /raporto, /njoftime and /hap are the Worker's addresses and must reach it unchanged)
        description: "FjaloriShqip: /fjala/nënë (no slash, no file type) → fjala/nënë/index.html",
        expression: `(${onHost} and not ends_with(${path}, "/") and not ${path} contains "." and not ${path} in {"/kontakt" "/raporto" "/njoftime" "/hap"})`,
        action: "rewrite",
        action_parameters: { uri: { path: { expression: `concat(${path}, "/index.html")` } } },
      },
    ],
    http_request_cache_settings: [
      {
        description: "FjaloriShqip: keep pages and files at Cloudflare's edge",
        expression: `(${onHost})`,
        action: "set_cache_settings",
        action_parameters: { cache: true, edge_ttl: { mode: "override_origin", default: EDGE_TTL }, browser_ttl: { mode: "respect_origin" } },
      },
    ],
    // all matching rules run in order; a later rule's value replaces an earlier one
    http_response_headers_transform: [
      {
        // HTTPS only, no MIME sniffing, no embedding, minimal referrer, no device features, isolated window
        description: "FjaloriShqip: security headers; pages revalidate every time",
        expression: `(${onHost})`,
        action: "rewrite",
        action_parameters: {
          headers: {
            "Strict-Transport-Security": set("max-age=31536000; includeSubDomains"),
            "X-Content-Type-Options": set("nosniff"),
            "X-Frame-Options": set("DENY"),
            "Referrer-Policy": set("strict-origin-when-cross-origin"),
            "Permissions-Policy": set("camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"),
            "Cross-Origin-Opener-Policy": set("same-origin"),
            "Cross-Origin-Resource-Policy": set("same-origin"),
            "Content-Security-Policy": set(csp),
            "Cache-Control": set("public, max-age=0, must-revalidate"),
          },
        },
      },
      {
        description: "FjaloriShqip: .txt files (robots.txt, llms.txt) as text",
        expression: `(${onHost} and ${ext("txt")})`,
        action: "rewrite",
        action_parameters: { headers: { "Content-Type": set("text/plain; charset=utf-8") } },
      },
      {
        description: "FjaloriShqip: the web app manifest",
        expression: `(${onHost} and ${ext("webmanifest")})`,
        action: "rewrite",
        action_parameters: { headers: { "Content-Type": set("application/manifest+json; charset=utf-8") } },
      },
      {
        description: "FjaloriShqip: assets without a version, kept an hour",
        expression: `(${onHost} and ${assets} and not ${versioned})`,
        action: "rewrite",
        action_parameters: { headers: { "Cache-Control": set("public, max-age=3600") } },
      },
      {
        description: "FjaloriShqip: versioned assets (style.css?v=…) never change, kept a year",
        expression: `(${onHost} and ${assets} and ${versioned})`,
        action: "rewrite",
        action_parameters: { headers: { "Cache-Control": set("public, max-age=31536000, immutable") } },
      },
      {
        description: "FjaloriShqip: the API can be used by any site or app",
        expression: `(${onHost} and starts_with(${path}, "/api/"))`,
        action: "rewrite",
        action_parameters: {
          headers: {
            "Access-Control-Allow-Origin": set("*"),
            "Cross-Origin-Resource-Policy": set("cross-origin"),
            "Cache-Control": set("public, max-age=3600"),
          },
        },
      },
    ],
  };
}

interface ApiResult<T> {
  success: boolean;
  result: T;
  errors?: { code: number; message: string }[];
}

function client(token: string) {
  return async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // some calls (e.g. DELETE) answer 200 with an empty body: that is a success
    const text = await res.text();
    let json: ApiResult<T>;
    try {
      json = text ? (JSON.parse(text) as ApiResult<T>) : { success: res.ok, result: null as T };
    } catch {
      json = { success: res.ok, result: null as T, errors: [{ code: res.status, message: res.statusText }] };
    }
    if (!res.ok || json.success === false) {
      throw new Error(`${method} ${url}: ${res.status} ${json.errors?.map((e) => `${e.code} ${e.message}`).join("; ")}`);
    }
    return json.result;
  };
}

async function main() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are needed");
  const api = client(token);
  const [zone] = await api<{ id: string }[]>("GET", `/zones?name=${HOST}`);
  if (!zone) throw new Error(`zone ${HOST} not found (the token needs Zone Read)`);
  const purge = () => api("POST", `/zones/${zone.id}/purge_cache`, { purge_everything: true });

  if (process.argv.includes("--purge")) {
    await purge();
    return console.log("Cloudflare cache emptied");
  }

  // 1. rules first, so everything already works the moment the domain points at the bucket
  for (const [phase, list] of Object.entries(await rules())) {
    await api("PUT", `/zones/${zone.id}/rulesets/phases/${phase}/entrypoint`, { rules: list });
    console.log(`rules: ${phase} (${list.length})`);
  }

  // the private reports bucket must exist before the Worker that uses it is deployed
  const buckets = await api<{ buckets: { name: string }[] }>("GET", `/accounts/${account}/r2/buckets`);
  if (!buckets.buckets.some((b) => b.name === REPORTS_BUCKET)) {
    await api("POST", `/accounts/${account}/r2/buckets`, { name: REPORTS_BUCKET });
    console.log(`bucket "${REPORTS_BUCKET}" created (private)`);
  }

  // 2. the main domain: from the Worker to the bucket (a few seconds in between)
  const bucketDomains = await api<{ domains: { domain: string }[] }>("GET", `/accounts/${account}/r2/buckets/${BUCKET}/domains/custom`);
  if (bucketDomains.domains.some((d) => d.domain === HOST)) {
    console.log(`${HOST} is already served from the bucket`);
  } else {
    const workerDomains = await api<{ id: string; hostname: string }[]>("GET", `/accounts/${account}/workers/domains`);
    const onWorker = workerDomains.filter((d) => d.hostname === HOST);
    for (const d of onWorker) await api("DELETE", `/accounts/${account}/workers/domains/${d.id}`);
    try {
      await api("POST", `/accounts/${account}/r2/buckets/${BUCKET}/domains/custom`, { domain: HOST, zoneId: zone.id, enabled: true, minTLS: "1.2" });
    } catch (e) {
      // put the Worker back so the site stays up, then report
      if (onWorker.length) {
        await api("PUT", `/accounts/${account}/workers/domains`, { hostname: HOST, service: WORKER, zone_id: zone.id, environment: "production" });
        console.log(`${HOST} given back to the Worker`);
      }
      throw e;
    }
    console.log(`${HOST} is now served from the bucket "${BUCKET}"`);
  }
  await purge();
  console.log("Cloudflare cache emptied");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(`::error::Cloudflare setup: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
