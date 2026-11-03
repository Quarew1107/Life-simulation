// Society tab (class, mobility, ethnicity, religion) and the person panel's society card.
// Read-only views of LES.Society; shown only when the society system is on.
(function (LES) {
  'use strict';
  const U = LES.U, C = LES.C, P = LES.P, UI = LES.UI, S = LES.Society;
  const $ = id => document.getElementById(id);
  const esc = U.esc, pct = x => `${Math.round(x * 100)}%`;

  UI.renderSociety = function () {
    const w = UI.app.world, el = $('tab-society');
    if (!w.society) {
      el.innerHTML = '<div class="card"><h3>Society</h3><p class="note">Social class and religion are switched off in this world (Classic rules). Turn on <b>Social class &amp; religion</b> in New world to see them.</p></div>';
      return;
    }
    const st = w.society, h = w.history.filter(r => r.soc), last = h[h.length - 1];
    const xs = x => `Y${Math.floor(x) + 1}`;
    const mob = S.mobility(w), eth = S.groupStats(w, 'eth'), rel = S.groupStats(w, 'rel');
    const fest = LES.Calendar.festival(w.day), ram = LES.Calendar.ramadan(w.day);
    const relCount = last ? last.soc.rel : {};
    const living = Object.values(relCount).reduce((a, b) => a + b, 0) || 1;
    const fundOf = k => (st.funds[k] ? st.funds[k] : { bal: 0, inTotal: 0, outTotal: 0 });
    const mobRow = a => {
      const row = mob.m[a], n = S.CLASSES.reduce((s, b) => s + row[b], 0);
      return `<tr><td class="muted">${a}</td>${S.CLASSES.map(b => `<td${a === b ? ' style="font-weight:600"' : ''}>${n ? pct(row[b] / n) : '–'}</td>`).join('')}<td class="muted">${n}</td></tr>`;
    };
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="v">${U.fmtMoney(st.cut40)}</div><div class="l">B40 ceiling (household/mo, Y1 RM) · DOSM RM5,250</div></div>
        <div class="stat"><div class="v">${U.fmtMoney(st.cut80)}</div><div class="l">T20 floor · DOSM RM11,820</div></div>
        <div class="stat"><div class="v">${pct(st.t20share)}</div><div class="l">of all income goes to the T20</div></div>
        <div class="stat"><div class="v">${pct(st.belowB40)}</div><div class="l">households below RM5,250 (Malaysia: 40%)</div></div>
        <div class="stat"><div class="v">${w.living.filter(p => p.alive && p.elite).length}</div><div class="l">T1 elite (top 1%, RM1M+)</div></div>
        <div class="stat"><div class="v">${w.living.filter(p => p.alive && p.adult && p.hardship).length}</div><div class="l">adults in hardship</div></div>
      </div>
      <div class="card"><h3>Class lines <small class="muted">household income, Year-1 RM · dashed = DOSM 2024</small></h3><canvas class="chart" id="so-cut"></canvas>
        <div class="note">Class is calculated every month from household income (head + partner), the way DOSM defines B40, M40 and T20, so people move between classes as their lives change.</div></div>
      <div class="card"><h3>Social mobility <small class="muted">household class at 12 → own class at 35</small></h3>
        <table class="cmp"><tr><th>Grew up</th>${S.CLASSES.map(c => `<th>${c}</th>`).join('')}<th>n</th></tr>${S.CLASSES.map(mobRow).join('')}</table>
        <div class="note">${mob.n ? `Each row adds up to 100%. Bold = stayed in the class they grew up in. ${mob.n} people so far.` : 'Fills in once children born here reach 35.'} Mobility is one of the most telling results: compare it across seeds and settings.</div></div>
      <div class="card"><h3>Ethnic groups <small class="muted">adults alive now</small></h3>
        <table class="cmp"><tr><th>Group</th><th>Adults</th><th>Median NW</th><th>Median income</th><th>B40</th><th>T20</th><th>Degree</th></tr>
        ${C.ETHNICITIES.filter(k => eth[k]).map(k => { const g = eth[k]; return `<tr><td>${esc(C.ETHNIC_NAMES[k])}</td><td>${g.n}</td><td>${U.fmtMoney(g.medNw)}</td><td>${U.fmtMoney(g.medInc)}</td><td>${pct(g.b40 / g.n)}</td><td>${pct(g.t20 / g.n)}</td><td>${pct(g.uni / g.n)}</td></tr>`; }).join('')}</table>
        <div class="note">Every group starts from the same ability distributions; groups differ only in names, festivals and religion mix. Gaps that appear come from luck, family history and small samples, so check them across many seeds before reading anything into them.</div></div>
      <div class="card"><h3>Religion <small class="muted">${fest ? `🎉 ${esc(fest.name)} now · ` : ''}${ram ? '🌙 Ramadan · ' : ''}${h.length ? '' : ''}members and community funds</small></h3>
        <table class="cmp"><tr><th>Religion</th><th>People</th><th>Devotion</th><th>Worship visits<br><span class="muted">last month</span></th><th>Fund now</th><th>Aid given</th></tr>
        ${S.REL_KEYS.filter(k => relCount[k]).map(k => { const d = S.RELIGIONS[k], f = fundOf(k), g = rel[k], members = w.living.filter(p => p.alive && p.rel === k);
          const dev = members.length ? Math.round(members.reduce((s, p) => s + p.relig, 0) / members.length) : 0;
          return `<tr><td>${d.icon} ${esc(d.name)}</td><td>${relCount[k]} <span class="muted">(${pct(relCount[k] / living)})</span></td><td>${dev}/100</td><td>${(st.lastWorship || {})[k] || 0}</td><td>${U.fmtMoney(f.bal)}</td><td>${U.fmtMoney(f.outTotal)}</td></tr>`; }).join('')}</table>
        <canvas class="chart" id="so-rel"></canvas>
        <div class="grid2">
          <div><span class="muted">Zakat paid so far</span><span>${U.fmtMoney(st.zakatTotal)}</span></div>
          <div><span class="muted">Aid from community funds</span><span>${U.fmtMoney(st.aidTotal)}</span></div>
          <div><span class="muted">Festival spending</span><span>${U.fmtMoney(st.festivalSpend)}</span></div>
          <div><span class="muted">Interfaith couples / conversions</span><span>${st.interfaith} / ${st.conversions}</span></div>
        </div>
        <div class="note">Religion works only through practices: worship lowers stress and builds friendships but takes time; zakat and donations move money from members to their community's poor; Ramadan fasting tires people; devout Muslims avoid bars and non-Shariah shares; devotion raises the wish for children and lowers break-ups. No religion gets a hidden success bonus.</div></div>
      <p class="note">Results describe outcomes of this simulation under its assumptions (seed “${esc(w.cfg.seed)}”), not real-world facts about any group.</p>`;
    if (h.length) {
      LES.Charts.line($('so-cut'), {
        series: [
          { label: 'B40 ceiling', color: '#f4a261', data: h.map(r => [r.day / 365, r.soc.cut40]) },
          { label: 'T20 floor', color: '#f2c14e', data: h.map(r => [r.day / 365, r.soc.cut80]) },
          { label: 'DOSM B40', color: '#f4a261', dash: [4, 3], data: [[h[0].day / 365, U.RM(S.DOSM_B40_MAX)], [last.day / 365, U.RM(S.DOSM_B40_MAX)]] },
          { label: 'DOSM T20', color: '#f2c14e', dash: [4, 3], data: [[h[0].day / 365, U.RM(S.DOSM_T20_MIN)], [last.day / 365, U.RM(S.DOSM_T20_MIN)]] },
        ], yFmt: LES.Charts.fmtAxisMoney, xFmt: xs, yMin: 0,
      });
      LES.Charts.line($('so-rel'), { series: S.REL_KEYS.filter(k => relCount[k]).map(k => ({ label: S.RELIGIONS[k].name, color: S.RELIGIONS[k].colour, data: h.map(r => [r.day / 365, r.soc.rel[k] || 0]) })), xFmt: xs, yMin: 0 });
    }
  };

  // Card on the person panel.
  UI.societyCard = function (w, p) {
    if (!w.society || !p.rel) return '';
    const d = S.RELIGIONS[p.rel];
    const cls = p.cls ? `<span style="color:${S.CLASS_COLOURS[p.cls]}">${esc(S.CLASS_NAMES[p.cls])}</span>` : '<span class="muted">—</span>';
    return `<div class="card"><h3>Community</h3><div class="grid2">
      <div><span class="muted">Ethnicity</span><span>${esc(C.ETHNIC_NAMES[p.eth] || p.eth)}</span></div>
      <div><span class="muted">Religion</span><span>${d.icon} ${esc(d.name)}</span></div>
      <div><span class="muted">Household class</span><span>${cls}${p.elite ? ' · <span style="color:#f2c14e">T1 elite</span>' : ''}${p.hardship ? ' · <span class="neg">hardship</span>' : ''}</span></div>
      <div><span class="muted">Grew up in</span><span>${p.clsOrigin || '<span class="muted">—</span>'}</span></div>
      <div><span class="muted">Devotion</span><span>${p.relig}/100</span></div>
      <div><span class="muted">Given to community</span><span>${U.fmtMoney(p.donated)}</span></div>
      ${p.zakatPaid ? `<div><span class="muted">Zakat paid</span><span>${U.fmtMoney(p.zakatPaid)}</span></div>` : ''}
      ${p.aidRecv ? `<div><span class="muted">Aid received</span><span>${U.fmtMoney(p.aidRecv)}</span></div>` : ''}
    </div></div>`;
  };
})(globalThis.LES = globalThis.LES || {});
