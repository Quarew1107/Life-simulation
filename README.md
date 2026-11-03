# Life Evolution Simulator

A town of strangers in **Bandar Rezeki** each try to reach **RM100 million**. Nobody is controlled: every choice is a weighted dice roll from their attributes, personality, life strategy, needs and money. You set the rules, then you watch who makes it, and why.

## How to run

Double-click **`Start Simulation.bat`**, or open `index.html` in Edge or Chrome. Nothing to install, and it works offline. The pixel font loads from Google Fonts when you're online. Offline, a plain font is used instead.

**Presets:** the setup screen starts on **Malaysia today**, calibrated to DOSM figures:
- the welfare safety net is on
- about 1.6 children per woman
- life expectancy of about 75

**Classic** brings back the original rules: harsh mode, about 2.5 children per woman and longer lives. Changing any preset setting switches the preset to Custom.

**Save / load:** 💾 **Save** in the top bar downloads the whole world as a compressed file. Open it again with **📂 Load saved world** on the New world screen. A loaded world continues exactly as it would have without saving.

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

**Engine tests:** open `tests.html` and click **Run all tests**. This runs:
- the FSD acceptance cases and a determinism check
- 60-year invariant sweeps
- the foundation checks: the Classic preset still reproduces the original engine exactly, save/load is exact, and optional systems plug in cleanly

`tools/balance.html?seeds=a,b&years=120` runs a headless balance report. `tools/calibration.html` runs the default settings for 80 years and compares them with Malaysian figures (life expectancy, fertility, unemployment, wages, income inequality).

For developers:
- `tools/hash.html?seeds=a,b&days=1500` prints state fingerprints, to confirm that an optimisation changes nothing.
- `tools/profile.html?founders=5000&days=60` times the engine and lists the hottest functions.
- With Node installed, `node tools/headless.js tests|soak|calib|hash|bench` runs the same checks without a browser (see the top of the file).

## Music and sound

Turn sound on with 🔇 on the map, or with **Sound off** on the setup screen. Your choice and both volumes are remembered. Browsers only start audio after your first click.
- **Music plays at 1× and, a little faster, at 10×.** At 60× and faster it fades out and picks up where it left off when you slow down. Sound effects and event cues play at every speed.
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
  
  These play for notable town events and for everything that happens to the person you have selected, at every speed. Each sound has a short cooldown, so fast runs don't pile them up.
- **At slow speeds:** train horns as trains pull in, the odd car horn, and fireworks on New Year and Merdeka nights.

The files live in `Sound effects/`. Keep their names if you swap any of them.

## Street layouts

With the Malaysia preset (**Street layout: Varied**), each seed builds a different town:
- plots of different sizes, with car parks, playgrounds and gardens on the spare ground
- tree-lined avenues, and usually a river with bridges
- superblocks where short road pieces are dropped and joined by footpaths
- a coastline with beach and fishing boats, or forested hills, along one edge
- empty land that starts as jungle, an oil palm estate or scrub until the town builds on it
- worship districts with a masjid, a Chinese temple, a Hindu temple and a church

People walk and drive along the real road network. **Grid** (the Classic preset) keeps the original equal blocks.

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

## How the town looks

The map is drawn in a 3/4 top-down pixel style: you see each building's roof and front wall, with a soft shadow. Everything is drawn by code from one shared palette, with no image files, so it still works offline and costs almost nothing per frame.
- **Malaysian buildings:**
  - kampung stilt houses with zinc or attap roofs
  - Peranakan-style shophouses with five-foot-ways
  - PPR flats with laundry poles and motorbikes
  - terrace rows with porches and cars
  - condos with rooftop pools
  - gated bungalows
- **Streets:** grass, pavements, longkang drains and zebra crossings.
- **People:**
  - face the way they walk, with shading and an outline
  - wear work uniforms
  - wear festival clothes on their own community's festivals: baju Melayu and songkok or baju kurung at Raya, saree or kurta at Deepavali, red at Chinese New Year
- **Light:** at dusk the town turns golden. At night, real windows, mamak fronts, cinema marquees and karaoke neon light up.
- **Performance:** only on-screen people are drawn, so big towns stay smooth when zoomed in.

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
- **Social class (Society on):** recalculated every month from household income, the way DOSM defines **B40 / M40 / T20**.
  - **Extra groups:** a T1 elite (the richest 1%) and households in hardship.
  - **Mobility:** children carry their household's class at 12, and their own class is recorded at 35. This gives the Society tab's mobility table: did people who grew up B40 move up?
  - **Comparison:** class cut-offs are charted against DOSM 2024 (RM5,250 and RM11,820).
- **Ethnicity:** the 2025 DOSM mix (Malay, Chinese, other Bumiputera such as Iban and Kadazan-Dusun, Indian, others). Groups differ in names, looks, festivals and religion mix, **never in ability**.
- **Religion (Society on):** Islam, Buddhism, Christianity, Hinduism, other or none, assigned from the 2020 census by ethnicity, with personal devotion half inherited. Religion acts only through practices:
  - Friday prayers, Sunday service and temple visits relieve stress and build friendships, but take time
  - zakat (2.5% of savings above the nisab) and donations feed each community's fund, which helps its poor
  - Ramadan fasting, then festival spending (Raya, Chinese New Year, Deepavali, Christmas, Gawai)
  - devout Muslims avoid the bar and non-Shariah-compliant shares
  - devotion raises the wish for children and lowers break-ups
  - under the Malaysian interfaith rule, a non-Muslim converts to marry a Muslim (a setting)
- **Crime & justice (Crime & vice: Lively, Realistic, Lawless or Off):**
  - **Temptation:** each month every adult gets a temptation score made of need (little cash, no job, cravings), low self-control, age (offending peaks at 18–25), peers and record, minus deterrence (police), devotion, children and a good job. A few people get a crime opportunity. It shows up as a choice in "Why did they do that?", and they may still say no.
  - **Crimes:** snatch theft, house-breaking, vehicle theft, scams, robbery and assault. About 2% of violent crimes end in a killing.
  - **Justice:** police solve some cases. Courts convict about 7 in 10 people arrested, less often if they can afford a lawyer. Sentences range from fines to prison. Prisoners lose their jobs, partners may leave and children go to family or welfare. A criminal record lowers hiring chances.
  - **Drugs:** users start through stress, peers and age. Addiction costs money (to dealers) and health, and some people overdose. People recover by quitting or in rehab, and many relapse. The drug-policy setting picks Malaysian mix, punitive, treatment or decriminalised.
  - **Gangs:** gangs form around a bold, charismatic offender. They deal drugs, take a share of members' crimes and collect protection money from shops on their turf. They recruit young unemployed people, fight rival gangs and get raided by the police.
  - **Calibration:** at **Realistic**, rates land near Malaysia's: about 170 index crimes, 590 drug users and 260 prisoners per 100k. **Lively** (the default) multiplies them by 10, so a small town shows something.
  - **On the map and in the UI:** a justice district (police, court, prison with an exercise yard, rehab), patrol cars, gang graffiti, crime and gang-turf overlays, a Crime tab and a report section.
- **Government & elections (on in the Malaysia preset):**
  - **Treasury:** taxes go into a real town treasury (income tax, corporate tax, fines, inheritance tax). It pays for police wages, the leader's salary, cash aid, basic income, welfare, free university places, flood relief, interest and public services. When it runs short it borrows, and deep debt forces austerity.
  - **Twelve laws the engine really uses:**
    - income tax and corporate tax rates
    - minimum wage (RM1,700 by default)
    - B40 cash aid and universal basic income
    - inheritance tax
    - police force (officers per 1,000; Malaysia has about 4)
    - drug policy and university fees
    - criminal-record checks in hiring
    - affirmative action
    - whether bars are allowed
  - **Elections** every 5 years (a setting):
    - Candidates stand on platforms of law changes, and responsible ones avoid promises the town can't pay for.
    - Each voter weighs what every promise would mean for them. They see the true effect plus noise, so better-educated people judge laws more accurately.
    - Voters also weigh their left-right and conservative-liberal leanings, the leader's record and approval, shared ethnicity or religion (a setting), charisma and campaign spending, then decide whether to vote.
    - Polling happens at the schools. Turnout lands around Malaysia's 74%.
  - **Leader:** approval is tracked monthly. Corruption is possible (a leader low in responsibility may skim the treasury) and can end in scandal, prison and a snap election. Leaders also respond to recessions and crime waves.
  - **Police:**
    - Officers are public servants, hired up to the budgeted number.
    - They drive the patrol cars, and their number sets how often crimes are solved.
    - Arrested suspects wait on remand in the police lock-up (Lokap) until court. Time on remand counts toward the sentence, and long remand can cost people their jobs.
  - **Events:** monsoon floods hit low-lying and riverside homes, with RM1,000 relief per household. Haze harms health.
  - **On the map and in the UI:** the town hall (Dewan Bandaraya) and padang, campaign flags, flood water, a Government tab (laws, treasury, elections and how each class, religion and ethnic group voted), a politics card on each person and a report section.
- **Map overlays:** class, religion, ethnicity, crime and gang turf.
- **Report and analysis:** an end-of-run report with a rule-based "why it turned out this way" summary, Hall of Fame, charts and a migrants vs. locals comparison, plus CSV export. In the app: family trees, compare-two-people and Director mode.
- **Integrity:** a double-entry-style ledger (money is never created or lost), consistency checks every quarter, and deterministic seeds (same seed and settings give the same history).

## Planned next

The roadmap is in `docs/ROADMAP.md`:
- social class, religion and an ethnicity update
- crime, justice, drugs and gangs
- elections, laws and a town treasury
- what-if scenarios: Born Equal, Great Reset, Eternal Life, Education Ban and more

Each new system can be switched off, and with all of them off the Classic preset reproduces the original engine exactly.

*Results describe outcomes of this simulation under its assumptions and random seed. They do not establish universal real-world causes of success.*
