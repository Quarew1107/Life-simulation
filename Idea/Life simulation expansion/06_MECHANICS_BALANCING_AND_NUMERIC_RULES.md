# Content-to-Engine Contract, Balancing Parameters and Numeric Design

**Purpose:** This is the authoritative numeric design layer for Playable Life. The 320 scenario records contain *intentions and labels*, NOT independently executable percentage-based rewards. All variables are **initial design assumptions**, not empirically verified data or verified live engine defaults. Claude must bind each to an existing real-world mechanic or a small, tested adapter and calibrate against the live country packs.

## 1. Units and safe interpretation

- `M` = current pack's representative gross monthly pay of a typical full-time worker *in displayed local currency*; normalize through the existing country money-scaling paths before adding any amounts to ledger accounts. Do not use the unscaled in-game engine amount for a country with a `money.scale` factor.
- `D` = real household disposable income/month after essentials and committed debts, floored at 0.
- `L` = household liquid savings after existing restrictions on pension, locked retirement or escrow funds.
- `Q` = school/course quality index 0–1; school provider-specific, not a direct copy of fee tier.
- `A` = fit of resident's relevant **existing** attributes/experience with an action (0–1).
- `R` = willingness/consent of each real counterpart resident (0–1), based on *their* personality/history.
- `T` = available time budget under the existing daily action calendar, not infinite parallel time.
- Rates expressed as `xM` are **fictional balancing proposals**, not official local market prices.
- Only normal economic flows and existing attribute advancement can actually change the world; no `+1 INT` for selecting the clever-looking button.

## 2. Four-tier school prototype: specific prices, selection and learning

| School type | Monthly fee, initial proposal | Real capacity/availability | Quality (overlapping illustrative range) | Admissions | Social-network effect |
|---|---:|---|---|---|---|
| Government/public | 0 direct tuition (up to 0.03M incidental) | public places; funds tied to actual education budget or existing school pathway | Q ~0.45–0.90, funding-dependent | residence/law/age/capacity | real peers from same district/class mix |
| Private | 0.35M | existing school business or traceable provider | Q ~0.50–0.92 | seat, eligibility, affordability | real student/family network, not made-up contacts |
| International | 1.10M | licensed provider, language access if modelled | Q ~0.52–0.94 | seat, eligibility, fee/aid | more diverse peers if they exist |
| Selective/prestige | 2.20M | selective seats, ability/grants | Q ~0.58–0.96 | eligibility + entrance/merit + seat + affordability | networks conditional on actual attendance/people |

**Research caution:** OECD PISA 2022 comparisons show the mean private-school academic advantage disappears after accounting for socioeconomic factors. Therefore more expensive does *not* mean guaranteed more intelligence or happiness; better fit, teacher resources, confidence, clubs and peers are separate pathways. Source: https://doi.org/10.1787/90348307-en.

**Country adapters:** China's middle-school pathway uses existing `zhongkao` / hukou / compulsory attendance; US, UK and Malaysia transition ages/entitlements differ. Tiers may not exist in every town: show *available schools first*, explain missing options and allow scholarship/apply/waitlist only where funded. For v1 a lightweight `SchoolOffer` record derived from existing public/private services is acceptable; do not automatically create four permanent physical buildings.

### 2.1 Hard feasibility before probabilities

For a paid offer with fee `F`: require all necessary school/admissions laws and places, and either:
- `D >= 1.25*F` with a nonnegative post-fee buffer, OR
- `L >= 12*F + 3*essential_monthly_expenses`, OR
- recorded funded scholarship plus affordable remainder.

The exact affordability thresholds must be checked against real existing household spending and tested for both poor and rich families; they are adjustable safeguards, not real financial regulation. Public access has no private-fee financial gate, but geographic/legal/capacity constraints remain.

### 2.2 Parental choice

For each feasible school j, score with dimensions normalized to 0–1:

```
Score[j] = 0.80*academicFit[j]
         + 0.50*parentValuesEducation*programFit[j]
         + 0.30*parentStatusValue*peerStatus[j]
         + 0.40*parentResponsibility*childWelfareFit[j]
         + childVoiceWeight(age)*childPreference[j]
         + 0.15*log1p(L/max(12*M,epsilon))
         - 1.00*(F/max(D,0.1*M))
         - 0.35*commuteStress[j] - 0.30*familyBudgetStress[j]
```

`childVoiceWeight` initially 0.10 at ages 3–8, 0.18 at 9–11 and 0.25 at 12–17. A direct parent player's choice expresses priority and normally determines the *application*, but the other caregiver's rights, finances, admissions and young person's preference still influence the outcome. Choose a feasible offer via existing softmax/RNG with temperature 0.8; do not introduce an unrelated random generator or unconditional acceptance. If admissions fail, return to another eligible option without infinite retries or duplicate fees.

Personality factors must be mapped to the existing discipline, responsibility, patience and strategy traits; the above variables are **derived**, not new innate character stats. Some parents value balanced happiness or local friends over elite status. Conflicting guardians get a recorded disagreement event, not forced agreement.

### 2.3 Learning and happiness

School participation affects the *existing study/education effort* through available teaching support, attendance, fit, household stress and learning time. Example relative learning-effort adjustment `mult = clamp(0.85 + 0.25*(Q - 0.5) + 0.15*(fit-0.5) + 0.10*(support-0.5) - 0.12*budgetStress, 0.70, 1.18)`; apply only if it can be layered onto existing progress without raising national graduation/calibration rates unfairly. Real study effort and earned qualifications, not tuition prices, unlock jobs. Happiness adjustment is separate and context-dependent; prestige with isolation/excessive stress can perform worse than a good public school.

**Example (M=3,000 fictional local units/month):** 0 government tuition; private 1,050; international 3,300; prestige 6,600. For household income 5,000 and essential spending 4,300, D=700: nonpublic schools fail first financial gate unless supported by scholarship or liquid savings. For wealthy parents, prestige remains an *option*, not the automatic decision. Actual fees of any implemented local school override this prototype.

## 3. Character creation and development

- Candidate standard creator budget: six attributes (intelligence, strength, perception, charisma, agility, endurance), 30 points total, each 2–8. **Only adopt after checking actual founder baseline**; do not turn standard custom creation into hidden privilege.
- Initial family class, wealth, gender, caregiver availability, birthplace and privileges should derive from the existing canonical person/household generator unless an explicit `Advanced Sandbox Custom Circumstances` option is selected.
- Appearance, hairstyle, clothing, locale and map focus never give ability boosts or consume RNG.
- Life progress: improve skills by spending existing time/money/education and responding to real failures. Prefer percentage modifications to existing progression, never direct large one-click skill jumps.

## 4. Numeric action packages (initial value suggestions)

| Activity | Up-front / ongoing cost design | Real time | Success/side-effect mechanism | Required existing counterpart |
|---|---|---|---|---|
| Study session | 0 to 0.02M per event, depending on materials | 0.5–2 hours | existing education/study chance; fatigue offsets | existing school/caregiver if minor |
| Optional club | 0–0.08M monthly | 2–5 h/week | skills, peer contact and fatigue via existing model | real peers/club provider, else cosmetic |
| Training/certificate | actual course fee (vocational typically lower than university) | course duration | admission, attendance, exam, credentials | education provider / state |
| Apply for job | 0–0.01M admin/travel, often free | 0.5–1 day | existing job suitability + employer vacancy | real employer / vacancy |
| Seek promotion | no automatic fee | 1 discussion + multi-month performance record | existing employer discretion and budget | existing supervisor/business |
| Start local service business | existing minimum founder capital; illustrative 3–8M for small bakery-type | 14–90 days setup, plus recurring obligations | existing market demand, wages, insolvency | actual firm, employees, ledger |
| Hire one worker | wages from firm according to existing rate + statutory employer costs | matching stage | job applicant consent/eligibility; employer cashflow | actual candidate + funded position |
| Invest in listed asset | investment amount chosen, max legal/affordable liquid assets | same trading period | market price and subsequent real performance | existing stock/exchange ledger |
| Domestic trip | 0.20–0.60M/person | 2–7 days | stress/recovery, time off work, local spending | actual transport/lodging or declared outside-services sector |
| International trip | 1.5–3.0M/person | 5–14 days | legal/money/leave/health checks, abstract travel | outside-services sector unless real cross-country world exists |
| Medical appointment | actual provider charge after healthcare coverage | 0.5–2 days | existing services/health logic | hospital/clinic/treasury/insurer |
| Charity / civic donation | user amount capped at affordable liquid cash | one ledger transaction | fundraiser capacity and verifiable expenditure | community account / named recipient |
| Mortgage / home | actual housing price/available financing | financing/settlement events | existing housing, bank, tax and interest | real home and lawful lender |
| Self-education / language skill | 0–0.2M per month with time allocation | 4–8h/week | existing education/skill logic, not a new language-to-wage automatic bonus | teacher/course if paid |
| Romantic invitation | typical date 0.02–0.10M if accepted | half-day to 2 days | real adult NPC availability, compatibility and consent | named adult person |
| Wedding | explicit budget 0.5–3M, unless simpler low-cost civil option | 1–7 days | both adults consent, actual change in partner status | two actual residents + service payments |
| Elder care | real service cost 0.1–0.5M/month (if available) | recurring | changes actual family time and care burden | elder + household/care provider |

Any activity absent from the live simulation must ship as clearly labelled **cosmetic/narrative only** or be deferred, rather than silently creating a parallel economic system.

## 5. Fictional lottery (only if authorised for later adult content)

One paid ticket per player per simulated month; adult/legal-country only. Proposed ticket price = 0.001M. Mutually exclusive prize outcomes:

| Outcome | Probability | Prize |
|---|---:|---:|
| Small | 15% | 0.002M |
| Medium | 2% | 0.010M |
| Jackpot | 0.001% | 10M |
| No prize | 82.999% | 0 |

Expected gross payout = `0.15*0.002 + 0.02*0.010 + 0.00001*10 = 0.0006M`, or 60% of the ticket cost. **Expected loss 40% of ticket price**, excluding taxation. Prize pool must have an actual funded counterparty and solvency gate; the whole prize **cannot** appear as free minted money. No real-money gambling, no pay-to-win, no user monetisation of betting. Keep odds transparent and avoid exploit loops. Do not award supernatural intelligence/luck for gambling.

## 6. Relationship, consent, family and sensitive choices

- Real adult residents may accept or refuse invitations. Use existing relationship/romance and family APIs; an action can start a request but never override a person. Adult casual intimacy, partnership, marriage and co-parenting remain separate states if the engine supports them; if not, implement only what can be represented faithfully with small versioned additions.
- Infidelity and separation can affect trust, childcare and household finances only through real history and existing family procedures. Make no erotic scenes or moralised multipliers.
- Teenage romance is age-appropriate, same-peer-stage only; **no adult/minor sexual interactions**.
- Player suicide-related request is covered as a serious mental-health crisis theme, not a repeatable instant-death action or a rewarded method-based scenario. Unplanned tragic outcomes, if already modelled, remain non-graphic and subject to wellbeing/safety review. Provide confidential help-seeking/recovery choices and option to mute sensitive narrative content.
- Grief and mental-health support are not uniformly negative-choice puzzles. Outcomes should be sensitive and never imply that people can always prevent harm if they choose a single correct button.

## 7. Fate, death, family continuity and player succession

The selected person may die at any age. Use only existing `World.die`, `Fa.settleEstateV3` (where the current rules revision applies), child guardian/family references, and the God Fate path for explicit sandbox intervention. A normal-life death should use normal probabilities, not the Fate mechanic. If a command is pending when the controlled resident dies, cancel the command with a single immutable reason receipt and no payment. Only AFTER the normal death and estate have completed, offer the succession view:

1. Living offspring (all actual permitted child links, including cross-town references if currently supported).
2. Random living eligible resident (dedicated seeded player-mode selection; once chosen persist the ID).
3. Search and choose a named existing living resident.
4. Spectator (no controller; original autonomous simulation continues).

No resurrect/undo/deferred tax. Keep previous lived lives' historical results in player journal. Preserve inherited business assets only as granted by the current estate rules, not an arbitrary handoff bonus.

## 8. Social and economic ripple evidence

Every implemented story that claims a town-level impact must map to a measurable event already in the world. Recommended `impactReceipt` categories: `EMPLOYMENT` (one hired real worker), `FAMILY` (one actual birth/education/relationship record), `FINANCE` (one balanced ledger transfer), `CIVIC` (policy adopted by legitimate vote/appointed body), `BUSINESS` (real capital/ownership/market effect), `HEALTH` (service use in existing provider), `SOCIETY` (verifiable set of beneficiaries or real aid). An unimplemented aspiration should be labelled `narrative / no verified town effect`.

**Important:** A before/after town statistic is descriptive, not proof that the player's action caused the change. The optional future paired-with-autonomous comparison must label its differences as *model counterfactuals conditioned on different action histories* with potential RNG divergence.

## 9. Balancing guardrails and measurable acceptance criteria

- Default OFF: no change to old saved worlds, random streams, hashes, population and Classic fingerprints.
- Character ON: only one playable resident; other people remain autonomous, without separate company, government, school or money state.
- Apply no command twice; UI double click and reload cannot duplicate fees/loans/births/marriage/estate.
- Median private-school student should NOT automatically graduate more often purely due to fee; verify after income/ability/fit adjustment. Public should sometimes be best for an individual.
- Real ledger invariant zero at every verified month/quarter after player actions; in tests immediately after each economic command.
- No guaranteed relationship success, examination pass, job promotion, startup profit or lottery jackpot.
- For 2,500 residents, keep event eligibility work bounded by **one controlled actor** plus indexed candidate lookup, not 320 * population * every day.
- Story Pace: 80 years ~29,220 sim days. For 2h total with 15min decision dwell, simulate ~4.64 days/s while not paused. If 25min dwell, ~5.25 days/s. Benchmark actual `10x` before using the label. Prior documented full-app China 2,500 speed ~27 days/s (Turbo ~33) indicates sufficient raw capacity on the target laptop, but the player-mode UI can still become a bottleneck.
- Story prompt target: default around 1–2 significant decisions/year during adulthood, more at school transitions but fewer in baby stage; voluntary action inbox unlimited in principle but guarded by real action/cooldown budgets. Record median interruptions/hour and time spent deciding.
- Translation changes (EN ↔ ZH) must be 100% presentation-only and preserve world and ledger hashes.

## 10. External references and notes

- OECD, *How do public and private schools differ in OECD countries?*, 29 Jan 2024: https://doi.org/10.1787/90348307-en
- BitLife official product and help: https://bitlifeapp.com/ , https://bitlifeapp.com/help/
- English and Chinese language adaptations use stable event IDs and message keys; language is not tied to `cfg.country`.
