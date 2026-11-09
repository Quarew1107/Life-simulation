// Personal life goals and happiness. Everyone wants something different: money, a
// dream home, a big family, a happy balanced life, fitness, a career, knowledge,
// helping others or a dynasty. A goal adds preferences to everyday decisions (it never
// changes success odds), has a measurable target, and when reached it is celebrated
// and replaced. Happiness (0-100) follows how life is going: needs, stress, family,
// leisure, goal progress and standing compared with the rest of town.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const G = LES.Goals = {};
  const n = v => (v - 50) / 50; // personality -1..1
  const bodyAvg = p => (p.att[C.STR] + p.att[C.END] + p.att[C.AGI]) / 3;
  const liveKids = (w, p) => { let k = 0; for (const id of p.children) if (w.people[id].alive) k++; return k; };
  const PRESTIGE_JOBS = ['doctor', 'engineer', 'softdev', 'manager', 'banker', 'citytech'];
  // Expansion 1 helpers.
  const debtOf = p => p.debt.study + (p.debt.medical || 0);
  const grownChild = (w, p) => p.children.some(id => { const c = w.people[id]; return c && c.alive && P.age(w, c) >= 18; });
  const staffOf = (w, p) => { let k = 0; for (const q of w.living) if (q.alive && q.job && q.job.biz >= 0) { const b = w.biz[q.job.biz]; if (b && b.open && b.founderId === p.id) k++; } return k; };
  const ownsStaffedType = (w, p) => w.biz.some(b => b.open && b.founderId === p.id && b.typeDef && (b.typeDef.staff || b.typeDef.build));

  // weight: how likely this person picks it; bias: utility added to actions (TRAIN_BODY /
  // TRAIN_MIND split training); spend: change to the share of income spent on lifestyle.
  G.DEFS = {
    RICH: {
      name: 'Get rich', icon: '💰',
      weight: (w, p) => 0.8 + n(p.pers.risk) + (p.strategy === 'ENT' || p.strategy === 'INV' ? 0.6 : 0),
      init: (w, p, R) => {
        const amb = n(p.pers.risk) + n(p.pers.dis) + R.normal(0, 0.6);
        return { target: amb > 1.1 ? 1e8 : amb > 0.2 ? 1e7 : 1e6 };
      },
      text: g => `Reach ${U.fmtMoney(U.RM(g.target))} net worth`,
      progress: (w, p, g) => U.clamp(Math.log10(Math.max(1, P.realWorth(w, p) / 100) / 1e4) / Math.log10(g.target / 1e4), 0, 1),
      bias: { INVEST: 0.5, START_BIZ: 0.4, WORK: 0.2, REST: -0.2 }, spend: -0.1,
    },
    DREAM_HOME: {
      name: 'Dream home', icon: '🏡',
      weight: (w, p) => 0.6 + 0.6 * n(p.pers.pat),
      init: (w, p, R) => ({ target: R.next() < 0.45 ? 4 : 3, months: 0 }),
      text: g => `Live in a ${C.TIERS.housing[g.target].name.toLowerCase()} for a year`,
      progress: (w, p, g) => U.clamp(0.7 * Math.min(1, p.tiers.housing / g.target) + 0.3 * g.months / 12, 0, 1),
      done: (w, p, g) => g.months >= 12,
      monthly: (w, p, g) => { g.months = p.tiers.housing >= g.target ? g.months + 1 : 0; },
      bias: { INVEST: 0.2, WORK: 0.2 }, spend: -0.15,
    },
    EARLY_RETIRE: {
      name: 'Retire early', icon: '🏖️',
      weight: (w, p) => 0.3 + 0.6 * n(p.pers.pat) + 0.4 * n(p.pers.dis),
      init: () => ({}),
      text: () => 'Save 25 years of living costs and retire before 55',
      progress: (w, p) => U.clamp(p.nw / Math.max(1, 25 * 12 * p.mcost), 0, 1),
      done: (w, p) => P.age(w, p) < 55 && p.nw >= 25 * 12 * p.mcost,
      onDone: (w, p) => { p.retired = true; if (p.job) LES.Labour.endJob(w, p, 'retired early'); },
      bias: { INVEST: 0.8, WORK: 0.2, SOCIAL: -0.2 }, spend: -0.2,
    },
    OWN_BIZ: {
      name: 'Own a business', icon: '🏪',
      weight: (w, p) => 0.3 + 0.8 * n(p.pers.risk) + 0.1 * (p.att[C.CHA] - 5) + (p.strategy === 'ENT' ? 0.8 : 0),
      init: (w, p, R) => {
        const types = C.BIZ.filter(t => t.capital <= 250000);
        const t = types[Math.max(0, R.weighted(types.map(x => Math.max(0.1, LES.Actions.attrScore(p, x.w) - 3))))];
        return { bizType: t.id };
      },
      text: g => `Run my own ${C.BIZ_BY_ID[g.bizType].name.toLowerCase()} for 5 years`,
      progress: (w, p) => {
        let best = 0;
        for (const k of Object.keys(p.shares)) { const b = w.biz[Number(k)]; if (b.open && b.founderId === p.id) best = Math.max(best, (w.day - b.foundedDay) / 365 / 5); }
        return U.clamp(best, 0, 1);
      },
      bias: { START_BIZ: 1.5, MANAGE_BIZ: 0.4 }, spend: -0.1,
    },
    BIG_FAMILY: {
      name: 'Big family', icon: '👨‍👩‍👧‍👦',
      weight: (w, p) => 0.3 + 1.6 * Math.max(0, n(p.famDesire)) + 0.3 * n(p.pers.resp),
      init: () => ({ target: 4 }),
      text: g => `Raise ${g.target} children`,
      progress: (w, p, g) => U.clamp(liveKids(w, p) / g.target, 0, 1),
      bias: { SOCIAL: 0.5, CHILDCARE: 0.6, REST: 0.1 }, spend: 0,
      family: 0.9,
    },
    HAPPY: {
      name: 'A happy, balanced life', icon: '😊',
      weight: (w, p) => 0.9 - 0.3 * n(p.pers.dis) - 0.3 * n(p.pers.risk) + (p.strategy === 'BAL' ? 0.6 : 0),
      init: () => ({ months: 0 }),
      text: () => 'Stay happy (75+) for two years',
      progress: (w, p, g) => U.clamp(0.6 * p.happyAvg / 75 + 0.4 * g.months / 24, 0, 1),
      done: (w, p, g) => g.months >= 24,
      monthly: (w, p, g) => { g.months = p.happy >= 75 ? g.months + 1 : Math.max(0, g.months - 2); },
      bias: { SOCIAL: 0.6, REST: 0.3, WORK: -0.2, CHILDCARE: 0.2 }, spend: 0.15,
    },
    STRONGEST: {
      name: 'Be the fittest', icon: '💪',
      weight: (w, p) => 0.15 + 0.3 * Math.max(0, bodyAvg(p) - 4.5),
      init: () => ({ target: 7.5 }),
      text: g => `Build strength, endurance and agility to ${g.target}`,
      progress: (w, p, g) => U.clamp(bodyAvg(p) / g.target, 0, 1),
      bias: { TRAIN_BODY: 1.3, REST: 0.1 }, spend: 0.05,
    },
    CAREER: {
      name: 'Top of my profession', icon: '🏆',
      weight: (w, p) => 0.5 + 0.7 * n(p.pers.dis) + 0.12 * (p.att[C.INT] - 5) + (p.strategy === 'WORK' || p.strategy === 'SPEC' ? 0.4 : 0),
      init: () => ({}),
      text: () => 'Become a Head/Chief, or land a prestige job (doctor, engineer, banker...)',
      progress: (w, p) => U.clamp(p.job ? Math.max((p.job.level - 1) / 3, PRESTIGE_JOBS.includes(p.job.jobId) ? 1 : 0) : 0, 0, 1),
      bias: { WORK: 0.4, APPLY: 0.6, ENROLL: 0.6, TRAIN_MIND: 0.3, STUDY: 0.2 }, spend: -0.05,
    },
    SCHOLAR: {
      name: 'Highest education', icon: '🎓',
      weight: (w, p) => (P.age(w, p) < 35 ? 0.2 + 0.25 * Math.max(0, p.att[C.INT] - 5) + (p.strategy === 'EDU' ? 0.7 : 0) : 0.02),
      init: () => ({}),
      text: () => "Earn a Master's or a medical degree",
      progress: (w, p) => (p.quals.includes('MASTER') || p.quals.includes('MED') ? 1 : p.quals.some(P.isBachelor) ? 0.6 : p.enrol ? 0.3 : 0),
      bias: { ENROLL: 1.6, STUDY: 0.7, TRAIN_MIND: 0.3 }, spend: -0.05,
    },
    HELPER: {
      name: 'Help others', icon: '🤝',
      weight: (w, p) => 0.15 + 0.6 * Math.max(0, n(p.pers.resp)),
      init: () => ({ target: 20000 }),
      text: g => `Give ${U.fmtMoney(U.RM(g.target))} (Year-1 money) to charity or raise a child in need`,
      progress: (w, p, g) => U.clamp(p.donated / w.price / U.RM(g.target), 0, 1),
      bias: { SOCIAL: 0.2, CHILDCARE: 0.3 }, spend: 0,
      care: 0.8,
    },
    DYNASTY: {
      name: 'Build a dynasty', icon: '👑',
      weight: (w, p) => (P.age(w, p) > 40 && P.realWorth(w, p) > U.RM(1e6) ? 0.4 + 0.5 * n(p.famDesire) + 0.3 * n(p.pers.pat) : 0.01),
      init: () => ({ target: 1e7 }),
      text: g => `Family wealth (you + descendants) of ${U.fmtMoney(U.RM(g.target))}`,
      progress: (w, p, g) => U.clamp(Math.log10(Math.max(1, G.familyWorth(w, p) / w.price / 100) / 1e4) / Math.log10(g.target / 1e4), 0, 1),
      bias: { INVEST: 0.5, START_BIZ: 0.2, SOCIAL: 0.2, CHILDCARE: 0.3 }, spend: -0.05,
      family: 0.4,
    },

    // ---- Expansion 1 (rules revision 5; Idea/Expansion 1). Each is measured from state the simulation
    // really keeps, with month counters on the goal itself; eligible() keeps a goal away from people it
    // cannot apply to. 'Social butterfly' is deferred: 'friends' counts socialising, not real friendships.
    DEBT_FREE: {
      name: 'Debt-free living', icon: '🪙', exp: 5,
      weight: (w, p) => (debtOf(p) > 0 ? 0.6 : 0.08) + 0.4 * n(p.pers.dis) + 0.3 * n(p.pers.pat) + (p.strategy === 'INV' || p.strategy === 'BAL' ? 0.3 : 0),
      init: () => ({ months: 0 }),
      text: () => 'No debts and six months of living costs saved, for a whole year',
      monthly: (w, p, g) => { g.months = debtOf(p) <= 0 && p.arrears <= 0 && p.cash >= 6 * p.mcost ? g.months + 1 : 0; },
      progress: (w, p, g) => U.clamp((debtOf(p) <= 0 ? 0.2 : 0) + 0.2 * Math.min(1, p.cash / Math.max(1, 6 * p.mcost)) + 0.6 * g.months / 12, 0, 1),
      done: (w, p, g) => g.months >= 12,
      bias: { WORK: 0.3, INVEST: 0.3, SOCIAL: -0.3 }, spend: -0.15,
    },
    LASTING_LOVE: {
      name: 'A lasting love', icon: '💞', exp: 5,
      weight: (w, p) => 0.2 + 0.4 * n(p.pers.resp) + 0.3 * n(p.pers.pat) + 0.5 * Math.max(0, n(p.famDesire)),
      init: (w, p) => ({ partner: p.partnerId, months: 0 }),
      text: () => 'Stay with the same partner for 10 years',
      monthly: (w, p, g) => {
        const q = p.partnerId !== null ? w.people[p.partnerId] : null;
        if (!q || !q.alive) { g.partner = null; g.months = 0; return; }
        if (g.partner !== p.partnerId) { g.partner = p.partnerId; g.months = 0; }
        g.months++;
      },
      progress: (w, p, g) => U.clamp(g.months / 120, 0, 1),
      done: (w, p, g) => g.months >= 120,
      bias: { SOCIAL: 0.3, REST: 0.2, GIG: -0.2 }, spend: 0, family: 0.3,
    },
    GOOD_PARENT: {
      name: 'Raise good children', icon: '🧸', exp: 5,
      eligible: (w, p) => p.children.length > 0 || p.famDesire >= 55,
      weight: (w, p) => 0.15 + 0.5 * Math.max(0, n(p.pers.resp)) + 0.6 * Math.max(0, n(p.famDesire)),
      init: () => ({ months: 0 }),
      text: () => 'Care for a child for 10 years and see them grow up',
      monthly: (w, p, g) => { if (p.careOf.some(id => { const c = w.people[id]; return c && c.alive && P.age(w, c) < 18; })) g.months++; },
      progress: (w, p, g) => U.clamp(0.8 * Math.min(1, g.months / 120) + (grownChild(w, p) ? 0.2 : 0), 0, 1),
      done: (w, p, g) => g.months >= 120 && grownChild(w, p),
      bias: { CHILDCARE: 0.8, WORK: 0.1, SOCIAL: -0.2 }, spend: 0.05, family: 0.4, care: 0.3,
    },
    MASTER_SKILL: {
      name: 'Master a skill', icon: '🎯', exp: 5,
      weight: (w, p) => 0.15 + 0.4 * n(p.pers.dis) + 0.3 * n(p.pers.pat) + (p.strategy === 'SPEC' ? 0.6 : 0),
      init: (w, p) => { // intelligence or perception (what mind training builds), up to 9 or the person's own ceiling
        const a = p.pot[C.INT] >= p.pot[C.PER] ? C.INT : C.PER;
        return { attr: a, target: Math.round(Math.max(Math.min(9, p.pot[a] - 0.3), Math.min(p.att[a] + 0.5, p.pot[a])) * 10) / 10, months: 0 };
      },
      text: g => `Master ${C.ATTR_NAMES[g.attr].toLowerCase()}: reach ${g.target.toFixed(1)} and keep it for 6 months`,
      monthly: (w, p, g) => { g.months = p.att[g.attr] >= g.target ? g.months + 1 : 0; },
      progress: (w, p, g) => U.clamp(0.7 * Math.min(1, p.att[g.attr] / g.target) + 0.3 * g.months / 6, 0, 1),
      done: (w, p, g) => g.months >= 6,
      bias: { TRAIN_MIND: 1, STUDY: 0.3, SOCIAL: -0.2 }, spend: 0,
    },
    CAREER_STABLE: {
      name: 'Career stability', icon: '🧱', exp: 5,
      weight: (w, p) => 0.3 + 0.4 * n(p.pers.dis) + 0.4 * n(p.pers.resp) + (p.strategy === 'WORK' ? 0.5 : 0),
      init: () => ({ months: 0 }),
      text: () => 'Stay in work for 5 years without a break',
      monthly: (w, p, g) => { g.months = p.job ? g.months + 1 : 0; }, // switching jobs keeps the streak (the new job starts the same day)
      progress: (w, p, g) => U.clamp(g.months / 60, 0, 1),
      done: (w, p, g) => g.months >= 60,
      bias: { WORK: 0.4, STUDY: 0.1, START_BIZ: -0.5 }, spend: -0.05,
    },
    RISE_UP: {
      name: 'Rise from poverty', icon: '📈', exp: 5,
      eligible: (w, p) => p.clsOrigin === 'B40', // grew up in a B40 household (recorded at age 12; needs the Society system)
      weight: (w, p) => 0.5 + 0.4 * n(p.pers.res) + 0.3 * n(p.pers.pat) - 0.2 * n(p.pers.risk),
      init: () => ({ months: 0 }),
      text: () => 'Grew up in the B40: live in the M40 or above for 3 years',
      monthly: (w, p, g) => { g.months = p.cls === 'M40' || p.cls === 'T20' ? g.months + 1 : 0; },
      progress: (w, p, g) => U.clamp(g.months / 36, 0, 1),
      done: (w, p, g) => g.months >= 36,
      bias: { WORK: 0.3, STUDY: 0.3, INVEST: 0.2, SOCIAL: -0.2 }, spend: -0.1,
    },
    CREATE_JOBS: {
      name: 'Create opportunities', icon: '🏢', exp: 5,
      eligible: (w, p) => ownsStaffedType(w, p), // only firms that really hire staff count (private clinics, schools, hospitals)
      weight: (w, p) => 0.3 + 0.6 * n(p.pers.risk) + 0.4 * n(p.pers.resp) + (p.strategy === 'ENT' ? 0.8 : 0),
      init: () => ({ months: 0, staff: 0 }),
      text: () => 'Employ at least 3 people in my own business for 2 years',
      monthly: (w, p, g) => { g.staff = staffOf(w, p); g.months = g.staff >= 3 ? g.months + 1 : 0; },
      progress: (w, p, g) => U.clamp(0.5 * Math.min(1, g.staff / 3) + 0.5 * g.months / 24, 0, 1),
      done: (w, p, g) => g.months >= 24,
      bias: { MANAGE_BIZ: 0.8, START_BIZ: 0.4, SOCIAL: -0.2 }, spend: -0.1,
    },
    LONG_LIFE: {
      name: 'Live a long life', icon: '🌿', exp: 5,
      eligible: (w, p) => P.age(w, p) >= 50,
      weight: (w, p) => 0.3 + 0.4 * n(p.pers.pat) + 0.3 * n(p.pers.resp) + (p.strategy === 'BAL' ? 0.3 : 0),
      init: () => ({}),
      text: () => 'Reach 85 in good health (60+)',
      progress: (w, p) => U.clamp(0.7 * Math.min(1, P.age(w, p) / 85) + 0.3 * Math.min(1, p.health / 60), 0, 1),
      done: (w, p) => P.age(w, p) >= 85 && p.health >= 60,
      bias: { REST: 0.4, TRAIN_BODY: 0.5, HEALTH: 0.3, GIG: -0.3, WORK: -0.1 }, spend: 0.05,
    },
    COMEBACK: {
      name: 'The comeback', icon: '🌅', exp: 5,
      eligible: (w, p) => p.bankruptUntil >= 0 && P.age(w, p) < 65, // only after a recorded personal bankruptcy
      weight: (w, p) => 0.8 + 0.4 * n(p.pers.res) + 0.2 * n(p.pers.risk),
      init: () => ({ months: 0 }),
      text: () => 'Bounce back from bankruptcy: a positive net worth and 3 months of savings for a year',
      monthly: (w, p, g) => { g.months = p.nw > 0 && p.cash >= 3 * p.mcost ? g.months + 1 : 0; },
      progress: (w, p, g) => U.clamp(0.4 * (p.nw > 0 ? 1 : 0) + 0.6 * g.months / 12, 0, 1),
      done: (w, p, g) => g.months >= 12,
      bias: { WORK: 0.4, GIG: 0.3, TRAIN_MIND: 0.2, SOCIAL: -0.3 }, spend: -0.15,
    },
  };
  G.IDS = Object.keys(G.DEFS);

  G.familyWorth = function (w, p) {
    let sum = p.alive ? p.nw : 0;
    const seen = new Set([p.id]);
    const stack = p.children.slice();
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const c = w.people[id];
      if (c.alive) sum += c.nw;
      stack.push(...c.children);
    }
    return sum;
  };

  // Pick a (new) goal. exclude = goal ids not to repeat right away.
  G.pick = function (w, p, reason, exclude) {
    const R = w.rng.goals;
    const ids = G.IDS.filter(id => !(exclude || []).includes(id) && C.expOn(w, G.DEFS[id]) && (!G.DEFS[id].eligible || G.DEFS[id].eligible(w, p)));
    const idx = R.weighted(ids.map(id => Math.max(0.01, G.DEFS[id].weight(w, p))));
    const id = ids[Math.max(0, idx)];
    p.goal = Object.assign({ id, since: w.day, progress: 0 }, G.DEFS[id].init(w, p, R));
    if (reason) P.log(w, p, `New life goal: ${G.DEFS[id].icon} ${G.text(p.goal)}${reason === 'adult' ? '' : ` (${reason})`}`, 'goal', 0);
  };
  G.text = g => G.DEFS[g.id].text(g);

  G.spendDelta = p => (p.goal ? G.DEFS[p.goal.id].spend || 0 : 0);
  G.familyBoost = p => (p.goal ? G.DEFS[p.goal.id].family || 0 : 0);
  G.careBoost = p => (p.goal ? G.DEFS[p.goal.id].care || 0 : 0);

  G.monthly = function (w, p) {
    if (!p.goal) G.pick(w, p, 'adult');
    const g = p.goal, d = G.DEFS[g.id];
    if (d.monthly) d.monthly(w, p, g);
    g.progress = d.progress(w, p, g);
    const done = d.done ? d.done(w, p, g) : g.progress >= 1;
    if (!done) return;
    const age = Math.floor(P.age(w, p));
    p.goalsDone.push({ id: g.id, day: w.day, age, text: G.text(g) });
    w.stats.goalsAchieved[g.id] = (w.stats.goalsAchieved[g.id] || 0) + 1;
    P.log(w, p, `Achieved a life goal: ${d.icon} ${G.text(g)} (age ${age})`, 'goal', g.id === 'RICH' && g.target >= 1e7 ? 2 : 1);
    p.happy = Math.min(100, p.happy + 15);
    if (d.onDone) d.onDone(w, p, g);
    // Most people set a new goal; some are simply content and aim for a happy life.
    G.pick(w, p, 'after achieving the last one', [g.id]);
  };

  // Daily happiness. Moves slowly toward a target built from how life is going.
  G.daily = function (w, p) {
    const age = P.age(w, p);
    let t = 20 + 12 * p.health / 100 + 15 * (1 - p.stress / 100);
    if (p.hunger > 50) t -= 20;
    if (p.partnerId !== null) t += 7;
    t += Math.min(8, 2.5 * liveKids(w, p));
    t += 12 * p.joyEma;
    if (p.goal) t += 10 * p.goal.progress;
    const rel = Math.log10(Math.max(1, P.realWorth(w, p)) / Math.max(1, w.medianReal));
    t += 8 * U.clamp(rel, -1, 1);
    if (!p.job && p.manages < 0 && !p.retired && !p.enrol && age < 60) t -= 10;
    if (p.goalsDone.length && w.day - p.goalsDone[p.goalsDone.length - 1].day < 730) t += 4;
    p.happy = U.clamp(p.happy * 0.97 + U.clamp(t, 0, 100) * 0.03, 0, 100);
    p.joyEma *= 0.985;
    if (p.happy < 30) p.stress = Math.min(100, p.stress + 0.3);
  };

  // Best leisure venue for this person and slot (deterministic; small daily variety).
  // Venues are flattened once into same-shaped records so this hot loop stays fast.
  let VLIST = null;
  const venueList = () => VLIST || (VLIST = Object.keys(C.VENUES).map((k, i) => {
    const v = C.VENUES[k], tags = v.tags || [];
    return {
      k, i, v, tier: v.tier, cost: v.cost, joy: v.joy, member: v.member || 0, slot: v.slot === undefined ? -1 : v.slot,
      sport: tags.includes('sport'), social: tags.includes('social'), outdoor: tags.includes('outdoor'),
    };
  }));
  // Which venue kinds exist in this town (rechecked whenever buildings are added).
  const avail = { town: null, nb: -1, ok: [] };
  const venueAvail = town => {
    if (avail.town !== town || avail.nb !== town.buildings.length) {
      avail.town = town; avail.nb = town.buildings.length;
      avail.ok = venueList().map(e => { const kinds = town.kinds[e.k]; return !!(kinds && kinds.length); });
    }
    return avail.ok;
  };
  const venueBias = (w, p, k) => { let s = 0; for (const x of w.sys.venueBias) s += x.venueBias(w, p, k); return s; };
  G.pickVenue = function (w, p, ctx, slot) {
    const list = venueList(), lt = p.tiers.leisure, ok = venueAvail(w.town);
    const statusSeek = 0.25 * (n(p.pers.risk) + (P.prestige(p) > 0 ? 1 : 0)) + (lt >= 2 ? 0.25 : 0);
    const sporty = (bodyAvg(p) - 5) * 0.15, social = (p.att[C.CHA] - 5) * 0.1 + (p.partnerId === null ? 0.2 : 0);
    const calm = 0.2 * n(p.pers.pat);
    // Prices feel smaller to the wealthy: compare cost with daily budget or with wealth.
    const budget = Math.max(ctx.daily, p.nw / 2000, 1), spare = p.cash - ctx.mc * 0.3;
    let best = null, bestS = -Infinity;
    const vb = w.sys.venueBias;
    for (const e of list) {
      if ((e.slot >= 0 && e.slot !== slot) || e.member > lt || e.tier > lt + 1) continue;
      const cost = e.cost * 100 * w.price;
      if (spare < cost) continue;
      if (!ok[e.i]) continue;
      const sc = 0.12 * e.joy - 1.2 * cost / budget + statusSeek * e.tier - (e.tier > lt ? 0.4 : 0)
        + (e.sport ? sporty : 0) + (e.social ? social : 0) + (e.outdoor ? calm : 0)
        + ((p.id * 7 + w.day * 13 + e.i * 31) % 17) / 40 // variety from day to day
        + (vb.length ? venueBias(w, p, e.k) : 0);
      if (sc > bestS) { bestS = sc; best = e.k; }
    }
    return best;
  };
})(globalThis.LES = globalThis.LES || {});
