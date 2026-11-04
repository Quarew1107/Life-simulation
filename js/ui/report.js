// Simulation report: a self-contained HTML page (opens in a new tab, can be saved)
// with results, a rule-based "why it turned out this way" analysis, Hall of Fame,
// biographies and charts. Every sentence is computed from this run's own data.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const R = LES.Report = {};
  const esc = U.esc;
  const real = (w, sen, day) => sen / priceAt(w, day);
  function priceAt(w, day) {
    const h = w.history;
    let lo = 0, hi = h.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (h[mid].day <= day) lo = mid; else hi = mid - 1; }
    return (h[lo] && h[lo].price) || 1;
  }

  // Spearman rank correlation.
  function spearman(xs, ys) {
    const n = xs.length;
    if (n < 8) return 0;
    const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(n); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
    const rx = rank(xs), ry = rank(ys);
    let d2 = 0;
    for (let i = 0; i < n; i++) d2 += (rx[i] - ry[i]) ** 2;
    return 1 - 6 * d2 / (n * (n * n - 1));
  }
  const median = a => (a.length ? U.median(a) : 0);
  const pct = x => `${Math.round(x * 100)}%`;
  const corrWord = r => (Math.abs(r) < 0.1 ? 'almost no' : Math.abs(r) < 0.25 ? 'a weak' : Math.abs(r) < 0.45 ? 'a moderate' : 'a strong') + (r >= 0 ? ' positive' : ' negative');

  // Collect per-person outcome rows (adults who reached 30).
  R.collect = function (w) {
    const rows = [];
    for (const p of w.people) {
      if (!p.adult && p.alive) continue;
      const age = P.age(w, p);
      if (age < 30) continue;
      const peakReal = Math.max(0, ...p.nwHist.map(([d, v]) => real(w, v, d)), real(w, p.peakNw, p.deathDay || w.day));
      const e = p.earned;
      const earnedTotal = Math.max(1, e.wages + e.gigs + e.business + e.invest + e.interest + e.inherit + e.gifts + e.luck + e.welfare);
      rows.push({
        p, age, peakReal, logW: Math.log10(Math.max(1000, peakReal)),
        inheritShare: (e.inherit + e.gifts) / earnedTotal,
        strategy: p.stratHist.length ? p.stratHist[0].strategy : p.strategy,
        finalStrategy: p.strategy,
        qual: p.quals.includes('MED') ? 'Medicine' : p.quals.includes('MASTER') ? "Master's" : p.quals.some(P.isBachelor) ? 'Bachelor' : p.quals.includes('VOC') ? 'Vocational' : 'None',
        founded: w.biz.filter(b => b.founderId === p.id).length,
        failures: p.bizFailures,
        luckEvents: p.log.filter(x => x.cat === 'luck').length,
        bad: p.log.filter(x => x.cat === 'luck' && /ill|injured|scam|accident/i.test(x.text)).length,
      });
    }
    return rows;
  };

  R.analyse = function (w) {
    const rows = R.collect(w), st = w.stats, h = w.history, last = h[h.length - 1];
    const years = Math.max(1, Math.round(w.day / 365));
    const out = { rows, years, paras: [], awards: [], bios: [] };
    const sorted = rows.slice().sort((a, b) => b.peakReal - a.peakReal);
    const top10 = sorted.slice(0, 10);
    const winner = w.winner ? w.people[w.winner.pid] : null;
    const richest = sorted[0];

    // 1. Headline
    if (winner) {
      const wr = rows.find(r => r.p === winner);
      const biz = w.biz.filter(b => b.founderId === winner.id);
      out.paras.push(`<b>${esc(P.name(winner))}</b> was the first to reach the ${U.fmtMoney(w.goal)} goal, in Year ${U.dayToDate(w.winner.day).year} at age ${w.winner.age}. Their path: ${C.STRATEGY_NAMES[wr ? wr.strategy : winner.strategy]} strategy at the start${winner.stratHist.length > 1 ? `, later ${C.STRATEGY_NAMES[winner.strategy]}` : ''}; ${biz.length ? `founded ${biz.length} business${biz.length > 1 ? 'es' : ''} (${biz.map(b => esc(b.name)).slice(0, 3).join(', ')}) with ${biz.reduce((s, b) => s + b.booms, 0)} breakthrough${biz.reduce((s, b) => s + b.booms, 0) === 1 ? '' : 's'}` : 'no businesses'}; ${wr && wr.inheritShare > 0.2 ? `${pct(wr.inheritShare)} of their lifetime income came from inheritance or gifts` : 'almost entirely self-made'}.`);
    } else {
      out.paras.push(`Nobody reached the ${U.fmtMoney(w.goal)} goal in ${years} years. The richest person ever was <b>${richest ? esc(P.name(richest.p)) : '—'}</b> with a peak of ${richest ? U.fmtMoney(richest.peakReal) : '—'} in Year-1 money — ${richest ? (richest.peakReal / w.goal * 100).toFixed(1) : 0}% of the goal. In this world the goal was out of reach: a salary alone cannot get there, and only rare business breakthroughs come close.`);
    }

    // 2. Strategies
    const byStrat = {};
    for (const r of rows) (byStrat[r.strategy] = byStrat[r.strategy] || []).push(r);
    const stratStats = C.STRATEGIES.filter(s => byStrat[s] && byStrat[s].length >= 3).map(s => {
      const g = byStrat[s];
      return { s, n: g.length, med: median(g.map(r => r.peakReal)), inTop: top10.filter(r => r.strategy === s).length, fail: U.sum(g.map(r => r.failures)) };
    });
    if (stratStats.length) {
      const bestMed = stratStats.slice().sort((a, b) => b.med - a.med)[0];
      const bestTop = stratStats.slice().sort((a, b) => b.inTop - a.inTop)[0];
      const ent = stratStats.find(x => x.s === 'ENT');
      out.strat = stratStats;
      out.paras.push(`<b>Strategy.</b> People who started with the <b>${C.STRATEGY_NAMES[bestMed.s]}</b> strategy had the best typical outcome (median peak ${U.fmtMoney(bestMed.med)}), while <b>${C.STRATEGY_NAMES[bestTop.s]}</b> produced the most top-10 fortunes (${bestTop.inTop} of 10).${ent ? ` Entrepreneurs had ${ent.fail} business failures between ${ent.n} of them${bestMed.s !== 'ENT' ? ' and a lower typical outcome — high risk, high variance' : ''}.` : ''}`);
    }

    // 3. Attributes & personality
    const ys = rows.map(r => r.logW);
    const factors = [];
    C.ATTR_NAMES.forEach((name, i) => factors.push({ name, r: spearman(rows.map(r => r.p.pot[i]), ys) }));
    C.PERS.forEach(k => factors.push({ name: C.PERS_NAMES[k], r: spearman(rows.map(r => r.p.pers[k]), ys) }));
    factors.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    out.factors = factors;
    if (rows.length >= 8) {
      const f = factors.slice(0, 3);
      out.paras.push(`<b>What mattered most?</b> Among ${rows.length} adults who reached 30, peak wealth had ${corrWord(f[0].r)} link with <b>${f[0].name}</b> (r = ${f[0].r.toFixed(2)}), ${corrWord(f[1].r)} link with ${f[1].name} (${f[1].r.toFixed(2)}) and ${corrWord(f[2].r)} link with ${f[2].name} (${f[2].r.toFixed(2)}). ${Math.abs(f[0].r) < 0.25 ? 'No single trait strongly predicted success — circumstances and luck dominated.' : ''}`);
    }

    // 4. Education
    const byQ = {};
    for (const r of rows) (byQ[r.qual] = byQ[r.qual] || []).push(r.peakReal);
    out.edu = Object.keys(byQ).map(q => ({ q, n: byQ[q].length, med: median(byQ[q]) })).sort((a, b) => b.med - a.med);
    if (out.edu.length > 1) out.paras.push(`<b>Education.</b> Median peak wealth by highest qualification: ${out.edu.map(e => `${e.q} ${U.fmtMoney(e.med)} (n=${e.n})`).join(', ')}.`);

    // 5. Inheritance and luck
    if (top10.length) {
      const inh = median(top10.map(r => r.inheritShare));
      const luckyTop = top10.filter(r => r.p.log.some(x => /windfall|breakthrough/i.test(x.text))).length;
      out.paras.push(`<b>Inheritance and luck.</b> For the 10 richest, a median ${pct(inh)} of lifetime income came from inheritance or gifts. ${luckyTop} of the top 10 had a windfall or a business breakthrough, against ${st.booms} breakthroughs and ${st.windfalls} windfalls in the whole town. ${luckyTop >= 6 ? 'Luck was a big part of the biggest fortunes.' : 'Most top fortunes were built without a single lucky break.'}`);
    }

    // 6. Social mobility
    const kids = rows.filter(r => r.p.parents.length === 2);
    if (kids.length >= 10) {
      const pw = r => Math.max(...r.p.parents.map(id => { const q = w.people[id]; return Math.max(0, ...q.nwHist.map(([d, v]) => real(w, v, d))); }));
      const parentW = kids.map(pw), childW = kids.map(r => r.peakReal);
      const q = (arr, v) => { const s = arr.slice().sort((a, b) => a - b); return Math.min(4, Math.floor(s.findIndex(x => x >= v) / s.length * 5)); };
      let poorToRich = 0, poor = 0;
      kids.forEach((r, i) => { if (q(parentW, parentW[i]) === 0) { poor++; if (q(childW, childW[i]) >= 3) poorToRich++; } });
      const mob = spearman(parentW, childW);
      out.mobility = { n: kids.length, corr: mob, poor, poorToRich };
      out.paras.push(`<b>Social mobility.</b> ${kids.length} people born in town reached 30. Their wealth had ${corrWord(mob)} link with their parents' wealth (r = ${mob.toFixed(2)}). ${poor ? `${poorToRich} of ${poor} children from the poorest fifth of families climbed into the top two-fifths.` : ''}`);
    }

    // 7. Economy & migration
    const rec = w.regimeHist.filter(x => x.regime === 'recession').length;
    const infl = w.inflHist.length ? U.sum(w.inflHist.map(x => x.rate)) / w.inflHist.length : 0;
    out.paras.push(`<b>Economy.</b> ${rec} recession${rec === 1 ? '' : 's'} and ${w.regimeHist.filter(x => x.regime === 'growth').length} booms; average inflation ${(infl * 100).toFixed(1)}% a year, so prices rose ×${w.price.toFixed(2)}. The ${LES.Countries.pack.names.exchangeShort} index ended at ${w.mkt.idx.toFixed(0)} (from 100), with ${st.panicSells} panic sell-offs by residents. ${st.bizStarted} businesses were started and ${st.bizFailed} failed.${st.immigrants + st.emigrants ? ` ${st.immigrants} people moved in, ${st.emigrants} moved out and ${st.returns} came back.` : ''}`);
    const mig = rows.filter(r => r.p.migrant), loc = rows.filter(r => !r.p.migrant);
    if (mig.length >= 5) out.paras.push(`<b>Migrants vs locals.</b> Median peak wealth: migrants ${U.fmtMoney(median(mig.map(r => r.peakReal)))} (n=${mig.length}), locals ${U.fmtMoney(median(loc.map(r => r.peakReal)))} (n=${loc.length}). Migrants usually arrive later in life with less time in town, so compare with care.`);

    // 8. Life goals and happiness: success is not only money.
    const G = LES.Goals, adults = w.people.filter(p => p.adult);
    const achieved = G.IDS.map(id => ({ id, n: st.goalsAchieved[id] || 0 })).sort((a, b) => b.n - a.n);
    const totalGoals = U.sum(achieved.map(x => x.n));
    const living = rows.filter(r => r.p.alive && !r.p.away);
    const moneyHappy = living.length >= 8 ? spearman(living.map(r => r.p.nw), living.map(r => r.p.happy)) : 0;
    out.goals = achieved;
    out.moneyHappy = moneyHappy;
    if (totalGoals) {
      const top = achieved.filter(x => x.n).slice(0, 3).map(x => `${G.DEFS[x.id].icon} ${G.DEFS[x.id].name.toLowerCase()} (${x.n})`).join(', ');
      const neverRich = adults.filter(p => p.goalsDone.length && p.peakNw / w.price < U.RM(1e6)).length;
      out.paras.push(`<b>Life goals.</b> Residents achieved ${totalGoals} personal goals; the most common were ${top}. ${neverRich} people achieved at least one goal without ever becoming millionaires. Today's adults have ${corrWord(moneyHappy)} link between wealth and happiness (r = ${moneyHappy.toFixed(2)}) — ${moneyHappy < 0.25 ? 'money bought little happiness here; family, health and leisure mattered more' : 'money did help, mostly through better homes, leisure and less stress'}.`);
    }

    // Hall of Fame
    const award = (title, r, why) => { if (r) out.awards.push({ title, pid: r.p.id, name: P.name(r.p), why }); };
    const rowOf = p => rows.find(r => r.p === p) || { p };
    const happiest = adults.filter(p => p.alive).sort((a, b) => b.happyAvg - a.happyAvg)[0];
    if (happiest) award('Happiest', rowOf(happiest), `average happiness ${Math.round(happiest.happyAvg)}/100`);
    const achiever = adults.slice().sort((a, b) => b.goalsDone.length - a.goalsDone.length)[0];
    if (achiever && achiever.goalsDone.length >= 2) award('Most goals achieved', rowOf(achiever), `${achiever.goalsDone.length} life goals`);
    const fittest = adults.filter(p => p.alive).sort((a, b) => (b.att[C.STR] + b.att[C.END] + b.att[C.AGI]) - (a.att[C.STR] + a.att[C.END] + a.att[C.AGI]))[0];
    if (fittest) award('Fittest', rowOf(fittest), `strength/endurance/agility ${((fittest.att[C.STR] + fittest.att[C.END] + fittest.att[C.AGI]) / 3).toFixed(1)}`);
    award('Richest ever', richest, richest && `peak ${U.fmtMoney(richest.peakReal)}`);
    const selfMade = sorted.find(r => r.inheritShare < 0.05);
    award('Most self-made', selfMade, selfMade && `peak ${U.fmtMoney(selfMade.peakReal)}, under 5% inherited`);
    const comeback = rows.filter(r => r.failures > 0 || r.p.log.some(x => /bankrupt/i.test(x.text))).sort((a, b) => b.peakReal - a.peakReal)[0];
    award('Biggest comeback', comeback, comeback && `${comeback.failures} failed business${comeback.failures === 1 ? '' : 'es'}, still peaked at ${U.fmtMoney(comeback.peakReal)}`);
    const serial = rows.slice().sort((a, b) => b.founded - a.founded)[0];
    if (serial && serial.founded >= 2) award('Serial entrepreneur', serial, `founded ${serial.founded} businesses`);
    const unlucky = rows.slice().sort((a, b) => b.bad - a.bad)[0];
    if (unlucky && unlucky.bad >= 2) award('Unluckiest', unlucky, `${unlucky.bad} illnesses, injuries or scams`);
    const desc = p => { let n = 0; const stack = [...p.children]; const seen = new Set(); while (stack.length) { const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); n++; stack.push(...w.people[id].children); } return n; };
    const famRow = rows.filter(r => r.p.gen === 0).map(r => ({ r, n: desc(r.p) })).sort((a, b) => b.n - a.n)[0];
    if (famRow && famRow.n) award('Largest family', famRow.r, `${famRow.n} descendants`);
    const oldest = rows.slice().sort((a, b) => b.age - a.age)[0];
    award('Longest life', oldest, oldest && `${Math.floor(oldest.age)} years`);

    // Biographies of notable lives
    const notable = [];
    for (const a of out.awards) if (!notable.includes(a.pid)) notable.push(a.pid);
    out.bios = notable.slice(0, 6).map(id => {
      const p = w.people[id];
      return { p, events: p.log.filter(x => x.imp >= 1).slice(0, 18) };
    });
    out.top = sorted.slice(0, 20);
    return out;
  };

  // ---- Inline SVG line chart for the static report ----
  function svgChart(series, opts) {
    const W = 620, H = 200, pl = 56, pr = 10, pt = 20, pb = 22;
    const all = series.flatMap(s => s.data);
    if (!all.length) return '';
    const tf = opts.log ? v => Math.log10(Math.max(1, v)) : v => v;
    let x0 = Math.min(...all.map(d => d[0])), x1 = Math.max(...all.map(d => d[0]));
    let y0 = opts.log ? Math.floor(Math.min(...all.map(d => tf(d[1])))) : 0, y1 = Math.max(...all.map(d => tf(d[1])));
    if (opts.log) y1 = Math.ceil(y1); else y1 *= 1.08;
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
    const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = v => pt + (1 - (tf(v) - y0) / (y1 - y0)) * (H - pt - pb);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(opts.title || 'chart')}">`;
    for (let i = 0; i <= 4; i++) {
      const t = y0 + (y1 - y0) * i / 4, y = pt + (1 - i / 4) * (H - pt - pb);
      const v = opts.log ? Math.pow(10, t) : t;
      svg += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity=".12"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="currentColor" opacity=".6">${esc(opts.fmt ? opts.fmt(v) : v.toFixed(0))}</text>`;
    }
    for (let i = 0; i <= 4; i++) { const x = x0 + (x1 - x0) * i / 4; svg += `<text x="${X(x)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">Y${Math.floor(x) + 1}</text>`; }
    let lx = pl;
    for (const s of series) {
      svg += `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${s.data.map(d => `${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join(' ')}"/>`;
      svg += `<rect x="${lx}" y="5" width="10" height="3" fill="${s.color}"/><text x="${lx + 14}" y="10" font-size="10" fill="currentColor">${esc(s.label)}</text>`;
      lx += 14 + s.label.length * 6 + 16;
    }
    return svg + '</svg>';
  }

  // Class mobility and religion (only when the society system is on).
  function societySection(w) {
    const S = LES.Society, SO = LES.Countries.pack.society;
    if (!w.society || !S) return '';
    const mob = S.mobility(w), st = w.society, pc = x => `${Math.round(x * 100)}%`;
    const rows = S.CLASSES.map(a => { const r = mob.m[a], n = S.CLASSES.reduce((t, b) => t + r[b], 0); return `<tr><td>${a}</td>${S.CLASSES.map(b => `<td>${n ? pc(r[b] / n) : '–'}</td>`).join('')}<td>${n}</td></tr>`; }).join('');
    const rel = S.groupStats(w, 'rel');
    return `<section><h2>Class and community</h2><div class="grid">
<div class="card"><b>Social mobility</b> <span class="note">household class at 12 → own class at 35</span><table><tr><th>Grew up</th>${S.CLASSES.map(c => `<th>${c}</th>`).join('')}<th>n</th></tr>${rows}</table>
<p class="note">${S.short('B40')} ceiling now ${U.fmtMoney(st.cut40)}, ${S.short('T20')} floor ${U.fmtMoney(st.cut80)} (household income per month, Year-1 money; ${SO.statsOffice} ${SO.cutsYear}: ${U.cur(S.DOSM_B40_MAX)} and ${U.cur(S.DOSM_T20_MIN)}). The ${S.short('T20')} earn ${pc(st.t20share)} of all income.</p></div>
<div class="card"><b>Religion</b><table><tr><th></th><th>Adults</th><th>Median wealth</th><th>${S.short('B40')}</th></tr>${S.REL_KEYS.filter(k => rel[k]).map(k => `<tr><td>${esc(S.RELIGIONS[k].name)}</td><td>${rel[k].n}</td><td>${U.fmtMoney(rel[k].medNw)}</td><td>${pc(rel[k].b40 / rel[k].n)}</td></tr>`).join('')}</table>
<p class="note">Zakat paid ${U.fmtMoney(st.zakatTotal)} · aid from community funds ${U.fmtMoney(st.aidTotal)} · festival spending ${U.fmtMoney(st.festivalSpend)} · ${st.conversions} conversions. Groups differ in practices, not ability; differences here are outcomes of the model and of small samples.</p></div>
</div></section>`;
  }

  // Your cast: how each life went, their main income, family, goals and happiness, with
  // their five most important moments, against the town's medians.
  function castSection(w) {
    const cast = w.people.filter(p => p.custom);
    if (!cast.length) return '';
    const peak = p => Math.max(0, ...p.nwHist.map(([d, v]) => real(w, v, d)), real(w, p.peakNw, p.deathDay || w.day));
    const SRC = { wages: 'wages', gigs: 'gigs', business: 'business', invest: 'investments', inherit: 'inheritance', gifts: 'family gifts', interest: 'interest', welfare: 'welfare', luck: 'luck' };
    const main = p => { const e = p.earned, k = Object.keys(SRC).sort((a, b) => e[b] - e[a])[0]; return e[k] > 0 ? SRC[k] : '—'; };
    const career = p => (p.job ? LES.Labour.title(p.job) : p.manages >= 0 && w.biz[p.manages] ? `runs ${w.biz[p.manages].name}` : w.biz.some(b => b.founderId === p.id) ? 'business founder' : p.retired ? 'retired' : !p.adult ? 'child' : '—');
    const adults = w.people.filter(p => p.adult || P.age(w, p) >= 30), med = arr => (arr.length ? U.median(arr) : 0);
    const townPeak = med(adults.map(peak)), townHappy = med(w.living.filter(p => p.adult).map(p => p.happyAvg));
    const fate = p => (!p.alive ? `died aged ${Math.floor(P.age(w, p))}` : p.away ? 'moved away' : `alive, ${Math.floor(P.age(w, p))}`);
    const rows = cast.map(p => `<tr><td>★ ${esc(P.name(p))}</td><td>${p.migrant ? `arrived ${U.fmtMonthYear(p.arrivedDay || 0)}` : 'founder'}</td><td>${fate(p)}</td><td>${U.fmtMoney(peak(p))}</td><td>${main(p)}</td><td>${esc(career(p))}</td><td>${p.children.length}</td><td>${p.goalsDone.length}</td><td>${Math.round(p.happyAvg)}</td></tr>`).join('');
    const stories = cast.map(p => {
      const major = x => x.imp >= 1 || (['career', 'edu', 'family', 'death', 'goal', 'biz', 'crime', 'migration'].includes(x.cat) && !/^New life goal|^Application|rejected$|^Is expecting/.test(x.text));
      const top = p.log.filter(major).sort((a, b) => b.imp - a.imp || a.day - b.day).slice(0, 5).sort((a, b) => a.day - b.day);
      return `<div class="card"><b>★ ${esc(P.name(p))}</b><ul>${top.map(x => `<li><span class="muted">${U.fmtMonthYear(x.day)}</span> ${esc(x.text)}</li>`).join('') || '<li class="muted">A quiet life.</li>'}</ul></div>`;
    }).join('');
    return `<section><h2>Your cast</h2><table><tr><th>Person</th><th>Joined</th><th>Life</th><th>Peak wealth (Y1)</th><th>Main income</th><th>Career</th><th>Children</th><th>Goals reached</th><th>Happiness</th></tr>${rows}</table>
<p class="note">Town medians for comparison: peak wealth ${U.fmtMoney(townPeak)}, happiness ${Math.round(townHappy)}. Your cast lived by the same rules as everyone else.</p>
<div class="grid">${stories}</div></section>`;
  }

  function regionSection(w) {
    const R = w.region;
    if (!R) return '';
    const com = R.commuters();
    const rows = R.towns.map((t, i) => {
      const h = t.history[t.history.length - 1] || {}, inn = R.moves.filter(m => m.to === i).reduce((s, m) => s + m.n, 0), out = R.moves.filter(m => m.from === i).reduce((s, m) => s + m.n, 0);
      const type = LES.TOWN_TYPES[t.cfg.townType || t.cfg.town1Type || 'mixed'];
      return `<tr><td>${esc(t.townName)}${t === w ? ' (this report)' : ''}</td><td>${esc(type ? type.name : '')}</td><td>${t.counts.living}</td><td>${U.fmtMoney(h.median || 0)}</td><td>${h.unemployed !== undefined ? (h.unemployed / Math.max(1, h.unemployed + h.employed + h.owners) * 100).toFixed(1) + '%' : ''}</td><td>${t.crime ? (n => `${t.crime.gangs.length} (${n} chapter${n === 1 ? '' : 's'})`)(t.crime.gangs.filter(g => g.parent || g.formerParent).length) : '–'}</td><td>${com[i]}</td><td>${inn} / ${out}</td></tr>`;
    }).join('');
    return `<section><h2>The region</h2><table><tr><th>Town</th><th>Type</th><th>People</th><th>Median wealth</th><th>Unemployment</th><th>Gangs formed</th><th>Commuting out</th><th>Moved in / out</th></tr>${rows}</table>
<p class="note">${R.moves.length} household moves between the towns and ${R.commutePosts || 0} job openings advertised across town lines. The towns share one economy, one stock exchange and one monsoon. This report covers ${esc(w.townName)}; switch towns in the top bar for the others.</p></section>`;
  }

  function scenarioSection(w, svgChart) {
    const s = LES.Scenarios.current(w);
    if (!s) return '';
    const h = w.history, chart = svgChart(s.series(h).map(x => ({ label: x.label, color: x.color, data: x.data.map(([d, v]) => [d, v]) })), { log: !!s.logY });
    return `<section><h2>Scenario: ${esc(s.name)}</h2><p>${esc(s.desc)}</p><div class="grid"><div class="card"><b>What happened</b><p>${s.status(w)}</p>${s.report ? s.report(w) : ''}</div><div class="card"><b>Over time</b>${chart}</div></div>
<p class="note">To see what the scenario changed, run the same seed without it (${esc(LES.PRESETS.national.name)}) and compare the two reports.</p></section>`;
  }

  function govSection(w) {
    const GV = LES.Gov, g = w.gov;
    if (!g || !GV) return '';
    const rows = g.elections.map(e => { const win = e.cands.find(c => c.id === e.winner); return `<tr><td>Y${U.dayToDate(e.day).year}</td><td>${esc(win ? win.name : '?')}${win && win.incumbent ? ' (re-elected)' : ''}</td><td>${win ? win.votes : 0} of ${e.voted}</td><td>${e.eligible ? Math.round(e.voted / e.eligible * 100) : 0}%</td></tr>`; }).join('');
    return `<section><h2>Government and elections</h2><div class="grid">
<div class="card"><b>Elections</b><table><tr><th>Year</th><th>Winner</th><th>Votes</th><th>Turnout</th></tr>${rows}</table></div>
<div class="card"><b>Laws at the end</b><table>${GV.LAWS.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(GV.optName(l.key, g.laws[l.key]))}</td></tr>`).join('')}</table>
<p class="note">${g.lawLog.length} law changes · ${g.scandals} corruption scandals · treasury ${U.fmtMoney(g.treasury.cash)}, debt ${U.fmtMoney(g.debt)} · ${g.floods} floods, ${g.hazes} haze episodes.</p></div>
${g.last ? `<div class="card"><b>Public money (last month)</b><table><tr><th>In</th><th></th><th>Out</th><th></th></tr>${(() => { const a = Object.entries(g.last.rev).sort((x, y) => y[1] - x[1]), b = Object.entries(g.last.spend).sort((x, y) => y[1] - x[1]); let t = ''; for (let i = 0; i < Math.max(a.length, b.length); i++) t += `<tr><td>${a[i] ? esc(a[i][0]) : ''}</td><td>${a[i] ? U.fmtMoney(a[i][1]) : ''}</td><td>${b[i] ? esc(b[i][0]) : ''}</td><td>${b[i] ? U.fmtMoney(b[i][1]) : ''}</td></tr>`; return t; })()}</table>
<p class="note">${LES.Countries.pack.names.fund} ${U.fmtMoney(LES.Fiscal.fundValue(w))} · ${LES.Countries.pack.names.policyRate} ${(g.opr * 100).toFixed(2)}% · ${g.projects || 0} development projects · ${g.trained || 0} people trained · school quality ${Math.round((g.eduQ || 1) * 100)}, healthcare ${Math.round((g.healthQ || 1) * 100)}.</p></div>` : ''}
${g.officials ? `<div class="card"><b>City council at the end</b><table>${LES.Council.ORDER.map(r => { const o = g.officials[r]; return `<tr><td>${esc(LES.Council.ROLES[r].title)}</td><td>${o ? esc(LES.Council.name(w, o)) + ` (competence ${Math.round(o.comp * 100)})` : 'vacant'}</td></tr>`; }).join('')}</table></div>` : ''}
</div></section>`;
  }

  function crimeSection(w) {
    const CR = LES.Crime, st = w.crime;
    if (!st || !CR) return '';
    const r = CR.rates(w), k = CR.INTENSITY[w.cfg.crime], tot = Object.values(st.total).reduce((a, b) => a + b, 0);
    return `<section><h2>Crime and justice</h2><div class="grid">
<div class="card"><b>Crimes</b> <span class="note">intensity “${esc(w.cfg.crime)}” (${LES.Countries.pack.adj} rates ×${k})</span><table>${Object.keys(CR.TYPES).map(t => `<tr><td>${CR.TYPES[t].icon} ${esc(CR.TYPES[t].name)}</td><td>${st.total[t] || 0}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${tot}</b></td></tr></table>
<p class="note">Index crime in the last year: ${r.index.toFixed(0)} per 100k (${LES.Countries.pack.name} ${CR.REF.index}${k !== 1 ? ' ×' + k : ''}).</p></div>
<div class="card"><b>Justice, drugs and gangs</b><table>
<tr><td>Arrests / convictions / acquittals</td><td>${st.arrests} / ${st.convictions} / ${st.acquitted}</td></tr>
<tr><td>Prison admissions / released / reoffended in 3 yrs</td><td>${st.admissions} / ${st.released} / ${st.reoffended}</td></tr>
<tr><td>Started using drugs / rehab / overdoses</td><td>${st.startedUsing} / ${st.rehabAdmissions} / ${st.overdoses}</td></tr>
<tr><td>Gangs formed / police raids / turf fights</td><td>${st.gangs.length} / ${st.crackdowns} / ${st.gangFights}</td></tr>
<tr><td>Protection money taken from shops</td><td>${U.fmtMoney(st.protection)}</td></tr></table>
<p class="note">Drug policy: ${esc(w.policy && LES.Gov ? LES.Gov.optName('drugPolicy', w.policy.drugPolicy) : (LES.SETTINGS_META.find(m => m.key === 'drugPolicy').options.find(o => o[0] === w.cfg.drugPolicy) || [, w.cfg.drugPolicy])[1])} · police: ${w.gov ? `${w.gov.officers} officers` : esc(w.cfg.police)} · ${st.crimesTotal ? Math.round(st.solvedTotal / st.crimesTotal * 100) : 0}% of crimes solved. Try the same seed with another drug policy or police strength and compare.</p></div>
</div></section>`;
  }

  R.html = function (w, prev) {
    const a = R.analyse(w), h = w.history, cfg = w.cfg;
    const yr = r => r.day / 365;
    const money = v => U.fmtMoney(v).replace(U.sym(), '');
    const charts = [
      ['Wealth (Year-1 money, log)', svgChart([{ label: 'Richest', color: '#c9971c', data: h.map(r => [yr(r), Math.max(1, r.top)]) }, { label: 'Top 10%', color: '#2a9d8f', data: h.map(r => [yr(r), Math.max(1, r.p90)]) }, { label: 'Median', color: '#3a86ff', data: h.map(r => [yr(r), Math.max(1, r.median)]) }], { log: true, fmt: money })],
      ['Population', svgChart([{ label: 'People', color: '#555', data: h.map(r => [yr(r), r.pop]) }, { label: 'Children', color: '#e76f51', data: h.map(r => [yr(r), r.children]) }], {})],
      [`${LES.Countries.pack.names.exchangeShort} index & price level`, svgChart([{ label: `${LES.Countries.pack.names.exchangeShort} index`, color: '#2a9d8f', data: h.map(r => [yr(r), r.idx]) }, { label: 'Price level ×100', color: '#f4a261', data: h.map(r => [yr(r), (r.price || 1) * 100]) }], { log: true })],
      ['Work', svgChart([{ label: 'Employed', color: '#2a9d8f', data: h.map(r => [yr(r), r.employed]) }, { label: 'Unemployed', color: '#e63946', data: h.map(r => [yr(r), r.unemployed]) }, { label: 'Business owners', color: '#f4a261', data: h.map(r => [yr(r), r.owners]) }], {})],
    ];
    const settings = LES.SETTINGS_META.filter(m => !m.scenario || m.scenario === cfg.scenario).map(m => `<tr><td>${esc(m.label)}</td><td>${esc(m.options ? (m.options.find(o => o[0] === cfg[m.key]) || [, cfg[m.key]])[1] : cfg[m.key])}</td></tr>`).join('');
    const compare = prev ? `<section><h2>Compared with the previous run</h2><table><tr><th></th><th>Previous (${esc(prev.seed)})</th><th>This run (${esc(cfg.seed)})</th></tr>
      ${[['Winner', prev.winner, a.awards[0] && w.winner ? esc(P.name(w.people[w.winner.pid])) : 'none'], ['Richest peak', prev.richest, a.top[0] ? U.fmtMoney(a.top[0].peakReal) : '—'], ['Final median wealth', prev.median, U.fmtMoney(h[h.length - 1].median)], ['Population at end', prev.pop, h[h.length - 1].pop], ['Businesses failed', prev.failed, w.stats.bizFailed]].map(([k, x, y]) => `<tr><td>${k}</td><td>${esc(x)}</td><td>${y}</td></tr>`).join('')}</table>
      <p class="note">Changed settings: ${Object.keys(cfg).filter(k => JSON.stringify(cfg[k]) !== JSON.stringify(prev.cfg[k])).map(esc).join(', ') || 'none (only randomness)'}.</p></section>` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Simulation Report – ${esc(LES.townName(w))}</title>
<style>
:root{--bg:#f6f3ec;--fg:#1d232b;--muted:#5d6875;--card:#fff;--line:#e3ddd0;--acc:#b8862b}
@media (prefers-color-scheme:dark){:root{--bg:#11161c;--fg:#e8edf2;--muted:#94a3b4;--card:#18212b;--line:#2a3542;--acc:#f2c14e}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 Inter,system-ui,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:28px;margin:0}h2{font-size:19px;margin:30px 0 10px;border-bottom:2px solid var(--acc);display:inline-block}
.sub{color:var(--muted)}section{margin-top:8px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.kpi b{display:block;font-size:20px}.kpi span{color:var(--muted);font-size:12px}
p{margin:8px 0}.why p{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:10px;padding:10px 14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
svg.chart{width:100%;height:auto;color:var(--fg)}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left}
.award b{color:var(--acc)}.bio li{margin:2px 0}.note{color:var(--muted);font-size:13px}.disc{margin-top:30px;padding:12px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
@media print{button{display:none}}
</style></head><body><main>
<h1>${esc(LES.townName(w))} — ${a.years}-year simulation report</h1>
<div class="sub">Seed “${esc(cfg.seed)}” · ${cfg.founders} founders · ${esc(LES.MAP_SIZES[w.mapSize].name)} map · generated ${esc(U.fmtDate(Math.max(0, w.lastDay)))} ${w.ended ? '(finished)' : '(in progress)'}</div>
<p><button onclick="(function(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([document.documentElement.outerHTML],{type:'text/html'}));a.download='les-report-${esc(cfg.seed).replace(/[^a-z0-9-]/gi, '_')}.html';a.click();})()">Download this report</button> <button onclick="print()">Print / PDF</button></p>
<div class="kpis">
<div class="kpi"><b>${w.winner ? '🏆 ' + esc(P.name(w.people[w.winner.pid])) : 'No winner'}</b><span>${w.winner ? `reached ${U.fmtMoney(w.goal)} in Year ${U.dayToDate(w.winner.day).year}` : `goal ${U.fmtMoney(w.goal)}`}</span></div>
<div class="kpi"><b>${a.top[0] ? U.fmtMoney(a.top[0].peakReal) : '—'}</b><span>richest ever (Year-1 money)</span></div>
<div class="kpi"><b>${U.fmtMoney(h[h.length - 1].median)}</b><span>median adult wealth at the end</span></div>
<div class="kpi"><b>${h[h.length - 1].pop}</b><span>people alive (${w.stats.births} born, ${w.stats.deaths} died)</span></div>
<div class="kpi"><b>${w.stats.bizStarted} / ${w.stats.bizFailed}</b><span>businesses started / failed</span></div>
<div class="kpi"><b>×${w.price.toFixed(2)}</b><span>price level since Year 1</span></div>
</div>
<section class="why"><h2>Why it turned out this way</h2>${a.paras.map(x => `<p>${x}</p>`).join('')}</section>
${compare}
<section><h2>Charts</h2><div class="grid">${charts.map(([t, s]) => `<div class="card"><b>${t}</b>${s}</div>`).join('')}</div></section>
<section><h2>Hall of Fame</h2><div class="grid">${a.awards.map(x => `<div class="card award"><b>${esc(x.title)}</b><div>${esc(x.name)}</div><div class="note">${esc(x.why || '')}</div></div>`).join('')}</div></section>
<section><h2>Notable lives</h2><div class="grid">${a.bios.map(b => `<div class="card bio"><b>${esc(P.name(b.p))}</b> <span class="note">${b.p.alive ? `${Math.floor(P.age(w, b.p))} years old` : `died aged ${Math.floor(P.age(w, b.p))}`} · ${C.STRATEGY_NAMES[b.p.strategy]}${b.p.migrant ? ' · migrant' : ''}</span><ul>${b.events.map(e => `<li><span class="note">Y${U.dayToDate(e.day).year}</span> ${esc(e.text)}</li>`).join('')}</ul></div>`).join('')}</div></section>
<section><h2>Life goals achieved</h2><table><tr><th>Goal</th><th>Times achieved</th></tr>${(a.goals || []).map(g => `<tr><td>${LES.Goals.DEFS[g.id].icon} ${esc(LES.Goals.DEFS[g.id].name)}</td><td>${g.n}</td></tr>`).join('')}</table>
<p class="note">Everyone has a personal life goal (money, a dream home, family, happiness, fitness, career, education, helping others or a dynasty). Wealth vs happiness among living adults: rank correlation ${(a.moneyHappy || 0).toFixed(2)}.</p></section>
<section><h2>Factors and peak wealth</h2><table><tr><th>Factor</th><th>Rank correlation with peak wealth</th></tr>${(a.factors || []).map(f => `<tr><td>${esc(f.name)}</td><td>${f.r.toFixed(2)} (${corrWord(f.r)})</td></tr>`).join('')}</table>
<p class="note">Spearman rank correlation over adults who reached 30. Correlation is not causation: traits also affect who studies, who starts businesses and who has children.</p></section>
${a.strat ? `<section><h2>Strategies</h2><table><tr><th>Starting strategy</th><th>People</th><th>Median peak wealth</th><th>In top 10</th><th>Business failures</th></tr>${a.strat.map(s => `<tr><td>${C.STRATEGY_NAMES[s.s]}</td><td>${s.n}</td><td>${U.fmtMoney(s.med)}</td><td>${s.inTop}</td><td>${s.fail}</td></tr>`).join('')}</table></section>` : ''}
${castSection(w)}
${regionSection(w)}
${scenarioSection(w, svgChart)}
${societySection(w)}
${crimeSection(w)}
${govSection(w)}
<section><h2>Top 20 fortunes</h2><table><tr><th>#</th><th>Name</th><th>Peak (Y1 money)</th><th>Strategy</th><th>Education</th><th>Inherited share</th><th>Status</th></tr>${a.top.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(P.name(r.p))}</td><td>${U.fmtMoney(r.peakReal)}</td><td>${C.STRATEGY_NAMES[r.strategy]}</td><td>${r.qual}</td><td>${pct(r.inheritShare)}</td><td>${r.p.alive ? (r.p.away ? 'moved away' : 'alive') : 'died ' + Math.floor(r.age)}</td></tr>`).join('')}</table></section>
<section><h2>What you can try next</h2><ul>
<li><b>Replay this world with one change</b> (same seed): New world → change one setting → Start. The next report compares both runs.</li>
<li><b>Try a different seed</b> with the same settings to see how much of this result was luck.</li>
<li><b>Export the data</b> (CSV) from the Stats tab and analyse it in Excel.</li>
<li>Follow one family over generations in the Leaderboard → All-time view.</li></ul></section>
<section><h2>Settings</h2><table>${settings}</table></section>
<div class="disc">Results describe outcomes of this simulation under its specified assumptions, calibration choices and random seed; they do not establish universal real-world causes of success.</div>
</main></body></html>`;
  };

  R.summary = function (w) {
    const a = R.analyse(w), h = w.history[w.history.length - 1];
    return { seed: w.cfg.seed, cfg: Object.assign({}, w.cfg), winner: w.winner ? P.name(w.people[w.winner.pid]) : 'none', richest: a.top[0] ? U.fmtMoney(a.top[0].peakReal) : '—', median: U.fmtMoney(h.median), pop: h.pop, failed: w.stats.bizFailed };
  };

  R.open = function (w, prev) {
    LES.Audio.setScene('report'); // back to the town's music when you return to this tab
    const blob = new Blob([R.html(w, prev)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) { const a = document.createElement('a'); a.href = url; a.download = `les-report-${w.cfg.seed}.html`; a.click(); }
  };

  // CSV export of every person (for Excel / research).
  R.csv = function (w) {
    const cols = ['id', 'name', 'sex', 'alive', 'away', 'migrant', 'generation', 'age', 'strategy_start', 'strategy_now', 'quals', ...C.ATTR, ...C.ATTR.map(a => `${a}_potential`), ...C.PERS, 'net_worth_now', 'peak_net_worth_nominal', 'wages', 'business', 'inherited', 'children', 'businesses_founded', 'business_failures'];
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [cols.join(',')];
    for (const p of w.people) {
      lines.push([p.id, q(P.name(p)), p.sex, p.alive, !!p.away, p.migrant, p.gen, Math.floor(P.age(w, p)), p.stratHist.length ? p.stratHist[0].strategy : p.strategy, p.strategy, q(p.quals.join(' ')),
        ...p.att.map(x => x.toFixed(2)), ...p.pot.map(x => x.toFixed(2)), ...C.PERS.map(k => p.pers[k]), (p.nw / 100).toFixed(0), (p.peakNw / 100).toFixed(0),
        (p.earned.wages / 100).toFixed(0), (p.earned.business / 100).toFixed(0), ((p.earned.inherit + p.earned.gifts) / 100).toFixed(0), p.children.length,
        w.biz.filter(b => b.founderId === p.id).length, p.bizFailures].join(','));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `les-people-${w.cfg.seed}.csv`;
    a.click();
  };
})(globalThis.LES = globalThis.LES || {});
