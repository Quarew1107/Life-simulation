// Compare with a normal world (Phase 6): run the same seed, founders and length under today's rules (or
// under Classic settings when this world already uses today's rules) and set the two side by side. The run goes in
// small slices so the page stays responsive; the result also appears in the report. One town only.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, esc = U.esc;
  const CMP = LES.Compare = {};

  // What a world can be compared with:
  //   'national' today's rules in the same country (for a scenario, Classic or custom world);
  //   'basic'    the same country under the Classic settings, with the extra systems off (for a world under
  //              today's rules outside Malaysia: same prices, wages and people, so amounts stay comparable);
  //   'classic'  the original Classic rules, which belong to Malaysia.
  CMP.targets = function (cfg) {
    const today = (!cfg.scenario || cfg.scenario === 'none') && LES.presetOf(cfg) === 'national';
    if (!today) return ['national'];
    return LES.Countries.of(cfg) === LES.Countries.DEFAULT ? ['classic'] : ['basic', 'classic'];
  };
  CMP.target = (cfg, kind) => { const t = CMP.targets(cfg); return t.includes(kind) ? kind : t[0]; };
  const T = (k, p) => LES.I18n.t(k, p), G = s => LES.I18n.g(s); // PL-17 (English text is word for word as before)
  const countryName = code => { const p = LES.Countries.get(code); return G(p ? p.name : code); };
  CMP.label = function (cfg, kind) {
    const t = CMP.target(cfg, kind), here = LES.Countries.of(cfg) === LES.Countries.DEFAULT;
    if (t === 'national') return T('cm.today');
    if (t === 'basic') return T('cm.classicIn', { country: countryName(LES.Countries.of(cfg)) });
    return here ? T('cm.classic') : T('cm.classicIn', { country: countryName(LES.Countries.DEFAULT) });
  };
  // One line on what the other world is, for the window and the option buttons.
  CMP.describe = function (cfg, kind) {
    const t = CMP.target(cfg, kind), c = countryName(LES.Countries.of(cfg));
    if (t === 'national') return T('cm.d.today', { c });
    if (t === 'basic') return T('cm.d.basic', { c });
    return T('cm.d.classic', { c: countryName(LES.Countries.DEFAULT) });
  };
  CMP.config = function (cfg, kind) {
    const t = CMP.target(cfg, kind), preset = t === 'national' ? 'national' : 'classic';
    const c = Object.assign({}, cfg, LES.PRESETS[preset].values, { scenario: 'none', preset });
    if (t === 'classic') c.country = LES.Countries.DEFAULT; // the original rules are Malaysia's
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
    if (sc) return T('pn.st.scenario', { name: G(sc.name) });
    const k = LES.presetOf(cfg);
    return k === 'custom' ? T('cm.custom') : G(LES.PRESETS[k].name);
  };
  // [label, key, format] for the table. A blank result says why (C10): too short a run, or too few people.
  const NA = s => `<span class="muted">${esc(T(s.years < 10 ? 'cm.na10' : 'cm.na'))}</span>`;
  const money = (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v / 100 * s.k).toLocaleString('en') : NA(s));
  const META = [
    ['cm.r.country', 'country', (s, v) => esc(G(v))], ['cm.r.rules', 'rules', (s, v, o) => `${esc(G(v))} <span class="muted">(${esc(T('cm.rev', { n: o.rev }))})</span>`],
    ['cm.r.years', 'years', (s, v) => v], ['cm.r.adults', 'adults', (s, v) => v],
    ['cm.r.sandbox', 'sandbox', (s, v) => (v ? `<b>${esc(T('cm.yesSandbox'))}</b>` : esc(T('cm.no')))],
  ];
  const ROWS = [
    ['cm.r.winner', 'winner', (s, v, o) => (v === null ? esc(T(o.ended ? 'cm.nobody' : 'pn.nobodyYet')) : esc(v))], ['cm.r.richest', 'richest', money], ['cm.r.median', 'median', money],
    ['cm.r.pop', 'pop', (s, v) => v], ['cm.r.millionaires', 'millionaires', (s, v) => v], ['cm.r.gini', 'gini', (s, v) => (Number.isFinite(v) ? v.toFixed(2) : NA(s))],
    ['cm.r.unemp', 'unemp', (s, v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : NA(s))], ['cm.r.wage', 'wage', (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v * s.k).toLocaleString('en') : NA(s))],
    ['cm.r.tfr', 'tfr', (s, v) => (Number.isFinite(v) ? v.toFixed(2) : NA(s))], ['cm.r.e0', 'e0', (s, v) => (Number.isFinite(v) ? v.toFixed(1) : NA(s))],
    ['cm.r.crime', 'crime', (s, v) => (v === null ? esc(T('cm.crimeOff')) : Number.isFinite(v) ? Math.round(v) : esc(T('cm.from5')))], ['cm.r.prison', 'prison', (s, v) => (v === null ? esc(T('cm.crimeOff')) : Number.isFinite(v) ? Math.round(v) : NA(s))],
    ['cm.r.revenue', 'revenue', (s, v) => (Number.isFinite(v) ? s.sym + Math.round(v * s.k).toLocaleString('en') : esc(T('cm.noGov')))],
    ['cm.r.started', 'started', (s, v, o) => `${v} / ${o.failed}`], ['cm.r.happy', 'happy', (s, v) => (Number.isFinite(v) ? Math.round(v) : NA(s))],
  ];
  const cell = (s, k, f, meta) => (meta && s[k] === undefined ? '–' : f(s, s[k], s)); // '–' only for a header field missing from an older summary
  const row = (cur, base, meta) => ([l, k, f]) => `<tr><td>${esc(T(l))}</td><td>${cell(cur, k, f, meta)}</td><td>${cell(base, k, f, meta)}</td></tr>`;
  CMP.table = (cur, base, label) => `<table class="cmp"><tr><th></th><th>${esc(T('cm.thisWorld'))}</th><th>${esc(label)}</th></tr>${META.map(row(cur, base, true)).join('')}<tr><td colspan="3"></td></tr>${ROWS.map(row(cur, base)).join('')}</table>${CMP.note(cur, base)}`;
  // How to read the table (C10): what kind of comparison this is, and the cautions that apply to these two runs.
  CMP.note = function (cur, base) {
    const warn = [];
    if (cur.country && base.country && cur.country !== base.country) warn.push(esc(T('cm.w.country', { a: G(cur.country), b: G(base.country) })));
    if (Math.min(cur.years, base.years) < 20) warn.push(esc(T('cm.w.years')));
    if (Math.min(cur.adults || 0, base.adults || 0) < 100) warn.push(esc(T('cm.w.adults')));
    if (cur.sandbox || base.sandbox) warn.push(esc(T('cm.w.sandbox')));
    return `<p class="note">${T('cm.howHtml')}</p>${warn.length ? `<ul class="note">${warn.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}`;
  };

  // Run the comparison world to the same day; onProgress(share) while it runs. The other world may use
  // another country pack, and the country tables are shared (money sign, signs, art style, names): every
  // slice puts back the pack that was active before it, so nothing drawn between slices ever shows the
  // other world's country, and the map's cached tiles are never painted with it.
  CMP.run = function (w, onProgress, kind) {
    const K = LES.Countries;
    const guarded = fn => { const before = K.active; try { return fn(); } finally { if (K.active !== before) K.use(before); } };
    return new Promise((resolve, reject) => {
      let b;
      try { b = guarded(() => new LES.World(CMP.config(w.cfg, kind))); } catch (e) { reject(e); return; }
      const end = w.day, slice = () => {
        let s = null;
        try {
          guarded(() => {
            const stop = Math.min(end, b.day + 60);
            while (!b.ended && b.day < stop) b.step();
            if (b.ended || b.day >= end) { K.ensure(b.cfg); s = CMP.summary(b); } // read in the other world's money
          });
        } catch (e) { reject(e); return; }
        if (onProgress) onProgress(s ? 1 : b.day / Math.max(1, end));
        if (s) resolve(s); else setTimeout(slice, 0);
      };
      setTimeout(slice, 0);
    });
  };

  // kind: which comparison (see CMP.targets); without one, the last one run for this world or the first option.
  CMP.open = function (app, kind) {
    const w = app.world, $ = id => document.getElementById(id), card = $('modal-card');
    const last = app.compare && app.compare.seed === w.cfg.seed && app.compare.day === w.day ? app.compare : null;
    const t = CMP.target(w.cfg, kind || (last && last.kind)), label = CMP.label(w.cfg, t), opts = CMP.targets(w.cfg);
    card.classList.add('wide'); card.onclick = null;
    const pick = busy => (opts.length > 1 ? `<div class="cmp-pick"><span class="muted">${esc(T('cm.with'))}</span><div class="seg wrap">${opts.map(k => `<button type="button" data-cmp="${k}" class="${k === t ? 'on' : ''}"${busy ? ' disabled' : ''} title="${esc(CMP.describe(w.cfg, k))}">${esc(CMP.label(w.cfg, k))}</button>`).join('')}</div></div>` : '');
    const show = (body, busy) => {
      card.innerHTML = `<h1>${esc(T('end.compare', { label }))}</h1>${pick(busy)}<p class="lead">${esc(T('cm.lead', { years: Math.floor(w.day / 365), what: CMP.describe(w.cfg, t) }))}</p>${body}<div class="modal-actions"><span class="spacer"></span><button class="primary" id="cmp-close">${esc(T('pn.tb.close'))}</button></div>`;
      $('cmp-close').onclick = () => $('modal').classList.add('hidden');
      for (const btn of card.querySelectorAll('[data-cmp]')) btn.onclick = () => { if (btn.dataset.cmp !== t) CMP.open(app, btn.dataset.cmp); };
    };
    if (app.region) { show(`<p class="note">${esc(T('cm.single'))}</p>`); $('modal').classList.remove('hidden'); return; }
    const done = last && last.kind === t ? last : null; // (by kind: the label is in the reader's language)
    if (done) { show(CMP.table(CMP.summary(w), done.base, label) + `<p class="note">${esc(T('cm.inReport'))}</p>`); $('modal').classList.remove('hidden'); return; }
    show(`<div class="cmp-run"><p>${esc(T('cm.running'))} <b id="cmp-pct">0%</b></p><div class="track"><i id="cmp-bar" style="width:0%"></i></div><p class="note">${esc(T('cm.slices'))}</p></div>`, true);
    $('modal').classList.remove('hidden');
    const wasPaused = app.paused; app.paused = true;
    CMP.run(w, f => { const e = $('cmp-pct'), bar = $('cmp-bar'); if (e) e.textContent = `${Math.round(f * 100)}%`; if (bar) bar.style.width = `${Math.round(f * 100)}%`; }, t)
      .then(base => { app.compare = { seed: w.cfg.seed, day: w.day, kind: t, label, base }; app.paused = wasPaused; if (!$('modal').classList.contains('hidden') && $('cmp-pct')) show(CMP.table(CMP.summary(w), base, label) + `<p class="note">${esc(T('cm.inReport'))}</p>`); })
      .catch(e => { app.paused = wasPaused; show(`<p class="neg">${esc(T('cm.failed', { msg: e.message }))}</p>`); });
  };
})(globalThis.LES = globalThis.LES || {});
