// Procedurally drawn pixel people (no external art assets). Sprites are cached
// per look / age group / walk frame.
(function (LES) {
  'use strict';
  const cache = new Map();

  // Each pattern row is a string; characters map to colours of the person's look.
  // h = hair, s = skin, e = eye, t = shirt, a = arm skin, p = pants, f = shoes, c = scarf
  const ADULT = {
    0: ['..hhh..', '.hhhhh.', '.hssshh', '..ese..', '..sss..', '.ttttt.', 'attttta', 'a.ttt.a', '..ppp..', '..p.p..', '..f.f..'],
    1: ['..hhh..', '.hhhhh.', 'hhssshh', 'h.ese.h', 'h.sss.h', '.ttttt.', 'attttta', 'a.ttt.a', '..ppp..', '..p.p..', '..f.f..'],
    2: ['...h...', '..hhh..', '.hhhhh.', '.hssshh', '..ese..', '..sss..', 'attttta', 'a.ttt.a', '..ppp..', '..p.p..', '..f.f..'],
    3: ['..ccc..', '.ccccc.', '.cssscc', '.cesec.', '.csssc.', '.ccccc.', 'attttta', 'a.ttt.a', '..ttt..', '..p.p..', '..f.f..'],
  };
  const CHILD = ['.hhh.', 'hhhhh', '.ese.', '.sss.', 'ttttt', '.ttt.', '.p.p.', '.f.f.'];
  const BABY = ['.hh.', 'ssss', 'eses', 'tttt', 'tttt'];

  // Work uniforms: optional shirt/pants override and a hat over the top two rows.
  const OUTFITS = {
    chef: { shirt: '#f4f4f4', hat: '#ffffff' },
    medic: { shirt: '#f4f4f4', pants: '#7fb3cf' },
    hardhat: { shirt: '#ff8c42', hat: '#f4c430' },
    rider: { shirt: '#2a9d8f', hat: '#e63946' },
    office: { pants: '#22223b' },
    school: { shirt: '#f8f8f8', pants: '#1d3557' },
    sport: { shirt: '#e63946', pants: '#1b1b1b' },
  };
  LES.OUTFITS = OUTFITS;

  function colour(ch, look, grey, row, of) {
    if (of) {
      if (of.hat && ch === 'h' && row <= 1) return of.hat;
      if (of.shirt && ch === 't') return of.shirt;
      if (of.pants && ch === 'p') return of.pants;
    }
    switch (ch) {
      case 'h': return grey ? '#c9c9c9' : look.hair;
      case 's': case 'a': return look.skin;
      case 'e': return '#1b1b1b';
      case 't': return look.shirt;
      case 'p': return look.pants;
      case 'f': return '#2b2b2b';
      case 'c': return look.scarf;
      default: return null;
    }
  }

  // group: 'baby' | 'child' | 'adult' | 'elder'; frame 0/1 for walking legs
  LES.Sprites = {
    person(look, group, frame, outfit) {
      const key = `${look.skin}${look.hair}${look.shirt}${look.pants}${look.style}${look.scarf}|${group}|${frame}|${outfit || ''}`;
      const of = OUTFITS[outfit];
      let cv = cache.get(key);
      if (cv) return cv;
      let rows;
      if (group === 'baby') rows = BABY;
      else if (group === 'child') rows = CHILD.slice();
      else rows = ADULT[look.style] ? ADULT[look.style].slice() : ADULT[0].slice();
      if (frame === 1 && group !== 'baby') {
        const n = rows.length;
        rows[n - 2] = rows[n - 2].replace(/p\.p/, '.pp').replace(/\.p\.p\./, '..pp.');
        rows[n - 1] = rows[n - 1].replace(/f\.f/, '.ff').replace(/\.f\.f\./, '..ff.');
      }
      const wpx = rows[0].length, hpx = rows.length;
      cv = document.createElement('canvas');
      cv.width = wpx + 2; cv.height = hpx + 2;
      const g = cv.getContext('2d');
      const grey = group === 'elder' && look.style !== 3;
      // dark outline for readability on any ground colour
      for (let y = 0; y < hpx; y++) for (let x = 0; x < wpx; x++) {
        if (rows[y][x] === '.') continue;
        g.fillStyle = 'rgba(20,20,28,0.55)';
        g.fillRect(x, y + 1, 3, 1); g.fillRect(x + 1, y, 1, 3);
      }
      for (let y = 0; y < hpx; y++) for (let x = 0; x < wpx; x++) {
        const c = colour(rows[y][x], look, grey, y, of);
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(x + 1, y + 1, 1, 1);
      }
      cache.set(key, cv);
      return cv;
    },
  };
})(globalThis.LES = globalThis.LES || {});
