// App shell: main loop (simulation speed decoupled from rendering), input, speed
// controls, selection, error handling.
(function (LES) {
  'use strict';
  const U = LES.U, P = LES.P, C = LES.C, UI = LES.UI;
  const $ = id => document.getElementById(id);

  // dps = simulated days per real second. 1x = 1 simulated minute per second.
  const SPEEDS = [
    { label: '1×', dps: 1 / 1440, tip: '1 minute per second' }, { label: '10×', dps: 10 / 1440, tip: '10 minutes per second' },
    { label: '60×', dps: 60 / 1440, tip: '1 hour per second' }, { label: '1d/s', dps: 1, tip: '1 day per second' },
    { label: '10d/s', dps: 10, tip: '10 days per second' }, { label: '100d/s', dps: 100, tip: '100 days per second' },
    { label: 'MAX', dps: Infinity, tip: 'As fast as your laptop can go' },
  ];
  const NIGHT_FF = 30; // nights run this much faster at slow speeds

  const app = {
    world: null, renderer: null, paused: true, speedIdx: 2, skipNights: true, pinned: -1, dayFrac: 0, selected: -1, fast: false, lastCfg: null,
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
    if (app.world && app.world.lastDay > 365) { try { app.prevSummary = LES.Report.summary(app.world); } catch (e) { console.error(e); } }
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
    app.endShown = false;
    UI.director.queue = [];
    renderSpeed();
    UI.update(true);
    return true;
  };

  app.showEnd = function () {
    const w = app.world, card = $('modal-card');
    card.onclick = null; card.classList.remove('wide');
    card.innerHTML = `<h1>The simulation has ended</h1>
      <p class="lead">${U.esc(w.endReason === 'extinct' ? 'The population died out.' : `${w.cfg.horizonYears} years have passed.`)} ${w.winner ? `🏆 ${U.esc(P.name(w.people[w.winner.pid]))} reached the goal.` : 'Nobody reached the goal.'}</p>
      <p>Open the full report to see what happened, why, the Hall of Fame and the most notable lives.</p>
      <div class="modal-actions"><button class="ghost" id="end-csv">Export CSV</button><span class="spacer"></span><button class="ghost" id="end-close">Keep exploring</button><button class="ghost" id="end-new">Replay with a change</button><button class="primary" id="end-report">Open report</button></div>`;
    $('modal').classList.remove('hidden');
    $('end-close').onclick = () => $('modal').classList.add('hidden');
    $('end-report').onclick = () => LES.Report.open(w, app.prevSummary);
    $('end-csv').onclick = () => LES.Report.csv(w);
    $('end-new').onclick = () => LES.Setup.open(app, false);
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
    if (name === 'bursa') UI.openBursa();
    if (name === 'pin') app.pinned = app.selected;
    if (name === 'unpin') app.pinned = -1;
    if (name === 'csv') LES.Report.csv(app.world);
    if (name === 'report') LES.Report.open(app.world, app.prevSummary);
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
      + SPEEDS.map((s, i) => `<button data-s="${i}" class="${!app.paused && i === app.speedIdx ? 'on' : ''}" title="${s.tip} (key ${i + 1})">${s.label}</button>`).join('')
      + `<button data-s="night" class="${app.skipNights ? 'on night' : 'night'}" title="Fast-forward nights 23:00-06:00 at slow speeds">🌙</button>`;
  }
  // byDirector = true when Director mode slows down for a shot; a speed the user picks
  // themselves always wins and cancels the Director's planned resume.
  app.setSpeed = function (i, byDirector) {
    if (!byDirector) UI.director.resumeSpeed = null;
    app.speedIdx = i; app.paused = false; renderSpeed();
  };
  app.togglePause = function () { if (app.world && app.world.ended) return; app.paused = !app.paused; renderSpeed(); };
  function stepDay() {
    if (!app.world || app.world.ended) return;
    app.paused = true;
    safeStep();
    app.dayFrac = 0.25;
    renderSpeed();
    UI.update(true);
  }

  // ---------------- Simulation pump (10 days/s and faster) ----------------
  // Fast speeds simulate in short slices between animation frames (MessageChannel
  // tasks) instead of inside them, so the simulation is not tied to the frame rate:
  // a big town that is slow to draw no longer leaves the processor waiting. After a
  // while without a frame (45 ms, or about two simulated days in a huge town where
  // one day takes longer than that) the pump waits for the map to be drawn.
  const PUMP_MS = 14;
  const pump = new MessageChannel();
  let pumpOn = false, pumpLast = 0, lastFrameAt = 0, pumpAfterFrame = false, stepMs = 2;
  const pumpNext = () => {
    if (performance.now() - lastFrameAt > U.clamp(1.6 * stepMs, 45, 150)) pumpAfterFrame = true;
    else pump.port2.postMessage(0);
  };
  const timedStep = () => {
    const t = performance.now();
    safeStep();
    stepMs = stepMs * 0.8 + (performance.now() - t) * 0.2;
  };
  const pumpWanted = () => {
    const w = app.world;
    return !!w && !app.paused && !w.ended && !w.pauseRequested && SPEEDS[app.speedIdx].dps >= 10 && !document.hidden;
  };
  function kickPump() {
    if (pumpOn || !pumpWanted()) return;
    pumpOn = true; pumpLast = performance.now();
    pump.port2.postMessage(0);
  }
  pump.port1.onmessage = function () {
    if (!pumpWanted()) { pumpOn = false; return; }
    const w = app.world, sp = SPEEDS[app.speedIdx], t0 = performance.now();
    if (w.lastDay < 0) safeStep();
    if (sp.dps === Infinity) {
      while (performance.now() - t0 < PUMP_MS && !app.paused && !w.ended && !w.pauseRequested) timedStep();
      app.dayFrac = 0.3;
      pumpNext();
    } else {
      app.dayFrac += Math.min(0.25, (t0 - pumpLast) / 1000) * sp.dps;
      while (app.dayFrac >= 1 && !app.paused && !w.ended && !w.pauseRequested && performance.now() - t0 < PUMP_MS) { timedStep(); app.dayFrac -= 1; }
      if (app.dayFrac >= 1) {
        app.dayFrac = Math.min(app.dayFrac, 2); // can't keep up: run flat out, keep only a small backlog
        pumpNext();
      } else {
        // Nothing due yet: wait for the next day instead of spinning.
        setTimeout(() => pump.port2.postMessage(0), Math.max(1, (1 - app.dayFrac) / sp.dps * 1000));
      }
    }
    pumpLast = t0;
  };

  // ---------------- Main loop ----------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    lastFrameAt = performance.now();
    const w = app.world;
    if (w && !app.paused && !w.ended) {
      const sp = SPEEDS[app.speedIdx];
      app.fast = sp.dps >= 1;
      if (sp.dps >= 10) {
        kickPump(); // fast speeds step in the pump
      } else {
        if (w.lastDay < 0) safeStep();
        const ff = app.skipNights && sp.dps < 1 && LES.isNight(app.dayFrac) ? NIGHT_FF : 1;
        app.dayFrac += dt * sp.dps * ff;
        let n = 0;
        while (app.dayFrac >= 1 && n < 40 && !app.paused && !w.ended) { safeStep(); app.dayFrac -= 1; n++; }
        if (app.dayFrac >= 1) app.dayFrac = 0;
      }
      if (w.pauseRequested) {
        w.pauseRequested = null;
        app.paused = true;
        renderSpeed();
      }
      if (w.ended && !app.endShown) { app.endShown = true; app.paused = true; renderSpeed(); app.showEnd(); }
    }
    if (w) {
      app.renderer.richIds = app.richIds();
      app.renderer.frame(app.dayFrac, app.fast && !app.paused, now);
      UI.update(false);
      UI.directorTick(now);
      LES.Extras.soundTick(w, app.paused);
    }
    if (pumpAfterFrame) { pumpAfterFrame = false; lastFrameAt = performance.now(); pump.port2.postMessage(0); }
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
        const s = p.plan && p.plan.length ? p.plan[app.dayFrac * 1440 < LES.SLOT_B ? 0 : 1] || p.plan[0] : null;
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
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const id = r.pick(sx, sy);
        if (id >= 0) app.select(id, false);
        else {
          const bid = r.pickBuilding(sx, sy);
          if (bid >= 0) {
            r.selectedBuilding = bid;
            if (app.world.town.buildings[bid].kind === 'bursa') UI.openBursa();
            UI.setTab('place');
          }
        }
      }
      drag = null;
    });
    cv.addEventListener('pointerleave', () => { tip.classList.add('hidden'); r.hoverId = -1; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      r.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    $('vol').addEventListener('input', e => LES.Extras.setVolume(Number(e.target.value) / 100));
    $('map-tools').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'sound') {
        const on = LES.Extras.toggleSound();
        b.textContent = on ? '🔊' : '🔇';
        b.classList.toggle('on', on);
        $('vol').classList.toggle('hidden', !on);
        $('vol').value = Math.round(LES.Extras.sound.volume * 100);
        return;
      }
      if (b.dataset.z === 'director') {
        const d = UI.director;
        d.on = !d.on;
        b.classList.toggle('on', d.on);
        if (!d.on) {
          r.follow = false;
          $('caption').classList.add('hidden');
          if (d.resumeSpeed !== null) app.setSpeed(d.resumeSpeed, true); // leave slow motion
          d.resumeSpeed = null; d.until = 0;
        }
        return;
      }
      if (b.dataset.z === 'fit') { r.fit(); r.follow = false; }
      else r.zoomAt(r.vw / 2, r.vh / 2, b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
    });
    const ov = $('overlay');
    ov.innerHTML = LES.Extras.OVERLAYS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    ov.addEventListener('change', () => { r.overlay = ov.value; ov.blur(); });
    $('speed').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s === 'pause') app.togglePause();
      else if (b.dataset.s === 'night') { app.skipNights = !app.skipNights; renderSpeed(); }
      else app.setSpeed(Number(b.dataset.s));
      document.activeElement.blur(); // so Space toggles pause instead of re-clicking
    });
    $('btn-step').addEventListener('click', () => { stepDay(); $('btn-step').blur(); });
    $('btn-new').addEventListener('click', () => { app.paused = true; renderSpeed(); LES.Setup.open(app, false); });
    $('btn-report').addEventListener('click', () => { try { LES.Report.open(app.world, app.prevSummary); } catch (e) { console.error(e); showError(`Report failed: ${e.message}`); } });
    window.addEventListener('keydown', e => {
      if (LES.Setup.isOpen() || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); app.togglePause(); }
      else if (e.key >= '1' && e.key <= '7') app.setSpeed(Number(e.key) - 1);
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
