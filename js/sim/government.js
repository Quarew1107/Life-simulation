// Government (setting "Government & elections": on / off). Plugs in through
// LES.Systems; with it off the engine is unchanged.
//
// - Treasury: taxes (income, corporate, fines, inheritance) flow into a real town
//   account; it pays for police salaries, cash aid, basic income, welfare, free
//   university and the leader's salary, and borrows from the bank when short.
// - Laws (w.policy): a catalogue of real levers the engine reads (tax rates, minimum
//   wage, aid, police force, drug policy, university fees, record checks, affirmative
//   action, bars). The elected leader changes them.
// - Elections every few years: candidates stand on platforms; each voter weighs what
//   every proposed law would mean for them (true effect + noise: people with more
//   education understand laws better), their leanings, the incumbent's record, identity,
//   charisma and campaign spending, then decides whether to vote at all.
// - Approval each month; corruption and scandals; floods and haze as town events.
// - Police officers are public servants: the budget sets how many are hired, and
//   officers per 1,000 residents (Malaysia ~4) set how often crimes are solved.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance;
  const GV = LES.Gov = {};
  const n01 = v => (v - 50) / 50;

  // ---- Laws: options, the left-right (econ: + = lower taxes, smaller state) and
  // conservative-liberal (soc: + = liberal) direction of each option, and who gains.
  GV.LAWS = []; // the country pack's law catalogue (gov.laws): key, name, default, options, effects on the economy and society
  GV.LAW_BY_KEY = {};
  GV.optName = (key, v) => { const o = GV.LAW_BY_KEY[key].options.find(x => x[0] === v); return o ? o[1] : v; };
  const EDU_MULT = { free: 0, subsidised: 1, expensive: 2.5 };
  GV.MY_POLICE = 4; // police officers per 1,000 people in the country (gov.policePer1000; Malaysia: PDRM 136,503 for ~34.3m)

  const lawDef = k => (GV.LAW_BY_KEY[k] || {}).def;
  GV.policyOf = function (laws) {
    return {
      incomeTaxMult: { low: 0.6, normal: 1, high: 1.5 }[laws.incomeTax], corpTax: Number(laws.corpTax) / 100,
      minWage: Number(laws.minWage), cashAid: Number(laws.cashAid), ubi: Number(laws.ubi), estateTax: Number(laws.estateTax),
      policePer1000: Number(laws.police), drugPolicy: laws.drugPolicy, uniFees: laws.uniFees,
      recordCheck: laws.recordCheck === 'allowed', affirm: laws.affirm, barBan: laws.barBan === 'ban',
      salesTax: laws.salesTax || lawDef('salesTax'), schools: laws.schools || lawDef('schools'), health: laws.health || lawDef('health'), fuelSubsidy: laws.fuelSubsidy || lawDef('fuelSubsidy'),
    };
  };
  // recost: also refresh everyone's monthly costs (not when a save is loaded: loading must not
  // change anything, or the loaded world would drift from the one that was saved).
  function applyLaws(w, recost = true) {
    w.policy = GV.policyOf(w.gov.laws);
    w.derived.eduMult = EDU_MULT[w.gov.laws.uniFees];
    w.taxPx = LES.Fiscal.priceMult(w.policy.salesTax, w.policy.fuelSubsidy); // GST and fuel subsidies change some prices
    if (recost) for (const p of w.living) if (p.alive && p.adult) p.mcost = LES.Finance.monthlyCost(w, p);
  }

  // ---- Treasury ----
  const T = w => w.gov.treasury;
  function borrow(w, amt) {
    if (amt <= 0) return;
    amt -= LES.Fiscal.drawFund(w, amt); // the sovereign fund is the rainy-day buffer
    if (amt <= 0) return;
    w.ledger.move(w.ledger.sec.BANK, 'bal', T(w), 'cash', amt);
    w.gov.debt += amt;
  }
  // Pay from the treasury into any account (borrowing if it is short).
  function payOut(w, to, tk, amt, line) {
    amt = Math.round(amt);
    if (amt <= 0) return 0;
    if (T(w).cash < amt) borrow(w, amt - T(w).cash);
    w.ledger.move(T(w), 'cash', to, tk, amt);
    w.gov.month.spend[line] = (w.gov.month.spend[line] || 0) + amt;
    return amt;
  }

  // ---- What a law option would mean for one person, in Year-1 RM per month ----
  function townStats(w) {
    const adults = w.living.filter(p => p.alive && p.adult && !p.away);
    let inc = 0, b40 = 0;
    for (const p of adults) { inc += Math.max(0, p.incomeEMA); if (p.isHead && p.cls === 'B40') b40++; }
    return { adults: Math.max(1, adults.length), avgInc: Math.max(1, inc / Math.max(1, adults.length)), b40, pop: Math.max(1, w.counts.living) };
  }
  // A person's share of what a tax-funded programme costs them (richer pay more tax).
  const costShare = (p, ts) => U.clamp(Math.max(0, p.incomeEMA) / ts.avgInc, 0.15, 4);
  GV.benefit = function (w, p, key, val, ts) {
    const cur = w.gov.laws[key], price = w.price, inc = Math.max(0, p.incomeEMA) / price / 100, age = P.age(w, p);
    if (val === cur) return 0;
    switch (key) {
      case 'incomeTax': {
        const m = { low: 0.6, normal: 1, high: 1.5 };
        const base = LES.Labour.incomeTax(w, Math.max(0, p.incomeEMA)) / (w.policy.incomeTaxMult || 1) / price / 100;
        return -base * (m[val] - m[cur]) + (m[val] - m[cur]) * 25; // a little more public money for everyone
      }
      case 'corpTax': {
        let profit = 0;
        for (const id in p.shares) { const b = w.biz[id]; if (b && b.open) profit += Math.max(0, b.lastProfit || 0) * p.shares[id]; }
        return -(Number(val) - Number(cur)) / 100 * profit / price / 100 + (Number(val) - Number(cur)) / 7 * 12; // less public money when firms pay less
      }
      case 'minWage': { // direct raises, knock-on raises just above it, a sense of fairness; costs for owners
        const d = Number(val) - Number(cur), owner = Object.keys(p.shares).length > 0, fair = p.cls === 'T20' ? 0 : 0.04 * d;
        if (p.job) { const s = p.job.salary / price / 100; return (s < Number(val) ? Math.max(0, Math.min(d, Number(val) - s)) : 0) + (s < 1.5 * Number(val) ? 0.15 * d : 0) + fair - (owner ? 0.15 * d : 0); }
        return (owner ? -0.25 * d : -0.02 * d) + fair; // fewer low-paid vacancies
      }
      case 'cashAid': {
        const d = Number(val) - Number(cur);
        return (p.cls === 'B40' && p.isHead ? d : 0) - d * ts.b40 / ts.adults * costShare(p, ts);
      }
      case 'ubi': { const d = Number(val) - Number(cur); return d - d * costShare(p, ts) * 0.9; }
      case 'estateTax': {
        const d = Number(val) - Number(cur), EA = LES.Countries.pack.tax.estateAllowance || 1e5, nw = Math.max(0, p.nw / price / 100 - EA);
        let parentNw = 0;
        for (const id of p.parents) { const q = w.people[id]; if (q.alive) parentNw += Math.max(0, q.nw / price / 100 - EA) / Math.max(1, q.children.length); }
        return -d * (age > 50 ? nw / Math.max(60, (85 - age) * 12) : 0) - d * parentNw / 240 + d * 20;
      }
      case 'police': {
        const d = Number(val) - Number(cur), cr = p.cr;
        const safety = 8 + (cr ? 60 * cr.fear + (cr.victim ? 25 : 0) : 0);
        const offender = cr && (cr.gang >= 0 || cr.offences > 0 || cr.user) ? 40 : 0;
        return d * (safety - offender) - d * 3.4 * ts.pop / ts.adults * costShare(p, ts);
      }
      case 'drugPolicy': {
        const user = p.cr && (p.cr.user || p.cr.addict > 0);
        const forUser = { national: 0, punitive: -200, treatment: 120, decriminalised: 260 }, moral = { national: 0, punitive: 30, treatment: -10, decriminalised: -70 };
        return (user ? forUser[val] - forUser[cur] : 0) + (p.relig > 60 ? moral[val] - moral[cur] : 0);
      }
      case 'uniFees': {
        const fee = { free: 0, subsidised: 650, expensive: 1600 }; // a typical degree's monthly fee
        let kids = 0;
        for (const id of p.careOf) { const c = w.people[id]; if (c.alive && P.age(w, c) >= 13) kids++; }
        const studying = (p.enrol ? 1 : 0) + kids * 0.5 + (age < 25 && !p.quals.length ? 0.4 : 0);
        return studying * (fee[cur] - fee[val]) - (fee[cur] - fee[val]) * 0.03 * costShare(p, ts);
      }
      case 'recordCheck': return p.cr && p.cr.rec ? (val === 'banned' ? 250 : -250) : (val === 'banned' ? -8 : 8);
      case 'affirm': {
        const bumi = PREF.includes(p.eth);
        const v = o => (o === 'group' ? (bumi ? 60 : -60) : o === 'need' ? (p.cls === 'B40' ? 50 : p.cls === 'T20' ? -20 : 0) : 0);
        return v(val) - v(cur);
      }
      case 'barBan': { // devout Muslims favour a ban; non-Muslims and bar-goers lose out; owners lose trade
        const v = o => (o === 'ban' ? (p.rel === 'islam' ? (p.relig > 70 ? 25 : p.relig > 50 ? 8 : -5) : -40) - (p.tiers.leisure >= 2 ? 15 : 0) - (Object.keys(p.shares).length ? 10 : 0) : 0);
        return v(val) - v(cur);
      }
      case 'salesTax': { // prices of taxed spending, against more public money
        const FS = LES.Fiscal, d = FS.salesTaxCost(w, p, val) - FS.salesTaxCost(w, p, cur);
        const raise = LES.Countries.pack.tax.salesTaxRaise;
        return -d + (val === raise ? -12 : 12); // more public money, but a broad new tax is deeply unpopular
      }
      case 'fuelSubsidy': { // what fuel costs this person, against the subsidy bill everyone shares
        const FS = LES.Fiscal, tr = LES.Finance.tierCost(w, 'transport', p.tiers.transport) / (w.taxPx ? w.taxPx.transport[p.tiers.transport] : 1) / price / 100;
        const px = o => (p.tiers.transport >= 1 ? FS.FUEL[o].px : 1), cost = o => FS.FUEL[o].cost;
        return -tr * (px(val) - px(cur)) - (cost(val) - cost(cur)) * 600 * costShare(p, ts) * 0.5;
      }
      case 'schools': {
        const lvl = { lean: -1, national: 0, generous: 1 }, d = lvl[val] - lvl[cur];
        let kids = 0;
        for (const id of p.careOf) { const c = w.people[id]; if (c.alive && !c.adult && !(c.school >= 0)) kids++; }
        const teacher = p.job && p.job.jobId === 'teacher' ? 120 : 0;
        return d * (70 * kids + teacher + (P.hasCred(p, 'BACH') && !p.job ? 40 : 0)) - d * 3.5 * 3800 / 1000 * ts.pop / ts.adults * costShare(p, ts);
      }
      case 'health': {
        const lvl = { lean: -1, national: 0, generous: 1 }, d = lvl[val] - lvl[cur];
        const need = 25 + (age > 55 ? 60 : 0) + (p.health < 60 ? 50 : 0) + p.careOf.length * 10;
        return d * need - d * (1.3 * 3400 + 0.65 * 11000) / 1000 * ts.pop / ts.adults * costShare(p, ts);
      }
      default: return 0;
    }
  };

  // Monthly cost of a programme option (Year-1 RM) compared with the treasury's income:
  // the share of revenue it would eat. Candidates with a sense of responsibility, and
  // voters who follow the news, worry about promises the town cannot afford.
  GV.burden = function (w, key, val, ts) {
    const rev = Math.max(2000, w.gov.revHist.length ? w.gov.revHist.slice(-12).reduce((s, x) => s + x, 0) / Math.min(12, w.gov.revHist.length) / w.price / 100 : 3000);
    const SV = LES.Services, hs = v => SV.HEALTH[v] || SV.HEALTH.national;
    const cost = {
      cashAid: v => Number(v) * ts.b40, ubi: v => Number(v) * ts.adults, police: v => Number(v) * ts.pop / 1000 * 3400, uniFees: v => (v === 'free' ? 650 * ts.adults * 0.03 : 0),
      schools: v => SV.SCHOOLS[v] * ts.pop / 1000 * SP.teacher, health: v => (hs(v)[0] * SP.nurse + hs(v)[1] * SP.doctor) * ts.pop / 1000,
      salesTax: v => (v === LES.Countries.pack.tax.salesTaxRaise ? -0.03 : 0) * rev * 3, // the broader tax brings in more money
      fuelSubsidy: v => LES.Fiscal.FUEL[v].cost * 600 * ts.adults * 0.6,
    }[key];
    if (!cost) return 0;
    return Math.max(0, (cost(val) - cost(w.gov.laws[key])) / rev);
  };

  // ---- Political leanings (-1..1): econ + = right, soc + = liberal ----
  function leanings(w, p, R) {
    const cls = p.cls === 'T20' ? 0.5 : p.cls === 'B40' ? -0.5 : 0;
    const age = P.age(w, p), parents = p.parents.map(id => w.people[id]).filter(q => q.pol);
    let econ = cls + 0.35 * n01(p.pers.risk) + 0.15 * n01(p.pers.resp) + R.normal(0, 0.35);
    let soc = -0.9 * ((p.relig || 0) / 100 - 0.4) - 0.012 * (age - 40) + 0.15 * n01(p.pers.risk) + R.normal(0, 0.35);
    if (parents.length) { const pe = parents.reduce((s, q) => s + q.pol.econ, 0) / parents.length, ps = parents.reduce((s, q) => s + q.pol.soc, 0) / parents.length; econ = 0.6 * econ + 0.4 * pe; soc = 0.6 * soc + 0.4 * ps; }
    return { econ: U.clamp(econ, -1, 1), soc: U.clamp(soc, -1, 1) };
  }
  const axis = (law, v, ax) => (law[ax] && law[ax][v] !== undefined ? law[ax][v] : 0);

  // ---- Elections ----
  const TITLES = {}; // gov.leaderTitles
  GV.title = w => TITLES[w.cfg.leaderTitle] || 'President';
  const COLOURS = ['#e63946', '#3a86ff', '#2a9d8f', '#f4a261', '#8338ec'];

  function eligible(w, p) { return p.alive && p.adult && !p.away && !p.inst && P.age(w, p) >= 21; }
  function pickCandidates(w, R) {
    const g = w.gov, out = [];
    const inc = g.president >= 0 ? w.people[g.president] : null;
    const limit = w.cfg.termLimit === '2' ? 2 : Infinity;
    if (inc && eligible(w, inc) && (g.terms[inc.id] || 0) < limit && g.approval >= 30) out.push(inc);
    const pool = w.living.filter(p => eligible(w, p) && P.age(w, p) >= 30 && P.age(w, p) <= 75 && !(p.cr && p.cr.rec) && p !== inc);
    const score = p => 0.5 * (p.att[C.CHA] - 5) + 1.2 * n01(p.pers.risk) + 0.8 * Math.log10(Math.max(1, P.realWorth(w, p) / 100) / 1e5) + (p.job && p.job.salary > w.px(6000) ? 0.6 : 0) + (p.manages >= 0 ? 0.5 : 0) + (p.relig > 80 ? 0.3 : 0) + R.normal(0, 0.8);
    pool.sort((a, b) => score(b) - score(a));
    for (const p of pool) { if (out.length >= 3 + (R.next() < 0.4 ? 1 : 0)) break; out.push(p); }
    return out;
  }
  // A candidate's platform: the few laws they most want to change (leanings + self-interest).
  // What a sample of voters would make of each law option (candidates read the polls).
  function polls(w, ts, R) {
    const g = w.gov, sample = [], out = {};
    for (let k = 0; k < 60 && w.living.length; k++) { const p = w.living[Math.floor(R.next() * w.living.length)]; if (eligible(w, p) && p.pol) sample.push(p); }
    if (!sample.length) return out;
    for (const law of GV.LAWS) for (const [v] of law.options) {
      if (v === g.laws[law.key]) continue;
      let s = 0;
      for (const p of sample) {
        const scale = Math.max(300, Math.max(0, p.incomeEMA) / w.price / 100 * 0.15);
        s += GV.benefit(w, p, law.key, v, ts) / scale + 0.6 * ((axis(law, v, 'econ') - axis(law, g.laws[law.key], 'econ')) * p.pol.econ + (axis(law, v, 'soc') - axis(law, g.laws[law.key], 'soc')) * p.pol.soc);
      }
      out[`${law.key}|${v}`] = s / sample.length;
    }
    return out;
  }
  function platform(w, c, ts, R, poll) {
    const pl = {}, wants = [];
    for (const law of GV.LAWS) {
      let best = w.gov.laws[law.key], bestS = 0;
      for (const [v] of law.options) {
        if (v === w.gov.laws[law.key]) continue;
        const s = 0.9 * (axis(law, v, 'econ') - axis(law, w.gov.laws[law.key], 'econ')) * c.pol.econ + 0.9 * (axis(law, v, 'soc') - axis(law, w.gov.laws[law.key], 'soc')) * c.pol.soc
          + GV.benefit(w, c, law.key, v, ts) / 400 + R.normal(0, 0.25)
          + 1.5 * (poll[`${law.key}|${v}`] || 0) // what wins votes
          - 2.5 * Math.max(0, GV.burden(w, law.key, v, ts) - 0.15) * (0.4 + c.pers.resp / 100); // can the town pay for it?
        if (s > bestS) { bestS = s; best = v; }
      }
      if (best !== w.gov.laws[law.key]) wants.push({ key: law.key, v: best, s: bestS });
    }
    wants.sort((a, b) => b.s - a.s);
    for (const x of wants.slice(0, 4)) pl[x.key] = x.v;
    return pl;
  }

  function startCampaign(w) {
    const g = w.gov, R = w.rng.gov, ts = townStats(w);
    const cands = pickCandidates(w, R);
    if (!cands.length) { g.electionDay += 365; return; }
    const poll = polls(w, ts, R);
    g.campaign = cands.map((c, i) => {
      c.pol = c.pol || leanings(w, c, R);
      const spend = Math.min(Math.round(c.cash * 0.08), w.px(60000));
      if (spend > 0) w.ledger.spend(c, 'cash', 'MERCHANT', spend);
      P.log(w, c, `Is standing for ${GV.title(w)}${spend ? ` (campaign spending ${U.fmtMoney(spend)})` : ''}`, 'politics', 1);
      return { id: c.id, colour: COLOURS[i % COLOURS.length], platform: platform(w, c, ts, R, poll), spend, incumbent: c.id === g.president, votes: 0 };
    });
    w.pushFeed({ day: w.day, pid: -1, text: `Election campaign: ${g.campaign.map(c => P.name(w.people[c.id])).join(' vs ')} - polling day ${U.fmtDate(g.electionDay)}`, cat: 'politics', imp: 2 });
  }

  // Each voter's utility for each candidate (and whether they will turn out).
  function decide(w, p, R, ts) {
    const g = w.gov, cands = g.campaign;
    const understanding = U.clamp(0.7 * p.att[C.INT] / 10 + (p.quals.some(P.isBachelor) ? 0.3 : p.quals.length ? 0.12 : 0), 0, 1);
    const sd = 70 + 230 * (1 - understanding) + (g.misinfo > w.day ? 120 : 0); // misinformation muddies the picture
    const scale = Math.max(300, Math.max(0, p.incomeEMA) / w.price / 100 * 0.15);
    const idW = { none: 0, moderate: 1, strong: 2 }[w.cfg.identityVoting] ?? 1;
    const perceived = {}; // each law option once per voter
    let best = -Infinity, second = -Infinity, choice = -1;
    cands.forEach((c, i) => {
      const cand = w.people[c.id];
      let u = 0;
      for (const key in c.platform) {
        const k2 = `${key}|${c.platform[key]}`;
        if (perceived[k2] === undefined) perceived[k2] = GV.benefit(w, p, key, c.platform[key], ts) + R.normal(0, sd)
          - understanding * 400 * Math.max(0, GV.burden(w, key, c.platform[key], ts) - 0.2); // "who will pay for this?"
        u += perceived[k2] / scale;
        const law = GV.LAW_BY_KEY[key];
        u += 0.6 * ((axis(law, c.platform[key], 'econ') - axis(law, g.laws[key], 'econ')) * p.pol.econ + (axis(law, c.platform[key], 'soc') - axis(law, g.laws[key], 'soc')) * p.pol.soc);
      }
      u -= 0.5 * (Math.abs(p.pol.econ - cand.pol.econ) + Math.abs(p.pol.soc - cand.pol.soc));
      u += idW * (0.25 * (p.eth === cand.eth ? 1 : 0) + 0.25 * (p.rel && p.rel === cand.rel ? 1 : 0));
      u += 0.08 * (cand.att[C.CHA] - 5) + 0.22 * Math.log10(1 + c.spend / w.px(5000));
      if (c.incumbent) u += 0.4 + (g.approval - 50) / 22; // name recognition, plus the record
      u += -Math.log(-Math.log(Math.max(1e-9, R.next()))); // Gumbel noise: a logit choice
      if (u > best) { second = best; best = u; choice = i; } else if (u > second) second = u;
    });
    const stake = U.clamp(best - second, 0, 2);
    const pv = U.sigmoid(0.4 + 0.025 * (P.age(w, p) - 40) + 0.4 * understanding + 0.6 * (p.relig || 0) / 100 + 0.3 * stake - (p.stress > 75 ? 0.5 : 0));
    return { choice, vote: R.next() < pv };
  }

  // tally: count the votes and install the winner.
  function tally(w, instant) {
    const g = w.gov, cands = g.campaign, R = w.rng.gov, ts = instant ? townStats(w) : null;
    const res = { day: w.day, cands: cands.map(c => ({ id: c.id, name: P.name(w.people[c.id]), colour: c.colour, votes: 0, platform: c.platform, incumbent: c.incumbent })), eligible: 0, voted: 0, by: { cls: {}, rel: {}, eth: {} } };
    for (const p of w.living) {
      if (!eligible(w, p) || !p.pol) continue;
      res.eligible++;
      let ch;
      if (instant) { const d = decide(w, p, R, ts); if (!d.vote) continue; ch = d.choice; } else { if (p.pol.voted !== w.day) continue; ch = p.pol.choice; }
      if (ch < 0) continue;
      res.voted++; res.cands[ch].votes++;
      for (const [grp, k] of [['cls', p.cls || '-'], ['rel', p.rel || '-'], ['eth', p.eth]]) { const t = res.by[grp][k] = res.by[grp][k] || {}; t[ch] = (t[ch] || 0) + 1; }
    }
    const order = res.cands.map((c, i) => i).sort((a, b) => res.cands[b].votes - res.cands[a].votes || res.cands[a].id - res.cands[b].id);
    const win = res.cands[order[0]];
    res.winner = win.id;
    const prev = g.president;
    g.president = win.id; g.terms[win.id] = (g.terms[win.id] || 0) + 1; g.termStart = w.day;
    g.agenda = Object.entries(win.platform).map(([key, v]) => ({ key, v }));
    g.approval = 55; g.scandal = 0;
    for (const p of w.living) if (p.pol) p.pol.incStart = p.incomeEMA / w.price;
    g.elections.push(res);
    if (g.elections.length > 40) g.elections.shift();
    g.campaign = null;
    g.electionDay = w.day + Math.round(w.cfg.termYears * 365);
    const turnout = res.eligible ? Math.round(res.voted / res.eligible * 100) : 0;
    const winner = w.people[win.id];
    P.log(w, winner, `${prev === win.id ? 'Re-elected' : 'Elected'} ${GV.title(w)} of ${LES.townName(w)} with ${win.votes} votes`, 'politics', 3);
    w.pushFeed({ day: w.day, pid: win.id, text: `${P.name(winner)} ${prev === win.id ? 'was re-elected' : 'won the election'} as ${GV.title(w)} (${res.cands.map(c => `${c.name.split(' ')[0]} ${c.votes}`).join(', ')}; turnout ${turnout}%)`, cat: 'politics', imp: 3 });
    w.townVersion++; // banners come down
    if (LES.Council && w.gov.officials) LES.Council.reshuffle(w);
  }

  function enactNext(w) {
    const g = w.gov;
    while (g.agenda && g.agenda.length) {
      const { key, v } = g.agenda.shift();
      if (g.laws[key] === v) continue;
      setLaw(w, key, v, 'platform');
      return;
    }
  }
  function setLaw(w, key, v, why) {
    const g = w.gov, old = g.laws[key];
    if (g.frozen) return; // laws held fixed (experiments, tests)
    g.laws[key] = v;
    applyLaws(w);
    g.lawLog.push({ day: w.day, key, from: old, to: v, by: g.president, why });
    if (g.lawLog.length > 200) g.lawLog.shift();
    const pres = g.president >= 0 ? w.people[g.president] : null;
    w.pushFeed({ day: w.day, pid: pres ? pres.id : -1, text: `${pres ? `${GV.title(w)} ${P.name(pres)}` : 'The town council'} changed the law: ${GV.LAW_BY_KEY[key].name} → ${GV.optName(key, v)}${why === 'austerity' ? ' (the treasury is deep in debt)' : why === 'emergency' ? ' (emergency)' : why === 'surplus' ? ' (the treasury has money to spare)' : ''}`, cat: 'politics', imp: 2 });
  }

  // ---- Monthly finances: js/sim/fiscal.js; staffing: js/sim/services.js ----
  function policeFactorOf(w, ts) {
    const g = w.gov, active = w.living.filter(p => p.alive && !p.inst && p.job && p.job.jobId === 'police' && !(p.job.biz >= 0)).length;
    g.officers = active;
    g.policeFactor = U.clamp(Math.max(0.3, active) / (ts.pop / 1000) / GV.MY_POLICE, 0.15, 2.5);
  }

  function approvalMonth(w, R) {
    const g = w.gov, pres = g.president >= 0 ? w.people[g.president] : null;
    if (!pres) return;
    const sample = [];
    for (let k = 0; k < 160 && w.living.length; k++) { const p = w.living[Math.floor(R.next() * w.living.length)]; if (p.alive && p.adult && p.pol) sample.push(p); }
    if (!sample.length) return;
    const regime = w.regime === 'growth' ? 8 : w.regime === 'recession' ? -12 : 0;
    let sum = 0;
    for (const p of sample) {
      const now = p.incomeEMA / w.price, then = p.pol.incStart || now;
      let s = 50 + 25 * Math.tanh((now - then) / Math.max(then, U.RM(1500))) + regime - 25 * (p.cr ? p.cr.fear : 0)
        - 14 * (Math.abs(p.pol.econ - pres.pol.econ) + Math.abs(p.pol.soc - pres.pol.soc)) / 2 - g.scandal;
      if (p.rel === pres.rel) s += 3;
      sum += U.clamp(s, 0, 100);
    }
    g.approval = Math.round(0.6 * g.approval + 0.4 * sum / sample.length);
    g.scandal = Math.max(0, g.scandal * 0.92 - 0.5);
  }

  // A leader with low responsibility and a taste for risk may skim the treasury.
  function corruptionMonth(w, R) {
    const g = w.gov, pres = g.president >= 0 ? w.people[g.president] : null;
    if (!pres || !pres.alive || pres.away) return;
    if (pres.pers.resp < 45 && pres.pers.risk > 55 && R.next() < 0.2 && T(w).cash > w.px(5000)) {
      const amt = Math.min(Math.round(T(w).cash * R.range(0.01, 0.04)), w.px(80000));
      w.ledger.move(T(w), 'cash', pres, 'cash', amt);
      g.skimmed += amt; g.skimNow += amt;
    }
    if (g.skimNow > 0 && R.next() < 0.07) { // the anti-corruption commission finds out
      const back = Math.min(pres.cash, g.skimNow);
      w.ledger.move(pres, 'cash', T(w), 'cash', back);
      g.scandal = 35; g.scandals++;
      P.log(w, pres, `Corruption scandal: caught taking ${U.fmtMoney(g.skimNow)} from the treasury (${U.fmtMoney(back)} recovered)`, 'politics', 3);
      w.pushFeed({ day: w.day, pid: pres.id, text: `Scandal! ${GV.title(w)} ${P.name(pres)} took ${U.fmtMoney(g.skimNow)} of public money`, cat: 'politics', imp: 3 });
      g.skimNow = 0;
      if (w.crime && R.next() < 0.6) { LES.Crime.admit(w, pres, 'prison', Math.round(R.range(24, 60)), 'corruption'); }
      if (!g.campaign && g.electionDay - w.day > 120) g.electionDay = w.day + 90; // snap election
    }
  }

  // Leaders react to emergencies (popular, and sometimes needed).
  function respond(w, R, ts) {
    const g = w.gov, pres = g.president >= 0 ? w.people[g.president] : null;
    if (!pres || R.next() > 0.25) return;
    const EM = LES.Countries.pack.gov.emergency, aid = EM.aid[1][g.laws[EM.aid[0]]], cops = EM.police[1][g.laws[EM.police[0]]]; // [law, { current: new }]
    if (w.regime === 'recession' && aid && pres.pol.econ < 0.4) setLaw(w, EM.aid[0], aid, 'emergency');
    if (w.crime && LES.Crime.rates(w).index > 1.6 * LES.Crime.REF.index * (LES.Crime.INTENSITY[w.cfg.crime] || 1) && cops) setLaw(w, EM.police[0], cops, 'emergency');
    void ts;
  }

  // ---- Events: monsoon floods and haze ----
  function eventsDay(w, R) {
    const g = w.gov, doy = w.date.doy;
    const EV = LES.Countries.pack.events || {}, FL = EV.flood, HZ = EV.haze;
    if (FL && doy === FL.doy && (w.region ? w.region.monsoon(w.day) : R.next() < FL.chance)) { // one monsoon for the whole region // north-east monsoon floods
      const t = w.town;
      const low = t.blocks.map((b, i) => ({ b, i })).filter(({ b }) => 'KAFTR'.includes(b.code) && (b.code === 'K' || b.code === 'A' || (t.layout && t.layout.river >= 0 && Math.abs(b.c - t.layout.river) <= 1) || R.next() < 0.15));
      const hit = [];
      while (low.length && hit.length < Math.min(4, 1 + Math.floor(t.blocks.length / 30))) hit.push(low.splice(Math.floor(R.next() * low.length), 1)[0].i);
      if (!hit.length) return;
      let homes = 0;
      for (const p of w.living) {
        if (!p.alive || !p.adult || !p.isHead || p.homeId < 0) continue;
        const hb = t.buildings[p.homeId], bl = LES.townBlockAt(t, hb.x, hb.y);
        if (!hit.includes(t.blocks.indexOf(bl))) continue;
        homes++;
        const loss = Math.min(p.cash, Math.round(w.px(R.range(300, 6000)) * (w.boost ? w.boost.flood : 1))); // drains and flood barriers help
        w.ledger.spend(p, 'cash', 'MERCHANT', loss);
        p.stress = Math.min(100, p.stress + 20); p.health = Math.max(1, p.health - 3);
        const aid = payOut(w, p, 'cash', w.px(FL.relief), 'flood relief'); // Malaysia: Bantuan Wang Ihsan, RM1,000 per household
        p.earned.welfare += aid;
        P.log(w, p, `Home was flooded (${U.fmtMoney(loss)} of damage, ${U.fmtMoney(aid)} government aid)`, 'luck', 1);
      }
      g.flood = { blocks: hit, until: w.day + 10 }; g.floods++;
      w.pushFeed({ day: w.day, pid: -1, text: `${FL.name}: ${homes} household${homes === 1 ? '' : 's'} hit; ${LES.Countries.pack.money.symbol}${FL.relief.toLocaleString('en-US')} relief each from the treasury`, cat: 'economy', imp: 2 });
    }
    if (HZ && doy === HZ.doy && R.next() < HZ.chance) { g.haze = { until: w.day + HZ.days }; g.hazes++; w.pushFeed({ day: w.day, pid: -1, text: HZ.text, cat: 'economy', imp: 2 }); }
    if (g.haze && w.day < g.haze.until) for (const p of w.living) if (p.alive) p.health = Math.max(1, p.health - (P.age(w, p) > 60 || P.age(w, p) < 5 ? 0.12 : 0.05));
  }

  const sys = {
    id: 'gov', order: 30,
    enabled: cfg => cfg.government === 'on',
    init(w) {
      const laws = {};
      for (const l of GV.LAWS) laws[l.key] = l.def;
      laws.drugPolicy = w.cfg.drugPolicy || 'national'; laws.uniFees = w.cfg.education;
      w.gov = {
        treasury: { cash: 0 }, debt: 0, laws, lawLog: [], president: -1, terms: {}, termStart: 0, approval: 55, scandal: 0, scandals: 0, skimmed: 0, skimNow: 0,
        elections: [], campaign: null, electionDay: Math.round(w.cfg.termYears * 365), agenda: [], misinfo: -1,
        month: LES.Fiscal.newMonth(), last: null, revHist: [], estateTaxTotal: 0,
        opr: LES.Fiscal.MY_OPR, oprHist: [], fund: { units: 0, glc: {}, invested: 0, drawn: 0 }, devStock: 0, devIdx: 0, afford: 1,
        budget: { dev: 0.5, train: 0.15, fund: 0.35 }, officials: { treasurer: null, police: null, community: null }, offLog: [], trainPool: 0,
        staff: {}, eduQ: 1, healthQ: 1, lastMerchant: w.ledger.sec.MERCHANT.bal,
        lastTax: w.ledger.sec.TAX.bal, lastWelfare: w.ledger.sec.WELFARE.bal,
        officers: 0, policeFactor: 1, flood: null, haze: null, floods: 0, hazes: 0,
        frozen: w.cfg.freezeLaws === 'yes',
      };
      w.bizTypes = C.BIZ.concat(C.BIZ_SERVICES); // private clinics, schools and hospitals
      w.refreshLiving(); // founders exist, but the living list is built after the systems start
      applyLaws(w);
      const R = w.rng.gov;
      for (const p of w.people) p.pol = leanings(w, p, R);
      // The founders choose the first leader straight away.
      startCampaign(w);
      if (w.gov.campaign) tally(w, true);
      const ts = townStats(w);
      LES.Services.staffMonth(w, ts);
      policeFactorOf(w, ts);
      LES.Fiscal.updateBoost(w, ts);
      if (w.gov.president >= 0) LES.Council.reshuffle(w);
    },
    personCreated(w, p) { if (w.gov && p.adult) p.pol = leanings(w, p, w.rng.gov); },
    death(w, p) { // the office falls vacant at once; officials are replaced next month
      const g = w.gov;
      if (g.president === p.id) {
        w.pushFeed({ day: w.day, pid: p.id, text: `${GV.title(w)} ${P.name(p)} died in office; a by-election is called`, cat: 'politics', imp: 2 });
        g.president = -1; g.agenda = [];
        if (!g.campaign) { g.electionDay = w.day + 60; startCampaign(w); }
      }
      for (const r in g.officials) if (g.officials[r] && g.officials[r].id === p.id) { g.officials[r] = null; LES.Council.log(w, r, p.id, `${P.name(p)} died in office`); }
    },
    money: w => w.gov.treasury.cash,
    hireWeight(w, p) {
      const a = w.policy.affirm, t = p.trainUntil > 0 ? LES.Council.hireBoost(w, p) : 1;
      if (a === 'group' && PREF.includes(p.eth)) return 1.08 * t;
      if (a === 'need' && p.cls === 'B40') return 1.08 * t;
      return t;
    },
    venueBias: (w, p, k) => (k === 'karaoke' && w.policy.barBan ? -20 : 0),

    candidates(w, p, ctx, slot, add) {
      const g = w.gov;
      if (slot !== 0 || w.day !== g.electionDay || !p.pol || p.pol.intent !== w.day) return;
      const school = w.town.kinds.school && w.town.kinds.school.length ? LES.townNear(w.town, 'school', p.homeId) : p.homeId;
      add(0, 'VOTE', 5 + 0.6 * ctx.resp, school, null); // polling day is usually a public holiday
    },
    label: id => (id === 'VOTE' ? 'Vote at the polling station' : undefined),
    resolve(w, p, c) {
      if (c.id !== 'VOTE') return false;
      p.pol.voted = w.day; p.energy -= 3;
      return true;
    },

    day(w) {
      const g = w.gov, R = w.rng.gov;
      if (!p0(w)) return;
      eventsDay(w, R);
      if (w.day === g.electionDay - 60 && !g.campaign) startCampaign(w);
      if (g.campaign && w.day === g.electionDay - 1) { // polling eve: everyone makes up their mind
        const ts = townStats(w);
        for (const p of w.living) {
          if (!eligible(w, p)) continue;
          p.pol = p.pol || leanings(w, p, R);
          const d = decide(w, p, R, ts);
          p.pol.choice = d.choice; p.pol.intent = d.vote ? w.day + 1 : -1;
        }
      }
      if (g.campaign && w.day === g.electionDay) tally(w, false);
      if (g.campaign && w.day > g.electionDay) tally(w, true); // (a campaign that ran past polling day)
      const pres = g.president >= 0 ? w.people[g.president] : null;
      if (pres && (!pres.alive || pres.away || (pres.inst && pres.inst.kind === 'prison'))) { // the office falls vacant
        w.pushFeed({ day: w.day, pid: pres.id, text: `The office of ${GV.title(w)} is vacant (${!pres.alive ? 'died' : pres.away ? 'moved away' : 'in prison'}); a by-election is called`, cat: 'politics', imp: 2 });
        g.president = -1; g.agenda = [];
        if (!g.campaign) { g.electionDay = w.day + 60; startCampaign(w); }
      }
    },

    month(w) {
      const g = w.gov, R = w.rng.gov, ts = townStats(w);
      for (const p of w.living) {
        if (!p.alive || !p.adult) continue;
        if (!p.pol) p.pol = leanings(w, p, R);
        if (p.job && p.job.salary < w.px(w.policy.minWage)) p.job.salary = w.px(w.policy.minWage); // the minimum wage applies to everyone
      }
      LES.Services.staffMonth(w, ts);
      policeFactorOf(w, ts);
      LES.Services.schoolMonth(w);
      if (w.date.month % 3 === 2) LES.Fiscal.quarter(w);
      LES.Fiscal.month(w, R, ts);
      LES.Council.month(w, R);
      LES.Fiscal.updateBoost(w, ts);
      approvalMonth(w, R);
      corruptionMonth(w, R);
      respond(w, R, ts);
      if (w.date.month % 2 === 0) enactNext(w);
    },
    year(w) { // leanings drift slowly with class and age; the budget, Bank Negara, schools
      const R = w.rng.gov;
      LES.Services.childYear(w);
      LES.Council.year(w, R);
      LES.Fiscal.year(w, R);
      for (const p of w.living) if (p.alive && p.adult && p.pol) { const fresh = leanings(w, p, R); p.pol.econ = 0.85 * p.pol.econ + 0.15 * fresh.econ; p.pol.soc = 0.85 * p.pol.soc + 0.15 * fresh.soc; }
    },

    snapshot(w, row) {
      const g = w.gov;
      row.gov = { treasury: g.treasury.cash / w.price, debt: g.debt / w.price, approval: g.approval, officers: g.officers, police: g.policeFactor, rev: g.last ? g.last.revTotal / w.price : 0, spend: g.last ? g.last.spendTotal / w.price : 0, president: g.president,
        opr: g.opr, fund: LES.Fiscal.fundValue(w) / w.price, eduQ: g.eduQ, healthQ: g.healthQ, dev: g.devIdx, teachers: g.staff.teacher ? g.staff.teacher.have : 0, nurses: g.staff.nurse ? g.staff.nurse.have : 0, doctors: g.staff.doctor ? g.staff.doctor.have : 0 };
    },
    invariants(w, errs) {
      const g = w.gov;
      if (!Number.isInteger(g.treasury.cash) || g.treasury.cash < 0) errs.push(`treasury ${g.treasury.cash}`);
      if (!(g.debt >= 0) || !Number.isFinite(g.debt)) errs.push(`debt ${g.debt}`);
      for (const l of GV.LAWS) if (!l.options.some(o => o[0] === g.laws[l.key])) errs.push(`law ${l.key}=${g.laws[l.key]}`);
      for (const e of g.elections) if (e.cands.reduce((s, c) => s + c.votes, 0) !== e.voted || e.voted > e.eligible) errs.push(`election ${e.day} votes do not add up`);
      if (g.president >= 0 && !w.people[g.president].alive) errs.push('dead president in office');
      if (!(g.fund.units >= 0)) errs.push(`fund units ${g.fund.units}`);
      for (const r in g.officials) { const o = g.officials[r]; if (o && o.id >= 0 && !w.people[o.id].alive) errs.push(`dead official ${r}`); }
    },
    hash(w, parts) { const g = w.gov; parts.push(g.treasury.cash, Math.round(g.debt), g.president, ...GV.LAWS.map(l => g.laws[l.key])); },
  };
  const p0 = w => !!w.gov;
  LES.Systems.register(sys);
  LES.Actions.ICONS.VOTE = '🗳️'; LES.Actions.LABELS.VOTE = 'Vote';
  GV.townStats = townStats;
  GV.payOut = payOut; GV.borrow = borrow; GV.setLaw = setLaw; GV.applyLaws = applyLaws;
  // Fill in what older saves lack (taxes by source, council, services, fund).
  GV.upgrade = function (w) {
    const g = w.gov, FS = LES.Fiscal;
    // Law values: 'malaysia' became 'national' with country packs.
    const nat = v => (v === 'malaysia' ? 'national' : v), natAll = o => { if (o) for (const k in o) o[k] = nat(o[k]); };
    natAll(g.laws);
    for (const e of g.lawLog || []) { e.from = nat(e.from); e.to = nat(e.to); }
    for (const a of g.agenda || []) a.v = nat(a.v);
    for (const c of g.campaign || []) natAll(c.platform);
    for (const r of g.elections || []) for (const c of r.cands || []) natAll(c.platform);
    for (const l of GV.LAWS) if (g.laws[l.key] === undefined) g.laws[l.key] = l.def;
    if (!g.month || !g.month.tags) g.month = FS.newMonth();
    const d = { opr: FS.MY_OPR, oprHist: [], fund: { units: 0, glc: {}, invested: 0, drawn: 0 }, devStock: 0, devIdx: 0, afford: 1, budget: { dev: 0.5, train: 0.15, fund: 0.35 },
      officials: { treasurer: null, police: null, community: null }, offLog: [], trainPool: 0, staff: {}, eduQ: 1, healthQ: 1, lastMerchant: w.ledger.sec.MERCHANT.bal };
    for (const k in d) if (g[k] === undefined) g[k] = d[k];
    if (!w.bizTypes) w.bizTypes = C.BIZ.concat(C.BIZ_SERVICES);
    applyLaws(w, false);
  };

  // ---- Laws, leader titles and police strength from the country pack ----
  let SP = null; // monthly cost of a teacher, nurse and doctor (pay + employer contributions), for voters' sense of the bill
  let PREF = []; // groups the 'group' preference favours (pack gov.preferredGroups)
  LES.Countries.require('gov.emergency', 'gov.austerity', 'tax.salesTaxRaise', 'gov.laws', 'gov.leaderTitles', 'gov.policePer1000', 'gov.servicePay');
  LES.Countries.on('government', K => {
    GV.LAWS.length = 0; for (const l of K.gov.laws) GV.LAWS.push(l);
    for (const k of Object.keys(GV.LAW_BY_KEY)) delete GV.LAW_BY_KEY[k];
    for (const l of GV.LAWS) GV.LAW_BY_KEY[l.key] = l;
    for (const k of Object.keys(TITLES)) delete TITLES[k]; Object.assign(TITLES, K.gov.leaderTitles);
    GV.MY_POLICE = K.gov.policePer1000; SP = K.gov.servicePay;
    PREF = K.gov.preferredGroups || [];
  });
})(globalThis.LES = globalThis.LES || {});
