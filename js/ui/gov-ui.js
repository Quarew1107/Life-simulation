// Government tab (leader, approval, laws, treasury, elections, police, events) and the
// person panel's politics card.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, C = LES.C, UI = LES.UI, GV = LES.Gov;
  const $ = id => document.getElementById(id);
  const esc = U.esc, pct = x => `${Math.round(x * 100)}%`;
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s), t = (k, p) => esc(T(k, p)); // PL-17
  const lean = p => p && p.pol ? `${T(p.pol.econ > 0.25 ? 'gv.right' : p.pol.econ < -0.25 ? 'gv.left' : 'gv.centre')} · ${T(p.pol.soc > 0.25 ? 'gv.liberal' : p.pol.soc < -0.25 ? 'gv.conservative' : 'gv.moderate')}` : '—';

  function breakdown(w, e, grp, names) {
    const keys = Object.keys(e.by[grp]).filter(k => k !== '-');
    if (!keys.length) return '';
    return `<table class="cmp"><tr><th></th>${e.cands.map(c => `<th><span style="color:${c.colour}">■</span> ${esc(c.name.split(' ')[0])}</th>`).join('')}</tr>
      ${keys.map(k => { const t = e.by[grp][k], n = Object.values(t).reduce((a, b) => a + b, 0); return `<tr><td class="muted">${esc(G(names ? names[k] || k : k))}</td>${e.cands.map((c, i) => `<td>${n ? pct((t[i] || 0) / n) : '–'}</td>`).join('')}</tr>`; }).join('')}</table>`;
  }

  UI.renderGov = function () {
    const w = UI.app.world, el = $('tab-gov');
    if (!w.gov) { el.innerHTML = `<div class="card"><h3>${t('gv.title')}</h3><p class="note">${T('gv.offHtml')}</p></div>`; return; }
    const g = w.gov, title = G(GV.title(w)), pres = g.president >= 0 ? w.people[g.president] : null, EVN = LES.Countries.pack.events || {};
    const h = w.history.filter(r => r.gov), xs = x => `Y${Math.floor(x) + 1}`;
    const last = g.elections[g.elections.length - 1];
    const changed = key => { for (let i = g.lawLog.length - 1; i >= 0; i--) if (g.lawLog[i].key === key) return g.lawLog[i]; return null; };
    const days = g.electionDay - w.day;
    el.innerHTML = `
      <div class="card"><h3>${t('gv.of', { title, town: LES.townName(w) })}</h3>
        ${pres ? `<div class="grid2"><div><span class="muted">${esc(title)}</span><span>${UI.plink(w, pres.id)}</span></div><div><span class="muted">${t('gv.leaning')}</span><span>${esc(lean(pres))}</span></div>
          <div><span class="muted">${t('gv.inOffice')}</span><span>${t('gv.term', { date: U.fmtMonthYear(g.termStart), n: g.terms[pres.id] || 1 })}</span></div><div><span class="muted">${t('gv.approval')}</span><span class="${g.approval < 40 ? 'neg' : g.approval >= 60 ? 'pos' : ''}">${g.approval}%</span></div></div>` : `<p class="note">${t(GV.appointed() ? 'gv.vacantAppoint' : 'gv.vacantBy')}</p>`}
        <div class="note">${GV.appointed() ? t('gv.noElections', { title, years: w.cfg.termYears, date: U.fmtMonthYear(g.electionDay - 60) }) : g.campaign ? `🗳️ ${t('gv.campaign', { date: U.fmtDate(g.electionDay) })}` : t('gv.nextElection', { date: U.fmtMonthYear(g.electionDay), months: Math.max(0, Math.round(days / 30)) })} ${g.scandals ? t('gv.scandals', { count: g.scandals }) : ''}</div>
        <canvas class="chart" id="gv-appr"></canvas></div>
      ${councilCard(w)}
      <div class="card"><h3>${t('gv.laws')}</h3><table class="cmp"><tr><th>${t('gv.law')}</th><th>${t('gv.now')}</th><th>${t('gv.since')}</th></tr>
        ${GV.LAWS.map(l => { const c = changed(l.key); return `<tr><td>${esc(G(l.name))}</td><td>${esc(G(GV.optName(l.key, g.laws[l.key])))}</td><td class="muted">${c ? `${U.fmtMonthYear(c.day)}${c.why === 'emergency' ? ` (${t('gv.emergency')})` : c.why === 'austerity' ? ` (${t('gv.austerity')})` : ''}` : t('gv.start')}</td></tr>`; }).join('')}</table>
        <div class="note">${G(LES.Countries.pack.notes.laws)}</div></div>
      <div class="card"><h3>${t('gv.treasury')} <small class="muted">${t('pn.st.y1')}</small></h3>
        <div class="stat-grid"><div class="stat"><div class="v">${U.fmtMoney(g.treasury.cash)}</div><div class="l">${t('gv.inTreasury')}</div></div><div class="stat"><div class="v ${g.debt ? 'neg' : ''}">${U.fmtMoney(g.debt)}</div><div class="l">${t('gv.debt')}</div></div><div class="stat"><div class="v">${U.fmtMoney(LES.Fiscal.fundValue(w))}</div><div class="l">${t('gv.fund', { name: LES.Countries.pack.names.fund })}</div></div>
          <div class="stat"><div class="v">${g.last ? U.fmtMoney(g.last.revTotal / Math.max(1, w.counts.living)) : '–'}</div><div class="l">${t('gv.revPer', { note: G(LES.Countries.pack.notes.revenue) })}</div></div>
          ${Object.keys(LES.Fiscal.FEDERAL_SHARE).length ? `<div class="stat"><div class="v">${g.last ? U.fmtMoney(g.last.federal || 0) : '–'}</div><div class="l">${t('gv.federal', { list: Object.entries(LES.Fiscal.FEDERAL_SHARE).map(([k, v]) => T('gv.pctOf', { pct: Math.round(v * 100), what: G(k) })).join(', ') })}</div></div>` : ''}</div>
        <canvas class="chart" id="gv-tre"></canvas>
        ${g.last ? `<table class="cmp"><tr><th>${t('gv.lastIn')}</th><th>${U.fmtMoney(g.last.revTotal)}</th><th>${t('gv.lastOut')}</th><th>${U.fmtMoney(g.last.spendTotal)}</th></tr>
          ${(() => { const a = Object.entries(g.last.rev).sort((x, y) => y[1] - x[1]), b = Object.entries(g.last.spend).sort((x, y) => y[1] - x[1]); const n = Math.max(a.length, b.length); let s = ''; for (let i = 0; i < n; i++) s += `<tr><td class="muted">${a[i] ? esc(G(a[i][0])) : ''}</td><td>${a[i] ? U.fmtMoney(a[i][1]) : ''}</td><td class="muted">${b[i] ? esc(G(b[i][0])) : ''}</td><td>${b[i] ? U.fmtMoney(b[i][1]) : ''}</td></tr>`; return s; })()}</table>` : ''}
        <div class="note">${G(LES.Countries.pack.notes.taxes)}</div></div>
      ${servicesCard(w)}
      ${moneyCard(w)}
      ${last && last.appointed ? `<div class="card"><h3>${t('gv.appointments')}</h3><ul class="list-plain">${g.elections.slice().reverse().slice(0, 12).map(e => `<li><span>${U.fmtMonthYear(e.day)} · ${UI.plink(w, e.winner)}</span><span class="muted">${esc(G(e.appointed || ''))}</span></li>`).join('')}</ul>
        <div class="note">${t('gv.agenda', { list: Object.keys(last.cands[0].platform).length ? Object.entries(last.cands[0].platform).map(([k, v]) => `${G(GV.LAW_BY_KEY[k].name)} → ${G(GV.optName(k, v))}`).join('; ') : T('gv.noChanges') })}</div></div>` : ''}
      ${last && !last.appointed ? `<div class="card"><h3>${t('gv.lastElection')} <small class="muted">${t('gv.turnout', { date: U.fmtDate(last.day), pct: last.eligible ? pct(last.voted / last.eligible) : '–' })}</small></h3>
        ${last.cands.map(c => `<div class="why-opt ${c.id === last.winner ? 'chosen' : ''}"><span><span style="color:${c.colour}">■</span> ${UI.plink(w, c.id)}${c.incumbent ? ` <span class="muted">(${t('gv.incumbent')})</span>` : ''}</span><div class="track"><i style="width:${last.voted ? (c.votes / last.voted * 100).toFixed(1) : 0}%;background:${c.colour}"></i></div><span class="pct">${c.votes}</span></div>
          <div class="note" style="margin:0 0 6px 10px">${t('gv.promised', { list: Object.keys(c.platform).length ? Object.entries(c.platform).map(([k, v]) => `${G(GV.LAW_BY_KEY[k].name)} → ${G(GV.optName(k, v))}`).join('; ') : T('gv.noChanges') })}</div>`).join('')}
        <h3 style="margin-top:10px">${t('gv.howVoted')}</h3>${breakdown(w, last, 'cls', LES.Society ? LES.Society.CLASS_SHORT : null)}${breakdown(w, last, 'rel', LES.Society ? Object.fromEntries(Object.entries(LES.Society.RELIGIONS).map(([k, v]) => [k, v.name])) : null)}${breakdown(w, last, 'eth', C.ETHNIC_NAMES)}
        <div class="note">${t('gv.voteNote')}</div></div>` : ''}
      ${g.elections.length > 1 && !last.appointed ? `<div class="card"><h3>${t('gv.past')}</h3><ul class="list-plain">${g.elections.slice().reverse().slice(1, 12).map(e => { const win = e.cands.find(c => c.id === e.winner); return `<li><span>${U.fmtMonthYear(e.day)} · ${UI.plink(w, e.winner)}${win && win.incumbent ? ` (${t('gv.reelected')})` : ''}</span><span class="muted">${t('gv.votes', { won: win ? win.votes : 0, voted: e.voted, pct: e.eligible ? pct(e.voted / e.eligible) : '–' })}</span></li>`; }).join('')}</ul></div>` : ''}
      <div class="card"><h3>${t('gv.events')}</h3><div class="grid2"><div><span class="muted">${esc(G(EVN.flood ? EVN.flood.name : 'Floods'))}</span><span>${g.floods}</span></div><div><span class="muted">${t('gv.episodes', { name: G(EVN.haze ? EVN.haze.name : 'Haze') })}</span><span>${g.hazes}</span></div>${EVN.tornado ? `<div><span class="muted">${esc(G(EVN.tornado.name))}</span><span>${g.tornadoes || 0}</span></div>` : ''}<div><span class="muted">${t('gv.estateTax')}</span><span>${U.fmtMoney(g.estateTaxTotal)}</span></div><div><span class="muted">${t('gv.stolen')}</span><span>${U.fmtMoney(g.skimmed)}</span></div></div>
        <div class="note">${G(LES.Countries.pack.notes.events)}</div></div>`;
    if (h.length) {
      LES.Charts.line($('gv-appr'), { series: [{ label: T('gv.ch.approval'), color: '#3ec7b5', data: h.map(r => [r.day / 365, r.gov.approval]) }], xFmt: xs, yMin: 0 });
      LES.Charts.line($('gv-q'), { series: [{ label: T('gv.ch.schools'), color: '#b892ff', data: h.map(r => [r.day / 365, (r.gov.eduQ || 1) * 100]) }, { label: T('gv.ch.health'), color: '#3ec7b5', data: h.map(r => [r.day / 365, (r.gov.healthQ || 1) * 100]) }, { label: T('gv.ch.infra'), color: '#f4a261', data: h.map(r => [r.day / 365, (r.gov.dev || 0) * 100]) }], xFmt: xs, yMin: 0 });
      LES.Charts.line($('gv-opr'), { series: [{ label: `${LES.Countries.pack.names.policyRate} %`, color: '#5aa9e6', data: h.map(r => [r.day / 365, (r.gov.opr || LES.Fiscal.MY_OPR) * 100]) }, { label: T('gv.ch.infl'), color: '#e76f51', data: (w.inflHist || []).map(x => [x.year - 1, x.rate * 100]) }], xFmt: xs, yMin: 0 });
      LES.Charts.line($('gv-fund'), { series: [{ label: LES.Countries.pack.names.fund, color: '#f2c14e', data: h.map(r => [r.day / 365, r.gov.fund || 0]) }, { label: T('gv.treasury'), color: '#57d38c', data: h.map(r => [r.day / 365, r.gov.treasury]) }], xFmt: xs, yMin: 0, yFmt: LES.Charts.fmtAxisMoney });
      LES.Charts.line($('gv-tre'), { series: [{ label: T('gv.ch.rev'), color: '#57d38c', data: h.map(r => [r.day / 365, r.gov.rev]) }, { label: T('gv.ch.spend'), color: '#ff8c42', data: h.map(r => [r.day / 365, r.gov.spend]) }, { label: T('gv.ch.debt'), color: '#e63946', data: h.map(r => [r.day / 365, r.gov.debt]) }], xFmt: xs, yMin: 0, yFmt: LES.Charts.fmtAxisMoney });
    }
  };

  // The three council officials and the council log.
  function councilCard(w) {
    const g = w.gov, CO = LES.Council;
    if (!g.officials) return '';
    const rows = CO.ORDER.map(role => {
      const o = g.officials[role], R = CO.ROLES[role];
      const who = !o ? `<span class="muted">${t('cr.vacant')}</span>` : o.id >= 0 ? UI.plink(w, o.id) : `${esc(o.name)} <span class="muted">(${t('gv.outside')})</span>`;
      const bar = o ? `<div class="track" style="width:90px;display:inline-block;vertical-align:middle"><i style="width:${Math.round(o.comp * 100)}%;background:${o.comp >= 0.6 ? '#57d38c' : o.comp >= 0.4 ? '#f2c14e' : '#e63946'}"></i></div> ${Math.round(o.comp * 100)}` : '';
      return `<tr><td><b>${esc(R.title)}</b><br><span class="muted">${esc(G(R.en))}</span></td><td>${who}${o && o.crony ? ` <span class="neg">· ${t('gv.crony')}</span>` : ''}${o ? `<br><span class="muted">${t('pn.since', { date: U.fmtMonthYear(o.since) })}</span>` : ''}</td><td>${bar}</td></tr>`;
    }).join('');
    const log = g.offLog.slice(-8).reverse().map(e => `<li><span>${esc(LES.I18n.render(e.text))}</span><span class="muted">${U.fmtMonthYear(e.day)}</span></li>`).join('');
    return `<div class="card"><h3>${t('gv.council')} <small class="muted">${t('gv.appointedBy', { title: G(GV.title(w)) })}</small></h3>
      <table class="cmp"><tr><th>${t('gv.post')}</th><th>${t('gv.holder')}</th><th>${t('gv.competence')}</th></tr>${rows}</table>
      <div class="note">${CO.ORDER.map(r => `<b>${esc(CO.ROLES[r].title)}</b>: ${esc(G(CO.ROLES[r].does))}`).join('<br>')}<br>${G(LES.Countries.pack.notes.council)}</div>
      ${log ? `<h3 style="margin-top:8px">${t('gv.councilLog')}</h3><ul class="list-plain">${log}</ul>` : ''}</div>`;
  }

  // Public services: staff against targets, quality, and private providers.
  function servicesCard(w) {
    const g = w.gov, st = g.staff || {}, pop = Math.max(1, w.counts.living);
    const NAMES = { police: 'gv.s.police', teacher: 'gv.s.teacher', nurse: 'gv.s.nurse', doctor: 'gv.s.doctor' };
    const rows = Object.keys(NAMES).map(k => st[k] ? `<tr><td>${t(NAMES[k])}</td><td>${st[k].have} / ${st[k].target}</td><td class="muted">${t('gv.per1000', { v: (st[k].have / pop * 1000).toFixed(1) })}</td></tr>` : '').join('');
    const priv = w.biz.filter(b => b.open && b.typeDef.staff);
    const pupils = w.living.filter(p => p.alive && p.school >= 0).length, pension = w.living.filter(p => p.alive && p.pension > 0).length;
    const eis = w.living.filter(p => p.alive && p.eis && !p.job && w.day < p.eis.until).length;
    return `<div class="card"><h3>${t('gv.services')}</h3>
      <table class="cmp"><tr><th>${t('gv.servants')}</th><th>${t('gv.filled')}</th><th></th></tr>${rows}</table>
      <div class="grid2"><div><span class="muted">${t('gv.schoolQ')}</span><span>${Math.round((g.eduQ || 1) * 100)}</span></div><div><span class="muted">${t('gv.healthQ')}</span><span>${Math.round((g.healthQ || 1) * 100)}</span></div>
        <div><span class="muted">${t('gv.ch.infra')}</span><span>${Math.round((g.devIdx || 0) * 100)} · ${t('gv.projects', { count: g.projects || 0 })}</span></div><div><span class="muted">${t('gv.training')}</span><span>${t('gv.trained', { now: g.trainees || 0, total: g.trained || 0 })}</span></div>
        <div><span class="muted">${t('gv.eis')}</span><span>${t('gv.people', { count: eis })}</span></div><div><span class="muted">${t('gv.pensioners')}</span><span>${pension}</span></div></div>
      <canvas class="chart" id="gv-q"></canvas>
      <h3 style="margin-top:8px">${t('gv.private')}</h3>
      ${priv.length ? `<ul class="list-plain">${priv.map(b => `<li><span><b>${esc(b.name)}</b> <span class="muted">${esc(G(b.typeDef.name))} · ${T('gv.owner', { name: UI.plink(w, b.founderId) })} · ${t('gv.staff', { count: w.living.filter(p => p.alive && p.job && p.job.biz === b.id).length })}${b.type === 'privschool' ? ` · ${t('gv.pupils', { count: w.living.filter(p => p.alive && p.school === b.id).length })}` : ''}</span></span><span>${t('pn.perMonth', { amt: U.fmtMoney(b.lastRevenue) })}</span></li>`).join('')}</ul>` : `<p class="note">${t('gv.noPrivate')}</p>`}
      <div class="note">${t('gv.servicesNote', { adj: G(LES.Countries.pack.adj), n: pupils })}</div></div>`;
  }

  // Bank Negara, the sovereign fund and government-linked companies.
  function moneyCard(w) {
    const g = w.gov, glc = w.mkt.stocks.filter(s => s.def.glc), f = g.fund;
    return `<div class="card"><h3>${esc(LES.Countries.pack.names.centralBank)} &amp; ${esc(LES.Countries.pack.names.fund)}</h3>
      <div class="grid2"><div><span class="muted">${t('gv.policyRate', { name: LES.Countries.pack.names.policyRate })}</span><span>${(g.opr * 100).toFixed(2)}%</span></div><div><span class="muted">${t('gv.rates')}</span><span>${(LES.Fiscal.depositRate(w) * 100).toFixed(2)}% / ${(LES.Fiscal.loanRate(w) * 100).toFixed(2)}%</span></div>
        <div><span class="muted">${t('gv.fundValue')}</span><span>${U.fmtMoney(LES.Fiscal.fundValue(w))}</span></div><div><span class="muted">${t('gv.putIn')}</span><span>${U.fmtMoney(f.invested)} / ${U.fmtMoney(f.drawn)}</span></div></div>
      <canvas class="chart" id="gv-opr"></canvas>
      <canvas class="chart" id="gv-fund"></canvas>
      ${glc.length ? `<table class="cmp"><tr><th>${t('gv.glc')}</th><th>${t('gv.price')}</th><th>${t('gv.dividend')}</th><th>${t('gv.fundHolds')}</th></tr>${glc.map(s => `<tr><td>${esc(s.def.name)} <span class="muted">${esc(s.tk)}</span></td><td>${U.fmtPrice(s.price)}</td><td>${Math.round(s.def.div * 100)}%</td><td>${U.fmtMoney((f.glc[s.tk] || 0) * s.price)}</td></tr>`).join('')}</table>` : `<p class="note">${G(LES.Countries.pack.notes.glcLater)}</p>`}
      <div class="note">${G(LES.Countries.pack.notes.bank)}</div></div>`;
  }

  UI.politicsCard = function (w, p) {
    if (!w.gov || !p.pol || !p.adult) return '';
    const g = w.gov, ran = g.elections.filter(e => e.cands.some(c => c.id === p.id));
    return `<div class="card"><h3>${t('gv.politics')}</h3><div class="grid2">
      <div><span class="muted">${t('gv.leaning')}</span><span>${esc(lean(p))}</span></div>
      ${g.president === p.id ? `<div><span class="muted">${t('gv.office')}</span><span class="pos">${esc(G(GV.title(w)))}</span></div>` : ''}
      ${g.officials ? Object.entries(g.officials).filter(([, o]) => o && o.id === p.id).map(([r]) => `<div><span class="muted">${t('gv.councilPost')}</span><span class="pos">${esc(LES.Council.ROLES[r].title)}</span></div>`).join('') : ''}
      ${p.pension > 0 ? `<div><span class="muted">${t('gv.pension')}</span><span>${t('pn.perMonth', { amt: U.fmtMoney(p.pension) })}</span></div>` : ''}
      ${ran.length ? (ran[0].appointed ? `<div><span class="muted">${t('gv.appointedLeader')}</span><span>${ran.length}×</span></div>` : `<div><span class="muted">${t('gv.stood')}</span><span>${t('gv.won', { n: ran.length, won: ran.filter(e => e.winner === p.id).length })}</span></div>`) : ''}
      ${p.pol.voted >= 0 && p.pol.voted !== undefined ? `<div><span class="muted">${t('gv.lastVoted')}</span><span>${U.fmtMonthYear(p.pol.voted)}</span></div>` : ''}
    </div></div>`;
  };
})(globalThis.LES = globalThis.LES || {});
