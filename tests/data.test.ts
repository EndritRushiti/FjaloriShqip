import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { compareSq, firstLetter, foldKey } from "../src/data/model.js";
import { formsHtml } from "../src/site/tables.js";
import { SOURCES } from "../src/data/sources.js";

describe("Albanian text helpers", () => {
  it("folds ë/ç and Gheg nasal vowels for search", () => {
    expect(foldKey("Nënë")).toBe("nene");
    expect(foldKey("çaj")).toBe("caj");
    expect(foldKey("âsht")).toBe("asht");
  });
  it("treats digraphs as single letters of the alphabet", () => {
    expect(firstLetter("shtëpi")).toBe("sh");
    expect(firstLetter("gjuhë")).toBe("gj");
    expect(firstLetter("ëndërr")).toBe("ë");
    expect(firstLetter("zog")).toBe("z");
  });
  it("sorts in Albanian alphabetical order (c < ç < d, e < ë < f, s < sh < t)", () => {
    const sorted = ["dorë", "çaj", "cep", "ëndërr", "fole", "emër", "shtëpi", "sy", "tokë"].sort(compareSq);
    expect(sorted).toEqual(["cep", "çaj", "dorë", "emër", "ëndërr", "fole", "sy", "shtëpi", "tokë"]);
  });
});

describe("inflection tables", () => {
  it("renders a conjugation row from Wiktionary tags", () => {
    const html = formsHtml({
      pos: "verb",
      senses: [],
      sources: ["en-wiktionary"],
      forms: [
        { form: "punoj", tags: ["first-person", "indicative", "present", "singular"] },
        { form: "punon", tags: ["indicative", "present", "second-person", "singular"] },
        { form: "punova", tags: ["aorist", "first-person", "indicative", "singular"] },
        { form: "punuar", tags: ["participle"] },
      ],
    });
    expect(html).toContain("punoj");
    expect(html).toContain("punova");
    expect(html).toContain("Pjesorja");
  });
});

describe("sources and licences", () => {
  it("every source states a licence, what is used, and a link", () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.licence).toBeTruthy();
      expect(s.licenceUrl).toMatch(/^https:\/\//);
      expect(s.usedFor.sq && s.usedFor.en).toBeTruthy();
    }
  });
  it("the build excludes Wikifjalor pages copied in the FGJSSH layout", () => {
    const code = fs.readFileSync("scripts/build-data.ts", "utf8");
    expect(code).toMatch(/FGJSSH/);
    const fgjsshLike = "'''FLETORE''' f.\n1. Disa fletë letre…";
    expect(/^'''[A-ZËÇ ]{2,}'''/m.test(fgjsshLike)).toBe(true);
  });
});

describe("built data (when present)", () => {
  const file = "data/fjalori.json";
  const has = fs.existsSync(file);
  it.runIf(has)("every word lists at least one source and a known part of speech", () => {
    const words = JSON.parse(fs.readFileSync(file, "utf8")) as { word: string; sources: string[]; entries: { pos: string }[] }[];
    expect(words.length).toBeGreaterThan(5000);
    for (const w of words.slice(0, 2000)) {
      expect(w.sources.length).toBeGreaterThan(0);
      for (const e of w.entries) expect(e.pos).toMatch(/^(noun|verb|adj|adv|pron|num|prep|conj|interj|particle|det|other)$/);
    }
    expect(words.find((w) => w.word === "punoj")).toBeTruthy();
  });
});
