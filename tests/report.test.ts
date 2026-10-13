import { describe, expect, it, vi } from "vitest";
import { digest, handleReport, MAX_PER_WEEK, readReport, type ReportBucket, sendWeekly, weekOf } from "../src/worker/report.js";

vi.mock("cloudflare:email", () => ({ EmailMessage: class { constructor(public from: string, public to: string, public raw: string) {} } }));

const NOW = Date.parse("2026-10-14T10:00:00Z");
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ t: String(NOW - 10_000), website: "", message: "", ...fields })) f.set(k, v);
  return f;
};

/** An in-memory stand-in for the R2 bucket. */
function memoryBucket(): ReportBucket & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.has(key) ? { text: async () => data.get(key)! } : null;
    },
    async put(key, value) {
      data.set(key, value);
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k);
    },
    async list({ prefix }) {
      return { objects: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false };
    },
  };
}

const post = (fields: Record<string, string>) => new Request("https://fjalorishqip.org/raporto", { method: "POST", body: form(fields), headers: { Accept: "application/json" } });

describe("reports and suggestions", () => {
  it("accepts a one-tap report and requires text only for a suggestion", () => {
    expect(readReport(form({ kind: "kuptimi", word: "mjet" }), NOW)).toMatchObject({ kind: "kuptimi", word: "mjet", message: "" });
    expect(readReport(form({ kind: "sugjerim", word: "mjet" }), NOW)).toEqual({ error: "message" });
    expect(readReport(form({ kind: "sugjerim", word: "mjet", message: "Vegël, mjet pune." }), NOW)).toMatchObject({ message: "Vegël, mjet pune." });
  });

  it("refuses robots, unknown kinds, missing words and posts made too fast", () => {
    expect(readReport(form({ kind: "kuptimi", word: "x", website: "spam" }), NOW)).toEqual({ error: "spam" });
    expect(readReport(form({ kind: "tjeter", word: "x" }), NOW)).toEqual({ error: "kind" });
    expect(readReport(form({ kind: "kuptimi", word: "" }), NOW)).toEqual({ error: "word" });
    expect(readReport(form({ kind: "kuptimi", word: "x", t: String(NOW - 500) }), NOW)).toEqual({ error: "too-fast" });
  });

  it("names each week by its Monday", () => {
    expect(weekOf(new Date("2026-10-14T10:00:00Z"))).toBe("2026-10-12");
    expect(weekOf(new Date("2026-10-18T23:00:00Z"))).toBe("2026-10-12");
    expect(weekOf(new Date("2026-10-19T00:00:00Z"))).toBe("2026-10-19");
  });

  it("stores reports privately and stops at the weekly limit", async () => {
    const bucket = memoryBucket();
    const ok = await handleReport(post({ kind: "fjale-e-re", word: "selfie" }), bucket, new Date(NOW));
    expect(await ok.json()).toEqual({ ok: true });
    expect([...bucket.data.keys()].filter((k) => k.startsWith("r/"))).toHaveLength(1);
    bucket.data.set("numri/2026-10-12", String(MAX_PER_WEEK));
    const full = await handleReport(post({ kind: "kuptimi", word: "mjet" }), bucket, new Date(NOW));
    expect(await full.json()).toEqual({ ok: false, error: "full" });
  });

  it("lists the week's reports by kind, counting repeated words once", () => {
    const at = new Date(NOW).toISOString();
    const raw = digest(
      [
        { kind: "kuptimi", word: "mjet", message: "", at },
        { kind: "kuptimi", word: "mjet", message: "", at },
        { kind: "sugjerim", word: "dru", message: "Lëndë e fortë e pemëve.", at },
        { kind: "fjale-e-re", word: "selfie", message: "", at },
      ],
      "autori@example.org",
      new Date(NOW),
    );
    const body = Buffer.from(raw.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");
    expect(body).toContain("• mjet (2 herë) — https://fjalorishqip.org/fjala/mjet/");
    expect(body).toContain("„Lëndë e fortë e pemëve.”");
    expect(body).toContain("== Fjalë që mungon në fjalor (1) ==\n\n• selfie");
  });

  it("emails the list on Monday, then empties it", async () => {
    const bucket = memoryBucket();
    await handleReport(post({ kind: "lloji", word: "testoj" }), bucket, new Date(NOW));
    const sent: unknown[] = [];
    const n = await sendWeekly(bucket, { send: async (m) => void sent.push(m) }, "autori@example.org", new Date("2026-10-19T07:00:00Z"));
    expect(n).toBe(1);
    expect(sent).toHaveLength(1);
    expect([...bucket.data.keys()]).toEqual([]);
    expect(await sendWeekly(bucket, { send: async (m) => void sent.push(m) }, "autori@example.org")).toBe(0);
    expect(sent).toHaveLength(1); // nothing to report: no email
  });
});
