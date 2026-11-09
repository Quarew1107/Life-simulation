// Autonomous decisions. Each day has two 7.2-hour activity slots (plus 8h sleep and
// travel). For every slot: build eligible actions -> utility U(a) from personality,
// strategy, needs and money -> softmax probabilities -> seeded draw -> separate
// success roll. No machine learning: every number is inspectable in the "Why" panel.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const A = LES.Actions = {};

  // Strategy preference added to each action's utility.
  const BIAS = {
    WORK: { WORK: .8, EDU: 0, SPEC: .3, ENT: -.3, INV: .3, BAL: .2 },
    GIG: { WORK: .3, EDU: -.2, SPEC: .1, ENT: .3, INV: 0, BAL: 0 },
    STUDY: { WORK: -.2, EDU: .9, SPEC: .5, ENT: -.2, INV: 0, BAL: .2 },
    ENROLL: { WORK: -1, EDU: 2.2, SPEC: 1.4, ENT: -.8, INV: -.3, BAL: .1 },
    APPLY: { WORK: .8, EDU: .2, SPEC: .3, ENT: -.4, INV: .2, BAL: .3 },
    TRAIN: { WORK: -.1, EDU: .3, SPEC: .9, ENT: .1, INV: 0, BAL: .3 },
    REST: { WORK: 0, EDU: 0, SPEC: 0, ENT: 0, INV: .1, BAL: .3 },
    SOCIAL: { WORK: 0, EDU: -.1, SPEC: -.1, ENT: .2, INV: 0, BAL: .5 },
    HEALTH: { WORK: 0, EDU: 0, SPEC: 0, ENT: 0, INV: 0, BAL: .2 },
    CHILDCARE: { WORK: 0, EDU: 0, SPEC: 0, ENT: -.1, INV: 0, BAL: .4 },
    INVEST: { WORK: 0, EDU: 0, SPEC: 0, ENT: -.3, INV: 2.0, BAL: .6 },
    START_BIZ: { WORK: -1.2, EDU: -1, SPEC: -.6, ENT: 2.6, INV: .2, BAL: -.3 },
    MANAGE_BIZ: { WORK: 0, EDU: 0, SPEC: 0, ENT: .6, INV: .2, BAL: .2 },
  };
  A.BIAS = BIAS;
  A.LABELS = {
    WORK: 'Work shift', GIG: 'Gig', STUDY: 'Attend classes', ENROLL: 'Apply for course', APPLY: 'Apply for job',
    TRAIN: 'Training', REST: 'Rest at home', SOCIAL: 'Socialise', HEALTH: 'Visit hospital', CHILDCARE: 'Childcare',
    INVEST: 'Invest savings', START_BIZ: 'Start a business', MANAGE_BIZ: 'Run business',
  };
  A.ICONS = {
    WORK: '💼', GIG: '🛵', STUDY: '📚', ENROLL: '📝', APPLY: '📄', TRAIN: '💪', REST: '🏠', SOCIAL: '☕',
    HEALTH: '🏥', CHILDCARE: '🍼', INVEST: '📈', START_BIZ: '🚀', MANAGE_BIZ: '🏪', SCHOOL: '🎒', HOME: '🏠', SLEEP: '🌙',
  };

  A.attrScore = function (p, weights) {
    let s = 0;
    for (let i = 0; i < 6; i++) s += weights[i] * p.att[i];
    return s;
  };

  // FSD 5.4: success probability from weighted attributes vs difficulty.
  A.successProb = function (w, p, weights, difficulty, xpLevel) {
    const cfg = w.cfg;
    const aEff = A.attrScore(p, weights);
    const stressPen = Math.max(0, p.stress - 60) / 20 + Math.max(0, 40 - p.energy) / 40;
    const score = cfg.successSlope * (aEff - difficulty + cfg.xpBonus * (xpLevel || 0) - stressPen);
    return U.clamp(U.sigmoid(score), cfg.successMin, cfg.successMax);
  };

  // Chance of a catastrophe GIVEN a failed risky task: base + gap^2 x catGap, times the risk multiplier.
  // Rules revision 2 (C03) caps the FINAL value at catCap; revision 1 (Classic and older saves) capped before
  // the multiplier, so heavy work could reach 2.5 x catCap.
  A.catProb = function (cfg, gap, risk) {
    const mult = C.RISK_MULT[risk] || 1, raw = cfg.catBase + cfg.catGap * gap * gap;
    if (!(cfg.rulesRev >= 2)) return U.clamp(raw, cfg.catBase, cfg.catCap) * mult;
    const cap = U.clamp(cfg.catCap, 0, 1), v = raw * mult;
    return Number.isFinite(v) ? U.clamp(v, Math.min(cfg.catBase, cap), cap) : cap;
  };
  // For explanations: chance of success, of a catastrophe after a failure, and of a catastrophe overall.
  A.taskOdds = function (w, p, weights, difficulty, xpLevel, risk) {
    const ps = A.successProb(w, p, weights, difficulty, xpLevel), pc = risk ? A.catProb(w.cfg, Math.max(0, difficulty - A.attrScore(p, weights)), risk) : 0;
    return { success: ps, catIfFail: pc, cat: (1 - ps) * pc };
  };

  // Success roll, then a catastrophe roll that is CONDITIONAL on failure.
  A.taskRoll = function (w, p, weights, difficulty, xpLevel, risk) {
    const R = w.rng.outcome, cfg = w.cfg;
    const ps = A.successProb(w, p, weights, difficulty, xpLevel);
    if (R.next() < ps) return { ok: true, p: ps };
    if (risk) {
      const pc = A.catProb(cfg, Math.max(0, difficulty - A.attrScore(p, weights)), risk);
      if (R.next() < pc) return { ok: false, cat: true, p: ps };
    }
    return { ok: false, p: ps };
  };

  // Attribute training with diminishing returns; slower above inherited potential and with age.
  A.improve = function (w, p, a, factor) {
    const age = P.age(w, p);
    const ageF = age < 25 ? 1.2 : age > 60 ? 0.35 : age > 40 ? 0.6 : 1;
    const cur = p.att[a];
    const gain = 0.04 * Math.pow(Math.max(0, 1 - cur / 10), 1.5) * factor * (cur < p.pot[a] ? 1 : 0.35) * ageF;
    p.att[a] = Math.min(10, cur + gain);
  };
  A.practice = function (w, p, weights, factor) {
    let best = 0;
    for (let i = 1; i < 6; i++) if (weights[i] > weights[best]) best = i;
    A.improve(w, p, best, factor);
  };

  A.catastrophe = function (w, p, weights, what) {
    const R = w.rng.outcome;
    let best = 0;
    for (let i = 1; i < 6; i++) if (weights[i] > weights[best]) best = i;
    const hpLoss = R.range(15, 40);
    const attLoss = R.range(0.2, 1.0);
    p.health = Math.max(1, p.health - hpLoss);
    p.att[best] = Math.max(0, p.att[best] - attLoss);
    p.injuredUntil = w.day + R.int(7, 60);
    const injury = w.px(R.range(500, 5000));
    LES.Services.medicalBill(w, p, Math.min(p.cash, injury), false, injury);
    p.stress = Math.min(100, p.stress + 20);
    w.stats.catastrophes++;
    P.log(w, p, `Seriously ${what}: -${Math.round(hpLoss)} health, lost ${attLoss.toFixed(1)} ${C.ATTR_NAMES[best]}`, 'luck', 1);
  };

  // Day-level context (computed once per person per day).
  A.context = function (w, p) {
    const mc = Math.max(w.px(500), p.mcost);
    const pr = p.pers;
    return {
      mc, daily: mc / 30, age: P.age(w, p),
      urg: U.clamp((2 - p.cash / mc) / 2, 0, 1),
      dis: (pr.dis - 50) / 50, pat: (pr.pat - 50) / 50, risk: (pr.risk - 50) / 50,
      resp: (pr.resp - 50) / 50, res: (pr.res - 50) / 50,
      injured: p.injuredUntil > w.day,
      // Filled in on first use each day (declared here so every context has one shape).
      gig: undefined, gigE: 0, vac: undefined, train: undefined, trainR: -1,
    };
  };

  function needs(p) {
    return {
      tired: U.clamp((60 - p.energy) / 60, 0, 1),
      stressed: U.clamp((p.stress - 45) / 55, 0, 1),
      sick: U.clamp((65 - p.health) / 65, 0, 1),
    };
  }

  // Which attributes matter to this person right now (job, business, likely gigs).
  function relevance(w, p) {
    const r = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
    const addW = (ws, k) => { for (let i = 0; i < 6; i++) r[i] += ws[i] * k; };
    if (p.job) addW(C.JOB_BY_ID[p.job.jobId].w, 1);
    if (p.manages >= 0) addW(w.biz[p.manages].typeDef.w, 1);
    if (p.enrol) addW(C.COURSE_BY_ID[p.enrol.course].w, 0.8);
    if (!p.job && p.manages < 0) addW(C.GIGS[0].w, 0.4);
    return r;
  }

  A.bestCourse = function (w, p) {
    const cur = p.job ? p.job.salary : w.px(2000);
    const patience = p.pers.pat / 100;
    let best = null, bestV = 0.05;
    for (const c of C.COURSES) {
      if (p.quals.includes(c.id) || !C.expOn(w, c)) continue; // (Expansion 1 degrees only in rules revision 5+)
      if (c.prereq && !P.hasCred(p, c.prereq)) continue;
      if (c.id !== 'MASTER' && C.BACHELORS.includes(c.id) && p.quals.some(P.isBachelor)) continue; // one bachelor is enough
      const acc = U.sigmoid((p.att[C.INT] - c.minInt) * 1.5);
      if (acc < 0.1) continue;
      // A Master's only adds a modest hiring bonus, so few people find it worth 18 months.
      const unlock = c.id === 'MASTER' ? cur * 1.15 : w.px(w.qualValue[c.id] * 0.85);
      const value = Math.log(unlock / Math.max(cur, w.px(1500))) * acc - 0.15 * (c.months / 12) * (1 - patience);
      if (value > bestV) { bestV = value; best = { course: c, value }; }
    }
    return best;
  };

  // Training courses that build the body (cached: the goal bias asks on every decision).
  const BODY_TRAINING = new Map();
  const isBodyTraining = t => {
    let b = BODY_TRAINING.get(t);
    if (b === undefined) BODY_TRAINING.set(t, b = !!(t && t.attrs && t.attrs.some(a => C.BODY_ATTRS.includes(a))));
    return b;
  };

  // Vacancies a person could apply for, grouped by which qualifications they hold.
  // Listings only change in Labour.dailyMarket (before anyone decides), so the
  // filtered lists are rebuilt once per day; order stays best-paid first.
  let VAC_REQS = null;
  const vacCache = { w: null, day: -1, list: null, len: -1, byMask: new Map() };
  function eligibleVacancies(w, p) {
    if (!VAC_REQS) VAC_REQS = [...new Set(C.JOBS.map(j => j.req || null))];
    const vc = vacCache;
    if (vc.w !== w || vc.day !== w.day || vc.list !== w.vacancies || vc.len !== w.vacancies.length) {
      vc.w = w; vc.day = w.day; vc.list = w.vacancies; vc.len = w.vacancies.length; vc.byMask.clear();
    }
    let mask = 0;
    for (let i = 0; i < VAC_REQS.length; i++) if (P.hasCred(p, VAC_REQS[i])) mask |= 1 << i;
    let list = vc.byMask.get(mask);
    if (!list) {
      list = w.vacancies.filter(v => mask & (1 << VAC_REQS.indexOf(v.job.req || null)));
      vc.byMask.set(mask, list);
    }
    return list;
  }

  // Strategy and life-goal preferences as fixed-shape rows (every action present, 0 if
  // none), so the hot loop reads plain fields instead of looking keys up by name.
  const row = src => ({
    WORK: src.WORK || 0, GIG: src.GIG || 0, STUDY: src.STUDY || 0, ENROLL: src.ENROLL || 0, APPLY: src.APPLY || 0,
    TRAIN_BODY: src.TRAIN_BODY || 0, TRAIN_MIND: src.TRAIN_MIND || 0, REST: src.REST || 0, SOCIAL: src.SOCIAL || 0,
    HEALTH: src.HEALTH || 0, CHILDCARE: src.CHILDCARE || 0, INVEST: src.INVEST || 0, START_BIZ: src.START_BIZ || 0, MANAGE_BIZ: src.MANAGE_BIZ || 0,
  });
  const STRAT_ROW = {};
  const stratRow = s => STRAT_ROW[s] || (STRAT_ROW[s] = row(Object.fromEntries(Object.keys(BIAS).map(k => [k, BIAS[k][s]]).concat([['TRAIN_BODY', BIAS.TRAIN[s]], ['TRAIN_MIND', BIAS.TRAIN[s]]]))));
  const GOAL_ROW = {}, NO_GOAL = row({});
  const goalRow = p => (p.goal ? GOAL_ROW[p.goal.id] || (GOAL_ROW[p.goal.id] = row(LES.Goals.DEFS[p.goal.id].bias)) : NO_GOAL);

  // One candidate option; g = the person's life-goal preference for it (goals never
  // change odds of success). p and ok are filled in later (softmax, resolve).
  // Labels are only built when shown (A.labelOf), not for every option weighed.
  function addCand(out, g, id, u, loc, data) {
    u += g;
    if (Number.isFinite(u)) out.push({ id, u, loc, data, label: '', p: 0, ok: undefined });
  }

  // Display text of an option from its action and data (WORK data = the job).
  A.labelOf = function (id, data) {
    switch (id) {
      case 'WORK': return `Work: ${data.title}`;
      case 'GIG': return `Gig: ${data.name}`;
      case 'STUDY': return `Class: ${data.name}`;
      case 'ENROLL': return `Apply: ${data.name}`;
      case 'APPLY': return `Apply: ${data.job.title}`;
      case 'TRAIN': return data.name;
      case 'SOCIAL': return `Leisure: ${C.VENUES[data].name}`;
      case 'START_BIZ': return `Start a ${data.type.name}`;
      case 'MANAGE_BIZ': return `Run ${data.name}`;
      default: {
        const sl = LES.Systems ? LES.Systems.all() : [];
        for (const s of sl) if (s.label) { const t = s.label(id, data); if (t) return t; }
        return A.LABELS[id] || id;
      }
    }
  };

  A.candidates = function (w, p, ctx, slot) {
    const n = needs(p), s = p.strategy, out = [], town = w.town, date = w.date;
    // Life-changing choices (study, start a business) are only weighed on a personal
    // monthly "reflection day", so a tiny daily probability cannot snowball.
    const reflect = date.dom === (p.id % 28) + 1;
    const gb = goalRow(p), B = stratRow(s);
    const canExert = !ctx.injured && p.health >= 15;

    addCand(out, gb.REST, 'REST', 0.3 + 2.2 * n.tired + 1.0 * n.stressed + 0.8 * n.sick - 0.35 * ctx.dis + B.REST, p.homeId);

    if (p.job && canExert && p.job.lastShiftDay !== w.day && p.energy >= 12) {
      const need = Math.max(0, w.cfg.shiftsPerMonth - p.job.shiftsMonth);
      const daysLeft = date.dim - date.dom + 1;
      const pace = need / daysLeft;
      let u = 1.0 + 2.2 * Math.min(pace, 1.5) + 0.5 * ctx.resp + 0.4 * ctx.dis + B.WORK
        - 1.2 * n.tired - 0.6 * n.stressed + 0.4 * ctx.urg;
      if (need === 0) u -= 1.8;
      addCand(out, gb.WORK, 'WORK', u, p.job.place, p.job);
    }

    if (canExert && p.energy >= 20 && ctx.age < 75) {
      // The best gig is worked out once per day (both slots share it).
      if (ctx.gig === undefined) {
        ctx.gig = null; ctx.gigE = 0;
        for (const g of C.GIGS) {
          if (g.needTransport && p.tiers.transport < g.needTransport) continue;
          const ps = A.successProb(w, p, g.w, g.diff, p.xp[g.cat]);
          const e = g.pay * (ps + (1 - ps) * 0.25);
          if (e > ctx.gigE) { ctx.gigE = e; ctx.gig = g; }
        }
      }
      const best = ctx.gig, bestE = ctx.gigE;
      if (best) {
        const u = -0.3 + 1.6 * ctx.urg + (p.job || p.manages >= 0 ? -0.6 : 0.7) + 0.5 * Math.log(1 + w.px(bestE) / ctx.daily)
          + B.GIG - 1.4 * n.tired - 0.4 * n.stressed - (p.retired ? 1 : 0);
        addCand(out, gb.GIG, 'GIG', u, LES.townNear(town, best.place, p.homeId), best);
      }
    }

    if (p.enrol && canExert && p.energy >= 12) {
      const course = C.COURSE_BY_ID[p.enrol.course];
      const monthsIn = (w.day - p.enrol.startDay) / 30.4;
      const behind = U.clamp((monthsIn * 12 - p.enrol.progress) / 24, -1, 1);
      const u = 1.0 + 0.6 * ctx.dis + 0.5 * ctx.pat + 0.8 * behind + B.STUDY - 1.2 * n.tired - 0.6 * n.stressed;
      addCand(out, gb.STUDY, 'STUDY', u, LES.townNear(town, course.place, p.homeId), course);
    }

    if (reflect && !p.enrol && ctx.age < 45 && !p.retired && w.day - p.lastEnrollTry > 60 && p.bankruptUntil < w.day && !(w.flags && w.flags.noCourses)) {
      const pick = A.bestCourse(w, p);
      if (pick) {
        const u = -1.6 + B.ENROLL + 0.7 * ctx.pat + 0.4 * ctx.dis - 0.06 * Math.max(0, ctx.age - 25)
          + 1.2 * pick.value - 0.6 * n.tired - (p.manages >= 0 ? 1 : 0);
        addCand(out, gb.ENROLL, 'ENROLL', u, LES.townNear(town, pick.course.place, p.homeId), pick.course);
      }
    }

    // Job hunting: the unemployed look every day, people with a job browse once a week.
    if (!p.retired && ctx.age < 64 && canExert && w.vacancies.length && (!p.job || (w.day + p.id) % 7 === 0)) {
      const cur = p.job ? p.job.salary : 0;
      const base = Math.max(cur, w.px(1500));
      if (ctx.vac === undefined) {
        ctx.vac = null;
        let bestV = -Infinity, seen = 0;
        const list = eligibleVacancies(w, p);
        for (let i = 0; i < list.length; i++) { // sorted best-paid first; look at the top 12 they qualify for
          const v = list[i];
          if (v.salary < cur * 1.15) break;
          if (v.appSet.has(p.id)) continue;
          const val = Math.log(v.salary / base) + A.attrScore(p, v.job.w) / 10;
          if (val > bestV) { bestV = val; ctx.vac = v; }
          if (++seen >= 12) break;
        }
      }
      const best = ctx.vac && !ctx.vac.appSet.has(p.id) ? ctx.vac : null;
      if (best) {
        const u = (p.job ? -0.6 : 1.5) + 1.0 * ctx.urg + B.APPLY + 0.8 * Math.log(best.salary / base)
          - 0.6 * n.tired - (p.manages >= 0 ? 1.2 : 0);
        addCand(out, gb.APPLY, 'APPLY', u, best.place, best);
      }
    }

    if (canExert && p.energy >= 25 && ctx.age < 70) {
      if (ctx.train === undefined) { // best training worked out once per day
        const rel = relevance(w, p);
        ctx.train = null; ctx.trainR = -1;
        for (const t of C.TRAININGS) {
          if (p.cash < w.px(t.cost) + ctx.mc * 0.3) continue;
          let r = 0;
          for (const a of t.attrs) r += rel[a] * (1 - p.att[a] / 10) * (p.att[a] < p.pot[a] ? 1 : 0.4);
          if (r > ctx.trainR) { ctx.trainR = r; ctx.train = t; }
        }
      }
      const best = ctx.train, bestR = ctx.trainR;
      if (best) {
        // Strategies weigh body and mind training alike (TRAIN_BODY = TRAIN_MIND in B).
        const u = -0.5 + B.TRAIN_BODY + 0.5 * ctx.dis + 0.3 * ctx.pat + 1.2 * bestR - 1.3 * n.tired - 1.2 * ctx.urg - 0.3 * n.stressed;
        addCand(out, isBodyTraining(best) ? gb.TRAIN_BODY : gb.TRAIN_MIND, 'TRAIN', u, LES.townNear(town, best.place, p.homeId), best);
      }
    }

    if (p.energy >= 10 && p.cash >= w.px(15)) {
      const single = !p.partnerId && ctx.age >= 20 && ctx.age <= 50;
      const u = -0.1 + 1.0 * n.stressed + (single ? 0.4 + 0.6 * p.famDesire / 100 : 0) + 0.04 * (p.att[C.CHA] - 5)
        + B.SOCIAL - 0.6 * ctx.urg - 0.3 * ctx.dis - 0.4 * n.tired + (ctx.age > 65 ? 0.4 : 0);
      // Leisure outing: the venue depends on budget, taste and status (see Goals.pickVenue).
      const vk = LES.Goals.pickVenue(w, p, ctx, slot);
      if (vk) {
        const v = C.VENUES[vk];
        addCand(out, gb.SOCIAL, 'SOCIAL', u + 0.04 * v.joy, LES.townNear(town, vk, p.homeId), vk);
      }
    }

    if (n.sick > 0.15 && p.cash >= w.px(60)) addCand(out, gb.HEALTH, 'HEALTH', -1.5 + 4 * n.sick + B.HEALTH, LES.townNear(town, 'hospital', p.homeId));

    if (p.careOf.length) {
      let deficit = 0;
      for (const cid of p.careOf) {
        const c = w.people[cid];
        if (!c.alive || P.age(w, c) >= 12) continue;
        deficit = Math.max(deficit, U.clamp((8 - c.careSessions) / 8 * (0.3 + date.dom / date.dim), 0, 1));
      }
      if (deficit > 0) addCand(out, gb.CHILDCARE, 'CHILDCARE', 0.4 + 1.0 * ctx.resp + 1.6 * deficit + B.CHILDCARE - 0.5 * n.tired, p.homeId);
    }

    const surplus = p.cash - ctx.mc * (4 - 2 * ctx.risk);
    if (surplus >= w.px(1000) && w.day - p.lastInvestDay > 20) {
      // Rising markets tempt risk-takers (FOMO); this feeds the town's influence on prices.
      const fomo = 2 * Math.max(0, LES.Market.retOver(w, 63) - 0.1) * (ctx.risk + 1) / 2;
      const u = -0.8 + B.INVEST + 0.7 * ctx.pat + 0.4 * Math.log(1 + surplus / ctx.mc) - 0.5 * ctx.urg + fomo;
      addCand(out, gb.INVEST, 'INVEST', u, town.byKind.bursa, surplus);
    }

    if (reflect && !p.retired && ctx.age >= 20 && ctx.age < 65 && p.bankruptUntil < w.day && !p.medCollect && p.manages < 0 && w.day - p.lastBizTry > 120) {
      const pick = LES.Finance.bestBizType(w, p, ctx);
      if (pick) {
        let u = -2.5 + B.START_BIZ + 1.3 * ctx.risk - 0.3 * ctx.pat + 0.25 * (pick.skill - 5)
          - 0.5 * p.bizFailures * (1 - (ctx.res + 1) / 2) + (p.ideaUntil > w.day ? 1.0 : 0);
        if (p.job) u -= 0.3 * Math.max(0, Math.log(p.job.salary / w.px(3000)));
        addCand(out, gb.START_BIZ, 'START_BIZ', u, LES.townNear(town, 'bank', p.homeId), pick);
      }
    }

    if (p.manages >= 0 && canExert && p.energy >= 12) {
      const b = w.biz[p.manages];
      const u = 1.2 + B.MANAGE_BIZ + 0.4 * ctx.resp + 0.4 * ctx.dis - 1.2 * n.tired - 0.5 * n.stressed + (b.mgmt < 16 ? 0.6 : -0.6);
      addCand(out, gb.MANAGE_BIZ, 'MANAGE_BIZ', u, b.place, b);
    }
    // Choices offered by optional systems (crime, worship, politics...).
    const sc = w.sys.candidates;
    for (let i = 0; i < sc.length; i++) sc[i].candidates(w, p, ctx, slot, (g, id, u, loc, data) => addCand(out, g, id, u, loc, data));
    return out;
  };

  // Stable softmax (FSD 5.3) and a seeded draw.
  A.softmax = function (w, cands) {
    const T = w.cfg.softmaxT;
    let umax = -Infinity;
    for (const c of cands) if (c.u > umax) umax = c.u;
    let sum = 0;
    for (const c of cands) { c.p = Math.exp((c.u - umax) / T); sum += c.p; }
    if (!(sum > 0) || !Number.isFinite(sum)) throw new Error('Decision probabilities are not finite');
    for (const c of cands) c.p /= sum;
  };
  A.choose = function (w, cands) {
    A.softmax(w, cands);
    let r = w.rng.decide.next();
    for (const c of cands) { r -= c.p; if (r < 0) return c; }
    return cands[cands.length - 1];
  };

  A.resolve = function (w, p, c, ctx, slot) {
    const L = w.ledger;
    switch (c.id) {
      case 'REST':
        p.energy += 18; p.stress -= 10; p.health += 0.3;
        break;
      case 'WORK': {
        const job = p.job, j = C.JOB_BY_ID[job.jobId];
        const r = A.taskRoll(w, p, j.w, j.diff + (job.level - 1) * 0.3, p.xp[j.cat], j.risk);
        job.shiftsMonth++; job.lastShiftDay = w.day; job.perfN++;
        if (r.ok) job.perfOk++;
        c.ok = r.ok;
        p.xp[j.cat] = Math.min(5, p.xp[j.cat] + 1 / 240);
        p.energy -= 28; p.stress += r.ok ? 4 : 6;
        if (j.commute) { p.energy -= 12; p.stress += 2; } // long train ride to the city and back
        else if (job.commuteTo !== undefined) { p.energy -= 8; p.stress += 1.5; } // bus ride to a sister town
        A.practice(w, p, j.w, 0.15);
        if (r.cat) A.catastrophe(w, p, j.w, `injured in a work accident as ${job.title}`);
        break;
      }
      case 'GIG': {
        const g = c.data;
        const r = A.taskRoll(w, p, g.w, g.diff, p.xp[g.cat], g.risk);
        const pay = w.px(g.pay * (r.ok ? 1 : 0.25) * w.macro().gigMult * (w.shock ? w.shock.gig : 1));
        L.pay('GIGS', p, 'cash', pay);
        p.earned.gigs += pay; p.monthIncome += pay;
        c.ok = r.ok;
        p.xp[g.cat] = Math.min(5, p.xp[g.cat] + 1 / 400);
        p.energy -= 24; p.stress += 3;
        A.practice(w, p, g.w, 0.12);
        if (r.cat) A.catastrophe(w, p, g.w, `injured during a ${g.name.toLowerCase()}`);
        break;
      }
      case 'STUDY': LES.Labour.study(w, p, c.data); break;
      case 'ENROLL': LES.Labour.enroll(w, p, c.data); break;
      case 'APPLY': c.data.applicants.push(p.id); c.data.appSet.add(p.id); p.energy -= 8; break;
      case 'TRAIN': {
        const t = c.data;
        if (!L.spend(p, 'cash', 'TRAINING', w.px(t.cost))) break;
        const r = A.taskRoll(w, p, t.w, t.diff, 0, t.risk);
        c.ok = r.ok;
        for (const a of t.attrs) A.improve(w, p, a, r.ok ? 1 : 0.35);
        if (t.attrs.some(x => C.BODY_ATTRS.includes(x))) p.yr.phys++; else p.yr.mental++;
        p.energy -= 25; p.stress += 1;
        if (r.cat) A.catastrophe(w, p, t.w, 'injured while training');
        break;
      }
      case 'SOCIAL': {
        const v = C.VENUES[c.data] || C.VENUES.mamak;
        L.spend(p, 'cash', 'MERCHANT', Math.min(p.cash, w.px(v.cost)));
        p.stress -= v.relief; p.energy -= v.energy;
        // Diminishing returns: each outing adds less once life is already fun.
        p.happy = Math.min(100, p.happy + v.joy * 0.1);
        p.joyEma += (1 - p.joyEma) * v.joy / 100;
        if (v.network) p.netMonth++;
        const key = c.loc * 2 + slot, pool = w.socialPools.get(key); // who is at this venue in this slot
        if (pool) pool.push(p.id); else w.socialPools.set(key, [p.id]);
        break;
      }
      case 'HEALTH':
        if (w.gov ? p.cash >= w.px(60) && LES.Services.medicalBill(w, p, w.px(60), true) >= 0 : L.spend(p, 'cash', 'HEALTH', w.px(60))) { p.health += 12; p.stress -= 2; } // public clinics charge RM1
        p.energy -= 4;
        break;
      case 'CHILDCARE':
        for (const cid of p.careOf) {
          const ch = w.people[cid];
          if (ch.alive && P.age(w, ch) < 12) ch.careSessions++;
        }
        p.energy -= 12; p.stress += 1;
        break;
      case 'INVEST':
        LES.Finance.invest(w, p, c.data, ctx);
        p.lastInvestDay = w.day; p.energy -= 4;
        break;
      case 'START_BIZ':
        p.lastBizTry = w.day; p.energy -= 10;
        LES.Finance.startBusiness(w, p, c.data, ctx);
        break;
      case 'MANAGE_BIZ': {
        const b = c.data;
        b.mgmt++;
        p.xp.business = Math.min(5, p.xp.business + 1 / 300);
        p.energy -= 24; p.stress += 4;
        A.practice(w, p, b.typeDef.w, 0.12);
        break;
      }
      default: {
        const sr = w.sys.resolve;
        let done = false;
        for (let i = 0; i < sr.length && !done; i++) done = sr[i].resolve(w, p, c, ctx, slot) === true;
        if (!done) throw new Error(`No system handled the choice ${c.id}`);
      }
    }
    A.clampNeeds(p);
  };

  A.clampNeeds = function (p) {
    p.health = U.clamp(p.health, 0, 100);
    p.energy = U.clamp(p.energy, 0, 100);
    p.stress = U.clamp(p.stress, 0, 100);
    p.hunger = U.clamp(p.hunger, 0, 100);
  };

  // One slot of the "Why did they do that?" record. Kept compactly in reusable typed
  // arrays: holding everyone's option objects until the next day was a large
  // garbage-collection cost in big towns. The panel reads .options as usual.
  const WHY_MAX = 16;
  class WhySlot {
    constructor() {
      this.n = 0; this.chosen = ''; this.act = ''; this.forced = false; this.ok = undefined;
      this.ids = new Array(WHY_MAX).fill(''); this.refs = new Array(WHY_MAX).fill(null);
      this.u = new Float64Array(WHY_MAX); this.pr = new Float64Array(WHY_MAX);
    }
    record(cands, chosen, forced) {
      const n = Math.min(WHY_MAX, cands.length);
      for (let i = 0; i < n; i++) {
        const c = cands[i];
        this.ids[i] = c.id; this.refs[i] = c.data; this.u[i] = c.u; this.pr[i] = c.p;
      }
      for (let i = n; i < this.n; i++) this.refs[i] = null; // let go of yesterday's extras
      this.n = n; this.chosen = chosen.label; this.act = chosen.id; this.forced = forced; this.ok = chosen.ok;
    }
    get options() {
      const out = [];
      for (let i = 0; i < this.n; i++) out.push({ id: this.ids[i], label: A.labelOf(this.ids[i], this.refs[i]), u: this.u[i], p: this.pr[i] });
      return out;
    }
  }

  A.WhySlot = WhySlot;

  // Plan and act both slots for one adult. Stores the plan (for the map) and the
  // probability table (for the "Why" panel).
  A.liveDay = function (w, p) {
    const ctx = A.context(w, p);
    p.plan = [];
    const buf = p.whyBuf || (p.whyBuf = [new WhySlot(), new WhySlot()]);
    let slots = 0;
    for (let slot = 0; slot < 2; slot++) {
      if (!p.alive) break;
      const cands = A.candidates(w, p, ctx, slot);
      let chosen, forced = false;
      if (p.health < 15) {
        // Life-preserving override (FSD 5.3), logged in the Why panel.
        A.softmax(w, cands);
        chosen = cands.find(c => c.id === 'HEALTH') || cands.find(c => c.id === 'REST');
        forced = true;
      } else {
        chosen = A.choose(w, cands);
      }
      chosen.label = A.labelOf(chosen.id, chosen.data);
      A.resolve(w, p, chosen, ctx, slot);
      // sub = which job / gig / training, so the map can show movers vs indoor work.
      const sub = chosen.id === 'WORK' ? p.job && p.job.jobId : typeof chosen.data === 'string' ? chosen.data : chosen.data && typeof chosen.data.id === 'string' ? chosen.data.id : null;
      p.plan.push({ act: chosen.id, label: chosen.label, loc: chosen.loc, ok: chosen.ok, sub });
      buf[slot].record(cands, chosen, forced);
      slots++;
    }
    p.why = slots === 2 ? buf : buf.slice(0, slots);
  };
})(globalThis.LES = globalThis.LES || {});
