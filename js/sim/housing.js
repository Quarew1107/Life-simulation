// Home buying and mortgages (rules revision 13, Nov 2026; plan approved Nov 27 2026, step 1).
// - Units: every home building holds a number of household units (one per two residents' worth of room: a flat
//   block 20, a terrace row 6, a condo tower 20, a bungalow plot 3, a kampung house 2). A unit is owned by
//   a resident household or by the market (developers and outside landlords: the rented units, as before).
// - Prices: a home costs the country's number of years of its base rent (pack-independent table H.RULES), times
//   a price index per home level that drifts slowly with how full that level is, the economy's phase, interest
//   rates and a little chance. Homes are bought from and sold to the market (the MERCHANT sector) at that price.
// - Mortgages: the bank (BANK sector) lends the price minus the deposit, at the deposit rate plus the country's
//   margin, fixed for the loan, over at most the country's term and never past its end age. The bank lends only
//   to a household head with a steady job (a year or more), the deposit and a cushion in cash, and repayments at
//   most the country's share of household income. Owners pay the loan and a little upkeep instead of rent.
// - Who buys: household heads aged 23-60 who qualify, each month with a chance that grows with responsibility and
//   patience, a partner and children (falls with risk-taking). Owners trade up a level when they can.
// - Selling: when an owner moves house (any engine move), moves in with a partner who owns their home, leaves
//   town, or falls three months behind (the bank takes the home and sells it at 80%; no new loan for three years).
//   An owner who dies leaves the home to a partner living there (with the loan); otherwise it is sold and the
//   money goes into the estate. Starting towns begin with owners at about the country's ownership rate.
// Money always moves through the ledger; a home's value minus its loan counts in net worth (P.netWorth). Older
// rules revisions never call any of this (p.own is never set), so their histories and fingerprints are unchanged.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const H = LES.Housing = {};
  H.REV = 13;
  H.on = w => !!w && !!w.cfg && w.cfg.rulesRev >= H.REV && w.cfg.homeBuy !== 'off' && !!w.town && !!w.town.homesByTier;
  // years: price in years of base rent per level (kampung, flat, terrace, condo, big house); deposit share; term
  // (years); endAge: loan paid off by; spread over the deposit rate; dsr: most of household income for repayments;
  // outright0: share of starting kampung-level owners with no loan; target: starting share of households owning.
  H.RULES = {
    my: { years: [20, 19, 19, 18, 20], deposit: 0.1, term: 35, endAge: 70, spread: 0.017, dsr: 0.35, outright0: 0.8, target: 0.75 },
    uk: { years: [16, 19, 18, 17, 12], deposit: 0.1, term: 30, endAge: 75, spread: 0.02, dsr: 0.35, outright0: 0.3, target: 0.65 },
    us: { years: [9, 15, 15, 15, 12], deposit: 0.1, term: 30, endAge: 85, spread: 0.025, dsr: 0.36, outright0: 0.5, target: 0.65 },
    cn: { years: [26, 28, 30, 30, 28], deposit: 0.2, term: 30, endAge: 70, spread: 0.008, dsr: 0.5, outright0: 0.6, target: 0.9 },
  };
  H.rules = w => H.RULES[LES.Countries.of(w.cfg)] || H.RULES.my;
  H.UPKEEP = 0.004;  // a year, share of the home's value
  H.REPO_AT = 0.8;   // the bank sells a taken home at this share of its value
  H.MISS_MAX = 3;    // months behind before the bank takes the home
  H.NO_LOAN_DAYS = 3 * 365;

  const st = w => w.hous || (w.hous = { px: [1, 1, 1, 1, 1], owned: {}, stats: { bought: 0, sold: 0, repo: 0, inherited: 0, upgraded: 0 } });
  const rng = w => w.rng.housing || (w.rng.housing = new LES.RNG(`${w.cfg.seed}|housing`));
  H.units = b => Math.max(1, Math.ceil(b.cap / 2));
  const owned = (w, id) => st(w).owned[id] || 0;
  const freeHome = (w, tier) => {
    let best = -1, bestFill = Infinity;
    for (const id of w.town.homesByTier[tier] || []) {
      const b = w.town.buildings[id];
      if (owned(w, id) >= H.units(b)) continue;
      const fill = (w.occupancy[id] || 0) / b.cap;
      if (fill < bestFill) { bestFill = fill; best = id; }
    }
    return best;
  };
  // The price of a home of this level today (sen, rounded to a thousand).
  H.price = function (w, tier) {
    const F = LES.Finance, rent = F.tierCost(w, 'housing', tier) / (w.rentMult[tier] || 1);
    return Math.round(rent * 12 * H.rules(w).years[tier] * st(w).px[tier] / 100000) * 100000;
  };
  H.value = (w, p) => (p.own ? H.price(w, p.own.tier) : 0);
  H.equity = (w, p) => (p.own ? H.value(w, p) - (p.debt.mortgage || 0) : 0);
  H.rateNow = w => (w.gov && LES.Fiscal.depositRate ? LES.Fiscal.depositRate(w) : w.macro().depositRate + 0.9 * w.infl) + H.rules(w).spread;
  H.payment = (loan, rate, years) => { const r = rate / 12, n = Math.max(1, Math.round(years * 12)); return loan <= 0 ? 0 : Math.round(r > 0 ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n); };
  H.upkeep = (w, p) => Math.round(H.value(w, p) * H.UPKEEP / 12);
  // An owner's monthly housing cost (instead of rent): the loan's repayment and the upkeep.
  H.ownerCost = (w, p) => (p.own ? (p.debt.mortgage > 0 && p.mort ? Math.min(p.mort.monthly, Math.round(p.debt.mortgage * (1 + p.mort.rate / 12))) : 0) + H.upkeep(w, p) : 0);
  const household = (w, p) => { const out = [p]; const q = p.partnerId !== null ? w.people[p.partnerId] : null; if (q && q.alive && !q.away) out.push(q); return out; };
  const income = (w, p) => household(w, p).reduce((a, q) => a + Math.max(0, q.incomeEMA), 0);
  const steady = (w, p) => household(w, p).some(q => (q.job && w.day - q.job.startDay >= 365) || q.manages >= 0);

  // Could this household buy a home of this level now? Returns { ok, why, price, loan, monthly, years, rate }.
  // opt.cash: the cash they would have (an owner counting the sale); opt.seller: an owner asking before selling.
  H.quote = function (w, p, tier, opt) {
    const o = opt || {}, RU = H.rules(w), price = H.price(w, tier), age = P.age(w, p), years = Math.min(RU.term, RU.endAge - age);
    const deposit = Math.round(price * RU.deposit), loan = price - deposit, rate = H.rateNow(w), monthly = H.payment(loan, rate, years);
    const out = { ok: false, price, deposit, loan, monthly, years, rate }, cash = o.cash !== undefined ? o.cash : LES.Finance.liquid(w, p); // savings they can reach (cash, investments, Malaysia's EPF flexible account)
    if (p.own && !o.seller) out.why = 'owner';
    else if (!P.isAdult(w, p) || !p.isHead || p.away || p.inst) out.why = 'not_head';
    else if (p.noLoanUntil > w.day) out.why = 'no_credit';
    else if (years < 10) out.why = 'too_old';
    else if (!steady(w, p)) out.why = 'no_steady_job';
    else if (cash < deposit + Math.max(p.mcost, w.px(500))) out.why = 'no_deposit';
    else if (monthly + (p.debt.study > 0 ? Math.round(p.debt.study / 120) : 0) > RU.dsr * income(w, p)) out.why = 'income';
    else if (freeHome(w, tier) < 0) out.why = 'none_for_sale';
    else out.ok = true;
    return out;
  };

  // Move a household into a given home (head, partner, the children they care for).
  function moveTo(w, p, tier, homeId) {
    const F = LES.Finance;
    for (const h of household(w, p)) {
      h.tiers.housing = tier; F.setHome(w, h, homeId);
      for (const cid of h.careOf) { const c = w.people[cid]; if (c.alive && !c.away && c.homeId !== homeId) F.setHome(w, c, homeId); }
    }
    p.housingWantMonths = 0;
  }
  H.buy = function (w, p, tier, how) {
    const q = H.quote(w, p, tier);
    if (!q.ok) return q;
    const L = w.ledger, home = freeHome(w, tier), was = p.tiers.housing;
    if (p.cash < q.deposit) LES.Finance.raiseCash(w, p, q.deposit - p.cash, 'a home deposit');
    if (!L.spend(p, 'cash', 'MERCHANT', q.deposit)) return Object.assign(q, { ok: false, why: 'no_deposit' });
    L.move(L.sec.BANK, 'bal', L.sec.MERCHANT, 'bal', q.loan); // the bank pays the seller
    p.debt.mortgage = q.loan; p.debt.mortgageOrig = q.loan;
    p.mort = { rate: q.rate, monthly: q.monthly, start: w.day, end: w.day + Math.round(q.years * 365), missed: 0 };
    p.own = { tier, home, paid: q.price, day: w.day };
    st(w).owned[home] = owned(w, home) + 1;
    moveTo(w, p, tier, home);
    p.mcost = LES.Finance.monthlyCost(w, p);
    st(w).stats.bought++;
    const n = C.TIERS.housing[tier].name;
    P.log(w, p, `${how === 'up' ? 'Moved up and bought' : 'Bought'} a home (${n.toLowerCase()}) for ${U.fmtMoney(q.price)} with a ${U.fmtMoney(q.loan)} loan`, 'money', tier >= 3 || how === 'up' ? 1 : 0);
    if (was !== tier && how !== 'up') w.stats.homeMoves = (w.stats.homeMoves || 0) + 1;
    return q;
  };
  // Give up the home: the market buys it at `share` of its value; the loan is paid off first (a shortfall is written
  // off by the bank). The household stays where it is, now renting, until it moves. Returns the cash left.
  H.sell = function (w, p, why, share) {
    if (!p.own) return 0;
    const L = w.ledger, price = Math.round(H.value(w, p) * (share || 1)), debt = p.debt.mortgage || 0;
    L.pay('MERCHANT', p, 'cash', price);
    const pay = Math.min(p.cash, debt);
    if (pay > 0) L.spend(p, 'cash', 'BANK', pay);
    if (debt > pay) L.writeOffs += debt - pay;
    const s = st(w);
    s.owned[p.own.home] = Math.max(0, owned(w, p.own.home) - 1);
    if (!s.owned[p.own.home]) delete s.owned[p.own.home];
    const tier = p.own.tier, gain = price - p.own.paid;
    p.own = null; p.mort = null; p.debt.mortgage = 0; p.debt.mortgageOrig = 0;
    s.stats[why === 'repossessed' ? 'repo' : 'sold']++;
    if (why === 'repossessed') {
      p.noLoanUntil = w.day + H.NO_LOAN_DAYS;
      P.log(w, p, `The bank took the home back and sold it for ${U.fmtMoney(price)} (three months behind on the loan)`, 'money', 1);
    } else if (why !== 'estate') P.log(w, p, `Sold the home (${C.TIERS.housing[tier].name.toLowerCase()}) for ${U.fmtMoney(price)} (${gain >= 0 ? 'a gain' : 'a loss'} of ${U.fmtMoney(Math.abs(gain))}; ${why})`, 'money', 0);
    p.mcost = LES.Finance.monthlyCost(w, p);
    return price - pay;
  };

  // The month's housing bill for an owner (Finance.payBill): the loan's repayment, then the upkeep.
  H.payMonth = function (w, p) {
    const F = LES.Finance, L = w.ledger, m = p.mort, up = H.upkeep(w, p);
    let due = 0, interest = 0;
    if (p.debt.mortgage > 0 && m) { interest = Math.round(p.debt.mortgage * m.rate / 12); due = Math.min(m.monthly, p.debt.mortgage + interest); }
    const need = due + up;
    if (p.cash < need) F.raiseCash(w, p, need - p.cash, 'the home loan');
    if (due > 0) {
      if (p.cash >= due) {
        L.spend(p, 'cash', 'BANK', due);
        p.debt.mortgage = Math.max(0, p.debt.mortgage - (due - interest));
        m.missed = 0;
        if (p.debt.mortgage === 0) { P.log(w, p, 'Paid off the home loan', 'money', 1); p.mort = null; }
      } else {
        m.missed++;
        p.stress = Math.min(100, p.stress + 8);
        if (m.missed >= H.MISS_MAX) { H.sell(w, p, 'repossessed', H.REPO_AT); F.moveHome(w, p, Math.min(p.tiers.housing, 1), true); return; }
        if (m.missed === 1) P.log(w, p, 'Fell behind on the home loan', 'money', 0);
      }
    }
    if (up > 0) L.spend(p, 'cash', 'MERCHANT', Math.min(up, p.cash));
  };

  // A death (World.die, before the partner link is cleared): a partner living in the home keeps it, with the loan;
  // otherwise the home is sold and the money goes into the estate.
  H.onDeath = function (w, p) {
    if (!p.own) return;
    const q = p.partnerId !== null ? w.people[p.partnerId] : null;
    if (q && q.alive && !q.away && !q.inst && q.homeId === p.own.home && !q.own) {
      H.transfer(w, p, q);
      st(w).stats.inherited++;
      P.log(w, q, `Kept the family home after ${P.name(p)} died`, 'family', 0);
      return;
    }
    H.sell(w, p, 'estate');
  };
  // The home and its loan pass to someone living there (a partner after a death, or while the owner is held).
  H.transfer = function (w, p, q) {
    q.own = p.own; q.mort = p.mort; q.debt.mortgage = p.debt.mortgage || 0; q.debt.mortgageOrig = p.debt.mortgageOrig || 0;
    p.own = null; p.mort = null; p.debt.mortgage = 0; p.debt.mortgageOrig = 0;
    q.mcost = LES.Finance.monthlyCost(w, q);
  };
  // Prison or rehab (Crime's heldHome, before the home is handed over): someone at home keeps the home and its
  // loan; an owner living alone sells it (the money is theirs).
  H.onHeld = function (w, p, heir) {
    if (!p.own) return;
    if (heir && !heir.own) { H.transfer(w, p, heir); P.log(w, heir, `Took over the home and its loan while ${P.name(p)} is away`, 'money', 0); }
    else H.sell(w, p, 'going to prison or rehab');
  };

  // Each month (after people's own months): prices move, then households buy, trade up or sell.
  H.month = function (w) {
    const s = st(w), R = rng(w), RU = H.rules(w), regime = w.regime === 'growth' ? 1.04 : w.regime === 'recession' ? 0.93 : 1;
    const rateGap = (0.045 - (H.rateNow(w) - RU.spread)) * 2; // cheap money lifts prices a little
    for (let t = 0; t < s.px.length; t++) {
      const target = U.clamp((w.rentMult[t] || 1) * regime * (1 + rateGap), 0.6, 2.5);
      s.px[t] = U.clamp(s.px[t] + (target - s.px[t]) * 0.03 + R.normal(0, 0.006), 0.5, 3);
    }
    for (const p of w.living) {
      if (!p.alive || p.away || p.inst || !p.adult || !p.isHead) continue;
      const age = P.age(w, p), pr = p.pers, n = k => (pr[k] - 50) / 50;
      if (p.own) {
        // Behind on the loan with something left: sell before the bank takes it.
        if (p.mort && p.mort.missed >= 2 && H.equity(w, p) > 0) { H.sell(w, p, 'could not keep up the loan'); LES.Finance.moveHome(w, p, Math.min(p.tiers.housing, 1), true); continue; }
        // Trade up a level now and then, when the next level is affordable with the sale money.
        const up = p.own.tier + 1;
        if (up < C.TIERS.housing.length && age < 55 && R.next() < 0.006 * U.clamp(1 + 0.5 * n('risk') + 0.3 * (p.att[C.CHA] - 5) / 5, 0.2, 3)
          && H.quote(w, p, up, { cash: p.cash + Math.max(0, H.equity(w, p)), seller: true }).ok) {
          H.sell(w, p, 'moving up');
          if (H.buy(w, p, up, 'up').ok) s.stats.upgraded++; // (if the new loan fell through, they rent where they are)
        }
        continue;
      }
      if (age < 23 || age >= 60) continue;
      const tier = p.tiers.housing, chance = 0.08 * U.clamp(1 + 0.6 * n('resp') + 0.4 * n('pat') - 0.3 * n('risk') + (p.partnerId !== null ? 0.4 : 0) + (p.careOf.length ? 0.3 : 0), 0.2, 3);
      if (R.next() >= chance) continue;
      if (H.quote(w, p, tier).why === 'no_deposit') H.familyHelp(w, p, tier);
      if (H.quote(w, p, tier).ok) H.buy(w, p, tier);
      else if (tier > 0 && H.quote(w, p, tier - 1).ok && R.next() < 0.3) H.buy(w, p, tier - 1); // a smaller home they can afford
    }
  };

  // Parents with savings to spare may give an adult child the rest of a deposit (each keeps six months of their own
  // costs; likelier from responsible parents). Returns the amount given.
  H.familyHelp = function (w, p, tier) {
    const q = H.quote(w, p, tier, { cash: 0 }), need = q.deposit + Math.max(p.mcost, w.px(500)) - LES.Finance.liquid(w, p);
    if (need <= 0) return 0;
    const R = rng(w), F = LES.Finance, parents = p.parents.map(id => w.people[id]).filter(g => g && g.alive && !g.away && !g.inst).sort((a, b) => a.id - b.id);
    const spare = g => Math.max(0, F.liquid(w, g) - 6 * Math.max(g.mcost, w.px(500)));
    if (!parents.length || parents.reduce((a, g) => a + spare(g), 0) < need) return 0;
    if (R.next() >= U.clamp(0.25 + 0.5 * parents.reduce((a, g) => a + g.pers.resp, 0) / parents.length / 100, 0.1, 0.8)) return 0;
    let given = 0;
    for (const g of parents) {
      const amt = Math.min(need - given, spare(g));
      if (amt <= 0) continue;
      if (g.cash < amt) F.raiseCash(w, g, amt - g.cash, 'helping with a home deposit');
      const pay = Math.min(amt, g.cash);
      if (pay > 0 && w.ledger.move(g, 'cash', p, 'cash', pay)) { given += pay; p.earned.gifts += pay; }
      if (given >= need) break;
    }
    if (given > 0) { P.log(w, p, `Parents helped with a home deposit (${U.fmtMoney(given)})`, 'family', 0); st(w).stats.helped = (st(w).stats.helped || 0) + 1; }
    return given;
  };

  // A starting town: households own their homes at about the country's rate, more of the older ones; most of
  // the oldest and many kampung-level homes have no loan left; the rest are part-way through a loan.
  H.initOwners = function (w) {
    const s = st(w), R = rng(w), RU = H.rules(w), rate = H.rateNow(w);
    const heads = w.people.filter(p => p.alive && !p.away && p.adult && p.isHead && p.homeId >= 0).sort((a, b) => a.id - b.id);
    const fOf = p => U.clamp((P.age(w, p) - 20) / 15, 0.25, 1.2), mean = heads.length ? heads.reduce((a, p) => a + fOf(p), 0) / heads.length : 1;
    for (const p of heads) {
      const age = P.age(w, p), tier = p.tiers.housing, b = w.town.buildings[p.homeId];
      if (!b || owned(w, p.homeId) >= H.units(b)) continue;
      if (R.next() >= Math.min(0.97, RU.target * fOf(p) / mean)) continue; // the country's share overall, more of the older
      const price = H.price(w, tier), boughtAt = Math.max(23, age - R.range(0, Math.max(0, age - 23))), years = Math.min(RU.term, RU.endAge - boughtAt);
      const loan0 = Math.round(price * (1 - RU.deposit)), done = (age - boughtAt) / Math.max(1, years);
      p.own = { tier, home: p.homeId, paid: price, day: w.day };
      s.owned[p.homeId] = owned(w, p.homeId) + 1;
      if (age >= 60 || done >= 1 || (tier === 0 && R.next() < RU.outright0)) { p.debt.mortgage = 0; p.mort = null; }
      else {
        const left = years - (age - boughtAt), monthly = H.payment(loan0, rate, years), r = rate / 12, k = Math.round((age - boughtAt) * 12);
        const bal = Math.round(r > 0 ? loan0 * Math.pow(1 + r, k) - monthly * (Math.pow(1 + r, k) - 1) / r : loan0 - monthly * k);
        p.debt.mortgage = Math.max(0, bal); p.debt.mortgageOrig = loan0;
        p.mort = p.debt.mortgage > 0 ? { rate, monthly, start: w.day, end: w.day + Math.round(left * 365), missed: 0 } : null;
      }
      p.mcost = LES.Finance.monthlyCost(w, p);
    }
  };

  // Invariants (World.checkInvariants): units are not over-owned; owners are living heads in their own home.
  H.check = function (w) {
    const errs = [], s = w.hous;
    if (!s) return errs;
    const count = {};
    for (const p of w.people) {
      if (!p.own) { if (p.debt.mortgage > 0) errs.push(`P${p.id} has a home loan but no home`); continue; }
      if (!p.alive || p.away) errs.push(`P${p.id} owns a home while ${p.alive ? 'away' : 'dead'}`);
      if (p.homeId !== p.own.home) errs.push(`P${p.id} owns home ${p.own.home} but lives in ${p.homeId}`);
      if (!(Number.isInteger(p.debt.mortgage || 0) && (p.debt.mortgage || 0) >= 0)) errs.push(`P${p.id} mortgage ${p.debt.mortgage}`);
      count[p.own.home] = (count[p.own.home] || 0) + 1;
    }
    for (const id of Object.keys(count)) {
      if (count[id] !== (s.owned[id] || 0)) errs.push(`home ${id}: ${count[id]} owners, ${s.owned[id] || 0} counted`);
      if (count[id] > H.units(w.town.buildings[id])) errs.push(`home ${id} over-owned`);
    }
    return errs;
  };
  // Town figures (for the report and tests): share of households owning, prices, loans.
  H.summary = function (w) {
    const heads = w.living.filter(p => p.alive && !p.away && p.adult && p.isHead);
    const own = heads.filter(p => p.own), loans = own.filter(p => p.debt.mortgage > 0);
    return { households: heads.length, owners: own.length, rate: heads.length ? own.length / heads.length : 0, withLoan: loans.length, px: st(w).px.slice(), prices: C.TIERS.housing.map((_, t) => H.price(w, t)), stats: Object.assign({}, st(w).stats) };
  };
})(globalThis.LES = globalThis.LES || {});
