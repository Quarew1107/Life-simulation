# Roadmap

The improvement plan agreed in November 2026. Each phase is one tested push.

## Rules for every new system
1. **Same decision engine.** New activities (worship, crime, voting, rallies, drug use) are extra choices in `Actions.candidates`, added through a system hook. They show up in "Why did they do that?" with their odds.
2. **Mechanisms, not bonuses.** No group gets a hidden success bonus. Effects work through time, money, health, stress, social ties and laws.
3. **Personality plus randomness** in every reaction.
4. **Off switch.** Each system is a `LES.Systems` plug-in with `enabled(cfg)`. With every system off, the Classic preset must reproduce the original engine exactly. This is checked by the foundation tests (stored fingerprints).
5. **All money goes through the ledger.** New accounts (treasury, gang funds, community funds) are included in the money check.
6. **Every system ships with its own charts and map overlay.**

## Decisions
- **Ethnicity:** real groups differ through culture, religion mix, festivals and optional policy or starting-condition settings, never through innate attributes. Innate gifts only exist in the fictional *Five Clans* scenario.
- **Crime intensity:** a setting with three levels: Realistic ×1, Lively ×10 (default) and Lawless ×30. Charts always show per‑100k rates next to Malaysia's. At real rates, a 300-person town would see about one crime every two years and one murder every 480 years.
- **Leader title:** a setting, defaulting to President (Mayor and Datuk Bandar are options).
- **First scenarios:** Born Equal, Great Reset, Eternal Life, Education Ban. Pandemic and Robot Age come next.
- **Government level:** the town government uses city positions (Datuk Bandar or another leader title, Bendahari Bandaraya, Ketua Polis Daerah, Pengarah Pembangunan Masyarakat), not national ministers. It still runs taxes, schools, hospitals and police for the town; most company tax from local firms goes on to the federal government.
- **Public and private services:** the treasury pays public teachers, nurses, doctors and police. Private clinics, schools and hospitals are residents' businesses that pay their own staff.
- **Sales tax:** SST by default; GST 6% is a law option.
- **Setup screen:** the main page shows only the world choice and six settings (founders, years, starting wealth, economic cycles, crime, seed); the other 30 live in Advanced settings, grouped.
- **Pandemic model:** an SIR-style spread (about 2.5 new infections per case, 10 days ill, immunity waning after about 300 days) with age-based fatality from Levin et al. (2020): log10(IFR) = -3.27 + 0.0524 × age.
- **GitHub resources (checked again for Phase 5):** pixelarticons (MIT) supplies the tab and scenario icons. The SIR repositories found were small and unlicensed, so the epidemic model is written from the standard equations.
- **GitHub resources (checked Nov 2026):** no maintained, licensed Malaysian tax library or reusable simulation component would replace our own engine, so taxes follow LHDN and SST figures directly and the app stays dependency-free.

## Phases
| Phase | Contents | Status |
|---|---|---|
| 0. Foundations | System hooks (`js/sim/systems.js`), save/load (`js/sim/save.js`), Malaysia/Classic presets, calibration report (`js/sim/calibration.js`, `tools/calibration.html`), Node harness (`tools/headless.js`) | Done |
| 1. Art | Palette and 3/4-view painters (`js/render/art.js`), new ground, Malaysian buildings, directional people sprites, festival clothes, golden hour and night lighting with real lit windows, off-screen culling | Done (pixel UI icons and mini-map still to do) |
| 1b. Layout | Varied, seed-dependent towns (`layout: 'varied'`): uneven plots, avenues, a river, superblocks, coast or hills, wild lots; routing on the road graph | Done |
| 2. Society | Social class (B40/M40/T20 from household income, T1 elite, hardship), mobility matrix, ethnicity update (DOSM 2025 shares, Other Bumiputera), religion (census shares, religiosity, worship, zakat/charity funds, Ramadan, Shariah-compliant investing), worship districts, Society tab, overlays, report section | Done |
| 3. Crime and justice | Temptation score, crime types, police, courts, prison, records and reoffending, drugs and rehab, gangs and turf, crime overlays and charts | Done (police officers as real jobs, loan sharks and corruption come with Phase 4) |
| 4. Government | Town treasury (taxes fund services, police budget sets police strength), law catalogue, elections every 5 years, voters who partly misunderstand laws, approval, corruption, events (floods, haze, scandals), Government tab, police officers as public servants, remand in the lock-up | Done |
| 4b. Public finance & council | Malaysian taxes (LHDN bands and reliefs, SME company tax, SST or GST, assessment tax, dividend tax, EIS, zakat rebate, federal share of company tax); revenue and spending by source; teachers, nurses, doctors and police paid by the treasury with staffing laws and service quality; fuel subsidies, EIS benefit, training, pensions, development projects; city council (Bendahari Bandaraya, Ketua Polis Daerah, Pengarah Pembangunan Masyarakat) with competence, cronyism and MACC; private clinics, schools and hospitals built on empty lots; Bank Negara OPR, EPF dividends, Khazanah Rezeki and three GLC listings; crime-police feedback (case capacity, felt certainty, town economy in temptation); polls in platforms | Done |
| 5. Scenarios | Scenario framework (`js/sim/scenarios.js`: each scenario a switchable plug-in with options, a status line, a chart and a report section), redesigned setup screen (choose a world, your town, grouped advanced settings), tab bar with pixel icons. Scenarios: Born Equal, Great Reset, Eternal Life, Education Ban, Pandemic, Robot Age, Lawless Town, Isolated Island, Five Clans | Done (Aristocracy vs Meritocracy later) |
| 5b. Streets | Traffic lights and roundabouts at junctions; volume sliders only on hover | Done |
| Next (see `docs/HANDOFF.md`) | Performance groundwork, multiple towns (max 3, one by default), scenic terrain and bigger maps, My Cast, countries (Malaysia, UK, USA, China) | Done |
| 6. Polish | 6.1 calibration: firms share a town-sized market, wider pay, outside hires (Gini, revenue, unemployment in band for Malaysia, UK, US; China mostly). 6.2 report sections, town newspaper, compare-with-normal-world runs. 6.3 Aristocracy vs Meritocracy, pixel icons, mini-map | Done |
| Blueprint (Nov 2026) | `Idea/LES_*_2026-11-05.md` cards C00-C11: honest statistics, estates with business stakes, admissions, mobility measure, town name, spectator tools, sandbox Fate, comparison limits, release checks | Done (C09c gift deferred) |
| Expansion 1 (Nov 2026) | `Idea/Expansion 1`: 23 jobs, a research centre, 6 degrees, 9 vocational/master's subjects, 9 life goals, 8 outfits, 9 looks (rules revision 5) | Done (Social butterfly goal deferred) |
| Performance (Nov 2026) | `docs/PERFORMANCE.md`: map drawing off the GPU bottleneck, double-buffered overview, Turbo view, frame-wait fallback; China 2,500 founders ~12 -> ~27 days/s (~33 Turbo) | Done |
| Country looks | Shop lots, eateries, pub/bar, town hall flags, rent signs, police, court, sports court, memorial, hills, lakes and forests drawn in each country's style | Done for UK, US, China |

## To do
Kept in step with `docs/HANDOFF.md` section 0.
- C09c optional small gift (sandbox): deferred; only if the owner asks.
- Optional 4.2 extras: tax competition between towns, real map thumbnails in the region view.
- Performance follow-ups if wanted: compare/calibration runs in a Web Worker; one worker per town for big regions.
- Expansion 1 leftovers: Social butterfly goal (needs real friendships), firefighters as public-sector posts, a partnership start date.

## Malaysian reference figures
| Measure | Value | Source |
|---|---|---|
| Life expectancy | 75.3 (men 73.1, women 77.9), 2025 | DOSM Abridged Life Tables |
| Children per woman | 1.6 (2024), 1.5 (2025) | DOSM Vital Statistics |
| Unemployment | 2.9% (Aug 2026); 10.1% for ages 15–24 | DOSM Labour Force Survey |
| Household income | median RM7,017, mean RM9,155, Gini 0.390 (2024) | DOSM HIES 2024 |
| Ethnic shares | Malay 58.2%, Chinese 22.2%, Other Bumiputera 12.3%, Indian 6.5% (Q4 2025) | DOSM demographic statistics |
| Religion | Islam 63.5%, Buddhism 18.7%, Christianity 9.1%, Hinduism 6.1%, other 0.9%, none/unknown 1.8% | Census 2020 |
| Index crime | 58,255 cases in 2024: 81% property, 19% violent | DOSM Crime Statistics 2025 |
| Murders | 237 (2024), about 0.7 per 100k | PDRM via the Home Ministry |
| Drug users | 192,857 (586 per 100k), 2024 | AADK |
| Prison population | 87,419 (256 per 100k), about 70–75% drug-linked | World Prison Brief, Home Ministry |
| Commercial crime losses | RM3.1 billion (2024) | PDRM CCID |
| GE15 voter turnout | 73.89% | Election Commission |
| Income tax bands | 0% to RM5k, then 1, 3, 6, 11, 19, 25, 26, 28, 30%; RM9,000 relief, RM400 rebate up to RM35k | LHDN, YA2025 |
| Company tax | 15% first RM150k, 17% to RM600k, 24% above (SMEs); 24% otherwise | LHDN |
| SST | sales tax 5% / 10%, service tax 8% (6% for F&B and telecoms) | RMCD, 2025 |
| GST (2015–2018) | 6% standard rate, basic food zero-rated | RMCD |
| Dividend tax | 2% on dividends above RM100k a year (from YA2025) | Budget 2025 |
| OPR | 2.75% (from July 2025) | Bank Negara Malaysia |
| EPF dividend | 6.3% (2024), ~5.5–6% recent average | KWSP |
| Federal revenue | RM324bn (2024), about RM790 per person a month | Ministry of Finance |
| Teachers / police | ~420k teachers; 136,503 police (~4 per 1,000) | MOE, PDRM |
| Index crime solved | ~65% | PDRM |

Results describe outcomes of this simulation under its assumptions. The Malaysian figures anchor the defaults; they do not make it a forecast.
