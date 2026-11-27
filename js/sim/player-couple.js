// Play a Life, plan part 5 (Nov 2026): closeness with your partner, and couple moments.
// - Closeness with the partner lives in w.player.bonds like any other (0-100); a new couple starts at 60.
// - Each month: +1 for sharing a life, -2 when both are very stressed (average above 60), -2 after two months
//   without time together (a date night, a visit... any HANG_OUT-like couple time), +1 for a marriage. Life
//   moments, gifts and counselling move it too (counselling +6).
// - It matters: the chance of breaking up each month (the engine's own, Family.monthCouples) is multiplied by
//   2^((60 - closeness) / 30) for the played couple only: x1 at 60 (where couples start), x0.5 at 90, x2 at 30.
//   Found-out affairs are forgiven more often by a close partner (Player.affairComesOut).
// - DATE_NIGHT: time together (3 hours, 5% of a typical monthly wage); the partner decides; closeness +6.
// - Your partner comes to you: four moments (more time together, an anniversary, an argument, a bigger home).
// Only the played couple changes; every other couple runs exactly as before.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, Pl = LES.Player;
  const st = w => w.player;
  const START = 60;
  const partnerOf = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return q && q.alive && !q.away && !q.inst ? q : null; };
  Pl.partnerBond = (w, q) => { const b = st(w).bonds || {}; return !q ? 0 : b[q.id] === undefined ? START : b[q.id]; };
  const setBond = (w, id, v) => { (st(w).bonds = st(w).bonds || {})[id] = U.clamp(Math.round(v), 0, 100); };
  // The breakup multiplier for a couple (1 for everyone but the played couple).
  Pl.coupleMul = function (w, a, b) {
    const s = st(w);
    if (!s || (s.id !== a.id && s.id !== b.id)) return 1;
    const q = s.id === a.id ? b : a;
    return Math.pow(2, (START - Pl.partnerBond(w, q)) / 30);
  };

  Pl.HANDLERS.DATE_NIGHT = {
    hours: 3, cooldown: 7, adult: true, key: () => 'datenight',
    check(w, p) { return !partnerOf(w, p) ? 'no_partner' : p.energy < 10 ? 'tired' : null; },
    params(w, p) { const q = partnerOf(w, p); return { other: q ? P.name(q) : '' }; },
    run(w, p) {
      const q = partnerOf(w, p), R = Pl.rng(w), s = st(w);
      s.played = true;
      if (R.next() >= U.clamp(0.6 + Pl.partnerBond(w, q) / 300 - (q.stress > 75 ? 0.25 : 0), 0.25, 0.95)) return { code: 'busy', params: { other: P.name(q) } };
      const c = Math.round(0.05 * Pl.typicalPay(w));
      if (p.cash > p.mcost + c) w.ledger.spend(p, 'cash', 'MERCHANT', c);
      setBond(w, q.id, Pl.partnerBond(w, q) + 6); s.coupleTime = w.day;
      p.happy = Math.min(100, p.happy + 3); p.stress = Math.max(0, p.stress - 3); q.happy = Math.min(100, q.happy + 3); q.stress = Math.max(0, q.stress - 3); p.energy -= 5;
      return { code: 'ok', params: { other: P.name(q), n: Pl.partnerBond(w, q) } };
    },
  };
  Pl.TARGETS.dateNight = (w, p) => (partnerOf(w, p) ? {} : null);

  // A new couple starts at 60 at least (or the friendship, if closer): a friend who becomes your partner, or
  // a partner the town paired you with, does not start at an old, lower closeness. Checked every day, before the
  // day's moments. (A save from before this rule: a couple already counted keeps its closeness.)
  Pl.coupleStart = function (w, p) {
    const s = st(w), q = p && p.alive ? partnerOf(w, p) : null;
    if (!q || s.coupleStart === q.id) return;
    const b = s.bonds = s.bonds || {};
    if (s.coupleStart === undefined && b[q.id] !== undefined && s.coupleTime !== undefined) { s.coupleStart = q.id; return; }
    b[q.id] = Math.max(b[q.id] === undefined ? 0 : b[q.id], START);
    s.coupleStart = q.id; s.coupleTime = w.day;
  };
  Pl.DAILY.push((w, p) => Pl.coupleStart(w, p));

  // Counselling together and gifts to the partner bring you closer; so does any couple time.
  const was = { COUNSEL: Pl.HANDLERS.COUNSEL && Pl.HANDLERS.COUNSEL.run, GIFT: Pl.HANDLERS.GIFT && Pl.HANDLERS.GIFT.run };
  if (was.COUNSEL) Pl.HANDLERS.COUNSEL.run = function (w, p, a) { const r = was.COUNSEL(w, p, a), q = partnerOf(w, p); if (r && r.code === 'ok' && q) { setBond(w, q.id, Pl.partnerBond(w, q) + 6); st(w).coupleTime = w.day; } return r; };
  if (was.GIFT) Pl.HANDLERS.GIFT.run = function (w, p, a) { const r = was.GIFT(w, p, a), q = partnerOf(w, p); if (r && r.code === 'ok' && q && a.pid === q.id) setBond(w, q.id, Pl.partnerBond(w, q) + 3); return r; };

  // Each month: sharing a life brings you closer; stress and no time together push you apart.
  Pl.MONTHLY.push(function (w, p) {
    const s = st(w), q = p && p.alive ? partnerOf(w, p) : null;
    if (!q) return;
    if (!s.bonds || s.bonds[q.id] === undefined) { setBond(w, q.id, START); s.coupleTime = s.coupleTime || w.day; return; }
    const was0 = Pl.partnerBond(w, q);
    let d = 1;
    if ((p.stress + q.stress) / 2 > 60) d -= 2;
    if (w.day - (s.coupleTime || 0) > 60) d -= 2;
    if (s.married && s.married.pid === q.id) d += 1;
    setBond(w, q.id, was0 + d);
    const now = Pl.partnerBond(w, q);
    if (was0 >= 30 && now < 30) Pl.journal(w, { kind: 'life', key: 'love.cold', params: { other: P.name(q) }, imp: 2 });
    if (was0 < 80 && now >= 80) Pl.journal(w, { kind: 'life', key: 'love.warm', params: { other: P.name(q) }, imp: 1 });
  });

  // ---- Your partner comes to you: four moments ----
  const both = (w, p) => { const q = partnerOf(w, p); return q ? (p.stress + q.stress) / 2 : 0; };
  Object.assign(Pl.CONDITIONS, {
    coupleLonely: (w, p) => !!partnerOf(w, p) && Pl.partnerBond(w, partnerOf(w, p)) < 50,
    coupleAnniv: (w, p) => { const s = st(w); return !!partnerOf(w, p) && !!s.coupled && s.coupled.pid === p.partnerId && w.day - s.coupled.day >= 330 && ((w.day - s.coupled.day) % 365) < 30; },
    coupleArgue: (w, p) => !!partnerOf(w, p) && both(w, p) > 50,
    coupleHome: (w, p) => !!partnerOf(w, p) && p.isHead && p.tiers.housing < 3 && p.cash > 6 * p.mcost,
  });
  Pl.PARAMS.couple = (w, p) => { const q = partnerOf(w, p), s = st(w); return { partner: q ? P.name(q) : '', pid: q ? q.id : -1, years: s.coupled ? Math.max(1, Math.round((w.day - s.coupled.day) / 365)) : 1 }; };
  const CEV = (id, when, choices, o) => Object.assign({ id, stages: ['adult', 'senior'], minAge: 18, maxAge: 120, when, chance: 0.2, cooldown: 300, expires: 20, imp: 1, params: 'couple', choices }, o || {});
  Pl.EVENTS.push(
    CEV('CP-001', 'coupleLonely', [{ id: 'date', cmd: 'DATE_NIGHT', target: 'dateNight' }, { id: 'talk', story: true }, { id: 'later', story: true }], { chance: 0.3 }),
    CEV('CP-002', 'coupleAnniv', [{ id: 'celebrate', cmd: 'DATE_NIGHT', target: 'dateNight' }, { id: 'note', story: true }, { id: 'forget', story: true }], { chance: 0.6, cooldown: 330 }),
    CEV('CP-003', 'coupleArgue', [{ id: 'sorry', story: true }, { id: 'firm', story: true }, { id: 'cool', story: true }], { chance: 0.25, cooldown: 120 }),
    CEV('CP-004', 'coupleHome', [{ id: 'move', cmd: 'MOVE_HOME', target: 'homeUp' }, { id: 'save', story: true }, { id: 'no', story: true }], { chance: 0.1, cooldown: 720 }),
  );
  Object.assign(Pl.MOMENT_FX = Pl.MOMENT_FX || {}, {
    'CP-001': [{ req: 'DATE_NIGHT', happy: 1 }, { bond: [['partner', 4]], stress: 1, time: 1 }, { bond: [['partner', -3]], stress: -1 }],
    'CP-002': [{ req: 'DATE_NIGHT', happy: 2 }, { bond: [['partner', 3]], their: [['partner', 'happy', 2]], time: 1 }, { bond: [['partner', -6]], their: [['partner', 'happy', -3]], energy: 4 }],
    'CP-003': [{ bond: [['partner', 3]], trait: ['kind'], stress: 1 }, { bond: [['partner', -4]], trait: ['brave'], stress: -1 }, { bond: [['partner', -1]], stress: -2, time: 1 }],
    'CP-004': [{ req: 'MOVE_HOME', bond: [['partner', 3]] }, { bond: [['partner', 1]], trait: ['careful'], stress: 1 }, { bond: [['partner', -3]], their: [['partner', 'happy', -2]], stress: -1 }],
  });
})(globalThis.LES = globalThis.LES || {});
