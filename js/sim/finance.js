// Money: living costs & lifestyle tiers (inflation- and crowding-adjusted), the
// stock market (index fund + individual shares), businesses, loans, bankruptcy,
// the macro economy and random luck. Every cash flow goes through the ledger.
// Prices: content tables are in Year-1 RM; w.px(rm) converts to today's sen.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, M = LES.Market;
  const F = LES.Finance = {};

  F.tierCost = function (w, cat, t) {
    let base = U.RM(C.TIERS[cat][t].cost) * w.price;
    if (w.taxPx) base *= w.taxPx[cat][t]; // sales-tax law (GST vs SST)
    if (w.costMult) base *= w.costMult[cat]; // scenario price changes (e.g. an island imports everything)
    return Math.round(cat === 'housing' ? base * w.rentMult[t] : base);
  };
  F.childCost = (w, p) => Math.round(U.RM(C.CHILD_COST + C.CHILD_COST_PER_HOUSING * p.tiers.housing) * w.price * (w.taxPx ? w.taxPx.child : 1));

  F.careShare = function (w, p) {
    let total = 0;
    for (const cid of p.careOf) {
      const c = w.people[cid];
      if (!c.alive) continue;
      total += F.childCost(w, p) / Math.max(1, c.caregivers.length);
    }
    return Math.round(total);
  };

  F.monthlyCost = function (w, p) {
    let c = F.tierCost(w, 'food', p.tiers.food) + F.tierCost(w, 'transport', p.tiers.transport) + F.tierCost(w, 'leisure', p.tiers.leisure);
    if (p.isHead) c += F.tierCost(w, 'housing', p.tiers.housing);
    return c + F.careShare(w, p);
  };

  // Sell investments to cover a shortfall (index fund first, then biggest shareholdings).
  F.raiseCash = function (w, p, need, why) {
    let got = 0;
    if (need > 0 && p.inv.idx > 0) got += F.sell(w, p, 'idx', need, why || 'needed cash');
    if (need - got > 0) {
      const tks = Object.keys(p.inv.st).sort((a, b) => p.inv.st[b] * w.mkt.byTk[b].price - p.inv.st[a] * w.mkt.byTk[a].price);
      for (const tk of tks) {
        if (need - got <= 0) break;
        got += F.sell(w, p, tk, need - got, why || 'needed cash');
      }
    }
    return got;
  };

  // ---- Daily food ----
  F.dailyFood = function (w, p) {
    const L = w.ledger;
    if (p.inst) { p.hunger = 0; return; } // meals are provided in prison and rehab
    const cost = Math.round(F.tierCost(w, 'food', p.tiers.food) / 30);
    if (p.cash < cost) F.raiseCash(w, p, cost - p.cash);
    if (p.cash >= cost) {
      L.spend(p, 'cash', 'MERCHANT', cost);
      p.hunger = Math.max(0, p.hunger - 40);
      return;
    }
    if (p.tiers.food > 0) { p.tiers.food = 0; p.mcost = F.monthlyCost(w, p); }
    const basic = Math.round(F.tierCost(w, 'food', 0) / 30);
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
    const L = w.ledger, amt = F.tierCost(w, cat, p.tiers[cat]);
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
      const amt = Math.round(F.childCost(w, p) / Math.max(1, c.caregivers.length));
      if (p.cash < amt) F.raiseCash(w, p, amt - p.cash);
      if (L.spend(p, 'cash', 'MERCHANT', amt)) continue;
      if (w.derived.welfare) { L.move(L.sec.WELFARE, 'bal', L.sec.MERCHANT, 'bal', amt); p.earned.welfare += amt; }
      else c.unpaidCare++;
    }
  };

  // ---- Lifestyle tiers (monthly). Impatient people spend more of their income. ----
  F.reviewTiers = function (w, p) {
    if (p.inst) return; // no lifestyle choices in prison or rehab
    const pat = (p.pers.pat - 50) / 50, dis = (p.pers.dis - 50) / 50;
    const spendRate = U.clamp(1.0 - 0.3 * pat - 0.15 * dis + LES.Goals.spendDelta(p), 0.5, 1.2);
    const budget = p.incomeEMA * spendRate + Math.max(0, p.nw) * 0.004 - F.careShare(w, p);
    const t = { food: 0, housing: p.isHead ? 0 : p.tiers.housing, transport: 0, leisure: 0 };
    let cost = F.tierCost(w, 'food', 0) + F.tierCost(w, 'transport', 0) + F.tierCost(w, 'leisure', 0) + (p.isHead ? F.tierCost(w, 'housing', 0) : 0);
    const order = ['food', 'housing', 'transport', 'leisure', 'housing', 'food', 'leisure', 'transport', 'housing', 'food', 'housing', 'transport', 'leisure'];
    for (const cat of order) {
      if (cat === 'housing' && !p.isHead) continue;
      const next = t[cat] + 1;
      if (next >= C.TIERS[cat].length) continue;
      const delta = F.tierCost(w, cat, next) - F.tierCost(w, cat, t[cat]);
      if (cost + delta <= budget) { t[cat] = next; cost += delta; }
    }
    p.tiers.food = t.food; p.tiers.transport = t.transport; p.tiers.leisure = t.leisure;
    if (p.isHead && t.housing !== p.tiers.housing) {
      const cantAfford = p.cash < F.tierCost(w, 'housing', p.tiers.housing) && t.housing < p.tiers.housing;
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
    if (homeId >= 0) w.occupancy[homeId] = (w.occupancy[homeId] || 0) + 1;
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
      if (q.alive && !q.away) { q.tiers.housing = tier; F.setHome(w, q, homeId); household.push(q); }
    }
    for (const h of household) {
      for (const cid of h.careOf) { const c = w.people[cid]; if (c.alive && !c.away && c.homeId !== homeId) F.setHome(w, c, homeId); }
    }
    if (!silent && !first && tier !== old) {
      const up = tier > old;
      P.log(w, p, `${up ? 'Moved up' : 'Moved down'} to a ${C.TIERS.housing[tier].name}`, 'money', up && tier >= 3 ? 1 : 0);
    }
  };

  // Rent follows crowding per housing tier (monthly): busy estates get pricier.
  F.updateRent = function (w) {
    const cap = [0, 0, 0, 0, 0], occ = [0, 0, 0, 0, 0];
    for (let t = 0; t < 5; t++) {
      for (const id of w.town.homesByTier[t]) { cap[t] += w.town.buildings[id].cap; occ[t] += w.occupancy[id] || 0; }
      const crowd = cap[t] ? occ[t] / cap[t] : 1;
      const target = crowd > 0.85 ? 1 + 1.5 * (crowd - 0.85) : crowd < 0.5 ? 1 - 0.3 * (0.5 - crowd) : 1;
      w.rentMult[t] = U.clamp(w.rentMult[t] * 0.8 + target * 0.2, 0.8, 3);
    }
    const totCap = U.sum(cap), totOcc = U.sum(occ);
    w.crowding = totCap ? totOcc / totCap : 1;
  };

  // ---- Investments: index fund ('idx') and individual Bursa shares (ticker) ----
  F.pickStocks = function (w, p, ctx, n) {
    const R = w.rng.outcome, stocks = w.mkt.stocks;
    const k = ctx.risk > 0.2 ? 4 : ctx.pat > 0.2 ? -3 : 0; // momentum chasers vs bargain hunters
    const weights = stocks.map(s => Math.exp(U.clamp(k * M.stockRet(s, 63), -3, 3)) * (s.def.sector === 'Technology' ? 1 + 0.5 * Math.max(0, ctx.risk) : 1));
    if (w.sys.stockOk.length) stocks.forEach((s, i) => { for (const x of w.sys.stockOk) if (!x.stockOk(w, p, s.tk)) weights[i] = 0; });
    const picks = [];
    for (let i = 0; i < n; i++) {
      const j = R.weighted(weights);
      if (j < 0) break;
      picks.push(stocks[j].tk);
      weights[j] = 0;
    }
    return picks;
  };

  F.invest = function (w, p, surplus, ctx) {
    const frac = U.clamp(0.5 + 0.3 * ctx.pat + (p.strategy === 'INV' ? 0.2 : 0), 0.2, 0.95);
    const amt = Math.round(surplus * frac);
    if (amt < w.px(500)) return;
    const stockShare = U.clamp(0.1 + 0.4 * ctx.risk + (p.strategy === 'INV' ? 0.1 : 0), 0, 0.7) * (ctx.risk > -0.2 ? 1 : 0.3);
    const inStocks = Math.round(amt * stockShare);
    F.buy(w, p, 'idx', amt - inStocks, 'saving');
    const picks = inStocks > w.px(2000) ? F.pickStocks(w, p, ctx, ctx.risk > 0.4 ? 1 : 2) : [];
    for (const tk of picks) F.buy(w, p, tk, Math.round(inStocks / picks.length), 'investing');
    if (!picks.length && inStocks > 0) F.buy(w, p, 'idx', inStocks, 'saving');
    P.log(w, p, `Invested ${U.fmtMoney(amt)}${picks.length ? ` (shares: ${picks.join(', ')})` : ' in the Bursa index fund'}`, 'money', amt >= w.px(1e6) ? 1 : 0);
  };

  F.buy = function (w, p, kind, amt, why) {
    if (amt <= 0 || !w.ledger.spend(p, 'cash', 'MARKET', amt)) return;
    const net = amt * 0.995; // 0.5% fee
    if (kind === 'idx') {
      p.inv.idx += net / w.mkt.idx;
      const wts = M.weights(w);
      w.mkt.stocks.forEach((s, i) => M.flow(w, s, net * wts[i], 1));
    } else {
      const s = w.mkt.byTk[kind];
      p.inv.st[kind] = (p.inv.st[kind] || 0) + net / s.price;
      M.flow(w, s, net, 1);
      M.logTrade(w, p, kind, amt, 1, why);
    }
    p.inv.cost += amt;
  };

  F.sell = function (w, p, kind, want, why) {
    const total = P.invValue(w, p);
    const isIdx = kind === 'idx';
    const s = isIdx ? null : w.mkt.byTk[kind];
    const held = isIdx ? p.inv.idx : (p.inv.st[kind] || 0);
    const val = Math.floor(held * (isIdx ? w.mkt.idx : s.price));
    const amt = Math.min(Math.round(want), val);
    if (amt <= 0 || total <= 0) return 0;
    const costPart = p.inv.cost * Math.min(1, amt / total);
    const unitPrice = isIdx ? w.mkt.idx : s.price;
    const left = amt >= val ? 0 : Math.max(0, held - amt / unitPrice);
    if (isIdx) {
      p.inv.idx = left;
      const wts = M.weights(w);
      w.mkt.stocks.forEach((st, i) => M.flow(w, st, amt * wts[i], -1));
    } else {
      if (left > 0) p.inv.st[kind] = left; else delete p.inv.st[kind];
      M.flow(w, s, amt, -1);
      M.logTrade(w, p, kind, amt, -1, why);
    }
    p.inv.cost = Math.max(0, p.inv.cost - costPart);
    w.ledger.pay('MARKET', p, 'cash', amt);
    p.earned.invest += Math.round(amt - costPart);
    return amt;
  };

  F.sellFraction = function (w, p, frac, includeIdx, why) {
    let got = 0;
    for (const tk of Object.keys(p.inv.st)) got += F.sell(w, p, tk, p.inv.st[tk] * w.mkt.byTk[tk].price * frac, why);
    if (includeIdx && p.inv.idx > 0) got += F.sell(w, p, 'idx', p.inv.idx * w.mkt.idx * frac, why);
    return got;
  };

  // Personal market reactions, checked on each person's monthly reflection day.
  F.marketBehaviour = function (w, p) {
    const stocks = P.stockValue(w, p), idxV = p.inv.idx * w.mkt.idx;
    if (stocks + idxV <= 0) return;
    const R = w.rng.outcome;
    const r1m = M.retOver(w, 21);
    const res = p.pers.res / 100, pat = p.pers.pat / 100, risk = p.pers.risk / 100;
    if (r1m < -0.08 && R.next() < 0.3 * (1 - res) * (1 - pat) * (1 + (-r1m - 0.08) * 5)) {
      const got = F.sellFraction(w, p, R.range(0.3, 0.8), true, 'panic');
      if (got > 0) {
        P.log(w, p, `Panic-sold ${U.fmtMoney(got)} of shares after the market fell ${Math.round(-r1m * 100)}% in a month`, 'money', got >= w.px(50000) ? 1 : 0);
        w.stats.panicSells++;
      }
    } else if (stocks > w.px(200000) && stocks > 0.4 * Math.max(1, p.nw)) {
      const got = F.sellFraction(w, p, U.clamp(0.25 - 0.3 * (risk - 0.5), 0.05, 0.4), false, 'profit-taking');
      if (got > w.px(10000)) P.log(w, p, `Took ${U.fmtMoney(got)} of profit from shares`, 'money', 0);
    }
  };

  // ---- Businesses (scale is kept in Year-1 sen; cash flows are converted to today's money) ----
  F.bizSkill = (p, t) => LES.Actions.attrScore(p, t.w) + 0.3 * p.xp.business + 0.2 * P.prestige(p);

  F.bestBizType = function (w, p, ctx) {
    const avail = p.cash + P.invValue(w, p) * 0.9 - ctx.mc * 2;
    let best = null, bestS = -Infinity;
    for (const t of (w.bizTypes || C.BIZ)) {
      if (t.req && !P.hasCred(p, t.req)) continue;
      if (avail < w.px(t.capital) * 0.4) continue;
      if (t.maxPer && !LES.Services.canStart(w, t)) continue; // room in town (and an empty lot) for it?
      const skill = F.bizSkill(p, t);
      const dream = p.goal && p.goal.id === 'OWN_BIZ' && p.goal.bizType === t.id ? 3 : 0; // the business they dream of
      const s = 0.5 * skill + 0.6 * Math.log10(t.capital) * (1 + ctx.risk) + dream;
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
    if (t.build) return LES.Services.buildFor(w, b); // a private school or hospital on an empty lot
    if (t.place === 'shoplot') {
      for (const id of w.town.shoplots) {
        if (w.shoplotOwner[id] === undefined) { w.shoplotOwner[id] = b.id; return id; }
      }
      return w.town.byKind.mall;
    }
    const list = w.town.kinds[t.place] || [w.town.byKind[t.place]];
    return list[Math.floor(w.rng.biz.next() * list.length)];
  };

  F.startBusiness = function (w, p, pick, ctx) {
    const L = w.ledger, t = pick.type, cap = w.px(t.capital);
    const keep = ctx.mc * 2;
    if (p.cash - keep < cap) F.raiseCash(w, p, cap - Math.max(0, p.cash - keep), 'funding a business');
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
    const t12 = n ? U.sum(b.profitHist) * 12 / n * (1 - C.CORP_TAX) : 0; // valued at the statutory rate
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
      if (kind === 'dividend' && w.gov) LES.Fiscal.dividendTax(w, p, part, P.isAdult(w, p) ? 'cash' : 'trust');
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
      if (!P.isAdult(w, p) || p.away || p.inst || (p.manages >= 0 && p.manages !== b.id)) continue;
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
    const t = b.typeDef, R = w.rng.biz, m = w.macro(), L = w.ledger, price = w.price;
    const mgr0 = b.managerId >= 0 ? w.people[b.managerId] : null;
    if (!mgr0 || !mgr0.alive || mgr0.away || mgr0.manages !== b.id) F.pickManager(w, b);
    const mgr = b.managerId >= 0 ? w.people[b.managerId] : null;
    if (!mgr) { F.sellBiz(w, b, 'no adult owner to run it'); return; }

    const skill = F.bizSkill(mgr, t);
    const sizeF = 1 + Math.log10(Math.max(1, b.scale / U.RM(t.scale0)));
    const mgmtF = 0.8 + 0.2 * Math.min(1, b.mgmt / 12);
    const skillF = (1 + t.skillSpread * (skill - 5) / 5 / sizeF) * mgmtF;
    const demand = Math.pow(m.bizDemand, t.cyclical) * (w.boost ? w.boost.biz : 1) * (w.shock ? w.shock.biz : 1);
    const shock = Math.exp(U.clamp(R.normal(0, t.sigma), -3, 3));
    const revenue = Math.max(0, Math.round(b.scale * price * demand * skillF * shock));
    const interest = Math.round(b.debt * (w.gov ? LES.Fiscal.loanRate(w) : 0.06) / 12);
    let opCost = Math.round((b.scale * t.costRatio + U.RM(t.fixed)) * price * (w.shock ? w.shock.cost : 1));
    let townRev = 0;
    if (t.staff) { // private services: staff wages were paid directly; fees from residents already arrived
      opCost = Math.max(Math.round(opCost * 0.3), opCost - (b.payrollNow || 0));
      b.payrollLast = b.payrollNow || 0; b.payrollNow = 0;
      townRev = b.townRev || 0; b.townRev = 0;
    }
    const principal = b.debt > 0 ? Math.min(b.debt, Math.max(w.px(100), Math.round(b.debtOrig / 60))) : 0;
    const profit = revenue + townRev - opCost - interest;
    b.mgmt = 0;
    L.pay('CUSTOMER', b, 'cash', revenue);
    b.lastRevenue = revenue + townRev;
    b.lastProfit = profit;
    b.profitHist.push(profit);
    if (b.profitHist.length > 12) b.profitHist.shift();

    const due = opCost + interest + principal;
    if (b.cash < due && !F.rescue(w, b, mgr, due - b.cash)) { F.closeBiz(w, b, 'went bankrupt', true); return; }
    L.spend(b, 'cash', 'SUPPLIER', opCost);
    L.spend(b, 'cash', 'BANK', interest + principal);
    b.debt -= principal;
    let netProfit;
    if (w.gov) { // SME rates; some is evaded under a weak treasurer
      const tax = profit > 0 ? LES.Fiscal.collect(w, b, 'cash', LES.Fiscal.corpTax(w, b, profit) * LES.Fiscal.compliance(w), 'company tax (town firms)') : 0;
      netProfit = profit > 0 ? profit - tax : profit;
    } else {
      const corp = w.policy ? w.policy.corpTax : C.CORP_TAX;
      if (profit > 0) L.spend(b, 'cash', 'TAX', Math.min(b.cash, Math.round(profit * corp)));
      netProfit = profit > 0 ? Math.round(profit * (1 - corp)) : profit;
    }

    // Rare booms (viral hit, big contract, franchise) and busts.
    // Networking: country-club membership and recent golf/lounge visits bring deals.
    const network = (C.TIERS.leisure[mgr.tiers.leisure].network ? 1.3 : 1) * (1 + 0.1 * Math.min(5, mgr.netMonth));
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
        b.scale += capex / price * t.capEff / (sizeF * sizeF) * Math.max(0, 1 - b.scale / U.RM(t.cap));
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
    if (b.debt < b.scale * w.price * 3 && mgr.bankruptUntil < w.day && R.next() < 0.6) {
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
    if (b.hq !== undefined) { w.town.buildings[b.hq].label = 'Menara (vacant)'; w.townVersion++; }
    if (b.typeDef.staff) LES.Services.onClose(w, b);
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
    const inst = Math.min(d.study, Math.max(w.px(100), Math.round(d.studyOrig / 120)));
    if (p.cash < inst) F.raiseCash(w, p, inst - p.cash);
    if (L.spend(p, 'cash', 'BANK', inst)) { d.study -= inst; p.arrears = 0; }
    else { p.arrears++; p.stress = Math.min(100, p.stress + 5); }
    if (p.arrears >= 12 && p.nw < 0) F.personalBankrupt(w, p);
  };

  F.personalBankrupt = function (w, p) {
    const L = w.ledger;
    F.raiseCash(w, p, P.invValue(w, p) + 1, 'bankruptcy');
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
    // People whose goal is to help others give part of their income to charity.
    if (p.goal && p.goal.id === 'HELPER' && p.incomeEMA > 0 && p.cash > p.mcost) {
      const gift = Math.min(Math.round(p.incomeEMA * 0.06), p.cash - p.mcost);
      if (gift > 0 && w.ledger.spend(p, 'cash', 'WELFARE', gift)) p.donated += gift;
    }
    const L = w.ledger, m = w.macro();
    if (p.cash > w.px(1000)) {
      const rate = w.gov ? LES.Fiscal.depositRate(w) : m.depositRate + 0.9 * w.infl; // nominal deposit rate (Bank Negara's OPR sets it)
      const i = Math.max(0, Math.round(p.cash * rate / 12));
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
    // donations): ~3.6%/year of net worth above RM300k (Year-1 money).
    const rich = p.nw - w.px(3e5);
    if (rich > 0) {
      const lux = Math.round(rich * 0.003);
      if (p.cash < lux) F.raiseCash(w, p, lux - p.cash);
      L.spend(p, 'cash', 'MERCHANT', Math.min(p.cash, lux));
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
      const bill = LES.Services.medicalBill(w, p, Math.min(p.cash, w.px(R.range(2000, 30000))));
      P.log(w, p, `Fell seriously ill (-${Math.round(hp)} health, ${U.fmtMoney(bill)} medical bills)`, 'luck', 1);
      w.stats.illnesses++;
    } else if (r < pIll + pScam) {
      if (p.cash > w.px(10000) && R.next() < 0.4 + 0.4 * p.pers.risk / 100) {
        const amt = Math.round(p.cash * R.range(0.1, 0.4));
        L.spend(p, 'cash', 'LUCK', amt);
        P.log(w, p, `Lost ${U.fmtMoney(amt)} to an investment scam`, 'luck', 1);
        w.stats.scams++;
      }
    } else if (r < pIll + pScam + pWin) {
      const amt = w.px(Math.min(2e6, Math.exp(R.normal(Math.log(20000), 1.1))));
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
      const amt = Math.min(p.cash, w.px(R.range(300, 4000)));
      if (amt > 0) { L.spend(p, 'cash', 'MERCHANT', amt); P.log(w, p, `Spent ${U.fmtMoney(amt)} on ${what}`, 'money', 0); }
    }
    if (C.TIERS.transport[p.tiers.transport].accident && R.next() < C.TIERS.transport[p.tiers.transport].accident) {
      LES.Actions.catastrophe(w, p, [0, 0, 0, 0, 1, 0], 'hurt in a motorbike accident');
    }
  };

  // ---- Economy regime and inflation (yearly) ----
  F.macroYear = function (w) {
    const R = w.rng.market, trans = C.REGIME_TRANSITIONS[w.cfg.economy][w.regime];
    const keys = ['growth', 'normal', 'recession'];
    const next = keys[Math.max(0, R.weighted(keys.map(k => trans[k])))];
    if (next !== w.regime) {
      w.regime = next;
      w.regimeHist.push({ day: w.day + 1, regime: next });
      w.pushFeed({ day: w.day, pid: -1, text: `The economy entered a ${C.REGIMES[next].name.toLowerCase()} period`, cat: 'economy', imp: 2 });
    }
    // Inflation: mean-reverting inside the user's [min, max], higher in booms.
    const lo = w.cfg.inflMin / 100, hi = w.cfg.inflMax / 100, mid = (lo + hi) / 2;
    const shift = next === 'growth' ? 0.25 * (hi - mid) : next === 'recession' ? -0.4 * (mid - lo) : 0;
    const target = mid + 0.5 * (w.infl - mid) + shift + R.normal(0, (hi - lo) / 6);
    w.infl = U.clamp(target, lo, hi);
    w.inflHist.push({ year: U.dayToDate(w.day).year + 1, rate: w.infl });
  };
})(globalThis.LES = globalThis.LES || {});
