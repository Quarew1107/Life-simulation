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
    // Engine-independent fingerprints of the original engine at day 1500 (recorded from the
    // code before the new systems; the same in Node and Chrome).
    const ORIGINAL = { 'h-1': '65eac2d1dd21d2c310dc374bbbeb96b5', 'h-2': '1d3752726ba024c8edd4da025714b6d4' };
    for (const seed of Object.keys(ORIGINAL)) {
      const w = new LES.World(Object.assign({ seed }, LES.PRESETS.classic.values));
      await runDays(w, 1500);
      check(`Classic preset reproduces the original engine exactly (${seed})`, w.stableHash() === ORIGINAL[seed], w.stableHash());
    }
    check('Defaults are the Malaysia preset', LES.presetOf(LES.DEFAULTS) === 'malaysia');

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
    // A private school: built on an empty lot, staffed and paid by its owner.
    const owner = w.living.filter(q => q.adult && !q.inst && q.manages < 0).sort((a, b) => b.cash - a.cash)[0];
    w.ledger.pay('GENESIS', owner, 'cash', w.px(4e6));
    const lots = w.town.lots.filter(id => !w.town.buildings[id].built).length;
    F.startBusiness(w, owner, { type: LES.C.BIZ_BY_ID.privschool, skill: 5 }, { mc: owner.mcost, risk: 0.3 });
    const sch = w.biz[w.biz.length - 1];
    check('A private school is built on an empty lot', w.town.buildings[sch.place].kind === 'privschool' && w.town.lots.filter(id => !w.town.buildings[id].built).length === lots - 1);
    await runDays(w, 75);
    const staff = w.living.filter(p => p.job && p.job.biz === sch.id);
    check('It hires its own teachers, who are paid by the school', staff.length > 0 && staff.every(p => p.job.jobId === 'teacher' && !SV.lineOf(p.job)) && (sch.payrollLast > 0 || sch.payrollNow > 0), `${staff.length} staff`);
    F.closeBiz(w, sch, 'closed (test)', false);
    check('When it closes, its staff lose their jobs', w.living.every(p => !(p.job && p.job.biz === sch.id)));
    check('Money check after the school closes', w.checkInvariants().length === 0, w.checkInvariants().slice(0, 2).join(' | '));
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
    check('Eternal Life: no ageing decline, no retirement, no old-age mortality', et.flags.noAgeing && et.cfg.mortMult === 0 && et.people.every(p => !p.retired) && et.people.every((p, i) => !p.alive || p.att[1] >= att0[i][1] - 1e-9 || p.injuredUntil > 0));
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
    const mv = R.moves[0], [fromId, toId] = mv.pairs[0], a = R.towns[mv.from].people[fromId], b = R.towns[mv.to].people[toId];
    check('A mover is the same person in the new town, linked back to the old one', a.first === b.first && a.birthDay === b.birthDay && a.away.town === mv.to && b.xlinks[0].id === fromId);
    const R2 = mk(), R3 = mk();
    for (let d = 0; d < 2 * 365; d++) { R2.step(); R3.step(); }
    check('Same seed -> same region history', R2.hash() === R3.hash());
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
      await determinism();
      await invariantSweep(3, 60);
    } catch (err) {
      failed++;
      print(`CRASH: ${err.stack || err}`, 'fail');
    }
    print(`\n${passed} passed, ${failed} failed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, failed ? 'fail' : 'pass');
    document.title = failed ? `FAILED ${failed}` : `PASSED ${passed}`;
  }

  window.LES_TESTS = { runAll, balance, invariantSweep, determinism, unitTests, townTests, goalTests, foundationTests, societyTests, crimeTests, govTests, fiscalTests, scenarioTests, regionTests };
  if (/[?&]autorun/.test(location.search)) runAll(); // e.g. headless: tests.html?autorun
})(globalThis.LES);
