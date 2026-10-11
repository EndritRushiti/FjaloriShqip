# FjaloriShqip

**Fjalori i hapur i gjuhës shqipe — the open dictionary of the Albanian language.**

A free, open-source Albanian dictionary with a free JSON API, built **only from openly licensed sources**.

- **Search** in Albanian or English (works without ë/ç, finds inflected forms: *punova → punoj*)
- **Meanings in English**, examples, pronunciation (IPA), etymology
- **Full verb conjugations and noun declensions**
- **Gheg and Tosk forms** where the sources document them
- **Word of the day** and **word of the hour**
- **Static JSON API**: no key, no sign-up
- **References page** (`/burimet/`) listing every source, its licence and retrieval date; every word page links to its sources

Interface: Albanian first, English second (switch in the header).

## Data and licences

| Source | Licence | Used for |
|---|---|---|
| [Wiktionary](https://en.wiktionary.org/wiki/Category:Albanian_language) (via [kaikki.org](https://kaikki.org/dictionary/Albanian/)) | CC BY-SA 4.0 | words, English meanings, forms, IPA, examples, Gheg/Tosk forms |
| [Wikidata Lexemes](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data) | CC0 | words, word class, short glosses |
| [Wikifjalor](https://sq.wiktionary.org/wiki/Kategoria:Shqip) (community-written pages only) | CC BY-SA 4.0 | word, part of speech, gender |
| [Hunspell sq_AL](https://github.com/LibreOffice/dictionaries/tree/master/sq_AL) (Luan Kelmendi) | GPL-2.0-or-later | extra headwords without meanings, marked *unverified* |
| [Wikipedia shqip](https://sq.wikipedia.org/) | CC BY-SA 4.0 | word counts only (how common a word is) |
| [Wiktionary, 18 other editions](https://kaikki.org/dictionary/rawdata.html) (via kaikki.org) | CC BY-SA 4.0 | more Albanian words; English translation tables give English meanings |
| [Albanet](https://github.com/omwn/omw-data/tree/main/wns/als) (Albanian WordNet) | CC BY 3.0 | words and same-meaning groups (not its definitions) |
| [MaCoCu Albanian web corpus](http://hdl.handle.net/11356/1804) | CC0 | word counts only (confirms new words are in use) |

**Never used:** definitions, examples or word lists from copyrighted dictionaries, such as the Academy's *Fjalori i gjuhës shqipe* (FGJSSH), printed dictionaries or other dictionary websites. About 33,000 Wikifjalor pages copy the FGJSSH layout and are excluded completely. See [DATA-LICENSE.md](DATA-LICENSE.md).

- Code: **MIT** ([LICENSE](LICENSE))
- Data: **CC BY-SA 4.0**; the unverified Hunspell words: **GPL-2.0-or-later**

### Extra words from the spell-checking list

`scripts/lib/hunspell-lemmas.ts` finds base words in the Hunspell list, which mostly spells out
inflected forms (*punoj, punon, punova…*). A word counts as a base word unless suffix rules explain it
as a form of another listed word. A new word is only added when it, or one of its forms, appears in
Albanian Wikipedia. Measured on the words we already know, about 92% of these are real base words.

Word counts are made occasionally on a developer machine; the 160 MB dump is not needed for the build:

```bash
# word counts (into derived/)
bzip2 -dc sources/sqwiki-latest-pages-articles.xml.bz2 | npx tsx scripts/word-frequency.ts wikipedia
unzip -p sources/MaCoCu-sq-1.0.xml.zip | npx tsx scripts/word-frequency.ts macocu
# Albanian parts of Wiktionary (English: ~3 GB download, streamed)
curl -sL https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz | gzip -dc | npx tsx scripts/extract-wiktionary.ts en
curl -sL https://kaikki.org/dictionary/downloads/fr/fr-extract.jsonl.gz | gzip -dc | npx tsx scripts/extract-wiktionary.ts fr
# Albanet + Princeton WordNet
npx tsx scripts/extract-albanet.ts
```

Every new word goes through `scripts/lib/dedupe.ts`. It is rejected when it is an existing headword, a known
inflected or dialect form, the same word written without ë/ç, or an inflected form of a known word.

## API

All endpoints are static JSON files:

| Endpoint | Content |
|---|---|
| `GET /api/v1/fjala/{word}.json` | one word: meanings, forms, dialect forms, sources |
| `GET /api/v1/fjalet.json` | all headwords |
| `GET /api/v1/kerko.json` | search index `[word, folded key, part of speech, short meaning]` |
| `GET /api/v1/format/{letter}.json` | inflected/dialect form → headword |
| `GET /api/v1/statistika.json` | counts and data version |

## Running it locally

Requires Node.js 22+.

```bash
npm install
npm run sources   # download the open sources into ./sources (once; ~80 MB)
npm run data      # merge them into data/fjalori.json
npm run build     # generate the website + API into ./dist
npm run serve     # preview at http://localhost:4321
npm test
```

## Hosting (free)

**Cloudflare (R2 + Worker).** `.github/workflows/deploy-cloudflare.yml` builds everything on every push to `main` (and every Monday), uploads only the changed files of `dist/` to the R2 bucket `fjalorishqip`, and deploys the Worker in `src/worker/` (config: `wrangler.toml`), which serves the files. R2 has no limit on the number of files, so the site can keep growing. The workflow needs four repository secrets, listed at the top of the file. The site is public and indexed; setting `NOINDEX` to "1" (in `wrangler.toml` and the workflow) would keep it out of search engines again.

The site is served at **https://fjalorishqip.org** (registered at GoDaddy, DNS on Cloudflare); `www.fjalorishqip.org` redirects there.

**Staying free.** `.github/workflows/usage-guard.yml` checks the month's R2 usage every day: at 80% of a free allowance the run fails (GitHub sends an email), at 95% a small offline Worker is put in front of the site (it reads nothing from R2), and deploys stop until the next month. The Worker itself is on the free plan, which errors instead of billing when its daily request limit is reached.

`.github/workflows/ci.yml` type-checks and tests every push.

The only cost is the domain (~€10–15 per year).

## Roadmap

1. ✅ Dictionary from open sources, static API, references page
2. ⏳ Word suggestions and voting by visitors (no accounts), reviewed by the maintainer
3. ⏳ More Gheg sources, once their licences are confirmed
4. ⏳ Later: Albanian names, history and culture sections; the Fjale Shqipe research tools

## Disclaimer

This is not the official dictionary of the Academy of Sciences of Albania. For the official standard, see the Academy's publications.
