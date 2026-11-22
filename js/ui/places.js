// Building inspector ("Place" tab) and the Bursa Rezeki stock-market screen.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, UI = LES.UI;
  const $ = id => document.getElementById(id);
  const esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s), t = (k, p) => esc(T(k, p)); // PL-17
  const KIND_NAMES = {
    kampung: 'Kampung house', flat: 'PPR flats', terrace: 'Terrace houses', condo: 'Condominium', bungalow: 'Bungalow',
    shoplot: 'Shoplot', builtlot: 'New estate', lot: 'Empty lot', depot: 'Bus depot', memorial: 'Memorial garden',
    townhall: 'Town hall', privhosp: 'Private hospital', privschool: 'Private school', techhub: 'Tech hub', researchcentre: 'Research centre', hq: 'Head office',
  };

  // With no building selected: the town's key buildings, grouped, each one click away.
  const KEY_GROUPS = [
    ['pl.g.gov', ['townhall', 'padang', 'police', 'court', 'jail', 'prison', 'rehab']],
    ['pl.g.money', ['bursa', 'bank', 'hq', 'office', 'techhub', 'researchcentre', 'mall']],
    ['pl.g.health', ['hospital', 'privhosp', 'welfare']],
    ['pl.g.edu', ['university', 'kolej', 'school', 'privschool', 'library', 'hall']],
    ['pl.g.travel', ['station', 'depot']],
    ['pl.g.worship', ['masjid', 'tokong', 'kuil', 'gereja']],
    ['pl.g.leisure', ['park', 'gym', 'cinema', 'golf', 'memorial']],
  ];
  UI.keyPlacesHtml = function (w) {
    const tw = w.town, groups = [], staffAt = new Map();
    for (const p of w.living) if (p.alive && p.job) staffAt.set(p.job.place, (staffAt.get(p.job.place) || 0) + 1);
    for (const [name, kinds] of KEY_GROUPS) {
      const rows = [];
      for (const k of kinds) {
        const ids = tw.kinds[k] || [];
        ids.slice(0, 6).forEach((id, i) => {
          const b = tw.buildings[id], n = ids.length;
          const nm = G(b.label || KIND_NAMES[b.kind] || (b.kind[0].toUpperCase() + b.kind.slice(1)));
          const staff = staffAt.get(id) || 0;
          rows.push(`<li class="clickable" data-bid="${id}" tabindex="0" role="button" title="${t('pl.select')}"><span>${esc(nm)}${n > 1 && !b.label ? ` <span class="muted">${i + 1}</span>` : ''}</span><span class="muted">${staff ? t('gv.staff', { count: staff }) : ''}</span></li>`);
        });
        if (ids.length > 6) rows.push(`<li><span class="muted">${t('pl.more', { count: ids.length - 6 })}</span></li>`);
      }
      if (rows.length) groups.push(`<div class="glance-sec">${t(name)}</div><ul class="list-plain places-list">${rows.join('')}</ul>`);
    }
    return `<div class="card"><h3>${t('pl.title')}</h3><p class="muted" style="margin:0 0 4px">${t('pl.intro', { name: LES.Countries.pack.names.exchangeShort })}</p></div>
      <div class="card"><h3>${t('pl.key', { town: LES.townName(w) })}</h3>${groups.join('') || `<p class="muted" style="margin:0">${t('pl.none')}</p>`}</div>`;
  };
  // Select a building (as a click on the map would) and centre the map on it.
  UI.showBuilding = function (id) {
    const app = UI.app, r = app.renderer, w = app.world, b = w && w.town.buildings[id];
    if (!b) return;
    if (app.view === 'region' && app.selectTown) app.selectTown(w.townIdx);
    r.follow = false;
    r.selectedBuilding = id;
    if (r.z < r.fitZoom() * 1.5) r.z = r.fitZoom() * 2;
    const T = w.town.T;
    r.centerOn((b.x + b.w / 2) * T, (b.y + b.h / 2) * T, 1);
    if (UI.tab !== 'place') UI.setTab('place'); else UI.update(true);
  };

  UI.renderPlace = function () {
    const app = UI.app, w = app.world, el = $('tab-place');
    const id = app.renderer.selectedBuilding;
    const b = id >= 0 ? w.town.buildings[id] : null;
    if (!b) { el.innerHTML = UI.keyPlacesHtml(w); return; }
    const title = G(b.label || KIND_NAMES[b.kind] || b.kind);
    const tm = app.dayFrac * 1440, slot = tm < LES.SLOT_B ? 0 : 1;
    const here = w.living.filter(p => p.alive && p.plan && p.plan[slot] && p.plan[slot].loc === b.id && !(p.plan[slot].act === 'REST' && tm > LES.SLOT_END));
    const cards = [];
    cards.push(`<div class="tab-tools"><button class="ghost" data-ui="places" title="${t('pl.back.tip')}">← ${t('pl.back')}</button></div>`);
    cards.push(`<div class="card"><h3>${esc(title)} <small class="muted">${esc(G(KIND_NAMES[b.kind] || b.kind[0].toUpperCase() + b.kind.slice(1)))}</small></h3>
      <p style="margin:0 0 6px">${esc(G(LES.KIND_INFO[b.kind] || ''))}</p>
      ${b.kind === 'bursa' ? `<button class="primary" data-act="bursa">${t('pl.openMarket')}</button>` : ''}</div>`);

    if (b.home) {
      const residents = w.people.filter(p => p.alive && !p.away && p.homeId === b.id);
      const tier = b.tier;
      cards.push(`<div class="card"><h3>${t('pl.homes')} <small class="muted">${t('pl.residents', { n: residents.length, cap: b.cap })}</small></h3>
        <div class="grid2"><div><span class="muted">${t('pl.tier')}</span><span>${esc(G(C.TIERS.housing[tier].name))}</span></div>
        <div><span class="muted">${t('pl.rentNow')}</span><span>${t('pn.perMonth', { amt: U.fmtMoney(LES.Finance.tierCost(w, 'housing', tier)) })}</span></div>
        <div><span class="muted">${t('pl.rentVs')}</span><span>×${w.rentMult[tier].toFixed(2)}</span></div>
        <div><span class="muted">${t('pl.crowding')}</span><span class="${residents.length > b.cap ? 'neg' : ''}">${Math.round(residents.length / b.cap * 100)}%</span></div></div>
        <ul class="list-plain">${residents.slice(0, 40).map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${Math.floor(P.age(w, p))}${p.adult ? '' : ` · ${t('pl.child')}`}</span></span><span>${U.fmtMoney(p.nw)}</span></li>`).join('')}</ul></div>`);
    }

    const bizHere = w.biz.filter(x => x.open && x.place === b.id);
    if (b.kind === 'shoplot' || bizHere.length) {
      cards.push(`<div class="card"><h3>${t('pl.bizHere')}</h3>${bizHere.length ? `<ul class="list-plain">${bizHere.map(x => {
        const owners = Object.keys(x.shares).map(k => `${UI.plink(w, Number(k))} ${Math.round(x.shares[k] * 100)}%`).join(', ');
        return `<li><span><b>${esc(x.name)}</b> <span class="muted">${esc(G(x.typeDef.name))} · ${t('pn.since', { date: U.fmtMonthYear(x.foundedDay) })}</span><br><span class="muted">${T('pl.owners', { list: owners })}</span><br><span class="muted">${T('pn.revenue', { rev: U.fmtMoney(x.lastRevenue), profit: `<span class="${x.lastProfit < 0 ? 'neg' : 'pos'}">${U.fmtMoney(x.lastProfit)}</span>` })}</span></span><span>${U.fmtMoney(x.equity)}</span></li>`;
      }).join('')}</ul>` : `<p class="muted" style="margin:0">${t('pl.empty', { sign: (LES.Countries.pack.town.signs || {}).SEWA || 'SEWA' })}</p>`}</div>`);
      const past = w.biz.filter(x => !x.open && x.place === b.id).slice(-5);
      if (past.length) cards.push(`<div class="card"><h3>${t('pl.previous')}</h3><ul class="list-plain">${past.map(x => `<li><span>${esc(x.name)} <span class="muted">${esc(G(x.closeReason || 'closed'))}</span></span><span class="muted">${U.fmtMonthYear(x.foundedDay)}–${x.closedDay !== null ? U.fmtMonthYear(x.closedDay) : ''}</span></li>`).join('')}</ul></div>`);
    }

    const staff = w.living.filter(p => p.alive && p.job && p.job.place === b.id);
    if (staff.length) {
      cards.push(`<div class="card"><h3>${t('pl.employees')} <small class="muted">${staff.length}</small></h3><ul class="list-plain">${staff.slice(0, 40).map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${esc(LES.Labour.title(p.job))}</span></span><span>${t('pn.perMonth', { amt: U.fmtMoney(p.job.salary) })}</span></li>`).join('')}</ul></div>`);
    }
    const vacs = w.vacancies.filter(v => v.place === b.id);
    if (vacs.length) cards.push(`<div class="card"><h3>${t('pl.vacancies')}</h3><ul class="list-plain">${vacs.map(v => `<li><span>${esc(v.job.title)} <span class="muted">${v.job.req ? esc(G(LES.P.reqName(v.job.req))) : t('pl.noQual')} · ${t('pl.applicants', { count: v.applicants.length, date: U.fmtDate(v.closeDay) })}</span></span><span>${U.fmtMoney(v.salary)}</span></li>`).join('')}</ul></div>`);

    if (b.kind === 'memorial') {
      const gone = w.people.filter(p => !p.alive && p.gen === 0 && !p.migrant).sort((x, y) => y.deathDay - x.deathDay);
      cards.push(`<div class="card"><h3>${t('pl.memory')} <small class="muted">${t('pl.founders', { count: gone.length })}</small></h3><ul class="list-plain">${gone.slice(0, 60).map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${t('pl.yrs', { age: Math.floor(P.age(w, p)) })} · ${esc(G(p.causeOfDeath || ''))}</span></span><span class="muted">${U.fmtMonthYear(p.deathDay)}</span></li>`).join('')}</ul></div>`);
    }
    if (b.kind === 'depot') {
      cards.push(`<div class="card"><h3>${t('pl.bus')}</h3><ul class="list-plain">${w.town.busLines.map(l => `<li><span><span class="chip" style="border-color:${l.colour};color:${l.colour}">${esc(l.name)}</span> ${t('pl.stops', { count: l.stops.length })}</span><span class="muted">${t('pl.buses', { count: l.buses, min: Math.round(l.len / LES.BUS.speed / l.buses) })}</span></li>`).join('')}</ul>
        <div class="note">${t('pl.busNote')}</div></div>`);
    }
    if (b.kind === 'lot') cards.push(`<div class="card"><p class="muted" style="margin:0">${t('pl.lot')}</p></div>`);
    cards.push(`<div class="card"><h3>${t('pl.hereNow')} <small class="muted">${here.length}</small></h3><ul class="list-plain">${here.slice(0, 40).map(p => `<li><span>${UI.plink(w, p.id)}</span><span class="muted">${esc(G(p.plan[slot].label))}</span></li>`).join('') || `<li class="muted">${t('pl.nobody')}</li>`}</ul></div>`);
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
      return `<tr data-tk="${s.tk}" class="${UI.bursa.stock === s.tk ? 'sel' : ''}"><td><b style="color:${s.def.colour}">${s.tk}</b></td><td>${esc(s.def.name)}<div class="muted">${esc(G(s.def.sector))}</div></td>
        <td class="num">${U.fmtPrice(s.price)}</td><td class="num">${pct(r1)}</td><td class="num">${pct(r1y)}</td>
        <td class="num ${net < 0 ? 'neg' : 'pos'}">${net === 0 ? '–' : U.fmtMoney(net)}</td><td class="num">${holders(s.tk)}</td></tr>`;
    }).join('');
    const sel = UI.bursa.stock ? mk.byTk[UI.bursa.stock] : null;
    const topHolders = sel ? w.living.filter(p => p.alive && p.inv.st[sel.tk]).sort((a, b) => b.inv.st[sel.tk] - a.inv.st[sel.tk]).slice(0, 8) : [];
    const trades = mk.trades.slice(-14).reverse();
    const ranges = [[21, 'bu.r.1m'], [261, 'bu.r.1y'], [261 * 10, 'bu.r.10y'], [1e9, 'bu.r.all']];
    card.innerHTML = `
      <div class="bursa-head"><h1>${esc(LES.Countries.pack.names.exchange)}</h1><button class="ghost" id="bursa-close">${t('pn.tb.close')}</button></div>
      <div class="stat-grid">
        <div class="stat"><div class="v">${mk.idx.toFixed(1)}</div><div class="l">${t('bu.index', { name: LES.Countries.pack.names.exchangeShort })}</div></div>
        <div class="stat"><div class="v">${pct(chg(21))} / ${pct(chg(261))}</div><div class="l">${t('bu.monthYear')}</div></div>
        <div class="stat"><div class="v">${(mk.alpha * 100).toFixed(1)}%</div><div class="l">${t('bu.influence')}</div></div>
      </div>
      <div class="seg" id="bursa-range">${ranges.map(([d, l]) => `<button data-r="${d}" class="${UI.bursa.range === d ? 'on' : ''}">${t(l)}</button>`).join('')}</div>
      <canvas class="chart tall" id="bursa-chart"></canvas>
      <div class="bursa-grid">
        <div><table class="bursa-table"><thead><tr><th>${t('bu.ticker')}</th><th>${t('bu.company')}</th><th>${t('gv.price')}</th><th>${t('bu.day')}</th><th>${t('bu.r.1y')}</th><th>${t('bu.townNet')}</th><th>${t('bu.holders')}</th></tr></thead><tbody>${rows}</tbody></table>
          <p class="note">${t('bu.note', { out: `${U.sym()}${(w.cfg.marketOutsideRM / 1e6).toFixed(0)}M`, cap: w.cfg.marketInfluenceCap })}</p></div>
        <div>
          ${sel ? `<div class="card"><h3>${t('bu.top', { tk: sel.tk })}</h3><ul class="list-plain">${topHolders.map(p => `<li><span>${UI.plink(w, p.id)}</span><span>${U.fmtMoney(p.inv.st[sel.tk] * sel.price)}</span></li>`).join('') || `<li class="muted">${t('bu.noOwners')}</li>`}</ul></div>` : ''}
          <div class="card"><h3>${t('bu.trades')}</h3><ul class="list-plain">${trades.map(tr => `<li><span>${UI.plink(w, tr.pid)} <span class="${tr.side > 0 ? 'pos' : 'neg'}">${t(tr.side > 0 ? 'bu.bought' : 'bu.sold')}</span> ${tr.tk}${tr.why === 'panic' ? ` <span class="neg">(${t('bu.panic')})</span>` : ''}</span><span>${U.fmtMoney(tr.sen)} <span class="muted">${U.fmtMonthYear(tr.day)}</span></span></li>`).join('') || `<li class="muted">${t('bu.noTrades')}</li>`}</ul></div>
        </div>
      </div>`;
    const days = mk.dayHist, len = days.length, from = Math.max(0, len - UI.bursa.range);
    const step = Math.max(1, Math.floor((len - from) / 500));
    const series = [];
    if (sel) {
      const sh = sel.hist, off = len - sh.length, data = [];
      for (let i = Math.max(from, off); i < len; i += step) data.push([days[i] / 365, sh[i - off] / 100]);
      series.push({ label: T('bu.price', { tk: sel.tk, sym: U.sym() }), color: sel.def.colour, data });
    } else {
      const data = [];
      for (let i = from; i < len; i += step) data.push([days[i] / 365, mk.idxHist[i]]);
      series.push({ label: T('pn.ch.index', { name: LES.Countries.pack.names.exchangeShort }), color: '#57d38c', data });
    }
    LES.Charts.line($('bursa-chart'), { series, xFmt: x => (UI.bursa.range <= 261 ? U.fmtMonthYear(Math.round(x * 365)) : `Y${Math.floor(x) + 1}`), yFmt: v => (v >= 100 ? v.toFixed(0) : v.toFixed(2)), bands: UI.regimeBands(w) });
    $('bursa-close').onclick = UI.closeBursa;
    $('bursa-range').onclick = e => { const bt = e.target.closest('button'); if (bt) { UI.bursa.range = Number(bt.dataset.r); UI.renderBursa(); } };
    card.querySelector('tbody').onclick = e => { const tr = e.target.closest('tr'); if (tr) { UI.bursa.stock = UI.bursa.stock === tr.dataset.tk ? null : tr.dataset.tk; UI.renderBursa(); } };
    card.onclick = e => { const l = e.target.closest('[data-pid]'); if (l) { UI.closeBursa(); UI.app.select(Number(l.dataset.pid), true); } };
  };
})(globalThis.LES = globalThis.LES || {});
