// Scenarios: what-if worlds picked on the setup screen (setting "scenario").
// Each scenario is a LES.Systems plug-in that is only on when cfg.scenario is its id, so
// the normal world and the Classic engine are untouched. A scenario may pre-fill some
// settings (cfg) and has a few options of its own (SETTINGS_META group 'Scenario').
// Every scenario records a small history row (row.scn) for its chart, a status line for
// the Stats tab and a section for the end-of-run report.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const SC = LES.Scenarios = { LIST: [], BY_ID: {} };
  const R = w => w.rng.scenario;
  const alive = w => w.living.filter(p => p.alive && !p.away);
  const adults = w => w.living.filter(p => p.alive && p.adult && !p.away);
  const flags = w => (w.flags = w.flags || {});
  const median = xs => (xs.length ? U.quantile(xs.slice().sort((a, b) => a - b), 0.5) : 0);
  const yr = day => `Y${Math.floor(day / 365) + 1}`;

  function define(def) {
    SC.LIST.push(def); SC.BY_ID[def.id] = def;
    const sys = Object.assign({ id: `scn-${def.id}`, order: 50, enabled: cfg => cfg.scenario === def.id }, def.hooks || {});
    const snap = def.snap;
    if (snap) sys.snapshot = (w, row) => { row.scn = snap(w); };
    LES.Systems.register(sys);
  }
  SC.current = w => SC.BY_ID[w.cfg.scenario] || null;
  SC.state = w => (w.scn = w.scn || {});

  // A vacancy posted directly by a scenario (new kinds of jobs).
  function post(w, job, salary, place) {
    w.vacancies.push({ id: w.nextVacId++, job, salary: Math.round(salary / 1000) * 1000, openDay: w.day, closeDay: w.day + 20, applicants: [], appSet: new Set(), place });
    w.vacancies.sort((a, b) => (b.salary - a.salary) || (a.id - b.id));
  }
  const topShare = w => { const nw = adults(w).map(p => Math.max(0, p.nw)).sort((a, b) => b - a), tot = U.sum(nw); return tot > 0 ? U.sum(nw.slice(0, Math.max(1, Math.round(nw.length / 10)))) / tot : 0; };

  // =====================================================================
  define({
    id: 'equal', name: 'Born Equal', icon: 'users',
    short: 'Everyone starts with the same money, the same abilities and no degrees.',
    desc: 'All founders get RM10,000, identical abilities (5 in every attribute), identical ageing genes and no qualifications; jobs at the start are handed out by lottery. Only personality and luck differ. Optionally, every child is born equal too.',
    watch: ['How fast wealth inequality appears (Gini starts at 0)', 'Which traits the richest share: discipline, patience, risk-taking?', 'How much is plain luck: windfalls, booms, illness'],
    cfg: { wealthDist: 'equal' },
    hooks: {
      init(w) {
        const r = R(w), L = w.ledger, F = LES.Finance, A = C.AGEING;
        const plain = C.JOBS.filter(j => !j.req && !j.commute);
        for (const p of w.people) {
          p.pot = [5, 5, 5, 5, 5, 5]; p.att = [5, 5, 5, 5, 5, 5]; p.peak = p.att.slice();
          p.ageing = { bOnset: A.bOnset[0], bRate: A.bRate[0], bFloor: (A.bFloor[0] + A.bFloor[1]) / 2, mOnset: A.mOnset[0], mRate: A.mRate[0], mFloor: (A.mFloor[0] + A.mFloor[1]) / 2 };
          p.quals = []; p.health = 85;
          if (p.epf > 0) L.spend(p, 'epf', 'GENESIS', p.epf);
          const want = w.px(10000);
          if (p.cash > want) L.spend(p, 'cash', 'GENESIS', p.cash - want); else if (p.cash < want) L.pay('GENESIS', p, 'cash', want - p.cash);
          p.xp = Object.fromEntries(C.XP_CATS.map(k => [k, 0]));
          if (p.job) { // the job lottery: everyone with a job gets an entry-level one
            const j = plain[r.weighted(plain.map(x => x.freq))];
            p.job = Object.assign(p.job, { jobId: j.id, title: j.title, salary: w.px(j.salary), level: 1, cat: j.cat, place: r.pick(w.town.kinds[j.place]) });
            p.incomeEMA = Math.round(p.job.salary * 0.89);
          } else p.incomeEMA = w.px(800);
          p.nw = P.netWorth(w, p); p.peakNw = p.nw;
        }
        for (const p of w.people) { F.reviewTiers(w, p); p.mcost = F.monthlyCost(w, p); }
        SC.state(w).started = true;
      },
      personCreated(w, p, how) {
        if (how !== 'child' || w.cfg.eqKids !== 'yes') return;
        p.pot = [5, 5, 5, 5, 5, 5];
        p.att = p.pot.map(v => v * (0.3 + 0.55 * Math.min(P.age(w, p), 18) / 18));
      },
    },
    snap: w => ({ top10: topShare(w) }),
    status(w) {
      const h = w.history[w.history.length - 1];
      return `Wealth Gini <b>${h ? h.gini.toFixed(2) : '0.00'}</b> (it started at 0) · the richest 10% hold <b>${Math.round(topShare(w) * 100)}%</b> of wealth`;
    },
    series: h => [{ label: 'Wealth Gini ×100', color: '#f2c14e', data: h.map(r => [r.day / 365, r.gini * 100]) }, { label: 'Top 10% share %', color: '#ff8c42', data: h.map(r => [r.day / 365, (r.scn ? r.scn.top10 : 0) * 100]) }],
    report(w) { return traitTable(w); },
  });

  // What the richest quarter of founders had in common (Born Equal, Great Reset).
  function traitTable(w) {
    const f = w.people.filter(p => !p.parents.length && !p.migrant);
    if (f.length < 8) return '';
    f.sort((a, b) => b.peakNw - a.peakNw);
    const q = Math.max(2, Math.floor(f.length / 4)), top = f.slice(0, q), bot = f.slice(-q);
    const avg = (xs, fn) => U.sum(xs.map(fn)) / xs.length;
    const rows = [['Discipline', p => p.pers.dis], ['Patience', p => p.pers.pat], ['Risk tolerance', p => p.pers.risk], ['Responsibility', p => p.pers.resp], ['Resilience', p => p.pers.res],
      ['Windfalls (luck, Year-1 RM)', p => p.earned.luck / 100], ['Business booms', p => w.biz.filter(b => b.founderId === p.id).reduce((s, b) => s + b.booms, 0)], ['Degrees earned', p => p.quals.filter(P.isBachelor).length]];
    return `<table><tr><th>Founders</th><th>Richest quarter</th><th>Poorest quarter</th></tr>${rows.map(([n, fn]) => `<tr><td>${n}</td><td>${avg(top, fn).toFixed(1)}</td><td>${avg(bot, fn).toFixed(1)}</td></tr>`).join('')}</table>
      <p class="note">Founders ranked by the highest net worth they ever reached.</p>`;
  }

  // =====================================================================
  define({
    id: 'reset', name: 'Great Reset', icon: 'reload',
    short: 'One day all wealth is pooled and shared out equally.',
    desc: 'On the chosen year every business is sold, every share and fund unit is cashed in, study debts are forgiven, and all the money in town is pooled and split equally between the adults (EPF retirement savings are left alone). Then life goes on.',
    watch: ['How many years until inequality is back to where it was', 'Whether the same families end up on top again', 'How businesses and the stock market recover'],
    hooks: {
      init(w) { const s = SC.state(w); s.next = Number(w.cfg.resetYear) * 365; s.resets = []; },
      day(w) { const s = SC.state(w); if (w.day === s.next) { greatReset(w); s.next = w.cfg.resetRepeat === 'yes' ? w.day + Number(w.cfg.resetYear) * 365 : -1; } },
      month(w) { const s = SC.state(w), last = s.resets[s.resets.length - 1], h = w.history[w.history.length - 1]; if (last && !last.back && h && w.day > last.day + 60 && h.gini >= last.gini) last.back = w.day; },
    },
    snap: w => ({ top10: topShare(w) }),
    status(w) {
      const s = SC.state(w), last = s.resets[s.resets.length - 1];
      const now = w.history.length ? w.history[w.history.length - 1].gini : 0;
      return (last ? `Last reset ${yr(last.day)}: ${U.fmtMoney(last.pooled)} pooled, ${U.fmtMoney(last.share)} to each of ${last.n} adults. Wealth Gini was ${last.gini.toFixed(2)}, now <b>${now.toFixed(2)}</b>${last.back ? ` (back to that level after ${((last.back - last.day) / 365).toFixed(1)} years)` : ''}.` : 'No reset yet.')
        + (s.next > 0 ? ` Next reset ${U.fmtMonthYear(s.next)}.` : '');
    },
    series: h => [{ label: 'Wealth Gini ×100', color: '#f2c14e', data: h.map(r => [r.day / 365, r.gini * 100]) }, { label: 'Top 10% share %', color: '#ff8c42', data: h.map(r => [r.day / 365, (r.scn ? r.scn.top10 : 0) * 100]) }],
    report(w) { const s = SC.state(w); return s.resets.length ? `<p>${s.resets.map(r => `${yr(r.day)}: ${U.fmtMoney(r.pooled)} pooled, ${U.fmtMoney(r.share)} each; Gini ${r.gini.toFixed(2)} before${r.back ? `, back after ${((r.back - r.day) / 365).toFixed(1)} years` : ', not back by the end'}`).join('<br>')}</p>${topAfterReset(w)}` : '<p>The reset year was never reached.</p>'; },
  });

  function greatReset(w) {
    const F = LES.Finance, L = w.ledger, s = SC.state(w);
    const gini = w.history.length ? w.history[w.history.length - 1].gini : 0;
    for (const b of w.biz) if (b.open) F.sellBiz(w, b, 'the Great Reset');
    const people = alive(w), pool = { cash: 0 };
    for (const p of people) {
      if (P.invValue(w, p) > 0) F.raiseCash(w, p, P.invValue(w, p) + 1, 'the Great Reset');
      if (p.debt.study > 0) { L.writeOffs += p.debt.study; p.debt.study = 0; p.debt.studyOrig = 0; }
      if (p.cash > 0) L.move(p, 'cash', pool, 'cash', p.cash);
      if (p.trust > 0) L.move(p, 'trust', pool, 'cash', p.trust);
    }
    const ad = people.filter(p => p.adult), pooled = pool.cash, share = Math.floor(pooled / Math.max(1, ad.length));
    s.before = ad.map(p => p.id).sort((a, b) => w.people[b].peakNw - w.people[a].peakNw).slice(0, Math.max(1, Math.round(ad.length / 10)));
    for (const p of ad) { L.move(pool, 'cash', p, 'cash', share); P.log(w, p, `The Great Reset: all wealth pooled; received an equal share of ${U.fmtMoney(share)}`, 'money', 2); p.nw = P.netWorth(w, p); }
    if (pool.cash > 0 && ad.length) L.move(pool, 'cash', ad[0], 'cash', pool.cash);
    else if (pool.cash > 0) L.move(pool, 'cash', L.sec.GENESIS, 'bal', pool.cash);
    s.resets.push({ day: w.day, pooled, share, n: ad.length, gini });
    w.pushFeed({ day: w.day, pid: -1, text: `THE GREAT RESET: every business sold and all wealth pooled (${U.fmtMoney(pooled)}); each of ${ad.length} adults receives ${U.fmtMoney(share)}`, cat: 'economy', imp: 3 });
  }
  function topAfterReset(w) {
    const s = SC.state(w);
    if (!s.before) return '';
    const now = adults(w).sort((a, b) => b.nw - a.nw).slice(0, 10).map(p => p.id);
    const fam = id => { const p = w.people[id]; return new Set([id, ...p.parents, ...p.children]); };
    let again = 0;
    for (const id of now) if (s.before.some(b => fam(b).has(id))) again++;
    return `<p class="note">${again} of today's 10 richest were among the richest tenth before the last reset, or are their parents or children.</p>`;
  }

  // =====================================================================
  define({
    id: 'eternal', name: 'Eternal Life', icon: 'infinity',
    short: 'Nobody ages after adulthood and nobody dies of old age.',
    desc: 'Bodies and minds stop declining, old-age mortality is switched off and nobody retires. Illness, accidents and crime can still kill. Children are still born and grow up.',
    watch: ['Crowding and rents as the population grows', 'Whether the old hold on to the best jobs and the wealth', 'Inheritance disappears: do young people ever get rich?'],
    cfg: { mortMult: 0 },
    hooks: { init(w) { Object.assign(flags(w), { noAgeing: true, noRetire: true }); } },
    snap: w => { const a = alive(w).map(p => P.age(w, p)); return { oldest: a.length ? Math.max(...a) : 0, mean: a.length ? U.sum(a) / a.length : 0, over100: a.filter(x => x >= 100).length }; },
    status(w) {
      const a = alive(w).sort((x, y) => P.age(w, y) - P.age(w, x)), o = a[0], young = adults(w).filter(p => P.age(w, p) < 35), old = adults(w).filter(p => P.age(w, p) >= 60);
      return `${o ? `Oldest: ${LES.UI && LES.UI.plink ? LES.UI.plink(w, o.id) : P.name(o)}, aged ${Math.floor(P.age(w, o))}. ` : ''}${a.filter(p => P.age(w, p) >= 100).length} people over 100. Median wealth under 35: <b>${U.fmtMoney(median(young.map(p => p.nw)))}</b> vs 60+: <b>${U.fmtMoney(median(old.map(p => p.nw)))}</b>.`;
    },
    series: h => [{ label: 'Population', color: '#5aa9e6', data: h.map(r => [r.day / 365, r.pop]) }, { label: 'Mean age', color: '#b892ff', data: h.map(r => [r.day / 365, r.scn ? r.scn.mean : 0]) }, { label: 'Oldest', color: '#f2c14e', data: h.map(r => [r.day / 365, r.scn ? r.scn.oldest : 0]) }],
    report(w) { const groups = [[18, 35], [35, 60], [60, 100], [100, 1e9]]; return `<table><tr><th>Age</th><th>People</th><th>Median net worth</th></tr>${groups.map(([a, b]) => { const g = adults(w).filter(p => P.age(w, p) >= a && P.age(w, p) < b); return `<tr><td>${b > 1e8 ? `${a}+` : `${a}-${b - 1}`}</td><td>${g.length}</td><td>${U.fmtMoney(median(g.map(p => p.nw)))}</td></tr>`; }).join('')}</table>`; },
  });

  // =====================================================================
  define({
    id: 'eduban', name: 'Education Ban', icon: 'lock',
    short: 'Schools, colleges and universities are closed.',
    desc: 'From the chosen year children stay at home and learn less, and nobody can enrol in a course or degree; students drop out. People who already have qualifications keep them. Libraries stay open for self-study.',
    watch: ['Skilled jobs left unfilled as graduates retire', 'Wages, unemployment and crime', 'Whether the town finds other ways to get on (businesses, gigs)'],
    hooks: {
      init(w) { SC.state(w).banDay = Number(w.cfg.banYear) * 365; },
      day(w) {
        const s = SC.state(w);
        if (s.banned || w.day < s.banDay) return;
        s.banned = true; s.degAtBan = degShare(w);
        Object.assign(flags(w), { noSchool: true, noCourses: true });
        for (const p of w.living) if (p.alive && p.enrol) { P.log(w, p, `Studies ended: ${C.COURSE_BY_ID[p.enrol.course].name} (education ban)`, 'edu', 1); p.enrol = null; }
        for (const b of w.biz) if (b.open && b.type === 'privschool') LES.Finance.closeBiz(w, b, 'closed by the education ban', false);
        w.pushFeed({ day: w.day, pid: -1, text: 'EDUCATION BAN: every school, college and university is closed', cat: 'economy', imp: 3 });
      },
      year(w) { // children who cannot go to school learn less (applied after the year's growth)
        if (!SC.state(w).banned) return;
        for (const c of w.living) if (c.alive && !c.adult && P.age(w, c) >= 7) { c.att[C.INT] *= 0.85; c.att[C.PER] *= 0.93; }
      },
    },
    snap: w => ({ deg: degShare(w), unf: w.stats.vacUnfilled }),
    status(w) {
      const s = SC.state(w);
      return s.banned ? `Closed since ${yr(s.banDay)}. Adults with a degree: <b>${Math.round(degShare(w) * 100)}%</b> (${Math.round(s.degAtBan * 100)}% at the ban). Vacancies that found nobody qualified: ${w.stats.vacUnfilled}.` : `Schools close in ${yr(s.banDay)}.`;
    },
    series: h => [{ label: 'Adults with a degree %', color: '#b892ff', data: h.map(r => [r.day / 365, (r.scn ? r.scn.deg : 0) * 100]) }, { label: 'Unemployment %', color: '#e76f51', data: h.map(r => [r.day / 365, r.unemployed / Math.max(1, r.unemployed + r.employed + r.owners) * 100]) }],
    report(w) { return `<p>Adults with a degree at the end: ${Math.round(degShare(w) * 100)}%. Unfilled vacancies over the run: ${w.stats.vacUnfilled} of ${w.stats.vacOpened}.</p>`; },
  });
  function degShare(w) { const a = adults(w).filter(p => P.age(w, p) >= 25); return a.length ? a.filter(p => p.quals.some(P.isBachelor)).length / a.length : 0; }

  // =====================================================================
  // Infection fatality by age: log10(IFR) = -3.27 + 0.0524 x age (Levin et al. 2020, COVID-19).
  const IFR = age => Math.pow(10, -3.27 + 0.0524 * age);
  define({
    id: 'pandemic', name: 'Pandemic', icon: 'heart',
    short: 'A new virus arrives: waves, lockdowns, then vaccines.',
    desc: 'In the chosen year a new virus spreads from person to person (about 2.5 new infections each at first). When more than 2% are ill the town locks down (an MCO): shops lose customers, hiring freezes, venues and schools close and delivery work booms. Vaccines arrive a year later. Older people are far more at risk. The pandemic fades after about three years.',
    watch: ['Deaths by age and the effect of lockdowns on infections', 'Jobs lost and businesses that fail during lockdowns', 'Healthcare quality and aid from the treasury (with a government)'],
    hooks: {
      init(w) { const y = Number(w.cfg.pandemicYear) * 365; Object.assign(SC.state(w), { start: y, end: y + 3 * 365, vaxDay: y + 365, cases: 0, deaths: 0, lock: false, locks: 0, lockDays: 0, infected: 0, vaxed: 0, over: false }); },
      day(w) { pandemicDay(w); },
      month(w) {
        const s = SC.state(w), r = R(w);
        if (w.day < s.vaxDay || s.over) return;
        for (const p of w.living) if (p.alive && p.adult && !p.vax && r.next() < 0.12 + 0.15 * p.pers.resp / 100) { p.vax = true; s.vaxed++; }
      },
      venueBias: w => (SC.state(w).lock ? -40 : 0),
      death(w, p) { if (p.inf) { p.inf = 0; SC.state(w).infected = Math.max(0, SC.state(w).infected - 1); } },
    },
    snap: w => { const s = SC.state(w); return { inf: s.infected / Math.max(1, w.counts.living) * 100, deaths: s.deaths, lock: s.lock ? 1 : 0 }; },
    status(w) {
      const s = SC.state(w);
      if (w.day < s.start) return `The virus arrives ${yr(s.start)}.`;
      return `${s.over ? 'Over.' : s.lock ? '<b class="neg">Lockdown (MCO) in force.</b>' : 'Spreading.'} Ill now: <b>${s.infected}</b> · cases ${s.cases} · deaths <b>${s.deaths}</b> · ${s.locks} lockdown${s.locks === 1 ? '' : 's'} (${Math.round(s.lockDays / 30)} months) · vaccinated ${s.vaxed}`;
    },
    series: h => [{ label: 'Ill now (% of town)', color: '#e63946', data: h.map(r => [r.day / 365, r.scn ? r.scn.inf : 0]) }, { label: 'Deaths so far', color: '#9aa5b1', data: h.map(r => [r.day / 365, r.scn ? r.scn.deaths : 0]) }, { label: 'Lockdown on', color: '#f2c14e', data: h.map(r => [r.day / 365, r.scn ? r.scn.lock : 0]) }],
    report(w) {
      const dead = w.people.filter(p => p.causeOfDeath === 'pandemic illness'), groups = [[0, 40], [40, 60], [60, 75], [75, 200]];
      return `<table><tr><th>Age at death</th><th>Pandemic deaths</th></tr>${groups.map(([a, b]) => `<tr><td>${b > 150 ? `${a}+` : `${a}-${b - 1}`}</td><td>${dead.filter(p => { const ag = (p.deathDay - p.birthDay) / 365; return ag >= a && ag < b; }).length}</td></tr>`).join('')}</table><p class="note">${SC.state(w).cases} cases in all; ${SC.state(w).locks} lockdowns.</p>`;
    },
  });

  function pandemicDay(w) {
    const s = SC.state(w), r = R(w), day = w.day;
    if (day < s.start || (s.over && !s.infected)) return;
    if (day === s.start) w.pushFeed({ day, pid: -1, text: 'A new virus has reached the town', cat: 'economy', imp: 3 });
    if (day === s.vaxDay) w.pushFeed({ day, pid: -1, text: 'Vaccines have arrived: the vaccination drive begins', cat: 'economy', imp: 2 });
    if (!s.over && day >= s.end) { s.over = true; w.pushFeed({ day, pid: -1, text: 'The pandemic is declared over', cat: 'economy', imp: 2 }); }
    const N = Math.max(1, w.counts.living), sev = w.cfg.pandemicSeverity === 'severe' ? 3 : 1;
    const lam = s.over ? 0 : 0.25 * s.infected / N * (s.lock ? 0.35 : 1);
    const care = w.gov ? U.clamp(1.3 - 0.3 * w.gov.healthQ, 0.9, 1.2) : 1;
    let inf = 0;
    const seed = !s.over && (day === s.start || r.next() < 0.015); // travellers bring new cases
    for (const p of w.living) {
      if (!p.alive || p.away) continue;
      if (p.infDie === day) { w.die(p, 'pandemic illness'); s.deaths++; continue; }
      if (p.inf) {
        if (day >= p.inf) { p.inf = 0; p.immune = day + 300; } else { inf++; continue; }
      }
      if (lam <= 0 || (p.immune && p.immune > day)) continue;
      if (r.next() < 1 - Math.exp(-lam * (p.vax ? 0.4 : 1))) {
        p.inf = day + 10; inf++; s.cases++;
        p.health = Math.max(1, p.health - 12); p.energy -= 30;
        const age = P.age(w, p);
        const ifr = (IFR(age) * sev + (sev > 1 && age >= 18 && age < 40 ? 0.004 : 0)) * (p.vax ? 0.15 : 1) * care;
        if (r.next() < ifr) p.infDie = day + r.int(5, 15);
      }
    }
    if (seed) { const q = w.living[Math.floor(r.next() * w.living.length)]; if (q && q.alive && !q.inf && !(q.immune > day)) { q.inf = day + 10; inf++; s.cases++; } }
    s.infected = inf;
    // Lockdown (Movement Control Order) above 2% ill; lifted below 0.4% after a month.
    const prev = inf / N;
    if (!s.lock && prev > 0.02 && !s.over) {
      s.lock = true; s.lockStart = day; s.locks++;
      w.shock = { biz: 0.75, vac: 0.45, layoff: 2.5, gig: 1.15, cost: 1 };
      flags(w).noSchool = true;
      let aid = 0;
      if (w.gov) for (const p of w.living) if (p.alive && p.adult && p.isHead && p.cls === 'B40' && !p.away) { const a = LES.Gov.payOut(w, p, 'cash', w.px(500), 'pandemic aid'); p.earned.welfare += a; aid += a; }
      w.pushFeed({ day, pid: -1, text: `Lockdown (MCO): shops, venues and schools close${aid ? `; RM500 aid to each B40 household (${U.fmtMoney(aid)})` : ''}`, cat: 'economy', imp: 3 });
    } else if (s.lock && (prev < 0.004 || s.over) && day - s.lockStart > 30) {
      s.lock = false; w.shock = null; flags(w).noSchool = false;
      w.pushFeed({ day, pid: -1, text: 'The lockdown is lifted', cat: 'economy', imp: 2 });
    }
    if (s.lock) s.lockDays++;
  }

  // =====================================================================
  // How exposed each job is to robots and AI (0 = safe, 1 = fully automatable).
  SC.EXPOSURE = { cleaner: 0.7, retail: 0.8, rider: 0.9, factory: 0.9, construction: 0.4, sales: 0.5, chef: 0.4, mechanic: 0.3, electrician: 0.2, nurse: 0.1, teacher: 0.2,
    accountant: 0.6, banker: 0.5, engineer: 0.1, softdev: 0.3, manager: 0.2, doctor: 0.1, cityretail: 0.8, citycorp: 0.5, citytech: 0.2 };
  const ROBOT_JOBS = {
    robotech: { id: 'robotech', title: 'Robot Technician', salary: 4200, req: 'VOC', w: [0.4, 0.1, 0.3, 0, 0.2, 0], diff: 5.5, cat: 'technical', place: 'factory', freq: 0 },
    aieng: { id: 'aieng', title: 'AI Engineer', salary: 9500, req: 'BACH_ENG', w: [0.8, 0, 0.2, 0, 0, 0], diff: 7.5, cat: 'technical', place: 'techhub', freq: 0 },
  };
  for (const j of Object.values(ROBOT_JOBS)) C.JOB_BY_ID[j.id] = j;
  define({
    id: 'robots', name: 'Robot Age', icon: 'robot',
    short: 'Robots and AI take over routine work, year by year.',
    desc: 'From the chosen year automation spreads: jobs like riders, factory operators, cashiers and clerks stop being advertised and some workers are replaced. Businesses become more profitable, gig pay falls, and a few new jobs appear (robot technicians, AI engineers). With a government, voters may turn to a basic income.',
    watch: ['Unemployment and wages for people without degrees', 'Business owners\' profits and inequality', 'Whether the town votes for a universal basic income'],
    hooks: {
      init(w) { Object.assign(SC.state(w), { start: Number(w.cfg.robotYear) * 365, a: 0, lost: 0, created: 0, said: 0 }); },
      jobOk(w, j) { const a = SC.state(w).a; return !(a > 0 && R(w).next() < a * (SC.EXPOSURE[j.id] || 0)); },
      year(w) {
        const s = SC.state(w), span = { slow: 40, normal: 25, fast: 12 }[w.cfg.robotSpeed] || 25;
        s.a = U.clamp((w.day + 1 - s.start) / 365 / span * 0.85, 0, 0.85);
        w.shock = s.a > 0 ? { biz: 1, vac: 1, layoff: 1, gig: 1 - 0.4 * s.a, cost: 1 - 0.08 * s.a } : null;
        const step = Math.floor(s.a / 0.2);
        if (step > s.said) { s.said = step; w.pushFeed({ day: w.day, pid: -1, text: `Robot Age: machines now do about ${step * 20}% of routine work`, cat: 'economy', imp: 2 }); }
      },
      month(w) {
        const s = SC.state(w), r = R(w);
        if (s.a <= 0) return;
        for (const p of w.living) {
          if (!p.alive || !p.job || (w.gov && LES.Services.lineOf(p.job))) continue;
          const e = SC.EXPOSURE[p.job.jobId] || 0;
          if (e && r.next() < s.a * e * 0.01) { P.log(w, p, `Job as ${p.job.title} was automated`, 'career', 1); LES.Labour.endJob(w, p, 'laid off'); s.lost++; }
        }
        const n = r.poisson(s.a * w.counts.adults * 0.003);
        for (let k = 0; k < n; k++) {
          const j = r.next() < 0.6 ? ROBOT_JOBS.robotech : ROBOT_JOBS.aieng, list = w.town.kinds[j.place] || [w.town.byKind.office];
          post(w, j, w.px(j.salary * U.clamp(r.normal(1, 0.1), 0.8, 1.3)), list[Math.floor(r.next() * list.length)]);
          s.created++;
        }
      },
    },
    snap: w => ({ auto: SC.state(w).a }),
    status(w) {
      const s = SC.state(w), h = w.history[w.history.length - 1];
      if (w.day < s.start) return `Automation begins ${yr(s.start)}.`;
      return `Automation <b>${Math.round(s.a * 100)}%</b> · jobs automated ${s.lost} · new tech jobs posted ${s.created} · unemployment ${h ? (h.unemployed / Math.max(1, h.unemployed + h.employed + h.owners) * 100).toFixed(1) : 0}%${w.gov ? ` · basic income: ${w.gov.laws.ubi === '0' ? 'none' : `RM${w.gov.laws.ubi}`}` : ''}`;
    },
    series: h => [{ label: 'Automation %', color: '#5aa9e6', data: h.map(r => [r.day / 365, (r.scn ? r.scn.auto : 0) * 100]) }, { label: 'Unemployment % ×5', color: '#e76f51', data: h.map(r => [r.day / 365, r.unemployed / Math.max(1, r.unemployed + r.employed + r.owners) * 500]) }, { label: 'Wealth Gini ×100', color: '#f2c14e', data: h.map(r => [r.day / 365, r.gini * 100]) }],
    report(w) { const s = SC.state(w); return `<p>Automation reached ${Math.round(s.a * 100)}%. ${s.lost} jobs were automated and ${s.created} new tech jobs were posted.${w.gov ? ` Basic income at the end: ${w.gov.laws.ubi === '0' ? 'none' : `RM${w.gov.laws.ubi}/month`}.` : ''}</p>`; },
  });

  // =====================================================================
  define({
    id: 'lawless', name: 'Lawless Town', icon: 'skull',
    short: 'Crime at 30× Malaysian rates, a thin and crooked police force.',
    desc: 'Crime runs at the Lawless setting, the town starts with only 2 police officers per 1,000 people, and its first police chief takes gang money. Can elections, budgets and a new police chief bring order?',
    watch: ['Whether voters elect a tough-on-crime leader and more police', 'Gangs, turf and protection money', 'Businesses, migration and unemployment under high crime'],
    cfg: { crime: 'lawless' },
    hooks: {
      init(w) { if (w.gov) { w.gov.laws.police = '2'; LES.Gov.applyLaws(w); } SC.state(w).firstTerm = Number(w.cfg.termYears) * 365; },
      month(w) { const o = w.gov && w.gov.officials && w.gov.officials.police; if (o && w.day < SC.state(w).firstTerm && o.integrity >= 0.35) o.integrity = 0.25; },
    },
    snap: w => ({ idx: w.crime ? LES.Crime.rates(w).index : 0 }),
    status(w) {
      const r = w.crime ? LES.Crime.rates(w) : null;
      return r ? `Index crime <b>${Math.round(r.index)}</b> per 100k (Malaysia 170) · gangs active ${w.crime.gangs.filter(g => g.alive).length} · police ${w.gov ? `${w.gov.laws.police} per 1,000 by law, ${w.gov.officers} on duty` : 'notional'}` : '';
    },
    series: h => [{ label: 'Index crime per 100k', color: '#e63946', data: h.map(r => [r.day / 365, r.scn ? r.scn.idx : 0]) }, { label: 'Officers ×500', color: '#5aa9e6', data: h.map(r => [r.day / 365, r.gov ? r.gov.officers * 500 : 0]) }],
    report(w) { return w.gov ? `<p>Police law at the end: ${w.gov.laws.police} officers per 1,000. ${w.crime.crackdowns} gang raids.</p>` : ''; },
  });

  // =====================================================================
  define({
    id: 'island', name: 'Isolated Island', icon: 'sun',
    short: 'Nobody arrives, nobody leaves, and everything is imported.',
    desc: 'The town is cut off: no migration, no commuting to the city, and food and goods cost 10-15% more because they are shipped in. The founders\' families are all there will ever be.',
    watch: ['Whether the population survives and how far families branch out', 'Surname diversity falling over generations', 'A closed job market: wages and unemployment'],
    cfg: { migration: 'off' },
    hooks: {
      init(w) {
        w.costMult = { food: 1.15, transport: 1.1, leisure: 1.1, housing: 1 };
        for (const p of w.people) if (p.job && C.JOB_BY_ID[p.job.jobId].commute) { LES.Labour.endJob(w, p, 'no more trains to the city', true); P.log(w, p, 'Lost a city commuter job: the island has no train', 'career', 1); }
        for (const p of w.people) p.mcost = LES.Finance.monthlyCost(w, p);
      },
      jobOk: (w, j) => !j.commute,
    },
    snap: w => ({ names: new Set(alive(w).map(p => p.last)).size }),
    status(w) { const a = alive(w); return `Population ${a.length} · ${new Set(a.map(p => p.last)).size} family names left · generation ${a.length ? Math.max(...a.map(p => p.gen || 0)) + 1 : 0}`; },
    series: h => [{ label: 'Population', color: '#5aa9e6', data: h.map(r => [r.day / 365, r.pop]) }, { label: 'Family names', color: '#57d38c', data: h.map(r => [r.day / 365, r.scn ? r.scn.names : 0]) }],
    report(w) { return `<p>${new Set(alive(w).map(p => p.last)).size} family names survive among ${alive(w).length} people.</p>`; },
  });

  // =====================================================================
  // Five Clans: a fictional world where clans do have innate gifts (the only place in the
  // simulation where group membership changes ability). Which gift pays?
  SC.CLANS = [
    { id: 'gajah', name: 'Gajah', en: 'Elephant', attr: C.END, colour: '#9aa5b1' },
    { id: 'harimau', name: 'Harimau', en: 'Tiger', attr: C.STR, colour: '#ff8c42' },
    { id: 'kancil', name: 'Kancil', en: 'Mouse-deer', attr: C.AGI, colour: '#57d38c' },
    { id: 'merak', name: 'Merak', en: 'Peacock', attr: C.CHA, colour: '#b892ff' },
    { id: 'hantu', name: 'Burung Hantu', en: 'Owl', attr: C.INT, colour: '#5aa9e6' },
  ];
  SC.CLAN_BY_ID = Object.fromEntries(SC.CLANS.map(c => [c.id, c]));
  define({
    id: 'clans', name: 'Five Clans', icon: 'crown',
    short: 'A fictional world of five clans, each born with a gift.',
    desc: 'Every founder belongs to one of five fictional clans with an innate gift: Gajah (endurance), Harimau (strength), Kancil (agility), Merak (charisma) and Burung Hantu (intelligence). Children take a parent\'s clan and part of its gift. People prefer partners from their own clan. In this world only, group membership changes ability, so you can see which gifts the economy rewards.',
    watch: ['Which clan grows richest, and whether it lasts', 'Marriage across clans and mixed families', 'Whether talent or wealth explains success'],
    hooks: {
      personCreated(w, p, how) {
        const r = R(w);
        if (how === 'child') {
          const ps = p.parents.map(id => w.people[id]).filter(q => q.clan);
          p.clan = ps.length ? ps[Math.floor(r.next() * ps.length)].clan : SC.CLANS[Math.floor(r.next() * 5)].id;
          const a = SC.CLAN_BY_ID[p.clan].attr;
          p.pot[a] = Math.min(10, p.pot[a] + 0.5);
          p.att = p.pot.map(v => v * (0.3 + 0.55 * Math.min(P.age(w, p), 18) / 18));
          return;
        }
        p.clan = SC.CLANS[Math.floor(r.next() * 5)].id;
        const a = SC.CLAN_BY_ID[p.clan].attr;
        for (let i = 0; i < 6; i++) { const d = i === a ? 1.5 : -0.3; p.pot[i] = U.clamp(p.pot[i] + d, 0.5, 10); p.att[i] = U.clamp(p.att[i] + d, 0, 10); }
        p.peak = p.att.slice();
      },
      coupleWeight: (w, a, b) => (a.clan && a.clan === b.clan ? 1.5 : 1),
    },
    snap: w => { const o = {}; for (const c of SC.CLANS) o[c.id] = median(adults(w).filter(p => p.clan === c.id).map(p => p.nw / w.price / 100)); return o; },
    status: w => clanTable(w),
    series: h => SC.CLANS.map(c => ({ label: c.name, color: c.colour, data: h.map(r => [r.day / 365, r.scn ? Math.max(1, r.scn[c.id] || 0) : 1]) })),
    logY: true,
    report: w => clanTable(w),
  });
  function clanTable(w) {
    const ad = adults(w);
    return `<table class="cmp"><tr><th>Clan (gift)</th><th>Adults</th><th>Median net worth</th><th>Median income</th><th>Millionaires</th></tr>${SC.CLANS.map(c => { const g = ad.filter(p => p.clan === c.id); return `<tr><td><span style="color:${c.colour}">■</span> ${c.name} <span class="muted">(${C.ATTR_NAMES[c.attr].toLowerCase()})</span></td><td>${g.length}</td><td>${U.fmtMoney(median(g.map(p => p.nw)))}</td><td>${U.fmtMoney(median(g.map(p => p.incomeEMA)))}</td><td>${g.filter(p => p.nw >= w.px(1e6)).length}</td></tr>`; }).join('')}</table>`;
  }
})(globalThis.LES = globalThis.LES || {});
