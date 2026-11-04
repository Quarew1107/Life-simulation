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
    const AT = TX.allowanceTaper, relief = AT && gross > AT.from ? Math.max(0, TX.personalRelief - (gross - AT.from) * AT.rate) : TX.personalRelief; // UK: GBP1 of allowance lost per GBP2 above GBP100k
    const ch = Math.max(0, gross - relief - Math.min(TX.retirementRelief.cap, TX.retirementRelief.rate * gross) - TX.childRelief * kids);
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
    const PB = TX.priceBase, S = FS.RATES[PB.salesTax], R = FS.RATES[law] || S, out = {}, fx = (FS.FUEL[fuel] || FS.FUEL[PB.fuel]).px; // content prices include today's tax and fuel price
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
    let ni = 0, erNi = 0;
    if (TX.ni) { // payroll tax on pay between thresholds (UK National Insurance, US FICA), and the employer's share
      const a = gross / 100 / w.price * 12, E = TX.ni.employee, R = TX.ni.employer;
      ni = FS.collect(w, p, 'cash', Math.round(U.RM((Math.max(0, Math.min(a, E.to) - E.from) * E.rate + Math.max(0, a - E.to) * E.above) / 12) * w.price), TX.ni.name || 'National Insurance');
      erNi = Math.round(U.RM(Math.max(0, a - R.from) * R.rate / 12) * w.price);
      if (b && b.cash >= erNi) FS.collect(w, b, 'cash', erNi, TX.ni.employerName || 'National Insurance (employers)');
      else FS.collect(w, L.sec.EMPLOYER, 'bal', erNi, TX.ni.employerName || 'National Insurance (employers)');
    }
    if (TX.stateBands) { // US: state income tax on the year's pay (Ohio: flat above an exempt amount) and city income tax
      const a = gross / 100 / w.price * 12;
      let st = 0, lo = 0;
      for (const [hi, r] of TX.stateBands) { if (a > lo) st += (Math.min(a, hi) - lo) * r; lo = hi; }
      ni += FS.collect(w, p, 'cash', Math.round(U.RM(st / 12) * w.price), TX.stateName || 'state income tax');
      if (TX.localIncome) ni += FS.collect(w, p, 'cash', Math.round(gross * TX.localIncome), TX.localName || 'city income tax');
    }
    if (LES.Countries.pack.welfare && LES.Countries.pack.welfare.model === 'usa') { // for tax credits and Social Security
      p.earnYr = (p.earnYr || 0) + gross;
      const SS = LES.Countries.pack.welfare.socialSecurity;
      if (p.ssEarn === undefined) ssInit(w, p, SS);
      p.ssEarn += Math.min(gross / w.price / 100, SS.cap / 12); p.ssMonths = (p.ssMonths || 0) + 1;
    }
    const line = LES.Services.lineOf(job);
    if (line) g.month.wages[line] = (g.month.wages[line] || 0) + gross + er + eis + erNi;
    else if (!b && !C.JOB_BY_ID[job.jobId].commute) g.month.privWages += gross;
    return tax + got + ni;
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
    if (!w.gov || !TX.zakatRebate || !(p.taxYr > 0) || zakat <= 0) return 0;
    const amt = Math.min(zakat, p.taxYr);
    p.taxYr -= amt;
    const paid = LES.Gov.payOut(w, p, 'cash', amt, 'zakat rebates');
    p.earned.welfare += paid;
    return paid;
  };

  // Council tax (UK): a household charge by housing tier, 25% off for people living alone, mostly
  // waived for households on Universal Credit (council tax support).
  function councilTax(w, p) {
    const CT = TX.councilTax, alone = p.partnerId === null || !w.people[p.partnerId].alive;
    const amt = w.px(CT.byTier[p.tiers.housing] || 0) * (alone ? 1 - CT.single : 1) * (p.ucLast > 0 ? 1 - CT.support : 1);
    FS.collect(w, p, 'cash', amt, 'council tax');
  }

  // UK benefits each month: Universal Credit (means-tested; the cash-aid law sets its standard
  // allowance), Child Benefit (tapered away for high earners), the State Pension and Pension Credit.
  function ukBenefits(w, p, pol, cc, R) {
    const WF = LES.Countries.pack.welfare, age = P.age(w, p), pay = (amt, line) => {
      if (!(amt > 0)) return 0;
      const a = LES.Gov.payOut(w, p, 'cash', amt, line); p.earned.welfare += a; p.monthIncome += a; return a;
    };
    const SPn = WF.statePension;
    if (age >= SPn.age) {
      const sp = w.px(SPn.weekly * 52 / 12);
      pay(sp, 'State Pension');
      pay(w.px(WF.pensionCredit.weekly * 52 / 12) - sp - (p.pension || 0), 'Pension Credit'); // tops up only very low pensions
    }
    if (!p.isHead) return;
    const q = p.partnerId !== null ? w.people[p.partnerId] : null, couple = !!(q && q.alive && !q.away);
    let kids = 0;
    for (const id of p.careOf) { const c = w.people[id]; if (c.alive && !c.adult) kids++; }
    if (kids) { // Child Benefit; the High Income Child Benefit Charge takes it back between GBP60k and GBP80k
      const CB = WF.childBenefit, top = Math.max(p.job ? p.job.salary : 0, couple && q.job ? q.job.salary : 0) * 12 / 100 / w.price;
      pay(w.px(CB.first + CB.other * (kids - 1)) * (1 - U.clamp((top - CB.taperFrom) / (CB.taperTo - CB.taperFrom), 0, 1)), 'Child Benefit');
    }
    p.ucLast = 0;
    const UC = WF.uc;
    if (!pol.cashAid || age >= SPn.age) return;
    const savings = p.cash + (couple ? q.cash : 0);
    if (savings > w.px(UC.capital.upper)) return;
    const F = LES.Finance, housing = Math.min(F.tierCost(w, 'housing', p.tiers.housing), F.tierCost(w, 'housing', UC.housingTier));
    const most = w.px(pol.cashAid * (couple ? UC.couple : 1)) + w.px(UC.child) * kids + housing;
    const earned = ((p.job ? p.job.salary : 0) + (couple && q.job ? q.job.salary : 0)) * UC.netShare;
    const allow = kids ? w.px(UC.workAllowance) : 0; // the work allowance is for parents (and disabled people)
    const tariff = Math.max(0, Math.ceil((savings - w.px(UC.capital.lower)) / w.px(250))) * w.px(UC.capital.per250);
    const award = Math.round(most - Math.max(0, earned - allow) * UC.taper - tariff);
    if (award < w.px(10)) return;
    if (p.ucTake === undefined) p.ucTake = R.next() < UC.takeUp + 0.1 * cc; // some never claim
    if (p.ucTake) p.ucLast = pay(award, 'Universal Credit');
  }

  // US benefits each month: Social Security (from the earnings record), SNAP food stamps (with the work
  // rule for adults without children), TANF cash for families, and the health cover everyone holds.
  // The Social Security record of someone who worked before joining the town: a typical wage from 22.
  function ssInit(w, p, SS) {
    const yrs = p.gen === 0 || p.migrant ? Math.max(0, P.age(w, p) - 22) : 0; // people born in town start at zero
    p.ssEarn = yrs * 12 * Math.min(Math.max(p.incomeEMA, p.job ? p.job.salary : 0, w.px(SS.typical)) / w.price / 100, SS.cap / 12) * 0.85; p.ssMonths = yrs * 12;
  }
  const FPL = (H, n) => H.fpl.base + H.fpl.perPerson * (n - 1); // federal poverty line for a household of n (a year)
  function usBenefits(w, p, cc, R) {
    const pack = LES.Countries.pack, WF = pack.welfare, age = P.age(w, p), pay = (amt, line) => {
      if (!(amt > 0)) return 0;
      const a = LES.Gov.payOut(w, p, 'cash', amt, line); p.earned.welfare += a; p.monthIncome += a; return a;
    };
    const SS = WF.socialSecurity;
    if (age >= SS.early && (p.retired || age >= SS.age)) {
      if (p.ssPIA === undefined) { // claims now: 90/32/15% of average indexed monthly earnings (35 years)
        if (p.ssEarn === undefined) ssInit(w, p, SS);
        const aime = p.ssEarn / 420, [b1, b2] = SS.bends, [r1, r2, r3] = SS.rates;
        const pia = Math.min(SS.max, r1 * Math.min(aime, b1) + r2 * U.clamp(aime - b1, 0, b2 - b1) + r3 * Math.max(0, aime - b2));
        p.ssPIA = pia * (age < SS.age ? SS.earlyFactor : 1);
      }
      pay(w.px(p.ssPIA), 'Social Security');
    }
    usHealth(w, p);
    if (!p.isHead) return;
    const q = p.partnerId !== null ? w.people[p.partnerId] : null, couple = !!(q && q.alive && !q.away);
    let kids = 0;
    for (const id of p.careOf) { const c = w.people[id]; if (c.alive && !c.adult) kids++; }
    const n = 1 + (couple ? 1 : 0) + kids, H = pack.health, earned = ((p.job ? p.job.salary : 0) + (couple && q.job ? q.job.salary : 0)) / w.price / 100;
    const SN = WF.snap;
    if (earned * 12 < FPL(H, n) * SN.grossFpl && p.cash + (couple ? q.cash : 0) < w.px(SN.assets)) {
      const able = !kids && age < 65 && !p.job && !(couple && q.job);
      p.snapMonths = able ? (p.snapMonths || 0) + 1 : 0;
      if (!able || p.snapMonths <= SN.ablebodiedMonths) {
        const net = Math.max(0, earned * (1 - SN.earnedDeduction) - SN.stdDeduction);
        if (p.snapTake === undefined) p.snapTake = R.next() < SN.takeUp;
        if (p.snapTake) pay(w.px(SN.max + SN.perPerson * (n - 1) - SN.benefitRate * net), 'SNAP (food stamps)');
      }
    }
    if (kids && earned < 1 && WF.tanf) { p.tanfMonths = (p.tanfMonths || 0) + 1; if (p.tanfMonths <= WF.tanf.months) pay(w.px(WF.tanf.amount), 'TANF'); }
  }
  // Health cover (US): Medicare from 65, Medicaid for low incomes (children up to a higher line), employer
  // cover for most jobs (and the family), a marketplace plan for some of the rest, otherwise none.
  // The premium is paid each month; a missed premium means no cover.
  function usHealth(w, p) {
    const H = LES.Countries.pack.health, age = P.age(w, p), head = p.isHead || !p.adult ? p : (p.partnerId !== null ? w.people[p.partnerId] : p);
    const q = head.partnerId !== null ? w.people[head.partnerId] : null, couple = !!(q && q.alive && !q.away);
    let kids = 0;
    for (const id of head.careOf) { const c = w.people[id]; if (c.alive && !c.adult) kids++; }
    const n = 1 + (couple ? 1 : 0) + kids, inc = ((head.job ? head.job.salary : 0) + (couple && q.job ? q.job.salary : 0)) / w.price / 100 * 12;
    const fpl = FPL(H, n), hash = k => ((p.id * 2654435761 + k * 40503) >>> 0) % 1000 / 1000; // fixed per person, no dice roll
    const offered = pp => pp && pp.job && (LES.Services.lineOf(pp.job) || hash(1) < H.offerRate);
    let cover = 'none';
    if (age >= 65) cover = 'medicare';
    else if (inc < fpl * H.medicaidFpl) cover = 'medicaid';
    else if (offered(p) || (couple && offered(p === head ? q : head))) cover = 'employer';
    else if (inc < fpl * H.subsidyFpl || hash(2) < H.buyRate) cover = 'market';
    const plan = H.plans[cover];
    if (plan && plan.premium > 0 && p.adult) {
      let prem = w.px(cover === 'employer' && (couple || kids) ? plan.familyPremium / (couple ? 2 : 1) : plan.premium);
      if (cover === 'market' && inc < fpl * H.subsidyFpl) prem = Math.min(prem, w.px(inc * H.subsidyCap / 12)); // premium tax credit
      if (cover === 'market' && hash(3) > H.buyRate && inc >= fpl * H.subsidyFpl) cover = 'none';
      else if (!w.ledger.spend(p, 'cash', 'MERCHANT', prem)) cover = 'none'; // could not pay the premium
    }
    p.cover = cover;
    if (p.isHead) for (const id of p.careOf) { const c = w.people[id]; if (c.alive && !c.adult) c.cover = inc < fpl * H.childFpl ? 'medicaid' : cover === 'medicare' ? 'none' : cover; } // children: CHIP, or the parent's plan
  }

  // Sales tax, assessment tax and employers' company tax for the month.
  function collectMonth(w) {
    const g = w.gov, L = w.ledger, F = LES.Finance, law = FS.RATES[w.policy.salesTax] ? w.policy.salesTax : Object.keys(FS.RATES)[0], R = FS.RATES[law];
    let sales = 0, assess = 0, base = 0, fuel = 0;
    const fuelCost = (FS.FUEL[w.policy.fuelSubsidy] || FS.FUEL[TX.priceBase.fuel]).cost;
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.away || p.inst) continue;
      const t = p.tiers, f = F.tierCost(w, 'food', t.food), tr = F.tierCost(w, 'transport', t.transport), le = F.tierCost(w, 'leisure', t.leisure), ch = F.careShare(w, p);
      sales += inPrice(f, R.food[t.food]) + inPrice(tr, R.transport[t.transport]) + inPrice(le, R.leisure[t.leisure]) + inPrice(ch, R.child);
      if (t.transport >= 1) fuel += tr / w.taxPx.transport[t.transport] * fuelCost;
      base += f + tr + le + ch;
      if (p.isHead) { const rent = F.tierCost(w, 'housing', t.housing); assess += rent * FS.ASSESSMENT; base += rent; if (TX.councilTax) councilTax(w, p); }
    }
    const merch = L.sec.MERCHANT.bal - (g.lastMerchant === undefined ? L.sec.MERCHANT.bal : g.lastMerchant);
    sales += inPrice(Math.max(0, merch - base), R.other); // luxuries, outings, repairs, celebrations...
    for (const b of w.biz) if (b.open) { assess += U.RM(b.typeDef.fixed) * w.price * FS.ASSESSMENT; if (TX.businessRates) FS.collect(w, b, 'cash', U.RM(b.typeDef.fixed) * w.price * TX.businessRates, 'business rates'); }
    const k = FS.compliance(w);
    FS.collect(w, L.sec.MERCHANT, 'bal', sales * k, TX.salesTaxNames[law]);
    FS.collect(w, L.sec.MERCHANT, 'bal', assess * (0.5 + 0.5 * k), TX.assessmentName || 'assessment tax');
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
    const meansTested = (LES.Countries.pack.welfare || {}).model === 'meansTested', usa = (LES.Countries.pack.welfare || {}).model === 'usa';
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.away) continue;
      let amt = 0, line = 'cash aid';
      if (usa) usBenefits(w, p, cc, R); // (US towns also keep the city's cash-aid law below)
      if (meansTested) ukBenefits(w, p, pol, cc, R);
      else if (pol.cashAid && p.isHead && (p.cls === 'B40' ? R.next() < 1 - 0.3 * (1 - cc) : p.cls === 'M40' && R.next() < 0.12 * (1 - cc))) amt += w.px(pol.cashAid);
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
      for (const [key, map, chance] of GK.austerity) { // the first step that applies ([law, { current: new }, chance])
        const to = map[g.laws[key]];
        if (!to || (chance !== undefined && !(R.next() < chance))) continue;
        GV.setLaw(w, key, to, 'austerity');
        break;
      }
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
    const div = w.regime in RT.dividend ? RT.dividend[w.regime] : RT.dividend.normal; // (0 is a real return)
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
    if (TX.credits) for (const p of w.living) { // US: Earned Income Tax Credit and Child Tax Credit with the tax return
      if (!p.alive || !p.isHead || p.away) continue;
      const q = p.partnerId !== null ? w.people[p.partnerId] : null, couple = !!(q && q.alive);
      let kids = 0;
      for (const id of p.careOf) { const c = w.people[id]; if (c.alive && P.age(w, c) < TX.credits.ctc.under) kids++; }
      const earn = ((p.earnYr || 0) + (couple ? q.earnYr || 0 : 0)) / 100 / w.price, liab = ((p.taxYr || 0) + (couple ? q.taxYr || 0 : 0)) / 100 / w.price;
      const E = TX.credits.eitc[Math.min(3, kids)], from = E.outFrom + (couple ? TX.credits.marriedExtra : 0);
      const eitc = Math.max(0, Math.min(E.max, earn * E.inRate, E.max - (earn - from) * E.outRate));
      const C2 = TX.credits.ctc, full = Math.max(0, kids * C2.amount - Math.max(0, earn - C2.phaseFrom * (couple ? 2 : 1)) * 0.05);
      const ctc = Math.min(full, liab + Math.min(kids * C2.refundable, 0.15 * Math.max(0, earn - 2500)));
      const amt = w.px(eitc + ctc);
      if (amt > 0) { const a = LES.Gov.payOut(w, p, 'cash', amt, 'tax credits (EITC, CTC)'); p.earned.welfare += a; if (a >= w.px(1000)) P.log(w, p, `Tax refund: ${U.fmtMoney(a)} in credits (EITC and Child Tax Credit)`, 'money', 0); }
    }
    for (const p of w.living) { p.taxYr = 0; p.divYr = 0; if (p.earnYr) p.earnYr = 0; if (p.pension > 0) p.pension = Math.round(p.pension * 1.02); } // pensions rise 2% a year
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
    'tax.companyRefRate', 'tax.priceBase', 'tax.largeCompanyRevenue', 'tax.salesTax', 'tax.salesTaxNames', 'tax.assessment', 'tax.employerCorp', 'tax.eis',
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
