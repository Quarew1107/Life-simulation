// Music and sound effects from the files in "Sound effects/". Plain <audio> elements
// (not Web Audio decoding) so it also works when index.html is opened straight from
// disk. Off by default; the on/off choice and both volumes are remembered.
//
// Music plays only at 1x (and a little faster at 10x); at higher speeds it fades out
// and waits, while sound effects and event cues keep playing at every speed.
// Music follows the town: a setup theme, calm daytime / night city in normal times,
// an upbeat track in a boom, a melancholy one in a recession, a festival cue when
// Hari Raya, Chinese New Year, Deepavali or Christmas begins, and the report theme
// when the run ends or the report is open. Tracks crossfade.
// Effects mark notable events (and everything that happens to the person you are
// watching), plus trains, car horns, fireworks and button clicks at slow speeds.
(function (LES) {
  'use strict';
  const DIR = 'Sound effects/';
  const MUSIC = {
    setup: 'setup-screen theme.mp3', day: 'calm daytime.mp3', night: 'Night city.mp3',
    boom: 'upbeat “boom” track.mp3', recession: 'melancholy “recession” track.mp3', report: 'end-of-run report theme.mp3',
    raya: 'Hari Raya festival cue.mp3', cny: 'Chinese New Year festival cue.mp3', deepavali: 'Deepavali festival cue.mp3', christmas: 'christmas festival cue.mp3',
  };
  const FESTIVAL_TRACKS = ['raya', 'cny', 'deepavali', 'christmas'];
  // [file, loudness 0-1, cooldown s, max seconds to play]
  const SFX = {
    click: ['UI click.wav', 0.35, 0.05], chime: ['milestone chime.wav', 0.7, 1.5], fanfare: ['goal fanfare.wav', 0.85, 2],
    baby: ['Baby bell.wav', 0.6, 2], wedding: ['Wedding bell.wav', 0.6, 2], funeral: ['Funeral bell.mp3', 0.6, 2.5],
    graduation: ['graduation.mp3', 0.6, 2], hired: ['hired or promoted jingle.wav', 0.6, 2], cash: ['cha-ching.mp3', 0.6, 2],
    sad: ['sad tone for bankruptcies or crashes.mp3', 0.6, 2], train: ['train horn.mp3', 0.45, 20, 4.5],
    honk: ['car honk.mp3', 0.3, 10], fireworks: ['fireworks.mp3', 0.6, 8],
  };
  const FADE_S = 1.5, MIN_HOLD_S = 20, FESTIVAL_GAP_S = 180;
  const url = f => DIR + encodeURIComponent(f);

  const Au = LES.Audio = { on: false, music: 0.6, sfx: 0.8, scene: null };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } },
  };
  const saved = (k, def) => { // older versions had one 'les-volume' slider
    const v = store.get(k) ?? store.get('les-volume');
    return v !== null && Number(v) >= 0 && Number(v) <= 1 ? Number(v) : def;
  };
  Au.music = saved('les-music-vol', Au.music);
  Au.sfx = saved('les-sfx-vol', Au.sfx);

  // ---------------- Music: two players crossfading ----------------
  const players = [], state = { cur: -1, key: null, since: 0, fade: null, festPlayed: {}, lastFestAt: -1e9, festKey: null, mute: 1, lastTick: 0, rate: 1 };
  // Music speed by simulation speed index: 1x normal, 10x a bit faster, faster speeds: none.
  const MUSIC_RATE = [1, 1.5];
  function player() {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('ended', () => { if (players[state.cur] === a && FESTIVAL_TRACKS.includes(state.key)) state.festKey = null; });
    return a;
  }
  const nowS = () => performance.now() / 1000;
  const playSafe = a => { const pr = a.play(); if (pr && pr.catch) pr.catch(() => { unlockOnGesture(); }); };
  function startTrack(key) {
    if (!players.length) players.push(player(), player());
    const next = (state.cur + 1) % 2, a = players[next], old = players[state.cur];
    a.src = url(MUSIC[key]);
    a.loop = !FESTIVAL_TRACKS.includes(key);
    a.volume = 0;
    a.preservesPitch = true; // faster tempo, same pitch
    a.playbackRate = state.rate;
    playSafe(a);
    state.cur = next; state.key = key; state.since = nowS();
    state.fade = { t0: nowS(), from: old || null, fromVol: old ? old.volume : 0 };
  }
  function stepFade() {
    const f = state.fade, a = players[state.cur];
    if (!a) return;
    const k = f ? Math.min(1, (nowS() - f.t0) / FADE_S) : 1;
    a.volume = Au.music * k * state.mute;
    if (f && f.from) f.from.volume = f.fromVol * (1 - k) * state.mute;
    if (f && k >= 1) { if (f.from) { f.from.pause(); f.from.removeAttribute('src'); f.from.load(); } state.fade = null; }
  }

  // Which track the town calls for right now.
  function wanted(app) {
    if (Au.scene) return Au.scene;
    const w = app.world;
    if (!w) return 'setup';
    const day = Math.max(0, w.lastDay);
    const fest = LES.Ambience.festival(day);
    if (fest && FESTIVAL_TRACKS.includes(fest.id)) {
      const k = `${fest.id}|${Math.floor(day / 365)}`;
      // Each festival once a year, and not back to back at high speed.
      if (!state.festPlayed[k] && nowS() - state.lastFestAt > FESTIVAL_GAP_S) {
        state.festPlayed[k] = true; state.lastFestAt = nowS(); state.festKey = fest.id;
      }
    }
    if (state.festKey) return state.festKey; // plays to the end of the cue
    if (w.regime === 'growth') return 'boom';
    if (w.regime === 'recession') return 'recession';
    return LES.isNight(app.dayFrac) ? 'night' : 'day';
  }

  // ---------------- Sound effects ----------------
  const lastSfx = {};
  let lastAny = 0;
  Au.play = function (name, force) {
    const d = SFX[name];
    if (!Au.on || !d || Au.sfx <= 0) return;
    const t = nowS();
    if (!force && (t - (lastSfx[name] || -1e9) < d[2] || (name !== 'click' && t - lastAny < 0.25))) return;
    lastSfx[name] = t;
    if (name !== 'click') lastAny = t;
    const a = new Audio(url(d[0]));
    a.volume = Math.min(1, d[1] * Au.sfx);
    playSafe(a);
    if (d[3]) { // long file (train horn): fade out after a few seconds
      setTimeout(() => {
        const v0 = a.volume, t0 = performance.now();
        const iv = setInterval(() => { const k = (performance.now() - t0) / 600; if (k >= 1) { a.pause(); clearInterval(iv); } else a.volume = v0 * (1 - k); }, 50);
      }, d[3] * 1000);
    }
  };

  // Map a new town event to a sound. Notable events (importance 2+) and anything
  // that happens to the selected person; at high speed only the big ones.
  // The selected person's events come from their own life log (fromLog), which also
  // has the small ones the town feed leaves out.
  Au.onEvent = function (e, app, fromLog) {
    if (!Au.on) return;
    const t = e.text, mine = e.pid >= 0 && e.pid === app.selected;
    if (mine && !fromLog) return;
    if (/REACHED THE GOAL/.test(t)) return Au.play('fanfare', true);
    if (!(mine || e.imp >= 2)) return; // every speed: per-sound cooldowns keep fast runs from piling up
    let s = null;
    switch (e.cat) {
      case 'goal': if (/^Achieved a life goal/.test(t)) s = 'fanfare'; break;
      case 'wealth': s = 'chime'; break;
      case 'family': s = /^Became partners/.test(t) ? 'wedding' : /^Welcomed baby/.test(t) ? 'baby' : null; break;
      case 'death': s = 'funeral'; break;
      case 'crime': s = /was killed|convicted of murdering/.test(t) ? 'funeral' : /Police raid|gang formed/.test(t) ? 'sad' : null; break;
      case 'edu': if (/^Graduated/.test(t)) s = 'graduation'; break;
      case 'career': if (/^(Hired|Switched|Promoted)/.test(t)) s = 'hired'; break;
      case 'biz': s = /went bankrupt|months of losses|lost a major customer/.test(t) ? 'sad' : /^Founded|breakthrough|own headquarters/.test(t) ? 'cash' : null; break;
      case 'money': if (/^Declared bankrupt/.test(t)) s = 'sad'; break;
      case 'economy': if (/collapsed and was delisted|entered a recession/i.test(t)) s = 'sad'; break;
      default: break;
    }
    if (s) Au.play(s);
  };

  // ---------------- Per-frame: music choice, trains, horns, fireworks ----------------
  const town = { lastTm: -1, lastDay: -1, honkAt: 0, fwDay: -1 }, watch = { id: -1, last: null };
  function watchSelected(app) {
    const w = app.world, p = w && app.selected >= 0 ? w.people[app.selected] : null;
    if (!p) { watch.id = -1; return; }
    const log = p.log, last = log[log.length - 1] || null;
    if (watch.id === p.id && last !== watch.last) {
      let i = log.length - 1;
      while (i > 0 && log[i - 1] !== watch.last && log.length - i < 5) i--; // only the newest few
      for (; i < log.length; i++) Au.onEvent(Object.assign({ pid: p.id }, log[i]), app, true);
    }
    watch.id = p.id; watch.last = last;
  }
  Au.tick = function (app) {
    if (!Au.on) return;
    watchSelected(app);
    const t = nowS(), dt = Math.min(0.5, t - (state.lastTick || t));
    state.lastTick = t;
    // Music only at 1x and 10x (and always on the setup and report screens).
    const allowed = !!Au.scene || app.speedIdx < MUSIC_RATE.length;
    state.mute = Math.max(0, Math.min(1, state.mute + (allowed ? 1 : -1) * dt / FADE_S));
    const rate = Au.scene ? 1 : MUSIC_RATE[app.speedIdx] || 1;
    if (rate !== state.rate) { state.rate = rate; for (const a of players) if (a) a.playbackRate = rate; }
    const cur = players[state.cur];
    if (!allowed) {
      stepFade();
      if (state.mute <= 0 && cur && !cur.paused) cur.pause(); // resumes where it left off
    } else if (cur && cur.paused && cur.src && !cur.ended) playSafe(cur);
    const want = allowed ? wanted(app) : state.key;
    // Hold a track for a while so fast regime flips don't make the music jump around.
    const urgent = Au.scene || state.key === 'setup' || state.key === 'report' || FESTIVAL_TRACKS.includes(want);
    if (allowed && want !== state.key && (urgent || t - state.since > MIN_HOLD_S || state.key === null)) startTrack(want);
    if (allowed) stepFade();

    const w = app.world;
    if (!w || app.paused || app.speedIdx > 2 || Au.scene) { town.lastTm = -1; return; }
    const tm = app.dayFrac * 1440, day = w.lastDay;
    if (town.lastTm >= 0 && town.lastDay === day) {
      // Trains roll in every 2 hours from 06:30 (see Renderer.drawTrain).
      for (let k = 0; k <= 8; k++) { const at = 32 + 120 * k; if (town.lastTm < at && tm >= at) Au.play('train'); }
    }
    town.lastTm = tm; town.lastDay = day;
    if (app.speedIdx <= 1 && tm > 60 && tm < 900 && t > town.honkAt) { // daytime traffic at the slowest speeds
      if (town.honkAt) Au.play('honk');
      town.honkAt = t + 45 + Math.random() * 75;
    }
    const fest = LES.Ambience.festival(Math.max(0, day));
    if (fest && (fest.id === 'newyear' || fest.id === 'merdeka') && (app.renderer.nightLevel || 0) > 0.5 && town.fwDay !== day) {
      town.fwDay = day;
      Au.play('fireworks');
    }
  };

  // ---------------- Scenes, switches and volumes ----------------
  // 'setup' while the new-world screen is open, 'report' at the end or while reading the report.
  Au.setScene = function (s) { Au.scene = s; };
  // A new world: festivals can play again and the town's own music takes over.
  Au.newWorld = function () { state.festPlayed = {}; state.festKey = null; state.lastFestAt = -1e9; Au.scene = null; };
  Au.setMusicVolume = function (v) { Au.music = Math.min(1, Math.max(0, v)); store.set('les-music-vol', Au.music); if (!state.fade) stepFade(); };
  Au.setSfxVolume = function (v) { Au.sfx = Math.min(1, Math.max(0, v)); store.set('les-sfx-vol', Au.sfx); };
  Au.setOn = function (on) {
    Au.on = !!on;
    store.set('les-sound', Au.on ? 1 : 0);
    if (!Au.on) { for (const a of players) a.pause(); return; }
    const a = players[state.cur];
    if (a && a.src) playSafe(a);
  };
  Au.toggle = function () { Au.setOn(!Au.on); return Au.on; };
  Au.wasOn = () => store.get('les-sound') === '1';
  // What is playing (for the console / tests).
  Au.status = () => { const a = players[state.cur]; return { track: state.key, playing: !!a && !a.paused, time: a ? +a.currentTime.toFixed(1) : 0, volume: a ? +a.volume.toFixed(2) : 0 }; };

  // Browsers only start audio after a click or key press: retry on the next one.
  let unlockArmed = false;
  function unlockOnGesture() {
    if (unlockArmed) return;
    unlockArmed = true;
    const go = () => {
      unlockArmed = false;
      document.removeEventListener('pointerdown', go, true);
      document.removeEventListener('keydown', go, true);
      if (Au.on) { const a = players[state.cur]; if (a && a.src) playSafe(a); }
    };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }

  // A soft click for buttons (not the sound button itself).
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (b && b.id !== 'btn-sound' && b.id !== 'btn-sound-setup') Au.play('click');
  }, true);
  // Coming back from the report tab: back to the town's own music.
  document.addEventListener('visibilitychange', () => {
    const app = window.LES_APP;
    if (!document.hidden && Au.scene === 'report' && app && app.world && !app.world.ended) Au.scene = null;
  });
})(globalThis.LES = globalThis.LES || {});
