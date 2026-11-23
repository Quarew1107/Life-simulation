// Crime tab (rates vs Malaysia, justice, drugs, gangs) and the person panel's justice card.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, UI = LES.UI, CR = LES.Crime;
  const $ = id => document.getElementById(id);
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s), t = (k, p) => U.esc(T(k, p)); // PL-17
  const esc = U.esc, f0 = x => (x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(1));

  // Police against crime: capacity, clearance and the deterrence people feel.
  function policeCard(w, st) {
    const g = w.gov, solved = st.crimesTotal ? st.solvedTotal / st.crimesTotal : 0, kpd = g && g.officials ? g.officials.police : null, tc = st.town || {};
    return `<div class="card"><h3>${t('cr.police')}</h3>
      <div class="grid2"><div><span class="muted">${t('cr.solved')}</span><span>${Math.round(solved * 100)}% (${esc(G(LES.Countries.pack.name))} ~${Math.round(LES.Countries.pack.calibration.clearance.target * 100)}%)</span></div><div><span class="muted">${t('cr.felt')}</span><span>${Math.round((st.certainty === undefined ? 0.5 : st.certainty) * 100)}%</span></div>
        <div><span class="muted">${t('cr.officers')}</span><span>${g ? g.officers : '–'}</span></div><div><span class="muted">${t('cr.capacity')}</span><span>${Math.round(LES.Crime.capacity(w) * 100)}%</span></div>
        ${g ? `<div><span class="muted">${esc(G((LES.Council.ROLES.police || {}).title || 'Police chief'))}</span><span>${kpd ? (kpd.id >= 0 ? UI.plink(w, kpd.id) : esc(G(kpd.name))) + ` · ${t('cr.competence', { v: Math.round(kpd.comp * 100) })}` : t('cr.vacant')}</span></div>` : ''}
        <div><span class="muted">${t('cr.townUnemp')}</span><span>${Math.round((tc.unemp || 0) * 1000) / 10}% / ${(tc.gini || 0).toFixed(2)}</span></div></div>
      <canvas class="chart" id="cr-pol"></canvas>
      <div class="note">${t('cr.policeNote')}</div></div>`;
  }

  UI.renderCrime = function () {
    const w = UI.app.world, el = $('tab-crime');
    if (!w.crime) {
      el.innerHTML = `<div class="card"><h3>${t('cr.title')}</h3><p class="note">${T('cr.offHtml')}</p></div>`;
      return;
    }
    const st = w.crime, k = CR.INTENSITY[w.cfg.crime], rates = CR.rates(w), h = w.history.filter(r => r.cr), last = h[h.length - 1];
    const xs = x => T('rp.yr', { n: Math.floor(x) + 1 });
    const row = (label, sim, my) => `<tr><td>${t(label)}</td><td>${f0(sim)}</td><td class="muted">${f0(my * k)}${k !== 1 ? ` <span class="muted">(${f0(my)} ×${k})</span>` : ''}</td></tr>`;
    const live = st.gangs.filter(g => g.alive);
    const prisoners = w.living.filter(p => p.alive && p.inst && p.inst.kind === 'prison'), inRehab = w.living.filter(p => p.alive && p.inst && p.inst.kind === 'rehab');
    const users = w.living.filter(p => p.alive && p.cr && p.cr.user).length;
    const vic = st.victimsByClass, vicTotal = Object.values(vic).reduce((a, b) => a + b, 0) || 1;
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="v">${f0(rates.index)}</div><div class="l">${t('cr.s.index', { country: G(LES.Countries.pack.name), ref: CR.REF.index })}${k !== 1 ? ` ×${k}` : ''})</div></div>
        <div class="stat"><div class="v">${prisoners.length}</div><div class="l">${t('cr.s.prison', { n: inRehab.length })}</div></div>
        <div class="stat"><div class="v">${users}</div><div class="l">${t('cr.s.users')}</div></div>
        <div class="stat"><div class="v">${st.total.murder || 0}</div><div class="l">${t('cr.s.murders')}</div></div>
        <div class="stat"><div class="v">${st.arrests ? Math.round(st.convictions / st.arrests * 100) : 0}%</div><div class="l">${t('cr.s.conv')}</div></div>
        <div class="stat"><div class="v">${live.length}</div><div class="l">${t('cr.s.gangs')}</div></div>
      </div>
      <div class="card"><h3>${t('cr.rates')} <small class="muted">${t('cr.ratesSub', { v: G(w.cfg.crime) })}</small></h3>
        <table class="cmp"><tr><th></th><th>${t('cr.thisTown')}</th><th>${esc(G(LES.Countries.pack.name))}${k !== 1 ? ' ×' + k : ''}</th></tr>
          ${row('cr.r.index', rates.index, CR.REF.index)}${row('cr.r.property', rates.property, CR.REF.property)}${row('cr.r.violent', rates.violent, CR.REF.violent)}
          ${row('cr.r.murder', rates.murder, CR.REF.murder)}${row('cr.r.users', last ? last.cr.users : 0, CR.REF.users)}${row('cr.r.prison', last ? last.cr.prison : 0, CR.REF.prison)}</table>
        <div class="note">${t('cr.ratesNote', { adj: G(LES.Countries.pack.adj) })}</div></div>
      <div class="card"><h3>${t('cr.overTime')} <small class="muted">${t('cr.per100k')}</small></h3><canvas class="chart" id="cr-rate"></canvas></div>
      ${policeCard(w, st)}
      <div class="card"><h3>${t('cr.prisonDrugs')}</h3><canvas class="chart" id="cr-pris"></canvas>
        <div class="grid2">
          <div><span class="muted">${t('cr.arrests')}</span><span>${st.arrests} / ${st.convictions}</span></div>
          <div><span class="muted">${t('cr.acquitted', { n: st.lawyers })}</span><span>${st.acquitted}</span></div>
          <div><span class="muted">${t('cr.released')}</span><span>${st.released}</span></div>
          <div><span class="muted">${t('cr.reoffended')}</span><span>${st.released ? Math.round(st.reoffended / st.released * 100) : 0}%</span></div>
          <div><span class="muted">${t('cr.started')}</span><span>${st.startedUsing}</span></div>
          <div><span class="muted">${t('cr.drugArrests')}</span><span>${st.drugArrests} / ${st.overdoses}</span></div>
          <div><span class="muted">${t('cr.rehab')}</span><span>${st.rehabAdmissions} (${st.voluntaryRehab})</span></div>
          <div><span class="muted">${t('cr.policy')}</span><span>${esc(G((LES.SETTINGS_META.find(m => m.key === 'drugPolicy').options.find(o => o[0] === (w.policy ? w.policy.drugPolicy : w.cfg.drugPolicy)) || [, w.cfg.drugPolicy])[1]))}</span></div>
        </div></div>
      <div class="card"><h3>${t('cr.victims')} <small class="muted">${t('cr.byClass')}</small></h3>
        <div class="grid2">${['B40', 'M40', 'T20'].map(c => `<div><span class="muted">${LES.Society ? LES.Society.shortT(c) : c}</span><span>${Math.round((vic[c] || 0) / vicTotal * 100)}%</span></div>`).join('')}</div>
        <div class="note">${t('cr.victimsNote')}</div></div>
      <div class="card"><h3>${t('cr.gangs')} <small class="muted">${t('cr.gangsSub', { formed: st.gangs.length, raids: st.crackdowns, fights: st.gangFights })}</small></h3>
        ${live.length ? `<table class="cmp"><tr><th>${t('cr.gang')}</th><th>${t('cr.leader')}</th><th>${t('cr.members')}</th><th>${t('cr.turf')}</th><th>${t('cr.funds')}</th></tr>${live.map(g => `<tr><td><span style="color:${g.colour}">■</span> ${esc(G(g.name))}${LES.Crime.linkText(w, g) ? `<br><small class="muted">${esc(LES.Crime.linkText(w, g))}</small>` : ''}</td><td>${UI.plink(w, g.leader)}</td><td>${g.members.length}</td><td>${t('cr.blocks', { count: g.turf.length })}</td><td>${U.fmtMoney(g.cash)}</td></tr>`).join('')}</table>` : `<p class="note">${t('cr.noGang')}</p>`}
        <div class="note">${T('cr.gangNoteHtml', { amt: U.fmtMoney(st.protection) })}${w.region ? ` ${t('cr.gangRegion')}` : ''}</div></div>
      <p class="note">${t('cr.why')}</p>`;
    if (h.length) {
      if (h.length && $('cr-pol')) { const hp = h.filter(r => r.day > 365); LES.Charts.line($('cr-pol'), { series: [{ label: T('cr.ch.solved'), color: '#5aa9e6', data: hp.map(r => [r.day / 365, (r.cr.cert === undefined ? 0.5 : r.cr.cert) * 100]) }, { label: T('cr.ch.capacity'), color: '#57d38c', data: hp.map(r => [r.day / 365, (r.cr.cap === undefined ? 1 : r.cr.cap) * 100]) }, { label: T('cr.ch.unemp'), color: '#e76f51', data: hp.map(r => [r.day / 365, (r.cr.unemp || 0) * 1000]) }], xFmt: xs, yMin: 0 }); }
      LES.Charts.line($('cr-rate'), { series: [{ label: T('cr.r.index'), color: '#e63946', data: h.map(r => [r.day / 365, r.cr.index]) }, { label: T('cr.ch.scams'), color: '#f4a261', data: h.map(r => [r.day / 365, r.cr.scam]) }], xFmt: xs, yMin: 0, yFmt: v => Math.round(v).toLocaleString() });
      LES.Charts.line($('cr-pris'), { series: [{ label: T('cr.ch.prisoners'), color: '#8d99ae', data: h.map(r => [r.day / 365, r.cr.prisoners]) }, { label: T('cr.ch.rehab'), color: '#57d38c', data: h.map(r => [r.day / 365, r.cr.rehab]) }, { label: T('cr.ch.members'), color: '#b892ff', data: h.map(r => [r.day / 365, r.cr.gangMembers]) }], xFmt: xs, yMin: 0 });
    }
  };

  UI.crimeCard = function (w, p) {
    const cr = p.cr;
    if (!w.crime || !cr || !p.adult || (!cr.rec && !cr.offences && !cr.user && !cr.addict && !cr.victim && cr.gang < 0 && !p.inst)) return '';
    const g = cr.gang >= 0 ? w.crime.gangs[cr.gang] : null;
    return `<div class="card"><h3>${t('cr.justice')}</h3><div class="grid2">
      ${p.inst ? `<div><span class="muted">${t(p.inst.kind === 'rehab' ? 'cr.inRehab' : 'cr.inPrison')}</span><span class="neg">${t('cr.until', { date: U.fmtMonthYear(p.inst.until) })}${p.inst.why ? ' · ' + esc(G(p.inst.why)) : ''}</span></div>` : ''}
      <div><span class="muted">${t('cr.record')}</span><span>${cr.rec ? t('cr.convictions', { count: cr.rec }) : t('cr.none')}</span></div>
      <div><span class="muted">${t('cr.committed')}</span><span>${cr.offences}</span></div>
      <div><span class="muted">${t('cr.timesVictim')}</span><span>${cr.victim}</span></div>
      <div><span class="muted">${t('cr.temptation')}</span><span>${(cr.t * 100).toFixed(1)}%</span></div>
      ${g ? `<div><span class="muted">${t('cr.gang')}</span><span style="color:${g.colour}">${esc(G(g.name))}${g.leader === p.id ? ` (${t('cr.leaderLc')})` : ''}</span></div>` : ''}
      ${cr.tie && w.region && w.region.towns[cr.tie.town] && w.region.towns[cr.tie.town].crime ? `<div><span class="muted">${t('cr.oldGang')}</span><span>${t('cr.ties', { gang: w.region.towns[cr.tie.town].crime.gangs[cr.tie.gang].name, town: LES.townName(w.region.towns[cr.tie.town]) })}</span></div>` : ''}
      ${cr.user || cr.addict ? `<div><span class="muted">${t('cr.drugs')}</span><span>${cr.user ? t('cr.using', { v: Math.round(cr.addict) }) : t('cr.clean', { count: cr.clean })}</span></div>` : ''}
    </div>${cr.rec ? `<div class="note">${t('cr.recNote')}</div>` : ''}</div>`;
  };
})(globalThis.LES = globalThis.LES || {});
