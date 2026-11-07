/**
 * The story of each source for /burimet/ (the timeline) and /burimet/<id>/ (one page per source).
 * Only facts we are sure of: life dates and biographies are left out when not certain.
 * `ref` is the title of the source's entry in the licence list of scripts/build-site.ts.
 */
import type { SourceId } from "./sources.js";

export type SourceKind = "book" | "study" | "digital" | "ours";

export interface SourceStory {
  /** address: /burimet/<slug>/ */
  slug: string;
  /** the entry in the licence list (its title) */
  ref: string;
  /** the source ids whose words and forms belong to this page */
  ids: SourceId[];
  kind: SourceKind;
  /** year on the timeline (books), and how it is written when it is a span */
  year?: number;
  yearLabel?: string;
  /** short title and author for the timeline */
  title: string;
  author: string;
  life?: string;
  /** what the book or source is (one or two sentences) */
  about: { sq: string; en: string };
  /** a short biography of the author, only when certain */
  bio?: { sq: string; en: string };
  /** an old text quoted as written, with today's wording */
  quote?: { text: string; sq: string; en: string };
  /** words as they were written, with the meaning given there and today's word */
  attested?: { old: string; gloss: string; word: string }[];
  /** a note shown on the page (e.g. why no words were taken yet) */
  note?: { sq: string; en: string };
}

export const SOURCE_STORIES: SourceStory[] = [
  // ── books, in time order ──
  // ── the oldest written Albanian ──
  {
    slug: "formula-e-pagezimit-1462", ref: "Pal Engjëlli, Formula e pagëzimit (1462)", ids: [], kind: "book", year: 1462,
    title: "Formula e pagëzimit", author: "Pal Engjëlli",
    about: { sq: "Fjalia më e vjetër e njohur e shkruar shqip, në një letër latinisht të vitit 1462, që prindërit të mund t'i pagëzonin vetë fëmijët kur nuk kishte prift.", en: "The oldest known sentence written in Albanian, in a Latin letter of 1462, so that parents could baptise their children themselves when there was no priest." },
    bio: { sq: "Kryepeshkop i Durrësit dhe bashkëpunëtor i Skënderbeut.", en: "Archbishop of Durrës and a companion of Skanderbeg." },
    quote: { text: "Un'te paghesont' pr'emenit t'Atit e t'Birit e t'Spertit Senit.", sq: "Unë të pagëzoj në emër të Atit, të Birit e të Shpirtit të Shenjtë.", en: "I baptise you in the name of the Father, the Son and the Holy Spirit." },
    attested: [
      { old: "paghesont", gloss: "pagëzoj", word: "pagëzoj" },
      { old: "emenit", gloss: "emër", word: "emër" },
      { old: "Atit", gloss: "at", word: "at" },
      { old: "Birit", gloss: "bir", word: "bir" },
      { old: "Spertit", gloss: "shpirt", word: "shpirt" },
      { old: "Senit", gloss: "shenjt", word: "shenjtë" },
    ],
  },
  {
    slug: "harff-1496", ref: "Arnold von Harff, Die Pilgerfahrt des Ritters Arnold von Harff (botimi 1860)", ids: [], kind: "book", year: 1496, yearLabel: "1496–1499",
    title: "Fjalorthi i Arnold von Harffit", author: "Arnold von Harff",
    about: { sq: "Lista më e vjetër e njohur e fjalëve shqipe. Një udhëtar gjerman i shënoi në Durrës, me shkronjat e veta dhe me kuptimin gjermanisht, gjatë udhëtimit të tij të viteve 1496–1499.", en: "The oldest known list of Albanian words. A German traveller wrote them down in Durrës, in his own letters and with the German meaning, during his journey of 1496–1499." },
    bio: { sq: "Kalorës nga Këlni që udhëtoi drejt Tokës së Shenjtë dhe shënoi fjalë nga gjuhët që dëgjoi rrugës. Shkruan se shqiptarët e Durrësit nuk kishin shkronja të veta.", en: "A knight from Cologne who travelled to the Holy Land and noted words of the languages he heard on the way. He writes that the Albanians of Durrës had no letters of their own." },
    attested: [
      { old: "boicke", gloss: "broyt (bukë)", word: "bukë" },
      { old: "oie", gloss: "wasser (ujë)", word: "ujë" },
      { old: "vene", gloss: "wijn (verë)", word: "verë" },
      { old: "mische", gloss: "fleysch (mish)", word: "mish" },
      { old: "poylle", gloss: "henne (pulë)", word: "pulë" },
      { old: "pyske", gloss: "vyssche (peshk)", word: "peshk" },
      { old: "foeije", gloss: "eyer (vezë)", word: "vezë" },
      { old: "oitter", gloss: "essich (uthull)", word: "uthull" },
      { old: "fijet", gloss: "slaeffen (fle)", word: "fle" },
      { old: "megarune", gloss: "essen (me ngrënë)", word: "ha" },
      { old: "pijne", gloss: "drincken (pi)", word: "pi" },
      { old: "myr", gloss: "goyt (mirë)", word: "mirë" },
      { old: "myreprama", gloss: "guden nacht (mirëmbrëma)", word: "mirëmbrëma" },
      { old: "geneyre", gloss: "eyn man (njeri)", word: "njeri" },
      { old: "growa", gloss: "eyn frauwe (grua)", word: "grua" },
      { old: "nea", gloss: "eyn (një)", word: "një" },
      { old: "dua", gloss: "tzwey (dy)", word: "dy" },
      { old: "trij", gloss: "drij (tre)", word: "tre" },
      { old: "quater", gloss: "vier (katër)", word: "katër" },
      { old: "pessa", gloss: "vunff (pesë)", word: "pesë" },
      { old: "jast", gloss: "sees (gjashtë)", word: "gjashtë" },
    ],
  },
  {
    slug: "buzuku-1555", ref: "Gjon Buzuku, Meshari (1555)", ids: [], kind: "book", year: 1555,
    title: "Meshari", author: "Gjon Buzuku",
    about: { sq: "Libri i parë i shtypur në gjuhën shqipe, një meshar katolik i përkthyer në gegërisht. Kopja e vetme e njohur ruhet në Bibliotekën e Vatikanit.", en: "The first book printed in Albanian, a Catholic missal translated into Gheg. The only known copy is kept in the Vatican Library." },
    bio: { sq: "Prift katolik nga Veriu i Shqipërisë. Për jetën e tij dihet pak, përveç asaj që shkruan vetë në fund të librit.", en: "A Catholic priest from northern Albania. Little is known of his life beyond what he writes at the end of the book." },
    note: { sq: "Teksti i plotë i Mesharit ende nuk është i lirë në internet, prandaj nuk kemi marrë ende fjalë prej tij. Do t'i shtojmë kur të kemi një tekst që lejohet të përdoret.", en: "The full text of the Missal is not yet freely available online, so we have not taken words from it yet. We will add them when we have a text that may be used." },
  },
  {
    slug: "bardhi-1635", ref: "Frang Bardhi, Dictionarium latino-epiroticum (1635)", ids: ["bardhi-1635"], kind: "book", year: 1635,
    title: "Dictionarium latino-epiroticum", author: "Frang Bardhi", life: "1606–1643",
    about: { sq: "Fjalori i parë i njohur i gjuhës shqipe, latinisht-shqip, i botuar në Romë. Përveç fjalëve ka edhe fjalë të urta e shprehje të kohës.", en: "The first known dictionary of the Albanian language, Latin–Albanian, printed in Rome. Besides words it has proverbs and expressions of the time." },
    bio: { sq: "Prift katolik nga Zadrima, peshkop i Sapës.", en: "A Catholic priest from Zadrima and Bishop of Sapa." },
  },
  {
    slug: "letersia-gege", ref: "Letërsia gege: Lahuta e Malcis, Kanuni, Cuneus Prophetarum", ids: ["letersia-gege"], kind: "book", year: 1685, yearLabel: "1685–1937",
    title: "Letërsia gege", author: "Pjetër Bogdani, Shtjefën Gjeçovi, Gjergj Fishta, Ndre Mjeda e të tjerë",
    about: { sq: "Veprat e mëdha të gegërishtes, nga «Çeta e profetëve» e Bogdanit (1685) te Kanuni i mbledhur nga Gjeçovi, «Lahuta e Malcís» e Fishtës dhe këngët e kreshnikëve të mbledhura nga Palaj e Kurti (1937), bashkë me Mjedën dhe Koliqin.", en: "The great works of Gheg, from Bogdani's “Band of the Prophets” (1685) to the Kanun gathered by Gjeçovi, Fishta's “Highland Lute” and the Kreshnik songs gathered by Palaj and Kurti (1937), together with Mjeda and Koliqi." },
  },
  {
    slug: "voskopojari-1802", ref: "Dhanil Voskopojari, Eisagogiki didaskalia (1802)", ids: ["voskopojari-1802"], kind: "book", year: 1802,
    title: "Eisagogiki didaskalia", author: "Dhanil Voskopojari",
    about: { sq: "Libër mësimi me një fjalor katërgjuhësh, greqisht, vllahisht, bullgarisht dhe shqip, nga Voskopoja.", en: "A school book with a four-language vocabulary, Greek, Aromanian, Bulgarian and Albanian, from Voskopojë." },
  },
  {
    slug: "leake-1814", ref: "William Martin Leake, Researches in Greece (1814)", ids: ["leake-1814"], kind: "book", year: 1814,
    title: "Researches in Greece", author: "William Martin Leake", life: "1777–1860",
    about: { sq: "Libër për gjuhët e Ballkanit jugor, me një fjalorth shqip-anglisht të toskërishtes.", en: "A book on the languages of the southern Balkans, with an Albanian–English vocabulary of Tosk." },
    bio: { sq: "Oficer dhe topograf britanik që udhëtoi gjatë në Greqi e në Shqipëri në fillim të shekullit XIX.", en: "A British officer and topographer who travelled widely in Greece and Albania in the early 19th century." },
  },
  {
    slug: "xylander-1835", ref: "Xylander, Die Sprache der Albanesen (1835)", ids: ["xylander-1835"], kind: "book", year: 1835,
    title: "Die Sprache der Albanesen oder Schkipetaren", author: "Josef von Xylander", life: "1794–1854",
    about: { sq: "Një nga përshkrimet e para gjermane të shqipes, me gramatikë dhe fjalorth.", en: "One of the first German descriptions of Albanian, with a grammar and a vocabulary." },
    bio: { sq: "Oficer bavarez që shërbeu në Greqi dhe u mor me gjuhët e saj.", en: "A Bavarian officer who served in Greece and studied its languages." },
  },
  {
    slug: "hahn-1854", ref: "Albanesische Studien, vëll. 3: shtojca e fjalorit shqip-gjermanisht (1853–1854)", ids: ["hahn-1854"], kind: "book", year: 1854, yearLabel: "1853–1854",
    title: "Albanesische Studien", author: "Johann Georg von Hahn", life: "1811–1869",
    about: { sq: "Vepra që hapi studimin shkencor të shqipes, me gramatikë, fjalor shqip-gjermanisht dhe shumë fjalë të urta.", en: "The work that opened the scholarly study of Albanian, with a grammar, an Albanian–German dictionary and many proverbs." },
    bio: { sq: "Diplomat austriak, konsull në Janinë. Shpesh quhet babai i albanologjisë.", en: "An Austrian diplomat, consul in Ioannina. He is often called the father of Albanian studies." },
  },
  {
    slug: "reinhold-1855", ref: "Karl Reinhold, Noctes Pelasgicae (1855)", ids: ["reinhold-1855"], kind: "book", year: 1855,
    title: "Noctes Pelasgicae", author: "Karl Reinhold",
    about: { sq: "Mbledhje këngësh e tekstesh të arvanitasve të Greqisë, me shënime gjuhësore.", en: "A collection of songs and texts of the Arvanites of Greece, with notes on the language." },
  },
  {
    slug: "libra-te-vjeter", ref: "Libra të vjetër shqip (1860–1960)", ids: ["libra-te-vjeter"], kind: "book", year: 1860, yearLabel: "1860–1960",
    title: "Libra të vjetër shqip", author: "Naim Frashëri, Spiro Dine, Çajupi, Kristoforidhi, Gjeçovi e të tjerë",
    about: { sq: "Libra të shtypur shqip në njëqind vjet, nga Rilindja deri në mesin e shekullit XX, ku fjalët ruajnë format e vjetra toske e gege.", en: "Albanian books printed over a hundred years, from the National Awakening to the mid-20th century, whose words keep old Tosk and Gheg forms." },
  },
  {
    slug: "rossi-1875", ref: "Vocabolario epirotico-italiano (1875)", ids: ["rossi-1875"], kind: "book", year: 1875,
    title: "Vocabolario epirotico-italiano", author: "Francesco Rossi da Montalto",
    about: { sq: "Fjalor i madh shqip-italisht i gegërishtes së Shkodrës, me mijëra fjalë e shprehje.", en: "A large Albanian–Italian dictionary of the Gheg of Shkodër, with thousands of words and expressions." },
  },
  {
    slug: "mitko-1878", ref: "Thimi Mitko, Bleta shqypëtare (1878)", ids: ["mitko-1878"], kind: "book", year: 1878,
    title: "Bleta shqypëtare", author: "Thimi Mitko", life: "1820–1890",
    about: { sq: "Përmbledhja e parë e madhe e folklorit shqiptar, këngë, përralla e fjalë të urta, e botuar në Aleksandri të Egjiptit.", en: "The first large collection of Albanian folklore, songs, tales and proverbs, printed in Alexandria, Egypt." },
    bio: { sq: "Folklorist dhe atdhetar nga Korça që jetoi e punoi në Egjipt.", en: "A folklorist and patriot from Korçë who lived and worked in Egypt." },
  },
  {
    slug: "dozon-1879", ref: "Manuel de la langue chkipe ou albanaise (1879)", ids: ["dozon-1879"], kind: "book", year: 1879,
    title: "Manuel de la langue chkipe ou albanaise", author: "Auguste Dozon", life: "1822–1890",
    about: { sq: "Libër mësimi i shqipes në frëngjisht, me gramatikë, tekste dhe fjalorth shqip-frëngjisht.", en: "A French textbook of Albanian, with a grammar, texts and an Albanian–French vocabulary." },
    bio: { sq: "Diplomat dhe folklorist francez, konsull në Ballkan, që mblodhi këngë e përralla shqipe.", en: "A French diplomat and folklorist, consul in the Balkans, who collected Albanian songs and tales." },
  },
  {
    slug: "meyer-1891", ref: "Etymologisches Wörterbuch der albanesischen Sprache (1891)", ids: ["meyer-1891"], kind: "book", year: 1891,
    title: "Etymologisches Wörterbuch der albanesischen Sprache", author: "Gustav Meyer", life: "1850–1900",
    about: { sq: "Fjalori i parë etimologjik i shqipes. Për çdo fjalë jep format në dialekte, edhe tek arbëreshët e arvanitasit.", en: "The first etymological dictionary of Albanian. For each word it gives the forms in the dialects, Arbëresh and Arvanitika included." },
    bio: { sq: "Gjuhëtar austriak, profesor në Grac, një nga themeluesit e albanologjisë shkencore.", en: "An Austrian linguist, professor in Graz, one of the founders of scholarly Albanian studies." },
  },
  {
    slug: "jungg-1895", ref: "Fialuur i voghel scc'ip e ltinisct (1895)", ids: ["jungg-1895"], kind: "book", year: 1895,
    title: "Fialuur i voghel scc'ip e ltinisct", author: "Jak Jungg", life: "1840–1927",
    about: { sq: "Fjalor i vogël shqip-latinisht i gegërishtes së Shkodrës.", en: "A small Albanian–Latin dictionary of the Gheg of Shkodër." },
    bio: { sq: "Prift jezuit që punoi në Shkodër.", en: "A Jesuit priest who worked in Shkodër." },
  },
  {
    slug: "meyer-1896", ref: "Gustav Meyer, Albanesische Studien V (1896)", ids: ["meyer-1896"], kind: "book", year: 1896,
    title: "Albanesische Studien V", author: "Gustav Meyer", life: "1850–1900",
    about: { sq: "Studim për të folmet shqipe të Greqisë, me fjalorth të arvanitishtes.", en: "A study of the Albanian speech of Greece, with a vocabulary of Arvanitika." },
  },
  {
    slug: "kristoforidhi-1904", ref: "Lexikon tis albanikis glossis (1904)", ids: ["kristoforidhi-1904"], kind: "book", year: 1904,
    title: "Lexikon tis albanikis glossis", author: "Konstantin Kristoforidhi", life: "1830–1895",
    about: { sq: "Fjalor shqip-greqisht me fjalë nga të dy dialektet, i botuar në Athinë nëntë vjet pas vdekjes së autorit.", en: "An Albanian–Greek dictionary with words from both dialects, published in Athens nine years after the author's death." },
    bio: { sq: "Gjuhëtar nga Elbasani që përktheu Dhiatën e Re në gegërisht dhe në toskërisht.", en: "A linguist from Elbasan who translated the New Testament into Gheg and into Tosk." },
  },
  {
    slug: "bashkimi-1908", ref: "Shoqnia e Bashkimit, Fialuer i Rii i Shcypés (1908)", ids: ["bashkimi-1908"], kind: "book", year: 1908,
    title: "Fialuer i Rii i Shcypés", author: "Shoqnia e Bashkimit",
    about: { sq: "Fjalor i madh shqip-italisht i gegërishtes, me rreth dhjetë mijë fjalë, i hartuar nga shoqëria letrare e Shkodrës.", en: "A large Albanian–Italian dictionary of Gheg, with about ten thousand words, compiled by the literary society of Shkodër." },
    bio: { sq: "Shoqëri letrare e Shkodrës, e themeluar më 1899 nga abati Preng Doçi për të shkruar shqipen me një alfabet të përbashkët.", en: "A literary society of Shkodër, founded in 1899 by Abbot Preng Doçi to write Albanian in a shared alphabet." },
  },
  {
    slug: "busetti-1911", ref: "Antonio Busetti, Vocabolario italiano-albanese (1911)", ids: ["busetti-1911"], kind: "book", year: 1911,
    title: "Vocabolario italiano-albanese", author: "Antonio Busetti",
    about: { sq: "Fjalor italisht-shqip i botuar në Shkodër, me fjalët gege të qytetit.", en: "An Italian–Albanian dictionary printed in Shkodër, with the Gheg words of the city." },
  },
  {
    slug: "weigand-1914", ref: "Gustav Weigand, Albanesisch-deutsches Wörterbuch (1914)", ids: ["weigand-1914"], kind: "book", year: 1914,
    title: "Albanesisch-deutsches Wörterbuch", author: "Gustav Weigand", life: "1860–1930",
    about: { sq: "Fjalor shqip-gjermanisht dhe gjermanisht-shqip, i botuar në Lajpcig.", en: "An Albanian–German and German–Albanian dictionary, printed in Leipzig." },
    bio: { sq: "Gjuhëtar gjerman, profesor në Lajpcig, studiues i gjuhëve të Ballkanit.", en: "A German linguist, professor in Leipzig, who studied the languages of the Balkans." },
  },
  {
    slug: "gazulli-1942", ref: "Fjalorth i ri – Fjalë të rralla të përdoruna në Veri të Shqipnis (1942)", ids: ["gazulli-1942"], kind: "book", year: 1942,
    title: "Fjalorth i ri", author: "Nikollë Gazulli", life: "1895–1946",
    about: { sq: "Fjalorth me fjalë të rralla gege të Veriut, me vendin ku përdoret secila.", en: "A small dictionary of rare Gheg words of the North, with the place where each is used." },
    bio: { sq: "Prift katolik dhe mbledhës i fjalëve e i folklorit të Veriut.", en: "A Catholic priest and collector of the words and folklore of the North." },
  },
  {
    slug: "mann-1948", ref: "An Historical Albanian-English Dictionary (1948)", ids: ["mann-1948"], kind: "book", year: 1948,
    title: "An Historical Albanian-English Dictionary", author: "Stuart E. Mann", life: "1905–1986",
    about: { sq: "Fjalor historik shqip-anglisht me fjalë të vjetra, krahinore e dialektore nga të gjitha anët e shqipes.", en: "A historical Albanian–English dictionary with old, regional and dialect words from every part of Albanian." },
    bio: { sq: "Gjuhëtar britanik, studiues i shqipes dhe i gjuhëve indoevropiane në Londër.", en: "A British linguist who studied Albanian and the Indo-European languages in London." },
  },
  {
    slug: "ndreca-1972", ref: "Mikel Ndreca, Fjalor shqip-serbokroatisht (Prishtinë 1972)", ids: ["ndreca-1972"], kind: "book", year: 1972,
    title: "Fjalor shqip-serbokroatisht", author: "Mikel Ndreca",
    about: { sq: "Fjalor shqip-serbokroatisht i botuar në Prishtinë, që ruan edhe fjalë të gegërishtes së Kosovës.", en: "An Albanian–Serbo-Croatian dictionary printed in Prishtina, which also keeps words of Kosovo Gheg." },
  },
  {
    slug: "fiorilli-2002", ref: "Giuseppe Fiorilli, Dizionario arbëresh di lemmi, frasi e motti (2002)", ids: ["fiorilli-2002"], kind: "book", year: 2002,
    title: "Dizionario arbëresh di lemmi, frasi e motti", author: "Giuseppe Fiorilli",
    about: { sq: "Fjalor i arbërishtes së Ururit në Molize, me fjalë, fraza e thënie.", en: "A dictionary of the Arbëresh of Ururi in Molise, with words, phrases and sayings." },
  },
  {
    slug: "bufli-rocchi-2021", ref: "Gjorgji Bufli dhe Luciano Rocchi, A Historical-Etymological Dictionary of Turkisms in Albanian, 1555-1954 (Trieste 2021)", ids: ["bufli-rocchi-2021"], kind: "book", year: 2021,
    title: "A Historical-Etymological Dictionary of Turkisms in Albanian", author: "Gjorgji Bufli, Luciano Rocchi",
    about: { sq: "Fjalor i fjalëve me prejardhje turke në shqip, siç dalin në tekstet nga viti 1555 deri më 1954.", en: "A dictionary of the words of Turkish origin in Albanian, as they appear in texts from 1555 to 1954." },
  },

  // ── studies and collections of today ──
  { slug: "studime-dialektore", ref: "Arjeta Çuka, E folmja dhe toponimia e Martaneshit", ids: ["studime-dialektore"], kind: "study", title: "Studime për të folmet shqipe", author: "Arjeta Çuka, Edlira Troplini, Asllan Hamiti e të tjerë",
    about: { sq: "Doktoratura e artikuj për të folmet e Martaneshit, Çamërisë, Karadakut, Zarës, Konispolit e Leshnjës.", en: "Doctorates and articles on the speech of Martanesh, Chameria, Karadak, Zadar, Konispol and Leshnjë." } },
  { slug: "revistat-krahinat", ref: "Revistat Studime Filologjike, Gjuha Shqipe dhe Gjurmime Albanologjike, listat e fjalëve të krahinave", ids: ["revistat-krahinat"], kind: "study", title: "Listat e fjalëve të krahinave", author: "Studime Filologjike, Gjuha Shqipe, Gjurmime Albanologjike",
    about: { sq: "Fjalë të mbledhura krahinë për krahinë dhe të botuara në revistat shkencore të Tiranës e të Prishtinës.", en: "Words collected region by region and published in the scholarly journals of Tirana and Prishtina." } },
  { slug: "studime-arberesh", ref: "Studime për arbëreshët dhe arvanitasit", ids: ["studime-arberesh"], kind: "study", title: "Studime për arbëreshët dhe arvanitasit", author: "Perta, Turano, Matranga, Picari e të tjerë",
    about: { sq: "Studime për të folmet arbëreshe të Italisë dhe arvanitase të Greqisë, nga ku janë marrë fjalë të rralla.", en: "Studies of the Arbëresh speech of Italy and the Arvanitika of Greece, which gave rare words." } },
  { slug: "gallo-sanmarzano", ref: "Giuseppe Gallo, L'Arbëresh di S. Marzano", ids: ["gallo-sanmarzano"], kind: "study", title: "L'Arbëresh di S. Marzano", author: "Giuseppe Gallo",
    about: { sq: "Fjalët arbëreshe të San Marzanos në Pulja.", en: "The Arbëresh words of San Marzano in Apulia." } },
  { slug: "molise-arberesh", ref: "Vocabolario polinomico e sociale italiano-arbëresh delle varietà molisane", ids: ["molise-arberesh"], kind: "study", title: "Vocabolario polinomico italiano-arbëresh", author: "Mnamon",
    about: { sq: "Fjalor i arbërishtes së fshatrave të Molizes.", en: "A dictionary of the Arbëresh of the villages of Molise." } },
  { slug: "fjalor-arberesh", ref: "Dizionario Arbëreshë-Italiano", ids: ["fjalor-arberesh"], kind: "study", title: "Dizionario Arbëreshë-Italiano", author: "Roberto Basile",
    about: { sq: "Fjalor i hapur në internet me fjalët e Horës së Arbëreshëvet dhe të Ururit.", en: "An open online dictionary with the words of Piana degli Albanesi and Ururi." } },
  { slug: "arvanitika-living", ref: "Arvanitika Living Dictionary", ids: ["arvanitika-living"], kind: "study", title: "Arvanitika Living Dictionary", author: "Living Dictionaries",
    about: { sq: "Fjalor i gjallë me fjalë arvanitase të regjistruara nga folësit në Greqi.", en: "A living dictionary of Arvanitika words recorded from speakers in Greece." } },
  { slug: "dhora", ref: "Dhora, Fjalor i emrave të kafshëve në Shqipëri", ids: ["dhora"], kind: "study", title: "Fjalor i emrave të kafshëve në Shqipëri", author: "Dhora",
    about: { sq: "Emrat popullorë të kafshëve në krahinat e Shqipërisë.", en: "The folk names of animals in the regions of Albania." } },
  { slug: "morina-juridik", ref: "Iset Morina (red.), Fjalor juridik, e drejta private, publike dhe penale", ids: ["morina-juridik"], kind: "study", title: "Fjalor juridik", author: "Iset Morina e të tjerë",
    about: { sq: "Fjalor i termave juridikë të së drejtës private, publike e penale.", en: "A dictionary of the legal terms of private, public and criminal law." } },

  // ── open data and corpora ──
  { slug: "korpus-dialektor", ref: "The Albanian Dialect Corpus", ids: ["korpus-dialektor"], kind: "digital", title: "The Albanian Dialect Corpus", author: "Rexhep Shijaku, Ercan Canhasi",
    about: { sq: "Korpus me shkrime të njerëzve në gegërisht, nga Kosova e Maqedonia e Veriut.", en: "A corpus of people's writing in Gheg, from Kosovo and North Macedonia." } },
  { slug: "korpus-i-folur", ref: "Albanian Spoken Corpus in Kosovo 1.0", ids: ["korpus-i-folur"], kind: "digital", title: "Albanian Spoken Corpus in Kosovo", author: "CLARIN.SI",
    about: { sq: "Shqipja e folur në Kosovë, e shënuar nga fjalimi i 212 folësve.", en: "Spoken Albanian in Kosovo, written down from the speech of 212 speakers." } },
  { slug: "hplt", ref: "HPLT v2 dhe 3.0 — korpusi i pastruar shqip", ids: ["hplt", "korpus-gege"], kind: "digital", title: "HPLT, korpusi shqip i uebit", author: "Projekti HPLT",
    about: { sq: "Miliona faqe shqip të uebit. Prej numërimit të fjalëve dolën mijëra forma gege e toske që njerëzit i shkruajnë sot.", en: "Millions of Albanian web pages. Counting their words gave thousands of Gheg and Tosk forms that people write today." } },
  { slug: "macocu", ref: "MaCoCu — korpusi shqip i uebit 1.0", ids: ["macocu"], kind: "digital", title: "MaCoCu, korpusi shqip i uebit", author: "Projekti MaCoCu",
    about: { sq: "Korpus me 528 milionë fjalë shqip, që na tregon sa përdoret çdo fjalë.", en: "A corpus of 528 million Albanian words, which tells us how much each word is used." } },
  { slug: "wiktionary", ref: "Wiktionary", ids: ["en-wiktionary", "wiktionary-other"], kind: "digital", title: "Wiktionary", author: "Kontribuesit e Wiktionary",
    about: { sq: "Fjalori i lirë shumëgjuhësh. Prej tij erdhën fjalë, kuptime, format e lakimit e zgjedhimit dhe forma dialektore.", en: "The free multilingual dictionary. It gave words, meanings, inflection tables and dialect forms." } },
  { slug: "wikifjalor", ref: "Wikifjalor", ids: ["sq-wiktionary"], kind: "digital", title: "Wikifjalor", author: "Kontribuesit e Wikifjalorit",
    about: { sq: "Wiktionary shqip, i shkruar nga komuniteti.", en: "The Albanian Wiktionary, written by the community." } },
  { slug: "wikidata", ref: "Wikidata", ids: ["wikidata"], kind: "digital", title: "Wikidata", author: "Kontribuesit e Wikidata",
    about: { sq: "Baza e lirë e të dhënave, me fjalë shqip dhe kuptime të shkurtra.", en: "The free knowledge base, with Albanian words and short meanings." } },
  { slug: "albanet", ref: "Albanet — WordNet shqip", ids: ["albanet"], kind: "digital", title: "Albanet, WordNet shqip", author: "Ervin Ruci",
    about: { sq: "Rrjet fjalësh shqip të grupuara sipas kuptimit.", en: "A network of Albanian words grouped by meaning." } },
  { slug: "uniparser", ref: "Uniparser: leksiku i gjuhës shqipe", ids: ["uniparser"], kind: "digital", title: "Uniparser", author: "Maria Morozova, Alexander Rusakov e të tjerë",
    about: { sq: "Leksik i hapur i shqipes për analizën e fjalëve, me mijëra fjalë të rralla.", en: "An open lexicon of Albanian for word analysis, with thousands of rare words." } },
  { slug: "tatoeba", ref: "Tatoeba", ids: ["tatoeba"], kind: "digital", title: "Tatoeba", author: "Kontribuesit e Tatoeba",
    about: { sq: "Fjali shembull shqip me përkthim anglisht.", en: "Albanian example sentences with English translations." } },

  // ── our own work and the speakers ──
  { slug: "folesit", ref: "Folësit e dialekteve", ids: ["folesit", "si-e-thua"], kind: "ours", title: "Folësit e shqipes", author: "Folës vendas dhe vizitorët e faqes",
    about: { sq: "Fjalë që njerëzit i thonë në shtëpi e në fshat. Disa i dhanë folësit vetë, të tjerat erdhën nga «Si e thua ti?».", en: "Words people say at home and in the village. Some were given by speakers, others came from “How do you say it?”." } },
  { slug: "rregull-gege", ref: "Forma të rregullta gege", ids: ["rregull-gege"], kind: "ours", title: "Forma të rregullta gege", author: "FjaloriShqip",
    about: { sq: "Forma gege në -ue dhe -uem të ndërtuara me rregull nga foljet në -oj, secila e shënuar si e tillë.", en: "Gheg forms in -ue and -uem built by rule from verbs in -oj, each marked as such." } },
];
