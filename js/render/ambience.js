// Living-town ambience (presentation only, never changes the simulation):
// work uniforms, activity bubbles, night window lights and street lamps,
// monsoon rain and haze, Malaysian festivals, smoke, clouds, birds, lanterns.
(function (LES) {
  'use strict';
  const U = LES.U;
  const A = LES.Ambience = {};
  const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };
  const rnd = (n) => hash(n) / 4294967296;

  // ---- Uniforms ----
  const JOB_OUTFIT = { chef: 'chef', doctor: 'medic', nurse: 'medic', construction: 'hardhat', electrician: 'hardhat', rider: 'rider', accountant: 'office', banker: 'office', manager: 'office', sales: 'office', softdev: 'office', engineer: 'office', teacher: 'office' };
  A.outfitFor = function (p, slotAct) {
    if (!slotAct) return null;
    if (slotAct.act === 'WORK' && p.job) return JOB_OUTFIT[p.job.jobId] || null;
    if (slotAct.act === 'SCHOOL') return 'school';
    if (slotAct.act === 'TRAIN' && /Gym|Sports|Running/.test(slotAct.label)) return 'sport';
    if (slotAct.act === 'GIG') return /labour/i.test(slotAct.label) ? 'hardhat' : /delivery/i.test(slotAct.label) ? 'rider' : null;
    return null;
  };

  // ---- Calendar: festivals (lunar ones drift ~11 days earlier each year) ----
  const lunar = (day, baseDoy) => { const y = Math.floor(day / 365); return ((baseDoy - 11 * y) % 365 + 365) % 365; };
  A.festival = function (day) {
    const doy = day % 365;
    const near = (d, span) => { const diff = (doy - d + 365) % 365; return diff < span; };
    if (near(0, 2)) return { id: 'newyear', name: 'New Year' };
    if (near(lunar(day, 100), 3)) return { id: 'raya', name: 'Hari Raya Aidilfitri' };
    if (near(lunar(day, 40), 3)) return { id: 'cny', name: 'Chinese New Year' };
    if (near(lunar(day, 300), 3)) return { id: 'deepavali', name: 'Deepavali' };
    if (near(242, 2)) return { id: 'merdeka', name: 'Hari Merdeka' };
    if (near(358, 2)) return { id: 'christmas', name: 'Christmas' };
    return null;
  };
  // ---- Weather: north-east monsoon (Nov-Feb) is rainy; mid-year can bring haze ----
  A.weather = function (day) {
    const m = U.dayToDate(day).month, r = rnd(day * 31 + 7);
    const monsoon = m >= 10 || m <= 1;
    if (r < (monsoon ? 0.45 : 0.12)) return { id: 'rain', name: monsoon ? 'Monsoon rain' : 'Rain', heavy: monsoon && r < 0.2 };
    if (m >= 5 && m <= 8 && r > 0.9) return { id: 'haze', name: 'Haze' };
    return { id: 'clear', name: 'Clear' };
  };

  // ---- Night lights layer (built once per town version) ----
  A.buildLights = function (town) {
    const T = town.T, cv = document.createElement('canvas');
    cv.width = town.W * T; cv.height = town.H * T;
    const g = cv.getContext('2d');
    for (const b of town.buildings) {
      if (['lot', 'builtlot', 'padi', 'park', 'construction', 'memorial'].includes(b.kind)) continue;
      const X = b.x * T, Y = b.y * T, W = b.w * T, H = b.h * T;
      const n = Math.max(2, Math.floor(W * H / 500));
      for (let i = 0; i < n; i++) {
        if (rnd(b.id * 977 + i) < 0.35) continue;
        const x = X + 4 + rnd(b.id * 131 + i * 7) * (W - 10), y = Y + 8 + rnd(b.id * 71 + i * 13) * (H - 14);
        g.fillStyle = 'rgba(255,214,120,0.9)'; g.fillRect(Math.round(x), Math.round(y), 3, 3);
      }
    }
    // Street lamps along every road
    const glow = (x, y) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, 14);
      gr.addColorStop(0, 'rgba(255,220,140,0.55)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = gr; g.fillRect(x - 14, y - 14, 28, 28);
      g.fillStyle = '#fff3c4'; g.fillRect(x - 1, y - 1, 2, 2);
    };
    for (const ry of town.roadsY) for (let x = 24; x < town.W * T; x += 72) glow(x, ry * T - 2);
    for (const rx of town.roadsX) for (let y = 40; y < town.H * T; y += 72) glow(rx * T - 2, y);
    return cv;
  };

  // ---- Per-frame ambient effects in world coordinates ----
  A.drawWorld = function (r, g, w, t, now, fast) {
    const town = w.town, T = town.T, sec = (now || 0) / 1000;
    // Factory chimney smoke
    for (const id of town.kinds.factory || []) {
      const b = town.buildings[id];
      for (const cx of [b.x * T + 24, b.x * T + 48]) for (let k = 0; k < 4; k++) {
        const ph = (sec * 0.25 + k / 4) % 1;
        g.fillStyle = `rgba(220,220,225,${0.45 * (1 - ph)})`;
        const sz = 4 + ph * 8;
        g.fillRect(Math.round(cx + ph * 10 - sz / 2), Math.round(b.y * T - 12 - ph * 26 - sz / 2), Math.round(sz), Math.round(sz));
      }
    }
    // Lake sparkle
    for (const id of town.kinds.park || []) {
      const b = town.buildings[id], cx = b.x * T + b.w * T / 2, cy = b.y * T + b.h * T / 2 + 10;
      for (let k = 0; k < 6; k++) {
        if (((sec * 2 + k * 0.37) % 1) > 0.5) continue;
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillRect(Math.round(cx - 30 + rnd(id + k) * 60), Math.round(cy - 20 + rnd(id * 3 + k) * 40), 3, 1);
      }
    }
    // Memorial lanterns: one for every founder who has died
    const fallen = w.stats.deaths ? w.people.filter(p => !p.alive && p.gen === 0 && !p.migrant).length : 0;
    for (const id of town.kinds.memorial || []) {
      const b = town.buildings[id], X = b.x * T + 12, Y = b.y * T + 14, cols = Math.floor((b.w * T - 24) / 6);
      for (let i = 0; i < Math.min(fallen, cols * 12); i++) {
        const x = X + (i % cols) * 6, y = Y + Math.floor(i / cols) * 9;
        g.fillStyle = '#b23a48'; g.fillRect(x, y, 3, 4);
        g.fillStyle = '#ffd166'; g.fillRect(x + 1, y + 1, 1, 2);
      }
    }
    if (fast) return;
    // Festival decorations
    const fest = A.festival(w.lastDay < 0 ? 0 : w.lastDay);
    if (fest) {
      const blink = Math.floor(sec * 2) % 2;
      if (fest.id === 'raya') for (const id of town.kinds.kampung || []) { const b = town.buildings[id]; for (let i = 0; i < 6; i++) { g.fillStyle = (i + blink) % 2 ? '#ffb703' : '#fb8500'; g.fillRect(b.x * T + 2 + i * 8, (b.y + b.h) * T + 2, 2, 3); } }
      if (fest.id === 'cny') for (const id of town.shoplots) { const b = town.buildings[id]; for (let i = 0; i < 3; i++) { g.fillStyle = '#d62828'; g.fillRect(b.x * T + 8 + i * 20, b.y * T + 29, 5, 6); g.fillStyle = '#ffd166'; g.fillRect(b.x * T + 10 + i * 20, b.y * T + 35, 1, 3); } }
      if (fest.id === 'deepavali') for (const tier of [1, 2]) for (const id of town.homesByTier[tier]) { const b = town.buildings[id]; for (let i = 0; i < 5; i++) { g.fillStyle = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607'][(i + blink) % 5]; g.fillRect(b.x * T + 4 + i * 6, (b.y + b.h) * T + 3, 3, 3); } }
      if (fest.id === 'christmas') for (const id of town.kinds.mall || []) { // a lit tree outside each mall
        const b = town.buildings[id], x = (b.x + b.w) * T - 14, y = (b.y + b.h) * T - 2;
        g.fillStyle = '#6b4226'; g.fillRect(x + 4, y - 3, 2, 3);
        g.fillStyle = '#2d6a4f'; for (let r = 0; r < 4; r++) g.fillRect(x + 4 - r, y - 6 - (3 - r) * 3, 2 + 2 * r, 3);
        for (let i = 0; i < 4; i++) { g.fillStyle = (i + blink) % 2 ? '#ffd166' : '#e63946'; g.fillRect(x + 2 + (i * 3) % 6, y - 14 + i * 3, 1, 1); }
        g.fillStyle = '#ffd166'; g.fillRect(x + 4, y - 19, 2, 2);
      }
      if (fest.id === 'merdeka') for (const b of town.buildings) { if (!['office', 'school', 'hospital', 'university', 'condo', 'mall'].includes(b.kind)) continue; const x = b.x * T + 3, y = b.y * T - 10; g.fillStyle = '#ddd'; g.fillRect(x, y, 1, 10); for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#d62828'; g.fillRect(x + 1, y + k, 8, 1); } g.fillStyle = '#1d3557'; g.fillRect(x + 1, y, 4, 2); g.fillStyle = '#ffd166'; g.fillRect(x + 2, y, 1, 1); }
    }
    // Birds crossing the sky
    const W = town.W * T, H = town.H * T;
    for (let f = 0; f < 2; f++) {
      const ph = ((sec / 40) + f * 0.5) % 1, bx = -60 + ph * (W + 120), by = H * (0.2 + 0.5 * rnd(f + Math.floor(sec / 40)));
      for (let k = 0; k < 5; k++) {
        const x = Math.round(bx - k * 9), y = Math.round(by + Math.abs(k - 2) * 5), flap = Math.floor(sec * 6 + k) % 2;
        g.fillStyle = '#2b2d42'; g.fillRect(x - 2, y - flap, 2, 1); g.fillRect(x + 1, y - flap, 2, 1); g.fillRect(x, y, 1, 1);
      }
    }
    // Drifting cloud shadows
    for (let c = 0; c < 4; c++) {
      const cx = ((sec * 6 + c * 900) % (W + 600)) - 300, cy = H * rnd(c * 17 + 3);
      g.fillStyle = 'rgba(20,40,30,0.08)';
      g.beginPath(); g.ellipse(cx, cy, 120, 50, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + 70, cy + 15, 80, 35, 0, 0, Math.PI * 2); g.fill();
    }
  };

  // Activity bubble above a person (only when zoomed in).
  A.bubble = function (g, x, y, icon) {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillRect(x - 5, y - 9, 10, 8);
    g.fillRect(x - 1, y - 1, 2, 2);
    g.font = '7px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(icon, x, y - 5);
    g.textAlign = 'left';
  };

  // ---- Screen-space weather and night lights, drawn after the world ----
  A.drawScreen = function (r, g, w, t, now, fast, night) {
    if (fast) return;
    const day = w.lastDay < 0 ? 0 : w.lastDay;
    const wx = A.weather(day), cw = r.cv.width, ch = r.cv.height, sec = (now || 0) / 1000;
    if (night > 0 && r.lights) {
      const s = r.z * r.dpr;
      g.setTransform(s, 0, 0, s, -r.cx * s, -r.cy * s);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.85 * night;
      g.drawImage(r.lights, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (wx.id === 'haze') { g.fillStyle = 'rgba(200,170,120,0.22)'; g.fillRect(0, 0, cw, ch); }
    if (wx.id === 'rain') {
      g.fillStyle = 'rgba(40,60,90,0.12)'; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = 'rgba(200,220,255,0.35)'; g.lineWidth = 1;
      g.beginPath();
      const n = wx.heavy ? 260 : 120;
      for (let i = 0; i < n; i++) {
        const x = (rnd(i * 13) * cw + sec * 60) % cw, y = (rnd(i * 29 + 1) * ch + sec * 700 * (0.7 + rnd(i))) % ch;
        g.moveTo(x, y); g.lineTo(x - 3, y + 10);
      }
      g.stroke();
    }
    // New Year / Merdeka night fireworks
    const fest = A.festival(day);
    if (fest && (fest.id === 'newyear' || fest.id === 'merdeka') && night > 0.5) {
      for (let k = 0; k < 3; k++) {
        const ph = (sec * 0.6 + k / 3) % 1, cx = cw * (0.2 + 0.3 * k), cy = ch * (0.25 + 0.1 * k);
        const col = ['#ff006e', '#ffbe0b', '#3a86ff'][k];
        for (let a = 0; a < 12; a++) {
          const ang = a / 12 * Math.PI * 2, rr = ph * 60 * r.dpr;
          g.fillStyle = col; g.globalAlpha = 1 - ph;
          g.fillRect(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 3, 3);
        }
        g.globalAlpha = 1;
      }
    }
  };
})(globalThis.LES = globalThis.LES || {});
