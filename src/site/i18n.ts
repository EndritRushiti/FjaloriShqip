/**
 * Interface texts. Albanian first, English second: both are rendered and the
 * language switch only toggles visibility (no server, no rebuild).
 */
export const UI = {
  siteName: { sq: "FjaloriShqip", en: "FjaloriShqip" },
  tagline: { sq: "Fjalori i hapur i gjuhës shqipe", en: "The open dictionary of the Albanian language" },
  home: { sq: "Kryefaqja", en: "Home" },
  browse: { sq: "Shfleto", en: "Browse" },
  api: { sq: "API", en: "API" },
  sources: { sq: "Burimet", en: "Sources" },
  about: { sq: "Rreth nesh", en: "About" },
  searchPlaceholder: { sq: "Kërko një fjalë shqip ose anglisht…", en: "Search an Albanian or English word…" },
  wordOfDay: { sq: "Fjala e ditës", en: "Word of the day" },
  wordOfHour: { sq: "Fjala e orës", en: "Word of the hour" },
  randomWord: { sq: "Fjalë e rastësishme", en: "Random word" },
  words: { sq: "fjalë", en: "words" },
  meanings: { sq: "Kuptimi", en: "Meaning" },
  inEnglish: { sq: "anglisht", en: "English" },
  inAlbanian: { sq: "shqip", en: "Albanian" },
  examples: { sq: "Shembuj", en: "Examples" },
  pronunciation: { sq: "Shqiptimi", en: "Pronunciation" },
  etymology: { sq: "Prejardhja (anglisht)", en: "Etymology" },
  dialects: { sq: "Format dialektore", en: "Dialect forms" },
  gheg: { sq: "Gegërisht", en: "Gheg" },
  tosk: { sq: "Toskërisht", en: "Tosk" },
  inflection: { sq: "Format e fjalës", en: "Word forms" },
  allForms: { sq: "Të gjitha format", en: "All forms" },
  source: { sq: "Burimi", en: "Source" },
  noMeaningYet: { sq: "Kjo fjalë nuk ka ende kuptim në anglisht në burimet e hapura.", en: "This word does not yet have an English meaning in the open sources." },
  variantOf: { sq: "është formë", en: "is a form" },
  of: { sq: "e fjalës", en: "of" },
  letter: { sq: "Shkronja", en: "Letter" },
  page: { sq: "Faqja", en: "Page" },
  notFound: { sq: "Fjala nuk u gjet", en: "Word not found" },
  formOf: { sq: "formë e", en: "form of" },
  licenceNote: { sq: "Të dhënat: CC BY-SA 4.0 (fjalët pa kuptim: GPL-2.0+) · Kodi: MIT", en: "Data: CC BY-SA 4.0 (words without meaning: GPL-2.0+) · Code: MIT" },
  stats: { sq: "Fjalori sot", en: "The dictionary today" },
} as const;

export type UIKey = keyof typeof UI;

/** Bilingual inline text: Albanian visible by default, English when the switch is on. */
export function t(key: UIKey): string {
  return bi(UI[key].sq, UI[key].en);
}

export function bi(sq: string, en: string): string {
  return sq === en ? escapeHtml(sq) : `<span data-ui="sq">${escapeHtml(sq)}</span><span data-ui="en">${escapeHtml(en)}</span>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
