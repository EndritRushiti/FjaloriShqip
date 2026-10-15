import { describe, expect, it } from "vitest";
import { calendar, dayOf, foldLine } from "../scripts/lib/daily.js";
import { BATCH, handleOpen, handleSubscribe, type PushBucket, safeTarget, sendBatch, SUBS, validEndpoint, vapidKey, vapidToken } from "../src/worker/push.js";

function memory(): PushBucket & { files: Map<string, { value: string; meta?: Record<string, string> }> } {
  const files = new Map<string, { value: string; meta?: Record<string, string> }>();
  return {
    files,
    async get(key) {
      const f = files.get(key);
      return f ? { text: async () => f.value } : null;
    },
    async put(key, value, options) {
      files.set(key, { value, meta: options?.customMetadata });
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) files.delete(k);
    },
    async list({ prefix, cursor, limit = 1000 }) {
      const keys = [...files.keys()].filter((k) => k.startsWith(prefix)).sort();
      // like R2: the cursor points past the last key returned, so deleting listed keys shifts nothing
      const rest = cursor ? keys.filter((k) => k > cursor) : keys;
      const page = rest.slice(0, limit);
      const truncated = rest.length > limit;
      return { objects: page.map((key) => ({ key, customMetadata: files.get(key)!.meta })), truncated, cursor: truncated ? page[page.length - 1] : undefined };
    },
  };
}

const FCM = "https://fcm.googleapis.com/fcm/send/abc123";
const post = (body: object) => new Request("https://fjalorishqip.org/njoftime", { method: "POST", body: JSON.stringify(body) });

describe("push notifications", () => {
  it("accepts only browser push services", () => {
    expect(validEndpoint(FCM)).toBe(true);
    expect(validEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(validEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(validEndpoint("https://evil.example.com/fcm.googleapis.com")).toBe(false);
    expect(validEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(validEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(validEndpoint(42)).toBe(false);
  });

  it("creates one VAPID key and signs valid ES256 tokens", async () => {
    const b = memory();
    const key = await vapidKey(b);
    expect((await vapidKey(b)).pub).toBe(key.pub);
    expect(Buffer.from(key.pub, "base64url").length).toBe(65); // uncompressed P-256 point
    const jwt = await vapidToken(key, FCM, Date.UTC(2026, 9, 15));
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toMatch(/^https:/); // no email address
    const pub = await crypto.subtle.importKey("raw", Buffer.from(key.pub, "base64url"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it("subscribes, refuses foreign endpoints and unsubscribes", async () => {
    const b = memory();
    expect((await handleSubscribe(post({ endpoint: FCM, action: "shto" }), b)).status).toBe(200);
    expect([...b.files.keys()].filter((k) => k.startsWith(SUBS))).toHaveLength(1);
    expect((await handleSubscribe(post({ endpoint: "https://example.com/x" }), b)).status).toBe(400);
    const key = await (await handleSubscribe(new Request("https://fjalorishqip.org/njoftime"), b)).json();
    expect(typeof (key as { key: string }).key).toBe("string");
    await handleSubscribe(post({ endpoint: FCM, action: "hiq" }), b);
    expect([...b.files.keys()].filter((k) => k.startsWith(SUBS))).toHaveLength(0);
  });

  it("sends in batches, once per round, and forgets expired subscriptions", async () => {
    const b = memory();
    for (let i = 0; i < BATCH + 5; i++) await handleSubscribe(post({ endpoint: `${FCM}-${i}` }), b);
    const sent: string[] = [];
    const send = (async (u: string) => {
      sent.push(u);
      return new Response(null, { status: u.endsWith("-3") ? 410 : 201 });
    }) as unknown as typeof fetch;
    const morning = new Date(Date.UTC(2026, 9, 15, 6, 0));
    const first = await sendBatch(b, morning, send);
    expect(first?.done).toBe(false);
    expect(first!.sent + first!.gone).toBe(BATCH);
    const second = await sendBatch(b, new Date(Date.UTC(2026, 9, 15, 6, 1)), send);
    expect(second).toMatchObject({ done: true, sent: BATCH + 4, gone: 1 });
    expect(sent).toHaveLength(BATCH + 5);
    await sendBatch(b, new Date(Date.UTC(2026, 9, 15, 6, 2)), send);
    expect(sent).toHaveLength(BATCH + 5); // nothing more this morning
    await sendBatch(b, new Date(Date.UTC(2026, 9, 15, 17, 0)), send);
    expect(sent.length).toBeGreaterThan(BATCH + 5); // the evening round starts again
    expect([...b.files.keys()].filter((k) => k.startsWith(SUBS))).toHaveLength(BATCH + 4);
  });

  it("counts app openings and redirects only within the site", async () => {
    const b = memory();
    const r = await handleOpen(new Request("https://fjalorishqip.org/hap?burim=njoftim&te=%2Ffjala%2Fnënë%2F"), b);
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://fjalorishqip.org/fjala/n%C3%ABn%C3%AB/?nga=njoftim");
    await handleOpen(new Request("https://fjalorishqip.org/hap"), b);
    const counts = JSON.parse([...b.files.entries()].find(([k]) => k.startsWith("hapje/"))![1].value);
    expect(counts).toEqual({ njoftim: 1, app: 1 });
    expect(safeTarget("//evil.com")).toBe("/");
    expect(safeTarget("https://evil.com")).toBe("/");
    expect(safeTarget("/\\evil.com")).toBe("/");
  });
});

describe("daily word and calendar", () => {
  it("gives every date one item, the same each time", () => {
    const list = ["a", "b", "c"];
    expect(dayOf(list, "2026-10-15")).toBe(dayOf(list, "2026-10-15"));
    expect(new Set(["2026-10-15", "2026-10-16", "2026-10-17"].map((d) => dayOf(list, d))).size).toBe(3);
  });

  it("folds long calendar lines without breaking letters", () => {
    const line = `DESCRIPTION:${"ëç".repeat(60)}`;
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n ").join("")).toBe(line);
  });

  it("writes a valid calendar", () => {
    const item = { titulli: "Fjala e ditës: ânë", teksti: "Gegërisht për «anë»: ana, krahu; pjesa", url: "/fjala/anë/" };
    const ics = calendar([["2026-10-15", { fjala: item, fjaleUrte: item }]], "https://fjalorishqip.org", new Date(Date.UTC(2026, 9, 15)));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261015\r\nDTEND;VALUE=DATE:20261016");
    expect(ics).toContain("UID:2026-10-15@fjalorishqip.org");
    expect(ics).toContain("krahu\\; pjesa");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
