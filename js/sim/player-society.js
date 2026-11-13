// Play a Life, adults (PL-10): your own business, the lottery, giving, volunteering and standing for election.
// - START_BIZ: any business type the engine would let this person start (Finance.bestBizType's gates: the
//   credential, 40% of the capital in savings or investments, room in town); Finance.startBusiness does the rest
//   (own money, a bank loan for up to 60%, setup costs, a place in town). Market demand, wages and insolvency are
//   the engine's. A job is kept unless the person is an entrepreneur at heart or asks to quit.
// - INJECT: put your own cash into your business (a ledger transfer). SELL_BIZ (Finance.sellBiz: 70% of its
//   value) and CLOSE_BIZ (Finance.closeBiz: equipment sold, the bank repaid, the rest shared out).
// - BUY_TICKET: a fictional national lottery (design 06, section 5): one ticket a month, adults only, price
//   0.001 x typical monthly pay; prizes 2x (15%), 10x (2%) or 10,000x the ticket (0.001%), so 60% comes back
//   on average (a 40% expected loss, shown on the card). Tickets go to and prizes come from the outside world
//   (the ledger's LUCK sector, as the engine's own windfalls). It can be hidden (w.player.noLottery).
// - DONATE: to the welfare home's fund (a ledger transfer to WELFARE; it counts as the person's giving).
// - VOLUNTEER: a day at the welfare home: each child there gets a little more care (upbringing); with no
//   children there, help at the community hall (your own wellbeing only).
// - STAND: put your name forward at the next election (the engine's own campaign and voters decide).
// - WELCOME: show a newcomer around (a real recent arrival feels more at home).
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, F = LES.Finance, Pl = LES.Player;
  const st = w => w.player;
  const M = w => Pl.typicalPay(w);
  const myBiz = (w, p) => (p.manages >= 0 && w.biz[p.manages] && w.biz[p.manages].open ? w.biz[p.manages] : null);
  // Business types this person could start now (the engine's own gates), cheapest first.
  Pl.bizTypes = function (w, p) {
    const avail = p.cash + P.invValue(w, p) * 0.9 - p.mcost * 2, out = [];
    for (const t of (w.bizTypes || C.BIZ)) {
      if (t.req && !P.hasCred(p, t.req)) continue;
      if (t.maxPer && !LES.Services.canStart(w, t)) continue;
      out.push({ id: t.id, name: t.name, capital: w.px(t.capital), skill: F.bizSkill(p, t), ok: avail >= w.px(t.capital) * 0.4 });
    }
    return out.sort((a, b) => a.capital - b.capital);
  };
  Pl.ticket = w => Math.max(w.px(1), Math.round(0.001 * M(w)));
  Pl.LOTTO = [[0.00001, 10000], [0.02, 10], [0.15, 2]]; // chance, prize as tickets
  const electing = w => !!(w.gov && LES.Gov && !LES.Gov.appointed());

  Object.assign(Pl.HANDLERS, {
    START_BIZ: {
      hours: 8, cooldown: 120, adult: true, key: () => 'startbiz',
      check(w, p, a) {
        if (myBiz(w, p)) return 'have_biz';
        if (p.bankruptUntil > w.day) return 'bankrupt';
        const t = Pl.bizTypes(w, p).find(x => x.id === a.type);
        return !t ? 'not_possible' : !t.ok ? 'cant_afford' : null;
      },
      params(w, p, a) { const t = (w.bizTypes || C.BIZ).find(x => x.id === a.type); return { type: t ? t.name : a.type }; },
      run(w, p, a) {
        const t = (w.bizTypes || C.BIZ).find(x => x.id === a.type), n = w.biz.length;
        p.lastBizTry = w.day; p.energy -= 10; st(w).played = true;
        F.startBusiness(w, p, { type: t, skill: F.bizSkill(p, t) }, { mc: p.mcost, risk: a.quit ? 1 : -1 });
        if (w.biz.length === n || p.manages !== n) return { code: 'no_capital', params: { type: t.name } };
        const b = w.biz[n];
        return { code: 'ok', params: { type: t.name, biz: b.name, debt: U.fmtMoney(b.debt) } };
      },
    },
    INJECT: {
      hours: 1, cooldown: 30, adult: true, key: () => 'inject',
      check(w, p, a) { return !myBiz(w, p) ? 'no_biz' : !(a.share > 0 && a.share <= 1) ? 'bad_args' : Math.round((p.cash - 2 * p.mcost) * a.share) < w.px(100) ? 'too_little' : null; },
      run(w, p, a) {
        const b = myBiz(w, p), amt = Math.round((p.cash - 2 * p.mcost) * a.share);
        w.ledger.move(p, 'cash', b, 'cash', amt); F.valueBiz(b); st(w).played = true;
        P.log(w, p, `Put ${U.fmtMoney(amt)} of their own money into ${b.name}`, 'biz', 0);
        return { code: 'ok', params: { biz: b.name, amt: U.fmtMoney(amt) } };
      },
    },
    SELL_BIZ: {
      hours: 6, cooldown: 30, adult: true, key: () => 'sellbiz',
      check(w, p) { const b = myBiz(w, p); return !b ? 'no_biz' : b.equity <= 0 ? 'worthless' : null; },
      run(w, p) { const b = myBiz(w, p), cash = p.cash; F.sellBiz(w, b, 'the owner sold it'); st(w).played = true; return { code: 'ok', params: { biz: b.name, amt: U.fmtMoney(Math.max(0, p.cash - cash)) } }; },
    },
    CLOSE_BIZ: {
      hours: 6, cooldown: 30, adult: true, key: () => 'closebiz',
      check(w, p) { return myBiz(w, p) ? null : 'no_biz'; },
      run(w, p) { const b = myBiz(w, p); F.closeBiz(w, b, 'was closed by its owner', false); st(w).played = true; return { code: 'ok', params: { biz: b.name } }; },
    },
    BUY_TICKET: {
      hours: 0, cooldown: 30, adult: true, key: () => 'ticket',
      check(w, p) { return st(w).noLottery ? 'hidden' : p.cash < Pl.ticket(w) + p.mcost ? 'cant_afford' : null; },
      run(w, p) {
        const s = st(w), price = Pl.ticket(w), R = Pl.rng(w), L = s.lotto = s.lotto || { tickets: 0, spent: 0, won: 0 };
        w.ledger.spend(p, 'cash', 'LUCK', price);
        L.tickets++; L.spent += price; s.played = true;
        let r = R.next(), mult = 0;
        for (const [ch, m] of Pl.LOTTO) { if (r < ch) { mult = m; break; } r -= ch; }
        if (!mult) return { code: 'lost', params: { price: U.fmtMoney(price) } };
        const prize = price * mult;
        w.ledger.pay('LUCK', p, 'cash', prize); L.won += prize;
        P.log(w, p, `Won ${U.fmtMoney(prize)} in the lottery`, 'money', mult >= 10000 ? 2 : 0);
        if (mult >= 10000) w.pushFeed({ day: w.day, pid: p.id, text: `${P.name(p)} won the lottery jackpot: ${U.fmtMoney(prize)}!`, cat: 'money', imp: 2 });
        return { code: mult >= 10000 ? 'jackpot' : 'won', params: { price: U.fmtMoney(price), prize: U.fmtMoney(prize) } };
      },
    },
    DONATE: {
      hours: 1, cooldown: 7, adult: true, key: () => 'donate',
      check(w, p, a) { const amt = donation(w, p, a); return !(amt > 0) ? 'bad_args' : p.cash - amt < p.mcost ? 'cant_afford' : null; },
      run(w, p, a) {
        const amt = donation(w, p, a);
        w.ledger.spend(p, 'cash', 'WELFARE', amt); p.donated += amt; p.happy = Math.min(100, p.happy + 2); st(w).played = true;
        P.log(w, p, `Donated ${U.fmtMoney(amt)} to the welfare home`, 'money', 0);
        return { code: 'ok', params: { amt: U.fmtMoney(amt) } };
      },
    },
    VOLUNTEER: {
      hours: 6, cooldown: 7, adult: true, key: () => 'volunteer',
      check(w, p) { return p.energy < 15 ? 'tired' : null; },
      run(w, p) {
        const kids = w.living.filter(c => c.alive && c.guardian === 'WELFARE');
        for (const c of kids) c.upbringing = Math.min(1, c.upbringing + 0.004);
        p.energy -= 12; p.happy = Math.min(100, p.happy + 3); p.stress = Math.max(0, p.stress - 2);
        const s = st(w); s.volunteered = (s.volunteered || 0) + 1; s.played = true;
        return { code: kids.length ? 'ok' : 'ok_hall', params: { count: kids.length } };
      },
    },
    STAND: {
      hours: 2, cooldown: 30, adult: true, minAge: 21, key: () => 'stand',
      check(w, p) { return !electing(w) ? 'no_elections' : p.cr && p.cr.rec ? 'record' : w.gov.president === p.id ? 'in_office' : st(w).stand ? 'already' : null; },
      run(w, p) { st(w).stand = true; st(w).played = true; return { code: 'ok', params: { date: U.fmtDate(w.gov.electionDay) } }; },
    },
    WELCOME: {
      hours: 4, cooldown: 14, adult: true, key: a => `welcome:${a.pid}`,
      check(w, p, a) { const q = w.people[a.pid]; return !q || !q.alive || q.away || !q.migrant || q === p ? 'not_possible' : p.energy < 10 ? 'tired' : null; },
      params(w, p, a) { const q = w.people[a.pid]; return { other: q ? P.name(q) : '' }; },
      run(w, p, a) {
        const q = w.people[a.pid];
        q.happy = Math.min(100, q.happy + 4); q.stress = Math.max(0, q.stress - 4); q.friends++; p.friends++; p.energy -= 6; st(w).played = true;
        return { code: 'ok', params: { other: P.name(q) } };
      },
    },
  });
  function donation(w, p, a) { return a.amt > 0 ? Math.round(a.amt) : a.share > 0 && a.share <= 0.5 ? Math.round(Math.max(0, p.cash - 2 * p.mcost) * a.share) : 0; }

  // The player's name goes forward at the next campaign (Government: pickCandidates).
  Pl.standing = function (w, out) {
    const s = w.player, p = Pl.person(w);
    if (!s || !s.stand || !p) return out;
    s.stand = false;
    if (!p.alive || p.away || p.inst || !p.adult || P.age(w, p) < 21 || (p.cr && p.cr.rec) || out.includes(p)) return out;
    if (out.length >= 4) out.pop();
    out.push(p); s.ran = w.day;
    Pl.journal(w, { kind: 'life', key: 'civic.standing', params: { date: U.fmtDate(w.gov.electionDay) }, imp: 2 });
    return out;
  };

  Pl.MONTHLY.push(function (w, p) {
    const s = st(w);
    if (p && p.alive) s.noJobSince = p.job || p.enrol || myBiz(w, p) ? null : (s.noJobSince >= 0 ? s.noJobSince : w.day);
    if (!s.ran || !w.gov || w.gov.campaign) return;
    const res = (w.gov.elections || []).find(r => r.day >= s.ran && r.cands.some(c => c.id === s.id));
    if (res) {
      const me = res.cands.find(c => c.id === s.id), win = res.winner === s.id;
      Pl.journal(w, { kind: 'result', key: win ? 'civic.won' : 'civic.lost', params: { votes: me.votes, winner: res.cands.find(c => c.id === res.winner).name }, imp: 2 });
    }
    s.ran = null;
  });

  // ---- Adult events: business, money, community ----
  const pick = (w, list) => (list.length ? list[(w.day / 30 | 0) % list.length] : null);
  const viable = (w, p) => { const ts = Pl.bizTypes(w, p).filter(t => t.ok); return ts.length ? ts.reduce((a, b) => (b.skill > a.skill ? b : a)) : null; };
  const cheapest = (w, p) => Pl.bizTypes(w, p).find(t => t.ok) || null;
  const newcomer = (w, p) => pick(w, w.living.filter(q => q.alive && !q.away && q.migrant && P.isAdult(w, q) && q.arrivedDay !== null && q.arrivedDay > w.day - 60));
  Object.assign(Pl.CONDITIONS, {
    bizIdea: (w, p) => !myBiz(w, p) && P.age(w, p) >= 22 && P.age(w, p) <= 55 && p.bankruptUntil <= w.day && !!viable(w, p),
    bizShort: (w, p) => { const b = myBiz(w, p); return !!b && b.cash < Math.max(w.px(2000), (b.lastRevenue || 0) * 0.25) && p.cash > 3 * p.mcost; },
    lottery: (w, p) => !st(w).noLottery && p.cash > p.mcost * 2,
    election: (w, p) => electing(w) && !w.gov.campaign && w.gov.electionDay - w.day > 20 && w.gov.electionDay - w.day < 200 && w.gov.president !== p.id && !(p.cr && p.cr.rec) && P.age(w, p) >= 25,
    festival: (w, p) => U.dayToDate(w.day).month === 7,
    volunteers: (w, p) => w.living.some(c => c.alive && c.guardian === 'WELFARE'),
    longUnemployed: (w, p) => !p.job && !p.enrol && !myBiz(w, p) && !p.retired && P.age(w, p) >= 30 && st(w).noJobSince >= 0 && w.day - st(w).noJobSince >= 180,
    newcomer: (w, p) => !!newcomer(w, p),
  });
  Object.assign(Pl.PARAMS, {
    biz: (w, p) => { const t = viable(w, p); return { type: t ? t.name : '', capital: t ? U.fmtMoney(t.capital) : '' }; },
    myBiz: (w, p) => { const b = myBiz(w, p); return { biz: b ? b.name : '', cash: b ? U.fmtMoney(b.cash) : '' }; },
    lottery: w => ({ price: U.fmtMoney(Pl.ticket(w)), jackpot: U.fmtMoney(Pl.ticket(w) * 10000) }),
    election: w => ({ date: U.fmtDate(w.gov.electionDay), title: LES.Gov.title(w) }),
    welfare: w => ({ count: w.living.filter(c => c.alive && c.guardian === 'WELFARE').length }),
    unemployed: (w, p) => { const t = cheapest(w, p); return { type: t ? t.name : '' }; },
    newcomer: (w, p) => { const q = newcomer(w, p); return { other: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
  });
  Object.assign(Pl.TARGETS, {
    bizBest: (w, p) => { const t = viable(w, p); return t ? { type: t.id } : null; },
    bizCheap: (w, p) => { const t = cheapest(w, p); return t ? { type: t.id } : null; },
    inject25: (w, p) => (myBiz(w, p) ? { share: 0.25 } : null),
    closeBiz: (w, p) => (myBiz(w, p) ? {} : null),
    ticket: () => ({}),
    donateTicket: w => ({ amt: Pl.ticket(w) }),
    donateSmall: (w, p) => ({ amt: Math.max(w.px(20), Math.round(0.02 * M(w))) }),
    stand: () => ({}), volunteer: () => ({}),
    newcomerInCard: (w, p, item) => (item && item.params && item.params.pid >= 0 ? { pid: item.params.pid } : null),
  });
  const ev = (id, when, choices, o) => Object.assign({ id, stages: ['adult'], minAge: 18, maxAge: 59, when, chance: 0.3, cooldown: 360, expires: 20, imp: 1, choices }, o || {});
  const story = id => ({ id, story: true }), cmd = (id, kind, target) => ({ id, cmd: kind, target });
  Pl.EVENTS.push(
    ev('AD-011', 'bizIdea', [cmd('start', 'START_BIZ', 'bizBest'), story('partner'), story('stay')], { params: 'biz', chance: 0.15, cooldown: 720, minAge: 22, maxAge: 55 }),
    ev('AD-014', 'bizShort', [story('cut'), cmd('inject', 'INJECT', 'inject25'), cmd('close', 'CLOSE_BIZ', 'closeBiz')], { params: 'myBiz', chance: 0.6, cooldown: 180, imp: 2 }),
    ev('AD-024', 'lottery', [cmd('buy', 'BUY_TICKET', 'ticket'), story('keep'), cmd('donate', 'DONATE', 'donateTicket')], { params: 'lottery', chance: 0.12, cooldown: 360, maxAge: 99, stages: ['adult', 'senior'] }),
    ev('AD-072', 'election', [cmd('stand', 'STAND', 'stand'), story('campaign'), story('informed')], { params: 'election', minAge: 25, maxAge: 75, stages: ['adult', 'senior'], chance: 0.5, cooldown: 600, imp: 2 }),
    ev('AD-077', 'festival', [cmd('sponsor', 'DONATE', 'donateSmall'), cmd('volunteer', 'VOLUNTEER', 'volunteer'), story('attend')], { params: null, chance: 0.5, cooldown: 330, maxAge: 99, stages: ['adult', 'senior'] }),
    ev('AD-079', 'volunteers', [cmd('help', 'VOLUNTEER', 'volunteer'), cmd('donate', 'DONATE', 'donateSmall'), story('concern')], { params: 'welfare', chance: 0.15, cooldown: 540, maxAge: 99, stages: ['adult', 'senior'] }),
    ev('AD-080', 'newcomer', [cmd('orient', 'WELCOME', 'newcomerInCard'), cmd('exchange', 'WELCOME', 'newcomerInCard'), story('privacy')], { params: 'newcomer', chance: 0.25, cooldown: 300, maxAge: 99, stages: ['adult', 'senior'] }),
    ev('AD-091', 'longUnemployed', [cmd('retrain', 'ENROLL', 'bestCourse'), cmd('apply', 'APPLY_JOB', 'typicalPay'), cmd('service', 'START_BIZ', 'bizCheap')], { params: 'unemployed', minAge: 30, chance: 0.4, cooldown: 360, imp: 2 }),
  );
})(globalThis.LES = globalThis.LES || {});
