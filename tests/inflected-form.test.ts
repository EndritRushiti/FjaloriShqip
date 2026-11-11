import { describe, expect, it } from "vitest";
import type { Word } from "../src/data/model.js";
import { inflectedForm } from "../scripts/lib/inflected-form.js";

const word = (w: string, pos: string, forms: string[]) =>
  ({ word: w, entries: [{ pos, forms: forms.map((form) => ({ form, tags: [] })), senses: [] }] }) as unknown as Word;
const vdes = word("vdes", "verb", ["vdiqa", "vdekur", "duke vdekur", "për të vdekur", "vdes", "vdesim", "vdesin", "vdiq", "vdiqën"]);
const grua = word("grua", "noun", ["gruaja", "gruas", "gra", "grave"]);
const kembe = word("këmbë", "noun", ["këmba", "këmbën", "këmbët", "këmbëve"]);
const punoj = word("punoj", "verb", ["punova", "punuar", "punojmë"]);

describe("inflectedForm", () => {
  it("keeps the word itself in a dialect", () => {
    expect(inflectedForm("des", vdes)).toBe(false);
    expect(inflectedForm("grue", grua)).toBe(false);
    expect(inflectedForm("kâmbë", kembe)).toBe(false);
  });
  it("leaves out participles and past tenses", () => {
    for (const f of ["vdekuna", "vdekurë", "dekunit", "vdig", "vdiqnë"]) expect(inflectedForm(f, vdes)).toBe(true);
    expect(inflectedForm("punue", punoj)).toBe(true);
  });
  it("treats spelling variants as the word, not as inflections", () => {
    const larte = { word: "lartë", entries: [{ pos: "adj", forms: [{ form: "naltë", tags: ["alternative"] }, { form: "të larta", tags: ["feminine", "plural"] }], senses: [] }] } as unknown as Word;
    expect(inflectedForm("naltë", larte)).toBe(false);
  });
  it("keeps a form when the word has no inflection table", () => {
    expect(inflectedForm("vdekuna", word("vdes", "verb", []))).toBe(false);
  });
});

describe("onMap", () => {
  it("shows the dialect's way of saying the word", async () => {
    const { onMap } = await import("../scripts/lib/inflected-form.js");
    expect(onMap("des", vdes)).toBe(true);
    expect(onMap("grue", grua)).toBe(true);
    expect(onMap("vdekuna", vdes)).toBe(false);
  });
  it("leaves out another word with the same meaning", async () => {
    const { onMap } = await import("../scripts/lib/inflected-form.js");
    expect(onMap("kath", word("mjegull", "noun", ["mjegulla"]))).toBe(false);
  });
});

describe("plainOfInflected", () => {
  it("finds the plain Gheg word in a case form, when only regular sound changes differ", async () => {
    const { plainOfInflected } = await import("../scripts/lib/inflected-form.js");
    const kapuc = word("kapuç", "noun", ["kapuça", "kapuçi", "kapuçin", "kapuçat"]);
    expect(plainOfInflected("kapuqi", kapuc)).toBe("kapuq");
    expect(plainOfInflected("kapuqin", kapuc)).toBe("kapuq");
    expect(plainOfInflected("kath", kapuc)).toBeUndefined();
  });
});
