# PL-00 — Baseline and integration readiness (13 Nov 2026)

No simulation code was changed. This file is local only (`Idea/` is git-ignored).

## 1. Repository state
- Branch `main`, HEAD **bd96691** "Merge rules revision 10 (founders of all ages, population balance)", pushed to GitHub. Working tree clean.
- Rules revision 10 is **finished and merged** (the design package says "in progress on `wip/rev10-founders`": stale; that branch is deleted). The "minor improvements" the package mentions are this revision 10 work.
- Full suite: **403/403 pass** (headless Edge, 313 s) on the tree now in `main`.
- Defaults: `rulesRev` 10, founders of all ages, crime "Lively", speed 60× (index 2).

## 2. Package completeness
Only 5 of the referenced files are present: `PLAYABLE_LIFE_MASTER_REPORT.md`, `06_MECHANICS_BALANCING_AND_NUMERIC_RULES.md`, `ACCEPTANCE_TEST_MATRIX.md`, `ALL_EVENTS_REVIEW.md`, `CLAUDE_OPUS_5_5_MEDIUM_TASK_CARDS.md`.
Missing: `README_START_HERE.md`, `design/00`–`05`, `catalog/*.jsonl`, `catalog/PRIORITY_EVENT_BINDINGS.tsv`, `event_profiles.json`, `EVENT_LOOKUP_INDEX.json`, `TRANCHE_PLAN.md`, `LOCALIZATION_KEY_MANIFEST.jsonl`, `locales/`, `assets/` mockups, `research/`.
Workable without them: `ALL_EVENTS_REVIEW.md` holds every scenario ID, title and option label (the JSONL files were the same data split by stage); `06_…` holds the numbers. The 57 priority bindings and the UI mockups must be re-derived (I can do that per task) unless the owner supplies them.

## 3. Engine facts (actual code, not the design's assumptions)
| Need | What exists | File |
|---|---|---|
| Script model | Ordered global IIFE scripts under `LES`, no build step, runs from `file://`; 58 scripts in `index.html` | `index.html` |
| Safe command point | `World.step` runs `LES.Cast.due` then `LES.God.apply` at the start of a day | `js/sim/world.js:316-318` |
| Command queue model | God Mode Fate: immutable `{id, kind, target, requestedDay, status}` in `w.intervention.pending`, applied once at step start, kept across save/load, marks `w.intervention.modified` (report says "intervened") | `js/sim/god.js` |
| Custom character | My Cast specs `{first,last,sex,age,eth,rel,att[6],pers{},famDesire,strategy,qual,cash,look,partner,parents}`; founders via `cfg.cast`, arrivals via `cfg.castArrivals`; own RNG stream per household | `js/sim/cast.js`, `js/ui/cast-ui.js` |
| Daily life | Every adult picks actions by softmax over candidates: `Actions.candidates/choose/resolve/liveDay` (70% of engine time) | `js/sim/actions.js` |
| Jobs | Vacancy market `w.vacancies`, `Labour.hire/endJob/enroll/graduate/dropOut` | `js/sim/labour.js` |
| Money | Integer sen ledger; `Finance.invest/buy/sell/startBusiness/sellBiz/closeBiz/moveHome/pickHome/raiseCash`, rev 9 retirement accounts | `js/sim/finance.js` |
| Family | `Family.matchSocial/formCouple/separate/desire/birth/addCare/findGuardian/settleEstate` | `js/sim/family.js` |
| Schools | Public schools staffed by the government; real **private school** businesses with seats and fees (`Services.schoolMonth`: families pay if fees < 12% of income) | `js/sim/services.js` |
| Death | `World.die` → guardians, estate, business succession | `js/sim/world.js` |
| Sister towns | People can move between towns (`p.away`; `God.resolve` follows them) | `js/sim/region.js` |
| Saves | `Save.VERSION = 1`, exact-version check; new optional fields load fine in old saves | `js/sim/save.js` |
| Text | All UI and log text is inline English; no i18n layer | everywhere |
| Speeds | `1×` = 1 min/s, **`10×` = 10 min/s**, `60×` = 1 h/s, `1d/s`, `10d/s`, `100d/s`, MAX | `js/main.js:9` |

## 4. Measurements
- Engine only (no drawing): Malaysia 100 founders **1,800 days/s**; China 2,500 founders **60 days/s**.
- **Pacing correction:** the owner's "10× for ~2 hours" cannot work: 10× is 10 simulated minutes per second, so a day takes 144 s and 80 years would take ~1,170 hours. A 2-hour life needs ~4-5 days/s while running (design §4 agrees). Proposal: add a **Story** speed (~5 days/s, shows "≈ 2 h per 80-year life") used by default in Play a Life; keep the existing speeds.
- Day-0 towns already contain babies (100-founder Malaysian town: 12 under 3, 9 aged 3-11, 6 teens, 70 adults, 3 seniors), so "start as a baby" can pick a real infant on day 0. Picking a true newborn (age 0) can wait for the first birth.

## 5. Feature status
`available` = an existing function does it; `bridge` = existing mechanic plus a thin player-only adapter; `new` = new mechanic needed; `owner` = needs your decision.

| Feature | Status | Notes |
|---|---|---|
| OFF-by-default switch, random resident | bridge | New `cfg.play` (absent = off, so old worlds/hashes untouched); pick a random living resident with a seeded stream separate from world RNG |
| Create my character | available | My Cast spec → real resident id |
| Pick existing resident | bridge | Searchable list; reuse Inspector |
| Command queue | bridge | Copy the God Fate pattern into `w.player.pending`, applied at the same step point |
| Steer daily priorities | bridge | Bias weights in `Actions.choose` for the one controlled person only |
| Apply for a job / quit / study | bridge | `w.vacancies` + `Labour.hire` with the employer's normal selection; `Labour.enroll` |
| Start / sell / close a business | available | `Finance.startBusiness/sellBiz/closeBiz` |
| Invest / sell shares | available | `Finance.buy/sell/invest` |
| Move home | available | `Finance.moveHome/pickHome` |
| Date / marry / separate | bridge | NPC consent from `Family.matchSocial` score; `formCouple/separate` |
| Have a child (plan) | bridge | Raise the couple's desire; birth stays probabilistic |
| Casual partner / infidelity | new + owner | No such state today; needs trust/discovery mechanics |
| School: public vs private | bridge | Both exist; parent choice logic is in `Services.schoolMonth` |
| School: international, aristocratic/prestige | new | No such institutions; either new private-school tiers (fees, seats, staff) or out-of-town schools paid to the outside sector |
| Baby/child expressions, hobbies, friends | new (light) | Children have no daily choices today; story events with small, real effects (stress, happiness, study effort) |
| Travel (domestic/overseas) | new | Abstract trip: cost to merchants, days away, happiness; must not reuse `p.away` (that means "lives elsewhere") |
| Lottery | new + owner | None today; fund-backed, -40% expected return per `06_…` |
| Suicide / self-harm | owner | Design recommends non-graphic crisis/support stories only, never an action button |
| Death → continue as child / random / chosen / watch | bridge | `World.die` already settles; UI picks next id |
| Controlled person moves to a sister town / emigrates | owner | Follow across towns is easy (`God.resolve`); emigrating abroad would end control |
| Languages | new | `LES.I18n` facade for new text only (PL-01); old text stays English until later |
| Played worlds marked in reports | bridge | Same flag as God Mode's "intervened" |

## 6. Stale or adjusted design assumptions
1. Rev 10 is done (not in progress). Lively crime no longer shortens lives; prisoners are fed and housed.
2. "Start at Birth" needs no waiting state on day 0: towns have infants. A true age-0 newborn still needs the first birth.
3. "10×" is not a story pace (see §4).
4. Saves have a strict single version (1); player state must be an optional field so old saves still load.
5. Only public and private schools exist; the four-tier choice needs two new tiers.
6. No i18n layer exists; PL-01's facade must coexist with ~all-English inline strings.
7. Some package files are missing (§2).

## 7. Smallest safe path (proposed)
- New files only where possible: `js/sim/player.js` (state, command queue, events), `js/ui/player-ui.js` (dock), `js/core/i18n.js` (PL-01).
- Engine touch points (each guarded by `w.player` existing): one line in `World.step` beside `God.apply`; one weight hook in `Actions.choose`; school choice hook in `Services.schoolMonth`.
- Mode OFF: no `w.player`, no extra RNG draws → identical hashes; a test pins this (same `stableHash` with the feature code loaded vs a saved fingerprint).
- Commit per task on branch **`feature/playable-life`**, push, never merge to `main` without you.

## 8. Ideas to make it more fun (practical, built on what only this game has)
1. **Ripple receipts**: every big choice shows the named residents it touched ("You hired Aina; her family moved up to a terrace house"). No other life game can do this.
2. **"Without me" twin**: Compare already re-runs a world; run the same seed without the player and show what the town would have been (richer? more equal?). A strong end-of-life screen.
3. **Dynasty chain**: after death, continue as a child; a family tree with each generation's life summary, wealth and legacy score (Crusader Kings feeling, cheap to build on existing family links).
4. **Rewind a decision**: saves are deterministic, so "what if I had chosen the other school?" can fork from an autosave before each big decision.
5. **Life ambitions** per stage (3 small goals, e.g. "own a home before 35"), shown in the dock; drives play without popups.
6. **Obituary card** generated from the journal, shareable as an image.

## 9. Decisions needed before PL-01
1. Missing package files: supply them, or let me work from the five present files (I will re-derive bindings per task).
2. Story speed: add a ~5 days/s "Story" speed for Play a Life (recommended), or change what "10×" means.
3. Branch name `feature/playable-life` OK?
4. Sensitive content: lottery (on, hideable?), casual partners and infidelity (adult content toggle off by default?), suicide handled only as non-graphic crisis/support stories?
5. If the controlled person emigrates abroad: block it for the player, or end control and offer succession?
