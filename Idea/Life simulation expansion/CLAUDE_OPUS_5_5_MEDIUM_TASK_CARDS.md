# Playable Life Mode - Claude Opus 5.5 Medium implementation task cards

**Scope:** User controls one resident inside the existing self-running society, from birth through old age where possible, with decisions, consequences, and succession. The normal spectator simulation must remain fully functional. The owner requested the ability to inspect each completed task and permits pushing reviewed task commits to **a dedicated GitHub feature branch**, not force-pushing or automatically merging to `main`.

**Source verification:** The owner supplied `HANDOFF.md`, `ROADMAP.md` and `PERFORMANCE.md` on 13 November 2026; the live GitHub revision was not fetchable in this design session. The uploaded handoff confirms the mixed-age/population balance rules revision 10 is in progress on `wip/rev10-founders`. First task MUST pin the actual repository after the owner's existing work is merged/reviewed. Do not duplicate or overwrite completed features.

## 0. Operating contract (applies to every card)

1. Run `git status` and inspect recently changed files. Do not reset or discard work, do not use `git clean`, no destructive commits, no force push.
2. Read only `README_START_HERE.md`, this card's entry and the **one or two relevant design sections**; do not read all five age-stage JSONL files. Never preload all 320 events or all detailed documents unless necessary.
3. Confirm every presumed function, file, class and field against actual source. This is design guidance, not an API contract.
4. Make smallest changes to the existing engine; no rewrite, no ML, no separate money/character simulation, no server prerequisites.
5. Preserve determinism, country packs, old saves, Classic fingerprints, financial ledger invariants, births/deaths, estate and God Mode. Document intentional rules-version/hash changes.
6. World mutations go through the engine's central safe-day lifecycle and validated action paths, never direct UI field edits.
7. Every code task: targeted tests -> relevant full regression -> diff review -> `docs/HANDOFF.md` short entry -> commit locally -> push the **authorised Playable Life feature branch** only if authenticated and within owner's standing authorisation. Do not merge to main. Never alter GitHub credentials, payments or external services.
8. Return: files changed, tests/results, measurable performance where relevant, new SHA, branch URL, known risks, exact next task. **STOP for the owner's review after each card.**
9. If usage limits interrupt work, leave an unambiguous short handoff; do not launch work in the background and promise later delivery.
10. The catalogued 962 choices are **intentions, not pre-awarded success/money/stat bonuses**. The earlier generic numerical data was removed because it could produce nonsensical costs (e.g. more expensive public-school request than private). Bind numerical behaviour to `design/06_MECHANICS_BALANCING_AND_NUMERIC_RULES.md` and the actual relevant world API. Use `catalog/PRIORITY_EVENT_BINDINGS.tsv` for 57 higher-priority mappings. No instant fantasy economic benefits.

## Ordered tasks and decision gates

| Task | Deliverable / focus | Essential gate |
|---|---|---|
| PL-00 | Baseline and code reconciliation | Actual HEAD, HANDOFF, ROADMAP, tests, 2,500-population profile, architecture map and conflicts known |
| PL-01 | i18n and stable content-ID foundation | English fallback, change language without RNG change, one Simplified Chinese smoke test |
| PL-02 | Player mode setup / resident selection | OFF by default; random existing resident and random stats default, custom path uses canonical person ID |
| PL-03 | Validated command queue and data-only event engine | Reject duplicate/invalid commands; deterministic, no money conjuring; spectator parity |
| PL-04 | Core UI and event pacing | Responsive player panel, pause/delegate, safe 10x target measurement, no popup storm |
| PL-05 | Baby 0-2 interactive slice | Age/guardian gates, 5-10 carefully tested sample scenarios; then first 50 at later content gate |
| PL-06 | Child 3-11 interactive slice | Preferences, guardianship, hobbies/peer relationships, safe time and ledger effects |
| PL-07 | Teen 12-17 and four-tier school decision | Actual guardian choice, affordability/admission, child influence, country legality; real funded scholarship if used |
| PL-08 | Adult career, education, housing and finance | Jobs, training, spending, investing only via existing financial systems; no invented instruments |
| PL-09 | Adult relationships, romance and family | Mutual NPC agreement, adult-only intimate content, real family/childcare lifecycle, infidelity consequences, no coercion |
| PL-10 | Adult entrepreneurship and society interactions | Actual business, civic, social and community economy; lottery only if lawful in game rules and funded/ledger-safe |
| PL-11 | Adult wellbeing, travel and sensitive stories | Non-graphic safeguards; optional content settings; travel abstractions not fictitious physical trips |
| PL-12 | Senior 60+, death and succession | 4 death handoff options, real offspring eligibility, no resurrection/duplicate estate, old-save compatibility |
| PL-13 | Broaden catalogue by age and category | Incrementally integrate 320 scenarios; no UI-only fake consequences; tests per tranche |
| PL-14 | UI/art polish and balancing | Readable tables, timelines, responsive mobile, person sprites, 2-hour pacing pilot and interrupt budget |
| PL-15 | Final integration / all-country test matrix | All tests; Classic hashes, save/load, cross-towns, finance, stochastic balance and 2,500-person performance |
| PL-16 | Optional Vite static build / web-ready work | Only if owner approves; reversible preview, no engine migration, asset/102-MB transfer audit |
| PL-17 | Full Simplified Chinese release | Only after stable English copy; namespace completeness, native language QA, same simulation hashes |
| Later | Spanish, Japanese, Korean | Same i18n keys; avoid separate rules engines |

Tasks can be grouped into smaller commits for Claude usage limits, but the owner reviews each task boundary. **Do not implement the whole roadmap in one session.**

## PL-00: repository baseline and integration readiness

**Read:** `design/01_PRODUCT_VISION.md` section 3-5, `design/02_SYSTEMS_LOGIC_AND_ALGORITHMS.md` sections 1-4, and this task's operating contract. Read real `docs/HANDOFF.md`/`ROADMAP.md`/`PERFORMANCE.md` before development; confirm rev10 branch merge state.

**Work:** Identify current world setup, My Cast, age, decisions, family, labour, economy, country packs, map UI, saves, rules version, tests, source/script loading order and future web build. Establish how the user's latest 2-hour minor improvements changed the system. Run seed/profile baseline for standard vs 2,500 China if feasible. Mark `available`, `requires bridge`, `requires new mechanic`, and `blocked/needs owner decision` for each planned feature.

**Gate:** Report exact current SHA/branch and stale design assumptions with smallest integration edits. No simulation changes. Stop before PL-01.

## PL-01: stable IDs and i18n core

**Read:** `design/05_INTERNATIONALISATION_AND_LOCALISATION.md` and `locales/en/common.json`, `locales/zh-Hans/common.json` and only two sample events. Do not preload other translations.

**Work:** One i18n instance (reuse existing library if present), English fallback, UI language hot-switch, namespace loader, stable canonical IDs for new event/choice records, namespace/placeholder validator, and non-RNG UI locale preference. Show working English/Chinese smoke screen. Integrate Vite only if necessary and separately gated; don't combine migrations.

**Gate:** Same seed/world fingerprints and valid saves in EN vs ZH; no hardcoded labels in new mode; missing translation safe. Do not claim full Chinese translation. If still running `file://`, introduce a minimal `LES.I18n` facade and English/Chinese smoke locales; defer i18next dependency until Vite without changing current file and headless workflows.

## PL-02: entry and character creation

**Read:** `design/01_PRODUCT_VISION.md` and `design/02_SYSTEMS_LOGIC_AND_ALGORITHMS.md` section 2; `design/03_UI_UX_WIREFRAMES_AND_PLAYER_FLOW.md` setup wireframe.

**Work:** Prominent OFF-default setup switch. When ON default selects a randomly eligible real resident with randomly generated attributes under **current existing** mechanism. Optionally create custom attributes through existing My Cast canonical creation. No bonus currency, orphan, fake household or reinitialising world. Defer mid-run creation. Add spectator-entry parity tests.

**Gate:** Both modes work; old saves still work; custom creations have one actual resident ID; stage/age shown accurately.

## PL-03: engine command and narrative event framework

**Read:** `design/02_SYSTEMS_LOGIC_AND_ALGORITHMS.md` sections 1, 4, 6-11; `catalog/event_profiles.json`, `design/06_MECHANICS_BALANCING_AND_NUMERIC_RULES.md` relevant sections and **five representative events only**.

**Work:** Implement a minimal vertical-slice example for a controlled adult (e.g. apply to a real vacancy and receive an actual refusal/offer), then implement the targeted command adapter at safe day boundary with idempotency, action preconditions, NPC consent, result codes, a time budget, cooldowns and a translation-ready message ID. Do not use `eval` on JSON. No new parallel ledger. Ensure event eligibility runs only for the controlled resident at relevant cadence (not everyone per day).

**Gate:** One real adult request-and-result demonstration, plus duplicate/stale/dead commands rejected; proper transfer counterparties; OFF mode unchanged; hash parity where applicable; old saves load.

## PL-04: core player UI and clock / pacing

**Read:** `design/03_UI_UX_WIREFRAMES_AND_PLAYER_FLOW.md` and section 4 of the system design.

**Work:** Player dashboard with portrait, age/stage, four to six readable action categories, timeline, optional decision drawer, pause/resume/delegate, event frequency options and no mandatory monthly popup. Keep current map. Add accessible labels and keyboard/screen reader support. Measure actual 10x simulated days/s; do not hardcode the 2h promise.

**Gate:** Controls remain responsive at 2,500 residents; routine state changes don't slow the game unnecessarily; key contexts render in English and Chinese smoke locale.

## PL-05: baby/toddler stage

**Read:** `catalog/baby_events.jsonl` only as a **small first sample** (5-10); do not read all 50 at once.

**Work:** First establish a tested **Start at Birth** selection path using an actual living newborn and the existing canonical family/guardian lifecycle; if day-0 founder creation cannot safely supply a newborn, provide an opt-in start at the first naturally occurring birth with a clear waiting/spectator state (do not invent an orphan or bypass population rules). Babies express preferences/needs; caregiver retains authority. Reuse guardian, wellbeing and existing lifespan logic. Mild events: comfort, play, sleep, early illness, sibling relationships; no independent purchases, legal contracts or adult agency.

**Gate:** An actual newborn can be selected and followed from age zero, with a real caregiver or existing welfare pathway; safe time handling, no fictional self-executed contracts; absence of caregiver uses existing welfare logic.

## PL-06: childhood stage

**Read:** `catalog/child_events.jsonl` subset by family. Do not preload adult catalogue.

**Work:** Integrate hobbies, friendships, study effort, play and parental requests. Material fees require caregiver/guardian budget. Add contextual results visible to the player without guaranteed stat gains.

**Gate:** No minor unsanctioned school fees; no magic relationships; parent denial and child preference supported.

## PL-07: teen school-choice example and agency

**Read:** `design/02_SYSTEMS_LOGIC_AND_ALGORITHMS.md` section 5, teen catalogue education entries, country rules.

**Work:** Four-tier education options as **proposed design labels**; country-pack overrides; hard feasibility/affordability/admission gates; probabilities for parent choice via current income, liquid wealth, responsibility, education preference, academic fit, child opinion and context. Real institutions/scholarship money only if feasible. Teen influence is advisory and increases with age. Preserve exam/university baseline models and education calibration.

**Gate:** Poor family cannot randomly pay impossible tuition; wealthy family not guaranteed prestige school; cheaper public option can be excellent; missing optional school entity has explicit fallback. Tests for both guardians, refusal, scholarship, progression and no money creation.

## PL-08: adult career, education, housing and finance

**Read:** `catalog/adult_events.jsonl` **career, education, finance, housing families only**, and existing employment/finance modules.

**Work:** Applications, job fit, salary negotiations, job change, training, investments, leases and housing through existing entities. A tap may request an opportunity; success depends on employer/institution/counterparty. All monetary effects backed in ledger.

**Gate:** Sufficient/insufficient funds, rejected offers, fraud-free cash flows, unemployment, save/replay, country differences, no fictitious financial product.

## PL-09: adult relationships and families

**Read:** adult catalogue relationship and family entries; existing relationship/reproduction/death systems.

**Work:** Mutual adult partner consent and compatibility; dating, marriage, cohabitation, separation, infidelity as a consequence-bearing NPC-reactive event; children, caregiving and child's school selection through same parent authority mechanism. Any intimacy is adult-only, non-graphic, voluntary and guarded by country rules.

**Gate:** NPC can refuse; no consent bypass; one life event once; valid family links, childcare and estate; no unintended population changes while mode OFF.

## PL-10: adult businesses, social action and public institutions

**Read:** adult catalogue business, community, civic and wealth entries; existing business/municipal systems.

**Work:** Business application/formation, real inventories/shares/wages where implemented; volunteering, support and local reputation only if traceable to residents/institutions. Lottery (if approved) is a fictional game-of-chance with disclosed probability, legal availability, funded counterparty, taxes, age gates, no real-world gambling payments, and an option to hide it. Do not fake a probability such as 50% simply for entertainment.

**Gate:** Balanced ledger and ownership; no fraudulent wealth; awards/prizes not more money than fund allows; UI accurately explains rejected and unavailable options.

## PL-11: adult wellbeing, travel and content filters

**Read:** adult catalogue health/travel/crisis entries; `design/02...` wellbeing section and country packs.

**Work:** Health care through existing services, domestic/international travel as an abstract trip if pathfinding/cross-border entities absent, scheduled time/cost, social opportunities and consequences. Emotional distress themes supported by non-graphic, opt-out stories; never implement a rewarded 'suicide button', methods, or random self-harm instructions. Ensure sensitive settings and accessibility.

**Gate:** No health/age manipulation just for dramatics; not every travel is an instant teleport with zero cost; serious events handled responsibly; optional content hiding does not change underlying normal-world RNG unless a clearly versioned explicit gameplay rule switch is documented.

## PL-12: senior stages and succession

**Read:** `catalog/senior_events.jsonl` sample and current death/estate/God Mode systems.

**Work:** Retirement/medical/family/legacy choices; no indefinite aging or guaranteed lifespan. On controlled resident death provide: eligible living offspring, random living resident, choose/search existing living resident, or spectator. No offspring disables descendant option. Keep full personal history visible.

**Gate:** No double death, duplicate tax or money, replay/ledger correct; succession doesn't alter other NPC autonomy; old saves resume.

## PL-13: catalogue rollout and editorial review

**Read:** `catalog/ALL_EVENTS_REVIEW.md` to select tranche; only specific stage JSONL for that task. `catalog/LOCALIZATION_KEY_MANIFEST.jsonl` for IDs; not other stages.

**Work:** Integrate remaining authored scenarios in small groups of 5-10 using `catalog/TRANCHE_PLAN.md` and `EVENT_LOOKUP_INDEX.json` by age/category, matching them to actual world entities and valid engine mechanisms; reject or modify impossible scenarios. The 320 entries/962 options are **creative inventory** not verified executable rules. Use only the separately reviewed numeric rules and actual engine APIs. Generic event probabilities/costs were removed because they were misleading. Add full English text coverage and stable choice IDs.

**Gate:** Each shipping scenario has 3 or 4 validated options, a genuine or expressly cosmetic outcome, age/consent/legal guards, cooldown and a meaningful no-target fallback. Aim to ship 50 genuine scenarios for baby, child, teen and senior stages and 120 for adult (at least 100 adult required). If an authored candidate cannot be backed by a safe genuine mechanic, **replace or revise it with a feasible equally meaningful scenario** rather than pretending it works; maintain an explicit implemented/deferred/replaced count, with no misleading release claim. Avoid duplicating BitLife prose/art.

## PL-14: UX, pacing, art and playtest

**Read:** `design/03...` and limited catalogue examples.

**Work:** Improve discoverability, life journal, character portrait, relationship cards, school comparison, optional map highlight, responsive layout and readability. No unnecessary 3D renderer. Tune interruption density; measure real clock and total interaction dwell during one representative 80-year life.

**Gate:** Core actions understandable without manual; mobile usable; long text wraps in Chinese smoke locale, keyboard usable, no alert storm; 2-hour target documented as actual or aspirational.

## PL-15: final integration/calibration and release decision

**Read:** relevant acceptance sections from each design, not every source file repeatedly.

**Work:** 1/3 towns, 4 country packs, Classic, seeded parity with Mode OFF, old saves, migration, scheduled commands, God Mode compatibility, migration/succession, economic conservation, 2,500 population, report and UI. Monitor age-targeted event frequencies, school opportunity equity, wealth inflation, population decline, graduation, deaths and outcomes across seeds. Log limitations.

**Gate:** No regression; reversion possible; no hidden permanent performance cost in OFF mode. Document known issues and release limitations. No claims of complete 320 implementation if some scenario classes are unimplemented.

## PL-16: optional Vite website preparation (separate authorisation)

**Read:** `design/04_FRAMEWORK_WEB_RELEASE_AND_ASSET_STRATEGY.md`.

**Work:** First audit what 102 MB means; build static preview from unchanged engine and assets, optional code splitting, browser save migration and `dist` quality. If engine uses ordered global scripts, add safe Vite entry/adapter, **not** wholesale module refactor. Consider React island only for complex event panels after actual maintainability assessment. No cloud/server, no SSR.

**Gate:** All determinism and old-save tests match, deployed preview works across browsers, compressed first-load size measured, no secrets/assets accidentally shipped. Publishing requires explicit user authorisation.

## PL-17: Simplified Chinese rollout (only after copy stabilises)

**Read:** `design/05...`, locale catalog for the relevant namespace and translation QA matrix, not all engine code.

**Work:** Translate core UI, event titles/options/outcomes, person panels, school and family dialogs, job/goal names, messages, history and reports into zh-Hans with native-speaking review. Include appropriate font fallback and line-break QA. Translate until completeness gate passes; later languages reuse keys.

**Gate:** 100% critical paths and safety; >=95% noncritical exposed strings; no corrupted placeholders; all-country and save fingerprints exactly unchanged by locale change. Show translation completeness per namespace. No machine translation deployment without human review.

---

## A compact reusable task-opening prompt

> Continue the Life Evolution Simulator development **only on task [PL-XX]**. Read the latest `docs/HANDOFF.md`, `docs/ROADMAP.md`, `README_START_HERE.md`, the PL-XX entry, and only the design/catalogue files listed for that entry. Check Git state. Preserve the working simulation, Classic, old saves, deterministic seeds and financial invariants. Do not redesign or duplicate existing systems. Implement the smallest compatible changes, test, review diff, update handoff, commit, and push to the authorised feature branch only (never force-push or merge `main`). Give a brief completion report with tests and SHA, then **STOP so I can review**.
