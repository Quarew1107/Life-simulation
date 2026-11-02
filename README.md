# Life Evolution Simulator

A town of strangers in **Bandar Rezeki** each try to reach **RM100 million**. Nobody is controlled: every choice is a weighted dice roll from their attributes, personality, life strategy, needs and money. You set the rules, then you watch who makes it, and why.

## How to run

Double-click **`Start Simulation.bat`**, or open `index.html` in Edge or Chrome. Nothing to install, and it works offline. The pixel font loads from Google Fonts when you're online. Offline, a plain font is used instead.

| Control | What it does |
|---|---|
| Click a person | Their life: net worth, "Why did they do that?" probabilities, attributes and ageing genes, lifestyle, career, family tree, life story |
| Click a building | Place tab: what it is, owners and businesses, residents, employees, who is there now. Click the **Bursa** for the stock market |
| Drag / scroll | Pan / zoom the map |
| Space | Play / pause |
| 1–7 | Speed: 1× (1 sim minute per second), 10×, 60×, 1 day/s, 10 days/s, 100 days/s, MAX |
| S | Advance one day |
| F | Follow the selected person |
| Esc | Close the person panel |
| 📊 Report | The full simulation report in a new tab (downloadable as one HTML file) |
| 🎬 / 🔇 / overlay | Director mode (camera jumps to interesting moments), chiptune sound (off by default), map overlays (wealth, strategy, stress, family) |

At slow speeds the night (23:00–06:00) fast-forwards automatically. You can toggle this in the top bar.

**Engine tests:** open `tests.html` and click **Run all tests**. This runs the FSD acceptance cases, a determinism check, and 60-year invariant sweeps. `tools/balance.html?seeds=a,b&years=120` runs a headless balance report.

## Map sizes

| Map | Suggested for |
|---|---|
| Kampung (small) | up to ~80 founders |
| Bandar (medium) | 80–250 founders (default for 100) |
| Bandaraya (large) | 250+ founders, long multi-generation runs |

"Auto" picks the size from the founder count. Bigger maps have more homes, shops, facilities, bus lines and empty lots, and the town builds on those lots as it grows.

## What's simulated

- **People:** 6 attributes (inherited potential plus trained value), 5 personality traits, family desire, and 6 life strategies that adapt after setbacks.
- **Ageing genes:** body (Strength, Agility, Endurance) and mind (Intelligence, Perception) each have:
  - a personal onset age
  - a yearly decline rate
  - a floor
  
  Children inherit about half from their parents. Gym, healthy food and training slow the decline; stress speeds it up.
- **Decisions:** two 7.2-hour activity slots a day. Eligible actions get a utility, then a softmax probability, then a seeded draw, then a separate success roll. A failed risky task can also roll a conditional catastrophe.
- **Jobs and education:** 17 jobs with 3–30-day vacancies, where qualification is the only gate. Pay needs 20 shifts on separate days each month, with EPF and income tax. There are promotions, layoffs and retirement, degrees with PTPTN-style loans, scholarships and dropouts.
- **Lifestyle tiers:** each tier has real effects.
  - Food affects health and energy.
  - Housing ranges from kampung room to bungalow, and people visibly move.
  - Transport: a motorbike or car unlocks gigs, and people ride their vehicles on the map.
  - Leisure: the gym slows ageing, and the country club brings business luck.
- **Inflation:** each year's rate is drawn inside your min–max range (default −0.5% to 4.5%, centred on Malaysia's ~2% average). Prices, rents and fees follow it. Wages only partly keep up, and tax bands move with prices. The RM100m goal can be measured in Year-1 money (default) or nominal ringgit.
- **Bursa Rezeki stock market:** 8 fictional companies priced every trading day. Bust companies are delisted and replaced by IPOs.
  - Each company's value follows the economy around a long-run growth trend.
  - Residents' buying and selling moves prices through the square-root market-impact law.
  - The town's influence grows with its share of the market's money, up to a cap you can set.
  - Residents buy an index fund or individual shares. Some panic-sell after crashes, and others take profits.
- **Businesses:** 7 types with fat-tailed outcomes (rare booms, busts, saturation, corporate tax) and HQ towers for big firms.
- **Migration:** crowding, high rent and unemployment push households out, while jobs and space pull newcomers in. People who leave keep living off-screen: they may return, and children in town inherit when they die. The rate can be Off, Low (default), Normal or High, with Advanced multipliers. Rent rises when homes are crowded.
- **Families:** dating, couples and break-ups, pregnancy and twins. Each parent decides independently about care, with guardians, a harsh mode or a welfare mode. Upbringing shapes adult ability. Estates are split per parent at death, with trusts for minors.
- **Report and analysis:** an end-of-run report with a rule-based "why it turned out this way" summary, Hall of Fame, charts and a migrants vs. locals comparison, plus CSV export. In the app: family trees, compare-two-people and Director mode.
- **Integrity:** a double-entry-style ledger (money is never created or lost), consistency checks every quarter, and deterministic seeds (same seed and settings give the same history).

## Planned next

Character and family creator, save/load, Research Mode (thousands of headless runs with comparisons), life replay and forks, and a downloadable desktop package.

*Results describe outcomes of this simulation under its assumptions and random seed. They do not establish universal real-world causes of success.*
