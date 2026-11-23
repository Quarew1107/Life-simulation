// Portraits (art upgrade Phase 3.1): a head-and-shoulders bust (32 x 44) painted in each person's own colours,
// with their hairstyle or headwear, glasses, beard and an expression that follows their real condition (health,
// energy, stress, mood, a recent big moment). Built from the same look data as the map and room sprites, so a
// person looks the same everywhere. Drawing only: it reads the world and never changes it.
(function (LES) {
  'use strict';
  const PT = LES.Portrait = {};
  const A = () => LES.ArtPack;
  const HAPPY = new Set(['married', 'child', 'grandchild', 'graduated', 'firstJob', 'promoted', 'together', 'business', 'elected', 'jackpot', 'home', 'retired']);

  PT.available = () => !!(A() && A().ready && A().has('bust.adult'));
  PT.group = a => a < 3 ? 'baby' : a < 13 ? 'child' : a < 18 ? 'teen' : a >= 65 ? 'elder' : 'adult';

  // The face to show, from the person's real state. Big moments only count for the person being played.
  PT.expression = function (w, p) {
    if (!p.alive) return 'neutral';
    if (p.health < 35) return 'unwell';
    const s = w.player;
    if (s && s.id === p.id && s.moments && s.moments.length) {
      const m = s.moments[s.moments.length - 1];
      if (m.kind === 'lost' && w.day - m.day <= 30) return 'sad';
      if (HAPPY.has(m.kind) && w.day - m.day <= 3) return 'excited';
    }
    if (p.energy < 25) return 'tired';
    if (p.stress > 70) return 'worried';
    if (p.happy < 30) return 'sad';
    if (p.happy > 70 && p.stress < 40) return 'happy';
    return 'neutral';
  };

  // The face of a plain bust: the two eyes and the mouth (dark pixels inside the skin of the face).
  function features(img, shoulders) {
    const art = A(), W = img.width, d = img.data, face = art.box(img, 'skin', 0, shoulders);
    if (!face) return null;
    const pt = (x, y) => (x < 0 || y < 0 || x >= W || y >= img.height ? null : art.partAt(d, (y * W + x) * 4));
    const dots = [];
    for (let y = face.y0 + 1; y < face.y1; y++) for (let x = face.x0 + 1; x < face.x1; x++) {
      if (pt(x, y) !== 'other') continue;
      const ring = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([u, v]) => pt(x + u, y + v));
      if (ring.some(q => q === null || q === 'hair' || q === 'head' || q === 'top')) continue; // the outline, not a feature
      if (ring.some(q => q === 'skin')) dots.push([x, y]);
    }
    // Group the dots into blobs; eyes are the tallest blob on each side of the face, at about the same height;
    // the mouth is the widest blob below them near the middle (wrinkles and the hairline are ignored).
    const left = new Set(dots.map(q => q.join())), blobs = [];
    for (const q of dots) {
      if (!left.has(q.join())) continue;
      const list = [], st = [q]; left.delete(q.join());
      while (st.length) { const [x, y] = st.pop(); list.push([x, y]); for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + u},${y + v}`; if (left.has(k)) { left.delete(k); st.push([x + u, y + v]); } } }
      blobs.push(list);
    }
    const bb = list => ({ x0: Math.min(...list.map(q => q[0])), x1: Math.max(...list.map(q => q[0])), y0: Math.min(...list.map(q => q[1])), y1: Math.max(...list.map(q => q[1])), dots: list });
    const boxes = blobs.map(bb), cx = (face.x0 + face.x1) / 2;
    const eyeLike = b => b.y1 - b.y0 >= 1 && b.x1 - b.x0 <= 4 && b.y1 - b.y0 >= b.x1 - b.x0 - 1;
    const tall = (a, c) => (c.y1 - c.y0) - (a.y1 - a.y0) || c.dots.length - a.dots.length;
    const L = boxes.filter(b => eyeLike(b) && b.x1 < cx).sort(tall)[0], R = boxes.filter(b => eyeLike(b) && b.x0 > cx).sort(tall)[0];
    if (!L || !R || Math.abs(L.y0 - R.y0) > 2) return null;
    const M0 = boxes.filter(b => b.y0 > Math.max(L.y1, R.y1) && b.y0 < Math.max(L.y1, R.y1) + 9 && Math.abs((b.x0 + b.x1) / 2 - cx) <= 3).sort((a, c) => (c.x1 - c.x0) - (a.x1 - a.x0))[0] || null;
    // every dark pixel inside a feature's box (and one pixel round it) belongs to it, also the inner ones
    const fill = b => { if (!b) return null; const list = []; for (let y = b.y0 - 1; y <= b.y1 + 1; y++) for (let x = b.x0 - 1; x <= b.x1 + 1; x++) if (pt(x, y) === 'other' && x > face.x0 && x < face.x1) list.push([x, y]); return bb(list); };
    return { face, L: fill(L), R: fill(R), M: fill(M0) };
  }

  // Mask colours used to draw a face: the outline brown, skin (mid and shadow), white, a tear / sweat blue.
  const C = { line: [0x3b, 0x2a, 0x1d], skin: [255, 0, 0], shade: [0x99, 0, 0], white: [0xf4, 0xf1, 0xe8], blue: [0x8e, 0xca, 0xe6] };
  // Redraw eyes, brows and mouth for an expression, a few pixels each, on the bust's own face.
  function expression(img, f, expr, blink) {
    const W = img.width, d = img.data, art = A();
    const put = (x, y, c, onlySkin) => {
      if (x < 0 || y < 0 || x >= W || y >= img.height) return;
      const i = (y * W + x) * 4;
      if (onlySkin && art.partAt(d, i) !== 'skin') return;
      d[i] = C[c][0]; d[i + 1] = C[c][1]; d[i + 2] = C[c][2]; d[i + 3] = 255;
    };
    // erased features take the face's own most common skin shade (busts are mostly the light shade)
    const shadesSeen = new Map();
    for (let y = f.face.y0; y <= f.face.y1; y++) for (let x = f.face.x0; x <= f.face.x1; x++) {
      const i = (y * W + x) * 4;
      if (art.partAt(d, i) === 'skin') { const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; shadesSeen.set(k, (shadesSeen.get(k) || 0) + 1); }
    }
    const top = [...shadesSeen].sort((p, q) => q[1] - p[1])[0];
    C.skin = top ? top[0].split(',').map(Number) : [255, 128, 128];
    const clear = b => { if (b) for (const [x, y] of b.dots) put(x, y, 'skin'); };
    const eyes = [f.L, f.R];
    if (blink || expr === 'tired' || expr === 'happy') for (const e of eyes) clear(e);
    for (const [k, e] of eyes.entries()) {
      const inner = k === 0 ? e.x1 : e.x0, outer = k === 0 ? e.x0 : e.x1, dir = k === 0 ? -1 : 1, em = Math.min(e.y1, e.y0 + 2);
      const c = Math.round((e.x0 + e.x1) / 2);
      if (blink) for (let x = c - 1; x <= c + 1; x++) put(x, em, 'line'); // closed: a short line
      else if (expr === 'happy') { put(c - 1, em, 'line'); put(c, em - 1, 'line'); put(c + 1, em, 'line'); } // smiling eyes: a little ^
      else if (expr === 'tired') { for (let x = c - 1; x <= c + 1; x++) put(x, em, 'line'); put(c, em + 1, 'line'); put(c, e.y1 + 1, 'shade', true); } // heavy lids
      if (expr === 'excited' && !blink) put(e.x0, e.y0, 'white');
      if (expr === 'sad' || expr === 'worried') { put(outer + dir, e.y0 - 2, 'line', true); put(outer, e.y0 - 2, 'line', true); put(inner, e.y0 - 3, 'line', true); }
      if (expr === 'happy' || expr === 'excited') put(outer + 2 * dir, e.y1 + 2, 'shade', true); // rosy cheeks
    }
    if (expr === 'sad') put(f.R.x0, f.R.y1 + 1, 'blue', true); // a tear
    if (expr === 'unwell') { put(f.face.x1 - 2, f.face.y0 + 3, 'blue', true); put(f.face.x1 - 2, f.face.y0 + 4, 'blue', true); }
    const M = f.M;
    if (!M || expr === 'neutral') return;
    const mx = Math.round((M.x0 + M.x1) / 2), my = M.y1, half = Math.max(2, Math.round((M.x1 - M.x0) / 2));
    clear(M);
    if (expr === 'happy') { put(mx - half - 1, my - 1, 'line'); for (let x = mx - half; x <= mx + half; x++) put(x, my, 'line'); put(mx + half + 1, my - 1, 'line'); }
    else if (expr === 'excited') { for (let x = mx - 1; x <= mx + 1; x++) { put(x, my - 1, 'line'); put(x, my, 'line'); } put(mx - 2, my - 2, 'line'); put(mx + 2, my - 2, 'line'); }
    else if (expr === 'sad') { put(mx - half, my, 'line'); for (let x = mx - half + 1; x <= mx + half - 1; x++) put(x, my - 1, 'line'); put(mx + half, my, 'line'); }
    else if (expr === 'worried') { for (let x = mx - half; x <= mx + half; x++) put(x, my - ((x - mx) % 2 ? 1 : 0), 'line'); }
    else for (let x = mx - 1; x <= mx + 1; x++) put(x, my, 'line'); // tired, unwell: a flat mouth
  }
  PT.features = id => { const img = A().pixels(id); return img ? features(img, (A().box(img, 'top') || { y0: img.height }).y0) : null; }; // for the tests
  const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

  const cache = new Map();
  // The painted bust (canvas 32 x 44) of person p, at age `age` (default now) with expression `expr`.
  PT.bust = function (w, p, expr, age, blink) {
    if (!PT.available()) return null;
    const a = age === undefined ? LES.P.age(w, p) : age, look = LES.Sprites.lookOf(p, a), g = PT.group(a);
    const key = `${p.id}|${g}|${look.skin}${look.hair}${look.shirt}${look.style}${look.scarf || ''}${look.hat || ''}${look.hatColour || ''}${look.glasses || ''}${look.beard || ''}|${expr}|${blink ? 1 : 0}`;
    let cv = cache.get(key);
    if (cv) return cv;
    if (cache.size > 400) cache.clear();
    const art = A(), img = art.pixels(art.has(`bust.${g}`) ? `bust.${g}` : 'bust.adult');
    if (!img) return null;
    const shoulders = (art.box(img, 'top') || { y0: img.height }).y0, f = features(img, shoulders);
    // Hair or headwear: the bust's own short hair goes and the overlay sits on top of the head. Plain hair never
    // covers the eyes or the face below the brows; a headscarf is lined up on the face and frames it.
    const name = art.overlayFor(look);
    if (g !== 'baby' && name && name !== 'short' && art.has(`bust_hair.${name}`)) {
      const ov = art.pixels(`bust_hair.${name}`), face = art.box(img, 'skin', 0, shoulders), top = art.box(img, 'any');
      const ob = art.box(ov, 'any');
      if (face && top && ob) {
        const d = img.data, W = img.width;
        for (let y = 0; y < shoulders; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, pt = art.partAt(d, i); if (pt === 'hair') d[i + 3] = 0; }
        for (let y = 0; y < shoulders; y++) for (let x = 0; x < W; x++) { // the outline around the old hair
          const i = (y * W + x) * 4;
          if (art.partAt(d, i) !== 'other' || (f && [f.L, f.R, f.M].some(b => b && b.dots.some(q => q[0] === x && q[1] === y)))) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([u, v]) => { const X = x + u, Y = y + v; return X >= 0 && Y >= 0 && X < W && Y < img.height && ['skin', 'top'].includes(art.partAt(d, (Y * W + X) * 4)); });
          if (!near) d[i + 3] = 0;
        }
        const os = art.box(ov, 'skin');
        const big = os && (os.x1 - os.x0) >= 8 && (os.y1 - os.y0) >= 6;
        const dx = Math.round((face.x0 + face.x1) / 2 - (big ? (os.x0 + os.x1) / 2 : (ob.x0 + ob.x1) / 2));
        const dy = big ? Math.round((face.y0 + face.y1) / 2 - (os.y0 + os.y1) / 2) : top.y0 - ob.y0 - 1;
        const brow = f ? Math.min(f.L.y0, f.R.y0) - 2 : shoulders;
        art.stamp(img, ov, dx, dy, (o, b, X, Y) => (o === 'hair' || o === 'head' || (o === 'other' && (!b || b === 'other'))) && (big || !(X > face.x0 && X < face.x1 && Y >= brow)));
      }
    }
    if (f && g !== 'baby') expression(img, f, expr, blink);
    if (f && g !== 'baby' && g !== 'child') {
      const ex = Math.round((f.L.x0 + f.R.x1) / 2), ey = Math.round((f.L.y0 + f.L.y1) / 2);
      if (look.beard) { // stubble, moustache or full beard round the mouth
        const bid = `bust.beard.${Math.min(3, look.beard)}`;
        if (art.has(bid) && f.M) { const bd = art.pixels(bid), bb = art.box(bd, 'any'); art.stamp(img, bd, ex - Math.round((bb.x0 + bb.x1) / 2), f.M.y0 - 2 - bb.y0, (o, b) => (o === 'hair' || o === 'other') && b === 'skin'); }
      }
      if (look.glasses) {
        const gid = `bust.glasses.${Math.min(3, look.glasses)}`;
        if (art.has(gid)) { const gl = art.pixels(gid), gb = art.box(gl, 'any'); art.stamp(img, gl, ex - Math.round((gb.x0 + gb.x1) / 2), ey - Math.round((gb.y0 + gb.y1) / 2), () => true); }
      }
    }
    const painted = expr === 'unwell' ? Object.assign({}, look, { skin: mix(look.skin, '#c9d1b4', 0.35) }) : look; // looking pale
    cv = art.toCanvas(art.paint(img, painted, { grey: g === 'elder' && look.style !== 3 }));
    cache.set(key, cv);
    return cv;
  };

  // Draw person p's portrait into canvas c (any size; whole-number scale when it fits). false = no art.
  // Switched off on the owner's request (Nov 23 2026): the panels keep the old portrait until the busts are
  // refined at the end of the art upgrade. The art and this code stay; set PT.enabled = true to try them.
  PT.enabled = false;
  PT.draw = function (c, w, p, opts) {
    if (!PT.enabled || !c || !p || !PT.available()) return false;
    const expr = (opts && opts.expr) || PT.expression(w, p);
    const b = PT.bust(w, p, expr, opts && opts.age, opts && opts.blink);
    if (!b) return false;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    const fit = Math.min(c.width / b.width, c.height / b.height), k = fit >= 1 ? Math.floor(fit) : fit;
    g.drawImage(b, Math.round((c.width - b.width * k) / 2), Math.round(c.height - b.height * k), b.width * k, b.height * k);
    c._por = { pid: p.id, expr };
    return true;
  };

  // Now and then every portrait on screen blinks (only the face changes; nothing else is redrawn).
  let blinkTimer = 0;
  PT.startBlinking = function (getWorld) {
    if (blinkTimer || typeof document === 'undefined') return;
    blinkTimer = setInterval(() => {
      const w = getWorld();
      if (!w || document.hidden) return;
      for (const c of document.querySelectorAll('canvas')) {
        if (!c._por || !c.isConnected || Math.random() < 0.4) continue; // drawing only: Math.random, never the world's dice
        const p = w.people[c._por.pid], expr = c._por.expr;
        if (!p || !p.alive) continue;
        PT.draw(c, w, p, { expr, blink: true });
        setTimeout(() => { if (c.isConnected) PT.draw(c, w, p, { expr }); }, 160);
      }
    }, 3800);
  };
})(globalThis.LES = globalThis.LES || {});
