// Jobs and education: vacancies (open 3-30 days), employer selection, payroll for
// 20 x 7.2h shifts on distinct days, compliance, promotions, retirement, courses.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const L = LES.Labour = {};

  L.dailyMarket = function (w) {
    const R = w.rng.jobs, day = w.day;
    const still = [];
    for (const v of w.vacancies) {
      if (v.closeDay <= day) L.award(w, v);
      else still.push(v);
    }
    w.vacancies = still;

    const lambda = w.cfg.vacancyRate * w.counts.adults / 100 / 30 * w.macro().vacMult;
    const n = R.poisson(lambda);
    for (let i = 0; i < n; i++) {
      const j = C.JOBS[R.weighted(C.JOB_FREQ)];
      const salary = Math.round(w.px(j.salary * U.clamp(R.normal(1, 0.12), 0.7, 1.5) * w.macro().wageMult) / 1000) * 1000;
      const days = R.int(w.cfg.vacancyDaysMin, w.cfg.vacancyDaysMax);
      w.vacancies.push({ id: w.nextVacId++, job: j, salary, openDay: day, closeDay: day + days, applicants: [], appSet: new Set(), place: R.pick(w.town.kinds[j.place]) });
      w.stats.vacOpened++;
    }
    // Best-paid first (stable by id): job seekers read the top of the listings.
    if (n) w.vacancies.sort((a, b) => (b.salary - a.salary) || (a.id - b.id));
  };

  // FSD 6.2: qualification is the only gate; best weighted score wins.
  L.award = function (w, v) {
    const hw = w.cfg.hiringWeights, seen = new Set(), cands = [];
    for (const id of v.applicants) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = w.people[id];
      if (!P.isAdult(w, p) || p.away || p.inst || p.retired || !P.hasCred(p, v.job.req)) continue;
      if (p.job && p.job.salary >= v.salary) continue;
      const a = U.clamp(LES.Actions.attrScore(p, v.job.w) / 10, 0, 1);
      const e = U.clamp(p.xp[v.job.cat] / 5, 0, 1);
      const q = U.clamp(P.extraQuals(p, v.job.req) / 2, 0, 1);
      const referral = p.netMonth > 0 ? 0.04 : 0; // contacts made at the golf club / lounge
      const hm = w.sys.hireWeight.length ? w.sysMul('hireWeight', p, v) : 1; // e.g. a criminal record
      cands.push({ p, score: (hw[0] * a + hw[1] * e + hw[2] * q + referral) * hm, tie: w.rng.jobs.next() });
    }
    if (!cands.length) { w.stats.vacUnfilled++; return; }
    cands.sort((x, y) => (y.score - x.score) || (y.tie - x.tie) || (x.p.id - y.p.id));
    L.hire(w, cands[0].p, v, cands.length);
  };

  L.hire = function (w, p, v, nApplicants) {
    const old = p.job;
    if (old) L.payJob(w, p, old);
    const salary = w.policy ? Math.max(v.salary, w.px(w.policy.minWage)) : v.salary; // minimum wage law
    p.job = {
      jobId: v.job.id, title: v.job.title, salary, level: 1, startDay: w.day, shiftsMonth: 0,
      lastShiftDay: -1, warnings: 0, place: v.place, perfOk: 0, perfN: 0, cat: v.job.cat,
    };
    p.retired = false;
    const others = nApplicants > 1 ? ` (beat ${nApplicants - 1} other applicant${nApplicants > 2 ? 's' : ''})` : '';
    P.log(w, p, old
      ? `Switched from ${old.title} to ${v.job.title} at ${U.fmtMoney(v.salary)}/mo${others}`
      : `Hired as ${v.job.title} at ${U.fmtMoney(v.salary)}/mo${others}`,
    'career', v.salary >= w.px(6000) ? 1 : 0);
    w.stats.hires++;
  };

  L.title = job => C.LEVEL_PREFIX[Math.min(job.level, C.LEVEL_PREFIX.length - 1)] + job.title;

  // Pay attended shifts (capped at the monthly target) with EPF contributions.
  L.payJob = function (w, p, job) {
    const target = w.cfg.shiftsPerMonth;
    const paid = Math.min(job.shiftsMonth, target);
    const gross = Math.round(job.salary * paid / target);
    if (gross > 0) {
      const ee = Math.round(gross * 0.11), er = Math.round(gross * 0.13);
      w.ledger.pay('EMPLOYER', p, 'cash', gross - ee);
      w.ledger.pay('EMPLOYER', p, 'epf', ee + er);
      const tax = L.incomeTax(w, gross - ee);
      w.ledger.spend(p, 'cash', 'TAX', tax);
      p.earned.wages += gross + er;
      p.monthIncome += gross - ee - tax;
      if (w.gov && C.JOB_BY_ID[job.jobId].gov) w.gov.month.wages += gross + er; // the treasury pays public servants
    }
    job.shiftsMonth = 0;
  };

  // Progressive monthly income tax (sen in, sen out).
  // Bands are in Year-1 RM and move with the price level (no bracket creep).
  L.incomeTax = function (w, sen) {
    const g = sen / 100 / w.price;
    let tax = 0, lo = 0;
    for (const [hi, rate] of C.TAX_BANDS) {
      if (g > lo) tax += (Math.min(g, hi) - lo) * rate;
      lo = hi;
    }
    return Math.round(U.RM(tax) * w.price * (w.policy ? w.policy.incomeTaxMult : 1));
  };

  L.endJob = function (w, p, reason, silent) {
    const job = p.job;
    if (!job) return;
    L.payJob(w, p, job);
    p.job = null;
    if (silent) return;
    const bad = reason === 'fired' || reason === 'laid off';
    P.log(w, p, bad ? `${reason === 'fired' ? 'Fired' : 'Laid off'} from ${job.title} job` : `Left ${job.title} job (${reason})`, 'career', bad ? 1 : 0);
    if (bad) {
      p.stress = Math.min(100, p.stress + 15);
      p.pendingReview = reason === 'fired' ? 'being fired' : 'being laid off';
      w.stats[reason === 'fired' ? 'fired' : 'laidOff']++;
    }
  };

  L.study = function (w, p, course) {
    const e = p.enrol;
    const r = LES.Actions.taskRoll(w, p, course.w, course.diff, 0, null);
    e.progress += r.ok ? 1 : 0.4;
    LES.Actions.improve(w, p, C.INT, r.ok ? 0.25 : 0.1);
    p.yr.mental++;
    p.energy -= 18; p.stress += 3;
    if (e.progress >= course.months * 12) L.graduate(w, p, course);
  };

  L.graduate = function (w, p, course) {
    p.quals.push(course.id);
    const years = ((w.day - p.enrol.startDay) / 365).toFixed(1);
    p.enrol = null;
    P.log(w, p, `Graduated: ${course.name} after ${years} years`, 'edu', 1);
    w.stats.graduations++;
  };

  L.enroll = function (w, p, course) {
    const R = w.rng.outcome;
    p.lastEnrollTry = w.day;
    p.energy -= 8;
    const acc = U.sigmoid((p.att[C.INT] - course.minInt) * 1.5);
    if (R.next() >= acc) {
      P.log(w, p, `Application to ${course.name} rejected`, 'edu', 0);
      return;
    }
    const scholar = w.derived.eduMult > 0 && R.next() < U.clamp(0.04 + 0.05 * (p.att[C.INT] - 6), 0, 0.4);
    const fee = scholar ? 0 : Math.round(w.px(course.fee) * w.derived.eduMult / course.months);
    p.enrol = { course: course.id, startDay: w.day, progress: 0, scholarship: scholar, feeMonthly: fee, monthsPaid: 0 };
    P.log(w, p, `Enrolled in ${course.name}${scholar ? ' with a full scholarship!' : ''}`, 'edu', scholar ? 1 : 0);
    if (scholar) w.stats.scholarships++;
  };

  L.monthClose = function (w) {
    const R = w.rng.jobs, m = w.macro(), date = w.date, target = w.cfg.shiftsPerMonth;
    for (const p of w.living) {
      if (!p.alive) continue;
      const job = p.job;
      if (job) {
        const shifts = job.shiftsMonth;
        const perf = job.perfN ? job.perfOk / job.perfN : 0.7;
        L.payJob(w, p, job);
        const newHire = job.startDay > w.day - date.dom;
        const excused = newHire || p.injuredUntil > w.day - 30 || p.health < 30;
        if (shifts < target && !excused) {
          job.warnings++;
          if (job.warnings >= 3) { L.endJob(w, p, 'fired'); continue; }
        } else if (shifts >= target) {
          job.warnings = Math.max(0, job.warnings - 1);
        }
        if (R.next() < m.layoff * (1.6 - perf)) { L.endJob(w, p, 'laid off'); continue; }
        // Voluntary quits: stressed, impatient people sometimes walk out.
        const quit = 0.002 + 0.012 * Math.max(0, p.stress - 60) / 40 * (1.3 - p.pers.pat / 100);
        if (R.next() < quit) { L.endJob(w, p, p.stress > 70 ? 'burnt out' : 'resigned'); continue; }
      }
      if (p.enrol) L.enrolMonth(w, p);
    }
  };

  L.enrolMonth = function (w, p) {
    const e = p.enrol, course = C.COURSE_BY_ID[e.course], Ld = w.ledger;
    if (e.feeMonthly > 0 && e.monthsPaid < course.months) {
      const fee = e.feeMonthly;
      if (p.cash < fee + p.mcost) {
        if (p.bankruptUntil >= w.day) { L.dropOut(w, p, 'could not pay fees'); return; }
        Ld.pay('BANK', p, 'cash', fee); // PTPTN-style study loan
        p.debt.study += fee; p.debt.studyOrig += fee;
      }
      if (!Ld.spend(p, 'cash', 'EDUCATION', fee)) { L.dropOut(w, p, 'could not pay fees'); return; }
      e.monthsPaid++;
    }
    const monthsIn = (w.day - e.startDay) / 30.4;
    if (monthsIn > course.months * 2.5) { L.dropOut(w, p, 'took too long'); return; }
    const behind = (monthsIn * 12 - e.progress) / 12; // months behind schedule
    if (behind > 3 && w.rng.outcome.next() < 0.03 * (1.5 - p.pers.dis / 100) * Math.min(3, behind / 3)) L.dropOut(w, p, 'fell behind');
  };

  L.dropOut = function (w, p, why) {
    const course = C.COURSE_BY_ID[p.enrol.course];
    p.enrol = null;
    P.log(w, p, `Dropped out of ${course.name} (${why})`, 'edu', 1);
    p.stress = Math.min(100, p.stress + 15);
    p.pendingReview = 'dropping out';
    w.stats.dropouts++;
  };

  L.yearClose = function (w) {
    const R = w.rng.jobs, m = w.macro();
    for (const p of w.living) {
      if (!p.alive || !P.isAdult(w, p)) continue;
      const age = P.age(w, p);
      const job = p.job;
      if (job) {
        // Wages only partly follow inflation each year: real pay can erode.
        job.salary = Math.round(job.salary * (1 + w.infl * R.range(0.4, 1.0)));
        const perf = job.perfN ? job.perfOk / job.perfN : 0.5;
        const pr = U.clamp(0.04 + 0.3 * (perf - 0.6) + 0.025 * p.xp[job.cat], 0.01, 0.35) * m.promoMult;
        if (job.level < 5 && w.day - job.startDay > 300 && R.next() < pr) {
          job.level++;
          job.salary = Math.round(job.salary * 1.12 / 1000) * 1000;
          P.log(w, p, `Promoted to ${L.title(job)} (${U.fmtMoney(job.salary)}/mo)`, 'career', job.salary >= w.px(10000) ? 1 : 0);
          w.stats.promotions++;
        }
        job.perfOk = 0; job.perfN = 0;
      }
      if (age >= 60 && !p.retired) {
        const pRet = age >= 70 ? 1 : 0.2 + 0.15 * (age - 60);
        if (R.next() < pRet) {
          p.retired = true;
          if (p.job) L.endJob(w, p, 'retired');
          P.log(w, p, `Retired at age ${Math.floor(age)}`, 'career', 0);
        }
      }
    }
  };
})(globalThis.LES = globalThis.LES || {});
