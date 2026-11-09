// The city council's officials (part of the government system; inert without it).
// The elected leader appoints three officials. Each is a resident with a real job, a
// competence score (from their abilities, training and character) and an integrity
// score. Only roles that change what happens in the simulation exist:
//
// - Bendahari Bandaraya (City Treasurer): how much tax is actually collected (evasion),
//   how well development money is spent (waste), and each year's budget split.
// - Ketua Polis Daerah (District Police Chief, a senior police officer): how many cases
//   are solved and how hard gangs are pushed. A corrupt chief takes gang money.
// - Pengarah Pembangunan Masyarakat (Community Development Director): whether cash aid
//   reaches the right families, job-loss benefit, and training places for the unemployed.
//
// Leaders who care less about responsibility favour relatives and their own community
// over the most able (cronyism). Corrupt officials can be caught by the anti-corruption
// commission. Every appointment and decision goes into the council log (Gov't tab).
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const CO = LES.Council = {};

  CO.ROLES = {}; // gov.council of the country pack: title, English title, what the post does
  CO.ORDER = ['treasurer', 'police', 'community'];
  CO.TRAIN_COST = 500;   // per trainee per month, Year-1 money (gov.trainCost; Malaysia: HRD Corp-style courses)
  CO.TRAIN_MONTHS = 4;
  const PROJECTS = ['road resurfacing', 'drainage and flood mitigation', 'street lighting', 'a new bus route', 'park upgrades', 'covered walkways', 'a market hall renovation', 'public Wi-Fi', 'a community library corner', 'river clean-up'];

  const off = (w, role) => (w.gov && w.gov.officials ? w.gov.officials[role] : null);
  CO.comp = (w, role) => { const o = off(w, role); return o ? o.comp : 0.35; }; // vacant: the clerks muddle through
  CO.official = off;
  CO.name = (w, o) => (!o ? 'vacant' : o.id >= 0 ? P.name(w.people[o.id]) : o.name);
  CO.log = function (w, role, pid, text) {
    const g = w.gov;
    g.offLog.push({ day: w.day, role, pid, text });
    if (g.offLog.length > 150) g.offLog.shift();
  };

  function competence(w, p, role) {
    const a = p.att, pr = p.pers, deg = p.quals.some(P.isBachelor) ? 1 : 0;
    let c;
    if (role === 'treasurer') c = 0.3 * a[C.INT] / 10 + 0.15 * a[C.PER] / 10 + 0.15 * (p.quals.includes('BACH_BUS') ? 1 : 0.5 * deg) + 0.1 * Math.min(1, (p.xp.office + p.xp.business) / 8) + 0.15 * pr.dis / 100 + 0.15 * pr.resp / 100;
    else if (role === 'police') c = 0.2 * ((p.job ? p.job.level : 1) - 1) / 4 + 0.2 * a[C.PER] / 10 + 0.15 * a[C.INT] / 10 + 0.1 * Math.min(1, (w.day - (p.job ? p.job.startDay : w.day)) / 3650) + 0.2 * pr.resp / 100 + 0.15 * pr.dis / 100;
    else c = 0.25 * a[C.CHA] / 10 + 0.2 * a[C.INT] / 10 + 0.1 * deg + 0.25 * pr.resp / 100 + 0.2 * pr.pat / 100;
    return U.clamp(c, 0.05, 1);
  }
  const integrity = p => U.clamp((0.6 * p.pers.resp + 0.4 * p.pers.dis) / 100, 0, 1);
  const usable = (w, p) => p && p.alive && p.adult && !p.away && !p.inst;

  function pool(w, role) {
    const g = w.gov, taken = new Set(Object.values(g.officials).filter(Boolean).map(o => o.id));
    return w.living.filter(p => {
      if (!usable(w, p) || p.id === g.president || (p.cr && p.cr.rec) || p.retired) return false;
      const age = P.age(w, p);
      if (age < 26 || age > 64) return false;
      if (role === 'police') return p.job && p.job.jobId === 'police' && !(p.job.biz >= 0) && w.day - p.job.startDay > 365;
      if (taken.has(p.id) && !(g.officials[role] && g.officials[role].id === p.id)) return false;
      return P.hasCred(p, 'BACH');
    });
  }

  // The leader chooses: ability, plus loyalty for leaders who care less about merit.
  function choose(w, role, R) {
    const g = w.gov, pres = g.president >= 0 ? w.people[g.president] : null, cur = g.officials[role];
    const crony = pres ? 0.5 * (1 - pres.pers.resp / 100) : 0;
    let best = null, bestS = -Infinity;
    for (const p of pool(w, role)) {
      const c = competence(w, p, role);
      let loyal = 0;
      if (pres) loyal = (p.id === pres.partnerId || LES.Family.related(w, p, pres) ? 1 : 0) + (p.eth === pres.eth ? 0.3 : 0) + (p.rel && p.rel === pres.rel ? 0.15 : 0);
      const s = c + crony * loyal + (cur && cur.id === p.id ? 0.08 : 0) + R.normal(0, 0.06);
      if (s > bestS) { bestS = s; best = { p, c, loyal }; }
    }
    return best;
  }

  const salaryFor = (w, role) => {
    const avg = LES.Fiscal.avgRevenue(w);
    return role === 'treasurer' ? U.clamp(Math.round(avg * 0.015 / 100000) * 100000, w.px(3500), w.px(15000)) : U.clamp(Math.round(avg * 0.012 / 100000) * 100000, w.px(3000), w.px(12000));
  };

  function remove(w, role, why) {
    const g = w.gov, o = g.officials[role];
    if (!o) return;
    g.officials[role] = null;
    if (o.id < 0) return;
    const p = w.people[o.id];
    if (role === 'police') { if (p.job && p.job.jobId === 'police') { p.job.title = 'Police Officer'; p.job.fixedTitle = false; } }
    else if (usable(w, p) && p.job && p.job.jobId === role) LES.Labour.endJob(w, p, why === 'replaced' ? `replaced as ${CO.ROLES[role].en.toLowerCase()}` : why, false);
    if (p.alive) P.log(w, p, `No longer ${CO.ROLES[role].title} (${why})`, 'politics', 1);
  }

  function appoint(w, role, R) {
    const g = w.gov, pick = choose(w, role, R);
    const pres = g.president >= 0 ? w.people[g.president] : null;
    if (!pick) {
      if (role === 'police') { // no senior officer in town: one is posted in from outside
        const eth = R.pick(LES.Countries.pack.gov.officialGroups), N = C.namesFor(w)[eth];
        g.officials.police = { id: -1, name: `Supt. ${R.pick(N.M)} ${R.pick(N.last)}`, comp: U.clamp(R.normal(0.5, 0.1), 0.25, 0.8), integrity: U.clamp(R.normal(0.65, 0.15), 0.2, 1), since: w.day, crony: false };
        CO.log(w, 'police', -1, `${g.officials.police.name} was posted in from outside as ${CO.ROLES.police.title}`);
      }
      return;
    }
    const p = pick.p, o = { id: p.id, comp: pick.c, integrity: integrity(p), since: w.day, crony: pick.loyal >= 1 && pick.c < 0.55 };
    if (role === 'police') {
      p.job.title = CO.ROLES.police.title; p.job.fixedTitle = true;
      p.job.salary = Math.max(p.job.salary, salaryFor(w, 'community'));
    } else if (!(p.job && p.job.jobId === role)) {
      const j = C.GOV_JOBS[role], place = w.town.kinds.townhall && w.town.kinds.townhall.length ? w.town.kinds.townhall[0] : w.town.byKind.hall;
      LES.Labour.hire(w, p, { job: j, salary: salaryFor(w, role), place, id: -1 }, 1);
      p.job.fixedTitle = true;
    }
    g.officials[role] = o;
    const how = o.crony ? ` (a ${p.id === (pres && pres.partnerId) ? 'spouse' : 'relative'} of the ${LES.Gov.title(w)})` : '';
    P.log(w, p, `Appointed ${CO.ROLES[role].title} by ${pres ? `${LES.Gov.title(w)} ${P.name(pres)}` : 'the council'}`, 'politics', 2);
    CO.log(w, role, p.id, `${P.name(p)} appointed ${CO.ROLES[role].title}${how}; competence ${Math.round(o.comp * 100)}`);
    w.pushFeed({ day: w.day, pid: p.id, text: `${P.name(p)} is the new ${CO.ROLES[role].title} (${CO.ROLES[role].en})${how}`, cat: 'politics', imp: 1 });
  }

  // After an election the new leader picks a team (keeping good officials is likely).
  CO.reshuffle = function (w) {
    const R = w.rng.gov;
    for (const role of CO.ORDER) {
      const o = w.gov.officials[role], pick = choose(w, role, R);
      if (o && pick && o.id === pick.p.id) continue;
      if (o && !pick) continue;
      remove(w, role, 'replaced');
      appoint(w, role, R);
    }
  };

  CO.month = function (w, R) {
    const g = w.gov;
    for (const role of CO.ORDER) {
      const o = g.officials[role];
      if (o && o.id >= 0) {
        const p = w.people[o.id], ok = usable(w, p) && p.job && p.job.jobId === (role === 'police' ? 'police' : role);
        if (!ok) remove(w, role, !p.alive ? 'died' : p.away ? 'moved away' : p.inst ? 'arrested' : 'left the post');
      }
      if (!g.officials[role] && g.president >= 0) appoint(w, role, R);
    }
    // A corrupt police chief takes money from the gangs (and goes easy on them).
    const kpd = g.officials.police;
    if (kpd && kpd.integrity < 0.35 && w.crime) {
      const gang = w.crime.gangs.filter(x => x.alive && x.cash > w.px(2000)).sort((a, b) => b.cash - a.cash)[0];
      if (gang && R.next() < 0.5) {
        const amt = Math.round(gang.cash * 0.05);
        const to = kpd.id >= 0 ? w.people[kpd.id] : null;
        if (to) w.ledger.move(gang, 'cash', to, 'cash', amt); else w.ledger.move(gang, 'cash', w.ledger.sec.ABROAD, 'bal', amt);
        kpd.bribes = (kpd.bribes || 0) + amt;
      }
    }
  };

  // How the police chief changes policing (read by js/sim/crime.js).
  CO.policing = function (w) {
    const o = off(w, 'police');
    if (!w.gov) return { solve: 1, raid: 1 };
    const c = o ? o.comp : 0.35, corrupt = o && o.integrity < 0.35;
    return { solve: 0.75 + 0.5 * c, raid: corrupt ? 0.4 : 0.6 + 0.8 * c };
  };

  // ---- Programmes run by the community office ----
  CO.onJobLoss = function (w, p, job) {
    if (!w.gov) return;
    const c = CO.comp(w, 'community');
    const JL = LES.Countries.pack.welfare.jobLoss; // Malaysia: EIS 40% of pay up to RM2,000; UK: New Style JSA, flat
    if (JL.needsSi && !job.si) return; // China: only jobs that paid unemployment insurance; 12-24 months by years paid
    const days = JL.needsSi ? (p.siMonths >= 120 ? 730 : p.siMonths >= 60 ? 548 : JL.days) : JL.days;
    p.eis = { until: w.day + days, amt: Math.round((JL.flat ? w.px(JL.flat) : Math.min(job.salary * JL.share, w.px(JL.cap))) * (0.7 + 0.3 * c)) };
  };
  // Public servants who retire get a pension: 1/600 of the last salary per month served, up to 60%.
  CO.onRetire = function (w, p, job) {
    const months = (w.day - job.startDay) / 30.4;
    if (months < 120 || LES.Countries.pack.welfare.model === 'china') return; // (China: public servants draw the employees' pension)
    p.pension = Math.round(job.salary * Math.min(0.6, months / 600));
    P.log(w, p, `Receives a civil-service pension of ${U.fmtMoney(p.pension)}/mo`, 'money', 0);
  };
  CO.programmes = function (w, R) {
    const g = w.gov, c = CO.comp(w, 'community'), cost = w.px(CO.TRAIN_COST);
    let n = 0;
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.away || p.inst) continue;
      if (p.trainUntil > w.day) { // in a course this month
        LES.Gov.payOut(w, w.ledger.sec.TRAINING, 'bal', cost, 'training');
        g.trainPool = Math.max(0, (g.trainPool || 0) - cost);
        p.xp[p.trainCat] = (p.xp[p.trainCat] || 0) + 0.15 + 0.1 * c;
        n++;
        continue;
      }
      const age = P.age(w, p);
      if (p.job || p.manages >= 0 || p.retired || p.enrol || age > 59 || (g.trainPool || 0) < cost * CO.TRAIN_MONTHS) continue;
      if (R.next() < (0.12 + 0.35 * c) * (0.5 + p.pers.dis / 100)) {
        p.trainUntil = w.day + CO.TRAIN_MONTHS * 30;
        p.trainCat = R.pick(C.XP_CATS);
        g.trainPool -= cost; // the first month is booked now
        P.log(w, p, `Started a funded ${p.trainCat} skills course (${CO.ROLES.community.title}'s programme)`, 'edu', 0);
        g.trained = (g.trained || 0) + 1;
        n++;
      }
    }
    g.trainees = n;
  };
  // Training places help people get hired (read by the government hireWeight hook).
  CO.hireBoost = (w, p) => (p.trainUntil > w.day - 180 ? 1 + 0.25 * CO.comp(w, 'community') : 1);

  // ---- Development spending (roads, drains, parks...): the treasurer decides how well
  // it is spent; a corrupt treasurer skims some.
  CO.develop = function (w, amt, R) {
    const g = w.gov, o = off(w, 'treasurer');
    amt = Math.round(amt);
    if (amt <= 0) return;
    const spent = LES.Gov.payOut(w, w.ledger.sec.SUPPLIER, 'bal', amt, 'development');
    const waste = 0.3 * (1 - CO.comp(w, 'treasurer'));
    g.devStock += Math.round(spent * (1 - waste));
    g.devSpent = (g.devSpent || 0) + spent;
    if (o && o.id >= 0 && o.integrity < 0.35 && w.people[o.id].pers.risk > 50) { // kickbacks from contractors
      const kick = Math.round(spent * 0.05);
      w.ledger.move(w.ledger.sec.SUPPLIER, 'bal', w.people[o.id], 'cash', kick);
      o.skim = (o.skim || 0) + kick;
    }
    if (g.devSpent - (g.devAnnounced || 0) > w.px(400000) * Math.max(1, w.counts.living / 300)) {
      g.devAnnounced = g.devSpent;
      const what = PROJECTS[Math.floor(R.next() * PROJECTS.length)];
      g.projects = (g.projects || 0) + 1;
      CO.log(w, 'treasurer', o ? o.id : -1, `Development project completed: ${what}`);
      w.pushFeed({ day: w.day, pid: -1, text: `Council project completed: ${what}`, cat: 'economy', imp: 1 });
    }
  };

  // ---- Yearly: the budget, and the anti-corruption commission ----
  CO.year = function (w, R) {
    const g = w.gov, pres = g.president >= 0 ? w.people[g.president] : null, o = off(w, 'treasurer');
    const econ = pres && pres.pol ? pres.pol.econ : 0, hist = w.history.slice(-12);
    const unemp = hist.length ? U.sum(hist.map(x => x.unemployed / Math.max(1, x.unemployed + x.employed + x.owners))) / hist.length : 0.03;
    let dev = 0.5 - 0.15 * econ, train = 0.12 + (unemp > 0.05 ? 0.1 : 0) - 0.04 * econ;
    dev = U.clamp(dev, 0.25, 0.7); train = U.clamp(train, 0.05, 0.3);
    g.budget = { dev, train, fund: Math.max(0.05, 1 - dev - train) };
    const yr = U.dayToDate(w.day).year + 1;
    CO.log(w, 'treasurer', o ? o.id : -1, `Budget ${yr}: surplus to development ${Math.round(dev * 100)}%, training ${Math.round(train * 100)}%, ${LES.Countries.pack.names.fund} ${Math.round(g.budget.fund * 100)}%`);
    // Money to spare: the leader cuts a tax or expands a service, as their politics lean.
    const annual = LES.Fiscal.avgRevenue(w) * 12, fund = LES.Fiscal.fundValue(w);
    if (pres && g.debt <= 0 && fund > 2.5 * annual && !g.frozen) {
      const { cuts, spends } = LES.Countries.pack.gov.surplus; // [law, { from: to }] steps
      const order = econ > 0.15 ? cuts.concat(spends) : econ < -0.15 ? spends.concat(cuts) : (R.next() < 0.5 ? cuts : spends).concat(R.next() < 0.5 ? spends : cuts);
      for (const [key, map] of order) {
        const to = map[g.laws[key]];
        if (to) { LES.Gov.setLaw(w, key, to, 'surplus'); CO.log(w, 'treasurer', o ? o.id : -1, `Surplus: ${LES.Gov.LAW_BY_KEY[key].name} changed to ${LES.Gov.optName(key, to)}`); break; }
      }
    }
    // MACC investigations.
    for (const role of CO.ORDER) {
      const x = off(w, role);
      if (!x || x.id < 0) continue;
      const taken = (x.skim || 0) + (x.bribes || 0);
      if (taken > 0 && R.next() < 0.18) {
        const p = w.people[x.id], back = Math.min(p.cash, taken);
        if (back > 0) w.ledger.move(p, 'cash', g.treasury, 'cash', back);
        P.log(w, p, `Caught by the anti-corruption commission (${U.fmtMoney(taken)} in kickbacks and bribes)`, 'politics', 3);
        w.pushFeed({ day: w.day, pid: p.id, text: `${LES.Countries.pack.names.antiCorruption} arrests ${CO.ROLES[role].title} ${P.name(p)} over ${U.fmtMoney(taken)} in bribes`, cat: 'politics', imp: 2 });
        CO.log(w, role, p.id, `${P.name(p)} arrested by the ${LES.Countries.pack.names.antiCorruption} (${U.fmtMoney(taken)})`);
        g.scandal = Math.max(g.scandal, 20); g.scandals++;
        remove(w, role, 'arrested for corruption');
        if (w.crime) LES.Crime.admit(w, p, 'prison', Math.round(R.range(12, 48)), 'corruption');
      }
    }
  };

  LES.Countries.require('gov.council', 'gov.trainCost', 'gov.officialGroups', 'gov.surplus', 'names.fund', 'names.antiCorruption');
  LES.Countries.on('council', K => {
    for (const k of Object.keys(CO.ROLES)) delete CO.ROLES[k];
    Object.assign(CO.ROLES, K.gov.council); CO.TRAIN_COST = K.gov.trainCost;
  });
})(globalThis.LES = globalThis.LES || {});
