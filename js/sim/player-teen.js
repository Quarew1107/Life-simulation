// Play a Life, teens (PL-07, ages 12-17): choosing a secondary school, exams, plans for after school.
// The four-tier school choice (design 06, section 2): the teen asks; the carers decide among what they can
// really afford, and the town's real schools set what exists.
// - public: free; quality = the town's public schools (w.gov.eduQ, staffed by the government).
// - private: only a real private school business in town with a free seat (the engine charges its fee monthly,
//   Services.schoolMonth). None in town: unavailable, and the card says so.
// - international / prestige ("aristocratic"): out-of-town schools (the town has no such buildings): monthly
//   fees 1.10x and 2.20x the town's typical monthly pay, paid by the carer to outside providers through the
//   ledger; prestige also needs a passed entrance exam.
// Feasibility first (design 2.1): a paid school is an option only if the household's spare income >= 1.25 fees
// or its usable savings >= 12 fees + 3 months of living costs. Then the carers choose (design 2.2: score per
// school, softmax at temperature 0.8 on the player's stream): academic fit, the value they put on education,
// status, the child's welfare, the child's wish (0.25 for teens, 0.18 at 9-11), savings, and the fee against
// spare income. The out-of-town schools shape potential a little (capped at +0.5 for life, separate from clubs);
// a poor fit at the prestige school costs happiness. Fees stop (back to the public school) when unpaid.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance, Pl = LES.Player;
  const st = w => w.player, carer = (w, p) => Pl.carerOf(w, p);
  Pl.TIERS = ['public', 'private', 'international', 'prestige'];
  const TIER = { public: { level: 0.5, peer: 0.2, welfare: 1 }, private: { level: 0.6, peer: 0.5, welfare: 0.85, Q: 1.25 }, international: { level: 0.7, peer: 0.7, welfare: 0.75, Q: 1.3, fee: 1.1 }, prestige: { level: 0.85, peer: 1, welfare: 0.55, Q: 1.4, fee: 2.2 } };
  Pl.CLUBS.tuition = [C.INT]; // exam tuition (TE-003, TE-038)
  // The town's typical monthly pay: the median wage of residents in work.
  Pl.typicalPay = function (w) {
    const s = w.living.filter(q => q.alive && q.job).map(q => q.job.salary).sort((a, b) => a - b);
    return s.length ? s[s.length >> 1] : w.px(C.CHILD_COST) * 4;
  };
  const payers = (w, p) => (p.caregivers || []).map(id => w.people[id]).filter(q => q && q.alive && !q.away && !q.inst);
  // Household money for school decisions: spare income (D) and usable savings (L).
  function household(w, p) {
    const ps = payers(w, p);
    return { D: Math.max(0, ps.reduce((s, q) => s + q.incomeEMA - q.mcost, 0)), L: ps.reduce((s, q) => s + (F.liquid ? F.liquid(w, q) : q.cash), 0), mc: ps.reduce((s, q) => s + q.mcost, 0) };
  }
  function privateSchool(w) {
    for (const b of w.biz) {
      if (!b.open || b.type !== 'privschool') continue;
      const seats = w.living.filter(q => q.alive && q.job && q.job.biz === b.id && q.job.jobId === 'teacher').length * LES.Services.PRIVATE_SEATS - w.living.filter(q => q.alive && q.school === b.id).length;
      if (seats > 0) return b;
    }
    return null;
  }
  // Every tier with its fee, quality and whether this family could really take it (and why not).
  Pl.schoolOffers = function (w, p) {
    const h = household(w, p), M = Pl.typicalPay(w), out = [];
    const feasible = fee => h.D >= 1.25 * fee || h.L >= 12 * fee + 3 * h.mc;
    out.push({ tier: 'public', fee: 0, Q: w.gov ? w.gov.eduQ : 1, ok: true });
    const b = privateSchool(w);
    if (!b) out.push({ tier: 'private', fee: 0, ok: false, why: 'none' });
    else { const fee = w.px(b.typeDef.fee); out.push({ tier: 'private', fee, Q: TIER.private.Q, biz: b.id, name: b.name, ok: feasible(fee), why: feasible(fee) ? '' : 'cost' }); }
    for (const t of ['international', 'prestige']) { const fee = Math.round(TIER[t].fee * M); out.push({ tier: t, fee, Q: TIER[t].Q, ok: feasible(fee), why: feasible(fee) ? '' : 'cost' }); }
    return out;
  };
  Pl.currentTier = (w, p) => (st(w).school ? st(w).school.tier : p.school >= 0 ? 'private' : 'public');

  // The carers' choice among feasible schools (design 2.2).
  function choose(w, p, offers, asked) {
    const g = carer(w, p), h = household(w, p), M = Pl.typicalPay(w), R = Pl.rng(w), age = P.age(w, p);
    const ability = U.clamp(p.pot[C.INT] / 10, 0, 1), values = g.strategy === 'EDU' ? 1 : 0.4 + 0.3 * g.pers.dis / 100;
    const status = g.cls === 'T20' ? 0.8 : g.cls === 'M40' ? 0.5 : 0.3, resp = g.pers.resp / 100, voice = age >= 12 ? 0.25 : age >= 9 ? 0.18 : 0.1;
    const score = o => { const t = TIER[o.tier]; return 0.8 * (1 - Math.abs(t.level - ability)) + 0.5 * values * U.clamp(o.Q / 1.4, 0, 1) + 0.3 * status * t.peer + 0.4 * resp * t.welfare
      + voice * (o.tier === asked ? 1 : 0) + 0.15 * Math.log1p(h.L / Math.max(12 * M, 1)) - 1.0 * (o.fee / Math.max(h.D + h.L / 36, 0.1 * M)); }; // capacity: spare income plus savings spread over three years
    const sc = offers.map(score), mx = Math.max(...sc), ex = sc.map(s => Math.exp((s - mx) / 0.8)), tot = ex.reduce((a, b) => a + b, 0);
    let r = R.next() * tot;
    for (let i = 0; i < offers.length; i++) { r -= ex[i]; if (r <= 0) return offers[i]; }
    return offers[offers.length - 1];
  }

  Object.assign(Pl.HANDLERS, {
    // Ask the carers for a school (args.tier). Returns ok (they agreed) or ok_other (they chose another).
    ASK_SCHOOL: {
      hours: 2, cooldown: 300, minAge: 7, maxAge: 17, key: () => 'school',
      check(w, p, a) {
        if (!Pl.TIERS.includes(a.tier)) return 'bad_args';
        if (p.guardian === 'WELFARE') return 'welfare';
        if (!carer(w, p)) return 'no_carer';
        if (Pl.currentTier(w, p) === a.tier) return 'same';
        const o = Pl.schoolOffers(w, p).find(x => x.tier === a.tier);
        return o.why === 'none' ? 'unavailable' : null;
      },
      params(w, p, a) { return { school: { key: `school.${a.tier}` } }; },
      run(w, p, a) {
        const g = carer(w, p), R = Pl.rng(w);
        let offers = Pl.schoolOffers(w, p).filter(o => o.ok);
        let examNote = null;
        if (a.tier === 'prestige' && offers.some(o => o.tier === 'prestige')) { // entrance exam
          const score = p.pot[C.INT] * (0.85 + 0.3 * R.next()); // aptitude, and how the day goes
          if (score < 6.5) { offers = offers.filter(o => o.tier !== 'prestige'); examNote = 'fail'; }
        }
        const pick = choose(w, p, offers, a.tier), cur = Pl.currentTier(w, p);
        setSchool(w, p, pick, g);
        st(w).played = true;
        const params = { carer: P.name(g), school: { key: `school.${pick.tier}` }, asked: { key: `school.${a.tier}` }, exam: examNote ? { key: 'school.examFail' } : '' };
        if (examNote) Pl.journal(w, { kind: 'life', key: 'school.examFailed', params: { school: { key: 'school.prestige' } }, imp: 1 });
        return { code: pick.tier === a.tier ? 'ok' : pick.tier === cur ? 'ok_stay' : 'ok_other', params };
      },
    },
    // Teens: what you plan to do after school (shown in the panel; studying itself starts at 18, PL-08).
    SET_PLAN: {
      hours: 0, cooldown: 0, minAge: 14, maxAge: 17, key: () => 'plan',
      check(w, p, a) { return ['degree', 'vocational', 'work'].includes(a.plan) ? null : 'bad_args'; },
      run(w, p, a) { st(w).plan = a.plan; return { code: 'ok', params: { plan: { key: `plan.${a.plan}` } } }; },
    },
  });

  function setSchool(w, p, o, g) {
    if (o.tier === 'private') { p.school = o.biz; st(w).school = { tier: 'private', biz: o.biz, since: w.day }; return; }
    if (p.school >= 0) p.school = -1; // leaves the town's private school
    st(w).school = o.tier === 'public' ? { tier: 'public', since: w.day } : { tier: o.tier, fee: o.fee, payer: g.id, since: w.day };
  }

  const SCHOOL_MAX = 0.5;
  function schoolBoost(w, p, a, d) {
    const s = st(w), b = s.schoolBoost = s.schoolBoost || [0, 0, 0, 0, 0, 0];
    const nb = U.clamp(b[a] + d, -SCHOOL_MAX, SCHOOL_MAX), real = nb - b[a];
    b[a] = nb; p.pot[a] = U.clamp(p.pot[a] + real, 0, 10);
  }
  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive || !s.school) return;
    if (P.isAdult(w, p)) { s.school = null; return; } // school is over
    const sc = s.school;
    if (sc.tier === 'private' && p.school < 0) { // the family could no longer pay the town's private school
      s.school = { tier: 'public', since: w.day };
      Pl.journal(w, { kind: 'life', key: 'school.backPublic', params: { school: { key: 'school.private' } }, imp: 1 });
      return;
    }
    if (sc.tier === 'international' || sc.tier === 'prestige') {
      const g = w.people[sc.payer];
      if (!g || !g.alive || g.inst || !w.ledger.spend(g, 'cash', 'MERCHANT', sc.fee)) {
        Pl.journal(w, { kind: 'life', key: 'school.backPublic', params: { school: { key: `school.${sc.tier}` } }, imp: 2 });
        s.school = { tier: 'public', since: w.day };
        return;
      }
      const fit = U.clamp((p.pot[C.INT] - 4) / 4, 0, 1), Q = TIER[sc.tier].Q;
      schoolBoost(w, p, C.INT, 0.006 * (Q - 1) * (0.5 + fit));
      schoolBoost(w, p, C.CHA, sc.tier === 'prestige' ? 0.003 : 0.002); // classmates from elsewhere; for prestige, connections
      if (sc.tier === 'prestige' && fit < 0.5) p.happy = Math.max(20, p.happy - 1); // out of depth among high-flyers
    }
  });

  // ---- Teen events ----
  const pick = (w, list) => (list.length ? list[(w.day / 30 | 0) % list.length] : null);
  const sameAge = (w, p, test) => w.living.filter(q => q.alive && q !== p && !q.away && !P.isAdult(w, q) && Math.abs(P.age(w, q) - P.age(w, p)) <= 1.5 && !(st(w).friends || []).some(f => f.id === q.id) && (!test || test(q)));
  const friend = (w, p) => { const f = (st(w).friends || []).map(x => w.people[x.id]).filter(q => q && q.alive); return f.length ? f[0] : null; };
  Object.assign(Pl.CONDITIONS, {
    schoolChoice: (w, p) => !!carer(w, p) && p.guardian !== 'WELFARE',
    exams: (w, p) => P.age(w, p) >= 15,
    burnout: (w, p) => st(w).effort === 'hard' && p.happy < 45,
    hasFriend: (w, p) => !!friend(w, p),
    crush: (w, p) => P.age(w, p) >= 14 && sameAge(w, p, q => q.sex !== p.sex && P.age(w, q) >= 14).length > 0,
    newStudent: (w, p) => sameAge(w, p, q => q.migrant && q.arrivedDay !== null && q.arrivedDay > w.day - 90).length > 0,
    afterSchool: (w, p) => P.age(w, p) >= 16 && !st(w).plan,
    tuitionCost: (w, p) => P.age(w, p) >= 15 && !st(w).club && !!carer(w, p),
    recession: w => w.regime === 'recession',
  });
  Object.assign(Pl.PARAMS, {
    schools: (w, p) => { const o = Pl.schoolOffers(w, p), fee = t => { const x = o.find(y => y.tier === t); return x && x.fee ? U.fmtMoney(x.fee) : '—'; }; const g = carer(w, p); return { carer: g ? P.name(g) : '', fPrivate: fee('private'), fIntl: fee('international'), fPrestige: fee('prestige') }; },
    friend: (w, p) => { const q = friend(w, p); return { other: q ? P.name(q) : '' }; },
    crush: (w, p) => { const q = pick(w, sameAge(w, p, x => x.sex !== p.sex && P.age(w, x) >= 14)); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    newStudent: (w, p) => { const q = pick(w, sameAge(w, p, x => x.migrant && x.arrivedDay !== null && x.arrivedDay > w.day - 90)); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
  });
  for (const t of Pl.TIERS) Pl.TARGETS[`school_${t}`] = () => ({ tier: t });
  for (const k of ['degree', 'vocational', 'work']) Pl.TARGETS[`plan_${k}`] = () => ({ plan: k });
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['teen'], minAge: 12, maxAge: 17, when, chance: 0.3, cooldown: 300, expires: 20, imp: 1, params: 'fees', choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('TE-001', 'schoolChoice', Pl.TIERS.map(t => cmd(t, 'ASK_SCHOOL', `school_${t}`)), { maxAge: 12, chance: 1, cooldown: 99999, imp: 2, expires: 30, params: 'schools' }),
    ev('TE-003', 'exams', [cmd('balanced', 'SET_EFFORT', 'effortSteady'), cmd('intense', 'SET_EFFORT', 'effortHard'), cmd('tutoring', 'ASK_CLUB', 'club_tuition')], { minAge: 15, chance: 0.6, imp: 2 }),
    ev('TE-006', 'afterSchool', [cmd('degree', 'SET_PLAN', 'plan_degree'), cmd('vocational', 'SET_PLAN', 'plan_vocational'), cmd('work', 'SET_PLAN', 'plan_work')], { minAge: 16, chance: 0.8, imp: 2 }),
    ev('TE-008', 'burnout', [cmd('reduce', 'SET_EFFORT', 'effortRelaxed'), story('counselling'), cmd('rework', 'SET_EFFORT', 'effortSteady')], { chance: 0.8, imp: 2, cooldown: 180 }),
    ev('TE-011', 'hasFriend', [story('state'), story('compromise'), story('walk')], { params: 'friend' }),
    ev('TE-024', 'crush', [cmd('interest', 'MAKE_FRIEND', 'friendInCard'), cmd('friends', 'MAKE_FRIEND', 'friendInCard'), story('distance')], { minAge: 14, chance: 0.35, params: 'crush' }),
    ev('TE-029', 'newStudent', [cmd('orient', 'MAKE_FRIEND', 'friendInCard'), cmd('invite', 'MAKE_FRIEND', 'friendInCard'), story('space')], { chance: 0.7, params: 'newStudent' }),
    ev('TE-038', 'tuitionCost', [story('scholarship'), cmd('budget', 'ASK_CLUB', 'club_tuition'), cmd('free', 'SET_EFFORT', 'effortHard')], { minAge: 15, chance: 0.3 }),
    ev('TE-050', 'recession', [story('research'), story('adviser'), story('help')], { chance: 0.5, cooldown: 700 }),
  );
})(globalThis.LES = globalThis.LES || {});
