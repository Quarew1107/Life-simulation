# Adding a language

Languages in the game: English, Simplified Chinese, Japanese, Korean and Spanish (machine drafts until a native
speaker reviews them). The drafts in parts and the English source parts are in `translations/` on the owner's
laptop only (not on GitHub); the game uses only `js/i18n/`.

The game's text system (`js/core/i18n.js`) was built for Simplified Chinese (PL-17) and works the same way for any
language. The English, the saves and the fingerprints never change: a language only changes what is shown.

## What a language is made of
| File | What goes in it |
|---|---|
| `js/i18n/<code>.js` | Interface texts by key, the same keys as `js/i18n/en.js` (`LES.I18n.add('<code>', {...})`). Keep every `{placeholder}`. Plural forms: `{ one: '...', other: '...' }`. Short data names can be `g:<English>` keys. |
| `js/i18n/<code>-sentences.js` | Sentence patterns that turn the engine's English records into the language (`LES.I18n.sentences`), then the glossary of data names and descriptions by exact English text (`LES.I18n.glossary`). Copy `zh-Hans-sentences.js` for the full list of English to cover: the English side (the patterns and the glossary keys) stays as it is; only the templates and values change. |

Then add the language to `I.LANGS` in `js/core/i18n.js` (for example `['es', 'Español']`), and if it needs its own
fonts or sizes, a block of `html:lang(<code>)` rules in `css/style.css` (see the Chinese block).

## How the lookup works (so you know what to translate)
- Interface texts: by key (`I.t`).
- Records the engine writes in English (the event feed, life stories, the newspaper): matched against the sentence
  patterns; `{1}`, `{2}` are the pattern's parts, and each part is looked up again (a job, a goal, a reason inside
  the sentence), so fixing a name in the glossary fixes every sentence that contains it.
- Data names (jobs, courses, festivals, laws...): the glossary, by exact English text; a lower-case name inside a
  sentence also finds its capitalised entry; "Senior / Lead / Head / Chief" + a title uses the `g:Senior *` keys.
- Values in a text that carry a data name (`{job}`, `{home}`, `{course}`, `{goal}`...) are looked up too.

## Word order and grammar
Each pattern's template can put the parts in any order (`'{2}的{1}'`). Languages with grammatical gender (Spanish:
abogado / abogada) need more: the engine's sentences do not say whether a person is a man or a woman. Plan that
before starting (for example, pass the person's sex when a record is shown).

## Checking the work
```
python tools/i18n-check.py audit --lang <code>
python tools/i18n-check.py scan --lang <code> --out scan.txt
python tools/i18n-check.py scan --lang <code> --stage child --out scan-child.txt
```
- `audit` lists data names with no translation (jobs, courses, festivals, laws, offices, statistics sources...).
- `scan` plays a world in the language for each country, opens every tab, people, buildings and dialogs, and lists
  text still in English with where it was seen, then the most common English phrases. It recognises the game's own
  English texts and sentences, so it works for languages written in Latin letters too; for Chinese, Japanese and
  Korean it also reports any Latin word that is not a name. Run it for several `--stage` values (baby, child, teen,
  adult, senior) to cover every part of Play a Life. `--missed` also lists Latin-letter text it did not report (to
  check the scanner itself).
- People, towns, businesses, listed companies, newspapers and gangs are names and stay as they are.
- Then the tests: `await LES_TESTS.i18nTests()` (keys and placeholders match English) and
  `await LES_TESTS.i18nSentenceTests()` (Chinese today; copy its checks for a new language), then the full suite.
- Last, a native speaker's review (see `docs/PL-17_REVIEW.md` for the Chinese checklist).
