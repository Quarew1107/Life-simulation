// The town's pre-drawn map, cut into 512 px tiles. Only tiles near the screen are
// painted, a few at a time between frames, and kept in a cache of about 160 MB (least
// recently used dropped first), so even a Metropolis no longer holds one 300 MB image.
// A quarter-size picture of the whole town (the overview, about 20 MB for a Metropolis
// with its night lights) is painted directly at that scale, a piece at a time; it is
// drawn when zoomed out and fills any tile not painted yet. Until a piece of it is ready,
// the town's schematic plan (LES.RegionMap) stands in.
// When the town changes (a new estate, a renamed tower), only the tiles that the changed
// buildings touch are painted again. Presentation only.
(function (LES) {
  'use strict';
  const TILE = 512, OV = 4, MARGIN = 40;
  const BYTES = TILE * TILE * 4 * 2; // a tile and its night-light layer
  const FONT = '"Silkscreen", "Press Start 2P", monospace';

  // Off-screen map canvases are painted on the CPU (willReadFrequently keeps them out of
  // the GPU): they are thousands of small rectangles, which an integrated GPU rasterises
  // slowly at the moment the canvas is next drawn (measured: ~40 ms a frame while the
  // overview was being repainted, against ~1 ms of CPU painting per piece).
  const canvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d', { willReadFrequently: true }); return cv; };

  // A building's look, for spotting what changed.
  const sig = b => `${b.kind}|${b.x},${b.y},${b.w},${b.h}|${b.label || ''}|${b.built ? 1 : 0}|${b.block ? b.block.code : ''}${b.kind === 'construction' ? `|${LES.Art.siteStage(b)}` : ''}`;

  class MapTiles {
    constructor(capMB) {
      this.cap = (capMB || 160) * 1048576;
      this.cache = new Map(); // "cx,cy" -> { cv, lights }
      this.want = new Set();  // tiles asked for on screen, painted first
      this.town = null;
    }

    // Start on a town (or pick up its changes when townVersion moves on).
    setTown(town, version) {
      if (this.town !== town) {
        this.town = town; this.version = version; this.drop();
        const T = town.T;
        this.W = town.W * T; this.H = town.H * T;
        this.cols = Math.ceil(this.W / TILE); this.rows = Math.ceil(this.H / TILE);
        this.back = null;
        this.ov = canvas(Math.ceil(this.W / OV), Math.ceil(this.H / OV));
        this.ovLights = canvas(this.ov.width, this.ov.height);
        LES.RegionMap.drawTown(this.ov.getContext('2d'), town, T / OV); // stand-in until tiles are painted
        this.ovDone = new Uint8Array(this.cols * this.rows);
        this.prepare();
        this.sigs = town.buildings.map(sig);
        return;
      }
      if (this.version === version) return;
      this.version = version;
      this.refresh(true);
    }
    // Paint again only the tiles of buildings whose look changed (a new estate, a builder's yard stage).
    refresh(always) {
      const town = this.town;
      if (!town) return;
      const now = town.buildings.map(sig), dirty = new Set();
      now.forEach((s, i) => {
        if (s === this.sigs[i]) return;
        const b = town.buildings[i], T = town.T;
        for (const k of this.tilesIn(b.x * T - MARGIN, b.y * T - MARGIN, b.w * T + 2 * MARGIN, b.h * T + 2 * MARGIN)) dirty.add(k);
      });
      this.sigs = now;
      if (always || dirty.size) this.prepare();
      for (const k of dirty) {
        this.cache.delete(k); const [cx, cy] = k.split(',').map(Number);
        this.ovDone[cy * this.cols + cx] = 0; if (this.back) this.back.done[cy * this.cols + cx] = 0;
      }
    }
    // Paint everything again (a new season's trees, or once the pixel font has loaded). The
    // overview being shown stays on screen, unchanged, until its replacement is complete: a
    // canvas that changes every frame must be sent to the GPU again every frame.
    reset() {
      if (!this.town) return;
      this.drop();
      this.back = { ov: canvas(this.ov.width, this.ov.height), lights: canvas(this.ov.width, this.ov.height), done: new Uint8Array(this.cols * this.rows) };
    }
    drop() { this.cache.clear(); this.want.clear(); }
    get bytes() { return this.cache.size * BYTES; }

    // Shared per-town data: where trees may grow, and the back-to-front building order.
    prepare() {
      const town = this.town, busy = new Uint8Array(town.W * town.H);
      const mark = (x, y) => { if (x >= 0 && y >= 0 && x < town.W && y < town.H) busy[y * town.W + x] = 1; };
      // No trees on roads, pavements, the river or along dropped road pieces (greenways have their own).
      for (let j = 0; j < town.rows; j++) for (let x = 0; x < town.W; x++) if (!town.layout || LES.hasH(town, j, LES.townColOf(town, x))) for (let y = town.roadsY[j] - 1; y <= town.roadsY[j] + 2; y++) mark(x, y);
      for (let c = 0; c < town.cols; c++) for (let y = 0; y < town.H; y++) for (let x = town.roadsX[c] - 1; x <= town.roadsX[c] + 2; x++) mark(x, y);
      if (town.layout && town.layout.river >= 0) { const c = town.layout.river, x0 = town.colX[c] + 14 + town.layout.padX[c]; for (let y = 0; y < town.H; y++) for (let x = x0 - 1; x <= x0 + town.layout.gapX[c]; x++) mark(x, y); }
      if (town.layout && town.layout.edge.size) { const e = town.layout.edge; for (let y = 0; y < town.H; y++) for (let x = 0; x < town.W; x++) if (e.side === 'e' ? x >= town.W - e.size - 1 : y >= town.H - e.size - 1) mark(x, y); }
      // Spare plot ground has its own car parks and playgrounds: keep random trees off it.
      if (town.layout) for (const bl of town.blocks) if (bl.px !== undefined && bl.code !== 'L') for (let x = bl.px; x < bl.px + bl.pw; x++) for (let y = bl.py; y < bl.py + bl.ph; y++) if (x < bl.x || x >= bl.x + 14 || y < bl.y || y >= bl.y + 11) mark(x, y);
      if (town.layout) for (let j = 0; j < town.rows; j++) for (let x = 0; x < town.W; x++) if (!LES.hasH(town, j, LES.townColOf(town, x))) for (let y = town.roadsY[j] - 1; y <= town.roadsY[j] + 2; y++) mark(x, y);
      for (const b of town.buildings) {
        if (b.kind === 'lot' && !b.built && !(b.block && b.block.wild)) continue; // trees may grow on empty grass lots (wild lots draw their own)
        for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y - 1; y <= b.y + b.h + 1; y++) mark(x, y);
      }
      this.busy = busy;
      // Back-to-front so taller buildings overlap the ones behind them.
      this.order = town.buildings.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.id - b.id);
    }

    // Tile keys covering a rectangle (world pixels).
    tilesIn(x, y, w, h) {
      const out = [];
      for (let cy = Math.max(0, Math.floor(y / TILE)); cy <= Math.min(this.rows - 1, Math.floor((y + h) / TILE)); cy++)
        for (let cx = Math.max(0, Math.floor(x / TILE)); cx <= Math.min(this.cols - 1, Math.floor((x + w) / TILE)); cx++) out.push(`${cx},${cy}`);
      return out;
    }

    // Paint the map area (x0, y0, w, h) into g. With shift, g's origin is that corner;
    // without, g already maps world coordinates (e.g. scaled for the overview). Any area
    // gives the same pixels as the same part of the whole map. Returns its lit windows.
    paintArea(g, x0, y0, w, h, shift = true) {
      const town = this.town, Art = LES.Art, T = town.T;
      g.save();
      if (shift) g.translate(-x0, -y0);
      g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      g.imageSmoothingEnabled = false;
      Art.setView(x0, y0, x0 + w, y0 + h);
      Art.beginLights();
      Art.drawGround(g, town);
      for (const b of this.order) if (Art.vis(b.x * T - MARGIN, b.y * T - MARGIN, b.w * T + 2 * MARGIN, b.h * T + 2 * MARGIN)) Art.drawBuilding(g, b);
      Art.winterGround(g, x0, y0, w, h); // frost and lying snow on grass and lawns (only in those weeks), before the trees
      Art.drawGreenery(g, town, this.busy);
      // Bus stops (shelter on the sidewalk) and the town gateway arch.
      for (const line of town.busLines) for (const st of line.stops) {
        const sx = st.pt.x + 18, sy = st.pt.y - 26;
        Art.rect(g, sx, sy, 12, 3, '#3d5a80'); Art.rect(g, sx + 1, sy + 3, 1, 7, '#666'); Art.rect(g, sx + 10, sy + 3, 1, 7, '#666');
        Art.rect(g, sx - 3, sy - 4, 3, 14, line.colour);
      }
      const gw = town.gateway;
      if (Art.vis(gw.x, gw.y - 30, 80, 60)) {
        Art.rect(g, gw.x + 4, gw.y - 20, 4, 40, 'rgba(0,0,0,0.25)'); Art.rect(g, gw.x + 2, gw.y - 22, 4, 40, '#8b5a2b'); Art.rect(g, gw.x + 2, gw.y - 26, 70, 9, '#b23a48'); Art.rect(g, gw.x + 2, gw.y - 26, 70, 1, '#d9606d');
        g.font = `7px ${FONT}`; g.fillStyle = '#ffe9a8'; g.textBaseline = 'top';
        g.fillText('SELAMAT DATANG', gw.x + 5, gw.y - 25);
      }
      Art.setView(null);
      g.restore();
      return Art.takeLights();
    }
    // Night lights for the same area (lit windows and street lamps).
    paintLights(g, x0, y0, w, h, rects, shift = true) {
      g.save(); if (shift) g.translate(-x0, -y0); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      LES.Ambience.paintLights(g, this.town, rects, x0, y0, w, h);
      g.restore();
    }

    paintTile(cx, cy) {
      const x0 = cx * TILE, y0 = cy * TILE, cv = canvas(TILE, TILE), lights = canvas(TILE, TILE);
      const rects = this.paintArea(cv.getContext('2d'), x0, y0, TILE, TILE);
      this.paintLights(lights.getContext('2d'), x0, y0, TILE, TILE, rects);
      const tile = { cv, lights };
      this.cache.set(`${cx},${cy}`, tile);
      return tile;
    }

    // A painted tile, or null (asked for: painted soon). Marks it recently used.
    get(cx, cy) {
      const k = `${cx},${cy}`, t = this.cache.get(k);
      if (!t) { this.want.add(k); return null; }
      this.cache.delete(k); this.cache.set(k, t);
      return t;
    }
    // One piece of the overview, painted straight at quarter scale (map and night lights),
    // into the replacement overview while one is under way.
    paintOverview(cx, cy) {
      const x0 = cx * TILE, y0 = cy * TILE, B = this.back, ov = B ? B.ov : this.ov, ovl = B ? B.lights : this.ovLights;
      for (const cv of [ov, ovl]) { const o = cv.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(x0 / OV, y0 / OV, TILE / OV, TILE / OV); }
      const o = ov.getContext('2d'), ol = ovl.getContext('2d');
      o.setTransform(1 / OV, 0, 0, 1 / OV, 0, 0); ol.setTransform(1 / OV, 0, 0, 1 / OV, 0, 0);
      const rects = this.paintArea(o, x0, y0, TILE, TILE, false);
      this.paintLights(ol, x0, y0, TILE, TILE, rects, false);
      o.setTransform(1, 0, 0, 1, 0, 0); ol.setTransform(1, 0, 0, 1, 0, 0);
      (B ? B.done : this.ovDone)[cy * this.cols + cx] = 1;
      if (B && B.done.indexOf(0) < 0) { this.ov = B.ov; this.ovLights = B.lights; this.ovDone = B.done; this.back = null; } // swap in, complete
    }

    // Between frames: paint tiles wanted on screen first, then fill the overview, within budget ms.
    work(budget, keep) {
      const t0 = performance.now();
      let n = 0;
      while (n === 0 || performance.now() - t0 < budget) {
        let k = null;
        for (const x of this.want) { this.want.delete(x); if (!this.cache.has(x)) { k = x; break; } }
        if (k) { const [cx, cy] = k.split(',').map(Number); this.paintTile(cx, cy); n++; continue; }
        const i = (this.back ? this.back.done : this.ovDone).indexOf(0);
        if (i < 0) break;
        this.paintOverview(i % this.cols, Math.floor(i / this.cols)); n++;
      }
      // Stay under the memory cap, never dropping what is on screen now.
      for (const k of this.cache.keys()) { if (this.bytes <= this.cap) break; if (!keep || !keep.has(k)) this.cache.delete(k); }
      return n;
    }
    get complete() { return !this.back && this.ovDone.every(x => x); }

    // Tiles a view needs (asked for if not painted yet); none when zoomed out.
    need(vx, vy, vw, vh, z) {
      const keep = new Set();
      if (z < 0.5) return keep;
      for (const k of this.tilesIn(vx, vy, vw, vh)) { keep.add(k); if (!this.cache.has(k)) this.want.add(k); }
      return keep;
    }
    // Draw the map in world coordinates for a view (x, y, w, h); zoomed out uses the overview.
    draw(g, vx, vy, vw, vh, z) {
      if (z < 0.5) { g.imageSmoothingEnabled = true; g.drawImage(this.ov, 0, 0, this.W, this.H); g.imageSmoothingEnabled = false; return; }
      for (const k of this.tilesIn(vx, vy, vw, vh)) {
        const [cx, cy] = k.split(',').map(Number), t = this.get(cx, cy);
        if (t) g.drawImage(t.cv, cx * TILE, cy * TILE);
        else g.drawImage(this.ov, cx * TILE / OV, cy * TILE / OV, TILE / OV, TILE / OV, cx * TILE, cy * TILE, TILE, TILE);
      }
    }
    drawLights(g, vx, vy, vw, vh, z) {
      if (z < 0.5) { g.drawImage(this.ovLights, 0, 0, this.W, this.H); return; }
      for (const k of this.tilesIn(vx, vy, vw, vh)) {
        const t = this.cache.get(k), [cx, cy] = k.split(',').map(Number);
        if (t) g.drawImage(t.lights, cx * TILE, cy * TILE);
        else g.drawImage(this.ovLights, cx * TILE / OV, cy * TILE / OV, TILE / OV, TILE / OV, cx * TILE, cy * TILE, TILE, TILE);
      }
    }
  }
  MapTiles.TILE = TILE;
  LES.MapTiles = MapTiles;
})(globalThis.LES = globalThis.LES || {});
