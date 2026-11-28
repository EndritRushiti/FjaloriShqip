<div align="center">

# FjaloriShqip

**Fjalori i hapur i gjuhës shqipe · The open dictionary of the Albanian language**

[fjalorishqip.org](https://fjalorishqip.org) · [API](https://fjalorishqip.org/api/) · [Burimet / Sources](https://fjalorishqip.org/burimet/)

![Fjalë](https://img.shields.io/badge/fjal%C3%AB-130%2C000%2B-c8102e) ![Dialekte](https://img.shields.io/badge/dialekte-geg%C3%AB%20%C2%B7%20tosk%C3%AB%20%C2%B7%20arb%C3%ABreshe%20%C2%B7%20arvanitase-6b5b95) ![API](https://img.shields.io/badge/API-JSON%20falas%2C%20pa%20%C3%A7el%C3%ABs-2e7d32) ![Të dhënat](https://img.shields.io/badge/t%C3%AB%20dh%C3%ABnat-CC%20BY--SA%204.0-blue) ![Kodi](https://img.shields.io/badge/kodi-MIT-lightgrey)

**[Shqip](#shqip) · [English](#english) · [API](#api)**

</div>

---

## Shqip

**FjaloriShqip** është një fjalor falas dhe i hapur që synon të ruajë **çdo fjalë shqipe, në çdo dialekt**, që asnjë të mos humbasë. Përfshin gjuhën standarde, gegërishten, toskërishten, arbërishten e Italisë, arvanitishten e Greqisë dhe fjalët e vjetra që gjenden vetëm në libra, deri te Buzuku (1555).

- **Mbi 130 000 fjalë**, secila me **përshkrimin e vet në shqip**, të shkruar nga projekti
- **Mbi 33 000 forma dialektore**, secila e lidhur me fjalën standarde
- **Harta e fjalës** tregon ku thuhet çdo formë, sipas burimeve
- **Zgjedhimi dhe lakimi** i plotë i foljeve dhe emrave
- **Kërkimi** gjen fjalën edhe pa ë e ç, edhe nga një formë e saj (*punova → punoj*)
- **Librat e vjetër**, me vitin, ku është shkruar fjala ose një formë e saj
- **API falas në JSON**, pa çelës dhe pa llogari
- Anglishtja jepet vetëm si ndihmë

### Si ta përdorni

- **Në faqe:** [fjalorishqip.org](https://fjalorishqip.org)
- **Në projektin tuaj:** me [API-në](#api) falas. Lejohet përdorimi edhe tregtar, sipas licencës CC BY-SA 4.0, duke përmendur FjaloriShqip.
- **Keni gjetur një gabim?** Te faqja e fjalës, «Si e thua ti?» dhe pastaj «Ka një gabim në këtë fjalë?», ose [formulari i kontaktit](https://fjalorishqip.org/rreth/#kontakt).
- **E thoni ndryshe në vendin tuaj?** Shtojeni me «Si e thua ti?». Format që i japin disa folës shtohen në fjalor.

Nëse e përdorni FjaloriShqip në një projekt, na tregoni. Do të na gëzonte ta përmendim.

---

## English

**FjaloriShqip** is a free and open dictionary whose aim is to keep **every Albanian word, in every dialect**, so that none is lost: the standard language, Gheg, Tosk, Arbëresh (Italy), Arvanitika (Greece) and old words found only in books, back to Buzuku (1555).

- **Over 130,000 words**, each with **its own description in Albanian**, written by the project
- **Over 33,000 dialect forms**, each linked to its standard word
- **A word map** showing where each form is said, according to the sources
- **Full verb conjugations and noun declensions**
- **Search** that works without ë and ç and finds a word from any of its forms (*punova → punoj*), in Albanian or English
- **Old books**, with their year, in which a word or one of its forms was written
- **A free JSON API**, no key and no sign-up
- The interface is Albanian first, English second. English meanings are a help, not the goal: this is not an Albanian–English dictionary.

### How to use it

- **On the web:** [fjalorishqip.org](https://fjalorishqip.org)
- **In your project:** through the free [API](#api). Commercial use is allowed under CC BY-SA 4.0, with credit to FjaloriShqip.
- **Found a mistake?** On the word's page, «Si e thua ti?» and then «Ka një gabim në këtë fjalë?», or the [contact form](https://fjalorishqip.org/rreth/#kontakt).

If you use FjaloriShqip in a project, let us know. We would be glad to mention it.

---

## API

Static JSON files. No key, no account, CORS open to every site (`Access-Control-Allow-Origin: *`). Documentation in Albanian and English: [fjalorishqip.org/api](https://fjalorishqip.org/api/).

| Endpoint | Përmbajtja · Content |
|---|---|
| `GET /api/v1/fjala/{fjala}.json` | Një fjalë me të gjitha të dhënat · One word with all its data: Albanian description, meanings, forms, dialect forms, examples, sources, licence |
| `GET /api/v1/fjalet.json` | Të gjitha fjalët · Every headword |
| `GET /api/v1/kerko.json` | Treguesi i kërkimit · Search index `[word, folded key, word class, short meaning, …]` |
| `GET /api/v1/format/{shkronja}.json` | Forma → fjala · Inflected or dialect form → headword, by first letter |
| `GET /api/v1/dialekte.json` | Format gege, toske, arbëreshe, arvanitase me fjalën standarde · Dialect forms with their standard word |
| `GET /api/v1/statistika.json` | Numrat dhe data e të dhënave · Counts and data date |

In the address, the word is written as it is (with ë and ç, URL-encoded), and a space becomes `_`.

```bash
curl https://fjalorishqip.org/api/v1/fjala/k%C3%ABmb%C3%AB.json
```

```js
// JavaScript (browser or Node.js 18+)
const word = "këmbë";
const res = await fetch(`https://fjalorishqip.org/api/v1/fjala/${encodeURIComponent(word.replace(/ /g, "_"))}.json`);
const w = await res.json();
console.log(w.description.text);                                   // "Gjymtyra e trupit me të cilën ecim. …"
console.log(w.dialects.filter((d) => d.dialect === "gheg").map((d) => d.form)); // ["kâmbë", "kambë", …]
```

```python
# Python
import requests, urllib.parse
word = "këmbë"
w = requests.get("https://fjalorishqip.org/api/v1/fjala/" + urllib.parse.quote(word.replace(" ", "_")) + ".json").json()
print(w["description"]["text"])
```

Finding the headword of any form (*kambën*, *punova*): read `/api/v1/format/{first letter}.json`, then the word's own file.

Please cache what you use and do not send many requests at once. The data is the same for everyone and changes about once a week.

---

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
| [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR | example sentences with English translation, reviewed one by one (author of each in `shembuj/tatoeba.tsv`) |
| [HPLT](https://hplt-project.org/) Albanian web corpus | CC0 | word counts only (confirms words and regular Gheg forms are in use) |
| [EuroVoc](https://op.europa.eu/en/web/eu-vocabularies/eurovoc) (Albanian) | free reuse with acknowledgement (Decision 2011/833/EU) | about 100 single-word terms, described by us |
| Public-domain books: Bardhi 1635, Hahn 1854, Rossi 1875, Dozon 1879, Meyer 1891, Jungg 1895, Kristoforidhi 1904, Gazulli 1942 and others (scans on archive.org) | public domain | old, regional and dialect words, converted to today's spelling; meanings translated, descriptions our own |
| Stuart E. Mann, *An Historical Albanian-English Dictionary* (1948) | words and facts only | old, regional and dialect words with word class, dialect and standard word; its definitions, examples and etymologies are not copied |

The full list, with every source's licence and date, is on [fjalorishqip.org/burimet](https://fjalorishqip.org/burimet/).

**Never copied:** definitions, examples or structure from copyrighted dictionaries, such as the Academy's *Fjalori i gjuhës shqipe* (FGJSSH). Every Albanian description is written by the project. About 33,000 Wikifjalor pages copy the FGJSSH layout and are excluded completely. See [DATA-LICENSE.md](DATA-LICENSE.md).

- Code: **MIT** ([LICENSE](LICENSE))
- Data: **CC BY-SA 4.0**; the unverified Hunspell words: **GPL-2.0-or-later**

---

## For developers

Requires Node.js 22+.

```bash
npm install
npm run sources   # download the open sources into ./sources (once; ~80 MB)
npm run data      # merge them into data/fjalori.json
npm run build     # generate the website and the API into ./dist
npm run serve     # preview at http://localhost:4321
npm test
```

Every new word goes through `scripts/lib/dedupe.ts`. It is rejected when it is an existing headword, a known inflected or dialect form, the same word written without ë/ç, or an inflected form of a known word. `scripts/quality-check.ts` checks the whole dictionary before every deploy.

---

## Disclaimer · Shënim

FjaloriShqip is not the official dictionary of the Academy of Sciences of Albania. For the official standard, see the Academy's publications.

FjaloriShqip nuk është fjalori zyrtar i Akademisë së Shkencave të Shqipërisë. Për normën zyrtare, shihni botimet e Akademisë.
