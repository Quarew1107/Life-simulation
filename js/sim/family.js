// Families: meeting partners, couples, conception, pregnancy, twins, independent
// care decisions, upbringing, coming of age, death and per-parent estates.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance;
  const Fa = LES.Family = {};

  Fa.related = function (w, a, b) {
    if (a.parents.includes(b.id) || b.parents.includes(a.id)) return true;
    for (const x of a.parents) {
      if (b.parents.includes(x)) return true; // siblings / half-siblings
      const gp = w.people[x];
      if (gp.parents.includes(b.id)) return true; // grandparent
    }
    for (const x of b.parents) if (w.people[x].parents.includes(a.id)) return true;
    return false;
  };

  // People who socialised at the same place and time can meet and become a couple.
  Fa.matchSocial = function (w) {
    const R = w.rng.family;
    for (const pool of w.socialPools.values()) {
      const singles = [], ages = [];
      for (const id of pool) {
        const p = w.people[id];
        if (!p.alive || p.partnerId !== null) continue;
        const age = P.age(w, p);
        if (age >= 18 && age <= 55) { singles.push(p); ages.push(age); }
      }
      for (let i = 0; i < singles.length; i++) {
        const a = singles[i];
        if (a.partnerId !== null) continue;
        a.friends++;
        for (let k = 0; k < 3; k++) {
          const j = Math.floor(R.next() * singles.length), b = singles[j];
          if (b === a || b.sex === a.sex || b.partnerId !== null) continue;
          const ageGap = Math.abs(ages[i] - ages[j]);
          if (ageGap > 15 || Fa.related(w, a, b)) continue;
          // Strangers need time: chances grow as both have socialised more.
          const familiarity = Math.min(1, Math.min(a.friends, b.friends) / 20);
          if (familiarity <= 0) { R.next(); continue; } // the roll still happens (keeps every run identical)
          // Moderate status matching: very different fortunes make a match less likely.
          const gapW = Math.abs(Math.log10(Math.max(U.RM(1e4), a.nw) / Math.max(U.RM(1e4), b.nw)));
          const compat = U.clamp(1.2 - ageGap / 10 + 0.06 * ((a.att[C.CHA] + b.att[C.CHA]) / 2 - 5) + 0.1 * (P.prestige(a) + P.prestige(b)) / 2 - 0.12 * gapW, 0.1, 2);
          const want = (0.5 + a.famDesire / 100) * (0.5 + b.famDesire / 100);
          if (R.next() < 0.012 * compat * want * familiarity * w.sysMul('coupleWeight', a, b)) { Fa.formCouple(w, a, b); break; }
        }
      }
    }
    w.socialPools.clear();
  };

  Fa.formCouple = function (w, a, b) {
    a.partnerId = b.id; b.partnerId = a.id;
    const head = a.nw >= b.nw ? a : b, other = head === a ? b : a;
    other.isHead = false;
    head.isHead = true;
    other.tiers.housing = head.tiers.housing;
    F.setHome(w, other, head.homeId);
    for (const cid of other.careOf) { const c = w.people[cid]; if (c.alive) F.setHome(w, c, head.homeId); }
    other.mcost = F.monthlyCost(w, other);
    P.log(w, a, `Became partners with ${P.name(b)}`, 'family', 1);
    P.log(w, b, `Became partners with ${P.name(a)}`, 'family', 0);
    w.stats.couples++;
    for (const s of w.sys.coupled) s.coupled(w, a, b);
  };

  Fa.separate = function (w, a, b, reason) {
    a.partnerId = null; b.partnerId = null;
    a.exPartners.push(b.id); b.exPartners.push(a.id);
    const leaver = a.isHead ? b : a;
    a.isHead = true; b.isHead = true;
    if (reason === 'breakup') {
      F.moveHome(w, leaver, Math.min(leaver.tiers.housing, 1), true);
      P.log(w, a, `Separated from ${P.name(b)}`, 'family', 1);
      P.log(w, b, `Separated from ${P.name(a)}`, 'family', 0);
      w.stats.breakups++;
    }
    a.mcost = F.monthlyCost(w, a); b.mcost = F.monthlyCost(w, b);
  };

  const fertility = age => age < 18 ? 0 : age <= 30 ? 1 : age <= 45 ? 1 - (age - 30) / 15 : 0;
  const resourceScore = nwSen => U.clamp((Math.log10(Math.max(100, nwSen / 100)) - 4) / 2, -1, 1);
  const minorChildren = (w, p) => p.children.filter(id => { const c = w.people[id]; return c.alive && P.age(w, c) < 18; }).length;

  // FSD 8.7: each partner independently decides; both must want a child.
  Fa.desire = function (w, p) {
    const fd = (p.famDesire - 50) / 50, st = (p.stress - 50) / 50;
    return U.sigmoid(-0.5 + 2.2 * fd + 0.8 * resourceScore(p.nw) - 0.7 * minorChildren(w, p) - 1.2 * Math.max(0, st) + LES.Goals.familyBoost(p));
  };

  Fa.monthCouples = function (w) {
    const R = w.rng.family;
    for (const p of w.living) {
      if (!p.alive || p.partnerId === null || p.sex !== 'F') continue;
      const q = w.people[p.partnerId];
      // Breakups
      const avgStress = (p.stress + q.stress) / 200;
      if (R.next() < (0.0012 + 0.008 * avgStress * avgStress) * w.sysMul('breakupWeight', p, q)) { Fa.separate(w, p, q, 'breakup'); continue; }
      // Conception
      if (p.pregnancy || p.inst || q.inst || w.day - p.lastBirthDay < w.cfg.birthSpacingDays || P.age(w, q) > 65) continue;
      const fert = fertility(P.age(w, p));
      if (fert <= 0) continue;
      if (R.next() < Fa.desire(w, p) && R.next() < Fa.desire(w, q) && R.next() < 0.11 * fert * w.derived.fertMult) {
        p.pregnancy = { father: q.id, due: w.day + w.cfg.gestationDays, twins: R.next() < w.cfg.twinProb };
        P.log(w, p, 'Is expecting a baby', 'family', 0);
      }
    }
  };

  Fa.inheritAttrs = function (w, mother, father) {
    const R = w.rng.family, pot = [];
    for (let i = 0; i < 6; i++) {
      let v;
      if (w.cfg.genetics === 'original') {
        v = Math.floor((father.att[i] + mother.att[i]) / 2); // FSD 8.3 original rule
      } else {
        const mean = (father.pot[i] + mother.pot[i]) / 2;
        const base = Math.floor(mean) + (R.next() < mean - Math.floor(mean) ? 1 : 0); // unbiased stochastic rounding
        v = base + R.normal(0, 0.6);
      }
      pot.push(U.clamp(v, 0, 10));
    }
    return pot;
  };

  Fa.acceptCare = function (w, parent) {
    if (!parent.alive || !P.isAdult(w, parent)) return false;
    const resp = (parent.pers.resp - 50) / 50;
    const resStress = U.clamp(-resourceScore(parent.nw), 0, 1);
    const p = U.clamp(U.sigmoid(1.6 + 2.4 * resp - 1.0 * resStress - 0.25 * minorChildren(w, parent) + LES.Goals.careBoost(parent)), 0.05, 0.99);
    return w.rng.family.next() < p;
  };

  Fa.birth = function (w, mother) {
    const R = w.rng.family, preg = mother.pregnancy, father = w.people[preg.father];
    mother.pregnancy = null;
    mother.lastBirthDay = w.day;
    const n = preg.twins ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const c = w.makeChild(R, father, mother, 0);
      w.stats.births++;
      if (n === 2 && k === 0) w.stats.twins++;

      // Independent care decisions per parent (FSD 8.4).
      const accepted = [mother, father].filter(par => !par.inst && Fa.acceptCare(w, par)); // a parent in prison cannot care
      const twinTxt = n === 2 ? ' (twins!)' : '';
      for (const par of [mother, father]) {
        if (!par.alive) continue;
        const other = par === mother ? father : mother;
        if (accepted.includes(par)) P.log(w, par, `Welcomed baby ${c.first}${twinTxt} with ${P.name(other)}`, 'family', par === mother ? 1 : 0);
        else if (par.inst) P.log(w, par, `Baby ${c.first}${twinTxt} was born while they were ${par.inst.kind === 'rehab' ? 'in rehab' : 'in prison'}`, 'family', 1);
        else P.log(w, par, `Refused to care for newborn ${c.first}`, 'family', 1);
      }
      if (accepted.length) {
        for (const par of accepted) Fa.addCare(w, par, c);
        F.setHome(w, c, accepted[0].homeId);
      } else if (!Fa.findGuardian(w, c, 'newborn')) {
        continue; // child already died under harsh rules
      }
    }
    for (const par of [mother, father]) if (par.alive) par.mcost = F.monthlyCost(w, par);
  };

  Fa.addCare = function (w, adult, child) {
    if (!adult.careOf.includes(child.id)) adult.careOf.push(child.id);
    if (!child.caregivers.includes(adult.id)) child.caregivers.push(adult.id);
    adult.mcost = F.monthlyCost(w, adult);
  };

  // Relatives may step in; otherwise welfare (if enabled) or the harsh rule applies.
  Fa.findGuardian = function (w, c, situation) {
    const tried = new Set(c.caregivers);
    if (situation === 'newborn') for (const pid of c.parents) tried.add(pid); // parents already refused
    const candidates = [];
    for (const pid of c.parents) {
      const par = w.people[pid];
      candidates.push(par);
      for (const gp of par.parents) candidates.push(w.people[gp]);
      for (const sib of par.children) candidates.push(w.people[sib]);
    }
    for (const g of candidates) {
      if (!g || g.id === c.id || tried.has(g.id) || !P.isAdult(w, g) || g.away || g.inst) continue;
      tried.add(g.id);
      if (Fa.acceptCare(w, g)) {
        Fa.addCare(w, g, c);
        F.setHome(w, c, g.homeId);
        P.log(w, g, `Took in ${P.name(c)} as guardian`, 'family', 1);
        if (g.goal && g.goal.id === 'HELPER') g.donated += w.px(g.goal.target); // raising a child in need fulfils it
        return true;
      }
    }
    if (w.derived.welfare) {
      c.guardian = 'WELFARE';
      F.setHome(w, c, w.town.byKind.welfare);
      P.log(w, c, 'Placed in the care of Rumah Kebajikan (welfare home)', 'family', 1);
      w.stats.welfareKids++;
      return true;
    }
    w.die(c, situation === 'newborn' ? 'abandoned at birth' : 'neglect after losing caregivers');
    return false;
  };

  Fa.daily = function (w) {
    for (const p of w.living) {
      if (!p.alive) continue;
      if (p.pregnancy && p.pregnancy.due <= w.day) Fa.birth(w, p);
    }
    Fa.matchSocial(w);
  };

  Fa.childMonth = function (w, c) {
    const age = P.age(w, c);
    if (c.guardian === 'WELFARE') {
      c.upbringing = c.upbringing * 0.97 + 0.03 * 0.45;
      w.ledger.move(w.ledger.sec.WELFARE, 'bal', w.ledger.sec.MERCHANT, 'bal', w.px(C.CHILD_COST));
      c.careSessions = 0; c.unpaidCare = 0;
      return;
    }
    c.caregivers = c.caregivers.filter(id => w.people[id].alive);
    if (!c.caregivers.length && !Fa.findGuardian(w, c, 'orphan')) return;
    if (c.guardian === 'WELFARE') return;
    const main = w.people[c.caregivers[0]];
    const adequacy = age < 12 ? Math.min(1, c.careSessions / 8) : 1;
    const paid = c.unpaidCare === 0 ? 1 : 0;
    const target = 0.35 * adequacy + 0.25 * main.tiers.food / 3 + 0.25 * main.tiers.housing / 4 + 0.15 * paid;
    c.upbringing = c.upbringing * 0.97 + 0.03 * target;
    if (!paid) c.health = Math.max(0, c.health - 5);
    c.careSessions = 0; c.unpaidCare = 0;
  };

  Fa.comeOfAge = function (w, c) {
    const R = w.rng.family;
    for (let i = 0; i < 6; i++) c.att[i] = U.clamp(c.pot[i] * (0.72 + 0.3 * c.upbringing) + R.normal(0, 0.3), 0, 10);
    c.peak = c.att.slice();
    c.pers.dis = Math.round(U.clamp(c.pers.dis + (c.upbringing - 0.5) * 20, 0, 100));
    c.pers.resp = Math.round(U.clamp(c.pers.resp + (c.upbringing - 0.5) * 16, 0, 100));
    for (const gid of c.caregivers) {
      const g = w.people[gid];
      g.careOf = g.careOf.filter(id => id !== c.id);
      if (g.alive) g.mcost = F.monthlyCost(w, g);
    }
    c.caregivers = [];
    c.guardian = null;
    const followers = c.parents.map(id => w.people[id]).filter(par => R.next() < 0.4);
    c._ageHint = 18;
    c.strategy = followers.length ? followers[0].strategy : P.chooseStrategy(R, c);
    LES.Goals.pick(w, c, 'adult');
    c.stratHist.push({ day: w.day, strategy: c.strategy, reason: followers.length ? 'followed a parent' : 'own choice' });
    if (c.trust > 0) w.ledger.move(c, 'trust', c, 'cash', c.trust);
    for (const pid of c.parents) {
      const par = w.people[pid];
      if (!par.alive || par.away || par.nw < w.px(50000)) continue;
      const gift = Math.round(par.cash * U.clamp(0.02 + 0.08 * par.pers.resp / 100, 0, 0.1));
      if (gift > 0 && w.ledger.move(par, 'cash', c, 'cash', gift)) {
        c.earned.gifts += gift;
        P.log(w, c, `Received ${U.fmtMoney(gift)} from ${P.name(par)} to start adult life`, 'family', 0);
      }
    }
    c.isHead = true;
    c.tiers = { food: 1, housing: 0, transport: 0, leisure: 0 };
    F.moveHome(w, c, 0, true);
    c.mcost = F.monthlyCost(w, c);
    P.log(w, c, `Turned 18 and started adult life (strategy: ${C.STRATEGY_NAMES[c.strategy]})`, 'family', 1);
  };

  // Estate at death (FSD 8.5): liquidate, pay debts, split equally between surviving
  // biological children (minors' shares go to trust), remainder sen by child ID.
  Fa.settleEstate = function (w, p) {
    if (w.cfg.rulesRev >= 3) return Fa.settleEstateV3(w, p); // C04b: equal value for every child, stakes in the estate
    const L = w.ledger;
    if (p.away) {
      // Died abroad: the wealth they took with them comes back as their estate.
      L.pay('ABROAD', p, 'cash', Math.round(p.away.wealth));
      p.away = null;
    }
    F.raiseCash(w, p, P.invValue(w, p) + 1, 'estate');
    p.inv = { idx: 0, st: {}, cost: 0 };
    if (p.epf > 0) L.move(p, 'epf', p, 'cash', p.epf);
    if (p.trust > 0) L.move(p, 'trust', p, 'cash', p.trust);
    const pay = Math.min(p.cash, p.debt.study);
    L.spend(p, 'cash', 'BANK', pay);
    L.writeOffs += p.debt.study - pay;
    p.debt.study = 0;

    const allow = w.policy && w.policy.estateTax > 0 ? w.px(LES.Countries.pack.tax.estateAllowance || 1e5) : 0; // tax-free amount (Malaysia's law option: RM100k; UK: GBP325k)
    if (w.policy && w.policy.estateTax > 0 && p.cash > allow) { // inheritance tax above the allowance
      const tax = Math.round((p.cash - allow) * w.policy.estateTax);
      L.spend(p, 'cash', 'TAX', tax);
      if (w.gov) { w.gov.estateTaxTotal += tax; LES.Fiscal.tag(w, 'inheritance tax', tax); }
    }
    const heirs = p.children.map(id => w.people[id]).filter(c => c.alive).sort((a, b) => a.id - b.id);
    const total = p.cash;
    const record = { day: w.day, decedent: p.id, total, heirs: heirs.map(h => h.id), amounts: [] };
    if (heirs.length) {
      const share = Math.floor(total / heirs.length);
      let rem = total - share * heirs.length;
      for (const h of heirs) {
        const amt = share + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
        if (h.away) {
          L.spend(p, 'cash', 'ABROAD', amt); // heir lives abroad: the share follows them
          const there = h.away.town !== undefined && w.region ? w.region.towns[h.away.town].people[h.away.id] : null;
          if (there && there.alive) w.region.towns[h.away.town].ledger.pay('ABROAD', there, P.isAdult(w.region.towns[h.away.town], there) ? 'cash' : 'trust', amt); // heir in a sister town
          else h.away.wealth += amt;
        } else {
          L.move(p, 'cash', h, P.isAdult(w, h) ? 'cash' : 'trust', amt);
        }
        h.earned.inherit += amt;
        record.amounts.push(amt);
        if (amt >= w.px(1000)) P.log(w, h, `Inherited ${U.fmtMoney(amt)} from ${P.name(p)}`, 'family', amt >= w.px(1e6) ? 2 : 1);
      }
    } else if (total > 0) {
      L.spend(p, 'cash', 'ESTATE', total);
    }
    w.estates.push(record);

    // Business shares pass to the heirs living in town.
    const localHeirs = heirs.filter(h => !h.away);
    for (const k of Object.keys(p.shares)) {
      const b = w.biz[Number(k)], frac = p.shares[k];
      delete p.shares[k];
      delete b.shares[p.id];
      if (localHeirs.length) {
        for (const h of localHeirs) {
          h.shares[b.id] = (h.shares[b.id] || 0) + frac / localHeirs.length;
          b.shares[h.id] = h.shares[b.id];
        }
      } else {
        const rest = Object.keys(b.shares);
        const sum = rest.reduce((s, id) => s + b.shares[id], 0);
        for (const id of rest) { b.shares[id] /= sum; w.people[Number(id)].shares[b.id] = b.shares[id]; }
      }
      if (!Object.keys(b.shares).length) { F.closeBiz(w, b, 'closed after the owner died with no heirs', false); continue; }
      if (b.managerId === p.id) { b.managerId = -1; F.pickManager(w, b); }
    }
    p.manages = -1;
  };

  // Rules revision 3 (C04b, owner-approved design): the whole estate is valued and shared equally in VALUE.
  // 1. Liquidate investments, pension and trust (as before). 2. Debts: study, then medical (US); what the estate
  // cannot pay is written off. 3. Value business stakes at the current valuation (b.equity). 4. Inheritance tax
  // on cash + stakes (pack tax.estateBusinessRelief: the UK's relief on business property) above the allowance,
  // paid from cash, then by selling part of a stake to the outside investor. 5. Every living child is entitled to
  // the same value: children living away are paid in cash (estate cash first, then stake slices sold to the
  // outside investor at full valuation, b.outsideShare); children in town share the rest of the cash and the
  // stakes equally. 6. No children: cash to ESTATE, stakes to the outside investor; a firm with no other
  // resident owner is sold. Settled once per person (p.estateSettled); one record per death in w.estates.
  Fa.settleEstateV3 = function (w, p) {
    if (p.estateSettled) return;
    p.estateSettled = true;
    const L = w.ledger, K = LES.Countries.pack;
    if (p.away) { L.pay('ABROAD', p, 'cash', Math.round(p.away.wealth)); p.away = null; }
    F.raiseCash(w, p, P.invValue(w, p) + 1, 'estate');
    p.inv = { idx: 0, st: {}, cost: 0 };
    if (p.epf > 0) L.move(p, 'epf', p, 'cash', p.epf);
    if (p.trust > 0) L.move(p, 'trust', p, 'cash', p.trust);
    const debts = { study: 0, medical: 0, writtenOff: 0 };
    const settle = (key, sector) => {
      const owed = p.debt[key] || 0;
      if (owed <= 0) return;
      const pay = Math.min(Math.max(0, p.cash), owed);
      if (pay > 0) L.spend(p, 'cash', sector, pay);
      debts[key] = pay; debts.writtenOff += owed - pay; L.writeOffs += owed - pay;
      p.debt[key] = 0;
    };
    settle('study', 'BANK');
    settle('medical', 'HEALTH'); p.medCollect = false;

    const stakes = Object.keys(p.shares).map(Number).sort((a, b) => a - b).map(id => ({ b: w.biz[id], frac: p.shares[id] })).filter(s => s.b && s.b.open);
    const stakeValue = () => stakes.reduce((a, s) => a + Math.round(s.frac * Math.max(0, s.b.equity)), 0);
    // Sell up to `want` sen of stakes to the outside investor at full valuation; returns the cash raised.
    const sellStakes = want => {
      let got = 0;
      for (const s of stakes) {
        if (got >= want) break;
        const eq = Math.max(0, s.b.equity);
        if (eq <= 0 || s.frac <= 0) continue;
        const f = Math.min(s.frac, (want - got) / eq), cash = Math.round(f * eq);
        if (cash <= 0) continue;
        s.frac -= f; s.b.outsideShare = (s.b.outsideShare || 0) + f;
        s.b.shares[p.id] = s.frac; p.shares[s.b.id] = s.frac; // keep both share maps in step
        L.pay('MARKET', p, 'cash', cash);
        got += cash;
      }
      return got;
    };

    let tax = 0;
    if (w.policy && w.policy.estateTax > 0) {
      const BR = K.tax.estateBusinessRelief, eq = stakeValue();
      const taxedEq = BR ? Math.max(0, eq - w.px(BR.full)) * BR.taxShare : eq;
      tax = Math.round(Math.max(0, Math.max(0, p.cash) + taxedEq - w.px(K.tax.estateAllowance || 1e5)) * w.policy.estateTax);
      if (tax > p.cash) sellStakes(tax - p.cash);
      tax = Math.min(tax, Math.max(0, p.cash)); // never more than the estate can pay
      if (tax > 0) { L.spend(p, 'cash', 'TAX', tax); if (w.gov) { w.gov.estateTaxTotal += tax; LES.Fiscal.tag(w, 'inheritance tax', tax); } }
    }

    const heirs = p.children.map(id => w.people[id]).filter(c => c.alive).sort((a, b) => a.id - b.id);
    const net = Math.max(0, p.cash) + stakeValue();
    const record = { day: w.day, decedent: p.id, total: net, heirs: heirs.map(h => h.id), amounts: [], equity: [], stakes: [], tax, debts, rev: 3 };
    const give = (h, amt) => {
      if (amt <= 0) return;
      if (h.away) {
        L.spend(p, 'cash', 'ABROAD', amt); // the share follows a child who lives away
        const there = h.away.town !== undefined && w.region ? w.region.towns[h.away.town].people[h.away.id] : null;
        if (there && there.alive) w.region.towns[h.away.town].ledger.pay('ABROAD', there, P.isAdult(w.region.towns[h.away.town], there) ? 'cash' : 'trust', amt);
        else h.away.wealth += amt;
      } else L.move(p, 'cash', h, P.isAdult(w, h) ? 'cash' : 'trust', amt);
      h.earned.inherit += amt;
    };

    const local = heirs.filter(h => !h.away), remote = heirs.filter(h => h.away);
    if (heirs.length) {
      const q = Math.floor(net / heirs.length); // each child's value in sen
      if (!local.length) sellStakes(Math.max(0, net - p.cash)); // nobody in town can hold the stakes
      else if (remote.length && remote.length * q > p.cash) sellStakes(remote.length * q - p.cash);
      const c0 = p.cash, cashNow = Math.max(0, p.cash), remotePay = remote.length ? Math.min(q, Math.floor(cashNow / remote.length)) : 0;
      for (const h of remote) give(h, remotePay);
      const left = Math.max(0, p.cash), each = local.length ? Math.floor(left / local.length) : 0;
      let rem = left - each * local.length;
      const got = new Map(remote.map(h => [h.id, remotePay]));
      for (const h of local) { const amt = each + (rem > 0 ? 1 : 0); if (rem > 0) rem--; give(h, amt); got.set(h.id, amt); }
      record.cash = c0 - p.cash; // measured from the account, checked against the per-heir amounts
      for (const h of heirs) {
        const cashGot = got.get(h.id), eqGot = h.away ? 0 : stakes.reduce((a, s) => a + Math.round(s.frac / local.length * Math.max(0, s.b.equity)), 0);
        record.amounts.push(cashGot); record.equity.push(eqGot);
        if (cashGot + eqGot >= w.px(1000)) P.log(w, h, `Inherited ${U.fmtMoney(cashGot + eqGot)} from ${P.name(p)}${eqGot > 0 ? ` (${U.fmtMoney(eqGot)} of it in business stakes)` : ''}`, 'family', cashGot + eqGot >= w.px(1e6) ? 2 : 1);
      }
    }
    if (p.cash > 0) L.spend(p, 'cash', 'ESTATE', p.cash); // no children (or sen left over)

    for (const s of stakes) {
      const b = s.b, others = Object.keys(b.shares).filter(id => Number(id) !== p.id).length;
      record.stakes.push({ biz: b.id, frac: s.frac, to: local.length ? 'children in town' : others ? 'outside investor' : 'sold' });
      if (!local.length && !others) { // nobody in town will own it: the estate sells the firm (the investor is paid its part)
        F.sellBiz(w, b, 'sold by the estate: no owner living in town');
        if (p.trust > 0) L.move(p, 'trust', p, 'cash', p.trust); // (a dead owner's sale money lands in trust)
        continue;
      }
      delete p.shares[b.id]; delete b.shares[p.id];
      if (s.frac > 0) {
        if (local.length) for (const h of local) { h.shares[b.id] = (h.shares[b.id] || 0) + s.frac / local.length; b.shares[h.id] = h.shares[b.id]; }
        else b.outsideShare = (b.outsideShare || 0) + s.frac; // no child: the outside investor takes the stake, other owners keep theirs
      }
      if (b.managerId === p.id) { b.managerId = -1; F.pickManager(w, b); }
    }
    if (p.cash > 0) L.spend(p, 'cash', 'ESTATE', p.cash); // a sale with no children: proceeds to the estate sector
    w.estates.push(record);
    p.manages = -1;
  };
})(globalThis.LES = globalThis.LES || {});
