// Procedurally drawn pixel people (no external art assets). Each person faces the way
// they walk (front, back, side), has two walking frames, simple shading (light from the
// top-left) and a thin outline. Sprites are cached per look / age group / view / frame.
(function (LES) {
  'use strict';
  const cache = new Map(), lookKeys = new WeakMap();

  // Pattern characters map to the person's colours:
  // h hair, s skin, e eye, t shirt, a arm (shirt sleeve), k hand (skin), p pants, f shoes, c headscarf,
  // g glasses frame, b beard (hair colour), d stubble (darker skin).
  // Extras on look (adults): glasses 0 none / 1 dark / 2 gold frames; beard 0 none / 1 stubble /
  // 2 moustache / 3 full; hat 0 none / 1 songkok / 2 kopiah / 3 cap / 4 turban (hatColour for cap and turban).
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
      // Expansion 1 hairstyles (Idea/Expansion 1): 4 curly, 5 buzz cut, 6 ponytail, 7 braids, 8 wavy, 9 side parting
      4: ['.hhhhhh.', 'hhhhhhhh', 'hhsssshh', '.sesses.', '..ssss..'],
      5: ['..hhhh..', '.hhhhhh.', '.ssssss.', '.sesses.', '..ssss..'],
      6: ['..hhhh..', '.hhhhhh.', '.hsssshh', '.sessesh', '..ssss.h'],
      7: ['..hhhh..', '.hhhhhh.', 'hhsssshh', 'hsessesh', 'h.ssss.h'],
      8: ['.hhhhhh.', 'hhhhhh.h', '.hsssshh', '.sesses.', '..ssss..'],
      9: ['hhhhhhh.', '.hhhhhhh', '.hsssshh', '.sesses.', '..ssss..'],
    },
    back: {
      0: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '..ssss..'],
      1: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh'],
      2: ['...hh...', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '..ssss..'],
      3: ['..cccc..', '.cccccc.', 'cccccccc', 'cccccccc', 'cccccccc'],
      4: ['.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', '.hhhhhh.', '..ssss..'],
      5: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.ssssss.', '..ssss..'],
      6: ['..hhhh..', '.hhhhhh.', '.hhhhhh.', '.hhhhhh.', '...hh...'],
      7: ['..hhhh..', '.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'h.ssss.h'],
      8: ['.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', '.hhhhhh.', '..ssss..'],
      9: ['hhhhhhh.', '.hhhhhhh', '.hhhhhh.', '.hhhhhh.', '..ssss..'],
    },
    side: { // facing right
      0: ['..hhhh..', '.hhhhhh.', '.hhssss.', '.hssses.', '..ssss..'],
      1: ['..hhhh..', '.hhhhhh.', 'hhhssss.', 'hhssses.', 'hh.sss..'],
      2: ['hh.hhh..', 'hhhhhhh.', '.hhssss.', '.hssses.', '..ssss..'],
      3: ['..cccc..', '.cccccc.', 'cccssss.', 'ccssses.', 'cccsss..'],
      4: ['.hhhhhh.', 'hhhhhhhh', 'hhhssss.', 'hhssses.', '..ssss..'],
      5: ['..hhhh..', '.hhhhhh.', '.hsssss.', '.sssses.', '..ssss..'],
      6: ['..hhhh..', 'hhhhhhh.', 'hhhssss.', 'h.ssses.', 'h.ssss..'],
      7: ['..hhhh..', '.hhhhhh.', 'hhhssss.', 'hhssses.', 'hh.sss..'],
      8: ['.hhhhhh.', 'hhhhhhh.', '.hhssss.', 'hhssses.', '..ssss..'],
      9: ['hhhhhh..', '.hhhhhhh', '.hhssss.', '.hssses.', '..ssss..'],
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
  // Body builds for adults (review task 4), picked by a fixed rule from the person's id: 0 slim, 1 average, 2 broad.
  const BUILD_BODY = { 0: ['..tttt..', '.atttta.', '.atttta.', '.k.tt.k.'], 2: ['tttttttt', 'atttttta', 'atttttta', 'kttttttk'] };
  const BUILD_SIDE = { 2: ['.ttttt..', '.ttttt..', '.tttat..', '.tttkt..'] };
  // Sitting (food stalls, park benches): knees forward, one row shorter.
  const SIT_LEGS = ['.pppppp.', '.f....f.'], SIT_SKIRT = ['.tttttt.', '.f....f.'];

  // Work uniforms and festival clothes: shirt/pants overrides and a hat over the top rows.
  // A function receives the person's look (so festival clothes can use their own colours).
  const OUTFITS = {
    chef: { shirt: '#f4f4f4', hat: '#ffffff' },
    medic: { shirt: '#f4f4f4', pants: '#7fb3cf' },
    hardhat: { shirt: '#ff8c42', hat: '#f4c430' },
    hivis: { shirt: '#c9e23b', hat: '#f4c430', band: '#eef3f3' }, // day labourers: hi-vis vest with a reflective stripe
    rider: { shirt: '#2a9d8f', hat: '#e63946' },
    office: { pants: '#22223b' },
    school: { shirt: '#f8f8f8', pants: '#1d3557' },
    sport: { shirt: '#e63946', pants: '#1b1b1b' },
    police: { shirt: '#1d3557', pants: '#1d3557', hat: '#14213d' },
    prisoner: { shirt: '#f77f00', pants: '#f77f00' },
    bajuMelayu: look => ({ shirt: look.scarf, pants: look.scarf, hat: '#151515' }), // with songkok
    kurung: look => ({ shirt: look.scarf, pants: look.scarf }),
    saree: look => ({ shirt: look.scarf, pants: look.scarf, sash: '#f2c14e' }),
    kurta: () => ({ shirt: '#f3ead7', pants: '#f3ead7' }),
    cny: () => ({ shirt: '#c1121f' }),
    gawai: () => ({ shirt: '#1b1b1b', pants: '#9b2226', sash: '#e9c46a' }), // Iban / Kadazan dress: black with red and gold
    // Expansion 1 (Idea/Expansion 1): tie = a centre stripe, badge = one chest pixel, band = a reflective stripe, apron = a front panel
    overalls: { shirt: '#294e70', pants: '#294e70', badge: '#f5c15e' },
    security: { shirt: '#233c56', pants: '#223447', hat: '#233c56', badge: '#d7b56d' },
    firefighter: { shirt: '#be7932', pants: '#322e31', hat: '#d5a037', band: '#f9d75e' },
    labcoat: { shirt: '#ebf1e9', pants: '#547a8c', badge: '#2bbda9' },
    apron: { shirt: '#fae5cc', pants: '#4a4555', apron: '#a35b47' },
    business: { shirt: '#37445e', pants: '#283243', tie: '#80b7c9' },
    gown: { shirt: '#262b40', pants: '#262b40', hat: '#262b40', tie: '#e4b85a' },
    wedding: { shirt: '#f4ebdb', pants: '#766478', tie: '#d2a8b0' },
  };
  LES.OUTFITS = OUTFITS;

  function colour(ch, look, grey, row, of) {
    if (of) {
      if (of.hat && (ch === 'h' || ch === 'H') && row <= 1) return of.hat; // a uniform hat goes over any headwear
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
      case 'g': return look.glasses === 2 ? '#c9a227' : look.glasses === 3 ? '#8b5a2b' : '#26232b'; // 3: round tortoiseshell
      case 'b': return grey ? '#bdbdbd' : look.hair;
      case 'd': return darker(look.skin, 0.8);
      case 'H': return HATS[look.hat] || look.hatColour || '#1d3557';
      default: return null;
    }
  }
  function darker(hex, f) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
  }

  const HATS = { 1: '#151515', 2: '#f4f1e8' }; // songkok, kopiah (cap and turban use hatColour)
  const put = (row, i, ch) => row.slice(0, i) + ch + row.slice(i + 1);
  // Glasses, beard and headwear on an adult's head rows (0-4); not over a headscarf.
  function addExtras(rows, look, view) {
    const side = view === 'side', back = view === 'back';
    if (look.glasses === 3 && !back && !side) rows[2] = [...rows[2]].map((c, i) => (c === 's' && (i === 2 || i === 5) ? 'g' : c)).join(''); // round frames reach above the eye
    if (look.glasses && !back) rows[3] = side ? put(put(rows[3], 4, 'g'), 6, rows[3][6] === '.' ? '.' : 'g') : [...rows[3]].map((c, i) => (c === 's' && (i === 1 || i === 3 || i === 4 || i === 6) ? 'g' : c)).join('');
    if (look.beard && !back) {
      if (look.beard === 1) rows[4] = rows[4].replace(/s/g, 'd');
      else if (look.beard === 2) rows[4] = side ? put(rows[4], 5, 'b') : put(put(rows[4], 3, 'b'), 4, 'b');
      else if (look.beard === 4) rows[4] = side ? put(put(rows[4], 4, 'b'), 5, 'b') : [...rows[4]].map((c, i) => (c === 's' ? (i === 3 || i === 4 ? 'b' : 'd') : c)).join(''); // goatee
      else { rows[4] = rows[4].replace(/s/g, 'b'); if (!side) rows[3] = [...rows[3]].map((c, i) => (c === 's' && (i === 1 || i === 6) ? 'b' : c)).join(''); }
    }
    if (look.hat && look.style !== 3) {
      const n = look.hat === 4 ? 2 : 1; // a turban sits lower and wider
      for (let r = 0; r <= n; r++) rows[r] = rows[r].replace(/h/g, 'H');
      if (look.hat === 4) rows[1] = rows[1].replace(/^\.(H+)\.$/, 'H$1H');
      if (look.hat === 1) rows[0] = rows[0].replace(/^\.\.(H+)\.\.$/, '.H$1H.'); // a songkok is a flat-topped box
      if (look.hat === 3 && !back) rows[2] = side ? put(rows[2], 7, 'H') : rows[2]; // cap brim (side view)
      if (look.hat === 5) rows[0] = '..HHHH..'; // beanie: a rounded top
    }
    return rows;
  }

  function rowsFor(group, style, view, frame, build, pose) {
    const v = view === 'sideL' ? 'side' : view;
    if (group === 'baby') return BABY.slice();
    if (group === 'child') {
      const r = CHILD[v].slice();
      if (frame === 1) { r[7] = 'p....p'; r[8] = 'f....f'; }
      return r;
    }
    const skirt = style === 3;
    if (v === 'side') return [...HEAD.side[style], ...(BUILD_SIDE[build] || SIDE_BODY), ...(skirt ? SIDE_SKIRT : SIDE_LEGS)[frame]];
    const body = (BUILD_BODY[build] || BODY).slice();
    if (v === 'back' && build !== 0 && build !== 2) body[3] = 'k.tttt.k';
    if (pose === 'sit') return [...HEAD[v][style], ...body, ...(skirt ? SIT_SKIRT : SIT_LEGS)];
    return [...HEAD[v][style], ...body, ...(skirt ? SKIRT : LEGS)[frame]];
  }

  // Residents who were not designed in My Cast get glasses, beards and headwear by a fixed
  // rule from who they are (age, sex, community), never from the simulation's dice: it is
  // presentation only and changes no results. Glasses become likelier with age.
  const derived = new WeakMap(), CAP_COLOURS = ['#1d3557', '#e63946', '#2a9d8f', '#f4a261', '#264653'], TURBANS = ['#f2c14e', '#e76f51', '#1d3557', '#f4f1e8'];
  const h01 = (n, salt) => { let x = Math.imul((n + 1) ^ Math.imul(salt, 0x27d4eb2f), 0x9e3779b1); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
  function lookOf(p, age) {
    const L = p.look;
    if (!L || L.glasses !== undefined || L.beard !== undefined || L.hat !== undefined) return L; // your cast: as designed
    const band = Math.floor(age / 5), hit = derived.get(p);
    if (hit && hit.band === band && hit.base === L) return hit.look;
    const id = p.id, man = p.sex === 'M', x = {};
    if (age >= 16 && h01(id, 1) < 0.06 + 0.008 * Math.max(0, age - 35)) x.glasses = h01(id, 2) < 0.25 ? 2 : 1;
    if (x.glasses && h01(id, 11) < 0.25) x.glasses = 3; // round spectacles
    if (man && age >= 20 && h01(id, 3) < ({ malay: 0.3, indian: 0.35, chinese: 0.12 }[p.eth] || 0.25)) { const r = h01(id, 4); x.beard = r < 0.4 ? 1 : r < 0.6 ? 2 : r < 0.85 ? 3 : 4; }
    if (man && age >= 18) {
      const r = h01(id, 5);
      if (p.eth === 'malay' && r < 0.1) x.hat = 1; // songkok
      else if (p.eth === 'malay' && r < 0.18) x.hat = 2; // kopiah
      else if (p.eth === 'indian' && r < 0.05) { x.hat = 4; x.hatColour = TURBANS[Math.floor(h01(id, 6) * TURBANS.length)]; } // turban
      else if (age < 50 && r > 0.92) { x.hat = 3; x.hatColour = CAP_COLOURS[Math.floor(h01(id, 7) * CAP_COLOURS.length)]; } // cap
    }
    if (!x.hat && age >= 14 && age < 40 && L.style !== 3 && h01(id, 12) < 0.04) { x.hat = 5; x.hatColour = CAP_COLOURS[Math.floor(h01(id, 13) * CAP_COLOURS.length)]; } // beanie
    // Expansion 1 hairstyles for residents, by the same fixed rule (short hair or long hair only).
    const hs = h01(id, 14);
    if (L.style === 0) { const st = hs < 0.15 ? 5 : hs < 0.27 ? 9 : hs < 0.37 ? 4 : hs < 0.45 ? 8 : 0; if (st) x.style = st; }
    else if (L.style === 1) { const st = hs < 0.2 ? 6 : hs < 0.32 ? 7 : hs < 0.45 ? 8 : hs < 0.52 ? 4 : 0; if (st) x.style = st; }
    const look = Object.keys(x).length ? Object.assign({}, L, x) : L;
    derived.set(p, { band, base: L, look });
    return look;
  }

  LES.Sprites = {
    lookOf,
    // group: 'baby' | 'child' | 'adult' | 'elder'; frame 0/1 for walking legs;
    // view: 'front' | 'back' | 'side' (facing right) | 'sideL' (facing left);
    // build (adults): 0 slim, 1 average (default), 2 broad; pose: 'sit' or nothing
    person(look, group, frame, outfit, view, build, pose) {
      view = view || 'front';
      const adultish = group === 'adult' || group === 'elder';
      build = adultish && build !== undefined ? build : 1;
      pose = adultish && pose === 'sit' ? 'sit' : '';
      let lk = lookKeys.get(look); // looks are long-lived objects: build their part of the key once
      if (lk === undefined) { lk = `${look.skin}${look.hair}${look.shirt}${look.pants}${look.style}${look.scarf}${look.glasses || ''}${look.beard || ''}${look.hat || ''}${look.hatColour || ''}`; lookKeys.set(look, lk); }
      const key = `${lk}|${group}|${frame}|${outfit || ''}|${view}|${build}${pose}`;
      let cv = cache.get(key);
      if (cv) return cv;
      if (cache.size > 24000) { // bounded: forget the oldest quarter (Map keeps insertion order)
        let n = cache.size >> 2;
        for (const k of cache.keys()) { cache.delete(k); if (--n <= 0) break; }
      }
      const def = OUTFITS[outfit];
      const of = typeof def === 'function' ? def(look) : def;
      let rows = rowsFor(group, look.style in HEAD.front ? look.style : 0, view, frame, build, pose);
      if ((group === 'adult' || group === 'elder') && (look.glasses || look.beard || look.hat)) rows = addExtras(rows, look, view === 'sideL' ? 'side' : view);
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
        if ((ch === 't' || ch === 'p' || ch === 'c' || ch === 'h' || ch === 'H' || ch === 'b') && !filled(x + 1, y)) c = darker(c, 0.78);
        g.fillStyle = c;
        g.fillRect(x + 1, y + 1, 1, 1);
      }
      if (of && of.sash && group !== 'child' && group !== 'baby') { // saree drape over one shoulder
        g.fillStyle = of.sash;
        for (let i = 0; i < 4; i++) g.fillRect(2 + i, 6 + i, 1, 1);
      }
      if (of && (group === 'adult' || group === 'elder')) { // Expansion 1 uniform details (torso rows 5-8; +1 for the outline)
        const front = view === 'front', side = view === 'side' || view === 'sideL';
        if (of.apron && front) { g.fillStyle = of.apron; g.fillRect(3, 7, 4, 3); g.fillRect(4, 6, 2, 1); }
        if (of.tie && front) { g.fillStyle = of.tie; g.fillRect(5, 6, 1, 3); }
        if (of.badge && !(view === 'back')) { g.fillStyle = of.badge; g.fillRect(side ? (view === 'sideL' ? 4 : 5) : 6, 7, 1, 1); }
        if (of.band) { g.fillStyle = of.band; for (let x = 1; x <= wpx; x++) if (filled(x - 1, 7)) g.fillRect(x, 8, 1, 1); }
      }
      cache.set(key, cv);
      return cv;
    },
  };
})(globalThis.LES = globalThis.LES || {});
