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
      seed: w.cfg.seed, years: Math.floor(w.day / 365), winner: w.winner ? P.name(w.people[w.winner.pid]) : null, ended: !!w.ended,
      country: LES.Countries.pack.name, rules: CMP.rulesName(w.cfg), rev: w.cfg.rulesRev || 1, adults: last.adults || 0, sandbox: !!(LES.God && LES.God.intervened(w)), richest: a && a.top[0] ? a.top[0].peakReal : 0,
      median: last.median || 0, pop: last.pop || 0, gini: m.hhGini, unemp: m.unemp, wage: m.medWage, tfr: m.tfr, e0: w.day >= 3650 ? m.e0 : NaN, crime: w.crime ? m.crimeIdx : null, prison: w.crime ? m.prison : null,
      revenue: m.revenue, started: w.stats.bizStarted, failed: w.stats.bizFailed, happy: last.happy, millionaires: last.millionaires || 0, sym: U.sym(), k: LES.Countries.scale(),
    };
  };
  // The rules a world runs under, in words (C10): a scenario, a preset or custom settings.
  CMP.rulesName = function (cfg) {
    const sc = cfg.scenario && cfg.scenario !== 'none' && LES.Scenarios ? LES.Scenarios.BY_ID[cfg.scenario] : null;
    if (sc) return `Scenario: ${sc.name}`;
    const k = LES.presetOf(cfg);
    return k === 'custom' ? 'Custom settings' : LES.PRESETS[k].name;
  };
  // [label, key, format] for the table. A blank result says why (C10): too short a run, or too few people.
  const NA = s => `<span class="muted">insufficient data${s.years < 10 ? ' (under 10 years)' : ''}</span>`;
  const money = (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v / 100 * s.k).toLocaleString('en') : NA(s));
  const META = [
    ['Country', 'country', (s, v) => esc(v)], ['Rules', 'rules', (s, v, o) => `${esc(v)} <span class="muted">(rules version ${o.rev})</span>`],
    ['Years simulated', 'years', (s, v) => v], ['Adults at the end (sample size)', 'adults', (s, v) => v],
    ['Changed by you (God Mode Fate)', 'sandbox', (s, v) => (v ? '<b>yes: a sandbox world</b>' : 'no')],
  ];
  const ROWS = [
    ['Who reached the goal', 'winner', (s, v, o) => (v === null ? (o.ended ? 'nobody' : 'nobody yet') : esc(v))], ['Richest ever (Year-1 money)', 'richest', money], ['Median adult wealth at the end', 'median', money],
    ['People alive', 'pop', (s, v) => v], ['Millionaires (Year-1)', 'millionaires', (s, v) => v], ['Household income Gini', 'gini', (s, v) => (Number.isFinite(v) ? v.toFixed(2) : NA(s))],
    ['Unemployment', 'unemp', (s, v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : NA(s))], ['Median monthly wage (Year-1)', 'wage', (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v * s.k).toLocaleString('en') : NA(s))],
    ['Children per woman', 'tfr', (s, v) => (Number.isFinite(v) ? v.toFixed(2) : NA(s))], ['Life expectancy', 'e0', (s, v) => (Number.isFinite(v) ? v.toFixed(1) : NA(s))],
    ['Crime per 100k (Realistic scale)', 'crime', (s, v) => (v === null ? 'crime off' : Number.isFinite(v) ? Math.round(v) : '– (from year 5)')], ['Prisoners per 100k', 'prison', (s, v) => (v === null ? 'crime off' : Number.isFinite(v) ? Math.round(v) : NA(s))],
    ['Public revenue per person / month', 'revenue', (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v * s.k).toLocaleString('en') : 'no government')],
    ['Businesses started / failed', 'started', (s, v, o) => `${v} / ${o.failed}`], ['Median happiness', 'happy', (s, v) => (Number.isFinite(v) ? Math.round(v) : NA(s))],
  ];
  const cell = (s, k, f, meta) => (meta && s[k] === undefined ? '–' : f(s, s[k], s)); // '–' only for a header field missing from an older summary
  const row = (cur, base, meta) => ([l, k, f]) => `<tr><td>${esc(l)}</td><td>${cell(cur, k, f, meta)}</td><td>${cell(base, k, f, meta)}</td></tr>`;
  CMP.table = (cur, base, label) => `<table class="cmp"><tr><th></th><th>This world</th><th>${esc(label)}</th></tr>${META.map(row(cur, base, true)).join('')}<tr><td colspan="3"></td></tr>${ROWS.map(row(cur, base)).join('')}</table>${CMP.note(cur, base)}`;
  // How to read the table (C10): what kind of comparison this is, and the cautions that apply to these two runs.
  CMP.note = function (cur, base) {
    const warn = [];
    if (cur.country && base.country && cur.country !== base.country) warn.push(`The two worlds are in different countries (${esc(cur.country)} and ${esc(base.country)}): money is in each country's own currency and prices, so compare directions and ranks, not amounts.`);
    if (Math.min(cur.years, base.years) < 20) warn.push('Fewer than 20 years simulated: careers, families and fortunes have barely started, so most differences are still noise.');
    if (Math.min(cur.adults || 0, base.adults || 0) < 100) warn.push('Fewer than 100 adults in a world: one or two unusual people can move these figures a lot.');
    if (cur.sandbox || base.sandbox) warn.push('A world you changed with God Mode Fate is a sandbox world: its differences include your intervention.');
    return `<p class="note"><b>How to read this.</b> This is a <b>same-seed world comparison</b>, not a matched experiment. Both worlds start from the same seed and founders, but once the rules differ, events use the random numbers in a different order and later lives diverge. A difference shows what happened in these two runs; one pair of runs cannot prove that the rule change caused it. Repeat with several seeds before drawing a conclusion.</p>${warn.length ? `<ul class="note">${warn.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}`;
  };

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
