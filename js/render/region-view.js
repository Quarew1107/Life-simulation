// Region view: every town of the region on one map (🗺 Region in the top bar, or scroll
// out past the whole town). Each town is a cached schematic plan (LES.RegionMap) in the
// countryside, joined by the railway and the highway. Live on top: commuters travelling
// the highway, arrows for households that moved in the last year, gang turf in each
// gang's colour (so you can watch a gang spread), flood water, monsoon rain, infections
// in the Pandemic scenario, and a label beside each town. Click a town to open it.
(function (LES) {
  'use strict';
  const RM = LES.RegionMap;
  const LABEL_FONT = '600 12px system-ui, "Segoe UI", sans-serif', SMALL_FONT = '11px system-ui, "Segoe UI", sans-serif';
  const LEGEND_EXTRA = [['#ffffff', 'Households moving', 'arrow'], ['#fff3c4', 'Commuters', 'dot'], ['#e63946', 'Gang turf', 'box']];

  class RegionView {
    constructor(renderer) {
      this.r = renderer;
      this.plans = new WeakMap(); // town -> { key, cv }
      this.L = null; this.bg = null; this.key = '';
      this.cam = { z: 1, ox: 0, oy: 0 };
      this.hover = -1;
    }

    // Layout for this region and the current view shape (row or staircase).
    layout(region) {
      const aspect = this.r.vw / Math.max(1, this.r.vh - 30);
      const key = `${region.base.seed}|${region.towns.map(w => `${w.town.W}x${w.town.H}`).join(',')}|${aspect > 2.2 ? 'w' : 'n'}`;
      if (this.Lfor !== region || this.key !== key) { this.L = RM.layout(region, aspect > 2.2 ? 4 : 1.4); this.Lfor = region; this.key = key; this.bg = null; }
      return this.L;
    }
    plan(w) {
      const key = `${w.townVersion}|${w.town.buildings.length}`, hit = this.plans.get(w.town);
      if (hit && hit.key === key) return hit.cv;
      const S = RM.S, cv = document.createElement('canvas');
      cv.width = w.town.W * S; cv.height = w.town.H * S;
      RM.drawTown(cv.getContext('2d'), w.town, S);
      this.plans.set(w.town, { key, cv });
      return cv;
    }
    // Soft patchwork countryside with plantation rows, the railway and the highway.
    background(region, L) {
      if (this.bg) return this.bg;
      const cv = document.createElement('canvas'), g = cv.getContext('2d'), R = new LES.RNG(`${region.base.seed}|regionfields`);
      cv.width = Math.ceil(L.W); cv.height = Math.ceil(L.H);
      g.fillStyle = '#a9bf8e'; g.fillRect(0, 0, cv.width, cv.height);
      const crops = ['#b3c798', '#a0b884', '#bccb9c', '#9cb27f', '#c2c99a'];
      for (let y = 0; y < cv.height; y += 46) for (let x = 0; x < cv.width; x += 64) {
        g.fillStyle = crops[R.int(0, crops.length - 1)];
        g.fillRect(x + R.int(0, 8), y + R.int(0, 6), 52 + R.int(0, 10), 36 + R.int(0, 8));
        if (R.next() < 0.18) { g.fillStyle = '#86a06c'; for (let k = 0; k < 6; k++) g.fillRect(x + 6 + k * 9, y + 8, 3, 26); } // oil palm rows
      }
      const line = (segs, w0, c0, w1, c1) => {
        for (const [col, wd] of [[c0, w0], [c1, w1]]) { g.fillStyle = col; for (const [x0, y0, x1, y1] of segs) g.fillRect(Math.min(x0, x1) - wd / 2, Math.min(y0, y1) - wd / 2, Math.abs(x1 - x0) + wd, Math.abs(y1 - y0) + wd); }
      };
      line(L.rail, 5, '#5b4636', 2, '#c9c2b5');
      line(L.roads, 10, '#4b4f58', 1.5, '#e9cf6a');
      this.bg = cv;
      return cv;
    }

    fit(L) {
      const r = this.r, pad = 10, z = Math.min((r.vw - 2 * pad) / L.W, (r.vh - 2 * pad) / L.H);
      this.cam = { z, ox: (r.vw - L.W * z) / 2, oy: (r.vh - L.H * z) / 2 };
    }
    toWorld(sx, sy) { const c = this.cam; return { x: (sx - c.ox) / c.z, y: (sy - c.oy) / c.z }; }
    pick(region, sx, sy) { const L = this.layout(region); this.fit(L); const p = this.toWorld(sx, sy); return RM.hit(L, p.x, p.y); }

    draw(app, now) {
      const region = app.region, r = this.r, g = r.ctx, L = this.layout(region), dpr = r.dpr;
      this.fit(L);
      const c = this.cam, S = RM.S, day = Math.max(0, region.lead.lastDay), t = now / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#93ab79'; g.fillRect(0, 0, r.cv.width, r.cv.height);
      g.setTransform(dpr * c.z, 0, 0, dpr * c.z, dpr * c.ox, dpr * c.oy);
      g.imageSmoothingEnabled = true;
      g.drawImage(this.background(region, L), 0, 0);
      for (const b of L.towns) {
        const w = region.towns[b.i], T = w.town;
        g.fillStyle = 'rgba(30,40,25,0.35)'; g.fillRect(b.x + 6, b.y + 6, b.w, b.h); // shadow
        g.drawImage(this.plan(w), b.x, b.y);
        const cell = i => { const bl = T.blocks[i]; return bl ? RM.plot(bl) : null; };
        if (w.gov && w.gov.flood && w.day < w.gov.flood.until) { // flood water
          g.fillStyle = 'rgba(70,130,190,0.6)';
          for (const i of w.gov.flood.blocks) { const p = cell(i); if (p) g.fillRect(b.x + p.x * S, b.y + p.y * S, p.w * S, p.h * S); }
        }
        if (w.crime) for (const gang of w.crime.gangs) { // gang turf in the gang's colour (chapters share it)
          if (!gang.alive) continue;
          for (const i of gang.turf) {
            const p = cell(i); if (!p) continue;
            g.fillStyle = gang.colour + 'cc'; g.fillRect(b.x + p.x * S, b.y + p.y * S, p.w * S, p.h * S);
            g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(b.x + p.x * S + 1, b.y + p.y * S + 1, p.w * S - 2, p.h * S - 2);
          }
        }
        const shown = w === app.world, hov = this.hover === b.i;
        g.lineWidth = shown ? 5 : hov ? 4 : 2;
        g.strokeStyle = shown ? '#f2c14e' : hov ? '#ffffff' : 'rgba(40,50,35,0.7)';
        g.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
      // Commuters on the highway (each dot about one commuter, up to 30 per route).
      region.towns.forEach((w, a) => {
        const by = new Map();
        for (const p of w.living) if (p.alive && p.job && p.job.commuteTo !== undefined) by.set(p.job.commuteTo, (by.get(p.job.commuteTo) || 0) + 1);
        for (const [bb, n] of by) {
          if (!L.towns[bb]) continue;
          const route = RM.route(L, a, bb), back = route.slice().reverse(), k = Math.min(30, n);
          for (let i = 0; i < k; i++) {
            const pt = RM.along(i % 2 ? back : route, (t / 9 + i / k) % 1);
            g.fillStyle = i % 2 ? '#fff3c4' : '#ffffff'; g.fillRect(pt.x - 3, pt.y - 3, 6, 6);
          }
        }
      });
      // Households that moved between towns in the last year: a curved arrow per direction.
      const pairs = new Map();
      for (const m of region.moves) if (day - m.day < 365) { const k = `${m.from}>${m.to}`; pairs.set(k, (pairs.get(k) || 0) + m.n); }
      g.textAlign = 'center';
      for (const [k, n] of pairs) {
        const [a, bb] = k.split('>').map(Number), A = L.towns[a], B = L.towns[bb];
        if (!A || !B) continue;
        const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2, dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const off = (a < bb ? 1 : -1) * 0.18 * len, mx = (ax + bx) / 2 - dy / len * off, my = (ay + by) / 2 + dx / len * off;
        const q = f => ({ x: (1 - f) * (1 - f) * ax + 2 * f * (1 - f) * mx + f * f * bx, y: (1 - f) * (1 - f) * ay + 2 * f * (1 - f) * my + f * f * by });
        const p0 = q(0.25), tip = q(0.78), pre = q(0.72);
        g.strokeStyle = a < bb ? 'rgba(255,255,255,0.9)' : 'rgba(255,233,168,0.95)'; g.lineWidth = Math.min(9, 2 + 1.5 * Math.log2(1 + n));
        g.beginPath(); g.moveTo(p0.x, p0.y);
        for (let f = 0.27; f <= 0.751; f += 0.02) { const p = q(f); g.lineTo(p.x, p.y); }
        g.stroke();
        const ang = Math.atan2(tip.y - pre.y, tip.x - pre.x), hs = 10 + g.lineWidth;
        g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(tip.x + Math.cos(ang) * hs * 0.6, tip.y + Math.sin(ang) * hs * 0.6);
        g.lineTo(tip.x + Math.cos(ang + 2.5) * hs, tip.y + Math.sin(ang + 2.5) * hs); g.lineTo(tip.x + Math.cos(ang - 2.5) * hs, tip.y + Math.sin(ang - 2.5) * hs); g.closePath(); g.fill();
        const lp = q(0.5);
        g.font = `bold ${Math.round(14 / Math.max(0.35, c.z))}px system-ui, sans-serif`; g.fillStyle = '#1d2b1d';
        g.fillText(`${n}`, lp.x, lp.y - 8);
      }
      // Screen space from here: labels, rain and legend stay readable at any scale.
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.textAlign = 'left';
      this.drawLabels(g, app, L);
      const wx = LES.Ambience.weather(day);
      if (wx.id === 'rain') {
        g.strokeStyle = 'rgba(210,225,255,0.35)'; g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i < 160; i++) { const x = ((i * 97 + t * 220) % (r.vw + 60)) - 30, y = ((i * 57 + t * 480) % (r.vh + 40)) - 20; g.moveTo(x, y); g.lineTo(x - 4, y + 11); }
        g.stroke();
      }
      this.drawLegend(g);
    }

    // One label per town, beside it where there is room (right, above, left, below),
    // otherwise inside its top-left corner.
    drawLabels(g, app, L) {
      const region = app.region, c = this.cam, r = this.r, placed = [];
      const scr = b => ({ x: c.ox + b.x * c.z, y: c.oy + b.y * c.z, w: b.w * c.z, h: b.h * c.z });
      const boxes = L.towns.map(scr), hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (const b of L.towns) {
        const w = region.towns[b.i], h = w.history[w.history.length - 1] || {}, sb = boxes[b.i];
        const jobless = h.unemployed !== undefined ? `${(h.unemployed / Math.max(1, h.unemployed + h.employed + h.owners) * 100).toFixed(1)}% jobless` : '';
        const lines = [w.townName, `${w.counts.living} people${jobless ? ` · ${jobless}` : ''}`];
        if (w.crime) {
          const gc = LES.Crime.gangCount(w);
          lines.push(`crime ${Math.round(LES.Crime.rates(w).index)} per 100k${gc.live ? ` · ${gc.live} gang${gc.live > 1 ? 's' : ''}${gc.chapters ? ` (${gc.chapters} chapter${gc.chapters > 1 ? 's' : ''})` : ''}` : ''}`);
        }
        if (w.scn && !w.scn.over && w.scn.infected) lines.push(`🦠 ${w.scn.infected} ill`);
        const lw = Math.max(...lines.map((s, i) => { g.font = i ? SMALL_FONT : LABEL_FONT; return g.measureText(s).width; })) + 16, lh = 8 + lines.length * 15;
        const cands = [{ x: sb.x + sb.w + 10, y: sb.y }, { x: sb.x, y: sb.y - lh - 8 }, { x: sb.x - lw - 10, y: sb.y }, { x: sb.x, y: sb.y + sb.h + 8 }];
        const ok = q => q.x >= 2 && q.y >= 2 && q.x + lw <= r.vw - 2 && q.y + lh <= r.vh - 70 && !boxes.some(o => hits({ x: q.x, y: q.y, w: lw, h: lh }, o)) && !placed.some(o => hits({ x: q.x, y: q.y, w: lw, h: lh }, o));
        const at = cands.find(ok) || { x: sb.x + 4, y: sb.y + 4 };
        placed.push({ x: at.x, y: at.y, w: lw, h: lh });
        g.fillStyle = 'rgba(16,22,28,0.85)'; g.fillRect(at.x, at.y, lw, lh);
        g.fillStyle = w === app.world ? '#f2c14e' : '#3a4654'; g.fillRect(at.x, at.y, 3, lh);
        lines.forEach((s, i) => { g.font = i ? SMALL_FONT : LABEL_FONT; g.fillStyle = i ? '#cfd8e3' : (w === app.world ? '#f2c14e' : '#ffffff'); g.fillText(s, at.x + 9, at.y + 16 + i * 15); });
      }
    }

    // Colour key in the bottom-right corner, in as many columns as fit.
    drawLegend(g) {
      const r = this.r, rows = [...RM.LEGEND.map(([col, label]) => [col, label, 'box']), ...LEGEND_EXTRA];
      g.font = SMALL_FONT;
      const cw = Math.max(...rows.map(x => g.measureText(x[1]).width)) + 26, cols = Math.max(1, Math.min(5, Math.floor((r.vw * 0.62) / cw)));
      const nr = Math.ceil(rows.length / cols), w = cols * cw + 10, h = nr * 15 + 10, x0 = r.vw - w - 8, y0 = r.vh - h - 30;
      g.fillStyle = 'rgba(16,22,28,0.82)'; g.fillRect(x0, y0, w, h);
      rows.forEach(([col, label, kind], i) => {
        const x = x0 + 6 + Math.floor(i / nr) * cw, y = y0 + 6 + (i % nr) * 15;
        g.fillStyle = col;
        if (kind === 'dot') g.fillRect(x + 2, y + 3, 6, 6);
        else if (kind === 'arrow') { g.fillRect(x, y + 5, 8, 2); g.beginPath(); g.moveTo(x + 11, y + 6); g.lineTo(x + 6, y + 2); g.lineTo(x + 6, y + 10); g.fill(); }
        else g.fillRect(x, y + 1, 10, 10);
        g.fillStyle = '#cfd8e3'; g.fillText(label, x + 15, y + 10);
      });
    }
  }
  LES.RegionView = RegionView;
})(globalThis.LES = globalThis.LES || {});
