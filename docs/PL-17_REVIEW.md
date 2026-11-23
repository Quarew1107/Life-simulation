# Chinese review checklist (PL-17)

The Simplified Chinese is a **machine draft**. Before it is released, a native speaker should read it in the
game. This page says where the text lives, what to look at, and how to fix something.

## Where the Chinese lives
| File | What it holds |
|---|---|
| `js/i18n/zh-Hans.js` | Interface texts by key (same keys as `js/i18n/en.js`), and short data names (`g:<English>` keys) |
| `js/i18n/zh-Hans-sentences.js` | Patterns that turn the engine's English records into Chinese, then the data glossary (settings, scenarios, buildings, laws, country notes, setup messages) by exact English text |

## How to review
1. Open the game, choose 简体中文 on the setup screen, and start a world (Malaysia first, then UK, US, China).
2. Go through every tab: My life (Play a Life on), Person, Leaders, Events, Place, Stats, Society, Crime, Gov't.
   Open the newspaper, the stock market, the Fate dialog (Person → More), My Cast, the comparison and the report.
3. Run a few years at a fast speed and read the event feed and a few life stories.
4. Try a phone-sized window (about 360 px wide): nothing should spill off the screen.

## What to look at
- **Natural wording:** sentences that read like a translation.
- **Pronouns:** some life-moment texts use 他 for "they"; newer texts use 其 / 此人. Pick one style.
- **Terms:** B40 / M40 / T20, EPF, Bursa, SPM and Malay place names are kept as in Malaysia. Is that right for
  readers in Malaysia? Should Malay names get Chinese in brackets?
- **Dates:** shown as 第2年2月5日 (Year 2, February 5).
- **Numbers and money:** RM / £ / $ / ¥ with English-style digits (RM1,200).
- **Long paragraphs:** country notes (taxes, laws, the bank), the report's analysis.
- **Anything still English:** names of people, towns, businesses and gangs are meant to stay as they are.
  Anything else in English is a gap: note the exact English text.

## How to fix something
- An interface text: change its value in `js/i18n/zh-Hans.js` (keep the `{placeholders}` exactly).
- A data name or description: change it in the glossary block of `js/i18n/zh-Hans-sentences.js`
  (or the `g:` entry in `zh-Hans.js`).
- An event-feed or life-story sentence: change the Chinese template of its pattern in
  `js/i18n/zh-Hans-sentences.js` (`{1}`, `{2}` are the parts taken from the English sentence).
- After changes, run `await LES_TESTS.i18nSentenceTests()` and the adult tests (they check placeholders).

## When it passes
Remove "machine draft" from the plan (`docs/PL-17_PLAN.md`) and the file headers, and record the reviewer and
the date in `docs/HANDOFF.md`.
