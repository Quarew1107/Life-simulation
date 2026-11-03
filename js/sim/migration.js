// Migration. Each month the town gets a living-pressure score (crowding, rent,
// unemployment, recession) and an opportunity score (open jobs per jobseeker,
// booms, spare housing). Households decide individually whether to move out
// (pushed by pressure and personal hardship, held back by family and business
// roots). Newcomers arrive at a town-level rate driven by attractiveness. People
// who left keep living off-screen: they age, may die (children in town inherit)
// and may rarely return. Money crossing the town border uses the ABROAD account.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance, Fa = LES.Family;
  const Mi = LES.Migration = {};

  Mi.indicators = function (w) {
    let labour = 0, unemployed = 0;
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.retired || p.enrol || P.age(w, p) >= 64) continue;
      labour++;
      if (!p.job && p.manages < 0) unemployed++;
    }
    const unemp = labour ? unemployed / labour : 0;
    const rent = U.sum(w.rentMult) / w.rentMult.length;
    const pressure = U.clamp(2 * Math.max(0, w.crowding - 0.8) + 0.6 * Math.max(0, rent - 1) + 2 * unemp + (w.regime === 'recession' ? 0.3 : 0), 0, 3);
    const opportunity = U.clamp(0.5 * w.vacancies.length / (unemployed + 3) + (w.regime === 'growth' ? 0.3 : w.regime === 'recession' ? -0.2 : 0) + 0.6 * Math.max(0, 0.9 - w.crowding), 0, 3);
    const attract = U.clamp(0.5 + opportunity - 0.8 * pressure, 0, 3);
    return { pressure, opportunity, attract, unemp, crowding: w.crowding, rent };
  };

  Mi.monthly = function (w) {
    const ind = Mi.indicators(w);
    w.townMood = ind;
    const mult = w.derived.migMult;
    const R = w.rng.migration;
    Mi.awayMonth(w, ind);
    if (!mult) return;

    // ---- Moving out (household heads and singles decide) ----
    const outBase = C.MIG_BASE_OUT * mult * w.cfg.migOutMult;
    for (const p of w.living) {
      if (!p.alive || p.away || !p.adult || !p.isHead) continue;
      if (p.inst || (p.partnerId !== null && w.people[p.partnerId].inst)) continue; // nobody leaves town from prison
      const age = P.age(w, p);
      const hardship = (!p.job && p.manages < 0 && !p.retired && age < 64 ? 1 : 0) + (p.stress > 70 ? 0.5 : 0) + (p.cash < p.mcost ? 1 : 0);
      const push = 1 + 1.5 * ind.pressure + Math.max(0, 0.3 - ind.opportunity) + hardship + (p.cr ? p.cr.fear : 0); // fear of crime
      const minors = p.careOf.filter(id => w.people[id].alive).length;
      const parentsHere = p.parents.filter(id => { const q = w.people[id]; return q.alive && !q.away; }).length;
      const roots = 1 + 0.7 * (p.partnerId !== null ? 1 : 0) + 0.7 * Math.min(2, minors) + 0.5 * Math.min(2, parentsHere) + (p.manages >= 0 ? 2 : 0);
      const ageF = age < 35 ? 1.3 : age < 55 ? 0.8 : 0.4;
      const riskF = 0.7 + 0.6 * p.pers.risk / 100;
      if (R.next() < outBase * push * ageF * riskF / roots) {
        const reason = w.crowding > 0.95 || ind.rent > 1.15 ? 'the high cost of living'
          : hardship >= 1 || ind.unemp > 0.08 ? 'better job prospects elsewhere' : 'a fresh start in a bigger city';
        Mi.leave(w, p, reason);
      }
    }

    // ---- Moving in ----
    const lambda = C.MIG_BASE_IN * mult * w.cfg.migInMult * w.counts.adults * ind.attract;
    const n = R.poisson(lambda);
    for (let i = 0; i < n; i++) Mi.arrive(w);
  };

  // A household leaves: assets are cashed out and carried abroad.
  Mi.leave = function (w, head, reason) {
    const L = w.ledger;
    const adults = [head];
    if (head.partnerId !== null) {
      const q = w.people[head.partnerId];
      if (q.alive && !q.away) adults.push(q);
    }
    const ids = new Set(adults.map(a => a.id));
    const kids = [];
    for (const a of adults) {
      for (const cid of a.careOf) {
        const c = w.people[cid];
        if (!c.alive || c.away || kids.includes(c)) continue;
        if (c.caregivers.every(g => ids.has(g) || !w.people[g].alive)) kids.push(c);
        else {
          // Another caregiver stays in town: the child stays with them.
          c.caregivers = c.caregivers.filter(g => g !== a.id);
          a.careOf = a.careOf.filter(id => id !== c.id);
        }
      }
    }
    // Everyone leaving (children too: they may have inherited shares) cashes out.
    for (const a of [...adults, ...kids]) {
      if (a.job) LES.Labour.endJob(w, a, 'moved away', true);
      if (a.enrol) a.enrol = null;
      const wallet = a.adult ? 'cash' : 'trust';
      for (const k of Object.keys(a.shares)) {
        const b = w.biz[Number(k)];
        if (!b.open) continue;
        if (a.shares[k] >= 0.5) F.sellBiz(w, b, `owner moved away`);
        else {
          // Minority stake bought out by an outside investor; other owners keep the business.
          const pay = Math.round(b.equity * a.shares[k] * 0.7);
          L.pay('MARKET', a, wallet, pay);
          a.earned.business += pay;
          delete b.shares[a.id];
          delete a.shares[k];
          const rest = Object.keys(b.shares), sum = rest.reduce((s, id) => s + b.shares[id], 0);
          for (const id of rest) { b.shares[id] /= sum; w.people[Number(id)].shares[b.id] = b.shares[id]; }
          if (b.managerId === a.id) { b.managerId = -1; F.pickManager(w, b); }
        }
      }
      a.manages = -1;
      if (P.invValue(w, a) > 0) F.raiseCash(w, a, P.invValue(w, a) + 1, 'moving away');
      a.inv = { idx: 0, st: {}, cost: 0 };
      if (!a.adult) continue;
      const payDebt = Math.min(a.cash, a.debt.study);
      L.spend(a, 'cash', 'BANK', payDebt);
      a.debt.study -= payDebt;
    }
    // Remember who left today so the map can show them walking to the train.
    w.departures = (w.departures || []).filter(d => w.day - d.day < 3);
    for (const x of [...adults, ...kids]) w.departures.push({ id: x.id, home: x.homeId, day: w.day });
    for (const x of [...adults, ...kids]) Mi.exile(w, x, reason);
    P.log(w, head, `Moved away from ${C.TOWN_NAME} for ${reason}${adults.length > 1 || kids.length ? ` with ${adults.length - 1 + kids.length} family member${adults.length - 1 + kids.length > 1 ? 's' : ''}` : ''}`, 'migration', 1);
    w.stats.emigrants += adults.length + kids.length;
  };

  Mi.exile = function (w, p, reason) {
    const L = w.ledger;
    let wealth = 0;
    for (const k of ['cash', 'trust', 'epf']) { wealth += p[k]; L.spend(p, k, 'ABROAD', p[k]); }
    F.setHome(w, p, -1);
    p.away = { since: w.day, wealth, reason };
    p.plan = null; p.why = null;
    p.timesMoved++;
    p.nw = wealth - p.debt.study;
  };

  // Off-screen life: wealth drifts, people age and may die or come back.
  Mi.awayMonth = function (w, ind) {
    const R = w.rng.migration;
    const away = w.people.filter(p => p.alive && p.away);
    w.counts.away = away.length;
    for (const p of away) {
      p.away.wealth *= 1 + (0.02 + w.infl) / 12 + R.normal(0, 0.03);
      p.away.wealth = Math.max(0, p.away.wealth);
      p.nw = Math.round(p.away.wealth) - p.debt.study;
      const pYear = LES.mortalityYear(P.age(w, p), w.cfg.mortMult);
      if (R.next() < 1 - Math.pow(1 - pYear, 1 / 12)) { w.die(p, 'natural causes (abroad)'); continue; }
    }
    const mult = w.derived.migMult;
    if (!mult) return;
    const pRet = C.MIG_BASE_RETURN * mult * w.cfg.migInMult * U.clamp(ind.attract - 0.3, 0, 3);
    for (const p of away) {
      if (!p.alive || !p.away || !P.isAdult(w, p) || !p.isHead) continue;
      if (R.next() < pRet) Mi.returnHome(w, p);
    }
  };

  Mi.returnHome = function (w, head) {
    const R = w.rng.migration;
    const group = [head];
    if (head.partnerId !== null) { const q = w.people[head.partnerId]; if (q.alive && q.away) group.push(q); }
    for (const a of group.slice()) for (const cid of a.careOf) { const c = w.people[cid]; if (c.alive && c.away && !group.includes(c)) group.push(c); }
    const years = Math.max(1, Math.round((w.day - head.away.since) / 365));
    for (const p of group) {
      const amt = Math.max(0, Math.round(p.away.wealth * Math.exp(R.normal(0, 0.4))));
      p.away = null;
      w.ledger.pay('ABROAD', p, P.isAdult(w, p) ? 'cash' : 'trust', amt);
      p.retired = P.age(w, p) >= 65;
      p.incomeEMA = w.px(800);
    }
    for (const p of group) {
      if (!P.isAdult(w, p)) continue;
      if (!p.adult) { p.adult = true; Fa.comeOfAge(w, p); continue; }
      p.isHead = p === head || p.partnerId === null;
    }
    F.moveHome(w, head, 0, true);
    for (const p of group) if (p.adult) F.reviewTiers(w, p);
    P.log(w, head, `Returned to ${C.TOWN_NAME} after ${years} year${years > 1 ? 's' : ''} away`, 'migration', 1);
    w.stats.returns += group.length;
  };

  // Newcomers: random people drawn like founders (mostly young adults).
  Mi.arrive = function (w) {
    const R = w.rng.migration;
    const r = R.next();
    const ageA = R.int(18, 45);
    const a = w.makeAdult(R, { age: ageA, migrant: true });
    const members = [a];
    if (r > 0.55) {
      const b = w.makeAdult(R, { age: U.clamp(ageA + R.int(-5, 5), 18, 60), sex: a.sex === 'M' ? 'F' : 'M', migrant: true, eth: R.next() < 0.8 ? a.eth : null });
      b.last = R.next() < 0.5 ? b.last : a.last;
      a.partnerId = b.id; b.partnerId = a.id;
      const head = a.nw >= b.nw ? a : b, other = head === a ? b : a;
      head.isHead = true; other.isHead = false;
      members.push(b);
      if (r > 0.85) {
        const mother = a.sex === 'F' ? a : b, father = mother === a ? b : a;
        const maxKidAge = Math.min(12, Math.floor(P.age(w, mother)) - 19);
        const nKids = R.int(1, 2);
        for (let k = 0; k < nKids && maxKidAge >= 0; k++) members.push(w.makeChild(R, father, mother, R.int(0, maxKidAge)));
      }
    }
    const head = members.find(m => m.adult && m.isHead);
    F.reviewTiers(w, head);
    for (const m of members) {
      if (m === head) continue;
      if (m.adult) { m.tiers.housing = head.tiers.housing; F.setHome(w, m, head.homeId); F.reviewTiers(w, m); }
      else F.setHome(w, m, head.homeId);
    }
    for (const m of members) if (m.adult) m.mcost = F.monthlyCost(w, m);
    const extra = members.length - 1;
    P.log(w, head, `Moved to ${C.TOWN_NAME} aged ${Math.floor(P.age(w, head))}${extra ? ` with ${extra} family member${extra > 1 ? 's' : ''}` : ''}, bringing ${U.fmtMoney(members.reduce((s, m) => s + m.cash + m.trust, 0))}`, 'migration', 1);
    w.stats.immigrants += members.length;
  };
})(globalThis.LES = globalThis.LES || {});
