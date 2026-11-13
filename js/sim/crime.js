// Crime and justice, drugs and gangs (setting "Crime & vice": lively / realistic /
// lawless / off). Plugs in through LES.Systems; with it off the engine is unchanged.
//
// Why people offend (standard criminology, kept simple and inspectable):
// - need: little cash compared with living costs, no job, drug cravings
// - low self-control: low responsibility and discipline, high risk tolerance
// - the age-crime curve: offending peaks at 18-25 and falls after 30
// - peers and history: gang membership, a criminal record
// - deterrence: the chance of being caught matters more than the size of the sentence;
//   people sense it from how many recent crimes the police actually solved
// - restraints: devotion, children to look after, a decent job, an education
// - the town: unemployment, inequality, few job openings and recessions push crime up;
//   funded training and youth programmes pull it down
// Police capacity: each officer can investigate only so many cases a month. When crime
// outruns the force, fewer cases are solved, deterrence weakens and crime rises further;
// more officers (the budget) and a capable district police chief turn this around.
// Each month that gives a temptation score; a few people get a crime opportunity on a
// day that month, which appears as one more choice in "Why did they do that?" - they may
// still say no. Rates are tuned so that "Realistic" gives Malaysian per-capita rates
// (index crime ~170 per 100k a year, murder ~0.7, drug users ~590, prisoners ~260);
// "Lively" multiplies them by 10 so a small town shows something, "Lawless" by 30.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, A = LES.Actions, F = LES.Finance, Fa = LES.Family;
  const CR = LES.Crime = {};

  CR.INTENSITY = { realistic: 1, lively: 10, lawless: 30 };
  CR.POLICE = { weak: 0.5, normal: 1, strong: 1.6 };
  // The country's reference rates per 100,000 people per year (stock for users and prisoners),
  // from the pack's `crime`.
  CR.REF = {};
  // Crime types. w = attribute weights for the success roll, diff = difficulty,
  // clear = chance police solve it, months = typical sentence, violent = index violent crime.
  CR.TYPES = {
    theft: { name: 'Snatch theft', icon: '👜', w: [0, 0, 0.4, 0, 0.6, 0], diff: 4, clear: 0.55, months: 8, fine: 0.5 },
    burglary: { name: 'House-breaking', icon: '🏚️', w: [0.2, 0.1, 0.4, 0, 0.3, 0], diff: 5, clear: 0.55, months: 24 },
    vehicle: { name: 'Vehicle theft', icon: '🏍️', w: [0.3, 0, 0.4, 0, 0.3, 0], diff: 5, clear: 0.5, months: 24 },
    scam: { name: 'Scam', icon: '📱', w: [0.5, 0, 0.1, 0.4, 0, 0], diff: 5.5, clear: 0.5, months: 30 },
    robbery: { name: 'Robbery', icon: '🔪', w: [0, 0.5, 0.2, 0, 0.3, 0], diff: 4.5, clear: 0.8, months: 48, violent: true },
    assault: { name: 'Assault', icon: '👊', w: [0, 0.6, 0, 0, 0.2, 0.2], diff: 4, clear: 0.9, months: 18, violent: true },
    murder: { name: 'Murder', icon: '⚰️', clear: 0.9, months: 300, violent: true },
  };
  CR.INDEX = ['theft', 'burglary', 'vehicle', 'robbery', 'assault', 'murder']; // DOSM index crimes (scams are commercial crime)
  const BASE = 0.0013;     // monthly opportunity chance per unit temptation at intensity 1 (calibrated: tools/headless.js)
  const DRUG_BASE = 0.00024;
  // Country tuning (pack crimeTuning): how often chances to offend come up, how often police solve
  // a case and how long sentences are, against the Malaysian calibration (1 = unchanged).
  const TUNE0 = { opportunity: 1, clear: 1, murderClear: 1, sentence: 1, community: 0, drugRepeat: 1, lethal: 1, drugUse: 1 }; // lethal: guns make fights and robberies deadlier (US)
  let TUNE = TUNE0, TUNE8 = TUNE0;
  // Rules revision 8 (crime outside Malaysia): police case capacity is measured against the country's own
  // crime level and police staffing, and the pack's `crimeTuningRev8` replaces parts of its tuning.
  CR.REV = 8;
  CR.rev8 = w => !!w && !!w.cfg && w.cfg.rulesRev >= CR.REV;
  const T = w => (CR.rev8(w) ? TUNE8 : TUNE);
  CR.tuning = T;
  const GANG_COLOURS = ['#e63946', '#8338ec', '#ff8c42', '#06d6a0', '#3a86ff', '#ffbe0b', '#d62828', '#8d99ae'];

  const K = w => CR.INTENSITY[w.cfg.crime] || 10;
  // Rules revision 10: Lively crime brings ten times the crimes and stories, but each one is less likely to
  // kill or injure, so a town loses about as many lives and as much health to crime as under Realistic (the
  // owner's choice: more crime, normal deaths). Before, Lively cut life expectancy by ~6 years and towns shrank.
  CR.HARM_REV = 10;
  CR.harm = w => (w.cfg.rulesRev >= CR.HARM_REV && w.cfg.crime === 'lively' ? 1 / K(w) : 1);
  CR.CASES_PER_OFFICER = 0.13; // index cases one officer can investigate a month (at the Realistic scale, Malaysian rates)
  const MY_INDEX = 170, MY_OFFICERS = 4;
  // Rules revision 8: a force staffed as in its own country can handle that country's usual case load, as
  // Malaysia's does (before, every country's officers had Malaysia's case capacity, so a UK force facing
  // twelve times the crime with fewer officers per 1,000 solved almost nothing and crime spiralled).
  CR.casesPerOfficer = w => CR.CASES_PER_OFFICER * (CR.rev8(w) ? (CR.REF.index / MY_INDEX) * (MY_OFFICERS / natPolice()) : 1);
  const natPolice = () => { const g = LES.Countries.pack && LES.Countries.pack.gov; return (g && g.policePer1000) || MY_OFFICERS; };
  // Officers on duty: real officers with a government, otherwise the setting's notional force.
  const officers = w => (w.gov ? w.gov.officers : w.counts.living / 1000 * (CR.rev8(w) ? natPolice() : 4) * (CR.POLICE[w.cfg.police] || 1));
  // Share of cases the force has time for (1 at Malaysian staffing and crime rates).
  CR.capacity = function (w) {
    const st = state(w), load = Math.max(w.counts.living / 1e5 * CR.REF.index / 12 * K(w) * 0.5, st.lastCrimes || 0); // at least half the national monthly rate
    const r = Math.max(0.3, officers(w)) * CR.casesPerOfficer(w) * K(w) / load;
    return U.clamp(1.2 * r / (r + 0.6), 0.1, 1.15);
  };
  const policing = w => (LES.Council ? LES.Council.policing(w) : { solve: 1, raid: 1 });
  // Police strength: with a government, set by how many officers the budget pays for
  // (officers per 1,000 residents relative to Malaysia's ~4); otherwise the setting.
  const police = w => (w.gov && Number.isFinite(w.gov.policeFactor) ? w.gov.policeFactor : CR.POLICE[w.cfg.police] || 1);
  CR.policeFactor = police;
  const drugPolicy = w => (w.policy ? w.policy.drugPolicy : w.cfg.drugPolicy);
  const n01 = v => (v - 50) / 50;
  const free = p => p.alive && !p.away && !p.inst;
  const state = w => w.crime;

  function newCr() { return { rec: 0, t: 0, opp: -1, oppSlot: 0, oppType: null, gang: -1, addict: 0, user: false, clean: 0, fear: 0, victim: 0, offences: 0, drugArrests: 0, releasedDay: -1, reoffended: false }; }

  // ---------- Temptation ----------
  function temptation(w, p) {
    const age = P.age(w, p), cr = p.cr, pr = p.pers;
    const need = U.clamp((2 - p.cash / Math.max(1, p.mcost)) / 2, 0, 1) + (!p.job && p.manages < 0 && !p.retired && !p.enrol ? 0.4 : 0) + cr.addict / 120;
    const ageT = age < 26 ? 0.7 : age < 31 ? 0.35 : age < 41 ? 0 : age < 56 ? -0.5 : -1.2;
    const peer = (cr.gang >= 0 ? 1 : 0) + (p.partnerId !== null && w.people[p.partnerId].cr && w.people[p.partnerId].cr.rec ? 0.3 : 0);
    const kids = p.careOf.length ? 0.4 : 0;
    const jobV = p.job ? U.clamp(Math.log(p.job.salary / w.px(2500)), -0.3, 1.2) * 0.6 : 0;
    const st = state(w), tc = st.town || { unemp: 0.03, gini: 0.39, vac: 1 };
    const deter = 0.2 + 1.8 * (st.certainty === undefined ? 0.5 : st.certainty); // the chance of being caught, as people see it
    const devotion = p.relig !== undefined ? 0.8 * p.relig / 100 : 0;
    const edu = p.quals.some(P.isBachelor) ? -0.35 : !p.quals.length && age >= 20 ? 0.25 : 0;
    const origin = p.clsOrigin === 'B40' ? 0.1 : p.clsOrigin === 'T20' ? -0.1 : 0;
    const idle = !p.job && p.manages < 0 && !p.retired && !p.enrol;
    const town = (3 * (tc.unemp - 0.03) + 1.5 * Math.max(0, tc.gini - 0.39) - 0.15 * U.clamp(tc.vac - 1, -1, 2)) * (idle ? 1.5 : 1) + (w.regime === 'recession' ? 0.15 : 0);
    const programme = p.trainUntil > w.day ? 0.4 : 0; // funded training and youth programmes
    const x = -4.0 + 1.6 * need - 1.0 * n01(pr.resp) - 0.7 * n01(pr.dis) + 0.7 * n01(pr.risk) - 0.3 * n01(pr.pat)
      + ageT + 0.9 * peer + (cr.rec ? 0.7 : 0) - devotion - kids - jobV - deter + (p.stress > 75 ? 0.3 : 0) + edu + origin + town - programme;
    return U.sigmoid(x);
  }

  // Which crime this person would go for (skills and situation).
  function pickType(w, p, R) {
    const a = p.att, cr = p.cr;
    const wt = {
      theft: 1 + 0.15 * (a[C.AGI] - 5), burglary: 0.6 + 0.1 * (a[C.PER] - 5), vehicle: 0.4 + 0.1 * (a[C.INT] - 5),
      scam: 0.3 + 0.2 * (a[C.INT] + a[C.CHA] - 10) / 2, robbery: 0.35 + 0.12 * (a[C.STR] - 5) + 0.3 * n01(p.pers.risk),
      assault: 0.35 + (p.stress > 70 ? 0.5 : 0) + (cr.gang >= 0 ? 0.3 : 0),
    };
    const keys = Object.keys(wt);
    return keys[Math.max(0, R.weighted(keys.map(k => Math.max(0.02, wt[k]))))];
  }

  function pickVictim(w, p, type, R) {
    const pool = w.living, n = pool.length;
    let best = null, bestS = -Infinity;
    for (let k = 0; k < 24; k++) {
      const q = pool[Math.floor(R.next() * n)];
      if (!q || q === p || !q.adult || !free(q) || q.id === p.partnerId || Fa.related(w, p, q)) continue;
      if (q.cr && q.cr.gang >= 0 && q.cr.gang === p.cr.gang) continue;
      let s = R.next();
      if (type === 'theft' || type === 'robbery') s += Math.log10(Math.max(100, q.cash) / 100) * 0.4;
      if (type === 'burglary') s += q.tiers.housing * 0.5;
      if (type === 'vehicle') s += q.tiers.transport >= 1 ? 1 : -5;
      if (type === 'scam') s += (P.age(w, q) > 50 ? 1 : 0) + q.pers.risk / 100 + Math.log10(Math.max(100, q.cash) / 100) * 0.3;
      if (s > bestS) { bestS = s; best = q; }
    }
    return best;
  }

  // ---------- Committing a crime ----------
  function take(w, from, to, amt, fenceShare) {
    amt = Math.min(Math.round(amt), from.cash);
    if (amt <= 0) return 0;
    const kept = Math.round(amt * (fenceShare === undefined ? 1 : fenceShare));
    w.ledger.move(from, 'cash', to, 'cash', kept);
    if (amt > kept) w.ledger.move(from, 'cash', w.ledger.sec.MERCHANT, 'bal', amt - kept); // sold cheap on the black market
    return kept;
  }

  function commit(w, p, type) {
    const R = w.rng.crime, st = state(w), def = CR.TYPES[type];
    const v = pickVictim(w, p, type, R);
    if (!v) return;
    const roll = A.taskRoll(w, p, def.w, def.diff, p.cr.offences * 0.3, type === 'robbery' || type === 'assault' ? 'physical' : null);
    let gain = 0, text = '';
    v.cr = v.cr || newCr();
    if (roll.ok) {
      switch (type) {
        case 'theft': gain = take(w, v, p, w.px(R.range(50, 900))); text = `Had a bag snatched (${U.fmtMoney(gain)})`; break;
        case 'burglary': gain = take(w, v, p, Math.max(w.px(500), v.cash * R.range(0.05, 0.25)), 0.6); text = 'Home was broken into'; break;
        case 'vehicle': gain = take(w, v, p, w.px(R.range(2500, 25000)) * (v.tiers.transport >= 2 ? 2 : 1), 0.3); text = `${v.tiers.transport >= 2 ? 'Car' : 'Motorbike'} was stolen`; break;
        case 'scam': gain = take(w, v, p, v.cash * R.range(0.1, 0.4)); text = `Lost ${U.fmtMoney(gain)} to a scam by someone in town`; break;
        case 'robbery': gain = take(w, v, p, w.px(R.range(200, 3000))); v.health = Math.max(1, v.health - R.range(8, 30) * CR.harm(w)); text = 'Was robbed and hurt'; break;
        case 'assault': v.health = Math.max(1, v.health - R.range(10, 35) * CR.harm(w)); text = 'Was assaulted'; break;
        default: break;
      }
      v.stress = Math.min(100, v.stress + 18); v.happy = Math.max(0, v.happy - 6);
      v.cr.fear = Math.min(1, v.cr.fear + 0.35); v.cr.victim++;
      if (p.cr.gang >= 0 && gain > 0) { const g = st.gangs[p.cr.gang], cut = Math.round(gain * 0.3); if (g && g.alive && w.ledger.move(p, 'cash', g, 'cash', cut)) g.take = (g.take || 0) + cut; }
      st.victimsByClass[v.cls || '-'] = (st.victimsByClass[v.cls || '-'] || 0) + 1;
    }
    p.cr.offences++;
    p.stress = Math.min(100, p.stress + (roll.ok ? 3 : 8));
    count(w, type);
    // Robberies and fights sometimes end in a killing (about 2% of violent crimes).
    let killed = false;
    if ((type === 'robbery' || type === 'assault') && roll.ok && R.next() < 0.022 * T(w).lethal * CR.harm(w) * (p.pers.risk > 80 ? 1.6 : 1)) killed = murder(w, p, v, type === 'robbery' ? 'robbery' : 'a fight');
    if (!killed && roll.ok) {
      P.log(w, v, `${text}${def.violent ? '' : ''}`, 'crime', 1);
      P.log(w, p, `Committed ${def.name.toLowerCase()}${gain ? ` (${U.fmtMoney(gain)})` : ''}`, 'crime', 0);
    } else if (!roll.ok) P.log(w, p, `Tried ${def.name.toLowerCase()} but failed`, 'crime', 0);
    // Will the police solve it? Depends on how stretched the force is and how well it is led.
    const pc = U.clamp(def.clear * T(w).clear * CR.capacity(w) * policing(w).solve * (roll.ok ? 1 : 1.4) * (1 - 0.04 * Math.max(0, A.attrScore(p, def.w || [0, 0, 0, 0, 0, 0]) - 5)), 0.02, 0.95);
    st.crimesNow = (st.crimesNow || 0) + 1;
    if (!killed && R.next() < pc) { st.cases.push({ type, off: p.id, victim: v.id, day: w.day, arrest: w.day + R.int(2, 60) }); st.solvedNow = (st.solvedNow || 0) + 1; }
  }

  function murder(w, p, v, how) {
    const st = state(w), R = w.rng.crime;
    w.die(v, 'murdered');
    count(w, 'murder');
    w.pushFeed({ day: w.day, pid: v.id, text: `${P.name(v)} was killed in ${how}`, cat: 'crime', imp: 2 });
    P.log(w, p, `Killed ${P.name(v)} in ${how}`, 'crime', 0);
    st.crimesNow = (st.crimesNow || 0) + 1;
    if (R.next() < CR.TYPES.murder.clear * T(w).murderClear * Math.min(1.1, CR.capacity(w) * policing(w).solve)) { st.cases.push({ type: 'murder', off: p.id, victim: v.id, day: w.day, arrest: w.day + R.int(3, 40) }); st.solvedNow = (st.solvedNow || 0) + 1; }
    return true;
  }

  function count(w, type) {
    const st = state(w);
    st.month[type] = (st.month[type] || 0) + 1;
    st.total[type] = (st.total[type] || 0) + 1;
  }

  // ---------- Arrest, court, prison ----------
  function institution(w, kind) {
    const t = w.town;
    for (const k of kind === 'remand' ? ['jail', 'police', 'prison'] : [kind === 'rehab' ? 'rehab' : 'prison']) if (t.kinds[k] && t.kinds[k].length) return t.kinds[k][0];
    return t.byKind.welfare !== undefined ? t.byKind.welfare : 0;
  }

  CR.admit = function (w, p, kind, months, why) {
    const st = state(w), R = w.rng.crime;
    if (!free(p) || !p.adult) return;
    if (p.job) LES.Labour.endJob(w, p, kind === 'rehab' ? 'entered rehab' : 'imprisoned', true);
    p.enrol = null;
    p.inst = { kind, until: w.day + Math.round(months * 30.4), loc: institution(w, kind), why, since: w.day }; // set first: a business picks a new manager
    if (p.manages >= 0) { const b = w.biz[p.manages]; p.manages = -1; if (b && b.open) F.pickManager(w, b); }
    p.tiers.leisure = 0; p.tiers.transport = 0; p.mcost = F.monthlyCost(w, p);
    p.stress = Math.min(100, p.stress + (kind === 'prison' ? 30 : 12)); p.happy = Math.max(0, p.happy - (kind === 'prison' ? 20 : 6));
    if (p.partnerId !== null && kind === 'prison' && R.next() < 0.15 + 0.006 * months) Fa.separate(w, p, w.people[p.partnerId], 'breakup');
    for (const cid of p.careOf.slice()) { // children go to the other carer, family or welfare
      const c = w.people[cid];
      p.careOf = p.careOf.filter(x => x !== cid);
      c.caregivers = c.caregivers.filter(x => x !== p.id);
      if (c.alive && !c.adult && !c.caregivers.length && c.guardian !== 'WELFARE') Fa.findGuardian(w, c, 'parent in prison');
    }
    p.mcost = F.monthlyCost(w, p);
    const yrs = months >= 12 ? `${(months / 12).toFixed(months % 12 ? 1 : 0)} years` : `${months} months`;
    P.log(w, p, kind === 'rehab' ? `Sent to drug rehabilitation for ${yrs}` : `Sentenced to ${yrs} in prison for ${why}`, 'crime', 1);
    if (kind === 'prison') st.admissions++; else st.rehabAdmissions++;
  };

  function release(w, p) {
    const st = state(w), kind = p.inst.kind;
    p.inst = null;
    p.pendingReview = kind === 'prison' ? 'prison' : 'rehab';
    if (kind === 'prison') { p.cr.rec++; p.cr.releasedDay = w.day; st.released++; }
    else { p.cr.user = false; p.cr.addict = Math.min(p.cr.addict, 15); p.cr.clean = 0; }
    p.mcost = F.monthlyCost(w, p);
    P.log(w, p, kind === 'prison' ? 'Released from prison' : 'Finished drug rehabilitation', 'crime', 1);
  }

  // Arrest: held in the police lock-up (remand) until the court hears the case.
  function arrest(w, c) {
    const p = w.people[c.off], st = state(w), R = w.rng.crime, def = CR.TYPES[c.type];
    if (!p || !free(p) || !p.adult) return;
    st.arrests++;
    const days = c.type === 'murder' ? R.int(60, 180) : R.int(3, 45);
    p.inst = { kind: 'remand', until: w.day + days, loc: institution(w, 'remand'), why: def.name.toLowerCase(), since: w.day, case: c };
    p.stress = Math.min(100, p.stress + 15);
    st.remanded++;
    P.log(w, p, `Arrested for ${def.name.toLowerCase()} and held in the police lock-up`, 'crime', 1);
  }

  // The court hears the case at the end of remand.
  function verdict(w, p, c) {
    const st = state(w), R = w.rng.crime, def = CR.TYPES[c.type], served = (w.day - (c.remandFrom || w.day)) / 30.4;
    // A lawyer lowers the chance of conviction - if they can afford one.
    let conv = 0.72 + (p.cr.rec ? 0.08 : 0);
    if (p.cash > w.px(20000)) { const fee = Math.min(p.cash, w.px(R.range(5000, 30000))); w.ledger.spend(p, 'cash', 'MERCHANT', fee); conv *= 0.62; st.lawyers++; }
    if (R.next() >= conv) { P.log(w, p, `Arrested for ${def.name.toLowerCase()} but acquitted in court`, 'crime', 1); st.acquitted++; return; }
    st.convictions++;
    if (p.cr.releasedDay >= 0 && w.day - p.cr.releasedDay < 3 * 365 && !p.cr.reoffended) { p.cr.reoffended = true; st.reoffended++; }
    if (def.fine && R.next() < def.fine) {
      const fine = Math.min(p.cash, w.px(R.range(1000, 4000)));
      w.ledger.spend(p, 'cash', 'TAX', fine);
      if (w.gov) LES.Fiscal.tag(w, 'fines & other', fine);
      p.cr.rec++;
      P.log(w, p, `Convicted of ${def.name.toLowerCase()} and fined ${U.fmtMoney(fine)}`, 'crime', 1);
      return;
    }
    if (c.type !== 'murder' && T(w).community > 0 && R.next() < T(w).community) { // UK: most convictions end in a community order, not prison
      p.cr.rec++; st.community = (st.community || 0) + 1;
      P.log(w, p, `Convicted of ${def.name.toLowerCase()} and given a community order`, 'crime', 1);
      return;
    }
    const months = Math.max(1, Math.round(def.months * T(w).sentence * R.range(0.6, 1.5) * (p.cr.rec ? 1.4 : 1) - served)); // remand counts toward the sentence
    CR.admit(w, p, 'prison', months, def.name.toLowerCase());
    if (c.type === 'murder') w.pushFeed({ day: w.day, pid: p.id, text: `${P.name(p)} was convicted of murdering ${P.name(w.people[c.victim])}`, cat: 'crime', imp: 2 });
  }

  // ---------- Drugs ----------
  function drugsMonth(w, p, R) {
    const cr = p.cr, st = state(w), age = P.age(w, p), policy = drugPolicy(w);
    if (!cr.user) {
      if (cr.addict > 0) { // in recovery: relapse risk falls with time clean
        cr.clean++;
        if (R.next() < (cr.clean < 12 ? 0.04 : 0.01) * (1.3 - p.pers.dis / 100)) { cr.user = true; P.log(w, p, 'Relapsed into drug use', 'crime', 0); }
        return;
      }
      const peers = (cr.gang >= 0 ? 3 : 1) * (p.partnerId !== null && w.people[p.partnerId].cr && w.people[p.partnerId].cr.user ? 3 : 1);
      const ageF = age < 40 ? 1.5 : age < 50 ? 0.6 : 0.15;
      const f = (0.5 + p.stress / 100) * (1.5 - p.pers.resp / 100) * ageF * peers * (1 - 0.6 * (p.relig || 0) / 100) * (p.job ? 1 : 1.6);
      if (R.next() < DRUG_BASE * K(w) * f * T(w).drugUse) { cr.user = true; cr.addict = 10; st.startedUsing++; P.log(w, p, 'Started using drugs', 'crime', 0); }
      return;
    }
    // A user: cravings cost money (to a dealer), health and stress relief that does not last.
    const want = w.px(200 + 8 * cr.addict), paid = Math.min(Math.max(0, p.cash), want);
    if (paid > 0) {
      const dealer = pickDealer(w, R);
      if (dealer) {
        const g = state(w).gangs[dealer.cr.gang];
        const toGang = Math.round(paid * 0.5);
        w.ledger.move(p, 'cash', dealer, 'cash', paid - toGang);
        if (g) { w.ledger.move(p, 'cash', g, 'cash', toGang); g.take = (g.take || 0) + toGang; } else w.ledger.move(p, 'cash', dealer, 'cash', toGang);
        dealer.cr.dealt = (dealer.cr.dealt || 0) + paid;
      } else w.ledger.spend(p, 'cash', 'MERCHANT', paid); // bought from outside town
    }
    cr.addict = Math.min(100, cr.addict + R.range(2, 9) * (paid >= want ? 1 : 0.5));
    p.health = Math.max(1, p.health - (1 + cr.addict / 30) * CR.harm(w)); p.stress = Math.max(0, p.stress - 4);
    if (R.next() < 0.002 * cr.addict / 100 * CR.harm(w)) { w.die(p, 'drug overdose'); st.overdoses++; return; }
    if (R.next() < 0.012 + 0.02 * p.pers.dis / 100) { cr.user = false; cr.clean = 0; P.log(w, p, 'Quit drugs', 'crime', 0); return; }
    if (R.next() < 0.015 * p.pers.resp / 100 * cr.addict / 100 + (policy === 'treatment' ? 0.01 : 0)) { CR.admit(w, p, 'rehab', 6, 'drug use'); st.voluntaryRehab++; return; }
    // Police: possession arrests (Malaysia arrests ~40% of users a year).
    if (policy !== 'decriminalised' && R.next() < 0.03 * police(w)) {
      cr.drugArrests++; st.drugArrests++;
      const prison = policy === 'punitive' || (policy === 'national' && cr.drugArrests > T(w).drugRepeat); // Malaysia: prison from the second arrest
      if (prison) CR.admit(w, p, 'prison', Math.round(R.range(12, 30)), 'drug possession');
      else CR.admit(w, p, 'rehab', policy === 'treatment' ? 6 : 12, 'drug use');
    }
  }
  function pickDealer(w, R) {
    const st = state(w), dealers = [];
    for (const g of st.gangs) if (g.alive) for (const id of g.members) { const q = w.people[id]; if (q && free(q)) dealers.push(q); }
    return dealers.length ? dealers[Math.floor(R.next() * dealers.length)] : null;
  }

  // ---------- Gangs ----------
  const blockOf = (w, p) => (p.homeId >= 0 ? LES.townBlockAt(w.town, w.town.buildings[p.homeId].x, w.town.buildings[p.homeId].y) : null);
  function gangsMonth(w, R) {
    const st = state(w), t = w.town;
    const maxGangs = CR.maxGangs(w);
    // Formation: offenders and the tempted, led by someone charismatic and bold.
    if (st.gangs.filter(g => g.alive).length < maxGangs && R.next() < 0.0015 * K(w)) {
      const pool = recruitPool(w);
      if (pool.length >= 3) {
        const leader = pool.reduce((a, b) => (b.att[C.CHA] + b.pers.risk / 20 > a.att[C.CHA] + a.pers.risk / 20 ? b : a));
        const hb = t.buildings[leader.homeId] || t.buildings[0];
        const others = pool.filter(q => q !== leader).sort((a, b) => dist(t, a, hb) - dist(t, b, hb)).slice(0, R.int(2, 4));
        const id = st.gangs.length, bl = blockOf(w, leader);
        const g = { id, name: (GN => { const a = R.pick(GN.a), b = R.pick(GN.b); return GN.pattern.replace('{a}', a).replace('{b}', b); })(LES.Countries.pack.gangNames), colour: GANG_COLOURS[id % GANG_COLOURS.length], leader: leader.id, members: [], cash: 0, turf: bl ? [t.blocks.indexOf(bl)] : [], founded: w.day, alive: true, crimes: 0, peak: 0 };
        st.gangs.push(g);
        for (const q of [leader, ...others]) join(w, g, q);
        w.pushFeed({ day: w.day, pid: leader.id, text: `A gang formed: ${g.name}, led by ${P.name(leader)}`, cat: 'crime', imp: 2 });
      }
    }
    for (const g of st.gangs) {
      if (!g.alive) continue;
      g.members = g.members.filter(id => { const q = w.people[id]; if (q.alive && !q.away) return true; q.cr.gang = -1; return false; });
      const active = g.members.filter(id => !w.people[id].inst);
      if (!active.length || g.members.length < 2) { disband(w, g, 'too few members left'); continue; }
      if (!active.includes(g.leader)) { // a new leader steps up
        g.leader = active.reduce((a, b) => (w.people[b].att[C.CHA] > w.people[a].att[C.CHA] ? b : a));
        P.log(w, w.people[g.leader], `Took over ${g.name}`, 'crime', 1);
      }
      // Protection money from shops on their turf.
      for (const b of w.biz) {
        if (!b.open || b.cash <= 0) continue;
        const bl = LES.townBlockAt(t, t.buildings[b.place].x, t.buildings[b.place].y);
        if (!g.turf.includes(t.blocks.indexOf(bl))) continue;
        const amt = Math.min(b.cash, Math.round(Math.max(0, b.lastRevenue || 0) * 0.02));
        if (amt > 0) { w.ledger.move(b, 'cash', g, 'cash', amt); st.protection += amt; g.take = (g.take || 0) + amt; }
      }
      // Recruit young people with few prospects who live on the turf.
      if (g.members.length < 12 && R.next() < 0.5) {
        for (let k = 0; k < 6; k++) {
          const q = w.living[Math.floor(R.next() * w.living.length)];
          if (!q || !q.adult || !free(q) || !q.cr || q.cr.gang >= 0 || P.age(w, q) > 30 || q.job || q.cr.t < 0.02) continue;
          const bl = blockOf(w, q);
          if (bl && g.turf.includes(t.blocks.indexOf(bl)) && R.next() < 0.35) { join(w, g, q); break; }
        }
      }
      // Members drift away as they age or start families.
      for (const id of g.members.slice()) { const q = w.people[id]; if ((P.age(w, q) > 40 || (q.careOf.length && q.pers.resp > 60)) && R.next() < 0.06) leave(w, g, q, 'left the gang'); }
      // Pay members, grow the turf.
      const pay = Math.floor(g.cash * 0.4 / Math.max(1, active.length));
      if (pay > 0) for (const id of active) w.ledger.move(g, 'cash', w.people[id], 'cash', pay);
      g.peak = Math.max(g.peak, g.members.length);
      if (g.cash > w.px(20000) * g.turf.length && g.turf.length < 6) {
        const near = adjacentBlocks(t, g.turf).filter(i => !st.gangs.some(o => o.alive && o.turf.includes(i)));
        if (near.length) g.turf.push(R.pick(near));
      }
      // Police crackdown on an active gang.
      if (R.next() < 0.025 * police(w) * policing(w).raid * Math.min(3, 1 + g.crimes / 10)) {
        let n = 0;
        for (const id of active) if (R.next() < 0.35) { CR.admit(w, w.people[id], 'prison', Math.round(R.range(24, 72)), 'gang crime'); n++; }
        if (n) { st.crackdowns++; w.pushFeed({ day: w.day, pid: -1, text: `Police raid on ${g.name}: ${n} member${n > 1 ? 's' : ''} jailed`, cat: 'crime', imp: 2 }); }
      }
      g.crimes = Math.floor(g.crimes * 0.8);
    }
    // Turf wars between neighbouring gangs.
    const live = st.gangs.filter(g => g.alive);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (!adjacentBlocks(t, a.turf).some(x => b.turf.includes(x)) || R.next() > 0.08) continue;
      const pa = w.people[a.members[Math.floor(R.next() * a.members.length)]];
      const pb = w.people[b.members[Math.floor(R.next() * b.members.length)]];
      if (!pa || !pb || !free(pa) || !free(pb)) continue;
      count(w, 'assault');
      st.gangFights++;
      pb.health = Math.max(1, pb.health - R.range(10, 40) * CR.harm(w));
      w.pushFeed({ day: w.day, pid: pa.id, text: `Turf fight between ${a.name} and ${b.name}`, cat: 'crime', imp: 1 });
      if (R.next() < Math.min(0.9, 0.12 * T(w).lethal) * CR.harm(w)) murder(w, pa, pb, 'a gang fight');
    }
  }
  const dist = (t, p, b) => { const h = t.buildings[p.homeId]; return h ? Math.abs(h.x - b.x) + Math.abs(h.y - b.y) : 1e9; };
  CR.maxGangs = w => 1 + Math.floor(w.town.blocks.length / 60);
  // People a new gang can be built from: offenders and the tempted, under 45.
  const recruitPool = w => w.living.filter(p => p.adult && free(p) && p.cr && p.cr.gang < 0 && (p.cr.rec > 0 || p.cr.t > 0.03) && P.age(w, p) < 45);
  CR.recruitPool = recruitPool;

  // ---------- Gangs across towns (used by LES.Region) ----------
  // A chapter is an ordinary gang in a sister town, run by a local, that carries its
  // parent's name and colour and sends part of its takings home (Region.gangSpread).
  CR.roomForGang = w => !!w.crime && w.crime.gangs.filter(g => g.alive).length < CR.maxGangs(w);
  // An established gang (4+ members, RM4k in funds, 2+ years old) that cannot gain turf
  // at home (more turf needs RM20k per block it holds, and a free block next to it)
  // looks further afield.
  CR.wantsToExpand = (w, g) => {
    if (!g.alive || g.parent || g.members.length < 4 || g.cash < w.px(4000) || w.day - g.founded < 730) return false;
    const canGrow = g.turf.length < 6 && g.cash > w.px(20000) * g.turf.length && adjacentBlocks(w.town, g.turf).some(i => !w.crime.gangs.some(o => o.alive && o.turf.includes(i)));
    return !canGrow;
  };
  CR.chapterIn = (w, town, gangId) => (w.crime ? w.crime.gangs.find(g => g.alive && g.parent && g.parent.town === town && g.parent.gang === gangId) : null);
  // parent = { town, gang, name, colour, townName }; leader = a local who brought the tie,
  // or null for the most charismatic, boldest local offender. R = the region's RNG.
  CR.foundChapter = function (w, parent, R, leader) {
    const t = w.town, pool = recruitPool(w).filter(p => p !== leader);
    if (!leader) {
      if (pool.length < 3) return null;
      leader = pool.reduce((a, b) => (b.att[C.CHA] + b.pers.risk / 20 > a.att[C.CHA] + a.pers.risk / 20 ? b : a));
      pool.splice(pool.indexOf(leader), 1);
    }
    if (!pool.length) return null;
    const hb = t.buildings[leader.homeId] || t.buildings[0], bl = blockOf(w, leader);
    const others = pool.sort((a, b) => dist(t, a, hb) - dist(t, b, hb) || a.id - b.id).slice(0, R.int(1, 3));
    const st = state(w), g = {
      id: st.gangs.length, name: `${parent.name} (${LES.townName(w)} chapter)`, colour: parent.colour, leader: leader.id, members: [], cash: 0,
      turf: bl ? [t.blocks.indexOf(bl)] : [], founded: w.day, alive: true, crimes: 0, peak: 0,
      parent: { town: parent.town, gang: parent.gang, name: parent.name, townName: parent.townName },
    };
    st.gangs.push(g);
    for (const q of [leader, ...others]) join(w, g, q);
    w.pushFeed({ day: w.day, pid: leader.id, text: `${parent.name} from ${parent.townName} opened a chapter here, led by ${P.name(leader)}`, cat: 'crime', imp: 2 });
    return g;
  };
  CR.joinGang = (w, g, p) => join(w, g, p);
  // Active gangs in a town, and how many of them are chapters of a gang elsewhere.
  CR.gangCount = w => { const live = w.crime ? w.crime.gangs.filter(g => g.alive) : []; return { live: live.length, chapters: live.filter(g => g.parent).length }; };
  // "Chapter of ... in ..." / "Chapters in ..." for the Crime tab.
  CR.linkText = function (w, g) {
    if (g.parent) return `chapter of ${g.parent.name} (${g.parent.townName})`;
    if (g.formerParent) return `split from ${g.formerParent}`;
    const R = w.region, live = (g.chapters || []).filter(c => R && R.towns[c.town] && R.towns[c.town].crime && R.towns[c.town].crime.gangs[c.gang] && R.towns[c.town].crime.gangs[c.gang].alive);
    return live.length ? `chapters in ${[...new Set(live.map(c => LES.townName(R.towns[c.town])))].join(', ')}` : '';
  };
  function adjacentBlocks(t, turf) {
    const out = [];
    for (const i of turf) { const b = t.blocks[i]; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = b.c + dc, r = b.r + dr; if (c >= 0 && r >= 0 && c < t.cols && r < t.rows) { const k = r * t.cols + c; if (!turf.includes(k) && !out.includes(k)) out.push(k); } } }
    return out;
  }
  function join(w, g, p) {
    if (p.cr.gang >= 0) return;
    g.members.push(p.id); p.cr.gang = g.id;
    P.log(w, p, g.leader === p.id ? `Founded the gang ${g.name}` : `Joined the gang ${g.name}`, 'crime', 1);
  }
  function leave(w, g, p, why) {
    g.members = g.members.filter(id => id !== p.id); p.cr.gang = -1;
    P.log(w, p, `${why[0].toUpperCase()}${why.slice(1)}: ${g.name}`, 'crime', 0);
  }
  function disband(w, g, why) {
    const share = g.members.length ? Math.floor(g.cash / g.members.length) : 0;
    for (const id of g.members) { const q = w.people[id]; if (share > 0 && q.alive && !q.away) w.ledger.move(g, 'cash', q, 'cash', share); q.cr.gang = -1; }
    if (g.cash > 0) w.ledger.move(g, 'cash', w.ledger.sec.MERCHANT, 'bal', g.cash);
    g.alive = false; g.members = []; g.ended = w.day;
    w.pushFeed({ day: w.day, pid: -1, text: `${g.name} broke up (${why})`, cat: 'crime', imp: 2 });
  }

  // Unemployment, household inequality and job openings (for temptation).
  function townContext(w) {
    const h = w.history[w.history.length - 1];
    const unemp = h ? h.unemployed / Math.max(1, h.unemployed + h.employed + h.owners) : 0.03;
    const inc = [];
    for (const p of w.living) if (p.alive && p.adult && p.isHead) inc.push(p.incomeEMA + (p.partnerId !== null ? w.people[p.partnerId].incomeEMA : 0));
    inc.sort((a, b) => a - b);
    const idle = h ? Math.max(1, h.unemployed) : 1;
    return { unemp, gini: inc.length > 5 ? U.gini(inc) : 0.39, vac: w.vacancies.length / idle };
  }

  // ---------- The system ----------
  const sys = {
    id: 'crime', order: 20,
    enabled: cfg => !!CR.INTENSITY[cfg.crime],
    init(w) {
      w.crime = {
        cases: [], gangs: [], month: {}, total: {}, hist: [], victimsByClass: {},
        arrests: 0, remanded: 0, convictions: 0, acquitted: 0, lawyers: 0, admissions: 0, rehabAdmissions: 0, released: 0, reoffended: 0,
        drugArrests: 0, startedUsing: 0, overdoses: 0, voluntaryRehab: 0, protection: 0, crackdowns: 0, gangFights: 0,
      };
      for (const p of w.people) if (!p.cr) { p.cr = newCr(); p.inst = null; }
    },
    personCreated(w, p) { p.cr = newCr(); p.inst = null; },
    hireWeight: (w, p) => (p.cr && p.cr.rec && !(w.policy && !w.policy.recordCheck) ? 0.6 : 1) * (p.cr && p.cr.user ? 0.8 : 1),
    money(w) { let s = 0; for (const g of w.crime.gangs) s += g.cash; return s; },

    candidates(w, p, ctx, slot, add) {
      const cr = p.cr;
      if (!cr || cr.opp !== w.day || slot !== cr.oppSlot || !cr.oppType) return;
      const def = CR.TYPES[cr.oppType];
      const u = 0.6 + 1.4 * ctx.urg + 0.8 * ctx.risk - 0.9 * ctx.resp - 0.5 * ctx.dis + 4 * cr.t + (cr.gang >= 0 ? 0.5 : 0) + cr.addict / 80;
      add(0, 'CRIME', u, p.homeId, cr.oppType);
      void def;
    },
    label: (id, data) => (id === 'CRIME' ? `Crime: ${CR.TYPES[data] ? CR.TYPES[data].name.toLowerCase() : data}` : id === 'PRISON' ? 'In prison' : undefined),
    resolve(w, p, c) {
      if (c.id !== 'CRIME') return false;
      p.cr.opp = -1;
      p.energy -= 10;
      commit(w, p, c.data);
      if (p.cr.gang >= 0) { const g = w.crime.gangs[p.cr.gang]; if (g) g.crimes++; }
      return true;
    },

    day(w) {
      const st = w.crime;
      if (st.cases.length) {
        const due = [], rest = [];
        for (const c of st.cases) (c.arrest <= w.day ? due : rest).push(c);
        st.cases = rest;
        for (const c of due) arrest(w, c);
      }
      for (const p of w.living) {
        if (!p.inst || w.day < p.inst.until || !p.alive) continue;
        if (p.inst.kind === 'remand') { const c = p.inst.case; c.remandFrom = p.inst.since; p.inst = null; verdict(w, p, c); }
        else release(w, p);
      }
    },

    month(w) {
      const R = w.rng.crime, st = w.crime, k = K(w);
      // Deterrence follows the share of recent crimes the police solved; the town's economy sets the mood.
      if (st.crimesNow) st.certainty = 0.85 * (st.certainty === undefined ? 0.5 : st.certainty) + 0.15 * (st.solvedNow || 0) / st.crimesNow;
      st.lastCrimes = 0.6 * (st.lastCrimes || 0) + 0.4 * (st.crimesNow || 0);
      st.solvedTotal = (st.solvedTotal || 0) + (st.solvedNow || 0); st.crimesTotal = (st.crimesTotal || 0) + (st.crimesNow || 0);
      st.crimesNow = 0; st.solvedNow = 0;
      st.town = townContext(w);
      for (const p of w.living) {
        if (!p.alive || !p.adult || !p.cr) continue;
        const cr = p.cr;
        cr.fear *= 0.85;
        if (p.inst) continue;
        drugsMonth(w, p, R);
        if (!p.alive || p.inst) continue;
        cr.t = temptation(w, p);
        if (R.next() < Math.min(0.6, cr.t * k * (BASE * T(w).opportunity) * 30)) {
          cr.opp = w.day + R.int(1, 27); cr.oppSlot = R.next() < 0.5 ? 0 : 1; cr.oppType = pickType(w, p, R);
        }
      }
      gangsMonth(w, R);
      st.hist.push(st.month); if (st.hist.length > 12) st.hist.shift();
      st.month = {};
    },

    snapshot(w, row) {
      const st = w.crime, pop = Math.max(1, w.counts.living), per = x => x / pop * 1e5;
      const yr = {};
      for (const m of st.hist) for (const t in m) yr[t] = (yr[t] || 0) + m[t];
      const months = Math.max(1, st.hist.length), ann = x => x * 12 / months;
      const index = CR.INDEX.reduce((s, t) => s + (yr[t] || 0), 0);
      let prisoners = 0, rehab = 0, custody = 0, users = 0, gangMembers = 0; // C05: prison, police lock-up (remand) and rehab apart
      for (const p of w.living) { if (!p.alive || !p.cr) continue; if (p.inst) (p.inst.kind === 'rehab' ? rehab++ : p.inst.kind === 'remand' ? custody++ : prisoners++); if (p.cr.user) users++; if (p.cr.gang >= 0) gangMembers++; }
      row.cr = { index: per(ann(index)), murder: per(ann(yr.murder || 0)), scam: per(ann(yr.scam || 0)), prison: per(prisoners), custody: per(custody), rehab, users: per(users), prisoners, gangs: st.gangs.filter(g => g.alive).length, gangMembers,
        cert: st.certainty === undefined ? 0.5 : st.certainty, cap: CR.capacity(w), unemp: st.town ? st.town.unemp : 0 };
    },

    invariants(w, errs) {
      for (const g of w.crime.gangs) {
        if (!Number.isInteger(g.cash) || g.cash < 0) errs.push(`gang ${g.id} cash ${g.cash}`);
        if (!g.alive && (g.members.length || g.cash)) errs.push(`dead gang ${g.id} still has members or cash`);
        for (const id of g.members) if (w.people[id].cr.gang !== g.id) errs.push(`gang ${g.id} member ${id} link broken`);
      }
      for (const p of w.people) {
        if (!p.cr) continue;
        if (p.inst && (!p.alive || p.away || (p.inst.kind !== 'remand' && (p.job || p.enrol || p.manages >= 0 || p.careOf.length)))) errs.push(`P${p.id} in ${p.inst.kind} still active`);
        if (p.cr.gang >= 0 && (!w.crime.gangs[p.cr.gang] || !w.crime.gangs[p.cr.gang].members.includes(p.id))) errs.push(`P${p.id} gang link broken`);
        if (!(p.cr.addict >= 0 && p.cr.addict <= 100)) errs.push(`P${p.id} addiction ${p.cr.addict}`);
      }
    },
    hash(w, parts) {
      for (const p of w.people) if (p.cr) { parts.push(p.cr.rec, p.cr.gang, p.inst ? p.inst.until : '-', Math.round(p.cr.addict)); if (p.cr.tie) parts.push('tie', p.cr.tie.town, p.cr.tie.gang); }
      for (const g of w.crime.gangs) { parts.push(g.cash, g.members.length); if (g.parent) parts.push('ch', g.parent.town, g.parent.gang); }
    },
  };
  LES.Systems.register(sys);
  LES.Actions.ICONS.CRIME = '🦹'; LES.Actions.ICONS.PRISON = '⛓️';
  LES.Actions.LABELS.CRIME = 'Crime'; LES.Actions.LABELS.PRISON = 'In prison';

  // Rates per 100,000 over the last 12 months (for the Crime tab and calibration).
  CR.rates = function (w) {
    const st = w.crime, yr = {};
    for (const m of st.hist) for (const t in m) yr[t] = (yr[t] || 0) + m[t];
    const months = Math.max(1, st.hist.length), pop = Math.max(1, w.counts.living), per = x => x * 12 / months / pop * 1e5;
    const out = {};
    for (const t in CR.TYPES) out[t] = per(yr[t] || 0);
    out.index = CR.INDEX.reduce((s, t) => s + out[t], 0);
    out.violent = ['robbery', 'assault', 'murder'].reduce((s, t) => s + out[t], 0);
    out.property = out.index - out.violent;
    return out;
  };
  LES.Countries.require('gangNames.pattern', 'gangNames.a', 'gangNames.b', 'crime.index', 'crime.violent', 'crime.property', 'crime.murder', 'crime.users', 'crime.prison');
  LES.Countries.on('crime', pack => {
    TUNE = Object.assign({}, TUNE0, pack.crimeTuning || {}); TUNE8 = Object.assign({}, TUNE, pack.crimeTuningRev8 || {}); for (const k of Object.keys(CR.REF)) delete CR.REF[k]; Object.assign(CR.REF, pack.crime); });
})(globalThis.LES = globalThis.LES || {});
