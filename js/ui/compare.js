// Compare with a normal world (Phase 6): run the same seed, founders and length under today's rules (or
// under Classic when this world already uses today's rules) and set the two side by side. The run goes in
// small slices so the page stays responsive; the result also appears in the report. One town only.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, esc = U.esc;
  const CMP = LES.Compare = {};

  CMP.target = cfg => ((!cfg.scenario || cfg.scenario === 'none') && LES.presetOf(cfg) === 'national' ? 'classic' : 'national');
  CMP.label = cfg => (CMP.target(cfg) === 'classic' ? 'Classic rules' : "today's rules");
  CMP.config = function (cfg) {
    const t = CMP.target(cfg), c = Object.assign({}, cfg, LES.PRESETS[t].values, { scenario: 'none', preset: t });
    if (t === 'classic') c.country = 'my'; // Classic rules are Malaysia only
    return c;
  };
  CMP.summary = function (w) {
    const m = LES.Calibration.measure(w), h = w.history, last = h[h.length - 1] || {}, a = LES.Report ? LES.Report.analyse(w) : null;
    return {
      seed: w.cfg.seed, years: Math.floor(w.day / 365), winner: w.winner ? P.name(w.people[w.winner.pid]) : 'none', richest: a && a.top[0] ? a.top[0].peakReal : 0,
      median: last.median || 0, pop: last.pop || 0, gini: m.hhGini, unemp: m.unemp, wage: m.medWage, tfr: m.tfr, e0: w.day >= 3650 ? m.e0 : NaN, crime: w.crime ? m.crimeIdx : null, prison: w.crime ? m.prison : null,
      revenue: m.revenue, started: w.stats.bizStarted, failed: w.stats.bizFailed, happy: last.happy, millionaires: last.millionaires || 0, sym: U.sym(), k: LES.Countries.scale(),
    };
  };
  // [label, key, format] for the table
  const money = (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v / 100 * s.k).toLocaleString('en') : '–');
  const ROWS = [
    ['Who reached the goal', 'winner', (s, v) => esc(v)], ['Richest ever (Year-1 money)', 'richest', money], ['Median adult wealth at the end', 'median', money],
    ['People alive', 'pop', (s, v) => v], ['Millionaires (Year-1)', 'millionaires', (s, v) => v], ['Household income Gini', 'gini', (s, v) => (Number.isFinite(v) ? v.toFixed(2) : '–')],
    ['Unemployment', 'unemp', (s, v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '–')], ['Median monthly wage (Year-1)', 'wage', (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v * s.k).toLocaleString('en') : '–')],
    ['Children per woman', 'tfr', (s, v) => (Number.isFinite(v) ? v.toFixed(2) : '–')], ['Life expectancy', 'e0', (s, v) => (Number.isFinite(v) ? v.toFixed(1) : '–')],
    ['Crime per 100k (Realistic scale)', 'crime', (s, v) => (v === null ? 'crime off' : Number.isFinite(v) ? Math.round(v) : '– (from year 5)')], ['Prisoners per 100k', 'prison', (s, v) => (v === null ? 'crime off' : Number.isFinite(v) ? Math.round(v) : '–')],
    ['Public revenue per person / month', 'revenue', (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v * s.k).toLocaleString('en') : 'no government')],
    ['Businesses started / failed', 'started', (s, v, o) => `${v} / ${o.failed}`], ['Median happiness', 'happy', (s, v) => (Number.isFinite(v) ? Math.round(v) : '–')],
  ];
  CMP.table = (cur, base, label) => `<table class="cmp"><tr><th></th><th>This world</th><th>${esc(label)}</th></tr>${ROWS.map(([l, k, f]) => `<tr><td>${esc(l)}</td><td>${f(cur, cur[k], cur)}</td><td>${f(base, base[k], base)}</td></tr>`).join('')}</table>`;

  // Run the comparison world to the same day; onProgress(share) while it runs.
  CMP.run = function (w, onProgress) {
    return new Promise((resolve, reject) => {
      let b;
      try { b = new LES.World(CMP.config(w.cfg)); } catch (e) { reject(e); return; }
      const end = w.day, slice = () => {
        try {
          const stop = Math.min(end, b.day + 60);
          while (!b.ended && b.day < stop) b.step();
          if (onProgress) onProgress(b.day / Math.max(1, end));
          if (b.ended || b.day >= end) { const s = CMP.summary(b); LES.Countries.ensure(w.cfg); resolve(s); } else setTimeout(slice, 0);
        } catch (e) { LES.Countries.ensure(w.cfg); reject(e); }
      };
      setTimeout(slice, 0);
    });
  };

  CMP.open = function (app) {
    const w = app.world, $ = id => document.getElementById(id), card = $('modal-card'), label = CMP.label(w.cfg);
    card.classList.add('wide'); card.onclick = null;
    const show = body => { card.innerHTML = `<h1>Compare with ${esc(label)}</h1><p class="lead">The same seed, founders and ${Math.floor(w.day / 365)} years, under ${esc(label)}${CMP.target(w.cfg) === 'classic' ? ' (the original harsh engine, Malaysia only)' : ' with no scenario'}.</p>${body}<div class="modal-actions"><span class="spacer"></span><button class="primary" id="cmp-close">Close</button></div>`; $('cmp-close').onclick = () => $('modal').classList.add('hidden'); };
    if (app.region) { show('<p class="note">Comparisons run for single towns only.</p>'); $('modal').classList.remove('hidden'); return; }
    const done = app.compare && app.compare.seed === w.cfg.seed && app.compare.day === w.day && app.compare.label === label ? app.compare : null;
    if (done) { show(CMP.table(CMP.summary(w), done.base, label) + '<p class="note">The report includes this table too.</p>'); $('modal').classList.remove('hidden'); return; }
    show('<p>Running the comparison world… <b id="cmp-pct">0%</b></p><div class="track"><i id="cmp-bar" style="width:0%"></i></div><p class="note">It runs in the background in slices; the main simulation is paused meanwhile.</p>');
    $('modal').classList.remove('hidden');
    const wasPaused = app.paused; app.paused = true;
    CMP.run(w, f => { const e = $('cmp-pct'), bar = $('cmp-bar'); if (e) e.textContent = `${Math.round(f * 100)}%`; if (bar) bar.style.width = `${Math.round(f * 100)}%`; })
      .then(base => { app.compare = { seed: w.cfg.seed, day: w.day, label, base }; app.paused = wasPaused; if (!$('modal').classList.contains('hidden')) show(CMP.table(CMP.summary(w), base, label) + '<p class="note">The report includes this table too.</p>'); })
      .catch(e => { app.paused = wasPaused; show(`<p class="neg">The comparison failed: ${esc(e.message)}</p>`); });
  };
})(globalThis.LES = globalThis.LES || {});
