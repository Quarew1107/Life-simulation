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
  C.QUALS = {
    VOC: 'Vocational Cert.', BACH_GEN: 'Bachelor of Arts', BACH_BUS: 'Bachelor of Business',
    BACH_ENG: 'Bachelor of Engineering', MED: 'Medical Degree', MASTER: "Master's Degree",
  };
  C.BACHELORS = ['BACH_GEN', 'BACH_BUS', 'BACH_ENG', 'MED'];
  C.COURSES = [
    { id: 'VOC', name: 'Vocational Certificate', months: 18, fee: 6000, minInt: 2, place: 'kolej', diff: 3.5, w: w(.4, .1, .3, 0, .1, .1) },
    { id: 'BACH_GEN', name: 'Bachelor of Arts', months: 36, fee: 24000, minInt: 4, place: 'university', diff: 4.5, w: w(.7, 0, .2, .1, 0, 0) },
    { id: 'BACH_BUS', name: 'Bachelor of Business', months: 36, fee: 30000, minInt: 4.5, place: 'university', diff: 5, w: w(.6, 0, .2, .2, 0, 0) },
    { id: 'BACH_ENG', name: 'Bachelor of Engineering', months: 48, fee: 45000, minInt: 5.5, place: 'university', diff: 6, w: w(.8, 0, .2, 0, 0, 0) },
    { id: 'MED', name: 'Medicine (MBBS)', months: 60, fee: 120000, minInt: 7, place: 'university', diff: 7, w: w(.7, 0, .2, 0, 0, .1) },
    { id: 'MASTER', name: "Master's Degree", months: 18, fee: 30000, minInt: 5, place: 'university', diff: 6.5, w: w(.8, 0, .2, 0, 0, 0), prereq: 'BACH' },
  ];
  C.COURSE_BY_ID = {};
  for (const c of C.COURSES) C.COURSE_BY_ID[c.id] = c;

  // ---- Jobs: req = minimum credential (the only eligibility gate) ----
  C.JOBS = [
    { id: 'cleaner', title: 'Cleaner', salary: 1700, req: null, w: w(0, .3, .2, 0, .2, .3), diff: 2.5, cat: 'manual', place: 'mall', freq: 10 },
    { id: 'retail', title: 'Retail Assistant', salary: 1900, req: null, w: w(.1, 0, .3, .5, 0, .1), diff: 3, cat: 'sales', place: 'mall', freq: 10 },
    { id: 'rider', title: 'Despatch Rider', salary: 2200, req: null, w: w(0, .1, .3, 0, .3, .3), diff: 3.5, cat: 'manual', place: 'warehouse', risk: 'physical', freq: 8 },
    { id: 'factory', title: 'Factory Operator', salary: 2200, req: null, w: w(.1, .3, .3, 0, .1, .2), diff: 3.5, cat: 'manual', place: 'factory', risk: 'physical', freq: 10 },
    { id: 'construction', title: 'Construction Worker', salary: 2500, req: null, w: w(0, .5, .1, 0, .1, .3), diff: 4.5, cat: 'manual', place: 'construction', risk: 'heavy', freq: 7 },
    { id: 'sales', title: 'Sales Executive', salary: 3000, req: null, w: w(.1, 0, .2, .6, 0, .1), diff: 5, cat: 'sales', place: 'office', freq: 6 },
    { id: 'chef', title: 'Chef', salary: 2800, req: 'VOC', w: w(.1, .1, .4, 0, .3, .1), diff: 4.5, cat: 'technical', place: 'hawker', freq: 5 },
    { id: 'mechanic', title: 'Mechanic', salary: 3200, req: 'VOC', w: w(.3, .3, .3, 0, .1, 0), diff: 5, cat: 'technical', place: 'workshop', risk: 'physical', freq: 5 },
    { id: 'electrician', title: 'Electrician', salary: 3600, req: 'VOC', w: w(.3, .1, .3, 0, .3, 0), diff: 5.5, cat: 'technical', place: 'construction', risk: 'heavy', freq: 4 },
    { id: 'nurse', title: 'Nurse', salary: 3400, req: 'VOC', w: w(.2, 0, .3, .3, 0, .2), diff: 5, cat: 'medical', place: 'hospital', freq: 4 },
    { id: 'teacher', title: 'Teacher', salary: 3800, req: 'BACH', w: w(.4, 0, .1, .4, 0, .1), diff: 5, cat: 'office', place: 'school', freq: 4 },
    { id: 'accountant', title: 'Accountant', salary: 5000, req: 'BACH_BUS', w: w(.6, 0, .4, 0, 0, 0), diff: 6, cat: 'office', place: 'office', freq: 3 },
    { id: 'banker', title: 'Bank Officer', salary: 6500, req: 'BACH_BUS', w: w(.5, 0, .2, .3, 0, 0), diff: 6.5, cat: 'office', place: 'bank', freq: 2 },
    { id: 'engineer', title: 'Engineer', salary: 6000, req: 'BACH_ENG', w: w(.6, 0, .4, 0, 0, 0), diff: 6.5, cat: 'technical', place: 'factory', freq: 3 },
    { id: 'softdev', title: 'Software Developer', salary: 6800, req: 'BACH_ENG', w: w(.7, 0, .3, 0, 0, 0), diff: 7, cat: 'technical', place: 'techhub', freq: 3 },
    { id: 'manager', title: 'Manager', salary: 9000, req: 'BACH_BUS', w: w(.4, 0, .1, .5, 0, 0), diff: 7, cat: 'office', place: 'office', freq: 1.5 },
    { id: 'doctor', title: 'Doctor', salary: 11000, req: 'MED', w: w(.5, 0, .3, 0, .1, .1), diff: 7.5, cat: 'medical', place: 'hospital', freq: 1.5 },
  ];
  C.JOB_BY_ID = {};
  for (const j of C.JOBS) C.JOB_BY_ID[j.id] = j;
  C.JOB_FREQ = C.JOBS.map(j => j.freq);
  C.LEVEL_PREFIX = ['', '', 'Senior ', 'Lead ', 'Head ', 'Chief '];

  // ---- Gigs: short paid tasks (not employment). needTransport = minimum transport tier ----
  C.GIGS = [
    { id: 'labour', name: 'Odd labour job', pay: 90, diff: 3.5, w: w(0, .5, 0, 0, .1, .4), cat: 'manual', place: 'construction', risk: 'heavy' },
    { id: 'delivery', name: 'Food delivery', pay: 85, diff: 3, w: w(0, 0, .3, 0, .4, .3), cat: 'manual', place: 'hawker', risk: 'physical', needTransport: 1 },
    { id: 'ehailing', name: 'E-hailing driver', pay: 140, diff: 3, w: w(0, 0, .5, .2, .3, 0), cat: 'sales', place: 'mall', needTransport: 2 },
    { id: 'pasar', name: 'Pasar malam helper', pay: 70, diff: 2.5, w: w(0, .2, .1, .4, .1, .2), cat: 'sales', place: 'hawker' },
    { id: 'tuition', name: 'Private tuition', pay: 120, diff: 6, w: w(.6, 0, 0, .4, 0, 0), cat: 'office', place: 'library' },
    { id: 'repair', name: 'Repair job', pay: 130, diff: 5.5, w: w(.3, .2, .3, 0, .2, 0), cat: 'technical', place: 'workshop', risk: 'physical' },
    { id: 'freelance', name: 'Freelance coding', pay: 280, diff: 8, w: w(.8, 0, .2, 0, 0, 0), cat: 'technical', place: 'library' },
    { id: 'promoter', name: 'Event promoter', pay: 110, diff: 5, w: w(0, 0, .1, .7, .2, 0), cat: 'sales', place: 'mall' },
  ];

  // ---- Training: spend time + money to raise attributes ----
  C.TRAININGS = [
    { id: 'library', name: 'Self-study at library', cost: 5, attrs: [C.INT, C.PER], diff: 4, w: w(.8, 0, .2, 0, 0, 0), place: 'library' },
    { id: 'gym', name: 'Gym workout', cost: 15, attrs: [C.STR, C.END], diff: 3, w: w(0, .5, 0, 0, 0, .5), place: 'gym', risk: 'physical' },
    { id: 'sports', name: 'Sports & silat', cost: 20, attrs: [C.AGI, C.PER], diff: 4.5, w: w(0, .2, .3, 0, .5, 0), place: 'gym', risk: 'physical' },
    { id: 'speaking', name: 'Public speaking club', cost: 20, attrs: [C.CHA], diff: 4, w: w(.2, 0, 0, .8, 0, 0), place: 'hall' },
    { id: 'running', name: 'Running at the park', cost: 0, attrs: [C.END, C.AGI], diff: 3, w: w(0, .2, 0, 0, .3, .5), place: 'park', risk: 'physical' },
  ];
  C.RISK_MULT = { physical: 1, heavy: 2.5 };

  // ---- Lifestyle tiers. Daily effects: health/energy(sleep)/stress; prestige helps dating & deals ----
  C.TIER_CATS = ['food', 'housing', 'transport', 'leisure'];
  C.TIER_CAT_NAMES = { food: 'Food', housing: 'Housing', transport: 'Transport', leisure: 'Leisure' };
  C.TIERS = {
    food: [
      { name: 'Cook at home', cost: 450, health: -0.02, energy: -3, stress: 0.3, fx: 'Cheap; slowly hurts health & energy' },
      { name: 'Hawker meals', cost: 800, fx: 'Baseline' },
      { name: 'Healthy diet', cost: 1300, health: 0.03, energy: 3, stress: -0.3, fx: '+health, +energy' },
      { name: 'Fine dining', cost: 3200, health: 0.03, energy: 3, stress: -1, prestige: 1, fx: '+health, -stress, +prestige' },
    ],
    housing: [
      { name: 'Rented kampung room', cost: 500, energy: -6, stress: 0.6, kind: 'kampung', fx: 'Poor sleep, more stress' },
      { name: 'Low-cost flat', cost: 1100, kind: 'flat', fx: 'Baseline' },
      { name: 'Terrace house', cost: 2400, energy: 3, stress: -0.4, prestige: 0.5, kind: 'terrace', fx: 'Better sleep' },
      { name: 'Condominium', cost: 4800, energy: 5, stress: -0.8, prestige: 1, kind: 'condo', fx: 'Great sleep, +prestige' },
      { name: 'Bungalow', cost: 12000, energy: 7, stress: -1.2, prestige: 2, kind: 'bungalow', fx: 'Best sleep, ++prestige' },
    ],
    transport: [
      { name: 'Bus & walking', cost: 120, energy: -3, stress: 0.2, fx: 'Tiring; no vehicle gigs' },
      { name: 'Motorbike', cost: 450, accident: 0.0015, fx: 'Unlocks delivery gigs; small accident risk' },
      { name: 'Car', cost: 1600, stress: -0.2, fx: 'Unlocks e-hailing' },
      { name: 'Luxury car', cost: 5500, stress: -0.3, prestige: 1, fx: '+prestige' },
    ],
    leisure: [
      { name: 'None', cost: 0, stress: 0.8, fx: 'Stress builds up' },
      { name: 'Streaming & outings', cost: 250, fx: 'Baseline' },
      { name: 'Gym membership', cost: 400, stress: -0.4, fitness: true, fx: 'Keeps body fit, -stress' },
      { name: 'Country club', cost: 3000, stress: -0.8, prestige: 1, network: true, fx: 'Networking: more business luck' },
    ],
  };
  C.CHILD_COST = 600;          // RM / month per child, plus per housing tier:
  C.CHILD_COST_PER_HOUSING = 200;

  // Monthly income tax on wages (simplified progressive bands, RM) and corporate tax.
  C.TAX_BANDS = [[3000, 0], [8000, 0.1], [20000, 0.2], [Infinity, 0.26]];
  C.CORP_TAX = 0.24;

  // ---- Businesses (monthly numbers in RM). Fat-tailed: most stay small or fail, a few boom. ----
  C.BIZ = [
    { id: 'stall', name: 'Hawker Stall', capital: 15000, scale0: 9000, cap: 50000, costRatio: 0.88, fixed: 600, sigma: 0.12, boom: 0.0003, boomMin: 1.5, boomMax: 2.5, bust: 0.003, capEff: 0.12, skillSpread: 0.16, cyclical: 0.5, multiple: 1.5, w: w(.1, .1, .3, .3, .1, .1), place: 'hawker', names: ['Nasi Lemak', 'Kopitiam', 'Roti Canai Corner', 'Satay House', 'Laksa Stall', 'Char Kuey Teow'] },
    { id: 'workshop', name: 'Repair Workshop', capital: 40000, scale0: 18000, cap: 250000, costRatio: 0.88, fixed: 1500, sigma: 0.12, boom: 0.0004, boomMin: 1.5, boomMax: 3, bust: 0.003, capEff: 0.1, skillSpread: 0.18, cyclical: 0.8, multiple: 2.5, w: w(.3, .2, .3, .1, .1, 0), place: 'shoplot', req: 'VOC', names: ['Motor Works', 'Auto Service', 'Repair Centre', 'Engineering Works'] },
    { id: 'retail', name: 'Retail Shop', capital: 60000, scale0: 30000, cap: 600000, costRatio: 0.9, fixed: 2500, sigma: 0.15, boom: 0.0004, boomMin: 1.5, boomMax: 3, bust: 0.004, capEff: 0.1, skillSpread: 0.18, cyclical: 1, multiple: 3, w: w(.3, 0, .3, .4, 0, 0), place: 'shoplot', names: ['Mart', 'Fashion', 'Electronics', 'Kedai Runcit', 'Bookstore', 'Pharmacy'] },
    { id: 'restaurant', name: 'Restaurant', capital: 150000, scale0: 70000, cap: 3000000, costRatio: 0.9, fixed: 6000, sigma: 0.18, boom: 0.0006, boomMin: 2, boomMax: 4, bust: 0.004, capEff: 0.09, skillSpread: 0.2, cyclical: 1, multiple: 4, w: w(.2, 0, .4, .4, 0, 0), place: 'shoplot', names: ['Restaurant', 'Seafood', 'Curry House', 'Bistro', 'Dim Sum'] },
    { id: 'trading', name: 'Trading Company', capital: 250000, scale0: 150000, cap: 15000000, costRatio: 0.93, fixed: 10000, sigma: 0.22, boom: 0.0008, boomMin: 2, boomMax: 4, bust: 0.005, capEff: 0.08, skillSpread: 0.22, cyclical: 1.3, multiple: 5, w: w(.4, 0, .2, .4, 0, 0), place: 'office', names: ['Trading Sdn Bhd', 'Import Export', 'Holdings', 'Logistics'] },
    { id: 'tech', name: 'Tech Startup', capital: 120000, scale0: 15000, cap: 30000000, costRatio: 0.92, fixed: 6000, sigma: 0.35, boom: 0.002, boomMin: 3, boomMax: 8, bust: 0.012, capEff: 0.12, skillSpread: 0.35, cyclical: 1.2, multiple: 8, w: w(.7, 0, .2, .1, 0, 0), place: 'techhub', names: ['Tech', 'Labs', 'Digital', 'AI', 'Apps', 'Robotics'] },
    { id: 'property', name: 'Property Developer', capital: 1000000, scale0: 300000, cap: 20000000, costRatio: 0.88, fixed: 30000, sigma: 0.3, boom: 0.0008, boomMin: 2, boomMax: 3.5, bust: 0.005, capEff: 0.07, skillSpread: 0.22, cyclical: 2.5, multiple: 5, w: w(.3, 0, .2, .5, 0, 0), place: 'office', names: ['Properties', 'Development', 'Land Sdn Bhd', 'Realty'] },
  ];
  C.BIZ_BY_ID = {};
  for (const b of C.BIZ) C.BIZ_BY_ID[b.id] = b;

  // ---- Economy regimes (yearly Markov chain) ----
  C.REGIMES = {
    growth: { name: 'Boom', color: '#3ec7b5', vacMult: 1.35, wageMult: 1.05, layoff: 0.001, promoMult: 1.3, bizDemand: 1.08, idxMu: 0.12, idxSig: 0.14, spdMu: 0.2, spdSig: 0.3, depositRate: 0.03, gigMult: 1.1 },
    normal: { name: 'Normal', color: '#9aa5b1', vacMult: 1, wageMult: 1, layoff: 0.0025, promoMult: 1, bizDemand: 1, idxMu: 0.05, idxSig: 0.15, spdMu: 0.05, spdSig: 0.35, depositRate: 0.025, gigMult: 1 },
    recession: { name: 'Recession', color: '#e76f51', vacMult: 0.5, wageMult: 0.93, layoff: 0.012, promoMult: 0.5, bizDemand: 0.85, idxMu: -0.15, idxSig: 0.28, spdMu: -0.3, spdSig: 0.45, depositRate: 0.015, gigMult: 0.85 },
  };
  C.REGIME_TRANSITIONS = {
    stable: { growth: { growth: .4, normal: .6, recession: 0 }, normal: { growth: .1, normal: .87, recession: .03 }, recession: { growth: .1, normal: .8, recession: .1 } },
    normal: { growth: { growth: .5, normal: .42, recession: .08 }, normal: { growth: .2, normal: .68, recession: .12 }, recession: { growth: .1, normal: .55, recession: .35 } },
    volatile: { growth: { growth: .45, normal: .25, recession: .3 }, normal: { growth: .3, normal: .4, recession: .3 }, recession: { growth: .25, normal: .35, recession: .4 } },
  };

  // ---- Names (Malaysian mix) & looks ----
  C.ETHNICITIES = ['malay', 'chinese', 'indian'];
  C.ETHNIC_WEIGHTS = [0.6, 0.27, 0.13];
  C.NAMES = {
    malay: {
      M: ['Ahmad', 'Hafiz', 'Amir', 'Faiz', 'Hakim', 'Irfan', 'Zul', 'Azlan', 'Danial', 'Syafiq', 'Rizal', 'Imran', 'Khairul', 'Aiman', 'Haziq', 'Firdaus', 'Naim', 'Adam'],
      F: ['Siti', 'Nurul', 'Aisyah', 'Farah', 'Nadia', 'Aina', 'Sofea', 'Hani', 'Liyana', 'Zara', 'Amira', 'Balqis', 'Intan', 'Syahira', 'Yasmin', 'Alya', 'Damia', 'Hana'],
      last: ['Rahman', 'Ismail', 'Hassan', 'Abdullah', 'Yusof', 'Omar', 'Aziz', 'Hamid', 'Salleh', 'Kassim', 'Ibrahim', 'Razak', 'Rashid', 'Latif'],
    },
    chinese: {
      M: ['Wei Jie', 'Jun Hao', 'Kok Leong', 'Zhi Hao', 'Chee Keong', 'Ming', 'Jia Wei', 'Yong', 'Kai Xiang', 'Boon', 'Seng', 'Hao Ran'],
      F: ['Mei Ling', 'Xin Yi', 'Hui Min', 'Pei Shan', 'Jia Yi', 'Siew Lan', 'Wen Xin', 'Li Ting', 'Yee Mun', 'Ka Yan', 'Shu Fen'],
      last: ['Tan', 'Lim', 'Lee', 'Wong', 'Ng', 'Chong', 'Teoh', 'Ong', 'Goh', 'Chan', 'Yap', 'Low'],
    },
    indian: {
      M: ['Arjun', 'Ravi', 'Suresh', 'Vikram', 'Ganesh', 'Rajesh', 'Pravin', 'Dinesh', 'Sanjay', 'Naveen', 'Hari', 'Kiran'],
      F: ['Priya', 'Kavitha', 'Divya', 'Anjali', 'Lakshmi', 'Meena', 'Shalini', 'Revathi', 'Nisha', 'Deepa', 'Thanya'],
      last: ['Kumar', 'Raj', 'Pillai', 'Nair', 'Muthu', 'Krishnan', 'Rao', 'Singh', 'Subramaniam', 'Maniam'],
    },
  };
  C.SKIN = {
    malay: ['#c68642', '#b5763a', '#d29a5e'],
    chinese: ['#f1c27d', '#e8b98a', '#f3cfa0'],
    indian: ['#8d5524', '#7a4a22', '#9c6232'],
  };
  C.HAIR = ['#1b1b1b', '#2b1d14', '#3b2a1d', '#141414'];
  C.SHIRTS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#8d99ae', '#6a4c93', '#43aa8b', '#f28482', '#3d5a80', '#ffffff', '#ff7f51'];
  C.PANTS = ['#1d3557', '#3d405b', '#5c4033', '#2b2d42', '#6b705c'];
  C.SCARVES = ['#c9184a', '#7b2cbf', '#0096c7', '#2d6a4f', '#f77f00', '#e5989b'];
  C.TOWN_NAME = 'Bandar Rezeki';
  C.SPEC_IDIO_SIGMA = 0.35; // personal (stock-picking) volatility of speculative holdings
})(globalThis.LES = globalThis.LES || {});
