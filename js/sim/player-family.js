// Play a Life, adults (PL-09): love, partnership, marriage, children and family, with real residents.
// Every other person decides for themselves (design 06, section 6): an invitation can be refused, a proposal
// declined. The chances use the engine's own compatibility (Family.matchSocial: age gap, charisma, standing,
// how far apart their fortunes are, and how much each wants a family).
// - ASK_DATE: a single adult of the other sex (the engine's couples are man + woman, so children work as for
//   everyone), not related, age gap <= 15. Yes costs a date (0.05 x typical monthly pay, to local businesses).
// - ASK_PARTNER: after 3 dates, ask them to move in: Family.formCouple, the same household change as anyone's.
// - PROPOSE: marriage (a small addition: the engine has partners, not marriages; w.player.married records it).
//   The partner decides; a civil ceremony costs 0.5 x typical pay, a wedding 1.5 x. A married couple is a
//   little less likely to break up (x0.6 on the monthly breakup chance; only for the player's own marriage).
// - SEPARATE: Family.separate (the person leaving moves out, as for any breakup). COUNSEL: both agree to see a
//   counsellor (0.05 x pay): stress falls for both.
// - BABY_WISH: the player's own wish for a child replaces their side of the engine's two-sided decision
//   (Family.desire); the partner still decides for themself, and nature does the rest.
// - CARE_CHILD: an evening with your child: real care sessions (upbringing) and a little energy.
// - CHOOSE_SCHOOL: the four-tier school choice for your own child (PL-07's offers and affordability; you are
//   the carer, so you choose; another carer can object to fees; prestige needs the child to pass the exam).
// - VISIT / GIFT: time with a parent or grown child; money as a real ledger transfer.
// - AFFAIR / END_AFFAIR: only with mature stories switched on (w.player.mature, off by default). The other
//   person must agree; it can be found out (12% a month), and the partner then decides whether to leave.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Fa = LES.Family, Pl = LES.Player;
  const st = w => w.player;
  const M = w => Pl.typicalPay(w);
  const partnerOf = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return q && q.alive ? q : null; };
  const here = q => q && q.alive && !q.away && !q.inst;
  // The engine's compatibility for two people (as Family.matchSocial), times how much both want a family.
  Pl.compat = function (w, a, b) {
    const gap = Math.abs(P.age(w, a) - P.age(w, b));
    const gapW = Math.abs(Math.log10(Math.max(U.RM(1e4), a.nw) / Math.max(U.RM(1e4), b.nw)));
    const c = U.clamp(1.2 - gap / 10 + 0.06 * ((a.att[C.CHA] + b.att[C.CHA]) / 2 - 5) + 0.1 * (P.prestige(a) + P.prestige(b)) / 2 - 0.12 * gapW, 0.1, 2);
    return c * (0.5 + a.famDesire / 100) * (0.5 + b.famDesire / 100);
  };
  // Could these two date at all (the other person still has to say yes)?
  Pl.canDate = (w, p, q) => here(q) && q !== p && P.isAdult(w, q) && q.sex !== p.sex && Math.abs(P.age(w, q) - P.age(w, p)) <= 15 && !Fa.related(w, p, q);
  // Single adults the player might ask out, best match first.
  Pl.singles = (w, p, n) => w.living.filter(q => q.partnerId === null && P.age(w, q) <= 60 && Pl.canDate(w, p, q)).map(q => [q, Pl.compat(w, p, q)]).sort((a, b) => (b[1] - a[1]) || (a[0].id - b[0].id)).slice(0, n || 6).map(x => x[0]);
  const myKids = (w, p) => p.careOf.map(id => w.people[id]).filter(c => c && c.alive && !P.isAdult(w, c));
  const family = (w, p) => p.parents.concat(p.children).map(id => w.people[id]).filter(q => here(q) && (P.isAdult(w, q)));
  const pay = (w, p, amt) => w.ledger.spend(p, 'cash', 'MERCHANT', amt);

  Object.assign(Pl.HANDLERS, {
    ASK_DATE: {
      hours: 4, cooldown: 7, adult: true, key: a => `date:${a.pid}`,
      check(w, p, a) {
        const q = w.people[a.pid];
        if (!q || !Pl.canDate(w, p, q)) return 'not_possible';
        if (q.partnerId !== null) return 'taken';
        if (p.partnerId !== null) return 'have_partner';
        return p.cash < Math.round(0.05 * M(w)) ? 'cant_afford' : null;
      },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], s = st(w), R = Pl.rng(w), ex = p.exPartners.includes(q.id) ? 0.6 : 1;
        const was = s.dating && s.dating.pid === q.id ? s.dating.dates : 0;
        const yes = U.clamp((0.05 + 0.3 * Pl.compat(w, p, q) + 0.08 * was) * ex, 0.05, 0.8);
        s.played = true;
        if (R.next() >= yes) { p.stress = Math.min(100, p.stress + 2); return { code: 'refused', params: { other: P.name(q) } }; }
        const cost = Math.round(0.05 * M(w));
        pay(w, p, cost);
        s.dating = { pid: q.id, dates: was + 1, since: was ? s.dating.since : w.day };
        p.happy = Math.min(100, p.happy + 3); q.happy = Math.min(100, q.happy + 2);
        return { code: 'ok', params: { other: P.name(q), cost: U.fmtMoney(cost), count: s.dating.dates } };
      },
    },
    ASK_PARTNER: {
      hours: 4, cooldown: 60, adult: true, key: () => 'partner',
      check(w, p, a) {
        const q = w.people[a.pid], d = st(w).dating;
        if (p.partnerId !== null) return 'have_partner';
        if (!q || !here(q) || !d || d.pid !== q.id) return 'not_dating';
        if (q.partnerId !== null) return 'taken';
        return d.dates < 3 ? 'too_soon' : null;
      },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], s = st(w), R = Pl.rng(w);
        const yes = U.clamp(0.15 + 0.08 * s.dating.dates + 0.25 * Pl.compat(w, p, q), 0.1, 0.9);
        s.played = true;
        if (R.next() >= yes) return { code: 'refused', params: { other: P.name(q) } };
        Fa.formCouple(w, p, q);
        s.dating = null;
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
    PROPOSE: {
      hours: 4, cooldown: 180, adult: true, key: () => 'propose',
      check(w, p, a) {
        const q = partnerOf(w, p);
        if (!['civil', 'wedding'].includes(a.kind)) return 'bad_args';
        if (!q) return 'no_partner';
        if (st(w).married && st(w).married.pid === q.id) return 'married';
        return p.cash < Math.round((a.kind === 'civil' ? 0.5 : 1.5) * M(w)) ? 'cant_afford' : null;
      },
      params(w, p) { const q = partnerOf(w, p); return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = partnerOf(w, p), s = st(w), R = Pl.rng(w), cost = Math.round((a.kind === 'civil' ? 0.5 : 1.5) * M(w));
        const yes = U.clamp(0.35 + 0.4 * q.famDesire / 100 + 0.1 * togetherYears(w, p) - (q.stress > 70 ? 0.2 : 0), 0.1, 0.92);
        s.played = true;
        if (!here(q) || R.next() >= yes) return { code: 'refused', params: { other: P.name(q) } };
        pay(w, p, cost);
        s.married = { pid: q.id, day: w.day };
        p.happy = Math.min(100, p.happy + 8); q.happy = Math.min(100, q.happy + 8);
        P.log(w, p, `Married ${P.name(q)}`, 'family', 2); P.log(w, q, `Married ${P.name(p)}`, 'family', 1);
        return { code: a.kind === 'civil' ? 'ok_civil' : 'ok', params: { other: P.name(q), cost: U.fmtMoney(cost) } };
      },
    },
    SEPARATE: {
      hours: 4, cooldown: 30, adult: true, key: () => 'separate',
      check(w, p) { return partnerOf(w, p) ? null : 'no_partner'; },
      run(w, p) {
        const q = partnerOf(w, p), s = st(w);
        Fa.separate(w, p, q, 'breakup');
        s.married = null; s.babyWish = null; s.coupled = null; s.played = true;
        p.stress = Math.min(100, p.stress + 10); q.stress = Math.min(100, q.stress + 15);
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
    COUNSEL: {
      hours: 3, cooldown: 60, adult: true, key: () => 'counsel',
      check(w, p) { return !partnerOf(w, p) ? 'no_partner' : p.cash < Math.round(0.05 * M(w)) ? 'cant_afford' : null; },
      params(w, p) { const q = partnerOf(w, p); return { other: q ? P.name(q) : '' }; },
      run(w, p) {
        const q = partnerOf(w, p), R = Pl.rng(w), cost = Math.round(0.05 * M(w));
        st(w).played = true;
        if (!here(q) || R.next() >= 0.4 + 0.4 * q.pers.resp / 100) return { code: 'refused', params: { other: P.name(q) } };
        pay(w, p, cost);
        for (const x of [p, q]) x.stress = Math.max(0, x.stress - 12);
        return { code: 'ok', params: { other: P.name(q), cost: U.fmtMoney(cost) } };
      },
    },
    BABY_WISH: {
      hours: 0, cooldown: 0, adult: true, key: () => 'baby',
      check(w, p, a) { return ['yes', 'later', 'no', 'auto'].includes(a.wish) ? null : 'bad_args'; },
      run(w, p, a) { st(w).babyWish = a.wish === 'auto' ? null : a.wish; st(w).played = true; return { code: 'ok', params: { wish: { key: `baby.${a.wish}` } } }; },
    },
    CARE_CHILD: {
      hours: 3, cooldown: 0, adult: true, key: a => `kid:${a.pid}`,
      check(w, p, a) { const c = w.people[a.pid]; return !c || !c.alive || !p.careOf.includes(c.id) || P.isAdult(w, c) ? 'not_your_child' : p.energy < 10 ? 'tired' : null; },
      params(w, p, a) { const c = w.people[a.pid]; return { child: c ? c.first : '' }; },
      run(w, p, a) {
        const c = w.people[a.pid];
        c.careSessions = (c.careSessions || 0) + 2; c.happy = Math.min(100, c.happy + 2);
        p.energy -= 8; st(w).played = true;
        return { code: 'ok', params: { child: c.first } };
      },
    },
    CHOOSE_SCHOOL: {
      hours: 3, cooldown: 30, adult: true, key: a => `kidschool:${a.pid}`,
      check(w, p, a) {
        const c = w.people[a.pid];
        if (!Pl.TIERS.includes(a.tier)) return 'bad_args';
        if (!c || !c.alive || !p.careOf.includes(c.id)) return 'not_your_child';
        if (P.age(w, c) < 7 || P.isAdult(w, c)) return 'wrong_age';
        if (kidTier(w, c) === a.tier) return 'same';
        const o = Pl.schoolOffers(w, c).find(x => x.tier === a.tier);
        return o.why === 'none' ? 'unavailable' : !o.ok ? 'cant_afford' : null;
      },
      params(w, p, a) { const c = w.people[a.pid]; return { child: c ? c.first : '', school: { key: `school.${a.tier}` } }; },
      run(w, p, a) {
        const c = w.people[a.pid], R = Pl.rng(w), s = st(w), o = Pl.schoolOffers(w, c).find(x => x.tier === a.tier);
        const params = { child: c.first, school: { key: `school.${a.tier}` } };
        s.played = true;
        const other = (c.caregivers || []).map(id => w.people[id]).find(q => here(q) && q !== p);
        if (other && o.fee > 0) { // the other carer has a say in paying fees
          params.other = P.name(other);
          if (R.next() >= U.clamp(0.45 + 0.3 * other.pers.resp / 100 + (other.strategy === 'EDU' ? 0.2 : 0), 0.2, 0.9)) return { code: 'carer_no', params };
        }
        if (a.tier === 'prestige' && c.pot[C.INT] * (0.85 + 0.3 * R.next()) < 6.5) return { code: 'exam_fail', params };
        s.kidSchools = s.kidSchools || {};
        if (c.school >= 0) c.school = -1;
        if (a.tier === 'private') c.school = o.biz;
        s.kidSchools[c.id] = { tier: a.tier, fee: a.tier === 'international' || a.tier === 'prestige' ? o.fee : 0, payer: p.id, since: w.day };
        return { code: 'ok', params };
      },
    },
    VISIT: {
      hours: 4, cooldown: 0, adult: true, key: a => `visit:${a.pid}`,
      check(w, p, a) { const q = w.people[a.pid]; return !q || !family(w, p).includes(q) ? 'not_family' : p.energy < 10 ? 'tired' : null; },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid];
        q.happy = Math.min(100, q.happy + 3); q.stress = Math.max(0, q.stress - 3); p.happy = Math.min(100, p.happy + 2); p.energy -= 6;
        st(w).played = true;
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
    GIFT: {
      hours: 1, cooldown: 30, adult: true, key: a => `gift:${a.pid}`,
      check(w, p, a) {
        const q = w.people[a.pid];
        if (!q || !(family(w, p).includes(q) || q === partnerOf(w, p))) return 'not_family';
        return !(a.share > 0 && a.share <= 0.5) ? 'bad_args' : Math.round((p.cash - 2 * p.mcost) * a.share) < w.px(100) ? 'too_little' : null;
      },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], amt = Math.round((p.cash - 2 * p.mcost) * a.share);
        w.ledger.move(p, 'cash', q, 'cash', amt);
        q.happy = Math.min(100, q.happy + 3); st(w).played = true;
        P.log(w, q, `Received ${U.fmtMoney(amt)} from ${P.name(p)}`, 'money', 0);
        return { code: 'ok', params: { other: P.name(q), amt: U.fmtMoney(amt) } };
      },
    },
    AFFAIR: {
      hours: 4, cooldown: 90, adult: true, key: () => 'affair',
      check(w, p, a) {
        const q = w.people[a.pid];
        if (!st(w).mature) return 'mature_off';
        if (!partnerOf(w, p)) return 'no_partner';
        if (st(w).affair) return 'already';
        return !q || !Pl.canDate(w, p, q) || q.partnerId !== null ? 'not_possible' : null;
      },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid], R = Pl.rng(w);
        st(w).played = true;
        if (R.next() >= U.clamp(0.05 + 0.2 * Pl.compat(w, p, q) * (1 - q.pers.resp / 150), 0.03, 0.6)) return { code: 'refused', params: { other: P.name(q) } };
        st(w).affair = { pid: q.id, since: w.day };
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
    END_AFFAIR: {
      hours: 1, cooldown: 0, adult: true, key: () => 'endaffair',
      check(w) { return st(w).affair ? null : 'no_affair'; },
      run(w) { const q = w.people[st(w).affair.pid]; st(w).affair = null; return { code: 'ok', params: { other: q ? P.name(q) : '' } }; },
    },
  });
  const togetherYears = (w, p) => { const s = st(w); return s.coupled && s.coupled.pid === p.partnerId ? (w.day - s.coupled.day) / 365 : 0; };
  const kidTier = (w, c) => { const k = st(w).kidSchools && st(w).kidSchools[c.id]; return k ? k.tier : c.school >= 0 ? 'private' : 'public'; };
  Pl.kidTier = kidTier;

  // The player's own wish replaces their side of the engine's two-sided decision to have a child.
  const desire = Fa.desire;
  Fa.desire = function (w, p) {
    const s = w.player;
    if (s && s.babyWish && s.id === p.id) return s.babyWish === 'yes' ? 0.95 : 0;
    return desire(w, p);
  };
  // Marriage steadies a couple a little (the player's own marriage only).
  Pl.marriedPair = (w, a, b) => { const s = w.player; return !!(s && s.married && ((s.id === a.id && s.married.pid === b.id) || (s.id === b.id && s.married.pid === a.id))); };

  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (!p || !p.alive) return;
    // Partnership history: when the current partnership began; marriages end with the partnership.
    if (p.partnerId !== null && (!s.coupled || s.coupled.pid !== p.partnerId)) s.coupled = { pid: p.partnerId, day: w.day };
    if (p.partnerId === null && s.coupled) {
      const q = w.people[s.coupled.pid];
      Pl.journal(w, { kind: 'life', key: q && !q.alive ? 'love.widowed' : 'love.ended', params: { other: q ? P.name(q) : '' }, imp: 2 });
      s.coupled = null; s.married = null; s.babyWish = null; s.affair = null;
    }
    if (s.dating) { const q = w.people[s.dating.pid]; if (!here(q) || q.partnerId !== null || p.partnerId !== null) s.dating = null; }
    // Children's schools chosen by the player: fees, and back to public school when they stop.
    for (const id of Object.keys(s.kidSchools || {})) {
      const c = w.people[id], k = s.kidSchools[id];
      if (!c || !c.alive || P.isAdult(w, c)) { delete s.kidSchools[id]; continue; }
      if (k.tier === 'private' && c.school < 0) { k.tier = 'public'; continue; }
      if (k.fee) {
        const g = w.people[k.payer];
        if (!g || !g.alive || g.inst || !pay(w, g, k.fee)) { Pl.journal(w, { kind: 'life', key: 'kid.backPublic', params: { child: c.first, school: { key: `school.${k.tier}` } }, imp: 2 }); s.kidSchools[id] = { tier: 'public', since: w.day }; continue; }
        kidBoost(w, c, C.INT, 0.006 * (k.tier === 'prestige' ? 0.4 : 0.3) * (0.5 + U.clamp((c.pot[C.INT] - 4) / 4, 0, 1)));
      }
    }
    // An affair can come to light; the partner then decides whether to stay.
    if (s.affair) {
      const q = w.people[s.affair.pid], pt = partnerOf(w, p), R = Pl.rng(w);
      if (!here(q) || !pt || q.partnerId !== null) { s.affair = null; return; }
      if (R.next() < 0.12) {
        s.affair = null;
        pt.stress = Math.min(100, pt.stress + 25); p.stress = Math.min(100, p.stress + 15); pt.happy = Math.max(0, pt.happy - 15);
        if (R.next() < 0.45 + 0.3 * (1 - pt.pers.resp / 100)) {
          Fa.separate(w, p, pt, 'breakup');
          s.coupled = null; s.married = null; s.babyWish = null;
          Pl.journal(w, { kind: 'life', key: 'love.foundLeft', params: { other: P.name(pt) }, imp: 2 });
        } else Pl.journal(w, { kind: 'life', key: 'love.foundStayed', params: { other: P.name(pt) }, imp: 2 });
      }
    }
  });
  const KID_MAX = 0.5;
  function kidBoost(w, c, a, d) {
    const s = st(w), all = s.kidBoost = s.kidBoost || {}, b = all[c.id] = all[c.id] || [0, 0, 0, 0, 0, 0];
    const nb = U.clamp(b[a] + d, -KID_MAX, KID_MAX), real = nb - b[a];
    b[a] = nb; c.pot[a] = U.clamp(c.pot[a] + real, 0, 10);
  }

  // ---- Adult events: romance and family ----
  const pick = (w, list) => (list.length ? list[(w.day / 30 | 0) % list.length] : null);
  const colleague = (w, p) => pick(w, p.job ? Pl.singles(w, p, 20).filter(q => q.job && q.job.biz === p.job.biz) : []);
  const someone = (w, p) => pick(w, Pl.singles(w, p, 4));
  const ex = (w, p) => pick(w, p.exPartners.map(id => w.people[id]).filter(q => q && q.partnerId === null && Pl.canDate(w, p, q)));
  const kidAt = (w, p, lo, hi, test) => pick(w, myKids(w, p).filter(c => P.age(w, c) >= lo && P.age(w, c) < hi && (!test || test(c))));
  const schoolKid = (w, p) => kidAt(w, p, 11, 13, c => !(st(w).kidSchools || {})[c.id] && !(st(w).askedSchool || {})[c.id]);
  const oldParent = (w, p) => pick(w, p.parents.map(id => w.people[id]).filter(q => here(q) && P.age(w, q) >= 70 && q.health < 60));
  const single = (w, p) => p.partnerId === null && !st(w).dating;
  Object.assign(Pl.CONDITIONS, {
    workCrush: (w, p) => single(w, p) && !!colleague(w, p),
    datingApp: (w, p) => single(w, p) && P.age(w, p) <= 50 && !!someone(w, p),
    proposal: (w, p) => { const q = partnerOf(w, p); return !!q && !st(w).married && togetherYears(w, p) >= 1; },
    strained: (w, p) => { const q = partnerOf(w, p); return !!q && (p.stress + q.stress) / 2 > 60; },
    affairChance: (w, p) => !!st(w).mature && !!partnerOf(w, p) && !st(w).affair && !!someone(w, p),
    exReturns: (w, p) => p.partnerId === null && !!ex(w, p),
    childSchool: (w, p) => !!schoolKid(w, p),
    babyPlans: (w, p) => { const q = partnerOf(w, p); if (!q || st(w).babyWish) return false; const f = p.sex === 'F' ? p : q; return P.age(w, f) >= 22 && P.age(w, f) <= 40; },
    teenLow: (w, p) => !!kidAt(w, p, 13, 18, c => c.happy < 45),
    elderCare: (w, p) => !!oldParent(w, p),
  });
  Object.assign(Pl.PARAMS, {
    colleague: (w, p) => { const q = colleague(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    someone: (w, p) => { const q = someone(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1, age: q ? Math.floor(P.age(w, q)) : 0 }; },
    ex: (w, p) => { const q = ex(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    partner: (w, p) => { const q = partnerOf(w, p); return { other: q ? P.name(q) : '', civil: U.fmtMoney(Math.round(0.5 * M(w))), wedding: U.fmtMoney(Math.round(1.5 * M(w))) }; },
    kidSchool: (w, p) => {
      const c = schoolKid(w, p); if (!c) return { child: '', pid: -1 };
      (st(w).askedSchool = st(w).askedSchool || {})[c.id] = w.day;
      const o = Pl.schoolOffers(w, c), fee = t => { const x = o.find(y => y.tier === t); return x && x.fee ? U.fmtMoney(x.fee) : '—'; };
      return { child: c.first, pid: c.id, fPrivate: fee('private'), fIntl: fee('international'), fPrestige: fee('prestige') };
    },
    teen: (w, p) => { const c = kidAt(w, p, 13, 18, x => x.happy < 45); return { child: c ? c.first : '', pid: c ? c.id : -1 }; },
    elder: (w, p) => { const q = oldParent(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
  });
  const inCard = (w, p, item) => (item && item.params && item.params.pid >= 0 ? { pid: item.params.pid } : null);
  Object.assign(Pl.TARGETS, {
    personInCard: inCard,
    partnerInCard: (w, p) => (partnerOf(w, p) ? {} : null),
    civil: () => ({ kind: 'civil' }), wedding: () => ({ kind: 'wedding' }),
    giftInCard: (w, p, item) => (inCard(w, p, item) ? { pid: item.params.pid, share: 0.2 } : null),
    babyYes: () => ({ wish: 'yes' }), babyLater: () => ({ wish: 'later' }), babyNo: () => ({ wish: 'no' }),
  });
  for (const t of Pl.TIERS) Pl.TARGETS[`kid_${t}`] = (w, p, item) => (inCard(w, p, item) ? { pid: item.params.pid, tier: t } : null);
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['adult'], minAge: 18, maxAge: 59, when, chance: 0.3, cooldown: 360, expires: 20, imp: 1, params: 'someone', choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('AD-031', 'workCrush', [cmd('ask', 'ASK_DATE', 'personInCard'), story('friends'), story('boundary')], { params: 'colleague', chance: 0.3 }),
    ev('AD-032', 'datingApp', [cmd('meet', 'ASK_DATE', 'personInCard'), story('chat'), story('decline')], { maxAge: 50, chance: 0.25 }),
    ev('AD-035', 'proposal', [cmd('wedding', 'PROPOSE', 'wedding'), cmd('civil', 'PROPOSE', 'civil'), story('wait')], { params: 'partner', chance: 0.3, imp: 2, cooldown: 540 }),
    ev('AD-036', 'strained', [cmd('counsel', 'COUNSEL', 'partnerInCard'), story('boundaries'), cmd('separate', 'SEPARATE', 'partnerInCard')], { params: 'partner', chance: 0.5, imp: 2, cooldown: 240 }),
    ev('AD-037', 'affairChance', [story('faithful'), cmd('end', 'SEPARATE', 'partnerInCard'), cmd('pursue', 'AFFAIR', 'personInCard')], { mature: true, chance: 0.15, cooldown: 720 }),
    ev('AD-040', 'exReturns', [cmd('reconcile', 'ASK_DATE', 'personInCard'), story('friends'), story('distance')], { params: 'ex', chance: 0.2, cooldown: 720 }),
    ev('AD-041', 'childSchool', Pl.TIERS.map(t => cmd(t, 'CHOOSE_SCHOOL', `kid_${t}`)), { stages: ['adult', 'senior'], maxAge: 99, params: 'kidSchool', chance: 1, imp: 2, cooldown: 30, expires: 30 }),
    ev('AD-045', 'babyPlans', [cmd('ready', 'BABY_WISH', 'babyYes'), cmd('delay', 'BABY_WISH', 'babyLater'), cmd('none', 'BABY_WISH', 'babyNo')], { params: 'partner', chance: 0.3, imp: 2, cooldown: 720 }),
    ev('AD-047', 'teenLow', [cmd('listen', 'CARE_CHILD', 'personInCard'), story('specialist'), story('school')], { stages: ['adult', 'senior'], params: 'teen', maxAge: 99, chance: 0.5, cooldown: 240 }),
    ev('AD-044', 'elderCare', [story('share'), cmd('support', 'GIFT', 'giftInCard'), cmd('time', 'VISIT', 'personInCard')], { params: 'elder', maxAge: 75, chance: 0.4, imp: 2, cooldown: 360 }),
  );
})(globalThis.LES = globalThis.LES || {});
