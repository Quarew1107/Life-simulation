// Procedurally drawn pixel people (no external art assets). Each person faces the way
// they walk (front, back, side), has two walking frames, simple shading (light from the
// top-left) and a thin outline. Sprites are cached per look / age group / view / frame.
(function (LES) {
  'use strict';
  const cache = new Map();

  // Pattern characters map to the person's colours:
  // h hair, s skin, e eye, t shirt, a arm (shirt sleeve), k hand (skin), p pants, f shoes, c headscarf.
  // style: 0 short hair, 1 long hair, 2 hair bun, 3 tudung (headscarf, with baju kurung)
  const BODY = ['.tttttt.', 'atttttta', 'atttttta', 'k.tttt.k'];
  const LEGS = { 0: ['..pppp..', '..pp.pp.', '..ff.ff.'], 1: ['..pppp..', '.pp..pp.', '.ff...ff'] };
  const SKIRT = { 0: ['..tttt..', '..tttt..', '..f..f..'], 1: ['..tttt..', '.tttttt.', '.f....f.'] };
  const HEAD = {
    front: {
      0: ['..hhhh..', '.hhhhhh.', '.hssssh.', '.sesses.', '..ssss..'],
      1: ['..hhhh..', '.hhhhhh.', 'hhsssshh', 'hsessesh', 'hhsssshh'],
      2: ['...hh...', '.hhhhhh.', '.hssssh.', '.sesses.', '..ssss..'],
      3: ['..cccc..', '.cccccc.', 'ccsssscc', 'csessesc', 'ccsssscc'],
    },
    back: {
      0: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '..ssss..'],
      1: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh'],
      2: ['...hh...', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '..ssss..'],
      3: ['..cccc..', '.cccccc.', 'cccccccc', 'cccccccc', 'cccccccc'],
    },
    side: { // facing right
      0: ['..hhhh..', '.hhhhhh.', '.hhssss.', '.hssses.', '..ssss..'],
      1: ['..hhhh..', '.hhhhhh.', 'hhhssss.', 'hhssses.', 'hh.sss..'],
      2: ['hh.hhh..', 'hhhhhhh.', '.hhssss.', '.hssses.', '..ssss..'],
      3: ['..cccc..', '.cccccc.', 'cccssss.', 'ccssses.', 'cccsss..'],
    },
  };
  const SIDE_BODY = ['..tttt..', '..tttt..', '..ttat..', '..ttkt..'];
  const SIDE_LEGS = { 0: ['..pppp..', '...pp...', '...fff..'], 1: ['..pppp..', '..p..p..', '.ff..ff.'] };
  const SIDE_SKIRT = { 0: ['..tttt..', '..tttt..', '...ff...'], 1: ['..tttt..', '.tttttt.', '.f....f.'] };
  const CHILD = {
    front: ['.hhhh.', 'hhhhhh', 'hssssh', 'sesses', '.ssss.', 'atttta', '.tttt.', '.p..p.', '.f..f.'],
    back: ['.hhhh.', 'hhhhhh', 'hhhhhh', 'hhhhhh', '.ssss.', 'atttta', '.tttt.', '.p..p.', '.f..f.'],
    side: ['.hhhh.', 'hhhhhh', 'hhssss', 'hsssse', '.ssss.', '.tttt.', '.ttat.', '.p..p.', 'ff..ff'],
  };
  const BABY = ['.hh.', 'ssss', 'eses', 'tttt', 'tttt'];

  // Work uniforms and festival clothes: shirt/pants overrides and a hat over the top rows.
  // A function receives the person's look (so festival clothes can use their own colours).
  const OUTFITS = {
    chef: { shirt: '#f4f4f4', hat: '#ffffff' },
    medic: { shirt: '#f4f4f4', pants: '#7fb3cf' },
    hardhat: { shirt: '#ff8c42', hat: '#f4c430' },
    rider: { shirt: '#2a9d8f', hat: '#e63946' },
    office: { pants: '#22223b' },
    school: { shirt: '#f8f8f8', pants: '#1d3557' },
    sport: { shirt: '#e63946', pants: '#1b1b1b' },
    police: { shirt: '#1d3557', pants: '#1d3557', hat: '#14213d' },
    bajuMelayu: look => ({ shirt: look.scarf, pants: look.scarf, hat: '#151515' }), // with songkok
    kurung: look => ({ shirt: look.scarf, pants: look.scarf }),
    saree: look => ({ shirt: look.scarf, pants: look.scarf, sash: '#f2c14e' }),
    kurta: () => ({ shirt: '#f3ead7', pants: '#f3ead7' }),
    cny: () => ({ shirt: '#c1121f' }),
  };
  LES.OUTFITS = OUTFITS;

  function colour(ch, look, grey, row, of) {
    if (of) {
      if (of.hat && ch === 'h' && row <= 1) return of.hat;
      if (of.shirt && (ch === 't' || ch === 'a')) return of.shirt;
      if (of.pants && ch === 'p') return of.pants;
    }
    switch (ch) {
      case 'h': return grey ? '#c9c9c9' : look.hair;
      case 's': case 'k': return look.skin;
      case 'e': return '#1b1b1b';
      case 't': case 'a': return look.shirt;
      case 'p': return look.pants;
      case 'f': return '#2b2b2b';
      case 'c': return look.scarf;
      default: return null;
    }
  }
  function darker(hex, f) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
  }

  function rowsFor(group, style, view, frame) {
    const v = view === 'sideL' ? 'side' : view;
    if (group === 'baby') return BABY.slice();
    if (group === 'child') {
      const r = CHILD[v].slice();
      if (frame === 1) { r[7] = 'p....p'; r[8] = 'f....f'; }
      return r;
    }
    const skirt = style === 3;
    if (v === 'side') return [...HEAD.side[style], ...SIDE_BODY, ...(skirt ? SIDE_SKIRT : SIDE_LEGS)[frame]];
    const body = BODY.slice();
    if (v === 'back') body[3] = 'k.tttt.k';
    return [...HEAD[v][style], ...body, ...(skirt ? SKIRT : LEGS)[frame]];
  }

  LES.Sprites = {
    // group: 'baby' | 'child' | 'adult' | 'elder'; frame 0/1 for walking legs;
    // view: 'front' | 'back' | 'side' (facing right) | 'sideL' (facing left)
    person(look, group, frame, outfit, view) {
      view = view || 'front';
      const key = `${look.skin}${look.hair}${look.shirt}${look.pants}${look.style}${look.scarf}|${group}|${frame}|${outfit || ''}|${view}`;
      let cv = cache.get(key);
      if (cv) return cv;
      if (cache.size > 24000) { // bounded: forget the oldest quarter (Map keeps insertion order)
        let n = cache.size >> 2;
        for (const k of cache.keys()) { cache.delete(k); if (--n <= 0) break; }
      }
      const def = OUTFITS[outfit];
      const of = typeof def === 'function' ? def(look) : def;
      let rows = rowsFor(group, look.style in HEAD.front ? look.style : 0, view, frame);
      if (view === 'sideL') rows = rows.map(r => [...r].reverse().join(''));
      const wpx = rows[0].length, hpx = rows.length;
      cv = document.createElement('canvas');
      cv.width = wpx + 2; cv.height = hpx + 2;
      const g = cv.getContext('2d');
      const grey = group === 'elder' && look.style !== 3;
      const filled = (x, y) => y >= 0 && y < hpx && x >= 0 && x < wpx && rows[y][x] !== '.';
      // Thin outline for readability on any ground colour.
      g.fillStyle = 'rgba(22,20,30,0.7)';
      for (let y = -1; y <= hpx; y++) for (let x = -1; x <= wpx; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
      }
      for (let y = 0; y < hpx; y++) for (let x = 0; x < wpx; x++) {
        const ch = rows[y][x];
        let c = colour(ch, look, grey, y, of);
        if (!c) continue;
        // Shade the right-hand edge of clothes and hair (light from the top-left).
        if ((ch === 't' || ch === 'p' || ch === 'c' || ch === 'h') && !filled(x + 1, y)) c = darker(c, 0.78);
        g.fillStyle = c;
        g.fillRect(x + 1, y + 1, 1, 1);
      }
      if (of && of.sash && group !== 'child' && group !== 'baby') { // saree drape over one shoulder
        g.fillStyle = of.sash;
        for (let i = 0; i < 4; i++) g.fillRect(2 + i, 6 + i, 1, 1);
      }
      cache.set(key, cv);
      return cv;
    },
  };
})(globalThis.LES = globalThis.LES || {});
