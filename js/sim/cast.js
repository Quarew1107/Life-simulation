// My Cast: people the user designs. They follow exactly the same rules as everyone else;
// p.custom marks them. A cast "household" is the people linked as partners or as parent
// and child: they arrive together, partners as a couple in one home, children in their
// parents' care.
// - Founders: cfg.cast (chosen on the setup screen) joins the town on day 1. With no cast,
//   nothing here runs, so other worlds are unchanged.
// - Arrivals: people added during a run come by train and are recorded in
//   cfg.castArrivals (with the day), so a replay from the same settings adds them on the
//   same day and gives the same history.
// Each household uses its own random stream (seed|cast|n|day), so adding one never shifts
// the founders' dice.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance, Fa = LES.Family;
  const Cast = LES.Cast = {};
  Cast.QUALS = [['', 'No qualification'], ['VOC', 'Vocational certificate'], ['BACH_GEN', 'Bachelor of Arts'], ['BACH_BUS', 'Bachelor of Business'], ['BACH_ENG', 'Bachelor of Engineering'], ['MED', 'Medical degree']];
  // A spec: { id, first, last, sex, age, eth, rel, relig, att[6], pers{}, famDesire, strategy, qual, cash, look{},
  //           partner: id | '', parents: [ids], town: 0-2 }
  Cast.blank = () => ({ id: '', first: 'Aina', last: 'Rahman', sex: 'F', age: 25, eth: 'malay', rel: '', relig: 50, att: [5, 5, 5, 5, 5, 5],
    pers: { dis: 50, pat: 50, risk: 50, resp: 50, res: 50 }, famDesire: 55, strategy: 'BAL', qual: '', cash: 10000, partner: '', parents: [],
    look: { skin: '#c68642', hair: '#1b1b1b', shirt: '#2a9d8f', pants: '#1d3557', style: 1, scarf: '#c9184a', glasses: 0, beard: 0, hat: 0, hatColour: '#1d3557' } });
  const ADULT = 18;

  // Group specs into households (connected by partner or parent links), in list order.
  Cast.households = function (specs) {
    const byId = new Map(specs.filter(s => s.id).map(s => [s.id, s])), seen = new Set(), out = [];
    for (const s of specs) {
      if (seen.has(s)) continue;
      const group = [], todo = [s];
      while (todo.length) {
        const x = todo.pop();
        if (seen.has(x)) continue;
        seen.add(x); group.push(x);
        const links = [x.partner, ...(x.parents || [])].map(id => byId.get(id)).filter(Boolean);
        for (const y of specs) if (y.id && x.id && (y.partner === x.id || (y.parents || []).includes(x.id))) links.push(y);
        for (const y of links) if (!seen.has(y)) todo.push(y);
      }
      out.push(group.sort((a, b) => specs.indexOf(a) - specs.indexOf(b)));
    }
    return out;
  };

  // The people a spec's household brings (for "add to town" and the setup picker).
  Cast.householdOf = (specs, spec) => Cast.households(specs).find(g => g.includes(spec)) || [spec];

  function applySpec(w, p, spec) {
    p.custom = true;
    p.first = String(spec.first || p.first).slice(0, 30); p.last = String(spec.last || p.last).slice(0, 30);
    for (const k of C.PERS) p.pers[k] = Math.round(U.clamp(Number(spec.pers[k]), 0, 100));
    p.famDesire = Math.round(U.clamp(Number(spec.famDesire), 0, 100));
    Object.assign(p.look, spec.look || {});
    if (w.society && spec.rel) { p.rel = spec.rel; p.relig = Math.round(U.clamp(Number(spec.relig), 0, 100)); }
  }

  function makeAdult(w, R, spec, founder) {
    const eth = C.NAMES[spec.eth] ? spec.eth : 'malay';
    const p = w.makeAdult(R, { age: U.clamp(Math.round(spec.age), ADULT, 90), sex: spec.sex === 'M' ? 'M' : 'F', eth, migrant: !founder, jobChance: founder ? 0.65 : 0 });
    applySpec(w, p, spec);
    p.att = spec.att.map(v => U.clamp(Number(v) || 0, 0, 10)); p.pot = p.att.map(v => Math.max(v, U.clamp(v + 0.3, 0, 10))); p.peak = p.att.slice();
    p.attHist = [[w.day, p.att.slice()]];
    if (C.STRATEGIES.includes(spec.strategy)) { p.strategy = spec.strategy; p.stratHist = [{ day: w.day, strategy: p.strategy, reason: 'your choice' }]; }
    p.quals = spec.qual ? [spec.qual] : [];
    if (p.job && !P.hasCred(p, C.JOB_BY_ID[p.job.jobId].req)) LES.Labour.endJob(w, p, 'moved town', true);
    const want = w.px(U.clamp(Number(spec.cash) || 0, 0, 1e9)), src = founder ? 'GENESIS' : 'ABROAD';
    if (p.cash > want) w.ledger.spend(p, 'cash', src, p.cash - want); else if (p.cash < want) w.ledger.pay(src, p, 'cash', want - p.cash);
    p.isHead = true;
    LES.Goals.pick(w, p, null);
    return p;
  }

  // A child of one or two cast parents: the abilities chosen are their potential; at their
  // age they start lower (as for any child) and grow with care and schooling.
  function makeChild(w, R, spec, parents, founder) {
    const age = U.clamp(Math.round(spec.age), 0, ADULT - 1), c = w.addPerson();
    c.sex = spec.sex === 'M' ? 'M' : 'F';
    c.eth = C.NAMES[spec.eth] ? spec.eth : parents[0].eth;
    c.first = R.pick(C.NAMES[c.eth][c.sex]); c.last = parents[0].last;
    c.birthDay = w.day - age * 365 - (age > 0 ? R.int(0, 364) : 0);
    c.gen = Math.max(...parents.map(q => q.gen)) + 1;
    c.parents = parents.map(q => q.id);
    c.migrant = !founder; if (c.migrant) c.arrivedDay = w.day;
    c.look = P.makeLook(R, c.eth, c.sex);
    c.ageing = P.makeAgeing(R);
    applySpec(w, c, spec);
    c.pot = spec.att.map(v => U.clamp(Number(v) || 0, 0, 10));
    c.att = c.pot.map(v => U.clamp(v * (0.3 + 0.55 * Math.min(age, 18) / 18), 0, 10));
    c.health = 90; c.energy = 100; c.stress = 0;
    c.tiers = { food: 1, housing: 0, transport: 0, leisure: 0 };
    for (const q of parents) { q.children.push(c.id); Fa.addCare(w, q, c); }
    for (const s of w.sys.personCreated) s.personCreated(w, c, 'child');
    if (w.society && spec.rel) { c.rel = spec.rel; c.relig = Math.round(U.clamp(Number(spec.relig), 0, 100)); }
    return c;
  }

  // Add one household. Returns the new people in spec order.
  Cast.addGroup = function (w, specs, founder) {
    w.castN = (w.castN || 0) + 1;
    const R = new LES.RNG(`${w.cfg.seed}|cast|${w.castN}|${w.day}`), made = new Map();
    const born = s => w.day - Math.round(s.age) * 365;
    // A child needs a cast parent at least 12 years older in the same household; otherwise
    // they come as a young adult.
    const parentsOf = s => specs.filter(q => (s.parents || []).includes(q.id) && q.age >= ADULT && born(q) < born(s) - 12 * 365);
    const isChild = s => s.age < ADULT && parentsOf(s).length > 0;
    for (const s of specs) if (!isChild(s)) made.set(s, makeAdult(w, R, Object.assign({}, s, { age: Math.max(ADULT, s.age) }), founder));
    // Couples: partners in the household (a man and a woman, as for every couple in town).
    for (const s of specs) {
      const p = made.get(s), t = specs.find(q => q.id && q.id === s.partner), q = t && made.get(t);
      if (!p || !q || p.partnerId !== null || q.partnerId !== null || p.sex === q.sex) continue;
      p.partnerId = q.id; q.partnerId = p.id;
      const head = p.nw >= q.nw ? p : q, other = head === p ? q : p;
      head.isHead = true; other.isHead = false;
    }
    // Adult children of cast parents keep the family link.
    for (const s of specs) {
      const c = made.get(s);
      if (!c || isChild(s)) continue;
      for (const t of parentsOf(s)) { const q = made.get(t); if (q && !c.parents.includes(q.id) && c.parents.length < 2) { c.parents.push(q.id); q.children.push(c.id); } }
    }
    // Homes: each head finds one; partners and children move in.
    for (const p of made.values()) if (p.isHead) F.reviewTiers(w, p);
    for (const p of made.values()) {
      if (p.isHead) continue;
      const head = w.people[p.partnerId];
      p.tiers.housing = head.tiers.housing; F.setHome(w, p, head.homeId); F.reviewTiers(w, p);
    }
    for (const s of specs) {
      if (!isChild(s)) continue;
      const ps = parentsOf(s).map(t => made.get(t));
      const c = makeChild(w, R, s, ps, founder), home = ps.find(q => q.isHead) || ps[0];
      F.setHome(w, c, home.homeId);
      made.set(s, c);
    }
    for (const p of made.values()) if (p.adult) { p.mcost = F.monthlyCost(w, p); p.nw = P.netWorth(w, p); p.peakNw = p.nw; }
    const people = specs.map(s => made.get(s)), lead = people.find(p => p.adult) || people[0], n = people.length;
    const others = n > 1 ? ` with ${n - 1} family member${n > 2 ? 's' : ''}` : '';
    if (founder) P.log(w, lead, `One of the founders of ${LES.townName(w)} (your cast)${others}`, 'life', 1);
    else {
      P.log(w, lead, `Arrived in ${LES.townName(w)} (one of your cast)${others} with ${U.fmtMoney(lead.cash)}`, 'life', 2);
      w.pushFeed({ day: w.day, pid: lead.id, text: `★ ${P.name(lead)} (your cast) arrived in ${LES.townName(w)}${others}`, cat: 'life', imp: 2 });
      w.stats.immigrants += n;
    }
    w.refreshLiving();
    return people;
  };

  // Founders chosen on the setup screen (called while the world is built).
  Cast.founders = function (w) {
    for (const g of Cast.households(w.cfg.cast || [])) Cast.addGroup(w, g, true);
  };
  // Where arrivals are recorded: the region's shared settings (with the town) or the world's.
  const owner = w => (w.region ? w.region.base : w.cfg), townOf = w => w.townIdx || 0;
  const mine = w => (owner(w).castArrivals || []).filter(a => (a.town || 0) === townOf(w));
  // Add a household during a run: they arrive now and are recorded in the settings.
  Cast.arrive = function (w, specs) {
    const o = owner(w);
    o.castArrivals = (o.castArrivals || []).concat([{ day: w.day, town: townOf(w), specs: JSON.parse(JSON.stringify(specs)) }]);
    w.castDone = mine(w).length;
    return Cast.addGroup(w, specs, false);
  };
  // In a replay: households recorded for today arrive before the day starts.
  Cast.due = function (w) {
    const list = mine(w);
    while ((w.castDone || 0) < list.length && list[w.castDone || 0].day <= w.day) {
      const a = list[w.castDone || 0];
      w.castDone = (w.castDone || 0) + 1;
      Cast.addGroup(w, a.specs, false);
    }
  };
  // One person on their own (kept for older callers).
  Cast.add = (w, spec) => Cast.arrive(w, [spec])[0];
})(globalThis.LES = globalThis.LES || {});
