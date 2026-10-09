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

**Never used:** definitions, examples or word lists from copyrighted dictionaries, such as the Academy's *Fjalori i gjuhës shqipe* (FGJSSH), printed dictionaries or other dictionary websites. About 33,000 Wikifjalor pages copy the FGJSSH layout and are excluded completely. See [DATA-LICENSE.md](DATA-LICENSE.md).

- Code: **MIT** ([LICENSE](LICENSE))
- Data: **CC BY-SA 4.0**

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

**Test phase: Netlify.** `netlify.toml` builds everything on Netlify's free tier on every push to `main`. While `NOINDEX=1` is set, the site stays out of search engines.

**Later: GitHub Pages.** `.github/workflows/deploy-pages.yml` can publish the same site on GitHub Pages. It is manual for now; see the comments in the file.

`.github/workflows/ci.yml` type-checks and tests every push.

The only cost is an optional custom domain (~€10–15 per year).

## Roadmap

1. ✅ Dictionary from open sources, static API, references page
2. ⏳ Word suggestions and voting by visitors (no accounts), reviewed by the maintainer
3. ⏳ More Gheg sources, once their licences are confirmed
4. ⏳ Later: Albanian names, history and culture sections; the Fjale Shqipe research tools

## Disclaimer

This is not the official dictionary of the Academy of Sciences of Albania. For the official standard, see the Academy's publications.
