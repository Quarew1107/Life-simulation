// Society: social class and religion (settings: society on/off). Plugs in through
// LES.Systems, so with it off the engine is exactly the original.
//
// Class is calculated, never assigned: every month households are ranked by gross
// income (head + partner), as DOSM does: B40 (bottom 40%), M40, T20 (top 20%). On top
// of that: "T1 elite" (the richest 1% by net worth, at least RM1M) and "Hardship"
// (household income under RM1,500 Year-1 money and less than a month of costs saved).
// Children carry their household's class at 12 (their origin); at 35 their own class is
// recorded, which gives the intergenerational mobility table.
//
// Religion works through practices, never through a success bonus. Each practice has a
// cost and a benefit, scaled by personal religiosity (0-100, half inherited):
// - weekly worship (Friday prayers, Sunday service, temple visits): less stress, more
//   happiness, meeting the congregation (friends, partners); costs a slot and a donation
// - zakat (2.5% of savings above the nisab, yearly) and other donations feed each
//   community's fund, which helps that community's members in hardship
// - Ramadan fasting (tired days, then Hari Raya), festival spending
// - devout Muslims avoid bars and non-Shariah-compliant shares
// - religiosity raises the wish for children and lowers break-ups
// - interfaith couples: under the Malaysian rule a non-Muslim converts to marry a Muslim
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P;
  const S = LES.Society = {};

  // ---- Reference data (filled from the country pack's `society`, see the end of this file) ----
  // S.RELIGIONS: place = building where they worship; day = weekday (0 Mon .. 6 Sun), -1 = a personal weekly day.
  S.RELIGIONS = {};
  S.REL_KEYS = [];
  S.REL_BY_ETH = {}; // religion by ethnicity
  // Class ids are the engine's (bottom 40%, middle 40%, top 20% of households); names come from the pack.
  S.CLASSES = ['B40', 'M40', 'T20'];
  S.CLASS_NAMES = {};
  S.CLASS_SHORT = {}; // 'B40' etc. as the country says it
  S.short = c => S.CLASS_SHORT[c] || c;
  S.CLASS_COLOURS = { B40: '#f4a261', M40: '#5aa9e6', T20: '#f2c14e' };
  // National household-income cut-offs (gross, per month), hardship line and zakat threshold.
  S.DOSM_B40_MAX = 0; S.DOSM_T20_MIN = 0; S.HARDSHIP_RM = 0; S.NISAB_RM = 0;
  let NON_SHARIAH = new Set(), CEL = {}, LAW_REL = null;
  // Festivals each group celebrates (spending, joy) - by religion or by ethnicity.
  const CELEBRATES = (p, f) => { const c = CEL[f]; return !!c && (c.rel ? p.rel === c.rel : p.eth === c.eth); };

  const pick = (R, table) => { const ks = Object.keys(table); return ks[Math.max(0, R.weighted(ks.map(k => table[k])))]; };
  const relOf = p => S.RELIGIONS[p.rel] || S.RELIGIONS.none;
  const devout = p => (p.relig || 0) / 100;

  // ---- Religion of a new person ----
  function assignReligion(w, p, how) {
    const R = w.rng.society;
    if (how === 'child' && p.parents.length === 2) {
      const [f, m] = p.parents.map(id => w.people[id]);
      if (f.rel === m.rel) p.rel = f.rel;
      else if (w.cfg.interfaith === 'national' && LAW_REL && (f.rel === LAW_REL || m.rel === LAW_REL)) p.rel = LAW_REL;
      else p.rel = R.next() < 0.5 ? f.rel : m.rel;
      p.relig = Math.round(U.clamp(0.5 * ((f.relig || 0) + (m.relig || 0)) / 2 + 0.5 * R.normal(relOf(p).mean, 20), 0, 100));
    } else {
      p.rel = pick(R, S.REL_BY_ETH[p.eth] || S.REL_BY_ETH.other);
      p.relig = Math.round(U.clamp(R.normal(relOf(p).mean, 20), 0, 100));
    }
    if (p.rel === 'none') p.relig = Math.min(p.relig, 20);
    p.famDesire = Math.round(U.clamp(p.famDesire + 0.15 * (p.relig - 50), 0, 100));
    // Some Muslim women of any background wear the tudung.
    if (p.rel === 'islam' && p.sex === 'F' && p.eth !== 'malay' && p.look && R.next() < 0.5) p.look.style = 3;
    p.worshipN = 0; p.aidRecv = 0; p.zakatPaid = 0;
  }

  // ---- Class (monthly) ----
  function classMonth(w) {
    const heads = [];
    for (const p of w.living) {
      if (!p.alive || !p.adult || !p.isHead) continue;
      const q = p.partnerId !== null ? w.people[p.partnerId] : null;
      heads.push({ p, q, inc: Math.max(0, p.incomeEMA) + (q ? Math.max(0, q.incomeEMA) : 0) });
    }
    const st = w.society;
    if (!heads.length) return;
    const sorted = heads.map(h => h.inc).sort((a, b) => a - b);
    const c40 = U.quantile(sorted, 0.4), c80 = U.quantile(sorted, 0.8);
    const adults = w.living.filter(p => p.alive && p.adult).sort((a, b) => b.nw - a.nw);
    const eliteN = Math.max(1, Math.floor(adults.length * 0.01));
    for (let i = 0; i < adults.length; i++) adults[i].elite = i < eliteN && adults[i].nw >= w.px(1e6);
    let total = 0, top = 0, below = 0, above = 0;
    const B = w.px(S.DOSM_B40_MAX), Tt = w.px(S.DOSM_T20_MIN);
    for (const h of heads) {
      const cls = h.inc < c40 ? 'B40' : h.inc < c80 ? 'M40' : 'T20';
      const hard = h.inc < w.px(S.HARDSHIP_RM) && h.p.cash < h.p.mcost;
      total += h.inc; if (cls === 'T20') top += h.inc;
      if (h.inc < B) below++; if (h.inc >= Tt) above++;
      const members = [h.p];
      if (h.q) members.push(h.q);
      for (const cid of h.p.careOf) members.push(w.people[cid]);
      if (h.q) for (const cid of h.q.careOf) if (!h.p.careOf.includes(cid)) members.push(w.people[cid]);
      for (const m of members) { if (!m.alive) continue; m.cls = cls; m.hardship = hard; }
    }
    for (const p of w.living) { // origin class at 12, own class at 35
      if (!p.alive || !p.cls) continue;
      const age = P.age(w, p);
      if (!p.clsOrigin && !p.adult && age >= 12) p.clsOrigin = p.cls;
      if (p.clsOrigin && !p.cls35 && age >= 35) p.cls35 = p.cls;
    }
    st.cut40 = c40 / w.price; st.cut80 = c80 / w.price;
    st.t20share = total > 0 ? top / total : 0;
    st.belowB40 = below / heads.length; st.aboveT20 = above / heads.length;
    st.households = heads.length;
  }

  // ---- Religious practice ----
  function worshipPlace(w, p) {
    const def = relOf(p);
    if (!def.place) return -1;
    const t = w.town;
    if (t.kinds[def.place] && t.kinds[def.place].length) return LES.townNear(t, def.place, p.homeId);
    return t.kinds.hall && t.kinds.hall.length ? LES.townNear(t, 'hall', p.homeId) : -1; // grid towns: the community hall
  }

  function donate(w, p, amt, why) {
    if (!(amt > 0) || !p.rel || p.rel === 'none') return 0;
    amt = Math.min(Math.round(amt), Math.max(0, p.cash - Math.round(p.mcost * 0.5)));
    if (amt <= 0) return 0;
    const fund = w.society.funds[p.rel];
    if (!w.ledger.move(p, 'cash', fund, 'bal', amt)) return 0;
    fund.inTotal += amt;
    p.donated += amt;
    if (why === 'zakat') { p.zakatPaid += amt; w.society.zakatTotal += amt; }
    return amt;
  }

  // Each fund helps its own members in hardship, then pays a little upkeep.
  function fundsMonth(w) {
    const st = w.society;
    for (const k of S.REL_KEYS) {
      const fund = st.funds[k];
      if (!fund || fund.bal <= 0) continue;
      // The poor and needy (fakir, miskin): hardship, or B40 with under two months of costs saved.
      const needy = w.living.filter(p => p.alive && p.adult && p.rel === k && (p.hardship || (p.cls === 'B40' && p.cash < 2 * p.mcost)));
      if (needy.length) {
        const each = Math.min(Math.floor(fund.bal * 0.6 / needy.length), w.px(600));
        if (each > 0) for (const p of needy) {
          if (!w.ledger.move(fund, 'bal', p, 'cash', each)) break;
          fund.outTotal += each; p.aidRecv += each; p.earned.welfare += each; st.aidTotal += each;
          if (each >= w.px(200)) P.log(w, p, `Received ${U.fmtMoney(each)} from the ${S.RELIGIONS[k].fund}`, 'money', 0);
        }
      }
      const upkeep = Math.floor(fund.bal * 0.01);
      if (upkeep > 0) w.ledger.move(fund, 'bal', w.ledger.sec.MERCHANT, 'bal', upkeep);
    }
  }

  const sys = {
    id: 'society', order: 10,
    enabled: cfg => cfg.society === 'on',

    init(w) {
      const funds = {};
      for (const k of S.REL_KEYS) if (k !== 'none') funds[k] = { bal: 0, inTotal: 0, outTotal: 0 };
      w.society = { funds, zakatTotal: 0, aidTotal: 0, festivalSpend: 0, worshipMonth: {}, cut40: 0, cut80: 0, t20share: 0, belowB40: 0, aboveT20: 0, households: 0, conversions: 0, interfaith: 0 };
      classMonth(w);
    },

    personCreated(w, p, how) {
      if (!w.society && how !== 'child') { /* founders: world.init runs after */ }
      assignReligion(w, p, how);
    },

    // People mostly marry within their own faith and community (language, family
    // expectations); in Malaysia only a small share of marriages are inter-ethnic.
    coupleWeight(w, a, b) {
      let m = 1;
      if (a.rel !== b.rel) m *= 0.04 + 0.2 * (1 - (devout(a) + devout(b)) / 2);
      if (a.eth !== b.eth) m *= 0.35;
      return m;
    },
    coupled(w, a, b) {
      if (a.rel === b.rel) return;
      w.society.interfaith++;
      if (w.cfg.interfaith !== 'national' || !LAW_REL) return;
      const muslim = a.rel === LAW_REL ? a : b.rel === LAW_REL ? b : null;
      if (!muslim) return;
      const other = muslim === a ? b : a, from = S.RELIGIONS[other.rel].name;
      other.rel = LAW_REL;
      other.relig = Math.round(U.clamp(other.relig * 0.5 + 25, 0, 100));
      w.society.conversions++;
      P.log(w, other, `Converted from ${from} to ${S.RELIGIONS[LAW_REL].name} to marry ${P.name(muslim)}`, 'family', 1);
    },
    breakupWeight: (w, a, b) => 1 - 0.4 * (devout(a) + devout(b)) / 2,
    venueBias(w, p, k) {
      if (k !== 'karaoke') return 0; // the bar
      return p.rel === 'islam' ? -0.4 - 0.8 * devout(p) : -0.4 * Math.max(0, devout(p) - 0.6);
    },
    stockOk: (w, p, tk) => !(p.rel === 'islam' && p.relig >= 60 && NON_SHARIAH.has(tk)),
    money(w) { let s = 0; for (const k in w.society.funds) s += w.society.funds[k].bal; return s; },

    candidates(w, p, ctx, slot, add) {
      const def = relOf(p);
      if (!def.place || p.relig < 5 || ctx.injured || p.energy < 12) return;
      const dow = U.dow(w.day);
      const today = def.day >= 0 ? dow === def.day : (w.day + p.id) % 7 === 0;
      const fest = LES.Calendar.festival(w.day), feast = fest && fest.id === def.festival;
      if ((!today && !feast) || slot !== def.slot) return;
      const loc = worshipPlace(w, p);
      if (loc < 0) return;
      const r = devout(p);
      let u = -0.7 + 2.8 * r + 0.6 * U.clamp((p.stress - 45) / 55, 0, 1) + (ctx.age > 50 ? 0.3 : 0) + (feast ? 1 : 0);
      if (p.rel === 'islam' && def.day === dow) u += p.sex === 'M' ? 0.9 : -0.8; // Friday prayers are for men
      add(0, 'WORSHIP', u, loc, p.rel);
    },
    label: (id, data) => (id === 'WORSHIP' ? (S.RELIGIONS[data] && S.RELIGIONS[data].worship) || 'Worship' : undefined),
    resolve(w, p, c, ctx, slot) {
      if (c.id !== 'WORSHIP') return false;
      const r = devout(p);
      p.stress -= 5 + 7 * r; p.energy -= 4;
      p.happy = Math.min(100, p.happy + 0.4 + 0.6 * r);
      p.worshipN++;
      w.society.worshipMonth[p.rel] = (w.society.worshipMonth[p.rel] || 0) + 1;
      donate(w, p, w.px(2 + 10 * r) * (p.incomeEMA > w.px(4000) ? 2 : 1), 'collection');
      const key = c.loc * 2 + slot, pool = w.socialPools.get(key); // the congregation meets (friends, partners)
      if (pool) pool.push(p.id); else w.socialPools.set(key, [p.id]);
      return true;
    },

    day(w) {
      const ram = LES.Calendar.ramadan(w.day), fest = LES.Calendar.festivalStarts(w.day);
      if (!ram && !fest) return;
      for (const p of w.living) {
        if (!p.alive || !p.adult) continue;
        if (ram && p.rel === 'islam') { // fasting from dawn to dusk
          const r = devout(p);
          p.energy = Math.max(0, p.energy - 3 - 3 * r); p.stress = Math.min(100, p.stress + 0.2);
          p.happy = Math.min(100, p.happy + 0.04 * r);
        }
        if (fest && CELEBRATES(p, fest.id) && p.isHead) { // festival spending: clothes, food, ang pow / duit raya
          const want = Math.round(Math.max(0, p.incomeEMA) * 0.3 + w.px(150));
          const amt = Math.min(want, Math.max(0, p.cash - p.mcost));
          if (amt > 0) { w.ledger.spend(p, 'cash', 'MERCHANT', amt); w.society.festivalSpend += amt; }
          p.stress = Math.max(0, p.stress - 8); p.happy = Math.min(100, p.happy + 4);
          if (amt >= w.px(500)) P.log(w, p, `Spent ${U.fmtMoney(amt)} celebrating ${fest.name}`, 'money', 0);
        }
      }
    },

    month(w) {
      classMonth(w);
      // Monthly donations by non-Muslims (tithes, temple giving), scaled by devotion.
      const RATE = { christianity: 0.05, buddhism: 0.015, hinduism: 0.015, other: 0.01 };
      for (const p of w.living) {
        if (!p.alive || !p.adult || !RATE[p.rel] || p.incomeEMA <= 0 || p.cash < p.mcost * 1.5) continue;
        donate(w, p, p.incomeEMA * RATE[p.rel] * Math.pow(devout(p), 1.5), 'donation');
      }
      fundsMonth(w);
      w.society.lastWorship = w.society.worshipMonth; w.society.worshipMonth = {};
      for (const p of w.living) if (p.alive) p.worshipN = 0;
    },

    year(w) {
      const R = w.rng.society;
      for (const p of w.living) {
        if (!p.alive || !p.adult) continue;
        if (p.rel === 'islam') { // zakat: 2.5% of savings held above the nisab for a year
          const wealth = p.cash + P.invValue(w, p), nisab = w.px(S.NISAB_RM);
          if (wealth > nisab && R.next() < 0.35 + 0.6 * devout(p)) {
            const z = donate(w, p, Math.round(wealth * 0.025), 'zakat');
            const reb = LES.Fiscal && w.gov ? LES.Fiscal.zakatRebate(w, p, z) : 0; // zakat is rebated against income tax
            if (z >= w.px(1000)) P.log(w, p, `Paid ${U.fmtMoney(z)} zakat${reb > 0 ? ` (${U.fmtMoney(reb)} rebated against income tax)` : ''}`, 'money', 0);
          }
        }
        // Devotion drifts a little with age and practice; a few drift away from religion.
        const age = P.age(w, p);
        p.relig = Math.round(U.clamp(p.relig + R.normal(0, 3) + (age > 50 ? 0.6 : 0) - (age < 30 ? 0.3 : 0), 0, 100));
        const canLeave = p.rel !== LAW_REL || w.cfg.interfaith === 'free';
        if (canLeave && p.rel !== 'none' && p.relig < 12 && R.next() < 0.03) {
          P.log(w, p, `Stopped practising ${S.RELIGIONS[p.rel].name}`, 'life', 0);
          p.rel = 'none'; w.society.conversions++;
        }
      }
    },

    snapshot(w, row) {
      const st = w.society, rel = {}, eth = {};
      for (const k of S.REL_KEYS) rel[k] = 0;
      for (const p of w.living) { if (!p.alive) continue; rel[p.rel || 'none']++; eth[p.eth] = (eth[p.eth] || 0) + 1; }
      let funds = 0;
      for (const k in st.funds) funds += st.funds[k].bal;
      row.soc = {
        cut40: st.cut40, cut80: st.cut80, t20share: st.t20share, belowB40: st.belowB40, aboveT20: st.aboveT20,
        rel, eth, funds: funds / w.price, aid: st.aidTotal / w.price, zakat: st.zakatTotal / w.price,
        worship: Object.values(st.lastWorship || {}).reduce((a, b) => a + b, 0),
      };
    },

    invariants(w, errs) {
      for (const k in w.society.funds) { const b = w.society.funds[k].bal; if (!Number.isInteger(b) || b < 0) errs.push(`fund ${k} balance ${b}`); }
      for (const p of w.people) {
        if (!S.RELIGIONS[p.rel]) errs.push(`P${p.id} religion ${p.rel}`);
        if (!(p.relig >= 0 && p.relig <= 100)) errs.push(`P${p.id} religiosity ${p.relig}`);
        if (p.alive && p.adult && !p.away && w.day > 31 && !S.CLASSES.includes(p.cls)) errs.push(`P${p.id} has no class`);
      }
    },
    hash(w, parts) {
      for (const p of w.people) parts.push(p.rel, p.relig, p.cls || '-');
      for (const k in w.society.funds) parts.push(w.society.funds[k].bal);
    },
  };
  LES.Systems.register(sys);
  LES.Actions.ICONS.WORSHIP = '🛐';
  LES.Actions.LABELS.WORSHIP = 'Worship';

  // ---- Summaries for the Society tab and the report ----
  // Intergenerational mobility: origin class (household at 12) -> own class at 35.
  S.mobility = function (w) {
    const m = {};
    for (const a of S.CLASSES) { m[a] = {}; for (const b of S.CLASSES) m[a][b] = 0; }
    let n = 0;
    for (const p of w.people) if (p.clsOrigin && p.cls35) { m[p.clsOrigin][p.cls35]++; n++; }
    return { m, n };
  };
  // Medians by group (ethnicity or religion) for living adults.
  S.groupStats = function (w, key) {
    const g = {};
    for (const p of w.living) {
      if (!p.alive || !p.adult) continue;
      const k = p[key] || 'none';
      (g[k] = g[k] || { n: 0, nw: [], inc: [], b40: 0, t20: 0, uni: 0 }).n++;
      g[k].nw.push(p.nw / w.price); g[k].inc.push(p.incomeEMA / w.price);
      if (p.cls === 'B40') g[k].b40++; if (p.cls === 'T20') g[k].t20++;
      if (p.quals.some(P.isBachelor)) g[k].uni++;
    }
    for (const k in g) { g[k].medNw = U.median(g[k].nw); g[k].medInc = U.median(g[k].inc); delete g[k].nw; delete g[k].inc; }
    return g;
  };
  // The active country's faiths, class names, cut-offs and interfaith rule.
  LES.Countries.require('society.religions', 'society.relByEth', 'society.classNames', 'society.bottom40Max', 'society.top20Min', 'society.hardship', 'society.nisab');
  LES.Countries.on('society', pack => {
    const so = pack.society, put = (o, src) => { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, src); };
    put(S.RELIGIONS, so.religions);
    S.REL_KEYS.length = 0; S.REL_KEYS.push(...Object.keys(so.religions));
    put(S.REL_BY_ETH, so.relByEth);
    put(S.CLASS_NAMES, so.classNames);
    put(S.CLASS_SHORT, so.classShort || {});
    S.DOSM_B40_MAX = so.bottom40Max; S.DOSM_T20_MIN = so.top20Min; S.HARDSHIP_RM = so.hardship; S.NISAB_RM = so.nisab;
    NON_SHARIAH = new Set(so.nonShariah || []);
    CEL = so.celebrates || {};
    LAW_REL = so.lawReligion || null;
  });
})(globalThis.LES = globalThis.LES || {});
