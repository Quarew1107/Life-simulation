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
    if (slotAct.act === 'PRISON') return slotAct.sub === 'prison' ? 'prisoner' : null;
    if (slotAct.act === 'WORSHIP') return p.rel === 'islam' ? (p.sex === 'M' ? 'bajuMelayu' : 'kurung') : p.rel === 'hinduism' ? (p.sex === 'F' ? 'saree' : 'kurta') : p.rel === 'christianity' ? 'office' : null;
    if (slotAct.act === 'TRAIN' && /Gym|Sports|Running/.test(slotAct.label)) return 'sport';
    if (slotAct.act === 'GIG') return /labour/i.test(slotAct.label) ? 'hardhat' : /delivery/i.test(slotAct.label) ? 'rider' : null;
    return null;
  };

  const fcache = { day: -1, f: null };
  // The country's look (pack.art); Malaysia uses the defaults below.
  const ART = () => LES.Countries.pack.art || {};
  const OUTFITS = [['raya', { eth: 'malay' }, 'bajuMelayu', 'kurung'], ['deepavali', { eth: 'indian' }, 'kurta', 'saree'], ['cny', { eth: 'chinese' }, 'cny', 'cny'],
    ['gawai', { eth: 'bumi' }, 'gawai', 'gawai'], ['christmas', { rel: 'christianity' }, 'office', 'office']];
  const FLAG = { stripes: ['#ffffff', '#d62828'], canton: '#1d3557', star: '#ffd166' }; // Jalur Gemilang colours
  const DECOR = { raya: 'homeLights', cny: 'lanterns', deepavali: 'diyas', christmas: 'mallTree', merdeka: 'flags' };
  // Sunrise and sunset (hours): Malaysia near the equator barely changes; packs with a latitude get
  // the real day length, and summer time (an hour later) between the given days of the year.
  A.sun = function (day) {
    const a = ART();
    if (!a.latitude) return { rise: 6.5, set: 19.75 };
    const doy = ((day % 365) + 365) % 365, rad = Math.PI / 180;
    const decl = 23.44 * Math.sin(2 * Math.PI * (doy - 80) / 365) * rad, cosH = U.clamp(-Math.tan(a.latitude * rad) * Math.tan(decl), -1, 1);
    const half = Math.acos(cosH) / rad / 15, noon = 12 + (a.summerTime && doy >= a.summerTime[0] && doy < a.summerTime[1] ? 1 : 0);
    return { rise: noon - half, set: noon + half };
  };
  // The season trees show (null in the tropics).
  A.season = function (day) {
    if (!ART().seasons) return null;
    const m = U.dayToDate(day).month;
    return m <= 1 || m === 11 ? 'winter' : m <= 3 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
  };
  // Festival clothes on the big days (only for the communities that celebrate them).
  A.festivalOutfit = function (p, day) {
    if (!p.adult) return null;
    if (fcache.day !== day) { fcache.day = day; fcache.f = A.festival(day); } // once per day, not per person
    const f = fcache.f;
    if (!f) return null;
    for (const o of ART().outfits || OUTFITS) { // [festival, { eth | rel }, outfit for men, for women]
      if (o[0] !== f.id || (o[1].eth && p.eth !== o[1].eth) || (o[1].rel && p.rel !== o[1].rel)) continue;
      return p.sex === 'M' ? o[2] : o[3];
    }
    return null;
  };

  // ---- Calendar: festivals (lunar ones drift ~11 days earlier each year) ----
  A.festival = day => LES.Calendar.festival(day); // shared calendar (core/util.js)
  // ---- Weather: north-east monsoon (Nov-Feb) is rainy; mid-year can bring haze ----
  A.weather = function (day) {
    const gw = globalThis.LES_APP && LES_APP.world;
    const HZ = (LES.Countries.pack.events || {}).haze, aw = ART().weather;
    if (gw && gw.gov && gw.gov.haze && HZ && day < gw.gov.haze.until && day >= gw.gov.haze.until - HZ.days) return ART().hazeSky || { id: 'haze', name: 'Haze (unhealthy air)' };
    const m = U.dayToDate(day).month, r = rnd(day * 31 + 7);
    if (aw) { // a country's own weather: rain chance by month, snow in winter
      if (aw.snow && aw.snow.months.includes(m) && r < aw.snow.chance) return { id: 'snow', name: 'Snow' };
      if (r < aw.rain[m]) return { id: 'rain', name: r < aw.heavy ? 'Heavy rain' : 'Rain', heavy: r < aw.heavy };
      return { id: 'clear', name: m >= 5 && m <= 7 && r > 0.85 ? 'Sunny' : 'Clear' };
    }
    const monsoon = m >= 10 || m <= 1;
    if (r < (monsoon ? 0.45 : 0.12)) return { id: 'rain', name: monsoon ? 'Monsoon rain' : 'Rain', heavy: monsoon && r < 0.2 };
    if (m >= 5 && m <= 8 && r > 0.9) return { id: 'haze', name: 'Haze' };
    return { id: 'clear', name: 'Clear' };
  };

  // ---- Night lights layer (built once per town version) ----
  // Night lights for an area of the map (world pixels; g is already translated): lit
  // windows (a stable share of the real windows the art painted, chosen by position so
  // neighbouring tiles agree) and street lamps along every road.
  A.paintLights = function (g, town, rects, x0, y0, w, h) {
    const x1 = x0 + w, y1 = y0 + h, inside = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
    for (const r of rects || []) {
      if (!inside(r.x, r.y, 20)) continue;
      const k = Math.round(r.x) * 7919 + Math.round(r.y) * 104729;
      if (rnd(k * 977 + 13) >= r.lit) continue;
      g.fillStyle = r.c || (rnd(k * 31 + 5) < 0.75 ? 'rgba(255,214,120,0.95)' : 'rgba(190,225,255,0.85)');
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = 'rgba(255,200,110,0.18)';
      g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    }
    const glow = (x, y) => {
      if (!inside(x, y, 16)) return;
      const gr = g.createRadialGradient(x, y, 0, x, y, 14);
      gr.addColorStop(0, 'rgba(255,220,140,0.55)'); gr.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = gr; g.fillRect(x - 14, y - 14, 28, 28);
      g.fillStyle = '#fff3c4'; g.fillRect(x - 1, y - 1, 2, 2);
    };
    for (const p of LES.roadPieces(town).pieces) {
      if (p.h) { if (p.y < y0 - 20 || p.y > y1 + 20) continue; for (let x = p.x + 24; x < p.x + p.w; x += 72) glow(x, p.y - 2); }
      else { if (p.x < x0 - 20 || p.x > x1 + 20) continue; for (let y = p.y + 40; y < p.y + p.h2; y += 72) glow(p.x - 2, y); }
    }
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
      const deco = (ART().decor || DECOR)[fest.id];
      if (deco === 'homeLights') for (const id of town.kinds.kampung || []) { const b = town.buildings[id]; for (let i = 0; i < 6; i++) { g.fillStyle = (i + blink) % 2 ? '#ffb703' : '#fb8500'; g.fillRect(b.x * T + 2 + i * 8, (b.y + b.h) * T + 2, 2, 3); } }
      if (deco === 'lanterns') for (const id of town.shoplots) { const b = town.buildings[id]; for (let i = 0; i < 3; i++) { g.fillStyle = '#d62828'; g.fillRect(b.x * T + 8 + i * 20, b.y * T + 29, 5, 6); g.fillStyle = '#ffd166'; g.fillRect(b.x * T + 10 + i * 20, b.y * T + 35, 1, 3); } }
      if (deco === 'pumpkins') for (const tier of [0, 1, 2]) for (const id of town.homesByTier[tier] || []) { const b = town.buildings[id]; for (let i = 0; i < 2; i++) { const x = b.x * T + 6 + i * 9, y = (b.y + b.h) * T - 6; g.fillStyle = '#f77f00'; g.fillRect(x, y, 4, 3); g.fillStyle = '#386641'; g.fillRect(x + 1, y - 1, 1, 1); if (blink) { g.fillStyle = '#ffd166'; g.fillRect(x + 1, y + 1, 1, 1); } } }
      if (deco === 'diyas') for (const tier of [1, 2]) for (const id of town.homesByTier[tier]) { const b = town.buildings[id]; for (let i = 0; i < 5; i++) { g.fillStyle = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607'][(i + blink) % 5]; g.fillRect(b.x * T + 4 + i * 6, (b.y + b.h) * T + 3, 3, 3); } }
      if (deco === 'mallTree') for (const id of town.kinds.mall || []) { // a lit tree outside each mall
        const b = town.buildings[id], x = (b.x + b.w) * T - 14, y = (b.y + b.h) * T - 2;
        g.fillStyle = '#6b4226'; g.fillRect(x + 4, y - 3, 2, 3);
        g.fillStyle = '#2d6a4f'; for (let r = 0; r < 4; r++) g.fillRect(x + 4 - r, y - 6 - (3 - r) * 3, 2 + 2 * r, 3);
        for (let i = 0; i < 4; i++) { g.fillStyle = (i + blink) % 2 ? '#ffd166' : '#e63946'; g.fillRect(x + 2 + (i * 3) % 6, y - 14 + i * 3, 1, 1); }
        g.fillStyle = '#ffd166'; g.fillRect(x + 4, y - 19, 2, 2);
      }
      if (deco === 'flags') for (const b of town.buildings) { if (!['office', 'school', 'hospital', 'university', 'condo', 'mall'].includes(b.kind)) continue; const x = b.x * T + 3, y = b.y * T - 10; g.fillStyle = '#ddd'; g.fillRect(x, y, 1, 10); const FG = ART().flag || FLAG; for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? FG.stripes[0] : FG.stripes[1]; g.fillRect(x + 1, y + k, 8, 1); } g.fillStyle = FG.canton; g.fillRect(x + 1, y, 4, 2); g.fillStyle = FG.star; g.fillRect(x + 2, y, 1, 1); }
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
    if (night > 0 && r.tiles) {
      const s = r.z * r.dpr;
      g.setTransform(s, 0, 0, s, -r.cx * s, -r.cy * s);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.85 * night;
      r.tiles.drawLights(g, r.cx, r.cy, r.vw / r.z, r.vh / r.z, r.z);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (wx.id === 'haze') { g.fillStyle = 'rgba(200,170,120,0.22)'; g.fillRect(0, 0, cw, ch); }
    if (wx.id === 'heat') { g.fillStyle = 'rgba(255,190,90,0.14)'; g.fillRect(0, 0, cw, ch); } // heatwave glare
    if (wx.id === 'snow') { // slow flakes and a pale sky
      g.fillStyle = 'rgba(220,230,245,0.16)'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 160; i++) {
        const x = (rnd(i * 17) * cw + Math.sin(sec + i) * 12 + sec * 10) % cw, y = (rnd(i * 31 + 5) * ch + sec * 40 * (0.6 + rnd(i))) % ch;
        g.fillRect(x, y, 2, 2);
      }
    }
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
    if (fest && (ART().fireworks || ['newyear', 'merdeka']).includes(fest.id) && night > 0.5) {
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
