// A region of up to three towns (setting "towns"; one town by default). Each town is a
// complete LES.World with its own people, ledger, council and laws. The Region steps them
// in lockstep (same day, fixed order) and adds what links them:
// - one national economy: the first town ("lead") runs the business cycle, inflation and
//   the stock market; the others follow it, and every resident trades on the same Bursa
// - moving between towns: households that decide to leave a town may move to a sister
//   town instead of leaving the region, choosing by its jobs, rent and attractiveness
// Interactions use the region's own RNG and a fixed order, so results stay reproducible.
// (Commuting, shopping and spillovers are planned next: see docs/HANDOFF.md.)
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, F = LES.Finance;
  LES.MAX_TOWNS = 3;
  LES.TOWN_NAMES = ['Bandar Rezeki', 'Pekan Damai', 'Kuala Sentosa'];
  LES.townName = w => (w && (w.townName || (w.cfg && w.cfg.townName))) || LES.C.TOWN_NAME;

  // Founders per town for the "towns" setting: the first town gets the founding population,
  // the others about 60% and 40% of it.
  LES.regionFounders = cfg => [1, 0.6, 0.4].slice(0, Math.max(1, Number(cfg.towns) || 1)).map(k => Math.max(20, Math.round(cfg.founders * k)));
  LES.makeRegion = function (cfg) {
    const n = LES.regionFounders(cfg);
    return new Region(cfg, n.map((f, i) => ({ name: LES.TOWN_NAMES[i], townName: LES.TOWN_NAMES[i], founders: f, seed: i ? `${cfg.seed}~${i + 1}` : cfg.seed })));
  };

  class Region {
    // towns: [{ name, seed, founders, ... }] - each entry overrides the base settings.
    constructor(base, towns) {
      const list = towns.slice(0, LES.MAX_TOWNS);
      Object.defineProperty(this, 'towns', { value: [], enumerable: true, writable: true });
      this.base = base;
      this.rng = new LES.RNG(`${base.seed}|region`);
      this.moves = []; // { day, from, to, ids: [[fromId, toId]], reason }
      list.forEach((t, i) => {
        const w = new LES.World(Object.assign({}, base, t));
        Region.attach(w, this, i, t.name || LES.TOWN_NAMES[i] || `Town ${i + 1}`);
        this.towns.push(w);
      });
      const lead = this.towns[0];
      for (const w of this.towns.slice(1)) w.mkt = lead.mkt; // one stock exchange
      this.sync();
    }
    static attach(w, region, i, name) {
      Object.defineProperty(w, 'region', { value: region, enumerable: false, writable: true, configurable: true });
      w.townIdx = i; w.townName = name; w.follower = i > 0;
    }
    get lead() { return this.towns[0]; }
    get day() { return this.lead.day; }
    get ended() { return this.towns.every(w => w.ended); }

    // Followers copy the national economy from the lead town.
    sync() {
      const L = this.lead;
      for (const w of this.towns.slice(1)) {
        w.regime = L.regime; w.regimeHist = L.regimeHist; w.infl = L.infl; w.inflHist = L.inflHist;
      }
    }

    step() {
      for (const w of this.towns) if (!w.ended) w.step();
      this.sync();
      const L = this.lead;
      if (L.date.lastOfMonth) this.monthClose();
      this.commuteDay();
    }

    // ---- Commuting: some private job openings in one town are advertised in its sister
    // towns too (the bus and train run between them). Applicants commute and are paid by
    // the employer; it costs them time and energy. Openings that stay unfilled at home, in
    // towns with fewer jobs than workers, are the ones that travel.
    commuteDay() {
      const R = this.rng;
      for (const B of this.towns) {
        if (B.ended || !B.vacancies.length) continue;
        for (const A of this.towns) {
          if (A === B || A.ended) continue;
          const slack = (A.townMood ? A.townMood.unemp : 0) - (B.townMood ? B.townMood.unemp : 0); // commuters go where work is
          for (const v of B.vacancies) {
            if (v.shared || v.biz >= 0 || v.commuteTo !== undefined || v.job.gov || v.job.commute || LES.Services && LES.Services.PUBLIC_JOBS.has(v.job.id)) continue;
            if (B.day - v.openDay !== 2 || v.applicants.length || R.next() > U.clamp(0.25 + 3 * slack, 0.05, 0.6)) continue; // nobody local applied yet
            v.shared = true;
            const st = A.town.kinds.station && A.town.kinds.station.length ? A.town.kinds.station[0] : A.town.byKind.depot;
            A.vacancies.push({ id: A.nextVacId++, job: v.job, salary: v.salary, openDay: A.day, closeDay: v.closeDay, applicants: [], appSet: new Set(), place: st, commuteTo: B.townIdx, commuteName: B.townName });
            A.vacancies.sort((a, b) => (b.salary - a.salary) || (a.id - b.id));
            this.commutePosts = (this.commutePosts || 0) + 1;
          }
        }
        B.vacancies = B.vacancies.filter(v => !v.shared); // the opening is now filled from the sister town
      }
    }
    // Residents of each town who work in another one.
    commuters() { return this.towns.map(w => w.living.filter(p => p.alive && p.job && p.job.commuteTo !== undefined).length); }

    monthClose() {
      // Shared Bursa: the town's market influence is everyone's holdings together.
      let hold = 0;
      for (const w of this.towns) for (const p of w.living) if (p.alive && !p.away) hold += P.invValue(w, p);
      this.lead.mkt.townHold = hold;
      // Shopping: the bigger town is the regional hub (mall, restaurants) and draws some of
      // its neighbours' spending; small towns' shops lose a little trade to it.
      const pops = this.towns.map(w => Math.max(1, w.counts.living)), avg = pops.reduce((a, b) => a + b, 0) / pops.length;
      this.towns.forEach((w, i) => { w.regionDemand = U.clamp(Math.pow(pops[i] / avg, 0.12), 0.9, 1.1); });
      this.settleMoves();
      this.followDeaths();
    }

    // ---- Moving between towns ----
    // Called by Migration.leave in a town with a sister town: the household has already
    // left (money paid out, homes freed). Decide whether it settles in a sister town.
    onLeave(w, group, reason) {
      const others = this.towns.filter(t => t !== w && !t.ended);
      if (!others.length) return;
      const R = this.rng;
      const score = t => U.clamp((t.townMood ? t.townMood.attract : 0.5) + 0.5 * (t.townMood ? t.townMood.opportunity : 0) - 0.5 * (t.townMood ? t.townMood.pressure : 0), 0.05, 3);
      const best = others.map(t => ({ t, s: score(t) })).sort((a, b) => b.s - a.s || a.t.townIdx - b.t.townIdx)[0];
      if (R.next() >= U.clamp(0.35 + 0.25 * best.s, 0.2, 0.85)) return; // otherwise they leave the region
      this.pending = this.pending || [];
      this.pending.push({ from: w.townIdx, to: best.t.townIdx, ids: group.map(p => p.id), reason });
    }

    settleMoves() {
      const list = this.pending || [];
      this.pending = [];
      for (const mv of list) this.relocate(mv);
    }

    // Copy a household into the destination town. The origin keeps a record of them as
    // "moved to <town>" (they are not simulated there any more).
    relocate(mv) {
      const A = this.towns[mv.from], B = this.towns[mv.to];
      const src = mv.ids.map(id => A.people[id]).filter(p => p.alive && p.away && p.away.town === undefined);
      if (!src.length) return;
      const map = new Map(), made = [];
      for (const s of src) {
        const c = B.addPerson();
        map.set(s.id, c);
        for (const k of ['sex', 'eth', 'first', 'last', 'birthDay', 'gen', 'look', 'ageing', 'famDesire', 'strategy', 'health', 'adult', 'isHead', 'retired', 'rel', 'relig', 'clan', 'clsOrigin', 'cls', 'cls35']) if (s[k] !== undefined) c[k] = typeof s[k] === 'object' && s[k] !== null ? JSON.parse(JSON.stringify(s[k])) : s[k];
        c.pot = s.pot.slice(); c.att = s.att.slice(); c.peak = s.peak.slice(); c.pers = Object.assign({}, s.pers); c.xp = Object.assign({}, s.xp);
        c.quals = s.quals.slice(); c.attHist = [[B.day, c.att.slice()]]; c.stratHist = [{ day: B.day, strategy: c.strategy, reason: 'moved town' }];
        c.migrant = true; c.arrivedDay = B.day; c.timesMoved = (s.timesMoved || 0);
        c.debt = { study: s.debt.study, studyOrig: s.debt.studyOrig };
        c.xlinks = [{ town: A.townIdx, id: s.id, rel: 'self' }];
        for (const pid of s.parents) if (!mv.ids.includes(pid)) c.xlinks.push({ town: A.townIdx, id: pid, rel: 'parent' });
        for (const cid of s.children) if (!mv.ids.includes(cid)) c.xlinks.push({ town: A.townIdx, id: cid, rel: 'child' });
        made.push([s, c]);
      }
      // Family links inside the household.
      for (const [s, c] of made) {
        if (s.partnerId !== null && map.has(s.partnerId)) c.partnerId = map.get(s.partnerId).id;
        c.parents = s.parents.filter(id => map.has(id)).map(id => map.get(id).id);
        c.children = s.children.filter(id => map.has(id)).map(id => map.get(id).id);
        c.careOf = s.careOf.filter(id => map.has(id)).map(id => map.get(id).id);
        c.caregivers = s.caregivers.filter(id => map.has(id)).map(id => map.get(id).id);
        for (const sys of B.sys.personCreated) sys.personCreated(B, c, c.adult ? 'adult' : 'child');
        for (const k of ['rel', 'relig', 'clan']) if (s[k] !== undefined) c[k] = s[k]; // keep who they are
        if (s.pol && c.pol) { c.pol.econ = s.pol.econ; c.pol.soc = s.pol.soc; }
        if (s.cr && c.cr) { c.cr.rec = s.cr.rec; c.cr.offences = s.cr.offences; c.cr.addict = s.cr.addict; c.cr.user = s.cr.user; }
        const amt = Math.max(0, Math.round(s.away.wealth));
        B.ledger.pay('ABROAD', c, c.adult ? 'cash' : 'trust', amt);
        s.away.wealth = 0; s.away.town = B.townIdx; s.away.id = c.id; s.nw = 0;
        c.incomeEMA = B.px(800);
        LES.Goals.pick(B, c, null);
      }
      const head = made.map(x => x[1]).find(c => c.adult && c.isHead) || made[0][1];
      head.isHead = true;
      F.reviewTiers(B, head);
      for (const [, c] of made) {
        if (c === head) continue;
        if (c.adult) { c.tiers.housing = head.tiers.housing; F.setHome(B, c, head.homeId); F.reviewTiers(B, c); } else F.setHome(B, c, head.homeId);
      }
      for (const [, c] of made) { if (c.adult) c.mcost = F.monthlyCost(B, c); c.nw = P.netWorth(B, c); c.peakNw = c.nw; }
      const n = made.length;
      P.log(B, head, `Moved here from ${A.townName}${n > 1 ? ` with ${n - 1} family member${n > 2 ? 's' : ''}` : ''} (${mv.reason})`, 'migration', 1);
      P.log(A, made[0][0], `Settled in ${B.townName}`, 'migration', 0);
      B.stats.immigrants += n;
      B.refreshLiving();
      this.moves.push({ day: B.day, from: A.townIdx, to: B.townIdx, n, reason: mv.reason, pairs: made.map(([s, c]) => [s.id, c.id]) });
      if (this.moves.length > 500) this.moves.shift();
    }

    // When someone who moved dies in their new town, their record in the old town closes too.
    followDeaths() {
      for (const A of this.towns) for (const p of A.people) {
        if (!p.alive || !p.away || p.away.town === undefined) continue;
        const c = this.towns[p.away.town].people[p.away.id];
        if (c && !c.alive) A.die(p, c.causeOfDeath || 'natural causes');
      }
    }

    // Link to the same person in another town (UI).
    static where(w, p) { return p.away && p.away.town !== undefined && w.region ? { w: w.region.towns[p.away.town], id: p.away.id } : null; }

    hash() { return this.towns.map(w => w.stableHash()).join('|'); }
    checkInvariants() { const out = []; this.towns.forEach((w, i) => { for (const e of w.checkInvariants()) out.push(`${w.townName}: ${e}`); }); if (this.towns.some(w => w.mkt !== this.lead.mkt)) out.push('market not shared'); return out; }
  }
  LES.Region = Region;
})(globalThis.LES = globalThis.LES || {});
