// "New world" dialog, in three steps:
//   1. Choose a world: Malaysia today, Classic rules or one of the what-if scenarios
//      (cards; the chosen scenario's description and options appear below them).
//   2. Your town: the few settings people change most (population, years, starting
//      wealth, economy, crime, seed).
//   3. Advanced settings: everything else, grouped and folded away.
// Live validation shows blockers and warnings. Picking a card fills the settings it needs;
// editing a base rule afterwards switches the rules to Custom.
(function (LES) {
  'use strict';
  const U = LES.U, esc = U.esc;
  const $ = id => document.getElementById(id);

  // The cards: two base worlds, then the scenarios (built on Malaysia today).
  function cards() {
    const SC = LES.Scenarios;
    return [
      { key: 'malaysia', scenario: 'none', preset: 'malaysia', name: 'Malaysia today', icon: 'flag', short: 'A town of strangers in today\'s Malaysia, calibrated to official data.',
        desc: 'Malaysian prices, wages, taxes, family life, religion, crime and an elected town government. Start here if this is your first world.', watch: ['Who reaches RM100 million, and why', 'How class, education and luck shape lives across generations', 'Elections, laws and what they change'] },
      ...SC.LIST.map(s => ({ key: s.id, scenario: s.id, preset: 'malaysia', name: s.name, icon: s.icon, short: s.short, desc: s.desc, watch: s.watch, cfg: s.cfg })),
      { key: 'classic', scenario: 'none', preset: 'classic', name: 'Classic rules', icon: 'book-open', short: 'The original engine: harsh rules, no society, crime or government.',
        desc: 'No welfare, a higher birth rate and longer lives, a grid town, three ethnic groups, and none of the newer systems. For comparing with the original design.', watch: ['Survival without a safety net', 'The original RM100 million race'] },
    ];
  }

  function readForm(base) {
    const cfg = Object.assign({}, base);
    for (const m of LES.SETTINGS_META) {
      const el = $(`set-${m.key}`);
      if (!el) continue;
      if (m.type === 'int' || m.type === 'num') cfg[m.key] = el.value.trim() === '' ? NaN : Number(el.value);
      else cfg[m.key] = el.value;
    }
    return cfg;
  }

  function field(m, v) {
    let input;
    if (m.hidden) return `<input type="hidden" id="set-${m.key}" value="${esc(v)}">`;
    if (m.type === 'select') input = `<select id="set-${m.key}">${m.options.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (m.type === 'int' || m.type === 'num') input = `<input id="set-${m.key}" type="number" step="${m.step || 1}" min="${m.min}" max="${m.max}" value="${v}">`;
    else if (m.key === 'seed') input = `<div class="seed-row"><input id="set-${m.key}" type="text" maxlength="40" value="${esc(v)}"><button class="ghost" id="set-random" type="button" title="Pick a random seed">🎲</button></div>`;
    else input = `<input id="set-${m.key}" type="text" maxlength="40" value="${esc(v)}">`;
    return `<div class="field" data-key="${m.key}"><label for="set-${m.key}">${esc(m.label)}</label>${input}${m.help ? `<div class="help">${esc(m.help)}</div>` : ''}</div>`;
  }

  LES.Setup = {
    open(app, first) {
      const base = Object.assign({}, LES.DEFAULTS, app.lastCfg || {});
      const card = $('modal-card'), META = LES.SETTINGS_META, CARDS = cards();
      card.onclick = null;
      card.classList.remove('wide');
      card.classList.add('setup');
      LES.UI.bursaOpen = false;
      let chosen = base.scenario && base.scenario !== 'none' ? base.scenario : (LES.presetOf(base) === 'classic' ? 'classic' : 'malaysia');
      const adv = META.filter(m => !m.essential && m.group !== 'Scenario');
      card.innerHTML = `
        <h1>${first ? 'Life Evolution Simulator' : 'Create a new world'}</h1>
        <p class="lead">${first
          ? 'A town of strangers, each born different, each chasing RM100 million. Pick a world, set up your town, then watch who makes it, and why.'
          : 'Pick a world and set up the town. The current world will be replaced.'}</p>
        <h2 class="set-step"><span>1</span> Choose a world</h2>
        <div class="scn-grid" role="radiogroup" aria-label="World">${CARDS.map(c => `<button type="button" class="scn-card${c.key === 'classic' ? ' mini' : ''}" role="radio" data-card="${c.key}">${LES.icon(c.icon, 22)}<b>${esc(c.name)}</b><small>${esc(c.short)}</small></button>`).join('')}</div>
        <div class="scn-detail" id="scn-detail"></div>
        ${META.filter(m => m.hidden).map(m => field(m, base[m.key])).join('')}
        <h2 class="set-step"><span>2</span> Your town</h2>
        <div class="form-grid">${META.filter(m => m.essential).map(m => field(m, base[m.key])).join('')}</div>
        <details class="set-adv"><summary>${LES.icon('sliders', 16)} Advanced settings <span class="muted">· ${adv.length} more: map, goal, prices, families, society, justice, government</span></summary>
          ${LES.SETTINGS_GROUPS.map(g => { const ms = adv.filter(m => m.group === g); return ms.length ? `<h3 class="set-group">${esc(g)}</h3><div class="form-grid">${ms.map(m => field(m, base[m.key])).join('')}</div>` : ''; }).join('')}
          <p class="note">The engine's deeper constants (decision randomness, success curves, hiring weights) stay at the values from the design documents.</p>
        </details>
        <div class="msgs" id="set-msgs"></div>
        <div class="modal-actions">
          <button class="ghost" id="set-load" title="Open a world saved with 💾 Save">📂 Load saved world</button>
          <input type="file" id="set-load-file" accept=".json,.gz,application/json,application/gzip" hidden>
          <button class="ghost" id="btn-sound-setup" title="Music &amp; sound effects">${LES.Audio.on ? '🔊 Sound on' : '🔇 Sound off'}</button>
          <span class="spacer"></span>
          ${first ? '' : '<button class="ghost" id="set-cancel">Cancel</button>'}
          <button class="primary" id="set-start">Start simulation</button>
        </div>`;
      $('modal').classList.remove('hidden');
      LES.Audio.setScene('setup');

      // Scenario options live in the detail box (kept in the form so readForm sees them).
      const optsHtml = key => META.filter(m => m.scenario === key).map(m => field(m, base[m.key])).join('');
      const renderDetail = () => {
        const c = CARDS.find(x => x.key === chosen);
        for (const el of card.querySelectorAll('.scn-card')) { const on = el.dataset.card === chosen; el.classList.toggle('on', on); el.setAttribute('aria-checked', on); }
        const keep = {};
        for (const el of $('scn-detail').querySelectorAll('select')) keep[el.id] = el.value;
        const opts = optsHtml(chosen);
        $('scn-detail').innerHTML = `<div class="scn-head">${LES.icon(c.icon, 28)}<div><b>${esc(c.name)}</b><p>${esc(c.desc)}</p></div></div>
          <div class="scn-cols"><div><h4>What to watch</h4><ul>${c.watch.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          ${opts ? `<div><h4>Options</h4><div class="scn-opts">${opts}</div></div>` : ''}</div>
          ${c.cfg ? `<p class="note">Sets: ${Object.entries(c.cfg).map(([k, v]) => { const m = META.find(x => x.key === k); return m ? `${esc(m.label)} → ${esc(m.options ? (m.options.find(o => o[0] === v) || [, v])[1] : v)}` : ''; }).filter(Boolean).join(' · ')}.</p>` : ''}`;
        for (const id in keep) if ($(id)) $(id).value = keep[id];
      };
      const choose = key => {
        chosen = key;
        const c = CARDS.find(x => x.key === key);
        $('set-scenario').value = c.scenario;
        const touched = {}; // settings another scenario may have changed go back to their defaults first
        for (const x of CARDS) for (const k of Object.keys(x.cfg || {})) touched[k] = LES.DEFAULTS[k];
        const fill = Object.assign(touched, LES.PRESETS[c.preset].values, c.cfg || {});
        for (const [k, v] of Object.entries(fill)) { const el = $(`set-${k}`); if (el) el.value = v; }
        $('set-preset').value = LES.presetOf(readForm(base));
        renderDetail();
        refresh();
      };

      const refresh = () => {
        const v = LES.validateConfig(readForm(base));
        $('set-msgs').innerHTML = v.blockers.map(b => `<div class="msg block">⛔ ${esc(b)}</div>`).join('')
          + v.warnings.map(x => `<div class="msg warn">⚠️ ${esc(x)}</div>`).join('');
        $('set-start').disabled = v.blockers.length > 0;
        $('set-start').style.opacity = v.blockers.length ? 0.5 : 1;
        return v;
      };
      // Picking base rules fills their settings; editing one of them switches the rules to Custom.
      const syncPreset = e => {
        const sel = $('set-preset');
        if (e && e.target === sel) {
          const pr = LES.PRESETS[sel.value];
          if (pr) for (const [k, v] of Object.entries(pr.values)) { const el = $(`set-${k}`); if (el) el.value = v; }
        } else if (sel) sel.value = LES.presetOf(readForm(base));
      };
      card.oninput = e => { syncPreset(e); refresh(); };
      card.onchange = e => { syncPreset(e); refresh(); };
      for (const el of card.querySelectorAll('.scn-card')) el.onclick = () => choose(el.dataset.card);
      $('set-load').onclick = () => $('set-load-file').click();
      $('set-load-file').onchange = e => { const f = e.target.files[0]; if (f) app.loadWorld(f); e.target.value = ''; };
      renderDetail();
      refresh();
      $('btn-sound-setup').onclick = () => { $('btn-sound-setup').textContent = app.toggleSound() ? '🔊 Sound on' : '🔇 Sound off'; };
      $('set-random').onclick = () => { $('set-seed').value = `world-${Math.floor(Math.random() * 1e6)}`; refresh(); };
      if (!first) $('set-cancel').onclick = () => LES.Setup.close();
      $('set-start').onclick = () => {
        if (refresh().blockers.length) return;
        const cfg = readForm(base);
        cfg.seed = cfg.seed.trim();
        if (app.newWorld(cfg)) LES.Setup.close();
      };
      card.scrollTop = 0;
      setTimeout(() => $('set-start').focus({ preventScroll: true }), 0);
    },
    close() {
      $('modal').classList.add('hidden');
      $('modal-card').classList.remove('setup');
      const w = LES_APP.world;
      LES.Audio.setScene(w && w.ended ? 'report' : null);
    },
    isOpen() { return !$('modal').classList.contains('hidden'); },
  };
})(globalThis.LES = globalThis.LES || {});
