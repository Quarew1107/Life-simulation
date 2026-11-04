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
- **Tests:** `node tools/headless.js tests` (113 checks, ~4 min) or `tests.html` in a browser.
  Calibration: `node tools/headless.js calib`. Benchmarks: `node tools/headless.js bench founders=400 years=10`.
- Docs: `README.md` (features), `docs/ROADMAP.md` (phases, decisions, Malaysian figures).

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
Measured: ~60,000 person-days/s in Node for the Malaysia preset (Classic ~2x faster), so
days/s ~= 60,000 / population. Profile (400 founders): `A.candidates` 21%, `A.liveDay` 18%,
`endOfDay` 7%, `G.pickVenue` 5%, GC 4%. The static map is one canvas
(`renderer.buildStatic`): 8 MB (kampung) to 133 MB (metropolis), rebuilt whole when a
building changes.
- Split the static layer into 512 px chunks, built on demand, LRU-capped (~150 MB), plus a
  1/4-scale overview for zoomed-out views; rebuild only chunks a changed building touches.
- Engine: reuse candidate objects, build labels lazily (`A.labelOf` only when shown), skip
  map-only work (plans/labels) for towns that are not on screen. Target 1.3-1.6x.
- Time-slice stepping at visual speeds so frames never stall.
- Later, optional: one Web Worker per town for multi-core. Workers cannot load file:// scripts,
  so this needs a generated engine bundle (`tools/bundle.js` concatenating core/data/sim into
  one function whose `toString()` feeds a Blob worker).

### 4.2 Multiple towns ("Region")
**Progress:** increment 1 is DONE (`js/sim/region.js`, tests in `regionTests`): `new LES.Region(baseCfg, [townCfg, ...])`
steps up to 3 Worlds in lockstep; the lead town runs the economy and the shared Bursa
(`w.follower` skips `Market.daily` and `macroYear`; GLC listings only in the lead); leavers may
settle in a sister town (`Region.onLeave` -> `relocate` at month end, money via each ledger's
ABROAD sector, origin record `p.away = { town, id }`, copy has `xlinks`); deaths and
inheritance follow across towns. **Not yet:** UI (setup option "Towns: 1-3", town switcher,
main loop stepping the Region, Region tab), region save/load, commuting, shopping, spillovers,
town types. Next step: in `js/main.js` keep `app.region` and make `app.world` the selected town;
`app.step` calls `region.step()`; the renderer is rebuilt for the selected town on switch.
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
