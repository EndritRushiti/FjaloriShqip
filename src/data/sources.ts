/**
 * Every source the dictionary uses, with its licence and how it is used.
 * The References page ("Burimet") and the attribution in the API/downloads
 * are generated from this list — nothing enters the dictionary without an entry here.
 */
export type SourceId = "en-wiktionary" | "wikidata" | "sq-wiktionary" | "hunspell-sq" | "wikipedia-sq" | "wiktionary-other" | "albanet" | "macocu" | "auto" | "editor" | "ai" | "meyer-1891" | "jungg-1895" | "rossi-1875";

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
  "hunspell-sq": {
    id: "hunspell-sq",
    name: "Fjalori drejtshkrimor shqip për Hunspell (sq_AL)",
    publisher: "Luan Kelmendi; shpërndarë me LibreOffice",
    url: "https://github.com/LibreOffice/dictionaries/tree/master/sq_AL",
    downloadUrl: "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/sq_AL/sq_AL.dic",
    licence: "GPL-2.0-or-later",
    licenceUrl: "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html",
    usedFor: {
      sq: "Vetëm lista e fjalëve: fjalë bazë që nuk ishin në burimet e tjera, të gjetura automatikisht ndër format e listës drejtshkrimore, me llojin e fjalës kur mund të përcaktohet nga mbaresa. Këto fjalë nuk kanë ende kuptim dhe shënohen si të paverifikuara. Ato janë me licencën GPL-2.0 ose më të re (jo CC BY-SA) dhe çdo fjalë e tillë e tregon këtë.",
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
      sq: "Vetëm numërimi i fjalëve: sa herë shfaqet çdo fjalë (me format e saj) në artikuj. Përdoret për të renditur fjalët nga më të përdorurat dhe për të konfirmuar se një fjalë e re përdoret realisht. Nuk kopjohet asnjë tekst.",
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
      sq: "Fjalë shqipe që mungonin në burimet e tjera: hyrjet shqipe të këtyre botimeve dhe përkthimet në shqip. Një fjalë shtohet vetëm kur përdoret në Wikipedia ose MaCoCu, ose kur e dëshmojnë të paktën dy botime.",
      en: "Albanian words missing from the other sources: the Albanian entries of these editions and their translations into Albanian. A word is added only when it is used in Wikipedia or MaCoCu, or attested by at least two editions.",
    },
    notUsed: {
      sq: "Kuptimet në frëngjisht, gjermanisht etj. nuk shfaqen; fjalët pa kuptim anglisht e tregojnë këtë.",
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
      sq: "Vetëm numërimi i fjalëve në paragrafët me cilësi të mirë: për të konfirmuar se një fjalë e re përdoret dhe për të treguar sa e zakonshme është. Nuk kopjohet asnjë tekst.",
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
      sq: "Për fjalët pa kuptim: një kuptim i përafërt i nxjerrë nga fjala bazë (rindërtim ← rindërtoj \"to rebuild\"), nga pjesët e fjalës së përbërë (kryeredaktor = krye + redaktor) ose nga fjala ndërkombëtare në anglisht (humanitet → humanity). Shënohet gjithmonë si \"i përafërt\".",
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
      sq: "Format arbëreshe (Itali: Kalabri, Siçili; nga Rada, Camarda, Santori, Schirò etj.) dhe arvanitase (Greqi: Hidra, Poros, Salaminë etj., kryesisht nga Reinhold) që Meyer i shënon me burimin e tyre. Fjalët i kthejmë nga shkrimi fonetik i Meyer-it në drejtshkrimin e sotëm (ε → ë, š → sh, l → ll, l' → l…) dhe kuptimet i përkthejmë nga gjermanishtja në anglisht. Faqja e librit për çdo formë ruhet te skedari dialekte/meyer-1891.tsv. Vepra është në domen publik (autori vdiq më 1900).",
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
      sq: "Disa forma gege që ndryshojnë nga gjuha standarde, secila e lidhur me fjalën standarde përkatëse; fjalët kthehen nga drejtshkrimi i vjetër në atë të sotëm dhe kuptimet përkthehen nga italishtja. Vepra është në domen publik.",
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
};
