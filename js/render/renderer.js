// Canvas renderer for the pixel town. The static map (ground, roads, buildings)
// is drawn once to an offscreen canvas; people, shop signs and day/night are drawn
// every frame. Rendering only reads world state, it never changes it.
(function (LES) {
  'use strict';
  const C = LES.C, P = LES.P, U = LES.U;

  // Visual day timeline: [t, clock hour]. People: home -> slot A -> slot B -> home.
  const KEYS = [[0, 6], [0.06, 7], [0.14, 8], [0.48, 15.2], [0.54, 15.67], [0.84, 22.4], [0.92, 23], [1, 30]];
  LES.clockAt = function (t) {
    for (let i = 1; i < KEYS.length; i++) {
      if (t <= KEYS[i][0]) {
        const [t0, h0] = KEYS[i - 1], [t1, h1] = KEYS[i];
        const h = (h0 + (h1 - h0) * (t - t0) / (t1 - t0)) % 24;
        const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
    }
    return '06:00';
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
        sign(g, 'MAMAK 24J', X + W / 2, Y + 12, '#1f6b40');
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
        const col = SHOP_COLOURS[b.id % SHOP_COLOURS.length];
        rect(g, X + 3, Y + 3, W - 1, H - 1, 'rgba(30,40,20,0.25)');
        rect(g, X, Y, W - 1, 6, '#a0522d');
        rect(g, X, Y + 6, W - 1, 20, col);
        rect(g, X + 4, Y + 10, 8, 10, '#ffffff'); rect(g, X + 18, Y + 10, 8, 10, '#ffffff');
        rect(g, X + 5, Y + 11, 6, 8, '#8cc6de'); rect(g, X + 19, Y + 11, 6, 8, '#8cc6de');
        rect(g, X, Y + 26, W - 1, H - 26, '#5b4a3f');
        rect(g, X + 2, Y + 30, W - 5, H - 32, '#3a2f28');
        rect(g, X, Y + 26, 2, H - 26, '#d9cfc0');
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
      for (let i = 0; i < 2600; i++) rect(g, R.int(0, W), R.int(0, H), 2, 1, R.next() < 0.5 ? '#79a955' : '#93c46b');

      // Roads with sidewalks and lane markings
      for (const ry of town.roadsY) {
        rect(g, 0, ry * T - 4, W, 2 * T + 8, '#cfc6b0');
        rect(g, 0, ry * T, W, 2 * T, '#4b4f58');
      }
      for (const rx of town.roadsX) {
        rect(g, rx * T - 4, 0, 2 * T + 8, H, '#cfc6b0');
        rect(g, rx * T, 0, 2 * T, H, '#4b4f58');
      }
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
      for (const b of town.buildings) for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y - 1; y <= b.y + b.h + 1; y++) mark(x, y);

      for (const b of town.buildings) drawBuilding(g, b, R);
      for (let y = 0; y < town.H; y++) for (let x = 0; x < town.W; x++) {
        if (busy[y * town.W + x] || R.next() > 0.35) continue;
        tree(g, x * T + R.int(0, 6), y * T + R.int(0, 4), x < 15 || R.next() < 0.3);
      }
      this.bg = cv;
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

    route(p, fromB, toB) {
      const a = this.spot(fromB, p.id), b = this.spot(toB, p.id);
      if (fromB === toB) return { pts: [a, b], total: 0 };
      const tb = this.town.buildings;
      const mid = LES.townPath(this.town, tb[fromB] || tb[0], tb[toB] || tb[0]);
      const lane = ((p.id % 5) - 2) * 2;
      const pts = [a, ...mid.slice(1, -1).map(q => ({ x: q.x + lane, y: q.y + lane })), b];
      let total = 0;
      const lens = [];
      for (let i = 1; i < pts.length; i++) { const l = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y); lens.push(l); total += l; }
      return { pts, lens, total };
    }
    along(r, f) {
      if (!r.total) return r.pts[r.pts.length - 1];
      let d = U.clamp(f, 0, 1) * r.total;
      for (let i = 0; i < r.lens.length; i++) {
        if (d <= r.lens[i]) {
          const a = r.pts[i], b = r.pts[i + 1], k = r.lens[i] ? d / r.lens[i] : 1;
          return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        }
        d -= r.lens[i];
      }
      return r.pts[r.pts.length - 1];
    }

    // Position of a person at visual time t (0..1 of the simulated day).
    posOf(p, t, fast) {
      const home = p.homeId >= 0 ? p.homeId : this.town.byKind.welfare;
      const plan = p.plan;
      if (!plan || !plan.length) return { ...this.spot(home, p.id), hidden: t < 0.06 || t > 0.92, moving: false };
      const A = plan[0].loc >= 0 ? plan[0].loc : home;
      const B = plan[1] && plan[1].loc >= 0 ? plan[1].loc : A;
      if (fast) return { ...this.spot(t < 0.5 ? A : B, p.id), moving: false };
      let an = this.anim.get(p.id);
      if (!an || an.day !== this.w.lastDay || an.A !== A || an.B !== B || an.H !== home) {
        an = { day: this.w.lastDay, A, B, H: home, r1: this.route(p, home, A), r2: this.route(p, A, B), r3: this.route(p, B, home) };
        this.anim.set(p.id, an);
      }
      if (t < 0.06) return { ...this.spot(home, p.id), hidden: true };
      if (t < 0.14) return { ...this.along(an.r1, (t - 0.06) / 0.08), moving: an.r1.total > 0 };
      if (t < 0.48) return { ...this.spot(A, p.id), moving: false };
      if (t < 0.54) return { ...this.along(an.r2, (t - 0.48) / 0.06), moving: an.r2.total > 0 };
      if (t < 0.84) return { ...this.spot(B, p.id), moving: false };
      if (t < 0.92) return { ...this.along(an.r3, (t - 0.84) / 0.08), moving: an.r3.total > 0 };
      return { ...this.spot(home, p.id), hidden: true };
    }

    frame(t, fast, now) {
      const g = this.ctx, w = this.w;
      if (!w || !this.bg) return;
      if (this.follow && this.selectedId >= 0) {
        const p = w.people[this.selectedId];
        if (p && p.alive) { const pos = this.posOf(p, t, fast); this.centerOn(pos.x, pos.y, 0.15); }
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#5f8a45';
      g.fillRect(0, 0, this.cv.width, this.cv.height);
      const s = this.z * this.dpr;
      g.setTransform(s, 0, 0, s, -this.cx * s, -this.cy * s);
      g.imageSmoothingEnabled = false;
      g.drawImage(this.bg, 0, 0);
      this.drawShops(g);

      // People, sorted by y for depth
      const list = [];
      const walkFrame = Math.floor((now || 0) / 180) % 2;
      for (const p of w.living) {
        if (!p.alive) continue;
        const pos = this.posOf(p, t, fast);
        if (pos.hidden && p.id !== this.selectedId) continue;
        list.push({ p, x: pos.x, y: pos.y, moving: pos.moving });
      }
      list.sort((a, b) => a.y - b.y);
      this.screenPos = [];
      const millionaire = U.RM(1e6);
      for (const it of list) {
        const p = it.p, age = P.age(w, p);
        const group = age < 3 ? 'baby' : !p.adult ? 'child' : age >= 65 ? 'elder' : 'adult';
        const spr = LES.Sprites.person(p.look, group, it.moving ? walkFrame : 0);
        const x = Math.round(it.x - spr.width / 2), y = Math.round(it.y - spr.height);
        g.drawImage(spr, x, y);
        if (p.nw >= millionaire) { rect(g, x + spr.width / 2 - 1, y - 3, 3, 2, '#f2c14e'); }
        this.screenPos.push({ id: p.id, x: (it.x - this.cx) * this.z, y: (it.y - spr.height / 2 - this.cy) * this.z });
      }

      // Night tint
      if (!fast) {
        const night = t > 0.86 ? Math.min(1, (t - 0.86) / 0.06) : t < 0.06 ? 1 - t / 0.06 : 0;
        if (night > 0) {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.fillStyle = `rgba(12,20,52,${0.38 * night})`;
          g.fillRect(0, 0, this.cv.width, this.cv.height);
        }
      }

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
      g.font = `8px ${FONT}`;
      g.textBaseline = 'top';
      for (const id of this.town.shoplots) {
        const b = this.town.buildings[id], X = b.x * T, Y = b.y * T;
        const bizId = w.shoplotOwner[id];
        if (bizId === undefined) { rect(g, X + 4, Y + 32, 22, 8, '#e8e4da'); g.fillStyle = '#7a2e1e'; g.fillText('SEWA', X + 6, Y + 32); continue; }
        const biz = w.biz[bizId];
        const word = biz.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 5);
        rect(g, X + 1, Y + 26, 29, 9, biz.type === 'restaurant' ? '#b23a48' : biz.type === 'workshop' ? '#3d5a80' : '#2a9d8f');
        g.fillStyle = '#ffffff';
        g.fillText(word, X + 3, Y + 27);
        if (biz.scale > U.RM(biz.typeDef.scale0) * 3) rect(g, X + 26, Y + 1, 4, 4, '#f2c14e');
      }
      const counts = {};
      for (const b of w.biz) if (b.open && !w.town.buildings[b.place].unit && w.town.buildings[b.place].kind !== 'shoplot') counts[b.place] = (counts[b.place] || 0) + 1;
      for (const k of Object.keys(counts)) {
        const b = this.town.buildings[k];
        const kind = b.kind === 'hawker' ? 'stalls' : 'firms';
        const text = `${counts[k]} ${kind}`;
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
  }

  LES.Renderer = Renderer;
})(globalThis.LES = globalThis.LES || {});
