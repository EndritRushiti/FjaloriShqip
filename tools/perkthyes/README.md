# Përkthyesi i dialekteve (offline)

A first, word-by-word converter from dialect text to standard Albanian. **It is not part of the website**: nothing in `scripts/`, `src/` or the deploy reads this folder. It stays here until it has been tested and approved.

```
npm run data                                         # builds data/fjalori.json first
node tools/perkthyes/perkthyes.mjs "Ku âsht shpata, atje besa."
node tools/perkthyes/perkthyes.mjs --test            # measure it on thenie/thenie.tsv
node tools/perkthyes/perkthyes.mjs --test --show     # every saying: dialect / machine / our standard
```

How a word is found, in order:

1. `trajta.tsv`: irregular forms checked by hand (âsht → është, jati → ati, vëllazën → vëllezër).
2. The dictionary itself: standard headwords and their listed forms, then dialect words linked to a standard word (variant links, dialect forms).
3. Standard endings the dictionary does not list (pulja, majmuni, digjet).
4. Regular rules: old -ë endings (ditënë → ditën, mbetetë → mbetet), Gheg â/ê, -un/-ue participles, elided words (t', dit'), Hahn's spellings (dhé, shigjetta, vitshi).

Unknown words come out as `[word?]`: these are the words the dictionary still needs.

The `--test` run also passes our standard versions through it: they must come out unchanged, so a rule that breaks standard text shows up at once.
