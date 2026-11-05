import { describe, expect, it } from "vitest";
import { check, type Knowledge, looksAlike, wellFormed } from "../scripts/lib/si-e-thua-rules.js";
import type { ReportBucket } from "../src/worker/report.js";
import { handleSiThua, readAnswer, type Ready, tally } from "../src/worker/si-e-thua.js";

const NOW = Date.parse("2026-11-05T10:00:00Z");
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ t: String(NOW - 10_000), website: "", word: "mushkonjë", form: "mushkonja", dialect: "gheg", region: "Shkodër", ...fields })) f.set(k, v);
  return f;
};
function bucket(): ReportBucket & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) { return data.has(key) ? { text: async () => data.get(key)! } : null; },
    async put(key, value) { data.set(key, value); },
    async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k); },
    async list({ prefix }) { return { objects: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
  };
}
const post = (b: ReportBucket, ip: string, fields: Record<string, string> = {}) =>
  handleSiThua(new Request("https://fjalorishqip.org/si-e-thua", { method: "POST", body: form(fields), headers: { "CF-Connecting-IP": ip } }), b, new Date(NOW));
const ready = async (b: ReportBucket & { data: Map<string, string> }) => JSON.parse(b.data.get("d-gati.json") ?? "[]") as Ready[];

describe("reading an answer", () => {
  it("accepts a good one and refuses robots and empty forms", () => {
    expect(readAnswer(form({}), NOW)).toMatchObject({ word: "mushkonjë", form: "mushkonja", dialect: "gheg" });
    expect(readAnswer(form({ website: "x" }), NOW)).toEqual({ error: "spam" });
    expect(readAnswer(form({ form: "a" }), NOW)).toEqual({ error: "form" });
    expect(readAnswer(form({ dialect: "x" }), NOW)).toEqual({ error: "dialect" });
    expect(readAnswer(form({ t: String(NOW - 500) }), NOW)).toEqual({ error: "too-fast" });
  });
});

describe("counting people", () => {
  it("three different people make a form ready", async () => {
    const b = bucket();
    await post(b, "1.1.1.1"); await post(b, "2.2.2.2");
    expect(await ready(b)).toEqual([]);
    await post(b, "3.3.3.3");
    expect(await ready(b)).toMatchObject([{ word: "mushkonjë", form: "mushkonja", dialect: "gheg", count: 3 }]);
  });
  it("the same person sending again never counts twice", async () => {
    const b = bucket();
    for (let i = 0; i < 6; i++) await post(b, "1.1.1.1");
    await post(b, "2.2.2.2");
    expect(await ready(b)).toEqual([]);
  });
  it("different dialects are counted apart", async () => {
    const b = bucket();
    await post(b, "1.1.1.1", { dialect: "gheg" }); await post(b, "2.2.2.2", { dialect: "gheg" }); await post(b, "3.3.3.3", { dialect: "tosk" });
    expect(await ready(b)).toEqual([]);
  });
  it("ë and capitals do not split a form, and the commonest spelling is kept", () => {
    const r = tally({ word: "x", dialect: "gheg", votes: { a: { form: "mushkonjë", region: "" }, b: { form: "mushkonje", region: "Pukë" }, c: { form: "mushkonjë", region: "Tiranë" } } });
    expect(r).toMatchObject([{ form: "mushkonjë", count: 3, regions: ["Pukë", "Tiranë"] }]);
  });
  it("never stores the address", async () => {
    const b = bucket();
    await post(b, "9.8.7.6");
    expect([...b.data.values()].join(" ")).not.toContain("9.8.7.6");
  });
});

const k: Knowledge = {
  headwords: new Set(["ujë", "bukë", "gjizë", "mushkonjë", "bajgë"]),
  linked: (w) => new Set(w === "mushkonjë" ? ["mushkonjat"] : []),
  sameMeaning: (a, b) => a === "gjizë" && b === "bajgë",
  offensive: new Set(["kar"]),
  loans: new Set(["zanzara"]),
};
describe("the checks", () => {
  it("accepts a real dialect form from three people", () => {
    expect(check("mushkonjë", "mushkujan", 3, k)).toEqual({ ok: true });
    expect(check("nënë", "nanë", 3, k)).toEqual({ ok: true });
  });
  it("needs more than two people", () => expect(check("mushkonjë", "mushkujan", 2, k)).toEqual({ ok: false, reason: "pak" }));
  it("refuses a known word with another meaning", () => expect(check("ujë", "bukë", 9, k)).toEqual({ ok: false, reason: "kuptim-tjeter" }));
  it("accepts a known word when the meaning matches", () => expect(check("gjizë", "bajgë", 3, k)).toEqual({ ok: true }));
  it("refuses vulgar, empty, loan and repeated answers", () => {
    expect(check("ujë", "kar", 9, k)).toEqual({ ok: false, reason: "fyese" });
    expect(check("ujë", "test", 9, k)).toEqual({ ok: false, reason: "banale" });
    expect(check("ujë", "nuk e di", 9, k)).toEqual({ ok: false, reason: "banale" });
    expect(check("mushkonjë", "zanzara", 9, k)).toEqual({ ok: false, reason: "huazim" });
    expect(check("mushkonjë", "mushkonjat", 9, k)).toEqual({ ok: false, reason: "ekziston" });
  });
  it("refuses the same word and plain inflected forms", () => {
    expect(check("bukë", "buke", 9, k)).toEqual({ ok: false, reason: "e-njejte" });
    expect(check("bukë", "bukën", 9, k)).toEqual({ ok: false, reason: "banale" });
  });
  it("refuses keyboard mashing", () => {
    expect(wellFormed("asdfghjkl")).toBe(false);
    expect(wellFormed("aaaa")).toBe(false);
    expect(wellFormed("bukë123")).toBe(false);
    expect(wellFormed("hundurne")).toBe(true);
  });
  it("a new word unlike the original needs five people", () => {
    expect(check("mushkonjë", "metshkë", 3, k)).toEqual({ ok: false, reason: "pak" });
    expect(check("mushkonjë", "metshkë", 5, k)).toEqual({ ok: true });
    expect(looksAlike("nënë", "nanë")).toBe(true);
  });
});
