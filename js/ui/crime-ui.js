// Crime tab (rates vs Malaysia, justice, drugs, gangs) and the person panel's justice card.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, UI = LES.UI, CR = LES.Crime;
  const $ = id => document.getElementById(id);
  const esc = U.esc, f0 = x => (x >= 100 ? Math.round(x).toLocaleString() : x.toFixed(1));

  UI.renderCrime = function () {
    const w = UI.app.world, el = $('tab-crime');
    if (!w.crime) {
      el.innerHTML = '<div class="card"><h3>Crime</h3><p class="note">Crime and vice are switched off in this world. Turn on <b>Crime &amp; vice</b> in New world to add police, courts, prison, drugs and gangs.</p></div>';
      return;
    }
    const st = w.crime, k = CR.INTENSITY[w.cfg.crime], rates = CR.rates(w), h = w.history.filter(r => r.cr), last = h[h.length - 1];
    const xs = x => `Y${Math.floor(x) + 1}`;
    const row = (label, sim, my) => `<tr><td>${label}</td><td>${f0(sim)}</td><td class="muted">${f0(my * k)}${k !== 1 ? ` <span class="muted">(${f0(my)} ×${k})</span>` : ''}</td></tr>`;
    const live = st.gangs.filter(g => g.alive);
    const prisoners = w.living.filter(p => p.alive && p.inst && p.inst.kind === 'prison'), inRehab = w.living.filter(p => p.alive && p.inst && p.inst.kind === 'rehab');
    const users = w.living.filter(p => p.alive && p.cr && p.cr.user).length;
    const vic = st.victimsByClass, vicTotal = Object.values(vic).reduce((a, b) => a + b, 0) || 1;
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="v">${f0(rates.index)}</div><div class="l">index crimes per 100k a year (Malaysia ${CR.MY.index}${k !== 1 ? ` ×${k}` : ''})</div></div>
        <div class="stat"><div class="v">${prisoners.length}</div><div class="l">in prison · ${inRehab.length} in rehab</div></div>
        <div class="stat"><div class="v">${users}</div><div class="l">drug users now</div></div>
        <div class="stat"><div class="v">${st.total.murder || 0}</div><div class="l">murders so far</div></div>
        <div class="stat"><div class="v">${st.arrests ? Math.round(st.convictions / st.arrests * 100) : 0}%</div><div class="l">of arrests end in conviction</div></div>
        <div class="stat"><div class="v">${live.length}</div><div class="l">gangs active</div></div>
      </div>
      <div class="card"><h3>Rates per 100,000 <small class="muted">last 12 months · intensity “${esc(w.cfg.crime)}”</small></h3>
        <table class="cmp"><tr><th></th><th>This town</th><th>Malaysia${k !== 1 ? ' ×' + k : ''}</th></tr>
          ${row('Index crime', rates.index, CR.MY.index)}${row('· property', rates.property, CR.MY.property)}${row('· violent', rates.violent, CR.MY.violent)}
          ${row('Murder', rates.murder, CR.MY.murder)}${row('Drug users (now)', last ? last.cr.users : 0, CR.MY.users)}${row('Prisoners (now)', last ? last.cr.prison : 0, CR.MY.prison)}</table>
        <div class="note">A town of a few hundred people is tiny: at real Malaysian rates it would see about one crime every two years. "Lively" multiplies the rates by 10 so the system is visible; "Realistic" uses them as they are.</div></div>
      <div class="card"><h3>Crime over time <small class="muted">per 100k a year</small></h3><canvas class="chart" id="cr-rate"></canvas></div>
      <div class="card"><h3>Prison and drugs</h3><canvas class="chart" id="cr-pris"></canvas>
        <div class="grid2">
          <div><span class="muted">Arrests / convictions</span><span>${st.arrests} / ${st.convictions}</span></div>
          <div><span class="muted">Acquitted (${st.lawyers} hired a lawyer)</span><span>${st.acquitted}</span></div>
          <div><span class="muted">Released from prison</span><span>${st.released}</span></div>
          <div><span class="muted">Reoffended within 3 years</span><span>${st.released ? Math.round(st.reoffended / st.released * 100) : 0}%</span></div>
          <div><span class="muted">Started using drugs</span><span>${st.startedUsing}</span></div>
          <div><span class="muted">Drug arrests / overdoses</span><span>${st.drugArrests} / ${st.overdoses}</span></div>
          <div><span class="muted">Rehab (of which voluntary)</span><span>${st.rehabAdmissions} (${st.voluntaryRehab})</span></div>
          <div><span class="muted">Drug policy</span><span>${esc((LES.SETTINGS_META.find(m => m.key === 'drugPolicy').options.find(o => o[0] === w.cfg.drugPolicy) || [, w.cfg.drugPolicy])[1])}</span></div>
        </div></div>
      <div class="card"><h3>Who are the victims? <small class="muted">by household class</small></h3>
        <div class="grid2">${['B40', 'M40', 'T20'].map(c => `<div><span class="muted">${c}</span><span>${Math.round((vic[c] || 0) / vicTotal * 100)}%</span></div>`).join('')}</div>
        <div class="note">Thieves look for cash and burglars for bigger homes, so the better-off are targeted more; scammers go for older, risk-tolerant people.</div></div>
      <div class="card"><h3>Gangs <small class="muted">${st.gangs.length} formed so far · ${st.crackdowns} police raids · ${st.gangFights} turf fights</small></h3>
        ${live.length ? `<table class="cmp"><tr><th>Gang</th><th>Leader</th><th>Members</th><th>Turf</th><th>Funds</th></tr>${live.map(g => `<tr><td><span style="color:${g.colour}">■</span> ${esc(g.name)}</td><td>${UI.plink(w, g.leader)}</td><td>${g.members.length}</td><td>${g.turf.length} block${g.turf.length > 1 ? 's' : ''}</td><td>${U.fmtMoney(g.cash)}</td></tr>`).join('')}</table>` : '<p class="note">No gang is active right now.</p>'}
        <div class="note">Gangs earn from dealing drugs, from a share of members' crimes and from protection money (${U.fmtMoney(st.protection)} taken from shops on their turf so far). Choose the <b>Gang turf</b> overlay to see their blocks.</div></div>
      <p class="note">Why people offend here: need (little cash, no job, cravings), low self-control, age (peaks at 18-25), peers and records, minus deterrence (police strength), devotion, children and a good job. Open anyone's "Why did they do that?" on the day they are tempted to see the odds.</p>`;
    if (h.length) {
      LES.Charts.line($('cr-rate'), { series: [{ label: 'Index crime', color: '#e63946', data: h.map(r => [r.day / 365, r.cr.index]) }, { label: 'Scams', color: '#f4a261', data: h.map(r => [r.day / 365, r.cr.scam]) }], xFmt: xs, yMin: 0, yFmt: v => Math.round(v).toLocaleString() });
      LES.Charts.line($('cr-pris'), { series: [{ label: 'Prisoners', color: '#8d99ae', data: h.map(r => [r.day / 365, r.cr.prisoners]) }, { label: 'In rehab', color: '#57d38c', data: h.map(r => [r.day / 365, r.cr.rehab]) }, { label: 'Gang members', color: '#b892ff', data: h.map(r => [r.day / 365, r.cr.gangMembers]) }], xFmt: xs, yMin: 0 });
    }
  };

  UI.crimeCard = function (w, p) {
    const cr = p.cr;
    if (!w.crime || !cr || !p.adult || (!cr.rec && !cr.offences && !cr.user && !cr.addict && !cr.victim && cr.gang < 0 && !p.inst)) return '';
    const g = cr.gang >= 0 ? w.crime.gangs[cr.gang] : null;
    return `<div class="card"><h3>Justice</h3><div class="grid2">
      ${p.inst ? `<div><span class="muted">${p.inst.kind === 'rehab' ? 'In rehab' : 'In prison'}</span><span class="neg">until ${U.fmtMonthYear(p.inst.until)}${p.inst.why ? ' · ' + esc(p.inst.why) : ''}</span></div>` : ''}
      <div><span class="muted">Criminal record</span><span>${cr.rec ? `${cr.rec} conviction${cr.rec > 1 ? 's' : ''}` : 'none'}</span></div>
      <div><span class="muted">Crimes committed</span><span>${cr.offences}</span></div>
      <div><span class="muted">Times a victim</span><span>${cr.victim}</span></div>
      <div><span class="muted">Temptation now</span><span>${(cr.t * 100).toFixed(1)}%</span></div>
      ${g ? `<div><span class="muted">Gang</span><span style="color:${g.colour}">${esc(g.name)}${g.leader === p.id ? ' (leader)' : ''}</span></div>` : ''}
      ${cr.user || cr.addict ? `<div><span class="muted">Drugs</span><span>${cr.user ? `using · addiction ${Math.round(cr.addict)}/100` : `clean for ${cr.clean} months`}</span></div>` : ''}
    </div>${cr.rec ? '<div class="note">A record makes employers less likely to hire them.</div>' : ''}</div>`;
  };
})(globalThis.LES = globalThis.LES || {});
