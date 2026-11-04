// The world: founders, the daily ordered tick, month/year close, deaths,
// milestones, statistics, invariant checks and a state hash for reproducibility.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, A = LES.Actions, F = LES.Finance, Fa = LES.Family, Lb = LES.Labour;

  // Yearly death risk by age; mult scales the old-age (Gompertz) part (settings: mortMult).
  const mortalityYear = (age, mult = 1) => age < 1 ? 0.004 : age < 18 ? 0.0003 : 0.0004 + 0.000015 * mult * Math.exp(0.1 * age);
  LES.mortalityYear = mortalityYear;

  class World {
    constructor(cfgIn) {
      this.cfg = Object.assign({}, LES.DEFAULTS, cfgIn || {});
      const v = LES.validateConfig(this.cfg);
      if (v.blockers.length) throw new Error('Invalid settings: ' + v.blockers.join(' '));
      this.derived = LES.derive(this.cfg);
      this.attachSystems();
      this.rng = {};
      for (const k of ['init', 'decide', 'outcome', 'jobs', 'market', 'biz', 'family', 'luck', 'mortality', 'migration', 'goals', 'society', 'crime', 'gov']) {
        this.rng[k] = new LES.RNG(`${this.cfg.seed}|${k}`);
      }
      const ms = this.cfg.mapSize === 'auto' ? LES.suggestMapSize(this.cfg.founders) : this.cfg.mapSize;
      this.mapSize = LES.MAP_ALIASES[ms] || ms;
      this.town = LES.buildTown(this.mapSize, this.cfg.seed, this.cfg.layout);
      this.townVersion = 0;
      this.day = 0;
      this.lastDay = -1;
      this.date = U.dayToDate(0);
      this.people = []; this.living = []; this.biz = []; this.vacancies = []; this.nextVacId = 0;
      this.ledger = new LES.Ledger();
      this.price = 1;            // price level vs Year 1
      this.infl = (this.cfg.inflMin + this.cfg.inflMax) / 200;
      this.inflHist = [{ year: 1, rate: this.infl }];
      this.rentMult = [1, 1, 1, 1, 1];
      this.crowding = 0;
      this.townMood = { pressure: 0, opportunity: 0, attract: 0.5, unemp: 0, crowding: 0, rent: 1 };
      this.mkt = LES.Market.create();
      this.regime = 'normal';
      this.regimeHist = [{ day: 0, regime: 'normal' }];
      this.feed = []; this.feedSeq = 0; this.estates = []; this.history = []; this.socialPools = new Map();
      this.occupancy = {}; this.shoplotOwner = {};
      this.stats = {
        births: 0, deaths: 0, twins: 0, hires: 0, fired: 0, laidOff: 0, promotions: 0, graduations: 0, dropouts: 0,
        scholarships: 0, bizStarted: 0, bizClosed: 0, bizFailed: 0, booms: 0, bankruptcies: 0, couples: 0, breakups: 0,
        catastrophes: 0, illnesses: 0, scams: 0, windfalls: 0, welfareKids: 0, vacOpened: 0, vacUnfilled: 0,
        panicSells: 0, emigrants: 0, immigrants: 0, returns: 0, goalsAchieved: {},
      };
      this.counts = { adults: 0, children: 0, living: 0, away: 0 };
      this.winner = null; this.ended = false; this.endReason = null; this.pauseRequested = null;
      this.qualValue = {};
      for (const q of Object.keys(C.QUALS)) {
        // Expected pay a qualification unlocks = average of the jobs that require it.
        const sal = C.JOBS.filter(j => j.req && P.hasCred({ quals: [q] }, j.req)).map(j => j.salary);
        this.qualValue[q] = sal.length ? U.sum(sal) / sal.length : 3000;
      }
      this.goal = this.derived.goal;
      this.milestoneList = [...new Set([U.RM(1e5), U.RM(1e6), U.RM(1e7), this.goal])].filter(x => x <= this.goal).sort((a, b) => a - b);
      this.initFounders();
      for (const s of this.sys.init) s.init(this);
      F.updateRent(this);
      this.refreshLiving();
      LES.Market.monthly(this);
      this.snapshotMonth();
    }

    // Optional systems switched on by the settings (not saved: rebuilt from cfg on load).
    attachSystems() {
      Object.defineProperty(this, 'sys', { value: LES.Systems.active(this.cfg), enumerable: false, writable: true, configurable: true });
    }
    afterLoad() {
      this.attachSystems();
      if (this.gov && LES.Gov.upgrade) LES.Gov.upgrade(this); // saves from before the fiscal update
    }
    // Product of a multiplier hook over the active systems (1 when none are on).
    sysMul(hook, a, b) {
      const list = this.sys[hook];
      let m = 1;
      for (let i = 0; i < list.length; i++) m *= list[i][hook](this, a, b);
      return m;
    }

    macro() { return C.REGIMES[this.regime]; }
    // Year-1 RM -> today's sen (inflation-adjusted price).
    px(rm) { return Math.round(rm * 100 * this.price); }
    addPerson() { const p = P.blank(this.people.length); this.people.push(p); return p; }

    refreshLiving() {
      this.living = this.people.filter(p => p.alive && !p.away);
      let adults = 0;
      for (const p of this.living) if (p.adult) adults++;
      this.counts = { adults, children: this.living.length - adults, living: this.living.length, away: this.counts.away || 0 };
    }

    initFounders() {
      const R = this.rng.init, cfg = this.cfg, n = cfg.founders;
      const sexes = [];
      for (let i = 0; i < n; i++) sexes.push(i < n / 2 ? 'M' : 'F');
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [sexes[i], sexes[j]] = [sexes[j], sexes[i]]; }
      for (let i = 0; i < n; i++) this.makeAdult(R, { age: R.int(cfg.startAgeMin, cfg.startAgeMax), sex: sexes[i], jobChance: 0.65 });
      for (const p of this.people) {
        F.reviewTiers(this, p);
        p.mcost = F.monthlyCost(this, p);
      }
    }

    // A random adult drawn from the founder distributions (founders and newcomers).
    makeAdult(R, o) {
      const cfg = this.cfg, age = o.age;
      const lognormal = (median, sd) => Math.exp(R.normal(Math.log(median), sd));
      const p = this.addPerson();
      p.sex = o.sex || (R.next() < 0.5 ? 'M' : 'F');
      const mix = C.ETHNIC_MIXES[cfg.ethnicMix] || C.ETHNIC_MIXES.classic;
      p.eth = o.eth || mix.keys[R.weighted(mix.w)];
      p.first = R.pick(C.NAMES[p.eth][p.sex]);
      p.last = R.pick(C.NAMES[p.eth].last);
      p.birthDay = this.day - age * 365 - R.int(0, 364);
      p.adult = true;
      p.migrant = !!o.migrant;
      if (p.migrant) p.arrivedDay = this.day;
      p.look = P.makeLook(R, p.eth, p.sex);
      p.pot = [0, 1, 2, 3, 4, 5].map(() => U.clamp(R.normal(5, 1.8), 0.5, 10));
      p.att = p.pot.map(v => U.clamp(v + R.normal(0, 0.4) - 0.3, 0, 10));
      p.peak = p.att.slice();
      p.ageing = P.makeAgeing(R);
      for (const k of C.PERS) p.pers[k] = Math.round(U.clamp(R.normal(50, 18), 0, 100));
      p.famDesire = Math.round(U.clamp(R.normal(55, 20), 0, 100));
      p._ageHint = age;
      p.strategy = P.chooseStrategy(R, p);
      p.stratHist.push({ day: this.day, strategy: p.strategy, reason: p.migrant ? 'newcomer' : 'founder' });
      p.health = U.clamp(R.normal(85, 8), 50, 100);

      const intel = p.att[C.INT];
      const pDeg = U.clamp(0.1 + 0.08 * (intel - 5) + (age >= 22 ? 0.1 : 0), 0.02, 0.7);
      const r = R.next();
      if (age >= 22 && r < pDeg) {
        const q = intel >= 7 && R.next() < 0.15 ? 'MED' : ['BACH_GEN', 'BACH_BUS', 'BACH_ENG'][R.weighted([0.35, 0.35, intel >= 5.5 ? 0.3 : 0.08])];
        p.quals.push(q);
        if (age >= 25 && R.next() < 0.15) p.quals.push('MASTER');
      } else if (r < pDeg + 0.3) {
        p.quals.push('VOC');
      }

      let rm;
      if (cfg.wealthDist === 'equal') rm = 10000;
      else if (cfg.wealthDist === 'moderate') rm = lognormal(8000, 1.0);
      else rm = R.next() < 0.1 ? lognormal(300000, 1.2) : lognormal(3000, 1.0);
      const source = p.migrant ? 'ABROAD' : 'GENESIS';
      this.ledger.pay(source, p, 'cash', this.px(U.clamp(Math.round(rm), 0, 20000000)));

      if (R.next() < (o.jobChance || 0)) {
        const eligible = C.JOBS.filter(j => P.hasCred(p, j.req));
        const j = eligible[R.weighted(eligible.map(x => x.freq * (x.req ? 3 : 1)))];
        const salary = Math.round(this.px(j.salary * U.clamp(R.normal(1, 0.1), 0.75, 1.3)) / 1000) * 1000;
        const level = 1 + Math.min(2, Math.floor(Math.max(0, age - 20) / 6 * R.next() * 1.5));
        p.job = {
          jobId: j.id, title: j.title, salary: Math.round(salary * Math.pow(1.12, level - 1)), level, startDay: this.day - R.int(30, 1500),
          shiftsMonth: 0, lastShiftDay: -1, warnings: 0, place: R.pick(this.town.kinds[j.place]), perfOk: 0, perfN: 0, cat: j.cat,
        };
        p.xp[j.cat] = Math.min(5, Math.max(0, age - 18) * 0.25 * R.range(0.3, 1));
        this.ledger.pay(source, p, 'epf', Math.round(salary * 0.24 * 12 * Math.max(0, age - 20) * 0.5));
        p.incomeEMA = Math.round(p.job.salary * 0.89);
      } else {
        p.incomeEMA = this.px(800);
      }
      p.nw = P.netWorth(this, p);
      p.peakNw = p.nw;
      LES.Goals.pick(this, p, null);
      for (const s of this.sys.personCreated) s.personCreated(this, p, 'adult');
      if (!p.migrant) P.log(this, p, `Arrived in ${C.TOWN_NAME} aged ${age}${p.job ? ` working as ${p.job.title}` : ''} with ${U.fmtMoney(p.cash)}`, 'life', 0);
      return p;
    }

    // A child of two people, born now (ageYears = 0) or arriving already aged with migrant parents.
    makeChild(R, father, mother, ageYears) {
      const c = this.addPerson();
      c.sex = R.next() < 0.5 ? 'M' : 'F';
      c.eth = R.next() < 0.5 ? father.eth : mother.eth;
      c.first = R.pick(C.NAMES[c.eth][c.sex]);
      c.last = father.last;
      c.birthDay = this.day - ageYears * 365 - (ageYears > 0 ? R.int(0, 364) : 0);
      c.gen = Math.max(father.gen, mother.gen) + 1;
      c.parents = [father.id, mother.id];
      c.migrant = father.migrant && mother.migrant && father.arrivedDay === this.day;
      if (c.migrant) c.arrivedDay = this.day;
      c.look = P.makeLook(R, c.eth, c.sex);
      c.pot = Fa.inheritAttrs(this, mother, father);
      c.att = c.pot.map(v => U.clamp(v * (0.3 + 0.55 * Math.min(ageYears, 18) / 18), 0, 10));
      c.ageing = P.inheritAgeing(R, father.ageing || P.makeAgeing(R), mother.ageing || P.makeAgeing(R));
      for (const key of C.PERS) {
        c.pers[key] = Math.round(U.clamp(0.5 * (father.pers[key] + mother.pers[key]) / 2 + 0.5 * R.normal(50, 18), 0, 100));
      }
      c.famDesire = Math.round(U.clamp(0.4 * (father.famDesire + mother.famDesire) / 2 + 0.6 * R.normal(55, 20), 0, 100));
      c.health = 90; c.energy = 100; c.stress = 0;
      c.tiers = { food: 1, housing: 0, transport: 0, leisure: 0 };
      father.children.push(c.id); mother.children.push(c.id);
      if (c.migrant) { Fa.addCare(this, father, c); Fa.addCare(this, mother, c); }
      for (const s of this.sys.personCreated) s.personCreated(this, c, 'child');
      return c;
    }

    // ---------------- Daily tick (fixed stage order, FSD 4.1) ----------------
    step() {
      if (this.ended) return;
      this.date = U.dayToDate(this.day);
      this.refreshLiving();
      this.startOfDay();
      for (const p of this.living) if (p.alive && p.adult) F.dailyFood(this, p);
      Lb.dailyMarket(this);
      LES.Market.daily(this);
      for (const p of this.living) {
        if (!p.alive) continue;
        if (p.adult) {
          if (p.inst) { this.instDay(p); continue; } // in prison or rehab
          A.liveDay(this, p);
          if (this.date.dom === (p.id % 28) + 1) F.marketBehaviour(this, p);
        } else this.childDay(p);
      }
      Fa.daily(this);
      for (const s of this.sys.day) s.day(this);
      this.endOfDay();
      if (this.date.lastOfMonth) this.monthClose();
      if (this.date.lastOfYear) this.yearClose();
      this.refreshLiving();
      this.lastDay = this.day;
      this.day++;
      if (this.counts.living === 0) this.end('extinct');
      else if (this.day >= this.derived.horizonDays) this.end('horizon');
    }

    end(reason) {
      this.ended = true;
      this.endReason = reason;
      const text = reason === 'extinct' ? 'The population has died out. The simulation is over.' : `Reached the end of the ${this.cfg.horizonYears}-year horizon${this.winner ? '' : ' with no one reaching the goal'}.`;
      this.pushFeed({ day: this.day, pid: -1, text, cat: 'economy', imp: 3 });
    }

    pushFeed(e) {
      e.seq = ++this.feedSeq;
      this.feed.push(e);
      if (this.feed.length > 800) this.feed.splice(0, this.feed.length - 800);
    }

    startOfDay() {
      const R = this.rng.mortality;
      for (const p of this.living) {
        if (!p.alive) continue;
        const age = P.age(this, p);
        if (!p.adult && age >= this.cfg.adultAge) {
          p.adult = true;
          Fa.comeOfAge(this, p);
        }
        // Poor health raises mortality; long unhappiness a little too.
        const pYear = Math.min(0.95, mortalityYear(age, this.cfg.mortMult * (this.mortAdj || 1)) * (1 + Math.max(0, 60 - p.health) / 15) * (p.adult ? 1 + Math.max(0, 40 - p.happy) / 80 : 1));
        if (R.next() < 1 - Math.pow(1 - pYear, 1 / 365)) {
          this.die(p, age >= 60 ? 'old age' : age < 1 ? 'infant illness' : 'illness');
        }
      }
    }

    // A day inside an institution (prison, rehab): no choices, shown at that building.
    instDay(p) {
      const label = p.inst.kind === 'rehab' ? 'In drug rehabilitation' : p.inst.kind === 'remand' ? 'Held in the police lock-up' : 'Serving a prison sentence';
      p.plan = [{ act: 'PRISON', label, loc: p.inst.loc, sub: p.inst.kind }, { act: 'PRISON', label, loc: p.inst.loc, sub: p.inst.kind }];
      p.why = null;
      p.energy = Math.min(100, p.energy + 5); p.stress = Math.min(100, p.stress + 0.3);
    }

    childDay(c) {
      const age = P.age(this, c);
      const priv = c.school >= 0 && this.biz[c.school] && this.biz[c.school].open ? this.biz[c.school] : null; // private school pupil
      const school = priv ? priv.place : LES.townNear(this.town, 'school', c.homeId);
      c.plan = age >= 7
        ? [{ act: 'SCHOOL', label: priv ? `At ${priv.name}` : 'At school', loc: school }, { act: 'HOME', label: 'Playing at home', loc: c.homeId }]
        : [{ act: 'HOME', label: 'At home', loc: c.homeId }, { act: 'HOME', label: 'At home', loc: c.homeId }];
      c.why = null;
    }

    endOfDay() {
      for (const p of this.living) {
        if (!p.alive) continue;
        if (p.adult) {
          const tf = C.TIERS.food[p.tiers.food], th = C.TIERS.housing[p.tiers.housing];
          const tt = C.TIERS.transport[p.tiers.transport], tl = C.TIERS.leisure[p.tiers.leisure];
          const age = P.age(this, p);
          let wentOut = false;
          if (p.plan) for (const s of p.plan) if (s.act !== 'REST' && s.act !== 'CHILDCARE') { wentOut = true; break; }
          p.energy += 38 + (tf.energy || 0) + (th.energy || 0) + (wentOut ? (tt.energy || 0) : 0);
          p.stress += -2 + (tf.stress || 0) + (th.stress || 0) + (tt.stress || 0) + (tl.stress || 0);
          p.health += (tf.health || 0) + (p.health < 80 ? 0.03 : 0) - (p.stress > 75 ? 0.08 : 0)
            - (p.hunger > 50 ? 0.6 : 0) - 0.00015 * Math.pow(Math.max(0, age - 45), 1.5);
          const home = this.town.buildings[p.homeId];
          if (home && home.cap && (this.occupancy[p.homeId] || 0) > home.cap) p.stress += 0.4; // overcrowded home
          p.yr.stress += p.stress; p.yr.days++;
          LES.Goals.daily(this, p);
        } else {
          p.health += p.health < 90 ? 0.05 : 0;
        }
        A.clampNeeds(p);
        if (p.health <= 0) { this.die(p, p.hunger > 50 ? 'starvation' : 'poor health'); continue; }
        p.nw = P.netWorth(this, p);
        if (p.nw > p.peakNw) p.peakNw = p.nw;
        if (p.adult) this.checkMilestones(p);
      }
    }

    checkMilestones(p) {
      const gw = P.goalWorth(this, p);
      if (gw < this.milestoneList[0]) return; // most people, most days
      for (const th of this.milestoneList) {
        if (gw < th || p.milestones.includes(th)) continue;
        p.milestones.push(th);
        const age = Math.floor(P.age(this, p));
        if (th === this.goal) {
          if (!this.winner) {
            this.winner = { pid: p.id, day: this.day, age, nw: p.nw, real: P.realWorth(this, p) };
            P.log(this, p, `REACHED THE GOAL: ${U.fmtMoney(th)}${this.cfg.goalMode === 'real' ? ' (Year-1 money)' : ''} net worth at age ${age}! First in ${C.TOWN_NAME}.`, 'wealth', 3);
            if (this.cfg.stopOnWinner === 'yes') this.pauseRequested = 'goal';
          } else {
            P.log(this, p, `Also reached the ${U.fmtMoney(th)} goal at age ${age}`, 'wealth', 2);
          }
        } else {
          P.log(this, p, `Net worth passed ${U.fmtMoney(th)}${this.cfg.goalMode === 'real' ? ' in Year-1 money' : ''} at age ${age}`, 'wealth', th >= U.RM(1e7) ? 2 : 1);
        }
      }
    }

    monthClose() {
      this.price *= Math.pow(1 + this.infl, 1 / 12);
      F.updateRent(this);
      this.growTown();
      for (const b of this.biz) if (b.open) F.bizMonth(this, b);
      Lb.monthClose(this);
      for (const p of this.living) {
        if (!p.alive || !p.adult) continue;
        F.personMonth(this, p);
        F.luckMonth(this, p);
        this.strategyReview(p);
        LES.Goals.monthly(this, p);
        p.happyAvg = p.happyAvg * 0.9 + p.happy * 0.1;
        p.netMonth = 0;
      }
      Fa.monthCouples(this);
      LES.Migration.monthly(this);
      this.refreshLiving();
      for (const p of this.living) if (p.alive && !p.adult) Fa.childMonth(this, p);
      LES.Market.monthly(this);
      for (const s of this.sys.month) s.month(this);
      for (const p of this.people) {
        if (!p.alive) continue;
        if (!p.away) p.nw = P.netWorth(this, p);
        p.nwHist.push([this.day, p.nw]);
      }
      this.snapshotMonth();
    }

    strategyReview(p) {
      if (!p.pendingReview) return;
      const reason = p.pendingReview;
      p.pendingReview = null;
      if (this.cfg.strategyMode !== 'adaptive') return;
      const R = this.rng.luck;
      const pSwitch = U.clamp(0.55 - 0.4 * (p.pers.res - 50) / 50, 0.1, 0.95);
      if (R.next() < pSwitch) {
        const old = p.strategy;
        p._ageHint = P.age(this, p);
        p.strategy = P.chooseStrategy(R, p, old);
        p.stratHist.push({ day: this.day, strategy: p.strategy, reason });
        P.log(this, p, `After ${reason}, changed strategy: ${C.STRATEGY_NAMES[old]} -> ${C.STRATEGY_NAMES[p.strategy]}`, 'life', 1);
        // A big setback sometimes changes what they want from life, not just how.
        if (R.next() < 0.4) LES.Goals.pick(this, p, `rethinking life after ${reason}`, p.goal ? [p.goal.id] : []);
      } else {
        P.log(this, p, `Stayed with the ${C.STRATEGY_NAMES[p.strategy]} strategy despite ${reason}`, 'life', 0);
      }
    }

    yearClose() {
      F.macroYear(this);
      Lb.yearClose(this);
      for (const p of this.living) {
        if (!p.alive) continue;
        const age = P.age(this, p);
        if (!p.adult) {
          for (let i = 0; i < 6; i++) p.att[i] = U.clamp(p.pot[i] * (0.3 + 0.55 * Math.min(age, 18) / 18), 0, 10);
          continue;
        }
        this.ageAttributes(p, age);
        p.attHist.push([this.day, p.att.map(x => Math.round(x * 100) / 100)]);
      }
      for (const s of this.sys.year) s.year(this);
    }

    // Crowded town: an empty lot becomes a new estate (or shop row) for the most crowded need.
    growTown() {
      const t = this.town;
      if (!t.lots.some(id => !t.buildings[id].built)) return;
      const fill = tier => { let c = 0, o = 0; for (const id of t.homesByTier[tier]) { c += t.buildings[id].cap; o += this.occupancy[id] || 0; } return c ? o / c : 1; };
      const shopsFull = t.shoplots.every(id => this.shoplotOwner[id] !== undefined);
      const fills = [0, 1, 2, 3, 4].map(fill);
      let code = null;
      if (shopsFull && this.biz.filter(b => b.open && b.place === t.byKind.mall).length >= 2) code = 'S';
      else if (this.crowding > 0.85 || Math.max(...fills) > 1) {
        const worst = fills.indexOf(Math.max(...fills));
        code = ['K', 'F', 'T', 'C', 'B'][worst];
      }
      // A tycoon's company (real equity >= RM20M) builds its own headquarters tower.
      const tycoon = this.biz.find(b => b.open && !b.hq && b.equity / this.price >= U.RM(2e7));
      if (tycoon) {
        const owner = this.people[tycoon.founderId];
        const name = `Menara ${owner.last}`;
        const block = LES.growTown(t, 'X', name);
        if (block) {
          tycoon.hq = t.kinds.hq[t.kinds.hq.length - 1];
          t.buildings[tycoon.hq].bizId = tycoon.id;
          if (this.shoplotOwner[tycoon.place] === tycoon.id) delete this.shoplotOwner[tycoon.place];
          tycoon.place = tycoon.hq;
          this.townVersion++;
          this.pushFeed({ day: this.day, pid: tycoon.managerId >= 0 ? tycoon.managerId : -1, text: `${tycoon.name} opened its own headquarters: ${name}`, cat: 'biz', imp: 2 });
        }
        return;
      }
      if (!code) return;
      const block = LES.growTown(t, code);
      if (!block) return;
      this.townVersion++;
      this.townGrowth = (this.townGrowth || 0) + 1;
      const names = { K: 'kampung houses', F: 'PPR flats', T: 'a terrace estate', C: 'condominium towers', B: 'hillside bungalows', S: 'a new row of shoplots' };
      this.pushFeed({ day: this.day, pid: -1, text: `${C.TOWN_NAME} is growing: ${names[code]} built on empty land`, cat: 'economy', imp: 2 });
    }

    // Heritable ageing: after an onset age each attribute group loses a % of its
    // peak per year down to a personal floor. Lifestyle speeds or slows it.
    ageAttributes(p, age) {
      const g = p.ageing, yr = p.yr;
      if (!g) return;
      for (let i = 0; i < 6; i++) p.peak[i] = Math.max(p.peak[i], p.att[i]);
      const stressAvg = yr.days ? yr.stress / yr.days : 30;
      if (age > g.bOnset) {
        let f = 1;
        if (C.TIERS.leisure[p.tiers.leisure].fitness) f *= 0.6;
        if (p.tiers.food >= 2) f *= 0.85;
        if (stressAvg > 70) f *= 1.3;
        if (yr.phys >= 40) f *= 0.75;
        for (const a of C.BODY_ATTRS) {
          const floor = g.bFloor * p.peak[a];
          if (p.att[a] > floor) p.att[a] = Math.max(floor, p.att[a] - g.bRate * p.peak[a] * f);
        }
      }
      if (age > g.mOnset) {
        let f = 1;
        if (yr.mental >= 40) f *= 0.7;
        if (stressAvg > 70) f *= 1.2;
        for (const a of C.MIND_ATTRS) {
          const floor = g.mFloor * p.peak[a];
          if (p.att[a] > floor) p.att[a] = Math.max(floor, p.att[a] - g.mRate * p.peak[a] * f);
        }
      }
      p.yr = { phys: 0, mental: 0, stress: 0, days: 0 };
    }

    die(p, cause) {
      if (!p.alive) return;
      const age = Math.floor(P.age(this, p));
      p.alive = false;
      p.deathDay = this.day;
      p.causeOfDeath = cause;
      if (p.job) Lb.endJob(this, p, 'died', true);
      p.enrol = null; p.pregnancy = null; p.plan = null;
      if (p.inst) p.inst = null;
      if (p.partnerId !== null) {
        const q = this.people[p.partnerId];
        q.partnerId = null; p.partnerId = null;
        q.exPartners.push(p.id); p.exPartners.push(q.id);
        q.isHead = true;
        q.mcost = F.monthlyCost(this, q);
        P.log(this, q, `Lost partner ${P.name(p)} (${cause})`, 'family', 0);
      }
      for (const gid of p.caregivers) {
        const g = this.people[gid];
        g.careOf = g.careOf.filter(id => id !== p.id);
        if (g.alive) g.mcost = F.monthlyCost(this, g);
      }
      p.caregivers = [];
      const kids = p.careOf.slice();
      p.careOf = [];
      if (p.homeId >= 0) this.occupancy[p.homeId] = Math.max(0, (this.occupancy[p.homeId] || 0) - 1);
      this.stats.deaths++;
      P.log(this, p, `Died aged ${age} (${cause})`, 'death', p.adult || cause.includes('abandon') || cause.includes('neglect') ? 1 : 0);
      for (const s of this.sys.death) s.death(this, p, cause);
      Fa.settleEstate(this, p);
      p.nw = 0;
      p.nwHist.push([this.day, 0]);
      for (const cid of kids) {
        const c = this.people[cid];
        c.caregivers = c.caregivers.filter(id => id !== p.id);
        if (c.alive && !c.away && !c.caregivers.length && c.guardian !== 'WELFARE') Fa.findGuardian(this, c, 'orphan');
      }
    }

    snapshotMonth() {
      const adults = this.living.filter(p => p.alive && p.adult);
      // Wealth statistics are stored in Year-1 money so charts compare across inflation.
      const nws = adults.map(p => p.nw / this.price).sort((a, b) => a - b);
      this.medianReal = Math.max(1, U.quantile(nws, 0.5));
      let employed = 0, students = 0, retired = 0, owners = 0, unemployed = 0;
      for (const p of adults) {
        if (p.job) employed++;
        if (p.enrol) students++;
        if (p.retired) retired++;
        if (p.manages >= 0) owners++;
        if (!p.job && !p.enrol && !p.retired && p.manages < 0 && !p.inst && P.age(this, p) < 64) unemployed++; // people in prison or rehab are outside the labour force (as in the DOSM survey)
      }
      const stratMedian = {};
      for (const s of C.STRATEGIES) {
        const v = adults.filter(p => p.strategy === s && P.age(this, p) >= 30).map(p => p.nw / this.price);
        stratMedian[s] = v.length ? U.median(v) : null;
      }
      this.history.push({
        day: this.day, pop: this.living.filter(p => p.alive).length, adults: adults.length,
        children: this.living.filter(p => p.alive && !p.adult).length,
        employed, students, retired, owners, unemployed,
        businesses: this.biz.filter(b => b.open).length,
        median: U.quantile(nws, 0.5), p90: U.quantile(nws, 0.9), top: nws.length ? nws[nws.length - 1] : 0,
        millionaires: nws.filter(x => x >= U.RM(1e6)).length, gini: U.gini(nws),
        happy: adults.length ? U.median(adults.map(p => p.happy)) : 0,
        goalsDone: adults.reduce((s, p) => s + p.goalsDone.length, 0),
        regime: this.regime, idx: this.mkt.idx, alpha: this.mkt.alpha, price: this.price, infl: this.infl,
        crowding: this.crowding, pressure: this.townMood.pressure, opportunity: this.townMood.opportunity,
        away: this.counts.away || 0, migrants: adults.filter(p => p.migrant).length, stratMedian,
      });
      const row = this.history[this.history.length - 1];
      for (const s of this.sys.snapshot) s.snapshot(this, row);
    }

    // ---------------- Verification ----------------
    checkInvariants() {
      const errs = [];
      let total = this.ledger.sectorTotal();
      for (const p of this.people) {
        total += p.cash + p.trust + p.epf;
        for (const k of ['cash', 'trust', 'epf']) if (!Number.isInteger(p[k]) || p[k] < 0) errs.push(`P${p.id} ${k}=${p[k]}`);
        if (!p.alive && (p.cash || p.trust || p.epf || p.inv.idx || Object.keys(p.inv.st).length)) errs.push(`dead P${p.id} still holds money`);
        if (!p.alive && (p.job || p.enrol || p.manages >= 0 || p.careOf.length || p.partnerId !== null)) errs.push(`dead P${p.id} still active`);
        if (p.away && (p.cash || p.trust || p.epf || p.job || p.manages >= 0 || Object.keys(p.shares).length || p.homeId >= 0)) errs.push(`away P${p.id} still holds town assets`);
        for (const k of ['health', 'energy', 'stress', 'hunger']) if (!(p[k] >= 0 && p[k] <= 100)) errs.push(`P${p.id} ${k}=${p[k]}`);
        for (let i = 0; i < 6; i++) if (!(p.att[i] >= 0 && p.att[i] <= 10)) errs.push(`P${p.id} att${i}=${p.att[i]}`);
        if (p.parents.length !== 0 && p.parents.length !== 2) errs.push(`P${p.id} has ${p.parents.length} parents`);
        for (const pid of p.parents) {
          const q = this.people[pid];
          if (!(q.birthDay < p.birthDay)) errs.push(`P${p.id} parent ${pid} not older`);
          if (!q.children.includes(p.id)) errs.push(`P${p.id} missing child link from ${pid}`);
        }
        if (p.job && p.job.shiftsMonth > this.date.dom) errs.push(`P${p.id} more shifts than days`);
        if (!Number.isFinite(p.nw)) errs.push(`P${p.id} net worth not finite`);
        if (p.partnerId !== null) {
          const q = this.people[p.partnerId];
          if (q.partnerId !== p.id || !q.alive || !p.alive || !!q.away !== !!p.away) errs.push(`P${p.id} broken partner link`);
        }
        for (const k of Object.keys(p.shares)) {
          const b = this.biz[Number(k)];
          if (!b.open || Math.abs((b.shares[p.id] || 0) - p.shares[k]) > 1e-9) errs.push(`P${p.id} share mismatch biz ${k}`);
        }
      }
      for (const s of this.sys.money) total += s.money(this);
      for (const b of this.biz) {
        total += b.cash;
        if (!Number.isInteger(b.cash) || b.cash < 0) errs.push(`Biz${b.id} cash=${b.cash}`);
        if (b.open) {
          const s = Object.values(b.shares).reduce((a, x) => a + x, 0);
          if (Math.abs(s - 1) > 1e-6) errs.push(`Biz${b.id} shares sum ${s}`);
          for (const k of Object.keys(b.shares)) if (!this.people[Number(k)].alive) errs.push(`Biz${b.id} dead shareholder`);
          if (!Number.isFinite(b.scale) || !Number.isFinite(b.equity)) errs.push(`Biz${b.id} non-finite values`);
        } else if (b.cash !== 0) errs.push(`closed Biz${b.id} holds cash`);
      }
      if (total !== 0) errs.push(`Ledger imbalance: ${total} sen`);
      for (const e of this.estates) {
        const dist = U.sum(e.amounts);
        if (e.heirs.length && dist !== e.total) errs.push(`Estate of P${e.decedent}: ${dist} != ${e.total}`);
      }
      if (!Number.isFinite(this.mkt.idx) || this.mkt.stocks.some(st => !Number.isFinite(st.price)) || !Number.isFinite(this.price)) errs.push('market/prices not finite');
      for (const s of this.sys.invariants) s.invariants(this, errs);
      return errs;
    }

    // Fingerprint that is identical across JavaScript engines (Node vs Chrome may differ in
    // the last digits of a few floats, which hash() includes): counts, integer money, rounded needs.
    stableHash() {
      let cash = 0, epf = 0, sal = 0, logs = 0, soft = 0, partners = 0;
      for (const p of this.people) {
        cash += p.cash + p.trust; epf += p.epf; logs += p.log.length;
        if (p.job) sal += p.job.salary;
        if (p.partnerId !== null) partners++;
        if (p.alive && !p.away) soft += p.happy + p.stress + p.energy + p.health;
      }
      const parts = [this.day, this.people.length, logs, cash, epf, sal, partners, this.biz.length, soft.toFixed(1), this.feed.length ? this.feed[this.feed.length - 1].text : ''];
      return LES.hashString(parts.join('|')).map(x => x.toString(16).padStart(8, '0')).join('');
    }

    hash() {
      const parts = [this.day, this.regime, this.mkt.idx.toFixed(6), this.price.toFixed(9), ...this.mkt.stocks.map(st => Math.round(st.price))];
      for (const p of this.people) {
        parts.push(p.id, p.alive ? 1 : 0, p.cash, p.epf, p.trust, Math.round(p.inv.idx * 1e4), JSON.stringify(p.inv.st), p.away ? 1 : 0,
          p.att.map(a => Math.round(a * 1e4)).join(','), p.job ? p.job.jobId + p.job.salary : '-', p.partnerId, p.strategy);
      }
      for (const b of this.biz) parts.push(b.cash, Math.round(b.scale), b.open ? 1 : 0);
      for (const s of this.sys.hash) s.hash(this, parts);
      return LES.hashString(parts.join('|')).map(x => x.toString(16).padStart(8, '0')).join('');
    }
  }

  LES.World = World;
})(globalThis.LES = globalThis.LES || {});
