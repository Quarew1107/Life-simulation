// Public finance for the government system (inert without it): Malaysian taxes, the
// monthly treasury account, the budget, Bank Negara's policy rate, the town's sovereign
// fund (Khazanah Rezeki) and government-linked companies on Bursa Rezeki.
//
// Taxes (all in Year-1 RM, moving with prices so there is no bracket creep):
// - Personal income tax: LHDN resident bands (YA2025, 0-30%), RM9,000 personal relief,
//   EPF relief up to RM4,000, RM2,000 per child, RM400 rebate up to RM35,000 chargeable
//   income, deducted monthly from pay (PCB). Zakat paid is rebated against it.
// - Company tax: SME rates 15% / 17% / 24% (24% flat above RM50M revenue) on town
//   businesses, plus the company tax of the outside firms that employ residents
//   (a share of their wage bill).
// - Sales tax included in prices: SST (sales 5-10%, service 8%; basic food and hawker
//   meals exempt), or GST 6% on most goods and services if the law changes.
// - Assessment tax (cukai taksiran) on homes and business premises, the 2% dividend tax
//   above RM100k a year, EIS contributions, fines and any inheritance tax.
// Spending: police, teachers, nurses and doctors (js/sim/services.js), the council
// (js/sim/council.js), welfare, cash aid, job-loss benefit and training, public hospitals,
// universities, development and interest. Surpluses build reserves, then development
// and the sovereign fund; deficits are covered by the fund, then by borrowing.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const FS = LES.Fiscal = {};

  // ---- Personal income tax ----
  FS.PIT_BANDS = []; // tax.incomeBands of the country pack (annual, Year-1 money)
  FS.annualPIT = function (ch) {
    let tax = 0, lo = 0;
    for (const [hi, r] of FS.PIT_BANDS) { if (ch > lo) tax += (Math.min(ch, hi) - lo) * r; lo = hi; }
    return tax;
  };
  // Chargeable income and annual tax for a yearly gross income (Year-1 RM).
  FS.annualTaxOn = function (w, p, gross) {
    let kids = 0;
    if (p) for (const id of p.careOf) { const c = w.people[id]; if (c.alive && !c.adult) kids += 1 / Math.max(1, c.caregivers.length); }
    const ch = Math.max(0, gross - TX.personalRelief - Math.min(TX.retirementRelief.cap, TX.retirementRelief.rate * gross) - TX.childRelief * kids);
    let tax = FS.annualPIT(ch) * (w.policy ? w.policy.incomeTaxMult : 1);
    if (ch <= TX.rebate.upTo) tax = Math.max(0, tax - TX.rebate.amount);
    return tax;
  };
  // Monthly deduction (PCB) on one payment of gross pay (sen).
  FS.pcb = (w, p, gross) => Math.round(U.RM(FS.annualTaxOn(w, p, gross / 100 / w.price * 12) / 12) * w.price);

  // ---- Company tax ----
  FS.SME_BANDS = []; // tax.companyBands
  FS.corpTax = function (w, b, profit) {
    if (profit <= 0) return 0;
    const top = w.policy ? w.policy.corpTax : C.CORP_TAX, annual = profit * 12 / 100 / w.price;
    let tax = 0;
    if ((b.lastRevenue || 0) * 12 / 100 / w.price > TX.largeCompanyRevenue) tax = annual * top;
    else { let lo = 0; for (const [hi, r] of FS.SME_BANDS) { if (annual > lo) tax += (Math.min(annual, hi) - lo) * r * top / TX.companyRefRate; lo = hi; } }
    return Math.round(U.RM(tax / 12) * w.price);
  };

  // ---- Consumption taxes (inside prices) ----
  FS.RATES = {}; // tax.salesTax: rate by spending category for each sales-tax law
  // From the pack (tax.*): assessment = property tax as a share of rent (homes and business premises);
  // employerCorp = company tax of outside employers as a share of their wage bill; eis = employment
  // insurance from the worker and from the employer; federalShare = parts sent on to the national government.
  FS.ASSESSMENT = 0; FS.EMPLOYER_CORP = 0; FS.EIS = 0; FS.FEDERAL_SHARE = {};
  // Price multipliers of the sales-tax law relative to SST (content prices include SST).
  // Fuel subsidy: content prices assume today's targeted RON95 subsidy (RM1.99 a litre against
  // ~RM2.60 unsubsidised; fuel is about a quarter of vehicle costs). px = price multiplier on
  // vehicle costs; cost = the treasury's bill as a share of vehicle spending.
  FS.FUEL = {}; // tax.fuel
  FS.priceMult = function (law, fuel) {
    const R = FS.RATES[law] || FS.RATES.sst, S = FS.RATES.sst, out = {}, fx = (FS.FUEL[fuel] || FS.FUEL.targeted).px;
    for (const cat of ['food', 'transport', 'leisure']) out[cat] = S[cat].map((r, i) => (1 + R[cat][i]) / (1 + r) * (cat === 'transport' && i >= 1 ? fx : 1));
    out.housing = C.TIERS.housing.map(() => 1);
    out.child = (1 + R.child) / (1 + S.child);
    return out;
  };
  const inPrice = (amt, r) => amt * r / (1 + r);

  const comp = (w, role) => (LES.Council ? LES.Council.comp(w, role) : 0.5);
  FS.compliance = w => 0.86 + 0.12 * comp(w, 'treasurer');

  // Tax paid into the TAX sector and tagged by source (the treasury collects it monthly).
  FS.collect = function (w, from, fk, amt, key) {
    amt = Math.round(from.isSector ? amt : Math.min(amt, from[fk]));
    if (!(amt > 0) || !w.ledger.move(from, fk, w.ledger.sec.TAX, 'bal', amt)) return 0;
    FS.tag(w, key, amt);
    return amt;
  };
  FS.tag = (w, key, amt) => { if (w.gov && amt > 0) { const t = w.gov.month.tags; t[key] = (t[key] || 0) + amt; } };

  // Wage-related taxes, called from payroll: PCB, EIS, and the employer wage bill.
  FS.onPay = function (w, p, job, gross, er) {
    const g = w.gov, L = w.ledger;
    const tax = FS.collect(w, p, 'cash', FS.pcb(w, p, gross), 'income tax');
    p.taxYr = (p.taxYr || 0) + tax;
    const eis = Math.round(gross * FS.EIS), got = FS.collect(w, p, 'cash', eis, 'EIS contributions');
    const b = job.biz >= 0 ? w.biz[job.biz] : null;
    if (b && b.cash >= eis) FS.collect(w, b, 'cash', eis, 'EIS contributions');
    else FS.collect(w, L.sec.EMPLOYER, 'bal', eis, 'EIS contributions');
    const line = LES.Services.lineOf(job);
    if (line) g.month.wages[line] = (g.month.wages[line] || 0) + gross + er + eis;
    else if (!b && !C.JOB_BY_ID[job.jobId].commute) g.month.privWages += gross;
    return tax + got;
  };

  // The 2% tax on dividends above RM100k a year (Budget 2025).
  FS.dividendTax = function (w, p, part, acct) {
    if (!w.gov || part <= 0) return;
    const before = p.divYr || 0, lim = w.px(TX.dividend.above);
    p.divYr = before + part;
    const over = Math.max(0, p.divYr - Math.max(lim, before));
    if (over > 0) FS.collect(w, p, acct, Math.round(over * TX.dividend.rate), 'dividend tax');
  };

  // Zakat paid to the religious council is rebated against income tax paid that year.
  FS.zakatRebate = function (w, p, zakat) {
    if (!w.gov || !(p.taxYr > 0) || zakat <= 0) return 0;
    const amt = Math.min(zakat, p.taxYr);
    p.taxYr -= amt;
    const paid = LES.Gov.payOut(w, p, 'cash', amt, 'zakat rebates');
    p.earned.welfare += paid;
    return paid;
  };

  // Sales tax, assessment tax and employers' company tax for the month.
  function collectMonth(w) {
    const g = w.gov, L = w.ledger, F = LES.Finance, law = w.policy.salesTax === 'gst6' ? 'gst6' : 'sst', R = FS.RATES[law];
    let sales = 0, assess = 0, base = 0, fuel = 0;
    const fuelCost = (FS.FUEL[w.policy.fuelSubsidy] || FS.FUEL.targeted).cost;
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.away || p.inst) continue;
      const t = p.tiers, f = F.tierCost(w, 'food', t.food), tr = F.tierCost(w, 'transport', t.transport), le = F.tierCost(w, 'leisure', t.leisure), ch = F.careShare(w, p);
      sales += inPrice(f, R.food[t.food]) + inPrice(tr, R.transport[t.transport]) + inPrice(le, R.leisure[t.leisure]) + inPrice(ch, R.child);
      if (t.transport >= 1) fuel += tr / w.taxPx.transport[t.transport] * fuelCost;
      base += f + tr + le + ch;
      if (p.isHead) { const rent = F.tierCost(w, 'housing', t.housing); assess += rent * FS.ASSESSMENT; base += rent; }
    }
    const merch = L.sec.MERCHANT.bal - (g.lastMerchant === undefined ? L.sec.MERCHANT.bal : g.lastMerchant);
    sales += inPrice(Math.max(0, merch - base), R.other); // luxuries, outings, repairs, celebrations...
    for (const b of w.biz) if (b.open) assess += U.RM(b.typeDef.fixed) * w.price * FS.ASSESSMENT;
    const k = FS.compliance(w);
    FS.collect(w, L.sec.MERCHANT, 'bal', sales * k, TX.salesTaxNames[law]);
    FS.collect(w, L.sec.MERCHANT, 'bal', assess * (0.5 + 0.5 * k), 'assessment tax');
    FS.collect(w, L.sec.EMPLOYER, 'bal', g.month.privWages * FS.EMPLOYER_CORP * (w.policy.corpTax / TX.companyRefRate) * k, 'company tax (employers)');
    g.lastMerchant = L.sec.MERCHANT.bal;
    if (fuel > 0) LES.Gov.payOut(w, L.sec.MERCHANT, 'bal', fuel, 'fuel subsidies');
    g.lastMerchant = L.sec.MERCHANT.bal;
  }

  // ---- Treasury helpers ----
  const T = w => w.gov.treasury;
  FS.fundValue = function (w) {
    const f = w.gov.fund;
    if (!f) return 0;
    let v = f.units * w.mkt.idx;
    for (const tk in f.glc) { const s = w.mkt.byTk[tk]; if (s) v += f.glc[tk] * s.price; }
    return Math.round(v);
  };
  // Put money into the sovereign fund (index fund units, and GLC shares once listed).
  function invest(w, amt) {
    const f = w.gov.fund, M = LES.Market;
    amt = Math.min(Math.round(amt), T(w).cash);
    if (amt <= 0) return;
    w.ledger.move(T(w), 'cash', w.ledger.sec.MARKET, 'bal', amt);
    const glcs = w.mkt.stocks.filter(s => s.def.glc);
    const inGlc = glcs.length ? Math.round(amt * 0.4) : 0;
    for (const s of glcs) { const x = inGlc / glcs.length; f.glc[s.tk] = (f.glc[s.tk] || 0) + x / s.price; M.flow(w, s, x, 1); }
    f.units += (amt - inGlc) / w.mkt.idx;
    const wts = M.weights(w);
    w.mkt.stocks.forEach((s, i) => M.flow(w, s, (amt - inGlc) * wts[i], 1));
    f.invested += amt;
    w.gov.month.saved += amt;
  }
  // Sell fund units to cover a shortfall (before borrowing). Returns the amount raised.
  FS.drawFund = function (w, need) {
    const f = w.gov.fund;
    if (!f || f.units <= 0 || need <= 0) return 0;
    const amt = Math.min(Math.round(need), Math.floor(f.units * w.mkt.idx));
    if (amt <= 0) return 0;
    f.units = Math.max(0, f.units - amt / w.mkt.idx);
    w.ledger.move(w.ledger.sec.MARKET, 'bal', T(w), 'cash', amt);
    f.drawn += amt;
    return amt;
  };

  // ---- The monthly account ----
  FS.month = function (w, R, ts) {
    const g = w.gov, L = w.ledger, m = g.month, GV = LES.Gov, pol = w.policy, payOut = GV.payOut;
    collectMonth(w);
    const taxIn = L.sec.TAX.bal - g.lastTax;
    if (taxIn > 0) L.move(L.sec.TAX, 'bal', T(w), 'cash', taxIn);
    g.lastTax = L.sec.TAX.bal;
    let tagged = 0;
    for (const k in m.tags) { m.rev[k] = (m.rev[k] || 0) + m.tags[k]; tagged += m.tags[k]; }
    if (taxIn - tagged > 0) m.rev['fines & other'] = (m.rev['fines & other'] || 0) + taxIn - tagged;
    // Putrajaya's share: most company and dividend tax from the town's own firms goes to the
    // federal government (defence, national debt, the rest of Malaysia), as in reality.
    let fed = 0;
    for (const [k, share] of Object.entries(FS.FEDERAL_SHARE)) {
      const amt = Math.round((m.rev[k] || 0) * share);
      if (amt > 0 && L.move(T(w), 'cash', L.sec.ABROAD, 'bal', amt)) { m.rev[k] -= amt; fed += amt; }
    }
    m.federal = fed;

    // Costs the treasury reimburses: welfare office, public payroll, public hospitals.
    const welfareOut = g.lastWelfare - L.sec.WELFARE.bal;
    if (welfareOut > 0) payOut(w, L.sec.WELFARE, 'bal', welfareOut, 'welfare');
    g.lastWelfare = L.sec.WELFARE.bal;
    for (const line of Object.keys(m.wages)) if (m.wages[line] > 0) payOut(w, L.sec.EMPLOYER, 'bal', m.wages[line], line === 'council' ? 'council officials' : line);
    if (m.healthSub > 0) payOut(w, L.sec.HEALTH, 'bal', m.healthSub, 'public hospitals');
    const avgRev = FS.avgRevenue(w);
    const pres = g.president >= 0 ? w.people[g.president] : null;
    if (pres && pres.alive && !pres.away) {
      const s = payOut(w, pres, 'cash', U.clamp(avgRev * GK.leaderPay.share, w.px(GK.leaderPay.min), w.px(GK.leaderPay.max)), 'leader');
      pres.earned.wages += s; pres.monthIncome += s;
    }

    // Programmes (cash aid reaches B40 households through the community office: a weak
    // office misses some families and pays some who do not qualify).
    const cc = comp(w, 'community');
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.away) continue;
      let amt = 0, line = 'cash aid';
      if (pol.cashAid && p.isHead && (p.cls === 'B40' ? R.next() < 1 - 0.3 * (1 - cc) : p.cls === 'M40' && R.next() < 0.12 * (1 - cc))) amt += w.px(pol.cashAid);
      if (pol.ubi) { amt += w.px(pol.ubi); line = 'basic income & aid'; }
      if (p.pension > 0) { const a = payOut(w, p, 'cash', p.pension, 'civil service pensions'); p.earned.welfare += a; p.monthIncome += a; }
      if (p.eis && !p.job && w.day < p.eis.until) { const e = payOut(w, p, 'cash', p.eis.amt, 'job-loss benefit'); p.earned.welfare += e; p.monthIncome += e; }
      else if (p.eis && (p.job || w.day >= p.eis.until)) p.eis = null;
      if (amt) { const a = payOut(w, p, 'cash', amt, line); p.earned.welfare += a; p.monthIncome += a; }
    }
    if (pol.uniFees === 'free') {
      let fees = 0;
      for (const p of w.living) if (p.alive && p.enrol) { const c = C.COURSE_BY_ID[p.enrol.course]; fees += w.px(c.fee) / c.months; }
      if (fees) payOut(w, L.sec.EDUCATION, 'bal', fees, 'universities');
    }
    if (LES.Council) LES.Council.programmes(w, R);

    // Interest at the government bond rate (OPR + 1%), then repayments from spare cash.
    if (g.debt > 0) {
      payOut(w, L.sec.BANK, 'bal', Math.round(g.debt * (g.opr + 0.01) / 12), 'interest');
      const spare = T(w).cash - FS.reserveTarget(w);
      if (spare > 0) { const rep = Math.min(spare, g.debt); L.move(T(w), 'cash', L.sec.BANK, 'bal', rep); g.debt -= rep; }
    }
    // Surplus above the reserve: development, training and the sovereign fund (the
    // treasurer's budget sets the split).
    const spare = T(w).cash - FS.reserveTarget(w);
    if (spare > 0 && g.debt <= 0) {
      const b = g.budget || { dev: 0.5, train: 0.15, fund: 0.35 };
      const use = spare * 0.5;
      if (LES.Council) LES.Council.develop(w, use * b.dev, R);
      g.trainPool = (g.trainPool || 0) + Math.round(use * b.train);
      const full = FS.fundValue(w) > 3 * avgRev * 12; // the fund is big enough: build instead
      if (full && LES.Council) LES.Council.develop(w, use * b.fund, R); else invest(w, use * b.fund);
    }
    // Hiring freeze when debt mounts; austerity laws when it is serious.
    const annualRev = avgRev * 12;
    const ratio = g.debt / Math.max(w.px(2e4), annualRev);
    g.afford = U.clamp(g.afford * 0.8 + 0.2 * (ratio > 1 ? 0.7 : ratio > 0.5 ? 0.85 : 1), 0.6, 1);
    if (ratio > 1 && R.next() < 0.5) {
      if (g.laws.ubi !== '0') GV.setLaw(w, 'ubi', '0', 'austerity');
      else if (g.laws.cashAid === '300') GV.setLaw(w, 'cashAid', '100', 'austerity');
      else if (g.laws.salesTax === 'sst' && R.next() < 0.5) GV.setLaw(w, 'salesTax', 'gst6', 'austerity');
      else if (g.laws.incomeTax !== 'high') GV.setLaw(w, 'incomeTax', g.laws.incomeTax === 'low' ? 'normal' : 'high', 'austerity');
    }
    const rev = U.sum(Object.values(m.rev)), spend = U.sum(Object.values(m.spend));
    g.revHist.push(rev); if (g.revHist.length > 24) g.revHist.shift();
    g.last = { rev: m.rev, spend: m.spend, revTotal: rev, spendTotal: spend, saved: m.saved, fund: FS.fundValue(w), federal: m.federal || 0 };
    g.month = FS.newMonth();
  };
  FS.newMonth = () => ({ rev: {}, spend: {}, tags: {}, wages: {}, privWages: 0, healthSub: 0, saved: 0 });
  FS.avgRevenue = w => { const h = w.gov.revHist; return h.length ? U.sum(h.slice(-12)) / Math.min(12, h.length) : 0; };
  // Keep about three months of spending in hand.
  FS.reserveTarget = w => 3 * Math.max(w.px(5000), w.gov.last ? w.gov.last.spendTotal : 0);

  // ---- Yearly: Bank Negara, EPF dividends, fund returns, GLC listings, tax year ----
  FS.MY_OPR = 0; // the central bank's usual policy rate (bank.policyRate; Malaysia: OPR 2.75% since July 2025)
  FS.year = function (w, R) {
    const g = w.gov, L = w.ledger;
    // OPR: a smoothed Taylor-style rule on inflation and the business cycle.
    const target = FS.MY_OPR + 1.0 * (w.infl - 0.02) + (w.regime === 'growth' ? 0.0025 : w.regime === 'recession' ? -0.0075 : 0);
    const next = U.clamp(Math.round((0.5 * g.opr + 0.5 * target) / 0.0025) * 0.0025, Math.max(BK.floor, g.opr - 0.005), Math.min(BK.ceiling, g.opr + 0.005));
    if (Math.abs(next - g.opr) > 1e-9) w.pushFeed({ day: w.day, pid: -1, text: `${NM.centralBank} ${next > g.opr ? 'raised' : 'cut'} the ${NM.policyRate} to ${(next * 100).toFixed(2)}%`, cat: 'economy', imp: 1 });
    g.opr = next;
    g.oprHist.push({ day: w.day, opr: next });
    w.infl = U.clamp(w.infl - 0.2 * (next - FS.MY_OPR), w.cfg.inflMin / 100, w.cfg.inflMax / 100); // tighter money cools prices
    // EPF dividend on retirement savings (KWSP: ~5.5-6.3% in recent years).
    const div = RT.dividend[w.regime] || RT.dividend.normal;
    for (const p of w.living) if (p.alive && !p.away && p.epf > 0) L.pay('MARKET', p, 'epf', Math.round(p.epf * div));
    // The fund pays 4% of its value to the treasury each year.
    const fv = FS.fundValue(w);
    if (fv > 0) {
      const amt = FS.drawFund(w, fv * FD.payout);
      if (amt) g.month.rev[NM.fundReturns] = (g.month.rev[NM.fundReturns] || 0) + amt;
    }
    // Mature public finances: government-linked companies list on Bursa Rezeki.
    const years = w.day / 365, listed = w.mkt.stocks.filter(s => s.def.glc).length;
    if (!w.follower && years >= 8 && g.revHist.length >= 24 && g.debt < FS.avgRevenue(w) * 6 && listed < C.GLC_STOCKS.length && R.next() < 0.35) FS.listGlc(w, C.GLC_STOCKS[listed]);
    for (const p of w.living) { p.taxYr = 0; p.divYr = 0; if (p.pension > 0) p.pension = Math.round(p.pension * 1.02); } // pensions rise 2% a year
    g.devStock = Math.round(g.devStock * 0.94); // infrastructure wears out
  };

  FS.listGlc = function (w, def) {
    const mk = w.mkt, price = Math.round(U.RM(def.price0) * w.price);
    const s = { tk: def.tk, def, price, shares: def.sharesM * 1e6, hist: [], flowToday: 0, grossToday: 0, volEma: U.RM(5000), netEma: 0, fund: price, dev: 0, townBuy: 0, townSell: 0, lastRet: 0 };
    mk.stocks.push(s); mk.byTk[s.tk] = s;
    w.pushFeed({ day: w.day, pid: -1, text: `${def.name} (${def.tk}), a government-linked company (${def.blurb}), listed on ${NM.exchange} at ${U.fmtPrice(price)}; dividend yield about ${Math.round(def.div * 100)}%`, cat: 'economy', imp: 2 });
  };

  // Quarterly GLC dividends to residents and to the fund.
  FS.quarter = function (w) {
    const g = w.gov, L = w.ledger;
    for (const s of w.mkt.stocks) {
      if (!s.def.div) continue;
      const dps = s.price * s.def.div / 4;
      for (const p of w.living) {
        const n = p.inv.st[s.tk];
        if (!n || !p.alive || p.away) continue;
        const amt = Math.round(n * dps);
        if (amt <= 0) continue;
        L.pay('MARKET', p, 'cash', amt);
        p.earned.invest += amt; p.monthIncome += amt;
        FS.dividendTax(w, p, amt, 'cash');
      }
      const held = g.fund.glc[s.tk];
      if (held) { const amt = Math.round(held * dps); if (amt > 0) { L.pay('MARKET', T(w), 'cash', amt); g.month.rev['GLC dividends'] = (g.month.rev['GLC dividends'] || 0) + amt; } }
    }
  };

  // Rates the rest of the engine reads (only with a government; otherwise the classic rates).
  FS.depositRate = w => Math.max(0.005, w.gov.opr - 0.0025);
  FS.loanRate = w => w.gov.opr + 0.035;

  // Economy-wide multipliers from infrastructure and interest rates.
  FS.updateBoost = function (w, ts) {
    const g = w.gov, dev = U.clamp(g.devStock / Math.max(1, ts.pop * w.px(4000)), 0, 1.5), gap = (g.opr - FS.MY_OPR) / 0.01;
    g.devIdx = dev;
    w.boost = { biz: (1 + 0.04 * dev) * (1 - 0.02 * gap), vac: (1 + 0.08 * dev) * (1 - 0.04 * gap), flood: 1 - 0.5 * Math.min(1, dev) };
  };

  // What a person pays in sales tax each month under a given law (Year-1 RM).
  FS.salesTaxCost = function (w, p, law) {
    const R = FS.RATES[law], F = LES.Finance, t = p.tiers, base = c => F.tierCost(w, c, t[c]) / (w.taxPx ? w.taxPx[c][t[c]] : 1) / w.price / 100;
    return base('food') * R.food[t.food] + base('transport') * R.transport[t.transport] + base('leisure') * R.leisure[t.leisure];
  };

  // ---- National tax schedule, central bank, retirement scheme and fund from the country pack ----
  let TX = null, BK = null, RT = null, FD = null, GK = null, NM = null;
  LES.Countries.require('tax.incomeBands', 'tax.personalRelief', 'tax.retirementRelief', 'tax.childRelief', 'tax.rebate', 'tax.companyBands',
    'tax.companyRefRate', 'tax.largeCompanyRevenue', 'tax.salesTax', 'tax.salesTaxNames', 'tax.assessment', 'tax.employerCorp', 'tax.eis',
    'tax.federalShare', 'tax.fuel', 'tax.dividend', 'bank.policyRate', 'bank.floor', 'bank.ceiling', 'retirement.dividend', 'fund.payout',
    'gov.leaderPay', 'names.centralBank', 'names.policyRate', 'names.fundReturns', 'names.exchange');
  LES.Countries.on('fiscal', K => {
    TX = K.tax; BK = K.bank; RT = K.retirement; FD = K.fund; GK = K.gov; NM = K.names;
    const list = (a, src) => { a.length = 0; for (const x of src) a.push(x); }, into = (o, src) => { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, src); };
    list(FS.PIT_BANDS, TX.incomeBands); list(FS.SME_BANDS, TX.companyBands); into(FS.RATES, TX.salesTax); into(FS.FUEL, TX.fuel);
    into(FS.FEDERAL_SHARE, TX.federalShare); FS.ASSESSMENT = TX.assessment; FS.EMPLOYER_CORP = TX.employerCorp; FS.EIS = TX.eis;
    FS.MY_OPR = BK.policyRate;
  });
})(globalThis.LES = globalThis.LES || {});
