# Playable Life Mode — Acceptance and Regression Test Matrix

**Rule:** A task is not complete because a screen looks right. For each stage, the engineer must demonstrate valid model effects, failure paths, persistence and unchanged spectator-mode behaviour. Current source methods and test names must be confirmed by Claude at PL-00.

## A. Baseline / version preservation (release blockers)

| ID | Test | Expected acceptance |
|---|---|---|
| B01 | Load new default, Play a Life never enabled | All current-country+Classic engine fingerprints and seeded event histories match the pinned baseline. No extra RNG draws, no new player command/cooldown state in OFF worlds. |
| B02 | Load an existing revision-1/4/5/9 save | Loads, keeps rules version, remains spectator mode, preserves prior calibration/results. |
| B03 | Merge rules revision 10 population work separately | PL branch rebases/merges only after owner confirms rev10 status; no duplicate demography logic. |
| B04 | World save with mode ON, commands pending; reload twice | Exactly once effect per command; no stale double charge, duplicate marriage, child, job, purchase or estate record. |
| B05 | Switch English / Simplified Chinese | Same world hash, transaction balances, RNG state, population and NPC history; only rendered text changes. |
| B06 | God Mode Fate triggers during a queued player action | Existing God Fate processing order obeyed; dead target command cancels without financial effects; player succession follows settled death. |
| B07 | Move controlled resident across region towns | Controlled identity resolves to correct active person; no duplicate money/relationship; cross-town ledger and links stay valid. |
| B08 | Custom-created person | Exactly one real world person; valid parent/guardian, assets and qualifications; clear sandbox provenance if statistically privileged. |

## B. Agency, time, events and pacing

| ID | Test | Acceptance |
|---|---|---|
| A01 | Boundary ages 2y 364d -> 3; 11y -> 12; 17y -> 18; 59y -> 60 | Exactly one age stage; appropriate permissions. Age can be computed from birth day rather than rounded age display. |
| A02 | Infant clicks a caregiver-financed action | Request generated; no direct minor spending; caregiver may refuse with meaningful explanation. |
| A03 | 12-year-old selects expensive school | Requests rather than forced enrolment; parent may refuse; scholarship can change feasibility. |
| A04 | Adult parent selects school for child | Child opinion recorded, co-guardian rights respected, funding and school admit checks enforced. |
| A05 | Event repeated / double-click / back button | No duplicate reward/transaction; only one command receipt for one action. |
| A06 | User ignores an event until deadline | Expiry clearly shown; autonomous fallback doesn't invent actions and doesn't give free rewards. |
| A07 | Sensitive story toggle OFF | Optional disturbing narrative hidden, underlying normal NPC world RNG/health trajectory unchanged absent explicit rules switch. |
| A08 | Event content list grows from 20 to 320 | Eligibility indexed to one controlled actor, not every person every day; duplicate IDs rejected. |
| A09 | Story Pace long-run | Actual days/s and decision dwell measured, two-hour goal labelled target not guarantee. |
| A10 | Save during modal pause / after click before next day | Pending decision and command return unambiguously; no lost cost or double commit. |

## C. Education economics and fairness

| ID | Test | Acceptance |
|---|---|---|
| E01 | Household income 5,000, essentials 4,300, M=3,000, no buffer/scholarship | Public option available if lawful; private 1,050/month fails initial recurring-fee affordability gate; international 3,300 and selective 6,600 fail. |
| E02 | High-income household with education-oriented but status-averse parents | May select public school, does not automatically select expensive one. |
| E03 | Expensive school with no places | Application rejected or waitlisted; no tuition charged for a non-enrolment except explicit lawful application fee. |
| E04 | Funded scholarship improves access | Real sponsor budget declines; recipient's education fees reduced by same amount; no money creation. |
| E05 | Real two-parent disagreement | Decision applies rights and recorded preference/consent; no silent override. |
| E06 | School teaching quality and student fit | A strong public institution can yield better study outcomes than a poor-fit prestige school; success remains stochastic. |
| E07 | School tiers in UK/US/China/Malaysia | Country-specific ages/laws and actual currency scale respected; China zhongkao not bypassed. |
| E08 | New secondary school layer toggled OFF | National degree admissions and tertiary attainment unchanged from pinned baseline. |
| E09 | New school layer ON across multiple seeds | Track access/attainment by income (and age), no instant guaranteed graduate inflation; outcome mechanism documented. |

## D. Adult economies, relationships and institutions

| ID | Test | Acceptance |
|---|---|---|
| D01 | Apply to real vacancy; employer rejects | No employment created; explanations sourced from real fit and vacancies; no salary paid. |
| D02 | Salary raise; firm cannot afford | Rejected/countered; no negative silent salary fund. |
| D03 | Start a business; player lacks capital | Cannot create a viable firm without permitted financing; no newly minted founding money. |
| D04 | Buy a business from another resident | Buyer debit equals seller credit; shares remain exactly conserved including outsideShare and tax obligations. |
| D05 | Hire one worker | Actual named eligible resident accepts; wage obligation funded, labour stats update. |
| D06 | Player invests in asset | Real position and future market exposure; same market returns as autonomous residents, no fixed click profit. |
| D07 | Fictional lottery | Probabilities sum to 1, expected payout 60% of ticket cost under proposed schedule, reserves fund all prizes; one entry per month. |
| D08 | Ask NPC on date / marry / propose casual relationship | Explicit consent; NPC refusal possible; no adult-minor intimate pairing. |
| D09 | Adult parent requests pregnancy / adoption / care | Only existing legal family and conception/adoption pipelines; no guaranteed baby on click. |
| D10 | Business development grant | Valid actual treasury budget, eligible proposal, anti-double-award; no free outside cash disguised as local grant. |
| D11 | Domestic/foreign trip | Actual days and costs charged; no instantaneous teleport to unimplemented region. |
| D12 | Civic policy request | Government may refuse; policy actually changes only through the existing legitimate council/government process. |
| D13 | Mental-health crisis story | Non-graphic, opt-out/support route; no mechanic details and no achievement/strategic advantage for self-harm. |

## E. Death, legacy and player transitions

| ID | Test | Acceptance |
|---|---|---|
| S01 | Controlled character dies before end of world | Normal death and estate complete; controls stop before a new command; then handoff UI shows. |
| S02 | Eligible living offspring exist | Search list resolves actual current IDs/towns, selects one to control. |
| S03 | No eligible living offspring | That option disabled; other random/choose/spectator paths work. |
| S04 | Random new controlled person | Selected person is living and persisted; no secret rerolls or double RNG draws on reload. |
| S05 | Choose specific existing resident | Correct ID without creating an extra person. |
| S06 | Choose spectator | Player control removed, world continues under pre-existing NPC routines. |
| S07 | Death of business owner/parent | Estate taxes, guardians, shares and employer survival obey current rules, normal invariant checks pass. |
| S08 | Repeated succession, pause and reload | Historical player record persists, no accidental resurrect, no duplicate state. |

## F. UI, accessibility, localisation and website

| ID | Test | Acceptance |
|---|---|---|
| U01 | Initial setup with Play a Life OFF | Equal discoverability but default watched-world selected; no user opt-in implied. |
| U02 | 320px viewport, 200% text, EN/zh-Hans smoke | All crucial buttons visible/readable, no clipped critical text; CJK font fallback. |
| U03 | Keyboard-only school selection and death handoff | Logical focus, Escape, screen-reader names, no trapped modal. |
| U04 | 2,500 China founders / Turbo | Map still responsive; active player panel update bounded by events, not all agents. |
| U05 | `file://` and Vite preview (if migration is approved) | Existing workflow either preserved or clearly replaced with tested local server; files in production load correctly. |
| U06 | Old save import/export, with large historical worlds | Not silently stored entirely in `localStorage` beyond quota; use robust existing save path, export/import and refresh tests. |
| U07 | Security | All user-created names escaped; no untrusted HTML injection from locale/event data. |

## G. Performance/quality benchmark method

Compare the **same initial population, seed, year, country, rules revision and browser power plan**, alternating before/after builds due to 15-30% laptop heat variance documented in `PERFORMANCE.md`. Profile 100, 500 and China 2,500 founders, one-tick action latency, fast days/s, idle UI frame time, CPU and peak memory. Existing measured 2,500 China baseline (~27 days/s, ~33 Turbo) is **historical rev-5 evidence, not an unchanging current performance promise**; record a fresh baseline at PL-00. An aspirational budget is <=5% additional engine cost with Playable Life enabled but idle, and <10% full-app slowdown under comparable UI activity. Do not compromise correctness to meet it.

## H. Owner review gates

Every PL-XX submission must include: changed paths; engine rules and save version status; tests run and pass/fail; Classic + four-country deterministic checks; ledger invariants if any state changes; screenshots/short clip for UI stages; measured performance when relevant; known gaps; branch and commit SHA; reproducible manual test steps. Claude must push to the authorised *feature branch only*, stop and await owner approval before starting the next task or merging to main.
