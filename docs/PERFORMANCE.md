# Performance report (Nov 2026)

Question: a China world with 2,500 founders felt slow while Windows showed ~10% CPU and ~800 MB RAM.
Laptop: Ryzen 5 8645HS (6 cores / 12 threads, Radeon 760M integrated GPU), RTX 4050, 16 GB.

## How it was measured
- Same world for every run: China pack, seed `perf-1`, rules revision 5, founders 100 / 500 / 2,500 / 5,000 / 6,000.
- Engine only: `World.step()` in headless Edge (no drawing).
- Full app: `index.html` in headless Edge **with the GPU on** (it uses the laptop's AMD Radeon through
  Direct3D 11, like a normal Edge window), MAX speed, 12-15 s per run, fresh browser per run. Old and new code
  alternated (git stash) because this laptop's speed drifts by ~15-30% as it heats up.
- Tools: V8 CPU profiler and Chrome trace through DevTools, plus per-call timers. Scripts are throwaway; the
  method is described here so it can be repeated.
- Headless Edge throttles a page to 1 frame/s after ~17 s regardless of what it does; runs were kept shorter
  and repeated (two "1,028 ms worst frame gap" lines in the raw data are this, not the app).

## What the bottleneck was
"10% CPU" = one of 12 threads fully busy: JavaScript runs the whole simulation on one thread. Within that
thread the time went (2,500 founders, before):

| Where | Share | Cause |
|---|---|---|
| Drawing the map | ~60% (47-56 ms a frame) | The quarter-size map overview (1,968 x 1,132 px) was repainted almost all the time at fast speeds: every change of season (China, UK, US have seasons, so every ~7 s at MAX) rebuilt it piece by piece. Each change made the integrated GPU re-rasterise thousands of tiny rectangles before the next frame (`drawImage` blocked 40-49 ms). |
| Simulation steps | ~35% | The daily decision of every adult (`Actions.liveDay`: 70% of a day, of which `Actions.candidates` 42%, venue choice 6%, `endOfDay` 9%, month close 6%). Cost is linear: ~8-10 microseconds per person per day. No single hotspot. |
| Waiting | the rest | The pump paused for frames; when the browser held frames back the simulation waited too. |

The engine itself was already tuned in earlier rounds (HANDOFF 4.1: lazy labels, compact Why records,
cached vacancy lists). Its profile is flat: the biggest remaining function costs ~20% self time and is the
decision itself. Engine changes were not made: each candidate saving was 1-3% and would touch decision code.

## Changes (presentation and scheduling only; no engine file changed)
| File | Change |
|---|---|
| `js/render/tiles.js` | Off-screen map canvases (tiles, overview, night lights) are painted on the CPU (`willReadFrequently`): thousands of small shapes are cheap there and expensive on an integrated GPU. A repaint of the whole map (new season, fonts loaded) now goes into a second overview that is swapped in when complete, so the overview on screen does not change every frame (and no longer flashes back to the schematic plan each season). |
| `js/render/art.js` | Pattern tiles (grass, paving, noise) are CPU canvases too: a GPU canvas drawn into a CPU tile forced a GPU read-back (~80 ms per second). |
| `js/main.js` | **Turbo view** (⚡ button or T, remembered per browser): while the fast pump runs, the map and panels are drawn about 4 times a second instead of every frame. The pump also no longer waits more than 50 ms for a frame the browser is holding back. |
| `css/style.css` | Style of the ⚡ button. |

## Results (full app, MAX speed, simulated days per second; two rounds each)
| Founders | Before | After | After, Turbo view | Frame drawing before -> after |
|---|---|---|---|---|
| 100 | 274 / 287 | 870 / 860 | 1,354 / 1,365 | 43 ms -> 4.5 ms |
| 500 | 81 / 41* | 153 / 156 | 200 / 202 | 24 ms -> 3.1 ms |
| 2,500 | 13.0 / 11.4 | 28.8 / 25.8 | 34.3 / 32.1 | 47 ms -> 6.1 ms |
| 5,000 | 9.3 / 7.7 | 14.9 / 13.5 | 13.5 / 14.4 | 49 ms -> 9 ms |
| 6,000 (limit of the setting) | | | 12.4 | |

\* that run hit the headless throttle. With frames throttled to 1 per second the new pump keeps simulating
(100 founders: ~60 -> ~800 days/s).

- 2,500 founders: **about 2.2x faster, 2.8x with Turbo view** (~12 -> ~27 / ~33 days/s; a year in ~11-14 s
  instead of ~30 s). Share of time simulating 35% -> 72% (Turbo 90%).
- Engine-only ceiling on this laptop (no drawing): 2,500 ~25-50 days/s (heat-dependent), 5,000 ~19, 6,000 ~16.
  Turbo view at 2,500-6,000 founders reaches 80-90% of it.
- Memory: JS heap 30-120 MB; the map overview stays ~20 MB per town plus up to 160 MB of zoomed-in tiles
  (unchanged cap). Save of a 2,500-founder world after 400 days: 19 MB, 0.28 s; load 0.25 s.
- UI responsiveness: worst gap between frames during play 100-160 ms at 2,500 (a month or year close; one
  simulated day is 25-30 ms and the pump yields after each day); 250 ms frames by design in Turbo view.
  Clicks are handled between days.

## Correctness checks
- Full suite 334/334 (Classic and country fingerprints, report-text hashes, map-tile seam test, invariants).
- The app's world equals an engine-only world of the same settings at day 400 (2,500 founders), with Turbo
  view off and on: identical `hash()`.
- Save at day 400, load, run both 200 more days: identical to each other and to the engine-only run;
  invariants clean; births, businesses, graduations, deaths and jobs all active in that stretch.
- Visual check: overview and zoomed-in tiles draw as before, season change keeps the old picture until the
  new one is ready.

## Remaining limits
- The simulation is single-threaded and linear in population: ~8-10 microseconds per person per day.
  Past ~2,500 founders the engine, not drawing, sets the speed.
- Laptop heat changes speed by up to ~30% between runs.
- Edge stops the fast pump when the tab is hidden or minimised (by design, `document.hidden`): long runs
  need the window visible (Turbo view keeps drawing cost low).

## Web Workers and more threads
- A worker cannot speed up one town's simulation: one world is one thread. It could only take drawing off
  the same thread, and Turbo view already recovers that time (90% simulating), so the gain left is <10%.
- Costs of moving the engine: the map, panels, Why records, reports and God Mode read world state directly
  every frame; a worker would need a snapshot of ~2,500 people per frame (or SharedArrayBuffer, which needs
  special server headers impossible on file://), an async query API for every panel, message-based God Mode
  and pause/resume, and a script bundle (workers cannot load file:// scripts). Ledger, RNG streams and saves
  would be unaffected if the whole world lives in the worker, but it is a large rewrite for little gain.
- Several towns (Region): one worker per town could use more cores, but towns exchange commuters, shoppers,
  migrants, the shared market and deaths every day in lockstep, so each day needs a synchronised hand-over.
  Possible later; worth it only if three big towns become common.
- Splitting the people of one town across threads: not recommended. The daily order of decisions and the
  shared RNG streams define the results; parallel decisions would change them.
- Smallest safe worker if wanted: run the headless "compare with a normal world" and calibration runs in a
  worker (no drawing, no God Mode, result returned once), so the UI stays responsive while they run.
