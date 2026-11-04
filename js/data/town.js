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
  // e private school and h private hospital (built on an empty lot by a resident's business)
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
  LES.districtQuota = function (n, varied) {
    const q = {
      N: 1, G: 1,
      O: 1 + Math.floor(n / 50), H: 1 + Math.floor(n / 80), M: 1 + Math.floor(n / 70), U: 1 + Math.floor(n / 150),
      E: 1 + Math.floor(n / 70), Q: Math.max(1, Math.round(n / 18)), P: Math.max(1, Math.round(n / 20)),
      D: Math.max(1, Math.round(n / 22)), V: Math.max(1, Math.round(n / 30)), Y: 1 + Math.floor(n / 90),
      Z: 1 + Math.floor(n / 220), S: Math.max(1, Math.round(n / 16)), I: Math.max(1, Math.round(n / 28)),
      W: Math.max(1, Math.round(n / 28)), R: 1 + Math.floor(n / 120),
    };
    q.L = Math.round(n * 0.14);
    if (varied) { // worship districts and a justice district (taken from the lot share)
      q.J = Math.max(1, Math.round(n / 25)); q.j = 1 + Math.floor(n / 200); q.g = 1;
      q.L = Math.max(1, q.L - q.J - q.j - q.g);
    }
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
  LES.planDistricts = function (size, seed, varied) {
    const S = LES.MAP_SIZES[size];
    const cols = S.cols, rows = S.rows, n = cols * rows;
    const R = new LES.RNG(`${seed}|map|${size}`);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const quota = LES.districtQuota(n, varied);
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
      j: (c, r) => 1.2 * dCentre(c, r) + 2 * nearest('j', c, r), // the prison sits toward the edge of town
      g: (c, r) => -2.5 * dCentre(c, r), // the town hall is central
    };
    const spread = (c, r, code) => -0.5 * dCentre(c, r) + 3 * nearest(code, c, r); // Q P D V E S
    const order = ['O', 'U', 'M', 'H', 'Z', 'Y', 'B', 'C', 'I', 'W', 'Q', 'P', 'E', 'J', 'j', 'g', 'D', 'V', 'S', 'R', 'F', 'K', 'A', 'L', 'T'];
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
    privschool: 'A private school, owned by a resident. Fee-paying families send their children here; the owner pays the teachers.',
    privhosp: 'A private hospital, owned by a resident. Richer patients pay more for quicker care; the owner pays the doctors and nurses.',
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
    masjid: 'Masjid: Friday prayers, the zakat and infaq fund, Ramadan and Hari Raya.',
    tokong: 'Chinese temple (Buddhist and Taoist): prayers, offerings and the temple welfare fund.',
    kuil: 'Hindu temple: prayers, Deepavali and the temple welfare fund.',
    gereja: 'Church: Sunday service, tithes and the church welfare fund.',
    police: 'Balai Polis: the police station. Patrol cars go out from here; arrest chances depend on police strength.',
    court: "Mahkamah: the magistrates' court. Most cases end in conviction; a lawyer helps those who can pay.",
    prison: 'Penjara: the prison. Inmates lose their jobs; a record makes hiring harder and reoffending likelier.',
    jail: 'Lokap: the police lock-up. Suspects wait here on remand until the court hears their case.',
    townhall: "Dewan Bandaraya: the town hall, office of the elected leader. The treasury collects taxes and pays for police, aid and services.",
    padang: 'Padang: the town field, where election rallies gather.',
    rehab: 'Pusat Pemulihan: drug rehabilitation (AADK-style). Many relapse after release.',
  };

  // Adds a building to a town (kept as a closure on town.add for the block fillers).
  LES.townAdder = function (town) {
    const { roadsY, T } = town;
    const add = function (kind, label, x, y, w, h, extra) {
      const cy = y + h / 2;
      let road = roadsY[0], bestD = Infinity;
      // Varied layouts: the door faces the nearest road that actually runs past this column.
      const col = town.layout ? LES.townColOf(town, x + w / 2) : -1;
      for (let j = 0; j < roadsY.length; j++) {
        const ry = roadsY[j];
        if (col >= 0 && !town.layout.hseg[j][col]) continue;
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

  // layout: 'grid' = the original equal blocks and straight roads (Classic preset);
  // 'varied' = seeded avenues, a river with bridges, merged superblocks and wild land.
  LES.buildTown = function (size, seed, layout) {
    size = LES.MAP_ALIASES[size] || size;
    if (!LES.MAP_SIZES[size]) size = 'pekan';
    seed = seed === undefined ? 'rezeki-1' : seed;
    const tpl = LES.planDistricts(size, seed, layout === 'varied');
    const rows = tpl.length, cols = tpl[0].length;
    const L = layout === 'varied' ? LES.planLayout(size, seed, tpl) : null;
    const gapX = L ? L.gapX : Array(cols).fill(ROAD), gapY = L ? L.gapY : Array(rows).fill(ROAD);
    const padX = L ? L.padX : Array(cols).fill(0), padY = L ? L.padY : Array(rows).fill(0);
    const colX = [], rowY = [], roadsX = [], roadsY = [];
    let acc = 0; // column c: plot (BW + padX wide), then its road gap
    for (let c = 0; c < cols; c++) { colX.push(acc); roadsX.push(acc + BW + padX[c] + Math.floor((gapX[c] - ROAD) / 2)); acc += BW + padX[c] + gapX[c]; }
    const W = acc + (L && L.edge.side === 'e' ? L.edge.size : 0);
    acc = 0;
    for (let r = 0; r < rows; r++) { rowY.push(acc); roadsY.push(acc + BH + padY[r] + Math.floor((gapY[r] - ROAD) / 2)); acc += BH + padY[r] + gapY[r]; }
    const T = 16, H = acc + (L && L.edge.side === 's' ? L.edge.size : 0);
    const town = { size, T, W, H, cols, rows, roadsY, roadsX, colX, rowY, layout: L, plan: tpl, buildings: [], byKind: {}, kinds: {}, homesByTier: [[], [], [], [], []], shoplots: [], lots: [], blocks: [] };
    if (!L) { delete town.colX; delete town.rowY; delete town.layout; } // grid towns keep their original shape

    town.add = LES.townAdder(town);

    tpl.forEach((line, r) => {
      for (let c = 0; c < cols; c++) {
        const code = line[c];
        const block = { code, c, r, x: L ? colX[c] + Math.floor(padX[c] / 2) : c * (BW + ROAD), y: L ? rowY[r] + Math.floor(padY[r] / 2) : r * (BH + ROAD) };
        // The whole plot (bigger than the 14x11 buildings in varied towns: room for car parks and gardens).
        if (L) Object.assign(block, { px: colX[c], py: rowY[r], pw: BW + padX[c], ph: BH + padY[r] });
        if (L && code === 'L') block.wild = L.wild[r][c]; // forest, oil palm or scrub until it is built on
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
      case 'e': at('privschool', block.hqName || 'Private School', 1, 0, 9, 7); at('padang', 'Field', 1, 7, 12, 4, { decor: true }); break; // private school with a sports field
      case 'h': at('privhosp', block.hqName || 'Private Hospital', 4, 0, 10, 9); at('park', 'Garden', 0, 0, 3, 11, { decor: true }); break;
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
      case 'J': // places of worship
        at('masjid', 'Masjid Jamek', 1, 1, 7, 9);
        at('tokong', 'Tokong Tian Hou', 9, 0, 5, 4);
        at('kuil', 'Kuil Sri Murugan', 9, 4, 5, 4);
        at('gereja', 'Gereja St. Mary', 9, 8, 5, 3);
        break;
      case 'j': // justice: police station, magistrates' court, prison, drug rehabilitation centre
        at('police', 'Balai Polis', 0, 0, 4, 4);
        at('jail', 'Lokap', 4, 0, 3, 4);
        at('court', 'Mahkamah', 8, 0, 6, 4);
        at('prison', 'Penjara', 0, 5, 9, 6);
        at('rehab', 'Pusat Pemulihan', 10, 5, 4, 6);
        break;
      case 'g': // the town hall and the padang where rallies are held
        at('townhall', 'Dewan Bandaraya', 1, 1, 8, 8);
        at('padang', 'Padang', 10, 0, 4, 11, { decor: true });
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

  // Column / row of a tile coordinate (block index), for any layout.
  LES.townColOf = function (town, x) {
    if (!town.colX) return Math.max(0, Math.min(town.cols - 1, Math.floor(x / (BW + ROAD))));
    let c = 0;
    while (c + 1 < town.cols && town.colX[c + 1] <= x) c++;
    return c;
  };
  LES.townRowOf = function (town, y) {
    if (!town.rowY) return Math.max(0, Math.min(town.rows - 1, Math.floor(y / (BH + ROAD))));
    let r = 0;
    while (r + 1 < town.rows && town.rowY[r + 1] <= y) r++;
    return r;
  };
  LES.townBlockAt = (town, x, y) => town.blocks[LES.townRowOf(town, y) * town.cols + LES.townColOf(town, x)];
  // Road pieces: horizontal road j between vertical roads c-1 and c (c = 0 runs to the west
  // edge), vertical road c between horizontal roads r-1 and r (r = 0 runs to the north edge).
  LES.hasH = (town, j, c) => !town.layout || town.layout.hseg[j][c];
  LES.hasV = (town, c, r) => !town.layout || town.layout.vseg[c][r];

  // Every road piece and intersection that exists, in pixels (for drawing).
  LES.roadPieces = function (town) {
    const { cols, rows, roadsX, roadsY, T } = town, pieces = [], nodes = [];
    for (let j = 0; j < rows; j++) for (let c = 0; c < cols; c++) {
      if (!LES.hasH(town, j, c)) continue;
      const x0 = c === 0 ? 0 : (roadsX[c - 1] + 2) * T, x1 = roadsX[c] * T;
      pieces.push({ h: true, j, c, x: x0, y: roadsY[j] * T, w: x1 - x0, len: x1 - x0, edge: c === 0 });
    }
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if (!LES.hasV(town, c, r)) continue;
      const y0 = r === 0 ? 0 : (roadsY[r - 1] + 2) * T, y1 = roadsY[r] * T;
      pieces.push({ h: false, c, r, x: roadsX[c] * T, y: y0, h2: y1 - y0, len: y1 - y0, edge: r === 0 });
    }
    for (let j = 0; j < rows; j++) for (let c = 0; c < cols; c++) {
      const W = LES.hasH(town, j, c), E = c + 1 < cols && LES.hasH(town, j, c + 1), N = LES.hasV(town, c, j), S = j + 1 < rows && LES.hasV(town, c, j + 1);
      const deg = (W ? 1 : 0) + (E ? 1 : 0) + (N ? 1 : 0) + (S ? 1 : 0);
      if (deg) nodes.push({ c, j, x: roadsX[c] * T, y: roadsY[j] * T, W, E, N, S, deg });
    }
    return { pieces, nodes };
  };

  // Seeded street plan for a varied town. Rules: the station column and the bus loops are
  // never cut; every block keeps a road for its doors; the network stays connected.
  LES.planLayout = function (size, seed, tpl) {
    const R = new LES.RNG(`${seed}|layout|${size}`);
    const rows = tpl.length, cols = tpl[0].length;
    const gapX = Array(cols).fill(ROAD), gapY = Array(rows).fill(ROAD);
    const avenueX = [], avenueY = [];
    const bx = LES.busIndices(cols, rows);
    // Plots of different sizes: the spare ground becomes car parks, playgrounds and gardens.
    const padX = Array.from({ length: cols }, (_, c) => (c === 0 ? 0 : R.pick([0, 0, 1, 2, 3, 4, 5])));
    const padY = Array.from({ length: rows }, () => R.pick([0, 0, 1, 2, 3, 4]));
    // One side of the map is coast or forested hills (east or south).
    const edge = { kind: R.pick(['sea', 'sea', 'hills', 'none']), side: R.next() < 0.5 ? 'e' : 's' };
    edge.size = edge.kind === 'none' ? 0 : edge.side === 'e' ? 12 : 9;
    for (let c = 1; c < cols - 1; c++) if (R.next() < 0.22) { gapX[c] = 4; avenueX.push(c); }
    for (let r = 0; r < rows - 1; r++) if (R.next() < 0.2) { gapY[r] = 4; avenueY.push(r); }
    // A river winds down one of the north-south gaps (no road along it, bridges across).
    let river = -1;
    if (cols >= 6 && R.next() < 0.9) {
      const opts = [];
      for (let c = 2; c < cols - 2; c++) if (!bx.x.has(c)) opts.push(c);
      if (opts.length) { river = R.pick(opts); gapX[river] = 5; const i = avenueX.indexOf(river); if (i >= 0) avenueX.splice(i, 1); }
    }
    const vseg = Array.from({ length: cols }, (_, c) => Array(rows).fill(c !== river));
    const hseg = Array.from({ length: rows }, () => Array(cols).fill(true));
    const connected = () => {
      const id = (c, r) => r * cols + c, adj = new Map();
      const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
      for (let r = 0; r < rows; r++) for (let c = 1; c < cols; c++) if (hseg[r][c]) link(id(c - 1, r), id(c, r));
      for (let c = 0; c < cols; c++) for (let r = 1; r < rows; r++) if (vseg[c][r]) link(id(c, r - 1), id(c, r));
      const nodes = [...adj.keys()];
      if (!nodes.length) return false;
      const seen = new Set([nodes[0]]), q = [nodes[0]];
      while (q.length) for (const n of adj.get(q.pop())) if (!seen.has(n)) { seen.add(n); q.push(n); }
      return seen.size === nodes.length;
    };
    const special = (c, r) => 'NGZUjg'.includes(tpl[r][c]);
    // Superblocks: drop a few short road pieces between neighbouring blocks.
    for (let r = 0; r < rows; r++) for (let c = 1; c < cols - 1; c++) {
      if (c === river || bx.x.has(c) || special(c, r) || special(c + 1 < cols ? c + 1 : c, r) || R.next() > 0.2) continue;
      if (r === 0 || !vseg[c][r - 1] || (r + 1 < rows && !vseg[c][r + 1])) continue; // keep cuts apart
      vseg[c][r] = false;
      if (!connected()) vseg[c][r] = true;
    }
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols; c++) {
      if (bx.y.has(r) || special(c, r) || special(c, r + 1) || c === river || c === river + 1 || R.next() > 0.18) continue; // bridges always lead somewhere
      if (!hseg[r - 1][c] || !hseg[r + 1][c] || !hseg[r][c - 1] || (c + 1 < cols && !hseg[r][c + 1])) continue;
      hseg[r][c] = false;
      if (!connected()) hseg[r][c] = true;
    }
    const wild = tpl.map(line => [...line].map(() => R.pick(['forest', 'forest', 'palm', 'scrub'])));
    return { gapX, gapY, padX, padY, edge, avenueX, avenueY, river, vseg, hseg, wild };
  };

  // Shortest road route between two intersections (Dijkstra, cached per start node).
  function roadGraph(town) {
    if (town._graph) return town._graph;
    const { cols, rows, roadsX, roadsY, T } = town, n = cols * rows;
    const nx = c => (roadsX[c] + 1) * T, ny = r => (roadsY[r] + 1) * T;
    const adj = Array.from({ length: n }, () => []);
    for (let r = 0; r < rows; r++) for (let c = 1; c < cols; c++) if (LES.hasH(town, r, c)) { const a = r * cols + c - 1, b = r * cols + c, d = nx(c) - nx(c - 1); adj[a].push([b, d]); adj[b].push([a, d]); }
    for (let c = 0; c < cols; c++) for (let r = 1; r < rows; r++) if (LES.hasV(town, c, r)) { const a = (r - 1) * cols + c, b = r * cols + c, d = ny(r) - ny(r - 1); adj[a].push([b, d]); adj[b].push([a, d]); }
    town._graph = { adj, nx, ny, from: new Map() };
    Object.defineProperty(town, '_graph', { enumerable: false, writable: true, value: town._graph }); // a cache, not saved
    return town._graph;
  }
  function shortest(g, src) {
    let t = g.from.get(src);
    if (t) return t;
    const n = g.adj.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[src] = 0;
    for (;;) { // n is a few hundred: a simple O(n^2) Dijkstra is fast enough
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const [v, d] of g.adj[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
    }
    t = { dist, prev };
    g.from.set(src, t);
    return t;
  }
  // Intersections at either end of the road piece in front of a building's door.
  function doorEnds(town, b) {
    const j = town.roadsY.indexOf(b.roadY / town.T - 1), c = LES.townColOf(town, b.door.x / town.T);
    const ends = [{ node: j * town.cols + c, x: (town.roadsX[c] + 1) * town.T }];
    if (c > 0) ends.push({ node: j * town.cols + c - 1, x: (town.roadsX[c - 1] + 1) * town.T });
    return { j, c, ends };
  }
  function networkPath(town, a, b) {
    const pa = a.door, pb = b.door, g = roadGraph(town);
    const A = doorEnds(town, a), B = doorEnds(town, b);
    if (A.j === B.j && A.c === B.c) return [pa, { x: pa.x, y: a.roadY }, { x: pb.x, y: b.roadY }, pb];
    let best = null;
    for (const ea of A.ends) {
      const sp = shortest(g, ea.node);
      for (const eb of B.ends) {
        const d = Math.abs(pa.x - ea.x) + sp.dist[eb.node] + Math.abs(pb.x - eb.x);
        if (!best || d < best.d) best = { d, ea, eb, sp };
      }
    }
    if (!best || !Number.isFinite(best.d)) return [pa, pb];
    const nodes = [];
    for (let v = best.eb.node; v >= 0; v = best.sp.prev[v]) { nodes.push(v); if (v === best.ea.node) break; }
    nodes.reverse();
    const pts = [pa, { x: pa.x, y: a.roadY }];
    for (const v of nodes) pts.push({ x: g.nx(v % town.cols), y: g.ny(Math.floor(v / town.cols)) });
    pts.push({ x: pb.x, y: b.roadY }, pb);
    return pts;
  }

  // Walking/driving route between two buildings along the roads (pixel points).
  LES.townPath = function (town, a, b) {
    const pa = a.door, pb = b.door;
    if (a.id === b.id) return [pa, pb];
    if (town.layout) return networkPath(town, a, b);
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
  // Road indices the bus loops use (kept uncut by the varied layout).
  LES.busIndices = function (nx, ny) {
    const x = new Set([0, nx - 2, Math.floor(nx / 4), Math.min(nx - 1, Math.floor(nx * 3 / 4) + 1)]);
    const y = new Set([0, ny - 2, Math.floor(ny / 4), Math.min(ny - 1, Math.floor(ny * 3 / 4))]);
    if (nx >= 9) { x.add(Math.floor(nx / 2)); x.add(nx - 1); y.add(ny - 1); }
    return { x, y };
  };
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
          if (horizontal && town.layout && xs.indexOf(r) === town.layout.river) continue; // no stop on the bridge
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
