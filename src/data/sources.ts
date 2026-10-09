/**
 * Every source the dictionary uses, with its licence and how it is used.
 * The References page ("Burimet") and the attribution in the API/downloads
 * are generated from this list — nothing enters the dictionary without an entry here.
 */
export type SourceId = "en-wiktionary" | "wikidata" | "sq-wiktionary";

export interface SourceInfo {
  id: SourceId;
  name: string;
  publisher: string;
  url: string;
  downloadUrl?: string;
  licence: string;
  licenceUrl: string;
  /** What we take from it (Albanian / English). */
  usedFor: { sq: string; en: string };
  /** What we deliberately do NOT take, and why. */
  notUsed?: { sq: string; en: string };
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  "en-wiktionary": {
    id: "en-wiktionary",
    name: "Wiktionary (English edition), Albanian entries",
    publisher: "Wikimedia Foundation & Wiktionary contributors; extracted by kaikki.org (wiktextract, T. Ylonen)",
    url: "https://en.wiktionary.org/wiki/Category:Albanian_language",
    downloadUrl: "https://kaikki.org/dictionary/Albanian/kaikki.org-dictionary-Albanian.jsonl",
    licence: "CC BY-SA 4.0 (and GFDL)",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Fjalët, kuptimet në anglisht, format e lakimit dhe zgjedhimit, shqiptimi (IPA), shembujt, prejardhja dhe format gege të shënuara.",
      en: "Headwords, English meanings, inflection and conjugation tables, pronunciation (IPA), examples, etymology and forms marked as Gheg.",
    },
  },
  wikidata: {
    id: "wikidata",
    name: "Wikidata Lexemes (Albanian)",
    publisher: "Wikimedia Foundation & Wikidata contributors",
    url: "https://www.wikidata.org/wiki/Wikidata:Lexicographical_data",
    licence: "CC0 1.0 (public domain)",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    usedFor: {
      sq: "Fjalët, kategoria gramatikore dhe kuptimet e shkurtra (në anglisht dhe shqip).",
      en: "Headwords, word class and short sense glosses (English and Albanian).",
    },
  },
  "sq-wiktionary": {
    id: "sq-wiktionary",
    name: "Wikifjalor (Albanian Wiktionary), Kategoria:Shqip",
    publisher: "Wikimedia Foundation & Wikifjalor contributors",
    url: "https://sq.wiktionary.org/wiki/Kategoria:Shqip",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Vetëm nga faqet e shkruara nga komuniteti (formati ==Shqip== / ===Emër===): fjala, lloji i fjalës dhe gjinia — fakte gjuhësore.",
      en: "Only from community-written pages (==Shqip== / ===Emër=== layout): the word, part of speech and gender — linguistic facts.",
    },
    notUsed: {
      sq: "Rreth 33.000 faqe janë në formatin e Fjalorit të Akademisë (FGJSSH: fjala me shkronja të mëdha dhe shkurtimet e tij) dhe duken të kopjuara prej tij. Ato përjashtohen plotësisht, edhe vetë lista e fjalëve, sepse ai fjalor mbrohet nga e drejta e autorit dhe e drejta e bazës së të dhënave. Përkufizimet e faqeve të tjera gjithashtu nuk merren.",
      en: "About 33,000 pages follow the layout of the Academy dictionary (FGJSSH: uppercase headword and its abbreviations) and appear to be copied from it. They are excluded entirely, including the word list itself, because that dictionary is protected by copyright and database right. Definitions from the remaining pages are not used either.",
    },
  },
};
