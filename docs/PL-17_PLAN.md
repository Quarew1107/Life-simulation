# PL-17 plan: full Simplified Chinese (draft for the owner, Nov 22 2026)

Status: **not started; waiting for the owner's approval.** Written after PL-15 so the next session can start at once.

## Where things stand
- The translation system (`LES.I18n`, `js/i18n/en.js`, `js/i18n/zh-Hans.js`) is in place. Every one of the
  2,350 English texts already has a Chinese version (the tests check keys and placeholders match).
- Fully translated: Play a Life (all of My life, the 320 life moments, the Story and Planner views) and the
  setup screen.
- Still English, written straight into the code (rough count, 22 Nov 2026):

| Where | Texts (approx.) | What it is |
|---|---|---|
| `js/ui/panels.js` | 140 | Person panel, leaders, events feed, stats |
| `js/ui/report.js` | 140 | The simulation report |
| `index.html` | 60 | Tab names, buttons, help |
| `js/ui/gov-ui.js` | 60 | Government, council, treasury |
| `js/ui/society-ui.js` | 55 | Class, ethnicity, religion |
| `js/ui/crime-ui.js` | 50 | Crime, police, justice |
| `js/ui/cast-ui.js`, `js/ui/places.js` | 35 each | My Cast creator, places |
| `js/main.js`, others | 60 | Toasts, errors, small labels (also the phone sheet handle's labels in `js/ui/sheet.js`) |
| Engine sentences (`pushFeed`, `P.log`) | ~200 patterns | News feed and each person's life history |

## Proposed steps (one at a time, each tested and pushed)
1. **Tabs and buttons** (`index.html`, `main.js`): names, tooltips, toasts. Small and visible everywhere.
2. **Person panel and feed screens** (`panels.js`).
3. **Government, society, crime, places, My Cast** (one file per step).
4. **The report** (`report.js`): the largest; its fingerprint check-values must not change (only text).
5. **Engine sentences**: store a key and its values instead of a finished English sentence (as Play a Life's
   journal already does), so old saves still show their English lines. This touches the engine's records, so
   the fingerprint tests must stay identical; old saves keep working.
6. **Quality check:** every screen at 320 px in Chinese, fonts, line breaks, numbers and money (RM, $, £, ¥).

## Rules
- Same key in both files, same placeholders; a missing Chinese text falls back to English, never an error.
- Changing the language never changes the simulation (already tested; repeat after each step).
- No release of the Chinese version until a native speaker has reviewed it (the task card requires this).
- Later languages (Spanish, Japanese, Korean) reuse the same keys.

## Questions for the owner
- Is a native Chinese reviewer available (you, family, a friend)? If not, the work can be done and marked
  "machine draft, not reviewed".
- Order: start with what you see most (tabs, person panel), or the report?
