// Headless engine tests: acceptance cases from the FSD, invariant sweeps over long
// seeded runs, determinism, and a balance report. Open tests.html and click Run.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const out = document.getElementById('out');
  let passed = 0, failed = 0;

  const print = (msg, cls) => {
    const span = document.createElement('span');
    span.className = cls || '';
    span.textContent = msg + '\n';
    out.appendChild(span);
  };
  const check = (name, cond, detail) => {
    if (cond) { passed++; print(`PASS  ${name}`, 'pass'); }
    else { failed++; print(`FAIL  ${name}${detail ? ' -> ' + detail : ''}`, 'fail'); }
  };
  const yieldUI = () => new Promise(r => setTimeout(r, 0));

  async function runDays(w, days, perMonth) {
    for (let i = 0; i < days && !w.ended; i++) {
      w.step();
      if (perMonth && w.date.lastOfMonth) perMonth(w);
      if (i % 1500 === 0) await yieldUI();
    }
  }

  function small(extra) { return new LES.World(Object.assign({ seed: 'test', founders: 30 }, extra || {})); }

  async function unitTests() {
    print('--- Acceptance cases ---', 'info');
    // TC-001 / TC-021
    const w = new LES.World({ seed: 'tc001' });
    check('TC-001 exactly 100 valid founders', w.people.length === 100 && w.people.every((p, i) => p.id === i && p.alive && p.adult));
    check('TC-001 50/50 sexes', w.people.filter(p => p.sex === 'M').length === 50);
    const bad = LES.validateConfig(Object.assign({}, LES.DEFAULTS, { founders: NaN, softmaxT: Infinity }));
    check('TC-021 NaN/Infinity settings are blocked', bad.blockers.length >= 2, bad.blockers.join(' | '));
    check('Valid defaults have no blockers', LES.validateConfig(LES.DEFAULTS).blockers.length === 0);

    // TC-003 success probability rises with ability
    const p = w.people[0];
    const wts = [1, 0, 0, 0, 0, 0];
    p.stress = 20; p.energy = 90;
    p.att[0] = 2; const low = LES.Actions.successProb(w, p, wts, 6, 0);
    p.att[0] = 8; const high = LES.Actions.successProb(w, p, wts, 6, 0);
    check('TC-003 INT 8 succeeds more often than INT 2 (both possible)', high > low && low >= 0.02 && high <= 0.98, `${low.toFixed(3)} vs ${high.toFixed(3)}`);

    // TC-004 catastrophe is conditional and bounded
    let cats = 0, fails = 0;
    p.att[0] = 1;
    for (let i = 0; i < 20000; i++) { const r = LES.Actions.taskRoll(w, p, wts, 9, 0, 'physical'); if (!r.ok) fails++; if (r.cat) cats++; }
    check('TC-004 catastrophes only on failure, rate <= cap', cats > 0 && cats / fails <= w.cfg.catCap * 1.3, `${cats}/${fails}`);

    // TC-005 qualification gate, attributes do not gate
    const w5 = small({ seed: 'tc005' });
    const [qa, qb] = [w5.people[0], w5.people[1]];
    for (const x of [qa, qb]) { x.job = null; x.retired = false; }
    qa.quals = ['BACH_ENG']; qa.att = [2, 2, 2, 2, 2, 2];
    qb.quals = []; qb.att = [10, 10, 10, 10, 10, 10];
    const vac = { id: 999, job: C.JOB_BY_ID.engineer, salary: U.RM(6000), openDay: 0, closeDay: 5, applicants: [qa.id, qb.id], place: 0 };
    LES.Labour.award(w5, vac);
    check('TC-005 only the qualified applicant is hired', qa.job && qa.job.jobId === 'engineer' && !qb.job);

    // TC-007 attendance pay
    const w7 = small({ seed: 'tc007' });
    const e = w7.people[0];
    e.job = { jobId: 'cleaner', title: 'Cleaner', salary: U.RM(3000), level: 1, startDay: 0, shiftsMonth: 20, lastShiftDay: -1, warnings: 0, place: 0, perfOk: 0, perfN: 0, cat: 'manual' };
    let before = e.cash + e.epf;
    LES.Labour.payJob(w7, e, e.job);
    check('TC-007 20 shifts -> full salary (+13% employer EPF)', e.cash + e.epf - before === U.RM(3000) + U.RM(390));
    e.job.shiftsMonth = 19; before = e.cash + e.epf;
    LES.Labour.payJob(w7, e, e.job);
    check('TC-007 19 shifts -> RM2,850 gross', e.cash + e.epf - before === U.RM(2850) + Math.round(U.RM(2850) * 0.13));
    e.job.shiftsMonth = 25; before = e.cash + e.epf;
    LES.Labour.payJob(w7, e, e.job);
    check('TC-007 extra shifts capped at full salary', e.cash + e.epf - before === U.RM(3000) + U.RM(390));

    // TC-013/014 estate split
    const w13 = small({ seed: 'tc013' });
    const dad = w13.people[0];
    const kids = [w13.people[1], w13.people[2], w13.people[3]];
    for (const k of kids) { k.parents = [dad.id, w13.people[4].id]; k.birthDay = dad.birthDay + 365 * 20; }
    dad.children = kids.map(k => k.id);
    const emptyOut = x => {
      x.job = null; x.inv = { idx: 0, spd: 0, cost: 0 }; x.debt.study = 0;
      w13.ledger.spend(x, 'epf', 'MERCHANT', x.epf);
      w13.ledger.spend(x, 'cash', 'MERCHANT', x.cash);
    };
    emptyOut(dad);
    w13.ledger.pay('GENESIS', dad, 'cash', U.RM(900000));
    const kidsBefore = kids.map(k => k.cash + k.trust);
    w13.die(dad, 'test');
    check('TC-013 900k estate -> 300k to each of 3 children', kids.every((k, i) => k.cash + k.trust - kidsBefore[i] === U.RM(300000)));
    const mom = w13.people[4];
    mom.children = kids.map(k => k.id);
    emptyOut(mom);
    w13.ledger.pay('GENESIS', mom, 'cash', 100);
    const b2 = kids.map(k => k.cash + k.trust);
    w13.die(mom, 'test');
    const got = kids.map((k, i) => k.cash + k.trust - b2[i]);
    check('TC-014 100 sen / 3 -> 34,33,33 by child id', got.join(',') === '34,33,33', got.join(','));
    check('Ledger balanced after estates', w13.checkInvariants().length === 0, w13.checkInvariants().slice(0, 3).join('; '));

    // TC-009 no instant graduation
    const w9 = small({ seed: 'tc009' });
    const s = w9.people[0];
    s.quals = []; s.att[C.INT] = 9;
    LES.Labour.enroll(w9, s, C.COURSE_BY_ID.BACH_ENG);
    if (!s.enrol) LES.Labour.enroll(w9, s, C.COURSE_BY_ID.BACH_ENG);
    for (let i = 0; i < 40; i++) if (s.enrol) LES.Labour.study(w9, s, C.COURSE_BY_ID.BACH_ENG);
    check('TC-009 enrolled student cannot graduate after 40 classes', s.enrol && !s.quals.includes('BACH_ENG'));

    // TC-016 investing
    const w16 = small({ seed: 'tc016' });
    const inv = w16.people[0];
    w16.ledger.pay('GENESIS', inv, 'cash', U.RM(1000));
    const nw0 = P.netWorth(w16, inv), cash0 = inv.cash;
    LES.Finance.buy(w16, inv, 'idx', U.RM(1000));
    const nw1 = P.netWorth(w16, inv);
    check('TC-016 buying shares: cash -1000, net worth only loses the 0.5% fee', cash0 - inv.cash === U.RM(1000) && Math.abs(nw0 - nw1 - U.RM(5)) <= 1, `${nw0 - nw1}`);

    // TC-017 business capital not double counted
    const w17 = small({ seed: 'tc017' });
    const o = w17.people[0];
    o.job = null;
    w17.ledger.pay('GENESIS', o, 'cash', U.RM(100000));
    const ctx = LES.Actions.context(w17, o);
    const before17 = P.netWorth(w17, o);
    LES.Finance.startBusiness(w17, o, { type: C.BIZ_BY_ID.stall, skill: 5 }, ctx);
    const b = w17.biz[w17.biz.length - 1];
    const after17 = P.netWorth(w17, o);
    const expected = before17 - Math.round(U.RM(15000) * 0.6) + b.fixed; // sunk setup costs only
    check('TC-017 owner net worth = before - sunk setup (no double count)', Math.abs(after17 - expected) <= 2, `${after17} vs ${expected}`);
    check('TC-017 ledger still balanced', w17.checkInvariants().length === 0, w17.checkInvariants().join('; '));

    // TC-010 twins
    const w10 = small({ seed: 'tc010' });
    const mother = w10.people.find(x => x.sex === 'F'), father = w10.people.find(x => x.sex === 'M');
    mother.pregnancy = { father: father.id, due: 0, twins: true };
    const n0 = w10.people.length;
    LES.Family.birth(w10, mother);
    const babies = w10.people.slice(n0);
    check('TC-010 twins: two unique children with both parent links', babies.length === 2 && babies.every(c => c.parents[0] === father.id && c.parents[1] === mother.id) && babies[0].id !== babies[1].id);

    // TC-011 / TC-012 both parents refuse care
    for (const mode of ['off', 'on']) {
      const wx = small({ seed: 'tc011', safetyNet: mode });
      const m = wx.people.find(x => x.sex === 'F'), f = wx.people.find(x => x.sex === 'M');
      const orig = LES.Family.acceptCare;
      LES.Family.acceptCare = () => false;
      m.pregnancy = { father: f.id, due: 0, twins: false };
      const before11 = wx.people.length;
      LES.Family.birth(wx, m);
      LES.Family.acceptCare = orig;
      const baby = wx.people[before11];
      if (mode === 'off') check('TC-011 harsh mode: abandoned newborn dies, no silent welfare', baby && !baby.alive && baby.guardian === null);
      else check('TC-012 welfare mode: guardian assigned instead of death', baby && baby.alive && baby.guardian === 'WELFARE');
    }

    // TC-023 end of horizon
    const w23 = small({ seed: 'tc023', horizonYears: 5 });
    await runDays(w23, 5 * 365 + 10);
    check('TC-023 horizon end produces a clean end state', w23.ended && w23.endReason === 'horizon');
  }

  async function determinism() {
    print('--- Determinism ---', 'info');
    const a = new LES.World({ seed: 'det', founders: 60 });
    const b = new LES.World({ seed: 'det', founders: 60 });
    await runDays(a, 3 * 365);
    await runDays(b, 3 * 365);
    check('TC-019/025 same seed + settings -> identical state hash after 3 years', a.hash() === b.hash(), `${a.hash()} vs ${b.hash()}`);
    const c = new LES.World({ seed: 'det2', founders: 60 });
    await runDays(c, 3 * 365);
    check('Different seed -> different history', a.hash() !== c.hash());
  }

  async function invariantSweep(seeds, years) {
    print(`--- Invariant sweep: ${seeds} seeds x ${years} years (checked every month) ---`, 'info');
    for (let s = 0; s < seeds; s++) {
      const cfg = { seed: `sweep-${s}`, safetyNet: s % 2 ? 'on' : 'off', economy: ['normal', 'volatile', 'stable'][s % 3], genetics: s % 2 ? 'original' : 'evolution' };
      const w = new LES.World(cfg);
      const errs = [];
      const t0 = performance.now();
      try {
        await runDays(w, years * 365, wx => { if (errs.length < 5) errs.push(...wx.checkInvariants()); });
      } catch (err) {
        errs.push(`CRASH on day ${w.day}: ${err.stack || err}`);
      }
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      check(`Seed ${cfg.seed} (${cfg.economy}, safety ${cfg.safetyNet}): ${years}y, pop ${w.counts.living}, ${secs}s, no invariant violations`, errs.length === 0, errs.slice(0, 5).join(' | '));
    }
  }

  async function balance(seeds, years) {
    print(`--- Balance report: ${seeds} seeds x ${years} years ---`, 'info');
    const rows = [];
    for (let s = 0; s < seeds; s++) {
      const w = new LES.World({ seed: `bal-${s}` });
      const t0 = performance.now();
      const marks = [];
      for (let y = 10; y <= years; y += y < 40 ? 10 : 20) marks.push(y);
      let done = 0;
      for (const y of marks) {
        await runDays(w, y * 365 - done);
        done = y * 365;
        const h = w.history[w.history.length - 1];
        const ages = w.living.filter(p => p.adult).map(p => P.age(w, p));
        print(`seed ${s} Y${y}: pop ${h.pop} (adults ${h.adults}, kids ${h.children}), employed ${h.employed}, unemp ${h.unemployed}, students ${h.students}, owners ${h.owners}, biz ${h.businesses}, median ${U.fmtMoney(h.median)}, p90 ${U.fmtMoney(h.p90)}, top ${U.fmtMoney(h.top)}, millionaires ${h.millionaires}, gini ${h.gini.toFixed(2)}, avg age ${(U.sum(ages) / Math.max(1, ages.length)).toFixed(0)}`);
        if (w.ended) break;
      }
      const st = w.stats;
      const peak = [...w.people].sort((a, b) => b.peakNw - a.peakNw)[0];
      print(`  stats: births ${st.births} deaths ${st.deaths} couples ${st.couples} breakups ${st.breakups} grads ${st.graduations} dropouts ${st.dropouts} hires ${st.hires} fired ${st.fired} laidOff ${st.laidOff} bizStarted ${st.bizStarted} failed ${st.bizFailed} booms ${st.booms} bankrupt ${st.bankruptcies} welfareKids ${st.welfareKids}`, 'info');
      print(`  richest ever: ${P.name(peak)} peak ${U.fmtMoney(peak.peakNw)} (${C.STRATEGY_NAMES[peak.strategy]}, gen ${peak.gen}); winner: ${w.winner ? P.name(w.people[w.winner.pid]) + ' day ' + w.winner.day : 'none'}; ${((performance.now() - t0) / 1000).toFixed(1)}s`, 'info');
      const last = w.history[w.history.length - 1];
      print('  median NW by strategy (age 30+): ' + C.STRATEGIES.map(k => `${k} ${last.stratMedian[k] === null ? '-' : U.fmtMoney(last.stratMedian[k])}`).join(', '), 'info');
      const errs = w.checkInvariants();
      check(`balance seed ${s} invariants`, errs.length === 0, errs.slice(0, 3).join(' | '));
      rows.push(w);
    }
    return rows;
  }

  async function runAll() {
    out.textContent = '';
    passed = 0; failed = 0;
    const t0 = performance.now();
    try {
      await unitTests();
      await determinism();
      await invariantSweep(3, 60);
    } catch (err) {
      failed++;
      print(`CRASH: ${err.stack || err}`, 'fail');
    }
    print(`\n${passed} passed, ${failed} failed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, failed ? 'fail' : 'pass');
    document.title = failed ? `FAILED ${failed}` : `PASSED ${passed}`;
  }

  window.LES_TESTS = { runAll, balance, invariantSweep, determinism, unitTests };
})(globalThis.LES);
