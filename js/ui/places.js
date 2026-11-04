// Building inspector ("Place" tab) and the Bursa Rezeki stock-market screen.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, UI = LES.UI;
  const $ = id => document.getElementById(id);
  const esc = U.esc;
  const KIND_NAMES = {
    kampung: 'Kampung house', flat: 'PPR flats', terrace: 'Terrace houses', condo: 'Condominium', bungalow: 'Bungalow',
    shoplot: 'Shoplot', builtlot: 'New estate', lot: 'Empty lot', depot: 'Bus depot', memorial: 'Memorial garden',
  };

  UI.renderPlace = function () {
    const app = UI.app, w = app.world, el = $('tab-place');
    const id = app.renderer.selectedBuilding;
    const b = id >= 0 ? w.town.buildings[id] : null;
    if (!b) { el.innerHTML = '<div class="card"><h3>Places</h3><p class="muted" style="margin:0">Click any building on the map to see who owns it, who lives or works there, and who is there right now. Click the ' + LES.Countries.pack.names.exchangeShort + ' to open the stock market.</p></div>'; return; }
    const title = b.label || KIND_NAMES[b.kind] || b.kind;
    const t = app.dayFrac * 1440, slot = t < LES.SLOT_B ? 0 : 1;
    const here = w.living.filter(p => p.alive && p.plan && p.plan[slot] && p.plan[slot].loc === b.id && !(p.plan[slot].act === 'REST' && t > LES.SLOT_END));
    const cards = [];
    cards.push(`<div class="card"><h3>${esc(title)} <small class="muted">${esc(KIND_NAMES[b.kind] || b.kind[0].toUpperCase() + b.kind.slice(1))}</small></h3>
      <p style="margin:0 0 6px">${esc(LES.KIND_INFO[b.kind] || '')}</p>
      ${b.kind === 'bursa' ? '<button class="primary" data-act="bursa">Open the stock market</button>' : ''}</div>`);

    if (b.home) {
      const residents = w.people.filter(p => p.alive && !p.away && p.homeId === b.id);
      const tier = b.tier;
      cards.push(`<div class="card"><h3>Homes <small class="muted">${residents.length}/${b.cap} residents</small></h3>
        <div class="grid2"><div><span class="muted">Housing tier</span><span>${esc(C.TIERS.housing[tier].name)}</span></div>
        <div><span class="muted">Rent now</span><span>${U.fmtMoney(LES.Finance.tierCost(w, 'housing', tier))}/mo</span></div>
        <div><span class="muted">Rent vs normal</span><span>×${w.rentMult[tier].toFixed(2)}</span></div>
        <div><span class="muted">Crowding</span><span class="${residents.length > b.cap ? 'neg' : ''}">${Math.round(residents.length / b.cap * 100)}%</span></div></div>
        <ul class="list-plain">${residents.slice(0, 40).map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${Math.floor(P.age(w, p))}${p.adult ? '' : ' · child'}</span></span><span>${U.fmtMoney(p.nw)}</span></li>`).join('')}</ul></div>`);
    }

    const bizHere = w.biz.filter(x => x.open && x.place === b.id);
    if (b.kind === 'shoplot' || bizHere.length) {
      cards.push(`<div class="card"><h3>Businesses here</h3>${bizHere.length ? `<ul class="list-plain">${bizHere.map(x => {
        const owners = Object.keys(x.shares).map(k => `${UI.plink(w, Number(k))} ${Math.round(x.shares[k] * 100)}%`).join(', ');
        return `<li><span><b>${esc(x.name)}</b> <span class="muted">${esc(x.typeDef.name)} · since ${U.fmtMonthYear(x.foundedDay)}</span><br><span class="muted">Owners: ${owners}</span><br><span class="muted">Revenue ${U.fmtMoney(x.lastRevenue)}/mo · profit <span class="${x.lastProfit < 0 ? 'neg' : 'pos'}">${U.fmtMoney(x.lastProfit)}</span></span></span><span>${U.fmtMoney(x.equity)}</span></li>`;
      }).join('')}</ul>` : '<p class="muted" style="margin:0">Empty — available for rent (SEWA).</p>'}</div>`);
      const past = w.biz.filter(x => !x.open && x.place === b.id).slice(-5);
      if (past.length) cards.push(`<div class="card"><h3>Previous tenants</h3><ul class="list-plain">${past.map(x => `<li><span>${esc(x.name)} <span class="muted">${esc(x.closeReason || 'closed')}</span></span><span class="muted">${U.fmtMonthYear(x.foundedDay)}–${x.closedDay !== null ? U.fmtMonthYear(x.closedDay) : ''}</span></li>`).join('')}</ul></div>`);
    }

    const staff = w.living.filter(p => p.alive && p.job && p.job.place === b.id);
    if (staff.length) {
      cards.push(`<div class="card"><h3>Employees <small class="muted">${staff.length}</small></h3><ul class="list-plain">${staff.slice(0, 40).map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${esc(LES.Labour.title(p.job))}</span></span><span>${U.fmtMoney(p.job.salary)}/mo</span></li>`).join('')}</ul></div>`);
    }
    const vacs = w.vacancies.filter(v => v.place === b.id);
    if (vacs.length) cards.push(`<div class="card"><h3>Open vacancies</h3><ul class="list-plain">${vacs.map(v => `<li><span>${esc(v.job.title)} <span class="muted">${v.job.req ? C.QUALS[v.job.req] || 'Degree' : 'no qualification needed'} · ${v.applicants.length} applicants · closes ${U.fmtDate(v.closeDay)}</span></span><span>${U.fmtMoney(v.salary)}</span></li>`).join('')}</ul></div>`);

    if (b.kind === 'memorial') {
      const gone = w.people.filter(p => !p.alive && p.gen === 0 && !p.migrant).sort((x, y) => y.deathDay - x.deathDay);
      cards.push(`<div class="card"><h3>In memory <small class="muted">${gone.length} founders</small></h3><ul class="list-plain">${gone.slice(0, 60).map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${Math.floor(P.age(w, p))} yrs · ${esc(p.causeOfDeath || '')}</span></span><span class="muted">${U.fmtMonthYear(p.deathDay)}</span></li>`).join('')}</ul></div>`);
    }
    if (b.kind === 'depot') {
      cards.push(`<div class="card"><h3>Bus lines</h3><ul class="list-plain">${w.town.busLines.map(l => `<li><span><span class="chip" style="border-color:${l.colour};color:${l.colour}">${esc(l.name)}</span> ${l.stops.length} stops</span><span class="muted">${l.buses} buses · every ~${Math.round(l.len / LES.BUS.speed / l.buses)} min</span></li>`).join('')}</ul>
        <div class="note">People without a vehicle walk to the nearest stop and ride when it is faster than walking.</div></div>`);
    }
    if (b.kind === 'lot') cards.push('<div class="card"><p class="muted" style="margin:0">When homes or shops get crowded, a new estate or shop row is built here.</p></div>');
    cards.push(`<div class="card"><h3>Here right now <small class="muted">${here.length}</small></h3><ul class="list-plain">${here.slice(0, 40).map(p => `<li><span>${UI.plink(w, p.id)}</span><span class="muted">${esc(p.plan[slot].label)}</span></li>`).join('') || '<li class="muted">Nobody</li>'}</ul></div>`);
    const scroll = el.scrollTop;
    el.innerHTML = cards.join('');
    el.scrollTop = scroll;
  };

  // ---------------- Bursa stock market screen ----------------
  UI.bursa = { range: 261, stock: null };
  UI.openBursa = function () {
    $('modal').classList.remove('hidden');
    $('modal-card').classList.add('wide');
    UI.bursaOpen = true;
    UI.renderBursa();
  };
  UI.closeBursa = function () {
    UI.bursaOpen = false;
    $('modal-card').classList.remove('wide');
    $('modal').classList.add('hidden');
  };

  UI.renderBursa = function () {
    const w = UI.app.world, mk = w.mkt, card = $('modal-card');
    const h = mk.idxHist, n = h.length;
    const chg = d => (n > d ? (h[n - 1] / h[n - 1 - d] - 1) : 0);
    const pct = x => `<span class="${x < 0 ? 'neg' : 'pos'}">${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%</span>`;
    const holders = tk => w.living.filter(p => p.alive && p.inv.st[tk]).length;
    const rows = mk.stocks.map(s => {
      const r1 = n > 1 ? s.lastRet : 0, r1y = LES.Market.stockRet(s, 261);
      const net = s.townBuy - s.townSell;
      return `<tr data-tk="${s.tk}" class="${UI.bursa.stock === s.tk ? 'sel' : ''}"><td><b style="color:${s.def.colour}">${s.tk}</b></td><td>${esc(s.def.name)}<div class="muted">${esc(s.def.sector)}</div></td>
        <td class="num">${U.fmtPrice(s.price)}</td><td class="num">${pct(r1)}</td><td class="num">${pct(r1y)}</td>
        <td class="num ${net < 0 ? 'neg' : 'pos'}">${net === 0 ? '–' : U.fmtMoney(net)}</td><td class="num">${holders(s.tk)}</td></tr>`;
    }).join('');
    const sel = UI.bursa.stock ? mk.byTk[UI.bursa.stock] : null;
    const topHolders = sel ? w.living.filter(p => p.alive && p.inv.st[sel.tk]).sort((a, b) => b.inv.st[sel.tk] - a.inv.st[sel.tk]).slice(0, 8) : [];
    const trades = mk.trades.slice(-14).reverse();
    const ranges = [[21, '1M'], [261, '1Y'], [261 * 10, '10Y'], [1e9, 'All']];
    card.innerHTML = `
      <div class="bursa-head"><h1>${LES.Countries.pack.names.exchange}</h1><button class="ghost" id="bursa-close">Close</button></div>
      <div class="stat-grid">
        <div class="stat"><div class="v">${mk.idx.toFixed(1)}</div><div class="l">${LES.Countries.pack.names.exchangeShort} index (equal-weighted)</div></div>
        <div class="stat"><div class="v">${pct(chg(21))} / ${pct(chg(261))}</div><div class="l">1 month / 1 year</div></div>
        <div class="stat"><div class="v">${(mk.alpha * 100).toFixed(1)}%</div><div class="l">town influence on prices</div></div>
      </div>
      <div class="seg" id="bursa-range">${ranges.map(([d, l]) => `<button data-r="${d}" class="${UI.bursa.range === d ? 'on' : ''}">${l}</button>`).join('')}</div>
      <canvas class="chart tall" id="bursa-chart"></canvas>
      <div class="bursa-grid">
        <div><table class="bursa-table"><thead><tr><th>Ticker</th><th>Company</th><th>Price</th><th>Day</th><th>1Y</th><th>Town net this month</th><th>Holders</th></tr></thead><tbody>${rows}</tbody></table>
          <p class="note">Click a company to chart it. Prices = outside market (random walk with booms/recessions + inflation) × a town deviation pushed by residents' unexpected buying and selling (square-root impact law), which fades over ~2 months. Town influence = residents' holdings ÷ (holdings + ${U.sym()}${(w.cfg.marketOutsideRM / 1e6).toFixed(0)}M outside market), capped at ${w.cfg.marketInfluenceCap}%. Companies that collapse are delisted and replaced by an IPO.</p></div>
        <div>
          ${sel ? `<div class="card"><h3>Top holders of ${sel.tk}</h3><ul class="list-plain">${topHolders.map(p => `<li><span>${UI.plink(w, p.id)}</span><span>${U.fmtMoney(p.inv.st[sel.tk] * sel.price)}</span></li>`).join('') || '<li class="muted">No residents own it</li>'}</ul></div>` : ''}
          <div class="card"><h3>Recent resident trades</h3><ul class="list-plain">${trades.map(tr => `<li><span>${UI.plink(w, tr.pid)} <span class="${tr.side > 0 ? 'pos' : 'neg'}">${tr.side > 0 ? 'bought' : 'sold'}</span> ${tr.tk}${tr.why === 'panic' ? ' <span class="neg">(panic)</span>' : ''}</span><span>${U.fmtMoney(tr.sen)} <span class="muted">${U.fmtMonthYear(tr.day)}</span></span></li>`).join('') || '<li class="muted">No trades yet</li>'}</ul></div>
        </div>
      </div>`;
    const days = mk.dayHist, len = days.length, from = Math.max(0, len - UI.bursa.range);
    const step = Math.max(1, Math.floor((len - from) / 500));
    const series = [];
    if (sel) {
      const sh = sel.hist, off = len - sh.length, data = [];
      for (let i = Math.max(from, off); i < len; i += step) data.push([days[i] / 365, sh[i - off] / 100]);
      series.push({ label: `${sel.tk} price (${U.sym()})`, color: sel.def.colour, data });
    } else {
      const data = [];
      for (let i = from; i < len; i += step) data.push([days[i] / 365, mk.idxHist[i]]);
      series.push({ label: `${LES.Countries.pack.names.exchangeShort} index`, color: '#57d38c', data });
    }
    LES.Charts.line($('bursa-chart'), { series, xFmt: x => (UI.bursa.range <= 261 ? U.fmtMonthYear(Math.round(x * 365)) : `Y${Math.floor(x) + 1}`), yFmt: v => (v >= 100 ? v.toFixed(0) : v.toFixed(2)), bands: UI.regimeBands(w) });
    $('bursa-close').onclick = UI.closeBursa;
    $('bursa-range').onclick = e => { const bt = e.target.closest('button'); if (bt) { UI.bursa.range = Number(bt.dataset.r); UI.renderBursa(); } };
    card.querySelector('tbody').onclick = e => { const tr = e.target.closest('tr'); if (tr) { UI.bursa.stock = UI.bursa.stock === tr.dataset.tk ? null : tr.dataset.tk; UI.renderBursa(); } };
    card.onclick = e => { const l = e.target.closest('[data-pid]'); if (l) { UI.closeBursa(); UI.app.select(Number(l.dataset.pid), true); } };
  };
})(globalThis.LES = globalThis.LES || {});
