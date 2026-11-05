// Calibration: measures a finished (or running) world and compares it with Malaysian
// reference figures. Used by tools/calibration.html and `node tools/headless.js calib`.
// The targets anchor the default settings; they do not make the simulation a forecast.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P;
  const Cal = LES.Calibration = {};

  // Each target: label, format, and from the country pack's `calibration`: target, warning band
  // (absolute) and source. Filled by the applier at the end of this file.
  Cal.TARGETS = {};
  // Highest completed credential as an ISCED 2011 level (C02): 0 = no recorded credential (school levels are not
  // tracked), VOC = the country pack's `education.vocIsced` (a certificate or Level 3 diploma is 4, not tertiary;
  // an associate degree or a Chinese dazhuan is 5), bachelor's 6, medicine and master's 7.
  Cal.LEVELS = { BACH_GEN: 6, BACH_BUS: 6, BACH_ENG: 6, MED: 7, MASTER: 7 };
  Cal.vocLevel = () => ((LES.Countries.pack.education || {}).vocIsced) || 4;
  Cal.eduLevel = function (p) {
    let lv = 0;
    for (const q of p.quals) lv = Math.max(lv, q === 'VOC' ? Cal.vocLevel() : (Cal.LEVELS[q] || 0));
    return lv;
  };
  Cal.MIN_EDU_N = 20; // fewer adults 25-64 than this: the share is not shown
  const money = x => `${LES.Countries.pack.money.symbol}${Math.round(x * LES.Countries.scale())}`; // engine units -> real money
  // Each measure with its definition (C05): what is counted, out of whom, over what period, the smallest sample
  // shown, and whether it is defined like the official figure (`comparable`; `note` says how it differs).
  const DEFS = {
    tfr: { label: 'Children per woman (period TFR)', fmt: x => x.toFixed(2), num: 'births to women 15-49 in the last 10 years, by 5-year age band', den: 'person-years lived by women in each band while in town', obs: 'last 10 years', minN: 30, comparable: true, note: 'Sum of age-specific birth rates, as statistics offices compute the TFR. Completed family size of women 45+ is shown separately.' },
    e0: { label: 'Life expectancy at birth (yrs)', fmt: x => x.toFixed(1), num: 'deaths by 5-year age band', den: 'person-years lived in town', obs: 'last 10-40 years', minN: 30, comparable: true, note: 'Period life table; unstable with few deaths.' },
    unemp: { label: 'Not working, share of eligible adults', fmt: U.fmtPct, num: 'adults under 64 without a job, study, business or retirement, not in an institution', den: 'those + employed + business owners', obs: 'monthly, last 10 years', minN: 0, comparable: false, note: 'Not the labour-force definition: it does not ask whether people are looking for work and available, so it is a proxy for the official unemployment rate.' },
    medWage: { label: 'Median monthly wage (Year-1 $)', fmt: money, num: 'contract monthly pay of each employed person (before tax)', den: 'employed people', obs: 'end of run', minN: 20, comparable: true, note: 'Contract pay, not pay actually earned after missed shifts.' },
    hhGini: { label: 'Household income Gini (gross, smoothed)', fmt: x => x.toFixed(2), num: 'smoothed monthly income of household heads plus partners, before tax', den: 'households', obs: 'end of run', minN: 20, comparable: true, note: 'Gross income averaged over recent months (not disposable income, not wealth).' },
    starve: { label: 'Deaths from starvation (share)', fmt: U.fmtPct, num: 'deaths from starvation', den: 'all deaths', obs: 'whole run', minN: 0, comparable: true },
    // Crime rates are compared at the "Realistic" scale (the town's rate divided by the intensity).
    crimeIdx: { label: 'Index crime per 100k (realistic scale)', fmt: x => x.toFixed(0), num: 'modelled offences recorded in a year', den: 'residents', obs: 'yearly after year 5', minN: 0, comparable: true, note: 'Only the offence types the engine models.' },
    drugUsers: { label: 'Drug users per 100k (realistic scale)', fmt: x => x.toFixed(0), num: 'current drug users', den: 'residents', obs: 'each December after year 5', minN: 0, comparable: true },
    prison: { label: 'Prisoners per 100k (realistic scale)', fmt: x => x.toFixed(0), num: 'people serving a prison sentence', den: 'residents', obs: 'each December after year 5', minN: 0, comparable: true, note: 'Prison only: people held in the police lock-up awaiting court and people in rehab are counted separately.' },
    clearance: { label: 'Share of crimes solved', fmt: U.fmtPct, num: 'crimes with an arrest', den: 'crimes committed', obs: 'whole run', minN: 30, comparable: false, note: 'Arrests per crime committed, not the official charge or clearance rate (definitions differ by country).' },
    revenue: { label: 'Public revenue per person / month (Year-1 $)', fmt: money, num: 'revenue collected in each month (Year-1 money)', den: 'residents in that same month', obs: 'mean of the last 12 months', minN: 0, comparable: false, note: 'The town government collects taxes that nationally go to several levels of government; compare with care.' },
    tertiary: { label: 'Adults 25-64 with tertiary education (ISCED 5+)', fmt: U.fmtPct, num: 'adults 25-64 whose highest credential is ISCED 5 or higher', den: 'adults 25-64 in town', obs: 'end of run', minN: 20, comparable: true }, // C02
  };
  Cal.DEFS = DEFS;

  // Period life expectancy from deaths and person-years lived in the last `years` years
  // (people who were away from town are left out of the exposure).
  function lifeExpectancy(w, years) {
    const end = w.day, start = Math.max(0, end - years * 365);
    const bands = 21, D = new Float64Array(bands), E = new Float64Array(bands); // 5-year bands, 100+
    for (const p of w.people) {
      if (p.away || p.arrivedDay !== null) continue;
      const birth = p.birthDay, death = p.deathDay !== null ? p.deathDay : end;
      const a0 = Math.max(start, birth), a1 = Math.min(end, death);
      if (a1 <= a0) continue;
      for (let b = 0; b < bands; b++) {
        const lo = birth + b * 5 * 365, hi = b === bands - 1 ? Infinity : birth + (b + 1) * 5 * 365;
        const ov = Math.min(a1, hi) - Math.max(a0, lo);
        if (ov > 0) E[b] += ov / 365;
      }
      if (p.deathDay !== null && p.deathDay >= start && !p.fate) D[Math.min(bands - 1, Math.floor((p.deathDay - birth) / 365 / 5))]++;
    }
    let alive = 1, e0 = 0;
    for (let b = 0; b < bands; b++) {
      const m = E[b] > 0 ? D[b] / E[b] : (b === bands - 1 ? 0.3 : 0);
      if (b === bands - 1) { e0 += alive / Math.max(m, 0.05); break; }
      const q = 1 - Math.exp(-5 * m);
      e0 += 5 * alive * (1 - q / 2);
      alive *= 1 - q;
    }
    return e0;
  }

  // The settings a calibration run uses (C11): the chosen country's own defaults (life expectancy, outside market,
  // inflation range, goal...), as the setup screen applies them, under any settings given explicitly. Without this a
  // run with only { country: 'uk' } kept Malaysia's DEFAULTS (mortMult 1.9 instead of the UK's 0.85).
  Cal.config = function (extra) {
    const pack = LES.Countries.get((extra && extra.country) || 'my');
    return Object.assign({}, (pack && pack.defaults) || {}, extra || {});
  };

  Cal.measure = function (w) {
    const r = { seed: w.cfg.seed, years: Math.floor(w.day / 365), pop: w.counts.living };
    // Period TFR from age-specific birth rates (C05); completed family size of women born here who reached 45.
    const pt = Cal.periodTfr(w, 10);
    r.tfr = pt.births >= DEFS.tfr.minN ? pt.tfr : NaN; r.n = { tfr: pt.births }; r.tfrParts = { B: Array.from(pt.B), E: Array.from(pt.E) }; // (pooled over seeds in Cal.table)
    const women = w.people.filter(p => p.sex === 'F' && p.parents.length && !p.migrant && P.age(w, p) >= 45);
    r.completedFert = women.length >= 5 ? women.reduce((s, p) => s + p.children.length, 0) / women.length : NaN; r.n.completedFert = women.length;
    r.e0 = lifeExpectancy(w, Math.min(40, Math.max(10, r.years)));
    const h = w.history.slice(-120);
    r.unemp = h.length ? h.reduce((s, x) => s + x.unemployed / Math.max(1, x.unemployed + x.employed + x.owners), 0) / h.length : NaN;
    const wages = w.living.filter(p => p.alive && p.job).map(p => p.job.salary / w.price / 100).sort((a, b) => a - b);
    r.medWage = wages.length >= DEFS.medWage.minN ? U.quantile(wages, 0.5) : NaN; r.n.medWage = wages.length;
    // Household gross income: heads plus partners (monthly income average).
    const hh = [];
    for (const p of w.living) {
      if (!p.alive || !p.adult || !p.isHead) continue;
      let inc = p.incomeEMA;
      if (p.partnerId !== null) inc += w.people[p.partnerId].incomeEMA;
      hh.push(inc);
    }
    r.hhGini = hh.length >= DEFS.hhGini.minN ? U.gini(hh) : NaN; r.n.hhGini = hh.length;
    const prime = w.living.filter(p => p.alive && !p.away && P.age(w, p) >= 25 && P.age(w, p) < 65);
    r.tertiaryN = prime.length; r.tertiaryHits = prime.filter(p => Cal.eduLevel(p) >= 5).length; // each person once, by the highest credential
    r.tertiary = prime.length >= Cal.MIN_EDU_N ? r.tertiaryHits / prime.length : NaN;
    const dead = w.people.filter(p => !p.alive && p.causeOfDeath);
    r.starve = dead.length ? dead.filter(p => p.causeOfDeath === 'starvation').length / dead.length : 0;
    if (w.crime) { // averaged over the yearly history rows after year 5, scaled back to "Realistic"
      const k = LES.Crime.INTENSITY[w.cfg.crime] || 1, rows = w.history.filter(x => x.cr && x.day > 5 * 365 && U.dayToDate(x.day).month === 11);
      const avg = f => (rows.length ? rows.reduce((s, x) => s + f(x.cr), 0) / rows.length / k : NaN);
      r.crimeIdx = avg(c => c.index); r.drugUsers = avg(c => c.users); r.prison = avg(c => c.prison);
      r.custody = avg(c => c.custody || 0); // police lock-up awaiting court (not prison)
      r.clearance = w.crime.crimesTotal >= DEFS.clearance.minN ? w.crime.solvedTotal / w.crime.crimesTotal : NaN; r.n.clearance = w.crime.crimesTotal;
    }
    if (w.gov && w.gov.revHist.length) {
      const rv = Cal.revenuePerPerson(w.gov.revHist, w.gov.revBase, w.price, w.counts.living);
      r.revenue = rv.value; r.revenueApprox = rv.approx; // approx: an older save without each month's population
    }
    r.n.tertiary = r.tertiaryN;
    r.intervened = !!(LES.God && LES.God.intervened(w)); // a sandbox world (C09b): not a research run
    return r;
  };

  // Revenue per person per month in Year-1 money (C05): each month's revenue over THAT month's residents and price
  // level, averaged over the last 12 months. Older saves have no monthly base: the last month's residents and
  // price are used instead and the result is marked approximate.
  Cal.revenuePerPerson = function (revHist, revBase, priceNow, popNow) {
    const n = Math.min(12, revHist.length);
    if (!n) return { value: NaN, approx: false };
    const rev = revHist.slice(-n), base = revBase && revBase.length >= n ? revBase.slice(-n) : null;
    if (!base) return { value: U.sum(rev) / n / priceNow / 100 / Math.max(1, popNow), approx: true };
    let s = 0;
    for (let i = 0; i < n; i++) s += rev[i] / (Math.max(1, base[i][0]) * base[i][1] * 100);
    return { value: s / n, approx: false };
  };

  // Period TFR from several seeds: births and person-years added up band by band (one town is too small).
  Cal.pooledTfr = function (rows) {
    const B = new Array(7).fill(0), E = new Array(7).fill(0);
    let births = 0;
    for (const r of rows) if (r.tfrParts) for (let b = 0; b < 7; b++) { B[b] += r.tfrParts.B[b]; E[b] += r.tfrParts.E[b]; births += r.tfrParts.B[b]; }
    if (births < DEFS.tfr.minN) return NaN;
    let tfr = 0;
    for (let b = 0; b < 7; b++) if (E[b] > 0) tfr += 5 * B[b] / E[b];
    return tfr;
  };
  // Period total fertility rate over the last `years`: births to women in 5-year age bands 15-49 divided by the
  // person-years those women lived in town in each band, times 5, summed. Women away from town are left out.
  Cal.periodTfr = function (w, years) {
    const end = w.day, start = Math.max(0, end - years * 365), B = new Float64Array(7), E = new Float64Array(7);
    let births = 0;
    for (const p of w.people) {
      if (p.sex !== 'F' || p.away) continue;
      const from = Math.max(start, p.arrivedDay !== null && p.arrivedDay !== undefined ? p.arrivedDay : p.birthDay), to = Math.min(end, p.deathDay !== null ? p.deathDay : end);
      for (let b = 0; b < 7; b++) {
        const lo = p.birthDay + (15 + 5 * b) * 365, hi = lo + 5 * 365, ov = Math.min(to, hi) - Math.max(from, lo);
        if (ov > 0) E[b] += ov / 365;
      }
      for (const id of p.children) {
        const c = w.people[id];
        if (!c || c.birthDay < start || c.birthDay > end || c.birthDay < from) continue;
        const a = (c.birthDay - p.birthDay) / 365, b = Math.floor((a - 15) / 5);
        if (b >= 0 && b < 7) { B[b]++; births++; }
      }
    }
    let tfr = 0;
    for (let b = 0; b < 7; b++) if (E[b] > 0) tfr += 5 * B[b] / E[b];
    return { tfr, births, B, E };
  };

  Cal.status = (k, v) => {
    const t = Cal.TARGETS[k];
    if (!Number.isFinite(v)) return 'n/a';
    const d = Math.abs(v - t.target);
    return d <= t.band ? 'ok' : d <= 2 * t.band ? 'warn' : 'off';
  };

  // Plain-text table (Node) of the mean over seeds.
  Cal.table = function (rows) {
    const lines = [`Calibration over ${rows.length} seed(s), ${rows[0] ? rows[0].years : 0} years (${LES.Countries.pack.name} targets)`];
    for (const k of Object.keys(Cal.TARGETS)) {
      const t = Cal.TARGETS[k], vals = rows.map(r => r[k]).filter(Number.isFinite);
      let v = vals.length ? U.sum(vals) / vals.length : NaN;
      if (k === 'tfr') v = Cal.pooledTfr(rows); // small towns: births and exposure pooled over the seeds
      lines.push(`${t.label.padEnd(46)} sim ${String(Number.isFinite(v) ? t.fmt(v) : 'n/a').padStart(8)}   target ${String(t.fmt(t.target)).padStart(8)}   ${Cal.status(k, v)}`);
    }
    const cf = rows.map(r => r.completedFert).filter(Number.isFinite);
    if (cf.length) lines.push(`${'(Completed children per woman, 45+)'.padEnd(46)} sim ${(U.sum(cf) / cf.length).toFixed(2).padStart(8)}   (not a TFR; shown for comparison)`);
    for (const k of Object.keys(Cal.TARGETS)) if (DEFS[k].comparable === false) lines.push(`Note on ${Cal.TARGETS[k].label}: ${DEFS[k].note}`);
    if (rows.some(r => r.intervened)) lines.push('Note: a sandbox world with interventions (Fate): not a controlled research run; Fate deaths are left out of life expectancy.');
    if (rows.some(r => r.revenueApprox)) lines.push('Note: revenue per person is approximate for a save made before each month\'s population was recorded.');
    if (rows[0] && rows[0].years < 60) lines.push('Note: fewer than 60 years simulated, so life expectancy and children per woman are not meaningful yet.');
    return lines.join('\n');
  };
  LES.Countries.require(...Object.keys(DEFS).map(k => 'calibration.' + k));
  LES.Countries.on('calibration', pack => {
    for (const k of Object.keys(Cal.TARGETS)) delete Cal.TARGETS[k];
    const sym = pack.money.symbol;
    for (const k of Object.keys(DEFS)) {
      const d = DEFS[k], t = pack.calibration[k];
      Cal.TARGETS[k] = { label: d.label.replace('$', sym), target: t.target, band: t.band, fmt: d.fmt, src: t.src, comparable: d.comparable !== false, note: d.note || '', num: d.num, den: d.den, obs: d.obs };
    }
  });
})(globalThis.LES = globalThis.LES || {});
