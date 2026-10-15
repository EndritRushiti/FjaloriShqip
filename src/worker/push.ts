/**
 * Daily notifications (Web Push) and the app's open counter, all inside the free plan.
 *
 *   GET  /njoftime          → {"key": "<VAPID public key>"} for pushManager.subscribe()
 *   POST /njoftime          → {"endpoint": "...", "action": "shto" | "hiq"} subscribes or unsubscribes a browser
 *   GET  /hap?burim=app&te=/fjala/x/  → counts one opening (home-screen icon or notification) and redirects
 *   cron "* 6 * * *" / "* 17 * * *"   → morning word of the day, evening proverb (sendBatch)
 *
 * The pushes carry no payload, so nothing has to be encrypted: the service worker (public/sw.js) wakes up,
 * reads today's word and proverb from /api/v1/njoftime.json and shows the notification itself. Each push is
 * one HTTP request signed with a VAPID key (ES256) that the Worker creates on first use and keeps in the
 * private bucket; the private key never leaves Cloudflare.
 *
 * Free-plan limits: a Worker run may make only 50 outgoing requests, so each cron run sends to BATCH
 * subscribers and remembers where it stopped; the cron fires every minute of the hour until everyone got it.
 * New subscriptions are capped per day, and the open counter stops writing after a daily cap.
 */

/** The parts of the Workers R2 API used here. */
export interface PushBucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string, options?: { customMetadata?: Record<string, string> }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit?: number; include?: ("customMetadata")[] }): Promise<{
    objects: { key: string; customMetadata?: Record<string, string> }[];
    truncated: boolean;
    cursor?: string;
  }>;
}

export const SUBS = "njoftime/abonime/";
const KEY_FILE = "njoftime/celesi.json";
const STATE_FILE = "njoftime/gjendje.json";
/** Pushes per cron run (the free plan allows 50 outgoing requests per run, R2 calls aside). */
export const BATCH = 35;
export const MAX_NEW_PER_DAY = 2000;
export const MAX_OPENS_PER_DAY = 5000;
/** Sent with the VAPID token: who runs the push sender (a URL, so no email address is published). */
const CONTACT = "https://fjalorishqip.org/rreth/";

/** Push services of the browsers; any other endpoint is refused (the Worker must not post to arbitrary hosts). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/];

export function validEndpoint(s: unknown): s is string {
  if (typeof s !== "string" || s.length > 1000) return false;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname));
}

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlText = (s: string) => b64url(new TextEncoder().encode(s));

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface VapidKey {
  /** private key as JWK (kept only in the private bucket) */
  jwk: JsonWebKey;
  /** public key, uncompressed point, base64url (what browsers call applicationServerKey) */
  pub: string;
}

/** The VAPID key pair, created on first use. */
export async function vapidKey(bucket: PushBucket): Promise<VapidKey> {
  const stored = await (await bucket.get(KEY_FILE))?.text();
  if (stored) return JSON.parse(stored) as VapidKey;
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const pub = b64url((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  await bucket.put(KEY_FILE, JSON.stringify({ jwk, pub }));
  // two first requests at once could both create a key: the one stored last wins for everyone
  return JSON.parse((await (await bucket.get(KEY_FILE))?.text()) ?? JSON.stringify({ jwk, pub })) as VapidKey;
}

/** The signed VAPID token (JWT, ES256) for one push service. */
export async function vapidToken(key: VapidKey, endpoint: string, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64urlText(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64urlText(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: CONTACT }));
  const signer = await crypto.subtle.importKey("jwk", key.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signer, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(sig)}`;
}

const json = (data: object, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache } });

const today = (now: Date) => now.toISOString().slice(0, 10);

/** GET/POST /njoftime. */
export async function handleSubscribe(request: Request, bucket: PushBucket | undefined, now = new Date()): Promise<Response> {
  if (!bucket) return json({ ok: false, error: "unavailable" }, 503);
  if (request.method === "GET") return json({ key: (await vapidKey(bucket)).pub }, 200, "public, max-age=3600");
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
  let body: { endpoint?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }
  if (!validEndpoint(body.endpoint)) return json({ ok: false, error: "endpoint" }, 400);
  const key = SUBS + (await sha256Hex(body.endpoint));
  if (body.action === "hiq") {
    await bucket.delete(key);
    return json({ ok: true });
  }
  const counter = `njoftime/numri/${today(now)}`;
  const count = Number((await (await bucket.get(counter))?.text()) ?? 0);
  if (count >= MAX_NEW_PER_DAY) return json({ ok: false, error: "full" }, 429);
  await bucket.put(key, "", { customMetadata: { endpoint: body.endpoint, at: now.toISOString() } });
  await bucket.put(counter, String(count + 1));
  return json({ ok: true });
}

/** Where /hap may send the visitor: a path on this site only. */
export function safeTarget(te: string | null): string {
  return te && te.startsWith("/") && !te.startsWith("//") && !te.includes("\\") && te.length < 300 ? te : "/";
}

/** GET /hap?burim=app|njoftim&te=/path: counts one opening of the app, then redirects to the page. */
export async function handleOpen(request: Request, bucket: PushBucket | undefined, now = new Date()): Promise<Response> {
  const url = new URL(request.url);
  const source = url.searchParams.get("burim") === "njoftim" ? "njoftim" : "app";
  const target = new URL(safeTarget(url.searchParams.get("te")), url.origin);
  // the visitor's page view is still counted by the analytics on the page; the tag tells where it came from
  target.searchParams.set("nga", source);
  const redirect = new Response(null, { status: 302, headers: { Location: target.toString(), "Cache-Control": "no-store" } });
  if (!bucket) return redirect;
  try {
    const file = `hapje/${today(now)}.json`;
    const counts = JSON.parse((await (await bucket.get(file))?.text()) ?? "{}") as Record<string, number>;
    if ((counts[source] ?? 0) < MAX_OPENS_PER_DAY) {
      counts[source] = (counts[source] ?? 0) + 1;
      await bucket.put(file, JSON.stringify(counts));
    }
  } catch {
    // counting must never stop the app from opening
  }
  return redirect;
}

/** "2026-10-15-mengjes" / "2026-10-15-mbremje": one round of notifications. */
export const slotOf = (now: Date) => `${today(now)}-${now.getUTCHours() < 12 ? "mengjes" : "mbremje"}`;

interface State {
  slot: string;
  cursor?: string;
  done: boolean;
  sent: number;
  gone: number;
}

/** One cron run: sends the current round to the next BATCH subscribers. */
export async function sendBatch(bucket: PushBucket | undefined, now = new Date(), send: typeof fetch = fetch): Promise<State | null> {
  if (!bucket) return null;
  const slot = slotOf(now);
  const saved = JSON.parse((await (await bucket.get(STATE_FILE))?.text()) ?? "null") as State | null;
  const state: State = saved?.slot === slot ? saved : { slot, done: false, sent: 0, gone: 0 };
  if (state.done) return state;
  const page = await bucket.list({ prefix: SUBS, cursor: state.cursor, limit: BATCH, include: ["customMetadata"] });
  if (page.objects.length) {
    const key = await vapidKey(bucket);
    const tokens = new Map<string, string>();
    const gone: string[] = [];
    await Promise.all(
      page.objects.map(async (o) => {
        const endpoint = o.customMetadata?.endpoint;
        if (!validEndpoint(endpoint)) return void gone.push(o.key);
        const origin = new URL(endpoint).origin;
        if (!tokens.has(origin)) tokens.set(origin, await vapidToken(key, endpoint, now.getTime()));
        try {
          const r = await send(endpoint, {
            method: "POST",
            headers: { Authorization: `vapid t=${tokens.get(origin)}, k=${key.pub}`, TTL: "21600", Urgency: "normal", "Content-Length": "0" },
          });
          if (r.status === 404 || r.status === 410) gone.push(o.key); // the browser unsubscribed or the subscription expired
          else if (r.ok) state.sent++;
        } catch {
          // one failing push service must not stop the others
        }
      }),
    );
    if (gone.length) await bucket.delete(gone);
    state.gone += gone.length;
  }
  state.cursor = page.truncated ? page.cursor : undefined;
  state.done = !page.truncated;
  await bucket.put(STATE_FILE, JSON.stringify(state));
  return state;
}

/** For the Monday email: app openings in the last 7 days and the number of subscribers. */
export async function weeklyStats(bucket: PushBucket | undefined, now = new Date()): Promise<string> {
  if (!bucket) return "";
  const opens = { app: 0, njoftim: 0 };
  const files = (await bucket.list({ prefix: "hapje/" })).objects.map((o) => o.key);
  const weekAgo = `hapje/${today(new Date(now.getTime() - 7 * 86400000))}`;
  for (const f of files.filter((f) => f >= weekAgo)) {
    const c = JSON.parse((await (await bucket.get(f))?.text()) ?? "{}") as Record<string, number>;
    opens.app += c.app ?? 0;
    opens.njoftim += c.njoftim ?? 0;
  }
  let subscribers = 0;
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await bucket.list({ prefix: SUBS, cursor, limit: 1000 });
    subscribers += page.objects.length;
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  // old counters are no longer needed
  const old = files.filter((f) => f < `hapje/${today(new Date(now.getTime() - 60 * 86400000))}`);
  const oldNew = (await bucket.list({ prefix: "njoftime/numri/" })).objects.map((o) => o.key).filter((k) => k < `njoftime/numri/${today(now)}`);
  if (old.length || oldNew.length) await bucket.delete([...old, ...oldNew]);
  return `Aplikacioni këtë javë: ${opens.app} hapje nga ikona, ${opens.njoftim} nga njoftimet; ${subscribers} pajisje të abonuara në njoftimet ditore.`;
}
