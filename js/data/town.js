// Town layout for Bandar Rezeki: a 80x50 tile grid (16px tiles) with a road grid,
// functional buildings, homes per housing tier and shoplot units for businesses.
// Pure data so the headless simulation can use it without a canvas.
(function (LES) {
  'use strict';

  LES.buildTown = function () {
    const T = 16, W = 80, H = 50;
    const roadsY = [12, 25, 38];      // top tile row of each 2-tile-high road
    const roadsX = [15, 32, 49, 64];  // left tile column of each 2-tile-wide road
    const buildings = [], byKind = {}, homesByTier = [[], [], [], [], []], shoplots = [];

    function add(kind, label, x, y, w, h, extra) {
      const cy = y + h / 2;
      let road = roadsY[0], bestD = Infinity;
      for (const ry of roadsY) {
        const d = Math.abs(ry + 1 - cy);
        if (d < bestD) { bestD = d; road = ry; }
      }
      const doorBelow = road + 1 > cy;
      const b = Object.assign({
        id: buildings.length, kind, label, x, y, w, h,
        roadY: (road + 1) * T,
        doorBelow,
        door: { x: Math.round((x + w / 2) * T), y: (doorBelow ? y + h : y) * T },
      }, extra || {});
      buildings.push(b);
      if (!(kind in byKind)) byKind[kind] = b.id;
      if (b.tier !== undefined) homesByTier[b.tier].push(b.id);
      if (kind === 'shoplot') shoplots.push(b.id);
      return b;
    }
    const home = (kind, x, y, w, h, tier, cap) => add(kind, '', x, y, w, h, { tier, cap, home: true });

    // Column A (x 0-14): kampung and low-cost flats
    for (const yy of [2, 7]) for (const xx of [1, 5, 9]) home('kampung', xx, yy, 3, 3, 0, 4);
    for (const xx of [1, 5, 9]) home('kampung', xx, 15, 3, 3, 0, 4);
    add('padi', 'Sawah Padi', 1, 19, 12, 5, { decor: true });
    home('flat', 1, 28, 5, 8, 1, 40); home('flat', 8, 28, 5, 8, 1, 40);
    home('flat', 1, 41, 5, 7, 1, 40); home('flat', 8, 41, 5, 7, 1, 40);

    // Column B (x 17-31): learning, food, industry
    add('kolej', 'Kolej Vokasional', 18, 1, 6, 5);
    add('library', 'Library', 25, 1, 6, 5);
    add('hall', 'Dewan Komuniti', 18, 7, 6, 4);
    add('mamak', 'Mamak 24J', 18, 15, 5, 4);
    add('hawker', 'Hawker Centre', 24, 15, 7, 5);
    add('factory', 'Kilang', 18, 28, 12, 8);
    add('workshop', 'Bengkel', 17, 41, 6, 4);
    add('warehouse', 'Gudang', 24, 41, 7, 4);
    add('construction', 'Tapak Binaan', 17, 46, 14, 4);

    // Column C (x 34-48): university, CBD, mall, hospital, school
    add('university', 'Universiti Rezeki', 35, 1, 13, 9);
    add('office', 'Menara Rezeki', 35, 14, 4, 10);
    add('bank', 'Bank', 40, 15, 4, 4);
    add('bursa', 'Bursa', 40, 20, 8, 4);
    add('mall', 'Rezeki Mall', 35, 28, 6, 8);
    for (const yy of [28, 33]) for (const xx of [42, 44, 46]) add('shoplot', '', xx, yy, 2, 3);
    add('hospital', 'Hospital', 35, 41, 7, 7);
    add('school', 'Sekolah', 43, 41, 6, 7);

    // Column D (x 51-63): terrace, tech hub, shoplots, park
    for (const yy of [1, 5, 9]) home('terrace', 52, yy, 11, 2, 2, 12);
    add('techhub', 'Tech Hub', 52, 14, 4, 10);
    for (const yy of [15, 20]) for (const xx of [57, 59, 61]) add('shoplot', '', xx, yy, 2, 3);
    for (const yy of [28, 33]) for (let i = 0; i < 6; i++) add('shoplot', '', 52 + i * 2, yy, 2, 3);
    add('park', 'Taman Tasik', 51, 40, 7, 10);
    add('gym', 'Stadium & Gym', 59, 41, 5, 6);

    // Column E (x 66-79): wealthy hill and condos
    for (const [xx, yy] of [[67, 1], [73, 1], [67, 6], [73, 6]]) home('bungalow', xx, yy, 5, 4, 4, 6);
    for (const xx of [67, 71, 75]) home('condo', xx, 14, 3, 10, 3, 40);
    for (const xx of [67, 71, 75]) home('condo', xx, 27, 3, 10, 3, 40);
    home('terrace', 67, 41, 12, 2, 2, 12); home('terrace', 67, 44, 12, 2, 2, 12);
    add('welfare', 'Rumah Kebajikan', 67, 47, 6, 3);

    return { T, W, H, roadsY, roadsX, buildings, byKind, homesByTier, shoplots };
  };

  // Walking route between two buildings along the road grid (pixel points).
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
})(globalThis.LES = globalThis.LES || {});
