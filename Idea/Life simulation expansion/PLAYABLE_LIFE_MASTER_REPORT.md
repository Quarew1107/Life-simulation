# Life Evolution Simulator — Playable Life Mode
## Comprehensive product, systems, event, UI, technology and delivery design

**Design version:** 1.1 | **Date:** 13 November 2026 | **Owner:** Life Evolution Simulator | **Implementation target:** Claude Opus 5.5 Medium | **Status:** DESIGN / NOT IMPLEMENTED

**Read together with:** `README_START_HERE.md`, `design/00_VERIFIED_CONTEXT_AND_OPEN_DECISIONS.md`, `design/06_MECHANICS_BALANCING_AND_NUMERIC_RULES.md`, `prompts/CLAUDE_OPUS_5_5_MEDIUM_TASK_CARDS.md` and `catalog/ALL_EVENTS_REVIEW.md`. Those are separate to keep the implementation prompt small. The attached `assets/*.svg` and PNGs are **visual design mockups**, not production UI code.

**Source boundary:** The owner uploaded `HANDOFF.md`, `ROADMAP.md` and `PERFORMANCE.md`. These were reviewed. Their then-current handoff lists **rules revision 10: mixed-age founders and population balancing as in progress on branch `wip/rev10-founders`**. A live checkout of GitHub HEAD was unavailable in the report environment; PL-00 must pin the current commit when existing work finishes. No simulation source was changed or pushed by this design.

---

## Executive conclusion

Build **Play a Life**, a prominent **OFF-by-default** way to take over one real resident of the autonomous, multi-generational town. The player chooses intentions and manages priorities, but other residents remain independent and must consent to relationships, jobs, family and financial arrangements. Town laws, schools, business cash, wages, births, health, taxation and migration remain real simulation mechanisms. The personal story emerges from those mechanisms. Once the resident dies, the same world persists: take control of a living descendant, a random/specific other resident, or watch the world.

**Differentiator:** The experience has the readability and excitement of BitLife, but decisions have traceable consequences for a **real existing society**. A player employing a baker creates a genuine job for a named unemployed resident; selecting a prestige school does not automatically award intelligence; helping a struggling business changes recorded ownership and real wages/taxes; a local flood or doctor shortage is a world condition, not an isolated prompt.

**Deliverables:** 320 independently drafted **candidate** scenarios and 962 distinct response labels, including **120 adulthood** scenarios; 57 high-priority bindings to actual/required game mechanics; algorithms, economic and school parameter proposals, five illustrated interface wireframes, architecture and localisation specifications, acceptance tests, and 18 staged Claude implementation cards. **These are design artifacts, not verified executable events.**

| Life stage | Age | Scenarios | Control model | Core emphasis |
|---|---|---:|---|---|
| Baby & toddler | 0–2 | 50 | Express preferences, caregiver decides | attachment, health, play, early learning |
| Childhood | 3–11 | 50 | Low-risk autonomy; parent controls major cost and school choice | primary education, friendships, hobbies, family |
| Teen | 12–17 | 50 | Growing independence; guardian/legal approval for material commitments | study, exams, school, peers, work |
| Adulthood | 18–59 | **120** | Direct player intentions; NPCs/laws/markets retain authority | love, work, business, investing, family, civic life |
| Senior | 60+ | 50 | Direct agency within health and affordability | retirement, mentoring, care, legacy |
| **Total** | | **320** | **962 option labels** | 224/320 `society_linked` editorial concepts (70%) |

The extensive **full event list** is in `catalog/ALL_EVENTS_REVIEW.md`. Individual short JSONL files let Claude process one stage, topic or small tranche at a time. Those event records are deliberately *intent-only* and do not contain invented one-click success rates or generic monetary costs.

## 1. Existing game baseline and change isolation

The game currently uses ordered plain JavaScript IIFE modules under `LES`, with a Node-compatible headless runner, country packs, seeded RNG streams, immutable historical fingerprints, a real financial ledger in integer sen, My Cast founders, God Mode Fate, the education/admissions system, four countries and up to three towns. It already supports the research/spectator game without this new feature. **Protect all of it.**

The uploaded `PERFORMANCE.md` reports that a 2,500-founder China world improved from around 12 to 27 simulated days/s (around 33 Turbo) through rendering/scheduler changes; single-town step costs are broadly linear, and moving the entire world into a Web Worker would have high integration overhead for limited benefit. Thus evaluating 320 narrative entries for every resident/day or attempting multithreaded person decisions would be a poor approach. Load only age/context-specific opportunities for the ONE controlled character.

The in-progress rev10 work alters founder age mix, fertility, migration and mortality. Play a Life must inherit the completed rev10 baseline **rather than embed another population-balancing layer**. The existing `Idea/` documentation folder is ignored by Git per the handoff; do not accidentally commit it. See `design/00_VERIFIED_CONTEXT_AND_OPEN_DECISIONS.md` for source-to-design traceability.

### Core invariants

1. Mode OFF: identical historical gameplay, seeded RNG and saves; the feature should impose negligible runtime overhead.
2. Mode ON: player chooses attempts, not outcomes; one active resident; all others follow existing autonomous logic.
3. The controlled resident is a canonical `World` person with actual relationships, wages, needs, purchases, mortality and estate.
4. Commands run exactly once at a documented safe simulation step; UI does not directly edit ledger/person state.
5. Country laws and age/guardian rules must be evaluated at decision time, not inferred from translated labels.
6. Player worlds are labelled `played / intervened` in any statistical comparison; changing display language or map appearance never changes the engine.

## 2. What to borrow from other life-simulation games

**BitLife — Life Simulator is the primary model** for approachable text-based life moments, career/education/relationship actions, birth-to-death story arcs and unexpected consequences (official site and app-store description). **The Sims 4** informs readable character panels and relationships; **Growing Up** informs school/friendship stages; **Chinese Parents** informs family pressure and educational choice; **This Grand Life 2** informs time/money trade-offs and an autonomous routine; **Crusader Kings III** informs dynasty, succession and long-term cascading legacies.

Avoid copying any game's original text/art or implying its mechanics are patented. Our meaningful differentiation is the linkage between every socially important decision and the existing town's people, employer, households, services, government and ledger. The 224 `society_linked` tags are editorial design intent; they do not prove formal copyright uniqueness, and must be verified during implementation.

See `research/COMPARATIVE_GAME_DESIGN.md` for the game-by-game source-backed matrix.

## 3. Experience design: modes and playable person creation

### Start screen

Display two equally visible setup choices: **Watch the World — default** versus **Play a Life — OFF until explicitly enabled**. Show a compelling short summary: “Live one resident's life. Make decisions. Watch the whole town respond.” Include a language selector that is independent of country selection, a control over important-event frequency, and optional mature-story toggle OFF by default.

When enabled, default to **Random Life** (random authentic resident and random existing stats), with **Create My Character** using the existing My Cast path, and **Pick Existing Resident** as an advanced option. Current random residents may be adults; disclose their current age. Provide an explicit **Start at Birth** option in the baby-stage implementation (PL-05) using a genuine newborn and real caregiver/guardian. Where day-0 founder generation does not admit babies, allow the player to wait in spectator mode for the first actual birth rather than fabricating one; test the full 0-to-80 path. Do not silently fake a child, orphan, wealth or parent.

Suggested standard custom stats: six existing attributes totalling 30 points, each 2–8, subject to verifying the present founder distribution. Appearance is cosmetic. Unlimited custom stats/starting assets only under clearly labelled advanced/sandbox intervention and excluded from standard research comparisons.

### During play

A “Your Life” panel shows the resident's portrait, age/stage, wellness, available cash, goals, family, job/school, next appointment, important situation and quick tabs. The original town map remains live and the active player receives a cosmetic halo/bookmark. An optional life journal records important events, decisions, consequences and society impacts.

Use the existing default autonomous routine for daily living; the player can shift priorities and choose major actions. The person must still sleep, earn, study, pay bills and experience normal mortality. Allow **Delegate this decision** and **Remind me later**. Most optional activities belong in action menus/inbox rather than blocking pop-ups.

### After death

Normal world death and estate routines run first. Then pause at an accessible `Continue the Story` screen: (a) select a living offspring if any; (b) choose a random living resident; (c) search and choose any eligible named living resident; (d) stop controlling and return to spectator. Save the entire succession chain and remain in the same simulation year. Creation of a brand-new character in the middle of a running world is future scope.

## 4. The two-hour life pacing target — important technical correction

An 80-year simulated life contains about 29,220 simulated days. Two wall-clock hours at any nominal setting requires approximately **4.06 simulated days/second** if there are no reading/decision pauses. With a plausible 15 minutes of paused reading and choices, running time falls to 105 minutes, so the required rate is **4.64 days/second** while advancing. With 25 minutes of paused play, it is about **5.25 days/second**.

The existing `10x` label does **not** necessarily mean any of these speeds. `HANDOFF.md` references default `60x` and a user concern about its human-time meaning; `PERFORMANCE.md` measures a different quantity, maximum achieved days/second. Claude must measure the actual scheduler before tying a “2-hour Life” promise to `10x`. If necessary add a clearly named **Story Pace** preset with a user-visible estimated lifetime duration; retain the existing speed controls. Life expectancy itself is not guaranteed to 80 years and player choice dwell varies, so this is a **target**, never an outcome guarantee.

The catalogue is not a to-do list for a single life. Most scenarios never trigger during a given lifetime; the player can choose 50 short events from a library of 320. Proposed Balanced setting: roughly 60–100 significant interruptions in a complete life, plus optional non-blocking activities. More are concentrated around school graduation, early career, family formation and major setbacks. Babies should see very few full modals despite the 50 possible baby situations. Important-only and Detailed adjust interruption priority, not the rules of the world.

**Priority rule:** controlled person's death/serious transitions and irreversible commitments can pause; low-priority leisure, gossip, monthly birthdays, routine finances and newspaper items go to a journal or inbox. Expiring opportunities display deadlines. Do not make the user confirm a normal work shift 29,000 times.

## 5. Life-stage agency and available activity families

The baby stage offers signals of comfort, exploration, play and family attachment; guardians can respond, not obey a baby's legal contracts. Childhood offers hobbies, effort, peer relationships, school happenings and age-suitable community tasks. Teens can request secondary-school paths, exam preparation, limited lawful part-time work, peer relationships, family negotiations and mentorship; parents/guardians retain real authority over major expenses and admission. Adults can apply for jobs, build and sell firms, invest, buy homes, choose lawful lottery participation, travel, seek consensual partners, commit to or exit relationships, have children through established processes, confront difficult personal decisions and participate in town institutions. Seniors can manage retirement, health, mentorship, intergenerational help, property and estate plans.

Adulthood contains **twelve families of ten situations**: `career`, `business`, `finance`, `romance`, `family`, `health`, `housingtravel`, `civic`, `risk`, `setbacks`, `learning`, and `society`. This naturally supports 120 distinct situations without hiding everything behind one “activities” list.

Sensitive content (mental-health crises, death, infidelity, mature relationships, crime) should be age-gated, non-graphic and optional where appropriate. Adult relationships require mutual agreement; never make NPCs compliant because a player clicks them. Teenage experiences remain age appropriate; no adult/minor intimate scenarios. Self-harm themes may be non-graphic crisis/support narratives where modelled, not a repeatable method-based or rewarded death button.

See `catalog/ALL_EVENTS_REVIEW.md` and `catalog/{baby,child,teen,adult,senior}_events.jsonl` for all 320/962 complete titles/response labels; `catalog/PRIORITY_EVENT_BINDINGS.tsv` maps 57 of the most important to valid entity/cost/outcome routes.

## 6. Four-tier school choice — flagship simulation mechanic

At a school transition, the teen chooses a **request**, not an instant place. Four genuine choices: government/public (free or low incidental cost), private (~0.35 times monthly median wage M), international (~1.10 M) and prestige/selective (~2.20 M). These are fictional initial fee multipliers to verify against the country pack and service provider, **not real national tuition estimates**. The public option must be capable of excellent results; a high price may purchase resources, networks and facilities but may also create family stress or a poor personality fit. School places, admissions, student priorities, funding and parent willingness are separately modelled.

For paid schools, apply hard legal/seat/affordability tests before the parent picks a school. Example: income 5,000 and essential obligations 4,300 leave only 700 per month. With M=3,000, private fees of 1,050/month and higher tiers cannot be paid sustainably without funding, a scholarship or sufficient liquid reserves. Parents may value academic fit, status, commute, friendships or happiness differently. Each guardian's personality matters; a teen preference receives some influence but not control. A controlled adult parent can apply for their child, but co-guardians, child's recorded preferences, admission and resources still constrain the result.

Initial score weights are specified in `design/06_MECHANICS_BALANCING_AND_NUMERIC_RULES.md` (normalized parent responsibility/values, actual household income and liquid buffer, child voice, school fit, stress and softmax temperature 0.8). Parent choice is stochastic and has a clear unsuccessful/fallback path. China's `zhongkao` and each country's education ages/entitlement must remain valid. Any fees or scholarships are real ledger transactions, and school peers are real other residents.

The OECD notes that differences between public/private PISA performance are heavily explained by socioeconomic mix; **do not wire school cost directly to intelligence or guaranteed happiness** (OECD, January 2024, DOI: 10.1787/90348307-en).

## 7. Mechanisms for adulthood choices

**Career:** Choose vacancies, apply, negotiate pay and schedule, pursue qualifications and move jobs. Employer decisions and realistic firms matter; a player cannot promote themselves for free.

**Business:** Start a company with real savings/loan and real market demand; hire named residents, negotiate wages, manage closures, ownership and grants. Ownership transfers conserve seller/buyer assets and business shares; government grants require budget and eligibility.

**Finance:** Household budgeting, savings, existing stock-market products, real debt and property ownership. No imaginary monthly passive-income generators. Optional fictional lottery: one legal-age ticket/month at 0.001M, with 15% small (0.002M), 2% medium (0.01M), 0.001% jackpot (10M), 82.999% no prize; expected payout 60% of stake, so **-40% expected return**; the organiser must be prefunded. No real-money betting.

**Love and family:** Dating, mutual exclusivity, marriage, consensual adult casual relationships, infidelity as an event with real trust and breakup risk, planned parenthood and childcare through existing family/reproduction systems. NPCs can refuse. Player parents can negotiate children's education without overriding other people's agency.

**Health and travel:** Service access and health coverage by country; domestic/overseas travel initially as a priced/time-consuming *abstract trip*, not a new playable country map. Career leave and family consequences follow actual time budgets.

**Community:** Petition a real council, join local volunteering, finance a school resource, respond to local events, assist a jobless neighbour, campaign lawfully. Government and public finances remain actual simulation entities; player influence does not guarantee policy approval.

**Unexpected life:** layoff, recession, bankruptcy, flood, caregiver illness, death, business competition, family disagreement, personal recovery; seeded context and repeated-life variation make the town feel alive. Results use existing mechanisms instead of a magical `success_gain` bonus. All costs, receipts and conditional state effects are in `design/06...`; the 57 priority routes are also available as machine-readable JSONL.

## 8. Event runtime, deterministic command processing and safety

Suggested command lifecycle (implementation must adapt to actual live `World.step` sequence): UI validates and queues the intent with immutable ID -> safe day boundary confirms actor alive, age, target, mode and funds -> current-world systems resolve counterpart reaction/admission/job/cost -> atomically commit genuine effects -> persist result once -> render localized message -> append journal and optional verifiable town-news receipt. Existing God Fate must retain its precedence; a dead actor's pending command cancels with zero charge. If an action is unavailable, show **why it is unavailable**, not a pretend success.

**Do not run the catalogue for every agent.** Maintain stage-specific event indexes; reevaluate the one controlled person at transitions and limited periodic checks. An event requiring a real employer or child must be linked to a real entity. Implement generic event scheduling **once**, then fill the library in small content tranches. The narrative UI can mark a nonmechanical outcome as “story-only” rather than silently changing statistics.

**Data contract:** stable `eventId`, `choiceId`, min/max age, trigger, availability facts, translation keys, source/target IDs, mechanic handler, cost basis from real in-world provider, adult/minor consent gates, result codes, cooldown, provenance and test case. The shipped JSONL is designed to be read by the developer, not executed as ready-to-use code. No `eval` or dynamic code execution from content files.

## 9. UI/UX strategy

Retain the current map, minimap, toasts, inspector, fonts and pixel art. Add a persistent but compact “Your Life” dock to the right of the canvas (mobile: expandable bottom sheet). Show six readable summary values at most, then contextual actions, decisions inbox and journal. A life stage governs which tabs appear and who can decide. Actions show **availability, actual costs, time, possible results and other real residents affected**. The player can inspect a short “Why did this happen?” explanation using already known decision factors, not bogus precision.

Provide **four distinct school-tier options** on one screen, an optional budget explanation and teen-parent consent workflow. On death, use a succession card with four handoff choices and a link to the past character's real life timeline. Avoid incessant pop-up modals. Use semantic color and accessible text, keyboard navigation, focus control and phone layouts.

The pack includes editable SVG + PNG design mockups: `assets/01_setup_off_default`, `02_playable_life_desktop`, `03_school_choice`, `04_succession`, `05_mobile_playable_life`. They are visual examples only, not game code or verified production graphics. The document `design/03_UI_UX_WIREFRAMES_AND_PLAYER_FLOW.md` specifies their behaviours.

## 10. Framework and website recommendation

**Vite first (later), React or Preact only as a small component island if needed.** Project size ~102 MB as reported by owner is not equivalent to a visitor's compressed first-load size. Audit Git history, assets, media and production network transfer before optimizing. Vite can build a static `dist/` for Cloudflare Pages, GitHub Pages, Netlify or similar. No server is required to let the public play a purely browser-local, single-player simulation. Preserve the current engine's ordered global scripts and its Node test harness via a gradual, reversible adapter; do not mix a major Vite/ESM rewrite with player-control changes. If React is introduced, mount it *only* in dedicated control panels and send validated commands through the existing LES adapter. PixiJS/Phaser is unnecessary absent a proven renderer bottleneck.

Website preparation requires large-save storage strategy (existing save export and IndexedDB if needed), offline behaviour, browser performance, CJK font handling, source licences and asset compression. No online multiplayer, backend accounts, remote computing or cloud saves in the first release. Cloudflare Pages currently limits a single asset to 25 MiB; content may need to be split and lazy loaded. See `design/04_FRAMEWORK_WEB_RELEASE_AND_ASSET_STRATEGY.md`.

## 11. Languages — prepare architecture now, translate after copy stabilises

Build presentation-only `LES.I18n.t(key, params)` with stable keys, English fallback and UI language as a separate preference. Existing country packs determine law, price, name order and currency; language `en`, `zh-Hans`, `es`, `ja`, `ko` changes text formatting only. Do not rewrite country rules or `World.hash()` when the language changes. For new events, record stable ID + option ID + parameters rather than freezing an English sentence in new save records. Legacy English log text remains readable as fallback. Avoid concatenated English phrase fragments and use whole messages for pluralization/grammar.

Start with small English and Simplified Chinese smoke locales so event cards can be validated before hundreds of events are fixed. Adopt i18next behind the facade when the build system is ready, not at the cost of breaking current file:// and Node workflows. Use CJK system-font fallback and test 320-pixel mobile width, text enlargement, country currency and long Spanish strings. Plan full Simplified Chinese first, Spanish and Japanese next, Korean optional; do not publicly advertise a translation before its critical-path coverage is complete. `design/05_INTERNATIONALISATION_AND_LOCALISATION.md` supplies the detailed QA matrix and file ownership.

## 12. Staged implementation, owner checkpoints and Claude token control

The task cards `PL-00` through `PL-17` comprise the following sequence. **Catalogue coverage is a release target, not achieved implementation:** replace any infeasible item with an equally meaningful, actual-world-backed event and transparently track counts:

| Stages | Deliverable |
|---|---|
| PL-00 | Confirm current merged code, rev10 status, baseline fingerprints, cost of 2,500-person world and actual APIs. **No game changes.** |
| PL-01 | Minimal i18n adapter, English keys and Chinese smoke UI; no big migration. |
| PL-02 | OFF-default setup; random/custom canonical resident; valid saved player identity. |
| PL-03 | Central validated command queue and safe-point event handling. |
| PL-04 | Working player dashboard, action categories, pause/delegate, verified pace. |
| PL-05/06 | Baby and childhood scenarios with guardians and real family/peer checks. |
| PL-07 | Teen school choice; 4-tier school access, affordability, scholarships and parental response. |
| PL-08–11 | Adult careers/finances, family/romance, businesses/civic impacts, wellbeing/travel. |
| PL-12 | Senior decisions and four-option life succession. |
| PL-13 | Editorially validated remaining 320-event library delivered in small batches. |
| PL-14 | Visual polish, performance and pacing playtest. |
| PL-15 | Full regression, saved worlds, ledger, countries, Classic and release decision. |
| PL-16 | OPTIONAL Vite static web build on separate branch after owner approval. |
| PL-17 | OPTIONAL full Simplified Chinese translation after English event copy stabilises. |

Each Claude task must read only its relevant one/two design files and 5–20 events. It must commit tested work, push **only** to the owner's authorised feature branch, state SHA/tests/limitations and **stop** until the owner reviews. Do not force-push/auto-merge to `main`; the active current demographic branch must be finished and reconciled first. If a feature is not feasible in the current engine, use a clear fallback or ask the owner only for truly consequential system-rule decisions. Do not invent code just to satisfy a story heading.

The feature is **not finished** because this design pack exists. It becomes deliverable only after real code, UI, save/load, deterministic replay and financial invariants have passed the matrix in `gates/ACCEPTANCE_TEST_MATRIX.md` and the owner approves release.

## 13. Risks and preferred mitigations

| Risk | Mitigation |
|---|---|
| 320 scenarios become 320 hardcoded special-case handlers | One command/event engine, indexed triggers, adapter per *actual* mechanism, editor-reviewed content slices. |
| Event catalogue contains arbitrary universal odds and cash rewards | Removed the earlier numeric placeholders; only 57 curated mechanic routes and tested per-country prices are permitted. |
| User-controlled character can duplicate money or influence research invisibly | Ledger, idempotency receipts, version gating and report provenance. |
| Child can buy school admission by clicking | Real guardian decision, affordability, admissions, capacity and country law. |
| More expensive schools guarantee high intelligence and happiness | Overlapping provider quality, family debt/stress, fit and genuine peer networks. |
| Player can force NPC consent or create babies directly | Reuse family/relationship/reproduction system with legal/consent gating. |
| Pop-up overload and 2h target missed | Major-event priority, paced Story mode, voluntary actions in inbox, playtest timing. |
| Perf impact in 2,500-resident China | Evaluate only one player, react to triggers, reuse existing Turbo/map UI and current daily tick. |
| Late i18n rework | Stable source keys and event/choice IDs from PL-01, full language independence from country. |
| Framework migration breaks old saves and global registration | Vite as separate tested reversible build phase; UI framework only if needed. |
| Current rev10 demographic work conflicts | PL-00 reconciliation + branch isolation; no changes until baseline committed. |
| Player assumes a what-if comparison proves causality | Honest labels, sample sizes, world intervention history and historical assumptions. |

## 14. Files and next owner action

**For the owner:** Read this report, `design/03_UI_UX_WIREFRAMES_AND_PLAYER_FLOW.md`, preview the 5 UI wireframes, browse `catalog/ALL_EVENTS_REVIEW.md` for the 320 prompts, review `design/06...` for costs and probabilities. All are editable Markdown/JSONL/SVG/TSV sources, rather than a single monolithic PDF.

**For Claude:** Unpack locally outside `Idea/` if that folder is Git-ignored, and start with `README_START_HERE.md` + `prompts/MASTER_START_PROMPT.md` + PL-00 only. Do not read 320 events in the first session. The current demographic work must be complete, tested and approved first.

## 15. External source bibliography

- BitLife official: https://bitlifeapp.com/ ; FAQ https://bitlifeapp.com/help/ ; storefront https://play.google.com/store/apps/details?id=com.candywriter.bitlife
- The Sims 4 careers: https://help.ea.com/en/articles/the-sims/the-sims-4/the-sims-4-careers/
- Growing Up: https://store.steampowered.com/app/1191120/Growing_Up/
- Chinese Parents: https://store.steampowered.com/app/736190/
- This Grand Life 2: https://store.steampowered.com/app/2459490/
- Crusader Kings III: https://www.paradoxinteractive.com/games/crusader-kings-iii/about
- OECD 2024 education comparisons: https://doi.org/10.1787/90348307-en
- Vite official: https://vite.dev/guide/ ; deployment https://vite.dev/guide/static-deploy
- React incremental integration: https://react.dev/learn/add-react-to-an-existing-project
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- i18next: https://www.i18next.com/principles/fallback

**Data vs proposal:** Existing architecture and performance claims above are attributed to the owner's three uploaded documents; competitor/framework features to the cited public owners/developers; all school fees, rule coefficients, event frequencies, creator point budgets and UI/wireframes are proposals for testing, not live-game or officially established national values.
