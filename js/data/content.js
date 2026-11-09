// Game content tables: attributes, jobs, courses, gigs, training, lifestyle tiers,
// business types, economy regimes and names. All values are provisional balance
// settings (RM per month unless noted), not empirical claims.
(function (LES) {
  'use strict';
  const C = LES.C = {};
  const w = (i, s, p, c, a, e) => [i, s, p, c, a, e];

  C.ATTR = ['INT', 'STR', 'PER', 'CHA', 'AGI', 'END'];
  C.ATTR_NAMES = ['Intelligence', 'Strength', 'Perception', 'Charisma', 'Agility', 'Endurance'];
  C.INT = 0; C.STR = 1; C.PER = 2; C.CHA = 3; C.AGI = 4; C.END = 5;
  C.PERS = ['dis', 'pat', 'risk', 'resp', 'res'];
  C.PERS_NAMES = { dis: 'Discipline', pat: 'Patience', risk: 'Risk tolerance', resp: 'Responsibility', res: 'Resilience' };

  C.STRATEGIES = ['WORK', 'EDU', 'SPEC', 'ENT', 'INV', 'BAL'];
  C.STRATEGY_NAMES = { WORK: 'Employment', EDU: 'Education', SPEC: 'Specialist', ENT: 'Entrepreneur', INV: 'Investor', BAL: 'Balanced' };
  C.STRATEGY_COLORS = { WORK: '#5aa9e6', EDU: '#b892ff', SPEC: '#3ec7b5', ENT: '#ff8c42', INV: '#f2c14e', BAL: '#9aa5b1' };
  C.XP_CATS = ['manual', 'technical', 'office', 'sales', 'medical', 'business'];

  // ---- Qualifications & courses ----
  C.QUALS = {}; // names from the country pack
  // Expansion 1 (rules revision 5): six more bachelor's degrees. Older revisions never offer them.
  C.BACHELORS = ['BACH_GEN', 'BACH_BUS', 'BACH_ENG', 'MED', 'BACH_SCI', 'BACH_CS', 'BACH_ARCH', 'BACH_LAW', 'BACH_PHARM', 'BACH_SOC'];
  C.EXPANSION_REV = 5; // content marked exp: 5 exists only in worlds with cfg.rulesRev >= 5
  C.expOn = (w, x) => !x || !x.exp || (w && w.cfg.rulesRev >= x.exp);
  C.COURSES = [
    { id: 'VOC', minInt: 2, place: 'kolej', diff: 3.5, w: w(.4, .1, .3, 0, .1, .1) },
    { id: 'BACH_GEN', minInt: 5, place: 'university', diff: 4.5, w: w(.7, 0, .2, .1, 0, 0) },
    { id: 'BACH_BUS', minInt: 5.5, place: 'university', diff: 5, w: w(.6, 0, .2, .2, 0, 0) },
    { id: 'BACH_ENG', minInt: 6.3, place: 'university', diff: 6, w: w(.8, 0, .2, 0, 0, 0) },
    { id: 'MED', minInt: 7.5, place: 'university', diff: 7, w: w(.7, 0, .2, 0, 0, .1) },
    { id: 'MASTER', minInt: 5, place: 'university', diff: 6.5, w: w(.8, 0, .2, 0, 0, 0), prereq: 'BACH' },
    // Expansion 1: degrees that lead to the new professions (fees and months from the country pack).
    { id: 'BACH_SCI', minInt: 5.8, place: 'university', diff: 5.5, w: w(.7, 0, .2, 0, 0, .1), exp: 5 },
    { id: 'BACH_CS', minInt: 6, place: 'university', diff: 5.8, w: w(.7, 0, .2, .1, 0, 0), exp: 5 },
    { id: 'BACH_ARCH', minInt: 6.3, place: 'university', diff: 6.3, w: w(.6, 0, .3, .1, 0, 0), exp: 5 },
    { id: 'BACH_LAW', minInt: 6.3, place: 'university', diff: 6.2, w: w(.6, 0, .2, .2, 0, 0), exp: 5 },
    { id: 'BACH_PHARM', minInt: 6.8, place: 'university', diff: 6.5, w: w(.7, 0, .2, 0, 0, .1), exp: 5 },
    { id: 'BACH_SOC', minInt: 5, place: 'university', diff: 4.8, w: w(.4, 0, .2, .3, 0, .1), exp: 5 },
  ];
  // Expansion 1: specialisations of the vocational certificate and the master's degree. The credential is
  // still VOC or MASTER (same entry rules, places and job gates); the specialisation is the name on it and a
  // small edge when applying for a job that prefers it. weight = how often it is chosen (by ability fit);
  // fee = multiple of the country's course fee.
  C.SPECS = {
    VOC: [
      { id: 'VOC_TRADES', name: 'Skilled Trades', weight: 30, fee: 1.1, w: w(0, .3, .4, 0, .3, 0) },
      { id: 'VOC_CARE', name: 'Care & Emergency Support', weight: 18, fee: 1.15, w: w(0, 0, .4, .3, 0, .3) },
      { id: 'VOC_IT', name: 'IT Support', weight: 15, fee: 1.05, w: w(.5, 0, .3, .2, 0, 0) },
      { id: 'VOC_LAB', name: 'Laboratory & Environmental Technology', weight: 10, fee: 1.25, w: w(.4, 0, .4, 0, .2, 0) },
      { id: 'VOC_HOSP', name: 'Hospitality & Culinary Services', weight: 17, fee: 0.7, w: w(0, 0, .3, .4, .3, 0) },
      { id: 'VOC_TRANSPORT', name: 'Transport & Logistics', weight: 10, fee: 1, w: w(0, 0, .4, 0, .3, .3) },
    ],
    MASTER: [
      { id: 'MAST_RESEARCH', name: 'MSc Research & Applied Science', weight: 35, fee: 1.2, w: w(.7, 0, .2, 0, 0, .1) },
      { id: 'MAST_DATA', name: 'MSc Data Science & Analytics', weight: 30, fee: 1.1, w: w(.7, 0, .3, 0, 0, 0) },
      { id: 'MAST_MBA', name: 'Master of Business Administration', weight: 35, fee: 1.3, w: w(.4, 0, .2, .4, 0, 0) },
    ],
  };
  C.SPEC_BY_ID = {};
  for (const k of Object.keys(C.SPECS)) for (const x of C.SPECS[k]) C.SPEC_BY_ID[x.id] = Object.assign(x, { of: k });
  C.COURSE_BY_ID = {};
  for (const c of C.COURSES) C.COURSE_BY_ID[c.id] = c;

  // ---- Jobs: req = minimum credential (the only eligibility gate) ----
  C.JOBS = [
    { id: 'cleaner', req: null, w: w(0, .3, .2, 0, .2, .3), diff: 2.5, cat: 'manual', place: 'mall' },
    { id: 'retail', req: null, w: w(.1, 0, .3, .5, 0, .1), diff: 3, cat: 'sales', place: 'mall' },
    { id: 'rider', req: null, w: w(0, .1, .3, 0, .3, .3), diff: 3.5, cat: 'manual', place: 'warehouse', risk: 'physical' },
    { id: 'factory', req: null, w: w(.1, .3, .3, 0, .1, .2), diff: 3.5, cat: 'manual', place: 'factory', risk: 'physical' },
    { id: 'construction', req: null, w: w(0, .5, .1, 0, .1, .3), diff: 4.5, cat: 'manual', place: 'construction', risk: 'heavy' },
    { id: 'sales', req: null, w: w(.1, 0, .2, .6, 0, .1), diff: 5, cat: 'sales', place: 'office' },
    { id: 'chef', req: 'VOC', w: w(.1, .1, .4, 0, .3, .1), diff: 4.5, cat: 'technical', place: 'hawker' },
    { id: 'mechanic', req: 'VOC', w: w(.3, .3, .3, 0, .1, 0), diff: 5, cat: 'technical', place: 'workshop', risk: 'physical' },
    { id: 'electrician', req: 'VOC', w: w(.3, .1, .3, 0, .3, 0), diff: 5.5, cat: 'technical', place: 'construction', risk: 'heavy' },
    { id: 'nurse', req: 'VOC', w: w(.2, 0, .3, .3, 0, .2), diff: 5, cat: 'medical', place: 'hospital' },
    { id: 'teacher', req: 'BACH', w: w(.4, 0, .1, .4, 0, .1), diff: 5, cat: 'office', place: 'school' },
    { id: 'accountant', req: 'BACH_BUS', w: w(.6, 0, .4, 0, 0, 0), diff: 6, cat: 'office', place: 'office' },
    { id: 'banker', req: 'BACH_BUS', w: w(.5, 0, .2, .3, 0, 0), diff: 6.5, cat: 'office', place: 'bank' },
    { id: 'engineer', req: 'BACH_ENG', w: w(.6, 0, .4, 0, 0, 0), diff: 6.5, cat: 'technical', place: 'factory' },
    { id: 'softdev', req: ['BACH_ENG', 'BACH_CS'], w: w(.7, 0, .3, 0, 0, 0), diff: 7, cat: 'technical', place: 'techhub' },
    { id: 'manager', req: 'BACH_BUS', w: w(.4, 0, .1, .5, 0, 0), diff: 7, cat: 'office', place: 'office' },
    { id: 'doctor', req: 'MED', w: w(.5, 0, .3, 0, .1, .1), diff: 7.5, cat: 'medical', place: 'hospital' },
    // Commuter jobs in the big city: better pay, but a long train ride each way.
    { id: 'cityretail', req: null, w: w(.1, 0, .3, .5, 0, .1), diff: 4.5, cat: 'sales', place: 'station', commute: true },
    { id: 'citycorp', req: 'BACH', w: w(.5, 0, .2, .3, 0, 0), diff: 6, cat: 'office', place: 'station', commute: true },
    { id: 'citytech', req: ['BACH_ENG', 'BACH_CS'], w: w(.7, 0, .3, 0, 0, 0), diff: 7, cat: 'technical', place: 'station', commute: true },
    // ---- Expansion 1 (rules revision 5; Idea/Expansion 1). common = how common on the template's 1-10 scale;
    // within each entry level (none, vocational, degree) the mix is rescaled so that level keeps its share of
    // all openings (World.jobMix). alt = where the job is done when the town lacks the first workplace.
    // pref = a specialisation that gives a small edge when applying.
    { id: 'waiter', req: null, w: w(0, 0, 0, .45, .35, .2), diff: 3, cat: 'sales', place: 'hawker', alt: ['mamak', 'mall'], common: 8, exp: 5, pref: ['VOC_HOSP'] },
    { id: 'barista', req: null, w: w(0, 0, .45, .2, .35, 0), diff: 3.5, cat: 'sales', place: 'mamak', alt: ['hawker', 'mall'], common: 6, exp: 5, pref: ['VOC_HOSP'] },
    { id: 'security', req: null, w: w(0, .2, .45, 0, 0, .35), diff: 4, cat: 'manual', place: 'mall', alt: ['office'], risk: 'physical', common: 5, exp: 5 },
    { id: 'warehouseop', req: null, w: w(0, .35, .2, 0, 0, .45), diff: 3.5, cat: 'manual', place: 'warehouse', alt: ['factory'], risk: 'physical', common: 7, exp: 5, pref: ['VOC_TRANSPORT'] },
    { id: 'careasst', req: 'VOC', w: w(0, 0, .35, .2, 0, .45), diff: 4.5, cat: 'medical', place: 'hospital', alt: ['welfare'], risk: 'physical', common: 6, exp: 5, pref: ['VOC_CARE'] },
    { id: 'plumber', req: 'VOC', w: w(0, .2, .45, 0, .35, 0), diff: 5, cat: 'technical', place: 'construction', alt: ['workshop'], risk: 'physical', common: 5, exp: 5, pref: ['VOC_TRADES'] },
    { id: 'carpenter', req: 'VOC', w: w(0, .35, .45, 0, .2, 0), diff: 5, cat: 'technical', place: 'construction', alt: ['workshop'], risk: 'physical', common: 5, exp: 5, pref: ['VOC_TRADES'] },
    { id: 'hairdresser', req: 'VOC', w: w(0, 0, .2, .45, .35, 0), diff: 4.5, cat: 'sales', place: 'mall', alt: ['hawker'], common: 4, exp: 5 },
    { id: 'busdriver', req: 'VOC', w: w(0, 0, .45, 0, .2, .35), diff: 5, cat: 'manual', place: 'depot', alt: ['station', 'warehouse'], risk: 'physical', common: 4, exp: 5, pref: ['VOC_TRANSPORT'] },
    { id: 'itsupport', req: 'VOC', w: w(.45, 0, .35, .2, 0, 0), diff: 5.5, cat: 'technical', place: 'techhub', alt: ['office'], common: 5, exp: 5, pref: ['VOC_IT'] },
    { id: 'labtech', req: 'VOC', w: w(.35, 0, .45, 0, .2, 0), diff: 5, cat: 'technical', place: 'researchcentre', alt: ['university', 'hospital'], common: 3, exp: 5, pref: ['VOC_LAB'] },
    { id: 'pharmacist', req: 'BACH_PHARM', w: w(.45, 0, .35, .2, 0, 0), diff: 6.5, cat: 'medical', place: 'hospital', alt: ['mall'], common: 2, exp: 5 },
    { id: 'paramedic', req: 'VOC', w: w(0, 0, .45, 0, .2, .35), diff: 6, cat: 'medical', place: 'hospital', alt: ['depot'], risk: 'physical', common: 2, exp: 5, pref: ['VOC_CARE'] },
    { id: 'firefighter', req: 'VOC', w: w(0, .45, .2, 0, 0, .35), diff: 6, cat: 'manual', place: 'police', alt: ['townhall', 'depot'], risk: 'heavy', common: 2, exp: 5 },
    { id: 'architect', req: 'BACH_ARCH', w: w(.45, 0, .35, .2, 0, 0), diff: 7, cat: 'technical', place: 'office', common: 2, exp: 5 },
    { id: 'lawyer', req: 'BACH_LAW', w: w(.45, 0, .2, .35, 0, 0), diff: 7.5, cat: 'office', place: 'office', alt: ['court'], common: 2, exp: 5 },
    { id: 'socialworker', req: ['BACH_SOC', 'BACH_GEN'], w: w(0, 0, .35, .45, 0, .2), diff: 6, cat: 'office', place: 'townhall', alt: ['welfare', 'office'], common: 3, exp: 5 },
    { id: 'scientist', req: ['BACH_SCI', 'BACH_ENG', 'MED'], w: w(.45, 0, .35, 0, 0, .2), diff: 7.5, cat: 'technical', place: 'researchcentre', alt: ['university'], common: 1, exp: 5, pref: ['MAST_RESEARCH'] },
    { id: 'analyst', req: ['BACH_CS', 'BACH_SCI', 'BACH_ENG', 'BACH_BUS'], w: w(.45, 0, .35, .2, 0, 0), diff: 6.5, cat: 'office', place: 'researchcentre', alt: ['techhub', 'office'], common: 3, exp: 5, pref: ['MAST_DATA'] },
    { id: 'journalist', req: 'BACH', w: w(.2, 0, .35, .45, 0, 0), diff: 6, cat: 'office', place: 'office', common: 3, exp: 5 },
    { id: 'equiptech', req: 'VOC', w: w(.35, 0, .45, 0, .2, 0), diff: 5.5, cat: 'technical', place: 'researchcentre', alt: ['university', 'factory'], risk: 'physical', common: 2, exp: 5, pref: ['VOC_LAB', 'VOC_TRADES'] },
    { id: 'envofficer', req: 'VOC', w: w(.2, 0, .45, 0, 0, .35), diff: 5.5, cat: 'technical', place: 'researchcentre', alt: ['university', 'townhall'], risk: 'physical', common: 2, exp: 5, pref: ['VOC_LAB'] },
    { id: 'researchcoord', req: ['BACH_BUS', 'BACH_SCI'], w: w(.35, 0, .2, .45, 0, 0), diff: 6, cat: 'office', place: 'researchcentre', alt: ['office'], common: 2, exp: 5, pref: ['MAST_MBA'] },
  ];
  C.JOB_BY_ID = {};
  for (const j of C.JOBS) C.JOB_BY_ID[j.id] = j;
  // Public-sector jobs: not in the random vacancy market; the government hires to its budget.
  C.GOV_JOBS = {
    police: { id: 'police', req: null, w: w(.1, .3, .3, .1, .1, .1), diff: 4.5, cat: 'office', place: 'police', risk: 'physical', gov: true, freq: 0 },
    // City council officials, appointed by the leader (js/sim/council.js).
    treasurer: { id: 'treasurer', req: 'BACH', w: w(.6, 0, .3, .1, 0, 0), diff: 6, cat: 'office', place: 'townhall', gov: true, freq: 0 },
    community: { id: 'community', req: 'BACH', w: w(.3, 0, .1, .5, 0, .1), diff: 5.5, cat: 'office', place: 'townhall', gov: true, freq: 0 },
  };
  for (const j of Object.values(C.GOV_JOBS)) C.JOB_BY_ID[j.id] = j;
  C.JOB_FREQ = []; // from the pack's job mix
  C.LEVEL_PREFIX = ['', '', 'Senior ', 'Lead ', 'Head ', 'Chief '];

  // ---- Gigs: short paid tasks (not employment). needTransport = minimum transport tier ----
  C.GIGS = [
    { id: 'labour', diff: 3.5, w: w(0, .5, 0, 0, .1, .4), cat: 'manual', place: 'construction', risk: 'heavy' },
    { id: 'delivery', diff: 3, w: w(0, 0, .3, 0, .4, .3), cat: 'manual', place: 'hawker', risk: 'physical', needTransport: 1 },
    { id: 'ehailing', diff: 3, w: w(0, 0, .5, .2, .3, 0), cat: 'sales', place: 'mall', needTransport: 2 },
    { id: 'pasar', diff: 2.5, w: w(0, .2, .1, .4, .1, .2), cat: 'sales', place: 'hawker' },
    { id: 'tuition', diff: 6, w: w(.6, 0, 0, .4, 0, 0), cat: 'office', place: 'library' },
    { id: 'repair', diff: 5.5, w: w(.3, .2, .3, 0, .2, 0), cat: 'technical', place: 'workshop', risk: 'physical' },
    { id: 'freelance', diff: 8, w: w(.8, 0, .2, 0, 0, 0), cat: 'technical', place: 'library' },
    { id: 'promoter', diff: 5, w: w(0, 0, .1, .7, .2, 0), cat: 'sales', place: 'mall' },
  ];

  // ---- Training: spend time + money to raise attributes ----
  C.TRAININGS = [
    { id: 'library', attrs: [C.INT, C.PER], diff: 4, w: w(.8, 0, .2, 0, 0, 0), place: 'library' },
    { id: 'gym', attrs: [C.STR, C.END], diff: 3, w: w(0, .5, 0, 0, 0, .5), place: 'gym', risk: 'physical' },
    { id: 'sports', attrs: [C.AGI, C.PER], diff: 4.5, w: w(0, .2, .3, 0, .5, 0), place: 'gym', risk: 'physical' },
    { id: 'speaking', attrs: [C.CHA], diff: 4, w: w(.2, 0, 0, .8, 0, 0), place: 'hall' },
    { id: 'running', attrs: [C.END, C.AGI], diff: 3, w: w(0, .2, 0, 0, .3, .5), place: 'park', risk: 'physical' },
  ];
  C.RISK_MULT = { physical: 1, heavy: 2.5 };

  // ---- Lifestyle tiers. Daily effects: health/energy(sleep)/stress; prestige helps dating & deals ----
  C.TIER_CATS = ['food', 'housing', 'transport', 'leisure'];
  C.TIER_CAT_NAMES = { food: 'Food', housing: 'Housing', transport: 'Transport', leisure: 'Leisure' };
  C.TIERS = {
    food: [
      { health: -0.02, energy: -3, stress: 0.3 },
      { fx: 'Baseline' },
      { health: 0.03, energy: 3, stress: -0.3 },
      { health: 0.03, energy: 3, stress: -1, prestige: 1 },
    ],
    housing: [
      { energy: -6, stress: 0.6, kind: 'kampung' },
      { kind: 'flat' },
      { energy: 3, stress: -0.4, prestige: 0.5, kind: 'terrace' },
      { energy: 5, stress: -0.8, prestige: 1, kind: 'condo' },
      { energy: 7, stress: -1.2, prestige: 2, kind: 'bungalow' },
    ],
    transport: [
      { energy: -3, stress: 0.2 },
      { accident: 0.0015 },
      { stress: -0.2 },
      { stress: -0.3, prestige: 1 },
    ],
    leisure: [
      { stress: 0.8 },
      { fx: 'Baseline' },
      { stress: -0.4, fitness: true },
      { stress: -0.8, prestige: 1, network: true },
    ],
  };
  // C.CHILD_COST and C.CHILD_COST_PER_HOUSING (per child per month, plus per housing tier) come from the pack.

  // Monthly income tax on wages (simplified progressive bands, RM) and corporate tax.
  C.TAX_BANDS = [];

  // ---- Businesses (monthly numbers in RM). Fat-tailed: most stay small or fail, a few boom. ----
  C.BIZ = [
    { id: 'stall', market: [20, 0], costRatio: 0.88, sigma: 0.12, boom: 0.0003, boomMin: 1.5, boomMax: 2.5, bust: 0.003, capEff: 0.12, skillSpread: 0.16, cyclical: 0.5, multiple: 1.5, w: w(.1, .1, .3, .3, .1, .1), place: 'hawker' },
    { id: 'workshop', market: [5, 0], costRatio: 0.88, sigma: 0.12, boom: 0.0004, boomMin: 1.5, boomMax: 3, bust: 0.003, capEff: 0.1, skillSpread: 0.18, cyclical: 0.8, multiple: 2.5, w: w(.3, .2, .3, .1, .1, 0), place: 'shoplot', req: 'VOC' },
    { id: 'retail', market: [10, 0], costRatio: 0.9, sigma: 0.15, boom: 0.0004, boomMin: 1.5, boomMax: 3, bust: 0.004, capEff: 0.1, skillSpread: 0.18, cyclical: 1, multiple: 3, w: w(.3, 0, .3, .4, 0, 0), place: 'shoplot' },
    { id: 'restaurant', market: [5, 0], costRatio: 0.9, sigma: 0.18, boom: 0.0006, boomMin: 2, boomMax: 4, bust: 0.004, capEff: 0.09, skillSpread: 0.2, cyclical: 1, multiple: 4, w: w(.2, 0, .4, .4, 0, 0), place: 'shoplot' },
    { id: 'trading', market: [3, 3], costRatio: 0.93, sigma: 0.22, boom: 0.0011, boomMin: 2, boomMax: 4, bust: 0.005, capEff: 0.08, skillSpread: 0.22, cyclical: 1.3, multiple: 5, w: w(.4, 0, .2, .4, 0, 0), place: 'office' },
    { id: 'tech', market: [2, 15], costRatio: 0.92, sigma: 0.35, boom: 0.0026, boomMin: 3, boomMax: 8, bust: 0.012, capEff: 0.12, skillSpread: 0.35, cyclical: 1.2, multiple: 8, w: w(.7, 0, .2, .1, 0, 0), place: 'techhub' },
    { id: 'property', market: [2, 1], costRatio: 0.88, sigma: 0.3, boom: 0.0011, boomMin: 2, boomMax: 3.5, bust: 0.005, capEff: 0.07, skillSpread: 0.22, cyclical: 2.5, multiple: 5, w: w(.3, 0, .2, .5, 0, 0), place: 'office' },
  ];
  // Private health and education (only with the government system, which pays for the
  // public ones). Owners pay their own staff (staff = posts at the starting size);
  // build = district code of the building put up on an empty lot; maxPer = at most one
  // per this many residents; fee = monthly school fee per pupil (Year-1 RM).
  C.BIZ_SERVICES = [
    { id: 'clinic', costRatio: 0.84, sigma: 0.08, boom: 0.0003, boomMin: 1.3, boomMax: 2, bust: 0.002, capEff: 0.1, skillSpread: 0.15, cyclical: 0.3, multiple: 4, w: w(.5, 0, .3, .2, 0, 0), place: 'shoplot', req: 'MED', staff: { nurse: 1 }, service: 'health', maxPer: 250 },
    { id: 'privschool', costRatio: 0.86, sigma: 0.06, boom: 0.0003, boomMin: 1.3, boomMax: 2, bust: 0.0015, capEff: 0.08, skillSpread: 0.15, cyclical: 0.4, multiple: 6, w: w(.4, 0, .1, .5, 0, 0), place: 'build', build: 'e', staff: { teacher: 6 }, service: 'education', maxPer: 700 },
    { id: 'privhosp', costRatio: 0.86, sigma: 0.08, boom: 0.0004, boomMin: 1.3, boomMax: 2.2, bust: 0.0015, capEff: 0.07, skillSpread: 0.15, cyclical: 0.3, multiple: 7, w: w(.4, 0, .2, .4, 0, 0), place: 'build', build: 'h', staff: { doctor: 3, nurse: 6 }, service: 'health', maxPer: 1200 },
  ];
  C.BIZ_BY_ID = {};
  for (const b of C.BIZ.concat(C.BIZ_SERVICES)) C.BIZ_BY_ID[b.id] = b;

  // ---- Economy regimes (yearly Markov chain) ----
  C.REGIMES = {
    growth: { name: 'Boom', color: '#3ec7b5', vacMult: 1.35, wageMult: 1.05, layoff: 0.001, promoMult: 1.3, bizDemand: 1.08, idxMu: 0.10, idxSig: 0.14, spdMu: 0.2, spdSig: 0.3, gigMult: 1.1 },
    normal: { name: 'Normal', color: '#9aa5b1', vacMult: 1, wageMult: 1, layoff: 0.0025, promoMult: 1, bizDemand: 1, idxMu: 0.035, idxSig: 0.15, spdMu: 0.05, spdSig: 0.35, gigMult: 1 },
    recession: { name: 'Recession', color: '#e76f51', vacMult: 0.5, wageMult: 0.93, layoff: 0.012, promoMult: 0.5, bizDemand: 0.85, idxMu: -0.15, idxSig: 0.28, spdMu: -0.3, spdSig: 0.45, gigMult: 0.85 },
  };
  C.REGIME_TRANSITIONS = {
    stable: { growth: { growth: .4, normal: .6, recession: 0 }, normal: { growth: .1, normal: .87, recession: .03 }, recession: { growth: .1, normal: .8, recession: .1 } },
    normal: { growth: { growth: .5, normal: .42, recession: .08 }, normal: { growth: .2, normal: .68, recession: .12 }, recession: { growth: .1, normal: .55, recession: .35 } },
    volatile: { growth: { growth: .45, normal: .25, recession: .3 }, normal: { growth: .3, normal: .4, recession: .3 }, recession: { growth: .25, normal: .35, recession: .4 } },
  };

  // ---- Names (Malaysian mix) & looks ----
  C.ETHNICITIES = [];
  C.ETHNIC_NAMES = {};
  // Population mixes. Classic = the original engine; Malaysia = DOSM Q4 2025 shares
  // (Malay 58.2%, Chinese 22.2%, other Bumiputera 12.3%, Indian 6.5%, others 0.8%).
  C.ETHNIC_MIXES = {};
  C.NAMES = {};
  C.SKIN = {};
  C.HAIR = ['#1b1b1b', '#2b1d14', '#3b2a1d', '#141414'];
  C.SHIRTS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#8d99ae', '#6a4c93', '#43aa8b', '#f28482', '#3d5a80', '#ffffff', '#ff7f51'];
  C.PANTS = ['#1d3557', '#3d405b', '#5c4033', '#2b2d42', '#6b705c'];
  C.SCARVES = ['#c9184a', '#7b2cbf', '#0096c7', '#2d6a4f', '#f77f00', '#e5989b'];

  // ---- Bursa Rezeki: fictional listed companies (price in RM, shares in millions) ----
  // drift = extra real yearly drift, beta = sensitivity to the market, idio = own yearly volatility.
  C.STOCKS = [];
  // New companies that can list (IPO) when a listed company goes bust.
  C.IPO_POOL = [];
  // Government-linked companies listed once the town's public finances have matured
  // (js/sim/fiscal.js). div = yearly dividend yield, paid quarterly; the treasury's
  // sovereign fund (Khazanah Rezeki) buys a stake at listing.
  C.GLC_STOCKS = [];
  C.MARKET_IMPACT_Y = 0.8;      // square-root impact prefactor (Toth et al. 2011: order one)
  C.TRADING_DAYS = 252;
  C.TOWN_REVERSION = 0.015;    // daily pull of town-driven mispricing back to fundamentals (~45-day half-life)
  // Long-run valuation mean reversion (cf. Poterba & Summers 1988): a stock's fundamental
  // value wanders with the economy but is pulled back toward a trend growing at
  // inflation + MARKET_TREND_REAL (+ the stock's own drift). Half-life ~6 years.
  C.MARKET_TREND_REAL = 0.025;  // cap-weighted index fund: ~3.5% real/yr median, ~2.5-4.5% across seeds
  C.MARKET_REVERSION = 0.12;   // per year
  C.MARKET_MU_NORMAL = 0.04;   // average regime drift, removed so regimes swing prices around the trend

  // ---- Migration: multipliers on base monthly rates ----
  C.MIGRATION_LEVELS = { off: 0, low: 1, normal: 3, high: 8 };
  C.MIG_BASE_OUT = 0.0006;   // per household per month at neutral pressure (~0.7%/yr)
  C.MIG_BASE_IN = 0.00045;   // arrivals per adult per month at neutral attractiveness
  C.MIG_BASE_RETURN = 0.002; // per emigrant per month when the town is attractive

  // ---- Ageing genes: body = STR/AGI/END, mind = INT/PER (rates are % of peak per year) ----
  C.AGEING = {
    bOnset: [40, 4, 32, 52], bRate: [0.012, 0.004, 0.004, 0.025], bFloor: [0.4, 0.75],
    mOnset: [60, 5, 48, 75], mRate: [0.008, 0.003, 0.002, 0.018], mFloor: [0.6, 0.9],
  };
  C.BODY_ATTRS = [1, 4, 5];

  // ---- Leisure venues (Socialise picks one). tier: 0 low, 1 mid, 2 high, 3 highest.
  // cost in Year-1 RM per visit; joy = happiness gained; relief = stress removed.
  // member = minimum leisure tier needed (golf is members only). network = deals & referrals.
  C.VENUES = {
    park: { tier: 0, joy: 5, relief: 10, energy: 4, slot: 0, tags: ['outdoor'] },
    futsal: { tier: 0, joy: 6, relief: 10, energy: 12, slot: 0, tags: ['sport'] },
    mamak: { tier: 0, joy: 6, relief: 12, energy: 6, tags: ['social'] },
    mall: { tier: 1, joy: 7, relief: 10, energy: 6, tags: ['shopping'] },
    cinema: { tier: 1, joy: 8, relief: 12, energy: 4 },
    bowling: { tier: 1, joy: 8, relief: 12, energy: 8, tags: ['sport', 'social'] },
    karaoke: { tier: 1, joy: 9, relief: 14, energy: 8, slot: 1, tags: ['social'] },
    finedine: { tier: 2, joy: 11, relief: 14, energy: 4, slot: 1, tags: ['status'] },
    spa: { tier: 2, joy: 10, relief: 25, energy: -6 },
    lounge: { tier: 2, joy: 11, relief: 14, energy: 8, slot: 1, tags: ['social', 'status'], network: true },
    golf: { tier: 3, joy: 13, relief: 16, energy: 10, slot: 0, member: 3, tags: ['status', 'sport'], network: true },
  };
  C.MIND_ATTRS = [0, 2];

  // ---- National values (titles, pay, prices, people, listed companies) from the active country pack ----
  // Objects are updated in place: saves refer to these tables by path.
  const into = (obj, src) => { for (const k of Object.keys(obj)) delete obj[k]; Object.assign(obj, src); };
  const list = (arr, src) => { arr.length = 0; for (const x of src) arr.push(x); };
  const fill = (items, vals, what) => {
    for (const o of items) { const v = vals[o.id]; if (!v) throw new Error(`no ${what} values for '${o.id}'`); Object.assign(o, v); }
  };
  LES.Countries.require('content.jobs', 'content.govJobs', 'content.quals', 'content.courses', 'content.gigs', 'content.trainings',
    'content.tiers', 'content.biz', 'content.depositRates', 'content.venues', 'content.childCost', 'content.childCostPerHousing',
    'content.simpleTaxBands', 'content.corpTax', 'content.ethnicities', 'content.ethnicNames', 'content.ethnicMixes', 'content.names',
    'content.skin', 'content.townName', 'content.stocks', 'content.ipoPool', 'content.glcStocks');
  LES.Countries.on('content', K => {
    const N = K.content;
    fill(C.JOBS, N.jobs, 'job'); fill(Object.values(C.GOV_JOBS), N.govJobs, 'public job');
    for (const j of C.JOBS) if (j.exp) j.freq = j.common; // Expansion 1: one mix for every country (rescaled per level)
    list(C.JOB_FREQ, C.JOBS.map(j => (j.exp ? 0 : j.freq))); // older rules revisions never post the new jobs
    into(C.QUALS, N.quals);
    fill(C.COURSES, N.courses, 'course'); fill(C.GIGS, N.gigs, 'gig'); fill(C.TRAININGS, N.trainings, 'training');
    for (const cat of C.TIER_CATS) C.TIERS[cat].forEach((t, i) => Object.assign(t, N.tiers[cat][i]));
    fill(C.BIZ.concat(C.BIZ_SERVICES), N.biz, 'business');
    for (const k of Object.keys(C.REGIMES)) C.REGIMES[k].depositRate = N.depositRates[k];
    for (const k of Object.keys(C.VENUES)) Object.assign(C.VENUES[k], N.venues[k]);
    C.CHILD_COST = N.childCost; C.CHILD_COST_PER_HOUSING = N.childCostPerHousing;
    list(C.TAX_BANDS, N.simpleTaxBands); C.CORP_TAX = N.corpTax;
    list(C.ETHNICITIES, N.ethnicities); into(C.ETHNIC_NAMES, N.ethnicNames); into(C.ETHNIC_MIXES, N.ethnicMixes);
    C.START_WEALTH = N.startWealth || null; // the country's starting-wealth gap by group (none for Malaysia)
    C.ETHNIC_WEIGHTS = C.ETHNIC_MIXES.classic.w;
    into(C.NAMES, N.names); into(C.SKIN, N.skin); C.TOWN_NAME = N.townName;
    list(C.STOCKS, N.stocks); list(C.IPO_POOL, N.ipoPool); list(C.GLC_STOCKS, N.glcStocks);
  });
})(globalThis.LES = globalThis.LES || {});
