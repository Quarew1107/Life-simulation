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
    turbo: (() => { try { return localStorage.getItem('les-turbo') === '1'; } catch (e) { return false; } })(),
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
    try {
      if (cfg.towns && cfg.towns !== '1') { app.region = LES.makeRegion(cfg); w = app.region.towns[0]; } // several towns
      else { app.region = null; w = new LES.World(cfg); }
    } catch (e) { showError(`Could not create world: ${e.message}`); console.error(e); return false; }
    app.useWorld(w);
    return true;
  };
  // Switch which town the map and panels show (a region keeps running all of them).
  app.selectTown = function (i) {
    const R = app.region;
    if (!R || !R.towns[i]) return;
    const wasRegion = app.view === 'region';
    app.view = 'town'; $('tooltip').classList.add('hidden');
    $('map-hint').textContent = MAP_HINT;
    if (R.towns[i] === app.world) { if (wasRegion) { app.renderer.fit(); UI.update(true); } return; }
    app.world = R.towns[i];
    app.selected = -1; app._rich.t = 0; UI.feedSeqShown = 0; UI.clearToasts();
    app.renderer.setWorld(app.world); app.renderer.selectedId = -1; app.renderer.follow = false;
    UI.update(true);
  };

  const MAP_HINT = 'Click a person or building · drag to pan · scroll to zoom · Space to pause';
  // Region view: every town on one map (only when there are several towns).
  app.showRegion = function () {
    if (!app.region) return;
    app.view = 'region';
    app.renderer.follow = false; app.renderer.hoverId = -1;
    $('tooltip').classList.add('hidden');
    $('map-hint').textContent = 'Click or scroll in on a town to open it · Esc goes back';
    UI.update(true);
  };

  // Show a world (new or loaded): reset selection, camera, feed and audio.
  app.useWorld = function (w) {
    app.view = 'town';
    app.world = w;
    if (app.fillOverlays) app.fillOverlays();
    app.lastCfg = app.region ? app.region.base : w.cfg; // a region's shared settings hold its cast arrivals
    app.selected = -1;
    app.dayFrac = 0;
    app._rich.t = 0;
    UI.feedSeqShown = 0;
    UI.clearToasts(); // pop-ups from the previous world point at its people
    app.renderer.setWorld(w);
    app.renderer.selectedId = -1;
    app.renderer.follow = false;
    app.paused = false;
    app.endShown = false;
    UI.director.queue = [];
    LES.Audio.newWorld();
    renderSpeed();
    UI.update(true);
  };

  // ---- Save / load (gzip-compressed JSON where the browser supports it) ----
  app.saveWorld = async function () {
    const w = app.world;
    if (!w) return;
    const wasPaused = app.paused;
    app.paused = true; renderSpeed();
    try {
      const text = LES.Save.toJSON(app.region || w); // a region saves all its towns
      let blob = new Blob([text], { type: 'application/json' }), ext = 'json';
      if (typeof CompressionStream === 'function') {
        blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
        ext = 'json.gz';
      }
      const d = U.dayToDate(w.day);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `LES-${w.cfg.seed}-Y${d.year}-${U.MONTH_NAMES[d.month]}${d.dom}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      UI.toast(`💾 Saved ${U.esc(a.download)}`);
    } catch (e) { console.error(e); showError(`Save failed: ${e.message}`); }
    app.paused = wasPaused; renderSpeed();
  };
  app.loadWorld = async function (file) {
    try {
      let bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open compressed saves.');
        bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      }
      const loaded = LES.Save.fromJSON(new TextDecoder().decode(bytes));
      const errs = loaded.checkInvariants();
      if (errs.length) throw new Error(`the saved world failed its consistency checks (${errs[0]})`);
      app.prevSummary = null;
      app.region = loaded instanceof LES.Region ? loaded : null;
      const w = app.region ? app.region.towns[0] : loaded;
      app.useWorld(w);
      app.paused = true; renderSpeed();
      LES.Setup.close();
      UI.toast(`📂 Loaded ${U.esc(file.name)} (${U.fmtDate(w.day)})`);
      return true;
    } catch (e) { console.error(e); showError(`Could not load ${file.name}: ${e.message}`); return false; }
  };

  // Sandbox Fate (C09b): explain who is affected, offer to save a copy first, then queue the command.
  app.askFate = function (id) {
    const w = app.world, p = w.people[id], card = $('modal-card');
    if (!p || !p.alive) return;
    const r = LES.God.resolve(w, id), im = r.p ? LES.God.impact(r.w, r.p) : null, esc = U.esc;
    card.onclick = null; card.classList.remove('wide');
    card.innerHTML = `<h1>Fate: ${esc(P.name(p))}</h1>
      ${r.error ? `<p class="lead">${esc(r.error)}</p>` : `<p class="note">${esc(P.name(r.p))}, aged ${Math.floor(P.age(r.w, r.p))}, lives in ${esc(LES.townName(r.w))}${im.partner ? `, partner of ${esc(P.name(im.partner))}` : ''}${im.stakes ? `, with shares in ${im.stakes} business${im.stakes > 1 ? 'es' : ''}` : ''}.</p>
      <p class="lead">This ends ${esc(P.name(p))}'s life at the start of the next simulated day, through the normal course of a death: the family grieves, ${im.kids ? `${im.kids} child${im.kids > 1 ? 'ren' : ''} in their care ${im.soleCarer ? `(${im.soleCarer} with no other carer) will need a guardian` : im.kids > 1 ? 'stay with the other carer' : 'stays with the other carer'}` : 'no children depend on them'}, ${im.heirs ? `the estate goes to ${im.heirs === 1 ? 'their child' : `their ${im.heirs} children`}` : 'with no living children the estate leaves the town'}${im.runs ? `, ${esc(im.runs)} needs a new manager` : ''}${im.job ? `, and the job as ${esc(im.job)} falls vacant` : ''}.</p>
      <p class="note">${LES.God.intervened(w) ? 'This world is already a sandbox world.' : 'From then on this world is marked <b>Sandbox / intervened</b>: its report and statistics say so, and Fate deaths are left out of life expectancy. Save a copy first if you want to keep the unchanged world.'}</p>`}
      <div class="modal-actions">${r.error ? '' : '<button class="ghost" id="fate-save">Save a copy first</button>'}<span class="spacer"></span><button class="ghost" id="fate-cancel">Cancel</button>${r.error ? '' : '<button class="primary" id="fate-go">Confirm Fate</button>'}</div>`;
    $('modal').classList.remove('hidden');
    $('fate-cancel').onclick = () => $('modal').classList.add('hidden');
    if (r.error) return;
    $('fate-save').onclick = () => app.saveWorld();
    $('fate-go').onclick = () => {
      const out = LES.God.requestFate(w, id);
      $('modal').classList.add('hidden');
      if (out.error) showError(out.error); else UI.toast(`Fate will reach ${esc(P.name(p))} at the start of the next day${app.paused ? ' (time is paused: press +1 day or play)' : ''}.`);
    };
  };

  app.renameTown = function () {
    const w = app.world, card = $('modal-card');
    if (!w) return;
    card.onclick = null; card.classList.remove('wide');
    card.innerHTML = `<h1>Rename the town</h1><p class="lead">Only a label: nothing in the simulation changes. Past life events and newspaper issues keep the name of their day.</p>
      <div class="field"><label for="tn-input">Town name</label><input id="tn-input" type="text" maxlength="60"><div class="help" id="tn-msg">1-40 characters. Leave blank for the default (${U.esc(LES.C.TOWN_NAME)}).</div></div>
      <div class="modal-actions"><button class="ghost" id="tn-reset">Use the default</button><span class="spacer"></span><button class="ghost" id="tn-cancel">Cancel</button><button class="primary" id="tn-save">Save</button></div>`;
    $('tn-input').value = w.displayName || '';
    $('modal').classList.remove('hidden');
    const done = () => { $('modal').classList.add('hidden'); UI.update(true); };
    $('tn-cancel').onclick = () => $('modal').classList.add('hidden');
    $('tn-reset').onclick = () => { LES.setTownName(w, ''); done(); };
    $('tn-save').onclick = () => { const v = $('tn-input').value; if (v.trim() === '') { LES.setTownName(w, ''); done(); } else if (LES.setTownName(w, v)) done(); else $('tn-msg').textContent = 'Please use 1-40 characters (no control characters).'; };
  };

  app.showEnd = function () {
    const w = app.world, card = $('modal-card');
    card.onclick = null; card.classList.remove('wide');
    card.innerHTML = `<h1>The simulation has ended</h1>
      <p class="lead">${U.esc(w.endReason === 'extinct' ? 'The population died out.' : `${w.cfg.horizonYears} years have passed.`)} ${w.winner ? `🏆 ${U.esc(P.name(w.people[w.winner.pid]))} reached the goal.` : 'Nobody reached the goal.'}</p>
      <p>Open the full report to see what happened, why, the Hall of Fame and the most notable lives.</p>
      <div class="modal-actions"><button class="ghost" id="end-csv">Export CSV</button><span class="spacer"></span><button class="ghost" id="end-close">Keep exploring</button>${app.region ? '' : `<button class="ghost" id="end-cmp">Compare with ${U.esc(LES.Compare.label(w.cfg))}</button>`}<button class="ghost" id="end-new">Replay with a change</button><button class="primary" id="end-report">Open report</button></div>`;
    $('modal').classList.remove('hidden');
    LES.Audio.setScene('report');
    $('end-close').onclick = () => $('modal').classList.add('hidden');
    $('end-report').onclick = () => LES.Report.open(w, app.prevSummary);
    $('end-csv').onclick = () => LES.Report.csv(w);
    if ($('end-cmp')) $('end-cmp').onclick = () => LES.Compare.open(app);
    $('end-new').onclick = () => LES.Setup.open(app, false);
  };

  app.select = function (id, center) {
    const w = app.world;
    if (!w || !w.people[id]) return;
    if (app.view === 'region') { app.view = 'town'; $('map-hint').textContent = MAP_HINT; } // a person is shown on their town's map
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
    if (name === 'compare') LES.Compare.open(app);
    const sel = app.selected; // spectator tools: no simulation state is touched
    if (name === 'spotlight' && sel >= 0) LES.Spectator.toggleSpotlight(sel);
    if (name === 'bookmark' && sel >= 0) LES.Spectator.toggleBookmark(app.world, sel, false);
    if (name === 'bookmarkFamily' && sel >= 0) LES.Spectator.toggleBookmark(app.world, sel, true);
    if (name === 'celebrate' && sel >= 0) LES.Spectator.celebrate(sel);
    if (name === 'fate' && sel >= 0) { app.askFate(sel); return; }
    UI.update(true);
  };

  function safeStep() {
    const w = app.world;
    try {
      if (app.region) app.region.step(); else w.step();
      if (w.date.lastOfMonth && w.date.month % 3 === 2) {
        const errs = app.region ? app.region.checkInvariants() : w.checkInvariants();
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
      + `<button data-s="night" class="${app.skipNights ? 'on night' : 'night'}" title="Fast-forward nights 23:00-06:00 at slow speeds">🌙</button>`
      + `<button data-s="turbo" class="${app.turbo ? 'on turbo' : 'turbo'}" title="Turbo view (T): at 10d/s and faster the map is redrawn about 4 times a second instead of every frame, so a big town simulates more days per second. Every event and result is exactly the same.">⚡</button>`;
  }
  app.setTurbo = function (on) {
    app.turbo = !!on; renderSpeed();
    try { localStorage.setItem('les-turbo', app.turbo ? '1' : '0'); } catch (e) { /* private window: per session only */ }
  };
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
  // Turbo view: while the pump runs, the map and panels are redrawn only every TURBO_MS,
  // so the time a big town spends drawing goes to simulating instead (the days simulated
  // are exactly the same; only how often they are shown changes).
  const PUMP_MS = 14, TURBO_MS = 250;
  let lastDrawAt = 0;
  const pump = new MessageChannel();
  let pumpOn = false, pumpLast = 0, lastFrameAt = 0, pumpAfterFrame = false, stepMs = 2;
  // If the browser holds frames back (it throttles them to about one a second in a window
  // it thinks is covered, even though the page still counts as visible), the pump
  // carries on after FRAME_WAIT_MS instead of waiting for that frame.
  const FRAME_WAIT_MS = 50;
  const pumpNext = () => {
    if (performance.now() - lastFrameAt > U.clamp(1.6 * stepMs, 45, 150)) {
      pumpAfterFrame = true;
      clearTimeout(pumpNext.t);
      pumpNext.t = setTimeout(() => { if (pumpAfterFrame) { pumpAfterFrame = false; lastFrameAt = performance.now(); pump.port2.postMessage(0); } }, FRAME_WAIT_MS);
    } else pump.port2.postMessage(0);
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
    const turboSkip = app.turbo && pumpOn && !!w && !app.paused && now - lastDrawAt < TURBO_MS;
    if (w && !turboSkip) {
      lastDrawAt = now;
      app.renderer.richIds = app.richIds();
      if (app.view === 'region' && app.region) app.regionView.draw(app, now);
      else app.renderer.frame(app.dayFrac, app.fast && !app.paused, now);
      UI.update(false);
    }
    if (w) UI.directorTick(now);
    LES.Audio.tick(app);
    if (pumpAfterFrame) { pumpAfterFrame = false; lastFrameAt = performance.now(); pump.port2.postMessage(0); }
    requestAnimationFrame(frame);
  }

  // ---------------- Input ----------------
  // Sound button state and the music / effects volume sliders next to it.
  function showSound(on) {
    const b = $('btn-sound');
    LES.iconOnly(b, on ? 'volume' : 'volume-x');
    b.classList.toggle('on', on);
    if (!on) $('vol-pop').classList.add('hidden'); // the sliders only appear while hovering (see initVolumeHover)
    $('vol-music').value = Math.round(LES.Audio.music * 100);
    $('vol-sfx').value = Math.round(LES.Audio.sfx * 100);
  }

  app.toggleSound = () => { const on = LES.Audio.toggle(); showSound(on); return on; };

  function initInput() {
    const cv = $('map'), r = app.renderer, tip = $('tooltip');
    let drag = null;
    const inRegion = () => app.view === 'region' && app.region;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (inRegion()) { // region view: hover a town
        if (drag) return;
        const i = app.regionView.pick(app.region, sx, sy);
        app.regionView.hover = i;
        cv.style.cursor = i >= 0 ? 'pointer' : '';
        if (i >= 0) {
          tip.innerHTML = `<b>${U.esc(LES.townName(app.region.towns[i]))}</b>Click to open this town`;
          tip.style.left = `${Math.min(sx + 14, rect.width - 240)}px`; tip.style.top = `${sy + 14}px`;
          tip.classList.remove('hidden');
        } else tip.classList.add('hidden');
        return;
      }
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
      if (inRegion()) {
        const rect = cv.getBoundingClientRect(), i = app.regionView.pick(app.region, e.clientX - rect.left, e.clientY - rect.top);
        if (drag && !drag.moved && i >= 0) app.selectTown(i);
        drag = null;
        return;
      }
      if (drag && !drag.moved) {
        const rect = cv.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const badge = r.pickBadge(sx, sy); // '+N' over a crowded place: show the place and who is there
        const id = badge >= 0 ? -1 : r.pick(sx, sy);
        if (badge >= 0) UI.showBuilding(badge);
        else if (id >= 0) app.select(id, false);
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
    // Scrolling out past the whole town (after a short pause at the limit) opens the region
    // view; scrolling in over a town there opens that town.
    let atMinSince = 0;
    const atMin = () => r.z <= r.fitZoom() * 0.9 + 1e-9;
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (inRegion()) { const i = app.regionView.pick(app.region, sx, sy); if (e.deltaY < 0 && i >= 0) app.selectTown(i); return; }
      if (e.deltaY > 0 && app.region && atMin() && performance.now() - atMinSince > 350) { app.showRegion(); return; }
      const was = atMin();
      r.zoomAt(sx, sy, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      if (atMin() && !was) atMinSince = performance.now();
    }, { passive: false });
    // Volume sliders: shown while the mouse is over the sound button (sound on), kept for
    // a second after it leaves, and kept as long as the mouse is over the sliders themselves.
    {
      const pop = $('vol-pop'), btn = $('btn-sound');
      let timer = 0, dragging = false;
      const show = () => { clearTimeout(timer); if (LES.Audio.on) pop.classList.remove('hidden'); };
      const hideSoon = () => { clearTimeout(timer); timer = setTimeout(() => { if (!dragging && !pop.matches(':hover') && !btn.matches(':hover')) pop.classList.add('hidden'); }, 1000); };
      btn.addEventListener('mouseenter', show); btn.addEventListener('mouseleave', hideSoon);
      pop.addEventListener('mouseenter', show); pop.addEventListener('mouseleave', hideSoon);
      pop.addEventListener('pointerdown', () => { dragging = true; });
      window.addEventListener('pointerup', () => { if (dragging) { dragging = false; hideSoon(); } }); // finished adjusting (even if released outside)
      btn.addEventListener('click', () => { if (LES.Audio.on) { show(); hideSoon(); } });
    }
    $('vol-music').addEventListener('input', e => LES.Audio.setMusicVolume(Number(e.target.value) / 100));
    $('vol-sfx').addEventListener('input', e => LES.Audio.setSfxVolume(Number(e.target.value) / 100));
    $('vol-sfx').addEventListener('change', () => LES.Audio.play('chime', true)); // preview
    $('map-tools').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'sound') { app.toggleSound(); return; }
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
      if (inRegion()) { if (b.dataset.z === 'in' || b.dataset.z === 'fit') app.selectTown(app.world.townIdx); return; }
      if (b.dataset.z === 'out' && app.region && atMin()) { app.showRegion(); return; }
      if (b.dataset.z === 'fit') { r.fit(); r.follow = false; }
      else r.zoomAt(r.vw / 2, r.vh / 2, b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
    });
    const ov = $('overlay');
    app.fillOverlays = () => { // the class overlay names the country's classes (B40/M40/T20, Bottom 40%...)
      const S = LES.Society, cls = S ? ` (${S.CLASSES.map(S.short).join('/')})` : '', keep = ov.value;
      ov.innerHTML = LES.Extras.OVERLAYS.map(([k, l]) => `<option value="${k}">${l}${k === 'class' ? cls : ''}</option>`).join('');
      if (keep) ov.value = keep;
    };
    app.fillOverlays();
    ov.addEventListener('change', () => { r.overlay = ov.value; ov.blur(); });
    $('speed').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s === 'pause') app.togglePause();
      else if (b.dataset.s === 'night') { app.skipNights = !app.skipNights; renderSpeed(); }
      else if (b.dataset.s === 'turbo') app.setTurbo(!app.turbo);
      else app.setSpeed(Number(b.dataset.s));
      document.activeElement.blur(); // so Space toggles pause instead of re-clicking
    });
    $('btn-step').addEventListener('click', () => { stepDay(); $('btn-step').blur(); });
    // Create a person mid-game (the same creator as Leaders → ★ My cast; "Save and add to town").
    app.createPerson = () => { if (!app.world || app.world.ended || !$('modal').classList.contains('hidden')) return; app.paused = true; renderSpeed(); UI.openCastCreator(-1); };
    $('btn-cast').addEventListener('click', () => { app.createPerson(); $('btn-cast').blur(); });
    $('btn-save').addEventListener('click', () => app.saveWorld());
    $('btn-new').addEventListener('click', () => { app.paused = true; renderSpeed(); LES.Setup.open(app, false); });
    $('btn-report').addEventListener('click', () => { try { LES.Report.open(app.world, app.prevSummary); } catch (e) { console.error(e); showError(`Report failed: ${e.message}`); } });
    // Rename the town shown (C08): a display label only; past log lines and paper issues keep their names.
    const sub = $('town-sub');
    if (sub) { sub.title = 'Click to rename this town'; sub.style.cursor = 'pointer'; sub.addEventListener('click', () => app.renameTown()); }
    window.addEventListener('keydown', e => {
      if (LES.Setup.isOpen() || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); app.togglePause(); }
      else if (e.key >= '1' && e.key <= '7') app.setSpeed(Number(e.key) - 1);
      else if (e.key === 's' || e.key === 'S') stepDay();
      else if (e.key === 'f' || e.key === 'F') app.action('follow');
      else if (e.key === 't' || e.key === 'T') app.setTurbo(!app.turbo);
      else if (e.key === 'p' || e.key === 'P') app.createPerson();
      else if (e.key === 'Escape') { if (inRegion()) app.selectTown(app.world.townIdx); else app.action('deselect'); }
    });
    window.addEventListener('resize', () => r.resize());
  }

  window.addEventListener('error', e => showError(`Unexpected error: ${e.message}`));

  function boot() {
    app.renderer = new LES.Renderer($('map'));
    app.regionView = new LES.RegionView(app.renderer);
    UI.init(app);
    initInput();
    app.newWorld(Object.assign({}, LES.DEFAULTS));
    app.paused = true;
    renderSpeed();
    if (LES.Audio.wasOn()) { LES.Audio.setOn(true); showSound(true); } // starts at the first click (browser rule)
    LES.Setup.open(app, true);
    if (LES.I18n.saved() !== LES.I18n.lang()) LES.I18n.set(LES.I18n.saved(), () => { if (!$('modal').classList.contains('hidden')) LES.Setup.open(app, true); }); // the reader's language from last time
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (app.renderer.tiles) app.renderer.tiles.reset(); UI.update(true); });
    requestAnimationFrame(frame);
  }
  boot();
})(globalThis.LES = globalThis.LES || {});
