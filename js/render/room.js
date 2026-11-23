// Inside view (art upgrade Phase 2): when you follow someone who is at home, the map can show the inside of the
// home instead of the town. Only real people are shown: the household members whose position (renderer.posOf) is
// inside this home right now. What they do at home is not simulated hour by hour, so a fixed everyday routine is
// shown (sleep at night, meals, cooking, homework, play, TV, prayer, holding the baby), picked from age, time,
// health and a hash of id and hour. It reads the world and never changes it (no world RNG, no writes).
(function (LES) {
  'use strict';
  const R = LES.Room = {};
  const A = () => LES.ArtPack;
  const TS = 16; // tiles; the room canvas is (columns x 16) wide and (16 + rows x 16) high, sized by its plan
  const HOME_KINDS = new Set(['kampung', 'terrace', 'flat', 'condo', 'bungalow']);
  const hash = (...a) => { let n = 0x9e3779b1; for (const v of a) { n = Math.imul(n ^ (v | 0), 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; } return (n >>> 0) / 4294967296; };

  // Three kampung house plans (drawn by ChatGPT as text, Phase 1B). Row 0 is the back wall, row 10 the entrance.
  // # wall, W window, | - inner walls, D door, . floor, k kitchen floor, B double bed, b single bed, w wardrobe,
  // d desk, F fridge, C stove, K sink, T dining table, S sofa, s shelf, M memory cabinet, P photo, E entrance.
  // Floor plans by home kind (art upgrade Phase 4): three each. Kampung houses: ChatGPT's plans (Phase 1B);
  // terrace houses: those plans mirrored; small flats 12 x 9, apartments with a balcony (=) 14 x 10 and big
  // houses 20 x 12 (Claude, Phase 4). Every country uses the same plans with its own look (R.look).
  R.PLANS = {
    kampung: [
      ['##W####W#####W##', '.P.w.|....|FCCKk', '.BB..|b.b.|kkkkk', '.BB..|b.b.|kTTkk', '.....|dd..|kTTkk', '---D---D----D---', '................', '.SSS.........s..', '......M.........', '................', '-------E--------'],
      ['##W#####W####W##', 'kFCCKk|....|P.w.', 'kkkkkk|b.b.|BB..', 'kkTTkk|b.b.|BB..', 'kkTTkk|.d..|....', '----D---D----D--', '................', '.SSS....M.......', '..............s.', '................', '-------E--------'],
      ['##W#####W####W##', '.P.w..|...kFCCKk', '.BB...|b.bkkkkkk', '.BB...|b.bkkkkkk', '......|dd.kkTTkk', '---D----D-kkTTkk', '..........kkkkkk', '.SSS.....skkkkkk', '......M...kkkskk', '..........kkkkkk', '-------E--------']
    ],
    terrace: [
      ['##W#####W####W##', 'kKCCF|....|.w.P.', 'kkkkk|.b.b|..BB.', 'kkTTk|.b.b|..BB.', 'kkTTk|..dd|.....', '---D----D---D---', '................', '..s.........SSS.', '.........M......', '................', '--------E-------'],
      ['##W####W#####W##', '.w.P|....|kKCCFk', '..BB|.b.b|kkkkkk', '..BB|.b.b|kkTTkk', '....|..d.|kkTTkk', '--D----D---D----', '................', '.......M....SSS.', '.s..............', '................', '--------E-------'],
      ['##W####W#####W##', 'kKCCFk...|..w.P.', 'kkkkkkb.b|...BB.', 'kkkkkkb.b|...BB.', 'kkTTkk.dd|......', 'kkTTkk-D----D---', 'kkkkkk..........', 'kkkkkks.....SSS.', 'kkskkk...M......', 'kkkkkk..........', '--------E-------']
    ],
    flat: [
      ['##W####W##W#', 'PBBw|b.d|FCK', '.BB.|b..|kkk', '....|...|kTT', '--D---D-|kTT', '.SSS.....kkk', '........M..s', '............', '----E-------'],
      ['##W###W###W#', 'FCK|PBB.w.b.', 'kkk|.BB...b.', 'kTT|.......d', 'kTT|---D----', 'kkk.SSS.....', '..........s.', '....M.......', '-------E----'],
      ['#W##W###W##W', 'PBB.w|b.b.d.', '.BB..|b.b...', '.....|......', '--D-----D---', '.SSS...|FCKk', '.......Dkkkk', '..M..s.|kTTk', '---E--------']
    ],
    condo: [
      ['##W###W####W##', 'PBBw|b.b|FCKkk', '.BB.|b.b|kkkkk', '....|..d|kkTTk', '--D---D-|kkTTk', 'E.SSS.........', '..........M.s.', '..............', '==============', '--------------'],
      ['##W####W###W##', 'FCKk|PBB.w|b.b', 'kkkk|.BB..|b.b', 'kTTk|.....|..d', 'kTTk|--D---D--', 'kkkk.SSS.....E', '..........M.s.', '..............', '==============', '--------------'],
      ['#W###W###W###W', 'PBB.w|FCKkk|b.', '.BB..|kkkkk|b.', '.....|kTTkk|.d', '--D--|kTTkk|D-', '.SSS..........', '.........M..s.', 'E.............', '==============', '--------------']
    ],
    bungalow: [
      ['##W####W####W####W##', 'PBB.w|b.b.|b.d|FCKkk', '.BB..|b.b.|b..|kkkkk', '.....|....|...|kkkkk', '.....|..d.|...|kkkkk', '--D----D---D---D----', '..............|.TT..', '.SSS..........D.TT..', '.........M..s.|.....', '..............|.....', '..............|.....', '--------E-----------'],
      ['##W####W####W####W##', 'kkKCF|d.b|.b.b|w.BBP', 'kkkkk|..b|.b.b|..BB.', 'kkkkk|...|....|.....', 'kkkkk|...|.d..|.....', '----D---D---D----D--', '..TT.|..............', '..TT.D..........SSS.', '.....|.s..M.........', '.....|..............', '.....|..............', '-----------E--------'],
      ['#W####W####W####W##W', 'FCKkk|PBB..w|b.b|b.b', 'kkkkk|.BB...|b.b|b.b', 'kTTkk|......|...|...', 'kTTkk|......|.d.|..d', 'kkkkk---D-----D---D-', '....................', '.SSS........M.....s.', '....................', '....................', '....................', '---------E----------']
    ],
  };
  R.LAYOUTS = R.PLANS.kampung; // the kampung plans (older code and tests use this list)
  // The look of a home: which sprite each letter of the plan becomes, and the floors, walls, windows and extras.
  const OLD = {
    S: { B: 'home.bed_double', w: 'home.wardrobe', d: 'home.desk', F: 'home.fridge', C: 'home.stove_counter', K: 'home.sink_counter', T: 'home.table_dining', S: 'home.sofa_rattan', s: 'home.bookshelf', M: 'home.display_cabinet' },
    single: ['home.bed_single_blue', 'home.bed_single_pink'], chair: 'home.dining_chair_front', rug: 'home.rug', coffee: 'home.coffee_table', tv: 'anim.tv.0', fan: 'home.fan_standing',
    shoe: 'home.shoe_rack', plant: 'home.plant', flame: true, floor: ['home.floor_wood.0', 'home.floor_wood.1', 'home.floor_wood.2', 'home.floor_wood.3'], floorKitchen: ['home.floor_kitchen.0', 'home.floor_kitchen.1'],
    wall: ['home.wall_wood.0'], wallKitchen: 'home.wall_kitchen', window: ['home.window_nako', 'home.window_shutter'], extras: [],
  };
  const tiles = c => ({ floor: [`${c}.floor.0`, `${c}.floor.1`], floorBed: `${c}.floor_bed`, floorKitchen: [`${c}.floor_kitchen`], wall: [`${c}.wall.0`, `${c}.wall.1`], wallKitchen: `${c}.wall_kitchen`, window: [`${c}.window`, `${c}.window_curtain`] });
  const MODERN = {
    S: { B: 'mod.bed_double', w: 'mod.wardrobe', d: 'mod.desk', F: 'mod.fridge', C: 'mod.counter_hob', K: 'mod.sink', T: 'mod.dining_set', S: 'mod.sofa', s: 'mod.bookshelf', M: 'home.display_cabinet' },
    single: ['mod.bed_single_blue', 'mod.bed_single_green'], chair: 'mod.dining_chair', tableChairs: true, rug: 'home.rug', coffee: 'mod.coffee_table', tv: 'mod.tv_stand', tvPic: 'mod.tv_pic', fan: null,
    shoe: 'mod.shoe_cabinet', plant: 'mod.plant', flame: false,
    extras: [{ id: 'mod.aircon', where: 'wall' }, { id: 'mod.washer', where: 'kitchen' }, { id: 'mod.floor_lamp', where: 'living' }],
  };
  const COUNTRY = {
    my: { extras: [{ id: 'my.rattan_chair', where: 'living' }, { id: 'my.batik', where: 'wall' }, { id: 'my.kettle', where: 'kitchen' }], shoe: 'my.shoe_rack', fan: 'home.fan_standing' },
    uk: { extras: [{ id: 'uk.fireplace', where: 'living' }, { id: 'uk.armchair', where: 'living' }, { id: 'uk.radiator', where: 'wall' }, { id: 'uk.coat_hooks', where: 'wall' }] },
    us: { extras: [{ id: 'us.island', where: 'kitchen' }, { id: 'us.recliner', where: 'living' }, { id: 'us.clock', where: 'wall' }] },
    cn: { extras: [{ id: 'cn.tea_table', where: 'living' }, { id: 'cn.bamboo', where: 'living' }, { id: 'cn.lantern', where: 'wall' }, { id: 'cn.scroll', where: 'wall' }, { id: 'cn.rice_cooker', where: 'kitchen' }] },
  };
  // A US trailer: the cheapest home, with bunk beds, a folding table and a mini fridge.
  const MOBILE = Object.assign({}, OLD, tiles('us'), {
    S: Object.assign({}, OLD.S, { T: 'mob.table', F: 'mob.mini_fridge' }), single: ['mob.bunk'], chair: 'mob.chair', wall: ['mob.wall'], wallKitchen: 'mob.wall', window: ['mob.window'], fan: null, extras: [],
  });
  // Which look a home has: Malaysian kampung houses keep the kampung set; the cheapest homes elsewhere and the
  // Malaysian low-cost flats use the older furniture with the country's floors and walls; the rest are modern.
  R.look = function (country, kind) {
    const c = COUNTRY[country] ? country : 'my', extra = COUNTRY[c];
    if (kind === 'kampung' && c === 'my') return OLD;
    if (kind === 'kampung' && c === 'us') return MOBILE;
    const base = (kind === 'kampung' || (kind === 'flat' && c === 'my')) ? OLD : MODERN;
    return Object.assign({}, base, tiles(c), extra.shoe ? { shoe: extra.shoe } : {}, { fan: extra.fan || (base === OLD ? OLD.fan : null), extras: (base === MODERN ? MODERN.extras : []).concat(extra.extras.slice(0, base === OLD ? 2 : 9)) });
  };
  R.plansFor = kind => R.PLANS[kind] || R.PLANS.kampung;
  const top = r => 16 + r * TS; // top of layout row r on the room canvas (row 0 = the back wall, drawn 2 tiles tall)

  R.isHome = b => !!b && HOME_KINDS.has(b.kind);
  R.available = () => !!(A() && A().ready && A().has('home.bed_double') && A().has('person.adult.stand'));
  R.layoutOf = b => Math.floor(hash(b.id, 7) * R.plansFor(b.kind).length); // fixed per home: it never changes by itself
  R.rowsOf = b => R.plansFor(b.kind)[R.layoutOf(b)];

  // Furniture rectangles of a plan: each run of one letter becomes one piece.
  function rects(rows) {
    const seen = new Set(), out = [];
    const cols = rows[0].length;
    for (let r = 1; r < rows.length; r++) for (let c = 0; c < cols; c++) {
      const ch = rows[r][c];
      if (!'BwdFCKTSsMbP'.includes(ch)) continue;
      if (seen.has(`${r},${c}`)) continue;
      let c1 = c, r1 = r;
      if (ch !== 'b') while (c1 + 1 < cols && rows[r][c1 + 1] === ch) c1++;
      while (r1 + 1 < rows.length && rows[r1 + 1][c] === ch) r1++;
      for (let y = r; y <= r1; y++) for (let x = c; x <= c1; x++) seen.add(`${y},${x}`);
      out.push({ ch, c0: c, c1, r0: r, r1 });
    }
    return out;
  }

  // Which room each floor tile belongs to: rooms are areas closed by walls and doors (# | - D W E). A room with
  // the double bed is the parents' room, one with single beds the children's room; kitchen tiles (k) are the
  // kitchen, and every other floor is the living room (also in an open-plan kitchen and living room).
  R.zones = function (rows) {
    const id = rows.map(r => [...r].map(() => -1)), tags = [];
    const cols = rows[0].length, open = ch => !'#|-DWE='.includes(ch), kind = ch => ('kTCKF'.includes(ch) ? 'k' : '.'); // kitchen tiles and wood floor are separate rooms
    for (let r = 1; r < rows.length; r++) for (let c = 0; c < cols; c++) {
      if (!open(rows[r][c]) || id[r][c] >= 0) continue;
      const n = tags.length, stack = [[r, c]], has = new Set();
      id[r][c] = n;
      while (stack.length) {
        const [y, x] = stack.pop(); has.add(rows[y][x]);
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const Y = y + a, X = x + b;
          if (Y >= 1 && Y < rows.length && X >= 0 && X < cols && id[Y][X] < 0 && open(rows[Y][X]) && kind(rows[Y][X]) === kind(rows[y][x])) { id[Y][X] = n; stack.push([Y, X]); }
        }
      }
      tags.push(has.has('B') ? 'parents' : has.has('b') ? 'kids' : 'living');
    }
    return rows.map((row, r) => [...row].map((ch, c) => ch === 'k' || ('TCKF'.includes(ch) && id[r][c] >= 0 && tags[id[r][c]] === 'living') ? 'kitchen' : id[r][c] >= 0 ? tags[id[r][c]] : null));
  };

  // The plan of one home: furniture to draw and the places people use. `fam` adds a cot for a baby, the faith
  // corner of the family and a floor mattress for extra sleepers.
  R.plan = function (layout, fam, look) {
    const rows = Array.isArray(layout) ? layout : R.LAYOUTS[layout], L = look || OLD, cols = rows[0].length, W = cols * TS, H = 16 + rows.length * TS, items = [], spots = { bed: [], seat: [], cook: [], sofa: [], desk: [], play: [], stand: [], cot: [], pray: [], shrine: null, lamp: [], tv: null, fan: null, flame: null };
    const sz = id => A().size(id);
    const add = (id, cx, bottom, extra) => { const [w, h] = sz(id); const it = Object.assign({ id, x: Math.round(cx - w / 2), y: bottom - h, w, h, key: bottom }, extra || {}); items.push(it); return it; };
    // Put a piece of furniture as near as possible to (px, pbottom) on free floor: inside the room, on floor
    // tiles of one room (no wall, door or other furniture under its footprint), not overlapping other pieces.
    const zone = R.zones(rows);
    const zoneAt = (x, y) => { const c = Math.floor(x / TS), r = Math.floor((y - 16) / TS); return r >= 1 && r < rows.length && c >= 0 && c < cols && '.k'.includes(rows[r][c]) ? zone[r][c] : null; };
    // Free floor of one room under a footprint (its whole base), not overlapping other furniture.
    const clear = (x0, y0, x1, y1, z) => {
      if (x0 < 2 || x1 > W - 2 || y0 < 30 || y1 > H - 2) return false;
      for (let x = x0 + 1; x <= x1 + 3; x += 4) { const X = Math.min(x, x1 - 1); if (zoneAt(X, y1 - 2) !== z || zoneAt(X, y0 + 1) !== z) return false; }
      return !items.some(it => (it.block || (!it.floor && !it.wall)) && x0 < it.x + it.w + 1 && x1 > it.x - 1 && y0 < (it.block ? it.y + it.h : it.key) && y1 > (it.block ? it.y : it.y + Math.max(0, it.h - 14)));
    };
    // Put a piece as near as possible to (px, pbottom), only on free floor of room `z` (default: living room).
    const fit = (id, px, pb, extra, reach, z) => {
      const [w, h] = sz(id);
      if (!w) return null;
      let best = null, bd = Infinity;
      const R2 = reach || 200;
      for (let dy = -R2; dy <= R2; dy += 4) for (let dx = -R2; dx <= R2; dx += 4) {
        const cx = px + dx, b = pb + dy, x0 = Math.round(cx - w / 2), d = dx * dx + dy * dy * 2;
        if (d < bd && clear(x0, b - Math.min(h, 14), x0 + w, b, z || 'living')) { bd = d; best = [cx, b]; }
      }
      return best ? add(id, best[0], best[1], extra) : null;
    };
    let single = 0;
    for (const q of rects(rows)) {
      const cx = (q.c0 + q.c1 + 1) * TS / 2, bottom = top(q.r1 + 1);
      if (q.ch === 'P') { items.push({ id: 'home.photo_large', x: q.c0 * TS, y: 8, key: -1, wall: true }); continue; }
      if (q.ch === 'b') {
        const it = add(L.single[single++ % L.single.length], cx, bottom);
        spots.bed.push({ x: cx, y: it.y + 2, kind: 'single', key: bottom + 0.5 });
        if (it.id === 'mob.bunk') spots.bed.push({ x: cx, y: it.y + 16, kind: 'single', key: bottom + 0.6 }); // the lower bunk
        continue;
      }
      const it = add(L.S[q.ch], cx, bottom);
      if (q.ch === 'B') {
        spots.bed.unshift({ x: cx - 8, y: it.y + 3, kind: 'double', key: bottom + 0.5 }, { x: cx + 8, y: it.y + 3, kind: 'double', key: bottom + 0.5 });
        const lamp = fit('anim.lamp.0', it.x + it.w + 8, bottom - 6, { lamp: true }, 32, 'parents') || fit('anim.lamp.0', it.x - 8, bottom - 6, { lamp: true }, 32, 'parents');
        if (lamp) spots.lamp.push({ x: lamp.x + lamp.w / 2, y: lamp.y + 3 });
        if (fam.baby) { const cot = fit('home.cot', it.x + it.w + 14, bottom + 4, null, 0, 'parents'); if (cot) spots.cot.push({ x: cot.x + cot.w / 2, y: cot.y + 8, key: cot.key + 0.5 }); }
      }
      if (q.ch === 'T') { // two chairs behind the table (heads above it), one at each side
        spots.seat.push({ x: it.x + 7, y: it.y + 9, key: bottom - 1 }, { x: it.x + it.w - 7, y: it.y + 9, key: bottom - 1 });
        if (!L.tableChairs) for (const dx of [7, it.w - 7]) add(L.chair, it.x + dx, it.y + 12, { key: bottom - 2 }); // chairs behind the table
        for (const sx of [it.x - 7, it.x + it.w + 7]) { // a chair at each end where there is floor: people sit on it
          const z = zoneAt(sx, bottom - 2);
          if (z !== 'kitchen' && z !== 'living') continue;
          const ch = add(L.chair, sx, bottom + 1, { key: bottom });
          spots.seat.push({ x: sx, y: ch.y + 13, key: bottom + 0.5 });
        }
      }
      if (q.ch === 'C') { spots.cook.push({ x: cx, y: bottom + 12, key: bottom + 12, view: 'back' }); if (L.flame) spots.flame = { x: it.x + 5, y: it.y + 6 }; }
      if (q.ch === 'd') spots.desk.push({ x: cx, y: it.y + 9, key: bottom - 1 });
      if (q.ch === 'S') {
        for (const dx of [-14, 0, 14]) spots.sofa.push({ x: cx + dx, y: bottom - 4, key: bottom + 0.5 });
        const [rw, rh] = sz(L.rug);
        items.push({ id: L.rug, x: Math.round(cx - 20), y: bottom + 2, w: rw, h: rh, key: -2, floor: true, block: true }); // furniture keeps off the rug
        add(L.coffee, cx + 4, bottom + 22);
        for (const dx of [-14, 2, 18]) spots.play.push({ x: cx + dx, y: bottom + 30, key: bottom + 30 });
        spots.sofaAt = { cx, bottom };
      }
    }
    if (spots.sofaAt) { // the TV and the fan beside the sofa, wherever there is room
      const { cx, bottom } = spots.sofaAt;
      spots.tv = fit(L.tv, cx + 50, bottom, { tv: true }, 48);
      if (L.fan) spots.fan = fit(L.fan, cx + 78, bottom, null, 48);
    }
    for (let r = 1; r < rows.length; r++) { const c = rows[r].indexOf('E'); if (c >= 0) fit(L.shoe, c * TS + (c > cols / 2 ? -24 : 30), top(Math.min(r, rows.length - 2)), null, 32); }
    fit(L.plant, W - 14, H - 40, null, 48);
    // The country's own pieces: in the living room or the kitchen (wall pieces hang with the keepsakes).
    for (const x of L.extras || []) {
      if (x.where === 'living') fit(x.id, W * (0.25 + hash(x.id.length, cols) * 0.5), H - 30, null, 0, 'living');
      else if (x.where === 'kitchen') fit(x.id, W / 2, top(3), null, 0, 'kitchen');
    }
    // Free floor in the living room for standing and prayer.
    const used = (x, y) => items.some(it => !it.floor && !it.wall && x >= it.x - 2 && x <= it.x + it.w + 2 && y >= it.y && y <= it.key + 2);
    for (let r = 1; r < rows.length; r++) for (let c = 1; c < cols - 1; c++) {
      const x = c * TS + 8, y = top(r) + 14;
      if (zone[r][c] === 'living' && rows[r][c] === '.' && !used(x, y)) spots.stand.push({ x, y, key: y });
    }
    // The family's faith corner: a prayer mat is laid out when someone prays; other faiths have a shrine or a cross.
    const free = spots.stand.filter(s => s.x > W * 0.55).concat(spots.stand);
    if (fam.faith === 'islam' && free.length) spots.pray.push(free[0]);
    else if (fam.faith && fam.faith !== 'none' && free.length) {
      const f = free[0], id = fam.faith === 'christianity' ? 'home.cross' : fam.faith === 'hinduism' ? 'home.shelf_hindu' : 'home.altar_chinese';
      const s = fit(id, f.x, f.y - 8, null, 48);
      if (s) {
        spots.shrine = { x: s.x + s.w / 2, y: s.key + 14, key: s.key + 14 };
        spots.stand = spots.stand.filter(q => Math.abs(q.x - spots.shrine.x) + Math.abs(q.y - spots.shrine.y) > 18 && !(q.x > s.x - 4 && q.x < s.x + s.w + 4 && q.y > s.y && q.y < s.key + 6));
      }
    }
    // Floor mattresses (tilam) for extra sleepers: in the children's room, else the parents' room, never the kitchen.
    // Only a very big household (bedrooms full) also sleeps on mattresses in the living room.
    for (let k = 0; k < 8 && fam.sleepers > spots.bed.length; k++) {
      const kid = spots.bed.find(b => b.kind === 'single');
      const t = (kid && fit('home.tilam', kid.x + 20, kid.key + 6, null, 0, 'kids')) || fit('home.tilam', W / 4, top(3), null, 0, 'parents') || fit('home.tilam', 40, H - 40, null, 0, 'living');
      if (!t) break;
      spots.bed.push({ x: t.x + t.w / 2 - 6, y: t.y + 2, kind: 'floor', key: t.key + 0.5 }, { x: t.x + t.w / 2 + 6, y: t.y + 2, kind: 'floor', key: t.key + 0.5 });
    }
    placeKeepsakes(rows, items, Object.assign({}, fam, { keep: (fam.keep || []).concat((L.extras || []).filter(x => x.where === 'wall')) }), L);
    return { rows, items, spots, W, H, look: L };
  };

  // Where keepsakes go: the back wall between windows (not behind tall furniture), the top of the memory cabinet
  // or a shelf, the desk, the rug, the fridge door and beside the cot. Pieces that find no place are left out.
  function placeKeepsakes(rows, items, fam, L) {
    const art = A(), keep = (fam.keep || []).filter(k => art.has(k.id)), cols = rows[0].length;
    L = L || OLD;
    if (!keep.length) return;
    const tall = x => items.some(it => !it.floor && !it.wall && it.y < 30 && x + 12 > it.x && x < it.x + it.w);
    const wallCols = [];
    for (let c = 0; c < cols; c++) {
      const near = [-1, 0, 1].some(d => rows[0][c + d] === 'W') || rows[1][c] === 'P' || 'FCKk'.includes(rows[1][c]);
      if (rows[0][c] === '#' && !near && !tall(c * TS + 2)) wallCols.push(c);
    }
    const tops = items.filter(it => it.id === L.S.M || it.id === L.S.s).map(it => ({ it, x: it.x + 2 }));
    const desk = items.find(it => it.id === L.S.d), fridge = items.find(it => it.id === L.S.F), rug = items.find(it => it.id === L.rug), cot = items.find(it => it.id === 'home.cot');
    let rugN = 0, deskX = desk ? desk.x + desk.w - 2 : 0;
    const sorted = keep.slice().sort((a, b) => (b.ancestor ? 1 : 0) - (a.ancestor ? 1 : 0)); // the ancestors first: they must not be crowded out
    for (const k of sorted) {
      const [w, h] = art.size(k.id);
      let it = null;
      if (k.where === 'wall' && wallCols.length) { const c = wallCols.shift(); it = { x: c * TS + Math.round((16 - w) / 2), y: 22 - h, wall: true, key: -1 }; }
      else if (k.where === 'shelf') { const t = tops.find(t => t.x + w <= t.it.x + t.it.w - 1); if (t) { it = { x: t.x, y: t.it.y + 5 - h, key: t.it.key + 0.1 }; t.x += w + 1; } }
      else if (k.where === 'desk' && desk && deskX - w > desk.x + 1) { it = { x: deskX - w, y: desk.y + 6 - h, key: desk.key + 0.1 }; deskX -= w + 1; }
      else if (k.where === 'rug' && rug && rugN < 3) { const [rw] = art.size(L.rug); it = { x: rug.x + 4 + rugN * Math.round((rw - 8) / 3), y: rug.y + 22 - h, key: -1 }; rugN++; }
      else if (k.where === 'fridge' && fridge) it = { x: fridge.x + Math.round((fridge.w - w) / 2), y: fridge.y + 13, key: fridge.key + 0.1 };
      else if (k.where === 'cot' && cot) it = { x: cot.x + cot.w + 1, y: cot.key - h, key: cot.key };
      if (it) items.push(Object.assign({ id: k.id, w, h, label: k.label, paint: k.paint, keep: !!k.label || !!k.paint || k.where !== 'wall' || !!k.ancestor }, it));
    }
  }

  // Paint people into an empty photo frame: tiny busts side by side in the white middle.
  function paintFrame(g, w, it) {
    const ids = it.paint === 'family' ? null : it.paint, inner = { x: it.x + 2, y: it.y + 2, w: it.w - 4, h: it.h - 4 };
    const ppl = (ids || []).map(id => w.people[id]).filter(Boolean);
    if (!ppl.length || !LES.Portrait || !LES.Portrait.available()) return;
    const each = Math.max(3, Math.floor(inner.w / ppl.length)), bh = Math.min(inner.h, Math.round(each * 44 / 32));
    ppl.forEach((p, i) => {
      const b = LES.Portrait.bust(w, p, 'happy');
      if (b) g.drawImage(b, inner.x + i * each + Math.floor((each - Math.round(bh * 32 / 44)) / 2), inner.y + inner.h - bh, Math.round(bh * 32 / 44), bh);
    });
  }
  R.paintFrame = paintFrame;

  // Hour of the day (0-24) from the day fraction (the game's day starts at 06:00).
  R.hour = t => (((t * 1440) + 360) % 1440) / 60;
  const ageGroup = a => a < 3 ? 'baby' : a < 13 ? 'child' : 'adult';

  // Who is home and what each one is doing: [{ p, act, alt, group, bed }]. act: sleep, eat, cook, write, play,
  // sofa, baby (holding the baby), pray, shrine (praying at a shrine), stand; babies: crawl, sit, lie, cry, cot,
  // held. alt is what they do when the place for act is taken (no free chair at the table: they eat later).
  // bed: who sleeps where (0 the couple, or the eldest adult when there is no couple, in the double bed;
  // 1 children; 2 other adults, in single beds or on a floor mattress).
  R.scene = function (w, r, b, t, fast) {
    const hr = R.hour(t), day = w.lastDay < 0 ? 0 : w.lastDay, block = Math.floor(hr * 2);
    const home = [];
    for (const p of w.living) {
      if (!p.alive || p.away || p.inst || p.homeId !== b.id) continue;
      const pos = r.posOf(p, t, fast);
      if (pos.inside === b.id || (pos.at === b.id && !pos.moving)) home.push(p); // inside, or about the house
    }
    home.sort((a, c) => a.id - c.id);
    const age = p => LES.P.age(w, p), out = new Map(), ids = new Set(home.map(p => p.id));
    const adults = home.filter(p => age(p) >= 13).sort((a, c) => (a.sex === 'F' ? 0 : 1) - (c.sex === 'F' ? 0 : 1) || age(c) - age(a) || a.id - c.id);
    const babies = home.filter(p => age(p) < 3);
    const night = hr >= 23 || hr < 6;
    const meal = [[6, 7.5], [12, 13.5], [18.5, 20]].find(([s, e]) => hr >= s - 0.5 && hr < e);
    const cook = meal && adults.find(p => age(p) >= 18 && age(p) < 75 && !(p.health < 30));
    // The double bed: a couple who are both home, else the eldest adult.
    const grown = home.filter(p => age(p) >= 18).sort((a, c) => age(c) - age(a) || a.id - c.id);
    const couple = grown.find(p => p.partnerId !== null && p.partnerId !== undefined && ids.has(p.partnerId));
    const dbl = new Set(couple ? [couple.id, couple.partnerId] : grown.length ? [grown[0].id] : []);
    let carer = null;
    for (const p of home) {
      const a = age(p), g = ageGroup(a), x = hash(p.id, day, block);
      let alt;
      if (g === 'baby') alt = x < 0.4 ? 'crawl' : x < 0.7 ? 'sit' : x < 0.9 ? 'lie' : 'cry';
      else if (g === 'child') alt = a >= 6 && hr >= 15 && x < 0.5 ? 'write' : 'play';
      else if (a < 18) alt = x < 0.5 ? 'write' : 'sofa';
      else if (babies.length && !carer && a < 75 && x < 0.6) { alt = 'baby'; carer = p; }
      else alt = a >= 65 ? (x < 0.7 ? 'sofa' : 'stand') : x < 0.55 ? 'sofa' : x < 0.75 ? 'write' : 'stand';
      let act = alt;
      if (night || p.health < 30 || (g === 'baby' && hr >= 13 && hr < 15)) act = g === 'baby' ? 'cot' : 'sleep';
      else if (g === 'baby') act = alt;
      else if (meal && p === cook && hr < meal[0] + 0.25) act = 'cook';
      else if (meal && hr >= meal[0] && p !== cook) act = 'eat';
      else if (prays(p, a, hr)) act = p.rel === 'islam' ? 'pray' : 'shrine';
      if (act !== alt && alt === 'baby') { carer = null; alt = 'sofa'; } // busy: someone else may hold the baby
      out.set(p.id, { p, act, alt, group: g, elder: a >= 65, age: a, bed: dbl.has(p.id) ? 0 : a < 18 ? 1 : 2 });
    }
    if (!carer) { // the baby is held by an adult who is free (not eating, cooking, praying or asleep)
      const c = adults.map(p => out.get(p.id)).find(s => s.age >= 18 && s.age < 75 && ['sofa', 'stand', 'write'].includes(s.act));
      if (c && babies.some(q => out.get(q.id).act !== 'cot')) { c.act = 'baby'; carer = c.p; }
    } else if (out.get(carer.id).act !== 'baby') carer = null;
    if (carer) { const held = babies.find(q => out.get(q.id).act !== 'cot'); if (held) out.get(held.id).act = 'held'; else out.get(carer.id).act = 'sofa'; }
    return [...out.values()];
  };
  // Muslims at home pray at the five prayer times (most adults and children over 7, by a fixed rule per person);
  // other faiths light incense or pray at the shrine in the morning or evening.
  function prays(p, a, hr) {
    if (a < 7 || !p.rel || p.rel === 'none' || hash(p.id, 31) < 0.3) return false;
    if (p.rel === 'islam') return [5.75, 13.25, 16.5, 19.3, 20.6].some(s => hr >= s && hr < s + 0.25);
    return (hr >= 6.25 && hr < 6.5) || (hr >= 21.5 && hr < 21.75 && p.rel === 'christianity');
  }

  // What the plan needs for this household: a cot for a baby, the faith corner, enough beds (a second baby needs one too).
  R.family = function (w, b) { // from everyone who lives here (not only who is home now), so the furniture stays put
    const all = w.living.filter(p => p.alive && !p.away && !p.inst && p.homeId === b.id), age = p => LES.P.age(w, p);
    const babies = all.filter(p => age(p) < 3).length, head = all.filter(p => age(p) >= 18).sort((a, c) => age(c) - age(a))[0] || all[0];
    return { baby: babies > 0, faith: head ? head.rel || 'none' : 'none', sleepers: all.length - babies + Math.max(0, babies - 1), keep: R.keepsakes(w, all) };
  };

  // Keepsakes (Phase 3.3/3.4), each earned by a real record of someone who lives here: certificates for
  // qualifications, a trophy for a promotion or a business, a retirement clock, the wedding photo of a couple,
  // a school bag and books while a child is at school, toys and drawings for young children, baby shoes; for
  // the played family also a medal (elected) and a work badge, and the earlier lives of the chain on the wall
  // with one keepsake each. [{ id, where: wall | shelf | desk | rug | fridge | cot, label, paint }]
  R.keepsakes = function (w, all) {
    const age = p => LES.P.age(w, p), name = p => LES.P.name(p), out = [], ids = new Set(all.map(p => p.id));
    const adults = all.filter(p => age(p) >= 18).sort((a, c) => age(c) - age(a) || a.id - c.id);
    const kids = all.filter(p => age(p) < 18);
    let certs = 0;
    for (const p of adults) if (p.quals && p.quals.length && certs < 2) { certs++; out.push({ id: p.quals.length > 1 ? 'keep.cert_gold' : 'keep.cert_blue', where: 'wall', label: ['keep.cert', { name: name(p) }] }); }
    const couple = adults.find(p => p.partnerId !== null && p.partnerId !== undefined && ids.has(p.partnerId));
    if (couple) out.push({ id: 'keep.frame_wedding', where: 'wall', label: ['keep.wedding', { a: name(couple), b: name(w.people[couple.partnerId]) }], paint: [couple.id, couple.partnerId] });
    const star = adults.find(p => p.manages >= 0 || (p.job && p.job.level >= 2));
    if (star) out.push({ id: 'keep.trophy_gold', where: 'shelf', label: ['keep.trophy', { name: name(star) }] });
    const old = adults.find(p => p.retired);
    if (old) out.push({ id: 'keep.retire_clock', where: 'wall', label: ['keep.keepsake', { name: name(old) }] });
    if (kids.some(p => age(p) >= 6)) out.push({ id: 'home.school_bag', where: 'desk' }, { id: 'keep.books', where: 'desk' });
    const small = kids.filter(p => age(p) >= 1 && age(p) < 8);
    const TOYS = ['keep.doll', 'home.blocks', 'home.ball', 'keep.keyboard', 'home.toy_car', 'keep.kite'];
    small.slice(0, 2).forEach((p, i) => out.push({ id: TOYS[(p.id + i) % TOYS.length], where: 'rug' }));
    const DRAW = ['keep.drawing_house', 'keep.drawing_family', 'keep.drawing_cat'];
    kids.filter(p => age(p) >= 4 && age(p) < 11).slice(0, 2).forEach((p, i) => out.push({ id: DRAW[(p.id + i) % 3], where: i ? 'wall' : 'fridge', label: ['keep.keepsake', { name: name(p) }] }));
    if (kids.some(p => age(p) < 2)) out.push({ id: 'keep.baby_shoes', where: 'cot' });
    const s = w.player;
    if (s && ids.has(s.id)) {
      const moments = s.moments || [];
      if (moments.some(m => m.kind === 'elected')) out.push({ id: 'keep.medal', where: 'shelf', label: ['keep.keepsake', { name: name(w.people[s.id]) }] });
      if (w.people[s.id].job) out.push({ id: 'keep.badge', where: 'desk' });
      // The ancestor wall: earlier lives of the chain, framed, each with one keepsake on the shelf.
      const before = [];
      for (const c of s.chain || []) if (c.id !== s.id && !before.includes(c.id)) before.push(c.id);
      before.slice(-3).forEach((id, i) => {
        const q = w.people[id];
        if (!q) return;
        out.push({ id: i % 2 ? 'keep.frame_square' : 'keep.frame_oval', where: 'wall', label: ['keep.photoOf', { name: name(q) }], paint: [id], ancestor: true });
        const kid = q.quals && q.quals.length ? 'keep.cert_gold' : q.manages >= 0 || (q.job && q.job.level >= 2) ? 'keep.trophy_silver' : 'keep.vase';
        out.push({ id: kid, where: 'shelf', label: [kid === 'keep.cert_gold' ? 'keep.cert' : kid === 'keep.trophy_silver' ? 'keep.trophy' : 'keep.keepsake', { name: name(q) }], ancestor: true });
      });
    }
    return out.filter(k => A().has(k.id));
  };
  R.keepSig = fam => (fam.keep || []).map(k => `${k.id}${k.paint ? k.paint.join('+') : ''}`).join(',');

  // Sprite and place for each activity. Children use their own frames; teens, adults and elders the adult ones.
  const FRAMES = {
    adult: { stand: 'stand', eat: 'eat', write: 'write', sofa: 'sofa', sleep: 'sleep_head', cook: 'cook', baby: 'baby', pray: 'pray', shrine: 'stand' },
    child: { stand: 'stand', eat: 'eat', write: 'write', sofa: 'play', sleep: 'sleep_head', play: 'play', pray: 'pray', shrine: 'stand', cook: 'stand', baby: 'stand' },
  };
  // Where each activity happens, and where it moves to when that is taken. Eating needs a chair at the table
  // (otherwise the person does their other activity); homework moves from the desk to the dining table.
  const STATION = { eat: ['seat'], write: ['desk', 'seat', 'sofa', 'stand'], sofa: ['sofa', 'stand'], cook: ['cook', 'stand'], play: ['play', 'stand'],
    pray: ['pray', 'stand'], shrine: ['shrine', 'stand'], baby: ['stand'], stand: ['stand'], cot: ['cot'], crawl: ['play', 'stand'], sit: ['play', 'stand'], lie: ['play', 'stand'], cry: ['play', 'stand'] };
  R.STATION = STATION;

  // Place everyone: [{ p, frame, x, y (feet), key, view, kind }].
  R.place = function (plan, scene, now) {
    const free = {}; for (const k in plan.spots) free[k] = Array.isArray(plan.spots[k]) ? plan.spots[k].slice() : plan.spots[k] ? [plan.spots[k]] : [];
    const beds = { double: free.bed.filter(b => b.kind === 'double'), single: free.bed.filter(b => b.kind === 'single'), floor: free.bed.filter(b => b.kind === 'floor') };
    const out = [], tick = Math.floor((now || 0) / 650);
    const take = (kinds, p) => {
      for (const k of kinds) {
        const list = free[k];
        if (!list || !list.length) continue;
        if (k === 'stand') { const i = Math.floor(hash(p.id, 5) * list.length); return { spot: list.splice(i, 1)[0], kind: k }; }
        return { spot: list.shift(), kind: k };
      }
      return null;
    };
    const bedFor = s => { // the couple in the double bed; children, then other adults, in single beds or on a mattress
      const order = s.bed === 0 ? ['double', 'single', 'floor'] : ['single', 'floor'];
      for (const k of order) if (beds[k].length) return { spot: beds[k].shift(), kind: 'bed' };
      return null;
    };
    const list = scene.slice().sort((a, c) => (a.act === 'sleep' ? a.bed : 0) - (c.act === 'sleep' ? c.bed : 0) || (c.age || 0) - (a.age || 0) || a.p.id - c.p.id);
    for (const s of list) {
      if (s.act === 'held') continue; // drawn in the carer's arms
      const f2 = (tick + s.p.id) % 2;
      let act = s.act, got = act === 'sleep' ? bedFor(s) : take(STATION[act] || ['stand'], s.p);
      if (!got && act === 'cot') got = bedFor(s); // a second baby sleeps in a bed or on a mattress
      if (!got && s.alt && s.alt !== act) { act = s.alt; got = take(STATION[act] || ['stand'], s.p); }
      if (!got) got = take(['stand'], s.p);
      if (!got) continue; // a very full house: nowhere left to put them
      const kind = got.kind;
      if (kind === 'stand' && !['shrine', 'baby', 'stand'].includes(act)) act = 'stand';
      if (kind === 'sofa') act = 'sofa';
      let frame;
      if (s.group === 'baby') frame = kind === 'cot' || kind === 'bed' ? 'person.baby.sleep' : `person.baby.${act === 'crawl' ? `crawl.${f2}` : ['sit', 'lie', 'cry'].includes(act) ? act : 'sit'}`;
      else {
        const g = s.group === 'child' ? 'child' : 'adult', name = FRAMES[g][act] || 'stand';
        frame = `person.${g}.${name}${name === 'stand' ? '' : `.${f2}`}`;
        if (!A().has(frame)) frame = `person.${g}.${name}.0`;
        if (!A().has(frame)) frame = `person.${g}.stand`;
      }
      out.push({ p: s.p, s, act, kind, frame, x: got.spot.x, y: got.spot.y, key: got.spot.key, view: kind === 'cook' ? 'back' : kind === 'bed' || kind === 'cot' ? 'top' : 'front', mat: act === 'pray' && kind === 'pray' });
    }
    return out;
  };

  // Is the inside view showing now, and of which home? null = show the town.
  R.target = function (r, t, fast) {
    if (!r.roomOn || !r.follow || r.selectedId < 0 || !r.w || !R.available()) return null;
    const p = r.w.people[r.selectedId];
    if (!p || !p.alive || p.away || p.inst) return null;
    const pos = r.posOf(p, t, fast);
    const b = pos.inside !== undefined ? r.town.buildings[pos.inside] : null;
    if (!b || !R.isHome(b) || p.homeId !== b.id) return null;
    if (fast) return { b, paused: true }; // 1 day per second and faster: rooms would flash several times a second
    return { b, paused: false };
  };

  const statics = new Map();
  function staticLayer(b, plan, sig, w) {
    const key = `${b.id}|${sig}`;
    let cv = statics.get(key);
    if (cv) return cv;
    if (statics.size > 8) statics.clear();
    const W = plan.W, H = plan.H, L = plan.look || OLD, cols = plan.rows[0].length;
    cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const rows = plan.rows, art = A(), zone = R.zones(rows), pick = (list, n) => list[n % list.length];
    g.fillStyle = '#3b2a1d'; g.fillRect(0, 0, W, H);
    for (let r = 1; r < rows.length; r++) for (let c = 0; c < cols; c++) {
      const ch = rows[r][c], z = zone[r][c];
      const kTile = ch === 'k' || ('TCKF'.includes(ch) && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([u, v]) => (rows[r + u] || '')[c + v] === 'k')); // a dining room keeps its own floor
      const id = ch === '=' ? pick(L.floor, 1) : kTile ? pick(L.floorKitchen, c + r) : (z === 'parents' || z === 'kids') && L.floorBed ? L.floorBed : pick(L.floor, Math.floor(hash(b.id, r, c) * 4));
      art.draw(g, id, c * TS, top(r));
      if (ch === '=' && (r + 1 >= rows.length || rows[r + 1][c] !== '=')) art.draw(g, 'mod.railing', c * TS, top(r) + TS - A().size('mod.railing')[1]); // the balcony rail
    }
    for (let c = 0; c < cols; c++) art.draw(g, rows[1][c] === 'k' || 'FCK'.includes(rows[1][c]) ? L.wallKitchen : pick(L.wall, c % 3 === 1 ? 1 : 0), c * TS, 0);
    for (let c = 0; c < cols; c++) if (rows[0][c] === 'W') { const id = pick(L.window, c * 7 + b.id); const [ww] = A().size(id); art.draw(g, id, c * TS + 8 - Math.round(ww / 2), 4); }
    if (cols > 11) art.draw(g, 'home.clock', 10 * TS + 4, 10);
    for (const it of plan.items) if (it.floor || it.wall) { art.draw(g, it.id, it.x, it.y); if (it.paint && w) paintFrame(g, w, it); }
    for (let r = 1; r < rows.length; r++) for (let c = 0; c < cols; c++) { // inner walls: a thin top edge
      if (rows[r][c] === '|') art.draw(g, 'home.wall_edge_v', c * TS + 6, top(r));
      if (rows[r][c] === '-') art.draw(g, 'home.wall_edge_h', c * TS, top(r) + 10);
    }
    statics.set(key, cv);
    return cv;
  }

  // Draw the inside of home `b` onto a 256 x 192 canvas, then onto the map canvas, scaled to fit.
  R.draw = function (r, g, tgt, t, now) {
    const w = r.w, b = tgt.b, art = A();
    const scene = R.scene(w, r, b, t, false);
    const fam = R.family(w, b);
    const country = (w.cfg && w.cfg.country) || 'my', layout = R.layoutOf(b);
    const sig = `${b.kind}|${country}|${layout}|${fam.baby ? 1 : 0}|${fam.faith}|${fam.sleepers}|${R.keepSig(fam)}`;
    if (!r._roomPlan || r._roomPlan.sig !== `${b.id}|${sig}`) {
      const plan = R.plan(R.rowsOf(b), fam, R.look(country, b.kind));
      const photo = plan.items.find(it => it.id === 'home.photo_large'); // the family photo shows this family
      if (photo) { const [pw, ph] = A().size('home.photo_large'); Object.assign(photo, { w: pw, h: ph, label: ['keep.family', {}], paint: w.living.filter(p => p.alive && !p.away && !p.inst && p.homeId === b.id).sort((x, y) => LES.P.age(w, y) - LES.P.age(w, x)).slice(0, 4).map(p => p.id) }); }
      r._roomPlan = { sig: `${b.id}|${sig}`, plan };
    }
    const plan = r._roomPlan.plan, hr = R.hour(t), W = plan.W, H = plan.H;
    const rc = r._roomCv && r._roomCv.width === W && r._roomCv.height === H ? r._roomCv : (r._roomCv = Object.assign(document.createElement('canvas'), { width: W, height: H }));
    const q = rc.getContext('2d'); q.imageSmoothingEnabled = false;
    q.drawImage(staticLayer(b, plan, sig, w), 0, 0);
    const people = R.place(plan, scene, now), f2 = Math.floor((now || 0) / 650) % 2, f3 = Math.floor((now || 0) / 300) % 3;
    const sofaBusy = people.some(m => m.act === 'sofa'), cooking = people.some(m => m.act === 'cook'), lampOn = hr >= 19 || hr < 6.5;
    const draws = [];
    for (const it of plan.items) {
      if (it.floor || it.wall) continue;
      let id = it.id;
      if (id === 'anim.tv.0' && sofaBusy) id = `anim.tv.${f3}`;
      if (it.tv && plan.look.tvPic && sofaBusy) { draws.push({ key: it.key, fn: () => { art.draw(q, id, it.x, it.y); const pic = `${plan.look.tvPic}.${f3}`, [pw] = art.size(pic); art.draw(q, pic, it.x + Math.round((it.w - pw) / 2), it.y + 2); } }); continue; }
      if (it.lamp && lampOn) id = 'anim.lamp.1';
      if (id === 'home.fan_standing' && people.length && hr > 9 && hr < 22 && art.has('anim.fan.0')) id = `anim.fan.${f3}`;
      draws.push({ key: it.key, fn: () => art.draw(q, id, it.x, it.y) });
    }
    if (cooking && plan.spots.flame) draws.push({ key: 9999 - 1, fn: () => art.draw(q, `anim.flame.${f3}`, plan.spots.flame.x, plan.spots.flame.y) });
    const scr = r.screenPos = [];
    const marks = [];
    for (const m of people) {
      const age = LES.P.age(w, m.p), look = LES.Sprites.lookOf(m.p, age);
      const spr = art.person(m.frame, look, { grey: m.s.elder && look.style !== 3, view: m.view });
      if (!spr) continue;
      const x = Math.round(m.x - spr.width / 2), y = m.view === 'top' ? m.y : Math.round(m.y - spr.height);
      draws.push({ key: m.key, fn: () => {
        if (m.mat) art.draw(q, 'home.sejadah', Math.round(m.x - 6), Math.round(m.y - 20));
        q.drawImage(spr, x, y);
      } });
      if (m.p.id === r.selectedId) marks.push({ x: m.x, y });
      scr.push({ id: m.p.id, rx: m.x, ry: y + spr.height / 2 });
      if (m.act === 'baby') { const baby = scene.find(s => s.act === 'held'); if (baby) scr.push({ id: baby.p.id, rx: m.x, ry: y + spr.height / 2 + 2 }); }
    }
    draws.sort((a, c) => a.key - c.key);
    for (const d of draws) d.fn();
    for (const k of marks) { // the followed person: a small gold arrow
      q.fillStyle = '#f2c14e'; q.fillRect(k.x - 2, k.y - 6, 5, 1); q.fillRect(k.x - 1, k.y - 5, 3, 1); q.fillRect(k.x, k.y - 4, 1, 1);
    }
    nightTint(q, plan, hr, lampOn);
    // Onto the map canvas: as big as fits, whole-number scale when it is 2x or more.
    const cw = r.cv.width, ch = r.cv.height, fit = Math.min(cw / W, ch / H), k = fit >= 2 ? Math.floor(fit) : fit;
    const ox = Math.round((cw - W * k) / 2), oy = Math.round((ch - H * k) / 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#17110c'; g.fillRect(0, 0, cw, ch);
    g.imageSmoothingEnabled = false;
    g.drawImage(rc, ox, oy, W * k, H * k);
    for (const s of scr) { s.x = (ox + s.rx * k) / r.dpr; s.y = (oy + s.ry * k) / r.dpr; }
    r.badges = [];
    r._roomRect = { ox, oy, k };
    r._roomLabels = plan.items.filter(it => it.label);
    return { scene, people };
  };

  // A still picture of a plan (furniture, no people), for checks and previews.
  R.preview = function (plan, b) {
    const cv = document.createElement('canvas'); cv.width = plan.W; cv.height = plan.H;
    const q = cv.getContext('2d'); q.imageSmoothingEnabled = false;
    q.drawImage(staticLayer(b || { id: 1 }, plan, `preview|${Math.random()}`), 0, 0); // drawing only
    for (const it of plan.items.filter(i => !i.floor && !i.wall).sort((a, c) => a.key - c.key)) A().draw(q, it.id, it.x, it.y);
    return cv;
  };

  // The keepsake under a screen point (css pixels), as text, or null.
  R.pickItem = function (r, sx, sy) {
    const rr = r._roomRect;
    if (r.roomState !== 'on' || !rr || !r._roomLabels) return null;
    const x = (sx * r.dpr - rr.ox) / rr.k, y = (sy * r.dpr - rr.oy) / rr.k;
    for (const it of r._roomLabels) if (x >= it.x - 1 && x <= it.x + it.w + 1 && y >= it.y - 1 && y <= it.y + it.h + 1) return LES.I18n.t(it.label[0], it.label[1]);
    return null;
  };

  // Evening and night: darken the room, and let the lamps and windows glow.
  function nightTint(q, plan, hr, lampOn) {
    const dark = hr >= 22 || hr < 5 ? 0.55 : hr >= 19 ? (hr - 19) / 3 * 0.55 : hr < 6.5 ? (6.5 - hr) / 1.5 * 0.55 : 0;
    if (dark <= 0) return;
    q.save();
    q.globalCompositeOperation = 'multiply';
    q.fillStyle = `rgba(${Math.round(255 - 190 * dark)},${Math.round(255 - 170 * dark)},${Math.round(255 - 90 * dark)},1)`;
    q.fillRect(0, 0, plan.W, plan.H);
    if (lampOn) {
      q.globalCompositeOperation = 'screen';
      for (const l of plan.spots.lamp) {
        const gr = q.createRadialGradient(l.x, l.y, 1, l.x, l.y, 34);
        gr.addColorStop(0, `rgba(255,200,120,${0.55 * dark})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
        q.fillStyle = gr; q.fillRect(l.x - 34, l.y - 34, 68, 68);
      }
      const W = plan.W, H = plan.H, gr = q.createRadialGradient(W * 0.4, H * 0.68, 4, W * 0.4, H * 0.68, 90); // the living-room light
      gr.addColorStop(0, `rgba(255,214,150,${0.4 * dark})`); gr.addColorStop(1, 'rgba(255,214,150,0)');
      q.fillStyle = gr; q.fillRect(0, 0, W, H);
    }
    q.restore();
  }
})(globalThis.LES = globalThis.LES || {});
