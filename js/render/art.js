// Town art: one shared palette and a small toolkit for drawing buildings in a 3/4
// top-down view (you see the roof and the front wall, with a soft cast shadow), the
// ground (grass, plots, roads, pavements, drains), trees and every building kind.
// Everything is drawn once into the cached map layer, so it costs nothing per frame.
// Presentation only: nothing here reads or changes the simulation.
(function (LES) {
  'use strict';
  const C = LES.C;
  const FONT = '"Silkscreen", "Press Start 2P", monospace';

  // ---- Palette (warm tropical; everything on the map samples from it) ----
  const PAL = {
    grass: ['#7fb054', '#88b95b', '#77a84e', '#93c264'], grassDark: '#628f42', tuft: '#5c8a3d',
    flowers: ['#f6d55c', '#ffffff', '#f28482', '#c77dff', '#ff9f1c'],
    lawn: '#8dc062', lawnStripe: '#84b85a', dirt: '#c9a46b', dirtDark: '#b38c56', sand: '#dcc191',
    concrete: '#d5cfc2', concreteLine: '#c4bdae', gravel: '#bdb5a3',
    asphalt: '#4b4f58', asphaltDark: '#43474f', asphaltLight: '#565b65', laneY: '#e9cf6a', laneW: '#ecebe4',
    kerb: '#a8a191', pave: '#d9cfb7', paveLine: '#c7bca2', drain: '#3f5d61', drainHi: '#5e8187',
    shadow: 'rgba(24,34,22,0.32)', outline: '#2c2a33',
    glass: '#8cc6de', glassDark: '#5f9ab6', glassHi: '#d2eef8', glassNight: '#ffd88a',
    wood: '#7a4f2b', woodDark: '#5c3b20', woodLight: '#a8743f',
    white: '#f7f4ec', cream: '#f2e8d2', sandWall: '#eadbb8',
    roof: { terracotta: '#c4603f', red: '#b5483a', brown: '#8a5a3c', blue: '#3e6f9e', green: '#3f7d5a', grey: '#7d8790', slate: '#55606b', zinc: '#9aa5ad', attap: '#a3804b', teal: '#2a8f84', purple: '#6c4f99', navy: '#24476b', maroon: '#7a2632' },
  };
  LES.PAL = PAL;

  // ---- Small helpers ----
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), gg = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return `#${((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1)}`;
  }
  const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };

  // Soft L-shaped shadow cast down-right (light comes from the top-left).
  function castShadow(g, X, Y, W, H, d) {
    d = d || 4;
    g.fillStyle = PAL.shadow;
    g.fillRect(X + d, Y + H, W, d);
    g.fillRect(X + W, Y + d, d, H);
  }

  // Signboard with a drop shadow.
  function sign(g, text, cx, y, bg, fg) {
    g.font = `8px ${FONT}`;
    const tw = Math.ceil(g.measureText(text).width);
    const x = Math.round(cx - tw / 2 - 3);
    rect(g, x + 1, y + 1, tw + 6, 11, 'rgba(0,0,0,0.35)');
    rect(g, x, y, tw + 6, 11, bg || '#20262e');
    rect(g, x, y, tw + 6, 1, 'rgba(255,255,255,0.25)');
    g.fillStyle = fg || '#f4f1e8';
    g.textBaseline = 'top';
    g.fillText(text, x + 3, y + 2);
  }

  // Roof painter over (X, Y, W, H). type: flat | gable | hip | shed | dome
  function roof(g, X, Y, W, H, col, type, o) {
    o = o || {};
    if (H <= 0) return;
    if (type === 'flat') {
      rect(g, X, Y, W, H, shade(col, 1.05));
      rect(g, X + 2, Y + 2, W - 4, H - 4, col);
      rect(g, X + 2, Y + 2, W - 4, 1, shade(col, 0.85)); // parapet shadow
      rect(g, X, Y, W, 1, shade(col, 1.2));
      if (o.details) rooftop(g, X + 3, Y + 3, W - 6, H - 6, o.details, o.seed || 0);
      return;
    }
    if (type === 'shed') { // single slope toward the viewer, zinc ribs
      rect(g, X, Y, W, H, col);
      for (let x = X + 2; x < X + W - 1; x += 3) rect(g, x, Y, 1, H, shade(col, 0.88));
      rect(g, X, Y, W, 1, shade(col, 1.2));
      rect(g, X, Y + H - 1, W, 1, shade(col, 0.7));
      return;
    }
    // Pitched roof, ridge running left-right: the back slope is lit, the front slope darker.
    const ridge = Math.round(Y + H * 0.4);
    rect(g, X, Y, W, ridge - Y, shade(col, 1.12));
    rect(g, X, ridge, W, Y + H - ridge, col);
    if (o.tiles !== false) {
      for (let y = Y + 2; y < ridge; y += 3) rect(g, X, y, W, 1, shade(col, 1.0));
      for (let y = ridge + 2; y < Y + H - 1; y += 3) rect(g, X, y, W, 1, shade(col, 0.88));
    }
    rect(g, X, ridge - 1, W, 2, shade(col, 0.72)); // ridge cap
    if (type === 'hip') { // the two end slopes catch less light
      const e = Math.min(Math.round(H * 0.6), Math.round(W / 4));
      for (let i = 0; i < e; i++) {
        const t = i / e, top = Math.round(Y + (ridge - Y) * t), bot = Math.round(Y + H - (Y + H - ridge) * t);
        rect(g, X + i, top, 1, bot - top, shade(col, 0.8));
        rect(g, X + W - 1 - i, top, 1, bot - top, shade(col, 0.9));
      }
    }
    rect(g, X - 1, Y + H - 1, W + 2, 2, shade(col, 0.6)); // eaves
  }

  // Rooftop clutter on flat roofs: AC units, water tanks, solar panels, a helipad.
  function rooftop(g, X, Y, W, H, kind, seed) {
    if (W < 6 || H < 6) return;
    const r = k => (hash(seed * 97 + k) % 1000) / 1000;
    if (kind === 'tanks' || kind === 'mixed') {
      for (let i = 0; i < 2; i++) {
        const x = X + 2 + Math.floor(r(i) * Math.max(1, W - 10)), y = Y + 2 + Math.floor(r(i + 5) * Math.max(1, H - 9));
        rect(g, x + 1, y + 1, 7, 6, 'rgba(0,0,0,0.2)'); rect(g, x, y, 7, 6, '#e8e4da'); rect(g, x, y, 7, 2, '#ffffff'); rect(g, x + 1, y + 6, 1, 1, '#777'); rect(g, x + 5, y + 6, 1, 1, '#777');
      }
    }
    if (kind === 'ac' || kind === 'mixed') {
      const n = Math.max(2, Math.floor(W * H / 160));
      for (let i = 0; i < n; i++) {
        const x = X + Math.floor(r(i + 20) * (W - 5)), y = Y + Math.floor(r(i + 40) * (H - 4));
        rect(g, x, y, 5, 4, '#c9ced3'); rect(g, x + 1, y + 1, 3, 2, '#8e969e');
      }
    }
    if (kind === 'solar') {
      for (let y = Y + 1; y < Y + H - 4; y += 6) for (let x = X + 1; x < X + W - 6; x += 8) { rect(g, x, y, 7, 5, '#2b4a7a'); rect(g, x, y, 7, 1, '#5c84c0'); }
    }
    if (kind === 'helipad') {
      const cx = X + W / 2, cy = Y + H / 2;
      g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(cx, cy, Math.min(W, H) / 2 - 1, 0, Math.PI * 2); g.fill();
      rect(g, cx - 4, cy - 4, 2, 8, '#f2c14e'); rect(g, cx + 2, cy - 4, 2, 8, '#f2c14e'); rect(g, cx - 2, cy - 1, 4, 2, '#f2c14e');
    }
    if (kind === 'pool') {
      rect(g, X + 2, Y + 2, W - 4, H - 4, '#e8e4da'); rect(g, X + 4, Y + 4, W - 8, H - 8, '#4fc1e0'); rect(g, X + 5, Y + 5, Math.max(2, W / 3), 1, '#a6e3f2');
    }
  }

  // Front wall (facade) over (X, Y, W, H): eaves shadow at the top, plinth at the bottom.
  function facade(g, X, Y, W, H, col) {
    if (H <= 0) return;
    rect(g, X, Y, W, H, col);
    rect(g, X, Y, W, 2, shade(col, 0.72));
    rect(g, X, Y + H - 2, W, 2, shade(col, 0.8));
    rect(g, X, Y, 1, H, shade(col, 1.08));
    rect(g, X + W - 1, Y, 1, H, shade(col, 0.82));
  }

  // A whole 3/4-view building: roof on top, front wall below, shadow and outline.
  // o: { wall, roof, roofType, wallH, details, seed, noShadow }
  function building(g, X, Y, W, H, o) {
    const wallH = Math.min(H - 2, o.wallH !== undefined ? o.wallH : Math.round(H * 0.4));
    if (!o.noShadow) castShadow(g, X, Y, W, H, o.shadow || 4);
    roof(g, X, Y, W, H - wallH, o.roof, o.roofType || 'flat', o);
    facade(g, X, Y + H - wallH, W, wallH, o.wall);
    g.strokeStyle = 'rgba(30,28,36,0.55)'; g.lineWidth = 1;
    g.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1);
    return { wallY: Y + H - wallH, wallH };
  }

  // Window rectangles seen while painting; the night layer lights some of them up.
  let lightRects = null;
  const addLight = (x, y, w, h, lit, c) => { if (lightRects) lightRects.push({ x, y, w, h, lit, c }); };
  // Row(s) of windows on a facade band.
  function windows(g, X, Y, W, H, cols, rows, o) {
    o = o || {};
    const lit = o.lit === undefined ? 0.6 : o.lit;
    const cw = W / cols, rh = H / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ww = Math.max(2, Math.round(cw * (o.wide || 0.55))), hh = Math.max(2, Math.round(rh * (o.tall || 0.6)));
      const x = Math.round(X + c * cw + (cw - ww) / 2), y = Math.round(Y + r * rh + (rh - hh) / 2);
      if (o.frame) rect(g, x - 1, y - 1, ww + 2, hh + 2, o.frame);
      rect(g, x, y, ww, hh, o.col || PAL.glass);
      rect(g, x, y, ww, 1, PAL.glassHi);
      if (ww >= 4 && hh >= 4) rect(g, x + ww - 1, y + 1, 1, hh - 1, PAL.glassDark);
      if (o.sill) rect(g, x - 1, y + hh, ww + 2, 1, o.sill);
      if (lightRects && lit > 0) lightRects.push({ x, y, w: ww, h: hh, lit, c: o.night });
    }
  }
  function door(g, cx, bottom, w, h, col) {
    const x = Math.round(cx - w / 2);
    rect(g, x - 1, bottom - h - 1, w + 2, h + 1, shade(col, 0.6));
    rect(g, x, bottom - h, w, h, col);
    rect(g, x, bottom - h, w, 1, shade(col, 1.25));
    if (w >= 6) rect(g, x + w / 2, bottom - h, 1, h, shade(col, 0.75));
  }
  function awning(g, X, Y, W, a, b) {
    for (let x = 0; x < W; x += 4) rect(g, X + x, Y, Math.min(4, W - x), 4, (x / 4) % 2 ? a : b);
    rect(g, X, Y + 4, W, 1, 'rgba(0,0,0,0.25)');
  }
  function fence(g, X, Y, W, col) {
    rect(g, X, Y, W, 1, col);
    for (let x = X; x < X + W; x += 3) rect(g, x, Y - 2, 1, 3, col);
  }
  function car(g, x, y, col) { // parked car seen from above-front
    rect(g, x + 1, y + 1, 12, 7, 'rgba(0,0,0,0.25)');
    rect(g, x, y, 12, 7, col); rect(g, x + 2, y + 1, 8, 2, '#9fd3e0'); rect(g, x + 1, y + 6, 2, 1, '#111'); rect(g, x + 9, y + 6, 2, 1, '#111');
    rect(g, x, y + 4, 12, 1, shade(col, 0.75));
  }
  function bike(g, x, y, col) { rect(g, x, y + 2, 6, 2, col); rect(g, x, y + 4, 1, 1, '#111'); rect(g, x + 5, y + 4, 1, 1, '#111'); rect(g, x + 4, y, 1, 2, '#333'); }

  // ---- Trees and plants ----
  function rainTree(g, x, y, s, R) { // broad Malaysian rain tree / angsana
    s = s || 1;
    const w = Math.round(14 * s), h = Math.round(11 * s);
    g.fillStyle = PAL.shadow; g.beginPath(); g.ellipse(x + w / 2 + 3, y + h + 2, w / 2, 3 * s, 0, 0, Math.PI * 2); g.fill();
    rect(g, x + w / 2 - 1, y + h - 3, 3, 5 * s, '#6e4e31');
    const blobs = [[0.5, 0.45, 0.5], [0.25, 0.55, 0.32], [0.75, 0.55, 0.32], [0.45, 0.25, 0.32], [0.7, 0.3, 0.26]];
    for (const [bx, by, br] of blobs) { g.fillStyle = '#3c7d3a'; g.beginPath(); g.ellipse(x + w * bx, y + h * by, w * br, h * br * 0.95, 0, 0, Math.PI * 2); g.fill(); }
    for (const [bx, by, br] of blobs.slice(3)) { g.fillStyle = '#58a04a'; g.beginPath(); g.ellipse(x + w * bx - 1, y + h * by - 1, w * br * 0.6, h * br * 0.55, 0, 0, Math.PI * 2); g.fill(); }
    rect(g, x + w * 0.35, y + h * 0.12, 2, 1, '#7cc35f');
    if (R && R.next() < 0.15) rect(g, x + w * 0.6, y + h * 0.4, 2, 2, '#f28482'); // flowering
  }
  function palm(g, x, y) {
    g.fillStyle = PAL.shadow; g.beginPath(); g.ellipse(x + 7, y + 15, 6, 2, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 10; i++) rect(g, x + 4 + Math.round(Math.sin(i / 3) * 1), y + 5 + i, 2, 1, i % 2 ? '#8a6a43' : '#9c7a4f');
    const fronds = [[-5, 2, 6, 2], [5, 2, 6, 2], [-3, -1, 5, 2], [4, -1, 5, 2], [0, -3, 3, 4], [-6, 4, 3, 1], [9, 4, 3, 1]];
    for (const [dx, dy, w, h] of fronds) rect(g, x + 3 + dx, y + 4 + dy, w, h, '#3f8f3a');
    rect(g, x + 2, y + 3, 6, 2, '#5fb34f');
    rect(g, x + 4, y + 5, 2, 2, '#6b4f2a'); // coconuts
  }
  function banana(g, x, y) {
    rect(g, x + 4, y + 6, 2, 6, '#7b8f3a');
    for (const [dx, dy, w] of [[-3, 2, 6], [3, 1, 6], [0, -1, 4], [-2, 5, 4], [4, 5, 4]]) rect(g, x + 3 + dx, y + 3 + dy, w, 2, '#6fb342');
  }
  function shrub(g, x, y, col) {
    g.fillStyle = PAL.shadow; g.fillRect(x + 2, y + 4, 7, 2);
    g.fillStyle = col || '#4f9441'; g.beginPath(); g.ellipse(x + 4, y + 3, 4, 3, 0, 0, Math.PI * 2); g.fill();
    rect(g, x + 2, y + 1, 2, 1, '#7cc35f');
  }

  // ---- Ground ----
  function grassPattern(g) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const t = cv.getContext('2d'), R = new LES.RNG('grass-tile');
    rect(t, 0, 0, 64, 64, PAL.grass[0]);
    for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) {
      const v = R.next();
      if (v < 0.18) rect(t, x, y, 2, 2, PAL.grass[1]); else if (v < 0.3) rect(t, x, y, 2, 2, PAL.grass[2]); else if (v < 0.33) rect(t, x, y, 2, 2, PAL.grass[3]);
    }
    for (let i = 0; i < 26; i++) { const x = R.int(0, 62), y = R.int(0, 61); rect(t, x, y, 1, 2, PAL.tuft); rect(t, x + 1, y + 1, 1, 1, PAL.tuft); }
    return g.createPattern(cv, 'repeat');
  }
  function tiledPattern(g, base, line, size, mortar) {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const t = cv.getContext('2d');
    rect(t, 0, 0, size, size, base);
    rect(t, 0, 0, size, 1, line); rect(t, 0, 0, 1, size, line);
    if (mortar) rect(t, size / 2, size / 2, 1, 1, line);
    return g.createPattern(cv, 'repeat');
  }
  function noisePattern(g, base, a, b, n) {
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48;
    const t = cv.getContext('2d'), R = new LES.RNG(`noise${base}`);
    rect(t, 0, 0, 48, 48, base);
    for (let i = 0; i < n; i++) rect(t, R.int(0, 47), R.int(0, 47), 1 + R.int(0, 1), 1, R.next() < 0.5 ? a : b);
    return g.createPattern(cv, 'repeat');
  }

  // Ground surface of each district block, before buildings are drawn on it.
  const PAVED = new Set(['O', 'H', 'S', 'M', 'D', 'X', 'V', 'Y', 'N', 'j', 'g']);
  const INDUSTRIAL = new Set(['I', 'W', 'G']);
  function drawGround(g, town, R) {
    const T = town.T, W = town.W * T, H = town.H * T;
    g.fillStyle = grassPattern(g); g.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 900; i++) rect(g, R.int(0, W), R.int(0, H), 1, 1, R.pick(PAL.flowers));
    const pave = tiledPattern(g, PAL.concrete, PAL.concreteLine, 8, true), grav = noisePattern(g, PAL.gravel, '#aea691', '#cbc4b3', 220);
    const dirt = noisePattern(g, PAL.sand, PAL.dirtDark, '#e6d0a3', 160);
    for (const bl of town.blocks) {
      const X = (bl.px !== undefined ? bl.px : bl.x) * T, Y = (bl.py !== undefined ? bl.py : bl.y) * T;
      const BW = (bl.pw || 14) * T, BH = (bl.ph || 11) * T;
      if (PAVED.has(bl.code)) { g.fillStyle = pave; g.fillRect(X + 2, Y + 2, BW - 4, BH - 4); }
      else if (INDUSTRIAL.has(bl.code)) { g.fillStyle = grav; g.fillRect(X + 2, Y + 2, BW - 4, BH - 4); }
      else if (bl.code === 'K' || bl.code === 'A') { // kampung: sandy yards and footpaths
        for (let i = 0; i < 14; i++) { g.fillStyle = dirt; g.beginPath(); g.ellipse(X + R.int(10, BW - 10), Y + R.int(10, BH - 10), R.int(10, 22), R.int(6, 12), 0, 0, Math.PI * 2); g.fill(); }
        rect(g, X + BW / 2 - 3, Y, 6, BH, PAL.dirt);
      } else if (bl.code === 'T' || bl.code === 'B' || bl.code === 'C') { // tidy lawns
        rect(g, X + 4, Y + 4, BW - 8, BH - 8, PAL.lawn);
        for (let y = Y + 4; y < Y + BH - 4; y += 8) rect(g, X + 4, y, BW - 8, 4, PAL.lawnStripe);
      }
    }
    // Roads: built from the pieces that exist (varied towns drop some, a river replaces one).
    const { pieces, nodes } = LES.roadPieces(town);
    const L = town.layout;
    if (L) drawEdge(g, town, R);
    if (L) drawPlotExtras(g, town, R);
    if (L && L.river >= 0) drawRiver(g, town, R);
    if (L) drawGreenways(g, town, R);
    const asph = noisePattern(g, PAL.asphalt, PAL.asphaltDark, PAL.asphaltLight, 260);
    const walk = tiledPattern(g, PAL.pave, PAL.paveLine, 6, false);
    const RW = 2 * T, ext = T + 8; // pavements run on through junctions; asphalt covers them where roads cross
    for (const p of pieces) { // pavements and drains on both sides
      g.fillStyle = walk;
      if (p.h) {
        const x0 = p.x - (p.edge ? 0 : ext), w = p.w + (p.edge ? ext : 2 * ext);
        g.fillRect(x0, p.y - 6, w, 6); g.fillRect(x0, p.y + RW, w, 6);
        rect(g, x0, p.y - 8, w, 2, PAL.drain); rect(g, x0, p.y + RW + 6, w, 2, PAL.drain); rect(g, x0, p.y - 8, w, 1, PAL.drainHi);
      } else {
        const y0 = p.y - (p.edge ? 0 : ext), h = p.h2 + (p.edge ? ext : 2 * ext);
        g.fillRect(p.x - 6, y0, 6, h); g.fillRect(p.x + RW, y0, 6, h);
        rect(g, p.x - 8, y0, 2, h, PAL.drain); rect(g, p.x + RW + 6, y0, 2, h, PAL.drain);
      }
    }
    g.fillStyle = asph;
    for (const p of pieces) { if (p.h) g.fillRect(p.x, p.y, p.w, RW); else g.fillRect(p.x, p.y, RW, p.h2); }
    for (const n of nodes) g.fillRect(n.x, n.y, RW, RW);
    for (const p of pieces) { // kerbs and lane markings
      if (p.h) {
        rect(g, p.x, p.y, p.w, 1, PAL.kerb); rect(g, p.x, p.y + RW - 1, p.w, 1, PAL.kerb);
        for (let x = p.x + 4; x < p.x + p.w - 7; x += 14) rect(g, x, p.y + T - 1, 7, 2, PAL.laneY);
      } else {
        rect(g, p.x, p.y, 1, p.h2, PAL.kerb); rect(g, p.x + RW - 1, p.y, 1, p.h2, PAL.kerb);
        for (let y = p.y + 4; y < p.y + p.h2 - 7; y += 14) rect(g, p.x + T - 1, y, 2, 7, PAL.laneY);
      }
    }
    for (const n of nodes) {
      if (n.deg >= 3) for (let i = 0; i < 4; i++) { // zebra crossings on every arm of a junction
        if (n.W) rect(g, n.x - 11, n.y + 2 + i * 8, 8, 4, PAL.laneW);
        if (n.E) rect(g, n.x + RW + 3, n.y + 2 + i * 8, 8, 4, PAL.laneW);
        if (n.N) rect(g, n.x + 2 + i * 8, n.y - 11, 4, 8, PAL.laneW);
        if (n.S) rect(g, n.x + 2 + i * 8, n.y + RW + 3, 4, 8, PAL.laneW);
      }
      if (n.deg >= 2 && n.deg < 3) { rect(g, n.x + T - 3, n.y + T - 3, 6, 6, PAL.asphaltLight); rect(g, n.x + T - 2, n.y + T - 2, 4, 4, '#3a3d44'); } // manhole
    }
    drawJunctions(g, town, RW, asph);
    if (L) { drawAvenues(g, town, pieces, R); if (L.river >= 0) drawBridges(g, town); }
  }

  // Roundabouts (island, ring, give-way teeth) and traffic-light stop lines and poles.
  // The lamps themselves are drawn each frame by the renderer (they change colour).
  function drawJunctions(g, town, RW, asph) {
    const T = town.T;
    for (const n of LES.junctions(town)) {
      const cx = n.x + T, cy = n.y + T;
      if (n.type === 'roundabout') {
        g.fillStyle = asph; g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fill();
        g.strokeStyle = PAL.laneW; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        // A small central island (kept clear of the lanes vehicles drive in): kerb, grass, a shrub and flowers.
        g.fillStyle = '#d9d2c3'; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7fbf5a'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3c7d3a'; g.beginPath(); g.arc(cx, cy - 1, 3, 0, Math.PI * 2); g.fill();
        for (const f of [[-4, 1, '#f28482'], [3, 1, '#ffd166'], [-1, 3, '#ffffff']]) rect(g, cx + f[0], cy + f[1], 1, 1, f[2]);
        const teeth = (x, y, dx, dy) => { for (let k = 0; k < 3; k++) rect(g, x + dx * k * 5, y + dy * k * 5, 3, 3, PAL.laneW); };
        if (n.W) teeth(n.x - 4, n.y + T + 2, 0, 1); if (n.E) teeth(n.x + RW + 1, n.y + 2, 0, 1); // give way to traffic on the roundabout (left-hand traffic)
        if (n.N) teeth(n.x + 2, n.y - 4, 1, 0); if (n.S) teeth(n.x + T + 2, n.y + RW + 1, 1, 0);
      } else if (n.type === 'lights') {
        if (n.W) rect(g, n.x - 2, n.y + T, 2, T, PAL.laneW); if (n.E) rect(g, n.x + RW, n.y, 2, T, PAL.laneW); // stop lines on the inbound lanes
        if (n.N) rect(g, n.x, n.y - 2, T, 2, PAL.laneW); if (n.S) rect(g, n.x + T, n.y + RW, T, 2, PAL.laneW);
        for (const [px, py] of [[n.x - 6, n.y - 12], [n.x + RW + 4, n.y + RW - 4]]) { rect(g, px, py, 2, 12, '#4a4f57'); rect(g, px + 2, py + 11, 2, 2, 'rgba(0,0,0,0.25)'); } // poles
        for (const [px, py] of [[n.x + RW + 4, n.y - 12], [n.x - 6, n.y + RW - 4]]) { rect(g, px, py, 2, 12, '#4a4f57'); }
      }
    }
  }

  // A river winding down one north-south gap, with sandy banks and a few reeds.
  function drawRiver(g, town, R) {
    const T = town.T, c = town.layout.river, X0 = (town.colX[c] + 14 + town.layout.padX[c]) * T, Wd = town.layout.gapX[c] * T, H = (town.layout.edge.side === 's' ? town.H - town.layout.edge.size : town.H) * T;
    const mid = X0 + Wd / 2, ph = R.next() * 6;
    const at = y => mid + Math.sin(y / 70 + ph) * T * 0.55 + Math.sin(y / 23 + ph * 2) * 3;
    for (let y = 0; y < H; y += 2) {
      const cx = at(y), half = T * 1.35 + Math.sin(y / 41 + ph) * 3;
      rect(g, cx - half - 4, y, 2 * half + 8, 2, PAL.sand);
      rect(g, cx - half, y, 2 * half, 2, '#3f8fb5');
      rect(g, cx - half + 3, y, 2 * half - 6, 2, '#4a9cc2');
      if (y % 10 === 0) rect(g, cx - half / 2 + Math.sin(y) * half / 2, y, 5, 1, '#7cc3e0');
    }
    for (let i = 0; i < H / 40; i++) { const y = R.int(0, H - 6), side = R.next() < 0.5 ? -1 : 1, x = at(y) + side * (T * 1.35 + 3); rect(g, x, y, 1, 4, '#5f8f43'); rect(g, x + 2, y + 1, 1, 3, '#6fa34b'); }
  }
  // Railings where roads cross the river.
  function drawBridges(g, town) {
    const T = town.T, c = town.layout.river, X0 = (town.colX[c] + 14 + town.layout.padX[c]) * T, Wd = town.layout.gapX[c] * T;
    for (let j = 0; j < town.rows; j++) {
      const y = town.roadsY[j] * T;
      for (const yy of [y - 9, y + 2 * T + 7]) { rect(g, X0, yy, Wd, 2, '#cfc6b0'); for (let x = X0; x < X0 + Wd; x += 6) rect(g, x, yy - 2, 1, 2, '#a59f92'); }
    }
  }
  // Where a road piece was dropped (superblocks) a shaded footpath joins the blocks.
  function drawGreenways(g, town, R) {
    const T = town.T, L = town.layout;
    const path = (x, y, w, h) => { rect(g, x, y, w, h, PAL.sand); rect(g, x, y, w, 1, PAL.dirtDark); };
    for (let c = 0; c < town.cols; c++) for (let r = 0; r < town.rows; r++) {
      if (L.vseg[c][r] || c === L.river) continue;
      const x = town.roadsX[c] * T, y0 = r === 0 ? 0 : (town.roadsY[r - 1] + 2) * T, y1 = town.roadsY[r] * T;
      rect(g, x - 10, y0 + 2, 2 * T + 20, y1 - y0 - 4, PAL.lawn); // the two blocks join into one superblock
      path(x + T - 3, y0, 6, y1 - y0);
      for (let y = y0 + 8; y < y1 - 16; y += 34) { rainTree(g, x - 2, y, 0.8, R); rainTree(g, x + T + 4, y + 16, 0.8, R); }
    }
    for (let j = 0; j < town.rows; j++) for (let c = 0; c < town.cols; c++) {
      if (L.hseg[j][c]) continue;
      const y = town.roadsY[j] * T, x0 = c === 0 ? 0 : (town.roadsX[c - 1] + 2) * T, x1 = town.roadsX[c] * T;
      rect(g, x0 + 2, y - 10, x1 - x0 - 4, 2 * T + 20, PAL.lawn);
      path(x0, y + T - 3, x1 - x0, 6);
      for (let x = x0 + 10; x < x1 - 20; x += 40) { shrub(g, x, y + 2); rainTree(g, x + 18, y + T + 4, 0.75, R); }
    }
  }
  // Spare ground around a varied town's buildings: car parks, playgrounds and gardens.
  const HOMES = new Set(['K', 'A', 'F', 'T', 'C', 'B', 'R']);
  function drawPlotExtras(g, town, R) {
    const T = town.T;
    for (const bl of town.blocks) {
      if (bl.px === undefined || bl.code === 'L' || bl.code === 'Z' || bl.code === 'P') continue;
      const strips = [];
      const wl = bl.x - bl.px, wr = bl.px + bl.pw - bl.x - 14, ht = bl.y - bl.py, hb = bl.py + bl.ph - bl.y - 11;
      if (wl >= 2) strips.push({ x: bl.px, y: bl.y, w: wl, h: 11 });
      if (wr >= 2) strips.push({ x: bl.x + 14, y: bl.y, w: wr, h: 11 });
      if (ht >= 2) strips.push({ x: bl.px, y: bl.py, w: bl.pw, h: ht });
      if (hb >= 2) strips.push({ x: bl.px, y: bl.y + 11, w: bl.pw, h: hb });
      strips.forEach((st, i) => {
        const X = st.x * T + 3, Y = st.y * T + 3, W = st.w * T - 6, H = st.h * T - 6;
        const pick = (bl.c * 7 + bl.r * 13 + i) % 3;
        if (!HOMES.has(bl.code) || (bl.code === 'F' || bl.code === 'C') && pick === 0) carPark(g, X, Y, W, H, R);
        else if (pick === 1) playground(g, X, Y, W, H);
        else garden(g, X, Y, W, H, R);
      });
    }
  }
  function carPark(g, X, Y, W, H, R) {
    rect(g, X, Y, W, H, '#5a5e66'); rect(g, X, Y, W, 1, PAL.kerb); rect(g, X, Y + H - 1, W, 1, PAL.kerb);
    const across = W >= H;
    if (across) for (let x = X + 2; x + 14 < X + W; x += 16) { rect(g, x, Y + 2, 1, Math.min(10, H - 4), '#e8e4da'); if (R.next() < 0.6) car(g, x + 2, Y + 3, R.pick(['#e63946', '#457b9d', '#f1faee', '#2a9d8f', '#e9c46a', '#14141a'])); }
    else for (let y = Y + 2; y + 9 < Y + H; y += 10) { rect(g, X + 2, y, Math.min(16, W - 4), 1, '#e8e4da'); if (R.next() < 0.6) car(g, X + 3, y + 2, R.pick(['#e63946', '#457b9d', '#f1faee', '#2a9d8f', '#e9c46a'])); }
  }
  function playground(g, X, Y, W, H) {
    rect(g, X, Y, W, H, '#e3c98f'); rect(g, X + 1, Y + 1, W - 2, H - 2, '#ead6a3');
    const cx = X + Math.min(W, 40) / 2, cy = Y + Math.min(H, 30) / 2;
    rect(g, cx - 8, cy - 6, 2, 10, '#e63946'); rect(g, cx + 6, cy - 6, 2, 10, '#e63946'); rect(g, cx - 8, cy - 7, 16, 2, '#e63946'); // swings
    rect(g, cx - 4, cy - 4, 1, 6, '#555'); rect(g, cx + 2, cy - 4, 1, 6, '#555'); rect(g, cx - 5, cy + 2, 3, 1, '#2a9d8f'); rect(g, cx + 1, cy + 2, 3, 1, '#2a9d8f');
    if (W > 44 || H > 34) { const sx = X + W - 22, sy = Y + H - 18; rect(g, sx, sy, 4, 12, '#f4a261'); for (let i = 0; i < 10; i++) rect(g, sx + 4 + i, sy + 2 + i, 2, 1, '#3a86ff'); } // slide
  }
  function garden(g, X, Y, W, H, R) {
    rect(g, X, Y, W, H, '#7fbf5a');
    for (let i = 0; i < Math.max(2, W * H / 500); i++) shrub(g, X + R.int(0, Math.max(1, W - 10)), Y + R.int(0, Math.max(1, H - 8)), R.pick(['#4f9441', '#d65a8a', '#f4a261', '#4f9441']));
    if (W >= 20 && H >= 10) { rect(g, X + W / 2 - 5, Y + H / 2, 10, 2, PAL.wood); rect(g, X + W / 2 - 5, Y + H / 2 + 2, 1, 2, PAL.woodDark); rect(g, X + W / 2 + 4, Y + H / 2 + 2, 1, 2, PAL.woodDark); }
  }
  // The coast (beach, sea and fishing boats) or a forested hill range along one edge.
  function drawEdge(g, town, R) {
    const e = town.layout.edge;
    if (!e || !e.size) return;
    const T = town.T, W = town.W * T, H = town.H * T, sz = e.size * T;
    const east = e.side === 'e', len = east ? H : W, base = east ? W - sz : H - sz;
    const wav = k => Math.sin(k / 53) * 10 + Math.sin(k / 17) * 4;
    for (let k = 0; k < len; k += 2) {
      const d = base + 10 + wav(k); // distance from the town side where the land ends
      const span = (east ? W : H) - d;
      const bandRect = (from, size, col) => east ? rect(g, from, k, size, 2, col) : rect(g, k, from, 2, size, col);
      if (e.kind === 'sea') {
        bandRect(d - 8, 8 + 18, PAL.sand);
        bandRect(d + 18, span, '#3a8fc0');
        bandRect(d + 18, 4, '#d7f0f7');
        if (k % 6 === 0) bandRect(d + 30 + (k * 7) % 40, 1, '#62aad2');
      } else {
        bandRect(d - 6, span + 6, '#4f7f3c');
        bandRect(d - 6, 3, '#3f6a30');
      }
    }
    if (e.kind === 'sea') {
      for (let i = 0; i < Math.max(2, len / 300); i++) { // fishing boats (perahu)
        const k = R.int(20, len - 40), off = base + 50 + R.int(0, sz - 80);
        const x = east ? off : k, y = east ? k : off;
        rect(g, x, y + 4, 16, 4, '#b5483a'); rect(g, x + 2, y + 8, 12, 2, '#7a2632'); rect(g, x + 7, y - 4, 1, 8, '#6e4e31'); rect(g, x + 8, y - 3, 5, 5, '#f4f1e8');
      }
    } else {
      for (let i = 0; i < len * sz / 260; i++) { const k = R.int(0, len - 10), off = base + 12 + R.int(0, sz - 24); rainTree(g, east ? off : k, east ? k : off, 0.9 + R.next() * 0.5, R); }
    }
  }

  // Tree-lined avenues: palms or rain trees in the verges beside the pavements.
  function drawAvenues(g, town, pieces, R) {
    const T = town.T, L = town.layout;
    for (const p of pieces) {
      if (p.h && L.avenueY.includes(p.j)) for (let x = p.x + 10; x < p.x + p.w - 10; x += 36) { palm(g, x, p.y - 26); palm(g, x + 18, p.y + 2 * T + 2); }
      if (!p.h && L.avenueX.includes(p.c)) for (let y = p.y + 6; y < p.y + p.h2 - 14; y += 36) { rainTree(g, p.x - 20, y, 0.75, R); rainTree(g, p.x + 2 * T + 6, y + 18, 0.75, R); }
    }
  }

  // ---- Building painters (3/4 view; every kind keeps its footprint) ----
  const SHOP_COLOURS = ['#f4a261', '#e9c46a', '#a8dadc', '#f6bd60', '#cdb4db', '#90be6d', '#f28482', '#84a59d'];
  const TERRACE_WALLS = ['#f3ead7', '#f6e1c6', '#e4eedb', '#f1dfe4', '#e2e8f0'];

  function drawBuilding(g, b, R) {
    const T = 16, X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
    switch (b.kind) {
      case 'kampung': { // Malay house on stilts with a steep attap/zinc roof and steps
        g.fillStyle = PAL.shadow; g.fillRect(X + 8, Y + 40, 36, 5);
        for (const sx of [8, 18, 28, 38]) rect(g, X + sx, Y + 31, 2, 11, PAL.woodDark);
        const rc = b.id % 3 === 0 ? PAL.roof.zinc : b.id % 3 === 1 ? PAL.roof.attap : PAL.roof.terracotta;
        roof(g, X + 2, Y + 3, 44, 17, rc, b.id % 3 === 0 ? 'shed' : 'gable');
        rect(g, X + 2, Y + 3, 44, 1, shade(rc, 1.25));
        facade(g, X + 5, Y + 20, 38, 13, '#b07d48');
        for (let i = 7; i < 41; i += 3) rect(g, X + i, Y + 22, 1, 10, '#9a6a3a');
        rect(g, X + 10, Y + 23, 7, 6, PAL.woodDark); rect(g, X + 11, Y + 24, 5, 4, '#f0c96b'); addLight(X + 11, Y + 24, 5, 4, 0.8); // shuttered window
        rect(g, X + 30, Y + 22, 7, 11, PAL.wood); rect(g, X + 30, Y + 22, 7, 1, PAL.woodLight);
        for (let i = 0; i < 4; i++) rect(g, X + 31 + i * 2, Y + 33 + i * 2, 5, 1, PAL.woodLight); // tangga (steps)
        if (b.id % 2) { rect(g, X + 2, Y + 42, 1, 4, '#888'); rect(g, X + 2, Y + 41, 10, 1, '#999'); rect(g, X + 4, Y + 42, 2, 2, '#e63946'); rect(g, X + 7, Y + 42, 2, 2, '#457b9d'); } // laundry line
        break;
      }
      case 'flat': { // PPR flats: corridors, laundry poles, AC units and motorbikes below
        const wall = b.id % 2 ? '#e8dcc0' : '#d4e6da';
        const s = building(g, X + 3, Y + 2, W - 6, H - 6, { wall, roof: PAL.roof.grey, wallH: H - 24, details: 'tanks', seed: b.id });
        const fy = s.wallY + 3, floors = 9, fh = (s.wallH - 14) / floors;
        for (let f = 0; f < floors; f++) {
          const y = Math.round(fy + f * fh);
          rect(g, X + 4, y + fh - 2, W - 8, 1, shade(wall, 0.78)); // corridor slab
          windows(g, X + 6, y, W - 12, fh - 2, 5, 1, { col: f % 3 === 1 ? PAL.glassDark : PAL.glass, tall: 0.7 });
          if (R.next() < 0.7) { const lx = X + 6 + R.int(0, W - 20); rect(g, lx, y + fh - 3, 8, 1, '#999'); rect(g, lx + 1, y + fh - 2, 2, 2, R.pick(C.SHIRTS)); rect(g, lx + 4, y + fh - 2, 2, 3, R.pick(C.SHIRTS)); }
          if (R.next() < 0.4) rect(g, X + W - 8, y + 1, 3, 2, '#c9ced3');
        }
        door(g, X + W / 2, Y + H - 4, 10, 9, '#5b4a3f');
        for (let i = 0; i < 4; i++) bike(g, X + 4 + i * 8, Y + H - 4, R.pick(['#e63946', '#1d3557', '#2a9d8f', '#f4a261']));
        sign(g, 'PPR', X + W / 2, Y + 1, '#3d5a80');
        break;
      }
      case 'terrace': { // a row of two-storey link houses, each with its own porch
        const units = Math.floor(W / 32);
        castShadow(g, X + 1, Y, units * 32, H, 3);
        for (let i = 0; i < units; i++) {
          const ux = X + i * 32 + 1, wall = TERRACE_WALLS[(b.id + i) % TERRACE_WALLS.length];
          roof(g, ux, Y, 31, 11, i % 2 ? PAL.roof.terracotta : PAL.roof.red, 'gable');
          facade(g, ux, Y + 11, 31, H - 13, wall);
          windows(g, ux + 3, Y + 13, 12, 6, 2, 1, { col: PAL.glass, frame: '#ffffff' });
          rect(g, ux + 18, Y + 13, 9, 10, '#d9d3c7'); rect(g, ux + 18, Y + 13, 9, 1, '#ffffff'); // porch grille
          for (let k = 0; k < 4; k++) rect(g, ux + 19 + k * 2, Y + 14, 1, 9, '#9aa0a6');
          rect(g, ux + 30, Y + 11, 1, H - 13, shade(wall, 0.75)); // party wall
          if ((b.id + i) % 3 === 0) car(g, ux + 3, Y + H - 9, ['#e63946', '#457b9d', '#e9e4da', '#2a9d8f'][(b.id + i) % 4]);
        }
        break;
      }
      case 'condo': { // tower with balconies, rooftop pool and gym
        const s = building(g, X + 3, Y, W - 6, H - 4, { wall: '#c4d6e2', roof: '#6f7f8c', wallH: H - 24, details: 'pool', seed: b.id });
        for (let yy = s.wallY + 4; yy < Y + H - 14; yy += 9) {
          rect(g, X + 5, yy, W - 10, 5, '#7fa7c2'); rect(g, X + 5, yy, W - 10, 1, PAL.glassHi);
          rect(g, X + 4, yy + 5, W - 8, 2, '#f1f5f8'); rect(g, X + 4, yy + 7, W - 8, 1, '#9fb0bd'); // balcony
        }
        rect(g, X + W / 2 - 1, Y - 6, 2, 7, '#5b6b78'); rect(g, X + W / 2 - 1, Y - 7, 2, 1, '#e63946');
        door(g, X + W / 2, Y + H - 4, 10, 8, '#3a4a58');
        break;
      }
      case 'bungalow': { // detached house: hip roof, lawn, gate, car porch and pool
        rect(g, X + 1, Y + 1, W - 2, H - 2, '#77b45e');
        for (let y = Y + 3; y < Y + H - 3; y += 6) rect(g, X + 1, y, W - 2, 3, '#6fab57');
        fence(g, X + 1, Y + H - 2, W - 2, '#f4f1e8');
        rect(g, X + 30, Y + H - 4, 14, 3, '#cfc6b0'); // gate
        const rc = [PAL.roof.blue, PAL.roof.red, PAL.roof.slate, PAL.roof.brown][b.id % 4];
        building(g, X + 6, Y + 6, 46, 36, { wall: PAL.white, roof: rc, roofType: 'hip', wallH: 14 });
        windows(g, X + 9, Y + 30, 20, 8, 2, 1, { col: PAL.glass, frame: '#ffffff' });
        door(g, X + 38, Y + 42, 7, 10, PAL.wood);
        rect(g, X + 20, Y + 44, 18, 13, '#d9d3c7'); car(g, X + 23, Y + 48, b.id % 2 ? '#14141a' : '#f1faee');
        rect(g, X + 57, Y + 32, 18, 24, '#ffffff'); rect(g, X + 59, Y + 34, 14, 20, '#4fc1e0'); rect(g, X + 60, Y + 35, 6, 1, '#a6e3f2');
        palm(g, X + 60, Y + 6);
        shrub(g, X + 4, Y + 46); shrub(g, X + 12, Y + 52, '#d65a8a');
        break;
      }
      case 'mamak': { // open-front restaurant with green-white awning and plastic tables outside
        const s = building(g, X + 2, Y + 2, W - 4, 32, { wall: PAL.cream, roof: '#2f7d4f', roofType: 'shed', wallH: 14 });
        awning(g, X + 2, s.wallY, W - 4, '#2f9e5b', '#ffffff');
        rect(g, X + 6, s.wallY + 6, W - 12, 7, '#5b4a3f'); addLight(X + 6, s.wallY + 6, W - 12, 7, 1, 'rgba(255,230,160,0.95)'); // open front (mamak never closes)
        for (let k = 0; k < 5; k++) {
          const tx = X + 8 + k * 14, ty = Y + 42 + (k % 2) * 8;
          rect(g, tx + 1, ty + 1, 8, 5, 'rgba(0,0,0,0.2)'); rect(g, tx, ty, 8, 5, '#e9ecef'); rect(g, tx, ty, 8, 1, '#ffffff');
          rect(g, tx - 3, ty + 1, 2, 3, '#e63946'); rect(g, tx + 9, ty + 1, 2, 3, '#e63946');
        }
        sign(g, (b.label || 'Mamak').toUpperCase(), X + W / 2, Y + 4, '#1f6b40');
        break;
      }
      case 'hawker': { // big open-sided food court roof over rows of stalls
        castShadow(g, X, Y, W, H - 4, 4);
        rect(g, X, Y + 14, W, H - 18, '#6b5a50');
        rect(g, X + 2, Y + 16, W - 4, H - 22, '#d8d0c0');
        for (let k = 0; k < 6; k++) { const sx = X + 4 + k * 18; rect(g, sx, Y + 16, 14, 7, SHOP_COLOURS[k % SHOP_COLOURS.length]); rect(g, sx, Y + 22, 14, 2, shade(SHOP_COLOURS[k % SHOP_COLOURS.length], 0.7)); }
        for (let k = 0; k < 8; k++) { const tx = X + 8 + (k % 4) * 26, ty = Y + 34 + Math.floor(k / 4) * 18; rect(g, tx, ty, 12, 6, '#f4f1e8'); rect(g, tx, ty + 6, 12, 1, '#a59f92'); }
        roof(g, X - 1, Y, W + 2, 15, '#c94c4c', 'gable');
        for (const px of [X + 1, X + W - 4]) rect(g, px, Y + 14, 3, H - 18, '#8a7a70');
        sign(g, 'HAWKER CENTRE', X + W / 2, Y + 2, '#7a1f1f');
        break;
      }
      case 'university': {
        rect(g, X, Y + 74, W, H - 74, '#7fbf5a');
        g.strokeStyle = '#c96a4a'; g.lineWidth = 3; g.strokeRect(X + 14, Y + 86, W - 28, H - 96);
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 1; g.strokeRect(X + 28, Y + 96, W - 56, H - 116);
        const s = building(g, X + 6, Y + 16, W - 12, 56, { wall: '#efe4cc', roof: PAL.roof.navy, roofType: 'hip', wallH: 26 });
        windows(g, X + 12, s.wallY + 4, W - 24, 18, 14, 1, { col: PAL.glass, frame: '#c8b893' });
        const c = building(g, X + W / 2 - 16, Y + 2, 32, 70, { wall: '#f4ead6', roof: '#1d3b57', roofType: 'hip', wallH: 40, noShadow: true });
        rect(g, X + W / 2 - 6, c.wallY + 4, 12, 12, '#ffffff'); rect(g, X + W / 2 - 1, c.wallY + 6, 2, 6, '#333'); rect(g, X + W / 2, c.wallY + 10, 4, 2, '#333'); // clock
        door(g, X + W / 2, Y + 72, 12, 14, '#5b4a3f');
        for (const tx of [10, W - 26]) rainTree(g, X + tx, Y + H - 30, 1, R);
        sign(g, 'UNIVERSITI REZEKI', X + W / 2, Y + 75, '#24476b');
        break;
      }
      case 'kolej': {
        const s = building(g, X + 2, Y + 4, W - 4, H - 10, { wall: '#efe3c9', roof: '#6f8f3a', roofType: 'gable', wallH: 34 });
        windows(g, X + 6, s.wallY + 4, W - 12, 22, 5, 2, { col: PAL.glass, frame: '#d9ccb0' });
        door(g, X + W / 2, Y + H - 6, 10, 9, PAL.wood);
        sign(g, 'KOLEJ VOKASIONAL', X + W / 2, Y + H - 12, '#4d6a26');
        break;
      }
      case 'library': {
        const s = building(g, X + 2, Y + 4, W - 4, H - 10, { wall: '#e9e1d0', roof: PAL.roof.brown, roofType: 'gable', wallH: 36 });
        for (let i = 0; i < 6; i++) { rect(g, X + 9 + i * 14, s.wallY + 2, 4, 32, '#f8f4ea'); rect(g, X + 9 + i * 14, s.wallY + 2, 1, 32, '#ffffff'); rect(g, X + 12 + i * 14, s.wallY + 2, 1, 32, '#cfc6b0'); }
        door(g, X + W / 2, Y + H - 6, 10, 12, PAL.woodDark);
        sign(g, 'LIBRARY', X + W / 2, Y + H - 12, '#6b4423');
        break;
      }
      case 'hall': { // Dewan Komuniti: big Minangkabau-style swept roof
        const s = building(g, X + 2, Y + 8, W - 4, H - 10, { wall: '#f0dcc0', roof: '#b5651d', roofType: 'gable', wallH: 30 });
        for (const ex of [X + 2, X + W - 8]) { rect(g, ex, Y + 2, 6, 8, '#b5651d'); rect(g, ex + (ex === X + 2 ? 0 : 4), Y, 2, 3, '#8e4d14'); }
        windows(g, X + 8, s.wallY + 6, W - 16, 12, 5, 1, { col: PAL.glass });
        door(g, X + W / 2, Y + H - 2, 12, 12, PAL.wood);
        sign(g, 'DEWAN', X + W / 2, Y + H - 14, '#7a3f12');
        break;
      }
      case 'office': case 'techhub': {
        const tech = b.kind === 'techhub';
        const s = building(g, X + 2, Y, W - 4, H - 4, { wall: tech ? '#2e5f8a' : '#6c8aa3', roof: tech ? '#1d3b57' : '#3e4e5c', wallH: H - 22, details: tech ? 'solar' : 'mixed', seed: b.id });
        windows(g, X + 5, s.wallY + 4, W - 10, s.wallH - 20, 4, 14, { col: tech ? '#7fd8f0' : '#a8c7dc', wide: 0.75, tall: 0.65 });
        if (tech) for (let yy = s.wallY + 10; yy < Y + H - 20; yy += 28) rect(g, X + 2, yy, W - 4, 2, '#3ec7b5');
        rect(g, X + W / 2 - 1, Y - 8, 2, 8, '#ccc');
        door(g, X + W / 2, Y + H - 4, 14, 11, '#203040');
        sign(g, tech ? 'TECH HUB' : 'MENARA', X + W / 2, Y + H + 1, tech ? '#13615a' : '#2b3a48');
        break;
      }
      case 'bank': { // neo-classical: pediment and columns
        const s = building(g, X + 2, Y + 4, W - 4, H - 6, { wall: '#ece7dc', roof: '#9aa0a6', roofType: 'hip', wallH: H - 22 });
        for (let i = 0; i < 4; i++) { const cx = X + 8 + i * ((W - 20) / 3); rect(g, cx, s.wallY + 3, 4, s.wallH - 6, '#ffffff'); rect(g, cx + 3, s.wallY + 3, 1, s.wallH - 6, '#cfc9bc'); }
        rect(g, X + 4, s.wallY, W - 8, 3, '#d8d2c4');
        door(g, X + W / 2, Y + H - 2, 8, 12, '#5b4a3f');
        sign(g, 'BANK', X + W / 2, Y + 2, '#8a6d1d', '#ffe9a8');
        break;
      }
      case 'bursa': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#24384c', roof: '#16222e', wallH: H - 18, details: 'ac', seed: b.id });
        rect(g, X + 8, s.wallY + 4, W - 16, 26, '#0e1620');
        g.strokeStyle = '#57d38c'; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= 10; i++) { const xx = X + 10 + i * (W - 20) / 10, yy = s.wallY + 24 - i * 1.4 - (i % 3) * 3; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
        g.stroke();
        door(g, X + W / 2, Y + H - 2, 14, 10, '#0e1620');
        sign(g, 'BURSA', X + W / 2, Y + 3, '#0e1620', '#57d38c');
        break;
      }
      case 'mall': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#ece3f6', roof: '#9b7fc4', wallH: H - 40, details: 'ac', seed: b.id });
        windows(g, X + 8, s.wallY + 6, W - 16, s.wallH - 44, 4, 3, { col: '#c9b8e8', frame: '#ffffff' });
        rect(g, X + 18, Y + H - 34, W - 36, 30, '#8fc1d8'); rect(g, X + 18, Y + H - 34, W - 36, 2, PAL.glassHi); rect(g, X + W / 2, Y + H - 34, 1, 30, '#5b7f94');
        awning(g, X + 14, Y + H - 38, W - 28, '#9b7fc4', '#ffffff');
        sign(g, 'REZEKI MALL', X + W / 2, Y + 4, '#5e3f8f');
        break;
      }
      case 'shoplot': { // two-storey shophouse; the business sign goes on the upper floor
        const col = SHOP_COLOURS[b.id % SHOP_COLOURS.length];
        castShadow(g, X, Y, W - 1, H, 3);
        roof(g, X, Y, W - 1, 7, PAL.roof.terracotta, 'gable');
        facade(g, X, Y + 6, W - 1, 22, col);
        for (const wx of [X + 6, X + 25, X + 44]) { rect(g, wx, Y + 10, 12, 9, '#ffffff'); rect(g, wx + 1, Y + 11, 10, 7, PAL.glass); rect(g, wx + 6, Y + 11, 1, 7, '#ffffff'); }
        addLight(X + 3, Y + 31, W - 7, 3, 0.5);
        rect(g, X, Y + 28, W - 1, H - 28, '#5b4a3f'); // five-foot way
        rect(g, X + 2, Y + 31, W - 5, H - 33, '#3a2f28');
        for (const px of [X, X + 21, X + 42, X + W - 3]) { rect(g, px, Y + 28, 2, H - 28, '#e2d9c9'); rect(g, px + 1, Y + 28, 1, H - 28, '#c9bfae'); }
        for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) rect(g, X + 4 + i * 21, Y + 33 + k * 3, 15, 1, '#6b5a4c'); // roller shutters
        break;
      }
      case 'hospital': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#f6f8f9', roof: '#2a9d8f', wallH: H - 34, details: 'helipad', seed: b.id });
        windows(g, X + 8, s.wallY + 4, W - 16, s.wallH - 28, 6, 4, { col: '#9fd3e0', frame: '#dfe7ea' });
        rect(g, X + W / 2 - 9, Y + H - 26, 18, 18, '#2a9d8f'); rect(g, X + W / 2 - 2, Y + H - 23, 4, 12, '#fff'); rect(g, X + W / 2 - 6, Y + H - 19, 12, 4, '#fff');
        rect(g, X + 6, Y + H - 14, 16, 9, '#ffffff'); rect(g, X + 6, Y + H - 10, 16, 2, '#e63946'); rect(g, X + 8, Y + H - 6, 3, 2, '#111'); rect(g, X + 17, Y + H - 6, 3, 2, '#111'); // ambulance
        sign(g, 'HOSPITAL', X + W / 2, Y + 1, '#1d6f66');
        break;
      }
      case 'school': {
        rect(g, X, Y + 50, W, H - 50, '#8bc34a');
        for (let y = Y + 52; y < Y + H; y += 8) rect(g, X, y, W, 4, '#83bb44');
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 1; g.strokeRect(X + 8.5, Y + 56.5, W - 17, H - 64);
        const s = building(g, X + 2, Y + 4, W - 4, 44, { wall: '#f2d16b', roof: '#3b6ea8', roofType: 'gable', wallH: 26 });
        windows(g, X + 6, s.wallY + 3, W - 12, 20, 6, 2, { col: PAL.glass, frame: '#e8c45a' });
        rect(g, X + W - 10, Y + 52, 1, 20, '#ddd'); // flag pole: Jalur Gemilang
        for (let k = 0; k < 4; k++) rect(g, X + W - 9, Y + 52 + k, 8, 1, k % 2 ? '#ffffff' : '#d62828');
        rect(g, X + W - 9, Y + 52, 4, 2, '#1d3557'); rect(g, X + W - 8, Y + 52, 1, 1, '#ffd166');
        sign(g, 'SEKOLAH', X + W / 2, Y + 4, '#2c5282');
        break;
      }
      case 'privschool': { // private school: brick-and-white blocks around a courtyard, a crest and a gate
        rect(g, X, Y + H - 12, W, 12, '#d9cfc0');
        const s = building(g, X + 2, Y + 2, W - 4, H - 16, { wall: '#f7f3ea', roof: '#8c2f39', roofType: 'hip', wallH: H - 40, seed: b.id });
        windows(g, X + 8, s.wallY + 4, W - 16, s.wallH - 12, 6, 3, { col: PAL.glass, frame: '#b5838d' });
        rect(g, X + W / 2 - 7, s.wallY + 2, 14, 12, '#1d3557'); rect(g, X + W / 2 - 5, s.wallY + 4, 10, 8, '#f2c14e'); rect(g, X + W / 2 - 1, s.wallY + 5, 2, 6, '#1d3557'); // crest
        for (const gx of [X + W / 2 - 14, X + W / 2 + 11]) rect(g, gx, Y + H - 14, 3, 12, '#6b4f3a');
        rect(g, X + W / 2 - 11, Y + H - 13, 22, 2, '#2b2d42');
        sign(g, (b.label || 'PRIVATE SCHOOL').toUpperCase().slice(0, 22), X + W / 2, Y + 1, '#1d3557', '#f2c14e');
        break;
      }
      case 'privhosp': { // private hospital: glass tower on a podium, a canopy drop-off
        rect(g, X, Y + H - 14, W, 14, '#cfd8dc');
        const s = building(g, X + 6, Y, W - 12, H - 16, { wall: '#e8f1f5', roof: '#457b9d', wallH: H - 42, details: 'helipad', seed: b.id });
        windows(g, X + 10, s.wallY + 4, W - 20, s.wallH - 10, 5, 8, { col: '#a8dadc', wide: 0.8 });
        rect(g, X + 8, Y + H - 20, W - 16, 4, '#ffffff'); rect(g, X + 8, Y + H - 16, W - 16, 1, '#90a4ae'); // canopy
        rect(g, X + W - 18, Y + 6, 10, 10, '#e63946'); rect(g, X + W - 14, Y + 7, 2, 8, '#fff'); rect(g, X + W - 17, Y + 10, 8, 2, '#fff');
        sign(g, (b.label || 'PRIVATE HOSPITAL').toUpperCase().slice(0, 22), X + W / 2, Y + H - 12, '#1d3557');
        break;
      }
      case 'factory': { // saw-tooth roof, chimneys at fixed spots (smoke is drawn there)
        castShadow(g, X + 2, Y + 4, W - 4, H - 6, 5);
        for (let i = 0; i < W - 4; i += 16) { roof(g, X + 2 + i, Y + 4, 16, 14, '#8a949c', 'shed'); rect(g, X + 2 + i, Y + 4, 2, 14, '#b9d3e0'); }
        facade(g, X + 2, Y + 18, W - 4, H - 24, '#a3acb5');
        for (const cx of [X + 20, X + 44]) { rect(g, cx + 2, Y - 8, 8, 24, 'rgba(0,0,0,0.2)'); rect(g, cx, Y - 10, 8, 26, '#6c757d'); rect(g, cx, Y - 4, 8, 3, '#d62828'); rect(g, cx, Y - 10, 8, 1, '#8a939b'); }
        windows(g, X + 8, Y + 26, W - 16, 22, 10, 1, { col: '#c3d7e0', wide: 0.7 });
        rect(g, X + W - 40, Y + H - 28, 30, 22, '#5d666f'); for (let i = 0; i < 6; i++) rect(g, X + W - 40, Y + H - 26 + i * 4, 30, 1, '#4a525a');
        for (let i = 0; i < 3; i++) { rect(g, X + 10 + i * 18, Y + H - 14, 14, 8, '#c08552'); rect(g, X + 10 + i * 18, Y + H - 14, 14, 1, '#d9a273'); } // crates
        sign(g, 'KILANG', X + W / 2, Y + H - 14, '#3d454d');
        break;
      }
      case 'workshop': {
        const s = building(g, X + 2, Y + 4, W - 4, H - 6, { wall: '#c9b49b', roof: PAL.roof.zinc, roofType: 'shed', wallH: 40 });
        for (const gx of [X + 8, X + 52]) { rect(g, gx, s.wallY + 6, 34, 32, '#6c757d'); for (let i = 0; i < 8; i++) rect(g, gx, s.wallY + 8 + i * 4, 34, 1, '#58606a'); }
        rect(g, X + 46, Y + H - 10, 4, 6, '#2b2d42'); // oil drum
        sign(g, 'BENGKEL', X + W / 2, Y + 8, '#5a4632');
        break;
      }
      case 'warehouse': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 6, { wall: '#b8c4cc', roof: '#7c8a94', roofType: 'shed', wallH: 36 });
        rect(g, X + 10, s.wallY + 4, 40, 30, '#7c8a94'); for (let i = 0; i < 7; i++) rect(g, X + 10, s.wallY + 6 + i * 4, 40, 1, '#6a7780');
        rect(g, X + 60, Y + 42, 28, 14, '#f4f1e8'); rect(g, X + 88, Y + 46, 10, 10, '#2a9d8f'); rect(g, X + 64, Y + 55, 5, 3, '#222'); rect(g, X + 88, Y + 55, 5, 3, '#222'); // lorry
        sign(g, 'GUDANG', X + W / 2, Y + 10, '#4a5861');
        break;
      }
      case 'construction': {
        rect(g, X, Y, W, H, '#c9ad7f');
        for (let i = 0; i < 40; i++) rect(g, X + R.int(0, W - 3), Y + R.int(0, H - 3), 3, 2, R.next() < 0.5 ? '#b39465' : '#d8bf92');
        castShadow(g, X + 40, Y + 6, 80, 50, 5);
        rect(g, X + 40, Y + 6, 80, 50, '#a7adb1');
        for (let i = 0; i < 5; i++) rect(g, X + 40 + i * 20, Y + 6, 3, 50, '#7a8086');
        for (let i = 0; i < 3; i++) rect(g, X + 40, Y + 6 + i * 20, 80, 3, '#7a8086');
        for (let i = 0; i < 6; i++) rect(g, X + 44 + i * 12, Y + 10, 1, 46, '#d9b44a'); // scaffold poles
        rect(g, X + 150, Y - 30, 5, 88, '#f4c430'); rect(g, X + 110, Y - 30, 100, 4, '#f4c430'); rect(g, X + 130, Y - 26, 1, 30, '#333'); rect(g, X + 126, Y + 4, 9, 6, PAL.woodLight);
        for (let i = 0; i < W; i += 10) rect(g, X + i, Y + H - 2, 6, 2, i % 20 ? '#f4c430' : '#222'); // hoarding
        sign(g, 'TAPAK BINAAN', X + 30, Y + H - 14, '#7a5a1d');
        break;
      }
      case 'lake': { // an irregular lake with a sandy shore, reeds, a jetty and a boat
        rect(g, X, Y, W, H, '#7fbf5a');
        for (let i = 0; i < 40; i++) rect(g, X + R.int(0, W - 4), Y + R.int(0, H - 3), 4, 2, '#77b553');
        const cx = X + W / 2, cy = Y + H / 2 + 4, rx = W / 2 - 18, ry = H / 2 - 20;
        g.fillStyle = PAL.sand; g.beginPath(); g.ellipse(cx, cy, rx + 6, ry + 6, 0.1, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3f8fb5'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0.1, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4fa3c7'; g.beginPath(); g.ellipse(cx - 6, cy - 4, rx - 14, ry - 12, 0.1, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 14; i++) rect(g, cx - rx / 2 + R.int(0, rx), cy - ry / 2 + R.int(0, ry), R.int(5, 10), 1, '#8fd0ea');
        for (let i = 0; i < 18; i++) { const a = R.range(0, Math.PI * 2), x = cx + Math.cos(a) * (rx + 3), y = cy + Math.sin(a) * (ry + 3); rect(g, x, y - 4, 1, 5, '#4f8a3a'); rect(g, x + 2, y - 3, 1, 4, '#5f9f45'); }
        rect(g, cx + rx - 30, cy - 2, 26, 4, PAL.woodLight); for (const px of [cx + rx - 28, cx + rx - 18, cx + rx - 8]) rect(g, px, cy + 2, 2, 3, PAL.woodDark); // jetty
        rect(g, cx - 20, cy + 8, 14, 4, '#e76f51'); rect(g, cx - 18, cy + 6, 10, 2, '#f4f1e8'); // a boat
        for (const [tx, ty] of [[X + 10, Y + 8], [X + W - 30, Y + 10], [X + 14, Y + H - 34], [X + W - 26, Y + H - 30]]) rainTree(g, tx, ty, 0.8, R);
        sign(g, (b.label || 'TASIK').toUpperCase(), X + W / 2, Y + H - 14, '#1d6f8a');
        break;
      }
      case 'hill': { // a forested hill: shaded slopes, rocks, a winding trail and a viewpoint hut
        rect(g, X, Y, W, H, '#6fa34b');
        const cx = X + W / 2, cy = Y + H / 2 + 10;
        for (const [r, col] of [[96, '#5f9440'], [74, '#558a3a'], [52, '#4c7f34'], [30, '#43742e']]) { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(cx + 20, cy + 12, 70, 40, 0, 0, Math.PI); g.fill(); // shade on the south slope
        g.strokeStyle = '#c9a66b'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 80, Y + H - 4); g.bezierCurveTo(cx - 40, cy + 30, cx + 50, cy + 10, cx, cy - 10); g.stroke(); // the trail
        for (let i = 0; i < 16; i++) { const a = R.range(0, Math.PI * 2), d = R.range(25, 85); rainTree(g, cx + Math.cos(a) * d - 8, cy + Math.sin(a) * d * 0.6 - 16, 0.55, R); }
        for (let i = 0; i < 6; i++) rect(g, cx + R.int(-60, 60), cy + R.int(-30, 30), R.int(4, 7), 3, '#9aa0a6');
        rect(g, cx - 8, cy - 22, 16, 8, PAL.woodLight); rect(g, cx - 10, cy - 26, 20, 4, '#8c2f39'); // viewpoint hut
        sign(g, (b.label || 'BUKIT').toUpperCase(), X + W / 2, Y + H - 14, '#2d6a4f');
        break;
      }
      case 'forest': { // dense forest reserve with a waterfall into a rock pool
        rect(g, X, Y, W, H, '#3f7a35');
        for (let i = 0; i < 26; i++) rainTree(g, X + R.int(-4, W - 24), Y + R.int(-6, H - 30), R.range(0.6, 1), R);
        const fx = X + W / 2 - 8;
        rect(g, fx - 10, Y + 20, 36, 40, '#8a8f96'); rect(g, fx - 6, Y + 24, 28, 34, '#9aa0a6'); // cliff
        rect(g, fx + 2, Y + 24, 10, 40, '#bfe6f5'); for (let y = Y + 26; y < Y + 62; y += 4) rect(g, fx + 3 + (y % 8 ? 0 : 4), y, 3, 2, '#ffffff'); // falling water
        g.fillStyle = '#4fa3c7'; g.beginPath(); g.ellipse(fx + 7, Y + 70, 26, 10, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#8fd0ea'; g.beginPath(); g.ellipse(fx + 4, Y + 68, 12, 4, 0, 0, Math.PI * 2); g.fill();
        sign(g, (b.label || 'HUTAN SIMPAN').toUpperCase(), X + W / 2, Y + H - 14, '#1f4d2b');
        break;
      }
      case 'park': {
        rect(g, X, Y, W, H, '#93c96b');
        g.fillStyle = '#8bc263'; for (let i = 0; i < 30; i++) g.fillRect(X + R.int(0, W - 4), Y + R.int(0, H - 3), 4, 2);
        g.strokeStyle = '#e2cf9f'; g.lineWidth = 5; g.beginPath(); g.ellipse(X + W / 2, Y + H / 2 + 10, Math.max(1, W / 2 - 8), Math.max(1, H / 2 - 32), 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#3f8fb5'; g.beginPath(); g.ellipse(X + W / 2, Y + H / 2 + 10, Math.max(1, W / 2 - 16), Math.max(1, H / 2 - 42), 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4fa3c7'; g.beginPath(); g.ellipse(X + W / 2, Y + H / 2 + 8, Math.max(1, W / 2 - 18), Math.max(1, H / 2 - 45), 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7cc3e0'; g.beginPath(); g.ellipse(X + W / 2 - 8, Y + H / 2 + 2, 14, 6, 0, 0, Math.PI * 2); g.fill();
        rect(g, X + W / 2 - 1, Y + H / 2 + 6, 2, 6, '#e2cf9f'); // fountain
        for (const [tx, ty] of [[4, 6], [W - 20, 10], [6, H - 30], [W - 22, H - 28], [W / 2 - 7, 2]]) rainTree(g, X + tx, Y + ty, 1, R);
        for (const [bx, by] of [[20, H - 40], [W - 36, 40]]) { rect(g, X + bx, Y + by, 10, 2, PAL.wood); rect(g, X + bx, Y + by + 2, 1, 2, PAL.woodDark); rect(g, X + bx + 9, Y + by + 2, 1, 2, PAL.woodDark); }
        sign(g, b.label === 'Garden' ? 'TAMAN' : 'TAMAN TASIK', X + W / 2, Y + H - 14, '#2d6a4f');
        break;
      }
      case 'gym': { // stadium: running track around a pitch, small stand
        rect(g, X + 2, Y + 2, W - 4, H - 4, '#c0573e');
        for (let i = 6; i < W / 2; i += 4) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(X + i - 2.5, Y + i - 2.5, W - 2 * i + 5, H - 2 * i + 5); }
        rect(g, X + 12, Y + 12, W - 24, H - 24, '#6fb35a');
        for (let y = Y + 12; y < Y + H - 12; y += 6) rect(g, X + 12, y, W - 24, 3, '#67aa52');
        g.strokeStyle = '#f4f1e8'; g.strokeRect(X + 14.5, Y + 14.5, W - 29, H - 29);
        rect(g, X + 2, Y + 2, W - 4, 6, '#8d99ae'); for (let x = X + 4; x < X + W - 4; x += 3) rect(g, x, Y + 3, 2, 1, R.pick(C.SHIRTS));
        sign(g, 'STADIUM', X + W / 2, Y + H / 2 - 5, '#7a2e1e');
        break;
      }
      case 'welfare': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 6, { wall: '#f0e6d2', roof: '#9c6644', roofType: 'gable', wallH: 22 });
        windows(g, X + 24, s.wallY + 4, W - 34, 12, 4, 1, { col: PAL.glass });
        rect(g, X + 10, s.wallY + 5, 7, 7, '#ffffff'); rect(g, X + 12, s.wallY + 6, 3, 5, '#e63946'); rect(g, X + 11, s.wallY + 7, 5, 3, '#e63946');
        sign(g, 'RUMAH KEBAJIKAN', X + W / 2, Y + H - 4, '#6b3f22');
        break;
      }
      case 'padi': {
        for (let r = 0; r < H; r += 4) rect(g, X, Y + r, W, 4, r % 8 ? '#a6d36b' : '#8cc152');
        for (let r = 0; r < H; r += 4) for (let c = (r / 4) % 2 * 3; c < W; c += 6) rect(g, X + c, Y + r + 1, 1, 2, '#6fa33a');
        for (let c = 0; c < W; c += 48) { rect(g, X + c, Y, 3, H, '#6fb0c9'); rect(g, X + c, Y, 1, H, '#9fd0e0'); }
        for (const sx of [30, 130]) { rect(g, X + sx, Y + 20, 1, 14, PAL.wood); rect(g, X + sx - 4, Y + 22, 9, 1, PAL.wood); rect(g, X + sx - 2, Y + 18, 5, 3, '#c9a46b'); } // scarecrows
        sign(g, 'SAWAH PADI', X + W / 2, Y + H / 2 - 5, '#4a6a1f');
        break;
      }
      case 'depot': {
        const s = building(g, X + 2, Y + 4, W - 4, H - 6, { wall: '#d6d0c4', roof: PAL.roof.slate, roofType: 'shed', wallH: 36 });
        for (let i = 0; i < 3; i++) { rect(g, X + 8 + i * 28, s.wallY + 4, 22, 30, '#6c757d'); rect(g, X + 10 + i * 28, s.wallY + 20, 18, 12, '#e9c46a'); }
        sign(g, 'DEPOT BAS', X + W / 2, Y + 8, '#3d5a80');
        break;
      }
      case 'memorial': { // Taman Kenangan: garden of remembrance (lanterns are drawn live)
        rect(g, X, Y, W, H, '#7fb069');
        g.strokeStyle = '#e2cf9f'; g.lineWidth = 3; g.strokeRect(X + 8.5, Y + 8.5, W - 17, H - 17);
        castShadow(g, X + W / 2 - 8, Y + H / 2 - 16, 16, 26, 3);
        rect(g, X + W / 2 - 8, Y + H / 2 - 10, 16, 20, '#cfc6b0'); rect(g, X + W / 2 - 5, Y + H / 2 - 16, 10, 6, '#b8ad95'); rect(g, X + W / 2 - 8, Y + H / 2 - 10, 16, 1, '#e8e1d0');
        for (const [tx, ty] of [[2, 2], [W - 18, 4], [4, H - 26], [W - 20, H - 24]]) rainTree(g, X + tx, Y + ty, 0.9, R);
        sign(g, 'TAMAN KENANGAN', X + W / 2, Y + H - 14, '#4a5a3a');
        break;
      }
      case 'lot': {
        if (b.built) break;
        if (b.block && b.block.wild) { wildLot(g, b, X, Y, W, H, R); break; }
        rect(g, X + 6, Y + 6, W - 12, H - 12, '#9cc06f');
        for (let i = 0; i < 40; i++) rect(g, X + 8 + R.int(0, W - 18), Y + 8 + R.int(0, H - 18), 2, 2, R.next() < 0.5 ? '#8fb463' : '#b0cd84');
        g.strokeStyle = '#8b6b43'; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(X + 6.5, Y + 6.5, W - 13, H - 13); g.setLineDash([]);
        rect(g, X + W / 2 - 1, Y + H / 2 - 4, 2, 14, '#6b4423');
        sign(g, 'TANAH DIJUAL', X + W / 2, Y + H / 2 - 12, '#7a5a1d');
        break;
      }
      case 'builtlot': break;
      case 'hq': {
        rect(g, X - 8, Y + H - 20, W + 16, 20, '#d9cfc0');
        const s = building(g, X + 2, Y, W - 4, H - 22, { wall: '#c9a227', roof: '#7a5c12', wallH: H - 44, details: 'helipad', seed: b.id });
        windows(g, X + 6, s.wallY + 4, W - 12, s.wallH - 14, 5, 12, { col: '#fff3c4', wide: 0.7 });
        rect(g, X + W / 2 - 1, Y - 14, 2, 14, '#ccc'); rect(g, X + W / 2 - 3, Y - 16, 6, 3, '#e63946');
        sign(g, (b.label || 'MENARA').toUpperCase(), X + W / 2, Y + H - 16, '#3d2b05', '#ffe9a8');
        break;
      }
      // ---- Places of worship ----
      case 'masjid': { // courtyard, prayer hall with a dome, a minaret
        rect(g, X + 2, Y + 2, W - 4, H - 4, '#e8e1d0');
        g.fillStyle = tiledPattern(g, '#efe9db', '#ddd4bf', 8, false); g.fillRect(X + 4, Y + 70, W - 8, H - 74);
        rect(g, X + 2, Y + 2, W - 4, 2, '#cfc6b0'); rect(g, X + 2, Y + H - 4, W - 4, 2, '#cfc6b0');
        const s = building(g, X + 12, Y + 26, W - 30, 46, { wall: '#f7f4ec', roof: '#e8e4da', wallH: 24 });
        for (let i = 0; i < 4; i++) { const ax = X + 18 + i * 16; rect(g, ax, s.wallY + 6, 8, 16, '#2a9d8f'); g.fillStyle = '#2a9d8f'; g.beginPath(); g.arc(ax + 4, s.wallY + 6, 4, Math.PI, 0); g.fill(); addLight(ax + 1, s.wallY + 7, 6, 14, 0.9, 'rgba(255,230,160,0.95)'); }
        const cx = X + 12 + (W - 30) / 2, cy = Y + 30;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 3, cy + 6, 20, 8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1f7a6d'; g.beginPath(); g.arc(cx, cy + 4, 20, Math.PI, 0); g.fill(); // the dome
        g.fillStyle = '#2fa58f'; g.beginPath(); g.arc(cx - 5, cy - 2, 9, Math.PI, 0); g.fill();
        rect(g, cx - 20, cy + 3, 40, 3, '#1a5f56'); rect(g, cx - 1, cy - 22, 2, 6, '#f2c14e'); rect(g, cx - 3, cy - 24, 6, 2, '#f2c14e');
        const mx = X + W - 14; // minaret
        rect(g, mx + 2, Y + 10, 8, 66, 'rgba(0,0,0,0.2)'); rect(g, mx, Y + 8, 8, 66, '#f7f4ec'); rect(g, mx + 6, Y + 8, 2, 66, '#d9d3c7');
        rect(g, mx - 2, Y + 24, 12, 3, '#2a9d8f'); rect(g, mx - 2, Y + 50, 12, 3, '#2a9d8f');
        g.fillStyle = '#1f7a6d'; g.beginPath(); g.moveTo(mx - 1, Y + 9); g.lineTo(mx + 4, Y - 4); g.lineTo(mx + 9, Y + 9); g.fill();
        rect(g, mx + 3, Y - 8, 2, 5, '#f2c14e');
        palm(g, X + 4, Y + 80); palm(g, X + W - 22, Y + 92);
        sign(g, (b.label || 'MASJID').toUpperCase(), X + W / 2 - 6, Y + H - 14, '#1f6b40', '#f2e8cf');
        break;
      }
      case 'tokong': { // Chinese temple: red pillars, curved roof with upswept ends, lanterns, incense urn
        castShadow(g, X + 4, Y + 6, W - 8, H - 10, 3);
        facade(g, X + 6, Y + 24, W - 12, H - 30, '#c1121f');
        for (const px of [X + 10, X + W - 14]) rect(g, px, Y + 24, 4, H - 30, '#8d0801');
        door(g, X + W / 2, Y + H - 6, 14, 16, '#3d0c0c'); rect(g, X + W / 2 - 7, Y + H - 22, 14, 2, '#f2c14e');
        roof(g, X + 2, Y + 6, W - 4, 19, '#c94c2c', 'gable');
        rect(g, X + 2, Y + 6, W - 4, 2, '#f2c14e');
        for (const ex of [X - 2, X + W - 4]) { rect(g, ex, Y + 2, 6, 4, '#c94c2c'); rect(g, ex + (ex < X ? 0 : 4), Y, 2, 3, '#f2c14e'); } // upswept eaves
        rect(g, X + W / 2 - 6, Y + 3, 12, 3, '#2a9d8f'); // ridge ornament
        for (const lx of [X + 16, X + W - 20]) { rect(g, lx, Y + 27, 5, 6, '#e63946'); rect(g, lx + 2, Y + 33, 1, 2, '#f2c14e'); addLight(lx, Y + 27, 5, 6, 1, 'rgba(255,80,60,1)'); }
        rect(g, X + W / 2 - 4, Y + H + 1, 8, 4, '#8a6a43'); rect(g, X + W / 2 - 1, Y + H - 3, 1, 4, '#bbb'); // incense urn
        sign(g, 'TOKONG', X + W / 2, Y + 14, '#7a1f1f', '#ffd166');
        break;
      }
      case 'kuil': { // Hindu temple: a colourful stepped gopuram tower beside the hall
        castShadow(g, X + 2, Y + 8, W - 6, H - 10, 3);
        const hs = building(g, X + 30, Y + 22, W - 32, H - 24, { wall: '#f4e3c3', roof: '#e9c46a', wallH: 22, noShadow: true });
        windows(g, X + 34, hs.wallY + 4, W - 40, 10, 2, 1, { col: '#ffb703', lit: 1, night: 'rgba(255,190,60,1)' });
        const tiers = ['#e76f51', '#f4a261', '#2a9d8f', '#e9c46a', '#e63946'];
        for (let i = 0; i < 5; i++) { const tw = 26 - i * 4, ty = Y + H - 6 - (i + 1) * 11; rect(g, X + 4 + i * 2, ty, tw, 11, tiers[i]); rect(g, X + 4 + i * 2, ty, tw, 2, shade(tiers[i], 1.25)); for (let k = 0; k < tw; k += 4) rect(g, X + 5 + i * 2 + k, ty + 5, 2, 3, shade(tiers[i], 0.7)); }
        rect(g, X + 14, Y + H - 6 - 60, 6, 5, '#f2c14e');
        door(g, X + 17, Y + H - 4, 8, 10, '#5c3b20');
        sign(g, 'KUIL', X + W - 22, Y + H - 13, '#9c4221', '#ffe9a8');
        break;
      }
      case 'gereja': { // church: white walls, pitched roof, steeple with a cross
        const s = building(g, X + 4, Y + 10, W - 20, H - 12, { wall: '#f7f4ec', roof: '#55606b', roofType: 'gable', wallH: 16 });
        windows(g, X + 8, s.wallY + 3, W - 28, 10, 3, 1, { col: '#8ecae6', lit: 0.8, night: 'rgba(255,220,150,0.95)' });
        const tx = X + W - 18;
        rect(g, tx + 2, Y + 2, 12, H - 2, 'rgba(0,0,0,0.2)'); rect(g, tx, Y + 4, 12, H - 6, '#f7f4ec'); rect(g, tx + 9, Y + 4, 3, H - 6, '#d9d3c7');
        g.fillStyle = '#55606b'; g.beginPath(); g.moveTo(tx - 1, Y + 5); g.lineTo(tx + 6, Y - 8); g.lineTo(tx + 13, Y + 5); g.fill();
        rect(g, tx + 5, Y - 16, 2, 9, '#e8e4da'); rect(g, tx + 3, Y - 13, 6, 2, '#e8e4da'); // cross
        door(g, tx + 6, Y + H - 2, 6, 9, PAL.wood);
        break;
      }
      // ---- Justice ----
      case 'police': { // blue-and-white Balai Polis with a patrol car out front
        const s = building(g, X + 2, Y + 2, W - 4, H - 6, { wall: '#f4f6f8', roof: '#1d3557', wallH: 26, details: 'ac', seed: b.id });
        rect(g, X + 2, s.wallY + 2, W - 4, 3, '#1d3557');
        windows(g, X + 8, s.wallY + 8, W - 16, 10, 4, 1, { col: PAL.glass, lit: 1, night: 'rgba(200,230,255,0.95)' });
        door(g, X + W / 2, Y + H - 4, 10, 10, '#1d3557');
        rect(g, X + W - 26, Y + H - 12, 16, 8, '#f4f6f8'); rect(g, X + W - 26, Y + H - 9, 16, 2, '#1d3557'); rect(g, X + W - 20, Y + H - 14, 4, 2, '#e63946'); rect(g, X + W - 16, Y + H - 14, 2, 2, '#3a86ff');
        sign(g, 'POLIS', X + W / 2, Y + 4, '#1d3557', '#f2e8cf');
        break;
      }
      case 'jail': { // police lock-up: barred windows
        const s = building(g, X + 2, Y + 4, W - 4, H - 8, { wall: '#c9ced3', roof: '#1d3557', wallH: 26 });
        for (let i = 0; i < 3; i++) { const wx = X + 6 + i * 12; rect(g, wx, s.wallY + 6, 8, 8, '#2b2d42'); for (let k = 1; k < 8; k += 2) rect(g, wx + k, s.wallY + 6, 1, 8, '#9aa0a6'); }
        door(g, X + W / 2, Y + H - 4, 8, 10, '#3d405b');
        sign(g, 'LOKAP', X + W / 2, Y + 2, '#2b2d42', '#f2e8cf');
        break;
      }
      case 'townhall': { // Dewan Bandaraya: white colonial-style hall with a clock tower and flags
        rect(g, X, Y + H - 26, W, 26, '#e8e1d0');
        const s = building(g, X + 6, Y + 18, W - 12, 80, { wall: '#f7f4ec', roof: '#b5483a', roofType: 'hip', wallH: 36 });
        windows(g, X + 12, s.wallY + 6, W - 24, 24, 7, 2, { col: PAL.glass, frame: '#e8e1d0', lit: 0.8 });
        for (let i = 0; i < 6; i++) rect(g, X + 16 + i * 18, s.wallY + 2, 3, s.wallH - 4, '#ffffff');
        const tx = X + W / 2 - 10;
        rect(g, tx + 3, Y + 2, 20, 30, 'rgba(0,0,0,0.2)'); rect(g, tx, Y, 20, 30, '#f7f4ec'); rect(g, tx + 16, Y, 4, 30, '#d9d3c7');
        g.fillStyle = '#b5483a'; g.beginPath(); g.moveTo(tx - 2, Y + 1); g.lineTo(tx + 10, Y - 12); g.lineTo(tx + 22, Y + 1); g.fill();
        rect(g, tx + 4, Y + 8, 12, 12, '#ffffff'); rect(g, tx + 9, Y + 10, 2, 6, '#333'); rect(g, tx + 10, Y + 14, 4, 2, '#333');
        door(g, X + W / 2, Y + 98, 16, 18, PAL.woodDark);
        for (const fx of [X + 8, X + W - 18]) { rect(g, fx, Y + H - 40, 1, 22, '#ddd'); for (let k = 0; k < 4; k++) rect(g, fx + 1, Y + H - 40 + k, 9, 1, k % 2 ? '#ffffff' : '#d62828'); rect(g, fx + 1, Y + H - 40, 4, 2, '#1d3557'); }
        sign(g, 'DEWAN BANDARAYA', X + W / 2, Y + H - 14, '#7a2632', '#f2e8cf');
        break;
      }
      case 'padang': {
        rect(g, X, Y, W, H, '#7fbf5a'); for (let y = Y; y < Y + H; y += 8) rect(g, X, y, W, 4, '#77b553');
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 1; g.strokeRect(X + 4.5, Y + 6.5, W - 9, H - 13);
        rect(g, X + W / 2 - 10, Y + 8, 20, 8, '#cfc6b0'); rect(g, X + W / 2 - 10, Y + 8, 20, 2, '#e8e1d0'); // the stage
        if (b.label !== 'Field') sign(g, 'PADANG', X + W / 2, Y + H - 14, '#2d6a4f');
        else { rect(g, X + 8, Y + H / 2 - 1, W - 16, 1, '#f4f1e8'); for (const gx of [X + 6, X + W - 9]) rect(g, gx, Y + H / 2 - 5, 3, 10, '#ffffff'); } // a school sports field
        break;
      }
      case 'court': { // court with columns and a dome-capped clock tower
        const s = building(g, X + 2, Y + 4, W - 4, H - 8, { wall: '#eee6d6', roof: '#7a2632', roofType: 'hip', wallH: 26 });
        for (let i = 0; i < 6; i++) { const cx = X + 8 + i * ((W - 20) / 5); rect(g, cx, s.wallY + 3, 3, s.wallH - 6, '#ffffff'); rect(g, cx + 2, s.wallY + 3, 1, s.wallH - 6, '#cfc6b0'); }
        door(g, X + W / 2, Y + H - 4, 10, 13, '#5c3b20');
        g.fillStyle = '#c9a227'; g.beginPath(); g.arc(X + W / 2, Y + 6, 7, Math.PI, 0); g.fill();
        sign(g, 'MAHKAMAH', X + W / 2, Y + H - 3, '#3d0c15', '#f2c14e');
        break;
      }
      case 'prison': { // high walls, watchtowers, cell blocks and an exercise yard
        rect(g, X + 4, Y + 4, W - 4, H - 4, 'rgba(0,0,0,0.25)');
        rect(g, X, Y, W - 2, H - 2, '#8a8f96'); rect(g, X + 4, Y + 4, W - 10, H - 10, '#b8b3a6');
        rect(g, X, Y, W - 2, 2, '#a3a8ae');
        for (const [bx, by] of [[10, 10], [10, 44]]) { building(g, X + bx, Y + by, 58, 26, { wall: '#d6d0c4', roof: '#6c757d', wallH: 12, noShadow: true }); windows(g, X + bx + 3, Y + by + 16, 52, 6, 10, 1, { col: '#3a3d44', wide: 0.4, lit: 0.5, night: 'rgba(255,220,140,0.8)' }); }
        rect(g, X + 76, Y + 12, 54, 58, '#c9b48a'); g.strokeStyle = '#f4f1e8'; g.lineWidth = 1; g.strokeRect(X + 80.5, Y + 16.5, 46, 50); // yard
        for (const [tx, ty] of [[-3, -3], [W - 9, -3], [-3, H - 9], [W - 9, H - 9]]) { rect(g, X + tx, Y + ty, 10, 10, '#5d666f'); rect(g, X + tx + 2, Y + ty + 2, 6, 3, '#2b2d42'); }
        for (let x = X + 2; x < X + W - 4; x += 4) rect(g, x, Y - 2, 2, 2, '#c0c0c0'); // razor wire
        sign(g, 'PENJARA', X + W / 2 - 20, Y + H - 14, '#2b2d42', '#f2e8cf');
        break;
      }
      case 'rehab': {
        rect(g, X + 2, Y + 2, W - 4, H - 4, '#9cc06f');
        const s = building(g, X + 4, Y + 8, W - 8, 46, { wall: '#eef6e2', roof: '#52796f', roofType: 'gable', wallH: 22 });
        windows(g, X + 8, s.wallY + 4, W - 16, 12, 2, 1, { col: PAL.glass });
        door(g, X + W / 2, Y + 54, 8, 9, PAL.wood);
        garden(g, X + 6, Y + 60, W - 12, H - 70, R);
        sign(g, 'PEMULIHAN', X + W / 2, Y + 2, '#2f3e46', '#e9f5db');
        break;
      }
      // ---- Leisure venues ----
      case 'cinema': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#2b2d42', roof: '#14213d', wallH: H - 20 });
        rect(g, X + 8, s.wallY + 4, W - 16, 22, '#f2c14e'); rect(g, X + 10, s.wallY + 6, W - 20, 18, '#1b1b1b'); addLight(X + 8, s.wallY + 4, W - 16, 2, 1, 'rgba(255,220,120,1)');
        for (let i = 0; i < 6; i++) rect(g, X + 12 + i * 12, s.wallY + 10 + (i % 2) * 6, 6, 4, ['#e63946', '#3ec7b5', '#f4a261'][i % 3]);
        for (let i = 0; i < W - 8; i += 6) rect(g, X + 4 + i, s.wallY + 1, 3, 2, (i / 6) % 2 ? '#ffd166' : '#fff3c4');
        door(g, X + W / 2, Y + H - 2, 12, 10, '#8d0801');
        sign(g, 'PAWAGAM', X + W / 2, Y + 1, '#8d0801', '#ffe9a8');
        break;
      }
      case 'karaoke': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#3a0ca3', roof: '#240046', wallH: H - 18 });
        windows(g, X + 6, s.wallY + 6, W - 12, 18, 4, 1, { col: '#f72585', wide: 0.7, lit: 1, night: 'rgba(255,70,190,1)' });
        door(g, X + W / 2, Y + H - 2, 10, 10, '#10002b');
        sign(g, 'KARAOKE & BAR', X + W / 2, Y + 1, '#7209b7', '#ffe9ff');
        break;
      }
      case 'bowling': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#e9ecef', roof: '#457b9d', wallH: H - 18 });
        for (let i = 0; i < 5; i++) { rect(g, X + 10 + i * 16, s.wallY + 6, 4, 10, '#ffffff'); rect(g, X + 10 + i * 16, s.wallY + 9, 4, 1, '#e63946'); }
        g.fillStyle = '#e63946'; g.beginPath(); g.arc(X + W - 14, Y + H - 14, 5, 0, Math.PI * 2); g.fill();
        sign(g, 'BOWLING', X + W / 2, Y + 1, '#1d3557');
        break;
      }
      case 'futsal': {
        castShadow(g, X + 2, Y + 2, W - 4, H - 4, 3);
        rect(g, X + 2, Y + 2, W - 4, H - 4, '#2d6a4f'); rect(g, X + 5, Y + 5, W - 10, H - 10, '#52b788');
        for (let x = X + 5; x < X + W - 5; x += 8) rect(g, x, Y + 5, 4, H - 10, '#4aab7e');
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 1; g.strokeRect(X + 5.5, Y + 5.5, W - 11, H - 11);
        rect(g, X + W / 2, Y + 5, 1, H - 10, '#f4f1e8');
        rect(g, X + 5, Y + H / 2 - 6, 4, 12, '#ffffff'); rect(g, X + W - 9, Y + H / 2 - 6, 4, 12, '#ffffff');
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.strokeRect(X + 2.5, Y + 2.5, W - 5, H - 5); // netting
        sign(g, 'FUTSAL', X + W / 2, Y + H - 13, '#1b4332');
        break;
      }
      case 'finedine': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#f8f1e7', roof: '#6b2737', roofType: 'hip', wallH: H - 22 });
        awning(g, X + 4, s.wallY, W - 8, '#a4133c', '#f8f1e7');
        windows(g, X + 6, s.wallY + 8, W - 12, 14, 4, 1, { col: '#ffe8a3', frame: '#c9a227', lit: 1 });
        door(g, X + W / 2, Y + H - 2, 8, 11, '#6b2737');
        sign(g, 'RESTORAN MEWAH', X + W / 2, Y + 1, '#3d0c15', '#f2c14e');
        break;
      }
      case 'lounge': {
        const s = building(g, X + 2, Y, W - 4, H - 2, { wall: '#1d3557', roof: '#0b132b', wallH: H - 20, details: 'pool', seed: b.id });
        windows(g, X + 5, s.wallY + 4, W - 10, s.wallH - 20, 3, 12, { col: '#a8dadc', wide: 0.75, lit: 0.85, night: 'rgba(170,220,255,0.95)' });
        rect(g, X, Y - 4, W, 6, '#f2c14e'); rect(g, X + 4, Y - 8, W - 8, 4, '#e9c46a');
        sign(g, 'SKY LOUNGE', X + W / 2, Y + H + 1, '#0b132b', '#f2c14e');
        break;
      }
      case 'spa': {
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#eef6e2', roof: '#52796f', roofType: 'hip', wallH: H - 22 });
        rect(g, X + W - 28, s.wallY + 4, 20, 14, '#ffffff'); rect(g, X + W - 26, s.wallY + 6, 16, 10, '#8ecae6');
        palm(g, X + 6, Y + 18);
        sign(g, 'SPA', X + W / 2, Y + 1, '#2f3e46', '#e9f5db');
        break;
      }
      case 'golf': {
        rect(g, X, Y, W, H, '#5a9e47');
        for (let i = 0; i < 260; i++) rect(g, X + R.int(0, W - 2), Y + R.int(0, H - 2), 2, 1, R.next() < 0.5 ? '#4f8f3e' : '#6db356');
        const fair = [[30, 40, 60, 30], [120, 60, 70, 34], [70, 120, 80, 30]];
        for (const [fx, fy, fw, fh] of fair) { g.fillStyle = '#8fd16a'; g.beginPath(); g.ellipse(X + fx, Y + fy, fw / 2, fh / 2, 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9ad874'; g.beginPath(); g.ellipse(X + fx - 4, Y + fy - 3, fw / 3, fh / 3, 0.3, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#e9d8a6'; g.beginPath(); g.ellipse(X + 160, Y + 120, 16, 9, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4fa3c7'; g.beginPath(); g.ellipse(X + 40, Y + 120, 20, 12, 0, 0, Math.PI * 2); g.fill();
        for (const [hx, hy] of [[44, 40], [140, 60], [86, 122]]) { rect(g, X + hx, Y + hy - 14, 1, 14, '#f4f1e8'); rect(g, X + hx + 1, Y + hy - 14, 6, 4, '#e63946'); rect(g, X + hx - 1, Y + hy, 3, 2, '#1b1b1b'); }
        const s = building(g, X + W - 72, Y + 6, 62, 38, { wall: '#fbf7ef', roof: '#7a1f1f', roofType: 'hip', wallH: 16 });
        windows(g, X + W - 68, s.wallY + 3, 54, 10, 5, 1, { col: PAL.glass });
        for (const [tx, ty] of [[6, 4], [100, 6], [8, 70], [200, 90], [180, 150]]) if (tx < W - 16 && ty < H - 18) rainTree(g, X + tx, Y + ty, 1, R);
        sign(g, 'KELAB GOLF', X + W - 40, Y + 2, '#3d0c15', '#f2c14e');
        break;
      }
      case 'station': {
        rect(g, X - 2, Y - 10, W + 4, 10, '#b8ad95'); // platform
        for (let i = 0; i < W; i += 12) rect(g, X + i, Y - 9, 6, 1, '#f4f1e8');
        rect(g, X - 2, Y - 2, W + 4, 2, '#f2c14e'); // platform edge line
        const s = building(g, X + 2, Y + 2, W - 4, H - 4, { wall: '#f2e8cf', roof: '#bc4749', roofType: 'hip', wallH: H - 26 });
        for (let i = 0; i < 3; i++) rect(g, X + 12 + i * 40, s.wallY + 4, 20, s.wallH - 10, PAL.glass);
        door(g, X + W / 2, Y + H - 2, 20, 16, PAL.wood);
        rect(g, X + W / 2 - 8, Y + 12, 16, 6, '#ffffff'); rect(g, X + W / 2 - 1, Y + 13, 2, 4, '#333');
        sign(g, 'STESEN KERETAPI', X + W / 2, Y + H - 2, '#386641', '#f2e8cf');
        break;
      }
      case 'rail': {
        rect(g, X, Y + 6, W + 32, 20, '#8a7f6e');
        for (let i = 0; i < 60; i++) rect(g, X + R.int(0, W + 30), Y + 6 + R.int(0, 19), 1, 1, R.next() < 0.5 ? '#776d5e' : '#9c917f');
        for (let i = 0; i < W + 32; i += 8) rect(g, X + i, Y + 8, 4, 16, '#5c4033');
        rect(g, X, Y + 11, W + 32, 2, '#c0c0c0'); rect(g, X, Y + 19, W + 32, 2, '#c0c0c0');
        rect(g, X, Y + 11, W + 32, 1, '#e8e8e8'); rect(g, X, Y + 19, W + 32, 1, '#e8e8e8');
        break;
      }
      default: building(g, X, Y, W, H, { wall: '#ccc', roof: '#999' });
    }
  }

  // Undeveloped land in a varied town: jungle, an oil palm estate or scrub (cleared when built on).
  function wildLot(g, b, X, Y, W, H, R) {
    const kind = b.block.wild;
    if (kind === 'palm') {
      rect(g, X + 2, Y + 2, W - 4, H - 4, '#8fae5a');
      for (let y = Y + 10; y < Y + H - 18; y += 22) for (let x = X + 8 + ((y / 22) % 2) * 11; x < X + W - 16; x += 22) palm(g, x, y);
      sign(g, 'LADANG SAWIT', X + W / 2, Y + H - 13, '#4a6a1f');
    } else if (kind === 'forest') {
      rect(g, X + 2, Y + 2, W - 4, H - 4, '#5d8f43');
      for (let i = 0; i < 46; i++) rainTree(g, X + R.int(0, W - 18), Y + R.int(0, H - 18), 0.8 + R.next() * 0.5, R);
      sign(g, 'HUTAN', X + W / 2, Y + H - 13, '#2d4a1f');
    } else {
      rect(g, X + 4, Y + 4, W - 8, H - 8, '#a3bf6e');
      for (let i = 0; i < 70; i++) rect(g, X + 6 + R.int(0, W - 14), Y + 6 + R.int(0, H - 14), 2, 2, R.next() < 0.5 ? '#8fb463' : '#c2b27a');
      for (let i = 0; i < 8; i++) shrub(g, X + R.int(6, W - 16), Y + R.int(6, H - 14));
      sign(g, 'TANAH DIJUAL', X + W / 2, Y + H / 2 - 12, '#7a5a1d');
    }
  }

  // Scatter of trees and plants on free ground (kampung gets palms and bananas).
  function drawGreenery(g, town, busy, R) {
    const T = town.T;
    for (let y = 0; y < town.H; y++) for (let x = 0; x < town.W; x++) {
      if (busy[y * town.W + x] || R.next() > 0.3) continue;
      const px = x * T + R.int(0, 6), py = y * T + R.int(0, 4);
      const bl = LES.townBlockAt(town, x, y);
      const code = bl ? bl.code : '';
      const v = R.next();
      if (code === 'K' || code === 'A') { if (v < 0.5) palm(g, px, py); else if (v < 0.75) banana(g, px, py); else rainTree(g, px, py, 0.8, R); }
      else if (x < 15 && v < 0.6) palm(g, px, py);
      else if (v < 0.15) shrub(g, px + 2, py + 6);
      else rainTree(g, px, py, 0.9 + R.next() * 0.25, R);
    }
  }

  // Paint the whole static map; returns the window list for the night-light layer.
  function beginLights() { lightRects = []; }
  function takeLights() { const r = lightRects || []; lightRects = null; return r; }

  LES.Art = { beginLights, takeLights, PAL, rect, shade, sign, building, roof, facade, windows, door, awning, castShadow, rainTree, palm, banana, shrub, drawGround, drawBuilding, drawGreenery };
})(globalThis.LES = globalThis.LES || {});
