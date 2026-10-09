# Data licence

The **code** in this repository is MIT-licensed (see `LICENSE`).

The **dictionary data** (everything under `data/`, and the generated `dist/api/` files)
is published under **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**:
https://creativecommons.org/licenses/by-sa/4.0/

**Exception:** headwords marked `"unverified": true` come only from the Albanian Hunspell
spell-checking list by Luan Kelmendi. They keep that list's licence, **GPL-2.0-or-later**:
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
Each of these words says so in its `licence` field in the API and on its page. They are kept
as separate records: no Hunspell data is merged into the CC BY-SA entries.

It is built from:

| Source | Licence | What is used |
|---|---|---|
| Wiktionary (English edition), Albanian entries, via kaikki.org | CC BY-SA 4.0 / GFDL | headwords, English meanings, inflection tables, IPA, examples, etymology, Gheg/Tosk forms |
| Wikidata Lexemes (Albanian) | CC0 1.0 | headwords, word class, short glosses |
| Wikifjalor (Albanian Wiktionary), community-written pages only | CC BY-SA 4.0 | headword, part of speech, gender |
| Hunspell sq_AL spell-checking list (Luan Kelmendi, shipped with LibreOffice) | GPL-2.0-or-later | additional headwords only (no meanings), marked unverified |
| Albanian Wikipedia (articles dump) | CC BY-SA 4.0 | word counts only (`derived/frekuenca-wikipedia.json`); no text |

Pages of Wikifjalor that reproduce the layout of the Academy of Sciences' dictionary (FGJSSH) are excluded
entirely, including their word list, because they appear to be copied from a copyrighted work.

When you reuse the data, credit **"FjaloriShqip"** and the sources above. Share your work under CC BY-SA 4.0,
and under GPL-2.0-or-later for any of the unverified Hunspell words you include.
