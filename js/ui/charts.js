// Minimal dependency-free canvas charts (line with optional log scale, horizontal bars).
(function (LES) {
  'use strict';
  const U = LES.U;
  const AXIS = '#8c9aab', GRID = 'rgba(140,154,171,0.14)', FONT = '11px Inter, system-ui, sans-serif';

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 150;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.font = FONT;
    return { g, w, h };
  }

  function niceTicks(min, max, n) {
    const span = max - min || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
    return ticks;
  }

  LES.Charts = {
    // opts: { series:[{label,color,data:[[x,y]],dash}], logY, yFmt, xFmt, bands:[{x0,x1,color}], yMin }
    line(canvas, opts) {
      const { g, w, h } = setup(canvas);
      const pad = { l: 52, r: 10, t: 22, b: 20 };
      const series = opts.series.filter(s => s.data.length);
      if (!series.length) { g.fillStyle = AXIS; g.fillText('No data yet', pad.l, h / 2); return; }
      // Lay the legend out first, wrapping onto extra rows, and make room for it.
      const legend = [];
      let lx = pad.l, ly = 9;
      for (const s of series) {
        if (!s.label) continue;
        const wd = g.measureText(s.label).width + 28;
        if (lx > pad.l && lx + wd > w - pad.r) { lx = pad.l; ly += 14; }
        legend.push({ s, x: lx, y: ly });
        lx += wd;
      }
      pad.t = Math.max(pad.t, ly + 13);
      const tf = opts.logY ? v => Math.log10(Math.max(1, v)) : v => v;
      let xmin = Infinity, xmax = -Infinity, ymin = opts.yMin !== undefined ? tf(opts.yMin) : Infinity, ymax = -Infinity;
      for (const s of series) for (const [x, y] of s.data) {
        if (x < xmin) xmin = x; if (x > xmax) xmax = x;
        const ty = tf(y);
        if (ty < ymin) ymin = ty; if (ty > ymax) ymax = ty;
      }
      if (xmax === xmin) xmax = xmin + 1;
      if (ymax === ymin) ymax = ymin + 1;
      if (opts.logY) { ymin = Math.floor(ymin); ymax = Math.ceil(ymax); }
      else { const padY = (ymax - ymin) * 0.08; ymax += padY; if (opts.yMin === undefined) ymin -= padY; }
      const X = x => pad.l + (x - xmin) / (xmax - xmin) * (w - pad.l - pad.r);
      const Y = y => pad.t + (1 - (tf(y) - ymin) / (ymax - ymin)) * (h - pad.t - pad.b);
      const Yt = t => pad.t + (1 - (t - ymin) / (ymax - ymin)) * (h - pad.t - pad.b);

      for (const b of opts.bands || []) {
        const x0 = Math.max(pad.l, X(b.x0)), x1 = Math.min(w - pad.r, X(b.x1));
        if (x1 > x0) { g.fillStyle = b.color; g.fillRect(x0, pad.t, x1 - x0, h - pad.t - pad.b); }
      }
      g.strokeStyle = GRID; g.fillStyle = AXIS; g.textAlign = 'right'; g.textBaseline = 'middle';
      const yt = opts.logY ? Array.from({ length: ymax - ymin + 1 }, (_, i) => ymin + i) : niceTicks(ymin, ymax, 4);
      const step = Math.max(1, Math.ceil(yt.length / 5));
      yt.forEach((t, i) => {
        if (i % step) return;
        const yy = Math.round(Yt(t)) + 0.5;
        g.beginPath(); g.moveTo(pad.l, yy); g.lineTo(w - pad.r, yy); g.stroke();
        const v = opts.logY ? Math.pow(10, t) : t;
        g.fillText(opts.yFmt ? opts.yFmt(v) : String(Math.round(v)), pad.l - 6, yy);
      });
      g.textAlign = 'center'; g.textBaseline = 'top';
      let prevLabel = null;
      for (const t of niceTicks(xmin, xmax, 4)) {
        const label = opts.xFmt ? opts.xFmt(t) : String(Math.round(t));
        if (label !== prevLabel) g.fillText(label, X(t), h - pad.b + 4);
        prevLabel = label;
      }

      for (const s of series) {
        g.strokeStyle = s.color; g.lineWidth = s.width || 2; g.setLineDash(s.dash || []);
        g.beginPath();
        s.data.forEach(([x, y], i) => { const px = X(x), py = Y(y); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
        g.stroke();
      }
      g.setLineDash([]);
      // legend
      g.textAlign = 'left'; g.textBaseline = 'middle';
      for (const it of legend) {
        g.fillStyle = it.s.color; g.fillRect(it.x, it.y - 2, 10, 3);
        g.fillStyle = '#cbd5df'; g.fillText(it.s.label, it.x + 14, it.y);
      }
    },

    // items: [{label, value, color, note}]
    bars(canvas, items, fmt) {
      const { g, w, h } = setup(canvas);
      const valid = items.filter(i => i.value !== null && Number.isFinite(i.value));
      if (!valid.length) { g.fillStyle = AXIS; g.fillText('No data yet', 10, h / 2); return; }
      const max = Math.max(...valid.map(i => i.value), 1);
      const rowH = Math.min(24, (h - 6) / items.length);
      const lw = Math.min(180, Math.max(60, ...items.map(i => g.measureText(i.label).width)) + 8), rw = 74; // label column fits the longest label
      g.textBaseline = 'middle';
      items.forEach((it, i) => {
        const y = 3 + i * rowH;
        g.fillStyle = '#cbd5df'; g.textAlign = 'left';
        g.fillText(it.label, 0, y + rowH / 2);
        const bw = it.value === null ? 0 : Math.max(2, (w - lw - rw) * Math.max(0, it.value) / max);
        g.fillStyle = '#121920'; g.fillRect(lw, y + 4, w - lw - rw, rowH - 8);
        g.fillStyle = it.color; g.fillRect(lw, y + 4, bw, rowH - 8);
        g.fillStyle = AXIS; g.textAlign = 'right';
        g.fillText(it.value === null ? 'n/a' : (fmt ? fmt(it.value) : String(it.value)), w, y + rowH / 2);
      });
    },
  };
  LES.Charts.niceTicks = niceTicks;
  LES.Charts.fmtAxisMoney = v => U.fmtMoney(v).replace('RM', '');
})(globalThis.LES = globalThis.LES || {});
