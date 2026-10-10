/**
 * Labels shown next to words: borrowed words (with the language they come from) and
 * usage labels such as dialectal, archaic or rare, in Albanian and English.
 */

/** Languages we name as the origin of a borrowed word, with their Albanian names. */
export const LANGUAGE_SQ: Record<string, string> = {
  English: "anglishtja",
  Italian: "italishtja",
  French: "frëngjishtja",
  Latin: "latinishtja",
  "Medieval Latin": "latinishtja",
  "New Latin": "latinishtja",
  "Ottoman Turkish": "turqishtja osmane",
  Turkish: "turqishtja",
  German: "gjermanishtja",
  Greek: "greqishtja",
  "Ancient Greek": "greqishtja e vjetër",
  "Byzantine Greek": "greqishtja bizantine",
  "Serbo-Croatian": "serbokroatishtja",
  Russian: "rusishtja",
  Arabic: "arabishtja",
  Persian: "persishtja",
  Spanish: "spanjishtja",
  Aromanian: "vllahishtja",
  Venetian: "venecianishtja",
  Romanian: "rumanishtja",
  Bulgarian: "bullgarishtja",
  Macedonian: "maqedonishtja",
  "Old Church Slavonic": "sllavishtja e vjetër",
  Slavic: "sllavishtja",
};

const NAMES = Object.keys(LANGUAGE_SQ).sort((a, b) => b.length - a.length).join("|");
// "Borrowed from Italian d'accordo", "Learned borrowing from Latin abūsus", "Semi-learned borrowing from French…"
const BORROWED = new RegExp(`(?:borrowing|borrowed) from (${NAMES})\\b`, "i");
// "From Italian …" at the start: modern loans. Latin and Greek are left out here, because
// "From Latin amicus" (mik) is usually the ancient layer of Albanian, not a borrowing.
const FROM_MODERN = new RegExp(`^(?:From|Via) (English|Italian|French|Ottoman Turkish|Turkish|German|Russian|Serbo-Croatian|Spanish|Venetian|Arabic|Persian)\\b`);

/** The language a word was borrowed from, according to its etymology, or null. */
export function borrowedFrom(etymology: string | undefined): string | null {
  if (!etymology) return null;
  const m = etymology.match(BORROWED) ?? etymology.match(FROM_MODERN);
  return m ? (Object.keys(LANGUAGE_SQ).find((k) => k.toLowerCase() === m[1].toLowerCase()) ?? m[1]) : null;
}

/** Wiktionary sense tags shown as labels, with their Albanian names. */
export const TAG_SQ: Record<string, string> = {
  dialectal: "dialektore",
  regional: "krahinore",
  Gheg: "gegërisht",
  Tosk: "toskërisht",
  archaic: "arkaike",
  obsolete: "e vjetëruar",
  dated: "e vjetëruar",
  historical: "historike",
  rare: "e rrallë",
  colloquial: "bisedore",
  informal: "jozyrtare",
  slang: "zhargon",
  vulgar: "vulgare",
  derogatory: "përçmuese",
  pejorative: "përçmuese",
  offensive: "fyese",
  figuratively: "figurative",
  humorous: "humoristike",
  poetic: "poetike",
  literary: "letrare",
  formal: "zyrtare",
  "Arbëresh": "arbëresh",
  Kosovo: "Kosovë",
};

/** Labels that describe the whole word when every meaning has them. */
export const WORD_LEVEL_TAGS = ["dialectal", "regional", "archaic", "obsolete", "dated", "rare", "Gheg", "Tosk", "Arbëresh"];
