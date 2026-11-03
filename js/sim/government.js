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
  GV.LAWS = [
    { key: 'incomeTax', name: 'Income tax', def: 'normal', options: [['low', 'Low (bands x0.6)'], ['normal', 'Malaysian bands'], ['high', 'High (bands x1.5)']], econ: { low: 1, normal: 0, high: -1 } },
    { key: 'corpTax', name: 'Corporate tax', def: '24', options: [['17', '17%'], ['24', '24% (Malaysia)'], ['30', '30%']], econ: { 17: 0.8, 24: 0, 30: -0.8 } },
    { key: 'minWage', name: 'Minimum wage', def: '1700', options: [['1200', 'RM1,200'], ['1700', 'RM1,700 (Malaysia 2025)'], ['2500', 'RM2,500']], econ: { 1200: 0.8, 1700: 0, 2500: -0.9 } },
    { key: 'cashAid', name: 'Cash aid for B40 households', def: '100', options: [['0', 'None'], ['100', 'RM100/month (STR-style)'], ['300', 'RM300/month']], econ: { 0: 0.7, 100: 0, 300: -0.8 } },
    { key: 'ubi', name: 'Universal basic income', def: '0', options: [['0', 'None'], ['500', 'RM500/month for every adult']], econ: { 0: 0.3, 500: -1.3 } },
    { key: 'estateTax', name: 'Inheritance tax', def: '0', options: [['0', 'None (Malaysia since 1991)'], ['0.2', '20% above RM100k'], ['0.5', '50% above RM100k']], econ: { 0: 0.5, 0.2: -0.5, 0.5: -1.2 } },
    { key: 'police', name: 'Police force', def: '4', options: [['2', '2 officers per 1,000'], ['4', '4 per 1,000 (Malaysia)'], ['7', '7 per 1,000']], soc: { 2: 0.5, 4: 0, 7: -0.8 }, econ: { 2: 0.3, 4: 0, 7: -0.3 } },
    { key: 'drugPolicy', name: 'Drug policy', def: 'malaysia', options: [['malaysia', 'Rehab first, prison for repeat'], ['punitive', 'Punitive (prison)'], ['treatment', 'Treatment first'], ['decriminalised', 'Decriminalised use']], soc: { malaysia: -0.2, punitive: -1, treatment: 0.5, decriminalised: 1 } },
    { key: 'uniFees', name: 'University fees', def: 'subsidised', options: [['free', 'Free'], ['subsidised', 'Subsidised'], ['expensive', 'Full fees (x2.5)']], econ: { free: -0.8, subsidised: 0, expensive: 0.8 } },
    { key: 'recordCheck', name: 'Criminal record checks in hiring', def: 'allowed', options: [['allowed', 'Allowed'], ['banned', 'Banned (fair chance)']], soc: { allowed: -0.3, banned: 0.7 } },
    { key: 'affirm', name: 'Affirmative action', def: 'group', options: [['none', 'None'], ['need', 'Need-based (B40)'], ['group', 'Bumiputera preference']], econ: { none: 0.4, need: -0.4, group: 0 }, soc: { none: 0.3, need: 0.2, group: -0.4 } },
    { key: 'barBan', name: 'Bars and alcohol', def: 'open', options: [['open', 'Allowed (taxed)'], ['ban', 'Banned']], soc: { open: 0.4, ban: -1 } },
  ];
  GV.LAW_BY_KEY = {};
  for (const l of GV.LAWS) GV.LAW_BY_KEY[l.key] = l;
  GV.optName = (key, v) => { const o = GV.LAW_BY_KEY[key].options.find(x => x[0] === v); return o ? o[1] : v; };
  const EDU_MULT = { free: 0, subsidised: 1, expensive: 2.5 };
  GV.MY_POLICE = 4; // PDRM: 136,503 personnel for ~34.3 million people (2025)

  GV.policyOf = function (laws) {
    return {
      incomeTaxMult: { low: 0.6, normal: 1, high: 1.5 }[laws.incomeTax], corpTax: Number(laws.corpTax) / 100,
      minWage: Number(laws.minWage), cashAid: Number(laws.cashAid), ubi: Number(laws.ubi), estateTax: Number(laws.estateTax),
      policePer1000: Number(laws.police), drugPolicy: laws.drugPolicy, uniFees: laws.uniFees,
      recordCheck: laws.recordCheck === 'allowed', affirm: laws.affirm, barBan: laws.barBan === 'ban',
    };
  };
  function applyLaws(w) {
    w.policy = GV.policyOf(w.gov.laws);
    w.derived.eduMult = EDU_MULT[w.gov.laws.uniFees];
  }

  // ---- Treasury ----
  const T = w => w.gov.treasury;
  function borrow(w, amt) {
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
        return -(Number(val) - Number(cur)) / 100 * profit / price / 100;
      }
      case 'minWage': {
        const d = Number(val) - Number(cur);
        if (p.job) { const s = p.job.salary / price / 100; return Math.max(0, Math.min(d, Number(val) - s)) * (s < Number(val) ? 1 : 0) - (Object.keys(p.shares).length ? 0.15 * d : 0); }
        return Object.keys(p.shares).length ? -0.25 * d : -0.05 * d; // fewer low-paid vacancies, higher costs for owners
      }
      case 'cashAid': {
        const d = Number(val) - Number(cur);
        return (p.cls === 'B40' && p.isHead ? d : 0) - d * ts.b40 / ts.adults * costShare(p, ts);
      }
      case 'ubi': { const d = Number(val) - Number(cur); return d - d * costShare(p, ts) * 0.9; }
      case 'estateTax': {
        const d = Number(val) - Number(cur), nw = Math.max(0, p.nw / price / 100 - 1e5);
        let parentNw = 0;
        for (const id of p.parents) { const q = w.people[id]; if (q.alive) parentNw += Math.max(0, q.nw / price / 100 - 1e5) / Math.max(1, q.children.length); }
        return -d * (age > 50 ? nw / Math.max(60, (85 - age) * 12) : 0) - d * parentNw / 240 + d * 20;
      }
      case 'police': {
        const d = Number(val) - Number(cur), cr = p.cr;
        const safety = 8 + (cr ? 60 * cr.fear + (cr.victim ? 25 : 0) : 0);
        const offender = cr && (cr.gang >= 0 || cr.offences > 0 || cr.user) ? 40 : 0;
        return d * (safety - offender) - d * 3 * costShare(p, ts);
      }
      case 'drugPolicy': {
        const user = p.cr && (p.cr.user || p.cr.addict > 0);
        const forUser = { malaysia: 0, punitive: -200, treatment: 120, decriminalised: 260 }, moral = { malaysia: 0, punitive: 30, treatment: -10, decriminalised: -70 };
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
        const bumi = p.eth === 'malay' || p.eth === 'bumi';
        const v = o => (o === 'group' ? (bumi ? 60 : -60) : o === 'need' ? (p.cls === 'B40' ? 50 : p.cls === 'T20' ? -20 : 0) : 0);
        return v(val) - v(cur);
      }
      case 'barBan': {
        const v = o => (o === 'ban' ? (p.rel === 'islam' && p.relig > 50 ? 35 : p.rel !== 'islam' && age < 50 ? -40 : 0) : 0);
        return v(val) - v(cur);
      }
      default: return 0;
    }
  };

  // Monthly cost of a programme option (Year-1 RM) compared with the treasury's income:
  // the share of revenue it would eat. Candidates with a sense of responsibility, and
  // voters who follow the news, worry about promises the town cannot afford.
  GV.burden = function (w, key, val, ts) {
    const rev = Math.max(2000, w.gov.revHist.length ? w.gov.revHist.slice(-12).reduce((s, x) => s + x, 0) / Math.min(12, w.gov.revHist.length) / w.price / 100 : 3000);
    const cost = { cashAid: v => Number(v) * ts.b40, ubi: v => Number(v) * ts.adults, police: v => Number(v) * ts.pop / 1000 * 3000, uniFees: v => (v === 'free' ? 650 * ts.adults * 0.03 : 0) }[key];
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
  const TITLES = { president: 'President', mayor: 'Mayor', datuk: 'Datuk Bandar' };
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
  function platform(w, c, ts, R) {
    const pl = {}, wants = [];
    for (const law of GV.LAWS) {
      let best = w.gov.laws[law.key], bestS = 0;
      for (const [v] of law.options) {
        if (v === w.gov.laws[law.key]) continue;
        const s = 0.9 * (axis(law, v, 'econ') - axis(law, w.gov.laws[law.key], 'econ')) * c.pol.econ + 0.9 * (axis(law, v, 'soc') - axis(law, w.gov.laws[law.key], 'soc')) * c.pol.soc
          + GV.benefit(w, c, law.key, v, ts) / 400 + R.normal(0, 0.25)
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
    g.campaign = cands.map((c, i) => {
      c.pol = c.pol || leanings(w, c, R);
      const spend = Math.min(Math.round(c.cash * 0.08), w.px(60000));
      if (spend > 0) w.ledger.spend(c, 'cash', 'MERCHANT', spend);
      P.log(w, c, `Is standing for ${GV.title(w)}${spend ? ` (campaign spending ${U.fmtMoney(spend)})` : ''}`, 'politics', 1);
      return { id: c.id, colour: COLOURS[i % COLOURS.length], platform: platform(w, c, ts, R), spend, incumbent: c.id === g.president, votes: 0 };
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
    P.log(w, winner, `${prev === win.id ? 'Re-elected' : 'Elected'} ${GV.title(w)} of ${C.TOWN_NAME} with ${win.votes} votes`, 'politics', 3);
    w.pushFeed({ day: w.day, pid: win.id, text: `${P.name(winner)} ${prev === win.id ? 'was re-elected' : 'won the election'} as ${GV.title(w)} (${res.cands.map(c => `${c.name.split(' ')[0]} ${c.votes}`).join(', ')}; turnout ${turnout}%)`, cat: 'politics', imp: 3 });
    w.townVersion++; // banners come down
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
    w.pushFeed({ day: w.day, pid: pres ? pres.id : -1, text: `${pres ? `${GV.title(w)} ${P.name(pres)}` : 'The town council'} changed the law: ${GV.LAW_BY_KEY[key].name} → ${GV.optName(key, v)}${why === 'austerity' ? ' (the treasury is deep in debt)' : why === 'emergency' ? ' (emergency)' : ''}`, cat: 'politics', imp: 2 });
  }

  // ---- Monthly finances ----
  function financeMonth(w, R, ts) {
    const g = w.gov, L = w.ledger, m = g.month;
    // Taxes collected this month (they were paid to the TAX sector): move them into the treasury.
    const taxIn = L.sec.TAX.bal - g.lastTax;
    if (taxIn > 0) { L.move(L.sec.TAX, 'bal', T(w), 'cash', taxIn); m.rev.tax = (m.rev.tax || 0) + taxIn; }
    g.lastTax = L.sec.TAX.bal;
    // Welfare (food and child guardians) paid out by the welfare office is the treasury's cost.
    const welfareOut = g.lastWelfare - L.sec.WELFARE.bal;
    if (welfareOut > 0) payOut(w, L.sec.WELFARE, 'bal', welfareOut, 'welfare');
    g.lastWelfare = L.sec.WELFARE.bal;
    // Public-sector wages (police) were paid through the employer sector: reimburse it.
    if (m.wages > 0) payOut(w, L.sec.EMPLOYER, 'bal', m.wages, 'police');
    const pres = g.president >= 0 ? w.people[g.president] : null;
    if (pres && pres.alive && !pres.away) { // the leader's salary scales with the town's revenue
      const avgRev = g.revHist.length ? g.revHist.slice(-12).reduce((s, x) => s + x, 0) / Math.min(12, g.revHist.length) : 0;
      const s = payOut(w, pres, 'cash', U.clamp(avgRev * 0.08, w.px(2000), w.px(15000)), 'leader'); pres.earned.wages += s; pres.monthIncome += s;
    }
    // Programmes.
    const pol = w.policy;
    for (const p of w.living) {
      if (!p.alive || !p.adult || p.away) continue;
      let amt = 0;
      if (pol.cashAid && p.isHead && p.cls === 'B40') amt += w.px(pol.cashAid);
      if (pol.ubi) amt += w.px(pol.ubi);
      if (amt) { const a = payOut(w, p, 'cash', amt, pol.ubi ? 'basic income & aid' : 'cash aid'); p.earned.welfare += a; p.monthIncome += a; }
    }
    if (pol.uniFees === 'free') { // the fees students no longer pay
      let fees = 0;
      for (const p of w.living) if (p.alive && p.enrol) { const c = C.COURSE_BY_ID[p.enrol.course]; fees += w.px(c.fee) / c.months; }
      if (fees) payOut(w, L.sec.EDUCATION, 'bal', fees, 'universities');
    }
    // Interest, repayments and the debt limit.
    if (g.debt > 0) {
      const interest = Math.round(g.debt * (w.macro().depositRate + 0.01) / 12);
      payOut(w, L.sec.BANK, 'bal', interest, 'interest');
      const spare = T(w).cash - w.px(20000);
      if (spare > 0) { const rep = Math.min(spare, g.debt); L.move(T(w), 'cash', L.sec.BANK, 'bal', rep); g.debt -= rep; }
    }
    const annualRev = g.revHist.slice(-12).reduce((s, x) => s + x, 0);
    if (g.debt > Math.max(w.px(5e4), 2 * annualRev) && R.next() < 0.5) { // austerity: cut the most expensive programme
      if (g.laws.ubi !== '0') setLaw(w, 'ubi', '0', 'austerity');
      else if (g.laws.cashAid === '300') setLaw(w, 'cashAid', '100', 'austerity');
      else if (g.laws.incomeTax !== 'high') setLaw(w, 'incomeTax', g.laws.incomeTax === 'low' ? 'normal' : 'high', 'austerity');
    }
    // Public services (schools, clinics, roads, civil servants): the treasury spends what it
    // does not need to keep, so taxes go back into the town rather than piling up.
    const reserve = 3 * Math.max(w.px(5000), Object.values(m.spend).reduce((a, b) => a + b, 0));
    if (T(w).cash > reserve) payOut(w, L.sec.EMPLOYER, 'bal', (T(w).cash - reserve) * 0.6, 'public services');
    const rev = Object.values(m.rev).reduce((a, b) => a + b, 0), spend = Object.values(m.spend).reduce((a, b) => a + b, 0);
    g.revHist.push(rev); if (g.revHist.length > 24) g.revHist.shift();
    g.last = { rev: m.rev, spend: m.spend, revTotal: rev, spendTotal: spend };
    g.month = { rev: {}, spend: {}, wages: 0 };
  }

  // Police headcount follows the law (officers per 1,000 residents).
  function policeMonth(w, ts) {
    const g = w.gov, t = w.town;
    const officers = w.living.filter(p => p.alive && p.job && p.job.jobId === 'police');
    const target = Math.max(1, Math.round(w.policy.policePer1000 * ts.pop / 1000));
    const open = w.vacancies.filter(v => v.job.id === 'police').length;
    const station = t.kinds.police && t.kinds.police.length ? t.kinds.police[0] : t.byKind.depot !== undefined ? t.byKind.depot : t.byKind.hall;
    let posted = 0;
    for (let k = officers.length + open; k < target; k++, posted++) {
      const j = C.GOV_JOBS.police;
      w.vacancies.push({ id: w.nextVacId++, job: j, salary: Math.round(w.px(j.salary) / 1000) * 1000, openDay: w.day, closeDay: w.day + 20, applicants: [], appSet: new Set(), place: station });
    }
    if (officers.length > target) { // budget cut: the newest officers go
      officers.sort((a, b) => b.job.startDay - a.job.startDay);
      for (const p of officers.slice(0, officers.length - target)) LES.Labour.endJob(w, p, 'laid off');
    }
    if (posted) w.vacancies.sort((a, b) => (b.salary - a.salary) || (a.id - b.id)); // listings stay best-paid first
    const active = officers.filter(p => !p.inst).length;
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
    if (w.regime === 'recession' && g.laws.cashAid === '0' && pres.pol.econ < 0.4) setLaw(w, 'cashAid', '100', 'emergency');
    if (w.crime && LES.Crime.rates(w).index > 1.6 * LES.Crime.MY.index * (LES.Crime.INTENSITY[w.cfg.crime] || 1) && g.laws.police !== '7') setLaw(w, 'police', g.laws.police === '2' ? '4' : '7', 'emergency');
    void ts;
  }

  // ---- Events: monsoon floods and haze ----
  function eventsDay(w, R) {
    const g = w.gov, doy = w.date.doy;
    if (doy === 325 && R.next() < 0.35) { // north-east monsoon floods
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
        const loss = Math.min(p.cash, w.px(R.range(300, 6000)));
        w.ledger.spend(p, 'cash', 'MERCHANT', loss);
        p.stress = Math.min(100, p.stress + 20); p.health = Math.max(1, p.health - 3);
        const aid = payOut(w, p, 'cash', w.px(1000), 'flood relief'); // Bantuan Wang Ihsan: RM1,000 per household
        p.earned.welfare += aid;
        P.log(w, p, `Home was flooded (${U.fmtMoney(loss)} of damage, ${U.fmtMoney(aid)} government aid)`, 'luck', 1);
      }
      g.flood = { blocks: hit, until: w.day + 10 }; g.floods++;
      w.pushFeed({ day: w.day, pid: -1, text: `Monsoon floods: ${homes} household${homes === 1 ? '' : 's'} hit; RM1,000 relief each from the treasury`, cat: 'economy', imp: 2 });
    }
    if (doy === 190 && R.next() < 0.3) { g.haze = { until: w.day + 25 }; g.hazes++; w.pushFeed({ day: w.day, pid: -1, text: 'Haze from regional fires: the air is unhealthy for weeks', cat: 'economy', imp: 2 }); }
    if (g.haze && w.day < g.haze.until) for (const p of w.living) if (p.alive) p.health = Math.max(1, p.health - (P.age(w, p) > 60 || P.age(w, p) < 5 ? 0.12 : 0.05));
  }

  const sys = {
    id: 'gov', order: 30,
    enabled: cfg => cfg.government === 'on',
    init(w) {
      const laws = {};
      for (const l of GV.LAWS) laws[l.key] = l.def;
      laws.drugPolicy = w.cfg.drugPolicy || 'malaysia'; laws.uniFees = w.cfg.education;
      w.gov = {
        treasury: { cash: 0 }, debt: 0, laws, lawLog: [], president: -1, terms: {}, termStart: 0, approval: 55, scandal: 0, scandals: 0, skimmed: 0, skimNow: 0,
        elections: [], campaign: null, electionDay: Math.round(w.cfg.termYears * 365), agenda: [], misinfo: -1,
        month: { rev: {}, spend: {}, wages: 0 }, last: null, revHist: [], estateTaxTotal: 0,
        lastTax: w.ledger.sec.TAX.bal, lastWelfare: w.ledger.sec.WELFARE.bal,
        officers: 0, policeFactor: 1, flood: null, haze: null, floods: 0, hazes: 0,
        frozen: w.cfg.freezeLaws === 'yes',
      };
      applyLaws(w);
      w.refreshLiving(); // founders exist, but the living list is built after the systems start
      const R = w.rng.gov;
      for (const p of w.people) p.pol = leanings(w, p, R);
      // The founders choose the first leader straight away.
      startCampaign(w);
      if (w.gov.campaign) tally(w, true);
      const ts = townStats(w);
      policeMonth(w, ts);
    },
    personCreated(w, p) { if (w.gov && p.adult) p.pol = leanings(w, p, w.rng.gov); },
    money: w => w.gov.treasury.cash,
    hireWeight(w, p) {
      const a = w.policy.affirm;
      if (a === 'group' && (p.eth === 'malay' || p.eth === 'bumi')) return 1.08;
      if (a === 'need' && p.cls === 'B40') return 1.08;
      return 1;
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
      financeMonth(w, R, ts);
      policeMonth(w, ts);
      approvalMonth(w, R);
      corruptionMonth(w, R);
      respond(w, R, ts);
      if (w.date.month % 2 === 0) enactNext(w);
    },
    year(w) { // leanings drift slowly with class and age
      const R = w.rng.gov;
      for (const p of w.living) if (p.alive && p.adult && p.pol) { const fresh = leanings(w, p, R); p.pol.econ = 0.85 * p.pol.econ + 0.15 * fresh.econ; p.pol.soc = 0.85 * p.pol.soc + 0.15 * fresh.soc; }
    },

    snapshot(w, row) {
      const g = w.gov;
      row.gov = { treasury: g.treasury.cash / w.price, debt: g.debt / w.price, approval: g.approval, officers: g.officers, police: g.policeFactor, rev: g.last ? g.last.revTotal / w.price : 0, spend: g.last ? g.last.spendTotal / w.price : 0, president: g.president };
    },
    invariants(w, errs) {
      const g = w.gov;
      if (!Number.isInteger(g.treasury.cash) || g.treasury.cash < 0) errs.push(`treasury ${g.treasury.cash}`);
      if (!(g.debt >= 0) || !Number.isFinite(g.debt)) errs.push(`debt ${g.debt}`);
      for (const l of GV.LAWS) if (!l.options.some(o => o[0] === g.laws[l.key])) errs.push(`law ${l.key}=${g.laws[l.key]}`);
      for (const e of g.elections) if (e.cands.reduce((s, c) => s + c.votes, 0) !== e.voted || e.voted > e.eligible) errs.push(`election ${e.day} votes do not add up`);
      if (g.president >= 0 && !w.people[g.president].alive) errs.push('dead president in office');
    },
    hash(w, parts) { const g = w.gov; parts.push(g.treasury.cash, Math.round(g.debt), g.president, ...GV.LAWS.map(l => g.laws[l.key])); },
  };
  const p0 = w => !!w.gov;
  LES.Systems.register(sys);
  LES.Actions.ICONS.VOTE = '🗳️'; LES.Actions.LABELS.VOTE = 'Vote';
  GV.townStats = townStats;
})(globalThis.LES = globalThis.LES || {});
