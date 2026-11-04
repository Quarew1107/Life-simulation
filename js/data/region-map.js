// Region overview map: where the towns sit in the countryside, the railway and the
// highway between them, and a small "schematic" plan of each town (roads and blocks
// coloured by district, rivers, coast and scenery). Pure code: it draws through any
// object with the canvas fillRect/fillStyle API, so the tests can run it without a
// browser. The live drawing (labels, flows, gangs, weather) is in js/render/region-view.js.
// Visual only: it never touches the simulation's random streams.
(function (LES) {
  'use strict';
  const BW = 14, BH = 11, ROAD = 2;
  const RM = LES.RegionMap = {};
  RM.S = 2;           // region pixels per town tile
  const GAP = 90, VGAP = 70, MARGIN = 60, TOP = 110;

  // Colours of each district code (see the code list at the top of town.js).
  const COL = {
    K: '#c99a5b', A: '#c99a5b', F: '#e07a5f', R: '#e07a5f', T: '#f2cc8f', C: '#9fd3d6', B: '#cdb4db',
    O: '#4a78a8', H: '#4a78a8', X: '#4a78a8', S: '#f4a261', M: '#f4a261', D: '#f4a261', V: '#f4a261', Y: '#f4a261',
    I: '#9aa3b0', W: '#9aa3b0', U: '#b5838d', E: '#b5838d', e: '#b5838d', Q: '#ef6f8b', h: '#ef6f8b',
    P: '#5fb36b', Z: '#7cbd3c', J: '#ffd166', g: '#ffd166', j: '#7b6aa0', G: '#b8bec6', N: '#2f4858',
    k: '#4ea8de', m: '#7f9f5f', f: '#2d6a4f',
  };
  const WILD = { forest: '#3d7a46', palm: '#5d8f3a', scrub: '#a7b56a' };
  RM.colour = block => (block.code === 'L' ? (block.wild && WILD[block.wild]) || '#a9c47f' : COL[block.code] || '#b8bec6');
  // Legend rows for the overview (colour, label).
  RM.LEGEND = [
    ['#c99a5b', 'Kampung'], ['#e07a5f', 'Flats'], ['#f2cc8f', 'Terrace'], ['#9fd3d6', 'Condo'], ['#cdb4db', 'Bungalow'],
    ['#4a78a8', 'Town centre'], ['#f4a261', 'Shops, food & leisure'], ['#9aa3b0', 'Industry'], ['#b5838d', 'Schools & college'],
    ['#ef6f8b', 'Health'], ['#5fb36b', 'Parks'], ['#4ea8de', 'Water'],
  ];

  // Where each town sits, in one of two arrangements (whichever is drawn bigger in a view
  // of the given width/height ratio): a row, or a staircase where each town is below and
  // to the right of the one before. The railway runs to each town's station (stations are
  // on the west edge) and the highway joins the towns in order. Lines are lists of
  // segments [x0, y0, x1, y1]; RM.route gives the road between any two towns.
  RM.layout = function (region, aspect) {
    const S = RM.S, R = new LES.RNG(`${region.base.seed}|regionmap`);
    const sizes = region.towns.map(w => ({ w: w.town.W * S, h: w.town.H * S })), jit = region.towns.map(() => R.int(0, 50));
    const station = (w, x, y) => { const t = w.town, st = t.buildings[t.byKind.station]; return st ? { x: x + st.x * S, y: y + (st.y + st.h / 2) * S } : { x, y: y + 10 }; };
    const box = (w, i, x, y) => ({ i, x, y, w: sizes[i].w, h: sizes[i].h, station: station(w, x, y), cx: x + sizes[i].w / 2 });
    const opts = [];
    { // row
      const maxH = Math.max(...sizes.map(s => s.h));
      let x = MARGIN;
      const towns = region.towns.map((w, i) => { const b = box(w, i, x, TOP + (maxH - sizes[i].h) / 2 + jit[i]); x += sizes[i].w + GAP; return b; });
      const railY = Math.min(...towns.map(b => b.y)) - 28, hwY = Math.max(...towns.map(b => b.y + b.h)) + 34, W = x - GAP + MARGIN;
      const rail = [[0, railY, W, railY]], roads = [[towns[0].cx, hwY, towns[towns.length - 1].cx, hwY]];
      for (const b of towns) { rail.push([b.x - 16, railY, b.x - 16, b.station.y], [b.x - 16, b.station.y, b.station.x, b.station.y]); roads.push([b.cx, b.y + b.h, b.cx, hwY]); }
      opts.push({ mode: 'row', S, towns, W, H: hwY + 70, rail, roads, hwY });
    }
    { // staircase
      let x = MARGIN + 40, y = TOP - 60;
      const towns = region.towns.map((w, i) => { const b = box(w, i, x + jit[i], y); x += sizes[i].w * 0.55; y += sizes[i].h + VGAP; return b; });
      const W = Math.max(...towns.map(b => b.x + b.w)) + MARGIN + 160, H = y - VGAP + 70, trunk = MARGIN - 10;
      const mid = i => (towns[i].y + towns[i].h + towns[i + 1].y) / 2, rail = [[trunk, towns[0].station.y, trunk, towns[towns.length - 1].station.y]], roads = [];
      for (const b of towns) rail.push([trunk, b.station.y, b.station.x, b.station.y]);
      for (let i = 0; i + 1 < towns.length; i++) { const a = towns[i], b = towns[i + 1], m = mid(i); roads.push([a.cx, a.y + a.h, a.cx, m], [a.cx, m, b.cx, m], [b.cx, m, b.cx, b.y]); }
      if (towns.length === 3) { const by = towns[1].x + towns[1].w + 24; roads.push([towns[1].cx, mid(0), by, mid(0)], [by, mid(0), by, mid(1)], [by, mid(1), towns[2].cx, mid(1)]); }
      opts.push({ mode: 'stair', S, towns, W, H, rail, roads, mid: towns.slice(0, -1).map((_, i) => mid(i)) });
    }
    const a = aspect || 1.5, scale = L => Math.min(a / L.W, 1 / L.H);
    return opts.sort((p, q) => scale(q) - scale(p))[0];
  };
  // Which town is at a point of the region map (-1 for countryside).
  RM.hit = function (L, x, y) {
    for (const b of L.towns) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b.i;
    return -1;
  };
  // Road from town a to town b along the highway (never through a third town).
  RM.route = function (L, a, b) {
    if (a > b) return RM.route(L, b, a).reverse();
    const T = L.towns, A = T[a], B = T[b];
    if (L.mode === 'row') return [{ x: A.cx, y: A.y + A.h }, { x: A.cx, y: L.hwY }, { x: B.cx, y: L.hwY }, { x: B.cx, y: B.y + B.h }];
    const pts = [{ x: A.cx, y: A.y + A.h }, { x: A.cx, y: L.mid[a] }];
    if (b - a === 2) { const by = T[a + 1].x + T[a + 1].w + 24; pts.push({ x: by, y: L.mid[a] }, { x: by, y: L.mid[a + 1] }); }
    pts.push({ x: B.cx, y: L.mid[b - 1] }, { x: B.cx, y: B.y });
    return pts;
  };
  // Point a fraction f (0-1) of the way along a polyline.
  RM.along = function (pts, f) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let d = f * total;
    for (let i = 1; i < pts.length; i++) {
      const s = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (d <= s || i === pts.length - 1) { const k = s ? Math.min(1, d / s) : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k }; }
      d -= s;
    }
    return pts[pts.length - 1];
  };
  // The plot of a block in tiles (varied towns have bigger plots than the 14x11 grid).
  RM.plot = b => (b.px !== undefined ? { x: b.px, y: b.py, w: b.pw, h: b.ph } : { x: b.x, y: b.y, w: BW, h: BH });

  // A small plan of one town at S pixels per tile, drawn into g (a 2D context).
  RM.drawTown = function (g, town, S) {
    const L = town.layout, W = town.W, H = town.H;
    g.fillStyle = '#86b25c'; g.fillRect(0, 0, W * S, H * S);
    if (L && L.edge && L.edge.size) { // coast or forested hills along one side
      const e = L.edge, sea = e.kind === 'sea';
      g.fillStyle = sea ? '#4ea8de' : '#4f7a45';
      if (e.side === 'e') g.fillRect((W - e.size) * S, 0, e.size * S, H * S); else g.fillRect(0, (H - e.size) * S, W * S, e.size * S);
      if (sea) { g.fillStyle = '#e9d8a6'; if (e.side === 'e') g.fillRect((W - e.size) * S, 0, 2 * S, H * S); else g.fillRect(0, (H - e.size) * S, W * S, 2 * S); }
    }
    for (const b of town.blocks) { const p = RM.plot(b); g.fillStyle = RM.colour(b); g.fillRect(p.x * S, p.y * S, p.w * S, p.h * S); }
    // Buildings as darker marks so districts have texture.
    g.fillStyle = 'rgba(30,30,40,0.22)';
    for (const b of town.buildings) {
      if (b.scenery || b.decor || (b.kind === 'lot' && !b.built)) continue;
      g.fillRect(b.x * S, b.y * S, Math.max(1, b.w * S - 1), Math.max(1, b.h * S - 1));
    }
    // Roads (only the pieces that exist in varied towns) and the river.
    const colX = c => (L ? town.colX[c] : c * (BW + ROAD)), rowY = r => (L ? town.rowY[r] : r * (BH + ROAD));
    g.fillStyle = '#55595f';
    for (let j = 0; j < town.roadsY.length; j++) for (let c = 0; c < town.cols; c++) {
      if (!LES.hasH(town, j, c)) continue;
      const x0 = c === 0 ? 0 : colX(c), x1 = c + 1 < town.cols ? colX(c + 1) : W - (L && L.edge && L.edge.side === 'e' ? L.edge.size : 0);
      g.fillRect(x0 * S, town.roadsY[j] * S, (x1 - x0) * S, ROAD * S);
    }
    for (let c = 0; c < town.roadsX.length; c++) for (let r = 0; r < town.rows; r++) {
      if (!LES.hasV(town, c, r)) continue;
      const y0 = r === 0 ? 0 : rowY(r), y1 = r + 1 < town.rows ? rowY(r + 1) : H - (L && L.edge && L.edge.side === 's' ? L.edge.size : 0);
      g.fillRect(town.roadsX[c] * S, y0 * S, ROAD * S, (y1 - y0) * S);
    }
    if (L && L.river >= 0) {
      const x0 = town.colX[L.river] + BW + L.padX[L.river];
      g.fillStyle = '#4ea8de'; g.fillRect(x0 * S, 0, 5 * S, H * S);
    }
  };
})(globalThis.LES = globalThis.LES || {});
