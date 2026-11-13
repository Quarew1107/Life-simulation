// Play a Life, childhood (PL-06, ages 3-11; effort, clubs, pocket money and friends carry on into the teens).
// A child's abilities are recomputed every year from their potential (World.yearClose) and, at 18, from potential
// and upbringing (Family.comeOfAge). So the only childhood choices that last are those that move potential or
// upbringing, and each is small and capped:
// - SET_EFFORT relaxed | steady | hard: the child's own choice, free. Hard: intelligence potential +0.003 a month,
//   happiness -1; relaxed: happiness +1, potential -0.0015. (Capped with clubs at +0.6 / -0.3 per ability.)
// - ASK_CLUB: the carer decides (affordable? responsible? values learning? the child's charm), then pays a real
//   monthly fee through the ledger (a quarter of the country's monthly child cost); +0.004 a month to the club's
//   abilities' potential, happiness +2. It stops when the carer cannot pay. One club at a time.
// - ASK_ALLOWANCE: the carer decides; a real monthly transfer from the carer to the child (a tenth of the monthly
//   child cost; chores make a yes likelier). Stops when the carer runs short.
// - MAKE_FRIEND: a real child in town within two years of age may say yes (similar personality, charm). Friends
//   are the player's own list (w.player.friends); they cheer the child up and appear in later stories.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Pl = LES.Player;
  const st = w => w.player, carer = (w, p) => Pl.carerOf(w, p);
  Pl.CLUBS = { football: [C.STR, C.END], athletics: [C.END, C.AGI], swimming: [C.END, C.AGI], dance: [C.AGI, C.CHA], music: [C.PER, C.CHA], art: [C.PER], chess: [C.INT], maths: [C.INT], science: [C.INT, C.PER] };
  const LEARNING = new Set(['chess', 'maths', 'science', 'music']);
  Pl.clubFee = w => Math.round(w.px(C.CHILD_COST) * 0.25);
  Pl.allowanceAmt = w => Math.round(w.px(C.CHILD_COST) * 0.1);
  const BOOST_MAX = 0.6, BOOST_MIN = -0.3;
  // Move a child's potential, within the lifetime caps (kept in w.player.boost).
  function boost(w, p, a, d) {
    const s = st(w), b = s.boost = s.boost || [0, 0, 0, 0, 0, 0];
    const nb = U.clamp(b[a] + d, BOOST_MIN, BOOST_MAX), real = nb - b[a];
    b[a] = nb; p.pot[a] = U.clamp(p.pot[a] + real, 0, 10);
  }
  const minor = (w, p) => !P.isAdult(w, p);
  const affordable = (g, amt) => g.cash >= 6 * amt || (g.incomeEMA - g.mcost) >= 2 * amt;
  const carerChecks = (w, p) => (p.guardian === 'WELFARE' ? 'welfare' : carer(w, p) ? null : 'no_carer');
  const name = q => P.name(q);

  Object.assign(Pl.HANDLERS, {
    SET_EFFORT: {
      hours: 0, cooldown: 30, minAge: 6, maxAge: 17, key: () => 'effort',
      check(w, p, a) { return ['relaxed', 'steady', 'hard'].includes(a.level) ? (st(w).effort || 'steady') === a.level ? 'same' : null : 'bad_args'; },
      run(w, p, a) { st(w).effort = a.level; return { code: 'ok', params: { level: { key: `effort.${a.level}` } } }; },
    },
    ASK_CLUB: {
      hours: 1, cooldown: 30, minAge: 4, maxAge: 17, key: a => `club:${a.club}`,
      check(w, p, a) {
        if (!Pl.CLUBS[a.club]) return 'bad_args';
        if (st(w).club) return 'has_club';
        const c = carerChecks(w, p); if (c) return c;
        return affordable(carer(w, p), Pl.clubFee(w)) ? null : 'cant_afford';
      },
      params(w, p, a) { const g = carer(w, p); return { carer: g ? name(g) : '', club: { key: `club.${a.club}` }, fee: U.fmtMoney(Pl.clubFee(w)) }; },
      run(w, p, a) {
        const g = carer(w, p), R = Pl.rng(w);
        const yes = U.clamp(0.25 + 0.45 * g.pers.resp / 100 + 0.15 * p.att[C.CHA] / 10 + (LEARNING.has(a.club) && g.strategy === 'EDU' ? 0.15 : 0), 0.05, 0.9);
        const params = { carer: name(g), club: { key: `club.${a.club}` }, fee: U.fmtMoney(Pl.clubFee(w)) };
        if (R.next() >= yes) return { code: 'refused', params };
        st(w).club = { id: a.club, payer: g.id, since: w.day };
        st(w).played = true;
        return { code: 'ok', params };
      },
    },
    QUIT_CLUB: {
      hours: 0, cooldown: 0, key: () => 'quit', check(w) { return st(w).club ? null : 'no_club'; },
      run(w) { const c = st(w).club; st(w).club = null; return { code: 'ok', params: { club: { key: `club.${c.id}` } } }; },
    },
    ASK_ALLOWANCE: {
      hours: 1, cooldown: 60, minAge: 6, maxAge: 17, key: () => 'allowance',
      check(w, p) {
        if (st(w).allowance) return 'has_allowance';
        const c = carerChecks(w, p); if (c) return c;
        return affordable(carer(w, p), 3 * Pl.allowanceAmt(w)) ? null : 'cant_afford';
      },
      params(w, p) { const g = carer(w, p); return { carer: g ? name(g) : '', amt: U.fmtMoney(Pl.allowanceAmt(w)) }; },
      run(w, p, a) {
        const g = carer(w, p), R = Pl.rng(w), params = { carer: name(g), amt: U.fmtMoney(Pl.allowanceAmt(w)) };
        const yes = U.clamp(0.2 + 0.4 * g.pers.resp / 100 + (a.chores ? 0.2 : 0) + 0.1 * p.att[C.CHA] / 10, 0.05, 0.9);
        if (R.next() >= yes) return { code: 'refused', params };
        st(w).allowance = { payer: g.id, amt: Pl.allowanceAmt(w), chores: !!a.chores, since: w.day };
        st(w).played = true;
        return { code: a.chores ? 'ok_chores' : 'ok', params };
      },
    },
    STOP_SPENDING: { // the family is short: give up the club and the pocket money
      hours: 0, cooldown: 0, key: () => 'stop', check(w) { return st(w).club || st(w).allowance ? null : 'nothing'; },
      run(w) { st(w).club = null; st(w).allowance = null; return { code: 'ok', params: {} }; },
    },
    MAKE_FRIEND: {
      hours: 2, cooldown: 7, minAge: 3, maxAge: 17, key: a => `friend:${a.pid}`,
      check(w, p, a) {
        const q = w.people[a.pid], s = st(w);
        if (!q || !q.alive || q.away || q === p || P.isAdult(w, q) || Math.abs(P.age(w, q) - P.age(w, p)) > 2.5) return 'not_found';
        if ((s.friends || []).some(f => f.id === q.id)) return 'already_friend';
        return (s.friends || []).length >= 6 ? 'too_many' : null;
      },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], R = Pl.rng(w), s = st(w);
        const sim = 1 - C.PERS.reduce((t, k) => t + Math.abs(p.pers[k] - q.pers[k]), 0) / (100 * C.PERS.length);
        const yes = U.clamp(0.2 + 0.4 * sim + 0.25 * p.att[C.CHA] / 10, 0.1, 0.85);
        if (R.next() >= yes) return { code: 'refused', params: { other: name(q) } };
        (s.friends = s.friends || []).push({ id: q.id, since: w.day });
        p.happy = Math.min(90, p.happy + 5); s.played = true;
        return { code: 'ok', params: { other: name(q) } };
      },
    },
  });

  // Monthly: the club and pocket money are paid; effort and the club shape potential a little.
  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive) return;
    if (!minor(w, p)) { s.club = null; s.allowance = null; return; } // grown up: the child's arrangements end
    if (s.club) {
      const g = w.people[s.club.payer], fee = Pl.clubFee(w);
      if (!g || !g.alive || g.inst || !w.ledger.spend(g, 'cash', 'MERCHANT', fee)) {
        Pl.journal(w, { kind: 'life', key: 'club.stopped', params: { club: { key: `club.${s.club.id}` } }, imp: 1 });
        s.club = null;
      } else { for (const a of Pl.CLUBS[s.club.id]) boost(w, p, a, 0.004); p.happy = Math.min(90, p.happy + 2); }
    }
    if (s.allowance) {
      const g = w.people[s.allowance.payer], amt = s.allowance.amt;
      if (!g || !g.alive || g.inst || g.cash < 3 * amt || !w.ledger.move(g, 'cash', p, 'cash', amt)) {
        Pl.journal(w, { kind: 'life', key: 'allow.stopped', params: {}, imp: 1 });
        s.allowance = null;
      }
    }
    if (P.age(w, p) >= 6) {
      if (s.effort === 'hard') { boost(w, p, C.INT, 0.003); p.happy = Math.max(25, p.happy - 1); }
      else if (s.effort === 'relaxed') { boost(w, p, C.INT, -0.0015); p.happy = Math.min(90, p.happy + 1); }
    }
    s.friends = (s.friends || []).filter(f => { const q = w.people[f.id]; return q && q.alive && !q.away; }); // moved away or died
  });

  // ---- Childhood events ----
  const kids = (w, p, test) => w.living.filter(q => q.alive && q !== p && !q.away && !P.isAdult(w, q) && Math.abs(P.age(w, q) - P.age(w, p)) <= 2 && !(st(w).friends || []).some(f => f.id === q.id) && (!test || test(q)));
  const pick = (w, list) => (list.length ? list[(w.day / 30 | 0) % list.length] : null);
  const classmate = (w, p) => pick(w, kids(w, p));
  const newcomer = (w, p) => pick(w, kids(w, q => q.migrant && q.arrivedDay !== null && q.arrivedDay > w.day - 90));
  Object.assign(Pl.CONDITIONS, {
    schoolStart: (w, p) => P.age(w, p) < 7.5 && !!classmate(w, p),
    homework: (w, p) => P.age(w, p) >= 7,
    clubOffer: (w, p) => !st(w).club && !!carer(w, p),
    weakYear: (w, p) => (p.schoolQ !== undefined && p.schoolQ < 0.95) || p.pot[C.INT] < 4.5,
    bright: (w, p) => p.pot[C.INT] >= 6.5,
    noAllowance: (w, p) => !st(w).allowance && !!carer(w, p),
    familyJobless: (w, p) => { const g = carer(w, p); return !!g && !g.job && !g.retired && g.manages < 0 && P.age(w, g) < 64; },
    newSibling3: (w, p) => !!carer(w, p) && p.parents.some(id => w.people[id].children.some(c => w.people[c] && w.people[c].alive && w.people[c].birthDay > w.day - 30 && c !== p.id)),
    newClassmate: (w, p) => !!newcomer(w, p),
  });
  Object.assign(Pl.PARAMS, {
    classmate: (w, p) => { const q = classmate(w, p), g = carer(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1, carer: g ? P.name(g) : '' }; },
    newcomer: (w, p) => { const q = newcomer(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    fees: (w, p) => { const g = carer(w, p); return { carer: g ? P.name(g) : '', fee: U.fmtMoney(Pl.clubFee(w)), amt: U.fmtMoney(Pl.allowanceAmt(w)) }; },
  });
  Object.assign(Pl.TARGETS, {
    effortHard: () => ({ level: 'hard' }), effortSteady: () => ({ level: 'steady' }), effortRelaxed: () => ({ level: 'relaxed' }),
    friendInCard: (w, p, item) => (item && item.params && item.params.pid >= 0 ? { pid: item.params.pid } : null),
    allowance: () => ({}), allowanceChores: () => ({ chores: true }), stopSpending: () => ({}),
    club: c => () => ({ club: c }),
  });
  for (const c of Object.keys(Pl.CLUBS)) Pl.TARGETS[`club_${c}`] = () => ({ club: c });
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['child'], minAge: 3, maxAge: 11, when, chance: 0.3, cooldown: 240, expires: 15, imp: 1, params: 'fees', choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('CH-001', 'schoolStart', [story('introduce'), cmd('sitNear', 'MAKE_FRIEND', 'friendInCard'), story('teacher')], { minAge: 6, chance: 0.9, cooldown: 99999, imp: 2, params: 'classmate' }),
    ev('CH-002', 'homework', [story('teacher'), cmd('practice', 'SET_EFFORT', 'effortHard'), cmd('peer', 'MAKE_FRIEND', 'friendInCard')], { minAge: 7, params: 'classmate' }),
    ev('CH-004', 'clubOffer', [cmd('maths', 'ASK_CLUB', 'club_maths'), cmd('science', 'ASK_CLUB', 'club_science'), cmd('free', 'SET_EFFORT', 'effortRelaxed')], { minAge: 7 }),
    ev('CH-006', 'weakYear', [cmd('plan', 'SET_EFFORT', 'effortHard'), cmd('tutor', 'ASK_CARE', 'care'), story('strength')], { minAge: 7, chance: 0.4, cooldown: 360, imp: 2 }),
    ev('CH-009', 'bright', [cmd('harder', 'SET_EFFORT', 'effortHard'), story('mentor'), cmd('normal', 'SET_EFFORT', 'effortSteady')], { minAge: 8, chance: 0.4, cooldown: 99999, imp: 2 }),
    ev('CH-011', 'noAllowance', [cmd('ask', 'ASK_ALLOWANCE', 'allowance'), cmd('chores', 'ASK_ALLOWANCE', 'allowanceChores'), story('save')], { minAge: 7, cooldown: 360 }),
    ev('CH-015', 'familyJobless', [story('support'), cmd('conserve', 'STOP_SPENDING', 'stopSpending'), story('resources')], { chance: 0.6, cooldown: 360, imp: 2 }),
    ev('CH-016', 'newSibling3', [story('help'), story('drawing'), cmd('time', 'ASK_CARE', 'care')], { chance: 0.9, imp: 2, params: 'fees' }),
    ev('CH-021', 'newClassmate', [cmd('invite', 'MAKE_FRIEND', 'friendInCard'), cmd('introduce', 'MAKE_FRIEND', 'friendInCard'), story('space')], { chance: 0.7, params: 'newcomer' }),
    ev('CH-031', 'clubOffer', [cmd('football', 'ASK_CLUB', 'club_football'), cmd('athletics', 'ASK_CLUB', 'club_athletics'), cmd('gentle', 'ASK_CLUB', 'club_swimming')], { minAge: 5 }),
    ev('CH-032', 'clubOffer', [cmd('piano', 'ASK_CLUB', 'club_music'), cmd('drums', 'ASK_CLUB', 'club_music'), story('choir')], { minAge: 5 }),
  );
})(globalThis.LES = globalThis.LES || {});
