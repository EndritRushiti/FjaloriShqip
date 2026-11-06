/**
 * Every source the dictionary uses, with its licence and how it is used.
 * The References page ("Burimet") and the attribution in the API/downloads
 * are generated from this list — nothing enters the dictionary without an entry here.
 */
export type SourceId = "en-wiktionary" | "wikidata" | "sq-wiktionary" | "hunspell-sq" | "wikipedia-sq" | "wiktionary-other" | "albanet" | "macocu" | "auto" | "editor" | "ai" | "meyer-1891" | "jungg-1895" | "rossi-1875" | "tatoeba" | "kristoforidhi-1904" | "gazulli-1942" | "dozon-1879" | "hplt" | "korpus-gege" | "eurovoc" | "mann-1948" | "hahn-1854" | "folesit" | "uniparser" | "xylander-1835" | "voskopojari-1802" | "bashkimi-1908" | "reinhold-1855" | "busetti-1911" | "weigand-1914" | "meyer-1896" | "leake-1814" | "fiorilli-2002" | "gallo-sanmarzano" | "molise-arberesh" | "ndreca-1972" | "dhora" | "revistat-krahinat" | "bufli-rocchi-2021" | "morina-juridik" | "si-e-thua" | "studime-arberesh" | "letersia-gege" | "mitko-1878" | "rregull-gege" | "studime-dialektore";

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
      sq: "Vetëm nga faqet e shkruara nga komuniteti (formati ==Shqip== / ===Emër===). Merren vetëm fjala, lloji i fjalës dhe gjinia, që janë fakte gjuhësore.",
      en: "Only from community-written pages (==Shqip== / ===Emër=== layout): the word, part of speech and gender — linguistic facts.",
    },
    notUsed: {
      sq: "Rreth 33.000 faqe janë në formatin e Fjalorit të Akademisë (FGJSSH, me fjalën me shkronja të mëdha dhe shkurtimet e tij) dhe duken të kopjuara prej tij. Ato përjashtohen plotësisht, edhe vetë lista e fjalëve, sepse ai fjalor mbrohet nga e drejta e autorit dhe e drejta e bazës së të dhënave. Përkufizimet e faqeve të tjera gjithashtu nuk merren.",
      en: "About 33,000 pages follow the layout of the Academy dictionary (FGJSSH: uppercase headword and its abbreviations) and appear to be copied from it. They are excluded entirely, including the word list itself, because that dictionary is protected by copyright and database right. Definitions from the remaining pages are not used either.",
    },
  },
  "hunspell-sq": {
    id: "hunspell-sq",
    name: "Fjalori drejtshkrimor shqip për Hunspell (sq_AL)",
    publisher: "Luan Kelmendi; shpërndarë me LibreOffice",
    url: "https://github.com/LibreOffice/dictionaries/tree/master/sq_AL",
    downloadUrl: "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/sq_AL/sq_AL.dic",
    licence: "GPL-2.0-or-later",
    licenceUrl: "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
    usedFor: {
      sq: "Vetëm lista e fjalëve, fjalë bazë që nuk ishin në burimet e tjera, të gjetura automatikisht ndër format e listës drejtshkrimore, me llojin e fjalës kur mund të përcaktohet nga mbaresa. Këto fjalë nuk kanë ende kuptim dhe shënohen si të paverifikuara. Ato janë me licencën GPL-2.0 ose më të re (jo CC BY-SA) dhe çdo fjalë e tillë e tregon këtë.",
      en: "The word list only: base words that were missing from the other sources, found automatically among the forms of the spell-checking list, with the word class when the ending shows it. These words have no meaning yet and are marked as unverified. They are licensed GPL-2.0-or-later (not CC BY-SA), and every such word says so.",
    },
    notUsed: {
      sq: "Fjalët që shfaqen vetëm në listë por asnjëherë në Wikipedia nuk shtohen ende, sepse shpesh janë forma të lakuara dhe jo fjalë bazë.",
      en: "Words that appear in the list but never in Wikipedia are not added yet, because they are often inflected forms rather than base words.",
    },
  },
  "wikipedia-sq": {
    id: "wikipedia-sq",
    name: "Wikipedia shqip (sq.wikipedia.org)",
    publisher: "Wikimedia Foundation & Wikipedia contributors",
    url: "https://sq.wikipedia.org/",
    downloadUrl: "https://dumps.wikimedia.org/sqwiki/latest/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Vetëm numërimi i fjalëve, sa herë shfaqet çdo fjalë (me format e saj) në artikuj. Përdoret për të renditur fjalët nga më të përdorurat dhe për të konfirmuar se një fjalë e re përdoret realisht. Nuk kopjohet asnjë tekst.",
      en: "Word counts only: how often each word (with its forms) appears in the articles. Used to rank words from most to least used and to confirm that a new word is really in use. No text is copied.",
    },
  },
  "wiktionary-other": {
    id: "wiktionary-other",
    name: "Wiktionary in other languages (French, German, Russian, Polish, Greek, Italian and 13 more editions)",
    publisher: "Wikimedia Foundation & Wiktionary contributors; extracted by kaikki.org (wiktextract)",
    url: "https://kaikki.org/dictionary/rawdata.html",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Fjalë shqipe që mungonin në burimet e tjera, hyrjet shqipe të këtyre botimeve dhe përkthimet në shqip. Një fjalë shtohet vetëm kur përdoret në Wikipedia ose MaCoCu, ose kur e dëshmojnë të paktën dy botime.",
      en: "Albanian words missing from the other sources: the Albanian entries of these editions and their translations into Albanian. A word is added only when it is used in Wikipedia or MaCoCu, or attested by at least two editions.",
    },
    notUsed: {
      sq: "Kuptimet në frëngjisht, gjermanisht etj. nuk shfaqen, fjalët pa kuptim anglisht e tregojnë këtë.",
      en: "Meanings written in French, German etc. are not shown; words without an English meaning say so.",
    },
  },
  albanet: {
    id: "albanet",
    name: "Albanet: Albanian WordNet (Ervin Ruci), via the Open Multilingual Wordnet",
    publisher: "Ervin Ruci / University of Vlora; Open Multilingual Wordnet; English words from Princeton WordNet 3.0",
    url: "https://github.com/omwn/omw-data/tree/main/wns/als",
    licence: "CC BY 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
    usedFor: {
      sq: "Fjalë të reja (vetëm kur janë në listën drejtshkrimore ose në Wikipedia) dhe grupet e fjalëve me të njëjtin kuptim, me fjalët angleze të çdo grupi (Princeton WordNet) si kuptim.",
      en: "New words (only when they are in the spell-checking list or in Wikipedia) and its groups of words with the same meaning, with each group's English words (Princeton WordNet) as the meaning.",
    },
    notUsed: {
      sq: "Përkufizimet shqip të Albanet nuk përdoren, sepse disa përsërisin fjalë për fjalë formulimet e Fjalorit të Akademisë (FGJSSH). Fjalët angleze të mbetura pa përkthim në Albanet (p.sh. pixel, jeep) përjashtohen.",
      en: "Albanet's Albanian definitions are not used, because some repeat the wording of the Academy dictionary (FGJSSH) word for word. English words left untranslated in Albanet (e.g. pixel, jeep) are excluded.",
    },
  },
  macocu: {
    id: "macocu",
    name: "MaCoCu Albanian web corpus 1.0 (528 million words)",
    publisher: "MaCoCu project; CLARIN.SI repository (handle 11356/1804)",
    url: "http://hdl.handle.net/11356/1804",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    usedFor: {
      sq: "Vetëm numërimi i fjalëve në paragrafët me cilësi të mirë, për të konfirmuar se një fjalë e re përdoret dhe për të treguar sa e zakonshme është. Nuk kopjohet asnjë tekst.",
      en: "Word counts only, from paragraphs marked good quality: to confirm that a new word is in use and to show how common it is. No text is copied.",
    },
  },
  auto: {
    id: "auto",
    name: "FjaloriShqip: kuptime të përafërta automatike / approximate meanings",
    publisher: "FjaloriShqip, nga kuptimet e fjalëve të tjera të këtij fjalori",
    url: "https://github.com/EndritRushiti/FjaloriShqip/blob/main/scripts/lib/derive-meaning.ts",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Për fjalët pa kuptim, një kuptim i përafërt i nxjerrë nga fjala bazë (rindërtim ← rindërtoj \"to rebuild\"), nga pjesët e fjalës së përbërë (kryeredaktor = krye + redaktor) ose nga fjala ndërkombëtare në anglisht (humanitet → humanity). Shënohet gjithmonë si \"i përafërt\".",
      en: "For words without a meaning: an approximate meaning worked out from the base word (rindërtim ← rindërtoj \"to rebuild\"), from the parts of a compound (kryeredaktor = krye + redaktor) or from the English international word (humanitet → humanity). Always marked \"approximate\".",
    },
  },
  editor: {
    id: "editor",
    name: "Redaktorët e FjaloriShqip / FjaloriShqip editors",
    publisher: "FjaloriShqip",
    url: "https://github.com/EndritRushiti/FjaloriShqip/blob/main/korrigjime/shto.txt",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Fjalë dhe kuptime të shtuara ose të korrigjuara nga redaktorët e fjalorit (korrigjime/shto.txt), p.sh. fjalë shqipe që mungonin në burimet e hapura.",
      en: "Words and meanings added or corrected by the dictionary's editors (korrigjime/shto.txt), e.g. Albanian words missing from the open sources.",
    },
  },
  ai: {
    id: "ai",
    name: "Përshkrime shqip me ndihmë të AI-së / Albanian descriptions written with AI help",
    publisher: "FjaloriShqip; shkruar me ndihmën e Claude (Anthropic), duke u nisur nga kuptimet e burimeve të hapura",
    url: "https://github.com/EndritRushiti/FjaloriShqip/blob/main/pershkrime/pershkrime.tsv",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Përshkrime të shkurtra shqip të fjalëve, të shkruara me ndihmën e inteligjencës artificiale mbi bazën e kuptimeve që kemi nga burimet e hapura. Nuk janë marrë nga asnjë fjalor tjetër. Shënohen si të tilla derisa t'i rishikojë redaktori.",
      en: "Short Albanian descriptions of words, written with the help of artificial intelligence on the basis of the meanings we have from the open sources. They are not taken from any other dictionary. They are marked as such until an editor reviews them.",
    },
  },
  "meyer-1891": {
    id: "meyer-1891",
    name: "Gustav Meyer, Etymologisches Wörterbuch der albanesischen Sprache (Strassburg 1891)",
    publisher: "Gustav Meyer (1850–1900); K. J. Trübner, Strassburg. Skanuar nga Google Books, në Internet Archive",
    url: "https://archive.org/details/etymologischesw00meyegoog",
    downloadUrl: "https://archive.org/details/etymologischesw01meyegoog",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Format arbëreshe (në Itali, Kalabri, Siçili, nga Rada, Camarda, Santori, Schirò etj.) dhe arvanitase (në Greqi, Hidra, Poros, Salaminë etj., kryesisht nga Reinhold) që Meyer i shënon me burimin e tyre. Fjalët i kthejmë nga shkrimi fonetik i Meyer-it në drejtshkrimin e sotëm (ε → ë, š → sh, l → ll, l' → l…) dhe kuptimet i përkthejmë nga gjermanishtja në anglisht. Faqja e librit për çdo formë ruhet te skedari dialekte/meyer-1891.tsv. Vepra është në domen publik (autori vdiq më 1900).",
      en: "Arbëresh (Italy: Calabria, Sicily; from Rada, Camarda, Santori, Schirò etc.) and Arvanitika (Greece: Hydra, Poros, Salamis etc., mostly from Reinhold) forms that Meyer marks with their source. We convert the words from Meyer's phonetic spelling into today's spelling (ε → ë, š → sh, l → ll, l' → l…) and translate the meanings from German into English. The page of the book for each form is kept in the file dialekte/meyer-1891.tsv. The work is in the public domain (the author died in 1900).",
    },
    notUsed: {
      sq: "Etimologjitë dhe krahasimet me gjuhët e tjera nuk merren.",
      en: "The etymologies and comparisons with other languages are not used.",
    },
  },
  "rossi-1875": {
    id: "rossi-1875",
    name: "Francesco Rossi da Montalto, Vocabolario epirotico-italiano (Romë 1875)",
    publisher: "Francesco Rossi da Montalto, Propaganda Fide, Romë. Skanuar në Internet Archive",
    url: "https://archive.org/details/rossi-vocabolario-italiano-epirotico-epirotico-italiano",
    downloadUrl: "https://archive.org/details/rossi-vocabolario-italiano-epirotico-epirotico-italiano",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Disa forma gege që ndryshojnë nga gjuha standarde, secila e lidhur me fjalën standarde përkatëse, fjalët kthehen nga drejtshkrimi i vjetër në atë të sotëm dhe kuptimet përkthehen nga italishtja. Vepra është në domen publik.",
      en: "A few Gheg forms that differ from the standard language, each linked to its standard word; the words are converted from the old spelling into today's and the meanings translated from Italian. The work is in the public domain.",
    },
    notUsed: {
      sq: "Fjalët e njëjta me gjuhën standarde, fjalët e huaja italiane dhe kuptimet italisht nuk merren.",
      en: "Words identical to the standard language, Italian loanwords and the Italian meanings are not used.",
    },
  },
  "jungg-1895": {
    id: "jungg-1895",
    name: "Jak Jungg, Fialuur i voghel scc'ip e ltinisct (Shkodër 1895)",
    publisher: "P. Jak Jungg (1840–1927), Shkodër. Skanuar nga Google Books, në Internet Archive",
    url: "https://archive.org/details/fialuurivoghels00junkgoog",
    downloadUrl: "https://archive.org/details/fialuurivoghels00junggoog",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Format gege të Shkodrës që ndryshojnë nga gjuha standarde, secila e lidhur me fjalën standarde përkatëse. Fjalët i kthejmë nga drejtshkrimi i vjetër i Jungg-ut në atë të sotëm (sc → sh, ł → ll, gn → nj, c(i) → ç…) dhe kuptimet i përkthejmë nga italishtja në anglisht. Vepra është në domen publik (autori vdiq më 1927).",
      en: "Gheg forms of Shkodër that differ from the standard language, each linked to its standard word. We convert the words from Jungg's old spelling into today's (sc → sh, ł → ll, gn → nj, c(i) → ç…) and translate the meanings from Italian into English. The work is in the public domain (the author died in 1927).",
    },
    notUsed: {
      sq: "Fjalët e njëjta me gjuhën standarde dhe kuptimet italisht nuk merren.",
      en: "Words identical to the standard language and the Italian meanings are not used.",
    },
  },
  tatoeba: {
    id: "tatoeba",
    name: "Tatoeba, Albanian sentences with English translations",
    publisher: "Tatoeba Association and the Tatoeba contributors (each sentence's author is listed in shembuj/tatoeba.tsv)",
    url: "https://tatoeba.org/",
    downloadUrl: "https://downloads.tatoeba.org/exports/per_language/sqi/",
    licence: "CC BY 2.0 FR",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0/fr/",
    usedFor: {
      sq: "Fjali shembull shqip me përkthimin anglisht, të përzgjedhura e të rishikuara një nga një, secila lidhet me faqen e saj në Tatoeba.",
      en: "Albanian example sentences with their English translation, selected and reviewed one by one; each links to its page on Tatoeba.",
    },
    notUsed: {
      sq: "Fjalitë me gabime drejtshkrimi (p.sh. pa ë), me përkthim të gabuar, fyese ose me stereotipe nuk merren.",
      en: "Sentences with spelling mistakes (e.g. without ë), wrong translations, insults or stereotypes are not used.",
    },
  },
  "kristoforidhi-1904": {
    id: "kristoforidhi-1904",
    name: "Konstantin Kristoforidhi, Lexikon tis albanikis glossis (Athinë 1904)",
    publisher: "Konstantin Kristoforidhi (1830–1895); botuar pas vdekjes nga P. D. Sakellarios, Athinë. Skanuar nga Universiteti i Vjenës (PHAIDRA), në Internet Archive",
    url: "https://archive.org/details/Lexicon-tes-albanikes-glosses-PHAIDRA_o_102835",
    downloadUrl: "https://archive.org/details/Lexicon-tes-albanikes-glosses-PHAIDRA_o_102835",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Fjalë e forma gege e toske, të kthyera nga alfabeti i Kristoforidhit me shkronja greke në drejtshkrimin e sotëm, kuptimet të përkthyera nga greqishtja. Përshkrimet shqip janë tonat. Vepra është në domen publik (autori vdiq më 1895).",
      en: "Gheg and Tosk words and forms, converted from Kristoforidhi's Greek-letter alphabet to today's spelling; meanings translated from Greek. The Albanian descriptions are our own. The work is in the public domain (the author died in 1895).",
    },
    notUsed: {
      sq: "Skanimi dhe teksti grek nuk ribotohen, merren vetëm fjalët dhe kuptimet.",
      en: "The scan and the Greek text are not republished; only the words and their meanings are taken.",
    },
  },
  "gazulli-1942": {
    id: "gazulli-1942",
    name: "Nikollë Gazulli, Fjalorth i ri – Fjalë të rralla të përdoruna në Veri të Shqipnis (Tiranë 1942)",
    publisher: "Dom Nikollë Gazulli (1895–1946); botuar në «Visaret e Kombit», vëll. XI. Skanim në Internet Archive",
    url: "https://archive.org/details/id-9-fjalorth-i-ri-fjale-te-rralla-te-perdoruna-ne-veri-te-shqipnis-visaret-e-kombit",
    downloadUrl: "https://archive.org/details/id-9-fjalorth-i-ri-fjale-te-rralla-te-perdoruna-ne-veri-te-shqipnis-visaret-e-kombit",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Fjalë të rralla gege nga Veriu, me vendin ku përdoren dhe fjalën standarde kur ka. Përshkrimet shqip janë tonat. Vepra është në domen publik (autori vdiq më 1946).",
      en: "Rare Gheg words from the North, with where they are used and the standard word where there is one. The Albanian descriptions are our own. The work is in the public domain (the author died in 1946).",
    },
    notUsed: {
      sq: "Përkufizimet e Gazullit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre.",
      en: "Gazulli's definitions are not copied; only the words and their meaning are taken.",
    },
  },  "dozon-1879": {
    id: "dozon-1879",
    name: "Auguste Dozon, Manuel de la langue chkipe ou albanaise (Paris 1879)",
    publisher: "Auguste Dozon (1822–1890), Paris. Skanuar nga University of Toronto, në Internet Archive",
    url: "https://archive.org/details/manueldelalangue00dozouoft",
    downloadUrl: "https://archive.org/details/manueldelalangue00dozouoft",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma toske nga fjalorthi shqip-frëngjisht i librit, secila e lidhur me fjalën standarde përkatëse. Fjalët i kthejmë nga shkrimi i Dozonit në drejtshkrimin e sotëm (œ → ë, ç → sh, ou → u, ky → q…) dhe kuptimet i përkthejmë nga frëngjishtja. Përshkrimet shqip janë tonat. Vepra është në domen publik (autori vdiq më 1890).",
      en: "Tosk forms from the book's Albanian–French vocabulary, each linked to its standard word. We convert the words from Dozon's spelling into today's (œ → ë, ç → sh, ou → u, ky → q…) and translate the meanings from French. The Albanian descriptions are our own. The work is in the public domain (the author died in 1890).",
    },
    notUsed: {
      sq: "Përkufizimet e Dozonit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre. Fjalët turke e greke të fjalorthit lihen jashtë.",
      en: "Dozon's definitions are not copied; only the words and their meaning are taken. The Turkish and Greek loans in the vocabulary are left out.",
    },
  },

  hplt: {
    id: "hplt",
    name: "HPLT v2, korpusi i pastruar shqip / cleaned Albanian web corpus",
    publisher: "High Performance Language Technologies (HPLT) project",
    url: "https://hplt-project.org/datasets/v2.0",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    usedFor: {
      sq: "Vetëm numërimi i fjalëve, për të konfirmuar se një fjalë ose një formë dialektore përdoret. Nuk kopjohet asnjë tekst.",
      en: "Word counts only: to confirm that a word or a dialect form is in use. No text is copied.",
    },
  },
  "korpus-gege": {
    id: "korpus-gege",
    name: "FjaloriShqip: forma gege të rregullta të gjetura në korpuse / regular Gheg forms found in the corpora",
    publisher: "FjaloriShqip, nga numërimet e fjalëve në MaCoCu, HPLT dhe Wikipedia shqip",
    url: "https://github.com/EndritRushiti/FjaloriShqip/blob/main/dialekte/korpus-gege.tsv",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Pjesoret dhe paskajoret gege në -ue e -ye (me punue, me thye) dhe mbiemrat në -uem e -un (i punuem, i lidhun), fjalë me ue gege në vend të ua (grue, muej) dhe fjalë në drejtshkrimin letrar gegë me zanore hundore (gjâ, kâmbë, vênd), secila e lidhur me fjalën standarde. Merren vetëm format që përdoren të paktën 10 herë në korpuse.",
      en: "Gheg participles and infinitives in -ue and -ye (me punue, me thye) and participle adjectives in -uem and -un (i punuem, i lidhun), words with Gheg ue for standard ua (grue, muej) and literary Gheg spellings with nasal vowels (gjâ, kâmbë, vênd), each linked to its standard word. Only forms used at least 10 times in the corpora are taken.",
    },
  },

  eurovoc: {
    id: "eurovoc",
    name: "EuroVoc, tezauri shumëgjuhësh i BE-së (versioni shqip) / the EU multilingual thesaurus (Albanian)",
    publisher: "Zyra e Publikimeve e Bashkimit Evropian / Publications Office of the European Union, © European Union",
    url: "https://op.europa.eu/en/web/eu-vocabularies/eurovoc",
    licence: "Ripërdorim i lirë me përmendjen e burimit (Vendimi 2011/833/BE) / Free reuse with acknowledgement (Decision 2011/833/EU)",
    licenceUrl: "https://eur-lex.europa.eu/eli/dec/2011/833/oj",
    usedFor: {
      sq: "Vetëm disa fjalë të vetme shqip të tezaurit (rreth 100 terma ekonomikë, shkencorë e teknikë), të cilat i kontrollojmë në korpuse dhe i përshkruajmë vetë.",
      en: "Only some single Albanian words of the thesaurus (about 100 economic, scientific and technical terms), which we check in the corpora and describe ourselves.",
    },
    notUsed: {
      sq: "Termat me shumë fjalë, struktura e tezaurit dhe përkthimet nuk merren.",
      en: "Multi-word terms, the structure of the thesaurus and the translations are not used.",
    },
  },
  "mann-1948": {
    id: "mann-1948",
    name: "Stuart E. Mann, An Historical Albanian-English Dictionary (Londër 1948)",
    publisher: "Stuart E. Mann, Longmans, Green & Co. për British Council, Londër",
    url: "https://fsi-languages.yojik.eu/languages/DLI/Albanian/Albanian-English%20Dictionary.pdf",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://fsi-languages.yojik.eu/languages/DLI/Albanian/Albanian-English%20Dictionary.pdf",
    usedFor: {
      sq: "Fjalë të vjetra, krahinore dhe dialektore (gege, toske, arbëreshe, arvanitase), me klasën e fjalës, dialektin dhe fjalën standarde përkatëse. Përshkrimet shqip i shkruajmë vetë.",
      en: "Old, regional and dialect words (Gheg, Tosk, Arbëresh, Arvanitika), with their word class, dialect and corresponding standard word. The Albanian descriptions are our own.",
    },
    notUsed: {
      sq: "Përkufizimet, shembujt dhe etimologjitë e librit nuk kopjohen.",
      en: "The definitions, examples and etymologies of the book are not copied.",
    },
  },
  uniparser: {
    id: "uniparser",
    name: "Uniparser: leksiku i gjuhës shqipe",
    publisher: "Maria Morozova, Alexander Rusakov dhe bashkautorë",
    url: "https://github.com/uniparser",
    licence: "MIT",
    licenceUrl: "https://opensource.org/license/mit",
    usedFor: {
      sq: "Fjalë të rralla e të pasura që mungonin, me klasën e fjalës dhe kuptimin anglisht. Përshkrimet shqip i shkruajmë vetë.",
      en: "Rare and rich words that were missing, with their word class and English meaning. The Albanian descriptions are our own.",
    },
    notUsed: {
      sq: "Tabelat e lakimit nuk ribotohen.",
      en: "The inflection tables are not republished.",
    },
  },
  "busetti-1911": {
    id: "busetti-1911",
    name: "Antonio Busetti, Vocabolario italiano-albanese (Shkodër 1911)",
    publisher: "Antonio Busetti, Shkodër. Skanuar nga Bayerische Staatsbibliothek",
    url: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00133737-8",
    downloadUrl: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00133737-8",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma gege nga fjalori italisht-shqip, secila e lidhur me fjalën standarde përkatëse.",
      en: "Gheg forms from the Italian-Albanian vocabulary, each linked to its standard word.",
    },
    notUsed: {
      sq: "Përkufizimet e librit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre. Skanimet nuk ribotohen dhe fjalët e huazuara lihen jashtë.",
      en: "The book's definitions are not copied; only the words and their meaning are taken. The scans are not republished and loans are left out.",
    },
  },
  "weigand-1914": {
    id: "weigand-1914",
    name: "Gustav Weigand, Albanesisch-deutsches Wörterbuch (Leipzig 1914)",
    publisher: "Gustav Weigand (1860–1930), Leipzig. Skanuar nga Bayerische Staatsbibliothek",
    url: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00118331-1",
    downloadUrl: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00118331-1",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma nga fjalori shqip-gjermanisht, secila e lidhur me fjalën standarde përkatëse. Fjalët i kthejmë nga shkrimi i autorit në drejtshkrimin e sotëm.",
      en: "Forms from the Albanian-German dictionary, each linked to its standard word. We convert the words from the author's spelling into today's.",
    },
    notUsed: {
      sq: "Përkufizimet e librit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre. Skanimet nuk ribotohen dhe fjalët e huazuara lihen jashtë.",
      en: "The book's definitions are not copied; only the words and their meaning are taken. The scans are not republished and loans are left out.",
    },
  },
  "leake-1814": {
    id: "leake-1814",
    name: "William Martin Leake, Researches in Greece (Londër 1814)",
    publisher: "William Martin Leake (1777–1860), Londër",
    url: "https://archive.org/details/10523524bsb",
    downloadUrl: "https://archive.org/details/10523524bsb",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma të vjetra toske nga fjalori i librit, secila e lidhur me fjalën standarde përkatëse.",
      en: "Old Tosk forms from the book's vocabulary, each linked to its standard word.",
    },
    notUsed: {
      sq: "Përkufizimet e librit.",
      en: "The book's definitions.",
    },
  },
  "fiorilli-2002": {
    id: "fiorilli-2002",
    name: "Giuseppe Fiorilli, Dizionario arbëresh di lemmi, frasi e motti (Ururi 2002)",
    publisher: "Giuseppe Fiorilli, Ururi",
    url: "https://www.vatrarberesh.it/biblioteca/ebooks/dizionario.pdf",
    downloadUrl: "https://www.vatrarberesh.it/biblioteca/ebooks/dizionario.pdf",
    licence: "Vetëm fjalët / Words only",
    licenceUrl: "https://fjalorishqip.org/rreth/",
    usedFor: {
      sq: "Vetëm format arbëreshe të Ururit, secila e lidhur me fjalën standarde. Përshkrimet janë tonat.",
      en: "Only the Arbëresh forms of Ururi, each linked to its standard word. The descriptions are our own.",
    },
    notUsed: {
      sq: "Përkufizimet, frazat dhe shembujt e librit.",
      en: "The book's definitions, phrases and examples.",
    },
  },
  "gallo-sanmarzano": {
    id: "gallo-sanmarzano",
    name: "Giuseppe Gallo, L'Arbëresh di S. Marzano",
    publisher: "Giuseppe Gallo, San Marzano di San Giuseppe",
    url: "https://comune.sanmarzano.ta.it/amministrazione-trasparente-storico/attachments/article/547/DIZIONARIO.pdf",
    downloadUrl: "https://comune.sanmarzano.ta.it/amministrazione-trasparente-storico/attachments/article/547/DIZIONARIO.pdf",
    licence: "Vetëm fjalët / Words only",
    licenceUrl: "https://fjalorishqip.org/rreth/",
    usedFor: {
      sq: "Vetëm format arbëreshe të San Marzanos, secila e lidhur me fjalën standarde. Përshkrimet janë tonat.",
      en: "Only the Arbëresh forms of San Marzano, each linked to its standard word. The descriptions are our own.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt e librit.",
      en: "The book's definitions and examples.",
    },
  },
  "molise-arberesh": {
    id: "molise-arberesh",
    name: "Vocabolario polinomico e sociale italiano-arbëresh delle varietà molisane",
    publisher: "Mnamon",
    url: "https://www.mnamon.it/vocabolario-polinomico-e-sociale-italiano-arberesh/",
    downloadUrl: "https://www.mnamon.it/vocabolario-polinomico-e-sociale-italiano-arberesh/",
    licence: "Vetëm fjalët / Words only",
    licenceUrl: "https://fjalorishqip.org/rreth/",
    usedFor: {
      sq: "Vetëm format arbëreshe të Molizes, secila e lidhur me fjalën standarde. Përshkrimet janë tonat.",
      en: "Only the Arbëresh forms of Molise, each linked to its standard word. The descriptions are our own.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt e librit.",
      en: "The book's definitions and examples.",
    },
  },
  "ndreca-1972": {
    id: "ndreca-1972",
    name: "Mikel Ndreca, Fjalor shqip-serbokroatisht (Prishtinë 1972)",
    publisher: "Mikel Ndreca, Prishtinë",
    url: "https://archive.org/details/fjalor-shqip-serbokroatisht-albansko-srpskohrvatski-recnik-mikel-ndr",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://archive.org/details/fjalor-shqip-serbokroatisht-albansko-srpskohrvatski-recnik-mikel-ndr",
    usedFor: {
      sq: "Fjalë që mungonin te ne, me klasën e fjalës.",
      en: "Words we were missing, with their word class.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "Definitions and examples are not copied. The Albanian descriptions are our own.",
    },
  },
  "dhora": {
    id: "dhora",
    name: "Dhora, Fjalor i emrave të kafshëve në Shqipëri",
    publisher: "Dhora",
    url: "https://archive.org/details/FJALORIEmraveTKafshveNShqipri",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://archive.org/details/FJALORIEmraveTKafshveNShqipri",
    usedFor: {
      sq: "Emra popullorë të kafshëve dhe të zogjve.",
      en: "Folk names of animals and birds.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "Definitions and examples are not copied. The Albanian descriptions are our own.",
    },
  },
  "revistat-krahinat": {
    id: "revistat-krahinat",
    name: "Revistat Studime Filologjike, Gjuha Shqipe dhe Gjurmime Albanologjike, listat e fjalëve të krahinave",
    publisher: "Instituti i Gjuhësisë dhe i Letërsisë, Tiranë, dhe Instituti Albanologjik, Prishtinë",
    url: "https://albanica.al",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://albanica.al",
    usedFor: {
      sq: "Fjalë krahinore nga listat e botuara në këto revista.",
      en: "Regional words from the lists published in these journals.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "Definitions and examples are not copied. The Albanian descriptions are our own.",
    },
  },
  "bufli-rocchi-2021": {
    id: "bufli-rocchi-2021",
    name: "Gjorgji Bufli dhe Luciano Rocchi, A Historical-Etymological Dictionary of Turkisms in Albanian, 1555-1954 (Trieste 2021)",
    publisher: "Edizioni Università di Trieste",
    url: "https://archive.org/details/tuchisms",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://archive.org/details/tuchisms",
    usedFor: {
      sq: "Fjalë të vjetra me prejardhje turke, të shënuara si huazime.",
      en: "Old words of Turkish origin, marked as loans.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "Definitions and examples are not copied. The Albanian descriptions are our own.",
    },
  },
  "morina-juridik": {
    id: "morina-juridik",
    name: "Iset Morina (red.), Fjalor juridik, e drejta private, publike dhe penale",
    publisher: "Iset Morina, Ardrit Gashi, Avni Puka, Nebojša Boričić, Visar Morina",
    url: "https://archive.org/details/fjalor-juridik-e-drejta-private-e-drejta-publike-e-drejta-penale",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://archive.org/details/fjalor-juridik-e-drejta-private-e-drejta-publike-e-drejta-penale",
    usedFor: {
      sq: "Terma juridikë shqip.",
      en: "Albanian legal terms.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "Definitions and examples are not copied. The Albanian descriptions are our own.",
    },
  },
  "si-e-thua": {
    id: "si-e-thua",
    name: "Si e thua ti? Folësit e shqipes në FjaloriShqip",
    publisher: "Vizitorët e faqes",
    url: "https://fjalorishqip.org/rreth/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Forma dialektore të dhëna nga folësit. Një formë hyn vetëm kur e japin të paktën tre njerëz të ndryshëm për të njëjtin dialekt.",
      en: "Dialect forms given by speakers. A form enters only when at least three different people give it for the same dialect.",
    },
    notUsed: {
      sq: "Emrat dhe adresat e njerëzve nuk ruhen.",
      en: "People's names and addresses are not kept.",
    },
  },
  "studime-arberesh": {
    id: "studime-arberesh",
    name: "Studime për arbëreshët dhe arvanitasit",
    publisher: "Perta dhe të tjerë",
    url: "https://www.ledonline.it/Il-Segno-le-Lettere/allegati/Perta-Sopravvivenze.pdf",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://www.ledonline.it/Il-Segno-le-Lettere/allegati/Perta-Sopravvivenze.pdf",
    usedFor: {
      sq: "Fjalë të rralla arbëreshe dhe arvanitase të përmendura në studime.",
      en: "Rare Arbëresh and Arvanitika words quoted in studies.",
    },
    notUsed: {
      sq: "Përkufizimet dhe shembujt nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "Definitions and examples are not copied. The Albanian descriptions are our own.",
    },
  },
  "letersia-gege": {
    id: "letersia-gege",
    name: "Letërsia gege: Fishta, Gjeçovi, Bogdani",
    publisher: "Fishta, Gjeçovi, Bogdani",
    url: "https://archive.org/details/lahuta-e-malcis-gjergj-fishta-1937",
    licence: "Vetëm fjalët dhe të dhënat për to / Words and facts about them only",
    licenceUrl: "https://archive.org/details/lahuta-e-malcis-gjergj-fishta-1937",
    usedFor: {
      sq: "Forma gege të gjetura në veprat e vjetra të letërsisë.",
      en: "Gheg forms found in older works of literature.",
    },
    notUsed: {
      sq: "Tekstet nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "The texts are not copied. The Albanian descriptions are our own.",
    },
  },
  "mitko-1878": {
    id: "mitko-1878",
    name: "Thimi Mitko, Bleta shqypëtare (1878)",
    publisher: "Thimi Mitko",
    url: "https://www.digitale-sammlungen.de/en/view/bsb00133799",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma toske të gjetura në këngët dhe përrallat e librit.",
      en: "Tosk forms found in the songs and tales of the book.",
    },
    notUsed: {
      sq: "Tekstet nuk kopjohen. Përshkrimet shqip i shkruajmë vetë.",
      en: "The texts are not copied. The Albanian descriptions are our own.",
    },
  },
  "rregull-gege": {
    id: "rregull-gege",
    name: "Forma të rregullta gege",
    publisher: "FjaloriShqip",
    url: "https://fjalorishqip.org/burimet/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Forma gege të ndërtuara me rregull nga foljet standarde në -oj.",
      en: "Gheg forms built by rule from standard verbs in -oj.",
    },
    notUsed: {
      sq: "Këto forma nuk janë marrë nga një libër dhe kjo shkruhet në faqen e secilës.",
      en: "These forms are not taken from a book, and each page says so.",
    },
  },
  "studime-dialektore": {
    id: "studime-dialektore",
    name: "Studime për të folmet shqipe",
    publisher: "Doktorata universitare",
    url: "https://unitir.edu.al/wp-content/uploads/2014/07/Doktoratura-Arjeta-Cuka-Fakulteti-i-Histori-Filologjise-Departamenti-i-Gjuhesise.pdf",
    licence: "Vetëm fjalët, shkrimet janë tonat",
    licenceUrl: "https://fjalorishqip.org/burimet/",
    usedFor: {
      sq: "Fjalë dhe forma krahinore nga Martaneshi, Karadaku i Shkupit dhe Çamëria.",
      en: "Regional words and forms from Martanesh, the Karadak of Skopje and Chameria.",
    },
    notUsed: {
      sq: "Nuk janë marrë shpjegimet dhe tekstet e studimeve.",
      en: "The explanations and texts of the studies are not used.",
    },
  },
  "meyer-1896": {
    id: "meyer-1896",
    name: "Gustav Meyer, Albanesische Studien V (Vjenë 1896)",
    publisher: "Gustav Meyer (1850–1900), Vjenë. Skanuar nga Bayerische Staatsbibliothek",
    url: "https://www.digitale-sammlungen.de/view/bsb11837072",
    downloadUrl: "https://www.digitale-sammlungen.de/view/bsb11837072",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma arvanitase nga fjalorthi i librit për dialektet shqipe të Greqisë, secila e lidhur me fjalën standarde përkatëse.",
      en: "Arvanitika forms from the book's glossary of the Albanian dialects of Greece, each linked to its standard word.",
    },
    notUsed: {
      sq: "Përkufizimet e librit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre. Skanimet nuk ribotohen dhe fjalët e huazuara lihen jashtë.",
      en: "The book's definitions are not copied; only the words and their meaning are taken. The scans are not republished and loans are left out.",
    },
  },
  "reinhold-1855": {
    id: "reinhold-1855",
    name: "Karl Reinhold, Noctes Pelasgicae (Athinë 1855)",
    publisher: "Karl Reinhold (1810–1880), Athinë. Skanuar nga Bayerische Staatsbibliothek",
    url: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb10589078-5",
    downloadUrl: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb10589078-5",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma arvanitase nga fjalorthi i librit, të folura në Poros e Hidra, secila e lidhur me fjalën standarde përkatëse.",
      en: "Arvanitika forms from the book's lexicon, as spoken on Poros and Hydra, each linked to its standard word.",
    },
    notUsed: {
      sq: "Përkufizimet e librit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre. Skanimet nuk ribotohen dhe fjalët e huazuara nga greqishtja lihen jashtë.",
      en: "The book's definitions are not copied; only the words and their meaning are taken. The scans are not republished and Greek loans are left out.",
    },
  },
  "bashkimi-1908": {
    id: "bashkimi-1908",
    name: "Shoqnia e Bashkimit, Fialuer i Rii i Shcypés (Shkodër 1908)",
    publisher: "Shoqnia e Bashkimit të Gjuhës Shqipe, Shkodër. Skanuar nga Bayerische Staatsbibliothek",
    url: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00133812-6",
    downloadUrl: "http://mdz-nbn-resolving.de/urn:nbn:de:bvb:12-bsb00133812-6",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma gege nga fjalori i Bashkimit, secila e lidhur me fjalën standarde përkatëse. Fjalët i kthejmë nga shkrimi i librit në drejtshkrimin e sotëm dhe kuptimet i përkthejmë nga italishtja.",
      en: "Gheg forms from the Bashkimi dictionary, each linked to its standard word. We convert the words from the book's spelling into today's and translate the meanings from Italian.",
    },
    notUsed: {
      sq: "Përkufizimet e librit nuk kopjohen, merren vetëm fjalët dhe kuptimi i tyre. Skanimet nuk ribotohen dhe fjalët që libri i shënon si turke lihen jashtë.",
      en: "The book's definitions are not copied; only the words and their meaning are taken. The scans are not republished and words the book marks as Turkish are left out.",
    },
  },
  "voskopojari-1802": {
    id: "voskopojari-1802",
    name: "Dhanil Voskopojari, Eisagogiki didaskalia (1802)",
    publisher: "Dhanil Voskopojari (rreth 1754–1825). Teksti i kontrolluar në Wikisource",
    url: "https://wikisource.org/wiki/Index:Eisagogiki-Didaskalia.pdf",
    downloadUrl: "https://wikisource.org/wiki/Index:Eisagogiki-Didaskalia.pdf",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma toske të Voskopojës nga libri me fraza në katër gjuhë, secila e lidhur me fjalën standarde përkatëse. Fjalët i kthejmë nga shkronjat greke në drejtshkrimin e sotëm.",
      en: "Tosk forms of Voskopojë from the four-language phrase book, each linked to its standard word. We convert the words from Greek letters into today's spelling.",
    },
    notUsed: {
      sq: "Merren vetëm fjalët dhe kuptimi i tyre. Trajtat e pasigurta lihen jashtë.",
      en: "Only the words and their meaning are taken. Uncertain forms are left out.",
    },
  },
  "xylander-1835": {
    id: "xylander-1835",
    name: "Josef von Xylander, Die Sprache der Albanesen oder Schkipetaren (Frankfurt 1835)",
    publisher: "Josef von Xylander (1794–1854), Frankfurt am Main. Skanuar nga Google, në Internet Archive",
    url: "https://archive.org/details/diesprachederal00xylagoog",
    downloadUrl: "https://archive.org/details/diesprachederal00xylagoog",
    licence: "Domain publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Forma toske nga fjalorthi shqip-gjermanisht i librit, secila e lidhur me fjalën standarde përkatëse. Fjalët i kthejmë nga shkronjat greke të autorit në drejtshkrimin e sotëm.",
      en: "Tosk forms from the book's Albanian–German vocabulary, each linked to its standard word. We convert the words from the author's Greek letters into today's spelling.",
    },
    notUsed: {
      sq: "Merren vetëm fjalët dhe kuptimi i tyre. Fjalët turke e greke të fjalorthit lihen jashtë.",
      en: "Only the words and their meaning are taken. The Turkish and Greek loans in the vocabulary are left out.",
    },
  },
  folesit: {
    id: "folesit",
    name: "Folësit e dialekteve: fjalë të mbledhura nga folës vendas",
    publisher: "FjaloriShqip, nga folës vendas, të kontrolluara nga redaktori",
    url: "https://fjalorishqip.org/burimet/",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    usedFor: {
      sq: "Fjalë që njerëzit i thonë në shtëpi e në fshat dhe rrallë i shkruajnë, me vendin ku thuhen (p.sh. Tetovë, Gostivar, Kërçovë) dhe fjalën standarde. Përshkrimet shqip janë tonat.",
      en: "Words people say at home and in the village but rarely write, with the place where they are said (e.g. Tetovë, Gostivar, Kërçovë) and the standard word. The Albanian descriptions are our own.",
    },
    notUsed: {
      sq: "Emrat e folësve nuk ruhen e nuk botohen.",
      en: "The speakers' names are not kept or published.",
    },
  },
  "hahn-1854": {
    id: "hahn-1854",
    name: "Johann Georg von Hahn, Albanesische Studien, vëll. 3: Beiträge zu einem albanesisch-deutschen Lexikon (Vjenë 1853, Jena 1854)",
    publisher: "Johann Georg von Hahn (1811–1869); skanimi i Bayerische Staatsbibliothek në archive.org",
    url: "https://archive.org/details/10589474bsb",
    licence: "Domen publik / Public domain",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    usedFor: {
      sq: "Fjalë të vjetra dhe krahinore (gege e toske) që mungonin, me klasën e fjalës, dialektin dhe kuptimin. Fjalorin e shkroi Hahn me alfabet greko-latin, fjalët i kthejmë në drejtshkrimin e sotëm dhe përshkrimet shqip i shkruajmë vetë.",
      en: "Old and regional words (Gheg and Tosk) that were missing, with their word class, dialect and meaning. Hahn wrote Albanian in a Greek-based alphabet; we convert the words to today's spelling and write the Albanian descriptions ourselves.",
    },
    notUsed: {
      sq: "Shembujt, shënimet etimologjike dhe skanimi nuk ribotohen.",
      en: "The examples, etymological notes and the scan are not republished.",
    },
  },

};
