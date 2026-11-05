// Mini-map (Phase 6.3): a small plan of the town in the corner of the map (the same schematic plan as the
// region view) with a box for what is on screen. Click or drag on it to move the view. Hidden in the region
// view and when the whole town already fits on screen.
(function (LES) {
  'use strict';
  const MM = LES.MiniMap = { plan: null, key: '', town: null, drag: false };
  const WIDTH = 168;

  function el() {
    let c = document.getElementById('minimap');
    if (c) return c;
    const wrap = document.getElementById('map-wrap');
    if (!wrap) return null;
    c = document.createElement('canvas');
    c.id = 'minimap'; c.title = 'Mini-map: click or drag to move the view';
    wrap.appendChild(c);
    const go = e => {
      const app = LES.UI && LES.UI.app, r = app && app.renderer, w = app && app.world;
      if (!r || !w) return;
      const b = c.getBoundingClientRect(), T = w.town.T;
      r.centerOn((e.clientX - b.left) / b.width * w.town.W * T, (e.clientY - b.top) / b.height * w.town.H * T, 1);
      if (r.clampCam) r.clampCam();
      r.follow = false;
    };
    c.addEventListener('mousedown', e => { MM.drag = true; go(e); e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', e => { if (MM.drag) go(e); });
    window.addEventListener('mouseup', () => { MM.drag = false; });
    c.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
    return c;
  }

  MM.draw = function () {
    const app = LES.UI && LES.UI.app, r = app && app.renderer, w = app && app.world, c = el();
    if (!c) return;
    if (!r || !w || app.view === 'region' || r.z <= r.fitZoom() * 1.05) { c.style.display = 'none'; return; }
    const t = w.town, H = Math.round(WIDTH * t.H / t.W), dpr = window.devicePixelRatio || 1;
    c.style.display = 'block'; c.style.width = `${WIDTH}px`; c.style.height = `${H}px`;
    if (c.width !== Math.round(WIDTH * dpr)) { c.width = Math.round(WIDTH * dpr); c.height = Math.round(H * dpr); }
    const key = `${w.townVersion}|${t.buildings.length}`;
    if (MM.town !== t || MM.key !== key || !MM.plan) {
      const S = 2, cv = document.createElement('canvas');
      cv.width = t.W * S; cv.height = t.H * S;
      LES.RegionMap.drawTown(cv.getContext('2d'), t, S);
      MM.plan = cv; MM.key = key; MM.town = t;
    }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(MM.plan, 0, 0, c.width, c.height);
    const k = c.width / (t.W * t.T), x = r.cx * k, y = r.cy * k, vw = r.vw / r.z * k, vh = r.vh / r.z * k;
    g.lineWidth = Math.max(1.5, dpr * 1.5); g.strokeStyle = '#fff'; g.strokeRect(x, y, vw, vh);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.strokeRect(x - 1, y - 1, vw + 2, vh + 2);
    const sel = app.selected >= 0 ? w.people[app.selected] : null; // the selected person
    if (sel && sel.alive && !sel.away && r.posOf) { const p = r.posOf(sel, app.dayFrac || 0, app.fast); g.fillStyle = '#f2c14e'; g.fillRect(p.x * k - 2 * dpr, p.y * k - 2 * dpr, 4 * dpr, 4 * dpr); }
  };
  if (typeof window !== 'undefined') setInterval(() => { try { MM.draw(); } catch (e) { /* the map is not ready yet */ } }, 200);
})(globalThis.LES = globalThis.LES || {});
