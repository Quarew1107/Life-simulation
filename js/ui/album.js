// Life album and moment cards (art upgrade Phase 3.2 and 3.5). Every big moment the game already records for the
// played character (Player.moment: birth, school, graduation, first job, wedding, a baby, retirement, a loss...)
// becomes a photo: a backdrop in a frame, with the character at their age that day and the people involved.
// Nothing is stored: photos are drawn from the journal and the chain of played characters when they are shown.
(function (LES) {
  'use strict';
  const AL = LES.Album = {};
  const A = () => LES.ArtPack, P = LES.P, U = LES.U;
  const T = (k, p) => LES.I18n.t(k, p);
  const esc = s => U.esc(s);
  const $ = id => document.getElementById(id);

  // Backdrop, frame and effect for each kind of moment.
  AL.KINDS = {
    born: ['hospital', 'white', 'hearts'], school: ['school', 'wood', 'sparkle'], schoolDone: ['stage', 'wood', 'sparkle'],
    graduated: ['stage', 'gold', 'confetti'], firstJob: ['office', 'wood', 'confetti'], newJob: ['office', 'wood', 'sparkle'],
    promoted: ['office', 'white', 'sparkle'], together: ['park', 'white', 'hearts'], married: ['pelamin', 'gold', 'hearts'],
    child: ['hospital', 'white', 'hearts'], grandchild: ['hospital', 'white', 'hearts'], business: ['shop', 'wood', 'confetti'],
    elected: ['townhall', 'gold', 'confetti'], retired: ['retire', 'wood', 'sparkle'], lost: ['remember', 'black', 'candle'],
    home: ['newhome', 'wood', 'sparkle'], jackpot: ['party', 'gold', 'confetti'], birthday: ['birthday', 'white', 'confetti'],
  };
  const ROUND = new Set([1, 18, 21, 30, 40, 50, 60, 70, 80, 90, 100]); // birthdays worth a photo

  AL.available = () => !!(A() && A().ready && A().has('photo.frame.wood') && A().has('photo.bg.home'));

  // The photos of the played lives, oldest first: [{ e (journal entry), kind, day, owner (person) }].
  AL.photos = function (w) {
    const s = w && w.player;
    if (!s || !s.journal) return [];
    const chain = s.chain && s.chain.length ? s.chain : [{ id: s.id, day: 0 }];
    const ownerAt = day => { let c = chain[0]; for (const x of chain) if (x.day <= day) c = x; return w.people[c.id]; };
    return s.journal.filter(e => e.kind === 'moment' && AL.KINDS[e.moment] && (e.moment !== 'birthday' || ROUND.has(Number(e.params && e.params.age))))
      .map(e => ({ e, kind: e.moment, day: e.day, owner: ownerAt(e.day) })).filter(ph => ph.owner);
  };

  const ageOn = (p, day) => (day - p.birthDay) / 365;
  const byName = (w, name, pool) => (name ? (pool || w.people).find(q => q && P.name(q) === name) : null) || null;
  const frameName = (g, act) => `person.${g}.${act}`;
  const groupAt = a => a < 3 ? 'baby' : a < 13 ? 'child' : 'adult';

  // Who stands in the photo: [{ p, frame }] (room-size sprites, at their age on the day).
  function cast(w, ph) {
    const o = ph.owner, d = ph.day, a = ageOn(o, d), out = [];
    const self = act => { const g = groupAt(a); return { p: o, frame: g === 'baby' ? 'person.baby.sit' : frameName(g, act || 'stand') }; };
    const partner = () => { const q = byName(w, ph.e.params && ph.e.params.other) || (o.partnerId !== null ? w.people[o.partnerId] : null); return q && ageOn(q, d) >= 0 ? { p: q, frame: frameName(groupAt(ageOn(q, d)), 'stand') } : null; };
    if (ph.kind === 'born') { // a newborn in a parent's arms
      const ps = (o.parents || []).map(id => w.people[id]).filter(q => q && ageOn(q, d) >= 13).sort((x, y) => (x.sex === 'F' ? 0 : 1) - (y.sex === 'F' ? 0 : 1));
      if (ps[0]) out.push({ p: ps[0], frame: 'person.adult.baby.0', holds: o });
      else out.push({ p: o, frame: 'person.baby.lie' });
      if (ps[1]) out.push({ p: ps[1], frame: 'person.adult.stand' });
      return out;
    }
    if (ph.kind === 'child' || ph.kind === 'grandchild') { out.push(a >= 13 ? { p: o, frame: 'person.adult.baby.0' } : self()); const q = ph.kind === 'child' && partner(); if (q) out.push(q); return out; }
    out.push(self());
    if (ph.kind === 'together' || ph.kind === 'married') { const q = partner(); if (q) out.push(q); }
    return out;
  }

  // The hole of a frame (the see-through middle), measured once.
  const holes = new Map();
  function holeOf(id) {
    if (holes.has(id)) return holes.get(id);
    const img = A().pixels(id), W = img.width, H = img.height, d = img.data, cy = H >> 1, cx = W >> 1;
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    while (x0 > 0 && !d[(cy * W + x0 - 1) * 4 + 3]) x0--;
    while (x1 < W - 1 && !d[(cy * W + x1 + 1) * 4 + 3]) x1++;
    while (y0 > 0 && !d[((y0 - 1) * W + cx) * 4 + 3]) y0--;
    while (y1 < H - 1 && !d[((y1 + 1) * W + cx) * 4 + 3]) y1++;
    const h = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
    holes.set(id, h);
    return h;
  }

  // Draw one photo into canvas c (game pixels 88 x 64, scaled to fit). fx: { kind, frame } draws an effect too.
  AL.draw = function (c, w, ph, fx) {
    const art = A(), [bgName, frameStyle] = AL.KINDS[ph.kind], fid = `photo.frame.${frameStyle}`, hole = holeOf(fid);
    const pc = AL._pc || (AL._pc = document.createElement('canvas'));
    pc.width = hole.W; pc.height = hole.H;
    const g = pc.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, hole.W, hole.H);
    g.save(); g.beginPath(); g.rect(hole.x, hole.y, hole.w, hole.h); g.clip();
    const [bw, bh] = art.size(`photo.bg.${bgName}`), f = art.frames.get(`photo.bg.${bgName}`);
    const sx = Math.max(0, Math.round((bw - hole.w) / 2)), sy = Math.max(0, Math.round((bh - hole.h) / 2));
    g.drawImage(f.img, f.x + sx, f.y + sy, Math.min(bw, hole.w), Math.min(bh, hole.h), hole.x + Math.max(0, Math.round((hole.w - bw) / 2)), hole.y + Math.max(0, Math.round((hole.h - bh) / 2)), Math.min(bw, hole.w), Math.min(bh, hole.h));
    const who = cast(w, ph), base = hole.y + hole.h - 2, gap = 17;
    who.forEach((m, i) => {
      const age = Math.max(0, ageOn(m.p, ph.day)), look = LES.Sprites.lookOf(m.p, age);
      const spr = art.person(art.has(m.frame) ? m.frame : m.frame.replace(/\.\d$/, '') , look, { grey: age >= 65 && look.style !== 3 });
      if (!spr) return;
      const x = Math.round(hole.x + hole.w / 2 + (i - (who.length - 1) / 2) * gap - spr.width / 2);
      g.drawImage(spr, x, base - spr.height);
    });
    if (fx) {
      const id = `fx.${fx.kind}.${fx.frame % 3}`;
      if (art.has(id)) {
        const [ew, eh] = art.size(id);
        if (fx.kind === 'candle') { art.draw(g, id, hole.x + hole.w - ew - 6, base - eh); art.draw(g, id, hole.x + 6, base - eh); }
        else art.draw(g, id, Math.round(hole.x + hole.w / 2 - ew / 2), hole.y + 2);
      }
    }
    g.restore();
    art.draw(g, fid, 0, 0);
    const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false; cg.clearRect(0, 0, c.width, c.height);
    const k = Math.min(c.width / hole.W, c.height / hole.H);
    cg.drawImage(pc, Math.round((c.width - hole.W * k) / 2), Math.round((c.height - hole.H * k) / 2), hole.W * k, hole.H * k);
  };

  const caption = ph => `${U.fmtDate(ph.day)} · ${ph.kind === 'birthday' ? T('album.birthday', { age: ph.e.params.age }) : LES.I18n.t(ph.e.key, ph.e.params || {})}`;
  AL.caption = caption;

  // The album: one section per played life, photos in order.
  AL.open = function (app) {
    const w = app.world, card = $('modal-card');
    if (!w || !card) return;
    const photos = AL.available() ? AL.photos(w) : [], s = w.player, me = s ? w.people[s.id] : null;
    const lives = [];
    for (const ph of photos) { let l = lives.find(x => x.owner === ph.owner); if (!l) lives.push(l = { owner: ph.owner, list: [] }); l.list.push(ph); }
    const on = AL.cardsOn();
    card.classList.add('wide'); card.onclick = null;
    card.innerHTML = `<h1>📷 ${esc(T('album.title', { name: me ? P.name(me) : '' }))}</h1>
      ${lives.length ? lives.map((l, li) => `<h3 class="album-life">${esc(T('album.life', { name: P.name(l.owner) }))}</h3><div class="album-grid">${l.list.map((ph, i) => `<figure class="album-photo"><canvas width="176" height="128" data-ph="${li}:${i}"></canvas><figcaption>${esc(caption(ph))}</figcaption></figure>`).join('')}</div>`).join('')
        : `<p class="lead">${esc(T('album.empty'))}</p>`}
      <div class="modal-actions"><label class="album-opt"><input type="checkbox" id="album-cards" ${on ? 'checked' : ''}> ${esc(T('album.cards'))}</label><span class="spacer"></span><button class="primary" id="album-close">${esc(T('pn.tb.close'))}</button></div>`;
    for (const c of card.querySelectorAll('canvas[data-ph]')) { const [li, i] = c.dataset.ph.split(':').map(Number); AL.draw(c, w, lives[li].list[i]); }
    $('modal').classList.remove('hidden');
    $('album-close').onclick = () => $('modal').classList.add('hidden');
    $('album-cards').onchange = e => { try { localStorage.setItem('les-moment-cards', e.target.checked ? '1' : '0'); } catch (err) { /* private window */ } };
  };

  AL.cardsOn = () => { try { return localStorage.getItem('les-moment-cards') !== '0'; } catch (e) { return true; } };

  // Moment cards: a big new moment shows its photo in the corner of the map for 4 seconds, with an effect.
  // It never pauses the game. Called every frame (cheap: compares one number).
  const card = { world: null, seq: 0, until: 0, raf: 0 };
  AL.tick = function (app, now) {
    const w = app.world, s = w && w.player;
    if (!s || !s.moments) return;
    const last = s.moments[s.moments.length - 1];
    if (card.world !== w) { card.world = w; card.seq = last ? last.seq : 0; return; } // a new or loaded world: no old cards
    if (!last || last.seq <= card.seq) return;
    card.seq = last.seq;
    if (!last.big || !AL.KINDS[last.kind] || !AL.cardsOn() || !AL.available() || app.view === 'region') return;
    const e = s.journal.slice().reverse().find(x => x.kind === 'moment' && x.moment === last.kind && x.day === last.day);
    const owner = w.people[s.id];
    if (!e || !owner) return;
    AL.show(w, { e, kind: last.kind, day: last.day, owner }, now);
  };
  AL.show = function (w, ph, now) {
    let el = $('moment-card');
    if (!el && !$('map-wrap')) return false; // no map on this page (tests)
    if (!el) {
      el = document.createElement('div'); el.id = 'moment-card';
      el.innerHTML = '<canvas width="176" height="128"></canvas><div class="mc-text"></div>';
      el.onclick = () => { el.classList.add('hidden'); card.until = 0; };
      $('map-wrap').appendChild(el);
    }
    el.classList.remove('hidden');
    el.querySelector('.mc-text').textContent = caption(ph);
    const c = el.querySelector('canvas'), fxKind = AL.KINDS[ph.kind][2], start = now || performance.now();
    card.until = start + 4000;
    cancelAnimationFrame(card.raf);
    const step = t => {
      if (!card.until || t > card.until) { el.classList.add('hidden'); return; }
      AL.draw(c, w, ph, { kind: fxKind, frame: Math.floor((t - start) / 180) });
      card.raf = requestAnimationFrame(step);
    };
    card.raf = requestAnimationFrame(step);
  };
})(globalThis.LES = globalThis.LES || {});
