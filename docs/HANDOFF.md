# Handoff: state of the project and what to do next

Written so a new developer (or a new Claude session) can continue without the earlier
conversation. Branch: `main-4bf9gf` on `Quarew1107/Life-simulation`. Last update: Nov 2026.

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
- **Tests:** `node tools/headless.js tests` (131 engine checks, ~4 min; the 3 map-tile checks need a canvas and run only in `tests.html`) or `tests.html` in a browser. Without Node,
  open `tests.html` (from disk is fine) and click Run all tests: ~2 min in Edge.
  Calibration: `node tools/headless.js calib`. Benchmarks: `node tools/headless.js bench founders=400 years=10`.
- Docs: `README.md` (features), `docs/ROADMAP.md` (phases, decisions, Malaysian figures).

## 0. Where to pick up (status at the end of the last session)
All work is committed and pushed; 120 tests pass (`node tools/headless.js tests`).
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
   residents get them from `LES.Sprites.lookOf`, a fixed rule, presentation only) are DONE. Still open:
   alerts and the report section (in progress).
   FOUND (not fixed, owner to decide): a household head whose affordable housing tier equals the default
   (tier 1) never gets a home (`F.reviewTiers` only moves when the tier changes): ~38 of 100 founders
   have homeId -1 for good. Present since the original engine; fixing it changes every history and the
   stored Classic fingerprints. Cast households are given a home explicitly.
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

### 4.6 Phase 6 polish
Calibration pass (household Gini ~0.50 vs 0.39 because about one adult in five runs a
business; graduates ~40% vs ~30%; median wage ~RM3.6k vs RM3k; mobility too fluid), report
sections, "Berita Rezeki" newspaper, compare-with-normal-world runs.

## 5. Useful resources (checked)
- pixelarticons (MIT) already vendored in `js/ui/icons.js` (licence in `docs/licenses/`).
- Faker.js locale name lists (MIT) on raw.githubusercontent.com: a reference for country name tables.
- simplex-noise.js (MIT) if a noise library is wanted for terrain (a small value-noise function works too).
- In the cloud environment only raw.githubusercontent.com was reachable; World Bank API,
  Our World in Data website and Kenney were blocked.
