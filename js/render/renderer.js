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
  const CITY_JOBS = { rider: 1, delivery: 1, ehailing: 2, police: 4 };
  const AREA_JOBS = new Set(['construction', 'electrician', 'labour', 'running', 'sports', 'gym', 'pasar', 'promoter', 'park', 'futsal', 'golf', 'prison']);
  LES.motionOf = function (e, b) {
    if (!e) return 'inside';
    if (e.sub && CITY_JOBS[e.sub]) return 'city';
    if (e.sub && AREA_JOBS.has(e.sub)) return 'area';
    if (e.act === 'SOCIAL') return e.sub === 'mamak' || e.sub === 'hawker' ? 'outside' : 'inside';
    if (e.act === 'WORSHIP') return 'outside'; // the congregation gathers in the courtyard
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





  // Building painters, ground and trees live in art.js (LES.Art).

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
      LES.Art.beginLights();
      LES.Art.drawGround(g, town, R);

      // Occupancy grid for placing trees
      const busy = new Uint8Array(town.W * town.H);
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
      // Back-to-front so taller buildings overlap the ones behind them.
      const order = town.buildings.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.id - b.id);
      for (const b of order) LES.Art.drawBuilding(g, b, R);
      LES.Art.drawGreenery(g, town, busy, R);
      // Bus stops (shelter on the sidewalk) and the town gateway arch
      for (const line of town.busLines) for (const st of line.stops) {
        const sx = st.pt.x + 18, sy = st.pt.y - 26;
        rect(g, sx, sy, 12, 3, '#3d5a80'); rect(g, sx + 1, sy + 3, 1, 7, '#666'); rect(g, sx + 10, sy + 3, 1, 7, '#666');
        rect(g, sx - 3, sy - 4, 3, 14, line.colour);
      }
      const gw = town.gateway;
      rect(g, gw.x + 4, gw.y - 20, 4, 40, 'rgba(0,0,0,0.25)'); rect(g, gw.x + 2, gw.y - 22, 4, 40, '#8b5a2b'); rect(g, gw.x + 2, gw.y - 26, 70, 9, '#b23a48'); rect(g, gw.x + 2, gw.y - 26, 70, 1, '#d9606d');
      g.font = `7px ${FONT}`; g.fillStyle = '#ffe9a8'; g.textBaseline = 'top';
      g.fillText('SELAMAT DATANG', gw.x + 5, gw.y - 25);
      this.bg = cv;
      this.lights = LES.Ambience.buildLights(town, LES.Art.takeLights());
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
        const station = this.town.byKind.station;
        const from = p.arrivedDay === this.w.lastDay && station !== undefined ? station : home; // newcomers step off the train
        const t1 = this.planTrip(p, from, A, null, LES.SLOT_A);
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
      if (b.kind === 'park' || b.kind === 'gym' || b.kind === 'futsal' || b.kind === 'golf') {
        const a = ph + tm * sp;
        x = X + W / 2 + (W / 2 - 7) * Math.cos(a);
        y = Y + H / 2 + (H / 2 - 9) * Math.sin(a) + 6;
        dx = -Math.sign(Math.sin(a)) || 1;
      } else if (b.kind === 'prison') { // pacing the exercise yard
        x = X + 84 + 40 * (0.5 + 0.48 * Math.sin(tm * sp * 0.5 + ph));
        y = Y + 22 + 40 * (0.5 + 0.45 * Math.sin(tm * sp * 0.37 + ph * 2));
        dx = Math.sign(Math.cos(tm * sp * 0.5 + ph)) || 1;
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
      const mode = e.sub === 'ehailing' ? Math.max(2, p.tiers.transport) : e.sub === 'police' ? 4 : 1;
      const start = slot ? LES.SLOT_B : LES.SLOT_A;
      const dist = Math.max(0, tm - start) * LES.TRAVEL_SPEED[Math.min(3, mode)] * 0.6;
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
      if (w.crime) this.drawTurf(g, w);
      if (w.gov) this.drawCivic(g, w, now);
      this.drawSignals(g, now);
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
      if (!fast && this.town.byKind.station !== undefined) {
        const st = this.town.buildings[this.town.byKind.station];
        for (const d of w.departures || []) {
          if (d.day !== w.lastDay || d.home < 0) continue;
          const f = (tm - 480 - (d.id % 30)) / 90;
          if (f <= 0 || f >= 1) continue;
          const hb = this.town.buildings[d.home];
          const r = LES.polyline(LES.townPath(this.town, hb, st));
          const q = this.along(r, f);
          list.push({ p: w.people[d.id], x: q.x, y: q.y, dx: q.dx, dy: q.dy, moving: true, mode: 0, leaving: true });
        }
      }
      if (!fast && w.crime && !w.gov && tm > 30 && tm < 1080) { // police patrols (with a government, real officers drive them)
        const st = this.town.byKind.police !== undefined ? this.town.byKind.police : this.town.byKind.depot;
        const n = Math.max(1, Math.round(w.counts.living / 150 * (LES.Crime.POLICE[w.cfg.police] || 1)));
        for (let k = 0; k < n && st !== undefined; k++) {
          const q = this.cityLoop({ id: 900000 + k, tiers: { transport: 2 } }, st, { sub: 'ehailing' }, tm, k % 2);
          list.push({ police: true, x: q.x, y: q.y, dx: q.dx, dy: q.dy });
        }
      }
      list.sort((a, b) => a.y - b.y);
      this.screenPos = [];
      const millionaire = U.RM(1e6);
      const dots = this.z < 1 || (w.counts.living > 1500 && this.z < 1.6);
      const festDay = w.lastDay < 0 ? 0 : w.lastDay;
      // Only draw what is on screen (plus a margin for sprites and labels).
      const vx0 = this.cx - 40, vy0 = this.cy - 40, vx1 = this.cx + this.vw / this.z + 40, vy1 = this.cy + this.vh / this.z + 60;
      for (const it of list) {
        if (it.x < vx0 || it.x > vx1 || it.y < vy0 || it.y > vy1) continue;
        if (it.bus) { drawBus(g, it); continue; }
        if (it.police) { drawPolice(g, it, now); continue; }
        if (dots) { // zoomed out or a huge town: people as coloured dots, vehicles as dashes
          const sel = this.selectedId >= 0 ? w.people[this.selectedId] : null;
          const oc = this.overlay && this.overlay !== 'none' ? LES.Extras.overlayColour(w, it.p, this.overlay, sel) : null;
          const c = oc || (it.mode > 0 ? '#f4f1e8' : it.p.look.shirt);
          if (it.moving && it.mode > 0) rect(g, it.x - 3, it.y - 2, 6, 3, c); else rect(g, it.x - 1.5, it.y - 3, 3, 3, c);
          this.screenPos.push({ id: it.p.id, x: (it.x - this.cx) * this.z, y: (it.y - 2 - this.cy) * this.z });
          continue;
        }
        const p = it.p, age = P.age(w, p);
        const group = age < 3 ? 'baby' : !p.adult ? 'child' : age >= 65 ? 'elder' : 'adult';
        if (it.moving && it.mode === 4) { drawPolice(g, it, now); this.screenPos.push({ id: p.id, x: (it.x - this.cx) * this.z, y: (it.y - 4 - this.cy) * this.z }); continue; }
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
        // Face the way they walk (routes are straight road segments, so one of dx/dy is 0).
        const view = !it.moving ? 'front' : it.dx !== 0 ? 'side' : it.dy < 0 ? 'back' : 'front';
        const inYard = p.inst && p.inst.kind === 'prison' && !it.leaving;
        const outfit = inYard ? 'prisoner' : (atPlace && LES.Ambience.outfitFor(p, slotAct)) || LES.Ambience.festivalOutfit(p, festDay);
        const spr = LES.Sprites.person(p.look, group, it.moving ? walkFrame : 0, outfit, view);
        const x = Math.round(it.x - spr.width / 2), y = Math.round(it.y - spr.height);
        if (view === 'side' && it.dx < 0) { // walking left: mirror the right-facing sprite
          g.save(); g.translate(x + spr.width, y); g.scale(-1, 1); g.drawImage(spr, 0, 0); g.restore();
        } else g.drawImage(spr, x, y);
        if (it.leaving) { rect(g, x + spr.width - 1, y + spr.height - 6, 4, 5, '#8b5a2b'); rect(g, x + spr.width, y + spr.height - 7, 2, 1, '#3b2a1d'); } // suitcase
        g.globalAlpha = 1;
        if (atPlace && this.z >= 2.2 && !fast) LES.Ambience.bubble(g, it.x, y - 1, LES.Actions.ICONS[slotAct.act] || '•');
        if (P.goalWorth(w, p) >= millionaire) rect(g, x + spr.width / 2 - 1, y - 3, 3, 2, '#f2c14e');
        this.screenPos.push({ id: p.id, x: (it.x - this.cx) * this.z, y: (it.y - spr.height / 2 - this.cy) * this.z });
      }
      if (!fast) this.drawTrain(g, tm);
      this.drawInside(g, inside, tm);
      this.drawNight(g, t, fast);
      LES.Ambience.drawScreen(this, g, w, t, now, fast, this.nightLevel || 0);
      this.drawLabels(g, w);
    }

    // A train every 2 hours (06:30-22:30): rolls in from the west, waits, and leaves.
    drawTrain(g, tm) {
      const railId = (this.town.kinds.rail || [])[0], stId = this.town.byKind.station;
      if (railId === undefined || stId === undefined) return;
      const c = ((tm - 30) % 120 + 120) % 120;
      if (c >= 24 || tm < 30 || tm > 1000) return;
      const T = this.town.T, rail = this.town.buildings[railId], st = this.town.buildings[stId];
      const L = 4 * 30, stopX = (st.x + st.w) * T - 4, y = rail.y * T + 8;
      const ease = k => k * k * (3 - 2 * k);
      const head = c < 8 ? -L + (stopX + L) * ease(c / 8) : c < 16 ? stopX : stopX - (stopX + L) * ease((c - 16) / 8);
      for (let i = 0; i < 4; i++) {
        const x = head - (i + 1) * 30 + 2;
        if (x + 28 < 0) continue;
        rect(g, x + 2, y + 2, 28, 14, 'rgba(0,0,0,0.25)');
        rect(g, x, y, 28, 14, i === 0 ? '#1d3557' : '#f1faee');
        rect(g, x, y + 9, 28, 3, i === 0 ? '#f2c14e' : '#1d3557');
        for (let k = 0; k < 4; k++) rect(g, x + 3 + k * 6, y + 3, 4, 4, i === 0 && k === 3 ? '#ffe9a8' : '#8cc6de');
      }
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

    // Day/night: a warm tint at dawn and dusk, then a blue multiply so lit windows and
    // street lamps (added on top in Ambience.drawScreen) glow against the dark.
    drawNight(g, t, fast) {
      if (fast) { this.nightLevel = 0; return; }
      const hr = (t * 24 + 6) % 24; // dusk 19:00-20:30, dawn 06:00-07:00
      let night = hr >= 20.5 || hr < 6 ? 1 : hr >= 19 ? (hr - 19) / 1.5 : hr < 7 ? 1 - (hr - 6) : 0;
      this.nightLevel = night;
      const golden = hr >= 17.5 && hr < 20 ? Math.min(1, (hr - 17.5) / 1, (20 - hr) / 0.8) : hr >= 6 && hr < 7.5 ? Math.min(1, (7.5 - hr) / 1.2) * 0.7 : 0;
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (golden > 0) {
        g.globalCompositeOperation = 'soft-light';
        g.fillStyle = `rgba(255,150,60,${0.45 * golden})`;
        g.fillRect(0, 0, this.cv.width, this.cv.height);
        g.globalCompositeOperation = 'source-over';
      }
      if (night <= 0) return;
      if (LES.Ambience.weather(this.w.lastDay < 0 ? 0 : this.w.lastDay).id === 'rain') night = Math.min(1, night + 0.1);
      const k = 0.62 * night, mix = (a, b) => Math.round(a + (b - a) * k);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${mix(255, 40)},${mix(255, 52)},${mix(255, 110)})`;
      g.fillRect(0, 0, this.cv.width, this.cv.height);
      g.globalCompositeOperation = 'source-over';
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

    // Flood water on the flooded blocks, and campaign flags along the roads before an election.
    // Traffic lights: north-south and east-west take turns (green, amber, red), each junction
    // on its own timing; only junctions on screen are drawn.
    drawSignals(g, now) {
      const town = this.town, T = town.T, list = LES.junctions(town);
      const x0 = this.cx - 40, y0 = this.cy - 40, x1 = this.cx + this.vw / this.z + 40, y1 = this.cy + this.vh / this.z + 40;
      const CYCLE = 20000, lamp = (px, py, st) => {
        g.fillStyle = '#1b1e24'; g.fillRect(px - 1, py - 8, 4, 9);
        g.fillStyle = st === 'red' ? '#ff4d4d' : '#3a2020'; g.fillRect(px, py - 7, 2, 2);
        g.fillStyle = st === 'amber' ? '#ffbe0b' : '#3a3320'; g.fillRect(px, py - 4, 2, 2);
        g.fillStyle = st === 'green' ? '#57d38c' : '#1f3a2a'; g.fillRect(px, py - 1, 2, 2);
      };
      for (const n of list) {
        if (n.type !== 'lights' || n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1) continue;
        const t = ((now + n.phase * CYCLE) % CYCLE) / CYCLE; // 0-0.4 NS green, 0.4-0.5 NS amber, 0.5-0.9 EW green, 0.9-1 EW amber
        const ns = t < 0.4 ? 'green' : t < 0.5 ? 'amber' : 'red', ew = t < 0.5 ? 'red' : t < 0.9 ? 'green' : 'amber';
        lamp(n.x - 6, n.y - 12, ns); lamp(n.x + 2 * T + 4, n.y + 2 * T - 4, ns);
        lamp(n.x + 2 * T + 4, n.y - 12, ew); lamp(n.x - 6, n.y + 2 * T - 4, ew);
      }
    }

    drawCivic(g, w, now) {
      const T = this.town.T, gv = w.gov;
      if (gv.flood && w.day < gv.flood.until) {
        const a = 0.35 + 0.05 * Math.sin((now || 0) / 600);
        for (const i of gv.flood.blocks) { const bl = this.town.blocks[i]; if (!bl) continue; const X = (bl.px ?? bl.x) * T, Y = (bl.py ?? bl.y) * T; g.fillStyle = `rgba(120,95,60,${a})`; g.fillRect(X - 6, Y - 6, (bl.pw || 14) * T + 12, (bl.ph || 11) * T + 12); g.fillStyle = 'rgba(160,200,220,0.25)'; g.fillRect(X, Y + 4, (bl.pw || 14) * T, 3); }
      }
      if (gv.campaign) {
        const cols = gv.campaign.map(c => c.colour);
        let k = 0;
        for (const p of LES.roadPieces(this.town).pieces) {
          if (!p.h) continue;
          for (let x = p.x + 12; x < p.x + p.w - 8; x += 26) {
            const c = cols[(k++) % cols.length], y = p.y - 14;
            rect(g, x, y, 1, 9, '#ddd'); rect(g, x + 1, y, 6, 4, c); rect(g, x + 1, y + 1, 2, 1, '#ffffff');
          }
        }
      }
    }

    // Gang turf: graffiti tags on the blocks a gang controls (and a tint with the gang overlay).
    drawTurf(g, w) {
      const T = this.town.T;
      for (const gang of w.crime.gangs) {
        if (!gang.alive) continue;
        for (const i of gang.turf) {
          const bl = this.town.blocks[i];
          if (!bl) continue;
          const X = (bl.px !== undefined ? bl.px : bl.x) * T, Y = (bl.py !== undefined ? bl.py : bl.y) * T, W = (bl.pw || 14) * T, H = (bl.ph || 11) * T;
          if (this.overlay === 'gangs') { g.fillStyle = gang.colour + '33'; g.fillRect(X, Y, W, H); g.strokeStyle = gang.colour; g.lineWidth = 2; g.strokeRect(X + 1, Y + 1, W - 2, H - 2); }
          for (let k = 0; k < 4; k++) {
            const hx = X + 6 + (hash(i * 31 + k) % Math.max(1, W - 24)), hy = Y + 4 + (hash(i * 17 + k * 7) % Math.max(1, H - 12));
            g.fillStyle = gang.colour; g.fillRect(hx, hy, 8, 2); g.fillRect(hx + 2, hy + 2, 2, 3); g.fillRect(hx + 6, hy + 2, 3, 2);
            g.fillStyle = '#1b1b1b'; g.fillRect(hx + 9, hy, 2, 2);
          }
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
      for (const b of w.biz) if (b.open && !['shoplot', 'privschool', 'privhosp', 'hq'].includes(w.town.buildings[b.place].kind)) counts[b.place] = (counts[b.place] || 0) + 1; // own buildings carry their own sign
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

  function drawPolice(g, it, now) {
    const x = Math.round(it.x), y = Math.round(it.y), horiz = it.dx !== 0 || it.dy === 0, blink = Math.floor((now || 0) / 250) % 2;
    if (horiz) {
      rect(g, x - 9, y - 6, 18, 8, 'rgba(0,0,0,0.25)');
      rect(g, x - 9, y - 7, 18, 7, '#f4f6f8'); rect(g, x - 9, y - 4, 18, 2, '#1d3557'); rect(g, x - 5, y - 10, 10, 4, '#f4f6f8');
      rect(g, x - 4, y - 9, 8, 2, '#9fd3e0'); rect(g, x - 3, y - 11, 3, 1, blink ? '#e63946' : '#ff9aa2'); rect(g, x, y - 11, 3, 1, blink ? '#8ecae6' : '#3a86ff');
      rect(g, x - 7, y, 4, 2, '#111'); rect(g, x + 3, y, 4, 2, '#111');
    } else {
      rect(g, x - 5, y - 9, 10, 16, 'rgba(0,0,0,0.25)');
      rect(g, x - 5, y - 10, 10, 16, '#f4f6f8'); rect(g, x - 5, y - 3, 10, 2, '#1d3557'); rect(g, x - 4, y - 6, 8, 3, '#9fd3e0');
      rect(g, x - 3, y - 8, 3, 1, blink ? '#e63946' : '#ff9aa2'); rect(g, x, y - 8, 3, 1, blink ? '#8ecae6' : '#3a86ff');
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
