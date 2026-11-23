# Translations in progress

Drafts of new languages, made in parts (for example by ChatGPT), are saved here before they go into the game:
`translations/<code>/` holds the parts, named by part (`ja-01.js` ... `ja-16.js` for the interface texts,
`ja-s1.js`, `ja-s2.js` for the sentence patterns, `ja-g1.js` ... for the glossary).

The game does not load this folder. When all parts of a language are here, Claude joins them into
`js/i18n/<code>.js` and `js/i18n/<code>-sentences.js`, adds the language to the picker, checks placeholders and
coverage (`python tools/i18n-check.py audit|scan --lang <code>`) and runs the tests. See `docs/TRANSLATING.md`.
