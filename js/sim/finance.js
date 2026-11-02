// Money: living costs & lifestyle tiers, investments, businesses, loans, bankruptcy,
// the macro economy and random luck. Every cash flow goes through the ledger.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const F = LES.Finance = {};

  F.tierCost = (cat, t) => U.RM(C.TIERS[cat][t].cost);

  F.careShare = function (w, p) {
    let total = 0;
    for (const cid of p.careOf) {
      const c = w.people[cid];
      if (!c.alive) continue;
      const n = Math.max(1, c.caregivers.length);
      total += U.RM(C.CHILD_COST + C.CHILD_COST_PER_HOUSING * p.tiers.housing) / n;
    }
    return Math.round(total);
  };

  F.monthlyCost = function (w, p) {
    let c = F.tierCost('food', p.tiers.food) + F.tierCost('transport', p.tiers.transport) + F.tierCost('leisure', p.tiers.leisure);
    if (p.isHead) c += F.tierCost('housing', p.tiers.housing);
    return c + F.careShare(w, p);
  };

  // Sell investments to cover a shortfall. Returns cash raised.
  F.raiseCash = function (w, p, need) {
    let got = 0;
    if (need > 0 && p.inv.idx > 0) got += F.sell(w, p, 'idx', need);
    if (need - got > 0 && p.inv.spd > 0) got += F.sell(w, p, 'spd', need - got);
    return got;
  };

  // ---- Daily food ----
  F.dailyFood = function (w, p) {
    const L = w.ledger;
    const cost = Math.round(F.tierCost('food', p.tiers.food) / 30);
    if (p.cash < cost) F.raiseCash(w, p, cost - p.cash);
    if (p.cash >= cost) {
      L.spend(p, 'cash', 'MERCHANT', cost);
      p.hunger = Math.max(0, p.hunger - 40);
      return;
    }
    if (p.tiers.food > 0) { p.tiers.food = 0; p.mcost = F.monthlyCost(w, p); }
    const basic = Math.round(F.tierCost('food', 0) / 30);
    if (w.derived.welfare) {
      L.move(L.sec.WELFARE, 'bal', L.sec.MERCHANT, 'bal', basic);
      p.earned.welfare += basic;
      p.hunger = Math.max(0, p.hunger - 30);
      return;
    }
    const paid = Math.min(p.cash, basic);
    L.spend(p, 'cash', 'MERCHANT', paid);
    p.hunger += 35 * (1 - paid / basic);
    if (p.hunger > 60 && !p._hungryLogged) { p._hungryLogged = true; P.log(w, p, 'Cannot afford food and is going hungry', 'money', 1); }
    if (p.hunger < 20) p._hungryLogged = false;
  };

  F.payBill = function (w, p, cat) {
    const L = w.ledger, amt = F.tierCost(cat, p.tiers[cat]);
    if (!amt) return;
    if (p.cash < amt) F.raiseCash(w, p, amt - p.cash);
    if (p.cash >= amt) { L.spend(p, 'cash', 'MERCHANT', amt); return; }
    L.spend(p, 'cash', 'MERCHANT', p.cash);
    if (p.tiers[cat] > 0) {
      const from = C.TIERS[cat][p.tiers[cat]].name;
      if (cat === 'housing') F.moveHome(w, p, 0, true);
      else p.tiers[cat] = 0;
      P.log(w, p, `Could not afford ${from}; downgraded`, 'money', 1);
    } else {
      p.stress = Math.min(100, p.stress + 8);
      p.health = Math.max(0, p.health - 2);
    }
  };

  F.payChildren = function (w, p) {
    const L = w.ledger;
    for (const cid of p.careOf) {
      const c = w.people[cid];
      if (!c.alive) continue;
      const n = Math.max(1, c.caregivers.length);
      const amt = Math.round(U.RM(C.CHILD_COST + C.CHILD_COST_PER_HOUSING * p.tiers.housing) / n);
      if (p.cash < amt) F.raiseCash(w, p, amt - p.cash);
      if (L.spend(p, 'cash', 'MERCHANT', amt)) continue;
      if (w.derived.welfare) { L.move(L.sec.WELFARE, 'bal', L.sec.MERCHANT, 'bal', amt); p.earned.welfare += amt; }
      else c.unpaidCare++;
    }
  };

  // ---- Lifestyle tiers (monthly). Impatient people spend more of their income. ----
  F.reviewTiers = function (w, p) {
    const pat = (p.pers.pat - 50) / 50, dis = (p.pers.dis - 50) / 50;
    const spendRate = U.clamp(1.0 - 0.3 * pat - 0.15 * dis, 0.55, 1.1);
    let budget = p.incomeEMA * spendRate + Math.max(0, p.nw) * 0.004 - F.careShare(w, p);
    const t = { food: 0, housing: p.isHead ? 0 : p.tiers.housing, transport: 0, leisure: 0 };
    let cost = F.tierCost('food', 0) + F.tierCost('transport', 0) + F.tierCost('leisure', 0) + (p.isHead ? F.tierCost('housing', 0) : 0);
    const order = ['food', 'housing', 'transport', 'leisure', 'housing', 'food', 'leisure', 'transport', 'housing', 'food', 'housing', 'transport', 'leisure'];
    for (const cat of order) {
      if (cat === 'housing' && !p.isHead) continue;
      const next = t[cat] + 1;
      if (next >= C.TIERS[cat].length) continue;
      const delta = F.tierCost(cat, next) - F.tierCost(cat, t[cat]);
      if (cost + delta <= budget) { t[cat] = next; cost += delta; }
    }
    p.tiers.food = t.food; p.tiers.transport = t.transport; p.tiers.leisure = t.leisure;
    if (p.isHead && t.housing !== p.tiers.housing) {
      const cantAfford = p.cash < F.tierCost('housing', p.tiers.housing) && t.housing < p.tiers.housing;
      p.housingWantMonths++;
      if (p.housingWantMonths >= 3 || cantAfford || p.homeId < 0) F.moveHome(w, p, t.housing, false);
    } else {
      p.housingWantMonths = 0;
    }
    p.mcost = F.monthlyCost(w, p);
  };

  F.pickHome = function (w, tier) {
    const ids = w.town.homesByTier[tier];
    let best = ids[0], bestFill = Infinity;
    for (const id of ids) {
      const b = w.town.buildings[id];
      const fill = (w.occupancy[id] || 0) / b.cap;
      if (fill < bestFill) { bestFill = fill; best = id; }
    }
    return best;
  };

  F.setHome = function (w, p, homeId) {
    if (p.homeId >= 0) w.occupancy[p.homeId] = Math.max(0, (w.occupancy[p.homeId] || 0) - 1);
    p.homeId = homeId;
    w.occupancy[homeId] = (w.occupancy[homeId] || 0) + 1;
  };

  // Household moves together: head, partner and the children they care for.
  F.moveHome = function (w, p, tier, silent) {
    const old = p.tiers.housing, first = p.homeId < 0;
    p.housingWantMonths = 0;
    p.tiers.housing = tier;
    const homeId = F.pickHome(w, tier);
    F.setHome(w, p, homeId);
    const household = [p];
    if (p.partnerId !== null) {
      const q = w.people[p.partnerId];
      if (q.alive) { q.tiers.housing = tier; F.setHome(w, q, homeId); household.push(q); }
    }
    for (const h of household) {
      for (const cid of h.careOf) { const c = w.people[cid]; if (c.alive && c.homeId !== homeId) F.setHome(w, c, homeId); }
    }
    if (!silent && !first && tier !== old) {
      const up = tier > old;
      P.log(w, p, `${up ? 'Moved up' : 'Moved down'} to a ${C.TIERS.housing[tier].name}`, 'money', up && tier >= 3 ? 1 : 0);
    }
  };

  // ---- Investments ----
  F.invest = function (w, p, surplus, ctx) {
    const frac = U.clamp(0.5 + 0.3 * ctx.pat + (p.strategy === 'INV' ? 0.2 : 0), 0.2, 0.95);
    const amt = Math.round(surplus * frac);
    if (amt < U.RM(500)) return;
    const specShare = U.clamp(0.1 + 0.4 * ctx.risk + (p.strategy === 'INV' ? 0.1 : 0), 0, 0.7) * (ctx.risk > -0.2 ? 1 : 0.3);
    const spd = Math.round(amt * specShare);
    F.buy(w, p, 'idx', amt - spd);
    F.buy(w, p, 'spd', spd);
    P.log(w, p, `Invested ${U.fmtMoney(amt)} (${Math.round(specShare * 100)}% speculative)`, 'money', amt >= U.RM(1e6) ? 1 : 0);
  };

  // inv.idx = units of the shared index fund; inv.spd = value (sen) of a personal
  // speculative portfolio with its own idiosyncratic luck.
  F.buy = function (w, p, kind, amt) {
    if (amt <= 0 || !w.ledger.spend(p, 'cash', 'MARKET', amt)) return;
    if (kind === 'spd') p.inv.spd += amt * 0.995; // 0.5% fee
    else p.inv.idx += amt * 0.995 / w.market.idx;
    p.inv.cost += amt;
  };

  F.sell = function (w, p, kind, want) {
    const total = P.invValue(w, p);
    const val = Math.floor(kind === 'spd' ? p.inv.spd : p.inv.idx * w.market.idx);
    const amt = Math.min(Math.round(want), val);
    if (amt <= 0 || total <= 0) return 0;
    const costPart = p.inv.cost * Math.min(1, amt / total);
    if (kind === 'spd') p.inv.spd = amt >= val ? 0 : Math.max(0, p.inv.spd - amt);
    else p.inv.idx = amt >= val ? 0 : Math.max(0, p.inv.idx - amt / w.market.idx);
    p.inv.cost = Math.max(0, p.inv.cost - costPart);
    w.ledger.pay('MARKET', p, 'cash', amt);
    p.earned.invest += Math.round(amt - costPart);
    return amt;
  };

  F.marketMonth = function (w) {
    const R = w.rng.market, m = w.macro(), dt = 1 / 12;
    const zi = U.clamp(R.normal(0, 1), -4, 4);
    w.market.idx = U.clamp(w.market.idx * Math.exp((m.idxMu - 0.5 * m.idxSig ** 2) * dt + m.idxSig * Math.sqrt(dt) * zi), 0.01, 1e12);
    const zc = U.clamp(R.normal(0, 1), -4, 4);
    const common = (m.spdMu - 0.5 * m.spdSig ** 2) * dt + m.spdSig * Math.sqrt(dt) * zc;
    w.market.spd = U.clamp(w.market.spd * Math.exp(common), 0.01, 1e12);
    const si = C.SPEC_IDIO_SIGMA;
    for (const p of w.living) {
      if (!p.alive || p.inv.spd <= 0) continue;
      const z = U.clamp(R.normal(0, 1), -4, 4);
      p.inv.spd = Math.min(1e15, p.inv.spd * Math.exp(common - 0.5 * si * si * dt + si * Math.sqrt(dt) * z));
      if (p.inv.spd < 1) p.inv.spd = 0;
    }
  };

  // ---- Businesses ----
  F.bizSkill = (p, t) => LES.Actions.attrScore(p, t.w) + 0.3 * p.xp.business + 0.2 * P.prestige(p);

  F.bestBizType = function (w, p, ctx) {
    const avail = p.cash + P.invValue(w, p) * 0.9 - ctx.mc * 2;
    let best = null, bestS = -Infinity;
    for (const t of C.BIZ) {
      if (t.req && !P.hasCred(p, t.req)) continue;
      if (avail < U.RM(t.capital) * 0.4) continue;
      const skill = F.bizSkill(p, t);
      const s = 0.5 * skill + 0.6 * Math.log10(t.capital) * (1 + ctx.risk);
      if (s > bestS) { bestS = s; best = { type: t, skill }; }
    }
    return best;
  };

  F.bizName = function (w, p, t) {
    const R = w.rng.biz, suffix = R.pick(t.names);
    return t.id === 'stall' || t.id === 'restaurant' ? `${p.first.split(' ')[0]}'s ${suffix}` : `${p.last} ${suffix}`;
  };

  F.assignBizPlace = function (w, b) {
    const t = b.typeDef;
    if (t.place === 'shoplot') {
      for (const id of w.town.shoplots) {
        if (w.shoplotOwner[id] === undefined) { w.shoplotOwner[id] = b.id; return id; }
      }
      return w.town.byKind.mall;
    }
    return w.town.byKind[t.place];
  };

  F.startBusiness = function (w, p, pick, ctx) {
    const L = w.ledger, t = pick.type, cap = U.RM(t.capital);
    const keep = ctx.mc * 2;
    if (p.cash - keep < cap) F.raiseCash(w, p, cap - Math.max(0, p.cash - keep));
    const own = Math.min(cap, Math.max(0, p.cash - keep));
    const loan = cap - own;
    if (loan > cap * 0.6 + 1) { P.log(w, p, `Could not raise capital for a ${t.name}`, 'money', 0); return; }
    const b = {
      id: w.biz.length, name: F.bizName(w, p, t), type: t.id, typeDef: t, open: true, founderId: p.id, managerId: p.id,
      shares: {}, cash: 0, fixed: 0, debt: 0, debtOrig: 0, scale: U.RM(t.scale0), foundedDay: w.day, closedDay: null,
      profitHist: [], mgmt: 0, equity: 0, peakEquity: 0, lastProfit: 0, lastRevenue: 0, booms: 0, place: -1, closeReason: null,
    };
    w.biz.push(b);
    b.place = F.assignBizPlace(w, b);
    b.shares[p.id] = 1;
    p.shares[b.id] = 1;
    p.manages = b.id;
    L.move(p, 'cash', b, 'cash', own);
    if (loan > 0) { L.pay('BANK', b, 'cash', loan); b.debt = loan; b.debtOrig = loan; }
    const setup = Math.round(cap * 0.6);
    L.spend(b, 'cash', 'SUPPLIER', setup);
    b.fixed = Math.round(setup * 0.6);
    F.valueBiz(b);
    if (p.job && (p.strategy === 'ENT' || ctx.risk > 0.2)) LES.Labour.endJob(w, p, 'quit to run own business');
    P.log(w, p, `Founded ${b.name} (${t.name}) with ${U.fmtMoney(cap)} capital${loan > 0 ? `, ${U.fmtMoney(loan)} borrowed` : ''}`, 'biz', 1);
    w.stats.bizStarted++;
  };

  F.valueBiz = function (b) {
    const t = b.typeDef;
    const n = b.profitHist.length;
    const t12 = n ? U.sum(b.profitHist) * 12 / n * (1 - C.CORP_TAX) : 0;
    const net = b.cash + b.fixed - b.debt;
    b.equity = Math.max(0, Math.round(net + Math.max(0, t.multiple * t12)));
    if (b.equity > b.peakEquity) b.peakEquity = b.equity;
  };

  // Pay an amount out of business cash to shareholders by fraction (minors -> trust).
  F.distribute = function (w, b, amount, kind) {
    const L = w.ledger;
    amount = Math.min(Math.round(amount), b.cash);
    if (amount <= 0) return;
    const ids = Object.keys(b.shares).map(Number).sort((x, y) => x - y);
    if (!ids.length) { L.spend(b, 'cash', 'ESTATE', amount); return; }
    let paid = 0;
    for (const id of ids) {
      const p = w.people[id];
      const part = Math.floor(amount * b.shares[id]);
      L.move(b, 'cash', p, P.isAdult(w, p) ? 'cash' : 'trust', part);
      p.earned.business += part;
      if (kind === 'dividend') p.monthIncome += part;
      paid += part;
    }
    let top = ids[0];
    for (const id of ids) if (b.shares[id] > b.shares[top]) top = id;
    const rest = amount - paid;
    const tp = w.people[top];
    L.move(b, 'cash', tp, P.isAdult(w, tp) ? 'cash' : 'trust', rest);
    tp.earned.business += rest;
  };

  F.pickManager = function (w, b) {
    const old = b.managerId;
    let best = -1, bestShare = -1;
    for (const k of Object.keys(b.shares)) {
      const id = Number(k), p = w.people[id];
      if (!P.isAdult(w, p) || (p.manages >= 0 && p.manages !== b.id)) continue;
      const s = b.shares[id] + (p.retired ? -0.5 : 0);
      if (s > bestShare || (s === bestShare && id < best)) { bestShare = s; best = id; }
    }
    if (old >= 0 && old !== best && w.people[old].manages === b.id) w.people[old].manages = -1;
    b.managerId = best;
    if (best >= 0) {
      w.people[best].manages = b.id;
      if (old !== best) P.log(w, w.people[best], `Took over management of ${b.name}`, 'biz', 1);
    }
  };

  F.bizMonth = function (w, b) {
    const t = b.typeDef, R = w.rng.biz, m = w.macro(), L = w.ledger;
    if (b.managerId < 0 || !w.people[b.managerId].alive || w.people[b.managerId].manages !== b.id) F.pickManager(w, b);
    const mgr = b.managerId >= 0 ? w.people[b.managerId] : null;
    if (!mgr) { F.sellBiz(w, b, 'no adult owner to run it'); return; }

    const skill = F.bizSkill(mgr, t);
    const sizeF = 1 + Math.log10(Math.max(1, b.scale / U.RM(t.scale0)));
    const mgmtF = 0.8 + 0.2 * Math.min(1, b.mgmt / 12);
    const skillF = (1 + t.skillSpread * (skill - 5) / 5 / sizeF) * mgmtF;
    const demand = Math.pow(m.bizDemand, t.cyclical);
    const shock = Math.exp(U.clamp(R.normal(0, t.sigma), -3, 3));
    const revenue = Math.max(0, Math.round(b.scale * demand * skillF * shock));
    const interest = Math.round(b.debt * 0.06 / 12);
    const opCost = Math.round(b.scale * t.costRatio + U.RM(t.fixed));
    const principal = b.debt > 0 ? Math.min(b.debt, Math.max(U.RM(100), Math.round(b.debtOrig / 60))) : 0;
    const profit = revenue - opCost - interest;
    b.mgmt = 0;
    L.pay('CUSTOMER', b, 'cash', revenue);
    b.lastRevenue = revenue;
    b.lastProfit = profit;
    b.profitHist.push(profit);
    if (b.profitHist.length > 12) b.profitHist.shift();

    const due = opCost + interest + principal;
    if (b.cash < due && !F.rescue(w, b, mgr, due - b.cash)) { F.closeBiz(w, b, 'went bankrupt', true); return; }
    L.spend(b, 'cash', 'SUPPLIER', opCost);
    L.spend(b, 'cash', 'BANK', interest + principal);
    b.debt -= principal;
    if (profit > 0) L.spend(b, 'cash', 'TAX', Math.min(b.cash, Math.round(profit * C.CORP_TAX)));
    const netProfit = profit > 0 ? Math.round(profit * (1 - C.CORP_TAX)) : profit;

    // Rare booms (viral hit, big contract, franchise) and busts.
    const network = C.TIERS.leisure[mgr.tiers.leisure].network ? 1.3 : 1;
    if (R.next() < t.boom * U.clamp(skill / 5, 0.3, 2) * network) {
      const mult = R.range(t.boomMin, t.boomMax);
      b.scale *= mult; b.booms++;
      P.log(w, mgr, `${b.name} hit a breakthrough! Business grew x${mult.toFixed(1)}`, 'biz', 2);
      w.stats.booms++;
    } else if (R.next() < t.bust * sizeF * (w.regime === 'recession' ? 2 : 1)) {
      b.scale *= R.range(0.35, 0.7);
      P.log(w, mgr, `${b.name} lost a major customer; revenue fell sharply`, 'biz', 1);
    }

    // Dividends, then reinvest surplus cash into growth (diminishing returns).
    const reserve = 3 * (opCost + interest);
    if (profit > 0) {
      const payout = U.clamp(0.6 - 0.35 * (mgr.pers.pat - 50) / 50, 0.1, 0.95);
      const div = Math.min(Math.round(netProfit * payout), b.cash - Math.round(reserve * 0.5));
      if (div > 0) F.distribute(w, b, div, 'dividend');
      const excess = b.cash - reserve;
      if (excess > 0) {
        const capex = Math.round(excess * 0.5);
        L.spend(b, 'cash', 'SUPPLIER', capex);
        b.fixed += Math.round(capex * 0.5);
        b.scale += capex * t.capEff / (sizeF * sizeF) * Math.max(0, 1 - b.scale / U.RM(t.cap));
      }
    } else {
      b.scale *= 0.99;
    }
    // Market saturation: competitors chip away at large businesses.
    const share = b.scale / U.RM(t.cap);
    if (share > 0.3) b.scale *= 1 - 0.01 * (share - 0.3);
    b.fixed = Math.round(b.fixed * 0.99);
    b.scale = U.clamp(b.scale, U.RM(t.scale0) * 0.2, U.RM(t.cap) * 1.5);
    F.valueBiz(b);

    // Persistent losses: low-resilience owners give up.
    if (b.profitHist.length >= 6 && b.profitHist.slice(-6).every(x => x < 0) && R.next() < 0.15 * (1.2 - mgr.pers.res / 100)) {
      F.closeBiz(w, b, 'closed after months of losses', true);
    }
  };

  F.rescue = function (w, b, mgr, shortfall) {
    const R = w.rng.biz, L = w.ledger;
    const willing = R.next() < U.clamp(0.4 + 0.3 * (mgr.pers.res - 50) / 50 + 0.2 * (mgr.pers.risk - 50) / 50, 0.05, 0.95);
    if (willing && mgr.cash - mgr.mcost >= shortfall) {
      L.move(mgr, 'cash', b, 'cash', shortfall);
      P.log(w, mgr, `Put ${U.fmtMoney(shortfall)} of own money into ${b.name} to keep it alive`, 'biz', 0);
      return true;
    }
    if (b.debt < b.scale * 3 && mgr.bankruptUntil < w.day && R.next() < 0.6) {
      const loan = Math.round(shortfall * 1.2);
      L.pay('BANK', b, 'cash', loan);
      b.debt += loan; b.debtOrig += loan;
      return true;
    }
    return false;
  };

  F.releaseBiz = function (w, b) {
    b.open = false; b.closedDay = w.day; b.equity = 0;
    if (w.shoplotOwner[b.place] === b.id) delete w.shoplotOwner[b.place];
    for (const k of Object.keys(b.shares)) {
      const p = w.people[Number(k)];
      delete p.shares[b.id];
      if (p.manages === b.id) p.manages = -1;
    }
  };

  F.closeBiz = function (w, b, reason, failure) {
    const L = w.ledger;
    L.pay('MARKET', b, 'cash', Math.round(b.fixed * 0.3)); // fire-sale of equipment
    b.fixed = 0;
    const repay = Math.min(b.cash, b.debt);
    L.spend(b, 'cash', 'BANK', repay);
    L.writeOffs += b.debt - repay;
    b.debt = 0;
    if (b.cash > 0) F.distribute(w, b, b.cash, 'liquidation');
    const owners = Object.keys(b.shares).map(k => w.people[Number(k)]);
    b.closeReason = reason;
    F.releaseBiz(w, b);
    for (const p of owners) {
      P.log(w, p, `${b.name} ${reason}`, 'biz', 1);
      if (failure) {
        p.bizFailures++;
        p.stress = Math.min(100, p.stress + 25);
        p.pendingReview = 'a business failure';
      }
    }
    w.stats.bizClosed++;
    if (failure) w.stats.bizFailed++;
  };

  // Sold to an outside buyer at 70% of equity; buyer takes over cash and debts.
  F.sellBiz = function (w, b, reason) {
    const L = w.ledger;
    const price = Math.round(b.equity * 0.7);
    L.spend(b, 'cash', 'MARKET', b.cash);
    b.debt = 0; b.fixed = 0;
    L.pay('MARKET', b, 'cash', price);
    const owners = Object.keys(b.shares).map(k => w.people[Number(k)]);
    F.distribute(w, b, price, 'sale');
    b.closeReason = `sold (${reason})`;
    F.releaseBiz(w, b);
    for (const p of owners) P.log(w, p, `${b.name} was sold for ${U.fmtMoney(price)} (${reason})`, 'biz', 1);
    w.stats.bizClosed++;
  };

  // ---- Personal debt ----
  F.debtMonth = function (w, p) {
    const L = w.ledger, d = p.debt;
    if (d.study <= 0) return;
    d.study += Math.round(d.study * 0.01 / 12);
    if (p.enrol) return;
    const inst = Math.min(d.study, Math.max(U.RM(100), Math.round(d.studyOrig / 120)));
    if (p.cash < inst) F.raiseCash(w, p, inst - p.cash);
    if (L.spend(p, 'cash', 'BANK', inst)) { d.study -= inst; p.arrears = 0; }
    else { p.arrears++; p.stress = Math.min(100, p.stress + 5); }
    if (p.arrears >= 12 && p.nw < 0) F.personalBankrupt(w, p);
  };

  F.personalBankrupt = function (w, p) {
    const L = w.ledger;
    F.raiseCash(w, p, P.invValue(w, p) + 1);
    const pay = Math.min(p.cash, p.debt.study);
    L.spend(p, 'cash', 'BANK', pay);
    L.writeOffs += p.debt.study - pay;
    p.debt.study = 0; p.debt.studyOrig = 0; p.arrears = 0;
    p.bankruptUntil = w.day + 5 * 365;
    p.stress = Math.min(100, p.stress + 30);
    p.pendingReview = 'personal bankruptcy';
    P.log(w, p, 'Declared bankrupt; debts written off, no loans for 5 years', 'money', 2);
    w.stats.bankruptcies++;
  };

  // ---- Monthly personal finance ----
  F.personMonth = function (w, p) {
    const L = w.ledger, m = w.macro();
    if (p.cash > U.RM(1000)) {
      const i = Math.round(p.cash * m.depositRate / 12);
      L.pay('BANK', p, 'cash', i);
      p.earned.interest += i;
    }
    if (P.age(w, p) >= 55 && p.epf > 0) {
      const amt = p.epf;
      L.move(p, 'epf', p, 'cash', amt);
      P.log(w, p, `Withdrew ${U.fmtMoney(amt)} of EPF retirement savings`, 'money', 0);
    }
    if (p.isHead) F.payBill(w, p, 'housing');
    F.payBill(w, p, 'transport');
    F.payBill(w, p, 'leisure');
    F.payChildren(w, p);
    F.debtMonth(w, p);
    // Wealthier people consume part of their wealth (family support, luxuries,
    // donations): ~3.6%/year of net worth above RM300k.
    const rich = p.nw - U.RM(3e5);
    if (rich > 0) {
      const lux = Math.round(rich * 0.003);
      if (p.cash < lux) F.raiseCash(w, p, lux - p.cash);
      L.spend(p, 'cash', 'MERCHANT', Math.min(p.cash, lux));
    }
    // Profit-taking: a big speculative position is partly cashed out (more by cautious people).
    if (p.inv.spd > U.RM(200000) && p.inv.spd > 0.4 * Math.max(1, p.nw)) {
      F.sell(w, p, 'spd', p.inv.spd * U.clamp(0.25 - 0.15 * (p.pers.risk - 50) / 50, 0.05, 0.4));
    }
    p.incomeEMA = Math.round(p.incomeEMA * 0.7 + p.monthIncome * 0.3);
    p.monthIncome = 0;
    F.reviewTiers(w, p);
  };

  // ---- Random luck (monthly, per adult) ----
  F.luckMonth = function (w, p) {
    const R = w.rng.luck, L = w.ledger, age = P.age(w, p);
    // One luck roll per month; each event owns a separate slice of [0,1).
    const pIll = 0.002 * (1 + age / 50), pScam = 0.0015 * (1 + age / 50), pWin = 0.0008, pIdea = 0.0035;
    const r = R.next();
    if (r < pIll) {
      const hp = R.range(20, 45);
      p.health = Math.max(1, p.health - hp);
      const bill = Math.min(p.cash, U.RM(R.range(2000, 30000)));
      L.spend(p, 'cash', 'HEALTH', bill);
      P.log(w, p, `Fell seriously ill (-${Math.round(hp)} health, ${U.fmtMoney(bill)} medical bills)`, 'luck', 1);
      w.stats.illnesses++;
    } else if (r < pIll + pScam) {
      if (p.cash > U.RM(10000) && R.next() < 0.4 + 0.4 * p.pers.risk / 100) {
        const amt = Math.round(p.cash * R.range(0.1, 0.4));
        L.spend(p, 'cash', 'LUCK', amt);
        P.log(w, p, `Lost ${U.fmtMoney(amt)} to an investment scam`, 'luck', 1);
        w.stats.scams++;
      }
    } else if (r < pIll + pScam + pWin) {
      const amt = U.RM(Math.min(2e6, Math.exp(R.normal(Math.log(20000), 1.1))));
      L.pay('LUCK', p, 'cash', amt);
      p.earned.luck += amt;
      P.log(w, p, `Lucky windfall: received ${U.fmtMoney(amt)}`, 'luck', 1);
      w.stats.windfalls++;
    } else if (r < pIll + pScam + pWin + pIdea && p.manages < 0) {
      p.ideaUntil = w.day + 90;
      P.log(w, p, 'Spotted a promising business opportunity', 'luck', 0);
    }
    if (R.next() < 0.06) {
      const what = R.pick(['a family emergency', 'home repairs', 'a vehicle repair', 'helping relatives', 'a wedding in the family']);
      const amt = Math.min(p.cash, U.RM(R.range(300, 4000)));
      if (amt > 0) { L.spend(p, 'cash', 'MERCHANT', amt); P.log(w, p, `Spent ${U.fmtMoney(amt)} on ${what}`, 'money', 0); }
    }
    if (C.TIERS.transport[p.tiers.transport].accident && R.next() < C.TIERS.transport[p.tiers.transport].accident) {
      LES.Actions.catastrophe(w, p, [0, 0, 0, 0, 1, 0], 'hurt in a motorbike accident');
    }
  };

  // ---- Economy regime (yearly) ----
  F.macroYear = function (w) {
    const R = w.rng.market, trans = C.REGIME_TRANSITIONS[w.cfg.economy][w.regime];
    const keys = ['growth', 'normal', 'recession'];
    const next = keys[Math.max(0, R.weighted(keys.map(k => trans[k])))];
    if (next !== w.regime) {
      w.regime = next;
      w.regimeHist.push({ day: w.day + 1, regime: next });
      w.pushFeed({ day: w.day, pid: -1, text: `The economy entered a ${C.REGIMES[next].name.toLowerCase()} period`, cat: 'economy', imp: 2 });
    }
  };
})(globalThis.LES = globalThis.LES || {});
