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
    const inmates = w.people.filter(p => p.inst);
    check('Prisoners hold no job, course, business role or children', inmates.every(p => !p.job && !p.enrol && p.manages < 0 && !p.careOf.length));
    // Admission: job lost, children re-homed, record after release.
    const w2 = new LES.World({ seed: 'crime-unit', founders: 60 });
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
    const dec = new LES.World({ seed: 'cr-d', founders: 200, crime: 'lawless', drugPolicy: 'decriminalised' });
    await runDays(dec, 8 * 365);
    check('Decriminalised drug use: no possession arrests', dec.crime.drugArrests === 0);
    const off = new LES.World({ seed: 'cr-off', founders: 40, crime: 'off' });
    await runDays(off, 200);
    check('Crime off: no crime state and nobody in an institution', !off.crime && off.people.every(q => !q.inst));
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
      await determinism();
      await invariantSweep(3, 60);
    } catch (err) {
      failed++;
      print(`CRASH: ${err.stack || err}`, 'fail');
    }
    print(`\n${passed} passed, ${failed} failed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, failed ? 'fail' : 'pass');
    document.title = failed ? `FAILED ${failed}` : `PASSED ${passed}`;
  }

  window.LES_TESTS = { runAll, balance, invariantSweep, determinism, unitTests, townTests, goalTests, foundationTests, societyTests, crimeTests };
  if (/[?&]autorun/.test(location.search)) runAll(); // e.g. headless: tests.html?autorun
})(globalThis.LES);
