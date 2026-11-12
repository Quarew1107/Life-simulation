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

    const lambda = w.cfg.vacancyRate * w.counts.adults / 100 / 30 * w.macro().vacMult * (w.boost ? w.boost.vac : 1) * (w.shock ? w.shock.vac : 1);
    const n = R.poisson(lambda);
    for (let i = 0; i < n; i++) {
      const j = C.JOBS[R.weighted(w.jobFreq || C.JOB_FREQ)];
      const spread = w.cfg.econModel === 'calibrated' ? L.offerSpread(w, R, j) : U.clamp(R.normal(1, 0.12), 0.7, 1.5); // pay within a job varies (log-normal)
      const salary = Math.round(w.px(j.salary * spread * w.macro().wageMult) / 1000) * 1000;
      const days = R.int(w.cfg.vacancyDaysMin, w.cfg.vacancyDaysMax);
      if (w.gov && LES.Services.PUBLIC_JOBS.has(j.id)) { R.pick(LES.World.sitesFor(w, j)); continue; } // the town and private employers post these
      if (w.sys.jobOk.length && !w.sys.jobOk.every(s => s.jobOk(w, j))) { R.pick(LES.World.sitesFor(w, j)); continue; } // e.g. automated away (scenarios)
      w.vacancies.push({ id: w.nextVacId++, job: j, salary, openDay: day, closeDay: day + days, applicants: [], appSet: new Set(), place: R.pick(LES.World.sitesFor(w, j)) });
      w.stats.vacOpened++;
    }
    // Best-paid first (stable by id): job seekers read the top of the listings.
    if (n) w.vacancies.sort((a, b) => (b.salary - a.salary) || (a.id - b.id));
  };

  // FSD 6.2: qualification is the only gate; best weighted score wins.
  L.PAY_SD = 0.35; L.PAY_MID = 0.85; // spread and middle of pay offers within a job (calibrated markets; people move to the better offers)
  // Rules revision 6 (Nov 2026): jobs that need no qualification have a lower ceiling. Before, the ablest
  // workers collected the top offers (up to 2.04x base pay) and four promotions of +12% (x1.57), so a rider
  // could earn ~3.2x base (China: ~17k a month). Now their offers spread less (sd at most 0.35, at most 1.6x
  // the middle offer, which is 0.95x base so typical pay stays near the official medians) and each promotion
  // adds 6%: at most ~1.9x base. Skilled jobs are unchanged.
  L.PAY_REV = 6; L.PAY_MID_LOW = 0.95;
  L.unskilled = (w, j) => w.cfg.rulesRev >= L.PAY_REV && !!j && !j.req;
  // A pay offer as a multiple of the job's base pay (calibrated markets). One normal draw either way.
  L.offerSpread = function (w, R, j) {
    const low = L.unskilled(w, j);
    return (low ? L.PAY_MID_LOW : L.PAY_MID) * U.clamp(Math.exp(R.normal(0, low ? Math.min(L.paySd(), 0.35) : L.paySd())), 0.5, low ? 1.6 : 2.4);
  };
  L.promoRaise = (w, j) => (L.unskilled(w, j) ? 1.06 : 1.12); // pay rise of one promotion
  L.award = function (w, v) {
    const hw = w.cfg.hiringWeights, seen = new Set(), cands = [];
    if (w.cfg.econModel === 'calibrated' && v.applicants.length && w.rng.jobs.next() < L.outsideHire()) { w.stats.vacOutside = (w.stats.vacOutside || 0) + 1; return; } // a commuter or newcomer from outside gets it
    for (const id of v.applicants) {
      if (seen.has(id)) continue;
      seen.add(id);
      const p = w.people[id];
      if (!P.isAdult(w, p) || p.away || p.inst || p.retired || !P.hasCred(p, v.job.req)) continue;
      if (p.job && (p.job.salary >= v.salary || p.job.fixedTitle)) continue; // council officials stay in post
      const a = U.clamp(LES.Actions.attrScore(p, v.job.w) / 10, 0, 1);
      const e = U.clamp(p.xp[v.job.cat] / 5, 0, 1);
      const q = U.clamp(P.extraQuals(p, v.job.req) / 2, 0, 1);
      const referral = p.netMonth > 0 ? 0.04 : 0; // contacts made at the golf club / lounge
      const fit = v.job.pref && p.specs && v.job.pref.some(s => p.specs.VOC === s || p.specs.MASTER === s) ? 0.05 : 0; // Expansion 1: the right specialisation helps a little
      const hm = w.sys.hireWeight.length ? w.sysMul('hireWeight', p, v) : 1; // e.g. a criminal record
      cands.push({ p, score: (hw[0] * a + hw[1] * e + hw[2] * q + referral + fit) * hm, tie: w.rng.jobs.next() });
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
    if (v.biz >= 0) p.job.biz = v.biz; // works for a resident's business, which pays the wage
    if (v.commuteTo !== undefined) { p.job.commuteTo = v.commuteTo; p.job.commuteName = v.commuteName; } // works in a sister town
    p.retired = false;
    const others = nApplicants > 1 ? ` (beat ${nApplicants - 1} other applicant${nApplicants > 2 ? 's' : ''})` : '';
    P.log(w, p, old
      ? `Switched from ${old.title} to ${v.job.title} at ${U.fmtMoney(v.salary)}/mo${others}`
      : `Hired as ${v.job.title} at ${U.fmtMoney(v.salary)}/mo${others}`,
    'career', v.salary >= w.px(6000) ? 1 : 0);
    w.stats.hires++;
  };

  L.title = job => (job.fixedTitle ? job.title : C.LEVEL_PREFIX[Math.min(job.level, C.LEVEL_PREFIX.length - 1)] + job.title);

  // Pay attended shifts (capped at the monthly target) with EPF contributions.
  L.payJob = function (w, p, job) {
    const target = w.cfg.shiftsPerMonth;
    const paid = Math.min(job.shiftsMonth, target);
    const gross = Math.round(job.salary * paid / target);
    if (gross > 0) {
      const inPlan = RET.participation === undefined || ((p.id * 2654435761 >>> 0) % 1000) / 1000 < RET.participation; // US: about half of workers save in a 401(k)
      const ee = inPlan ? Math.round(gross * RET.employee) : 0, er = inPlan ? Math.round(gross * RET.employer) : 0;
      const b = job.biz >= 0 ? w.biz[job.biz] : null; // private clinic, school or hospital
      if (b && b.open && b.cash >= gross + er) {
        w.ledger.move(b, 'cash', p, 'cash', gross - ee);
        w.ledger.move(b, 'cash', p, 'epf', ee + er);
        LES.Finance.retireIn(w, p, ee + er);
        b.payrollNow = (b.payrollNow || 0) + gross + er;
      } else {
        w.ledger.pay('EMPLOYER', p, 'cash', gross - ee);
        w.ledger.pay('EMPLOYER', p, 'epf', ee + er);
        LES.Finance.retireIn(w, p, ee + er);
      }
      let tax;
      if (w.gov) tax = LES.Fiscal.onPay(w, p, job, gross, er); // LHDN PCB and EIS; the treasury pays public servants
      else { tax = L.incomeTax(w, gross - ee); w.ledger.spend(p, 'cash', 'TAX', tax); }
      p.earned.wages += gross + er;
      p.monthIncome += gross - ee - tax;
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
    if (w.gov && reason === 'retired' && LES.Services.lineOf(job)) LES.Council.onRetire(w, p, job); // civil-service pension
    if (silent) return;
    const bad = reason === 'fired' || reason === 'laid off';
    P.log(w, p, bad ? `${reason === 'fired' ? 'Fired' : 'Laid off'} from ${job.title} job` : `Left ${job.title} job (${reason})`, 'career', bad ? 1 : 0);
    if (bad) {
      if (w.gov && reason === 'laid off') LES.Council.onJobLoss(w, p, job); // EIS job-loss benefit
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

  // Expansion 1: the subject of a vocational certificate or master's degree, picked without dice (a fixed
  // hash of who and when) by the design weights times ability fit, so no random stream moves.
  L.giveSpec = function (w, p, q) {
    const list = C.SPECS[q];
    if (!list || (p.specs && p.specs[q])) return null;
    if (q === 'MASTER') { // the subject has to follow from the first degree
      const has = d => p.quals.includes(d), ok = { MAST_RESEARCH: has('BACH_SCI') || has('BACH_ENG') || has('MED') || has('BACH_PHARM') || has('BACH_GEN'), MAST_DATA: has('BACH_CS') || has('BACH_ENG') || has('BACH_BUS') || has('BACH_SCI'), MAST_MBA: true };
      list.forEach(x => { x._ok = ok[x.id]; });
    } else list.forEach(x => { x._ok = true; });
    const wts = list.map(x => (x._ok ? x.weight * Math.max(0.2, LES.Actions.attrScore(p, x.w) - 3) : 0));
    let h = Math.imul((p.id + 1) ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul(w.day + 7, 0x85ebca6b) ^ (q === 'VOC' ? 0x1234 : 0x4321);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    let r = ((h >>> 0) / 4294967296) * U.sum(wts), k = 0;
    while (k < wts.length - 1 && (r -= wts[k]) >= 0) k++;
    p.specs = p.specs || {};
    p.specs[q] = list[k].id;
    return list[k];
  };

  L.graduate = function (w, p, course) {
    p.quals.push(course.id);
    const years = ((w.day - p.enrol.startDay) / 365).toFixed(1);
    if (p.enrol.spec) (p.specs = p.specs || {})[course.id] = p.enrol.spec;
    p.enrol = null;
    P.log(w, p, `Graduated: ${p.specs && p.specs[course.id] ? P.qualName(p, course.id) : course.name} after ${years} years`, 'edu', 1);
    w.stats.graduations++;
  };

  // Rules revision 4 (C06): limited places. Each year a course group (bachelor's, master's, vocational) opens
  // pack education.places[group] x (residents aged 18) places, kept as fractional credits (at most two years'
  // worth); an accepted applicant takes one, or waits for next year. Scenarios built to be atypical are exempt.
  const GROUP = id => (id === 'VOC' ? 'voc' : id === 'MASTER' ? 'master' : 'bach');
  L.placesOn = w => w.cfg.rulesRev >= 4 && !!(LES.Countries.pack.education || {}).places && !((LES.Scenarios && LES.Scenarios.current(w)) || {}).noEduPlaces;
  L.places = function (w) {
    const PL = LES.Countries.pack.education.places, yr = Math.floor(w.day / 365), st = w.eduPlaces = w.eduPlaces || { year: -1, credit: {}, cohort: 0 };
    if (st.year !== yr) {
      st.year = yr;
      st.cohort = w.living.filter(q => q.alive && !q.away && P.age(w, q) >= 18 && P.age(w, q) < 25).length / 7; // an average one-year cohort of 18-24s
      for (const k of Object.keys(PL)) st.credit[k] = Math.min((st.credit[k] || 0) + PL[k] * st.cohort, Math.max(2, 2 * PL[k] * st.cohort));
    }
    return st;
  };
  L.takePlace = function (w, course, p) {
    const g = GROUP(course.id), st = L.places(w);
    if (!(g in st.credit)) return true;
    const need = g === 'master' || P.age(w, p) < 25 ? 1 : 2; // school leavers first: older applicants only when places are spare
    if (st.credit[g] >= need) { st.credit[g] -= 1; return true; }
    return false;
  };
  const nextCycle = w => (Math.floor(w.day / 365) + 1) * 365 - 61; // (the 60-day wait in Actions then ends as the next year opens)
  L.enroll = function (w, p, course) {
    const R = w.rng.outcome;
    p.lastEnrollTry = w.day;
    p.energy -= 8;
    const EB = w.cfg.rulesRev >= 4 ? (LES.Countries.pack.education || {}).admitBar : undefined; // C06: each country's entry bar (places do the rationing)
    const bar = (w.gov && course.id !== 'VOC' ? (EB !== undefined ? EB : 1.0) : 0) + (LES.China && LES.China.on() ? LES.China.examBar(w, p, course) : 0); // public university places are competitive (UPU, gaokao)
    const acc = U.sigmoid((p.att[C.INT] - course.minInt - bar) * 1.5);
    const cycle = L.placesOn(w); // rules revision 4: one admission round a year
    if (R.next() >= acc) {
      P.log(w, p, `Application to ${course.name} rejected`, 'edu', 0);
      if (cycle) p.lastEnrollTry = Math.max(p.lastEnrollTry, nextCycle(w));
      return;
    }
    if (cycle && !L.takePlace(w, course, p)) { P.log(w, p, `Offered no place on ${course.name} this year (all taken)`, 'edu', 0); w.stats.noPlace = (w.stats.noPlace || 0) + 1; p.lastEnrollTry = Math.max(p.lastEnrollTry, nextCycle(w)); return; }
    const scholar = w.derived.eduMult > 0 && R.next() < U.clamp(0.04 + 0.05 * (p.att[C.INT] - 6), 0, 0.4);
    let fee = scholar ? 0 : Math.round(w.px(course.fee) * w.derived.eduMult / course.months);
    const PG = LES.Countries.pack.education && LES.Countries.pack.education.pell; // US: Pell grants for low-income students
    if (PG && fee > 0 && course.id !== 'MASTER') { let inc = Math.max(0, p.incomeEMA); for (const id of p.parents) { const q = w.people[id]; if (q && q.alive) inc += Math.max(0, q.incomeEMA); }
      if (inc / w.price / 100 * 12 < PG.incomeLimit) fee = Math.max(0, fee - w.px(PG.max / 12)); }
    p.enrol = { course: course.id, startDay: w.day, progress: 0, scholarship: scholar, feeMonthly: fee, monthsPaid: 0 };
    let title = course.name;
    if (w.cfg.rulesRev >= C.EXPANSION_REV && C.SPECS[course.id]) { // Expansion 1: choose the subject; its fee differs a little
      const held = p.specs && p.specs[course.id], sp = L.giveSpec(w, p, course.id);
      if (sp) { p.enrol.spec = sp.id; delete p.specs[course.id]; if (held) p.specs[course.id] = held; p.enrol.feeMonthly = Math.round(fee * sp.fee); title = course.id === 'VOC' ? `${course.name} (${sp.name})` : sp.name; }
    }
    P.log(w, p, `Enrolled in ${title}${scholar ? ' with a full scholarship!' : ''}`, 'edu', scholar ? 1 : 0);
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
        if (R.next() < m.layoff * (1.6 - perf) * (w.shock ? w.shock.layoff : 1) && !(w.gov && LES.Services.lineOf(job))) { L.endJob(w, p, 'laid off'); continue; } // public servants are not laid off by the business cycle
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
      const SL = LES.Countries.pack.education && LES.Countries.pack.education.loans; // UK: the Student Loans Company pays every fee
      if (!SL && p.cash < fee + p.mcost) LES.Finance.useWellbeing(w, p, fee + p.mcost - p.cash, 'study fees'); // rev 9 Malaysia
      if (SL || p.cash < fee + p.mcost) {
        if (!SL && p.bankruptUntil >= w.day) { L.dropOut(w, p, 'could not pay fees'); return; }
        Ld.pay('BANK', p, 'cash', fee); // PTPTN-style study loan
        p.debt.study += fee; p.debt.studyOrig += fee;
        if (SL && p.debt.slStart === undefined) p.debt.slStart = w.day;
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
          job.salary = Math.round(job.salary * L.promoRaise(w, C.JOB_BY_ID[job.jobId]) / 1000) * 1000;
          P.log(w, p, `Promoted to ${L.title(job)} (${U.fmtMoney(job.salary)}/mo)`, 'career', job.salary >= w.px(10000) ? 1 : 0);
          w.stats.promotions++;
        }
        job.perfOk = 0; job.perfN = 0;
      }
      const cnRet = LES.China && LES.China.on(), ra = cnRet ? LES.China.retireAge(w, p) : 60; // China: the 2025 reform's ages
      if (age >= ra && !p.retired && !(w.flags && w.flags.noRetire)) {
        const pRet = cnRet ? (!job || job.si ? 1 : 0.3 + 0.15 * (age - ra)) : age >= 70 ? 1 : 0.2 + 0.15 * (age - 60); // (jobs with social insurance end at the statutory age)
        if (R.next() < pRet) {
          p.retired = true;
          if (p.job) L.endJob(w, p, 'retired');
          P.log(w, p, `Retired at age ${Math.floor(age)}`, 'career', 0);
        }
      }
    }
  };

  // Retirement contributions (Malaysia: EPF 11% from the worker, 13% from the employer) from the country pack.
  let RET = null, LAB = null;
  L.paySd = () => (LAB && LAB.paySd) || L.PAY_SD; // (pack labour.paySd: the US spreads pay more)
  L.outsideHire = () => (LAB && LAB.outsideHire !== undefined ? LAB.outsideHire : 0.3); // share of openings that go to someone from outside town (pack labour.outsideHire)
  LES.Countries.require('retirement.employee', 'retirement.employer', 'retirement.accessAge');
  LES.Countries.on('labour', K => { RET = K.retirement; LAB = K.labour || null; });
})(globalThis.LES = globalThis.LES || {});
