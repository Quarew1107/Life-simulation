// "New world" dialog: Normal Settings form with live validation (blockers / warnings).
(function (LES) {
  'use strict';
  const U = LES.U;
  const $ = id => document.getElementById(id);

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
    if (m.type === 'select') input = `<select id="set-${m.key}">${m.options.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${U.esc(l)}</option>`).join('')}</select>`;
    else if (m.type === 'int' || m.type === 'num') input = `<input id="set-${m.key}" type="number" step="${m.step || 1}" min="${m.min}" max="${m.max}" value="${v}">`;
    else input = `<input id="set-${m.key}" type="text" maxlength="40" value="${U.esc(v)}">`;
    return `<div class="field"><label for="set-${m.key}">${U.esc(m.label)}</label>${input}${m.help ? `<div class="help">${U.esc(m.help)}</div>` : ''}</div>`;
  }

  LES.Setup = {
    open(app, first) {
      const base = Object.assign({}, LES.DEFAULTS, app.lastCfg || {});
      const card = $('modal-card');
      card.onclick = null;
      card.classList.remove('wide');
      LES.UI.bursaOpen = false;
      card.innerHTML = `
        <h1>${first ? 'Life Evolution Simulator' : 'Create a new world'}</h1>
        <p class="lead">${first
          ? 'A town of strangers, each born different, each chasing RM100 million. You set the rules of the world — then you can only watch who makes it, and why.'
          : 'Change the rules, then start a fresh world. The current world will be replaced.'}</p>
        ${['World', 'Economy', 'Society'].map(g => `<h2 class="set-group">${g}</h2><div class="form-grid">${LES.SETTINGS_META.filter(m => m.group === g).map(m => field(m, base[m.key])).join('')}</div>`).join('')}
        <details class="set-adv"><summary>Advanced settings</summary><div class="form-grid">${LES.SETTINGS_META.filter(m => m.group === 'Advanced').map(m => field(m, base[m.key])).join('')}</div></details>
        <div class="msgs" id="set-msgs"></div>
        <div class="modal-actions">
          <button class="ghost" id="set-random">Random seed</button>
          <button class="ghost" id="set-load" title="Open a world saved with 💾 Save">📂 Load saved world</button>
          <input type="file" id="set-load-file" accept=".json,.gz,application/json,application/gzip" hidden>
          <button class="ghost" id="btn-sound-setup" title="Music &amp; sound effects">${LES.Audio.on ? '🔊 Sound on' : '🔇 Sound off'}</button>
          <span class="spacer"></span>
          ${first ? '' : '<button class="ghost" id="set-cancel">Cancel</button>'}
          <button class="primary" id="set-start">Start simulation</button>
        </div>`;
      $('modal').classList.remove('hidden');
      LES.Audio.setScene('setup');

      const refresh = () => {
        const v = LES.validateConfig(readForm(base));
        $('set-msgs').innerHTML = v.blockers.map(b => `<div class="msg block">⛔ ${U.esc(b)}</div>`).join('')
          + v.warnings.map(x => `<div class="msg warn">⚠️ ${U.esc(x)}</div>`).join('');
        $('set-start').disabled = v.blockers.length > 0;
        $('set-start').style.opacity = v.blockers.length ? 0.5 : 1;
        return v;
      };
      // Picking a preset fills its settings; editing one of them switches the preset to Custom.
      const syncPreset = e => {
        const sel = $('set-preset');
        if (e && e.target === sel) {
          const pr = LES.PRESETS[sel.value];
          if (pr) for (const [k, v] of Object.entries(pr.values)) { const el = $(`set-${k}`); if (el) el.value = v; }
        } else if (sel) sel.value = LES.presetOf(readForm(base));
      };
      card.oninput = e => { syncPreset(e); refresh(); };
      card.onchange = e => { syncPreset(e); refresh(); };
      $('set-load').onclick = () => $('set-load-file').click();
      $('set-load-file').onchange = e => { const f = e.target.files[0]; if (f) app.loadWorld(f); e.target.value = ''; };
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
      setTimeout(() => $('set-start').focus(), 0);
    },
    close() {
      $('modal').classList.add('hidden');
      const w = LES_APP.world;
      LES.Audio.setScene(w && w.ended ? 'report' : null);
    },
    isOpen() { return !$('modal').classList.contains('hidden'); },
  };
})(globalThis.LES = globalThis.LES || {});
