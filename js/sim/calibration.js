// Calibration: measures a finished (or running) world and compares it with Malaysian
// reference figures. Used by tools/calibration.html and `node tools/headless.js calib`.
// The targets anchor the default settings; they do not make the simulation a forecast.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P;
  const Cal = LES.Calibration = {};

  // [label, target, warn band (abs), unit, source]
  Cal.TARGETS = {
    tfr: { label: 'Children per woman', target: 1.6, band: 0.35, fmt: x => x.toFixed(2), src: 'DOSM Vital Statistics 2025 (TFR 2024 = 1.6; 2025 = 1.5)' },
    e0: { label: 'Life expectancy at birth (yrs)', target: 75.3, band: 3, fmt: x => x.toFixed(1), src: 'DOSM Abridged Life Tables 2023-2025' },
    unemp: { label: 'Unemployment rate', target: 0.03, band: 0.015, fmt: U.fmtPct, src: 'DOSM Labour Force Survey, Aug 2026 (2.9%)' },
    medWage: { label: 'Median monthly wage (Year-1 RM)', target: 3000, band: 600, fmt: x => `RM${Math.round(x)}`, src: 'DOSM formal-sector median wage, Q2 2026' },
    hhGini: { label: 'Household income Gini', target: 0.39, band: 0.06, fmt: x => x.toFixed(2), src: 'DOSM Household Income Survey 2024' },
    starve: { label: 'Deaths from starvation (share)', target: 0, band: 0.01, fmt: U.fmtPct, src: 'Hardcore poverty nearly eradicated (DOSM HIES 2024)' },
    // Crime rates are compared at the "Realistic" scale (the town's rate divided by the intensity).
    crimeIdx: { label: 'Index crime per 100k (realistic scale)', target: 170, band: 70, fmt: x => x.toFixed(0), src: 'DOSM Crime Statistics 2025 (58,255 cases in 2024)' },
    drugUsers: { label: 'Drug users per 100k (realistic scale)', target: 586, band: 250, fmt: x => x.toFixed(0), src: 'AADK 2024 (192,857 users)' },
    prison: { label: 'Prisoners per 100k (realistic scale)', target: 256, band: 110, fmt: x => x.toFixed(0), src: 'World Prison Brief, Nov 2024 (87,419)' },
  };

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
      if (p.deathDay !== null && p.deathDay >= start) D[Math.min(bands - 1, Math.floor((p.deathDay - birth) / 365 / 5))]++;
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

  Cal.measure = function (w) {
    const r = { seed: w.cfg.seed, years: Math.floor(w.day / 365), pop: w.counts.living };
    // Completed fertility of women born in town who reached 45.
    const women = w.people.filter(p => p.sex === 'F' && p.parents.length && !p.migrant && P.age(w, p) >= 45);
    r.tfr = women.length >= 5 ? women.reduce((s, p) => s + p.children.length, 0) / women.length : NaN;
    r.e0 = lifeExpectancy(w, Math.min(40, Math.max(10, r.years)));
    const h = w.history.slice(-120);
    r.unemp = h.length ? h.reduce((s, x) => s + x.unemployed / Math.max(1, x.unemployed + x.employed + x.owners), 0) / h.length : NaN;
    const wages = w.living.filter(p => p.alive && p.job).map(p => p.job.salary / w.price / 100).sort((a, b) => a - b);
    r.medWage = wages.length ? U.quantile(wages, 0.5) : NaN;
    // Household gross income: heads plus partners (monthly income average).
    const hh = [];
    for (const p of w.living) {
      if (!p.alive || !p.adult || !p.isHead) continue;
      let inc = p.incomeEMA;
      if (p.partnerId !== null) inc += w.people[p.partnerId].incomeEMA;
      hh.push(inc);
    }
    r.hhGini = U.gini(hh);
    const dead = w.people.filter(p => !p.alive && p.causeOfDeath);
    r.starve = dead.length ? dead.filter(p => p.causeOfDeath === 'starvation').length / dead.length : 0;
    if (w.crime) { // averaged over the yearly history rows after year 5, scaled back to "Realistic"
      const k = LES.Crime.INTENSITY[w.cfg.crime] || 1, rows = w.history.filter(x => x.cr && x.day > 5 * 365 && U.dayToDate(x.day).month === 11);
      const avg = f => (rows.length ? rows.reduce((s, x) => s + f(x.cr), 0) / rows.length / k : NaN);
      r.crimeIdx = avg(c => c.index); r.drugUsers = avg(c => c.users); r.prison = avg(c => c.prison);
    }
    return r;
  };

  Cal.status = (k, v) => {
    const t = Cal.TARGETS[k];
    if (!Number.isFinite(v)) return 'n/a';
    const d = Math.abs(v - t.target);
    return d <= t.band ? 'ok' : d <= 2 * t.band ? 'warn' : 'off';
  };

  // Plain-text table (Node) of the mean over seeds.
  Cal.table = function (rows) {
    const lines = [`Calibration over ${rows.length} seed(s), ${rows[0] ? rows[0].years : 0} years (Malaysia targets)`];
    for (const k of Object.keys(Cal.TARGETS)) {
      const t = Cal.TARGETS[k], vals = rows.map(r => r[k]).filter(Number.isFinite);
      const v = vals.length ? U.sum(vals) / vals.length : NaN;
      lines.push(`${t.label.padEnd(34)} sim ${String(Number.isFinite(v) ? t.fmt(v) : 'n/a').padStart(8)}   target ${String(t.fmt(t.target)).padStart(8)}   ${Cal.status(k, v)}`);
    }
    if (rows[0] && rows[0].years < 60) lines.push('Note: fewer than 60 years simulated, so life expectancy and children per woman are not meaningful yet.');
    return lines.join('\n');
  };
})(globalThis.LES = globalThis.LES || {});
