# Handoff: state of the project and what to do next

Written so a new developer (or a new Claude session) can continue without the earlier
conversation. Branch: `main` on `Quarew1107/Life-simulation`. Last update: Nov 2026.

## 1. How the project works (read first)
- Plain JavaScript, no build step, runs from `index.html` opened as a file (file://). Every
  module is an IIFE that adds to the global `LES`. Script order is in `index.html`; the
  Node harness `tools/headless.js` loads the same `core/`, `data/`, `sim/` scripts.
- **Determinism:** seeded RNG streams (`w.rng.<name>`). Same seed + same settings = same
  history. Never use `Math.random()` in the engine.
- **Money:** integer sen through `w.ledger` only (`move/pay/spend`); named sectors are the
  outside world. `w.checkInvariants()` must stay empty.
- **Systems:** optional features are `LES.Systems` plug-ins (`js/sim/systems.js` lists the
  hooks). With all of them off, the Classic preset reproduces the original engine exactly;
  `foundationTests` checks stored fingerprints (`stableHash`). Keep that test green.
- **Tests:** `node tools/headless.js tests` (engine checks, ~4 min; the map-tile, looks and report checks need a canvas or the UI and run only in `tests.html`, 142 in all) or `tests.html` in a browser. Without Node,
  open `tests.html` (from disk is fine) and click Run all tests: ~2 min in Edge.
  Calibration: `node tools/headless.js calib`. Benchmarks: `node tools/headless.js bench founders=400 years=10`.
- Docs: `README.md` (features), `docs/ROADMAP.md` (phases, decisions, Malaysian figures).

## 0. Where to pick up (status at the end of the last session)
**Blueprint work (Nov 2026, `Idea/LES_*_2026-11-05.md`, branch `dev/blueprint-2026-11`, not pushed):**
- C00 baseline on c2a3032 (clean tree apart from the two untracked Idea docs). No Node here: run the harness
  checks in headless Edge (`python tools/edge.py tests.html "<js>"`). Full suite 229/229 (359 s; one earlier
  attempt hung idle in the harness and timed out, not reproduced). Hash, 1500 days, 100 founders: today's rules
  base-1 9b8da9b9, base-2 36736c1e; Classic base-1 d664f679, base-2 05aa1507. Soak 60 years x 2 seeds
  (150 founders): invariants clean every quarter, heap ~45 MB, feed capped at 800, 720 paper issues.
  Bench 10 years x 150 founders: 5.8-6.2 s (hash a4f11506..., same as at 61fe75b; the machine was slower than
  last session's 2.8 s). Old Malaysia save fixture continues identically (countryTests).
  Audit findings still present on HEAD: Spearman without ties (C01), tertiary counts any qualification (C02),
  catastrophe multiplied after the cap (C03), business shares to local heirs only (C04), revenue per current
  person (C05), no admission capacity (C06), twins accepted separately.
- C01 DONE: `LES.Report.rankWithTies` / `R.spearman(xs, ys, minN = 8)` (average ranks for ties, Pearson of ranks,
  non-finite pairs dropped, null for too few pairs or a constant side); report shows n/a, the sample size and
  "association in this simulated town, not cause"; 'self-made' claims replaced by "recorded cash inheritance and
  gifts as a share of tracked lifetime receipts (inherited business stakes are not counted)"; the award is
  "Richest with little recorded inheritance". Report-text fingerprints re-recorded (old values kept in the test
  comment); engine fingerprints unchanged. `reportStatsTests` (8 checks); 237/237 pass. Next: C02.
- C02 DONE: `LES.Calibration.eduLevel(p)` = highest credential as ISCED (none 0, VOC = pack `education.vocIsced`:
  Malaysia SKM certificate 4, UK Level 3 Diploma 4, US associate degree 5, China dazhuan 5; bachelor's 6, MED and
  master's 7); the `tertiary` measure counts adults 25-64 once at level 5+, with `tertiaryHits/tertiaryN` and
  NaN below `Cal.MIN_EDU_N` (20). Report's official-figures table shows the source of every target and n of N
  for tertiary. Malaysia's target source now says it is the labour force with diplomas, which the sim lacks.
  No behaviour change (fingerprints identical). `eduLevelTests` (5); 242/242 pass. Not re-measured over 80 years
  (no tuning in this card): the old 74%/64%/72%/56% figures counted vocational-only people too. Next: C03.
- C03 DONE: `A.catProb(cfg, gap, risk)` caps the chance of a catastrophe after a failed risky task AFTER the risk
  multiplier (`clamp((catBase + catGap x gap^2) x RISK_MULT, min(catBase, cap), cap)`, non-finite -> cap);
  `A.taskOdds` gives success, catastrophe-if-failed and overall catastrophe (= failure x conditional) for
  explanations. Versioned by the new cfg `rulesRev` (DEFAULTS and today's rules 2; Classic 1;
  `LES.upgradeConfig` sets 1 for older saves; no setup-screen field). Validator: catCap 0-1, 0 <= catBase <= catCap,
  catGap >= 0. At default settings the old rule never exceeded the cap (96,898 risky failures over 2 x 1,500 days
  + 30 years: highest 0.0151, none changed), so all fingerprints and C00 hashes are identical; it differed only
  for heavy work with a gap above ~3.7 or custom catGap/catCap. `catCapTests` (6); 248/248 pass. Next: C04a
  (estate design checkpoint: present the design before coding).
- C04a DESIGN (awaiting owner approval; no code yet). Verified on HEAD: `Fa.settleEstate` (family.js) liquidates
  investments, EPF and trust, pays study debt only, taxes CASH only, splits cash equally (sen remainder by heir id;
  away heirs via ABROAD: a sister-town mirror or `h.away.wealth`), then gives business shares to LOCAL heirs only.
  Reproduced: a 60% owner whose children all live away -> the other owner went 40% -> 100% for free (RM102k of
  stake); the children got nothing. A sole owner with no local heir -> the firm is closed. US medical debt is left
  on the dead person (dropped, not written off). Idempotent today only through `World.die`'s alive guard.
  Decision: cash-settlement with equalisation (blueprint alternative B), not portable cross-town ownership (A
  would need owner references through distribute, sale, closure, migration, return moves and cross-town deaths).
  Under a new `rulesRev` 3 (Classic and older saves keep the current code):
  1. Value the estate: cash after liquidation + Sum(stake x b.equity). Debts: study, then medical where the pack has
     it; unpaid -> `L.writeOffs`. Tax base = net estate incl. equity (pack relief, e.g. UK business relief, if
     approved); tax funded from cash first, then by selling part of the stake to the outside investor.
  2. Entitlement q = net / heirs (integer sen). Remote heirs get estate cash first; any shortfall is met by selling
     that slice of the stake to an outside investor at the price below, paid via the existing ABROAD route. Local
     heirs share the remaining cash and stake so each gets q (fractions exact to 1e-9).
  3. Outside investor = new `b.outsideShare` (default 0): `F.distribute` pays its part to MARKET; managers stay local;
     new invariant: sum(local shares) + outsideShare = 1 for every open firm.
  4. No heirs: cash to ESTATE (as now); the stake goes to the outside investor (other owners unchanged); a sole-owner
     firm with no heirs is sold with `F.sellBiz` (proceeds to ESTATE) instead of closed.
  5. `p.estateSettled` flag + one `w.estates` record per death: cash, equity value and stake per heir, tax, debts.
  Tests E-01..E-12 (blueprint 4.7) as fixtures in a new `estateTests`. Changed: family.js settleEstate (rev 3
  branch), finance.js distribute + invariant, world.js checkInvariants; save field `b.outsideShare`.
  Open policy questions for the owner: buyout price (recommend full valuation; the migration buyout uses 70%);
  equity in the tax base (recommend yes, UK with its business relief); medical debt from the estate (recommend
  yes, US); spouse share (recommend none, as now).
- C04b DONE (design approved as recommended): `Fa.settleEstateV3` when `cfg.rulesRev >= 3` (DEFAULTS and today's
  rules 3; Classic 1; older saves 1). Debts study then medical, unpaid written off; stakes valued at `b.equity`;
  tax on cash + stakes above the allowance (UK `tax.estateBusinessRelief`: first GBP1M exempt, half taxed above),
  funded from cash then stake slices sold to the outside investor at full valuation; each child gets
  floor(net / heirs): children away paid in cash (sister town via ABROAD), children in town share the rest of the
  cash and the stakes; no children: cash to ESTATE, stakes to the investor, a firm with no resident owner left is
  sold by the estate. `b.outsideShare` (investor's fraction): `F.distribute` pays it to MARKET first (all of it when
  the investor owns everything), migration buyouts keep it, invariant: residents' shares + outsideShare = 1.
  `p.estateSettled` makes settlement one-off; rev-3 records hold cash (measured from the account, checked
  exactly), equity, stakes, tax and debts (value checked within rounding). Spouse: no share (game rule kept).
  Tests: `estateTests` E-01..E-12 (E-01 fixture: RM92k tax, RM156k value per child within 1 sen, investor holds
  48/900 of the firm); full suite 264/264. Fingerprints unchanged (no stake, tax or medical-debt estates in the short fixed runs);
  60-year soaks for Malaysia, US and UK clean every quarter (460 estates: 29 with stakes, 2 taxed, 7 write-offs).
  Fixed on the way: a payout when the investor owned 100% divided by zero. Known limits: the minority buyout
  when someone moves away still pays 70% of value (unchanged); the report's inheritance share still counts cash
  only (stakes are now in the estate records and the log line). Next: C05.
- C05 DONE (reporting only, no rule changes, fingerprints identical): `Cal.DEFS` is the metric-definition map
  (num, den, obs, minN, comparable, note); `Cal.TARGETS` carries it; the calibration table prints notes for
  non-comparable measures and the report's official table flags them. Revenue: `g.revBase` stores each month's
  [residents, price] next to `revHist`; `Cal.revenuePerPerson` averages revenue_m / (residents_m x price_m) over
  12 months (older saves: last-month fallback marked approximate). TFR is now the period TFR from age-specific
  rates over 10 years (`Cal.periodTfr`, min 30 births); completed family size of women 45+ is `completedFert`
  (shown, not a target). Crime rows: `prison` = sentenced prisoners only, `custody` = police lock-up (remand),
  rehab apart. 'Unemployment' is labelled 'Not working, share of eligible adults' (not the labour-force
  definition: no search/availability test). Clearance = arrests per crime (not comparable). Low samples -> NaN
  (medWage 20, Gini 20 households, clearance 30 crimes). A single small town rarely has 30 births in 10 years, so
  `Cal.table` pools births and exposure over seeds (`Cal.pooledTfr`, `r.tfrParts`). 80 years x 3 seeds: Malaysia
  period TFR 1.54 (target 1.6; completed 1.37), revenue RM577, tertiary 47% (degrees only, target 29%); China
  revenue ¥3,170 (barely changed: real growth, not the old denominator), tertiary 53% (20%). Next: C06.
- C06 DONE (rules revision 4; Classic and older saves keep the old code, rev 3 reproduces the previous fingerprint).
  Measured first (Malaysia, 80 years): founders started at 16% degrees but reached 44% within 20 years because
  adults kept enrolling (58% of applications accepted, nearly all graduate). Now: (1) founders' credentials by
  age group from pack `education.founders` ([below age, degree share, vocational share]; approximate, not
  official), ability-weighted (exp(0.45 x (INT - 5)) / 1.35); (2) `L.places`: yearly credits per course group =
  pack `education.places` x an average one-year 18-24 cohort, capped at two years' worth; under-25s first
  (older applicants need a spare place; master's not restricted by age); a rejected or placeless applicant waits
  for next year's round; (3) pack `education.admitBar` (MY 1, UK -0.5, US 0, CN 1; was 1 everywhere). Exempt:
  scenarios with `noEduPlaces` (Born Equal, Education Ban, Five Clans, Aristocracy vs Meritocracy).
  80 years x 3 seeds: tertiary 25-64 MY 22% (29% incl. diplomas, which the sim lacks), UK 33% (52%, warn),
  US 43% (51%), CN 34% (20%; the town is young and today's intake is high, the target is the whole 25-64 stock).
  Other measures in band except: more crime and prisoners with fewer graduates (education lowers the pull of
  crime in crime.js): UK prisoners 273 (142), US 995 (540), MY 306 (256) -> crime tuning needs a re-run (C11);
  MY life expectancy 71.6 (75.3, warn). China period TFR n/a (under 30 births pooled). `eduPlacesTests` (9),
  TC-009 given a place; 282/282 pass. Next: C07 (optional) or C08 (town name).
- C08 DONE (labels only; engine fingerprints unchanged): `LES.cleanTownName` (NFC, control/invisible characters
  removed, spaces collapsed, 1-40 code points), `LES.setTownName(w, name)` ('' = default) and `LES.townName` now
  prefers `w.displayName`, then the region's name, then `cfg.townName` (new optional setting 'Town name' in
  Advanced -> Town & map; in a region it names the first town), then the country default. Click the town name in
  the top bar to rename (`app.renameTown`). Region UI, cross-town logs, gang chapters, the region map and report use
  the display name; unescaped uses fixed (welcome card, 'living outside'). Policy: past log lines and newspaper
  issues keep the name of their day; the newspaper's title is the country pack's. Report-text fingerprints
  re-recorded (a 'Town name' settings row). `townNameTests` (8): rename on day 100 -> identical `w.hash()` on day
  1,000, save/load, escaping, Unicode, region. 290/290 pass. Next: C07 (optional), C09a.
- C09a DONE: `js/ui/spectator.js` (`LES.Spectator`): Spotlight (dims the map around one person), Bookmark person or
  family (partner, parents, children; ribbons on the map; Leaders -> Bookmarks list; saved in localStorage per
  country + seed, never in the world or save), Celebrate (confetti from a fixed pattern, no random numbers). Follow
  is the renderer's existing camera follow. Drawn from `Renderer.drawLabels` (read only); buttons on the person
  card (`app.action` spotlight / bookmark / bookmarkFamily / celebrate). `spectatorTests` (3): 1,000 actions with
  drawing during a 3,000-day run leave `w.hash()` and `stableHash()` identical to an untouched twin. 293/293 pass.
  Next: C09b (Sandbox Fate; C04b is done) or C07.
- C09b DONE: `js/sim/god.js` (`LES.God`), the only state-changing God Mode action. Person card -> 'Fate…' ->
  confirmation window (`app.askFate`: age, town, partner, shares, children in care / sole carer, heirs, business
  run, job; 'Save a copy first'). `God.requestFate(w, id)` resolves a sister-town resident to that town
  (`Region.where`), refuses the dead, people abroad and a second pending request, and queues an immutable command
  `{ id, kind:'FATE', target, requestedDay, status }` in `w.intervention.pending`. `World.step` calls `God.apply`
  at the start of the day (before `refreshLiving`, never mid-loop): each target is re-checked (dead / moved away ->
  `skipped` with a reason), else `p.fate = id` and the normal `w.die(p, 'Fate (sandbox intervention)')` runs
  (job, partner, guardians, `settleEstate`, business succession; nothing is spliced or settled by hand). Commands
  move to `w.intervention.events` (last 200) and `modified` marks the world Sandbox: the report shows a banner,
  `Calibration.measure` sets `intervened` and leaves Fate deaths out of life expectancy (exposure still counted).
  The state is plain world data, so pending commands survive save/load and run once. Worlds never touched have no
  `w.intervention`: fingerprints unchanged. `fateTests` (11): owner/parent with heirs (one estate record, every
  living child an heir, family links kept), duplicate and dead-target refusals, sole carer -> guardian or welfare,
  died-before-execution skipped, save with Fate pending == unsaved twin (`stableHash`), report/statistics label,
  sister-town resident. Limits: no undo; a Fate'd person's partner inherits nothing (existing estate rule: children
  only); the intervention log is not shown as its own list (the feed and the person's life log carry it).
  The report banner is joined to the line before it so untouched reports read byte-for-byte as before.
  304/304 pass. Next: C09c (optional gift, deferred) or C07.
All work is committed and pushed. Latest (Nov 2026): countries stop at Malaysia, the UK (4.5), the United States
(4.6) and China (4.7): the owner skipped UAE, Mexico and South Africa. Phase 6 (section 4.8) step 6.1, the shared
calibration fixes, is done; next is 6.2 (report sections, the town newspaper, compare-with-normal runs), then 6.3. The full suite runs in
headless Edge: `python tools/edge.py tests.html "await LES_TESTS.runAll(), document.getElementById('out').textContent" 900`.
Multiple towns (4.2) is usable: setting, switcher, migration, commuting, shopping, shared
economy, comparison card, save/load. Next, in this order:
1. Finish 4.2: DONE since: town types (`LES.TOWN_TYPES`, settings town1Type-town3Type, district
   mix + `w.jobFreq` job mix), one monsoon for the region (`Region.monsoon`), pandemic spreading
   between towns (`Region.pandemicSpread`), region section in the report. Gang spillover is DONE
   (`Region.gangSpread`, `LES.Crime.foundChapter/wantsToExpand/chapterIn`): an established gang (4+ members,
   RM4k, 2+ years, cannot buy more turf at home) may open a chapter in the sister town with the most young
   jobless people and the thinnest police (5% a month); chapters are ordinary local gangs with the parent's
   name and colour, send 20% of their takings (`g.take` - `g.sent`) home via each ledger's ABROAD account,
   and go independent (`g.formerParent`) when the parent breaks up; members who move keep `p.cr.tie` for
   3 years and may start or join a chapter. Rare by design: in 25-year Lawless test runs, 2 of 3 regions
   saw a chapter. Also fixed: the consistency check now accepts one parent in town when the other stayed
   in a sister town (`xlinks` rel 'parent'). The region overview map is DONE: `js/data/region-map.js`
   (`LES.RegionMap`: pure layout, routes, hit test and the schematic town plan `drawTown`, testable
   without a browser) and `js/render/region-view.js` (`LES.RegionView`: cached plans and countryside,
   live commuters, moves, gang turf, floods, rain, labels placed beside each town, legend). Layout is a
   row for wide views and a staircase otherwise; roads never cross a third town. `app.view` is 'town' or
   'region'; 🗺 Region button in `#town-switch`, scrolling out at the fit limit, Esc/click to return.
   Section 4.2 is now complete apart from optional extras (tax competition between towns, real map
   thumbnails once 4.1 tiles exist). Next: 4.1 performance groundwork.
2. 4.3 terrain is DONE (basic set): varied towns get one extra column (and a row for Bandaraya and
   Metropolis) of scenery blocks: 'k' lake, 'm' hill, 'f' forest reserve (`LES.SCENERY_EXTRA`,
   `planDistricts`, painters in `art.js`). Setting `scenery` both/decor: with both they join
   `town.kinds.park` (venues) and homes next to them get `b.view` (less stress). Grid towns and
   Classic are unchanged. Still open: country-specific scenery (karst, moors, dunes...).
3. 4.4 My Cast is DONE (lean version): `js/sim/cast.js` (`LES.Cast.add`), `js/ui/cast-ui.js` (creator with
   sprite preview, roster in localStorage with export/import, "★ My cast" mode in the Leaders tab,
   ★ on leaderboards). Still open: adding cast as founders at setup, partners/families inside the cast,
   more appearance options (glasses, beard, headwear), life-event alerts, a report section.
   UPDATE (Nov 2026): founders at setup (`cfg.cast`, setup picker, `LES.Cast.founders`), households
   (`spec.partner`, `spec.parents`, `LES.Cast.households/addGroup`; a child needs a cast parent 12+ years
   older; the consistency check accepts one parent for cast children), recorded arrivals
   (`cfg.castArrivals` = [{ day, town, specs }], on the region's base cfg in a region; `LES.Cast.due` at the
   start of `World.step` replays them), and looks (`look.glasses/beard/hat/hatColour` in sprites.js;
   residents get them from `LES.Sprites.lookOf`, a fixed rule, presentation only), alerts
   (`UI.castAlerts` in cast-ui.js watches cast members' logs; level in localStorage `les-cast-alerts`:
   major/all/off; sounds via `LES.Audio.onEvent(e, app, true, true)`), the Events "★ Cast" filter, map stars
   and the report's "Your cast" section are DONE: section 4.4 is complete.
   FIXED (owner approved, Nov 2026): a household head whose affordable housing tier equalled the default
   (tier 1) never got a home (`F.reviewTiers` only moved people whose tier changed): ~38 of 100 founders
   had homeId -1 for good, since the original engine. Heads without a home now always get one. This
   changed every history, so the stored Classic fingerprints in `foundationTests` were re-recorded once
   (old values noted there). Also fixed: loading a save re-applied the laws and recalculated everyone's
   monthly costs (`GV.upgrade` -> `applyLaws(w, false)` now), so a loaded world could drift from the saved
   one.
   Calibration (tools/calibration.html, 3 seeds x 80 years) before -> after the fix: Gini 0.67 -> 0.59
   (target 0.39), public revenue per person RM2,739 -> RM1,416 a month (target RM815), median wage
   RM3,734 -> RM3,539 (RM3,000), prisoners 397 -> 305 per 100k (256), index crime 109 -> 93 (170), TFR
   1.49 -> 1.70 (1.6), life expectancy 75.0 -> 73.4 (75.3). Gini and revenue were already off before the
   fix (ROADMAP's "all targets in band" is out of date): a job for the Phase 6 calibration pass.
4. 4.1 chunked static map layer, 4.5 countries, 4.6 polish.

## 2. Done so far
Phases 0-5 are complete (see ROADMAP): foundations, art, varied layouts, society (class,
religion, ethnicity), crime and justice, government and elections, public finance and the
city council, private services, Bank Negara and GLC stocks, nine scenarios, the redesigned
setup screen and tab bar. Latest additions:
- Traffic lights (on avenues and busy routes, cycling N-S / E-W with amber) and roundabouts
  (ordinary four-way crossings) - `LES.junctions` in `js/data/town.js`, painted in
  `js/render/art.js` (`drawJunctions`), lamps per frame in `js/render/renderer.js` (`drawSignals`).
  Vehicles do not yet stop at red lights or drive round roundabouts (possible follow-up:
  make `route()` waypoints at roundabout nodes go round the island, and add a short wait at
  red lights in `posOf`).
- Volume sliders only while hovering the sound button (`js/main.js`).

## 3. Agreed decisions for the next work (from the owner)
1. Order: **multiple towns first**, then terrain, My Cast, countries, then Phase 6 polish.
   (Recommended engineering order inside that: do the performance groundwork of step 4.1 first.)
2. **One town by default**; multiple towns are switched on in settings, **maximum 3 towns** for now.
   A "Remove limits" expert setting may lift the population caps (not the 3-town limit yet).
3. Historical group starting wealth (South Africa, USA): **realistic by default**, shown and
   explained, with an "equal across groups" option. Group differences are never innate.
4. Scenic terrain: **decorative AND functional by default** (lakes/hills act as free outdoor
   venues; homes with a view have slightly higher rent); a setting in Advanced can make it
   purely decorative.

## 4. Next phases: detailed plan

### 4.1 Performance groundwork (do first)
**Map tiles: DONE** (`js/render/tiles.js`, `LES.MapTiles`). The static map is painted in 512 px tiles
on demand (LRU cache capped at 160 MB, tiles on screen never dropped), with a quarter-scale overview
painted directly at that scale a piece per frame (schematic plan from `LES.RegionMap` until done) and
used when zoom < 0.5 or for tiles not painted yet. A changed building (signature diff on
`townVersion`) repaints only the tiles it touches. Art painters take a view (`LES.Art.setView`) and
skip what lies outside; random details come from `LES.Art.prng(tag, a, b)` seeded by what and where
they are (building id, block, road piece, map cell), and window lights are chosen by position, so any
area painted alone matches the whole map (test allows only anti-aliasing noise where a big curve
crosses a tile edge). Metropolis: was 300 MB and ~1 s per rebuild; now ~19 MB overview plus about
2 MB per tile on screen, pieces of ~5-13 ms between frames.
Measured: ~60,000 person-days/s in Node for the Malaysia preset (Classic ~2x faster), so
days/s ~= 60,000 / population. Profile (400 founders): `A.candidates` 21%, `A.liveDay` 18%,
`endOfDay` 7%, `G.pickVenue` 5%, GC 4%. The static map is one canvas
(`renderer.buildStatic`): 8 MB (kampung) to 133 MB (metropolis), rebuilt whole when a
building changes.
- Split the static layer into 512 px chunks, built on demand, LRU-capped (~150 MB), plus a
  1/4-scale overview for zoomed-out views; rebuild only chunks a changed building touches.
Measured with tiles (Edge, GPU): Metropolis town switch 941 ms -> 29 ms, frame zoomed out 9.7 ->
4.9 ms, zoomed in 4.0 -> 3.4 ms, map memory 300 MB -> ~21 MB plus ~2 MB per tile on screen.
- Engine: lazy labels (`A.labelOf`), compact Why records (`WhySlot`) and fixed-shape bias rows
  are already in (commit 3c616df, ~1.5x, results identical). Reusing candidate objects was
  measured SLOWER in Chrome (old objects pointing at new ones cost the garbage collector), so
  skip it. Tried in Nov 2026 and reverted (no measurable gain, results identical): lazy plan
  labels (a PlanStep class), skipping Why records for towns not on screen, fixed-shape tier
  effect rows in endOfDay, caching system venue preferences per day. Engine speed is ~55-70k
  person-days/s in Edge and run-to-run noise on this laptop is ~15% (it slows as it heats up),
  so benchmark old vs new alternating, several rounds. The remaining cost is spread across the
  daily decision (candidates, venue choice, resolve, softmax): further gains need a structural
  change (e.g. reuse the morning's options for the evening slot where nothing changed, needs
  kept in typed arrays, or one Web Worker per town for regions).
- Time-slice stepping: done for 10 days/s and faster (MessageChannel pump in `js/main.js`).
- Later, optional: one Web Worker per town for multi-core. Workers cannot load file:// scripts,
  so this needs a generated engine bundle (`tools/bundle.js` concatenating core/data/sim into
  one function whose `toString()` feeds a Blob worker).

### 4.2 Multiple towns ("Region")
**Progress:** increment 1 is DONE (`js/sim/region.js`, tests in `regionTests`): `new LES.Region(baseCfg, [townCfg, ...])`
steps up to 3 Worlds in lockstep; the lead town runs the economy and the shared Bursa
(`w.follower` skips `Market.daily` and `macroYear`; GLC listings only in the lead); leavers may
settle in a sister town (`Region.onLeave` -> `relocate` at month end, money via each ledger's
ABROAD sector, origin record `p.away = { town, id }`, copy has `xlinks`); deaths and
inheritance follow across towns. Increment 2 is DONE: setting "Towns in the region" (Advanced > Town & map, default one town,
extra towns get ~60%/40% of the founders, `LES.makeRegion`), 1,500-founder total limit unless
"Remove population limits", `app.region` stepped by `safeStep`, `app.world` = the town shown,
town switcher in the top bar (`#town-switch`), links to family in other towns on the person
panel, region save/load (`LES.Save` handles a `Region` root). Increment 3 is DONE: commuting (`Region.commuteDay`: private openings that nobody in the town
applied for within 2 days may be re-advertised in a sister town, more often where unemployment
is higher; `p.job.commuteTo` marks commuters, who lose a little energy) and a "Towns in the
region" comparison card at the top of the Stats tab (`UI.regionCard`). Shopping is DONE too: each month every town gets `w.regionDemand`
(0.9-1.1, bigger towns draw neighbours' spending), applied to business demand in `F.bizMonth`.
**Not yet:** region overview map, spillovers (gangs, floods, pandemic via commuters),
town types (district mixes), report section for the region, chunked static map layer.
Architecture: **each town is a full `LES.World`** (own people, ledger, council, laws); a new
`LES.Region` (new file `js/sim/region.js`) owns the towns and a shared national layer and
steps them in lockstep (same day for all, fixed town order). Towns interact through fixed
channels, exchanged at **month end** in a fixed order with a region RNG, so results stay
reproducible. Reasons: no rewrite of the single-town engine, and it allows a worker per town later.
- Setup (Advanced > Town & map, or step 2): "Towns in the region: 1 / 2 / 3" (default 1),
  each with a type and founders. Town types change the district mix (`LES.districtQuota`):
  capital city, industrial, university town, coastal resort, farming kampung.
  Limits: total founders <= 1,500 (warning above 800) unless "Remove limits"; max 3 towns.
- Shared national layer: one economic regime and inflation (run `F.macroYear` once and copy),
  one Bank Negara OPR, one Bursa (share `w.mkt` between towns and run `M.daily` once per day;
  `townHold` summed), national tax rules. Each town keeps its own council, laws and elections.
- Channels:
  1. Migration between towns: households compare jobs, wages, rent, crime, schools and family
     ties (reuse `js/sim/migration.js` push/pull). Transfer = mark the person in the origin as
     moved (`p.away = { town, id }`, stopping their off-screen life there), create the copy in the
     destination (same name, look, attributes, quals, personality, money moved via each ledger's
     ABROAD sector), keep cross-town family links as `{ town, id }` for the UI; inheritance
     across towns uses the existing "heir abroad" path.
  2. Commuting: post the neighbour's real vacancies as commuter jobs (like the existing city
     jobs, `commute: true`), with a stress/time cost.
  3. Shopping: a share of each town's consumer spending lifts business demand in the bigger
     neighbour (`w.boost.biz`-style multiplier per town).
  4. Spillovers: gangs extending turf, floods on a shared river, the Pandemic spreading via
     commuters, tax competition (low assessment tax attracts businesses and migrants).
- Rendering: detailed view of the selected town only (current renderer), and a Region view
  (cached 1/4-scale thumbnails of each town on one canvas, countryside, highway and rail,
  dots for commuters). A town switcher in the top bar; the UI tabs show the selected town;
  a Region tab compares towns (population, jobs, rent, crime, taxes, flows between them).
- Save/load: `LES.Save` encodes one World; add a region wrapper that encodes each town plus
  the region state.
- Tests: region of 2-3 towns runs 20 years with each town's invariants clean, migration and
  commuting happen, same seed -> same region hash, single-town default unchanged (Classic
  fingerprint still passes).

### 4.3 Scenic terrain and bigger maps
Lakes (jetty, boats), hills/mountains (trail, viewpoint), forest reserve with waterfall,
wetland boardwalk, limestone karst (Malaysia); later country sets (moors, mesas, koppies,
dunes). Placed by seeded noise in `LES.planLayout` as non-buildable "scenery blocks":
6-10% of blocks, near edges/river, never the centre, up to 4 blocks each, never cutting road
connectivity (reuse the superblock connectivity check). Enlarge every map size by ~12%
(`LES.MAP_SIZES` cols/rows) so buildable blocks stay the same. Function (default on): free
outdoor venue (jogging, picnics, hiking) and a small rent/prestige premium for homes next to
scenery; Advanced setting "Scenery: decorative and functional / decorative only".

### 4.4 My Cast (custom individuals)
Creator modal with live sprite preview: identity, appearance (add hair styles, headwear,
glasses, beard to `P.makeLook` and `js/render/sprites.js`), abilities and potentials,
personality, strategy, life goal, qualifications, job or business, money, home, relationships
within the cast. Roster in localStorage plus JSON export/import. Add as founders at setup or
mid-run as newcomers by train (record additions in cfg/save so replays match). New "Cast" tab
(watch list incl. starred residents): live status, alerts, map star markers, report section.
Cast members follow the normal rules; flagged with a star on leaderboards.

### 4.5 Countries
**Approved plan (Nov 2026, owner accepted every recommendation):**
- Pack format: `js/data/countries/countries.js` (registry: register/get/validate/use) and one file per
  country (`my.js`, then `uk.js`). `LES.Countries.use(code)` writes the pack's values into the tables
  the engine already reads (C.JOBS, FS.PIT_BANDS, S.RELIGIONS, CO.ROLES, GV.LAWS, Cal.TARGETS,
  C.STOCKS...) when a world is created, so hot paths do not change; `w.country` plus a one-line guard
  at the start of `World.step` re-applies the pack if another world switched it. Engine-only data (ids,
  weights, difficulty, places) stays shared; packs give the national columns per id. Rules are data where
  possible (bands, reliefs, payroll contributions, retirement scheme, property-tax model, welfare model
  'flat' or 'meansTested'); new mechanics only run when a pack switches them on. `cfg.country`
  defaults to 'my'; option values like 'malaysia' become 'national' with a save upgrade.
- 4a steps: (1) Malaysia fingerprints + pre-move save fixture [DONE: `countryTests` in tests.js,
  `js/tests/fixtures.js`]; (2) registry, cfg.country, guard [DONE]; (3) people and content [DONE: content.js keeps engine data, my.js `content` and `town` hold titles, pay, prices, names, ethnic mixes, stocks, building names and descriptions]; (4) taxes, finance, government [DONE: my.js `names`, `tax`, `bank`, `retirement`, `fund`, `gov` (laws, leader titles, council, police per 1,000, service pay), `services`, `notes`; fiscal/labour/finance/government/council/services read them through appliers]; (5) society, festivals, events, calibration [DONE: my.js `society` (religions, religion by ethnicity, who celebrates what, class names, DOSM cut-offs, hardship, nisab, non-Shariah shares, `lawReligion` for the interfaith rule), `calendar` (festivals, fasting month; set up from countries.js), `crime` (reference rates, now `LES.Crime.REF`), `events` (flood, haze), `calibration` (targets; labels and formats stay in calibration.js), `gov.preferredGroups`, `tax.zakatRebate`]; (6) text and keys [DONE: money sign from the pack (`U.setCurrency`, `U.sym()`, `U.cur(amount)` for fixed figures); `LES.Countries.fill` words {cur} {currency} {adj} {country} {goal} in settings, setup cards and scenario texts; pack `settings` overrides keep Malaysia's exact setup wording; option {name} from town/gov tables; `names.lockdown`, `society.classShort/statsOffice/cutsYear`, `notes.revenue/events`, `gov.surplus` steps; 'malaysia' option and law values renamed 'national' (`LES.upgradeConfig` in World and on load, `GV.upgrade` for laws/lawLog/agenda/platforms, save content paths `.malaysia` -> `.national`); the report names the drug policy instead of its key (3 report hashes updated, engine fingerprints unchanged); benchmark: no slowdown against c0bb584 (5 years, 200 founders, 4 alternating rounds)]. Left for 4b: town-picture weather (monsoon/haze months in render/ambience.js), the 'Class (B40/M40/T20)' overlay label (ui/extras.js), the default cast member (sim/cast.js), the tudung look rule (sim/person.js), "Malaysia today" -> "Today's rules" with the country dropdown, art palette.
- 4b UK: England's rules with UK statistics; Universal Credit (taper), Child Benefit, State Pension,
  Pension Credit floor, workplace pension (5% + 3%, market returns, access at 57), student loans (Plan 5),
  council tax bands and business rates, VAT, NI, corporation tax marginal relief, dividend allowance, IHT
  40% above GBP325k, fuel duty as revenue; council posts Director of Finance (Section 151 officer),
  Chief Superintendent, Director of Communities; Mayor default, 4-year terms; Bank Rate; no GLCs, a
  council investment fund; census 2021 groups and religions; UK festivals; UK buildings, moors, canal,
  weather, daylight by latitude and bare winter trees; fictional town Rexbury and Albion Exchange
  (Fernlea Bank, Copperfield Grocers, Brackwater Utilities, Northlight Telecom, Larkspur Pharma,
  Ironvale Energy, Saltmarsh Homes, Wrenfield Tech; check none is real before use).
- Cross-country decisions: goal scaled by median wage and rounded (UK GBP100M); money display from the
  pack through the fast hand-written formatter (keys like goalRM keep their names; check the pixel font
  has the currency sign); calibration: demography and labour in band, crime within twice the band,
  Gini and revenue reported and fixed in Phase 6; measure gross and disposable Gini, compare with each
  statistics office's headline; crime compared on modelled offences from police-recorded counts, each
  country's own clearance definition; institutions (corruption, police effectiveness) as a few sourced
  pack values; UK starts with a mild realistic wealth gap by group (ONS Wealth and Assets Survey) with an
  equal-start option, Malaysia unchanged for now; Classic stays Malaysia-only (picker hidden); country
  dropdown on the main setup page, "Malaysia today" becomes "Today's rules"; one country per region,
  a cast member from another country arrives as an immigrant.
- Testing without Node: `python tools/edge.py tests.html "await LES_TESTS.countryTests(), document.getElementById('out').textContent"`
  (headless Edge via the DevTools protocol; full suite: `LES_TESTS.runAll()` with a 600 s timeout).
  The runner turns off Edge's timer throttling for hidden windows (without it, tests that pause with
  setTimeout stall for minutes after heavy work), closes Edge completely with Browser.close, dismisses
  dialogs, and on a timeout prints the page's call stack and last console lines. Full suite: 190 tests, ~170 s.
- 4b steps: (1) UK pack on the existing mechanics + country dropdown [DONE: `js/data/countries/uk.js` (loaded after
  my.js in every page); ONS/HMRC/BoE/Home Office figures with sources in the file; Census 2021 groups (white, asian,
  black, mixed, other) and religions; Rexbury, Hollinford, Wrayfield; Albion Exchange companies (names searched: no real
  matches); no GLCs. New pack parts used by the engine: `tax.estateAllowance`, `tax.salesTaxRaise`, `tax.priceBase`
  (the sales-tax and fuel laws content prices include), `gov.austerity`, `gov.emergency`, `gangNames`, `demography`
  (fertMult, mortMult for the 'national' rules), `defaults` (applied when the country is picked in setup),
  `events.haze.name`, `celebrates.x.all`; staffing quality is measured against the pack's 'national' option. Setup:
  Country field on the main page (`set-country`); changing it re-opens the form in that country's words with its
  defaults; Classic switches the country back to Malaysia; closing setup re-applies the running world's country.
  The rules preset is now called "Today's rules". Tests: a UK town runs with balanced books; running one alongside
  changes nothing in a Malaysian town; a UK save loads and continues identically.]
  (2) UK rules [DONE, all switched on by pack data so Malaysia runs the old code paths: `tax.ni` (employee 8%/2%,
  employer 15%, collected in `FS.onPay`), `tax.allowanceTaper`, `tax.councilTax` (by housing tier, single-person
  discount, support for UC households) and `tax.businessRates`; `welfare.model: 'meansTested'` runs `ukBenefits` in
  fiscal.js: Universal Credit (cashAid law = standard allowance; couples x1.57, GBP304 a child, housing up to a
  council flat, 55% taper above the work allowance for parents, savings tariff and GBP16k limit, 80% take-up via
  `p.ucTake`), Child Benefit with the GBP60-80k charge, State Pension from 66, Pension Credit floor;
  `welfare.jobLoss` (Malaysia EIS share/cap, UK flat New Style JSA); `education.loans` (Plan 5: the fee is always
  borrowed, 9% of pay above GBP25k, written off after 40 years, `debt.slStart`); `services.charges` (NHS free).
  Tests: `ukTests` (tax, NI, loan, NHS, UC, pension, council tax).]
  (3) UK look and people [DONE: pack `art` (style 'uk': brick shared houses, council blocks, Victorian terraces,
  detached houses, farmland, moorland, a canal with narrowboats, conifers instead of palms, gardens instead of
  sandy yards; trees by season via `LES.Art.setSeason` + `Ambience.season`, the renderer repaints tiles when the
  season changes; daylight `Ambience.sun` from latitude 52.5 with summer time; weather by month with snow;
  heatwave for the haze event; festival clothes, decorations, fireworks and music cues from the pack);
  `town.signs` (map sign words keyed by the Malay text); `content.startWealth` (UK: square root of the ONS Wealth
  and Assets Survey ratios, average unchanged) with the setting `groupWealth` (realistic | equal);
  `content.castDefault`; cast specs record `country`, and a person made in another country arrives as an
  immigrant (`p.bornIn`, group 'other' when needed); the class overlay names the country's classes.]
  (4) UK calibration [DONE: `crimeTuning` (opportunity 5, solve x0.45, 85% community orders, possession prison
  after 4 arrests, sentences x0.5; Malaysia's TUNE0 is all 1/0 so its numbers are unchanged), `demography`
  fertMult 0.42, mortMult 1.1; medWage target is the full-time median. 80 years, 3 seeds: TFR 1.52, life
  expectancy 80.1, median pay GBP3,416, crime 1,667 per 100k, 12% solved, prisoners 99, users 441 all in band;
  unemployment 1% (5%), household income Gini 0.51 (0.38) and revenue GBP3,038 (GBP1,480) are off, the same
  engine-wide drift as Malaysia (Phase 6). Benchmark unchanged against 2846882 (200 founders, 5 years).]
  Still shared with Malaysia (fine for now): engine constants in Year-1 money (similar size in GBP and RM), the
  Chinese temple and gopuram art for the Buddhist centre and mandir, the mosque and church art.
- Owner's new order (Nov 2026): three countries first, UK, USA, China (UAE, Mexico and South Africa later).
  Finish a whole country before pushing, then stop and report.

### 4.6 United States (step 5, approved as recommended Nov 2026: Ohio rules, money scale, $200M goal,
medium health detail, no party names, guns as lethality only, Brightwater / Harlow Junction / Cedar Bend)
- Money scale: `money.scale` (US 1.75; Malaysia/UK 1). A pack writes real money; `LES.Countries.use` activates a
  scaled copy (`K.scaled`, `K.MONEY_PATHS` lists every money field: add new ones there!) so the engine keeps its
  ringgit-sized units; `U.fmtMoney/fmtPrice/U.cur` multiply back (`U.setCurrency(sym, k)`); typed-in amounts
  (goalRM, marketOutsideRM, cast cash) and law amounts (minWage, cashAid, ubi via `GV.policyOf` and the voter
  formulas) are divided by `LES.Countries.scale()`. `{k:10}` in texts = engine thousands shown in local money.
  `K.get(code)` is the raw pack (real money), `K.pack` the active scaled copy.
- `js/data/countries/us.js`: Census groups (white, hispanic, black, asian, other), Pew religions, BLS pay, 2026
  federal brackets + $16,100 standard deduction + 401(k) relief, FICA through `tax.ni` (with `name`/`employerName`),
  `tax.stateBands`/`stateName` (Ohio 2.75% above $26,050) and `tax.localIncome` (2% city tax) in `FS.onPay`,
  sales tax 7.25%, `tax.assessmentName` 'property tax', 21% corporate tax, `tax.credits` (EITC table, CTC) paid in
  `FS.year`; `welfare.model: 'usa'` runs `usBenefits` (Social Security from `p.ssEarn` / `ssInit`, SNAP with the
  3-month rule for adults without children, TANF) and `usHealth` (cover: medicare / medicaid / employer /
  market / none, premiums, children via CHIP or the parent's plan, `p.cover`); `health` pack + `usBill` in
  services.js (deductible, coinsurance, out-of-pocket limit, self-pay discount, unpaid -> `p.debt.medical`);
  `F.debtMonth` collects medical debt (collections `p.medCollect` blocks starting a business, bankruptcy clears
  it) and runs `education.loans.model 'fixed'` (10 years at 6.4%, not cleared by bankruptcy); Pell grants in
  `L.enroll`; 401(k) `retirement.participation` (fixed per person by id hash); `crimeTuning.lethal` (guns);
  `events.tornado`; art style 'us' (trailers, apartments, clapboard houses, ranch homes, temperate trees,
  fields, pumpkins, US flags via `art.flag`), Ohio daylight at 40N with DST.
- Calibration (80 years, 3 seeds, fertMult 0.6, mortMult 1.2): TFR 1.48, life expectancy 78.0, median pay
  $5,808 ($5,420), crime 476 per 100k, 26% solved, 685 prisoners, 611 drug users all in band; Gini 0.56 (warn);
  unemployment 1% and revenue off. Revenue per person is $1,800-2,600 for the first 40 years (one seed), then
  company and dividend taxes from very successful firms push the 80-year average far up (~$11,800): the same
  wealth-concentration drift as the Gini in all three countries (Phase 6). Murders are too rare to measure in
  small towns at the Realistic scale; `lethal: 4` follows the US/Malaysia gap. Benchmark unchanged.

### 4.7 China (step 6, approved as recommended Nov 2026: a central-China city, appointed government with a
5-year review, medium hukou, wealth gap by hukou, the 2025 retirement reform, a ¥200M goal, invented names
Qiaoyun / Fengtang / Shuangmu and the Jade River Exchange; censorship and social credit left out)
- `js/data/countries/cn.js`: money scale 2.3 (ICP price levels), census groups (Han, Zhuang, Hui, Manchu, Uyghur,
  other) written family name first (`content.surnameFirst`, read by `P.name`), CGSS/Pew religions ('other' =
  Taoism & folk religion at the temple), NBS pay, IIT bands 3-45% above ¥60,000 with social insurance and the
  provident fund pre-tax (`retirementRelief`) and ¥24,000 per child; social insurance through `tax.ni` with
  `floor` (60% of the average wage), `employer.to` (300% cap) and `coverage: true`; VAT 13/9/6% inside prices;
  property tax on business premises only; company tax 5%/25%; `federalShare` empty (central-China provinces get
  back more than they send). National laws have one option (set by Beijing); the city sets the minimum wage
  class, hardship aid, police, schools, hospitals, drug policy and so on. Lunisolar festivals (`lunisolar: true`
  with `lo`, the earliest day: Spring Festival on 17 Feb 2026, 6 Feb 2027, 26 Jan 2028, ...), Golden Week.
- `js/sim/china.js` (`LES.China`, system 'china', on for `cfg.country === 'cn'`; no dice, fixed id hashes):
  hukou (`p.hukou` urban / rural / outside: founders by `hukou.mix`, newcomers outside, children a parent's;
  transfer yearly after 5 years of social insurance, a degree or a high-rise home, for the half who want it),
  starting wealth by hukou (`wealthGap`, in `World.makeAdult`), job cover `covered` (public jobs always, others
  by hukou: migrants 40%) -> `job.si`, the earnings record `siMonths/siIdx/siAcct` (`contribute`, founders
  `init`), `retireAge` (2025 reform: +1 month per 4 months, women workers per 2), `minYears` (15 -> 20 from 2030),
  `claim` (basic pension 1% x years x (1 + index) / 2 of the average wage + personal account / divisor; too few
  years: the residents' pension ¥230), `examBar` (vocational track +2.5, migrants +0.5) and the yearly zhongkao
  (`p.zk`, top 55% academic).
- Engine hooks (all gated): `FS.onPay` (coverage, floor, employer cap), `welfare.model 'china'` runs
  `cnBenefits` (pensions, the childcare subsidy ¥300 under 3, migrant school costs, dibao for local hukou) and
  `cnHealth` (employee / resident / residentAway / none, ¥33 a month residents' premium); `health.plans.*.public`
  makes the treasury pay the insured part in `usBill`; unemployment insurance needs `job.si` and lasts 12/18/24
  months (`jobLoss.needsSi`); no civil-service pension in China; labour.js retires covered jobs at `retireAge`;
  `L.enroll` adds `examBar`; `crimeTuning.drugUse` (new, default 1).
- Appointed government (`gov.appointed: { reviewYears, maxTerms }`, government.js): `startCampaign` becomes
  `review` (no campaign, no votes): the province `appoint`s on ability, responsibility, education, rank and
  public experience; at each review (growth of incomes, approval, debt, scandals) the leader is kept, moved on
  (two terms, or promoted) or removed. Records go into `g.elections` with `appointed` (votes 0) and `g.reviews`.
  The Gov't tab, the report and the setup card say "appointed". Hukou, social insurance years, pension and
  zhongkao show on the person's Community card; the Society tab has a by-hukou table.
- Art style 'cn': urban-village houses, older walk-up estates with caged balconies, gated tiled mid-rise estates,
  villas, camphor trees instead of palms, rice paddies kept, lanterns, red flags, Spring Festival fireworks.
- Calibration (80 years, 3 seeds, fertMult 0.34, mortMult 1): TFR 0.94, life expectancy 79.3, crime 226 per 100k,
  47% solved, 78 drug users all in band; median pay ¥7,886 (warn against an approximate ¥6,000: NBS publishes no
  median); prisoners 262 (off), then the final crime tuning (3 seeds x 40 years) gave index ~250, 56% solved, ~177
  prisoners, ~72 users (prisoners and index just above their bands; small towns are noisy). Gini 0.66 and revenue
  (~¥2,200-2,900 a person in the first 12 years, ¥19.7k averaged over 80) show the same wealth-concentration drift
  as the UK and US (Phase 6); unemployment 1% as everywhere. Benchmark: Malaysia 150 founders x 10 years
  2.91-3.01 s new vs 2.91-2.98 s old, identical hashes. 210 tests pass.
- Countries end here (owner, Nov 2026: skip UAE, Mexico and South Africa).

Original notes:
First move everything Malaysia-specific into a country pack (`js/data/countries/my.js`:
currency, prices, wages, taxes in `js/sim/fiscal.js`, welfare, B40/M40/T20 labels, religions and
festivals, names, ethnic mix, stocks, government posts and laws, art palette, calibration
targets) and add a Malaysia fingerprint test so the refactor changes nothing. Then packs for
the UK, USA, China, Mexico, South Africa and UAE (government posts, taxes and distinctive
mechanics are listed in the planning notes: appointed government for China and UAE, hukou,
UAE residency/visa status, Mexico's informal sector and cartels, South Africa's unemployment,
grants and load-shedding, US medical debt). Use fictional towns, exchanges and companies.
Verify current figures by web search and cite official statistics offices. Currency display via
`Intl.NumberFormat`. Pixel font is Latin-only: signs in English/pinyin/Spanish.

### 4.8 Phase 6 polish (plan approved as recommended, Nov 2026: 6.1 calibration first and pushed alone, then
6.2 report sections, a town newspaper and compare-with-normal runs, then 6.3 extras: Aristocracy vs
Meritocracy, pixel UI icons, a mini-map)
- 6.1 DONE. Cause found: business revenue came from an unlimited outside 'CUSTOMER' pool, so a lucky firm grew to
  its cap (trading up to RM22M a month) in a town of 300; its owner's household then took most income (top 10%
  ~55-60%), company tax made revenue explode, and wages were too alike (Gini ~0.22 early). New setting
  `econModel` ('calibrated' in DEFAULTS and the national preset; 'original' in Classic and, via
  `LES.upgradeConfig`, in saves from before, so Classic fingerprints and old saves are unchanged):
  - Markets: `market: [firms per 1,000 people, outside]` on each content biz type (stall 20/0, workshop 5/0,
    retail 10/0, restaurant 5/0, trading 3/3, tech 2/15, property 2/1) in units of scale0; `F.marketSize`
    (x `F.MARKET_K` x pack `labour.market`); `World.monthClose` sums `w.bizLoad`; `F.bizMonth` sells
    `mf = min(1, market / total)` (inputs fall with sales, `b.marketShare`), and no growth investment above
    saturation. Private services (staff types) are limited by `maxPer` as before.
  - Pay: offers `L.PAY_MID` 0.85 x log-normal `L.paySd()` (0.35; pack `labour.paySd`: US 0.55, China 0.55) in
    `L.dailyMarket` and for founders; people move to the better offers, hence the 0.85.
  - Unemployment: `L.award` gives an opening to an outsider with chance `labour.outsideHire` (Malaysia 0.3, UK
    0.6, US 0.45, China 0.5; `w.stats.vacOutside`). China: people past the retirement age with no job retire.
  - Country retunes for the new economy: UK fertMult 0.57 / mortMult 0.85; US 0.75 / 1.05, `labour.market` 1.6,
    sentence 1.2, drugUse 1.6; China fertMult 0.47, hukou coverage 0.65 / 0.4 / 0.3, `tax.ni.compliance` 0.7
    (pay declared below the real wage), employerCorp 0.04, fund payout 0.02, crime opportunity 0.5 / sentence 0.15 /
    drugUse 0.1. Malaysia's pack is unchanged apart from `labour`.
  - Calibration (3 seeds x 80 years): Malaysia every measure ok (TFR 1.42, e0 74.4, unemployment 2%, pay RM3,215,
    Gini 0.41, revenue RM578, crime 134, prisoners 260, 66% solved). UK all ok but prisoners (207, warn): Gini
    0.39, unemployment 5%, revenue GBP1,400, pay GBP3,053. US every measure ok: Gini 0.43, unemployment 4%,
    revenue $2,283, pay $5,473, prisoners 726. China: Gini 0.44, pay, crime, users, prisoners ok, unemployment 4%
    (warn, it swings 4-8% between runs), revenue ¥3,321 (off): in band for the first 50 years (¥1,650-2,400),
    then the city shrinks (TFR ~0.9, one seed to 101 people) while a few firms and the state fund keep paying.
  - Malaysia fingerprints re-recorded once (old values noted in `countryTests`); the pre-move save still
    continues identically; `marketTests` (6 checks). 216 tests pass. Benchmark: new 2.77-2.91 s vs old
    2.97-3.15 s (fewer businesses).
  - Not done (smaller): graduate share, class mobility; UK prisoners.
- 6.2 DONE: town newspaper (`js/sim/news.js` system 'news' files an issue a month into `w.news.issues`, saved;
  `js/ui/news-ui.js` window from Events → Newspaper; pack `names.newspaper`); comparison runs (`js/ui/compare.js`:
  same seed and length under today's rules, or Classic when already on today's rules; Stats tab and end
  dialog; also in the report); report sections: against official figures (from year 10), work and business,
  each country's own rules, a front page a decade.
- 6.3 DONE: Aristocracy vs Meritocracy scenario (`aristo`, option `aristoMode`), mini-map (`js/ui/minimap.js`),
  pixel icons for the top bar and map buttons (new paths in icons.js). 229 tests pass.
- LEFT: graduates. New calibration measure `tertiary` (adults 25-64 with a diploma or degree) is far too high:
  Malaysia 74% (29%), UK 64% (52%), US 72% (51%), China 56% (20%). Founders get VOC with 30% chance on top of
  degrees (`World.makeAdult`) and enrolment is easy (`L.enroll` bar): tune both per pack (calibrated only).
  Also class mobility, UK prisoners (207 vs 142), China revenue in old shrinking towns. Benchmark not re-run
  after 6.2/6.3 (presentation only, plus a monthly newspaper filing).

## 5. Useful resources (checked)
- pixelarticons (MIT) already vendored in `js/ui/icons.js` (licence in `docs/licenses/`).
- Faker.js locale name lists (MIT) on raw.githubusercontent.com: a reference for country name tables.
- simplex-noise.js (MIT) if a noise library is wanted for terrain (a small value-noise function works too).
- In the cloud environment only raw.githubusercontent.com was reachable; World Bank API,
  Our World in Data website and Kenney were blocked.
