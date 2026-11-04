// Bursa Rezeki stock market. Prices update every trading day (Mon-Fri).
// Price = fundamental value x town deviation. The fundamental follows the outside
// market (regime-driven random walk + inflation). The town deviation is pushed by
// residents' UNEXPECTED net order flow (panic selling, FOMO buying) through the
// square-root impact law (Toth et al. 2011): impact = Y * sigma_day * sqrt(|Q| / V),
// scaled by town influence a = town holdings / (town holdings + outside size), capped,
// and it mean-reverts over ~2 months - so crowds create bubbles and crashes, but
// steady saving does not inflate prices forever.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C;
  const M = LES.Market = {};

  M.create = function () {
    const stocks = C.STOCKS.map(s => ({
      tk: s.tk, def: s, price: U.RM(s.price0), shares: s.sharesM * 1e6,
      hist: [], flowToday: 0, grossToday: 0, volEma: U.RM(5000), netEma: 0, fund: U.RM(s.price0), dev: 0,
      townBuy: 0, townSell: 0, lastRet: 0,
    }));
    const cap0 = stocks.reduce((a, s) => a + s.price * s.shares, 0);
    const byTk = {};
    for (const s of stocks) byTk[s.tk] = s;
    return {
      stocks, byTk, cap0, idx: 100, idxHist: [], alpha: 0, alphaHist: [], townHold: 0,
      trades: [], tradeSeq: 0, dayHist: [],
    };
  };

  M.stock = (w, tk) => w.mkt.byTk[tk];

  // The Bursa index (and index fund) is market-cap weighted, like real exchange indices:
  // it behaves like buy-and-hold, so it earns the stocks' returns without an artificial
  // daily-rebalancing bonus. Mean-reverting fundamentals stop any one stock running away.
  M.weights = function (w) {
    const caps = w.mkt.stocks.map(s => s.price * s.shares);
    const tot = U.sum(caps);
    return caps.map(c => c / tot);
  };

  // Record a resident trade (sen). side: +1 buy, -1 sell.
  M.flow = function (w, s, sen, side) {
    s.flowToday += side * sen;
    s.grossToday += sen;
    if (side > 0) s.townBuy += sen; else s.townSell += sen;
  };
  M.logTrade = function (w, p, tk, sen, side, why) {
    if (sen < w.px(1000)) return;
    const mk = w.mkt;
    mk.trades.push({ day: w.day, pid: p.id, tk, sen, side, why, seq: ++mk.tradeSeq });
    if (mk.trades.length > 400) mk.trades.splice(0, mk.trades.length - 400);
  };

  M.retOver = function (w, days) {
    const h = w.mkt.idxHist;
    if (h.length <= days) return 0;
    return h[h.length - 1] / h[h.length - 1 - days] - 1;
  };
  M.stockRet = function (s, days) {
    const h = s.hist;
    if (h.length <= days) return 0;
    return h[h.length - 1] / h[h.length - 1 - days] - 1;
  };

  M.daily = function (w) {
    const mk = w.mkt;
    if (w.day % 7 >= 5) return; // weekend: orders wait for Monday
    const R = w.rng.market, m = w.macro(), dt = 1 / C.TRADING_DAYS;
    const outside = w.cfg.marketOutsideRM * 100 * w.price;
    mk.alpha = Math.min(w.cfg.marketInfluenceCap / 100, mk.townHold / (mk.townHold + outside));
    const a = mk.alpha;
    const zm = U.clamp(R.normal(0, 1), -4, 4);
    const infl = w.infl;
    const wPrev = M.weights(w); // yesterday's cap weights chain-link the index
    for (const s of mk.stocks) {
      const d = s.def;
      const sigTot = Math.sqrt(d.beta * d.beta * m.idxSig * m.idxSig + d.idio * d.idio);
      const sd = sigTot * Math.sqrt(dt);
      // Trend grows at inflation + real trend; the fundamental is pulled back toward it.
      const g = infl + C.MARKET_TREND_REAL + d.drift - (d.div || 0); // dividend payers grow slower in price
      if (!s.trend) s.trend = Math.log(s.fund);
      s.trend += g * dt;
      const pull = C.MARKET_REVERSION * (s.trend - Math.log(s.fund));
      const mu = g + d.beta * (m.idxMu - C.MARKET_MU_NORMAL) + pull;
      const zi = U.clamp(R.normal(0, 1), -4, 4);
      let rOut = mu * dt + d.beta * m.idxSig * Math.sqrt(dt) * zm + d.idio * Math.sqrt(dt) * zi;
      if (R.next() < 0.0008) rOut += R.normal(0, 0.12); // rare company news
      s.volEma = 0.95 * s.volEma + 0.05 * Math.max(s.grossToday, w.px(2000));
      const q = s.flowToday - s.netEma; // only the surprise part of resident flow moves prices
      s.netEma = 0.97 * s.netEma + 0.03 * s.flowToday;
      const impact = q === 0 ? 0 : Math.sign(q) * C.MARKET_IMPACT_Y * sd * Math.sqrt(Math.abs(q) / s.volEma);
      const rTown = U.clamp(impact, -5 * sd, 5 * sd) + 0.6 * sd * U.clamp(R.normal(0, 1), -4, 4);
      s.fund = U.clamp(s.fund * Math.exp(rOut), 1, 1e15);
      s.dev = U.clamp(s.dev * (1 - C.TOWN_REVERSION) + a * rTown, -1.5, 1.5);
      const prev = s.price;
      s.price = U.clamp(s.fund * Math.exp(s.dev), 1, 1e15);
      s.lastRet = s.price / prev - 1;
      s.hist.push(s.price);
      s.flowToday = 0; s.grossToday = 0;
    }
    // Chain-linked cap-weighted return (a delisting/IPO never makes the index jump).
    mk.idx = mk.idx * (1 + U.sum(mk.stocks.map((s, i) => wPrev[i] * s.lastRet)));
    for (const s of mk.stocks) if (s.price < Math.round(10 * w.price)) M.delist(w, s);
    mk.idxHist.push(mk.idx);
    mk.dayHist.push(w.day);
    mk.alphaHist.push(a);
  };

  // A collapsed company goes bust: shareholders lose their shares and a new
  // company is listed (IPO) in its place, so the exchange keeps 8 companies.
  M.delist = function (w, s) {
    const mk = w.mkt, R = w.rng.market;
    let holders = 0;
    for (const p of w.people) {
      if (!p.inv.st[s.tk]) continue;
      delete p.inv.st[s.tk];
      holders++;
      if (p.alive && !p.away) LES.P.log(w, p, `${s.def.name} went bust; shares became worthless`, 'money', 0);
    }
    w.pushFeed({ day: w.day, pid: -1, text: `${s.def.name} (${s.tk}) collapsed and was delisted from Bursa Rezeki${holders ? `; ${holders} residents lost their shares` : ''}`, cat: 'economy', imp: 2 });
    const used = new Set(mk.stocks.map(x => x.tk));
    const pool = C.IPO_POOL.filter(d => !used.has(d.tk) && !(mk.retired || []).includes(d.tk));
    const base = pool.length ? R.pick(pool) : C.IPO_POOL[0];
    (mk.retired = mk.retired || []).push(s.tk);
    delete mk.byTk[s.tk];
    const def = Object.assign({}, base, { price0: R.range(1, 5) });
    s.tk = pool.length ? def.tk : `${def.tk}${mk.retired.length}`;
    s.def = def;
    s.price = Math.round(U.RM(def.price0) * w.price);
    s.fund = s.price; s.trend = Math.log(s.price); s.dev = 0; s.netEma = 0; s.hist = [];
    mk.byTk[s.tk] = s;
    w.pushFeed({ day: w.day, pid: -1, text: `New listing: ${def.name} (${s.tk}) IPO on Bursa Rezeki at ${U.fmtPrice(s.price)} per share`, cat: 'economy', imp: 1 });
  };

  M.monthly = function (w) {
    let hold = 0;
    for (const p of w.living) if (p.alive && !p.away) hold += LES.P.invValue(w, p);
    w.mkt.townHold = hold;
    for (const s of w.mkt.stocks) { s.townBuy = 0; s.townSell = 0; }
  };
})(globalThis.LES = globalThis.LES || {});
