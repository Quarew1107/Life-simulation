// Person record, helpers and the life-history log.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C;
  const P = LES.P = {};

  P.blank = function (id) {
    return {
      id, first: '', last: '', sex: 'M', eth: 'malay', birthDay: 0, deathDay: null, alive: true,
      gen: 0, custom: false, causeOfDeath: null, adult: false,
      look: null,
      parents: [], children: [], partnerId: null, exPartners: [], careOf: [], caregivers: [], guardian: null,
      pot: [5, 5, 5, 5, 5, 5], att: [5, 5, 5, 5, 5, 5],
      pers: { dis: 50, pat: 50, risk: 50, resp: 50, res: 50 }, famDesire: 50,
      strategy: 'BAL', stratHist: [], pendingReview: null,
      health: 85, energy: 90, stress: 20, hunger: 0,
      cash: 0, trust: 0, epf: 0, inv: { idx: 0, spd: 0, cost: 0 }, debt: { study: 0, studyOrig: 0 },
      arrears: 0, bankruptUntil: -1,
      shares: {}, manages: -1, bizFailures: 0,
      quals: [], enrol: null, job: null, retired: false,
      xp: { manual: 0, technical: 0, office: 0, sales: 0, medical: 0, business: 0 },
      tiers: { food: 1, housing: 1, transport: 0, leisure: 1 }, homeId: -1, isHead: true, housingWantMonths: 0,
      mcost: 0, incomeEMA: 0, monthIncome: 0,
      pregnancy: null, lastBirthDay: -99999,
      upbringing: 0.5, careSessions: 0, unpaidCare: 0,
      injuredUntil: -1, ideaUntil: -1, lastEnrollTry: -99999, lastBizTry: -99999, lastInvestDay: -99999,
      earned: { wages: 0, gigs: 0, business: 0, invest: 0, inherit: 0, gifts: 0, interest: 0, welfare: 0, luck: 0 },
      nw: 0, peakNw: 0, milestones: [], log: [], nwHist: [], attHist: [],
      plan: null, why: null, friends: 0,
    };
  };

  P.age = (w, p) => ((p.deathDay !== null ? p.deathDay : w.day) - p.birthDay) / 365;
  P.name = p => `${p.first} ${p.last}`;
  P.isAdult = (w, p) => p.alive && P.age(w, p) >= w.cfg.adultAge;
  P.isBachelor = q => C.BACHELORS.includes(q);

  P.hasCred = function (p, req) {
    if (!req) return true;
    if (req === 'BACH') return p.quals.some(P.isBachelor);
    return p.quals.includes(req);
  };
  // Qualifications beyond the job's minimum (capped bonus in hiring).
  P.extraQuals = (p, req) => Math.max(0, p.quals.length - (req ? 1 : 0));

  P.prestige = function (p) {
    let s = 0;
    for (const cat of C.TIER_CATS) s += C.TIERS[cat][p.tiers[cat]].prestige || 0;
    return s;
  };

  P.invValue = (w, p) => Math.round(p.inv.idx * w.market.idx + p.inv.spd);

  P.bizValue = function (w, p) {
    let v = 0;
    for (const id in p.shares) {
      const b = w.biz[id];
      if (b && b.open) v += Math.round(b.equity * p.shares[id]);
    }
    return v;
  };

  // Real net worth (sen). Business cash is counted once, inside business equity.
  P.netWorth = (w, p) => p.cash + p.trust + p.epf + P.invValue(w, p) + P.bizValue(w, p) - p.debt.study;

  // imp: 0 = personal history only, 1 = also town feed, 2 = notable, 3 = headline
  P.log = function (w, p, text, cat, imp) {
    const e = { day: w.day, text, cat, imp: imp || 0 };
    p.log.push(e);
    if (p.log.length > 300) {
      const idx = p.log.findIndex(x => x.imp === 0);
      p.log.splice(idx >= 0 ? idx : 0, 1);
    }
    if (imp >= 1) w.pushFeed({ day: w.day, pid: p.id, text, cat, imp });
  };

  P.makeLook = function (rng, eth, sex) {
    return {
      skin: rng.pick(C.SKIN[eth]),
      hair: rng.pick(C.HAIR),
      shirt: rng.pick(C.SHIRTS),
      pants: rng.pick(C.PANTS),
      // 0 short, 1 long hair, 2 bun, 3 tudung (headscarf)
      style: sex === 'F' ? (eth === 'malay' && rng.chance(0.6) ? 3 : rng.pick([1, 1, 2])) : 0,
      scarf: rng.pick(C.SCARVES),
    };
  };

  P.chooseStrategy = function (rng, p, exclude) {
    const pr = p.pers, n = k => (pr[k] - 50) / 50;
    const age = p._ageHint || 25;
    const weights = {
      WORK: 1 + 0.5 * n('resp'),
      EDU: 0.8 + 0.6 * (n('pat') + n('dis')) + 0.15 * (p.att[C.INT] - 5) - (age > 28 ? 0.5 : 0),
      SPEC: 0.8 + 0.6 * n('dis'),
      ENT: 0.6 + 1.0 * n('risk'),
      INV: 0.6 + 0.5 * n('pat') + 0.2 * n('risk'),
      BAL: 1.0,
    };
    const keys = C.STRATEGIES.filter(s => s !== exclude);
    const idx = rng.weighted(keys.map(k => Math.max(0.05, weights[k])));
    return keys[Math.max(0, idx)];
  };
})(globalThis.LES = globalThis.LES || {});
