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
  const U = LES.U, C = LES.C, esc = U.esc;
  const T = (k, p) => LES.I18n.t(k, p);
  const $ = id => document.getElementById(id);

  // The cards: two base worlds, then the scenarios (built on Malaysia today).
  function cards() {
    const SC = LES.Scenarios, F = LES.Countries.fill;
    return [
      { key: 'national', scenario: 'none', preset: 'national', name: LES.PRESETS.national.name, icon: 'flag', short: F('A town of strangers in today\'s {country}, calibrated to official data.'),
        desc: F(`{adj} prices, wages, taxes, family life, religion, crime and ${LES.Gov && LES.Gov.appointed() ? 'an appointed city government' : 'an elected town government'}. Start here if this is your first world.`), watch: [F('Who reaches {goal}, and why'), 'How class, education and luck shape lives across generations', LES.Gov && LES.Gov.appointed() ? 'Appointed leaders, laws and what they change' : 'Elections, laws and what they change'] },
      ...SC.LIST.map(s => ({ key: s.id, scenario: s.id, preset: 'national', name: s.name, icon: s.icon, short: s.short, desc: s.desc, watch: s.watch, cfg: s.cfg })),
      { key: 'classic', scenario: 'none', preset: 'classic', name: 'Classic rules', icon: 'book-open', short: 'The original engine: harsh rules, no society, crime or government.',
        desc: 'No welfare, a higher birth rate and longer lives, a grid town, three ethnic groups, and none of the newer systems. For comparing with the original design.', watch: ['Survival without a safety net', F('The original {goal} race')] },
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
    // My cast as founders (ticked people, each with a town in a region).
    if ($('set-cast')) {
      const towns = Math.max(1, Number(cfg.towns) || 1), roster = LES.UI.castRoster();
      cfg.cast = [...document.querySelectorAll('#set-cast input[type=checkbox]:checked')].map(el => {
        const s = roster.find(o => o.id === el.dataset.id), t = $(`set-cast-town-${el.dataset.id}`);
        return s && Object.assign(JSON.parse(JSON.stringify(s)), { town: Math.min(towns - 1, t ? Number(t.value) : 0) });
      }).filter(Boolean);
    }
    if ($('set-cast-again') && !$('set-cast-again').checked) cfg.castArrivals = [];
    return cfg;
  }

  // "★ My cast as founders" (only when you have saved people): tick people to start the
  // town with them; ticking someone ticks their whole household.
  function castPicker(base) {
    const roster = LES.UI.castRoster ? LES.UI.castRoster() : [], again = (base.castArrivals || []).reduce((n, a) => n + a.specs.length, 0);
    const on = new Set((base.cast || []).map(s => s.id)), town = id => ((base.cast || []).find(s => s.id === id) || {}).town || 0;
    const rows = roster.map(s => {
      const fam = LES.Cast.householdOf(roster, s).filter(o => o !== s).map(o => o.first);
      return `<label class="cast-pick"><input type="checkbox" data-id="${esc(s.id)}" ${on.has(s.id) ? 'checked' : ''}> <b>${esc(s.first)} ${esc(s.last)}</b> <span class="muted">${s.age} · ${esc(C.ETHNIC_NAMES[s.eth] || s.eth)}${fam.length ? ` · with ${esc(fam.join(', '))}` : ''}</span>
        <select id="set-cast-town-${esc(s.id)}" class="cast-town" title="Which town (when there are several)">${[0, 1, 2].map(i => `<option value="${i}" ${town(s.id) === i ? 'selected' : ''}>Town ${i + 1}</option>`).join('')}</select></label>`;
    }).join('');
    return `<details class="set-cast" ${on.size || !roster.length ? 'open' : ''}><summary>★ My cast as founders: <b id="set-cast-sum">${on.size ? `${on.size} chosen` : 'none chosen'}</b></summary>
      <div id="set-cast">${rows || '<p class="note">You have no saved people yet. Design your own characters (looks, abilities, personality, family) and they found the town with the strangers.</p>'}</div>
      <div class="modal-actions" style="justify-content:flex-start"><button type="button" class="ghost" id="set-cast-new">＋ Create a person</button></div>
      ${again ? `<label class="cast-pick"><input type="checkbox" id="set-cast-again" checked> Also bring back the ${again} ${again > 1 ? 'people' : 'person'} you added during the last run (on the same days)</label>` : ''}
      <p class="note">Your cast lives by the same rules as everyone else. During a run you can also add or edit people in the Leaders tab → ★ My cast.</p></details>`;
  }

  function field(m, v) {
    let input;
    if (m.hidden) return `<input type="hidden" id="set-${m.key}" value="${esc(v)}">`;
    if (m.type === 'select') input = `<select id="set-${m.key}">${m.options.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (m.type === 'int' || m.type === 'num') input = `<input id="set-${m.key}" type="number" step="${m.step || 1}" min="${m.min}" max="${m.max}" value="${v}">`;
    else if (m.key === 'seed') input = `<div class="seed-row"><input id="set-${m.key}" type="text" maxlength="40" value="${esc(v)}"><button class="ghost" id="set-random" type="button" title="Pick a random seed">🎲</button></div>`;
    else input = `<input id="set-${m.key}" type="text" maxlength="40" value="${esc(v)}"${m.key === 'townName' ? ` placeholder="${esc(C.TOWN_NAME)}"` : ''}>`;
    return `<div class="field" data-key="${m.key}"><label for="set-${m.key}">${esc(m.label)}</label>${input}${m.help ? `<div class="help">${esc(m.help)}</div>` : ''}</div>`;
  }

  LES.Setup = {
    // over: settings to show instead of the last world's (used when the country changes).
    open(app, first, over) {
      const base = Object.assign({}, LES.DEFAULTS, app.lastCfg || {}, over || {});
      LES.Countries.ensure(base); // labels, prices and names of the chosen country
      const card = $('modal-card'), META = LES.SETTINGS_META, CARDS = cards();
      card.onclick = null;
      card.classList.remove('wide');
      card.classList.add('setup');
      LES.UI.bursaOpen = false;
      const F = LES.Countries.fill;
      let chosen = base.scenario && base.scenario !== 'none' ? base.scenario : (LES.presetOf(base) === 'classic' ? 'classic' : 'national');
      const adv = META.filter(m => !m.essential && m.group !== 'Scenario');
      card.innerHTML = `
        <h1>${esc(first ? T('app.title') : T('setup.newWorld'))}</h1>
        <p class="lead">${first
          ? F('A town of strangers, each born different, each chasing {goal}. Pick a world, set up your town, then watch who makes it, and why.')
          : esc(T('setup.replace'))}</p>
        <h2 class="set-step"><span>1</span> ${esc(T('setup.chooseWorld'))}</h2>
        <div class="scn-grid" role="radiogroup" aria-label="World">${CARDS.map(c => `<button type="button" class="scn-card${c.key === 'classic' ? ' mini' : ''}" role="radio" data-card="${c.key}">${LES.icon(c.icon, 22)}<b>${esc(c.name)}</b><small>${esc(c.short)}</small></button>`).join('')}</div>
        <div class="scn-detail" id="scn-detail"></div>
        ${META.filter(m => m.hidden).map(m => field(m, base[m.key])).join('')}
        <h2 class="set-step"><span>2</span> ${esc(T('setup.yourTown'))}</h2>
        <div class="form-grid">${META.filter(m => m.essential).map(m => field(m, base[m.key])).join('')}</div>
        ${castPicker(base)}
        <details class="set-adv"><summary>${LES.icon('sliders', 16)} ${esc(T('setup.advanced'))} <span class="muted">· ${esc(T('setup.advancedMore', { count: adv.length }))}</span></summary>
          ${LES.SETTINGS_GROUPS.map(g => { const ms = adv.filter(m => m.group === g); return ms.length ? `<h3 class="set-group">${esc(g)}</h3><div class="form-grid">${ms.map(m => field(m, base[m.key])).join('')}</div>` : ''; }).join('')}
          <p class="note">The engine's deeper constants (decision randomness, success curves, hiring weights) stay at the values from the design documents.</p>
        </details>
        <div class="msgs" id="set-msgs"></div>
        <div class="modal-actions">
          <button class="ghost" id="set-load" title="Open a world saved with 💾 Save">${esc(T('setup.load'))}</button>
          <input type="file" id="set-load-file" accept=".json,.gz,application/json,application/gzip" hidden>
          <button class="ghost" id="btn-sound-setup" title="Music &amp; sound effects">${LES.Audio.on ? '🔊 Sound on' : '🔇 Sound off'}</button>
          <label class="set-lang" title="${esc(T('setup.langNote'))}">🌐 <select id="set-lang" aria-label="${esc(T('common.language'))}">${LES.I18n.LANGS.map(([k, l]) => `<option value="${k}"${k === LES.I18n.lang() ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <span class="spacer"></span>
          ${first ? '' : `<button class="ghost" id="set-cancel">${esc(T('setup.cancel'))}</button>`}
          <button class="primary" id="set-start">${esc(T('setup.start'))}</button>
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
      // A new country: its own defaults (life expectancy, leader title, term), then the form again in its words.
      // Interface language: words only; the form keeps what was typed (the world is not touched).
      $('set-lang').onchange = e => LES.I18n.set(e.target.value, () => LES.Setup.open(app, first, readForm(base)));
      const reopen = (code, extra) => {
        const cfg = Object.assign(readForm(base), LES.Countries.get(code).defaults || {}, { country: code });
        LES.Countries.use(code);
        if (LES.presetOf(cfg) !== 'custom' || extra) Object.assign(cfg, LES.PRESETS[(extra && extra.preset) || 'national'].values, extra || {});
        const c = !extra && CARDS.find(x => x.key === chosen);
        if (c && c.cfg) Object.assign(cfg, c.cfg); // keep the chosen scenario's settings
        cfg.preset = LES.presetOf(cfg);
        LES.Setup.open(app, first, cfg);
      };
      const choose = key => {
        if (key === 'classic' && $('set-country').value !== 'my') return reopen('my', Object.assign({ scenario: 'none', preset: 'classic' }, LES.PRESETS.classic.values)); // Classic rules are Malaysia only
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
      // Ticking a cast member ticks their household; town choices show only with several towns.
      const castSync = e => {
        const box = e && e.target && e.target.closest && e.target.closest('#set-cast input[type=checkbox]');
        if (box) {
          const roster = LES.UI.castRoster(), s = roster.find(o => o.id === box.dataset.id);
          for (const m of LES.Cast.householdOf(roster, s)) { const el = card.querySelector(`#set-cast input[data-id="${m.id}"]`); if (el) el.checked = box.checked; }
        }
        if ($('set-cast')) {
          const n = card.querySelectorAll('#set-cast input[type=checkbox]:checked').length, many = (Number(($('set-towns') || {}).value) || 1) > 1;
          $('set-cast-sum').textContent = n ? `${n} chosen` : 'none chosen';
          for (const el of card.querySelectorAll('.cast-town')) el.hidden = !many;
        }
      };
      castSync();
      card.oninput = e => { syncPreset(e); refresh(); };
      card.onchange = e => {
        if (e.target.id === 'set-country') return reopen(e.target.value, chosen === 'classic' ? { scenario: 'none' } : null);
        castSync(e); syncPreset(e); refresh();
      };
      for (const el of card.querySelectorAll('.scn-card')) el.onclick = () => choose(el.dataset.card);
      // Create a person from here: the creator borrows this dialog, then the setup comes back
      // with every choice kept and the new person ticked.
      $('set-cast-new').onclick = () => {
        const cfg = readForm(base);
        cfg.preset = LES.presetOf(cfg);
        card.oninput = card.onchange = null; // the setup's handlers must not see the creator's fields
        LES.UI.openCastCreator(-1, s => {
          if (s) cfg.cast = (cfg.cast || []).concat([Object.assign(JSON.parse(JSON.stringify(s)), { town: 0 })]);
          LES.Setup.open(app, first, cfg);
        });
      };
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
      if (w) LES.Countries.ensure(w.cfg); // back to the running world's country
      LES.Audio.setScene(w && w.ended ? 'report' : null);
    },
    isOpen() { return !$('modal').classList.contains('hidden'); },
  };
})(globalThis.LES = globalThis.LES || {});
