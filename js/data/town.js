// Town generator for Bandar Rezeki. The map is a grid of 14x11-tile blocks
// separated by 2-tile roads. Each map size has a grid size; the district of every
// block is chosen by seeded placement rules (CBD near the centre, industry at the edge,
// the wealthy around one corner, kampung on the far side, schools/clinics/parks spread
// out, the train station on the left edge). Same seed + size = same town.
// Pure data, so the headless simulation can use it without a canvas.
(function (LES) {
  'use strict';

  const BW = 14, BH = 11, ROAD = 2;

  // K kampung, A kampung+padi, F flats, T terrace, C condo, B bungalow, O CBD (offices/bank/Bursa),
  // H tech hub + shops, S shoplots, M mall + shops, D food (mamak + hawker), U university,
  // E college/library/hall, Q hospital + school, P park + stadium, I factory, W workshop/warehouse/site,
  // R welfare home + flats, V mid-tier leisure (cinema, karaoke bar, bowling, futsal),
  // Y upscale leisure (fine dining, sky lounge, spa), Z golf & country club,
  // N train station, G gateway square (bus depot, memorial), L empty lot (the town grows here)
  LES.MAP_SIZES = {
    kampung: { name: 'Kampung', cols: 6, rows: 5, suggest: 'up to ~60 founders', maxFounders: 60 },
    pekan: { name: 'Pekan', cols: 9, rows: 6, suggest: '60-250 founders', maxFounders: 250 },
    bandar: { name: 'Bandar', cols: 12, rows: 9, suggest: '250-700 founders', maxFounders: 700 },
    bandaraya: { name: 'Bandaraya', cols: 18, rows: 12, suggest: '700-2,000 founders', maxFounders: 2000 },
    metropolis: { name: 'Metropolis', cols: 26, rows: 18, suggest: '2,000-5,000+ founders', maxFounders: 1e9 },
  };
  LES.MAP_ALIASES = { small: 'kampung', medium: 'pekan', large: 'bandar' }; // older settings
  LES.MAP_ORDER = ['kampung', 'pekan', 'bandar', 'bandaraya', 'metropolis'];
  LES.suggestMapSize = founders => LES.MAP_ORDER.find(k => founders <= LES.MAP_SIZES[k].maxFounders) || 'metropolis';

  // How many blocks of each district a town of n blocks gets (facilities scale with size).
  LES.districtQuota = function (n) {
    const q = {
      N: 1, G: 1,
      O: 1 + Math.floor(n / 50), H: 1 + Math.floor(n / 80), M: 1 + Math.floor(n / 70), U: 1 + Math.floor(n / 150),
      E: 1 + Math.floor(n / 70), Q: Math.max(1, Math.round(n / 18)), P: Math.max(1, Math.round(n / 20)),
      D: Math.max(1, Math.round(n / 22)), V: Math.max(1, Math.round(n / 30)), Y: 1 + Math.floor(n / 90),
      Z: 1 + Math.floor(n / 220), S: Math.max(1, Math.round(n / 16)), I: Math.max(1, Math.round(n / 28)),
      W: Math.max(1, Math.round(n / 28)), R: 1 + Math.floor(n / 120),
    };
    q.L = Math.round(n * 0.14);
    const used = Object.values(q).reduce((a, b) => a + b, 0);
    const homes = Math.max(5, n - used);
    const shares = { K: 0.13, A: n < 80 ? 0.05 : 0.03, F: 0.24, T: 0.28, C: 0.2, B: 0.1 };
    let given = 0;
    for (const k of ['F', 'T', 'C', 'K', 'B', 'A']) { q[k] = Math.max(1, Math.round(homes * shares[k])); given += q[k]; }
    q.T += homes - given; // keep the total exact
    if (q.T < 1) { q.L += q.T - 1; q.T = 1; }
    return q;
  };

  // Seeded district plan: returns an array of row strings like the old templates.
  LES.planDistricts = function (size, seed) {
    const S = LES.MAP_SIZES[size];
    const cols = S.cols, rows = S.rows, n = cols * rows;
    const R = new LES.RNG(`${seed}|map|${size}`);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const quota = LES.districtQuota(n);
    const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
    const dCentre = (c, r) => Math.max(Math.abs(c - cx) / Math.max(1, cx), Math.abs(r - cy) / Math.max(1, cy));
    // The wealthy live around one of the right-hand corners; kampung sits far from them.
    const rich = { c: cols - 1, r: R.next() < 0.5 ? 0 : rows - 1 };
    const span = Math.max(cols, rows);
    const dRich = (c, r) => (Math.abs(c - rich.c) + Math.abs(r - rich.r)) / span;
    const placed = {};
    const put = (code, c, r) => { grid[r][c] = code; (placed[code] = placed[code] || []).push({ c, r }); };
    const nearest = (code, c, r) => {
      const list = placed[code];
      if (!list || !list.length) return 1;
      let best = Infinity;
      for (const q of list) best = Math.min(best, (Math.abs(q.c - c) + Math.abs(q.r - r)) / span);
      return best;
    };
    // Station on the left edge (trains arrive from the west); gateway square next to it.
    const sr = R.int(Math.floor(rows / 3), Math.max(Math.floor(rows / 3), Math.ceil(rows * 2 / 3) - 1));
    put('N', 0, sr);
    put('G', 0, sr + 1 < rows ? sr + 1 : sr - 1);
    const score = {
      O: (c, r) => -3 * dCentre(c, r) + 0.5 * nearest('O', c, r),
      H: (c, r) => -2 * dCentre(c, r) + 0.8 * nearest('H', c, r),
      M: (c, r) => -1.5 * dCentre(c, r) + 1.5 * nearest('M', c, r),
      U: (c, r) => -1 * dCentre(c, r) + 2 * nearest('U', c, r),
      Y: (c, r) => -1.2 * dCentre(c, r) - 1.2 * dRich(c, r) + 1.2 * nearest('Y', c, r),
      Z: (c, r) => -3 * dRich(c, r) + 2 * nearest('Z', c, r),
      B: (c, r) => -3 * dRich(c, r),
      C: (c, r) => -1.5 * dRich(c, r) - 0.8 * dCentre(c, r),
      T: (c, r) => -Math.abs(dCentre(c, r) - 0.55) + 0.6 * nearest('T', c, r),
      I: (c, r) => 2 * dCentre(c, r) + 2 * dRich(c, r) + 1.5 * nearest('I', c, r),
      W: (c, r) => 2 * dCentre(c, r) + 1.5 * dRich(c, r) + 1.5 * nearest('W', c, r),
      F: (c, r) => -1.5 * nearest('I', c, r) + 0.8 * dRich(c, r) + 0.5 * nearest('F', c, r),
      R: (c, r) => -1 * nearest('F', c, r) + 1.5 * nearest('R', c, r),
      K: (c, r) => 2.5 * dRich(c, r) + 0.5 * dCentre(c, r),
      A: (c, r) => 2.5 * dRich(c, r) + 1.5 * dCentre(c, r),
      L: (c, r) => 2 * dCentre(c, r) + 0.6 * nearest('L', c, r),
    };
    const spread = (c, r, code) => -0.5 * dCentre(c, r) + 3 * nearest(code, c, r); // Q P D V E S
    const order = ['O', 'U', 'M', 'H', 'Z', 'Y', 'B', 'C', 'I', 'W', 'Q', 'P', 'E', 'D', 'V', 'S', 'R', 'F', 'K', 'A', 'L', 'T'];
    for (const code of order) {
      for (let k = 0; k < (quota[code] || 0); k++) {
        let best = null, bestS = -Infinity;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (grid[r][c]) continue;
          const f = score[code];
          const v = (f ? f(c, r) : spread(c, r, code)) + R.range(0, 0.6);
          if (v > bestS) { bestS = v; best = { c, r }; }
        }
        if (!best) break;
        put(code, best.c, best.r);
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!grid[r][c]) put('T', c, r);
    return grid.map(row => row.join(''));
  };

  // Building descriptions (shown when a building is clicked).
  LES.KIND_INFO = {
    kampung: 'Wooden kampung house with rooms for rent. The cheapest housing in town.',
    flat: 'PPR low-cost flats. Affordable homes for working families.',
    terrace: 'A row of terrace houses. Comfortable middle-class homes.',
    condo: 'Condominium tower with pool and gym. Upper-middle-class living.',
    bungalow: 'A bungalow on the hill. Home of the wealthy.',
    mamak: 'Open 24 hours. Where people meet friends, gossip and fall in love.',
    hawker: 'Hawker centre. Cheap food, food stalls and delivery gigs.',
    university: 'Universiti Rezeki: degrees in Arts, Business, Engineering, Medicine and Masters.',
    kolej: 'Kolej Vokasional: vocational certificates for skilled trades.',
    library: 'Public library: self-study, tuition gigs and freelance work.',
    hall: 'Dewan Komuniti: public speaking club and community events.',
    hq: 'Headquarters tower of one of the richest companies in town.',
    office: 'Office tower: sales, accounting and management jobs; home to bigger companies.',
    bank: 'Bank: business loans and bank officer jobs.',
    bursa: 'Bursa Rezeki stock exchange. Click to open the stock market.',
    mall: 'Shopping mall: retail and cleaning jobs, promoter and e-hailing gigs.',
    shoplot: 'Shoplot unit for a small business.',
    hospital: 'Hospital: doctors, nurses and treatment for the sick and injured.',
    school: 'Sekolah: where children spend their days.',
    factory: 'Kilang: factory operator and engineer jobs.',
    workshop: 'Bengkel: mechanics and repair gigs.',
    warehouse: 'Gudang: despatch riders and logistics.',
    construction: 'Construction site: hard, risky labour.',
    park: 'Taman Tasik: lake park for running and socialising.',
    gym: 'Stadium & gym: workouts and sports training.',
    techhub: 'Tech Hub: software jobs and startups.',
    welfare: 'Rumah Kebajikan: welfare home for children without guardians.',
    padi: 'Padi fields.',
    lot: 'Empty land. New buildings appear here when the town gets crowded.',
    depot: 'Bus depot and the town gateway. Newcomers arrive here.',
    memorial: 'Memorial garden. A lantern for every founder who has passed away.',
    cinema: 'Panggung wayang: movies. Mid-tier entertainment.',
    karaoke: 'Karaoke & bar: drinks and songs with friends. Mid-tier entertainment.',
    bowling: 'Bowling alley. Mid-tier entertainment.',
    futsal: 'Futsal court: cheap games with friends. Low-tier sport and leisure.',
    finedine: 'Fine-dining restaurant. High-tier: expensive, very satisfying, a place to be seen.',
    lounge: 'Sky lounge on the rooftop. High-tier nightlife where the well-off network.',
    spa: 'Spa & wellness centre. High-tier relaxation that melts stress away.',
    golf: 'Golf & country club. The most exclusive venue in town: members only, where deals are made.',
    station: 'Stesen Keretapi: trains to the big city. Newcomers arrive and leavers depart here; commuters ride to city jobs.',
    rail: 'Railway line to the big city.',
  };

  // Adds a building to a town (kept as a closure on town.add for the block fillers).
  LES.townAdder = function (town) {
    const { roadsY, T } = town;
    const add = function (kind, label, x, y, w, h, extra) {
      const cy = y + h / 2;
      let road = roadsY[0], bestD = Infinity;
      for (const ry of roadsY) {
        const d = Math.abs(ry + 1 - cy);
        if (d < bestD) { bestD = d; road = ry; }
      }
      const doorBelow = road + 1 > cy;
      const b = Object.assign({
        id: town.buildings.length, kind, label, x, y, w, h,
        roadY: (road + 1) * T, doorBelow,
        door: { x: Math.round((x + w / 2) * T), y: (doorBelow ? y + h : y) * T },
      }, extra || {});
      town.buildings.push(b);
      if (!(kind in town.byKind)) town.byKind[kind] = b.id;
      (town.kinds[kind] = town.kinds[kind] || []).push(b.id);
      if (b.tier !== undefined) town.homesByTier[b.tier].push(b.id);
      if (kind === 'shoplot') town.shoplots.push(b.id);
      return b;
    };
    add.$restore = 'townAdd'; // lets a saved world rebuild this closure
    return add;
  };

  LES.buildTown = function (size, seed) {
    size = LES.MAP_ALIASES[size] || size;
    if (!LES.MAP_SIZES[size]) size = 'pekan';
    const tpl = LES.planDistricts(size, seed === undefined ? 'rezeki-1' : seed);
    const rows = tpl.length, cols = tpl[0].length;
    const T = 16, W = cols * (BW + ROAD), H = rows * (BH + ROAD);
    const roadsX = [], roadsY = [];
    for (let c = 0; c < cols; c++) roadsX.push(c * (BW + ROAD) + BW);
    for (let r = 0; r < rows; r++) roadsY.push(r * (BH + ROAD) + BH);
    const town = { size, T, W, H, cols, rows, roadsY, roadsX, plan: tpl, buildings: [], byKind: {}, kinds: {}, homesByTier: [[], [], [], [], []], shoplots: [], lots: [], blocks: [] };

    town.add = LES.townAdder(town);

    tpl.forEach((line, r) => {
      for (let c = 0; c < cols; c++) {
        const code = line[c];
        const block = { code, c, r, x: c * (BW + ROAD), y: r * (BH + ROAD) };
        town.blocks.push(block);
        LES.fillBlock(town, block, code);
      }
    });
    // Gateway arch on the left end of the road beside the station (newcomers arrive here).
    const st = town.buildings[town.byKind.station];
    const gy = st ? st.roadY : (roadsY[Math.floor(rows / 2) - 1] + 1) * T;
    town.gateway = { x: 0, y: gy };
    town.busLines = LES.makeBusLines(town);
    return town;
  };

  // Paint one block (bx, by = top-left tile). Also used later when the town grows on a lot.
  LES.fillBlock = function (town, block, code) {
    const add = town.add, X = block.x, Y = block.y;
    const home = (kind, x, y, w, h, tier, cap) => add(kind, '', X + x, Y + y, w, h, { tier, cap, home: true, block });
    const at = (kind, label, x, y, w, h, extra) => add(kind, label, X + x, Y + y, w, h, Object.assign({ block }, extra || {}));
    const shop = (x, y) => at('shoplot', '', x, y, 4, 3);
    block.code = code;
    switch (code) {
      case 'K': for (const yy of [1, 6]) for (const xx of [1, 5, 9]) home('kampung', xx, yy, 3, 3, 0, 4); break;
      case 'A': for (const xx of [1, 5, 9]) home('kampung', xx, 1, 3, 3, 0, 4); at('padi', 'Sawah Padi', 1, 5, 12, 5, { decor: true }); break;
      case 'F': home('flat', 1, 1, 5, 9, 1, 40); home('flat', 8, 1, 5, 9, 1, 40); break;
      case 'T': for (const yy of [1, 5, 9]) home('terrace', 1, yy, 12, 2, 2, 12); break;
      case 'C': for (const xx of [1, 5, 9]) home('condo', xx, 1, 3, 9, 3, 40); break;
      case 'B': for (const [xx, yy] of [[1, 1], [8, 1], [1, 6], [8, 6]]) home('bungalow', xx, yy, 5, 4, 4, 6); break;
      case 'O':
        at('office', 'Menara Rezeki', 1, 0, 4, 10);
        if (!town.byKind.bursa) { at('bank', 'Bank', 6, 1, 4, 4); at('bursa', 'Bursa', 6, 6, 7, 4); }
        else { at('office', 'Menara Sentral', 6, 0, 4, 10); at('bank', 'Bank', 11, 1, 3, 4); }
        break;
      case 'H': at('techhub', 'Tech Hub', 1, 0, 4, 10); shop(6, 1); shop(10, 1); shop(6, 6); shop(10, 6); break;
      case 'S': for (const yy of [1, 6]) for (const xx of [1, 5, 9]) shop(xx, yy); break;
      case 'M': at('mall', 'Rezeki Mall', 1, 1, 6, 9); shop(8, 1); shop(8, 6); break;
      case 'D': at('mamak', 'Mamak 24J', 1, 1, 5, 4); at('hawker', 'Hawker Centre', 7, 1, 7, 5); at('mamak', 'Mamak Corner', 1, 6, 5, 4); break;
      case 'U': at('university', 'Universiti Rezeki', 1, 1, 13, 9); break;
      case 'E': at('kolej', 'Kolej Vokasional', 1, 1, 6, 5); at('library', 'Library', 8, 1, 6, 5); at('hall', 'Dewan Komuniti', 1, 7, 6, 4); break;
      case 'Q': at('hospital', 'Hospital', 1, 1, 7, 8); at('school', 'Sekolah', 9, 1, 5, 8); break;
      case 'P': at('park', 'Taman Tasik', 0, 0, 8, 11); at('gym', 'Stadium & Gym', 9, 1, 5, 6); break;
      case 'I': at('factory', 'Kilang', 1, 1, 12, 8); break;
      case 'W': at('workshop', 'Bengkel', 1, 0, 6, 4); at('warehouse', 'Gudang', 8, 0, 6, 4); at('construction', 'Tapak Binaan', 0, 6, 14, 4); break;
      case 'R': at('welfare', 'Rumah Kebajikan', 1, 1, 6, 3); home('flat', 8, 1, 5, 9, 1, 40); break;
      case 'G': at('depot', 'Bus Depot', 1, 1, 6, 4); at('memorial', 'Taman Kenangan', 8, 1, 6, 8); break;
      case 'X': at('hq', block.hqName || 'Menara', 4, 0, 6, 10); at('park', 'Plaza', 0, 0, 3, 11, { decor: true }); break;
      case 'V':
        at('cinema', 'Panggung Wayang', 1, 1, 6, 5, { venue: true });
        at('karaoke', 'Karaoke & Bar', 8, 1, 6, 4, { venue: true });
        at('bowling', 'Bowling', 1, 7, 6, 4, { venue: true });
        at('futsal', 'Futsal', 8, 6, 6, 5, { venue: true });
        break;
      case 'Y':
        at('finedine', 'Restoran Mewah', 1, 1, 6, 4, { venue: true });
        at('lounge', 'Sky Lounge', 9, 0, 4, 10, { venue: true });
        at('spa', 'Spa & Wellness', 1, 6, 6, 4, { venue: true });
        break;
      case 'Z': at('golf', 'Kelab Golf Rezeki', 0, 0, 14, 11, { venue: true }); break;
      case 'N':
        at('station', 'Stesen Keretapi', 3, 4, 9, 5);
        at('rail', '', 0, 1, 14, 2, { decor: true, rail: true });
        break;
      case 'L': { const lot = at('lot', '', 0, 0, 14, 11, { decor: true }); town.lots.push(lot.id); break; }
      default: break;
    }
  };

  // When homes are crowded, the emptiest-demand lot is rebuilt as a new estate or shop row.
  LES.growTown = function (town, code, hqName) {
    const lotId = town.lots.find(id => !town.buildings[id].built);
    if (lotId === undefined) return null;
    const lot = town.buildings[lotId];
    lot.built = true;
    lot.kind = 'builtlot';
    lot.block.hqName = hqName;
    LES.fillBlock(town, lot.block, code);
    return lot.block;
  };

  // Nearest building of a kind to another building (Manhattan door distance).
  LES.townNear = function (town, kind, fromId) {
    const list = town.kinds[kind];
    if (!list || !list.length) return town.byKind[kind];
    if (list.length === 1 || fromId === undefined || fromId < 0) return list[0];
    town._near = town._near || {};
    const cache = town._near[kind] || (town._near[kind] = new Map());
    const hit = cache.get(fromId);
    if (hit !== undefined) return hit;
    const a = town.buildings[fromId].door;
    let best = list[0], bd = Infinity;
    for (const id of list) {
      const d = town.buildings[id].door;
      const dist = Math.abs(d.x - a.x) + Math.abs(d.y - a.y);
      if (dist < bd) { bd = dist; best = id; }
    }
    cache.set(fromId, best);
    return best;
  };

  // Walking/driving route between two buildings along the road grid (pixel points).
  LES.townPath = function (town, a, b) {
    const pa = a.door, pb = b.door;
    if (a.id === b.id) return [pa, pb];
    const ya = a.roadY, yb = b.roadY;
    if (ya === yb) return [pa, { x: pa.x, y: ya }, { x: pb.x, y: ya }, pb];
    const mid = (pa.x + pb.x) / 2;
    let xr = town.roadsX[0], best = Infinity;
    for (const rx of town.roadsX) {
      const cx = (rx + 1) * town.T, d = Math.abs(cx - mid);
      if (d < best) { best = d; xr = cx; }
    }
    return [pa, { x: pa.x, y: ya }, { x: xr, y: ya }, { x: xr, y: yb }, { x: pb.x, y: yb }, pb];
  };

  // ---- Bus lines: closed loops along road centre lines with stops at intersections ----
  LES.BUS = { speed: 260, headway: 12, walkSpeed: 64 }; // px per sim-minute, minutes between buses
  LES.makeBusLines = function (town) {
    const T = town.T, cx = i => (town.roadsX[i] + 1) * T, cy = i => (town.roadsY[i] + 1) * T;
    const nx = town.roadsX.length, ny = town.roadsY.length;
    const rect = (x0, y0, x1, y1) => [{ x: cx(x0), y: cy(y0) }, { x: cx(x1), y: cy(y0) }, { x: cx(x1), y: cy(y1) }, { x: cx(x0), y: cy(y1) }];
    const defs = [
      { name: 'Laluan 1', colour: '#e63946', pts: rect(0, 0, nx - 2, ny - 2) },
      { name: 'Laluan 2', colour: '#2a9d8f', pts: rect(Math.floor(nx / 4), Math.floor(ny / 4), Math.min(nx - 1, Math.floor(nx * 3 / 4) + 1), Math.min(ny - 1, Math.floor(ny * 3 / 4))) },
    ];
    if (nx >= 9) defs.push({ name: 'Laluan 3', colour: '#f4a261', pts: rect(Math.floor(nx / 2), 0, nx - 1, ny - 1) });
    return defs.map((d, li) => {
      const pts = d.pts, segs = [];
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const l = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        segs.push({ a, b, l, s0: len });
        len += l;
      }
      const stops = [];
      for (const s of segs) {
        const horizontal = s.a.y === s.b.y;
        const xs = horizontal ? town.roadsX : town.roadsY;
        for (const r of xs) {
          const v = (r + 1) * T;
          const lo = horizontal ? Math.min(s.a.x, s.b.x) : Math.min(s.a.y, s.b.y), hi = horizontal ? Math.max(s.a.x, s.b.x) : Math.max(s.a.y, s.b.y);
          if (v < lo || v >= hi) continue;
          const off = horizontal ? Math.abs(v - s.a.x) : Math.abs(v - s.a.y);
          const pos = s.s0 + off;
          if (!stops.some(st => Math.abs(st.pos - pos) < 1)) stops.push({ pos, pt: horizontal ? { x: v, y: s.a.y } : { x: s.a.x, y: v } });
        }
      }
      stops.sort((x, y) => x.pos - y.pos);
      const buses = Math.max(2, Math.round(len / (LES.BUS.speed * LES.BUS.headway)));
      return { id: li, name: d.name, colour: d.colour, segs, len, stops, buses };
    });
  };
  LES.busPointAt = function (line, pos) {
    pos = ((pos % line.len) + line.len) % line.len;
    for (const s of line.segs) {
      if (pos <= s.s0 + s.l) {
        const k = s.l ? (pos - s.s0) / s.l : 0;
        return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, dir: Math.abs(s.b.x - s.a.x) > 0 ? Math.sign(s.b.x - s.a.x) : 0 };
      }
    }
    return { x: line.segs[0].a.x, y: line.segs[0].a.y, dir: 1 };
  };
})(globalThis.LES = globalThis.LES || {});
