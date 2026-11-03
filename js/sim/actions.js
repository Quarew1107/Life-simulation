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

  // Success roll, then a catastrophe roll that is CONDITIONAL on failure.
  A.taskRoll = function (w, p, weights, difficulty, xpLevel, risk) {
    const R = w.rng.outcome, cfg = w.cfg;
    const ps = A.successProb(w, p, weights, difficulty, xpLevel);
    if (R.next() < ps) return { ok: true, p: ps };
    if (risk) {
      const gap = Math.max(0, difficulty - A.attrScore(p, weights));
      const pc = U.clamp(cfg.catBase + cfg.catGap * gap * gap, cfg.catBase, cfg.catCap) * (C.RISK_MULT[risk] || 1);
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
    const bill = Math.min(p.cash, w.px(R.range(500, 5000)));
    w.ledger.spend(p, 'cash', 'HEALTH', bill);
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
      if (p.quals.includes(c.id)) continue;
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

  A.candidates = function (w, p, ctx, slot) {
    const n = needs(p), s = p.strategy, out = [], town = w.town, date = w.date;
    // Life-changing choices (study, start a business) are only weighed on a personal
    // monthly "reflection day", so a tiny daily probability cannot snowball.
    const reflect = date.dom === (p.id % 28) + 1;
    // Every option also gets the person's life-goal preference (never changes odds of success).
    const add = (id, u, loc, data, label) => {
      u += LES.Goals.bias(p, id, data);
      if (Number.isFinite(u)) out.push({ id, u, loc, data, label: label || A.LABELS[id] });
    };
    const canExert = !ctx.injured && p.health >= 15;

    add('REST', 0.3 + 2.2 * n.tired + 1.0 * n.stressed + 0.8 * n.sick - 0.35 * ctx.dis + BIAS.REST[s], p.homeId);

    if (p.job && canExert && p.job.lastShiftDay !== w.day && p.energy >= 12) {
      const need = Math.max(0, w.cfg.shiftsPerMonth - p.job.shiftsMonth);
      const daysLeft = date.dim - date.dom + 1;
      const pace = need / daysLeft;
      let u = 1.0 + 2.2 * Math.min(pace, 1.5) + 0.5 * ctx.resp + 0.4 * ctx.dis + BIAS.WORK[s]
        - 1.2 * n.tired - 0.6 * n.stressed + 0.4 * ctx.urg;
      if (need === 0) u -= 1.8;
      add('WORK', u, p.job.place, null, `Work: ${p.job.title}`);
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
          + BIAS.GIG[s] - 1.4 * n.tired - 0.4 * n.stressed - (p.retired ? 1 : 0);
        add('GIG', u, LES.townNear(town, best.place, p.homeId), best, `Gig: ${best.name}`);
      }
    }

    if (p.enrol && canExert && p.energy >= 12) {
      const course = C.COURSE_BY_ID[p.enrol.course];
      const monthsIn = (w.day - p.enrol.startDay) / 30.4;
      const behind = U.clamp((monthsIn * 12 - p.enrol.progress) / 24, -1, 1);
      const u = 1.0 + 0.6 * ctx.dis + 0.5 * ctx.pat + 0.8 * behind + BIAS.STUDY[s] - 1.2 * n.tired - 0.6 * n.stressed;
      add('STUDY', u, LES.townNear(town, course.place, p.homeId), course, `Class: ${course.name}`);
    }

    if (reflect && !p.enrol && ctx.age < 45 && !p.retired && w.day - p.lastEnrollTry > 60 && p.bankruptUntil < w.day) {
      const pick = A.bestCourse(w, p);
      if (pick) {
        const u = -1.6 + BIAS.ENROLL[s] + 0.7 * ctx.pat + 0.4 * ctx.dis - 0.06 * Math.max(0, ctx.age - 25)
          + 1.2 * pick.value - 0.6 * n.tired - (p.manages >= 0 ? 1 : 0);
        add('ENROLL', u, LES.townNear(town, pick.course.place, p.homeId), pick.course, `Apply: ${pick.course.name}`);
      }
    }

    // Job hunting: the unemployed look every day, people with a job browse once a week.
    if (!p.retired && ctx.age < 64 && canExert && w.vacancies.length && (!p.job || (w.day + p.id) % 7 === 0)) {
      const cur = p.job ? p.job.salary : 0;
      const base = Math.max(cur, w.px(1500));
      if (ctx.vac === undefined) {
        ctx.vac = null;
        let bestV = -Infinity, seen = 0;
        for (const v of w.vacancies) { // sorted best-paid first; look at the top 12 they qualify for
          if (v.salary < cur * 1.15) break;
          if (!P.hasCred(p, v.job.req) || v.appSet.has(p.id)) continue;
          const val = Math.log(v.salary / base) + A.attrScore(p, v.job.w) / 10;
          if (val > bestV) { bestV = val; ctx.vac = v; }
          if (++seen >= 12) break;
        }
      }
      const best = ctx.vac && !ctx.vac.appSet.has(p.id) ? ctx.vac : null;
      if (best) {
        const u = (p.job ? -0.6 : 1.5) + 1.0 * ctx.urg + BIAS.APPLY[s] + 0.8 * Math.log(best.salary / base)
          - 0.6 * n.tired - (p.manages >= 0 ? 1.2 : 0);
        add('APPLY', u, best.place, best, `Apply: ${best.job.title}`);
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
        const u = -0.5 + BIAS.TRAIN[s] + 0.5 * ctx.dis + 0.3 * ctx.pat + 1.2 * bestR - 1.3 * n.tired - 1.2 * ctx.urg - 0.3 * n.stressed;
        add('TRAIN', u, LES.townNear(town, best.place, p.homeId), best, best.name);
      }
    }

    if (p.energy >= 10 && p.cash >= w.px(15)) {
      const single = !p.partnerId && ctx.age >= 20 && ctx.age <= 50;
      const u = -0.1 + 1.0 * n.stressed + (single ? 0.4 + 0.6 * p.famDesire / 100 : 0) + 0.04 * (p.att[C.CHA] - 5)
        + BIAS.SOCIAL[s] - 0.6 * ctx.urg - 0.3 * ctx.dis - 0.4 * n.tired + (ctx.age > 65 ? 0.4 : 0);
      // Leisure outing: the venue depends on budget, taste and status (see Goals.pickVenue).
      const vk = LES.Goals.pickVenue(w, p, ctx, slot);
      if (vk) {
        const v = C.VENUES[vk];
        add('SOCIAL', u + 0.04 * v.joy, LES.townNear(town, vk, p.homeId), vk, `Leisure: ${v.name}`);
      }
    }

    if (n.sick > 0.15 && p.cash >= w.px(60)) add('HEALTH', -1.5 + 4 * n.sick + BIAS.HEALTH[s], LES.townNear(town, 'hospital', p.homeId));

    if (p.careOf.length) {
      let deficit = 0;
      for (const cid of p.careOf) {
        const c = w.people[cid];
        if (!c.alive || P.age(w, c) >= 12) continue;
        deficit = Math.max(deficit, U.clamp((8 - c.careSessions) / 8 * (0.3 + date.dom / date.dim), 0, 1));
      }
      if (deficit > 0) add('CHILDCARE', 0.4 + 1.0 * ctx.resp + 1.6 * deficit + BIAS.CHILDCARE[s] - 0.5 * n.tired, p.homeId);
    }

    const surplus = p.cash - ctx.mc * (4 - 2 * ctx.risk);
    if (surplus >= w.px(1000) && w.day - p.lastInvestDay > 20) {
      // Rising markets tempt risk-takers (FOMO); this feeds the town's influence on prices.
      const fomo = 2 * Math.max(0, LES.Market.retOver(w, 63) - 0.1) * (ctx.risk + 1) / 2;
      const u = -0.8 + BIAS.INVEST[s] + 0.7 * ctx.pat + 0.4 * Math.log(1 + surplus / ctx.mc) - 0.5 * ctx.urg + fomo;
      add('INVEST', u, town.byKind.bursa, surplus);
    }

    if (reflect && !p.retired && ctx.age >= 20 && ctx.age < 65 && p.bankruptUntil < w.day && p.manages < 0 && w.day - p.lastBizTry > 120) {
      const pick = LES.Finance.bestBizType(w, p, ctx);
      if (pick) {
        let u = -2.5 + BIAS.START_BIZ[s] + 1.3 * ctx.risk - 0.3 * ctx.pat + 0.25 * (pick.skill - 5)
          - 0.5 * p.bizFailures * (1 - (ctx.res + 1) / 2) + (p.ideaUntil > w.day ? 1.0 : 0);
        if (p.job) u -= 0.3 * Math.max(0, Math.log(p.job.salary / w.px(3000)));
        add('START_BIZ', u, LES.townNear(town, 'bank', p.homeId), pick, `Start a ${pick.type.name}`);
      }
    }

    if (p.manages >= 0 && canExert && p.energy >= 12) {
      const b = w.biz[p.manages];
      const u = 1.2 + BIAS.MANAGE_BIZ[s] + 0.4 * ctx.resp + 0.4 * ctx.dis - 1.2 * n.tired - 0.5 * n.stressed + (b.mgmt < 16 ? 0.6 : -0.6);
      add('MANAGE_BIZ', u, b.place, b, `Run ${b.name}`);
    }
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
        A.practice(w, p, j.w, 0.15);
        if (r.cat) A.catastrophe(w, p, j.w, `injured in a work accident as ${job.title}`);
        break;
      }
      case 'GIG': {
        const g = c.data;
        const r = A.taskRoll(w, p, g.w, g.diff, p.xp[g.cat], g.risk);
        const pay = w.px(g.pay * (r.ok ? 1 : 0.25) * w.macro().gigMult);
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
        (w.socialPools[`${slot}|${c.loc}`] = w.socialPools[`${slot}|${c.loc}`] || []).push(p.id);
        break;
      }
      case 'HEALTH':
        if (L.spend(p, 'cash', 'HEALTH', w.px(60))) { p.health += 12; p.stress -= 2; }
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
    }
    A.clampNeeds(p);
  };

  A.clampNeeds = function (p) {
    p.health = U.clamp(p.health, 0, 100);
    p.energy = U.clamp(p.energy, 0, 100);
    p.stress = U.clamp(p.stress, 0, 100);
    p.hunger = U.clamp(p.hunger, 0, 100);
  };

  // Plan and act both slots for one adult. Stores the plan (for the map) and the
  // probability table (for the "Why" panel).
  A.liveDay = function (w, p) {
    const ctx = A.context(w, p);
    p.plan = [];
    const why = [];
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
      A.resolve(w, p, chosen, ctx, slot);
      // sub = which job / gig / training, so the map can show movers vs indoor work.
      const sub = chosen.id === 'WORK' ? p.job && p.job.jobId : typeof chosen.data === 'string' ? chosen.data : chosen.data && typeof chosen.data.id === 'string' ? chosen.data.id : null;
      p.plan.push({ act: chosen.id, label: chosen.label, loc: chosen.loc, ok: chosen.ok, sub });
      // Raw candidates are kept; the Why panel sorts them only when it is shown.
      why.push({ chosen: chosen.label, act: chosen.id, forced, ok: chosen.ok, options: cands });
    }
    p.why = why;
  };
})(globalThis.LES = globalThis.LES || {});
