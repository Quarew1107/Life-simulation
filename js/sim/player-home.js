// Play a Life, home buying step 4 (Nov 2026): the played character's home (js/sim/housing.js does the rules).
// - BUY_HOME { tier? }: buy a home of the kind you rent (or `tier`), if the bank agrees (Housing.quote: steady job,
//   deposit and taxes in reachable savings, repayments within the country's share of income). BUY_SMALLER: one level
//   down. SELL_HOME: sell and rent where you are. PAY_EXTRA { share }: pay that share of your spare savings (above
//   three months' costs) off the loan; the repayment is worked out again for the rest of the term.
// - ASK_DEPOSIT { pid? }: a parent with savings to spare may give what is missing of a deposit (their choice: their
//   responsibility, how close you are, how much they have; your own dice, so nobody else's luck changes).
// - BUY_LET { tier }: a second home to let (Housing.letQuote); SELL_LET { i }: sell one.
// - Moment situations (Player.CONDITIONS / PARAMS): homeRenting, homeNearDeposit, homeParentsCould, homeNewOwner,
//   homeOwner, homeBehind, homeRateUp, homeBoom, homeSlump, homeLandlord, homeTenant, homeInherited, homeOwnerSenior.
// The town still runs the character's home by its own rules when you do nothing (as for every resident).
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, Pl = LES.Player;
  const H = () => LES.Housing, st = w => w.player;
  const on = w => !!H() && H().on(w);
  const tierName = (w, t) => (C.TIERS.housing[t] ? H().name(w, t) : ''); // (the lowest level has its own name when owned)
  const spare = (w, p) => Math.max(0, p.cash - 3 * Math.max(p.mcost, w.px(500)));
  const parentsWithSpare = (w, p) => p.parents.map(id => w.people[id]).filter(g => g && g.alive && !g.away && !g.inst)
    .map(g => ({ g, spare: Math.max(0, LES.Finance.liquid(w, g) - 6 * Math.max(g.mcost, w.px(500))) })).filter(x => x.spare > 0).sort((a, b) => (b.spare - a.spare) || (a.g.id - b.g.id));
  const quoteParams = (w, p, q, t) => ({ home: tierName(w, t), price: U.fmtMoney(q.price), deposit: U.fmtMoney(q.deposit), loan: U.fmtMoney(q.loan), monthly: U.fmtMoney(q.monthly), years: Math.round(q.years), tax: U.fmtMoney(q.tax || 0) });
  const buyHandler = down => ({
    hours: 4, cooldown: 30, adult: true, key: () => 'buyhome',
    check(w, p, a) {
      if (!on(w)) return 'off';
      const t = down ? p.tiers.housing - 1 : a.tier !== undefined ? Number(a.tier) : p.tiers.housing;
      if (!(t >= 0 && t < C.TIERS.housing.length)) return down ? 'smallest' : 'bad_args';
      const q = H().quote(w, p, t);
      return q.ok ? null : q.why;
    },
    params(w, p, a) { const t = down ? p.tiers.housing - 1 : a.tier !== undefined ? Number(a.tier) : p.tiers.housing; return t >= 0 && on(w) ? quoteParams(w, p, H().quote(w, p, t), t) : {}; },
    run(w, p, a) {
      const t = down ? p.tiers.housing - 1 : a.tier !== undefined ? Number(a.tier) : p.tiers.housing, q = H().buy(w, p, t);
      st(w).played = true;
      return q.ok ? { code: 'ok', params: quoteParams(w, p, q, t) } : { code: q.why, params: quoteParams(w, p, q, t) };
    },
  });
  Object.assign(Pl.HANDLERS, {
    BUY_HOME: buyHandler(false),
    BUY_SMALLER: buyHandler(true),
    SELL_HOME: {
      hours: 3, cooldown: 30, adult: true, key: () => 'sellhome',
      check(w, p) { return !on(w) ? 'off' : !p.own ? 'no_home' : null; },
      params(w, p) { return p.own ? { home: tierName(w, p.own.tier), price: U.fmtMoney(H().value(w, p)), loan: U.fmtMoney(p.debt.mortgage || 0) } : {}; },
      run(w, p) {
        const home = tierName(w, p.own.tier), price = H().value(w, p), left = H().sell(w, p, 'chosen');
        st(w).played = true;
        return { code: 'ok', params: { home, price: U.fmtMoney(price), left: U.fmtMoney(left) } };
      },
    },
    PAY_EXTRA: {
      hours: 1, cooldown: 30, adult: true, key: () => 'payextra',
      check(w, p, a) { return !on(w) ? 'off' : !p.own || !(p.debt.mortgage > 0) || !p.mort ? 'no_loan' : !(a.share > 0 && a.share <= 1) ? 'bad_args' : spare(w, p) < w.px(100) ? 'no_spare' : null; },
      params(w, p, a) { return { amt: U.fmtMoney(Math.min(p.debt.mortgage || 0, Math.round(spare(w, p) * (a.share || 0)))), loan: U.fmtMoney(p.debt.mortgage || 0) }; },
      run(w, p, a) {
        const amt = Math.min(p.debt.mortgage, Math.round(spare(w, p) * a.share));
        w.ledger.spend(p, 'cash', 'BANK', amt);
        p.debt.mortgage -= amt;
        const left = Math.max(1, (p.mort.end - w.day) / 365);
        if (p.debt.mortgage <= 0) { p.debt.mortgage = 0; p.mort = null; P.log(w, p, 'Paid off the home loan', 'money', 1); }
        else p.mort.monthly = H().payment(p.debt.mortgage, p.mort.rate, left);
        p.mcost = LES.Finance.monthlyCost(w, p);
        st(w).played = true;
        return { code: p.mort ? 'ok' : 'ok_done', params: { amt: U.fmtMoney(amt), loan: U.fmtMoney(p.debt.mortgage), monthly: U.fmtMoney(p.mort ? p.mort.monthly : 0) } };
      },
    },
    ASK_DEPOSIT: {
      hours: 2, cooldown: 60, adult: true, key: () => 'askdeposit',
      check(w, p, a) {
        if (!on(w)) return 'off';
        if (p.own) return 'owner';
        const ps = parentsWithSpare(w, p).filter(x => a.pid === undefined || x.g.id === a.pid);
        if (!ps.length) return 'no_parent';
        const q = H().quote(w, p, p.tiers.housing);
        return q.why === 'no_deposit' ? null : q.ok ? 'enough' : q.why;
      },
      params(w, p, a) { const x = parentsWithSpare(w, p).find(y => a.pid === undefined || y.g.id === a.pid); return { parent: x ? P.name(x.g) : '', home: tierName(w, p.tiers.housing) }; },
      run(w, p, a) {
        const x = parentsWithSpare(w, p).find(y => a.pid === undefined || y.g.id === a.pid), g = x.g, R = Pl.rng(w), F = LES.Finance;
        const q = H().quote(w, p, p.tiers.housing, { cash: 0 }), need = q.deposit + q.tax + Math.max(p.mcost, w.px(500)) - F.liquid(w, p);
        const bond = (st(w).bonds || {})[g.id], yes = U.clamp(0.3 + 0.4 * g.pers.resp / 100 + (bond === undefined ? 0 : (bond - 40) / 200) + Pl.traitOdds(w, p, 'ASK_CARE') + (x.spare > 3 * need ? 0.15 : 0), 0.1, 0.9);
        st(w).played = true;
        const params = { parent: P.name(g), home: tierName(w, p.tiers.housing) };
        if (R.next() >= yes) return { code: 'refused', params };
        const amt = Math.min(Math.max(0, need), x.spare);
        if (g.cash < amt) F.raiseCash(w, g, amt - g.cash, 'helping with a home deposit');
        const pay = Math.min(amt, g.cash);
        if (pay > 0) { w.ledger.move(g, 'cash', p, 'cash', pay); p.earned.gifts += pay; }
        P.log(w, p, `Parents helped with a home deposit (${U.fmtMoney(pay)})`, 'family', 0);
        return { code: pay >= need ? 'ok' : 'ok_part', params: Object.assign(params, { amt: U.fmtMoney(pay) }) };
      },
    },
    BUY_LET: {
      hours: 4, cooldown: 60, adult: true, key: () => 'buylet',
      check(w, p, a) { if (!on(w)) return 'off'; const t = a.tier !== undefined ? Number(a.tier) : 1; if (!(t >= 0 && t < C.TIERS.housing.length)) return 'bad_args'; const q = H().letQuote(w, p, t); return q.ok ? null : q.why; },
      params(w, p, a) { const t = a.tier !== undefined ? Number(a.tier) : 1; if (!on(w)) return {}; const q = H().letQuote(w, p, t); return Object.assign(quoteParams(w, p, q, t), { rent: U.fmtMoney(q.rent) }); },
      run(w, p, a) { const t = a.tier !== undefined ? Number(a.tier) : 1, q = H().buyLet(w, p, t); st(w).played = true; return { code: q.ok ? 'ok' : q.why, params: Object.assign(quoteParams(w, p, q, t), { rent: U.fmtMoney(q.rent) }) }; },
    },
    SELL_LET: {
      hours: 2, cooldown: 30, adult: true, key: a => `selllet:${a.i || 0}`,
      check(w, p, a) { return !on(w) ? 'off' : !(p.lets && p.lets[a.i || 0]) ? 'no_let' : null; },
      params(w, p, a) { const l = p.lets && p.lets[a.i || 0]; return l ? { home: tierName(w, l.tier), price: U.fmtMoney(H().price(w, l.tier)) } : {}; },
      run(w, p, a) { const l = p.lets[a.i || 0], home = tierName(w, l.tier), price = H().price(w, l.tier), left = H().sellLet(w, p, l, 'chosen'); st(w).played = true; return { code: 'ok', params: { home, price: U.fmtMoney(price), left: U.fmtMoney(left) } }; },
    },
  });
  // The requests a home moment can make (Player.TARGETS: the arguments, or null when it cannot happen now).
  Object.assign(Pl.TARGETS, {
    homeBuy: (w, p) => (on(w) && !p.own ? {} : null),
    homeSmaller: (w, p) => (on(w) && !p.own && p.tiers.housing > 0 ? {} : null),
    homeSell: (w, p) => (on(w) && p.own ? {} : null),
    homeExtra: (w, p) => (on(w) && p.own && p.debt.mortgage > 0 ? { share: 0.5 } : null),
    homeDeposit: (w, p) => { const x = on(w) && !p.own ? parentsWithSpare(w, p)[0] : null; return x ? { pid: x.g.id } : null; },
    homeLet: (w, p) => (on(w) && p.own ? { tier: Math.min(2, Math.max(1, p.own.tier - 1)) } : null),
    homeSellLet: (w, p) => (on(w) && p.lets && p.lets.length ? { i: 0 } : null),
    homeMoveDown: (w, p) => (p.isHead && p.tiers.housing > 0 ? { tier: p.tiers.housing - 1 } : null),
  });

  // ---- Moment situations ----
  const renting = (w, p) => on(w) && P.isAdult(w, p) && p.isHead && !p.own;
  const steadyJob = (w, p) => !!p.job && w.day - p.job.startDay >= 365;
  const partnerName = (w, p) => { const q = p.partnerId !== null ? w.people[p.partnerId] : null; return q && q.alive ? P.name(q) : ''; };
  const neighbour = (w, p) => w.living.find(q => q.alive && !q.away && q.adult && q.homeId === p.homeId && q.id !== p.id && q.id !== p.partnerId && !p.parents.includes(q.id) && !p.children.includes(q.id));
  Object.assign(Pl.CONDITIONS, {
    homeRenting: (w, p) => renting(w, p) && !p.everOwned && steadyJob(w, p),
    homeNearDeposit: (w, p) => { if (!renting(w, p)) return false; const q = H().quote(w, p, p.tiers.housing); return LES.Finance.liquid(w, p) >= 0.5 * (q.deposit + q.tax) && q.why !== 'none_for_sale'; },
    homeParentsCould: (w, p) => renting(w, p) && !p.everOwned && parentsWithSpare(w, p).length > 0,
    homeNewOwner: (w, p) => on(w) && !!p.own && w.day - p.own.day < 180 && !p.own.keptDay,
    homeOwner: (w, p) => on(w) && !!p.own,
    homeBehind: (w, p) => on(w) && !!p.own && !!p.mort && p.mort.missed >= 1,
    homeRateUp: (w, p) => on(w) && !!p.own && !!p.mort && p.mort.upDay !== undefined && w.day - p.mort.upDay < 90,
    homeBoom: (w, p) => on(w) && !!p.own && H().value(w, p) >= 1.1 * p.own.paid,
    homeSlump: (w, p) => on(w) && !!p.own && H().value(w, p) < p.own.paid,
    homeLandlord: (w, p) => on(w) && !!p.lets && p.lets.length > 0,
    homeTenant: (w, p) => on(w) && p.lord !== undefined && !!w.people[p.lord] && w.people[p.lord].alive,
    homeInherited: (w, p) => on(w) && !!p.own && p.own.keptDay !== undefined && w.day - p.own.keptDay < 365,
    homeOwnerSenior: (w, p) => on(w) && !!p.own && P.age(w, p) >= 65,
  });
  const base = (w, p) => ({ partner: partnerName(w, p) });
  const firstChild = (w, p) => p.children.map(id => w.people[id]).filter(q => q && q.alive && !q.away && P.isAdult(w, q)).sort((a, b) => a.birthDay - b.birthDay)[0];
  Object.assign(Pl.PARAMS, {
    homeRenting: base, homeNearDeposit: base, homeNewOwner: base, homeBehind: base, homeRateUp: base, homeBoom: base, homeSlump: base,
    homeParentsCould: (w, p) => { const x = parentsWithSpare(w, p)[0]; return Object.assign(base(w, p), { parent: x ? P.name(x.g) : '', pid: x ? x.g.id : -1 }); },
    homeOwner: (w, p) => { const n = neighbour(w, p); return Object.assign(base(w, p), { neighbour: n ? P.name(n) : '' }); },
    homeLandlord: (w, p) => { const l = (p.lets || []).find(x => x.tenant >= 0), t = l ? w.people[l.tenant] : null; return { tenant: t ? P.name(t) : '', pid: t ? t.id : -1 }; },
    homeTenant: (w, p) => { const q = w.people[p.lord]; return { landlord: q ? P.name(q) : '', pid: q ? q.id : -1 }; },
    homeInherited: (w, p) => { const q = p.own && w.people[p.own.keptFrom]; return Object.assign(base(w, p), { late: q ? P.name(q) : '' }); },
    homeOwnerSenior: (w, p) => { const c = firstChild(w, p); return Object.assign(base(w, p), { child: c ? P.name(c) : '' }); },
  });
  // A summary for the Home card (the life UI).
  Pl.homeCard = function (w, p) {
    if (!on(w) || !p || !P.isAdult(w, p)) return null;
    const Hs = H(), out = { own: null, quote: null, smaller: null, lets: [], tenantOf: null, prices: Hs.summary(w).prices, trend: Hs.trend ? Hs.trend(w) : null };
    if (p.own) out.own = { tier: p.own.tier, value: Hs.value(w, p), paid: p.own.paid, loan: p.debt.mortgage || 0, monthly: p.mort ? p.mort.monthly : 0, rate: p.mort ? p.mort.rate : 0, years: p.mort ? Math.max(0, (p.mort.end - w.day) / 365) : 0, missed: p.mort ? p.mort.missed : 0, spare: spare(w, p) };
    else if (p.isHead) { out.quote = Hs.quote(w, p, p.tiers.housing); if (p.tiers.housing > 0) out.smaller = Hs.quote(w, p, p.tiers.housing - 1); out.parents = parentsWithSpare(w, p).length > 0; }
    for (const l of p.lets || []) { const t = l.tenant >= 0 ? w.people[l.tenant] : null; out.lets.push({ tier: l.tier, value: Hs.price(w, l.tier), loan: l.debt, tenant: t ? P.name(t) : '', rent: LES.Finance.tierCost(w, 'housing', l.tier) }); }
    if (p.own) out.letQuote = Hs.letQuote(w, p, Math.min(2, Math.max(1, p.own.tier - 1)));
    if (p.lord !== undefined && w.people[p.lord]) out.tenantOf = P.name(w.people[p.lord]);
    return out;
  };
})(globalThis.LES = globalThis.LES || {});
