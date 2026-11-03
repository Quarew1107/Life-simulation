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
| 🎬 / 🔇 / overlay | Director mode (camera jumps to interesting moments), music and sound effects (off by default, with separate music and effects volumes), map overlays (wealth, strategy, stress, family) |

At slow speeds the night (23:00–06:00) fast-forwards automatically. You can toggle this in the top bar.

**Engine tests:** open `tests.html` and click **Run all tests**. This runs the FSD acceptance cases, a determinism check, and 60-year invariant sweeps. `tools/balance.html?seeds=a,b&years=120` runs a headless balance report. For developers:
- `tools/hash.html?seeds=a,b&days=1500` prints state fingerprints, to confirm that an optimisation changes nothing.
- `tools/profile.html?founders=5000&days=60` times the engine and lists the hottest functions.

## Music and sound

Turn sound on with 🔇 on the map, or with **Sound off** on the setup screen. Your choice and both volumes are remembered. Browsers only start audio after your first click.
- **Music follows the town:**
  - a setup theme
  - calm daytime, or night city at slow speeds after dark
  - an upbeat track during a boom and a melancholy one in a recession
  - festival cues when Hari Raya, Chinese New Year, Deepavali or Christmas begins (at most one every 3 minutes)
  - the end-of-run report theme when the run ends or the report is open
- **Effects:**
  - milestones and goals
  - births, weddings and funerals
  - graduations, hires and promotions
  - new businesses, bankruptcies and crashes
  
  These play for notable town events and for everything that happens to the person you have selected. At 10 days/s and faster, only the biggest events make a sound.
- **At slow speeds:** train horns as trains pull in, the odd car horn, and fireworks on New Year and Merdeka nights.

The files live in `Sound effects/`. Keep their names if you swap any of them.

## Map sizes

| Map | Suggested for | Homes for |
|---|---|---|
| Kampung | up to ~60 founders | ~340 |
| Pekan | 60–250 founders (default for 100) | ~1,100 |
| Bandar | 250–700 founders | ~2,500 |
| Bandaraya | 700–2,000 founders | ~5,500 |
| Metropolis | 2,000–5,000+ founders | ~12,400 |

"Auto" picks the size from the founder count. **Each seed lays the town out differently**, following rules:
- the CBD sits near the centre and industry toward the edge
- the wealthy live around one corner, with kampung on the far side
- schools, clinics, parks and venues are spread through the housing
- the train station is always on the west edge

Bigger maps have more of everything, plus empty lots the town builds on as it grows.

**Performance:** small towns run at hundreds of simulated days per second. A 5,000-person Metropolis runs roughly 15–30 days/s at MAX on a Ryzen 5 laptop (about 12–25 seconds per simulated year), depending on how busy the laptop is. It slows down as the town grows. People show as coloured dots when zoomed out.
- At 10 days/s and faster, the simulation runs in short slices between screen frames, so big towns keep the map responsive.
- Speed-ups never change results: the same seed and settings still give exactly the same history.

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
- **Life goals and happiness:** everyone has a personal goal, which can change after achieving it or after a setback:
  - get rich (RM1M, RM10M or RM100M)
  - a dream home, or retiring early
  - running their own business
  - a big family
  - a happy, balanced life
  - being the fittest
  - top of their profession, or the highest education
  - helping others
  - building a dynasty
  
  Goals shape everyday choices but never the odds of success. Happiness (0–100) follows health, stress, family, leisure, goal progress and standing against the rest of town.
- **Scoreboards:** Richest, All-time, Happiest, Biggest family, Fittest and Most goals achieved. The RM100M race stays as the headline.
- **Leisure venues:** park, futsal, mamak, mall, cinema, bowling, karaoke bar, fine dining, spa, sky lounge and golf club.
  - Each costs a different amount and gives a different amount of joy, with diminishing returns.
  - You date and network with whoever is at the same venue, so the rich mostly meet the rich at the golf club and lounge, but everyone mixes at parks and the mamak.
  - Golf and lounge contacts bring business deals and job referrals.
- **Train station:** newcomers step off the train and leavers walk to it with suitcases. City commuter jobs pay more but cost a long daily ride.
- **Movers vs indoors:** riders and drivers loop around town, joggers and labourers move around their site, and indoor workers stay inside. Buildings show how many people are inside.
- **Families:** dating, couples and break-ups, pregnancy and twins. Each parent decides independently about care, with guardians, a harsh mode or a welfare mode. Upbringing shapes adult ability. Estates are split per parent at death, with trusts for minors.
- **Report and analysis:** an end-of-run report with a rule-based "why it turned out this way" summary, Hall of Fame, charts and a migrants vs. locals comparison, plus CSV export. In the app: family trees, compare-two-people and Director mode.
- **Integrity:** a double-entry-style ledger (money is never created or lost), consistency checks every quarter, and deterministic seeds (same seed and settings give the same history).

## Planned next

Character and family creator, save/load, Research Mode (thousands of headless runs with comparisons), life replay and forks, and a downloadable desktop package.

*Results describe outcomes of this simulation under its assumptions and random seed. They do not establish universal real-world causes of success.*
