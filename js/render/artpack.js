// Art packs (PNG sprite sheets made by tools/art-import.py from ChatGPT's drawings). Each pack is a .js file in
// assets/art/ that pushes { id, src (image data), frames: { id: [x, y, w, h, ax, ay] } } onto LES.ArtPacks; the
// image is embedded as data so canvas pixel reads keep working from file://. Later packs override earlier frames.
// People are drawn in mask colours (skin red, hair green, top blue, bottom yellow, shoes cyan, headwear orange)
// and repainted here with each person's own look. Drawing only: nothing here reads or changes the simulation.
(function (LES) {
  'use strict';
  const A = LES.ArtPack = { ready: false, failed: false, frames: new Map() };
  const waiting = [];

  // Mask colours (TECH_REVIEW D3): part -> [light, mid, dark].
  const MASK = {
    skin: ['#FF8080', '#FF0000', '#990000'], hair: ['#80FF80', '#00CC00', '#006600'], top: ['#8080FF', '#0000FF', '#000099'],
    bottom: ['#FFFF80', '#E0E000', '#808000'], shoes: ['#00FFFF', '#00FFFF', '#008080'], head: ['#FFC080', '#FF8000', '#994C00'],
  };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PART = new Map(); // packed rgb -> [part, shade]
  for (const [part, cs] of Object.entries(MASK)) cs.forEach((c, k) => { const v = rgb(c); PART.set((v[0] << 16) | (v[1] << 8) | v[2], [part, k]); });
  const partOf = (d, i) => d[i + 3] ? PART.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : undefined;
  A.partAt = (d, i) => { const q = partOf(d, i); return q ? q[0] : d[i + 3] ? 'other' : null; };

  // Light / mid / dark versions of a colour (light from the top left, as in the rest of the game).
  function shades(hex) {
    const c = rgb(hex);
    return [c.map(v => Math.min(255, Math.round(v + (255 - v) * 0.35))), c, c.map(v => Math.round(v * 0.62))];
  }

  A.init = function () {
    const packs = LES.ArtPacks || [];
    if (!packs.length || typeof Image === 'undefined') { A.failed = true; return; }
    let left = packs.length;
    const imgs = packs.map(pk => {
      const img = new Image();
      img.onload = img.onerror = () => {
        if (--left) return;
        packs.forEach((p, k) => { if (imgs[k].naturalWidth) for (const [id, f] of Object.entries(p.frames)) A.frames.set(id, { img: imgs[k], x: f[0], y: f[1], w: f[2], h: f[3] }); });
        A.ready = A.frames.size > 0; A.failed = !A.ready;
        while (waiting.length) waiting.shift()(A.ready);
      };
      img.src = pk.src;
      return img;
    });
  };
  // Resolves when the packs have loaded (true) or could not load (false).
  A.whenReady = () => new Promise(res => { if (A.ready || A.failed) res(A.ready); else waiting.push(res); });
  A.has = id => A.frames.has(id);
  A.size = id => { const f = A.frames.get(id); return f ? [f.w, f.h] : [0, 0]; };
  // Draw a frame with its top-left corner at x, y.
  A.draw = function (g, id, x, y) {
    const f = A.frames.get(id);
    if (f) g.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(x), Math.round(y), f.w, f.h);
    return !!f;
  };
  A.pixels = function (id) {
    const f = A.frames.get(id);
    if (!f) return null;
    const cv = document.createElement('canvas'); cv.width = f.w; cv.height = f.h;
    const g = cv.getContext('2d'); g.drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    return g.getImageData(0, 0, f.w, f.h);
  };

  // Hair overlay names by look.style, and headwear by look.hat (sprites.js lookOf).
  const STYLE = ['short', 'long', 'bun', 'tudung', 'curly', 'buzz', 'ponytail', 'braids', 'wavy', 'side'];
  const HAT = { 1: 'songkok', 2: 'kopiah', 3: 'cap', 4: 'turban', 5: 'cap' };
  A.overlayFor = function (look) {
    if (!look) return null;
    if (look.style === 3) return 'tudung';
    if (look.hat && HAT[look.hat]) return HAT[look.hat];
    return STYLE[look.style] || 'short';
  };

  // Put a hairstyle / headwear head (16x12, face in skin) over a body's head: the old hair is removed and the
  // new head's hair is placed so the two faces line up (same centre, same chin).
  function overlay(base, over) {
    const W = base.width, H = base.height, d = base.data, o = over.data;
    let neck = H;
    for (let y = 0; y < H && neck === H; y++) for (let x = 0; x < W; x++) if (A.partAt(d, (y * W + x) * 4) === 'top') { neck = y; break; }
    const box = (data, w, h, maxY) => {
      let x0 = 99, x1 = -1, y1 = -1;
      for (let y = 0; y < Math.min(h, maxY); y++) for (let x = 0; x < w; x++) if (A.partAt(data, (y * w + x) * 4) === 'skin') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return x1 < 0 ? null : { x0, x1, y1 };
    };
    const bb = box(d, W, H, neck), ob = box(o, over.width, over.height, over.height);
    if (!bb || !ob) return;
    const dx = Math.round((bb.x0 + bb.x1 - ob.x0 - ob.x1) / 2), dy = bb.y1 - ob.y1;
    const skinNear = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = x + a, Y = y + b; return X >= 0 && Y >= 0 && X < W && Y < H && A.partAt(d, (Y * W + X) * 4) === 'skin'; });
    for (let y = 0; y < neck; y++) for (let x = 0; x < W; x++) { // old hair and the outline around it go
      const i = (y * W + x) * 4, part = A.partAt(d, i);
      if (part === 'hair' || part === 'head' || (part === 'other' && !skinNear(x, y))) d[i + 3] = 0;
    }
    const ow = over.width, oh = over.height;
    const isHair = (x, y) => x >= 0 && y >= 0 && x < ow && y < oh && ['hair', 'head'].includes(A.partAt(o, (y * ow + x) * 4));
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = (y * ow + x) * 4, j = (Y * W + X) * 4, part = A.partAt(o, i);
      const edge = part === 'other' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isHair(x + a, y + b));
      if (part === 'hair' || part === 'head' || (edge && !d[j + 3])) { d[j] = o[i]; d[j + 1] = o[i + 1]; d[j + 2] = o[i + 2]; d[j + 3] = 255; }
    }
  }

  const cache = new Map();
  // A person frame repainted with one person's look. opts: { grey (elder hair), view: 'front' | 'back' | 'top' }.
  A.person = function (id, look, opts) {
    opts = opts || {};
    const name = opts.view === 'top' ? null : A.overlayFor(look);
    const key = `${id}|${look.skin}|${look.hair}|${look.shirt}|${look.pants}|${look.scarf || ''}|${look.hatColour || ''}|${name}|${opts.grey ? 1 : 0}`;
    let cv = cache.get(key);
    if (cv) return cv;
    if (cache.size > 600) cache.clear(); // only the people in the room on screen are ever cached
    const img = A.pixels(id);
    if (!img) return null;
    if (name && name !== 'short') { const ov = A.pixels(`hair.${opts.view === 'back' ? 'back' : 'front'}.${name}`); if (ov) overlay(img, ov); }
    const hat = look.style === 3 ? (look.scarf || '#2a9d8f') : look.hat === 1 ? '#1b1b1b' : look.hat === 2 ? '#f4f1e8' : (look.hatColour || '#264653');
    const col = { skin: look.skin, hair: opts.grey ? '#c9c9c9' : look.hair, top: look.shirt, bottom: look.pants, shoes: '#2b2b2b', head: hat };
    const sh = {}; for (const k in col) sh[k] = shades(col[k]);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const q = partOf(d, i);
      if (!q) continue;
      const c = sh[q[0]][q[1]];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').putImageData(img, 0, 0);
    cache.set(key, cv);
    return cv;
  };
  A.clearCache = () => cache.clear();
})(globalThis.LES = globalThis.LES || {});
