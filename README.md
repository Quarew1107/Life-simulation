# Life Evolution Simulator — Demo

A town of 100 strangers in **Bandar Rezeki** each try to reach **RM100 million**. Nobody is controlled: every choice is a weighted dice roll from their attributes, personality, life strategy, needs and money. You set the rules, then you watch.

## How to run

Double-click **`Start Simulation.bat`**, or open `index.html` in Edge or Chrome. Nothing to install, and it works offline. The pixel font loads from Google Fonts when you're online. Offline, a plain font is used instead.

| Control | What it does |
|---|---|
| Click a person | Opens their life: net worth, "Why did they do that?" probabilities, attributes, lifestyle, career, family, life story |
| Drag / scroll | Pan / zoom the map |
| Space | Play / pause |
| 1–6 | Speed: 1×, 3×, 10×, 50×, 250×, MAX |
| S | Advance one day |
| F | Follow the selected person |
| Esc | Close the person panel |

**Engine tests:** open `tests.html` and click **Run all tests**. This runs the FSD acceptance cases, a determinism check, and 60-year invariant sweeps. **Balance report** runs several seeds for 120 years each.

## What's in the demo

- **People:** 6 attributes (inherited potential plus trained value), 5 personality traits, a family-desire value, and 6 life strategies that adapt after setbacks.
- **Decisions:** each day has two 7.2-hour slots. Eligible actions get a utility, then a softmax probability, then a seeded draw, then a separate success roll. A failed risky task can also roll a conditional catastrophe (injury, lost attribute points).
- **Jobs:** 17 jobs. Vacancies stay open 3–30 days, qualification is the only gate, and the best weighted applicant wins. Pay needs 20 shifts on separate days each month. There's EPF (11% + 13%), income tax, promotions, layoffs, quitting and retirement.
- **Education:** vocational, Arts/Business/Engineering degrees, Medicine and a Master's. Fees can be paid with a PTPTN-style loan. Graduating takes real study sessions, and there are scholarships and dropouts.
- **Lifestyle tiers:** each tier has real effects.
  - Food: cook at home → hawker → healthy → fine dining.
  - Housing: kampung room → flat → terrace → condo → bungalow. People visibly move house.
  - Transport: bus → motorbike (unlocks delivery gigs) → car (unlocks e-hailing) → luxury car.
  - Leisure: none → outings → gym (slows ageing) → country club (business luck).
- **Money:** savings interest, an index fund, personal speculative portfolios, and 7 business types with fat-tailed outcomes (booms, busts, saturation, corporate tax). There's also bankruptcy and random luck: illness, scams, windfalls and emergencies.
- **Families:** dating at the mamak or park, couples and break-ups, pregnancy and twins. Each parent decides about care independently, and orphans may get a guardian. Under harsh rules abandoned children die; with the safety net on, there's a welfare home. Upbringing shapes adult ability. Estates are split per parent at death, with trusts for minors.
- **Economy:** yearly boom, normal and recession cycles.
- **Integrity:** a double-entry-style ledger (money is never created or lost), monthly invariant checks, and deterministic seeds (same seed and settings give the same history).

## Not in the demo yet (planned for the full build)

Character and family creator, Advanced Settings editor, save/load, Research Mode (thousands of headless runs in parallel with comparisons), life replay and forks, an interactive family tree, a richer economy dashboard, sound, and a downloadable desktop package.

*Results describe outcomes of this simulation under its assumptions and random seed. They do not establish universal real-world causes of success.*
