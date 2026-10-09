import { describe, expect, it } from "vitest";
import { baseOf, findLemmas, guessPos, rootOf } from "../scripts/lib/hunspell-lemmas.js";

const LIST = new Set([
  "punoj", "punon", "punojmë", "punojnë", "punova", "punuar", "puno", "punoi",
  "mal", "mali", "malin", "malit", "male",
  "fushë", "fusha", "fushën", "fushës",
  "lule", "lulja", "lulen", "lules",
  "mundshëm", "mundshme",
  "besnik", "besnike",
  "artikull", "artikuj",
  "abonim", "agim",
  "luaj", "luajt",
]);
const has = (x: string) => LIST.has(x);

describe("Hunspell base words", () => {
  it("maps inflected forms to their base word", () => {
    expect(baseOf("punova", has)).toBe("punoj");
    expect(baseOf("punuar", has)).toBeTruthy();
    expect(baseOf("puno", has)).toBe("punoj"); // imperative
    expect(rootOf("malit", has)).toBe("mal");
    expect(baseOf("fushën", has)).toBe("fushë");
    expect(baseOf("lulja", has)).toBe("lule");
    expect(baseOf("besnike", has)).toBe("besnik");
    expect(baseOf("artikuj", has)).toBe("artikull");
    expect(baseOf("luajt", has)).toBe("luaj");
  });
  it("keeps real base words, including nouns in -im", () => {
    for (const w of ["punoj", "mal", "fushë", "lule", "mundshëm", "abonim", "agim", "artikull"]) expect(baseOf(w, has)).toBeNull();
  });
  it("guesses the word class only from reliable endings", () => {
    expect(guessPos("punoj", has).pos).toBe("verb");
    expect(guessPos("mundshëm", has).pos).toBe("adj");
    expect(guessPos("fushë", has)).toEqual({ pos: "noun", gender: "f" });
  });
  it("finds the base words of the sample list", () => {
    const found = findLemmas(LIST).map((l) => l.word).sort();
    expect(found).toEqual(expect.arrayContaining(["punoj", "mal", "fushë", "lule", "mundshëm", "besnik", "artikull", "abonim", "agim", "luaj"]));
    expect(found).not.toContain("punova");
    expect(found).not.toContain("malit");
  });
});
