// Government tab (leader, approval, laws, treasury, elections, police, events) and the
// person panel's politics card.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, C = LES.C, UI = LES.UI, GV = LES.Gov;
  const $ = id => document.getElementById(id);
  const esc = U.esc, pct = x => `${Math.round(x * 100)}%`;
  const lean = p => p && p.pol ? `${p.pol.econ > 0.25 ? 'right' : p.pol.econ < -0.25 ? 'left' : 'centre'} · ${p.pol.soc > 0.25 ? 'liberal' : p.pol.soc < -0.25 ? 'conservative' : 'moderate'}` : '—';

  function breakdown(w, e, grp, names) {
    const keys = Object.keys(e.by[grp]).filter(k => k !== '-');
    if (!keys.length) return '';
    return `<table class="cmp"><tr><th></th>${e.cands.map(c => `<th><span style="color:${c.colour}">■</span> ${esc(c.name.split(' ')[0])}</th>`).join('')}</tr>
      ${keys.map(k => { const t = e.by[grp][k], n = Object.values(t).reduce((a, b) => a + b, 0); return `<tr><td class="muted">${esc(names ? names[k] || k : k)}</td>${e.cands.map((c, i) => `<td>${n ? pct((t[i] || 0) / n) : '–'}</td>`).join('')}</tr>`; }).join('')}</table>`;
  }

  UI.renderGov = function () {
    const w = UI.app.world, el = $('tab-gov');
    if (!w.gov) { el.innerHTML = '<div class="card"><h3>Government</h3><p class="note">There is no town government in this world. Turn on <b>Government &amp; elections</b> in New world.</p></div>'; return; }
    const g = w.gov, title = GV.title(w), pres = g.president >= 0 ? w.people[g.president] : null;
    const h = w.history.filter(r => r.gov), xs = x => `Y${Math.floor(x) + 1}`;
    const last = g.elections[g.elections.length - 1];
    const changed = key => { for (let i = g.lawLog.length - 1; i >= 0; i--) if (g.lawLog[i].key === key) return g.lawLog[i]; return null; };
    const days = g.electionDay - w.day;
    el.innerHTML = `
      <div class="card"><h3>${esc(title)} of ${esc(C.TOWN_NAME)}</h3>
        ${pres ? `<div class="grid2"><div><span class="muted">${esc(title)}</span><span>${UI.plink(w, pres.id)}</span></div><div><span class="muted">Leaning</span><span>${lean(pres)}</span></div>
          <div><span class="muted">In office since</span><span>${U.fmtMonthYear(g.termStart)} (term ${g.terms[pres.id] || 1})</span></div><div><span class="muted">Approval</span><span class="${g.approval < 40 ? 'neg' : g.approval >= 60 ? 'pos' : ''}">${g.approval}%</span></div></div>` : '<p class="note">The office is vacant: a by-election is coming.</p>'}
        <div class="note">${g.campaign ? `🗳️ Campaign under way: polling day ${U.fmtDate(g.electionDay)}.` : `Next election ${U.fmtMonthYear(g.electionDay)} (${Math.max(0, Math.round(days / 30))} months).`} ${g.scandals ? `${g.scandals} corruption scandal${g.scandals > 1 ? 's' : ''} so far.` : ''}</div>
        <canvas class="chart" id="gv-appr"></canvas></div>
      <div class="card"><h3>Laws in force</h3><table class="cmp"><tr><th>Law</th><th>Now</th><th>Since</th></tr>
        ${GV.LAWS.map(l => { const c = changed(l.key); return `<tr><td>${esc(l.name)}</td><td>${esc(GV.optName(l.key, g.laws[l.key]))}</td><td class="muted">${c ? `${U.fmtMonthYear(c.day)}${c.why === 'emergency' ? ' (emergency)' : c.why === 'austerity' ? ' (austerity)' : ''}` : 'start'}</td></tr>`; }).join('')}</table>
        <div class="note">Each law is a real lever in the engine: tax rates, the minimum wage on every job, cash aid and basic income paid each month, the police headcount, how drug users are treated, university fees, whether employers may check records, a hiring preference, and whether the bar is open.</div></div>
      <div class="card"><h3>Treasury <small class="muted">Year-1 money</small></h3>
        <div class="stat-grid"><div class="stat"><div class="v">${U.fmtMoney(g.treasury.cash)}</div><div class="l">in the treasury</div></div><div class="stat"><div class="v ${g.debt ? 'neg' : ''}">${U.fmtMoney(g.debt)}</div><div class="l">public debt</div></div><div class="stat"><div class="v">${g.officers}</div><div class="l">police officers (${(g.officers / Math.max(1, w.counts.living) * 1000).toFixed(1)} per 1,000; Malaysia ~4)</div></div></div>
        <canvas class="chart" id="gv-tre"></canvas>
        ${g.last ? `<table class="cmp"><tr><th>Last month in</th><th>${U.fmtMoney(g.last.revTotal)}</th><th>Last month out</th><th>${U.fmtMoney(g.last.spendTotal)}</th></tr>
          ${(() => { const a = Object.entries(g.last.rev).sort((x, y) => y[1] - x[1]), b = Object.entries(g.last.spend).sort((x, y) => y[1] - x[1]); const n = Math.max(a.length, b.length); let s = ''; for (let i = 0; i < n; i++) s += `<tr><td class="muted">${a[i] ? esc(a[i][0]) : ''}</td><td>${a[i] ? U.fmtMoney(a[i][1]) : ''}</td><td class="muted">${b[i] ? esc(b[i][0]) : ''}</td><td>${b[i] ? U.fmtMoney(b[i][1]) : ''}</td></tr>`; return s; })()}</table>` : ''}
        <div class="note">Income tax, corporate tax, fines and inheritance tax come in; police wages, the leader's salary, aid, welfare, free university places, interest and public services go out. When the treasury is short it borrows; deep debt forces austerity.</div></div>
      ${last ? `<div class="card"><h3>Last election <small class="muted">${U.fmtDate(last.day)} · turnout ${last.eligible ? pct(last.voted / last.eligible) : '–'} (GE15: 73.9%)</small></h3>
        ${last.cands.map(c => `<div class="why-opt ${c.id === last.winner ? 'chosen' : ''}"><span><span style="color:${c.colour}">■</span> ${UI.plink(w, c.id)}${c.incumbent ? ' <span class="muted">(incumbent)</span>' : ''}</span><div class="track"><i style="width:${last.voted ? (c.votes / last.voted * 100).toFixed(1) : 0}%;background:${c.colour}"></i></div><span class="pct">${c.votes}</span></div>
          <div class="note" style="margin:0 0 6px 10px">Promised: ${Object.keys(c.platform).length ? Object.entries(c.platform).map(([k, v]) => `${esc(GV.LAW_BY_KEY[k].name)} → ${esc(GV.optName(k, v))}`).join('; ') : 'no changes'}</div>`).join('')}
        <h3 style="margin-top:10px">How groups voted</h3>${breakdown(w, last, 'cls')}${breakdown(w, last, 'rel', LES.Society ? Object.fromEntries(Object.entries(LES.Society.RELIGIONS).map(([k, v]) => [k, v.name])) : null)}${breakdown(w, last, 'eth', C.ETHNIC_NAMES)}
        <div class="note">Voters weigh what each promise would mean for them (people with more education judge this better), their left-right and conservative-liberal leanings, the leader's record, shared identity, charisma and campaign spending, and then decide whether to vote at all.</div></div>` : ''}
      ${g.elections.length > 1 ? `<div class="card"><h3>Past elections</h3><ul class="list-plain">${g.elections.slice().reverse().slice(1, 12).map(e => { const win = e.cands.find(c => c.id === e.winner); return `<li><span>${U.fmtMonthYear(e.day)} · ${UI.plink(w, e.winner)}${win && win.incumbent ? ' (re-elected)' : ''}</span><span class="muted">${win ? win.votes : 0}/${e.voted} votes · turnout ${e.eligible ? pct(e.voted / e.eligible) : '–'}</span></li>`; }).join('')}</ul></div>` : ''}
      <div class="card"><h3>Town events</h3><div class="grid2"><div><span class="muted">Monsoon floods</span><span>${g.floods}</span></div><div><span class="muted">Haze episodes</span><span>${g.hazes}</span></div><div><span class="muted">Inheritance tax collected</span><span>${U.fmtMoney(g.estateTaxTotal)}</span></div><div><span class="muted">Public money stolen</span><span>${U.fmtMoney(g.skimmed)}</span></div></div>
        <div class="note">Floods hit low-lying and riverside homes in the north-east monsoon; the treasury pays RM1,000 relief per household (like Bantuan Wang Ihsan). Haze hurts health, most of all for the old and very young.</div></div>`;
    if (h.length) {
      LES.Charts.line($('gv-appr'), { series: [{ label: 'Approval %', color: '#3ec7b5', data: h.map(r => [r.day / 365, r.gov.approval]) }], xFmt: xs, yMin: 0 });
      LES.Charts.line($('gv-tre'), { series: [{ label: 'Revenue / month', color: '#57d38c', data: h.map(r => [r.day / 365, r.gov.rev]) }, { label: 'Spending / month', color: '#ff8c42', data: h.map(r => [r.day / 365, r.gov.spend]) }, { label: 'Debt', color: '#e63946', data: h.map(r => [r.day / 365, r.gov.debt]) }], xFmt: xs, yMin: 0, yFmt: LES.Charts.fmtAxisMoney });
    }
  };

  UI.politicsCard = function (w, p) {
    if (!w.gov || !p.pol || !p.adult) return '';
    const g = w.gov, ran = g.elections.filter(e => e.cands.some(c => c.id === p.id));
    return `<div class="card"><h3>Politics</h3><div class="grid2">
      <div><span class="muted">Leaning</span><span>${lean(p)}</span></div>
      ${g.president === p.id ? `<div><span class="muted">Office</span><span class="pos">${esc(GV.title(w))}</span></div>` : ''}
      ${ran.length ? `<div><span class="muted">Stood for election</span><span>${ran.length}× · won ${ran.filter(e => e.winner === p.id).length}</span></div>` : ''}
      ${p.pol.voted >= 0 && p.pol.voted !== undefined ? `<div><span class="muted">Last voted</span><span>${U.fmtMonthYear(p.pol.voted)}</span></div>` : ''}
    </div></div>`;
  };
})(globalThis.LES = globalThis.LES || {});
