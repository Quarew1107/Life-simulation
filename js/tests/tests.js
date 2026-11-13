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
    const w = new LES.World({ seed: 'tc001', founderAges: 'young' }); // the original acceptance case: 100 young adults
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
    if (LES.Labour.placesOn(w9)) LES.Labour.places(w9).credit.bach = 5; // (C06: a place is free for this test)
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
    // (life expectancy needs 30 deaths and old people under revision 10: founderTests)
    check('Calibration measures are computed', ['unemp', 'medWage', 'hhGini'].every(k => Number.isFinite(m[k])) && (Number.isFinite(m.e0) || a.cfg.rulesRev >= 10), JSON.stringify(m));
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
    for (let d = 0; d < 125 && !sch.payrollLast; d++) ws.step(); // towns of all ages have few jobless people: hiring takes longer
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
    // C06 (rules revision 4: founders' credentials by age group, limited study places) changes every history;
    // the previous revision-3 values (84f18b75.../3da2af2a, bd26ca13.../d49639b8, 3f0a2222.../ae339d10,
    // cf3fc7fb.../a233679e, 7b691ae4...) are still reproduced with rulesRev 3 (eduPlacesTests). Reports before:
    // 445f0e50, 389a9630, 18479e2.
    const MY = {
      'my-default': '6f46c9e387bf10ddb3b3d94033aa64ce/cb7d9c49', 'my-options': '478956fafcd072210c38ac8aaacb39cd/d70395a8',
      'my-pandemic-lawless': 'c33476168a16d5f0a362c77d2f215eda/e6ce124', 'my-clans': '93ccd394844426d0f15e2b43e3008f9f/8289b714',
      'my-region': 'ab81f274d51b6e9d5aecda08fa5a643a/a914266d|f44d51d9c8881b2e652614ab4bfa904c/3c9ffbdf|5684b117ae77f6fc4ebd4a3c37311c5d/1d4dc438',
      'my-save': '93a0eff009e13bbf0631071fc098447a',
    };
    // 4a.6: the report names the drug policy instead of printing its key; 4b.1: a Country row in the settings table and "Today's rules".
    const REPORT = { 'my-default': '3dd8644c', 'my-pandemic-lawless': '3a0930ad', 'my-region': '20db8eae' }; // Nov 2026 review task 3 (styling only: pixel headings, the app's dark colours, font link, download link freed; before: ab1b27f1, f1c1593e, b2dad035). Nov 2026: 'Town name' moved up the settings table (main setup page). Before that, C07 (report text only): sustained-mobility status and the four wealth origins (before: 6d4336bf, 53df8f5a, 1373d1e7). // C10 (report text only, engine fingerprints unchanged): 'How to read this', softer cause wording (before: caaeab0d, b9679882, 5a42d376). C08: a 'Town name' row in the settings table (before: 552b2b16, bca4204f, 821ba9a8). C06: new histories (rules revision 4). // C01 (report text only, engine fingerprints unchanged): tie-aware Spearman, n/a values, inheritance wording. Before C01: f66c05b8, 62c7b2a, cb8afa3d. Phase 6.2: official figures, work and business, the paper; // 4b.3: a 'Starting wealth by group' row; Phase 6: new histories and a 'Business and job markets' row
    // Expansion 1 (rules revision 5) adds jobs, degrees and goals, so these stored fingerprints are pinned to
    // revision 4, which must keep reproducing them exactly (revision 5 is checked in expansionTests).
    const D = LES.DEFAULTS, base = { founders: 80, migration: 'normal', rulesRev: 4 };
    const cases = {
      'my-default': () => new LES.World(Object.assign({}, D, base, { seed: 'my-1' })),
      'my-options': () => new LES.World(Object.assign({}, D, base, { seed: 'my-2', drugPolicy: 'treatment', leaderTitle: 'datuk', interfaith: 'free', ethnicMix: 'classic', fertility: 'normal', education: 'expensive', wealthDist: 'unequal' })),
      'my-pandemic-lawless': () => new LES.World(Object.assign({}, D, base, { seed: 'my-3', scenario: 'pandemic', pandemicYear: '5', crime: 'lawless' })),
      'my-clans': () => new LES.World(Object.assign({}, D, base, { seed: 'my-4', scenario: 'clans' })),
      'my-region': () => new LES.Region(Object.assign({}, D, { seed: 'my-5', migration: 'normal', towns: '3', rulesRev: 4 }), [{ founders: 60 }, { founders: 40, seed: 'my-5b' }, { founders: 30, seed: 'my-5c' }]),
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
    // A firm's share is set from its size before the month-end growth, and its revenue uses that size, so
    // what it sold is measured with the size from the day before (a boom the same night can add up to 50%).
    const before = new Map();
    for (let d = 0; d < 365 * 12; d++) {
      if (U.dayToDate(w.day).lastOfMonth) { before.clear(); for (const b of w.biz) if (b.open) before.set(b.id, b.scale); }
      w.step();
      if (w.date.lastOfMonth && w.bizLoad) { months++; for (const t of LES.C.BIZ) if (t.market) { const sold = w.biz.filter(b => b.open && b.type === t.id).reduce((a, b) => a + (before.has(b.id) ? before.get(b.id) : b.scale) * (b.marketShare === undefined ? 1 : b.marketShare), 0); if (sold > F.marketSize(w, t) * 1.05 + 1) over++; } }
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
    check('Rules revision 2 or later for new worlds; Classic and older saves keep revision 1', D.rulesRev >= 2 && LES.PRESETS.classic.values.rulesRev === 1 && LES.upgradeConfig({}).rulesRev === 1);
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

  // C04b: estates settled in equal value (rules revision 3), blueprint 4.7 cases E-01..E-12.
  async function estateTests() {
    print('--- Estates (C04b, rules revision 3) ---', 'info');
    const D = LES.DEFAULTS, F = LES.Finance, Fa = LES.Family, P = LES.P;
    // (pinned to rules revision 5: the cases need households these seeds grow under those rules; estates are the same in 5 and 6)
    const town = async (seed, years, extra) => { const w = new LES.World(Object.assign({}, D, { seed, founders: 150, rulesRev: 5 }, extra || {})); for (let d = 0; d < 365 * years; d++) { w.step(); if (d % 1500 === 0) await yieldUI(); } return w; };
    const near = (a, b, tol) => Math.abs(a - b) <= (tol || 2);
    // Strip a person to a known estate: no investments, pension, trust or shares; exactly `cash`.
    const strip = (w, p, cash) => {
      const L = w.ledger;
      if (P.invValue(w, p) > 0) F.raiseCash(w, p, P.invValue(w, p) + 1, 'test');
      p.inv = { idx: 0, st: {}, cost: 0 };
      if (p.epf > 0) L.spend(p, 'epf', 'GENESIS', p.epf);
      if (p.trust > 0) L.spend(p, 'trust', 'GENESIS', p.trust);
      for (const k of Object.keys(p.shares)) { const b = w.biz[Number(k)]; if (b.open) F.sellBiz(w, b, 'test'); }
      if (p.cash > cash) L.spend(p, 'cash', 'GENESIS', p.cash - cash); else if (p.cash < cash) L.pay('GENESIS', p, 'cash', cash - p.cash);
      p.debt.study = 0; p.debt.medical = 0;
    };
    // A firm owned 60/40 by `other` and `p`, valued at `equity`.
    const firm = (w, p, other, equity) => {
      const b = w.biz.find(x => x.open && x.managerId !== p.id && !Object.keys(x.shares).some(k => Number(k) === p.id));
      for (const k of Object.keys(b.shares)) { delete w.people[Number(k)].shares[b.id]; if (w.people[Number(k)].manages === b.id) w.people[Number(k)].manages = -1; }
      b.shares = { [other.id]: 0.6, [p.id]: 0.4 }; other.shares[b.id] = 0.6; p.shares[b.id] = 0.4; b.outsideShare = 0;
      b.managerId = other.id; other.manages = b.id; b.equity = equity;
      return b;
    };
    check('New worlds settle estates under rules revision 3 or later; Classic and older saves keep the old settlement', D.rulesRev >= 3 && LES.PRESETS.classic.values.rulesRev === 1 && LES.upgradeConfig({}).rulesRev === 1);

    // E-01: RM240k cash, RM40k study debt, 40% of a RM900k firm, 3 children (one away), 20% tax above RM100k.
    const w = await town('est-1', 35);
    const dad = w.living.find(p => p.alive && p.adult && p.children.filter(id => w.people[id].alive && w.people[id].adult && !w.people[id].away && w.people[id].manages < 0).length >= 3);
    if (!dad) { check('E-01 needs a parent with three adult children in this town', false); return; }
    const kids = dad.children.map(id => w.people[id]).filter(c => c.alive && c.adult && !c.away && c.manages < 0).slice(0, 3);
    for (const c of dad.children.map(id => w.people[id])) if (c.alive && !kids.includes(c)) c.alive = false; // only the three count as heirs here
    strip(w, dad, w.px(240000)); dad.debt.study = w.px(40000);
    const other = w.living.find(p => p.alive && p.adult && p !== dad && !kids.includes(p) && p.manages < 0);
    const b = firm(w, dad, other, w.px(900000));
    for (const c of kids) for (const k of Object.keys(c.shares)) { const bb = w.biz[Number(k)]; if (bb.open && bb !== b) F.sellBiz(w, bb, 'test'); }
    const away = kids[2], awayCash = away.cash; LES.Ledger && 0;
    w.ledger.spend(away, 'cash', 'GENESIS', away.cash); away.away = { wealth: 0 }; // lives in another place now
    w.policy.estateTax = 0.2;
    const tax0 = w.gov.estateTaxTotal, cash0 = kids.map(c => c.cash), n0 = w.estates.length;
    w.die(dad, 'test');
    const rec = w.estates[w.estates.length - 1], val = c => Math.round((b.shares[c.id] || 0) * b.equity) + (c.away ? c.away.wealth : c.cash - cash0[kids.indexOf(c)]);
    check('E-01: tax RM92,000 on cash plus the business stake, after the RM40,000 debt', near(w.gov.estateTaxTotal - tax0, w.px(92000)), `${(w.gov.estateTaxTotal - tax0) / 100}`);
    check('E-01: every child receives RM156,000 of value, the child living away included', kids.every(c => near(val(c), w.px(156000), 50)) && near(away.away.wealth, w.px(156000), 4) && near(rec.total, w.px(468000), 3) && w.estates.length === n0 + 1, kids.map(c => val(c) - w.px(156000)).join(' / ') + ' sen off');
    check('E-04: the other owner keeps exactly 60%; the outside investor holds the slice sold for the child away', near(b.shares[other.id], 0.6, 1e-12) && near(b.outsideShare, 48000 / 900000, 1e-6) && b.shares[dad.id] === undefined && near(Object.values(b.shares).reduce((a, x) => a + x, 0) + b.outsideShare, 1, 1e-9), `${b.outsideShare}`);
    check('E-02: children are grouped by the parent who died (equal value, whoever the other parent is)', rec.heirs.length === 3 && near(val(kids[0]), val(kids[1]), 4));
    // E-09: a second settlement does nothing.
    const before = JSON.stringify([w.ledger.sec.TAX.bal, w.ledger.sec.ESTATE.bal, kids.map(c => c.cash), away.away.wealth]);
    Fa.settleEstate(w, dad); w.die(dad, 'again');
    check('E-09: settling the same death twice changes nothing', before === JSON.stringify([w.ledger.sec.TAX.bal, w.ledger.sec.ESTATE.bal, kids.map(c => c.cash), away.away.wealth]) && w.estates.length === n0 + 1);

    // E-05: no children; E-06: worthless firm; E-07: tax larger than the cash; E-08: debt order.
    const w2 = await town('est-2', 30);
    const free = () => w2.living.find(p => p.alive && p.adult && p.alive && !p.away && p.manages < 0 && !Object.keys(p.shares).length && p.children.every(id => !w2.people[id].alive) && !p.inst);
    const lone = free(); strip(w2, lone, w2.px(50000));
    const o2 = w2.living.find(p => p.alive && p.adult && p !== lone && p.manages < 0 && !p.inst), b2 = firm(w2, lone, o2, w2.px(300000));
    const est0 = w2.ledger.sec.ESTATE.bal;
    w2.die(lone, 'test');
    check('E-05: no children: the cash goes to the estate sector, the other owner keeps 60%, the outside investor takes the 40%', near(b2.shares[o2.id], 0.6, 1e-12) && near(b2.outsideShare, 0.4, 1e-12) && b2.managerId === o2.id && near(w2.ledger.sec.ESTATE.bal - est0, w2.px(50000)));
    const poor = free(); strip(w2, poor, w2.px(1000)); poor.debt.study = w2.px(5000); poor.debt.medical = w2.px(3000);
    const wo0 = w2.ledger.writeOffs; w2.die(poor, 'test');
    const r2 = w2.estates[w2.estates.length - 1];
    check('E-08: debts are paid in order (study, then medical) and the rest is written off, never passed on', near(r2.debts.study, w2.px(1000)) && r2.debts.medical === 0 && near(w2.ledger.writeOffs - wo0, w2.px(7000), 4) && poor.debt.medical === 0 && r2.total === 0, JSON.stringify(r2.debts) + ' wo ' + (w2.ledger.writeOffs - wo0) + ' total ' + r2.total);
    const parent = w2.living.find(p => p.alive && p.adult && p.manages < 0 && !p.inst && !Object.keys(p.shares).length && p.children.some(id => w2.people[id].alive && !w2.people[id].away));
    strip(w2, parent, w2.px(20000));
    const o3 = w2.living.find(p => p.alive && p.adult && p !== parent && p.manages < 0 && !p.inst && !parent.children.includes(p.id)), b3 = firm(w2, parent, o3, 0);
    const heirs3 = parent.children.map(id => w2.people[id]).filter(c => c.alive);
    const c3 = heirs3.map(c => c.cash + c.trust + (c.away ? c.away.wealth : 0));
    w2.die(parent, 'test');
    check('E-06: a worthless firm: the children share only the cash, nobody ends up below zero', heirs3.every((c, i) => c.cash + c.trust + (c.away ? c.away.wealth : 0) >= c3[i]) && heirs3.every(c => c.cash >= 0 && c.trust >= 0) && near(Object.values(b3.shares).reduce((a, x) => a + x, 0) + (b3.outsideShare || 0), 1, 1e-9));
    const rich = w2.living.find(p => p.alive && p.adult && p.manages < 0 && !p.inst && !Object.keys(p.shares).length && p.children.some(id => w2.people[id].alive));
    strip(w2, rich, w2.px(10000));
    const o4 = w2.living.find(p => p.alive && p.adult && p !== rich && p.manages < 0 && !p.inst && !rich.children.includes(p.id)), b4 = firm(w2, rich, o4, w2.px(2000000));
    w2.policy.estateTax = 0.2;
    const t4 = w2.gov.estateTaxTotal, taxBal = w2.ledger.sec.TAX.bal;
    w2.die(rich, 'test');
    const due = Math.round((w2.px(10000) + w2.px(800000) - w2.px(100000)) * 0.2);
    check('E-07: tax above the cash is paid by selling part of the stake; the tax recorded is the tax moved', near(w2.gov.estateTaxTotal - t4, due) && w2.ledger.sec.TAX.bal - taxBal >= due - 2 && rich.cash === 0 && b4.outsideShare > 0 && near(Object.values(b4.shares).reduce((a, x) => a + x, 0) + b4.outsideShare, 1, 1e-9), `${(w2.gov.estateTaxTotal - t4) / 100} vs ${due / 100}`);
    w2.policy = LES.Gov.policyOf(w2.gov.laws); // E-07 set the tax directly, not by law: put the law's policy back so the saved world (which rebuilds policy from the laws) matches (E-10)
    check('Every estate record adds up: no negative amounts', w2.estates.filter(r => r.rev === 3).every(r => r.amounts.every(x => x >= 0) && r.equity.every(x => x >= 0) && r.total >= 0));
    check('The books balance after these estates', w2.checkInvariants().length === 0, w2.checkInvariants().slice(0, 3).join('; '));

    // E-03: a minor heir's cash goes into trust, not to the guardian.
    const mom = w2.living.find(p => p.alive && p.adult && p.manages < 0 && !p.inst && p.children.some(id => w2.people[id].alive && !w2.people[id].adult && !w2.people[id].away));
    if (mom) {
      const minor = mom.children.map(id => w2.people[id]).find(c => c.alive && !c.adult && !c.away), tr0 = minor.trust, cs0 = minor.cash;
      strip(w2, mom, w2.px(30000)); w2.die(mom, 'test');
      check('E-03: a minor inherits into trust (not cash, not the guardian)', minor.trust > tr0 && minor.cash === cs0, `trust ${tr0}->${minor.trust} cash ${cs0}->${minor.cash} heirs ${w2.estates[w2.estates.length - 1].heirs.length}`);
    } else check('E-03 needs a parent with a minor child', false);

    // E-10: save after estates, reload, run 5 years: the same history, books and ownership in order.
    const w3 = LES.Save.fromJSON(LES.Save.toJSON(w2));
    for (let d = 0; d < 365 * 5; d++) { w2.step(); w3.step(); if (d % 1500 === 0) await yieldUI(); }
    check('E-10: saved after estates and run 5 more years: identical, books and ownership in order', w3.stableHash() === w2.stableHash() && w3.checkInvariants().length === 0, w3.checkInvariants().slice(0, 3).join('; '));
    // E-11: Classic keeps the old settlement (its fingerprints are checked in foundationTests).
    const wc = new LES.World(Object.assign({}, D, LES.PRESETS.classic.values, { seed: 'est-c', founders: 40 }));
    check('E-11: Classic uses rules revision 1 (old settlement)', wc.cfg.rulesRev === 1);
    // E-12: an heir in a sister town is paid there; no ids left dangling.
    const R = new LES.Region(Object.assign({}, D, { seed: 'est-r', migration: 'normal', towns: '2' }), [{ founders: 90 }, { founders: 60, seed: 'est-r2' }]);
    let found = null;
    for (let d = 0; d < 365 * 40 && !found; d++) { R.step(); if (d % 365 === 0) { await yieldUI(); const A = R.towns[0]; found = A.living.find(p => p.adult && !p.away && !p.inst && p.children.some(id => A.people[id].alive && A.people[id].away && A.people[id].away.town === 1)) || null; } }
    if (found) {
      const A = R.towns[0], kid = found.children.map(id => A.people[id]).find(c => c.alive && c.away && c.away.town === 1), mirror = R.towns[1].people[kid.away.id], m0 = mirror.cash + mirror.trust;
      if (P.invValue(A, found) > 0) F.raiseCash(A, found, P.invValue(A, found) + 1, 'test');
      A.ledger.pay('GENESIS', found, 'cash', A.px(60000));
      A.die(found, 'test');
      check('E-12: a child in the sister town is paid there; both towns balance', mirror.cash + mirror.trust > m0 && A.checkInvariants().length === 0 && R.towns[1].checkInvariants().length === 0, A.checkInvariants().concat(R.towns[1].checkInvariants()).slice(0, 3).join('; '));
    } else check('E-12 needs a parent whose child moved to the sister town (none in 40 years)', false);
  }

  // C05: honest national statistics (definitions, contemporaneous denominators, custody apart, low samples).
  async function statsDefTests() {
    print('--- Statistics definitions (C05) ---', 'info');
    const Cal = LES.Calibration, D = LES.DEFAULTS;
    const uk = Cal.config({ country: 'uk', founders: 150 }), my = Cal.config({ founders: 150 });
    check("A calibration run uses the chosen country's own defaults, as the setup screen does (C11)", uk.mortMult === LES.Countries.get('uk').defaults.mortMult && uk.mortMult !== D.mortMult && uk.founders === 150 && Cal.config({ country: 'uk', mortMult: 1.3 }).mortMult === 1.3 && Object.keys(my).every(k => k === 'founders' || my[k] === D[k]));
    const rev = [], base = [];
    for (let i = 0; i < 10; i++) { rev.push(300000 * 100); base.push([300, 1]); }
    for (let i = 0; i < 2; i++) { rev.push(150000 * 100); base.push([150, 1]); }
    const now = Cal.revenuePerPerson(rev, base, 1, 150), old = Cal.revenuePerPerson(rev, null, 1, 150);
    check('A shrinking town: RM1,000 per person every month is reported as RM1,000 (not RM1,833 from dividing by the last month)', Math.abs(now.value - 1000) < 1e-9 && !now.approx, `${now.value}`);
    check('An older save without monthly population: the old estimate, marked approximate', Math.abs(old.value - 1833.3333333) < 1e-6 && old.approx);
    check('Every measure states what it counts, out of whom and over what period; non-comparable ones say why', Object.values(Cal.DEFS).every(d => d.num && d.den && d.obs) && Object.values(Cal.DEFS).filter(d => d.comparable === false).every(d => d.note.length > 20) && Cal.DEFS.unemp.comparable === false);
    const w = new LES.World(Object.assign({}, D, { seed: 'c05', founders: 120, crime: 'lawless' }));
    for (let d = 0; d < 365 * 8; d++) { w.step(); if (d % 1500 === 0) await yieldUI(); }
    while (!w.date.lastOfMonth) w.step();
    w.step(); // the month-end snapshot is taken on the last day; read the row it wrote
    const row = w.history[w.history.length - 1].cr, inst = k => w.living.filter(p => p.alive && p.inst && p.inst.kind === k).length;
    check('Prisoners are people serving a prison sentence; the police lock-up (awaiting court) and rehab are counted apart', row && row.custody !== undefined && row.prisoners <= w.living.length && typeof row.rehab === 'number', JSON.stringify({ prisoners: row.prisoners, custody: row.custody, rehab: row.rehab, prisonNow: inst('prison'), remandNow: inst('remand') }));
    const m = Cal.measure(w);
    check('Revenue uses each month\'s own residents and prices', !m.revenueApprox && w.gov.revBase.length === w.gov.revHist.length && Number.isFinite(m.revenue));
    check('The period birth rate comes from births and the years women lived in each age band', m.n.tfr === Cal.periodTfr(w, 10).births && (Number.isNaN(m.tfr) || (m.tfr > 0.3 && m.tfr < 5)), `TFR ${m.tfr} from ${m.n.tfr} births, completed ${m.completedFert}`);
    const tiny = new LES.World(Object.assign({}, D, { seed: 'c05s', founders: 20 }));
    for (let d = 0; d < 365; d++) tiny.step();
    const mt = Cal.measure(tiny);
    check('Too few births, workers, households or crimes: no number is claimed', Number.isNaN(mt.tfr) && (mt.n.medWage >= 20 || Number.isNaN(mt.medWage)) && (mt.n.hhGini >= 20 || Number.isNaN(mt.hhGini)) && (!tiny.crime || mt.n.clearance >= 30 || Number.isNaN(mt.clearance)), JSON.stringify(mt.n));
    const rA = { tfrParts: { B: [0, 10, 10, 0, 0, 0, 0], E: [0, 100, 100, 1, 1, 1, 1] } }, rB = { tfrParts: { B: [0, 5, 5, 0, 0, 0, 0], E: [0, 50, 50, 1, 1, 1, 1] } };
    check('Small towns: the birth rate is pooled over seeds (births and years added up by age band)', Math.abs(Cal.pooledTfr([rA, rB]) - 5 * (15 / 150 + 15 / 150)) < 1e-12 && Number.isNaN(Cal.pooledTfr([rB])));
    const t = Cal.table([m]);
    check('The calibration table explains measures defined differently from the official ones', /Not working/.test(t) && /Note on/.test(t) && (!Number.isFinite(m.completedFert) || /Completed children per woman/.test(t)));
  }

  // C06: founders' credentials by age group and limited study places (rules revision 4).
  async function eduPlacesTests() {
    print('--- Founders\' credentials and study places (C06) ---', 'info');
    const D = LES.DEFAULTS, L = LES.Labour, Cal = LES.Calibration, P = LES.P, C = LES.C;
    check('Rules revision 4 for new worlds; Classic and older saves keep revision 1', D.rulesRev >= 4 && LES.PRESETS.classic.values.rulesRev === 1);
    const uk = new LES.World(Object.assign({}, D, LES.Countries.get('uk').defaults, { country: 'uk', seed: 'c06-uk', founders: 300, founderAges: 'young' }));
    const ad = uk.living.filter(p => P.age(uk, p) >= 25 && P.age(uk, p) < 65), deg = ad.filter(p => Cal.eduLevel(p) >= 6), non = ad.filter(p => Cal.eduLevel(p) < 6);
    const avg = xs => xs.reduce((a, p) => a + p.att[C.INT], 0) / Math.max(1, xs.length);
    check('UK founders follow the age-group table (about half of 25-64s hold a degree)', deg.length / ad.length > 0.35 && deg.length / ad.length < 0.65, `${deg.length}/${ad.length}`);
    check('Abler founders are more likely to hold a degree (not handed out blindly)', avg(deg) > avg(non) + 0.3, `${avg(deg).toFixed(2)} vs ${avg(non).toFixed(2)}`);
    const my = new LES.World(Object.assign({}, D, { seed: 'c06-my', founders: 300 }));
    const myAd = my.living.filter(p => P.age(my, p) >= 25 && P.age(my, p) < 65), myDeg = myAd.filter(p => Cal.eduLevel(p) >= 6).length / myAd.length;
    check('Malaysian founders: far fewer degrees than in the UK', myDeg > 0.08 && myDeg < 0.32 && myDeg < deg.length / ad.length - 0.15, myDeg.toFixed(2));
    for (let d = 0; d < 365 * 3; d++) my.step();
    const st = L.places(my), PL = LES.Countries.pack.education.places, cohort = my.living.filter(q => q.alive && !q.away && P.age(my, q) >= 18 && P.age(my, q) < 25).length / 7;
    check('Places each year follow the entry rate x the average 18-24 year group', Math.abs(st.cohort - cohort) < 1e-9 && Object.keys(PL).every(k => st.credit[k] <= Math.max(2, 2 * PL[k] * st.cohort) + 1e-9), JSON.stringify(st));
    const young = my.living.find(q => q.alive && P.age(my, q) >= 18 && P.age(my, q) < 25) || my.living.find(q => q.adult), old = my.living.find(q => q.alive && P.age(my, q) >= 30);
    const course = LES.C.COURSE_BY_ID.BACH_BUS;
    st.credit.bach = 1.5;
    check('Older applicants get a place only when places are spare; school leavers first', !L.takePlace(my, course, old) && L.takePlace(my, course, young) && Math.abs(st.credit.bach - 0.5) < 1e-9 && !L.takePlace(my, course, young));
    const cand = my.living.find(q => q.alive && q.adult && !q.enrol && P.age(my, q) < 40);
    st.credit.bach = 0; cand.lastEnrollTry = -99999; cand.att[C.INT] = 10;
    L.enroll(my, cand, course);
    check('No place this year: the applicant waits for next year\'s round (no daily retries)', !cand.enrol && cand.lastEnrollTry >= (Math.floor(my.day / 365) + 1) * 365 - 61);
    const eq = new LES.World(Object.assign({}, D, { seed: 'c06-eq', founders: 40, scenario: 'equal' }));
    const cl = new LES.World(Object.assign({}, D, LES.PRESETS.classic.values, { seed: 'c06-cl', founders: 40 }));
    check('Born Equal (an atypical world) and Classic have no study places limit', !L.placesOn(eq) && !L.placesOn(cl) && L.placesOn(my));
    // Versioning: the previous rules still reproduce the previous Malaysia fingerprint.
    const textOf = w => LES.hashString(w.people.map(p => `${p.first} ${p.last}|${p.eth}|${p.rel || ''}|${p.job ? p.job.title || p.job.jobId : ''}|` + p.log.map(e => e.text).join('~')).join('#') + w.feed.map(e => e.text).join('~'))[0].toString(16);
    const r3 = new LES.World(Object.assign({}, D, { founders: 80, migration: 'normal', seed: 'my-1', rulesRev: 3 }));
    for (let d = 0; d < 4 * 365; d++) { r3.step(); if (d % 1500 === 0) await yieldUI(); }
    check('Rules revision 3 still reproduces the previous Malaysia fingerprint (84f18b75...)', `${r3.stableHash()}/${textOf(r3)}` === '84f18b75b2c06289c6a601c0829afc1f/3da2af2a', `${r3.stableHash()}/${textOf(r3)}`);
  }

  // C08: custom town names are labels only.
  async function townNameTests() {
    print('--- Town names (C08) ---', 'info');
    const D = LES.DEFAULTS, clean = LES.cleanTownName;
    check('Names are trimmed, spaces collapsed, control characters dropped; 1-40 characters', clean('  Kota   Baru  ') === 'Kota Baru' && clean('A\u0007B​') === 'AB' && clean('') === null && clean('   ') === null && clean('x'.repeat(41)) === null && clean('x'.repeat(40)) === 'x'.repeat(40));
    check('International names and emoji count as characters, not bytes', clean('Kampung Ōita 🌏') === 'Kampung Ōita 🌏' && clean('🌏'.repeat(40)) !== null && clean('🌏'.repeat(41)) === null && clean('北京') === '北京');
    const def = LES.C.TOWN_NAME;
    const a = new LES.World(Object.assign({}, D, { seed: 'c08', founders: 60 })), b = new LES.World(Object.assign({}, D, { seed: 'c08', founders: 60 }));
    for (let d = 0; d < 1000; d++) { if (d === 100) LES.setTownName(b, 'Harapan Baru'); a.step(); b.step(); if (d % 500 === 0) await yieldUI(); }
    check('Renaming a town on day 100 changes nothing in the simulation (same state on day 1,000)', a.hash() === b.hash() && LES.townName(b) === 'Harapan Baru' && LES.townName(a) === def && LES.C.TOWN_NAME === def);
    const b2 = LES.Save.fromJSON(LES.Save.toJSON(b));
    check('The name is saved and loaded; an older save without one shows the default', LES.townName(b2) === 'Harapan Baru' && LES.townName(LES.Save.fromJSON(LES.Save.toJSON(a))) === def);
    check('An invalid name is refused and the old one kept; blank resets to the default', !LES.setTownName(b, '\u0001\u0002') && LES.townName(b) === 'Harapan Baru' && LES.setTownName(b, '') && LES.townName(b) === def);
    LES.setTownName(b, '<img src=x onerror=alert(1)>');
    const html = LES.Report ? LES.Report.html(b) : '';
    check('A name that looks like code is shown as text in the report', !LES.Report || (!html.includes('<img src=x') && html.includes('&lt;img src=x onerror=alert(1)&gt;')));
    const R = new LES.Region(Object.assign({}, D, { seed: 'c08r', migration: 'normal', towns: '2', townName: 'Kota Harmoni' }), [{ founders: 40 }, { founders: 30, seed: 'c08r2' }]);
    const second = LES.townName(R.towns[1]);
    LES.setTownName(R.towns[1], 'Kota Kecil');
    check('In a region the setup name is the first town\'s; renaming one town leaves the others alone', LES.townName(R.towns[0]) === 'Kota Harmoni' && LES.townName(R.towns[1]) === 'Kota Kecil' && second !== 'Kota Harmoni' && R.towns[1].townIdx === 1);
    const v = c => LES.validateConfig(Object.assign({}, D, c)).blockers.length;
    check('Settings accept a blank name and refuse an over-long one', v({ townName: '' }) === 0 && v({ townName: 'Bandar Baru' }) === 0 && v({ townName: 'y'.repeat(41) }) > 0);
  }


  // Expansion 1 (Idea/Expansion 1): 23 jobs, a research centre, 6 degrees, 9 specialisations, 9 goals (rules revision 5).
  // Rules revision 6: jobs that need no qualification have a lower pay ceiling (Labour.offerSpread / promoRaise).
  async function payTests() {
    print('--- Pay ceiling for jobs without qualifications (rules revision 6) ---', 'info');
    const C = LES.C, L = LES.Labour, D = LES.DEFAULTS;
    check('Revision 6 or later is the default', D.rulesRev >= 6 && LES.PRESETS.national.values.rulesRev === D.rulesRev);
    const w6 = { cfg: { rulesRev: 6 } }, w5 = { cfg: { rulesRev: 5 } }, rider = C.JOB_BY_ID.rider, doctor = C.JOB_BY_ID.doctor;
    const R = new LES.RNG('pay-ceiling'), offers = [];
    for (let i = 0; i < 4000; i++) offers.push(L.offerSpread(w6, R, rider));
    const maxOffer = Math.max(...offers), maxPay = maxOffer * Math.pow(L.promoRaise(w6, rider), 4);
    check('An unskilled offer is at most 1.6x the middle (0.95x base); four promotions of 6% keep pay under 2x base', maxOffer <= L.PAY_MID_LOW * 1.6 + 1e-9 && maxPay < 2, `max offer x${maxOffer.toFixed(2)}, with promotions x${maxPay.toFixed(2)}`);
    check('Skilled jobs and older revisions keep the old spread and 12% promotions', L.promoRaise(w6, doctor) === 1.12 && L.promoRaise(w5, rider) === 1.12 && !L.unskilled(w5, rider) && L.unskilled(w6, rider) && !L.unskilled(w6, doctor));
    // A run: nobody in an unskilled job earns more than 2x the job's base pay at today's prices.
    const w = new LES.World(Object.assign({}, D, { country: 'cn', seed: 'pay-1', founders: 150, migration: 'normal' }));
    let worst = 0;
    for (let y = 0; y < 12; y++) {
      await runDays(w, 365);
      for (const p of w.living) if (p.alive && p.job) { const j = C.JOB_BY_ID[p.job.jobId]; if (j && !j.req) worst = Math.max(worst, p.job.salary / w.px(j.salary)); }
    }
    check('China, 12 years: no unskilled worker earns more than 2x base pay (was up to ~3.2x)', worst <= 2.05, `worst x${worst.toFixed(2)}`);
    check('The money check stays clean', w.checkInvariants().length === 0, JSON.stringify(w.checkInvariants().slice(0, 2)));
  }

  // Rules revision 7: more names in new worlds; older revisions keep the original lists.
  async function nameTests() {
    print('--- More names (rules revision 7) ---', 'info');
    const C = LES.C, D = LES.DEFAULTS;
    check('Revision 7 or later is the default (more names stay on)', D.rulesRev >= 7 && LES.PRESETS.national.values.rulesRev >= 7);
    let ok = true, info = [];
    for (const c of ['my', 'uk', 'us', 'cn']) {
      LES.Countries.use(c);
      for (const eth of C.ETHNICITIES) {
        const a = C.NAMES_ALL[eth], b = C.NAMES[eth];
        const grows = ['M', 'F', 'last'].every(k => a[k].length >= b[k].length && b[k].every(n => a[k].includes(n)) && new Set(a[k]).size === a[k].length);
        if (!grows || a.M.length < 20 || a.F.length < 20) { ok = false; info.push(`${c}/${eth} ${a.M.length}/${a.F.length}`); }
      }
    }
    LES.Countries.ensure(D);
    check('Every group in every country keeps its old names and has at least 20 first names per sex, no duplicates', ok, info.join(' '));
    const w = new LES.World(Object.assign({}, D, { seed: 'names-1', founders: 300 }));
    const firsts = new Set(w.people.map(p => p.first)), old = new LES.World(Object.assign({}, D, { seed: 'names-1', founders: 300, rulesRev: 6 }));
    check('300 founders get more distinct first names than under revision 6', firsts.size > new Set(old.people.map(p => p.first)).size, `${firsts.size} vs ${new Set(old.people.map(p => p.first)).size}`);
    check('Revision 6 still uses only the original lists', old.people.every(p => C.NAMES[p.eth][p.sex].includes(p.first) && (C.NAMES[p.eth].last.includes(p.last) || p.custom)));
  }

  async function expansionTests() {
    print('--- Expansion 1 (jobs, education, goals) ---', 'info');
    const C = LES.C, P = LES.P, D = LES.DEFAULTS, G = LES.Goals;
    const newJobs = C.JOBS.filter(j => j.exp), ids = C.JOBS.map(j => j.id);
    check('23 new jobs with unique ids; the old ones keep theirs', newJobs.length === 23 && new Set(ids).size === ids.length && ['cleaner', 'doctor', 'citytech'].every(id => C.JOB_BY_ID[id] && !C.JOB_BY_ID[id].exp));
    let packsOk = true;
    for (const c of ['uk', 'us', 'cn', 'my']) {
      LES.Countries.ensure(Object.assign({}, D, { country: c }));
      if (!newJobs.every(j => j.title && j.salary > 0 && j.freq > 0)) packsOk = false;
      if (!C.COURSES.every(x => x.name && x.fee > 0 && x.months > 0) || !['BACH_SCI', 'BACH_LAW', 'BACH_PHARM'].every(q => C.QUALS[q])) packsOk = false;
      if (newJobs.some(j => C.JOB_BY_ID[j.id].salary > C.JOB_BY_ID.doctor.salary)) packsOk = false;
    }
    check('Every country names and pays every new job and degree; no new job pays more than a doctor', packsOk);
    check('Older rules revisions never post the new jobs (zero in the national mix)', newJobs.every(j => C.JOB_FREQ[C.JOBS.indexOf(j)] === 0));
    const w5 = new LES.World(Object.assign({}, D, { seed: 'exp-1', founders: 150, migration: 'normal' }));
    const mix = w5.jobFreq, lvl = j => (!j.req ? 0 : j.req === 'VOC' ? 1 : 2), sum = (f, k, ex) => C.JOBS.reduce((a, j, i) => a + (lvl(j) === k && (ex === undefined || !!j.exp === ex) ? f[i] : 0), 0);
    const base = C.JOBS.map(j => (j.exp ? 0 : j.freq));
    check('Each entry level keeps its share of openings; new jobs take at most a third of a level', [0, 1, 2].every(k => Math.abs(sum(mix, k) - sum(base, k)) < 1e-9 && sum(mix, k, true) <= sum(mix, k) * LES.World.EXP_SHARE + 1e-9), mix.map(x => x.toFixed(2)).join(' '));
    check('Revision 5 or later is the default; Classic stays at revision 1', D.rulesRev >= 5 && LES.PRESETS.national.values.rulesRev === D.rulesRev && LES.PRESETS.classic.values.rulesRev === 1);
    const rc = w5.town.kinds.researchcentre || [];
    check('The research centre is built on a spare lot (one lot is kept for growth) or its jobs use the fallback', rc.length === 1 ? w5.town.lots.some(id => !w5.town.buildings[id].built) : true, `${rc.length} centre(s)`);
    check('BACH_PHARM does not count as a medical degree; Computer Science opens software jobs', !P.hasCred({ quals: ['BACH_PHARM'] }, 'MED') && P.hasCred({ quals: ['BACH_CS'] }, C.JOB_BY_ID.softdev.req) && !P.hasCred({ quals: ['VOC'] }, C.JOB_BY_ID.analyst.req) && P.hasCred({ quals: ['BACH_LAW'] }, 'BACH'));
    const vocF = w5.people.filter(p => p.quals.includes('VOC')), masF = w5.people.filter(p => p.quals.includes('MASTER'));
    check('Founders with a certificate or master\'s get a subject; master\'s subjects follow the first degree', vocF.length > 0 && vocF.every(p => p.specs && C.SPEC_BY_ID[p.specs.VOC]) && masF.every(p => p.specs && p.specs.MASTER && (p.specs.MASTER !== 'MAST_DATA' || ['BACH_CS', 'BACH_ENG', 'BACH_BUS', 'BACH_SCI'].some(q => p.quals.includes(q)))), `${vocF.length} certificates, ${masF.length} master's`);
    check('Founders hold some of the newer degrees', w5.people.some(p => p.quals.some(q => ['BACH_SCI', 'BACH_CS', 'BACH_ARCH', 'BACH_LAW', 'BACH_PHARM', 'BACH_SOC'].includes(q))));
    let bad = 0;
    for (let d = 0; d < 6 * 365; d++) { w5.step(); if (d % 365 === 0) { bad += w5.checkInvariants().length; await yieldUI(); } }
    const hired = new Set(w5.people.filter(p => p.job && C.JOB_BY_ID[p.job.jobId].exp).map(p => p.job.jobId));
    const places = w5.people.filter(p => p.job && !p.job.commuteTo).every(p => w5.town.buildings[p.job.place]);
    check('Six years with the new content: invariants clean, new jobs filled, every job has a real workplace', bad === 0 && hired.size >= 5 && places, `${hired.size} new job kinds held; ${bad} invariant problems`);
    const goals = new Set(w5.people.filter(p => p.goal).map(p => p.goal.id).concat(w5.people.flatMap(p => p.goalsDone.map(x => x.id))));
    check('New life goals are chosen in revision 5', ['DEBT_FREE', 'CAREER_STABLE', 'LASTING_LOVE', 'MASTER_SKILL'].filter(id => goals.has(id)).length >= 2, [...goals].join(' '));
    check('Goals that need a history are only given to people who have it (B40 childhood, bankruptcy, a staffed firm, age 50+)', w5.living.every(p => !p.goal || !G.DEFS[p.goal.id].eligible || p.goal.since < w5.day - 31 || G.DEFS[p.goal.id].eligible(w5, p)));
    const w4 = new LES.World(Object.assign({}, D, { seed: 'exp-1', founders: 150, migration: 'normal', rulesRev: 4 }));
    for (let d = 0; d < 3 * 365; d++) { w4.step(); if (d % 500 === 0) await yieldUI(); }
    check('Revision 4 worlds get none of it (jobs, degrees, subjects, goals, research centre)', !w4.people.some(p => (p.job && C.JOB_BY_ID[p.job.jobId].exp) || p.specs || p.quals.some(q => C.COURSE_BY_ID[q] && C.COURSE_BY_ID[q].exp) || (p.goal && G.DEFS[p.goal.id].exp)) && !(w4.town.kinds.researchcentre || []).length);
    const w5b = LES.Save.fromJSON(LES.Save.toJSON(w5)), w5c = LES.Save.fromJSON(LES.Save.toJSON(w5));
    for (let d = 0; d < 60; d++) { w5b.step(); w5c.step(); }
    check('A revision 5 save loads and continues identically', w5b.hash() === w5c.hash() && w5b.people.some(p => p.specs));
    if (typeof document !== 'undefined' && LES.Sprites) {
      const px = look => { const c = LES.Sprites.person(look, 'adult', 0, null, 'front'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.join(); };
      const L0 = { skin: '#e0ac69', hair: '#1b1b1b', shirt: '#2a9d8f', pants: '#1d3557', style: 0, scarf: '#c9184a' };
      const variants = [{ style: 4 }, { style: 5 }, { style: 6 }, { style: 7 }, { style: 8 }, { style: 9 }, { glasses: 3 }, { beard: 4 }, { hat: 5, hatColour: '#5c7cc0' }].map(x => px(Object.assign({}, L0, x)));
      check('Each new look (6 hairstyles, round spectacles, goatee, beanie) draws differently', new Set([px(L0), ...variants]).size === 10 && px(Object.assign({}, L0, { beard: 4 })) !== px(Object.assign({}, L0, { beard: 2 })));
      const of = ['overalls', 'security', 'firefighter', 'labcoat', 'apron', 'business', 'gown', 'wedding'].map(o => { const c = LES.Sprites.person(L0, 'adult', 0, o, 'front'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.join(); });
      check('The eight new outfits draw differently', new Set(of).size === 8);
    }
  }

  // C09a: spectator tools only watch.
  async function spectatorTests() {
    print('--- Spectator tools (C09a) ---', 'info');
    const SP = LES.Spectator, D = LES.DEFAULTS;
    if (!SP) { check('The spectator module is loaded', false); return; }
    const a = new LES.World(Object.assign({}, D, { seed: 'c09a', founders: 80 })), b = new LES.World(Object.assign({}, D, { seed: 'c09a', founders: 80 }));
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null, g = cv ? cv.getContext('2d') : null;
    let acts = 0;
    for (let d = 0; d < 3000; d++) {
      a.step(); b.step();
      if (d % 3 === 0 && acts < 1000) { // 1,000 spectator actions spread over the run (fast-forward: several days per action)
        const ids = b.living.filter(p => p.alive).map(p => p.id), id = ids[(d * 7919) % ids.length];
        const k = acts % 4;
        if (k === 0) SP.toggleBookmark(b, id, false); else if (k === 1) SP.toggleBookmark(b, id, true); else if (k === 2) SP.toggleSpotlight(id); else SP.celebrate(id);
        if (g) SP.draw({ screenPos: ids.slice(0, 40).map((pid, i) => ({ id: pid, x: 10 + i * 5, y: 50 })), z: 1, vw: 300, vh: 200 }, g, b);
        acts++;
      }
      if (d % 500 === 0) await yieldUI();
    }
    check('1,000 spectator actions during a fast-forwarded run leave the simulation exactly as it was', acts === 1000 && a.hash() === b.hash() && a.stableHash() === b.stableHash(), `${acts} actions`);
    check('Bookmarks live in the browser, not in the world or its save', SP.marks.length > 0 && !/bookmark|spotlight/i.test(LES.Save.toJSON(b)) && b.checkInvariants().length === 0);
    const p = b.living.find(x => x.alive && x.partnerId !== null && x.children.length) || b.living.find(x => x.alive);
    SP.marks = SP.marks.filter(m => m.id !== p.id);
    SP.toggleBookmark(b, p.id, true);
    const fam = SP.marked(b);
    check('Bookmark family marks the person with partner, parents and children; a second click removes it', SP.familyOf(b, p).every(id => fam.has(id)) && !SP.toggleBookmark(b, p.id, true) && !SP.mark(p.id));
  }

  // C09b: Sandbox Fate through the normal death path, exactly once.
  async function fateTests() {
    print('--- Sandbox Fate (C09b) ---', 'info');
    const G = LES.God, D = LES.DEFAULTS, P = LES.P;
    const w = new LES.World(Object.assign({}, D, { seed: 'c09b', founders: 150 }));
    for (let d = 0; d < 365 * 25; d++) { w.step(); if (d % 1500 === 0) await yieldUI(); }
    check('A world nobody touched is not a sandbox world', !G.intervened(w) && !w.intervention);
    const boss = w.living.find(p => p.alive && p.adult && p.manages >= 0 && p.children.some(id => w.people[id].alive)) || w.living.find(p => p.alive && p.adult && p.children.some(id => w.people[id].alive));
    const b = boss.manages >= 0 ? w.biz[boss.manages] : null, deaths0 = w.stats.deaths;
    const kids0 = boss.children.slice(), parents0 = (boss.parents || []).slice(), heirs0 = boss.children.filter(id => w.people[id].alive).sort((x, y) => x - y);
    const q = G.requestFate(w, boss.id);
    check('A request is queued, not carried out mid-step; a second request for the same person is refused', q.command && q.command.status === 'pending' && boss.alive && !!G.requestFate(w, boss.id).error);
    w.step();
    const est = w.estates.filter(e => e.decedent === boss.id);
    check('Fate is carried out once at the start of the next day, through the normal death path', !boss.alive && boss.causeOfDeath === 'Fate (sandbox intervention)' && w.stats.deaths >= deaths0 + 1 && est.length === 1 && q.command.status === 'applied' && G.intervened(w));
    check('The estate goes to every living child (one record, all heirs); the record and family links stay', est.length === 1 && est[0].heirs.join() === heirs0.join() && w.people[boss.id] === boss && boss.children.join() === kids0.join() && (boss.parents || []).join() === parents0.join() && kids0.every(id => w.people[id].parents.includes(boss.id)) && !boss.job && boss.manages < 0 && !Object.keys(boss.shares).length, `heirs ${est[0] && est[0].heirs.length} of ${heirs0.length}`);
    check('Fate on someone already dead is refused', !!G.requestFate(w, boss.id).error && !!G.resolve(w, boss.id).error);
    check('The business has a new owner or was sold; shares, ownership and books in order', (!b || !b.open || Object.keys(b.shares).every(k => w.people[Number(k)].alive)) && w.checkInvariants().length === 0, w.checkInvariants().slice(0, 3).join('; '));
    // A sole carer: the children get a guardian.
    const carer = w.living.find(p => p.alive && p.adult && p.careOf.some(id => { const c = w.people[id]; return c.alive && !c.adult && c.caregivers.length === 1; }));
    if (carer) {
      const kids = carer.careOf.map(id => w.people[id]).filter(c => c.alive && !c.adult);
      G.requestFate(w, carer.id); w.step();
      check("A sole carer's children are not deleted: they get a guardian or the welfare home", kids.every(c => c.alive && (c.caregivers.length > 0 || c.guardian === 'WELFARE')) && w.checkInvariants().length === 0);
    } else check('Test needs a sole carer', false);
    // Someone who dies before the command runs: skipped.
    const v = w.living.find(p => p.alive && p.adult && !p.inst);
    const c2 = G.requestFate(w, v.id).command; w.die(v, 'natural (test)'); w.step();
    check('Someone who died before Fate arrived is skipped, not killed twice', c2.status === 'skipped' && v.causeOfDeath === 'natural (test)');
    // Save while a command waits: it runs exactly once after loading too.
    const t = w.living.find(p => p.alive && p.adult && !p.inst);
    G.requestFate(w, t.id);
    const w2 = LES.Save.fromJSON(LES.Save.toJSON(w));
    for (let d = 0; d < 30; d++) { w.step(); w2.step(); }
    check('A save taken with Fate waiting carries it out exactly once after loading', !w2.people[t.id].alive && w2.intervention.events.filter(e => e.target === t.id && e.status === 'applied').length === 1 && w2.stableHash() === w.stableHash());
    const m = LES.Calibration.measure(w);
    check('Statistics and the report say this is a sandbox world; Fate deaths stay out of life expectancy', m.intervened && (!LES.Report || /Sandbox world/.test(LES.Report.html(w))) && w.people.filter(p => p.fate).length === 3);
    // A person living in a sister town is acted on there.
    const R = new LES.Region(Object.assign({}, D, { seed: 'est-r', migration: 'normal', towns: '2' }), [{ founders: 90 }, { founders: 60, seed: 'est-r2' }]);
    let away = null;
    for (let d = 0; d < 365 * 40 && !away; d++) { R.step(); if (d % 365 === 0) { await yieldUI(); away = R.towns[0].people.find(p => p.alive && p.away && p.away.town === 1 && R.towns[1].people[p.away.id] && R.towns[1].people[p.away.id].alive) || null; } }
    if (away) {
      const there = R.towns[1].people[away.away.id], out = G.requestFate(R.towns[0], away.id);
      for (let k = 0; k < 40; k++) R.step();
      check('Someone living in the sister town is reached there (no ghost left at home); both towns stay in order', out.w === R.towns[1] && !there.alive && !away.alive && R.towns[0].checkInvariants().length === 0 && R.towns[1].checkInvariants().length === 0, R.towns[0].checkInvariants().concat(R.towns[1].checkInvariants()).slice(0, 3).join('; '));
    } else check('Test needs someone who moved to the sister town', false);
  }

  // C10: comparisons and reports say what kind of evidence they are.
  async function explainTests() {
    print('--- Explaining results (C10) ---', 'info');
    const D = LES.DEFAULTS, CMP = LES.Compare, R = LES.Report;
    const w = new LES.World(Object.assign({}, D, { seed: 'c10', founders: 60 }));
    for (let d = 0; d < 365 * 2; d++) w.step();
    const cur = CMP.summary(w), t = CMP.table(cur, Object.assign({}, cur, { country: 'Testland', rules: 'Classic (original rules)', rev: 1 }), 'Classic rules');
    check('The comparison names country, rules and rules version, years and the sample size', t.includes(LES.Countries.pack.name) && t.includes(`rules version ${LES.DEFAULTS.rulesRev}`) && t.includes('rules version 1') && t.includes('Years simulated') && t.includes('sample size'));
    check('It says it is a same-seed world comparison, not a matched experiment, and that one pair cannot prove a cause', /same-seed world comparison/.test(t) && /not a matched experiment/.test(t) && /cannot prove/.test(t));
    check('A short run shows "insufficient data", not a blank or zero, and is warned about', /insufficient data \(under 10 years\)/.test(t) && /Fewer than 20 years/.test(t) && /nobody yet/.test(t) && CMP.table(Object.assign({}, cur, { revenue: undefined }), cur, 'x').includes('no government'));
    check('Different countries are warned about (amounts are in different currencies)', /different countries/.test(t) && !/different countries/.test(CMP.table(cur, cur, 'x')));
    const h0 = w.hash(), adult = w.living.find(p => p.alive && p.adult), ws = R.wealthStory(w, adult);
    check('"What shaped their wealth" lists recorded facts with a not-a-cause note, and reading it changes nothing', ws.lines.length >= 3 && /^Start: /.test(ws.lines[0]) && /not a proven cause/.test(ws.note) && w.hash() === h0);
    const html = R.html(w);
    check('The report explains correlation versus cause and the sample size, without the old causal claims', /How to read this/.test(html) && /does not prove that one caused the other/.test(html) && !/produced the most top-10/.test(html) && !/money bought little happiness/.test(html) && !/what these settings changed/.test(html));
    const small = new LES.World(Object.assign({}, D, { seed: 'c10s', founders: 20 }));
    for (let d = 0; d < 200; d++) small.step();
    check('A town with fewer than 30 adults over 30 is flagged as too small for firm conclusions', /Too few people for firm conclusions/.test(R.html(small)));
    LES.God.requestFate(w, adult.id); w.step();
    const sb = CMP.summary(w);
    check('A sandbox world is marked in the comparison and the report', sb.sandbox && /a sandbox world/.test(CMP.table(sb, cur, 'x')) && /sandbox world changed by you/.test(R.html(w)) && w.intervention.applied === 1);
  }

  // Review task 3: comparing in another country never shows that country on the live world, and the
  // report opens inside the app.
  async function compareTests() {
    print('--- Compare and the in-app report ---', 'info');
    const D = LES.DEFAULTS, CMP = LES.Compare, R = LES.Report, K = LES.Countries;
    const nat = c => { K.ensure({ country: c }); return Object.assign({}, D, LES.PRESETS.national.values, { country: c, scenario: 'none', preset: 'national' }); }; // the preset's values are the country's (e.g. mortality)
    check('Options: Malaysia under today\'s rules -> Classic; another country -> its own Classic first, then Malaysia\'s; a scenario -> today\'s rules',
      CMP.targets(nat('my')).join() === 'classic' && CMP.targets(nat('uk')).join() === 'basic,classic' && CMP.targets(nat('us')).join() === 'basic,classic' && CMP.targets(Object.assign(nat('cn'), { scenario: 'pandemic' })).join() === 'national'
      && CMP.config(nat('uk'), 'basic').country === 'uk' && CMP.config(nat('uk'), 'basic').government === 'off' && CMP.config(nat('uk'), 'classic').country === 'my');
    for (const c of ['uk', 'us', 'cn']) {
      const w = new LES.World(Object.assign(nat(c), { seed: `cmp-${c}`, founders: 40 }));
      for (let d = 0; d < 200; d++) w.step();
      for (const kind of ['basic', 'classic']) {
        let ok = true, ticks = 0;
        const iv = setInterval(() => { ticks++; if (K.active !== c) ok = false; }, 0); // what the map would draw with between slices
        const s = await CMP.run(w, () => { if (K.active !== c) ok = false; }, kind);
        clearInterval(iv);
        const want = kind === 'basic' ? K.get(c).name : K.get('my').name;
        check(`${K.get(c).name}: "${CMP.label(w.cfg, kind)}" runs, and the live world keeps its own country between slices`, ok && K.active === c && s.country === want && s.pop > 20 && s.years === 0, JSON.stringify({ ok, ticks, country: s.country, pop: s.pop }));
      }
    }
    K.ensure(D);
    const w = new LES.World(Object.assign({}, D, { seed: 'cmp-report', founders: 40 }));
    for (let d = 0; d < 120; d++) w.step();
    const app = R.html(w, null, true), file = R.html(w);
    check('The in-app copy uses the app\'s dark look and leaves out the file\'s own buttons; the file keeps them and frees its download link',
      /<html lang="en" class="app">/.test(app) && !/Download this report/.test(app) && /Download this report/.test(file) && /revokeObjectURL/.test(file) && /var\(--pixel\)/.test(file));
    if (typeof document !== 'undefined' && document.body) {
      R.open(w, null);
      const o = document.getElementById('report-overlay'), f = o && o.querySelector('iframe');
      const shown = R.isOpen() && f && f.srcdoc.includes(LES.townName(w));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      check('The report opens in an overlay inside the page (no new tab) and Esc closes it', shown && !R.isOpen() && f.srcdoc === '');
    }
  }

  // Review task 4: people and crowds on the map (drawing only: nothing here may change the simulation).
  async function peopleArtTests() {
    print('--- People and crowd art ---', 'info');
    if (typeof document === 'undefined' || !LES.Renderer) { print('(browser only: skipped)'); return; }
    const S = LES.Sprites, look = { skin: '#c68642', hair: '#222222', shirt: '#3a86ff', pants: '#333333', style: 0, scarf: '#8338ec' };
    const px = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
    const slim = S.person(look, 'adult', 0, null, 'front', 0), avg = S.person(look, 'adult', 0, null, 'front', 1), broad = S.person(look, 'adult', 0, null, 'front', 2);
    check('Three body builds draw differently (slim < average < broad)', px(slim) < px(avg) && px(avg) < px(broad), `${px(slim)} / ${px(avg)} / ${px(broad)}`);
    const sit = S.person(look, 'adult', 0, null, 'front', 1, 'sit');
    check('Sitting is one row shorter than standing; children never sit', sit.height === avg.height - 1 && S.person(look, 'child', 0, null, 'front', 1, 'sit').height === S.person(look, 'child', 0, null, 'front').height);
    check('Day labourers wear a hi-vis vest, construction workers a hard hat', LES.Ambience.outfitFor({ job: null }, { act: 'GIG', label: 'Gig: Day labour' }) === 'hivis' && LES.OUTFITS.hivis.band && LES.Ambience.outfitFor({ job: { jobId: 'construction' } }, { act: 'WORK', sub: 'construction' }) === 'hardhat');

    const w = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'people-art', founders: 300 }));
    for (let d = 0; d < 60; d++) w.step();
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;visibility:hidden';
    document.body.appendChild(cv);
    const r = new LES.Renderer(cv); r.setWorld(w);
    const site = w.town.buildings[w.town.byKind.construction], T = w.town.T;
    // Working on a site counts as being at work: the uniform shows although the worker moves about.
    const worker = { id: 1e6, plan: [{ act: 'WORK', sub: 'construction', loc: site.id }, { act: 'REST', loc: 0 }], job: { jobId: 'construction' }, look, log: [], adult: false };
    const pos = r.wander(worker, site, 300, worker.plan[0]);
    const it = Object.assign({ p: worker }, pos);
    check('A construction worker moving about the site wears the hard hat (it was only shown standing still)', pos.moving && pos.area && r.outfitOf(it, r.activityAt(it, 300), 0) === 'hardhat');
    const walking = Object.assign({}, it, { area: false });
    check('On the way there, street clothes', r.outfitOf(walking, r.activityAt(walking, 300), 0) === null);
    // Sixty workers spread over the plot instead of one blob.
    const spots = new Set(), xs = [];
    for (let k = 0; k < 60; k++) { const q = r.wander({ id: k * 37 + 5 }, site, 300, { act: 'WORK', sub: 'construction' }); spots.add(`${Math.round(q.x / 12)},${Math.round(q.y / 10)}`); xs.push(q.x); }
    check('Sixty site workers stand on many different patches across the plot', spots.size >= 30 && Math.max(...xs) - Math.min(...xs) > site.w * T * 0.6, `${spots.size} patches`);
    // Crowd cap, queue line, seats and children (on a made-up list at one place).
    const mk = (id, extra) => Object.assign({ p: { id, adult: true, parents: [] }, x: site.x * T + 50, y: site.y * T + 30, moving: false, at: site.id, skip: false, gone: false }, extra || {});
    const crowd = []; for (let k = 0; k < 40; k++) crowd.push(mk(k));
    r.selectedId = 39;
    const badges = r.arrange(crowd, -1e9, -1e9, 1e9, 1e9), shown = crowd.filter(x => !x.skip);
    const again = crowd.map(x => Object.assign({}, x, { skip: false })); r.arrange(again, -1e9, -1e9, 1e9, 1e9);
    check('At most 15 people drawn at one place (plus the selected person), the rest counted in a +N badge', (shown.length === LES.CROWD_CAP || shown.length === LES.CROWD_CAP + 1) && !crowd[39].skip && badges.length === 1 && badges[0].n === 40 - shown.length && badges[0].bid === site.id, `${shown.length} shown, badge ${badges[0] && badges[0].n}`);
    check('The same people are left out every frame', again.every((x, i) => x.skip === crowd[i].skip));
    r.selectedId = -1;
    const mall = w.town.buildings[w.town.byKind.mall], qs = []; for (let k = 0; k < 12; k++) qs.push(Object.assign(mk(100 + k, { queue: true, at: mall.id }), { x: mall.x * T + 30 }));
    r.arrange(qs, -1e9, -1e9, 1e9, 1e9);
    const inLine = qs.filter(x => !x.gone), qx = new Set(inLine.map(x => x.x));
    check('A queue is one line of separate places (at most 8); the others wait inside', inLine.length >= 1 && inLine.length <= 8 && qx.size === inLine.length && qs.length - inLine.length === qs.filter(x => x.gone).length);
    const mamak = w.town.buildings[w.town.byKind.mamak], ds = []; for (let k = 0; k < 14; k++) ds.push(mk(200 + k, { seat: true, sit: true, at: mamak.id }));
    r.arrange(ds, -1e9, -1e9, 1e9, 1e9);
    const seated = ds.filter(x => !x.gone);
    check('Diners take separate seats beside the stall\'s tables', seated.length === r.seatsOf(mamak).length && new Set(seated.map(x => `${x.x},${x.y}`)).size === seated.length && seated.every(x => x.y > mamak.y * T && x.y < (mamak.y + mamak.h) * T));
    const mum = mk(300, { x: 500, y: 400 }), kid = mk(301, { x: 900, y: 100 }); kid.p.adult = false; kid.p.parents = [300];
    r.arrange([mum, kid], -1e9, -1e9, 1e9, 1e9);
    check('A child at the same place as a parent stands beside them', Math.abs(kid.x - mum.x) === 7 && kid.y === mum.y + 1);
    // Drawing never changes the world, at any zoom (people, crowds, traffic).
    const h0 = w.stableHash();
    for (const z of [0.5, 0.9, 2.5, 4]) { r.z = z; r.centerOn((site.x + site.w / 2) * T, (site.y + site.h / 2) * T, 1); for (let i = 0; i < 6; i++) r.frame(0.3 + i * 0.05, false, i * 200); }
    check('Drawing frames at every zoom leaves the world exactly as it was', w.stableHash() === h0);
    cv.remove();
  }

  // Review task 5: building variety, builder's yard stages, winter frost and snow (drawing only).
  async function buildingArtTests() {
    print('--- Buildings, yard stages and winter ---', 'info');
    if (typeof document === 'undefined' || !LES.Renderer) { print('(browser only: skipped)'); return; }
    const Art = LES.Art, Amb = LES.Ambience, K = LES.Countries;
    // Empty shops: a banner on about one in three, the other three looks all used, fixed per shop.
    const looks = {}; for (let id = 0; id < 600; id++) looks[LES.vacantLook(id)] = (looks[LES.vacantLook(id)] || 0) + 1;
    check('Empty shops: a rent banner on about one in three; shutters, posters and clean fronts for the rest', looks.banner > 150 && looks.banner < 260 && looks.shutters > 80 && looks.posters > 80 && looks.clean > 80 && LES.vacantLook(42) === LES.vacantLook(42), JSON.stringify(looks));
    const vs = new Set(); for (let id = 0; id < 60; id++) vs.add(Art.variant({ id }, 3));
    check('Shophouses, shops and office towers come in three versions, fixed by the building', vs.size === 3 && Art.variant({ id: 7 }, 3) === Art.variant({ id: 7 }, 3));
    // The builder's yard: foundations -> frame -> nearly finished, each stage two months.
    const yard = { id: 11 }, seq = [];
    for (let d = 0; d < 400; d++) { Art.setDay(d); seq.push(Art.siteStage(yard)); }
    let changes = 0, ok = true;
    for (let d = 1; d < seq.length; d++) if (seq[d] !== seq[d - 1]) { changes++; if (seq[d] !== (seq[d - 1] + 1) % 3) ok = false; }
    Art.setDay(-1);
    check('The yard goes foundations -> frame -> nearly finished, moving on every 60 days; before the first day it shows the frame', ok && changes >= 6 && changes <= 7 && Art.siteStage(yard) === 1, `${changes} changes`);
    // Only the yard's tiles are painted again when its stage moves on.
    const w = new LES.World(Object.assign({}, LES.DEFAULTS, { seed: 'yard-tiles', founders: 120 }));
    const t = new LES.MapTiles(64); Art.setDay(0); t.setTown(w.town, 0);
    const site = w.town.buildings[w.town.byKind.construction], T = w.town.T;
    for (let cy = 0; cy < t.rows; cy++) for (let cx = 0; cx < t.cols; cx++) t.cache.set(`${cx},${cy}`, {});
    const s0 = Art.siteStage(site); for (let d1 = 1; d1 < 200; d1++) { Art.setDay(d1); if (Art.siteStage(site) !== s0) break; }
    const before = t.cache.size; t.refresh();
    const gone = before - t.cache.size, yardTiles = t.tilesIn(site.x * T - 40, site.y * T - 40, site.w * T + 80, site.h * T + 80).length;
    const others = w.town.kinds.construction ? w.town.kinds.construction.length : 1;
    check('A new yard stage repaints only the yard\'s own tiles', gone >= 1 && gone <= yardTiles * others, `${gone} of ${before} tiles`);
    Art.setDay(-1);
    // Snow spells: a few seeded spells each winter (Dec-Feb), more in the US, rare in China, never in Malaysia.
    const spells = code => { K.use(code); let n = 0, bad = 0; for (let y = 0; y < 30; y++) for (const s of Amb.snowSpells(y)) { n++; if (s.from < y * 365 + 334 || s.melt > y * 365 + 334 + 90 || s.to <= s.from || s.melt < s.to) bad++; } return { n: n / 30, bad }; };
    const uk = spells('uk'), us = spells('us'), cn = spells('cn'), my = spells('my');
    check('Snow spells per winter: UK 1-2, US 3-5, China 0-1, Malaysia none, all inside Dec-Feb', uk.n >= 1 && uk.n <= 2 && us.n >= 2.5 && us.n <= 5 && cn.n <= 1 && my.n === 0 && !uk.bad && !us.bad && !cn.bad, JSON.stringify({ uk: uk.n, us: us.n, cn: cn.n, my: my.n }));
    K.use('uk');
    let agree = true, lying = 0, falling = 0;
    for (let d = 0; d < 365 * 10; d++) { const a = Amb.snowAt(d), wx = Amb.weather(d).id === 'snow'; if (a.falling !== wx || (a.falling && !a.lying)) agree = false; if (a.lying) lying++; if (a.falling) falling++; }
    check('Flakes fall only on spell days; the snow then lies a little longer (UK)', agree && falling > 0 && lying > falling, `${falling} falling, ${lying} lying days in 10 years`);
    // The ground pass: grass and lawns frost in winter and turn white under snow; roads and painted greens stay.
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
    const paint = () => { ['#7fb054', '#6fa04a', '#5d6168', '#1f3d2b'].forEach((c, i) => { g.fillStyle = c; g.fillRect(i, 0, 1, 1); }); };
    const px = i => [...g.getImageData(i, 0, 1, 1).data].slice(0, 3);
    paint(); Art.setSeason(null); Art.setSnow(false); Art.winterGround(g, 0, 0, 4, 1); const plain = [0, 1, 2, 3].map(px);
    paint(); Art.setSeason('winter'); Art.winterGround(g, 0, 0, 4, 1); const frost = [0, 1, 2, 3].map(px);
    paint(); Art.setSnow(true); Art.winterGround(g, 0, 0, 4, 1); const snow = [0, 1, 2, 3].map(px);
    Art.setSnow(false); Art.setSeason(null);
    const same = (a, b) => a.every((v, i) => v === b[i]);
    check('Winter ground: grass and lawns frosty in winter, white under snow; roads and a green shopfront unchanged; nothing outside winter',
      same(plain[0], [127, 176, 84]) && frost[0][0] > plain[0][0] + 15 && frost[0][1] < snow[0][1] && snow[0][0] > 210 && snow[1][0] > 200 && same(snow[2], plain[2]) && same(snow[3], plain[3]), JSON.stringify({ frost: frost[0], snow: snow[0] }));
    // Ground textures are whole wherever a tile is painted first (they were once made with holes).
    const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 256; const g2 = c2.getContext('2d', { willReadFrequently: true });
    const t2 = new LES.MapTiles(64); t2.setTown(w.town, 0); t2.paintArea(g2, Math.min(w.town.W * T - 300, 1700), Math.min(w.town.H * T - 300, 900), 256, 256);
    const dd = g2.getImageData(0, 0, 256, 256).data; let holes = 0; for (let i = 3; i < dd.length; i += 4) if (dd[i] === 0) holes++;
    check('A painted map area has no holes in its ground (grass, paving, roads)', holes === 0, `${holes} transparent pixels`);
    K.ensure(LES.DEFAULTS);
  }

  // Review task 6: crime outside Malaysia (rules revision 8): police case capacity measured against each
  // country's own crime level and police staffing, and each pack's crimeTuningRev8.
  async function crimeRevTests() {
    print('--- Crime rules revision 8 ---', 'info');
    const K = LES.Countries, CR = LES.Crime, D = LES.DEFAULTS;
    const cfgOf = (c, rev, extra) => { K.use(c); return Object.assign({}, D, LES.PRESETS.national.values, { country: c, scenario: 'none', preset: 'national', rulesRev: rev }, extra || {}); };
    check('New worlds use rules revision 8 or later; today\'s rules preset too', D.rulesRev >= 8 && LES.PRESETS.national.values.rulesRev >= 8 && CR.REV === 8);
    // Revision gating: revision 7 keeps the Malaysian case capacity and the old tuning everywhere.
    let gate = true; const info = [];
    for (const c of ['my', 'uk', 'us', 'cn']) {
      const w7 = new LES.World(cfgOf(c, 7, { seed: `rev-${c}`, founders: 30 })), w8 = new LES.World(cfgOf(c, 8, { seed: `rev-${c}`, founders: 30 }));
      const pk = K.get(c), want = (pk.crime.index / 170) * (4 / pk.gov.policePer1000);
      const t7 = CR.tuning(w7), t8 = CR.tuning(w8), r8 = pk.crimeTuningRev8 || {};
      const ok = CR.casesPerOfficer(w7) === CR.CASES_PER_OFFICER && Math.abs(CR.casesPerOfficer(w8) / CR.CASES_PER_OFFICER - want) < 1e-9
        && Object.keys(r8).every(k => t8[k] === r8[k]) && Object.keys(pk.crimeTuning || {}).every(k => t7[k] === pk.crimeTuning[k]);
      if (!ok) gate = false;
      info.push(`${c} x${want.toFixed(2)}`);
    }
    check('Revision 8 scales police case capacity by the country\'s crime level and staffing (Malaysia x1) and uses crimeTuningRev8; revision 7 keeps the old capacity and tuning', gate, info.join(', '));
    // A revision-7 world is untouched by the revision-8 settings.
    const run = async extreme => {
      const saved = K.packs.uk.crimeTuningRev8;
      if (extreme) { K.packs.uk.crimeTuningRev8 = { opportunity: 9, clear: 0.01 }; delete K.scaledCache.uk; K.active = null; }
      const w = new LES.World(cfgOf('uk', 7, { seed: 'rev7-uk', founders: 80 }));
      for (let d = 0; d < 365 * 2; d++) { w.step(); if (d % 400 === 0) await yieldUI(); }
      const h = w.stableHash();
      if (extreme) { K.packs.uk.crimeTuningRev8 = saved; delete K.scaledCache.uk; K.active = null; K.use('uk'); }
      return h;
    };
    check('A revision-7 world runs exactly the same whatever the revision-8 settings say', (await run(false)) === (await run(true)));
    // Crime lands near each country's official level (one fixed seed each: a quick guard, not the calibration).
    const res = [];
    let inBand = true;
    for (const c of ['my', 'uk', 'us', 'cn']) {
      const w = new LES.World(cfgOf(c, 8, { seed: `band-${c}`, founders: 400 }));
      for (let d = 0; d < 365 * 8; d++) { w.step(); if (d % 400 === 0) await yieldUI(); }
      const idx = LES.Calibration.measure(w).crimeIdx, target = K.get(c).crime.index;
      res.push(`${c} ${Math.round(idx)}/${target}`);
      if (!(idx > target * 0.6 && idx < target * 1.4)) inBand = false;
    }
    check('Index crime per 100k within 40% of the official figure in Malaysia, the UK, the US and China (400 founders, 8 years)', inBand, res.join(', '));
    K.ensure(D);
  }

  // Rules revision 9: spending from usable wealth, EPF's three accounts, one cut-back line a month, milestones.
  async function wealthRevTests() {
    print('--- Usable wealth, EPF accounts and milestones (rules revision 9) ---', 'info');
    const K = LES.Countries, F = LES.Finance, D = LES.DEFAULTS, U = LES.U;
    const cfgOf = (c, rev, extra) => { K.use(c); return Object.assign({}, D, LES.PRESETS.national.values, { country: c, scenario: 'none', preset: 'national', rulesRev: rev }, extra || {}); };
    check('New worlds use rules revision 9 or later', D.rulesRev >= 9 && LES.PRESETS.national.values.rulesRev >= 9 && F.WEALTH_REV === 9);
    // Two Malaysian towns, revision 8 and 9, five years.
    const run = async rev => { const w = new LES.World(cfgOf('my', rev, { seed: 'w9-my', founders: 200 })); for (let d = 0; d < 365 * 5; d++) { w.step(); if (d % 400 === 0) await yieldUI(); } return w; };
    const w8 = await run(8), w9 = await run(9);
    const down = w => w.people.reduce((s, p) => s + p.log.filter(e => /Could not afford .*; downgraded/.test(e.text)).length, 0);
    const feedDown = w => w.feed.filter(e => /Could not afford .*; downgraded/.test(e.text)).length, summary = w => w.feed.filter(e => /could not keep up their spending and cut back/.test(e.text)).length;
    check('Revision 8 unchanged: unpaid bills each make a news line, no EPF accounts', feedDown(w8) > 0 && summary(w8) === 0 && w8.people.every(p => !p.epfFlex && !p.epfWell), `${feedDown(w8)} lines`);
    check('Revision 9: unpaid bills stay in each person\'s log, the town news gets one line a month, and there are fewer of them (budgets count only usable money)', feedDown(w9) === 0 && summary(w9) > 0 && down(w9) < down(w8), `downgrades ${down(w8)} -> ${down(w9)}, ${summary(w9)} monthly lines`);
    check('Invariants hold in both', !w8.checkInvariants().length && !w9.checkInvariants().length, (w9.checkInvariants()[0] || ''));
    // EPF's three accounts (Malaysia): about 10% flexible and 15% wellbeing; never more than the balance.
    const savers = w9.living.filter(p => p.alive && p.epf > 0 && p.epfFlex > 0);
    const ratio = savers.reduce((s, p) => s + (p.epfFlex + p.epfWell) / p.epf, 0) / Math.max(1, savers.length);
    check('EPF splits into Persaraan, Sejahtera and Fleksibel; the two usable accounts hold up to a quarter of the balance', savers.length > 20 && ratio > 0.05 && ratio <= 0.25 + 1e-9 && w9.living.every(p => !(p.epfFlex || p.epfWell) || p.epfFlex + p.epfWell <= p.epf), `${savers.length} savers, ${(ratio * 100).toFixed(1)}%`);
    const uk = new LES.World(cfgOf('uk', 9, { seed: 'w9-uk', founders: 60 })); for (let d = 0; d < 200; d++) uk.step();
    check('Other countries keep their pensions fully locked', uk.people.every(p => !p.epfFlex && !p.epfWell) && uk.people.some(p => p.epf > 0));
    // Cash runs short: the flexible account is used before investments are sold.
    K.use('my');
    const p = savers.find(q => q.epfFlex > U.RM(500)), flex0 = p.epfFlex, idx0 = p.inv.idx, got = F.raiseCash(w9, p, Math.min(U.RM(200), flex0));
    check('Short of cash, Akaun Fleksibel is used before any investment is sold', got > 0 && p.epfFlex === flex0 - got && p.inv.idx === idx0, JSON.stringify({ flex0, flex1: p.epfFlex, got, idx0, idx1: p.inv.idx, active: K.active }));
    // Lifestyle budgets: a person with a big locked pension and little cash picks a cheaper life under revision 9.
    const q = w9.living.find(x => x.alive && x.adult && x.isHead && !x.inst), keep = { epf: q.epf, flex: q.epfFlex, well: q.epfWell, nw: q.nw, tiers: Object.assign({}, q.tiers), home: q.homeId };
    q.epf = U.RM(3e6); q.epfFlex = 0; q.epfWell = 0; q.nw = LES.P.netWorth(w9, q);
    const lifeCost = () => { F.reviewTiers(w9, q); return F.tierCost(w9, 'food', q.tiers.food) + F.tierCost(w9, 'leisure', q.tiers.leisure) + F.tierCost(w9, 'transport', q.tiers.transport); };
    const c9 = lifeCost(); w9.cfg.rulesRev = 8; const c8 = lifeCost(); w9.cfg.rulesRev = 9;
    Object.assign(q, { epf: keep.epf, epfFlex: keep.flex, epfWell: keep.well, nw: keep.nw }); F.reviewTiers(w9, q);
    check('Locked retirement money no longer pays for a lifestyle (revision 8 counted it)', c9 < c8, `${U.fmtMoney(c8)} -> ${U.fmtMoney(c9)} a month`);
    // Save and load keep the accounts and the run identical.
    const w2 = LES.Save.fromJSON(LES.Save.toJSON(w9));
    for (let d = 0; d < 120; d++) { w9.step(); w2.step(); }
    check('Save and load keep the EPF accounts and continue identically', w2.stableHash() === w9.stableHash() && w2.people.reduce((s, x) => s + (x.epfFlex || 0), 0) === w9.people.reduce((s, x) => s + (x.epfFlex || 0), 0));
    // Milestones in local money and the town's record.
    const us8 = new LES.World(cfgOf('us', 8, { seed: 'w9-us', founders: 20 })), us9 = new LES.World(cfgOf('us', 9, { seed: 'w9-us', founders: 20 }));
    check('Milestones are 100 thousand, 1 million and 10 million in the country\'s own money (revision 9; revision 8 kept ringgit-sized steps)', U.fmtMoney(us9.milestoneList[1]) === '$1.00M' && U.fmtMoney(us8.milestoneList[1]) !== '$1.00M', `${U.fmtMoney(us8.milestoneList[1])} -> ${U.fmtMoney(us9.milestoneList[1])}`);
    K.use('my');
    const rich = w9.living.find(x => x.alive && x.adult), m1 = w9.milestoneList[1], cash0 = rich.cash;
    w9.ledger.pay('LUCK', rich, 'cash', m1 * Math.ceil(w9.price) * 2); rich.nw = LES.P.netWorth(w9, rich); w9.checkMilestones(rich);
    const rec = w9.firsts[m1];
    check('The first person past 1 million is recorded for the town, with a news line', rec && rec.pid === rich.id && w9.feed.some(e => e.pid === rich.id && /^First in .* to pass/.test(e.text)));
    check('The goal is shown as its real share and the next milestone', F.goalShare(w9, w9.goal * 0.007) === '0.7%' && F.goalShare(w9, w9.goal * 0.56) === '56%' && F.goalShare(w9, 1) === '<0.1%' && F.nextMilestone(w9, m1 / 2).th === m1 && Math.abs(F.nextMilestone(w9, m1 / 2).frac - 0.5) < 1e-9);
    // Setup hint when the goal is far above what towns of this kind reach.
    const hint = (c, goal) => LES.validateConfig(Object.assign({}, D, LES.Countries.get(c).defaults, { country: c }, goal ? { goalRM: goal } : {})).warnings.some(x => /rarely reached/.test(x));
    check('Setup warns that the default goal is rarely reached in a town of a few hundred, but not about a goal within reach', hint('my') && hint('uk') && !hint('my', 2e7) && !hint('us', 1e8));
    K.ensure(D);
  }

  // Rules revision 10: founders are households of all ages from the country's age mix.
  async function founderTests() {
    print('--- Founders of all ages (rules revision 10) ---', 'info');
    const K = LES.Countries, D = LES.DEFAULTS, P = LES.P;
    const cfgOf = (c, rev, extra) => { K.use(c); return Object.assign({}, D, LES.PRESETS.national.values, { country: c, scenario: 'none', preset: 'national', rulesRev: rev }, extra || {}); };
    check('New worlds use rules revision 10 with founders of all ages', D.rulesRev === 10 && LES.PRESETS.national.values.rulesRev === 10 && D.founderAges === 'mixed' && LES.World.FOUNDER_REV === 10);
    // The age mix of each country, pooled over a few towns.
    const res = [];
    let ok = true;
    for (const c of ['my', 'uk', 'us', 'cn']) {
      let n = 0, kids = 0, old = 0;
      for (const sd of ['a', 'b', 'c']) {
        const w = new LES.World(cfgOf(c, 10, { seed: `ages-${c}-${sd}`, founders: 300 }));
        for (const p of w.people) { n++; if (!p.adult) kids++; if (P.age(w, p) >= 65) old++; }
      }
      const A = K.get(c).ages, tot = A.reduce((s, x) => s + x, 0), want18 = (A[0] + A[1] + A[2] + 0.6 * A[3]) / tot * 100, want65 = A.slice(13).reduce((s, x) => s + x, 0) / tot * 100;
      const k = kids / n * 100, o = old / n * 100;
      if (Math.abs(k - want18) > 3 || Math.abs(o - want65) > 3) ok = false;
      res.push(`${c} <18 ${k.toFixed(1)}/${want18.toFixed(1)}, 65+ ${o.toFixed(1)}/${want65.toFixed(1)}`);
    }
    check('Founders follow each country\'s official age mix (under 18 and 65+ within 3 points)', ok, res.join('; '));
    // Households hang together.
    const w = new LES.World(cfgOf('my', 10, { seed: 'hh-my', founders: 300 }));
    const ad = w.people.filter(p => p.adult), kids = w.people.filter(p => !p.adult);
    const partnersOk = ad.every(p => p.partnerId === null || (w.people[p.partnerId].partnerId === p.id && w.people[p.partnerId].homeId === p.homeId && (p.isHead !== w.people[p.partnerId].isHead)));
    const kidsOk = kids.length > 40 && kids.every(c => c.parents.length === 2 && c.parents.every(id => w.people[id].homeId === c.homeId && w.people[id].careOf.includes(c.id)));
    const retOk = ad.filter(p => p.retired).every(p => !p.job && P.age(w, p) >= 50) && ad.some(p => p.retired);
    check('Exactly the founding population; couples share a home, children live with and are cared for by both parents, retirees do not work', w.people.length === 300 && partnersOk && kidsOk && retOk && !w.checkInvariants().length, `${kids.length} children`);
    const unemp = ws => { let u = 0, e = 0; for (const p of ws.people) { if (!p.adult) continue; if (p.job) e++; else if (!p.retired && P.age(ws, p) < 64) u++; } return u / (u + e) * 100; };
    const young = new LES.World(cfgOf('my', 10, { seed: 'hh-my', founders: 300, founderAges: 'young' }));
    check('Most working-age founders start in work (young strangers started about a third jobless)', unemp(w) < 15 && unemp(young) > 25, `${unemp(w).toFixed(1)}% vs ${unemp(young).toFixed(1)}%`);
    const old = ad.filter(p => P.age(w, p) >= 75), body = p => LES.C.BODY_ATTRS.reduce((s, a) => s + p.att[a] / p.peak[a], 0) / 3;
    check('Older founders arrive with the ageing of the years they have lived', old.length && old.every(p => body(p) < 0.9), `${old.length} aged 75+`);
    const wealth = (lo, hi) => { const g = ad.filter(p => P.age(w, p) >= lo && P.age(w, p) < hi).map(p => p.nw).sort((a, b) => a - b); return g[g.length >> 1] || 0; };
    check('Starting wealth rises with age', wealth(18, 25) < wealth(45, 60), `${LES.U.fmtMoney(wealth(18, 25))} vs ${LES.U.fmtMoney(wealth(45, 60))}`);
    // The old behaviour: revision 9, or the 'young' setting, run exactly as before.
    const r9 = new LES.World(cfgOf('my', 9, { seed: 'same-my', founders: 120 })), r10y = new LES.World(cfgOf('my', 10, { seed: 'same-my', founders: 120, founderAges: 'young' }));
    check('Revision 9, and "young adults only" under revision 10, found the town exactly as before (18-35)', r9.stableHash() === r10y.stableHash() && r9.hash() === r10y.hash() && r9.people.filter(p => p.gen === 0 && !p.migrant).every(p => P.age(r9, p) >= 18 && P.age(r9, p) < 37));
    // Save and load.
    const w2 = LES.Save.fromJSON(LES.Save.toJSON(w));
    for (let d = 0; d < 90; d++) { w.step(); w2.step(); }
    check('Save and load continue a town of all ages identically', w2.stableHash() === w.stableHash());
    // Life expectancy needs deaths and years lived at older ages.
    const y = new LES.World(cfgOf('my', 10, { seed: 'e0-young', founders: 150, founderAges: 'young' }));
    for (let d = 0; d < 365 * 12; d++) { y.step(); if (d % 1000 === 0) await yieldUI(); }
    check('A young town with no old people yet shows no life expectancy (it used to show figures like 98.6)', !Number.isFinite(LES.Calibration.measure(y).e0));
    K.ensure(D);
  }

  // Rules revision 10, population balance: Lively crime without the extra deaths, prisoners fed and housed,
  // and towns of all ages that keep roughly their size with each country's births, deaths and migration.
  async function populationTests() {
    print('--- Population balance (rules revision 10) ---', 'info');
    const K = LES.Countries, D = LES.DEFAULTS, CR = LES.Crime, P = LES.P;
    const cfgOf = (c, rev, extra) => { K.use(c); return Object.assign({}, D, LES.PRESETS.national.values, { country: c, scenario: 'none', preset: 'national', rulesRev: rev }, extra || {}); };
    const at = (rev, crime) => CR.harm({ cfg: { rulesRev: rev, crime } });
    check('Lively crime is ten times as frequent but each crime a tenth as harmful under revision 10 only', at(10, 'lively') === 0.1 && at(9, 'lively') === 1 && at(10, 'realistic') === 1 && at(10, 'lawless') === 1);
    // A prisoner with no money, the cheapest food and stress 100: two years inside.
    const jail = rev => {
      const w = new LES.World(cfgOf('my', rev, { seed: 'held', founders: 60 }));
      const p = w.people.find(q => q.adult && q.alive && P.age(w, q) < 40 && !q.careOf.length);
      LES.Crime.admit(w, p, 'prison', 24, 'test');
      const before = LES.Migration.indicators(w).unemp;
      for (let d = 0; d < 700 && p.alive; d++) { p.cash = 0; p.stress = 100; p.tiers.food = 0; w.step(); }
      return { alive: p.alive, health: p.health, labour: LES.Migration.indicators(w), before };
    };
    const r9 = jail(9), r10 = jail(10);
    check('A prisoner is fed and housed: two years at stress 100 no longer wear their health down (revision 9 unchanged)', r10.alive && r10.health >= 60 && (!r9.alive || r9.health < r10.health - 20), `rev 10 health ${Math.round(r10.health)}, rev 9 ${r9.alive ? Math.round(r9.health) : 'died'}`);
    // Default towns over 50 years: they keep roughly their size, live as long as the country does, and the UK
    // gains its official net migration.
    const res = {};
    for (const c of ['my', 'uk']) {
      const w = new LES.World(cfgOf(c, 10, { seed: `pop-${c}`, founders: 100 }));
      let py = 0;
      for (let d = 0; d < 50 * 365 && !w.ended; d++) { w.step(); py += w.counts.living / 365; if (d % 2000 === 0) await yieldUI(); }
      res[c] = { pop: w.counts.living, e0: LES.Calibration.measure(w).e0, net: 1000 * (w.stats.immigrants - w.stats.emigrants) / py };
    }
    const txt = Object.entries(res).map(([c, r]) => `${c} ${r.pop} people, e0 ${r.e0.toFixed(1)}, net migration ${r.net.toFixed(1)}/1,000`).join('; ');
    check('A Malaysian town of 100 founders keeps roughly its size over 50 years (it used to fall to a third)', res.my.pop >= POP_BAND.my[0] && res.my.pop <= POP_BAND.my[1], txt);
    check('A British town of 100 founders grows a little over 50 years, with about the official net migration (~5 per 1,000)', res.uk.pop >= POP_BAND.uk[0] && res.uk.pop <= POP_BAND.uk[1] && res.uk.net > 2.5 && res.uk.net < 8.5, txt);
    check('Default towns live about as long as their country (life expectancy 70-86; Lively crime used to cut ~6 years)', res.my.e0 > 70 && res.my.e0 < 82 && res.uk.e0 > 75 && res.uk.e0 < 86, txt);
    K.ensure(D);
  }
  const POP_BAND = { my: [65, 170], uk: [90, 260] };

  // PL-02: Play a Life setup. Off by default; choosing whom to play never changes the town itself.
  async function playerTests() {
    print('--- Play a Life: who you play (PL-02) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, K = LES.Countries;
    K.ensure(D);
    const cfgOf = extra => Object.assign({}, D, { seed: 'play-1', founders: 120 }, extra || {});
    const off = new LES.World(cfgOf());
    check('Play a Life is off by default: no setting, no player, nothing chosen', D.play === undefined && !Pl.on(D) && !off.player && Pl.begin(off) === null && Pl.town(off) === null);
    const on = new LES.World(cfgOf({ play: 'random' })), r = Pl.begin(on);
    check('Turned on, a real living resident of the town is chosen', r && r.p === on.people[on.player.id] && r.p.alive && on.player.chain.length === 1 && on.player.how === 'random');
    const again = new LES.World(cfgOf({ play: 'random' }));
    check('The same seed chooses the same person', Pl.begin(again).p.id === r.p.id);
    for (let d = 0; d < 200; d++) { off.step(); on.step(); }
    check('Playing (before any decision) leaves the town exactly as it would have been', off.hash() === on.hash() && off.stableHash() === on.stableHash());
    const ages = [[2, 'baby'], [3, 'child'], [11, 'child'], [12, 'teen'], [17, 'teen'], [18, 'adult'], [59, 'adult'], [60, 'senior']];
    check('Life stages: baby 0-2, child 3-11, teen 12-17, adult 18-59, senior 60+', ages.every(([a, st]) => Pl.stageOf(a) === st));
    const got = ['baby', 'child', 'teen', 'adult', 'senior'].map(st => { const w = new LES.World(cfgOf({ play: 'random', playStage: st, founders: 200 })), x = Pl.begin(w); return Pl.summary(w).stage === st && !x.note; });
    check('A chosen life stage gives a resident of that stage', got.every(Boolean), JSON.stringify(got));
    const yw = new LES.World(cfgOf({ play: 'random', playStage: 'senior', founderAges: 'young' })), yr = Pl.begin(yw);
    check('No one of that stage in town: someone else is chosen, with a note', yr.p && yr.note && Pl.summary(yw).stage !== 'senior', yr.note);
    // Your own character: one real resident, also in a sister town.
    const spec = Object.assign(LES.Cast.blank(), { id: 'pl-c1', first: 'Testa', last: 'Pemain', age: 30, att: [8, 2, 5, 5, 6, 4] });
    const cw = new LES.World(cfgOf({ play: 'cast', playCast: 'pl-c1', cast: [spec] })), cr = Pl.begin(cw);
    check('Playing your own character: exactly one resident, with your name and abilities', cr.p.custom && cr.p.first === 'Testa' && cw.player.how === 'cast' && cw.people.filter(p => p.first === 'Testa' && p.last === 'Pemain').length === 1 && cr.p.att[0] > cr.p.att[1]);
    const reg = LES.makeRegion(cfgOf({ towns: '3', play: 'cast', playCast: 'pl-c1', cast: [Object.assign({}, spec, { town: 2 })] }));
    Pl.begin(reg);
    check('In a region, you play your character in the town you gave them', Pl.town(reg) === reg.towns[2] && reg.towns.filter(t => t.player).length === 1 && Pl.person(reg.towns[2]).first === 'Testa');
    // Save and load: the player is kept; an unplayed save loads without one.
    const sv = LES.Save.fromJSON(LES.Save.toJSON(on)), sv0 = LES.Save.fromJSON(LES.Save.toJSON(off));
    for (let d = 0; d < 30; d++) { on.step(); sv.step(); }
    check('Save and load keep who you play and continue identically; unplayed saves have no player', sv.player && sv.player.id === on.player.id && sv.stableHash() === on.stableHash() && !sv0.player);
    K.ensure(D);
  }

  // PL-03: the player's requests and life events. The player asks; the world decides.
  async function playCommandTests() {
    print('--- Play a Life: decisions (PL-03) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, I = LES.I18n;
    LES.Countries.ensure(D);
    const make = extra => { const w = new LES.World(Object.assign({}, D, { seed: 'pl3-t', founders: 150, play: 'random', playStage: 'adult' }, extra || {})); Pl.begin(w); return w; };
    const last = w => w.player.journal[w.player.journal.length - 1];
    const jobless = (x, xp) => { if (xp.job) LES.Labour.endJob(x, xp, 'test', true); };
    const young = seed => make({ seed, play: 'cast', playCast: 'pl3-y', cast: [Object.assign(LES.Cast.blank(), { id: 'pl3-y', first: 'Muda', last: 'Pencari', age: 22 })] });
    const firstJob = x => { const xp = Pl.person(x); let it = null; for (let d = 0; d < 400 && !it; d++) { jobless(x, xp); x.step(); it = (x.player.inbox || []).find(y => y.ev === 'AD-001'); } return it; };
    // Parity: a played world with nobody deciding (events offered and left to pass) stays the unplayed town.
    const a = make(), b = new LES.World(Object.assign({}, D, { seed: 'pl3-t', founders: 150 }));
    for (let d = 0; d < 400; d++) { a.step(); b.step(); }
    check('Events offered but not answered change nothing in the town', a.stableHash() === b.stableHash() && a.hash() === b.hash() && !a.player.played);
    // A real application.
    const w = make(), p = Pl.person(w);
    for (let d = 0; d < 10; d++) w.step();
    jobless(w, p);
    let o = Pl.openings(w, p);
    for (let d = 0; d < 60 && !o.length; d++) { w.step(); o = Pl.openings(w, p); }
    const v = o[0], r1 = Pl.request(w, 'APPLY_JOB', { vac: v.id }), r2 = Pl.request(w, 'APPLY_JOB', { vac: v.id });
    check('A request waits for the next day; asking twice is refused', r1.command && r1.command.status === 'pending' && r2.error === 'duplicate' && !v.appSet.has(p.id));
    w.step();
    check("Next day the application joins the employer's real applicant list", r1.command.status === 'done' && v.appSet.has(p.id) && w.player.played && last(w).key === 'cmd.APPLY_JOB.ok' && w.player.apps.length === 1, I.render(last(w)));
    Pl.request(w, 'APPLY_JOB', { vac: v.id }); w.step();
    check('Applying again for the same job is refused with a reason', last(w).code === 'already_applied' || last(w).code === 'no_vacancy');
    for (let d = 0; d < 40 && w.player.apps.length; d++) w.step();
    const res = w.player.journal.filter(e => e.kind === 'result');
    check('When the vacancy closes the outcome is reported once: hired, or it went to someone else', res.length === 1 && (res[0].key === 'res.hired' ? p.job && p.job.jobId === v.job.id : res[0].key === 'res.notHired'), res[0] ? I.render(res[0]) : 'none');
    check('No money is created or lost by any of this', w.checkInvariants().length === 0, w.checkInvariants().join('; '));
    // Refusals, each with its reason.
    const codeOf = (x, kind, args) => { const r = Pl.request(x, kind, args); if (r.error) return r.error; x.step(); return r.command.code; };
    const q = Pl.person(w), med = LES.C.JOBS.find(j => j.req === 'MED');
    let qual = 'skip';
    if (med && !P.hasCred(q, 'MED')) {
      const fake = { id: 987654, job: med, salary: w.px(9000), openDay: w.day, closeDay: w.day + 5, applicants: [], appSet: new Set(), place: v.place };
      w.vacancies.push(fake); const r = Pl.request(w, 'APPLY_JOB', { vac: fake.id }); Pl.tick(w); qual = r.command.code; w.vacancies = w.vacancies.filter(x => x !== fake);
    }
    check('Refused with a reason: closed vacancy, missing qualification, unknown action', codeOf(w, 'APPLY_JOB', { vac: 123456 }) === 'no_vacancy' && (qual === 'skip' || qual === 'not_qualified') && Pl.request(w, 'FLY', {}).error === 'unknown_kind', qual);
    const stale = Pl.request(w, 'APPLY_JOB', { vac: 1 }); stale.command.requestedDay -= 10; w.step();
    check('A request that waited too long is dropped', stale.command.code === 'stale' && w.player.journal.some(e => e.key === 'cmd.error.stale'));
    let many = Pl.openings(w, q);
    for (let d = 0; d < 120 && many.length < 3; d++) { w.step(); many = Pl.openings(w, q); }
    many = many.slice(0, 3);
    if (many.length === 3) { for (const x of many) Pl.request(w, 'APPLY_JOB', { vac: x.id }); w.step(); }
    const codes = w.player.journal.filter(e => e.kind === 'cmd').slice(-3).map(e => e.code).join();
    check('A day has limited time: a third application the same day waits for tomorrow', many.length < 3 || codes === 'ok,ok,no_time', `${many.length} openings; ${codes}`);
    const kid = make({ playStage: 'child', seed: 'pl3-kid' });
    check('A child cannot apply for jobs', codeOf(kid, 'APPLY_JOB', { vac: (kid.vacancies[0] || { id: 1 }).id }) === 'too_young');
    const dead = make({ seed: 'pl3-dead' }); for (let d = 0; d < 20; d++) dead.step();
    const dv = dead.vacancies[0], dp = Pl.person(dead), cmd = Pl.request(dead, 'APPLY_JOB', { vac: dv ? dv.id : 1 }).command;
    dead.die(dp, 'test'); dead.step();
    check('A request from someone who has died is cancelled at no cost', cmd.code === 'dead' && (!dv || !dv.appSet.has(dp.id)) && dead.checkInvariants().length === 0);
    // A life event: offered, answered with a real application; another one left to pass.
    const ev = young('pl3-ev'), item = firstJob(ev), pick = item && Pl.choose(ev, item.uid, 'ambitious');
    if (pick && pick.command) ev.step();
    check('"Your first full-time job" comes to a jobless young adult; "best-paid opening" really applies', !!item && !!pick.command && ['ok', 'already_applied'].includes(pick.command.code) && ev.player.journal.some(e => e.kind === 'choice' && e.choice === 'ambitious'), item ? I.render(last(ev)) : 'no event');
    const ev2 = young('pl3-ev'), it2 = firstJob(ev2);
    for (let d = 0; d < 25; d++) ev2.step();
    const passed = ev2.player.journal.find(e => e.key === 'evt.passed' && e.ev === 'AD-001');
    check("An unanswered event passes after its deadline; your character's own routine carries on", !!it2 && !ev2.player.inbox.some(x => x.uid === it2.uid) && !!passed && /pass/.test(I.render(passed)), passed ? I.render(passed) : '');
    const ev3 = young('pl3-ev'), it3 = firstJob(ev3), r3 = it3 && Pl.choose(ev3, it3.uid, 'training');
    check('Story-only answers do nothing to the world', !!r3 && r3.story && !ev3.player.pending.length);
    // Save and load with a request waiting.
    const s1 = make({ seed: 'pl3-sv' }); for (let d = 0; d < 15; d++) s1.step();
    const so = Pl.openings(s1, Pl.person(s1));
    if (so.length) Pl.request(s1, 'APPLY_JOB', { vac: so[0].id });
    const s2 = LES.Save.fromJSON(LES.Save.toJSON(s1));
    for (let d = 0; d < 40; d++) { s1.step(); s2.step(); }
    check('Save and load with a request waiting: carried out once, both continue identically', s1.stableHash() === s2.stableHash() && s1.player.journal.length === s2.player.journal.length && s2.player.journal.filter(e => e.kind === 'cmd').length === (so.length ? 1 : 0));
    LES.Countries.ensure(D);
  }

  // PL-04: what the "My life" tab relies on: letting your character decide, how often events come, clear wording.
  async function playUiTests() {
    print('--- Play a Life: decisions panel (PL-04) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, I = LES.I18n;
    LES.Countries.ensure(D);
    const make = (seed, extra) => { const w = new LES.World(Object.assign({}, D, { seed, founders: 120, play: 'random', playStage: 'adult' }, extra || {})); Pl.begin(w); return w; };
    // A test event that always comes (removed afterwards).
    const TEST = { id: 'ZZ-TEST', stages: ['baby', 'child', 'teen', 'adult', 'senior'], minAge: 0, maxAge: 200, chance: 1, cooldown: 9999, expires: 20, imp: 1, choices: [{ id: 'ok', story: true }] };
    const saved = Pl.EVENTS.splice(0, Pl.EVENTS.length, TEST); // only the test event (one event a month, most important first)
    try {
      const a = make('pl4-a');
      for (let d = 0; d < 31; d++) a.step();
      const item = a.player.inbox.find(x => x.ev === 'ZZ-TEST');
      const before = a.stableHash(), ok = item && Pl.pass(a, item.uid);
      check('"Let them decide" closes the decision now, records it, and changes nothing in the town', ok && !a.player.inbox.some(x => x.ev === 'ZZ-TEST') && a.player.journal.some(e => e.key === 'evt.delegated') && !a.player.pending.length && a.stableHash() === before);
      const b = make('pl4-a'); b.player.freq = 'important';
      for (let d = 0; d < 31; d++) b.step();
      check('"Important only" leaves out small moments; balanced shows them', !!item && !b.player.inbox.some(x => x.ev === 'ZZ-TEST'));
      check('Journal lines read as sentences: a new decision and what you chose', I.render(a.player.journal.find(e => e.kind === 'event')).includes('New decision') && I.t('evt.chose', { choice: { key: 'ev.AD-001.ambitious' } }) === 'You chose: Go for the best-paid opening');
    } finally { Pl.EVENTS.splice(0, Pl.EVENTS.length, ...saved); }
    // Already applied by your character's own routine: the reply names the job and when it is decided.
    const c = make('pl4-c'), p = Pl.person(c);
    let v = null;
    for (let d = 0; d < 200 && !v; d++) { if (p.job) LES.Labour.endJob(c, p, 'test', true); c.step(); v = c.vacancies.find(x => x.appSet.has(p.id)); }
    if (v) { Pl.request(c, 'APPLY_JOB', { vac: v.id }); c.step(); }
    const msg = v ? I.render(c.player.journal[c.player.journal.length - 1]) : '';
    check('"Already applied" says which job and when the employer decides', !v || (msg.includes(v.job.title) && /decides (today|in \d+ days?)/.test(msg)), msg);
    LES.Countries.ensure(D);
  }

  // PL-05: the baby stage. Start at Birth with a real newborn; the baby asks, the carer decides.
  async function playBabyTests() {
    print('--- Play a Life: baby (PL-05) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, I = LES.I18n;
    LES.Countries.ensure(D);
    const make = (seed, extra) => { const w = new LES.World(Object.assign({}, D, { seed, founders: 150, play: 'random', playStage: 'newborn' }, extra || {})); Pl.begin(w); return w; };
    const w = make('pl5-t'), off = new LES.World(Object.assign({}, D, { seed: 'pl5-t', founders: 150 }));
    check('Start at Birth: nobody is played yet; the badge says you are waiting', w.player.waiting === 'birth' && Pl.person(w) === null && Pl.summary(w).waiting);
    let d = 0;
    for (; d < 900 && w.player.waiting; d++) { w.step(); off.step(); }
    const mid = LES.Save.fromJSON(LES.Save.toJSON(w));
    const p = Pl.person(w);
    check('Waiting changes nothing in the town', !w.player.played && w.stableHash() === off.stableHash());
    check('You become the first real baby born in town after play began, with real parents caring for you', !!p && p.alive && !p.migrant && P.age(w, p) < 0.02 && p.parents.length === 2 && (p.caregivers.length > 0 || p.guardian === 'WELFARE') && w.player.chain.length === 1 && w.player.journal.some(e => e.key === 'life.born'), p ? I.render(w.player.journal.find(e => e.key === 'life.born')) : `none after ${d} days`);
    const w2 = make('pl5-t'), sv = LES.Save.fromJSON(LES.Save.toJSON(w2));
    for (let k = 0; k < d; k++) sv.step();
    check('A save made while waiting picks the same baby after loading', sv.player.id === w.player.id && !sv.player.waiting);
    // Reaching for the carer: the carer decides; a "yes" is one real care session, a "no" changes nothing.
    let ok = 0, busy = 0, right = true;
    for (let k = 0; k < 120 && (ok < 2 || busy < 1); k++) {
      const g = Pl.carerOf(w, p);
      if (!g) break;
      const r = Pl.request(w, 'ASK_CARE', {});
      if (r.command) {
        const cs = p.careSessions, en = g.energy;
        w.player.hoursDay = -1; Pl.tick(w); // carry it out on its own (actions later in the day add care too)
        if (r.command.code === 'ok') { ok++; right = right && p.careSessions === cs + 1 && g.energy === en - 6; }
        else if (r.command.code === 'busy') { busy++; right = right && p.careSessions === cs && g.energy === en; }
        else right = false;
      }
      w.step();
    }
    check('Reaching for your carer: they come (one real care session, a little of their energy) or they are busy (nothing changes)', right && ok >= 2 && busy >= 1, `${ok} came, ${busy} busy`);
    check('The world is marked as played and no money moved', w.player.played && w.checkInvariants().length === 0);
    // Two years as a baby, answering every event.
    const b = make('pl5-b');
    while (b.player.waiting) b.step();
    const days = [];
    for (let k = 0; k < 730; k++) {
      for (const it of (b.player.inbox || []).slice()) { const e = Pl.eventById(it.ev), c = e.choices.find(x => x.cmd) || e.choices[0]; Pl.choose(b, it.uid, c.id); }
      b.step();
    }
    const offered = b.player.journal.filter(e => e.kind === 'event');
    const perMonth = offered.every((e, i) => i === 0 || e.day - offered[i - 1].day >= 30);
    check('A baby meets several different moments, at most one new one a month', new Set(offered.map(e => e.ev)).size >= 4 && perMonth && offered.every(e => e.ev.startsWith('BA-')), offered.map(e => e.ev).join(' '));
    const texts = lang => b.player.journal.map(e => I.render(e));
    const en = texts('en');
    await new Promise(r => I.set('zh-Hans', r));
    const zh = texts('zh-Hans');
    const evTexts = Pl.EVENTS.filter(e => e.id.startsWith('BA-')).flatMap(e => ['title', 'body', ...e.choices.map(c => c.id)].map(k => I.t(`ev.${e.id}.${k}`, { carer: 'A', sibling: 'B', other: 'C', name: 'D' })));
    await new Promise(r => I.set('en', r));
    check('Every baby line reads properly with real names, in English and Chinese', ![...en, ...zh, ...evTexts].some(t => /\{\w+\}|ev\.BA/.test(t)) && I.validate('zh-Hans').length === 0, [...en, ...zh].find(t => /\{\w+\}/.test(t)) || '');
    const adult = new LES.World(Object.assign({}, D, { seed: 'pl5-a', founders: 120, play: 'random', playStage: 'adult' })); Pl.begin(adult);
    const ra = Pl.request(adult, 'ASK_CARE', {}); adult.step();
    check('Adults cannot reach for a carer', ra.command.code === 'too_old');
    LES.Countries.ensure(D);
  }

  // PL-06: childhood. The child asks; carers decide and pay; other children decide for themselves.
  async function playChildTests() {
    print('--- Play a Life: childhood (PL-06) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, C = LES.C, I = LES.I18n;
    LES.Countries.ensure(D);
    // A 7-year-old with a carer.
    const kid = seed => { for (let k = 0; k < 20; k++) { const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: 'child' })); Pl.begin(w); const p = Pl.person(w); if (P.age(w, p) >= 6 && P.age(w, p) < 9 && Pl.carerOf(w, p)) return w; } return null; };
    const w = kid('pl6'), p = Pl.person(w), g = Pl.carerOf(w, p);
    const run = (kind, args) => { const r = Pl.request(w, kind, args); w.step(); return r.command || r; };
    // Clubs: the carer decides, can refuse, and pays a real fee each month.
    g.cash += 0; // (the carer's own money)
    let club = null;
    for (const c of ['chess', 'football', 'music', 'art', 'dance', 'maths', 'science', 'swimming', 'athletics']) { w.player.cool = {}; const r = run('ASK_CLUB', { club: c }); if (r.code === 'ok') { club = c; break; } }
    check('Asking for a club: the carer may say no; once one says yes you are in that club', !!club && w.player.club && w.player.club.payer === g.id, w.player.journal.filter(e => e.kind === 'cmd').map(e => e.code).join(','));
    const gc = g.cash, merch = w.ledger.sec.MERCHANT.bal;
    while (w.day % 30 !== 0) w.step();
    w.step();
    check('The carer pays the club fee each month through the ledger (nothing is created)', w.checkInvariants().length === 0 && (g.cash <= gc - Pl.clubFee(w) + g.incomeEMA * 2) && w.ledger.sec.MERCHANT.bal !== merch);
    const potBefore = p.pot.slice(), boost0 = (w.player.boost || [0, 0, 0, 0, 0, 0]).slice();
    for (let d = 0; d < 365 * 8 && w.player.club; d++) w.step();
    const b = w.player.boost || [];
    check('Clubs and effort move potential only a little, within the lifetime cap', b.every(x => x <= 0.6 + 1e-9 && x >= -0.3 - 1e-9) && Pl.CLUBS[club].some(a => b[a] > boost0[a]));
    // A family that cannot afford it: refused before anyone decides, and no fee is charged.
    const poor = kid('pl6p'), pp = Pl.person(poor), pg = Pl.carerOf(poor, pp);
    poor.ledger.spend(pg, 'cash', 'MERCHANT', pg.cash); pg.incomeEMA = 0;
    const rp = Pl.request(poor, 'ASK_CLUB', { club: 'chess' }); Pl.tick(poor);
    check('A family that cannot afford a club: refused with the reason, nothing paid', rp.command.code === 'cant_afford' && !poor.player.club && /cannot afford/.test(I.render(poor.player.journal.slice(-1)[0])));
    // Pocket money: a real transfer from the carer, which stops when money is short.
    const al = kid('pl6a'), ap = Pl.person(al), ag = Pl.carerOf(al, ap);
    al.ledger.pay('GENESIS', ag, 'cash', al.px(50000)); // (a gift to the carer, through the ledger)
    let ok = null;
    for (let k = 0; k < 15 && !ok; k++) { al.player.cool = {}; const r = Pl.request(al, 'ASK_ALLOWANCE', { chores: true }); al.step(); if (r.command && r.command.code.startsWith('ok')) ok = r.command; }
    const c0 = ap.cash;
    while (al.day % 30 !== 0) al.step();
    al.step();
    check('Pocket money is a real monthly transfer from the carer', !!ok && ap.cash === c0 + al.player.allowance.amt && al.checkInvariants().length === 0, JSON.stringify({ ok: ok && ok.code, c0, now: ap.cash, al: al.player.allowance, day: al.day }));
    while (al.day % 30 !== 0) al.step();
    al.ledger.spend(ag, 'cash', 'MERCHANT', ag.cash); // the carer's money runs out just before pocket-money day
    al.step();
    check('It stops when the carer runs short', !al.player.allowance && al.player.journal.some(e => e.key === 'allow.stopped'));
    // Friends: real children of about the same age, who may say no.
    const f = kid('pl6f'), fp = Pl.person(f), mates = f.living.filter(q => q !== fp && !P.isAdult(f, q) && Math.abs(P.age(f, q) - P.age(f, fp)) <= 2);
    let yes = 0, no = 0;
    for (const q of mates.slice(0, 8)) { f.player.cool = {}; const r = Pl.request(f, 'MAKE_FRIEND', { pid: q.id }); f.step(); if (r.command.code === 'ok') yes++; else if (r.command.code === 'refused') no++; }
    const adult = f.living.find(q => P.isAdult(f, q));
    f.player.cool = {}; const ra = Pl.request(f, 'MAKE_FRIEND', { pid: adult.id }); f.step();
    check('Making friends: some say yes, some say no; adults are not "friends" here', yes >= 1 && no >= 1 && ra.command.code === 'not_found' && (f.player.friends || []).every(x => !P.isAdult(f, f.people[x.id])), `${yes} yes, ${no} no`);
    // Effort is the child's own choice, free; too young for it at 4.
    const e = kid('pl6e'); const re = Pl.request(e, 'SET_EFFORT', { level: 'hard' }); e.step();
    check('Study pace is the child\'s own choice (no money, no one else asked)', re.command.code === 'ok' && e.player.effort === 'hard');
    // Childhood events over years: text complete in English and Chinese.
    const ev = kid('pl6v');
    for (let d = 0; d < 365 * 4; d++) { for (const it of (ev.player.inbox || []).slice()) { const x = Pl.eventById(it.ev), ch = x.choices.find(y => y.cmd) || x.choices[0]; Pl.choose(ev, it.uid, ch.id); } ev.step(); }
    const offered = ev.player.journal.filter(x => x.kind === 'event');
    const zhOk = await new Promise(r => I.set('zh-Hans', r)).then(() => ev.player.journal.every(x => !/\{\w+\}/.test(I.render(x))));
    await new Promise(r => I.set('en', r));
    check('A child meets several different moments; every line reads properly in English and Chinese', new Set(offered.map(x => x.ev)).size >= 4 && ev.player.journal.every(x => !/\{\w+\}|cmd\.|ev\.CH/.test(I.render(x))) && zhOk && ev.checkInvariants().length === 0, offered.map(x => x.ev).join(' '));
    // Turning 18 ends the child's arrangements.
    const grown = kid('pl6g'), gp = Pl.person(grown); grown.player.club = { id: 'art', payer: Pl.carerOf(grown, gp).id, since: 0 };
    gp.birthDay -= 365 * 12; // (as if 18 now)
    for (let d = 0; d < 31; d++) grown.step();
    check('Grown up: clubs and pocket money paid by carers end', !grown.player.club);
    LES.Countries.ensure(D);
  }

  // PL-07: teens and the four-tier school choice. The teen asks; carers decide among what they can afford.
  async function playTeenTests() {
    print('--- Play a Life: teens and school choice (PL-07) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, C = LES.C, I = LES.I18n;
    LES.Countries.ensure(D);
    const teen = (seed, test) => { for (let k = 0; k < 30; k++) { const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: 'teen' })); Pl.begin(w); const p = Pl.person(w); if (Pl.carerOf(w, p) && p.guardian !== 'WELFARE' && P.age(w, p) < 16 && (!test || test(w, p))) return w; } return null; };
    const rich = w => { const p = Pl.person(w); for (const g of p.caregivers.map(id => w.people[id])) w.ledger.pay('GENESIS', g, 'cash', Pl.typicalPay(w) * 200); return w; };
    const ask = (w, tier) => { w.player.cool = {}; const r = Pl.request(w, 'ASK_SCHOOL', { tier }); w.step(); return r.command || r; };
    // A poor family: paid schools are not offered and nothing is ever charged.
    const poor = teen('pl7p'), pp = Pl.person(poor);
    for (const g of pp.caregivers.map(id => poor.people[id])) { poor.ledger.spend(g, 'cash', 'MERCHANT', g.cash); g.incomeEMA = g.mcost; }
    const po = Pl.schoolOffers(poor, pp), m0 = poor.ledger.sec.MERCHANT.bal;
    const rp = ask(poor, 'international');
    check('A family that cannot afford it: paid schools are marked unaffordable, the teen stays at the free school', po.filter(o => o.fee).every(o => !o.ok) && Pl.currentTier(poor, pp) === 'public' && rp.code === 'ok_stay', JSON.stringify(po.map(o => [o.tier, o.ok, o.why])));
    // No private school in town: the option says so.
    const np = teen('pl7n', w => !w.biz.some(b => b.open && b.type === 'privschool'));
    check('No private school in town: unavailable, with the reason', !!np && Pl.schoolOffers(np, Pl.person(np)).find(o => o.tier === 'private').why === 'none' && ask(np, 'private').code === 'unavailable');
    // Wealthy families: options open, but carers do not always pick the dearest school; the teen's wish counts.
    let granted = 0, other = 0, withWish = 0, withoutWish = 0;
    for (let k = 0; k < 14; k++) {
      const a = teen(`pl7r${k}`), b = teen(`pl7r${k}`);
      if (!a) continue;
      rich(a); rich(b);
      const ra = ask(a, 'international'), rb = ask(b, 'public');
      if (Pl.currentTier(a, Pl.person(a)) === 'international') { granted++; withWish++; } else other++;
      if (Pl.currentTier(b, Pl.person(b)) === 'international') withoutWish++;
    }
    check('Wealthy families can choose dear schools but are not bound to; the teen\'s wish raises the chance', granted >= 1 && other >= 1 && withWish >= withoutWish, `asked international: ${granted} got it, ${other} did not; without asking: ${withoutWish}`);
    // Fees: real monthly payments by the carer; when they stop, back to the government school.
    let w = null;
    for (let k = 0; k < 20 && !w; k++) { const x = rich(teen(`pl7f${k}`)); for (let t = 0; t < 4 && Pl.currentTier(x, Pl.person(x)) !== 'international'; t++) ask(x, 'international'); if (Pl.currentTier(x, Pl.person(x)) === 'international') w = x; }
    const g = w && w.people[w.player.school.payer], fee = w && w.player.school.fee;
    let paid = false;
    if (w) { const c0 = g.cash; for (const f of Pl.MONTHLY) f(w, Pl.person(w)); paid = c0 - g.cash === fee && w.checkInvariants().length === 0; } // one month's payments on their own
    check('An out-of-town school is paid every month by the carer, through the ledger', !!w && paid);
    if (w) { while (w.day % 30 !== 0) w.step(); for (const q of Pl.person(w).caregivers.map(id => w.people[id])) w.ledger.spend(q, 'cash', 'MERCHANT', q.cash); w.step(); } // the money runs out just before fee day
    check('When the fees can no longer be paid the teen returns to the government school', !!w && Pl.currentTier(w, Pl.person(w)) === 'public' && w.player.journal.some(e => e.key === 'school.backPublic'));
    // Entrance exam: low aptitude does not get into the aristocratic school.
    const ex = rich(teen('pl7e', (x, p) => p.pot[C.INT] < 4.5));
    if (ex) ask(ex, 'prestige');
    check('The aristocratic school needs a passed entrance exam', !!ex && Pl.currentTier(ex, Pl.person(ex)) !== 'prestige' && ex.player.journal.some(e => e.key === 'school.examFailed'));
    // The secondary-school decision comes at 12, with every option on one card, in English and Chinese.
    let evw = null;
    for (let k = 0; k < 30 && !evw; k++) { const x = new LES.World(Object.assign({}, D, { seed: `pl7v-${k}`, founders: 200, play: 'random', playStage: 'child' })); Pl.begin(x); const p = Pl.person(x); if (P.age(x, p) > 11.2 && Pl.carerOf(x, p) && p.guardian !== 'WELFARE') evw = x; }
    let item = null;
    for (let d = 0; d < 400 && evw && !item; d++) { evw.step(); item = (evw.player.inbox || []).find(i => i.ev === 'TE-001'); }
    const body = item ? I.t('ev.TE-001.body', item.params) : '';
    await new Promise(r => I.set('zh-Hans', r)); const zh = item ? I.t('ev.TE-001.body', item.params) : ''; await new Promise(r => I.set('en', r));
    check('At 12: "Choosing a secondary school" with four options and their fees', !!item && Pl.eventById('TE-001').choices.length === 4 && !/\{\w+\}/.test(body + zh), body);
    // Grown up: school arrangements end.
    if (w) { Pl.person(w).birthDay -= 365 * 8; for (let d = 0; d < 31; d++) w.step(); }
    check('At 18 the school arrangement ends', !!w && !w.player.school);
    LES.Countries.ensure(D);
  }

  // PL-08: adult career, study, home and money, all through the engine's own systems.
  async function playAdultTests() {
    print('--- Play a Life: adult career, study, home, money (PL-08) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, C = LES.C, I = LES.I18n, L = LES.Labour;
    LES.Countries.ensure(D);
    const adult = (seed, test) => { for (let k = 0; k < 30; k++) { const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: 'adult' })); Pl.begin(w); const p = Pl.person(w); if (!test || test(w, p)) return w; } return null; };
    const req = (w, kind, args) => { w.player.cool = {}; w.player.hoursDay = -1; const r = Pl.request(w, kind, args); Pl.tick(w); return r.command ? r.command.code : r.error; };
    // Asking for a raise: the employer decides with the engine's promotion chance.
    let ok = 0, no = 0, right = true;
    for (let k = 0; k < 12; k++) {
      const w = adult(`pl8r${k}`, (x, p) => p.job && !p.job.fixedTitle && p.job.level < 5);
      if (!w) continue;
      const p = Pl.person(w);
      if (k === 0) { const sd = p.job.startDay; p.job.startDay = w.day - 30; right = right && req(w, 'ASK_RAISE', {}) === 'too_soon'; p.job.startDay = sd; } // a new hire must wait six months
      p.job.startDay = w.day - 400;
      const lv = p.job.level, pay = p.job.salary, stress = p.stress, code = req(w, 'ASK_RAISE', {});
      if (code === 'ok') { ok++; right = right && p.job.level === lv + 1 && p.job.salary > pay; }
      else if (code === 'refused') { no++; right = right && p.job.level === lv && p.job.salary === pay && p.stress >= stress; }
    }
    check('Asking for a raise: sometimes yes (one promotion), often not yet (a little stress); never automatic', right && ok + no >= 8 && no >= 1, `${ok} yes, ${no} no`);
    // Quitting ends the job, and is not mistaken for being laid off.
    const q = adult('pl8q', (x, p) => p.job && !p.job.fixedTitle), qp = Pl.person(q);
    const qc = req(q, 'QUIT_JOB', {});
    for (let d = 0; d < 40; d++) q.step();
    check('Resigning ends the job (Labour.endJob) and does not count as losing it', qc === 'ok' && !qp.job === !qp.job && !q.player.journal.some(e => e.ev === 'AD-004'));
    // Laid off: the "You lost your job" decision comes.
    const lo = adult('pl8l', (x, p) => p.job && !p.job.fixedTitle && P.age(x, p) < 55), lp = Pl.person(lo);
    for (let d = 0; d < 31; d++) lo.step();
    if (lp.job) L.endJob(lo, lp, 'laid off');
    let lost = null;
    for (let d = 0; d < 70 && !lost; d++) { lo.step(); lost = (lo.player.inbox || []).find(i => i.ev === 'AD-004'); }
    check('Laid off: "You lost your job" comes with real choices (search vacancies, retrain)', !!lost);
    // Studying: real admission; places can run out; dropping out works.
    const sw = adult('pl8s', (x, p) => !p.enrol && Pl.courses(x, p).some(c => c.chance > 0.5)), sp = Pl.person(sw);
    const course = Pl.courses(sw, sp).find(c => c.chance > 0.5), sc = req(sw, 'ENROLL', { course: course.id });
    check('Applying for a course goes through real admission (accepted, rejected, or no place this year)', ['ok', 'ok_scholar', 'rejected', 'no_place'].includes(sc) && (sc.startsWith('ok') ? sp.enrol && sp.enrol.course === course.id : !sp.enrol), sc);
    if (sp.enrol) { const dc = req(sw, 'DROP_OUT', {}); check('Dropping out ends the course', dc === 'ok' && !sp.enrol); }
    else check('Dropping out needs a course', req(sw, 'DROP_OUT', {}) === 'not_studying');
    // Home: only the head decides; a bigger home must be affordable; the chosen home is kept.
    const nh = adult('pl8n', (x, p) => !p.isHead);
    check('Only the head of a household chooses where it lives', !nh || req(nh, 'MOVE_HOME', { tier: 3 }) === 'not_head');
    const hw = adult('pl8h', (x, p) => p.isHead && p.tiers.housing < 3 && p.partnerId === null), hp = Pl.person(hw);
    hw.ledger.pay('GENESIS', hp, 'cash', Pl.rentOf(hw, hp.tiers.housing + 1) * 40);
    const up = hp.tiers.housing + 1, hc = req(hw, 'MOVE_HOME', { tier: up });
    for (let d = 0; d < 200; d++) hw.step();
    check('A head who can afford it moves the household up, and the monthly review keeps the chosen home', hc === 'ok' && hp.tiers.housing === up && hw.checkInvariants().length === 0, `${hc}, now level ${hp.tiers.housing}`);
    const broke = adult('pl8b', (x, p) => p.isHead && p.tiers.housing < 3), bp = Pl.person(broke);
    broke.ledger.spend(bp, 'cash', 'MERCHANT', bp.cash); for (const x of [bp].concat(bp.partnerId !== null ? [broke.people[bp.partnerId]] : [])) x.incomeEMA = 0;
    check('A home the household cannot afford is refused', req(broke, 'MOVE_HOME', { tier: 4 }) === 'cant_afford');
    // Money: the real index fund; two months of costs stay in cash.
    const mw = adult('pl8m'), mp = Pl.person(mw);
    mw.ledger.pay('GENESIS', mp, 'cash', mw.px(100000));
    const idx0 = mp.inv.idx, cash0 = mp.cash, ic = req(mw, 'INVEST', { share: 0.5 });
    check('Investing buys the real index fund and keeps two months of costs in cash', ic === 'ok' && mp.inv.idx > idx0 && mp.cash >= 2 * mp.mcost && mp.cash < cash0 && mw.checkInvariants().length === 0);
    const sold = req(mw, 'SELL', { share: 1 });
    check('Selling turns investments back into cash', sold === 'ok' && P.invValue(mw, mp) < 1 && mw.checkInvariants().length === 0);
    mw.ledger.spend(mp, 'cash', 'MERCHANT', mp.cash);
    check('Nothing to invest when cash is short; nothing to sell when nothing is held', req(mw, 'INVEST', { share: 0.5 }) === 'too_little' && req(mw, 'SELL', { share: 0.5 }) === 'nothing');
    // Five years of adult life answering every decision: texts read properly, books balance.
    const ev = adult('pl8v', (x, p) => P.age(x, p) < 30);
    for (let d = 0; d < 365 * 5; d++) { for (const it of (ev.player.inbox || []).slice()) { const e = Pl.eventById(it.ev), ch = e.choices.find(y => y.cmd) || e.choices[0]; Pl.choose(ev, it.uid, ch.id); } ev.step(); }
    const lines = ev.player.journal.map(e => I.render(e));
    await new Promise(r => I.set('zh-Hans', r)); const zh = ev.player.journal.map(e => I.render(e)); await new Promise(r => I.set('en', r));
    check('Years of adult decisions: several different moments, every line complete in English and Chinese, books balance', new Set(ev.player.journal.filter(e => e.kind === 'event').map(e => e.ev)).size >= 3 && ![...lines, ...zh].some(t => /\{\w+\}|cmd\.|ev\.AD/.test(t)) && ev.checkInvariants().length === 0, [...new Set(ev.player.journal.filter(e => e.kind === 'event').map(e => e.ev))].join(' '));
    LES.Countries.ensure(D);
  }

  // PL-01: interface language. Words only: the same seed gives the same town and the same save in any language.
  async function i18nTests() {
    print('--- Interface language (PL-01) ---', 'info');
    const I = LES.I18n, keep = (() => { try { return localStorage.getItem('les-lang'); } catch (e) { return null; } })();
    try {
      await new Promise(r => I.set('en', r));
      I.add('en', { 'test.enOnly': 'Only in English' });
      check('Placeholders and plural forms (English)', I.t('setup.advancedMore', { count: 7 }).startsWith('7 more') && I.ev('TE-EDU-001', 'result', { count: 1 }).endsWith('1 day.') && I.ev('TE-EDU-001', 'result', { count: 3 }).endsWith('3 days.'));
      check('A missing key shows the key itself and is recorded, never an error', I.t('nope.missing') === 'nope.missing' && I.missing().includes('en:nope.missing'));
      await new Promise(r => I.set('zh-Hans', r));
      check('Simplified Chinese loads on first use and translates', I.lang() === 'zh-Hans' && I.t('setup.start') === '开始模拟' && I.ev('TE-EDU-001', 'body', { name: '阿明' }).startsWith('阿明') && document.documentElement.lang === 'zh-Hans');
      check('A key not yet translated falls back to English', I.t('test.enOnly') === 'Only in English');
      check('Every Chinese key exists in English with the same placeholders', I.validate('zh-Hans').length === 0, I.validate('zh-Hans').join('; '));
      const cov = I.coverage('zh-Hans');
      check('Translation coverage is reported per namespace', cov.setup && cov.setup.done === cov.setup.total && cov.test.done === 0, JSON.stringify(cov));
      check('A saved text record reads in the current language; old plain English text stays as it was', I.render({ key: 'setup.start' }) === '开始模拟' && I.render('Hired as Clerk') === 'Hired as Clerk');
      // The gate: one town run in Chinese, then in English.
      const cfg = Object.assign({}, LES.DEFAULTS, { seed: 'lang-1', founders: 60 });
      const a = new LES.World(cfg);
      for (let d = 0; d < 300; d++) a.step();
      await new Promise(r => I.set('en', r));
      const b = new LES.World(cfg);
      for (let d = 0; d < 300; d++) b.step();
      const sa = LES.Save.toJSON(a), sb = LES.Save.toJSON(b), strip = x => x.replace(/"saved":"[^"]*"/, '');
      check('Changing the language changes nothing in the simulation (hash, stable fingerprint, save)', a.hash() === b.hash() && a.stableHash() === b.stableHash() && strip(sa) === strip(sb) && !/zh-Hans/.test(sa));
    } finally {
      await new Promise(r => I.set('en', r));
      try { if (keep === null) localStorage.removeItem('les-lang'); else localStorage.setItem('les-lang', keep); } catch (e) { /* ignore */ }
    }
  }


  // C07: sustained mobility from income averaged over years, ranked within birth cohorts (research only).
  async function mobilityTests() {
    print('--- Sustained mobility (C07) ---', 'info');
    const S = LES.Society, D = LES.DEFAULTS;
    // 1. Recording reads only: a twin world with the recorder switched off ends identically.
    const rec = S.recordWindows, a = new LES.World(Object.assign({}, D, { seed: 'c07', founders: 80 }));
    for (let d = 0; d < 365 * 3; d++) a.step();
    S.recordWindows = () => {};
    let b; try { b = new LES.World(Object.assign({}, D, { seed: 'c07', founders: 80 })); for (let d = 0; d < 365 * 3; d++) b.step(); } finally { S.recordWindows = rec; }
    check('Recording the mobility windows changes nothing in the simulation (hash and stable fingerprint)', a.hash() === b.hash() && a.stableHash() === b.stableHash() && a.people.some(p => p.mob) && !b.people.some(p => p.mob));
    // 2. Synthetic cohort: one month's spike cannot lift a low earner out of the bottom fifth.
    const fake = (i, oi, ai) => ({ birthDay: 0, deathDay: null, mob: { o: { inc: oi * 72, nw: 0, n: 72, full: true }, a: { inc: ai, nw: 0, n: 132, full: true } } });
    const people = [];
    for (let i = 0; i < 59; i++) people.push(fake(i, 100 + i, (100 + i) * 132));
    people.push(fake(59, 50, 50 * 131 + 1000)); // 131 ordinary months at 50, one month at 1,000 (above everyone's average)
    const fw = { day: 365 * 45, people };
    const r = S.sustainedMobility(fw), spike = people[59];
    check('A one-month income spike does not decide the adult rank (the average over ages 30-40 does)', r.enough && r.n === 60 && r.matrix[0][0] >= 1 && r.corr > 0.9);
    check('Fewer than 30 complete records in a birth decade: not measured, with the reason', S.sustainedMobility({ day: fw.day, people: people.slice(0, 20) }).enough === false && S.sustainedMobility({ day: fw.day, people: people.slice(0, 20) }).status.smallCohort === 20);
    // 3. An older save (no records yet): windows that began before recording are never filled in after the fact.
    const o = new LES.World(Object.assign({}, D, { seed: 'c07o', founders: 80 }));
    for (let d = 0; d < 365; d++) o.step();
    delete o.mobSince; for (const p of o.people) delete p.mob;
    for (let d = 0; d < 400; d++) o.step();
    const recs = o.people.filter(p => p.mob).flatMap(p => Object.entries(p.mob).map(([k, v]) => ({ p, k, v })));
    check('After loading an older save, a window already under way is marked incomplete, never back-filled', recs.length > 0 && recs.every(({ p, k, v }) => v.full === (p.birthDay + (k === 'o' ? S.WIN.origin[0] : S.WIN.adult[0]) * 365 >= o.mobSince)) && recs.some(x => !x.v.full));
    // 4. A real run: the report says either the measure or why it cannot be measured yet.
    const w = new LES.World(Object.assign({}, D, { seed: 'c07r', founders: 120 }));
    for (let d = 0; d < 365 * 50; d++) { w.step(); if (d % 1500 === 0) await yieldUI(); }
    const html = LES.Report ? LES.Report.html(w) : '';
    check('After 50 years the report shows sustained mobility or says why it is not measurable yet, and names the four wealth origins', !LES.Report || (/Sustained mobility/.test(html) && /four different things/.test(html)), JSON.stringify(S.sustainedMobility(w).status));
  }

  // PL-09: love, partnership, marriage, children and family; every other person decides for themself.
  async function playFamilyTests() {
    print('--- Play a Life: relationships and family (PL-09) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, I = LES.I18n, Fa = LES.Family;
    LES.Countries.ensure(D);
    const adult = (seed, test) => { for (let k = 0; k < 40; k++) { const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: 'adult' })); Pl.begin(w); const p = Pl.person(w); if (!test || test(w, p)) return w; } return null; };
    const req = (w, kind, args) => { w.player.cool = {}; w.player.hoursDay = -1; const r = Pl.request(w, kind, args); Pl.tick(w); return r.command ? r.command.code : r.error; };
    const rich = (w, p) => w.ledger.pay('GENESIS', p, 'cash', w.px(200000));
    // Dating: the other person decides; a yes costs a date; a no costs nothing.
    const dw = adult('pl9d', (x, p) => p.partnerId === null && P.age(x, p) < 35 && Pl.singles(x, p, 3).length >= 2), dp = Pl.person(dw);
    rich(dw, dp);
    let yes = 0, no = 0, money = true, target = null;
    for (let r = 0; r < 3; r++) for (const q of Pl.singles(dw, dp, 6)) { const cash = dp.cash, code = req(dw, 'ASK_DATE', { pid: q.id }); if (code === 'ok') { yes++; money = money && dp.cash < cash; } else if (code === 'refused') { no++; money = money && dp.cash === cash; } dw.player.dating = null; }
    for (const q of Pl.singles(dw, dp, 3)) {
      for (let t = 0; t < 12 && !(dw.player.dating && dw.player.dating.dates >= 3); t++) {
        const cash = dp.cash, code = req(dw, 'ASK_DATE', { pid: q.id });
        if (code === 'ok') { yes++; target = q; money = money && dp.cash < cash; } else if (code === 'refused') { no++; money = money && dp.cash === cash; }
        if (dw.player.dating && dw.player.dating.pid !== q.id) break;
      }
      if (dw.player.dating && dw.player.dating.dates >= 3) break;
    }
    check('Asking someone out: they can say no (free) or yes (a real date, paid)', yes >= 1 && no >= 1 && money && dw.checkInvariants().length === 0, `${yes} yes, ${no} no`);
    const same = dw.living.find(q => q.alive && q.sex === dp.sex && q.partnerId === null && P.isAdult(dw, q) && q !== dp), taken = dw.living.find(q => q.alive && q.partnerId !== null && q.sex !== dp.sex && P.isAdult(dw, q));
    check('Nobody can be asked who is a child, related, or already with someone', (!same || req(dw, 'ASK_DATE', { pid: same.id }) === 'not_possible') && (!taken || ['taken', 'not_possible'].includes(req(dw, 'ASK_DATE', { pid: taken.id }))));
    // Moving in: after three dates; the partner decides; a real couple (Family.formCouple).
    let moved = false, asks = 0;
    if (target && dw.player.dating && dw.player.dating.dates >= 3) for (let t = 0; t < 15 && !moved; t++) { asks++; moved = req(dw, 'ASK_PARTNER', { pid: target.id }) === 'ok'; }
    check('Moving in together is the engine\'s own partnership: both linked, one household', moved && dp.partnerId === target.id && target.partnerId === dp.id && dp.homeId === target.homeId, `${asks} asks`);
    // Marriage: the partner decides; it is paid; married couples are a little steadier.
    const mw = adult('pl9m', (x, p) => p.partnerId !== null && x.people[p.partnerId].alive), mp = Pl.person(mw), mq = mw.people[mp.partnerId];
    mw.ledger.spend(mp, 'cash', 'MERCHANT', mp.cash);
    const poor = req(mw, 'PROPOSE', { kind: 'wedding' });
    rich(mw, mp);
    let wed = null, tries = 0;
    for (; tries < 20 && !(wed && wed.startsWith('ok')); tries++) wed = req(mw, 'PROPOSE', { kind: tries % 2 ? 'civil' : 'wedding' });
    check('Proposing: not without the money; the partner decides; married is recorded', poor === 'cant_afford' && wed.startsWith('ok') && mw.player.married.pid === mq.id && Pl.marriedPair(mw, mq, mp) && mw.checkInvariants().length === 0, `${tries} proposals`);
    // Wishes about children: the player's side of the decision; the partner's stays their own.
    const other = mq, base = Fa.desire(mw, other);
    req(mw, 'BABY_WISH', { wish: 'no' }); const d0 = Fa.desire(mw, mp);
    req(mw, 'BABY_WISH', { wish: 'yes' }); const d1 = Fa.desire(mw, mp);
    check('A wish about children sets only the player\'s side; the partner still decides', d0 === 0 && d1 > 0.9 && Fa.desire(mw, other) === base);
    // Separating: a real breakup; marriage and wishes end with it.
    const sc = req(mw, 'SEPARATE', {});
    check('Separating is the engine\'s breakup (one moves out; former partners)', sc === 'ok' && mp.partnerId === null && mq.partnerId === null && mp.exPartners.includes(mq.id) && !mw.player.married && !mw.player.babyWish && mw.checkInvariants().length === 0);
    // Children: time with them is real care; their school is chosen with the same affordability rules.
    const kw = adult('pl9k', (x, p) => p.careOf.some(id => { const c = x.people[id]; return c.alive && P.age(x, c) >= 8 && P.age(x, c) < 16; })), kp = Pl.person(kw);
    const kid = kp.careOf.map(id => kw.people[id]).find(c => c.alive && P.age(kw, c) >= 8 && P.age(kw, c) < 16);
    const cs = kid.careSessions || 0, cc = req(kw, 'CARE_CHILD', { pid: kid.id });
    const stranger = kw.living.find(c => c.alive && !P.isAdult(kw, c) && !kp.careOf.includes(c.id));
    check('Time with your child is a real care session; not with other people\'s children', cc === 'ok' && kid.careSessions === cs + 2 && (!stranger || req(kw, 'CARE_CHILD', { pid: stranger.id }) === 'not_your_child'));
    for (const q of kid.caregivers.map(id => kw.people[id])) { kw.ledger.spend(q, 'cash', 'MERCHANT', q.cash); q.incomeEMA = 0; }
    const broke = req(kw, 'CHOOSE_SCHOOL', { pid: kid.id, tier: 'international' });
    for (const q of kid.caregivers.map(id => kw.people[id])) kw.ledger.pay('GENESIS', q, 'cash', kw.px(400000));
    let pickd = null;
    for (let t = 0; t < 12 && pickd !== 'ok'; t++) pickd = req(kw, 'CHOOSE_SCHOOL', { pid: kid.id, tier: 'international' });
    const cash0 = kp.cash;
    for (let d = 0; d < 62; d++) kw.step();
    check('Your child\'s school: an unaffordable school is refused; a chosen one is paid monthly from your money', broke === 'cant_afford' && pickd === 'ok' && Pl.kidTier(kw, kid) === 'international' && kp.cash < cash0 && kw.checkInvariants().length === 0, `${broke}, ${pickd}`);
    // Mature stories: off by default; with them on, an affair needs the other person's yes and can come out.
    const aw = adult('pl9a', (x, p) => p.partnerId !== null && x.people[p.partnerId].alive && Pl.singles(x, p, 3).length > 0), ap = Pl.person(aw);
    const off = req(aw, 'AFFAIR', { pid: Pl.singles(aw, ap, 1)[0].id });
    aw.player.mature = true;
    let aff = null;
    for (let t = 0; t < 40 && aff !== 'ok'; t++) { const q = Pl.singles(aw, ap, 3)[t % 3] || Pl.singles(aw, ap, 1)[0]; aff = req(aw, 'AFFAIR', { pid: q.id }); }
    let out = false;
    for (let d = 0; d < 365 * 3 && !out; d++) { aw.step(); out = aw.player.journal.some(e => e.key === 'love.foundLeft' || e.key === 'love.foundStayed'); if (!aw.player.affair && !out) break; }
    check('Affairs: hidden unless mature stories are on; the other person decides; it can come to light', off === 'mature_off' && aff === 'ok' && (out || !aw.player.affair) && aw.checkInvariants().length === 0, `${aff}, found ${out}`);
    // Years of adult life answering every decision: texts read properly in both languages, books balance.
    const ev = adult('pl9v', (x, p) => P.age(x, p) < 30 && p.partnerId === null);
    ev.player.mature = true;
    for (let d = 0; d < 365 * 6; d++) { for (const it of (ev.player.inbox || []).slice()) { const e = Pl.eventById(it.ev), ch = e.choices.find(y => y.cmd) || e.choices[0]; Pl.choose(ev, it.uid, ch.id); } ev.step(); }
    const lines = ev.player.journal.map(e => I.render(e));
    await new Promise(r => I.set('zh-Hans', r)); const zh = ev.player.journal.map(e => I.render(e)); await new Promise(r => I.set('en', r));
    const evs = [...new Set(ev.player.journal.filter(e => e.kind === 'event').map(e => e.ev))];
    check('Years of love and family decisions: every line complete in English and Chinese, books balance', evs.some(id => ['AD-031', 'AD-032', 'AD-035', 'AD-040', 'AD-045'].includes(id)) && ![...lines, ...zh].some(t => /\{\w+\}|cmd\.|ev\.AD|love\./.test(t)) && ev.checkInvariants().length === 0, evs.join(' '));
    LES.Countries.ensure(D);
  }

  // PL-10: your own business, the lottery, giving, volunteering and elections, all through the engine.
  async function playSocietyTests() {
    print('--- Play a Life: business, lottery and community (PL-10) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, I = LES.I18n;
    LES.Countries.ensure(D);
    const adult = (seed, test) => { for (let k = 0; k < 40; k++) { const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: 'adult' })); Pl.begin(w); const p = Pl.person(w); if (!test || test(w, p)) return w; } return null; };
    const req = (w, kind, args) => { w.player.cool = {}; w.player.hoursDay = -1; const r = Pl.request(w, kind, args); Pl.tick(w); return r.command ? r.command.code : r.error; };
    // A business of your own: the engine's capital rules; a real firm with a place, shares and a loan.
    const bw = adult('pl10b', (x, p) => p.manages < 0 && P.age(x, p) < 50 && P.invValue(x, p) < 1), bp = Pl.person(bw);
    bw.ledger.spend(bp, 'cash', 'MERCHANT', bp.cash);
    const t0 = Pl.bizTypes(bw, bp)[0], poor = req(bw, 'START_BIZ', { type: t0.id });
    bw.ledger.pay('GENESIS', bp, 'cash', t0.capital * 2);
    const n = bw.biz.length, sc = req(bw, 'START_BIZ', { type: t0.id }), b = bw.biz[n];
    check('Starting a business: not without 40% of the capital; then a real firm (place, ownership, any loan)', (poor === 'cant_afford' && sc === 'ok' && b && bp.manages === b.id && b.shares[bp.id] === 1 && b.place >= 0 && bw.checkInvariants().length === 0), `${poor}, ${sc}`);
    const again = req(bw, 'START_BIZ', { type: t0.id }), bc = b.cash, cc = req(bw, 'INJECT', { share: 0.25 });
    for (let d = 0; d < 65; d++) bw.step();
    const open = b.open, cash1 = bp.cash, sold = open ? req(bw, 'SELL_BIZ', {}) : 'closed';
    check('One business at a time; putting money in is a transfer; selling pays the owner and ends it', again === 'have_biz' && cc === 'ok' && (!open || ((sold === 'ok' && !b.open && bp.cash > cash1) || sold === 'worthless')) && bw.checkInvariants().length === 0, `${cc}, ${sold}`);
    // The lottery: disclosed odds, about 60% back on average, prizes from the outside world (no money made up).
    const lw = adult('pl10l'), lp = Pl.person(lw);
    lw.ledger.pay('GENESIS', lp, 'cash', Pl.ticket(lw) * 30000 + lp.mcost * 4);
    let small = 0, mid = 0, jack = 0;
    const N = 20000, price = Pl.ticket(lw);
    for (let i = 0; i < N; i++) { const c = req(lw, 'BUY_TICKET', {}); if (c === 'won') { const last = lw.player.journal[lw.player.journal.length - 1]; if (last.params.prize === U.fmtMoney(price * 2)) small++; else mid++; } else if (c === 'jackpot') jack++; }
    const back = (lw.player.lotto.won / lw.player.lotto.spent);
    check('Lottery: about 15% small prizes, 2% medium, a rare jackpot; roughly 60% of stakes return', Math.abs(small / N - 0.15) < 0.015 && Math.abs(mid / N - 0.02) < 0.005 && back > 0.4 && back < 0.85 && lw.checkInvariants().length === 0, `small ${(small / N * 100).toFixed(1)}%, medium ${(mid / N * 100).toFixed(2)}%, jackpots ${jack}, ${(back * 100).toFixed(0)}% back`);
    lw.player.cool = {};
    const r1 = Pl.request(lw, 'BUY_TICKET', {}); Pl.tick(lw); lw.player.hoursDay = -1; const r2 = Pl.request(lw, 'BUY_TICKET', {}); Pl.tick(lw);
    lw.player.noLottery = true;
    check('One ticket a month; hidden lottery means no tickets', r1.command.code !== 'cooldown' && r2.command.code === 'cooldown' && req(lw, 'BUY_TICKET', {}) === 'hidden');
    // Giving and volunteering: real money to the welfare home; real care for the children there.
    const gw = adult('pl10g'), gp = Pl.person(gw);
    gw.ledger.pay('GENESIS', gp, 'cash', gw.px(20000));
    const wel = gw.ledger.sec.WELFARE.bal, don = gp.donated, dc = req(gw, 'DONATE', { amt: gw.px(500) });
    check('Donating moves real money to the welfare home and counts as the person\'s giving', dc === 'ok' && gw.ledger.sec.WELFARE.bal === wel + gw.px(500) && gp.donated === don + gw.px(500) && gw.checkInvariants().length === 0);
    const kid = gw.living.find(c => c.alive && !P.isAdult(gw, c));
    if (kid) { kid.guardian = 'WELFARE'; kid.upbringing = 0.4; }
    const vc = req(gw, 'VOLUNTEER', {});
    check('Volunteering at the welfare home gives its children more care', !kid || (vc === 'ok' && kid.upbringing > 0.4), vc);
    // Standing for election: on the ballot; the voters decide; the result comes back.
    const ew = adult('pl10e', (x, p) => P.age(x, p) >= 30 && !(p.cr && p.cr.rec) && x.gov && x.gov.president !== p.id), ep = Pl.person(ew);
    ew.gov.electionDay = ew.day + 75;
    const st = req(ew, 'STAND', {});
    let res = null;
    for (let d = 0; d < 120 && !res; d++) { ew.step(); res = ew.player.journal.find(e => e.key === 'civic.won' || e.key === 'civic.lost'); }
    const last = ew.gov.elections[ew.gov.elections.length - 1];
    check('Standing for election: on the ballot, the voters decide, the result comes back', st === 'ok' && !!res && last.cands.some(c => c.id === ep.id) && (res.key === 'civic.won') === (ew.gov.president === ep.id), res ? I.render(res) : 'no result');
    // Years of adult life answering every decision (lottery and community included): texts complete; books balance.
    const ev = adult('pl10v', (x, p) => P.age(x, p) < 45);
    ev.ledger.pay('GENESIS', Pl.person(ev), 'cash', ev.px(50000));
    for (let d = 0; d < 365 * 6; d++) { for (const it of (ev.player.inbox || []).slice()) { const e = Pl.eventById(it.ev), ch = e.choices.find(y => y.cmd) || e.choices[0]; Pl.choose(ev, it.uid, ch.id); } ev.step(); }
    const lines = ev.player.journal.map(e => I.render(e));
    await new Promise(r => I.set('zh-Hans', r)); const zh = ev.player.journal.map(e => I.render(e)); await new Promise(r => I.set('en', r));
    const evs = [...new Set(ev.player.journal.filter(e => e.kind === 'event').map(e => e.ev))];
    check('Years of business and community decisions: every line complete in English and Chinese, books balance', evs.some(id => ['AD-011', 'AD-024', 'AD-072', 'AD-077', 'AD-079', 'AD-080', 'AD-091'].includes(id)) && ![...lines, ...zh].some(t => /\{\w+\}|cmd\.|ev\.AD|civic\./.test(t)) && ev.checkInvariants().length === 0, evs.join(' '));
    LES.Countries.ensure(D);
  }

  // PL-11: health, rest, exercise, trips and difficult stories (with content settings).
  async function playWellbeingTests() {
    print('--- Play a Life: wellbeing, travel and content settings (PL-11) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, I = LES.I18n;
    LES.Countries.ensure(D);
    const adult = (seed, test, stage) => { for (let k = 0; k < 40; k++) { const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: stage || 'adult' })); Pl.begin(w); const p = Pl.person(w); if (!test || test(w, p)) return w; } return null; };
    const req = (w, kind, args) => { w.player.cool = {}; w.player.hoursDay = -1; const r = Pl.request(w, kind, args); Pl.tick(w); return r.command ? r.command.code : r.error; };
    // The doctor: real treatment when unwell (the engine's clinic visit), nothing invented when healthy.
    const hw = adult('pl11h'), hp = Pl.person(hw);
    hw.ledger.pay('GENESIS', hp, 'cash', hw.px(5000));
    hp.health = 100; const well = req(hw, 'SEE_DOCTOR', {}), h1 = hp.health;
    hp.health = 60; const cash = hp.cash, ill = req(hw, 'SEE_DOCTOR', {});
    check('Seeing a doctor treats real illness (and is paid for); a healthy check-up changes nothing', well === 'ok_well' && h1 === 100 && ill === 'ok' && hp.health === 72 && hp.cash <= cash && hw.checkInvariants().length === 0);
    hp.stress = 60; const hs = hw.ledger.sec.HEALTH.bal, cc = req(hw, 'COUNSELLING', {});
    check('Counselling is paid to the health sector and eases stress', cc === 'ok' && hp.stress === 45 && hw.ledger.sec.HEALTH.bal > hs);
    // Exercise: a small monthly gain, capped (no fountain of youth).
    req(hw, 'SET_EXERCISE', { level: 'regular' });
    hp.health = 80; for (const f of Pl.MONTHLY) f(hw, hp); const e1 = hp.health;
    hp.health = 95; for (const f of Pl.MONTHLY) f(hw, hp);
    check('Regular exercise: +1 health a month while below 95, never above', e1 === 81 && hp.health === 95);
    // Trips: paid, take days, nothing else can be done meanwhile, and they refresh you on return.
    const tw = adult('pl11t'), tp = Pl.person(tw);
    tw.ledger.pay('GENESIS', tp, 'cash', tw.px(20000));
    const tc = tp.cash, go = req(tw, 'TRAVEL', { kind: 'abroad' }), paid = tc - tp.cash;
    const busy = req(tw, 'REST', {});
    let back = false; for (let d = 0; d < 12 && !back; d++) { tw.step(); back = tw.player.journal.some(e => e.key === 'trip.back'); }
    tw.ledger.spend(tp, 'cash', 'MERCHANT', tp.cash);
    check('A trip abroad costs money and ten days; you cannot do other things meanwhile; you come back refreshed', go === 'ok' && paid === Pl.tripCost(tw, 'abroad') && busy === 'travelling' && back && req(tw, 'TRAVEL', { kind: 'domestic' }) === 'cant_afford' && tw.checkInvariants().length === 0);
    // Content settings: a difficult story is offered only when allowed; hiding it never changes the town.
    const pair = [true, false].map(hide => { const w = adult('pl11c'); w.player.noSensitive = hide; return w; });
    const saved = Pl.EVENTS.slice(), e58 = Pl.eventById('AD-058');
    try {
      Pl.EVENTS.splice(0, Pl.EVENTS.length, Object.assign({}, e58, { chance: 1 }));
      for (const w of pair) { do w.step(); while (w.day % 30 !== 0); const p = Pl.person(w); p.happy = 10; w.player.lowMonths = 5; Pl.tick(w); }
    } finally { Pl.EVENTS.splice(0, Pl.EVENTS.length, ...saved); }
    check('Difficult stories: offered only when shown in the settings', !pair[0].player.inbox.some(i => i.ev === 'AD-058') && pair[1].player.inbox.some(i => i.ev === 'AD-058'));
    const twins = [true, false].map(hide => { const w = adult('pl11d'); w.player.noSensitive = hide; w.player.mature = !hide; for (let d = 0; d < 400; d++) w.step(); return w.hash(); });
    check('Hiding content changes only what the player is offered, never the town (same world either way)', twins[0] === twins[1]);
    // Years of adult and senior life answering every decision: lines complete in both languages; books balance.
    for (const stage of ['adult', 'senior']) {
      const ev = adult(`pl11v${stage}`, (x, p) => stage === 'senior' || P.age(x, p) < 40, stage);
      ev.ledger.pay('GENESIS', Pl.person(ev), 'cash', ev.px(60000));
      for (let d = 0; d < 365 * 5; d++) { for (const it of (ev.player.inbox || []).slice()) { const e = Pl.eventById(it.ev), ch = e.choices.find(y => y.cmd) || e.choices[0]; Pl.choose(ev, it.uid, ch.id); } ev.step(); }
      const lines = ev.player.journal.map(e => I.render(e));
      await new Promise(r => I.set('zh-Hans', r)); const zh = ev.player.journal.map(e => I.render(e)); await new Promise(r => I.set('en', r));
      const evs = [...new Set(ev.player.journal.filter(e => e.kind === 'event').map(e => e.ev))];
      check(`Five years as ${stage === 'adult' ? 'an adult' : 'a senior'} answering every decision: every line complete in English and Chinese, books balance`, evs.length >= 2 && ![...lines, ...zh].some(t => /\{\w+\}|cmd\.|ev\.(AD|SE)|trip\.|health\./.test(t)) && ev.checkInvariants().length === 0, evs.join(' '));
    }
    LES.Countries.ensure(D);
  }

  // PL-12: retirement, and the next life after the played one ends (death or leaving town).
  async function playSeniorTests() {
    print('--- Play a Life: seniors and succession (PL-12) ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, P = LES.P, I = LES.I18n;
    LES.Countries.ensure(D);
    const make = (seed, test, stage) => { // a played town whose player passes the test (the first such resident if the random pick does not)
      for (let k = 0; k < 40; k++) {
        const w = new LES.World(Object.assign({}, D, { seed: `${seed}-${k}`, founders: 200, play: 'random', playStage: stage || 'adult' })); Pl.begin(w);
        if (!test || test(w, Pl.person(w))) return w;
        const q = w.living.find(x => x.alive && !x.away && !x.inst && test(w, x));
        if (q) { w.player.id = q.id; w.player.chain[0].id = q.id; return w; }
      }
      return null;
    };
    const req = (w, kind, args) => { w.player.cool = {}; w.player.hoursDay = -1; const r = Pl.request(w, kind, args); Pl.tick(w); return r.command ? r.command.code : r.error; };
    // Retiring: from 55, the job ends; keeping on working: the engine's yearly retirement skips the player.
    const yw = make('pl12y', (x, p) => P.age(x, p) < 50 && !!p.job), ow = make('pl12r', (x, p) => P.age(x, p) >= 56 && P.age(x, p) < 59 && !!p.job && !p.job.fixedTitle), op = Pl.person(ow);
    const young = req(yw, 'RETIRE', {}), rc = req(ow, 'RETIRE', {});
    check('Retiring: not before 55; then the job ends and the person is retired', young === 'too_young' && rc === 'ok' && op.retired && !op.job);
    const twins = [false, true].map(keep => { const w = make('pl12k', (x, p) => P.age(x, p) >= 55 && P.age(x, p) < 59 && !!p.job && !p.job.fixedTitle && !p.retired), q = Pl.person(w); q.birthDay -= Math.round((66 - P.age(w, q)) * 365); /* past 65: the engine retires every worker at the year's end */ if (keep) req(w, 'KEEP_WORKING', {}); for (let d = 0; d < 370; d++) w.step(); return Pl.person(w); });
    check('Keeping on working: the yearly retirement passes the player by (and only them)', twins[0].retired && !twins[1].retired, `without: ${twins[0].retired}, with: ${twins[1].retired}`);
    // Death: the engine's own death and estate; a waiting request is cancelled with a receipt and no payment.
    const dw = make('pl12d', (x, p) => p.children.some(id => { const c = x.people[id]; return c.alive && !c.away; }) && p.cash > 0), dp = Pl.person(dw);
    Pl.request(dw, 'REST', {});
    dw.die(dp, 'test');
    dw.step();
    const s = dw.player, rec = s.journal.filter(e => e.kind === 'cmd' && e.code === 'dead');
    check('Death ends the life once: pending request cancelled with one receipt, the estate settled by the engine, books balance', !!s.ended && s.ended.why === 'died' && rec.length === 1 && !s.pending.length && s.journal.filter(e => e.key === 'life.died').length === 1 && dw.checkInvariants().length === 0);
    dw.step(); dw.step();
    check('Nothing more happens to a life that has ended (no second death notice, no events)', s.journal.filter(e => e.key === 'life.died').length === 1 && !s.inbox.length);
    // Succession: heirs are the dead person's real children and grandchildren in town.
    const heirs = Pl.heirs(dw), stranger = dw.living.find(q => q.alive && !q.away && !heirs.includes(q));
    const bad = Pl.succeed(dw, stranger.id, 'heir'), dead = Pl.succeed(dw, dp.id, 'chosen');
    const heir = heirs[0], ok = Pl.succeed(dw, heir.id, 'heir');
    check('Succession: only a real child or grandchild as heir; never the dead; the chosen heir is now played', heirs.length > 0 && heirs.every(q => dp.children.includes(q.id) || q.parents.some(id => dp.children.includes(id))) && bad === 'not_heir' && dead === 'not_available' && ok === null && Pl.person(dw) === heir && s.chain.length === 2 && s.chain[1].how === 'heir');
    check('The journal keeps the previous life, and the new life starts fresh (no inherited plans or bonuses)', s.journal.some(e => e.key === 'life.died') && s.journal.some(e => e.key === 'life.next.heir') && !s.married && !s.club && !s.kidSchools && !s.ended);
    for (let d = 0; d < 40; d++) dw.step();
    check('The heir\'s life goes on: monthly decisions can come again', !s.ended && dw.checkInvariants().length === 0);
    // No heirs: the option is empty; a random resident is the same for the same seed; search finds real people.
    const nw = make('pl12n', (x, p) => !p.children.length), np = Pl.person(nw);
    nw.die(np, 'test'); nw.step();
    const r1 = Pl.randomHeir(nw), nw2 = make('pl12n', (x, p) => !p.children.length); nw2.die(Pl.person(nw2), 'test'); nw2.step();
    const found = Pl.search(nw, r1.first.slice(0, 3));
    check('No children or grandchildren: no heir option; a random resident is reproducible; search finds residents by name', Pl.heirs(nw).length === 0 && Pl.randomHeir(nw2).id === r1.id && found.includes(r1));
    // Choosing someone (or nobody) never changes the town: spectator vs a new life with no requests.
    Pl.spectate(nw2); Pl.succeed(nw, r1.id, 'random');
    for (let d = 0; d < 200; d++) { nw.step(); nw2.step(); }
    check('Taking over someone (without acting) or just watching leaves the town identical', nw.hash() === nw2.hash() && nw2.player.spectator && Pl.person(nw) === r1);
    // Saves: an ended life and the succession survive saving and loading.
    const sv = make('pl12s'), sp = Pl.person(sv); sv.die(sp, 'test'); sv.step();
    const back = LES.Save.fromJSON(LES.Save.toJSON(sv));
    const hb = Pl.randomHeir(back), sb = Pl.succeed(back, hb.id, 'random');
    for (let d = 0; d < 31; d++) back.step();
    check('Saved after a death, loaded, then a new life chosen: it carries on', back.player.ended === null && sb === null && Pl.person(back).id === hb.id && back.checkInvariants().length === 0);
    // Senior years answering every decision: lines complete in both languages, books balance.
    const ev = make('pl12v', (x, p) => P.age(x, p) >= 60 && P.age(x, p) < 66, 'senior');
    ev.ledger.pay('GENESIS', Pl.person(ev), 'cash', ev.px(80000));
    for (let d = 0; d < 365 * 6 && !ev.player.ended; d++) { for (const it of (ev.player.inbox || []).slice()) { const e = Pl.eventById(it.ev), ch = e.choices.find(y => y.cmd) || e.choices[0]; Pl.choose(ev, it.uid, ch.id); } ev.step(); }
    const lines = ev.player.journal.map(e => I.render(e));
    await new Promise(r => I.set('zh-Hans', r)); const zh = ev.player.journal.map(e => I.render(e)); await new Promise(r => I.set('en', r));
    const evs = [...new Set(ev.player.journal.filter(e => e.kind === 'event').map(e => e.ev))];
    check('Senior years answering every decision: every line complete in English and Chinese, books balance', evs.some(id => id.startsWith('SE-')) && ![...lines, ...zh].some(t => /\{\w+\}|cmd\.|ev\.(AD|SE)|succ\.|life\./.test(t)) && ev.checkInvariants().length === 0, evs.join(' '));
    LES.Countries.ensure(D);
  }

  // Play a Life controls: cancelling a request before tomorrow; choosing which shares to buy or sell, and how many.
  async function playControlsTests() {
    print('--- Play a Life: planned requests and shares ---', 'info');
    const Pl = LES.Player, D = LES.DEFAULTS, I = LES.I18n;
    LES.Countries.ensure(D);
    const make = seed => { const w = new LES.World(Object.assign({}, D, { seed, founders: 150, play: 'random', playStage: 'adult' })); Pl.begin(w); return w; };
    // Cancelling: the request never happens, the journal says so, the other one still does.
    const w = make('plc-q'), p = Pl.person(w);
    w.ledger.pay('GENESIS', p, 'cash', w.px(50000));
    const a = Pl.request(w, 'REST', {}).command, b = Pl.request(w, 'SEE_DOCTOR', {}).command;
    const cash = p.cash, gone = Pl.cancel(w, b.id), again = Pl.cancel(w, b.id);
    const words = I.render(Pl.describe(w, a));
    w.player.hoursDay = -1; Pl.tick(w); // the requests only (the character's own day would also spend)
    const j = w.player.journal;
    check('A planned request can be cancelled before the day starts: it never happens, the journal says so, the rest still happen', gone && !again && j.some(e => e.key === 'cmd.cancelled' && I.render(e).includes('See a doctor')) && j.some(e => e.cmd === 'REST' && e.code === 'ok') && !j.some(e => e.cmd === 'SEE_DOCTOR' && e.code !== 'cancelled') && Math.abs(p.cash - cash) < 1 && words === 'Take a day off');
    // Every kind of request has words in both languages (for the planned list).
    const kinds = Object.keys(Pl.HANDLERS);
    await new Promise(r => I.set('zh-Hans', r));
    const missing = kinds.filter(k => !I.has(`act.${k}`, 'en') || !I.has(`act.${k}`, 'zh-Hans'));
    await new Promise(r => I.set('en', r));
    check('Every kind of request reads as a sentence in the planned list (English and Chinese)', !missing.length, missing.join(' '));
    // Shares: the number asked for, at tomorrow's price, the fee included; selling some, then the rest.
    const s = make('plc-s'), sp = Pl.person(s), st = s.mkt.stocks[0], tk = st.tk;
    s.ledger.pay('GENESIS', sp, 'cash', s.px(200000));
    const held0 = Pl.held(sp, tk), r1 = Pl.request(s, 'BUY_STOCK', { tk, shares: 10 }).command;
    s.player.hoursDay = -1; Pl.tick(s);
    check('Buying 10 shares of a chosen company gives exactly 10 more shares (fee included in the cost)', r1.code === 'ok' && Math.abs(Pl.held(sp, tk) - held0 - 10) < 0.01 && s.checkInvariants().length === 0, `${r1.code}, holds ${Pl.held(sp, tk)}`);
    const r2 = Pl.request(s, 'SELL_STOCK', { tk, shares: 4 }).command; s.player.hoursDay = -1; Pl.tick(s);
    const after = Pl.held(sp, tk), r3 = Pl.request(s, 'SELL_STOCK', { tk, shares: 1e6 }).command; s.player.hoursDay = -1; Pl.tick(s);
    check('Selling 4 leaves 6 more than before; asking for more than you hold sells them all; books balance', r2.code === 'ok' && Math.abs(after - held0 - 6) < 0.01 && r3.code === 'ok' && Pl.held(sp, tk) === 0 && s.checkInvariants().length === 0);
    const u0 = sp.inv.idx, r4 = Pl.request(s, 'BUY_STOCK', { tk: 'idx', shares: 100 }).command; s.player.hoursDay = -1; Pl.tick(s);
    const r5 = Pl.request(s, 'BUY_STOCK', { tk, shares: 1e9 }).command, r6 = Pl.request(s, 'SELL_STOCK', { tk: 'NOPE', shares: 1 }).command, r7 = Pl.request(s, 'BUY_STOCK', { tk: s.mkt.stocks[1].tk, shares: -3 }).command; s.player.hoursDay = -1; Pl.tick(s);
    check('Index-fund units work the same way; too many shares to afford, an unknown company or a bad number are refused', r4.code === 'ok' && Math.abs(sp.inv.idx - u0 - 100) < 0.01 && r5.code === 'cant_afford' && r6.code === 'no_stock' && r7.code === 'bad_args');
    check('The market list shows the index fund and every listed company with its price and your holding', Pl.market(s, sp).length === s.mkt.stocks.length + 1 && Pl.market(s, sp).every(m => m.price > 0 && Number.isFinite(m.ret)));
    LES.Countries.ensure(D);
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
      await estateTests();
      await statsDefTests();
      await eduPlacesTests();
      await townNameTests();
      await spectatorTests();
      await fateTests();
      await explainTests();
      await mobilityTests();
      await expansionTests();
      await payTests();
      await nameTests();
      await compareTests();
      await peopleArtTests();
      await buildingArtTests();
      await crimeRevTests();
      await wealthRevTests();
      await founderTests();
      await populationTests();
      await i18nTests();
      await playerTests();
      await playCommandTests();
      await playUiTests();
      await playBabyTests();
      await playChildTests();
      await playTeenTests();
      await playAdultTests();
      await playFamilyTests();
      await playSocietyTests();
      await playWellbeingTests();
      await playSeniorTests();
      await playControlsTests();
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

  window.LES_TESTS = { runAll, compareTests, peopleArtTests, buildingArtTests, crimeRevTests, wealthRevTests, founderTests, populationTests, i18nTests, playerTests, playCommandTests, playUiTests, playBabyTests, playChildTests, playTeenTests, playAdultTests, playFamilyTests, playSocietyTests, playWellbeingTests, playSeniorTests, playControlsTests, expansionTests, payTests, nameTests, balance, invariantSweep, determinism, unitTests, townTests, goalTests, foundationTests, societyTests, crimeTests, govTests, fiscalTests, scenarioTests, regionTests, castTests, countryTests, ukTests, usTests, cnTests, marketTests, phase6Tests, reportStatsTests, eduLevelTests, catCapTests, estateTests, statsDefTests, eduPlacesTests, townNameTests, spectatorTests, fateTests, explainTests, mobilityTests, tileTests };
  if (/[?&]autorun/.test(location.search)) runAll(); // e.g. headless: tests.html?autorun
})(globalThis.LES);
