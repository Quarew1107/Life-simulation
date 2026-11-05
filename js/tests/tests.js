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
    const eis = g => (w7.gov ? Math.round(g * 0.002) : 0); // the worker's EIS contribution (government on)
    let before = e.cash + e.epf;
    LES.Labour.payJob(w7, e, e.job);
    check('TC-007 20 shifts -> full salary (+13% employer EPF)', e.cash + e.epf - before === U.RM(3000) + U.RM(390) - eis(U.RM(3000)));
    e.job.shiftsMonth = 19; before = e.cash + e.epf;
    LES.Labour.payJob(w7, e, e.job);
    check('TC-007 19 shifts -> RM2,850 gross', e.cash + e.epf - before === U.RM(2850) + Math.round(U.RM(2850) * 0.13) - eis(U.RM(2850)));
    e.job.shiftsMonth = 25; before = e.cash + e.epf;
    LES.Labour.payJob(w7, e, e.job);
    check('TC-007 extra shifts capped at full salary', e.cash + e.epf - before === U.RM(3000) + U.RM(390) - eis(U.RM(3000)));

    // TC-013/014 estate split
    const w13 = small({ seed: 'tc013' });
    const dad = w13.people[0];
    const kids = [w13.people[1], w13.people[2], w13.people[3]];
    for (const k of kids) { k.parents = [dad.id, w13.people[4].id]; k.birthDay = dad.birthDay + 365 * 20; }
    dad.children = kids.map(k => k.id);
    const emptyOut = x => {
      x.job = null; x.inv = { idx: 0, st: {}, cost: 0 }; x.debt.study = 0;
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

  // Town generator: every size and several seeds must give a complete, valid town.
  async function townTests() {
    print('--- Town generator (5 sizes x 6 seeds) ---', 'info');
    const need = ['kampung', 'flat', 'terrace', 'condo', 'bungalow', 'office', 'bank', 'bursa', 'techhub', 'mall', 'shoplot', 'mamak', 'hawker',
      'university', 'kolej', 'library', 'hall', 'hospital', 'school', 'park', 'gym', 'factory', 'workshop', 'warehouse', 'construction',
      'welfare', 'depot', 'memorial', 'station', 'rail', 'cinema', 'karaoke', 'bowling', 'futsal', 'finedine', 'lounge', 'spa', 'golf'];
    let bad = [];
    for (const size of LES.MAP_ORDER) {
      for (const seed of ['t1', 't2', 't3', 't4', 't5', 't6']) {
        const t = LES.buildTown(size, seed);
        const missing = need.filter(k => !t.kinds[k] || !t.kinds[k].length);
        const solid = t.buildings.filter(b => !b.decor);
        let overlap = 0;
        for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
          const a = solid[i], b = solid[j];
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap++;
        }
        const outside = t.buildings.filter(b => b.x < 0 || b.y < 0 || b.x + b.w > t.W || b.y + b.h > t.H).length;
        const st = t.buildings[t.byKind.station];
        if (missing.length || overlap || outside || !st || st.block.c !== 0 || !t.busLines.length) bad.push(`${size}/${seed}: missing [${missing}] overlap ${overlap} outside ${outside}`);
      }
      const capOK = t => t.buildings.filter(b => b.home).reduce((s, b) => s + b.cap, 0) >= 2 * Math.min(LES.MAP_SIZES[size].maxFounders, 5000);
      if (!capOK(LES.buildTown(size, 't1'))) bad.push(`${size}: not enough homes for 2x its suggested founders`);
    }
    check('Every map size and seed has every building type, no overlaps, station on the west edge', bad.length === 0, bad.slice(0, 3).join(' | '));
    // Varied street layouts: doors face real roads, every route stays on roads, same homes as the grid.
    const vbad = [];
    for (const size of LES.MAP_ORDER) for (const seed of ['v1', 'v2', 'v3', 'v4']) {
      const t = LES.buildTown(size, seed, 'varied'), g = LES.buildTown(size, seed, 'grid');
      for (const b of t.buildings) {
        const j = t.roadsY.indexOf(b.roadY / t.T - 1), c = LES.townColOf(t, b.door.x / t.T);
        if (j < 0 || !LES.hasH(t, j, c)) { vbad.push(`${size}/${seed}: ${b.kind} ${b.id} has no road at its door`); break; }
      }
      const cap = tt => tt.buildings.reduce((s2, b) => s2 + (b.cap || 0), 0);
      if (cap(t) !== cap(g) || t.kinds.masjid === undefined) vbad.push(`${size}/${seed}: homes differ from the grid town, or no masjid`);
      const R = new LES.RNG(`route|${size}|${seed}`);
      const onRoad = (x, y) => { // a point on a road centre line that exists
        const tx = x / t.T - 1, ty = y / t.T - 1, jx = t.roadsX.indexOf(tx), jy = t.roadsY.indexOf(ty);
        if (jy >= 0 && LES.hasH(t, jy, LES.townColOf(t, x / t.T))) return true;
        if (jx >= 0 && LES.hasV(t, jx, LES.townRowOf(t, y / t.T))) return true;
        return jx >= 0 && jy >= 0;
      };
      for (let k = 0; k < 40 && vbad.length < 5; k++) {
        const a2 = t.buildings[R.int(0, t.buildings.length - 1)], b2 = t.buildings[R.int(0, t.buildings.length - 1)];
        const pts = LES.townPath(t, a2, b2);
        for (let i = 1; i < pts.length; i++) if (pts[i].x !== pts[i - 1].x && pts[i].y !== pts[i - 1].y) { vbad.push(`${size}/${seed}: diagonal route step`); break; }
        for (let i = 2; i < pts.length - 2; i++) {
          const m = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 };
          if (pts[i].x !== pts[i - 1].x || pts[i].y !== pts[i - 1].y) if (!onRoad(m.x, m.y)) { vbad.push(`${size}/${seed}: route leaves the roads near ${Math.round(m.x)},${Math.round(m.y)}`); break; }
        }
      }
    }
    check('Varied layouts (5 sizes x 4 seeds): doors on real roads, routes stay on roads, same homes as grid, places of worship', vbad.length === 0, vbad.slice(0, 4).join(' | '));
    const sig = t => JSON.stringify([t.layout.gapX, t.layout.padX, t.layout.river, t.layout.edge]);
    check('Different seeds give different street layouts', sig(LES.buildTown('pekan', 'p1', 'varied')) !== sig(LES.buildTown('pekan', 'p2', 'varied')) && sig(LES.buildTown('pekan', 'p1', 'varied')) === sig(LES.buildTown('pekan', 'p1', 'varied')));
    const a = LES.buildTown('pekan', 's').plan.join(), b = LES.buildTown('pekan', 's').plan.join(), c = LES.buildTown('pekan', 'other').plan.join();
    check('Same seed gives the same town; another seed gives a different layout', a === b && a !== c);
    await yieldUI();
  }

  // Life goals and happiness stay inside their ranges and get achieved over time.
  async function goalTests() {
    print('--- Life goals & happiness ---', 'info');
    const w = new LES.World({ seed: 'goals', founders: 80 });
    await runDays(w, 15 * 365);
    const adults = w.living.filter(p => p.adult);
    check('Every adult has a valid life goal with progress 0-1', adults.every(p => p.goal && LES.Goals.DEFS[p.goal.id] && p.goal.progress >= 0 && p.goal.progress <= 1));
    check('Happiness always within 0-100', w.people.every(p => p.happy >= 0 && p.happy <= 100));
    const kinds = new Set(Object.keys(w.stats.goalsAchieved));
    check('Several different kinds of life goal get achieved in 15 years', kinds.size >= 3, [...kinds].join(','));
    const hap = adults.map(p => p.happy).sort((x, y) => x - y);
    check('Happiness is spread out (not everyone 0 or 100)', hap[Math.floor(hap.length * 0.9)] - hap[Math.floor(hap.length * 0.1)] > 10, `${hap[0]}..${hap[hap.length - 1]}`);
  }

  // Phase-0 foundations: the original engine is preserved, saves are exact, systems plug in.
  async function foundationTests() {
    print('--- Foundations (presets, save/load, systems) ---', 'info');
    // Engine-independent fingerprints of the original engine at day 1500 (the same in Node and
    // Chrome). Recorded from the code before the new systems, then re-recorded once in Nov 2026
    // when the owner approved fixing household heads who never got a home (F.reviewTiers);
    // the earlier values were h-1 65eac2d1..., h-2 1d375272....
    const ORIGINAL = { 'h-1': '121339afaaaadb802454a22628f34f44', 'h-2': '783466648334746be71a097ab6b87fb5' };
    for (const seed of Object.keys(ORIGINAL)) {
      const w = new LES.World(Object.assign({ seed }, LES.PRESETS.classic.values));
      await runDays(w, 1500);
      check(`Classic preset reproduces the original engine exactly (${seed})`, w.stableHash() === ORIGINAL[seed], w.stableHash());
    }
    check('Defaults are the Malaysia preset', LES.presetOf(LES.DEFAULTS) === 'national');

    // Save -> load -> continue gives the same history as never saving.
    const a = new LES.World({ seed: 'save-rt', founders: 120, migration: 'high' });
    await runDays(a, 6 * 365 + 40);
    const text = LES.Save.toJSON(a);
    const b = LES.Save.fromJSON(text);
    check('Loaded world has the same fingerprint', a.hash() === b.hash());
    await runDays(a, 3 * 365); await runDays(b, 3 * 365);
    check('Loaded world continues with identical history (3 more years)', a.hash() === b.hash() && a.feed.length === b.feed.length);
    check('Loaded world passes its consistency checks', b.checkInvariants().length === 0, b.checkInvariants().slice(0, 3).join(' | '));
    let bad = false;
    try { LES.Save.fromJSON('{"app":"other"}'); } catch (e) { bad = true; }
    check('A file that is not a save is rejected with an error', bad);

    // A test system: its choice is offered, chosen sometimes, resolved, and checked.
    const seen = { cand: 0, done: 0, month: 0, inv: 0 };
    LES.Systems.register({
      id: 'test-pray', enabled: cfg => cfg._testSys === true,
      candidates(w, p, ctx, slot, add) { seen.cand++; add(0, 'TEST_ACT', 0.5, p.homeId, 'x'); },
      resolve(w, p, c) { if (c.id !== 'TEST_ACT') return false; seen.done++; p.stress -= 1; return true; },
      label: id => (id === 'TEST_ACT' ? 'Test action' : undefined),
      month() { seen.month++; }, invariants() { seen.inv++; },
    });
    let offHash = '', onHash = '';
    try {
      const off = new LES.World({ seed: 'sys', founders: 30 }), on = new LES.World({ seed: 'sys', founders: 30, _testSys: true });
      await runDays(off, 200); await runDays(on, 200);
      on.checkInvariants();
      offHash = off.hash(); onHash = on.hash();
      check('An enabled system offers and resolves its choices', seen.cand > 0 && seen.done > 0 && seen.month >= 6 && seen.inv === 1, JSON.stringify(seen));
      check('Its choice appears with its label in the Why panel', LES.Actions.labelOf('TEST_ACT') === 'Test action');
    } finally { LES.Systems.unregister('test-pray'); }
    const plain = new LES.World({ seed: 'sys', founders: 30 });
    await runDays(plain, 200);
    check('A registered but switched-off system changes nothing', plain.hash() === offHash && onHash !== offHash);

    // Calibration measures are finite for a normal run.
    const m = LES.Calibration.measure(a);
    check('Calibration measures are computed', ['e0', 'unemp', 'medWage', 'hhGini'].every(k => Number.isFinite(m[k])), JSON.stringify(m));
  }

  // Phase-2 society: class, religion, community funds, interfaith rule, festivals.
  async function societyTests() {
    print('--- Society (class, religion, festivals) ---', 'info');
    const S = LES.Society;
    const w = new LES.World({ seed: 'soc-test', founders: 300 });
    const share = k => w.people.filter(p => p.rel === k).length / w.people.length;
    check('Founding religions near the 2020 census (Islam 55-72%, Buddhism 10-27%)', share('islam') > 0.55 && share('islam') < 0.72 && share('buddhism') > 0.1 && share('buddhism') < 0.27, `islam ${share('islam').toFixed(2)} buddhism ${share('buddhism').toFixed(2)}`);
    check('Malays are Muslim; every person has a valid religion and devotion', w.people.every(p => S.RELIGIONS[p.rel] && p.relig >= 0 && p.relig <= 100 && (p.eth !== 'malay' || p.rel === 'islam')));
    check('All five ethnic groups appear (DOSM 2025 mix)', ['malay', 'chinese', 'indian', 'bumi'].every(k => w.people.some(p => p.eth === k)));
    await runDays(w, 12 * 365, wx => { const e = wx.checkInvariants(); if (e.length) throw new Error(e.slice(0, 3).join(' | ')); });
    const adults = w.living.filter(p => p.alive && p.adult);
    const n = k => adults.filter(p => p.cls === k).length / adults.length;
    check('Every adult has a class; roughly 40/40/20 split of households', adults.every(p => S.CLASSES.includes(p.cls)) && n('B40') > 0.2 && n('T20') > 0.1, `B40 ${n('B40').toFixed(2)} M40 ${n('M40').toFixed(2)} T20 ${n('T20').toFixed(2)}`);
    const st = w.society;
    check('Worship happens and the congregations meet', Object.values(st.lastWorship || {}).reduce((a, b) => a + b, 0) > 0);
    check('Zakat and donations flow into funds; funds help members in need', st.zakatTotal > 0 && st.aidTotal > 0, `zakat ${U.fmtMoney(st.zakatTotal)} aid ${U.fmtMoney(st.aidTotal)}`);
    const overpay = w.people.filter(p => p.zakatPaid > 0.026 * Math.max(1, p.peakNw) * 13);
    check('Nobody pays more zakat than 2.5% a year of their peak wealth', overpay.length === 0, overpay.slice(0, 3).map(p => p.id).join(','));
    // Interfaith rule: a non-Muslim converts to marry a Muslim (Malaysian rule), not under free choice.
    const t1 = new LES.World({ seed: 'iff', founders: 40 }), t2 = new LES.World({ seed: 'iff', founders: 40, interfaith: 'free' });
    for (const t of [t1, t2]) {
      const a = t.people.find(p => p.sex === 'M' && p.partnerId === null), b = t.people.find(p => p.sex === 'F' && p.partnerId === null);
      a.rel = 'islam'; b.rel = 'buddhism'; LES.Family.formCouple(t, a, b);
      t.result = b.rel;
    }
    check('Interfaith marriage: converts under the Malaysian rule, keeps faith under free choice', t1.result === 'islam' && t2.result === 'buddhism');
    // Shariah screen and bar avoidance for the devout.
    const sys = LES.Systems.all().find(x => x.id === 'society'), q = w.living.find(p => p.adult);
    q.rel = 'islam'; q.relig = 90;
    check('Devout Muslims skip non-Shariah shares and avoid the bar', !sys.stockOk(w, q, 'RZBANK') && sys.stockOk(w, q, 'KILAT') && sys.venueBias(w, q, 'karaoke') < -0.5);
    let ram = 0, raya = 0;
    for (let d = 0; d < 365; d++) { if (LES.Calendar.ramadan(d)) ram++; if (LES.Calendar.festivalStarts(d) && LES.Calendar.festival(d).id === 'raya') raya++; }
    check('Calendar: 30 days of Ramadan and one Hari Raya a year', ram === 30 && raya === 1, `${ram} / ${raya}`);
    const mob = S.mobility(w);
    check('Mobility table is consistent (rows add up)', S.CLASSES.every(a => S.CLASSES.every(b => mob.m[a][b] >= 0)) && mob.n === w.people.filter(p => p.clsOrigin && p.cls35).length);
    const off = new LES.World({ seed: 'soc-off', founders: 40, society: 'off' });
    check('Society off: no religion or class fields are created', !off.society && off.people.every(p => p.rel === undefined));
  }

  // Phase-3 crime: invariants, justice, prison effects, drugs, gangs, policy settings.
  async function crimeTests() {
    print('--- Crime & justice ---', 'info');
    const CR = LES.Crime;
    const w = new LES.World({ seed: 'crime-test', founders: 250, crime: 'lawless' });
    let errs = [];
    await runDays(w, 15 * 365, wx => { if (!errs.length) errs = wx.checkInvariants(); });
    check('15 lawless years: no invariant violations (money incl. gang funds balances)', errs.length === 0, errs.slice(0, 3).join(' | '));
    const st = w.crime;
    check('Crimes, arrests, convictions and prison admissions all happen', (st.total.theft || 0) > 0 && st.arrests > 0 && st.convictions > 0 && st.admissions > 0, JSON.stringify(st.total));
    check('Drug use, rehab and drug arrests happen', st.startedUsing > 0 && st.rehabAdmissions > 0 && st.drugArrests > 0);
    check('At least one gang formed', st.gangs.length > 0);
    const inmates = w.people.filter(p => p.inst && p.inst.kind !== 'remand'); // on remand they keep job and family until the verdict
    check('Prisoners hold no job, course, business role or children', inmates.every(p => !p.job && !p.enrol && p.manages < 0 && !p.careOf.length));
    // Admission: job lost, children re-homed, record after release.
    const w2 = new LES.World({ seed: 'crime-unit', founders: 60, freezeLaws: 'yes' });
    const p = w2.people.find(q => q.job), job = p.job.title;
    CR.admit(w2, p, 'prison', 2, 'test');
    check('Going to prison ends the job and the person stops making choices', !p.job && p.inst && p.inst.kind === 'prison');
    await runDays(w2, 70);
    check('Released after the sentence with a criminal record', !p.inst && p.cr.rec === 1, `${job} → inst ${!!p.inst} rec ${p.cr.rec}`);
    const sys = LES.Systems.all().find(x => x.id === 'crime');
    check('A criminal record lowers the hiring score', sys.hireWeight(w2, p) < 1);
    // Calendar of intensity: realistic has far fewer crimes than lawless.
    const r1 = new LES.World({ seed: 'cr-k', founders: 200, crime: 'realistic' }), r2 = new LES.World({ seed: 'cr-k', founders: 200, crime: 'lawless' });
    await runDays(r1, 8 * 365); await runDays(r2, 8 * 365);
    const tot = x => Object.values(x.crime.total).reduce((a, b) => a + b, 0);
    check('Lawless towns see far more crime than realistic ones', tot(r2) > 5 * Math.max(1, tot(r1)), `${tot(r1)} vs ${tot(r2)}`);
    const dec = new LES.World({ seed: 'cr-d', founders: 200, crime: 'lawless', drugPolicy: 'decriminalised', freezeLaws: 'yes' });
    await runDays(dec, 8 * 365);
    check('Decriminalised drug use: no possession arrests', dec.crime.drugArrests === 0);
    const off = new LES.World({ seed: 'cr-off', founders: 40, crime: 'off' });
    await runDays(off, 200);
    check('Crime off: no crime state and nobody in an institution', !off.crime && off.people.every(q => !q.inst));
  }

  // Phase-4 government: treasury, laws, police force, remand, elections, events.
  async function govTests() {
    print('--- Government & elections ---', 'info');
    const GV = LES.Gov;
    const w = new LES.World({ seed: 'gov-test', founders: 200 });
    check('A leader is elected by the founders at the start', w.gov.president >= 0 && w.gov.elections.length === 1);
    let errs = [];
    await runDays(w, 16 * 365, wx => { if (!errs.length) errs = wx.checkInvariants(); });
    check('16 years: no invariant violations (treasury in the money check, votes add up)', errs.length === 0, errs.slice(0, 3).join(' | '));
    const g = w.gov, e = g.elections;
    check('Elections every term (3+ in 16 years) with turnout 50-95%', e.length >= 3 && e.slice(1).every(x => x.voted / x.eligible > 0.5 && x.voted / x.eligible < 0.95), e.map(x => `${x.voted}/${x.eligible}`).join(' '));
    check('Taxes reach the treasury and pay for things', g.last && g.last.revTotal > 0 && Object.keys(g.last.spend).length > 0);
    check('Police officers are hired as public servants', w.living.some(p => p.job && p.job.jobId === 'police') && g.officers > 0);
    check('Every law has a valid setting and the policy matches it', GV.LAWS.every(l => l.options.some(o => o[0] === g.laws[l.key])) && w.policy.minWage === Number(g.laws.minWage));
    // Law levers really act on the engine.
    const t = new LES.World({ seed: 'gov-law', founders: 40 });
    const p = t.people.find(q => q.job);
    const before = LES.Labour.incomeTax(t, LES.U.RM(9000));
    t.gov.laws.incomeTax = 'high'; t.policy = GV.policyOf(t.gov.laws);
    check('Income tax law changes the tax people pay', LES.Labour.incomeTax(t, LES.U.RM(9000)) > before);
    t.gov.laws.minWage = '2500'; t.policy = GV.policyOf(t.gov.laws); p.job.salary = LES.U.RM(1000);
    LES.Systems.all().find(x => x.id === 'gov').month(t);
    check('The minimum wage lifts low salaries', p.job.salary >= t.px(2500));
    // More police -> more crime solved.
    const lo = new LES.World({ seed: 'gov-pol', founders: 400, crime: 'lawless' }), hi = new LES.World({ seed: 'gov-pol', founders: 400, crime: 'lawless' }); // big enough that 2 vs 7 per 1,000 differ in whole officers
    lo.gov.laws.police = '2'; lo.policy = GV.policyOf(lo.gov.laws); hi.gov.laws.police = '7'; hi.policy = GV.policyOf(hi.gov.laws);
    lo.gov.frozen = hi.gov.frozen = true;
    await runDays(lo, 6 * 365); await runDays(hi, 6 * 365);
    check('A bigger police force arrests more people per crime', hi.crime.arrests / Math.max(1, Object.values(hi.crime.total).reduce((a, b) => a + b, 0)) > lo.crime.arrests / Math.max(1, Object.values(lo.crime.total).reduce((a, b) => a + b, 0)), `${lo.gov.laws.police}: ${lo.crime.arrests} · ${hi.gov.laws.police}: ${hi.crime.arrests}`);
    check('Suspects are held on remand in the lock-up before court', hi.crime.remanded > 0);
    const off = new LES.World({ seed: 'gov-off', founders: 40, government: 'off' });
    check('Government off: no treasury, laws or leanings', !off.gov && !off.policy && off.people.every(q => !q.pol));
  }

  async function fiscalTests() {
    print('--- Taxes, budget, council, services ---', 'info');
    const FS = LES.Fiscal, SV = LES.Services, CO = LES.Council, F = LES.Finance;
    const w = new LES.World({ seed: 'fisc-test', founders: 200, freezeLaws: 'yes' });
    // LHDN: RM120k a year -> chargeable RM107k (RM9k relief + RM4k EPF) -> RM11,150 tax.
    check('LHDN bands: RM120k a year pays RM11,150', Math.abs(FS.annualTaxOn(w, null, 120000) - 11150) < 0.01, FS.annualTaxOn(w, null, 120000).toFixed(2));
    check('LHDN rebate: RM3,000 a month pays no income tax', FS.pcb(w, null, w.px(3000)) === 0);
    check('SME company tax: RM10k monthly profit pays 15% (RM1,500)', FS.corpTax(w, { lastRevenue: w.px(50000) }, w.px(10000)) === w.px(1500));
    const gst = FS.priceMult('gst6', 'targeted'), none = FS.priceMult('sst', 'none');
    check('GST raises hawker-meal prices; removing the fuel subsidy raises vehicle costs', gst.food[1] > 1 && gst.housing[2] === 1 && none.transport[2] > 1 && none.transport[0] === 1);
    let errs = [];
    await runDays(w, 12 * 365, wx => { if (!errs.length && wx.date.lastOfMonth && wx.date.month % 3 === 2) errs = wx.checkInvariants(); });
    check('12 years: money check holds with taxes, the fund and GLC shares', errs.length === 0, errs.slice(0, 3).join(' | '));
    const g = w.gov, rev = g.last.rev, spend = g.last.spend;
    check('Revenue is recorded by source (income tax, SST, company tax, assessment)', ['SST', 'assessment tax', 'company tax (employers)'].every(k => rev[k] > 0), Object.keys(rev).join(', '));
    check('The treasury pays teachers, nurses, doctors and police', ['education', 'health', 'police'].every(k => spend[k] > 0), Object.keys(spend).join(', '));
    const keepVac = w.vacancies; w.vacancies = [];
    for (let i = 0; i < 400; i++) LES.Labour.dailyMarket(w);
    const marketPosts = w.vacancies; w.vacancies = keepVac;
    check('The random job market no longer posts teacher, nurse or doctor jobs', marketPosts.length > 10 && marketPosts.every(v => !SV.PUBLIC_JOBS.has(v.job.id)), `${marketPosts.length} posts`);
    check('Public servants are not counted as private payroll', w.living.filter(p => p.job && p.job.jobId === 'teacher' && !(p.job.biz >= 0)).every(p => SV.lineOf(p.job) === 'education'));
    check('Council officials are appointed', CO.ORDER.filter(r => g.officials[r]).length >= 2, JSON.stringify(Object.keys(g.officials).filter(r => g.officials[r])));
    check('Officials hold their council job', ['treasurer', 'community'].every(r => !g.officials[r] || g.officials[r].id < 0 || w.people[g.officials[r].id].job.jobId === r));
    check('Bank Negara keeps the OPR within 1.75-3.75%', g.opr >= 0.0175 - 1e-9 && g.opr <= 0.0375 + 1e-9 && g.oprHist.length >= 10);
    check('Service quality is measured', g.eduQ >= 0.4 && g.eduQ <= 1.3 && g.healthQ >= 0.4 && w.mortAdj > 0.9 && w.mortAdj < 1.11);
    // A private school: built on an empty lot, staffed and paid by its owner (a fresh town
    // that still has empty lots).
    const ws = new LES.World({ seed: 'fisc-school', founders: 200, freezeLaws: 'yes' });
    await runDays(ws, 40);
    const owner = ws.living.filter(q => q.adult && !q.inst && q.manages < 0).sort((a, b) => b.cash - a.cash)[0];
    ws.ledger.pay('GENESIS', owner, 'cash', ws.px(4e6));
    const lots = ws.town.lots.filter(id => !ws.town.buildings[id].built).length, hadSchool = (ws.town.kinds.privschool || []).length;
    F.startBusiness(ws, owner, { type: LES.C.BIZ_BY_ID.privschool, skill: 5 }, { mc: owner.mcost, risk: 0.3 });
    const sch = ws.biz[ws.biz.length - 1];
    check('A private school is built on an empty lot', ws.town.buildings[sch.place].kind === 'privschool' && (ws.town.lots.filter(id => !ws.town.buildings[id].built).length === lots - 1 || hadSchool > 0)); // or it takes over an empty school building
    await runDays(ws, 75);
    const staff = ws.living.filter(p => p.job && p.job.biz === sch.id);
    check('It hires its own teachers, who are paid by the school', staff.length > 0 && staff.every(p => p.job.jobId === 'teacher' && !SV.lineOf(p.job)) && (sch.payrollLast > 0 || sch.payrollNow > 0), `${staff.length} staff`);
    F.closeBiz(ws, sch, 'closed (test)', false);
    check('When it closes, its staff lose their jobs', ws.living.every(p => !(p.job && p.job.biz === sch.id)));
    check('Money check after the school closes', ws.checkInvariants().length === 0, ws.checkInvariants().slice(0, 2).join(' | '));
    // Police capacity: fewer officers -> a stretched force.
    const keep = g.officers;
    g.officers = 0; const thin = LES.Crime.capacity(w); g.officers = Math.max(10, keep * 5); const full = LES.Crime.capacity(w); g.officers = keep;
    check('A stretched police force solves fewer cases', thin < full, `${thin.toFixed(2)} < ${full.toFixed(2)}`);
    // Save and load keeps the new state.
    const w2 = LES.Save.decode(LES.Save.encode(w));
    check('Save/load keeps the treasury, council and fund', w2.gov.officials && w2.gov.fund && w2.stableHash() === w.stableHash());
    const c = new LES.World({ seed: 'fisc-classic', founders: 40, preset: 'classic', government: 'off' });
    check('Classic engine: no fiscal state, old income tax', !c.gov && !c.taxPx && LES.Labour.incomeTax(c, LES.U.RM(9000)) > 0);
  }

  async function scenarioTests() {
    print('--- Scenarios ---', 'info');
    const SC = LES.Scenarios, P = LES.P;
    const make = (id, extra) => new LES.World(Object.assign({ seed: `scn-${id}`, founders: 60, scenario: id }, SC.BY_ID[id].cfg || {}, extra || {}));
    check('Every scenario has a valid setup and a description', SC.LIST.length >= 9 && SC.LIST.every(s => s.name && s.short && s.desc && s.watch.length && LES.validateConfig(Object.assign({}, LES.DEFAULTS, s.cfg || {}, { scenario: s.id })).blockers.length === 0));
    const none = new LES.World({ seed: 'scn-none', founders: 40 });
    check('No scenario: no scenario state', !none.scn && !none.flags && !SC.current(none));
    // Born Equal
    const eq = make('equal');
    const f = eq.people;
    check('Born Equal: same money, abilities, no degrees, no EPF', f.every(p => p.cash === f[0].cash && p.att.every(a => a === 5) && !p.quals.length && p.epf === 0));
    let errs = [];
    await runDays(eq, 3 * 365, wx => { if (!errs.length && wx.date.lastOfMonth) errs = wx.checkInvariants(); });
    check('Born Equal: 3 years, money check holds and inequality appears', !errs.length && eq.history[eq.history.length - 1].gini > 0.05, errs.slice(0, 2).join(' | '));
    // Great Reset
    const rs = make('reset');
    await runDays(rs, 2 * 365);
    SC.state(rs).next = rs.day;
    await runDays(rs, 1);
    const ad = rs.living.filter(p => p.alive && p.adult && !p.away), cashes = ad.map(p => p.cash);
    check('Great Reset: businesses sold and cash shared equally', SC.state(rs).resets.length === 1 && !rs.biz.some(b => b.open && b.foundedDay < SC.state(rs).resets[0].day) && Math.max(...cashes) - Math.min(...cashes) < rs.px(1000), `${Math.min(...cashes)}..${Math.max(...cashes)}`);
    check('Great Reset: money check after the reset', rs.checkInvariants().length === 0, rs.checkInvariants().slice(0, 2).join(' | '));
    // Eternal Life
    const et = make('eternal', { startAgeMin: 50, startAgeMax: 60 });
    const att0 = et.people.map(p => p.att.slice());
    await runDays(et, 4 * 365);
    check('Eternal Life: no ageing decline, no retirement, no old-age mortality', et.flags.noAgeing && et.cfg.mortMult === 0 && et.people.every(p => !p.retired) && et.people.every((p, i) => !p.alive || i >= att0.length || p.att[1] >= att0[i][1] - 1e-9 || p.injuredUntil > 0));
    // Education Ban
    const eb = make('eduban');
    await runDays(eb, 365);
    check('Education Ban: nobody studying, schools closed, no teachers employed by the town', eb.flags.noCourses && eb.flags.noSchool && eb.living.every(p => !p.enrol) && (!eb.gov || eb.gov.staff.teacher.target === 0));
    // Pandemic
    const pd = make('pandemic', { founders: 120 });
    Object.assign(SC.state(pd), { start: 20, end: 20 + 3 * 365, vaxDay: 20 + 365 });
    errs = [];
    await runDays(pd, 400, wx => { if (!errs.length && wx.date.lastOfMonth) errs = wx.checkInvariants(); });
    check('Pandemic: the virus spreads, and the money check holds', SC.state(pd).cases > 3 && !errs.length, `${SC.state(pd).cases} cases ${errs.slice(0, 2).join(' | ')}`);
    // Robot Age
    const rb = make('robots', { robotYear: '0', robotSpeed: 'fast' });
    await runDays(rb, 3 * 365);
    const exposed = LES.C.JOB_BY_ID.factory, tries = 400; let blocked = 0;
    for (let i = 0; i < tries; i++) if (!LES.Systems.all().find(x => x.id === 'scn-robots').jobOk(rb, exposed)) blocked++;
    check('Robot Age: automation rises and exposed jobs stop being posted', SC.state(rb).a > 0.1 && blocked > tries * 0.1, `a=${SC.state(rb).a.toFixed(2)} blocked ${blocked}/${tries}`);
    // Lawless Town, Isolated Island, Five Clans
    const lw = make('lawless');
    check('Lawless Town: lawless crime and 2 officers per 1,000', lw.cfg.crime === 'lawless' && (!lw.gov || lw.gov.laws.police === '2'));
    const is = make('island');
    check('Isolated Island: no migration, no commuter jobs, dearer imports', is.cfg.migration === 'off' && is.people.every(p => !p.job || !LES.C.JOB_BY_ID[p.job.jobId].commute) && is.costMult.food > 1);
    const cl = make('clans', { founders: 80 });
    await runDays(cl, 3 * 365);
    const kids = cl.people.filter(p => p.parents.length);
    check('Five Clans: everyone belongs to a clan and children take a parent\'s clan', cl.people.every(p => SC.CLAN_BY_ID[p.clan]) && kids.every(k => k.parents.some(id => cl.people[id].clan === k.clan)), `${kids.length} children`);
    // Save/load with a scenario.
    const w2 = LES.Save.decode(LES.Save.encode(rb));
    check('Save/load keeps the scenario state', w2.scn && w2.scn.a === rb.scn.a && w2.stableHash() === rb.stableHash());
  }

  async function regionTests() {
    print('--- Region (several towns) ---', 'info');
    const mk = () => new LES.Region(Object.assign({}, LES.DEFAULTS, { seed: 'reg-t', migration: 'normal' }), [{ founders: 90 }, { founders: 50, seed: 'reg-t2' }, { founders: 40, seed: 'reg-t3' }]);
    const R = mk();
    check('A region holds up to three towns with their own names', R.towns.length === 3 && new Set(R.towns.map(w => w.townName)).size === 3 && LES.MAX_TOWNS === 3);
    let errs = [];
    for (let d = 0; d < 12 * 365; d++) { R.step(); if (!errs.length && R.lead.date.lastOfMonth && R.lead.date.month % 3 === 2) errs = R.checkInvariants(); if (d % 2000 === 0) await new Promise(r => setTimeout(r, 0)); }
    check('12 years: every town passes its money and consistency checks', errs.length === 0, errs.slice(0, 3).join(' | '));
    check('One national economy: same business cycle, inflation and stock exchange', R.towns.every(w => w.regime === R.lead.regime && w.infl === R.lead.infl && w.mkt === R.lead.mkt && Math.abs(w.price - R.lead.price) < 1e-12));
    check('Households move between the towns', R.moves.length > 0, `${R.moves.length} moves`);
    check('Some residents commute to jobs in a sister town', R.commuters().some(n => n > 0) && R.commutePosts > 0, `${R.commuters()} commuters`);
    const mv = R.moves.find(m => R.towns[m.from].people[m.pairs[0][0]].away) || R.moves[0], [fromId, toId] = mv.pairs[0], a = R.towns[mv.from].people[fromId], b = R.towns[mv.to].people[toId]; // someone still alive
    check('A mover is the same person in the new town, linked back to the old one', a.first === b.first && a.birthDay === b.birthDay && (!a.away || a.away.town === mv.to) && b.xlinks[0].id === fromId);
    check('Town types change the district mix', (() => { const k = t => { const w2 = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'tt', founders: 120, town1Type: t })); return w2.town.blocks.filter(b => b.code === 'I').length; }; return k('industrial') > k('mixed'); })());
    const cw = new LES.World({ seed: 'cast-t', founders: 40 }), spec = Object.assign(LES.Cast.blank(), { first: 'Test', last: 'Person', att: [9, 1, 5, 5, 5, 5], cash: 77000, qual: 'BACH_BUS' });
    const cp = LES.Cast.add(cw, spec);
    check('My Cast: a custom person arrives with the chosen abilities, money and degree', cp.custom && cp.first === 'Test' && cp.att[0] === 9 && cp.quals[0] === 'BACH_BUS' && cp.cash === cw.px(77000) && cw.checkInvariants().length === 0);
    const R2 = mk(), R3 = mk();
    for (let d = 0; d < 2 * 365; d++) { R2.step(); R3.step(); }
    check('Same seed -> same region history', R2.hash() === R3.hash());

    // ---- Region overview map (layout and schematic plans; drawing goes through a stub) ----
    const RM = LES.RegionMap, wide = RM.layout(R, 4), narrow = RM.layout(R, 1.4), L = narrow;
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const layoutOk = M => M.towns.length === 3 && M.towns.every((a, i) => a.x >= 0 && a.y >= 0 && a.x + a.w <= M.W && a.y + a.h <= M.H && M.towns.every((b, j) => i === j || !overlap(a, b)));
    // Roads between towns never cut through a third town (sampled along each route).
    const routesOk = M => [[0, 1], [1, 2], [0, 2], [2, 0]].every(([a, b]) => {
      const pts = RM.route(M, a, b);
      for (let f = 0.02; f < 0.98; f += 0.02) { const p = RM.along(pts, f), i = RM.hit(M, p.x, p.y); if (i >= 0 && i !== a && i !== b) return false; }
      return true;
    });
    check('Region map: a row for wide views and a staircase for narrower ones, towns never overlapping and roads never crossing a third town',
      wide.mode === 'row' && narrow.mode === 'stair' && layoutOk(wide) && layoutOk(narrow) && routesOk(wide) && routesOk(narrow));
    check('Region map: clicking a town finds it, clicking countryside finds nothing, and the layout is the same every time',
      L.towns.every(b => RM.hit(L, b.x + b.w / 2, b.y + b.h / 2) === b.i) && RM.hit(L, 2, 2) === -1
        && JSON.stringify(RM.layout(R, 1.4)) === JSON.stringify(L));
    const plansOk = (() => {
      for (const [size, layout] of [['kampung', 'grid'], ['pekan', 'varied'], ['bandar', 'varied'], ['bandaraya', 'varied'], ['metropolis', 'grid']]) {
        const town = LES.buildTown(size, `rm-${size}`, layout), S = RM.S, Wp = town.W * S, Hp = town.H * S;
        let n = 0, bad = 0;
        const stub = { fillStyle: '', fillRect(x, y, w, h) { n++; if (!(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= Wp + 0.01 && y + h <= Hp + 0.01)) bad++; } };
        RM.drawTown(stub, town, S);
        if (bad || n < town.blocks.length) return `${size}: ${bad} shapes outside of ${n}`;
      }
      return '';
    })();
    check('Region map: a schematic plan draws for every map size, grid or varied, all inside the town', plansOk === '', plansOk);

    // ---- Gangs spreading between towns (set up by hand so the test doesn't wait on luck) ----
    const CR = LES.Crime;
    const endGang = (w, g) => { // break a gang up cleanly (funds to the merchants, members freed)
      if (g.cash) w.ledger.move(g, 'cash', w.ledger.sec.MERCHANT, 'bal', g.cash);
      for (const id of g.members) w.people[id].cr.gang = -1;
      g.members = []; g.alive = false;
    };
    const gangRegion = () => {
      const G = new LES.Region(Object.assign({}, LES.DEFAULTS, { seed: 'gang-t', migration: 'normal', crime: 'lawless' }), [{ founders: 120 }, { founders: 80, seed: 'gang-t2' }]);
      for (let d = 0; d < 400; d++) G.step();
      const [A, B] = G.towns;
      for (const g of B.crime.gangs) if (g.alive) endGang(B, g); // make room in the sister town
      const offenders = w => w.living.filter(p => p.alive && p.adult && !p.inst && p.cr.gang < 0 && P.age(w, p) < 40).slice(0, 6);
      for (const p of [...offenders(A), ...offenders(B)]) p.cr.rec = Math.max(1, p.cr.rec);
      const g = { id: A.crime.gangs.length, name: 'Geng Ujian Test', colour: '#123456', leader: -1, members: [], cash: 0, turf: [0], founded: A.day - 800, alive: true, crimes: 0, peak: 0 };
      A.crime.gangs.push(g);
      const crew = offenders(A).slice(0, 5);
      g.leader = crew[0].id;
      for (const p of crew) CR.joinGang(A, g, p);
      A.ledger.pay('LUCK', g, 'cash', A.px(9000));
      let ch = null;
      for (let k = 0; k < 400 && !ch; k++) { G.gangSpread(); ch = CR.chapterIn(B, 0, g.id); }
      return { G, A, B, g, ch };
    };
    const gs = gangRegion(), { A: gA, B: gB, g: pg, ch } = gs;
    check('An established gang that cannot grow at home opens a chapter in the sister town', CR.wantsToExpand(gA, pg) && !!ch);
    if (ch) {
      check('The chapter is run by locals, carries the parent\'s name and colour, and is linked both ways',
        ch.members.length >= 2 && ch.members.every(id => gB.people[id].cr.gang === ch.id) && ch.colour === pg.colour && ch.name.startsWith(pg.name)
          && pg.chapters.some(c => c.town === 1 && c.gang === ch.id) && gB.feed.some(e => /opened a chapter here/.test(e.text)));
      const before = pg.cash;
      gB.ledger.pay('LUCK', ch, 'cash', 10000); ch.take = (ch.sent || 0) + 10000;
      gs.G.gangSpread();
      check('A chapter sends 20% of its takings home, and both towns\' money checks stay clean', pg.cash - before === 2000 && gs.G.checkInvariants().length === 0, gs.G.checkInvariants()[0] || `${pg.cash - before}`);
      endGang(gA, pg);
      gs.G.gangSpread();
      check('When the parent gang breaks up, its chapter carries on alone', ch.alive && !ch.parent && ch.formerParent === pg.name);
    }
    const d1 = gangRegion(), d2 = gangRegion();
    for (let d = 0; d < 120; d++) { d1.G.step(); d2.G.step(); }
    check('Same seed -> same history with gangs spreading', !!d1.ch && d1.G.hash() === d2.G.hash());
    // A gang member who moves to the sister town keeps a tie to the old gang.
    const T = gangRegion(), tg = T.g;
    let tied = null;
    for (const id of tg.members.slice()) {
      const p = T.A.people[id];
      if (!p.alive || p.away || p.inst || !p.isHead) continue;
      LES.Migration.leave(T.A, p, 'a test move');
      T.G.settleMoves();
      const mv = T.G.moves.find(m => m.pairs.some(([a]) => a === id));
      if (mv) { tied = T.B.people[mv.pairs.find(([a]) => a === id)[1]]; break; }
    }
    check('A gang member who moves keeps a tie to the old gang in the new town', !!tied && tied.cr.tie && tied.cr.tie.town === 0 && tied.cr.tie.gang === tg.id && T.G.checkInvariants().length === 0, T.G.checkInvariants()[0] || '');
  }

  // ---- My Cast: founders, households and replays ----
  async function castTests() {
    print('--- My Cast ---', 'info');
    const spec = o => Object.assign(LES.Cast.blank(), o);
    const mum = spec({ id: 'm', first: 'Siti', sex: 'F', age: 34, partner: 'd', cash: 20000 }), dad = spec({ id: 'd', first: 'Ali', sex: 'M', age: 36, partner: 'm', att: [8, 5, 5, 5, 5, 5] });
    const kid = spec({ id: 'k', first: 'Adam', sex: 'M', age: 6, parents: ['m', 'd'], att: [9, 9, 9, 9, 9, 9] });
    const solo = spec({ id: 's', first: 'Mei', last: 'Tan', eth: 'chinese', sex: 'F', age: 22, att: [2, 3, 4, 5, 6, 7] });
    const ma = spec({ id: 'ma', first: 'Kavitha', eth: 'indian', sex: 'F', age: 30 }), baby = spec({ id: 'b', first: 'Arjun', eth: 'indian', sex: 'M', age: 1, parents: ['ma'] });
    const cfg = Object.assign({}, LES.DEFAULTS, { seed: 'cast-f', founders: 60, cast: [mum, dad, kid, solo, ma, baby] });
    const w = new LES.World(cfg), by = n => w.people.find(p => p.custom && p.first === n);
    const [M, D, K, S] = ['Siti', 'Ali', 'Adam', 'Mei'].map(by);
    check('My Cast founders join the town on day 1 as founders, with the abilities you chose',
      w.people.filter(p => p.custom).length === 6 && [M, D, K, S].every(p => p && !p.migrant) && S.att.join() === '2,3,4,5,6,7' && w.checkInvariants().length === 0, w.checkInvariants()[0] || '');
    check('A cast couple shares one home, and their child has both parents and lives with them (abilities chosen = potential)',
      M.partnerId === D.id && D.partnerId === M.id && M.homeId >= 0 && M.homeId === D.homeId && S.homeId >= 0 && K.parents.includes(M.id) && K.parents.includes(D.id) && K.caregivers.length === 2 && K.homeId === M.homeId && !K.adult && K.pot[0] === 9 && K.att[0] < 9);
    const B = by('Arjun');
    check('A cast child can have one parent in the cast', B && B.parents.length === 1 && B.caregivers[0] === by('Kavitha').id);
    let errs = [];
    for (let d = 0; d < 2 * 365; d++) { w.step(); if (!errs.length && w.date.lastOfMonth) errs = w.checkInvariants(); }
    const w2 = new LES.World(cfg);
    for (let d = 0; d < 2 * 365; d++) w2.step();
    check('Two years with a cast: consistency checks clean, and the same seed and cast give the same history', errs.length === 0 && w.hash() === w2.hash(), errs[0] || '');
    if (LES.Report && LES.Report.html) {
      const html = LES.Report.html(w, null), sec = (html.match(/<h2>Your cast<\/h2>[\s\S]*?<\/section>/) || [''])[0];
      check('The report has a "Your cast" section with every cast member', ['Siti', 'Ali', 'Adam', 'Mei', 'Kavitha', 'Arjun'].every(n => sec.includes(n)) && !LES.Report.html(new LES.World({ seed: 'nc', founders: 30 }), null).includes('<h2>Your cast</h2>'));
    }
    // Someone added during a run is recorded and comes back on the same day in a replay.
    const r1 = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'cast-r', founders: 60 }));
    for (let d = 0; d < 100; d++) r1.step();
    LES.Cast.arrive(r1, [spec({ id: 'x', first: 'Farah', age: 28, cash: 50000 })]);
    for (let d = 0; d < 300; d++) r1.step();
    const r2 = new LES.World(Object.assign({}, r1.cfg));
    for (let d = 0; d < 400; d++) r2.step();
    const f2 = r2.people.find(p => p.custom);
    check('A person added during a run is recorded, and a replay adds them on the same day with the same history',
      r1.cfg.castArrivals.length === 1 && f2 && f2.first === 'Farah' && f2.arrivedDay === 100 && r1.hash() === r2.hash());

    // Looks (browser only: needs a canvas).
    if (typeof document === 'undefined' || !LES.Sprites || !document.createElement('canvas').getContext) return;
    const base = { skin: '#c68642', hair: '#1b1b1b', shirt: '#2a9d8f', pants: '#1d3557', style: 0, scarf: '#c9184a' };
    const px = (look, view) => { const c = LES.Sprites.person(look, 'adult', 0, null, view); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.join(); };
    const extras = [{ glasses: 1 }, { glasses: 2 }, { beard: 1 }, { beard: 2 }, { beard: 3 }, { hat: 1 }, { hat: 2 }, { hat: 3, hatColour: '#e63946' }, { hat: 4, hatColour: '#f2c14e' }];
    const shows = extras.every(x => ['front', 'side'].every(v => px(Object.assign({}, base, x), v) !== px(base, v))) && [{ hat: 1 }, { hat: 4 }].every(x => px(Object.assign({}, base, x), 'back') !== px(base, 'back'));
    check('New looks (glasses, beards, songkok, kopiah, cap, turban) change the sprite in every view they should', shows);
    const lw = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'look-t', founders: 80 })), h0 = lw.hash();
    const looks = lw.people.map(p => LES.Sprites.lookOf(p, P.age(lw, p)));
    check('Residents get looks by a fixed rule, without touching the simulation', lw.hash() === h0 && looks.some(l => l.glasses || l.beard || l.hat) && lw.people.every(p => p.look.glasses === undefined));
  }

  // ---- Map tiles (browser only: needs a canvas) ----
  async function tileTests() {
    print('--- Map tiles ---', 'info');
    if (typeof document === 'undefined' || !LES.MapTiles || !document.createElement('canvas').getContext) { print('(skipped: no canvas here)', 'info'); return; }
    const town = LES.buildTown('pekan', 'tile-t', 'varied'), TILE = LES.MapTiles.TILE;
    const area = (MT, x, y, w, h) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true }), rects = MT.paintArea(g, x, y, w, h);
      const lc = document.createElement('canvas'); lc.width = w; lc.height = h;
      const lg = lc.getContext('2d', { willReadFrequently: true }); MT.paintLights(lg, x, y, w, h, rects);
      return [g, lg];
    };
    const MT = new LES.MapTiles(); MT.setTown(town, 0);
    // One tile painted alone must match the same square inside a bigger painted area.
    const [a, al] = area(MT, TILE, TILE, TILE, TILE), [b, bl] = area(MT, TILE - 256, TILE - 256, TILE + 512, TILE + 512);
    // The browser smooths the edge of a big curve (a pond) that crosses the tile border a
    // shade differently on a smaller canvas; a real seam (a missing or moved item) would
    // differ by far more than 32 levels.
    const seam = (g1, g2) => { const p = g1.getImageData(0, 0, TILE, TILE).data, q = g2.getImageData(256, 256, TILE, TILE).data; let n = 0, big = 0; for (let i = 0; i < p.length; i++) { const d = Math.abs(p[i] - q[i]); if (d) n++; if (d > 32) big++; } return { n, big }; };
    const d1 = seam(a, b), d2 = seam(al, bl);
    check('A map tile painted on its own matches the same area of a bigger painting (no seams), night lights too',
      d1.big === 0 && d2.big === 0 && d1.n + d2.n < TILE * TILE * 4 * 0.001, `${d1.n}/${d1.big} and ${d2.n}/${d2.big} values differ (any / by more than 32)`);
    // The overview fills in pieces; then a change repaints only the tiles it touches.
    while (MT.ovDone.indexOf(0) >= 0) MT.work(50);
    for (let cy = 0; cy < MT.rows; cy++) for (let cx = 0; cx < MT.cols; cx++) MT.paintTile(cx, cy);
    const all = MT.cache.size, b0 = town.buildings.find(x => x.kind === 'office' && x.x * town.T > TILE);
    b0.label = 'Menara Ujian';
    MT.setTown(town, 1);
    const gone = MT.cols * MT.rows - MT.cache.size, holes = MT.ovDone.filter(x => !x).length;
    check('When a building changes, only the tiles it touches are painted again', all === MT.cols * MT.rows && gone >= 1 && gone <= 4 && holes === gone, `${gone} tiles and ${holes} overview pieces redone of ${all}`);
    // The memory cap: never more than the cap, never dropping what is on screen.
    const small = new LES.MapTiles(8); small.setTown(town, 0);
    const keep = small.need(0, 0, TILE * 1.5, TILE * 1.5, 1);
    for (let cy = 0; cy < small.rows; cy++) for (let cx = 0; cx < small.cols; cx++) small.want.add(`${cx},${cy}`);
    for (let k = 0; k < 40 && small.want.size; k++) small.work(30, keep);
    check('The tile cache stays under its memory cap and keeps the tiles on screen', small.bytes <= 8 * 1048576 && [...keep].every(k => small.cache.has(k)), `${(small.bytes / 1048576).toFixed(1)} MB`);
  }

  // Country packs (js/data/countries/): moving Malaysia into its pack must change nothing.
  // Fingerprints recorded from the code before the move (Nov 2026, commit c0bb584).
  async function countryTests() {
    print('--- Countries (Malaysia pack fingerprints) ---', 'info');
    // Phase 6 (Nov 2026, owner approved): calibrated markets (firms share a town-sized market, wider pay,
    // outside hires) changed every Malaysia history, so these were re-recorded once. Before: my-default
    // 9381afc4.../4e83df96, my-options ebdf7095.../60329a7c, my-pandemic-lawless ec6c1f0a.../753079c0, my-clans
    // dad42cbc.../ba6ebd6b, my-region b495fc0c...; reports 6c3f3adc, 2db065c, 2290240d. Classic is unchanged.
    const MY = {
      'my-default': '84f18b75b2c06289c6a601c0829afc1f/3da2af2a', 'my-options': 'bd26ca13824a4c4d1f7159a9c5ebda41/d49639b8',
      'my-pandemic-lawless': '3f0a222219e38f1dae58e8d4611324af/ae339d10', 'my-clans': 'cf3fc7fbbbda7db225889a0d9f58f0d5/a233679e',
      'my-region': '7b691ae4e34b125bffe4efe84075c4cc/474c56e2|9aa64dbf9cf8b64d1728935ea7de7845/2c7a8870|cbdee295f7a0d97ee8f76128c922925a/f160d7cb',
      'my-save': '93a0eff009e13bbf0631071fc098447a',
    };
    // 4a.6: the report names the drug policy instead of printing its key; 4b.1: a Country row in the settings table and "Today's rules".
    const REPORT = { 'my-default': '445f0e50', 'my-pandemic-lawless': '389a9630', 'my-region': '18479e2' }; // C01 (report text only, engine fingerprints unchanged): tie-aware Spearman, n/a values, inheritance wording. Before C01: f66c05b8, 62c7b2a, cb8afa3d. Phase 6.2: official figures, work and business, the paper; // 4b.3: a 'Starting wealth by group' row; Phase 6: new histories and a 'Business and job markets' row
    const D = LES.DEFAULTS, base = { founders: 80, migration: 'normal' };
    const cases = {
      'my-default': () => new LES.World(Object.assign({}, D, base, { seed: 'my-1' })),
      'my-options': () => new LES.World(Object.assign({}, D, base, { seed: 'my-2', drugPolicy: 'treatment', leaderTitle: 'datuk', interfaith: 'free', ethnicMix: 'classic', fertility: 'normal', education: 'expensive', wealthDist: 'unequal' })),
      'my-pandemic-lawless': () => new LES.World(Object.assign({}, D, base, { seed: 'my-3', scenario: 'pandemic', pandemicYear: '5', crime: 'lawless' })),
      'my-clans': () => new LES.World(Object.assign({}, D, base, { seed: 'my-4', scenario: 'clans' })),
      'my-region': () => new LES.Region(Object.assign({}, D, { seed: 'my-5', migration: 'normal', towns: '3' }), [{ founders: 60 }, { founders: 40, seed: 'my-5b' }, { founders: 30, seed: 'my-5c' }]),
    };
    // State plus every text people and the feed see (names, job titles, log lines), so a moved label shows up too.
    const textOf = w => LES.hashString(w.people.map(p => `${p.first} ${p.last}|${p.eth}|${p.rel || ''}|${p.job ? p.job.title || p.job.jobId : ''}|` + p.log.map(e => e.text).join('~')).join('#') + w.feed.map(e => e.text).join('~'))[0].toString(16);
    const one = w => `${w.stableHash()}/${textOf(w)}`;
    const hashOf = x => x.towns ? x.towns.map(one).join('|') : one(x);
    for (const k of Object.keys(cases)) {
      const x = cases[k]();
      const days = (k === 'my-pandemic-lawless' ? 6 : 4) * 365;
      for (let d = 0; d < days && !x.ended; d++) { x.step(); if (d % 1500 === 0) await yieldUI(); }
      check(`Malaysia pack reproduces the engine before the move (${k})`, hashOf(x) === MY[k], hashOf(x));
      if (LES.Report && REPORT[k] !== undefined) { // the end-of-run report shows most labels (browser only)
        const r = LES.hashString(LES.Report.html(x.towns ? x.towns[0] : x).replace(/\d{1,2}:\d{2}(:\d{2})?|\d{4}-\d{2}-\d{2}/g, ''))[0].toString(16);
        check(`Its report reads exactly as before (${k})`, r === REPORT[k], r);
      }
    }
    // A save written before the move loads and continues to the same history.
    if (globalThis.LES_FIXTURES && LES_FIXTURES.mySave) {
      const w = LES.Save.fromJSON(LES_FIXTURES.mySave);
      await runDays(w, 365);
      check('A Malaysia save from before the move loads and continues identically', w.stableHash() === MY['my-save'], w.stableHash());
      const old = JSON.stringify([w.cfg, w.gov ? w.gov.laws : {}, w.gov ? w.gov.lawLog : []]);
      check("Its old 'malaysia' setting and law values now read 'national'", !old.includes('"malaysia"') && w.cfg.drugPolicy === 'national' && w.cfg.econModel === 'original'); // (Phase 6: an old save keeps the original markets, so its rules read as Custom)
    } else check('The pre-move save fixture is present', false);

    // The pack registry.
    const KC = LES.Countries;
    check('Every country pack has all its required parts', KC.order.every(c => !KC.validate(KC.get(c)).length), KC.order.map(c => `${c}: ${KC.validate(KC.get(c)).join(', ') || 'ok'}`).join('; '));
    const oldCfg = Object.assign({}, D, { seed: 'cty-old', founders: 30, fertility: 'malaysia', ethnicMix: 'malaysia', interfaith: 'malaysia', drugPolicy: 'malaysia', preset: 'malaysia' });
    const wa = new LES.World(oldCfg), wb = new LES.World(Object.assign({}, oldCfg, { fertility: 'national', ethnicMix: 'national', interfaith: 'national', drugPolicy: 'national', preset: 'national' }));
    for (let d = 0; d < 400; d++) { wa.step(); wb.step(); }
    // The UK pack: a town runs on its own people, money and rules; switching countries changes nothing else.
    const UKd = Object.assign({}, D, KC.get('uk').defaults, { country: 'uk', seed: 'uk-t', founders: 60 });
    const myRun = () => { const w = new LES.World(Object.assign({}, D, { seed: 'cty-sw', founders: 40 })); for (let d = 0; d < 500; d++) w.step(); return w.stableHash(); };
    const myAlone = myRun();
    const uk = new LES.World(UKd), myW = new LES.World(Object.assign({}, D, { seed: 'cty-sw', founders: 40 }));
    for (let d = 0; d < 3 * 365; d++) { uk.step(); if (d < 500) myW.step(); } // interleaved: each step re-applies its own country
    check('A UK town runs: its own people, money and rules, the books balance', uk.checkInvariants().length === 0 && uk.counts.living > 40
      && uk.people.every(p => ['white', 'asian', 'black', 'mixed', 'other'].includes(p.eth)) && LES.U.fmtMoney(100000).startsWith('£') && (uk.gov.lawLog.find(l => l.key === 'minWage') || { from: uk.gov.laws.minWage }).from === '2065', // (the UK rate at the start; a mayor may change it)
      `${uk.counts.living} people, ${uk.checkInvariants().length} invariant errors`);
    check('Running a UK town alongside changes nothing in a Malaysian one', myW.stableHash() === myAlone && myRun() === myAlone);
    const ukSave = LES.Save.toJSON(uk), ukCopy = LES.Save.fromJSON(ukSave);
    for (let d = 0; d < 200; d++) { uk.step(); ukCopy.step(); }
    check('A UK save loads as the UK and continues identically', JSON.parse(ukSave).country === 'uk' && ukCopy.stableHash() === uk.stableHash() && LES.Countries.active === 'uk');
    check("Settings stored with the old 'malaysia' values run the same as 'national'", wa.stableHash() === wb.stableHash() && wa.cfg.fertility === 'national');
    LES.Countries.ensure(D); // the Malaysia pack (the UK checks above left the UK active)
    check("Money is shown with the pack's currency sign", LES.U.cur(11820) === 'RM11,820' && LES.U.fmtMoney(1234500) === 'RM12.3k' && LES.Countries.fill('{adj} {cur}5 {goal}') === 'Malaysian RM5 RM100 million', `${LES.U.cur(11820)} ${LES.U.fmtMoney(1234500)} ${LES.Countries.fill('{adj} {cur}5 {goal}')}`);
    check('An unknown country is refused with a clear message', LES.validateConfig(Object.assign({}, D, { country: 'zz' })).blockers.some(b => b.includes('Country')));
    const sv = JSON.parse(LES.Save.toJSON(new LES.World(Object.assign({}, D, { seed: 'cty', founders: 20 }))));
    check('A save records its country; older saves load as Malaysia', sv.country === 'my' && !('country' in JSON.parse(LES_FIXTURES.mySave)));

    // Society, festivals, crime rates, events and calibration targets come from the pack.
    const MYp = LES.Countries.get('my'), Cl = LES.Calendar;
    let raya = null;
    for (let d = 0; d < 365 && !raya; d++) { const f = Cl.festivalStarts(d); if (f && f.id === 'raya') raya = f; }
    const fromPack = LES.Society.RELIGIONS.islam.name === MYp.society.religions.islam.name && LES.Society.DOSM_B40_MAX === MYp.society.bottom40Max
      && LES.Crime.REF.index === MYp.crime.index && LES.Calibration.TARGETS.medWage.label.includes(MYp.money.symbol)
      && LES.Calibration.TARGETS.tfr.target === MYp.calibration.tfr.target && raya && raya.name === 'Hari Raya Aidilfitri';
    Cl.setup({ festivals: [{ id: 'x', name: 'Test day', doy: 10, span: 1 }] }); // a country with one fixed holiday, no fasting month
    let fx = 0, fast = 0;
    for (let d = 0; d < 730; d++) { if (Cl.festival(d)) fx++; if (Cl.ramadan(d)) fast++; }
    Cl.setup(MYp.calendar);
    check('Religions, festivals, crime rates and calibration targets come from the country pack', fromPack && fx === 2 && fast === 0, `${fx} holidays, ${fast} fasting days`);
  }

  // UK rules (step 4b.2): taxes and benefits as HMRC and DWP set them for 2026/27.
  async function ukTests() {
    print('--- United Kingdom rules ---', 'info');
    const UKd = Object.assign({}, LES.DEFAULTS, LES.Countries.get('uk').defaults, { country: 'uk', seed: 'uk-r', founders: 60 });
    const w = new LES.World(UKd), FS = LES.Fiscal, near = (a, b, tol) => Math.abs(a - b) <= (tol || 2);
    check('Income tax: 20% above the £12,570 allowance after pension relief; the allowance tapers away above £100k',
      Math.round(FS.annualTaxOn(w, null, 36000)) === 4326 && Math.round(FS.annualTaxOn(w, null, 120000)) === 37032,
      `${Math.round(FS.annualTaxOn(w, null, 36000))} / ${Math.round(FS.annualTaxOn(w, null, 120000))}`);
    const p = w.living.find(x => x.adult), tags = () => Object.assign({}, w.gov.month.tags);
    p.cash = w.px(1e5);
    const t0 = tags(), job = { biz: -1, jobId: 'cleaner', salary: w.px(3000) };
    FS.onPay(w, p, job, w.px(3000), 0);
    const t1 = tags(), d = k => (t1[k] || 0) - (t0[k] || 0);
    check('National Insurance on £3,000 a month: £156.20 from the worker, £387.50 from the employer',
      near(d('National Insurance'), w.px(156.2)) && near(d('National Insurance (employers)'), w.px(387.5)), `${d('National Insurance')} / ${d('National Insurance (employers)')}`);
    const q = w.living.find(x => x.adult && x.job && x !== p);
    q.debt.study = w.px(40000); q.debt.studyOrig = q.debt.study; q.debt.slStart = w.day; q.enrol = null; q.cash = w.px(1e4);
    const sal = q.job.salary, before = q.debt.study;
    LES.Finance.debtMonth(w, q);
    const repaid = before + Math.round(before * 0.03 / 12) - q.debt.study, want = Math.round(Math.max(0, sal - w.px(25000 / 12)) * 0.09);
    check('Student loan (Plan 5): 9% of pay above £25,000 a year, through payroll', near(repaid, want), `${repaid} vs ${want}`);
    const poor = w.living.find(x => x.adult && x.cls !== 'T20' && x !== p && x !== q);
    if (poor) poor.cash = w.px(200);
    check('NHS care is free at the point of use', poor && LES.Services.medicalBill(w, poor, w.px(2000), false) === 0);
    for (let k = 0; k < 62; k++) w.step();
    const F = LES.Finance, uc = w.living.filter(x => x.alive && x.isHead && x.ucLast > 0);
    const single = uc.find(x => !x.job && x.partnerId === null && !x.careOf.some(id => !w.people[id].adult) && x.cash < w.px(5000));
    const exp = single ? w.px(425) + Math.min(F.tierCost(w, 'housing', single.tiers.housing), F.tierCost(w, 'housing', 1)) : 0;
    check('Universal Credit: a single adult with no job gets the standard allowance plus rent up to a council flat',
      single && Math.abs(single.ucLast - exp) / exp < 0.03, single ? `${single.ucLast} vs ${exp}` : `${uc.length} claimants, none single and jobless`);
    check('Universal Credit is tapered: households in work get less than the maximum', uc.some(x => x.job) ? uc.filter(x => x.job).every(x => x.ucLast < w.px(425 * 1.57 + 304 * 6) + F.tierCost(w, 'housing', 1)) : true);
    const M = w.gov.last ? w.gov.last.rev : {};
    check('Council tax and business rates are collected', (M['council tax'] || 0) > 0 && ((M['business rates'] || 0) > 0 || !w.biz.some(b => b.open)), JSON.stringify(Object.keys(M)));
    const old = new LES.World(Object.assign({}, UKd, { seed: 'uk-old', founders: 30, startAgeMin: 66, startAgeMax: 75 }));
    for (let k = 0; k < 40; k++) old.step();
    const sp = old.living.filter(x => x.alive && LES.P.age(old, x) >= 66);
    check('Everyone from 66 gets the State Pension (£241.30 a week)', sp.length > 10 && sp.every(x => x.earned.welfare >= old.px(241.3 * 52 / 12) - 2), `${sp.length} pensioners`);
    check('UK towns keep their books balanced', old.checkInvariants().length === 0, old.checkInvariants().join('; ')); // (w had cash set by hand above)

    // Step 4b.3: history in starting wealth, an equal-start option, cast from abroad, daylight and seasons.
    const startCash = cfg => { const t = new LES.World(Object.assign({}, UKd, { seed: 'uk-gap', founders: 400 }, cfg)), by = {};
      for (const x of t.living) (by[x.eth] = by[x.eth] || []).push(x.cash); return { by, mean: U.sum(t.living.map(x => x.cash)) / t.living.length }; };
    const U = LES.U, gap = startCash({}), eq = startCash({ groupWealth: 'equal' }), mean = a => U.sum(a) / a.length;
    check('UK founders start with a mild wealth gap by group (ONS), the town average unchanged',
      mean(gap.by.black) < mean(gap.by.white) * 0.75 && Math.abs(gap.mean / eq.mean - 1) < 0.08, `black ${Math.round(mean(gap.by.black) / 100)} white ${Math.round(mean(gap.by.white) / 100)} avg ${Math.round(gap.mean / 100)} vs ${Math.round(eq.mean / 100)}`);
    check('"Equal start" removes the gap', Math.abs(mean(eq.by.black) / mean(eq.by.white) - 1) < 0.6 && mean(eq.by.black) > mean(gap.by.black));
    const spec = Object.assign(LES.Cast.blank(), { id: 'x1', first: 'Aina', last: 'Rahman', eth: 'malay', country: 'my' });
    const withCast = new LES.World(Object.assign({}, UKd, { seed: 'uk-cast', founders: 30, cast: [Object.assign(spec, { town: 0 })] }));
    const aina = withCast.people.find(x => x.first === 'Aina' && x.last === 'Rahman');
    check('A cast member made in Malaysia arrives in a UK town as an immigrant', aina && aina.bornIn === 'my' && aina.eth === 'other' && aina.log.some(e => e.text.includes('Moved here from Malaysia')), aina ? `${aina.eth} ${aina.bornIn}` : 'not found');
    const A = LES.Ambience;
    if (A) {
      const len = d => { const x = A.sun(d); return x.set - x.rise; };
      check('UK daylight follows the seasons (16+ hours in June, under 8 in December); trees go bare in winter', len(171) > 16 && len(354) < 8 && A.season(10) === 'winter' && A.season(200) === 'summer', `${len(171).toFixed(1)}h / ${len(354).toFixed(1)}h`);
      LES.Countries.ensure(LES.DEFAULTS);
      check('Malaysian days stay the same length all year, with no seasons', len(171) === len(354) && A.season(10) === null);
    }
    LES.Countries.ensure(LES.DEFAULTS);
  }

  // United States (step 5): Ohio's rules with US statistics; money in real dollars at 1.75x the engine's units.
  async function usTests() {
    print('--- United States rules ---', 'info');
    const KC = LES.Countries, U = LES.U, USd = Object.assign({}, LES.DEFAULTS, KC.get('us').defaults, { country: 'us', seed: 'us-r', founders: 60 });
    const myAlone = (() => { const m = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'us-sw', founders: 40 })); for (let d = 0; d < 400; d++) m.step(); return m.stableHash(); })();
    const w = new LES.World(USd), FS = LES.Fiscal, K = KC.scale(), near = (a, b, tol) => Math.abs(a - b) <= (tol || 2);
    check('Money shows in real dollars (a janitor earns $3,000 a month; the goal is $200 million)', U.fmtMoney(LES.C.JOB_BY_ID.cleaner.salary * 100) === '$3,000' && U.fmtMoney(w.goal) === '$200.00M' && K === 1.75, `${U.fmtMoney(LES.C.JOB_BY_ID.cleaner.salary * 100)} ${U.fmtMoney(w.goal)}`);
    const t60 = FS.annualTaxOn(w, null, 60000 / K) * K;
    check('Federal income tax on $60,000: 10/12% above the $16,100 standard deduction and 401(k) savings', near(t60, 4588, 1), t60.toFixed(1));
    const p = w.living.find(x => x.adult), tags = () => Object.assign({}, w.gov.month.tags);
    p.cash = w.px(1e5);
    const t0 = tags(), gross = w.px(5000 / K);
    FS.onPay(w, p, { biz: -1, jobId: 'cleaner', salary: gross }, gross, 0);
    const t1 = tags(), d = k => ((t1[k] || 0) - (t0[k] || 0)) * K;
    check('On $5,000 a month: FICA $382.50 from worker and employer, Ohio tax $77.80, city tax $100',
      near(d('FICA (Social Security & Medicare)'), w.px(382.5), 4) && near(d('FICA (employers)'), w.px(382.5), 4) && near(d('Ohio income tax'), w.px(77.8), 4) && near(d('city income tax'), w.px(100), 4),
      ['FICA (Social Security & Medicare)', 'FICA (employers)', 'Ohio income tax', 'city income tax'].map(k => Math.round(d(k) / w.price) / 100).join(' / '));
    const q = w.living.find(x => x.adult && x !== p);
    q.cover = 'none'; q.cash = 0; q.debt.medical = 0;
    const bill = w.px(1000);
    LES.Services.medicalBill(w, q, 0, false, bill);
    check('Uninsured: a bill is charged at US prices (x2.2, 40% off self-pay) and what cannot be paid becomes medical debt', near(q.debt.medical, Math.round(bill * 2.2 * 0.6), 2), `${q.debt.medical} vs ${Math.round(bill * 2.2 * 0.6)}`);
    const r = w.living.find(x => x.adult && x !== p && x !== q);
    r.cover = 'employer'; r.cash = w.px(1e5); r.med = null;
    const own = LES.Services.medicalBill(w, r, 0, false, w.px(3000)), exp = w.px(1900 / K) + Math.round((w.px(3000) * 2.2 - w.px(1900 / K)) * 0.2);
    check('Employer plan: the patient pays the deductible, then 20% coinsurance', near(own, exp, 3), `${own} vs ${exp}`);
    for (let k = 0; k < 400; k++) w.step();
    const cov = {}; for (const x of w.living) if (x.alive) cov[x.cover || '?'] = (cov[x.cover || '?'] || 0) + 1;
    check('Everyone holds health cover or none: employer, Medicaid, marketplace, Medicare', (cov.employer || 0) > 0 && (cov.medicaid || 0) + (cov.market || 0) > 0, JSON.stringify(cov));
    const myW = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'us-sw', founders: 40 }));
    for (let k = 0; k < 400; k++) { myW.step(); w.step(); }
    check('Running a US town alongside changes nothing in a Malaysian one', myW.stableHash() === myAlone);
    const sv = LES.Save.toJSON(w), w2 = LES.Save.fromJSON(sv);
    for (let k = 0; k < 120; k++) { w.step(); w2.step(); }
    check('A US save loads in dollars and continues identically', JSON.parse(sv).country === 'us' && w2.stableHash() === w.stableHash() && U.sym() === '$');
    const old = new LES.World(Object.assign({}, USd, { seed: 'us-old', founders: 40, startAgeMin: 67, startAgeMax: 80 }));
    for (let k = 0; k < 40; k++) old.step();
    const ss = old.living.filter(x => x.alive && LES.P.age(old, x) >= 67);
    check('Social Security is paid from 67 out of the earnings record (a typical benefit ~$1,000-2,500)', ss.length > 20 && ss.every(x => x.ssPIA > 0) && ss.every(x => x.ssPIA * K > 700 && x.ssPIA * K < 5100), `${ss.length} retirees, avg $${Math.round(ss.reduce((a, x) => a + x.ssPIA, 0) / Math.max(1, ss.length) * K)}`);
    check('Medicare covers everyone from 65', ss.every(x => x.cover === 'medicare'));
    const poor = new LES.World(Object.assign({}, USd, { seed: 'us-poor', founders: 60, wealthDist: 'unequal' }));
    const base = {}; for (let k = 0; k < 400; k++) { const m = poor.gov.month; poor.step(); if (poor.gov.month !== m) for (const [kk, v] of Object.entries(m.spend || {})) base[kk] = (base[kk] || 0) + v; }
    check('SNAP food stamps go to low-income households', (base['SNAP (food stamps)'] || 0) > 0, Object.keys(base).join(', '));
    const fams = poor.living.filter(x => x.alive && x.isHead && x.careOf.some(id => !poor.people[id].adult && LES.P.age(poor, poor.people[id]) < 16));
    const pre = new Map(fams.map(x => [x.id, x.earned.welfare])), yr = poor.date.year;
    while (poor.date.year === yr) poor.step();
    const got = fams.filter(x => x.alive && x.earned.welfare - pre.get(x.id) >= poor.px(2200 / K) * 0.9);
    check('Families with children get the Child Tax Credit with the tax return', !fams.length || got.length >= fams.length * 0.5, `${got.length} of ${fams.length} families`);
    const workers = poor.living.filter(x => x.alive && x.job), RT = KC.pack.retirement;
    const inPlan = workers.filter(x => ((x.id * 2654435761 >>> 0) % 1000) / 1000 < RT.participation).length;
    check('About half of workers save in a 401(k)', workers.length < 10 || (inPlan / workers.length > 0.3 && inPlan / workers.length < 0.8), `${inPlan} of ${workers.length}`);
    check('US towns keep their books balanced', old.checkInvariants().length === 0 && poor.checkInvariants().length === 0, old.checkInvariants().concat(poor.checkInvariants()).join('; '));
    LES.Countries.ensure(LES.DEFAULTS);
    check('Malaysia shows ringgit again afterwards', U.fmtMoney(100000) === 'RM1,000');
  }

  // China (step 6): national rules in a central-China city; money in real yuan at 2.3x the engine's units.
  async function cnTests() {
    print('--- China rules ---', 'info');
    const KC = LES.Countries, U = LES.U, CN = LES.China, CNd = Object.assign({}, LES.DEFAULTS, KC.get('cn').defaults, { country: 'cn', seed: 'cn-r', founders: 80 });
    const myAlone = (() => { const m = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'cn-sw', founders: 40 })); for (let d = 0; d < 400; d++) m.step(); return m.stableHash(); })();
    const w = new LES.World(CNd), FS = LES.Fiscal, K = KC.scale(), near = (a, b, tol) => Math.abs(a - b) <= (tol || 2);
    check('Money shows in real yuan (a cleaner earns ¥2,800 a month; the goal is ¥200 million)', U.fmtMoney(LES.C.JOB_BY_ID.cleaner.salary * 100) === '¥2,800' && U.fmtMoney(w.goal) === '¥200.00M' && K === 2.3, `${U.fmtMoney(LES.C.JOB_BY_ID.cleaner.salary * 100)} ${U.fmtMoney(w.goal)}`);
    const t120 = FS.annualTaxOn(w, null, 120000 / K) * K;
    check('Income tax on ¥120,000 a year: 3% then 10% above ¥60,000 and the 17.5% social insurance and provident fund', near(t120, 1380, 1), t120.toFixed(1));
    const hk = {}; for (const x of w.living) hk[x.hukou] = (hk[x.hukou] || 0) + 1;
    check('Founders hold local urban, local rural or outside hukou (about 50/25/25)', hk.urban > hk.rural && hk.rural > 0 && hk.outside > 0 && hk.urban + hk.rural + hk.outside === w.living.length, JSON.stringify(hk));
    check('A Chinese name is written family name first', LES.P.name(w.living.find(x => x.eth === 'han')).split(' ')[0] === w.living.find(x => x.eth === 'han').last);
    const tags = () => Object.assign({}, w.gov.month.tags);
    const p = w.living.find(x => x.adult && CN.covered(w, x, { biz: -1, jobId: 'cleaner', startDay: 0 }));
    p.cash = w.px(1e5);
    let t0 = tags(), gross = w.px(8000 / K);
    FS.onPay(w, p, { biz: -1, jobId: 'cleaner', salary: gross, startDay: 0 }, gross, 0);
    let t1 = tags(); const d = k => ((t1[k] || 0) - (t0[k] || 0)) * K;
    check('On ¥8,000 a month (declared at 70%, ¥5,600): social insurance ¥588 from the worker (10.5%) and ¥1,400 from the employer (25%)',
      near(d('social insurance'), w.px(588), 4) && near(d('social insurance (employers)'), w.px(1400), 4), `${Math.round(d('social insurance') / w.price) / 100} / ${Math.round(d('social insurance (employers)') / w.price) / 100}`);
    t0 = tags(); gross = w.px(2000 / K);
    FS.onPay(w, p, { biz: -1, jobId: 'cleaner', salary: gross, startDay: 0 }, gross, 0); t1 = tags();
    check('Low pay still pays social insurance on 60% of the average wage (¥4,500: ¥472.50)', near(d('social insurance'), w.px(472.5), 4), `${Math.round(d('social insurance') / w.price) / 100}`);
    const q = w.living.find(x => x.adult && x !== p && !CN.covered(w, x, { biz: -1, jobId: 'cleaner', startDay: 0 })), job = { biz: -1, jobId: 'cleaner', salary: w.px(4000 / K), startDay: 0 };
    t0 = tags(); FS.onPay(w, q, job, job.salary, 0); t1 = tags();
    check('Many private jobs pay no social insurance (and then no unemployment insurance)', !job.si && !d('social insurance'));
    const man = { sex: 'M', birthDay: -60 * 365, deathDay: null }, woman = { sex: 'F', birthDay: -40 * 365, deathDay: null, cnWorker: true };
    check('Retirement age follows the 2025 reform (a man of 60 in 2026: 60 and 4 months; a woman worker born 1986: 55)', near(CN.retireAge(w, man) * 12, 724, 0.01) && near(CN.retireAge(w, woman), 55, 0.001), `${CN.retireAge(w, man)} ${CN.retireAge(w, woman)}`);
    const r = w.living.find(x => x.adult && x !== p && x !== q);
    Object.assign(r, { siMonths: 360, siIdx: 360, siAcct: 360 * 7500 / K * 0.08 });
    r.birthDay = w.day - 61 * 365; r.sex = 'M'; delete r.cnPension; CN.claim(w, r);
    const exp = 7500 * 30 * 0.01 + 360 * 7500 * 0.08 / 139;
    check("Employees' pension after 30 years at the average wage: 30% of it plus the personal account / 139", near(r.cnPension * K, exp, 2) && r.cnEmp, `${(r.cnPension * K).toFixed(0)} vs ${exp.toFixed(0)}`);
    Object.assign(r, { siMonths: 60 }); delete r.cnPension; CN.claim(w, r);
    check("Too few years of social insurance: the residents' pension (~¥230)", !r.cnEmp && near(r.cnPension * K, 230, 1));
    const pt = w.living.find(x => x.adult && x !== p && x !== q && x !== r);
    pt.cover = 'employee'; pt.cash = w.px(1e5); pt.med = null;
    const hs0 = w.gov.month.healthSub || 0, own = LES.Services.medicalBill(w, pt, 0, false, w.px(5000 / K)), bill = Math.round(w.px(5000 / K) * 1.3), expOwn = w.px(1300 / K) + Math.round((bill - w.px(1300 / K)) * 0.2);
    check("Employees' medical insurance: the patient pays the ¥1,300 deductible and 20%, the public fund the rest", near(own, expOwn, 3) && near((w.gov.month.healthSub || 0) - hs0, bill - own, 3), `${own} vs ${expOwn}`);
    const cal = [0, 365, 730, 1095].map(y => { for (let k = 0; k < 365; k++) { const f = LES.Calendar.festivalStarts(y + k); if (f && f.id === 'cny') return k; } return -1; });
    check('Spring Festival moves like the Chinese calendar (17 Feb 2026, 6 Feb 2027, 26 Jan 2028, 13 Feb 2029)', cal.join() === '47,36,25,44', cal.join());
    for (let k = 0; k < 365 * 6; k++) w.step();
    const g = w.gov;
    check('No elections: the province appoints the Party Secretary and reviews them every 5 years', LES.Gov.title(w) === 'Party Secretary' && g.elections.length >= 1 && g.elections.every(e => e.appointed && e.voted === 0) && (g.reviews || []).length >= 1 && !w.living.some(x => x.pol && x.pol.voted), `${g.elections.length} appointments, ${(g.reviews || []).length} reviews`);
    const kidsOk = w.living.filter(x => !x.adult && x.gen > 0).every(c => c.hukou && (c.parents.map(id => w.people[id]).some(m => m && m.hukou === 'urban') ? c.hukou === 'urban' : true));
    const newcomers = w.living.filter(x => x.migrant && x.arrivedDay > 0);
    check('Children take a parent\'s hukou; newcomers hold one elsewhere until they transfer', kidsOk && newcomers.every(x => x.hukou === 'outside' || x.hukou === 'urban'), `${newcomers.length} newcomers`);
    const base = {}; for (let k = 0; k < 400; k++) { const m = g.month; w.step(); if (g.month !== m) for (const [kk, v] of Object.entries(m.spend || {})) base[kk] = (base[kk] || 0) + v; }
    check('Dibao and the childcare subsidy are paid; residents insure themselves', (base['childcare subsidy'] || 0) > 0 && (base['dibao (minimum living allowance)'] || 0) >= 0 && w.living.some(x => x.cover === 'resident'), Object.keys(base).join(', '));
    const zk = w.living.filter(x => x.zk), voc = zk.filter(x => x.zk === 'vocational');
    check('The zhongkao sends part of each year to vocational schools, and vocational pupils find university harder', !zk.length || (voc.length > 0 && voc.length < zk.length && CN.examBar(w, voc[0], LES.C.COURSE_BY_ID.BACH_GEN) >= 2.5), `${voc.length} of ${zk.length}`);
    const myW = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'cn-sw', founders: 40 }));
    for (let k = 0; k < 400; k++) { myW.step(); w.step(); }
    check('Running a Chinese city alongside changes nothing in a Malaysian one', myW.stableHash() === myAlone);
    const sv = LES.Save.toJSON(w), w2 = LES.Save.fromJSON(sv);
    for (let k = 0; k < 120; k++) { w.step(); w2.step(); }
    check('A Chinese save loads in yuan and continues identically', JSON.parse(sv).country === 'cn' && w2.stableHash() === w.stableHash() && U.sym() === '¥');
    const fresh = new LES.World(Object.assign({}, CNd, { seed: 'cn-inv' })); for (let k = 0; k < 730; k++) fresh.step(); // (the town above had cash set by hand)
    check('Chinese cities keep their books balanced', fresh.checkInvariants().length === 0, fresh.checkInvariants().join('; '));
    LES.Countries.ensure(LES.DEFAULTS);
    check('Malaysia shows ringgit again afterwards', U.fmtMoney(100000) === 'RM1,000');
  }

  // Phase 6: calibrated markets (firms share a market the size of the town, wider pay, outside hires).
  async function marketTests() {
    print('--- Calibrated markets (Phase 6) ---', 'info');
    const F = LES.Finance, w = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'mk-1', founders: 120 }));
    let over = 0, months = 0;
    for (let d = 0; d < 365 * 12; d++) {
      w.step();
      if (w.date.lastOfMonth && w.bizLoad) { months++; for (const t of LES.C.BIZ) if (t.market) { const sold = w.biz.filter(b => b.open && b.type === t.id).reduce((a, b) => a + b.scale * (b.marketShare === undefined ? 1 : b.marketShare), 0); if (sold > F.marketSize(w, t) * 1.05 + 1) over++; } }
      if (d % 1500 === 0) await yieldUI();
    }
    check("Firms of a kind never sell more than their market (it grows with the town)", months > 100 && over === 0, `${over} months over, ${months} months`);
    check('Some openings go to people from outside town', (w.stats.vacOutside || 0) > 0 && w.stats.hires > w.stats.vacOutside, `${w.stats.vacOutside} outside, ${w.stats.hires} hires`);
    const pay = w.living.filter(p => p.job).map(p => Math.log(p.job.salary / LES.C.JOB_BY_ID[p.job.jobId].salary / w.price / 100)), m = pay.reduce((a, x) => a + x, 0) / pay.length;
    const sd = Math.sqrt(pay.reduce((a, x) => a + (x - m) * (x - m), 0) / pay.length);
    check('Pay within a job varies like real pay (log spread 0.25-0.6)', sd > 0.25 && sd < 0.6, sd.toFixed(2));
    const top = w.biz.filter(b => b.open).map(b => b.lastRevenue / w.price / 100).sort((a, b) => b - a)[0] || 0;
    check('No firm grows beyond what a small town can buy', top < 2e6, `biggest monthly sales ${Math.round(top)}`);
    check('Classic rules keep the original unlimited markets', LES.PRESETS.classic.values.econModel === 'original' && LES.upgradeConfig({}).econModel === 'original' && w.cfg.econModel === 'calibrated');
    check('The books still balance', w.checkInvariants().length === 0, w.checkInvariants().join('; '));
  }

  // Phase 6.2-6.3: the town newspaper, comparison runs, Aristocracy vs Meritocracy, report sections.
  async function phase6Tests() {
    print('--- Newspaper, comparisons, Aristocracy vs Meritocracy ---', 'info');
    const D = LES.DEFAULTS, w = new LES.World(Object.assign({}, D, { seed: 'p6-news', founders: 70 }));
    for (let d = 0; d < 365 * 3; d++) { w.step(); if (d % 1500 === 0) await yieldUI(); }
    const is = w.news.issues;
    check('The paper comes out every month, numbered, with at most six stories', is.length === 36 && is.every((x, i) => x.no === i + 1 && x.stories.length <= 6), `${is.length} issues`);
    const named = is.flatMap(x => x.stories).filter(st => st.pid >= 0);
    check('Stories about a person name them', named.length > 0 && named.every(st => st.text.includes(w.people[st.pid].first) || st.text.includes(w.people[st.pid].last)), named.slice(0, 2).map(x => x.text).join(' | '));
    check('Each country has its own paper', LES.News.name(w) === 'Berita Rezeki' && LES.Countries.get('uk').names.newspaper && LES.Countries.get('us').names.newspaper && LES.Countries.get('cn').names.newspaper);
    const w2 = LES.Save.fromJSON(LES.Save.toJSON(w));
    for (let d = 0; d < 40; d++) { w.step(); w2.step(); }
    check('The archive is saved and keeps growing after loading', w2.news.issues.length === 37 && w2.stableHash() === w.stableHash() && LES.News.issueAt(w2, 400) === 12, `${w2.news.issues.length}`);
    if (LES.NewsUI) check('A front page draws from an issue', /paper-mast/.test(LES.NewsUI.frontPage(w, 5)) && /Berita Rezeki/.test(LES.NewsUI.frontPage(w, 5)));
    // Comparisons
    const CMP = LES.Compare;
    if (CMP) {
      check('Today\'s rules compare with Classic, anything else with today\'s rules', CMP.target(w.cfg) === 'classic' && CMP.target(Object.assign({}, w.cfg, { scenario: 'pandemic' })) === 'national' && CMP.config(w.cfg).country === 'my' && CMP.config(Object.assign({}, w.cfg, { crime: 'off' })).crime === LES.PRESETS.national.values.crime);
      const small = new LES.World(Object.assign({}, D, { seed: 'p6-cmp', founders: 40, scenario: 'equal' }));
      for (let d = 0; d < 365; d++) small.step();
      const base = await CMP.run(small);
      check('A comparison world runs to the same day under the other rules', base.years === 1 && base.pop > 20 && base.seed === 'p6-cmp' && small.cfg.scenario === 'equal' && LES.Countries.active === 'my', JSON.stringify({ y: base.years, pop: base.pop }));
    }
    // Aristocracy vs Meritocracy
    const ar = new LES.World(Object.assign({}, D, { seed: 'p6-ar', founders: 80, scenario: 'aristo', aristoMode: 'aristocracy' }));
    const fo = ar.people.filter(p => p.adult), nob = fo.filter(p => p.noble), cash = q => q.reduce((a, p) => a + p.cash, 0);
    check('Aristocracy: a tenth of the founders are noble and hold most of the money', nob.length >= 6 && nob.length <= 10 && cash(nob) > cash(fo) * 0.5, `${nob.length} nobles, ${Math.round(cash(nob) / cash(fo) * 100)}%`);
    for (let d = 0; d < 365 * 6; d++) { ar.step(); if (d % 1500 === 0) await yieldUI(); }
    const kids = ar.people.filter(p => p.parents.length && p.parents.some(id => ar.people[id].noble));
    check('Children of nobles are noble; no inheritance tax', kids.every(c => c.noble) && ar.policy.estateTax === 0, `${kids.length} noble children`);
    const me = new LES.World(Object.assign({}, D, { seed: 'p6-me', founders: 80, scenario: 'aristo', aristoMode: 'meritocracy' }));
    const c0 = me.people.filter(p => p.adult).map(p => p.cash);
    check('Meritocracy: every founder starts with the same money', c0.every(x => x === c0[0]));
    for (let d = 0; d < 365 * 3; d++) me.step();
    check('Meritocracy: free university and a 90% inheritance tax', me.gov.laws.uniFees === 'free' && me.policy.estateTax === 0.9 && /inherited share/.test(LES.Scenarios.BY_ID.aristo.status(me)));
    check('Both worlds keep their books balanced', ar.checkInvariants().length === 0 && me.checkInvariants().length === 0, ar.checkInvariants().concat(me.checkInvariants()).join('; '));
    if (LES.Report) {
      const html = LES.Report.html(ar);
      check('The report has the new sections', ['Against official figures', 'Work and business', 'a front page a decade', 'Aristocracy vs Meritocracy'].every(t => html.includes(t)));
    }
  }

  // C01: tie-aware Spearman and honest wording about inheritance in the report.
  async function reportStatsTests() {
    print('--- Report statistics (C01) ---', 'info');
    const R = LES.Report;
    if (!R || !R.spearman) { check('The report module is loaded', false); return; }
    const near = (a, b) => a !== null && Math.abs(a - b) < 1e-9;
    check('Tied ranks share their average rank', JSON.stringify(R.rankWithTies([1, 1, 2, 3])) === '[1.5,1.5,3,4]' && JSON.stringify(R.rankWithTies([3, 1, 3, 3])) === '[3,1,3,3]');
    check('Spearman with ties: [1,1,2,3] vs [1,2,3,4] = 0.948683298', near(R.spearman([1, 1, 2, 3], [1, 2, 3, 4], 2), 0.9486832980505138), String(R.spearman([1, 1, 2, 3], [1, 2, 3, 4], 2)));
    check('Reordering the rows gives the same result', near(R.spearman([2, 1, 3, 1], [3, 2, 4, 1], 2), 0.9486832980505138));
    check('Perfect and reversed orders give 1 and -1', near(R.spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], 2), 1) && near(R.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1], 2), -1));
    check('A constant series has no correlation (null)', R.spearman([5, 5, 5, 5, 5, 5, 5, 5], [1, 2, 3, 4, 5, 6, 7, 8]) === null && R.spearman([1, 2, 3, 4, 5, 6, 7, 8], [2, 2, 2, 2, 2, 2, 2, 2]) === null);
    check('Too few pairs give null; missing values are dropped', R.spearman([1, 2, 3], [1, 2, 3]) === null && near(R.spearman([1, NaN, 2, 3, 4], [1, 9, 2, 3, 4], 2), 1));
    const w = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'c01', founders: 60 }));
    for (let d = 0; d < 365 * 12; d++) { w.step(); if (d % 1500 === 0) await yieldUI(); }
    const a = R.analyse(w), html = R.html(w);
    check('Every factor has a correlation in [-1, 1] or n/a', a.factors.length > 0 && a.factors.every(f => f.r === null || (f.r >= -1 - 1e-12 && f.r <= 1 + 1e-12)), a.factors.map(f => f.r === null ? 'n/a' : f.r.toFixed(2)).join(' '));
    check('The report no longer calls anyone self-made; it says what inheritance measures', !/self-made/i.test(html) && /recorded cash inheritance and gifts/i.test(html) && /not proof of cause|not causes/i.test(html));
  }

  // C02: one highest-credential classification for the tertiary measure.
  async function eduLevelTests() {
    print('--- Education levels (C02) ---', 'info');
    const Cal = LES.Calibration, KC = LES.Countries, q = quals => ({ quals });
    KC.ensure(LES.DEFAULTS);
    check('Malaysia: a vocational certificate alone is not tertiary (ISCED 4)', Cal.eduLevel(q(['VOC'])) === 4 && Cal.eduLevel(q([])) === 0);
    check("A bachelor's is 6; medicine and master's are 7; several credentials count once at the highest", Cal.eduLevel(q(['BACH_GEN'])) === 6 && Cal.eduLevel(q(['MED'])) === 7 && Cal.eduLevel(q(['VOC', 'BACH_BUS', 'MASTER'])) === 7);
    KC.ensure(Object.assign({}, LES.DEFAULTS, { country: 'us' }));
    const us = Cal.eduLevel(q(['VOC']));
    KC.ensure(Object.assign({}, LES.DEFAULTS, { country: 'uk' }));
    const uk = Cal.eduLevel(q(['VOC']));
    KC.ensure(Object.assign({}, LES.DEFAULTS, { country: 'cn' }));
    const cn = Cal.eduLevel(q(['VOC']));
    KC.ensure(LES.DEFAULTS);
    check('The vocational credential follows each country: US associate degree 5, UK Level 3 Diploma 4, China dazhuan 5', us === 5 && uk === 4 && cn === 5, `${us} ${uk} ${cn}`);
    const w = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'c02', founders: 80 }));
    for (let d = 0; d < 365; d++) w.step();
    const m = Cal.measure(w), prime = w.living.filter(p => p.alive && !p.away && LES.P.age(w, p) >= 25 && LES.P.age(w, p) < 65);
    const voc = prime.filter(p => p.quals.length && Cal.eduLevel(p) < 5).length;
    check('The share counts each adult 25-64 once by the highest credential', m.tertiaryN === prime.length && m.tertiaryHits === prime.filter(p => p.quals.some(x => x !== 'VOC')).length && Math.abs(m.tertiary - m.tertiaryHits / m.tertiaryN) < 1e-12 && voc > 0, `${m.tertiaryHits}/${m.tertiaryN}, ${voc} vocational only`);
    const tiny = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'c02s', founders: 20, startAgeMin: 18, startAgeMax: 23 })); // nobody aged 25-64 yet
    check('Too few adults: the share is not shown', Number.isNaN(Cal.measure(tiny).tertiary) && Cal.measure(tiny).tertiaryN < Cal.MIN_EDU_N);
  }

  // C03: the catastrophe chance after a failed risky task respects its cap after the risk multiplier.
  async function catCapTests() {
    print('--- Catastrophe cap (C03) ---', 'info');
    const A = LES.Actions, D = LES.DEFAULTS, rev1 = Object.assign({}, D, { rulesRev: 1 }), near = (a, b) => Math.abs(a - b) < 1e-12;
    check('Rules revision 2 for new worlds; Classic and older saves keep revision 1', D.rulesRev === 2 && LES.PRESETS.classic.values.rulesRev === 1 && LES.upgradeConfig({}).rulesRev === 1);
    check('Heavy work, ability gap 5: revision 1 went past the cap (3.4%), revision 2 stops at 2%', near(A.catProb(rev1, 5, 'heavy'), 0.03375) && near(A.catProb(D, 5, 'heavy'), D.catCap), `${A.catProb(rev1, 5, 'heavy')} / ${A.catProb(D, 5, 'heavy')}`);
    check('Below the cap nothing changes (no gap, light physical work, the multiplier still applies)', near(A.catProb(D, 0, 'physical'), D.catBase) && near(A.catProb(D, 0, 'heavy'), D.catBase * 2.5) && near(A.catProb(D, 2, 'heavy'), A.catProb(rev1, 2, 'heavy')));
    const vals = []; for (const gap of [0, 0.5, 1, 2, 4, 8, 50, 1e6]) for (const risk of ['physical', 'heavy', 'unknown']) vals.push(A.catProb(D, gap, risk));
    check('Every chance is between 0 and the cap, also for huge gaps and an infinite factor', vals.every(v => v >= 0 && v <= D.catCap) && A.catProb(Object.assign({}, D, { catGap: Infinity }), 3, 'heavy') === D.catCap);
    const w = new LES.World(Object.assign({}, D, { seed: 'c03', founders: 30 })), p = w.living.find(x => x.adult), J = LES.C.JOB_BY_ID.construction;
    const o = A.taskOdds(w, p, J.w, J.diff + 4, 0, 'heavy');
    check('Overall catastrophe chance = failure chance x chance after a failure; success is unchanged', near(o.cat, (1 - o.success) * o.catIfFail) && near(o.success, A.successProb(w, p, J.w, J.diff + 4, 0)) && o.catIfFail <= D.catCap);
    const bad = c => LES.validateConfig(Object.assign({}, D, c)).blockers.length > 0;
    check('Settings check the catastrophe values', bad({ catCap: 1.5 }) && bad({ catBase: 0.05 }) && bad({ catGap: -1 }) && !bad({}));
  }

  async function runAll() {
    out.textContent = '';
    passed = 0; failed = 0;
    const t0 = performance.now();
    try {
      await unitTests();
      await townTests();
      await goalTests();
      await foundationTests();
      await societyTests();
      await crimeTests();
      await govTests();
      await fiscalTests();
      await scenarioTests();
      await regionTests();
      await castTests();
      await countryTests();
      await ukTests();
      await usTests();
      await cnTests();
      await marketTests();
      await phase6Tests();
      await reportStatsTests();
      await eduLevelTests();
      await catCapTests();
      await tileTests();
      await determinism();
      await invariantSweep(3, 60);
    } catch (err) {
      failed++;
      print(`CRASH: ${err.stack || err}`, 'fail');
    }
    print(`\n${passed} passed, ${failed} failed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, failed ? 'fail' : 'pass');
    document.title = failed ? `FAILED ${failed}` : `PASSED ${passed}`;
  }

  window.LES_TESTS = { runAll, balance, invariantSweep, determinism, unitTests, townTests, goalTests, foundationTests, societyTests, crimeTests, govTests, fiscalTests, scenarioTests, regionTests, castTests, countryTests, ukTests, usTests, cnTests, marketTests, phase6Tests, reportStatsTests, eduLevelTests, catCapTests, tileTests };
  if (/[?&]autorun/.test(location.search)) runAll(); // e.g. headless: tests.html?autorun
})(globalThis.LES);
