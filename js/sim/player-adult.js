// Play a Life, adults (PL-08): career, study, home and money, all through the engine's own systems.
// - ASK_RAISE: after 6 months in the job; the employer decides with the engine's yearly promotion chance
//   (Labour.yearClose: 0.04 + 0.3 x (performance - 0.6) + 0.025 x experience, capped 0.35, x the economy),
//   x1.5 for asking. Yes = one promotion (level +1, the usual raise); no = a little stress.
// - QUIT_JOB: Labour.endJob ('resigned').
// - ENROLL / DROP_OUT: Labour.enroll (real admission chance, limited places each year, fees or study loans
//   paid monthly) / Labour.dropOut. The course list follows the same rules as residents' own choices.
// - MOVE_HOME: heads of household only; a bigger home must be affordable (rent <= 40% of household income or
//   6 months of it in cash); a partner may say no. The household moves together (Finance.moveHome) and the
//   monthly review keeps the chosen home unless the rent truly cannot be paid.
// - INVEST / SELL: the real index fund (Finance.buy / sellFraction), keeping 2 months of costs in cash.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance, L = LES.Labour, Pl = LES.Player;
  const st = w => w.player;
  const perfOf = p => (p.job && p.job.perfN ? p.job.perfOk / p.job.perfN : 0.6);
  const household = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return [p].concat(q && q.alive && !q.away ? [q] : []); };
  const incomeOf = (w, p) => household(w, p).reduce((s, q) => s + Math.max(0, q.incomeEMA), 0);
  Pl.rentOf = (w, tier) => F.tierCost(w, 'housing', tier);

  // Courses this adult could apply for (residents' own rules, Actions.bestCourse), with fee and admission chance.
  Pl.courses = function (w, p) {
    const out = [];
    for (const c of C.COURSES) {
      if (p.quals.includes(c.id) || !C.expOn(w, c)) continue;
      if (c.prereq && !P.hasCred(p, c.prereq)) continue;
      if (c.id !== 'MASTER' && C.BACHELORS.includes(c.id) && p.quals.some(P.isBachelor)) continue;
      const chance = U.sigmoid((p.att[C.INT] - c.minInt) * 1.5);
      out.push({ id: c.id, name: c.name, months: c.months, fee: Math.round(w.px(c.fee) * w.derived.eduMult / c.months), chance });
    }
    return out.sort((a, b) => b.chance - a.chance);
  };

  Object.assign(Pl.HANDLERS, {
    ASK_RAISE: {
      hours: 2, cooldown: 180, adult: true, key: () => 'raise',
      check(w, p) { if (!p.job) return 'no_job'; if (p.job.fixedTitle) return 'in_office'; if (w.day - p.job.startDay < 180) return 'too_soon'; return p.job.level >= 5 ? 'top' : null; },
      run(w, p) {
        const job = p.job, R = Pl.rng(w), m = w.macro();
        const pr = U.clamp(0.04 + 0.3 * (perfOf(p) - 0.6) + 0.025 * p.xp[job.cat], 0.01, 0.35) * m.promoMult * 1.5;
        st(w).played = true;
        if (R.next() >= pr) { p.stress = Math.min(100, p.stress + 3); return { code: 'refused', params: { job: job.title } }; }
        job.level++;
        job.salary = Math.round(job.salary * L.promoRaise(w, C.JOB_BY_ID[job.jobId]) / 1000) * 1000;
        P.log(w, p, `Promoted to ${L.title(job)} (${U.fmtMoney(job.salary)}/mo) after asking`, 'career', 1);
        w.stats.promotions++;
        return { code: 'ok', params: { job: L.title(job), pay: U.fmtMoney(job.salary) } };
      },
    },
    QUIT_JOB: {
      hours: 1, cooldown: 0, adult: true, key: () => 'quit',
      check(w, p) { return !p.job ? 'no_job' : p.job.fixedTitle ? 'in_office' : null; },
      run(w, p) { const t = p.job.title; L.endJob(w, p, 'resigned'); st(w).quitDay = w.day; st(w).played = true; return { code: 'ok', params: { job: t } }; },
    },
    ENROLL: {
      hours: 4, cooldown: 30, adult: true, key: a => `course:${a.course}`,
      check(w, p, a) {
        if (p.enrol) return 'studying';
        const c = Pl.courses(w, p).find(x => x.id === a.course);
        if (!c) return 'not_eligible';
        return p.lastEnrollTry > w.day ? 'next_year' : null;
      },
      params(w, p, a) { const c = C.COURSE_BY_ID[a.course]; return { course: c ? c.name : a.course }; },
      run(w, p, a) {
        const c = C.COURSE_BY_ID[a.course], noPlace = w.stats.noPlace || 0;
        L.enroll(w, p, c);
        st(w).played = true;
        if (p.enrol && p.enrol.startDay === w.day) return { code: p.enrol.scholarship ? 'ok_scholar' : 'ok', params: { course: c.name, fee: U.fmtMoney(p.enrol.feeMonthly) } };
        return { code: (w.stats.noPlace || 0) > noPlace ? 'no_place' : 'rejected', params: { course: c.name } };
      },
    },
    DROP_OUT: {
      hours: 1, cooldown: 0, adult: true, key: () => 'dropout',
      check(w, p) { return p.enrol ? null : 'not_studying'; },
      run(w, p) { const c = C.COURSE_BY_ID[p.enrol.course]; L.dropOut(w, p, 'chose to leave'); st(w).played = true; return { code: 'ok', params: { course: c.name } }; },
    },
    MOVE_HOME: {
      hours: 6, cooldown: 60, adult: true, key: () => 'home',
      check(w, p, a) {
        const t = a.tier;
        if (!(t >= 0 && t <= 4)) return 'bad_args';
        if (!p.isHead) return 'not_head';
        if (t === p.tiers.housing) return 'same';
        if (!w.town.homesByTier[t] || !w.town.homesByTier[t].length) return 'none';
        const rent = Pl.rentOf(w, t);
        if (t > p.tiers.housing && rent > 0.4 * incomeOf(w, p) && p.cash < 6 * rent) return 'cant_afford';
        return null;
      },
      params(w, p, a) { return { home: C.TIERS.housing[a.tier] ? C.TIERS.housing[a.tier].name : '' }; },
      run(w, p, a) {
        const q = p.partnerId !== null ? w.people[p.partnerId] : null, R = Pl.rng(w), home = C.TIERS.housing[a.tier].name;
        if (q && q.alive && !q.away && P.isAdult(w, q)) { // the partner has a say
          const yes = a.tier > p.tiers.housing ? 0.55 + 0.3 * (q.pers.risk / 100) : 0.35 + 0.4 * (q.pers.resp / 100);
          if (R.next() >= yes) return { code: 'partner_no', params: { partner: P.name(q), home } };
        }
        F.moveHome(w, p, a.tier);
        for (const h of household(w, p)) h.mcost = F.monthlyCost(w, h);
        st(w).homeTier = a.tier; st(w).played = true;
        return { code: 'ok', params: { home, rent: U.fmtMoney(Pl.rentOf(w, a.tier)) } };
      },
    },
    INVEST: {
      hours: 1, cooldown: 7, adult: true, key: () => 'invest',
      check(w, p, a) { const amt = Math.round((p.cash - 2 * p.mcost) * (a.share || 0)); return !(a.share > 0 && a.share <= 1) ? 'bad_args' : amt < w.px(500) ? 'too_little' : null; },
      run(w, p, a) { const amt = Math.round((p.cash - 2 * p.mcost) * a.share); F.buy(w, p, 'idx', amt, 'saving (your choice)'); st(w).played = true; return { code: 'ok', params: { amt: U.fmtMoney(amt) } }; },
    },
    SELL: {
      hours: 1, cooldown: 7, adult: true, key: () => 'sell',
      check(w, p, a) { return !(a.share > 0 && a.share <= 1) ? 'bad_args' : P.invValue(w, p) <= 0 ? 'nothing' : null; },
      run(w, p, a) { const got = F.sellFraction(w, p, a.share, true, 'your choice'); st(w).played = true; return { code: 'ok', params: { amt: U.fmtMoney(got) } }; },
    },
  });

  // Monthly: notice a job loss (not a resignation) and the market's peak, for the events below.
  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive || !P.isAdult(w, p)) return;
    if (s.hadJob && !p.job && !(s.quitDay > w.day - 31)) s.jobLost = w.day;
    s.hadJob = !!p.job;
    s.idxPeak = Math.max(s.idxPeak || 0, w.mkt.idx);
  });

  // ---- Adult events: career, study, money, home ----
  const best = (w, p) => { const c = Pl.courses(w, p).find(x => x.chance > 0.3); return c ? { course: c.id } : null; };
  const voc = (w, p) => (Pl.courses(w, p).some(x => x.id === 'VOC') ? { course: 'VOC' } : null);
  Object.assign(Pl.CONDITIONS, {
    promotion: (w, p) => !!p.job && !p.job.fixedTitle && p.job.level < 5 && w.day - p.job.startDay > 300,
    jobLost: (w, p) => !p.job && st(w).jobLost > w.day - 45 && !p.retired,
    certify: (w, p) => !!p.job && !p.enrol && !p.quals.length && P.age(w, p) < 45 && !!voc(w, p),
    switchField: (w, p) => !!p.job && !p.enrol && P.age(w, p) < 45 && perfOf(p) < 0.6 && !!best(w, p),
    budget: (w, p) => p.incomeEMA > 0 && P.age(w, p) < 30,
    savings: (w, p) => p.cash > 6 * p.mcost && P.invValue(w, p) < p.cash * 0.2 && p.cash - 2 * p.mcost > w.px(500),
    downturn: (w, p) => P.invValue(w, p) > w.px(1000) && st(w).idxPeak > 0 && w.mkt.idx < 0.85 * st(w).idxPeak,
    shortCash: (w, p) => p.cash < 2 * p.mcost && P.invValue(w, p) > 3 * p.mcost,
    biggerHome: (w, p) => p.isHead && p.tiers.housing < 4 && (Pl.rentOf(w, p.tiers.housing + 1) <= 0.4 * incomeOf(w, p) || p.cash >= 6 * Pl.rentOf(w, p.tiers.housing + 1)),
    eveningCourse: (w, p) => !p.enrol && !p.quals.some(P.isBachelor) && P.age(w, p) >= 22 && P.age(w, p) < 50 && !!best(w, p),
  });
  Object.assign(Pl.PARAMS, {
    job: (w, p) => ({ job: p.job ? p.job.title : '' }),
    course: (w, p) => { const b = best(w, p), c = b && C.COURSE_BY_ID[b.course]; return { course: c ? c.name : '', job: p.job ? p.job.title : '' }; },
    home: (w, p) => { const t = Math.min(4, p.tiers.housing + 1); return { home: C.TIERS.housing[t].name, rent: U.fmtMoney(Pl.rentOf(w, t)) }; },
    money: (w, p) => ({ cash: U.fmtMoney(p.cash), inv: U.fmtMoney(P.invValue(w, p)) }),
  });
  Object.assign(Pl.TARGETS, {
    bestCourse: best, vocCourse: voc, raise: () => ({}), quit: () => ({}),
    invest10: () => ({ share: 0.1 }), invest25: () => ({ share: 0.25 }), sell25: () => ({ share: 0.25 }), sell50: () => ({ share: 0.5 }), sell60: () => ({ share: 0.6 }),
    homeUp: (w, p) => ({ tier: Math.min(4, p.tiers.housing + 1) }),
  });
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['adult'], minAge: 18, maxAge: 59, when, chance: 0.3, cooldown: 360, expires: 20, imp: 1, params: 'money', choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('AD-003', 'promotion', [cmd('apply', 'ASK_RAISE', 'raise'), cmd('skills', 'ENROLL', 'bestCourse'), story('stay')], { chance: 0.4, imp: 2, params: 'job' }),
    ev('AD-004', 'jobLost', [cmd('search', 'APPLY_JOB', 'typicalPay'), cmd('retrain', 'ENROLL', 'bestCourse'), story('pause')], { chance: 1, cooldown: 60, imp: 2, params: 'course' }),
    ev('AD-007', 'certify', [cmd('enroll', 'ENROLL', 'vocCourse'), story('funding'), story('defer')], { minAge: 20, params: 'job' }),
    ev('AD-008', 'switchField', [cmd('bridge', 'ENROLL', 'bestCourse'), cmd('apply', 'APPLY_JOB', 'bestPaid'), story('stay')], { chance: 0.25, params: 'course' }),
    ev('AD-021', 'budget', [cmd('rule', 'INVEST', 'invest10'), story('loose'), story('adviser')], { maxAge: 30, chance: 0.4, cooldown: 99999 }),
    ev('AD-022', 'shortCash', [cmd('six', 'SELL', 'sell50'), cmd('three', 'SELL', 'sell25'), story('debt')], { chance: 0.6, cooldown: 240, imp: 2 }),
    ev('AD-025', 'savings', [cmd('fund', 'INVEST', 'invest25'), story('bank'), story('avoid')], { chance: 0.35, cooldown: 540 }),
    ev('AD-026', 'downturn', [story('hold'), cmd('rebalance', 'SELL', 'sell25'), cmd('sell', 'SELL', 'sell60')], { chance: 0.8, cooldown: 300, imp: 2 }),
    ev('AD-061', 'biggerHome', [story('compare'), cmd('move', 'MOVE_HOME', 'homeUp'), story('stay')], { chance: 0.25, cooldown: 720, params: 'home' }),
    ev('AD-101', 'eveningCourse', [cmd('enroll', 'ENROLL', 'bestCourse'), story('audit'), story('self')], { chance: 0.2, cooldown: 720, params: 'course' }),
  );
})(globalThis.LES = globalThis.LES || {});
