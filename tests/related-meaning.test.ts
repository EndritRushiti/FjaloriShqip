import { describe, expect, it } from "vitest";
import type { Word } from "../src/data/model.js";
import { regularDerivation, relatedMeaning } from "../scripts/lib/related-meaning.js";

const word = (w: string, en: string, sq: string) =>
  ({ word: w, description: { text: sq }, entries: [{ pos: "noun", senses: [{ lang: "en", gloss: en, source: "editor" }] }] }) as unknown as Word;

describe("relatedMeaning", () => {
  it("leaves out a word that only looks like the base", () => {
    expect(relatedMeaning(word("aspirator", "vacuum cleaner; aspirator", "Fshesë me korrent, pajisje thithëse."), word("aspiratë", "aspiration", "Synim."))).toBe(false);
  });
  it("keeps a word that shares the meaning", () => {
    expect(relatedMeaning(word("punëtor", "worker", "Njeri që punon."), word("punë", "work; job", "Veprimtari."))).toBe(true);
  });
  it("keeps regular derivations without comparing meanings", () => {
    expect(regularDerivation("moskuptim", "kuptim")).toBe(true);
    expect(regularDerivation("ekzaminim", "ekzaminoj")).toBe(true);
    expect(regularDerivation("dëshmitar", "dëshmi")).toBe(true);
    expect(regularDerivation("aspirator", "aspiratë")).toBe(false);
  });
});
