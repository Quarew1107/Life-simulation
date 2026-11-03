// Canvas renderer for the pixel town. The static map (ground, roads, buildings)
// is drawn once to an offscreen canvas; people, shop signs and day/night are drawn
// every frame. Rendering only reads world state, it never changes it.
(function (LES) {
  'use strict';
  const C = LES.C, P = LES.P, U = LES.U;

  // Visual day timeline is real clock time: t = 0 is 06:00, t = 1 is 06:00 next day.
  // Fixed schedule (minutes after 06:00): slot A 08:00-15:12, slot B 15:12-22:24.
  LES.SLOT_A = 120; LES.SLOT_B = 552; LES.SLOT_END = 984;
  LES.clockAt = function (t) {
    const mins = Math.floor(((t * 1440) + 360) % 1440);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };
  // Night = after 23:00 or before 06:00 (used for fast-forward and darkness).
  LES.isNight = t => t * 1440 >= 1020;
  // Travel speed in map pixels per simulated minute, by transport tier.
  LES.TRAVEL_SPEED = [64, 220, 290, 300];

  // How a person looks while doing an activity: 'city' = drives around town (value =
  // vehicle mode), 'area' = moves around the site, 'outside' = stands/sits outdoors,
  // 'inside' = inside the building (not drawn; the building shows a headcount).
  const CITY_JOBS = { rider: 1, delivery: 1, ehailing: 2 };
  const AREA_JOBS = new Set(['construction', 'electrician', 'labour', 'running', 'sports', 'gym', 'pasar', 'promoter']);
  LES.motionOf = function (e, b) {
    if (!e) return 'inside';
    if (e.sub && CITY_JOBS[e.sub]) return 'city';
    if (e.sub && AREA_JOBS.has(e.sub)) return 'area';
    if (e.act === 'SOCIAL') return b && b.kind === 'park' ? 'area' : 'outside';
    if (e.act === 'HOME' && /Playing/.test(e.label || '')) return 'outside';
    return 'inside';
  };

  const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };
  const FONT = '"Silkscreen", "Press Start 2P", monospace';

  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), gg = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${gg},${b})`;
  }
  function box(g, X, Y, W, H, wall, roof, roofH) {
    rect(g, X + 3, Y + 3, W, H, 'rgba(30,40,20,0.28)');
    rect(g, X, Y, W, H, wall);
    if (roof) { rect(g, X, Y, W, roofH, roof); rect(g, X, Y + roofH - 2, W, 2, shade(roof, 0.75)); rect(g, X, Y, W, 2, shade(roof, 1.2)); }
    g.strokeStyle = shade(wall, 0.6); g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1);
  }
  function windows(g, X, Y, W, H, cols, rows, col, frame) {
    const cw = W / cols, rh = H / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = Math.round(X + c * cw + cw * 0.25), y = Math.round(Y + r * rh + rh * 0.2);
      const ww = Math.max(2, Math.round(cw * 0.5)), hh = Math.max(2, Math.round(rh * 0.55));
      if (frame) rect(g, x - 1, y - 1, ww + 2, hh + 2, frame);
      rect(g, x, y, ww, hh, col);
      rect(g, x, y, ww, 1, 'rgba(255,255,255,0.35)');
    }
  }
  function sign(g, text, cx, y, bg, fg) {
    g.font = `8px ${FONT}`;
    const tw = Math.ceil(g.measureText(text).width);
    const x = Math.round(cx - tw / 2 - 3);
    rect(g, x + 1, y + 1, tw + 6, 11, 'rgba(0,0,0,0.35)');
    rect(g, x, y, tw + 6, 11, bg || '#20262e');
    g.fillStyle = fg || '#f4f1e8';
    g.textBaseline = 'top';
    g.fillText(text, x + 3, y + 2);
  }
  function tree(g, x, y, palm) {
    if (palm) {
      rect(g, x + 3, y + 5, 2, 9, '#8a6a43');
      g.fillStyle = '#3f8f3a';
      for (const [dx, dy, w, h] of [[-2, 3, 12, 2], [0, 1, 8, 2], [2, 0, 4, 6], [-1, 5, 3, 2], [7, 5, 3, 2]]) g.fillRect(x + dx, y + dy, w, h);
      rect(g, x + 2, y + 2, 4, 1, '#5fb34f');
    } else {
      rect(g, x + 3, y + 9, 3, 5, '#7a5a3a');
      rect(g, x, y + 2, 9, 8, '#3e8a3e'); rect(g, x + 1, y, 7, 11, '#3e8a3e');
      rect(g, x + 2, y + 1, 4, 3, '#5aa84f'); rect(g, x + 1, y + 9, 7, 2, '#2f6f31');
    }
  }

  // ---------------- Building painters ----------------
  const SHOP_COLOURS = ['#f4a261', '#e9c46a', '#a8dadc', '#f6bd60', '#cdb4db', '#90be6d', '#f28482', '#84a59d'];
  function drawBuilding(g, b, R) {
    const T = 16, X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
    switch (b.kind) {
      case 'kampung': {
        rect(g, X + 3, Y + 42, 42, 4, 'rgba(30,40,20,0.25)');
        for (const sx of [8, 22, 36]) rect(g, X + sx, Y + 36, 3, 9, '#5c3d22');
        rect(g, X + 5, Y + 18, 38, 20, '#b07d48');
        for (let i = 7; i < 43; i += 4) rect(g, X + i, Y + 18, 1, 20, '#9a6a3a');
        for (let r = 0; r < 16; r++) { const w = 14 + r * 2.4; rect(g, Math.round(X + 24 - w / 2), Y + 3 + r, Math.round(w), 1, r % 3 === 0 ? '#a14a33' : '#8c3b2a'); }
        rect(g, X + 13, Y + 23, 8, 7, '#3b2a1d'); rect(g, X + 14, Y + 24, 6, 5, '#f0c96b');
        rect(g, X + 28, Y + 23, 8, 15, '#6b4426');
        for (let i = 0; i < 4; i++) rect(g, X + 37 + i * 2, Y + 38 + i * 2, 3, 1, '#7a5230');
        break;
      }
      case 'flat': {
        const wall = b.id % 2 ? '#e8dcc0' : '#cfe3d8';
        box(g, X + 2, Y + 2, W - 4, H - 4, wall, '#8f969e', 8);
        windows(g, X + 5, Y + 12, W - 10, H - 24, 4, 7, '#7fb3cf', shade(wall, 0.75));
        for (let i = 0; i < 14; i++) rect(g, X + 6 + R.int(0, W - 14), Y + 16 + R.int(0, H - 34), 2, 2, R.pick(C.SHIRTS));
        rect(g, X + W / 2 - 6, Y + H - 12, 12, 10, '#5b4a3f');
        sign(g, 'PPR', X + W / 2, Y + 1, '#3d5a80');
        break;
      }
      case 'terrace': {
        const units = Math.floor(W / 32);
        for (let i = 0; i < units; i++) {
          const ux = X + i * 32 + 1;
          rect(g, ux + 2, Y + 3, 30, H - 1, 'rgba(30,40,20,0.25)');
          rect(g, ux, Y + 12, 30, H - 12, '#f3ead7');
          rect(g, ux, Y, 30, 13, i % 2 ? '#c4553b' : '#b54a31');
          rect(g, ux, Y + 5, 30, 1, '#8e3a26');
          rect(g, ux + 4, Y + 16, 6, 5, '#8cc6de');
          rect(g, ux + 18, Y + 15, 6, 10, '#7a4f2b');
          rect(g, ux + 29, Y + 12, 1, H - 12, '#c9bda4');
        }
        break;
      }
      case 'condo': {
        box(g, X + 2, Y, W - 4, H - 2, '#b9cfdc', '#5b6b78', 8);
        for (let yy = Y + 12; yy < Y + H - 12; yy += 10) {
          rect(g, X + 5, yy, W - 10, 6, '#7fa7c2');
          rect(g, X + 4, yy + 6, W - 8, 2, '#eef3f6');
        }
        rect(g, X + W / 2 - 1, Y - 6, 2, 6, '#5b6b78');
        rect(g, X + W / 2 - 5, Y + H - 12, 10, 10, '#3a4a58');
        break;
      }
      case 'bungalow': {
        rect(g, X + 1, Y + 1, W - 2, H - 2, '#6fae5a');
        for (let i = 0; i < W - 4; i += 4) rect(g, X + 2 + i, Y + H - 4, 2, 3, '#f4f1e8');
        box(g, X + 8, Y + 8, 46, 34, '#fbf7ef', b.id % 2 ? '#3e6f9e' : '#b5523b', 13);
        windows(g, X + 10, Y + 22, 42, 12, 4, 1, '#8cc6de');
        rect(g, X + 26, Y + 32, 8, 10, '#6b4426');
        rect(g, X + 58, Y + 34, 18, 22, '#ffffff'); rect(g, X + 60, Y + 36, 14, 18, '#5fc4e0'); rect(g, X + 61, Y + 37, 6, 2, '#a6e3f2');
        tree(g, X + 62, Y + 8, true);
        break;
      }
      case 'mamak': {
        box(g, X + 2, Y + 2, W - 4, 30, '#f7f2e4', '#2f7d4f', 10);
        for (let i = 0; i < W - 4; i += 8) { rect(g, X + 2 + i, Y + 30, 4, 7, '#2f9e5b'); rect(g, X + 6 + i, Y + 30, 4, 7, '#ffffff'); }
        for (let k = 0; k < 5; k++) { const tx = X + 8 + k * 14, ty = Y + 44 + (k % 2) * 8; rect(g, tx, ty, 8, 5, '#d7dde2'); rect(g, tx - 3, ty + 1, 2, 3, '#e63946'); rect(g, tx + 9, ty + 1, 2, 3, '#e63946'); }
        sign(g, (b.label || 'Mamak').toUpperCase(), X + W / 2, Y + 12, '#1f6b40');
        break;
      }
      case 'hawker': {
        rect(g, X + 3, Y + 3, W, H - 4, 'rgba(30,40,20,0.25)');
        rect(g, X, Y + 12, W, H - 14, '#5a4a42');
        for (let i = 0; i < W; i += 6) rect(g, X + i, Y, 4, 14, i % 12 ? '#c94c4c' : '#b23f3f');
        rect(g, X, Y + 12, W, 2, '#8e3333');
        for (let k = 0; k < 6; k++) rect(g, X + 4 + k * 18, Y + 16, 14, 6, SHOP_COLOURS[k % SHOP_COLOURS.length]);
        for (let k = 0; k < 8; k++) rect(g, X + 8 + (k % 4) * 26, Y + 32 + Math.floor(k / 4) * 18, 12, 6, '#e6e1d6');
        for (const px of [X + 1, X + W - 4]) rect(g, px, Y + 12, 3, H - 14, '#8a7a70');
        sign(g, 'HAWKER CENTRE', X + W / 2, Y + 2, '#7a1f1f');
        break;
      }
      case 'university': {
        rect(g, X, Y + 74, W, H - 74, '#7fbf5a');
        g.strokeStyle = '#c96a4a'; g.lineWidth = 3; g.strokeRect(X + 14, Y + 86, W - 28, H - 96);
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 1; g.strokeRect(X + 28, Y + 96, W - 56, H - 116);
        box(g, X + 6, Y + 18, W - 12, 52, '#efe4cc', '#2e5c8a', 12);
        windows(g, X + 12, Y + 34, W - 24, 28, 12, 2, '#8cc6de', '#c8b893');
        box(g, X + W / 2 - 14, Y + 2, 28, 66, '#f4ead6', '#24476b', 10);
        rect(g, X + W / 2 - 6, Y + 14, 12, 12, '#ffffff'); rect(g, X + W / 2 - 1, Y + 16, 2, 6, '#333'); rect(g, X + W / 2, Y + 20, 4, 2, '#333');
        rect(g, X + W / 2 - 6, Y + 52, 12, 16, '#5b4a3f');
        sign(g, 'UNIVERSITI REZEKI', X + W / 2, Y + 75, '#24476b');
        break;
      }
      case 'kolej': box(g, X + 2, Y + 4, W - 4, H - 8, '#efe3c9', '#6f8f3a', 12); windows(g, X + 6, Y + 20, W - 12, 24, 5, 2, '#8cc6de'); sign(g, 'KOLEJ VOKASIONAL', X + W / 2, Y + H - 12, '#4d6a26'); break;
      case 'library': box(g, X + 2, Y + 4, W - 4, H - 8, '#e9e1d0', '#8b5a2b', 12); for (let i = 0; i < 5; i++) rect(g, X + 10 + i * 16, Y + 20, 4, 40, '#f8f4ea'); sign(g, 'LIBRARY', X + W / 2, Y + H - 12, '#6b4423'); break;
      case 'hall': {
        box(g, X + 2, Y + 10, W - 4, H - 12, '#f0dcc0', null, 0);
        for (let r = 0; r < 12; r++) rect(g, X + 2 + r, Y + 10 - Math.min(r, 8), W - 4 - r * 2, 1, '#b5651d');
        rect(g, X + 2, Y, 4, 10, '#b5651d'); rect(g, X + W - 6, Y, 4, 10, '#b5651d');
        windows(g, X + 8, Y + 24, W - 16, 16, 4, 1, '#8cc6de');
        sign(g, 'DEWAN', X + W / 2, Y + H - 14, '#7a3f12');
        break;
      }
      case 'office': case 'techhub': {
        const tech = b.kind === 'techhub';
        box(g, X + 2, Y, W - 4, H - 2, tech ? '#2e5f8a' : '#5f7f99', tech ? '#1d3b57' : '#3a4a58', 8);
        windows(g, X + 5, Y + 10, W - 10, H - 26, 3, 14, tech ? '#7fd8f0' : '#9fc0d6');
        if (tech) for (let yy = Y + 20; yy < Y + H - 20; yy += 30) rect(g, X + 2, yy, W - 4, 2, '#3ec7b5');
        rect(g, X + W / 2 - 1, Y - 8, 2, 8, '#ccc');
        rect(g, X + W / 2 - 6, Y + H - 14, 12, 12, '#203040');
        sign(g, tech ? 'TECH HUB' : 'MENARA', X + W / 2, Y + H + 1, tech ? '#13615a' : '#2b3a48');
        break;
      }
      case 'bank': {
        box(g, X + 2, Y + 12, W - 4, H - 14, '#e8e4da', null, 0);
        for (let r = 0; r < 10; r++) rect(g, X + 2 + r * 2.6, Y + 12 - r, W - 4 - r * 5.2, 1, '#9aa0a6');
        for (let i = 0; i < 4; i++) rect(g, X + 9 + i * 14, Y + 18, 4, 32, '#ffffff');
        sign(g, 'BANK', X + W / 2, Y + 2, '#8a6d1d', '#ffe9a8');
        break;
      }
      case 'bursa': {
        box(g, X + 2, Y + 2, W - 4, H - 4, '#24384c', '#16222e', 8);
        rect(g, X + 8, Y + 16, W - 16, 26, '#0e1620');
        g.strokeStyle = '#57d38c'; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= 10; i++) { const xx = X + 10 + i * (W - 20) / 10, yy = Y + 36 - i * 1.6 - (i % 3) * 3; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
        g.stroke();
        rect(g, X + W / 2 - 8, Y + H - 16, 16, 12, '#0e1620');
        sign(g, 'BURSA', X + W / 2, Y + 3, '#0e1620', '#57d38c');
        break;
      }
      case 'mall': {
        box(g, X + 2, Y + 2, W - 4, H - 4, '#e9dff5', '#9b7fc4', 12);
        windows(g, X + 8, Y + 20, W - 16, 60, 4, 3, '#c9b8e8');
        rect(g, X + 20, Y + H - 34, W - 40, 30, '#8fc1d8'); rect(g, X + W / 2, Y + H - 34, 1, 30, '#5b7f94');
        sign(g, 'REZEKI MALL', X + W / 2, Y + 4, '#5e3f8f');
        break;
      }
      case 'shoplot': {
        // Two-storey shophouse: tiled roof, sign band over the upper floor, five-foot way below.
        const col = SHOP_COLOURS[b.id % SHOP_COLOURS.length];
        rect(g, X + 3, Y + 3, W - 1, H - 1, 'rgba(30,40,20,0.25)');
        rect(g, X, Y, W - 1, 6, '#a0522d'); rect(g, X, Y + 5, W - 1, 1, '#7a3c20');
        rect(g, X, Y + 6, W - 1, 22, col);
        rect(g, X, Y + 28, W - 1, H - 28, '#5b4a3f');
        rect(g, X + 3, Y + 31, W - 7, H - 33, '#3a2f28');
        for (const px of [X, X + 21, X + 42, X + W - 3]) rect(g, px, Y + 28, 2, H - 28, '#d9cfc0');
        break;
      }
      case 'hospital': {
        box(g, X + 2, Y + 2, W - 4, H - 4, '#f6f8f9', '#2a9d8f', 10);
        windows(g, X + 8, Y + 16, W - 16, H - 40, 5, 4, '#9fd3e0');
        rect(g, X + W / 2 - 9, Y + H - 26, 18, 18, '#2a9d8f'); rect(g, X + W / 2 - 2, Y + H - 23, 4, 12, '#fff'); rect(g, X + W / 2 - 6, Y + H - 19, 12, 4, '#fff');
        rect(g, X + 6, Y + H - 16, 16, 9, '#ffffff'); rect(g, X + 6, Y + H - 12, 16, 2, '#e63946');
        sign(g, 'HOSPITAL', X + W / 2, Y + 1, '#1d6f66');
        break;
      }
      case 'school': {
        rect(g, X, Y + 50, W, H - 50, '#8bc34a');
        g.strokeStyle = '#f4f1e8'; g.strokeRect(X + 8.5, Y + 56.5, W - 17, H - 64);
        box(g, X + 2, Y + 4, W - 4, 44, '#f2d16b', '#3b6ea8', 10);
        windows(g, X + 6, Y + 18, W - 12, 24, 6, 2, '#8cc6de');
        rect(g, X + W - 10, Y + 52, 1, 20, '#ddd'); rect(g, X + W - 9, Y + 52, 8, 3, '#d62828'); rect(g, X + W - 9, Y + 55, 8, 3, '#ffffff');
        sign(g, 'SEKOLAH', X + W / 2, Y + 4, '#2c5282');
        break;
      }
      case 'factory': {
        box(g, X + 2, Y + 14, W - 4, H - 16, '#a3acb5', null, 0);
        for (let i = 0; i < W - 4; i += 16) for (let r = 0; r < 10; r++) rect(g, X + 2 + i, Y + 14 - r, 16 - r * 1.5, 1, '#7d8790');
        for (const cx of [X + 20, X + 44]) { rect(g, cx, Y - 10, 8, 24, '#6c757d'); rect(g, cx, Y - 4, 8, 3, '#d62828'); }
        windows(g, X + 8, Y + 30, W - 16, 30, 8, 2, '#c3d7e0');
        rect(g, X + W - 40, Y + H - 26, 30, 24, '#5d666f');
        for (let i = 0; i < 6; i++) rect(g, X + W - 40, Y + H - 24 + i * 4, 30, 1, '#4a525a');
        sign(g, 'KILANG', X + W / 2, Y + H - 14, '#3d454d');
        break;
      }
      case 'workshop': box(g, X + 2, Y + 4, W - 4, H - 6, '#c9b49b', '#7a6a5a', 8); for (const gx of [X + 8, X + 50]) { rect(g, gx, Y + 24, 34, 34, '#6c757d'); for (let i = 0; i < 8; i++) rect(g, gx, Y + 26 + i * 4, 34, 1, '#58606a'); } sign(g, 'BENGKEL', X + W / 2, Y + 12, '#5a4632'); break;
      case 'warehouse': {
        box(g, X + 2, Y + 2, W - 4, H - 6, '#b8c4cc', '#7c8a94', 10);
        rect(g, X + 12, Y + 22, 40, 36, '#7c8a94');
        rect(g, X + 62, Y + 40, 28, 14, '#f4f1e8'); rect(g, X + 90, Y + 44, 10, 10, '#2a9d8f'); rect(g, X + 66, Y + 54, 5, 4, '#222'); rect(g, X + 90, Y + 54, 5, 4, '#222');
        sign(g, 'GUDANG', X + W / 2, Y + 12, '#4a5861');
        break;
      }
      case 'construction': {
        rect(g, X, Y, W, H, '#c9ad7f');
        for (let i = 0; i < 30; i++) rect(g, X + R.int(0, W - 3), Y + R.int(0, H - 3), 3, 2, '#b39465');
        rect(g, X + 40, Y + 6, 80, 50, '#9ea4a8');
        for (let i = 0; i < 5; i++) rect(g, X + 40 + i * 20, Y + 6, 3, 50, '#7a8086');
        for (let i = 0; i < 3; i++) rect(g, X + 40, Y + 6 + i * 20, 80, 3, '#7a8086');
        rect(g, X + 150, Y - 30, 5, 88, '#f4c430'); rect(g, X + 110, Y - 30, 100, 4, '#f4c430'); rect(g, X + 130, Y - 26, 1, 30, '#333'); rect(g, X + 126, Y + 4, 9, 6, '#7a5230');
        sign(g, 'TAPAK BINAAN', X + 30, Y + H - 14, '#7a5a1d');
        break;
      }
      case 'park': {
        rect(g, X, Y, W, H, '#93c96b');
        g.fillStyle = '#4fa3c7'; g.beginPath(); g.ellipse(X + W / 2, Y + H / 2 + 10, W / 2 - 14, H / 2 - 40, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7cc3e0'; g.beginPath(); g.ellipse(X + W / 2 - 8, Y + H / 2 + 2, 14, 8, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#e2cf9f'; g.lineWidth = 4; g.beginPath(); g.ellipse(X + W / 2, Y + H / 2 + 10, W / 2 - 8, H / 2 - 32, 0, 0, Math.PI * 2); g.stroke();
        for (const [tx, ty] of [[6, 6], [W - 18, 10], [8, H - 26], [W - 20, H - 24], [W / 2 - 4, 4]]) tree(g, X + tx, Y + ty, false);
        sign(g, 'TAMAN TASIK', X + W / 2, Y + H - 14, '#2d6a4f');
        break;
      }
      case 'gym': {
        rect(g, X + 2, Y + 2, W - 4, H - 4, '#c0573e');
        rect(g, X + 10, Y + 10, W - 20, H - 20, '#6fb35a');
        g.strokeStyle = '#f4f1e8'; g.strokeRect(X + 6.5, Y + 6.5, W - 13, H - 13);
        sign(g, 'STADIUM', X + W / 2, Y + H / 2 - 5, '#7a2e1e');
        break;
      }
      case 'welfare': box(g, X + 2, Y + 4, W - 4, H - 6, '#f0e6d2', '#9c6644', 10); rect(g, X + 10, Y + 22, 6, 6, '#e63946'); sign(g, 'RUMAH KEBAJIKAN', X + W / 2, Y + H - 4, '#6b3f22'); break;
      case 'padi': {
        for (let r = 0; r < H; r += 4) rect(g, X, Y + r, W, 4, r % 8 ? '#a6d36b' : '#8cc152');
        for (let c = 0; c < W; c += 48) rect(g, X + c, Y, 2, H, '#6fb0c9');
        sign(g, 'SAWAH PADI', X + W / 2, Y + H / 2 - 5, '#4a6a1f');
        break;
      }
      case 'depot': {
        box(g, X + 2, Y + 4, W - 4, H - 6, '#d6d0c4', '#5b6b78', 10);
        for (let i = 0; i < 3; i++) rect(g, X + 8 + i * 28, Y + 24, 22, 32, '#6c757d');
        sign(g, 'DEPOT BAS', X + W / 2, Y + 12, '#3d5a80');
        break;
      }
      case 'memorial': {
        rect(g, X, Y, W, H, '#7fb069');
        g.strokeStyle = '#e2cf9f'; g.lineWidth = 3; g.strokeRect(X + 8.5, Y + 8.5, W - 17, H - 17);
        rect(g, X + W / 2 - 8, Y + H / 2 - 10, 16, 20, '#cfc6b0'); rect(g, X + W / 2 - 5, Y + H / 2 - 16, 10, 6, '#b8ad95');
        for (const [tx, ty] of [[4, 4], [W - 14, 6], [6, H - 22], [W - 16, H - 20]]) tree(g, X + tx, Y + ty, false);
        sign(g, 'TAMAN KENANGAN', X + W / 2, Y + H - 14, '#4a5a3a');
        break;
      }
      case 'lot': {
        if (b.built) break;
        rect(g, X + 6, Y + 6, W - 12, H - 12, '#9cc06f');
        g.strokeStyle = '#8b6b43'; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(X + 6.5, Y + 6.5, W - 13, H - 13); g.setLineDash([]);
        rect(g, X + W / 2 - 1, Y + H / 2 - 4, 2, 14, '#6b4423');
        sign(g, 'TANAH DIJUAL', X + W / 2, Y + H / 2 - 12, '#7a5a1d');
        break;
      }
      case 'builtlot': rect(g, X + 2, Y + 2, W - 4, H - 4, '#a9b98a'); break;
      case 'hq': {
        rect(g, X - 8, Y + H - 20, W + 16, 20, '#d9cfc0');
        box(g, X + 2, Y, W - 4, H - 22, '#c9a227', '#7a5c12', 10);
        windows(g, X + 6, Y + 14, W - 12, H - 44, 4, 12, '#fff3c4');
        rect(g, X + W / 2 - 1, Y - 14, 2, 14, '#ccc'); rect(g, X + W / 2 - 3, Y - 16, 6, 3, '#e63946');
        sign(g, (b.label || 'MENARA').toUpperCase(), X + W / 2, Y + H - 16, '#3d2b05', '#ffe9a8');
        break;
      }
      default: box(g, X, Y, W, H, '#ccc', '#999', 8);
    }
  }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.z = 1; this.cx = 0; this.cy = 0; this.vw = 1; this.vh = 1; this.dpr = 1;
      this.anim = new Map();
      this.screenPos = [];
      this.hoverId = -1; this.selectedId = -1; this.follow = false;
      this.richIds = [];
    }

    setWorld(w) {
      this.w = w; this.town = w.town;
      this.anim.clear();
      this.selectedBuilding = -1;
      this.buildStatic();
      this.resize();
      this.fit();
    }

    resize() {
      const r = this.cv.getBoundingClientRect();
      this.dpr = window.devicePixelRatio || 1;
      this.vw = Math.max(1, r.width); this.vh = Math.max(1, r.height);
      this.cv.width = Math.round(this.vw * this.dpr);
      this.cv.height = Math.round(this.vh * this.dpr);
      this.clampCam();
    }

    worldSize() { return { W: this.town.W * this.town.T, H: this.town.H * this.town.T }; }
    fitZoom() { const { W, H } = this.worldSize(); return Math.min(this.vw / W, this.vh / H); }
    fit() {
      const { W, H } = this.worldSize();
      this.z = this.fitZoom();
      this.cx = W / 2 - this.vw / this.z / 2;
      this.cy = H / 2 - this.vh / this.z / 2;
    }
    clampCam() {
      if (!this.town) return;
      const { W, H } = this.worldSize();
      this.z = U.clamp(this.z, this.fitZoom() * 0.9, 6);
      const vw = this.vw / this.z, vh = this.vh / this.z;
      this.cx = vw >= W ? W / 2 - vw / 2 : U.clamp(this.cx, -20, W - vw + 20);
      this.cy = vh >= H ? H / 2 - vh / 2 : U.clamp(this.cy, -20, H - vh + 20);
    }
    zoomAt(sx, sy, factor) {
      const wx = this.cx + sx / this.z, wy = this.cy + sy / this.z;
      this.z = U.clamp(this.z * factor, this.fitZoom() * 0.9, 6);
      this.cx = wx - sx / this.z; this.cy = wy - sy / this.z;
      this.clampCam();
    }
    pan(dx, dy) { this.cx -= dx / this.z; this.cy -= dy / this.z; this.clampCam(); }
    centerOn(x, y, k) {
      const tx = x - this.vw / this.z / 2, ty = y - this.vh / this.z / 2;
      this.cx += (tx - this.cx) * (k || 1); this.cy += (ty - this.cy) * (k || 1);
      this.clampCam();
    }

    buildStatic() {
      const town = this.town, T = town.T, W = town.W * T, H = town.H * T;
      const R = new LES.RNG('decor');
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      rect(g, 0, 0, W, H, '#86b85f');
      for (let i = 0; i < W * H / 400; i++) rect(g, R.int(0, W), R.int(0, H), 2, 1, R.next() < 0.5 ? '#79a955' : '#93c46b');

      // Roads with sidewalks and lane markings
      for (const ry of town.roadsY) { rect(g, 0, ry * T - 4, W, 2 * T + 8, '#cfc6b0'); rect(g, 0, ry * T, W, 2 * T, '#4b4f58'); }
      for (const rx of town.roadsX) { rect(g, rx * T - 4, 0, 2 * T + 8, H, '#cfc6b0'); rect(g, rx * T, 0, 2 * T, H, '#4b4f58'); }
      for (const ry of town.roadsY) for (let x = 0; x < W; x += 14) rect(g, x, ry * T + T - 1, 7, 2, '#e9d16b');
      for (const rx of town.roadsX) for (let y = 0; y < H; y += 14) rect(g, rx * T + T - 1, y, 2, 7, '#e9d16b');
      for (const ry of town.roadsY) for (const rx of town.roadsX) {
        rect(g, rx * T, ry * T, 2 * T, 2 * T, '#4b4f58');
        for (let i = 0; i < 4; i++) {
          rect(g, rx * T - 10, ry * T + 2 + i * 8, 7, 4, '#e8e4da');
          rect(g, rx * T + 2 * T + 3, ry * T + 2 + i * 8, 7, 4, '#e8e4da');
          rect(g, rx * T + 2 + i * 8, ry * T - 10, 4, 7, '#e8e4da');
          rect(g, rx * T + 2 + i * 8, ry * T + 2 * T + 3, 4, 7, '#e8e4da');
        }
      }

      // Occupancy grid for placing trees
      const busy = new Uint8Array(town.W * town.H);
      const mark = (x, y) => { if (x >= 0 && y >= 0 && x < town.W && y < town.H) busy[y * town.W + x] = 1; };
      for (const ry of town.roadsY) for (let x = 0; x < town.W; x++) for (let y = ry - 1; y <= ry + 2; y++) mark(x, y);
      for (const rx of town.roadsX) for (let y = 0; y < town.H; y++) for (let x = rx - 1; x <= rx + 2; x++) mark(x, y);
      for (const b of town.buildings) {
        if (b.kind === 'lot' && !b.built) continue; // trees may grow on empty lots
        for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y - 1; y <= b.y + b.h + 1; y++) mark(x, y);
      }
      for (const b of town.buildings) drawBuilding(g, b, R);
      for (let y = 0; y < town.H; y++) for (let x = 0; x < town.W; x++) {
        if (busy[y * town.W + x] || R.next() > 0.3) continue;
        tree(g, x * T + R.int(0, 6), y * T + R.int(0, 4), x < 15 || R.next() < 0.3);
      }
      // Bus stops (shelter on the sidewalk) and the town gateway arch
      for (const line of town.busLines) for (const st of line.stops) {
        const sx = st.pt.x + 18, sy = st.pt.y - 26;
        rect(g, sx, sy, 12, 3, '#3d5a80'); rect(g, sx + 1, sy + 3, 1, 7, '#666'); rect(g, sx + 10, sy + 3, 1, 7, '#666');
        rect(g, sx - 3, sy - 4, 3, 14, line.colour);
      }
      const gw = town.gateway;
      rect(g, gw.x + 2, gw.y - 22, 4, 40, '#8b5a2b'); rect(g, gw.x + 2, gw.y - 26, 70, 9, '#b23a48');
      g.font = `7px ${FONT}`; g.fillStyle = '#ffe9a8'; g.textBaseline = 'top';
      g.fillText('SELAMAT DATANG', gw.x + 5, gw.y - 25);
      this.bg = cv;
      this.lights = LES.Ambience.buildLights(town);
      this.bgVersion = this.w ? this.w.townVersion : 0;
    }

    // Stable spot in front of a building for a given person.
    spot(bId, pid) {
      const b = this.town.buildings[bId] || this.town.buildings[this.town.byKind.welfare];
      const T = this.town.T, h = hash(pid * 7919 + bId);
      const span = Math.max(6, b.w * T - 8);
      const x = b.x * T + 4 + (h % span);
      const dy = 3 + ((h >>> 9) % 5) * 2;
      const y = b.doorBelow ? (b.y + b.h) * T + dy : b.y * T - dy + 6;
      return { x, y };
    }

    // Road route between two points; walkers keep to the sidewalk, vehicles to a lane.
    route(p, a, b, fromB, toB, lane) {
      const tb = this.town.buildings;
      const mid = LES.townPath(this.town, tb[fromB] || tb[0], tb[toB] || tb[0]);
      const pts = [a, ...mid.slice(1, -1).map(q => ({ x: q.x + lane, y: q.y + lane })), b];
      return LES.polyline(pts);
    }
    along(r, f) {
      if (!r.total) { const e = r.pts[r.pts.length - 1]; return { x: e.x, y: e.y, dx: 1, dy: 0 }; }
      let d = U.clamp(f, 0, 1) * r.total;
      for (let i = 0; i < r.lens.length; i++) {
        if (d <= r.lens[i]) {
          const a = r.pts[i], b = r.pts[i + 1], k = r.lens[i] ? d / r.lens[i] : 1;
          return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
        }
        d -= r.lens[i];
      }
      const e = r.pts[r.pts.length - 1];
      return { x: e.x, y: e.y, dx: 1, dy: 0 };
    }

    // Minute (since 06:00) when the next bus of a line reaches position pos at or after m.
    nextBus(line, pos, m) {
      const S = LES.BUS.speed, P = line.len / S;
      let best = Infinity, bus = 0;
      for (let k = 0; k < line.buses; k++) {
        let o = ((pos - k * line.len / line.buses) / S) % P;
        if (o < 0) o += P;
        const tt = o + Math.ceil((m - o) / P) * P;
        if (tt < best) { best = tt; bus = k; }
      }
      return { at: best, bus };
    }

    // Plan one trip (leaves at `depart`, or arrives by `arriveBy`). Returns timed segments.
    planTrip(p, fromB, toB, depart, arriveBy) {
      const a = this.spot(fromB, p.id), b = this.spot(toB, p.id);
      if (fromB === toB) return { segs: [], start: depart !== null ? depart : arriveBy, end: depart !== null ? depart : arriveBy };
      const tier = p.adult ? p.tiers.transport : 0;
      const segs = [];
      if (tier > 0 || !p.adult) {
        const r = this.route(p, a, b, fromB, toB, tier > 0 ? 7 : -19);
        const d = U.clamp(r.total / LES.TRAVEL_SPEED[tier], 2, 120);
        const t0 = depart !== null ? depart : arriveBy - d;
        segs.push({ kind: tier > 0 ? 'drive' : 'walk', r, t0, t1: t0 + d, mode: tier });
        return { segs, start: t0, end: t0 + d };
      }
      // Bus or walk: pick the best bus line, compare with walking all the way.
      const walkR = this.route(p, a, b, fromB, toB, -19);
      const walkT = walkR.total / LES.BUS.walkSpeed;
      let best = null;
      for (const line of this.town.busLines) {
        const near = pt => line.stops.reduce((bst, s) => { const d = Math.abs(s.pt.x - pt.x) + Math.abs(s.pt.y - pt.y); return d < bst.d ? { s, d } : bst; }, { s: null, d: Infinity });
        const s1 = near(a), s2 = near(b);
        if (!s1.s || !s2.s || s1.s === s2.s) continue;
        const ride = ((s2.s.pos - s1.s.pos) % line.len + line.len) % line.len;
        const est = (s1.d + s2.d) / LES.BUS.walkSpeed + ride / LES.BUS.speed + LES.BUS.headway / 2;
        if (!best || est < best.est) best = { line, s1: s1.s, s2: s2.s, ride, est, w1: s1.d, w2: s2.d };
      }
      if (!best || best.est > walkT - 3 || walkR.total < 300) {
        const d = U.clamp(walkT, 2, 120);
        const t0 = depart !== null ? depart : arriveBy - d;
        segs.push({ kind: 'walk', r: walkR, t0, t1: t0 + d, mode: 0 });
        return { segs, start: t0, end: t0 + d };
      }
      const L1 = LES.polyline([a, { x: a.x, y: best.s1.pt.y - 19 }, { x: best.s1.pt.x + 14, y: best.s1.pt.y - 19 }]);
      const L2 = LES.polyline([{ x: best.s2.pt.x + 14, y: best.s2.pt.y - 19 }, { x: b.x, y: best.s2.pt.y - 19 }, b]);
      const w1 = U.clamp(L1.total / LES.BUS.walkSpeed, 1, 60), w2 = U.clamp(L2.total / LES.BUS.walkSpeed, 1, 60);
      const rideT = best.ride / LES.BUS.speed;
      let t0 = depart !== null ? depart : arriveBy - (w1 + rideT + w2 + LES.BUS.headway);
      const atStop = t0 + w1;
      const nb = this.nextBus(best.line, best.s1.pos, atStop);
      segs.push({ kind: 'walk', r: L1, t0, t1: atStop, mode: 0 });
      segs.push({ kind: 'wait', t0: atStop, t1: nb.at, pt: { x: best.s1.pt.x + 14 + (p.id % 5) * 3, y: best.s1.pt.y - 19 } });
      segs.push({ kind: 'ride', t0: nb.at, t1: nb.at + rideT, line: best.line, bus: nb.bus });
      segs.push({ kind: 'walk', r: L2, t0: nb.at + rideT, t1: nb.at + rideT + w2, mode: 0 });
      return { segs, start: t0, end: nb.at + rideT + w2 };
    }

    // Position of a person at visual time t (0..1 of the simulated day, 06:00 start).
    posOf(p, t, fast) {
      const home = p.homeId >= 0 ? p.homeId : this.town.byKind.welfare;
      const plan = p.plan;
      const tm = t * 1440;
      if (!plan || !plan.length) return { ...this.spot(home, p.id), hidden: true, inside: home, moving: false };
      const A = plan[0].loc >= 0 ? plan[0].loc : home;
      const B = plan[1] && plan[1].loc >= 0 ? plan[1].loc : A;
      if (fast) {
        if (tm < LES.SLOT_A - 30 || tm >= LES.SLOT_END) return { ...this.spot(home, p.id), hidden: true, inside: home };
        const slot = tm < LES.SLOT_B ? 0 : 1;
        return this.atPlace(p, slot ? B : A, plan[slot] || plan[0], tm, slot);
      }
      let an = this.anim.get(p.id);
      if (!an || an.day !== this.w.lastDay || an.A !== A || an.B !== B || an.H !== home) {
        const t1 = this.planTrip(p, home, A, null, LES.SLOT_A);
        const t2 = this.planTrip(p, A, B, LES.SLOT_B, null);
        const t3 = this.planTrip(p, B, home, LES.SLOT_END, null);
        an = { day: this.w.lastDay, A, B, H: home, segs: [...t1.segs, ...t2.segs, ...t3.segs], t1, t2, t3 };
        this.anim.set(p.id, an);
      }
      for (const s of an.segs) {
        if (tm < s.t0 || tm >= s.t1) continue;
        if (s.kind === 'wait') return { x: s.pt.x, y: s.pt.y, moving: false, waiting: true };
        if (s.kind === 'ride') return { hidden: true, riding: s, x: 0, y: 0 };
        const q = this.along(s.r, (tm - s.t0) / Math.max(0.001, s.t1 - s.t0));
        return { x: q.x, y: q.y, dx: q.dx, dy: q.dy, moving: true, mode: s.kind === 'drive' ? s.mode : 0 };
      }
      if (tm < an.t1.start) return { ...this.spot(home, p.id), hidden: true, inside: home, moving: false };
      if (tm < LES.SLOT_B) return this.atPlace(p, A, plan[0], tm, 0);
      if (tm < LES.SLOT_END) return this.atPlace(p, B, plan[1] || plan[0], tm, 1);
      return { ...this.spot(home, p.id), hidden: true, inside: home, moving: false };
    }

    // Where someone is while doing their activity at building `loc`.
    atPlace(p, loc, e, tm, slot) {
      const b = this.town.buildings[loc];
      const m = LES.motionOf(e, b);
      if (m === 'city') return this.cityLoop(p, loc, e, tm, slot);
      if (m === 'area') return this.wander(p, b, tm);
      if (m === 'outside') return { ...this.spot(loc, p.id), moving: false };
      return { ...this.spot(loc, p.id), hidden: true, inside: loc, moving: false };
    }

    // Moving around the site: laps of a track/park, criss-crossing a work site, or
    // pacing the frontage of a shop or market.
    wander(p, b, tm) {
      if (!b) return { x: 0, y: 0, hidden: true };
      const T = this.town.T, h = hash(p.id * 31 + b.id);
      const ph = (h % 1000) / 1000 * Math.PI * 2, sp = 0.035 + (h % 40) / 1000;
      const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
      let x, y, dx;
      if (b.kind === 'park' || b.kind === 'gym') {
        const a = ph + tm * sp;
        x = X + W / 2 + (W / 2 - 7) * Math.cos(a);
        y = Y + H / 2 + (H / 2 - 9) * Math.sin(a) + 6;
        dx = -Math.sign(Math.sin(a)) || 1;
      } else if (b.kind === 'construction' || b.kind === 'padi') {
        x = X + 5 + (W - 10) * (0.5 + 0.45 * Math.sin(tm * sp + ph));
        y = Y + 10 + (H - 12) * (0.5 + 0.45 * Math.sin(tm * sp * 1.37 + ph * 2));
        dx = Math.sign(Math.cos(tm * sp + ph)) || 1;
      } else {
        const front = this.spot(b.id, p.id);
        x = X + 4 + (W - 8) * (0.5 + 0.48 * Math.sin(tm * sp * 0.7 + ph));
        y = front.y;
        dx = Math.sign(Math.cos(tm * sp * 0.7 + ph)) || 1;
      }
      return { x, y, dx, dy: 0, moving: true, mode: 0 };
    }

    // Delivery riders and e-hailing drivers loop around town on the road network.
    cityLoop(p, loc, e, tm, slot) {
      const day = this.w.lastDay, key = p.id * 2 + slot;
      this.cityRoutes = this.cityRoutes || new Map();
      let c = this.cityRoutes.get(key);
      if (!c || c.day !== day || c.loc !== loc) {
        const bs = this.town.buildings;
        const stops = [loc];
        for (let k = 0; k < 4; k++) stops.push(hash(p.id * 131 + day * 7 + k * 977 + slot) % bs.length);
        stops.push(loc);
        const pts = [this.spot(loc, p.id)];
        for (let k = 1; k < stops.length; k++) {
          const path = LES.townPath(this.town, bs[stops[k - 1]], bs[stops[k]]);
          for (const q of path.slice(1, -1)) pts.push({ x: q.x + 7, y: q.y + 7 });
          pts.push(k === stops.length - 1 ? this.spot(loc, p.id) : bs[stops[k]].door);
        }
        c = { day, loc, r: LES.polyline(pts) };
        this.cityRoutes.set(key, c);
        if (this.cityRoutes.size > 4000) this.cityRoutes.clear();
      }
      const mode = e.sub === 'ehailing' ? Math.max(2, p.tiers.transport) : 1;
      const start = slot ? LES.SLOT_B : LES.SLOT_A;
      const dist = Math.max(0, tm - start) * LES.TRAVEL_SPEED[mode] * 0.6;
      const q = this.along(c.r, c.r.total ? (dist % c.r.total) / c.r.total : 0);
      return { x: q.x, y: q.y, dx: q.dx, dy: q.dy, moving: true, mode };
    }

    frame(t, fast, now) {
      const g = this.ctx, w = this.w;
      if (!w || !this.bg) return;
      if (this.bgVersion !== w.townVersion) { this.buildStatic(); this.anim.clear(); }
      if (this.follow && this.selectedId >= 0) {
        const p = w.people[this.selectedId];
        if (p && p.alive && !p.away) { const pos = this.posOf(p, t, fast); if (!pos.riding) this.centerOn(pos.x, pos.y, 0.15); }
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#5f8a45';
      g.fillRect(0, 0, this.cv.width, this.cv.height);
      const s = this.z * this.dpr;
      g.setTransform(s, 0, 0, s, -this.cx * s, -this.cy * s);
      g.imageSmoothingEnabled = false;
      g.drawImage(this.bg, 0, 0);
      this.drawShops(g);
      LES.Ambience.drawWorld(this, g, w, t, now, fast);
      if (this.selectedBuilding >= 0) {
        const b = this.town.buildings[this.selectedBuilding], T = this.town.T;
        g.strokeStyle = '#3ec7b5'; g.lineWidth = 2; g.setLineDash([4, 3]);
        g.strokeRect(b.x * T - 2, b.y * T - 2, b.w * T + 4, b.h * T + 4); g.setLineDash([]);
      }

      // People and their vehicles, sorted by y for depth
      const list = [];
      const walkFrame = Math.floor((now || 0) / 180) % 2;
      const busLoad = new Map(), inside = new Map();
      for (const p of w.living) {
        if (!p.alive) continue;
        const pos = this.posOf(p, t, fast);
        if (pos.riding) { const k = `${pos.riding.line.id}|${pos.riding.bus}`; busLoad.set(k, (busLoad.get(k) || 0) + 1); }
        if (pos.inside !== undefined) inside.set(pos.inside, (inside.get(pos.inside) || 0) + 1);
        if (pos.hidden && (p.id !== this.selectedId || pos.riding)) continue;
        list.push({ p, ...pos });
      }
      const tm = t * 1440;
      if (!fast && tm > 20 && tm < 1050) {
        for (const line of this.town.busLines) for (let k = 0; k < line.buses; k++) {
          const pos = LES.busPointAt(line, tm * LES.BUS.speed + k * line.len / line.buses);
          list.push({ bus: true, line, k, x: pos.x, y: pos.y, load: busLoad.get(`${line.id}|${k}`) || 0, horiz: pos.dir !== 0 });
        }
      }
      list.sort((a, b) => a.y - b.y);
      this.screenPos = [];
      const millionaire = U.RM(1e6);
      for (const it of list) {
        if (it.bus) { drawBus(g, it); continue; }
        const p = it.p, age = P.age(w, p);
        const group = age < 3 ? 'baby' : !p.adult ? 'child' : age >= 65 ? 'elder' : 'adult';
        if (it.moving && it.mode > 0) {
          drawVehicle(g, it.x, it.y, it.dx, it.dy, it.mode, p);
          this.screenPos.push({ id: p.id, x: (it.x - this.cx) * this.z, y: (it.y - 4 - this.cy) * this.z });
          continue;
        }
        if (this.overlay && this.overlay !== 'none') {
          const oc = LES.Extras.overlayColour(w, p, this.overlay, this.selectedId >= 0 ? w.people[this.selectedId] : null);
          if (oc) { g.fillStyle = oc; g.beginPath(); g.ellipse(it.x, it.y, 6, 2.5, 0, 0, Math.PI * 2); g.fill(); }
          else if (this.overlay === 'family') g.globalAlpha = 0.35;
        }
        const slotAct = !it.moving && p.plan ? p.plan[tm < LES.SLOT_B ? 0 : 1] : null;
        const atPlace = slotAct && !it.waiting && tm >= LES.SLOT_A && tm < LES.SLOT_END;
        const spr = LES.Sprites.person(p.look, group, it.moving ? walkFrame : 0, atPlace ? LES.Ambience.outfitFor(p, slotAct) : null);
        const x = Math.round(it.x - spr.width / 2), y = Math.round(it.y - spr.height);
        g.drawImage(spr, x, y);
        g.globalAlpha = 1;
        if (atPlace && this.z >= 2.2 && !fast) LES.Ambience.bubble(g, it.x, y - 1, LES.Actions.ICONS[slotAct.act] || '•');
        if (P.goalWorth(w, p) >= millionaire) rect(g, x + spr.width / 2 - 1, y - 3, 3, 2, '#f2c14e');
        this.screenPos.push({ id: p.id, x: (it.x - this.cx) * this.z, y: (it.y - spr.height / 2 - this.cy) * this.z });
      }
      this.drawInside(g, inside, tm);
      this.drawNight(g, t, fast);
      LES.Ambience.drawScreen(this, g, w, t, now, fast, this.nightLevel || 0);
      this.drawLabels(g, w);
    }

    // Small headcount badge on non-home buildings with people working/studying inside.
    drawInside(g, inside, tm) {
      if (tm < LES.SLOT_A - 30 || tm >= LES.SLOT_END || this.z < 1.1) return;
      const T = this.town.T;
      g.font = `7px ${FONT}`; g.textBaseline = 'top';
      for (const [id, n] of inside) {
        const b = this.town.buildings[id];
        if (!b || b.home || n <= 0) continue;
        const text = String(n), tw = Math.ceil(g.measureText(text).width);
        const x = (b.x + b.w) * T - tw - 13, y = b.y * T + 2;
        rect(g, x, y, tw + 11, 9, 'rgba(16,20,26,0.85)');
        rect(g, x + 2, y + 2, 2, 2, '#f4f1e8'); rect(g, x + 1, y + 4, 4, 3, '#f4f1e8'); // tiny person icon
        g.fillStyle = '#f4f1e8'; g.fillText(text, x + 7, y + 1);
      }
    }

    drawNight(g, t, fast) {
      if (fast) { this.nightLevel = 0; return; }
      const hr = (t * 24 + 6) % 24; // dusk 19:00-20:30, dawn 06:00-07:00
      let night = hr >= 20.5 || hr < 6 ? 1 : hr >= 19 ? (hr - 19) / 1.5 : hr < 7 ? 1 - (hr - 6) : 0;
      this.nightLevel = night;
      if (night <= 0) return;
      if (LES.Ambience.weather(this.w.lastDay < 0 ? 0 : this.w.lastDay).id === 'rain') night = Math.min(1, night + 0.1);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = `rgba(12,20,52,${0.38 * night})`;
      g.fillRect(0, 0, this.cv.width, this.cv.height);
    }

    drawLabels(g, w) {
      // Selection + rich labels in screen space (crisp text)
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const label = (id, colour, text) => {
        const sp = this.screenPos.find(q => q.id === id);
        if (!sp) return;
        g.font = `600 11px Inter, system-ui, sans-serif`;
        const tw = g.measureText(text).width;
        const bx = Math.round(sp.x - tw / 2 - 5), by = Math.round(sp.y - 10 * this.z - 18);
        g.fillStyle = 'rgba(16,20,26,0.85)';
        g.fillRect(bx, by, tw + 10, 16);
        g.fillStyle = colour;
        g.fillRect(bx, by + 15, tw + 10, 2);
        g.fillStyle = '#f4f1e8';
        g.textBaseline = 'middle';
        g.fillText(text, bx + 5, by + 8);
      };
      this.richIds.slice(0, 3).forEach((id, i) => {
        if (id !== this.selectedId) label(id, '#f2c14e', `${['👑', '2nd', '3rd'][i]} ${w.people[id].first} ${U.fmtMoney(w.people[id].nw)}`);
      });
      if (this.hoverId >= 0 && this.hoverId !== this.selectedId) label(this.hoverId, '#9aa5b1', P.name(w.people[this.hoverId]));
      if (this.selectedId >= 0) {
        const sp = this.screenPos.find(q => q.id === this.selectedId);
        if (sp) {
          g.strokeStyle = '#3ec7b5'; g.lineWidth = 2;
          g.beginPath(); g.ellipse(sp.x, sp.y + 7 * this.z, 8 * this.z, 3 * this.z, 0, 0, Math.PI * 2); g.stroke();
          label(this.selectedId, '#3ec7b5', P.name(w.people[this.selectedId]));
        }
      }
    }

    drawShops(g) {
      const w = this.w, T = this.town.T;
      g.textBaseline = 'top';
      for (const id of this.town.shoplots) {
        const b = this.town.buildings[id], X = b.x * T, Y = b.y * T;
        const bizId = w.shoplotOwner[id];
        if (bizId === undefined) {
          rect(g, X + 14, Y + 12, 36, 10, '#e8e4da');
          g.font = `8px ${FONT}`; g.fillStyle = '#7a2e1e'; g.fillText('SEWA', X + 20, Y + 13);
          continue;
        }
        const biz = w.biz[bizId];
        const col = biz.type === 'restaurant' ? '#b23a48' : biz.type === 'workshop' ? '#3d5a80' : biz.type === 'retail' ? '#2a9d8f' : '#6a4c93';
        rect(g, X + 2, Y + 7, 60, 20, col);
        rect(g, X + 2, Y + 7, 60, 1, 'rgba(255,255,255,0.4)');
        g.font = `6px ${FONT}`; g.fillStyle = '#ffffff';
        const lines = wrapText(g, biz.name.toUpperCase(), 57, 3);
        lines.forEach((ln, i) => g.fillText(ln, X + 4, Y + 8 + i * 6.3));
        if (biz.scale > U.RM(biz.typeDef.scale0) * 3) rect(g, X + 58, Y + 2, 4, 4, '#f2c14e');
      }
      const counts = {};
      for (const b of w.biz) if (b.open && w.town.buildings[b.place].kind !== 'shoplot') counts[b.place] = (counts[b.place] || 0) + 1;
      g.font = `8px ${FONT}`;
      for (const k of Object.keys(counts)) {
        const b = this.town.buildings[k];
        const text = `${counts[k]} ${b.kind === 'hawker' ? 'stalls' : 'firms'}`;
        const tw = g.measureText(text).width;
        const x = b.x * T + b.w * T / 2 - tw / 2 - 3, y = b.kind === 'hawker' ? b.y * T + b.h * T - 12 : b.y * T + 12;
        rect(g, x, y, tw + 6, 10, '#f2c14e');
        g.fillStyle = '#20262e';
        g.fillText(text, x + 3, y + 1);
      }
    }

    pick(sx, sy) {
      let best = -1, bd = 14 * 14;
      for (const q of this.screenPos) {
        const d = (q.x - sx) ** 2 + (q.y - sy) ** 2;
        if (d < bd) { bd = d; best = q.id; }
      }
      return best;
    }

    // Building under a screen point (topmost), or -1.
    pickBuilding(sx, sy) {
      const T = this.town.T, wx = this.cx + sx / this.z, wy = this.cy + sy / this.z;
      for (let i = this.town.buildings.length - 1; i >= 0; i--) {
        const b = this.town.buildings[i];
        if (b.kind === 'builtlot') continue;
        if (wx >= b.x * T && wx < (b.x + b.w) * T && wy >= b.y * T && wy < (b.y + b.h) * T) return b.id;
      }
      return -1;
    }
  }

  function wrapText(g, text, maxW, maxLines) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const wd of words) {
      const next = cur ? `${cur} ${wd}` : wd;
      if (g.measureText(next).width <= maxW) cur = next;
      else { if (cur) lines.push(cur); cur = wd; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
    return lines;
  }

  const CAR_COLOURS = ['#e63946', '#457b9d', '#f1faee', '#2a9d8f', '#e9c46a', '#8d99ae', '#264653', '#f4a261'];
  function drawVehicle(g, x, y, dx, dy, mode, p) {
    x = Math.round(x); y = Math.round(y);
    const horiz = dx !== 0 || dy === 0;
    const skin = p.look.skin;
    if (mode === 1) { // motorbike with rider
      if (horiz) {
        rect(g, x - 5, y - 3, 10, 3, '#2b2d42'); rect(g, x - 6, y, 3, 3, '#111'); rect(g, x + 3, y, 3, 3, '#111');
        rect(g, x - 2, y - 8, 4, 5, p.look.shirt); rect(g, x - 2, y - 11, 4, 3, '#e63946');
      } else {
        rect(g, x - 2, y - 6, 4, 10, '#2b2d42'); rect(g, x - 2, y - 8, 4, 2, '#111'); rect(g, x - 2, y + 4, 4, 2, '#111');
        rect(g, x - 3, y - 4, 6, 4, p.look.shirt); rect(g, x - 2, y - 7, 4, 3, '#e63946');
      }
      return;
    }
    const lux = mode === 3;
    const body = lux ? '#14141a' : CAR_COLOURS[p.id % CAR_COLOURS.length];
    if (horiz) {
      rect(g, x - 9, y - 6, 18, 8, 'rgba(0,0,0,0.25)');
      rect(g, x - 9, y - 7, 18, 7, body); rect(g, x - 5, y - 10, 10, 4, body);
      rect(g, x - 4, y - 9, 8, 3, '#9fd3e0'); rect(g, (dx >= 0 ? x + 1 : x - 3), y - 9, 2, 2, skin);
      rect(g, x - 7, y, 4, 2, '#111'); rect(g, x + 3, y, 4, 2, '#111');
      if (lux) rect(g, x - 9, y - 4, 18, 1, '#f2c14e');
    } else {
      rect(g, x - 5, y - 9, 10, 16, 'rgba(0,0,0,0.25)');
      rect(g, x - 5, y - 10, 10, 16, body); rect(g, x - 4, y - 6, 8, 5, '#9fd3e0'); rect(g, x - 1, y - 5, 2, 2, skin);
      if (lux) rect(g, x - 1, y - 10, 2, 16, '#f2c14e');
    }
  }

  function drawBus(g, it) {
    const x = Math.round(it.x), y = Math.round(it.y), c = it.line.colour;
    if (it.horiz) {
      rect(g, x - 15, y - 8, 30, 12, 'rgba(0,0,0,0.25)');
      rect(g, x - 15, y - 11, 30, 12, c); rect(g, x - 15, y - 11, 30, 2, '#ffffff');
      for (let i = 0; i < 6; i++) { rect(g, x - 13 + i * 5, y - 8, 4, 4, '#cfeaf2'); if (i < it.load) rect(g, x - 12 + i * 5, y - 7, 2, 2, '#c68642'); }
      rect(g, x - 11, y + 1, 4, 3, '#111'); rect(g, x + 7, y + 1, 4, 3, '#111');
    } else {
      rect(g, x - 6, y - 14, 12, 30, 'rgba(0,0,0,0.25)');
      rect(g, x - 6, y - 16, 12, 30, c); rect(g, x - 6, y - 16, 12, 2, '#ffffff');
      for (let i = 0; i < 5; i++) { rect(g, x - 4, y - 12 + i * 5, 8, 3, '#cfeaf2'); if (i < it.load) rect(g, x - 1, y - 12 + i * 5, 2, 2, '#c68642'); }
    }
  }

  LES.polyline = function (pts) {
    let total = 0;
    const lens = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y); lens.push(l); total += l; }
    return { pts, lens, total };
  };

  LES.Renderer = Renderer;
})(globalThis.LES = globalThis.LES || {});
