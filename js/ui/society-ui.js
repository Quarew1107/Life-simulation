// Society tab (class, mobility, ethnicity, religion) and the person panel's society card.
// Read-only views of LES.Society; shown only when the society system is on.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, UI = LES.UI, S = LES.Society;
  const $ = id => document.getElementById(id);
  const esc = U.esc, pct = x => `${Math.round(x * 100)}%`;
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s), t = (k, p) => esc(T(k, p)); // PL-17

  UI.renderSociety = function () {
    const w = UI.app.world, el = $('tab-society');
    if (!w.society) {
      el.innerHTML = `<div class="card"><h3>${t('so.title')}</h3><p class="note">${T('so.offHtml')}</p></div>`;
      return;
    }
    const st = w.society, h = w.history.filter(r => r.soc), last = h[h.length - 1];
    const xs = x => T('rp.yr', { n: Math.floor(x) + 1 });
    const mob = S.mobility(w), eth = S.groupStats(w, 'eth'), rel = S.groupStats(w, 'rel');
    const fest = LES.Calendar.festival(w.day), ram = LES.Calendar.ramadan(w.day);
    const relCount = last ? last.soc.rel : {};
    const living = Object.values(relCount).reduce((a, b) => a + b, 0) || 1;
    const fundOf = k => (st.funds[k] ? st.funds[k] : { bal: 0, inTotal: 0, outTotal: 0 });
    const mobRow = a => {
      const row = mob.m[a], n = S.CLASSES.reduce((s, b) => s + row[b], 0);
      return `<tr><td class="muted">${S.short(a)}</td>${S.CLASSES.map(b => `<td${a === b ? ' style="font-weight:600"' : ''}>${n ? pct(row[b] / n) : '–'}</td>`).join('')}<td class="muted">${n}</td></tr>`;
    };
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="v">${U.fmtMoney(st.cut40)}</div><div class="l">${t('so.ceiling', { cls: S.short('B40'), sym: U.sym(), office: LES.Countries.pack.society.statsOffice, amt: U.cur(S.DOSM_B40_MAX) })}</div></div>
        <div class="stat"><div class="v">${U.fmtMoney(st.cut80)}</div><div class="l">${t('so.floor', { cls: S.short('T20'), office: LES.Countries.pack.society.statsOffice, amt: U.cur(S.DOSM_T20_MIN) })}</div></div>
        <div class="stat"><div class="v">${pct(st.t20share)}</div><div class="l">${t('so.share', { cls: S.short('T20') })}</div></div>
        <div class="stat"><div class="v">${pct(st.belowB40)}</div><div class="l">${t('so.below', { amt: U.cur(S.DOSM_B40_MAX), country: G(LES.Countries.pack.name) })}</div></div>
        <div class="stat"><div class="v">${w.living.filter(p => p.alive && p.elite).length}</div><div class="l">${t('so.elite', { sym: U.sym() })}</div></div>
        <div class="stat"><div class="v">${w.living.filter(p => p.alive && p.adult && p.hardship).length}</div><div class="l">${t('so.hardship')}</div></div>
      </div>
      <div class="card"><h3>${t('so.lines')} <small class="muted">${t('so.linesSub', { sym: U.sym(), office: LES.Countries.pack.society.statsOffice, year: LES.Countries.pack.society.cutsYear })}</small></h3><canvas class="chart" id="so-cut"></canvas>
        <div class="note">${t('so.linesNote', { office: LES.Countries.pack.society.statsOffice, b: S.short('B40'), m: S.short('M40'), t: S.short('T20') })}</div></div>
      <div class="card"><h3>${t('so.mob')} <small class="muted">${t('so.mobSub')}</small></h3>
        <table class="cmp"><tr><th>${t('so.grewUp')}</th>${S.CLASSES.map(c => `<th>${S.short(c)}</th>`).join('')}<th>n</th></tr>${S.CLASSES.map(mobRow).join('')}</table>
        <div class="note">${mob.n ? t('so.mobRows', { n: mob.n }) : t('so.mobWait')} ${t('so.mobNote')}</div></div>
      <div class="card"><h3>${t('so.eth')} <small class="muted">${t('so.adultsNow')}</small></h3>
        <table class="cmp"><tr><th>${t('so.group')}</th><th>${t('so.adults')}</th><th>${t('so.medNw')}</th><th>${t('so.medInc')}</th><th>${S.short('B40')}</th><th>${S.short('T20')}</th><th>${t('so.degree')}</th></tr>
        ${C.ETHNICITIES.filter(k => eth[k]).map(k => { const g = eth[k]; return `<tr><td>${esc(G(C.ETHNIC_NAMES[k]))}</td><td>${g.n}</td><td>${U.fmtMoney(g.medNw)}</td><td>${U.fmtMoney(g.medInc)}</td><td>${pct(g.b40 / g.n)}</td><td>${pct(g.t20 / g.n)}</td><td>${pct(g.uni / g.n)}</td></tr>`; }).join('')}</table>
        <div class="note">${t('so.ethNote')}</div></div>
      ${LES.China && LES.China.on() ? (() => { const hk = S.groupStats(w, 'hukou'); return `<div class="card"><h3>${t('so.hukou')} <small class="muted">${t('so.adultsNow')}</small></h3>
        <table class="cmp"><tr><th>${t('so.hukou')}</th><th>${t('so.adults')}</th><th>${t('so.medNw')}</th><th>${t('so.medInc')}</th><th>${S.short('B40')}</th><th>${S.short('T20')}</th><th>${t('so.degree')}</th></tr>
        ${['urban', 'rural', 'outside'].filter(k => hk[k]).map(k => { const g = hk[k]; return `<tr><td>${esc(G(LES.China.name(k)))}</td><td>${g.n}</td><td>${U.fmtMoney(g.medNw)}</td><td>${U.fmtMoney(g.medInc)}</td><td>${pct(g.b40 / g.n)}</td><td>${pct(g.t20 / g.n)}</td><td>${pct(g.uni / g.n)}</td></tr>`; }).join('')}</table>
        <div class="note">${t('so.hukouNote')}</div></div>`; })() : ''}
      <div class="card"><h3>${t('so.rel')} <small class="muted">${fest ? `🎉 ${t('so.festNow', { name: G(fest.name) })} · ` : ''}${ram ? `🌙 ${t('so.ramadan')} · ` : ''}${t('so.relSub')}</small></h3>
        <table class="cmp"><tr><th>${t('so.rel')}</th><th>${t('so.people')}</th><th>${t('so.devotion')}</th><th>${t('so.worship')}<br><span class="muted">${t('so.lastMonth')}</span></th><th>${t('so.fund')}</th><th>${t('so.aid')}</th></tr>
        ${S.REL_KEYS.filter(k => relCount[k]).map(k => { const d = S.RELIGIONS[k], f = fundOf(k), g = rel[k], members = w.living.filter(p => p.alive && p.rel === k);
          const dev = members.length ? Math.round(members.reduce((s, p) => s + p.relig, 0) / members.length) : 0;
          return `<tr><td>${d.icon} ${esc(G(d.name))}</td><td>${relCount[k]} <span class="muted">(${pct(relCount[k] / living)})</span></td><td>${dev}/100</td><td>${(st.lastWorship || {})[k] || 0}</td><td>${U.fmtMoney(f.bal)}</td><td>${U.fmtMoney(f.outTotal)}</td></tr>`; }).join('')}</table>
        <canvas class="chart" id="so-rel"></canvas>
        <div class="grid2">
          <div><span class="muted">${t('so.zakat')}</span><span>${U.fmtMoney(st.zakatTotal)}</span></div>
          <div><span class="muted">${t('so.aidFunds')}</span><span>${U.fmtMoney(st.aidTotal)}</span></div>
          <div><span class="muted">${t('so.festSpend')}</span><span>${U.fmtMoney(st.festivalSpend)}</span></div>
          <div><span class="muted">${t('so.interfaith')}</span><span>${st.interfaith} / ${st.conversions}</span></div>
        </div>
        <div class="note">${t('so.relNote')}</div></div>
      <p class="note">${t('so.disclaimer', { seed: w.cfg.seed })}</p>`;
    if (h.length) {
      LES.Charts.line($('so-cut'), {
        series: [
          { label: T('so.ch.ceiling', { cls: S.short('B40') }), color: '#f4a261', data: h.map(r => [r.day / 365, r.soc.cut40]) },
          { label: T('so.ch.floor', { cls: S.short('T20') }), color: '#f2c14e', data: h.map(r => [r.day / 365, r.soc.cut80]) },
          { label: `${LES.Countries.pack.society.statsOffice} ${S.short('B40')}`, color: '#f4a261', dash: [4, 3], data: [[h[0].day / 365, U.RM(S.DOSM_B40_MAX)], [last.day / 365, U.RM(S.DOSM_B40_MAX)]] },
          { label: `${LES.Countries.pack.society.statsOffice} ${S.short('T20')}`, color: '#f2c14e', dash: [4, 3], data: [[h[0].day / 365, U.RM(S.DOSM_T20_MIN)], [last.day / 365, U.RM(S.DOSM_T20_MIN)]] },
        ], yFmt: LES.Charts.fmtAxisMoney, xFmt: xs, yMin: 0,
      });
      LES.Charts.line($('so-rel'), { series: S.REL_KEYS.filter(k => relCount[k]).map(k => ({ label: G(S.RELIGIONS[k].name), color: S.RELIGIONS[k].colour, data: h.map(r => [r.day / 365, r.soc.rel[k] || 0]) })), xFmt: xs, yMin: 0 });
    }
  };

  // Card on the person panel.
  UI.societyCard = function (w, p) {
    if (!w.society || !p.rel) return '';
    const d = S.RELIGIONS[p.rel];
    const cls = p.cls ? `<span style="color:${S.CLASS_COLOURS[p.cls]}">${esc(G(S.CLASS_NAMES[p.cls]))}</span>` : '<span class="muted">—</span>';
    return `<div class="card"><h3>${t('so.card')}</h3><div class="grid2">
      <div><span class="muted">${t('so.ethnicity')}</span><span>${esc(G(C.ETHNIC_NAMES[p.eth] || p.eth))}</span></div>
      <div><span class="muted">${t('so.rel')}</span><span>${d.icon} ${esc(G(d.name))}</span></div>
      <div><span class="muted">${t('so.hhClass')}</span><span>${cls}${p.elite ? ` · <span style="color:#f2c14e">${t('so.t1')}</span>` : ''}${p.hardship ? ` · <span class="neg">${t('so.hard')}</span>` : ''}</span></div>
      <div><span class="muted">${t('so.grewIn')}</span><span>${p.clsOrigin ? S.short(p.clsOrigin) : '<span class="muted">—</span>'}</span></div>
      <div><span class="muted">${t('so.devotion')}</span><span>${p.relig}/100</span></div>
      <div><span class="muted">${t('so.given')}</span><span>${U.fmtMoney(p.donated)}</span></div>
      ${p.zakatPaid ? `<div><span class="muted">${t('so.zakatPaid')}</span><span>${U.fmtMoney(p.zakatPaid)}</span></div>` : ''}
      ${p.aidRecv ? `<div><span class="muted">${t('so.aidRecv')}</span><span>${U.fmtMoney(p.aidRecv)}</span></div>` : ''}
      ${p.hukou && LES.China ? `<div><span class="muted">${t('so.hukou')}</span><span>${esc(G(LES.China.name(p.hukou)))}</span></div>` : ''}
      ${p.siMonths ? `<div><span class="muted">${t('so.si')}</span><span>${t('so.siYears', { v: (p.siMonths / 12).toFixed(1) })}${p.job && p.job.si === false ? ` · <span class="neg">${t('so.siNone')}</span>` : ''}</span></div>` : ''}
      ${p.cnPension ? `<div><span class="muted">${t('so.pension')}</span><span>${t(p.cnEmp ? 'so.pensionEmp' : 'so.pensionRes', { amt: U.fmtMoney(w.px(p.cnPension)) })}</span></div>` : ''}
      ${p.zk ? `<div><span class="muted">${t('so.zk')}</span><span>${t(p.zk === 'academic' ? 'so.zkAcad' : 'so.zkVoc')}</span></div>` : ''}
    </div></div>`;
  };
})(globalThis.LES = globalThis.LES || {});
