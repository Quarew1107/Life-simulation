// Side panels (Person inspector, Leaderboard, Events, Stats) and top bar. Pop-ups: toasts.js.
// Reads world state only; user actions go back to main.js through app methods.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, A = LES.Actions;
  const $ = id => document.getElementById(id);
  const esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s); // PL-17: interface text and data names
  const UI = LES.UI = { tab: 'person', lbMode: 'alive', feedFilter: 'all', last: {}, feedSeqShown: 0 };

  const FEED_FILTERS = [['all', 'All'], ['cast', '★ Cast'], ['goal', 'Goals'], ['wealth', 'Wealth'], ['biz', 'Business'], ['career', 'Career'], ['edu', 'Education'], ['family', 'Family'], ['luck', 'Luck'], ['migration', 'Migration'], ['crime', 'Crime'], ['politics', 'Politics'], ['death', 'Deaths'], ['economy', 'Economy']];
  const CAT_ICON = { wealth: '💰', biz: '🏪', career: '💼', edu: '🎓', family: '👪', luck: '🎲', death: '🕯️', economy: '📊', money: '💵', life: '🧭', goal: '🎯', migration: '🚆', crime: '🚨', politics: '🏛️' };
  const SLOT_NAMES = () => [T('pn.slot.day'), T('pn.slot.evening')];

  UI.init = function (app) {
    UI.app = app;
    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => UI.setTab(b.dataset.tab)));
    $('search').addEventListener('input', () => UI.renderLeaders(true));
    $('lb-mode').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      UI.lbMode = b.dataset.mode;
      $('lb-mode').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      UI.renderLeaders(true);
    });
    UI.feedFilterHtml = () => { $('feed-filter').innerHTML = FEED_FILTERS.map(([k]) => `<button data-f="${k}" class="${k === UI.feedFilter ? 'on' : ''}">${esc(T(`pn.feed.${k}`))}</button>`).join(''); };
    UI.feedFilterHtml();
    window.addEventListener('les-lang', () => UI.feedFilterHtml());
    $('btn-news').addEventListener('click', () => LES.NewsUI.open(app));
    $('feed-filter').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      UI.feedFilter = b.dataset.f;
      $('feed-filter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      UI.renderFeed(true);
    });
    // Delegated clicks for person links and panel buttons
    $('side').addEventListener('click', e => {
      const ui = e.target.closest('[data-ui]'); // panel-only toggles (no app action)
      if (ui) {
        if (ui.dataset.ui === 'help') UI.helpOpen = !UI.helpOpen;
        if (ui.dataset.ui === 'places') app.renderer.selectedBuilding = -1;
        if (ui.dataset.ui === 'more') { UI.moreOpen = !UI.moreOpen; if (UI.moreOpen) UI.focusNext = '.p-more-menu button'; }
        UI.update(true);
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) { if (act.closest('.p-more-menu')) UI.moreOpen = false; app.action(act.dataset.act, act.dataset); return; }
      const bl = e.target.closest('[data-bid]'); // a building in the Place tab's list
      if (bl) { UI.showBuilding(Number(bl.dataset.bid)); return; }
      const xl = e.target.closest('[data-xtown]'); // the same person or family in another town
      if (xl) { e.preventDefault(); app.selectTown(Number(xl.dataset.xtown)); if (Number(xl.dataset.xid) >= 0) app.select(Number(xl.dataset.xid), true); return; }
      const link = e.target.closest('[data-pid]');
      if (link) { app.select(Number(link.dataset.pid), true); }
    });
    $('side').addEventListener('keydown', e => { // list rows that act as buttons
      const bl = (e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-bid]');
      if (bl) { e.preventDefault(); e.stopPropagation(); UI.showBuilding(Number(bl.dataset.bid)); }
    });
    // The More menu closes on a click elsewhere, and Esc closes it before Esc deselects the person.
    document.addEventListener('pointerdown', e => { if (UI.moreOpen && !e.target.closest('.p-more')) UI.closeMore(false); });
    window.addEventListener('keydown', e => {
      if (!UI.moreOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); UI.closeMore(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { // move through the menu items
        const items = [...document.querySelectorAll('.p-more-menu button')];
        if (!items.length) return;
        e.preventDefault(); e.stopPropagation();
        const i = items.indexOf(document.activeElement), n = items.length;
        items[(i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
      }
    }, true);
    UI.initResize(app);
    UI.initLife();
  };

  UI.setTab = function (tab) {
    UI.tab = tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));
    UI.update(true);
  };

  // ---- The goal, shown honestly: the real share of it, and the next milestone on the way ----
  UI.goalShare = (w, gw) => LES.Finance.goalShare(w, gw); // (pure helpers in finance.js, so the tests can reach them)
  UI.nextMilestone = (w, gw) => LES.Finance.nextMilestone(w, gw);
  // The town's milestone race: who passed 1 million, 10 million and the goal first (world.firsts).
  UI.firstsHtml = function (w) {
    const list = (w.milestoneList || []).filter((x, i) => i >= 1); // 1 million and up
    if (!list.length) return '';
    const f = w.firsts || {};
    return `<ul class="list-plain milestones">${list.map(th => {
      const r = f[th];
      return `<li><span>${th === w.goal ? '🏆' : '★'} ${esc(T('pn.firstTo', { amt: U.fmtMoney(th) }))}</span><span>${r ? `${UI.plink(w, r.pid)} <span class="muted">${esc(T('pn.yearAge', { year: U.dayToDate(r.day).year, age: r.age }))}</span>` : `<span class="muted">${esc(T('pn.nobodyYet'))}</span>`}</span></li>`;
    }).join('')}</ul>`;
  };
  // Old saves (rules revision 8 and before) logged every unpaid bill into the town news; the All view skips them.
  const CUTBACK = /^Could not afford .*; downgraded$/;

  UI.plink = function (w, id) {
    const p = w.people[id];
    if (!p) return '?';
    return `<a class="plink ${p.alive ? '' : 'dead'}" data-pid="${id}">${esc(P.name(p))}</a>`;
  };

  UI.mainSource = function (p) {
    const e = p.earned;
    const src = [[T('pn.src.salary'), e.wages + e.gigs], [T('pn.src.business'), e.business], [T('pn.src.investing'), e.invest + e.interest], [T('pn.src.inherit'), e.inherit + e.gifts], [T('pn.src.luck'), e.luck]];
    src.sort((a, b) => b[1] - a[1]);
    return src[0][1] > 0 ? src[0][0] : '—';
  };

  // Called from the main loop; throttles each panel independently.
  UI.update = function (force) {
    const app = UI.app, now = performance.now();
    if (!app || !app.world) return;
    const due = (k, ms) => { if (force || !UI.last[k] || now - UI.last[k] > ms) { UI.last[k] = now; return true; } return false; };
    if (due('top', 200)) UI.renderTop();
    const fastRun = !app.paused;
    if (UI.tab === 'life' && due('life', fastRun ? 500 : 200)) UI.renderLife();
    if (due('lifeWatch', 300)) UI.watchLife();
    if (UI.tab === 'person' && due('person', fastRun ? 400 : 150)) UI.renderPerson();
    if (UI.tab === 'leaders' && due('leaders', 600)) UI.renderLeaders();
    if (UI.tab === 'feed' && due('feed', 500)) UI.renderFeed();
    if (UI.tab === 'stats' && due('stats', 1200)) UI.renderStats();
    if (UI.tab === 'society' && due('society', 1500)) UI.renderSociety();
    if (UI.tab === 'crime' && due('crime', 1500)) UI.renderCrime();
    if (UI.tab === 'gov' && due('gov', 1500)) UI.renderGov();
    if (UI.tab === 'place' && due('place', 700)) UI.renderPlace();
    if (UI.bursaOpen && due('bursa', 1500)) UI.renderBursa();
    if (due('toasts', 300)) UI.checkToasts();
  };

  // ---------------- Top bar ----------------
  UI.renderTop = function () {
    const app = UI.app, w = app.world;
    const day = Math.max(0, w.lastDay);
    $('date-text').textContent = U.fmtDate(day);
    $('time-text').textContent = w.lastDay < 0 ? T('pn.notStarted') : app.fast ? T('pn.fastForward', { speed: app.speedLabel() }) : LES.clockAt(app.dayFrac);
    const sub = $('town-sub'); if (sub && sub.textContent !== LES.townName(w)) sub.textContent = LES.townName(w);
    const R = app.region, ts = $('town-switch');
    ts.classList.toggle('hidden', !R);
    if (R) {
      const regionOn = app.view === 'region';
      const key = R.towns.map(t => `${t.counts.living}`).join(',') + w.townIdx + regionOn + LES.I18n.lang();
      if (ts.dataset.key !== key) {
        ts.dataset.key = key;
        ts.innerHTML = `<button data-town="-1" class="${regionOn ? 'on' : ''}" title="${esc(T('pn.region.tip'))}">🗺 ${esc(T('pn.region'))}</button>`
          + R.towns.map((t, i) => `<button data-town="${i}" class="${t === w && !regionOn ? 'on' : ''}" title="${esc(T('pn.showTown', { town: LES.townName(t) }))}">${U.esc(LES.townName(t))} <small>${t.counts.living}</small></button>`).join('');
        for (const b of ts.querySelectorAll('button')) b.onclick = () => (b.dataset.town === '-1' ? app.showRegion() : app.selectTown(Number(b.dataset.town)));
      }
    }
    // Play a Life: who you are playing, their age and life stage (click to follow them).
    const pt = LES.Player.town(app.region || w), ps = pt && LES.Player.summary(pt), pb = $('play-badge');
    pb.classList.toggle('hidden', !ps);
    if (ps) {
      const T = LES.I18n.t, txt = ps.waiting ? T('play.waiting') : pt.player.spectator ? T('play.watching') : !ps.alive ? T('play.died', { name: ps.name }) : ps.away ? T('play.away', { name: ps.name }) : T('play.badge', { name: ps.name, age: ps.age, stage: T(`life.${ps.stage}`) });
      const key = `${txt}|${LES.I18n.lang()}`;
      if (pb.dataset.key !== key) { pb.dataset.key = key; pb.textContent = `🎮 ${txt}`; pb.title = T('play.badgeTip', { name: ps.name }); pb.classList.toggle('gone', !ps.alive); }
    }
    const scn = LES.Scenarios.current(w), sb = $('scn-badge');
    sb.classList.toggle('hidden', !scn);
    if (scn && sb.dataset.id !== scn.id + LES.I18n.lang()) { sb.dataset.id = scn.id + LES.I18n.lang(); sb.innerHTML = `${LES.icon(scn.icon, 14)} ${U.esc(G(scn.name))}`; sb.title = T('pn.scenario', { name: G(scn.name), short: G(scn.short) }); }
    const r = C.REGIMES[w.regime];
    const badge = $('regime');
    badge.textContent = T('pn.economy', { name: G(r.name) });
    badge.style.color = r.color;
    const day0 = Math.max(0, w.lastDay), fest = LES.Ambience.festival(day0), wx = LES.Ambience.weather(day0);
    $('mood').innerHTML = `${{ rain: '🌧️', haze: '🌫️', clear: '☀️', snow: '❄️', heat: '🥵' }[wx.id] || '☀️'} ${esc(G(wx.name))}${fest ? ` · 🎉 <b>${esc(G(fest.name))}</b>` : ''}`;
    $('mood').title = `${G(wx.name)}${fest ? ` · ${G(fest.name)}` : ''}`; // full text if the fixed-width box truncates it
    const h = w.history[w.history.length - 1];
    const adults = w.counts.adults;
    const employed = w.living.filter(p => p.alive && p.job).length;
    const millionaires = w.living.filter(p => p.alive && p.adult && P.goalWorth(w, p) >= U.RM(1e6)).length;
    // Short labels keep the top bar on one row at 1080p; details live in the tooltips.
    $('kpis').innerHTML = [
      [w.counts.living, T('pn.kpi.people'), T('pn.kpi.people.tip', { count: w.counts.living, children: w.counts.children })],
      [adults ? U.fmtPct(employed / adults) : '–', T('pn.kpi.employed'), T('pn.kpi.employed.tip')],
      [w.biz.filter(b => b.open).length, T('pn.kpi.firms'), T('pn.kpi.firms.tip')],
      [millionaires, T('pn.kpi.millionaires'), T(w.cfg.goalMode === 'real' ? 'pn.kpi.millionaires.tipReal' : 'pn.kpi.millionaires.tip', { sym: U.sym() })],
      [h ? h.gini.toFixed(2) : '–', T('pn.kpi.gini'), T('pn.kpi.gini.tip')],
      [`${(w.infl * 100).toFixed(1)}%`, T('pn.kpi.inflation'), T('pn.kpi.inflation.tip', { x: w.price.toFixed(2) })],
      [`${(w.mkt.idx).toFixed(0)}`, LES.Countries.pack.names.exchangeShort, T('pn.kpi.index.tip', { name: LES.Countries.pack.names.exchange, pct: (w.mkt.alpha * 100).toFixed(0) })],
    ].map(([v, l, t]) => `<div class="kpi" title="${U.esc(t)}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    const rich = app.richest();
    const goalEl = $('goal');
    if (w.winner) {
      const win = w.people[w.winner.pid];
      goalEl.className = 'goal won';
      goalEl.innerHTML = `<div class="row"><span>🏆 ${T('pn.goalWon', { name: `<a class="plink" data-pid="${win.id}">${esc(P.name(win))}</a>` })}</span><span class="muted">${esc(T('pn.yearAge', { year: U.dayToDate(w.winner.day).year, age: w.winner.age }))}</span></div><div class="bar"><i style="width:100%"></i></div>`;
    } else {
      const gw = rich ? P.goalWorth(w, rich) : 0, nx = UI.nextMilestone(w, gw);
      goalEl.className = 'goal';
      goalEl.innerHTML = `<div class="row"><span>${esc(T(w.cfg.goalMode === 'real' ? 'pn.goalReal' : 'pn.goal', { amt: U.fmtMoney(w.goal) }))}</span><span class="muted">${rich ? `${esc(rich.first)} ${U.fmtMoney(gw)} · ${UI.goalShare(w, gw)}` : ''}</span></div><div class="bar" title="${esc(T('pn.goal.tip', { amt: U.fmtMoney(nx.th), pct: Math.round(nx.frac * 100), share: UI.goalShare(w, gw) }))}"><i style="width:${(nx.frac * 100).toFixed(1)}%"></i></div>`;
    }
    goalEl.onclick = e => { const l = e.target.closest('[data-pid]'); if (l) app.select(Number(l.dataset.pid), true); else if (rich) app.select(rich.id, true); };
  };

  // ---------------- Person ----------------
  function bar(label, value, max, color, pot, num) {
    const pct = U.clamp(value / max, 0, 1) * 100;
    const potMark = pot !== undefined ? `<i class="pot" style="left:${U.clamp(pot / max, 0, 1) * 100}%" title="${esc(T('pn.potential', { v: pot.toFixed(1) }))}"></i>` : '';
    return `<div class="row"><span>${label}</span><div class="track"><i class="fill" style="width:${pct.toFixed(1)}%;background:${color}"></i>${potMark}</div><span class="num">${num !== undefined ? num : Math.round(value)}</span></div>`;
  }
  function pips(n, total) { let s = '<span class="pips">'; for (let i = 0; i < total; i++) s += `<i class="${i <= n ? 'on' : ''}"></i>`; return s + '</span>'; }

  UI.renderPerson = function () {
    const app = UI.app, w = app.world, el = $('tab-person');
    const p = app.selected >= 0 ? w.people[app.selected] : null;
    if (!p) { el.innerHTML = UI.welcomeHtml(); return; }
    const age = Math.floor(P.age(w, p));
    const stratCol = C.STRATEGY_COLORS[p.strategy];
    let status;
    if (!p.alive) status = `🕯️ ${esc(T('pn.died', { age, cause: G(p.causeOfDeath), date: U.fmtDate(p.deathDay) }))}`;
    else if (p.away) status = `✈️ ${esc(T('pn.away', { town: LES.townName(w), reason: G(p.away.reason) }))}`;
    else if (p.plan && p.plan.length) {
      const s = p.plan[app.dayFrac * 1440 < LES.SLOT_B ? 0 : 1] || p.plan[0];
      status = `${A.ICONS[s.act] || '•'} ${esc(LES.I18n.render(s.label))}`;
    } else status = `🏠 ${esc(T('pn.atHome'))}`;
    const job = p.job ? T('pn.jobPay', { job: G(LES.Labour.title(p.job)), pay: U.fmtMoney(p.job.salary) }) : p.retired ? T('pn.retired') : p.adult ? T('pn.noJob') : T('pn.child');
    const chips = [`<span class="chip strat" style="--c:${stratCol}">${esc(G(C.STRATEGY_NAMES[p.strategy]))}</span>`];
    if (!p.alive) chips.push(`<span class="chip dead">${esc(T('pn.chip.dead'))}</span>`);
    if (p.gen === 0 && !p.migrant) chips.push(`<span class="chip">${esc(T('pn.chip.founder'))}</span>`);
    if (p.migrant) chips.push(`<span class="chip">${esc(T('pn.chip.migrant'))}${p.arrivedDay ? ' · ' + U.fmtMonthYear(p.arrivedDay) : ''}</span>`);
    if (p.away) chips.push(`<span class="chip dead">${esc(T('pn.chip.away'))} · ${U.fmtMonthYear(p.away.since)}</span>`);
    if (p.custom) chips.push(`<span class="chip">${esc(T('pn.chip.custom'))}</span>`);
    if (p.guardian === 'WELFARE') chips.push(`<span class="chip">${esc(T('pn.chip.welfare'))}</span>`);
    if (p.bankruptUntil >= w.day) chips.push(`<span class="chip dead">${esc(T('pn.chip.bankrupt'))}</span>`);
    if (p.pregnancy) chips.push(`<span class="chip">${esc(T('pn.chip.expecting'))} 👶</span>`);
    for (const th of p.milestones) chips.push(`<span class="chip gold">★ ${U.fmtMoney(th)}</span>`);

    const nw = p.nw, goal = w.goal;
    const realNw = P.realWorth(w, p);
    const gwP = P.goalWorth(w, p), nxP = UI.nextMilestone(w, gwP);
    const invIdx = Math.round(p.inv.idx * w.mkt.idx), invStk = P.stockValue(w, p);
    const holdings = Object.keys(p.inv.st).map(tk => `${tk} ${U.fmtMoney(p.inv.st[tk] * w.mkt.byTk[tk].price)}`).join(', ');
    const e = p.earned;

    let html = `
      <div class="p-head">
        <canvas class="portrait" id="portrait" width="64" height="88"></canvas>
        <div>
          <h2>${esc(P.name(p))}</h2>
          <div class="meta">${p.sex === 'M' ? '♂' : '♀'} ${esc(T('pn.ageGen', { age, gen: p.gen }))} · ${esc(job)}</div>
          <div class="status">${status}</div>
          <div class="chips">${chips.join('')}</div>
        </div>
      </div>
      ${UI.toolbarHtml(app, p)}
      <div class="card">
        <h3>${esc(T('pn.nw'))} <small class="muted">${esc(T('pn.peak', { amt: U.fmtMoney(p.peakNw) }))}</small></h3>
        <div class="networth"><span class="big ${nw < 0 ? 'neg' : ''}">${U.fmtMoney(nw)}</span><span class="muted">${esc(T('pn.ofGoal', { share: UI.goalShare(w, gwP) }))}${gwP < goal ? ` · ${esc(T('pn.next', { amt: U.fmtMoney(nxP.th), pct: Math.round(nxP.frac * 100) }))}` : ''}</span></div>
        ${w.price > 1.01 ? `<div class="note">${T('pn.y1money', { amt: `<b>${U.fmtMoney(realNw)}</b>`, x: w.price.toFixed(2) })}</div>` : ''}
        <div class="progress" title="${esc(T('pn.nextTip', { amt: U.fmtMoney(nxP.th) }))}"><i style="width:${(nxP.frac * 100).toFixed(1)}%"></i></div>
        <div class="grid2">
          <div><span class="muted">${esc(T('pn.cash'))}</span><span>${U.fmtMoney(p.cash)}</span></div>
          <div><span class="muted">${esc(G(LES.Countries.pack.names.retirement))}</span><span>${U.fmtMoney(p.epf)}</span></div>
          ${p.epfFlex || p.epfWell ? `<div title="${esc(T('pn.epf.tip', { age: LES.Countries.pack.retirement.accessAge }))}"><span class="muted">· Fleksibel / Sejahtera</span><span>${U.fmtMoney(p.epfFlex || 0)} / ${U.fmtMoney(p.epfWell || 0)}</span></div>` : ''}
          <div><span class="muted">${esc(T('pn.idx'))}</span><span>${U.fmtMoney(invIdx)}</span></div>
          <div title="${esc(holdings)}"><span class="muted">${esc(T('pn.shares'))}</span><span>${U.fmtMoney(invStk)}</span></div>
          <div><span class="muted">${esc(T('pn.bizEq'))}</span><span>${U.fmtMoney(P.bizValue(w, p))}</span></div>
          <div><span class="muted">${esc(T('pn.trust'))}</span><span>${U.fmtMoney(p.trust)}</span></div>
          <div><span class="muted">${esc(T('pn.studyDebt'))}</span><span class="${p.debt.study ? 'neg' : ''}">${U.fmtMoney(-p.debt.study)}</span></div>
          <div><span class="muted">${esc(T('pn.living'))}</span><span>${esc(T('pn.perMonth', { amt: U.fmtMoney(p.mcost) }))}</span></div>
        </div>
        <canvas class="chart" id="chart-nw"></canvas>
        <div class="grid2" title="${esc(T('pn.earn.tip'))}">
          <div><span class="muted">${esc(T('pn.earn.wages', { ret: LES.Countries.pack.names.retirement }))}</span><span>${U.fmtMoney(e.wages)}</span></div>
          <div><span class="muted">${esc(T('pn.earn.gigs'))}</span><span>${U.fmtMoney(e.gigs)}</span></div>
          <div><span class="muted">${esc(T('pn.earn.biz'))}</span><span>${U.fmtMoney(e.business)}</span></div>
          <div><span class="muted">${esc(T('pn.earn.inv'))}</span><span class="${e.invest < 0 ? 'neg' : ''}">${U.fmtMoney(e.invest + e.interest)}</span></div>
          <div><span class="muted">${esc(T('pn.earn.inherit'))}</span><span>${U.fmtMoney(e.inherit + e.gifts)}</span></div>
          <div><span class="muted">${esc(T('pn.earn.luck'))}</span><span>${U.fmtMoney(e.luck + e.welfare)}</span></div>
        </div>
        ${holdings ? `<div class="note">${esc(T('pn.held', { list: holdings }))}</div>` : ''}
      </div>`;
    if (p.adult && LES.Report && LES.Report.wealthStory) {
      const ws = LES.Report.wealthStory(w, p);
      html += `<div class="card"><h3>${esc(T('pn.shaped'))}</h3><ul class="list-plain">${ws.lines.map(x => `<li>${x}</li>`).join('')}</ul><div class="note">${ws.note}</div></div>`;
    }

    if (p.adult && p.goal) {
      const gd = LES.Goals.DEFS[p.goal.id];
      const done = p.goalsDone.map(x => `<li><span>${LES.Goals.DEFS[x.id].icon} ${esc(LES.I18n.render(x.text))}</span><span class="muted">${esc(T('pn.age', { age: x.age }))}</span></li>`).join('');
      html += `<div class="card"><h3>${esc(T('pn.lifeGoal'))} <small class="muted">${esc(T('pn.since', { date: U.fmtMonthYear(Math.max(0, p.goal.since)) }))}</small></h3>
        <div class="goal-now"><span class="goal-ic">${gd.icon}</span><div><b>${esc(G(gd.name))}</b><div class="muted">${esc(G(LES.Goals.text(p.goal)))}</div></div></div>
        <div class="progress"><i style="width:${(p.goal.progress * 100).toFixed(1)}%"></i></div>
        <div class="note">${esc(T('pn.goalNote', { pct: Math.round(p.goal.progress * 100), happy: Math.round(p.happy), avg: Math.round(p.happyAvg) }))}</div>
        ${done ? `<ul class="list-plain" style="margin-top:6px">${done}</ul>` : ''}</div>`;
    }

    if (p.alive && !p.away && p.why && p.why.length) {
      html += `<div class="card"><h3>${esc(T('pn.why'))} <small class="muted">${U.fmtDate(w.lastDay)}</small></h3>`;
      const revealB = app.fast || app.paused || app.dayFrac * 1440 >= LES.SLOT_B;
      p.why.forEach((s, i) => {
        if (i === 1 && !revealB) { html += `<div class="why-slot"><div class="hd"><span class="muted">${esc(SLOT_NAMES()[1])}</span><span class="muted">${esc(T('pn.decidesAt'))}</span></div></div>`; return; }
        const ok = s.ok === undefined ? '' : s.ok ? ` <span class="pos">✓ ${esc(T('pn.success'))}</span>` : ` <span class="neg">✗ ${esc(T('pn.failed'))}</span>`;
        html += `<div class="why-slot"><div class="hd"><span class="muted">${esc(SLOT_NAMES()[i])}</span><span>${A.ICONS[s.act] || ''} ${esc(LES.I18n.render(s.chosen))}${ok}${s.forced ? ` <span class="neg">(${esc(T('pn.override'))})</span>` : ''}</span></div>`;
        for (const o of s.options.slice().sort((a, b) => b.p - a.p).slice(0, 7)) {
          html += `<div class="why-opt ${o.label === s.chosen ? 'chosen' : ''}" title="${esc(T('pn.utility', { v: o.u.toFixed(2) }))}"><span>${A.ICONS[o.act || o.id] || ''} ${esc(LES.I18n.render(o.label))}</span><div class="track"><i style="width:${(o.p * 100).toFixed(1)}%"></i></div><span class="pct">${(o.p * 100).toFixed(o.p < 0.1 ? 1 : 0)}%</span></div>`;
        }
        html += '</div>';
      });
      html += `<div class="note">${esc(T('pn.whyNote'))}</div></div>`;
    } else if (p.alive && !p.adult) {
      html += `<div class="card"><h3>${esc(T('pn.childhood'))}</h3><div class="grid2">
        <div><span class="muted">${esc(T('pn.upbringing'))}</span><span>${Math.round(p.upbringing * 100)}%</span></div>
        <div><span class="muted">${esc(T('pn.caregivers'))}</span><span>${p.guardian === 'WELFARE' ? esc(T('pn.chip.welfare')) : p.caregivers.length}</span></div></div>
        <div class="note">${esc(T('pn.childNote'))}</div></div>`;
    }

    if (p.alive) {
      html += `<div class="card bars"><h3>${esc(T('pn.condition'))}</h3>
        ${bar(esc(T('pn.happiness')), p.happy, 100, '#f2c14e')}${bar(esc(T('pn.health')), p.health, 100, '#57d38c')}${bar(esc(T('pn.energy')), p.energy, 100, '#5aa9e6')}${bar(esc(T('pn.stress')), p.stress, 100, '#ff6b6b')}${bar(esc(T('pn.hunger')), p.hunger, 100, '#f4a261')}</div>`;
    }
    html += `<div class="card bars"><h3>${esc(T('pn.attributes'))} <small class="muted">${esc(T('pn.attrKey'))}</small></h3>
      ${C.ATTR_NAMES.map((n, i) => bar(esc(G(n)), p.att[i], 10, '#f2c14e', p.pot[i], p.att[i].toFixed(1))).join('')}
      ${p.ageing ? `<div class="note" title="${esc(T('pn.ageing.tip'))}">🧬 ${T('pn.ageing', { b: `<b>${p.ageing.bOnset.toFixed(0)}</b>`, br: (p.ageing.bRate * 100).toFixed(1), bf: (p.ageing.bFloor * 100).toFixed(0), m: `<b>${p.ageing.mOnset.toFixed(0)}</b>`, mr: (p.ageing.mRate * 100).toFixed(1), mf: (p.ageing.mFloor * 100).toFixed(0) })}</div>` : ''}
      ${p.attHist.length > 1 ? '<canvas class="chart" id="chart-att"></canvas>' : ''}</div>`;
    html += `<div class="card bars"><h3>${esc(T('pn.personality'))}</h3>
      ${C.PERS.map(k => bar(esc(G(C.PERS_NAMES[k])), p.pers[k], 100, '#b892ff')).join('')}
      ${bar(esc(T('pn.famDesire')), p.famDesire, 100, '#f28482')}</div>`;

    html += UI.societyCard ? UI.societyCard(w, p) : '';
    html += UI.crimeCard ? UI.crimeCard(w, p) : '';
    html += UI.politicsCard ? UI.politicsCard(w, p) : '';
    if (app.region && ((p.away && p.away.town !== undefined) || (p.xlinks && p.xlinks.length))) { // links to the same family in other towns
      const R = app.region, rows = [];
      if (p.away && p.away.town !== undefined) rows.push(`<li>${esc(T('pn.x.now'))} <a href="#" data-xtown="${p.away.town}" data-xid="${p.away.id}">${U.esc(LES.townName(R.towns[p.away.town]))}</a></li>`);
      for (const x of p.xlinks || []) { const q = R.towns[x.town].people[x.id]; if (q) rows.push(`<li>${esc(T(x.rel === 'self' ? 'pn.x.from' : x.rel === 'parent' ? 'pn.x.parent' : 'pn.x.child'))} <a href="#" data-xtown="${x.town}" data-xid="${x.id}">${U.esc(LES.townName(R.towns[x.town]))}</a>${x.rel === 'self' ? '' : `: ${U.esc(P.name(q))}`}</li>`); }
      html += `<div class="card"><h3>${esc(T('pn.otherTowns'))}</h3><ul class="list-plain xlinks">${rows.join('')}</ul></div>`;
    }
    if (p.clan && LES.Scenarios.CLAN_BY_ID[p.clan]) { const cl = LES.Scenarios.CLAN_BY_ID[p.clan]; html += `<div class="card"><h3>${esc(T('pn.clan'))} <small class="muted">${esc(T('pn.clanScn'))}</small></h3><p><span style="color:${cl.colour}">■</span> <b>${U.esc(G(cl.name))}</b> (${U.esc(G(cl.en))}): ${esc(T('pn.clanGift', { attr: G(C.ATTR_NAMES[cl.attr]) }))}</p></div>`; }
    if (p.adult) {
      html += `<div class="card tiers"><h3>${esc(T('pn.lifestyle'))} <small class="muted">${esc(T('pn.lifestyleCost', { amt: U.fmtMoney(p.mcost) }))}</small></h3>
        ${C.TIER_CATS.map(cat => {
          const t = C.TIERS[cat][p.tiers[cat]];
          const paysHousing = cat !== 'housing' || p.isHead;
          return `<div class="row"><span class="muted">${esc(G(C.TIER_CAT_NAMES[cat]))}</span><span>${pips(p.tiers[cat], C.TIERS[cat].length)}${esc(G(t.name))}<div class="fx">${esc(G(t.fx || ''))}</div></span><span>${paysHousing ? U.fmtMoney(LES.Finance.tierCost(w, cat, p.tiers[cat])) : esc(T('pn.partnerPays'))}</span></div>`;
        }).join('')}</div>`;
    }

    // Career & education
    const quals = p.quals.length ? p.quals.map(q => G(P.qualName(p, q))).join(', ') : T('pn.none');
    let career = `<div class="grid2"><div><span class="muted">${esc(T('pn.quals'))}</span><span>${esc(quals)}</span></div></div>`;
    if (p.enrol) {
      const c = C.COURSE_BY_ID[p.enrol.course];
      const pct = p.enrol.progress / (c.months * 12);
      career += `<div class="bars">${bar(esc(G(c.name).replace('Bachelor of ', 'B. ')), pct, 1, '#b892ff', undefined, U.fmtPct(pct))}</div>
        <div class="note">${esc(p.enrol.scholarship ? T('pn.scholarship') : T('pn.fees', { amt: U.fmtMoney(p.enrol.feeMonthly) }))} · ${esc(T('pn.started', { date: U.fmtDate(p.enrol.startDay) }))}</div>`;
    }
    if (p.job) {
      career += `<div class="grid2" style="margin-top:6px">
        <div><span class="muted">${esc(T('pn.job'))}</span><span>${esc(G(LES.Labour.title(p.job)))}</span></div>
        <div><span class="muted">${esc(T('pn.salary'))}</span><span>${esc(T('pn.perMonth', { amt: U.fmtMoney(p.job.salary) }))}</span></div>
        <div><span class="muted">${esc(T('pn.shifts'))}</span><span>${p.job.shiftsMonth}/${w.cfg.shiftsPerMonth}</span></div>
        <div><span class="muted">${esc(T('pn.sinceLabel'))}</span><span>${p.job.startDay < 0 ? esc(T('pn.beforeY1')) : U.fmtMonthYear(p.job.startDay)}</span></div></div>`;
    }
    const xps = C.XP_CATS.filter(k => p.xp[k] >= 0.05);
    if (xps.length) career += `<div class="bars" style="margin-top:6px">${xps.map(k => bar(esc(T(`pn.xp.${k}`)), p.xp[k], 5, '#3ec7b5', undefined, p.xp[k].toFixed(1))).join('')}</div>`;
    if (p.adult) html += `<div class="card"><h3>${esc(T('pn.career'))}</h3>${career}</div>`;

    const owned = Object.keys(p.shares).map(k => w.biz[Number(k)]);
    const founded = w.biz.filter(b => b.founderId === p.id && !b.open);
    if (owned.length || founded.length) {
      html += `<div class="card"><h3>${esc(T('pn.businesses'))}</h3><ul class="list-plain">`;
      for (const b of owned) {
        html += `<li><span><b>${esc(G(b.name))}</b> <span class="muted">${esc(G(b.typeDef.name))} · ${Math.round(p.shares[b.id] * 100)}%${b.managerId === p.id ? ` · ${esc(T('pn.manager'))}` : ''}${b.booms ? ` · ${esc(T('pn.booms', { count: b.booms }))}` : ''}</span><br><span class="muted">${T('pn.revenue', { rev: U.fmtMoney(b.lastRevenue), profit: `<span class="${b.lastProfit < 0 ? 'neg' : 'pos'}">${U.fmtMoney(b.lastProfit)}</span>` })}</span></span><span>${U.fmtMoney(b.equity)}</span></li>`;
      }
      for (const b of founded.slice(-4)) html += `<li><span class="muted">${esc(G(b.name))} — ${esc(G(b.closeReason || 'closed'))} ${b.closedDay !== null ? U.fmtMonthYear(b.closedDay) : ''}</span><span class="muted">${esc(T('pn.peak', { amt: U.fmtMoney(b.peakEquity) }))}</span></li>`;
      html += '</ul></div>';
    }

    // Family
    const fam = [];
    if (p.partnerId !== null) fam.push([T('pn.f.partner'), UI.plink(w, p.partnerId)]);
    if (p.exPartners.length) fam.push([T('pn.f.ex'), p.exPartners.map(id => UI.plink(w, id)).join(', ')]);
    if (p.parents.length) fam.push([T('pn.f.parents'), p.parents.map(id => UI.plink(w, id)).join(' & ')]);
    if (p.children.length) fam.push([T('pn.f.children'), p.children.map(id => `${UI.plink(w, id)} <span class="muted">(${Math.floor(P.age(w, w.people[id]))})</span>`).join(', ')]);
    if (!p.adult && p.caregivers.length) fam.push([T('pn.f.raised'), p.caregivers.map(id => UI.plink(w, id)).join(', ')]);
    if (p.stratHist.length > 1) fam.push([T('pn.f.strat'), p.stratHist.map(s => `${esc(G(C.STRATEGY_NAMES[s.strategy]))} <span class="muted">(${U.fmtMonthYear(s.day < 0 ? 0 : s.day)}${s.reason !== 'founder' ? ', ' + esc(G(s.reason)) : ''})</span>`).join(' → ')]);
    const dyn = LES.Extras.dynasty(w, p);
    if (dyn.total) fam.push([T('pn.f.dynasty'), esc(T('pn.dynasty', { total: dyn.total, living: dyn.living, amt: U.fmtMoney(dyn.wealth) }))]);
    if (fam.length) html += `<div class="card"><h3>${esc(T('pn.family'))}</h3>${p.parents.length || p.children.length || p.partnerId !== null || p.exPartners.length ? LES.Extras.familyTreeSvg(w, p) : ''}<ul class="list-plain">${fam.map(([k, v]) => `<li><span class="muted">${esc(k)}</span><span style="text-align:right">${v}</span></li>`).join('')}</ul></div>`;

    // Life story
    const entries = p.log.slice().reverse().slice(0, 150);
    html += `<div class="card"><h3>${esc(T('pn.lifeStory'))} <small class="muted">${esc(T('pn.events', { count: p.log.length }))}</small></h3><ul class="list-plain story">
      ${entries.map(x => `<li class="imp${x.imp}"><span class="when">${U.fmtMonthYear(x.day)}<br>${esc(T('pn.age', { age: Math.floor((x.day - p.birthDay) / 365) }))}</span><span class="what">${esc(LES.I18n.render(x.text))}</span></li>`).join('')}</ul></div>`;

    if (app.pinned >= 0 && app.pinned !== p.id && w.people[app.pinned]) {
      const cut = html.indexOf('<div class="card">');
      html = html.slice(0, cut) + LES.Extras.compareHtml(w, w.people[app.pinned], p) + html.slice(cut);
    }
    const scroll = el.scrollTop;
    const keep = UI.focusKey(el);
    el.innerHTML = html;
    el.scrollTop = scroll;
    UI.restoreFocus(el, keep);

    // Canvases
    const portrait = $('portrait');
    if (portrait && !(LES.Portrait && LES.Portrait.draw(portrait, w, p))) {
      const g = portrait.getContext('2d');
      g.imageSmoothingEnabled = false;
      const group = age < 3 ? 'baby' : !p.adult ? 'child' : age >= 65 ? 'elder' : 'adult';
      const spr = LES.Sprites.person(LES.Sprites.lookOf(p, P.age(w, p)), group, 0);
      const k = Math.floor(Math.min(60 / spr.width, 80 / spr.height));
      g.drawImage(spr, Math.round((64 - spr.width * k) / 2), Math.round((88 - spr.height * k) / 2), spr.width * k, spr.height * k);
    }
    const cn = $('chart-nw');
    if (cn) {
      const data = p.nwHist.map(([d, v]) => [d / 365, Math.max(0, v)]);
      if (p.alive) data.push([w.day / 365, Math.max(0, p.nw)]);
      LES.Charts.line(cn, { series: [{ label: T('pn.chart.nw'), color: '#f2c14e', data }], logY: true, yFmt: LES.Charts.fmtAxisMoney, xFmt: x => T('rp.yr', { n: Math.floor(x) + 1 }), bands: UI.regimeBands(w) });
    }
    const ca = $('chart-att');
    if (ca) {
      const cols = ['#f2c14e', '#ff6b6b', '#3ec7b5', '#b892ff', '#5aa9e6', '#57d38c'];
      LES.Charts.line(ca, { series: C.ATTR.map((n, i) => ({ label: n, color: cols[i], width: 1.5, data: p.attHist.map(([d, a]) => [d / 365, a[i]]) })), yFmt: v => v.toFixed(0), xFmt: x => T('rp.yr', { n: Math.floor(x) + 1 }), yMin: 0 });
    }
  };

  // Short help: the full welcome before the first day; afterwards a "?" toggle on the glance card.
  UI.helpHtml = function (w) {
    return `<p style="margin:0 0 6px">${T('pn.help1', { count: w.cfg.founders, goal: `<b class="gold">${U.fmtMoney(w.goal)}</b>` })}</p>
      <p class="muted" style="margin:0">${T('pn.help2Html')}</p>`;
  };

  UI.welcomeHtml = function () {
    const app = UI.app, w = app.world;
    const adults = w.living.filter(p => p.alive && p.adult && !p.away);
    const young = adults.filter(p => P.age(w, p) < 21).sort((a, b) => (P.age(w, a) - P.age(w, b)) || (a.id - b.id)).slice(0, 3);
    const ent = adults.filter(p => p.strategy === 'ENT').slice(0, 2);
    const pick = arr => arr.map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${Math.floor(P.age(w, p))} · ${esc(G(C.STRATEGY_NAMES[p.strategy]))}</span></span><span>${U.fmtMoney(p.nw)}</span></li>`).join('');
    const extra = `${young.length ? `<div class="card"><h3>${esc(T('pn.youngest'))}</h3><ul class="list-plain">${pick(young)}</ul></div>` : ''}
      ${ent.length ? `<div class="card"><h3>${esc(T('pn.wouldBe'))}</h3><ul class="list-plain">${pick(ent)}</ul></div>` : ''}`;
    if (w.lastDay < 1) { // before the first day: the welcome
      const rich = adults.slice().sort((a, b) => b.nw - a.nw).slice(0, 3);
      return `<div class="card"><h3>${esc(T('pn.welcome', { town: LES.townName(w) }))}</h3>${UI.helpHtml(w)}</div>
        <div class="card"><h3>${esc(T('pn.richestNow'))}</h3><ul class="list-plain">${pick(rich)}</ul></div>${extra}`;
    }
    return UI.glanceHtml(w) + extra;
  };

  // "Town at a glance": shown on the Person tab once time has moved on and nobody is selected.
  UI.glanceHtml = function (w) {
    const app = UI.app, goal = w.goal;
    const race = w.living.filter(p => p.alive && p.adult && !p.away).sort((a, b) => (P.goalWorth(w, b) - P.goalWorth(w, a)) || (a.id - b.id)).slice(0, 3);
    let raceHtml;
    if (w.winner) raceHtml = `<p style="margin:0">🏆 ${T('pn.reachedGoal', { name: UI.plink(w, w.winner.pid), year: U.dayToDate(w.winner.day).year, age: w.winner.age })}</p>`;
    else raceHtml = `<ul class="list-plain glance-race">${race.map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${Math.floor(P.age(w, p))} · ${esc(G(C.STRATEGY_NAMES[p.strategy]))}</span></span><span>${U.fmtMoney(P.goalWorth(w, p))} <span class="muted">${UI.goalShare(w, P.goalWorth(w, p))}</span></span></li>`).join('')}</ul>`;
    // Big events: the last 7 days, or else the most recent ones.
    const big = w.feed.filter(e => e.imp >= 2);
    let recent = big.filter(e => e.day >= w.lastDay - 6), evTitle = T('pn.thisWeek');
    if (!recent.length) { recent = big; evTitle = T('pn.latestBig'); }
    recent = recent.slice(-4).reverse();
    const evHtml = recent.length ? `<ul class="list-plain glance-ev">${recent.map(e => `<li${e.pid >= 0 ? ` data-pid="${e.pid}" class="clickable"` : ''}><span>${CAT_ICON[e.cat] || '•'} ${e.pid >= 0 ? `<b>${esc(P.name(w.people[e.pid]))}</b>: ` : ''}${esc(LES.I18n.render(e.text))}</span><span class="muted">${U.fmtDate(e.day)}</span></li>`).join('')}</ul>` : `<p class="muted" style="margin:0">${esc(T('pn.nothingBig'))}</p>`;
    // Trends: now vs. about a year ago (monthly snapshots).
    const h = w.history, last = h[h.length - 1], then = h[Math.max(0, h.length - 13)];
    const empRate = r => { const lf = r.employed + r.unemployed + r.owners; return lf ? (r.employed + r.owners) / lf : 0; };
    const delta = (a, b, fmt, downIsGood) => { const d = a - b; return d === 0 || !Number.isFinite(d) ? '<span class="muted">±0</span>' : `<span class="${(d > 0) !== !!downIsGood ? 'pos' : 'neg'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</span>`; };
    const since = last && then && last !== then ? (h.length > 13 ? T('pn.vsYear') : T('pn.sinceStart')) : '';
    const trends = last ? `<div class="grid2 glance-trend">
        <div><span class="muted">${esc(T('pn.t.people'))}</span><span>${w.counts.living} ${since ? delta(last.pop, then.pop, v => v) : ''}</span></div>
        <div><span class="muted">${esc(T('pn.t.work'))}</span><span>${U.fmtPct(empRate(last))} ${since ? delta(Math.round(empRate(last) * 100), Math.round(empRate(then) * 100), v => T('pn.pts', { v })) : ''}</span></div>
        <div><span class="muted">${esc(T('pn.t.jobless'))}</span><span>${last.unemployed} ${since ? delta(last.unemployed, then.unemployed, v => v, true) : ''}</span></div>
        <div><span class="muted">${esc(T('pn.t.firms'))}</span><span>${last.businesses} ${since ? delta(last.businesses, then.businesses, v => v) : ''}</span></div>
      </div>${since ? `<div class="note">${esc(T('pn.changes', { since }))}</div>` : ''}` : '';
    return `<div class="card glance"><h3><span>${esc(T('pn.glance', { town: LES.townName(w) }))}</span><button class="ghost help-btn ${UI.helpOpen ? 'on' : ''}" data-ui="help" title="${esc(T('pn.help.tip'))}" aria-expanded="${UI.helpOpen ? 'true' : 'false'}">?</button></h3>
        ${UI.helpOpen ? `<div class="glance-help">${UI.helpHtml(w)}</div>` : ''}
        <div class="glance-sec">${esc(w.winner ? T('pn.goalReached') : T('pn.closest', { amt: U.fmtMoney(goal) }))}</div>${raceHtml}
        <div class="glance-sec">${esc(evTitle)}</div>${evHtml}
        <div class="glance-sec">${esc(T('pn.trends'))}</div>${trends}
        <p class="muted" style="margin:8px 0 0">${esc(T('pn.clickName'))}</p></div>`;
  };

  // Person toolbar: the main actions as icon buttons (tooltips + labels for screen readers),
  // the rest in a "More" menu. Every button keeps its data-act, so app.action and the F/Esc keys work as before.
  UI.moreOpen = false;
  UI.toolbarHtml = function (app, p) {
    if (UI.moreFor !== p.id) { UI.moreOpen = false; UI.moreFor = p.id; }
    const S = LES.Spectator, mk = S ? S.mark(p.id) : null;
    const btn = (act, icon, label, tip, on) => `<button class="tb ${on ? 'on' : ''}" data-act="${act}" title="${esc(tip)}" aria-label="${esc(label)}"${on !== undefined ? ` aria-pressed="${on ? 'true' : 'false'}"` : ''}><span aria-hidden="true">${icon}</span></button>`;
    const main = [];
    if (p.alive) main.push(btn('follow', '🎥', T(app.renderer.follow ? 'pn.tb.unfollow' : 'pn.tb.follow'), T(app.renderer.follow ? 'pn.tb.unfollow.tip' : 'pn.tb.follow.tip'), !!app.renderer.follow));
    const pinned = app.pinned === p.id;
    main.push(btn(pinned ? 'unpin' : 'pin', '⚖️', T(pinned ? 'pn.tb.unpin' : 'pn.tb.pin'), T(pinned ? 'pn.tb.unpin.tip' : 'pn.tb.pin.tip'), pinned));
    if (S) {
      main.push(btn('spotlight', '🔦', T('pn.tb.spot'), T('pn.tb.spot.tip'), S.spotlight === p.id));
      main.push(btn('bookmark', '🔖', T('pn.tb.mark'), T('pn.tb.mark.tip'), !!(mk && !mk.family)));
    }
    const more = [];
    if (S) {
      more.push(`<button role="menuitemcheckbox" aria-checked="${mk && mk.family ? 'true' : 'false'}" class="${mk && mk.family ? 'on' : ''}" data-act="bookmarkFamily" title="${esc(T('pn.tb.markFam.tip'))}">👪 ${esc(T('pn.tb.markFam'))}${mk && mk.family ? ' ✓' : ''}</button>`);
      if (p.alive) more.push(`<button role="menuitem" data-act="celebrate" title="${esc(T('pn.tb.party.tip'))}">🎉 ${esc(T('pn.tb.party'))}</button>`);
    }
    if (p.alive && LES.God) more.push(`<button role="menuitem" data-act="fate" title="${esc(T('pn.tb.fate.tip'))}">⚠️ ${esc(T('pn.tb.fate'))}</button>`);
    const moreHtml = more.length ? `<div class="p-more">
        <button class="tb more ${UI.moreOpen ? 'on' : ''}" data-ui="more" aria-haspopup="menu" aria-expanded="${UI.moreOpen ? 'true' : 'false'}" title="${esc(T('pn.tb.more.tip'))}">${esc(T('pn.tb.more'))} ▾</button>
        ${UI.moreOpen ? `<div class="p-more-menu" role="menu">${more.join('')}</div>` : ''}</div>` : '';
    return `<div class="p-toolbar" role="toolbar" aria-label="${esc(T('pn.tb.aria', { name: P.name(p) }))}">${main.join('')}${moreHtml}<span class="sp"></span>${btn('deselect', '✕', T('pn.tb.close'), T('pn.tb.close.tip'))}</div>`;
  };
  // Re-renders replace the panel's HTML: keep keyboard focus on the same control.
  UI.focusKey = function (el) {
    const a = document.activeElement;
    if (!a || !el.contains(a)) return null;
    if (a.dataset.act) return `[data-act="${a.dataset.act}"]`;
    if (a.dataset.ui) return `[data-ui="${a.dataset.ui}"]`;
    return null;
  };
  UI.restoreFocus = function (el, key) {
    const want = UI.focusNext || key;
    UI.focusNext = null;
    if (!want) return;
    const t = el.querySelector(want) || (key && el.querySelector(key));
    if (t) t.focus({ preventScroll: true });
  };
  UI.closeMore = function (refocus) {
    if (!UI.moreOpen) return;
    UI.moreOpen = false;
    if (refocus) UI.focusNext = '[data-ui="more"]';
    UI.update(true);
  };

  UI.regimeBands = function (w) {
    const bands = [];
    const hist = w.regimeHist;
    for (let i = 0; i < hist.length; i++) {
      const r = hist[i].regime;
      if (r === 'normal') continue;
      const x0 = hist[i].day / 365, x1 = (i + 1 < hist.length ? hist[i + 1].day : w.day) / 365;
      bands.push({ x0, x1, color: r === 'recession' ? 'rgba(231,111,81,0.13)' : 'rgba(62,199,181,0.08)' });
    }
    return bands;
  };

  // ---------------- Side panel width ----------------
  // Drag the panel's left edge (or focus it and use the arrow keys) to resize; double-click resets.
  // The width is kept per browser. Phones (stacked layout) ignore it.
  const SIDE_KEY = 'les-side-width', SIDE_MIN = 320;
  UI.initResize = function (app) {
    const side = $('side');
    if (!side || $('side-grip')) return;
    const grip = document.createElement('div');
    grip.id = 'side-grip';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.setAttribute('aria-label', T('pn.grip'));
    grip.tabIndex = 0;
    grip.title = T('pn.grip.tip');
    side.prepend(grip);
    window.addEventListener('les-lang', () => { grip.setAttribute('aria-label', T('pn.grip')); grip.title = T('pn.grip.tip'); }); // PL-17
    const maxW = () => Math.max(SIDE_MIN, Math.min(900, window.innerWidth * 0.6));
    let raf = 0;
    const apply = (px, save) => {
      if (px === null) side.style.removeProperty('--side-w');
      else side.style.setProperty('--side-w', `${Math.round(U.clamp(px, SIDE_MIN, maxW()))}px`);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; window.dispatchEvent(new Event('resize')); UI.update(true); });
      if (save) try { if (px === null) localStorage.removeItem(SIDE_KEY); else localStorage.setItem(SIDE_KEY, String(Math.round(px))); } catch (e) { /* private window: this session only */ }
    };
    try { const v = Number(localStorage.getItem(SIDE_KEY)); if (v >= SIDE_MIN) apply(v, false); } catch (e) { /* storage blocked */ }
    let drag = null;
    grip.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, w: side.getBoundingClientRect().width };
      grip.setPointerCapture(e.pointerId); grip.classList.add('dragging'); e.preventDefault();
    });
    grip.addEventListener('pointermove', e => { if (drag) apply(drag.w + (drag.x - e.clientX), false); });
    const end = () => { if (!drag) return; drag = null; grip.classList.remove('dragging'); apply(side.getBoundingClientRect().width, true); };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => apply(null, true));
    grip.addEventListener('keydown', e => {
      const d = e.key === 'ArrowLeft' ? 24 : e.key === 'ArrowRight' ? -24 : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      apply(side.getBoundingClientRect().width + d, true);
    });
  };

  // ---------------- Leaderboard ----------------
  // Key to the coloured squares in the lists: each person's money strategy.
  UI.strategyLegend = () => `<div class="lb-legend" title="${esc(T('pn.legend.tip'))}"><b>${esc(T('pn.legend'))}</b> ${C.STRATEGIES.map(st => `<span><i style="background:${C.STRATEGY_COLORS[st]}"></i>${esc(G(C.STRATEGY_NAMES[st]))}</span>`).join('')}</div>`;
  UI.renderLeaders = function (force) {
    const app = UI.app, w = app.world;
    if (UI.lbMode === 'cast' && UI.renderCast) { UI.renderCast(force); return; } // My cast (js/ui/cast-ui.js)
    if (UI.lbMode === 'marks' && LES.Spectator) { // bookmarks (spectator tools)
      LES.Spectator.sync(w);
      const ms = LES.Spectator.marks.filter(m => w.people[m.id]);
      $('lb-list').innerHTML = ms.length ? UI.strategyLegend() + ms.map(m => { const p = w.people[m.id]; return `<div class="lb-row ${p.id === app.selected ? 'sel' : ''}" data-pid="${p.id}"><span class="rank">🔖</span><span class="dot" style="background:${C.STRATEGY_COLORS[p.strategy]}"></span><span><div class="nm">${esc(P.name(p))}${m.family ? ` <span class="muted">${esc(T('pn.lb.plusFam'))}</span>` : ''}</div><div class="sub">${esc(T('pn.lb.marked', { age: Math.floor(P.age(w, p)), year: U.dayToDate(m.day).year }))}</div></span><span class="val">${p.alive ? (p.away ? esc(T('pn.lb.away')) : U.fmtMoney(p.nw)) : esc(T('pn.lb.died'))}</span></div>`; }).join('') : `<p class="note">${esc(T('pn.lb.noMarks'))}</p>`;
      return;
    }
    const q = $('search').value.trim().toLowerCase();
    let list;
    if (q) list = w.people.filter(p => P.name(p).toLowerCase().includes(q)).sort((a, b) => (b.alive - a.alive) || (b.nw - a.nw)).slice(0, 60);
    else {
      // Several scoreboards: not everyone is racing for money.
      const body = p => (p.att[C.STR] + p.att[C.END] + p.att[C.AGI]) / 3;
      const kids = p => p.children.filter(id => w.people[id].alive).length;
      const adults = w.living.filter(p => p.alive && p.adult);
      const by = {
        alive: [adults, p => p.nw], all: [w.people.filter(p => p.adult || !p.alive), p => p.peakNw],
        happy: [adults, p => p.happy], family: [w.living.filter(p => p.alive && p.adult), kids],
        fit: [adults, body], goals: [w.people.filter(p => p.adult), p => p.goalsDone.length],
      }[UI.lbMode] || [adults, p => p.nw];
      if (UI.lbMode === 'poor') list = adults.filter(p => !p.away).sort((a, b) => (a.nw - b.nw) || (a.id - b.id)).slice(0, 10); // lowest net worth first
      else list = by[0].slice().sort((a, b) => (by[1](b) - by[1](a)) || (b.nw - a.nw)).slice(0, 50);
    }
    const val = p => {
      if (q) return U.fmtMoney(p.nw);
      switch (UI.lbMode) {
        case 'all': return U.fmtMoney(p.peakNw);
        case 'happy': return `😊 ${Math.round(p.happy)}`;
        case 'family': return `👶 ${p.children.filter(id => w.people[id].alive).length}`;
        case 'fit': return `💪 ${((p.att[C.STR] + p.att[C.END] + p.att[C.AGI]) / 3).toFixed(1)}`;
        case 'goals': return `🎯 ${p.goalsDone.length}`;
        default: return U.fmtMoney(p.nw);
      }
    };
    const legend = UI.strategyLegend();
    $('lb-list').innerHTML = (list.length ? legend : '') + list.map((p, i) => `
      <div class="lb-row ${p.id === app.selected ? 'sel' : ''}" data-pid="${p.id}">
        <span class="rank ${i < 3 && !q ? 'top' : ''}">${q ? '' : i + 1}</span>
        <span class="dot" style="background:${C.STRATEGY_COLORS[p.strategy]}" title="${esc(G(C.STRATEGY_NAMES[p.strategy]))}"></span>
        <span><div class="nm">${p.custom ? `<span class="pos" title="${esc(T('pn.lb.cast'))}">★</span> ` : ''}${esc(P.name(p))}${p.alive ? '' : ' <span class="muted">†</span>'}</div>
          <div class="sub">${esc(T('pn.lb.sub', { age: Math.floor(P.age(w, p)), what: p.goal ? `${LES.Goals.DEFS[p.goal.id].icon} ${G(LES.Goals.DEFS[p.goal.id].name)}` : G(C.STRATEGY_NAMES[p.strategy]), via: UI.mainSource(p) }))}${p.gen ? ` · ${esc(T('pn.lb.gen', { gen: p.gen }))}` : ''}</div></span>
        <span class="val">${val(p)}</span>
      </div>`).join('') || `<p class="muted">${esc(T('pn.lb.none'))}</p>`;
  };

  // ---------------- Events feed ----------------
  UI.renderFeed = function () {
    const w = UI.app.world;
    const f = UI.feedFilter;
    const rows = [];
    for (let i = w.feed.length - 1; i >= 0 && rows.length < 250; i--) {
      const e = w.feed[i];
      if (f === 'cast' ? !(e.pid >= 0 && w.people[e.pid].custom) : f !== 'all' && !(e.cat === f || (f === 'wealth' && e.cat === 'money'))) continue;
      if (f === 'all' && e.cat === 'money' && CUTBACK.test(e.text)) continue; // (old saves) these are under Wealth
      const name = e.pid >= 0 ? `<span class="nm">${esc(P.name(w.people[e.pid]))}</span> — ` : '';
      rows.push(`<div class="feed-row imp${e.imp}" data-pid="${e.pid}"><span class="when">${U.fmtMonthYear(e.day)}</span><span>${CAT_ICON[e.cat] || '•'}</span><span class="txt">${name}${esc(LES.I18n.render(e.text))}</span></div>`);
    }
    $('feed-list').innerHTML = rows.join('') || `<p class="muted">${esc(T('pn.feed.empty'))}</p>`;
  };

  // ---------------- Stats ----------------
  // Side-by-side comparison of the towns in a region, with the flows between them.
  const gangCell = t => { if (!t.crime) return '–'; const c = LES.Crime.gangCount(t); return `${c.live}${c.chapters ? ` <small class="muted">(${c.chapters} ch.)</small>` : ''}`; };
  UI.regionCard = function (w) {
    const R = UI.app.region;
    if (!R) return '';
    const com = R.commuters(), moves = R.moves, rows = R.towns.map((t, i) => {
      const h = t.history[t.history.length - 1] || {}, a = t.living.filter(p => p.alive && p.adult);
      const wages = a.filter(p => p.job).map(p => p.job.salary).sort((x, y) => x - y);
      const inn = moves.filter(m => m.to === i).reduce((s, m) => s + m.n, 0), out = moves.filter(m => m.from === i).reduce((s, m) => s + m.n, 0);
      const crime = t.crime ? Math.round(LES.Crime.rates(t).index) : null;
      return `<tr class="${t === w ? 'on' : ''}"><td><a href="#" data-xtown="${i}" data-xid="-1">${U.esc(LES.townName(t))}</a></td><td>${t.counts.living}</td><td>${h.unemployed !== undefined ? (h.unemployed / Math.max(1, h.unemployed + h.employed + h.owners) * 100).toFixed(1) + '%' : '–'}</td><td>${wages.length ? U.fmtMoney(U.quantile(wages, 0.5)) : '–'}</td><td>${U.fmtMoney(h.median || 0)}</td><td>${t.rentMult ? Math.round(t.rentMult[1] * 100) : 100}</td><td>${crime === null ? '–' : crime}</td><td>${gangCell(t)}</td><td>${com[i]}</td><td>+${inn} / −${out}</td></tr>`;
    }).join('');
    const th = (k, tip) => `<th${tip ? ` title="${esc(T(`pn.rg.${k}.tip`))}"` : ''}>${esc(T(`pn.rg.${k}`))}</th>`;
    return `<div class="card"><h3>${esc(T('pn.rg.title'))}</h3><div style="overflow-x:auto"><table class="cmp region-cmp"><tr>${th('town')}${th('pop')}${th('jobless')}${th('pay')}${th('wealth')}${th('rent')}${th('crime')}${th('gangs', 1)}${th('comm', 1)}${th('inout', 1)}</tr>${rows}</table></div>
      <div class="note">${esc(T('pn.rg.note'))}</div></div>`;
  };

  UI.renderStats = function () {
    const w = UI.app.world, el = $('tab-stats');
    const h = w.history;
    const last = h[h.length - 1];
    const st = w.stats;
    const xs = x => T('rp.yr', { n: Math.floor(x) + 1 });
    const series = (k, label, color) => ({ label: T(label), color, data: h.map(r => [r.day / 365, r[k]]) });
    const race = w.living.filter(p => p.alive && p.adult).sort((a, b) => P.goalWorth(w, b) - P.goalWorth(w, a)).slice(0, 5);
    const scn = LES.Scenarios.current(w);
    el.innerHTML = `${UI.app.region ? '' : `<div class="tab-tools"><button class="ghost" data-act="compare">${LES.icon('compare', 16)} ${esc(T('end.compare', { label: G(LES.Compare.label(w.cfg)) }))}</button></div>`}${UI.regionCard(w)}
      ${scn ? `<div class="card"><h3><span>${LES.icon(scn.icon, 14)} ${esc(T('pn.st.scenario', { name: G(scn.name) }))}</span></h3><div class="note">${U.esc(G(scn.short))}</div><div class="scn-status">${scn.status(w)}</div><canvas class="chart" id="st-scn"></canvas></div>` : ''}
      <div class="stat-grid">
        <div class="stat"><div class="v">${last.pop}</div><div class="l">${esc(T('pn.st.alive', { kids: last.children }))}</div></div>
        <div class="stat"><div class="v">${U.fmtMoney(last.median)}</div><div class="l">${esc(T('pn.st.median'))}</div></div>
        <div class="stat"><div class="v">${last.millionaires}</div><div class="l">${esc(T('pn.kpi.millionaires'))}</div></div>
        <div class="stat"><div class="v">${st.births}/${st.deaths}</div><div class="l">${esc(T('pn.st.births'))}</div></div>
        <div class="stat"><div class="v">${st.bizStarted}/${st.bizFailed}</div><div class="l">${esc(T('pn.st.biz'))}</div></div>
        <div class="stat"><div class="v">${st.graduations}</div><div class="l">${esc(T('pn.st.grads'))}</div></div>
      </div>
      <div class="card"><h3>${esc(T('pn.st.race', { amt: U.fmtMoney(w.goal) }))}${w.cfg.goalMode === 'real' ? ` <small class="muted">${esc(T('pn.st.y1'))}</small>` : ''}</h3><ul class="list-plain">
        ${race.map(p => `<li><span>${UI.plink(w, p.id)} <span class="muted">${Math.floor(P.age(w, p))} · ${esc(G(C.STRATEGY_NAMES[p.strategy]))}</span></span><span>${U.fmtMoney(P.goalWorth(w, p))} <span class="muted">${UI.goalShare(w, P.goalWorth(w, p))}</span></span></li>`).join('')}</ul>
        ${UI.firstsHtml(w)}
        ${w.winner ? `<div class="note">🏆 ${T('pn.st.first', { name: UI.plink(w, w.winner.pid), year: U.dayToDate(w.winner.day).year, age: w.winner.age })}</div>` : ''}</div>
      <div class="card"><h3>${esc(T('pn.st.goals'))} <small class="muted">${esc(T('pn.st.goalsSub', { v: Math.round(last.happy || 0) }))}</small></h3><canvas class="chart" id="st-goals"></canvas>
        <div class="note">${esc(T('pn.st.goalsNote'))}</div></div>
      <div class="card"><h3>${esc(T('pn.happiness'))} <small class="muted">${esc(T('pn.st.happySub'))}</small></h3><canvas class="chart" id="st-happy"></canvas></div>
      <div class="card"><h3>${esc(T('pn.st.wealth'))} <small class="muted">${esc(T('pn.st.wealthSub'))}</small></h3><canvas class="chart tall" id="st-wealth"></canvas></div>
      <div class="card"><h3>${esc(T('pn.st.byStrat'))} <small class="muted">${esc(T('pn.st.byStratSub'))}</small></h3><canvas class="chart" id="st-strat"></canvas>
        <div class="note">${esc(T('pn.st.byStratNote'))}</div></div>
      <div class="card"><h3>${esc(T('pn.st.pop'))}</h3><canvas class="chart" id="st-pop"></canvas></div>
      <div class="card"><h3>${esc(T('pn.st.work'))}</h3><canvas class="chart" id="st-work"></canvas></div>
      <div class="card"><h3>${esc(LES.Countries.pack.names.exchange)} <small class="muted">${esc(T('pn.st.mktSub', { pct: (w.mkt.alpha * 100).toFixed(1) }))}</small></h3><canvas class="chart" id="st-mkt"></canvas>
        <div class="note">${esc(T('pn.st.mktNote', { n: st.panicSells, out: `${U.sym()}${(w.cfg.marketOutsideRM / 1e6).toFixed(0)}M`, cap: w.cfg.marketInfluenceCap }))}</div></div>
      <div class="card"><h3>${esc(T('pn.st.prices'))} <small class="muted">${esc(T('pn.st.pricesSub', { x: w.price.toFixed(2) }))}</small></h3><canvas class="chart" id="st-infl"></canvas></div>
      <div class="card"><h3>${esc(T('pn.st.mig'))} <small class="muted">${esc(T('pn.st.migSub', { p: w.townMood.pressure.toFixed(2), o: w.townMood.opportunity.toFixed(2), full: (w.crowding * 100).toFixed(0) }))}</small></h3><canvas class="chart" id="st-mig"></canvas>
        <div class="grid2"><div><span class="muted">${esc(T('pn.st.in'))}</span><span>${st.immigrants}</span></div><div><span class="muted">${esc(T('pn.st.out'))}</span><span>${st.emigrants}</span></div><div><span class="muted">${esc(T('pn.st.back'))}</span><span>${st.returns}</span></div><div><span class="muted">${esc(T('pn.st.awayNow'))}</span><span>${w.counts.away || 0}</span></div></div></div>
      <div class="card"><h3>${esc(T('pn.st.events'))}</h3><div class="grid2">
        ${[['couples', st.couples], ['breakups', st.breakups], ['twins', st.twins], ['welfareKids', st.welfareKids], ['hires', st.hires], ['promotions', st.promotions], ['laidOff', `${st.laidOff}/${st.fired}`], ['dropouts', st.dropouts], ['scholarships', st.scholarships], ['booms', st.booms], ['bankruptcies', st.bankruptcies], ['accidents', st.catastrophes], ['illnesses', st.illnesses], ['windfalls', `${st.windfalls}/${st.scams}`]].map(([k, v]) => `<div><span class="muted">${esc(T(`pn.ev.${k}`))}</span><span>${v}</span></div>`).join('')}
      </div></div>
      <p><button class="ghost" data-act="csv">${esc(T('pn.st.csv'))}</button> <button class="ghost" data-act="report">${esc(T('pn.st.report'))}</button></p>
      <p class="note">${esc(T('pn.st.disclaimer', { seed: w.cfg.seed }))}</p>`;
    if (scn && $('st-scn')) LES.Charts.line($('st-scn'), { series: scn.series(h), xFmt: xs, yMin: scn.logY ? undefined : 0, logY: !!scn.logY, yFmt: scn.logY ? LES.Charts.fmtAxisMoney : undefined });
    LES.Charts.line($('st-wealth'), {
      series: [series('top', 'pn.ch.richest', '#f2c14e'), series('p90', 'pn.ch.top10', '#3ec7b5'), series('median', 'pn.ch.median', '#5aa9e6')].map(s => ({ ...s, data: s.data.map(([x, y]) => [x, Math.max(0, y)]) })),
      logY: true, yFmt: LES.Charts.fmtAxisMoney, xFmt: xs, bands: UI.regimeBands(w),
    });
    const GD = LES.Goals.DEFS;
    const goalIds = LES.Goals.IDS.filter(id => LES.C.expOn(w, GD[id])), gc = $('st-goals');
    if (gc) gc.style.height = (goalIds.length * 22 + 8) + 'px'; // one roomy row per goal
    LES.Charts.bars(gc, goalIds.map(id => ({ label: `${GD[id].icon} ${G(GD[id].name)}`, value: st.goalsAchieved[id] || 0, color: '#f2c14e' })), v => String(v));
    LES.Charts.line($('st-happy'), { series: [{ label: T('pn.ch.medHappy'), color: '#f2c14e', data: h.filter(r => r.happy !== undefined).map(r => [r.day / 365, r.happy]) }], xFmt: xs, yMin: 0 });
    LES.Charts.bars($('st-strat'), C.STRATEGIES.map(s => ({ label: G(C.STRATEGY_NAMES[s]), value: last.stratMedian[s], color: C.STRATEGY_COLORS[s] })), v => U.fmtMoney(v));
    LES.Charts.line($('st-pop'), { series: [series('pop', 'pn.ch.total', '#e8edf2'), series('adults', 'pn.ch.adults', '#5aa9e6'), series('children', 'pn.ch.children', '#f28482')], xFmt: xs, yMin: 0 });
    const mk = w.mkt, step = Math.max(1, Math.floor(mk.idxHist.length / 600));
    const idxData = [];
    for (let i = 0; i < mk.idxHist.length; i += step) idxData.push([mk.dayHist[i] / 365, mk.idxHist[i]]);
    LES.Charts.line($('st-mkt'), { series: [{ label: T('pn.ch.index', { name: LES.Countries.pack.names.exchangeShort }), color: '#57d38c', data: idxData }], logY: true, yFmt: v => v.toFixed(0), xFmt: xs, bands: UI.regimeBands(w) });
    LES.Charts.line($('st-infl'), { series: [{ label: T('pn.ch.infl'), color: '#f4a261', data: h.map(r => [r.day / 365, (r.infl || 0) * 100]) }, { label: T('pn.ch.price'), color: '#e8edf2', data: h.map(r => [r.day / 365, r.price || 1]) }], xFmt: xs, yFmt: v => v.toFixed(1) });
    LES.Charts.line($('st-mig'), { series: [series('migrants', 'pn.ch.migrants', '#5aa9e6'), series('away', 'pn.ch.away', '#ff8c42')], xFmt: xs, yMin: 0 });
    LES.Charts.line($('st-work'), { series: [series('employed', 'pn.ch.employed', '#57d38c'), series('unemployed', 'pn.ch.unemployed', '#ff6b6b'), series('owners', 'pn.ch.owners', '#ff8c42'), series('students', 'pn.ch.students', '#b892ff')], xFmt: xs, yMin: 0 });
  };

  // ---------------- Director mode ----------------
  // Picks the most interesting recent events (only things that really happened),
  // flies the camera to the person and shows a caption with context from their life.
  // At 1 day/s or faster a shot runs in slow motion (60x = 1 sim hour per second) so the
  // viewer can actually follow the person, then the user's speed comes back and the town
  // runs at full speed for a while before the next shot.
  const DIRECTOR_SHOT_MS = 9000, DIRECTOR_GAP_MS = 6000, SLOWMO_SPEED = 2, FAST_FROM = 3;
  UI.director = { on: false, queue: [], until: 0, resumeSpeed: null, nextShot: 0 };
  UI.directorTick = function (now) {
    const d = UI.director, app = UI.app, w = app.world;
    if (now >= d.until && d.resumeSpeed !== null) {
      const back = d.resumeSpeed;
      d.resumeSpeed = null;
      if (!app.paused) app.setSpeed(back, true);
      d.nextShot = now + DIRECTOR_GAP_MS;
    }
    if (app.view === 'region') return; // the director films a town, not the region map
    if (!d.on || now < d.until || now < d.nextShot || !d.queue.length) { if (now >= d.until) $('caption').classList.add('hidden'); return; }
    d.queue.sort((a, b) => b.imp - a.imp || b.seq - a.seq);
    const e = d.queue.shift();
    d.queue = d.queue.filter(x => w.day - x.day < 120).slice(0, 12);
    const p = w.people[e.pid];
    if (!p || !p.alive || p.away) return;
    app.select(p.id, true);
    app.renderer.follow = true;
    const age = Math.floor(P.age(w, p));
    const past = p.log.filter(x => x.day < e.day - 300 && x.imp >= 1).slice(-1)[0];
    const pastTxt = past ? (LES.I18n.lang() === 'en' ? `${past.text.charAt(0).toLowerCase()}${past.text.slice(1)}` : LES.I18n.render(past.text)) : '';
    const ctx = past ? T('pn.dir.earlier', { n: Math.max(1, Math.round((e.day - past.day) / 365)), text: pastTxt }) : T('pn.dir.ctx', { strat: G(C.STRATEGY_NAMES[p.strategy]), amt: U.fmtMoney(p.nw) });
    $('caption').innerHTML = `<div class="cap-when">${U.fmtDate(e.day)} · ${esc(P.name(p))}, ${age}</div><div class="cap-text">${esc(LES.I18n.render(e.text))}</div><div class="cap-ctx">${esc(ctx)}</div>`;
    $('caption').classList.remove('hidden');
    d.until = now + DIRECTOR_SHOT_MS;
    if (!app.paused && app.speedIdx >= FAST_FROM) {
      d.resumeSpeed = app.speedIdx;
      app.setSpeed(SLOWMO_SPEED, true);
      app.dayFrac = Math.min(app.dayFrac, 0.3); // start the shot in the morning, not at night
    }
  };

})(globalThis.LES = globalThis.LES || {});
