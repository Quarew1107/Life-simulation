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

## Phases
| Phase | Contents | Status |
|---|---|---|
| 0. Foundations | System hooks (`js/sim/systems.js`), save/load (`js/sim/save.js`), Malaysia/Classic presets, calibration report (`js/sim/calibration.js`, `tools/calibration.html`), Node harness (`tools/headless.js`) | Done |
| 1. Art | Palette and 3/4-view painters (`js/render/art.js`), new ground, Malaysian buildings, directional people sprites, festival clothes, golden hour and night lighting with real lit windows, off-screen culling | Done (pixel UI icons and mini-map still to do) |
| 1b. Layout | Varied, seed-dependent towns (`layout: 'varied'`): uneven plots, avenues, a river, superblocks, coast or hills, wild lots; routing on the road graph | Done |
| 2. Society | Social class (B40/M40/T20 from household income, T1 elite, hardship), mobility matrix, ethnicity update (DOSM 2025 shares, Other Bumiputera), religion (census shares, religiosity, worship, zakat/charity funds, Ramadan, Shariah-compliant investing), worship districts, Society tab, overlays, report section | Done |
| 3. Crime and justice | Temptation score, crime types, police, courts, prison, records and reoffending, drugs and rehab, gangs and turf, crime overlays and charts | Next |
| 4. Government | Town treasury (taxes fund services), law catalogue, elections every 5 years, voters who partly misunderstand laws, approval, corruption, events (floods, haze, scandals), Government tab | |
| 5. Scenarios | Scenario framework on the setup screen, then Born Equal, Great Reset, Eternal Life, Education Ban, Pandemic, Robot Age; later Lawless Town, Aristocracy vs Meritocracy, Five Clans, Isolated Island | |
| 6. Polish | Calibration pass (median wage is still about RM3.5k vs Malaysia's RM3k), report sections, "Berita Rezeki" newspaper, compare-with-normal-world runs | |

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

Results describe outcomes of this simulation under its assumptions. The Malaysian figures anchor the defaults; they do not make it a forecast.
