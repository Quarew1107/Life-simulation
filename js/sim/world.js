// The world: founders, the daily ordered tick, month/year close, deaths,
// milestones, statistics, invariant checks and a state hash for reproducibility.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, A = LES.Actions, F = LES.Finance, Fa = LES.Family, Lb = LES.Labour;

  const mortalityYear = age => age < 1 ? 0.004 : age < 18 ? 0.0003 : 0.0004 + 0.000015 * Math.exp(0.1 * age);

  class World {
    constructor(cfgIn) {
      this.cfg = Object.assign({}, LES.DEFAULTS, cfgIn || {});
      const v = LES.validateConfig(this.cfg);
      if (v.blockers.length) throw new Error('Invalid settings: ' + v.blockers.join(' '));
      this.derived = LES.derive(this.cfg);
      this.rng = {};
      for (const k of ['init', 'decide', 'outcome', 'jobs', 'market', 'biz', 'family', 'luck', 'mortality']) {
        this.rng[k] = new LES.RNG(`${this.cfg.seed}|${k}`);
      }
      this.town = LES.buildTown();
      this.day = 0;
      this.lastDay = -1;
      this.date = U.dayToDate(0);
      this.people = []; this.living = []; this.biz = []; this.vacancies = []; this.nextVacId = 0;
      this.ledger = new LES.Ledger();
      this.market = { idx: 100, spd: 100 };
      this.regime = 'normal';
      this.regimeHist = [{ day: 0, regime: 'normal' }];
      this.feed = []; this.feedSeq = 0; this.estates = []; this.history = []; this.socialPools = [[], []];
      this.occupancy = {}; this.shoplotOwner = {};
      this.stats = {
        births: 0, deaths: 0, twins: 0, hires: 0, fired: 0, laidOff: 0, promotions: 0, graduations: 0, dropouts: 0,
        scholarships: 0, bizStarted: 0, bizClosed: 0, bizFailed: 0, booms: 0, bankruptcies: 0, couples: 0, breakups: 0,
        catastrophes: 0, illnesses: 0, scams: 0, windfalls: 0, welfareKids: 0, vacOpened: 0, vacUnfilled: 0,
      };
      this.counts = { adults: 0, children: 0, living: 0 };
      this.winner = null; this.ended = false; this.endReason = null; this.pauseRequested = null;
      this.qualValue = {};
      for (const q of Object.keys(C.QUALS)) {
        let best = 0;
        for (const j of C.JOBS) if (j.req && P.hasCred({ quals: [q] }, j.req)) best = Math.max(best, j.salary);
        this.qualValue[q] = best || 3000;
      }
      this.goal = this.derived.goal;
      this.milestoneList = [...new Set([U.RM(1e5), U.RM(1e6), U.RM(1e7), this.goal])].filter(x => x <= this.goal).sort((a, b) => a - b);
      this.initFounders();
      this.refreshLiving();
      this.snapshotMonth();
    }

    macro() { return C.REGIMES[this.regime]; }
    addPerson() { const p = P.blank(this.people.length); this.people.push(p); return p; }

    refreshLiving() {
      this.living = this.people.filter(p => p.alive);
      let adults = 0;
      for (const p of this.living) if (p.adult) adults++;
      this.counts = { adults, children: this.living.length - adults, living: this.living.length };
    }

    initFounders() {
      const R = this.rng.init, cfg = this.cfg, n = cfg.founders;
      const sexes = [];
      for (let i = 0; i < n; i++) sexes.push(i < n / 2 ? 'M' : 'F');
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [sexes[i], sexes[j]] = [sexes[j], sexes[i]]; }
      const lognormal = (median, sd) => Math.exp(R.normal(Math.log(median), sd));

      for (let i = 0; i < n; i++) {
        const p = this.addPerson();
        p.sex = sexes[i];
        p.eth = C.ETHNICITIES[R.weighted(C.ETHNIC_WEIGHTS)];
        p.first = R.pick(C.NAMES[p.eth][p.sex]);
        p.last = R.pick(C.NAMES[p.eth].last);
        const age = R.int(cfg.startAgeMin, cfg.startAgeMax);
        p.birthDay = -age * 365 - R.int(0, 364);
        p.adult = true;
        p.look = P.makeLook(R, p.eth, p.sex);
        p.pot = [0, 1, 2, 3, 4, 5].map(() => U.clamp(R.normal(5, 1.8), 0.5, 10));
        p.att = p.pot.map(v => U.clamp(v + R.normal(0, 0.4) - 0.3, 0, 10));
        for (const k of C.PERS) p.pers[k] = Math.round(U.clamp(R.normal(50, 18), 0, 100));
        p.famDesire = Math.round(U.clamp(R.normal(55, 20), 0, 100));
        p._ageHint = age;
        p.strategy = P.chooseStrategy(R, p);
        p.stratHist.push({ day: 0, strategy: p.strategy, reason: 'founder' });
        p.health = U.clamp(R.normal(85, 8), 50, 100);

        // Background qualifications
        const intel = p.att[C.INT];
        const pDeg = U.clamp(0.1 + 0.08 * (intel - 5) + (age >= 22 ? 0.1 : 0), 0.02, 0.7);
        const r = R.next();
        if (age >= 22 && r < pDeg) {
          let q;
          if (intel >= 7 && R.next() < 0.15) q = 'MED';
          else q = ['BACH_GEN', 'BACH_BUS', 'BACH_ENG'][R.weighted([0.35, 0.35, intel >= 5.5 ? 0.3 : 0.08])];
          p.quals.push(q);
          if (age >= 25 && R.next() < 0.15) p.quals.push('MASTER');
        } else if (r < pDeg + 0.3) {
          p.quals.push('VOC');
        }

        // Starting wealth
        let rm;
        if (cfg.wealthDist === 'equal') rm = 10000;
        else if (cfg.wealthDist === 'moderate') rm = lognormal(8000, 1.0);
        else rm = R.next() < 0.1 ? lognormal(300000, 1.2) : lognormal(3000, 1.0);
        this.ledger.pay('GENESIS', p, 'cash', U.RM(U.clamp(Math.round(rm), 0, 20000000)));

        // Founders may already have a job
        if (R.next() < 0.65) {
          const eligible = C.JOBS.filter(j => P.hasCred(p, j.req));
          const j = eligible[R.weighted(eligible.map(x => x.freq * (x.req ? 3 : 1)))];
          const salary = U.RM(Math.round(j.salary * U.clamp(R.normal(1, 0.1), 0.75, 1.3) / 10) * 10);
          const level = 1 + Math.min(2, Math.floor(Math.max(0, age - 20) / 6 * R.next() * 1.5));
          p.job = {
            jobId: j.id, title: j.title, salary: Math.round(salary * Math.pow(1.12, level - 1)), level, startDay: -R.int(30, 1500),
            shiftsMonth: 0, lastShiftDay: -1, warnings: 0, place: this.town.byKind[j.place], perfOk: 0, perfN: 0, cat: j.cat,
          };
          p.xp[j.cat] = Math.min(5, Math.max(0, age - 18) * 0.25 * R.range(0.3, 1));
          this.ledger.pay('GENESIS', p, 'epf', Math.round(salary * 0.24 * 12 * Math.max(0, age - 20) * 0.5));
          p.incomeEMA = Math.round(p.job.salary * 0.89);
        } else {
          p.incomeEMA = U.RM(800);
        }
        p.nw = P.netWorth(this, p);
        p.peakNw = p.nw;
        P.log(this, p, `Arrived in ${C.TOWN_NAME} aged ${age}${p.job ? ` working as ${p.job.title}` : ''} with ${U.fmtMoney(p.cash)}`, 'life', 0);
      }
      for (const p of this.people) {
        F.reviewTiers(this, p);
        p.mcost = F.monthlyCost(this, p);
      }
    }

    // ---------------- Daily tick (fixed stage order, FSD 4.1) ----------------
    step() {
      if (this.ended) return;
      this.date = U.dayToDate(this.day);
      this.refreshLiving();
      this.startOfDay();
      for (const p of this.living) if (p.alive && p.adult) F.dailyFood(this, p);
      Lb.dailyMarket(this);
      for (const p of this.living) {
        if (!p.alive) continue;
        if (p.adult) A.liveDay(this, p);
        else this.childDay(p);
      }
      Fa.daily(this);
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
        const pYear = Math.min(0.95, mortalityYear(age) * (1 + Math.max(0, 60 - p.health) / 15));
        if (R.next() < 1 - Math.pow(1 - pYear, 1 / 365)) {
          this.die(p, age >= 60 ? 'old age' : age < 1 ? 'infant illness' : 'illness');
        }
      }
    }

    childDay(c) {
      const age = P.age(this, c);
      const school = this.town.byKind.school;
      c.plan = age >= 7
        ? [{ act: 'SCHOOL', label: 'At school', loc: school }, { act: 'HOME', label: 'Playing at home', loc: c.homeId }]
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
          const wentOut = p.plan && p.plan.some(s => s.act !== 'REST' && s.act !== 'CHILDCARE');
          p.energy += 38 + (tf.energy || 0) + (th.energy || 0) + (wentOut ? (tt.energy || 0) : 0);
          p.stress += -2 + (tf.stress || 0) + (th.stress || 0) + (tt.stress || 0) + (tl.stress || 0);
          p.health += (tf.health || 0) + (p.health < 80 ? 0.03 : 0) - (p.stress > 75 ? 0.08 : 0)
            - (p.hunger > 50 ? 0.6 : 0) - 0.00015 * Math.pow(Math.max(0, age - 45), 1.5);
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
      for (const th of this.milestoneList) {
        if (p.nw < th || p.milestones.includes(th)) continue;
        p.milestones.push(th);
        const age = Math.floor(P.age(this, p));
        if (th === this.goal) {
          if (!this.winner) {
            this.winner = { pid: p.id, day: this.day, age, nw: p.nw };
            P.log(this, p, `REACHED THE GOAL: ${U.fmtMoney(th)} net worth at age ${age}! First in ${C.TOWN_NAME}.`, 'wealth', 3);
            if (this.cfg.stopOnWinner === 'yes') this.pauseRequested = 'goal';
          } else {
            P.log(this, p, `Also reached the ${U.fmtMoney(th)} goal at age ${age}`, 'wealth', 2);
          }
        } else {
          P.log(this, p, `Net worth passed ${U.fmtMoney(th)} at age ${age}`, 'wealth', th >= U.RM(1e7) ? 2 : 1);
        }
      }
    }

    monthClose() {
      F.marketMonth(this);
      for (const b of this.biz) if (b.open) F.bizMonth(this, b);
      Lb.monthClose(this);
      for (const p of this.living) {
        if (!p.alive || !p.adult) continue;
        F.personMonth(this, p);
        F.luckMonth(this, p);
        this.strategyReview(p);
      }
      Fa.monthCouples(this);
      for (const p of this.living) if (p.alive && !p.adult) Fa.childMonth(this, p);
      for (const p of this.living) {
        if (!p.alive) continue;
        p.nw = P.netWorth(this, p);
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
        const fit = C.TIERS.leisure[p.tiers.leisure].fitness ? 0.4 : 1;
        if (age > 40) for (const a of [C.STR, C.AGI, C.END]) p.att[a] = Math.max(0, p.att[a] - 0.03 * fit * (age > 60 ? 2 : 1));
        if (age > 60) for (const a of [C.INT, C.PER]) p.att[a] = Math.max(0, p.att[a] - 0.02);
        p.attHist.push([this.day, p.att.map(x => Math.round(x * 100) / 100)]);
      }
    }

    die(p, cause) {
      if (!p.alive) return;
      const age = Math.floor(P.age(this, p));
      p.alive = false;
      p.deathDay = this.day;
      p.causeOfDeath = cause;
      if (p.job) Lb.endJob(this, p, 'died', true);
      p.enrol = null; p.pregnancy = null; p.plan = null;
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
      Fa.settleEstate(this, p);
      p.nw = 0;
      p.nwHist.push([this.day, 0]);
      for (const cid of kids) {
        const c = this.people[cid];
        c.caregivers = c.caregivers.filter(id => id !== p.id);
        if (c.alive && !c.caregivers.length && c.guardian !== 'WELFARE') Fa.findGuardian(this, c, 'orphan');
      }
    }

    snapshotMonth() {
      const adults = this.living.filter(p => p.alive && p.adult);
      const nws = adults.map(p => p.nw).sort((a, b) => a - b);
      let employed = 0, students = 0, retired = 0, owners = 0, unemployed = 0;
      for (const p of adults) {
        if (p.job) employed++;
        if (p.enrol) students++;
        if (p.retired) retired++;
        if (p.manages >= 0) owners++;
        if (!p.job && !p.enrol && !p.retired && p.manages < 0 && P.age(this, p) < 64) unemployed++;
      }
      const stratMedian = {};
      for (const s of C.STRATEGIES) {
        const v = adults.filter(p => p.strategy === s && P.age(this, p) >= 30).map(p => p.nw);
        stratMedian[s] = v.length ? U.median(v) : null;
      }
      this.history.push({
        day: this.day, pop: this.living.filter(p => p.alive).length, adults: adults.length,
        children: this.living.filter(p => p.alive && !p.adult).length,
        employed, students, retired, owners, unemployed,
        businesses: this.biz.filter(b => b.open).length,
        median: U.quantile(nws, 0.5), p90: U.quantile(nws, 0.9), top: nws.length ? nws[nws.length - 1] : 0,
        millionaires: nws.filter(x => x >= U.RM(1e6)).length, gini: U.gini(nws),
        regime: this.regime, idx: this.market.idx, stratMedian,
      });
    }

    // ---------------- Verification ----------------
    checkInvariants() {
      const errs = [];
      let total = this.ledger.sectorTotal();
      for (const p of this.people) {
        total += p.cash + p.trust + p.epf;
        for (const k of ['cash', 'trust', 'epf']) if (!Number.isInteger(p[k]) || p[k] < 0) errs.push(`P${p.id} ${k}=${p[k]}`);
        if (!p.alive && (p.cash || p.trust || p.epf || p.inv.idx || p.inv.spd)) errs.push(`dead P${p.id} still holds money`);
        if (!p.alive && (p.job || p.enrol || p.manages >= 0 || p.careOf.length || p.partnerId !== null)) errs.push(`dead P${p.id} still active`);
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
          if (q.partnerId !== p.id || !q.alive || !p.alive) errs.push(`P${p.id} broken partner link`);
        }
        for (const k of Object.keys(p.shares)) {
          const b = this.biz[Number(k)];
          if (!b.open || Math.abs((b.shares[p.id] || 0) - p.shares[k]) > 1e-9) errs.push(`P${p.id} share mismatch biz ${k}`);
        }
      }
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
      if (!Number.isFinite(this.market.idx) || !Number.isFinite(this.market.spd)) errs.push('market not finite');
      return errs;
    }

    hash() {
      const parts = [this.day, this.regime, this.market.idx.toFixed(6), this.market.spd.toFixed(6)];
      for (const p of this.people) {
        parts.push(p.id, p.alive ? 1 : 0, p.cash, p.epf, p.trust, Math.round(p.inv.idx * 1e4), Math.round(p.inv.spd * 1e4),
          p.att.map(a => Math.round(a * 1e4)).join(','), p.job ? p.job.jobId + p.job.salary : '-', p.partnerId, p.strategy);
      }
      for (const b of this.biz) parts.push(b.cash, Math.round(b.scale), b.open ? 1 : 0);
      return LES.hashString(parts.join('|')).map(x => x.toString(16).padStart(8, '0')).join('');
    }
  }

  LES.World = World;
})(globalThis.LES = globalThis.LES || {});
