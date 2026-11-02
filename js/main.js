// App shell: main loop (simulation speed decoupled from rendering), input, speed
// controls, selection, error handling.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, C = LES.C, UI = LES.UI;
  const $ = id => document.getElementById(id);

  const SPEEDS = [
    { label: '1×', dps: 0.1 }, { label: '3×', dps: 0.3 }, { label: '10×', dps: 1 },
    { label: '50×', dps: 5 }, { label: '250×', dps: 25 }, { label: 'MAX', dps: Infinity },
  ];

  const app = {
    world: null, renderer: null, paused: true, speedIdx: 2, dayFrac: 0, selected: -1, fast: false, lastCfg: null,
    _rich: { t: 0, ids: [] },
  };
  window.LES_APP = app;

  app.speedLabel = () => SPEEDS[app.speedIdx].label;

  app.richIds = function () {
    const now = performance.now();
    if (now - app._rich.t > 500) {
      app._rich.t = now;
      app._rich.ids = app.world.living.filter(p => p.alive && p.adult).sort((a, b) => b.nw - a.nw).slice(0, 3).map(p => p.id);
    }
    return app._rich.ids;
  };
  app.richest = () => { const ids = app.richIds(); return ids.length ? app.world.people[ids[0]] : null; };

  function showError(msg) {
    const b = $('error-banner');
    b.textContent = msg;
    b.classList.remove('hidden');
    clearTimeout(showError.t);
    showError.t = setTimeout(() => b.classList.add('hidden'), 15000);
  }

  app.newWorld = function (cfg) {
    let w;
    try { w = new LES.World(cfg); } catch (e) { showError(`Could not create world: ${e.message}`); console.error(e); return false; }
    app.world = w;
    app.lastCfg = cfg;
    app.selected = -1;
    app.dayFrac = 0;
    app._rich.t = 0;
    UI.feedSeqShown = 0;
    app.renderer.setWorld(w);
    app.renderer.selectedId = -1;
    app.renderer.follow = false;
    app.paused = false;
    renderSpeed();
    UI.update(true);
    return true;
  };

  app.select = function (id, center) {
    const w = app.world;
    if (!w || !w.people[id]) return;
    app.selected = id;
    app.renderer.selectedId = id;
    if (center && w.people[id].alive) {
      const r = app.renderer;
      if (r.z < r.fitZoom() * 1.8) r.z = r.fitZoom() * 2.2;
      const pos = r.posOf(w.people[id], app.dayFrac, app.fast);
      r.centerOn(pos.x, pos.y, 1);
    }
    if (UI.tab !== 'person') UI.setTab('person');
    UI.update(true);
  };

  app.action = function (name) {
    if (name === 'follow') app.renderer.follow = !app.renderer.follow;
    if (name === 'deselect') { app.selected = -1; app.renderer.selectedId = -1; app.renderer.follow = false; }
    UI.update(true);
  };

  function safeStep() {
    const w = app.world;
    try {
      w.step();
      if (w.date.lastOfMonth && w.date.month % 3 === 2) {
        const errs = w.checkInvariants();
        if (errs.length) { console.error('Invariant violations', errs); showError(`Consistency check failed on ${U.fmtDate(w.lastDay)}: ${errs[0]}`); }
      }
    } catch (e) {
      app.paused = true;
      renderSpeed();
      console.error(e);
      showError(`Simulation error on ${U.fmtDate(w.day)} (seed "${w.cfg.seed}"): ${e.message}. The world is paused.`);
    }
  }

  // ---------------- Speed controls ----------------
  function renderSpeed() {
    const el = $('speed');
    el.innerHTML = `<button class="pause ${app.paused ? 'on' : ''}" data-s="pause" title="Play / pause (Space)">${app.paused ? '▶' : '❚❚'}</button>`
      + SPEEDS.map((s, i) => `<button data-s="${i}" class="${!app.paused && i === app.speedIdx ? 'on' : ''}" title="Speed ${s.label} (key ${i + 1})">${s.label}</button>`).join('');
  }
  app.setSpeed = function (i) { app.speedIdx = i; app.paused = false; renderSpeed(); };
  app.togglePause = function () { if (app.world && app.world.ended) return; app.paused = !app.paused; renderSpeed(); };
  function stepDay() {
    if (!app.world || app.world.ended) return;
    app.paused = true;
    safeStep();
    app.dayFrac = 0.3;
    renderSpeed();
    UI.update(true);
  }

  // ---------------- Main loop ----------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const w = app.world;
    if (w && !app.paused && !w.ended) {
      const sp = SPEEDS[app.speedIdx];
      app.fast = sp.dps > 1.5;
      if (w.lastDay < 0) safeStep();
      if (sp.dps === Infinity) {
        const t0 = performance.now();
        while (performance.now() - t0 < 18 && !app.paused && !w.ended && !w.pauseRequested) safeStep();
        app.dayFrac = 0.3;
      } else {
        app.dayFrac += dt * sp.dps;
        let n = 0;
        while (app.dayFrac >= 1 && n < 40 && !app.paused && !w.ended) { safeStep(); app.dayFrac -= 1; n++; }
        if (app.dayFrac >= 1) app.dayFrac = 0;
      }
      if (w.pauseRequested) {
        w.pauseRequested = null;
        app.paused = true;
        renderSpeed();
      }
      if (w.ended) { app.paused = true; renderSpeed(); }
    }
    if (w) {
      app.renderer.richIds = app.richIds();
      app.renderer.frame(app.dayFrac, app.fast && !app.paused, now);
      UI.update(false);
    }
    requestAnimationFrame(frame);
  }

  // ---------------- Input ----------------
  function initInput() {
    const cv = $('map'), r = app.renderer, tip = $('tooltip');
    let drag = null;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (drag.moved || Math.abs(dx) + Math.abs(dy) > 4) {
          drag.moved = true;
          cv.classList.add('dragging');
          r.pan(dx, dy);
          drag.x = e.clientX; drag.y = e.clientY;
        }
        return;
      }
      const id = r.pick(sx, sy);
      r.hoverId = id;
      if (id >= 0 && app.world) {
        const w = app.world, p = w.people[id];
        const s = p.plan && p.plan.length ? p.plan[app.dayFrac < 0.5 ? 0 : 1] || p.plan[0] : null;
        tip.innerHTML = `<b>${U.esc(P.name(p))}</b>${Math.floor(P.age(w, p))} yrs · ${C.STRATEGY_NAMES[p.strategy]}<br>${s ? `${LES.Actions.ICONS[s.act] || ''} ${U.esc(s.label)}<br>` : ''}<span class="gold">${U.fmtMoney(p.nw)}</span>`;
        tip.style.left = `${Math.min(sx + 14, rect.width - 240)}px`;
        tip.style.top = `${sy + 14}px`;
        tip.classList.remove('hidden');
        cv.style.cursor = 'pointer';
      } else {
        tip.classList.add('hidden');
        cv.style.cursor = '';
      }
    });
    cv.addEventListener('pointerup', e => {
      cv.classList.remove('dragging');
      if (drag && !drag.moved) {
        const rect = cv.getBoundingClientRect();
        const id = r.pick(e.clientX - rect.left, e.clientY - rect.top);
        if (id >= 0) app.select(id, false);
      }
      drag = null;
    });
    cv.addEventListener('pointerleave', () => { tip.classList.add('hidden'); r.hoverId = -1; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      r.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    $('map-tools').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'fit') { r.fit(); r.follow = false; }
      else r.zoomAt(r.vw / 2, r.vh / 2, b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
    });
    $('speed').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s === 'pause') app.togglePause(); else app.setSpeed(Number(b.dataset.s));
      document.activeElement.blur(); // so Space toggles pause instead of re-clicking
    });
    $('btn-step').addEventListener('click', () => { stepDay(); $('btn-step').blur(); });
    $('btn-new').addEventListener('click', () => { app.paused = true; renderSpeed(); LES.Setup.open(app, false); });
    window.addEventListener('keydown', e => {
      if (LES.Setup.isOpen() || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); app.togglePause(); }
      else if (e.key >= '1' && e.key <= '6') app.setSpeed(Number(e.key) - 1);
      else if (e.key === 's' || e.key === 'S') stepDay();
      else if (e.key === 'f' || e.key === 'F') app.action('follow');
      else if (e.key === 'Escape') app.action('deselect');
    });
    window.addEventListener('resize', () => r.resize());
  }

  window.addEventListener('error', e => showError(`Unexpected error: ${e.message}`));

  function boot() {
    app.renderer = new LES.Renderer($('map'));
    UI.init(app);
    initInput();
    app.newWorld(Object.assign({}, LES.DEFAULTS));
    app.paused = true;
    renderSpeed();
    LES.Setup.open(app, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { app.renderer.buildStatic(); UI.update(true); });
    requestAnimationFrame(frame);
  }
  boot();
})(globalThis.LES = globalThis.LES || {});
