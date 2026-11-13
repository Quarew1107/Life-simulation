// Play a Life (PL-11): health, rest, travel and difficult times, for adults and seniors.
// - SEE_DOCTOR: the engine's own clinic visit (Actions HEALTH: the town's health service or a private bill).
//   It helps when something is wrong (health below 90: +12, as for anyone); a healthy check-up finds nothing.
// - COUNSELLING: a session with a counsellor (0.05 x typical monthly pay, to the health sector): stress -15.
// - REST: a day off for yourself: stress -8, energy +20 (a whole day: it uses all of today's time).
// - SET_EXERCISE: a habit: light (walks) or regular. Each month: less stress, a little energy, and a small
//   health gain while health is below 95 (no fountain of youth: ageing and illness carry on as normal).
// - TRAVEL: an abstract trip (the town has no other places to go): domestic 0.4 x pay, 4 days; abroad 2 x pay,
//   10 days, paid to merchants / the outside world. During the trip you cannot do anything else; on return
//   stress falls (domestic -15, abroad -25) and happiness rises. Your character's own daily routine is not
//   moved (the trip is not a physical journey on the map).
// Difficult stories (grief, feeling overwhelmed) are non-graphic and offer support-seeking choices only; they
// can be hidden (w.player.noSensitive). Hiding changes only which events the player is offered (the player's
// own dice), never the town's.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  const M = w => Pl.typicalPay(w);
  Pl.TRIPS = { domestic: { cost: 0.4, days: 4, stress: 15, happy: 6, sector: 'MERCHANT' }, abroad: { cost: 2, days: 10, stress: 25, happy: 12, sector: 'ABROAD' } };
  Pl.tripCost = (w, kind) => Math.round(Pl.TRIPS[kind].cost * M(w));
  const partnerOf = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return q && q.alive && !q.away ? q : null; };

  Object.assign(Pl.HANDLERS, {
    SEE_DOCTOR: {
      hours: 3, cooldown: 14, adult: true, key: () => 'doctor',
      check(w, p) { return p.cash < w.px(60) ? 'cant_afford' : null; },
      run(w, p) {
        const ill = p.health < 90;
        const paid = w.gov ? LES.Services.medicalBill(w, p, w.px(60), true) >= 0 : w.ledger.spend(p, 'cash', 'HEALTH', w.px(60));
        p.energy -= 4; st(w).played = true;
        if (!paid) return { code: 'cant_afford', params: {} };
        if (!ill) return { code: 'ok_well', params: {} };
        p.health = Math.min(100, p.health + 12); p.stress = Math.max(0, p.stress - 2);
        return { code: 'ok', params: {} };
      },
    },
    COUNSELLING: {
      hours: 2, cooldown: 14, adult: true, key: () => 'counselling',
      check(w, p) { return p.cash < Math.round(0.05 * M(w)) + p.mcost / 4 ? 'cant_afford' : null; },
      run(w, p) {
        const cost = Math.round(0.05 * M(w));
        w.ledger.spend(p, 'cash', 'HEALTH', cost);
        p.stress = Math.max(0, p.stress - 15); p.happy = Math.min(100, p.happy + 3); st(w).played = true;
        return { code: 'ok', params: { cost: U.fmtMoney(cost) } };
      },
    },
    REST: {
      hours: 8, cooldown: 7, adult: true, key: () => 'rest',
      check() { return null; },
      run(w, p) { p.stress = Math.max(0, p.stress - 8); p.energy = Math.min(100, p.energy + 20); st(w).played = true; return { code: 'ok', params: {} }; },
    },
    SET_EXERCISE: {
      hours: 0, cooldown: 0, adult: true, key: () => 'exercise',
      check(w, p, a) { return ['none', 'light', 'regular'].includes(a.level) ? null : 'bad_args'; },
      run(w, p, a) { st(w).exercise = a.level === 'none' ? null : a.level; st(w).played = true; return { code: 'ok', params: { level: { key: `exercise.${a.level}` } } }; },
    },
    TRAVEL: {
      hours: 8, cooldown: 60, adult: true, key: () => 'travel',
      check(w, p, a) {
        const t = Pl.TRIPS[a.kind];
        if (!t) return 'bad_args';
        return p.cash - Pl.tripCost(w, a.kind) < 2 * p.mcost ? 'cant_afford' : null;
      },
      params(w, p, a) { return { trip: { key: `trip.${a.kind}` }, cost: Pl.TRIPS[a.kind] ? U.fmtMoney(Pl.tripCost(w, a.kind)) : '' }; },
      run(w, p, a) {
        const t = Pl.TRIPS[a.kind], cost = Pl.tripCost(w, a.kind), q = partnerOf(w, p);
        w.ledger.spend(p, 'cash', t.sector, cost);
        st(w).trip = { kind: a.kind, until: w.day + t.days, with: q ? q.id : -1 };
        st(w).played = true;
        return { code: 'ok', params: { trip: { key: `trip.${a.kind}` }, cost: U.fmtMoney(cost), days: t.days } };
      },
    },
  });

  // Every day: a trip ends (the effects of a holiday come when you are back).
  Pl.DAILY.push(function (w, p) {
    const s = st(w);
    if (!s.trip || s.trip.until > w.day) return;
    const t = Pl.TRIPS[s.trip.kind], q = s.trip.with >= 0 ? w.people[s.trip.with] : null;
    if (p && p.alive) {
      p.stress = Math.max(0, p.stress - t.stress); p.happy = Math.min(100, p.happy + t.happy);
      if (q && q.alive) { q.stress = Math.max(0, q.stress - t.stress / 2); q.happy = Math.min(100, q.happy + t.happy / 2); }
      Pl.journal(w, { kind: 'life', key: 'trip.back', params: { trip: { key: `trip.${s.trip.kind}` } }, imp: 1 });
    }
    s.trip = null;
  });
  Pl.travelling = w => !!(w.player && w.player.trip && w.player.trip.until > w.day);

  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive) return;
    if (s.exercise) {
      const r = s.exercise === 'regular';
      p.stress = Math.max(0, p.stress - (r ? 4 : 2));
      if (p.health < 95) p.health = Math.min(95, p.health + (r ? 1 : 0.5));
    }
    s.lowMonths = p.happy < 30 ? (s.lowMonths || 0) + 1 : 0;
    s.stressMonths = p.stress > 75 ? (s.stressMonths || 0) + 1 : 0;
  });

  // ---- Events: health, travel and hard times (adults and seniors) ----
  const lost = (w, p) => { // a parent, partner or child who died in the last two months
    const ids = p.parents.concat(p.children, st(w).lastPartner >= 0 ? [st(w).lastPartner] : []);
    return ids.map(id => w.people[id]).find(q => q && !q.alive && q.deathDay !== null && q.deathDay > w.day - 60) || null;
  };
  const trusted = (w, p) => p.parents.concat(p.children).map(id => w.people[id]).find(q => q && q.alive && !q.away && P.isAdult(w, q)) || null;
  Object.assign(Pl.CONDITIONS, {
    checkup: (w, p) => P.age(w, p) >= 35,
    noExercise: (w, p) => !st(w).exercise,
    stressed: (w, p) => (st(w).stressMonths || 0) >= 2,
    overwhelmed: (w, p) => (st(w).lowMonths || 0) >= 2,
    bereaved: (w, p) => !!lost(w, p),
    holiday: (w, p) => p.cash - Pl.tripCost(w, 'domestic') > 4 * p.mcost && !Pl.travelling(w),
    abroad: (w, p) => p.cash - Pl.tripCost(w, 'abroad') > 6 * p.mcost && !Pl.travelling(w),
    poorHealth: (w, p) => p.health < 50,
  });
  Object.assign(Pl.PARAMS, {
    trips: w => ({ domestic: U.fmtMoney(Pl.tripCost(w, 'domestic')), abroad: U.fmtMoney(Pl.tripCost(w, 'abroad')) }),
    bereaved: (w, p) => { const q = lost(w, p); return { other: q ? P.name(q) : '' }; },
    trusted: (w, p) => { const q = trusted(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
  });
  Object.assign(Pl.TARGETS, {
    doctor: () => ({}), counselling: () => ({}), rest: () => ({}),
    exLight: () => ({ level: 'light' }), exRegular: () => ({ level: 'regular' }),
    domestic: () => ({ kind: 'domestic' }), abroad: () => ({ kind: 'abroad' }),
    trusted: (w, p) => { const q = trusted(w, p); return q ? { pid: q.id } : null; },
  });
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['adult', 'senior'], minAge: 18, maxAge: 120, when, chance: 0.25, cooldown: 360, expires: 20, imp: 1, choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('AD-051', 'checkup', [cmd('book', 'SEE_DOCTOR', 'doctor'), cmd('screen', 'SEE_DOCTOR', 'doctor'), story('delay')], { minAge: 35, chance: 0.2 }),
    ev('AD-052', 'noExercise', [cmd('train', 'SET_EXERCISE', 'exRegular'), cmd('sport', 'SET_EXERCISE', 'exRegular'), cmd('walks', 'SET_EXERCISE', 'exLight')], { chance: 0.15, cooldown: 720 }),
    ev('AD-053', 'stressed', [cmd('support', 'COUNSELLING', 'counselling'), cmd('reduce', 'REST', 'rest'), cmd('family', 'VISIT', 'trusted')], { chance: 0.6, cooldown: 180, imp: 2 }),
    ev('AD-058', 'overwhelmed', [cmd('trusted', 'VISIT', 'trusted'), cmd('care', 'COUNSELLING', 'counselling'), cmd('respite', 'REST', 'rest')], { sensitive: true, chance: 0.7, cooldown: 180, imp: 2 }),
    ev('AD-094', 'bereaved', [cmd('support', 'COUNSELLING', 'counselling'), cmd('leave', 'REST', 'rest'), story('arrange')], { sensitive: true, params: 'bereaved', chance: 1, cooldown: 60, imp: 2 }),
    ev('AD-063', 'holiday', [cmd('budget', 'TRAVEL', 'domestic'), cmd('relatives', 'VISIT', 'trusted'), cmd('local', 'REST', 'rest')], { params: 'trips', chance: 0.2, cooldown: 300 }),
    ev('AD-064', 'abroad', [cmd('trip', 'TRAVEL', 'abroad'), cmd('group', 'TRAVEL', 'abroad'), story('save')], { params: 'trips', chance: 0.15, cooldown: 540 }),
    ev('AD-097', 'poorHealth', [cmd('care', 'SEE_DOCTOR', 'doctor'), cmd('reprioritise', 'REST', 'rest'), cmd('family', 'VISIT', 'trusted')], { chance: 0.5, cooldown: 120, imp: 2 }),
  );
})(globalThis.LES = globalThis.LES || {});
