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
          <span class="spacer"></span>
          ${first ? '' : '<button class="ghost" id="set-cancel">Cancel</button>'}
          <button class="primary" id="set-start">Start simulation</button>
        </div>`;
      $('modal').classList.remove('hidden');

      const refresh = () => {
        const v = LES.validateConfig(readForm(base));
        $('set-msgs').innerHTML = v.blockers.map(b => `<div class="msg block">⛔ ${U.esc(b)}</div>`).join('')
          + v.warnings.map(x => `<div class="msg warn">⚠️ ${U.esc(x)}</div>`).join('');
        $('set-start').disabled = v.blockers.length > 0;
        $('set-start').style.opacity = v.blockers.length ? 0.5 : 1;
        return v;
      };
      card.oninput = refresh;
      card.onchange = refresh;
      refresh();
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
    close() { $('modal').classList.add('hidden'); },
    isOpen() { return !$('modal').classList.contains('hidden'); },
  };
})(globalThis.LES = globalThis.LES || {});
