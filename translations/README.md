# Translations in progress

Drafts of new languages, made in parts (by ChatGPT), are kept here before and after they go into the game.

| Folder | What it holds |
|---|---|
| `source/` | The English to translate, in 24 ready-to-paste parts: `en-01.txt` ... `en-16.txt` (interface texts, from `js/i18n/en.js`), `en-s1.txt`, `en-s2.txt` (sentence patterns: fill the empty templates), `en-g1.txt` ... `en-g6.txt` (glossary: fill the empty values). Regenerate them when English texts are added. |
| `Japanese/`, `Korean/` | The ChatGPT parts for Japanese (`ja-01.js` ... `ja-g6.js`) and Korean (`ko-...`). Joined into `js/i18n/ja.js`, `ja-sentences.js`, `ko.js`, `ko-sentences.js` (Nov 2026). |
| `Spanish/` | Next: the parts for Spanish (`es-01.js` ... `es-g6.js`). |

The game does not load this folder. When all parts of a language are here, Claude joins them into
`js/i18n/<code>.js` and `js/i18n/<code>-sentences.js`, adds the language to the picker, checks placeholders and
coverage (`python tools/i18n-check.py audit|scan --lang <code>`) and runs the tests. See `docs/TRANSLATING.md`.
Texts added to the game after a language was made are added by Claude (they show in English until then).
